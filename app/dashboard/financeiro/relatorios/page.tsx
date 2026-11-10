'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Money } from '@/components/finance/money'
import { financeFetch } from '@/lib/finance/client'
import type { CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'
import { FinanceShell } from '../_components/finance-shell'
import { CashFlowChart, type FlowDay } from '../_components/cash-flow-chart'

interface Line {
  key: string
  label: string
  cents: number
}

interface Statement {
  income: Line[]
  expense: Line[]
  incomeCents: number
  expenseCents: number
  resultCents: number
}

interface Report {
  from: string
  to: string
  statement: { cash: Statement; accrual: Statement }
  cashFlow: { days: FlowDay[]; overdueInCents: number; overdueOutCents: number }
}

type Preset = 'month' | 'last-month' | '30d' | 'custom'

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function presetRange(preset: Exclude<Preset, 'custom'>) {
  const today = new Date()
  if (preset === 'month') return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) }
  if (preset === 'last-month') {
    return { from: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: iso(new Date(today.getFullYear(), today.getMonth(), 0)) }
  }
  return { from: iso(new Date(today.getTime() - 29 * 86_400_000)), to: iso(today) }
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'month', label: 'Este mês' },
  { value: 'last-month', label: 'Mês passado' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Período' }
]

const shortDay = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })

export default function ReportsPage() {
  return (
    <FinanceShell title="Relatórios" description="Resultado do período e o caixa dos próximos 30 dias." access="master">
      {(finance) => <ReportsContent currency={finance.currency} />}
    </FinanceShell>
  )
}

function ReportsContent({ currency }: { currency: CurrencyCode }) {
  const [preset, setPreset] = useState<Preset>('month')
  const [range, setRange] = useState(presetRange('month'))
  const [regime, setRegime] = useState<'cash' | 'accrual'>('cash')
  const [report, setReport] = useState<Report | null>(null)

  const load = useCallback(async () => {
    try {
      setReport(await financeFetch<Report>(`/api/finance/reports?from=${range.from}&to=${range.to}&days=30`))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar relatórios')
    }
  }, [range])

  useEffect(() => {
    void load()
  }, [load])

  const statement = report?.statement[regime]
  const movingDays = useMemo(() => report?.cashFlow.days.filter((d) => d.inCents || d.outCents) ?? [], [report])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div role="tablist" className="grid grid-cols-4 rounded-lg bg-muted p-1">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="tab"
              aria-selected={preset === p.value}
              onClick={() => {
                setPreset(p.value)
                if (p.value !== 'custom') setRange(presetRange(p.value))
              }}
              className={cn('rounded-md py-1.5 text-xs font-medium transition-all sm:text-sm', preset === p.value ? 'bg-background shadow-sm' : 'text-muted-foreground')}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} aria-label="De" />
            <Input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} aria-label="Até" />
          </div>
        )}
      </div>

      {!report || !statement ? (
        <div className="space-y-3">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {/* DRE */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resultado</h2>
              <div role="radiogroup" aria-label="Regime" className="grid grid-cols-2 rounded-lg bg-muted p-0.5 text-xs">
                {[
                  { value: 'cash' as const, label: 'Caixa' },
                  { value: 'accrual' as const, label: 'Competência' }
                ].map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={regime === r.value}
                    onClick={() => setRegime(r.value)}
                    className={cn('rounded-md px-3 py-1 font-medium transition-all', regime === r.value ? 'bg-background shadow-sm' : 'text-muted-foreground')}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {regime === 'cash'
                ? 'O que de fato entrou e saiu no período.'
                : 'O que foi vendido e o que venceu no período, pago ou não. Inclui comissões geradas.'}
            </p>

            <Card className="border border-border">
              <CardContent className="space-y-4 p-4">
                <StatementBlock title="Receitas" lines={statement.income} total={statement.incomeCents} currency={currency} />
                <Separator />
                <StatementBlock title="Despesas" lines={statement.expense} total={statement.expenseCents} currency={currency} negative />
                <div className="flex items-end justify-between rounded-xl bg-muted/60 px-4 py-3">
                  <span className="text-sm font-medium">Resultado</span>
                  <Money
                    cents={statement.resultCents}
                    currency={currency}
                    signed
                    className={cn('text-2xl font-semibold tracking-tight', statement.resultCents < 0 && 'text-destructive')}
                  />
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Fluxo projetado */}
          <section className="space-y-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saldo projetado · 30 dias</h2>
              <p className="text-[11px] text-muted-foreground">Contas a receber menos contas a pagar em aberto, pelo vencimento.</p>
            </div>
            <Card className="border border-border">
              <CardContent className="space-y-4 p-4">
                <CashFlowChart days={report.cashFlow.days} currency={currency} />
                {(report.cashFlow.overdueInCents > 0 || report.cashFlow.overdueOutCents > 0) && (
                  <p className="text-[11px] text-muted-foreground">
                    Inclui vencidos no primeiro dia: <Money cents={report.cashFlow.overdueInCents} currency={currency} /> a receber e{' '}
                    <Money cents={report.cashFlow.overdueOutCents} currency={currency} /> a pagar.
                  </p>
                )}
                {movingDays.length > 0 && (
                  <table className="w-full text-sm">
                    <caption className="sr-only">Dias com vencimentos</caption>
                    <thead>
                      <tr className="text-[11px] text-muted-foreground">
                        <th className="pb-1 text-left font-normal">Dia</th>
                        <th className="pb-1 text-right font-normal">Entra</th>
                        <th className="pb-1 text-right font-normal">Sai</th>
                        <th className="pb-1 text-right font-normal">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movingDays.map((d) => (
                        <tr key={d.date} className="border-t border-border/60">
                          <td className="py-1.5 capitalize">{shortDay.format(new Date(`${d.date}T12:00:00Z`))}</td>
                          <td className="py-1.5 text-right">{d.inCents ? <Money cents={d.inCents} currency={currency} /> : '—'}</td>
                          <td className="py-1.5 text-right">{d.outCents ? <Money cents={d.outCents} currency={currency} /> : '—'}</td>
                          <td className={cn('py-1.5 text-right font-medium', d.balanceCents < 0 && 'text-destructive')}>
                            <Money cents={d.balanceCents} currency={currency} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}

function StatementBlock({ title, lines, total, currency, negative }: { title: string; lines: Line[]; total: number; currency: CurrencyCode; negative?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-medium">
        <span>{title}</span>
        <Money cents={negative ? -total : total} currency={currency} signed={negative && total > 0} />
      </div>
      {lines.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nada no período.</p>
      ) : (
        <ul className="space-y-1.5">
          {lines.map((l) => (
            <li key={l.key} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{l.label}</span>
              <Money cents={l.cents} currency={currency} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
