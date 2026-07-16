export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resolveTenantBySlug } from '@/lib/tenant-resolver'

/**
 * GET /api/booking/[slug]/professionals?serviceId=... — união dos profissionais
 * (ativos) de todas as agendas ativas do tenant que oferecem esse serviço.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const serviceId = request.nextUrl.searchParams.get('serviceId')
    if (!serviceId) {
      return NextResponse.json({ error: 'serviceId é obrigatório' }, { status: 400 })
    }

    const tenant = await resolveTenantBySlug(params.slug)
    if (!tenant) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, userId: tenant.id, isActive: true },
      select: { id: true },
    })
    if (!service) {
      return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })
    }

    const schedules = await prisma.schedule.findMany({
      where: {
        userId: tenant.id,
        isActive: true,
        services: { some: { serviceId } },
      },
      select: {
        professionals: {
          where: { professional: { isActive: true } },
          select: { professional: { select: { id: true, name: true, image: true } } },
        },
      },
    })

    const byId = new Map<string, { id: string; name: string | null; image: string | null }>()
    for (const schedule of schedules) {
      for (const { professional } of schedule.professionals) {
        byId.set(professional.id, professional)
      }
    }

    return NextResponse.json(Array.from(byId.values()))
  } catch (error) {
    console.error('Erro ao buscar profissionais para agendamento:', error)
    return NextResponse.json({ error: 'Erro ao buscar profissionais' }, { status: 500 })
  }
}
