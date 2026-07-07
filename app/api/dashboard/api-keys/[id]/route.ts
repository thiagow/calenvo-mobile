export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

async function requireMasterUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  const userId = (session.user as any).id
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  })

  if (!user || user.role !== 'MASTER') return null
  return user
}

/**
 * DELETE /api/dashboard/api-keys/[id] — revoga um token (soft delete via revokedAt).
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireMasterUser()
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Apenas usuários master podem gerenciar chaves de API.' }, { status: 403 })
  }

  const token = await prisma.apiToken.findFirst({ where: { id: params.id, userId: user.id } })
  if (!token) {
    return NextResponse.json({ error: 'Chave não encontrada' }, { status: 404 })
  }

  await prisma.apiToken.update({
    where: { id: token.id },
    data: { revokedAt: new Date() },
  })

  return NextResponse.json({ success: true })
}
