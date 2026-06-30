import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getAppointmentLimit, getRemainingAppointments } from '@/lib/plan-limits'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Buscar dados do usuário com plano
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        planType: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Contar agendamentos do mês atual
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const appointmentsThisMonth = await prisma.appointment.count({
      where: {
        userId: userId,
        date: {
          gte: firstDayOfMonth,
          lte: lastDayOfMonth
        },
        status: {
          notIn: ['CANCELLED', 'NO_SHOW'] // Não conta cancelados e faltas
        }
      }
    })

    const limit = getAppointmentLimit(user.planType)
    const remaining = getRemainingAppointments(user.planType, appointmentsThisMonth)

    return NextResponse.json({
      planType: user.planType,
      currentMonth: {
        used: appointmentsThisMonth,
        limit: limit,
        remaining: remaining,
        isUnlimited: limit === -1,
        percentage: limit > 0 ? Math.round((appointmentsThisMonth / limit) * 100) : 0
      }
    })
  } catch (error) {
    console.error('Error fetching plan usage:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
