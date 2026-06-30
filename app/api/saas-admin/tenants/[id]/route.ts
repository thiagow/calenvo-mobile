export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSaasAdmin } from '@/lib/saas-admin-guard'

/**
 * GET /api/saas-admin/tenants/[id]
 * Retorna detalhes completos de um tenant específico
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await requireSaasAdmin()

        const { id } = params

        const tenant = await prisma.user.findUnique({
            where: { id },
            include: {
                businessConfig: true,
                professionals: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        isActive: true,
                        createdAt: true
                    }
                },
                _count: {
                    select: {
                        appointments: true,
                        clients: true,
                        services: true,
                        schedules: true
                    }
                }
            }
        })

        if (!tenant || tenant.role !== 'MASTER') {
            return NextResponse.json(
                { error: 'Tenant não encontrado' },
                { status: 404 }
            )
        }

        return NextResponse.json({ tenant })
    } catch (error: any) {
        console.error('Error fetching tenant details:', error)

        if (error.message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        if (error.message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        return NextResponse.json(
            { error: 'Erro ao buscar detalhes do tenant' },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/saas-admin/tenants/[id]
 * Bloqueia ou desbloqueia um tenant (MASTER + seus profissionais)
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requireSaasAdmin()
        const { id } = params
        const body = await req.json()
        const { isActive, planType, reason } = body

        // Verificar se o tenant existe
        const tenant = await prisma.user.findUnique({
            where: { id },
            select: { role: true, email: true, name: true, planType: true, isActive: true }
        })

        if (!tenant || tenant.role !== 'MASTER') {
            return NextResponse.json(
                { error: 'Tenant não encontrado' },
                { status: 404 }
            )
        }

        const dataToUpdate: any = {}
        let action = ''

        // Se estiver alterando o status ativo/inativo
        if (typeof isActive === 'boolean' && isActive !== tenant.isActive) {
            dataToUpdate.isActive = isActive
            action = isActive ? 'TENANT_UNBLOCKED' : 'TENANT_BLOCKED'
        }

        // Se estiver alterando o plano
        if (planType && planType !== tenant.planType) {
            dataToUpdate.planType = planType
            action = action ? `${action}_AND_PLAN_CHANGED` : 'TENANT_PLAN_CHANGED'
        }

        if (Object.keys(dataToUpdate).length === 0) {
            return NextResponse.json(
                { error: 'Nenhuma alteração solicitada' },
                { status: 400 }
            )
        }

        // Atualizar MASTER e todos os seus profissionais (somente status isActive afeta profissionais)
        await prisma.$transaction(async (tx) => {
            // Atualizar MASTER
            await tx.user.update({
                where: { id },
                data: dataToUpdate
            })

            // Se isActive foi alterado, atualizar todos os profissionais também
            if (typeof isActive === 'boolean') {
                await tx.user.updateMany({
                    where: { masterId: id },
                    data: { isActive }
                })
            }
        })

        // Registrar log de auditoria
        await prisma.adminAuditLog.create({
            data: {
                action: action,
                adminId: (session.user as any).id,
                targetId: id,
                details: {
                    reason: reason || 'Sem motivo especificado',
                    tenantEmail: tenant.email,
                    tenantName: tenant.name,
                    oldPlan: tenant.planType,
                    newPlan: planType || tenant.planType,
                    oldStatus: tenant.isActive,
                    newStatus: typeof isActive === 'boolean' ? isActive : tenant.isActive
                },
                ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined
            }
        })

        return NextResponse.json({
            success: true,
            message: 'Cliente atualizado com sucesso'
        })
    } catch (error: any) {
        console.error('Error updating tenant:', error)

        if (error.message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        if (error.message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        return NextResponse.json(
            { error: 'Erro ao atualizar status do tenant' },
            { status: 500 }
        )
    }
}
