/**
 * Templates de mensagem parametrizáveis (hoje: lembrete de retorno).
 *
 * Módulo puro — sem Prisma, sem I/O — porque é importado tanto pelo servidor
 * (validação e envio) quanto pelo client (editor com prévia ao vivo). A lista
 * de variáveis vive SÓ aqui: validação, prévia e envio leem da mesma fonte.
 */

export interface TemplateVariable {
  key: string
  description: string
  example: string
}

export const REACTIVATION_VARIABLES: TemplateVariable[] = [
  { key: 'nome_cliente', description: 'Nome completo do cliente', example: 'Ana Souza' },
  { key: 'primeiro_nome', description: 'Primeiro nome do cliente', example: 'Ana' },
  { key: 'servico', description: 'Serviço que está para retornar', example: 'Limpeza de pele' },
  { key: 'ultimo_atendimento', description: 'Data do último atendimento', example: '12/08/2026' },
  { key: 'dias_desde_ultimo', description: 'Dias desde o último atendimento', example: '45' },
  { key: 'dias_atraso', description: 'Dias de atraso em relação ao retorno previsto (0 se ainda não venceu)', example: '15' },
  { key: 'profissional', description: 'Profissional do último atendimento', example: 'Carla' },
  { key: 'empresa', description: 'Nome do seu negócio', example: 'Minha Empresa' },
  { key: 'link_agendamento', description: 'Link da sua página de agendamento', example: 'https://calenvo.app/booking/minha-empresa' },
]

export type ReactivationVars = Record<(typeof REACTIVATION_VARIABLES)[number]['key'], string>

export const TEMPLATE_NAME_MAX = 60
export const TEMPLATE_BODY_MAX = 1000

export const DEFAULT_REACTIVATION_TEMPLATES: { name: string; body: string; isDefault: boolean }[] = [
  {
    name: 'Lembrete de retorno',
    body: 'Olá {{primeiro_nome}}! Já faz {{dias_desde_ultimo}} dias desde seu último {{servico}} com a {{empresa}}. Que tal agendar seu retorno? {{link_agendamento}}',
    isDefault: true,
  },
  {
    name: 'Sentimos sua falta',
    body: 'Oi {{primeiro_nome}}, tudo bem? Faz um tempo que você não vem fazer {{servico}} aqui na {{empresa}}. Separamos horários pra você: {{link_agendamento}}',
    isDefault: false,
  },
]

/** Usada quando o tenant não tem nenhum template salvo. */
export const SYSTEM_REACTIVATION_BODY = DEFAULT_REACTIVATION_TEMPLATES[0].body

const VARIABLE_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/g
const KNOWN_KEYS = new Set(REACTIVATION_VARIABLES.map(v => v.key))

/** Variáveis usadas no texto que não existem (ex.: `{{nomee}}`), sem repetição. */
export function findUnknownVariables(body: string): string[] {
  const unknown = new Set<string>()
  for (const match of body.matchAll(VARIABLE_PATTERN)) {
    if (!KNOWN_KEYS.has(match[1])) unknown.add(match[1])
  }
  return Array.from(unknown)
}

/** Substitui as variáveis conhecidas; desconhecidas ficam como estão (a validação já barrou no salvar). */
export function renderTemplate(body: string, vars: Partial<ReactivationVars>): string {
  return body
    .replace(VARIABLE_PATTERN, (whole, key: string) => {
      if (!KNOWN_KEYS.has(key)) return whole
      return vars[key] ?? ''
    })
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export const EXAMPLE_REACTIVATION_VARS: ReactivationVars = Object.fromEntries(
  REACTIVATION_VARIABLES.map(v => [v.key, v.example])
) as ReactivationVars

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}

export interface TemplateRef {
  id: string
  body: string
  isDefault: boolean
}

/**
 * Ordem de escolha do template, por item: o forçado no envio → o do serviço →
 * o padrão do tenant → o texto padrão do sistema. Compartilhada entre a
 * prévia (navegador) e o envio (servidor), para a prévia ser exatamente o que sai.
 */
export function pickTemplate(
  item: { reactivationTemplateId: string | null },
  templates: TemplateRef[],
  forcedTemplateId?: string | null
): { templateId: string | null; body: string } {
  const byId = (id: string | null | undefined) => (id ? templates.find(t => t.id === id) : undefined)
  const chosen = byId(forcedTemplateId) ?? byId(item.reactivationTemplateId) ?? templates.find(t => t.isDefault)
  return chosen ? { templateId: chosen.id, body: chosen.body } : { templateId: null, body: SYSTEM_REACTIVATION_BODY }
}

function formatDateBr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export function buildReactivationVars(
  item: {
    clientName: string
    serviceName: string
    lastDate: string
    daysSinceLast: number
    daysOverdue: number
    professionalName: string | null
  },
  businessName: string,
  bookingLink: string
): ReactivationVars {
  return {
    nome_cliente: item.clientName,
    primeiro_nome: firstName(item.clientName),
    servico: item.serviceName,
    ultimo_atendimento: formatDateBr(item.lastDate),
    dias_desde_ultimo: String(item.daysSinceLast),
    dias_atraso: String(item.daysOverdue),
    profissional: item.professionalName || '',
    empresa: businessName,
    link_agendamento: bookingLink,
  }
}
