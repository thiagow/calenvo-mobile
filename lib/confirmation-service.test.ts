import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateConfirmationToken } from '@/lib/confirmation-token'

// Fixture compartilhado: `appointment` é a MESMA referência usada dentro de
// `confirmation.appointment`, então mutações feitas via prisma.appointment.update
// (chamado por confirmAppointmentAsClient/cancelAppointmentAsClient) aparecem
// imediatamente na próxima leitura de resolveConfirmationView/confirmByToken.
let appointment: any
let confirmation: any
let businessConfigMock: any
const notifyCancellationRequestedCalls: any[] = []

vi.mock('@/lib/db', () => ({
  prisma: {
    appointmentConfirmation: {
      findUnique: vi.fn(async ({ where }: any) => (confirmation?.tokenHash === where.tokenHash ? confirmation : null)),
      update: vi.fn(async ({ data }: any) => {
        Object.assign(confirmation, data)
        return confirmation
      }),
    },
    appointment: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (!appointment) return null
        if (where.id !== appointment.id || where.userId !== appointment.userId) return null
        if (appointment.deletedAt) return null
        return appointment
      }),
      update: vi.fn(async ({ data }: any) => {
        Object.assign(appointment, data)
        return appointment
      }),
    },
    businessConfig: {
      findUnique: vi.fn(async () => businessConfigMock),
    },
  },
}))

vi.mock('@/lib/notification-service', () => ({
  NotificationService: {
    notifyAppointmentConfirmed: vi.fn(async () => {}),
    notifyAppointmentCancelled: vi.fn(async () => {}),
    notifyCancellationRequested: vi.fn(async (...args: any[]) => {
      notifyCancellationRequestedCalls.push(args)
    }),
  },
}))

vi.mock('@/lib/whatsapp-trigger', () => ({
  WhatsAppTriggerService: {
    onAppointmentCancelled: vi.fn(async () => {}),
    onAppointmentCancelledByClient: vi.fn(async () => {}),
  },
}))

const ALLOWED_VIEW_KEYS = [
  'state',
  'businessName',
  'businessLogo',
  'clientFirstName',
  'serviceName',
  'professionalFirstName',
  'dateISO',
  'durationMinutes',
  'canConfirm',
  'canCancel',
  'cancelBlockedReason',
  'cancellationHours',
].sort()

function makeFixture(overrides: { status?: string; date?: Date; deletedAt?: Date | null } = {}) {
  appointment = {
    id: 'appt-1',
    userId: 'tenant-a',
    status: overrides.status ?? 'SCHEDULED',
    date: overrides.date ?? new Date(Date.now() + 48 * 60 * 60 * 1000),
    duration: 30,
    deletedAt: overrides.deletedAt ?? null,
    confirmedAt: null,
    specialty: null,
    client: { name: 'João Silva', phone: '5511999999999' },
    service: { name: 'Corte' },
    professionalUser: { name: 'Maria Souza' },
    user: {
      businessName: 'Barbearia Exemplo',
      businessConfig: { businessLogo: null, allowClientCancellation: true, cancellationHours: 24 },
    },
  }

  const { tokenHash } = generateConfirmationToken()
  confirmation = {
    id: 'conf-1',
    appointmentId: 'appt-1',
    userId: 'tenant-a',
    tokenHash,
    outcome: 'PENDING',
    respondedAt: null,
    cancellationReason: null,
    appointment,
  }

  businessConfigMock = { allowClientCancellation: true, cancellationHours: 24 }

  return { tokenHash }
}

beforeEach(() => {
  notifyCancellationRequestedCalls.length = 0
})

describe('resolveConfirmationView', () => {
  it('token com shape inválido → INVALID sem consultar o banco', async () => {
    const { resolveConfirmationView } = await import('@/lib/confirmation-service')
    const { prisma } = await import('@/lib/db')

    const view = await resolveConfirmationView('token-invalido')

    expect(view.state).toBe('INVALID')
    expect((prisma.appointmentConfirmation.findUnique as any)).not.toHaveBeenCalled()
  })

  it('token válido mas inexistente no banco → INVALID', async () => {
    makeFixture()
    const { resolveConfirmationView } = await import('@/lib/confirmation-service')

    const view = await resolveConfirmationView(generateConfirmationToken().token)

    expect(view.state).toBe('INVALID')
  })

  it('agendamento apagado (soft delete) → UNAVAILABLE', async () => {
    makeFixture({ deletedAt: new Date() })
    const { token, tokenHash } = generateConfirmationToken()
    confirmation.tokenHash = tokenHash

    const { resolveConfirmationView } = await import('@/lib/confirmation-service')
    const view = await resolveConfirmationView(token)

    expect(view.state).toBe('UNAVAILABLE')
  })

  it('data futura, sem resposta ainda → ACTIONABLE', async () => {
    makeFixture()
    const { token, tokenHash } = generateConfirmationToken()
    confirmation.tokenHash = tokenHash

    const { resolveConfirmationView } = await import('@/lib/confirmation-service')
    const view = await resolveConfirmationView(token)

    expect(view.state).toBe('ACTIONABLE')
    expect(view.canConfirm).toBe(true)
  })

  it('data já passada e nunca respondida → PAST', async () => {
    makeFixture({ date: new Date(Date.now() - 60 * 60 * 1000) })
    const { token, tokenHash } = generateConfirmationToken()
    confirmation.tokenHash = tokenHash

    const { resolveConfirmationView } = await import('@/lib/confirmation-service')
    const view = await resolveConfirmationView(token)

    expect(view.state).toBe('PAST')
  })

  it('canCancel é false quando allowClientCancellation está desligado (cancelBlockedReason=DISABLED)', async () => {
    makeFixture()
    appointment.user.businessConfig.allowClientCancellation = false
    businessConfigMock.allowClientCancellation = false
    const { token, tokenHash } = generateConfirmationToken()
    confirmation.tokenHash = tokenHash

    const { resolveConfirmationView } = await import('@/lib/confirmation-service')
    const view = await resolveConfirmationView(token)

    expect(view.canCancel).toBe(false)
    expect(view.cancelBlockedReason).toBe('DISABLED')
  })

  it('canCancel é false fora da janela de cancellationHours (cancelBlockedReason=WINDOW)', async () => {
    // agendamento em 2h, mas a política exige 24h de antecedência
    makeFixture({ date: new Date(Date.now() + 2 * 60 * 60 * 1000) })
    const { token, tokenHash } = generateConfirmationToken()
    confirmation.tokenHash = tokenHash

    const { resolveConfirmationView } = await import('@/lib/confirmation-service')
    const view = await resolveConfirmationView(token)

    expect(view.canCancel).toBe(false)
    expect(view.cancelBlockedReason).toBe('WINDOW')
  })

  it('guard de vazamento: a view nunca expõe campos além do allowlist', async () => {
    makeFixture()
    const { token, tokenHash } = generateConfirmationToken()
    confirmation.tokenHash = tokenHash

    const { resolveConfirmationView } = await import('@/lib/confirmation-service')
    const view = await resolveConfirmationView(token)

    expect(Object.keys(view).sort()).toEqual(ALLOWED_VIEW_KEYS)
  })
})

describe('cancelByToken', () => {
  it('bloqueado pela política → CANCEL_REQUESTED, agendamento não é tocado, dono é notificado', async () => {
    makeFixture()
    appointment.user.businessConfig.allowClientCancellation = false
    businessConfigMock.allowClientCancellation = false
    const { token, tokenHash } = generateConfirmationToken()
    confirmation.tokenHash = tokenHash

    const { cancelByToken } = await import('@/lib/confirmation-service')
    const result = await cancelByToken(token, 'Imprevisto')

    expect(result.requestedOnly).toBe(true)
    expect(result.view.state).toBe('CANCEL_REQUESTED')
    expect(appointment.status).toBe('SCHEDULED') // não mudou
    expect(notifyCancellationRequestedCalls).toHaveLength(1)
  })

  it('dentro da política → cancela de verdade, sem CANCEL_REQUESTED', async () => {
    makeFixture()
    const { token, tokenHash } = generateConfirmationToken()
    confirmation.tokenHash = tokenHash

    const { cancelByToken } = await import('@/lib/confirmation-service')
    const result = await cancelByToken(token, 'Vou remarcar')

    expect(result.requestedOnly).toBe(false)
    expect(result.view.state).toBe('CANCELLED')
    expect(appointment.status).toBe('CANCELLED')
    expect(notifyCancellationRequestedCalls).toHaveLength(0)
  })
})

describe('confirmByToken', () => {
  it('confirma uma vez, e uma segunda chamada é idempotente (não-op)', async () => {
    makeFixture()
    const { token, tokenHash } = generateConfirmationToken()
    confirmation.tokenHash = tokenHash

    const { confirmByToken } = await import('@/lib/confirmation-service')
    const first = await confirmByToken(token)
    expect(first.ok).toBe(true)
    expect(first.view.state).toBe('CONFIRMED')

    const second = await confirmByToken(token)
    expect(second.ok).toBe(true)
    expect(second.view.state).toBe('CONFIRMED')
  })
})
