import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { sessionMock } = vi.hoisted(() => ({ sessionMock: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: sessionMock }))
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }))

const MASTER = { user: { id: 'tenant-a', role: 'MASTER' } }
const PROFESSIONAL = { user: { id: 'pro-1', role: 'PROFESSIONAL', masterId: 'tenant-a' } }

let mockBlock: Record<string, unknown> | null = null
const { deleteMock, deleteManyMock, countMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  deleteManyMock: vi.fn(async () => ({ count: 3 })),
  countMock: vi.fn(async () => 1),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    scheduleBlock: {
      findFirst: vi.fn(async () => mockBlock),
      delete: deleteMock,
      deleteMany: deleteManyMock,
      count: countMock,
      update: vi.fn(async ({ data }: { data: unknown }) => data),
    },
    businessConfig: { findUnique: vi.fn(async () => ({ timezone: 'America/Sao_Paulo' })) },
  },
}))

import { DELETE, PUT } from './route'

const ctx = { params: { id: 's1', blockId: 'b1' } }
const del = (query = '') =>
  DELETE(new NextRequest(`http://localhost/api/schedules/s1/blocks/b1${query}`, { method: 'DELETE' }), ctx)

beforeEach(() => {
  sessionMock.mockResolvedValue(MASTER)
  mockBlock = { id: 'b1', scheduleId: 's1', groupId: null, professionalId: null }
  deleteMock.mockClear()
  deleteManyMock.mockClear()
  countMock.mockReset()
  countMock.mockResolvedValue(1)
})

describe('DELETE /api/schedules/[id]/blocks/[blockId]', () => {
  it('administrador remove qualquer bloqueio do tenant', async () => {
    const res = await del()

    expect(res.status).toBe(200)
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'b1' } })
  })

  it('bloqueio inexistente: 404', async () => {
    mockBlock = null
    expect((await del()).status).toBe(404)
  })

  it('profissional NÃO remove bloqueio da agenda inteira', async () => {
    sessionMock.mockResolvedValue(PROFESSIONAL)

    expect((await del()).status).toBe(403)
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('profissional NÃO remove bloqueio pessoal de colega', async () => {
    sessionMock.mockResolvedValue(PROFESSIONAL)
    mockBlock = { id: 'b1', scheduleId: 's1', groupId: 'g1', professionalId: 'outro-pro' }

    expect((await del('?scope=all')).status).toBe(403)
    expect(deleteManyMock).not.toHaveBeenCalled()
  })

  it('profissional remove o próprio; scope=all limita a exclusão aos blocos dele', async () => {
    sessionMock.mockResolvedValue(PROFESSIONAL)
    mockBlock = { id: 'b1', scheduleId: 's1', groupId: 'g1', professionalId: 'pro-1' }

    const res = await del('?scope=all')

    expect(res.status).toBe(200)
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { groupId: 'g1', schedule: { userId: 'tenant-a' }, professionalId: 'pro-1' }
    })
  })
})

describe('PUT /api/schedules/[id]/blocks/[blockId]', () => {
  const put = (body: Record<string, unknown> = { isAllDay: true, startDate: '2026-12-10', endDate: '2026-12-11' }) =>
    PUT(new NextRequest('http://localhost/api/schedules/s1/blocks/b1', { method: 'PUT', body: JSON.stringify(body) }), ctx)

  it('bloco de grupo com irmãos não é editado sozinho: 409', async () => {
    mockBlock = { id: 'b1', scheduleId: 's1', groupId: 'g1', professionalId: null }
    countMock.mockResolvedValue(13)

    expect((await put()).status).toBe(409)
  })

  it('profissional não edita bloqueio da agenda inteira: 403', async () => {
    sessionMock.mockResolvedValue(PROFESSIONAL)

    expect((await put()).status).toBe(403)
  })

  it('bloco avulso do administrador é editado normalmente', async () => {
    expect((await put()).status).toBe(200)
  })
})
