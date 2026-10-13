export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { prisma } from '@/lib/db';
import { WhatsAppTriggerService } from '@/lib/whatsapp-trigger';
import { generateConfirmationToken, buildConfirmationUrl } from '@/lib/confirmation-token';
import { decryptSecret } from '@/lib/crypto';
import { sendText } from '@/lib/uazapi';
import { formatWhatsAppNumber } from '@/lib/utils';
import { logError } from '@/lib/error-logger';
import type { DispatchJob } from '@/lib/whatsapp-dispatch-queue';

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
  const job = (await request.json()) as Partial<DispatchJob> | null;

  if (job?.kind === 'reactivation' && 'messageId' in job && job.messageId) {
    await dispatchReactivation(job.messageId);
  } else if (job?.kind === 'reminder' && 'appointmentId' in job && job.appointmentId) {
    await dispatchReminder(job.appointmentId);
  } else if (job?.kind === 'confirmation-request' && 'appointmentId' in job && job.appointmentId) {
    await dispatchConfirmationRequest(job.appointmentId);
  } else {
    return NextResponse.json({ error: 'Job inválido' }, { status: 400 });
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

/**
 * Lembrete de retorno (envio manual pela tela de Retorno). O texto já foi
 * renderizado no enfileiramento (`renderedBody`). Sem retry do QStash em
 * falha de envio: `sendText` já tenta de novo em 429/5xx, e repetir o job
 * arriscaria mensagem duplicada para o cliente.
 */
async function dispatchReactivation(messageId: string) {
  const message = await prisma.reactivationMessage.findUnique({
    where: { id: messageId },
    include: { client: { select: { phone: true } } },
  });
  if (!message || message.status !== 'QUEUED') return; // já processado (retry/duplicata)

  // O cliente pode ter agendado o serviço entre o enfileiramento e agora.
  const alreadyBooked = await prisma.appointment.findFirst({
    where: {
      userId: message.userId,
      clientId: message.clientId,
      serviceId: message.serviceId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      date: { gte: new Date() },
      deletedAt: null,
    },
    select: { id: true },
  });
  if (alreadyBooked) {
    await prisma.reactivationMessage.update({ where: { id: messageId }, data: { status: 'SKIPPED' } });
    return;
  }

  const config = await prisma.whatsAppConfig.findUnique({
    where: { userId: message.userId },
    select: { isConnected: true, apiKey: true },
  });
  if (!config?.isConnected || !config.apiKey || !message.client.phone) {
    await prisma.reactivationMessage.update({
      where: { id: messageId },
      data: { status: 'FAILED', error: !message.client.phone ? 'Cliente sem telefone' : 'WhatsApp desconectado' },
    });
    return;
  }

  try {
    await sendText(decryptSecret(config.apiKey), formatWhatsAppNumber(message.client.phone), message.renderedBody);
    await prisma.reactivationMessage.update({
      where: { id: messageId },
      data: { status: 'SENT', sentAt: new Date() },
    });
  } catch (error) {
    await prisma.reactivationMessage.update({
      where: { id: messageId },
      data: { status: 'FAILED', error: error instanceof Error ? error.message.slice(0, 500) : 'Erro desconhecido' },
    });
    await logError({ functionality: 'whatsapp_reactivation', error, userId: message.userId, metadata: { messageId } });
  }
}

export const POST = verifySignatureAppRouter(handler);
