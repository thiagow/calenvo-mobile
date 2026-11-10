'use client'

import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatMoney, type CurrencyCode } from '@/lib/finance/money'
import { computeFee } from '@/lib/finance/entries'
import { cn } from '@/lib/utils'
import { MoneyInput } from './money'

export interface PaymentMethodOption {
  id: string
  name: string
  type: string
  feeBps: number
  feeFixedCents: number
}

export interface PaymentRow {
  key: string
  paymentMethodId: string
  amountCents: number | null
}

export const newPaymentRow = (paymentMethodId: string, amountCents: number | null): PaymentRow => ({
  key: Math.random().toString(36).slice(2),
  paymentMethodId,
  amountCents
})

/** Formas de pagamento com valor — pagamento dividido (ex.: parte no Pix, parte em dinheiro). */
export function PaymentSplit({
  rows,
  onChange,
  methods,
  dueCents,
  currency
}: {
  rows: PaymentRow[]
  onChange: (rows: PaymentRow[]) => void
  methods: PaymentMethodOption[]
  dueCents: number
  currency: CurrencyCode
}) {
  const paid = rows.reduce((acc, r) => acc + (r.amountCents ?? 0), 0)
  const remaining = dueCents - paid
  const fees = rows.reduce((acc, r) => {
    const method = methods.find((m) => m.id === r.paymentMethodId)
    return acc + (method && r.amountCents ? computeFee(r.amountCents, method) : 0)
  }, 0)

  const update = (key: string, patch: Partial<PaymentRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <Select value={row.paymentMethodId} onValueChange={(v) => update(row.key, { paymentMethodId: v })}>
            <SelectTrigger className="flex-1" aria-label="Forma de pagamento">
              <SelectValue placeholder="Forma" />
            </SelectTrigger>
            <SelectContent>
              {methods.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="w-32">
            <MoneyInput
              valueCents={row.amountCents}
              onValueChange={(cents) => update(row.key, { amountCents: cents })}
              currency={currency}
              aria-label="Valor"
            />
          </div>
          {rows.length > 1 && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 flex-shrink-0"
              onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
              aria-label="Remover forma de pagamento"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between gap-2 pt-1">
        {remaining > 0 && methods.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-primary"
            onClick={() => onChange([...rows, newPaymentRow(methods.find((m) => !rows.some((r) => r.paymentMethodId === m.id))?.id ?? methods[0].id, remaining)])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Dividir pagamento
          </Button>
        ) : (
          <span />
        )}
        <p className={cn('text-xs tabular-nums', remaining < 0 ? 'text-destructive' : 'text-muted-foreground')}>
          {remaining > 0 && `Falta ${formatMoney(remaining, currency)}`}
          {remaining < 0 && `Passou ${formatMoney(-remaining, currency)}`}
          {remaining === 0 && fees > 0 && `Taxas da operadora: ${formatMoney(fees, currency)}`}
        </p>
      </div>
    </div>
  )
}
