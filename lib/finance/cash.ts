import { allocateProportionally } from './money'
import { summarizeCashSession, type CashSummary } from './cash-session'
import { findOpenCashSession, lockRow, type Tx } from './context'
import { badRequest, conflict, notFound } from './errors'

export async function openCashSession(tx: Tx, params: { tenantId: string; actorId: string; openingCents: number; notes?: string }) {
  if (!Number.isInteger(params.openingCents) || params.openingCents < 0) throw badRequest('Valor de abertura inválido')
  if (await findOpenCashSession(tx, params.tenantId)) throw conflict('Já existe um caixa aberto')
  // O índice único parcial garante um só caixa aberto mesmo sob concorrência.
  return tx.cashSession.create({
    data: { userId: params.tenantId, openedById: params.actorId, openingCents: params.openingCents, notes: params.notes }
  })
}

async function loadSessionTransactions(tx: Tx, sessionId: string) {
  return tx.financialTransaction.findMany({
    where: { cashSessionId: sessionId },
    orderBy: { occurredAt: 'asc' },
    include: {
      paymentMethod: { select: { id: true, name: true, type: true } },
      createdBy: { select: { name: true } },
      receivable: { select: { saleId: true, description: true } },
      reversedBy: { select: { id: true } }
    }
  })
}

type SessionTransaction = Awaited<ReturnType<typeof loadSessionTransactions>>[number]

function summarize(openingCents: number, transactions: SessionTransaction[]): CashSummary {
  return summarizeCashSession(
    openingCents,
    transactions.map((t) => ({
      direction: t.direction,
      kind: t.kind,
      amountCents: t.amountCents,
      feeCents: t.feeCents,
      paymentMethodId: t.paymentMethodId,
      paymentMethodType: t.paymentMethod?.type ?? null
    }))
  )
}

/** Sangria (retirada) ou suprimento (entrada de troco). Sangria não deixa a gaveta negativa. */
export async function addCashMovement(
  tx: Tx,
  params: { tenantId: string; actorId: string; kind: 'SUPPLY' | 'WITHDRAWAL'; amountCents: number; description?: string }
) {
  if (!Number.isInteger(params.amountCents) || params.amountCents <= 0) throw badRequest('Valor inválido')
  const session = await findOpenCashSession(tx, params.tenantId)
  if (!session) throw conflict('Abra o caixa antes de movimentar dinheiro')
  await lockRow(tx, 'CashSession', session.id)

  if (params.kind === 'WITHDRAWAL') {
    const summary = summarize(session.openingCents, await loadSessionTransactions(tx, session.id))
    if (params.amountCents > summary.expectedCashCents) {
      throw badRequest('A sangria é maior que o dinheiro esperado na gaveta')
    }
  }

  return tx.financialTransaction.create({
    data: {
      userId: params.tenantId,
      direction: params.kind === 'SUPPLY' ? 'IN' : 'OUT',
      kind: params.kind,
      amountCents: params.amountCents,
      cashSessionId: session.id,
      description: params.description?.trim() || (params.kind === 'SUPPLY' ? 'Suprimento' : 'Sangria'),
      createdById: params.actorId
    }
  })
}

export async function closeCashSession(
  tx: Tx,
  params: { tenantId: string; actorId: string; countedCashCents: number; notes?: string }
) {
  if (!Number.isInteger(params.countedCashCents) || params.countedCashCents < 0) throw badRequest('Valor contado inválido')
  const session = await findOpenCashSession(tx, params.tenantId)
  if (!session) throw conflict('Não há caixa aberto')
  await lockRow(tx, 'CashSession', session.id)

  const summary = summarize(session.openingCents, await loadSessionTransactions(tx, session.id))
  return tx.cashSession.update({
    where: { id: session.id },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      closedById: params.actorId,
      expectedCashCents: summary.expectedCashCents,
      countedCashCents: params.countedCashCents,
      differenceCents: params.countedCashCents - summary.expectedCashCents,
      notes: [session.notes, params.notes].filter(Boolean).join('\n') || null
    }
  })
}

export interface ProfessionalCashTotal {
  professionalId: string | null
  name: string
  receivedCents: number
}

/**
 * Quanto do que entrou no caixa veio do trabalho de cada profissional: cada
 * recebimento é rateado entre os itens da comanda pelo valor de cada item.
 */
async function receivedByProfessional(tx: Tx, transactions: SessionTransaction[]): Promise<ProfessionalCashTotal[]> {
  const saleIds = [...new Set(transactions.map((t) => t.receivable?.saleId).filter((v): v is string => Boolean(v)))]
  if (saleIds.length === 0) return []
  const items = await tx.saleItem.findMany({
    where: { saleId: { in: saleIds } },
    orderBy: { sortOrder: 'asc' },
    select: { saleId: true, totalCents: true, professionalId: true, professional: { select: { name: true } } }
  })
  const totals = new Map<string, ProfessionalCashTotal>()

  for (const t of transactions) {
    const saleId = t.receivable?.saleId
    if (!saleId || (t.kind !== 'RECEIPT' && t.kind !== 'REVERSAL')) continue
    const saleItems = items.filter((i) => i.saleId === saleId)
    if (saleItems.length === 0) continue
    const signed = t.direction === 'IN' ? t.amountCents : -t.amountCents
    const shares = allocateProportionally(signed, saleItems.map((i) => i.totalCents))
    saleItems.forEach((item, index) => {
      const key = item.professionalId ?? 'none'
      const entry = totals.get(key) ?? { professionalId: item.professionalId, name: item.professional?.name ?? 'Sem profissional', receivedCents: 0 }
      entry.receivedCents += shares[index]
      totals.set(key, entry)
    })
  }
  return [...totals.values()].sort((a, b) => b.receivedCents - a.receivedCents)
}

/** Relatório completo de um caixa (aberto ou fechado). */
export async function cashSessionReport(tx: Tx, tenantId: string, sessionId: string) {
  const session = await tx.cashSession.findFirst({
    where: { id: sessionId, userId: tenantId },
    include: { openedBy: { select: { name: true } }, closedBy: { select: { name: true } } }
  })
  if (!session) throw notFound('Caixa')
  const transactions = await loadSessionTransactions(tx, session.id)
  const summary = summarize(session.openingCents, transactions)
  const methodNames = new Map(transactions.filter((t) => t.paymentMethod).map((t) => [t.paymentMethod!.id, t.paymentMethod!]))

  return {
    session: {
      id: session.id,
      status: session.status,
      openedAt: session.openedAt,
      openedBy: session.openedBy.name,
      openingCents: session.openingCents,
      closedAt: session.closedAt,
      closedBy: session.closedBy?.name ?? null,
      expectedCashCents: session.status === 'CLOSED' ? session.expectedCashCents : summary.expectedCashCents,
      countedCashCents: session.countedCashCents,
      differenceCents: session.differenceCents,
      notes: session.notes
    },
    summary: {
      ...summary,
      byMethod: summary.byMethod.map((m) => ({
        ...m,
        name: m.paymentMethodId ? methodNames.get(m.paymentMethodId)?.name ?? 'Forma removida' : 'Dinheiro (gaveta)',
        type: m.paymentMethodId ? methodNames.get(m.paymentMethodId)?.type ?? 'OTHER' : 'CASH'
      }))
    },
    byProfessional: await receivedByProfessional(tx, transactions),
    transactions: transactions.map((t) => ({
      id: t.id,
      direction: t.direction,
      kind: t.kind,
      amountCents: t.amountCents,
      feeCents: t.feeCents,
      paymentMethod: t.paymentMethod?.name ?? null,
      description: t.description,
      occurredAt: t.occurredAt,
      createdBy: t.createdBy?.name ?? null,
      reversed: Boolean(t.reversedBy),
      reversesId: t.reversesId
    }))
  }
}
