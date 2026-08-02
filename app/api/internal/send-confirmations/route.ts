export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { prisma } from '@/lib/db';
import { tenantDayWindow } from '@/lib/timezone';
import { enqueueAccountJobs, type DispatchJob } from '@/lib/whatsapp-dispatch-queue';

const MAX_PER_TENANT_PER_RUN = 200;

/**
 * Disparado uma vez por dia pelo QStash (ver scripts/setup-qstash-schedules.ts).
 * Só CONSULTA o banco e ENFILEIRA um job por agendamento em
 * /api/internal/dispatch-whatsapp — quem envia de verdade é o dispatch,
 * um de cada vez, espaçado. Isso mantém esta rota rápida mesmo com muitos
 * agendamentos pendentes (sem risco de estourar o timeout da function).
 *
 * Assinado pelo QStash (verifySignatureAppRouter) — sem QSTASH_CURRENT_SIGNING_KEY/
 * QSTASH_NEXT_SIGNING_KEY configuradas, a lib rejeita a requisição (fail closed).
 */
async function handler(_request: NextRequest) {
  try {
    const configs = await prisma.whatsAppConfig.findMany({
      where: { enabled: true, isConnected: true, notifyConfirmation: true },
      include: {
        user: {
          select: {
            id: true,
            businessConfig: { select: { timezone: true } },
          },
        },
      },
    });

    let totalQueued = 0;
    let processedConfigs = 0;

    for (const config of configs) {
      const timezone = config.user.businessConfig?.timezone || 'America/Sao_Paulo';
      const { start, end } = tenantDayWindow(timezone, config.confirmationDays);

      const appointments = await prisma.appointment.findMany({
        where: {
          userId: config.userId,
          status: 'SCHEDULED', // não pede confirmação de algo que já está CONFIRMED
          date: { gte: start, lte: end },
          deletedAt: null,
          confirmationRequest: { is: null }, // anti-duplicata declarativa — o unique real é criado no dispatch
        },
        select: { id: true },
        take: MAX_PER_TENANT_PER_RUN,
      });

      if (appointments.length === 0) continue;

      const jobs: DispatchJob[] = appointments.map((a) => ({ kind: 'confirmation-request', appointmentId: a.id }));
      totalQueued += await enqueueAccountJobs(jobs);
      processedConfigs++;
    }

    return NextResponse.json({
      success: true,
      processedConfigs,
      confirmationsQueued: totalQueued,
    });
  } catch (error) {
    console.error('[Internal:SendConfirmations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
