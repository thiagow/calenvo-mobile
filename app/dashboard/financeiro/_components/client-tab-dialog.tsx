'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Receipt, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientCombobox, type ClientOption } from '@/components/finance/client-combobox'
import { EmptyState, ErrorState } from '@/components/finance/empty-state'
import { Money } from '@/components/finance/money'
import { financeFetch, openSaleSheet } from '@/lib/finance/client'
import type { CurrencyCode } from '@/lib/finance/money'

interface OpenReceivable {
  id: string
  description: string
  amountCents: number
  paidCents: number
  dueDate: string
  saleId: string | null
}

const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

interface ClientTabDialogProps {
  open: boolean
  currency: CurrencyCode
  onClose: () => void
  /** Abre "Nova comanda" (com o cliente já escolhido, ou nenhum para venda avulsa). */
  onNewSale: (client: ClientOption | null) => void
}

/**
 * Comanda do cliente: escolhe quem está no balcão, vê o que ele já tem em aberto
 * (e abre a comanda para receber) ou começa uma nova (serviço extra, produto).
 */
export function ClientTabDialog({ open, currency, onClose, onNewSale }: ClientTabDialogProps) {
  const [client, setClient] = useState<ClientOption | null>(null)
  const [rows, setRows] = useState<OpenReceivable[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async (clientId: string) => {
    setRows(null)
    setFailed(false)
    try {
      const { receivables } = await financeFetch<{ receivables: OpenReceivable[] }>(
        `/api/finance/receivables?status=open&clientId=${encodeURIComponent(clientId)}`
      )
      setRows(receivables)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setClient(null)
      setRows(null)
      setFailed(false)
    }
  }, [open])

  useEffect(() => {
    if (client) void load(client.id)
  }, [client, load])

  const totalOpen = (rows ?? []).reduce((sum, r) => sum + (r.amountCents - r.paidCents), 0)
  const firstName = client?.name.split(' ')[0]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle>Comanda do cliente</DialogTitle>
          <DialogDescription>Veja o que o cliente tem em aberto ou comece uma nova comanda.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ClientCombobox value={client} onChange={setClient} placeholder="Buscar cliente" />

          {client && (
            <section className="space-y-2" aria-live="polite">
              {failed ? (
                <ErrorState message="Não foi possível carregar o que o cliente tem em aberto." onRetry={() => void load(client.id)} className="py-4" />
              ) : rows === null ? (
                <Skeleton className="h-20 w-full rounded-xl" />
              ) : rows.length === 0 ? (
                <EmptyState icon={Receipt} title="Nada em aberto" description={`${firstName} não tem comandas a receber.`} className="py-6" />
              ) : (
                <>
                  <div className="flex items-baseline justify-between px-0.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Em aberto</p>
                    <Money cents={totalOpen} currency={currency} className="text-lg font-semibold" />
                  </div>
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {rows.map((r) => {
                      const content = (
                        <>
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-sm font-medium">{r.description}</span>
                            <span className="block text-xs text-muted-foreground">Vence {day.format(new Date(r.dueDate))}</span>
                          </span>
                          <Money cents={r.amountCents - r.paidCents} currency={currency} className="text-sm font-semibold" />
                          {r.saleId && <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />}
                        </>
                      )
                      return (
                        <li key={r.id}>
                          {r.saleId ? (
                            <button
                              type="button"
                              className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => {
                                onClose()
                                openSaleSheet(r.saleId!)
                              }}
                            >
                              {content}
                            </button>
                          ) : (
                            <div className="flex min-h-14 items-center gap-3 px-3 py-2.5">{content}</div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </section>
          )}

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="min-h-11"
              disabled={!client}
              onClick={() => {
                onClose()
                onNewSale(client)
              }}
            >
              <ShoppingBag className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {client ? `Nova comanda para ${firstName}` : 'Nova comanda'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 text-muted-foreground"
              onClick={() => {
                onClose()
                onNewSale(null)
              }}
            >
              Venda sem cliente
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
