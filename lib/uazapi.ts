/**
 * Uazapi API Client
 *
 * Cliente tipado para a Uazapi (servidor WhatsApp do usuário), substituindo
 * a cadeia antiga Calenvo → n8n → Evolution API. Fala direto com a Uazapi.
 *
 * Endpoints confirmados manualmente contra um servidor Uazapi real (os docs
 * em `docs/UAZAPI_*.md` não cobrem o ciclo de vida da instância):
 * - POST   /instance/create      (header admintoken) → cria instância, devolve token
 * - POST   /instance/connect     (header token)       → gera/retorna QR code
 * - GET    /instance/status      (header token)       → estado atual (idempotente)
 * - POST   /instance/disconnect  (header token)       → desconecta, mantém a instância
 * - DELETE /instance             (header token)       → apaga a instância
 * - POST   /send/text            (header token)       → envia mensagem de texto
 * - POST   /webhook              (header token)       → configura webhook
 *   (⚠️ o modo "simples" cria o webhook com `enabled:false` por padrão —
 *   sempre mandar `enabled:true` explicitamente)
 *
 * Nenhuma env é obrigatória no import — só quando uma função que precisa
 * dela é de fato chamada. Isso evita repetir o problema documentado em
 * CLAUDE.md sob "Stripe price ID test removed": um módulo que explode ao
 * ser importado em CI sem segredo nenhum configurado.
 */

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1000

export class UazapiConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UazapiConfigError'
  }
}

export class UazapiApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown
  ) {
    super(message)
    this.name = 'UazapiApiError'
  }
}

function getBaseUrl(): string {
  const url = process.env.UAZAPI_BASE_URL
  if (!url) throw new UazapiConfigError('UAZAPI_BASE_URL não configurada')
  return url.replace(/\/+$/, '')
}

function getAdminToken(): string {
  const token = process.env.UAZAPI_ADMIN_TOKEN
  if (!token) throw new UazapiConfigError('UAZAPI_ADMIN_TOKEN não configurada')
  return token
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type AuthHeader = { admintoken: string } | { token: string }

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  auth: AuthHeader
  body?: unknown
  timeoutMs?: number
}

/**
 * fetch com timeout e retry (só em 429/5xx, com backoff exponencial — mesmo
 * padrão de `WhatsAppTriggerService.sendToN8n`). Erros 4xx (exceto 429) não
 * são retentados: reenviar uma requisição malformada ou não autorizada não
 * muda o resultado.
 */
async function uazapiRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const baseUrl = getBaseUrl()
  const { method = 'GET', auth, body, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...auth,
  }

  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      const text = await response.text()
      const json: unknown = text ? JSON.parse(text) : {}

      if (response.ok) return json as T

      const shouldRetry = (response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES
      if (!shouldRetry) {
        throw new UazapiApiError(
          `Uazapi ${method} ${path} falhou com status ${response.status}`,
          response.status,
          json
        )
      }

      lastError = new UazapiApiError(
        `Uazapi ${method} ${path} falhou com status ${response.status}`,
        response.status,
        json
      )
    } catch (error) {
      if (error instanceof UazapiApiError) throw error
      lastError = error
      if (attempt >= MAX_RETRIES) break
    } finally {
      clearTimeout(timeout)
    }

    await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
  }

  if (lastError instanceof Error) throw lastError
  throw new Error(`Uazapi ${method} ${path}: falha desconhecida`)
}

// ---------------------------------------------------------------------------
// Tipos de instância
// ---------------------------------------------------------------------------

export type UazapiInstanceStatus = 'connecting' | 'connected' | 'disconnected' | 'hibernated'

/** Estado da instância como retornado por create/connect/status. */
export interface UazapiInstance {
  id: string
  token: string
  name: string
  status: UazapiInstanceStatus
  /** Data URL completa (`data:image/png;base64,...`), pronta para `<img src>`. */
  qrcode?: string
  paircode?: string
  profileName?: string
  owner?: string
  lastDisconnect?: string
  lastDisconnectReason?: string
}

export interface UazapiConnectionState {
  connected: boolean
  jid?: string | null
  loggedIn: boolean
}

interface RawInstanceResponse {
  instance: UazapiInstance
  status?: UazapiConnectionState
}

function parseInstanceResponse(raw: RawInstanceResponse): UazapiInstance {
  return raw.instance
}

// ---------------------------------------------------------------------------
// Ciclo de vida da instância
// ---------------------------------------------------------------------------

export interface CreateInstanceResult {
  token: string
  instance: UazapiInstance
}

/** Cria uma instância nova no servidor Uazapi. Requer UAZAPI_ADMIN_TOKEN. */
export async function createInstance(name: string): Promise<CreateInstanceResult> {
  const raw = await uazapiRequest<RawInstanceResponse & { token: string }>('/instance/create', {
    method: 'POST',
    auth: { admintoken: getAdminToken() },
    body: { name },
  })
  return { token: raw.token, instance: parseInstanceResponse(raw) }
}

/**
 * Inicia a conexão e gera o QR code. Passe `phone` (com DDI) para usar
 * pairing code em vez de QR.
 */
export async function connect(token: string, phone?: string): Promise<UazapiInstance> {
  const raw = await uazapiRequest<RawInstanceResponse>('/instance/connect', {
    method: 'POST',
    auth: { token },
    body: phone ? { phone } : {},
  })
  return parseInstanceResponse(raw)
}

/** Consulta o estado atual — seguro para polling, não gera novo QR. */
export async function getStatus(token: string): Promise<UazapiInstance> {
  const raw = await uazapiRequest<RawInstanceResponse>('/instance/status', {
    method: 'GET',
    auth: { token },
  })
  return parseInstanceResponse(raw)
}

/** Desconecta o WhatsApp mas mantém a instância (reconectável com novo QR). */
export async function disconnect(token: string): Promise<void> {
  await uazapiRequest<unknown>('/instance/disconnect', {
    method: 'POST',
    auth: { token },
  })
}

/** Apaga a instância inteira do servidor Uazapi. Irreversível. */
export async function deleteInstance(token: string): Promise<void> {
  await uazapiRequest<unknown>('/instance', {
    method: 'DELETE',
    auth: { token },
  })
}

// ---------------------------------------------------------------------------
// Envio de mensagens
// ---------------------------------------------------------------------------

export interface SendTextOptions {
  delay?: number
  readchat?: boolean
  readmessages?: boolean
  replyid?: string
  linkPreview?: boolean
}

export type SendTextResult = Record<string, unknown>

/** Envia uma mensagem de texto. `number` sem `@s.whatsapp.net` (ex: "5511999999999"). */
export async function sendText(
  token: string,
  number: string,
  text: string,
  opts: SendTextOptions = {}
): Promise<SendTextResult> {
  return uazapiRequest<SendTextResult>('/send/text', {
    method: 'POST',
    auth: { token },
    body: { number, text, ...opts },
  })
}

// ---------------------------------------------------------------------------
// Webhook (configuração do lado da instância)
// ---------------------------------------------------------------------------

export interface SetWebhookOptions {
  url: string
  events: string[]
  excludeMessages?: string[]
}

export interface WebhookConfig {
  id: string
  url: string
  enabled: boolean
  events: string[]
  excludeMessages?: string[]
}

/**
 * Configura o webhook da instância. IMPORTANTE: o modo simples da Uazapi cria
 * o webhook com `enabled:false` por padrão — por isso mandamos `enabled:true`
 * sempre, explicitamente (confirmado testando contra instância real).
 */
export async function setWebhook(token: string, opts: SetWebhookOptions): Promise<WebhookConfig[]> {
  return uazapiRequest<WebhookConfig[]>('/webhook', {
    method: 'POST',
    auth: { token },
    body: { ...opts, enabled: true },
  })
}

// ---------------------------------------------------------------------------
// Payload do webhook recebido da Uazapi (para app/api/webhooks/uazapi/route.ts)
// ---------------------------------------------------------------------------

export type UazapiEventType =
  | 'connection'
  | 'messages'
  | 'messages_update'
  | 'history'
  | 'call'
  | 'contacts'
  | 'presence'
  | 'groups'
  | 'labels'
  | 'chats'
  | 'chat_labels'
  | 'blocks'
  | 'sender'
  | 'newsletter_messages'

/**
 * Envelope confirmado ao vivo (captura manual via webhook.cool em 2026-09-22):
 * os campos de identificação ficam na raiz, o que mudou vem em `instance`.
 * Ex.: `{"EventType":"connection","instanceName":"...","token":"...","owner":"",
 * "BaseUrl":"...","event_id":"...","instance":{"status":"connecting","qrcode":"data:..."}}`
 */
export interface UazapiWebhookEnvelope<TInstance = unknown> {
  EventType: UazapiEventType
  event_id: string
  instanceName: string
  token: string
  owner: string
  BaseUrl: string
  instance: TInstance
}

/**
 * Payload do evento `connection`. Campos opcionais de propósito — cada
 * transição de estado só inclui os campos que mudaram (`qrcode` só aparece
 * gerando QR; `lastDisconnectReason` só aparece ao desconectar).
 */
export interface UazapiConnectionEventInstance {
  name: string
  status: UazapiInstanceStatus
  qrcode?: string
  paircode?: string
  owner?: string
  profileName?: string
  lastDisconnect?: string
  lastDisconnectReason?: string
}

export type UazapiConnectionWebhookEvent = UazapiWebhookEnvelope<UazapiConnectionEventInstance>

export function isConnectionEvent(
  event: UazapiWebhookEnvelope<unknown>
): event is UazapiConnectionWebhookEvent {
  return event.EventType === 'connection'
}
