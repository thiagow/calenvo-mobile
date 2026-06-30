
import { SignupForm } from '@/components/auth/signup-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import Image from 'next/image'

export default function SignupPage() {
  return (
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
          <h1 className="text-2xl font-bold text-gray-900 mt-4">Criar conta gratuita</h1>
          <p className="text-gray-600 mt-2">Comece a organizar seu negócio em minutos</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cadastro - Plano Freemium</CardTitle>
            <CardDescription>
              20 agendamentos por mês • Grátis para sempre
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignupForm />
            <div className="mt-6 text-center text-sm text-gray-600">
              Já tem uma conta?{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Faça login
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-xs text-gray-500">
          Ao criar uma conta, você concorda com nossos termos de uso
        </div>
      </div>
    </div>
  )
}
