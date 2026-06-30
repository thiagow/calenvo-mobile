
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
  Edit2, 
  Trash2,
  ChevronRight
} from 'lucide-react'
import { formatDateTime, formatPhone } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS, MODALITY_LABELS } from '@/lib/types'
import { AppointmentStatus, ModalityType } from '@prisma/client'


interface TimelineAppointment {
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

interface AgendaTimelineViewProps {
  appointments: TimelineAppointment[]
  onEditAppointment?: (id: string) => void
  onDeleteAppointment?: (id: string) => void
}

export function AgendaTimelineView({ 
  appointments, 
  onEditAppointment,
  onDeleteAppointment 
}: AgendaTimelineViewProps) {
  


  // Ordenar appointments por data (mais recentes primeiro)
  const sortedAppointments = [...appointments].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  const formatTimelineDate = (date: Date) => {
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60))
    const diffMinutes = Math.ceil(diffTime / (1000 * 60))

    if (diffMinutes < 60) {
      return diffMinutes <= 0 ? 'Agora' : `${diffMinutes} min atrás`
    } else if (diffHours < 24) {
      return `${diffHours} hora${diffHours > 1 ? 's' : ''} atrás`
    } else if (diffDays < 7) {
      return `${diffDays} dia${diffDays > 1 ? 's' : ''} atrás`
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    }
  }

  const getTimelineColor = (status: AppointmentStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return 'border-green-300 bg-green-50'
      case 'SCHEDULED':
        return 'border-blue-300 bg-blue-50'
      case 'IN_PROGRESS':
        return 'border-yellow-300 bg-yellow-50'
      case 'COMPLETED':
        return 'border-gray-300 bg-gray-50'
      case 'CANCELLED':
        return 'border-red-300 bg-red-50'
      case 'NO_SHOW':
        return 'border-purple-300 bg-purple-50'
      default:
        return 'border-gray-300 bg-gray-50'
    }
  }

  const getTimelineDotColor = (status: AppointmentStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-500'
      case 'SCHEDULED':
        return 'bg-blue-500'
      case 'IN_PROGRESS':
        return 'bg-yellow-500'
      case 'COMPLETED':
        return 'bg-gray-500'
      case 'CANCELLED':
        return 'bg-red-500'
      case 'NO_SHOW':
        return 'bg-purple-500'
      default:
        return 'bg-gray-500'
    }
  }

  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
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
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <Clock className="mr-2 h-5 w-5 text-blue-600" />
            Timeline das Consultas
          </CardTitle>
          <p className="text-sm text-gray-600">
            {appointments.length} consulta{appointments.length !== 1 ? 's' : ''} em ordem cronológica
          </p>
        </CardHeader>
      </Card>

      {/* Timeline */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

            {/* Timeline Items */}
            <div className="space-y-6">
              {sortedAppointments.map((appointment, index) => {
                const timelineColor = getTimelineColor(appointment.status)
                const dotColor = getTimelineDotColor(appointment.status)

                return (
                  <div key={appointment.id} className="relative">
                    {/* Timeline Dot */}
                    <div className={`
                      absolute left-4 w-4 h-4 rounded-full border-2 border-white ${dotColor} 
                      shadow-md z-10
                    `} />

                    {/* Timeline Content */}
                    <div className="ml-12">
                      <div 
                        className={`
                          rounded-lg border p-4 cursor-pointer transition-all duration-200 
                          hover:shadow-md hover:border-blue-400 ${timelineColor}
                        `}
                        onClick={() => onEditAppointment?.(appointment.id)}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span className="font-medium text-gray-900">
                                {new Date(appointment.date).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              <span className="text-sm text-gray-500">
                                {formatTimelineDate(appointment.date)}
                              </span>
                            </div>
                            <Badge className={STATUS_COLORS[appointment.status]}>
                              {STATUS_LABELS[appointment.status]}
                            </Badge>
                          </div>
                          <Edit2 className="h-4 w-4 text-gray-400" />
                        </div>

                        {/* Basic Info */}
                        <div className="mt-3">
                          <div className="flex items-center space-x-4 text-sm">
                            <div className="flex items-center space-x-1">
                              <User className="h-3 w-3 text-gray-400" />
                              <span className="font-medium text-gray-900">
                                {appointment.patient.name}
                              </span>
                            </div>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-600">
                              {appointment.specialty}
                            </span>
                            {appointment.professional && (
                              <>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-600">
                                  {appointment.professional}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
