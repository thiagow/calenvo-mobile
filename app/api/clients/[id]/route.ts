
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userRole = (session.user as any).role

    // Exclusão de cliente é irreversível (apaga histórico, pacotes e fidelidade
    // em cascata) — restrita ao Admin da Conta (MASTER), não a profissionais.
    if (userRole !== 'MASTER') {
      return NextResponse.json({ error: 'Apenas o administrador da conta pode excluir clientes' }, { status: 403 })
    }

    const existing = await prisma.client.findFirst({
      where: { id: params.id, userId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const [appointmentsCount, packagesCount] = await Promise.all([
      prisma.appointment.count({ where: { clientId: existing.id } }),
      prisma.clientPackage.count({ where: { clientId: existing.id } })
    ])

    // Log de auditoria antes de excluir, com snapshot dos dados (registro sobrevive à exclusão).
    await prisma.adminAuditLog.create({
      data: {
        action: 'CLIENT_DELETED',
        adminId: userId,
        targetId: existing.id,
        details: {
          name: existing.name,
          phone: existing.phone,
          email: existing.email,
          cpf: existing.cpf,
          appointmentsCount,
          packagesCount
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
      }
    })

    // Exclui o cliente — appointments, pacotes e saldo/transações de fidelidade
    // são removidos em cascata pelo schema (onDelete: Cascade).
    await prisma.client.delete({ where: { id: existing.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
