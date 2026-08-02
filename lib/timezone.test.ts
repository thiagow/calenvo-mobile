import { describe, it, expect } from 'vitest'
import { tenantDayWindow } from '@/lib/timezone'

const SP = 'America/Sao_Paulo' // UTC-3, sem horário de verão desde 2019

describe('tenantDayWindow', () => {
  it('janela de hoje (daysAhead=0) em America/Sao_Paulo', () => {
    // 2026-01-15T15:00:00Z = 2026-01-15 12:00 local (SP = UTC-3)
    const now = new Date('2026-01-15T15:00:00.000Z')
    const { start, end } = tenantDayWindow(SP, 0, now)

    expect(start.toISOString()).toBe('2026-01-15T03:00:00.000Z') // 00:00:00 local
    expect(end.toISOString()).toBe('2026-01-16T02:59:59.999Z') // 23:59:59.999 local
  })

  it('janela de amanhã (daysAhead=1)', () => {
    const now = new Date('2026-01-15T15:00:00.000Z')
    const { start, end } = tenantDayWindow(SP, 1, now)

    expect(start.toISOString()).toBe('2026-01-16T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-01-17T02:59:59.999Z')
  })

  it('usa o dia LOCAL do tenant, não o dia UTC, perto da virada de meia-noite UTC', () => {
    // 2026-01-15T02:00:00Z = 2026-01-14 23:00 local — ainda dia 14 em SP
    const now = new Date('2026-01-15T02:00:00.000Z')
    const { start, end } = tenantDayWindow(SP, 0, now)

    expect(start.toISOString()).toBe('2026-01-14T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-01-15T02:59:59.999Z')
  })

  it('janela dura exatamente 24h menos 1ms', () => {
    const now = new Date('2026-06-01T12:00:00.000Z')
    const { start, end } = tenantDayWindow(SP, 0, now)

    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1)
  })
})
