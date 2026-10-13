import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let sessionUser: any
const created: any[] = []

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (sessionUser ? { user: sessionUser } : null)) }))
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }))
vi.mock('@/lib/db', () => {
  const tx = {
    messageTemplate: {
      count: vi.fn(async () => 1),
      updateMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async (args: any) => {
        created.push(args.data)
        return { id: 't-new', ...args.data }
      }),
    },
  }
  return { prisma: { ...tx, $transaction: vi.fn(async (fn: any) => fn(tx)) } }
})

function post(body: unknown) {
  return new NextRequest('http://localhost/api/message-templates', { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  created.length = 0
  sessionUser = { id: 'master-1', role: 'MASTER' }
})

describe('POST /api/message-templates', () => {
  it('sem sessão → 401', async () => {
    sessionUser = null
    const { POST } = await import('./route')
    expect((await POST(post({ name: 'x', body: 'y' }))).status).toBe(401)
  })

  it('PROFESSIONAL → 403 (bloqueio no servidor, não só na UI)', async () => {
    sessionUser = { id: 'pro-1', role: 'PROFESSIONAL', masterId: 'master-1' }
    const { POST } = await import('./route')
    expect((await POST(post({ name: 'x', body: 'y' }))).status).toBe(403)
    expect(created).toHaveLength(0)
  })

  it('variável desconhecida → 400 com mensagem clara', async () => {
    const { POST } = await import('./route')
    const res = await POST(post({ name: 'Retorno', body: 'Oi {{nomee}}' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('{{nomee}}')
  })

  it('MASTER cria no próprio tenant', async () => {
    const { POST } = await import('./route')
    const res = await POST(post({ name: 'Retorno', body: 'Oi {{primeiro_nome}}' }))
    expect(res.status).toBe(201)
    expect(created[0]).toMatchObject({ userId: 'master-1', kind: 'REACTIVATION', name: 'Retorno' })
  })
})
