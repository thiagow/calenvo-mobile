import { describe, it, expect, vi, beforeEach } from 'vitest'

// confirmAppointmentAsClient é o espelho de cancelAppointmentAsClient para o
// fluxo de link de confirmação: resolvido via token (não telefone), precisa
// ser idempotente (double-tap do link, reenvio de request) e nunca deixar uma
// falha de notificação derrubar uma confirmação que já aconteceu no banco.

let mockAppointment: any = null
const updateCalls: any[] = []
const notifyCalls: any[] = []

vi.mock('@/lib/db', () => ({
  prisma: {
    appointment: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (!mockAppointment) return null
        if (where.id !== mockAppointment.id) return null
        if (where.userId !== mockAppointment.userId) return null
        return mockAppointment
      }),
      update: vi.fn(async ({ where, data }: any) => {
        updateCalls.push({ where, data })
        mockAppointment = { ...mockAppointment, ...data }
        return mockAppointment
      }),
    },
    businessConfig: {
      findUnique: vi.fn(async () => null),
    },
  },
}))

vi.mock('@/lib/notification-service', () => ({
  NotificationService: {
    notifyAppointmentConfirmed: vi.fn(async (...args: any[]) => {
      notifyCalls.push(args)
    }),
    notifyAppointmentCancelled: vi.fn(async () => {}),
    notifyCancellationRequested: vi.fn(async () => {}),
  },
}))

vi.mock('@/lib/whatsapp-trigger', () => ({
  WhatsAppTriggerService: {
    onAppointmentCancelled: vi.fn(async () => {}),
    onAppointmentCancelledByClient: vi.fn(async () => {}),
  },
}))

beforeEach(() => {
  updateCalls.length = 0
  notifyCalls.length = 0
  mockAppointment = {
    id: 'appt-1',
    userId: 'tenant-a',
    status: 'SCHEDULED',
    date: new Date(Date.now() + 24 * 60 * 60 * 1000), // amanhã
    duration: 30,
    specialty: null,
    client: { name: 'João Silva', phone: '5511999999999' },
    service: { name: 'Corte' },
    professionalUser: { name: 'Maria' },
  }
})

describe('confirmAppointmentAsClient', () => {
  it('agendamento de outro tenant → não encontrado', async () => {
    const { confirmAppointmentAsClient } = await import('@/lib/appointment-service')

    const result = await confirmAppointmentAsClient({ tenantId: 'outro-tenant', appointmentId: 'appt-1' })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(updateCalls).toHaveLength(0)
  })

  it('já CONFIRMED → idempotente, não chama update nem notifica de novo', async () => {
    mockAppointment.status = 'CONFIRMED'
    const { confirmAppointmentAsClient } = await import('@/lib/appointment-service')

    const result = await confirmAppointmentAsClient({ tenantId: 'tenant-a', appointmentId: 'appt-1' })

    expect(result).toEqual({ success: true, alreadyConfirmed: true })
    expect(updateCalls).toHaveLength(0)
    expect(notifyCalls).toHaveLength(0)
  })

  it('CANCELLED → erro, não pode mais confirmar', async () => {
    mockAppointment.status = 'CANCELLED'
    const { confirmAppointmentAsClient } = await import('@/lib/appointment-service')

    const result = await confirmAppointmentAsClient({ tenantId: 'tenant-a', appointmentId: 'appt-1' })

    expect(result.success).toBe(false)
    expect(updateCalls).toHaveLength(0)
  })

  it('COMPLETED → erro, não pode mais confirmar', async () => {
    mockAppointment.status = 'COMPLETED'
    const { confirmAppointmentAsClient } = await import('@/lib/appointment-service')

    const result = await confirmAppointmentAsClient({ tenantId: 'tenant-a', appointmentId: 'appt-1' })

    expect(result.success).toBe(false)
    expect(updateCalls).toHaveLength(0)
  })

  it('data já passada → erro mesmo com status aberto', async () => {
    mockAppointment.date = new Date(Date.now() - 60 * 60 * 1000)
    const { confirmAppointmentAsClient } = await import('@/lib/appointment-service')

    const result = await confirmAppointmentAsClient({ tenantId: 'tenant-a', appointmentId: 'appt-1' })

    expect(result.success).toBe(false)
    expect(updateCalls).toHaveLength(0)
  })

  it('caminho feliz: confirma, seta confirmedAt e notifica uma vez', async () => {
    const { confirmAppointmentAsClient } = await import('@/lib/appointment-service')

    const result = await confirmAppointmentAsClient({ tenantId: 'tenant-a', appointmentId: 'appt-1' })

    expect(result).toEqual({ success: true })
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0].data.status).toBe('CONFIRMED')
    expect(updateCalls[0].data.confirmedAt).toBeInstanceOf(Date)
    expect(notifyCalls).toHaveLength(1)
  })

  it('falha ao notificar não derruba o sucesso da confirmação', async () => {
    const { NotificationService } = await import('@/lib/notification-service')
    ;(NotificationService.notifyAppointmentConfirmed as any).mockRejectedValueOnce(new Error('boom'))

    const { confirmAppointmentAsClient } = await import('@/lib/appointment-service')
    const result = await confirmAppointmentAsClient({ tenantId: 'tenant-a', appointmentId: 'appt-1' })

    expect(result.success).toBe(true)
    expect(updateCalls).toHaveLength(1)
  })
})
