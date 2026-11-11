'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MessageCircle, Package, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Money } from '@/components/finance/money'
import { useFeatures } from '@/hooks/use-features'
import { financeFetch } from '@/lib/finance/client'
import { formatBps, formatMoney, type CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'
import { FinanceShell } from '../../_components/finance-shell'

interface Receipt {
  id: string
  businessName: string | null
  currency: CurrencyCode
  professionalName: string | null
  status: 'PAID' | 'CANCELLED'
  paidAt: string
  periodStart: string | null
  periodEnd: string | null
  paymentMethod: string | null
  createdBy: string | null
  notes: string | null
  commissionsCents: number
  bonusesCents: number
  deductionsCents: number
  netCents: number
  commissions: {
    id: string
    description: string
    clientName: string | null
    occurredAt: string
    baseCents: number
    ruleType: 'PERCENT' | 'FIXED'
    ruleValue: number
    amountCents: number
    isPackageSession: boolean
  }[]
  adjustments: { id: string; kind: 'ADVANCE' | 'BONUS' | 'DEDUCTION'; amountCents: number; description: string; createdAt: string }[]
}

const LABEL = { ADVANCE: 'Vale', BONUS: 'Bônus', DEDUCTION: 'Desconto' } as const
const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const full = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Comprovante do acerto: o que o profissional recebeu e por quê, atendimento por atendimento. */
export default function SettlementReceiptPage({ params }: { params: { id: string } }) {
  return (
    <FinanceShell title="Acerto" access="any">
      {() => <ReceiptContent id={params.id} />}
    </FinanceShell>
  )
}

function ReceiptContent({ id }: { id: string }) {
  const params = { id }
  const { features } = useFeatures()
  const isMaster = features?.finance.isMaster === true
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const load = useCallback(() => {
    financeFetch<{ settlement: Receipt }>(`/api/finance/settlements/${params.id}`)
      .then(({ settlement }) => setReceipt(settlement))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar o comprovante'))
  }, [params.id])

  useEffect(load, [load])

  if (!receipt) return <Skeleton className="h-96 w-full rounded-2xl" />
  const currency = receipt.currency

  const shareText = [
    `*Acerto ${receipt.businessName ?? ''}*`.trim(),
    `${receipt.professionalName} · ${full.format(new Date(receipt.paidAt))}`,
    '',
    ...receipt.commissions.map(
      (c) => `${day.format(new Date(c.occurredAt))} ${c.description}${c.clientName ? ` (${c.clientName})` : ''}: ${formatMoney(c.amountCents, currency)}`
    ),
    ...receipt.adjustments.map((a) => `${LABEL[a.kind]} ${a.description}: ${a.kind === 'BONUS' ? '+' : '−'}${formatMoney(a.amountCents, currency)}`),
    '',
    `Comissões: ${formatMoney(receipt.commissionsCents, currency)}`,
    receipt.bonusesCents ? `Bônus: ${formatMoney(receipt.bonusesCents, currency)}` : null,
    receipt.deductionsCents ? `Vales/descontos: −${formatMoney(receipt.deductionsCents, currency)}` : null,
    `*Total pago: ${formatMoney(receipt.netCents, currency)}*${receipt.paymentMethod ? ` (${receipt.paymentMethod})` : ''}`
  ]
    .filter((l) => l !== null)
    .join('\n')

  const cancel = async () => {
    try {
      await financeFetch(`/api/finance/settlements/${receipt.id}`, { method: 'DELETE' })
      toast.success('Acerto cancelado. As comissões voltaram a ficar pendentes.')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cancelar')
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={isMaster ? '/dashboard/financeiro/comissoes' : '/dashboard/financeiro/meus-ganhos'}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {isMaster ? 'Comissões' : 'Meus ganhos'}
        </Link>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-1.5 h-4 w-4" />
              Enviar
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      <article className={cn('space-y-6 rounded-2xl border border-border bg-card p-6 print:border-0 print:p-0', receipt.status === 'CANCELLED' && 'opacity-70')}>
        <header className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Comprovante de acerto</p>
            {receipt.status === 'CANCELLED' && <Badge variant="destructive">Cancelado</Badge>}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{receipt.professionalName}</h1>
            <p className="text-sm text-muted-foreground">
              {receipt.businessName} · {full.format(new Date(receipt.paidAt))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total pago</p>
            <Money cents={receipt.netCents} currency={currency} className="text-4xl font-semibold tracking-tight" />
            {receipt.paymentMethod && <p className="text-xs text-muted-foreground">via {receipt.paymentMethod}</p>}
          </div>
        </header>

        <Separator />

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Atendimentos</p>
          {receipt.commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum atendimento neste acerto.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {receipt.commissions.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-2 align-top text-muted-foreground tabular-nums">{day.format(new Date(c.occurredAt))}</td>
                    <td className="py-2 pr-2">
                      <span className="flex items-center gap-1.5">
                        {c.isPackageSession && <Package className="h-3.5 w-3.5 text-primary" />}
                        {c.description}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {c.clientName && `${c.clientName} · `}
                        {c.ruleType === 'PERCENT' ? `${formatBps(c.ruleValue)}% de ${formatMoney(c.baseCents, currency)}` : 'valor fixo'}
                      </span>
                    </td>
                    <td className="py-2 text-right align-top">
                      <Money cents={c.amountCents} currency={currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {receipt.adjustments.length > 0 && (
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vales, bônus e descontos</p>
            <ul className="space-y-1.5 text-sm">
              {receipt.adjustments.map((a) => (
                <li key={a.id} className="flex justify-between">
                  <span>
                    {LABEL[a.kind]} · {a.description}
                  </span>
                  <Money cents={a.kind === 'BONUS' ? a.amountCents : -a.amountCents} currency={currency} signed />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-1.5 rounded-xl bg-muted/50 p-4 text-sm print:bg-transparent print:p-0">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Comissões</span>
            <Money cents={receipt.commissionsCents} currency={currency} />
          </div>
          {receipt.bonusesCents > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bônus</span>
              <Money cents={receipt.bonusesCents} currency={currency} signed />
            </div>
          )}
          {receipt.deductionsCents > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vales e descontos</span>
              <Money cents={-receipt.deductionsCents} currency={currency} signed />
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 font-semibold">
            <span>Total pago</span>
            <Money cents={receipt.netCents} currency={currency} />
          </div>
        </section>

        {receipt.notes && <p className="text-xs text-muted-foreground">{receipt.notes}</p>}
        {receipt.createdBy && <p className="text-xs text-muted-foreground">Acerto registrado por {receipt.createdBy}.</p>}
      </article>

      {isMaster && receipt.status === 'PAID' && (
        <Button variant="ghost" className="w-full text-destructive hover:text-destructive print:hidden" onClick={() => setConfirmCancel(true)}>
          Cancelar acerto
        </Button>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancelar este acerto?"
        description="As comissões e os vales voltam a ficar pendentes e o pagamento é estornado (em dinheiro, volta para o caixa aberto)."
        confirmText="Cancelar acerto"
        variant="destructive"
        onConfirm={cancel}
      />
    </div>
  )
}
