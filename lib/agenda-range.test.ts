import { describe, it, expect } from 'vitest'
import { resolveAppointmentRange } from '@/lib/agenda-range'

const SP = 'America/Sao_Paulo'
const NOW = new Date('2026-10-14T15:00:00Z') // quarta, 12:00 em São Paulo
const iso = (d?: Date) => d?.toISOString()

describe('resolveAppointmentRange', () => {
  it('dia: 00:00 a 23:59:59.999 do dia do negócio (UTC-3)', () => {
    const r = resolveAppointmentRange({ view: 'day', currentDate: '2026-10-22', timeZone: SP })
    expect(iso(r.gte)).toBe('2026-10-22T03:00:00.000Z')
    expect(iso(r.lte)).toBe('2026-10-23T02:59:59.999Z')
  })

  it('agendamento das 22:30 em SP cai dentro da janela do dia (e não do seguinte)', () => {
    const r = resolveAppointmentRange({ view: 'day', currentDate: '2026-10-22', timeZone: SP })
    const at = new Date('2026-10-23T01:30:00Z') // 22:30 de 22/10 em SP
    expect(at >= r.gte! && at <= r.lte!).toBe(true)
  })

  it('semana vai de segunda a domingo (domingo pertence à semana anterior)', () => {
    const wed = resolveAppointmentRange({ view: 'week', currentDate: '2026-10-14', timeZone: SP })
    expect(iso(wed.gte)).toBe('2026-10-12T03:00:00.000Z')
    expect(iso(wed.lte)).toBe('2026-10-19T02:59:59.999Z')
    const sun = resolveAppointmentRange({ view: 'week', currentDate: '2026-10-18', timeZone: SP })
    expect(iso(sun.gte)).toBe('2026-10-12T03:00:00.000Z')
  })

  it('mês: do dia 1 ao último dia (inclusive meses de 28 e 31 dias)', () => {
    const oct = resolveAppointmentRange({ view: 'month', currentDate: '2026-10-14', timeZone: SP })
    expect(iso(oct.gte)).toBe('2026-10-01T03:00:00.000Z')
    expect(iso(oct.lte)).toBe('2026-11-01T02:59:59.999Z')
    const feb = resolveAppointmentRange({ view: 'month', currentDate: '2027-02-10', timeZone: SP })
    expect(iso(feb.lte)).toBe('2027-03-01T02:59:59.999Z')
  })

  it('período dentro da vista restringe a vista (interseção)', () => {
    const r = resolveAppointmentRange({
      view: 'month', currentDate: '2026-10-14', dateFrom: '2026-10-10', dateTo: '2026-10-20', timeZone: SP,
    })
    expect(iso(r.gte)).toBe('2026-10-10T03:00:00.000Z')
    expect(iso(r.lte)).toBe('2026-10-21T02:59:59.999Z')
  })

  it('período maior que a vista não a amplia', () => {
    const r = resolveAppointmentRange({
      view: 'day', currentDate: '2026-10-14', dateFrom: '2026-10-01', dateTo: '2026-10-31', timeZone: SP,
    })
    expect(iso(r.gte)).toBe('2026-10-14T03:00:00.000Z')
    expect(iso(r.lte)).toBe('2026-10-15T02:59:59.999Z')
  })

  it('período fora da vista: nada a buscar', () => {
    const r = resolveAppointmentRange({
      view: 'day', currentDate: '2026-10-14', dateFrom: '2026-11-01', dateTo: '2026-11-05', timeZone: SP,
    })
    expect(r).toEqual({ empty: true })
  })

  it('lista com período: só o período, sem janela de vista (o bug original)', () => {
    const r = resolveAppointmentRange({
      view: 'list', currentDate: '2026-10-14', dateFrom: '2026-11-24', dateTo: '2026-11-26', timeZone: SP, now: NOW,
    })
    expect(iso(r.gte)).toBe('2026-11-24T03:00:00.000Z')
    expect(iso(r.lte)).toBe('2026-11-27T02:59:59.999Z')
  })

  it('só dateFrom ou só dateTo deixam o outro lado aberto', () => {
    const from = resolveAppointmentRange({ view: 'timeline', dateFrom: '2026-11-24', timeZone: SP, now: NOW })
    expect(from.gte).toBeDefined()
    expect(from.lte).toBeUndefined()
    const to = resolveAppointmentRange({ view: 'list', dateTo: '2026-11-24', timeZone: SP, now: NOW })
    expect(iso(to.gte)).toBe('2026-10-14T03:00:00.000Z') // piso: hoje
    expect(iso(to.lte)).toBe('2026-11-25T02:59:59.999Z')
  })

  it('lista/timeline sem período: de hoje em diante', () => {
    for (const view of ['list', 'timeline']) {
      const r = resolveAppointmentRange({ view, timeZone: SP, now: NOW })
      expect(iso(r.gte)).toBe('2026-10-14T03:00:00.000Z')
      expect(r.lte).toBeUndefined()
    }
  })

  it('lista/timeline nunca mostram o passado: período que começa antes de hoje é cortado em hoje', () => {
    const r = resolveAppointmentRange({
      view: 'list', dateFrom: '2026-10-01', dateTo: '2026-10-20', timeZone: SP, now: NOW,
    })
    expect(iso(r.gte)).toBe('2026-10-14T03:00:00.000Z')
    expect(iso(r.lte)).toBe('2026-10-21T02:59:59.999Z')
  })

  it('lista/timeline: período inteiro no passado não retorna nada', () => {
    const r = resolveAppointmentRange({
      view: 'timeline', dateFrom: '2026-10-01', dateTo: '2026-10-10', timeZone: SP, now: NOW,
    })
    expect(r).toEqual({ empty: true })
  })

  it('aceita currentDate como instante ISO (clientes antigos) usando o fuso do negócio', () => {
    const r = resolveAppointmentRange({ view: 'day', currentDate: '2026-10-23T01:30:00.000Z', timeZone: SP })
    expect(iso(r.gte)).toBe('2026-10-22T03:00:00.000Z') // 22:30 de 22/10 em SP
  })

  it('ignora datas inválidas', () => {
    const r = resolveAppointmentRange({ view: 'day', dateFrom: 'lixo', dateTo: '31/12/2026', timeZone: SP })
    expect(r).toEqual({})
  })
})
