'use client'

import { forwardRef, useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { formatMoney, parseMoneyInput, type CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'

export type MoneyTone = 'none' | 'auto' | 'positive' | 'negative' | 'warn' | 'muted'

const TONE_CLASS: Record<Exclude<MoneyTone, 'none' | 'auto'>, string> = {
  positive: 'text-money-positive',
  negative: 'text-money-negative',
  warn: 'text-money-warn',
  muted: 'text-muted-foreground'
}

/**
 * Valor em dinheiro com algarismos tabulares (colunas alinham).
 * `tone="auto"` colore negativo/positivo pelos tokens de contraste; o sinal
 * é lido por leitores de tela ("menos"/"mais"), nunca só pela cor.
 */
export function Money({
  cents,
  currency = 'BRL',
  className,
  signed = false,
  tone = 'none'
}: {
  cents: number
  currency?: CurrencyCode
  className?: string
  /** Mostra "+" em positivos e "−" em negativos. */
  signed?: boolean
  tone?: MoneyTone
}) {
  const formatted = formatMoney(Math.abs(cents), currency)
  const prefix = signed ? (cents > 0 ? '+ ' : cents < 0 ? '− ' : '') : cents < 0 ? '− ' : ''
  const spoken = cents < 0 ? 'menos ' : signed && cents > 0 ? 'mais ' : ''
  const resolved = tone === 'auto' ? (cents < 0 ? 'negative' : cents > 0 ? 'positive' : 'muted') : tone
  const toneClass = resolved === 'none' ? undefined : TONE_CLASS[resolved]
  return (
    <span className={cn('tabular-nums', toneClass, className)}>
      {prefix && <span aria-hidden="true">{prefix}</span>}
      {spoken && <span className="sr-only">{spoken}</span>}
      {formatted}
    </span>
  )
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
