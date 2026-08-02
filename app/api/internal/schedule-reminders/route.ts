export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { prisma } from '@/lib/db';
import { enqueueAccountJobs, type DispatchJob } from '@/lib/whatsapp-dispatch-queue';

/**
 * Disparado a cada hora pelo QStash (ver scripts/setup-qstash-schedules.ts).
 * Só CONSULTA o banco e ENFILEIRA um job por agendamento em
 * /api/internal/dispatch-whatsapp — quem envia de verdade é o dispatch,
 * um de cada vez, espaçado (ver lib/whatsapp-dispatch-queue.ts).
 *
 * Assinado pelo QStash (verifySignatureAppRouter) — sem QSTASH_CURRENT_SIGNING_KEY/
 * QSTASH_NEXT_SIGNING_KEY configuradas, a lib rejeita a requisição (fail closed).
 */
async function handler(_request: NextRequest) {
  try {
    const now = new Date();

    const activeConfigs = await prisma.whatsAppConfig.findMany({
      where: {
        enabled: true,
        isConnected: true,
        notifyReminder: true,
      },
    });

    let totalQueued = 0;

    for (const config of activeConfigs) {
      const reminderHours = config.reminderHours || 24;

      // Janela alvo: hora exata do lembrete, com folga de 30min pra cada lado.
      const targetTime = new Date(now.getTime() + reminderHours * 60 * 60 * 1000);
      const windowStart = new Date(targetTime.getTime() - 30 * 60 * 1000);
      const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000);

      const appointments = await prisma.appointment.findMany({
        where: {
          userId: config.userId,
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          date: { gte: windowStart, lte: windowEnd },
          deletedAt: null,
          // Sem flag de dedupe própria ainda (gap pré-existente — ver TODO
          // original) — fora do escopo desta migração, só o disparo mudou.
        },
        select: { id: true },
      });

      if (appointments.length === 0) continue;

      const jobs: DispatchJob[] = appointments.map((a) => ({ kind: 'reminder', appointmentId: a.id }));
      totalQueued += await enqueueAccountJobs(jobs);
    }

    return NextResponse.json({
      success: true,
      processedConfigs: activeConfigs.length,
      remindersQueued: totalQueued,
    });
  } catch (error) {
    console.error('[Internal:ScheduleReminders] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
