'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, Loader2, Package, Plus, Receipt, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { financeFetch } from '@/lib/finance/client'
import { formatMoney, type CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'
import { Money, MoneyInput } from './money'
import { OpenCashInline } from './open-cash-inline'
import { newPaymentRow, PaymentSplit, type PaymentMethodOption, type PaymentRow } from './payment-split'
import type { SaleDto, SaleOptionsDto } from './types'

export const FINANCE_CHANGED_EVENT = 'calenvo:finance-changed'

interface EditableItem {
  key: string
  serviceId: string | null
  description: string
  professionalId: string | null
  quantity: number
  unitPriceCents: number | null
  discountCents: number | null
  clientPackageItemId: string | null
}

const NO_PROFESSIONAL = '__none__'
const CUSTOM_SERVICE = '__custom__'
const key = () => Math.random().toString(36).slice(2)

function toEditable(sale: SaleDto): EditableItem[] {
  return sale.items.map((i) => ({
    key: key(),
    serviceId: i.serviceId,
    description: i.description,
    professionalId: i.professionalId,
    quantity: i.quantity,
    unitPriceCents: i.unitPriceCents,
    // O desconto da comanda é reaplicado no total; aqui fica só o do item.
    discountCents: 0,
    clientPackageItemId: i.clientPackageItemId
  }))
}

interface CloseSaleSheetProps {
  saleId: string | null
  currency: CurrencyCode
  onClose: () => void
}

/**
 * "Fechar comanda": confere os serviços executados (e quem executou), aplica
 * desconto e recebe na hora — com pagamento dividido — ou deixa em aberto.
 */
export function CloseSaleSheet({ saleId, currency, onClose }: CloseSaleSheetProps) {
  const [sale, setSale] = useState<SaleDto | null>(null)
  const [options, setOptions] = useState<SaleOptionsDto | null>(null)
  const [methods, setMethods] = useState<PaymentMethodOption[]>([])
  const [cashOpen, setCashOpen] = useState(true)
  const [items, setItems] = useState<EditableItem[]>([])
  const [saleDiscount, setSaleDiscount] = useState<number | null>(0)
  const [receiveNow, setReceiveNow] = useState(true)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const [{ sale }, opts, { paymentMethods }, { report }] = await Promise.all([
        financeFetch<{ sale: SaleDto }>(`/api/finance/sales/${id}`),
        financeFetch<SaleOptionsDto>('/api/finance/sales/options'),
        financeFetch<{ paymentMethods: PaymentMethodOption[] }>('/api/finance/payment-methods'),
        financeFetch<{ report: unknown | null }>('/api/finance/cash-sessions/current')
      ])
      setSale(sale)
      setOptions(opts)
      setMethods(paymentMethods)
      setCashOpen(report !== null)
      setItems(toEditable(sale))
      // Todo desconto existente volta como desconto da comanda (itens editáveis ficam sem desconto próprio).
      setSaleDiscount(sale.discountCents)
      setDirty(false)
      const due = sale.receivable ? sale.receivable.amountCents - sale.receivable.paidCents : 0
      setPayments(paymentMethods.length ? [newPaymentRow(paymentMethods[0].id, due)] : [])
      setReceiveNow(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir a comanda')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (saleId) void load(saleId)
    else {
      setSale(null)
      setItems([])
    }
  }, [saleId, load])

  const editable = Boolean(sale?.editable)

  // Prévia dos totais (o servidor recalcula e é a fonte da verdade).
  const preview = useMemo(() => {
    const lines = items.map((i) => Math.max(0, i.quantity * (i.clientPackageItemId ? 0 : i.unitPriceCents ?? 0) - (i.discountCents ?? 0)))
    const subtotal = lines.reduce((a, b) => a + b, 0)
    const discount = Math.min(subtotal, saleDiscount ?? 0)
    return { subtotal, discount, total: subtotal - discount }
  }, [items, saleDiscount])

  const dueCents = editable
    ? preview.total
    : sale?.receivable
      ? sale.receivable.amountCents - sale.receivable.paidCents
      : 0

  // Mantém o "receber" acompanhando o total enquanto há uma forma só.
  useEffect(() => {
    setPayments((rows) => (rows.length === 1 ? [{ ...rows[0], amountCents: dueCents }] : rows))
  }, [dueCents])

  const patchItem = (k: string, patch: Partial<EditableItem>) => {
    setDirty(true)
    setItems((current) => current.map((i) => (i.key === k ? { ...i, ...patch } : i)))
  }

  const addItem = () => {
    setDirty(true)
    const professionalId = items.find((i) => i.professionalId)?.professionalId ?? null
    setItems((current) => [
      ...current,
      { key: key(), serviceId: null, description: '', professionalId, quantity: 1, unitPriceCents: null, discountCents: 0, clientPackageItemId: null }
    ])
  }

  const pickService = (k: string, serviceId: string) => {
    if (serviceId === CUSTOM_SERVICE) return patchItem(k, { serviceId: null })
    const service = options?.services.find((s) => s.id === serviceId)
    patchItem(k, { serviceId, description: service?.name ?? '', unitPriceCents: service?.priceCents ?? null })
  }

  const notifyChanged = () => window.dispatchEvent(new CustomEvent(FINANCE_CHANGED_EVENT))

  const submit = async () => {
    if (!sale) return
    setError(null)

    if (editable) {
      if (items.length === 0) return setError('A comanda precisa de pelo menos um serviço')
      if (items.some((i) => !i.description.trim())) return setError('Descreva todos os itens')
      if (items.some((i) => !i.clientPackageItemId && i.unitPriceCents == null)) return setError('Informe o preço de todos os itens')
      if (saleDiscount == null) return setError('Desconto inválido')
    }
    const paying = receiveNow && dueCents > 0
    if (paying) {
      const total = payments.reduce((a, p) => a + (p.amountCents ?? 0), 0)
      if (payments.some((p) => !p.amountCents)) return setError('Informe o valor de cada forma de pagamento')
      if (total > dueCents) return setError('O valor recebido passou do total')
    }

    setSubmitting(true)
    try {
      let current = sale
      if (editable && dirty) {
        const { sale: updated } = await financeFetch<{ sale: SaleDto }>(`/api/finance/sales/${sale.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            discountCents: saleDiscount ?? 0,
            items: items.map((i) => ({
              serviceId: i.serviceId,
              description: i.description.trim(),
              professionalId: i.professionalId,
              quantity: i.quantity,
              unitPriceCents: i.clientPackageItemId ? 0 : i.unitPriceCents ?? 0,
              discountCents: i.discountCents ?? 0,
              clientPackageItemId: i.clientPackageItemId
            }))
          })
        })
        current = updated
        setSale(updated)
        setItems(toEditable(updated))
        setDirty(false)
      }

      if (paying && current.receivable) {
        await financeFetch(`/api/finance/receivables/${current.receivable.id}/receipts`, {
          method: 'POST',
          body: JSON.stringify({ payments: payments.map((p) => ({ paymentMethodId: p.paymentMethodId, amountCents: p.amountCents })) })
        })
        const received = payments.reduce((a, p) => a + (p.amountCents ?? 0), 0)
        toast.success(`Recebido ${formatMoney(received, currency)}`)
      } else {
        toast.success(dueCents > 0 ? 'Comanda salva em aberto' : 'Comanda fechada')
      }
      notifyChanged()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível salvar a comanda'
      if ((err as { status?: number }).status === 409 && /caixa/i.test(message)) {
        setCashOpen(false)
      }
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const professionals = options?.professionals ?? []

  return (
    <Sheet open={Boolean(saleId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-xl overflow-y-auto rounded-t-2xl px-4 pb-6 pt-5 sm:px-6">
        <SheetHeader className="space-y-1 pr-6 text-left">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            <Receipt className="h-3.5 w-3.5" />
            Comanda
          </div>
          <SheetTitle className="text-xl tracking-tight">{sale?.client?.name ?? 'Fechar comanda'}</SheetTitle>
          <SheetDescription>
            {sale
              ? new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(sale.occurredAt))
              : 'Confira os serviços executados e receba.'}
          </SheetDescription>
        </SheetHeader>

        {loading || !sale ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {/* Serviços executados */}
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Serviços executados</p>
              <ul className="space-y-2">
                {items.map((item) => {
                  const isPackage = Boolean(item.clientPackageItemId)
                  const original = sale.items.find((i) => i.clientPackageItemId && i.clientPackageItemId === item.clientPackageItemId)
                  return (
                    <li key={item.key} className="space-y-2 rounded-xl border border-border bg-card p-3">
                      {editable && !isPackage ? (
                        <>
                          <div className="flex gap-2">
                            <Select value={item.serviceId ?? CUSTOM_SERVICE} onValueChange={(v) => pickService(item.key, v)}>
                              <SelectTrigger className="flex-1" aria-label="Serviço">
                                <SelectValue placeholder="Serviço" />
                              </SelectTrigger>
                              <SelectContent>
                                {options?.services.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                                <SelectItem value={CUSTOM_SERVICE}>Outro (descrever)</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-10 w-10 flex-shrink-0 text-muted-foreground"
                              onClick={() => {
                                setDirty(true)
                                setItems((c) => c.filter((i) => i.key !== item.key))
                              }}
                              disabled={items.length === 1}
                              aria-label="Remover serviço"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {!item.serviceId && (
                            <Input
                              value={item.description}
                              onChange={(e) => patchItem(item.key, { description: e.target.value })}
                              placeholder="Descrição (ex.: produto, taxa)"
                              maxLength={120}
                            />
                          )}
                          <div className="grid grid-cols-[1fr_8rem] gap-2">
                            <Select
                              value={item.professionalId ?? NO_PROFESSIONAL}
                              onValueChange={(v) => patchItem(item.key, { professionalId: v === NO_PROFESSIONAL ? null : v })}
                            >
                              <SelectTrigger aria-label="Profissional">
                                <SelectValue placeholder="Profissional" />
                              </SelectTrigger>
                              <SelectContent>
                                {professionals.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                                <SelectItem value={NO_PROFESSIONAL}>Sem profissional</SelectItem>
                              </SelectContent>
                            </Select>
                            <MoneyInput
                              valueCents={item.unitPriceCents}
                              onValueChange={(cents) => patchItem(item.key, { unitPriceCents: cents })}
                              currency={currency}
                              aria-label="Preço"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-sm font-medium">
                              {isPackage && <Package className="h-3.5 w-3.5 text-primary" />}
                              {item.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {professionals.find((p) => p.id === item.professionalId)?.name ?? 'Sem profissional'}
                              {isPackage && original?.packageName && ` · pacote ${original.packageName}`}
                            </p>
                          </div>
                          <p className="text-sm tabular-nums">
                            {isPackage ? <span className="text-muted-foreground">já pago</span> : <Money cents={(item.unitPriceCents ?? 0) * item.quantity} currency={currency} />}
                          </p>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
              {editable && (
                <Button type="button" variant="ghost" size="sm" className="h-9 px-2 text-primary" onClick={addItem}>
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar serviço
                </Button>
              )}
            </section>

            {/* Totais */}
            <section className="space-y-2 rounded-xl bg-muted/50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <Money cents={editable ? preview.subtotal : sale.subtotalCents} currency={currency} />
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Desconto</span>
                {editable ? (
                  <div className="w-32">
                    <MoneyInput
                      valueCents={saleDiscount}
                      onValueChange={(cents) => {
                        setDirty(true)
                        setSaleDiscount(cents)
                      }}
                      currency={currency}
                      aria-label="Desconto"
                    />
                  </div>
                ) : (
                  <Money cents={-sale.discountCents} currency={currency} />
                )}
              </div>
              <div className="flex items-end justify-between border-t border-border pt-3">
                <span className="text-sm font-medium">Total</span>
                <Money cents={editable ? preview.total : sale.totalCents} currency={currency} className="text-2xl font-semibold tracking-tight" />
              </div>
              {sale.receivable && sale.receivable.paidCents > 0 && (
                <p className="text-right text-xs text-muted-foreground">
                  Já recebido {formatMoney(sale.receivable.paidCents, currency)} · falta {formatMoney(dueCents, currency)}
                </p>
              )}
            </section>

            {/* Pagamento */}
            {dueCents > 0 && (
              <section className="space-y-3">
                <div role="radiogroup" aria-label="Pagamento" className="grid grid-cols-2 rounded-lg bg-muted p-1">
                  {[
                    { value: true, label: 'Receber agora' },
                    { value: false, label: 'Deixar em aberto' }
                  ].map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      role="radio"
                      aria-checked={receiveNow === option.value}
                      onClick={() => setReceiveNow(option.value)}
                      className={cn(
                        'rounded-md py-2 text-sm font-medium transition-all',
                        receiveNow === option.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {receiveNow ? (
                  !cashOpen ? (
                    <OpenCashInline
                      currency={currency}
                      onOpened={() => {
                        setCashOpen(true)
                        setError(null)
                      }}
                    />
                  ) : methods.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Cadastre uma forma de pagamento em Financeiro → Configurações.</p>
                  ) : (
                    <PaymentSplit rows={payments} onChange={setPayments} methods={methods} dueCents={dueCents} currency={currency} />
                  )
                ) : (
                  <p className="flex items-start gap-2 rounded-lg border border-border p-3 text-xs text-muted-foreground">
                    <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    O valor fica em Contas a receber no nome do cliente. A comissão aparece no acerto quando o cliente pagar.
                  </p>
                )}
              </section>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" className="flex-1" onClick={onClose} disabled={submitting}>
                Depois
              </Button>
              <Button type="button" className="flex-[2]" onClick={submit} disabled={submitting || (receiveNow && dueCents > 0 && !cashOpen)}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {dueCents === 0
                  ? 'Fechar comanda'
                  : receiveNow
                    ? `Receber ${formatMoney(payments.reduce((a, p) => a + (p.amountCents ?? 0), 0), currency)}`
                    : 'Salvar em aberto'}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
