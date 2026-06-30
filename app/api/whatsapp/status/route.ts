
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { WhatsAppService } from '@/lib/whatsapp-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const result = await WhatsAppService.checkConnectionStatus(userId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao verificar status:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Erro ao verificar status',
      },
      { status: 500 }
    )
  }
}
