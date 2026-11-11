'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, Crown, HandCoins, Loader2, Package, Percent, Plus, Settings2, Trash2, Wallet, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ErrorState } from '@/components/finance/empty-state'
import { Money, MoneyInput } from '@/components/finance/money'
import { SegmentedControl } from '@/components/finance/segmented-control'
import { FINANCE_CHANGED_EVENT } from '@/components/finance/close-sale-sheet'
import type { PaymentMethodOption } from '@/components/finance/payment-split'
import { financeFetch } from '@/lib/finance/client'
import { formatBps, formatMoney, parsePercentToBps, type CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'
import { FinanceShell } from '../_components/finance-shell'

interface Rule {
  id: string
  serviceId: string | null
  type: 'PERCENT' | 'FIXED'
  valueBps: number | null
  valueCents: number | null
  serviceName?: string
}

interface Adjustment {
  id: string
  kind: 'ADVANCE' | 'BONUS' | 'DEDUCTION'
  amountCents: number
  description: string
  createdAt: string
}

interface Professional {
  id: string
  name: string | null
  email: string
  isActive: boolean
  isOwner: boolean
  canOperateCash: boolean
  defaultRule: Rule | null
  serviceRules: Rule[]
  pendingCents: number
  pendingCount: number
  openAdjustments: Adjustment[]
}

interface Team {
  services: { id: string; name: string; priceCents: number | null }[]
  professionals: Professional[]
}

interface SettlementRow {
  id: string
  professionalName: string | null
  paidAt: string
  status: 'PAID' | 'CANCELLED'
  netCents: number
  paymentMethod: string | null
}

const ADJUSTMENT_LABELS = { ADVANCE: 'Vale', BONUS: 'Bônus', DEDUCTION: 'Desconto' } as const

function ruleLabel(rule: Pick<Rule, 'type' | 'valueBps' | 'valueCents'>, currency: CurrencyCode) {
  return rule.type === 'PERCENT' ? `${formatBps(rule.valueBps ?? 0)}%` : formatMoney(rule.valueCents ?? 0, currency)
}

export default function CommissionsPage() {
  return (
    <FinanceShell title="Comissões" description="Quanto cada profissional tem a receber, com vales descontados." access="master">
      {(finance) => (
        <Suspense>
          <CommissionsContent currency={finance.currency} />
        </Suspense>
      )}
    </FinanceShell>
  )
}

function CommissionsContent({ currency }: { currency: CurrencyCode }) {
  const searchParams = useSearchParams()
  const fromCash = searchParams.get('caixa')
  const [team, setTeam] = useState<Team | null>(null)
  const [settlements, setSettlements] = useState<SettlementRow[]>([])
  const [settling, setSettling] = useState<Professional | null>(null)
  const [editingRules, setEditingRules] = useState<Professional | null>(null)
  const [adjusting, setAdjusting] = useState<Professional | null>(null)
  const [failed, setFailed] = useState(false)
  // "Acertar todos": fila de profissionais, um acerto de cada vez (cada um confere o próprio total).
  const [queueIds, setQueueIds] = useState<string[]>([])

  const load = useCallback(async () => {
    try {
      const [teamData, { settlements }] = await Promise.all([
        financeFetch<Team>('/api/finance/team'),
        financeFetch<{ settlements: SettlementRow[] }>('/api/finance/settlements')
      ])
      setTeam(teamData)
      setSettlements(settlements)
      setEditingRules((current) => (current ? teamData.professionals.find((p) => p.id === current.id) ?? null : null))
      setAdjusting((current) => (current ? teamData.professionals.find((p) => p.id === current.id) ?? null : null))
      setFailed(false)
    } catch (err) {
      setFailed(true)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar comissões')
    }
  }, [])

  useEffect(() => {
    void load()
    window.addEventListener(FINANCE_CHANGED_EVENT, load)
    return () => window.removeEventListener(FINANCE_CHANGED_EVENT, load)
  }, [load])

  if (!team && failed) {
    return <ErrorState message="Não foi possível carregar as comissões." onRetry={() => void load()} />
  }

  if (!team) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  const settleable = team.professionals.filter((p) => p.pendingCount > 0 || p.openAdjustments.length > 0)
  const queued = queueIds.length > 0 ? team.professionals.find((p) => p.id === queueIds[0]) ?? null : null
  const advanceQueue = () => setQueueIds((q) => q.slice(1))
  const totalPending = team.professionals.reduce((a, p) => a + p.pendingCents, 0)
  const professionals = [...team.professionals].sort((a, b) => Number(a.isOwner) - Number(b.isOwner) || b.pendingCents - a.pendingCents)

  return (
    <div className="space-y-5">
      {fromCash && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <HandCoins className="h-4 w-4 text-primary" />
          Caixa fechado. Agora é só acertar com quem atendeu.
        </div>
      )}

      <div className="flex items-baseline justify-between px-0.5">
        <p className="text-xs text-muted-foreground">A acertar com a equipe</p>
        <Money cents={totalPending} currency={currency} className="text-xl font-semibold tracking-tight" />
      </div>
      {settleable.length > 1 && (
        <Button className="min-h-11 w-full" variant="outline" onClick={() => setQueueIds(settleable.map((p) => p.id))}>
          Acertar todos ({settleable.length})
        </Button>
      )}
      <p className="-mt-3 px-0.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Acertar</span> paga as comissões de uma vez.{' '}
        <span className="font-medium text-foreground">Vale</span> é adiantamento, descontado no próximo acerto.
      </p>

      <ul className="space-y-2.5">
        {professionals.map((p) => (
          <li key={p.id}>
            <Card className={cn('border border-border', !p.isActive && 'opacity-60')}>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium">
                      {p.name}
                      {p.isOwner && <Crown className="h-3.5 w-3.5 text-money-warn" aria-label="Dono da conta" />}
                    </p>
                    <ul className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                      {p.defaultRule ? (
                        <li className="rounded-full bg-muted px-2.5 py-1 font-medium tabular-nums">{ruleLabel(p.defaultRule, currency)} padrão</li>
                      ) : (
                        <li className={cn('rounded-full px-2.5 py-1', p.isOwner ? 'bg-muted text-muted-foreground' : 'bg-money-warn/10 font-medium text-money-warn')}>
                          {p.isOwner ? 'Dono · sem comissão' : 'Sem comissão definida'}
                        </li>
                      )}
                      {p.serviceRules.length > 0 && (
                        <li
                          className="rounded-full border border-border px-2.5 py-1 text-muted-foreground"
                          title={p.serviceRules.map((r) => ruleLabel(r, currency) + ' em ' + r.serviceName).join(' · ')}
                        >
                          {p.serviceRules.length} {p.serviceRules.length === 1 ? 'exceção' : 'exceções'}
                        </li>
                      )}
                    </ul>
                  </div>
                  <Button variant="outline" size="sm" className="min-h-11 flex-shrink-0" onClick={() => setEditingRules(p)} aria-label={'Regras de comissão de ' + (p.name ?? 'profissional')}>
                    <Settings2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Regras
                  </Button>
                </div>

                <div className="flex items-end justify-between gap-3">
                  <div>
                    <Money cents={p.pendingCents} currency={currency} className="block text-2xl font-semibold tracking-tight" />
                    <p className="text-xs text-muted-foreground">
                      {p.pendingCount === 0 && p.openAdjustments.length === 0
                        ? 'Nada a acertar agora'
                        : p.pendingCount + (p.pendingCount === 1 ? ' atendimento' : ' atendimentos') + ' a acertar'}
                      {p.openAdjustments.length > 0 &&
                        ` · ${p.openAdjustments.length} ${p.openAdjustments.length === 1 ? 'lançamento' : 'lançamentos'} de vale/bônus`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="min-h-11" onClick={() => setAdjusting(p)}>
                      <Wallet className="mr-1.5 h-4 w-4" aria-hidden="true" />
                      Vale
                    </Button>
                    <Button className="min-h-11" onClick={() => setSettling(p)} disabled={p.pendingCount === 0 && p.openAdjustments.length === 0}>
                      Acertar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {settlements.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acertos feitos</h2>
          <Card className="overflow-hidden border border-border">
            <CardContent className="p-0">
              {settlements.map((s, index) => (
                <div key={s.id}>
                  {index > 0 && <Separator />}
                  <Link href={`/dashboard/financeiro/acertos/${s.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                    <div className="flex-1">
                      <p className={cn('text-sm', s.status === 'CANCELLED' && 'line-through opacity-60')}>{s.professionalName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(s.paidAt))}
                        {s.paymentMethod && ` · ${s.paymentMethod}`}
                        {s.status === 'CANCELLED' && ' · cancelado'}
                      </p>
                    </div>
                    <Money cents={s.netCents} currency={currency} className="text-sm font-medium" />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <SettlementSheet
        professional={queued ?? settling}
        currency={currency}
        queue={queued ? { position: settleable.length - queueIds.length + 1, total: settleable.length } : undefined}
        onClose={() => {
          setSettling(null)
          setQueueIds([])
        }}
        onSettled={queued ? advanceQueue : undefined}
        onSkip={queued ? advanceQueue : undefined}
      />
      <RulesDialog professional={editingRules} services={team.services} currency={currency} onClose={() => setEditingRules(null)} onChanged={load} />
      <AdjustmentDialog professional={adjusting} currency={currency} onClose={() => setAdjusting(null)} onChanged={load} />
    </div>
  )
}

/* ------------------------------------ Acerto ------------------------------------ */

interface PreviewLine {
  id: string
  description: string
  clientName: string | null
  occurredAt: string
  baseCents: number
  ruleType: 'PERCENT' | 'FIXED'
  ruleValue: number
  amountCents: number
  isPackageSession: boolean
}

interface Preview {
  totals: { commissionsCents: number; bonusesCents: number; deductionsCents: number; netCents: number }
  commissions: PreviewLine[]
  waitingPayment: PreviewLine[]
  waitingPaymentCents: number
  adjustments: Adjustment[]
}

const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

function SettlementSheet({
  professional,
  currency,
  onClose,
  queue,
  onSettled,
  onSkip
}: {
  professional: Professional | null
  currency: CurrencyCode
  onClose: () => void
  /** Presente no "Acertar todos": posição na fila. */
  queue?: { position: number; total: number }
  /** Se informado, em vez de abrir o comprovante segue para o próximo da fila. */
  onSettled?: () => void
  onSkip?: () => void
}) {
  const router = useRouter()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [methods, setMethods] = useState<PaymentMethodOption[]>([])
  const [methodId, setMethodId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setPreview(null)
    if (!professional) return
    Promise.all([
      financeFetch<Preview>(`/api/finance/settlements/preview?professionalId=${professional.id}`),
      financeFetch<{ paymentMethods: PaymentMethodOption[] }>('/api/finance/payment-methods')
    ])
      .then(([p, { paymentMethods }]) => {
        setPreview(p)
        setMethods(paymentMethods)
        setMethodId(paymentMethods.find((m) => m.type === 'PIX')?.id ?? paymentMethods[0]?.id ?? '')
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao calcular o acerto'))
  }, [professional?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = async () => {
    if (!professional || !preview) return
    setSubmitting(true)
    try {
      const { settlement } = await financeFetch<{ settlement: { id: string } }>('/api/finance/settlements', {
        method: 'POST',
        body: JSON.stringify({ professionalId: professional.id, paymentMethodId: preview.totals.netCents > 0 ? methodId : null })
      })
      toast.success(`Acerto de ${formatMoney(preview.totals.netCents, currency)} com ${professional.name}`)
      window.dispatchEvent(new CustomEvent(FINANCE_CHANGED_EVENT))
      if (onSettled) {
        onSettled()
      } else {
        onClose()
        router.push(`/dashboard/financeiro/acertos/${settlement.id}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível concluir o acerto')
    } finally {
      setSubmitting(false)
    }
  }

  const t = preview?.totals
  return (
    <Sheet open={Boolean(professional)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-xl overflow-y-auto rounded-t-2xl px-4 pb-6 pt-5 sm:px-6">
        <SheetHeader className="space-y-1 pr-6 text-left">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <HandCoins className="h-3.5 w-3.5" />
            Acerto{queue && ` · ${queue.position} de ${queue.total}`}
          </div>
          <SheetTitle className="text-xl tracking-tight">{professional?.name}</SheetTitle>
          <SheetDescription>Comissões dos atendimentos já pagos, com vales e descontos abatidos.</SheetDescription>
        </SheetHeader>

        {!preview || !t ? (
          <div className="mt-5 space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {preview.commissions.length > 0 && (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {preview.commissions.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm">
                        {c.isPackageSession && <Package className="h-3.5 w-3.5 flex-shrink-0 text-primary" />}
                        {c.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {day.format(new Date(c.occurredAt))}
                        {c.clientName && ` · ${c.clientName}`} · {c.ruleType === 'PERCENT' ? `${formatBps(c.ruleValue)}% de ${formatMoney(c.baseCents, currency)}` : 'valor fixo'}
                      </p>
                    </div>
                    <Money cents={c.amountCents} currency={currency} className="text-sm font-medium" />
                  </li>
                ))}
              </ul>
            )}

            {preview.adjustments.length > 0 && (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {preview.adjustments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1">
                      <p className="text-sm">{a.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {ADJUSTMENT_LABELS[a.kind]} · {day.format(new Date(a.createdAt))}
                      </p>
                    </div>
                    <Money cents={a.kind === 'BONUS' ? a.amountCents : -a.amountCents} currency={currency} signed className={cn('text-sm font-medium', a.kind !== 'BONUS' && 'text-money-negative')} />
                  </li>
                ))}
              </ul>
            )}

            {preview.waitingPayment.length > 0 && (
              <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                {preview.waitingPayment.length} {preview.waitingPayment.length === 1 ? 'atendimento ainda não foi pago' : 'atendimentos ainda não foram pagos'} pelo cliente (
                {formatMoney(preview.waitingPaymentCents, currency)} de comissão). Entram no próximo acerto.
              </p>
            )}

            <section className="space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
              <Row label="Comissões" cents={t.commissionsCents} currency={currency} />
              {t.bonusesCents > 0 && <Row label="Bônus" cents={t.bonusesCents} currency={currency} />}
              {t.deductionsCents > 0 && <Row label="Vales e descontos" cents={-t.deductionsCents} currency={currency} />}
              <div className="flex items-end justify-between border-t border-border pt-3">
                <span className="font-medium">A pagar</span>
                <Money cents={t.netCents} currency={currency} className={cn('text-2xl font-semibold tracking-tight', t.netCents < 0 && 'text-destructive')} />
              </div>
            </section>

            {t.netCents > 0 && (
              <div className="space-y-1.5">
                <Label>Pagar com</Label>
                <Select value={methodId} onValueChange={setMethodId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {methods.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {methods.find((m) => m.id === methodId)?.type === 'CASH' && (
                  <p className="text-xs text-muted-foreground">Sai da gaveta do caixa aberto.</p>
                )}
              </div>
            )}

            {t.netCents < 0 && (
              <p className="text-sm text-destructive">Os vales passam das comissões. Aguarde novas comissões ou cancele um vale.</p>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" className="min-h-11 flex-1" onClick={onSkip ?? onClose}>
                {onSkip ? 'Pular' : 'Cancelar'}
              </Button>
              <Button
                className="min-h-11 flex-[2]"
                onClick={confirm}
                disabled={submitting || t.netCents < 0 || (preview.commissions.length === 0 && preview.adjustments.length === 0)}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar acerto de {formatMoney(Math.max(0, t.netCents), currency)}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Row({ label, cents, currency }: { label: string; cents: number; currency: CurrencyCode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <Money cents={cents} currency={currency} signed={cents < 0} />
    </div>
  )
}

/* ------------------------------------ Regras ------------------------------------ */

function RuleEditor({
  initial,
  currency,
  onSave,
  saving
}: {
  initial: Pick<Rule, 'type' | 'valueBps' | 'valueCents'> | null
  currency: CurrencyCode
  onSave: (rule: { type: 'PERCENT'; valueBps: number } | { type: 'FIXED'; valueCents: number }) => void
  saving: boolean
}) {
  const [type, setType] = useState<'PERCENT' | 'FIXED'>(initial?.type ?? 'PERCENT')
  const [percent, setPercent] = useState(initial?.type === 'PERCENT' && initial.valueBps != null ? formatBps(initial.valueBps) : '')
  const [fixed, setFixed] = useState<number | null>(initial?.type === 'FIXED' ? initial.valueCents : null)

  const save = () => {
    if (type === 'PERCENT') {
      const bps = parsePercentToBps(percent)
      if (bps == null) return toast.error('Percentual inválido (0 a 100)')
      onSave({ type, valueBps: bps })
    } else {
      if (fixed == null) return toast.error('Informe o valor')
      onSave({ type, valueCents: fixed })
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-28 flex-shrink-0">
        <SegmentedControl
          aria-label="Tipo de comissão"
          value={type}
          onChange={setType}
          options={[
            { value: 'PERCENT', label: '%' },
            { value: 'FIXED', label: currency === 'USD' ? '$' : 'R$' }
          ]}
        />
      </div>
      <div className="flex-1">
        {type === 'PERCENT' ? (
          <div className="relative">
            <Input inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="40" className="pr-8 tabular-nums" aria-label="Percentual" />
            <Percent className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        ) : (
          <MoneyInput valueCents={fixed} onValueChange={setFixed} currency={currency} aria-label="Valor fixo" />
        )}
      </div>
      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
      </Button>
    </div>
  )
}

function RulesDialog({
  professional,
  services,
  currency,
  onClose,
  onChanged
}: {
  professional: Professional | null
  services: Team['services']
  currency: CurrencyCode
  onClose: () => void
  onChanged: () => void
}) {
  const [saving, setSaving] = useState<string | null>(null)
  const [newServiceId, setNewServiceId] = useState('')

  useEffect(() => setNewServiceId(''), [professional?.id])

  if (!professional) return null
  const available = services.filter((s) => !professional.serviceRules.some((r) => r.serviceId === s.id))

  const save = async (serviceId: string | null, rule: { type: 'PERCENT'; valueBps: number } | { type: 'FIXED'; valueCents: number }) => {
    setSaving(serviceId ?? 'default')
    try {
      await financeFetch('/api/finance/commission-rules', {
        method: 'PUT',
        body: JSON.stringify({ professionalId: professional.id, serviceId, ...rule })
      })
      toast.success('Regra salva. Vale para os próximos atendimentos.')
      if (serviceId) setNewServiceId('')
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar')
    } finally {
      setSaving(null)
    }
  }

  const remove = async (id: string) => {
    try {
      await financeFetch(`/api/finance/commission-rules/${id}`, { method: 'DELETE' })
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível remover')
    }
  }

  const toggleCash = async (canOperateCash: boolean) => {
    try {
      await financeFetch(`/api/finance/team/${professional.id}/cash-permission`, { method: 'PATCH', body: JSON.stringify({ canOperateCash }) })
      toast.success(canOperateCash ? 'Pode operar o caixa' : 'Não opera mais o caixa')
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível alterar')
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle>{professional.name}</DialogTitle>
          <DialogDescription>A regra do serviço vence a padrão. Mudanças valem para os próximos atendimentos.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Comissão padrão</Label>
              {professional.defaultRule && (
                <button type="button" className="min-h-11 px-2 text-xs text-muted-foreground hover:text-destructive" onClick={() => remove(professional.defaultRule!.id)}>
                  Remover
                </button>
              )}
            </div>
            <RuleEditor
              key={`default-${professional.defaultRule?.id ?? 'none'}`}
              initial={professional.defaultRule}
              currency={currency}
              saving={saving === 'default'}
              onSave={(rule) => save(null, rule)}
            />
          </section>

          <Separator />

          <section className="space-y-3">
            <Label>Por serviço</Label>
            {professional.serviceRules.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma exceção. Todos os serviços usam a comissão padrão.</p>}
            <ul className="space-y-2">
              {professional.serviceRules.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-sm">{r.serviceName}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary" className="tabular-nums">
                      {ruleLabel(r, currency)}
                    </Badge>
                    <button type="button" onClick={() => remove(r.id)} className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-destructive" aria-label={`Remover regra de ${r.serviceName}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            {available.length > 0 && (
              <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                <Select value={newServiceId} onValueChange={setNewServiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Adicionar exceção para um serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newServiceId && (
                  <RuleEditor key={newServiceId} initial={null} currency={currency} saving={saving === newServiceId} onSave={(rule) => save(newServiceId, rule)} />
                )}
              </div>
            )}
          </section>

          {!professional.isOwner && (
            <>
              <Separator />
              <label className="flex cursor-pointer items-start justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium">Pode operar o caixa</span>
                  <span className="block text-xs text-muted-foreground">Recebe pagamentos, faz sangria e fecha o caixa. Não vê contas a pagar nem comissões.</span>
                </span>
                <Switch checked={professional.canOperateCash} onCheckedChange={toggleCash} />
              </label>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------ Vale, bônus, desconto ------------------------------ */

function AdjustmentDialog({
  professional,
  currency,
  onClose,
  onChanged
}: {
  professional: Professional | null
  currency: CurrencyCode
  onClose: () => void
  onChanged: () => void
}) {
  const [kind, setKind] = useState<Adjustment['kind']>('ADVANCE')
  const [amount, setAmount] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  const [methods, setMethods] = useState<PaymentMethodOption[]>([])
  const [methodId, setMethodId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!professional) return
    setKind('ADVANCE')
    setAmount(null)
    setDescription('')
    financeFetch<{ paymentMethods: PaymentMethodOption[] }>('/api/finance/payment-methods')
      .then(({ paymentMethods }) => {
        setMethods(paymentMethods)
        setMethodId(paymentMethods.find((m) => m.type === 'CASH')?.id ?? paymentMethods[0]?.id ?? '')
      })
      .catch(() => setMethods([]))
  }, [professional?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!professional) return null

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!amount) return toast.error('Informe o valor')
    setSubmitting(true)
    try {
      await financeFetch('/api/finance/adjustments', {
        method: 'POST',
        body: JSON.stringify({ professionalId: professional.id, kind, amountCents: amount, description, paymentMethodId: kind === 'ADVANCE' ? methodId : null })
      })
      toast.success(`${ADJUSTMENT_LABELS[kind]} de ${formatMoney(amount, currency)} registrado`)
      setAmount(null)
      setDescription('')
      window.dispatchEvent(new CustomEvent(FINANCE_CHANGED_EVENT))
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar')
    } finally {
      setSubmitting(false)
    }
  }

  const cancel = async (id: string) => {
    try {
      await financeFetch(`/api/finance/adjustments/${id}`, { method: 'DELETE' })
      toast.success('Cancelado')
      window.dispatchEvent(new CustomEvent(FINANCE_CHANGED_EVENT))
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cancelar')
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle>Vale, bônus ou desconto</DialogTitle>
          <DialogDescription>{professional.name} · entra no próximo acerto.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <SegmentedControl
            aria-label="Tipo de lançamento"
            value={kind}
            onChange={setKind}
            options={(Object.keys(ADJUSTMENT_LABELS) as Adjustment['kind'][]).map((k) => ({ value: k, label: ADJUSTMENT_LABELS[k] }))}
          />
          <p className="-mt-1 text-xs text-muted-foreground">
            {kind === 'ADVANCE' && 'Dinheiro adiantado agora. Sai do caixa e é descontado no acerto.'}
            {kind === 'BONUS' && 'Valor extra somado ao próximo acerto.'}
            {kind === 'DEDUCTION' && 'Valor descontado no próximo acerto (ex.: produto consumido).'}
          </p>
          <div className={cn('grid gap-3', kind === 'ADVANCE' ? 'grid-cols-2' : 'grid-cols-1')}>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <MoneyInput valueCents={amount} onValueChange={setAmount} currency={currency} autoFocus />
            </div>
            {kind === 'ADVANCE' && (
              <div className="space-y-1.5">
                <Label>Pago com</Label>
                <Select value={methodId} onValueChange={setMethodId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {methods.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" maxLength={120} />
          <DialogFooter>
            <Button type="submit" className="min-h-11 w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              Registrar {ADJUSTMENT_LABELS[kind].toLowerCase()}
            </Button>
          </DialogFooter>
        </form>

        {professional.openAdjustments.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Em aberto</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {professional.openAdjustments.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1">
                    <p className="text-sm">{a.description}</p>
                    <p className="text-xs text-muted-foreground">{ADJUSTMENT_LABELS[a.kind]}</p>
                  </div>
                  <Money cents={a.kind === 'BONUS' ? a.amountCents : -a.amountCents} currency={currency} signed className="text-sm" />
                  <button type="button" onClick={() => cancel(a.id)} className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-destructive" aria-label="Cancelar lançamento">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
