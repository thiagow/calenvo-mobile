'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RotateCcw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSegmentConfig } from '@/contexts/segment-context'
import { cn } from '@/lib/utils'

const PRESETS: { label: string; days: number }[] = [
  { label: '1 semana', days: 7 },
  { label: '15 dias', days: 15 },
  { label: '1 mês', days: 30 },
  { label: '2 meses', days: 60 },
  { label: '3 meses', days: 90 },
  { label: '6 meses', days: 180 },
  { label: '1 ano', days: 365 },
]

const MAX_DAYS = 730
const DEFAULT_TEMPLATE = '__default__'

export interface ReturnIntervalValue {
  returnIntervalDays: number | null
  reactivationTemplateId: string | null
}

interface TemplateOption {
  id: string
  name: string
  isDefault: boolean
}

interface ReturnIntervalFieldProps {
  value: ReturnIntervalValue
  onChange: (value: ReturnIntervalValue) => void
}

/**
 * Prazo médio de retorno do serviço (alimenta a tela de Retorno) e o modelo
 * de mensagem sugerido para o lembrete. "Sem retorno" é o padrão.
 */
export function ReturnIntervalField({ value, onChange }: ReturnIntervalFieldProps) {
  const { config } = useSegmentConfig()
  const t = config.terminology
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const days = value.returnIntervalDays
  const isPreset = days !== null && PRESETS.some(p => p.days === days)
  const [customMode, setCustomMode] = useState(days !== null && !isPreset)

  useEffect(() => {
    if (days !== null && !PRESETS.some(p => p.days === days)) setCustomMode(true)
  }, [days])

  useEffect(() => {
    fetch('/api/message-templates')
      .then(r => (r.ok ? r.json() : null))
      .then(data => data && setTemplates(data.templates))
      .catch(() => {})
  }, [])

  const setDays = (next: number | null) => onChange({ ...value, returnIntervalDays: next })

  const chip = (active: boolean) =>
    cn(
      'h-9 rounded-full border px-3.5 text-sm font-medium transition-colors',
      active
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border bg-background text-foreground hover:bg-muted'
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-primary" />
          Retorno médio
        </CardTitle>
        <CardDescription>
          Em quanto tempo {t.clients.toLowerCase()} costumam voltar para este {t.service.toLowerCase()}. Usado para avisar
          quem está perto de voltar ou já passou do prazo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Retorno médio">
          <button
            type="button"
            role="radio"
            aria-checked={days === null}
            className={chip(days === null && !customMode)}
            onClick={() => {
              setCustomMode(false)
              setDays(null)
            }}
          >
            Sem retorno
          </button>
          {PRESETS.map(p => (
            <button
              key={p.days}
              type="button"
              role="radio"
              aria-checked={days === p.days && !customMode}
              className={chip(days === p.days && !customMode)}
              onClick={() => {
                setCustomMode(false)
                setDays(p.days)
              }}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={customMode}
            className={chip(customMode)}
            onClick={() => {
              setCustomMode(true)
              if (days === null) setDays(30)
            }}
          >
            Personalizado
          </button>
        </div>

        {customMode && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_DAYS}
              className="w-28"
              value={days ?? ''}
              onChange={e => {
                const n = parseInt(e.target.value, 10)
                setDays(Number.isNaN(n) ? null : Math.min(MAX_DAYS, Math.max(1, n)))
              }}
              aria-label="Dias até o retorno"
            />
            <span className="text-sm text-muted-foreground">dias (até {MAX_DAYS})</span>
          </div>
        )}

        {days !== null && (
          <div className="space-y-1.5">
            <Label>Mensagem de retorno</Label>
            <Select
              value={value.reactivationTemplateId ?? DEFAULT_TEMPLATE}
              onValueChange={v => onChange({ ...value, reactivationTemplateId: v === DEFAULT_TEMPLATE ? null : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_TEMPLATE}>Usar o modelo padrão</SelectItem>
                {templates.map(tpl => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name}
                    {tpl.isDefault ? ' (padrão)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Crie e edite modelos em{' '}
              <Link href="/dashboard/canais-atendimento#modelos" className="text-primary underline-offset-2 hover:underline">
                Canais de atendimento
              </Link>
              .
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
