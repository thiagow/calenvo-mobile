export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe, getPlanFromPriceId } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { sendWelcomeEmail, sendPaymentFailedEmail } from '@/lib/email-templates'
import { getTemporaryData, deleteTemporaryData, type TemporaryData } from '@/lib/temporary-storage'
import { SegmentType, PlanType } from '@prisma/client'
import { PLAN_CONFIGS, getPlanPrice } from '@/lib/types'
import { formatCurrencyByCurrency } from '@/lib/utils'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    console.error('❌ Assinatura do webhook ausente')
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    // Validar assinatura do webhook
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('❌ Erro ao validar webhook:', err.message)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  console.log(`🔔 Webhook recebido: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
        console.log('✅ Assinatura criada:', event.data.object.id)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        console.log('✅ Pagamento de fatura bem-sucedido:', event.data.object.id)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`ℹ️ Evento não tratado: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error(`❌ Erro ao processar webhook ${event.type}:`, error)
    return NextResponse.json(
      { error: `Webhook handler failed: ${error.message}` },
      { status: 500 }
    )
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('🎉 Checkout Session Completed:', session.id)

  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  // Buscar dados temporários
  const tempData = getTemporaryData(session.id)
  
  if (!tempData) {
    console.error('❌ Dados temporários não encontrados para session:', session.id)
    // Tentar recuperar do metadata
    if (!session.metadata?.email) {
      throw new Error('Dados do usuário não encontrados')
    }
  }

  const userData: TemporaryData = tempData || {
    email: session.metadata!.email,
    password: '', // Será necessário redefinir senha se não houver tempData
    name: session.metadata!.name,
    businessName: session.metadata!.businessName,
    segmentTypes: session.metadata!.segmentTypes.split(',') as SegmentType[],
    phone: session.metadata!.phone,
    customerId,
    plan: (session.metadata!.plan as PlanType) || 'BASICO',
    billingInterval: (session.metadata!.interval as 'MONTHLY' | 'ANNUAL') || 'MONTHLY',
    currency: (session.metadata!.currency as 'BRL' | 'USD') || 'BRL',
    locale: session.metadata!.locale || 'pt',
    timestamp: Date.now(),
  }

  // Verificar se o usuário já existe (idempotência)
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        {
          AND: [
            { email: userData.email },
            { role: 'MASTER' }
          ]
        },
        {
          stripeCustomerId: customerId
        }
      ]
    }
  })

  if (existingUser) {
    console.log('ℹ️ Usuário já existe, atualizando dados do Stripe...')
    
    // Atualizar dados do Stripe se necessário
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        stripeCustomerId: customerId,
        subscriptionId,
        planType: userData.plan,
        billingInterval: userData.billingInterval,
        currency: userData.currency,
        locale: userData.locale,
      }
    })

    // Limpar dados temporários
    deleteTemporaryData(session.id)
    return
  }

  // Criar usuário MASTER
  console.log('👤 Criando usuário MASTER...')
  
  const hashedPassword = await bcrypt.hash(userData.password || 'temp_password_12345', 12)

  const user = await prisma.user.create({
    data: {
      email: userData.email,
      password: hashedPassword,
      name: userData.name,
      businessName: userData.businessName,
      segmentTypes: userData.segmentTypes,
      phone: userData.phone,
      planType: userData.plan,
      billingInterval: userData.billingInterval,
      currency: userData.currency,
      locale: userData.locale,
      role: 'MASTER',
      stripeCustomerId: customerId,
      subscriptionId,
    }
  })

  console.log('✅ Usuário MASTER criado:', user.id)

  // Criar profissional master
  console.log('👥 Criando profissional master...')
  
  const professional = await prisma.user.create({
    data: {
      email: userData.email,
      password: hashedPassword,
      name: userData.name,
      businessName: userData.businessName,
      segmentTypes: userData.segmentTypes,
      phone: userData.phone,
      whatsapp: userData.phone,
      role: 'PROFESSIONAL',
      masterId: user.id,
      isActive: true,
      planType: userData.plan,
      billingInterval: userData.billingInterval,
      currency: userData.currency,
      locale: userData.locale,
    }
  })

  console.log('✅ Profissional master criado:', professional.id)

  // Criar configuração de negócio
  console.log('⚙️ Criando BusinessConfig...')
  
  await prisma.businessConfig.create({
    data: {
      userId: user.id,
      workingDays: [1, 2, 3, 4, 5], // Segunda a sexta
      startTime: '08:00',
      endTime: '18:00',
      defaultDuration: 30,
      lunchStart: '12:00',
      lunchEnd: '13:00',
      multipleServices: false,
      requiresDeposit: false,
      cancellationHours: 24
    }
  })

  console.log('✅ BusinessConfig criada')

  // Enviar email de boas-vindas
  console.log('📧 Enviando email de boas-vindas...')
  
  const planPrice = getPlanPrice(userData.plan, userData.billingInterval, userData.currency)
  const planConfig = PLAN_CONFIGS[userData.plan]

  await sendWelcomeEmail({
    name: userData.name,
    email: userData.email,
    planName: planConfig.name,
    planPrice: formatCurrencyByCurrency(planPrice, userData.currency),
    locale: userData.locale,
    monthlyLimitLabel: planConfig.monthlyLimit === -1 ? (userData.locale === 'en' ? 'Unlimited' : 'Ilimitado') : `${planConfig.monthlyLimit}/${userData.locale === 'en' ? 'mo' : 'mês'}`,
    userLimitLabel: planConfig.userLimit === -1 ? (userData.locale === 'en' ? 'Unlimited' : 'Ilimitado') : String(planConfig.userLimit),
  })

  // Limpar dados temporários
  deleteTemporaryData(session.id)

  console.log('✅ Processo de criação de usuário concluído com sucesso!')
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  console.log('🔄 Assinatura atualizada:', subscription.id, 'Status:', subscription.status)

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId }
  })

  if (!user) {
    console.error('[STRIPE_WEBHOOK_ORPHAN_EVENT] Usuário não encontrado para customer', {
      handler: 'handleSubscriptionUpdated',
      customerId,
      subscriptionId: subscription.id,
      status: subscription.status,
    })
    return
  }

  // O plano é derivado do price ID atual da assinatura, cobrindo tanto o
  // checkout inicial quanto trocas de plano feitas via Stripe Billing Portal
  // (upgrade/downgrade de self-service), que não passam pelo nosso checkout.
  const currentPriceId = subscription.items.data[0]?.price?.id
  const planInfo = currentPriceId ? getPlanFromPriceId(currentPriceId) : null

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      ...(planInfo && {
        planType: planInfo.plan,
        billingInterval: planInfo.interval,
        currency: planInfo.currency,
      }),
    }
  })

  if (planInfo) {
    // Propaga o novo plano para os profissionais da equipe (herdam o plano do master).
    await prisma.user.updateMany({
      where: { masterId: user.id, role: 'PROFESSIONAL' },
      data: {
        planType: planInfo.plan,
        billingInterval: planInfo.interval,
        currency: planInfo.currency,
      }
    })
    console.log(`✅ Assinatura sincronizada: status="${subscription.status}", plano=${planInfo.plan} (${planInfo.interval}/${planInfo.currency})`)
  } else {
    console.warn(`⚠️ Price ID "${currentPriceId}" não mapeado para nenhum plano — apenas status atualizado ("${subscription.status}")`)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  console.log('❌ Assinatura cancelada:', subscription.id)

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId }
  })

  if (!user) {
    console.error('[STRIPE_WEBHOOK_ORPHAN_EVENT] Usuário não encontrado para customer', {
      handler: 'handleSubscriptionDeleted',
      customerId,
      subscriptionId: subscription.id,
    })
    return
  }

  // Não há plano gratuito para reverter — a conta fica suspensa mantendo
  // o último planType contratado, até uma nova assinatura ser ativada.
  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: 'canceled' }
  })

  console.log('⚠️ Assinatura do usuário marcada como cancelada (conta suspensa)')
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

  console.log('❌ Pagamento falhou para invoice:', invoice.id)

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId }
  })

  if (!user) {
    console.error('[STRIPE_WEBHOOK_ORPHAN_EVENT] Usuário não encontrado para customer', {
      handler: 'handlePaymentFailed',
      customerId,
      invoiceId: invoice.id,
    })
    return
  }

  // Enviar email de falha no pagamento
  await sendPaymentFailedEmail({
    name: user.name || 'Usuário',
    email: user.email,
    locale: user.locale,
  })

  console.log('📧 Email de falha no pagamento enviado para:', user.email)
}
