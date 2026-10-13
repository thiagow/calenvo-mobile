export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionScope } from '@/lib/session-scope'
import { MAX_ITEMS_PER_SEND, queueReactivationMessages } from '@/lib/reactivation-send'

const sendSchema = z
  .object({
    items: z
      .array(z.object({ clientId: z.string().min(1), serviceId: z.string().min(1) }).strict())
      .min(1, 'Selecione ao menos um cliente')
      .max(MAX_ITEMS_PER_SEND, `Envie no máximo ${MAX_ITEMS_PER_SEND} mensagens por vez`),
    templateId: z.string().min(1).nullable().optional(),
    force: z.boolean().optional(),
  })
  .strict()

export async function POST(request: NextRequest) {
  try {
    const { scope, error } = await getSessionScope({ requireMaster: true })
    if (error) return error

    const parsed = sendSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
    }

    const result = await queueReactivationMessages(scope, parsed.data)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[reactivation] send failed:', error)
    return NextResponse.json({ error: 'Erro ao enviar lembretes' }, { status: 500 })
  }
}
