export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantBySlug } from '@/lib/tenant-resolver'
import { cancelAppointmentAsClient } from '@/lib/appointment-service'

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const { phone, appointmentId } = await request.json()

    if (!phone || !appointmentId) {
      return NextResponse.json({ error: 'Telefone e agendamento são obrigatórios' }, { status: 400 })
    }

    const user = await resolveTenantBySlug(slug)
    if (!user) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    // Sempre revalida no servidor — nunca confia num "pode cancelar" vindo do cliente.
    const result = await cancelAppointmentAsClient({ tenantId: user.id, phone, appointmentId })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error)
    return NextResponse.json({ error: 'Erro ao cancelar agendamento' }, { status: 500 })
  }
}
