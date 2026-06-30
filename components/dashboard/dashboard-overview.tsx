
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  Users,
  Clock,
  TrendingUp,
  CalendarCheck,
  UserCheck,
  AlertCircle,
  Plus
} from 'lucide-react'
import { PLAN_CONFIGS } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

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

interface DashboardStats {
  todayAppointments: number
  weekAppointments: number
  monthAppointments: number
  totalClients: number
  pendingAppointments: number
  completedAppointments: number
}

interface RecentAppointment {
  id: string
  patient: string
  time: string
  status: string
  type: string
}

export function DashboardOverview({ sessionData }: DashboardOverviewProps) {
  const userPlan = sessionData?.user?.planType || 'FREEMIUM'
  const planConfig = PLAN_CONFIGS[userPlan as keyof typeof PLAN_CONFIGS]

  const [stats, setStats] = useState<DashboardStats>({
    todayAppointments: 0,
    weekAppointments: 0,
    monthAppointments: 0,
    totalClients: 0,
    pendingAppointments: 0,
    completedAppointments: 0
  })

  const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([])
  const [loading, setLoading] = useState(true)

  // Buscar dados reais do banco
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/dashboard/stats')
        if (response.ok) {
          const data = await response.json()
          setStats(data.stats)
          setRecentAppointments(data.recentAppointments || [])
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold text-foreground">
            Bem-vindo, {sessionData?.user?.name?.split(' ')[0]}!
          </h2>
          <p className="text-muted-foreground mt-1 font-medium">
            Aqui está um resumo do seu negócio hoje
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Plano {planConfig?.name}
          </Badge>
          <Link href="/dashboard/appointments/new">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Novo Agendamento
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Hoje
            </CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">
              {stats.todayAppointments}
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              agendamentos hoje
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Esta Semana
            </CardTitle>
            <CalendarCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">
              {stats.weekAppointments}
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              agendamentos esta semana
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Clientes
            </CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">
              {stats.totalClients}
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              cadastrados
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Pendentes
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">
              {stats.pendingAppointments}
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              aguardando confirmação
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-foreground">
              <Clock className="mr-2 h-5 w-5 text-primary" />
              Próximos Agendamentos
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Agendamentos programados para hoje
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : recentAppointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
                <p>Nenhum agendamento para hoje</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentAppointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <UserCheck className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {appointment.patient}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {appointment.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={appointment.status === 'CONFIRMED' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {appointment.status === 'CONFIRMED' ? 'Confirmado' : 'Pendente'}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">
                        {appointment.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-border">
              <Link href="/dashboard/agenda">
                <Button variant="outline" className="w-full">
                  Ver Agenda Completa
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Plan Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-foreground">
              <TrendingUp className="mr-2 h-5 w-5 text-green-600" />
              Uso do Plano
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Limite de agendamentos do mês atual
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">Agendamentos este mês</span>
                  <span className="font-bold text-foreground">
                    {stats.monthAppointments} / {planConfig?.monthlyLimit === -1 ? '∞' : planConfig?.monthlyLimit}
                  </span>
                </div>
                <div className="mt-2 w-full bg-muted rounded-full h-3 shadow-inner">
                  <div
                    className="bg-primary h-3 rounded-full transition-all duration-300"
                    style={{
                      width: planConfig?.monthlyLimit === -1
                        ? '0%' // No "progress" for unlimited plans, just a placeholder track
                        : `${Math.min((stats.monthAppointments / planConfig?.monthlyLimit!) * 100, 100)}%`
                    }}
                  />
                </div>
                {planConfig?.monthlyLimit === -1 && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    * Plano ilimitado: monitorando uso global do ecossistema
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Plano Atual</span>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold">
                    {planConfig?.name}
                  </Badge>
                </div>
                <p className="text-xs font-medium text-muted-foreground mt-1">
                  {planConfig?.price === 0 ? 'Gratuito' : `${formatCurrency(planConfig?.price!)} por mês`}
                </p>

                {userPlan === 'FREEMIUM' && (
                  <div className="mt-4">
                    <Link href="/dashboard/plans">
                      <Button className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
                        Fazer Upgrade
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
