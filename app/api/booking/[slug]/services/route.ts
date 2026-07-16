export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resolveTenantBySlug } from '@/lib/tenant-resolver'

/**
 * GET /api/booking/[slug]/services — serviços agendáveis publicamente: ativos
 * e vinculados a pelo menos uma agenda ativa do tenant. O cliente final nunca
 * escolhe agenda diretamente — o serviço (+ opcionalmente o profissional) é
 * quem resolve isso no servidor (ver lib/availability-service.ts).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const tenant = await resolveTenantBySlug(params.slug)
    if (!tenant) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    if (!tenant.businessConfig?.allowOnlineBooking) {
      return NextResponse.json({ error: 'Agendamento online não está disponível' }, { status: 403 })
    }

    const services = await prisma.service.findMany({
      where: {
        userId: tenant.id,
        isActive: true,
        schedules: { some: { schedule: { isActive: true } } },
      },
      select: {
        id: true,
        name: true,
        description: true,
        duration: true,
        price: true,
        category: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(services)
  } catch (error) {
    console.error('Erro ao buscar serviços para agendamento:', error)
    return NextResponse.json({ error: 'Erro ao buscar serviços' }, { status: 500 })
  }
}
