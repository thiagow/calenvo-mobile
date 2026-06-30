
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Listar configurações de dias da agenda
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
    const scheduleId = params.id

    // Verificar se a agenda pertence ao usuário
    const schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        userId: userId
      }
    })

    if (!schedule) {
      return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })
    }

    // Buscar configurações de dias
    const dayConfigs = await prisma.scheduleDayConfig.findMany({
      where: {
        scheduleId: scheduleId
      },
      orderBy: {
        dayOfWeek: 'asc'
      }
    })

    return NextResponse.json(dayConfigs)
  } catch (error) {
    console.error('Error fetching day configs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Salvar configurações de dias (batch update)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const scheduleId = params.id

    // Verificar se a agenda pertence ao usuário
    const schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        userId: userId
      }
    })

    if (!schedule) {
      return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const { dayConfigs, useCustomDayConfig } = body

    // Atualizar o campo useCustomDayConfig da agenda
    await prisma.schedule.update({
      where: { id: scheduleId },
      data: { useCustomDayConfig: useCustomDayConfig || false }
    })

    // Se não usar configuração customizada, remover todas as configurações existentes
    if (!useCustomDayConfig) {
      await prisma.scheduleDayConfig.deleteMany({
        where: { scheduleId }
      })
      return NextResponse.json({ success: true, dayConfigs: [] })
    }

    // Remover configurações antigas
    await prisma.scheduleDayConfig.deleteMany({
      where: { scheduleId }
    })

    // Criar novas configurações
    const createdConfigs = await Promise.all(
      dayConfigs.map((config: any) =>
        prisma.scheduleDayConfig.create({
          data: {
            scheduleId,
            dayOfWeek: config.dayOfWeek,
            isActive: config.isActive,
            timeSlots: config.timeSlots || []
          }
        })
      )
    )

    return NextResponse.json({ success: true, dayConfigs: createdConfigs })
  } catch (error) {
    console.error('Error saving day configs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
