import { prisma } from '@/lib/db'
import {
  DEFAULT_TIMEZONE,
  addCalendarDays,
  dayOfWeekFromDateStr,
  tenantCalendarDayWindow,
  todayInZone,
  wallTimeToInstant,
} from '@/lib/timezone'
import {
  isDateBlocked,
  isIntervalBlocked,
  professionalOwnBlocks,
  scheduleWideBlocks,
  type BlockRange,
} from '@/lib/schedule-blocks'
import type { Prisma } from '@prisma/client'

// Um agendamento pode começar antes do dia pedido e invadi-lo. A janela de
// ocupação recua além da meia-noite do negócio pra não perder essa sobreposição
// — o guard de escrita já fazia o mesmo (MAX_APPOINTMENT_LOOKBACK_MINUTES).
const OCCUPANCY_LOOKBACK_MS = 24 * 60 * 60 * 1000

export interface AvailabilitySlot {
  time: string
  available: boolean
}

/**
 * Testa sobreposição de dois intervalos [start, start+duration). Único ponto
 * de verdade pra essa conta — reutilizado pelo motor de slots e pelo guard de
 * conflito em `appointment-service.ts`, que antes reimplementava a mesma
 * lógica com uma formulação de 3 termos equivalente a esta.
 */
export function overlaps(aStart: Date, aDuration: number, bStart: Date, bDuration: number): boolean {
  const aEnd = new Date(aStart.getTime() + aDuration * 60000)
  const bEnd = new Date(bStart.getTime() + bDuration * 60000)
  return aStart < bEnd && aEnd > bStart
}

export type NoSlotsCode =
  | 'PAST'
  | 'BEYOND_ADVANCE_WINDOW'
  | 'NOT_WORKING_DAY'
  | 'DAY_BLOCKED'
  | 'DAY_INACTIVE'
  | 'PROFESSIONAL_BLOCKED'
  | 'SERVICE_DOES_NOT_FIT'
  | 'FULLY_BOOKED'

/**
 * Por que um dia não tem horário — para a tela explicar em vez de só dizer "indisponível".
 * `message` é para o dono (painel) e pode citar o motivo do bloqueio; `publicMessage` é para o
 * cliente final (página pública e chat): nunca expõe motivo interno (ex.: "Viagem", "Curso").
 */
export interface NoSlotsReason {
  code: NoSlotsCode
  message: string
  publicMessage: string
  /** Só em BEYOND_ADVANCE_WINDOW: último dia reservável ("YYYY-MM-DD"). */
  lastBookableDate?: string
}

const WEEKDAY_PHRASE = ['aos domingos', 'às segundas-feiras', 'às terças-feiras', 'às quartas-feiras', 'às quintas-feiras', 'às sextas-feiras', 'aos sábados']

/** "HH:mm" → minutos desde 00:00. */
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

const brDate = (dateStr: string) => `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}/${dateStr.slice(0, 4)}`

interface DayRulesSchedule {
  advanceBookingDays: number
  workingDays: number[]
  useCustomDayConfig: boolean
  dayConfigs: { dayOfWeek: number; isActive: boolean }[]
  blocks: (BlockRange & { reason?: string | null })[]
  professionals: { professionalId: string }[]
}

/**
 * Regras que fecham o DIA INTEIRO, na ordem em que o motor as aplica. Único lugar
 * dessa decisão: `getAvailableSlots` devolve `[]` quando há motivo, e
 * `getNoSlotsReason` mostra o motivo à tela — nunca divergem.
 */
function dayClosedReason(
  schedule: DayRulesSchedule,
  dateStr: string,
  timeZone: string,
  opts: { now: Date; ignoreAdvanceWindow?: boolean; professionalId?: string }
): NoSlotsReason | null {
  // Comparações de calendário como string "YYYY-MM-DD": ordem lexicográfica é
  // igual à cronológica nesse formato, e não depende de fuso nenhum.
  const today = todayInZone(timeZone, opts.now)
  if (dateStr < today) return { code: 'PAST', message: 'Esta data já passou', publicMessage: 'Esta data já passou' }

  if (!opts.ignoreAdvanceWindow) {
    const lastDay = addCalendarDays(today, schedule.advanceBookingDays)
    if (dateStr > lastDay) {
      return {
        code: 'BEYOND_ADVANCE_WINDOW',
        message: `Esta agenda só recebe agendamentos até ${brDate(lastDay)} (antecedência máxima de ${schedule.advanceBookingDays} dias)`,
        publicMessage: `Ainda não abrimos agenda para esta data. Agendamentos abertos até ${brDate(lastDay)}`,
        lastBookableDate: lastDay,
      }
    }
  }

  const dayOfWeek = dayOfWeekFromDateStr(dateStr)
  if (!schedule.workingDays.includes(dayOfWeek)) {
    return {
      code: 'NOT_WORKING_DAY',
      message: `Esta agenda não atende ${WEEKDAY_PHRASE[dayOfWeek]}`,
      publicMessage: `Não atendemos ${WEEKDAY_PHRASE[dayOfWeek]}`,
    }
  }

  // Bloqueios de dia inteiro são comparados pela data de calendário UTC dos
  // instantes gravados — mesma semântica que a produção (processo em UTC) já
  // aplicava, agora sem depender do fuso do processo. Só o bloqueio da agenda
  // inteira fecha o dia aqui; o pessoal de um profissional é tratado abaixo.
  const wide = scheduleWideBlocks(schedule.blocks)
  if (isDateBlocked(dateStr, wide)) {
    const reason = wide.find((b) => isDateBlocked(dateStr, [b]))?.reason?.trim()
    return {
      code: 'DAY_BLOCKED',
      message: reason ? `Dia bloqueado na agenda (${reason})` : 'Dia bloqueado na agenda',
      publicMessage: 'Não haverá atendimento nesta data',
    }
  }

  if (schedule.useCustomDayConfig && !schedule.dayConfigs.some((c) => c.dayOfWeek === dayOfWeek && c.isActive)) {
    return {
      code: 'DAY_INACTIVE',
      message: 'Este dia está desativado na configuração de horários da agenda',
      publicMessage: 'Não atendemos neste dia',
    }
  }

  // Dia inteiro bloqueado para TODOS os profissionais em questão = dia fechado.
  const relevant = opts.professionalId ? [opts.professionalId] : schedule.professionals.map((p) => p.professionalId)
  if (relevant.length > 0 && relevant.every((id) => isDateBlocked(dateStr, professionalOwnBlocks(schedule.blocks, id)))) {
    return {
      code: 'PROFESSIONAL_BLOCKED',
      message: opts.professionalId ? 'O profissional está bloqueado neste dia' : 'Os profissionais desta agenda estão bloqueados neste dia',
      publicMessage: opts.professionalId ? 'Este profissional não atende nesta data' : 'Não haverá atendimento nesta data',
    }
  }

  return null
}

/**
 * Explica por que `getAvailableSlots` não ofereceu nenhum horário livre naquele dia
 * (`null` se há ao menos um livre). Só LÊ.
 */
export async function getNoSlotsReason(params: {
  scheduleId: string
  userId: string
  date: string
  professionalId?: string
  ignoreAdvanceWindow?: boolean
  /** Resultado de `getAvailableSlots` para os mesmos parâmetros. */
  slots: AvailabilitySlot[]
}): Promise<NoSlotsReason | null> {
  const { scheduleId, userId, date, professionalId, ignoreAdvanceWindow, slots } = params
  if (slots.some((s) => s.available)) return null

  // Há horários na grade, mas nenhum livre: ocupação, antecedência mínima ou bloqueio de faixa.
  if (slots.length > 0) {
    return {
      code: 'FULLY_BOOKED',
      message: 'Todos os horários deste dia estão ocupados, bloqueados ou já fora da antecedência mínima',
      publicMessage: 'Todos os horários desta data já foram preenchidos',
    }
  }

  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, userId },
    select: {
      advanceBookingDays: true,
      workingDays: true,
      useCustomDayConfig: true,
      dayConfigs: { select: { dayOfWeek: true, isActive: true } },
      blocks: { select: { startDate: true, endDate: true, isAllDay: true, professionalId: true, reason: true } },
      professionals: { select: { professionalId: true } },
      user: { select: { businessConfig: { select: { timezone: true } } } },
    },
  })
  if (!schedule) return null

  const timeZone = schedule.user.businessConfig?.timezone || DEFAULT_TIMEZONE
  return (
    dayClosedReason(schedule, date, timeZone, { now: new Date(), ignoreAdvanceWindow, professionalId }) ?? {
      code: 'SERVICE_DOES_NOT_FIT',
      message: 'A duração deste serviço não cabe no horário de atendimento deste dia',
      publicMessage: 'Não há horários disponíveis para esta data',
    }
  )
}

/** Do mais ao menos útil para o cliente quando várias agendas do serviço estão sem horário. */
const REASON_PRIORITY: NoSlotsCode[] = [
  'FULLY_BOOKED',
  'BEYOND_ADVANCE_WINDOW',
  'PROFESSIONAL_BLOCKED',
  'DAY_BLOCKED',
  'NOT_WORKING_DAY',
  'DAY_INACTIVE',
  'SERVICE_DOES_NOT_FIT',
  'PAST',
]

/**
 * Motivo de um serviço não ter horário livre no dia, olhando todas as agendas que o
 * oferecem (como `getAvailableSlotsForService`). Com várias, devolve o motivo mais útil:
 * "tudo preenchido" antes de "fora da janela", e a janela mais distante entre as agendas.
 * `null` se há horário livre ou o serviço não está em nenhuma agenda ativa. Só LÊ.
 */
export async function getNoSlotsReasonForService(params: {
  userId: string
  serviceId: string
  date: string
  professionalId?: string
  /** Resultado de `getAvailableSlotsForService` para os mesmos parâmetros. */
  slots: AvailabilitySlot[]
}): Promise<NoSlotsReason | null> {
  const { userId, serviceId, date, professionalId, slots } = params
  if (slots.some((s) => s.available)) return null

  const candidates = await resolveCandidateSchedules({ userId, serviceId, professionalId })
  if (candidates.length === 0) return null

  const reasons: NoSlotsReason[] = []
  for (const candidate of candidates) {
    const own = await getAvailableSlots({ scheduleId: candidate.id, serviceId, date, userId, professionalId })
    if (own === null) continue
    const reason = await getNoSlotsReason({ scheduleId: candidate.id, userId, date, professionalId, slots: own })
    if (reason) reasons.push(reason)
  }

  for (const code of REASON_PRIORITY) {
    const ofCode = reasons.filter((r) => r.code === code)
    if (ofCode.length === 0) continue
    // Janela mais distante: é a que ainda deixa o cliente reservar mais adiante.
    return code === 'BEYOND_ADVANCE_WINDOW'
      ? ofCode.reduce((best, r) => ((r.lastBookableDate ?? '') > (best.lastBookableDate ?? '') ? r : best))
      : ofCode[0]
  }
  return null
}

/**
 * Calcula os horários disponíveis de uma agenda/serviço num dia específico,
 * considerando dias de trabalho, bloqueios, horário de almoço, antecedência
 * mínima/máxima e agendamentos já existentes. Único motor de disponibilidade do
 * sistema — compartilhado pela página pública de agendamento, pelas ferramentas
 * do agente de IA (widget de chat) e pela tela de agendamento do dashboard —
 * mesma regra em todos, incluindo a capacidade por profissional (ver `professionalId`).
 *
 * Todo o cálculo acontece no fuso do negócio (`BusinessConfig.timezone`), nunca
 * no fuso do processo: em produção as Functions do Netlify rodam em UTC, e
 * montar o horário de parede do slot com métodos locais comparava 15:00Z contra
 * o instante realmente gravado (18:00Z, montado em GMT-3) — defasando a grade
 * inteira em 3h, exibindo como livre um horário ocupado e bloqueando outro.
 */
export async function getAvailableSlots(params: {
  scheduleId: string
  serviceId: string
  date: string
  userId: string
  professionalId?: string
  /**
   * Ignora a antecedência máxima (`advanceBookingDays`). Só para a tela interna do
   * painel: a janela existe para limitar o cliente final (página pública e chat) e
   * a criação pelo painel nunca a aplicou — só a grade, por compartilhar este motor.
   */
  ignoreAdvanceWindow?: boolean
}): Promise<AvailabilitySlot[] | null> {
  const { scheduleId, serviceId, date: dateStr, userId, professionalId, ignoreAdvanceWindow } = params

  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, userId },
    include: {
      dayConfigs: true,
      blocks: true,
      services: { where: { serviceId }, include: { service: true } },
      professionals: { select: { professionalId: true } },
      user: { select: { businessConfig: { select: { timezone: true } } } },
    },
  })

  if (!schedule) return null

  const service = schedule.services[0]?.service
  if (!service) return null

  const timeZone = schedule.user.businessConfig?.timezone || DEFAULT_TIMEZONE

  const dayOfWeek = dayOfWeekFromDateStr(dateStr)

  const now = new Date()
  // Dia inteiro fechado (passado, fora da janela, dia sem atendimento, bloqueio...): sem slots.
  if (dayClosedReason(schedule, dateStr, timeZone, { now, ignoreAdvanceWindow, professionalId })) return []

  // O pessoal de um profissional só tira ELE da grade (mais abaixo): os colegas vinculados
  // continuam atendendo. O da agenda inteira já fechou o dia acima.
  const wideBlocks = scheduleWideBlocks(schedule.blocks)

  let workingHours: { startTime: string; endTime: string }[]

  if (schedule.useCustomDayConfig) {
    const dayConfig = schedule.dayConfigs.find((config) => config.dayOfWeek === dayOfWeek && config.isActive)
    if (!dayConfig) return []
    workingHours = (dayConfig.timeSlots as any[]) || []
  } else {
    workingHours = [{ startTime: schedule.startTime, endTime: schedule.endTime }]
  }

  const slots: AvailabilitySlot[] = []
  const serviceDuration = service.duration || schedule.slotDuration

  for (const workHour of workingHours) {
    const [startHour, startMinute] = workHour.startTime.split(':').map(Number)
    const [endHour, endMinute] = workHour.endTime.split(':').map(Number)

    let currentMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute

    while (currentMinutes + serviceDuration <= endMinutes) {
      const isLunchTime = Boolean(
        schedule.lunchStart &&
          schedule.lunchEnd &&
          (() => {
            const [lunchStartH, lunchStartM] = schedule.lunchStart!.split(':').map(Number)
            const [lunchEndH, lunchEndM] = schedule.lunchEnd!.split(':').map(Number)
            const lunchStartMinutes = lunchStartH * 60 + lunchStartM
            const lunchEndMinutes = lunchEndH * 60 + lunchEndM
            return currentMinutes >= lunchStartMinutes && currentMinutes < lunchEndMinutes
          })()
      )

      if (!isLunchTime) {
        const hours = Math.floor(currentMinutes / 60)
        const minutes = currentMinutes % 60
        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        slots.push({ time: timeStr, available: true })
      }

      currentMinutes += serviceDuration + (schedule.bufferTime || 0)
    }
  }

  const { start: dayStart, end: dateEnd } = tenantCalendarDayWindow(timeZone, dateStr)
  const dateStart = new Date(dayStart.getTime() - OCCUPANCY_LOOKBACK_MS)

  // Ocupação é por profissional, não por agenda: o mesmo User pode estar
  // vinculado a várias agendas (ScheduleProfessional), e um agendamento dele
  // criado numa agenda ocupa o profissional em qualquer outra também — antes,
  // filtrar só por `scheduleId` deixava esse conflito invisível de uma agenda
  // pra outra. Só cai de volta pro escopo da agenda inteira quando ela não tem
  // nenhum profissional vinculado (agenda legada, sem ScheduleProfessional).
  const relevantProfessionalIds = professionalId
    ? [professionalId]
    : schedule.professionals.map((p) => p.professionalId)

  const existingAppointments =
    relevantProfessionalIds.length > 0
      ? await prisma.appointment.findMany({
          where: {
            professionalId: { in: relevantProfessionalIds },
            date: { gte: dateStart, lte: dateEnd },
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            deletedAt: null,
          },
        })
      : await prisma.appointment.findMany({
          where: {
            scheduleId,
            date: { gte: dateStart, lte: dateEnd },
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            deletedAt: null,
          },
        })

  // A grade acima parte do início do expediente e avança em passos da duração do serviço.
  // Sozinha, ela desperdiça o tempo logo depois de um compromisso que não cai nela: com
  // expediente 15:00–19:00, serviço de 120 min e um agendamento até 15:30, só ofereceria
  // 15:00 (ocupado) e 17:00 — o 15:30, livre, nunca apareceria. Por isso, também é
  // oferecido o início encaixado: o instante em que um agendamento, uma faixa bloqueada
  // ou o almoço termina (mais o intervalo entre atendimentos). Passa pelas mesmas
  // checagens de disponibilidade abaixo, então só aparece se realmente couber.
  const bufferMinutes = schedule.bufferTime || 0
  const minutesOfDay = (instant: Date) => Math.round((instant.getTime() - dayStart.getTime()) / 60000)
  const packedStarts = new Set<number>()
  for (const apt of existingAppointments) {
    packedStarts.add(minutesOfDay(new Date(apt.date.getTime() + (apt.duration + bufferMinutes) * 60000)))
  }
  for (const block of schedule.blocks) {
    if (block.isAllDay === false) packedStarts.add(minutesOfDay(new Date(block.endDate)))
  }
  const lunchStartMin = schedule.lunchStart ? toMinutes(schedule.lunchStart) : null
  const lunchEndMin = schedule.lunchEnd ? toMinutes(schedule.lunchEnd) : null
  if (lunchEndMin !== null) packedStarts.add(lunchEndMin)

  const existingTimes = new Set(slots.map((s) => s.time))
  for (const start of Array.from(packedStarts)) {
    const fitsWorkingHours = workingHours.some(
      (w) => start >= toMinutes(w.startTime) && start + serviceDuration <= toMinutes(w.endTime)
    )
    const inLunch = lunchStartMin !== null && lunchEndMin !== null && start >= lunchStartMin && start < lunchEndMin
    if (!fitsWorkingHours || inLunch) continue

    const timeStr = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`
    if (existingTimes.has(timeStr)) continue
    existingTimes.add(timeStr)
    slots.push({ time: timeStr, available: true })
  }
  slots.sort((a, b) => a.time.localeCompare(b.time))

  const appointmentsByProfessional = new Map<string, typeof existingAppointments>()
  for (const apt of existingAppointments) {
    if (!apt.professionalId) continue
    const list = appointmentsByProfessional.get(apt.professionalId) ?? []
    list.push(apt)
    appointmentsByProfessional.set(apt.professionalId, list)
  }

  const minBookingTime = new Date(now.getTime() + schedule.minNoticeHours * 60 * 60 * 1000)

  for (const slot of slots) {
    const slotDate = wallTimeToInstant(dateStr, slot.time, timeZone)

    if (slotDate < minBookingTime) {
      slot.available = false
      continue
    }

    // Bloqueio de faixa de horário (o de dia inteiro já devolveu `[]` acima).
    if (isIntervalBlocked({ dateStr, start: slotDate, durationMinutes: serviceDuration, blocks: wideBlocks })) {
      slot.available = false
      continue
    }

    if (relevantProfessionalIds.length > 0) {
      // Disponível se pelo menos um profissional do conjunto (o pedido, ou
      // todos os vinculados quando "qualquer um") estiver livre nesse slot:
      // sem bloqueio pessoal cobrindo o horário e sem agendamento sobreposto.
      const someoneFree = relevantProfessionalIds.some((id) => {
        if (
          isIntervalBlocked({
            dateStr,
            start: slotDate,
            durationMinutes: serviceDuration,
            blocks: professionalOwnBlocks(schedule.blocks, id),
          })
        ) {
          return false
        }
        const theirAppointments = appointmentsByProfessional.get(id) ?? []
        return !theirAppointments.some((apt) => overlaps(slotDate, serviceDuration, apt.date, apt.duration))
      })
      if (!someoneFree) slot.available = false
    } else {
      // Agenda legada sem profissional vinculado: capacidade 1 pra agenda inteira.
      const occupied = existingAppointments.some((apt) => overlaps(slotDate, serviceDuration, apt.date, apt.duration))
      if (occupied) slot.available = false
    }
  }

  return slots
}

/**
 * Agendas ativas do tenant que oferecem um serviço (e, se `professionalId` for
 * dado, que também têm esse profissional vinculado). Um mesmo serviço pode
 * estar em várias agendas — a página pública e o chat de IA não pedem mais
 * `scheduleId` ao cliente, então essa é a resolução server-side que substitui
 * a escolha manual de agenda.
 */
export async function resolveCandidateSchedules(params: {
  userId: string
  serviceId: string
  professionalId?: string
  /** Client transacional, quando chamado de dentro de withBookingLock. */
  tx?: typeof prisma | Prisma.TransactionClient
}): Promise<{ id: string }[]> {
  const { userId, serviceId, professionalId, tx } = params
  const db = tx ?? prisma

  return db.schedule.findMany({
    where: {
      userId,
      isActive: true,
      services: { some: { serviceId } },
      ...(professionalId && { professionals: { some: { professionalId } } }),
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Último dia ("YYYY-MM-DD", calendário do negócio) em que o cliente ainda pode
 * reservar este serviço: a maior `advanceBookingDays` entre as agendas
 * candidatas. Permite à página pública explicar por que uma data distante não
 * tem horários, em vez de mostrar só "indisponível". `null` se não há agenda.
 */
export async function getMaxBookableDate(params: {
  userId: string
  serviceId: string
  professionalId?: string
}): Promise<string | null> {
  const { userId, serviceId, professionalId } = params

  const schedules = await prisma.schedule.findMany({
    where: {
      userId,
      isActive: true,
      services: { some: { serviceId } },
      ...(professionalId && { professionals: { some: { professionalId } } }),
    },
    select: {
      advanceBookingDays: true,
      user: { select: { businessConfig: { select: { timezone: true } } } },
    },
  })
  if (schedules.length === 0) return null

  const timeZone = schedules[0].user.businessConfig?.timezone || DEFAULT_TIMEZONE
  const maxDays = Math.max(...schedules.map((s) => s.advanceBookingDays))
  return addCalendarDays(todayInZone(timeZone), maxDays)
}

/**
 * Disponibilidade de um serviço sem precisar de scheduleId: resolve as agendas
 * candidatas e une os horários de todas — um horário aparece disponível se
 * estiver livre em pelo menos uma delas. Retorna `null` quando o serviço não
 * está em nenhuma agenda (ativa) do tenant, ou nenhuma tem esse profissional.
 */
export async function getAvailableSlotsForService(params: {
  userId: string
  serviceId: string
  date: string
  professionalId?: string
}): Promise<AvailabilitySlot[] | null> {
  const { userId, serviceId, date, professionalId } = params

  const candidates = await resolveCandidateSchedules({ userId, serviceId, professionalId })
  if (candidates.length === 0) return null

  const slotsPerSchedule = await Promise.all(
    candidates.map((schedule) =>
      getAvailableSlots({ scheduleId: schedule.id, serviceId, date, userId, professionalId })
    )
  )

  const merged = new Map<string, boolean>()
  for (const slots of slotsPerSchedule) {
    if (!slots) continue
    for (const slot of slots) {
      merged.set(slot.time, (merged.get(slot.time) ?? false) || slot.available)
    }
  }

  return Array.from(merged.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, available]) => ({ time, available }))
}
