
import { prisma } from '@/lib/db'
import { NotificationType } from '@prisma/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface CreateNotificationParams {
  userId: string
  title: string
  message: string
  type: NotificationType
  appointmentId?: string
  metadata?: any
}

export class NotificationService {
  /**
   * Cria uma notificação interna
   */
  static async createNotification(params: CreateNotificationParams) {
    return await prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type,
        appointmentId: params.appointmentId,
        metadata: params.metadata,
      },
    })
  }

  /**
   * Busca notificações de um usuário
   */
  static async getUserNotifications(userId: string, unreadOnly = false) {
    return await prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      include: {
        appointment: {
          include: {
            client: true,
            service: true,
            schedule: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    })
  }

  /**
   * Marca notificação como lida
   */
  static async markAsRead(notificationId: string) {
    return await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
  }

  /**
   * Marca todas as notificações como lidas
   */
  static async markAllAsRead(userId: string) {
    return await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
  }

  /**
   * Conta notificações não lidas
   */
  static async getUnreadCount(userId: string) {
    return await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    })
  }

  /**
   * Notificação de agendamento criado
   */
  static async notifyAppointmentCreated(
    userId: string,
    appointmentId: string,
    clientName: string,
    serviceName: string,
    date: Date
  ) {
    const formattedDate = format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    
    return await this.createNotification({
      userId,
      title: 'Novo agendamento criado',
      message: `Agendamento de ${serviceName} para ${clientName} em ${formattedDate}`,
      type: 'APPOINTMENT_CREATED',
      appointmentId,
      metadata: { clientName, serviceName, date: date.toISOString() },
    })
  }

  /**
   * Notificação de agendamento confirmado
   */
  static async notifyAppointmentConfirmed(
    userId: string,
    appointmentId: string,
    clientName: string,
    serviceName: string,
    date: Date
  ) {
    const formattedDate = format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    
    return await this.createNotification({
      userId,
      title: 'Agendamento confirmado',
      message: `${clientName} confirmou o agendamento de ${serviceName} em ${formattedDate}`,
      type: 'APPOINTMENT_CONFIRMED',
      appointmentId,
      metadata: { clientName, serviceName, date: date.toISOString() },
    })
  }

  /**
   * Notificação de agendamento cancelado
   */
  static async notifyAppointmentCancelled(
    userId: string,
    appointmentId: string,
    clientName: string,
    serviceName: string,
    date: Date
  ) {
    const formattedDate = format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    
    return await this.createNotification({
      userId,
      title: 'Agendamento cancelado',
      message: `Agendamento de ${serviceName} para ${clientName} em ${formattedDate} foi cancelado`,
      type: 'APPOINTMENT_CANCELLED',
      appointmentId,
      metadata: { clientName, serviceName, date: date.toISOString() },
    })
  }

  /**
   * Notificação de lembrete de agendamento
   */
  static async notifyAppointmentReminder(
    userId: string,
    appointmentId: string,
    clientName: string,
    serviceName: string,
    date: Date
  ) {
    const formattedDate = format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    
    return await this.createNotification({
      userId,
      title: 'Lembrete de agendamento',
      message: `Lembrete: ${clientName} tem agendamento de ${serviceName} em ${formattedDate}`,
      type: 'APPOINTMENT_REMINDER',
      appointmentId,
      metadata: { clientName, serviceName, date: date.toISOString() },
    })
  }

  /**
   * Notificação de agendamento reagendado
   */
  static async notifyAppointmentRescheduled(
    userId: string,
    appointmentId: string,
    clientName: string,
    serviceName: string,
    oldDate: Date,
    newDate: Date
  ) {
    const formattedOldDate = format(oldDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    const formattedNewDate = format(newDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    
    return await this.createNotification({
      userId,
      title: 'Agendamento reagendado',
      message: `Agendamento de ${serviceName} para ${clientName} foi reagendado de ${formattedOldDate} para ${formattedNewDate}`,
      type: 'APPOINTMENT_RESCHEDULED',
      appointmentId,
      metadata: { 
        clientName, 
        serviceName, 
        oldDate: oldDate.toISOString(), 
        newDate: newDate.toISOString() 
      },
    })
  }

  /**
   * Notificação de agendamento concluído
   */
  static async notifyAppointmentCompleted(
    userId: string,
    appointmentId: string,
    clientName: string,
    serviceName: string,
    date: Date
  ) {
    const formattedDate = format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    
    return await this.createNotification({
      userId,
      title: 'Agendamento concluído',
      message: `Agendamento de ${serviceName} para ${clientName} em ${formattedDate} foi concluído`,
      type: 'APPOINTMENT_COMPLETED',
      appointmentId,
      metadata: { clientName, serviceName, date: date.toISOString() },
    })
  }

  /**
   * Notificação de limite de agendamentos se aproximando
   */
  static async notifyPlanLimitApproaching(
    userId: string,
    planType: string,
    remainingAppointments: number
  ) {
    const planNames: Record<string, string> = {
      'FREEMIUM': 'Freemium',
      'STANDARD': 'Standard',
      'PREMIUM': 'Premium'
    }
    
    const planName = planNames[planType] || planType
    
    return await this.createNotification({
      userId,
      title: '⚠️ Limite de agendamentos se aproximando',
      message: `Atenção! Restam apenas ${remainingAppointments} agendamentos no seu plano ${planName} este mês. Considere fazer upgrade para evitar interrupções.`,
      type: 'SYSTEM',
      metadata: { 
        planType, 
        remainingAppointments,
        action: 'upgrade_plan'
      },
    })
  }
}
