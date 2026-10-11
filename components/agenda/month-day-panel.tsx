'use client'

import { forwardRef } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, ChevronRight, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/types'
import { AppointmentStatus } from '@prisma/client'

export interface DayPanelAppointment {
  id: string
  date: Date
  patient: { name: string }
  specialty: string
  status: AppointmentStatus
  duration: number
  professional?: string
  isOverbooked?: boolean
}

interface MonthDayPanelProps<T extends DayPanelAppointment> {
  day: Date
  appointments: T[]
  onAppointmentClick: (appointment: T) => void
  /** Abre a vista "Dia" neste dia. */
  onOpenDay: (day: Date) => void
}

const time = (date: Date) => format(new Date(date), 'HH:mm')

/**
 * Todos os agendamentos do dia tocado no calendário do mês, sem sair da vista.
 * Alvos de toque grandes: cada linha é um botão de 56 px ou mais.
 */
function MonthDayPanelInner<T extends DayPanelAppointment>(
  { day, appointments, onAppointmentClick, onOpenDay }: MonthDayPanelProps<T>,
  ref: React.ForwardedRef<HTMLElement>
) {
  const sorted = [...appointments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const title = format(day, "EEEE, d 'de' MMMM", { locale: ptBR })

  return (
    <section ref={ref} aria-live="polite" className="scroll-mt-16">
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold capitalize">{title}</h3>
              <p className="text-xs text-muted-foreground">
                {sorted.length === 0
                  ? 'Nenhum agendamento'
                  : `${sorted.length} agendamento${sorted.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={() => onOpenDay(day)}>
              <CalendarDays className="mr-1.5 h-4 w-4" />
              Ver dia
            </Button>
          </div>

          {sorted.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum agendamento neste dia.</p>
          ) : (
            <ul className="divide-y">
              {sorted.map((appointment) => (
                <li key={appointment.id}>
                  <button
                    type="button"
                    onClick={() => onAppointmentClick(appointment)}
                    className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-muted"
                  >
                    <div className="w-12 shrink-0 text-center">
                      <div className="text-sm font-semibold tabular-nums">{time(appointment.date)}</div>
                      <div className="text-[10px] text-muted-foreground">{appointment.duration} min</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{appointment.patient.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {appointment.specialty}
                        {appointment.professional ? ` · ${appointment.professional}` : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge className={`${STATUS_COLORS[appointment.status]} text-[10px]`}>
                        {STATUS_LABELS[appointment.status]}
                      </Badge>
                      {appointment.isOverbooked && <span className="text-[10px] text-amber-700">⚡ Encaixe</span>}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t p-3">
            <Button asChild variant="ghost" className="h-10 w-full justify-center text-primary">
              <Link href={`/dashboard/appointments/new?date=${format(day, 'yyyy-MM-dd')}`}>
                <Plus className="mr-1.5 h-4 w-4" />
                Novo agendamento neste dia
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

export const MonthDayPanel = forwardRef(MonthDayPanelInner) as <T extends DayPanelAppointment>(
  props: MonthDayPanelProps<T> & { ref?: React.ForwardedRef<HTMLElement> }
) => ReturnType<typeof MonthDayPanelInner>
