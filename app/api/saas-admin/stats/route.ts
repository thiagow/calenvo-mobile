export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSaasAdmin } from '@/lib/saas-admin-guard'
import { PLAN_CONFIGS } from '@/lib/types'

/**
 * GET /api/saas-admin/stats
 * Retorna métricas globais do SaaS
 */
export async function GET(req: NextRequest) {
    try {
        await requireSaasAdmin()

        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        // Buscar estatísticas em paralelo
        const [
            totalTenants,
            activeTenants,
            totalProfessionals,
            appointmentsThisMonth,
            newTenantsLast30Days,
            tenantsByPlan,
            tenantsBySegment
        ] = await Promise.all([
            // Total de tenants
            prisma.user.count({
                where: { role: 'MASTER' }
            }),
            // Tenants ativos
            prisma.user.count({
                where: { role: 'MASTER', isActive: true }
            }),
            // Total de profissionais
            prisma.user.count({
                where: { role: 'PROFESSIONAL' }
            }),
            // Agendamentos do mês atual
            prisma.appointment.count({
                where: {
                    createdAt: {
                        gte: firstDayOfMonth
                    }
                }
            }),
            // Novos tenants nos últimos 30 dias
            prisma.user.count({
                where: {
                    role: 'MASTER',
                    createdAt: {
                        gte: thirtyDaysAgo
                    }
                }
            }),
            // Distribuição por plano
            prisma.user.groupBy({
                by: ['planType'],
                where: { role: 'MASTER' },
                _count: true
            }),
            // Distribuição por segmento
            prisma.user.groupBy({
                by: ['segmentType'],
                where: { role: 'MASTER' },
                _count: true
            })
        ])

        // Calcular receita mensal estimada
        const monthlyRevenue = tenantsByPlan.reduce((total, group) => {
            const planConfig = PLAN_CONFIGS[group.planType as keyof typeof PLAN_CONFIGS]
            return total + (planConfig.price * group._count)
        }, 0)

        return NextResponse.json({
            overview: {
                totalTenants,
                activeTenants,
                inactiveTenants: totalTenants - activeTenants,
                totalProfessionals,
                appointmentsThisMonth,
                newTenantsLast30Days,
                monthlyRevenue
            },
            distribution: {
                byPlan: tenantsByPlan.map(group => ({
                    plan: group.planType,
                    count: group._count
                })),
                bySegment: tenantsBySegment.map(group => ({
                    segment: group.segmentType,
                    count: group._count
                }))
            }
        })
    } catch (error: any) {
        console.error('Error fetching stats:', error)

        if (error.message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        if (error.message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        return NextResponse.json(
            { error: 'Erro ao buscar estatísticas' },
            { status: 500 }
        )
    }
}
