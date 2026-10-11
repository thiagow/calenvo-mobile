
'use client'

import { useMemo, useRef, useState } from 'react'
import { format, isSameDay, isSameMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AppointmentStatus, ModalityType } from '@prisma/client'
import { MonthDayPanel } from './month-day-panel'

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
  isOverbooked?: boolean
}

interface AgendaMonthViewProps {
  date: Date
  appointments: MonthAppointment[]
  /** Abre a vista "Dia" no dia escolhido. */
  onDayClick?: (date: Date) => void
  onAppointmentClick?: (appointment: MonthAppointment) => void
}

const STATUS_DOT: Record<AppointmentStatus, string> = {
  CONFIRMED: 'bg-green-400',
  SCHEDULED: 'bg-blue-400',
  IN_PROGRESS: 'bg-yellow-400',
  COMPLETED: 'bg-gray-400',
  CANCELLED: 'bg-red-400',
  NO_SHOW: 'bg-purple-400',
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const WEEKDAYS_MOBILE = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MAX_DOTS = 3

/** Dia selecionado por padrão: hoje, se estiver no mês exibido; senão o dia 1. */
function defaultDay(month: Date): Date {
  const today = new Date()
  return isSameMonth(today, month) ? today : new Date(month.getFullYear(), month.getMonth(), 1)
}

export function AgendaMonthView({ date, appointments, onDayClick, onAppointmentClick }: AgendaMonthViewProps) {
  const today = new Date()
  const year = date.getFullYear()
  const month = date.getMonth()
  const panelRef = useRef<HTMLElement>(null)
  const [picked, setPicked] = useState<Date | null>(null)

  // Só vale enquanto o mês exibido for o do dia escolhido; ao navegar de mês volta ao padrão.
  const selectedDay = picked && isSameMonth(picked, date) ? picked : defaultDay(date)

  const calendarDays = useMemo(() => {
    const start = new Date(year, month, 1)
    start.setDate(start.getDate() - start.getDay())
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }, [year, month])

  const byDay = useMemo(() => {
    const map = new Map<string, MonthAppointment[]>()
    for (const appointment of appointments) {
      const key = format(new Date(appointment.date), 'yyyy-MM-dd')
      const list = map.get(key)
      if (list) list.push(appointment)
      else map.set(key, [appointment])
    }
    return map
  }, [appointments])

  const forDay = (day: Date) => byDay.get(format(day, 'yyyy-MM-dd')) ?? []

  const selectDay = (day: Date) => {
    setPicked(day)
    // Leva o painel à vista sem pular a tela inteira ('nearest') e respeita "reduzir movimento".
    requestAnimationFrame(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      panelRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' })
    })
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="overflow-x-hidden p-0">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {WEEKDAYS.map((day, index) => (
              <div
                key={day}
                className="border-r border-gray-100 p-2 text-center text-xs font-medium text-gray-600 last:border-r-0"
              >
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{WEEKDAYS_MOBILE[index]}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const dayAppointments = forDay(day)
              const inMonth = isSameMonth(day, date)
              const isToday = isSameDay(day, today)
              const isSelected = inMonth && isSameDay(day, selectedDay)
              const count = dayAppointments.length

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={!inMonth}
                  aria-pressed={isSelected}
                  aria-label={`${format(day, "d 'de' MMMM", { locale: ptBR })}, ${
                    count === 0 ? 'sem agendamentos' : `${count} agendamento${count === 1 ? '' : 's'}`
                  }`}
                  onClick={() => selectDay(day)}
                  className={cn(
                    'relative flex min-h-[56px] flex-col items-stretch border-b border-r border-gray-100 p-1 text-left outline-none last:border-r-0 sm:min-h-[88px] sm:p-2 md:h-32',
                    'focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary',
                    inMonth ? 'bg-white active:bg-gray-100 sm:hover:bg-gray-50' : 'bg-gray-50 text-gray-300',
                    isSelected && 'z-[1] bg-blue-50/60 ring-2 ring-inset ring-primary'
                  )}
                >
                  <span
                    className={cn(
                      'mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium sm:text-sm',
                      isToday ? 'bg-blue-600 text-white' : inMonth ? 'text-gray-900' : 'text-gray-300'
                    )}
                  >
                    {day.getDate()}
                  </span>

                  {count > 0 && (
                    <>
                      {/* Mobile: só um resumo — o alvo de toque é a célula inteira, o detalhe fica no painel */}
                      <span className="mt-1 flex flex-wrap items-center justify-center gap-0.5 sm:hidden" aria-hidden>
                        {dayAppointments.slice(0, MAX_DOTS).map((appointment) => (
                          <span key={appointment.id} className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[appointment.status])} />
                        ))}
                        {count > MAX_DOTS && (
                          <span className="text-[9px] font-semibold leading-none text-blue-600">+{count - MAX_DOTS}</span>
                        )}
                      </span>

                      {/* Tablet e desktop: prévia das duas primeiras */}
                      <span className="mt-1 hidden space-y-1 overflow-hidden sm:block" aria-hidden>
                        {dayAppointments.slice(0, 2).map((appointment) => (
                          <span
                            key={appointment.id}
                            className="flex items-center justify-between rounded border border-blue-200 bg-white px-1 py-0.5 text-[10px]"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              <span className="text-gray-500">{format(new Date(appointment.date), 'HH:mm')}</span>{' '}
                              <span className="font-medium text-gray-800">{appointment.patient.name}</span>
                            </span>
                            <span className={cn('ml-1 h-2 w-2 shrink-0 rounded-full', STATUS_DOT[appointment.status])} />
                          </span>
                        ))}
                        {count > 2 && (
                          <span className="block text-center text-[10px] font-medium text-blue-600">+{count - 2} mais</span>
                        )}
                      </span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <MonthDayPanel
        ref={panelRef}
        day={selectedDay}
        appointments={forDay(selectedDay)}
        onAppointmentClick={(appointment) => onAppointmentClick?.(appointment)}
        onOpenDay={(day) => onDayClick?.(day)}
      />

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2 text-xs sm:flex sm:flex-wrap sm:gap-4">
            {[
              ['bg-green-400', 'Confirmado'],
              ['bg-blue-400', 'Agendado'],
              ['bg-yellow-400', 'Em andamento'],
              ['bg-gray-400', 'Concluído'],
              ['bg-red-400', 'Cancelado'],
              ['bg-purple-400', 'Faltou'],
            ].map(([color, label]) => (
              <div key={label} className="flex items-center space-x-1.5">
                <div className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full sm:h-3 sm:w-3', color)} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
