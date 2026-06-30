
// Configuração de limites por plano
// IMPORTANTE: O profissional master (criado automaticamente com a conta) já está incluído nos limites
// FREE: 1 profissional (apenas o master, não pode criar novos)
// STANDARD: 5 profissionais (master + 4 adicionais)
// PREMIUM: Ilimitado
export const PLAN_LIMITS = {
  FREEMIUM: {
    maxProfessionals: 1, // Apenas o profissional master (não pode adicionar novos)
    maxAppointmentsPerMonth: 60,
    maxSchedules: 1,
    maxServices: 5,
  },
  STANDARD: {
    maxProfessionals: 5, // Profissional master + 4 adicionais
    maxAppointmentsPerMonth: 180,
    maxSchedules: 5,
    maxServices: 20,
  },
  PREMIUM: {
    maxProfessionals: -1, // Ilimitado
    maxAppointmentsPerMonth: -1, // Ilimitado
    maxSchedules: -1, // Ilimitado
    maxServices: -1, // Ilimitado
  }
}

export function canAddProfessional(planType: string, currentCount: number): boolean {
  const limits = PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS]
  if (!limits) return false
  
  // -1 significa ilimitado
  if (limits.maxProfessionals === -1) return true
  
  // Para plano FREE, não permite adicionar novos profissionais
  // (currentCount já inclui o profissional master)
  if (planType === 'FREEMIUM') {
    return false // FREE não permite criar novos profissionais
  }
  
  // Para outros planos: verifica se ainda tem espaço
  // currentCount já inclui o profissional master, então comparamos diretamente
  return (currentCount + 1) <= limits.maxProfessionals
}

export function allowsMultipleProfessionals(planType: string): boolean {
  const limits = PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS]
  if (!limits) return false
  
  // FREE não permite múltiplos profissionais (apenas o master)
  if (planType === 'FREEMIUM') return false
  
  // Permite múltiplos se o limite for maior que 1 ou ilimitado (-1)
  return limits.maxProfessionals > 1 || limits.maxProfessionals === -1
}

export function getProfessionalLimit(planType: string): number {
  const limits = PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS]
  if (!limits) return 1
  
  return limits.maxProfessionals
}

export function getRemainingProfessionalSlots(planType: string, currentCount: number): number {
  const limits = PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS]
  if (!limits) return 0
  
  // -1 significa ilimitado
  if (limits.maxProfessionals === -1) return 999
  
  // Para FREE, sempre 0 (não pode adicionar mais)
  if (planType === 'FREEMIUM') return 0
  
  // Calcular slots restantes
  return Math.max(0, limits.maxProfessionals - currentCount)
}

// ============= CONTROLE DE AGENDAMENTOS =============

export function getAppointmentLimit(planType: string): number {
  const limits = PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS]
  if (!limits) return 0
  
  return limits.maxAppointmentsPerMonth
}

export function canCreateAppointment(planType: string, currentMonthCount: number): boolean {
  const limits = PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS]
  if (!limits) return false
  
  // -1 significa ilimitado
  if (limits.maxAppointmentsPerMonth === -1) return true
  
  // Verifica se ainda está dentro do limite
  return currentMonthCount < limits.maxAppointmentsPerMonth
}

export function getRemainingAppointments(planType: string, currentMonthCount: number): number {
  const limits = PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS]
  if (!limits) return 0
  
  // -1 significa ilimitado
  if (limits.maxAppointmentsPerMonth === -1) return 999
  
  // Calcular agendamentos restantes
  return Math.max(0, limits.maxAppointmentsPerMonth - currentMonthCount)
}

export function shouldNotifyLimitApproaching(planType: string, currentMonthCount: number): boolean {
  const remaining = getRemainingAppointments(planType, currentMonthCount)
  
  // Notificar quando restarem exatamente 5 agendamentos
  // (não notifica se for ilimitado ou se já passou do limite)
  return remaining === 5
}
