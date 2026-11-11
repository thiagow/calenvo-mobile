import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  /** O número (use `<Money />`). */
  children: React.ReactNode
  /** Linha de apoio sob o número. */
  hint?: React.ReactNode
  /** `hero` = destaque da tela (número grande); `tile` = métrica secundária. */
  variant?: 'hero' | 'tile'
  className?: string
}

/** Cartão de métrica: substitui os heros duplicados com blur blob. */
export function StatCard({ label, children, hint, variant = 'tile', className }: StatCardProps) {
  const hero = variant === 'hero'
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border bg-card', hero ? 'p-5' : 'p-4', className)}>
      {hero && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl"
        />
      )}
      <p className="relative text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('relative mt-1 font-semibold tracking-tight tabular-nums', hero ? 'text-4xl' : 'text-xl')}>
        {children}
      </p>
      {hint && <div className="relative mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}
