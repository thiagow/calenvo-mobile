
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { WhatsAppService } from '@/lib/whatsapp-service'
import { PlanType } from '@prisma/client'

export const dynamic = 'force-dynamic'

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
    const { instanceName, apiUrl } = body

    if (!instanceName || !apiUrl) {
      return NextResponse.json(
        { error: 'Nome da instância e URL da API são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await WhatsAppService.createInstance(userId, instanceName, apiUrl)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao criar instância:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Erro ao criar instância',
      },
      { status: 500 }
    )
  }
}
