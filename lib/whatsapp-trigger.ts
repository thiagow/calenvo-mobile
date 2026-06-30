/**
 * WhatsApp Notification Trigger Service v3.2
 * 
 * Centralized service for sending automated notifications to clients.
 * Interacts with n8n real-time messaging endpoint with exponential backoff.
 */

import { prisma } from './db';
import { Appointment, Client } from '@prisma/client';
import axios from 'axios';
import { formatWhatsAppNumber } from './utils';

/**
 * Helper for exponential backoff delay
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class WhatsAppTriggerService {
  /** Real-time messaging endpoint */
  private static sendMessageUrl = process.env.N8N_SEND_MESSAGE_URL;

  /**
   * Replace mustache-style variables in message templates.
   * Supported: {{nome_cliente}}, {{data}}, {{hora}}, {{servico}}, {{profissional}}, {{empresa}}
   */
  private static replaceVariables(
    template: string,
    data: {
      clientName: string;
      appointmentDate: Date;
      serviceName?: string;
      professionalName?: string;
      businessName?: string;
    }
  ): string {
    const dateFormatted = new Date(data.appointmentDate).toLocaleDateString('pt-BR');
    const timeFormatted = new Date(data.appointmentDate).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return template
      .replace(/\{\{nome_cliente\}\}/g, data.clientName)
      .replace(/\{\{data\}\}/g, dateFormatted)
      .replace(/\{\{hora\}\}/g, timeFormatted)
      .replace(/\{\{servico\}\}/g, data.serviceName || 'Agendamento')
      .replace(/\{\{profissional\}\}/g, data.professionalName || 'Equipe')
      .replace(/\{\{empresa\}\}/g, data.businessName || 'Nossa Empresa');
  }

  /**
   * Send message to n8n with automatic exponential backoff retry
   */
  private static async sendToN8n(
    instanceName: string,
    recipient: string,
    message: string,
    attempt: number = 1
  ): Promise<boolean> {
    if (!this.sendMessageUrl) {
      console.warn('[WhatsAppTrigger] N8N_SEND_MESSAGE_URL not configured');
      return false;
    }

    // Format recipient number (ensure 55 DDI)
    const formattedRecipient = formatWhatsAppNumber(recipient);

    const MAX_RETRIES = 3;
    const BASE_DELAY = 1000;

    try {
      await axios.post(
        this.sendMessageUrl,
        {
          instancia: instanceName,
          mensagem: message,
          destinatario: formattedRecipient,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      console.log(`[WhatsAppTrigger] Message sent to ${formattedRecipient} via ${instanceName}`);
      return true;
    } catch (error: any) {
      if (attempt >= MAX_RETRIES) {
        console.error(`[WhatsAppTrigger] Failed after ${MAX_RETRIES} attempts to ${formattedRecipient}:`, error.message);
        return false;
      }

      const delay = BASE_DELAY * Math.pow(2, attempt - 1);
      console.warn(`[WhatsAppTrigger] Attempt ${attempt} failed for ${formattedRecipient}. Retrying in ${delay}ms...`);
      
      await sleep(delay);
      return this.sendToN8n(instanceName, recipient, message, attempt + 1);
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

      if (!config || !config.enabled || !config.isConnected || !config.notifyOnCreate) return;
      if (!appointment.client.phone) return;

      const message = this.replaceVariables(config.createMessage || '', {
        clientName: appointment.client.name,
        appointmentDate: appointment.date,
        serviceName,
        professionalName,
        businessName: appointment.user.businessName || undefined,
      });

      await this.sendToN8n(config.instanceName, appointment.client.phone, message);
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

      if (!config || !config.enabled || !config.isConnected || !config.notifyOnCancel) return;
      if (!appointment.client.phone) return;

      const message = this.replaceVariables(config.cancelMessage || '', {
        clientName: appointment.client.name,
        appointmentDate: appointment.date,
        serviceName,
        professionalName,
        businessName: appointment.user.businessName || undefined,
      });

      await this.sendToN8n(config.instanceName, appointment.client.phone, message);
    } catch (error) {
      console.error('[WhatsAppTrigger] Error in onAppointmentCancelled:', error);
    }
  }

  /**
   * Trigger notification on appointment confirmation
   */
  static async onAppointmentConfirmed(
    appointment: Appointment & { client: Client; user: { businessName?: string | null } },
    serviceName?: string,
    professionalName?: string
  ): Promise<void> {
    try {
      const config = await prisma.whatsAppConfig.findUnique({
        where: { userId: appointment.userId },
      });

      if (!config || !config.enabled || !config.isConnected || !config.notifyConfirmation) return;
      if (!appointment.client.phone) return;

      const message = this.replaceVariables(config.confirmationMessage || '', {
        clientName: appointment.client.name,
        appointmentDate: appointment.date,
        serviceName,
        professionalName,
        businessName: appointment.user.businessName || undefined,
      });

      await this.sendToN8n(config.instanceName, appointment.client.phone, message);
    } catch (error) {
      console.error('[WhatsAppTrigger] Error in onAppointmentConfirmed:', error);
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

      if (!config || !config.enabled || !config.isConnected || !config.notifyReminder) return;
      if (!appointment.client.phone) return;

      const message = this.replaceVariables(config.reminderMessage || '', {
        clientName: appointment.client.name,
        appointmentDate: appointment.date,
        serviceName,
        professionalName,
        businessName: appointment.user.businessName || undefined,
      });

      await this.sendToN8n(config.instanceName, appointment.client.phone, message);
    } catch (error) {
      console.error('[WhatsAppTrigger] Error in onAppointmentReminder:', error);
    }
  }
}
