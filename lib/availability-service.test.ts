import { describe, it, expect, vi } from 'vitest'

// Regressão: getAvailableSlots buscava a Schedule só pelo id, sem confirmar que
// pertence ao tenant (userId) do chamador — mesma classe de vazamento cross-tenant
// já corrigida em app/api/booking/[slug]/create/route.ts. Um scheduleId de outro
// tenant, adivinhado ou vazado, não pode mais retornar disponibilidade real.
const findFirstMock = vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
  if (where.id === 'schedule-1' && where.userId === 'tenant-a') {
    return {
      id: 'schedule-1',
      workingDays: [0, 1, 2, 3, 4, 5, 6],
      startTime: '08:00',
      endTime: '18:00',
      slotDuration: 30,
      bufferTime: 0,
      lunchStart: null,
      lunchEnd: null,
      useCustomDayConfig: false,
      dayConfigs: [],
      blocks: [],
      services: [{ service: { id: 'service-1', duration: 30 } }],
    }
  }
  return null
})

vi.mock('@/lib/db', () => ({
  prisma: {
    schedule: { findFirst: findFirstMock },
    appointment: { findMany: vi.fn(async () => []) },
  },
}))

describe('parseCalendarDate', () => {
  it('não desloca o dia da semana por causa de fuso horário (bug reproduzido em produção)', async () => {
    const { parseCalendarDate } = await import('@/lib/availability-service')

    // 21/07/2026 é uma terça-feira (dia 2). new Date("2026-07-21") sozinho
    // parseia como meia-noite UTC; num processo rodando fora de UTC (ex.:
    // GMT-3), combinar isso com .getDay() (método local) resolve para
    // segunda-feira — foi exatamente o que fez a IA achar a agenda fechada
    // num dia em que ela estava aberta.
    expect(parseCalendarDate('2026-07-21').getDay()).toBe(2)
  })
})

describe('getAvailableSlots', () => {
  it('busca a agenda escopada por id E userId', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')

    await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date: '2026-07-20', userId: 'tenant-a' })

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'schedule-1', userId: 'tenant-a' } })
    )
  })

  it('retorna null quando a agenda pertence a outro tenant', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')

    const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date: '2026-07-20', userId: 'tenant-b' })

    expect(result).toBeNull()
  })

  it('retorna slots quando a agenda pertence ao tenant correto', async () => {
    const { getAvailableSlots } = await import('@/lib/availability-service')

    const result = await getAvailableSlots({ scheduleId: 'schedule-1', serviceId: 'service-1', date: '2026-07-20', userId: 'tenant-a' })

    expect(result).not.toBeNull()
    expect(result!.length).toBeGreaterThan(0)
  })
})
