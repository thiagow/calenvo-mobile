export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { resolveTenantBySlug } from '@/lib/tenant-resolver'
import { runChatAgent, type ChatMessage } from '@/lib/ai/chat-agent'
import { checkRateLimit } from '@/lib/rate-limit'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// O widget é embedado em domínios de terceiros — CORS liberado apenas
// nesta rota (não afeta o resto da API, que continua same-origin only).
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { slug } = params

    const tenant = await resolveTenantBySlug(slug)
    if (!tenant) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404, headers: CORS_HEADERS })
    }

    const widgetConfig = await prisma.chatWidgetConfig.findUnique({ where: { userId: tenant.id } })
    if (!widgetConfig?.enabled) {
      return NextResponse.json({ error: 'Chat não está disponível para este negócio' }, { status: 403, headers: CORS_HEADERS })
    }

    const rate = await checkRateLimit(`widget:${tenant.id}`)
    if (!rate.success) {
      return NextResponse.json({ error: 'Muitas mensagens em pouco tempo. Aguarde um instante.' }, { status: 429, headers: CORS_HEADERS })
    }

    const body = await request.json()
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : []

    if (messages.length === 0) {
      return NextResponse.json({ error: 'Nenhuma mensagem enviada' }, { status: 400, headers: CORS_HEADERS })
    }

    // Limita o tamanho do histórico enviado pelo cliente (evita payloads abusivos)
    const trimmedMessages = messages.slice(-30)

    const { text, quickReplies } = await runChatAgent(tenant, trimmedMessages)

    return NextResponse.json({ reply: text, quickReplies }, { headers: CORS_HEADERS })
  } catch (error) {
    console.error('Erro no chat do widget:', error)
    return NextResponse.json({ error: 'Erro ao processar mensagem' }, { status: 500, headers: CORS_HEADERS })
  }
}
