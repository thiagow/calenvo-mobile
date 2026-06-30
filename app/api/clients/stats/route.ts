
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Buscar estatísticas de clientes
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userRole = (session.user as any).role
    const masterId = (session.user as any).masterId

    // Início do mês
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    // Condições base para filtro de profissional
    let clientWhere: any = {}
    if (userRole === 'PROFESSIONAL' && masterId) {
      clientWhere.userId = masterId
      clientWhere.appointments = {
        some: {
          professionalId: userId
        }
      }
    } else {
      clientWhere.userId = userId
    }

    // Buscar estatísticas em paralelo
    const [
      totalClients,
      newClientsThisMonth,
      clients,
      loyaltyConfig
    ] = await Promise.all([
      // Total de clientes
      prisma.client.count({
        where: clientWhere
      }),

      // Novos clientes este mês
      prisma.client.count({
        where: {
          ...clientWhere,
          createdAt: {
            gte: monthStart
          }
        }
      }),

      // Buscar todos os clientes com contagem de agendamentos
      prisma.client.findMany({
        where: clientWhere,
        include: {
          _count: {
            select: {
              appointments: true
            }
          },
          loyaltyBalance: {
            where: { userId: userRole === 'PROFESSIONAL' && masterId ? masterId : userId },
            take: 1
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),

      // Verificar se o programa de fidelidade está ativo
      prisma.loyaltyConfig.findUnique({
        where: { userId: userRole === 'PROFESSIONAL' && masterId ? masterId : userId },
        select: { isActive: true }
      })
    ])

    // Calcular total de agendamentos
    const totalAppointments = clients.reduce((sum, client) => sum + client._count.appointments, 0)

    return NextResponse.json({
      stats: {
        totalClients,
        newClientsThisMonth,
        totalAppointments
      },
      loyaltyActive: loyaltyConfig?.isActive || false,
      clients: clients.map(client => ({
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        cpf: client.cpf,
        birthDate: client.birthDate,
        address: client.address,
        city: (client as any).city,
        state: (client as any).state,
        notes: client.notes,
        createdAt: client.createdAt,
        appointmentsCount: client._count.appointments,
        loyaltyPoints: (client.loyaltyBalance && client.loyaltyBalance.length > 0) ? client.loyaltyBalance[0].currentBalance : null
      }))
    })
  } catch (error) {
    console.error('Error fetching client stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
