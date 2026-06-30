
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Save, Users, Lock, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { professionalsApi } from '@/lib/api'

interface Professional {
  id: string
  name: string
  email: string
  whatsapp: string
  image?: string
  isActive: boolean
}

interface ProfessionalForm {
  name: string
  email: string
  whatsapp: string
  image: string
  isActive: boolean
}

export default function EditProfessionalPage() {
  const router = useRouter()
  const params = useParams()
  const professionalId = params?.id as string
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showConfirmResetModal, setShowConfirmResetModal] = useState(false)
  const [tempPassword, setTempPassword] = useState('')
  const [professional, setProfessional] = useState<Professional | null>(null)
  const [formData, setFormData] = useState<ProfessionalForm>({
    name: '',
    email: '',
    whatsapp: '',
    image: '',
    isActive: true
  })

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (professionalId) {
      fetchProfessional()
    }
  }, [status, router, professionalId])

  const fetchProfessional = async () => {
    try {
      const response = await fetch(`/api/professionals/${professionalId}`)

      if (response.status === 404) {
        toast.error('Profissional não encontrado')
        router.push('/dashboard/professionals')
        return
      }

      if (!response.ok) {
        throw new Error('Erro ao carregar profissional')
      }

      const data = await response.json()
      setProfessional(data)
      setFormData({
        name: data.name || '',
        email: data.email || '',
        whatsapp: data.whatsapp || '',
        image: data.image || '',
        isActive: data.isActive
      })
    } catch (error) {
      console.error('Error fetching professional:', error)
      toast.error('Erro ao carregar profissional')
      router.push('/dashboard/professionals')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof ProfessionalForm, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleResetPassword = () => {
    setShowConfirmResetModal(true)
  }

  const executeResetPassword = async () => {
    setResettingPassword(true)
    try {
      const response = await professionalsApi.resetPassword(professionalId)
      setTempPassword(response.tempPassword)
      setShowConfirmResetModal(false)
      setShowPasswordModal(true)
      toast.success('Senha reiniciada com sucesso!')
    } catch (error) {
      console.error('Error resetting password:', error)
      toast.error('Erro ao reiniciar senha')
    } finally {
      setResettingPassword(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tempPassword)
    toast.success('Senha copiada para a área de transferência')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Validações
      if (!formData.name || !formData.email || !formData.whatsapp) {
        toast.error('Por favor, preencha todos os campos obrigatórios')
        setSaving(false)
        return
      }

      // Atualizar profissional
      const response = await fetch(`/api/professionals/${professionalId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          whatsapp: formData.whatsapp,
          image: formData.image || null,
          isActive: formData.isActive
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar profissional')
      }

      toast.success('Profissional atualizado com sucesso!')
      router.push('/dashboard/professionals')
    } catch (error) {
      console.error('Error updating professional:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar profissional. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!professional) {
    return null
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
            Editar Profissional
          </h1>
          <p className="text-gray-600">Atualize as informações do profissional</p>
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
                Este e-mail é usado para fazer login no sistema
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

        {/* Segurança */}
        <Card>
          <CardHeader>
            <CardTitle>Segurança</CardTitle>
            <CardDescription>
              Gerencie o acesso do profissional
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-100">
              <div className="space-y-0.5">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4 text-gray-500" />
                  Senha de Acesso
                </Label>
                <p className="text-xs text-gray-600">
                  Caso o profissional tenha esquecido a senha, você pode reiniciá-la para o padrão.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleResetPassword}
                disabled={resettingPassword}
              >
                {resettingPassword ? 'Reiniciando...' : 'Reiniciar Senha'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status do Profissional</CardTitle>
            <CardDescription>
              Ative ou desative o acesso do profissional ao sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
              <div className="space-y-0.5">
                <Label htmlFor="isActive" className="text-base font-medium">
                  Profissional Ativo
                </Label>
                <p className="text-xs text-gray-600">
                  {formData.isActive
                    ? 'O profissional pode acessar o sistema e ter agendamentos'
                    : 'O profissional não pode acessar o sistema'}
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => handleInputChange('isActive', checked)}
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
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Salvando...</span>
              </div>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Modal de Confirmação de Reset de Senha */}
      <Dialog open={showConfirmResetModal} onOpenChange={setShowConfirmResetModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reiniciar Senha</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja reiniciar a senha deste profissional? A senha atual será perdida e substituída por uma senha padrão.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmResetModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={executeResetPassword}
              disabled={resettingPassword}
            >
              {resettingPassword ? 'Reiniciando...' : 'Sim, reiniciar senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Nova Senha */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Senha Reiniciada com Sucesso</DialogTitle>
            <DialogDescription>
              A senha do profissional foi alterada para o padrão. Copie e envie para ele.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center space-x-2 mt-4">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="link" className="sr-only">
                Nova Senha
              </Label>
              <Input
                id="link"
                defaultValue={tempPassword}
                readOnly
                className="font-mono text-center text-lg bg-slate-50"
              />
            </div>
            <Button size="sm" className="px-3" onClick={copyToClipboard}>
              <span className="sr-only">Copiar</span>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <DialogFooter className="sm:justify-center mt-4">
            <Button type="button" variant="secondary" onClick={() => setShowPasswordModal(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
