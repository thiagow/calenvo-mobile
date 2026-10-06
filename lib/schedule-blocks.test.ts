import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))

import {
  blockDay,
  createBlocks,
  deleteBlockGroup,
  findAppointmentsInBlockRange,
  isDateBlocked,
  isScheduleDateBlocked,
} from '@/lib/schedule-blocks'

const SP = 'America/Sao_Paulo'

function block(start: string, end: string) {
  return { startDate: new Date(`${start}T00:00:00.000Z`), endDate: new Date(`${end}T00:00:00.000Z`) }
}

describe('isDateBlocked', () => {
  const blocks = [block('2026-12-24', '2026-12-26')]

  it('bloqueia dentro do período, incluindo as bordas', () => {
    expect(isDateBlocked('2026-12-24', blocks)).toBe(true)
    expect(isDateBlocked('2026-12-25', blocks)).toBe(true)
    expect(isDateBlocked('2026-12-26', blocks)).toBe(true)
  })

  it('não bloqueia fora do período', () => {
    expect(isDateBlocked('2026-12-23', blocks)).toBe(false)
    expect(isDateBlocked('2026-12-27', blocks)).toBe(false)
  })

  it('sem bloqueios nunca bloqueia', () => {
    expect(isDateBlocked('2026-12-25', [])).toBe(false)
  })

  it('aceita datas como string ISO', () => {
    expect(isDateBlocked('2026-12-25', [{ startDate: '2026-12-25T00:00:00.000Z', endDate: '2026-12-25T00:00:00.000Z' }])).toBe(true)
  })

  it('blockDay usa o dia de calendário UTC', () => {
    expect(blockDay(new Date('2026-12-25T00:00:00.000Z'))).toBe('2026-12-25')
  })
})

describe('isScheduleDateBlocked', () => {
  function dbWith(schedule: unknown) {
    return { schedule: { findUnique: vi.fn(async () => schedule) } } as never
  }

  it('usa o fuso do negócio: 01:30Z do dia 26 ainda é dia 25 em São Paulo', async () => {
    const tx = dbWith({
      blocks: [block('2026-12-25', '2026-12-25')],
      user: { businessConfig: { timezone: SP } },
    })
    expect(await isScheduleDateBlocked({ scheduleId: 's1', date: new Date('2026-12-26T01:30:00.000Z'), tx })).toBe(true)
  })

  it('agenda inexistente não bloqueia', async () => {
    expect(await isScheduleDateBlocked({ scheduleId: 'x', date: new Date(), tx: dbWith(null) })).toBe(false)
  })
})

describe('createBlocks', () => {
  function dbCreateMany() {
    const createMany = vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length }))
    return { db: { scheduleBlock: { createMany } } as never, createMany }
  }
  const base = { startDate: new Date('2026-12-24T00:00:00Z'), endDate: new Date('2026-12-26T00:00:00Z'), reason: 'Natal', isAllDay: true }

  it('uma agenda: sem groupId', async () => {
    const { db, createMany } = dbCreateMany()
    const result = await createBlocks(db, { ...base, scheduleIds: ['a'], grouped: false })

    expect(result).toEqual({ count: 1, groupId: null })
    expect(createMany.mock.calls[0][0].data).toEqual([expect.objectContaining({ scheduleId: 'a', groupId: null })])
  })

  it('todas as agendas: um bloco por agenda, todos com o mesmo groupId', async () => {
    const { db, createMany } = dbCreateMany()
    const result = await createBlocks(db, { ...base, scheduleIds: ['a', 'b', 'c'], grouped: true })

    const rows = createMany.mock.calls[0][0].data as { scheduleId: string; groupId: string }[]
    expect(result.count).toBe(3)
    expect(rows.map((r) => r.scheduleId)).toEqual(['a', 'b', 'c'])
    expect(new Set(rows.map((r) => r.groupId)).size).toBe(1)
    expect(rows[0].groupId).toBe(result.groupId)
    expect(result.groupId).toBeTruthy()
  })
})

describe('deleteBlockGroup', () => {
  it('escopa a remoção ao tenant dono', async () => {
    const deleteMany = vi.fn(async () => ({ count: 4 }))
    const removed = await deleteBlockGroup({ scheduleBlock: { deleteMany } } as never, { userId: 'tenant-a', groupId: 'g1' })

    expect(removed).toBe(4)
    expect(deleteMany).toHaveBeenCalledWith({ where: { groupId: 'g1', schedule: { userId: 'tenant-a' } } })
  })
})

describe('findAppointmentsInBlockRange', () => {
  function dbWith(rows: unknown[]) {
    const findMany = vi.fn(async () => rows)
    return { db: { appointment: { findMany } } as never, findMany }
  }
  const params = {
    userId: 'tenant-a',
    scheduleIds: ['a', 'b'],
    startDate: new Date('2026-12-24T00:00:00Z'),
    endDate: new Date('2026-12-26T00:00:00Z'),
    timeZone: SP,
  }

  it('só considera agendamentos abertos e não excluídos, nas agendas-alvo e no tenant', async () => {
    const { db, findMany } = dbWith([])
    await findAppointmentsInBlockRange(db, params)

    const where = (findMany.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where
    expect(where).toMatchObject({
      userId: 'tenant-a',
      scheduleId: { in: ['a', 'b'] },
      status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
      deletedAt: null,
    })
  })

  it('a janela vai de 00:00 do primeiro dia a 23:59 do último, no fuso do negócio', async () => {
    const { db, findMany } = dbWith([])
    await findAppointmentsInBlockRange(db, params)

    const date = (findMany.mock.calls[0] as unknown as [{ where: { date: { gte: Date; lte: Date } } }])[0].where.date
    expect(date.gte.toISOString()).toBe('2026-12-24T03:00:00.000Z')
    expect(date.lte.toISOString()).toBe('2026-12-27T02:59:59.999Z')
  })

  it('sem agendas-alvo nem consulta', async () => {
    const { db, findMany } = dbWith([])
    expect(await findAppointmentsInBlockRange(db, { ...params, scheduleIds: [] })).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })

  it('mapeia cliente e serviço, com fallback de nome', async () => {
    const { db } = dbWith([
      { id: '1', date: new Date('2026-12-24T13:00:00Z'), client: { name: 'Maria' }, service: { name: 'Corte' }, specialty: null },
      { id: '2', date: new Date('2026-12-25T13:00:00Z'), client: { name: 'João' }, service: null, specialty: null },
    ])
    const result = await findAppointmentsInBlockRange(db, params)

    expect(result.map((r) => [r.clientName, r.serviceName])).toEqual([['Maria', 'Corte'], ['João', 'Agendamento']])
  })
})
