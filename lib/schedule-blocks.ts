import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { DEFAULT_TIMEZONE, calendarDateInZone, tenantCalendarDayWindow } from '@/lib/timezone'

type DbClient = typeof prisma | Prisma.TransactionClient

export const BLOCKED_DATE_ERROR = 'Esta data está bloqueada para agendamentos'

/** Agendamentos nesses status ainda vão acontecer — são os que o aviso de bloqueio precisa mostrar. */
const OPEN_STATUSES = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] as const

/** Dia de calendário UTC ("YYYY-MM-DD") de um instante gravado em ScheduleBlock. */
export function blockDay(instant: Date | string): string {
  return new Date(instant).toISOString().slice(0, 10)
}

/**
 * A data de calendário `dateStr` cai dentro de algum bloqueio?
 *
 * Ponto único dessa regra: a grade de horários (`availability-service`) e a
 * trava na escrita (`appointment-service`) usam esta mesma função — o que a
 * tela esconde é exatamente o que o servidor recusa. Bloqueios são comparados
 * pela data de calendário UTC dos instantes gravados (semântica que a produção
 * já aplicava), independente do fuso do processo.
 */
export function isDateBlocked(
  dateStr: string,
  blocks: { startDate: Date | string; endDate: Date | string }[]
): boolean {
  return blocks.some((block) => dateStr >= blockDay(block.startDate) && dateStr <= blockDay(block.endDate))
}

/** O instante `date` (no fuso do negócio) cai num dia bloqueado desta agenda? */
export async function isScheduleDateBlocked(params: {
  scheduleId: string
  date: Date
  tx?: DbClient
}): Promise<boolean> {
  const db = params.tx ?? prisma
  const schedule = await db.schedule.findUnique({
    where: { id: params.scheduleId },
    select: {
      blocks: { select: { startDate: true, endDate: true } },
      user: { select: { businessConfig: { select: { timezone: true } } } },
    },
  })
  if (!schedule) return false
  const timeZone = schedule.user.businessConfig?.timezone || DEFAULT_TIMEZONE
  return isDateBlocked(calendarDateInZone(params.date, timeZone), schedule.blocks)
}

export interface BlockConflict {
  id: string
  date: Date
  clientName: string
  serviceName: string
}

/**
 * Agendamentos abertos que já existem dentro do período que vai ser
 * bloqueado, nas agendas-alvo. Só LÊ — serve para avisar o dono antes de
 * concluir; o bloqueio nunca cancela, move ou edita esses agendamentos.
 */
export async function findAppointmentsInBlockRange(
  db: DbClient,
  params: { userId: string; scheduleIds: string[]; startDate: Date; endDate: Date; timeZone: string }
): Promise<BlockConflict[]> {
  const { userId, scheduleIds, startDate, endDate, timeZone } = params
  if (scheduleIds.length === 0) return []

  const from = tenantCalendarDayWindow(timeZone, blockDay(startDate)).start
  const to = tenantCalendarDayWindow(timeZone, blockDay(endDate)).end

  const appointments = await db.appointment.findMany({
    where: {
      userId,
      scheduleId: { in: scheduleIds },
      date: { gte: from, lte: to },
      status: { in: [...OPEN_STATUSES] },
      deletedAt: null,
    },
    select: {
      id: true,
      date: true,
      client: { select: { name: true } },
      service: { select: { name: true } },
      specialty: true,
    },
    orderBy: { date: 'asc' },
  })

  return appointments.map((a) => ({
    id: a.id,
    date: a.date,
    clientName: a.client.name,
    serviceName: a.service?.name || a.specialty || 'Agendamento',
  }))
}

/**
 * Cria um bloqueio por agenda. Com mais de uma agenda, todos os blocos
 * compartilham o mesmo `groupId`, para o dono enxergar e remover o conjunto.
 */
export async function createBlocks(
  db: DbClient,
  params: {
    scheduleIds: string[]
    startDate: Date
    endDate: Date
    reason: string | null
    isAllDay: boolean
    grouped: boolean
  }
): Promise<{ count: number; groupId: string | null }> {
  const groupId = params.grouped ? randomUUID() : null
  const result = await db.scheduleBlock.createMany({
    data: params.scheduleIds.map((scheduleId) => ({
      scheduleId,
      startDate: params.startDate,
      endDate: params.endDate,
      reason: params.reason,
      isAllDay: params.isAllDay,
      groupId,
    })),
  })
  return { count: result.count, groupId }
}

/** Remove todos os blocos de um grupo — sempre escopado ao tenant dono. */
export async function deleteBlockGroup(db: DbClient, params: { userId: string; groupId: string }): Promise<number> {
  const result = await db.scheduleBlock.deleteMany({
    where: { groupId: params.groupId, schedule: { userId: params.userId } },
  })
  return result.count
}
