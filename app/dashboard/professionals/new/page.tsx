
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Save, Users } from 'lucide-react'
import { toast } from 'sonner'

interface ProfessionalForm {
  name: string
  email: string
  whatsapp: string
  password: string
  confirmPassword: string
  image: string
}

export default function NewProfessionalPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<ProfessionalForm>({
    name: '',
    email: '',
    whatsapp: '',
    password: '',
    confirmPassword: '',
    image: ''
  })

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
  }, [status, router])

  const handleInputChange = (field: keyof ProfessionalForm, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validações
      if (!formData.name || !formData.email || !formData.whatsapp || !formData.password) {
        toast.error('Por favor, preencha todos os campos obrigatórios')
        setLoading(false)
        return
      }

      if (formData.password !== formData.confirmPassword) {
        toast.error('As senhas não coincidem')
        setLoading(false)
        return
      }

      if (formData.password.length < 6) {
        toast.error('A senha deve ter pelo menos 6 caracteres')
        setLoading(false)
        return
      }

      // Criar profissional
      const response = await fetch('/api/professionals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          whatsapp: formData.whatsapp,
          password: formData.password,
          image: formData.image || null
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar profissional')
      }

      toast.success('Profissional criado com sucesso!')
      router.push('/dashboard/professionals')
    } catch (error) {
      console.error('Error creating professional:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar profissional. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6" />
            Novo Profissional
          </h1>
          <p className="text-gray-600">Adicione um novo profissional à sua equipe</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações Pessoais */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
            <CardDescription>
              Dados básicos do profissional
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Digite o nome completo"
                required
              />
            </div>
            <div>
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="email@exemplo.com"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Este e-mail será usado para fazer login no sistema
              </p>
            </div>
            <div>
              <Label htmlFor="whatsapp">WhatsApp *</Label>
              <Input
                id="whatsapp"
                value={formData.whatsapp}
                onChange={(e) => handleInputChange('whatsapp', e.target.value)}
                placeholder="(11) 99999-9999"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Credenciais de Acesso */}
        <Card>
          <CardHeader>
            <CardTitle>Credenciais de Acesso</CardTitle>
            <CardDescription>
              Defina a senha para acesso ao sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="password">Senha *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                placeholder="Digite a senha novamente"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Criando...</span>
              </div>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Criar Profissional
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
