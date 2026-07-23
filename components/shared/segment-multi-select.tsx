
'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { AVAILABLE_SEGMENTS } from '@/lib/types'

interface SegmentMultiSelectProps {
  value: string[]
  onChange: (value: string[]) => void
  /** Permite customizar o texto exibido por segmento (ex.: tradução i18n). Padrão: label em pt-BR de AVAILABLE_SEGMENTS. */
  getLabel?: (segmentValue: string, defaultLabel: string) => string
  className?: string
}

export function SegmentMultiSelect({ value, onChange, getLabel, className }: SegmentMultiSelectProps) {
  const toggle = (segmentValue: string, checked: boolean) => {
    if (checked) {
      onChange([...value, segmentValue])
    } else {
      onChange(value.filter((v) => v !== segmentValue))
    }
  }

  return (
    <div className={className ?? 'space-y-2 rounded-md border border-input p-3'}>
      {AVAILABLE_SEGMENTS.map((segment) => (
        <label
          key={segment.value}
          className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 hover:bg-muted/50"
        >
          <Checkbox
            checked={value.includes(segment.value)}
            onCheckedChange={(checked) => toggle(segment.value, checked === true)}
          />
          <span className="text-sm">
            {segment.icon} {getLabel ? getLabel(segment.value, segment.label) : segment.label}
          </span>
        </label>
      ))}
    </div>
  )
}
