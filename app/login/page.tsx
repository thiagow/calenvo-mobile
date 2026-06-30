
import { LoginForm } from '@/components/auth/login-form'
import { CookieCleaner } from '@/components/auth/cookie-cleaner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import Image from 'next/image'

export default function LoginPage() {
  return (
    <>
      <CookieCleaner />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <div className="relative h-10 w-10">
                <Image
                  src="/calenvo-logo.png"
                  alt="Calenvo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-2xl calenvo-gradient">Calenvo</span>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-4">Bem-vindo de volta</h1>
            <p className="text-gray-600 mt-2">Faça login em sua conta</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Login</CardTitle>
              <CardDescription>
                Digite suas credenciais para acessar seu negócio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
              <div className="mt-6 text-center text-sm text-gray-600">
                Não tem uma conta?{' '}
                <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
                  Cadastre-se gratuitamente
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
