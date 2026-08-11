export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRemainingAppointments, shouldNotifyLimitApproaching } from '@/lib/plan-limits'
import { NotificationService } from '@/lib/notification-service'
import { checkAppointmentQuota, resolveBookingTarget, withBookingLock } from '@/lib/appointment-service'
import { resolveTenantBySlug } from '@/lib/tenant-resolver'
import { parseCalendarDate } from '@/lib/availability-service'
import { formatWhatsAppNumber } from '@/lib/utils'
import { WhatsAppTriggerService } from '@/lib/whatsapp-trigger'

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const body = await request.json()
    const {
      serviceId,
      date,
      time,
      clientName,
      clientEmail,
      clientPhone,
      professionalId
    } = body

    // Validações
    if (!serviceId || !date || !time || !clientName || !clientPhone) {
      return NextResponse.json(
        { error: 'Dados obrigatórios faltando' },
        { status: 400 }
      )
    }

    // Buscar usuário pelo ID ou pela publicUrl do businessConfig
    const user = await resolveTenantBySlug(slug)

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
    const quota = await checkAppointmentQuota(user.id, user.planType ?? 'BASICO')
    const appointmentsThisMonth = quota.currentCount

    // Validar se pode criar mais agendamentos
    if (!quota.allowed) {
      return NextResponse.json({
        error: 'O estabelecimento atingiu o limite de agendamentos do mês. Por favor, entre em contato diretamente.',
        code: 'APPOINTMENT_LIMIT_REACHED'
      }, { status: 403 })
    }

    // Buscar ou criar cliente
    // Normaliza pro mesmo formato usado no chat e no cadastro manual — sem
    // isso, a máscara do formulário ("(11) 98765-4321") nunca bate com o
    // telefone salvo por outro canal, e cria um Client duplicado.
    const normalizedPhone = formatWhatsAppNumber(clientPhone) || clientPhone

    let client = await prisma.client.findFirst({
      where: {
        userId: user.id,
        phone: normalizedPhone
      }
    })

    if (!client) {
      try {
        client = await prisma.client.create({
          data: {
            name: clientName,
            email: clientEmail || null,
            phone: normalizedPhone,
            userId: user.id
          }
        })
      } catch (error: any) {
        // Corrida rara: outra requisição criou o mesmo cliente entre o findFirst e o create.
        if (error?.code === 'P2002') {
          client = await prisma.client.findFirst({ where: { userId: user.id, phone: normalizedPhone } })
        }
        if (!client) throw error
      }
    }

    // Buscar serviço (escopado ao tenant resolvido pelo slug)
    const service = await prisma.service.findFirst({
      where: { id: serviceId, userId: user.id }
    })

    if (!service) {
      return NextResponse.json(
        { error: 'Serviço não encontrado' },
        { status: 404 }
      )
    }

    // Criar data/hora do agendamento
    const [hours, minutes] = time.split(':').map(Number)
    const appointmentDate = parseCalendarDate(date)
    appointmentDate.setHours(hours, minutes, 0, 0)

    // Determinar status inicial baseado na configuração
    const initialStatus = user.businessConfig.autoConfirm ? 'CONFIRMED' : 'SCHEDULED'

    // Resolve a agenda (o cliente não escolhe mais) e o profissional (o
    // escolhido, ou o primeiro livre entre os vinculados, quando não houver
    // preferência), e cria o agendamento — tudo sob um advisory lock, senão
    // dois clientes reservando o mesmo horário ao mesmo tempo passam ambos
    // pelo check-then-write e o mesmo profissional fica com dois compromissos.
    const clientId = client.id
    const lockKey = professionalId || `service:${serviceId}`
    const result = await withBookingLock(lockKey, async (tx) => {
      const resolution = await resolveBookingTarget({
        userId: user.id,
        serviceId,
        date: appointmentDate,
        duration: service.duration,
        requestedProfessionalId: professionalId || null,
        tx,
      })

      if (resolution.error || !resolution.scheduleId) {
        return { ok: false as const, error: resolution.error || 'Este horário acabou de ficar indisponível' }
      }

      const created = await tx.appointment.create({
        data: {
          date: appointmentDate,
          duration: service.duration,
          status: initialStatus,
          scheduleId: resolution.scheduleId,
          serviceId,
          professionalId: resolution.professionalId,
          clientId,
          userId: user.id,
          price: service.price || undefined
        }
      })

      return { ok: true as const, appointment: created }
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }
    const { appointment } = result

    // Verificar se deve notificar sobre limite de agendamentos
    try {
      const currentCount = appointmentsThisMonth + 1
      if (shouldNotifyLimitApproaching(user.planType ?? 'BASICO', currentCount)) {
        const remaining = getRemainingAppointments(user.planType ?? 'BASICO', currentCount)
        await NotificationService.notifyPlanLimitApproaching(
          user.id,
          user.planType ?? 'BASICO',
          remaining
        )
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de limite:', error)
      // Não falhar a criação do agendamento se houver erro na notificação
    }

    const professional = appointment.professionalId
      ? await prisma.user.findUnique({ where: { id: appointment.professionalId }, select: { name: true } })
      : null

    // Enviar notificação via WhatsApp se configurado
    try {
      await WhatsAppTriggerService.onAppointmentCreated(
        { ...appointment, client, user: { businessName: user.businessName } } as any,
        service.name,
        professional?.name ?? undefined
      )
    } catch (error) {
      console.error('Erro ao enviar notificação de agendamento criado:', error)
      // Não falhar a criação do agendamento se houver erro na notificação
    }

    return NextResponse.json({
      success: true,
      appointment: {
        id: appointment.id,
        date: appointment.date,
        status: appointment.status,
        professionalName: professional?.name ?? null
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
