'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, ChevronDown, Info, Package } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/finance/empty-state'
import { Money } from '@/components/finance/money'
import { AnimatedMoney } from '@/components/finance/animated-money'
import { SegmentedControl } from '@/components/finance/segmented-control'
import { StatCard } from '@/components/finance/stat-card'
import type { ForecastAppointmentDto, ForecastDayDto, ForecastDto } from '@/components/finance/types'
import { financeFetch } from '@/lib/finance/client'
import type { CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'
import { FinanceShell } from '../_components/finance-shell'
import { ForecastBars } from '../_components/forecast-bars'

const PERIODS = [
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '60', label: '60 dias' },
  { value: '90', label: '90 dias' }
] as const

const dayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })
const timeLabel = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dayOf = (date: string) => dayLabel.format(new Date(`${date}T12:00:00Z`))
const dayTotal = (d: ForecastDayDto) => d.confirmedCents + d.unconfirmedCents + d.receivablesCents

export default function ForecastPage() {
  return (
    <FinanceShell title="Previsão" description="O que deve entrar, pelos agendamentos e pelo que já está em aberto." access="master">
      {(finance) => <ForecastContent currency={finance.currency} />}
    </FinanceShell>
  )
}

function ForecastContent({ currency }: { currency: CurrencyCode }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['value']>('30')
  const [data, setData] = useState<ForecastDto | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      setData(await financeFetch<ForecastDto>(`/api/finance/forecast?days=${period}`))
    } catch (err) {
      setFailed(true)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar a previsão')
    }
  }, [period])

  useEffect(() => {
    setData(null)
    void load()
  }, [load])

  return (
    <div className="space-y-5">
      <SegmentedControl aria-label="Período da previsão" value={period} onChange={setPeriod} options={PERIODS} />

      {failed && !data ? (
        <ErrorState message="Não foi possível carregar a previsão." onRetry={() => void load()} />
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : data.appointmentCount === 0 && data.totals.receivablesCents === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nada previsto neste período"
          description="Não há agendamentos em aberto nem contas a receber nos próximos dias."
        />
      ) : (
        <ForecastBody data={data} currency={currency} days={Number(period)} />
      )}
    </div>
  )
}

function ForecastBody({ data, currency, days }: { data: ForecastDto; currency: CurrencyCode; days: number }) {
  const { totals } = data
  const rate = data.showRate != null ? Math.round(data.showRate * 100) : null

  return (
    <>
      <StatCard
        variant="hero"
        label={`Esperado nos próximos ${days} dias`}
        hint={
          rate != null ? (
            <>
              Confirmados + a confirmar × {rate}% de comparecimento (últimos 90 dias) + o que já está a receber.
            </>
          ) : (
            <>Ainda sem histórico suficiente para estimar faltas; os agendamentos entram por inteiro.</>
          )
        }
      >
        <AnimatedMoney cents={totals.expectedTotalCents} currency={currency} />
      </StatCard>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Confirmado">
          <Money cents={totals.confirmedCents} currency={currency} className="text-money-positive" />
        </StatCard>
        <StatCard label="A confirmar">
          <Money cents={totals.unconfirmedCents} currency={currency} className="text-money-warn" />
        </StatCard>
        <StatCard label="Já a receber">
          <Money cents={totals.receivablesCents} currency={currency} />
        </StatCard>
      </div>

      {(data.noPriceCount > 0 || data.packageSessions > 0) && (
        <ul className="space-y-2">
          {data.noPriceCount > 0 && (
            <li className="flex items-start gap-2.5 rounded-xl border border-money-warn/30 bg-money-warn/5 px-4 py-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-money-warn" aria-hidden="true" />
              <span>
                <span className="font-medium">{data.noPriceCount}</span> {data.noPriceCount === 1 ? 'atendimento está' : 'atendimentos estão'} sem preço e
                não entram na conta.{' '}
                <Link href="/dashboard/services" className="font-medium text-primary underline-offset-2 hover:underline">
                  Definir preços
                </Link>
              </span>
            </li>
          )}
          {data.packageSessions > 0 && (
            <li className="flex items-start gap-2.5 rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
              <Package className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>
                {data.packageSessions} {data.packageSessions === 1 ? 'sessão de pacote' : 'sessões de pacote'} no período: já foram pagas na venda do pacote e não geram caixa.
              </span>
            </li>
          )}
        </ul>
      )}

      <Card className="border border-border">
        <CardContent className="p-4">
          <ForecastBars days={data.days} currency={currency} />
        </CardContent>
      </Card>

      {data.byProfessional.length > 1 && (
        <section className="space-y-2">
          <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Por profissional</h2>
          <Card className="overflow-hidden border border-border">
            <CardContent className="p-0">
              {data.byProfessional.map((p, index) => (
                <div key={p.id ?? 'none'}>
                  {index > 0 && <Separator />}
                  <div className="flex min-h-12 items-center gap-3 px-4 py-2.5">
                    <p className="min-w-0 flex-1 truncate text-sm">{p.name}</p>
                    <span className="text-xs text-muted-foreground">
                      {p.count} {p.count === 1 ? 'atendimento' : 'atendimentos'}
                    </span>
                    <Money cents={p.cents} currency={currency} className="text-sm font-medium" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <DayList days={data.days} currency={currency} />
    </>
  )
}

function DayList({ days, currency }: { days: ForecastDayDto[]; currency: CurrencyCode }) {
  const active = days.filter((d) => d.appointments > 0 || d.receivablesCents > 0)
  const [openDate, setOpenDate] = useState<string | null>(null)
  if (active.length === 0) return null

  return (
    <section className="space-y-2">
      <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dia a dia</h2>
      <Card className="overflow-hidden border border-border">
        <CardContent className="p-0">
          {active.map((d, index) => {
            const expanded = openDate === d.date
            return (
              <div key={d.date}>
                {index > 0 && <Separator />}
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={'day-' + d.date}
                  onClick={() => setOpenDate(expanded ? null : d.date)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium capitalize">{dayOf(d.date)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {d.appointments} {d.appointments === 1 ? 'atendimento' : 'atendimentos'}
                      {d.receivablesCents > 0 && (
                        <>
                          {' · '}
                          <Money cents={d.receivablesCents} currency={currency} /> a receber
                        </>
                      )}
                    </span>
                  </span>
                  <Money cents={dayTotal(d)} currency={currency} className="text-sm font-semibold" />
                  <ChevronDown className={cn('h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
                </button>
                {expanded && <DayDetail id={'day-' + d.date} date={d.date} currency={currency} />}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </section>
  )
}

function DayDetail({ id, date, currency }: { id: string; date: string; currency: CurrencyCode }) {
  const [rows, setRows] = useState<ForecastAppointmentDto[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      setRows((await financeFetch<{ appointments: ForecastAppointmentDto[] }>(`/api/finance/forecast/day?date=${date}`)).appointments)
    } catch {
      setFailed(true)
    }
  }, [date])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div id={id} className="border-t border-border bg-muted/30 px-4 py-2">
      {failed ? (
        <ErrorState message="Não foi possível carregar os atendimentos." onRetry={() => void load()} className="py-4" />
      ) : rows === null ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : rows.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">Só contas a receber neste dia.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((a) => (
            <li key={a.id} className="flex min-h-12 items-center gap-3 py-2">
              <span className="w-12 flex-shrink-0 text-xs tabular-nums text-muted-foreground">{timeLabel.format(new Date(a.date))}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{a.clientName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[a.serviceName, a.professionalName].filter(Boolean).join(' · ') || 'Atendimento'}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                {a.isPackageSession ? (
                  <span className="text-xs text-muted-foreground">pacote</span>
                ) : a.priceCents == null ? (
                  <span className="text-xs font-medium text-money-warn">sem preço</span>
                ) : (
                  <Money cents={a.priceCents} currency={currency} className="text-sm font-medium" />
                )}
                <Badge variant={a.status === 'SCHEDULED' ? 'outline' : 'secondary'} className="text-xs">
                  {a.status === 'SCHEDULED' ? 'a confirmar' : a.status === 'CONFIRMED' ? 'confirmado' : 'em atendimento'}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
