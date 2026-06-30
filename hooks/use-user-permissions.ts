
'use client'

import { useUserRole } from './use-user-role'

export interface UserPermissions {
  // Gestão de profissionais
  canManageProfessionals: boolean
  canViewProfessionals: boolean
  
  // Gestão de serviços e agendas
  canManageServices: boolean
  canManageSchedules: boolean
  
  // Gestão de planos
  canManagePlans: boolean
  canViewPlans: boolean
  
  // Configurações
  canManageSettings: boolean
  canViewPublicUrl: boolean
  
  // Clientes
  canViewAllClients: boolean
  canViewOwnClients: boolean
  
  // Agendamentos
  canViewAllAppointments: boolean
  canViewOwnAppointments: boolean
  
  // Relatórios
  canViewFullReports: boolean
  canViewOwnReports: boolean
  
  // Perfil
  canManageOwnProfile: boolean
  
  // Notificações
  canViewNotifications: boolean
}

/**
 * Hook para verificar permissões do usuário com base no role
 * 
 * @returns {UserPermissions} Objeto com todas as permissões do usuário
 * 
 * @example
 * const { canManageProfessionals, canViewOwnAppointments } = useUserPermissions()
 * 
 * {canManageProfessionals && (
 *   <Button>Adicionar Profissional</Button>
 * )}
 */
export function useUserPermissions(): UserPermissions {
  const { isMaster, isProfessional } = useUserRole()
  
  return {
    // MASTER tem acesso total, PROFESSIONAL tem acesso limitado
    canManageProfessionals: isMaster,
    canViewProfessionals: isMaster,
    
    canManageServices: isMaster,
    canManageSchedules: isMaster,
    
    canManagePlans: isMaster,
    canViewPlans: isMaster,
    
    canManageSettings: isMaster,
    canViewPublicUrl: true, // Ambos podem ver
    
    canViewAllClients: isMaster,
    canViewOwnClients: isProfessional,
    
    canViewAllAppointments: isMaster,
    canViewOwnAppointments: true, // Ambos podem ver seus próprios
    
    canViewFullReports: isMaster,
    canViewOwnReports: isProfessional,
    
    canManageOwnProfile: true, // Ambos podem gerenciar seu perfil
    
    canViewNotifications: isMaster, // Apenas MASTER pode configurar notificações
  }
}
