export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { NotificationService } from '@/lib/notification-service'

export async function PATCH() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    await NotificationService.markAllAsRead((session.user as any).id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao marcar todas notificações como lidas:', error)
    return NextResponse.json(
      { error: 'Erro ao marcar todas notificações como lidas' },
      { status: 500 }
    )
  }
}
