
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { generateSlug } from '@/lib/utils'

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
        segmentType: true,
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
    const body = await request.json()

    // Campos permitidos para atualização
    const allowedFields = [
      'name',
      'whatsapp',
      'businessName',
      'phone',
      'segmentType'
    ]

    const updateData: any = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const updatedUser = await prisma.user.update({
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
        segmentType: true,
        planType: true,
        isActive: true,
        createdAt: true,
      }
    })

    // Update BusinessConfig with generated slug if businessName changed
    if (body.businessName) {
      const slug = generateSlug(body.businessName)
      
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

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating user profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
