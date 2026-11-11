'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, HandCoins, Landmark, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { BackButton } from '@/components/dashboard/back-button'
import { Skeleton } from '@/components/ui/skeleton'
import { AnimatedMoney } from '@/components/finance/animated-money'
import { Money } from '@/components/finance/money'
import { ErrorState } from '@/components/finance/empty-state'
import { FINANCE_CHANGED_EVENT } from '@/components/finance/close-sale-sheet'
import { useFeatures } from '@/hooks/use-features'
import { financeFetch } from '@/lib/finance/client'
import type { CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'
import { FinanceIntro } from './_components/finance-intro'
import { FinanceShell } from './_components/finance-shell'

interface Overview {
  today: string
  cashSession: { id: string; openedAt: string; openedBy: string | null; openingCents: number; expectedCashCents: number | null } | null
  cashSessionSummary: { totalInCents: number; totalOutCents: number; expectedCashCents: number } | null
  todayInCents: number
  todayOutCents: number
  receivablesNext7Cents: number
  receivablesOverdueCents: number
  payablesNext7Cents: number
  payablesOverdueCents: number
  pendingCommissionsCents: number
  pendingAppointments: number
}

const timeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

export default function FinanceHomePage() {
  const router = useRouter()
  const { features, isLoading, refresh } = useFeatures()
  const finance = features?.finance
  const [activating, setActivating] = useState(false)
  const [subscribing, setSubscribing] = useState(false)

  // Quem não é dono vai direto para a tela que pode usar.
  useEffect(() => {
    if (!finance?.active || finance.isMaster) return
    router.replace(finance.canOperateCash ? '/dashboard/financeiro/caixa' : '/dashboard/financeiro/meus-ganhos')
  }, [finance, router])

  if (isLoading || !finance) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!finance.active) {
    const activate = async () => {
      setActivating(true)
      try {
        await financeFetch('/api/finance/config', { method: 'PUT', body: JSON.stringify({ isActive: true }) })
        await refresh()
        toast.success('Financeiro ativado')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível ativar')
      } finally {
        setActivating(false)
      }
    }
    const subscribe = async () => {
      setSubscribing(true)
      try {
        await financeFetch('/api/finance/addon', { method: 'POST' })
        await refresh()
        toast.success('Financeiro adicionado à assinatura. Agora é só ativar.')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Não foi possível contratar')
      } finally {
        setSubscribing(false)
      }
    }
    return (
      <div className="space-y-4">
        <BackButton />
        <FinanceIntro
          entitled={finance.entitled && finance.isMaster}
          activating={activating}
          onActivate={activate}
          onSubscribe={finance.addonAvailable ? subscribe : undefined}
          subscribing={subscribing}
        />
      </div>
    )
  }

  if (!finance.isMaster) return null

  return (
    <FinanceShell title="Visão geral" access="master">
      {(f) => <OverviewContent currency={f.currency} />}
    </FinanceShell>
  )
}

function OverviewContent({ currency }: { currency: CurrencyCode }) {
  const [data, setData] = useState<Overview | null>(null)
  const [failed, setFailed] = useState(false)
  // Previsão de 7 dias: complemento da tela; se falhar, o tile só não aparece.
  const [forecast, setForecast] = useState<{ cents: number; count: number } | null>(null)

  const load = useCallback(async () => {
    financeFetch<{ totals: { expectedTotalCents: number }; appointmentCount: number }>('/api/finance/forecast?days=7')
      .then((f) => setForecast({ cents: f.totals.expectedTotalCents, count: f.appointmentCount }))
      .catch(() => setForecast(null))
    try {
      setData(await financeFetch<Overview>('/api/finance/overview'))
      setFailed(false)
    } catch (err) {
      setFailed(true)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar o Financeiro')
    }
  }, [])

  useEffect(() => {
    void load()
    window.addEventListener(FINANCE_CHANGED_EVENT, load)
    return () => window.removeEventListener(FINANCE_CHANGED_EVENT, load)
  }, [load])

  if (!data && failed) {
    return <ErrorState message="Não foi possível carregar a visão geral." onRetry={() => void load()} />
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const net = data.todayInCents - data.todayOutCents
  const noMovement = data.todayInCents === 0 && data.todayOutCents === 0

  return (
    <div className="space-y-4">
      {data.pendingAppointments > 0 && (
        <Link
          href="/dashboard/financeiro/pendencias"
          className="flex items-center gap-3 rounded-xl border border-money-warn/30 bg-money-warn/5 px-4 py-3 transition-colors hover:bg-money-warn/10"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-money-warn" />
          <p className="flex-1 text-sm">
            <span className="font-medium">{data.pendingAppointments}</span>{' '}
            {data.pendingAppointments === 1 ? 'atendimento concluído sem comanda' : 'atendimentos concluídos sem comanda'}
          </p>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      {/* Hoje */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative space-y-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saldo de hoje</p>
            <AnimatedMoney cents={net} currency={currency} signed tone="auto" className="block text-4xl font-semibold tracking-tight" />
            {noMovement && <p className="text-xs text-muted-foreground">Nenhuma movimentação hoje ainda.</p>}
          </div>
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="h-4 w-4 text-money-positive" />
              <Money cents={data.todayInCents} currency={currency} />
              <span className="text-muted-foreground">entradas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowDownRight className="h-4 w-4 text-money-negative" />
              <Money cents={data.todayOutCents} currency={currency} />
              <span className="text-muted-foreground">saídas</span>
            </div>
          </div>
          <Link
            href="/dashboard/financeiro/caixa"
            className="flex items-center justify-between rounded-xl bg-muted/60 px-3.5 py-3 transition-colors hover:bg-muted"
          >
            <span className="flex items-center gap-2.5">
              <span className={cn('h-2 w-2 rounded-full', data.cashSession ? 'bg-money-positive' : 'bg-muted-foreground/40')} />
              <span className="text-sm">
                {data.cashSession ? (
                  <>
                    Caixa aberto desde {timeFormatter.format(new Date(data.cashSession.openedAt))}
                    <span className="text-muted-foreground"> · gaveta </span>
                    <Money cents={data.cashSessionSummary?.expectedCashCents ?? 0} currency={currency} />
                  </>
                ) : (
                  'Caixa fechado'
                )}
              </span>
            </span>
            <span className="text-xs font-medium text-primary">{data.cashSession ? 'Ver caixa' : 'Abrir caixa'}</span>
          </Link>
        </div>
      </section>

      {/* Próximos 7 dias */}
      <div className="grid grid-cols-2 gap-2">
        {forecast && (
          <Tile
            href="/dashboard/financeiro/previsao"
            icon={CalendarClock}
            label={`Previsão · 7 dias (${forecast.count} ${forecast.count === 1 ? 'agendamento' : 'agendamentos'})`}
            cents={forecast.cents}
            currency={currency}
            className="col-span-2"
          />
        )}
        <Tile
          href="/dashboard/financeiro/receber"
          icon={Receipt}
          label="A receber · 7 dias"
          cents={data.receivablesNext7Cents}
          currency={currency}
          note={data.receivablesOverdueCents > 0 ? { cents: data.receivablesOverdueCents, text: 'vencido' } : null}
        />
        <Tile
          href="/dashboard/financeiro/pagar"
          icon={Landmark}
          label="A pagar · 7 dias"
          cents={data.payablesNext7Cents}
          currency={currency}
          note={data.payablesOverdueCents > 0 ? { cents: data.payablesOverdueCents, text: 'vencido' } : null}
        />
        <Tile
          href="/dashboard/financeiro/comissoes"
          icon={HandCoins}
          label="Comissões a acertar"
          cents={data.pendingCommissionsCents}
          currency={currency}
          className="col-span-2"
        />
      </div>
    </div>
  )
}

function Tile({
  href,
  icon: Icon,
  label,
  cents,
  currency,
  note,
  className
}: {
  href: string
  icon: React.ElementType
  label: string
  cents: number
  currency: CurrencyCode
  note?: { cents: number; text: string } | null
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group space-y-2 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <div>
        <Money cents={cents} currency={currency} className="block text-lg font-semibold tracking-tight" />
        <p className="text-xs text-muted-foreground">{label}</p>
        {note && (
          <p className="mt-1 text-xs font-medium text-money-negative">
            <Money cents={note.cents} currency={currency} /> {note.text}
          </p>
        )}
      </div>
    </Link>
  )
}
