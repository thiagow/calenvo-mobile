import { describe, it, expect, vi } from 'vitest'

// Regressão dos 3 bugs relatados em produção:
// 1/2) A IA resolvia datas (inclusive espontaneamente) para 2023 por falta de uma
//    data "de hoje" real no system prompt.
// 3) Uma exceção qualquer dentro de create_appointment derrubava o turno inteiro
//    de chat com um erro genérico, sem detalhe nenhum de causa.

const findFirstServiceMock = vi.fn(async () => ({ id: 'service-1', duration: 30, price: 100 }))
const findFirstScheduleMock = vi.fn(async () => ({ id: 'schedule-1' }))
const findFirstClientMock = vi.fn(async () => null)
const createClientMock = vi.fn(async () => ({ id: 'client-1' }))
const createAppointmentMock = vi.fn(async () => {
  throw new Error('conexão com o banco falhou')
})

vi.mock('@/lib/db', () => ({
  prisma: {
    service: { findFirst: findFirstServiceMock },
    schedule: { findFirst: findFirstScheduleMock },
    client: { findFirst: findFirstClientMock, create: createClientMock },
    appointment: { create: createAppointmentMock },
  },
}))

const checkAppointmentQuotaMock = vi.fn(async () => ({ allowed: true, currentCount: 0, remaining: 10 }))
const resolveProfessionalForBookingMock = vi.fn(async () => ({ professionalId: null }))

vi.mock('@/lib/appointment-service', () => ({
  checkAppointmentQuota: checkAppointmentQuotaMock,
  resolveProfessionalForBooking: resolveProfessionalForBookingMock,
}))

const getAvailableSlotsMock = vi.fn(async () => [{ time: '10:00', available: true }])

vi.mock('@/lib/availability-service', () => ({
  getAvailableSlots: getAvailableSlotsMock,
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
})

describe('executeTool: check_availability', () => {
  it('rejeita data no passado sem consultar a agenda', async () => {
    const { executeTool } = await import('@/lib/ai/chat-agent')

    const result = await executeTool('check_availability', {
      scheduleId: 'schedule-1',
      serviceId: 'service-1',
      date: '2000-01-01',
    }, tenant)

    expect(result.error).toBeDefined()
    expect(getAvailableSlotsMock).not.toHaveBeenCalled()
  })
})

describe('executeTool: create_appointment', () => {
  it('retorna erro específico quando falta o telefone do cliente, sem tocar no banco', async () => {
    const { executeTool } = await import('@/lib/ai/chat-agent')

    const result = await executeTool('create_appointment', {
      scheduleId: 'schedule-1',
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
      scheduleId: 'schedule-1',
      serviceId: 'service-1',
      date: '2099-01-01',
      time: '10:00',
      clientName: 'Cliente Teste',
      clientPhone: '11999999999',
    }, tenant)

    expect(result.error).toBeDefined()
    expect(createAppointmentMock).toHaveBeenCalled()
  })
})
