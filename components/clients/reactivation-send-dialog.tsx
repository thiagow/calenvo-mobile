'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { buildReactivationVars, pickTemplate, renderTemplate, type TemplateRef } from '@/lib/message-template'
import type { ReactivationItem } from '@/lib/reactivation-service'

const PER_SERVICE = '__per_service__'

interface TemplateOption extends TemplateRef {
  name: string
}

interface ReactivationSendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ReactivationItem[]
  businessName: string
  bookingLink: string
  cooldownDays: number
  onSent: () => void
}

export function ReactivationSendDialog({
  open,
  onOpenChange,
  items,
  businessName,
  bookingLink,
  cooldownDays,
  onSent,
}: ReactivationSendDialogProps) {
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [templateChoice, setTemplateChoice] = useState(PER_SERVICE)
  const [force, setForce] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setPreviewIndex(0)
    setForce(false)
    setTemplateChoice(PER_SERVICE)
    fetch('/api/message-templates')
      .then(r => (r.ok ? r.json() : null))
      .then(data => data && setTemplates(data.templates))
      .catch(() => {})
  }, [open])

  const recentCount = items.filter(i => i.recentlyNotified).length
  const toSend = force ? items : items.filter(i => !i.recentlyNotified)
  const clientsWithMultiple = useMemo(() => {
    const perClient = new Map<string, number>()
    for (const i of toSend) perClient.set(i.clientId, (perClient.get(i.clientId) ?? 0) + 1)
    return Array.from(perClient.values()).filter(n => n > 1).length
  }, [toSend])

  const forcedTemplateId = templateChoice === PER_SERVICE ? null : templateChoice
  const previewItem = toSend[Math.min(previewIndex, toSend.length - 1)]
  const previewText = previewItem
    ? renderTemplate(
        pickTemplate(previewItem, templates, forcedTemplateId).body,
        buildReactivationVars(previewItem, businessName, bookingLink)
      )
    : ''

  const send = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/reactivation/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ clientId: i.clientId, serviceId: i.serviceId })),
          templateId: forcedTemplateId,
          force,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar lembretes')

      const skipped = (data.skippedRecent ?? 0) + (data.skippedIneligible ?? 0)
      toast.success(
        `${data.queued} ${data.queued === 1 ? 'lembrete enviado' : 'lembretes enviados'} para a fila`,
        { description: skipped > 0 ? `${skipped} ${skipped === 1 ? 'foi pulado' : 'foram pulados'}.` : 'As mensagens saem espaçadas nos próximos minutos.' }
      )
      onOpenChange(false)
      onSent()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar lembretes')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar lembrete de retorno</DialogTitle>
          <DialogDescription>
            {toSend.length} {toSend.length === 1 ? 'mensagem' : 'mensagens'} pelo WhatsApp, uma por serviço.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Modelo de mensagem</Label>
            <Select value={templateChoice} onValueChange={setTemplateChoice}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PER_SERVICE}>Usar o modelo de cada serviço</SelectItem>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.isDefault ? ' (padrão)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {previewItem && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Prévia para {previewItem.clientName} · {previewItem.serviceName}
                </span>
                {toSend.length > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label="Prévia anterior"
                      disabled={previewIndex === 0}
                      onClick={() => setPreviewIndex(i => i - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {Math.min(previewIndex, toSend.length - 1) + 1}/{toSend.length}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label="Próxima prévia"
                      disabled={previewIndex >= toSend.length - 1}
                      onClick={() => setPreviewIndex(i => i + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-950 whitespace-pre-wrap break-words dark:bg-emerald-950/40 dark:text-emerald-50">
                {previewText}
              </div>
            </div>
          )}

          {(clientsWithMultiple > 0 || recentCount > 0) && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              {clientsWithMultiple > 0 && (
                <p>
                  {clientsWithMultiple} {clientsWithMultiple === 1 ? 'cliente vai' : 'clientes vão'} receber mais de uma
                  mensagem (uma por serviço).
                </p>
              )}
              {recentCount > 0 && (
                <div className="flex items-start gap-2">
                  <Checkbox id="force-resend" checked={force} onCheckedChange={v => setForce(v === true)} className="mt-0.5" />
                  <label htmlFor="force-resend" className="cursor-pointer leading-snug">
                    {recentCount} {recentCount === 1 ? 'já foi avisado' : 'já foram avisados'} nos últimos {cooldownDays} dias e{' '}
                    {recentCount === 1 ? 'será pulado' : 'serão pulados'}. <span className="font-medium text-foreground">Enviar mesmo assim</span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={send} disabled={sending || toSend.length === 0} className="gap-2">
            <Send className="h-4 w-4" />
            {sending ? 'Enviando...' : `Enviar ${toSend.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
