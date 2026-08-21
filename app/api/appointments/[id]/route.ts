
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { AppointmentStatus, ModalityType } from '@prisma/client'
import { NotificationService } from '@/lib/notification-service'
import { WhatsAppService } from '@/lib/whatsapp-service'
import { WhatsAppTriggerService } from '@/lib/whatsapp-trigger'
import { processPackageDeduction } from '@/app/actions/packages'
import { processLoyaltyEarn } from '@/app/actions/loyalty'
import { checkBookingConflict, withBookingLock } from '@/lib/appointment-service'
import { DEFAULT_TIMEZONE, wallTimeToInstant } from '@/lib/timezone'
import { logError } from '@/lib/error-logger'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: params.id,
        userId: userId,
        deletedAt: null
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Transform the response
    const transformedAppointment = {
      id: appointment.id,
      date: appointment.date,
      patient: {
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
      professional: appointment.professional || 'Não definido',
      price: appointment.price
    }

    return NextResponse.json(transformedAppointment)
  } catch (error) {
    console.error('Error fetching appointment:', error)
    await logError({ functionality: 'appointment_get', error, metadata: { appointmentId: params.id } })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const {
      date,
      time,
      duration,
      status,
      modality,
      specialty,
      insurance,
      professional,
      notes,
      price,
      clientPackageItemId,
      forceOverbook
    } = body

    // Verify appointment exists and belongs to user
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        id: params.id,
        userId: userId,
        deletedAt: null
      }
    })

    if (!existingAppointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        canForceOverbook: true,
        businessConfig: { select: { timezone: true } }
      }
    })

    // Mesma conversão de hora de parede -> instante usada na criação e no motor
    // de slots: no fuso do negócio, resolvida no servidor.
    const timezone = user?.businessConfig?.timezone || DEFAULT_TIMEZONE
    let newDate: Date | undefined
    if (date) {
      newDate = time ? wallTimeToInstant(date, time, timezone) : new Date(date)
      if (Number.isNaN(newDate.getTime())) {
        return NextResponse.json({ error: 'Data ou horário inválido' }, { status: 400 })
      }
    }

    // Reagendamento: se data ou duração mudam, o novo horário não pode empilhar
    // em cima de outro compromisso do mesmo profissional (ou da mesma agenda,
    // pra agendas legadas sem profissional vinculado) — mesma regra aplicada na
    // criação. "Encaixe" segue exigindo a mesma permissão do POST.
    const dateChanged = Boolean(newDate) && newDate!.getTime() !== existingAppointment.date.getTime()
    const durationChanged = Boolean(duration) && Number(duration) !== existingAppointment.duration
    const isReschedule = (dateChanged || durationChanged) && Boolean(existingAppointment.scheduleId)

    const canOverbook = user?.role === 'MASTER' || user?.canForceOverbook === true
    if (forceOverbook && !canOverbook) {
      return NextResponse.json(
        { error: 'Você não tem permissão para criar encaixes' },
        { status: 403 }
      )
    }
    const allowOverbook = isReschedule && Boolean(forceOverbook) && canOverbook

    const updateData = {
      ...(newDate && { date: newDate }),
      ...(duration && { duration: Number(duration) }),
      ...(status && { status: status as AppointmentStatus }),
      ...(modality && { modality: modality as ModalityType }),
      ...(specialty !== undefined && { specialty }),
      ...(insurance !== undefined && { insurance }),
      ...(professional !== undefined && { professional }),
      ...(notes !== undefined && { notes }),
      ...(price !== undefined && { price: price ? parseFloat(price) : null }),
      ...(clientPackageItemId !== undefined && { clientPackageItemId })
      // `isOverbooked` não entra aqui: só o resultado da checagem sob lock,
      // abaixo, sabe se o novo horário estava mesmo ocupado.
    }

    const includeClause = {
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
              notifyOnCancel: true
            }
          }
        }
      }
    } as const

    // Reagendamento: checagem + escrita precisam ficar atômicas — sem isso,
    // dois PUTs concorrentes pro mesmo profissional podem ambos passar pelo
    // check-then-write e empilhar no mesmo horário. O encaixe também passa por
    // aqui: não pra ser bloqueado, mas pra que `isOverbooked` reflita se o
    // horário estava de fato ocupado.
    let updatedAppointment
    if (isReschedule) {
      const lockKey = existingAppointment.professionalId ?? existingAppointment.scheduleId!
      const result = await withBookingLock(lockKey, async (tx) => {
        const conflict = await checkBookingConflict({
          scheduleId: existingAppointment.scheduleId!,
          professionalId: existingAppointment.professionalId,
          date: newDate ?? existingAppointment.date,
          duration: duration ? Number(duration) : existingAppointment.duration,
          excludeAppointmentId: params.id,
          tx
        })
        if (conflict && !allowOverbook) {
          return { ok: false as const }
        }
        const appointment = await tx.appointment.update({
          where: { id: params.id },
          data: { ...updateData, ...(allowOverbook && { isOverbooked: conflict }) },
          include: includeClause
        })
        return { ok: true as const, appointment }
      })

      if (!result.ok) {
        return NextResponse.json(
          { error: 'Já existe um agendamento neste horário para este profissional' },
          { status: 409 }
        )
      }
      updatedAppointment = result.appointment
    } else {
      updatedAppointment = await prisma.appointment.update({
        where: { id: params.id },
        data: updateData,
        include: includeClause
      })
    }

    // Criar notificações baseadas na mudança de status
    try {
      const serviceName = updatedAppointment.service?.name || updatedAppointment.specialty || 'Serviço'
      const oldDate = existingAppointment.date
      const newDate = updatedAppointment.date

      // Se o status mudou
      if (status && status !== existingAppointment.status) {

        // --- INICIO: Lógica de Dedução de Pacotes ---
        if (status === 'COMPLETED') {
          let packageIdToDeduct = clientPackageItemId !== undefined ? clientPackageItemId : existingAppointment.clientPackageItemId;

          // Se não houver pacote selecionado explicitamente, busca o primeiro ativo vinculável
          if (!packageIdToDeduct && updatedAppointment.serviceId && existingAppointment.clientId) {
            const availableItems = await prisma.clientPackageItem.findMany({
              where: {
                serviceId: updatedAppointment.serviceId,
                clientPackage: {
                  clientId: existingAppointment.clientId,
                  status: 'ACTIVE'
                }
              },
              include: { clientPackage: true },
              orderBy: { clientPackage: { createdAt: 'asc' } }
            });

            // Pega o primeiro que ainda não esgotou
            const validItem = availableItems.find(item => item.usedSessions < item.totalSessions);

            if (validItem) {
              packageIdToDeduct = validItem.id;

              // Atualiza o agendamento para registrar qual item do pacote foi consumido
              await prisma.appointment.update({
                where: { id: params.id },
                data: { clientPackageItemId: packageIdToDeduct }
              });
            }
          }

          if (packageIdToDeduct) {
            const deductionResult = await processPackageDeduction(params.id, packageIdToDeduct, userId);

            // Se foi sucesso e o pacote todo esgotou, disparamos a notificação no painel
            if (deductionResult.success && deductionResult.isExhausted && deductionResult.packageData) {
              await prisma.notification.create({
                data: {
                  userId: userId,
                  title: 'Pacote Finalizado 📦',
                  message: `A agenda recém-concluída consumiu a última sessão do pacote "${deductionResult.packageData.name}" do cliente ${deductionResult.packageData.client.name}. Ofereça a renovação!`,
                  type: 'SYSTEM'
                }
              })
            } else if (deductionResult.success && deductionResult.isAlmostExhausted && deductionResult.packageData) {
              await prisma.notification.create({
                data: {
                  userId: userId,
                  title: 'Pacote Quase no Fim ⏳',
                  message: `Falta apenas 1 sessão para terminar o pacote "${deductionResult.packageData.name}" do cliente ${deductionResult.packageData.client.name}. Prepare o cliente para renovar.`,
                  type: 'SYSTEM'
                }
              })
            }
          }
        }
        // --- FIM: Lógica de Dedução de Pacotes ---

        // --- INICIO: Lógica de Fidelização ---
        if (status === 'COMPLETED') {
          try {
            const loyaltyResult = await processLoyaltyEarn(params.id, userId)
            if (loyaltyResult.success && !loyaltyResult.skipped && loyaltyResult.pointsEarned) {
              await prisma.notification.create({
                data: {
                  userId,
                  title: '⭐ Pontos de Fidelidade',
                  message: `${loyaltyResult.clientName} ganhou +${loyaltyResult.pointsEarned} ponto(s)! Saldo atual: ${loyaltyResult.newBalance} pontos.`,
                  type: 'SYSTEM'
                }
              })
            }
          } catch (loyaltyError) {
            console.error('Erro na fidelização (não bloqueante):', loyaltyError)
          }
        }
        // --- FIM: Lógica de Fidelização ---

        switch (status) {
          case 'CONFIRMED':
            // Notificação interna apenas — o WhatsApp de "confirme sua presença" é
            // para o CLIENTE confirmar, não para avisar que o dono já confirmou
            // (ver WhatsAppTriggerService.onAppointmentConfirmationRequest).
            await NotificationService.notifyAppointmentConfirmed(
              userId,
              updatedAppointment.id,
              updatedAppointment.client.name,
              serviceName,
              updatedAppointment.date
            )
            break

          case 'CANCELLED':
            await NotificationService.notifyAppointmentCancelled(
              userId,
              updatedAppointment.id,
              updatedAppointment.client.name,
              serviceName,
              updatedAppointment.date
            )
            // Enviar notificação via WhatsApp (usando novo sistema)
            await WhatsAppTriggerService.onAppointmentCancelled(
              updatedAppointment as any,
              serviceName,
              updatedAppointment.professional || undefined
            )
            break

          case 'COMPLETED':
            await NotificationService.notifyAppointmentCompleted(
              userId,
              updatedAppointment.id,
              updatedAppointment.client.name,
              serviceName,
              updatedAppointment.date
            )
            // Enviar notificação via WhatsApp (com link de avaliação opcional)
            await WhatsAppTriggerService.onAppointmentCompleted(
              updatedAppointment as any,
              serviceName,
              updatedAppointment.professional || undefined
            )
            break
        }
      }

      // Se a data mudou (reagendamento)
      if (date && oldDate.getTime() !== newDate.getTime()) {
        await NotificationService.notifyAppointmentRescheduled(
          userId,
          updatedAppointment.id,
          updatedAppointment.client.name,
          serviceName,
          oldDate,
          newDate
        )
      }
    } catch (error) {
      console.error('Erro ao enviar notificações:', error)
      // Não falhar a atualização se houver erro nas notificações
    }

    // Transform the response
    const transformedAppointment = {
      id: updatedAppointment.id,
      date: updatedAppointment.date,
      patient: {
        name: updatedAppointment.client.name,
        phone: updatedAppointment.client.phone,
        email: updatedAppointment.client.email
      },
      specialty: updatedAppointment.specialty || 'Consulta Geral',
      status: updatedAppointment.status,
      modality: updatedAppointment.modality,
      duration: updatedAppointment.duration,
      insurance: updatedAppointment.insurance || 'Particular',
      notes: updatedAppointment.notes || '',
      professional: updatedAppointment.professional || 'Não definido',
      price: updatedAppointment.price
    }

    return NextResponse.json(transformedAppointment)
  } catch (error) {
    console.error('Error updating appointment:', error)
    await logError({ functionality: 'appointment_update', error, metadata: { appointmentId: params.id } })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Verify appointment exists, belongs to user, and isn't already deleted
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        id: params.id,
        userId: userId,
        deletedAt: null
      }
    })

    if (!existingAppointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Soft delete: mantém o registro para histórico/auditoria, mas some das listagens
    await prisma.appointment.update({
      where: { id: params.id },
      data: { deletedAt: new Date() }
    })

    return NextResponse.json({ message: 'Appointment deleted successfully' })
  } catch (error) {
    console.error('Error deleting appointment:', error)
    await logError({ functionality: 'appointment_delete', error, metadata: { appointmentId: params.id } })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
