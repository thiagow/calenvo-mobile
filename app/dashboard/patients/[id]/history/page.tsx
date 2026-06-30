
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    ArrowLeft,
    Calendar,
    Clock,
    Filter,
    User,
    CheckCircle2,
    XCircle,
    Phone,
    Mail
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useSegmentConfig } from '@/contexts/segment-context'
import { PackageDeductionModal } from '@/components/dashboard/package-deduction-modal'

interface AppointmentHistory {
    id: string
    date: string
    duration: number
    status: string
    modality: string
    serviceName: string
    professionalName: string
    scheduleName: string | null
    price: number | null
    notes: string | null
}

interface ClientInfo {
    id: string
    name: string
    phone: string
    email: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
    SCHEDULED: { label: 'Agendado', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
    CONFIRMED: { label: 'Confirmado', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200' },
    IN_PROGRESS: { label: 'Em Andamento', color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200' },
    COMPLETED: { label: 'Compareceu', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
    CANCELLED: { label: 'Cancelado', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
    NO_SHOW: { label: 'Faltou', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
}

export default function ClientHistoryPage() {
    const params = useParams()
    const router = useRouter()
    const clientId = params.id as string
    const { config: segmentConfig } = useSegmentConfig()

    const [client, setClient] = useState<ClientInfo | null>(null)
    const [appointments, setAppointments] = useState<AppointmentHistory[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('all')
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    // Modal states
    const [modalOpen, setModalOpen] = useState(false)
    const [selectedAptId, setSelectedAptId] = useState<string | null>(null)

    const fetchHistory = async (status?: string) => {
        try {
            setLoading(true)
            const queryParams = status && status !== 'all' ? `?status=${status}` : ''
            const response = await fetch(`/api/clients/${clientId}/appointments${queryParams}`)

            if (!response.ok) {
                throw new Error('Erro ao carregar histórico')
            }

            const data = await response.json()
            setClient(data.client)
            setAppointments(data.appointments)
            setTotal(data.total)
        } catch (error) {
            console.error('Error fetching client history:', error)
            toast.error('Erro ao carregar histórico do cliente')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (clientId) {
            fetchHistory(statusFilter)
        }
    }, [clientId, statusFilter])

    const handleUpdateStatus = async (appointmentId: string, newStatus: string, clientPackageItemId?: string | null) => {
        try {
            setUpdatingId(appointmentId)

            const payload: any = { status: newStatus }
            if (clientPackageItemId) {
                payload.clientPackageItemId = clientPackageItemId
            } else if (clientPackageItemId === null && newStatus === 'COMPLETED') {
                payload.clientPackageItemId = null
            }

            const response = await fetch(`/api/appointments/${appointmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                throw new Error('Erro ao atualizar status')
            }

            toast.success(
                newStatus === 'COMPLETED'
                    ? 'Presença confirmada' + (clientPackageItemId ? ' e sessão debitada!' : '!')
                    : 'Falta registrada!'
            )

            // Atualizar lista
            fetchHistory(statusFilter)
        } catch (error) {
            console.error('Error updating appointment status:', error)
            toast.error('Erro ao atualizar status do agendamento')
        } finally {
            setUpdatingId(null)
        }
    }

    const formatDateTime = (dateStr: string) => {
        const date = new Date(dateStr)
        return {
            date: date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }),
            time: date.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            })
        }
    }

    const canChangeStatus = (apt: AppointmentHistory) => {
        const now = new Date()
        const aptDate = new Date(apt.date)
        // Pode alterar status de agendamentos passados ou do dia atual, que estão SCHEDULED ou CONFIRMED
        return (
            aptDate <= now &&
            (apt.status === 'SCHEDULED' || apt.status === 'CONFIRMED')
        )
    }

    const t = segmentConfig.terminology

    if (loading && !client) {
        return (
            <div className="p-6">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <PackageDeductionModal
                isOpen={modalOpen}
                onOpenChange={setModalOpen}
                clientId={clientId}
                appointmentId={selectedAptId || ''}
                onConfirm={async (packageItemId) => {
                    if (selectedAptId) {
                        await handleUpdateStatus(selectedAptId, 'COMPLETED', packageItemId)
                        setSelectedAptId(null)
                    }
                }}
            />
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/dashboard/patients')}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Histórico de {t.appointments}
                        </h1>
                        {client && (
                            <div className="flex items-center gap-4 mt-1">
                                <span className="text-gray-600 font-medium">{client.name}</span>
                                {client.phone && (
                                    <span className="flex items-center gap-1 text-sm text-gray-500">
                                        <Phone className="h-3 w-3" />
                                        {client.phone}
                                    </span>
                                )}
                                {client.email && (
                                    <span className="flex items-center gap-1 text-sm text-gray-500">
                                        <Mail className="h-3 w-3" />
                                        {client.email}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Filtro de Status */}
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filtrar status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos ({total})</SelectItem>
                            <SelectItem value="SCHEDULED">Agendado</SelectItem>
                            <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                            <SelectItem value="COMPLETED">Compareceu</SelectItem>
                            <SelectItem value="CANCELLED">Cancelado</SelectItem>
                            <SelectItem value="NO_SHOW">Faltou</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Stats resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">{total}</div>
                        <div className="text-xs text-gray-500">Total</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                            {appointments.filter(a => a.status === 'COMPLETED').length}
                        </div>
                        <div className="text-xs text-gray-500">Compareceu</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600">
                            {appointments.filter(a => a.status === 'NO_SHOW').length}
                        </div>
                        <div className="text-xs text-gray-500">Faltas</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-red-600">
                            {appointments.filter(a => a.status === 'CANCELLED').length}
                        </div>
                        <div className="text-xs text-gray-500">Cancelados</div>
                    </CardContent>
                </Card>
            </div>

            {/* Lista de Agendamentos */}
            <div className="space-y-3">
                {appointments.map((apt) => {
                    const { date, time } = formatDateTime(apt.date)
                    const statusInfo = STATUS_CONFIG[apt.status] || STATUS_CONFIG.SCHEDULED
                    const showActions = canChangeStatus(apt)

                    return (
                        <Card key={apt.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                                    {/* Informações do agendamento */}
                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                                        {/* Data e Hora */}
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-gray-400" />
                                            <div>
                                                <div className="font-medium text-sm">{date}</div>
                                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                                    <Clock className="h-3 w-3" />
                                                    {time} ({apt.duration}min)
                                                </div>
                                            </div>
                                        </div>

                                        {/* Serviço */}
                                        <div>
                                            <div className="text-sm font-medium">{apt.serviceName}</div>
                                            {apt.price && (
                                                <div className="text-xs text-gray-500">
                                                    R$ {apt.price.toFixed(2)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Profissional */}
                                        <div className="flex items-center gap-1">
                                            <User className="h-3 w-3 text-gray-400" />
                                            <span className="text-sm text-gray-600">{apt.professionalName}</span>
                                        </div>

                                        {/* Status */}
                                        <div>
                                            <Badge
                                                variant="outline"
                                                className={`${statusInfo.bgColor} ${statusInfo.color} border`}
                                            >
                                                {statusInfo.label}
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Ações de presença */}
                                    {showActions && (
                                        <div className="flex gap-2 shrink-0">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-green-600 border-green-300 hover:bg-green-50"
                                                disabled={updatingId === apt.id}
                                                onClick={() => {
                                                    setSelectedAptId(apt.id)
                                                    setModalOpen(true)
                                                }}
                                            >
                                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                                Compareceu
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                                disabled={updatingId === apt.id}
                                                onClick={() => handleUpdateStatus(apt.id, 'NO_SHOW')}
                                            >
                                                <XCircle className="h-4 w-4 mr-1" />
                                                Faltou
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {apt.notes && (
                                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                                        <strong>Obs:</strong> {apt.notes}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Empty state */}
            {appointments.length === 0 && !loading && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Calendar className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Nenhum {t.appointment.toLowerCase()} encontrado
                        </h3>
                        <p className="text-gray-600 text-center">
                            {statusFilter !== 'all'
                                ? 'Tente limpar o filtro de status para ver todos os agendamentos'
                                : `Este ${t.client.toLowerCase()} ainda não possui agendamentos`
                            }
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
