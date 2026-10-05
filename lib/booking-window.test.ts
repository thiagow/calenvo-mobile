import { describe, it, expect } from 'vitest'
import { parseBookingWindow } from '@/lib/booking-window'

describe('parseBookingWindow', () => {
  it('aceita valores válidos', () => {
    expect(parseBookingWindow({ advanceBookingDays: 90, minNoticeHours: 2 })).toEqual({
      ok: true,
      advanceBookingDays: 90,
      minNoticeHours: 2,
    })
  })

  it('campos ausentes passam sem alteração', () => {
    expect(parseBookingWindow({})).toEqual({ ok: true })
  })

  it('aceita os limites (1 e 365 dias, 0 horas)', () => {
    expect(parseBookingWindow({ advanceBookingDays: 1, minNoticeHours: 0 }).ok).toBe(true)
    expect(parseBookingWindow({ advanceBookingDays: 365 }).ok).toBe(true)
  })

  it.each([0, -1, 366, 1.5, NaN, '90', null])('rejeita advanceBookingDays = %s', (value) => {
    expect(parseBookingWindow({ advanceBookingDays: value }).ok).toBe(false)
  })

  it.each([-1, 1.5, NaN, '2', null, 24 * 30 + 1])('rejeita minNoticeHours = %s', (value) => {
    expect(parseBookingWindow({ minNoticeHours: value }).ok).toBe(false)
  })
})
