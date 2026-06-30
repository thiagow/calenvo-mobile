
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Clock, Save, Loader2, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface BusinessConfig {
  workingDays: number[]
  startTime: string
  endTime: string
  defaultDuration: number
  lunchStart: string | null
  lunchEnd: string | null
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo', short: 'Dom' },
  { value: 1, label: 'Segunda-feira', short: 'Seg' },
  { value: 2, label: 'Terça-feira', short: 'Ter' },
  { value: 3, label: 'Quarta-feira', short: 'Qua' },
  { value: 4, label: 'Quinta-feira', short: 'Qui' },
  { value: 5, label: 'Sexta-feira', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' }
]

export function BusinessHoursEditor() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<BusinessConfig>({
    workingDays: [1, 2, 3, 4, 5], // Segunda a Sexta
    startTime: '08:00',
    endTime: '18:00',
    defaultDuration: 30,
    lunchStart: '12:00',
    lunchEnd: '13:00'
  })
  const [hasLunchBreak, setHasLunchBreak] = useState(true)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/business-config')
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
        setHasLunchBreak(!!data.lunchStart && !!data.lunchEnd)
      }
    } catch (error) {
      console.error('Error fetching config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const dataToSave = {
        ...config,
        lunchStart: hasLunchBreak ? config.lunchStart : null,
        lunchEnd: hasLunchBreak ? config.lunchEnd : null
      }

      const response = await fetch('/api/settings/business-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      })

      if (response.ok) {
        toast.success('Configurações salvas com sucesso!')
      } else {
        throw new Error('Erro ao salvar')
      }
    } catch (error) {
      console.error('Error saving config:', error)
      toast.error('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  const toggleWorkingDay = (day: number) => {
    setConfig(prev => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter(d => d !== day)
        : [...prev.workingDays, day].sort()
    }))
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Clock className="mr-2 h-5 w-5 text-blue-600" />
          Horário de Funcionamento
        </CardTitle>
        <CardDescription>
          Configure os horários de atendimento do seu negócio
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Working Days */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Dias de Funcionamento</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleWorkingDay(day.value)}
                className={`
                  px-4 py-2 rounded-lg border-2 transition-all font-medium text-sm
                  ${config.workingDays.includes(day.value)
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                  }
                `}
              >
                <div className="flex items-center space-x-1">
                  <span>{day.short}</span>
                  {config.workingDays.includes(day.value) && (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600">
            {config.workingDays.length === 0
              ? 'Selecione pelo menos um dia de funcionamento'
              : `${config.workingDays.length} dia${config.workingDays.length !== 1 ? 's' : ''} selecionado${config.workingDays.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>

        {/* Opening Hours */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startTime">Horário de Abertura</Label>
            <Input
              id="startTime"
              type="time"
              value={config.startTime}
              onChange={(e) => setConfig({ ...config, startTime: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endTime">Horário de Fechamento</Label>
            <Input
              id="endTime"
              type="time"
              value={config.endTime}
              onChange={(e) => setConfig({ ...config, endTime: e.target.value })}
            />
          </div>
        </div>

        {/* Lunch Break */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="lunchBreak" className="text-base font-medium">
                Horário de Almoço
              </Label>
              <p className="text-xs text-gray-600">
                Período em que não haverá atendimento
              </p>
            </div>
            <Switch
              id="lunchBreak"
              checked={hasLunchBreak}
              onCheckedChange={setHasLunchBreak}
            />
          </div>

          {hasLunchBreak && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="lunchStart">Início do Intervalo</Label>
                <Input
                  id="lunchStart"
                  type="time"
                  value={config.lunchStart || '12:00'}
                  onChange={(e) => setConfig({ ...config, lunchStart: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lunchEnd">Fim do Intervalo</Label>
                <Input
                  id="lunchEnd"
                  type="time"
                  value={config.lunchEnd || '13:00'}
                  onChange={(e) => setConfig({ ...config, lunchEnd: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        {/* Default Duration */}
        <div className="space-y-2">
          <Label htmlFor="defaultDuration">Duração Padrão das Consultas (minutos)</Label>
          <Input
            id="defaultDuration"
            type="number"
            min="15"
            step="15"
            value={config.defaultDuration}
            onChange={(e) => setConfig({ ...config, defaultDuration: Number(e.target.value) })}
          />
          <p className="text-xs text-gray-600">
            Tempo padrão para cada agendamento
          </p>
        </div>

        {/* Summary */}
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2 text-sm">Resumo</h4>
          <div className="space-y-1 text-xs text-blue-700">
            <p>
              <strong>Funcionamento:</strong>{' '}
              {config.workingDays
                .map(d => DAYS_OF_WEEK.find(day => day.value === d)?.short)
                .join(', ')}
            </p>
            <p>
              <strong>Horário:</strong> {config.startTime} - {config.endTime}
            </p>
            {hasLunchBreak && config.lunchStart && config.lunchEnd && (
              <p>
                <strong>Intervalo:</strong> {config.lunchStart} - {config.lunchEnd}
              </p>
            )}
            <p>
              <strong>Duração padrão:</strong> {config.defaultDuration} minutos
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || config.workingDays.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
