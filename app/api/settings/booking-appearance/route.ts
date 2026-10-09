export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { BOOKING_TEMPLATES, isValidHex } from '@/lib/booking-theme'

const hexOrNull = z
  .string()
  .refine(isValidHex, 'Cor inválida. Use o formato #RRGGBB')
  .nullable()

const appearanceSchema = z
  .object({
    template: z.enum(BOOKING_TEMPLATES),
    bgColor: hexOrNull,
    textColor: hexOrNull,
    accentColor: hexOrNull,
    coverEnabled: z.boolean(),
  })
  .strict()

const APPEARANCE_SELECT = {
  bookingTemplate: true,
  bookingBgColor: true,
  bookingTextColor: true,
  bookingAccentColor: true,
  bookingCoverEnabled: true,
  bookingCoverImage: true,
  businessLogo: true,
  publicUrl: true,
} as const

function toResponse(
  business: { name: string; slug: string },
  config: {
  bookingTemplate: (typeof BOOKING_TEMPLATES)[number]
  bookingBgColor: string | null
  bookingTextColor: string | null
  bookingAccentColor: string | null
  bookingCoverEnabled: boolean
  bookingCoverImage: string | null
  businessLogo: string | null
  publicUrl: string | null
  }
) {
  return {
    businessName: business.name,
    publicSlug: config.publicUrl ?? business.slug,
    template: config.bookingTemplate,
    bgColor: config.bookingBgColor,
    textColor: config.bookingTextColor,
    accentColor: config.bookingAccentColor,
    coverEnabled: config.bookingCoverEnabled,
    coverImage: config.bookingCoverImage,
    businessLogo: config.businessLogo,
  }
}

/** Mesmo fallback do link público: o prefixo do ID resolve em resolveTenantBySlug. */
function businessIdentity(user: { id: string; businessName: string | null; name: string | null }) {
  return {
    name: user.businessName || user.name || 'Agendamento Online',
    slug: user.id.substring(0, 8),
  }
}

async function requireMaster() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  }

  const { id, role } = session.user as { id?: string; role?: string }
  if (!id) {
    return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  }
  if (role !== 'MASTER') {
    return {
      error: NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem alterar a página pública.' },
        { status: 403 }
      ),
    }
  }
  return { userId: id }
}

export async function GET() {
  try {
    const auth = await requireMaster()
    if ('error' in auth) return auth.error

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        name: true,
        businessName: true,
        businessConfig: { select: APPEARANCE_SELECT },
      },
    })
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    return NextResponse.json(
      toResponse(
        businessIdentity(user),
        user.businessConfig ?? {
          bookingTemplate: 'NATURAL',
          bookingBgColor: null,
          bookingTextColor: null,
          bookingAccentColor: null,
          bookingCoverEnabled: false,
          bookingCoverImage: null,
          businessLogo: null,
          publicUrl: null,
        }
      )
    )
  } catch (error) {
    console.error('Erro ao buscar aparência da página pública:', error)
    return NextResponse.json({ error: 'Erro ao buscar aparência' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireMaster()
    if ('error' in auth) return auth.error

    const parsed = appearanceSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
        { status: 400 }
      )
    }
    const { template, bgColor, textColor, accentColor, coverEnabled } = parsed.data

    const data = {
      bookingTemplate: template,
      bookingBgColor: bgColor?.toUpperCase() ?? null,
      bookingTextColor: textColor?.toUpperCase() ?? null,
      bookingAccentColor: accentColor?.toUpperCase() ?? null,
      bookingCoverEnabled: coverEnabled,
    }

    const config = await prisma.businessConfig.upsert({
      where: { userId: auth.userId },
      update: data,
      create: {
        userId: auth.userId,
        workingDays: [1, 2, 3, 4, 5],
        startTime: '08:00',
        endTime: '18:00',
        defaultDuration: 30,
        ...data,
      },
      select: APPEARANCE_SELECT,
    })

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, name: true, businessName: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    return NextResponse.json(toResponse(businessIdentity(user), config))
  } catch (error) {
    console.error('Erro ao salvar aparência da página pública:', error)
    return NextResponse.json({ error: 'Erro ao salvar aparência' }, { status: 500 })
  }
}
