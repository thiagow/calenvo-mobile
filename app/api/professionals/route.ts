
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { canAddProfessional } from '@/lib/plan-limits'

export const dynamic = 'force-dynamic'

// GET - Listar profissionais da equipe
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    
    // Buscar o usuário para verificar se é master
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, planType: true }
    })

    if (!user || user.role !== 'MASTER') {
      return NextResponse.json({ error: 'Acesso negado. Apenas usuários master podem gerenciar profissionais.' }, { status: 403 })
    }

    // Buscar todos os profissionais vinculados ao master
    const professionals = await prisma.user.findMany({
      where: {
        masterId: userId
      },
      select: {
        id: true,
        name: true,
        email: true,
        whatsapp: true,
        phone: true,
        image: true,
        isActive: true,
        createdAt: true,
        role: true,
        scheduleProfessionals: {
          include: {
            schedule: {
              select: {
                id: true,
                name: true,
                color: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(professionals)
  } catch (error) {
    console.error('Error fetching professionals:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Criar novo profissional
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { name, email, whatsapp, password, image } = body

    // Validações
    if (!name || !email || !whatsapp || !password) {
      return NextResponse.json(
        { error: 'Nome, e-mail, WhatsApp e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar o usuário master
    const masterUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        role: true, 
        planType: true,
        professionals: {
          where: {
            isActive: true
          }
        }
      }
    })

    if (!masterUser || masterUser.role !== 'MASTER') {
      return NextResponse.json({ error: 'Acesso negado. Apenas usuários master podem criar profissionais.' }, { status: 403 })
    }

    // Verificar limite do plano
    const currentProfessionalCount = masterUser.professionals.length
    if (!canAddProfessional(masterUser.planType, currentProfessionalCount)) {
      return NextResponse.json(
        { error: 'Limite de profissionais atingido para o seu plano. Faça upgrade para adicionar mais profissionais.' },
        { status: 403 }
      )
    }

    // Verificar se o e-mail já existe para um profissional
    const existingUser = await prisma.user.findFirst({
      where: { 
        email,
        role: 'PROFESSIONAL'
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Este e-mail já está em uso' },
        { status: 400 }
      )
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12)

    // Criar o profissional
    const professional = await prisma.user.create({
      data: {
        name,
        email,
        whatsapp,
        password: hashedPassword,
        image: image || null,
        role: 'PROFESSIONAL',
        masterId: userId,
        planType: masterUser.planType, // Inherit plan type from master
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        whatsapp: true,
        image: true,
        isActive: true,
        createdAt: true,
        role: true
      }
    })

    return NextResponse.json(professional, { status: 201 })
  } catch (error) {
    console.error('Error creating professional:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
