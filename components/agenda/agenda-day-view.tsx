
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Clock,
  User,
  Phone,
  Mail,
  Eye,
  Trash2
} from 'lucide-react'
import { formatDateTime, formatPhone } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS, MODALITY_LABELS } from '@/lib/types'
import { AppointmentStatus, ModalityType } from '@prisma/client'

interface DayAppointment {
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

interface AgendaDayViewProps {
  date: Date
  appointments: DayAppointment[]
  onEditAppointment?: (id: string) => void
  onDeleteAppointment?: (id: string) => void
}

export function AgendaDayView({
  date,
  appointments,
  onEditAppointment,
  onDeleteAppointment
}: AgendaDayViewProps) {

  const timeSlots = []
  for (let hour = 6; hour < 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      timeSlots.push(
        new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute)
      )
    }
  }

  const getAppointmentForSlot = (slotTime: Date) => {
    return appointments.find(apt => {
      const aptTime = new Date(apt.date)
      return aptTime.getHours() === slotTime.getHours() &&
        aptTime.getMinutes() === slotTime.getMinutes()
    })
  }

  const formatSlotTime = (time: Date) => {
    return time.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-4">
      {/* Time Slots */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            {timeSlots.map((slot, index) => {
              const appointment = getAppointmentForSlot(slot)

              return (
                <div
                  key={index}
                  className={`
                    flex border-b border-gray-100 min-h-[60px]
                    ${appointment ? 'bg-blue-50/30' : 'hover:bg-gray-50'}
                  `}
                >
                  {/* Time Column */}
                  <div className="w-20 flex-shrink-0 p-3 text-center border-r border-border">
                    <div className="text-sm font-medium text-foreground">
                      {formatSlotTime(slot)}
                    </div>
                  </div>

                  {/* Appointment Column */}
                  <div className="flex-1 p-3">
                    {appointment ? (
                      <div
                        className="flex items-start justify-between cursor-pointer hover:bg-muted/50 -m-3 p-3 rounded transition-colors"
                        onClick={() => onEditAppointment?.(appointment.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-medium text-foreground">
                              {appointment.patient.name}
                            </h4>
                            <Badge className={STATUS_COLORS[appointment.status]}>
                              {STATUS_LABELS[appointment.status]}
                            </Badge>
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                              {MODALITY_LABELS[appointment.modality]}
                            </Badge>
                          </div>

                          <div className="space-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-4">
                              <span className="font-medium text-foreground/80">
                                {appointment.specialty}
                              </span>
                              <span>•</span>
                              <span>{appointment.duration} min</span>
                              {appointment.professional && (
                                <>
                                  <span>•</span>
                                  <span>{appointment.professional}</span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center space-x-4">
                              {appointment.patient.phone && (
                                <div className="flex items-center">
                                  <Phone className="h-3 w-3 mr-1" />
                                  {formatPhone(appointment.patient.phone)}
                                </div>
                              )}
                              {appointment.patient.email && (
                                <div className="flex items-center">
                                  <Mail className="h-3 w-3 mr-1" />
                                  {appointment.patient.email}
                                </div>
                              )}
                            </div>

                            <div className="text-xs text-muted-foreground/70">
                              🏥 {appointment.insurance}
                            </div>

                            {appointment.notes && (
                              <div className="text-xs text-muted-foreground/70 mt-1">
                                {appointment.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center ml-4">
                          <Eye className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground/50 italic">
                        Horário disponível
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
