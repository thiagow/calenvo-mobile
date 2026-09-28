export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { isConnectionEvent, type UazapiConnectionWebhookEvent, type UazapiWebhookEnvelope } from '@/lib/uazapi'

/**
 * Uazapi Webhook Handler
 *
 * Registrado diretamente na instância Uazapi (via `setWebhook` em
 * `lib/uazapi.ts`) para receber eventos em tempo real. Substitui
 * `app/api/webhooks/evolution/route.ts` (n8n/Evolution, removido nesta
 * migração).
 *
 * Autenticação: a Uazapi não assina o payload (sem HMAC), então o segredo
 * vai na query string (`?secret=`) e é obrigatório — ao contrário da rota
 * Evolution legada, que ficava aberta quando a env não estava configurada.
 * Aqui a ausência da env é tratada como erro de configuração, não como "sem
 * proteção habilitada".
 */
export async function POST(request: NextRequest) {
  const expectedSecret = process.env.UAZAPI_WEBHOOK_SECRET

  if (!expectedSecret) {
    console.error('[Webhook:Uazapi] UAZAPI_WEBHOOK_SECRET não configurada — recusando por padrão')
    return NextResponse.json({ error: 'Webhook não configurado' }, { status: 500 })
  }

  const receivedSecret = new URL(request.url).searchParams.get('secret')
  if (!receivedSecret || !secretsMatch(receivedSecret, expectedSecret)) {
    console.warn('[Webhook:Uazapi] Secret ausente ou inválido')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let event: UazapiWebhookEnvelope<unknown>
  try {
    event = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!event?.instanceName || !event?.EventType) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  if (isConnectionEvent(event)) {
    await handleConnectionEvent(event)
  } else {
    // messages/messages_update/etc. ficam registrados mas fora do escopo desta
    // migração (mesmo TODO que já existia na rota Evolution).
    console.log('[Webhook:Uazapi] Evento ignorado:', event.EventType, event.instanceName)
  }

  return NextResponse.json({ success: true })
}

/**
 * Compara segredos em tempo constante. Compara hashes (tamanho fixo de 32
 * bytes) em vez dos valores crus — `crypto.timingSafeEqual` exige buffers do
 * mesmo tamanho e lançaria nesse caso, o que criaria um oráculo de tamanho.
 */
function secretsMatch(received: string, expected: string): boolean {
  const receivedHash = crypto.createHash('sha256').update(received).digest()
  const expectedHash = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(receivedHash, expectedHash)
}

async function handleConnectionEvent(event: UazapiConnectionWebhookEvent): Promise<void> {
  const { instanceName, instance } = event

  const config = await prisma.whatsAppConfig.findUnique({ where: { instanceName } })
  if (!config) {
    console.warn('[Webhook:Uazapi] Config não encontrada para instância:', instanceName)
    return
  }

  // `hibernated` (instância pausada por inatividade no servidor Uazapi) conta
  // como desconectado do ponto de vista do produto — não há campo próprio no
  // schema para esse estado intermediário.
  const isConnected = instance.status === 'connected'

  await prisma.whatsAppConfig.update({
    where: { id: config.id },
    data: {
      isConnected,
      // QR só é persistido durante `connecting`; qualquer outra transição
      // (connected, disconnected, hibernated) limpa o QR antigo.
      qrCode: instance.status === 'connecting' ? instance.qrcode ?? config.qrCode : null,
      // Conectar liga o "disjuntor mestre" de notificações automaticamente —
      // sem isso, `enabled` nunca é setado e nenhum trigger dispara de verdade
      // (mesmo comportamento da rota Evolution legada).
      ...(isConnected && !config.enabled ? { enabled: true } : {}),
    },
  })

  revalidatePath('/dashboard/canais-atendimento')

  if (!isConnected && config.enabled) {
    console.warn('[Webhook:Uazapi] Instância desconectada enquanto habilitada:', {
      userId: config.userId,
      instanceName,
      reason: instance.lastDisconnectReason,
    })
  }
}
