
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { AppointmentStatus, ModalityType } from '@prisma/client'
import { NotificationService } from '@/lib/notification-service'
import { WhatsAppService } from '@/lib/whatsapp-service'
import { WhatsAppTriggerService } from '@/lib/whatsapp-trigger'
import { getRemainingAppointments, shouldNotifyLimitApproaching } from '@/lib/plan-limits'
import { checkAppointmentQuota, resolveProfessionalForBooking, withBookingLock } from '@/lib/appointment-service'
import { logError } from '@/lib/error-logger'

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
    let whereConditions: any = { deletedAt: null }
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
      professionalRelation: appointment.professionalUser,
      isOverbooked: appointment.isOverbooked
    }))

    return NextResponse.json(transformedAppointments)
  } catch (error) {
    console.error('Error fetching appointments:', error)
    await logError({ functionality: 'appointment_list', error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Hoisted pra ficarem disponíveis no catch como metadata do ErrorLog —
  // sem isso, um erro no meio do fluxo (ex.: FK inválida no create) virava
  // um "Internal server error" opaco, sem registro de qual agenda/cliente
  // estava envolvido. Só espelham as constantes reais abaixo, não substituem
  // elas — evita perder o narrowing de tipo que o resto do handler depende.
  let userIdForLog: string | undefined
  let clientIdForLog: string | undefined
  let scheduleIdForLog: string | undefined
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    userIdForLog = userId
    const body = await request.json()
    const {
      clientId,
      scheduleId,
      serviceId,
      professionalId,
      date,
      duration: bodyDuration,
      status = 'SCHEDULED',
      modality = 'PRESENCIAL',
      specialty,
      insurance,
      serviceType,
      professional,
      notes,
      price,
      forceOverbook
    } = body
    clientIdForLog = clientId
    scheduleIdForLog = scheduleId

    // scheduleId é obrigatório: sem ele, o bloco de checagem de conflito abaixo
    // era pulado inteiro e o agendamento entrava sem validação nenhuma — o
    // mesmo profissional podia ser reservado duas vezes no mesmo horário.
    if (!clientId || !date || !scheduleId) {
      return NextResponse.json(
        { error: 'Client ID, agenda e data são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar dados do usuário com plano
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        planType: true,
        role: true,
        canForceOverbook: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // "Encaixe": ignora conflito de horário. Só é aceito aqui (dashboard) e só
    // quando o usuário autenticado é MASTER ou tem permissão explícita
    // (canForceOverbook) — nunca confiar só na claim de role da sessão/JWT
    // para uma ação sensível, recarregamos do banco acima.
    const allowOverbook = Boolean(forceOverbook) && (user.role === 'MASTER' || user.canForceOverbook === true)

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

    // Duração vem do serviço no servidor, não do body — sem isso, um cliente
    // malicioso da API podia mandar `duration: 5` pra escapar do teste de
    // sobreposição e ainda assim gravar o valor curto no agendamento.
    let duration = bodyDuration ? Number(bodyDuration) : 30
    if (serviceId) {
      const service = await prisma.service.findFirst({
        where: { id: serviceId, userId },
        select: { duration: true }
      })
      if (!service) {
        return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })
      }
      duration = service.duration
    }

    // Checagem de conflito + criação são atômicas sob um advisory lock — sem
    // isso, dois POSTs concorrentes pro mesmo profissional podiam ambos passar
    // pelo check-then-write e empilhar no mesmo horário.
    const lockKey = professionalId || scheduleId
    const result = await withBookingLock(lockKey, async (tx) => {
      const resolution = await resolveProfessionalForBooking({
        scheduleId,
        userId,
        date: new Date(date),
        duration,
        requestedProfessionalId: professionalId || null,
        allowOverbook,
        tx,
      })

      if (resolution.error) {
        return { ok: false as const, error: resolution.error }
      }

      const created = await tx.appointment.create({
        data: {
          userId: userId,
          clientId,
          scheduleId,
          serviceId: serviceId || null,
          professionalId: resolution.professionalId,
          date: new Date(date),
          duration,
          status,
          modality,
          specialty,
          insurance,
          serviceType,
          professional,
          notes,
          price: price ? parseFloat(price) : null,
          isOverbooked: allowOverbook
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

      return { ok: true as const, appointment: created }
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }
    const appointment = result.appointment

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
    await logError({
      functionality: 'appointment_create',
      error,
      userId: userIdForLog,
      metadata: { clientId: clientIdForLog, scheduleId: scheduleIdForLog },
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
