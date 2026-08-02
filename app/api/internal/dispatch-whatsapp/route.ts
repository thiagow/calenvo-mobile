export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { prisma } from '@/lib/db';
import { WhatsAppTriggerService } from '@/lib/whatsapp-trigger';
import { generateConfirmationToken, buildConfirmationUrl } from '@/lib/confirmation-token';

type DispatchJob =
  | { kind: 'reminder'; appointmentId: string }
  | { kind: 'confirmation-request'; appointmentId: string };

/**
 * Processa UMA notificação de WhatsApp por vez. Publicado pelo cron
 * (schedule-reminders / send-confirmations) via QStash, com um delay
 * individual — o espaçamento entre mensagens da mesma conta acontece no
 * momento da publicação (ver lib/whatsapp-throttle.ts), não aqui.
 *
 * Assinado pelo QStash (verifySignatureAppRouter): só aceita requisições
 * que a própria Upstash originou, com QSTASH_CURRENT_SIGNING_KEY /
 * QSTASH_NEXT_SIGNING_KEY configuradas — sem elas, a lib lança erro
 * (fail closed).
 */
async function handler(request: NextRequest) {
  const job = (await request.json()) as DispatchJob;

  if (!job?.appointmentId || !job?.kind) {
    return NextResponse.json({ error: 'Job inválido' }, { status: 400 });
  }

  if (job.kind === 'reminder') {
    await dispatchReminder(job.appointmentId);
  } else {
    await dispatchConfirmationRequest(job.appointmentId);
  }

  return NextResponse.json({ success: true });
}

async function dispatchReminder(appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] }, // pode ter mudado entre o enqueue e a execução
      deletedAt: null,
    },
    include: {
      client: true,
      user: { select: { businessName: true } },
      service: { select: { name: true } },
      professionalUser: { select: { name: true } },
    },
  });
  if (!appointment) return; // cancelado/concluído nesse meio-tempo — sem erro, só não envia

  const serviceName = appointment.service?.name || appointment.specialty || 'Serviço';
  const professionalName = appointment.professionalUser?.name || appointment.professional || undefined;

  await WhatsAppTriggerService.onAppointmentReminder(appointment as any, serviceName, professionalName);
}

async function dispatchConfirmationRequest(appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, status: 'SCHEDULED', deletedAt: null },
    include: {
      client: true,
      service: { select: { name: true } },
      professionalUser: { select: { name: true } },
    },
  });
  if (!appointment) return;

  const { token, tokenHash, tokenPrefix } = generateConfirmationToken();

  // Claim-then-send: mesma trava anti-duplicata que antes vivia no loop do
  // cron — agora vive aqui, no momento real do envio. Se outro job (retry
  // do QStash, corrida improvável) já reivindicou este agendamento, o
  // unique(appointmentId) falha e a gente simplesmente não envia de novo.
  try {
    await prisma.appointmentConfirmation.create({
      data: {
        appointmentId: appointment.id,
        userId: appointment.userId,
        tokenHash,
        tokenPrefix,
        expiresAt: appointment.date,
      },
    });
  } catch {
    return;
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
  } else {
    // Libera o agendamento para ser reconsiderado no próximo disparo diário.
    await prisma.appointmentConfirmation.delete({ where: { appointmentId: appointment.id } });
  }
}

export const POST = verifySignatureAppRouter(handler);
