import { describe, it, expect, vi, beforeEach } from 'vitest'

// resolveProfessionalForBooking é o único lugar que decide qual profissional fica
// com um novo agendamento — usado por booking público, chat de IA, dashboard e API
// v1. Antes, cada rota fazia sua própria checagem solta e nenhuma delas atribuía
// um profissional concreto quando o cliente não tinha preferência, então uma
// agenda com N profissionais nunca aproveitava a capacidade de tê-los livres em
// paralelo.
let mockAppointments: any[] = []
let mockCandidateScheduleIds: string[] = ['schedule-1']
let mockProfessionalsBySchedule: Record<string, { professionalId: string }[]> = {
  'schedule-1': [{ professionalId: 'p1' }, { professionalId: 'p2' }, { professionalId: 'p3' }],
}

vi.mock('@/lib/db', () => ({
  prisma: {
    schedule: {
      findUnique: vi.fn(async ({ where }: any) => ({
        professionals: mockProfessionalsBySchedule[where.id] || [],
      })),
      findMany: vi.fn(async () => mockCandidateScheduleIds.map((id) => ({ id }))),
    },
    appointment: {
      findMany: vi.fn(async ({ where }: any) =>
        mockAppointments.filter((a) =>
          (a.scheduleId === undefined || a.scheduleId === where.scheduleId) &&
          (!where.professionalId || a.professionalId === where.professionalId)
        )
      ),
    },
  },
}))

beforeEach(() => {
  mockAppointments = []
  mockCandidateScheduleIds = ['schedule-1']
  mockProfessionalsBySchedule = {
    'schedule-1': [{ professionalId: 'p1' }, { professionalId: 'p2' }, { professionalId: 'p3' }],
  }
})

const scheduleId = 'schedule-1'
const date = new Date(2099, 0, 1, 10, 0, 0, 0)
const duration = 30

describe('resolveProfessionalForBooking', () => {
  it('atribui o profissional pedido quando ele está livre', async () => {
    const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

    const result = await resolveProfessionalForBooking({ scheduleId, date, duration, requestedProfessionalId: 'p2' })

    expect(result).toEqual({ professionalId: 'p2' })
  })

  it('rejeita quando o profissional pedido não pertence a esta agenda', async () => {
    const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

    const result = await resolveProfessionalForBooking({ scheduleId, date, duration, requestedProfessionalId: 'estranho' })

    expect(result.professionalId).toBeNull()
    expect(result.error).toBeDefined()
  })

  it('rejeita quando o profissional pedido já está ocupado nesse horário', async () => {
    mockAppointments = [{ date, duration, professionalId: 'p2' }]
    const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

    const result = await resolveProfessionalForBooking({ scheduleId, date, duration, requestedProfessionalId: 'p2' })

    expect(result.professionalId).toBeNull()
    expect(result.error).toBeDefined()
  })

  it('sem professionalId (qualquer um), atribui o primeiro profissional livre', async () => {
    mockAppointments = [{ date, duration, professionalId: 'p1' }]
    const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

    const result = await resolveProfessionalForBooking({ scheduleId, date, duration })

    expect(result).toEqual({ professionalId: 'p2' })
  })

  it('sem professionalId, rejeita quando todos os profissionais vinculados estão ocupados', async () => {
    mockAppointments = [
      { date, duration, professionalId: 'p1' },
      { date, duration, professionalId: 'p2' },
      { date, duration, professionalId: 'p3' },
    ]
    const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

    const result = await resolveProfessionalForBooking({ scheduleId, date, duration })

    expect(result.professionalId).toBeNull()
    expect(result.error).toBeDefined()
  })
})

// resolveBookingTarget é o que substitui a escolha manual de agenda pelo
// cliente: dado só o serviceId, encontra a agenda candidata certa (e o
// profissional) — inclusive quando o serviço está em mais de uma agenda e a
// primeira já está ocupada nesse horário.
describe('resolveBookingTarget', () => {
  const userId = 'tenant-a'
  const serviceId = 'service-1'

  it('retorna erro quando o serviço não está em nenhuma agenda', async () => {
    mockCandidateScheduleIds = []
    const { resolveBookingTarget } = await import('@/lib/appointment-service')

    const result = await resolveBookingTarget({ userId, serviceId, date, duration })

    expect(result.scheduleId).toBeNull()
    expect(result.error).toBeDefined()
  })

  it('com uma única agenda candidata livre, resolve agenda e profissional', async () => {
    const { resolveBookingTarget } = await import('@/lib/appointment-service')

    const result = await resolveBookingTarget({ userId, serviceId, date, duration })

    expect(result).toEqual({ scheduleId: 'schedule-1', professionalId: 'p1' })
  })

  it('quando a primeira agenda candidata está lotada, tenta a próxima', async () => {
    mockCandidateScheduleIds = ['schedule-1', 'schedule-2']
    mockProfessionalsBySchedule['schedule-2'] = [{ professionalId: 'q1' }]
    // schedule-1 lotada (os 3 profissionais ocupados nesse horário)
    mockAppointments = [
      { scheduleId: 'schedule-1', date, duration, professionalId: 'p1' },
      { scheduleId: 'schedule-1', date, duration, professionalId: 'p2' },
      { scheduleId: 'schedule-1', date, duration, professionalId: 'p3' },
    ]
    const { resolveBookingTarget } = await import('@/lib/appointment-service')

    const result = await resolveBookingTarget({ userId, serviceId, date, duration })

    expect(result).toEqual({ scheduleId: 'schedule-2', professionalId: 'q1' })
  })

  it('retorna erro quando todas as agendas candidatas estão lotadas', async () => {
    mockAppointments = [
      { scheduleId: 'schedule-1', date, duration, professionalId: 'p1' },
      { scheduleId: 'schedule-1', date, duration, professionalId: 'p2' },
      { scheduleId: 'schedule-1', date, duration, professionalId: 'p3' },
    ]
    const { resolveBookingTarget } = await import('@/lib/appointment-service')

    const result = await resolveBookingTarget({ userId, serviceId, date, duration })

    expect(result.scheduleId).toBeNull()
    expect(result.error).toBeDefined()
  })
})
