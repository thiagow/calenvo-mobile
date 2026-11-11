/** Formatos das respostas das rotas /api/finance/* usados pelas telas. */

export type EntryStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'CANCELLED'

export interface TransactionDto {
  id: string
  direction: 'IN' | 'OUT'
  kind: string
  amountCents: number
  feeCents: number
  paymentMethod: string | null
  paymentMethodType?: string | null
  description: string | null
  occurredAt: string
  createdBy?: string | null
  reversed: boolean
  reversesId: string | null
}

export interface SaleItemDto {
  id: string
  serviceId: string | null
  description: string
  professionalId: string | null
  professionalName: string | null
  quantity: number
  unitPriceCents: number
  discountCents: number
  totalCents: number
  feeCents: number
  clientPackageItemId: string | null
  productId: string | null
  packageName: string | null
  sessionValueCents: number | null
  commission: { amountCents: number; status: string; ruleType: 'PERCENT' | 'FIXED'; ruleValue: number } | null
}

export interface SaleDto {
  id: string
  origin: 'APPOINTMENT' | 'PACKAGE' | 'MANUAL'
  status: 'OPEN' | 'CLOSED' | 'CANCELLED'
  description: string
  occurredAt: string
  client: { id: string; name: string; phone: string } | null
  appointment: { id: string; date: string; status: string } | null
  subtotalCents: number
  discountCents: number
  totalCents: number
  items: SaleItemDto[]
  receivable: { id: string; amountCents: number; paidCents: number; status: EntryStatus; payments: TransactionDto[] } | null
  editable: boolean
}

export interface SaleOptionsDto {
  services: { id: string; name: string; priceCents: number | null }[]
  professionals: { id: string; name: string | null }[]
  products: ProductOptionDto[]
}

export interface ProductOptionDto {
  id: string
  name: string
  priceCents: number
  stockQty: number
  trackStock: boolean
}

export interface PaymentMethodDto {
  id: string
  name: string
  type: string
  feeBps: number
  feeFixedCents: number
  isActive: boolean
}

export const KIND_LABELS: Record<string, string> = {
  RECEIPT: 'Recebimento',
  PAYMENT: 'Pagamento',
  SUPPLY: 'Suprimento',
  WITHDRAWAL: 'Sangria',
  COMMISSION_PAYOUT: 'Acerto',
  ADVANCE: 'Vale',
  REVERSAL: 'Estorno'
}

export const STATUS_LABELS: Record<EntryStatus, string> = {
  OPEN: 'Em aberto',
  PARTIAL: 'Parcial',
  PAID: 'Pago',
  CANCELLED: 'Cancelado'
}

/** Produto do catálogo (tela de Produtos). */
export interface ProductDto {
  id: string
  name: string
  description: string | null
  sku: string | null
  category: string | null
  priceCents: number
  costCents: number | null
  isActive: boolean
  trackStock: boolean
  stockQty: number
  minStockQty: number | null
}

export interface StockMovementDto {
  id: string
  kind: 'INITIAL' | 'PURCHASE' | 'ADJUSTMENT' | 'SALE' | 'SALE_REVERSAL'
  quantity: number
  balanceAfter: number
  note: string | null
  createdAt: string
  createdBy: string | null
}

export const STOCK_KIND_LABELS: Record<StockMovementDto['kind'], string> = {
  INITIAL: 'Saldo inicial',
  PURCHASE: 'Compra',
  ADJUSTMENT: 'Ajuste',
  SALE: 'Venda',
  SALE_REVERSAL: 'Devolução'
}

/** Previsão de recebimento (resposta de /api/finance/forecast). */
export interface ForecastDayDto {
  date: string
  confirmedCents: number
  unconfirmedCents: number
  receivablesCents: number
  appointments: number
}

export interface ForecastDto {
  days: ForecastDayDto[]
  totals: {
    confirmedCents: number
    unconfirmedCents: number
    receivablesCents: number
    scheduledCents: number
    expectedAppointmentsCents: number
    expectedTotalCents: number
  }
  appointmentCount: number
  noPriceCount: number
  packageSessions: number
  showRate: number | null
  showRateSample: number
  byProfessional: { id: string | null; name: string; cents: number; count: number }[]
}

export interface ForecastAppointmentDto {
  id: string
  date: string
  status: 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS'
  clientName: string
  serviceName: string | null
  professionalName: string | null
  priceCents: number | null
  isPackageSession: boolean
}
