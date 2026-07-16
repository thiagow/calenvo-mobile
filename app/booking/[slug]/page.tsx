
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { BookingStepper, type StepDefinition } from './_components/booking-stepper'
import { ServiceStep } from './_components/service-step'
import { ProfessionalStep } from './_components/professional-step'
import { DateTimeStep } from './_components/datetime-step'
import { ConfirmStep } from './_components/confirm-step'
import { SuccessScreen } from './_components/success-screen'
import type { BookingProfessional, BookingService, BookingTimeSlot } from './_components/types'

const STEPS: StepDefinition[] = [
  { key: 'service', label: 'Serviço' },
  { key: 'professional', label: 'Profissional' },
  { key: 'datetime', label: 'Data e Hora' },
  { key: 'confirm', label: 'Confirmação' },
]

interface BusinessInfo {
  businessName: string
  businessLogo: string | null
  address: string | null
}

export default function PublicBookingPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [loading, setLoading] = useState(true)
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null)
  const [services, setServices] = useState<BookingService[]>([])

  const [stepIndex, setStepIndex] = useState(0)
  const [selectedService, setSelectedService] = useState<BookingService | null>(null)
  const [professionals, setProfessionals] = useState<BookingProfessional[]>([])
  const [loadingProfessionals, setLoadingProfessionals] = useState(false)
  const [selectedProfessional, setSelectedProfessional] = useState<BookingProfessional | null>(null)
  const [professionalChosen, setProfessionalChosen] = useState(false)

  const [selectedDate, setSelectedDate] = useState<Date>()
  const [slots, setSlots] = useState<BookingTimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedTime, setSelectedTime] = useState('')

  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [confirmedProfessionalName, setConfirmedProfessionalName] = useState<string | null>(null)

  useEffect(() => {
    fetchBusinessInfo()
    fetchServices()
  }, [slug])

  useEffect(() => {
    if (selectedDate && selectedService) {
      fetchAvailableSlots()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  const fetchBusinessInfo = async () => {
    try {
      const response = await fetch(`/api/booking/${slug}/info`)
      if (response.ok) {
        setBusinessInfo(await response.json())
      }
    } catch (error) {
      console.error('Erro ao buscar informações:', error)
    }
  }

  const fetchServices = async () => {
    try {
      const response = await fetch(`/api/booking/${slug}/services`)
      if (response.ok) {
        setServices(await response.json())
      }
    } catch (error) {
      console.error('Erro ao buscar serviços:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProfessionals = async (service: BookingService) => {
    setLoadingProfessionals(true)
    try {
      const response = await fetch(`/api/booking/${slug}/professionals?serviceId=${service.id}`)
      const data = response.ok ? await response.json() : []
      setProfessionals(data)
      return data as BookingProfessional[]
    } catch (error) {
      console.error('Erro ao buscar profissionais:', error)
      setProfessionals([])
      return []
    } finally {
      setLoadingProfessionals(false)
    }
  }

  const fetchAvailableSlots = async () => {
    if (!selectedDate || !selectedService) return

    setLoadingSlots(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const professionalParam = selectedProfessional ? `&professionalId=${selectedProfessional.id}` : ''
      const response = await fetch(
        `/api/booking/${slug}/available-slots?serviceId=${selectedService.id}&date=${dateStr}${professionalParam}`
      )
      if (response.ok) {
        const data = await response.json()
        setSlots(data.slots || [])
      }
    } catch (error) {
      console.error('Erro ao buscar horários:', error)
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleSelectService = async (service: BookingService) => {
    setSelectedService(service)
    setSelectedProfessional(null)
    setProfessionalChosen(false)
    setSelectedDate(undefined)
    setSelectedTime('')
    setSlots([])

    const found = await fetchProfessionals(service)
    if (found.length === 0) {
      setStepIndex(2)
    } else {
      setStepIndex(1)
    }
  }

  const handleSelectProfessional = (professional: BookingProfessional | null) => {
    setSelectedProfessional(professional)
    setProfessionalChosen(true)
    setSelectedDate(undefined)
    setSelectedTime('')
    setSlots([])
    setStepIndex(2)
  }

  const handleConfirmDateTime = () => {
    setStepIndex(3)
  }

  const handleBack = () => {
    if (stepIndex === 2 && professionals.length === 0) {
      setStepIndex(0)
      return
    }
    setStepIndex((prev) => Math.max(0, prev - 1))
  }

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !clientName || !clientPhone) {
      toast.error('Por favor, preencha todos os campos obrigatórios')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/booking/${slug}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          date: format(selectedDate, 'yyyy-MM-dd'),
          time: selectedTime,
          clientName,
          clientEmail,
          clientPhone,
          ...(selectedProfessional && { professionalId: selectedProfessional.id }),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setConfirmedProfessionalName(data.appointment?.professionalName || null)
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
    setStepIndex(0)
    setSelectedService(null)
    setProfessionals([])
    setSelectedProfessional(null)
    setProfessionalChosen(false)
    setSelectedDate(undefined)
    setSlots([])
    setSelectedTime('')
    setClientName('')
    setClientEmail('')
    setClientPhone('')
    setConfirmedProfessionalName(null)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (success && selectedService && selectedDate) {
    const dateLabel = selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    return (
      <SuccessScreen
        serviceName={selectedService.name}
        professionalName={confirmedProfessionalName}
        dateLabel={dateLabel}
        time={selectedTime}
        onNewBooking={handleNewBooking}
      />
    )
  }

  const canGoBack = stepIndex > 0
  const canConfirmDateTime = Boolean(selectedDate && selectedTime)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 pb-32 pt-6">
        <div className="mb-6 flex items-center gap-3">
          {canGoBack ? (
            <button onClick={handleBack} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="w-9" />
          )}
          <div className="min-w-0 flex-1 text-center">
            {businessInfo?.businessLogo && (
              <div className="mb-1 flex justify-center">
                <div className="relative h-10 w-10 overflow-hidden rounded-full bg-white shadow-sm">
                  <Image
                    src={`/api/files/logo?key=${businessInfo.businessLogo}`}
                    alt={businessInfo.businessName || 'Logo'}
                    fill
                    className="object-contain p-1"
                  />
                </div>
              </div>
            )}
            <h1 className="truncate text-lg font-bold calenvo-gradient">
              {businessInfo?.businessName || 'Agendamento Online'}
            </h1>
          </div>
          <div className="w-9" />
        </div>

        <div className="mb-8">
          <BookingStepper steps={STEPS} currentIndex={stepIndex} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={STEPS[stepIndex].key}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
          >
            {stepIndex === 0 && (
              <ServiceStep services={services} onSelect={handleSelectService} />
            )}

            {stepIndex === 1 && (
              <ProfessionalStep
                professionals={professionals}
                loading={loadingProfessionals}
                onSelect={handleSelectProfessional}
              />
            )}

            {stepIndex === 2 && (
              <DateTimeStep
                selectedDate={selectedDate}
                onSelectDate={(date) => {
                  setSelectedDate(date)
                  setSelectedTime('')
                }}
                slots={slots}
                loadingSlots={loadingSlots}
                selectedTime={selectedTime}
                onSelectTime={setSelectedTime}
              />
            )}

            {stepIndex === 3 && selectedService && selectedDate && (
              <ConfirmStep
                service={selectedService}
                professional={professionalChosen ? selectedProfessional : null}
                date={selectedDate}
                time={selectedTime}
                address={businessInfo?.address || null}
                clientName={clientName}
                clientPhone={clientPhone}
                clientEmail={clientEmail}
                onChangeName={setClientName}
                onChangePhone={setClientPhone}
                onChangeEmail={setClientEmail}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {(stepIndex === 2 || stepIndex === 3) && (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 p-4 backdrop-blur">
          <div className="mx-auto max-w-lg">
            {stepIndex === 2 && (
              <Button className="w-full" size="lg" disabled={!canConfirmDateTime} onClick={handleConfirmDateTime}>
                Confirmar Horário
              </Button>
            )}
            {stepIndex === 3 && (
              <Button
                className="w-full"
                size="lg"
                disabled={submitting || !clientName || !clientPhone}
                onClick={handleSubmit}
              >
                {submitting ? 'Processando...' : 'Confirmar Agendamento'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
