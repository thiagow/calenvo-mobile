export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resolveTenantBySlug } from '@/lib/tenant-resolver'

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' }

/**
 * GET /api/widget/[slug]/config — dados públicos e não-sensíveis para
 * renderizar o widget (nome do negócio, mensagem de boas-vindas, cor, se
 * está habilitado). Sem autenticação — é consumido pelo próprio iframe.
 */
export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const tenant = await resolveTenantBySlug(params.slug)
  if (!tenant) {
    return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404, headers: CORS_HEADERS })
  }

  const widgetConfig = await prisma.chatWidgetConfig.findUnique({ where: { userId: tenant.id } })

  return NextResponse.json(
    {
      businessName: tenant.businessName || tenant.name || 'Atendimento',
      enabled: widgetConfig?.enabled ?? false,
      welcomeMessage: widgetConfig?.welcomeMessage ?? 'Olá! Como posso ajudar a agendar seu horário?',
      primaryColor: widgetConfig?.primaryColor ?? '#7C3AED',
      position: widgetConfig?.position ?? 'bottom-right',
      showLauncherText: widgetConfig?.showLauncherText ?? true,
    },
    { headers: CORS_HEADERS }
  )
}
