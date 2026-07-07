
// Configuração de limites por plano
// IMPORTANTE: O profissional master (criado automaticamente com a conta) já está incluído nos limites
// BASICO: 2 profissionais (master + 1 adicional)
// PRO: 8 profissionais (master + 7 adicionais)
// BUSINESS: Ilimitado
export const PLAN_LIMITS = {
  BASICO: {
    maxProfessionals: 2,
    maxAppointmentsPerMonth: 150,
    maxSchedules: 2,
    maxServices: 10,
  },
  PRO: {
    maxProfessionals: 8,
    maxAppointmentsPerMonth: -1, // Ilimitado
    maxSchedules: 8,
    maxServices: 50,
  },
  BUSINESS: {
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

  // currentCount já inclui o profissional master, então comparamos diretamente
  return (currentCount + 1) <= limits.maxProfessionals
}

export function allowsMultipleProfessionals(planType: string): boolean {
  const limits = PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS]
  if (!limits) return false

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
