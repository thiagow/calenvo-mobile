
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userRole = (session.user as any).role
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    let whereConditions: any = {}

    if (userRole === 'PROFESSIONAL') {
      // Professional sees schedules explicitly linked to them
      whereConditions = {
        professionals: {
          some: {
            professionalId: userId
          }
        }
      }
    } else {
      // Master sees all schedules they created
      whereConditions = {
        userId: userId
      }
    }

    if (!includeInactive) {
      whereConditions.isActive = true
    }

    const schedules = await prisma.schedule.findMany({
      where: whereConditions,
      include: {
        services: {
          include: {
            service: true
          }
        },
        professionals: {
          include: {
            professional: {
              select: {
                id: true,
                name: true,
                email: true,
                whatsapp: true,
                isActive: true
              }
            }
          }
        },
        _count: {
          select: {
            appointments: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(schedules)
  } catch (error) {
    console.error('Error fetching schedules:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    console.log('🔐 Session data:', JSON.stringify({
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: (session?.user as any)?.id,
      userEmail: session?.user?.email,
      sessionKeys: session ? Object.keys(session) : [],
      userKeys: session?.user ? Object.keys(session.user) : []
    }, null, 2))
    
    if (!session || !session.user) {
      console.log('❌ Unauthorized - No session found')
      return NextResponse.json({ 
        error: 'Não autenticado. Por favor, faça login novamente.' 
      }, { status: 401 })
    }

    const userId = (session.user as any).id
    
    // Verify user exists in database
    if (!userId) {
      console.log('❌ No userId found in session. Session user:', JSON.stringify(session.user, null, 2))
      return NextResponse.json({ 
        error: 'Sessão inválida - ID de usuário não encontrado. Por favor, faça logout e login novamente para atualizar sua sessão.' 
      }, { status: 401 })
    }
    
    console.log('🔍 Checking if user exists:', userId)
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    })
    
    console.log('👤 User lookup result:', userExists)
    
    if (!userExists) {
      console.log('❌ User not found in database:', userId)
      return NextResponse.json({ 
        error: 'Usuário não encontrado no banco de dados. Por favor, faça logout e login novamente.' 
      }, { status: 401 })
    }
    
    const body = await request.json()
    
    console.log('📝 Creating schedule for user:', userId)
    console.log('📦 Request body:', JSON.stringify(body, null, 2))
    
    const {
      name,
      description,
      color,
      workingDays,
      bufferTime,
      advanceBookingDays,
      minNoticeHours,
      serviceIds, // Array de IDs de serviços para vincular
      professionalIds // Array de IDs de profissionais para vincular (inclui o próprio MASTER, se "eu mesmo atendo")
    } = body

    if (!name || !workingDays) {
      console.log('❌ Validation error - Missing required fields')
      return NextResponse.json(
        { error: 'Nome e dias de trabalho são obrigatórios' },
        { status: 400 }
      )
    }

    if (!professionalIds || professionalIds.length === 0) {
      console.log('❌ Validation error - No professionals selected')
      return NextResponse.json(
        { error: 'Selecione ao menos "Eu mesmo atendo" ou um profissional da equipe para esta agenda' },
        { status: 400 }
      )
    }

    if (!serviceIds || serviceIds.length === 0) {
      console.log('❌ Validation error - No services selected')
      return NextResponse.json(
        { error: 'Selecione pelo menos um serviço para esta agenda' },
        { status: 400 }
      )
    }

    // Confirmar que os serviços pertencem ao tenant
    const ownedServices = await prisma.service.findMany({
      where: { id: { in: serviceIds }, userId },
      select: { id: true, duration: true }
    })
    if (ownedServices.length !== serviceIds.length) {
      return NextResponse.json({ error: 'Um ou mais serviços não foram encontrados' }, { status: 400 })
    }

    // Confirmar que os profissionais pertencem ao tenant (equipe) OU são o próprio MASTER ("eu mesmo atendo")
    const ownedProfessionals = await prisma.user.findMany({
      where: { id: { in: professionalIds }, OR: [{ masterId: userId }, { id: userId }] },
      select: { id: true }
    })
    if (ownedProfessionals.length !== professionalIds.length) {
      return NextResponse.json({ error: 'Um ou mais profissionais não foram encontrados' }, { status: 400 })
    }

    // Duração do slot é derivada dos serviços vinculados — não é mais um campo editável pelo usuário
    const derivedSlotDuration = Math.min(...ownedServices.map((s) => s.duration))

    // Criar a agenda
    console.log('🔧 Creating schedule with data:', {
      userId,
      name,
      description,
      color: color || '#3B82F6',
      workingDays,
      slotDuration: derivedSlotDuration,
      bufferTime: bufferTime || 0,
      advanceBookingDays: advanceBookingDays || 30,
      minNoticeHours: minNoticeHours || 2
    })

    const schedule = await prisma.schedule.create({
      data: {
        userId: userId,
        name,
        description: description || null,
        color: color || '#3B82F6',
        workingDays,
        slotDuration: derivedSlotDuration,
        bufferTime: bufferTime || 0,
        advanceBookingDays: advanceBookingDays || 30,
        minNoticeHours: minNoticeHours || 2
      }
    })

    console.log('✅ Schedule created:', schedule.id)

    // Vincular serviços
    console.log('🔗 Linking services:', serviceIds)
    await prisma.scheduleService.createMany({
      data: serviceIds.map((serviceId: string) => ({
        scheduleId: schedule.id,
        serviceId
      }))
    })
    console.log('✅ Services linked')

    // Vincular profissionais
    console.log('🔗 Linking professionals:', professionalIds)
    await prisma.scheduleProfessional.createMany({
      data: professionalIds.map((professionalId: string) => ({
        scheduleId: schedule.id,
        professionalId
      }))
    })
    console.log('✅ Professionals linked')

    // Buscar a agenda criada com os relacionamentos
    const scheduleWithRelations = await prisma.schedule.findUnique({
      where: { id: schedule.id },
      include: {
        services: {
          include: {
            service: true
          }
        },
        professionals: {
          include: {
            professional: {
              select: {
                id: true,
                name: true,
                email: true,
                whatsapp: true,
                isActive: true
              }
            }
          }
        }
      }
    })

    console.log('✅ Schedule created successfully with relations')
    return NextResponse.json(scheduleWithRelations, { status: 201 })
  } catch (error) {
    console.error('❌ Error creating schedule:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
