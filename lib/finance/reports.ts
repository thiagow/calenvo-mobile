import { addCalendarDays, tenantCalendarDayWindow, todayInZone } from '@/lib/timezone'
import { cashSessionReport } from './cash'
import { findOpenCashSession, loadTimezone, type Tx } from './context'

/* ------------------------------- Visão geral ------------------------------- */

export async function financeOverview(tx: Tx, tenantId: string) {
  const timezone = await loadTimezone(tx, tenantId)
  const today = todayInZone(timezone)
  const { start: todayStart, end: todayEnd } = tenantCalendarDayWindow(timezone, today)
  const { end: in7End } = tenantCalendarDayWindow(timezone, addCalendarDays(today, 7))

  const openStatuses = { in: ['OPEN', 'PARTIAL'] as ('OPEN' | 'PARTIAL')[] }
  const [session, todayTx, receivables, payables, pendingCommissions, pendingSalesCount] = await Promise.all([
    findOpenCashSession(tx, tenantId),
    tx.financialTransaction.findMany({
      where: { userId: tenantId, occurredAt: { gte: todayStart, lte: todayEnd } },
      select: { direction: true, amountCents: true, feeCents: true, kind: true }
    }),
    tx.receivable.findMany({
      where: { userId: tenantId, status: openStatuses, dueDate: { lte: in7End } },
      select: { amountCents: true, paidCents: true, dueDate: true }
    }),
    tx.payable.findMany({
      where: { userId: tenantId, status: openStatuses, dueDate: { lte: in7End } },
      select: { amountCents: true, paidCents: true, dueDate: true }
    }),
    tx.commission.aggregate({ where: { userId: tenantId, status: 'PENDING' }, _sum: { amountCents: true } }),
    countPendingAppointments(tx, tenantId)
  ])

  const sumOpen = (rows: { amountCents: number; paidCents: number }[]) => rows.reduce((acc, r) => acc + r.amountCents - r.paidCents, 0)
  const overdue = <T extends { dueDate: Date }>(rows: T[]) => rows.filter((r) => r.dueDate < todayStart)

  const report = session ? await cashSessionReport(tx, tenantId, session.id) : null
  return {
    today,
    cashSession: report?.session ?? null,
    cashSessionSummary: report?.summary ?? null,
    todayInCents: todayTx.filter((t) => t.direction === 'IN').reduce((a, t) => a + t.amountCents, 0),
    todayOutCents: todayTx.filter((t) => t.direction === 'OUT').reduce((a, t) => a + t.amountCents, 0),
    receivablesNext7Cents: sumOpen(receivables),
    receivablesOverdueCents: sumOpen(overdue(receivables)),
    payablesNext7Cents: sumOpen(payables),
    payablesOverdueCents: sumOpen(overdue(payables)),
    pendingCommissionsCents: pendingCommissions._sum.amountCents ?? 0,
    pendingAppointments: pendingSalesCount
  }
}

/* ---------------------------- Pendências (concluídos sem comanda) ---------------------------- */

function pendingAppointmentsWhere(tenantId: string, since: Date) {
  return { userId: tenantId, status: 'COMPLETED' as const, deletedAt: null, sale: { is: null }, updatedAt: { gte: since } }
}

async function activationDate(tx: Tx, tenantId: string) {
  const config = await tx.financeConfig.findUnique({ where: { userId: tenantId }, select: { activatedAt: true } })
  return config?.activatedAt ?? null
}

export async function countPendingAppointments(tx: Tx, tenantId: string) {
  const since = await activationDate(tx, tenantId)
  if (!since) return 0
  return tx.appointment.count({ where: pendingAppointmentsWhere(tenantId, since) })
}

/** Concluídos desde a ativação do módulo que ainda não têm comanda (ex.: falha no gancho). */
export async function listPendingAppointments(tx: Tx, tenantId: string) {
  const since = await activationDate(tx, tenantId)
  if (!since) return []
  return tx.appointment.findMany({
    where: pendingAppointmentsWhere(tenantId, since),
    orderBy: { date: 'desc' },
    take: 100,
    select: {
      id: true,
      date: true,
      price: true,
      client: { select: { name: true } },
      service: { select: { name: true, price: true } },
      professionalUser: { select: { name: true } }
    }
  })
}

/* ----------------------------------- DRE ----------------------------------- */

interface Line {
  key: string
  label: string
  cents: number
}

function pushTo(map: Map<string, Line>, key: string, label: string, cents: number) {
  const line = map.get(key) ?? { key, label, cents: 0 }
  line.cents += cents
  map.set(key, line)
}

/**
 * DRE simplificado no período.
 * - Caixa: o que entrou e saiu de fato (livro-razão), por categoria.
 * - Competência: o que foi vendido (comandas), as despesas que venceram e as
 *   comissões geradas no período, pagas ou não.
 */
export async function incomeStatement(tx: Tx, tenantId: string, from: Date, to: Date) {
  const [transactions, sales, payables, commissions] = await Promise.all([
    tx.financialTransaction.findMany({
      where: { userId: tenantId, occurredAt: { gte: from, lte: to } },
      include: {
        receivable: { select: { category: { select: { id: true, name: true } } } },
        payable: { select: { category: { select: { id: true, name: true } } } },
        reverses: { select: { kind: true } }
      }
    }),
    tx.sale.findMany({
      where: { userId: tenantId, status: { not: 'CANCELLED' }, occurredAt: { gte: from, lte: to } },
      select: { origin: true, totalCents: true, receivable: { select: { category: { select: { id: true, name: true } } } } }
    }),
    tx.payable.findMany({
      where: { userId: tenantId, status: { not: 'CANCELLED' }, dueDate: { gte: from, lte: to } },
      select: { amountCents: true, category: { select: { id: true, name: true } } }
    }),
    tx.commission.aggregate({
      where: { userId: tenantId, status: { not: 'CANCELLED' }, earnedAt: { gte: from, lte: to } },
      _sum: { amountCents: true }
    })
  ])

  // --- Regime de caixa ---
  const cashIncome = new Map<string, Line>()
  const cashExpense = new Map<string, Line>()
  let fees = 0
  for (const t of transactions) {
    const kind = t.kind === 'REVERSAL' ? t.reverses?.kind : t.kind
    const sign = t.kind === 'REVERSAL' ? -1 : 1
    const amount = sign * t.amountCents
    switch (kind) {
      case 'RECEIPT':
        pushTo(cashIncome, t.receivable?.category.id ?? 'other', t.receivable?.category.name ?? 'Outras receitas', amount)
        fees += sign * t.feeCents
        break
      case 'PAYMENT':
        pushTo(cashExpense, t.payable?.category.id ?? 'other', t.payable?.category.name ?? 'Outras despesas', amount)
        break
      case 'COMMISSION_PAYOUT':
      case 'ADVANCE':
        pushTo(cashExpense, 'commissions', 'Comissões e vales pagos', amount)
        break
      default:
        break // suprimento e sangria só movem dinheiro de lugar
    }
  }
  if (fees !== 0) pushTo(cashExpense, 'fees', 'Taxas de pagamento', fees)

  // --- Regime de competência ---
  const accrualIncome = new Map<string, Line>()
  for (const s of sales) {
    if (s.totalCents === 0) continue
    pushTo(accrualIncome, s.receivable?.category.id ?? s.origin, s.receivable?.category.name ?? 'Vendas', s.totalCents)
  }
  const manualReceivables = await tx.receivable.findMany({
    where: { userId: tenantId, saleId: null, status: { not: 'CANCELLED' }, dueDate: { gte: from, lte: to } },
    select: { amountCents: true, category: { select: { id: true, name: true } } }
  })
  for (const r of manualReceivables) pushTo(accrualIncome, r.category.id, r.category.name, r.amountCents)

  const accrualExpense = new Map<string, Line>()
  for (const p of payables) pushTo(accrualExpense, p.category.id, p.category.name, p.amountCents)
  const commissionTotal = commissions._sum.amountCents ?? 0
  if (commissionTotal) pushTo(accrualExpense, 'commissions', 'Comissões geradas', commissionTotal)

  const build = (income: Map<string, Line>, expense: Map<string, Line>) => {
    const incomeLines = [...income.values()].sort((a, b) => b.cents - a.cents)
    const expenseLines = [...expense.values()].sort((a, b) => b.cents - a.cents)
    const incomeCents = incomeLines.reduce((a, l) => a + l.cents, 0)
    const expenseCents = expenseLines.reduce((a, l) => a + l.cents, 0)
    return { income: incomeLines, expense: expenseLines, incomeCents, expenseCents, resultCents: incomeCents - expenseCents }
  }

  return { cash: build(cashIncome, cashExpense), accrual: build(accrualIncome, accrualExpense) }
}

/* ---------------------------- Fluxo de caixa projetado ---------------------------- */

/** Saldo previsto por dia: a receber × a pagar em aberto, por vencimento, nos próximos N dias. */
export async function projectedCashFlow(tx: Tx, tenantId: string, days: number) {
  const timezone = await loadTimezone(tx, tenantId)
  const today = todayInZone(timezone)
  const { start } = tenantCalendarDayWindow(timezone, today)
  const { end } = tenantCalendarDayWindow(timezone, addCalendarDays(today, days - 1))
  const openStatuses = { in: ['OPEN', 'PARTIAL'] as ('OPEN' | 'PARTIAL')[] }

  const [receivables, payables] = await Promise.all([
    tx.receivable.findMany({ where: { userId: tenantId, status: openStatuses, dueDate: { lte: end } }, select: { amountCents: true, paidCents: true, dueDate: true } }),
    tx.payable.findMany({ where: { userId: tenantId, status: openStatuses, dueDate: { lte: end } }, select: { amountCents: true, paidCents: true, dueDate: true } })
  ])

  const dayKey = (date: Date) => (date < start ? today : new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date))
  const buckets = new Map<string, { date: string; inCents: number; outCents: number }>()
  for (let i = 0; i < days; i++) {
    const date = addCalendarDays(today, i)
    buckets.set(date, { date, inCents: 0, outCents: 0 })
  }
  let overdueIn = 0
  let overdueOut = 0
  for (const r of receivables) {
    const open = r.amountCents - r.paidCents
    if (r.dueDate < start) overdueIn += open
    buckets.get(dayKey(r.dueDate))!.inCents += open
  }
  for (const p of payables) {
    const open = p.amountCents - p.paidCents
    if (p.dueDate < start) overdueOut += open
    buckets.get(dayKey(p.dueDate))!.outCents += open
  }

  let running = 0
  const series = [...buckets.values()].map((b) => {
    running += b.inCents - b.outCents
    return { ...b, balanceCents: running }
  })
  return { days: series, overdueInCents: overdueIn, overdueOutCents: overdueOut }
}
