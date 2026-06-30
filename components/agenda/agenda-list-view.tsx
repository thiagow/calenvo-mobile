
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  Eye,
  Trash2,
  MapPin,
  FileText
} from 'lucide-react'
import { formatDateTime, formatPhone } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS, MODALITY_LABELS } from '@/lib/types'
import { AppointmentStatus, ModalityType } from '@prisma/client'

interface ListAppointment {
  id: string
  date: Date
  patient: {
    name: string
    phone?: string
    email?: string
  }
  specialty: string
  status: AppointmentStatus
  modality: ModalityType
  duration: number
  insurance: string
  notes?: string
  professional?: string
}

interface AgendaListViewProps {
  appointments: ListAppointment[]
  onEditAppointment?: (id: string) => void
  onDeleteAppointment?: (id: string) => void
}

export function AgendaListView({
  appointments,
  onEditAppointment,
  onDeleteAppointment
}: AgendaListViewProps) {

  // Agrupar appointments por data
  const appointmentsByDate = appointments.reduce((acc, appointment) => {
    const dateKey = appointment.date.toDateString()
    if (!acc[dateKey]) {
      acc[dateKey] = []
    }
    acc[dateKey].push(appointment)
    return acc
  }, {} as Record<string, ListAppointment[]>)

  // Ordenar datas
  const sortedDates = Object.keys(appointmentsByDate).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime()
  })

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(today.getDate() + 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje'
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Amanhã'
    } else {
      return date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }
  }

  const getStatusIcon = (status: AppointmentStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return '✅'
      case 'SCHEDULED':
        return '📅'
      case 'IN_PROGRESS':
        return '🕐'
      case 'COMPLETED':
        return '✅'
      case 'CANCELLED':
        return '❌'
      case 'NO_SHOW':
        return '❌'
      default:
        return '📅'
    }
  }

  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhuma consulta encontrada
          </h3>
          <p className="text-gray-600 mb-4">
            Não há consultas correspondentes aos filtros aplicados.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <Calendar className="mr-2 h-5 w-5 text-blue-600" />
            Lista de Consultas
          </CardTitle>
          <p className="text-sm text-gray-600">
            {appointments.length} consulta{appointments.length !== 1 ? 's' : ''} encontrada{appointments.length !== 1 ? 's' : ''}
          </p>
        </CardHeader>
      </Card>

      {/* Appointments by Date */}
      {sortedDates.map((dateString) => {
        const dayAppointments = appointmentsByDate[dateString].sort((a, b) => {
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        })

        return (
          <div key={dateString} className="space-y-3">
            {/* Date Header */}
            <div className="flex items-center space-x-3">
              <div className="text-lg font-semibold text-gray-900">
                {formatDateHeader(dateString)}
              </div>
              <div className="text-sm text-gray-600">
                {new Date(dateString).toLocaleDateString('pt-BR')}
              </div>
              <div className="flex-1 h-px bg-gray-200"></div>
              <Badge variant="outline" className="text-xs">
                {dayAppointments.length} consulta{dayAppointments.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {/* Appointments */}
            <div className="space-y-3">
              {dayAppointments.map((appointment) => (
                <Card
                  key={appointment.id}
                  className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-blue-500 cursor-pointer hover:border-l-blue-600"
                  onClick={() => onEditAppointment?.(appointment.id)}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                      <div className="flex-1 w-full">
                        {/* Header */}
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900 text-sm sm:text-base">
                              {new Date(appointment.date).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className="text-xs sm:text-sm text-gray-600">
                              {appointment.duration} min
                            </span>
                          </div>
                          <Badge className={`${STATUS_COLORS[appointment.status]} text-xs`}>
                            {getStatusIcon(appointment.status)} {STATUS_LABELS[appointment.status]}
                          </Badge>
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">
                            {MODALITY_LABELS[appointment.modality]}
                          </Badge>
                        </div>

                        {/* Content */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          {/* Patient Info */}
                          <div>
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 flex items-center">
                              <User className="h-4 w-4 mr-2 text-blue-600" />
                              {appointment.patient.name}
                            </h3>
                            <div className="space-y-1 text-xs sm:text-sm text-gray-600">
                              {appointment.patient.phone && (
                                <div className="flex items-center">
                                  <Phone className="h-3 w-3 mr-2 flex-shrink-0" />
                                  <span className="break-all">{formatPhone(appointment.patient.phone)}</span>
                                </div>
                              )}
                              {appointment.patient.email && (
                                <div className="flex items-center">
                                  <Mail className="h-3 w-3 mr-2 flex-shrink-0" />
                                  <span className="break-all">{appointment.patient.email}</span>
                                </div>
                              )}
                              <div className="flex items-center">
                                <MapPin className="h-3 w-3 mr-2 flex-shrink-0" />
                                <span>{appointment.insurance}</span>
                              </div>
                            </div>
                          </div>

                          {/* Appointment Details */}
                          <div>
                            <div className="space-y-2 text-xs sm:text-sm">
                              <div className="flex items-start">
                                <span className="font-medium text-gray-700 w-20 sm:w-24 flex-shrink-0">Especialidade:</span>
                                <span className="text-gray-600">{appointment.specialty}</span>
                              </div>
                              {appointment.professional && (
                                <div className="flex items-start">
                                  <span className="font-medium text-gray-700 w-20 sm:w-24 flex-shrink-0">Profissional:</span>
                                  <span className="text-gray-600">{appointment.professional}</span>
                                </div>
                              )}
                              {appointment.notes && (
                                <div className="flex items-start">
                                  <span className="font-medium text-gray-700 w-20 sm:w-24 flex-shrink-0">Observações:</span>
                                  <span className="text-gray-600 text-xs break-words">{appointment.notes}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Edit Icon */}
                      <div className="flex items-center justify-center w-full sm:w-auto">
                        <Eye className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
