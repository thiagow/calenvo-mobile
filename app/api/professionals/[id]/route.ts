
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { normalizeEmail } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// GET - Buscar profissional específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { id } = params

    const professional = await prisma.user.findFirst({
      where: {
        id: id,
        masterId: userId
      },
      select: {
        id: true,
        name: true,
        email: true,
        whatsapp: true,
        image: true,
        isActive: true,
        canForceOverbook: true,
        createdAt: true,
        role: true,
        scheduleProfessionals: {
          include: {
            schedule: {
              select: {
                id: true,
                name: true,
                color: true
              }
            }
          }
        }
      }
    })

    if (!professional) {
      return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 })
    }

    return NextResponse.json(professional)
  } catch (error) {
    console.error('Error fetching professional:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Atualizar profissional
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { id } = params
    const body = await request.json()
    const { name, email, whatsapp, password, image, isActive, canForceOverbook } = body

    // Verificar se o profissional pertence ao master
    const professional = await prisma.user.findFirst({
      where: {
        id: id,
        masterId: userId
      }
    })

    if (!professional) {
      return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 })
    }

    // Preparar dados para atualização
    const updateData: any = {}
    
    if (name !== undefined) updateData.name = name
    if (email !== undefined) {
      const normalizedEmail = normalizeEmail(email)

      // Só verifica conflito se o e-mail realmente mudou
      if (normalizedEmail !== normalizeEmail(professional.email)) {
        const existingUser = await prisma.user.findFirst({
          where: {
            email: { equals: normalizedEmail, mode: 'insensitive' },
            id: { not: id }
          }
        })

        if (existingUser) {
          return NextResponse.json(
            { error: 'Este e-mail já está em uso' },
            { status: 400 }
          )
        }
      }

      updateData.email = normalizedEmail
    }
    if (whatsapp !== undefined) updateData.whatsapp = whatsapp
    if (image !== undefined) updateData.image = image
    if (isActive !== undefined) updateData.isActive = isActive
    if (canForceOverbook !== undefined) updateData.canForceOverbook = Boolean(canForceOverbook)
    
    // Hash da nova senha se fornecida
    if (password) {
      updateData.password = await bcrypt.hash(password, 12)
    }

    // Atualizar profissional
    const updatedProfessional = await prisma.user.update({
      where: { id: id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        whatsapp: true,
        image: true,
        isActive: true,
        createdAt: true,
        role: true
      }
    })

    return NextResponse.json(updatedProfessional)
  } catch (error) {
    console.error('Error updating professional:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Deletar profissional
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { id } = params

    // Verificar se o profissional pertence ao master
    const professional = await prisma.user.findFirst({
      where: {
        id: id,
        masterId: userId
      }
    })

    if (!professional) {
      return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 })
    }

    // Deletar profissional (CASCADE vai deletar relacionamentos)
    await prisma.user.delete({
      where: { id: id }
    })

    return NextResponse.json({ message: 'Profissional deletado com sucesso' })
  } catch (error) {
    console.error('Error deleting professional:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
