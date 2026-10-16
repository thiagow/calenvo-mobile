import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))

import {
  addSchedulesToGroup,
  blocksOverlap,
  findOverlappingBlocks,
  isBlockPast,
  listGeneralBlocks,
} from '@/lib/schedule-blocks'

const SP = 'America/Sao_Paulo'

const allDay = (start: string, end: string) => ({
  startDate: new Date(`${start}T00:00:00.000Z`),
  endDate: new Date(`${end}T00:00:00.000Z`),
  isAllDay: true,
})
// 14:00–16:00 em São Paulo (GMT-3)
const range = (day: string, from = '17:00', to = '19:00') => ({
  startDate: new Date(`${day}T${from}:00.000Z`),
  endDate: new Date(`${day}T${to}:00.000Z`),
  isAllDay: false,
})

describe('blocksOverlap', () => {
  it('dia inteiro × dia inteiro: término é inclusivo (23/11–04/12 colide com 04/12)', () => {
    expect(blocksOverlap(allDay('2026-11-23', '2026-12-04'), allDay('2026-12-04', '2026-12-04'), SP)).toBe(true)
    expect(blocksOverlap(allDay('2026-11-24', '2026-12-03'), allDay('2026-12-04', '2026-12-04'), SP)).toBe(false)
  })

  it('dia inteiro × faixa: colide quando a faixa cai num dia coberto', () => {
    expect(blocksOverlap(allDay('2026-12-01', '2026-12-03'), range('2026-12-02'), SP)).toBe(true)
    expect(blocksOverlap(allDay('2026-12-01', '2026-12-03'), range('2026-12-04'), SP)).toBe(false)
  })

  it('faixa × faixa: sobreposição de instantes; encostar não é sobrepor', () => {
    expect(blocksOverlap(range('2026-12-02', '17:00', '19:00'), range('2026-12-02', '18:00', '20:00'), SP)).toBe(true)
    expect(blocksOverlap(range('2026-12-02', '17:00', '19:00'), range('2026-12-02', '19:00', '20:00'), SP)).toBe(false)
  })

  it('faixa à noite (21h SP = 00h UTC do dia seguinte) conta pelo dia do negócio', () => {
    const night = range('2026-12-03', '23:30', '23:59') // 20:30–20:59 SP, dia 03
    expect(blocksOverlap(allDay('2026-12-03', '2026-12-03'), night, SP)).toBe(true)
  })
})

describe('isBlockPast', () => {
  const now = new Date('2026-12-04T15:00:00.000Z')

  it('dia inteiro: só encerra depois do último dia', () => {
    expect(isBlockPast(allDay('2026-12-01', '2026-12-04'), SP, now)).toBe(false)
    expect(isBlockPast(allDay('2026-12-01', '2026-12-03'), SP, now)).toBe(true)
  })

  it('faixa: encerra quando o horário final passou', () => {
    expect(isBlockPast(range('2026-12-04', '12:00', '14:00'), SP, now)).toBe(true)
    expect(isBlockPast(range('2026-12-04', '17:00', '19:00'), SP, now)).toBe(false)
  })
})

describe('findOverlappingBlocks', () => {
  it('lista um item por período distinto e junta as agendas do mesmo grupo', async () => {
    const db = {
      scheduleBlock: {
        findMany: vi.fn(async () => [
          { id: 'b1', groupId: 'g1', reason: 'VIAGEM', ...allDay('2026-11-24', '2026-12-03'), schedule: { name: 'Corte ' } },
          { id: 'b2', groupId: 'g1', reason: 'VIAGEM', ...allDay('2026-11-24', '2026-12-03'), schedule: { name: 'Escova' } },
          { id: 'b3', groupId: null, reason: null, ...allDay('2026-12-20', '2026-12-21'), schedule: { name: 'Corte ' } },
        ]),
      },
    }

    const found = await findOverlappingBlocks(db as never, {
      scheduleIds: ['s1', 's2'],
      ...allDay('2026-12-01', '2026-12-05'),
      timeZone: SP,
    })

    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ key: 'g1', firstDay: '2026-11-24', lastDay: '2026-12-03', reason: 'VIAGEM' })
    expect(found[0].scheduleNames).toEqual(['Corte', 'Escova'])
  })

  it('sem agendas-alvo não consulta o banco', async () => {
    const db = { scheduleBlock: { findMany: vi.fn() } }
    expect(
      await findOverlappingBlocks(db as never, { scheduleIds: [], ...allDay('2026-12-01', '2026-12-02'), timeZone: SP })
    ).toEqual([])
    expect(db.scheduleBlock.findMany).not.toHaveBeenCalled()
  })
})

describe('listGeneralBlocks', () => {
  const sched = (id: string, name: string) => ({ id, name })
  const row = (groupId: string, schedule: { id: string; name: string }, start: string, end: string) => ({
    groupId,
    reason: 'x',
    ...allDay(start, end),
    schedule,
  })

  it('um item por grupo com 2+ agendas, mostra as que ficaram de fora e ignora grupo de 1', async () => {
    const db = {
      scheduleBlock: {
        findMany: vi.fn(async () => [
          row('g2', sched('s1', 'A'), '2026-12-10', '2026-12-11'),
          row('g1', sched('s1', 'A'), '2026-11-24', '2026-12-03'),
          row('g1', sched('s2', 'B '), '2026-11-24', '2026-12-03'),
          row('solo', sched('s3', 'C'), '2026-12-01', '2026-12-01'),
        ]),
      },
      schedule: { findMany: vi.fn(async () => [sched('s1', 'A'), sched('s2', 'B '), sched('s3', 'C')]) },
    }

    const groups = await listGeneralBlocks(db as never, {
      userId: 'u1',
      timeZone: SP,
      now: new Date('2026-12-01T12:00:00.000Z'),
    })

    expect(groups.map((g) => g.groupId)).toEqual(['g1'])
    expect(groups[0].schedules.map((s) => s.name)).toEqual(['A', 'B'])
    expect(groups[0].missingSchedules).toEqual([{ id: 's3', name: 'C' }])
    expect(groups[0].isPast).toBe(false)
  })
})

describe('listGeneralBlocks — bloqueios pessoais de profissional', () => {
  const linked = (id: string, name: string, pros: string[]) => ({
    id,
    name,
    professionals: pros.map((professionalId) => ({ professionalId })),
  })
  const row = (groupId: string, schedule: { id: string; name: string }, professionalId: string | null) => ({
    groupId,
    reason: null,
    ...allDay('2026-12-10', '2026-12-11'),
    professionalId,
    professional: professionalId ? { name: 'Ana ' } : null,
    schedule,
  })

  function dbWith(rows: unknown[]) {
    return {
      scheduleBlock: { findMany: vi.fn(async () => rows) },
      schedule: {
        findMany: vi.fn(async () => [
          linked('s1', 'A', ['ana']),
          linked('s2', 'B', ['ana']),
          linked('s3', 'C', ['beto']),
        ]),
      },
    }
  }
  const params = { userId: 'u1', timeZone: SP, now: new Date('2026-12-01T12:00:00.000Z') }

  it('bloqueio pessoal aparece mesmo com 1 agenda só, com o nome do profissional', async () => {
    const db = dbWith([row('p1', { id: 's1', name: 'A' }, 'ana')])

    const [group] = await listGeneralBlocks(db as never, { ...params, viewerProfessionalId: null })

    expect(group.professional).toEqual({ id: 'ana', name: 'Ana' })
    expect(group.canManage).toBe(true)
  })

  it('"não inclui" considera só as agendas em que o profissional está vinculado', async () => {
    const db = dbWith([row('p1', { id: 's1', name: 'A' }, 'ana')])

    const [group] = await listGeneralBlocks(db as never, { ...params, viewerProfessionalId: null })

    expect(group.missingSchedules).toEqual([{ id: 's2', name: 'B' }]) // s3 é do Beto: fora
  })

  it('profissional: consulta só a agenda inteira + os próprios, e não gerencia o da agenda inteira', async () => {
    const db = dbWith([
      row('wide', { id: 's1', name: 'A' }, null),
      row('wide', { id: 's2', name: 'B' }, null),
      row('mine', { id: 's1', name: 'A' }, 'ana'),
    ])

    const groups = await listGeneralBlocks(db as never, { ...params, viewerProfessionalId: 'ana' })

    expect(db.scheduleBlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: [{ professionalId: null }, { professionalId: 'ana' }] }),
      })
    )
    const wide = groups.find((g) => g.groupId === 'wide')!
    const mine = groups.find((g) => g.groupId === 'mine')!
    expect(wide.canManage).toBe(false)
    expect(wide.missingSchedules).toEqual([]) // sem ação para o que não é dele
    expect(mine.canManage).toBe(true)
  })
})

describe('addSchedulesToGroup', () => {
  const template = { startDate: new Date('2026-12-10T00:00:00Z'), endDate: new Date('2026-12-11T00:00:00Z'), reason: 'x', isAllDay: true }

  function dbWith(opts: { template: unknown; owned: string[]; already: string[] }) {
    return {
      scheduleBlock: {
        findFirst: vi.fn(async () => opts.template),
        findMany: vi.fn(async () => opts.already.map((scheduleId) => ({ scheduleId }))),
        createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
      },
      schedule: { findMany: vi.fn(async () => opts.owned.map((id) => ({ id }))) },
    }
  }

  it('grupo inexistente no tenant: null', async () => {
    const db = dbWith({ template: null, owned: [], already: [] })
    expect(await addSchedulesToGroup(db as never, { userId: 'u1', groupId: 'g', scheduleIds: ['s1'] })).toBeNull()
    expect(db.scheduleBlock.createMany).not.toHaveBeenCalled()
  })

  it('cria só nas agendas do tenant que ainda não estão no grupo, copiando período e motivo', async () => {
    const db = dbWith({ template, owned: ['s2', 's3'], already: ['s3'] })
    const created = await addSchedulesToGroup(db as never, { userId: 'u1', groupId: 'g', scheduleIds: ['s2', 's3', 'alheia'] })

    expect(created).toBe(1)
    expect(db.scheduleBlock.createMany).toHaveBeenCalledWith({
      data: [{ scheduleId: 's2', groupId: 'g', ...template }],
    })
  })
})
