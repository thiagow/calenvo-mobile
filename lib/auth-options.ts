
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import { normalizeEmail } from './utils'

const REMEMBER_ME_MAX_AGE = 30 * 24 * 60 * 60 // 30 dias
const SESSION_MAX_AGE = 24 * 60 * 60 // 1 dia, quando "manter sessão" não é marcado

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false
      }
    }
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        rememberMe: { label: 'Remember me', type: 'text' }
      },
      async authorize(credentials) {
        console.log('🔐 Auth: authorize called')
        console.log('📧 Credentials email:', credentials?.email)

        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Auth: Missing credentials')
          return null
        }

        console.log('🔍 Auth: Looking for user in database...')
        // Email não é único (constraint é email+role): um MASTER e o seu clone
        // "self professional" (criado em app/api/stripe/webhook/route.ts) compartilham
        // o mesmo email/senha. Buscamos todas as linhas e priorizamos explicitamente
        // SAAS_ADMIN > MASTER > PROFESSIONAL, em vez de depender da ordem arbitrária
        // que findFirst retornaria sem orderBy.
        // Comparação case-insensitive: autocapitalize de teclado mobile e autofill
        // podem mudar a grafia do email digitado em relação ao salvo.
        const candidates = await prisma.user.findMany({
          where: {
            email: { equals: normalizeEmail(credentials.email), mode: 'insensitive' },
            OR: [
              { role: 'SAAS_ADMIN' },
              { AND: [{ role: { in: ['MASTER', 'PROFESSIONAL'] } }, { isActive: true }] }
            ]
          }
        })

        const rolePriority: Record<string, number> = { SAAS_ADMIN: 0, MASTER: 1, PROFESSIONAL: 2 }
        const user = candidates.sort((a, b) => rolePriority[a.role] - rolePriority[b.role])[0]

        if (!user) {
          console.log('❌ Auth: User not found')
          return null
        }

        console.log('✅ Auth: User found:', user.email, '| Role:', user.role)
        console.log('🔒 Auth: Comparing passwords...')
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

        if (!isPasswordValid) {
          console.log('❌ Auth: Invalid password')
          return null
        }

        console.log('✅ Auth: Password valid, returning user')
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessName: user.businessName,
          segmentTypes: user.segmentTypes,
          planType: user.planType,
          masterId: user.masterId,
          rememberMe: credentials.rememberMe !== 'false'
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    // Add custom encode/decode to handle errors gracefully
    async encode(params) {
      // Use default encoding, mas com duração dependente de "manter sessão" (rememberMe)
      const { encode } = await import('next-auth/jwt')
      const maxAge = params.token?.rememberMe === false ? SESSION_MAX_AGE : REMEMBER_ME_MAX_AGE
      return encode({ ...params, maxAge })
    },
    async decode(params) {
      try {
        // Try to decode normally
        const { decode } = await import('next-auth/jwt')
        return await decode(params)
      } catch (error) {
        // If decoding fails (corrupted token), return null
        // This will force NextAuth to create a new session
        console.error('🚨 JWT decode error - clearing corrupted token:', error)
        return null
      }
    }
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      try {
        if (user) {
          console.log('💾 JWT callback: Storing user data in token')
          token.id = user.id
          token.role = (user as any).role
          token.planType = (user as any).planType
          token.businessName = (user as any).businessName
          token.segmentTypes = (user as any).segmentTypes
          token.masterId = (user as any).masterId
          token.rememberMe = (user as any).rememberMe ?? true
        }

        // Invalida sessões emitidas antes da senha ter sido trocada (ex.: via "esqueci senha").
        // Só se aplica a tokens já existentes (iat presente) — um login recém-feito nunca é stale.
        if (token.id && typeof token.iat === 'number') {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { passwordChangedAt: true }
          })

          if (dbUser?.passwordChangedAt && dbUser.passwordChangedAt.getTime() / 1000 > token.iat) {
            console.log('🚫 JWT callback: token anterior à troca de senha, forçando logout')
            return null as any
          }
        }

        return token
      } catch (error) {
        console.error('❌ JWT callback error:', error)
        // Preserva o token existente (role/planType/etc.) em vez de descartá-lo —
        // uma falha transitória na checagem de passwordChangedAt não deve degradar
        // uma sessão que já era válida.
        return token
      }
    },
    async session({ session, token }) {
      try {
        if (token && session?.user) {
          console.log('🔄 Session callback: Creating session from token')
            // Use token.id first, fallback to token.sub
            ; (session.user as any).id = token.id || token.sub!
            ; (session.user as any).role = token.role
            ; (session.user as any).planType = token.planType
            ; (session.user as any).businessName = token.businessName
            ; (session.user as any).segmentTypes = token.segmentTypes
            ; (session.user as any).masterId = token.masterId
        }
        return session
      } catch (error) {
        console.error('❌ Session callback error:', error)
        // Return a minimal valid session
        return session
      }
    }
  },
  pages: {
    signIn: '/login',
    error: '/clear-session'  // Redirect to clear-session on any auth error
  },
  events: {
    async signOut() {
      console.log('👋 User signed out')
    },
    async session({ session }) {
      console.log('📊 Session accessed:', session?.user?.email)
    }
  }
}
