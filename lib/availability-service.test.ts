import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addCalendarDays, todayInZone, wallTimeToInstant } from '@/lib/timezone'

// Fuso do negócio nos testes. A suíte roda com TZ=UTC (igual à produção), então
// esses dois nunca coincidem — é justamente o que garante que o motor de slots
// não volte a calcular no fuso do processo.
const TZ = 'America/Sao_Paulo'

// Regressão: getAvailableSlots buscava a Schedule só pelo id, sem confirmar que
// pertence ao tenant (userId) do chamador — mesma classe de vazamento cross-tenant
// já corrigida em app/api/booking/[slug]/create/route.ts. Um scheduleId de outro
// tenant, adivinhado ou vazado, não pode mais retornar disponibilidade real.
function baseSchedule(overrides: Partial<any> = {}) {
  return {
    id: 'schedule-1',
    userId: 'tenant-a',
    workingDays: [0, 1, 2, 3, 4, 5, 6],
    startTime: '08:00',
    endTime: '18:00',
    slotDuration: 30,
    bufferTime: 0,
    lunchStart: null,
    lunchEnd: null,
    useCustomDayConfig: false,
    advanceBookingDays: 90,
    minNoticeHours: 0,
    dayConfigs: [],
    blocks: [],
    services: [{ service: { id: 'service-1', duration: 30 } }],
    professionals: [],
    user: { businessConfig: { timezone: TZ } },
    ...overrides,
  }
}

let mockSchedulesById: Record<string, any> = {}
let mockScheduleList: { id: string }[] = []
let mockAppointments: any[] = []

const findFirstMock = vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
  const schedule = mockSchedulesById[where.id]
  return schedule && schedule.userId === where.userId ? schedule : null
})

const findManyScheduleMock = vi.fn(async () => mockScheduleList)

vi.mock('@/lib/db', () => ({
  prisma: {
    schedule: { findFirst: findFirstMock, findMany: findManyScheduleMock },
    appointment: {
      // A ocupação real (getAvailableSlots) consulta por professionalId — sem
      // scheduleId — sempre que a agenda tem algum profissional vinculado; só
      // cai pro filtro por scheduleId em agenda legada (sem nenhum vinculado).
      findMany: vi.fn(async ({ where }: any) => {
        // A janela de datas é respeitada de propósito: é ela que precisa recuar
        // além da meia-noite pra pegar agendamento que começa na véspera.
        const inWindow = (a: any) =>
          a.date >= where.date.gte && a.date <= where.date.lte
        if (where.professionalId) {
          const ids: string[] = where.professionalId.in
          return mockAppointments.filter((a) => ids.includes(a.professionalId) && inWindow(a))
        }
        return mockAppointments.filter((a) => a.scheduleId === where.scheduleId && inWindow(a))
      }),
    },
  },
}))

beforeEach(() => {
  mockAppointments = []
  mockSchedulesById = { 'schedule-1': baseSchedule() }
  mockScheduleList = [{ id: 'schedule-1' }]
})

// Data usada nos testes de slots: sempre "daqui a N dias" no calendário do
// negócio, pra nunca cair no passado nem estourar advanceBookingDays.
function futureDateStr(daysAhead: number): string {
  return addCalendarDays(todayInZone(TZ), daysAhead)
}

/** Instante de um agendamento às HH:mm do horário de parede do negócio. */
function dateAt(dateStr: string, hour: number, minute = 0): Date {
  return wallTimeToInstant(dateStr, `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, TZ)
}

describe('getAvailableSlots', () => {
  it('busca a agenda escopada por id E userId', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')

    await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date: futureDateStr(5), userId: 'tenant-a' })

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'schedule-1', userId: 'tenant-a' } })
    )
  })

  it('retorna null quando a agenda pertence a outro tenant', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')

    const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date: futureDateStr(5), userId: 'tenant-b' })

    expect(result).toBeNull()
  })

  it('retorna slots quando a agenda pertence ao tenant correto', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')

    const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date: futureDateStr(5), userId: 'tenant-a' })

    expect(result).not.toBeNull()
    expect(result!.length).toBeGreaterThan(0)
  })

  it('rejeita data além de advanceBookingDays', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')
    mockSchedulesById['schedule-1'].advanceBookingDays = 10

    const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date: futureDateStr(20), userId: 'tenant-a' })

    expect(result).toEqual([])
  })

  it('aceita o último dia da janela e rejeita o dia seguinte', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')
    mockSchedulesById['schedule-1'].advanceBookingDays = 10

    const lastDay = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date: futureDateStr(10), userId: 'tenant-a' })
    const dayAfter = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date: futureDateStr(11), userId: 'tenant-a' })

    expect(lastDay!.length).toBeGreaterThan(0)
    expect(dayAfter).toEqual([])
  })

  it('aceita datas de meses futuros com a janela padrão de 90 dias', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')

    const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date: futureDateStr(60), userId: 'tenant-a' })

    expect(result!.length).toBeGreaterThan(0)
  })

  it('rejeita data no passado', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')

    const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date: futureDateStr(-5), userId: 'tenant-a' })

    expect(result).toEqual([])
  })

  // Regressão do bug relatado na conta ferfigueirag: a grade exibia 15:00 como
  // livre enquanto a criação recusava o mesmo horário com "este profissional já
  // está ocupado". O motor montava o horário de parede do slot com métodos
  // locais do processo — UTC em produção — e comparava 15:00Z contra o instante
  // realmente gravado, 18:00Z (15:00 em GMT-3). Defasagem fixa de 3h: o slot
  // ocupado aparecia livre, e o slot livre 3h adiante aparecia ocupado.
  describe('fuso horário do negócio (processo em UTC)', () => {
    it('bloqueia o slot das 15:00 quando há agendamento às 15:00 no fuso do negócio', async () => {
      const { getAvailableSlots } = await import('@/lib/availability-service')
      const date = futureDateStr(5)
      mockSchedulesById['schedule-1'].professionals = [{ professionalId: 'p1' }]
      mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 15), duration: 30, professionalId: 'p1' }]

      const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a', professionalId: 'p1' })

      expect(result!.find((s) => s.time === '15:00')?.available).toBe(false)
      // E não desloca a ocupação pra 3h adiante, que era o outro lado do bug.
      expect(result!.find((s) => s.time === '12:00')?.available).toBe(true)
    })

    it('um agendamento que começa na véspera e invade o dia bloqueia o primeiro slot', async () => {
      const { getAvailableSlots } = await import('@/lib/availability-service')
      const date = futureDateStr(5)
      mockSchedulesById['schedule-1'].startTime = '00:00'
      mockSchedulesById['schedule-1'].professionals = [{ professionalId: 'p1' }]
      // 23:30 do dia anterior, 60min -> invade 00:00 do dia consultado.
      mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(addCalendarDays(date, -1), 23, 30), duration: 60, professionalId: 'p1' }]

      const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a', professionalId: 'p1' })

      expect(result!.find((s) => s.time === '00:00')?.available).toBe(false)
    })
  })

  // Regressão: antes, uma agenda com N profissionais vinculados só aceitava 1
  // agendamento por horário no total — os profissionais "competiam" pelo mesmo
  // slot mesmo estando livres. Agora a capacidade acompanha o nº de profissionais.
  describe('capacidade por profissional', () => {
    it('com 3 profissionais vinculados e 1 agendamento no horário, o slot continua disponível', async () => {
      const { getAvailableSlots } = await import('@/lib/availability-service')
      const date = futureDateStr(5)
      mockSchedulesById['schedule-1'].professionals = [{ professionalId: 'p1' }, { professionalId: 'p2' }, { professionalId: 'p3' }]
      mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 9), duration: 30, professionalId: 'p1' }]

      const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a' })

      const slot9am = result!.find((s) => s.time === '09:00')
      expect(slot9am?.available).toBe(true)
    })

    it('com 3 profissionais vinculados e 3 agendamentos no mesmo horário, o slot fica indisponível', async () => {
      const { getAvailableSlots } = await import('@/lib/availability-service')
      const date = futureDateStr(5)
      mockSchedulesById['schedule-1'].professionals = [{ professionalId: 'p1' }, { professionalId: 'p2' }, { professionalId: 'p3' }]
      mockAppointments = [
        { scheduleId: 'schedule-1', date: dateAt(date, 9), duration: 30, professionalId: 'p1' },
        { scheduleId: 'schedule-1', date: dateAt(date, 9), duration: 30, professionalId: 'p2' },
        { scheduleId: 'schedule-1', date: dateAt(date, 9), duration: 30, professionalId: 'p3' },
      ]

      const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a' })

      const slot9am = result!.find((s) => s.time === '09:00')
      expect(slot9am?.available).toBe(false)
    })

    it('com professionalId específico, considera só os agendamentos daquele profissional (capacidade 1)', async () => {
      const { getAvailableSlots } = await import('@/lib/availability-service')
      const date = futureDateStr(5)
      mockSchedulesById['schedule-1'].professionals = [{ professionalId: 'p1' }, { professionalId: 'p2' }]
      mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 9), duration: 30, professionalId: 'p2' }]

      const forP1 = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a', professionalId: 'p1' })
      const forP2 = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a', professionalId: 'p2' })

      expect(forP1!.find((s) => s.time === '09:00')?.available).toBe(true)
      expect(forP2!.find((s) => s.time === '09:00')?.available).toBe(false)
    })

    // Regressão principal: um profissional ocupado numa agenda tinha sua
    // ocupação escondida ao consultar disponibilidade em OUTRA agenda a que
    // também está vinculado — mesmo profissional, mesmo horário, serviço
    // diferente. Era esse o bug reproduzido nos prints (John ocupado às 09:00
    // na agenda "Mechas" ainda aparecia livre na agenda "Geral").
    it('profissional ocupado numa agenda não aparece livre em outra agenda a que também está vinculado', async () => {
      const date = futureDateStr(5)
      mockSchedulesById = {
        'schedule-1': baseSchedule({ id: 'schedule-1', professionals: [{ professionalId: 'john' }] }),
        'schedule-2': baseSchedule({ id: 'schedule-2', professionals: [{ professionalId: 'john' }] }),
      }
      // Agendamento de John criado na agenda 1 (outro serviço/agenda).
      mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 9), duration: 30, professionalId: 'john' }]

      const { getAvailableSlots } = await import('@/lib/availability-service')
      const resultOnOtherSchedule = await getAvailableSlots({
        scheduleId: 'schedule-2',
        serviceId: 'service-1',
        date,
        userId: 'tenant-a',
        professionalId: 'john',
      })

      expect(resultOnOtherSchedule!.find((s) => s.time === '09:00')?.available).toBe(false)
    })

    it('agenda legada sem nenhum profissional vinculado mantém a checagem pela agenda inteira', async () => {
      const date = futureDateStr(5)
      mockSchedulesById['schedule-1'].professionals = []
      mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 9), duration: 30, professionalId: null }]

      const { getAvailableSlots } = await import('@/lib/availability-service')
      const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a' })

      expect(result!.find((s) => s.time === '09:00')?.available).toBe(false)
    })

    it('agendamento legado com professionalId nulo não bloqueia um profissional nomeado', async () => {
      const date = futureDateStr(5)
      mockSchedulesById['schedule-1'].professionals = [{ professionalId: 'p1' }]
      // Registro antigo sem profissional atribuído, na mesma agenda/horário.
      mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 9), duration: 30, professionalId: null }]

      const { getAvailableSlots } = await import('@/lib/availability-service')
      const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a', professionalId: 'p1' })

      expect(result!.find((s) => s.time === '09:00')?.available).toBe(true)
    })
  })
})

describe('início encaixado logo após um compromisso', () => {
  // Caso real (Bellae, 04/12): expediente 15:00–19:00, serviço de 120 min, agendamento
  // das 13:30 às 15:30. A grade fixa só tinha 15:00 e 17:00; o 15:30 livre sumia.
  function alinhamentoSchedule() {
    mockSchedulesById['schedule-1'] = baseSchedule({
      useCustomDayConfig: true,
      dayConfigs: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek, isActive: true, timeSlots: [{ startTime: '15:00', endTime: '19:00' }],
      })),
      services: [{ service: { id: 'service-1', duration: 120 } }],
      professionals: [{ professionalId: 'p1' }],
    })
  }

  it('oferece o horário em que o agendamento anterior termina', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')
    const date = futureDateStr(5)
    alinhamentoSchedule()
    mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 13, 30), duration: 120, professionalId: 'p1' }]

    const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a' })

    expect(result!.map((s) => `${s.time}${s.available ? '' : '✗'}`)).toEqual(['15:00✗', '15:30', '17:00'])
  })

  it('depois de agendar às 15:30 (até 17:30) não sobra nada: 17:30 + 120min estoura as 19:00', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')
    const date = futureDateStr(5)
    alinhamentoSchedule()
    mockAppointments = [
      { scheduleId: 'schedule-1', date: dateAt(date, 13, 30), duration: 120, professionalId: 'p1' },
      { scheduleId: 'schedule-1', date: dateAt(date, 15, 30), duration: 120, professionalId: 'p1' },
    ]

    const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a' })

    expect(result!.filter((s) => s.available)).toEqual([])
    expect(result!.some((s) => s.time === '17:30')).toBe(false) // nem aparece na grade
  })

  it('expediente até 18:00: só o 15:30 é oferecido (17:00 e 17:30 estourariam o fim)', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')
    const date = futureDateStr(5)
    alinhamentoSchedule()
    mockSchedulesById['schedule-1'].dayConfigs.forEach((c: any) => (c.timeSlots = [{ startTime: '15:00', endTime: '18:00' }]))
    mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 13, 30), duration: 120, professionalId: 'p1' }]

    const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a' })

    expect(result!.map((s) => `${s.time}${s.available ? '' : '✗'}`)).toEqual(['15:00✗', '15:30'])
  })

  it('não oferece início que estoura o fim do expediente', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')
    const date = futureDateStr(5)
    alinhamentoSchedule()
    mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 16, 30), duration: 120, professionalId: 'p1' }]

    const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a' })

    // termina 18:30; 18:30 + 120min passaria das 19:00 → não entra na grade
    expect(result!.map((s) => s.time)).toEqual(['15:00', '17:00'])
  })

  it('respeita o intervalo entre atendimentos (bufferTime) ao encaixar', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')
    const date = futureDateStr(5)
    alinhamentoSchedule()
    mockSchedulesById['schedule-1'].bufferTime = 15
    mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 13, 30), duration: 120, professionalId: 'p1' }]

    const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a' })

    expect(result!.some((s) => s.time === '15:45' && s.available)).toBe(true)
    expect(result!.some((s) => s.time === '15:30')).toBe(false)
  })

  it('não duplica horário que já está na grade', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')
    const date = futureDateStr(5)
    // 09:00 + 30 min termina 09:30, que já é um passo da grade de 30 min
    mockSchedulesById['schedule-1'].professionals = [{ professionalId: 'p1' }]
    mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 9), duration: 30, professionalId: 'p1' }]

    const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a' })

    const times = result!.map((s) => s.time)
    expect(new Set(times).size).toBe(times.length)
    expect(times).toEqual([...times].sort())
  })
})

describe('motivo para o cliente final (página pública e chat)', () => {

  it('nunca expõe o motivo interno do bloqueio na mensagem pública', async () => {
    const { getAvailableSlots, getNoSlotsReason } = await import('@/lib/availability-service')
    const date = futureDateStr(5)
    mockSchedulesById['schedule-1'].blocks = [
      { startDate: new Date(`${date}T00:00:00.000Z`), endDate: new Date(`${date}T00:00:00.000Z`), isAllDay: true, professionalId: null, reason: 'Consulta médica da dona' },
    ]
    const params = { scheduleId: 'schedule-1', userId: 'tenant-a', date }
    const slots = (await getAvailableSlots({ ...params, serviceId: 'service-1' }))!
    const reason = (await getNoSlotsReason({ ...params, slots }))!

    expect(reason.message).toContain('Consulta médica da dona') // painel vê
    expect(reason.publicMessage).not.toContain('Consulta')       // cliente não
    expect(reason.publicMessage).toBe('Não haverá atendimento nesta data')
  })

  it('várias agendas do serviço: "tudo preenchido" vence "fora da janela", e a janela mais distante vence', async () => {
    const { getNoSlotsReasonForService } = await import('@/lib/availability-service')
    const date = futureDateStr(40)
    mockScheduleList = [{ id: 'schedule-1' }, { id: 'schedule-2' }]
    mockSchedulesById = {
      'schedule-1': baseSchedule({ advanceBookingDays: 10 }),
      'schedule-2': baseSchedule({ id: 'schedule-2', advanceBookingDays: 30 }),
    }

    const reason = await getNoSlotsReasonForService({ userId: 'tenant-a', serviceId: 'service-1', date, slots: [] })

    expect(reason?.code).toBe('BEYOND_ADVANCE_WINDOW')
    expect(reason?.lastBookableDate).toBe(futureDateStr(30)) // a agenda de 30 dias, não a de 10
    expect(reason?.publicMessage).toContain('Agendamentos abertos até')
  })

  it('com horário livre não há motivo', async () => {
    const { getNoSlotsReasonForService } = await import('@/lib/availability-service')

    expect(
      await getNoSlotsReasonForService({ userId: 'tenant-a', serviceId: 'service-1', date: futureDateStr(5), slots: [{ time: '09:00', available: true }] })
    ).toBeNull()
  })
})

describe('passo entre horários e agendamento inteligente', () => {
  // Expediente 15:00–19:00, serviço de 120 min (também o menor da agenda), passo de 30 min.
  function scheduleWith(overrides: Partial<any> = {}) {
    mockSchedulesById['schedule-1'] = baseSchedule({
      startInterval: 30,
      smartScheduling: true,
      slotDuration: 120,
      useCustomDayConfig: true,
      dayConfigs: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek, isActive: true, timeSlots: [{ startTime: '15:00', endTime: '19:00' }],
      })),
      services: [{ service: { id: 'service-1', duration: 120 } }],
      professionals: [{ professionalId: 'p1' }],
      ...overrides,
    })
  }
  const free = (slots: { time: string; available: boolean }[]) => slots.filter((s) => s.available).map((s) => s.time)
  async function slotsFor(date: string, extra: Record<string, unknown> = {}) {
    const { getAvailableSlots } = await import('@/lib/availability-service')
    return (await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a', ...extra }))!
  }

  it('dia vazio: oferece só os inícios que não deixam vãos curtos demais (15:00 e 17:00)', async () => {
    scheduleWith()

    expect(free(await slotsFor(futureDateStr(5)))).toEqual(['15:00', '17:00'])
  })

  it('agendamento inteligente desligado: todos os inícios de 30 em 30', async () => {
    scheduleWith({ smartScheduling: false })

    expect(free(await slotsFor(futureDateStr(5)))).toEqual(['15:00', '15:30', '16:00', '16:30', '17:00'])
  })

  it('painel (ignoreSmartScheduling) vê todos os inícios, mesmo com a regra ligada na agenda', async () => {
    scheduleWith()

    expect(free(await slotsFor(futureDateStr(5), { ignoreSmartScheduling: true }))).toEqual([
      '15:00', '15:30', '16:00', '16:30', '17:00',
    ])
  })

  it('caso real (Alinhamento, agendamento 13:30–15:30): 15:30 e 17:00, sem 16:00 e 16:30', async () => {
    const date = futureDateStr(5)
    scheduleWith()
    mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 13, 30), duration: 120, professionalId: 'p1' }]

    expect(free(await slotsFor(date))).toEqual(['15:30', '17:00'])
  })

  it('vão de 180 min para serviço de 120: mantém as pontas e esconde o do meio', async () => {
    const date = futureDateStr(5)
    scheduleWith()
    mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 15), duration: 60, professionalId: 'p1' }]

    expect(free(await slotsFor(date))).toEqual(['16:00', '17:00'])
  })

  it('passo 0 ("igual à duração") mantém a grade antiga, sem filtro', async () => {
    scheduleWith({ startInterval: 0 })

    expect(free(await slotsFor(futureDateStr(5)))).toEqual(['15:00', '17:00'])
    const date = futureDateStr(6)
    mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 13, 30), duration: 120, professionalId: 'p1' }]
    expect(free(await slotsFor(date))).toEqual(['15:30', '17:00'])
  })

  it('intervalo entre atendimentos (bufferTime) é exigido dos dois lados com passo fixo', async () => {
    const date = futureDateStr(5)
    scheduleWith({ bufferTime: 15 })
    mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 13, 30), duration: 120, professionalId: 'p1' }]

    const result = await slotsFor(date)

    expect(result.find((s) => s.time === '15:30')?.available).toBe(false) // sem os 15 min de folga
    expect(free(result)).toEqual(['15:45', '17:00'])
  })

  it('vários profissionais: o início vale se ao menos um profissional livre o aproveita bem', async () => {
    const date = futureDateStr(5)
    scheduleWith({ professionals: [{ professionalId: 'p1' }, { professionalId: 'p2' }] })
    mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 13, 30), duration: 120, professionalId: 'p1' }]

    // 15:30 encosta no fim do agendamento do p1 (serve a ele), mesmo que p2 ficasse com vãos curtos
    expect(free(await slotsFor(date))).toContain('15:30')
    // 16:00 deixa vãos curtos para os dois → escondido
    expect(free(await slotsFor(date))).not.toContain('16:00')
  })

  it('agenda legada sem profissional: a regra usa os agendamentos da agenda inteira', async () => {
    const date = futureDateStr(5)
    scheduleWith({ professionals: [] })
    mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 13, 30), duration: 120, professionalId: null }]

    expect(free(await slotsFor(date))).toEqual(['15:30', '17:00'])
  })

  it('serviço mais curto que o menor da agenda nunca é afetado pelo filtro de vãos', async () => {
    // menor serviço = 30 min: nenhuma sobra de 30 min ou mais é "curta demais"
    scheduleWith({ slotDuration: 30, services: [{ service: { id: 'service-1', duration: 30 } }] })

    const result = await slotsFor(futureDateStr(5))

    expect(free(result)).toHaveLength(8) // 15:00 … 18:30, de 30 em 30
  })
})

describe('isSmartStart (função pura)', () => {
  const windows = [{ start: 15 * 60, end: 19 * 60 }]

  it('encostar numa borda mantém o início, mesmo deixando sobra curta do outro lado', async () => {
    const { isSmartStart } = await import('@/lib/availability-service')

    expect(isSmartStart({ start: 15 * 60, end: 17 * 60, windows, busy: [], minServiceMinutes: 120 })).toBe(true)
  })

  it('sobra curta dos dois lados esconde', async () => {
    const { isSmartStart } = await import('@/lib/availability-service')

    expect(isSmartStart({ start: 16 * 60, end: 18 * 60, windows, busy: [], minServiceMinutes: 120 })).toBe(false)
  })

  it('sobras que comportam o menor serviço não são órfãs', async () => {
    const { isSmartStart } = await import('@/lib/availability-service')
    const wide = [{ start: 8 * 60, end: 20 * 60 }]

    // 12:00–14:00 num expediente de 12h: sobras de 4h e 6h
    expect(isSmartStart({ start: 12 * 60, end: 14 * 60, windows: wide, busy: [], minServiceMinutes: 120 })).toBe(true)
  })

  it('compromisso vizinho define a borda', async () => {
    const { isSmartStart } = await import('@/lib/availability-service')
    const busy = [{ start: 17 * 60 + 30, end: 18 * 60 }] // próximo compromisso às 17:30

    // 15:30–17:30 encosta no compromisso (depois = 0) → mantém
    expect(isSmartStart({ start: 15 * 60 + 30, end: 17 * 60 + 30, windows, busy, minServiceMinutes: 120 })).toBe(true)
    // 15:00–17:00 deixa 30 min até o compromisso, e encosta no início do expediente → mantém
    expect(isSmartStart({ start: 15 * 60, end: 17 * 60, windows, busy, minServiceMinutes: 120 })).toBe(true)
  })

  it('fora de qualquer expediente conhecido não filtra', async () => {
    const { isSmartStart } = await import('@/lib/availability-service')

    expect(isSmartStart({ start: 10 * 60, end: 12 * 60, windows, busy: [], minServiceMinutes: 120 })).toBe(true)
  })
})

describe('antecedência máxima e motivo de "sem horários"', () => {
  it('ignoreAdvanceWindow libera o dia além da janela (tela interna do painel)', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')
    mockSchedulesById['schedule-1'].advanceBookingDays = 30
    const date = futureDateStr(49)

    const publicView = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a' })
    const internal = await getAvailableSlots({
      scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a', ignoreAdvanceWindow: true,
    })

    expect(publicView).toEqual([])
    expect(internal!.length).toBeGreaterThan(0)
  })

  it('ignoreAdvanceWindow não libera o passado nem dia sem atendimento', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')
    mockSchedulesById['schedule-1'].workingDays = []

    expect(
      await getAvailableSlots({
        scheduleId: 'schedule-1', serviceId: 'service-1', date: futureDateStr(5), userId: 'tenant-a', ignoreAdvanceWindow: true,
      })
    ).toEqual([])
    expect(
      await getAvailableSlots({
        scheduleId: 'schedule-1', serviceId: 'service-1', date: futureDateStr(-2), userId: 'tenant-a', ignoreAdvanceWindow: true,
      })
    ).toEqual([])
  })

  async function reasonFor(date: string, extra: Record<string, unknown> = {}) {
    const { getAvailableSlots, getNoSlotsReason } = await import('@/lib/availability-service')
    const params = { scheduleId: 'schedule-1', userId: 'tenant-a', date, ...extra }
    const slots = (await getAvailableSlots({ ...params, serviceId: 'service-1' }))!
    return getNoSlotsReason({ ...params, slots })
  }

  it('além da antecedência: explica a data limite', async () => {
    mockSchedulesById['schedule-1'].advanceBookingDays = 30
    const reason = await reasonFor(futureDateStr(49))

    expect(reason?.code).toBe('BEYOND_ADVANCE_WINDOW')
    expect(reason?.message).toContain('30 dias')
  })

  it('dia sem atendimento, bloqueado (com motivo) e dia desativado têm motivos distintos', async () => {
    const date = futureDateStr(5)
    mockSchedulesById['schedule-1'].workingDays = []
    expect((await reasonFor(date))?.code).toBe('NOT_WORKING_DAY')

    mockSchedulesById['schedule-1'].workingDays = [0, 1, 2, 3, 4, 5, 6]
    mockSchedulesById['schedule-1'].blocks = [
      { startDate: new Date(`${date}T00:00:00.000Z`), endDate: new Date(`${date}T00:00:00.000Z`), isAllDay: true, professionalId: null, reason: 'VIAGEM' },
    ]
    const blocked = await reasonFor(date)
    expect(blocked?.code).toBe('DAY_BLOCKED')
    expect(blocked?.message).toContain('VIAGEM')

    mockSchedulesById['schedule-1'].blocks = []
    mockSchedulesById['schedule-1'].useCustomDayConfig = true
    mockSchedulesById['schedule-1'].dayConfigs = []
    expect((await reasonFor(date))?.code).toBe('DAY_INACTIVE')
  })

  it('serviço maior que a janela do dia: SERVICE_DOES_NOT_FIT', async () => {
    mockSchedulesById['schedule-1'].services = [{ service: { id: 'service-1', duration: 720 } }]

    expect((await reasonFor(futureDateStr(5)))?.code).toBe('SERVICE_DOES_NOT_FIT')
  })

  it('grade cheia (tudo ocupado): FULLY_BOOKED; com horário livre não há motivo', async () => {
    const date = futureDateStr(5)
    expect(await reasonFor(date)).toBeNull()

    mockSchedulesById['schedule-1'].professionals = [{ professionalId: 'p1' }]
    mockAppointments = [{ scheduleId: 'schedule-1', date: dateAt(date, 8), duration: 600, professionalId: 'p1' }]
    expect((await reasonFor(date))?.code).toBe('FULLY_BOOKED')
  })
})

describe('bloqueio pessoal de profissional', () => {
  const allDayFor = (date: string, professionalId: string | null) => ({
    startDate: new Date(`${date}T00:00:00.000Z`),
    endDate: new Date(`${date}T00:00:00.000Z`),
    isAllDay: true,
    professionalId,
  })

  it('dia inteiro de um profissional não fecha o dia: o colega vinculado continua atendendo', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')
    const date = futureDateStr(5)
    mockSchedulesById['schedule-1'].professionals = [{ professionalId: 'p1' }, { professionalId: 'p2' }]
    mockSchedulesById['schedule-1'].blocks = [allDayFor(date, 'p1')]

    const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a' })

    expect(result!.length).toBeGreaterThan(0)
    expect(result!.every((s) => s.available)).toBe(true)
  })

  it('todos os vinculados bloqueados no dia: dia fechado (sem slots)', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')
    const date = futureDateStr(5)
    mockSchedulesById['schedule-1'].professionals = [{ professionalId: 'p1' }, { professionalId: 'p2' }]
    mockSchedulesById['schedule-1'].blocks = [allDayFor(date, 'p1'), allDayFor(date, 'p2')]

    expect(await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a' })).toEqual([])
  })

  it('profissional pedido está bloqueado: sem slots, mesmo com colega livre', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')
    const date = futureDateStr(5)
    mockSchedulesById['schedule-1'].professionals = [{ professionalId: 'p1' }, { professionalId: 'p2' }]
    mockSchedulesById['schedule-1'].blocks = [allDayFor(date, 'p1')]

    expect(
      await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a', professionalId: 'p1' })
    ).toEqual([])
  })

  it('faixa de horário pessoal tira só os slots dentro da faixa', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')
    const date = futureDateStr(5)
    mockSchedulesById['schedule-1'].professionals = [{ professionalId: 'p1' }]
    mockSchedulesById['schedule-1'].blocks = [
      { startDate: dateAt(date, 9), endDate: dateAt(date, 10), isAllDay: false, professionalId: 'p1' },
    ]

    const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a' })

    expect(result!.find((s) => s.time === '09:00')?.available).toBe(false)
    expect(result!.find((s) => s.time === '09:30')?.available).toBe(false)
    expect(result!.find((s) => s.time === '10:00')?.available).toBe(true)
  })

  it('bloqueio da agenda inteira (sem profissional) continua fechando todos', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')
    const date = futureDateStr(5)
    mockSchedulesById['schedule-1'].professionals = [{ professionalId: 'p1' }, { professionalId: 'p2' }]
    mockSchedulesById['schedule-1'].blocks = [allDayFor(date, null)]

    expect(await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a' })).toEqual([])
  })
})

describe('resolveCandidateSchedules', () => {
  it('busca agendas ativas do tenant filtrando por serviço', async () => {
    const { resolveCandidateSchedules } = await import('@/lib/availability-service')

    await resolveCandidateSchedules({ userId: 'tenant-a', serviceId: 'service-1' })

    expect(findManyScheduleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'tenant-a',
          isActive: true,
          services: { some: { serviceId: 'service-1' } },
        }),
      })
    )
  })

  it('inclui filtro por profissional quando informado', async () => {
    const { resolveCandidateSchedules } = await import('@/lib/availability-service')

    await resolveCandidateSchedules({ userId: 'tenant-a', serviceId: 'service-1', professionalId: 'p1' })

    expect(findManyScheduleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          professionals: { some: { professionalId: 'p1' } },
        }),
      })
    )
  })
})

describe('getAvailableSlotsForService', () => {
  it('retorna null quando o serviço não está em nenhuma agenda ativa', async () => {
    mockScheduleList = []
    const { getAvailableSlotsForService } = await import('@/lib/availability-service')

    const result = await getAvailableSlotsForService({ userId: 'tenant-a', serviceId: 'service-1', date: futureDateStr(5) })

    expect(result).toBeNull()
  })

  // O cliente não escolhe mais a agenda: um serviço pode estar em 2 agendas
  // diferentes, e um horário livre em qualquer uma delas deve aparecer como
  // disponível — a união das duas, não a interseção.
  it('une os horários de duas agendas candidatas (livre numa, ocupado na outra)', async () => {
    const date = futureDateStr(5)
    mockSchedulesById = {
      'schedule-1': baseSchedule({ id: 'schedule-1' }),
      'schedule-2': baseSchedule({ id: 'schedule-2' }),
    }
    mockScheduleList = [{ id: 'schedule-1' }, { id: 'schedule-2' }]
    mockAppointments = [
      { scheduleId: 'schedule-1', date: dateAt(date, 9), duration: 30, professionalId: null },
    ]

    const { getAvailableSlotsForService } = await import('@/lib/availability-service')
    const result = await getAvailableSlotsForService({ userId: 'tenant-a', serviceId: 'service-1', date })

    // schedule-1 tem o 09:00 ocupado, mas schedule-2 está livre — a união mostra disponível
    expect(result!.find((s) => s.time === '09:00')?.available).toBe(true)
  })
})

describe('getMaxBookableDate', () => {
  it('devolve hoje + a maior antecedência entre as agendas candidatas', async () => {
    const { getMaxBookableDate } = await import('@/lib/availability-service')
    mockScheduleList = [
      { id: 'a', advanceBookingDays: 30, user: { businessConfig: { timezone: TZ } } },
      { id: 'b', advanceBookingDays: 120, user: { businessConfig: { timezone: TZ } } },
    ] as any

    const result = await getMaxBookableDate({ userId: 'tenant-a', serviceId: 'service-1' })

    expect(result).toBe(futureDateStr(120))
  })

  it('retorna null quando o serviço não está em nenhuma agenda', async () => {
    const { getMaxBookableDate } = await import('@/lib/availability-service')
    mockScheduleList = []

    expect(await getMaxBookableDate({ userId: 'tenant-a', serviceId: 'service-1' })).toBeNull()
  })
})
