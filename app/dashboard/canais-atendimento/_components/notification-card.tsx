'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { MessagePreview } from './message-preview';
import { VariableHelper } from './variable-helper';
import { FeedbackDialog } from './feedback-dialog';
import { TestMessageDialog } from './test-message-dialog';
import { sendTestMessageAction } from '@/app/actions/whatsapp';

interface NotificationCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  message: string;
  onMessageChange: (message: string) => void;
  delayValue: number;
  onDelayChange: (delay: number) => void;
  delayLabel: string;
  delayUnit: string;
  testType: 'create' | 'cancel' | 'confirmation' | 'reminder';
  disabled?: boolean;
  defaultPhone?: string;
}

export function NotificationCard({
  title,
  description,
  icon,
  enabled,
  onEnabledChange,
  message,
  onMessageChange,
  delayValue,
  onDelayChange,
  delayLabel,
  delayUnit,
  testType,
  disabled = false,
  defaultPhone,
}: NotificationCardProps) {
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const handleSendTest = async (phoneNumber: string) => {
    setSending(true);
    try {
      const result = await sendTestMessageAction(testType, phoneNumber, message);

      setFeedbackSuccess(result.success);
      setShowTestDialog(false);
      setShowFeedback(true);
    } catch (error) {
      console.error('Test message error:', error);
      setFeedbackSuccess(false);
      setShowTestDialog(false);
      setShowFeedback(true);
    } finally {
      setSending(false);
    }
  };

  const handleInsertVariable = (variable: string) => {
    // Insert at cursor position or append to end
    const textarea = document.getElementById(`message-${testType}`) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.substring(0, start) + variable + message.substring(end);
      onMessageChange(newMessage);

      // Set cursor position after inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      onMessageChange(message + variable);
    }
  };

  return (
    <>
      <Card className={disabled ? 'opacity-60' : ''}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                {icon}
              </div>
              <div>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={onEnabledChange}
              disabled={disabled}
            />
          </div>
        </CardHeader>

        {enabled && (
          <CardContent className="space-y-4">
            {/* Delay Configuration */}
            <div className="space-y-2">
              <Label htmlFor={`delay-${testType}`}>{delayLabel}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`delay-${testType}`}
                  type="number"
                  min="0"
                  value={delayValue}
                  onChange={(e) => onDelayChange(parseInt(e.target.value) || 0)}
                  className="w-24"
                  disabled={disabled}
                />
                <span className="text-sm text-muted-foreground">{delayUnit}</span>
              </div>
            </div>

            {/* Message Template */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`message-${testType}`}>Mensagem</Label>
                <VariableHelper onInsert={handleInsertVariable} />
              </div>
              <Textarea
                id={`message-${testType}`}
                value={message}
                onChange={(e) => onMessageChange(e.target.value)}
                placeholder="Digite sua mensagem usando variáveis como {{nome_cliente}}, {{data}}, {{hora}}..."
                rows={4}
                maxLength={500}
                disabled={disabled}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Use variáveis para personalizar a mensagem</span>
                <span>{message.length}/500</span>
              </div>
            </div>

            {/* Message Preview */}
            <MessagePreview message={message} />

            {/* Test Button Configured to open Dialog */}
            <Button
              variant="outline"
              onClick={() => setShowTestDialog(true)}
              disabled={disabled || sending || !message}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar Mensagem de Teste
            </Button>
          </CardContent>
        )}
      </Card>

      <TestMessageDialog
        open={showTestDialog}
        onOpenChange={setShowTestDialog}
        onSend={handleSendTest}
        loading={sending}
        defaultPhone={defaultPhone}
        typeLabel={title}
      />

      <FeedbackDialog
        open={showFeedback}
        onOpenChange={setShowFeedback}
        success={feedbackSuccess}
      />
    </>
  );
}
