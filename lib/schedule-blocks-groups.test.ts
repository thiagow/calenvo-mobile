import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))

import {
  addSchedulesToGroup,
  blocksOverlap,
  findOverlappingBlocks,
  countActiveBlocksBySchedule,
  isBlockPast,
  listBlocks,
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

describe('listBlocks', () => {
  const sched = (id: string, name: string) => ({ id, name })
  const row = (
    id: string,
    groupId: string | null,
    schedule: { id: string; name: string },
    start: string,
    end: string
  ) => ({
    id,
    groupId,
    reason: 'x',
    ...allDay(start, end),
    schedule,
  })

  it('um item por grupo, mostra as agendas que ficaram de fora e inclui o bloqueio de uma agenda só', async () => {
    const db = {
      scheduleBlock: {
        findMany: vi.fn(async () => [
          row('b4', 'g2', sched('s1', 'A'), '2026-12-10', '2026-12-11'),
          row('b1', 'g1', sched('s1', 'A'), '2026-11-24', '2026-12-03'),
          row('b2', 'g1', sched('s2', 'B '), '2026-11-24', '2026-12-03'),
          row('b3', null, sched('s3', 'C'), '2026-12-01', '2026-12-01'),
        ]),
      },
      schedule: { findMany: vi.fn(async () => [sched('s1', 'A'), sched('s2', 'B '), sched('s3', 'C')]) },
    }

    const items = await listBlocks(db as never, {
      userId: 'u1',
      timeZone: SP,
      now: new Date('2026-12-01T12:00:00.000Z'),
    })

    expect(items.map((g) => g.key)).toEqual(['g1', 'b3', 'g2'])
    const g1 = items.find((g) => g.key === 'g1')!
    expect(g1.schedules.map((s) => s.name)).toEqual(['A', 'B'])
    expect(g1.missingSchedules).toEqual([{ id: 's3', name: 'C' }])
    expect(g1.isPast).toBe(false)
    expect(g1.affectedAppointments).toBeNull()

    // Sem grupo: remove-se pelo bloco, e não há "aplicar também".
    const solo = items.find((g) => g.key === 'b3')!
    expect(solo).toMatchObject({ groupId: null, blockId: 'b3', missingSchedules: [] })
  })

  it('conta os agendamentos afetados só dos bloqueios vigentes', async () => {
    const db = {
      scheduleBlock: {
        findMany: vi.fn(async () => [
          row('b1', null, sched('s1', 'A'), '2026-11-01', '2026-11-02'), // já encerrado
          row('b2', null, sched('s1', 'A'), '2026-12-10', '2026-12-11'),
        ]),
      },
      schedule: { findMany: vi.fn(async () => [sched('s1', 'A')]) },
      appointment: {
        findMany: vi.fn(async () => [
          { id: 'a1', date: new Date('2026-12-10T13:00:00Z'), duration: 30, client: { name: 'Ana' }, service: { name: 'Corte' }, specialty: null },
          { id: 'a2', date: new Date('2026-12-11T13:00:00Z'), duration: 30, client: { name: 'Bia' }, service: { name: 'Corte' }, specialty: null },
        ]),
      },
    }

    const items = await listBlocks(db as never, {
      userId: 'u1',
      timeZone: SP,
      countAppointments: true,
      now: new Date('2026-12-01T12:00:00.000Z'),
    })

    expect(db.appointment.findMany).toHaveBeenCalledTimes(1)
    expect(items.find((g) => g.key === 'b1')!.affectedAppointments).toBeNull()
    expect(items.find((g) => g.key === 'b2')!.affectedAppointments).toBe(2)
  })
})

describe('listBlocks — bloqueios pessoais de profissional', () => {
  const linked = (id: string, name: string, pros: string[]) => ({
    id,
    name,
    professionals: pros.map((professionalId) => ({ professionalId })),
  })
  const row = (groupId: string, schedule: { id: string; name: string }, professionalId: string | null) => ({
    id: `${groupId}-${schedule.id}`,
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

    const [group] = await listBlocks(db as never, { ...params, viewerProfessionalId: null })

    expect(group.professional).toEqual({ id: 'ana', name: 'Ana' })
    expect(group.canManage).toBe(true)
  })

  it('"não inclui" considera só as agendas em que o profissional está vinculado', async () => {
    const db = dbWith([row('p1', { id: 's1', name: 'A' }, 'ana')])

    const [group] = await listBlocks(db as never, { ...params, viewerProfessionalId: null })

    expect(group.missingSchedules).toEqual([{ id: 's2', name: 'B' }]) // s3 é do Beto: fora
  })

  it('profissional: consulta só a agenda inteira + os próprios, e não gerencia o da agenda inteira', async () => {
    const db = dbWith([
      row('wide', { id: 's1', name: 'A' }, null),
      row('wide', { id: 's2', name: 'B' }, null),
      row('mine', { id: 's1', name: 'A' }, 'ana'),
    ])

    const groups = await listBlocks(db as never, { ...params, viewerProfessionalId: 'ana' })

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

describe('countActiveBlocksBySchedule', () => {
  const now = new Date('2026-12-04T15:00:00.000Z')
  const block = (scheduleId: string, start: string, end: string) => ({ scheduleId, ...allDay(start, end) })

  it('conta por agenda só os bloqueios ainda vigentes', async () => {
    const db = {
      scheduleBlock: {
        findMany: vi.fn(async () => [
          block('s1', '2026-12-01', '2026-12-03'), // encerrado
          block('s1', '2026-12-04', '2026-12-04'), // vigente (hoje)
          block('s1', '2026-12-20', '2026-12-22'),
          block('s2', '2026-12-10', '2026-12-10'),
        ]),
      },
    }

    expect(await countActiveBlocksBySchedule(db as never, { scheduleIds: ['s1', 's2', 's3'], timeZone: SP, now })).toEqual({
      s1: 2,
      s2: 1,
    })
  })

  it('profissional: só agenda inteira + os próprios', async () => {
    const db = { scheduleBlock: { findMany: vi.fn(async () => []) } }
    await countActiveBlocksBySchedule(db as never, { scheduleIds: ['s1'], timeZone: SP, viewerProfessionalId: 'ana', now })
    expect(db.scheduleBlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: [{ professionalId: null }, { professionalId: 'ana' }] }) })
    )
  })

  it('sem agendas não consulta o banco', async () => {
    const db = { scheduleBlock: { findMany: vi.fn() } }
    expect(await countActiveBlocksBySchedule(db as never, { scheduleIds: [], timeZone: SP })).toEqual({})
    expect(db.scheduleBlock.findMany).not.toHaveBeenCalled()
  })
})
