'use client'

import { ArrowDownRight, ArrowUpRight, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Money } from '@/components/finance/money'
import { KIND_LABELS } from '@/components/finance/types'
import type { CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'

export interface CashReport {
  session: {
    id: string
    status: 'OPEN' | 'CLOSED'
    openedAt: string
    openedBy: string | null
    openingCents: number
    closedAt: string | null
    closedBy: string | null
    expectedCashCents: number | null
    countedCashCents: number | null
    differenceCents: number | null
    notes: string | null
  }
  summary: {
    openingCents: number
    cashInCents: number
    cashOutCents: number
    expectedCashCents: number
    totalInCents: number
    totalOutCents: number
    totalFeesCents: number
    byMethod: { paymentMethodId: string | null; name: string; type: string; inCents: number; outCents: number; feeCents: number }[]
  }
  byProfessional: { professionalId: string | null; name: string; receivedCents: number }[]
  transactions: {
    id: string
    direction: 'IN' | 'OUT'
    kind: string
    amountCents: number
    feeCents: number
    paymentMethod: string | null
    description: string | null
    occurredAt: string
    createdBy: string | null
    reversed: boolean
    reversesId: string | null
  }[]
}

const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function CashBreakdown({ report, currency }: { report: CashReport; currency: CurrencyCode }) {
  const { summary } = report
  const net = summary.totalInCents - summary.totalOutCents
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="border border-border">
        <CardContent className="space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Por forma de pagamento</p>
          {summary.byMethod.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento ainda.</p>
          ) : (
            <ul className="space-y-2">
              {summary.byMethod.map((m) => (
                <li key={m.paymentMethodId ?? 'none'} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{m.name}</span>
                  <span className="text-right">
                    <Money cents={m.inCents - m.outCents} currency={currency} className="font-medium" />
                    {m.feeCents > 0 && (
                      <span className="block text-[11px] text-muted-foreground">
                        taxa <Money cents={m.feeCents} currency={currency} />
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Movimento líquido</span>
            <Money cents={net} currency={currency} signed className="font-semibold" />
          </div>
          {summary.totalFeesCents > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Taxas das operadoras</span>
              <Money cents={summary.totalFeesCents} currency={currency} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardContent className="space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recebido por profissional</p>
          {report.byProfessional.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum atendimento recebido neste caixa.</p>
          ) : (
            <ul className="space-y-2.5">
              {report.byProfessional.map((p) => {
                const max = Math.max(...report.byProfessional.map((x) => x.receivedCents), 1)
                return (
                  <li key={p.professionalId ?? 'none'} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="truncate">{p.name}</span>
                      <Money cents={p.receivedCents} currency={currency} className="font-medium" />
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (p.receivedCents / max) * 100)}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function CashTransactions({
  report,
  currency,
  onReverse
}: {
  report: CashReport
  currency: CurrencyCode
  /** Só para o dono. Ausente = sem botão de estorno. */
  onReverse?: (transactionId: string) => void
}) {
  if (report.transactions.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lançamento neste caixa.</p>
  }
  const reversible = new Set(['RECEIPT', 'PAYMENT', 'SUPPLY', 'WITHDRAWAL'])
  return (
    <Card className="overflow-hidden border border-border">
      <CardContent className="p-0">
        <ul>
          {[...report.transactions].reverse().map((t, index) => (
            <li key={t.id}>
              {index > 0 && <Separator />}
              <div className={cn('flex items-center gap-3 px-4 py-3', t.reversed && 'opacity-50')}>
                <span
                  className={cn(
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                    t.direction === 'IN' ? 'bg-money-positive/10 text-money-positive' : 'bg-money-negative/10 text-money-negative'
                  )}
                >
                  {t.direction === 'IN' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm', t.reversed && 'line-through')}>{t.description ?? KIND_LABELS[t.kind]}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {time.format(new Date(t.occurredAt))} · {KIND_LABELS[t.kind] ?? t.kind}
                    {t.paymentMethod && ` · ${t.paymentMethod}`}
                    {t.createdBy && ` · ${t.createdBy}`}
                  </p>
                </div>
                <div className="text-right">
                  <Money cents={t.direction === 'IN' ? t.amountCents : -t.amountCents} currency={currency} signed className="text-sm font-medium" />
                  {t.reversed && (
                    <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">
                      estornado
                    </Badge>
                  )}
                </div>
                {onReverse && reversible.has(t.kind) && !t.reversed && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => onReverse(t.id)} aria-label="Estornar">
                    <Undo2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
