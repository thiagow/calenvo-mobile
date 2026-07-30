export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantBySlug } from '@/lib/tenant-resolver'
import { getClientOpenAppointments } from '@/lib/appointment-service'

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Telefone é obrigatório' }, { status: 400 })
    }

    const user = await resolveTenantBySlug(slug)
    if (!user) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    // Não revela se o telefone existe ou não — sempre 200 com lista (vazia se não achar).
    const appointments = await getClientOpenAppointments(user.id, phone)

    return NextResponse.json({ appointments })
  } catch (error) {
    console.error('Erro ao consultar agendamentos:', error)
    return NextResponse.json({ error: 'Erro ao consultar agendamentos' }, { status: 500 })
  }
}
