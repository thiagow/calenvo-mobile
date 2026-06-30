'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Settings,
  Calendar,
  Globe,
  Upload,
  Copy,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Save,
  Info,
  Store,
  Clock
} from 'lucide-react'
import { generateSlug } from '@/lib/utils'
import { toast } from 'sonner'
import { useUserRole } from '@/hooks/use-user-role'

interface BusinessConfig {
  autoConfirm: boolean
  allowOnlineBooking: boolean
  businessLogo: string | null
  publicUrl: string | null
  workingDays: number[]
  startTime: string
  endTime: string
  lunchStart: string | null
  lunchEnd: string | null
  address: string | null
  description: string | null
}

const DIAS_SEMANA = [
  { id: 0, label: 'Domingo' },
  { id: 1, label: 'Segunda-feira' },
  { id: 2, label: 'Terça-feira' },
  { id: 3, label: 'Quarta-feira' },
  { id: 4, label: 'Quinta-feira' },
  { id: 5, label: 'Sexta-feira' },
  { id: 6, label: 'Sábado' },
]

export default function SettingsPage() {
  const { data: session } = useSession()
  const { isProfessional } = useUserRole()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [config, setConfig] = useState<BusinessConfig>({
    autoConfirm: false,
    allowOnlineBooking: true,
    businessLogo: null,
    publicUrl: null,
    workingDays: [1, 2, 3, 4, 5],
    startTime: '08:00',
    endTime: '18:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    address: '',
    description: ''
  })

  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  useEffect(() => {
    fetchConfig()
    fetchUserProfile()
  }, [])

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/settings/business-config')
      if (response.ok) {
        const data = await response.json()
        setConfig({
          autoConfirm: data.autoConfirm || false,
          allowOnlineBooking: data.allowOnlineBooking ?? true,
          businessLogo: data.businessLogo || null,
          publicUrl: data.publicUrl || null,
          workingDays: data.workingDays || [1, 2, 3, 4, 5],
          startTime: data.startTime || '08:00',
          endTime: data.endTime || '18:00',
          lunchStart: data.lunchStart || '12:00',
          lunchEnd: data.lunchEnd || '13:00',
          address: data.address || '',
          description: data.description || ''
        })
      }
    } catch (error) {
      console.error('Error fetching config:', error)
    } finally {
      if (!loading) setLoading(false)
    }
  }

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/user/profile')
      if (response.ok) {
        const data = await response.json()
        setBusinessName(data.businessName || data.name || '')
        setPhone(data.phone || '')
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB
        toast.error('O arquivo deve ter no máximo 5MB')
        return
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecione uma imagem válida')
        return
      }

      setLogoFile(file)

      // Criar preview local
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)

      // Upload automático para S3
      setSaving(true)
      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/upload/logo', {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          const data = await response.json()
          setConfig({ ...config, businessLogo: data.cloud_storage_path })
          toast.success('Logo enviado com sucesso!')
          await fetchConfig()
        } else {
          throw new Error('Erro ao enviar logo')
        }
      } catch (error) {
        console.error('Erro no upload:', error)
        toast.error('Erro ao enviar logo')
      } finally {
        setSaving(false)
      }
    }
  }

  const handleSaveAppointmentSettings = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings/business-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config
        })
      })

      if (response.ok) {
        toast.success('Configurações salvas com sucesso!')
        await fetchConfig()
      } else {
        throw new Error('Erro ao salvar')
      }
    } catch (error) {
      console.error('Error saving config:', error)
      toast.error('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBusinessProfile = async () => {
    setSaving(true)
    try {
      // Salvar nome e telefone no perfil do usuário
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, phone })
      })

      // Salvar config
      await fetch('/api/settings/business-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config
        })
      })

      toast.success('Perfil salvo com sucesso!')
      await fetchConfig()
      await fetchUserProfile()
    } catch (error) {
      console.error('Error saving customization:', error)
      toast.error('Erro ao salvar personalização')
    } finally {
      setSaving(false)
    }
  }

  const toggleWorkingDay = (dayId: number) => {
    setConfig(prev => {
      const days = new Set(prev.workingDays)
      if (days.has(dayId)) {
        days.delete(dayId)
      } else {
        days.add(dayId)
      }
      return { ...prev, workingDays: Array.from(days).sort((a, b) => a - b) }
    })
  }

  const copyPublicUrl = () => {
    const url = getPublicUrl()
    navigator.clipboard.writeText(url)
    toast.success('URL copiada para a área de transferência!')
  }

  const getPublicUrl = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const slug = config.publicUrl || generateSlug(businessName) || (session?.user as any)?.id?.substring(0, 8) || 'agendamento'
    return `${baseUrl}/booking/${slug}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-600 mt-1">
            {isProfessional
              ? 'Visualize informações da conta'
              : 'Personalize o funcionamento do seu negócio'}
          </p>
        </div>
        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
          <Settings className="mr-1 h-3 w-3" />
          Configurações
        </Badge>
      </div>

      {isProfessional && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 text-sm mb-1">
                  Visualização Limitada
                </h4>
                <p className="text-xs text-blue-700">
                  Como profissional, você pode visualizar apenas as informações da URL pública de agendamento.
                  Para alterar configurações do negócio, entre em contato com o administrador da conta.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isProfessional ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Globe className="mr-2 h-5 w-5 text-purple-600" />
              URL de Agendamento
            </CardTitle>
            <CardDescription>
              URL pública para compartilhar com clientes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="publicUrl">URL Pública</Label>
              <div className="flex gap-2">
                <Input id="publicUrl" type="text" value={getPublicUrl()} readOnly className="bg-gray-50 cursor-default" />
                <Button variant="outline" size="icon" onClick={copyPublicUrl} title="Copiar URL">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => window.open(getPublicUrl(), '_blank')} title="Abrir em nova aba">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="flex flex-col h-auto w-full gap-1 p-1 bg-muted rounded-md mb-6 md:mb-0 md:grid md:grid-cols-3">
            <TabsTrigger value="profile" className="w-full justify-start md:justify-center py-2"><Store className="mr-2 h-4 w-4" /> Perfil da Empresa</TabsTrigger>
            <TabsTrigger value="hours" className="w-full justify-start md:justify-center py-2"><Clock className="mr-2 h-4 w-4" /> Horários Funcionamento</TabsTrigger>
            <TabsTrigger value="booking" className="w-full justify-start md:justify-center py-2"><Calendar className="mr-2 h-4 w-4" /> Agendamento Online</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Store className="mr-2 h-5 w-5 text-blue-600" />
                  Perfil da Empresa
                </CardTitle>
                <CardDescription>
                  Informações públicas que seus clientes e o Agente IA verão sobre seu negócio
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="logo">Logo do Negócio</Label>
                  <div className="flex items-start gap-4">
                    <div className="w-32 h-32 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden">
                      {logoPreview || config.businessLogo ? (
                        <img
                          src={logoPreview || (config.businessLogo ? `/api/files/logo?key=${config.businessLogo}` : '')}
                          alt="Logo preview"
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <div className="text-center p-2">
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-xs text-gray-500">Nenhuma imagem</p>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          id="logo"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          className="cursor-pointer"
                          disabled={saving}
                        />
                        {config.businessLogo && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setConfig({ ...config, businessLogo: null })
                              setLogoPreview(null)
                              setLogoFile(null)
                            }}
                          >
                            Remover
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Recomendado: quadrada, PNG/JPG, até 5MB
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Nome da Empresa</Label>
                    <Input
                      id="businessName"
                      type="text"
                      placeholder="Ex: Clínica Bem Estar"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone / WhatsApp</Label>
                    <Input
                      id="phone"
                      type="text"
                      placeholder="Ex: (11) 99999-9999"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Endereço Completo</Label>
                  <Textarea
                    id="address"
                    placeholder="Ex: Rua das Flores, 123 - Centro, São Paulo - SP"
                    value={config.address || ''}
                    onChange={(e) => setConfig({ ...config, address: e.target.value })}
                    rows={2}
                  />
                  <p className="text-xs text-gray-500">Este endereço será informado pela IA caso o cliente pergunte onde vocês estão localizados.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição e Regras (Sobre a Empresa)</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva seu negócio, regras de atendimento, tempo de tolerância a atrasos, etc."
                    value={config.description || ''}
                    onChange={(e) => setConfig({ ...config, description: e.target.value })}
                    rows={4}
                  />
                  <p className="text-xs text-gray-500">Isso dá contexto extra para o Agente IA responder dúvidas dos clientes (ex: regras de estacionamento, tolerâncias, formas de pagamento, etc).</p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveBusinessProfile} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : <><Save className="mr-2 h-4 w-4" /> Salvar Perfil</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hours" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5 text-orange-600" />
                  Horários de Funcionamento
                </CardTitle>
                <CardDescription>
                  Dias e horários que a IA e o sistema permitirão agendamentos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label>Dias de Atendimento</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {DIAS_SEMANA.map((day) => (
                      <div key={day.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`day-${day.id}`}
                          checked={config.workingDays.includes(day.id)}
                          onCheckedChange={() => toggleWorkingDay(day.id)}
                        />
                        <label
                          htmlFor={`day-${day.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {day.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Abertura</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={config.startTime}
                      onChange={(e) => setConfig({ ...config, startTime: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">Fechamento</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={config.endTime}
                      onChange={(e) => setConfig({ ...config, endTime: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lunchStart">Início Almoço (opcional)</Label>
                    <Input
                      id="lunchStart"
                      type="time"
                      value={config.lunchStart || ''}
                      onChange={(e) => setConfig({ ...config, lunchStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lunchEnd">Fim Almoço (opcional)</Label>
                    <Input
                      id="lunchEnd"
                      type="time"
                      value={config.lunchEnd || ''}
                      onChange={(e) => setConfig({ ...config, lunchEnd: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveAppointmentSettings} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : <><Save className="mr-2 h-4 w-4" /> Salvar Horários</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="booking" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="mr-2 h-5 w-5 text-purple-600" />
                  Agendamento Online
                </CardTitle>
                <CardDescription>
                  Configurações do link público e regras de agendamento automático
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-2">
                  <Label htmlFor="publicUrl">URL Pública de Agendamento</Label>
                  <div className="flex gap-2">
                    <Input
                      id="publicUrl"
                      type="text"
                      value={getPublicUrl()}
                      readOnly
                      className="bg-gray-50 cursor-default"
                    />
                    <Button variant="outline" size="icon" onClick={copyPublicUrl} title="Copiar URL">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => window.open(getPublicUrl(), '_blank')} title="Abrir em nova aba">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    A URL é gerada automaticamente a partir do nome da empresa.
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
                    <div className="space-y-0.5 flex-1">
                      <Label htmlFor="allowOnlineBooking" className="text-base font-medium cursor-pointer">
                        Agendamento Online
                      </Label>
                      <p className="text-sm text-gray-600">
                        Permitir que clientes agendem pela internet através da URL pública
                      </p>
                    </div>
                    <Switch
                      id="allowOnlineBooking"
                      checked={config.allowOnlineBooking}
                      onCheckedChange={(checked) => setConfig({ ...config, allowOnlineBooking: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
                    <div className="space-y-0.5 flex-1">
                      <Label htmlFor="autoConfirm" className="text-base font-medium cursor-pointer">
                        Confirmação Automática
                      </Label>
                      <p className="text-sm text-gray-600">
                        {config.autoConfirm
                          ? 'Agendamentos são confirmados automaticamente e bloqueiam o horário'
                          : 'Requer aprovação manual antes de bloquear o horário'}
                      </p>
                    </div>
                    <Switch
                      id="autoConfirm"
                      checked={config.autoConfirm}
                      onCheckedChange={(checked) => setConfig({ ...config, autoConfirm: checked })}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveAppointmentSettings} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : <><Save className="mr-2 h-4 w-4" /> Salvar Preferências</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
