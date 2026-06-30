export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSaasAdmin } from '@/lib/saas-admin-guard'

/**
 * GET /api/saas-admin/tenants
 * Lista todos os donos de negócio (MASTER) com filtros e paginação
 */
export async function GET(req: NextRequest) {
    try {
        await requireSaasAdmin()

        const { searchParams } = new URL(req.url)

        // Paginação
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const skip = (page - 1) * limit

        // Filtros
        const planType = searchParams.get('planType')
        const segmentType = searchParams.get('segmentType')
        const isActive = searchParams.get('isActive')
        const search = searchParams.get('search')

        // Construir where clause
        const where: any = {
            role: 'MASTER'
        }

        if (planType) {
            where.planType = planType
        }

        if (segmentType) {
            where.segmentType = segmentType
        }

        if (isActive !== null && isActive !== undefined) {
            where.isActive = isActive === 'true'
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { businessName: { contains: search, mode: 'insensitive' } }
            ]
        }

        // Buscar tenants com contagem de profissionais
        const [tenants, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    businessName: true,
                    segmentType: true,
                    planType: true,
                    isActive: true,
                    createdAt: true,
                    stripeCustomerId: true,
                    _count: {
                        select: {
                            professionals: true
                        }
                    }
                },
                skip,
                take: limit,
                orderBy: {
                    createdAt: 'desc'
                }
            }),
            prisma.user.count({ where })
        ])

        return NextResponse.json({
            tenants,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        })
    } catch (error: any) {
        console.error('Error fetching tenants:', error)

        if (error.message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        if (error.message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        return NextResponse.json(
            { error: 'Erro ao buscar tenants' },
            { status: 500 }
        )
    }
}
