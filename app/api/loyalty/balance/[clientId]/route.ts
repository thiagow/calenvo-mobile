import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Retorna saldo de fidelidade de um cliente
export async function GET(
    request: NextRequest,
    { params }: { params: { clientId: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = (session.user as any).id

        const balance = await prisma.loyaltyBalance.findUnique({
            where: {
                clientId_userId: {
                    clientId: params.clientId,
                    userId
                }
            }
        })

        return NextResponse.json({
            clientId: params.clientId,
            totalEarned: balance?.totalEarned || 0,
            totalRedeemed: balance?.totalRedeemed || 0,
            currentBalance: balance?.currentBalance || 0
        })
    } catch (error) {
        console.error('Error fetching loyalty balance:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
