import { prisma } from '@/lib/db'
import { hashConfirmationToken, isValidTokenShape } from '@/lib/confirmation-token'
import { cancelAppointmentAsClient, confirmAppointmentAsClient, isCancellableByClient } from '@/lib/appointment-service'
import { NotificationService } from '@/lib/notification-service'

export type ConfirmationPageState =
  | 'ACTIONABLE'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'CANCEL_REQUESTED'
  | 'PAST'
  | 'UNAVAILABLE'
  | 'INVALID'

/**
 * DTO estrito para a página pública /c/[token]. NUNCA adicione campos aqui
 * sem revisar — é a única coisa que a página pode renderizar, e o token não
 * deve vazar appointmentId, telefone, preço, notas ou outros agendamentos.
 */
export interface ConfirmationView {
  state: ConfirmationPageState
  businessName: string
  businessLogo: string | null
  clientFirstName: string
  serviceName: string
  professionalFirstName: string | null
  dateISO: string
  durationMinutes: number
  canConfirm: boolean
  canCancel: boolean
  cancelBlockedReason: 'DISABLED' | 'WINDOW' | null
  cancellationHours: number
}

function firstName(fullName: string | null | undefined): string {
  return (fullName || '').trim().split(/\s+/)[0] || ''
}

const INVALID_VIEW: ConfirmationView = {
  state: 'INVALID',
  businessName: '',
  businessLogo: null,
  clientFirstName: '',
  serviceName: '',
  professionalFirstName: null,
  dateISO: '',
  durationMinutes: 0,
  canConfirm: false,
  canCancel: false,
  cancelBlockedReason: null,
  cancellationHours: 0,
}

async function loadConfirmationRecord(token: string) {
  if (!isValidTokenShape(token)) return null

  const tokenHash = hashConfirmationToken(token)
  const confirmation = await prisma.appointmentConfirmation.findUnique({
    where: { tokenHash },
    include: {
      appointment: {
        include: {
          client: { select: { name: true, phone: true } },
          service: { select: { name: true } },
          professionalUser: { select: { name: true } },
          user: {
            select: {
              businessName: true,
              businessConfig: {
                select: { businessLogo: true, allowClientCancellation: true, cancellationHours: true },
              },
            },
          },
        },
      },
    },
  })

  return confirmation
}

function buildView(
  confirmation: NonNullable<Awaited<ReturnType<typeof loadConfirmationRecord>>>
): ConfirmationView {
  const { appointment } = confirmation
  const businessConfig = appointment.user.businessConfig
  const cancellationHours = businessConfig?.cancellationHours ?? 24

  let state: ConfirmationPageState
  if (appointment.deletedAt) {
    state = 'UNAVAILABLE'
  } else if (confirmation.outcome === 'CANCEL_REQUESTED') {
    state = 'CANCEL_REQUESTED'
  } else if (appointment.status === 'CANCELLED') {
    state = 'CANCELLED'
  } else if (appointment.confirmedAt) {
    state = 'CONFIRMED'
  } else if (appointment.date.getTime() < Date.now()) {
    state = 'PAST'
  } else if (appointment.status === 'COMPLETED' || appointment.status === 'NO_SHOW') {
    state = 'UNAVAILABLE'
  } else {
    state = 'ACTIONABLE'
  }

  const canCancel =
    (state === 'ACTIONABLE' || state === 'CONFIRMED') &&
    isCancellableByClient(appointment, businessConfig ? { allowClientCancellation: businessConfig.allowClientCancellation, cancellationHours: businessConfig.cancellationHours } : null)

  let cancelBlockedReason: 'DISABLED' | 'WINDOW' | null = null
  if ((state === 'ACTIONABLE' || state === 'CONFIRMED') && !canCancel) {
    cancelBlockedReason = businessConfig?.allowClientCancellation ? 'WINDOW' : 'DISABLED'
  }

  return {
    state,
    businessName: appointment.user.businessName || 'o negócio',
    businessLogo: businessConfig?.businessLogo || null,
    clientFirstName: firstName(appointment.client.name),
    serviceName: appointment.service?.name || appointment.specialty || 'Agendamento',
    professionalFirstName: appointment.professionalUser?.name ? firstName(appointment.professionalUser.name) : null,
    dateISO: appointment.date.toISOString(),
    durationMinutes: appointment.duration,
    canConfirm: state === 'ACTIONABLE',
    canCancel,
    cancelBlockedReason,
    cancellationHours,
  }
}

export async function resolveConfirmationView(token: string): Promise<ConfirmationView> {
  const confirmation = await loadConfirmationRecord(token)
  if (!confirmation) return INVALID_VIEW
  return buildView(confirmation)
}

export interface ConfirmByTokenResult {
  ok: boolean
  view: ConfirmationView
  error?: string
}

export async function confirmByToken(token: string): Promise<ConfirmByTokenResult> {
  const confirmation = await loadConfirmationRecord(token)
  if (!confirmation) return { ok: false, view: INVALID_VIEW, error: 'Link inválido' }

  const view = buildView(confirmation)
  if (view.state !== 'ACTIONABLE') {
    // Idempotente: já confirmado/cancelado/expirado — devolve o estado atual, sem erro.
    return { ok: view.state === 'CONFIRMED', view }
  }

  const result = await confirmAppointmentAsClient({
    tenantId: confirmation.userId,
    appointmentId: confirmation.appointmentId,
  })

  if (!result.success) {
    return { ok: false, view, error: result.error }
  }

  await prisma.appointmentConfirmation.update({
    where: { id: confirmation.id },
    data: { outcome: 'CONFIRMED', respondedAt: new Date() },
  })

  const updated = await loadConfirmationRecord(token)
  return { ok: true, view: updated ? buildView(updated) : view }
}

export interface CancelByTokenResult {
  ok: boolean
  requestedOnly: boolean
  view: ConfirmationView
  error?: string
}

export async function cancelByToken(token: string, reason: string): Promise<CancelByTokenResult> {
  const confirmation = await loadConfirmationRecord(token)
  if (!confirmation) return { ok: false, requestedOnly: false, view: INVALID_VIEW, error: 'Link inválido' }

  const view = buildView(confirmation)
  if (view.state !== 'ACTIONABLE' && view.state !== 'CONFIRMED') {
    return { ok: false, requestedOnly: false, view, error: 'Este agendamento não pode mais ser alterado' }
  }

  const trimmedReason = reason.trim().slice(0, 280) || undefined

  const result = await cancelAppointmentAsClient({
    tenantId: confirmation.userId,
    phone: confirmation.appointment.client.phone,
    appointmentId: confirmation.appointmentId,
    reason: trimmedReason,
  })

  if (result.success) {
    await prisma.appointmentConfirmation.update({
      where: { id: confirmation.id },
      data: { outcome: 'CANCELLED', respondedAt: new Date(), cancellationReason: trimmedReason || null },
    })
    const updated = await loadConfirmationRecord(token)
    return { ok: true, requestedOnly: false, view: updated ? buildView(updated) : view }
  }

  const isPolicyBlock = result.code === 'POLICY_DISABLED' || result.code === 'POLICY_WINDOW'
  if (!isPolicyBlock) {
    return { ok: false, requestedOnly: false, view, error: result.error }
  }

  // Bloqueado pela política do negócio (self-cancel off ou fora da janela) —
  // nunca é um dead-end: registra o pedido e avisa o dono para resolver na mão.
  await prisma.appointmentConfirmation.update({
    where: { id: confirmation.id },
    data: { outcome: 'CANCEL_REQUESTED', respondedAt: new Date(), cancellationReason: trimmedReason || null },
  })

  try {
    await NotificationService.notifyCancellationRequested(
      confirmation.userId,
      confirmation.appointmentId,
      confirmation.appointment.client.name,
      confirmation.appointment.service?.name || confirmation.appointment.specialty || 'Agendamento',
      confirmation.appointment.date,
      trimmedReason
    )
  } catch (error) {
    console.error('[cancelByToken] Erro ao notificar pedido de cancelamento:', error)
  }

  const updated = await loadConfirmationRecord(token)
  return { ok: true, requestedOnly: true, view: updated ? buildView(updated) : view }
}
