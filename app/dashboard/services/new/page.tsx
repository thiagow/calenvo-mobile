
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, Save, Briefcase } from 'lucide-react'
import { toast } from 'sonner'

export default function NewServicePage() {
  const router = useRouter()
  const { status } = useSession()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: 30,
    price: '',
    requiresDeposit: false,
    depositAmount: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          price: formData.price ? parseFloat(formData.price) : null,
          depositAmount: formData.depositAmount ? parseFloat(formData.depositAmount) : null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar serviço')
      }

      toast.success('Serviço criado com sucesso!')
      router.push('/dashboard/services')
    } catch (error) {
      console.error('Error creating service:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar serviço')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Serviço</h1>
          <p className="text-gray-600">Cadastre um novo serviço/procedimento</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
            <CardDescription>Detalhes do serviço ou procedimento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nome do Serviço *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Consulta Cardiologia, Corte Masculino"
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o serviço oferecido"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Duration and Price */}
        <Card>
          <CardHeader>
            <CardTitle>Duração e Preço</CardTitle>
            <CardDescription>Tempo estimado e valor do serviço</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="duration">Duração (minutos) *</Label>
              <Input
                id="duration"
                type="number"
                min="15"
                step="15"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                required
              />
            </div>
            <div>
              <Label htmlFor="price">Preço (R$)</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </CardContent>
        </Card>

        {/* Deposit */}
        <Card>
          <CardHeader>
            <CardTitle>Sinal/Depósito</CardTitle>
            <CardDescription>Configure se o serviço requer sinal antecipado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="requiresDeposit"
                checked={formData.requiresDeposit}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, requiresDeposit: checked as boolean })
                }
              />
              <label
                htmlFor="requiresDeposit"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Este serviço requer sinal/depósito antecipado
              </label>
            </div>
            {formData.requiresDeposit && (
              <div>
                <Label htmlFor="depositAmount">Valor do Sinal (R$)</Label>
                <Input
                  id="depositAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.depositAmount}
                  onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4 sticky bottom-0 bg-white py-4 border-t">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Criando...
              </div>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Criar Serviço
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
