
import { Suspense } from 'react'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { LogoIcon } from '@/components/brand/logo'

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <LogoIcon size={40} gradientId="reset-password-logo" />
            <span className="text-2xl calenvo-gradient">Calenvo</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">Redefinir senha</h1>
          <p className="text-gray-600 mt-2">Escolha uma nova senha para sua conta</p>
        </div>

        <Card className="bg-white border border-gray-200 rounded-3xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900">Nova senha</CardTitle>
            <CardDescription className="text-gray-600">
              O link de redefinição é válido por 1 hora
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={null}>
              <ResetPasswordForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
