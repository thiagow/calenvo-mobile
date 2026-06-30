
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    UserMinus,
    AlertTriangle,
    TrendingDown,
    Users,
    Calendar,
    Phone,
    Mail,
    MessageCircle
} from 'lucide-react'
import { useSegmentConfig } from '@/contexts/segment-context'

interface InactiveClient {
    clientId: string
    clientName: string
    clientPhone: string
    clientEmail: string | null
    lastAppointmentDate: string | null
    daysSinceLastVisit: number
    totalAppointments: number
    neverScheduled: boolean
}

interface Stats {
    totalInactive: number
    totalClients: number
    inactivePercentage: number
    averageDaysInactive: number
    neverScheduledCount: number
}

export default function InactiveClientsPage() {
    const { config: segmentConfig } = useSegmentConfig()
    const [inactiveDays, setInactiveDays] = useState(30)
    const [customDays, setCustomDays] = useState('')
    const [inactiveClients, setInactiveClients] = useState<InactiveClient[]>([])
    const [stats, setStats] = useState<Stats>({
        totalInactive: 0,
        totalClients: 0,
        inactivePercentage: 0,
        averageDaysInactive: 0,
        neverScheduledCount: 0
    })
    const [loading, setLoading] = useState(true)

    const fetchInactiveClients = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.append('inactiveDays', inactiveDays.toString())

            const response = await fetch(`/api/reports/inactive-clients?${params}`)
            if (response.ok) {
                const data = await response.json()
                setInactiveClients(data.inactiveClients || [])
                setStats(data.stats || {
                    totalInactive: 0,
                    totalClients: 0,
                    inactivePercentage: 0,
                    averageDaysInactive: 0,
                    neverScheduledCount: 0
                })
            }
        } catch (error) {
            console.error('Error fetching inactive clients:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchInactiveClients()
    }, [inactiveDays])

    const handleCustomDaysApply = () => {
        const days = parseInt(customDays)
        if (!isNaN(days) && days > 0) {
            setInactiveDays(days)
        }
    }

    const formatWhatsAppLink = (phone: string) => {
        const cleanPhone = phone.replace(/\D/g, '')
        return `https://wa.me/55${cleanPhone}`
    }

    const t = segmentConfig.terminology

    return (
        <div className="space-y-6">
            {/* Filtros */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                        <Calendar className="mr-2 h-5 w-5" />
                        Período de Inatividade
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-4">
                        {/* Botões de período rápido */}
                        <div className="flex gap-2">
                            <Button
                                variant={inactiveDays === 30 ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setInactiveDays(30)}
                            >
                                30 dias
                            </Button>
                            <Button
                                variant={inactiveDays === 60 ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setInactiveDays(60)}
                            >
                                60 dias
                            </Button>
                            <Button
                                variant={inactiveDays === 90 ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setInactiveDays(90)}
                            >
                                90 dias
                            </Button>
                        </div>

                        {/* Input personalizado */}
                        <div className="flex gap-2 items-end">
                            <div>
                                <Label className="text-xs">Dias Personalizados</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    placeholder="Ex: 45"
                                    value={customDays}
                                    onChange={(e) => setCustomDays(e.target.value)}
                                    className="mt-1 w-32"
                                />
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCustomDaysApply}
                                disabled={!customDays}
                            >
                                Aplicar
                            </Button>
                        </div>

                        {/* Badge do filtro atual */}
                        <Badge className="bg-orange-600 text-white px-4 py-2">
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            Sem agendamento há {inactiveDays}+ dias
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* KPIs */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="hover:shadow-lg transition-shadow duration-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Total Inativos
                        </CardTitle>
                        <UserMinus className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                            {stats.totalInactive}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            clientes sem agendamento
                        </p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow duration-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            % da Base
                        </CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {stats.inactivePercentage}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                            de {stats.totalClients} clientes totais
                        </p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow duration-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Média de Dias
                        </CardTitle>
                        <Calendar className="h-4 w-4 text-gray-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">
                            {stats.averageDaysInactive}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            dias sem visita
                        </p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow duration-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Nunca Agendaram
                        </CardTitle>
                        <Users className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">
                            {stats.neverScheduledCount}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            clientes cadastrados
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Lista de Clientes Inativos */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <UserMinus className="mr-2 h-5 w-5 text-orange-600" />
                        Clientes para Recuperação
                    </CardTitle>
                    <CardDescription>
                        Lista de clientes inativos ordenada por dias sem visita
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
                        </div>
                    ) : inactiveClients.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg font-medium">Nenhum cliente inativo encontrado!</p>
                            <p className="text-sm mt-2">Todos os clientes estão ativos no período selecionado.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {inactiveClients.map((client) => (
                                <div
                                    key={client.clientId}
                                    className="flex items-center justify-between p-4 bg-white rounded-lg border hover:shadow-md transition-shadow"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <p className="font-medium text-gray-900">{client.clientName}</p>
                                                <div className="flex items-center gap-4 mt-1">
                                                    <span className="text-sm text-gray-600 flex items-center gap-1">
                                                        <Phone className="h-3 w-3" />
                                                        {client.clientPhone}
                                                    </span>
                                                    {client.clientEmail && (
                                                        <span className="text-sm text-gray-600 flex items-center gap-1">
                                                            <Mail className="h-3 w-3" />
                                                            {client.clientEmail}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            {client.neverScheduled ? (
                                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                                    Nunca agendou
                                                </Badge>
                                            ) : (
                                                <>
                                                    <p className="text-sm text-gray-600">
                                                        Último agendamento
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {client.lastAppointmentDate
                                                            ? new Date(client.lastAppointmentDate).toLocaleDateString('pt-BR')
                                                            : 'N/A'
                                                        }
                                                    </p>
                                                </>
                                            )}
                                            <Badge
                                                variant="outline"
                                                className={`mt-1 ${client.daysSinceLastVisit >= 90
                                                    ? 'bg-red-50 text-red-700 border-red-200'
                                                    : client.daysSinceLastVisit >= 60
                                                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                                                        : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                                    }`}
                                            >
                                                {client.daysSinceLastVisit} dias
                                            </Badge>
                                        </div>

                                        <a
                                            href={formatWhatsAppLink(client.clientPhone)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Button size="sm" className="gap-2 bg-green-600 hover:bg-green-700">
                                                <MessageCircle className="h-4 w-4" />
                                                WhatsApp
                                            </Button>
                                        </a>
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
