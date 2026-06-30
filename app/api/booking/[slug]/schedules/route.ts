import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params

    // Buscar usuário pelo ID ou pela publicUrl do businessConfig
    let user = await prisma.user.findFirst({
      where: {
        id: { startsWith: slug }
      }
    })

    // Se não encontrou pelo ID, buscar pelo publicUrl
    if (!user) {
      const businessConfig = await prisma.businessConfig.findFirst({
        where: {
          publicUrl: slug
        }
      })

      if (businessConfig) {
        user = await prisma.user.findUnique({
          where: { id: businessConfig.userId }
        })
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Negócio não encontrado' },
        { status: 404 }
      )
    }

    // Buscar agendas ativas com serviços
    const schedules = await prisma.schedule.findMany({
      where: {
        userId: user.id,
        isActive: true
      },
      include: {
        services: {
          where: {
            service: {
              isActive: true
            }
          },
          include: {
            service: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Filtrar apenas agendas que têm serviços ativos
    const schedulesWithServices = schedules.filter(
      schedule => schedule.services.length > 0
    )

    return NextResponse.json(schedulesWithServices)
  } catch (error) {
    console.error('Erro ao buscar agendas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar agendas' },
      { status: 500 }
    )
  }
}
