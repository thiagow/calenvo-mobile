'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Money, MoneyInput } from '@/components/finance/money'
import { FINANCE_CHANGED_EVENT } from '@/components/finance/close-sale-sheet'
import { STATUS_LABELS, type EntryStatus, type TransactionDto } from '@/components/finance/types'
import type { PaymentMethodOption } from '@/components/finance/payment-split'
import { financeFetch } from '@/lib/finance/client'
import { formatMoney, type CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'
import { FinanceShell } from '../_components/finance-shell'
import { EntryList, FilterPills, type EntryFilter } from '../_components/entry-list'

interface PayableRow {
  id: string
  description: string
  supplier: string | null
  category: string
  amountCents: number
  paidCents: number
  dueDate: string
  status: EntryStatus
  installment: number | null
  ofInstallments: number | null
  seriesId: string | null
  payments: TransactionDto[]
}

export default function PayablesPage() {
  const [creating, setCreating] = useState(false)
  return (
    <FinanceShell
      title="A pagar"
      description="Aluguel, insumos, impostos: tudo o que vence, com aviso do que está atrasado."
      access="master"
      actions={
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Nova
        </Button>
      }
    >
      {(finance) => <PayablesContent currency={finance.currency} creating={creating} onCreatingChange={setCreating} />}
    </FinanceShell>
  )
}

function PayablesContent({
  currency,
  creating,
  onCreatingChange
}: {
  currency: CurrencyCode
  creating: boolean
  onCreatingChange: (v: boolean) => void
}) {
  const [filter, setFilter] = useState<EntryFilter>('open')
  const [rows, setRows] = useState<PayableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PayableRow | null>(null)

  const load = useCallback(async () => {
    try {
      const { payables } = await financeFetch<{ payables: PayableRow[] }>(`/api/finance/payables?status=${filter}`)
      setRows(payables)
      setSelected((current) => (current ? payables.find((p) => p.id === current.id) ?? null : null))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    setLoading(true)
    void load()
    window.addEventListener(FINANCE_CHANGED_EVENT, load)
    return () => window.removeEventListener(FINANCE_CHANGED_EVENT, load)
  }, [load])

  return (
    <div className="space-y-3">
      <FilterPills value={filter} onChange={setFilter} />
      <EntryList
        rows={rows.map((p) => ({
          id: p.id,
          title: p.ofInstallments ? `${p.description} · ${p.installment}/${p.ofInstallments}` : p.description,
          subtitle: [p.category, p.supplier].filter(Boolean).join(' · '),
          amountCents: p.amountCents,
          paidCents: p.paidCents,
          dueDate: p.dueDate,
          status: p.status
        }))}
        currency={currency}
        loading={loading}
        empty={filter === 'open' ? 'Nenhuma conta a pagar em aberto.' : 'Nenhuma conta aqui.'}
        onSelect={(id) => setSelected(rows.find((r) => r.id === id) ?? null)}
      />
      <PayableDialog payable={selected} currency={currency} onClose={() => setSelected(null)} onChanged={load} />
      <NewPayableDialog open={creating} currency={currency} onClose={() => onCreatingChange(false)} onCreated={load} />
    </div>
  )
}

const dateTime = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const dayFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })

function PayableDialog({
  payable,
  currency,
  onClose,
  onChanged
}: {
  payable: PayableRow | null
  currency: CurrencyCode
  onClose: () => void
  onChanged: () => void
}) {
  const [methods, setMethods] = useState<PaymentMethodOption[]>([])
  const [methodId, setMethodId] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirm, setConfirm] = useState<{ type: 'reverse'; id: string } | { type: 'cancel'; following: boolean } | null>(null)

  useEffect(() => {
    if (!payable) return
    setAmount(payable.amountCents - payable.paidCents)
    financeFetch<{ paymentMethods: PaymentMethodOption[] }>('/api/finance/payment-methods')
      .then(({ paymentMethods }) => {
        setMethods(paymentMethods)
        setMethodId((current) => current || paymentMethods.find((m) => m.type === 'PIX')?.id || paymentMethods[0]?.id || '')
      })
      .catch(() => setMethods([]))
  }, [payable])

  const changed = () => {
    window.dispatchEvent(new CustomEvent(FINANCE_CHANGED_EVENT))
    onChanged()
  }

  const pay = async () => {
    if (!payable || !amount || !methodId) return toast.error('Informe forma e valor')
    setSubmitting(true)
    try {
      await financeFetch(`/api/finance/payables/${payable.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethodId: methodId, amountCents: amount })
      })
      toast.success(`Pago ${formatMoney(amount, currency)}`)
      changed()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível pagar')
    } finally {
      setSubmitting(false)
    }
  }

  const reverse = async (id: string) => {
    try {
      await financeFetch(`/api/finance/transactions/${id}/reverse`, { method: 'POST', body: JSON.stringify({}) })
      toast.success('Pagamento estornado')
      changed()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível estornar')
    }
  }

  const cancel = async (includeFollowing: boolean) => {
    if (!payable) return
    try {
      const { count } = await financeFetch<{ count: number }>(`/api/finance/payables/${payable.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ includeFollowing })
      })
      toast.success(count > 1 ? `${count} contas canceladas` : 'Conta cancelada')
      changed()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cancelar')
    }
  }

  const open = payable ? payable.amountCents - payable.paidCents : 0
  const payableOpen = payable && (payable.status === 'OPEN' || payable.status === 'PARTIAL')

  return (
    <>
      <Dialog open={Boolean(payable)} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
          {payable && (
            <>
              <DialogHeader className="text-left">
                <DialogTitle className="pr-6">
                  {payable.description}
                  {payable.ofInstallments && <span className="text-muted-foreground"> · {payable.installment}/{payable.ofInstallments}</span>}
                </DialogTitle>
                <DialogDescription>
                  {payable.category}
                  {payable.supplier && ` · ${payable.supplier}`} · vence {dayFormatter.format(new Date(payable.dueDate))}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <div className="flex items-end justify-between rounded-xl bg-muted/60 p-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground">{payableOpen ? 'Em aberto' : 'Valor'}</p>
                    <Money cents={payableOpen ? open : payable.amountCents} currency={currency} className="text-3xl font-semibold tracking-tight" />
                  </div>
                  <Badge variant="outline" className={cn(payable.status === 'PAID' && 'border-emerald-500/30 text-emerald-500')}>
                    {STATUS_LABELS[payable.status]}
                  </Badge>
                </div>

                {payableOpen && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-[1fr_8rem] gap-2">
                      <Select value={methodId} onValueChange={setMethodId}>
                        <SelectTrigger aria-label="Forma de pagamento">
                          <SelectValue placeholder="Forma" />
                        </SelectTrigger>
                        <SelectContent>
                          {methods.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <MoneyInput valueCents={amount} onValueChange={setAmount} currency={currency} aria-label="Valor" />
                    </div>
                    <Button className="w-full" onClick={pay} disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Pagar {amount ? formatMoney(amount, currency) : ''}
                    </Button>
                  </div>
                )}

                {payable.payments.length > 0 && (
                  <ul className="rounded-xl border border-border">
                    {payable.payments.map((p, index) => (
                      <li key={p.id}>
                        {index > 0 && <Separator />}
                        <div className={cn('flex items-center gap-3 px-3 py-2.5', p.reversed && 'opacity-50')}>
                          <div className="flex-1">
                            <p className={cn('text-sm', p.reversed && 'line-through')}>{p.kind === 'REVERSAL' ? 'Estorno' : p.paymentMethod}</p>
                            <p className="text-[11px] text-muted-foreground">{dateTime.format(new Date(p.occurredAt))}</p>
                          </div>
                          <Money cents={p.direction === 'OUT' ? -p.amountCents : p.amountCents} currency={currency} signed className="text-sm font-medium" />
                          {p.kind === 'PAYMENT' && !p.reversed && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setConfirm({ type: 'reverse', id: p.id })} aria-label="Estornar">
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {payableOpen && payable.paidCents === 0 && (
                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1 text-destructive hover:text-destructive" onClick={() => setConfirm({ type: 'cancel', following: false })}>
                      Cancelar esta
                    </Button>
                    {payable.seriesId && (
                      <Button variant="ghost" className="flex-1 text-destructive hover:text-destructive" onClick={() => setConfirm({ type: 'cancel', following: true })}>
                        Esta e as próximas
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.type === 'reverse' ? 'Estornar pagamento?' : 'Cancelar conta?'}
        description={
          confirm?.type === 'reverse'
            ? 'O valor volta a ficar em aberto. O pagamento original fica no histórico como estornado.'
            : confirm?.type === 'cancel' && confirm.following
              ? 'Esta conta e as próximas da série, ainda sem pagamento, são canceladas.'
              : 'A conta deixa de aparecer nas contas a pagar.'
        }
        confirmText={confirm?.type === 'reverse' ? 'Estornar' : 'Cancelar conta'}
        variant="destructive"
        onConfirm={() => {
          if (confirm?.type === 'reverse') void reverse(confirm.id)
          if (confirm?.type === 'cancel') void cancel(confirm.following)
        }}
      />
    </>
  )
}

const MODES = [
  { value: 'SINGLE', label: 'Única' },
  { value: 'INSTALLMENTS', label: 'Parcelada' },
  { value: 'RECURRING', label: 'Mensal' }
] as const

function NewPayableDialog({
  open,
  currency,
  onClose,
  onCreated
}: {
  open: boolean
  currency: CurrencyCode
  onClose: () => void
  onCreated: () => void
}) {
  const [categories, setCategories] = useState<{ id: string; name: string; isSystem: boolean }[]>([])
  const [description, setDescription] = useState('')
  const [supplier, setSupplier] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [firstDueDate, setFirstDueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [mode, setMode] = useState<(typeof MODES)[number]['value']>('SINGLE')
  const [count, setCount] = useState(3)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setDescription('')
    setSupplier('')
    setAmount(null)
    setMode('SINGLE')
    setCount(3)
    setFirstDueDate(new Date().toISOString().slice(0, 10))
    financeFetch<{ categories: { id: string; name: string; isSystem: boolean }[] }>('/api/finance/categories?kind=EXPENSE')
      .then(({ categories }) => {
        const usable = categories.filter((c) => !c.isSystem)
        setCategories(usable)
        setCategoryId(usable[0]?.id ?? '')
      })
      .catch(() => setCategories([]))
  }, [open])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!description.trim() || !amount || !categoryId) return toast.error('Preencha descrição, categoria e valor')
    setSubmitting(true)
    try {
      const { count: created } = await financeFetch<{ count: number }>('/api/finance/payables', {
        method: 'POST',
        body: JSON.stringify({
          description: description.trim(),
          supplier: supplier.trim() || null,
          categoryId,
          amountCents: amount,
          firstDueDate: `${firstDueDate}T12:00:00Z`,
          mode,
          count: mode === 'SINGLE' ? 1 : count
        })
      })
      toast.success(created > 1 ? `${created} contas criadas` : 'Conta criada')
      onCreated()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível criar')
    } finally {
      setSubmitting(false)
    }
  }

  const perInstallment = mode === 'INSTALLMENTS' && amount ? Math.floor(amount / Math.max(1, count)) : null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova conta a pagar</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pay-desc">Descrição</Label>
            <Input id="pay-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Aluguel" maxLength={120} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-supplier">Fornecedor</Label>
              <Input id="pay-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Opcional" maxLength={80} />
            </div>
          </div>

          <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-3 rounded-lg bg-muted p-1">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={mode === m.value}
                onClick={() => setMode(m.value)}
                className={cn('rounded-md py-1.5 text-sm font-medium transition-all', mode === m.value ? 'bg-background shadow-sm' : 'text-muted-foreground')}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{mode === 'INSTALLMENTS' ? 'Valor total' : 'Valor'}</Label>
              <MoneyInput valueCents={amount} onValueChange={setAmount} currency={currency} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-due">{mode === 'SINGLE' ? 'Vencimento' : '1º vencimento'}</Label>
              <Input id="pay-due" type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
            </div>
          </div>
          {mode !== 'SINGLE' && (
            <div className="space-y-1.5">
              <Label htmlFor="pay-count">{mode === 'INSTALLMENTS' ? 'Parcelas' : 'Meses'}</Label>
              <Input
                id="pay-count"
                type="number"
                min={2}
                max={60}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
              />
              <p className="text-[11px] text-muted-foreground">
                {mode === 'INSTALLMENTS'
                  ? perInstallment != null && `${count}× de ${formatMoney(perInstallment, currency)}, uma por mês`
                  : `${count} contas mensais de ${amount ? formatMoney(amount, currency) : '—'}`}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
