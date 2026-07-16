
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
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'sonner'
import { CustomDayConfig, type DayConfig } from '@/components/schedule/custom-day-config'

const COLORS = [
  { value: '#3B82F6', label: 'Azul' },
  { value: '#10B981', label: 'Verde' },
  { value: '#F59E0B', label: 'Laranja' },
  { value: '#EF4444', label: 'Vermelho' },
  { value: '#8B5CF6', label: 'Roxo' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#06B6D4', label: 'Ciano' }
]

const DEFAULT_DAY_CONFIGS: DayConfig[] = [
  { dayOfWeek: 0, isActive: false, timeSlots: [{ startTime: '08:00', endTime: '18:00' }] },
  { dayOfWeek: 1, isActive: true, timeSlots: [{ startTime: '08:00', endTime: '18:00' }] },
  { dayOfWeek: 2, isActive: true, timeSlots: [{ startTime: '08:00', endTime: '18:00' }] },
  { dayOfWeek: 3, isActive: true, timeSlots: [{ startTime: '08:00', endTime: '18:00' }] },
  { dayOfWeek: 4, isActive: true, timeSlots: [{ startTime: '08:00', endTime: '18:00' }] },
  { dayOfWeek: 5, isActive: true, timeSlots: [{ startTime: '08:00', endTime: '18:00' }] },
  { dayOfWeek: 6, isActive: false, timeSlots: [{ startTime: '08:00', endTime: '18:00' }] },
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
    bufferTime: 0,
    advanceBookingDays: 30,
    minNoticeHours: 2,
    selectedServices: [] as string[],
    selectedProfessionals: [] as string[],
    selfAsProfessional: false,
  })
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>(DEFAULT_DAY_CONFIGS)

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

      if (formData.selectedServices.length === 0) {
        toast.error('Selecione pelo menos um serviço para esta agenda')
        setLoading(false)
        return
      }

      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          color: formData.color,
          workingDays: activeDays,
          bufferTime: formData.bufferTime,
          advanceBookingDays: formData.advanceBookingDays,
          minNoticeHours: formData.minNoticeHours,
          serviceIds: formData.selectedServices,
          professionalIds,
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar agenda')
      }

      const created = await response.json()

      const dayConfigResponse = await fetch(`/api/schedules/${created.id}/day-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayConfigs, useCustomDayConfig: true })
      })

      if (!dayConfigResponse.ok) {
        throw new Error('Agenda criada, mas houve um erro ao salvar os horários. Edite a agenda para configurá-los.')
      }

      toast.success('Agenda criada com sucesso!')
      router.push('/dashboard/schedules')
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
          <h1 className="text-2xl font-bold text-gray-900">Nova Agenda</h1>
          <p className="text-gray-600">Configure uma nova agenda de atendimento</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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

        <Card>
          <CardHeader>
            <CardTitle>Profissionais *</CardTitle>
            <CardDescription>Quem atende nesta agenda (obrigatório selecionar ao menos uma opção)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="self-as-professional"
                  checked={formData.selfAsProfessional}
                  onCheckedChange={(checked) => setFormData({ ...formData, selfAsProfessional: checked === true })}
                />
                <label htmlFor="self-as-professional" className="text-sm font-medium leading-none cursor-pointer flex-1">
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
                  <label
                    htmlFor={`professional-${professional.id}`}
                    className="text-sm font-medium leading-none cursor-pointer flex-1"
                  >
                    {professional.name}
                  </label>
                </div>
              ))}
            </div>
            {professionals.length === 0 && (
              <p className="text-sm text-gray-500 mt-3">
                Também pode adicionar profissionais da equipe. <Button variant="link" onClick={() => router.push('/dashboard/professionals/new')}>Criar profissional</Button>
              </p>
            )}
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
              <Label htmlFor="bufferTime">Intervalo (minutos)</Label>
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
        </div>
      </form>
    </div>
  )
}
