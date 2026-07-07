import { NextRequest, NextResponse } from 'next/server'
import { getAvailableSlots } from '@/lib/availability-service'

export const dynamic = 'force-dynamic'
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const scheduleId = searchParams.get('scheduleId')
    const serviceId = searchParams.get('serviceId')
    const date = searchParams.get('date')

    if (!scheduleId || !serviceId || !date) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: scheduleId, serviceId, date' },
        { status: 400 }
      )
    }

    const slots = await getAvailableSlots({ scheduleId, serviceId, date })

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
