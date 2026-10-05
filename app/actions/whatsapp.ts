'use server';

/**
 * WhatsApp Server Actions
 * Chama a Uazapi diretamente (via `lib/uazapi.ts`) — sem n8n/Evolution.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { WhatsAppConfig } from '@prisma/client';
import { formatWhatsAppNumber } from '@/lib/utils';
import { logError } from '@/lib/error-logger';
import { parseWhatsAppError, USER_FRIENDLY_ERRORS } from '@/lib/error-messages';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import * as uazapi from '@/lib/uazapi';
import { DEFAULT_PROFESSIONAL_CANCEL_MESSAGE, DEFAULT_PROFESSIONAL_BOOKING_MESSAGE } from '@/lib/whatsapp-trigger';

/**
 * Extended user interface for NextAuth session
 */
interface ExtendedUser {
  id: string;
  email: string;
  name?: string;
}

/**
 * Extended session interface for NextAuth
 */
interface ExtendedSession {
  user: ExtendedUser;
}

/**
 * Standard action response state
 * @template T - Data payload type
 */
export type ActionState<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

/** `WhatsAppConfig` como ele deve sair para o client: sem o token da instância. */
export type PublicWhatsAppConfig = Omit<WhatsAppConfig, 'apiKey'>;

/**
 * Validation schema for instance creation
 */
const CreateInstanceSchema = z.object({
  phoneNumber: z.string().min(10, 'Número inválido'),
});

/**
 * Validation schema for WhatsApp notification settings
 */
const WhatsAppSettingsSchema = z.object({
  enabled: z.boolean(),
  notifyOnCreate: z.boolean(),
  createDelayMinutes: z.number().min(0),
  createMessage: z.string().max(120).optional(),
  notifyOnCancel: z.boolean(),
  cancelDelayMinutes: z.number().min(0),
  cancelMessage: z.string().max(120).optional(),
  notifyProfessionalOnCancel: z.boolean(),
  professionalCancelMessage: z.string().max(1000).optional(),
  notifyProfessionalOnBooking: z.boolean(),
  professionalBookingMessage: z.string().max(1000).optional(),
  notifyConfirmation: z.boolean(),
  confirmationDays: z.number().min(0),
  confirmationMessage: z.string().max(400).optional(),
  notifyReminder: z.boolean(),
  reminderHours: z.number().min(0),
  reminderMessage: z.string().max(120).optional(),
  notifyOnCompleted: z.boolean(),
  completedMessage: z.string().max(1000).optional(),
  reviewLink: z.string().url('Link inválido').optional().or(z.literal('')),
});

/**
 * Default message templates for notifications
 */
const DEFAULT_TEMPLATES = {
  createMessage: 'Olá {{nome_cliente}}! Seu agendamento foi confirmado para {{data}} às {{hora}}. Serviço: {{servico}}. Até breve!',
  cancelMessage: 'Olá {{nome_cliente}}, seu agendamento do dia {{data}} às {{hora}} foi cancelado. Entre em contato para reagendar.',
  professionalCancelMessage: DEFAULT_PROFESSIONAL_CANCEL_MESSAGE,
  professionalBookingMessage: DEFAULT_PROFESSIONAL_BOOKING_MESSAGE,
  confirmationMessage: 'Olá {{nome_cliente}}! Você tem {{servico}} em {{data}} às {{hora}}. Confirme sua presença: {{link_confirmacao}}',
  reminderMessage: 'Oi {{nome_cliente}}! Seu atendimento é daqui a poucas horas ({{hora}}). Te esperamos!',
  completedMessage: 'Olá {{nome_cliente}}, obrigado pela visita! Se puder, deixe sua avaliação: {{link_avaliacao}}',
};

/**
 * Quanto tempo o QR gerado pela Uazapi fica válido antes de considerarmos
 * "provavelmente expirado" na UI. A Uazapi não documenta esse valor — em
 * teste manual (2026-09-22) o timeout observado ficou perto de 60s. Isso é
 * só uma dica otimista para a UI oferecer "atualizar QR"; quem realmente
 * limpa o QR expirado é o webhook, ao receber o evento `disconnected` com
 * `lastDisconnectReason: "QR Code timeout"`.
 */
const QR_CODE_TTL_MS = 60_000;

/**
 * Internal instance states for UI logic
 */
enum InstanceState {
  NONE = 'none',              // No configuration in DB
  PENDING = 'pending',        // Config exists with QR, waiting scan
  QR_EXPIRED = 'qr_expired',  // QR exists but is past expiry time
  CONNECTED = 'connected',    // Config exists and marked as connected
  ERROR = 'error'             // Inconsistent state (exists but no data)
}

/**
 * Result structure for state check
 */
interface InstanceStateCheck {
  state: InstanceState;
  config: WhatsAppConfig | null;
  message?: string;
}

/**
 * Determines current instance state based on database config
 * @param userId - ID of the owner
 */
async function checkInstanceState(userId: string): Promise<InstanceStateCheck> {
  const config = await prisma.whatsAppConfig.findUnique({
    where: { userId },
  });

  if (!config) {
    return { state: InstanceState.NONE, config: null };
  }

  if (config.isConnected) {
    return { state: InstanceState.CONNECTED, config };
  }

  if (config.qrCodeExpiresAt && new Date(config.qrCodeExpiresAt) < new Date()) {
    return {
      state: InstanceState.QR_EXPIRED,
      config,
      message: 'QR Code expirou. Clique em "Atualizar QR Code".'
    };
  }

  if (config.qrCode && config.qrCode.length > 0) {
    return {
      state: InstanceState.PENDING,
      config,
      message: 'Instância criada. Escaneie o QR Code para conectar.'
    };
  }

  return {
    state: InstanceState.ERROR,
    config,
    message: 'Instância em estado inconsistente. Desconecte e tente novamente.'
  };
}

/**
 * Generates a unique instance name for a user.
 * Pattern: ${userId}-calenvo, ${userId}-calenvo-2, etc.
 * @param userId - Owner's user ID
 */
async function ensureUniqueInstanceName(userId: string): Promise<string> {
  const baseInstanceName = `${userId}-calenvo`;

  const existingBase = await prisma.whatsAppConfig.findFirst({
    where: { instanceName: baseInstanceName },
  });

  if (!existingBase) {
    return baseInstanceName;
  }

  for (let i = 2; i <= 10; i++) {
    const candidateName = `${userId}-calenvo-${i}`;
    const existing = await prisma.whatsAppConfig.findFirst({
      where: { instanceName: candidateName },
    });

    if (!existing) {
      return candidateName;
    }
  }

  throw new Error('Não foi possível gerar nome de instância único. Máximo de 10 instâncias atingido.');
}

/**
 * Monta a URL do nosso webhook com o segredo obrigatório embutido. Retorna
 * `null` (em vez de lançar) quando alguma env necessária está faltando, para
 * o chamador decidir a mensagem de erro voltada ao usuário.
 */
function buildWebhookUrl(): string | null {
  const secret = process.env.UAZAPI_WEBHOOK_SECRET;
  const appUrl = process.env.NEXTAUTH_URL;
  if (!secret || !appUrl) return null;
  return `${appUrl.replace(/\/+$/, '')}/api/webhooks/uazapi?secret=${secret}`;
}

/**
 * Create or reconnect the user's WhatsApp instance and get a QR Code.
 *
 * Se já existir uma instância Uazapi criada para este usuário (token salvo
 * em `apiKey`), reaproveita — só chama `connect` de novo pra gerar um QR
 * novo, sem criar uma instância duplicada no servidor Uazapi.
 *
 * @param phoneNumber - Número de referência (exibido na UI, não usado para autenticar)
 */
export async function createInstanceAction(
  phoneNumber: string
): Promise<ActionState<{ qrCode: string; instanceName: string }>> {
  try {
    const session = (await getServerSession(authOptions)) as ExtendedSession | null;
    if (!session?.user?.id) {
      return { success: false, error: 'Não autenticado' };
    }

    const validated = CreateInstanceSchema.parse({ phoneNumber });

    const webhookUrl = buildWebhookUrl();
    if (!webhookUrl) {
      return { success: false, error: 'Integração com WhatsApp não configurada (UAZAPI_WEBHOOK_SECRET/NEXTAUTH_URL ausentes).' };
    }

    const existingConfig = await prisma.whatsAppConfig.findUnique({
      where: { userId: session.user.id },
    });

    let instanceName: string;
    let instanceToken: string;

    if (existingConfig?.apiKey) {
      // Já existe instância Uazapi para este usuário — reconecta em vez de criar outra.
      instanceName = existingConfig.instanceName;
      instanceToken = decryptSecret(existingConfig.apiKey);
    } else {
      instanceName = existingConfig?.instanceName || await ensureUniqueInstanceName(session.user.id);
      const created = await uazapi.createInstance(instanceName);
      instanceToken = created.token;
    }

    // Idempotente: reconfigurar o webhook numa instância que já tem um
    // registrado não tem custo além da chamada.
    await uazapi.setWebhook(instanceToken, {
      url: webhookUrl,
      events: ['connection'],
      excludeMessages: ['wasSentByApi'],
    });

    const instance = await uazapi.connect(instanceToken);
    if (!instance.qrcode) {
      return { success: false, error: 'A Uazapi não retornou um QR Code. Tente novamente.' };
    }

    const sharedData = {
      instanceName,
      apiKey: encryptSecret(instanceToken),
      apiUrl: process.env.UAZAPI_BASE_URL || '',
      phoneNumber: validated.phoneNumber,
      qrCode: instance.qrcode,
      qrCodeExpiresAt: new Date(Date.now() + QR_CODE_TTL_MS),
      isConnected: false,
    };

    if (existingConfig) {
      await prisma.whatsAppConfig.update({
        where: { id: existingConfig.id },
        data: {
          ...sharedData,
          createMessage: existingConfig.createMessage || DEFAULT_TEMPLATES.createMessage,
          cancelMessage: existingConfig.cancelMessage || DEFAULT_TEMPLATES.cancelMessage,
          confirmationMessage: existingConfig.confirmationMessage || DEFAULT_TEMPLATES.confirmationMessage,
          reminderMessage: existingConfig.reminderMessage || DEFAULT_TEMPLATES.reminderMessage,
        },
      });
    } else {
      await prisma.whatsAppConfig.create({
        data: {
          userId: session.user.id,
          ...sharedData,
          createMessage: DEFAULT_TEMPLATES.createMessage,
          cancelMessage: DEFAULT_TEMPLATES.cancelMessage,
          confirmationMessage: DEFAULT_TEMPLATES.confirmationMessage,
          reminderMessage: DEFAULT_TEMPLATES.reminderMessage,
        },
      });
    }

    return {
      success: true,
      data: { qrCode: instance.qrcode, instanceName },
    };
  } catch (error) {
    console.error('[createInstanceAction] Error:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: parseWhatsAppError(error) };
  }
}

/**
 * Refreshes the QR Code for an already-created instance (does not create a
 * new instance nor re-register the webhook).
 */
export async function refreshQRCodeAction(): Promise<ActionState<{ qrCode: string }>> {
  try {
    const session = (await getServerSession(authOptions)) as ExtendedSession | null;
    if (!session?.user?.id) {
      return { success: false, error: 'Não autenticado' };
    }

    const stateCheck = await checkInstanceState(session.user.id);

    if (!stateCheck.config) {
      return { success: false, error: 'Nenhuma instância encontrada. Crie uma nova.' };
    }

    if (stateCheck.state === InstanceState.CONNECTED) {
      return { success: false, error: 'Instância já está conectada.' };
    }

    if (!stateCheck.config.apiKey) {
      // Registro legado (era Evolution/n8n): nunca teve instância na Uazapi.
      // Cria uma agora, reaproveitando o número já salvo.
      if (!stateCheck.config.phoneNumber) {
        return { success: false, error: 'Instância sem token Uazapi salvo. Desconecte e conecte novamente.' };
      }
      return createInstanceAction(stateCheck.config.phoneNumber);
    }

    const instanceToken = decryptSecret(stateCheck.config.apiKey);
    const instance = await uazapi.connect(instanceToken);

    if (!instance.qrcode) {
      return { success: false, error: 'A Uazapi não retornou um QR Code. Tente novamente.' };
    }

    await prisma.whatsAppConfig.update({
      where: { id: stateCheck.config.id },
      data: {
        qrCode: instance.qrcode,
        qrCodeExpiresAt: new Date(Date.now() + QR_CODE_TTL_MS),
      },
    });

    return { success: true, data: { qrCode: instance.qrcode } };
  } catch (error) {
    console.error('[refreshQRCodeAction] Error:', error);
    return { success: false, error: parseWhatsAppError(error) };
  }
}

/**
 * Retrieves current user's WhatsApp configuration.
 * O token da instância (`apiKey`) nunca é devolvido ao client.
 */
export async function getWhatsAppConfigAction(): Promise<ActionState<PublicWhatsAppConfig | null>> {
  try {
    const session = (await getServerSession(authOptions)) as ExtendedSession | null;
    if (!session?.user?.id) {
      return { success: false, error: 'Não autenticado' };
    }

    const config = await prisma.whatsAppConfig.findUnique({
      where: { userId: session.user.id },
      omit: { apiKey: true },
    });

    return { success: true, data: config };
  } catch (error) {
    console.error('[getWhatsAppConfigAction] Error:', error);
    return { success: false, error: 'Erro ao buscar configuração' };
  }
}

/**
 * Checks WhatsApp connection status directly against the Uazapi and syncs
 * the result back to the database if it changed. Complementa (não
 * substitui) o webhook: cobre o caso de o webhook não ter chegado ainda ou
 * ter se perdido.
 */
export async function checkConnectionStatusAction(): Promise<
  ActionState<{ isConnected: boolean; uazapiStatus?: string; qrCode?: string }>
> {
  try {
    const session = (await getServerSession(authOptions)) as ExtendedSession | null;
    if (!session?.user?.id) {
      return { success: false, error: 'Não autenticado' };
    }

    const config = await prisma.whatsAppConfig.findUnique({
      where: { userId: session.user.id },
    });

    if (!config) {
      return { success: true, data: { isConnected: false } };
    }

    if (!config.apiKey) {
      return { success: true, data: { isConnected: false } };
    }

    let instance: uazapi.UazapiInstance;
    try {
      instance = await uazapi.getStatus(decryptSecret(config.apiKey));
    } catch (error) {
      // Instância pode não existir mais no servidor Uazapi — não é um erro fatal.
      console.warn('[checkConnectionStatusAction] Falha ao consultar status na Uazapi:', error);
      if (config.isConnected) {
        await prisma.whatsAppConfig.update({ where: { id: config.id }, data: { isConnected: false } });
      }
      return { success: true, data: { isConnected: false, uazapiStatus: 'disconnected' } };
    }

    // `hibernated` conta como desconectado do ponto de vista do produto.
    const isConnected = instance.status === 'connected';

    if (isConnected !== config.isConnected) {
      await prisma.whatsAppConfig.update({
        where: { id: config.id },
        // Conectar liga o "disjuntor mestre" de notificações automaticamente.
        data: { isConnected, ...(isConnected && !config.enabled ? { enabled: true } : {}) },
      });
    }

    // Enquanto `connecting`, a Uazapi pode rotacionar o QR — devolvemos o atual
    // para o modal não ficar exibindo um código já inválido.
    const qrCode = instance.status === 'connecting' ? instance.qrcode : undefined;
    if (qrCode && qrCode !== config.qrCode) {
      await prisma.whatsAppConfig.update({
        where: { id: config.id },
        data: { qrCode, qrCodeExpiresAt: new Date(Date.now() + QR_CODE_TTL_MS) },
      });
    }

    return { success: true, data: { isConnected, uazapiStatus: instance.status, qrCode } };
  } catch (error) {
    console.error('[checkConnectionStatusAction] Error:', error);
    return { success: false, error: 'Erro ao verificar status' };
  }
}

/**
 * Deletes the WhatsApp instance both from the Uazapi server and the database.
 */
export async function deleteInstanceAction(): Promise<ActionState<void>> {
  try {
    const session = (await getServerSession(authOptions)) as ExtendedSession | null;
    if (!session?.user?.id) {
      return { success: false, error: 'Não autenticado' };
    }

    const config = await prisma.whatsAppConfig.findUnique({
      where: { userId: session.user.id },
    });

    if (!config) {
      return { success: false, error: 'Configuração não encontrada' };
    }

    if (config.apiKey) {
      try {
        await uazapi.deleteInstance(decryptSecret(config.apiKey));
      } catch (error) {
        // Instância pode já não existir mais no servidor — limpa o registro local mesmo assim.
        console.warn('[deleteInstanceAction] Falha ao apagar instância na Uazapi (limpando registro local mesmo assim):', error);
      }
    }

    await prisma.whatsAppConfig.delete({ where: { id: config.id } });

    return { success: true };
  } catch (error) {
    console.error('[deleteInstanceAction] Error:', error);
    return { success: false, error: 'Erro ao desconectar' };
  }
}

/**
 * Updates notification message templates and enable status
 * @param data - Settings object validated by Zod
 */
export async function updateWhatsAppSettingsAction(
  data: z.infer<typeof WhatsAppSettingsSchema>
): Promise<ActionState<PublicWhatsAppConfig>> {
  try {
    const session = (await getServerSession(authOptions)) as ExtendedSession | null;
    if (!session?.user?.id) {
      return { success: false, error: 'Não autenticado' };
    }

    const validated = WhatsAppSettingsSchema.parse(data);

    const config = await prisma.whatsAppConfig.findUnique({
      where: { userId: session.user.id },
    });

    if (!config) {
      return { success: false, error: 'Configuração não encontrada. Conecte o WhatsApp primeiro.' };
    }

    const updated = await prisma.whatsAppConfig.update({
      where: { id: config.id },
      data: validated,
      omit: { apiKey: true },
    });

    return { success: true, data: updated };
  } catch (error) {
    console.error('[updateWhatsAppSettingsAction] Error:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: 'Erro ao salvar configurações' };
  }
}

/**
 * Sends a real-time WhatsApp message for the authenticated user's instance.
 * (Antes: repassava para um endpoint n8n genérico por `instanceName`; agora
 * resolve o token da própria instância do usuário autenticado — corrige
 * também a falta de checagem de sessão que existia na versão anterior.)
 */
export async function sendMessageAction(
  recipient: string,
  message: string
): Promise<ActionState<void>> {
  try {
    const session = (await getServerSession(authOptions)) as ExtendedSession | null;
    if (!session?.user?.id) {
      return { success: false, error: 'Não autenticado' };
    }

    const config = await prisma.whatsAppConfig.findUnique({
      where: { userId: session.user.id },
    });

    if (!config || !config.isConnected || !config.enabled || !config.apiKey) {
      return { success: false, error: USER_FRIENDLY_ERRORS.WHATSAPP_NOT_CONNECTED };
    }

    const formattedRecipient = formatWhatsAppNumber(recipient);
    await uazapi.sendText(decryptSecret(config.apiKey), formattedRecipient, message);

    return { success: true };
  } catch (error) {
    console.error('[sendMessageAction] Error:', error);
    return { success: false, error: parseWhatsAppError(error) };
  }
}

/**
 * Sends a test message to the user's own number
 * Uses templates with dummy data for validation
 *
 * @param type - Which template to test
 * @returns Success/Error state
 */
export async function sendTestMessageAction(
  type: 'create' | 'cancel' | 'confirmation' | 'reminder' | 'completed',
  destinationNumber?: string,
  customMessage?: string
): Promise<ActionState<void>> {
  try {
    const session = (await getServerSession(authOptions)) as ExtendedSession | null;
    if (!session?.user?.id) {
      return { success: false, error: 'Não autenticado' };
    }

    const config = await prisma.whatsAppConfig.findUnique({
      where: { userId: session.user.id },
    });

    if (!config || !config.isConnected || !config.apiKey) {
      return { success: false, error: USER_FRIENDLY_ERRORS.WHATSAPP_NOT_CONNECTED };
    }

    // Use destination number if provided, otherwise fallback to config number
    const recipient = destinationNumber || config.phoneNumber;

    if (!recipient) {
      return { success: false, error: USER_FRIENDLY_ERRORS.WHATSAPP_INVALID_NUMBER };
    }

    // Use custom message if provided (from preview field), otherwise use saved/default
    let message = customMessage;

    if (!message) {
      switch (type) {
        case 'create':
          message = config.createMessage || DEFAULT_TEMPLATES.createMessage;
          break;
        case 'cancel':
          message = config.cancelMessage || DEFAULT_TEMPLATES.cancelMessage;
          break;
        case 'confirmation':
          message = config.confirmationMessage || DEFAULT_TEMPLATES.confirmationMessage;
          break;
        case 'reminder':
          message = config.reminderMessage || DEFAULT_TEMPLATES.reminderMessage;
          break;
        case 'completed':
          message = config.completedMessage || DEFAULT_TEMPLATES.completedMessage;
          break;
      }
    }

    message = message
      .replace(/\{\{nome_cliente\}\}/g, 'João Silva')
      .replace(/\{\{data\}\}/g, '25/01/2026')
      .replace(/\{\{hora\}\}/g, '14:00')
      .replace(/\{\{servico\}\}/g, 'Exemplo de Serviço')
      .replace(/\{\{profissional\}\}/g, 'Profissional Exemplo')
      .replace(/\{\{empresa\}\}/g, 'Sua Empresa')
      .replace(/\{\{link_avaliacao\}\}/g, config.reviewLink || 'https://g.page/r/exemplo/review')
      .replace(/\{\{link_confirmacao\}\}/g, `${(process.env.NEXTAUTH_URL || 'https://app.calenvo.com').replace(/\/+$/, '')}/c/exemplo`);

    try {
      const formattedRecipient = formatWhatsAppNumber(recipient);
      await uazapi.sendText(decryptSecret(config.apiKey), formattedRecipient, `📱 MENSAGEM DE TESTE:\n\n${message}`);
    } catch (sendError) {
      await logError({
        functionality: `whatsapp_test_send_${type}`,
        error: sendError,
        metadata: { instanceName: config.instanceName, recipient, type },
        userId: session.user.id,
      });
      return { success: false, error: parseWhatsAppError(sendError) };
    }

    return { success: true };
  } catch (error) {
    console.error('[sendTestMessageAction] Error:', error);

    await logError({
      functionality: `whatsapp_test_send_${type}`,
      error,
      metadata: { type, destinationNumber }
    });

    return {
      success: false,
      error: parseWhatsAppError(error)
    };
  }
}
