'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StepDefinition {
  key: string
  label: string
}

interface BookingStepperProps {
  steps: StepDefinition[]
  currentIndex: number
}

export function BookingStepper({ steps, currentIndex }: BookingStepperProps) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {steps.map((step, index) => {
        const isDone = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  isDone && 'bg-primary text-primary-foreground',
                  isCurrent && 'bg-primary/10 text-primary ring-2 ring-primary',
                  !isDone && !isCurrent && 'bg-muted text-muted-foreground'
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  'hidden text-[11px] font-medium sm:block',
                  (isDone || isCurrent) ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'mx-1 h-0.5 flex-1 rounded-full transition-colors sm:mx-2',
                  isDone ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
