'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Receipt, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Money } from '@/components/finance/money'
import { OpenCashInline } from '@/components/finance/open-cash-inline'
import { newPaymentRow, PaymentSplit, type PaymentMethodOption, type PaymentRow } from '@/components/finance/payment-split'
import { STATUS_LABELS, type EntryStatus, type TransactionDto } from '@/components/finance/types'
import { FINANCE_CHANGED_EVENT } from '@/components/finance/close-sale-sheet'
import { financeFetch, openSaleSheet } from '@/lib/finance/client'
import { formatMoney, type CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'

interface ReceivableDetail {
  id: string
  description: string
  clientName: string | null
  category: string
  amountCents: number
  paidCents: number
  dueDate: string
  status: EntryStatus
  saleId: string | null
  payments: TransactionDto[]
}

const dateTime = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Detalhe de uma conta a receber: recebe (pagamento dividido), estorna e cancela. */
export function ReceivableDialog({
  receivableId,
  currency,
  isMaster,
  onClose
}: {
  receivableId: string | null
  currency: CurrencyCode
  isMaster: boolean
  onClose: () => void
}) {
  const [detail, setDetail] = useState<ReceivableDetail | null>(null)
  const [methods, setMethods] = useState<PaymentMethodOption[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [cashOpen, setCashOpen] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [confirm, setConfirm] = useState<{ type: 'reverse'; id: string } | { type: 'cancel' } | null>(null)

  const load = useCallback(async (id: string) => {
    const [{ receivable }, { paymentMethods }, { report }] = await Promise.all([
      financeFetch<{ receivable: ReceivableDetail }>(`/api/finance/receivables/${id}`),
      financeFetch<{ paymentMethods: PaymentMethodOption[] }>('/api/finance/payment-methods'),
      financeFetch<{ report: unknown | null }>('/api/finance/cash-sessions/current')
    ])
    setDetail(receivable)
    setMethods(paymentMethods)
    setCashOpen(report !== null)
    const open = receivable.amountCents - receivable.paidCents
    setPayments(paymentMethods.length && open > 0 ? [newPaymentRow(paymentMethods[0].id, open)] : [])
  }, [])

  useEffect(() => {
    setDetail(null)
    if (receivableId) load(receivableId).catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar'))
  }, [receivableId, load])

  const changed = async () => {
    window.dispatchEvent(new CustomEvent(FINANCE_CHANGED_EVENT))
    if (receivableId) await load(receivableId)
  }

  const receive = async () => {
    if (!detail) return
    if (payments.some((p) => !p.amountCents)) return toast.error('Informe o valor de cada forma de pagamento')
    setSubmitting(true)
    try {
      await financeFetch(`/api/finance/receivables/${detail.id}/receipts`, {
        method: 'POST',
        body: JSON.stringify({ payments: payments.map((p) => ({ paymentMethodId: p.paymentMethodId, amountCents: p.amountCents })) })
      })
      toast.success(`Recebido ${formatMoney(payments.reduce((a, p) => a + (p.amountCents ?? 0), 0), currency)}`)
      await changed()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível receber'
      if (/caixa/i.test(message)) setCashOpen(false)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const reverse = async (id: string) => {
    try {
      await financeFetch(`/api/finance/transactions/${id}/reverse`, { method: 'POST', body: JSON.stringify({}) })
      toast.success('Recebimento estornado')
      await changed()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível estornar')
    }
  }

  const cancel = async () => {
    if (!detail) return
    try {
      await financeFetch(`/api/finance/receivables/${detail.id}`, { method: 'DELETE' })
      toast.success('Conta cancelada')
      window.dispatchEvent(new CustomEvent(FINANCE_CHANGED_EVENT))
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cancelar')
    }
  }

  const open = detail ? detail.amountCents - detail.paidCents : 0
  const canReceive = detail && (detail.status === 'OPEN' || detail.status === 'PARTIAL')

  return (
    <>
      <Dialog open={Boolean(receivableId)} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
          {!detail ? (
            <div className="space-y-3 pt-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : (
            <>
              <DialogHeader className="text-left">
                <DialogTitle className="pr-6">{detail.description}</DialogTitle>
                <DialogDescription>
                  {detail.category}
                  {detail.clientName && ` · ${detail.clientName}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="flex items-end justify-between rounded-xl bg-muted/60 p-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground">{canReceive ? 'Em aberto' : 'Valor'}</p>
                    <Money cents={canReceive ? open : detail.amountCents} currency={currency} className="text-3xl font-semibold tracking-tight" />
                  </div>
                  <Badge variant="outline" className={cn(detail.status === 'PAID' && 'border-money-positive/30 text-money-positive')}>
                    {STATUS_LABELS[detail.status]}
                  </Badge>
                </div>

                {detail.saleId && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const saleId = detail.saleId!
                      onClose()
                      openSaleSheet(saleId)
                    }}
                  >
                    <Receipt className="mr-2 h-4 w-4" />
                    Ver comanda
                  </Button>
                )}

                {canReceive &&
                  (!cashOpen ? (
                    <OpenCashInline currency={currency} onOpened={() => setCashOpen(true)} />
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receber</p>
                      <PaymentSplit rows={payments} onChange={setPayments} methods={methods} dueCents={open} currency={currency} />
                      <Button className="w-full" onClick={receive} disabled={submitting}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Receber {formatMoney(payments.reduce((a, p) => a + (p.amountCents ?? 0), 0), currency)}
                      </Button>
                    </div>
                  ))}

                {detail.payments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pagamentos</p>
                    <ul className="rounded-xl border border-border">
                      {detail.payments.map((p, index) => (
                        <li key={p.id}>
                          {index > 0 && <Separator />}
                          <div className={cn('flex items-center gap-3 px-3 py-2.5', p.reversed && 'opacity-50')}>
                            <div className="min-w-0 flex-1">
                              <p className={cn('text-sm', p.reversed && 'line-through')}>
                                {p.kind === 'REVERSAL' ? 'Estorno' : p.paymentMethod ?? 'Pagamento'}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {dateTime.format(new Date(p.occurredAt))}
                                {p.feeCents > 0 && ` · taxa ${formatMoney(p.feeCents, currency)}`}
                              </p>
                            </div>
                            <Money cents={p.direction === 'IN' ? p.amountCents : -p.amountCents} currency={currency} signed className="text-sm font-medium" />
                            {isMaster && p.kind === 'RECEIPT' && !p.reversed && (
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setConfirm({ type: 'reverse', id: p.id })} aria-label="Estornar">
                                <Undo2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {isMaster && canReceive && detail.paidCents === 0 && (
                  <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={() => setConfirm({ type: 'cancel' })}>
                    Cancelar conta
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.type === 'cancel' ? 'Cancelar esta conta?' : 'Estornar este recebimento?'}
        description={
          confirm?.type === 'cancel'
            ? detail?.saleId
              ? 'A comanda é cancelada junto e as comissões dela deixam de valer.'
              : 'A conta sai das contas a receber. O registro fica no histórico.'
            : 'O valor volta a ficar em aberto. O recebimento original continua no histórico, marcado como estornado.'
        }
        confirmText={confirm?.type === 'cancel' ? 'Cancelar conta' : 'Estornar'}
        variant="destructive"
        onConfirm={() => {
          if (confirm?.type === 'reverse') void reverse(confirm.id)
          if (confirm?.type === 'cancel') void cancel()
        }}
      />
    </>
  )
}
