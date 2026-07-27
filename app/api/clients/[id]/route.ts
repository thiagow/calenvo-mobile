
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { formatWhatsAppNumber } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    const client = await prisma.client.findFirst({
      where: { id: params.id, userId }
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error('Error fetching client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    const existing = await prisma.client.findFirst({
      where: { id: params.id, userId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      email,
      phone,
      cpf,
      birthDate,
      address,
      city,
      state,
      notes
    } = body

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Name and phone are required' },
        { status: 400 }
      )
    }

    // Mesma normalização usada na criação — sem ela, editar o telefone de um
    // cliente quebraria a deduplicação entre canais (público, chat, dashboard).
    const normalizedPhone = formatWhatsAppNumber(phone) || phone

    try {
      const client = await prisma.client.update({
        where: { id: existing.id },
        data: {
          name,
          email: email || null,
          phone: normalizedPhone,
          cpf: cpf || null,
          birthDate: birthDate ? new Date(birthDate) : null,
          address: address || null,
          city: city || null,
          state: state || null,
          notes: notes || null
        }
      })

      return NextResponse.json(client)
    } catch (error: any) {
      // Telefone já pertence a outro cliente do mesmo negócio (constraint userId+phone)
      if (error?.code === 'P2002') {
        return NextResponse.json(
          { error: 'Já existe outro cliente cadastrado com esse número de WhatsApp' },
          { status: 409 }
        )
      }
      throw error
    }
  } catch (error) {
    console.error('Error updating client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
