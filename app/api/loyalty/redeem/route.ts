import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { processLoyaltyRedeem } from '@/app/actions/loyalty'

export const dynamic = 'force-dynamic'

// POST - Resgatar pontos de fidelidade
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = (session.user as any).id
        const body = await request.json()
        const { clientId, points, appointmentId } = body

        if (!clientId || !points || points <= 0) {
            return NextResponse.json(
                { error: 'clientId e points (> 0) são obrigatórios' },
                { status: 400 }
            )
        }

        const result = await processLoyaltyRedeem(clientId, userId, points, appointmentId)

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error('Error redeeming loyalty points:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
