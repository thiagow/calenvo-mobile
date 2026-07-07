'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/brand/logo'
import { PLAN_CONFIGS, getPlanPrice, type Currency } from '@/lib/types'
import { formatCurrencyByCurrency } from '@/lib/utils'
import { PlanType } from '@prisma/client'
import { CheckCircle, Mail, ArrowRight, Loader2 } from 'lucide-react'

const PLAN_NAME_KEY: Record<PlanType, string> = {
  BASICO: 'basico',
  PRO: 'pro',
  BUSINESS: 'business',
}

function SignupSuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams?.get('session_id')
  const planParam = searchParams?.get('plan') as PlanType | null
  const intervalParam = searchParams?.get('interval')
  const [loading, setLoading] = useState(true)
  const t = useTranslations('SignupSuccess')
  const tLanding = useTranslations('Landing.pricing')
  const locale = useLocale()
  const currency: Currency = locale === 'en' ? 'USD' : 'BRL'

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  const config = planParam && PLAN_CONFIGS[planParam] ? PLAN_CONFIGS[planParam] : null
  const planName = planParam ? tLanding(`${PLAN_NAME_KEY[planParam]}.name`) : null
  const price = planParam ? getPlanPrice(planParam, intervalParam === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY', currency) : null

  return (
    <div className="min-h-screen bg-[#FAFAFF] flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-[#FAFAFF]">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <Logo />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full">
          {loading ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Loader2 className="h-16 w-16 animate-spin mx-auto text-[#7C3AED] mb-4" />
                <p className="text-lg text-gray-600">{t('processing')}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-green-200">
              <CardHeader className="text-center pb-6">
                <div className="mx-auto mb-6 w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                <CardTitle className="text-3xl mb-2">
                  {t('confirmedTitle')}
                </CardTitle>
                <CardDescription className="text-lg">
                  {planName ? t('confirmedSubtitleWithPlan', { plan: planName }) : t('confirmedSubtitleGeneric')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Resumo da Assinatura */}
                {config && (
                  <div className="bg-violet-50 rounded-lg p-6 border border-violet-200">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                      {t('detailsTitle')}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">{t('planLabel')}</p>
                        <p className="font-semibold text-gray-900">{planName}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">{t('valueLabel')}</p>
                        <p className="font-semibold text-gray-900">{formatCurrencyByCurrency(price!, currency)}{t('perMonthShort')}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">{t('appointmentsLabel')}</p>
                        <p className="font-semibold text-gray-900">{config.monthlyLimit === -1 ? t('unlimited') : `${config.monthlyLimit}${t('perMonthShort')}`}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">{t('professionalsLabel')}</p>
                        <p className="font-semibold text-gray-900">{config.userLimit === -1 ? t('unlimited') : config.userLimit}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Próximos Passos */}
                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    {t('nextStepsTitle')}
                  </h3>
                  <ol className="space-y-4">
                    <li className="flex items-start">
                      <div className="flex-shrink-0 w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-[#7C3AED] font-semibold text-sm mr-3">
                        1
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{t('step1Title')}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {t('step1Description')}
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="flex-shrink-0 w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-[#7C3AED] font-semibold text-sm mr-3">
                        2
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{t('step2Title')}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {t('step2Description')}
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="flex-shrink-0 w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-[#7C3AED] font-semibold text-sm mr-3">
                        3
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{t('step3Title')}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {t('step3Description')}
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>

                {/* Email de Confirmação */}
                <div className="bg-violet-50 rounded-lg p-4 border border-violet-200">
                  <div className="flex items-start">
                    <Mail className="h-5 w-5 text-[#7C3AED] mr-3 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-violet-900">
                        {t('emailConfirmedTitle')}
                      </p>
                      <p className="text-sm text-violet-700 mt-1">
                        {t('emailConfirmedSubtitle')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="pt-4">
                  <Link href="/login" className="block">
                    <Button
                      className="w-full bg-[#7C3AED] hover:bg-violet-700 text-white text-lg py-6"
                      size="lg"
                    >
                      {t('ctaButton')}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>

                {/* Suporte */}
                <div className="text-center pt-4">
                  <p className="text-sm text-gray-600">
                    {t('helpText')}{' '}
                    <a href="mailto:contato@calenvo.com.br" className="text-[#7C3AED] hover:text-violet-700 font-medium">
                      {t('contactLink')}
                    </a>
                  </p>
                </div>

                {/* Session ID (debug) */}
                {sessionId && (
                  <div className="text-center pt-2">
                    <p className="text-xs text-gray-400">
                      {t('sessionIdLabel')}: {sessionId.slice(0, 20)}...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
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

export default function SignupSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#7C3AED]" />
      </div>
    }>
      <SignupSuccessContent />
    </Suspense>
  )
}
