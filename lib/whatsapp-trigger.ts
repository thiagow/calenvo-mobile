/**
 * WhatsApp Notification Trigger Service
 *
 * Centralized service for sending automated notifications to clients.
 * Fala direto com a Uazapi via `lib/uazapi.ts` (retry/backoff já embutido
 * no client — não duplicamos aqui como na versão n8n).
 */

import { prisma } from './db';
import { Appointment, Client } from '@prisma/client';
import { formatWhatsAppNumber } from './utils';
import { decryptSecret } from './crypto';
import { sendText } from './uazapi';

export const DEFAULT_PROFESSIONAL_CANCEL_MESSAGE =
  'O cliente {{nome_cliente}} cancelou o agendamento de {{servico}} em {{data}} às {{hora}}.';
export const DEFAULT_PROFESSIONAL_BOOKING_MESSAGE =
  'Novo agendamento: {{nome_cliente}} agendou {{servico}} em {{data}} às {{hora}}.';

export class WhatsAppTriggerService {
  /**
   * WhatsApp do profissional responsável, com fallback para o dono do negócio.
   */
  private static resolveProfessionalRecipient(appointment: {
    user: { whatsapp?: string | null; phone?: string | null };
    professionalUser?: { whatsapp?: string | null; phone?: string | null } | null;
  }): string | null {
    return (
      appointment.professionalUser?.whatsapp ||
      appointment.professionalUser?.phone ||
      appointment.user.whatsapp ||
      appointment.user.phone ||
      null
    );
  }

  /**
   * Replace mustache-style variables in message templates.
   * Supported: {{nome_cliente}}, {{data}}, {{hora}}, {{servico}}, {{profissional}}, {{empresa}}, {{link_avaliacao}}, {{link_confirmacao}}
   */
  private static replaceVariables(
    template: string,
    data: {
      clientName: string;
      appointmentDate: Date;
      serviceName?: string;
      professionalName?: string;
      businessName?: string;
      reviewLink?: string;
      confirmationLink?: string;
    }
  ): string {
    const dateFormatted = new Date(data.appointmentDate).toLocaleDateString('pt-BR');
    const timeFormatted = new Date(data.appointmentDate).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let message = template
      .replace(/\{\{nome_cliente\}\}/g, data.clientName)
      .replace(/\{\{data\}\}/g, dateFormatted)
      .replace(/\{\{hora\}\}/g, timeFormatted)
      .replace(/\{\{servico\}\}/g, data.serviceName || 'Agendamento')
      .replace(/\{\{profissional\}\}/g, data.professionalName || 'Equipe')
      .replace(/\{\{empresa\}\}/g, data.businessName || 'Nossa Empresa')
      .replace(/\{\{link_avaliacao\}\}/g, data.reviewLink || '')
      .replace(/\{\{link_confirmacao\}\}/g, data.confirmationLink || '');

    // Degradação graciosa: templates salvos antes de {{link_confirmacao}} existir
    // não têm a variável — anexa o link no fim pra ninguém precisar editar nada.
    if (data.confirmationLink && !template.includes('{{link_confirmacao}}')) {
      message += `\n\nConfirme sua presença aqui:\n${data.confirmationLink}`;
    }

    return message.trim();
  }

  /**
   * Descriptografa o token da instância e envia via Uazapi. Retry/backoff em
   * 429/5xx já acontece dentro de `sendText` (`lib/uazapi.ts`) — não
   * duplicamos aqui como fazia a versão n8n.
   */
  private static async sendViaUazapi(
    encryptedInstanceToken: string,
    recipient: string,
    message: string
  ): Promise<boolean> {
    const formattedRecipient = formatWhatsAppNumber(recipient);

    try {
      await sendText(decryptSecret(encryptedInstanceToken), formattedRecipient, message);
      console.log(`[WhatsAppTrigger] Message sent to ${formattedRecipient}`);
      return true;
    } catch (error) {
      console.error(`[WhatsAppTrigger] Failed to send to ${formattedRecipient}:`, error);
      return false;
    }
  }

  /**
   * Trigger notification on appointment creation
   */
  static async onAppointmentCreated(
    appointment: Appointment & { client: Client; user: { businessName?: string | null } },
    serviceName?: string,
    professionalName?: string
  ): Promise<void> {
    try {
      const config = await prisma.whatsAppConfig.findUnique({
        where: { userId: appointment.userId },
      });

      if (!config || !config.enabled || !config.isConnected || !config.apiKey || !config.notifyOnCreate) return;
      if (!appointment.client.phone) return;

      const message = this.replaceVariables(config.createMessage || '', {
        clientName: appointment.client.name,
        appointmentDate: appointment.date,
        serviceName,
        professionalName,
        businessName: appointment.user.businessName || undefined,
      });

      await this.sendViaUazapi(config.apiKey, appointment.client.phone, message);
    } catch (error) {
      console.error('[WhatsAppTrigger] Error in onAppointmentCreated:', error);
    }
  }

  /**
   * Trigger notification on appointment cancellation
   */
  static async onAppointmentCancelled(
    appointment: Appointment & { client: Client; user: { businessName?: string | null } },
    serviceName?: string,
    professionalName?: string
  ): Promise<void> {
    try {
      const config = await prisma.whatsAppConfig.findUnique({
        where: { userId: appointment.userId },
      });

      if (!config || !config.enabled || !config.isConnected || !config.apiKey || !config.notifyOnCancel) return;
      if (!appointment.client.phone) return;

      const message = this.replaceVariables(config.cancelMessage || '', {
        clientName: appointment.client.name,
        appointmentDate: appointment.date,
        serviceName,
        professionalName,
        businessName: appointment.user.businessName || undefined,
      });

      await this.sendViaUazapi(config.apiKey, appointment.client.phone, message);
    } catch (error) {
      console.error('[WhatsAppTrigger] Error in onAppointmentCancelled:', error);
    }
  }

  /**
   * Trigger notification to the PROFESSIONAL (not the client) when the client
   * cancels their own appointment via public booking or the chat widget.
   */
  static async onAppointmentCancelledByClient(
    appointment: Appointment & {
      client: Client;
      user: { businessName?: string | null; whatsapp?: string | null; phone?: string | null };
      professionalUser?: { whatsapp?: string | null; phone?: string | null } | null;
    },
    serviceName?: string,
    professionalName?: string
  ): Promise<void> {
    try {
      const config = await prisma.whatsAppConfig.findUnique({
        where: { userId: appointment.userId },
      });

      if (!config || !config.enabled || !config.isConnected || !config.apiKey || !config.notifyProfessionalOnCancel) return;

      const recipient = this.resolveProfessionalRecipient(appointment);
      if (!recipient) return;

      const message = this.replaceVariables(config.professionalCancelMessage || DEFAULT_PROFESSIONAL_CANCEL_MESSAGE, {
        clientName: appointment.client.name,
        appointmentDate: appointment.date,
        serviceName,
        professionalName,
        businessName: appointment.user.businessName || undefined,
      });

      await this.sendViaUazapi(config.apiKey, recipient, message);
    } catch (error) {
      console.error('[WhatsAppTrigger] Error in onAppointmentCancelledByClient:', error);
    }
  }

  /**
   * Trigger notification to the PROFESSIONAL (not the client) when the client
   * books an appointment themselves via public booking or the chat widget.
   */
  static async onAppointmentCreatedByClient(
    appointment: Appointment & {
      client: Client;
      user: { businessName?: string | null; whatsapp?: string | null; phone?: string | null };
      professionalUser?: { whatsapp?: string | null; phone?: string | null } | null;
    },
    serviceName?: string,
    professionalName?: string
  ): Promise<void> {
    try {
      const config = await prisma.whatsAppConfig.findUnique({
        where: { userId: appointment.userId },
      });

      if (!config || !config.enabled || !config.isConnected || !config.apiKey || !config.notifyProfessionalOnBooking) return;

      const recipient = this.resolveProfessionalRecipient(appointment);
      if (!recipient) return;

      const message = this.replaceVariables(config.professionalBookingMessage || DEFAULT_PROFESSIONAL_BOOKING_MESSAGE, {
        clientName: appointment.client.name,
        appointmentDate: appointment.date,
        serviceName,
        professionalName,
        businessName: appointment.user.businessName || undefined,
      });

      await this.sendViaUazapi(config.apiKey, recipient, message);
    } catch (error) {
      console.error('[WhatsAppTrigger] Error in onAppointmentCreatedByClient:', error);
    }
  }

  /**
   * Trigger the "please confirm attendance" request, sent X days before the
   * appointment with a link to /c/<token>. Returns whether the send actually
   * succeeded — unlike the other trigger methods — because the caller uses
   * it to decide whether to keep or release the anti-duplicate claim row.
   */
  static async onAppointmentConfirmationRequest(
    appointment: Appointment & { client: Client; user: { businessName?: string | null } },
    serviceName: string | undefined,
    professionalName: string | undefined,
    confirmationLink: string
  ): Promise<boolean> {
    try {
      const config = await prisma.whatsAppConfig.findUnique({
        where: { userId: appointment.userId },
      });

      if (!config || !config.enabled || !config.isConnected || !config.apiKey || !config.notifyConfirmation) return false;
      if (!appointment.client.phone) return false;

      const message = this.replaceVariables(config.confirmationMessage || '', {
        clientName: appointment.client.name,
        appointmentDate: appointment.date,
        serviceName,
        professionalName,
        businessName: appointment.user.businessName || undefined,
        confirmationLink,
      });

      return await this.sendViaUazapi(config.apiKey, appointment.client.phone, message);
    } catch (error) {
      console.error('[WhatsAppTrigger] Error in onAppointmentConfirmationRequest:', error);
      return false;
    }
  }

  /**
   * Trigger notification for appointment reminder
   */
  static async onAppointmentReminder(
    appointment: Appointment & { client: Client; user: { businessName?: string | null } },
    serviceName?: string,
    professionalName?: string
  ): Promise<void> {
    try {
      const config = await prisma.whatsAppConfig.findUnique({
        where: { userId: appointment.userId },
      });

      if (!config || !config.enabled || !config.isConnected || !config.apiKey || !config.notifyReminder) return;
      if (!appointment.client.phone) return;

      const message = this.replaceVariables(config.reminderMessage || '', {
        clientName: appointment.client.name,
        appointmentDate: appointment.date,
        serviceName,
        professionalName,
        businessName: appointment.user.businessName || undefined,
      });

      await this.sendViaUazapi(config.apiKey, appointment.client.phone, message);
    } catch (error) {
      console.error('[WhatsAppTrigger] Error in onAppointmentReminder:', error);
    }
  }

  /**
   * Trigger notification on appointment completion (with optional review link)
   */
  static async onAppointmentCompleted(
    appointment: Appointment & { client: Client; user: { businessName?: string | null } },
    serviceName?: string,
    professionalName?: string
  ): Promise<void> {
    try {
      const config = await prisma.whatsAppConfig.findUnique({
        where: { userId: appointment.userId },
      });

      if (!config || !config.enabled || !config.isConnected || !config.apiKey || !config.notifyOnCompleted) return;
      if (!appointment.client.phone) return;

      const message = this.replaceVariables(config.completedMessage || '', {
        clientName: appointment.client.name,
        appointmentDate: appointment.date,
        serviceName,
        professionalName,
        businessName: appointment.user.businessName || undefined,
        reviewLink: config.reviewLink || undefined,
      });

      await this.sendViaUazapi(config.apiKey, appointment.client.phone, message);
    } catch (error) {
      console.error('[WhatsAppTrigger] Error in onAppointmentCompleted:', error);
    }
  }
}
