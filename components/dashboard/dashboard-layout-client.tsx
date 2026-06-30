
'use client'

import { SessionProvider } from 'next-auth/react'
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { SegmentProvider } from '@/contexts/segment-context'

interface DashboardLayoutClientProps {
  children: React.ReactNode
  sessionData: {
    user: {
      name?: string | null
      email?: string | null
      planType?: string
      clinicName?: string | null
    }
  }
}

export function DashboardLayoutClient({ children, sessionData }: DashboardLayoutClientProps) {
  return (
    <SessionProvider>
      <SegmentProvider>
        <div className="min-h-screen bg-background">
          <DashboardSidebar />
          <div className="lg:pl-64">
            <DashboardHeader sessionData={sessionData} />
            <main className="p-3 sm:p-4 md:p-6 pb-20 lg:pb-6">
              {children}
            </main>
          </div>
        </div>
      </SegmentProvider>
    </SessionProvider>
  )
}
