export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    const cookieStore = cookies()
    
    // Clear all NextAuth cookies
    const cookieNames = [
      'next-auth.session-token',
      'next-auth.csrf-token',
      'next-auth.callback-url',
      '__Secure-next-auth.session-token',
      '__Secure-next-auth.csrf-token',
      '__Secure-next-auth.callback-url'
    ]

    cookieNames.forEach(name => {
      cookieStore.delete(name)
    })

    console.log('✅ All NextAuth cookies cleared')
    return NextResponse.json({ success: true, message: 'Cookies cleared' })
  } catch (error) {
    console.error('❌ Error clearing cookies:', error)
    return NextResponse.json({ success: false, error: 'Failed to clear cookies' }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}
