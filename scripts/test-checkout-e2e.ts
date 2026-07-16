import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'

const prisma = new PrismaClient()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const APP_URL = 'http://localhost:3001'
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

const TEST_EMAIL = `e2e-test-${Date.now()}@example.com`

function log(step: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✅' : '❌'} ${step}${detail ? ' — ' + detail : ''}`)
  if (!ok) process.exitCode = 1
}

async function postWebhookEvent(eventPayload: object) {
  const payload = JSON.stringify(eventPayload)
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  })

  const res = await fetch(`${APP_URL}/api/stripe/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': header,
    },
    body: payload,
  })

  return res
}

async function main() {
  console.log('='.repeat(80))
  console.log('TESTE E2E: Checkout → Webhook → Sincronização de Plano')
  console.log('='.repeat(80))
  console.log(`Email de teste: ${TEST_EMAIL}\n`)

  let customerId: string | undefined
  let masterUserId: string | undefined

  try {
    // ── 1. Criar checkout session via API real ──────────────────────────
    console.log('\n1) POST /api/stripe/create-checkout (plano PRO, mensal, BRL)')
    const checkoutRes = await fetch(`${APP_URL}/api/stripe/create-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: 'senhaTeste123',
        name: 'E2E Test User',
        businessName: 'Negócio Teste E2E',
        segmentType: 'BEAUTY_SALON',
        phone: '11999999999',
        plan: 'PRO',
        interval: 'MONTHLY',
        locale: 'pt',
      }),
    })

    if (!checkoutRes.ok) {
      const errBody = await checkoutRes.text()
      throw new Error(`create-checkout falhou (${checkoutRes.status}): ${errBody}`)
    }

    const { sessionId } = await checkoutRes.json()
    log('Checkout session criada', !!sessionId, sessionId)

    const session = await stripe.checkout.sessions.retrieve(sessionId)
    customerId = session.customer as string
    log('Stripe Customer real criado', !!customerId, customerId)

    // ── 2. Simular checkout.session.completed ────────────────────────────
    console.log('\n2) Simulando webhook: checkout.session.completed')
    const fakeSubscriptionId = `sub_e2e_${Date.now()}`

    const checkoutCompletedEvent = {
      id: `evt_e2e_${Date.now()}_1`,
      object: 'event',
      type: 'checkout.session.completed',
      api_version: '2025-12-15.clover',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          ...session,
          customer: customerId,
          subscription: fakeSubscriptionId,
        },
      },
    }

    const res1 = await postWebhookEvent(checkoutCompletedEvent)
    log('Webhook checkout.session.completed aceito (200)', res1.status === 200, `status ${res1.status}`)

    // ── 3. Verificar criação no BD ───────────────────────────────────────
    console.log('\n3) Verificando registros criados no banco de dados')
    const masterUser = await prisma.user.findFirst({
      where: { email: TEST_EMAIL, role: 'MASTER' },
      include: { businessConfig: true },
    })

    log('Usuário MASTER criado', !!masterUser)
    masterUserId = masterUser?.id

    if (masterUser) {
      log('planType = PRO', masterUser.planType === 'PRO', String(masterUser.planType))
      log('billingInterval = MONTHLY', masterUser.billingInterval === 'MONTHLY', String(masterUser.billingInterval))
      log('currency = BRL', masterUser.currency === 'BRL', String(masterUser.currency))
      log('stripeCustomerId correto', masterUser.stripeCustomerId === customerId)
      log('subscriptionId persistido', masterUser.subscriptionId === fakeSubscriptionId, String(masterUser.subscriptionId))
      log('BusinessConfig criada', !!masterUser.businessConfig)
    }

    const professional = await prisma.user.findFirst({
      where: { email: TEST_EMAIL, role: 'PROFESSIONAL' },
    })
    log('Profissional master criado', !!professional)
    if (professional) {
      log('Profissional herdou planType PRO', professional.planType === 'PRO', String(professional.planType))
    }

    // ── 4. Simular upgrade de plano via subscription.updated ────────────
    console.log('\n4) Simulando webhook: customer.subscription.updated (upgrade PRO → BUSINESS)')
    const businessMonthlyPriceId = process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID!

    const subscriptionUpdatedEvent = {
      id: `evt_e2e_${Date.now()}_2`,
      object: 'event',
      type: 'customer.subscription.updated',
      api_version: '2025-12-15.clover',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: fakeSubscriptionId,
          object: 'subscription',
          customer: customerId,
          status: 'active',
          items: {
            object: 'list',
            data: [
              {
                id: 'si_e2e_test',
                price: { id: businessMonthlyPriceId },
              },
            ],
          },
        },
      },
    }

    const res2 = await postWebhookEvent(subscriptionUpdatedEvent)
    log('Webhook subscription.updated aceito (200)', res2.status === 200, `status ${res2.status}`)

    const masterAfterUpgrade = await prisma.user.findFirst({ where: { id: masterUserId } })
    log('planType sincronizado para BUSINESS', masterAfterUpgrade?.planType === 'BUSINESS', String(masterAfterUpgrade?.planType))
    log('subscriptionStatus = active', masterAfterUpgrade?.subscriptionStatus === 'active', String(masterAfterUpgrade?.subscriptionStatus))

    const professionalAfterUpgrade = await prisma.user.findFirst({
      where: { email: TEST_EMAIL, role: 'PROFESSIONAL' },
    })
    log('Profissional propagado para BUSINESS', professionalAfterUpgrade?.planType === 'BUSINESS', String(professionalAfterUpgrade?.planType))

    // ── 5. Simular cancelamento ──────────────────────────────────────────
    console.log('\n5) Simulando webhook: customer.subscription.deleted')
    const subscriptionDeletedEvent = {
      id: `evt_e2e_${Date.now()}_3`,
      object: 'event',
      type: 'customer.subscription.deleted',
      api_version: '2025-12-15.clover',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: fakeSubscriptionId,
          object: 'subscription',
          customer: customerId,
          status: 'canceled',
        },
      },
    }

    const res3 = await postWebhookEvent(subscriptionDeletedEvent)
    log('Webhook subscription.deleted aceito (200)', res3.status === 200, `status ${res3.status}`)

    const masterAfterCancel = await prisma.user.findFirst({ where: { id: masterUserId } })
    log('subscriptionStatus = canceled', masterAfterCancel?.subscriptionStatus === 'canceled', String(masterAfterCancel?.subscriptionStatus))
    log('planType preservado (BUSINESS)', masterAfterCancel?.planType === 'BUSINESS', String(masterAfterCancel?.planType))

  } finally {
    // ── Cleanup ───────────────────────────────────────────────────────────
    console.log('\n' + '-'.repeat(80))
    console.log('Limpando dados de teste...')

    await prisma.businessConfig.deleteMany({ where: { user: { email: TEST_EMAIL } } })
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
    console.log('✅ Registros de teste removidos do banco de dados')

    if (customerId) {
      try {
        await stripe.customers.del(customerId)
        console.log('✅ Stripe Customer de teste removido:', customerId)
      } catch (e: any) {
        console.log('⚠️ Não foi possível remover o Stripe Customer:', e.message)
      }
    }

    await prisma.$disconnect()
  }

  console.log('\n' + '='.repeat(80))
  console.log(process.exitCode ? '❌ TESTE E2E FALHOU — veja os itens marcados acima' : '✅ TESTE E2E CONCLUÍDO COM SUCESSO')
  console.log('='.repeat(80))
}

main().catch(async (e) => {
  console.error('❌ Erro fatal no teste E2E:', e)
  await prisma.$disconnect()
  process.exit(1)
})
