'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface SlotSettingsCardProps {
  startInterval: number
  smartScheduling: boolean
  onChange: (next: { startInterval?: number; smartScheduling?: boolean }) => void
}

const INTERVAL_LABELS: Record<number, string> = {
  0: 'Igual à duração do serviço',
  15: 'A cada 15 minutos',
  30: 'A cada 30 minutos',
  60: 'A cada 60 minutos',
}

/**
 * Como a agenda oferece horários de início. Só muda o que aparece para NOVOS agendamentos;
 * o que já foi marcado nunca é alterado.
 */
export function SlotSettingsCard({ startInterval, smartScheduling, onChange }: SlotSettingsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Horários oferecidos</CardTitle>
        <CardDescription>
          Como os horários de início aparecem para novos agendamentos. Agendamentos já marcados não são afetados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="startInterval">Oferecer horários</Label>
          <Select value={String(startInterval)} onValueChange={(value) => onChange({ startInterval: Number(value) })}>
            <SelectTrigger id="startInterval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(INTERVAL_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Menos minutos = mais opções para o cliente escolher. “Igual à duração” oferece um horário após o outro.
          </p>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="smartScheduling" className="cursor-pointer">
              Agendamento inteligente
            </Label>
            <p className="text-xs text-muted-foreground">
              Esconde horários que deixariam vãos curtos demais para caber qualquer serviço desta agenda, evitando
              buracos na sua agenda. No painel você continua vendo todos os horários.
            </p>
          </div>
          <Switch
            id="smartScheduling"
            checked={smartScheduling}
            onCheckedChange={(checked) => onChange({ smartScheduling: checked })}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default SlotSettingsCard
