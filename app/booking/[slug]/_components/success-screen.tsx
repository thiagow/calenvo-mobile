'use client'

import { CalendarPlus, CheckCircle2, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { buildGoogleCalendarUrl, buildIcs, type CalendarEventInput } from '@/lib/calendar-links'

export interface SuccessCalendarEvent {
  appointmentId: string
  startIso: string
  durationMin: number
  businessName: string | null
  address: string | null
  timezone: string | null
  pendingConfirmation: boolean
}

interface SuccessScreenProps {
  serviceName: string
  professionalName: string | null
  dateLabel: string
  time: string
  calendarEvent: SuccessCalendarEvent | null
  onNewBooking: () => void
}

// Sem preço, telefone ou dados do cliente: o evento pode ser compartilhado a partir da agenda.
function toCalendarInput(
  event: SuccessCalendarEvent,
  serviceName: string,
  professionalName: string | null,
): CalendarEventInput {
  const descriptionLines = [
    `Serviço: ${serviceName}`,
    professionalName ? `Profissional: ${professionalName}` : null,
    event.businessName ? `Local: ${event.businessName}` : null,
    event.pendingConfirmation ? 'Aguardando confirmação do estabelecimento.' : null,
  ].filter((line): line is string => line !== null)

  return {
    uid: event.appointmentId,
    title: event.businessName ? `${serviceName} — ${event.businessName}` : serviceName,
    startUtc: new Date(event.startIso),
    durationMin: event.durationMin,
    location: event.address,
    description: descriptionLines.join('\n'),
    tentative: event.pendingConfirmation,
    timezone: event.timezone,
  }
}

export function SuccessScreen({
  serviceName,
  professionalName,
  dateLabel,
  time,
  calendarEvent,
  onNewBooking,
}: SuccessScreenProps) {
  const calendarInput = calendarEvent ? toCalendarInput(calendarEvent, serviceName, professionalName) : null
  const pending = calendarEvent?.pendingConfirmation ?? false

  const handleDownloadIcs = () => {
    if (!calendarInput) return
    const blob = new Blob([buildIcs(calendarInput)], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'agendamento.ics'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 pt-8 text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {pending ? 'Agendamento Recebido!' : 'Agendamento Confirmado!'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {pending
                ? 'Seu horário foi reservado e aguarda a confirmação do estabelecimento.'
                : 'Seu horário foi reservado com sucesso. Em breve você receberá uma confirmação.'}
            </p>
          </div>
          <Separator />
          <div className="space-y-1 text-left text-sm">
            <p><span className="text-muted-foreground">Serviço: </span><strong>{serviceName}</strong></p>
            {professionalName && (
              <p><span className="text-muted-foreground">Profissional: </span><strong>{professionalName}</strong></p>
            )}
            <p><span className="text-muted-foreground">Data e Hora: </span><strong>{dateLabel}, {time}</strong></p>
          </div>
          {calendarInput && (
            <div className="space-y-2">
              <Button asChild size="lg" className="w-full">
                <a href={buildGoogleCalendarUrl(calendarInput)} target="_blank" rel="noopener noreferrer">
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Adicionar ao Google Agenda
                </a>
              </Button>
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={handleDownloadIcs}>
                <Download className="mr-2 h-4 w-4" />
                Baixar para Apple Calendário ou Outlook (.ics)
              </Button>
            </div>
          )}
          <Button variant={calendarInput ? 'outline' : 'default'} onClick={onNewBooking} className="w-full">
            Fazer Novo Agendamento
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
