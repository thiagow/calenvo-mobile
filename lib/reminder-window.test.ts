import { describe, it, expect } from 'vitest'
import { reminderWindow } from './reminder-window'

const at = (iso: string) => new Date(iso)

describe('reminderWindow', () => {
  it('lembrete de 2h: a rodada das 12:00 cobre 13:30 até 14:30 (fim exclusivo)', () => {
    const w = reminderWindow(at('2026-10-13T15:00:00Z'), 2) // 12:00 em São Paulo
    expect(w.start.toISOString()).toBe('2026-10-13T16:30:00.000Z')
    expect(w.end.toISOString()).toBe('2026-10-13T17:30:00.000Z')
  })

  it('a janela não depende do atraso da execução dentro da hora', () => {
    const exact = reminderWindow(at('2026-10-13T15:00:00.000Z'), 24)
    const late = reminderWindow(at('2026-10-13T15:00:08.350Z'), 24)
    const veryLate = reminderWindow(at('2026-10-13T15:59:59.999Z'), 24)
    expect(late).toEqual(exact)
    expect(veryLate).toEqual(exact)
  })

  it('rodadas seguidas se encaixam: o fim de uma é o início da próxima', () => {
    const a = reminderWindow(at('2026-10-13T15:00:00Z'), 2)
    const b = reminderWindow(at('2026-10-13T16:00:00Z'), 2)
    expect(a.end.getTime()).toBe(b.start.getTime())
  })

  it('cada agendamento cai em exatamente UMA rodada (sem duplicar, sem perder), mesmo com jitter', () => {
    const HOUR = 3_600_000
    const base = at('2026-10-13T00:00:00Z').getTime()
    const jitter = [0, 8_000, 21_000, 1_500, 59_000, 300]
    const runs = Array.from({ length: 48 }, (_, i) => new Date(base + i * HOUR + jitter[i % jitter.length]))

    // Cada minuto de dois dias de agendamentos, incluindo as bordas :30 e :00
    for (let minute = 3 * 60; minute < 40 * 60; minute++) {
      const appointment = base + minute * 60_000
      const hits = runs.filter(run => {
        const w = reminderWindow(run, 2)
        return appointment >= w.start.getTime() && appointment < w.end.getTime()
      })
      expect(hits, `agendamento em ${new Date(appointment).toISOString()}`).toHaveLength(1)
    }
  })

  it('agendamento às 14:30 (a borda do bug antigo) recebe o lembrete uma vez só', () => {
    const appointment = at('2026-10-13T17:30:00Z').getTime() // 14:30 em São Paulo
    const run12 = reminderWindow(at('2026-10-13T15:00:08Z'), 2)
    const run13 = reminderWindow(at('2026-10-13T16:00:03Z'), 2)
    const inRun12 = appointment >= run12.start.getTime() && appointment < run12.end.getTime()
    const inRun13 = appointment >= run13.start.getTime() && appointment < run13.end.getTime()
    expect(inRun12).toBe(false)
    expect(inRun13).toBe(true)
  })
})
