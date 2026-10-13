import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactivationItem } from './reactivation-service'

let whatsAppConfig: any
let templates: any[]
let eligibleItems: ReactivationItem[]
let queuedCount: number | null
const createdMessages: any[] = []
const updateManyCalls: any[] = []
const enqueued: any[] = []

vi.mock('@/lib/db', () => ({
  prisma: {
    whatsAppConfig: { findUnique: vi.fn(async () => whatsAppConfig) },
    user: {
      findUnique: vi.fn(async () => ({ businessName: 'Studio Ana', name: 'Ana', businessConfig: { publicUrl: 'studio-ana' } })),
    },
    messageTemplate: { findMany: vi.fn(async () => templates) },
    reactivationMessage: {
      create: vi.fn((args: any) => {
        createdMessages.push(args.data)
        return { id: `msg-${createdMessages.length}` }
      }),
      updateMany: vi.fn(async (args: any) => updateManyCalls.push(args)),
    },
    $transaction: vi.fn(async (ops: any[]) => ops),
  },
}))

vi.mock('@/lib/app-url', () => ({ appBaseUrl: () => 'https://calenvo.app' }))

vi.mock('@/lib/whatsapp-dispatch-queue', () => ({
  enqueueAccountJobs: vi.fn(async (jobs: any[]) => {
    enqueued.push(...jobs)
    return queuedCount ?? jobs.length
  }),
}))

vi.mock('@/lib/reactivation-service', async importOriginal => {
  const actual = await importOriginal<typeof import('./reactivation-service')>()
  return { ...actual, listReactivationItems: vi.fn(async () => eligibleItems) }
})

import { queueReactivationMessages, pickTemplate } from './reactivation-send'

const MASTER = { tenantId: 'tenant-a', isMaster: true, professionalId: null }

function item(overrides: Partial<ReactivationItem>): ReactivationItem {
  return {
    clientId: 'c1',
    clientName: 'Maria Clara Souza',
    clientPhone: '5511999999999',
    serviceId: 's1',
    serviceName: 'Corte',
    returnIntervalDays: 30,
    reactivationTemplateId: null,
    lastDate: '2026-09-01',
    professionalId: null,
    professionalName: 'Carla',
    nextAppointmentDate: null,
    lastNotifiedAt: null,
    recentlyNotified: false,
    bucket: 'overdue',
    expectedDate: '2026-10-01',
    daysSinceLast: 41,
    daysUntilDue: -11,
    daysOverdue: 11,
    ...overrides,
  }
}

beforeEach(() => {
  whatsAppConfig = { isConnected: true, apiKey: 'enc' }
  templates = [
    { id: 't-default', body: 'Padrão {{primeiro_nome}} {{servico}} {{link_agendamento}}', isDefault: true },
    { id: 't-service', body: 'Do serviço {{primeiro_nome}}', isDefault: false },
    { id: 't-forced', body: 'Forçado {{dias_atraso}}', isDefault: false },
  ]
  eligibleItems = [item({}), item({ serviceId: 's2', serviceName: 'Coloração', reactivationTemplateId: 't-service' })]
  queuedCount = null
  createdMessages.length = 0
  updateManyCalls.length = 0
  enqueued.length = 0
})

describe('pickTemplate — ordem de escolha', () => {
  it('forçado → serviço → padrão → sistema', () => {
    expect(pickTemplate({ reactivationTemplateId: 't-service' }, templates, 't-forced').templateId).toBe('t-forced')
    expect(pickTemplate({ reactivationTemplateId: 't-service' }, templates).templateId).toBe('t-service')
    expect(pickTemplate({ reactivationTemplateId: null }, templates).templateId).toBe('t-default')
    const system = pickTemplate({ reactivationTemplateId: null }, [])
    expect(system.templateId).toBeNull()
    expect(system.body).toContain('{{primeiro_nome}}')
  })
})

describe('queueReactivationMessages', () => {
  it('PROFESSIONAL não envia (403)', async () => {
    const res = await queueReactivationMessages({ tenantId: 'tenant-a', isMaster: false, professionalId: 'p1' }, { items: [{ clientId: 'c1', serviceId: 's1' }] })
    expect(res).toEqual({ ok: false, status: 403, error: expect.any(String) })
    expect(createdMessages).toHaveLength(0)
  })

  it('WhatsApp desconectado → 409', async () => {
    whatsAppConfig = { isConnected: false, apiKey: 'enc' }
    const res = await queueReactivationMessages(MASTER, { items: [{ clientId: 'c1', serviceId: 's1' }] })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(409)
  })

  it('template forçado de outro tenant → 404', async () => {
    const res = await queueReactivationMessages(MASTER, { items: [{ clientId: 'c1', serviceId: 's1' }], templateId: 't-of-other-tenant' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(404)
  })

  it('um serviço por mensagem: 2 serviços do mesmo cliente → 2 mensagens, cada uma com seu template', async () => {
    const res = await queueReactivationMessages(MASTER, {
      items: [
        { clientId: 'c1', serviceId: 's1' },
        { clientId: 'c1', serviceId: 's2' },
      ],
    })
    expect(res).toEqual({ ok: true, queued: 2, skippedRecent: 0, skippedIneligible: 0 })
    expect(createdMessages.map(m => m.templateId)).toEqual(['t-default', 't-service'])
    expect(createdMessages[0].renderedBody).toBe('Padrão Maria Corte https://calenvo.app/booking/studio-ana')
    expect(enqueued).toEqual([
      { kind: 'reactivation', messageId: 'msg-1' },
      { kind: 'reactivation', messageId: 'msg-2' },
    ])
  })

  it('par que não está na lista elegível do tenant (ex.: id de outro tenant) é ignorado', async () => {
    const res = await queueReactivationMessages(MASTER, {
      items: [
        { clientId: 'c-of-other-tenant', serviceId: 's1' },
        { clientId: 'c1', serviceId: 's1' },
      ],
    })
    expect(res).toEqual({ ok: true, queued: 1, skippedRecent: 0, skippedIneligible: 1 })
    expect(createdMessages.every(m => m.userId === 'tenant-a')).toBe(true)
  })

  it('aviso recente é pulado, a menos que force', async () => {
    eligibleItems = [item({ recentlyNotified: true })]
    const skipped = await queueReactivationMessages(MASTER, { items: [{ clientId: 'c1', serviceId: 's1' }] })
    expect(skipped).toEqual({ ok: true, queued: 0, skippedRecent: 1, skippedIneligible: 0 })

    const forced = await queueReactivationMessages(MASTER, { items: [{ clientId: 'c1', serviceId: 's1' }], force: true })
    expect(forced).toEqual({ ok: true, queued: 1, skippedRecent: 0, skippedIneligible: 0 })
  })

  it('itens duplicados no pedido viram uma mensagem só', async () => {
    await queueReactivationMessages(MASTER, { items: [{ clientId: 'c1', serviceId: 's1' }, { clientId: 'c1', serviceId: 's1' }] })
    expect(createdMessages).toHaveLength(1)
  })

  it('fila indisponível → marca as mensagens como FAILED e devolve 503', async () => {
    queuedCount = 0
    const res = await queueReactivationMessages(MASTER, { items: [{ clientId: 'c1', serviceId: 's1' }] })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(503)
    expect(updateManyCalls[0].data.status).toBe('FAILED')
  })
})
