'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/finance/empty-state'
import { Money } from '@/components/finance/money'
import { FINANCE_CHANGED_EVENT } from '@/components/finance/close-sale-sheet'
import type { SaleDto } from '@/components/finance/types'
import { financeFetch, openSaleSheet } from '@/lib/finance/client'
import type { CurrencyCode } from '@/lib/finance/money'
import { FinanceShell } from '../_components/finance-shell'

interface Pending {
  id: string
  date: string
  clientName: string
  serviceName: string | null
  professionalName: string | null
  priceCents: number
}

const dateTime = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Concluídos desde a ativação sem comanda (gancho falhou ou foi concluído fora do fluxo). */
export default function PendingPage() {
  return (
    <FinanceShell title="Pendências" description="Atendimentos concluídos que ainda não viraram comanda." access="cash">
      {(finance) => <PendingContent currency={finance.currency} />}
    </FinanceShell>
  )
}

function PendingContent({ currency }: { currency: CurrencyCode }) {
  const [rows, setRows] = useState<Pending[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)

  const load = useCallback(async () => {
    try {
      setRows((await financeFetch<{ appointments: Pending[] }>('/api/finance/pending')).appointments)
      setFailed(false)
    } catch (err) {
      setFailed(true)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar')
    }
  }, [])

  useEffect(() => {
    void load()
    window.addEventListener(FINANCE_CHANGED_EVENT, load)
    return () => window.removeEventListener(FINANCE_CHANGED_EVENT, load)
  }, [load])

  const generate = async (id: string) => {
    setBusy(id)
    try {
      const { sale } = await financeFetch<{ sale: SaleDto }>(`/api/finance/appointments/${id}/sale`, { method: 'POST' })
      await load()
      openSaleSheet(sale.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível gerar a comanda')
    } finally {
      setBusy(null)
    }
  }

  /** Gera todas as comandas em aberto (uma a uma, sem abrir a folha); recebimento fica para depois. */
  const generateAll = async () => {
    if (!rows?.length) return
    setGeneratingAll(true)
    let done = 0
    let failedCount = 0
    for (const row of rows) {
      try {
        await financeFetch(`/api/finance/appointments/${row.id}/sale`, { method: 'POST' })
        done += 1
      } catch {
        failedCount += 1
      }
    }
    setGeneratingAll(false)
    window.dispatchEvent(new CustomEvent(FINANCE_CHANGED_EVENT))
    if (failedCount === 0) toast.success(`${done} ${done === 1 ? 'comanda gerada' : 'comandas geradas'}. Receba em A receber.`)
    else toast.error(`${done} geradas, ${failedCount} com erro. Tente as restantes uma a uma.`)
  }

  if (!rows && failed) return <ErrorState message="Não foi possível carregar as pendências." onRetry={() => void load()} />
  if (!rows) return <Skeleton className="h-40 w-full rounded-xl" />
  if (rows.length === 0) {
    return <EmptyState icon={CheckCircle2} title="Tudo em dia" description="Todo atendimento concluído já tem comanda." />
  }

  return (
    <div className="space-y-3">
      {rows.length > 1 && (
        <Button className="min-h-11 w-full" variant="outline" onClick={generateAll} disabled={generatingAll || busy !== null}>
          {generatingAll && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Gerar todas as {rows.length} comandas
        </Button>
      )}
      <Card className="overflow-hidden border border-border">
        <CardContent className="p-0">
          {rows.map((r, index) => (
            <div key={r.id}>
              {index > 0 && <Separator />}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.clientName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {dateTime.format(new Date(r.date))} · {r.serviceName ?? 'Atendimento'}
                    {r.professionalName && ` · ${r.professionalName}`}
                  </p>
                </div>
                <Money cents={r.priceCents} currency={currency} className="text-sm" />
                <Button variant="outline" className="min-h-11" onClick={() => generate(r.id)} disabled={busy === r.id || generatingAll}>
                  {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerar comanda'}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
