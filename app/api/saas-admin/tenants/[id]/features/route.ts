export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSaasAdmin } from '@/lib/saas-admin-guard'
import { tenantFeatureUpdateSchema, zodMessage } from '@/lib/finance/schemas'
import { readJson } from '@/lib/finance/http'

/**
 * PUT /api/saas-admin/tenants/[id]/features — libera ou revoga o direito de
 * uso de um módulo opcional. Revogar não apaga dados do tenant: o módulo só
 * deixa de agir e de aparecer; liberar de novo devolve tudo como estava.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  let session
  try {
    session = await requireSaasAdmin()
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return message === 'FORBIDDEN'
      ? NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      : NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const parsed = tenantFeatureUpdateSchema.safeParse(await readJson(req))
  if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 })
  const { feature, enabled, reason } = parsed.data

  try {
    const tenant = await prisma.user.findUnique({
      where: { id: params.id },
      select: { role: true, email: true, name: true }
    })
    if (!tenant || tenant.role !== 'MASTER') {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }

    const adminId = (session.user as { id?: string }).id ?? 'unknown'

    const entitlement = await prisma.$transaction(async (tx) => {
      const current = await tx.tenantFeature.findUnique({
        where: { userId_feature: { userId: params.id, feature } }
      })

      const result = enabled
        ? await tx.tenantFeature.upsert({
            where: { userId_feature: { userId: params.id, feature } },
            // Um add-on pago ativo continua sendo a origem; o admin só reativa.
            update: {
              status: 'ACTIVE',
              expiresAt: null,
              ...(!(current?.source === 'ADDON' && current.status === 'ACTIVE') && { source: 'GRANT' })
            },
            create: { userId: params.id, feature, source: 'GRANT', status: 'ACTIVE' }
          })
        : current
          ? await tx.tenantFeature.update({ where: { id: current.id }, data: { status: 'CANCELED' } })
          : null

      await tx.adminAuditLog.create({
        data: {
          action: enabled ? 'TENANT_FEATURE_GRANTED' : 'TENANT_FEATURE_REVOKED',
          adminId,
          targetId: params.id,
          details: {
            feature,
            reason: reason || 'Sem motivo especificado',
            tenantEmail: tenant.email,
            tenantName: tenant.name,
            previousStatus: current?.status ?? null,
            previousSource: current?.source ?? null
          },
          ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined
        }
      })

      return result
    })

    return NextResponse.json({
      feature: entitlement
        ? { feature: entitlement.feature, status: entitlement.status, source: entitlement.source }
        : { feature, status: 'CANCELED', source: null }
    })
  } catch (error) {
    console.error('[saas-admin] feature update failed:', error)
    return NextResponse.json({ error: 'Erro ao atualizar módulo' }, { status: 500 })
  }
}
