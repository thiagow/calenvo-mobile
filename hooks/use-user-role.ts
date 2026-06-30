
'use client'

import { useSession } from 'next-auth/react'

export type UserRole = 'MASTER' | 'PROFESSIONAL' | 'SAAS_ADMIN'

export interface UserRoleData {
  role: UserRole
  isMaster: boolean
  isProfessional: boolean
  isSaasAdmin: boolean
  isLoading: boolean
}

/**
 * Hook para verificar o role do usuário logado
 * 
 * @returns {UserRoleData} Informações sobre o role do usuário
 * 
 * @example
 * const { isMaster, isProfessional } = useUserRole()
 * 
 * if (isMaster) {
 *   // Mostrar funcionalidades administrativas
 * }
 */
export function useUserRole(): UserRoleData {
  const { data: session, status } = useSession()

  const role = (session?.user as any)?.role as UserRole || 'MASTER'
  const isLoading = status === 'loading'

  return {
    role,
    isMaster: role === 'MASTER',
    isProfessional: role === 'PROFESSIONAL',
    isSaasAdmin: role === 'SAAS_ADMIN',
    isLoading
  }
}
