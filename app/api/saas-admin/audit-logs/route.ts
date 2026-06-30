export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSaasAdmin } from '@/lib/saas-admin-guard'

/**
 * GET /api/saas-admin/audit-logs
 * Lista logs de auditoria administrativa com filtros e paginação
 */
export async function GET(req: NextRequest) {
    try {
        await requireSaasAdmin()

        const { searchParams } = new URL(req.url)

        // Paginação
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '50')
        const skip = (page - 1) * limit

        // Filtros
        const action = searchParams.get('action')
        const adminId = searchParams.get('adminId')
        const dateFrom = searchParams.get('dateFrom')
        const dateTo = searchParams.get('dateTo')

        // Construir where clause
        const where: any = {}

        if (action) {
            where.action = action
        }

        if (adminId) {
            where.adminId = adminId
        }

        if (dateFrom || dateTo) {
            where.createdAt = {}
            if (dateFrom) {
                where.createdAt.gte = new Date(dateFrom)
            }
            if (dateTo) {
                where.createdAt.lte = new Date(dateTo)
            }
        }

        const [logs, total] = await Promise.all([
            prisma.adminAuditLog.findMany({
                where,
                orderBy: {
                    createdAt: 'desc'
                },
                skip,
                take: limit
            }),
            prisma.adminAuditLog.count({ where })
        ])

        return NextResponse.json({
            logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        })
    } catch (error: any) {
        console.error('Error fetching audit logs:', error)

        if (error.message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        if (error.message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        return NextResponse.json(
            { error: 'Erro ao buscar logs de auditoria' },
            { status: 500 }
        )
    }
}
