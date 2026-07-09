import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { DashboardLayoutClient } from '@/components/dashboard/dashboard-layout-client'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const SUSPENDED_STATUSES = ['canceled', 'unpaid', 'past_due']

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const userId = (session.user as any)?.id
  const role = (session.user as any)?.role

  // SAAS_ADMIN não tem assinatura própria — nunca é bloqueado por este gate.
  if (role !== 'SAAS_ADMIN' && userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true, isPaymentExempt: true }
    })

    if (user && !user.isPaymentExempt && user.subscriptionStatus && SUSPENDED_STATUSES.includes(user.subscriptionStatus)) {
      redirect('/account/suspended')
    }
  }

  const sessionData = {
    user: {
      name: session.user?.name,
      email: session.user?.email,
      planType: (session.user as any)?.planType || 'BASICO',
      businessName: (session.user as any)?.businessName
    }
  }

  return (
    <DashboardLayoutClient sessionData={sessionData}>
      {children}
    </DashboardLayoutClient>
  )
}
