'use client';

import { useState, useEffect } from 'react';
import { WhatsAppConfig } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { NotificationCard } from './notification-card';
import { Bell, CalendarCheck, CalendarX, Clock, AlertCircle, Send, Loader2 } from 'lucide-react';
import { FeedbackDialog } from './feedback-dialog';
import { useToast } from '@/hooks/use-toast';
import { updateWhatsAppSettingsAction, sendTestMessageAction } from '@/app/actions/whatsapp';
import { VariableHelper } from './variable-helper';
import { MessagePreview } from './message-preview';
import { Textarea } from '@/components/ui/textarea';
import { TestMessageDialog } from './test-message-dialog';

interface NotificationSettingsProps {
  config: WhatsAppConfig;
  disabled?: boolean;
}

export function NotificationSettings({ config, disabled = false }: NotificationSettingsProps) {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Confirmation on creation
  const [notifyOnCreate, setNotifyOnCreate] = useState(config.notifyOnCreate);
  const [createDelayMinutes, setCreateDelayMinutes] = useState(config.createDelayMinutes);
  const [createMessage, setCreateMessage] = useState(config.createMessage || '');

  // Cancellation notification
  const [notifyOnCancel, setNotifyOnCancel] = useState(config.notifyOnCancel);
  const [cancelMessage, setCancelMessage] = useState(config.cancelMessage || '');

  // Confirmation (days before)
  const [notifyConfirmation, setNotifyConfirmation] = useState(config.notifyConfirmation);
  const [confirmationDays, setConfirmationDays] = useState(config.confirmationDays);
  const [confirmationMessage, setConfirmationMessage] = useState(config.confirmationMessage || '');

  // Cancel Test State
  const [showCancelTestDialog, setShowCancelTestDialog] = useState(false);
  const [sendingCancelTest, setSendingCancelTest] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // Reminder (hours before)
  const [notifyReminder, setNotifyReminder] = useState(config.notifyReminder);
  const [reminderHours, setReminderHours] = useState(config.reminderHours);
  const [reminderMessage, setReminderMessage] = useState(config.reminderMessage || '');

  // Track if there are unsaved changes
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const changed =
      notifyOnCreate !== config.notifyOnCreate ||
      createDelayMinutes !== config.createDelayMinutes ||
      createMessage !== (config.createMessage || '') ||
      notifyOnCancel !== config.notifyOnCancel ||
      cancelMessage !== (config.cancelMessage || '') ||
      notifyConfirmation !== config.notifyConfirmation ||
      confirmationDays !== config.confirmationDays ||
      confirmationMessage !== (config.confirmationMessage || '') ||
      notifyReminder !== config.notifyReminder ||
      reminderHours !== config.reminderHours ||
      reminderMessage !== (config.reminderMessage || '');

    setHasChanges(changed);
  }, [
    notifyOnCreate,
    createDelayMinutes,
    createMessage,
    notifyOnCancel,
    cancelMessage,
    notifyConfirmation,
    confirmationDays,
    confirmationMessage,
    notifyReminder,
    reminderHours,
    reminderMessage,
    config,
  ]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateWhatsAppSettingsAction({
        enabled: config.enabled,
        notifyOnCreate,
        createDelayMinutes,
        createMessage,
        notifyOnCancel,
        cancelDelayMinutes: 0, // v3.0: Always send immediately
        cancelMessage,
        notifyConfirmation,
        confirmationDays,
        confirmationMessage,
        notifyReminder,
        reminderHours,
        reminderMessage,
      });

      if (result.success) {
        toast({
          title: 'Configurações salvas',
          description: 'As configurações de notificações foram atualizadas',
        });
        setHasChanges(false);
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Falha ao salvar configurações',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Save settings error:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar configurações',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendCancelTest = async (phoneNumber: string) => {
    setSendingCancelTest(true);
    try {
      const result = await sendTestMessageAction('cancel', phoneNumber, cancelMessage);

      setFeedbackSuccess(result.success);
      setShowCancelTestDialog(false);
      setShowFeedback(true);
    } catch (error) {
      console.error('Test message error:', error);
      setFeedbackSuccess(false);
      setShowCancelTestDialog(false);
      setShowFeedback(true);
    } finally {
      setSendingCancelTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Confirmation on Creation */}
      <NotificationCard
        title="Confirmação de Agendamento"
        description="Enviada logo após o cliente agendar"
        icon={<CalendarCheck className="h-5 w-5 text-primary" />}
        enabled={notifyOnCreate}
        onEnabledChange={setNotifyOnCreate}
        message={createMessage}
        onMessageChange={setCreateMessage}
        delayValue={createDelayMinutes}
        onDelayChange={setCreateDelayMinutes}
        delayLabel="Enviar após (em minutos)"
        delayUnit="minutos"
        testType="create"
        disabled={disabled}
        defaultPhone={config.phoneNumber || undefined}
      />

      {/* 2. Cancellation Notification (v3.0 - Real-time only) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <CalendarX className="h-5 w-5 text-destructive mt-1" />
              <div className="space-y-1">
                <CardTitle className="text-base">Notificação de Cancelamento</CardTitle>
                <CardDescription>
                  Enviada imediatamente quando um agendamento é cancelado
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={notifyOnCancel}
              onCheckedChange={setNotifyOnCancel}
              disabled={disabled}
            />
          </div>
        </CardHeader>
        {notifyOnCancel && (
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Esta notificação é enviada em tempo real, sem atraso configurável.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mensagem personalizada</label>
              <Textarea
                value={cancelMessage}
                onChange={(e) => setCancelMessage(e.target.value)}
                placeholder="Digite a mensagem de cancelamento"
                disabled={disabled}
                rows={3}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">
                Máximo 1000 caracteres
              </p>
            </div>

            <VariableHelper />
            <MessagePreview message={cancelMessage} />

            <Button
              variant="outline"
              onClick={() => setShowCancelTestDialog(true)}
              disabled={disabled || sendingCancelTest || !cancelMessage}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar Mensagem de Teste
            </Button>
          </CardContent>
        )}
      </Card>

      {/* 3. Presence Confirmation (days before) */}
      <NotificationCard
        title="Confirmação de Presença"
        description="Enviada alguns dias antes do agendamento"
        icon={<Bell className="h-5 w-5 text-blue-600" />}
        enabled={notifyConfirmation}
        onEnabledChange={setNotifyConfirmation}
        message={confirmationMessage}
        onMessageChange={setConfirmationMessage}
        delayValue={confirmationDays}
        onDelayChange={setConfirmationDays}
        delayLabel="Enviar quantos dias antes"
        delayUnit="dias"
        testType="confirmation"
        disabled={disabled}
        defaultPhone={config.phoneNumber || undefined}
      />

      {/* 4. Reminder (hours before) */}
      <NotificationCard
        title="Lembrete"
        description="Enviada algumas horas antes do agendamento"
        icon={<Clock className="h-5 w-5 text-amber-600" />}
        enabled={notifyReminder}
        onEnabledChange={setNotifyReminder}
        message={reminderMessage}
        onMessageChange={setReminderMessage}
        delayValue={reminderHours}
        onDelayChange={setReminderHours}
        delayLabel="Enviar quantas horas antes"
        delayUnit="horas"
        testType="reminder"
        disabled={disabled}
        defaultPhone={config.phoneNumber || undefined}
      />

      {/* Save Button */}
      {hasChanges && (
        <div className="sticky bottom-4 bg-background pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={saving || disabled}
            className="w-full"
            size="lg"
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      )}
      <TestMessageDialog
        open={showCancelTestDialog}
        onOpenChange={setShowCancelTestDialog}
        onSend={handleSendCancelTest}
        loading={sendingCancelTest}
        defaultPhone={config.phoneNumber || undefined}
        typeLabel="Cancelamento"
      />

      <FeedbackDialog
        open={showFeedback}
        onOpenChange={setShowFeedback}
        success={feedbackSuccess}
      />
    </div>
  );
}
