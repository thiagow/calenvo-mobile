'use server';

/**
 * WhatsApp Server Actions v3.1
 * Handles instance management, QR code generation, and n8n integration.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { WhatsAppConfig } from '@prisma/client';
import { formatWhatsAppNumber } from '@/lib/utils';
import { logError } from '@/lib/error-logger';
import { parseWhatsAppError, USER_FRIENDLY_ERRORS } from '@/lib/error-messages';

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
  notifyConfirmation: z.boolean(),
  confirmationDays: z.number().min(0),
  confirmationMessage: z.string().max(120).optional(),
  notifyReminder: z.boolean(),
  reminderHours: z.number().min(0),
  reminderMessage: z.string().max(120).optional(),
});

/**
 * Default message templates for notifications
 */
const DEFAULT_TEMPLATES = {
  createMessage: 'Olá {{nome_cliente}}! Seu agendamento foi confirmado para {{data}} às {{hora}}. Serviço: {{servico}}. Até breve!',
  cancelMessage: 'Olá {{nome_cliente}}, seu agendamento do dia {{data}} às {{hora}} foi cancelado. Entre em contato para reagendar.',
  confirmationMessage: 'Olá {{nome_cliente}}! Lembrete: você tem agendamento em {{data}} às {{hora}}. Confirme sua presença respondendo SIM.',
  reminderMessage: 'Oi {{nome_cliente}}! Seu atendimento é daqui a poucas horas ({{hora}}). Te esperamos!',
};

/**
 * Generic n8n request structure
 */
interface N8nRequest {
  action: 'createInstance' | 'getQRCode' | 'getConnectionState' | 'sendMessage' | 'deleteInstance';
  userId: string;
  payload: {
    instanceName?: string;
    phoneNumber?: string;
    webhookUrl?: string;
    message?: string;
    number?: string;
  };
}

/**
 * Generic n8n response structure
 */
interface N8nResponse {
  success: boolean;
  data?: {
    instanceName?: string;
    qrCode?: string;
    state?: 'open' | 'connecting' | 'connected' | 'closed';
    phoneNumber?: string;
  };
  error?: string;
}

/**
 * Specific response structure for n8n status endpoint (v3.1)
 */
interface N8nStatusResponse {
  instance: {
    instanceName: string;
    state: 'close' | 'open' | 'connecting' | 'connected';
  };
}

/**
 * Specific response structure for n8n delete endpoint (v3.1)
 */
interface N8nDeleteResponse {
  status: 'SUCCESS' | 'ERROR';
  error: boolean;
  response: {
    message: string;
  };
}

/**
 * Extracts the first item from a potential array response (common in n8n)
 * @template T - Item type
 */
function extractFirstFromArray<T>(response: T[] | T): T {
  return Array.isArray(response) ? response[0] : response;
}

/**
 * Maps n8n connection states to internal boolean
 * @param state - n8n state string
 */
function mapN8nStateToConnected(state: string): boolean {
  return state === 'open' || state === 'connected';
}

/**
 * Internal instance states for UI logic (v3.0)
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
 * Wrapper for calling dedicated n8n endpoints with timeout handling
 * Handles binary PNG detection for direct image responses
 * @template T - Expected data type
 * @param url - Webhook endpoint URL
 * @param payload - Request body
 * @param timeout - Abort timeout in ms
 */
async function callN8nEndpoint<T = any>(
  url: string,
  payload: Record<string, any>,
  timeout: number = 60000
): Promise<{ success: boolean; data?: T; error?: string }> {
  console.log('[callN8nEndpoint] Starting request...');
  console.log('[callN8nEndpoint] URL:', url);
  console.log('[callN8nEndpoint] Payload:', JSON.stringify(payload, null, 2));

  if (!url) {
    console.error('[callN8nEndpoint] URL not provided');
    return { success: false, error: 'URL do endpoint não configurada' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    console.log('[callN8nEndpoint] Sending POST request...');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('[callN8nEndpoint] Response received:');
    console.log('- Status:', response.status, response.statusText);
    console.log('- Headers:', Object.fromEntries(response.headers.entries()));

    const contentType = response.headers.get('content-type') || '';
    console.log('- Content-Type:', contentType);

    if (!response.ok) {
      console.error('[callN8nEndpoint] HTTP error:', response.status, response.statusText);
      return { success: false, error: `Erro HTTP: ${response.status}` };
    }

    // If it's an image (PNG), convert to Base64
    if (contentType.includes('image/')) {
      console.log('[callN8nEndpoint] Processing image response...');
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const dataUrl = `data:${contentType};base64,${base64}`;
      console.log('[callN8nEndpoint] Image converted to Base64, length:', base64.length);

      return {
        success: true,
        data: { qrCode: dataUrl } as any
      };
    }

    console.log('[callN8nEndpoint] Processing JSON response...');
    const text = await response.text();
    console.log('[callN8nEndpoint] Raw response text length:', text.length);
    console.log('[callN8nEndpoint] Raw response text (first 500 chars):', text.substring(0, 500));

    // Check if response is empty
    if (!text || text.trim().length === 0) {
      console.error('[callN8nEndpoint] Empty response body');
      return {
        success: false,
        error: 'O servidor n8n não retornou dados. Verifique se o workflow está configurado para retornar o QR Code.'
      };
    }

    // Detect PNG binary even with wrong content-type
    // PNG files start with magic number: 0x89 0x50 0x4E 0x47 (‰PNG)
    const isPNG = text.startsWith('\x89PNG') || text.includes('‰PNG') ||
      text.charCodeAt(0) === 0x89 && text.charCodeAt(1) === 0x50;

    if (isPNG) {
      console.log('[callN8nEndpoint] Detected PNG binary despite JSON content-type');
      // Convert text to base64 (treating as binary)
      const base64 = Buffer.from(text, 'binary').toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;
      console.log('[callN8nEndpoint] PNG converted to Base64, length:', base64.length);

      return {
        success: true,
        data: { qrCode: dataUrl } as any
      };
    }

    let data;
    try {
      data = JSON.parse(text);
      console.log('[callN8nEndpoint] Parsed JSON successfully');
      console.log('[callN8nEndpoint] Response data:', JSON.stringify(data, null, 2));
    } catch (parseError) {
      console.error('[callN8nEndpoint] JSON parse error:', parseError);
      console.error('[callN8nEndpoint] Raw text that failed to parse (first 200 chars):', text.substring(0, 200));

      // Last attempt: try reading as ArrayBuffer
      console.log('[callN8nEndpoint] Attempting to re-fetch as arrayBuffer...');
      try {
        const retryResponse = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const buffer = await retryResponse.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        // Check PNG magic number in buffer
        if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 &&
          bytes[2] === 0x4E && bytes[3] === 0x47) {
          console.log('[callN8nEndpoint] Confirmed PNG in re-fetch');
          const base64 = Buffer.from(bytes).toString('base64');
          return {
            success: true,
            data: { qrCode: `data:image/png;base64,${base64}` } as any
          };
        }
      } catch (retryError) {
        console.error('[callN8nEndpoint] Re-fetch failed:', retryError);
      }

      return { success: false, error: `Resposta inválida do servidor: ${text.substring(0, 100)}...` };
    }

    // Check if response has success field
    if (typeof data.success === 'boolean') {
      console.log('[callN8nEndpoint] Response has success field:', data.success);
      return data;
    }

    console.log('[callN8nEndpoint] Response does not have success field, assuming success');
    // If no success field, assume success if we got here
    return { success: true, data };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('[callN8nEndpoint] Timeout after', timeout, 'ms');
        return { success: false, error: `Tempo limite excedido (${timeout / 1000}s)` };
      }
      console.error('[callN8nEndpoint] Fetch error:', error.message);
      console.error('[callN8nEndpoint] Error stack:', error.stack);
      return { success: false, error: error.message };
    }
    console.error('[callN8nEndpoint] Unknown error:', error);
    return { success: false, error: 'Erro desconhecido ao chamar endpoint' };
  }
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
 * Legacy n8n webhook caller (v2.0)
 * Sends generic actions to the main webhook URL
 * @param request - Action request object
 */
async function callN8n(request: N8nRequest): Promise<N8nResponse> {
  const n8nUrl = process.env.N8N_WEBHOOK_URL;

  if (!n8nUrl) {
    console.error('[callN8n] N8N_WEBHOOK_URL not configured');
    return { success: false, error: 'N8N_WEBHOOK_URL não configurado' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds

    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[callN8n] HTTP error:', response.status, response.statusText);
      return { success: false, error: `Erro HTTP: ${response.status}` };
    }

    const data = await response.json();
    return data as N8nResponse;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('[callN8n] Timeout after 60 seconds');
        return { success: false, error: 'Tempo limite excedido (60s)' };
      }
      console.error('[callN8n] Fetch error:', error.message);
      return { success: false, error: error.message };
    }
    console.error('[callN8n] Unknown error:', error);
    return { success: false, error: 'Erro desconhecido ao chamar n8n' };
  }
}

/**
 * Create or Update WhatsApp instance and get QR Code (v3.1)
 * Uses dedicated n8n endpoint: criar-instancia
 * Instance naming pattern: ${userId}-calenvo
 * 
 * @param phoneNumber - Destination number (for reference/testing)
 * @returns Action state with QR code data
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

    const existingConfig = await prisma.whatsAppConfig.findUnique({
      where: { userId: session.user.id },
    });

    const instanceName = existingConfig?.instanceName ||
      await ensureUniqueInstanceName(session.user.id);

    const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET;
    let webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/evolution`;

    // Append secret to webhook URL for validation
    if (webhookSecret) {
      webhookUrl += `?secret=${webhookSecret}`;
    }

    const createEndpoint = process.env.N8N_CREATE_INSTANCE_URL;
    if (!createEndpoint) {
      return { success: false, error: 'Endpoint de criação não configurado (N8N_CREATE_INSTANCE_URL)' };
    }

    console.log('[createInstanceAction] Calling n8n create/update instance endpoint');
    const n8nResult = await callN8nEndpoint<{
      qrCode?: string;
      instanceName?: string;
      qrCodeExpiresAt?: string; // ISO date string
    }>(createEndpoint, {
      userId: session.user.id,
      instanceName,
      phoneNumber: validated.phoneNumber,
      webhookUrl,
    });

    if (!n8nResult.success || !n8nResult.data?.qrCode) {
      return { success: false, error: n8nResult.error || 'Falha ao gerar QR Code' };
    }

    let qrCodeExpiresAt: Date | null = null;
    if (n8nResult.data.qrCodeExpiresAt) {
      try {
        qrCodeExpiresAt = new Date(n8nResult.data.qrCodeExpiresAt);
      } catch (e) {
        console.warn('[createInstanceAction] Failed to parse qrCodeExpiresAt:', e);
      }
    }

    const apiUrl = process.env.N8N_WEBHOOK_URL || '';

    if (existingConfig) {
      await prisma.whatsAppConfig.update({
        where: { id: existingConfig.id },
        data: {
          instanceName,
          phoneNumber: validated.phoneNumber,
          qrCode: n8nResult.data.qrCode,
          qrCodeExpiresAt,
          isConnected: false,
          apiUrl,
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
          instanceName,
          phoneNumber: validated.phoneNumber,
          qrCode: n8nResult.data.qrCode,
          qrCodeExpiresAt,
          isConnected: false,
          apiUrl,
          createMessage: DEFAULT_TEMPLATES.createMessage,
          cancelMessage: DEFAULT_TEMPLATES.cancelMessage,
          confirmationMessage: DEFAULT_TEMPLATES.confirmationMessage,
          reminderMessage: DEFAULT_TEMPLATES.reminderMessage,
        },
      });
    }

    return {
      success: true,
      data: {
        qrCode: n8nResult.data.qrCode,
        instanceName,
      },
    };
  } catch (error) {
    console.error('[createInstanceAction] Error:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Erro ao criar instância' };
  }
}

/**
 * Refreshes QR Code for an existing instance (v3.1)
 * Reuse create instance endpoint as per n8n workflow unification
 * 
 * @returns Action state with new QR code
 */
export async function refreshQRCodeAction(): Promise<ActionState<{ qrCode: string }>> {
  try {
    const session = (await getServerSession(authOptions)) as ExtendedSession | null;
    if (!session?.user?.id) {
      return { success: false, error: 'Não autenticado' };
    }

    const stateCheck = await checkInstanceState(session.user.id);
    console.log('[refreshQRCodeAction] Current state:', stateCheck.state);

    if (!stateCheck.config) {
      return { success: false, error: 'Nenhuma instância encontrada. Crie uma nova.' };
    }

    if (stateCheck.state === InstanceState.CONNECTED) {
      return { success: false, error: 'Instância já está conectada.' };
    }

    const updateQrEndpoint = process.env.N8N_CREATE_INSTANCE_URL;
    if (!updateQrEndpoint) {
      return { success: false, error: 'Endpoint de criação não configurado (N8N_CREATE_INSTANCE_URL)' };
    }

    const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET;
    let webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/evolution`;

    // Append secret to webhook URL for validation
    if (webhookSecret) {
      webhookUrl += `?secret=${webhookSecret}`;
    }

    console.log('[refreshQRCodeAction] Calling n8n to refresh QR code (using create endpoint)');
    const n8nResult = await callN8nEndpoint<{
      qrCode?: string;
      qrCodeExpiresAt?: string; // ISO date string
    }>(updateQrEndpoint, {
      userId: session.user.id,
      instanceName: stateCheck.config.instanceName,
      phoneNumber: stateCheck.config.phoneNumber,
      webhookUrl,
    });

    if (!n8nResult.success || !n8nResult.data?.qrCode) {
      return { success: false, error: n8nResult.error || 'Falha ao atualizar QR Code' };
    }

    let qrCodeExpiresAt: Date | null = null;
    if (n8nResult.data.qrCodeExpiresAt) {
      try {
        qrCodeExpiresAt = new Date(n8nResult.data.qrCodeExpiresAt);
      } catch (e) {
        console.warn('[refreshQRCodeAction] Failed to parse qrCodeExpiresAt:', e);
      }
    }

    await prisma.whatsAppConfig.update({
      where: { id: stateCheck.config.id },
      data: {
        qrCode: n8nResult.data.qrCode,
        qrCodeExpiresAt,
      },
    });

    console.log('[refreshQRCodeAction] QR code refreshed successfully');
    return {
      success: true,
      data: {
        qrCode: n8nResult.data.qrCode,
      },
    };
  } catch (error) {
    console.error('[refreshQRCodeAction] Error:', error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Erro ao atualizar QR Code' };
  }
}

/**
 * Retrieves current user's WhatsApp configuration
 * @returns Config object or null
 */
export async function getWhatsAppConfigAction(): Promise<ActionState<WhatsAppConfig | null>> {
  try {
    const session = (await getServerSession(authOptions)) as ExtendedSession | null;
    if (!session?.user?.id) {
      return { success: false, error: 'Não autenticado' };
    }

    const config = await prisma.whatsAppConfig.findUnique({
      where: { userId: session.user.id },
    });

    return { success: true, data: config };
  } catch (error) {
    console.error('[getWhatsAppConfigAction] Error:', error);
    return { success: false, error: 'Erro ao buscar configuração' };
  }
}

/**
 * Checks WhatsApp connection status via n8n (v3.1)
 * Uses dedicated n8n endpoint: status-da-instancia
 * Syncs results back to database if changed
 * 
 * @returns Current connection state
 */
export async function checkConnectionStatusAction(): Promise<ActionState<{ isConnected: boolean; n8nState?: string }>> {
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

    const statusUrl = process.env.N8N_STATUS_URL;
    if (!statusUrl) {
      return { success: false, error: 'Endpoint de status não configurado (N8N_STATUS_URL)' };
    }

    console.log('[checkConnectionStatusAction] Calling specific status endpoint');
    const result = await callN8nEndpoint<N8nStatusResponse>(
      statusUrl,
      { instanceName: config.instanceName }
    );

    if (!result.success || !result.data) {
      // Se a instância não existe mais na Evolution API, retorna desconectado (não é um erro fatal)
      console.warn('[checkConnectionStatusAction] Status endpoint error (instance may not exist):', result.error);

      // Atualiza o banco para refletir desconexão se necessário
      if (config.isConnected) {
        await prisma.whatsAppConfig.update({
          where: { id: config.id },
          data: { isConnected: false },
        });
      }

      return { success: true, data: { isConnected: false, n8nState: 'close' } };
    }

    const statusData = extractFirstFromArray(result.data);

    // Guard: se a resposta não tiver o formato esperado, trata como desconectado
    if (!statusData?.instance?.state) {
      console.warn('[checkConnectionStatusAction] Unexpected status response format:', statusData);
      return { success: true, data: { isConnected: false, n8nState: 'close' } };
    }

    const isConnected = (statusData.instance.state === 'open' || statusData.instance.state === 'connected');

    console.log('[checkConnectionStatusAction] n8n state:', statusData.instance.state, '→ connected:', isConnected);

    if (isConnected !== config.isConnected) {
      await prisma.whatsAppConfig.update({
        where: { id: config.id },
        data: { isConnected },
      });
    }

    return {
      success: true,
      data: {
        isConnected,
        n8nState: statusData.instance.state
      }
    };
  } catch (error) {
    console.error('[checkConnectionStatusAction] Error:', error);
    return { success: false, error: 'Erro ao verificar status' };
  }
}

/**
 * Deletes WhatsApp instance from n8n and database (v3.1)
 * Uses dedicated n8n endpoint: excluir-instancia
 * 
 * @returns Success/Error state
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

    const deleteUrl = process.env.N8N_DELETE_URL;
    if (!deleteUrl) {
      // Sem endpoint configurado: limpa só o banco (best-effort)
      console.warn('[deleteInstanceAction] N8N_DELETE_URL not set. Removing DB config only.');
      await prisma.whatsAppConfig.delete({ where: { id: config.id } });
      return { success: true };
    }

    console.log('[deleteInstanceAction] Calling specific delete endpoint');
    const result = await callN8nEndpoint<N8nDeleteResponse>(
      deleteUrl,
      { instanceName: config.instanceName }
    );

    // Se o endpoint retornou erro, verifica se é porque a instância não existe mais na Evolution API.
    // Nesse caso, ainda assim remove o registro do banco (limpeza de config órfã).
    if (!result.success || !result.data) {
      console.warn(
        '[deleteInstanceAction] n8n delete endpoint error (instance may not exist in API). Cleaning DB anyway.',
        result.error
      );
      await prisma.whatsAppConfig.delete({ where: { id: config.id } });
      return { success: true };
    }

    const deleteData = extractFirstFromArray(result.data);

    // Se a API reportou falha mas com mensagem indicando que não existe, limpa o banco
    const notFoundMessages = ['not found', 'não encontrada', 'does not exist', 'instance not found'];
    const responseMessage = (deleteData.response?.message || '').toLowerCase();
    const isNotFound = notFoundMessages.some((msg) => responseMessage.includes(msg));

    if ((deleteData.status !== 'SUCCESS' || deleteData.error !== false) && !isNotFound) {
      console.error('[deleteInstanceAction] Delete failed:', deleteData);
      return {
        success: false,
        error: deleteData.response?.message || 'Falha ao excluir instância'
      };
    }

    if (isNotFound) {
      console.warn('[deleteInstanceAction] Instance not found in Evolution API. Cleaning DB record.');
    } else {
      console.log('[deleteInstanceAction] Instance deleted successfully:', deleteData.response?.message);
    }

    await prisma.whatsAppConfig.delete({
      where: { id: config.id },
    });

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
): Promise<ActionState<WhatsAppConfig>> {
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
 * Send a real-time message via the dedicated n8n endpoint
 * Pattern: instancia, mensagem, destinatario
 */
export async function sendMessageAction(
  instanceName: string,
  recipient: string,
  message: string
): Promise<ActionState<void>> {
  try {
    const sendUrl = process.env.N8N_SEND_MESSAGE_URL;
    if (!sendUrl) {
      console.error('[sendMessageAction] N8N_SEND_MESSAGE_URL not configured');
      return { success: false, error: 'Endpoint de envio não configurado' };
    }

    // Format recipient number (ensure 55 DDI)
    const formattedRecipient = formatWhatsAppNumber(recipient);

    const payload = {
      instancia: instanceName,
      mensagem: message,
      destinatario: formattedRecipient,
    };

    console.log('[sendMessageAction] Sending message to:', formattedRecipient);

    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sendMessageAction] HTTP error:', response.status, errorText);
      throw new Error(`Erro no servidor de mensagens: ${response.status}`);
    }

    console.log('[sendMessageAction] Message sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[sendMessageAction] Error:', error);
    throw error; // Let retry handle it
  }
}

/**
 * Helper for exponential backoff delay
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send message with automatic exponential backoff retry
 */
export async function sendMessageWithRetry(
  instanceName: string,
  recipient: string,
  message: string,
  attempt: number = 1
): Promise<ActionState<void>> {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 1000;

  try {
    return await sendMessageAction(instanceName, recipient, message);
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      console.error(`[sendMessageWithRetry] Failed after ${MAX_RETRIES} attempts:`, error);
      return {
        success: false,
        error: `Falha ao enviar após ${MAX_RETRIES} tentativas. Verifique a conexão.`,
      };
    }

    const delay = BASE_DELAY * Math.pow(2, attempt - 1);
    console.warn(`[sendMessageWithRetry] Attempt ${attempt} failed. Retrying in ${delay}ms...`);

    await sleep(delay);
    return sendMessageWithRetry(instanceName, recipient, message, attempt + 1);
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
  type: 'create' | 'cancel' | 'confirmation' | 'reminder',
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

    if (!config || !config.isConnected) {
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
      }
    }

    message = message
      .replace(/\{\{nome_cliente\}\}/g, 'João Silva')
      .replace(/\{\{data\}\}/g, '25/01/2026')
      .replace(/\{\{hora\}\}/g, '14:00')
      .replace(/\{\{servico\}\}/g, 'Exemplo de Serviço')
      .replace(/\{\{profissional\}\}/g, 'Profissional Exemplo')
      .replace(/\{\{empresa\}\}/g, 'Sua Empresa');

    // Send using new real-time endpoint with retry
    const result = await sendMessageWithRetry(
      config.instanceName,
      recipient,
      `📱 MENSAGEM DE TESTE:\n\n${message}`
    );

    if (!result.success) {
      await logError({
        functionality: `whatsapp_test_send_${type}`,
        error: result.error || 'Unknown n8n error',
        metadata: {
          instanceName: config.instanceName,
          recipient,
          type
        },
        userId: session.user.id
      });
      return { success: false, error: parseWhatsAppError(result.error) };
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

/**
 * Toggle AI Agent for WhatsApp instance
 * Enables or disables the webhook for receiving messages
 * @param enabled - Whether to enable or disable the AI agent
 */
export async function toggleAiAgentAction(
  enabled: boolean
): Promise<ActionState<void>> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    if (!session?.user?.id) {
      return { success: false, error: 'Não autenticado' };
    }

    const userId = session.user.id;

    // Get current config
    const config = await prisma.whatsAppConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      return { success: false, error: 'Configuração WhatsApp não encontrada' };
    }

    if (!config.isConnected) {
      return { success: false, error: 'Instância WhatsApp não está conectada' };
    }

    // Update database first
    await prisma.whatsAppConfig.update({
      where: { userId },
      data: { aiAgentEnabled: enabled },
    });

    // Configure webhook on Evolution API directly
    const aiAgentWebhookUrl = process.env.N8N_AI_AGENT_WEBHOOK_URL;

    if (!aiAgentWebhookUrl) {
      console.warn('[toggleAiAgentAction] N8N_AI_AGENT_WEBHOOK_URL not configured');
      return { success: true }; // DB updated but webhook not configured yet
    }

    try {
      const evolutionUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, '');
      const evolutionKey = process.env.EVOLUTION_API_KEY || '';

      console.log(`[toggleAiAgentAction] Evolution URL: ${evolutionUrl}`);
      console.log(`[toggleAiAgentAction] Instance: ${config.instanceName}, Enabled: ${enabled}`);
      console.log(`[toggleAiAgentAction] Agent Webhook URL: ${aiAgentWebhookUrl}`);

      const payload = {
        webhook: {
          enabled,
          url: enabled ? aiAgentWebhookUrl : '',
          webhookByEvents: false,
          events: [
            'CONNECTION_UPDATE',
            'MESSAGES_UPSERT',
            // MESSAGES_UPDATE removido — não necessário para o agente de IA
          ],
        },
      };

      // Evolution API v2 endpoint — configura webhook
      const endpoint = `${evolutionUrl}/webhook/set/${config.instanceName}`;
      console.log(`[toggleAiAgentAction] Calling: POST ${endpoint}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });

      const responseText = await response.text();
      console.log(`[toggleAiAgentAction] Webhook response ${response.status}: ${responseText}`);

      if (!response.ok) {
        throw new Error(`Evolution API retornou ${response.status}: ${responseText}`);
      }

      // Configura settings da instância — ativa ignoreGroups quando habilitando o agente
      if (enabled) {
        const settingsEndpoint = `${evolutionUrl}/settings/set/${config.instanceName}`;
        console.log(`[toggleAiAgentAction] Configuring instance settings: POST ${settingsEndpoint}`);

        const settingsResponse = await fetch(settingsEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionKey,
          },
          body: JSON.stringify({
            settings: {
              rejectCall: false,
              groupsIgnore: true,
              alwaysOnline: false,
              readMessages: false,
              readStatus: false,
            },
          }),
          signal: AbortSignal.timeout(30000),
        });

        const settingsText = await settingsResponse.text();
        console.log(`[toggleAiAgentAction] Settings response ${settingsResponse.status}: ${settingsText}`);

        if (!settingsResponse.ok) {
          // Loga aviso mas não desfaz o webhook — settings é secundário
          console.warn(`[toggleAiAgentAction] Settings warning: ${settingsText}`);
        }
      }

      console.log(`[toggleAiAgentAction] Webhook ${enabled ? 'enabled' : 'disabled'} for ${config.instanceName}`);

      return { success: true };

    } catch (webhookError) {
      console.error('[toggleAiAgentAction] Webhook error:', webhookError);

      // Rollback database change
      await prisma.whatsAppConfig.update({
        where: { userId },
        data: { aiAgentEnabled: !enabled },
      });

      await logError({
        functionality: 'whatsapp_toggle_ai_agent',
        error: webhookError,
        metadata: { instanceName: config.instanceName, enabled }
      });

      return {
        success: false,
        error: 'Falha ao configurar webhook na Evolution API'
      };
    }
  } catch (error) {
    console.error('[toggleAiAgentAction] Error:', error);

    await logError({
      functionality: 'whatsapp_toggle_ai_agent',
      error,
      metadata: { enabled }
    });

    return {
      success: false,
      error: parseWhatsAppError(error)
    };
  }
}
