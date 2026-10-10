import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))

import {
  blockDay,
  createBlocks,
  deleteBlockGroup,
  describeBlock,
  findAppointmentsInBlockRange,
  isDateBlocked,
  isIntervalBlocked,
  isScheduleDateBlocked,
  parseBlockInput,
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

describe('parseBlockInput', () => {
  it('dia inteiro sem término é um dia só (início = fim)', () => {
    const r = parseBlockInput({ isAllDay: true, startDate: '2026-10-20' }, SP)
    expect(r).toMatchObject({ ok: true, isAllDay: true })
    if (r.ok) expect(r.startDate.toISOString()).toBe(r.endDate.toISOString())
  })

  it('dia inteiro com início = término é aceito; término anterior é recusado', () => {
    expect(parseBlockInput({ startDate: '2026-10-20', endDate: '2026-10-20' }, SP).ok).toBe(true)
    expect(parseBlockInput({ startDate: '2026-10-21', endDate: '2026-10-20' }, SP).ok).toBe(false)
  })

  it('dia inteiro grava meia-noite UTC do dia escolhido', () => {
    const r = parseBlockInput({ startDate: '2026-10-20', endDate: '2026-10-21' }, SP)
    expect(r.ok && r.startDate.toISOString()).toBe('2026-10-20T00:00:00.000Z')
    expect(r.ok && r.endDate.toISOString()).toBe('2026-10-21T00:00:00.000Z')
  })

  it('rejeita datas inválidas', () => {
    expect(parseBlockInput({ startDate: 'lixo' }, SP).ok).toBe(false)
    expect(parseBlockInput({ startDate: '2026-02-30' }, SP).ok).toBe(false)
    expect(parseBlockInput({}, SP).ok).toBe(false)
  })

  it('faixa de horário: lê no fuso do negócio (14:00 em São Paulo = 17:00Z)', () => {
    const r = parseBlockInput({ isAllDay: false, date: '2026-10-20', startTime: '14:00', endTime: '16:00' }, SP)
    expect(r.ok && r.startDate.toISOString()).toBe('2026-10-20T17:00:00.000Z')
    expect(r.ok && r.endDate.toISOString()).toBe('2026-10-20T19:00:00.000Z')
  })

  it('faixa de horário: horário final precisa ser posterior ao inicial; formato inválido é recusado', () => {
    expect(parseBlockInput({ isAllDay: false, date: '2026-10-20', startTime: '16:00', endTime: '16:00' }, SP).ok).toBe(false)
    expect(parseBlockInput({ isAllDay: false, date: '2026-10-20', startTime: '17:00', endTime: '09:00' }, SP).ok).toBe(false)
    expect(parseBlockInput({ isAllDay: false, date: '2026-10-20', startTime: '9h', endTime: '10:00' }, SP).ok).toBe(false)
    expect(parseBlockInput({ isAllDay: false, startTime: '09:00', endTime: '10:00' }, SP).ok).toBe(false)
  })
})

describe('isIntervalBlocked', () => {
  // 14:00–16:00 em São Paulo no dia 20/10/2026
  const partial = { startDate: new Date('2026-10-20T17:00:00Z'), endDate: new Date('2026-10-20T19:00:00Z'), isAllDay: false }
  const at = (hhmmZ: string) => new Date(`2026-10-20T${hhmmZ}:00Z`)

  it('bloqueia o slot que sobrepõe a faixa e libera os adjacentes', () => {
    const check = (start: string, dur: number) =>
      isIntervalBlocked({ dateStr: '2026-10-20', start: at(start), durationMinutes: dur, blocks: [partial] })
    expect(check('17:00', 30)).toBe(true)
    expect(check('18:30', 30)).toBe(true)
    expect(check('16:30', 60)).toBe(true) // começa antes mas invade a faixa
    expect(check('16:00', 60)).toBe(false) // termina exatamente quando a faixa começa
    expect(check('19:00', 30)).toBe(false) // começa quando a faixa termina
  })

  it('faixa de horário não bloqueia o dia inteiro', () => {
    expect(isDateBlocked('2026-10-20', [partial])).toBe(false)
  })

  it('dia inteiro continua bloqueando qualquer horário do dia', () => {
    const allDay = { startDate: new Date('2026-10-20T00:00:00Z'), endDate: new Date('2026-10-21T00:00:00Z'), isAllDay: true }
    expect(isIntervalBlocked({ dateStr: '2026-10-20', start: at('13:00'), durationMinutes: 30, blocks: [allDay] })).toBe(true)
    expect(isIntervalBlocked({ dateStr: '2026-10-21', start: new Date('2026-10-21T13:00:00Z'), durationMinutes: 30, blocks: [allDay] })).toBe(true)
    expect(isIntervalBlocked({ dateStr: '2026-10-22', start: new Date('2026-10-22T13:00:00Z'), durationMinutes: 30, blocks: [allDay] })).toBe(false)
  })
})

describe('describeBlock', () => {
  it('dia inteiro: dias de calendário, sem horários', () => {
    expect(describeBlock({ startDate: new Date('2026-10-20T00:00:00Z'), endDate: new Date('2026-10-21T00:00:00Z'), isAllDay: true }, SP)).toEqual({
      firstDay: '2026-10-20',
      lastDay: '2026-10-21',
      startTime: null,
      endTime: null,
    })
  })

  it('faixa: dia e horários no fuso do negócio', () => {
    expect(describeBlock({ startDate: new Date('2026-10-21T01:00:00Z'), endDate: new Date('2026-10-21T02:30:00Z'), isAllDay: false }, SP)).toEqual({
      firstDay: '2026-10-20', // 22:00 de São Paulo ainda é dia 20
      lastDay: '2026-10-20',
      startTime: '22:00',
      endTime: '23:30',
    })
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

  it('faixa de horário: só avisa de agendamentos que esbarram na faixa', async () => {
    const { db } = dbWith([
      { id: '1', date: new Date('2026-10-20T17:30:00Z'), duration: 30, client: { name: 'Dentro' }, service: null, specialty: null },
      { id: '2', date: new Date('2026-10-20T13:00:00Z'), duration: 60, client: { name: 'Antes' }, service: null, specialty: null },
      { id: '3', date: new Date('2026-10-20T16:30:00Z'), duration: 60, client: { name: 'Invade' }, service: null, specialty: null },
      { id: '4', date: new Date('2026-10-20T19:00:00Z'), duration: 30, client: { name: 'Depois' }, service: null, specialty: null },
    ])
    const result = await findAppointmentsInBlockRange(db, {
      ...params,
      isAllDay: false,
      startDate: new Date('2026-10-20T17:00:00Z'),
      endDate: new Date('2026-10-20T19:00:00Z'),
    })

    expect(result.map((r) => r.clientName)).toEqual(['Dentro', 'Invade'])
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
