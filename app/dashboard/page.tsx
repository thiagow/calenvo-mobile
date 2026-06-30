
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { DashboardOverview } from '@/components/dashboard/dashboard-overview'

export default async function DashboardPage() {
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

  return <DashboardOverview sessionData={sessionData} />
}
