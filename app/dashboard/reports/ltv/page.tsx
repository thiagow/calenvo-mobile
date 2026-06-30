
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    DollarSign,
    TrendingUp,
    ShoppingCart,
    Calendar,
    Users,
    Award
} from 'lucide-react'
import { useSegmentConfig } from '@/contexts/segment-context'

interface GlobalStats {
    averageLTV: number
    averageTicket: number
    averageFrequency: number
    totalRevenue: number
    totalClientsWithRevenue: number
}

interface TopClient {
    clientId: string
    clientName: string
    clientPhone: string
    clientEmail: string | null
    ltv: number
    averageTicket: number
    totalVisits: number
    firstVisit: string | null
    lastVisit: string | null
    averageFrequency: number
}

export default function LTVPage() {
    const { config: segmentConfig } = useSegmentConfig()
    const [globalStats, setGlobalStats] = useState<GlobalStats>({
        averageLTV: 0,
        averageTicket: 0,
        averageFrequency: 0,
        totalRevenue: 0,
        totalClientsWithRevenue: 0
    })
    const [topClients, setTopClients] = useState<TopClient[]>([])
    const [loading, setLoading] = useState(true)

    const fetchLTVData = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/reports/ltv')
            if (response.ok) {
                const data = await response.json()
                setGlobalStats(data.globalStats || {
                    averageLTV: 0,
                    averageTicket: 0,
                    averageFrequency: 0,
                    totalRevenue: 0,
                    totalClientsWithRevenue: 0
                })
                setTopClients(data.topClients || [])
            }
        } catch (error) {
            console.error('Error fetching LTV data:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLTVData()
    }, [])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value)
    }

    const t = segmentConfig.terminology

    return (
        <div className="space-y-6">
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                </div>
            ) : (
                <>
                    {/* KPIs Globais */}
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="hover:shadow-lg transition-shadow duration-200 border-l-4 border-l-green-600">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">
                                    LTV Médio
                                </CardTitle>
                                <DollarSign className="h-4 w-4 text-green-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    {formatCurrency(globalStats.averageLTV)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    valor médio por cliente
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-lg transition-shadow duration-200 border-l-4 border-l-blue-600">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">
                                    Ticket Médio
                                </CardTitle>
                                <ShoppingCart className="h-4 w-4 text-blue-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-600">
                                    {formatCurrency(globalStats.averageTicket)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    valor médio por visita
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-lg transition-shadow duration-200 border-l-4 border-l-purple-600">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">
                                    Frequência Média
                                </CardTitle>
                                <Calendar className="h-4 w-4 text-purple-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-purple-600">
                                    {globalStats.averageFrequency.toFixed(1)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    visitas por mês
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-lg transition-shadow duration-200 border-l-4 border-l-orange-600">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">
                                    Receita Total
                                </CardTitle>
                                <TrendingUp className="h-4 w-4 text-orange-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-orange-600">
                                    {formatCurrency(globalStats.totalRevenue)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    de {globalStats.totalClientsWithRevenue} clientes
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Ranking Top 10 */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Award className="mr-2 h-5 w-5 text-yellow-600" />
                                Top 10 Clientes por LTV
                            </CardTitle>
                            <CardDescription>
                                Clientes com maior valor de vida útil (Lifetime Value)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {topClients.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                                    <p className="text-lg font-medium">Nenhum dado de receita disponível</p>
                                    <p className="text-sm mt-2">
                                        Certifique-se de que os agendamentos completados tenham o campo "Valor" preenchido.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {topClients.map((client, index) => (
                                        <div
                                            key={client.clientId}
                                            className="flex items-center gap-4 p-4 bg-white rounded-lg border hover:shadow-md transition-shadow"
                                        >
                                            {/* Posição */}
                                            <div className="flex-shrink-0">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-lg font-bold ${index === 0
                                                        ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                                                        : index === 1
                                                            ? 'bg-gray-100 text-gray-700 border-gray-300'
                                                            : index === 2
                                                                ? 'bg-orange-50 text-orange-700 border-orange-300'
                                                                : 'bg-blue-50 text-blue-700 border-blue-200'
                                                        }`}
                                                >
                                                    {index + 1}º
                                                </Badge>
                                            </div>

                                            {/* Info do Cliente */}
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900">{client.clientName}</p>
                                                <p className="text-sm text-gray-600">{client.clientPhone}</p>
                                            </div>

                                            {/* Métricas */}
                                            <div className="grid grid-cols-4 gap-6 text-center">
                                                <div>
                                                    <p className="text-xs text-gray-600 mb-1">LTV</p>
                                                    <p className="text-sm font-bold text-green-600">
                                                        {formatCurrency(client.ltv)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-600 mb-1">Ticket Médio</p>
                                                    <p className="text-sm font-bold text-blue-600">
                                                        {formatCurrency(client.averageTicket)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-600 mb-1">Visitas</p>
                                                    <p className="text-sm font-bold text-purple-600">
                                                        {client.totalVisits}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-600 mb-1">Período</p>
                                                    <p className="text-xs text-gray-700">
                                                        {client.firstVisit && client.lastVisit ? (
                                                            <>
                                                                {new Date(client.firstVisit).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                                                                {' - '}
                                                                {new Date(client.lastVisit).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                                                            </>
                                                        ) : (
                                                            'N/A'
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Barra de progresso visual do LTV */}
                                            <div className="flex-shrink-0 w-32">
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300"
                                                        style={{
                                                            width: `${Math.min(100, (client.ltv / topClients[0].ltv) * 100)}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
