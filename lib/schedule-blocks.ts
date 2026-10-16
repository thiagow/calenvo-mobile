import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  DEFAULT_TIMEZONE,
  calendarDateInZone,
  formatInZone,
  tenantCalendarDayWindow,
  todayInZone,
  wallTimeToInstant,
} from '@/lib/timezone'

type DbClient = typeof prisma | Prisma.TransactionClient

export const BLOCKED_DATE_ERROR = 'Esta data está bloqueada para agendamentos'
export const PROFESSIONAL_BLOCKED_ERROR = 'Este profissional está indisponível neste período'

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
  /** Bloqueio pessoal: fecha só este profissional. Ausente/null = vale para a agenda inteira. */
  professionalId?: string | null
}

/** Bloqueios que fecham a agenda inteira (todos os profissionais). */
export function scheduleWideBlocks<T extends BlockRange>(blocks: T[]): T[] {
  return blocks.filter((b) => !b.professionalId)
}

/** Bloqueios pessoais de um profissional (só os dele, sem os da agenda inteira). */
export function professionalOwnBlocks<T extends BlockRange>(blocks: T[], professionalId: string): T[] {
  return blocks.filter((b) => b.professionalId === professionalId)
}

/** Tudo que fecha este profissional nesta agenda: bloqueios da agenda inteira + os pessoais dele. */
export function blocksForProfessional<T extends BlockRange>(blocks: T[], professionalId: string | null | undefined): T[] {
  return blocks.filter((b) => !b.professionalId || b.professionalId === professionalId)
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
  /** Profissional do agendamento: além dos bloqueios da agenda, vale o bloqueio pessoal dele. */
  professionalId?: string | null
  tx?: DbClient
}): Promise<boolean> {
  const db = params.tx ?? prisma
  const schedule = await db.schedule.findUnique({
    where: { id: params.scheduleId },
    select: {
      blocks: { select: { startDate: true, endDate: true, isAllDay: true, professionalId: true } },
      user: { select: { businessConfig: { select: { timezone: true } } } },
    },
  })
  if (!schedule) return false
  const timeZone = schedule.user.businessConfig?.timezone || DEFAULT_TIMEZONE
  return isIntervalBlocked({
    dateStr: calendarDateInZone(params.date, timeZone),
    start: params.date,
    durationMinutes: params.duration ?? 1,
    blocks: blocksForProfessional(schedule.blocks, params.professionalId),
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

/** O bloqueio já terminou? Dia inteiro: último dia anterior a hoje (no fuso do negócio); faixa: horário final passou. */
export function isBlockPast(block: BlockRange, timeZone: string, now: Date = new Date()): boolean {
  if (block.isAllDay !== false) return blockDay(block.endDate) < todayInZone(timeZone, now)
  return new Date(block.endDate).getTime() <= now.getTime()
}

/**
 * Dois bloqueios se sobrepõem? Faixa × faixa: sobreposição de instantes. Se
 * algum é de dia inteiro: sobreposição dos dias de calendário (a faixa conta
 * pelo dia em que cai no fuso do negócio) — mesma semântica de `isIntervalBlocked`.
 */
export function blocksOverlap(a: BlockRange, b: BlockRange, timeZone: string): boolean {
  if (a.isAllDay === false && b.isAllDay === false) {
    return (
      new Date(a.startDate).getTime() < new Date(b.endDate).getTime() &&
      new Date(a.endDate).getTime() > new Date(b.startDate).getTime()
    )
  }
  const da = describeBlock(a, timeZone)
  const db = describeBlock(b, timeZone)
  return da.firstDay <= db.lastDay && db.firstDay <= da.lastDay
}

/** Bloqueio já existente que colide com o que vai ser criado — uma linha por período distinto (grupo = uma linha). */
export interface OverlappingBlock extends BlockDisplay {
  key: string
  reason: string | null
  scheduleNames: string[]
}

/**
 * Bloqueios que já cobrem (parte do) período a ser criado nas agendas-alvo.
 * Só LÊ. Existe porque bloqueios sobrepostos faziam o dia continuar fechado
 * depois de o dono apagar "o" bloqueio — havia outro por baixo.
 */
export async function findOverlappingBlocks(
  db: DbClient,
  params: {
    scheduleIds: string[]
    startDate: Date
    endDate: Date
    isAllDay: boolean
    timeZone: string
    /** Dono do bloqueio a criar: o profissional (bloqueio pessoal) ou null (agenda inteira). */
    professionalId?: string | null
  }
): Promise<OverlappingBlock[]> {
  const { scheduleIds, startDate, endDate, isAllDay, timeZone, professionalId = null } = params
  if (scheduleIds.length === 0) return []

  // Margem de 1 dia: bloqueio de dia inteiro é gravado em 00:00Z, e o dia do negócio pode diferir do UTC.
  // Só conta o que já fecha o mesmo "alvo": os da agenda inteira e, se for pessoal, os do próprio profissional —
  // a ausência de outro profissional não esconde nada por baixo deste bloqueio.
  const margin = 24 * 60 * 60 * 1000
  const candidates = await db.scheduleBlock.findMany({
    where: {
      scheduleId: { in: scheduleIds },
      OR: professionalId ? [{ professionalId: null }, { professionalId }] : [{ professionalId: null }],
      startDate: { lte: new Date(endDate.getTime() + margin) },
      endDate: { gte: new Date(startDate.getTime() - margin) },
    },
    select: {
      id: true,
      groupId: true,
      reason: true,
      startDate: true,
      endDate: true,
      isAllDay: true,
      schedule: { select: { name: true } },
    },
    orderBy: { startDate: 'asc' },
  })

  const incoming: BlockRange = { startDate, endDate, isAllDay }
  const byKey = new Map<string, OverlappingBlock>()
  for (const block of candidates) {
    if (!blocksOverlap(incoming, block, timeZone)) continue
    const key = block.groupId ?? block.id
    const existing = byKey.get(key)
    if (existing) {
      existing.scheduleNames.push(block.schedule.name.trim())
    } else {
      byKey.set(key, {
        key,
        ...describeBlock(block, timeZone),
        reason: block.reason,
        scheduleNames: [block.schedule.name.trim()],
      })
    }
  }
  return Array.from(byKey.values())
}

/**
 * Bloqueio criado para várias agendas ("geral") ou pessoal de um profissional,
 * com o que ele cobre e o que ficou de fora. Um item por `groupId`.
 */
export interface GeneralBlock extends BlockDisplay {
  groupId: string
  isAllDay: boolean
  reason: string | null
  isPast: boolean
  /** Bloqueio pessoal: nome do profissional que ele fecha. Null = fecha a agenda inteira. */
  professional: { id: string; name: string } | null
  /** Quem está vendo pode removê-lo/estendê-lo? (profissional só mexe nos próprios) */
  canManage: boolean
  schedules: { id: string; name: string }[]
  /** Agendas que o bloqueio não cobre (só quando `canManage`): fora do grupo ou criadas depois. */
  missingSchedules: { id: string; name: string }[]
}

/**
 * Bloqueios do tenant agrupados por `groupId`. Aparecem: os de 2+ agendas e todo
 * bloqueio pessoal de profissional (mesmo com 1 agenda só). Grupo comum que
 * ficou com 1 bloco (as outras agendas foram excluídas) volta a ser um bloqueio
 * da agenda — ver `GET /api/schedules/[id]/blocks`.
 *
 * `viewerProfessionalId`: null = administrador (vê e gerencia tudo); id = profissional
 * (vê os da agenda inteira e os próprios, mas só gerencia os próprios).
 */
export async function listGeneralBlocks(
  db: DbClient,
  params: { userId: string; timeZone: string; viewerProfessionalId?: string | null; now?: Date }
): Promise<GeneralBlock[]> {
  const { userId, timeZone, viewerProfessionalId = null, now = new Date() } = params
  const [blocks, schedules] = await Promise.all([
    db.scheduleBlock.findMany({
      where: {
        groupId: { not: null },
        schedule: { userId },
        ...(viewerProfessionalId && { OR: [{ professionalId: null }, { professionalId: viewerProfessionalId }] }),
      },
      select: {
        groupId: true,
        reason: true,
        startDate: true,
        endDate: true,
        isAllDay: true,
        professionalId: true,
        professional: { select: { name: true } },
        schedule: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'asc' },
    }),
    db.schedule.findMany({
      where: { userId },
      select: { id: true, name: true, professionals: { select: { professionalId: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const groups = new Map<string, typeof blocks>()
  for (const block of blocks) {
    const list = groups.get(block.groupId!) ?? []
    list.push(block)
    groups.set(block.groupId!, list)
  }

  const result: GeneralBlock[] = []
  for (const [groupId, members] of Array.from(groups.entries())) {
    const first = members[0]
    if (members.length < 2 && !first.professionalId) continue
    const canManage = viewerProfessionalId === null || first.professionalId === viewerProfessionalId
    const covered = new Set(members.map((m) => m.schedule.id))
    const eligible = first.professionalId
      ? schedules.filter((s) => s.professionals.some((p) => p.professionalId === first.professionalId))
      : schedules
    result.push({
      groupId,
      ...describeBlock(first, timeZone),
      isAllDay: first.isAllDay,
      reason: first.reason,
      isPast: isBlockPast(first, timeZone, now),
      professional: first.professionalId
        ? { id: first.professionalId, name: first.professional?.name?.trim() || 'Profissional' }
        : null,
      canManage,
      schedules: members.map((m) => ({ id: m.schedule.id, name: m.schedule.name.trim() })),
      missingSchedules: canManage
        ? eligible.filter((s) => !covered.has(s.id)).map((s) => ({ id: s.id, name: s.name.trim() }))
        : [],
    })
  }
  return result.sort((a, b) => a.firstDay.localeCompare(b.firstDay) || (a.startTime ?? '').localeCompare(b.startTime ?? ''))
}

/**
 * Estende um bloqueio geral a agendas que ficaram de fora (ex.: criadas depois).
 * Copia período/motivo/profissional de um bloco do grupo. Devolve quantos blocos
 * criou, ou `null` se o grupo não existe no tenant (ou não é do profissional que pede).
 * Bloqueio pessoal só se estende a agendas em que o profissional está vinculado.
 */
export async function addSchedulesToGroup(
  db: DbClient,
  params: { userId: string; groupId: string; scheduleIds: string[]; viewerProfessionalId?: string | null }
): Promise<number | null> {
  const { userId, groupId, scheduleIds, viewerProfessionalId = null } = params
  const template = await db.scheduleBlock.findFirst({
    where: { groupId, schedule: { userId }, ...(viewerProfessionalId && { professionalId: viewerProfessionalId }) },
    select: { startDate: true, endDate: true, reason: true, isAllDay: true, professionalId: true },
  })
  if (!template) return null

  const [owned, already] = await Promise.all([
    db.schedule.findMany({
      where: {
        userId,
        id: { in: scheduleIds },
        ...(template.professionalId && { professionals: { some: { professionalId: template.professionalId } } }),
      },
      select: { id: true },
    }),
    db.scheduleBlock.findMany({ where: { groupId, scheduleId: { in: scheduleIds } }, select: { scheduleId: true } }),
  ])
  const alreadyIds = new Set(already.map((b) => b.scheduleId))
  const targets = owned.map((s) => s.id).filter((id) => !alreadyIds.has(id))
  if (targets.length === 0) return 0

  const result = await db.scheduleBlock.createMany({
    data: targets.map((scheduleId) => ({ scheduleId, groupId, ...template })),
  })
  return result.count
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
    /** Bloqueio pessoal: só os agendamentos deste profissional são afetados. */
    professionalId?: string | null
  }
): Promise<BlockConflict[]> {
  const { userId, scheduleIds, startDate, endDate, timeZone, isAllDay = true, professionalId = null } = params
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
      ...(professionalId && { professionalId }),
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
    /** Bloqueio pessoal de profissional: sempre agrupado, mesmo com 1 agenda, para ser gerenciado num lugar só. */
    professionalId?: string | null
  }
): Promise<{ count: number; groupId: string | null }> {
  const professionalId = params.professionalId ?? null
  const groupId = params.grouped || professionalId ? randomUUID() : null
  const result = await db.scheduleBlock.createMany({
    data: params.scheduleIds.map((scheduleId) => ({
      scheduleId,
      startDate: params.startDate,
      endDate: params.endDate,
      reason: params.reason,
      isAllDay: params.isAllDay,
      groupId,
      professionalId,
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
  /** Quando o autor é um profissional: o bloqueio fecha só ele. Null = agenda inteira. */
  professionalId?: string | null
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { userId, scheduleIds, body, grouped, professionalId = null } = params

  const businessConfig = await prisma.businessConfig.findUnique({ where: { userId }, select: { timezone: true } })
  const timeZone = businessConfig?.timezone || DEFAULT_TIMEZONE

  const parsed = parseBlockInput(body, timeZone)
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } }

  // Bloqueios que já cobrem o período: criar por cima gera sobreposição, e apagar
  // um deles não reabre o dia (o outro continua fechando). Aviso imposto aqui, no servidor.
  const overlaps = await findOverlappingBlocks(prisma, {
    scheduleIds,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    isAllDay: parsed.isAllDay,
    timeZone,
    professionalId,
  })
  if (overlaps.length > 0 && body.confirmOverlaps !== true) {
    return {
      status: 409,
      body: {
        error: `Já existe(m) ${overlaps.length} bloqueio(s) neste período`,
        code: 'BLOCK_OVERLAPS_EXISTING',
        overlapping: overlaps.slice(0, 5),
        overlappingTotal: overlaps.length,
      },
    }
  }

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
    professionalId,
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
    professionalId,
  })

  return {
    status: 201,
    body: { success: true, schedulesCount: count, groupId, conflictingAppointments: conflicts.length },
  }
}

/**
 * Remove todos os blocos de um grupo — sempre escopado ao tenant dono. Com
 * `professionalId` (quem pede é um profissional) só remove os blocos pessoais
 * dele: bloqueio da agenda inteira ou de outro profissional nunca é tocado.
 */
export async function deleteBlockGroup(
  db: DbClient,
  params: { userId: string; groupId: string; professionalId?: string | null }
): Promise<number> {
  const result = await db.scheduleBlock.deleteMany({
    where: {
      groupId: params.groupId,
      schedule: { userId: params.userId },
      ...(params.professionalId && { professionalId: params.professionalId }),
    },
  })
  return result.count
}
