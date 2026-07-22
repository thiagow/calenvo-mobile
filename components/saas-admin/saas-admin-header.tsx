
'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogoIcon } from '@/components/brand/logo'

interface SaasAdminHeaderProps {
  sessionData?: {
    user: {
      name?: string | null
      email?: string | null
    }
  }
}

export function SaasAdminHeader({ sessionData }: SaasAdminHeaderProps) {
  const getInitials = (name?: string | null) => {
    if (!name) return 'A'
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center justify-between px-4 h-14">
        <Link href="/saas-admin" className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0">
            <LogoIcon size={28} gradientId="saas-admin-header-logo" />
          </div>
          <span className="font-semibold text-sm truncate">Calenvo SaaS Admin</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex-shrink-0">
              <Avatar className="h-8 w-8 cursor-pointer">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {getInitials(sessionData?.user?.name)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5 text-sm">
              <p className="font-medium truncate">{sessionData?.user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{sessionData?.user?.email}</p>
            </div>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
