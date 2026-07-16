import 'dotenv/config'
import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY não está configurada')
  process.exit(1)
}

const stripe = new Stripe(stripeSecretKey)

async function main() {
  console.log('='.repeat(80))
  console.log('AUDITORIA: PREÇOS E PRODUTOS STRIPE')
  console.log('='.repeat(80))

  try {
    // 1. Listar todos os produtos
    console.log('\n📦 PRODUTOS NA STRIPE:')
    console.log('-'.repeat(80))

    const products = await stripe.products.list({
      limit: 100
    })

    if (products.data.length === 0) {
      console.log('❌ Nenhum produto encontrado na Stripe')
    } else {
      console.log(`✅ Total de produtos: ${products.data.length}\n`)

      for (const product of products.data) {
        console.log(`Produto: ${product.name}`)
        console.log(`  ID: ${product.id}`)
        console.log(`  Ativo: ${product.active ? 'Sim' : 'Não'}`)
        console.log()

        // Listar preços de cada produto
        const prices = await stripe.prices.list({
          product: product.id,
          limit: 100
        })

        if (prices.data.length > 0) {
          console.log(`  💰 Preços:`)
          prices.data.forEach(price => {
            const amount = (price.unit_amount || 0) / 100
            const currency = price.currency.toUpperCase()
            const interval = price.recurring?.interval || 'única'
            console.log(`    - ${price.id}`)
            console.log(`      Valor: ${amount.toFixed(2)} ${currency}`)
            console.log(`      Período: ${interval}`)
            console.log(`      Ativo: ${price.active ? 'Sim' : 'Não'}`)
          })
        }
        console.log()
      }
    }

    // 2. Verificar env vars esperadas
    console.log('\n🔍 PRICE IDs ESPERADOS VS CONFIGURADOS:')
    console.log('-'.repeat(80))

    const expectedPriceIds = [
      'STRIPE_BASICO_MONTHLY_PRICE_ID',
      'STRIPE_BASICO_ANNUAL_PRICE_ID',
      'STRIPE_PRO_MONTHLY_PRICE_ID',
      'STRIPE_PRO_ANNUAL_PRICE_ID',
      'STRIPE_BUSINESS_MONTHLY_PRICE_ID',
      'STRIPE_BUSINESS_ANNUAL_PRICE_ID',
      'STRIPE_BASICO_MONTHLY_PRICE_ID_USD',
      'STRIPE_BASICO_ANNUAL_PRICE_ID_USD',
      'STRIPE_PRO_MONTHLY_PRICE_ID_USD',
      'STRIPE_PRO_ANNUAL_PRICE_ID_USD',
      'STRIPE_BUSINESS_MONTHLY_PRICE_ID_USD',
      'STRIPE_BUSINESS_ANNUAL_PRICE_ID_USD'
    ]

    let configuredCount = 0
    expectedPriceIds.forEach(priceId => {
      const value = process.env[priceId]
      if (value) {
        console.log(`✅ ${priceId}: ${value}`)
        configuredCount++
      } else {
        console.log(`❌ ${priceId}: NÃO CONFIGURADA`)
      }
    })

    console.log(`\nConfigured: ${configuredCount}/${expectedPriceIds.length}`)

    // 3. Listar clientes
    console.log('\n👥 CLIENTES NA STRIPE:')
    console.log('-'.repeat(80))

    const customers = await stripe.customers.list({
      limit: 100
    })

    if (customers.data.length === 0) {
      console.log('❌ Nenhum cliente Stripe')
    } else {
      console.log(`✅ Total de clientes: ${customers.data.length}\n`)
      customers.data.forEach(customer => {
        console.log(`${customer.email || 'Sem email'} (${customer.id})`)
        if (customer.metadata) {
          console.log(`  Metadata: ${JSON.stringify(customer.metadata)}`)
        }
      })
    }

  } catch (error) {
    if (error instanceof Stripe.errors.StripeAPIError) {
      console.error(`❌ Erro Stripe: ${error.message}`)
      console.error(`   Code: ${error.code}`)
    } else {
      console.error('❌ Erro ao consultar Stripe:', error)
    }
    process.exit(1)
  }

  console.log('\n' + '='.repeat(80))
  console.log('✨ Auditoria Stripe concluída')
  console.log('='.repeat(80))
}

main()
