'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  CalendarCheck,
  Calendar,
  Users,
  BarChart2,
  MoreHorizontal,
} from 'lucide-react'
import { useUserPermissions } from '@/hooks/use-user-permissions'

const mainNav = [
  { name: 'Hoje', href: '/dashboard', icon: CalendarCheck, exact: true },
  { name: 'Agenda', href: '/dashboard/agenda', icon: Calendar },
  { name: 'Clientes', href: '/dashboard/patients', icon: Users },
  { name: 'Relatórios', href: '/dashboard/reports', icon: BarChart2, permission: 'canViewFullReports' as const },
  { name: 'Mais', href: '/dashboard/mais', icon: MoreHorizontal },
]

export function BottomNav() {
  const pathname = usePathname()
  const permissions = useUserPermissions()

  const visibleNav = mainNav.filter(item =>
    !item.permission || permissions[item.permission]
  )

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around h-16">
        {visibleNav.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(item.href + '/')

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-0 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span className="text-[10px] font-medium truncate">{item.name}</span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
