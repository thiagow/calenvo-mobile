import { prisma } from '@/lib/db'
import { enqueueAccountJobs, type DispatchJob } from '@/lib/whatsapp-dispatch-queue'
import {
  REACTIVATION_RULES,
  bookingLink,
  listReactivationItems,
  type ReactivationItem,
  type TenantScope,
} from '@/lib/reactivation-service'
import { buildReactivationVars, pickTemplate, renderTemplate } from '@/lib/message-template'

export { pickTemplate }

export interface SendItem {
  clientId: string
  serviceId: string
}

export interface SendRequest {
  items: SendItem[]
  /** Força um template para todos os itens; sem ele, vale o template de cada serviço. */
  templateId?: string | null
  /** Reenvia mesmo para quem foi avisado nos últimos RESEND_COOLDOWN_DAYS dias. */
  force?: boolean
}

export type SendResult =
  | { ok: true; queued: number; skippedRecent: number; skippedIneligible: number }
  | { ok: false; status: number; error: string }

/**
 * Enfileira lembretes de retorno. A elegibilidade é RECALCULADA aqui — a lista
 * que veio do navegador só diz "quais pares o dono marcou", nunca é confiada
 * como verdade (pode estar velha, ou forjada com ids de outro tenant).
 */
export async function queueReactivationMessages(scope: TenantScope, request: SendRequest): Promise<SendResult> {
  if (!scope.isMaster) return { ok: false, status: 403, error: 'Apenas administradores podem enviar' }

  const [whatsApp, owner, templates] = await Promise.all([
    prisma.whatsAppConfig.findUnique({
      where: { userId: scope.tenantId },
      select: { isConnected: true, apiKey: true },
    }),
    prisma.user.findUnique({
      where: { id: scope.tenantId },
      select: { businessName: true, name: true, businessConfig: { select: { publicUrl: true } } },
    }),
    prisma.messageTemplate.findMany({
      where: { userId: scope.tenantId, kind: 'REACTIVATION' },
      select: { id: true, body: true, isDefault: true },
    }),
  ])

  if (!whatsApp?.isConnected || !whatsApp.apiKey) {
    return { ok: false, status: 409, error: 'Conecte o WhatsApp em Canais de atendimento para enviar lembretes' }
  }
  if (request.templateId && !templates.some(t => t.id === request.templateId)) {
    return { ok: false, status: 404, error: 'Modelo de mensagem não encontrado' }
  }

  const eligible = new Map(
    (await listReactivationItems(scope)).map(item => [`${item.clientId}:${item.serviceId}`, item])
  )

  const requested = Array.from(new Set(request.items.map(i => `${i.clientId}:${i.serviceId}`)))
  const toSend: ReactivationItem[] = []
  let skippedRecent = 0
  let skippedIneligible = 0

  for (const key of requested) {
    const item = eligible.get(key)
    if (!item) skippedIneligible++
    else if (item.recentlyNotified && !request.force) skippedRecent++
    else toSend.push(item)
  }

  if (toSend.length === 0) return { ok: true, queued: 0, skippedRecent, skippedIneligible }

  const businessName = owner?.businessName || owner?.name || ''
  const link = bookingLink(scope.tenantId, owner?.businessConfig?.publicUrl)

  // Mensagens do mesmo cliente ficam adjacentes na fila, na ordem de urgência
  // em que o cliente aparece pela primeira vez.
  const byClient = new Map<string, ReactivationItem[]>()
  for (const item of toSend) byClient.set(item.clientId, [...(byClient.get(item.clientId) ?? []), item])
  const ordered = Array.from(byClient.values()).flat()

  const created = await prisma.$transaction(
    ordered.map(item => {
      const { templateId, body } = pickTemplate(item, templates, request.templateId)
      return prisma.reactivationMessage.create({
        data: {
          userId: scope.tenantId,
          clientId: item.clientId,
          serviceId: item.serviceId,
          templateId,
          renderedBody: renderTemplate(body, buildReactivationVars(item, businessName, link)),
        },
        select: { id: true },
      })
    })
  )

  const jobs: DispatchJob[] = created.map(m => ({ kind: 'reactivation', messageId: m.id }))
  const queued = await enqueueAccountJobs(jobs)

  if (queued === 0) {
    await prisma.reactivationMessage.updateMany({
      where: { id: { in: created.map(m => m.id) } },
      data: { status: 'FAILED', error: 'Fila de envio indisponível' },
    })
    return { ok: false, status: 503, error: 'Fila de envio indisponível no momento. Tente novamente em instantes.' }
  }

  return { ok: true, queued, skippedRecent, skippedIneligible }
}

export const MAX_ITEMS_PER_SEND = REACTIVATION_RULES.MAX_ITEMS_PER_SEND
