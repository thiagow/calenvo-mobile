export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSaasAdmin } from '@/lib/saas-admin-guard'
import { getPlanPrice } from '@/lib/types'

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
            payingTenantsByPlan,
            tenantSegments
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
                    },
                    deletedAt: null
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
            // Distribuição por plano (todos os tenants, informativo)
            prisma.user.groupBy({
                by: ['planType'],
                where: { role: 'MASTER' },
                _count: true
            }),
            // Distribuição por plano/intervalo de cobrança só de contas pagantes
            // (base do cálculo de receita — contas isentas não contribuem, e o
            // preço anual precisa ser diferenciado do mensal)
            prisma.user.groupBy({
                by: ['planType', 'billingInterval'],
                where: { role: 'MASTER', isPaymentExempt: false },
                _count: true
            }),
            // Distribuição por segmento (contagem em memória: segmentTypes é array, não dá pra usar groupBy)
            prisma.user.findMany({
                where: { role: 'MASTER' },
                select: { segmentTypes: true }
            })
        ])

        const segmentCounts = new Map<string, number>()
        for (const { segmentTypes } of tenantSegments) {
            for (const segment of segmentTypes) {
                segmentCounts.set(segment, (segmentCounts.get(segment) || 0) + 1)
            }
        }
        const tenantsBySegment = Array.from(segmentCounts.entries()).map(([segmentType, count]) => ({ segmentType, _count: count }))

        // Calcular receita mensal estimada (só contas pagantes, exclui isentas,
        // e usa o preço mensal equivalente correto para cobrança anual)
        const monthlyRevenue = payingTenantsByPlan.reduce((total, group) => {
            if (!group.planType) return total
            const price = getPlanPrice(group.planType, group.billingInterval ?? 'MONTHLY', 'BRL')
            return total + (price * group._count)
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
