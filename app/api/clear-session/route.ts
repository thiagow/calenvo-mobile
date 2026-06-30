import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Mark this route as dynamic
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = cookies()

    // Clear all NextAuth cookies
    const allCookies = cookieStore.getAll()

    const response = NextResponse.json({
      success: true,
      message: 'Session cleared successfully',
      clearedCookies: allCookies.map(c => c.name)
    })

    // Specifically clear NextAuth cookies and others via Set-Cookie headers
    // This approach is more reliable on Netlify Edge than response.cookies.delete
    const cookiesToClear = [
      ...allCookies.map(c => c.name),
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      'next-auth.csrf-token',
      '__Secure-next-auth.csrf-token',
      'next-auth.callback-url',
      '__Secure-next-auth.callback-url'
    ]

    // Remove duplicates
    const uniqueCookies = [...new Set(cookiesToClear)]

    // Create the Set-Cookie headers
    uniqueCookies.forEach(cookieName => {
      response.headers.append(
        'Set-Cookie',
        `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
      )
    })

    return response
  } catch (error) {
    console.error('Error clearing session:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to clear session'
    }, { status: 500 })
  }
}
