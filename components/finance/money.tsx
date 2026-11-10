'use client'

import { forwardRef, useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { formatMoney, parseMoneyInput, type CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'

/** Valor em dinheiro com algarismos tabulares (colunas alinham). */
export function Money({
  cents,
  currency = 'BRL',
  className,
  signed = false
}: {
  cents: number
  currency?: CurrencyCode
  className?: string
  /** Mostra "+" em positivos e "−" em negativos. */
  signed?: boolean
}) {
  const formatted = formatMoney(Math.abs(cents), currency)
  const prefix = signed ? (cents > 0 ? '+ ' : cents < 0 ? '− ' : '') : cents < 0 ? '− ' : ''
  return <span className={cn('tabular-nums', className)}>{prefix}{formatted}</span>
}

const toText = (cents: number | null) => (cents == null ? '' : (cents / 100).toFixed(2).replace('.', ','))

interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  valueCents: number | null
  onValueChange: (cents: number | null) => void
  currency?: CurrencyCode
}

/**
 * Campo de valor: o usuário digita livre ("150", "150,5", "1.234,56") e o
 * componente entrega centavos. Inválido → null (o formulário decide o erro).
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { valueCents, onValueChange, currency = 'BRL', className, onBlur, ...props },
  ref
) {
  const [text, setText] = useState(toText(valueCents))

  // Sincroniza quando o valor muda por fora (ex.: "receber o restante").
  useEffect(() => {
    const parsed = text.trim() ? parseMoneyInput(text) : null
    if (parsed !== valueCents) setText(toText(valueCents))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueCents])

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        {currency === 'USD' ? '$' : 'R$'}
      </span>
      <Input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        {...props}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onValueChange(e.target.value.trim() ? parseMoneyInput(e.target.value) : null)
        }}
        onBlur={(e) => {
          const parsed = text.trim() ? parseMoneyInput(text) : null
          if (parsed != null) setText(toText(parsed))
          onBlur?.(e)
        }}
        className={cn('pl-9 tabular-nums', className)}
      />
    </div>
  )
})
