import { describe, it, expect, vi, beforeEach } from 'vitest'

const { findUnique, findBusinessConfig, sendText } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findBusinessConfig: vi.fn(async () => ({ timezone: 'America/Sao_Paulo' })),
  sendText: vi.fn(async () => ({})),
}))

vi.mock('./db', () => ({
  prisma: { whatsAppConfig: { findUnique }, businessConfig: { findUnique: findBusinessConfig } },
}))
vi.mock('./crypto', () => ({ decryptSecret: (v: string) => `dec:${v}` }))
vi.mock('./uazapi', () => ({ sendText }))

import { WhatsAppTriggerService } from './whatsapp-trigger'

const baseConfig = {
  enabled: true,
  isConnected: true,
  apiKey: 'enc',
  notifyProfessionalOnBooking: true,
  professionalBookingMessage: null,
}

function makeAppointment(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'u1',
    date: new Date('2026-10-10T14:00:00'),
    client: { name: 'Maria' },
    user: { businessName: 'Studio', whatsapp: '62911111111', phone: null },
    professionalUser: { whatsapp: '62922222222', phone: null },
    ...overrides,
  } as never
}

describe('WhatsAppTriggerService.onAppointmentCreatedByClient', () => {
  beforeEach(() => {
    findUnique.mockReset()
    sendText.mockClear()
    findBusinessConfig.mockResolvedValue({ timezone: 'America/Sao_Paulo' })
  })

  it('não envia com o toggle desligado', async () => {
    findUnique.mockResolvedValue({ ...baseConfig, notifyProfessionalOnBooking: false })
    await WhatsAppTriggerService.onAppointmentCreatedByClient(makeAppointment(), 'Corte')
    expect(sendText).not.toHaveBeenCalled()
  })

  it('não envia se o WhatsApp não está conectado', async () => {
    findUnique.mockResolvedValue({ ...baseConfig, isConnected: false })
    await WhatsAppTriggerService.onAppointmentCreatedByClient(makeAppointment(), 'Corte')
    expect(sendText).not.toHaveBeenCalled()
  })

  it('envia ao WhatsApp do profissional com a mensagem padrão', async () => {
    findUnique.mockResolvedValue(baseConfig)
    await WhatsAppTriggerService.onAppointmentCreatedByClient(makeAppointment(), 'Corte')
    expect(sendText).toHaveBeenCalledTimes(1)
    const [token, number, text] = sendText.mock.calls[0] as unknown as [string, string, string]
    expect(token).toBe('dec:enc')
    expect(number).toContain('62922222222')
    expect(text).toContain('Maria')
    expect(text).toContain('Corte')
  })

  it('usa a mensagem personalizada quando existe', async () => {
    findUnique.mockResolvedValue({ ...baseConfig, professionalBookingMessage: 'Cliente {{nome_cliente}} chegou!' })
    await WhatsAppTriggerService.onAppointmentCreatedByClient(makeAppointment(), 'Corte')
    expect((sendText.mock.calls[0] as unknown as string[])[2]).toBe('Cliente Maria chegou!')
  })

  it('cai para o telefone do dono quando o profissional não tem número', async () => {
    findUnique.mockResolvedValue(baseConfig)
    await WhatsAppTriggerService.onAppointmentCreatedByClient(
      makeAppointment({ professionalUser: { whatsapp: null, phone: null } }),
      'Corte'
    )
    expect((sendText.mock.calls[0] as unknown as string[])[1]).toContain('62911111111')
  })

  it('não envia sem nenhum destinatário', async () => {
    findUnique.mockResolvedValue(baseConfig)
    await WhatsAppTriggerService.onAppointmentCreatedByClient(
      makeAppointment({
        professionalUser: null,
        user: { businessName: 'Studio', whatsapp: null, phone: null },
      }),
      'Corte'
    )
    expect(sendText).not.toHaveBeenCalled()
  })
})

describe('horário das mensagens (fuso do negócio, não do servidor)', () => {
  const customConfig = { ...baseConfig, professionalBookingMessage: '{{data}} {{hora}}' }

  beforeEach(() => {
    findUnique.mockReset()
    sendText.mockClear()
    findBusinessConfig.mockResolvedValue({ timezone: 'America/Sao_Paulo' })
  })

  it('16:00 em São Paulo (19:00Z) sai como 16:00, não 19:00', async () => {
    findUnique.mockResolvedValue(customConfig)
    await WhatsAppTriggerService.onAppointmentCreatedByClient(
      makeAppointment({ date: new Date('2026-10-14T19:00:00Z') }),
      'Corte'
    )
    expect((sendText.mock.calls[0] as unknown as string[])[2]).toBe('14/10/2026 16:00')
  })

  it('virada de dia: 01:30Z do dia 15 é 22:30 do dia 14 em São Paulo', async () => {
    findUnique.mockResolvedValue(customConfig)
    await WhatsAppTriggerService.onAppointmentCreatedByClient(
      makeAppointment({ date: new Date('2026-10-15T01:30:00Z') }),
      'Corte'
    )
    expect((sendText.mock.calls[0] as unknown as string[])[2]).toBe('14/10/2026 22:30')
  })

  it('respeita o fuso configurado no negócio', async () => {
    findUnique.mockResolvedValue(customConfig)
    findBusinessConfig.mockResolvedValue({ timezone: 'America/Manaus' })
    await WhatsAppTriggerService.onAppointmentCreatedByClient(
      makeAppointment({ date: new Date('2026-10-14T19:00:00Z') }),
      'Corte'
    )
    expect((sendText.mock.calls[0] as unknown as string[])[2]).toBe('14/10/2026 15:00')
  })

  it('sem businessConfig usa America/Sao_Paulo', async () => {
    findUnique.mockResolvedValue(customConfig)
    findBusinessConfig.mockResolvedValue(null as never)
    await WhatsAppTriggerService.onAppointmentCreatedByClient(
      makeAppointment({ date: new Date('2026-10-14T19:00:00Z') }),
      'Corte'
    )
    expect((sendText.mock.calls[0] as unknown as string[])[2]).toBe('14/10/2026 16:00')
  })
})
