
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { AppointmentStatus } from '@prisma/client'

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

    // Data de hoje (início e fim)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    // Início da semana (domingo)
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    // Início do mês
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    // Definir filtros baseados no role
    // For general dashboard stats, professional sees the global ecosystem data
    // to match the master/manager view as requested
    const appointmentFilter = { userId: masterId }

    const clientFilter = { userId: masterId }

    // This filter is for the "Recent Appointments" list - we'll keep this PERSONAL
    // so the professional still sees their own upcoming work
    const recentAppointmentFilter = userRole === 'PROFESSIONAL'
      ? { professionalId: userId }
      : { userId }

    // This filter is SPECIFICALLY for plan usage calculation (global ecosystem)
    const globalAppointmentFilter = { userId: masterId }

    // Buscar estatísticas em paralelo
    const [
      todayAppointments,
      weekAppointments,
      monthAppointments,
      totalClients,
      pendingAppointments,
      completedAppointments,
      recentAppointments
    ] = await Promise.all([
      // Agendamentos de hoje
      prisma.appointment.count({
        where: {
          ...appointmentFilter,
          date: {
            gte: todayStart,
            lte: todayEnd
          },
          status: {
            notIn: ['CANCELLED', 'NO_SHOW']
          }
        }
      }),

      // Agendamentos desta semana
      prisma.appointment.count({
        where: {
          ...appointmentFilter,
          date: {
            gte: weekStart,
            lte: todayEnd
          },
          status: {
            notIn: ['CANCELLED', 'NO_SHOW']
          }
        }
      }),

      // Agendamentos deste mês (GLOBAL for plan usage)
      prisma.appointment.count({
        where: {
          ...globalAppointmentFilter,
          date: {
            gte: monthStart
          },
          status: {
            notIn: ['CANCELLED', 'NO_SHOW']
          }
        }
      }),

      // Total de clientes/pacientes
      prisma.client.count({
        where: clientFilter
      }),

      // Agendamentos pendentes (aguardando confirmação)
      prisma.appointment.count({
        where: {
          ...appointmentFilter,
          status: 'SCHEDULED',
          date: {
            gte: todayStart
          }
        }
      }),

      // Total de agendamentos completados
      prisma.appointment.count({
        where: {
          ...appointmentFilter,
          status: 'COMPLETED'
        }
      }),

      // Próximos agendamentos de hoje (KEEP PERSONAL for professional)
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
        todayAppointments,
        weekAppointments,
        monthAppointments,
        totalClients,
        pendingAppointments,
        completedAppointments
      },
      recentAppointments: recentAppointments.map(apt => ({
        id: apt.id,
        patient: apt.client.name,
        time: apt.date.toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
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
