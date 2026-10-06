import { describe, it, expect, vi, beforeEach } from 'vitest'

// resolveProfessionalForBooking é o único lugar que decide qual profissional fica
// com um novo agendamento — usado por booking público, chat de IA, dashboard e API
// v1. Antes, cada rota fazia sua própria checagem solta e nenhuma delas atribuía
// um profissional concreto quando o cliente não tinha preferência, então uma
// agenda com N profissionais nunca aproveitava a capacidade de tê-los livres em
// paralelo.
let mockAppointments: any[] = []
let mockCandidateScheduleIds: string[] = ['schedule-1']
let mockBlocksBySchedule: Record<string, { startDate: Date; endDate: Date }[]> = {}
let mockProfessionalsBySchedule: Record<string, { professionalId: string }[]> = {
  'schedule-1': [{ professionalId: 'p1' }, { professionalId: 'p2' }, { professionalId: 'p3' }],
}

const executeRawMock = vi.fn(async () => 0)
const transactionMock = vi.fn(async (fn: (tx: any) => Promise<any>) => fn(mockTx))

vi.mock('@/lib/db', () => ({
  prisma: {
    schedule: {
      // resolveProfessionalForBooking exige que a agenda pertença ao tenant
      // chamado — devolve null (agenda "não encontrada") pra qualquer userId
      // diferente do dono, do mesmo jeito que o Prisma faria com o where composto.
      findFirst: vi.fn(async ({ where }: any) =>
        where.userId !== TENANT_ID
          ? null
          : {
              professionals: mockProfessionalsBySchedule[where.id] || [],
              blocks: mockBlocksBySchedule[where.id] || [],
              user: { businessConfig: { timezone: 'America/Sao_Paulo' } },
            }
      ),
      findMany: vi.fn(async () => mockCandidateScheduleIds.map((id) => ({ id }))),
    },
    appointment: {
      // Com professionalId, checkBookingConflict não filtra por scheduleId
      // (ocupação é global pro profissional) — só compara scheduleId quando a
      // chave está mesmo presente no where (caso legado, sem profissional).
      findMany: vi.fn(async ({ where }: any) =>
        mockAppointments.filter((a) =>
          ('scheduleId' in where ? a.scheduleId === where.scheduleId : true) &&
          (!where.professionalId || a.professionalId === where.professionalId) &&
          (!where.id?.not || a.id !== where.id.not)
        )
      ),
    },
    $transaction: transactionMock,
    $executeRaw: executeRawMock,
  },
}))

// "tx" usado dentro de withBookingLock — nos testes, é o mesmo objeto mockado
// acima (o mock não distingue client normal de transacional).
const mockTx = {
  appointment: {
    findMany: vi.fn(async ({ where }: any) =>
      mockAppointments.filter((a) =>
        ('scheduleId' in where ? a.scheduleId === where.scheduleId : true) &&
        (!where.professionalId || a.professionalId === where.professionalId) &&
        (!where.id?.not || a.id !== where.id.not)
      )
    ),
  },
  $executeRaw: executeRawMock,
}

beforeEach(() => {
  mockAppointments = []
  mockBlocksBySchedule = {}
  mockCandidateScheduleIds = ['schedule-1']
  mockProfessionalsBySchedule = {
    'schedule-1': [{ professionalId: 'p1' }, { professionalId: 'p2' }, { professionalId: 'p3' }],
  }
})

const scheduleId = 'schedule-1'
const date = new Date(2099, 0, 1, 10, 0, 0, 0)
const duration = 30
const TENANT_ID = 'tenant-a'

describe('resolveProfessionalForBooking', () => {
  it('atribui o profissional pedido quando ele está livre', async () => {
    const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

    const result = await resolveProfessionalForBooking({ scheduleId, userId: TENANT_ID, date, duration, requestedProfessionalId: 'p2' })

    expect(result).toEqual({ professionalId: 'p2', hadConflict: false })
  })

  it('rejeita quando o profissional pedido não pertence a esta agenda', async () => {
    const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

    const result = await resolveProfessionalForBooking({ scheduleId, userId: TENANT_ID, date, duration, requestedProfessionalId: 'estranho' })

    expect(result.professionalId).toBeNull()
    expect(result.error).toBeDefined()
  })

  it('rejeita quando o profissional pedido já está ocupado nesse horário', async () => {
    mockAppointments = [{ date, duration, professionalId: 'p2' }]
    const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

    const result = await resolveProfessionalForBooking({ scheduleId, userId: TENANT_ID, date, duration, requestedProfessionalId: 'p2' })

    expect(result.professionalId).toBeNull()
    expect(result.error).toBeDefined()
  })

  it('sem professionalId (qualquer um), atribui o primeiro profissional livre', async () => {
    mockAppointments = [{ date, duration, professionalId: 'p1' }]
    const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

    const result = await resolveProfessionalForBooking({ scheduleId, userId: TENANT_ID, date, duration })

    expect(result).toEqual({ professionalId: 'p2', hadConflict: false })
  })

  it('sem professionalId, rejeita quando todos os profissionais vinculados estão ocupados', async () => {
    mockAppointments = [
      { date, duration, professionalId: 'p1' },
      { date, duration, professionalId: 'p2' },
      { date, duration, professionalId: 'p3' },
    ]
    const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

    const result = await resolveProfessionalForBooking({ scheduleId, userId: TENANT_ID, date, duration })

    expect(result.professionalId).toBeNull()
    expect(result.error).toBeDefined()
  })

  // Encaixe: o pedido nunca é bloqueado, mas `hadConflict` tem que dizer a
  // verdade — é ele, e não o cliente, que define `isOverbooked`. Antes a UI
  // adivinhava isso pela grade de horários livres e, quando a grade discordava
  // do servidor, o encaixe se desarmava sozinho e voltava recusado.
  describe('encaixe (allowOverbook)', () => {
    it('cria sobre horário ocupado e reporta hadConflict', async () => {
      mockAppointments = [{ date, duration, professionalId: 'p2' }]
      const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

      const result = await resolveProfessionalForBooking({ scheduleId, userId: TENANT_ID, date, duration, requestedProfessionalId: 'p2', allowOverbook: true })

      expect(result).toEqual({ professionalId: 'p2', hadConflict: true })
    })

    it('sobre horário livre não é marcado como encaixe', async () => {
      const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

      const result = await resolveProfessionalForBooking({ scheduleId, userId: TENANT_ID, date, duration, requestedProfessionalId: 'p2', allowOverbook: true })

      expect(result).toEqual({ professionalId: 'p2', hadConflict: false })
    })

    it('sem professionalId, prefere um colega livre em vez de empilhar no primeiro vinculado', async () => {
      mockAppointments = [{ date, duration, professionalId: 'p1' }]
      const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

      const result = await resolveProfessionalForBooking({ scheduleId, userId: TENANT_ID, date, duration, allowOverbook: true })

      expect(result).toEqual({ professionalId: 'p2', hadConflict: false })
    })

    it('sem professionalId e todos ocupados, cai no primeiro vinculado como encaixe', async () => {
      mockAppointments = [
        { date, duration, professionalId: 'p1' },
        { date, duration, professionalId: 'p2' },
        { date, duration, professionalId: 'p3' },
      ]
      const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

      const result = await resolveProfessionalForBooking({ scheduleId, userId: TENANT_ID, date, duration, allowOverbook: true })

      expect(result).toEqual({ professionalId: 'p1', hadConflict: true })
    })

    it('continua exigindo que o profissional pedido pertença à agenda', async () => {
      const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

      const result = await resolveProfessionalForBooking({ scheduleId, userId: TENANT_ID, date, duration, requestedProfessionalId: 'estranho', allowOverbook: true })

      expect(result.professionalId).toBeNull()
      expect(result.error).toBeDefined()
    })
  })

  // Bloqueio de data vale para TODO novo agendamento, por qualquer canal. A
  // trava mora aqui porque painel, API v1, página pública e chat passam todos
  // por esta função — antes o bloqueio só escondia horários na grade.
  describe('bloqueio de data', () => {
    // `date` acima é 01/01/2099 10:00 no fuso do processo; o bloqueio cobre o dia 2099-01-01.
    const blockCoveringDate = [{ startDate: new Date('2099-01-01T00:00:00.000Z'), endDate: new Date('2099-01-02T00:00:00.000Z') }]
    const blockElsewhere = [{ startDate: new Date('2099-03-01T00:00:00.000Z'), endDate: new Date('2099-03-05T00:00:00.000Z') }]
    // 01/01/2099 13:00Z = 10:00 em São Paulo, dia inequívoco nos dois fusos
    const bookingDate = new Date('2099-01-01T13:00:00.000Z')

    it('recusa agendamento numa data bloqueada', async () => {
      mockBlocksBySchedule = { 'schedule-1': blockCoveringDate }
      const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')
      const { BLOCKED_DATE_ERROR } = await import('@/lib/schedule-blocks')

      const result = await resolveProfessionalForBooking({ scheduleId, userId: TENANT_ID, date: bookingDate, duration })

      expect(result.professionalId).toBeNull()
      expect(result.error).toBe(BLOCKED_DATE_ERROR)
    })

    it('encaixe (allowOverbook) NÃO fura o bloqueio', async () => {
      mockBlocksBySchedule = { 'schedule-1': blockCoveringDate }
      const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')
      const { BLOCKED_DATE_ERROR } = await import('@/lib/schedule-blocks')

      const result = await resolveProfessionalForBooking({
        scheduleId, userId: TENANT_ID, date: bookingDate, duration, requestedProfessionalId: 'p2', allowOverbook: true,
      })

      expect(result.professionalId).toBeNull()
      expect(result.error).toBe(BLOCKED_DATE_ERROR)
    })

    it('data fora do bloqueio segue normal', async () => {
      mockBlocksBySchedule = { 'schedule-1': blockElsewhere }
      const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

      const result = await resolveProfessionalForBooking({ scheduleId, userId: TENANT_ID, date: bookingDate, duration, requestedProfessionalId: 'p2' })

      expect(result).toEqual({ professionalId: 'p2', hadConflict: false })
    })

    it('respeita o fuso do negócio: 01:30Z do dia 02 ainda é dia 01 em São Paulo', async () => {
      // 2099-01-02T01:30Z = 2099-01-01 22:30 em São Paulo → cai no bloqueio do dia 01
      mockBlocksBySchedule = { 'schedule-1': [{ startDate: new Date('2099-01-01T00:00:00.000Z'), endDate: new Date('2099-01-01T00:00:00.000Z') }] }
      const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

      const result = await resolveProfessionalForBooking({
        scheduleId, userId: TENANT_ID, date: new Date('2099-01-02T01:30:00.000Z'), duration, requestedProfessionalId: 'p2',
      })

      expect(result.error).toBeDefined()
    })
  })

  it('rejeita quando a agenda não pertence ao tenant chamado (isolamento cross-tenant)', async () => {
    const { resolveProfessionalForBooking } = await import('@/lib/appointment-service')

    const result = await resolveProfessionalForBooking({
      scheduleId,
      userId: 'tenant-outro',
      date,
      duration,
      requestedProfessionalId: 'p2',
    })

    expect(result.professionalId).toBeNull()
    expect(result.error).toBe('Agenda não encontrada')
  })
})

// resolveBookingTarget é o que substitui a escolha manual de agenda pelo
// cliente: dado só o serviceId, encontra a agenda candidata certa (e o
// profissional) — inclusive quando o serviço está em mais de uma agenda e a
// primeira já está ocupada nesse horário.
describe('resolveBookingTarget', () => {
  const userId = 'tenant-a'
  const serviceId = 'service-1'

  it('retorna erro quando o serviço não está em nenhuma agenda', async () => {
    mockCandidateScheduleIds = []
    const { resolveBookingTarget } = await import('@/lib/appointment-service')

    const result = await resolveBookingTarget({ userId, serviceId, date, duration })

    expect(result.scheduleId).toBeNull()
    expect(result.error).toBeDefined()
  })

  it('com uma única agenda candidata livre, resolve agenda e profissional', async () => {
    const { resolveBookingTarget } = await import('@/lib/appointment-service')

    const result = await resolveBookingTarget({ userId, serviceId, date, duration })

    expect(result).toEqual({ scheduleId: 'schedule-1', professionalId: 'p1' })
  })

  it('quando a primeira agenda candidata está lotada, tenta a próxima', async () => {
    mockCandidateScheduleIds = ['schedule-1', 'schedule-2']
    mockProfessionalsBySchedule['schedule-2'] = [{ professionalId: 'q1' }]
    // schedule-1 lotada (os 3 profissionais ocupados nesse horário)
    mockAppointments = [
      { scheduleId: 'schedule-1', date, duration, professionalId: 'p1' },
      { scheduleId: 'schedule-1', date, duration, professionalId: 'p2' },
      { scheduleId: 'schedule-1', date, duration, professionalId: 'p3' },
    ]
    const { resolveBookingTarget } = await import('@/lib/appointment-service')

    const result = await resolveBookingTarget({ userId, serviceId, date, duration })

    expect(result).toEqual({ scheduleId: 'schedule-2', professionalId: 'q1' })
  })

  it('retorna erro quando todas as agendas candidatas estão lotadas', async () => {
    mockAppointments = [
      { scheduleId: 'schedule-1', date, duration, professionalId: 'p1' },
      { scheduleId: 'schedule-1', date, duration, professionalId: 'p2' },
      { scheduleId: 'schedule-1', date, duration, professionalId: 'p3' },
    ]
    const { resolveBookingTarget } = await import('@/lib/appointment-service')

    const result = await resolveBookingTarget({ userId, serviceId, date, duration })

    expect(result.scheduleId).toBeNull()
    expect(result.error).toBeDefined()
  })

  // Bloqueio só numa agenda não pode impedir reservar numa outra que esteja
  // aberta — a trava recusa a agenda bloqueada e o laço segue para a próxima.
  it('pula a agenda bloqueada e usa a próxima que está aberta', async () => {
    mockCandidateScheduleIds = ['schedule-1', 'schedule-2']
    mockProfessionalsBySchedule['schedule-2'] = [{ professionalId: 'q1' }]
    mockBlocksBySchedule = {
      'schedule-1': [{ startDate: new Date('2099-01-01T00:00:00.000Z'), endDate: new Date('2099-01-02T00:00:00.000Z') }],
    }
    const { resolveBookingTarget } = await import('@/lib/appointment-service')

    const result = await resolveBookingTarget({ userId, serviceId, date: new Date('2099-01-01T13:00:00.000Z'), duration })

    expect(result).toEqual({ scheduleId: 'schedule-2', professionalId: 'q1' })
  })

  it('recusa quando TODAS as agendas candidatas estão bloqueadas na data', async () => {
    mockCandidateScheduleIds = ['schedule-1', 'schedule-2']
    mockProfessionalsBySchedule['schedule-2'] = [{ professionalId: 'q1' }]
    const block = [{ startDate: new Date('2099-01-01T00:00:00.000Z'), endDate: new Date('2099-01-02T00:00:00.000Z') }]
    mockBlocksBySchedule = { 'schedule-1': block, 'schedule-2': block }
    const { resolveBookingTarget } = await import('@/lib/appointment-service')

    const result = await resolveBookingTarget({ userId, serviceId, date: new Date('2099-01-01T13:00:00.000Z'), duration })

    expect(result.scheduleId).toBeNull()
    expect(result.error).toBe('Esta data está bloqueada para agendamentos')
  })
})

// checkBookingConflict é o guard de última linha na escrita (dashboard, público,
// chat e reagendamento) — mesma regra do motor de slots, mas na hora de gravar.
describe('checkBookingConflict', () => {
  it('detecta conflito para o profissional pedido, sem precisar do scheduleId bater', async () => {
    mockAppointments = [{ date, duration, professionalId: 'p1' }]
    const { checkBookingConflict } = await import('@/lib/appointment-service')

    const conflict = await checkBookingConflict({ scheduleId, professionalId: 'p1', date, duration })

    expect(conflict).toBe(true)
  })

  it('excludeAppointmentId permite salvar um reagendamento em cima do próprio horário original', async () => {
    mockAppointments = [{ id: 'apt-1', date, duration, professionalId: 'p1' }]
    const { checkBookingConflict } = await import('@/lib/appointment-service')

    const conflict = await checkBookingConflict({
      scheduleId,
      professionalId: 'p1',
      date,
      duration,
      excludeAppointmentId: 'apt-1',
    })

    expect(conflict).toBe(false)
  })

  it('sem professionalId, cai pro escopo da agenda inteira (agenda legada)', async () => {
    mockAppointments = [{ scheduleId, date, duration, professionalId: null }]
    const { checkBookingConflict } = await import('@/lib/appointment-service')

    const conflict = await checkBookingConflict({ scheduleId, date, duration })

    expect(conflict).toBe(true)
  })
})

// withBookingLock serializa checagem + escrita sob um advisory lock — sem
// transação nem constraint no schema, é o único mecanismo que fecha a janela
// de corrida entre dois pedidos concorrentes pro mesmo horário.
describe('withBookingLock', () => {
  it('roda a callback dentro de uma transação e devolve o resultado dela', async () => {
    const { withBookingLock } = await import('@/lib/appointment-service')

    const result = await withBookingLock('p1', async () => ({ ok: true, value: 42 }))

    expect(result).toEqual({ ok: true, value: 42 })
    expect(transactionMock).toHaveBeenCalled()
    expect(executeRawMock).toHaveBeenCalled()
  })
})
