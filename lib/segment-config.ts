
/**
 * Configuração de terminologia e campos por tipo de segmento
 *
 * Este arquivo define como cada tipo de negócio deve ser apresentado ao usuário,
 * incluindo terminologia específica e campos condicionais.
 */

import type { SegmentType as PrismaSegmentType } from '@prisma/client'

export type SegmentType = PrismaSegmentType

export interface SegmentConfig {
  // Terminologia
  terminology: {
    client: string              // "Paciente" | "Cliente" | "Aluno" | "Tutor"
    clients: string             // "Pacientes" | "Clientes" | "Alunos" | "Tutores"
    appointment: string         // "Consulta" | "Agendamento" | "Aula" | "Atendimento"
    appointments: string        // "Consultas" | "Agendamentos" | "Aulas" | "Atendimentos"
    professional: string        // "Médico" | "Profissional" | "Professor" | "Técnico"
    professionals: string       // "Médicos" | "Profissionais" | "Professores" | "Técnicos"
    service: string            // "Procedimento" | "Serviço" | "Aula" | "Visita"
    services: string           // "Procedimentos" | "Serviços" | "Aulas" | "Visitas"
    schedule: string           // "Agenda" | "Agenda" | "Grade" | "Roteiro"
    schedules: string          // "Agendas" | "Agendas" | "Grades" | "Roteiros"
  }

  // Campos condicionais
  fields: {
    showInsurance: boolean      // Mostrar campo de convênio?
    showSpecialty: boolean      // Mostrar campo de especialidade?
    showModality: boolean       // Mostrar modalidade (presencial/online)?
    showProducts: boolean       // Mostrar campo de produtos utilizados?
    showPetInfo: boolean        // Mostrar informações do pet?
    showAddress: boolean        // Enfatizar endereço do cliente?
    showDepositRequired: boolean // Mostrar campo de sinal/depósito?
  }

  // Placeholders e mensagens personalizadas
  placeholders: {
    clientName: string
    clientPhone: string
    serviceName: string
    scheduleDescription: string
    appointmentNotes: string
  }
}

export const SEGMENT_CONFIGS: Record<SegmentType, SegmentConfig> = {
  BEAUTY_SALON: {
    terminology: {
      client: 'Cliente',
      clients: 'Clientes',
      appointment: 'Agendamento',
      appointments: 'Agendamentos',
      professional: 'Profissional',
      professionals: 'Profissionais',
      service: 'Serviço',
      services: 'Serviços',
      schedule: 'Agenda',
      schedules: 'Agendas',
    },
    fields: {
      showInsurance: false,
      showSpecialty: false,
      showModality: false,
      showProducts: true,
      showPetInfo: false,
      showAddress: false,
      showDepositRequired: true,
    },
    placeholders: {
      clientName: 'Nome completo do cliente',
      clientPhone: '(11) 99999-9999',
      serviceName: 'Ex: Corte Feminino, Coloração, Escova',
      scheduleDescription: 'Descreva os tipos de serviços desta agenda',
      appointmentNotes: 'Preferências de corte, coloração, produtos...',
    },
  },

  BARBERSHOP: {
    terminology: {
      client: 'Cliente',
      clients: 'Clientes',
      appointment: 'Agendamento',
      appointments: 'Agendamentos',
      professional: 'Barbeiro',
      professionals: 'Barbeiros',
      service: 'Serviço',
      services: 'Serviços',
      schedule: 'Agenda',
      schedules: 'Agendas',
    },
    fields: {
      showInsurance: false,
      showSpecialty: false,
      showModality: false,
      showProducts: true,
      showPetInfo: false,
      showAddress: false,
      showDepositRequired: true,
    },
    placeholders: {
      clientName: 'Nome completo do cliente',
      clientPhone: '(11) 99999-9999',
      serviceName: 'Ex: Corte Masculino, Barba, Sobrancelha',
      scheduleDescription: 'Descreva os tipos de serviços desta agenda',
      appointmentNotes: 'Preferências de corte, produtos utilizados...',
    },
  },

  AESTHETIC_CLINIC: {
    terminology: {
      client: 'Paciente',
      clients: 'Pacientes',
      appointment: 'Consulta',
      appointments: 'Consultas',
      professional: 'Profissional',
      professionals: 'Profissionais',
      service: 'Procedimento',
      services: 'Procedimentos',
      schedule: 'Agenda Clínica',
      schedules: 'Agendas Clínicas',
    },
    fields: {
      showInsurance: false,
      showSpecialty: true,
      showModality: false,
      showProducts: true,
      showPetInfo: false,
      showAddress: false,
      showDepositRequired: true,
    },
    placeholders: {
      clientName: 'Nome completo do paciente',
      clientPhone: '(11) 99999-9999',
      serviceName: 'Ex: Limpeza de Pele, Botox, Preenchimento',
      scheduleDescription: 'Descreva os procedimentos oferecidos nesta agenda',
      appointmentNotes: 'Histórico de procedimentos, alergias, cuidados pós...',
    },
  },

  TECH_SAAS: {
    terminology: {
      client: 'Cliente',
      clients: 'Clientes',
      appointment: 'Reunião',
      appointments: 'Reuniões',
      professional: 'Consultor',
      professionals: 'Consultores',
      service: 'Serviço',
      services: 'Serviços',
      schedule: 'Agenda',
      schedules: 'Agendas',
    },
    fields: {
      showInsurance: false,
      showSpecialty: false,
      showModality: true,
      showProducts: false,
      showPetInfo: false,
      showAddress: false,
      showDepositRequired: false,
    },
    placeholders: {
      clientName: 'Nome completo do cliente',
      clientPhone: '(11) 99999-9999',
      serviceName: 'Ex: Onboarding, Suporte Técnico, Demonstração',
      scheduleDescription: 'Descreva os tipos de reunião desta agenda',
      appointmentNotes: 'Pauta da reunião, contexto do cliente...',
    },
  },

  PROFESSIONAL_SERVICES: {
    terminology: {
      client: 'Cliente',
      clients: 'Clientes',
      appointment: 'Reunião',
      appointments: 'Reuniões',
      professional: 'Consultor',
      professionals: 'Consultores',
      service: 'Serviço',
      services: 'Serviços',
      schedule: 'Agenda',
      schedules: 'Agendas',
    },
    fields: {
      showInsurance: false,
      showSpecialty: true,
      showModality: true,
      showProducts: false,
      showPetInfo: false,
      showAddress: false,
      showDepositRequired: false,
    },
    placeholders: {
      clientName: 'Nome completo do cliente',
      clientPhone: '(11) 99999-9999',
      serviceName: 'Ex: Consultoria Financeira, Assessoria Jurídica',
      scheduleDescription: 'Descreva os tipos de serviço desta agenda',
      appointmentNotes: 'Pauta da reunião, documentos necessários...',
    },
  },

  HR: {
    terminology: {
      client: 'Candidato',
      clients: 'Candidatos',
      appointment: 'Entrevista',
      appointments: 'Entrevistas',
      professional: 'Recrutador',
      professionals: 'Recrutadores',
      service: 'Processo',
      services: 'Processos',
      schedule: 'Agenda',
      schedules: 'Agendas',
    },
    fields: {
      showInsurance: false,
      showSpecialty: true,
      showModality: true,
      showProducts: false,
      showPetInfo: false,
      showAddress: false,
      showDepositRequired: false,
    },
    placeholders: {
      clientName: 'Nome completo do candidato',
      clientPhone: '(11) 99999-9999',
      serviceName: 'Ex: Recrutamento, Treinamento, Consultoria de RH',
      scheduleDescription: 'Descreva os tipos de processo desta agenda',
      appointmentNotes: 'Contexto da entrevista, pontos a avaliar...',
    },
  },

  PHYSIOTHERAPY: {
    terminology: {
      client: 'Paciente',
      clients: 'Pacientes',
      appointment: 'Sessão',
      appointments: 'Sessões',
      professional: 'Fisioterapeuta',
      professionals: 'Fisioterapeutas',
      service: 'Procedimento',
      services: 'Procedimentos',
      schedule: 'Agenda',
      schedules: 'Agendas',
    },
    fields: {
      showInsurance: true,
      showSpecialty: true,
      showModality: true,
      showProducts: false,
      showPetInfo: false,
      showAddress: true,
      showDepositRequired: false,
    },
    placeholders: {
      clientName: 'Nome completo do paciente',
      clientPhone: '(11) 99999-9999',
      serviceName: 'Ex: RPG, Pilates Clínico, Reabilitação',
      scheduleDescription: 'Descreva os procedimentos oferecidos nesta agenda',
      appointmentNotes: 'Diagnóstico, evolução do tratamento, restrições...',
    },
  },

  EDUCATION: {
    terminology: {
      client: 'Aluno',
      clients: 'Alunos',
      appointment: 'Aula',
      appointments: 'Aulas',
      professional: 'Professor',
      professionals: 'Professores',
      service: 'Matéria',
      services: 'Matérias',
      schedule: 'Grade Horária',
      schedules: 'Grades Horárias',
    },
    fields: {
      showInsurance: false,
      showSpecialty: false,
      showModality: true,
      showProducts: false,
      showPetInfo: false,
      showAddress: false,
      showDepositRequired: false,
    },
    placeholders: {
      clientName: 'Nome completo do aluno',
      clientPhone: '(11) 99999-9999',
      serviceName: 'Ex: Matemática Ensino Médio, Inglês Conversação',
      scheduleDescription: 'Descreva as matérias disponíveis nesta grade',
      appointmentNotes: 'Tópicos a revisar, objetivos da aula...',
    },
  },

  PET_SHOP: {
    terminology: {
      client: 'Tutor',
      clients: 'Tutores',
      appointment: 'Agendamento',
      appointments: 'Agendamentos',
      professional: 'Profissional',
      professionals: 'Profissionais',
      service: 'Serviço',
      services: 'Serviços',
      schedule: 'Agenda',
      schedules: 'Agendas',
    },
    fields: {
      showInsurance: false,
      showSpecialty: false,
      showModality: false,
      showProducts: true,
      showPetInfo: true,
      showAddress: false,
      showDepositRequired: false,
    },
    placeholders: {
      clientName: 'Nome completo do tutor',
      clientPhone: '(11) 99999-9999',
      serviceName: 'Ex: Banho e Tosa, Vacinação, Hospedagem',
      scheduleDescription: 'Descreva os serviços oferecidos nesta agenda',
      appointmentNotes: 'Nome do pet, espécie, cuidados especiais...',
    },
  },

  OTHER: {
    terminology: {
      client: 'Cliente',
      clients: 'Clientes',
      appointment: 'Agendamento',
      appointments: 'Agendamentos',
      professional: 'Profissional',
      professionals: 'Profissionais',
      service: 'Serviço',
      services: 'Serviços',
      schedule: 'Agenda',
      schedules: 'Agendas',
    },
    fields: {
      showInsurance: false,
      showSpecialty: false,
      showModality: false,
      showProducts: false,
      showPetInfo: false,
      showAddress: false,
      showDepositRequired: false,
    },
    placeholders: {
      clientName: 'Nome completo do cliente',
      clientPhone: '(11) 99999-9999',
      serviceName: 'Ex: Nome do serviço prestado',
      scheduleDescription: 'Descreva os tipos de serviço desta agenda',
      appointmentNotes: 'Observações sobre o atendimento...',
    },
  },
}

/**
 * Retorna a configuração para um determinado tipo de segmento
 */
export function getSegmentConfig(segmentType: SegmentType): SegmentConfig {
  return SEGMENT_CONFIGS[segmentType] || SEGMENT_CONFIGS.BEAUTY_SALON
}

/**
 * Retorna lista de todos os tipos de segmento disponíveis
 */
export function getAvailableSegments(): Array<{ value: SegmentType; label: string; description: string }> {
  return [
    {
      value: 'BEAUTY_SALON',
      label: 'Salão de Beleza',
      description: 'Salões de beleza e estética',
    },
    {
      value: 'BARBERSHOP',
      label: 'Barbearia',
      description: 'Barbearias e barbeiros',
    },
    {
      value: 'AESTHETIC_CLINIC',
      label: 'Clínica de Estética',
      description: 'Clínicas de estética e procedimentos estéticos',
    },
    {
      value: 'TECH_SAAS',
      label: 'Tecnologia',
      description: 'Empresas de tecnologia e software',
    },
    {
      value: 'PROFESSIONAL_SERVICES',
      label: 'Consultoria',
      description: 'Serviços profissionais e consultoria',
    },
    {
      value: 'HR',
      label: 'Recursos Humanos',
      description: 'Consultoria e serviços de RH',
    },
    {
      value: 'PHYSIOTHERAPY',
      label: 'Fisioterapia',
      description: 'Clínicas e consultórios de fisioterapia',
    },
    {
      value: 'EDUCATION',
      label: 'Educação',
      description: 'Professores particulares e cursos',
    },
    {
      value: 'PET_SHOP',
      label: 'Pet Shop',
      description: 'Pet shops e serviços para animais',
    },
    {
      value: 'OTHER',
      label: 'Outros',
      description: 'Outros tipos de negócio',
    },
  ]
}
