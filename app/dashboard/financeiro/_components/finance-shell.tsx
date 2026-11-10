'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useFeatures, type FeaturesState } from '@/hooks/use-features'
import { cn } from '@/lib/utils'

type Access = 'master' | 'cash' | 'any'

const LINKS: { href: string; label: string; access: Access }[] = [
  { href: '/dashboard/financeiro', label: 'Visão geral', access: 'master' },
  { href: '/dashboard/financeiro/caixa', label: 'Caixa', access: 'cash' },
  { href: '/dashboard/financeiro/receber', label: 'A receber', access: 'cash' },
  { href: '/dashboard/financeiro/pagar', label: 'A pagar', access: 'master' },
  { href: '/dashboard/financeiro/comissoes', label: 'Comissões', access: 'master' },
  { href: '/dashboard/financeiro/relatorios', label: 'Relatórios', access: 'master' },
  { href: '/dashboard/financeiro/configuracoes', label: 'Ajustes', access: 'master' }
]

function allowed(access: Access, finance: FeaturesState['finance']) {
  if (access === 'master') return finance.isMaster
  if (access === 'cash') return finance.canOperateCash
  return true
}

interface FinanceShellProps {
  title: string
  description?: string
  access: Access
  actions?: React.ReactNode
  children: (finance: FeaturesState['finance']) => React.ReactNode
}

/**
 * Casca das telas do Financeiro: navegação do módulo, título e verificação de
 * acesso (só para a UI — cada rota da API revalida no servidor).
 */
export function FinanceShell({ title, description, access, actions, children }: FinanceShellProps) {
  const pathname = usePathname()
  const { features, isLoading } = useFeatures()
  const finance = features?.finance

  if (isLoading || !finance) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-full rounded-full" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  if (!finance.active || !allowed(access, finance)) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Lock className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {!finance.active ? 'O Financeiro não está ativo nesta conta.' : 'Você não tem acesso a esta área do Financeiro.'}
        </p>
        <Link href="/dashboard" className="text-sm font-medium text-primary">
          Voltar ao início
        </Link>
      </div>
    )
  }

  const links = LINKS.filter((l) => allowed(l.access, finance))

  return (
    <div className="space-y-5 pb-6">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Financeiro</p>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-shrink-0 items-center gap-2 pt-5">{actions}</div>}
        </div>
        {links.length > 1 && (
          <nav aria-label="Financeiro">
            <ul className="flex flex-wrap gap-1.5">
              {links.map((link) => {
                const active = link.href === '/dashboard/financeiro' ? pathname === link.href : pathname?.startsWith(link.href)
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'inline-flex h-8 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                        active
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}
      </header>
      {children(finance)}
    </div>
  )
}

/** Escuta mudanças feitas pela folha "Fechar comanda" (ou outra tela) para recarregar. */
export { FINANCE_CHANGED_EVENT } from '@/components/finance/close-sale-sheet'
