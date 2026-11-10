export const dynamic = 'force-dynamic'

import { financeRoute, inTransaction, json, parseBody } from '@/lib/finance/route'
import { commissionRuleSchema } from '@/lib/finance/schemas'
import { upsertCommissionRule } from '@/lib/finance/commissions'

/** PUT — cria ou atualiza a regra (padrão do profissional ou profissional × serviço). MASTER. */
export const PUT = financeRoute({ requireMaster: true }, 'commission_rule_upsert', async ({ scope }, request) => {
  const body = await parseBody(request, commissionRuleSchema)
  const rule = await inTransaction((tx) =>
    upsertCommissionRule(tx, {
      tenantId: scope.tenantId,
      professionalId: body.professionalId,
      serviceId: body.serviceId,
      type: body.type,
      valueBps: body.type === 'PERCENT' ? body.valueBps : null,
      valueCents: body.type === 'FIXED' ? body.valueCents : null
    })
  )
  return json({ rule: { id: rule.id } })
})
