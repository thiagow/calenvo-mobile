import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createInstance,
  connect,
  getStatus,
  disconnect,
  deleteInstance,
  sendText,
  setWebhook,
  isConnectionEvent,
  UazapiConfigError,
  UazapiApiError,
  type UazapiConnectionWebhookEvent,
  type UazapiWebhookEnvelope,
} from '@/lib/uazapi'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env.UAZAPI_BASE_URL = 'https://example.uazapi.com'
  process.env.UAZAPI_ADMIN_TOKEN = 'admin-secret'
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  process.env = { ...ORIGINAL_ENV }
})

describe('config guards (sem env obrigatória no import)', () => {
  it('createInstance lança UazapiConfigError se UAZAPI_ADMIN_TOKEN estiver ausente', async () => {
    delete process.env.UAZAPI_ADMIN_TOKEN
    await expect(createInstance('teste')).rejects.toBeInstanceOf(UazapiConfigError)
  })

  it('getStatus lança UazapiConfigError se UAZAPI_BASE_URL estiver ausente', async () => {
    delete process.env.UAZAPI_BASE_URL
    await expect(getStatus('tok')).rejects.toBeInstanceOf(UazapiConfigError)
  })
})

describe('createInstance', () => {
  it('envia admintoken e devolve token + instance normalizados', async () => {
    const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        token: 'inst-token',
        instance: { id: 'r1', token: 'inst-token', name: 'loja-x', status: 'disconnected' },
      })
    )

    const result = await createInstance('loja-x')

    expect(result).toEqual({
      token: 'inst-token',
      instance: { id: 'r1', token: 'inst-token', name: 'loja-x', status: 'disconnected' },
    })
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://example.uazapi.com/instance/create')
    expect(init.method).toBe('POST')
    expect(init.headers.admintoken).toBe('admin-secret')
    expect(JSON.parse(init.body)).toEqual({ name: 'loja-x' })
  })
})

describe('connect', () => {
  it('gera QR sem phone (body vazio)', async () => {
    const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ instance: { id: 'r1', token: 't', name: 'x', status: 'connecting', qrcode: 'data:image/png;base64,abc' } })
    )

    const instance = await connect('t')

    expect(instance.status).toBe('connecting')
    expect(instance.qrcode).toBe('data:image/png;base64,abc')
    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers.token).toBe('t')
    expect(JSON.parse(init.body)).toEqual({})
  })

  it('usa pairing code quando phone é passado', async () => {
    const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ instance: { id: 'r1', token: 't', name: 'x', status: 'connecting', paircode: '1234-ABCD' } })
    )

    await connect('t', '5511999999999')

    const [, init] = mockFetch.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ phone: '5511999999999' })
  })
})

describe('getStatus', () => {
  it('faz GET e retorna a instância normalizada', async () => {
    const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        instance: { id: 'r1', token: 't', name: 'x', status: 'connected', owner: '5511999999999' },
        status: { connected: true, jid: '5511999999999@s.whatsapp.net', loggedIn: true },
      })
    )

    const instance = await getStatus('t')

    expect(instance.status).toBe('connected')
    const [, init] = mockFetch.mock.calls[0]
    expect(init.method).toBe('GET')
  })
})

describe('disconnect / deleteInstance', () => {
  it('disconnect faz POST /instance/disconnect', async () => {
    const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce(jsonResponse({ response: 'Already disconnected' }))

    await disconnect('t')

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://example.uazapi.com/instance/disconnect')
    expect(init.method).toBe('POST')
  })

  it('deleteInstance faz DELETE /instance sem admintoken', async () => {
    const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce(jsonResponse({ response: 'Instance Deleted' }))

    await deleteInstance('t')

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://example.uazapi.com/instance')
    expect(init.method).toBe('DELETE')
    expect(init.headers.admintoken).toBeUndefined()
  })
})

describe('sendText', () => {
  it('envia number/text e opções extras no body', async () => {
    const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 'msg-1' }))

    const result = await sendText('t', '5511999999999', 'Olá!', { delay: 500 })

    expect(result).toEqual({ id: 'msg-1' })
    const [, init] = mockFetch.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ number: '5511999999999', text: 'Olá!', delay: 500 })
  })
})

describe('setWebhook', () => {
  it('força enabled:true mesmo se não passado', async () => {
    const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce(
      jsonResponse([{ id: 'w1', url: 'https://x.com/hook', enabled: true, events: ['connection'] }])
    )

    await setWebhook('t', { url: 'https://x.com/hook', events: ['connection'], excludeMessages: ['wasSentByApi'] })

    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.enabled).toBe(true)
    expect(body.url).toBe('https://x.com/hook')
  })
})

describe('retry / erro', () => {
  it('retenta em 503 e sucede na segunda tentativa', async () => {
    const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ message: 'unavailable' }, 503))
      .mockResolvedValueOnce(jsonResponse({ instance: { id: 'r1', token: 't', name: 'x', status: 'connected' } }))

    const instance = await getStatus('t')

    expect(instance.status).toBe('connected')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('não retenta em 401 e lança UazapiApiError imediatamente', async () => {
    const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Invalid token.' }, 401))

    await expect(getStatus('bad-token')).rejects.toMatchObject({
      name: 'UazapiApiError',
      status: 401,
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('desiste após MAX_RETRIES em 500 persistente', async () => {
    const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>
    mockFetch.mockImplementation(async () => jsonResponse({ message: 'boom' }, 500))

    await expect(getStatus('t')).rejects.toBeInstanceOf(UazapiApiError)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })
})

describe('isConnectionEvent', () => {
  it('reconhece o formato real capturado (evento connecting com QR)', () => {
    const event: UazapiWebhookEnvelope = {
      EventType: 'connection',
      event_id: '2331fce4-c122-4803-9696-5325870fe0e5',
      instanceName: 'calenvo-dev-test',
      token: '89f193c6-d842-4503-b628-b66048fc776e',
      owner: '',
      BaseUrl: 'https://intellectusdigital.uazapi.com',
      instance: { name: 'calenvo-dev-test', status: 'connecting', qrcode: 'data:image/png;base64,abc' },
    }

    expect(isConnectionEvent(event)).toBe(true)
    if (isConnectionEvent(event)) {
      const typed: UazapiConnectionWebhookEvent = event
      expect(typed.instance.qrcode).toBe('data:image/png;base64,abc')
    }
  })

  it('reconhece o evento de timeout do QR (sem qrcode, com lastDisconnectReason)', () => {
    const event: UazapiWebhookEnvelope = {
      EventType: 'connection',
      event_id: '3682b9dd-7668-4b4c-9721-273c29d31875',
      instanceName: 'calenvo-dev-test',
      token: '89f193c6-d842-4503-b628-b66048fc776e',
      owner: '',
      BaseUrl: 'https://intellectusdigital.uazapi.com',
      instance: {
        name: 'calenvo-dev-test',
        status: 'disconnected',
        lastDisconnect: '2026-09-22 03:35:37.220Z',
        lastDisconnectReason: 'QR Code timeout',
      },
    }

    expect(isConnectionEvent(event)).toBe(true)
    if (isConnectionEvent(event)) {
      expect(event.instance.qrcode).toBeUndefined()
    }
  })

  it('rejeita eventos de outro tipo', () => {
    const event: UazapiWebhookEnvelope = {
      EventType: 'messages',
      event_id: 'x',
      instanceName: 'calenvo-dev-test',
      token: 't',
      owner: '',
      BaseUrl: 'https://example.uazapi.com',
      instance: {},
    }

    expect(isConnectionEvent(event)).toBe(false)
  })
})
