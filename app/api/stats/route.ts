
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endOfToday = new Date(today)
    endOfToday.setHours(23, 59, 59, 999)

    // Get start of week (Monday)
    const startOfWeek = new Date(today)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
    startOfWeek.setDate(diff)
    startOfWeek.setHours(0, 0, 0, 0)
    
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    // Count today's appointments
    const todayAppointments = await prisma.appointment.count({
      where: {
        userId: userId,
        date: {
          gte: today,
          lte: endOfToday
        }
      }
    })

    // Count this week's appointments
    const thisWeekAppointments = await prisma.appointment.count({
      where: {
        userId: userId,
        date: {
          gte: startOfWeek,
          lte: endOfWeek
        }
      }
    })

    // Count total clients
    const totalClients = await prisma.client.count({
      where: {
        userId: userId
      }
    })

    // Count appointments by status
    const appointmentsByStatus = await prisma.appointment.groupBy({
      by: ['status'],
      where: {
        userId: userId
      },
      _count: {
        id: true
      }
    })

    const stats = {
      todayAppointments,
      thisWeekAppointments,
      totalClients,
      appointmentsByStatus: appointmentsByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.id
        return acc
      }, {} as Record<string, number>)
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
