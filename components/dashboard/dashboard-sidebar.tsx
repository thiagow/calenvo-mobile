
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  Users,
  Settings,
  BarChart3, // This icon is no longer used in the navigation array, but keeping it as the instruction didn't explicitly remove it from the import list.
  CreditCard,
  Menu,
  X,
  Home,
  Briefcase,
  CalendarCheck,
  UserCog,
  Package,
  MessageSquare,
  Gift
} from 'lucide-react'
import { useUserPermissions } from '@/hooks/use-user-permissions'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home, permission: 'canViewOwnAppointments' },
  { name: 'Agendamentos', href: '/dashboard/agenda', icon: CalendarCheck, permission: 'canViewOwnAppointments' },
  { name: 'Agendas', href: '/dashboard/schedules', icon: Calendar, permission: 'canManageSchedules' },
  { name: 'Serviços', href: '/dashboard/services', icon: Briefcase, permission: 'canManageServices' },
  { name: 'Profissionais', href: '/dashboard/professionals', icon: UserCog, permission: 'canManageProfessionals' },
  { name: 'Clientes', href: '/dashboard/patients', icon: Users, permission: 'canViewAllClients' },
  { name: 'Canais de Atendimento', href: '/dashboard/canais-atendimento', icon: MessageSquare, permission: 'canViewNotifications' },
  { name: 'Relatórios', href: '/dashboard/reports', icon: BarChart3, permission: 'canViewFullReports' },
  { name: 'Pacotes', href: '/dashboard/packages', icon: Package, permission: 'canManageServices' },
  { name: 'Fidelidade', href: '/dashboard/loyalty', icon: Gift, permission: 'canManageServices' },
  { name: 'Configurações', href: '/dashboard/settings', icon: Settings, permission: 'canViewPublicUrl' },
]

export function DashboardSidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const permissions = useUserPermissions()

  // Filtrar navegação baseado nas permissões
  const filteredNavigation = useMemo(() => {
    return navigation.filter(item => {
      const permissionKey = item.permission as keyof typeof permissions
      return permissions[permissionKey]
    })
  }, [permissions])

  return (
    <>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile menu button */}
      <div className="lg:hidden">
        <Button
          variant="ghost"
          size="sm"
          className="fixed top-4 left-4 z-50"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Sidebar */}
      <div className={cn(
        'fixed top-0 left-0 z-40 h-screen w-64 transform bg-card shadow-lg transition-transform duration-200 ease-in-out lg:translate-x-0 border-r border-border',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-center border-b border-border">
            <Link href="/dashboard" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <div className="relative h-10 w-10">
                <Image
                  src="/calenvo-logo.png"
                  alt="Calenvo"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-xl calenvo-gradient">Calenvo</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Bottom section */}
          <div className="border-t border-border p-4">
            <div className="rounded-lg bg-primary/5 p-3 border border-primary/10">
              <h3 className="text-sm font-medium text-foreground">
                Precisa de ajuda?
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Entre em contato com nosso suporte
              </p>
              <Button
                size="sm"
                className="mt-2 w-full bg-primary hover:bg-primary/90"
                onClick={() => {
                  window.open('mailto:suporte@calenvo.com.br?subject=Preciso de Ajuda - Calenvo', '_blank')
                }}
              >
                Falar com Suporte
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
