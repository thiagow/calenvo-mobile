
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { User, Mail, Building, Stethoscope, Crown } from 'lucide-react'
import { PLAN_CONFIGS } from '@/lib/types'

export default function ProfilePage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()

  // Redirect to login if not authenticated
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  const userPlan = (session?.user as any)?.planType || 'FREEMIUM'
  const planConfig = PLAN_CONFIGS[userPlan as keyof typeof PLAN_CONFIGS]

  const handleUpgrade = () => {
    router.push('/dashboard/plans')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Perfil</h1>
          <p className="text-gray-600 mt-1">
            Informações da sua conta e configurações pessoais
          </p>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <Crown className="mr-1 h-3 w-3" />
          {planConfig?.name}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* User Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2 h-5 w-5 text-blue-600" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>
              Dados básicos da sua conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50">
              <User className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Nome Completo</p>
                <p className="text-sm text-gray-600">{session?.user?.name}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50">
              <Mail className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">E-mail</p>
                <p className="text-sm text-gray-600">{session?.user?.email}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50">
              <Building className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Clínica</p>
                <p className="text-sm text-gray-600">{(session?.user as any)?.clinicName}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50">
              <Stethoscope className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Especialidade</p>
                <p className="text-sm text-gray-600">{(session?.user as any)?.specialty}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Crown className="mr-2 h-5 w-5 text-purple-600" />
              Informações do Plano
            </CardTitle>
            <CardDescription>
              Detalhes da sua assinatura atual
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  Plano {planConfig?.name}
                </h3>
                <Badge className="bg-blue-600">
                  {planConfig?.price === 0 ? 'Grátis' : `R$ ${planConfig?.price?.toFixed(2)}/mês`}
                </Badge>
              </div>

              <ul className="space-y-2 text-sm text-gray-700">
                {planConfig?.features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <span className="w-1 h-1 bg-blue-600 rounded-full mr-2"></span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-center pt-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleUpgrade}
              >
                Mudar de Plano
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações da Conta</CardTitle>
          <CardDescription>
            Funcionalidades em desenvolvimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Edição de perfil em breve
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Em breve você poderá editar suas informações pessoais,
              alterar senha e configurar preferências da conta.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
