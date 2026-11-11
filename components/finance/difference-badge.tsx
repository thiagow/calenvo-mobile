import { CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react'
import { formatMoney, type CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'

/**
 * Diferença de caixa (contado − esperado). Ícone + texto + cor: a cor nunca é o
 * único sinal. Falta é o pior caso (vermelho); sobra pede conferência (âmbar).
 */
export function DifferenceBadge({
  cents,
  currency,
  compact = false,
  className
}: {
  cents: number
  currency: CurrencyCode
  /** Versão curta para listas ("Falta R$ 5,00"). */
  compact?: boolean
  className?: string
}) {
  const exact = cents === 0
  const short = cents < 0
  const Icon = exact ? CheckCircle2 : short ? TrendingDown : TrendingUp
  const tone = exact ? 'text-money-positive' : short ? 'text-money-negative' : 'text-money-warn'
  const amount = formatMoney(Math.abs(cents), currency)
  const label = exact ? (compact ? 'Certinho' : 'Bateu certinho') : short ? `Falta ${amount}` : `Sobra ${amount}`

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium tabular-nums', tone, compact ? 'text-xs' : 'text-sm', className)}>
      <Icon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
      {label}
    </span>
  )
}
