import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { sessionMock } = vi.hoisted(() => ({ sessionMock: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: sessionMock }))

const MASTER = { user: { id: 'tenant-a', role: 'MASTER' } }
const PROFESSIONAL = { user: { id: 'pro-1', role: 'PROFESSIONAL', masterId: 'tenant-a' } }
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }))

const { deleteManyMock, createManyMock, findFirstMock } = vi.hoisted(() => ({
  deleteManyMock: vi.fn(),
  createManyMock: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
  findFirstMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    schedule: { findMany: vi.fn(async () => [{ id: 's9' }]) },
    scheduleBlock: {
      deleteMany: deleteManyMock,
      createMany: createManyMock,
      findFirst: findFirstMock,
      findMany: vi.fn(async () => []),
    },
  },
}))

import { DELETE, POST } from './route'

const ctx = { params: { groupId: 'g1' } }
const template = { startDate: new Date('2026-12-10T00:00:00Z'), endDate: new Date('2026-12-11T00:00:00Z'), reason: 'x', isAllDay: true }

beforeEach(() => {
  sessionMock.mockResolvedValue(MASTER)
  deleteManyMock.mockReset()
  createManyMock.mockClear()
  findFirstMock.mockReset()
})

describe('DELETE /api/schedule-blocks/[groupId]', () => {
  it('remove o grupo escopado ao tenant', async () => {
    deleteManyMock.mockResolvedValue({ count: 13 })
    const res = await DELETE(new NextRequest('http://localhost/api/schedule-blocks/g1', { method: 'DELETE' }), ctx)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, removed: 13 })
    expect(deleteManyMock).toHaveBeenCalledWith({ where: { groupId: 'g1', schedule: { userId: 'tenant-a' } } })
  })

  it('idempotente: grupo já removido não é erro', async () => {
    deleteManyMock.mockResolvedValue({ count: 0 })
    const res = await DELETE(new NextRequest('http://localhost/api/schedule-blocks/g1', { method: 'DELETE' }), ctx)

    expect(res.status).toBe(200)
    expect((await res.json()).removed).toBe(0)
  })
})

describe('DELETE /api/schedule-blocks/[groupId] — profissional', () => {
  it('só remove blocos pessoais dele: o filtro por professionalId vai junto na exclusão', async () => {
    sessionMock.mockResolvedValue(PROFESSIONAL)
    deleteManyMock.mockResolvedValue({ count: 0 })
    const res = await DELETE(new NextRequest('http://localhost/api/schedule-blocks/g1', { method: 'DELETE' }), ctx)

    expect(res.status).toBe(200)
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { groupId: 'g1', schedule: { userId: 'tenant-a' }, professionalId: 'pro-1' }
    })
  })
})

describe('POST /api/schedule-blocks/[groupId]', () => {
  const post = (body: unknown) =>
    POST(new NextRequest('http://localhost/api/schedule-blocks/g1', { method: 'POST', body: JSON.stringify(body) }), ctx)

  it('scheduleIds ausente ou vazio: 400', async () => {
    expect((await post({})).status).toBe(400)
    expect((await post({ scheduleIds: [] })).status).toBe(400)
  })

  it('grupo que não é do tenant: 404, nada criado', async () => {
    findFirstMock.mockResolvedValue(null)
    expect((await post({ scheduleIds: ['s9'] })).status).toBe(404)
    expect(createManyMock).not.toHaveBeenCalled()
  })

  it('estende o grupo às agendas pedidas', async () => {
    findFirstMock.mockResolvedValue(template)
    const res = await post({ scheduleIds: ['s9'] })

    expect(res.status).toBe(200)
    expect((await res.json()).schedulesCount).toBe(1)
    expect(createManyMock).toHaveBeenCalledWith({ data: [{ scheduleId: 's9', groupId: 'g1', ...template }] })
  })
})
