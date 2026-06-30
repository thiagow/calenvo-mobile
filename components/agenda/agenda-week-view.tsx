
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Clock,
  Calendar,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { STATUS_COLORS, STATUS_LABELS, MODALITY_LABELS } from '@/lib/types'
import { AppointmentStatus, ModalityType } from '@prisma/client'

interface WeekAppointment {
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
  professional?: string
}

interface AgendaWeekViewProps {
  date: Date
  appointments: WeekAppointment[]
  onEditAppointment?: (id: string) => void
  onDeleteAppointment?: (id: string) => void
  onDateChange?: (date: Date) => void
}

export function AgendaWeekView({
  date,
  appointments,
  onEditAppointment,
  onDeleteAppointment,
  onDateChange
}: AgendaWeekViewProps) {

  // Calcular início e fim da semana
  const startOfWeek = new Date(date)
  const day = startOfWeek.getDay()
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Segunda-feira
  startOfWeek.setDate(diff)

  const weekDays: Date[] = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek)
    day.setDate(startOfWeek.getDate() + i)
    weekDays.push(day)
  }

  // Horários (6h às 22h com intervalos de 1 hora)
  const timeSlots = []
  for (let hour = 6; hour < 22; hour++) {
    timeSlots.push(hour)
  }

  const getAppointmentsForDayAndHour = (day: Date, hour: number) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.date)
      return aptDate.toDateString() === day.toDateString() &&
        aptDate.getHours() === hour
    })
  }

  const formatDayHeader = (day: Date) => {
    const isToday = day.toDateString() === new Date().toDateString()
    return (
      <div className={`text-center p-3 ${isToday ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'}`}>
        <div className="text-xs font-medium text-muted-foreground">
          {day.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase()}
        </div>
        <div className={`text-lg ${isToday ? 'font-bold' : 'font-medium'}`}>
          {day.getDate()}
        </div>
      </div>
    )
  }

  // Navigation handlers
  const goToPrevious = () => {
    if (!onDateChange) return
    const newDate = new Date(date)
    newDate.setDate(date.getDate() - 7)
    onDateChange(newDate)
  }

  const goToNext = () => {
    if (!onDateChange) return
    const newDate = new Date(date)
    newDate.setDate(date.getDate() + 7)
    onDateChange(newDate)
  }

  const goToToday = () => {
    if (!onDateChange) return
    onDateChange(new Date())
  }

  const isToday = () => {
    const today = new Date()
    const startOfWeekDate = new Date(date)
    const day = startOfWeekDate.getDay()
    const diff = startOfWeekDate.getDate() - day + (day === 0 ? -6 : 1)
    startOfWeekDate.setDate(diff)
    const endOfWeekDate = new Date(startOfWeekDate)
    endOfWeekDate.setDate(startOfWeekDate.getDate() + 6)
    return today >= startOfWeekDate && today <= endOfWeekDate
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          {/* Navigation Controls */}
          {onDateChange && (
            <div className="flex items-center space-x-1 mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevious}
                className="hover:bg-gray-100 h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                disabled={isToday()}
                className={`
                  px-2 sm:px-3 hover:bg-gray-100 h-8 text-xs sm:text-sm
                  ${isToday() ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                Hoje
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={goToNext}
                className="hover:bg-gray-100 h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Week Title */}
          <CardTitle className="flex items-center text-lg text-foreground">
            <Calendar className="mr-2 h-5 w-5 text-primary" />
            Semana de {startOfWeek.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit'
            })} a {weekDays[6].toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {appointments.length} consultas agendadas esta semana
          </p>
        </CardHeader>
      </Card>

      {/* Week Grid */}
      <Card>
        <CardContent className="p-0 overflow-hidden">
          {/* Mobile: List View */}
          <div className="sm:hidden">
            <div className="divide-y divide-border">
              {weekDays.map((day, dayIndex) => {
                const dayAppointments = appointments.filter(apt => {
                  const aptDate = new Date(apt.date)
                  return aptDate.toDateString() === day.toDateString()
                })

                const isToday = day.toDateString() === new Date().toDateString()

                return (
                  <div key={dayIndex} className={`p-3 ${isToday ? 'bg-primary/5' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">
                          {day.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase()}
                        </div>
                        <div className={`text-lg font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                          {day.getDate()}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {dayAppointments.length} consulta{dayAppointments.length !== 1 ? 's' : ''}
                      </div>
                    </div>

                    {dayAppointments.length > 0 ? (
                      <div className="space-y-2">
                        {dayAppointments.map((appointment, aptIndex) => (
                          <div
                            key={aptIndex}
                            className="p-2 bg-background rounded border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                            onClick={() => onEditAppointment?.(appointment.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-foreground text-sm mb-1">
                                  {appointment.patient.name}
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>
                                      {new Date(appointment.date).toLocaleTimeString('pt-BR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                    <span>•</span>
                                    <span>{appointment.specialty}</span>
                                  </div>
                                  <Badge className={`text-xs ${STATUS_COLORS[appointment.status]}`}>
                                    {STATUS_LABELS[appointment.status]}
                                  </Badge>
                                </div>
                              </div>
                              <Eye className="h-4 w-4 text-muted-foreground/50 ml-2 flex-shrink-0" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground/70 italic text-center py-2">
                        Nenhuma consulta agendada
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Desktop: Grid View */}
          <div className="hidden sm:block overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Header Days */}
              <div className="grid grid-cols-8 border-b border-border">
                <div className="p-3 text-center text-xs font-medium text-muted-foreground">
                  Horário
                </div>
                {weekDays.map((day, index) => (
                  <div key={index} className="border-l border-border">
                    {formatDayHeader(day)}
                  </div>
                ))}
              </div>

              {/* Time Slots */}
              <div className="max-h-[500px] overflow-y-auto">
                {timeSlots.map((hour) => (
                  <div key={hour} className="grid grid-cols-8 border-b border-border/50 min-h-[80px]">
                    {/* Time Column */}
                    <div className="p-3 text-center text-sm font-medium text-muted-foreground border-r border-border">
                      {hour.toString().padStart(2, '0')}:00
                    </div>

                    {/* Day Columns */}
                    {weekDays.map((day, dayIndex) => {
                      const dayAppointments = getAppointmentsForDayAndHour(day, hour)

                      return (
                        <div
                          key={dayIndex}
                          className={`
                            p-2 border-l border-border/50 
                            ${dayAppointments.length > 0 ? 'bg-primary/5' : 'hover:bg-muted/30'}
                          `}
                        >
                          {dayAppointments.map((appointment, aptIndex) => (
                            <div
                              key={aptIndex}
                              className="mb-1 p-2 bg-background rounded border border-primary/20 text-xs hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                              onClick={() => onEditAppointment?.(appointment.id)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate text-foreground mb-1">
                                    {appointment.patient.name}
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center space-x-1">
                                      <Clock className="h-3 w-3 text-muted-foreground/50" />
                                      <span className="text-muted-foreground">
                                        {new Date(appointment.date).toLocaleTimeString('pt-BR', {
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </span>
                                    </div>
                                    <div className="truncate text-muted-foreground">
                                      {appointment.specialty}
                                    </div>
                                    {appointment.professional && (
                                      <div className="truncate text-muted-foreground/70 text-xs">
                                        {appointment.professional}
                                      </div>
                                    )}
                                    <div className="flex items-center space-x-1">
                                      <Badge className={`text-xs ${STATUS_COLORS[appointment.status]}`}>
                                        {STATUS_LABELS[appointment.status]}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>

                                <Eye className="h-3 w-3 text-muted-foreground/50 ml-1 flex-shrink-0" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
