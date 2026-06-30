
'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, LogOut, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SessionDebugPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const checkSession = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/debug/session')
      const data = await res.json()
      setDebugInfo(data)
    } catch (error) {
      console.error('Error checking session:', error)
      setDebugInfo({ status: 'error', error: String(error) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkSession()
  }, [])

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Diagnóstico de Sessão
              <Button 
                variant="outline" 
                size="sm"
                onClick={checkSession}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
            <CardDescription>
              Verifique o status da sua sessão e resolva problemas de autenticação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status de autenticação */}
            <div>
              <h3 className="font-semibold mb-2">Status de Autenticação</h3>
              <Badge variant={status === 'authenticated' ? 'default' : 'secondary'}>
                {status === 'loading' ? 'Carregando...' : status === 'authenticated' ? 'Autenticado' : 'Não autenticado'}
              </Badge>
            </div>

            {/* Informações da sessão cliente */}
            {session?.user && (
              <div>
                <h3 className="font-semibold mb-2">Informações da Sessão (Cliente)</h3>
                <div className="bg-gray-100 p-4 rounded-md">
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify({
                      id: (session.user as any).id,
                      email: session.user.email,
                      name: session.user.name,
                      ...session.user
                    }, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Informações do servidor */}
            {debugInfo && (
              <div>
                <h3 className="font-semibold mb-2">Diagnóstico do Servidor</h3>
                
                {debugInfo.status === 'authenticated' && (
                  <div className="space-y-4">
                    {/* User ID Check */}
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      {debugInfo.session?.user?.id ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      )}
                      <div>
                        <p className="font-medium">ID do Usuário</p>
                        <p className="text-sm text-gray-600">
                          {debugInfo.session?.user?.id || 'Não encontrado (PROBLEMA!)'}
                        </p>
                      </div>
                    </div>

                    {/* Database Check */}
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      {debugInfo.userInDatabase?.found ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      )}
                      <div>
                        <p className="font-medium">Usuário no Banco de Dados</p>
                        <p className="text-sm text-gray-600">
                          {debugInfo.userInDatabase?.found ? 'Encontrado' : 'Não encontrado (PROBLEMA!)'}
                        </p>
                        {debugInfo.userInDatabase?.found && (
                          <pre className="text-xs mt-2 bg-white p-2 rounded">
                            {JSON.stringify(debugInfo.userInDatabase, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className={`p-4 rounded-lg ${
                      debugInfo.recommendation?.includes('✅') 
                        ? 'bg-green-50 border border-green-200' 
                        : 'bg-yellow-50 border border-yellow-200'
                    }`}>
                      <p className="font-medium mb-2">Recomendação</p>
                      <p className="text-sm">{debugInfo.recommendation}</p>
                    </div>
                  </div>
                )}

                {debugInfo.status === 'not_authenticated' && (
                  <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Não Autenticado</p>
                      <p className="text-sm text-gray-600">
                        Você não está autenticado. Por favor, faça login.
                      </p>
                    </div>
                  </div>
                )}

                {debugInfo.status === 'error' && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Erro</p>
                      <p className="text-sm text-gray-600">{debugInfo.error}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              {status === 'authenticated' && (
                <Button 
                  variant="destructive" 
                  onClick={handleLogout}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Fazer Logout
                </Button>
              )}
              {status !== 'authenticated' && (
                <Button 
                  onClick={() => router.push('/login')}
                >
                  Ir para Login
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={() => router.push('/dashboard')}
              >
                Voltar ao Dashboard
              </Button>
            </div>

            {/* Instructions */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold mb-2">Como Resolver Problemas de Sessão</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                <li>Se o ID do usuário não for encontrado, clique em "Fazer Logout"</li>
                <li>Depois de fazer logout, volte para a página de login</li>
                <li>Faça login novamente com suas credenciais</li>
                <li>Tente criar uma agenda novamente</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
