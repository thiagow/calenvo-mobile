import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import Link from 'next/link'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/brand/logo'
import { PLAN_CONFIGS } from '@/lib/types'
import { ReactivateButton } from '@/components/account/reactivate-button'
import { AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AccountSuspendedPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as any).id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planType: true, subscriptionStatus: true, isPaymentExempt: true }
  })

  // Se a conta não estiver mais suspensa, manda de volta pro dashboard.
  if (!user || user.isPaymentExempt || !user.subscriptionStatus || !['canceled', 'unpaid', 'past_due'].includes(user.subscriptionStatus)) {
    redirect('/dashboard')
  }

  const planName = PLAN_CONFIGS[user.planType]?.name || user.planType

  return (
    <div className="min-h-screen bg-[#FAFAFF] flex flex-col">
      <header className="border-b border-gray-200 bg-[#FAFAFF]">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <Logo />
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full">
          <Card className="border-2 border-yellow-200">
            <CardHeader className="text-center pb-6">
              <div className="mx-auto mb-6 w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-12 w-12 text-yellow-600" />
              </div>
              <CardTitle className="text-2xl mb-2">Assinatura suspensa</CardTitle>
              <CardDescription className="text-base">
                Sua assinatura do Plano {planName} está com um problema de pagamento. Atualize seu método de pagamento para continuar usando o Calenvo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ReactivateButton />
              <p className="text-xs text-center text-gray-500">
                Precisa de ajuda?{' '}
                <a href="mailto:contato@calenvo.com.br" className="text-[#7C3AED] hover:text-violet-700 font-medium">
                  Entre em contato
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
