
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { PLAN_CONFIGS } from '@/lib/types'

export const dynamic = 'force-dynamic'

// GET - Buscar estatísticas de uso do plano atual
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userRole = (session.user as any).role
    
    // Get user's info and master's info if needed
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { planType: true, masterId: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Determine target userId for global stats
    const targetUserId = userRole === 'PROFESSIONAL' ? (user.masterId || userId) : userId

    // Count appointments this month (GLOBAL)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const appointmentsThisMonth = await prisma.appointment.count({
      where: {
        userId: targetUserId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    })

    const planConfig = PLAN_CONFIGS[user.planType]
    const usagePercentage = planConfig.monthlyLimit === -1 
      ? 0 
      : Math.min(Math.round((appointmentsThisMonth / planConfig.monthlyLimit) * 100), 100)

    return NextResponse.json({
      appointmentsThisMonth,
      monthlyLimit: planConfig.monthlyLimit,
      usagePercentage,
      planType: user.planType,
      userLimit: planConfig.userLimit
    })
  } catch (error) {
    console.error('Error fetching plan usage:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
