
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, Clock } from 'lucide-react'

export interface TimeSlot {
  startTime: string
  endTime: string
}

export interface DayConfig {
  dayOfWeek: number
  isActive: boolean
  timeSlots: TimeSlot[]
}

const WEEK_DAYS = [
  { value: 0, label: 'Domingo', short: 'Dom' },
  { value: 1, label: 'Segunda', short: 'Seg' },
  { value: 2, label: 'Terça', short: 'Ter' },
  { value: 3, label: 'Quarta', short: 'Qua' },
  { value: 4, label: 'Quinta', short: 'Qui' },
  { value: 5, label: 'Sexta', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' }
]

interface CustomDayConfigProps {
  initialConfigs: DayConfig[]
  onChange: (configs: DayConfig[]) => void
}

/**
 * Editor único de "quais dias esta agenda atende e em que horário" — usado
 * dentro do formulário de criação/edição de agenda (controlado pelo pai, que
 * salva junto com o resto do form). Substitui as antigas telas separadas
 * "Dias de Atendimento" (só dias) + aba "Horários" (dias de novo + horário),
 * que deixavam workingDays e ScheduleDayConfig dessincronizados entre si.
 */
export function CustomDayConfig({ initialConfigs, onChange }: CustomDayConfigProps) {
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>(initialConfigs)

  useEffect(() => {
    setDayConfigs(initialConfigs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialConfigs)])

  useEffect(() => {
    onChange(dayConfigs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayConfigs])

  const handleToggleDay = (dayIndex: number, isActive: boolean) => {
    setDayConfigs(prev =>
      prev.map(config =>
        config.dayOfWeek === dayIndex
          ? { ...config, isActive }
          : config
      )
    )
  }

  const handleAddTimeSlot = (dayIndex: number) => {
    setDayConfigs(prev =>
      prev.map(config =>
        config.dayOfWeek === dayIndex
          ? {
              ...config,
              timeSlots: [
                ...config.timeSlots,
                { startTime: '08:00', endTime: '18:00' }
              ]
            }
          : config
      )
    )
  }

  const handleRemoveTimeSlot = (dayIndex: number, slotIndex: number) => {
    setDayConfigs(prev =>
      prev.map(config =>
        config.dayOfWeek === dayIndex
          ? {
              ...config,
              timeSlots: config.timeSlots.filter((_, i) => i !== slotIndex)
            }
          : config
      )
    )
  }

  const handleTimeSlotChange = (
    dayIndex: number,
    slotIndex: number,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    setDayConfigs(prev =>
      prev.map(config =>
        config.dayOfWeek === dayIndex
          ? {
              ...config,
              timeSlots: config.timeSlots.map((slot, i) =>
                i === slotIndex ? { ...slot, [field]: value } : slot
              )
            }
          : config
      )
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dias e Horários de Atendimento</CardTitle>
        <CardDescription>
          Escolha os dias da semana e os horários de atendimento em cada um
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {WEEK_DAYS.map((day) => {
          const config = dayConfigs.find(c => c.dayOfWeek === day.value)
          if (!config) return null

          return (
            <div key={day.value} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={config.isActive}
                    onCheckedChange={(checked) => handleToggleDay(day.value, checked)}
                  />
                  <Label className="text-base font-semibold">
                    {day.label}
                  </Label>
                </div>
                {config.isActive && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddTimeSlot(day.value)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Horário
                  </Button>
                )}
              </div>

              {config.isActive && (
                <div className="space-y-2 ml-11">
                  {config.timeSlots.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Nenhum horário configurado
                    </p>
                  ) : (
                    config.timeSlots.map((slot, slotIndex) => (
                      <div
                        key={slotIndex}
                        className="flex items-center gap-2 bg-gray-50 p-2 rounded"
                      >
                        <Clock className="h-4 w-4 text-gray-400" />
                        <Input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) =>
                            handleTimeSlotChange(
                              day.value,
                              slotIndex,
                              'startTime',
                              e.target.value
                            )
                          }
                          className="w-32"
                        />
                        <span className="text-gray-500">até</span>
                        <Input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) =>
                            handleTimeSlotChange(
                              day.value,
                              slotIndex,
                              'endTime',
                              e.target.value
                            )
                          }
                          className="w-32"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveTimeSlot(day.value, slotIndex)}
                          disabled={config.timeSlots.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
