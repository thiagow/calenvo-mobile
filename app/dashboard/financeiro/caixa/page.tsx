'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, ChevronRight, HandCoins, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Money, MoneyInput } from '@/components/finance/money'
import { FINANCE_CHANGED_EVENT } from '@/components/finance/close-sale-sheet'
import { financeFetch } from '@/lib/finance/client'
import { formatMoney, type CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'
import { FinanceShell } from '../_components/finance-shell'
import { CashBreakdown, CashTransactions, type CashReport } from '../_components/cash-report'

interface SessionRow {
  id: string
  status: 'OPEN' | 'CLOSED'
  openedAt: string
  openedBy: string | null
  closedAt: string | null
  differenceCents: number | null
  expectedCashCents: number | null
}

const dateTime = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

export default function CashPage() {
  return (
    <FinanceShell title="Caixa" description="Dinheiro que entra e sai hoje, conferido no fechamento." access="cash">
      {(finance) => <CashContent currency={finance.currency} isMaster={finance.isMaster} />}
    </FinanceShell>
  )
}

function CashContent({ currency, isMaster }: { currency: CurrencyCode; isMaster: boolean }) {
  const [report, setReport] = useState<CashReport | null | undefined>(undefined)
  const [history, setHistory] = useState<SessionRow[]>([])
  const [closedReport, setClosedReport] = useState<CashReport | null>(null)
  const [movement, setMovement] = useState<'SUPPLY' | 'WITHDRAWAL' | null>(null)
  const [closing, setClosing] = useState(false)
  const [reverseId, setReverseId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [{ report }, { sessions }] = await Promise.all([
        financeFetch<{ report: CashReport | null }>('/api/finance/cash-sessions/current'),
        financeFetch<{ sessions: SessionRow[] }>('/api/finance/cash-sessions')
      ])
      setReport(report)
      setHistory(sessions.filter((s) => s.status === 'CLOSED'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar o caixa')
    }
  }, [])

  useEffect(() => {
    void load()
    window.addEventListener(FINANCE_CHANGED_EVENT, load)
    return () => window.removeEventListener(FINANCE_CHANGED_EVENT, load)
  }, [load])

  const reverse = async (id: string) => {
    try {
      await financeFetch(`/api/finance/transactions/${id}/reverse`, { method: 'POST', body: JSON.stringify({}) })
      toast.success('Lançamento estornado')
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível estornar')
    }
  }

  if (report === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }

  if (closedReport) {
    return <ClosedSummary report={closedReport} currency={currency} isMaster={isMaster} onDone={() => setClosedReport(null)} />
  }

  if (!report) {
    return (
      <div className="space-y-6">
        <OpenCashCard currency={currency} onOpened={load} />
        <History sessions={history} currency={currency} />
      </div>
    )
  }

  const { session, summary } = report
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Aberto às {time.format(new Date(session.openedAt))}
            {session.openedBy && ` por ${session.openedBy}`}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Esperado na gaveta</p>
            <Money cents={summary.expectedCashCents} currency={currency} className="block text-4xl font-semibold tracking-tight" />
          </div>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-[11px] text-muted-foreground">Troco inicial</dt>
              <dd>
                <Money cents={summary.openingCents} currency={currency} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Entrou em dinheiro</dt>
              <dd>
                <Money cents={summary.cashInCents} currency={currency} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Saiu em dinheiro</dt>
              <dd>
                <Money cents={summary.cashOutCents} currency={currency} />
              </dd>
            </div>
          </dl>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <Button variant="outline" onClick={() => setMovement('SUPPLY')}>
              <ArrowDownToLine className="mr-1.5 h-4 w-4" />
              Suprimento
            </Button>
            <Button variant="outline" onClick={() => setMovement('WITHDRAWAL')}>
              <ArrowUpFromLine className="mr-1.5 h-4 w-4" />
              Sangria
            </Button>
            <Button onClick={() => setClosing(true)}>
              <Lock className="mr-1.5 h-4 w-4" />
              Fechar
            </Button>
          </div>
        </div>
      </section>

      <CashBreakdown report={report} currency={currency} />

      <section className="space-y-2">
        <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lançamentos</h2>
        <CashTransactions report={report} currency={currency} onReverse={isMaster ? setReverseId : undefined} />
      </section>

      <MovementDialog kind={movement} currency={currency} onClose={() => setMovement(null)} onDone={load} />
      <CloseDialog
        open={closing}
        report={report}
        currency={currency}
        onClose={() => setClosing(false)}
        onClosed={(closed) => {
          setClosing(false)
          setClosedReport(closed)
          void load()
        }}
      />
      <ConfirmDialog
        open={Boolean(reverseId)}
        onOpenChange={(open) => !open && setReverseId(null)}
        title="Estornar lançamento?"
        description="Um lançamento no sentido oposto é registrado. O original continua no histórico, marcado como estornado."
        confirmText="Estornar"
        variant="destructive"
        onConfirm={() => reverseId && reverse(reverseId)}
      />
    </div>
  )
}

function OpenCashCard({ currency, onOpened }: { currency: CurrencyCode; onOpened: () => void }) {
  const [openingCents, setOpeningCents] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const open = async (event: React.FormEvent) => {
    event.preventDefault()
    if (openingCents == null) return toast.error('Informe o troco inicial (pode ser 0)')
    setSubmitting(true)
    try {
      await financeFetch('/api/finance/cash-sessions', { method: 'POST', body: JSON.stringify({ openingCents, notes: notes || undefined }) })
      toast.success('Caixa aberto')
      onOpened()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível abrir o caixa')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={open} className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          Caixa fechado
        </p>
        <h2 className="text-lg font-semibold tracking-tight">Abrir o caixa do dia</h2>
        <p className="text-sm text-muted-foreground">Conte o troco que está na gaveta. Tudo o que for recebido daqui em diante entra neste caixa.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="opening">Troco inicial</Label>
        <MoneyInput id="opening" valueCents={openingCents} onValueChange={setOpeningCents} currency={currency} placeholder="0,00" autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="opening-notes">Observação (opcional)</Label>
        <Input id="opening-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Abrir caixa
      </Button>
    </form>
  )
}

function MovementDialog({
  kind,
  currency,
  onClose,
  onDone
}: {
  kind: 'SUPPLY' | 'WITHDRAWAL' | null
  currency: CurrencyCode
  onClose: () => void
  onDone: () => void
}) {
  const [amount, setAmount] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (kind) {
      setAmount(null)
      setDescription('')
    }
  }, [kind])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!kind || !amount) return toast.error('Informe o valor')
    setSubmitting(true)
    try {
      await financeFetch('/api/finance/cash-sessions/current/movements', {
        method: 'POST',
        body: JSON.stringify({ kind, amountCents: amount, description: description || undefined })
      })
      toast.success(kind === 'SUPPLY' ? 'Suprimento registrado' : 'Sangria registrada')
      onDone()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={Boolean(kind)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{kind === 'SUPPLY' ? 'Suprimento' : 'Sangria'}</DialogTitle>
          <DialogDescription>
            {kind === 'SUPPLY' ? 'Dinheiro colocado na gaveta (ex.: mais troco).' : 'Dinheiro retirado da gaveta (ex.: depósito, cofre).'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <MoneyInput valueCents={amount} onValueChange={setAmount} currency={currency} autoFocus aria-label="Valor" />
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Motivo (opcional)" maxLength={120} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CloseDialog({
  open,
  report,
  currency,
  onClose,
  onClosed
}: {
  open: boolean
  report: CashReport
  currency: CurrencyCode
  onClose: () => void
  onClosed: (report: CashReport) => void
}) {
  const [counted, setCounted] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const expected = report.summary.expectedCashCents
  const difference = counted == null ? null : counted - expected

  useEffect(() => {
    if (open) {
      setCounted(null)
      setNotes('')
    }
  }, [open])

  const submit = async () => {
    if (counted == null) return toast.error('Informe quanto há na gaveta')
    setSubmitting(true)
    try {
      const { report: closed } = await financeFetch<{ report: CashReport }>('/api/finance/cash-sessions/current/close', {
        method: 'POST',
        body: JSON.stringify({ countedCashCents: counted, notes: notes || undefined })
      })
      toast.success('Caixa fechado')
      onClosed(closed)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível fechar o caixa')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Fechar o caixa</DialogTitle>
          <DialogDescription>Conte o dinheiro da gaveta. Pix e cartões não entram na contagem.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-baseline justify-between rounded-xl bg-muted/60 px-4 py-3">
            <span className="text-sm text-muted-foreground">Esperado</span>
            <Money cents={expected} currency={currency} className="text-lg font-semibold" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="counted">Contado na gaveta</Label>
            <MoneyInput id="counted" valueCents={counted} onValueChange={setCounted} currency={currency} autoFocus />
          </div>
          {difference != null && (
            <p
              className={cn(
                'rounded-lg px-3 py-2 text-sm',
                difference === 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              )}
            >
              {difference === 0
                ? 'Bateu certinho.'
                : difference > 0
                  ? `Sobra de ${formatMoney(difference, currency)}`
                  : `Falta de ${formatMoney(-difference, currency)}`}
            </p>
          )}
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observação (opcional)" maxLength={300} rows={2} />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting || counted == null}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Fechar caixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ClosedSummary({ report, currency, isMaster, onDone }: { report: CashReport; currency: CurrencyCode; isMaster: boolean; onDone: () => void }) {
  const diff = report.session.differenceCents ?? 0
  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2" style={{ animationDuration: '400ms' }}>
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-emerald-500">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-medium">Caixa fechado</span>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-[11px] text-muted-foreground">Esperado</dt>
            <dd>
              <Money cents={report.session.expectedCashCents ?? 0} currency={currency} className="text-lg font-semibold" />
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">Contado</dt>
            <dd>
              <Money cents={report.session.countedCashCents ?? 0} currency={currency} className="text-lg font-semibold" />
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">Diferença</dt>
            <dd>
              <Money
                cents={diff}
                currency={currency}
                signed
                className={cn('text-lg font-semibold', diff === 0 ? 'text-emerald-500' : 'text-amber-500')}
              />
            </dd>
          </div>
        </dl>
      </section>

      <CashBreakdown report={report} currency={currency} />

      {isMaster && report.byProfessional.some((p) => p.professionalId) && (
        <Link
          href={`/dashboard/financeiro/comissoes?caixa=${report.session.id}`}
          className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
        >
          <HandCoins className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">Acertar com os profissionais</p>
            <p className="text-xs text-muted-foreground">Comissões deste caixa, com vales descontados.</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      <Button variant="outline" className="w-full" onClick={onDone}>
        Concluir
      </Button>
    </div>
  )
}

function History({ sessions, currency }: { sessions: SessionRow[]; currency: CurrencyCode }) {
  if (sessions.length === 0) return null
  return (
    <section className="space-y-2">
      <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Caixas anteriores</h2>
      <Card className="overflow-hidden border border-border">
        <CardContent className="p-0">
          {sessions.map((s, index) => (
            <div key={s.id}>
              {index > 0 && <Separator />}
              <Link href={`/dashboard/financeiro/caixa/${s.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                <div className="flex-1">
                  <p className="text-sm">{dateTime.format(new Date(s.openedAt))}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {s.openedBy}
                    {s.closedAt && ` · fechado ${time.format(new Date(s.closedAt))}`}
                  </p>
                </div>
                {s.differenceCents != null && (
                  <Money
                    cents={s.differenceCents}
                    currency={currency}
                    signed
                    className={cn('text-xs font-medium', s.differenceCents === 0 ? 'text-emerald-500' : 'text-amber-500')}
                  />
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
