import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Fase 1 do Módulo Financeiro: guard das rotas (direito de uso → chave → papel),
 * ativação com valores padrão, proteção das categorias de sistema e liberação
 * pelo SaaS Admin.
 */

let mockUser: { id: string; role: string; masterId?: string } = { id: 'master-1', role: 'MASTER' }

const { db, state } = vi.hoisted(() => {
  const state = {
    entitlement: null as null | { status: string; expiresAt: Date | null; source?: string; id?: string },
    config: null as null | Record<string, unknown>
  }
  const db: Record<string, any> = {
    tenantFeature: {
      findUnique: vi.fn(async () => state.entitlement),
      upsert: vi.fn(async (args: any) => ({ feature: 'FINANCE', status: 'ACTIVE', source: args.create.source })),
      update: vi.fn(async () => ({ feature: 'FINANCE', status: 'CANCELED', source: 'GRANT' }))
    },
    financeConfig: {
      findUnique: vi.fn(async () => state.config),
      upsert: vi.fn(async (args: any) => ({
        isActive: false,
        activatedAt: null,
        commissionBase: 'AFTER_DISCOUNT',
        requireOpenCashSession: true,
        settleOnlyPaidCommissions: true,
        ...args.create
      }))
    },
    user: { findUnique: vi.fn(async () => ({ locale: 'pt', currency: 'BRL', role: 'MASTER', email: 'a@b.c', name: 'Ana' })) },
    paymentMethod: {
      count: vi.fn(async () => 0),
      createMany: vi.fn(async () => ({ count: 4 })),
      findMany: vi.fn(async () => [])
    },
    financeCategory: {
      count: vi.fn(async () => 0),
      createMany: vi.fn(async () => ({ count: 11 })),
      findFirst: vi.fn(async () => ({ isSystem: true })),
      update: vi.fn()
    },
    adminAuditLog: { create: vi.fn() }
  }
  db.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(db))
  return { db, state }
})

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: mockUser })) }))
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }))
vi.mock('@/lib/db', () => ({ prisma: db }))
vi.mock('@/lib/error-logger', () => ({ logError: vi.fn() }))

import * as configRoute from './config/route'
import * as paymentMethodsRoute from './payment-methods/route'
import * as categoryRoute from './categories/[id]/route'
import * as featuresRoute from '../features/route'
import * as adminFeaturesRoute from '../saas-admin/tenants/[id]/features/route'

const json = (body: unknown, method = 'PUT') =>
  new NextRequest('http://localhost/x', { method, body: JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = { id: 'master-1', role: 'MASTER' }
  state.entitlement = { status: 'ACTIVE', expiresAt: null }
  state.config = { isActive: true, activatedAt: new Date(), commissionBase: 'AFTER_DISCOUNT', requireOpenCashSession: true, settleOnlyPaidCommissions: true }
})

describe('guard do Módulo Financeiro', () => {
  it('sem direito de uso → 404 (o módulo não existe para o tenant)', async () => {
    state.entitlement = null
    const res = await paymentMethodsRoute.GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(404)
  })

  it('direito de uso expirado → 404', async () => {
    state.entitlement = { status: 'ACTIVE', expiresAt: new Date('2000-01-01') }
    const res = await paymentMethodsRoute.GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(404)
  })

  it('módulo desligado → 403 nas rotas operacionais', async () => {
    state.config = { ...state.config, isActive: false }
    const res = await paymentMethodsRoute.GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(403)
  })

  it('PROFESSIONAL não altera configuração (403) mas lista formas de pagamento', async () => {
    mockUser = { id: 'pro-1', role: 'PROFESSIONAL', masterId: 'master-1' }
    expect((await configRoute.PUT(json({ isActive: false }))).status).toBe(403)

    const res = await paymentMethodsRoute.GET(new NextRequest('http://localhost/x?all=1'))
    expect(res.status).toBe(200)
    // `all=1` é ignorado para PROFESSIONAL: só formas ativas, do tenant do master
    expect(db.paymentMethod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'master-1', isActive: true } })
    )
  })
})

describe('configuração e ativação', () => {
  it('GET funciona com o módulo desligado (tela de ativação)', async () => {
    state.config = null
    const res = await configRoute.GET()
    expect(res.status).toBe(200)
    expect((await res.json()).config.isActive).toBe(false)
  })

  it('primeira ativação cria valores padrão e grava activatedAt', async () => {
    state.config = null
    const res = await configRoute.PUT(json({ isActive: true }))
    expect(res.status).toBe(200)
    expect(db.paymentMethod.createMany).toHaveBeenCalledTimes(1)
    expect(db.financeCategory.createMany).toHaveBeenCalledTimes(1)
    const upsertArgs = db.financeConfig.upsert.mock.calls[0][0]
    expect(upsertArgs.create.activatedAt).toBeInstanceOf(Date)
  })

  it('ajustar regra com o módulo já ligado não semeia nada', async () => {
    const res = await configRoute.PUT(json({ commissionBase: 'AFTER_FEES' }))
    expect(res.status).toBe(200)
    expect(db.paymentMethod.createMany).not.toHaveBeenCalled()
  })

  it('corpo inválido → 400', async () => {
    expect((await configRoute.PUT(json({ isActive: 'sim' }))).status).toBe(400)
    expect((await configRoute.PUT(json({}))).status).toBe(400)
    expect((await configRoute.PUT(json({ hack: true }))).status).toBe(400)
  })
})

describe('categorias de sistema', () => {
  it('não podem ser alteradas (409)', async () => {
    const res = await categoryRoute.PATCH(json({ isActive: false }, 'PATCH'), { params: { id: 'cat-1' } })
    expect(res.status).toBe(409)
    expect(db.financeCategory.update).not.toHaveBeenCalled()
  })
})

describe('GET /api/features', () => {
  it('informa disponibilidade para a sessão, inclusive PROFESSIONAL', async () => {
    mockUser = { id: 'pro-1', role: 'PROFESSIONAL', masterId: 'master-1' }
    const res = await featuresRoute.GET()
    expect((await res.json()).finance).toMatchObject({ entitled: true, active: true, isMaster: false, canOperateCash: false })
  })
})

describe('liberação pelo SaaS Admin', () => {
  it('só SAAS_ADMIN (403 para MASTER)', async () => {
    const res = await adminFeaturesRoute.PUT(json({ feature: 'FINANCE', enabled: true }), { params: { id: 'master-1' } })
    expect(res.status).toBe(403)
  })

  it('liberar cria o direito de uso como GRANT e registra auditoria', async () => {
    mockUser = { id: 'admin-1', role: 'SAAS_ADMIN' }
    state.entitlement = null
    const res = await adminFeaturesRoute.PUT(json({ feature: 'FINANCE', enabled: true, reason: 'piloto' }), {
      params: { id: 'master-1' }
    })
    expect(res.status).toBe(200)
    expect(db.tenantFeature.upsert.mock.calls[0][0].create).toMatchObject({ source: 'GRANT', status: 'ACTIVE' })
    expect(db.adminAuditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'TENANT_FEATURE_GRANTED',
      adminId: 'admin-1',
      targetId: 'master-1'
    })
  })

  it('revogar só cancela (não apaga dados)', async () => {
    mockUser = { id: 'admin-1', role: 'SAAS_ADMIN' }
    state.entitlement = { id: 'tf-1', status: 'ACTIVE', expiresAt: null, source: 'GRANT' }
    const res = await adminFeaturesRoute.PUT(json({ feature: 'FINANCE', enabled: false }), { params: { id: 'master-1' } })
    expect(res.status).toBe(200)
    expect(db.tenantFeature.update).toHaveBeenCalledWith({ where: { id: 'tf-1' }, data: { status: 'CANCELED' } })
  })
})
