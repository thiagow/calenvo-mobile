import { describe, it, expect, vi, beforeEach } from 'vitest'

// resolveProfessionalForBooking é o único lugar que decide qual profissional fica
// com um novo agendamento — usado por booking público, chat de IA, dashboard e API
// v1. Antes, cada rota fazia sua própria checagem solta e nenhuma delas atribuía
// um profissional concreto quando o cliente não tinha preferência, então uma
// agenda com N profissionais nunca aproveitava a capacidade de tê-los livres em
// paralelo.
let mockAppointments: any[] = []

vi.mock('@/lib/db', () => ({
  prisma: {
    schedule: {
      findUnique: vi.fn(async () => ({
        professionals: [{ professionalId: 'p1' }, { professionalId: 'p2' }, { professionalId: 'p3' }],
      })),
    },
    appointment: {
      findMany: vi.fn(async ({ where }: any) =>
        mockAppointments.filter((a) => !where.professionalId || a.professionalId === where.professionalId)
      ),
    },
  },
}))

beforeEach(() => {
  mockAppointments = []
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
