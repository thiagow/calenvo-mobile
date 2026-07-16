import OpenAI from 'openai'
import { prisma } from '@/lib/db'
import { checkAppointmentQuota, checkScheduleConflict } from '@/lib/appointment-service'
import { getAvailableSlots, parseCalendarDate } from '@/lib/availability-service'
import type { User, BusinessConfig } from '@prisma/client'

const MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'
const MAX_TOOL_ROUNDS = 5

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

export function isChatAgentConfigured(): boolean {
  return client !== null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function getTenantTimezone(tenant: User & { businessConfig: BusinessConfig | null }): string {
  return tenant.businessConfig?.timezone || 'America/Sao_Paulo'
}

// "Hoje" no timezone do tenant, formato YYYY-MM-DD — comparável lexicograficamente.
function getTodayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
}

// Label legível em português pro system prompt, ex: "sexta-feira, 15 de julho de 2026".
function getTodayLabel(timezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

function isPastDate(dateStr: string, timezone: string): boolean {
  return dateStr < getTodayInTimezone(timezone)
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_services',
      description: 'Lista os serviços oferecidos pelo negócio, incluindo a agenda (scheduleId) onde cada um pode ser reservado. Use antes de checar disponibilidade ou criar um agendamento.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Verifica os horários disponíveis para um serviço numa agenda, numa data específica.',
      parameters: {
        type: 'object',
        properties: {
          scheduleId: { type: 'string' },
          serviceId: { type: 'string' },
          date: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
        },
        required: ['scheduleId', 'serviceId', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_appointment',
      description: 'Cria um agendamento depois que o cliente confirmou serviço, agenda, data e horário, e informou nome e telefone.',
      parameters: {
        type: 'object',
        properties: {
          scheduleId: { type: 'string' },
          serviceId: { type: 'string' },
          date: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
          time: { type: 'string', description: 'Horário no formato HH:mm' },
          clientName: { type: 'string' },
          clientPhone: { type: 'string' },
          clientEmail: { type: 'string' },
        },
        required: ['scheduleId', 'serviceId', 'date', 'time', 'clientName', 'clientPhone'],
      },
    },
  },
]

export async function executeTool(
  toolName: string,
  input: any,
  tenant: User & { businessConfig: BusinessConfig | null }
): Promise<any> {
  switch (toolName) {
    case 'list_services': {
      try {
        const services = await prisma.service.findMany({
          where: { userId: tenant.id, isActive: true },
          include: { schedules: { include: { schedule: true } } },
        })
        return services.map((s) => ({
          serviceId: s.id,
          name: s.name,
          duration: s.duration,
          price: s.price,
          schedules: s.schedules.map((ss) => ({ scheduleId: ss.scheduleId, scheduleName: ss.schedule.name })),
        }))
      } catch (error) {
        console.error('[chat-agent] Erro em list_services:', { tenantId: tenant.id, error })
        return { error: 'Não foi possível listar os serviços agora. Tente novamente.' }
      }
    }

    case 'check_availability': {
      try {
        if (!DATE_RE.test(input.date)) {
          return { error: 'Data inválida. Peça ao cliente uma data no formato dia/mês (ou AAAA-MM-DD).' }
        }

        const timezone = getTenantTimezone(tenant)
        if (isPastDate(input.date, timezone)) {
          return { error: 'Essa data já passou. Peça uma data futura ao cliente.' }
        }

        const slots = await getAvailableSlots({
          scheduleId: input.scheduleId,
          serviceId: input.serviceId,
          date: input.date,
          userId: tenant.id,
        })
        if (slots === null) return { error: 'Agenda ou serviço não encontrado' }
        return { slots: slots.filter((s) => s.available).map((s) => s.time) }
      } catch (error) {
        console.error('[chat-agent] Erro em check_availability:', { input, tenantId: tenant.id, error })
        return { error: 'Não foi possível checar a disponibilidade agora. Tente novamente.' }
      }
    }

    case 'create_appointment': {
      try {
        if (!tenant.businessConfig?.allowOnlineBooking) {
          return { error: 'Agendamento online não está disponível para este negócio no momento.' }
        }

        if (typeof input.clientName !== 'string' || !input.clientName.trim()) {
          return { error: 'Nome do cliente é obrigatório. Peça o nome antes de confirmar o agendamento.' }
        }
        if (typeof input.clientPhone !== 'string' || !input.clientPhone.trim()) {
          return { error: 'Telefone do cliente é obrigatório. Peça o telefone antes de confirmar o agendamento.' }
        }
        if (!DATE_RE.test(input.date)) {
          return { error: 'Data inválida. Confirme a data com o cliente no formato AAAA-MM-DD.' }
        }
        if (!TIME_RE.test(input.time)) {
          return { error: 'Horário inválido. Confirme o horário com o cliente no formato HH:mm.' }
        }

        const timezone = getTenantTimezone(tenant)
        if (isPastDate(input.date, timezone)) {
          return { error: 'Essa data já passou. Peça uma data futura ao cliente.' }
        }

        const quota = await checkAppointmentQuota(tenant.id, tenant.planType ?? 'BASICO')
        if (!quota.allowed) {
          return { error: 'O estabelecimento atingiu o limite de agendamentos do mês. Peça para o cliente entrar em contato diretamente.' }
        }

        const service = await prisma.service.findFirst({ where: { id: input.serviceId, userId: tenant.id } })
        if (!service) return { error: 'Serviço não encontrado' }

        const schedule = await prisma.schedule.findFirst({ where: { id: input.scheduleId, userId: tenant.id } })
        if (!schedule) return { error: 'Agenda não encontrada' }

        const [hours, minutes] = input.time.split(':').map(Number)
        const appointmentDate = parseCalendarDate(input.date)
        appointmentDate.setHours(hours, minutes, 0, 0)

        if (Number.isNaN(appointmentDate.getTime())) {
          return { error: 'Data ou horário inválido. Peça para o cliente confirmar novamente.' }
        }

        const hasConflict = await checkScheduleConflict({
          scheduleId: input.scheduleId,
          date: appointmentDate,
          duration: service.duration,
        })
        if (hasConflict) return { error: 'Este horário acabou de ficar indisponível. Peça para o cliente escolher outro horário.' }

        let clientRecord = await prisma.client.findFirst({ where: { userId: tenant.id, phone: input.clientPhone } })
        if (!clientRecord) {
          clientRecord = await prisma.client.create({
            data: {
              name: input.clientName,
              phone: input.clientPhone,
              email: input.clientEmail || null,
              userId: tenant.id,
            },
          })
        }

        const initialStatus = tenant.businessConfig.autoConfirm ? 'CONFIRMED' : 'SCHEDULED'

        const appointment = await prisma.appointment.create({
          data: {
            date: appointmentDate,
            duration: service.duration,
            status: initialStatus,
            scheduleId: input.scheduleId,
            serviceId: input.serviceId,
            clientId: clientRecord.id,
            userId: tenant.id,
            price: service.price || undefined,
            notes: 'Criado via chat de IA (widget)',
          },
        })

        return {
          success: true,
          appointmentId: appointment.id,
          status: appointment.status,
          date: appointment.date,
        }
      } catch (error) {
        console.error('[chat-agent] Erro em create_appointment:', { input, tenantId: tenant.id, error })
        return { error: 'Não foi possível criar o agendamento agora. Peça para o cliente tentar novamente em instantes ou entrar em contato diretamente.' }
      }
    }

    default:
      return { error: `Ferramenta desconhecida: ${toolName}` }
  }
}

export function buildSystemPrompt(tenant: User & { businessConfig: BusinessConfig | null }): string {
  const businessName = tenant.businessName || tenant.name || 'o negócio'
  const description = tenant.businessConfig?.description || ''
  const address = tenant.businessConfig?.address || ''
  const timezone = getTenantTimezone(tenant)
  const todayLabel = getTodayLabel(timezone)

  return `Você é o assistente virtual de agendamento de "${businessName}". Seja educado, breve e direto — respostas curtas, estilo chat.

Hoje é ${todayLabel}. Use sempre esta data como referência de "hoje" — nunca assuma ou invente outro ano.

${description ? `Sobre o negócio: ${description}` : ''}
${address ? `Endereço: ${address}` : ''}

Seu objetivo é ajudar o visitante a marcar um horário. Fluxo recomendado:
1. Entenda qual serviço a pessoa quer (use list_services se precisar).
2. Depois de saber o serviço (e a agenda, se houver mais de uma), sugira proativamente as duas datas mais próximas com horários livres, chamando check_availability para cada data candidata — não pergunte apenas "qual data você quer" sem antes tentar sugerir algo. Nunca sugira uma data antes de saber o serviço.
3. Se o cliente mencionar uma data sem o ano, calcule o ano a partir da data de hoje informada acima: use o ano atual, ou o ano seguinte se essa data já tiver passado neste ano. Sempre chame check_availability com a data resolvida no formato AAAA-MM-DD — mesmo que seja uma data diferente das que você já sugeriu antes. Nunca diga que uma data não está disponível sem antes checar essa data específica com check_availability.
4. Confirme com a pessoa qual horário ela quer, e peça nome e telefone.
5. Só chame create_appointment depois que o cliente confirmar explicitamente o horário e informar nome e telefone.
6. Depois de criar, confirme o agendamento de forma clara (data, horário, serviço).

Nunca invente serviços, horários ou disponibilidade — sempre use as ferramentas. Nunca invente ou "lembre de cor" o scheduleId/serviceId de mensagens antigas: se você não tiver o resultado de list_services desta própria conversa disponível agora, chame list_services de novo antes de check_availability ou create_appointment — nunca use um ID que você não obteve de uma resposta real da ferramenta. Se não conseguir ajudar, sugira que a pessoa entre em contato diretamente.

Formato da resposta:
- Use markdown simples quando ajudar a leitura: **negrito** para destacar, listas numeradas ou com marcadores ao apresentar múltiplos serviços ou horários.
- Preencha "quickReplies" com até 4 opções curtas quando a resposta apresentar um conjunto pequeno de escolhas que a pessoa normalmente tocaria em vez de digitar (ex: nomes de serviços, horários disponíveis, confirmações sim/não). Deixe "quickReplies" vazio quando não houver opções discretas nesse momento.`
}

interface ChatAgentReply {
  text: string
  quickReplies: string[]
}

const REPLY_SCHEMA = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'chat_reply',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Resposta em texto para o usuário, pode conter markdown simples (negrito, listas).' },
        quickReplies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Até 4 opções curtas que o usuário pode escolher com um toque. Vazio se não houver.',
        },
      },
      required: ['text', 'quickReplies'],
      additionalProperties: false,
    },
  },
}

function parseReply(content: string | null): ChatAgentReply {
  if (!content) return { text: 'Desculpe, não consegui processar sua mensagem.', quickReplies: [] }
  try {
    const parsed = JSON.parse(content)
    return {
      text: typeof parsed.text === 'string' ? parsed.text : content,
      quickReplies: Array.isArray(parsed.quickReplies) ? parsed.quickReplies.filter((q: unknown) => typeof q === 'string') : [],
    }
  } catch {
    return { text: content, quickReplies: [] }
  }
}

export async function runChatAgent(
  tenant: User & { businessConfig: BusinessConfig | null },
  messages: ChatMessage[]
): Promise<ChatAgentReply> {
  if (!client) {
    return { text: 'Desculpe, o assistente de agendamento está temporariamente indisponível. Tente novamente mais tarde.', quickReplies: [] }
  }

  const conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(tenant) },
    ...messages.map((m) => ({ role: m.role, content: m.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
  ]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: conversation,
      tools: TOOLS,
      response_format: REPLY_SCHEMA,
    })

    const choice = response.choices[0]
    const message = choice.message

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return parseReply(message.content)
    }

    conversation.push(message)

    for (const toolCall of message.tool_calls) {
      if (toolCall.type !== 'function') continue
      let input: any = {}
      try {
        input = JSON.parse(toolCall.function.arguments || '{}')
      } catch {
        input = {}
      }
      const result = await executeTool(toolCall.function.name, input, tenant)
      conversation.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      })
    }
  }

  return { text: 'Desculpe, não consegui concluir sua solicitação agora. Tente novamente ou entre em contato diretamente.', quickReplies: [] }
}
