
/**
 * WhatsApp Service (Legacy)
 * @deprecated This service interacts directly with Evolution API.
 * As of v3.0, the application uses n8n workflows for WhatsApp integration.
 * Refer to WhatsAppTriggerService and app/actions/whatsapp.ts for current implementation.
 */

import { prisma } from '@/lib/db'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface EvolutionAPIConfig {
  apiUrl: string
  apiKey: string
  instanceName: string
}

export interface SendMessageParams {
  number: string
  message: string
}

export class WhatsAppService {
  /**
   * Cria uma nova instância na Evolution API
   */
  static async createInstance(userId: string, instanceName: string, apiUrl: string) {
    try {
      // Gera um nome único para a instância
      const uniqueInstanceName = `${instanceName}_${Date.now()}`
      
      const response = await fetch(`${apiUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceName: uniqueInstanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      })

      if (!response.ok) {
        throw new Error(`Erro ao criar instância: ${response.statusText}`)
      }

      const data = await response.json()

      // Salva a configuração no banco de dados
      const config = await prisma.whatsAppConfig.upsert({
        where: { userId },
        create: {
          userId,
          instanceName: uniqueInstanceName,
          apiUrl,
          apiKey: data.apikey || '',
          isConnected: false,
        },
        update: {
          instanceName: uniqueInstanceName,
          apiUrl,
          apiKey: data.apikey || '',
          isConnected: false,
        },
      })

      return {
        success: true,
        instanceName: uniqueInstanceName,
        apiKey: data.apikey,
        config,
      }
    } catch (error) {
      console.error('Erro ao criar instância:', error)
      throw error
    }
  }

  /**
   * Obtém o QR Code para conexão
   */
  static async getQRCode(userId: string) {
    try {
      const config = await prisma.whatsAppConfig.findUnique({
        where: { userId },
      })

      if (!config) {
        throw new Error('Configuração não encontrada')
      }

      const response = await fetch(
        `${config.apiUrl}/instance/connect/${config.instanceName}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: config.apiKey || '',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Erro ao obter QR Code: ${response.statusText}`)
      }

      const data = await response.json()

      // Atualiza o QR Code no banco
      await prisma.whatsAppConfig.update({
        where: { userId },
        data: {
          qrCode: data.base64 || data.code || data.qrcode?.base64,
        },
      })

      return {
        success: true,
        qrCode: data.base64 || data.code || data.qrcode?.base64,
      }
    } catch (error) {
      console.error('Erro ao obter QR Code:', error)
      throw error
    }
  }

  /**
   * Verifica o status da conexão
   */
  static async checkConnectionStatus(userId: string) {
    try {
      const config = await prisma.whatsAppConfig.findUnique({
        where: { userId },
      })

      if (!config) {
        throw new Error('Configuração não encontrada')
      }

      const response = await fetch(
        `${config.apiUrl}/instance/connectionState/${config.instanceName}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: config.apiKey || '',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Erro ao verificar status: ${response.statusText}`)
      }

      const data = await response.json()
      const isConnected = data.state === 'open' || data.instance?.state === 'open'

      // Atualiza o status no banco
      await prisma.whatsAppConfig.update({
        where: { userId },
        data: {
          isConnected,
          phoneNumber: data.instance?.profilePictureUrl || config.phoneNumber,
        },
      })

      return {
        success: true,
        isConnected,
        state: data.state || data.instance?.state,
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error)
      throw error
    }
  }

  /**
   * Envia uma mensagem via WhatsApp
   */
  static async sendMessage(userId: string, params: SendMessageParams) {
    try {
      const config = await prisma.whatsAppConfig.findUnique({
        where: { userId },
      })

      if (!config || !config.isConnected || !config.enabled) {
        console.log('WhatsApp não configurado ou desabilitado para usuário:', userId)
        return { success: false, message: 'WhatsApp não configurado' }
      }

      // Remove caracteres não numéricos do número
      const cleanNumber = params.number.replace(/\D/g, '')
      
      // Adiciona o código do país se não tiver
      const phoneNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`

      const response = await fetch(`${config.apiUrl}/message/sendText/${config.instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: config.apiKey || '',
        },
        body: JSON.stringify({
          number: `${phoneNumber}@s.whatsapp.net`,
          text: params.message,
        }),
      })

      if (!response.ok) {
        throw new Error(`Erro ao enviar mensagem: ${response.statusText}`)
      }

      const data = await response.json()

      return {
        success: true,
        messageId: data.key?.id,
        data,
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  }

  /**
   * Envia notificação de agendamento criado via WhatsApp
   */
  static async sendAppointmentCreatedMessage(
    userId: string,
    clientName: string,
    clientPhone: string,
    serviceName: string,
    date: Date,
    businessName?: string
  ) {
    const formattedDate = format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    const business = businessName || 'nossa empresa'
    
    const message = `
Olá ${clientName}! 👋

Seu agendamento foi criado com sucesso! ✅

📋 *Detalhes do Agendamento:*
• Serviço: ${serviceName}
• Data e Hora: ${formattedDate}
• Local: ${business}

Aguardamos você! 😊

_Para cancelar ou reagendar, entre em contato conosco._
`.trim()

    return await this.sendMessage(userId, {
      number: clientPhone,
      message,
    })
  }

  /**
   * Envia notificação de agendamento confirmado via WhatsApp
   */
  static async sendAppointmentConfirmedMessage(
    userId: string,
    clientName: string,
    clientPhone: string,
    serviceName: string,
    date: Date,
    businessName?: string
  ) {
    const formattedDate = format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    const business = businessName || 'nossa empresa'
    
    const message = `
Olá ${clientName}! 👋

Seu agendamento foi *confirmado*! ✅

📋 *Detalhes do Agendamento:*
• Serviço: ${serviceName}
• Data e Hora: ${formattedDate}
• Local: ${business}

Aguardamos você! 😊
`.trim()

    return await this.sendMessage(userId, {
      number: clientPhone,
      message,
    })
  }

  /**
   * Envia notificação de agendamento cancelado via WhatsApp
   */
  static async sendAppointmentCancelledMessage(
    userId: string,
    clientName: string,
    clientPhone: string,
    serviceName: string,
    date: Date
  ) {
    const formattedDate = format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    
    const message = `
Olá ${clientName}! 👋

Seu agendamento foi *cancelado*. ❌

📋 *Agendamento cancelado:*
• Serviço: ${serviceName}
• Data e Hora: ${formattedDate}

Se desejar reagendar, entre em contato conosco! 😊
`.trim()

    return await this.sendMessage(userId, {
      number: clientPhone,
      message,
    })
  }

  /**
   * Envia lembrete de agendamento via WhatsApp
   */
  static async sendAppointmentReminderMessage(
    userId: string,
    clientName: string,
    clientPhone: string,
    serviceName: string,
    date: Date,
    businessName?: string
  ) {
    const formattedDate = format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    const business = businessName || 'nossa empresa'
    
    const message = `
Olá ${clientName}! 👋

🔔 *Lembrete de Agendamento*

📋 *Detalhes:*
• Serviço: ${serviceName}
• Data e Hora: ${formattedDate}
• Local: ${business}

Não esqueça! Aguardamos você! 😊

_Para cancelar ou reagendar, entre em contato conosco._
`.trim()

    return await this.sendMessage(userId, {
      number: clientPhone,
      message,
    })
  }

  /**
   * Desconecta a instância
   */
  static async disconnectInstance(userId: string) {
    try {
      const config = await prisma.whatsAppConfig.findUnique({
        where: { userId },
      })

      if (!config) {
        throw new Error('Configuração não encontrada')
      }

      const response = await fetch(
        `${config.apiUrl}/instance/logout/${config.instanceName}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            apikey: config.apiKey || '',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Erro ao desconectar: ${response.statusText}`)
      }

      // Atualiza o status no banco
      await prisma.whatsAppConfig.update({
        where: { userId },
        data: {
          isConnected: false,
          qrCode: null,
        },
      })

      return { success: true }
    } catch (error) {
      console.error('Erro ao desconectar instância:', error)
      throw error
    }
  }

  /**
   * Deleta a instância
   */
  static async deleteInstance(userId: string) {
    try {
      const config = await prisma.whatsAppConfig.findUnique({
        where: { userId },
      })

      if (!config) {
        throw new Error('Configuração não encontrada')
      }

      const response = await fetch(
        `${config.apiUrl}/instance/delete/${config.instanceName}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            apikey: config.apiKey || '',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Erro ao deletar instância: ${response.statusText}`)
      }

      // Remove a configuração do banco
      await prisma.whatsAppConfig.delete({
        where: { userId },
      })

      return { success: true }
    } catch (error) {
      console.error('Erro ao deletar instância:', error)
      throw error
    }
  }
}
