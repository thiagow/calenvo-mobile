import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockUser: { id: string; role: string; masterId?: string } = { id: 'tenant-a', role: 'MASTER' }
const { findManyMock } = vi.hoisted(() => ({ findManyMock: vi.fn(async (_args: unknown) => [] as unknown[]) }))

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: mockUser })) }))
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }))
vi.mock('@/lib/notification-service', () => ({ NotificationService: {} }))
vi.mock('@/lib/whatsapp-trigger', () => ({ WhatsAppTriggerService: {} }))
vi.mock('@/lib/plan-limits', () => ({ getRemainingAppointments: vi.fn(), shouldNotifyLimitApproaching: vi.fn() }))
vi.mock('@/lib/appointment-service', () => ({
  checkAppointmentQuota: vi.fn(),
  resolveProfessionalForBooking: vi.fn(),
  withBookingLock: vi.fn(),
}))
vi.mock('@/lib/error-logger', () => ({ logError: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    businessConfig: { findUnique: vi.fn(async () => ({ timezone: 'America/Sao_Paulo' })) },
    appointment: { findMany: findManyMock },
  },
}))

import { GET } from './route'

function get(query: string) {
  return GET(new NextRequest(`http://localhost/api/appointments?${query}`))
}

function whereOf(): Record<string, any> {
  return (findManyMock.mock.calls[0][0] as { where: Record<string, any> }).where
}

beforeEach(() => {
  mockUser = { id: 'tenant-a', role: 'MASTER' }
  findManyMock.mockClear()
})

describe('GET /api/appointments — período e vistas', () => {
  it('lista com período: aplica dateFrom/dateTo (o bug: antes ignorava o período e não filtrava nada)', async () => {
    await get('view=list&currentDate=2026-10-14&dateFrom=2026-11-24&dateTo=2026-11-26')

    expect(whereOf().date.gte.toISOString()).toBe('2026-11-24T03:00:00.000Z')
    expect(whereOf().date.lte.toISOString()).toBe('2026-11-27T02:59:59.999Z')
  })

  it('timeline com período também respeita o intervalo', async () => {
    await get('view=timeline&currentDate=2026-10-14&dateFrom=2026-10-22&dateTo=2026-10-22')

    expect(whereOf().date.gte.toISOString()).toBe('2026-10-22T03:00:00.000Z')
    expect(whereOf().date.lte.toISOString()).toBe('2026-10-23T02:59:59.999Z')
  })

  it('dia/semana/mês com período: interseção (o período não é descartado)', async () => {
    await get('view=month&currentDate=2026-10-14&dateFrom=2026-10-10&dateTo=2026-10-20')

    expect(whereOf().date.gte.toISOString()).toBe('2026-10-10T03:00:00.000Z')
    expect(whereOf().date.lte.toISOString()).toBe('2026-10-21T02:59:59.999Z')
  })

  it('período fora da vista: resposta vazia sem consultar o banco', async () => {
    const res = await get('view=day&currentDate=2026-10-14&dateFrom=2026-11-01&dateTo=2026-11-05')

    expect(await res.json()).toEqual([])
    expect(findManyMock).not.toHaveBeenCalled()
  })

  it('lista sem período: só de hoje em diante; includePast=true libera o histórico', async () => {
    await get('view=list&currentDate=2026-10-14')
    expect(whereOf().date.gte).toBeInstanceOf(Date)
    expect(whereOf().date.lte).toBeUndefined()

    findManyMock.mockClear()
    await get('view=list&currentDate=2026-10-14&includePast=true')
    expect(whereOf().date).toBeUndefined()
  })
})

describe('GET /api/appointments — serviço e profissional', () => {
  it('service filtra por serviceId', async () => {
    await get('view=list&includePast=true&service=svc-1')
    expect(whereOf().serviceId).toBe('svc-1')
  })

  it('professional filtra por professionalId (antes comparava o id com o nome legado e nunca casava)', async () => {
    await get('view=list&includePast=true&professional=pro-1')
    expect(whereOf().professionalId).toBe('pro-1')
    expect(whereOf().professional).toBeUndefined()
  })

  it('profissional logado continua restrito aos próprios agendamentos', async () => {
    mockUser = { id: 'pro-9', role: 'PROFESSIONAL', masterId: 'tenant-a' }
    await get('view=list&includePast=true&professional=outro-pro')

    expect(whereOf().userId).toBe('tenant-a')
    expect(whereOf().professionalId).toBe('pro-9')
  })
})
