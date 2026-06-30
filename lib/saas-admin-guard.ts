import { getServerSession } from 'next-auth'
import { authOptions } from './auth-options'

/**
 * Guard para proteger rotas de API que requerem SAAS_ADMIN
 * Lança erro 401 se não autenticado ou 403 se não for SAAS_ADMIN
 */
export async function requireSaasAdmin() {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        throw new Error('UNAUTHORIZED')
    }

    const userRole = (session.user as any).role

    if (userRole !== 'SAAS_ADMIN') {
        throw new Error('FORBIDDEN')
    }

    return session
}
