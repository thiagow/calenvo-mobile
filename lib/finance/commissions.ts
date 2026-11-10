import type { AdjustmentKind, CommissionRuleType } from '@prisma/client'
import { computeSettlementTotals, isCommissionEligible } from './settlement'
import { assertProfessionals, assertServices, loadPaymentMethod, loadSettings, resolveCashSessionFor, type Tx } from './context'
import { badRequest, conflict, notFound } from './errors'

/* ---------------------------------- Regras ---------------------------------- */

export async function upsertCommissionRule(
  tx: Tx,
  params: {
    tenantId: string
    professionalId: string
    serviceId: string | null
    type: CommissionRuleType
    valueBps?: number | null
    valueCents?: number | null
  }
) {
  await assertProfessionals(tx, params.tenantId, [params.professionalId])
  if (params.serviceId) await assertServices(tx, params.tenantId, [params.serviceId])

  const data =
    params.type === 'PERCENT'
      ? { type: params.type, valueBps: params.valueBps ?? 0, valueCents: null }
      : { type: params.type, valueCents: params.valueCents ?? 0, valueBps: null }
  if (data.type === 'PERCENT' && (data.valueBps! < 0 || data.valueBps! > 10_000)) throw badRequest('Percentual inválido')
  if (data.type === 'FIXED' && data.valueCents! < 0) throw badRequest('Valor inválido')

  // Upsert manual: o unique composto não serve com serviceId NULL no Prisma.
  const existing = await tx.commissionRule.findFirst({
    where: { userId: params.tenantId, professionalId: params.professionalId, serviceId: params.serviceId }
  })
  return existing
    ? tx.commissionRule.update({ where: { id: existing.id }, data })
    : tx.commissionRule.create({
        data: { userId: params.tenantId, professionalId: params.professionalId, serviceId: params.serviceId, ...data }
      })
}

export async function deleteCommissionRule(tx: Tx, tenantId: string, ruleId: string) {
  const { count } = await tx.commissionRule.deleteMany({ where: { id: ruleId, userId: tenantId } })
  if (count === 0) throw notFound('Regra')
}

/* --------------------------- Vales, bônus, descontos -------------------------- */

export async function createAdjustment(
  tx: Tx,
  params: {
    tenantId: string
    actorId: string
    professionalId: string
    kind: AdjustmentKind
    amountCents: number
    description: string
    /** Obrigatório para vale (ADVANCE): o dinheiro sai agora. */
    paymentMethodId?: string | null
  }
) {
  if (!Number.isInteger(params.amountCents) || params.amountCents <= 0) throw badRequest('Valor inválido')
  await assertProfessionals(tx, params.tenantId, [params.professionalId])

  const adjustment = await tx.professionalAdjustment.create({
    data: {
      userId: params.tenantId,
      professionalId: params.professionalId,
      kind: params.kind,
      amountCents: params.amountCents,
      description: params.description.trim() || defaultAdjustmentLabel(params.kind),
      createdById: params.actorId
    }
  })

  if (params.kind === 'ADVANCE') {
    if (!params.paymentMethodId) throw badRequest('Informe como o vale foi pago')
    const method = await loadPaymentMethod(tx, params.tenantId, params.paymentMethodId)
    const cashSessionId = await resolveCashSessionFor(tx, params.tenantId, { isCash: method.type === 'CASH', required: false })
    await tx.financialTransaction.create({
      data: {
        userId: params.tenantId,
        direction: 'OUT',
        kind: 'ADVANCE',
        amountCents: params.amountCents,
        paymentMethodId: method.id,
        cashSessionId,
        adjustmentId: adjustment.id,
        description: `Vale: ${adjustment.description}`,
        createdById: params.actorId
      }
    })
  }
  return adjustment
}

function defaultAdjustmentLabel(kind: AdjustmentKind) {
  return kind === 'ADVANCE' ? 'Vale' : kind === 'BONUS' ? 'Bônus' : 'Desconto'
}

/** Cancela vale/bônus/desconto que ainda não entrou num acerto. Vale pago gera estorno do dinheiro. */
export async function cancelAdjustment(tx: Tx, params: { tenantId: string; actorId: string; adjustmentId: string }) {
  const adjustment = await tx.professionalAdjustment.findFirst({
    where: { id: params.adjustmentId, userId: params.tenantId },
    include: { transaction: { include: { paymentMethod: true, reversedBy: { select: { id: true } } } } }
  })
  if (!adjustment) throw notFound('Lançamento')
  if (adjustment.cancelledAt) return adjustment
  if (adjustment.settlementId) throw conflict('Já entrou num acerto e não pode ser cancelado')

  const paid = adjustment.transaction
  if (paid && !paid.reversedBy) {
    const isCash = paid.paymentMethod?.type === 'CASH'
    const cashSessionId = await resolveCashSessionFor(tx, params.tenantId, { isCash, required: false })
    await tx.financialTransaction.create({
      data: {
        userId: params.tenantId,
        direction: 'IN',
        kind: 'REVERSAL',
        amountCents: paid.amountCents,
        paymentMethodId: paid.paymentMethodId,
        cashSessionId,
        reversesId: paid.id,
        description: `Estorno: ${paid.description ?? 'Vale'}`,
        createdById: params.actorId
      }
    })
  }
  return tx.professionalAdjustment.update({ where: { id: adjustment.id }, data: { cancelledAt: new Date() } })
}

/* ----------------------------------- Acerto ---------------------------------- */

async function loadOpenItems(tx: Tx, tenantId: string, professionalId: string, until?: Date | null) {
  const [commissions, adjustments] = await Promise.all([
    tx.commission.findMany({
      where: {
        userId: tenantId,
        professionalId,
        status: 'PENDING',
        settlementId: null,
        ...(until && { earnedAt: { lte: until } })
      },
      orderBy: { earnedAt: 'asc' },
      include: {
        saleItem: {
          select: {
            description: true,
            totalCents: true,
            clientPackageItemId: true,
            sale: {
              select: {
                id: true,
                status: true,
                occurredAt: true,
                totalCents: true,
                client: { select: { name: true } },
                receivable: { select: { status: true } }
              }
            }
          }
        }
      }
    }),
    tx.professionalAdjustment.findMany({
      where: { userId: tenantId, professionalId, settlementId: null, cancelledAt: null, ...(until && { createdAt: { lte: until } }) },
      orderBy: { createdAt: 'asc' }
    })
  ])
  return { commissions, adjustments }
}

type OpenCommission = Awaited<ReturnType<typeof loadOpenItems>>['commissions'][number]

/** Comanda paga = recebível quitado, ou comanda sem cobrança (sessão de pacote / cortesia). */
function isSalePaid(c: OpenCommission) {
  const sale = c.saleItem.sale
  return sale.status === 'CLOSED' || sale.receivable?.status === 'PAID' || sale.totalCents === 0
}

/** Prévia do acerto: o que entra agora e o que fica esperando o cliente pagar. */
export async function previewSettlement(tx: Tx, params: { tenantId: string; professionalId: string; until?: Date | null }) {
  await assertProfessionals(tx, params.tenantId, [params.professionalId])
  const settings = await loadSettings(tx, params.tenantId)
  const { commissions, adjustments } = await loadOpenItems(tx, params.tenantId, params.professionalId, params.until)

  const eligible = commissions.filter((c) => isCommissionEligible({ amountCents: c.amountCents, salePaid: isSalePaid(c) }, settings.settleOnlyPaidCommissions))
  const waiting = commissions.filter((c) => !eligible.includes(c))
  const totals = computeSettlementTotals(eligible, adjustments)

  const toLine = (c: OpenCommission) => ({
    id: c.id,
    description: c.saleItem.description,
    clientName: c.saleItem.sale.client?.name ?? null,
    occurredAt: c.saleItem.sale.occurredAt,
    baseCents: c.baseCents,
    ruleType: c.ruleType,
    ruleValue: c.ruleValue,
    amountCents: c.amountCents,
    salePaid: isSalePaid(c),
    isPackageSession: Boolean(c.saleItem.clientPackageItemId)
  })

  return {
    totals,
    commissions: eligible.map(toLine),
    waitingPayment: waiting.map(toLine),
    waitingPaymentCents: waiting.reduce((acc, c) => acc + c.amountCents, 0),
    adjustments: adjustments.map((a) => ({
      id: a.id,
      kind: a.kind,
      amountCents: a.amountCents,
      description: a.description,
      createdAt: a.createdAt
    }))
  }
}

/**
 * Confirma e paga o acerto. Contra pagamento em dobro: as comissões e os
 * ajustes são "reservados" com updateMany ... WHERE settlementId IS NULL e a
 * contagem precisa bater — um acerto concorrente faz este falhar e desfazer.
 */
export async function createSettlement(
  tx: Tx,
  params: {
    tenantId: string
    actorId: string
    professionalId: string
    paymentMethodId?: string | null
    until?: Date | null
    notes?: string
    cashSessionId?: string | null
  }
) {
  const preview = await previewSettlement(tx, params)
  const { totals } = preview
  if (preview.commissions.length === 0 && preview.adjustments.length === 0) throw conflict('Não há nada para acertar com este profissional')
  if (totals.netCents < 0) {
    throw conflict('Os vales e descontos são maiores que as comissões. Aguarde novas comissões ou cancele um vale.')
  }

  let method = null
  let cashSessionId = params.cashSessionId ?? null
  if (totals.netCents > 0) {
    if (!params.paymentMethodId) throw badRequest('Informe como o acerto será pago')
    method = await loadPaymentMethod(tx, params.tenantId, params.paymentMethodId)
    cashSessionId = await resolveCashSessionFor(tx, params.tenantId, { isCash: method.type === 'CASH', required: false })
  }

  const dates = preview.commissions.map((c) => new Date(c.occurredAt).getTime())
  const settlement = await tx.commissionSettlement.create({
    data: {
      userId: params.tenantId,
      professionalId: params.professionalId,
      cashSessionId,
      periodStart: dates.length ? new Date(Math.min(...dates)) : null,
      periodEnd: params.until ?? new Date(),
      commissionsCents: totals.commissionsCents,
      bonusesCents: totals.bonusesCents,
      deductionsCents: totals.deductionsCents,
      netCents: totals.netCents,
      paymentMethodId: method?.id ?? null,
      notes: params.notes?.trim() || null,
      createdById: params.actorId
    }
  })

  const commissionIds = preview.commissions.map((c) => c.id)
  const adjustmentIds = preview.adjustments.map((a) => a.id)
  const claimedCommissions = await tx.commission.updateMany({
    where: { id: { in: commissionIds }, settlementId: null, status: 'PENDING' },
    data: { settlementId: settlement.id, status: 'SETTLED' }
  })
  const claimedAdjustments = await tx.professionalAdjustment.updateMany({
    where: { id: { in: adjustmentIds }, settlementId: null, cancelledAt: null },
    data: { settlementId: settlement.id }
  })
  if (claimedCommissions.count !== commissionIds.length || claimedAdjustments.count !== adjustmentIds.length) {
    throw conflict('Este acerto foi alterado por outra pessoa agora mesmo. Atualize e tente de novo.')
  }

  if (totals.netCents > 0 && method) {
    const professional = await tx.user.findUnique({ where: { id: params.professionalId }, select: { name: true } })
    await tx.financialTransaction.create({
      data: {
        userId: params.tenantId,
        direction: 'OUT',
        kind: 'COMMISSION_PAYOUT',
        amountCents: totals.netCents,
        paymentMethodId: method.id,
        cashSessionId,
        settlementId: settlement.id,
        description: `Acerto · ${professional?.name ?? 'Profissional'}`,
        createdById: params.actorId
      }
    })
  }
  return settlement
}

/** Cancela um acerto: devolve comissões/ajustes para "pendente" e estorna o pagamento. */
export async function cancelSettlement(tx: Tx, params: { tenantId: string; actorId: string; settlementId: string }) {
  const settlement = await tx.commissionSettlement.findFirst({
    where: { id: params.settlementId, userId: params.tenantId },
    include: { transactions: { include: { paymentMethod: true, reversedBy: { select: { id: true } } } } }
  })
  if (!settlement) throw notFound('Acerto')
  if (settlement.status === 'CANCELLED') return settlement

  for (const payout of settlement.transactions.filter((t) => t.kind === 'COMMISSION_PAYOUT' && !t.reversedBy)) {
    const cashSessionId = await resolveCashSessionFor(tx, params.tenantId, { isCash: payout.paymentMethod?.type === 'CASH', required: false })
    await tx.financialTransaction.create({
      data: {
        userId: params.tenantId,
        direction: 'IN',
        kind: 'REVERSAL',
        amountCents: payout.amountCents,
        paymentMethodId: payout.paymentMethodId,
        cashSessionId,
        reversesId: payout.id,
        description: `Estorno: ${payout.description ?? 'Acerto'}`,
        createdById: params.actorId
      }
    })
  }
  await tx.commission.updateMany({ where: { settlementId: settlement.id }, data: { settlementId: null, status: 'PENDING' } })
  await tx.professionalAdjustment.updateMany({ where: { settlementId: settlement.id }, data: { settlementId: null } })
  return tx.commissionSettlement.update({ where: { id: settlement.id }, data: { status: 'CANCELLED' } })
}

/** Comprovante do acerto, com cada atendimento. */
export async function settlementReceipt(tx: Tx, tenantId: string, settlementId: string, professionalId?: string | null) {
  const settlement = await tx.commissionSettlement.findFirst({
    where: { id: settlementId, userId: tenantId, ...(professionalId && { professionalId }) },
    include: {
      professional: { select: { name: true } },
      createdBy: { select: { name: true } },
      paymentMethod: { select: { name: true } },
      commissions: {
        orderBy: { earnedAt: 'asc' },
        include: {
          saleItem: {
            select: {
              description: true,
              clientPackageItemId: true,
              sale: { select: { occurredAt: true, client: { select: { name: true } } } }
            }
          }
        }
      },
      adjustments: { orderBy: { createdAt: 'asc' } }
    }
  })
  if (!settlement) throw notFound('Acerto')
  const tenant = await tx.user.findUnique({ where: { id: tenantId }, select: { businessName: true, currency: true } })
  return {
    id: settlement.id,
    businessName: tenant?.businessName ?? null,
    currency: tenant?.currency ?? 'BRL',
    professionalName: settlement.professional.name,
    status: settlement.status,
    paidAt: settlement.paidAt,
    periodStart: settlement.periodStart,
    periodEnd: settlement.periodEnd,
    paymentMethod: settlement.paymentMethod?.name ?? null,
    createdBy: settlement.createdBy?.name ?? null,
    notes: settlement.notes,
    commissionsCents: settlement.commissionsCents,
    bonusesCents: settlement.bonusesCents,
    deductionsCents: settlement.deductionsCents,
    netCents: settlement.netCents,
    commissions: settlement.commissions.map((c) => ({
      id: c.id,
      description: c.saleItem.description,
      clientName: c.saleItem.sale.client?.name ?? null,
      occurredAt: c.saleItem.sale.occurredAt,
      baseCents: c.baseCents,
      ruleType: c.ruleType,
      ruleValue: c.ruleValue,
      amountCents: c.amountCents,
      isPackageSession: Boolean(c.saleItem.clientPackageItemId)
    })),
    adjustments: settlement.adjustments.map((a) => ({ id: a.id, kind: a.kind, amountCents: a.amountCents, description: a.description, createdAt: a.createdAt }))
  }
}
