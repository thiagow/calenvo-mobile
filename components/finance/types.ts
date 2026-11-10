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
