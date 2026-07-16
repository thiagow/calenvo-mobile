import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regressão: getAvailableSlots buscava a Schedule só pelo id, sem confirmar que
// pertence ao tenant (userId) do chamador — mesma classe de vazamento cross-tenant
// já corrigida em app/api/booking/[slug]/create/route.ts. Um scheduleId de outro
// tenant, adivinhado ou vazado, não pode mais retornar disponibilidade real.
let mockSchedule: any
let mockAppointments: any[] = []

const findFirstMock = vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
  if (where.id === 'schedule-1' && where.userId === 'tenant-a') {
    return mockSchedule
  }
  return null
})

vi.mock('@/lib/db', () => ({
  prisma: {
    schedule: { findFirst: findFirstMock },
    appointment: {
      findMany: vi.fn(async ({ where }: { where: { professionalId?: string } }) =>
        where.professionalId ? mockAppointments.filter((a) => a.professionalId === where.professionalId) : mockAppointments
      ),
    },
  },
}))

beforeEach(() => {
  mockAppointments = []
  mockSchedule = {
    id: 'schedule-1',
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
  }
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
    mockSchedule.advanceBookingDays = 10

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
      mockSchedule.professionals = [{ professionalId: 'p1' }, { professionalId: 'p2' }, { professionalId: 'p3' }]
      const [y, m, d] = date.split('-').map(Number)
      const aptDate = new Date(y, m - 1, d, 9, 0, 0, 0)
      mockAppointments = [{ date: aptDate, duration: 30, professionalId: 'p1' }]

      const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a' })

      const slot9am = result!.find((s) => s.time === '09:00')
      expect(slot9am?.available).toBe(true)
    })

    it('com 3 profissionais vinculados e 3 agendamentos no mesmo horário, o slot fica indisponível', async () => {
      const { getAvailableSlots } = await import('@/lib/availability-service')
      const date = futureDateStr(5)
      mockSchedule.professionals = [{ professionalId: 'p1' }, { professionalId: 'p2' }, { professionalId: 'p3' }]
      const [y, m, d] = date.split('-').map(Number)
      const aptDate = new Date(y, m - 1, d, 9, 0, 0, 0)
      mockAppointments = [
        { date: aptDate, duration: 30, professionalId: 'p1' },
        { date: aptDate, duration: 30, professionalId: 'p2' },
        { date: aptDate, duration: 30, professionalId: 'p3' },
      ]

      const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a' })

      const slot9am = result!.find((s) => s.time === '09:00')
      expect(slot9am?.available).toBe(false)
    })

    it('com professionalId específico, considera só os agendamentos daquele profissional (capacidade 1)', async () => {
      const { getAvailableSlots } = await import('@/lib/availability-service')
      const date = futureDateStr(5)
      mockSchedule.professionals = [{ professionalId: 'p1' }, { professionalId: 'p2' }]
      const [y, m, d] = date.split('-').map(Number)
      const aptDate = new Date(y, m - 1, d, 9, 0, 0, 0)
      mockAppointments = [{ date: aptDate, duration: 30, professionalId: 'p2' }]

      const forP1 = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a', professionalId: 'p1' })
      const forP2 = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date, userId: 'tenant-a', professionalId: 'p2' })

      expect(forP1!.find((s) => s.time === '09:00')?.available).toBe(true)
      expect(forP2!.find((s) => s.time === '09:00')?.available).toBe(false)
    })
  })
})
