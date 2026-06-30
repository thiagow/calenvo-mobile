
'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function FixLoginPage() {
  const router = useRouter()

  const handleClearSession = () => {
    router.push('/clear-session')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-2xl w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Problemas com Login?
          </h1>
          <p className="text-gray-600 mb-6">
            Se você está tendo dificuldades para fazer login, siga os passos abaixo:
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Erro comum:</strong> JWT_SESSION_ERROR ou "JWT invalid"
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Solução Rápida:</h3>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 mb-4">
                Clique no botão abaixo para limpar automaticamente os dados de sessão corrompidos:
              </p>
              <Button 
                onClick={handleClearSession}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3"
              >
                🔧 Limpar Sessão e Resolver Problema
              </Button>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-gray-900 mb-2">Ou tente manualmente:</h4>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>Limpe os cookies do seu navegador para este site</li>
                <li>Feche todas as abas do sistema</li>
                <li>Abra uma nova aba e tente fazer login novamente</li>
              </ol>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Como limpar cookies (Chrome/Edge):</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                <li>Clique no ícone de cadeado 🔒 ao lado da URL</li>
                <li>Clique em "Cookies"</li>
                <li>Selecione todos os cookies e clique em "Remover"</li>
                <li>Recarregue a página</li>
              </ol>
            </div>
          </div>

          <div className="text-center pt-4">
            <Button 
              variant="outline" 
              onClick={() => router.push('/login')}
              className="w-full"
            >
              Voltar para o Login
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
