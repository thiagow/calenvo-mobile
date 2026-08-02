import { describe, it, expect, vi, beforeEach } from 'vitest'

const publishCalls: any[] = []

vi.mock('@upstash/qstash', () => ({
  Client: class {
    async publishJSON(args: any) {
      publishCalls.push(args)
    }
  },
}))

vi.mock('@/lib/app-url', () => ({
  appBaseUrl: () => 'https://app.calenvo.com',
}))

beforeEach(() => {
  publishCalls.length = 0
  vi.stubEnv('QSTASH_TOKEN', 'test-token')
  vi.resetModules()
})

describe('enqueueAccountJobs', () => {
  it('publica um job por appointmentId, apontando pra dispatch-whatsapp', async () => {
    const { enqueueAccountJobs } = await import('@/lib/whatsapp-dispatch-queue')

    const queued = await enqueueAccountJobs([
      { kind: 'reminder', appointmentId: 'a1' },
      { kind: 'reminder', appointmentId: 'a2' },
    ])

    expect(queued).toBe(2)
    expect(publishCalls).toHaveLength(2)
    expect(publishCalls[0].url).toBe('https://app.calenvo.com/api/internal/dispatch-whatsapp')
    expect(publishCalls[0].body).toEqual({ kind: 'reminder', appointmentId: 'a1' })
  })

  it('delay é crescente entre jobs da mesma conta (nunca em rajada)', async () => {
    const { enqueueAccountJobs } = await import('@/lib/whatsapp-dispatch-queue')

    await enqueueAccountJobs([
      { kind: 'confirmation-request', appointmentId: 'a1' },
      { kind: 'confirmation-request', appointmentId: 'a2' },
      { kind: 'confirmation-request', appointmentId: 'a3' },
    ])

    const delays = publishCalls.map((c) => Number(c.delay.replace('s', '')))
    expect(delays[1]).toBeGreaterThan(delays[0])
    expect(delays[2]).toBeGreaterThan(delays[1])
  })

  it('lista vazia não publica nada', async () => {
    const { enqueueAccountJobs } = await import('@/lib/whatsapp-dispatch-queue')

    const queued = await enqueueAccountJobs([])

    expect(queued).toBe(0)
    expect(publishCalls).toHaveLength(0)
  })

  it('sem QSTASH_TOKEN, não publica e não lança erro', async () => {
    vi.stubEnv('QSTASH_TOKEN', '')
    const { enqueueAccountJobs } = await import('@/lib/whatsapp-dispatch-queue')

    const queued = await enqueueAccountJobs([{ kind: 'reminder', appointmentId: 'a1' }])

    expect(queued).toBe(0)
    expect(publishCalls).toHaveLength(0)
  })
})
