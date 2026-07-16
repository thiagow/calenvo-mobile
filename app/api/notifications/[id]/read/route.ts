export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { NotificationService } from '@/lib/notification-service'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const updated = await NotificationService.markAsRead(params.id, userId)

    if (!updated) {
      return NextResponse.json({ error: 'Notificação não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error)
    return NextResponse.json(
      { error: 'Erro ao marcar notificação como lida' },
      { status: 500 }
    )
  }
}
