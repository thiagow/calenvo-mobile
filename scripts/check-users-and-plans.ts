import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(80))
  console.log('AUDITORIA: USUÁRIOS E PLANOS')
  console.log('='.repeat(80))

  // 1. Listar todos os usuários
  console.log('\n📊 USUÁRIOS NO BANCO DE DADOS:')
  console.log('-'.repeat(80))

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      businessName: true,
      planType: true,
      billingInterval: true,
      isActive: true,
      stripeCustomerId: true,
      subscriptionId: true,
      subscriptionStatus: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { createdAt: 'desc' }
  })

  if (users.length === 0) {
    console.log('❌ Nenhum usuário encontrado no banco de dados')
  } else {
    console.log(`✅ Total de usuários: ${users.length}\n`)

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Nome: ${user.name || '(não definido)'}`)
      console.log(`   Negócio: ${user.businessName || '(não definido)'}`)
      console.log(`   Role: ${user.role}`)
      console.log(`   Plano: ${user.planType}`)
      console.log(`   Período: ${user.billingInterval || 'N/A'}`)
      console.log(`   Ativo: ${user.isActive ? 'Sim' : 'Não'}`)
      console.log(`   Stripe Customer ID: ${user.stripeCustomerId || 'Não vinculado'}`)
      console.log(`   Subscription ID: ${user.subscriptionId || 'N/A'}`)
      console.log(`   Status da Subscription: ${user.subscriptionStatus || 'N/A'}`)
      console.log(`   Criado em: ${new Date(user.createdAt).toLocaleString('pt-BR')}`)
      console.log()
    })
  }

  // 2. Estatísticas de planos
  console.log('\n📈 DISTRIBUIÇÃO DE PLANOS:')
  console.log('-'.repeat(80))

  const planStats = await prisma.user.groupBy({
    by: ['planType', 'role'],
    _count: true,
    where: {
      role: { in: ['MASTER', 'PROFESSIONAL'] }
    }
  })

  if (planStats.length === 0) {
    console.log('❌ Nenhum dado de planos encontrado')
  } else {
    planStats.forEach(stat => {
      console.log(`${stat.planType} (${stat.role}): ${stat._count} usuário(s)`)
    })
  }

  // 3. Verificar Stripe
  console.log('\n💳 CONFIGURAÇÃO STRIPE:')
  console.log('-'.repeat(80))

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const stripePubKey = process.env.STRIPE_PUBLISHABLE_KEY
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const stripePriceId = process.env.STRIPE_STANDARD_PRICE_ID

  if (!stripeSecretKey) {
    console.log('❌ STRIPE_SECRET_KEY não configurada')
  } else {
    console.log(`✅ STRIPE_SECRET_KEY configurada (${stripeSecretKey.substring(0, 10)}...)`)
  }

  if (!stripePubKey) {
    console.log('❌ STRIPE_PUBLISHABLE_KEY não configurada')
  } else {
    console.log(`✅ STRIPE_PUBLISHABLE_KEY configurada (${stripePubKey.substring(0, 10)}...)`)
  }

  if (!stripeWebhookSecret) {
    console.log('❌ STRIPE_WEBHOOK_SECRET não configurada')
  } else {
    console.log(`✅ STRIPE_WEBHOOK_SECRET configurada`)
  }

  if (!stripePriceId) {
    console.log('❌ STRIPE_STANDARD_PRICE_ID não configurada')
  } else {
    console.log(`✅ STRIPE_STANDARD_PRICE_ID: ${stripePriceId}`)
  }

  // 4. Validar Stripe conectando aos usuários
  console.log('\n🔗 VÍNCULO STRIPE:')
  console.log('-'.repeat(80))

  const usersWithStripe = await prisma.user.findMany({
    where: {
      stripeCustomerId: { not: null }
    },
    select: {
      email: true,
      stripeCustomerId: true,
      subscriptionId: true,
      subscriptionStatus: true
    }
  })

  if (usersWithStripe.length === 0) {
    console.log('⚠️  Nenhum usuário com Stripe vinculado')
  } else {
    console.log(`✅ ${usersWithStripe.length} usuário(s) com Stripe vinculado\n`)
    usersWithStripe.forEach(user => {
      console.log(`${user.email}`)
      console.log(`  - Customer ID: ${user.stripeCustomerId}`)
      console.log(`  - Subscription ID: ${user.subscriptionId || 'N/A'}`)
      console.log(`  - Status: ${user.subscriptionStatus || 'N/A'}`)
    })
  }

  console.log('\n' + '='.repeat(80))
  console.log('✨ Auditoria concluída')
  console.log('='.repeat(80))
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Erro durante consulta:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
