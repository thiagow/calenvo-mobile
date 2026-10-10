import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  DEFAULT_TIMEZONE,
  calendarDateInZone,
  formatInZone,
  tenantCalendarDayWindow,
  wallTimeToInstant,
} from '@/lib/timezone'

type DbClient = typeof prisma | Prisma.TransactionClient

export const BLOCKED_DATE_ERROR = 'Esta data está bloqueada para agendamentos'

/** Agendamentos nesses status ainda vão acontecer — são os que o aviso de bloqueio precisa mostrar. */
const OPEN_STATUSES = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] as const

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Bloqueio como o motor o enxerga. `isAllDay` ausente conta como dia inteiro —
 * é o padrão do schema e o que toda linha antiga representava.
 */
export interface BlockRange {
  startDate: Date | string
  endDate: Date | string
  isAllDay?: boolean
}

/** Dia de calendário UTC ("YYYY-MM-DD") de um instante gravado em ScheduleBlock. */
export function blockDay(instant: Date | string): string {
  return new Date(instant).toISOString().slice(0, 10)
}

/**
 * A data de calendário `dateStr` cai dentro de algum bloqueio de DIA INTEIRO?
 *
 * Bloqueios de dia inteiro são gravados como meia-noite UTC do dia escolhido e
 * comparados pela data de calendário UTC (semântica que a produção já aplicava),
 * independente do fuso do processo. Bloqueios de faixa de horário não entram
 * aqui — ver `isIntervalBlocked`.
 */
export function isDateBlocked(dateStr: string, blocks: BlockRange[]): boolean {
  return blocks.some(
    (block) =>
      block.isAllDay !== false && dateStr >= blockDay(block.startDate) && dateStr <= blockDay(block.endDate)
  )
}

/**
 * O intervalo [start, start+duração) esbarra em algum bloqueio da agenda?
 *
 * Ponto único dessa regra: a grade de horários (`availability-service`) e a
 * trava na escrita (`appointment-service`) usam esta mesma função — o que a
 * tela esconde é exatamente o que o servidor recusa. Dia inteiro bloqueia pela
 * data de calendário (no fuso do negócio); faixa de horário bloqueia por
 * sobreposição de instantes.
 */
export function isIntervalBlocked(params: {
  dateStr: string
  start: Date
  durationMinutes: number
  blocks: BlockRange[]
}): boolean {
  const { dateStr, start, durationMinutes, blocks } = params
  if (isDateBlocked(dateStr, blocks)) return true
  const end = start.getTime() + Math.max(durationMinutes, 1) * 60000
  return blocks.some(
    (block) =>
      block.isAllDay === false &&
      start.getTime() < new Date(block.endDate).getTime() &&
      end > new Date(block.startDate).getTime()
  )
}

/** O agendamento que começa em `date` e dura `duration` min cai num bloqueio desta agenda? */
export async function isScheduleDateBlocked(params: {
  scheduleId: string
  date: Date
  /** Duração do agendamento; sem ela só o início é considerado. */
  duration?: number
  tx?: DbClient
}): Promise<boolean> {
  const db = params.tx ?? prisma
  const schedule = await db.schedule.findUnique({
    where: { id: params.scheduleId },
    select: {
      blocks: { select: { startDate: true, endDate: true, isAllDay: true } },
      user: { select: { businessConfig: { select: { timezone: true } } } },
    },
  })
  if (!schedule) return false
  const timeZone = schedule.user.businessConfig?.timezone || DEFAULT_TIMEZONE
  return isIntervalBlocked({
    dateStr: calendarDateInZone(params.date, timeZone),
    start: params.date,
    durationMinutes: params.duration ?? 1,
    blocks: schedule.blocks,
  })
}

export type ParsedBlockInput =
  | { ok: true; startDate: Date; endDate: Date; isAllDay: boolean }
  | { ok: false; error: string }

function isRealDate(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== 'string' || !DATE_RE.test(dateStr)) return false
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString().slice(0, 10) === dateStr
}

/**
 * Converte o corpo da requisição no que é gravado em ScheduleBlock — única
 * porta de entrada para POST e PUT.
 *
 * - Dia inteiro: `startDate` e `endDate` opcional ("YYYY-MM-DD", inclusivo;
 *   sem `endDate` é um dia só). Gravados como meia-noite UTC.
 * - Faixa de horário: `date` + `startTime` + `endTime` ("HH:mm"), lidos no
 *   fuso do negócio e gravados como instantes reais. Nunca atravessa a meia-noite.
 */
export function parseBlockInput(body: Record<string, unknown>, timeZone: string): ParsedBlockInput {
  const isAllDay = body.isAllDay !== false

  if (isAllDay) {
    const start = typeof body.startDate === 'string' ? body.startDate.slice(0, 10) : body.startDate
    const rawEnd = typeof body.endDate === 'string' && body.endDate ? body.endDate.slice(0, 10) : start
    if (!isRealDate(start) || !isRealDate(rawEnd)) return { ok: false, error: 'Data inválida' }
    if (rawEnd < start) return { ok: false, error: 'A data de término não pode ser anterior à de início' }
    return {
      ok: true,
      isAllDay: true,
      startDate: new Date(`${start}T00:00:00.000Z`),
      endDate: new Date(`${rawEnd}T00:00:00.000Z`),
    }
  }

  const date = body.date ?? body.startDate
  if (!isRealDate(date)) return { ok: false, error: 'Data inválida' }
  const { startTime, endTime } = body
  if (typeof startTime !== 'string' || typeof endTime !== 'string' || !TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    return { ok: false, error: 'Horário inválido' }
  }
  if (endTime <= startTime) return { ok: false, error: 'O horário final deve ser posterior ao inicial' }
  return {
    ok: true,
    isAllDay: false,
    startDate: wallTimeToInstant(date, startTime, timeZone),
    endDate: wallTimeToInstant(date, endTime, timeZone),
  }
}

/** Campos prontos para exibição, para o cliente não converter fuso. */
export interface BlockDisplay {
  firstDay: string
  lastDay: string
  startTime: string | null
  endTime: string | null
}

export function describeBlock(block: BlockRange, timeZone: string): BlockDisplay {
  if (block.isAllDay !== false) {
    return { firstDay: blockDay(block.startDate), lastDay: blockDay(block.endDate), startTime: null, endTime: null }
  }
  const start = new Date(block.startDate)
  const end = new Date(block.endDate)
  const day = calendarDateInZone(start, timeZone)
  return { firstDay: day, lastDay: day, startTime: formatInZone(start, timeZone).time, endTime: formatInZone(end, timeZone).time }
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
  params: {
    userId: string
    scheduleIds: string[]
    startDate: Date
    endDate: Date
    timeZone: string
    /** Faixa de horário: só conta o agendamento que de fato esbarra na faixa. */
    isAllDay?: boolean
  }
): Promise<BlockConflict[]> {
  const { userId, scheduleIds, startDate, endDate, timeZone, isAllDay = true } = params
  if (scheduleIds.length === 0) return []

  // Dia inteiro: janela dos dias de calendário. Faixa: o dia do negócio em que ela cai.
  const from = isAllDay
    ? tenantCalendarDayWindow(timeZone, blockDay(startDate)).start
    : tenantCalendarDayWindow(timeZone, calendarDateInZone(startDate, timeZone)).start
  const to = isAllDay
    ? tenantCalendarDayWindow(timeZone, blockDay(endDate)).end
    : tenantCalendarDayWindow(timeZone, calendarDateInZone(endDate, timeZone)).end

  const found = await db.appointment.findMany({
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
      duration: true,
      client: { select: { name: true } },
      service: { select: { name: true } },
      specialty: true,
    },
    orderBy: { date: 'asc' },
  })

  const appointments = isAllDay
    ? found
    : found.filter(
        (a) =>
          a.date.getTime() < endDate.getTime() &&
          a.date.getTime() + (a.duration || 1) * 60000 > startDate.getTime()
      )

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

/**
 * Fluxo de criação compartilhado pelas duas rotas (uma agenda / várias):
 * valida o corpo, avisa de agendamentos já marcados no período e só então
 * grava. Quem chama garante antes que `scheduleIds` pertence ao tenant.
 * Devolve status + corpo prontos para o `NextResponse`.
 */
export async function createBlocksFromRequest(params: {
  userId: string
  scheduleIds: string[]
  body: Record<string, unknown>
  grouped: boolean
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { userId, scheduleIds, body, grouped } = params

  const businessConfig = await prisma.businessConfig.findUnique({ where: { userId }, select: { timezone: true } })
  const timeZone = businessConfig?.timezone || DEFAULT_TIMEZONE

  const parsed = parseBlockInput(body, timeZone)
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } }

  // Agendamentos que já existem no período: o bloqueio NUNCA os altera, mas o
  // dono precisa saber antes de concluir. Aviso imposto aqui no servidor —
  // sem confirmação explícita, nada é criado.
  const conflicts = await findAppointmentsInBlockRange(prisma, {
    userId,
    scheduleIds,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    timeZone,
    isAllDay: parsed.isAllDay,
  })

  if (conflicts.length > 0 && body.confirmConflicts !== true) {
    return {
      status: 409,
      body: {
        error: `Já existem ${conflicts.length} agendamento(s) neste período`,
        code: 'BLOCK_HAS_APPOINTMENTS',
        conflictingAppointments: conflicts.length,
        schedulesCount: scheduleIds.length,
        sample: conflicts.slice(0, 5).map((c) => ({
          date: c.date,
          clientName: c.clientName,
          serviceName: c.serviceName,
        })),
      },
    }
  }

  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null
  const { count, groupId } = await createBlocks(prisma, {
    scheduleIds,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    reason,
    isAllDay: parsed.isAllDay,
    grouped,
  })

  return {
    status: 201,
    body: { success: true, schedulesCount: count, groupId, conflictingAppointments: conflicts.length },
  }
}

/** Remove todos os blocos de um grupo — sempre escopado ao tenant dono. */
export async function deleteBlockGroup(db: DbClient, params: { userId: string; groupId: string }): Promise<number> {
  const result = await db.scheduleBlock.deleteMany({
    where: { groupId: params.groupId, schedule: { userId: params.userId } },
  })
  return result.count
}
