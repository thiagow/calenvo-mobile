import { describe, it, expect, vi } from 'vitest'

// Regressão dos bugs relatados em produção:
// 1/2) A IA resolvia datas (inclusive espontaneamente) para 2023 por falta de uma
//    data "de hoje" real no system prompt.
// 3) Uma exceção qualquer dentro de create_appointment derrubava o turno inteiro
//    de chat com um erro genérico, sem detalhe nenhum de causa.
// 4) O tool input deixou de expor scheduleId pro modelo — o cliente não escolhe
//    agenda, só serviço e profissional; quem resolve a agenda é o servidor
//    (resolveBookingTarget), igual ao booking público.

const findFirstServiceMock = vi.fn(async () => ({ id: 'service-1', duration: 30, price: 100 }))
const findFirstClientMock = vi.fn(async () => null)
const createClientMock = vi.fn(async () => ({ id: 'client-1' }))
const createAppointmentMock = vi.fn(async () => {
  throw new Error('conexão com o banco falhou')
})

vi.mock('@/lib/db', () => ({
  prisma: {
    service: { findFirst: findFirstServiceMock },
    client: { findFirst: findFirstClientMock, create: createClientMock },
    appointment: { create: createAppointmentMock },
    user: { findUnique: vi.fn(async () => null) },
  },
}))

const checkAppointmentQuotaMock = vi.fn(async () => ({ allowed: true, currentCount: 0, remaining: 10 }))
const resolveBookingTargetMock = vi.fn(async () => ({ scheduleId: 'schedule-1', professionalId: null }))
// O lock é transparente nos testes: roda fn direto passando o próprio prisma
// mockado como "tx" — o mock não distingue client normal de transacional.
const withBookingLockMock = vi.fn(async (_key: string, fn: (tx: any) => Promise<any>) => {
  const { prisma } = await import('@/lib/db')
  return fn(prisma)
})

vi.mock('@/lib/appointment-service', () => ({
  checkAppointmentQuota: checkAppointmentQuotaMock,
  resolveBookingTarget: resolveBookingTargetMock,
  withBookingLock: withBookingLockMock,
}))

const getAvailableSlotsForServiceMock = vi.fn(async () => [{ time: '10:00', available: true }])

vi.mock('@/lib/availability-service', () => ({
  getAvailableSlotsForService: getAvailableSlotsForServiceMock,
  parseCalendarDate: (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
  },
}))

const tenant = {
  id: 'tenant-a',
  name: 'Dono',
  businessName: 'Salão X',
  planType: 'BASICO',
  businessConfig: {
    allowOnlineBooking: true,
    autoConfirm: false,
    timezone: 'America/Sao_Paulo',
    description: '',
    address: '',
  },
} as any

describe('buildSystemPrompt', () => {
  it('inclui a data de hoje real (ano corrente), não uma data hardcoded', async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/chat-agent')

    const prompt = buildSystemPrompt(tenant)
    const currentYear = String(new Date().getFullYear())

    expect(prompt).toContain('Hoje é')
    expect(prompt).toContain(currentYear)
    expect(prompt).not.toContain('2023')
  })

  it('instrui a resolver datas sem ano usando a data de hoje como referência', async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/chat-agent')

    const prompt = buildSystemPrompt(tenant)

    expect(prompt.toLowerCase()).toContain('sem o ano')
  })

  // Invariante: o cliente nunca escolhe agenda, só serviço e profissional —
  // o prompt não pode instruir o modelo a perguntar ou mencionar agenda.
  it('nunca instrui o modelo a perguntar qual agenda o cliente quer', async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/chat-agent')

    const prompt = buildSystemPrompt(tenant)

    expect(prompt).toContain('Nunca pergunte ao cliente em qual agenda')
  })
})

describe('executeTool: check_availability', () => {
  it('rejeita data no passado sem consultar a agenda', async () => {
    const { executeTool } = await import('@/lib/ai/chat-agent')

    const result = await executeTool('check_availability', {
      serviceId: 'service-1',
      date: '2000-01-01',
    }, tenant)

    expect(result.error).toBeDefined()
    expect(getAvailableSlotsForServiceMock).not.toHaveBeenCalled()
  })

  it('não recebe nem precisa de scheduleId — resolve por serviceId direto', async () => {
    const { executeTool } = await import('@/lib/ai/chat-agent')

    const result = await executeTool('check_availability', {
      serviceId: 'service-1',
      date: '2099-01-01',
    }, tenant)

    expect(result.slots).toEqual(['10:00'])
    expect(getAvailableSlotsForServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: 'service-1', date: '2099-01-01', userId: tenant.id })
    )
  })
})

describe('executeTool: create_appointment', () => {
  it('retorna erro específico quando falta o telefone do cliente, sem tocar no banco', async () => {
    const { executeTool } = await import('@/lib/ai/chat-agent')

    const result = await executeTool('create_appointment', {
      serviceId: 'service-1',
      date: '2099-01-01',
      time: '10:00',
      clientName: 'Cliente Teste',
      clientPhone: '',
    }, tenant)

    expect(result.error).toBeDefined()
    expect(createAppointmentMock).not.toHaveBeenCalled()
  })

  it('não propaga exceção quando a criação falha — retorna { error } tratável pelo modelo', async () => {
    const { executeTool } = await import('@/lib/ai/chat-agent')

    const result = await executeTool('create_appointment', {
      serviceId: 'service-1',
      date: '2099-01-01',
      time: '10:00',
      clientName: 'Cliente Teste',
      clientPhone: '11999999999',
    }, tenant)

    expect(result.error).toBeDefined()
    expect(createAppointmentMock).toHaveBeenCalled()
  })

  it('resolve a agenda no servidor via resolveBookingTarget, nunca a partir de um scheduleId do modelo', async () => {
    const { executeTool } = await import('@/lib/ai/chat-agent')

    await executeTool('create_appointment', {
      // scheduleId de propósito ausente — o schema da tool não expõe mais esse campo
      serviceId: 'service-1',
      date: '2099-01-01',
      time: '10:00',
      clientName: 'Cliente Teste',
      clientPhone: '11999999999',
    }, tenant)

    expect(resolveBookingTargetMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: tenant.id, serviceId: 'service-1' })
    )
  })
})
