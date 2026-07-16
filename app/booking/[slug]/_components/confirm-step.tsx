'use client'

import { Calendar, Clock, MapPin, Sparkles, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { applyPhoneMask, formatCurrency } from '@/lib/utils'
import type { BookingProfessional, BookingService } from './types'

interface ConfirmStepProps {
  service: BookingService
  professional: BookingProfessional | null
  date: Date
  time: string
  address: string | null
  clientName: string
  clientPhone: string
  clientEmail: string
  onChangeName: (value: string) => void
  onChangePhone: (value: string) => void
  onChangeEmail: (value: string) => void
}

export function ConfirmStep({
  service,
  professional,
  date,
  time,
  address,
  clientName,
  clientPhone,
  clientEmail,
  onChangeName,
  onChangePhone,
  onChangeEmail,
}: ConfirmStepProps) {
  const dateLabel = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <Label htmlFor="clientName">Nome Completo *</Label>
          <Input
            id="clientName"
            value={clientName}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Seu nome completo"
            required
          />
        </div>
        <div>
          <Label htmlFor="clientPhone">WhatsApp *</Label>
          <Input
            id="clientPhone"
            value={clientPhone}
            onChange={(e) => onChangePhone(applyPhoneMask(e.target.value))}
            placeholder="(00) 00000-0000"
            required
          />
        </div>
        <div>
          <Label htmlFor="clientEmail">E-mail (opcional)</Label>
          <Input
            id="clientEmail"
            type="email"
            value={clientEmail}
            onChange={(e) => onChangeEmail(e.target.value)}
            placeholder="seu@email.com"
          />
        </div>
      </div>

      <Card className="bg-primary/[0.03]">
        <CardContent className="space-y-3 p-4 text-sm">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="text-muted-foreground">Serviço: </span>
              <strong>{service.name}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="text-muted-foreground">Profissional: </span>
              <strong>{professional?.name || 'Qualquer profissional'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Calendar className="h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="text-muted-foreground">Data: </span>
              <strong>{dateLabel}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="text-muted-foreground">Horário: </span>
              <strong>{time}</strong>
            </span>
          </div>
          {address && (
            <div className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <span>
                <span className="text-muted-foreground">Local: </span>
                <strong>{address}</strong>
              </span>
            </div>
          )}
          {service.price != null && (
            <>
              <Separator />
              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>{formatCurrency(service.price)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
