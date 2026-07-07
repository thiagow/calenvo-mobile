export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { generateApiToken } from '@/lib/api-auth'

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
 * GET /api/dashboard/api-keys — lista os tokens de API do tenant logado.
 * Nunca retorna o token em texto puro, só o prefixo exibível.
 */
export async function GET() {
  const user = await requireMasterUser()
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Apenas usuários master podem gerenciar chaves de API.' }, { status: 403 })
  }

  const tokens = await prisma.apiToken.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      scopes: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ tokens })
}

/**
 * POST /api/dashboard/api-keys — cria um novo token. O valor completo só é
 * retornado nesta resposta — depois disso, só o prefixo fica disponível.
 */
export async function POST(request: NextRequest) {
  const user = await requireMasterUser()
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado. Apenas usuários master podem gerenciar chaves de API.' }, { status: 403 })
  }

  const body = await request.json()
  const { name } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Informe um nome para identificar a chave' }, { status: 400 })
  }

  const generated = generateApiToken()

  const apiToken = await prisma.apiToken.create({
    data: {
      userId: user.id,
      name: name.trim(),
      tokenHash: generated.tokenHash,
      tokenPrefix: generated.tokenPrefix,
    },
    select: { id: true, name: true, tokenPrefix: true, scopes: true, createdAt: true },
  })

  return NextResponse.json(
    {
      ...apiToken,
      token: generated.token, // exibido uma única vez
    },
    { status: 201 }
  )
}
