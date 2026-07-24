export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSaasAdmin } from '@/lib/saas-admin-guard'
import { stripe } from '@/lib/stripe'
import bcrypt from 'bcryptjs'
import { SegmentType } from '@prisma/client'

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
                        appointments: { where: { deletedAt: null } },
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
        const { isActive, planType, isPaymentExempt, segmentTypes, reason } = body

        // Verificar se o tenant existe
        const tenant = await prisma.user.findUnique({
            where: { id },
            select: { role: true, email: true, name: true, planType: true, isActive: true, isPaymentExempt: true, segmentTypes: true }
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

        // Se estiver alterando a isenção de pagamento
        if (typeof isPaymentExempt === 'boolean' && isPaymentExempt !== tenant.isPaymentExempt) {
            dataToUpdate.isPaymentExempt = isPaymentExempt
            const exemptAction = isPaymentExempt ? 'TENANT_PAYMENT_EXEMPTED' : 'TENANT_PAYMENT_EXEMPTION_REVOKED'
            action = action ? `${action}_AND_${exemptAction}` : exemptAction
        }

        // Se estiver alterando os segmentos
        if (Array.isArray(segmentTypes)) {
            const validSegments = Object.values(SegmentType)
            if (
                segmentTypes.length === 0 ||
                !segmentTypes.every((s: string) => validSegments.includes(s as SegmentType))
            ) {
                return NextResponse.json(
                    { error: 'Segmentos inválidos' },
                    { status: 400 }
                )
            }

            const currentSorted = [...tenant.segmentTypes].sort().join(',')
            const nextSorted = [...segmentTypes].sort().join(',')
            if (currentSorted !== nextSorted) {
                dataToUpdate.segmentTypes = segmentTypes
                action = action ? `${action}_AND_SEGMENTS_CHANGED` : 'TENANT_SEGMENTS_CHANGED'
            }
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

            // Segmentos são uma propriedade do negócio como um todo — sincroniza
            // com todos os profissionais vinculados, igual à criação da conta.
            if (dataToUpdate.segmentTypes) {
                await tx.user.updateMany({
                    where: { masterId: id, role: 'PROFESSIONAL' },
                    data: { segmentTypes: dataToUpdate.segmentTypes }
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
                    newStatus: typeof isActive === 'boolean' ? isActive : tenant.isActive,
                    oldPaymentExempt: tenant.isPaymentExempt,
                    newPaymentExempt: typeof isPaymentExempt === 'boolean' ? isPaymentExempt : tenant.isPaymentExempt,
                    oldSegments: tenant.segmentTypes,
                    newSegments: dataToUpdate.segmentTypes || tenant.segmentTypes
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

/**
 * DELETE /api/saas-admin/tenants/[id]
 * Exclui um tenant permanentemente e todos os dados relacionados
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requireSaasAdmin()
        const { id } = params
        const body = await req.json()
        const { password } = body

        if (!password) {
            return NextResponse.json(
                { error: 'Senha é obrigatória' },
                { status: 400 }
            )
        }

        // Verificar a senha do admin logado
        const admin = await prisma.user.findUnique({
            where: { id: (session.user as any).id },
            select: { password: true }
        })

        if (!admin) {
            return NextResponse.json(
                { error: 'Admin não encontrado' },
                { status: 401 }
            )
        }

        const isPasswordValid = await bcrypt.compare(password, admin.password)
        if (!isPasswordValid) {
            return NextResponse.json(
                { error: 'Senha incorreta' },
                { status: 401 }
            )
        }

        // Verificar se o tenant existe e é um MASTER
        const tenant = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                role: true,
                email: true,
                name: true,
                businessName: true,
                planType: true,
                segmentTypes: true,
                stripeCustomerId: true,
                subscriptionId: true,
                isPaymentExempt: true
            }
        })

        if (!tenant || tenant.role !== 'MASTER') {
            return NextResponse.json(
                { error: 'Tenant não encontrado' },
                { status: 404 }
            )
        }

        // Tentar cancelar a assinatura Stripe (best-effort, não bloqueia a exclusão)
        if (
            tenant.stripeCustomerId &&
            tenant.subscriptionId &&
            !tenant.isPaymentExempt
        ) {
            try {
                await stripe.subscriptions.cancel(tenant.subscriptionId)
            } catch (stripeError: any) {
                console.error('Erro ao cancelar assinatura Stripe:', {
                    subscriptionId: tenant.subscriptionId,
                    error: stripeError.message
                })
            }
        }

        // Registrar log de auditoria com snapshot dos dados
        await prisma.adminAuditLog.create({
            data: {
                action: 'TENANT_DELETED',
                adminId: (session.user as any).id,
                targetId: id,
                details: {
                    email: tenant.email,
                    name: tenant.name,
                    businessName: tenant.businessName,
                    planType: tenant.planType,
                    segmentTypes: tenant.segmentTypes,
                    stripeCustomerId: tenant.stripeCustomerId,
                    subscriptionId: tenant.subscriptionId
                },
                ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined
            }
        })

        // Deletar o tenant (cascata automática remove todos os dados relacionados)
        await prisma.user.delete({
            where: { id }
        })

        return NextResponse.json({
            success: true,
            message: 'Tenant excluído permanentemente'
        })
    } catch (error: any) {
        console.error('Error deleting tenant:', error)

        if (error.message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        if (error.message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        return NextResponse.json(
            { error: 'Erro ao excluir tenant' },
            { status: 500 }
        )
    }
}
