import { describe, it, expect } from 'vitest'
import { parseSlotSettings } from '@/lib/slot-settings'

describe('parseSlotSettings', () => {
  it('aceita os intervalos permitidos e o booleano', () => {
    for (const startInterval of [0, 15, 30, 60]) {
      expect(parseSlotSettings({ startInterval, smartScheduling: false })).toEqual({
        ok: true,
        startInterval,
        smartScheduling: false,
      })
    }
  })

  it('campos ausentes passam sem alteração', () => {
    expect(parseSlotSettings({})).toEqual({ ok: true })
  })

  it.each([-15, 10, 45, 90, 30.5, NaN, '30', null])('rejeita startInterval = %s', (value) => {
    expect(parseSlotSettings({ startInterval: value }).ok).toBe(false)
  })

  it.each(['true', 1, 0, null])('rejeita smartScheduling = %s', (value) => {
    expect(parseSlotSettings({ smartScheduling: value }).ok).toBe(false)
  })
})
