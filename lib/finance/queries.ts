import type { Prisma } from '@prisma/client'
import { toCents } from './money'
import type { Tx } from './context'
import { notFound } from './errors'

/** Leituras usadas pelas telas. Sempre escopadas por tenant; nunca devolvem o registro inteiro. */

export async function saleDetail(tx: Tx, tenantId: string, saleId: string) {
  const sale = await tx.sale.findFirst({
    where: { id: saleId, userId: tenantId },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      appointment: { select: { id: true, date: true, status: true } },
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          professional: { select: { id: true, name: true } },
          commission: { select: { amountCents: true, status: true, ruleType: true, ruleValue: true } },
          clientPackageItem: { select: { sessionValueCents: true, clientPackage: { select: { name: true } } } }
        }
      },
      receivable: {
        include: {
          transactions: {
            orderBy: { occurredAt: 'asc' },
            include: { paymentMethod: { select: { name: true, type: true } }, reversedBy: { select: { id: true } } }
          }
        }
      }
    }
  })
  if (!sale) throw notFound('Comanda')

  return {
    id: sale.id,
    origin: sale.origin,
    status: sale.status,
    description: sale.description,
    occurredAt: sale.occurredAt,
    client: sale.client,
    appointment: sale.appointment,
    subtotalCents: sale.subtotalCents,
    discountCents: sale.discountCents,
    totalCents: sale.totalCents,
    items: sale.items.map((i) => ({
      id: i.id,
      serviceId: i.serviceId,
      description: i.description,
      professionalId: i.professionalId,
      professionalName: i.professional?.name ?? null,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      discountCents: i.discountCents,
      totalCents: i.totalCents,
      feeCents: i.feeCents,
      clientPackageItemId: i.clientPackageItemId,
      productId: i.productId,
      packageName: i.clientPackageItem?.clientPackage.name ?? null,
      sessionValueCents: i.clientPackageItem?.sessionValueCents ?? null,
      commission: i.commission
    })),
    receivable: sale.receivable
      ? {
          id: sale.receivable.id,
          amountCents: sale.receivable.amountCents,
          paidCents: sale.receivable.paidCents,
          status: sale.receivable.status,
          payments: sale.receivable.transactions.map(serializeTransaction)
        }
      : null,
    editable:
      sale.status !== 'CANCELLED' &&
      sale.origin !== 'PACKAGE' &&
      (sale.receivable?.paidCents ?? 0) === 0 &&
      sale.items.every((i) => i.commission?.status !== 'SETTLED')
  }
}

type TransactionWithMethod = Prisma.FinancialTransactionGetPayload<{
  include: { paymentMethod: { select: { name: true; type: true } }; reversedBy: { select: { id: true } } }
}>

function serializeTransaction(t: TransactionWithMethod) {
  return {
    id: t.id,
    direction: t.direction,
    kind: t.kind,
    amountCents: t.amountCents,
    feeCents: t.feeCents,
    paymentMethod: t.paymentMethod?.name ?? null,
    paymentMethodType: t.paymentMethod?.type ?? null,
    description: t.description,
    occurredAt: t.occurredAt,
    reversed: Boolean(t.reversedBy),
    reversesId: t.reversesId
  }
}

/** Itens sugeridos para a comanda de um agendamento: serviços ativos do tenant e equipe. */
export async function saleFormOptions(tx: Tx, tenantId: string) {
  const [services, professionals, products] = await Promise.all([
    tx.service.findMany({ where: { userId: tenantId, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, price: true } }),
    tx.user.findMany({
      where: { masterId: tenantId, role: 'PROFESSIONAL', isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    }),
    tx.product.findMany({
      where: { userId: tenantId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, priceCents: true, stockQty: true, trackStock: true }
    })
  ])
  return {
    services: services.map((s) => ({ id: s.id, name: s.name, priceCents: toCents(s.price) })),
    professionals,
    products
  }
}

export type EntryFilter = 'open' | 'overdue' | 'paid' | 'all'

function statusWhere(filter: EntryFilter, todayStart: Date) {
  switch (filter) {
    case 'open':
      return { status: { in: ['OPEN', 'PARTIAL'] as ('OPEN' | 'PARTIAL')[] } }
    case 'overdue':
      return { status: { in: ['OPEN', 'PARTIAL'] as ('OPEN' | 'PARTIAL')[] }, dueDate: { lt: todayStart } }
    case 'paid':
      return { status: 'PAID' as const }
    default:
      return { status: { not: 'CANCELLED' as const } }
  }
}

export async function listReceivables(
  tx: Tx,
  tenantId: string,
  filter: EntryFilter,
  todayStart: Date,
  search?: string | null,
  clientId?: string | null
) {
  const rows = await tx.receivable.findMany({
    where: {
      userId: tenantId,
      ...statusWhere(filter, todayStart),
      ...(clientId && { clientId }),
      ...(search && {
        OR: [
          { description: { contains: search, mode: 'insensitive' as const } },
          { client: { name: { contains: search, mode: 'insensitive' as const } } }
        ]
      })
    },
    orderBy: filter === 'paid' ? { updatedAt: 'desc' } : { dueDate: 'asc' },
    take: 200,
    include: {
      client: { select: { id: true, name: true } },
      category: { select: { name: true } },
      sale: { select: { id: true, origin: true } }
    }
  })
  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    clientName: r.client?.name ?? null,
    category: r.category.name,
    amountCents: r.amountCents,
    paidCents: r.paidCents,
    dueDate: r.dueDate,
    status: r.status,
    clientId: r.client?.id ?? null,
    saleId: r.sale?.id ?? null,
    origin: r.sale?.origin ?? 'MANUAL'
  }))
}

export async function receivableDetail(tx: Tx, tenantId: string, receivableId: string) {
  const r = await tx.receivable.findFirst({
    where: { id: receivableId, userId: tenantId },
    include: {
      client: { select: { id: true, name: true } },
      category: { select: { name: true } },
      transactions: {
        orderBy: { occurredAt: 'asc' },
        include: { paymentMethod: { select: { name: true, type: true } }, reversedBy: { select: { id: true } } }
      }
    }
  })
  if (!r) throw notFound('Conta a receber')
  return {
    id: r.id,
    description: r.description,
    clientName: r.client?.name ?? null,
    category: r.category.name,
    amountCents: r.amountCents,
    paidCents: r.paidCents,
    dueDate: r.dueDate,
    status: r.status,
    saleId: r.saleId,
    payments: r.transactions.map(serializeTransaction)
  }
}

export async function listPayables(tx: Tx, tenantId: string, filter: EntryFilter, todayStart: Date) {
  const rows = await tx.payable.findMany({
    where: { userId: tenantId, ...statusWhere(filter, todayStart) },
    orderBy: filter === 'paid' ? { updatedAt: 'desc' } : { dueDate: 'asc' },
    take: 200,
    include: {
      category: { select: { name: true } },
      transactions: {
        orderBy: { occurredAt: 'asc' },
        include: { paymentMethod: { select: { name: true, type: true } }, reversedBy: { select: { id: true } } }
      }
    }
  })
  return rows.map((p) => ({
    id: p.id,
    description: p.description,
    supplier: p.supplier,
    category: p.category.name,
    amountCents: p.amountCents,
    paidCents: p.paidCents,
    dueDate: p.dueDate,
    status: p.status,
    installment: p.installment,
    ofInstallments: p.ofInstallments,
    seriesId: p.seriesId,
    payments: p.transactions.map(serializeTransaction)
  }))
}

/** Equipe com regras de comissão, pendências e permissão de caixa. */
export async function teamOverview(tx: Tx, tenantId: string) {
  const [professionals, rules, pending, adjustments, services] = await Promise.all([
    tx.user.findMany({
      where: { masterId: tenantId, role: 'PROFESSIONAL' },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, email: true, isActive: true, canOperateCash: true }
    }),
    tx.commissionRule.findMany({ where: { userId: tenantId }, include: { service: { select: { name: true } } } }),
    tx.commission.groupBy({
      by: ['professionalId'],
      where: { userId: tenantId, status: 'PENDING' },
      _sum: { amountCents: true },
      _count: true
    }),
    tx.professionalAdjustment.findMany({
      where: { userId: tenantId, settlementId: null, cancelledAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, professionalId: true, kind: true, amountCents: true, description: true, createdAt: true }
    }),
    tx.service.findMany({ where: { userId: tenantId, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, price: true } })
  ])
  const owner = await tx.user.findUnique({ where: { id: tenantId }, select: { email: true } })

  return {
    services: services.map((s) => ({ id: s.id, name: s.name, priceCents: toCents(s.price) })),
    professionals: professionals.map((p) => {
      const own = rules.filter((r) => r.professionalId === p.id)
      const pend = pending.find((x) => x.professionalId === p.id)
      return {
        id: p.id,
        name: p.name,
        email: p.email,
        isActive: p.isActive,
        isOwner: p.email === owner?.email,
        canOperateCash: p.canOperateCash,
        defaultRule: serializeRule(own.find((r) => r.serviceId === null)),
        serviceRules: own.filter((r) => r.serviceId !== null).map((r) => ({ ...serializeRule(r)!, serviceName: r.service?.name ?? '' })),
        pendingCents: pend?._sum.amountCents ?? 0,
        pendingCount: pend?._count ?? 0,
        openAdjustments: adjustments.filter((a) => a.professionalId === p.id)
      }
    })
  }
}

function serializeRule(rule: { id: string; serviceId: string | null; type: 'PERCENT' | 'FIXED'; valueBps: number | null; valueCents: number | null } | undefined) {
  if (!rule) return null
  return { id: rule.id, serviceId: rule.serviceId, type: rule.type, valueBps: rule.valueBps, valueCents: rule.valueCents }
}

export async function listSettlements(tx: Tx, tenantId: string, professionalId?: string | null) {
  const rows = await tx.commissionSettlement.findMany({
    where: { userId: tenantId, ...(professionalId && { professionalId }) },
    orderBy: { paidAt: 'desc' },
    take: 100,
    include: { professional: { select: { name: true } }, paymentMethod: { select: { name: true } } }
  })
  return rows.map((s) => ({
    id: s.id,
    professionalId: s.professionalId,
    professionalName: s.professional.name,
    paidAt: s.paidAt,
    status: s.status,
    commissionsCents: s.commissionsCents,
    bonusesCents: s.bonusesCents,
    deductionsCents: s.deductionsCents,
    netCents: s.netCents,
    paymentMethod: s.paymentMethod?.name ?? null
  }))
}

export async function listCashSessions(tx: Tx, tenantId: string) {
  const rows = await tx.cashSession.findMany({
    where: { userId: tenantId },
    orderBy: { openedAt: 'desc' },
    take: 60,
    include: { openedBy: { select: { name: true } }, closedBy: { select: { name: true } } }
  })
  return rows.map((s) => ({
    id: s.id,
    status: s.status,
    openedAt: s.openedAt,
    openedBy: s.openedBy.name,
    closedAt: s.closedAt,
    closedBy: s.closedBy?.name ?? null,
    openingCents: s.openingCents,
    expectedCashCents: s.expectedCashCents,
    countedCashCents: s.countedCashCents,
    differenceCents: s.differenceCents
  }))
}
