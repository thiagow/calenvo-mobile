
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json({
        status: 'not_authenticated',
        message: 'Você não está autenticado',
        session: null
      })
    }

    const userId = (session.user as any).id
    
    // Try to find user in database
    let userInDb = null
    if (userId) {
      try {
        userInDb = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true
          }
        })
      } catch (error) {
        // User not found
      }
    }
    
    return NextResponse.json({
      status: 'authenticated',
      session: {
        user: {
          id: userId,
          email: session.user.email,
          name: session.user.name,
          ...session.user
        }
      },
      userInDatabase: userInDb ? {
        found: true,
        ...userInDb
      } : {
        found: false,
        message: userId ? 'Usuário não encontrado no banco de dados' : 'ID de usuário não encontrado na sessão'
      },
      recommendation: !userId 
        ? '⚠️ Sua sessão está desatualizada. Por favor, faça LOGOUT e LOGIN novamente.' 
        : userInDb 
          ? '✅ Sua sessão está válida' 
          : '⚠️ Usuário não existe no banco de dados. Faça LOGOUT e LOGIN novamente.'
    })
  } catch (error) {
    console.error('Error checking session:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
