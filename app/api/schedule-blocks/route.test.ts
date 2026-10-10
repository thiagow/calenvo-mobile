import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'tenant-a' } })) }))
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }))

let mockSchedules: { id: string; userId: string }[] = []
const { createManyMock } = vi.hoisted(() => ({
  createManyMock: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    schedule: {
      findMany: vi.fn(async ({ where }: any) =>
        mockSchedules.filter((s) => s.userId === where.userId && where.id.in.includes(s.id))
      ),
    },
    businessConfig: { findUnique: vi.fn(async () => ({ timezone: 'America/Sao_Paulo' })) },
    appointment: { findMany: vi.fn(async () => []) },
    scheduleBlock: { createMany: createManyMock },
  },
}))

import { POST } from './route'

const period = { isAllDay: true, startDate: '2026-10-20', endDate: '2026-10-21', reason: 'Feriado' }

function post(body: Record<string, unknown>) {
  return POST(new NextRequest('http://localhost/api/schedule-blocks', { method: 'POST', body: JSON.stringify(body) }))
}

beforeEach(() => {
  mockSchedules = [
    { id: 's1', userId: 'tenant-a' },
    { id: 's2', userId: 'tenant-a' },
    { id: 's3', userId: 'tenant-a' },
    { id: 'outro', userId: 'tenant-b' },
  ]
  createManyMock.mockClear()
})

describe('POST /api/schedule-blocks', () => {
  it('subconjunto de agendas: um bloco por agenda, com o mesmo groupId', async () => {
    const res = await post({ ...period, scheduleIds: ['s1', 's3'] })

    expect(res.status).toBe(201)
    const rows = createManyMock.mock.calls[0][0].data as { scheduleId: string; groupId: string }[]
    expect(rows.map((r) => r.scheduleId)).toEqual(['s1', 's3'])
    expect(new Set(rows.map((r) => r.groupId)).size).toBe(1)
    expect(rows[0].groupId).toBeTruthy()
  })

  it('uma agenda só: sem groupId', async () => {
    const res = await post({ ...period, scheduleIds: ['s2'] })

    expect(res.status).toBe(201)
    const rows = createManyMock.mock.calls[0][0].data as { groupId: string | null }[]
    expect(rows).toHaveLength(1)
    expect(rows[0].groupId).toBeNull()
  })

  it('ids repetidos são ignorados', async () => {
    await post({ ...period, scheduleIds: ['s1', 's1'] })

    expect(createManyMock.mock.calls[0][0].data).toHaveLength(1)
  })

  it('agenda de outro tenant no meio da lista: 404 e NADA é criado', async () => {
    const res = await post({ ...period, scheduleIds: ['s1', 'outro'] })

    expect(res.status).toBe(404)
    expect(createManyMock).not.toHaveBeenCalled()
  })

  it('scheduleIds vazio ou ausente: 400', async () => {
    expect((await post({ ...period, scheduleIds: [] })).status).toBe(400)
    expect((await post({ ...period })).status).toBe(400)
    expect(createManyMock).not.toHaveBeenCalled()
  })

  it('dados inválidos: 400, nada criado', async () => {
    expect((await post({ ...period, startDate: 'lixo', scheduleIds: ['s1'] })).status).toBe(400)
    expect(createManyMock).not.toHaveBeenCalled()
  })
})
