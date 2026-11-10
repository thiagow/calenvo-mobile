import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Regressão: GET/PUT/DELETE de /api/appointments/[id] filtravam por
// `userId: session.user.id`. Agendamentos pertencem ao MASTER, então todo
// PROFESSIONAL recebia 404 — inclusive ao concluir o próprio atendimento.

let mockUser: { id: string; role: string; masterId?: string } = { id: 'master-1', role: 'MASTER' }

const { db } = vi.hoisted(() => {
  const existing = {
    id: 'appt-1',
    userId: 'master-1',
    professionalId: 'pro-1',
    clientId: 'client-1',
    status: 'SCHEDULED',
    date: new Date('2099-01-10T13:00:00.000Z'),
    duration: 30,
    scheduleId: 'sched-1',
    clientPackageItemId: null
  }
  const updated = {
    ...existing,
    serviceId: null,
    specialty: null,
    modality: 'PRESENCIAL',
    insurance: null,
    notes: null,
    professional: null,
    price: null,
    client: { id: 'client-1', name: 'Ana', email: null, phone: '11999999999' },
    service: null,
    user: { businessName: 'Studio', whatsappConfig: null }
  }
  return {
    db: {
      existing,
      updated,
      appointment: {
        findFirst: vi.fn(async (_args: unknown) => updated as unknown),
        update: vi.fn(async (_args: unknown) => updated as unknown)
      },
      user: { findUnique: vi.fn(async (_args: unknown) => ({ canForceOverbook: false }) as unknown) },
      businessConfig: { findUnique: vi.fn(async (_args: unknown) => ({ timezone: 'America/Sao_Paulo' }) as unknown) },
      clientPackageItem: { findMany: vi.fn(async () => []) },
      notification: { create: vi.fn() }
    }
  }
})

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: mockUser })) }))
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }))
vi.mock('@/lib/db', () => ({ prisma: db }))
vi.mock('@/lib/notification-service', () => ({
  NotificationService: { notifyAppointmentCompleted: vi.fn(), notifyAppointmentConfirmed: vi.fn() }
}))
vi.mock('@/lib/whatsapp-trigger', () => ({ WhatsAppTriggerService: { onAppointmentCompleted: vi.fn() } }))
vi.mock('@/app/actions/packages', () => ({ processPackageDeduction: vi.fn() }))
vi.mock('@/app/actions/loyalty', () => ({ processLoyaltyEarn: vi.fn(async () => ({ success: true, skipped: true })) }))
vi.mock('@/lib/appointment-service', () => ({ checkBookingConflict: vi.fn(), withBookingLock: vi.fn() }))
vi.mock('@/lib/schedule-blocks', () => ({ BLOCKED_DATE_ERROR: 'blocked', isScheduleDateBlocked: vi.fn() }))
vi.mock('@/lib/error-logger', () => ({ logError: vi.fn() }))
vi.mock('@/lib/finance/hooks', () => ({
  onAppointmentCompleted: vi.fn(async () => ({ saleId: 'sale-1' })),
  onAppointmentUncompleted: vi.fn()
}))

import { GET, PUT, DELETE } from './route'
import { processLoyaltyEarn } from '@/app/actions/loyalty'
import { onAppointmentCompleted, onAppointmentUncompleted } from '@/lib/finance/hooks'

const params = { params: { id: 'appt-1' } }

function put(body: Record<string, unknown>) {
  return PUT(
    new NextRequest('http://localhost/api/appointments/appt-1', { method: 'PUT', body: JSON.stringify(body) }),
    params
  )
}

function lastWhere() {
  const calls = db.appointment.findFirst.mock.calls
  return (calls[calls.length - 1][0] as { where: Record<string, unknown> }).where
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = { id: 'master-1', role: 'MASTER' }
})

describe('/api/appointments/[id] — escopo do tenant', () => {
  it('MASTER: busca pelos agendamentos da própria conta, sem filtro de profissional', async () => {
    const res = await GET(new NextRequest('http://localhost/api/appointments/appt-1'), params)
    expect(res.status).toBe(200)
    expect(lastWhere()).toEqual({ id: 'appt-1', userId: 'master-1', deletedAt: null })
  })

  it('PROFESSIONAL: busca na conta do master, restrito aos próprios atendimentos', async () => {
    mockUser = { id: 'pro-1', role: 'PROFESSIONAL', masterId: 'master-1' }
    const res = await GET(new NextRequest('http://localhost/api/appointments/appt-1'), params)
    expect(res.status).toBe(200)
    expect(lastWhere()).toEqual({ id: 'appt-1', userId: 'master-1', deletedAt: null, professionalId: 'pro-1' })
  })

  it('PROFESSIONAL consegue concluir o próprio atendimento; efeitos colaterais usam o tenant', async () => {
    mockUser = { id: 'pro-1', role: 'PROFESSIONAL', masterId: 'master-1' }
    const res = await put({ status: 'COMPLETED' })

    expect(res.status).toBe(200)
    expect(lastWhere()).toMatchObject({ userId: 'master-1', professionalId: 'pro-1' })
    expect(processLoyaltyEarn).toHaveBeenCalledWith('appt-1', 'master-1')
    // Comanda do Financeiro: gancho chamado no tenant, com o profissional como autor
    expect(onAppointmentCompleted).toHaveBeenCalledWith({ tenantId: 'master-1', appointmentId: 'appt-1', actorId: 'pro-1' })
    expect((await res.json()).financeSaleId).toBe('sale-1')
    // Fuso vem do negócio, não do profissional (que não tem BusinessConfig)
    expect(db.businessConfig.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'master-1' } })
    )
  })

  it('PROFESSIONAL sem permissão de encaixe recebe 403 ao forçar encaixe', async () => {
    mockUser = { id: 'pro-1', role: 'PROFESSIONAL', masterId: 'master-1' }
    const res = await put({ date: '2099-01-11', time: '10:00', forceOverbook: true })
    expect(res.status).toBe(403)
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'pro-1' } }))
  })

  it('agendamento de outro profissional (ou de outro tenant) continua 404', async () => {
    mockUser = { id: 'pro-2', role: 'PROFESSIONAL', masterId: 'master-1' }
    db.appointment.findFirst.mockResolvedValueOnce(null)
    const res = await put({ status: 'COMPLETED' })
    expect(res.status).toBe(404)
    expect(db.appointment.update).not.toHaveBeenCalled()
  })

  it('PROFESSIONAL sem master vinculado é recusado (403)', async () => {
    mockUser = { id: 'pro-x', role: 'PROFESSIONAL' }
    const res = await DELETE(new NextRequest('http://localhost/api/appointments/appt-1'), params)
    expect(res.status).toBe(403)
    expect(db.appointment.findFirst).not.toHaveBeenCalled()
  })

  it('tirar de COMPLETED aciona o cancelamento da comanda', async () => {
    db.appointment.findFirst.mockResolvedValueOnce({ ...db.updated, status: 'COMPLETED' })
    const res = await put({ status: 'CONFIRMED' })
    expect(res.status).toBe(200)
    expect(onAppointmentUncompleted).toHaveBeenCalledWith({ tenantId: 'master-1', appointmentId: 'appt-1', actorId: 'master-1' })
    expect(onAppointmentCompleted).not.toHaveBeenCalled()
  })

  it('DELETE do PROFESSIONAL faz exclusão lógica do próprio atendimento', async () => {
    mockUser = { id: 'pro-1', role: 'PROFESSIONAL', masterId: 'master-1' }
    const res = await DELETE(new NextRequest('http://localhost/api/appointments/appt-1'), params)
    expect(res.status).toBe(200)
    expect(lastWhere()).toMatchObject({ userId: 'master-1', professionalId: 'pro-1' })
    expect(db.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: expect.any(Date) } })
    )
  })
})
