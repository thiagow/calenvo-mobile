export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionScope } from '@/lib/session-scope'
import {
  REACTIVATION_RULES,
  bookingLink,
  countByBucket,
  getConversionStats,
  listReactivationItems,
} from '@/lib/reactivation-service'

/**
 * Lista de retorno completa (as três faixas) — a tela filtra por aba no
 * client, então trocar de aba não faz nova requisição.
 */
export async function GET() {
  try {
    const { scope, error } = await getSessionScope()
    if (error) return error

    const [items, conversion, servicesWithInterval, whatsApp, owner] = await Promise.all([
      listReactivationItems(scope),
      getConversionStats(scope.tenantId),
      prisma.service.count({ where: { userId: scope.tenantId, returnIntervalDays: { not: null } } }),
      scope.isMaster
        ? prisma.whatsAppConfig.findUnique({ where: { userId: scope.tenantId }, select: { isConnected: true } })
        : null,
      prisma.user.findUnique({
        where: { id: scope.tenantId },
        select: { businessName: true, name: true, businessConfig: { select: { publicUrl: true } } },
      }),
    ])

    return NextResponse.json({
      items,
      counts: countByBucket(items),
      conversion,
      servicesWithInterval,
      canSend: scope.isMaster,
      whatsAppConnected: !!whatsApp?.isConnected,
      cooldownDays: REACTIVATION_RULES.RESEND_COOLDOWN_DAYS,
      maxItemsPerSend: REACTIVATION_RULES.MAX_ITEMS_PER_SEND,
      // Para a prévia no navegador renderizar exatamente o texto que será enviado
      businessName: owner?.businessName || owner?.name || '',
      bookingLink: bookingLink(scope.tenantId, owner?.businessConfig?.publicUrl),
    })
  } catch (error) {
    console.error('[reactivation] GET failed:', error)
    return NextResponse.json({ error: 'Erro ao carregar lista de retorno' }, { status: 500 })
  }
}
