
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

function isLocalizedPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname === '/en' ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/en/signup')
  )
}

// Tenta identificar o país do visitante a partir de headers de geolocalização
// de CDN comuns (Netlify/Vercel). Retorna null se nenhum estiver presente,
// caso em que a detecção cai de volta para Accept-Language (feita pelo next-intl).
function detectCountry(request: NextRequest): string | null {
  const direct = request.headers.get('x-country') || request.headers.get('x-vercel-ip-country')
  if (direct) return direct.toUpperCase()

  const nfGeo = request.headers.get('x-nf-geo')
  if (nfGeo) {
    try {
      const decoded = JSON.parse(Buffer.from(nfGeo, 'base64').toString('utf-8'))
      const code = decoded?.country?.code
      if (code) return String(code).toUpperCase()
    } catch {
      // ignora payload malformado e cai para detecção por Accept-Language
    }
  }

  return null
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const pathname = url.pathname

  if (isLocalizedPath(pathname)) {
    const hasLocaleCookie = request.cookies.has('NEXT_LOCALE')

    // Detecção automática por geolocalização só decide na primeira visita
    // (raiz do site, sem preferência salva ainda) — depois disso, o cookie
    // do next-intl (setado pela troca manual ou por esta própria detecção)
    // sempre tem prioridade.
    if (!hasLocaleCookie && pathname === '/') {
      const country = detectCountry(request)
      if (country && country !== 'BR') {
        const redirectUrl = new URL('/en', request.url)
        const response = NextResponse.redirect(redirectUrl)
        response.cookies.set('NEXT_LOCALE', 'en', { path: '/' })
        return response
      }
    }

    return intlMiddleware(request)
  }

  // Check if there's a JWT error in the URL
  if (pathname.startsWith('/api/auth') && url.searchParams.get('error')) {
    return NextResponse.redirect(new URL('/clear-session', request.url))
  }

  // Get the token to check user role
  // cookieName/secureCookie fixados para bater com o cookie custom em lib/auth-options.ts
  // (sem isso, getToken() assume "__Secure-next-auth.session-token" em produção HTTPS
  // e nunca encontra o cookie real, tratando todo mundo como não autenticado)
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: 'next-auth.session-token',
    secureCookie: false
  })

  // Protect /saas-admin routes - only SAAS_ADMIN can access
  if (pathname.startsWith('/saas-admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (token.role !== 'SAAS_ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Redirect SAAS_ADMIN away from /dashboard to /saas-admin
  if (pathname.startsWith('/dashboard') && token?.role === 'SAAS_ADMIN') {
    return NextResponse.redirect(new URL('/saas-admin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
