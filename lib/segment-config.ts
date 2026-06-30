
/**
 * Configuração de terminologia e campos por tipo de segmento
 * 
 * Este arquivo define como cada tipo de negócio deve ser apresentado ao usuário,
 * incluindo terminologia específica e campos condicionais.
 */

export type SegmentType = 
  | 'MEDICAL_CLINIC'
  | 'BEAUTY_SALON'
  | 'MAINTENANCE_SERVICE'
  | 'EDUCATION'
  | 'VETERINARY_CLINIC'

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
  MEDICAL_CLINIC: {
    terminology: {
      client: 'Paciente',
      clients: 'Pacientes',
      appointment: 'Consulta',
      appointments: 'Consultas',
      professional: 'Médico',
      professionals: 'Médicos',
      service: 'Procedimento',
      services: 'Procedimentos',
      schedule: 'Agenda Médica',
      schedules: 'Agendas Médicas',
    },
    fields: {
      showInsurance: true,
      showSpecialty: true,
      showModality: true,
      showProducts: false,
      showPetInfo: false,
      showAddress: false,
      showDepositRequired: false,
    },
    placeholders: {
      clientName: 'Nome completo do paciente',
      clientPhone: '(11) 99999-9999',
      serviceName: 'Ex: Consulta Cardiologia, Exame de Sangue',
      scheduleDescription: 'Descreva a especialidade médica desta agenda',
      appointmentNotes: 'Sintomas, medicamentos em uso, alergias...',
    },
  },
  
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
      serviceName: 'Ex: Corte Masculino, Coloração, Escova',
      scheduleDescription: 'Descreva os tipos de serviços desta agenda',
      appointmentNotes: 'Preferências de corte, coloração, produtos...',
    },
  },
  
  MAINTENANCE_SERVICE: {
    terminology: {
      client: 'Cliente',
      clients: 'Clientes',
      appointment: 'Atendimento',
      appointments: 'Atendimentos',
      professional: 'Técnico',
      professionals: 'Técnicos',
      service: 'Serviço',
      services: 'Serviços',
      schedule: 'Roteiro',
      schedules: 'Roteiros',
    },
    fields: {
      showInsurance: false,
      showSpecialty: false,
      showModality: false,
      showProducts: true,
      showPetInfo: false,
      showAddress: true,
      showDepositRequired: true,
    },
    placeholders: {
      clientName: 'Nome completo do cliente',
      clientPhone: '(11) 99999-9999',
      serviceName: 'Ex: Manutenção de Ar Condicionado, Reparo Elétrico',
      scheduleDescription: 'Descreva os tipos de serviço de manutenção',
      appointmentNotes: 'Descrição do problema, endereço completo...',
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
  
  VETERINARY_CLINIC: {
    terminology: {
      client: 'Tutor',
      clients: 'Tutores',
      appointment: 'Consulta',
      appointments: 'Consultas',
      professional: 'Veterinário',
      professionals: 'Veterinários',
      service: 'Procedimento',
      services: 'Procedimentos',
      schedule: 'Agenda Veterinária',
      schedules: 'Agendas Veterinárias',
    },
    fields: {
      showInsurance: true,
      showSpecialty: true,
      showModality: false,
      showProducts: true,
      showPetInfo: true,
      showAddress: false,
      showDepositRequired: false,
    },
    placeholders: {
      clientName: 'Nome completo do tutor',
      clientPhone: '(11) 99999-9999',
      serviceName: 'Ex: Consulta Geral, Vacinação, Banho e Tosa',
      scheduleDescription: 'Descreva os serviços veterinários desta agenda',
      appointmentNotes: 'Nome do pet, espécie, sintomas observados...',
    },
  },
}

/**
 * Retorna a configuração para um determinado tipo de segmento
 */
export function getSegmentConfig(segmentType: SegmentType): SegmentConfig {
  return SEGMENT_CONFIGS[segmentType] || SEGMENT_CONFIGS.MEDICAL_CLINIC
}

/**
 * Retorna lista de todos os tipos de segmento disponíveis
 */
export function getAvailableSegments(): Array<{ value: SegmentType; label: string; description: string }> {
  return [
    {
      value: 'MEDICAL_CLINIC',
      label: 'Clínica Médica',
      description: 'Consultórios médicos, clínicas e hospitais',
    },
    {
      value: 'BEAUTY_SALON',
      label: 'Salão de Beleza / Barbearia',
      description: 'Salões de beleza, barbearias e estética',
    },
    {
      value: 'MAINTENANCE_SERVICE',
      label: 'Manutenção / Visita Domiciliar',
      description: 'Serviços de manutenção, instalação e reparos',
    },
    {
      value: 'EDUCATION',
      label: 'Educação / Aulas Particulares',
      description: 'Professores particulares e cursos',
    },
    {
      value: 'VETERINARY_CLINIC',
      label: 'Clínica Veterinária',
      description: 'Clínicas veterinárias e pet shops',
    },
  ]
}
