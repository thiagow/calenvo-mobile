import type { CommissionBase, Prisma } from '@prisma/client'
import { DEFAULT_TIMEZONE } from '@/lib/timezone'
import { badRequest, conflict, FinanceError } from './errors'
import type { SystemCategoryKey } from './defaults'

export type Tx = Prisma.TransactionClient

export interface FinanceSettings {
  commissionBase: CommissionBase
  requireOpenCashSession: boolean
  settleOnlyPaidCommissions: boolean
  activatedAt: Date | null
}

export async function loadSettings(tx: Tx, tenantId: string): Promise<FinanceSettings> {
  const config = await tx.financeConfig.findUnique({ where: { userId: tenantId } })
  return {
    commissionBase: config?.commissionBase ?? 'AFTER_DISCOUNT',
    requireOpenCashSession: config?.requireOpenCashSession ?? true,
    settleOnlyPaidCommissions: config?.settleOnlyPaidCommissions ?? true,
    activatedAt: config?.activatedAt ?? null
  }
}

export async function loadTimezone(tx: Tx, tenantId: string): Promise<string> {
  const config = await tx.businessConfig.findUnique({ where: { userId: tenantId }, select: { timezone: true } })
  return config?.timezone || DEFAULT_TIMEZONE
}

/** Categoria de sistema pelo systemKey; recria se alguém tiver apagado direto no banco. */
export async function systemCategoryId(tx: Tx, tenantId: string, key: SystemCategoryKey): Promise<string> {
  const category = await tx.financeCategory.findUnique({
    where: { userId_systemKey: { userId: tenantId, systemKey: key } },
    select: { id: true }
  })
  if (category) return category.id
  const { ensureFinanceDefaults } = await import('./defaults')
  await ensureFinanceDefaults(tx, tenantId, 'pt')
  const created = await tx.financeCategory.findUniqueOrThrow({
    where: { userId_systemKey: { userId: tenantId, systemKey: key } },
    select: { id: true }
  })
  return created.id
}

export async function assertCategory(tx: Tx, tenantId: string, categoryId: string, kind: 'INCOME' | 'EXPENSE') {
  const category = await tx.financeCategory.findFirst({ where: { id: categoryId, userId: tenantId, kind } })
  if (!category) throw badRequest('Categoria inválida')
  if (!category.isActive) throw badRequest('Categoria desativada')
  return category
}

/** Profissionais do tenant: o clone PROFESSIONAL do dono e os da equipe (todos com masterId). */
export async function assertProfessionals(tx: Tx, tenantId: string, ids: string[]) {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return
  const count = await tx.user.count({ where: { id: { in: unique }, masterId: tenantId, role: 'PROFESSIONAL' } })
  if (count !== unique.length) throw badRequest('Profissional inválido')
}

export async function assertServices(tx: Tx, tenantId: string, ids: string[]) {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return
  const count = await tx.service.count({ where: { id: { in: unique }, userId: tenantId } })
  if (count !== unique.length) throw badRequest('Serviço inválido')
}

export async function loadPaymentMethod(tx: Tx, tenantId: string, id: string) {
  const method = await tx.paymentMethod.findFirst({ where: { id, userId: tenantId } })
  if (!method) throw badRequest('Forma de pagamento inválida')
  if (!method.isActive) throw badRequest(`"${method.name}" está desativada`)
  return method
}

export async function findOpenCashSession(tx: Tx, tenantId: string) {
  return tx.cashSession.findFirst({ where: { userId: tenantId, status: 'OPEN' } })
}

/**
 * Caixa para um lançamento. Dinheiro físico (CASH, sangria, suprimento,
 * vale/acerto em dinheiro) exige caixa aberto sempre. Os demais exigem só
 * quando `required` (regra do tenant para recebimentos); se houver caixa
 * aberto, o lançamento sempre fica vinculado a ele.
 */
export async function resolveCashSessionFor(
  tx: Tx,
  tenantId: string,
  { isCash, required }: { isCash: boolean; required: boolean }
): Promise<string | null> {
  const session = await findOpenCashSession(tx, tenantId)
  if (session) return session.id
  if (isCash || required) {
    throw new FinanceError(409, isCash ? 'Abra o caixa para movimentar dinheiro' : 'Abra o caixa para registrar recebimentos')
  }
  return null
}

/** Trava a linha até o fim da transação (evita pagar duas vezes em requisições simultâneas). */
export async function lockRow(tx: Tx, table: 'Receivable' | 'Payable' | 'CashSession' | 'Sale', id: string) {
  // Nome da tabela vem de union literal, nunca de entrada do usuário.
  const rows = await tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "${table}" WHERE "id" = $1 FOR UPDATE`, id)
  if (rows.length === 0) throw conflict('Registro não encontrado')
}
