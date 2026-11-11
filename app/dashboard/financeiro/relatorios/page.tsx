'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/finance/empty-state'
import { Money } from '@/components/finance/money'
import { SegmentedControl } from '@/components/finance/segmented-control'
import { financeFetch } from '@/lib/finance/client'
import { centsToNumber, downloadCsv, toCsv, type CsvCell } from '@/lib/finance/csv'
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

const REGIMES: { value: 'cash' | 'accrual'; label: string }[] = [
  { value: 'cash', label: 'Quando o dinheiro entrou' },
  { value: 'accrual', label: 'Quando foi vendido' }
]

const shortDay =new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })

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
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try {
      setReport(await financeFetch<Report>(`/api/finance/reports?from=${range.from}&to=${range.to}&days=30`))
      setFailed(false)
    } catch (err) {
      setFailed(true)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar relatórios')
    }
  }, [range])

  useEffect(() => {
    void load()
  }, [load])

  const exportCsv = () => {
    if (!report || !report.statement[regime]) return
    const st = report.statement[regime]
    const rows: CsvCell[][] = [
      ['Relatório financeiro', range.from + ' a ' + range.to],
      ['Regime', REGIMES.find((r) => r.value === regime)?.label],
      [],
      ['Receitas', 'Valor'],
      ...st.income.map((l) => [l.label, centsToNumber(l.cents)]),
      ['Total de receitas', centsToNumber(st.incomeCents)],
      [],
      ['Despesas', 'Valor'],
      ...st.expense.map((l) => [l.label, centsToNumber(l.cents)]),
      ['Total de despesas', centsToNumber(st.expenseCents)],
      [],
      ['Resultado', centsToNumber(st.resultCents)],
      [],
      ['Caixa projetado', 'Entra', 'Sai', 'Saldo'],
      ...report.cashFlow.days.map((d) => [d.date, centsToNumber(d.inCents), centsToNumber(d.outCents), centsToNumber(d.balanceCents)])
    ]
    downloadCsv('financeiro-' + range.from + '-a-' + range.to + '.csv', toCsv(rows))
  }

  const statement = report?.statement[regime]
  const movingDays = useMemo(() => report?.cashFlow.days.filter((d) => d.inCents || d.outCents) ?? [], [report])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SegmentedControl
          aria-label="Período"
          value={preset}
          options={PRESETS}
          onChange={(value) => {
            setPreset(value)
            if (value !== 'custom') setRange(presetRange(value))
          }}
        />
        {report && statement && (
          <div className="flex justify-end">
            <Button type="button" variant="ghost" className="min-h-11 text-muted-foreground" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Exportar CSV
            </Button>
          </div>
        )}
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} aria-label="De" />
            <Input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} aria-label="Até" />
          </div>
        )}
      </div>

      {(!report || !statement) && failed ? (
        <ErrorState message="Não foi possível carregar os relatórios." onRetry={() => void load()} />
      ) : !report || !statement ? (
        <div className="space-y-3">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {/* DRE */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resultado</h2>
            <SegmentedControl
              aria-label="Como contar o resultado"
              value={regime}
              onChange={setRegime}
              options={REGIMES}
            />
            <p className="text-xs text-muted-foreground">
              {regime === 'cash'
                ? 'Regime de caixa: o que de fato entrou e saiu no período.'
                : 'Regime de competência: o que foi vendido e o que venceu no período, pago ou não. Inclui comissões geradas.'}
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
                    tone="auto"
                    className="text-2xl font-semibold tracking-tight"
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
