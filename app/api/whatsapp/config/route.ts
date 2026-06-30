
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { PlanType } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const userId = (session.user as any).id

    const config = await prisma.whatsAppConfig.findUnique({
      where: { userId },
    })

    return NextResponse.json(config || null)
  } catch (error) {
    console.error('Erro ao buscar configuração:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar configuração' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const planType = (session.user as any).planType as PlanType

    // Verifica se o usuário tem plano pago
    if (planType === PlanType.FREEMIUM) {
      return NextResponse.json(
        { error: 'Notificações via WhatsApp disponíveis apenas para planos pagos' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const config = await prisma.whatsAppConfig.upsert({
      where: { userId },
      create: {
        userId,
        ...body,
      },
      update: body,
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error('Erro ao salvar configuração:', error)
    return NextResponse.json(
      { error: 'Erro ao salvar configuração' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()

    const config = await prisma.whatsAppConfig.update({
      where: { userId },
      data: body,
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error('Erro ao atualizar configuração:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar configuração' },
      { status: 500 }
    )
  }
}
