
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userRole = (session.user as any).role
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const scheduleId = searchParams.get('scheduleId')

    let whereConditions: any = {}

    if (userRole === 'PROFESSIONAL') {
      // Professional sees services linked to schedules they are part of
      whereConditions = {
        schedules: {
          some: {
            schedule: {
              professionals: {
                some: {
                  professionalId: userId
                }
              }
            }
          }
        }
      }
    } else {
      // Master sees services they created
      whereConditions = {
        userId: userId
      }
    }

    if (!includeInactive) {
      whereConditions.isActive = true
    }

    const services = await prisma.service.findMany({
      where: whereConditions,
      include: {
        schedules: {
          include: {
            schedule: true
          },
          ...(scheduleId && {
            where: {
              scheduleId: scheduleId
            }
          })
        },
        _count: {
          select: {
            appointments: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(services)
  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
      depositAmount
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Nome é obrigatório' },
        { status: 400 }
      )
    }

    const service = await prisma.service.create({
      data: {
        userId: userId,
        name,
        description,
        duration: duration || 30,
        price: price ? parseFloat(price) : null,
        category,
        requiresDeposit: requiresDeposit || false,
        depositAmount: depositAmount ? parseFloat(depositAmount) : null
      }
    })

    return NextResponse.json(service, { status: 201 })
  } catch (error) {
    console.error('Error creating service:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
