import OpenAI from 'openai'
import { prisma } from '@/lib/db'
import { checkAppointmentQuota, checkScheduleConflict } from '@/lib/appointment-service'
import { getAvailableSlots } from '@/lib/availability-service'
import type { User, BusinessConfig } from '@prisma/client'

const MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'
const MAX_TOOL_ROUNDS = 5

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

export function isChatAgentConfigured(): boolean {
  return client !== null
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

async function executeTool(
  toolName: string,
  input: any,
  tenant: User & { businessConfig: BusinessConfig | null }
): Promise<any> {
  switch (toolName) {
    case 'list_services': {
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
    }

    case 'check_availability': {
      const slots = await getAvailableSlots({
        scheduleId: input.scheduleId,
        serviceId: input.serviceId,
        date: input.date,
      })
      if (slots === null) return { error: 'Agenda ou serviço não encontrado' }
      return { slots: slots.filter((s) => s.available).map((s) => s.time) }
    }

    case 'create_appointment': {
      if (!tenant.businessConfig?.allowOnlineBooking) {
        return { error: 'Agendamento online não está disponível para este negócio no momento.' }
      }

      const quota = await checkAppointmentQuota(tenant.id, tenant.planType)
      if (!quota.allowed) {
        return { error: 'O estabelecimento atingiu o limite de agendamentos do mês. Peça para o cliente entrar em contato diretamente.' }
      }

      const service = await prisma.service.findFirst({ where: { id: input.serviceId, userId: tenant.id } })
      if (!service) return { error: 'Serviço não encontrado' }

      const [hours, minutes] = String(input.time).split(':').map(Number)
      const appointmentDate = new Date(input.date)
      appointmentDate.setHours(hours, minutes, 0, 0)

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
    }

    default:
      return { error: `Ferramenta desconhecida: ${toolName}` }
  }
}

function buildSystemPrompt(tenant: User & { businessConfig: BusinessConfig | null }): string {
  const businessName = tenant.businessName || tenant.name || 'o negócio'
  const description = tenant.businessConfig?.description || ''
  const address = tenant.businessConfig?.address || ''

  return `Você é o assistente virtual de agendamento de "${businessName}". Seja educado, breve e direto — respostas curtas, estilo chat.

${description ? `Sobre o negócio: ${description}` : ''}
${address ? `Endereço: ${address}` : ''}

Seu objetivo é ajudar o visitante a marcar um horário. Fluxo recomendado:
1. Entenda qual serviço a pessoa quer (use list_services se precisar).
2. Descubra a data desejada e confira horários livres com check_availability.
3. Confirme com a pessoa qual horário ela quer, e peça nome e telefone.
4. Só chame create_appointment depois que o cliente confirmar explicitamente o horário e informar nome e telefone.
5. Depois de criar, confirme o agendamento de forma clara (data, horário, serviço).

Nunca invente serviços, horários ou disponibilidade — sempre use as ferramentas. Se não conseguir ajudar, sugira que a pessoa entre em contato diretamente.`
}

export async function runChatAgent(
  tenant: User & { businessConfig: BusinessConfig | null },
  messages: ChatMessage[]
): Promise<string> {
  if (!client) {
    return 'Desculpe, o assistente de agendamento está temporariamente indisponível. Tente novamente mais tarde.'
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
    })

    const choice = response.choices[0]
    const message = choice.message

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content || 'Desculpe, não consegui processar sua mensagem.'
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

  return 'Desculpe, não consegui concluir sua solicitação agora. Tente novamente ou entre em contato diretamente.'
}
