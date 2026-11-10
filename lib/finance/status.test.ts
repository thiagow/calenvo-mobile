import { describe, it, expect } from 'vitest'
import type { FinanceConfig } from '@prisma/client'
import { isEntitlementActive } from '@/lib/features'
import { resolveFinanceStatus } from './status'

const now = new Date('2026-11-10T12:00:00Z')
const config = (isActive: boolean) => ({ isActive }) as FinanceConfig

describe('isEntitlementActive', () => {
  it('sem registro ou cancelado → sem direito', () => {
    expect(isEntitlementActive(null, now)).toBe(false)
    expect(isEntitlementActive({ status: 'CANCELED', expiresAt: null }, now)).toBe(false)
  })

  it('ativo sem expiração → com direito', () => {
    expect(isEntitlementActive({ status: 'ACTIVE', expiresAt: null }, now)).toBe(true)
  })

  it('respeita a expiração', () => {
    expect(isEntitlementActive({ status: 'ACTIVE', expiresAt: new Date('2026-11-11T00:00:00Z') }, now)).toBe(true)
    expect(isEntitlementActive({ status: 'ACTIVE', expiresAt: new Date('2026-11-10T11:59:59Z') }, now)).toBe(false)
  })
})

describe('resolveFinanceStatus', () => {
  const entitled = { status: 'ACTIVE' as const, expiresAt: null }

  it('módulo só age com direito de uso E chave ligada', () => {
    expect(resolveFinanceStatus(entitled, config(true), now)).toMatchObject({ entitled: true, active: true })
    expect(resolveFinanceStatus(entitled, config(false), now)).toMatchObject({ entitled: true, active: false })
    expect(resolveFinanceStatus(entitled, null, now)).toMatchObject({ entitled: true, active: false })
  })

  it('perder o direito de uso desliga o módulo mesmo com a chave ligada', () => {
    expect(resolveFinanceStatus(null, config(true), now)).toMatchObject({ entitled: false, active: false })
    expect(resolveFinanceStatus({ status: 'CANCELED', expiresAt: null }, config(true), now)).toMatchObject({
      active: false
    })
  })
})
