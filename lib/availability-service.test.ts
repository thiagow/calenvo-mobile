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
