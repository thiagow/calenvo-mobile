import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET - Lista extrato de transações de fidelidade
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = (session.user as any).id
        const { searchParams } = new URL(request.url)
        const clientId = searchParams.get('clientId')
        const limit = parseInt(searchParams.get('limit') || '50')

        const where: any = { userId }
        if (clientId) {
            where.clientId = clientId
        }

        const transactions = await prisma.loyaltyTransaction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                client: { select: { id: true, name: true } }
            }
        })

        return NextResponse.json(transactions)
    } catch (error) {
        console.error('Error fetching loyalty transactions:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
