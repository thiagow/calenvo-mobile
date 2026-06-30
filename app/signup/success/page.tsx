'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Mail, ArrowRight, Loader2 } from 'lucide-react'

function SignupSuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams?.get('session_id')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simular verificação (em produção, poderia validar a session com Stripe)
    const timer = setTimeout(() => {
      setLoading(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <div className="relative w-10 h-10">
              <Image
                src="/calenvo-logo.png"
                alt="Calenvo Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="calenvo-gradient text-2xl">Calenvo</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full">
          {loading ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Loader2 className="h-16 w-16 animate-spin mx-auto text-blue-600 mb-4" />
                <p className="text-lg text-gray-600">Processando pagamento...</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-green-200">
              <CardHeader className="text-center pb-6">
                <div className="mx-auto mb-6 w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                <CardTitle className="text-3xl mb-2">
                  🎉 Pagamento Confirmado!
                </CardTitle>
                <CardDescription className="text-lg">
                  Sua assinatura do Plano Standard foi ativada com sucesso
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Resumo da Assinatura */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    Detalhes da Assinatura
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Plano</p>
                      <p className="font-semibold text-gray-900">Standard</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Valor</p>
                      <p className="font-semibold text-gray-900">R$ 49,90/mês</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Agendamentos</p>
                      <p className="font-semibold text-gray-900">180/mês</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Usuários</p>
                      <p className="font-semibold text-gray-900">Até 3</p>
                    </div>
                  </div>
                </div>

                {/* Próximos Passos */}
                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    🎯 Próximos Passos
                  </h3>
                  <ol className="space-y-4">
                    <li className="flex items-start">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm mr-3">
                        1
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Verifique seu email</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Enviamos um email de boas-vindas com todos os detalhes da sua assinatura
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm mr-3">
                        2
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Faça login na plataforma</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Use o email e senha cadastrados para acessar sua conta
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm mr-3">
                        3
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Configure seu negócio</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Adicione horários, serviços e comece a agendar!
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>

                {/* Email de Confirmação */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-start">
                    <Mail className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">
                        Email de confirmação enviado
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        Verifique sua caixa de entrada (e spam) para mais informações sobre sua assinatura
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="pt-4">
                  <Link href="/login" className="block">
                    <Button
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg py-6"
                      size="lg"
                    >
                      Acessar Minha Conta
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>

                {/* Suporte */}
                <div className="text-center pt-4">
                  <p className="text-sm text-gray-600">
                    Precisa de ajuda?{' '}
                    <a href="mailto:contato@calenvo.com.br" className="text-blue-600 hover:text-blue-700 font-medium">
                      Entre em contato
                    </a>
                  </p>
                </div>

                {/* Session ID (debug) */}
                {sessionId && (
                  <div className="text-center pt-2">
                    <p className="text-xs text-gray-400">
                      ID da Sessão: {sessionId.slice(0, 20)}...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-sm mt-12">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-gray-600">
            &copy; {new Date().getFullYear()} Calenvo. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default function SignupSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <SignupSuccessContent />
    </Suspense>
  )
}
