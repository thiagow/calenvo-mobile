
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Save, Calendar, Info, Settings, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CustomDayConfig } from '@/components/schedule/custom-day-config'
import { ScheduleBlocks } from '@/components/schedule/schedule-blocks'

const WEEK_DAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' }
]

const COLORS = [
  { value: '#3B82F6', label: 'Azul' },
  { value: '#10B981', label: 'Verde' },
  { value: '#F59E0B', label: 'Laranja' },
  { value: '#EF4444', label: 'Vermelho' },
  { value: '#8B5CF6', label: 'Roxo' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#06B6D4', label: 'Ciano' }
]

export default function NewSchedulePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<any[]>([])
  const [professionals, setProfessionals] = useState<any[]>([])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    workingDays: [1, 2, 3, 4, 5], // Segunda a Sexta por padrão
    slotDuration: 30,
    bufferTime: 0,
    advanceBookingDays: 30,
    minNoticeHours: 2,
    selectedServices: [] as string[],
    selectedProfessionals: [] as string[]
  })
  const [useCustomDayConfig, setUseCustomDayConfig] = useState(false)
  const [customDayConfigs, setCustomDayConfigs] = useState<any[]>([])
  const [createdScheduleId, setCreatedScheduleId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated') {
      fetchServices()
      fetchProfessionals()
    }
  }, [status])

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/services')
      if (!response.ok) throw new Error('Erro ao buscar serviços')
      const data = await response.json()
      setServices(data.filter((s: any) => s.isActive))
    } catch (error) {
      console.error('Error fetching services:', error)
    }
  }

  const fetchProfessionals = async () => {
    try {
      const response = await fetch('/api/professionals')
      if (!response.ok) throw new Error('Erro ao buscar profissionais')
      const data = await response.json()
      setProfessionals(data.filter((p: any) => p.isActive))
    } catch (error) {
      console.error('Error fetching professionals:', error)
    }
  }

  // Auto-preencher slotDuration baseado no primeiro serviço selecionado
  useEffect(() => {
    if (formData.selectedServices.length > 0 && services.length > 0) {
      const firstSelectedService = services.find(s =>
        s.id === formData.selectedServices[0]
      )

      if (firstSelectedService && firstSelectedService.duration) {
        setFormData(prev => ({
          ...prev,
          slotDuration: firstSelectedService.duration
        }))
      }
    }
  }, [formData.selectedServices, services])

  const handleDayToggle = (day: number) => {
    setFormData(prev => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter(d => d !== day)
        : [...prev.workingDays, day].sort()
    }))
  }

  const handleServiceToggle = (serviceId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedServices: prev.selectedServices.includes(serviceId)
        ? prev.selectedServices.filter(id => id !== serviceId)
        : [...prev.selectedServices, serviceId]
    }))
  }

  const handleProfessionalToggle = (professionalId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedProfessionals: prev.selectedProfessionals.includes(professionalId)
        ? prev.selectedProfessionals.filter(id => id !== professionalId)
        : [...prev.selectedProfessionals, professionalId]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (formData.workingDays.length === 0) {
        toast.error('Selecione pelo menos um dia de atendimento')
        setLoading(false)
        return
      }

      if (formData.selectedProfessionals.length === 0) {
        toast.error('Selecione pelo menos um profissional para esta agenda')
        setLoading(false)
        return
      }

      if (formData.selectedServices.length === 0) {
        toast.error('Selecione pelo menos um serviço para esta agenda')
        setLoading(false)
        return
      }

      console.log('Submitting schedule data:', formData)

      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          serviceIds: formData.selectedServices,
          professionalIds: formData.selectedProfessionals
        })
      })

      console.log('Response status:', response.status)

      if (!response.ok) {
        const error = await response.json()
        console.error('Error response:', error)
        throw new Error(error.error || 'Erro ao criar agenda')
      }

      const result = await response.json()
      console.log('Schedule created successfully:', result)

      // Armazenar o ID da agenda criada
      setCreatedScheduleId(result.id)

      toast.success('Agenda criada com sucesso! Agora você pode configurar horários personalizados e bloqueios.')

      // Scroll suave para o topo
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      console.error('Error creating schedule:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar agenda')
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nova Agenda</h1>
          <p className="text-gray-600">Configure uma nova agenda de atendimento</p>
        </div>
      </div>

      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações Básicas
          </TabsTrigger>
          <TabsTrigger value="custom-hours" className="flex items-center gap-2" disabled={!createdScheduleId}>
            <Calendar className="h-4 w-4" />
            Horários por Dia
          </TabsTrigger>
          <TabsTrigger value="blocks" className="flex items-center gap-2" disabled={!createdScheduleId}>
            <Ban className="h-4 w-4" />
            Bloqueios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
                <CardDescription>Nome e descrição da agenda</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome da Agenda *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Consultas Cardiologia, Cortes Masculinos"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva o tipo de atendimento desta agenda"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Cor da Agenda</Label>
                  <div className="flex gap-2 mt-2">
                    {COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: color.value })}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${formData.color === color.value
                          ? 'border-gray-900 scale-110'
                          : 'border-gray-300 hover:scale-105'
                          }`}
                        style={{ backgroundColor: color.value }}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Services */}
            <Card>
              <CardHeader>
                <CardTitle>Serviços Disponíveis *</CardTitle>
                <CardDescription>Selecione os serviços oferecidos nesta agenda (obrigatório ao menos 1)</CardDescription>
              </CardHeader>
              <CardContent>
                {services.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {services.map((service) => (
                      <div key={service.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`service-${service.id}`}
                          checked={formData.selectedServices.includes(service.id)}
                          onCheckedChange={() => handleServiceToggle(service.id)}
                        />
                        <label
                          htmlFor={`service-${service.id}`}
                          className="text-sm font-medium leading-none cursor-pointer flex-1"
                        >
                          {service.name}
                          <span className="text-xs text-gray-500 ml-2">
                            ({service.duration}min)
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    Nenhum serviço cadastrado. <Button variant="link" onClick={() => router.push('/dashboard/services/new')}>Criar serviço</Button>
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Professionals */}
            <Card>
              <CardHeader>
                <CardTitle>Profissionais *</CardTitle>
                <CardDescription>Selecione os profissionais que atenderão nesta agenda (obrigatório ao menos 1)</CardDescription>
              </CardHeader>
              <CardContent>
                {professionals.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {professionals.map((professional) => (
                      <div key={professional.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`professional-${professional.id}`}
                          checked={formData.selectedProfessionals.includes(professional.id)}
                          onCheckedChange={() => handleProfessionalToggle(professional.id)}
                        />
                        <label
                          htmlFor={`professional-${professional.id}`}
                          className="text-sm font-medium leading-none cursor-pointer flex-1"
                        >
                          {professional.name}
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    Nenhum profissional cadastrado. <Button variant="link" onClick={() => router.push('/dashboard/professionals/new')}>Criar profissional</Button>
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Working Days */}
            <Card>
              <CardHeader>
                <CardTitle>Dias de Atendimento</CardTitle>
                <CardDescription>Selecione os dias da semana disponíveis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {WEEK_DAYS.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={formData.workingDays.includes(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                      />
                      <label
                        htmlFor={`day-${day.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {day.label}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Working Hours (Slots) moved/kept here but logically after selection */}
            <Card>
              <CardHeader>
                <CardTitle>Horários de Atendimento e Slots</CardTitle>
                <CardDescription>Configure a duração dos atendimentos e intervalos</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="slotDuration">
                    Duração do Slot (minutos)
                    {formData.selectedServices.length > 0 && (
                      <span className="text-xs text-gray-500 ml-2">
                        (Preenchido automaticamente pelo serviço)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="slotDuration"
                    type="number"
                    min="15"
                    step="15"
                    value={formData.slotDuration}
                    onChange={(e) => setFormData({ ...formData, slotDuration: parseInt(e.target.value) })}
                    disabled={formData.selectedServices.length > 0}
                    className={formData.selectedServices.length > 0 ? "bg-gray-50 cursor-not-allowed" : ""}
                  />
                  {formData.selectedServices.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Selecione um serviço acima para preencher automaticamente
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="bufferTime">Intervalo entre Atendimentos (minutos)</Label>
                  <Input
                    id="bufferTime"
                    type="number"
                    min="0"
                    step="5"
                    value={formData.bufferTime}
                    onChange={(e) => setFormData({ ...formData, bufferTime: parseInt(e.target.value) })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Info Alert */}
            {!createdScheduleId && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Dica:</strong> Após criar a agenda, você poderá configurar horários diferentes
                  para cada dia da semana e adicionar bloqueios nas abas acima.
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-4 sticky bottom-0 bg-white py-4 border-t">
              {createdScheduleId ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/dashboard/schedules')}
                  >
                    Voltar para Agendas
                  </Button>
                  <Alert className="flex-1 max-w-md">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Agenda criada! Use as abas acima para configurar horários personalizados e bloqueios.
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <>
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
                        Criar Agenda
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </form>
        </TabsContent>

        {/* Custom Hours Tab */}
        <TabsContent value="custom-hours">
          {createdScheduleId ? (
            <CustomDayConfig scheduleId={createdScheduleId} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Configure os horários personalizados
                </h3>
                <p className="text-gray-600">
                  Primeiro, crie a agenda nas configurações básicas
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Blocks Tab */}
        <TabsContent value="blocks">
          {createdScheduleId ? (
            <ScheduleBlocks
              scheduleId={createdScheduleId}
              scheduleName={formData.name}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Ban className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Adicione bloqueios de horário
                </h3>
                <p className="text-gray-600">
                  Primeiro, crie a agenda nas configurações básicas
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
