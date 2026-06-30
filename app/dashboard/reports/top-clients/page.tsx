
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Trophy,
    TrendingUp,
    Calendar,
    CheckCircle,
    XCircle,
    UserX,
    Filter
} from 'lucide-react'
import { useSegmentConfig } from '@/contexts/segment-context'

interface TopClient {
    clientId: string
    clientName: string
    clientPhone: string
    clientEmail: string | null
    total: number
    completed: number
    cancelled: number
    noShow: number
    completionRate: number
}

interface PeriodInfo {
    type: string
    startDate: string
    endDate: string
    label: string
}

export default function TopClientsPage() {
    const { config: segmentConfig } = useSegmentConfig()
    const [period, setPeriod] = useState<'current_month' | 'previous_month' | 'custom'>('current_month')
    const [customStartDate, setCustomStartDate] = useState('')
    const [customEndDate, setCustomEndDate] = useState('')
    const [topClients, setTopClients] = useState<TopClient[]>([])
    const [periodInfo, setPeriodInfo] = useState<PeriodInfo | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchTopClients = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.append('period', period)

            if (period === 'custom' && customStartDate && customEndDate) {
                params.append('startDate', customStartDate)
                params.append('endDate', customEndDate)
            }

            const response = await fetch(`/api/reports/top-clients?${params}`)
            if (response.ok) {
                const data = await response.json()
                setTopClients(data.topClients || [])
                setPeriodInfo(data.period)
            }
        } catch (error) {
            console.error('Error fetching top clients:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (period !== 'custom' || (customStartDate && customEndDate)) {
            fetchTopClients()
        }
    }, [period, customStartDate, customEndDate])

    const t = segmentConfig.terminology

    return (
        <div className="space-y-6">
            {/* Filtros */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                        <Filter className="mr-2 h-5 w-5" />
                        Filtros de Período
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-4">
                        {/* Botões de período rápido */}
                        <div className="flex gap-2">
                            <Button
                                variant={period === 'current_month' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setPeriod('current_month')}
                            >
                                Mês Atual
                            </Button>
                            <Button
                                variant={period === 'previous_month' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setPeriod('previous_month')}
                            >
                                Mês Anterior
                            </Button>
                            <Button
                                variant={period === 'custom' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setPeriod('custom')}
                            >
                                Personalizado
                            </Button>
                        </div>

                        {/* Inputs de data personalizada */}
                        {period === 'custom' && (
                            <>
                                <div className="flex-1 min-w-[150px]">
                                    <Label className="text-xs">Data Inicial</Label>
                                    <Input
                                        type="date"
                                        value={customStartDate}
                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                                <div className="flex-1 min-w-[150px]">
                                    <Label className="text-xs">Data Final</Label>
                                    <Input
                                        type="date"
                                        value={customEndDate}
                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                            </>
                        )}

                        {/* Badge do período */}
                        {periodInfo && (
                            <Badge className="bg-blue-600 text-white px-4 py-2">
                                <Calendar className="mr-2 h-4 w-4" />
                                {periodInfo.label}
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Tabela de Ranking */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <TrendingUp className="mr-2 h-5 w-5 text-blue-600" />
                        Ranking de Clientes
                    </CardTitle>
                    <CardDescription>
                        Top 10 clientes com mais agendamentos no período
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : topClients.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <p>Nenhum agendamento encontrado no período selecionado</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Header da tabela */}
                            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg font-medium text-sm text-gray-700">
                                <div className="col-span-1">#</div>
                                <div className="col-span-3">Cliente</div>
                                <div className="col-span-1 text-center">Total</div>
                                <div className="col-span-1 text-center">
                                    <CheckCircle className="h-4 w-4 inline text-green-600" />
                                </div>
                                <div className="col-span-1 text-center">
                                    <XCircle className="h-4 w-4 inline text-red-600" />
                                </div>
                                <div className="col-span-1 text-center">
                                    <UserX className="h-4 w-4 inline text-orange-600" />
                                </div>
                                <div className="col-span-4">Taxa de Presença</div>
                            </div>

                            {/* Linhas da tabela */}
                            {topClients.map((client, index) => (
                                <div
                                    key={client.clientId}
                                    className="grid grid-cols-12 gap-4 px-4 py-3 bg-white rounded-lg border hover:shadow-md transition-shadow"
                                >
                                    {/* Posição */}
                                    <div className="col-span-1 flex items-center">
                                        <Badge
                                            variant="outline"
                                            className={
                                                index === 0
                                                    ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                                                    : index === 1
                                                        ? 'bg-gray-100 text-gray-700 border-gray-300'
                                                        : index === 2
                                                            ? 'bg-orange-50 text-orange-700 border-orange-300'
                                                            : 'bg-blue-50 text-blue-700 border-blue-200'
                                            }
                                        >
                                            {index + 1}º
                                        </Badge>
                                    </div>

                                    {/* Nome do cliente */}
                                    <div className="col-span-3 flex flex-col justify-center">
                                        <p className="font-medium text-gray-900">{client.clientName}</p>
                                        <p className="text-xs text-gray-500">{client.clientPhone}</p>
                                    </div>

                                    {/* Total */}
                                    <div className="col-span-1 flex items-center justify-center">
                                        <span className="font-bold text-gray-900">{client.total}</span>
                                    </div>

                                    {/* Realizados */}
                                    <div className="col-span-1 flex items-center justify-center">
                                        <span className="text-green-600 font-medium">{client.completed}</span>
                                    </div>

                                    {/* Cancelados */}
                                    <div className="col-span-1 flex items-center justify-center">
                                        <span className="text-red-600 font-medium">{client.cancelled}</span>
                                    </div>

                                    {/* Faltas */}
                                    <div className="col-span-1 flex items-center justify-center">
                                        <span className="text-orange-600 font-medium">{client.noShow}</span>
                                    </div>

                                    {/* Taxa de presença com barra */}
                                    <div className="col-span-4 flex flex-col justify-center">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full transition-all duration-300 ${client.completionRate >= 80
                                                        ? 'bg-green-600'
                                                        : client.completionRate >= 50
                                                            ? 'bg-yellow-600'
                                                            : 'bg-red-600'
                                                        }`}
                                                    style={{ width: `${client.completionRate}%` }}
                                                />
                                            </div>
                                            <span className="text-sm font-medium text-gray-700 min-w-[45px]">
                                                {client.completionRate}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
