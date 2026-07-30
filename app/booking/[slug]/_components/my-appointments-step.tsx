'use client'

import { useState } from 'react'
import { Calendar, Clock, User, XCircle, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { applyPhoneMask } from '@/lib/utils'
import { useDialog } from '@/components/providers/dialog-provider'
import { toast } from 'sonner'

interface OpenAppointment {
  id: string
  date: string
  duration: number
  status: string
  serviceName: string
  professionalName: string | null
  canCancel: boolean
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em andamento',
}

export function MyAppointmentsStep({ slug }: { slug: string }) {
  const { confirm } = useDialog()
  const [phone, setPhone] = useState('')
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [appointments, setAppointments] = useState<OpenAppointment[]>([])
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!phone.trim()) {
      toast.error('Informe seu WhatsApp')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/booking/${slug}/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = res.ok ? await res.json() : { appointments: [] }
      setAppointments(data.appointments || [])
      setSearched(true)
    } catch {
      toast.error('Erro ao consultar agendamentos')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (appointment: OpenAppointment) => {
    const dateLabel = new Date(appointment.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
    const timeLabel = new Date(appointment.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const ok = await confirm({
      title: 'Cancelar agendamento?',
      description: `Deseja cancelar o agendamento de ${appointment.serviceName} em ${dateLabel} às ${timeLabel}? Essa ação não pode ser desfeita.`,
      confirmText: 'Cancelar agendamento',
      variant: 'destructive',
    })
    if (!ok) return

    setCancellingId(appointment.id)
    try {
      const res = await fetch(`/api/booking/${slug}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, appointmentId: appointment.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível cancelar')
        return
      }
      toast.success('Agendamento cancelado')
      setAppointments((prev) => prev.filter((a) => a.id !== appointment.id))
    } catch {
      toast.error('Erro ao cancelar agendamento')
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={phone}
          onChange={(e) => setPhone(applyPhoneMask(e.target.value))}
          placeholder="(11) 99999-0000"
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={loading}>
          <Search className="h-4 w-4 mr-1.5" />
          {loading ? 'Buscando...' : 'Buscar'}
        </Button>
      </div>

      {searched && appointments.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum agendamento em aberto encontrado para esse número.
        </p>
      )}

      {appointments.length > 0 && (
        <div className="space-y-3">
          {appointments.map((appointment) => {
            const dateLabel = new Date(appointment.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
            const timeLabel = new Date(appointment.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            return (
              <Card key={appointment.id}>
                <CardContent className="p-4 space-y-2">
                  <p className="font-medium text-foreground">{appointment.serviceName}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{dateLabel}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{timeLabel}</span>
                    {appointment.professionalName && (
                      <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{appointment.professionalName}</span>
                    )}
                    <span>{STATUS_LABELS[appointment.status] || appointment.status}</span>
                  </div>
                  {appointment.canCancel && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                      disabled={cancellingId === appointment.id}
                      onClick={() => handleCancel(appointment)}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1.5" />
                      {cancellingId === appointment.id ? 'Cancelando...' : 'Cancelar agendamento'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
