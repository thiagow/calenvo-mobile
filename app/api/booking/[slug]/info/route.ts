export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params

    // Buscar usuário pelo slug (usando os primeiros 8 caracteres do ID)
    // Buscar usuário pelo ID ou pela publicUrl do businessConfig
    let user = await prisma.user.findFirst({
      where: {
        id: { startsWith: slug }
      },
      include: {
        businessConfig: true
      }
    })

    // Se não encontrou pelo ID, buscar pelo publicUrl
    if (!user) {
      const businessConfig = await prisma.businessConfig.findFirst({
        where: {
          publicUrl: slug
        },
        include: {
          user: true
        }
      })
      
      if (businessConfig) {
        user = await prisma.user.findUnique({
          where: { id: businessConfig.userId },
          include: { businessConfig: true }
        })
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Negócio não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se agendamento online está habilitado
    if (!user.businessConfig?.allowOnlineBooking) {
      return NextResponse.json(
        { error: 'Agendamento online não está disponível' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      businessName: user.businessName || user.name || 'Agendamento Online',
      businessLogo: user.businessConfig.businessLogo
    })
  } catch (error) {
    console.error('Erro ao buscar informações:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar informações' },
      { status: 500 }
    )
  }
}
