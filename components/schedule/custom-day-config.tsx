
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface TimeSlot {
  startTime: string
  endTime: string
}

interface DayConfig {
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
  scheduleId?: string
  initialConfigs?: DayConfig[]
  initialEnabled?: boolean
  onSave?: (configs: DayConfig[], enabled: boolean) => Promise<void>
  onChange?: (configs: DayConfig[], enabled: boolean) => void
}

export function CustomDayConfig({ 
  scheduleId, 
  initialConfigs = [], 
  initialEnabled = false,
  onSave,
  onChange
}: CustomDayConfigProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>(() => {
    // Inicializar com todos os dias se não houver configuração
    if (initialConfigs.length === 0) {
      return WEEK_DAYS.map(day => ({
        dayOfWeek: day.value,
        isActive: [1, 2, 3, 4, 5].includes(day.value), // Segunda a Sexta ativas por padrão
        timeSlots: [{ startTime: '08:00', endTime: '18:00' }]
      }))
    }
    return initialConfigs
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (scheduleId) {
      fetchDayConfigs()
    }
  }, [scheduleId])

  useEffect(() => {
    if (onChange) {
      onChange(dayConfigs, enabled)
    }
  }, [dayConfigs, enabled])

  const fetchDayConfigs = async () => {
    if (!scheduleId) return
    
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/day-config`)
      if (!response.ok) throw new Error('Erro ao buscar configurações')
      
      const configs = await response.json()
      
      if (configs.length > 0) {
        setDayConfigs(configs)
        setEnabled(true)
      }
    } catch (error) {
      console.error('Error fetching day configs:', error)
    }
  }

  const handleToggleEnabled = (checked: boolean) => {
    setEnabled(checked)
  }

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

  const handleSave = async () => {
    if (!scheduleId) {
      toast.error('ID da agenda não fornecido')
      return
    }

    setLoading(true)
    try {
      // Validar horários
      for (const config of dayConfigs) {
        if (config.isActive && config.timeSlots.length === 0) {
          toast.error(`${WEEK_DAYS.find(d => d.value === config.dayOfWeek)?.label} está ativo mas não tem horários configurados`)
          setLoading(false)
          return
        }

        for (const slot of config.timeSlots) {
          if (slot.startTime >= slot.endTime) {
            toast.error('Horário de início deve ser anterior ao horário de término')
            setLoading(false)
            return
          }
        }
      }

      if (onSave) {
        await onSave(dayConfigs, enabled)
      } else {
        const response = await fetch(`/api/schedules/${scheduleId}/day-config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dayConfigs: enabled ? dayConfigs : [],
            useCustomDayConfig: enabled
          })
        })

        if (!response.ok) {
          throw new Error('Erro ao salvar configurações')
        }

        toast.success('Configurações salvas com sucesso!')
      }
    } catch (error) {
      console.error('Error saving day configs:', error)
      toast.error('Erro ao salvar configurações')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Horários Personalizados por Dia</CardTitle>
            <CardDescription>
              Configure horários diferentes para cada dia da semana
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="enable-custom">Ativar</Label>
            <Switch
              id="enable-custom"
              checked={enabled}
              onCheckedChange={handleToggleEnabled}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!enabled ? (
          <p className="text-sm text-gray-500 text-center py-4">
            Ative esta opção para configurar horários diferentes para cada dia da semana
          </p>
        ) : (
          <>
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

            {scheduleId && (
              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
