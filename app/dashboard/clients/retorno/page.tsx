'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CalendarClock, Hourglass, MessageCircle, Phone, RotateCcw, Send, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientsTabs } from '@/components/clients/clients-tabs'
import { ReactivationSendDialog } from '@/components/clients/reactivation-send-dialog'
import { useSegmentConfig } from '@/contexts/segment-context'
import { useReactivationSummary } from '@/hooks/use-reactivation-summary'
import { cn, formatPhone } from '@/lib/utils'
import type { ReactivationItem, ReturnBucket } from '@/lib/reactivation-service'

interface ReactivationResponse {
  items: ReactivationItem[]
  counts: Record<ReturnBucket, number>
  conversion: { windowDays: number; notified: number; returned: number }
  servicesWithInterval: number
  canSend: boolean
  whatsAppConnected: boolean
  cooldownDays: number
  maxItemsPerSend: number
  businessName: string
  bookingLink: string
}

const keyOf = (i: Pick<ReactivationItem, 'clientId' | 'serviceId'>) => `${i.clientId}:${i.serviceId}`

const shortDate = (dateStr: string) => {
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

function daysAgoLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Avisado hoje'
  if (days === 1) return 'Avisado ontem'
  return `Avisado há ${days} dias`
}

function urgency(item: ReactivationItem): { label: string; className: string } {
  if (item.bucket === 'upcoming') {
    return {
      label: item.daysUntilDue === 0 ? 'vence hoje' : item.daysUntilDue === 1 ? 'vence amanhã' : `em ${item.daysUntilDue} dias`,
      className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    }
  }
  const label = `${item.daysOverdue} ${item.daysOverdue === 1 ? 'dia' : 'dias'} de atraso`
  // Severidade relativa ao prazo do serviço, nunca em dias absolutos
  const severe = item.bucket === 'lost' || item.daysOverdue > item.returnIntervalDays
  return {
    label,
    className: severe ? 'bg-red-500/10 text-red-700 dark:text-red-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  }
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

export default function ReturnPage() {
  const { config } = useSegmentConfig()
  const t = config.terminology
  const { refresh: refreshSummary } = useReactivationSummary()

  const [data, setData] = useState<ReactivationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<ReturnBucket>('overdue')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reactivation')
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      toast.error('Erro ao carregar a lista de retorno')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Seleção vale só para a aba visível — trocar de aba limpa.
  useEffect(() => setSelected(new Set()), [tab])

  const tabItems = useMemo(() => (data?.items ?? []).filter(i => i.bucket === tab), [data, tab])

  // Agrupa por cliente preservando a ordem de urgência do primeiro serviço.
  const groups = useMemo(() => {
    const map = new Map<string, ReactivationItem[]>()
    for (const item of tabItems) map.set(item.clientId, [...(map.get(item.clientId) ?? []), item])
    return Array.from(map.values())
  }, [tabItems])

  const selectedItems = tabItems.filter(i => selected.has(keyOf(i)))
  const selectedClients = new Set(selectedItems.map(i => i.clientId)).size
  const allSelected = tabItems.length > 0 && selectedItems.length === tabItems.length
  const canSend = !!data?.canSend

  const toggle = (keys: string[], on: boolean) =>
    setSelected(prev => {
      const next = new Set(prev)
      for (const k of keys) (on ? next.add(k) : next.delete(k))
      return next
    })

  const openSend = () => {
    if (!data) return
    if (selectedItems.length > data.maxItemsPerSend) {
      toast.error(`Envie no máximo ${data.maxItemsPerSend} mensagens por vez`)
      return
    }
    setDialogOpen(true)
  }

  const tabs: { id: ReturnBucket; label: string; icon: typeof AlertTriangle }[] = [
    { id: 'overdue', label: 'Atrasados', icon: AlertTriangle },
    { id: 'upcoming', label: 'Próximos', icon: CalendarClock },
    { id: 'lost', label: 'Perdidos', icon: UserX },
  ]

  const emptyCopy: Record<ReturnBucket, string> = {
    overdue: `Nenhum ${t.client.toLowerCase()} com retorno atrasado. Tudo em dia.`,
    upcoming: `Nenhum ${t.client.toLowerCase()} com retorno previsto para os próximos dias.`,
    lost: `Nenhum ${t.client.toLowerCase()} sumido há muito tempo.`,
  }

  return (
    <div className={cn('space-y-4', selectedItems.length > 0 && 'pb-24')}>
      <ClientsTabs />

      <div>
        <h1 className="text-lg font-semibold tracking-tight">Retorno de {t.clients.toLowerCase()}</h1>
        <p className="text-sm text-muted-foreground">
          Quem está perto de voltar e quem já passou do prazo, por {t.service.toLowerCase()}.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-11 w-full rounded-xl" />
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : !data ? null : data.servicesWithInterval === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <RotateCcw className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Defina o retorno médio dos seus {t.services.toLowerCase()}</p>
              <p className="text-sm text-muted-foreground">
                Informe em quanto tempo {t.clients.toLowerCase()} costumam voltar para cada {t.service.toLowerCase()}. A
                partir disso, esta tela mostra quem avisar.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/dashboard/services">Configurar {t.services.toLowerCase()}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {data.conversion.notified > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <MessageCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">Últimos {data.conversion.windowDays} dias: </span>
                <span className="font-medium tabular-nums">{data.conversion.notified} avisados</span>
                <span className="text-muted-foreground"> · </span>
                <span className="font-medium tabular-nums text-emerald-600">
                  {data.conversion.returned} voltaram ({Math.round((data.conversion.returned / data.conversion.notified) * 100)}%)
                </span>
              </p>
            </div>
          )}

          {canSend && !data.whatsAppConnected && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                Conecte o WhatsApp para enviar lembretes.{' '}
                <Link href="/dashboard/canais-atendimento" className="font-medium text-primary underline-offset-2 hover:underline">
                  Conectar agora
                </Link>
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="tablist">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors',
                  tab === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="hidden h-3.5 w-3.5 sm:block" />
                {label}
                <span className="tabular-nums text-xs text-muted-foreground">{data.counts[id]}</span>
              </button>
            ))}
          </div>

          {tab === 'lost' && tabItems.length > 0 && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Hourglass className="h-3.5 w-3.5" />
              Atraso maior que o dobro do prazo do {t.service.toLowerCase()}.
            </p>
          )}

          {tabItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <RotateCcw className="h-9 w-9 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{emptyCopy[tab]}</p>
            </div>
          ) : (
            <>
              {canSend && (
                <div className="flex items-center justify-between px-1">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={v => toggle(tabItems.map(keyOf), v === true)}
                      aria-label="Selecionar todos"
                    />
                    Selecionar todos
                  </label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {groups.length} {groups.length === 1 ? t.client.toLowerCase() : t.clients.toLowerCase()} · {tabItems.length}{' '}
                    {tabItems.length === 1 ? t.service.toLowerCase() : t.services.toLowerCase()}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                {groups.map(group => {
                  const first = group[0]
                  const keys = group.map(keyOf)
                  const groupSelected = keys.filter(k => selected.has(k)).length
                  return (
                    <Card key={first.clientId} className="overflow-hidden border border-border">
                      <CardContent className="p-0">
                        <div className="flex items-center gap-3 px-4 pb-2 pt-3">
                          {canSend && (
                            <Checkbox
                              checked={groupSelected === keys.length ? true : groupSelected > 0 ? 'indeterminate' : false}
                              onCheckedChange={v => toggle(keys, v === true)}
                              aria-label={`Selecionar ${first.clientName}`}
                            />
                          )}
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {initials(first.clientName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{first.clientName}</p>
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {formatPhone(first.clientPhone)}
                            </p>
                          </div>
                        </div>

                        <ul className="divide-y divide-border border-t border-border">
                          {group.map(item => {
                            const u = urgency(item)
                            const key = keyOf(item)
                            const Row = canSend ? 'label' : 'div'
                            return (
                              <li key={key}>
                                <Row className={cn('flex items-start gap-3 px-4 py-2.5', canSend && 'cursor-pointer hover:bg-muted/40')}>
                                  {canSend && (
                                    <Checkbox
                                      className="mt-0.5"
                                      checked={selected.has(key)}
                                      onCheckedChange={v => toggle([key], v === true)}
                                      aria-label={`${first.clientName} — ${item.serviceName}`}
                                    />
                                  )}
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="truncate text-sm font-medium">{item.serviceName}</span>
                                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', u.className)}>
                                        {u.label}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Último em {shortDate(item.lastDate)}
                                      {item.professionalName ? ` com ${item.professionalName}` : ''} · previsto {shortDate(item.expectedDate)}
                                    </p>
                                    {(item.lastNotifiedAt || item.nextAppointmentDate) && (
                                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                                        {item.lastNotifiedAt && (
                                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                            {daysAgoLabel(item.lastNotifiedAt)}
                                          </span>
                                        )}
                                        {item.nextAppointmentDate && (
                                          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                                            Tem {t.appointment.toLowerCase()} em {shortDate(item.nextAppointmentDate)}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </Row>
                              </li>
                            )
                          })}
                        </ul>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {canSend && selectedItems.length > 0 && data && (
        <div
          className="fixed inset-x-0 z-40 px-4"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 0.75rem)' }}
        >
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
            <div className="text-sm leading-tight">
              <p className="font-semibold tabular-nums">
                {selectedItems.length} {selectedItems.length === 1 ? 'mensagem' : 'mensagens'}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {selectedClients} {selectedClients === 1 ? t.client.toLowerCase() : t.clients.toLowerCase()}
              </p>
            </div>
            <Button onClick={openSend} disabled={!data.whatsAppConnected} className="gap-2">
              <Send className="h-4 w-4" />
              Enviar lembrete
            </Button>
          </div>
        </div>
      )}

      {data && (
        <ReactivationSendDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          items={selectedItems}
          businessName={data.businessName}
          bookingLink={data.bookingLink}
          cooldownDays={data.cooldownDays}
          onSent={() => {
            setSelected(new Set())
            load()
            refreshSummary()
          }}
        />
      )}
    </div>
  )
}
