'use client'

import { useState } from 'react'
import { Loader2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { financeFetch } from '@/lib/finance/client'
import type { CurrencyCode } from '@/lib/finance/money'
import { MoneyInput } from './money'

/** "Abra o caixa" no meio de um fluxo (ex.: ao receber), sem sair da tela. */
export function OpenCashInline({ currency, onOpened }: { currency: CurrencyCode; onOpened: () => void }) {
  const [openingCents, setOpeningCents] = useState<number | null>(0)
  const [opening, setOpening] = useState(false)

  const open = async () => {
    if (openingCents == null) return toast.error('Informe o troco inicial')
    setOpening(true)
    try {
      await financeFetch('/api/finance/cash-sessions', { method: 'POST', body: JSON.stringify({ openingCents }) })
      toast.success('Caixa aberto')
      onOpened()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível abrir o caixa')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-money-warn/30 bg-money-warn/5 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Wallet className="h-4 w-4 text-money-warn" />
        O caixa está fechado
      </div>
      <p className="text-xs text-muted-foreground">Abra o caixa para registrar o recebimento. Informe o troco que está na gaveta.</p>
      <div className="flex gap-2">
        <div className="flex-1">
          <MoneyInput valueCents={openingCents} onValueChange={setOpeningCents} currency={currency} aria-label="Troco inicial" />
        </div>
        <Button type="button" onClick={open} disabled={opening}>
          {opening && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Abrir caixa
        </Button>
      </div>
    </div>
  )
}
