'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Clock, Lock, Package } from 'lucide-react'
import { toast } from 'sonner'
import { BackButton } from '@/components/dashboard/back-button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Money } from '@/components/finance/money'
import { useFeatures } from '@/hooks/use-features'
import { financeFetch } from '@/lib/finance/client'
import { formatBps, formatMoney, type CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'

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
  const { features, isLoading } = useFeatures()
  const [data, setData] = useState<Earnings | null>(null)
  const active = features?.finance.active === true

  useEffect(() => {
    if (!active) return
    financeFetch<Earnings>('/api/finance/my-earnings')
      .then(setData)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar seus ganhos'))
  }, [active])

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />
  if (!active) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Lock className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">O Financeiro não está ativo nesta conta.</p>
      </div>
    )
  }
  if (!data) return <Skeleton className="h-64 w-full rounded-2xl" />

  const { currency, totals } = data
  return (
    <div className="space-y-5 pb-6">
      <BackButton />
      <header className="space-y-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Financeiro</p>
        <h1 className="text-2xl font-semibold tracking-tight">Meus ganhos</h1>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative space-y-3">
          <p className="text-xs text-muted-foreground">A receber no próximo acerto</p>
          <Money cents={Math.max(0, totals.netCents)} currency={currency} className="block text-4xl font-semibold tracking-tight" />
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
                        <p className="text-[11px] text-muted-foreground">
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
