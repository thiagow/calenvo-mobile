
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { generateSlug } from '@/lib/utils'
import { resolveUniqueSlug } from '@/lib/tenant-resolver'
import { SegmentType } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        whatsapp: true,
        businessName: true,
        phone: true,
        segmentTypes: true,
        planType: true,
        isActive: true,
        createdAt: true,
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userRole = (session.user as any).role
    const body = await request.json()

    // Campos permitidos para atualização
    const allowedFields = [
      'name',
      'whatsapp',
      'businessName',
      'phone',
      'segmentTypes'
    ]

    const updateData: any = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (updateData.segmentTypes !== undefined) {
      // Segmentos são uma propriedade do negócio como um todo (não da pessoa
      // logada) — só o admin da conta (MASTER) pode alterá-los.
      if (userRole !== 'MASTER') {
        return NextResponse.json({ error: 'Apenas o administrador da conta pode alterar os segmentos' }, { status: 403 })
      }

      const validSegments = Object.values(SegmentType)
      if (
        !Array.isArray(updateData.segmentTypes) ||
        updateData.segmentTypes.length === 0 ||
        !updateData.segmentTypes.every((s: string) => validSegments.includes(s as SegmentType))
      ) {
        return NextResponse.json({ error: 'Selecione ao menos um segmento válido' }, { status: 400 })
      }
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          whatsapp: true,
          businessName: true,
          phone: true,
          segmentTypes: true,
          planType: true,
          isActive: true,
          createdAt: true,
        }
      })

      // Sincroniza com a linha PROFESSIONAL vinculada, do mesmo jeito que já
      // acontece na criação da conta (checkout e criação manual pelo saas-admin).
      if (updateData.segmentTypes !== undefined) {
        await tx.user.updateMany({
          where: { masterId: userId, role: 'PROFESSIONAL' },
          data: { segmentTypes: updateData.segmentTypes }
        })
      }

      return user
    })

    // Gera o link público (publicUrl) só na primeira vez que o negócio tem um
    // nome — depois disso, mudar o nome NUNCA sobrescreve o slug existente.
    // Antes, qualquer edição de businessName regenerava o publicUrl e quebrava
    // silenciosamente qualquer link já divulgado (cartão de visita, bio do
    // Instagram etc.) com a URL antiga.
    if (body.businessName) {
      const existingConfig = await prisma.businessConfig.findUnique({
        where: { userId },
        select: { publicUrl: true },
      })

      if (!existingConfig?.publicUrl) {
        const baseSlug = generateSlug(body.businessName)
        const slug = await resolveUniqueSlug(baseSlug, userId)

        await prisma.businessConfig.upsert({
          where: { userId },
          create: {
            userId,
            publicUrl: slug,
            workingDays: [1, 2, 3, 4, 5], // Default Monday to Friday
          },
          update: {
            publicUrl: slug
          }
        })
      }
    }

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating user profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
