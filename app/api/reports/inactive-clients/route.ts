
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Buscar clientes inativos (sem agendamentos há X dias)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = (session.user as any).id

        // Get filter parameters
        const { searchParams } = new URL(request.url)
        const inactiveDays = parseInt(searchParams.get('inactiveDays') || '30')

        // Data de corte para considerar inativo
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - inactiveDays)

        // Buscar todos os clientes do usuário
        const allClients = await prisma.client.findMany({
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
                    orderBy: {
                        date: 'desc'
                    },
                    take: 1,
                    select: {
                        date: true
                    }
                },
                _count: {
                    select: {
                        appointments: true
                    }
                }
            }
        })

        // Filtrar clientes inativos
        const inactiveClients = allClients
            .map(client => {
                const lastAppointment = client.appointments[0]
                const lastAppointmentDate = lastAppointment ? lastAppointment.date : null
                const totalAppointments = client._count.appointments

                // Calcular dias desde o último agendamento
                let daysSinceLastVisit: number

                if (lastAppointmentDate) {
                    const diffTime = new Date().getTime() - new Date(lastAppointmentDate).getTime()
                    daysSinceLastVisit = Math.floor(diffTime / (1000 * 60 * 60 * 24))
                } else {
                    // Cliente nunca agendou - calcular desde o cadastro
                    const diffTime = new Date().getTime() - new Date(client.createdAt).getTime()
                    daysSinceLastVisit = Math.floor(diffTime / (1000 * 60 * 60 * 24))
                }

                return {
                    clientId: client.id,
                    clientName: client.name,
                    clientPhone: client.phone,
                    clientEmail: client.email,
                    lastAppointmentDate: lastAppointmentDate ? lastAppointmentDate.toISOString() : null,
                    daysSinceLastVisit,
                    totalAppointments,
                    neverScheduled: totalAppointments === 0
                }
            })
            .filter(client => client.daysSinceLastVisit >= inactiveDays)
            .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit)

        // Calcular estatísticas
        const totalClients = allClients.length
        const totalInactive = inactiveClients.length
        const inactivePercentage = totalClients > 0
            ? Math.round((totalInactive / totalClients) * 100)
            : 0

        const averageDaysInactive = inactiveClients.length > 0
            ? Math.round(
                inactiveClients.reduce((sum, c) => sum + c.daysSinceLastVisit, 0) / inactiveClients.length
            )
            : 0

        const neverScheduledCount = inactiveClients.filter(c => c.neverScheduled).length

        return NextResponse.json({
            stats: {
                totalInactive,
                totalClients,
                inactivePercentage,
                averageDaysInactive,
                neverScheduledCount
            },
            inactiveClients,
            filter: {
                inactiveDays,
                cutoffDate: cutoffDate.toISOString()
            }
        })
    } catch (error) {
        console.error('Error fetching inactive clients:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
