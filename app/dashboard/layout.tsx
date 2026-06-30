import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { DashboardLayoutClient } from '@/components/dashboard/dashboard-layout-client'

export const dynamic = 'force-dynamic'
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const sessionData = {
    user: {
      name: session.user?.name,
      email: session.user?.email,
      planType: (session.user as any)?.planType || 'FREEMIUM',
      clinicName: (session.user as any)?.clinicName
    }
  }

  return (
    <DashboardLayoutClient sessionData={sessionData}>
      {children}
    </DashboardLayoutClient>
  )
}
