export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { WhatsAppTriggerService } from '@/lib/whatsapp-trigger';
import { generateConfirmationToken, buildConfirmationUrl } from '@/lib/confirmation-token';
import { tenantDayWindow } from '@/lib/timezone';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const SEND_THROTTLE_MS = 300;
const MAX_PER_TENANT_PER_RUN = 200;

/**
 * Internal API to send the "please confirm attendance" WhatsApp link.
 * Should be called by a CRON job (e.g., once a day).
 *
 * Separate route from schedule-reminders on purpose: different cadence
 * (daily vs hourly) and different failure blast radius — a bug in the
 * token/link path must not be able to stop reminders from going out.
 */
export async function GET(request: NextRequest) {
  try {
    // Fail closed: sem CRON_SECRET configurado, a rota fica desabilitada.
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[Internal:SendConfirmations] CRON_SECRET não configurado — rota desabilitada');
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configs = await prisma.whatsAppConfig.findMany({
      where: { enabled: true, isConnected: true, notifyConfirmation: true },
      include: {
        user: {
          select: {
            id: true,
            businessName: true,
            businessConfig: { select: { timezone: true } },
          },
        },
      },
    });

    let totalSent = 0;
    let totalSkipped = 0;

    for (const config of configs) {
      const timezone = config.user.businessConfig?.timezone || 'America/Sao_Paulo';
      const { start, end } = tenantDayWindow(timezone, config.confirmationDays);

      const appointments = await prisma.appointment.findMany({
        where: {
          userId: config.userId,
          status: 'SCHEDULED', // não pede confirmação de algo que já está CONFIRMED
          date: { gte: start, lte: end },
          deletedAt: null,
          confirmationRequest: { is: null }, // anti-duplicata declarativa — a unique é a trava real
        },
        include: {
          client: true,
          service: { select: { name: true } },
          professionalUser: { select: { name: true } },
        },
        take: MAX_PER_TENANT_PER_RUN,
      });

      for (const appointment of appointments) {
        if (!appointment.client.phone) {
          totalSkipped++;
          continue;
        }

        const { token, tokenHash, tokenPrefix } = generateConfirmationToken();

        // Claim-then-send: cria a linha antes de enviar. Se outro run já
        // reivindicou este agendamento (P2002 em appointmentId), pula.
        try {
          await prisma.appointmentConfirmation.create({
            data: {
              appointmentId: appointment.id,
              userId: config.userId,
              tokenHash,
              tokenPrefix,
              expiresAt: appointment.date,
            },
          });
        } catch (error) {
          totalSkipped++;
          continue;
        }

        const serviceName = appointment.service?.name || appointment.specialty || 'Serviço';
        const professionalName = appointment.professionalUser?.name || appointment.professional || undefined;

        const sent = await WhatsAppTriggerService.onAppointmentConfirmationRequest(
          appointment as any,
          serviceName,
          professionalName,
          buildConfirmationUrl(token)
        );

        if (sent) {
          await prisma.appointmentConfirmation.update({
            where: { appointmentId: appointment.id },
            data: { sentAt: new Date() },
          });
          totalSent++;
        } else {
          // Libera o agendamento para tentar de novo no próximo run.
          await prisma.appointmentConfirmation.delete({ where: { appointmentId: appointment.id } });
          totalSkipped++;
        }

        await sleep(SEND_THROTTLE_MS);
      }
    }

    return NextResponse.json({
      success: true,
      processedConfigs: configs.length,
      confirmationsSent: totalSent,
      skipped: totalSkipped,
    });
  } catch (error) {
    console.error('[Internal:SendConfirmations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
