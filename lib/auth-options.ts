
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from './db'

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
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        console.log('🔐 Auth: authorize called')
        console.log('📧 Credentials email:', credentials?.email)

        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Auth: Missing credentials')
          return null
        }

        console.log('🔍 Auth: Looking for user in database...')
        // Use findFirst since email is no longer unique (we have email_role unique constraint)
        // Allow MASTER, PROFESSIONAL, and SAAS_ADMIN users to login
        const user = await prisma.user.findFirst({
          where: {
            email: credentials.email,
            // SAAS_ADMIN can login even if inactive
            OR: [
              { role: 'SAAS_ADMIN' },
              { AND: [{ role: { in: ['MASTER', 'PROFESSIONAL'] } }, { isActive: true }] }
            ]
          }
        })

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
          segmentType: user.segmentType,
          planType: user.planType,
          masterId: user.masterId
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
      // Use default encoding
      const { encode } = await import('next-auth/jwt')
      return encode(params)
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
          token.segmentType = (user as any).segmentType
          token.masterId = (user as any).masterId
        }
        return token
      } catch (error) {
        console.error('❌ JWT callback error:', error)
        // Return a minimal valid token to prevent cascade errors
        return { sub: token.sub }
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
            ; (session.user as any).segmentType = token.segmentType
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
