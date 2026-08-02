import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// verifySignatureAppRouter só valida a assinatura do QStash — isso é
// responsabilidade da própria lib da Upstash, não do nosso código. Aqui
// testamos o handler por baixo, então o mock vira um passthrough.
vi.mock('@upstash/qstash/nextjs', () => ({
  verifySignatureAppRouter: (fn: any) => fn,
}))

let mockAppointment: any
const confirmationCreateCalls: any[] = []
const confirmationUpdateCalls: any[] = []
const confirmationDeleteCalls: any[] = []
let confirmationCreateShouldFail = false
let confirmationRequestSendResult = true
const reminderCalls: any[] = []

vi.mock('@/lib/db', () => ({
  prisma: {
    appointment: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (!mockAppointment) return null
        if (where.id !== mockAppointment.id) return null
        if (Array.isArray(where.status?.in) && !where.status.in.includes(mockAppointment.status)) return null
        if (where.status && typeof where.status === 'string' && where.status !== mockAppointment.status) return null
        if (mockAppointment.deletedAt) return null
        return mockAppointment
      }),
    },
    appointmentConfirmation: {
      create: vi.fn(async (args: any) => {
        confirmationCreateCalls.push(args)
        if (confirmationCreateShouldFail) throw new Error('Unique constraint failed')
        return { id: 'conf-1', ...args.data }
      }),
      update: vi.fn(async (args: any) => {
        confirmationUpdateCalls.push(args)
        return args
      }),
      delete: vi.fn(async (args: any) => {
        confirmationDeleteCalls.push(args)
        return args
      }),
    },
  },
}))

vi.mock('@/lib/whatsapp-trigger', () => ({
  WhatsAppTriggerService: {
    onAppointmentReminder: vi.fn(async (...args: any[]) => {
      reminderCalls.push(args)
    }),
    onAppointmentConfirmationRequest: vi.fn(async () => confirmationRequestSendResult),
  },
}))

function makeRequest(body: any) {
  return new NextRequest('http://localhost/api/internal/dispatch-whatsapp', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  confirmationCreateCalls.length = 0
  confirmationUpdateCalls.length = 0
  confirmationDeleteCalls.length = 0
  confirmationCreateShouldFail = false
  confirmationRequestSendResult = true
  reminderCalls.length = 0
  mockAppointment = {
    id: 'appt-1',
    userId: 'tenant-a',
    status: 'SCHEDULED',
    date: new Date(Date.now() + 24 * 60 * 60 * 1000),
    deletedAt: null,
    specialty: null,
    client: { name: 'João', phone: '5511999999999' },
    service: { name: 'Corte' },
    professionalUser: { name: 'Maria' },
  }
})

describe('POST /api/internal/dispatch-whatsapp', () => {
  it('job inválido (sem kind/appointmentId) → 400', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('confirmation-request: cria o claim, envia, e marca sentAt', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ kind: 'confirmation-request', appointmentId: 'appt-1' }))

    expect(res.status).toBe(200)
    expect(confirmationCreateCalls).toHaveLength(1)
    expect(confirmationUpdateCalls).toHaveLength(1)
    expect(confirmationUpdateCalls[0].data.sentAt).toBeInstanceOf(Date)
    expect(confirmationDeleteCalls).toHaveLength(0)
  })

  it('confirmation-request: já reivindicado por outro job (P2002) → não envia', async () => {
    confirmationCreateShouldFail = true
    const { WhatsAppTriggerService } = await import('@/lib/whatsapp-trigger')
    const { POST } = await import('./route')

    await POST(makeRequest({ kind: 'confirmation-request', appointmentId: 'appt-1' }))

    expect(WhatsAppTriggerService.onAppointmentConfirmationRequest).not.toHaveBeenCalled()
  })

  it('confirmation-request: falha no envio → libera o claim (delete) pro próximo disparo', async () => {
    confirmationRequestSendResult = false
    const { POST } = await import('./route')

    await POST(makeRequest({ kind: 'confirmation-request', appointmentId: 'appt-1' }))

    expect(confirmationCreateCalls).toHaveLength(1)
    expect(confirmationDeleteCalls).toHaveLength(1)
    expect(confirmationUpdateCalls).toHaveLength(0)
  })

  it('confirmation-request: agendamento não está mais SCHEDULED → não faz nada', async () => {
    mockAppointment.status = 'CANCELLED'
    const { POST } = await import('./route')

    const res = await POST(makeRequest({ kind: 'confirmation-request', appointmentId: 'appt-1' }))

    expect(res.status).toBe(200)
    expect(confirmationCreateCalls).toHaveLength(0)
  })

  it('reminder: agendamento ainda aberto → dispara o lembrete', async () => {
    const { POST } = await import('./route')

    await POST(makeRequest({ kind: 'reminder', appointmentId: 'appt-1' }))

    expect(reminderCalls).toHaveLength(1)
  })

  it('reminder: agendamento cancelado nesse meio-tempo → não dispara', async () => {
    mockAppointment.status = 'CANCELLED'
    const { POST } = await import('./route')

    const res = await POST(makeRequest({ kind: 'reminder', appointmentId: 'appt-1' }))

    expect(res.status).toBe(200)
    expect(reminderCalls).toHaveLength(0)
  })
})
