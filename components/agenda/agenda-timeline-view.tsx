
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Edit2, User } from 'lucide-react'
import { addDays, format, isSameDay, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/types'
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

const CARD_COLOR: Record<AppointmentStatus, string> = {
  CONFIRMED: 'border-green-300 bg-green-50',
  SCHEDULED: 'border-blue-300 bg-blue-50',
  IN_PROGRESS: 'border-yellow-300 bg-yellow-50',
  COMPLETED: 'border-gray-300 bg-gray-50',
  CANCELLED: 'border-red-300 bg-red-50',
  NO_SHOW: 'border-purple-300 bg-purple-50',
}

const DOT_COLOR: Record<AppointmentStatus, string> = {
  CONFIRMED: 'bg-green-500',
  SCHEDULED: 'bg-blue-500',
  IN_PROGRESS: 'bg-yellow-500',
  COMPLETED: 'bg-gray-500',
  CANCELLED: 'bg-red-500',
  NO_SHOW: 'bg-purple-500',
}

/** "Hoje", "Amanhã" ou o dia da semana — o texto relativo que acompanha a data. */
function relativeDayLabel(day: Date): string | null {
  const today = startOfDay(new Date())
  if (isSameDay(day, today)) return 'Hoje'
  if (isSameDay(day, addDays(today, 1))) return 'Amanhã'
  return null
}

export function AgendaTimelineView({ appointments, onEditAppointment }: AgendaTimelineViewProps) {
  // Do mais próximo para o mais distante, agrupado por dia.
  const sorted = [...appointments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const days: { key: string; day: Date; items: TimelineAppointment[] }[] = []
  for (const appointment of sorted) {
    const date = new Date(appointment.date)
    const key = format(date, 'yyyy-MM-dd')
    const last = days[days.length - 1]
    if (last && last.key === key) last.items.push(appointment)
    else days.push({ key, day: date, items: [appointment] })
  }

  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">Nenhum agendamento encontrado</h3>
          <p className="mb-4 text-gray-600">Não há agendamentos a partir de hoje com os filtros aplicados.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="flex items-center text-lg">
            <Clock className="mr-2 h-5 w-5 text-blue-600" />
            Linha de Tempo
          </CardTitle>
          <p className="text-sm text-gray-600">
            {appointments.length} agendamento{appointments.length !== 1 ? 's' : ''} a partir de hoje, em ordem cronológica
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-3 sm:p-6">
          <ol className="relative space-y-5 border-l-2 border-gray-200 pl-5 sm:pl-8">
            {days.map(({ key, day, items }) => {
              const relative = relativeDayLabel(day)
              return (
                <li key={key} className="relative">
                  {/* Cabeçalho do dia, preso ao trilho da linha do tempo */}
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-600 shadow sm:-left-[39px]" />
                  <h3 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-gray-900">
                    {relative && <span className="text-blue-700">{relative}</span>}
                    <span className="capitalize">{format(day, "EEE, d 'de' MMMM", { locale: ptBR })}</span>
                    <span className="text-xs font-normal text-gray-500">
                      {items.length} agendamento{items.length !== 1 ? 's' : ''}
                    </span>
                  </h3>

                  <ul className="space-y-2">
                    {items.map((appointment) => (
                      <li key={appointment.id}>
                        <button
                          type="button"
                          onClick={() => onEditAppointment?.(appointment.id)}
                          className={cn(
                            'flex w-full min-w-0 items-start gap-3 rounded-lg border p-3 text-left transition-shadow hover:shadow-md active:shadow-sm',
                            CARD_COLOR[appointment.status]
                          )}
                        >
                          <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', DOT_COLOR[appointment.status])} />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-base font-semibold tabular-nums text-gray-900">
                                {format(new Date(appointment.date), 'HH:mm')}
                              </span>
                              <span className="text-xs text-gray-500">{appointment.duration} min</span>
                              <Badge className={cn(STATUS_COLORS[appointment.status], 'text-[11px]')}>
                                {STATUS_LABELS[appointment.status]}
                              </Badge>
                            </div>
                            <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-gray-900">
                              <User className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                              <span className="truncate">{appointment.patient.name}</span>
                            </div>
                            <p className="break-words text-sm text-gray-600">
                              {appointment.specialty}
                              {appointment.professional ? ` · ${appointment.professional}` : ''}
                            </p>
                          </div>
                          <Edit2 className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
