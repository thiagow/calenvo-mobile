
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

    let config = await prisma.businessConfig.findUnique({
      where: { userId }
    })

    // If no config exists, return defaults
    if (!config) {
      return NextResponse.json({
        workingDays: [1, 2, 3, 4, 5], // Segunda a Sexta
        startTime: '08:00',
        endTime: '18:00',
        defaultDuration: 30,
        lunchStart: '12:00',
        lunchEnd: '13:00'
      })
    }

    return NextResponse.json({
      workingDays: config.workingDays,
      startTime: config.startTime,
      endTime: config.endTime,
      defaultDuration: config.defaultDuration,
      lunchStart: config.lunchStart,
      lunchEnd: config.lunchEnd,
      businessLogo: config.businessLogo,
      autoConfirm: config.autoConfirm,
      allowOnlineBooking: config.allowOnlineBooking,
      publicUrl: config.publicUrl,
      address: config.address,
      description: config.description
    })
  } catch (error) {
    console.error('Error fetching business config:', error)
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
    const userRole = (session.user as any).role

    // Apenas MASTER pode modificar configurações
    if (userRole === 'PROFESSIONAL') {
      return NextResponse.json({
        error: 'Acesso negado. Apenas administradores podem modificar configurações.'
      }, { status: 403 })
    }
    const body = await request.json()
    const {
      workingDays,
      startTime,
      endTime,
      defaultDuration,
      lunchStart,
      lunchEnd,
      address,
      description
    } = body

    // Validate working days
    if (!Array.isArray(workingDays) || workingDays.length === 0) {
      return NextResponse.json(
        { error: 'At least one working day must be selected' },
        { status: 400 }
      )
    }

    // Validate times
    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: 'Start time and end time are required' },
        { status: 400 }
      )
    }

    // Check if config exists
    const existingConfig = await prisma.businessConfig.findUnique({
      where: { userId }
    })

    let config
    if (existingConfig) {
      // Update existing config
      config = await prisma.businessConfig.update({
        where: { userId },
        data: {
          workingDays,
          startTime,
          endTime,
          defaultDuration: Number(defaultDuration),
          lunchStart,
          lunchEnd,
          address,
          description
        }
      })
    } else {
      // Create new config
      config = await prisma.businessConfig.create({
        data: {
          userId,
          workingDays,
          startTime,
          endTime,
          defaultDuration: Number(defaultDuration),
          lunchStart,
          lunchEnd,
          address,
          description
        }
      })
    }

    return NextResponse.json({
      workingDays: config.workingDays,
      startTime: config.startTime,
      endTime: config.endTime,
      defaultDuration: config.defaultDuration,
      lunchStart: config.lunchStart,
      lunchEnd: config.lunchEnd,
      businessLogo: config.businessLogo,
      autoConfirm: config.autoConfirm,
      allowOnlineBooking: config.allowOnlineBooking,
      publicUrl: config.publicUrl,
      address: config.address,
      description: config.description
    })
  } catch (error) {
    console.error('Error saving business config:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
