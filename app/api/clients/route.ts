
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { formatWhatsAppNumber } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userRole = (session.user as any).role
    const masterId = (session.user as any).masterId

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    let whereConditions: any = {}

    // Se for profissional, mostrar apenas clientes que têm agendamentos com ele
    if (userRole === 'PROFESSIONAL' && masterId) {
      whereConditions.userId = masterId
      whereConditions.appointments = {
        some: {
          professionalId: userId
        }
      }
    } else {
      whereConditions.userId = userId
    }

    if (search) {
      whereConditions.name = {
        contains: search,
        mode: 'insensitive'
      }
    }

    const clients = await prisma.client.findMany({
      where: whereConditions,
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(clients)
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

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

    // Normaliza pro mesmo formato usado no agendamento público e no chat —
    // sem isso, o mesmo telefone digitado de formas diferentes em cada canal
    // vira um Client duplicado.
    const normalizedPhone = formatWhatsAppNumber(phone) || phone

    // Check if client already exists by phone or cpf (to avoid duplicates)
    let client = null

    if (cpf) {
      client = await prisma.client.findFirst({
        where: {
          userId: userId,
          OR: [
            { phone: normalizedPhone },
            { cpf: cpf }
          ]
        }
      })
    } else {
      client = await prisma.client.findFirst({
        where: {
          userId: userId,
          phone: normalizedPhone
        }
      })
    }

    if (!client) {
      // Create new client if doesn't exist
      try {
        client = await prisma.client.create({
          data: {
            name,
            email,
            phone: normalizedPhone,
            cpf,
            birthDate: birthDate ? new Date(birthDate) : null,
            address,
            city,
            state,
            notes,
            user: {
              connect: {
                id: userId
              }
            }
          }
        })
      } catch (error: any) {
        // Corrida rara: outra requisição criou o mesmo cliente entre o findFirst e o create.
        if (error?.code === 'P2002') {
          client = await prisma.client.findFirst({ where: { userId, phone: normalizedPhone } })
        }
        if (!client) throw error
      }
    } else {
      // Update existing client with any new information provided
      client = await prisma.client.update({
        where: {
          id: client.id
        },
        data: {
          email: email || client.email,
          phone: normalizedPhone || client.phone,
          cpf: cpf || client.cpf,
          birthDate: birthDate ? new Date(birthDate) : client.birthDate,
          address: address || client.address,
          city: city || client.city,
          state: state || client.state,
          notes: notes || client.notes
        }
      })
    }

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error('Error creating client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
