
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const pathname = url.pathname

  // Check if there's a JWT error in the URL
  if (pathname.startsWith('/api/auth') && url.searchParams.get('error')) {
    return NextResponse.redirect(new URL('/clear-session', request.url))
  }

  // Get the token to check user role
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
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
