
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { DEFAULT_TIMEZONE, formatInZone, tenantCalendarDayWindow } from '@/lib/timezone'
import { ACTIVE_STATUSES, dashboardPeriods } from '@/lib/dashboard-stats'

export const dynamic = 'force-dynamic'

// GET - Buscar estatísticas do dashboard
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userRole = (session.user as any).role

    // If professional, we need their master's data for plan usage
    let masterId = userId
    if (userRole === 'PROFESSIONAL') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { masterId: true }
      })
      masterId = user?.masterId || userId
    }

    const businessConfig = await prisma.businessConfig.findUnique({
      where: { userId: masterId },
      select: { timezone: true }
    })
    const timeZone = businessConfig?.timezone || DEFAULT_TIMEZONE

    // Semana (seg–dom, igual à Agenda) e mês no calendário do NEGÓCIO
    const periods = dashboardPeriods(timeZone)
    const todayEnd = tenantCalendarDayWindow(timeZone, periods.today).end

    // Os indicadores abrem a Agenda ao clicar, e a Agenda do profissional só mostra
    // os agendamentos dele — então o número do card precisa ser do mesmo escopo.
    const scopedFilter = userRole === 'PROFESSIONAL'
      ? { userId: masterId, professionalId: userId, deletedAt: null }
      : { userId: masterId, deletedAt: null }

    // Uso do plano é do tenant inteiro, independente de quem está logado
    const planFilter = { userId: masterId, deletedAt: null }

    const activeStatus = { in: [...ACTIVE_STATUSES] }
    const weekRange = { gte: periods.week.gte, lte: periods.week.lte }
    const monthRange = { gte: periods.month.gte, lte: periods.month.lte }

    // "Hoje" (lista abaixo dos indicadores): pessoal para o profissional
    const recentAppointmentFilter = userRole === 'PROFESSIONAL'
      ? { professionalId: userId, deletedAt: null }
      : { userId, deletedAt: null }

    const [
      weekAppointments,
      monthAppointments,
      pendingWeek,
      confirmedWeek,
      planMonthAppointments,
      recentAppointments
    ] = await Promise.all([
      // Esta semana: tudo que está de pé (sem cancelados/faltas)
      prisma.appointment.count({
        where: { ...scopedFilter, date: weekRange, status: activeStatus }
      }),

      // Total do mês inteiro
      prisma.appointment.count({
        where: { ...scopedFilter, date: monthRange, status: activeStatus }
      }),

      // Pendentes: agendados, ainda sem confirmação do cliente
      prisma.appointment.count({
        where: { ...scopedFilter, date: weekRange, status: 'SCHEDULED' }
      }),

      // Confirmados
      prisma.appointment.count({
        where: { ...scopedFilter, date: weekRange, status: 'CONFIRMED' }
      }),

      // Uso do plano (mês do negócio, global)
      prisma.appointment.count({
        where: { ...planFilter, date: monthRange, status: { notIn: ['CANCELLED', 'NO_SHOW'] } }
      }),

      // Próximos agendamentos de hoje (pessoal para o profissional)
      prisma.appointment.findMany({
        where: {
          ...recentAppointmentFilter,
          date: {
            gte: new Date(),
            lte: todayEnd
          },
          status: {
            notIn: ['CANCELLED', 'NO_SHOW']
          }
        },
        include: {
          client: {
            select: {
              name: true
            }
          },
          service: {
            select: {
              name: true
            }
          },
          schedule: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          date: 'asc'
        },
        take: 5
      })
    ])

    return NextResponse.json({
      stats: {
        weekAppointments,
        monthAppointments,
        pendingWeek,
        confirmedWeek,
        planMonthAppointments
      },
      periods: {
        week: { from: periods.week.from, to: periods.week.to },
        month: { from: periods.month.from, to: periods.month.to },
        today: periods.today
      },
      recentAppointments: recentAppointments.map(apt => ({
        id: apt.id,
        patient: apt.client.name,
        time: formatInZone(apt.date, timeZone).time,
        status: apt.status,
        type: apt.service?.name || apt.specialty || 'Consulta',
        serviceName: apt.service?.name,
        scheduleName: apt.schedule?.name
      }))
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
