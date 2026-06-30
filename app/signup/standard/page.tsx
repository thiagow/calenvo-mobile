'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import toast from 'react-hot-toast'
import { AVAILABLE_SEGMENTS } from '@/lib/types'
import { SegmentType } from '@prisma/client'
import { Loader2, User, Mail, Lock, Building, Phone, Briefcase, CheckCircle, CreditCard } from 'lucide-react'

function SignupStandardForm() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    businessName: '',
    segmentType: 'BEAUTY_SALON' as SegmentType,
    phone: ''
  })
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const canceled = searchParams?.get('canceled')

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Validação adicional
    if (!formData.name || !formData.email || !formData.password || !formData.businessName || !formData.phone || !formData.segmentType) {
      toast.error('Preencha todos os campos obrigatórios')
      setLoading(false)
      return
    }

    try {
      console.log('📄 Enviando dados para criar checkout...')
      
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      console.log('Resposta do checkout:', { status: response.status, data })

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao criar checkout')
      }

      // Redirecionar para o Stripe Checkout
      console.log('✅ Redirecionando para Stripe Checkout...')
      window.location.href = data.url
    } catch (error) {
      console.error('Erro no checkout:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao processar pagamento. Tente novamente')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
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
          <Link href="/login">
            <Button variant="outline">Já tenho conta</Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {canceled && (
          <div className="max-w-2xl mx-auto mb-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
              <p className="font-medium">⚠️ Pagamento cancelado</p>
              <p className="text-sm mt-1">Você pode tentar novamente quando quiser.</p>
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          {/* Formulário */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Cadastro - Plano Standard</CardTitle>
                <CardDescription>
                  Preencha seus dados e prossiga para o pagamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="Seu nome"
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={formData.password}
                        onChange={(e) => handleChange('password', e.target.value)}
                        className="pl-10"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessName">Nome do Negócio</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="businessName"
                        type="text"
                        placeholder="Nome da sua empresa"
                        value={formData.businessName}
                        onChange={(e) => handleChange('businessName', e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="segmentType">Segmento</Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
                      <Select
                        value={formData.segmentType}
                        onValueChange={(value) => handleChange('segmentType', value)}
                      >
                        <SelectTrigger className="pl-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_SEGMENTS.map((segment) => (
                            <SelectItem key={segment.value} value={segment.value}>
                              {segment.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(00) 00000-0000"
                        value={formData.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg py-6"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-5 w-5" />
                        Continuar para Pagamento
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-gray-500 mt-4">
                    Ao continuar, você será redirecionado para a página segura do Stripe para processar o pagamento.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Resumo do Plano */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-2xl">Plano Standard</CardTitle>
                <CardDescription>
                  Ideal para negócios em crescimento
                </CardDescription>
                <div className="pt-4">
                  <div className="text-4xl font-bold text-blue-600">R$ 49,90</div>
                  <p className="text-sm text-gray-600 mt-1">/mês</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-gray-900 uppercase tracking-wide">Incluso no plano:</h4>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">
                        <strong>180 agendamentos</strong> por mês
                      </span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">
                        Até <strong>3 usuários</strong>
                      </span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">
                        Agenda online personalizada
                      </span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">
                        Notificações automáticas
                      </span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">
                        Relatórios básicos
                      </span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">
                        Suporte via email
                      </span>
                    </li>
                  </ul>

                  <div className="pt-6 border-t">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-900 font-medium">
                        🔒 Pagamento 100% seguro via Stripe
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Seus dados estão protegidos com criptografia de ponta
                      </p>
                    </div>
                  </div>

                  <div className="pt-4">
                    <p className="text-xs text-gray-500 text-center">
                      Cancele quando quiser, sem multa ou complicação
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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

export default function SignupStandardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <SignupStandardForm />
    </Suspense>
  )
}
