
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUserPermissions } from '@/hooks/use-user-permissions'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermission: keyof ReturnType<typeof useUserPermissions>
  redirectTo?: string
}

/**
 * Componente para proteger rotas baseado em permissões
 * 
 * @example
 * <ProtectedRoute requiredPermission="canManageProfessionals">
 *   <ProfessionalsPage />
 * </ProtectedRoute>
 */
export function ProtectedRoute({ 
  children, 
  requiredPermission,
  redirectTo = '/dashboard'
}: ProtectedRouteProps) {
  const router = useRouter()
  const permissions = useUserPermissions()
  
  const hasPermission = permissions[requiredPermission]

  useEffect(() => {
    if (!hasPermission) {
      router.push(redirectTo)
    }
  }, [hasPermission, redirectTo, router])

  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    )
  }

  return <>{children}</>
}
