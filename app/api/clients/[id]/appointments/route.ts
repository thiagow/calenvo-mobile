
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
        const clientId = params.id

        // Verificar se o cliente pertence ao usuário
        const client = await prisma.client.findFirst({
            where: {
                id: clientId,
                userId: userId
            },
            select: {
                id: true,
                name: true,
                phone: true,
                email: true
            }
        })

        if (!client) {
            return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
        }

        // Query params para filtros
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')

        const whereConditions: any = {
            clientId: clientId,
            userId: userId
        }

        if (status && status !== 'all') {
            whereConditions.status = status
        }

        const appointments = await prisma.appointment.findMany({
            where: whereConditions,
            include: {
                service: {
                    select: {
                        name: true,
                        duration: true,
                        price: true
                    }
                },
                professionalUser: {
                    select: {
                        id: true,
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
                date: 'desc'
            }
        })

        const transformedAppointments = appointments.map(apt => ({
            id: apt.id,
            date: apt.date,
            duration: apt.duration,
            status: apt.status,
            modality: apt.modality,
            serviceName: apt.service?.name || apt.specialty || 'Não especificado',
            professionalName: apt.professionalUser?.name || apt.professional || 'Não definido',
            scheduleName: apt.schedule?.name || null,
            price: apt.price || apt.service?.price || null,
            notes: apt.notes
        }))

        return NextResponse.json({
            client,
            appointments: transformedAppointments,
            total: transformedAppointments.length
        })
    } catch (error) {
        console.error('Error fetching client appointments:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
