import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { sessionMock } = vi.hoisted(() => ({ sessionMock: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: sessionMock }))

const MASTER = { user: { id: 'tenant-a', role: 'MASTER' } }
const PROFESSIONAL = { user: { id: 'pro-1', role: 'PROFESSIONAL', masterId: 'tenant-a' } }
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }))

let mockSchedules: { id: string; userId: string }[] = []
let mockOpenAppointments: any[] = []
let mockStoredBlocks: any[] = []
let mockGroupSizes: { groupId: string; _count: { _all: number } }[] = []
const { createManyMock, appointmentWriteMock } = vi.hoisted(() => ({
  createManyMock: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
  appointmentWriteMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    schedule: {
      findFirst: vi.fn(async ({ where }: any) =>
        mockSchedules.find((s) => s.id === where.id && s.userId === where.userId) ?? null
      ),
      findMany: vi.fn(async ({ where }: any) => mockSchedules.filter((s) => s.userId === where.userId)),
    },
    businessConfig: { findUnique: vi.fn(async () => ({ timezone: 'America/Sao_Paulo' })) },
    appointment: {
      findMany: vi.fn(async () => mockOpenAppointments),
      // Qualquer escrita em agendamento durante a criação de um bloqueio é um bug.
      update: appointmentWriteMock,
      updateMany: appointmentWriteMock,
      delete: appointmentWriteMock,
      deleteMany: appointmentWriteMock,
    },
    scheduleBlock: {
      createMany: createManyMock,
      findMany: vi.fn(async () => mockStoredBlocks),
      groupBy: vi.fn(async () => mockGroupSizes),
    },
  },
}))

import { GET, POST } from './route'

const body = { startDate: '2026-12-24', endDate: '2026-12-26', reason: 'Natal', isAllDay: true }

function post(extra: Record<string, unknown> = {}) {
  return POST(
    new NextRequest('http://localhost/api/schedules/s1/blocks', {
      method: 'POST',
      body: JSON.stringify({ ...body, ...extra }),
    }),
    { params: { id: 's1' } }
  )
}

beforeEach(() => {
  sessionMock.mockResolvedValue(MASTER)
  mockSchedules = [
    { id: 's1', userId: 'tenant-a' },
    { id: 's2', userId: 'tenant-a' },
    { id: 's3', userId: 'tenant-a' },
    { id: 'outro', userId: 'tenant-b' },
  ]
  mockOpenAppointments = []
  mockStoredBlocks = []
  mockGroupSizes = []
  createManyMock.mockClear()
  appointmentWriteMock.mockClear()
})

describe('GET /api/schedules/[id]/blocks', () => {
  const stored = (id: string, groupId: string | null, start: string, end: string) => ({
    id,
    scheduleId: 's1',
    groupId,
    reason: null,
    isAllDay: true,
    startDate: new Date(`${start}T00:00:00.000Z`),
    endDate: new Date(`${end}T00:00:00.000Z`),
  })
  const get = () => GET(new NextRequest('http://localhost/api/schedules/s1/blocks'), { params: { id: 's1' } })

  it('lista só os bloqueios da própria agenda; os gerais viram contagem', async () => {
    mockStoredBlocks = [
      stored('own', null, '2099-01-10', '2099-01-12'),
      stored('geral', 'g1', '2099-02-01', '2099-02-03'),
      stored('solo', 'g-solo', '2099-03-01', '2099-03-01'),
    ]
    mockGroupSizes = [
      { groupId: 'g1', _count: { _all: 13 } },
      { groupId: 'g-solo', _count: { _all: 1 } },
    ]

    const json = await (await get()).json()

    expect(json.blocks.map((b: { id: string }) => b.id)).toEqual(['own', 'solo'])
    expect(json.blocks[0]).toMatchObject({ firstDay: '2099-01-10', lastDay: '2099-01-12', isPast: false, groupId: null })
    expect(json.generalBlocksCount).toBe(1)
  })

  it('bloqueio geral já encerrado não entra na contagem do aviso', async () => {
    mockStoredBlocks = [stored('velho', 'g1', '2020-01-01', '2020-01-02')]
    mockGroupSizes = [{ groupId: 'g1', _count: { _all: 13 } }]

    expect((await (await get()).json()).generalBlocksCount).toBe(0)
  })
})

describe('sobreposição na criação', () => {
  it('período já coberto por outro bloqueio: 409 BLOCK_OVERLAPS_EXISTING e NADA é criado', async () => {
    mockStoredBlocks = [
      {
        id: 'velho',
        groupId: null,
        reason: 'Curso',
        isAllDay: true,
        startDate: new Date('2026-12-24T00:00:00.000Z'),
        endDate: new Date('2026-12-25T00:00:00.000Z'),
        schedule: { name: 'Corte' },
      },
    ]
    const res = await post()
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.code).toBe('BLOCK_OVERLAPS_EXISTING')
    expect(json.overlapping[0]).toMatchObject({ firstDay: '2026-12-24', lastDay: '2026-12-25', reason: 'Curso' })
    expect(createManyMock).not.toHaveBeenCalled()
  })

  it('com confirmOverlaps cria normalmente', async () => {
    mockStoredBlocks = [
      {
        id: 'velho',
        groupId: null,
        reason: null,
        isAllDay: true,
        startDate: new Date('2026-12-24T00:00:00.000Z'),
        endDate: new Date('2026-12-25T00:00:00.000Z'),
        schedule: { name: 'Corte' },
      },
    ]
    expect((await post({ confirmOverlaps: true })).status).toBe(201)
    expect(createManyMock).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/schedules/[id]/blocks', () => {
  it('sem applyToAll cria um bloqueio só para a agenda (regressão)', async () => {
    const res = await post()

    expect(res.status).toBe(201)
    const rows = createManyMock.mock.calls[0][0].data as { scheduleId: string; groupId: string | null }[]
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ scheduleId: 's1', groupId: null })
  })

  it('applyToAll cria um bloqueio por agenda do tenant, com o mesmo groupId, sem tocar outro tenant', async () => {
    const res = await post({ applyToAll: true })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.schedulesCount).toBe(3)
    const rows = createManyMock.mock.calls[0][0].data as { scheduleId: string; groupId: string }[]
    expect(rows.map((r) => r.scheduleId).sort()).toEqual(['s1', 's2', 's3'])
    expect(new Set(rows.map((r) => r.groupId)).size).toBe(1)
  })

  it('com agendamentos no período e sem confirmação: 409 e NADA é criado', async () => {
    mockOpenAppointments = [
      { id: 'a1', date: new Date('2026-12-24T13:00:00Z'), client: { name: 'Maria' }, service: { name: 'Corte' }, specialty: null },
    ]
    const res = await post({ applyToAll: true })
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.code).toBe('BLOCK_HAS_APPOINTMENTS')
    expect(json.conflictingAppointments).toBe(1)
    expect(json.sample[0]).toMatchObject({ clientName: 'Maria', serviceName: 'Corte' })
    expect(createManyMock).not.toHaveBeenCalled()
  })

  it('com confirmConflicts cria o bloqueio e NÃO altera nenhum agendamento', async () => {
    mockOpenAppointments = [
      { id: 'a1', date: new Date('2026-12-24T13:00:00Z'), client: { name: 'Maria' }, service: { name: 'Corte' }, specialty: null },
    ]
    const res = await post({ applyToAll: true, confirmConflicts: true })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.conflictingAppointments).toBe(1)
    expect(createManyMock).toHaveBeenCalledTimes(1)
    expect(appointmentWriteMock).not.toHaveBeenCalled()
  })

  it('agenda de outro tenant: 404, nada criado', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/schedules/outro/blocks', { method: 'POST', body: JSON.stringify(body) }),
      { params: { id: 'outro' } }
    )

    expect(res.status).toBe(404)
    expect(createManyMock).not.toHaveBeenCalled()
  })

  it('um dia só: início = término (ou sem término) é aceito', async () => {
    expect((await post({ startDate: '2026-10-20', endDate: '2026-10-20' })).status).toBe(201)
    expect((await post({ startDate: '2026-10-20', endDate: undefined })).status).toBe(201)
    const rows = createManyMock.mock.calls[1][0].data as { startDate: Date; endDate: Date }[]
    expect(rows[0].startDate.toISOString()).toBe('2026-10-20T00:00:00.000Z')
    expect(rows[0].endDate.toISOString()).toBe('2026-10-20T00:00:00.000Z')
  })

  it('faixa de horário: grava instantes no fuso do negócio e isAllDay=false', async () => {
    const res = await post({ isAllDay: false, date: '2026-10-20', startTime: '14:00', endTime: '16:00' })

    expect(res.status).toBe(201)
    const rows = createManyMock.mock.calls[0][0].data as { startDate: Date; endDate: Date; isAllDay: boolean }[]
    expect(rows[0].isAllDay).toBe(false)
    expect(rows[0].startDate.toISOString()).toBe('2026-10-20T17:00:00.000Z')
    expect(rows[0].endDate.toISOString()).toBe('2026-10-20T19:00:00.000Z')
  })

  it('faixa de horário com fim antes do início: 400', async () => {
    expect((await post({ isAllDay: false, date: '2026-10-20', startTime: '16:00', endTime: '14:00' })).status).toBe(400)
    expect(createManyMock).not.toHaveBeenCalled()
  })

  it('datas inválidas: 400', async () => {
    expect((await post({ startDate: '2026-12-26', endDate: '2026-12-24' })).status).toBe(400)
    expect((await post({ startDate: 'lixo', endDate: 'lixo' })).status).toBe(400)
    expect(createManyMock).not.toHaveBeenCalled()
  })
})
