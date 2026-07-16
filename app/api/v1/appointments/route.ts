export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticateApiRequest, hasScope } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { checkAppointmentQuota, checkScheduleConflict } from '@/lib/appointment-service'
import { NotificationService } from '@/lib/notification-service'
import { WhatsAppTriggerService } from '@/lib/whatsapp-trigger'

/**
 * GET /api/v1/appointments — lista agendamentos do tenant dono do token.
 * Requer escopo "appointments:read".
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Token de API inválido ou ausente' }, { status: 401 })
  }
  if (!hasScope(auth, 'appointments:read')) {
    return NextResponse.json({ error: 'Token sem permissão de leitura (appointments:read)' }, { status: 403 })
  }

  const rate = await checkRateLimit(auth.tokenId)
  if (!rate.success) {
    return NextResponse.json({ error: 'Limite de requisições excedido. Tente novamente em instantes.' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const where: any = { userId: auth.userId }
  if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) where.date.gte = new Date(dateFrom)
    if (dateTo) where.date.lte = new Date(dateTo)
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      client: { select: { id: true, name: true, phone: true, email: true } },
      service: { select: { id: true, name: true } },
      professionalUser: { select: { id: true, name: true } },
    },
    orderBy: { date: 'asc' },
    take: 200,
  })

  return NextResponse.json({
    data: appointments.map((a) => ({
      id: a.id,
      date: a.date,
      duration: a.duration,
      status: a.status,
      modality: a.modality,
      client: a.client,
      service: a.service,
      professional: a.professionalUser,
      notes: a.notes,
      price: a.price,
    })),
  })
}

/**
 * POST /api/v1/appointments — cria um agendamento em nome do tenant dono do token.
 * Requer escopo "appointments:write".
 *
 * Body esperado:
 * {
 *   "scheduleId": "...",         // obrigatório
 *   "serviceId": "...",          // opcional
 *   "professionalId": "...",     // opcional
 *   "date": "2026-08-01T14:00:00.000Z", // ISO 8601, obrigatório
 *   "duration": 30,              // minutos, opcional (default: duração do serviço ou 30)
 *   "modality": "PRESENCIAL",    // opcional
 *   "notes": "...",              // opcional
 *   "clientId": "...",           // use isto OU (clientName + clientPhone)
 *   "clientName": "...",
 *   "clientPhone": "...",
 *   "clientEmail": "..."         // opcional
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Token de API inválido ou ausente' }, { status: 401 })
  }
  if (!hasScope(auth, 'appointments:write')) {
    return NextResponse.json({ error: 'Token sem permissão de escrita (appointments:write)' }, { status: 403 })
  }

  const rate = await checkRateLimit(auth.tokenId)
  if (!rate.success) {
    return NextResponse.json({ error: 'Limite de requisições excedido. Tente novamente em instantes.' }, { status: 429 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido no corpo da requisição' }, { status: 400 })
  }

  const {
    scheduleId,
    serviceId,
    professionalId,
    date,
    duration,
    modality = 'PRESENCIAL',
    notes,
    clientId,
    clientName,
    clientPhone,
    clientEmail,
  } = body

  if (!scheduleId || !date) {
    return NextResponse.json({ error: 'Campos obrigatórios: scheduleId, date' }, { status: 400 })
  }

  if (!clientId && (!clientName || !clientPhone)) {
    return NextResponse.json(
      { error: 'Informe clientId, ou clientName + clientPhone para criar um novo cliente' },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, planType: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
  }

  const quota = await checkAppointmentQuota(user.id, user.planType ?? 'BASICO')
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: 'Limite de agendamentos do mês atingido para este plano.',
        code: 'APPOINTMENT_LIMIT_REACHED',
        currentCount: quota.currentCount,
        remaining: quota.remaining,
      },
      { status: 403 }
    )
  }

  let service = null
  if (serviceId) {
    service = await prisma.service.findFirst({ where: { id: serviceId, userId: user.id } })
    if (!service) {
      return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })
    }
  }

  const schedule = await prisma.schedule.findFirst({ where: { id: scheduleId, userId: user.id } })
  if (!schedule) {
    return NextResponse.json({ error: 'Agenda não encontrada' }, { status: 404 })
  }

  const appointmentDate = new Date(date)
  if (Number.isNaN(appointmentDate.getTime())) {
    return NextResponse.json({ error: 'Campo "date" inválido — use um formato ISO 8601' }, { status: 400 })
  }

  const finalDuration = duration || service?.duration || 30

  const hasConflict = await checkScheduleConflict({
    scheduleId,
    professionalId,
    date: appointmentDate,
    duration: finalDuration,
  })

  if (hasConflict) {
    return NextResponse.json({ error: 'Já existe um agendamento neste horário para esta agenda e profissional' }, { status: 409 })
  }

  let client = clientId
    ? await prisma.client.findFirst({ where: { id: clientId, userId: user.id } })
    : await prisma.client.findFirst({ where: { userId: user.id, phone: clientPhone } })

  if (clientId && !client) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  if (!client) {
    client = await prisma.client.create({
      data: {
        name: clientName,
        phone: clientPhone,
        email: clientEmail || null,
        userId: user.id,
      },
    })
  }

  const appointment = await prisma.appointment.create({
    data: {
      userId: user.id,
      clientId: client.id,
      scheduleId,
      serviceId: serviceId || null,
      professionalId: professionalId || null,
      date: appointmentDate,
      duration: finalDuration,
      status: 'SCHEDULED',
      modality,
      notes,
      price: service?.price ?? null,
    },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true } },
      professionalUser: { select: { id: true, name: true } },
      service: { select: { name: true } },
    },
  })

  try {
    const serviceName = appointment.service?.name || 'Serviço'
    await NotificationService.notifyAppointmentCreated(
      user.id,
      appointment.id,
      appointment.client.name,
      serviceName,
      appointment.date
    )

    const professionalName = appointment.professionalUser?.name || undefined
    await WhatsAppTriggerService.onAppointmentCreated(appointment as any, serviceName, professionalName)
  } catch (error) {
    console.error('Erro ao enviar notificações (API v1):', error)
  }

  return NextResponse.json(
    {
      data: {
        id: appointment.id,
        date: appointment.date,
        duration: appointment.duration,
        status: appointment.status,
        modality: appointment.modality,
        client: appointment.client,
        professional: appointment.professionalUser,
        price: appointment.price,
      },
    },
    { status: 201 }
  )
}
