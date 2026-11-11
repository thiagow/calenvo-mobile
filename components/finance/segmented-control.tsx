'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'

interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Texto de apoio (aparece sob o rótulo em `variant="cards"`). */
  description?: string
}

interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  'aria-label': string
  disabled?: boolean
  /** `pills`: trilho compacto. `cards`: opções com descrição. */
  variant?: 'pills' | 'cards'
  className?: string
}

/**
 * Escolha única acessível (role=radiogroup): roving tabindex, setas/Home/End e
 * alvo de toque de 44px. Substitui os controles segmentados artesanais.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  variant = 'pills',
  disabled = false,
  className,
  'aria-label': ariaLabel
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const last = options.length - 1
    let next = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    else return
    event.preventDefault()
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        variant === 'pills' ? 'grid gap-1 rounded-xl bg-muted p-1' : 'grid gap-2',
        className
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => !selected && onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              'min-h-11 text-center text-sm font-medium transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              variant === 'pills'
                ? cn(
                    'rounded-lg px-2',
                    selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )
                : cn(
                    'rounded-xl border px-3 py-2.5 text-left',
                    selected ? 'border-foreground bg-foreground/5' : 'border-border hover:border-foreground/30'
                  )
            )}
          >
            <span className="block">{option.label}</span>
            {variant === 'cards' && option.description && (
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{option.description}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
