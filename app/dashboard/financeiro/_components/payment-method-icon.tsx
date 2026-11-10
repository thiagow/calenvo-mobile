import { Banknote, CreditCard, Landmark, QrCode, Wallet, type LucideIcon } from 'lucide-react'
import type { PaymentMethodType } from './types'

export const PAYMENT_METHOD_TYPES: { value: PaymentMethodType; label: string; icon: LucideIcon }[] = [
  { value: 'CASH', label: 'Dinheiro', icon: Banknote },
  { value: 'PIX', label: 'Pix', icon: QrCode },
  { value: 'DEBIT', label: 'Débito', icon: CreditCard },
  { value: 'CREDIT', label: 'Crédito', icon: CreditCard },
  { value: 'TRANSFER', label: 'Transferência', icon: Landmark },
  { value: 'OTHER', label: 'Outro', icon: Wallet }
]

export function paymentMethodMeta(type: PaymentMethodType) {
  return PAYMENT_METHOD_TYPES.find((t) => t.value === type) ?? PAYMENT_METHOD_TYPES[PAYMENT_METHOD_TYPES.length - 1]
}
