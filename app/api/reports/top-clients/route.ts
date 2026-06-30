
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { AppointmentStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

// GET - Buscar ranking de clientes com mais agendamentos
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = (session.user as any).id

        // Get filter parameters
        const { searchParams } = new URL(request.url)
        const period = searchParams.get('period') || 'current_month' // current_month | previous_month | custom
        const startDateParam = searchParams.get('startDate')
        const endDateParam = searchParams.get('endDate')
        const limit = parseInt(searchParams.get('limit') || '10')

        // Calculate date range based on period
        let startDate: Date
        let endDate: Date

        if (period === 'custom' && startDateParam && endDateParam) {
            startDate = new Date(startDateParam)
            endDate = new Date(endDateParam)
            endDate.setHours(23, 59, 59, 999)
        } else if (period === 'previous_month') {
            const now = new Date()
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
            endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
        } else {
            // current_month (default)
            const now = new Date()
            startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        }

        // Buscar todos os agendamentos do período
        const appointments = await prisma.appointment.findMany({
            where: {
                userId,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            select: {
                clientId: true,
                status: true,
                client: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        email: true
                    }
                }
            }
        })

        // Agrupar por cliente e contar por status (agrupando pelo nome para evitar duplicação de cadastros do mesmo cliente)
        const clientStats = new Map<string, {
            clientId: string
            clientName: string
            clientPhone: string
            clientEmail: string | null
            total: number
            completed: number
            cancelled: number
            noShow: number
        }>()

        appointments.forEach(apt => {
            const clientKey = apt.client.name.toLowerCase().trim()

            const existing = clientStats.get(clientKey) || {
                clientId: apt.clientId, // Mantém o ID do primeiro registro encontrado do cliente
                clientName: apt.client.name, // Nome original do primeiro registro
                clientPhone: apt.client.phone,
                clientEmail: apt.client.email,
                total: 0,
                completed: 0,
                cancelled: 0,
                noShow: 0
            }

            existing.total++

            if (apt.status === AppointmentStatus.COMPLETED) {
                existing.completed++
            } else if (apt.status === AppointmentStatus.CANCELLED) {
                existing.cancelled++
            } else if (apt.status === AppointmentStatus.NO_SHOW) {
                existing.noShow++
            }

            clientStats.set(clientKey, existing)
        })

        // Converter para array e calcular taxa de presença
        const topClients = Array.from(clientStats.values())
            .map(client => ({
                ...client,
                completionRate: client.total > 0
                    ? Math.round((client.completed / client.total) * 100)
                    : 0
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, limit)

        return NextResponse.json({
            period: {
                type: period,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                label: period === 'custom'
                    ? `${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}`
                    : period === 'previous_month'
                        ? startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                        : startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
            },
            topClients
        })
    } catch (error) {
        console.error('Error fetching top clients:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
