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
    select: { id: true, role: true, businessConfig: { select: { publicUrl: true } } },
  })

  if (!user || user.role !== 'MASTER') return null
  return user
}

export async function GET() {
  const user = await requireMasterUser()
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const config = await prisma.chatWidgetConfig.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  })

  return NextResponse.json({
    ...config,
    slug: user.businessConfig?.publicUrl || user.id,
  })
}

export async function PUT(request: NextRequest) {
  const user = await requireMasterUser()
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const body = await request.json()
  const { enabled, welcomeMessage, primaryColor, position, showLauncherText } = body

  const config = await prisma.chatWidgetConfig.upsert({
    where: { userId: user.id },
    update: {
      ...(typeof enabled === 'boolean' && { enabled }),
      ...(welcomeMessage && { welcomeMessage }),
      ...(primaryColor && { primaryColor }),
      ...(position && { position }),
      ...(typeof showLauncherText === 'boolean' && { showLauncherText }),
    },
    create: {
      userId: user.id,
      enabled: enabled ?? false,
      welcomeMessage: welcomeMessage || undefined,
      primaryColor: primaryColor || undefined,
      position: position || undefined,
      showLauncherText: showLauncherText ?? true,
    },
  })

  return NextResponse.json(config)
}
