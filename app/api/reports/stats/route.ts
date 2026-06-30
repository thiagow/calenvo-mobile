
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { AppointmentStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

// GET - Buscar estatísticas para relatórios
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Get filter parameters
    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month') // Format: "YYYY-MM"

    // Calculate date range
    let startDate: Date
    let endDate: Date
    let periodLabel: string

    if (monthParam) {
      // Use selected month
      const [year, month] = monthParam.split('-').map(Number)
      startDate = new Date(year, month - 1, 1, 0, 0, 0, 0)
      endDate = new Date(year, month, 0, 23, 59, 59, 999)
      periodLabel = startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    } else {
      // Default to current month
      const now = new Date()
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      periodLabel = startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    }

    // Date filter for all queries
    const dateFilter = {
      date: {
        gte: startDate,
        lte: endDate
      }
    }

    // Total de agendamentos
    const totalAppointments = await prisma.appointment.count({
      where: {
        userId,
        ...dateFilter
      }
    })

    // Confirmados
    const confirmedAppointments = await prisma.appointment.count({
      where: {
        userId,
        status: 'CONFIRMED',
        ...dateFilter
      }
    })

    // Cancelados
    const cancelledAppointments = await prisma.appointment.count({
      where: {
        userId,
        status: 'CANCELLED',
        ...dateFilter
      }
    })

    // Faltou (NO_SHOW)
    const noShowAppointments = await prisma.appointment.count({
      where: {
        userId,
        status: 'NO_SHOW',
        ...dateFilter
      }
    })

    // Agendamentos por serviço
    const appointmentsByService = await prisma.appointment.groupBy({
      by: ['serviceId'],
      where: {
        userId,
        serviceId: {
          not: null
        },
        ...dateFilter
      },
      _count: {
        id: true
      }
    })

    // Buscar nomes dos serviços
    const serviceIds = appointmentsByService.map(item => item.serviceId).filter(id => id !== null) as string[]
    const services = await prisma.service.findMany({
      where: {
        id: {
          in: serviceIds
        }
      },
      select: {
        id: true,
        name: true
      }
    })

    const serviceMap = new Map(services.map(s => [s.id, s.name]))

    const servicesStats = appointmentsByService.map(item => ({
      serviceName: item.serviceId ? serviceMap.get(item.serviceId) || 'Serviço Desconhecido' : 'Não especificado',
      count: item._count.id,
      percentage: totalAppointments > 0 ? Math.round((item._count.id / totalAppointments) * 100) : 0
    }))

    // Evolução mensal (últimos 6 meses incluindo o mês selecionado/atual)
    const evolutionStartDate = new Date(startDate)
    evolutionStartDate.setMonth(evolutionStartDate.getMonth() - 5)
    evolutionStartDate.setDate(1)
    evolutionStartDate.setHours(0, 0, 0, 0)

    const monthlyData = await prisma.appointment.groupBy({
      by: ['date'],
      where: {
        userId,
        date: {
          gte: evolutionStartDate,
          lte: endDate
        }
      },
      _count: {
        id: true
      }
    })

    // Agrupar por mês
    const monthlyStats = new Map<string, number>()
    monthlyData.forEach(item => {
      const monthKey = `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, '0')}`
      monthlyStats.set(monthKey, (monthlyStats.get(monthKey) || 0) + item._count.id)
    })

    // Gerar últimos 6 meses com dados (ordem decrescente - mais recente primeiro)
    const evolutionData = []
    for (let i = 0; i <= 5; i++) {
      const date = new Date(startDate)
      date.setMonth(date.getMonth() - i)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const count = monthlyStats.get(monthKey) || 0

      evolutionData.push({
        month: date.toLocaleDateString('pt-BR', { month: 'long' }),
        appointments: count
      })
    }

    return NextResponse.json({
      period: {
        label: periodLabel,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      mainStats: {
        total: totalAppointments,
        confirmed: confirmedAppointments,
        cancelled: cancelledAppointments,
        noShow: noShowAppointments
      },
      servicesStats: servicesStats.sort((a, b) => b.count - a.count).slice(0, 5), // Top 5
      evolutionData
    })
  } catch (error) {
    console.error('Error fetching report stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
