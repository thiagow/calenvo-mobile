
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ClearSessionPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'clearing' | 'success' | 'error'>('clearing')

  useEffect(() => {
    const clearSession = async () => {
      try {
        // Call the API to clear cookies
        const response = await fetch('/api/clear-session', {
          method: 'GET',
          credentials: 'include'
        })
        
        if (response.ok) {
          setStatus('success')
          
          // Wait a moment then redirect
          setTimeout(() => {
            router.push('/login')
          }, 2000)
        } else {
          setStatus('error')
        }
      } catch (error) {
        console.error('Failed to clear session:', error)
        setStatus('error')
        
        // Still redirect after error
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      }
    }

    clearSession()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          {status === 'clearing' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Limpando sessão...
              </h2>
              <p className="text-gray-600">
                Aguarde enquanto removemos os dados de sessão corrompidos.
              </p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="flex justify-center mb-4">
                <svg className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Sessão limpa com sucesso!
              </h2>
              <p className="text-gray-600">
                Redirecionando para o login...
              </p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="flex justify-center mb-4">
                <svg className="h-12 w-12 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Erro ao limpar sessão
              </h2>
              <p className="text-gray-600">
                Não foi possível limpar completamente. Redirecionando...
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
