
'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Bell, LogOut, Settings, User, Menu } from 'lucide-react'
import { PLAN_CONFIGS } from '@/lib/types'
import { ThemeToggle } from '@/components/theme-toggle'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { useState } from 'react'

interface DashboardHeaderProps {
  sessionData?: {
    user: {
      name?: string | null
      email?: string | null
      planType?: string
      businessName?: string | null
      segmentType?: string
    }
  }
}

export function DashboardHeader({ sessionData }: DashboardHeaderProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const userPlan = sessionData?.user?.planType || 'FREEMIUM'
  const planConfig = PLAN_CONFIGS[userPlan as keyof typeof PLAN_CONFIGS]
  
  const getInitials = (name?: string | null) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  const handleProfileClick = () => {
    setMenuOpen(false)
    router.push('/dashboard/profile')
  }

  const handleSettingsClick = () => {
    setMenuOpen(false)
    router.push('/dashboard/settings')
  }

  return (
    <header className="sticky top-0 z-30 bg-card shadow-sm border-b border-border">
      <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        {/* Left - Business Name & Plan */}
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1 lg:pl-0 pl-12">
          <h1 className="text-base sm:text-lg md:text-2xl font-semibold text-foreground truncate">
            {sessionData?.user?.businessName || 'Dashboard'}
          </h1>
          <Badge variant="outline" className="hidden sm:inline-flex bg-primary/10 text-primary border-primary/20 text-xs">
            {planConfig?.name}
          </Badge>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4 flex-shrink-0">
          {/* Theme Toggle - Hidden on mobile */}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          
          {/* Notifications */}
          <NotificationBell />

          {/* User Menu */}
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger 
              className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full inline-flex items-center justify-center hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary border-0 bg-transparent cursor-pointer"
              aria-label="Menu do usuário"
              title="Abrir menu do usuário"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Avatar className="h-8 w-8 sm:h-9 sm:w-9 pointer-events-none">
                <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">
                  {getInitials(sessionData?.user?.name)}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <div className="flex flex-col space-y-1 p-2">
                <p className="text-sm font-medium truncate text-foreground">{sessionData?.user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {sessionData?.user?.email}
                </p>
                {/* Show plan on mobile in menu */}
                <Badge variant="outline" className="sm:hidden w-fit bg-primary/10 text-primary border-primary/20 text-xs mt-1">
                  {planConfig?.name}
                </Badge>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleProfileClick} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSettingsClick} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              {/* Theme toggle in menu for mobile */}
              <div className="sm:hidden px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Tema</span>
                  <ThemeToggle />
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
