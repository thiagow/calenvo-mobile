import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * GET /api/settings/public-url?slug=xxx — checagem de disponibilidade em
 * tempo real, usada pelo campo de edição manual do slug em /dashboard/settings.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const slug = request.nextUrl.searchParams.get('slug') || ''

  if (!SLUG_PATTERN.test(slug) || slug.length < 3 || slug.length > 60) {
    return NextResponse.json({ available: false, reason: 'invalid' })
  }

  const existing = await prisma.businessConfig.findFirst({
    where: { publicUrl: slug, NOT: { userId } },
    select: { userId: true },
  })

  return NextResponse.json({ available: !existing })
}

/**
 * PATCH /api/settings/public-url — troca deliberada do slug pelo próprio
 * usuário. Diferente de resolveUniqueSlug (usado na geração automática do
 * primeiro link), aqui rejeita se o slug já estiver em uso em vez de
 * sufixar sozinho — é uma escolha explícita, não deve mudar por conta própria.
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as any).role
  if (userRole === 'PROFESSIONAL') {
    return NextResponse.json({ error: 'Apenas administradores podem alterar o link público.' }, { status: 403 })
  }

  const userId = (session.user as any).id
  const body = await request.json()
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''

  if (!SLUG_PATTERN.test(slug) || slug.length < 3 || slug.length > 60) {
    return NextResponse.json({ error: 'Link inválido. Use apenas letras minúsculas, números e hífens.' }, { status: 400 })
  }

  const existing = await prisma.businessConfig.findFirst({
    where: { publicUrl: slug, NOT: { userId } },
    select: { userId: true },
  })

  if (existing) {
    return NextResponse.json({ error: 'Esse link já está em uso por outra conta.' }, { status: 409 })
  }

  const config = await prisma.businessConfig.upsert({
    where: { userId },
    update: { publicUrl: slug },
    create: {
      userId,
      publicUrl: slug,
      workingDays: [1, 2, 3, 4, 5],
    },
  })

  return NextResponse.json({ publicUrl: config.publicUrl })
}
