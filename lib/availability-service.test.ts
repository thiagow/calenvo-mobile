import { describe, it, expect, vi, beforeEach } from 'vitest'

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
      findMany: vi.fn(async ({ where }: { where: { scheduleId: string; professionalId?: string } }) =>
        mockAppointments.filter((a) =>
          a.scheduleId === where.scheduleId && (!where.professionalId || a.professionalId === where.professionalId)
        )
      ),
    },
  },
}))

beforeEach(() => {
  mockAppointments = []
  mockSchedulesById = { 'schedule-1': baseSchedule() }
  mockScheduleList = [{ id: 'schedule-1' }]
})

describe('parseCalendarDate', () => {
  it('não desloca o dia da semana por causa de fuso horário (bug reproduzido em produção)', async () => {
    const { parseCalendarDate } = await import('@/lib/availability-service')

    // 21/07/2026 é uma terça-feira (dia 2). new Date("2026-07-21") sozinho
    // parseia como meia-noite UTC; num processo rodando fora de UTC (ex.:
    // GMT-3), combinar isso com .getDay() (método local) resolve para
    // segunda-feira — foi exatamente o que fez a IA achar a agenda fechada
    // num dia em que ela estava aberta.
    expect(parseCalendarDate('2026-07-21').getDay()).toBe(2)
  })
})

// Data usada nos testes de slots: sempre "daqui a 5 dias", pra nunca cair no
// passado nem estourar advanceBookingDays conforme o tempo passa.
function futureDateStr(daysAhead: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateAt(dateStr: string, hour: number, minute = 0): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, hour, minute, 0, 0)
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
