'use client'

import { SessionProvider } from 'next-auth/react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { BottomNav } from '@/components/layout/bottom-nav'
import { SegmentProvider } from '@/contexts/segment-context'

interface DashboardLayoutClientProps {
  children: React.ReactNode
  sessionData: {
    user: {
      name?: string | null
      email?: string | null
      planType?: string
      businessName?: string | null
    }
  }
}

export function DashboardLayoutClient({ children, sessionData }: DashboardLayoutClientProps) {
  return (
    <SessionProvider>
      <SegmentProvider>
        <div className="min-h-screen bg-background flex flex-col">
          <DashboardHeader sessionData={sessionData} />
          <main className="flex-1 overflow-y-auto px-3 py-4 pb-24">
            {children}
          </main>
          <BottomNav />
        </div>
      </SegmentProvider>
    </SessionProvider>
  )
}
