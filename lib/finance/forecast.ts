import { addCalendarDays, calendarDateInZone, tenantCalendarDayWindow, todayInZone } from '@/lib/timezone'
import { loadTimezone, type Tx } from './context'
import { toCents } from './money'

/**
 * Previsão de recebimento: o que deve entrar nos próximos dias, a partir dos
 * agendamentos que ainda não viraram comanda e dos recebíveis já em aberto.
 *
 * Um agendamento só gera Receivable quando é CONCLUÍDO. Quem já tem comanda
 * entra pelo recebível (nunca pelos dois); por isso a busca exclui agendamentos
 * com `Sale`.
 */

/** Amostra mínima de atendimentos fechados para a taxa de comparecimento valer. */
export const MIN_ATTENDANCE_SAMPLE = 20
const ATTENDANCE_WINDOW_DAYS = 90

export type ForecastAppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS'

export interface ForecastAppointment {
  id: string
  /** Dia de calendário do negócio ("YYYY-MM-DD"). */
  day: string
  status: ForecastAppointmentStatus
  /** null = sem preço definido em lugar nenhum. */
  priceCents: number | null
  /** Sessão de pacote já foi paga na venda do pacote: não gera caixa. */
  isPackageSession: boolean
  professionalId: string | null
  professionalName: string | null
}

export interface ForecastReceivable {
  day: string
  openCents: number
}

export interface ForecastDay {
  date: string
  confirmedCents: number
  unconfirmedCents: number
  receivablesCents: number
  appointments: number
}

export interface Forecast {
  days: ForecastDay[]
  totals: {
    confirmedCents: number
    unconfirmedCents: number
    receivablesCents: number
    /** Confirmado + a confirmar, sem ajuste de comparecimento. */
    scheduledCents: number
    /** Confirmado + a confirmar × taxa de comparecimento (só da agenda). */
    expectedAppointmentsCents: number
    /** Esperado da agenda + recebíveis em aberto. */
    expectedTotalCents: number
  }
  appointmentCount: number
  noPriceCount: number
  packageSessions: number
  /** Taxa histórica de comparecimento (0 a 1); null quando a amostra é pequena demais. */
  showRate: number | null
  showRateSample: number
  byProfessional: { id: string | null; name: string; cents: number; count: number }[]
}

/**
 * Preço de um agendamento: o do próprio agendamento > o da agenda > o do
 * serviço. Mesma ordem de `defaultItemForAppointment` (comanda), para a
 * previsão bater com o que a comanda vai cobrar. null se nenhum existir.
 */
export function resolveAppointmentPriceCents(prices: {
  appointment: number | null | undefined
  schedule: number | null | undefined
  service: number | null | undefined
}): number | null {
  return toCents(prices.appointment) ?? toCents(prices.schedule) ?? toCents(prices.service) ?? null
}

/** Taxa de comparecimento histórica: concluídos / (concluídos + faltas). */
export function computeShowRate(completed: number, noShow: number): { rate: number | null; sample: number } {
  const sample = completed + noShow
  if (sample < MIN_ATTENDANCE_SAMPLE) return { rate: null, sample }
  return { rate: completed / sample, sample }
}

export function buildForecast(input: {
  /** Dias da janela, em ordem ("YYYY-MM-DD"). */
  days: string[]
  appointments: ForecastAppointment[]
  receivables: ForecastReceivable[]
  attendance: { completed: number; noShow: number }
}): Forecast {
  const buckets = new Map<string, ForecastDay>(
    input.days.map((date) => [date, { date, confirmedCents: 0, unconfirmedCents: 0, receivablesCents: 0, appointments: 0 }])
  )
  const professionals = new Map<string, { id: string | null; name: string; cents: number; count: number }>()
  let noPriceCount = 0
  let packageSessions = 0
  let appointmentCount = 0

  for (const a of input.appointments) {
    const bucket = buckets.get(a.day)
    if (!bucket) continue // fora da janela: defesa contra fuso/borda
    appointmentCount += 1
    bucket.appointments += 1

    let cents = 0
    if (a.isPackageSession) packageSessions += 1
    else if (a.priceCents == null) noPriceCount += 1
    else cents = a.priceCents

    // Em atendimento (IN_PROGRESS) o cliente já está lá: conta como confirmado.
    if (a.status === 'SCHEDULED') bucket.unconfirmedCents += cents
    else bucket.confirmedCents += cents

    const key = a.professionalId ?? 'none'
    const line = professionals.get(key) ?? { id: a.professionalId, name: a.professionalName ?? 'Sem profissional', cents: 0, count: 0 }
    line.cents += cents
    line.count += 1
    professionals.set(key, line)
  }

  for (const r of input.receivables) {
    const bucket = buckets.get(r.day)
    if (bucket) bucket.receivablesCents += r.openCents
  }

  const days = [...buckets.values()]
  const sum = (pick: (d: ForecastDay) => number) => days.reduce((acc, d) => acc + pick(d), 0)
  const confirmedCents = sum((d) => d.confirmedCents)
  const unconfirmedCents = sum((d) => d.unconfirmedCents)
  const receivablesCents = sum((d) => d.receivablesCents)
  const { rate, sample } = computeShowRate(input.attendance.completed, input.attendance.noShow)
  const expectedAppointmentsCents = confirmedCents + Math.round(unconfirmedCents * (rate ?? 1))

  return {
    days,
    totals: {
      confirmedCents,
      unconfirmedCents,
      receivablesCents,
      scheduledCents: confirmedCents + unconfirmedCents,
      expectedAppointmentsCents,
      expectedTotalCents: expectedAppointmentsCents + receivablesCents
    },
    appointmentCount,
    noPriceCount,
    packageSessions,
    showRate: rate,
    showRateSample: sample,
    byProfessional: [...professionals.values()].sort((a, b) => b.cents - a.cents)
  }
}

/* ----------------------------------- Leitura ----------------------------------- */

const OPEN_APPOINTMENT_STATUSES = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] as const

export interface ForecastAppointmentDetail extends ForecastAppointment {
  date: Date
  clientName: string
  serviceName: string | null
}

/**
 * Agendamentos em aberto na janela, sem comanda, com o preço já resolvido. A
 * busca de preço da agenda é feita em lote (uma consulta), não por agendamento.
 */
export async function loadForecastAppointments(
  tx: Tx,
  tenantId: string,
  window: { start: Date; end: Date },
  timezone: string
): Promise<ForecastAppointmentDetail[]> {
  const rows = await tx.appointment.findMany({
    where: {
      userId: tenantId,
      deletedAt: null,
      status: { in: [...OPEN_APPOINTMENT_STATUSES] },
      date: { gte: window.start, lte: window.end },
      sale: { is: null }
    },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      date: true,
      status: true,
      price: true,
      serviceId: true,
      scheduleId: true,
      clientPackageItemId: true,
      professionalId: true,
      professionalUser: { select: { name: true } },
      client: { select: { name: true } },
      service: { select: { name: true, price: true } },
      specialty: true
    }
  })

  const needsSchedulePrice = rows.filter((r) => r.price == null && r.serviceId && r.scheduleId)
  const schedulePrices = new Map<string, number | null>()
  if (needsSchedulePrice.length > 0) {
    const found = await tx.scheduleService.findMany({
      where: {
        scheduleId: { in: [...new Set(needsSchedulePrice.map((r) => r.scheduleId as string))] },
        serviceId: { in: [...new Set(needsSchedulePrice.map((r) => r.serviceId as string))] }
      },
      select: { scheduleId: true, serviceId: true, customPrice: true }
    })
    for (const f of found) schedulePrices.set(`${f.scheduleId}:${f.serviceId}`, f.customPrice)
  }

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    day: calendarDateInZone(r.date, timezone),
    status: r.status as ForecastAppointmentStatus,
    priceCents: resolveAppointmentPriceCents({
      appointment: r.price,
      schedule: r.serviceId && r.scheduleId ? schedulePrices.get(`${r.scheduleId}:${r.serviceId}`) : null,
      service: r.service?.price
    }),
    isPackageSession: Boolean(r.clientPackageItemId),
    professionalId: r.professionalId,
    professionalName: r.professionalUser?.name ?? null,
    clientName: r.client.name,
    serviceName: r.service?.name ?? r.specialty ?? null
  }))
}

/** Janela em instantes UTC a partir de "hoje" do negócio e do número de dias. */
export function forecastWindow(timezone: string, days: number, now: Date = new Date()) {
  const today = todayInZone(timezone, now)
  const dayList = Array.from({ length: days }, (_, i) => addCalendarDays(today, i))
  const { start } = tenantCalendarDayWindow(timezone, dayList[0])
  const { end } = tenantCalendarDayWindow(timezone, dayList[days - 1])
  return { today, dayList, start, end }
}

export async function loadForecast(tx: Tx, tenantId: string, days: number, now: Date = new Date()): Promise<Forecast> {
  const timezone = await loadTimezone(tx, tenantId)
  const { today, dayList, start, end } = forecastWindow(timezone, days, now)

  const historyStart = new Date(now.getTime() - ATTENDANCE_WINDOW_DAYS * 86_400_000)
  const [appointments, receivables, attendance] = await Promise.all([
    loadForecastAppointments(tx, tenantId, { start, end }, timezone),
    tx.receivable.findMany({
      where: { userId: tenantId, status: { in: ['OPEN', 'PARTIAL'] }, dueDate: { lte: end } },
      select: { amountCents: true, paidCents: true, dueDate: true }
    }),
    tx.appointment.groupBy({
      by: ['status'],
      where: { userId: tenantId, deletedAt: null, status: { in: ['COMPLETED', 'NO_SHOW'] }, date: { gte: historyStart, lt: now } },
      _count: { _all: true }
    })
  ])

  return buildForecast({
    days: dayList,
    appointments,
    // Vencido entra no dia de hoje (é o que há para receber agora), como no fluxo de caixa.
    receivables: receivables.map((r) => ({
      day: r.dueDate < start ? today : calendarDateInZone(r.dueDate, timezone),
      openCents: r.amountCents - r.paidCents
    })),
    attendance: {
      completed: attendance.find((g) => g.status === 'COMPLETED')?._count._all ?? 0,
      noShow: attendance.find((g) => g.status === 'NO_SHOW')?._count._all ?? 0
    }
  })
}
