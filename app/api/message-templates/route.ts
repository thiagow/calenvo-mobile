export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSessionScope } from '@/lib/session-scope'
import { DEFAULT_REACTIVATION_TEMPLATES } from '@/lib/message-template'
import { TEMPLATE_SELECT, createTemplateSchema } from './schema'

/** Primeira visita do MASTER: semeia os modelos sugeridos (uma vez só, mesmo com requisições concorrentes). */
async function seedDefaultsIfEmpty(tenantId: string) {
  try {
    await prisma.$transaction(
      async tx => {
        const count = await tx.messageTemplate.count({ where: { userId: tenantId, kind: 'REACTIVATION' } })
        if (count > 0) return
        await tx.messageTemplate.createMany({
          data: DEFAULT_REACTIVATION_TEMPLATES.map(t => ({ ...t, userId: tenantId, kind: 'REACTIVATION' as const })),
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  } catch (error) {
    // Conflito de serialização = outra requisição semeou ao mesmo tempo. Nada a fazer.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')) throw error
  }
}

export async function GET() {
  try {
    const { scope, error } = await getSessionScope()
    if (error) return error

    if (scope.isMaster) await seedDefaultsIfEmpty(scope.tenantId)

    const templates = await prisma.messageTemplate.findMany({
      where: { userId: scope.tenantId, kind: 'REACTIVATION' },
      select: TEMPLATE_SELECT,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('[message-templates] GET failed:', error)
    return NextResponse.json({ error: 'Erro ao carregar modelos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { scope, error } = await getSessionScope({ requireMaster: true })
    if (error) return error

    const parsed = createTemplateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
    }

    const template = await prisma.$transaction(async tx => {
      const existing = await tx.messageTemplate.count({ where: { userId: scope.tenantId, kind: 'REACTIVATION' } })
      const isDefault = existing === 0 || parsed.data.isDefault === true
      if (isDefault) {
        await tx.messageTemplate.updateMany({
          where: { userId: scope.tenantId, kind: 'REACTIVATION', isDefault: true },
          data: { isDefault: false },
        })
      }
      return tx.messageTemplate.create({
        data: { userId: scope.tenantId, kind: 'REACTIVATION', name: parsed.data.name, body: parsed.data.body, isDefault },
        select: TEMPLATE_SELECT,
      })
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('[message-templates] POST failed:', error)
    return NextResponse.json({ error: 'Erro ao criar modelo' }, { status: 500 })
  }
}
