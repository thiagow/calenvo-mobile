
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

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
    const service = await prisma.service.findFirst({
      where: {
        id: params.id,
        userId: userId
      },
      include: {
        schedules: {
          include: {
            schedule: true
          }
        },
        _count: {
          select: {
            appointments: true
          }
        }
      }
    })

    if (!service) {
      return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })
    }

    return NextResponse.json(service)
  } catch (error) {
    console.error('Error fetching service:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const {
      name,
      description,
      duration,
      price,
      category,
      requiresDeposit,
      depositAmount,
      isActive
    } = body

    // Verificar se o serviço pertence ao usuário
    const existingService = await prisma.service.findFirst({
      where: {
        id: params.id,
        userId: userId
      }
    })

    if (!existingService) {
      return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })
    }

    const service = await prisma.service.update({
      where: { id: params.id },
      data: {
        name,
        description,
        duration,
        price: price ? parseFloat(price) : null,
        category,
        requiresDeposit,
        depositAmount: depositAmount ? parseFloat(depositAmount) : null,
        isActive
      },
      include: {
        schedules: {
          include: {
            schedule: true
          }
        }
      }
    })

    return NextResponse.json(service)
  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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

    // Verificar se o serviço pertence ao usuário
    const existingService = await prisma.service.findFirst({
      where: {
        id: params.id,
        userId: userId
      }
    })

    if (!existingService) {
      return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })
    }

    await prisma.service.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting service:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
