'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BOOKING_TEMPLATES, TEMPLATES, resolveTheme, type BookingTemplateId } from '@/lib/booking-theme'

interface TemplatePickerProps {
  value: BookingTemplateId
  onChange: (template: BookingTemplateId) => void
}

export function TemplatePicker({ value, onChange }: TemplatePickerProps) {
  return (
    <div role="radiogroup" aria-label="Template" className="grid grid-cols-2 gap-3">
      {BOOKING_TEMPLATES.map((id) => {
        const def = TEMPLATES[id]
        const { colors } = resolveTheme({ template: id })
        const selected = id === value

        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={cn(
              'group relative rounded-xl border p-2 text-left transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-foreground/30'
            )}
          >
            {/* Miniatura: fundo, título, dois cards e destaque do próprio template. */}
            <div
              className="space-y-1.5 rounded-lg p-2.5"
              style={{ background: colors.background }}
              aria-hidden
            >
              <div className="mx-auto h-4 w-4 rounded-full" style={{ background: colors.primary, opacity: 0.85 }} />
              <div className="mx-auto h-1.5 w-12 rounded-full" style={{ background: colors.foreground }} />
              <div className="h-4 rounded-md" style={{ background: colors.entryCard, border: `1px solid ${colors.border}` }} />
              <div className="h-4 rounded-md" style={{ background: colors.entryCard, border: `1px solid ${colors.border}` }} />
            </div>

            <div className="px-1 pb-0.5 pt-2">
              <p className="text-sm font-medium leading-tight">{def.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{def.description}</p>
            </div>

            {selected && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
