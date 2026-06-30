import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Retorna configuração do programa de fidelidade do Tenant
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = (session.user as any).id
        const config = await prisma.loyaltyConfig.findUnique({
            where: { userId }
        })

        // Buscar KPIs se existir config
        let stats = null
        if (config) {
            const [totalEarned, totalRedeemed, activeClients] = await Promise.all([
                prisma.loyaltyTransaction.aggregate({
                    where: { userId, type: 'EARN' },
                    _sum: { points: true }
                }),
                prisma.loyaltyTransaction.aggregate({
                    where: { userId, type: 'REDEEM' },
                    _sum: { points: true }
                }),
                prisma.loyaltyBalance.count({
                    where: { userId, currentBalance: { gt: 0 } }
                })
            ])

            stats = {
                totalPointsEarned: totalEarned._sum.points || 0,
                totalPointsRedeemed: totalRedeemed._sum.points || 0,
                activeClientsWithBalance: activeClients
            }
        }

        return NextResponse.json({ config, stats })
    } catch (error) {
        console.error('Error fetching loyalty config:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST - Criar novo programa de fidelidade
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = (session.user as any).id
        const body = await request.json()
        const { name, mode, pointsPerCurrency, pointsToReward, rewardValue } = body

        // Verificar se já existe
        const existing = await prisma.loyaltyConfig.findUnique({
            where: { userId }
        })

        if (existing) {
            return NextResponse.json({ error: 'Programa de fidelidade já existe. Use PUT para atualizar.' }, { status: 409 })
        }

        const config = await prisma.loyaltyConfig.create({
            data: {
                userId,
                name: name || 'Programa Fidelidade',
                mode: mode || 'FREQUENCY',
                pointsPerCurrency: pointsPerCurrency || 1.0,
                pointsToReward: pointsToReward || 10,
                rewardValue: rewardValue || 0,
                isActive: true
            }
        })

        return NextResponse.json(config, { status: 201 })
    } catch (error) {
        console.error('Error creating loyalty config:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PUT - Atualizar programa existente
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = (session.user as any).id
        const body = await request.json()
        const { name, mode, pointsPerCurrency, pointsToReward, rewardValue, isActive } = body

        const config = await prisma.loyaltyConfig.upsert({
            where: { userId },
            create: {
                userId,
                name: name || 'Programa Fidelidade',
                mode: mode || 'FREQUENCY',
                pointsPerCurrency: pointsPerCurrency || 1.0,
                pointsToReward: pointsToReward || 10,
                rewardValue: rewardValue || 0,
                isActive: isActive !== undefined ? isActive : true
            },
            update: {
                ...(name !== undefined && { name }),
                ...(mode !== undefined && { mode }),
                ...(pointsPerCurrency !== undefined && { pointsPerCurrency }),
                ...(pointsToReward !== undefined && { pointsToReward }),
                ...(rewardValue !== undefined && { rewardValue }),
                ...(isActive !== undefined && { isActive })
            }
        })

        return NextResponse.json(config)
    } catch (error) {
        console.error('Error updating loyalty config:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
