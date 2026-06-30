

'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Calendar,
  Search,
  Filter,
  Plus,
  Clock,
  User,
  Phone,
  Mail,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import Link from 'next/link'
import { useState, useMemo } from 'react'
import { useAppointments } from '@/hooks/use-appointments'
import { AppointmentStatus } from '@prisma/client'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useDialog } from '@/components/providers/dialog-provider'
import { PackageDeductionModal } from './package-deduction-modal'

// Status mappings for backwards compatibility with the old interface
const statusColors = {
  SCHEDULED: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-red-100 text-red-800'
}

const statusLabels = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em Andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Faltou'
}

export function AppointmentsList() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Package Deduction states
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAptId, setSelectedAptId] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  const { confirm } = useDialog()

  // Get appointments from database
  const {
    appointments,
    loading,
    error,
    updateAppointment,
    deleteAppointment
  } = useAppointments({
    autoFetch: true
  })

  // Client-side filtering
  const filteredAppointments = useMemo(() => {
    return appointments.filter(appointment => {
      const matchesSearch = appointment.patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        appointment.specialty?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        appointment.professional?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter

      const matchesDate = !dateFilter || format(new Date(appointment.date), 'yyyy-MM-dd') === dateFilter

      return matchesSearch && matchesStatus && matchesDate
    })
  }, [appointments, searchTerm, statusFilter, dateFilter])

  const handleDeleteAppointment = async (id: string) => {
    const confirmed = await confirm({
      title: 'Excluir Agendamento',
      description: 'Tem certeza que deseja excluir este agendamento?',
      variant: 'destructive',
      confirmText: 'Excluir'
    })

    if (!confirmed) return

    try {
      await deleteAppointment(id)
      toast.success('Agendamento excluído com sucesso!')
    } catch (error) {
      toast.error('Erro ao excluir agendamento')
    }
  }

  const handleUpdateStatus = async (id: string, newStatus: string, clientPackageItemId?: string | null) => {
    try {
      setUpdatingId(id)
      const payload: any = { status: newStatus }
      if (clientPackageItemId) {
        payload.clientPackageItemId = clientPackageItemId
      } else if (clientPackageItemId === null && newStatus === 'COMPLETED') {
        // Send explicit null to not deduct
        payload.clientPackageItemId = null
      }

      await updateAppointment(id, payload)
      toast.success(
        newStatus === 'COMPLETED'
          ? 'Presença confirmada' + (clientPackageItemId ? ' e sessão debitada!' : '!')
          : 'Falta registrada!'
      )
    } catch (error) {
      toast.error('Erro ao atualizar status')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleInitiateCompletion = (appointment: any) => {
    setSelectedAptId(appointment.id)
    setSelectedClientId(appointment.patient?.id || appointment.clientId)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <PackageDeductionModal
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
        clientId={selectedClientId || ''}
        appointmentId={selectedAptId || ''}
        onConfirm={async () => {
          if (selectedAptId) {
            await handleUpdateStatus(selectedAptId, 'COMPLETED')
            setSelectedAptId(null)
            setSelectedClientId(null)
          }
        }}
      />
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar paciente, especialidade ou profissional..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="SCHEDULED">Agendado</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                  <SelectItem value="IN_PROGRESS">Em Andamento</SelectItem>
                  <SelectItem value="COMPLETED">Concluído</SelectItem>
                  <SelectItem value="CANCELLED">Cancelado</SelectItem>
                  <SelectItem value="NO_SHOW">Faltou</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48">
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
            <Link href="/dashboard/appointments/new">
              <Button className="w-full md:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Novo Agendamento
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Appointments List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Agendamentos
            </div>
            {!loading && (
              <Badge variant="outline" className="ml-auto">
                {filteredAppointments.length} encontrados
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Lista completa de agendamentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">Carregando agendamentos...</p>
              </div>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum agendamento encontrado
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || statusFilter !== 'all' || dateFilter
                  ? 'Tente ajustar os filtros para ver mais resultados.'
                  : 'Você ainda não tem agendamentos. Crie seu primeiro agendamento agora!'}
              </p>
              <Link href="/dashboard/appointments/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Agendamento
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAppointments.map((appointment) => {
                const appointmentDate = new Date(appointment.date)

                return (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-3 mb-1">
                          <h4 className="text-sm font-medium text-gray-900">
                            {appointment.patient.name}
                          </h4>
                          <Badge
                            className={`text-xs ${statusColors[appointment.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}
                            variant="secondary"
                          >
                            {statusLabels[appointment.status as keyof typeof statusLabels] || appointment.status}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Calendar className="mr-1 h-3 w-3" />
                            {format(appointmentDate, 'dd/MM/yyyy', { locale: ptBR })}
                          </div>
                          <div className="flex items-center">
                            <Clock className="mr-1 h-3 w-3" />
                            {format(appointmentDate, 'HH:mm')}
                          </div>
                          <span>{appointment.specialty || 'Consulta Geral'}</span>
                          {appointment.professional && (
                            <span>• {appointment.professional}</span>
                          )}
                        </div>
                        {appointment.patient.phone && (
                          <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                            <div className="flex items-center">
                              <Phone className="mr-1 h-3 w-3" />
                              {appointment.patient.phone}
                            </div>
                            {appointment.patient.email && (
                              <div className="flex items-center">
                                <Mail className="mr-1 h-3 w-3" />
                                {appointment.patient.email}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Botões de Presença - apenas para agendamentos passados ou do dia que estão SCHEDULED ou CONFIRMED */}
                      {(appointment.status === 'SCHEDULED' || appointment.status === 'CONFIRMED') &&
                        appointmentDate <= new Date() && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              disabled={updatingId === appointment.id}
                              onClick={() => handleInitiateCompletion(appointment)}
                              title="Compareceu"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              disabled={updatingId === appointment.id}
                              onClick={() => handleUpdateStatus(appointment.id, 'NO_SHOW')}
                              title="Faltou"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toast('Função de editar será implementada em breve')}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteAppointment(appointment.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
