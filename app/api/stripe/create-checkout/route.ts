export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { stripe, STRIPE_STANDARD_PRICE_ID } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import { setTemporaryData } from '@/lib/temporary-storage'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, name, businessName, segmentType, phone } = body

    console.log('🔑 Iniciando criação de checkout:', { email, name })

    // Validação de campos obrigatórios
    if (!email || !password || !name || !businessName || !phone || !segmentType) {
      return NextResponse.json(
        { message: 'Todos os campos são obrigatórios' },
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

    // Valida se o priceId está configurado
    if (!STRIPE_STANDARD_PRICE_ID) {
      console.error('❌ STRIPE_STANDARD_PRICE_ID não está configurado')
      return NextResponse.json(
        { message: 'Configuração de pagamento inválida' },
        { status: 500 }
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
    
    console.log('📋 Criando Checkout Session...')
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_STANDARD_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/signup/standard?canceled=true`,
      metadata: {
        email,
        name,
        businessName,
        segmentType,
        phone,
        customerId: customer.id,
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
