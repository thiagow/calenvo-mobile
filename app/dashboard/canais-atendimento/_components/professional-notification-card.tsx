'use client';

import type { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle } from 'lucide-react';
import { VariableHelper } from './variable-helper';
import { MessagePreview } from './message-preview';

interface ProfessionalNotificationCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  message: string;
  onMessageChange: (message: string) => void;
  disabled?: boolean;
}

/**
 * Card de aviso enviado ao PROFISSIONAL (não ao cliente): toggle + mensagem
 * personalizável. Usado para cancelamento e para novo agendamento feitos pelo
 * próprio cliente (página pública ou chat).
 */
export function ProfessionalNotificationCard({
  title,
  description,
  icon,
  enabled,
  onEnabledChange,
  message,
  onMessageChange,
  disabled = false,
}: ProfessionalNotificationCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1">{icon}</div>
            <div className="space-y-1">
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={onEnabledChange} disabled={disabled} />
        </div>
      </CardHeader>
      {enabled && (
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Enviada para o WhatsApp do profissional responsável (ou para o seu, se não houver um definido).
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">Mensagem personalizada</label>
            <Textarea
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder="Digite a mensagem para o profissional"
              disabled={disabled}
              rows={3}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">Máximo 1000 caracteres</p>
          </div>

          <VariableHelper />
          <MessagePreview message={message} />
        </CardContent>
      )}
    </Card>
  );
}
