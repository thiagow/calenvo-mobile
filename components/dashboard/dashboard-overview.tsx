'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar, CalendarDays, CalendarCheck, CircleCheck, Hourglass, Clock, Plus, ChevronRight, RotateCcw } from 'lucide-react'
import { PLAN_CONFIGS } from '@/lib/types'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useReactivationSummary } from '@/hooks/use-reactivation-summary'
import { useSegmentConfig } from '@/contexts/segment-context'
import { ACTIVE_STATUSES } from '@/lib/dashboard-stats'
import { agendaLink } from '@/lib/dashboard-links'
import { cn } from '@/lib/utils'

interface DashboardOverviewProps {
  sessionData: {
    user: {
      name?: string | null
      email?: string | null
      planType?: string
    }
  }
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: 'Confirmado', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  SCHEDULED: { label: 'Agendado', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  PENDING: { label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  COMPLETED: { label: 'Concluído', color: 'bg-muted text-muted-foreground' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
}

export function DashboardOverview({ sessionData }: DashboardOverviewProps) {
  const userPlan = sessionData?.user?.planType || 'BASICO'
  const planConfig = PLAN_CONFIGS[userPlan as keyof typeof PLAN_CONFIGS]
  const firstName = sessionData?.user?.name?.split(' ')[0]

  const [stats, setStats] = useState({ weekAppointments: 0, monthAppointments: 0, pendingWeek: 0, confirmedWeek: 0, planMonthAppointments: 0 })
  const [periods, setPeriods] = useState<{ week: { from: string; to: string }; month: { from: string; to: string }; today: string } | null>(null)
  const [recentAppointments, setRecentAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { counts: returnCounts } = useReactivationSummary()
  const t = useSegmentConfig().config.terminology

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setStats(data.stats); setPeriods(data.periods); setRecentAppointments(data.recentAppointments || []) } })
      .finally(() => setLoading(false))
  }, [])

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })

  // Datas vêm do servidor (calendário do negócio) — o navegador não recalcula semana/mês.
  const weekFrom = periods?.week.from ?? ''
  const referenceDay = periods?.today ?? ''
  const shortDay = (d: string) => format(new Date(`${d}T12:00:00`), "d 'de' MMM", { locale: ptBR })
  const weekLabel = periods ? `${format(new Date(`${periods.week.from}T12:00:00`), 'd', { locale: ptBR })} a ${shortDay(periods.week.to)}` : ''
  const monthLabel = periods ? format(new Date(`${periods.month.from}T12:00:00`), 'MMMM', { locale: ptBR }) : ''
  const confirmedPct = stats.weekAppointments > 0 ? Math.round((stats.confirmedWeek / stats.weekAppointments) * 100) : 0

  const indicators = [
    {
      label: 'Esta semana',
      value: stats.weekAppointments,
      sub: weekLabel,
      href: agendaLink({ view: 'week', date: referenceDay || weekFrom, status: ACTIVE_STATUSES }),
      icon: CalendarDays,
      tone: 'text-primary',
    },
    {
      label: 'Total do mês',
      value: stats.monthAppointments,
      sub: monthLabel ? `${monthLabel} · sem cancelados` : '',
      href: agendaLink({ view: 'month', date: referenceDay || weekFrom, status: ACTIVE_STATUSES }),
      icon: CalendarCheck,
      tone: 'text-violet-600',
    },
    {
      label: 'Pendentes',
      value: stats.pendingWeek,
      sub: stats.pendingWeek === 0 ? 'nada pendente' : 'aguardando confirmação',
      href: agendaLink({ view: 'week', date: referenceDay || weekFrom, status: ['SCHEDULED'] }),
      icon: Hourglass,
      tone: 'text-amber-600',
    },
    {
      label: 'Confirmados',
      value: stats.confirmedWeek,
      sub: stats.weekAppointments > 0 ? `${confirmedPct}% da semana` : 'sem agendamentos',
      href: agendaLink({ view: 'week', date: referenceDay || weekFrom, status: ['CONFIRMED'] }),
      icon: CircleCheck,
      tone: 'text-green-600',
    },
  ]

  return (
    <div className="space-y-5">
      {/* Saudação */}
      <div>
        <p className="text-xs text-muted-foreground capitalize">{today}</p>
        <h2 className="text-xl font-bold mt-0.5">Olá, {firstName}!</h2>
      </div>

      {/* Indicadores — cada card abre a Agenda já na vista e no filtro que mostram o mesmo número */}
      <div className="grid grid-cols-2 gap-3">
        {indicators.map(({ label, value, sub, href, icon: Icon, tone }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Card className="h-full border border-border transition-colors group-hover:bg-muted/40 group-active:bg-muted">
              <CardContent className="flex min-h-[7rem] flex-col justify-between p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <Icon className={cn('h-5 w-5 shrink-0', tone)} />
                </div>
                <div>
                  {loading
                    ? <Skeleton className="h-8 w-12" />
                    : <p className="text-3xl font-bold leading-none tabular-nums">{value}</p>
                  }
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    {loading
                      ? <Skeleton className="h-3 w-24" />
                      : <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
                    }
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Clientes para reativar */}
      {returnCounts && returnCounts.overdue + returnCounts.upcoming > 0 && (
        <Link href="/dashboard/clients/retorno" className="block">
          <Card className="border border-amber-500/25 bg-amber-500/5 transition-colors hover:bg-amber-500/10">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
                <RotateCcw className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.clients} para reativar</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {returnCounts.overdue} {returnCounts.overdue === 1 ? 'atrasado' : 'atrasados'} · {returnCounts.upcoming}{' '}
                  {returnCounts.upcoming === 1 ? 'retorno próximo' : 'retornos próximos'}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Uso do plano */}
      {planConfig?.monthlyLimit !== -1 && (
        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Uso do plano este mês</span>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                {planConfig?.name}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min((stats.planMonthAppointments / (planConfig?.monthlyLimit || 1)) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium tabular-nums whitespace-nowrap">
                {stats.planMonthAppointments}/{planConfig?.monthlyLimit}
              </span>
            </div>
            {userPlan === 'BASICO' && (
              <Link href="/dashboard/plans" className="block mt-3">
                <Button size="sm" className="w-full h-8 text-xs">Fazer Upgrade</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Próximos agendamentos hoje */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-primary" />
            Hoje
          </h3>
          <Link href="/dashboard/agenda" className="text-xs text-primary flex items-center gap-0.5">
            Ver agenda <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : recentAppointments.length === 0 ? (
          <Card className="border border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 gap-2">
              <Calendar className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum agendamento hoje</p>
              <Link href="/dashboard/appointments/new">
                <Button size="sm" variant="outline" className="mt-1 h-8 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Novo agendamento
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentAppointments.map((apt) => {
              const statusInfo = STATUS_LABEL[apt.status] || STATUS_LABEL.SCHEDULED
              return (
                <Card key={apt.id} className="border border-border">
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{apt.patient}</p>
                      <p className="text-xs text-muted-foreground truncate">{apt.type}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusInfo.color}`}>
                        {statusInfo.label}
                      </Badge>
                      <span className="text-xs font-medium tabular-nums">{apt.time}</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <Link
        href="/dashboard/appointments/new"
        className="fixed right-4 z-40"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 1rem)' }}
      >
        <Button size="icon" className="h-14 w-14 rounded-full shadow-lg">
          <Plus className="h-6 w-6" />
        </Button>
      </Link>
    </div>
  )
}
