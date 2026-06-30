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

        // Verificar se cliente pertence ao usuário
        const client = await prisma.client.findFirst({
            where: { id: clientId, userId }
        })

        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 })
        }

        // Buscar pacotes
        const packages = await prisma.clientPackage.findMany({
            where: {
                clientId: clientId,
                userId: userId
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                items: {
                    include: {
                        service: true
                    }
                }
            }
        })

        const formattedPackages = packages.map(pkg => ({
            id: pkg.id,
            name: pkg.name,
            price: pkg.price,
            status: pkg.status,
            createdAt: pkg.createdAt,
            items: pkg.items.map(item => ({
                id: item.id,
                serviceId: item.serviceId,
                serviceName: item.service?.name || 'Serviço excluído',
                totalSessions: item.totalSessions,
                usedSessions: item.usedSessions
            }))
        }))

        return NextResponse.json({
            packages: formattedPackages,
            // The frontend component originally called /api/clients/[id] to get { client }, 
            // so we return it here alongside or as a fallback
            client: {
                id: client.id,
                name: client.name,
                phone: client.phone,
                email: client.email
            }
        })
    } catch (error) {
        console.error('Error fetching client packages:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
