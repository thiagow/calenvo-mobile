import { allocateProportionally } from './money'
import { commissionBaseFor, recomputeFromSnapshot } from './commission'
import { computeFee, deriveEntryStatus } from './entries'
import { loadPaymentMethod, loadSettings, lockRow, resolveCashSessionFor, type FinanceSettings, type Tx } from './context'
import { badRequest, conflict, notFound } from './errors'

/**
 * Recebimentos e estornos. Todo dinheiro passa pelo livro-razão
 * (FinancialTransaction); Receivable/Payable só guardam o saldo derivado.
 */

export interface PaymentPart {
  paymentMethodId: string
  amountCents: number
}

/**
 * Rateia uma variação de taxa entre os itens da comanda (pelo valor de cada
 * item) e recalcula as comissões PENDING quando a base é AFTER_FEES.
 */
async function applyFeeToSale(tx: Tx, saleId: string, feeDeltaCents: number, settings: FinanceSettings) {
  if (feeDeltaCents === 0) return
  const items = await tx.saleItem.findMany({ where: { saleId }, orderBy: { sortOrder: 'asc' }, include: { commission: true, clientPackageItem: { select: { sessionValueCents: true } } } })
  if (items.length === 0) return
  const shares = allocateProportionally(feeDeltaCents, items.map((i) => i.totalCents))

  for (const [index, item] of items.entries()) {
    const feeCents = Math.max(0, item.feeCents + shares[index])
    const base = commissionBaseFor(
      { totalCents: item.totalCents, feeCents, sessionValueCents: item.clientPackageItemId ? item.clientPackageItem?.sessionValueCents ?? 0 : null },
      settings.commissionBase
    )
    await tx.saleItem.update({ where: { id: item.id }, data: { feeCents, commissionBaseCents: base } })
    if (item.commission && item.commission.status === 'PENDING' && settings.commissionBase === 'AFTER_FEES') {
      await tx.commission.update({
        where: { id: item.commission.id },
        data: { baseCents: base, amountCents: recomputeFromSnapshot(item.commission, base, item.quantity) }
      })
    }
  }
}

async function syncSaleStatus(tx: Tx, saleId: string, receivableStatus: string) {
  const paid = receivableStatus === 'PAID'
  await tx.sale.update({ where: { id: saleId }, data: { status: paid ? 'CLOSED' : 'OPEN', closedAt: paid ? new Date() : null } })
}

/** Recebe uma conta a receber, com uma ou mais formas de pagamento (pagamento dividido). */
export async function registerReceipt(
  tx: Tx,
  params: { tenantId: string; receivableId: string; actorId: string; payments: PaymentPart[]; occurredAt?: Date }
) {
  const { tenantId } = params
  if (params.payments.length === 0) throw badRequest('Informe ao menos uma forma de pagamento')
  if (params.payments.some((p) => !Number.isInteger(p.amountCents) || p.amountCents <= 0)) throw badRequest('Valor inválido')

  const receivable = await tx.receivable.findFirst({ where: { id: params.receivableId, userId: tenantId } })
  if (!receivable) throw notFound('Conta a receber')
  await lockRow(tx, 'Receivable', receivable.id)
  const current = await tx.receivable.findUniqueOrThrow({ where: { id: receivable.id } })
  if (current.status === 'CANCELLED') throw conflict('Conta cancelada')
  if (current.status === 'PAID') throw conflict('Esta conta já está quitada')

  const total = params.payments.reduce((acc, p) => acc + p.amountCents, 0)
  const remaining = current.amountCents - current.paidCents
  if (total > remaining) throw badRequest('O valor recebido é maior que o saldo em aberto')

  const settings = await loadSettings(tx, tenantId)
  let feeTotal = 0
  const transactions = []
  for (const part of params.payments) {
    const method = await loadPaymentMethod(tx, tenantId, part.paymentMethodId)
    const cashSessionId = await resolveCashSessionFor(tx, tenantId, {
      isCash: method.type === 'CASH',
      required: settings.requireOpenCashSession
    })
    const feeCents = computeFee(part.amountCents, method)
    feeTotal += feeCents
    transactions.push(
      await tx.financialTransaction.create({
        data: {
          userId: tenantId,
          direction: 'IN',
          kind: 'RECEIPT',
          amountCents: part.amountCents,
          feeCents,
          paymentMethodId: method.id,
          cashSessionId,
          receivableId: current.id,
          description: current.description,
          occurredAt: params.occurredAt ?? new Date(),
          createdById: params.actorId
        }
      })
    )
  }

  const paidCents = current.paidCents + total
  const status = deriveEntryStatus(current.amountCents, paidCents)
  const updated = await tx.receivable.update({ where: { id: current.id }, data: { paidCents, status } })

  if (current.saleId) {
    await applyFeeToSale(tx, current.saleId, feeTotal, settings)
    await syncSaleStatus(tx, current.saleId, status)
  }
  return { receivable: updated, transactions }
}

/** Paga uma conta a pagar (uma forma de pagamento por vez). */
export async function registerPayablePayment(
  tx: Tx,
  params: { tenantId: string; payableId: string; actorId: string; paymentMethodId: string; amountCents: number; occurredAt?: Date }
) {
  const { tenantId } = params
  if (!Number.isInteger(params.amountCents) || params.amountCents <= 0) throw badRequest('Valor inválido')
  const payable = await tx.payable.findFirst({ where: { id: params.payableId, userId: tenantId } })
  if (!payable) throw notFound('Conta a pagar')
  await lockRow(tx, 'Payable', payable.id)
  const current = await tx.payable.findUniqueOrThrow({ where: { id: payable.id } })
  if (current.status === 'CANCELLED') throw conflict('Conta cancelada')
  if (current.status === 'PAID') throw conflict('Esta conta já está paga')
  if (params.amountCents > current.amountCents - current.paidCents) throw badRequest('O valor é maior que o saldo em aberto')

  const method = await loadPaymentMethod(tx, tenantId, params.paymentMethodId)
  const cashSessionId = await resolveCashSessionFor(tx, tenantId, { isCash: method.type === 'CASH', required: false })
  const transaction = await tx.financialTransaction.create({
    data: {
      userId: tenantId,
      direction: 'OUT',
      kind: 'PAYMENT',
      amountCents: params.amountCents,
      paymentMethodId: method.id,
      cashSessionId,
      payableId: current.id,
      description: current.description,
      occurredAt: params.occurredAt ?? new Date(),
      createdById: params.actorId
    }
  })
  const paidCents = current.paidCents + params.amountCents
  const updated = await tx.payable.update({
    where: { id: current.id },
    data: { paidCents, status: deriveEntryStatus(current.amountCents, paidCents) }
  })
  return { payable: updated, transaction }
}

/**
 * Estorno: lançamento no sentido oposto que aponta para o original. Nada é
 * apagado. Pagamento de acerto não se estorna aqui (cancela-se o acerto).
 */
export async function reverseTransaction(
  tx: Tx,
  params: { tenantId: string; transactionId: string; actorId: string; reason?: string }
) {
  const { tenantId } = params
  const original = await tx.financialTransaction.findFirst({
    where: { id: params.transactionId, userId: tenantId },
    include: { paymentMethod: true, reversedBy: { select: { id: true } } }
  })
  if (!original) throw notFound('Lançamento')
  if (original.kind === 'REVERSAL') throw conflict('Um estorno não pode ser estornado')
  if (original.reversedBy) throw conflict('Este lançamento já foi estornado')
  if (original.kind === 'COMMISSION_PAYOUT') throw conflict('Para desfazer um pagamento de acerto, cancele o acerto')
  if (original.kind === 'ADVANCE') throw conflict('Para desfazer um vale, cancele o vale em Comissões')

  const isCash = !original.paymentMethod || original.paymentMethod.type === 'CASH'
  const cashSessionId = await resolveCashSessionFor(tx, tenantId, { isCash, required: false })

  if (original.receivableId) await lockRow(tx, 'Receivable', original.receivableId)
  if (original.payableId) await lockRow(tx, 'Payable', original.payableId)

  const reversal = await tx.financialTransaction.create({
    data: {
      userId: tenantId,
      direction: original.direction === 'IN' ? 'OUT' : 'IN',
      kind: 'REVERSAL',
      amountCents: original.amountCents,
      feeCents: original.feeCents,
      paymentMethodId: original.paymentMethodId,
      cashSessionId,
      receivableId: original.receivableId,
      payableId: original.payableId,
      reversesId: original.id,
      description: `Estorno: ${original.description ?? ''}${params.reason ? ` (${params.reason})` : ''}`.trim(),
      createdById: params.actorId
    }
  })

  if (original.receivableId) {
    const receivable = await tx.receivable.findUniqueOrThrow({ where: { id: original.receivableId } })
    const paidCents = Math.max(0, receivable.paidCents - original.amountCents)
    const status = receivable.status === 'CANCELLED' ? 'CANCELLED' : deriveEntryStatus(receivable.amountCents, paidCents)
    await tx.receivable.update({ where: { id: receivable.id }, data: { paidCents, status } })
    if (receivable.saleId) {
      await applyFeeToSale(tx, receivable.saleId, -original.feeCents, await loadSettings(tx, tenantId))
      await syncSaleStatus(tx, receivable.saleId, status)
    }
  }
  if (original.payableId) {
    const payable = await tx.payable.findUniqueOrThrow({ where: { id: original.payableId } })
    const paidCents = Math.max(0, payable.paidCents - original.amountCents)
    await tx.payable.update({
      where: { id: payable.id },
      data: { paidCents, status: payable.status === 'CANCELLED' ? 'CANCELLED' : deriveEntryStatus(payable.amountCents, paidCents) }
    })
  }
  return reversal
}
