
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { AppointmentStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

// GET - Buscar LTV (Lifetime Value) dos clientes
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = (session.user as any).id

        // Buscar todos os clientes com seus agendamentos completados
        const clients = await prisma.client.findMany({
            where: {
                userId
            },
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                createdAt: true,
                appointments: {
                    where: {
                        status: AppointmentStatus.COMPLETED,
                        price: {
                            not: null
                        }
                    },
                    select: {
                        price: true,
                        date: true
                    },
                    orderBy: {
                        date: 'asc'
                    }
                }
            }
        })

        // Calcular LTV por cliente
        const clientsWithLTV = clients
            .map(client => {
                const completedAppointments = client.appointments
                const totalVisits = completedAppointments.length

                // Calcular LTV (soma de todos os preços)
                const ltv = completedAppointments.reduce((sum, apt) => {
                    return sum + (apt.price || 0)
                }, 0)

                // Calcular ticket médio
                const averageTicket = totalVisits > 0 ? ltv / totalVisits : 0

                // Calcular frequência (visitas por mês)
                let averageFrequency = 0
                if (totalVisits > 0 && completedAppointments.length > 0) {
                    const firstVisit = new Date(completedAppointments[0].date)
                    const lastVisit = new Date(completedAppointments[completedAppointments.length - 1].date)
                    const monthsDiff = Math.max(1,
                        (lastVisit.getFullYear() - firstVisit.getFullYear()) * 12 +
                        (lastVisit.getMonth() - firstVisit.getMonth())
                    )
                    averageFrequency = totalVisits / monthsDiff
                }

                return {
                    clientId: client.id,
                    clientName: client.name,
                    clientPhone: client.phone,
                    clientEmail: client.email,
                    ltv,
                    averageTicket,
                    totalVisits,
                    firstVisit: completedAppointments.length > 0
                        ? completedAppointments[0].date.toISOString()
                        : null,
                    lastVisit: completedAppointments.length > 0
                        ? completedAppointments[completedAppointments.length - 1].date.toISOString()
                        : null,
                    averageFrequency
                }
            })
            .filter(client => client.ltv > 0) // Apenas clientes com receita

        // Calcular estatísticas globais
        const totalRevenue = clientsWithLTV.reduce((sum, c) => sum + c.ltv, 0)
        const totalClientsWithRevenue = clientsWithLTV.length
        const averageLTV = totalClientsWithRevenue > 0
            ? totalRevenue / totalClientsWithRevenue
            : 0

        const averageTicket = clientsWithLTV.length > 0
            ? clientsWithLTV.reduce((sum, c) => sum + c.averageTicket, 0) / clientsWithLTV.length
            : 0

        const averageFrequency = clientsWithLTV.length > 0
            ? clientsWithLTV.reduce((sum, c) => sum + c.averageFrequency, 0) / clientsWithLTV.length
            : 0

        // Top 10 clientes por LTV
        const topClients = clientsWithLTV
            .sort((a, b) => b.ltv - a.ltv)
            .slice(0, 10)

        return NextResponse.json({
            globalStats: {
                averageLTV: Math.round(averageLTV * 100) / 100,
                averageTicket: Math.round(averageTicket * 100) / 100,
                averageFrequency: Math.round(averageFrequency * 100) / 100,
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                totalClientsWithRevenue
            },
            topClients: topClients.map(c => ({
                ...c,
                ltv: Math.round(c.ltv * 100) / 100,
                averageTicket: Math.round(c.averageTicket * 100) / 100,
                averageFrequency: Math.round(c.averageFrequency * 100) / 100
            }))
        })
    } catch (error) {
        console.error('Error fetching LTV data:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
