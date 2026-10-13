import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let sessionUser: any
const countCalls: any[] = []

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (sessionUser ? { user: sessionUser } : null)) }))
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn(async () => ({ masterId: 'master-1' })) },
    businessConfig: { findUnique: vi.fn(async () => ({ timezone: 'America/Sao_Paulo' })) },
    appointment: {
      count: vi.fn(async (args: any) => {
        countCalls.push(args.where)
        return 7
      }),
      findMany: vi.fn(async () => []),
    },
  },
}))

beforeEach(() => {
  vi.useFakeTimers()
  // terça 2026-10-13 12:00 em São Paulo
  vi.setSystemTime(new Date('2026-10-13T15:00:00Z'))
  countCalls.length = 0
  sessionUser = { id: 'master-1', role: 'MASTER' }
})

afterEach(() => {
  vi.useRealTimers()
})

async function call() {
  const { GET } = await import('./route')
  return GET({} as any)
}

describe('GET /api/dashboard/stats', () => {
  it('sem sessão → 401', async () => {
    sessionUser = null
    expect((await call()).status).toBe(401)
  })

  it('janela da semana (seg–dom) e do mês, no fuso do negócio', async () => {
    const body = await (await call()).json()

    expect(body.periods.week).toEqual({ from: '2026-10-12', to: '2026-10-18' })
    expect(body.periods.month).toEqual({ from: '2026-10-01', to: '2026-10-31' })

    const [week, month] = countCalls
    expect(week.date.gte.toISOString()).toBe('2026-10-12T03:00:00.000Z')
    expect(week.date.lte.toISOString()).toBe('2026-10-19T02:59:59.999Z')
    expect(month.date.gte.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(month.date.lte.toISOString()).toBe('2026-11-01T02:59:59.999Z') // limite superior existe
  })

  it('semana e mês excluem cancelados/faltas; pendentes = SCHEDULED; confirmados = CONFIRMED', async () => {
    await call()
    const [week, month, pending, confirmed] = countCalls
    const active = { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] }
    expect(week.status).toEqual(active)
    expect(month.status).toEqual(active)
    expect(pending.status).toBe('SCHEDULED')
    expect(confirmed.status).toBe('CONFIRMED')
    // pendentes e confirmados usam a MESMA janela da semana: o número do card é o que a Agenda mostra
    expect(pending.date).toEqual(week.date)
    expect(confirmed.date).toEqual(week.date)
    expect(countCalls.every(w => w.deletedAt === null)).toBe(true)
  })

  it('MASTER: contagem do tenant inteiro (sem filtro de profissional)', async () => {
    await call()
    const [week] = countCalls
    expect(week.userId).toBe('master-1')
    expect(week).not.toHaveProperty('professionalId')
  })

  it('PROFISSIONAL: cards pessoais (mesmo escopo da Agenda dele); uso do plano continua global', async () => {
    sessionUser = { id: 'pro-1', role: 'PROFESSIONAL' }
    await call()
    const [week, month, pending, confirmed, plan] = countCalls
    for (const where of [week, month, pending, confirmed]) {
      expect(where.userId).toBe('master-1')
      expect(where.professionalId).toBe('pro-1')
    }
    expect(plan.userId).toBe('master-1')
    expect(plan).not.toHaveProperty('professionalId')
  })

  it('não expõe mais os campos antigos que confundiam (hoje/clientes)', async () => {
    const { stats } = await (await call()).json()
    expect(Object.keys(stats).sort()).toEqual([
      'confirmedWeek',
      'monthAppointments',
      'pendingWeek',
      'planMonthAppointments',
      'weekAppointments',
    ])
  })
})
