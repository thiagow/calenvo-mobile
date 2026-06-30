
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
        userId: userId
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
      duration,
      status,
      modality,
      specialty,
      insurance,
      professional,
      notes,
      price,
      clientPackageItemId
    } = body

    // Verify appointment exists and belongs to user
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        id: params.id,
        userId: userId
      }
    })

    if (!existingAppointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Update appointment
    const updatedAppointment = await prisma.appointment.update({
      where: { id: params.id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(duration && { duration: Number(duration) }),
        ...(status && { status: status as AppointmentStatus }),
        ...(modality && { modality: modality as ModalityType }),
        ...(specialty !== undefined && { specialty }),
        ...(insurance !== undefined && { insurance }),
        ...(professional !== undefined && { professional }),
        ...(notes !== undefined && { notes }),
        ...(price !== undefined && { price: price ? parseFloat(price) : null }),
        ...(clientPackageItemId !== undefined && { clientPackageItemId })
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
      }
    })

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
            await NotificationService.notifyAppointmentConfirmed(
              userId,
              updatedAppointment.id,
              updatedAppointment.client.name,
              serviceName,
              updatedAppointment.date
            )
            // Enviar notificação via WhatsApp
            await WhatsAppTriggerService.onAppointmentConfirmed(
              updatedAppointment as any,
              serviceName,
              updatedAppointment.professional || undefined
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

    // Verify appointment exists and belongs to user
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        id: params.id,
        userId: userId
      }
    })

    if (!existingAppointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Delete appointment
    await prisma.appointment.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Appointment deleted successfully' })
  } catch (error) {
    console.error('Error deleting appointment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
