
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
    const schedule = await prisma.schedule.findFirst({
      where: {
        id: params.id,
        userId: userId
      },
      include: {
        services: {
          include: {
            service: true
          }
        },
        professionals: {
          include: {
            professional: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        },
        _count: {
          select: {
            appointments: true
          }
        }
      }
    })

    if (!schedule) {
      return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })
    }

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('Error fetching schedule:', error)
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
      color,
      workingDays,
      startTime,
      endTime,
      slotDuration,
      bufferTime,
      lunchStart,
      lunchEnd,
      advanceBookingDays,
      minNoticeHours,
      isActive,
      acceptWalkIn,
      serviceIds,
      professionalIds
    } = body

    // Verificar se a agenda pertence ao usuário
    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        id: params.id,
        userId: userId
      }
    })

    if (!existingSchedule) {
      return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })
    }

    // Atualizar a agenda
    const schedule = await prisma.schedule.update({
      where: { id: params.id },
      data: {
        name,
        description,
        color,
        workingDays,
        startTime,
        endTime,
        slotDuration,
        bufferTime,
        lunchStart,
        lunchEnd,
        advanceBookingDays,
        minNoticeHours,
        isActive,
        acceptWalkIn: acceptWalkIn ?? false
      }
    })

    // Atualizar serviços se fornecidos
    if (serviceIds !== undefined) {
      // Remover vínculos existentes
      await prisma.scheduleService.deleteMany({
        where: { scheduleId: params.id }
      })

      // Criar novos vínculos
      if (serviceIds.length > 0) {
        await prisma.scheduleService.createMany({
          data: serviceIds.map((serviceId: string) => ({
            scheduleId: params.id,
            serviceId
          }))
        })
      }
    }

    // Atualizar profissionais se fornecidos
    if (professionalIds !== undefined) {
      // Remover vínculos existentes
      await prisma.scheduleProfessional.deleteMany({
        where: { scheduleId: params.id }
      })

      // Criar novos vínculos
      if (professionalIds.length > 0) {
        await prisma.scheduleProfessional.createMany({
          data: professionalIds.map((professionalId: string) => ({
            scheduleId: params.id,
            professionalId
          }))
        })
      }
    }

    // Buscar a agenda atualizada com os relacionamentos
    const scheduleWithRelations = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: {
        services: {
          include: {
            service: true
          }
        },
        professionals: {
          include: {
            professional: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(scheduleWithRelations)
  } catch (error) {
    console.error('Error updating schedule:', error)
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

    // Verificar se a agenda pertence ao usuário
    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        id: params.id,
        userId: userId
      }
    })

    if (!existingSchedule) {
      return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })
    }

    // Deletar a agenda (cascade vai remover os vínculos)
    await prisma.schedule.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting schedule:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
