
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    console.log('🔐 LoginForm: Starting login process')
    console.log('📧 Email:', email)

    try {
      console.log('📞 LoginForm: Calling signIn...')
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      })

      console.log('📊 LoginForm: SignIn result:', result)

      if (result?.error) {
        console.error('❌ LoginForm: Login error:', result.error)
        
        // Check if it's a JWT error
        if (result.error.includes('JWT') || result.error.includes('decryption')) {
          console.log('🔄 JWT error detected - redirecting to clear session')
          router.push('/clear-session')
          return
        }
        
        setError('Email ou senha inválidos')
        setIsLoading(false)
      } else if (result?.ok) {
        console.log('✅ LoginForm: Login successful!')
        router.push('/dashboard')
        router.refresh()
      } else {
        console.warn('⚠️ LoginForm: Unexpected result:', result)
        setError('Erro ao fazer login. Tente novamente.')
        setIsLoading(false)
      }
    } catch (err) {
      console.error('💥 LoginForm: Exception during login:', err)
      
      // Check if it's a JWT error
      if (err instanceof Error && (err.message.includes('JWT') || err.message.includes('decryption'))) {
        console.log('🔄 JWT error detected - redirecting to clear session')
        router.push('/clear-session')
        return
      }
      
      setError('Erro ao fazer login. Tente novamente.')
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
          {error}
          {error.includes('inválidos') && (
            <div className="mt-2 text-xs">
              <Link href="/clear-session" className="text-blue-600 hover:underline">
                Problemas com login? Clique aqui para limpar a sessão
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <Button 
        type="submit" 
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Entrando...
          </>
        ) : (
          'Entrar'
        )}
      </Button>
    </form>
  )
}
