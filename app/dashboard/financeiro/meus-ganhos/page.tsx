'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Clock, Package } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { AnimatedMoney } from '@/components/finance/animated-money'
import { ErrorState } from '@/components/finance/empty-state'
import { Money } from '@/components/finance/money'
import { financeFetch } from '@/lib/finance/client'
import { formatBps, formatMoney, type CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'
import { FinanceShell } from '../_components/finance-shell'

interface Line {
  id: string
  description: string
  clientName: string | null
  occurredAt: string
  baseCents: number
  ruleType: 'PERCENT' | 'FIXED'
  ruleValue: number
  amountCents: number
  isPackageSession: boolean
}

interface Earnings {
  currency: CurrencyCode
  totals: { commissionsCents: number; bonusesCents: number; deductionsCents: number; netCents: number }
  commissions: Line[]
  waitingPayment: Line[]
  waitingPaymentCents: number
  adjustments: { id: string; kind: 'ADVANCE' | 'BONUS' | 'DEDUCTION'; amountCents: number; description: string; createdAt: string }[]
  settlements: { id: string; paidAt: string; netCents: number; status: 'PAID' | 'CANCELLED'; paymentMethod: string | null }[]
}

const LABEL = { ADVANCE: 'Vale', BONUS: 'Bônus', DEDUCTION: 'Desconto' } as const
const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

/** Extrato do profissional: o que tem a receber, o que espera o cliente pagar e os acertos. Só leitura. */
export default function MyEarningsPage() {
  return (
    <FinanceShell title="Meus ganhos" description="O que você tem a receber e o que já foi acertado." access="any">
      {() => <EarningsContent />}
    </FinanceShell>
  )
}

function EarningsContent() {
  const [data, setData] = useState<Earnings | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    financeFetch<Earnings>('/api/finance/my-earnings')
      .then((d) => {
        setData(d)
        setFailed(false)
      })
      .catch((err) => {
        setFailed(true)
        toast.error(err instanceof Error ? err.message : 'Erro ao carregar seus ganhos')
      })
  }, [])

  useEffect(load, [load])

  if (!data && failed) return <ErrorState message="Não foi possível carregar seus ganhos." onRetry={load} />
  if (!data) return <Skeleton className="h-64 w-full rounded-2xl" />

  const { currency, totals } = data
  return (
    <div className="space-y-5">

      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative space-y-3">
          <p className="text-xs text-muted-foreground">A receber no próximo acerto</p>
          <AnimatedMoney cents={totals.netCents} currency={currency} tone={totals.netCents < 0 ? 'negative' : 'none'} className="block text-4xl font-semibold tracking-tight" />
          {totals.netCents < 0 && (
            <p className="text-xs text-muted-foreground">
              Seus vales e descontos passam das comissões. O acerto só acontece quando entrarem novas comissões.
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Comissões <Money cents={totals.commissionsCents} currency={currency} className="text-foreground" />
            </span>
            {totals.bonusesCents > 0 && (
              <span>
                Bônus <Money cents={totals.bonusesCents} currency={currency} className="text-foreground" />
              </span>
            )}
            {totals.deductionsCents > 0 && (
              <span>
                Vales <Money cents={-totals.deductionsCents} currency={currency} className="text-foreground" />
              </span>
            )}
          </div>
          {data.waitingPaymentCents > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Mais {formatMoney(data.waitingPaymentCents, currency)} quando os clientes pagarem
            </p>
          )}
        </div>
      </section>

      {(data.commissions.length > 0 || data.waitingPayment.length > 0) && (
        <section className="space-y-2">
          <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Atendimentos</h2>
          <Card className="overflow-hidden border border-border">
            <CardContent className="p-0">
              {[...data.commissions, ...data.waitingPayment].map((c, index) => {
                const waiting = data.waitingPayment.includes(c)
                return (
                  <div key={c.id}>
                    {index > 0 && <Separator />}
                    <div className={cn('flex items-center gap-3 px-4 py-3', waiting && 'opacity-60')}>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm">
                          {c.isPackageSession && <Package className="h-3.5 w-3.5 text-primary" />}
                          {c.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {day.format(new Date(c.occurredAt))}
                          {c.clientName && ` · ${c.clientName}`} · {c.ruleType === 'PERCENT' ? `${formatBps(c.ruleValue)}%` : 'fixo'}
                          {waiting && ' · aguardando pagamento'}
                        </p>
                      </div>
                      <Money cents={c.amountCents} currency={currency} className="text-sm font-medium" />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </section>
      )}

      {data.adjustments.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vales e bônus</h2>
          <Card className="border border-border">
            <CardContent className="space-y-2 p-4">
              {data.adjustments.map((a) => (
                <div key={a.id} className="flex justify-between text-sm">
                  <span>
                    {LABEL[a.kind]} · {a.description}
                  </span>
                  <Money cents={a.kind === 'BONUS' ? a.amountCents : -a.amountCents} currency={currency} signed />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {data.settlements.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acertos recebidos</h2>
          <Card className="overflow-hidden border border-border">
            <CardContent className="p-0">
              {data.settlements.map((s, index) => (
                <div key={s.id}>
                  {index > 0 && <Separator />}
                  <Link href={`/dashboard/financeiro/acertos/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                    <p className={cn('flex-1 text-sm', s.status === 'CANCELLED' && 'line-through opacity-60')}>
                      {day.format(new Date(s.paidAt))}
                      {s.paymentMethod && <span className="text-muted-foreground"> · {s.paymentMethod}</span>}
                    </p>
                    <Money cents={s.netCents} currency={currency} className="text-sm font-medium" />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {data.commissions.length === 0 && data.waitingPayment.length === 0 && data.settlements.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Seus atendimentos concluídos aparecem aqui.</p>
      )}
    </div>
  )
}
