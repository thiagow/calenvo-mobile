
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { LogoIcon } from '@/components/brand/logo'

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <LogoIcon size={40} gradientId="forgot-password-logo" />
            <span className="text-2xl calenvo-gradient">Calenvo</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">Esqueceu sua senha?</h1>
          <p className="text-gray-600 mt-2">Informe seu e-mail para receber o link de redefinição</p>
        </div>

        <Card className="bg-white border border-gray-200 rounded-3xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900">Recuperar senha</CardTitle>
            <CardDescription className="text-gray-600">
              Enviaremos um link de redefinição para o seu e-mail cadastrado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ForgotPasswordForm />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-600 mt-6">
          <Link href="/login" className="text-violet-600 hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  )
}
