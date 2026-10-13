import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))

import {
  classifyReturn,
  leadDays,
  daysBetween,
  toReactivationItems,
  countByBucket,
  resolveTenantScope,
  type CandidateRow,
} from './reactivation-service'

const TZ = 'America/Sao_Paulo'
// 2026-10-12 15:00 UTC = 12:00 em São Paulo
const NOW = new Date('2026-10-12T15:00:00Z')

function row(overrides: Partial<CandidateRow>): CandidateRow {
  return {
    clientId: 'c1',
    clientName: 'Ana Souza',
    clientPhone: '5511999999999',
    serviceId: 's1',
    serviceName: 'Corte',
    returnIntervalDays: 30,
    reactivationTemplateId: null,
    lastDate: new Date('2026-09-01T15:00:00Z'),
    professionalId: null,
    professionalName: null,
    nextSameServiceAt: null,
    nextAnyAt: null,
    lastNotifiedAt: null,
    ...overrides,
  }
}

describe('daysBetween', () => {
  it('conta dias de calendário, inclusive virando o mês', () => {
    expect(daysBetween('2026-09-28', '2026-10-03')).toBe(5)
    expect(daysBetween('2026-10-03', '2026-09-28')).toBe(-5)
  })
})

describe('leadDays — janela de antecedência proporcional ao prazo', () => {
  it('prazo curto bate no piso de 3 dias (fisioterapia, 10 dias)', () => {
    expect(leadDays(10)).toBe(3)
  })
  it('prazo médio usa 20% (corte, 30 dias → 6)', () => {
    expect(leadDays(30)).toBe(6)
  })
  it('prazo longo bate no teto de 30 dias (dentista, 180 → 30)', () => {
    expect(leadDays(180)).toBe(30)
  })
})

describe('classifyReturn', () => {
  it('ainda longe do retorno → sem faixa', () => {
    expect(classifyReturn('2026-10-01', 30, '2026-10-12').bucket).toBeNull()
  })

  it('dentro da janela de antecedência → upcoming', () => {
    // previsto 2026-10-15, faltam 3 dias, janela de 6
    const r = classifyReturn('2026-09-15', 30, '2026-10-12')
    expect(r.bucket).toBe('upcoming')
    expect(r.daysUntilDue).toBe(3)
    expect(r.expectedDate).toBe('2026-10-15')
  })

  it('no próprio dia previsto ainda é upcoming (vence hoje)', () => {
    const r = classifyReturn('2026-09-12', 30, '2026-10-12')
    expect(r.bucket).toBe('upcoming')
    expect(r.daysUntilDue).toBe(0)
  })

  it('um dia depois do previsto → overdue', () => {
    const r = classifyReturn('2026-09-11', 30, '2026-10-12')
    expect(r.bucket).toBe('overdue')
    expect(r.daysOverdue).toBe(1)
    expect(r.daysSinceLast).toBe(31)
  })

  it('atraso exatamente 2× o prazo ainda é overdue; acima disso é lost', () => {
    // prazo 30 → lost quando atraso > 60
    expect(classifyReturn(addDaysBack('2026-10-12', 90), 30, '2026-10-12').bucket).toBe('overdue') // atraso 60
    expect(classifyReturn(addDaysBack('2026-10-12', 91), 30, '2026-10-12').bucket).toBe('lost') // atraso 61
  })

  it('limiar de perdido é relativo ao prazo (dentista 180 dias)', () => {
    // 300 dias atrás com prazo de 180 → atraso de 120, ainda overdue
    expect(classifyReturn(addDaysBack('2026-10-12', 300), 180, '2026-10-12').bucket).toBe('overdue')
    // 160 dias atrás → faltam 20, janela de 30 → upcoming
    expect(classifyReturn(addDaysBack('2026-10-12', 160), 180, '2026-10-12').bucket).toBe('upcoming')
  })
})

describe('toReactivationItems', () => {
  it('cliente com 2 serviços atrasados gera 2 itens independentes', () => {
    const items = toReactivationItems(
      [
        row({ serviceId: 's1', serviceName: 'Corte', returnIntervalDays: 30, lastDate: new Date('2026-08-20T15:00:00Z') }),
        row({ serviceId: 's2', serviceName: 'Coloração', returnIntervalDays: 45, lastDate: new Date('2026-08-01T15:00:00Z') }),
      ],
      TZ,
      NOW
    )
    expect(items).toHaveLength(2)
    expect(items.map(i => i.serviceId).sort()).toEqual(['s1', 's2'])
    expect(items.every(i => i.bucket === 'overdue')).toBe(true)
  })

  it('agendamento futuro do mesmo serviço remove só aquele serviço', () => {
    const items = toReactivationItems(
      [
        row({ serviceId: 's1', lastDate: new Date('2026-08-20T15:00:00Z'), nextSameServiceAt: new Date('2026-10-20T15:00:00Z'), nextAnyAt: new Date('2026-10-20T15:00:00Z') }),
        row({ serviceId: 's2', returnIntervalDays: 45, lastDate: new Date('2026-08-01T15:00:00Z'), nextAnyAt: new Date('2026-10-20T15:00:00Z') }),
      ],
      TZ,
      NOW
    )
    expect(items).toHaveLength(1)
    expect(items[0].serviceId).toBe('s2')
    expect(items[0].nextAppointmentDate).toBe('2026-10-20')
  })

  it('usa o calendário do tenant: 23:30 em SP ainda é o mesmo dia (UTC já virou)', () => {
    // 2026-09-12 02:30 UTC = 2026-09-11 23:30 em SP
    const [item] = toReactivationItems([row({ lastDate: new Date('2026-09-12T02:30:00Z') })], TZ, NOW)
    expect(item.lastDate).toBe('2026-09-11')
    expect(item.bucket).toBe('overdue')
  })

  it('marca recentlyNotified dentro da janela de 7 dias', () => {
    const [recent] = toReactivationItems([row({ lastNotifiedAt: new Date('2026-10-08T15:00:00Z') })], TZ, NOW)
    const [old] = toReactivationItems([row({ lastNotifiedAt: new Date('2026-10-01T15:00:00Z') })], TZ, NOW)
    expect(recent.recentlyNotified).toBe(true)
    expect(old.recentlyNotified).toBe(false)
  })

  it('ordena do mais urgente para o menos urgente e conta por faixa', () => {
    const items = toReactivationItems(
      [
        row({ clientId: 'a', lastDate: new Date('2026-09-15T15:00:00Z') }), // upcoming
        row({ clientId: 'b', lastDate: new Date('2026-06-01T15:00:00Z') }), // lost
        row({ clientId: 'c', lastDate: new Date('2026-09-01T15:00:00Z') }), // overdue
      ],
      TZ,
      NOW
    )
    expect(items.map(i => i.clientId)).toEqual(['b', 'c', 'a'])
    expect(countByBucket(items)).toEqual({ upcoming: 1, overdue: 1, lost: 1 })
  })
})

describe('resolveTenantScope', () => {
  it('MASTER é o próprio tenant, sem filtro de profissional', () => {
    expect(resolveTenantScope({ id: 'm1', role: 'MASTER' })).toEqual({ tenantId: 'm1', isMaster: true, professionalId: null })
  })
  it('PROFESSIONAL lê do master e filtra pelos próprios atendimentos', () => {
    expect(resolveTenantScope({ id: 'p1', role: 'PROFESSIONAL', masterId: 'm1' })).toEqual({ tenantId: 'm1', isMaster: false, professionalId: 'p1' })
  })
  it('PROFESSIONAL sem master ou outro papel → sem acesso', () => {
    expect(resolveTenantScope({ id: 'p1', role: 'PROFESSIONAL' })).toBeNull()
    expect(resolveTenantScope({ id: 'x', role: 'SAAS_ADMIN' })).toBeNull()
  })
})

function addDaysBack(today: string, days: number): string {
  const [y, m, d] = today.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10)
}
