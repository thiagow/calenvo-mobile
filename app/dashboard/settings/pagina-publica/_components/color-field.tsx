'use client'

import { useEffect, useId, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isValidHex } from '@/lib/booking-theme'

interface ColorFieldProps {
  label: string
  hint?: string
  /** Cor efetiva exibida (override ou padrão do template). */
  value: string
  /** True quando o dono sobrescreveu a cor do template. */
  customized: boolean
  onChange: (hex: string) => void
  onReset: () => void
}

export function ColorField({ label, hint, value, customized, onChange, onReset }: ColorFieldProps) {
  const id = useId()
  const [text, setText] = useState(value)

  // Mantém o campo de texto em sincronia com o seletor e com resets externos.
  useEffect(() => setText(value), [value])

  const handleText = (next: string) => {
    const normalized = next.startsWith('#') ? next : `#${next}`
    setText(normalized)
    if (isValidHex(normalized)) onChange(normalized.toUpperCase())
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {customized && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Restaurar padrão
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label}: seletor de cor`}
          value={value.toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
        />
        <Input
          id={id}
          value={text}
          maxLength={7}
          spellCheck={false}
          autoCapitalize="characters"
          onChange={(e) => handleText(e.target.value)}
          onBlur={() => setText(value)}
          className="font-mono text-sm uppercase"
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
