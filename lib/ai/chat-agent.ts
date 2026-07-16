import OpenAI from 'openai'
import { prisma } from '@/lib/db'
import { checkAppointmentQuota, resolveProfessionalForBooking } from '@/lib/appointment-service'
import { getAvailableSlots, parseCalendarDate } from '@/lib/availability-service'
import type { User, BusinessConfig } from '@prisma/client'

const MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'
const MAX_TOOL_ROUNDS = 8
// Trava de código, não só de prompt: o modelo às vezes insiste em checar
// disponibilidade dia após dia em vez de parar em 2 candidatas (visto em teste
// real com agenda multi-profissional totalmente livre — nada no retorno da
// ferramenta dava um sinal claro de "pare por aqui"). Depois desse limite,
// check_availability para de rodar de verdade e devolve uma instrução direta
// pro modelo responder com o que já tem.
const MAX_AVAILABILITY_CHECKS = 4

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
      description: 'Verifica os horários disponíveis para um serviço numa agenda, numa data específica. Se o cliente tiver preferência por um profissional específico (dentre os listados em list_services), passe professionalId — caso contrário, omita para ver a disponibilidade combinada de todos os profissionais da agenda.',
      parameters: {
        type: 'object',
        properties: {
          scheduleId: { type: 'string' },
          serviceId: { type: 'string' },
          date: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
          professionalId: { type: 'string', description: 'Opcional — id do profissional preferido pelo cliente' },
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
          professionalId: { type: 'string', description: 'Opcional — id do profissional escolhido pelo cliente; omita se ele não tiver preferência' },
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
          include: {
            schedules: {
              include: {
                schedule: {
                  include: {
                    professionals: {
                      where: { professional: { isActive: true } },
                      select: { professional: { select: { id: true, name: true } } },
                    },
                  },
                },
              },
            },
          },
        })
        return services.map((s) => ({
          serviceId: s.id,
          name: s.name,
          duration: s.duration,
          price: s.price,
          schedules: s.schedules.map((ss) => ({
            scheduleId: ss.scheduleId,
            scheduleName: ss.schedule.name,
            // Se houver mais de um, pergunte a preferência do cliente antes de
            // chamar check_availability/create_appointment com um professionalId
            // específico. Com só um, não é preciso perguntar nada.
            professionals: ss.schedule.professionals.map((sp) => ({ id: sp.professional.id, name: sp.professional.name })),
          })),
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
          ...(input.professionalId && { professionalId: input.professionalId }),
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
        // Telefone real sempre tem dígitos — pega o caso do modelo inventar um
        // valor de preenchimento (ex.: "Telefone") em vez de pedir o de verdade.
        if (typeof input.clientPhone !== 'string' || !input.clientPhone.trim() || !/\d/.test(input.clientPhone)) {
          return { error: 'Telefone do cliente inválido ou não informado. Peça o telefone real ao cliente (com números) antes de confirmar o agendamento — nunca invente um valor.' }
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

        const resolution = await resolveProfessionalForBooking({
          scheduleId: input.scheduleId,
          date: appointmentDate,
          duration: service.duration,
          requestedProfessionalId: input.professionalId || null,
        })
        if (resolution.error) return { error: resolution.error }

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
            professionalId: resolution.professionalId,
            clientId: clientRecord.id,
            userId: tenant.id,
            price: service.price || undefined,
            notes: 'Criado via chat de IA (widget)',
          },
        })

        const professional = resolution.professionalId
          ? await prisma.user.findUnique({ where: { id: resolution.professionalId }, select: { name: true } })
          : null

        return {
          success: true,
          appointmentId: appointment.id,
          status: appointment.status,
          date: appointment.date,
          professionalName: professional?.name ?? null,
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
2. Olhe "professionals" da agenda desse serviço no retorno de list_services (sem chamar mais nenhuma ferramenta): se tiver mais de um, pergunte rapidamente se o cliente tem preferência por algum deles, citando os nomes — não insista, "qualquer um" é uma resposta válida. Se tiver só um (ou nenhum vinculado), não pergunte nada e siga em frente. Nunca chame check_availability por profissional só para decidir se pergunta ou não — a pergunta usa apenas os nomes que list_services já devolveu.
3. Depois de resolvido o profissional (escolhido ou "qualquer um"), sugira proativamente as duas datas mais próximas com horários livres. Chame check_availability no máximo 2 vezes para isso — na primeira data que já tiver horários livres, pare e sugira essa data junto com a próxima data candidata (mesmo sem checá-la ainda, ou checando só mais uma vez); nunca continue testando um terceiro, quarto ou quinto dia só para "ter certeza". Não pergunte apenas "qual data você quer" sem antes tentar sugerir algo.
4. Se o cliente mencionar uma data sem o ano, calcule o ano a partir da data de hoje informada acima: use o ano atual, ou o ano seguinte se essa data já tiver passado neste ano. Sempre chame check_availability com a data resolvida no formato AAAA-MM-DD — mesmo que seja uma data diferente das que você já sugeriu antes. Nunca diga que uma data não está disponível sem antes checar essa data específica com check_availability.
5. Confirme com a pessoa qual horário ela quer, e peça nome e telefone.
6. Só chame create_appointment depois que o cliente tiver informado, na conversa, o nome e o telefone reais dele — nunca antes disso. Se ele confirmar o horário mas não tiver dito nome/telefone ainda, pergunte e espere a resposta antes de chamar a ferramenta.
7. Depois de criar, confirme o agendamento de forma clara (data, horário, serviço, e o nome do profissional quando houver um definido).

Nunca invente serviços, horários ou disponibilidade — sempre use as ferramentas. Nunca invente ou "lembre de cor" o scheduleId/serviceId de mensagens antigas: se você não tiver o resultado de list_services desta própria conversa disponível agora, chame list_services de novo antes de check_availability ou create_appointment — nunca use um ID que você não obteve de uma resposta real da ferramenta. Nunca invente clientName ou clientPhone (ex.: não use valores de preenchimento como "Cliente" ou "Telefone") — use exatamente o nome e o telefone que o cliente escreveu na conversa; se ele não escreveu esses dados ainda, pergunte antes de chamar create_appointment. Se não conseguir ajudar, sugira que a pessoa entre em contato diretamente.

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

  let availabilityChecks = 0

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
      let result: any
      if (toolCall.function.name === 'check_availability') {
        availabilityChecks++
        if (availabilityChecks > MAX_AVAILABILITY_CHECKS) {
          result = { error: 'Já foram verificadas datas suficientes. Pare de chamar check_availability e responda ao cliente agora com as opções que você já obteve.' }
        } else {
          result = await executeTool(toolCall.function.name, input, tenant)
        }
      } else {
        result = await executeTool(toolCall.function.name, input, tenant)
      }
      conversation.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      })
    }
  }

  return { text: 'Desculpe, não consegui concluir sua solicitação agora. Tente novamente ou entre em contato diretamente.', quickReplies: [] }
}
