import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PaidSignupForm } from '@/components/auth/paid-signup-form'
import { Logo } from '@/components/brand/logo'
import { getPlanPrice, type Currency } from '@/lib/types'
import { formatCurrencyByCurrency } from '@/lib/utils'
import { PlanType } from '@prisma/client'
import { CheckCircle } from 'lucide-react'

const PLAN_SLUG_MAP: Record<string, PlanType> = {
  basico: 'BASICO',
  pro: 'PRO',
  business: 'BUSINESS',
}

const PLAN_NAME_KEY: Record<PlanType, string> = {
  BASICO: 'basico',
  PRO: 'pro',
  BUSINESS: 'business',
}

interface SignupPlanPageProps {
  params: { plan: string; locale: string }
  searchParams: { interval?: string; canceled?: string }
}

export default async function SignupPlanPage({ params, searchParams }: SignupPlanPageProps) {
  const planType = PLAN_SLUG_MAP[params.plan]

  if (!planType) {
    notFound()
  }

  const t = await getTranslations('Signup')
  const tLanding = await getTranslations('Landing.pricing')
  const locale = await getLocale()
  const currency: Currency = locale === 'en' ? 'USD' : 'BRL'

  const interval: 'MONTHLY' | 'ANNUAL' = searchParams.interval === 'annual' ? 'ANNUAL' : 'MONTHLY'
  const canceled = searchParams.canceled === 'true'
  const planName = tLanding(`${PLAN_NAME_KEY[planType]}.name`)
  const price = getPlanPrice(planType, interval, currency)
  const featureKeys = planType === 'BASICO'
    ? ['feature1', 'feature2', 'feature3', 'feature4', 'feature5']
    : ['feature1', 'feature2', 'feature3', 'feature4', 'feature5', 'feature6']

  return (
    <div className="min-h-screen bg-[#FAFAFF] flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-[#FAFAFF] sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <Logo />
          </Link>
          <Link href="/login">
            <Button variant="outline" className="border-gray-200 bg-white text-gray-900 hover:bg-gray-50">
              {t('alreadyHaveAccount')}
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {canceled && (
          <div className="max-w-2xl mx-auto mb-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-yellow-800">
              <p className="font-medium">{t('canceledTitle')}</p>
              <p className="text-sm mt-1">{t('canceledSubtitle')}</p>
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          {/* Formulário */}
          <div>
            <Card className="bg-white border border-gray-200 rounded-3xl shadow-sm">
              <CardHeader>
                <span className="inline-flex items-center gap-2 mb-2 px-4 py-1.5 bg-violet-100 text-violet-600 rounded-full text-xs font-medium w-fit">
                  {planName}
                </span>
                <CardTitle className="text-2xl font-bold text-gray-900">{t('formTitle', { plan: planName })}</CardTitle>
                <CardDescription className="text-gray-600">
                  {t('formSubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PaidSignupForm plan={planType} interval={interval} />
              </CardContent>
            </Card>
          </div>

          {/* Resumo do Plano */}
          <div>
            <Card className="sticky top-24 bg-white border border-gray-200 rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-gray-900">{t('summaryTitle', { plan: planName })}</CardTitle>
                <CardDescription className="text-gray-600">
                  {interval === 'ANNUAL' ? t('billedAnnual') : t('billedMonthly')}
                </CardDescription>
                <div className="pt-4">
                  <div className="text-4xl font-bold text-violet-600">{formatCurrencyByCurrency(price, currency)}</div>
                  <p className="text-sm text-gray-600 mt-1">{t('perMonth')}</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-gray-900 uppercase tracking-wide">{t('includedTitle')}</h4>
                  <ul className="space-y-3">
                    {featureKeys.map((key) => (
                      <li key={key} className="flex items-start">
                        <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{tLanding(`${PLAN_NAME_KEY[planType]}.${key}`)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-6 border-t border-gray-200">
                    <div className="bg-violet-50 rounded-2xl p-4">
                      <p className="text-sm text-violet-900 font-medium">
                        {t('secureBadgeTitle')}
                      </p>
                      <p className="text-xs text-violet-700 mt-1">
                        {t('secureBadgeSubtitle')}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4">
                    <p className="text-xs text-gray-500 text-center">
                      {t('cancelAnytime')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-[#FAFAFF] mt-12">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-gray-600">
            {t('footerCopyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>
    </div>
  )
}
