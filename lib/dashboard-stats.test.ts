import { describe, it, expect } from 'vitest'
import { dashboardPeriods, ACTIVE_STATUSES } from './dashboard-stats'

const TZ = 'America/Sao_Paulo'

describe('dashboardPeriods', () => {
  it('semana vai de segunda a domingo, igual à vista Semana da Agenda', () => {
    // terça 2026-10-13 12:00 em SP
    const p = dashboardPeriods(TZ, new Date('2026-10-13T15:00:00Z'))
    expect(p.today).toBe('2026-10-13')
    expect(p.week.from).toBe('2026-10-12') // segunda
    expect(p.week.to).toBe('2026-10-18') // domingo
  })

  it('domingo ainda pertence à semana que termina nele', () => {
    const p = dashboardPeriods(TZ, new Date('2026-10-18T15:00:00Z'))
    expect(p.week.from).toBe('2026-10-12')
    expect(p.week.to).toBe('2026-10-18')
  })

  it('mês tem limite superior: do dia 1 ao último dia, sem vazar para o mês seguinte', () => {
    const p = dashboardPeriods(TZ, new Date('2026-10-13T15:00:00Z'))
    expect(p.month.from).toBe('2026-10-01')
    expect(p.month.to).toBe('2026-10-31')
    // 31/10 23:59:59.999 em SP = 01/11 02:59:59.999 UTC
    expect(p.month.lte.toISOString()).toBe('2026-11-01T02:59:59.999Z')
    expect(p.month.gte.toISOString()).toBe('2026-10-01T03:00:00.000Z')
  })

  it('usa o calendário do negócio: 23h30 de domingo em SP (UTC já é segunda) ainda é domingo', () => {
    // 2026-10-19 02:30 UTC = domingo 2026-10-18 23:30 em SP
    const p = dashboardPeriods(TZ, new Date('2026-10-19T02:30:00Z'))
    expect(p.today).toBe('2026-10-18')
    expect(p.week.to).toBe('2026-10-18')
  })

  it('virada de ano: semana e mês corretos', () => {
    const p = dashboardPeriods(TZ, new Date('2026-12-31T15:00:00Z'))
    expect(p.month.to).toBe('2026-12-31')
    expect(p.week.from).toBe('2026-12-28')
    expect(p.week.to).toBe('2027-01-03')
  })
})

describe('ACTIVE_STATUSES', () => {
  it('exclui cancelado e falta', () => {
    expect(ACTIVE_STATUSES).not.toContain('CANCELLED')
    expect(ACTIVE_STATUSES).not.toContain('NO_SHOW')
    expect([...ACTIVE_STATUSES].sort()).toEqual(['COMPLETED', 'CONFIRMED', 'IN_PROGRESS', 'SCHEDULED'])
  })
})
