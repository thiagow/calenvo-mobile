export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { stripe, getStripePriceId, type BillingInterval } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import { setTemporaryData } from '@/lib/temporary-storage'
import { PlanType, Currency } from '@prisma/client'
import { PLAN_CONFIGS } from '@/lib/types'

const VALID_PLANS: PlanType[] = ['BASICO', 'PRO', 'BUSINESS']
const VALID_INTERVALS: BillingInterval[] = ['MONTHLY', 'ANNUAL']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, name, businessName, segmentType, phone, plan, interval, locale } = body
    const currency: Currency = locale === 'en' ? 'USD' : 'BRL'

    console.log('🔑 Iniciando criação de checkout:', { email, name, plan, interval, currency })

    // Validação de campos obrigatórios
    if (!email || !password || !name || !businessName || !phone || !segmentType) {
      return NextResponse.json(
        { message: 'Todos os campos são obrigatórios' },
        { status: 400 }
      )
    }

    if (!VALID_PLANS.includes(plan)) {
      return NextResponse.json(
        { message: 'Plano inválido' },
        { status: 400 }
      )
    }

    if (!VALID_INTERVALS.includes(interval)) {
      return NextResponse.json(
        { message: 'Intervalo de cobrança inválido' },
        { status: 400 }
      )
    }

    // Verifica se o email já está cadastrado
    const existingUser = await prisma.user.findUnique({
      where: {
        email_role: {
          email,
          role: 'MASTER'
        }
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { message: 'Este e-mail já está cadastrado' },
        { status: 400 }
      )
    }

    // Busca o Price ID configurado para este plano + intervalo + moeda
    const priceId = getStripePriceId(plan, interval, currency)

    if (!priceId) {
      console.error(`❌ Price ID não configurado para plano ${plan} (${interval}, ${currency})`)
      return NextResponse.json(
        { message: `O plano ${PLAN_CONFIGS[plan as PlanType].name} (${interval === 'ANNUAL' ? 'anual' : 'mensal'}) ainda não está disponível para contratação em ${currency}. Tente novamente em breve ou escolha outro plano.` },
        { status: 503 }
      )
    }

    // Criar Customer no Stripe
    console.log('👤 Criando Stripe Customer...')
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        businessName,
        segmentType,
        phone,
      },
    })

    console.log('✅ Stripe Customer criado:', customer.id)

    // Criar Checkout Session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const localePrefix = locale === 'en' ? '/en' : ''

    console.log('📋 Criando Checkout Session...')
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}${localePrefix}/signup/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}&interval=${interval}`,
      cancel_url: `${appUrl}${localePrefix}/signup/${plan.toLowerCase()}?interval=${interval.toLowerCase()}&canceled=true`,
      metadata: {
        email,
        name,
        businessName,
        segmentType,
        phone,
        customerId: customer.id,
        plan,
        interval,
        currency,
        locale: locale || 'pt',
      },
    })

    console.log('✅ Checkout Session criada:', session.id)

    // Armazenar dados temporários (vão expirar em 1 hora)
    setTemporaryData(session.id, {
      email,
      password,
      name,
      businessName,
      segmentType,
      phone,
      customerId: customer.id,
      plan: plan as PlanType,
      billingInterval: interval as BillingInterval,
      currency,
      locale: locale || 'pt',
      timestamp: Date.now(),
    })

    console.log('✅ Dados temporários armazenados para session:', session.id)

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error: any) {
    console.error('❌ Erro ao criar checkout:', error)
    return NextResponse.json(
      { message: error.message || 'Erro ao criar checkout' },
      { status: 500 }
    )
  }
}
