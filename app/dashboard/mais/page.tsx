'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar,
  Briefcase,
  UserCog,
  Package,
  Gift,
  MessageSquare,
  Settings,
  User,
  CreditCard,
  LogOut,
  ChevronRight,
  Sliders,
  Star,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PLAN_CONFIGS } from '@/lib/types'
import { useUserPermissions } from '@/hooks/use-user-permissions'

const menuGroups = [
  {
    label: 'Gestão',
    items: [
      { name: 'Agendas', href: '/dashboard/schedules', icon: Calendar, permission: 'canManageSchedules' as const },
      { name: 'Serviços', href: '/dashboard/services', icon: Briefcase, permission: 'canManageServices' as const },
      { name: 'Profissionais', href: '/dashboard/professionals', icon: UserCog, permission: 'canManageProfessionals' as const },
      { name: 'Pacotes', href: '/dashboard/packages', icon: Package, permission: 'canManageServices' as const },
      { name: 'Fidelidade', href: '/dashboard/loyalty', icon: Gift, permission: 'canManageServices' as const },
    ],
  },
  {
    label: 'Comunicação',
    items: [
      { name: 'WhatsApp / Notificações', href: '/dashboard/canais-atendimento', icon: MessageSquare, permission: 'canViewNotifications' as const },
    ],
  },
  {
    label: 'Conta',
    items: [
      { name: 'Perfil', href: '/dashboard/profile', icon: User },
      { name: 'Configurações', href: '/dashboard/settings', icon: Settings },
      { name: 'Segmento', href: '/dashboard/segment-settings', icon: Sliders },
      { name: 'Planos', href: '/dashboard/plans', icon: CreditCard },
    ],
  },
]

function MenuItem({ name, href, icon: Icon }: { name: string; href: string; icon: React.ElementType }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition-colors active:bg-muted"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-medium">{name}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  )
}

export default function MaisPage() {
  const { data: session } = useSession()
  const permissions = useUserPermissions()
  const userPlan = (session?.user as any)?.planType || 'FREEMIUM'
  const planConfig = PLAN_CONFIGS[userPlan as keyof typeof PLAN_CONFIGS]

  const getInitials = (name?: string | null) => {
    if (!name) return 'U'
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="min-h-full pb-4">
      {/* User card */}
      <div className="flex items-center gap-3 px-4 py-5">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {getInitials(session?.user?.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{session?.user?.name}</p>
          <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs flex-shrink-0">
          {planConfig?.name}
        </Badge>
      </div>

      <Separator />

      {/* Menu groups */}
      {menuGroups.map((group) => {
        const visibleItems = group.items.filter(item =>
          !item.permission || permissions[item.permission]
        )
        if (visibleItems.length === 0) return null
        return (
          <div key={group.label} className="mt-4">
            <p className="px-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {group.label}
            </p>
            <div className="bg-card rounded-xl mx-3 overflow-hidden border border-border">
              {visibleItems.map((item, idx) => (
                <div key={item.href}>
                  <MenuItem name={item.name} href={item.href} icon={item.icon} />
                  {idx < visibleItems.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Logout */}
      <div className="mt-4 mx-3">
        <div className="bg-card rounded-xl overflow-hidden border border-border">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition-colors active:bg-muted text-destructive"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <LogOut className="h-4 w-4 text-destructive" />
              </div>
              <span className="text-sm font-medium">Sair</span>
            </div>
            <ChevronRight className="h-4 w-4 text-destructive/50" />
          </button>
        </div>
      </div>
    </div>
  )
}
