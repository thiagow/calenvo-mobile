'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { PLAN_CONFIGS } from '@/lib/types'

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
  const userPlan = sessionData?.user?.planType || 'FREEMIUM'
  const planConfig = PLAN_CONFIGS[userPlan as keyof typeof PLAN_CONFIGS]

  const getInitials = (name?: string | null) => {
    if (!name) return 'U'
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center justify-between px-4 h-14">
        {/* Logo + nome do negócio */}
        <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
          <div className="relative h-7 w-7 flex-shrink-0">
            <Image src="/calenvo-logo.png" alt="Calenvo" fill className="object-contain" />
          </div>
          <span className="font-semibold text-sm truncate max-w-[140px]">
            {sessionData?.user?.businessName || 'Calenvo'}
          </span>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 hidden sm:inline-flex flex-shrink-0">
            {planConfig?.name}
          </Badge>
        </Link>

        {/* Ações */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <NotificationBell />
          <Link href="/dashboard/mais">
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {getInitials(sessionData?.user?.name)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  )
}
