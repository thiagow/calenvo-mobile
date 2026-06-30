
import { PlanType, AppointmentStatus, ModalityType, SegmentType } from '@prisma/client'

export interface PlanConfig {
  name: string
  monthlyLimit: number
  userLimit: number
  price: number
  priceId: string // Stripe Price ID
  features: string[]
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  FREEMIUM: {
    name: 'Freemium',
    monthlyLimit: 60,
    userLimit: 1,
    price: 0,
    priceId: '',
    features: [
      '60 agendamentos por mês',
      '1 usuário',
      'Agenda básica',
      'Cadastro de clientes',
      'Notificações internas',
      'Suporte por email'
    ]
  },
  STANDARD: {
    name: 'Standard',
    monthlyLimit: 180,
    userLimit: 3,
    price: 49.90,
    priceId: 'price_1SmKgHEe8DKEFqGiJwa9jy4T', // Stripe Price ID do plano Standard
    features: [
      '180 agendamentos por mês',
      '3 usuários',
      'Agenda completa',
      'Teleconsulta',
      'Notificações internas',
      'Notificações WhatsApp',
      'Relatórios básicos',
      'Suporte prioritário'
    ]
  },
  PREMIUM: {
    name: 'Premium',
    monthlyLimit: -1, // Ilimitado
    userLimit: 15,
    price: 99.90,
    priceId: 'price_premium', // Será configurado no Stripe
    features: [
      'Agendamentos ilimitados',
      'Até 15 usuários',
      'Todas as funcionalidades',
      'Multiempresa',
      'Notificações internas',
      'Notificações WhatsApp',
      'Relatórios avançados',
      'API personalizada'
    ]
  }
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
  totalPatients: number
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
  { value: 'DENTISTRY', label: 'Odontologia', icon: '🦷' },
  { value: 'PHYSIOTHERAPY', label: 'Fisioterapia', icon: '🏥' },
  { value: 'NUTRITION', label: 'Nutrição', icon: '🥗' },
  { value: 'THERAPY_CLINIC', label: 'Clínicas de Terapias', icon: '🧘' },
  { value: 'PET_SHOP', label: 'Pet Shop', icon: '🐾' },
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
