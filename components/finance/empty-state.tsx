import type { LucideIcon } from 'lucide-react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  /** Próxima ação sugerida (ex.: "Nova venda"). */
  action?: React.ReactNode
  className?: string
}

/** Estado vazio com ícone, explicação e próxima ação — nunca só uma frase solta. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-10 text-center', className)}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mx-auto max-w-xs text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/** Falha de carregamento com nova tentativa (no lugar do skeleton infinito). */
export function ErrorState({
  message = 'Não foi possível carregar.',
  onRetry,
  className
}: {
  message?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 px-6 py-10 text-center', className)}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-money-negative/10 text-money-negative">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" className="min-h-11" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  )
}
