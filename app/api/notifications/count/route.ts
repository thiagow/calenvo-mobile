
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { NotificationService } from '@/lib/notification-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const count = await NotificationService.getUnreadCount((session.user as any).id)

    return NextResponse.json({ count })
  } catch (error) {
    console.error('Erro ao contar notificações:', error)
    return NextResponse.json(
      { error: 'Erro ao contar notificações' },
      { status: 500 }
    )
  }
}
