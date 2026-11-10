import type { Prisma } from '@prisma/client'
import { allocateProportionally, toCents } from './money'
import { commissionBaseFor, computeCommission, resolveCommissionRule } from './commission'
import { computeSessionValues } from './package-session-value'
import { deriveEntryStatus } from './entries'
import {
  assertProfessionals,
  assertServices,
  loadSettings,
  lockRow,
  systemCategoryId,
  type FinanceSettings,
  type Tx
} from './context'
import { badRequest, conflict, notFound } from './errors'

/**
 * Comanda (Sale): o que foi vendido, com um item por serviço executado.
 * Cada item com profissional gera uma Commission; a comanda gera um único
 * Receivable com o total. Tudo aqui roda dentro de uma transação do chamador.
 */

export interface SaleItemInput {
  serviceId?: string | null
  description: string
  professionalId?: string | null
  quantity: number
  unitPriceCents: number
  discountCents?: number
  clientPackageItemId?: string | null
}

interface PreparedItem {
  serviceId: string | null
  description: string
  professionalId: string | null
  quantity: number
  unitPriceCents: number
  discountCents: number
  totalCents: number
  clientPackageItemId: string | null
  sessionValueCents: number | null
  sortOrder: number
}

export interface SaleTotals {
  subtotalCents: number
  discountCents: number
  totalCents: number
}

/**
 * Totais de uma comanda. O desconto da comanda é rateado entre os itens pelo
 * valor de cada um (comissão incide sobre o que de fato foi cobrado do item).
 * Exportada para testes e para o preview da UI.
 */
export function computeSaleLines(
  items: { quantity: number; unitPriceCents: number; discountCents?: number }[],
  saleDiscountCents = 0
): { lines: { discountCents: number; totalCents: number }[]; totals: SaleTotals } {
  const gross = items.map((i) => i.quantity * i.unitPriceCents)
  const afterItemDiscount = items.map((i, idx) => {
    const discount = i.discountCents ?? 0
    if (discount > gross[idx]) throw badRequest('Desconto do item maior que o valor do item')
    return gross[idx] - discount
  })
  const subtotalAfterItems = afterItemDiscount.reduce((a, b) => a + b, 0)
  if (saleDiscountCents > subtotalAfterItems) throw badRequest('Desconto maior que o total da comanda')

  const shares = saleDiscountCents > 0 ? allocateProportionally(saleDiscountCents, afterItemDiscount) : items.map(() => 0)
  const lines = items.map((i, idx) => ({
    discountCents: (i.discountCents ?? 0) + shares[idx],
    totalCents: afterItemDiscount[idx] - shares[idx]
  }))
  const subtotalCents = gross.reduce((a, b) => a + b, 0)
  const totalCents = lines.reduce((a, l) => a + l.totalCents, 0)
  return { lines, totals: { subtotalCents, discountCents: subtotalCents - totalCents, totalCents } }
}

/** Valor da sessão de um item de pacote; calcula e grava para o pacote inteiro se ainda não existir. */
async function ensureSessionValue(tx: Tx, clientPackageItemId: string): Promise<number> {
  const item = await tx.clientPackageItem.findUnique({
    where: { id: clientPackageItemId },
    select: {
      sessionValueCents: true,
      clientPackage: {
        select: {
          price: true,
          items: { select: { id: true, totalSessions: true, service: { select: { price: true } } }, orderBy: { id: 'asc' } }
        }
      }
    }
  })
  if (!item) throw notFound('Item de pacote')
  if (item.sessionValueCents != null) return item.sessionValueCents

  const pkg = item.clientPackage
  const values = computeSessionValues(
    toCents(pkg.price) ?? 0,
    pkg.items.map((i) => ({ servicePriceCents: toCents(i.service.price), totalSessions: i.totalSessions }))
  )
  for (const [index, packageItem] of pkg.items.entries()) {
    await tx.clientPackageItem.update({ where: { id: packageItem.id }, data: { sessionValueCents: values[index] } })
  }
  return values[pkg.items.findIndex((i) => i.id === clientPackageItemId)]
}

async function prepareItems(tx: Tx, tenantId: string, items: SaleItemInput[]): Promise<PreparedItem[]> {
  if (items.length === 0) throw badRequest('A comanda precisa de pelo menos um item')
  await assertProfessionals(tx, tenantId, items.map((i) => i.professionalId).filter((v): v is string => Boolean(v)))
  await assertServices(tx, tenantId, items.map((i) => i.serviceId).filter((v): v is string => Boolean(v)))

  const prepared: PreparedItem[] = []
  for (const [index, item] of items.entries()) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw badRequest('Quantidade inválida')
    if (!Number.isInteger(item.unitPriceCents) || item.unitPriceCents < 0) throw badRequest('Preço inválido')

    let sessionValueCents: number | null = null
    let unitPriceCents = item.unitPriceCents
    if (item.clientPackageItemId) {
      const owned = await tx.clientPackageItem.count({
        where: { id: item.clientPackageItemId, clientPackage: { userId: tenantId } }
      })
      if (!owned) throw badRequest('Item de pacote inválido')
      // Sessão de pacote já foi paga na venda do pacote: não cobra de novo.
      sessionValueCents = await ensureSessionValue(tx, item.clientPackageItemId)
      unitPriceCents = 0
    }

    prepared.push({
      serviceId: item.serviceId ?? null,
      description: item.description.trim() || 'Item',
      professionalId: item.professionalId ?? null,
      quantity: item.quantity,
      unitPriceCents,
      discountCents: item.clientPackageItemId ? 0 : item.discountCents ?? 0,
      totalCents: 0,
      clientPackageItemId: item.clientPackageItemId ?? null,
      sessionValueCents,
      sortOrder: index
    })
  }
  return prepared
}

/** Grava itens + comissões de uma comanda (substitui os anteriores) e sincroniza o recebível. */
async function writeSaleContent(
  tx: Tx,
  params: {
    tenantId: string
    saleId: string
    items: PreparedItem[]
    saleDiscountCents: number
    settings: FinanceSettings
    clientId: string | null
    description: string
    dueDate: Date
    actorId: string | null
    categoryKey: 'services' | 'packages'
  }
) {
  const { tenantId, saleId, items, saleDiscountCents, settings } = params
  const { lines, totals } = computeSaleLines(items, saleDiscountCents)

  const existingReceivable = await tx.receivable.findUnique({ where: { saleId } })
  if (existingReceivable && existingReceivable.paidCents > 0) {
    throw conflict('Comanda com pagamento registrado não pode ser alterada. Estorne o pagamento antes.')
  }
  const settled = await tx.commission.count({ where: { saleItem: { saleId }, status: 'SETTLED' } })
  if (settled > 0) throw conflict('Esta comanda já entrou num acerto e não pode ser alterada')

  await tx.saleItem.deleteMany({ where: { saleId } }) // comissões PENDING caem em cascata

  const rules = await tx.commissionRule.findMany({ where: { userId: tenantId } })
  for (const [index, item] of items.entries()) {
    const line = lines[index]
    const base = commissionBaseFor(
      { totalCents: line.totalCents, feeCents: 0, sessionValueCents: item.sessionValueCents },
      settings.commissionBase
    )
    const created = await tx.saleItem.create({
      data: {
        saleId,
        serviceId: item.serviceId,
        description: item.description,
        professionalId: item.professionalId,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        discountCents: line.discountCents,
        totalCents: line.totalCents,
        clientPackageItemId: item.clientPackageItemId,
        commissionBaseCents: base,
        sortOrder: item.sortOrder
      }
    })

    if (item.professionalId) {
      const rule = resolveCommissionRule(rules, item.professionalId, item.serviceId)
      if (rule) {
        const result = computeCommission(rule, base, item.quantity)
        await tx.commission.create({
          data: {
            userId: tenantId,
            saleItemId: created.id,
            professionalId: item.professionalId,
            baseCents: base,
            ruleType: result.ruleType,
            ruleValue: result.ruleValue,
            amountCents: result.amountCents
          }
        })
      }
    }
  }

  const status = totals.totalCents === 0 ? 'CLOSED' : 'OPEN'
  await tx.sale.update({
    where: { id: saleId },
    data: { ...totals, status, closedAt: status === 'CLOSED' ? new Date() : null, description: params.description }
  })

  if (totals.totalCents === 0) {
    if (existingReceivable) await tx.receivable.delete({ where: { id: existingReceivable.id } })
    return
  }

  if (existingReceivable) {
    await tx.receivable.update({
      where: { id: existingReceivable.id },
      data: {
        amountCents: totals.totalCents,
        description: params.description,
        status: deriveEntryStatus(totals.totalCents, existingReceivable.paidCents),
        cancelledAt: null
      }
    })
  } else {
    await tx.receivable.create({
      data: {
        userId: tenantId,
        saleId,
        clientId: params.clientId,
        categoryId: await systemCategoryId(tx, tenantId, params.categoryKey),
        description: params.description,
        amountCents: totals.totalCents,
        dueDate: params.dueDate,
        createdById: params.actorId
      }
    })
  }
}

type AppointmentForSale = Prisma.AppointmentGetPayload<{
  select: {
    id: true
    userId: true
    date: true
    price: true
    clientId: true
    serviceId: true
    scheduleId: true
    professionalId: true
    clientPackageItemId: true
    specialty: true
    service: { select: { name: true; price: true } }
    client: { select: { name: true } }
  }
}>

async function loadAppointment(tx: Tx, tenantId: string, appointmentId: string): Promise<AppointmentForSale> {
  const appointment = await tx.appointment.findFirst({
    where: { id: appointmentId, userId: tenantId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      date: true,
      price: true,
      clientId: true,
      serviceId: true,
      scheduleId: true,
      professionalId: true,
      clientPackageItemId: true,
      specialty: true,
      service: { select: { name: true, price: true } },
      client: { select: { name: true } }
    }
  })
  if (!appointment) throw notFound('Agendamento')
  return appointment
}

/** Item padrão do agendamento: preço do agendamento > preço da agenda > preço do serviço. */
export async function defaultItemForAppointment(tx: Tx, appointment: AppointmentForSale): Promise<SaleItemInput> {
  let priceCents = toCents(appointment.price)
  if (priceCents == null && appointment.serviceId && appointment.scheduleId) {
    const scheduleService = await tx.scheduleService.findUnique({
      where: { scheduleId_serviceId: { scheduleId: appointment.scheduleId, serviceId: appointment.serviceId } },
      select: { customPrice: true }
    })
    priceCents = toCents(scheduleService?.customPrice)
  }
  priceCents ??= toCents(appointment.service?.price) ?? 0

  const name = appointment.service?.name ?? appointment.specialty ?? 'Atendimento'
  return {
    serviceId: appointment.serviceId,
    description: appointment.clientPackageItemId ? `${name} (sessão de pacote)` : name,
    professionalId: appointment.professionalId,
    quantity: 1,
    unitPriceCents: priceCents,
    discountCents: 0,
    clientPackageItemId: appointment.clientPackageItemId
  }
}

function saleDescription(appointment: AppointmentForSale) {
  const service = appointment.service?.name ?? appointment.specialty ?? 'Atendimento'
  return `${service} · ${appointment.client.name}`
}

/**
 * Comanda do agendamento concluído. Idempotente: se já existir, devolve a
 * existente (ou a reescreve quando `items` é informado — "Fechar comanda").
 */
export async function upsertSaleForAppointment(
  tx: Tx,
  params: {
    tenantId: string
    appointmentId: string
    actorId: string | null
    items?: SaleItemInput[]
    discountCents?: number
  }
) {
  const { tenantId, appointmentId } = params
  const appointment = await loadAppointment(tx, tenantId, appointmentId)
  const settings = await loadSettings(tx, tenantId)

  let sale = await tx.sale.findUnique({ where: { appointmentId } })
  if (sale && !params.items) return sale

  if (!sale) {
    sale = await tx.sale.create({
      data: {
        userId: tenantId,
        origin: 'APPOINTMENT',
        appointmentId,
        clientId: appointment.clientId,
        description: saleDescription(appointment),
        occurredAt: appointment.date,
        createdById: params.actorId
      }
    })
  } else {
    await lockRow(tx, 'Sale', sale.id)
    if (sale.status === 'CANCELLED') throw conflict('Comanda cancelada')
  }

  const items = params.items ?? [await defaultItemForAppointment(tx, appointment)]
  await writeSaleContent(tx, {
    tenantId,
    saleId: sale.id,
    items: await prepareItems(tx, tenantId, items),
    saleDiscountCents: params.discountCents ?? 0,
    settings,
    clientId: appointment.clientId,
    description: saleDescription(appointment),
    dueDate: appointment.date,
    actorId: params.actorId,
    categoryKey: 'services'
  })
  return tx.sale.findUniqueOrThrow({ where: { id: sale.id } })
}

/** Venda avulsa (sem agendamento): balcão, produto, serviço extra. */
export async function createManualSale(
  tx: Tx,
  params: {
    tenantId: string
    actorId: string
    clientId: string | null
    description: string
    items: SaleItemInput[]
    discountCents?: number
  }
) {
  if (params.clientId) {
    const owned = await tx.client.count({ where: { id: params.clientId, userId: params.tenantId } })
    if (!owned) throw badRequest('Cliente inválido')
  }
  const settings = await loadSettings(tx, params.tenantId)
  const now = new Date()
  const sale = await tx.sale.create({
    data: {
      userId: params.tenantId,
      origin: 'MANUAL',
      clientId: params.clientId,
      description: params.description,
      occurredAt: now,
      createdById: params.actorId
    }
  })
  await writeSaleContent(tx, {
    tenantId: params.tenantId,
    saleId: sale.id,
    items: await prepareItems(tx, params.tenantId, params.items),
    saleDiscountCents: params.discountCents ?? 0,
    settings,
    clientId: params.clientId,
    description: params.description,
    dueDate: now,
    actorId: params.actorId,
    categoryKey: 'services'
  })
  return tx.sale.findUniqueOrThrow({ where: { id: sale.id } })
}

/** Edita itens/desconto de uma comanda sem pagamento nem acerto. */
export async function updateSaleItems(
  tx: Tx,
  params: { tenantId: string; saleId: string; actorId: string; items: SaleItemInput[]; discountCents?: number }
) {
  const sale = await tx.sale.findFirst({ where: { id: params.saleId, userId: params.tenantId } })
  if (!sale) throw notFound('Comanda')
  if (sale.appointmentId) {
    return upsertSaleForAppointment(tx, {
      tenantId: params.tenantId,
      appointmentId: sale.appointmentId,
      actorId: params.actorId,
      items: params.items,
      discountCents: params.discountCents
    })
  }
  if (sale.origin === 'PACKAGE') throw conflict('A venda de pacote é ajustada pelo próprio pacote')
  if (sale.status === 'CANCELLED') throw conflict('Comanda cancelada')
  await lockRow(tx, 'Sale', sale.id)
  await writeSaleContent(tx, {
    tenantId: params.tenantId,
    saleId: sale.id,
    items: await prepareItems(tx, params.tenantId, params.items),
    saleDiscountCents: params.discountCents ?? 0,
    settings: await loadSettings(tx, params.tenantId),
    clientId: sale.clientId,
    description: sale.description,
    dueDate: sale.occurredAt,
    actorId: params.actorId,
    categoryKey: 'services'
  })
  return tx.sale.findUniqueOrThrow({ where: { id: sale.id } })
}

export type CancelSaleOutcome = 'cancelled' | 'none' | 'blocked_has_payments'

/**
 * Agendamento saiu de COMPLETED: cancela a comanda se não houver pagamento.
 * Comissão já acertada vira desconto no próximo acerto. A comanda é desligada
 * do agendamento (appointmentId = null) para que uma nova conclusão gere outra.
 */
export async function cancelSaleForAppointment(
  tx: Tx,
  params: { tenantId: string; appointmentId: string; actorId: string | null }
): Promise<CancelSaleOutcome> {
  const sale = await tx.sale.findUnique({ where: { appointmentId: params.appointmentId }, include: { receivable: true } })
  if (!sale || sale.userId !== params.tenantId || sale.status === 'CANCELLED') return 'none'
  await lockRow(tx, 'Sale', sale.id)
  if (sale.receivable && sale.receivable.paidCents > 0) return 'blocked_has_payments'
  await cancelSaleRecord(tx, { tenantId: params.tenantId, saleId: sale.id, actorId: params.actorId, reason: 'atendimento reaberto' })
  return 'cancelled'
}

export async function cancelSaleRecord(
  tx: Tx,
  params: { tenantId: string; saleId: string; actorId: string | null; reason: string }
) {
  const sale = await tx.sale.findFirst({ where: { id: params.saleId, userId: params.tenantId }, include: { receivable: true } })
  if (!sale) throw notFound('Comanda')
  if (sale.status === 'CANCELLED') return
  if (sale.receivable && sale.receivable.paidCents > 0) {
    throw conflict('Comanda com pagamento registrado. Estorne o pagamento antes de cancelar.')
  }

  const commissions = await tx.commission.findMany({
    where: { saleItem: { saleId: sale.id }, status: { not: 'CANCELLED' } },
    include: { saleItem: { select: { description: true } } }
  })
  for (const commission of commissions) {
    if (commission.status === 'SETTLED' && commission.amountCents > 0) {
      await tx.professionalAdjustment.create({
        data: {
          userId: params.tenantId,
          professionalId: commission.professionalId,
          kind: 'DEDUCTION',
          amountCents: commission.amountCents,
          description: `Estorno de comissão (${params.reason}): ${commission.saleItem.description}`,
          createdById: params.actorId
        }
      })
    } else if (commission.status === 'PENDING') {
      await tx.commission.update({ where: { id: commission.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } })
    }
  }

  if (sale.receivable) {
    await tx.receivable.update({ where: { id: sale.receivable.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } })
  }
  await tx.sale.update({
    where: { id: sale.id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), appointmentId: null, clientPackageId: null }
  })
}

/** Venda de pacote: receita entra aqui; as sessões depois só geram comissão. */
export async function createSaleForPackage(
  tx: Tx,
  params: { tenantId: string; clientPackageId: string; actorId: string | null }
) {
  const existing = await tx.sale.findUnique({ where: { clientPackageId: params.clientPackageId } })
  if (existing) return existing

  const pkg = await tx.clientPackage.findFirst({
    where: { id: params.clientPackageId, userId: params.tenantId },
    include: { client: { select: { name: true } }, items: { include: { service: { select: { price: true } } }, orderBy: { id: 'asc' } } }
  })
  if (!pkg) throw notFound('Pacote')

  const priceCents = toCents(pkg.price) ?? 0
  const values = computeSessionValues(
    priceCents,
    pkg.items.map((i) => ({ servicePriceCents: toCents(i.service.price), totalSessions: i.totalSessions }))
  )
  for (const [index, item] of pkg.items.entries()) {
    await tx.clientPackageItem.update({ where: { id: item.id }, data: { sessionValueCents: values[index] } })
  }

  const description = `Pacote ${pkg.name} · ${pkg.client.name}`
  const sale = await tx.sale.create({
    data: {
      userId: params.tenantId,
      origin: 'PACKAGE',
      clientPackageId: pkg.id,
      clientId: pkg.clientId,
      description,
      occurredAt: pkg.createdAt,
      createdById: params.actorId
    }
  })
  await writeSaleContent(tx, {
    tenantId: params.tenantId,
    saleId: sale.id,
    items: [
      {
        serviceId: null,
        description: `Pacote ${pkg.name}`,
        professionalId: null,
        quantity: 1,
        unitPriceCents: priceCents,
        discountCents: 0,
        totalCents: 0,
        clientPackageItemId: null,
        sessionValueCents: null,
        sortOrder: 0
      }
    ],
    saleDiscountCents: 0,
    settings: await loadSettings(tx, params.tenantId),
    clientId: pkg.clientId,
    description,
    dueDate: pkg.createdAt,
    actorId: params.actorId,
    categoryKey: 'packages'
  })
  return tx.sale.findUniqueOrThrow({ where: { id: sale.id } })
}
