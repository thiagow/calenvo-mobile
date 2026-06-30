export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { canCreateAppointment, getRemainingAppointments, shouldNotifyLimitApproaching } from '@/lib/plan-limits'
import { NotificationService } from '@/lib/notification-service'

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const body = await request.json()
    const {
      scheduleId,
      serviceId,
      date,
      time,
      clientName,
      clientEmail,
      clientPhone
    } = body

    // Validações
    if (!scheduleId || !serviceId || !date || !time || !clientName || !clientPhone) {
      return NextResponse.json(
        { error: 'Dados obrigatórios faltando' },
        { status: 400 }
      )
    }

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

    // Verificar limite de agendamentos do mês atual
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const appointmentsThisMonth = await prisma.appointment.count({
      where: {
        userId: user.id,
        date: {
          gte: firstDayOfMonth,
          lte: lastDayOfMonth
        },
        status: {
          notIn: ['CANCELLED', 'NO_SHOW'] // Não conta cancelados e faltas
        }
      }
    })

    // Validar se pode criar mais agendamentos
    if (!canCreateAppointment(user.planType, appointmentsThisMonth)) {
      return NextResponse.json({
        error: 'O estabelecimento atingiu o limite de agendamentos do mês. Por favor, entre em contato diretamente.',
        code: 'APPOINTMENT_LIMIT_REACHED'
      }, { status: 403 })
    }

    // Buscar ou criar cliente
    let client = await prisma.client.findFirst({
      where: {
        userId: user.id,
        phone: clientPhone
      }
    })

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: clientName,
          email: clientEmail || null,
          phone: clientPhone,
          userId: user.id
        }
      })
    }

    // Buscar serviço
    const service = await prisma.service.findUnique({
      where: { id: serviceId }
    })

    if (!service) {
      return NextResponse.json(
        { error: 'Serviço não encontrado' },
        { status: 404 }
      )
    }

    // Criar data/hora do agendamento
    const [hours, minutes] = time.split(':').map(Number)
    const appointmentDate = new Date(date)
    appointmentDate.setHours(hours, minutes, 0, 0)

    // Verificar se já existe agendamento neste horário
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        scheduleId,
        date: appointmentDate,
        status: {
          notIn: ['CANCELLED', 'NO_SHOW']
        }
      }
    })

    if (existingAppointment) {
      return NextResponse.json(
        { error: 'Este horário já está ocupado' },
        { status: 409 }
      )
    }

    // Determinar status inicial baseado na configuração
    const initialStatus = user.businessConfig.autoConfirm ? 'CONFIRMED' : 'SCHEDULED'

    // Criar agendamento
    const appointment = await prisma.appointment.create({
      data: {
        date: appointmentDate,
        duration: service.duration,
        status: initialStatus,
        scheduleId,
        serviceId,
        clientId: client.id,
        userId: user.id,
        price: service.price || undefined
      }
    })

    // Verificar se deve notificar sobre limite de agendamentos
    try {
      const currentCount = appointmentsThisMonth + 1
      if (shouldNotifyLimitApproaching(user.planType, currentCount)) {
        const remaining = getRemainingAppointments(user.planType, currentCount)
        await NotificationService.notifyPlanLimitApproaching(
          user.id,
          user.planType,
          remaining
        )
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de limite:', error)
      // Não falhar a criação do agendamento se houver erro na notificação
    }

    return NextResponse.json({
      success: true,
      appointment: {
        id: appointment.id,
        date: appointment.date,
        status: appointment.status
      }
    })
  } catch (error) {
    console.error('Erro ao criar agendamento:', error)
    return NextResponse.json(
      { error: 'Erro ao criar agendamento' },
      { status: 500 }
    )
  }
}
