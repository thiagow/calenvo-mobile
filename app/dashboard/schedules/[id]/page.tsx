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
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { ArrowLeft, Save, Users } from 'lucide-react'
import { toast } from 'sonner'
import { CustomDayConfig, type DayConfig } from '@/components/schedule/custom-day-config'
import { ScheduleBlocks } from '@/components/schedule/schedule-blocks'
import { ScheduleTabsList } from '@/components/schedule/schedule-tabs-list'

const COLORS = [
  { value: '#3B82F6', label: 'Azul' },
  { value: '#10B981', label: 'Verde' },
  { value: '#F59E0B', label: 'Laranja' },
  { value: '#EF4444', label: 'Vermelho' },
  { value: '#8B5CF6', label: 'Roxo' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#06B6D4', label: 'Ciano' }
]

const WEEK_DAY_VALUES = [0, 1, 2, 3, 4, 5, 6]

export default function EditSchedulePage() {
  const router = useRouter()
  const params = useParams()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [services, setServices] = useState<any[]>([])
  const [professionals, setProfessionals] = useState<any[]>([])
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>([])
  const [formData, setFormData] = useState<any>({
    name: '',
    description: '',
    color: '#3B82F6',
    bufferTime: 0,
    advanceBookingDays: 30,
    minNoticeHours: 2,
    isActive: true,
    acceptWalkIn: false,
    selectedServices: [] as string[],
    selectedProfessionals: [] as string[],
    selfAsProfessional: false,
  })

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status, params.id])

  const fetchData = async () => {
    try {
      const [scheduleRes, servicesRes, professionalsRes, dayConfigRes] = await Promise.all([
        fetch(`/api/schedules/${params.id}`),
        fetch('/api/services'),
        fetch('/api/professionals'),
        fetch(`/api/schedules/${params.id}/day-config`)
      ])

      if (scheduleRes.ok) {
        const scheduleData = await scheduleRes.json()
        const ownUserId = (session?.user as any)?.id
        const professionalIds = scheduleData.professionals?.map((p: any) => p.professionalId) || []

        setFormData({
          name: scheduleData.name,
          description: scheduleData.description || '',
          color: scheduleData.color,
          bufferTime: scheduleData.bufferTime,
          advanceBookingDays: scheduleData.advanceBookingDays,
          minNoticeHours: scheduleData.minNoticeHours,
          isActive: scheduleData.isActive,
          acceptWalkIn: scheduleData.acceptWalkIn || false,
          selectedServices: scheduleData.services?.map((s: any) => s.serviceId) || [],
          selectedProfessionals: professionalIds.filter((id: string) => id !== ownUserId),
          selfAsProfessional: professionalIds.includes(ownUserId),
        })

        if (dayConfigRes.ok) {
          const existingConfigs = await dayConfigRes.json()
          if (existingConfigs.length > 0) {
            setDayConfigs(existingConfigs)
          } else {
            // Agenda legada, criada antes da unificação: ainda não tem
            // ScheduleDayConfig — herda workingDays/startTime/endTime como
            // ponto de partida do editor unificado.
            setDayConfigs(WEEK_DAY_VALUES.map((day) => ({
              dayOfWeek: day,
              isActive: scheduleData.workingDays.includes(day),
              timeSlots: [{ startTime: scheduleData.startTime, endTime: scheduleData.endTime }]
            })))
          }
        }
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
      const activeDays = dayConfigs.filter(c => c.isActive).map(c => c.dayOfWeek)

      if (activeDays.length === 0) {
        toast.error('Selecione pelo menos um dia de atendimento')
        setLoading(false)
        return
      }

      const professionalIds = [
        ...(formData.selfAsProfessional && session?.user ? [(session.user as any).id] : []),
        ...formData.selectedProfessionals,
      ]

      if (professionalIds.length === 0) {
        toast.error('Selecione "Eu mesmo atendo" ou pelo menos um profissional para esta agenda')
        setLoading(false)
        return
      }

      const response = await fetch(`/api/schedules/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          color: formData.color,
          workingDays: activeDays,
          bufferTime: formData.bufferTime,
          advanceBookingDays: formData.advanceBookingDays,
          minNoticeHours: formData.minNoticeHours,
          isActive: formData.isActive,
          acceptWalkIn: formData.acceptWalkIn,
          serviceIds: formData.selectedServices,
          professionalIds,
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar agenda')
      }

      const dayConfigResponse = await fetch(`/api/schedules/${params.id}/day-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayConfigs, useCustomDayConfig: true })
      })

      if (!dayConfigResponse.ok) {
        throw new Error('Erro ao salvar os horários da agenda')
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
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
        <ScheduleTabsList />

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
                  <Users className="h-5 w-5 text-violet-600" />
                  <div>
                    <CardTitle>Profissionais</CardTitle>
                    <CardDescription>Quem atende nesta agenda</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="self-as-professional"
                      checked={formData.selfAsProfessional}
                      onCheckedChange={(checked) => setFormData({ ...formData, selfAsProfessional: checked === true })}
                    />
                    <label htmlFor="self-as-professional" className="text-sm font-medium cursor-pointer flex-1">
                      Eu mesmo atendo
                    </label>
                  </div>
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
              </CardContent>
            </Card>

            <CustomDayConfig
              initialConfigs={dayConfigs}
              onChange={(configs) => setDayConfigs(configs)}
            />

            <Card>
              <CardHeader>
                <CardTitle>Intervalo entre Atendimentos</CardTitle>
                <CardDescription>Tempo de folga entre um agendamento e outro nesta agenda</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-xs">
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
              <Button type="submit" disabled={loading} className="bg-violet-600 hover:bg-violet-700">
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
