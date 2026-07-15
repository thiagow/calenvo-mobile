
import { PlanType, AppointmentStatus, ModalityType, SegmentType } from '@prisma/client'

export type Currency = 'BRL' | 'USD'

export interface PlanConfig {
  name: string
  monthlyLimit: number
  userLimit: number
  priceMonthly: number // BRL
  priceAnnual: number // BRL — preço mensal equivalente quando cobrado anualmente
  priceMonthlyUSD: number
  priceAnnualUSD: number // preço mensal equivalente quando cobrado anualmente
  features: string[]
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  BASICO: {
    name: 'Básico',
    monthlyLimit: 150,
    userLimit: 2,
    priceMonthly: 19.90,
    priceAnnual: 15.92,
    priceMonthlyUSD: 9.90,
    priceAnnualUSD: 7.92,
    features: [
      'Até 2 profissionais',
      '150 agendamentos/mês',
      'Notificações por e-mail',
      'Link de agendamento próprio',
      'Suporte por chat'
    ]
  },
  PRO: {
    name: 'PRO',
    monthlyLimit: -1, // Ilimitado
    userLimit: 8,
    priceMonthly: 39.90,
    priceAnnual: 31.93,
    priceMonthlyUSD: 19.90,
    priceAnnualUSD: 15.93,
    features: [
      'Tudo do Básico',
      'Até 8 profissionais',
      'WhatsApp + SMS + E-mail ilimitados',
      'Programa de fidelidade completo',
      'Relatórios e métricas avançadas',
      'Suporte prioritário'
    ]
  },
  BUSINESS: {
    name: 'Avançado',
    monthlyLimit: -1, // Ilimitado
    userLimit: -1, // Ilimitado
    priceMonthly: 69.90,
    priceAnnual: 55.93,
    priceMonthlyUSD: 29.90,
    priceAnnualUSD: 23.92,
    features: [
      'Tudo do Pro',
      'Profissionais ilimitados',
      'Múltiplas unidades',
      'API e integrações avançadas',
      'Account manager dedicado',
      'SLA garantido'
    ]
  }
}

export function getPlanPrice(planType: PlanType, interval: 'MONTHLY' | 'ANNUAL', currency: Currency): number {
  const config = PLAN_CONFIGS[planType]
  if (currency === 'USD') {
    return interval === 'ANNUAL' ? config.priceAnnualUSD : config.priceMonthlyUSD
  }
  return interval === 'ANNUAL' ? config.priceAnnual : config.priceMonthly
}

export interface AppointmentFilters {
  status?: AppointmentStatus[]
  modality?: ModalityType
  specialty?: string
  dateFrom?: Date
  dateTo?: Date
}

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  patientName: string
  status: AppointmentStatus
  modality: ModalityType
  specialty?: string
  insurance?: string
}

export interface DashboardStats {
  todayAppointments: number
  weekAppointments: number
  monthAppointments: number
  totalClients: number
  pendingAppointments: number
  completedAppointments: number
}

// Configurações por segmento
export const SEGMENT_CONFIGS = {
  [SegmentType.BEAUTY_SALON]: {
    name: 'Salão de Beleza',
    icon: '💇',
    clientLabel: 'Cliente',
    clientsLabel: 'Clientes'
  },
  [SegmentType.BARBERSHOP]: {
    name: 'Barbearia',
    icon: '✂️',
    clientLabel: 'Cliente',
    clientsLabel: 'Clientes'
  },
  [SegmentType.AESTHETIC_CLINIC]: {
    name: 'Clínica de Estética',
    icon: '✨',
    clientLabel: 'Cliente',
    clientsLabel: 'Clientes'
  },
  [SegmentType.TECH_SAAS]: {
    name: 'Tecnologia e SaaS',
    icon: '💻',
    clientLabel: 'Cliente',
    clientsLabel: 'Clientes'
  },
  [SegmentType.PROFESSIONAL_SERVICES]: {
    name: 'Consultoria e Mentoria',
    icon: '🎯',
    clientLabel: 'Cliente',
    clientsLabel: 'Clientes'
  },
  [SegmentType.HR]: {
    name: 'Recursos Humanos',
    icon: '👥',
    clientLabel: 'Candidato',
    clientsLabel: 'Candidatos'
  },
  [SegmentType.PHYSIOTHERAPY]: {
    name: 'Fisioterapia',
    icon: '🏥',
    clientLabel: 'Paciente',
    clientsLabel: 'Pacientes'
  },
  [SegmentType.EDUCATION]: {
    name: 'Aulas e Educação',
    icon: '📚',
    clientLabel: 'Aluno',
    clientsLabel: 'Alunos'
  },
  [SegmentType.PET_SHOP]: {
    name: 'Pet Shop',
    icon: '🐾',
    clientLabel: 'Tutor',
    clientsLabel: 'Tutores'
  },
  [SegmentType.OTHER]: {
    name: 'Outros',
    icon: '🔧',
    clientLabel: 'Cliente',
    clientsLabel: 'Clientes'
  }
}

// Segmentos disponíveis para o usuário escolher
export const AVAILABLE_SEGMENTS = [
  { value: 'BEAUTY_SALON', label: 'Salão de Beleza', icon: '💇' },
  { value: 'BARBERSHOP', label: 'Barbearia', icon: '✂️' },
  { value: 'AESTHETIC_CLINIC', label: 'Clínica de Estética', icon: '✨' },
  { value: 'PHYSIOTHERAPY', label: 'Fisioterapia', icon: '🏥' },
  { value: 'EDUCATION', label: 'Educação', icon: '📚' },
  { value: 'PET_SHOP', label: 'Pet Shop', icon: '🐾' },
  { value: 'PROFESSIONAL_SERVICES', label: 'Consultoria', icon: '🎯' },
  { value: 'TECH_SAAS', label: 'Tecnologia', icon: '💻' },
  { value: 'OTHER', label: 'Outros', icon: '🔧' }
]

export const APPOINTMENT_DURATIONS = [
  { label: '15 minutos', value: 15 },
  { label: '30 minutos', value: 30 },
  { label: '45 minutos', value: 45 },
  { label: '60 minutos', value: 60 },
  { label: '90 minutos', value: 90 },
  { label: '120 minutos', value: 120 }
]

// Status colors for UI
export const STATUS_COLORS = {
  [AppointmentStatus.SCHEDULED]: 'bg-blue-100 text-blue-800',
  [AppointmentStatus.CONFIRMED]: 'bg-green-100 text-green-800',
  [AppointmentStatus.IN_PROGRESS]: 'bg-yellow-100 text-yellow-800',
  [AppointmentStatus.COMPLETED]: 'bg-gray-100 text-gray-800',
  [AppointmentStatus.CANCELLED]: 'bg-red-100 text-red-800',
  [AppointmentStatus.NO_SHOW]: 'bg-purple-100 text-purple-800'
}

export const STATUS_LABELS = {
  [AppointmentStatus.SCHEDULED]: 'Agendado',
  [AppointmentStatus.CONFIRMED]: 'Confirmado',
  [AppointmentStatus.IN_PROGRESS]: 'Em andamento',
  [AppointmentStatus.COMPLETED]: 'Concluído',
  [AppointmentStatus.CANCELLED]: 'Cancelado',
  [AppointmentStatus.NO_SHOW]: 'Faltou'
}

export const MODALITY_LABELS = {
  [ModalityType.PRESENCIAL]: 'Presencial',
  [ModalityType.TELECONSULTA]: 'Teleconsulta'
}
