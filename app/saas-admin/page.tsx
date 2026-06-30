'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserCheck, UserX, Calendar, DollarSign, TrendingUp } from 'lucide-react'

interface Stats {
    overview: {
        totalTenants: number
        activeTenants: number
        inactiveTenants: number
        totalProfessionals: number
        appointmentsThisMonth: number
        newTenantsLast30Days: number
        monthlyRevenue: number
    }
    distribution: {
        byPlan: Array<{ plan: string; count: number }>
        bySegment: Array<{ segment: string; count: number }>
    }
}

export default function SaasAdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchStats()
    }, [])

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/saas-admin/stats')
            if (res.ok) {
                const data = await res.json()
                setStats(data)
            }
        } catch (error) {
            console.error('Error fetching stats:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-muted-foreground">Carregando...</div>
            </div>
        )
    }

    if (!stats) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-muted-foreground">Erro ao carregar estatísticas</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Dashboard SaaS Admin</h1>
                <p className="text-muted-foreground">Visão geral da plataforma Calenvo</p>
            </div>

            {/* KPIs principais */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Tenants</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.overview.totalTenants}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.overview.newTenantsLast30Days} novos nos últimos 30 dias
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tenants Ativos</CardTitle>
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.overview.activeTenants}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.overview.inactiveTenants} inativos
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Profissionais</CardTitle>
                        <UserX className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.overview.totalProfessionals}</div>
                        <p className="text-xs text-muted-foreground">
                            Total na plataforma
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Agendamentos (Mês)</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.overview.appointmentsThisMonth}</div>
                        <p className="text-xs text-muted-foreground">
                            Mês atual
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            R$ {stats.overview.monthlyRevenue.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Estimativa baseada nos planos
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Novos Tenants</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.overview.newTenantsLast30Days}</div>
                        <p className="text-xs text-muted-foreground">
                            Últimos 30 dias
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Distribuições */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Distribuição por Plano</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {stats.distribution.byPlan.map((item) => (
                                <div key={item.plan} className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{item.plan}</span>
                                    <span className="text-sm text-muted-foreground">{item.count} tenants</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Distribuição por Segmento</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {stats.distribution.bySegment.slice(0, 5).map((item) => (
                                <div key={item.segment} className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{item.segment}</span>
                                    <span className="text-sm text-muted-foreground">{item.count} tenants</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
