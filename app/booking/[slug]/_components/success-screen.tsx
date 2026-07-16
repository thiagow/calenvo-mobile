'use client'

import { CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface SuccessScreenProps {
  serviceName: string
  professionalName: string | null
  dateLabel: string
  time: string
  onNewBooking: () => void
}

export function SuccessScreen({ serviceName, professionalName, dateLabel, time, onNewBooking }: SuccessScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 pt-8 text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Agendamento Confirmado!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Seu horário foi reservado com sucesso. Em breve você receberá uma confirmação.
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
          <Button onClick={onNewBooking} className="w-full">
            Fazer Novo Agendamento
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
