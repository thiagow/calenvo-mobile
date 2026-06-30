
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import toast from 'react-hot-toast'
import { AVAILABLE_SEGMENTS } from '@/lib/types'
import { SegmentType } from '@prisma/client'
import { Loader2, User, Mail, Lock, Building, Phone, Briefcase } from 'lucide-react'

export function SignupForm() {
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

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    console.log('Form data before validation:', formData)

    // Validação adicional
    if (!formData.name || !formData.email || !formData.password || !formData.businessName || !formData.phone || !formData.segmentType) {
      console.log('Missing required fields:', {
        name: !formData.name,
        email: !formData.email,
        password: !formData.password,
        businessName: !formData.businessName,
        phone: !formData.phone,
        segmentType: !formData.segmentType
      })
      toast.error('Preencha todos os campos obrigatórios')
      setLoading(false)
      return
    }

    try {
      console.log('Sending signup data:', formData)
      
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      console.log('Signup response:', { status: response.status, data })

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao criar conta')
      }

      // Auto login after successful signup
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false
      })

      console.log('Auto login result:', result)

      if (result?.ok) {
        toast.success('Conta criada com sucesso! Bem-vindo ao Calenvo')
        router.replace('/dashboard')
      } else {
        toast.success('Conta criada! Faça login para continuar')
        router.push('/login')
      }
    } catch (error) {
      console.error('Signup error:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar conta. Tente novamente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome completo</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            id="name"
            placeholder="Dr. João Silva"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="pl-10"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            id="email"
            type="email"
            placeholder="joao@clinica.com"
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
            minLength={6}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="businessName">Nome do negócio</Label>
        <div className="relative">
          <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            id="businessName"
            placeholder="Ex: Studio Beleza, Tech Solutions..."
            value={formData.businessName}
            onChange={(e) => handleChange('businessName', e.target.value)}
            className="pl-10"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Segmento do negócio</Label>
        <Select 
          value={formData.segmentType} 
          onValueChange={(value) => handleChange('segmentType', value)}
        >
          <SelectTrigger className="pl-10">
            <Briefcase className="absolute left-3 h-4 w-4 text-gray-400" />
            <SelectValue placeholder="Selecione o segmento" />
          </SelectTrigger>
          <SelectContent>
            {AVAILABLE_SEGMENTS.map(segment => (
              <SelectItem key={segment.value} value={segment.value}>
                <span className="flex items-center gap-2">
                  <span>{segment.icon}</span>
                  <span>{segment.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Telefone</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            id="phone"
            placeholder="(11) 99999-9999"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="pl-10"
            required
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Criando conta...
          </>
        ) : (
          'Criar conta gratuita'
        )}
      </Button>
    </form>
  )
}
