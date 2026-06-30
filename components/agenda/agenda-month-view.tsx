
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar,
  Clock,
  Eye,
  ChevronRight,
  ChevronLeft
} from 'lucide-react'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/types'
import { AppointmentStatus, ModalityType } from '@prisma/client'

interface MonthAppointment {
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

interface AgendaMonthViewProps {
  date: Date
  appointments: MonthAppointment[]
  onDayClick?: (date: Date) => void
  onAppointmentClick?: (appointment: MonthAppointment) => void
  onDateChange?: (date: Date) => void
}

export function AgendaMonthView({ 
  date, 
  appointments, 
  onDayClick,
  onAppointmentClick,
  onDateChange
}: AgendaMonthViewProps) {
  
  const today = new Date()
  const year = date.getFullYear()
  const month = date.getMonth()

  // Primeiro dia do mês
  const firstDayOfMonth = new Date(year, month, 1)
  // Último dia do mês
  const lastDayOfMonth = new Date(year, month + 1, 0)
  
  // Primeiro dia da primeira semana (pode ser do mês anterior)
  const firstDayOfGrid = new Date(firstDayOfMonth)
  firstDayOfGrid.setDate(firstDayOfGrid.getDate() - firstDayOfGrid.getDay())
  
  // Último dia da última semana (pode ser do próximo mês)
  const lastDayOfGrid = new Date(lastDayOfMonth)
  lastDayOfGrid.setDate(lastDayOfGrid.getDate() + (6 - lastDayOfGrid.getDay()))

  // Gerar todas as datas do grid (6 semanas x 7 dias = 42 dias)
  const calendarDays = []
  const currentDate = new Date(firstDayOfGrid)
  
  for (let i = 0; i < 42; i++) {
    calendarDays.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 1)
  }

  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.date)
      return aptDate.toDateString() === day.toDateString()
    })
  }

  const isToday = (day: Date) => {
    return day.toDateString() === today.toDateString()
  }

  const isCurrentMonth = (day: Date) => {
    return day.getMonth() === month
  }

  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const weekdaysMobile = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

  // Navigation handlers
  const goToPrevious = () => {
    if (!onDateChange) return
    const newDate = new Date(date)
    newDate.setMonth(date.getMonth() - 1)
    onDateChange(newDate)
  }

  const goToNext = () => {
    if (!onDateChange) return
    const newDate = new Date(date)
    newDate.setMonth(date.getMonth() + 1)
    onDateChange(newDate)
  }

  const goToToday = () => {
    if (!onDateChange) return
    onDateChange(new Date())
  }

  const isTodayMonth = () => {
    const todayDate = new Date()
    return date.getMonth() === todayDate.getMonth() && 
           date.getFullYear() === todayDate.getFullYear()
  }

  return (
    <div className="space-y-3 sm:space-y-4">
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
                disabled={isTodayMonth()}
                className={`
                  px-2 sm:px-3 hover:bg-gray-100 h-8 text-xs sm:text-sm
                  ${isTodayMonth() ? 'opacity-50 cursor-not-allowed' : ''}
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
          
          {/* Month Title */}
          <CardTitle className="flex items-center text-lg">
            <Calendar className="mr-2 h-5 w-5 text-blue-600" />
            {date.toLocaleDateString('pt-BR', { 
              month: 'long', 
              year: 'numeric' 
            })}
          </CardTitle>
          <p className="text-sm text-gray-600">
            {appointments.length} consultas agendadas este mês
          </p>
        </CardHeader>
      </Card>
      
      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0 overflow-x-hidden">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {weekdays.map((day, index) => (
              <div 
                key={day}
                className="p-2 text-center text-xs font-medium text-gray-600 border-r border-gray-100 last:border-r-0"
              >
                {/* Show full name on desktop, abbreviated on mobile */}
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{weekdaysMobile[index]}</span>
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const dayAppointments = getAppointmentsForDay(day)
              const isCurrentMonthDay = isCurrentMonth(day)
              const isTodayDate = isToday(day)
              
              return (
                <div
                  key={index}
                  className={`
                    relative border-r border-b border-gray-100 last:border-r-0 
                    min-h-[60px] sm:min-h-[80px] md:h-32 p-1 sm:p-2
                    ${isCurrentMonthDay 
                      ? 'bg-white hover:bg-gray-50 cursor-pointer' 
                      : 'bg-gray-50 text-gray-400'
                    }
                    ${isTodayDate ? 'bg-blue-50 border-blue-200' : ''}
                  `}
                  onClick={() => isCurrentMonthDay && onDayClick?.(day)}
                >
                  {/* Day Number */}
                  <div className={`
                    text-xs sm:text-sm font-medium mb-0.5 sm:mb-1
                    ${isTodayDate 
                      ? 'text-blue-700 bg-blue-600 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-[10px] sm:text-xs mx-auto' 
                      : isCurrentMonthDay 
                        ? 'text-gray-900 text-center' 
                        : 'text-gray-400 text-center'
                    }
                  `}>
                    {day.getDate()}
                  </div>

                  {/* Appointments */}
                  <div className="space-y-0.5 sm:space-y-1 overflow-hidden">
                    {/* Mobile: Show dots */}
                    <div className="flex sm:hidden flex-wrap gap-0.5 justify-center">
                      {dayAppointments.slice(0, 6).map((appointment, aptIndex) => (
                        <button
                          key={aptIndex}
                          className={`
                            w-1.5 h-1.5 rounded-full cursor-pointer hover:scale-125 transition-transform
                            ${appointment.status === 'CONFIRMED' ? 'bg-green-400' :
                              appointment.status === 'SCHEDULED' ? 'bg-blue-400' :
                              appointment.status === 'IN_PROGRESS' ? 'bg-yellow-400' :
                              appointment.status === 'COMPLETED' ? 'bg-gray-400' :
                              appointment.status === 'CANCELLED' ? 'bg-red-400' :
                              'bg-purple-400'}
                          `}
                          onClick={(e) => {
                            e.stopPropagation()
                            onAppointmentClick?.(appointment)
                          }}
                        />
                      ))}
                      {dayAppointments.length > 6 && (
                        <button 
                          className="text-[8px] text-blue-600 font-medium hover:underline cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (onDayClick) onDayClick(day)
                          }}
                        >
                          +{dayAppointments.length - 6}
                        </button>
                      )}
                    </div>

                    {/* Tablet and Desktop: Show appointment cards */}
                    <div className="hidden sm:block">
                      {dayAppointments.slice(0, 2).map((appointment, aptIndex) => (
                        <button
                          key={aptIndex}
                          className="w-full text-xs p-1 rounded cursor-pointer hover:shadow-md transition-all bg-white border border-blue-200 hover:border-blue-400"
                          onClick={(e) => {
                            e.stopPropagation()
                            onAppointmentClick?.(appointment)
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center space-x-1">
                                <Clock className="h-2 w-2 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-600 text-[10px]">
                                  {new Date(appointment.date).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              <div className="truncate font-medium text-gray-800 text-[10px]">
                                {appointment.patient.name}
                              </div>
                              <div className="hidden md:block truncate text-gray-600 text-[10px]">
                                {appointment.specialty}
                              </div>
                            </div>
                            <div className={`
                              w-2 h-2 rounded-full flex-shrink-0 ml-1
                              ${appointment.status === 'CONFIRMED' ? 'bg-green-400' :
                                appointment.status === 'SCHEDULED' ? 'bg-blue-400' :
                                appointment.status === 'IN_PROGRESS' ? 'bg-yellow-400' :
                                appointment.status === 'COMPLETED' ? 'bg-gray-400' :
                                appointment.status === 'CANCELLED' ? 'bg-red-400' :
                                'bg-purple-400'}
                            `} />
                          </div>
                        </button>
                      ))}
                      
                      {/* Show more indicator */}
                      {dayAppointments.length > 2 && (
                        <button 
                          className="w-full text-[10px] text-blue-600 font-medium cursor-pointer hover:underline text-center"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (onDayClick) onDayClick(day)
                          }}
                        >
                          +{dayAppointments.length - 2} mais
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4 text-xs">
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-400 rounded-full flex-shrink-0"></div>
              <span className="text-xs">Confirmado</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-400 rounded-full flex-shrink-0"></div>
              <span className="text-xs">Agendado</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-yellow-400 rounded-full flex-shrink-0"></div>
              <span className="text-xs">Em andamento</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-gray-400 rounded-full flex-shrink-0"></div>
              <span className="text-xs">Concluído</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-400 rounded-full flex-shrink-0"></div>
              <span className="text-xs">Cancelado</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-purple-400 rounded-full flex-shrink-0"></div>
              <span className="text-xs">Faltou</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
