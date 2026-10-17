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
  /** Por que a data não tem horário (texto para o cliente), quando o servidor sabe. */
  noSlotsReason?: string | null
  selectedTime: string
  onSelectTime: (time: string) => void
}

/** A partir de quantas opções vale separar a lista em Manhã / Tarde / Noite. */
const GROUP_THRESHOLD = 8

/**
 * Agrupa os horários por período do dia (manhã < 12h, tarde 12h–17:59, noite ≥ 18h) quando
 * há muitas opções — com passo de 30 min a lista cresce e fica difícil de varrer. Com poucas,
 * devolve um grupo único sem título. Períodos vazios não aparecem.
 */
export function groupSlotsByPeriod(slots: BookingTimeSlot[]): { label: string; slots: BookingTimeSlot[] }[] {
  if (slots.length <= GROUP_THRESHOLD) return [{ label: '', slots }]

  const periods = [
    { label: 'Manhã', slots: slots.filter((s) => s.time < '12:00') },
    { label: 'Tarde', slots: slots.filter((s) => s.time >= '12:00' && s.time < '18:00') },
    { label: 'Noite', slots: slots.filter((s) => s.time >= '18:00') },
  ]
  return periods.filter((p) => p.slots.length > 0)
}

export function DateTimeStep({
  selectedDate,
  onSelectDate,
  slots,
  loadingSlots,
  maxDate,
  noSlotsReason,
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
            <div className="space-y-4">
              {groupSlotsByPeriod(availableSlots).map((group) => (
                <div key={group.label} className="space-y-2">
                  {/* Com poucas opções, um bloco só e sem título: não polui o caso simples */}
                  {group.label && (
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    {group.slots.map((slot) => (
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
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {noSlotsReason ??
                (isBeyondWindow
                  ? `Agendamentos abertos até ${maxDateLabel}`
                  : 'Não há horários disponíveis para esta data')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
