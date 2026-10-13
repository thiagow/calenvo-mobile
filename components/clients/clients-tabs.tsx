'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useReactivationSummary } from '@/hooks/use-reactivation-summary'

/** Alternância "Todos | Retorno" no topo da área de Clientes. */
export function ClientsTabs() {
  const pathname = usePathname()
  const { counts } = useReactivationSummary()
  const pending = counts ? counts.overdue + counts.upcoming : 0

  const tabs = [
    { href: '/dashboard/clients', label: 'Todos', active: pathname === '/dashboard/clients' },
    { href: '/dashboard/clients/retorno', label: 'Retorno', active: pathname?.startsWith('/dashboard/clients/retorno'), badge: pending },
  ]

  return (
    <nav className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" aria-label="Seções de clientes">
      {tabs.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? 'page' : undefined}
          className={cn(
            'flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors',
            tab.active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
          {!!tab.badge && (
            <span className="min-w-5 rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold leading-5 text-white tabular-nums">
              {tab.badge > 99 ? '99+' : tab.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  )
}
