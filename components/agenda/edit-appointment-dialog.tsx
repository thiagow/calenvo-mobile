
'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, User, Loader2, AlertCircle, DollarSign } from 'lucide-react'
import { AppointmentStatus, ModalityType } from '@prisma/client'
import { STATUS_LABELS, STATUS_COLORS, MODALITY_LABELS } from '@/lib/types'
import toast from 'react-hot-toast'

interface EditAppointmentDialogProps {
  isOpen: boolean
  onClose: () => void
  appointment: any
  onUpdate: (id: string, data: any) => Promise<void>
}

const STATUS_OPTIONS: AppointmentStatus[] = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW'
]

const MODALITY_OPTIONS: ModalityType[] = ['PRESENCIAL', 'TELECONSULTA']

export function EditAppointmentDialog({
  isOpen,
  onClose,
  appointment,
  onUpdate
}: EditAppointmentDialogProps) {
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [services, setServices] = useState<any[]>([])
  const [professionals, setProfessionals] = useState<any[]>([])
  const [professionalName, setProfessionalName] = useState<string>('')
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    duration: 30,
    status: 'SCHEDULED' as AppointmentStatus,
    modality: 'PRESENCIAL' as ModalityType,
    serviceId: '',
    professionalId: '',
    notes: '',
    price: ''
  })

  // Buscar dados de serviços e profissionais
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setLoadingData(true)
        try {
          const [servicesRes, professionalsRes] = await Promise.all([
            fetch('/api/services'),
            fetch('/api/professionals')
          ])

          if (servicesRes.ok) {
            const data = await servicesRes.json()
            setServices(data.filter((s: any) => s.isActive))
          }

          if (professionalsRes.ok) {
            const data = await professionalsRes.json()
            setProfessionals(data.filter((p: any) => p.isActive))
          }
        } catch (error) {
          console.error('Error fetching data:', error)
          toast.error('Erro ao carregar listas')
        } finally {
          setLoadingData(false)
        }
      }
      fetchData()
    }
  }, [isOpen])

  useEffect(() => {
    if (appointment) {
      const appointmentDate = new Date(appointment.date)
      const dateStr = appointmentDate.toISOString().split('T')[0]
      const timeStr = appointmentDate.toTimeString().slice(0, 5)

      setFormData({
        date: dateStr,
        time: timeStr,
        duration: appointment.duration || 30,
        status: appointment.status || 'SCHEDULED',
        modality: appointment.modality || 'PRESENCIAL',
        serviceId: appointment.serviceId || (appointment.service?.id) || '',
        professionalId: appointment.professionalId || (appointment.professionalRelation?.id) || '',
        notes: appointment.notes || '',
        price: appointment.price
          ? appointment.price.toString()
          : (appointment.service?.price ? appointment.service.price.toString() : '')
      })

      // Se não tiver professionalId mas tiver nome legado, tentar encontrar
      if (!appointment.professionalId && appointment.professional) {
        // Lógica de fallback será tratada na renderização do select ou busca
      }
    }
  }, [appointment])

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId)
    if (service) {
      setFormData(prev => ({
        ...prev,
        serviceId,
        duration: service.duration,
        price: service.price ? service.price.toString() : prev.price,
        specialty: service.name // Manter compatibilidade com campo legado
      }))
    } else {
      setFormData(prev => ({ ...prev, serviceId }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.date || !formData.time) {
      toast.error('Data e hora são obrigatórios')
      return
    }

    setLoading(true)

    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`)

      const updateData: any = {
        date: dateTime.toISOString(),
        duration: Number(formData.duration),
        status: formData.status,
        modality: formData.modality,
        serviceId: formData.serviceId || null,
        professionalId: formData.professionalId || null,
        specialty: formData.serviceId ? (services.find(s => s.id === formData.serviceId)?.name || null) : null,
        professional: formData.professionalId ? (professionals.find(p => p.id === formData.professionalId)?.name || null) : null,
        notes: formData.notes || null,
        price: formData.price ? parseFloat(formData.price) : null
      }

      await onUpdate(appointment.id, updateData)
      toast.success('Agendamento atualizado com sucesso!')
      onClose()
    } catch (error) {
      console.error('Error updating appointment:', error)
      toast.error('Erro ao atualizar agendamento')
    } finally {
      setLoading(false)
    }
  }

  if (!appointment) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <Calendar className="mr-2 h-5 w-5 text-blue-600" />
            Detalhes do Agendamento
          </DialogTitle>
          <DialogDescription>
            Visualize as informações do agendamento do cliente {appointment.patient.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient Info - Read Only */}
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center space-x-2 text-sm">
              <User className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-900">Cliente:</span>
              <span className="text-blue-700">{appointment.patient.name}</span>
            </div>
            {appointment.patient.phone && (
              <div className="text-sm text-blue-600 ml-6 mt-1">
                {appointment.patient.phone}
              </div>
            )}
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center">
                <Calendar className="mr-1 h-3 w-3" />
                Data
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                readOnly
                className="bg-gray-100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time" className="flex items-center">
                <Clock className="mr-1 h-3 w-3" />
                Hora
              </Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                readOnly
                className="bg-gray-100"
              />
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duração (minutos)</Label>
            <Input
              id="duration"
              type="number"
              value={formData.duration}
              readOnly
              className="bg-gray-100"
            />
          </div>

          {/* Status and Modality */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as AppointmentStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      <Badge className={STATUS_COLORS[status]}>
                        {STATUS_LABELS[status]}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modality">Modalidade</Label>
              <Input
                id="modality"
                value={formData.modality}
                readOnly
                className="bg-gray-100"
              />
            </div>
          </div>

          {/* Service and Professional */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="service">Serviço</Label>
              <Input
                value={
                  (formData.serviceId && services.find(s => s.id === formData.serviceId)?.name) ||
                  appointment.service?.name ||
                  appointment.specialty ||
                  (formData.serviceId ? 'Carregando...' : '')
                }
                readOnly
                className="bg-gray-100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="professional">Profissional</Label>
              <Input
                value={
                  (formData.professionalId && professionals.find(p => p.id === formData.professionalId)?.name) ||
                  appointment.professionalRelation?.name ||
                  appointment.professional ||
                  (formData.professionalId ? 'Carregando...' : '')
                }
                readOnly
                className="bg-gray-100"
              />
            </div>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">Valor (R$)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                placeholder="0.00"
                className="pl-9"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              readOnly
              rows={3}
              className="bg-gray-100"
            />
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 sm:flex-initial"
            >
              Fechar
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-auto"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Atualizar Status'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
