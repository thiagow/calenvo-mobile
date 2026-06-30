
'use client'

import { useEffect, useState } from 'react'

export function CookieCleaner() {
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    const clearCorruptedCookies = async () => {
      try {
        // Clear all NextAuth related cookies via client-side
        const cookiesToClear = [
          'next-auth.session-token',
          'next-auth.csrf-token',
          'next-auth.callback-url',
          '__Secure-next-auth.session-token',
          '__Secure-next-auth.csrf-token',
          '__Secure-next-auth.callback-url'
        ]

        cookiesToClear.forEach(name => {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`
        })

        // Also try server-side clearing
        await fetch('/api/auth/clear-cookies', { method: 'POST' })
        
        console.log('✅ Cookie cleaner: All cookies cleared')
        setCleared(true)
      } catch (error) {
        console.error('❌ Cookie cleaner error:', error)
        setCleared(true)
      }
    }

    if (!cleared) {
      clearCorruptedCookies()
    }
  }, [cleared])

  return null
}
