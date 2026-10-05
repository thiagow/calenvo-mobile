'use client'

import { Loader2 } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { BookingTimeSlot } from './types'

interface DateTimeStepProps {
  selectedDate: Date | undefined
  onSelectDate: (date: Date | undefined) => void
  slots: BookingTimeSlot[]
  loadingSlots: boolean
  /** Último dia reservável ("YYYY-MM-DD"); null enquanto desconhecido. */
  maxDate: string | null
  selectedTime: string
  onSelectTime: (time: string) => void
}

export function DateTimeStep({
  selectedDate,
  onSelectDate,
  slots,
  loadingSlots,
  maxDate,
  selectedTime,
  onSelectTime,
}: DateTimeStepProps) {
  // Só exibimos o que o cliente consegue reservar — horários ocupados
  // desabilitados confundiam quem tentava clicar neles.
  const availableSlots = slots.filter((slot) => slot.available)

  const isBeyondWindow = Boolean(
    selectedDate && maxDate && format(selectedDate, 'yyyy-MM-dd') > maxDate
  )
  const maxDateLabel = maxDate ? maxDate.split('-').reverse().slice(0, 2).join('/') : ''

  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onSelectDate}
          locale={ptBR}
          disabled={(date) =>
            date < new Date(new Date().setHours(0, 0, 0, 0)) ||
            Boolean(maxDate && format(date, 'yyyy-MM-dd') > maxDate)
          }
          className="rounded-xl border"
        />
      </div>

      {selectedDate && (
        <div className="space-y-2">
          <Label>Horários Disponíveis</Label>
          {loadingSlots ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : availableSlots.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {availableSlots.map((slot) => (
                <Button
                  key={slot.time}
                  type="button"
                  variant={selectedTime === slot.time ? 'default' : 'outline'}
                  onClick={() => onSelectTime(slot.time)}
                  className="w-full"
                >
                  {slot.time}
                </Button>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {isBeyondWindow
                ? `Agendamentos abertos até ${maxDateLabel}`
                : 'Não há horários disponíveis para esta data'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
