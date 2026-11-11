import { describe, expect, it } from 'vitest'
import {
  buildForecast,
  computeShowRate,
  forecastWindow,
  MIN_ATTENDANCE_SAMPLE,
  resolveAppointmentPriceCents,
  type ForecastAppointment
} from './forecast'

const days = ['2026-11-10', '2026-11-11', '2026-11-12']
const none = { completed: 0, noShow: 0 }

const appt = (over: Partial<ForecastAppointment> = {}): ForecastAppointment => ({
  id: 'a' + Math.random(),
  day: '2026-11-10',
  status: 'CONFIRMED',
  priceCents: 10_000,
  isPackageSession: false,
  professionalId: 'p1',
  professionalName: 'Ana',
  ...over
})

describe('resolveAppointmentPriceCents', () => {
  it('agendamento vence agenda, que vence serviço', () => {
    expect(resolveAppointmentPriceCents({ appointment: 80, schedule: 90, service: 100 })).toBe(8_000)
    expect(resolveAppointmentPriceCents({ appointment: null, schedule: 90, service: 100 })).toBe(9_000)
    expect(resolveAppointmentPriceCents({ appointment: null, schedule: null, service: 100 })).toBe(10_000)
  })

  it('sem preço em lugar nenhum devolve null (não 0)', () => {
    expect(resolveAppointmentPriceCents({ appointment: null, schedule: undefined, service: null })).toBeNull()
  })

  it('preço 0 explícito é respeitado (cortesia), não cai no serviço', () => {
    expect(resolveAppointmentPriceCents({ appointment: 0, schedule: null, service: 100 })).toBe(0)
  })

  it('converte Float sem ruído binário', () => {
    expect(resolveAppointmentPriceCents({ appointment: 19.99, schedule: null, service: null })).toBe(1_999)
  })
})

describe('computeShowRate', () => {
  it('amostra pequena não vira taxa (evita prever com 3 atendimentos)', () => {
    expect(computeShowRate(5, 1)).toEqual({ rate: null, sample: 6 })
  })

  it('com amostra suficiente: concluídos / (concluídos + faltas)', () => {
    expect(computeShowRate(MIN_ATTENDANCE_SAMPLE, 5).rate).toBeCloseTo(20 / 25)
  })
})

describe('buildForecast', () => {
  it('separa confirmado de a confirmar e soma por dia', () => {
    const f = buildForecast({
      days,
      appointments: [
        appt({ status: 'CONFIRMED', priceCents: 10_000 }),
        appt({ status: 'SCHEDULED', priceCents: 5_000 }),
        appt({ day: '2026-11-11', status: 'SCHEDULED', priceCents: 2_000 })
      ],
      receivables: [],
      attendance: none
    })
    expect(f.days[0]).toMatchObject({ confirmedCents: 10_000, unconfirmedCents: 5_000, appointments: 2 })
    expect(f.days[1]).toMatchObject({ unconfirmedCents: 2_000, appointments: 1 })
    expect(f.totals).toMatchObject({ confirmedCents: 10_000, unconfirmedCents: 7_000, scheduledCents: 17_000 })
  })

  it('em atendimento conta como confirmado', () => {
    const f = buildForecast({ days, appointments: [appt({ status: 'IN_PROGRESS', priceCents: 3_000 })], receivables: [], attendance: none })
    expect(f.totals.confirmedCents).toBe(3_000)
  })

  it('sessão de pacote não gera caixa e é contada à parte', () => {
    const f = buildForecast({ days, appointments: [appt({ isPackageSession: true, priceCents: 9_999 })], receivables: [], attendance: none })
    expect(f.totals.scheduledCents).toBe(0)
    expect(f.packageSessions).toBe(1)
    expect(f.noPriceCount).toBe(0)
  })

  it('agendamento sem preço vale 0 e é sinalizado', () => {
    const f = buildForecast({ days, appointments: [appt({ priceCents: null }), appt({ priceCents: 4_000 })], receivables: [], attendance: none })
    expect(f.noPriceCount).toBe(1)
    expect(f.totals.scheduledCents).toBe(4_000)
    expect(f.appointmentCount).toBe(2)
  })

  it('ignora agendamento fora da janela (borda de fuso)', () => {
    const f = buildForecast({ days, appointments: [appt({ day: '2026-11-13' })], receivables: [], attendance: none })
    expect(f.appointmentCount).toBe(0)
    expect(f.totals.scheduledCents).toBe(0)
  })

  it('recebíveis em aberto entram na série própria e no esperado total', () => {
    const f = buildForecast({
      days,
      appointments: [appt({ status: 'CONFIRMED', priceCents: 10_000 })],
      receivables: [
        { day: '2026-11-10', openCents: 2_500 },
        { day: '2026-11-12', openCents: 1_000 }
      ],
      attendance: none
    })
    expect(f.totals.receivablesCents).toBe(3_500)
    expect(f.totals.expectedTotalCents).toBe(13_500)
  })

  it('esperado desconta faltas só do que ainda não foi confirmado', () => {
    const f = buildForecast({
      days,
      appointments: [appt({ status: 'CONFIRMED', priceCents: 10_000 }), appt({ status: 'SCHEDULED', priceCents: 10_000 })],
      receivables: [],
      attendance: { completed: 80, noShow: 20 } // 80% comparecem
    })
    expect(f.showRate).toBeCloseTo(0.8)
    expect(f.totals.expectedAppointmentsCents).toBe(10_000 + 8_000)
  })

  it('sem amostra suficiente o esperado não desconta nada (e não inventa taxa)', () => {
    const f = buildForecast({
      days,
      appointments: [appt({ status: 'SCHEDULED', priceCents: 10_000 })],
      receivables: [],
      attendance: { completed: 3, noShow: 3 }
    })
    expect(f.showRate).toBeNull()
    expect(f.totals.expectedAppointmentsCents).toBe(10_000)
  })

  it('agrupa por profissional, do maior para o menor', () => {
    const f = buildForecast({
      days,
      appointments: [
        appt({ professionalId: 'p1', professionalName: 'Ana', priceCents: 1_000 }),
        appt({ professionalId: 'p2', professionalName: 'Bia', priceCents: 5_000 }),
        appt({ professionalId: null, professionalName: null, priceCents: 200 })
      ],
      receivables: [],
      attendance: none
    })
    expect(f.byProfessional.map((p) => [p.name, p.cents, p.count])).toEqual([
      ['Bia', 5_000, 1],
      ['Ana', 1_000, 1],
      ['Sem profissional', 200, 1]
    ])
  })

  it('janela vazia devolve zeros, não erro', () => {
    const f = buildForecast({ days, appointments: [], receivables: [], attendance: none })
    expect(f.totals.expectedTotalCents).toBe(0)
    expect(f.days).toHaveLength(3)
  })
})

describe('forecastWindow', () => {
  it('lista N dias a partir de hoje no fuso do negócio, não no do servidor', () => {
    // 02:30 UTC de 11/11 ainda é 10/11 em São Paulo (UTC-3).
    const { today, dayList } = forecastWindow('America/Sao_Paulo', 3, new Date('2026-11-11T02:30:00Z'))
    expect(today).toBe('2026-11-10')
    expect(dayList).toEqual(['2026-11-10', '2026-11-11', '2026-11-12'])
  })

  it('a janela cobre do começo do 1º dia ao fim do último, em UTC', () => {
    const { start, end } = forecastWindow('America/Sao_Paulo', 2, new Date('2026-11-10T15:00:00Z'))
    expect(start.toISOString()).toBe('2026-11-10T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-12T02:59:59.999Z')
  })
})
