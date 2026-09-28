import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const revalidatePathCalls: string[] = []
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathCalls.push(path),
}))

let mockConfig: any
const updateCalls: any[] = []
vi.mock('@/lib/db', () => ({
  prisma: {
    whatsAppConfig: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (!mockConfig || where.instanceName !== mockConfig.instanceName) return null
        return mockConfig
      }),
      update: vi.fn(async (args: any) => {
        updateCalls.push(args)
        return { ...mockConfig, ...args.data }
      }),
    },
  },
}))

const SECRET = 'test-webhook-secret'
const ORIGINAL_ENV = { ...process.env }

function makeRequest(body: unknown, secret: string | null = SECRET) {
  const url = new URL('http://localhost/api/webhooks/uazapi')
  if (secret !== null) url.searchParams.set('secret', secret)
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function connectionEvent(instance: Record<string, unknown>) {
  return {
    EventType: 'connection',
    event_id: 'evt-1',
    instanceName: 'user123-calenvo',
    token: 'inst-token',
    owner: '',
    BaseUrl: 'https://example.uazapi.com',
    instance,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  revalidatePathCalls.length = 0
  updateCalls.length = 0
  process.env = { ...ORIGINAL_ENV, UAZAPI_WEBHOOK_SECRET: SECRET }
  mockConfig = {
    id: 'cfg-1',
    userId: 'user123',
    instanceName: 'user123-calenvo',
    isConnected: false,
    enabled: false,
    qrCode: null,
  }
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('POST /api/webhooks/uazapi — autenticação', () => {
  it('recusa com 500 se UAZAPI_WEBHOOK_SECRET não estiver configurada (fail closed)', async () => {
    delete process.env.UAZAPI_WEBHOOK_SECRET
    const { POST } = await import('./route')

    const res = await POST(makeRequest(connectionEvent({ status: 'connected' })))

    expect(res.status).toBe(500)
    expect(updateCalls).toHaveLength(0)
  })

  it('recusa com 401 se o secret estiver ausente', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest(connectionEvent({ status: 'connected' }), null))
    expect(res.status).toBe(401)
  })

  it('recusa com 401 se o secret estiver errado', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest(connectionEvent({ status: 'connected' }), 'secret-errado'))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/webhooks/uazapi — evento connection', () => {
  it('marca como conectado, limpa o QR e liga enabled quando status=connected', async () => {
    const { POST } = await import('./route')

    const res = await POST(makeRequest(connectionEvent({ name: 'x', status: 'connected', owner: '5511999999999' })))

    expect(res.status).toBe(200)
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0].data).toMatchObject({ isConnected: true, qrCode: null, enabled: true })
    expect(revalidatePathCalls).toContain('/dashboard/canais-atendimento')
  })

  it('salva o QR (data URL) quando status=connecting', async () => {
    const { POST } = await import('./route')
    const qrcode = 'data:image/png;base64,abc123'

    await POST(makeRequest(connectionEvent({ name: 'x', status: 'connecting', qrcode })))

    expect(updateCalls[0].data).toMatchObject({ isConnected: false, qrCode: qrcode })
  })

  it('limpa o QR e marca desconectado em timeout de QR (sem qrcode)', async () => {
    mockConfig.qrCode = 'data:image/png;base64,old'
    const { POST } = await import('./route')

    await POST(
      makeRequest(
        connectionEvent({ name: 'x', status: 'disconnected', lastDisconnectReason: 'QR Code timeout' })
      )
    )

    expect(updateCalls[0].data).toMatchObject({ isConnected: false, qrCode: null })
  })

  it('trata hibernated como desconectado', async () => {
    const { POST } = await import('./route')
    await POST(makeRequest(connectionEvent({ name: 'x', status: 'hibernated' })))
    expect(updateCalls[0].data.isConnected).toBe(false)
  })

  it('ignora silenciosamente se não achar WhatsAppConfig pra instância', async () => {
    mockConfig = null
    const { POST } = await import('./route')

    const res = await POST(makeRequest(connectionEvent({ status: 'connected' })))

    expect(res.status).toBe(200)
    expect(updateCalls).toHaveLength(0)
  })
})

describe('POST /api/webhooks/uazapi — outros eventos e payload inválido', () => {
  it('responde 200 sem tocar no banco para eventos que não são connection', async () => {
    const { POST } = await import('./route')

    const res = await POST(
      makeRequest({
        EventType: 'messages',
        event_id: 'evt-2',
        instanceName: 'user123-calenvo',
        token: 't',
        owner: '',
        BaseUrl: 'https://example.uazapi.com',
        instance: {},
      })
    )

    expect(res.status).toBe(200)
    expect(updateCalls).toHaveLength(0)
  })

  it('responde 400 se faltar instanceName/EventType', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ foo: 'bar' }))
    expect(res.status).toBe(400)
  })

  it('responde 400 para JSON inválido', async () => {
    const { POST } = await import('./route')
    const url = new URL('http://localhost/api/webhooks/uazapi')
    url.searchParams.set('secret', SECRET)
    const req = new NextRequest(url, { method: 'POST', body: '{not json' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
