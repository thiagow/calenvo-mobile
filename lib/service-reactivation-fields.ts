import { prisma } from '@/lib/db'

export const RETURN_INTERVAL_MAX_DAYS = 730

type FieldsResult =
  | { ok: true; data: { returnIntervalDays?: number | null; reactivationTemplateId?: string | null } }
  | { ok: false; error: string }

/**
 * Valida os campos de reativação vindos do formulário de serviço. Campos
 * ausentes (undefined) não entram no update; null limpa. O template precisa
 * pertencer ao mesmo tenant — nunca confiar no id vindo do navegador.
 */
export async function parseServiceReactivationFields(
  tenantId: string,
  body: { returnIntervalDays?: unknown; reactivationTemplateId?: unknown }
): Promise<FieldsResult> {
  const data: { returnIntervalDays?: number | null; reactivationTemplateId?: string | null } = {}

  if (body.returnIntervalDays !== undefined) {
    if (body.returnIntervalDays === null || body.returnIntervalDays === '') {
      data.returnIntervalDays = null
    } else {
      const days = Number(body.returnIntervalDays)
      if (!Number.isInteger(days) || days < 1 || days > RETURN_INTERVAL_MAX_DAYS) {
        return { ok: false, error: `Retorno médio deve ser entre 1 e ${RETURN_INTERVAL_MAX_DAYS} dias` }
      }
      data.returnIntervalDays = days
    }
  }

  if (body.reactivationTemplateId !== undefined) {
    if (body.reactivationTemplateId === null || body.reactivationTemplateId === '') {
      data.reactivationTemplateId = null
    } else {
      if (typeof body.reactivationTemplateId !== 'string') return { ok: false, error: 'Modelo de mensagem inválido' }
      const template = await prisma.messageTemplate.findFirst({
        where: { id: body.reactivationTemplateId, userId: tenantId },
        select: { id: true },
      })
      if (!template) return { ok: false, error: 'Modelo de mensagem não encontrado' }
      data.reactivationTemplateId = template.id
    }
  }

  return { ok: true, data }
}
