'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar, Users, AlertCircle, CalendarCheck, Clock, Plus, ChevronRight } from 'lucide-react'
import { PLAN_CONFIGS } from '@/lib/types'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface DashboardOverviewProps {
  sessionData: {
    user: {
      name?: string | null
      email?: string | null
      planType?: string
      clinicName?: string | null
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

  const [stats, setStats] = useState({ todayAppointments: 0, weekAppointments: 0, monthAppointments: 0, totalClients: 0, pendingAppointments: 0, completedAppointments: 0 })
  const [recentAppointments, setRecentAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setStats(data.stats); setRecentAppointments(data.recentAppointments || []) } })
      .finally(() => setLoading(false))
  }, [])

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })

  return (
    <div className="space-y-5">
      {/* Saudação */}
      <div>
        <p className="text-xs text-muted-foreground capitalize">{today}</p>
        <h2 className="text-xl font-bold mt-0.5">Olá, {firstName}!</h2>
      </div>

      {/* KPI cards — scroll horizontal em telas muito pequenas */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Hoje', value: stats.todayAppointments, icon: Calendar, color: 'text-primary' },
          { label: 'Esta semana', value: stats.weekAppointments, icon: CalendarCheck, color: 'text-green-600' },
          { label: 'Clientes', value: stats.totalClients, icon: Users, color: 'text-purple-600' },
          { label: 'Pendentes', value: stats.pendingAppointments, icon: AlertCircle, color: 'text-yellow-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  {loading
                    ? <Skeleton className="h-7 w-10 mt-1" />
                    : <p className="text-2xl font-bold mt-0.5">{value}</p>
                  }
                </div>
                <Icon className={`h-5 w-5 ${color} mt-0.5`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
                  style={{ width: `${Math.min((stats.monthAppointments / (planConfig?.monthlyLimit || 1)) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium tabular-nums whitespace-nowrap">
                {stats.monthAppointments}/{planConfig?.monthlyLimit}
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
