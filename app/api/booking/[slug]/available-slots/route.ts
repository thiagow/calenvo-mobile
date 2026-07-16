import { NextRequest, NextResponse } from 'next/server'
import { getAvailableSlotsForService } from '@/lib/availability-service'
import { resolveTenantBySlug } from '@/lib/tenant-resolver'

export const dynamic = 'force-dynamic'
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const searchParams = request.nextUrl.searchParams
    const serviceId = searchParams.get('serviceId')
    const date = searchParams.get('date')
    const professionalId = searchParams.get('professionalId')

    if (!serviceId || !date) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: serviceId, date' },
        { status: 400 }
      )
    }

    const tenant = await resolveTenantBySlug(slug)
    if (!tenant) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    const slots = await getAvailableSlotsForService({
      serviceId,
      date,
      userId: tenant.id,
      ...(professionalId && { professionalId }),
    })

    if (slots === null) {
      return NextResponse.json(
        { error: 'Agenda ou serviço não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ slots })
  } catch (error) {
    console.error('Erro ao buscar horários:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar horários' },
      { status: 500 }
    )
  }
}
