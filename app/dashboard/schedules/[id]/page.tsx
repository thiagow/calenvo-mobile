'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Save, Settings, Calendar, Ban, Users } from 'lucide-react'
import { toast } from 'sonner'
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

export default function EditSchedulePage() {
  const router = useRouter()
  const params = useParams()
  const { status } = useSession()
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [services, setServices] = useState<any[]>([])
  const [professionals, setProfessionals] = useState<any[]>([])
  const [formData, setFormData] = useState<any>({
    name: '',
    description: '',
    color: '#3B82F6',
    workingDays: [1, 2, 3, 4, 5],
    startTime: '08:00',
    endTime: '18:00',
    slotDuration: 30,
    bufferTime: 0,
    lunchStart: '',
    lunchEnd: '',
    advanceBookingDays: 30,
    minNoticeHours: 2,
    isActive: true,
    acceptWalkIn: false,
    selectedServices: [] as string[],
    selectedProfessionals: [] as string[]
  })

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status, params.id])

  const fetchData = async () => {
    try {
      const [scheduleRes, servicesRes, professionalsRes] = await Promise.all([
        fetch(`/api/schedules/${params.id}`),
        fetch('/api/services'),
        fetch('/api/professionals')
      ])

      if (scheduleRes.ok) {
        const scheduleData = await scheduleRes.json()
        setFormData({
          name: scheduleData.name,
          description: scheduleData.description || '',
          color: scheduleData.color,
          workingDays: scheduleData.workingDays,
          startTime: scheduleData.startTime,
          endTime: scheduleData.endTime,
          slotDuration: scheduleData.slotDuration,
          bufferTime: scheduleData.bufferTime,
          lunchStart: scheduleData.lunchStart || '',
          lunchEnd: scheduleData.lunchEnd || '',
          advanceBookingDays: scheduleData.advanceBookingDays,
          minNoticeHours: scheduleData.minNoticeHours,
          isActive: scheduleData.isActive,
          acceptWalkIn: scheduleData.acceptWalkIn || false,
          selectedServices: scheduleData.services?.map((s: any) => s.serviceId) || [],
          selectedProfessionals: scheduleData.professionals?.map((p: any) => p.professionalId) || []
        })
      }

      if (servicesRes.ok) {
        const servicesData = await servicesRes.json()
        setServices(servicesData.filter((s: any) => s.isActive))
      }

      if (professionalsRes.ok) {
        const professionalsData = await professionalsRes.json()
        setProfessionals(professionalsData.filter((p: any) => p.isActive))
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoadingData(false)
    }
  }

  // Auto-preencher slotDuration baseado no primeiro serviço selecionado
  useEffect(() => {
    if (formData.selectedServices.length > 0 && services.length > 0) {
      const firstSelectedService = services.find(s =>
        s.id === formData.selectedServices[0]
      )

      if (firstSelectedService && firstSelectedService.duration) {
        setFormData((prev: any) => ({
          ...prev,
          slotDuration: firstSelectedService.duration
        }))
      }
    }
  }, [formData.selectedServices, services])

  const handleDayToggle = (day: number) => {
    setFormData((prev: any) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d: number) => d !== day)
        : [...prev.workingDays, day].sort()
    }))
  }

  const handleServiceToggle = (serviceId: string) => {
    setFormData((prev: any) => ({
      ...prev,
      selectedServices: prev.selectedServices.includes(serviceId)
        ? prev.selectedServices.filter((id: string) => id !== serviceId)
        : [...prev.selectedServices, serviceId]
    }))
  }

  const handleProfessionalToggle = (professionalId: string) => {
    setFormData((prev: any) => ({
      ...prev,
      selectedProfessionals: prev.selectedProfessionals.includes(professionalId)
        ? prev.selectedProfessionals.filter((id: string) => id !== professionalId)
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

      const response = await fetch(`/api/schedules/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          serviceIds: formData.selectedServices,
          professionalIds: formData.selectedProfessionals
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar agenda')
      }

      toast.success('Agenda atualizada com sucesso!')
      router.push('/dashboard/schedules')
    } catch (error) {
      console.error('Error updating schedule:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar agenda')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loadingData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Agenda</h1>
          <p className="text-gray-600">Atualize as configurações da agenda</p>
        </div>
      </div>

      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="basic" className="flex items-center gap-1 px-2 py-2 text-xs sm:text-sm">
            <Settings className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">Config. Básicas</span>
          </TabsTrigger>
          <TabsTrigger value="custom-hours" className="flex items-center gap-1 px-2 py-2 text-xs sm:text-sm">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">Horários</span>
          </TabsTrigger>
          <TabsTrigger value="blocks" className="flex items-center gap-1 px-2 py-2 text-xs sm:text-sm">
            <Ban className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">Bloqueios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Status da Agenda</Label>
                    <p className="text-sm text-gray-500">Ativar ou desativar esta agenda</p>
                  </div>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Aceitar Encaixe</Label>
                    <p className="text-sm text-gray-500">Permitir agendamentos de encaixe</p>
                  </div>
                  <Switch
                    checked={formData.acceptWalkIn}
                    onCheckedChange={(checked) => setFormData({ ...formData, acceptWalkIn: checked })}
                  />
                </div>
                <div>
                  <Label htmlFor="name">Nome da Agenda *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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

            {services.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Serviços Disponíveis</CardTitle>
                  <CardDescription>Selecione os serviços que podem ser agendados nesta agenda</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {services.map((service) => (
                      <div key={service.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`service-${service.id}`}
                          checked={formData.selectedServices.includes(service.id)}
                          onCheckedChange={() => handleServiceToggle(service.id)}
                        />
                        <label htmlFor={`service-${service.id}`} className="text-sm font-medium cursor-pointer flex-1">
                          {service.name} ({service.duration}min)
                        </label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <div>
                    <CardTitle>Profissionais</CardTitle>
                    <CardDescription>Selecione os profissionais que terão acesso a esta agenda</CardDescription>
                  </div>
                </div>
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
                        <label htmlFor={`professional-${professional.id}`} className="text-sm font-medium cursor-pointer flex-1">
                          {professional.name}
                          {professional.email && <span className="text-xs text-gray-500 block">{professional.email}</span>}
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">Nenhum profissional cadastrado</p>
                    <p className="text-xs mt-1">Cadastre profissionais na seção de equipe</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dias de Atendimento</CardTitle>
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
                      <label htmlFor={`day-${day.value}`} className="text-sm font-medium cursor-pointer">
                        {day.label}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Horários e Slots</CardTitle>
                <CardDescription>Configure os intervalos e durações para esta agenda</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="slotDuration">
                    Duração do Slot (min)
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
                  <Label htmlFor="bufferTime">Intervalo (min)</Label>
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

            <div className="flex justify-end gap-4 sticky bottom-0 bg-white py-4 border-t">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? 'Salvando...' : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="custom-hours">
          <CustomDayConfig
            scheduleId={params.id as string}
          />
        </TabsContent>

        <TabsContent value="blocks">
          <ScheduleBlocks
            scheduleId={params.id as string}
            scheduleName={formData.name}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
