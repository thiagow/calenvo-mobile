
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Mail,
  Phone,
  CheckCircle2,
  Loader2,
  ArrowLeft
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { applyPhoneMask } from '@/lib/utils'

interface BusinessInfo {
  businessName: string
  businessLogo: string | null
}

interface Service {
  id: string
  name: string
  description: string | null
  duration: number
  price: number | null
}

interface Schedule {
  id: string
  name: string
  services: { service: Service }[]
}

interface TimeSlot {
  time: string
  available: boolean
}

export default function PublicBookingPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [loading, setLoading] = useState(true)
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<string>('')
  const [selectedService, setSelectedService] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Dados do cliente
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')

  useEffect(() => {
    fetchBusinessInfo()
    fetchSchedules()
  }, [slug])

  useEffect(() => {
    if (selectedSchedule && selectedService && selectedDate) {
      fetchAvailableSlots()
    }
  }, [selectedSchedule, selectedService, selectedDate])

  const fetchBusinessInfo = async () => {
    try {
      const response = await fetch(`/api/booking/${slug}/info`)
      if (response.ok) {
        const data = await response.json()
        setBusinessInfo(data)
      }
    } catch (error) {
      console.error('Erro ao buscar informações:', error)
    }
  }

  const fetchSchedules = async () => {
    try {
      const response = await fetch(`/api/booking/${slug}/schedules`)
      if (response.ok) {
        const data = await response.json()
        setSchedules(data)
      }
    } catch (error) {
      console.error('Erro ao buscar agendas:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableSlots = async () => {
    if (!selectedDate || !selectedSchedule || !selectedService) return

    setLoadingSlots(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const response = await fetch(
        `/api/booking/${slug}/available-slots?scheduleId=${selectedSchedule}&serviceId=${selectedService}&date=${dateStr}`
      )

      if (response.ok) {
        const data = await response.json()
        setAvailableSlots(data.slots || [])
      }
    } catch (error) {
      console.error('Erro ao buscar horários:', error)
      setAvailableSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!clientName || !clientPhone || !selectedSchedule || !selectedService || !selectedDate || !selectedTime) {
      toast.error('Por favor, preencha todos os campos obrigatórios')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/booking/${slug}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: selectedSchedule,
          serviceId: selectedService,
          date: format(selectedDate, 'yyyy-MM-dd'),
          time: selectedTime,
          clientName,
          clientEmail,
          clientPhone
        })
      })

      if (response.ok) {
        setSuccess(true)
        toast.success('Agendamento realizado com sucesso!')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Erro ao criar agendamento')
      }
    } catch (error) {
      console.error('Erro ao criar agendamento:', error)
      toast.error('Erro ao criar agendamento')
    } finally {
      setSubmitting(false)
    }
  }

  const handleNewBooking = () => {
    setSuccess(false)
    setSelectedSchedule('')
    setSelectedService('')
    setSelectedDate(undefined)
    setSelectedTime('')
    setClientName('')
    setClientEmail('')
    setClientPhone('')
  }

  const getSelectedServiceDetails = () => {
    const schedule = schedules.find(s => s.id === selectedSchedule)
    if (!schedule) return null

    const serviceItem = schedule.services.find(s => s.service.id === selectedService)
    return serviceItem?.service || null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Agendamento Confirmado!
              </h2>
              <p className="text-gray-600">
                Seu agendamento foi realizado com sucesso. Em breve você receberá uma confirmação.
              </p>
              <Button onClick={handleNewBooking} className="w-full">
                Fazer Novo Agendamento
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header com Logo e Nome do Negócio */}
        <div className="text-center mb-8">
          {businessInfo?.businessLogo && (
            <div className="mb-4 flex justify-center">
              <div className="relative w-24 h-24 rounded-full overflow-hidden bg-white shadow-lg">
                <Image
                  src={`/api/files/logo?key=${businessInfo.businessLogo}`}
                  alt={businessInfo.businessName || 'Logo'}
                  fill
                  className="object-contain p-2"
                />
              </div>
            </div>
          )}
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {businessInfo?.businessName || 'Agendamento Online'}
          </h1>
          <p className="text-gray-600">
            Agende seu horário de forma rápida e fácil
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seleção de Agenda/Serviço */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CalendarIcon className="mr-2 h-5 w-5 text-blue-600" />
                Selecione o Serviço
              </CardTitle>
              <CardDescription>
                Escolha a agenda e o serviço que deseja agendar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Agenda */}
              <div className="space-y-2">
                <Label htmlFor="schedule">Agenda *</Label>
                <Select value={selectedSchedule} onValueChange={setSelectedSchedule}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma agenda" />
                  </SelectTrigger>
                  <SelectContent>
                    {schedules.map(schedule => (
                      <SelectItem key={schedule.id} value={schedule.id}>
                        {schedule.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Serviço */}
              {selectedSchedule && (
                <div className="space-y-2">
                  <Label htmlFor="service">Serviço *</Label>
                  <Select value={selectedService} onValueChange={setSelectedService}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {schedules
                        .find(s => s.id === selectedSchedule)
                        ?.services.map(({ service }) => (
                          <SelectItem key={service.id} value={service.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{service.name}</span>
                              <span className="text-sm text-gray-500 ml-2">
                                {service.duration}min
                                {service.price && ` - R$ ${service.price.toFixed(2)}`}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  {selectedService && getSelectedServiceDetails() && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="text-gray-700">
                          Duração: {getSelectedServiceDetails()?.duration} minutos
                        </span>
                        {getSelectedServiceDetails()?.price && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-700">
                              Valor: R$ {getSelectedServiceDetails()?.price?.toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seleção de Data e Hora */}
          {selectedService && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5 text-blue-600" />
                  Escolha Data e Horário
                </CardTitle>
                <CardDescription>
                  Selecione a data e o horário desejado
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Calendário */}
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    locale={ptBR}
                    disabled={(date) => date < new Date()}
                    className="rounded-md border"
                  />
                </div>

                {/* Horários Disponíveis */}
                {selectedDate && (
                  <div className="space-y-2">
                    <Label>Horários Disponíveis *</Label>
                    {loadingSlots ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      </div>
                    ) : availableSlots.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2">
                        {availableSlots.map(slot => (
                          <Button
                            key={slot.time}
                            type="button"
                            variant={selectedTime === slot.time ? 'default' : 'outline'}
                            disabled={!slot.available}
                            onClick={() => setSelectedTime(slot.time)}
                            className="w-full"
                          >
                            {slot.time}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-4">
                        Não há horários disponíveis para esta data
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Dados do Cliente */}
          {selectedTime && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5 text-blue-600" />
                  Seus Dados
                </CardTitle>
                <CardDescription>
                  Informe seus dados para contato
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Nome Completo *</Label>
                  <Input
                    id="clientName"
                    type="text"
                    placeholder="Seu nome completo"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientPhone">WhatsApp *</Label>
                  <Input
                    id="clientPhone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(applyPhoneMask(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientEmail">E-mail (opcional)</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    placeholder="seu@email.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirmar Agendamento
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      </div>
    </div>
  )
}
