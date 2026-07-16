
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { AppointmentStatus, ModalityType } from '@prisma/client'
import { NotificationService } from '@/lib/notification-service'
import { WhatsAppService } from '@/lib/whatsapp-service'
import { WhatsAppTriggerService } from '@/lib/whatsapp-trigger'
import { getRemainingAppointments, shouldNotifyLimitApproaching } from '@/lib/plan-limits'
import { checkAppointmentQuota, checkScheduleConflict } from '@/lib/appointment-service'

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
    const status = searchParams.get('status')
    const modality = searchParams.get('modality') as ModalityType | null
    const specialty = searchParams.get('specialty')
    const professional = searchParams.get('professional')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const view = searchParams.get('view') // 'day', 'week', 'month', 'list', 'timeline'
    const currentDate = searchParams.get('currentDate')

    // Se for profissional, busca agendamentos do master mas filtrados pelo professionalId
    let whereConditions: any = {}
    if (userRole === 'PROFESSIONAL' && masterId) {
      whereConditions.userId = masterId
      whereConditions.professionalId = userId
    } else {
      whereConditions.userId = userId
    }

    // Search filter
    if (search) {
      whereConditions.OR = [
        {
          client: {
            name: {
              contains: search,
              mode: 'insensitive'
            }
          }
        },
        {
          specialty: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          professional: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ]
    }

    // Status filter
    if (status && status !== 'all') {
      const statusArray = status.split(',') as AppointmentStatus[]
      whereConditions.status = {
        in: statusArray
      }
    }

    // Modality filter
    if (modality) {
      whereConditions.modality = modality
    }

    // Specialty filter
    if (specialty) {
      whereConditions.specialty = specialty
    }

    // Professional filter
    if (professional) {
      whereConditions.professional = professional
    }

    // Date range filters
    if (dateFrom || dateTo || (view && currentDate)) {
      let dateFilter: any = {}

      if (view && currentDate) {
        const date = new Date(currentDate)

        switch (view) {
          case 'day':
            const startOfDay = new Date(date)
            startOfDay.setHours(0, 0, 0, 0)
            const endOfDay = new Date(date)
            endOfDay.setHours(23, 59, 59, 999)

            dateFilter.gte = startOfDay
            dateFilter.lte = endOfDay
            break

          case 'week':
            const startOfWeek = new Date(date)
            const day = startOfWeek.getDay()
            const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
            startOfWeek.setDate(diff)
            startOfWeek.setHours(0, 0, 0, 0)

            const endOfWeek = new Date(startOfWeek)
            endOfWeek.setDate(startOfWeek.getDate() + 6)
            endOfWeek.setHours(23, 59, 59, 999)

            dateFilter.gte = startOfWeek
            dateFilter.lte = endOfWeek
            break

          case 'month':
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
            endOfMonth.setHours(23, 59, 59, 999)

            dateFilter.gte = startOfMonth
            dateFilter.lte = endOfMonth
            break
        }
      } else {
        if (dateFrom) {
          dateFilter.gte = new Date(dateFrom)
        }
        if (dateTo) {
          const toDate = new Date(dateTo)
          toDate.setHours(23, 59, 59, 999)
          dateFilter.lte = toDate
        }
      }

      if (Object.keys(dateFilter).length > 0) {
        whereConditions.date = dateFilter
      }
    }

    const appointments = await prisma.appointment.findMany({
      where: whereConditions,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        service: {
          select: {
            id: true,
            name: true,
            price: true
          }
        },
        professionalUser: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    })

    // Transform the data to match the frontend interface
    const transformedAppointments = appointments.map(appointment => ({
      id: appointment.id,
      date: appointment.date,
      patient: {
        id: appointment.client.id,
        name: appointment.client.name,
        phone: appointment.client.phone,
        email: appointment.client.email
      },
      specialty: appointment.service?.name || appointment.specialty || 'Consulta Geral',
      status: appointment.status,
      modality: appointment.modality,
      duration: appointment.duration,
      insurance: appointment.insurance || 'Particular',
      notes: appointment.notes || '',
      professional: appointment.professionalUser?.name || appointment.professional || 'Não definido',
      price: appointment.price,
      serviceId: appointment.serviceId,
      professionalId: appointment.professionalId,
      service: appointment.service,
      professionalRelation: appointment.professionalUser
    }))

    return NextResponse.json(transformedAppointments)
  } catch (error) {
    console.error('Error fetching appointments:', error)
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
      clientId,
      scheduleId,
      serviceId,
      professionalId,
      date,
      duration = 30,
      status = 'SCHEDULED',
      modality = 'PRESENCIAL',
      specialty,
      insurance,
      serviceType,
      professional,
      notes,
      price
    } = body

    if (!clientId || !date) {
      return NextResponse.json(
        { error: 'Client ID and date are required' },
        { status: 400 }
      )
    }

    // Buscar dados do usuário com plano
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        planType: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Verificar limite de agendamentos do mês atual
    const quota = await checkAppointmentQuota(userId, user.planType ?? 'BASICO')
    const appointmentsThisMonth = quota.currentCount

    // Validar se pode criar mais agendamentos
    if (!quota.allowed) {
      return NextResponse.json({
        error: `Limite de agendamentos do mês atingido. Você já utilizou ${appointmentsThisMonth} agendamentos. Faça upgrade do seu plano para continuar.`,
        code: 'APPOINTMENT_LIMIT_REACHED',
        currentCount: appointmentsThisMonth,
        remaining: quota.remaining
      }, { status: 403 })
    }

    // Validar conflito de horários
    if (scheduleId) {
      const hasConflict = await checkScheduleConflict({
        scheduleId,
        professionalId,
        date: new Date(date),
        duration,
      })

      if (hasConflict) {
        return NextResponse.json({
          error: 'Já existe um agendamento neste horário para esta agenda e profissional'
        }, { status: 409 })
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        userId: userId,
        clientId,
        scheduleId: scheduleId || null,
        serviceId: serviceId || null,
        professionalId: professionalId || null,
        date: new Date(date),
        duration,
        status,
        modality,
        specialty,
        insurance,
        serviceType,
        professional,
        notes,
        price: price ? parseFloat(price) : null
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        professionalUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        service: {
          select: {
            name: true
          }
        },
        user: {
          select: {
            businessName: true,
            whatsappConfig: {
              select: {
                enabled: true,
                isConnected: true,
                notifyOnCreate: true
              }
            }
          }
        }
      }
    })

    // Criar notificação interna
    try {
      const serviceName = appointment.service?.name || appointment.specialty || 'Serviço'
      await NotificationService.notifyAppointmentCreated(
        userId,
        appointment.id,
        appointment.client.name,
        serviceName,
        appointment.date
      )

      // Verificar se deve notificar sobre limite de agendamentos
      // Conta agendamentos após a criação (appointmentsThisMonth + 1)
      const currentCount = appointmentsThisMonth + 1
      if (shouldNotifyLimitApproaching(user.planType ?? 'BASICO', currentCount)) {
        const remaining = getRemainingAppointments(user.planType ?? 'BASICO', currentCount)
        await NotificationService.notifyPlanLimitApproaching(
          userId,
          user.planType ?? 'BASICO',
          remaining
        )
      }

      // Enviar notificação via WhatsApp se configurado (usando novo sistema)
      const professionalName = appointment.professionalUser?.name || appointment.professional || undefined

      await WhatsAppTriggerService.onAppointmentCreated(
        appointment as any,
        serviceName,
        professionalName
      )
    } catch (error) {
      console.error('Erro ao enviar notificações:', error)
      // Não falhar a criação do agendamento se houver erro nas notificações
    }

    // Transform the response to match frontend interface
    const transformedAppointment = {
      id: appointment.id,
      date: appointment.date,
      patient: {
        id: appointment.client.id,
        name: appointment.client.name,
        phone: appointment.client.phone,
        email: appointment.client.email
      },
      specialty: appointment.specialty || 'Consulta Geral',
      status: appointment.status,
      modality: appointment.modality,
      duration: appointment.duration,
      insurance: appointment.insurance || 'Particular',
      notes: appointment.notes || '',
      professional: appointment.professionalUser?.name || appointment.professional || 'Não definido',
      professionalId: appointment.professionalId,
      price: appointment.price
    }

    return NextResponse.json(transformedAppointment, { status: 201 })
  } catch (error) {
    console.error('Error creating appointment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
