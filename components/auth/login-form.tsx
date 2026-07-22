
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl">
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
        <Label htmlFor="email" className="text-gray-700">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-gray-700">Senha</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 pr-10"
            required
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl"
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
