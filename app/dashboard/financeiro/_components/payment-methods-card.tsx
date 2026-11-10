'use client'

import { useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatBps, formatMoney } from '@/lib/finance/money'
import { cn } from '@/lib/utils'
import { paymentMethodMeta } from './payment-method-icon'
import { PaymentMethodDialog, type PaymentMethodFormValues } from './payment-method-dialog'
import { financeFetch, type CurrencyCode, type PaymentMethodDto } from './types'

function feeLabel(method: PaymentMethodDto, currency: CurrencyCode) {
  const parts: string[] = []
  if (method.feeBps > 0) parts.push(`${formatBps(method.feeBps)}%`)
  if (method.feeFixedCents > 0) parts.push(formatMoney(method.feeFixedCents, currency))
  return parts.length ? parts.join(' + ') : 'Sem taxa'
}

interface PaymentMethodsCardProps {
  methods: PaymentMethodDto[]
  currency: CurrencyCode
  onChanged: () => void
}

export function PaymentMethodsCard({ methods, currency, onChanged }: PaymentMethodsCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentMethodDto | null>(null)

  const openDialog = (method: PaymentMethodDto | null) => {
    setEditing(method)
    setDialogOpen(true)
  }

  const handleSubmit = async ({ isActive, ...values }: PaymentMethodFormValues) => {
    if (editing) {
      await financeFetch(`/api/finance/payment-methods/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...values, isActive })
      })
      toast.success('Forma de pagamento atualizada')
    } else {
      await financeFetch('/api/finance/payment-methods', { method: 'POST', body: JSON.stringify(values) })
      toast.success('Forma de pagamento criada')
    }
    onChanged()
  }

  return (
    <Card className="overflow-hidden border border-border">
      <CardContent className="p-0">
        {methods.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma forma de pagamento cadastrada.</p>
        ) : (
          methods.map((method, index) => {
            const { icon: Icon, label } = paymentMethodMeta(method.type)
            return (
              <div key={method.id}>
                <button
                  type="button"
                  onClick={() => openDialog(method)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted',
                    !method.isActive && 'opacity-50'
                  )}
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{method.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {label}
                      {!method.isActive && ' · inativa'}
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">{feeLabel(method, currency)}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
                {index < methods.length - 1 && <Separator />}
              </div>
            )
          })
        )}
        <Separator />
        <Button variant="ghost" className="h-11 w-full rounded-none text-primary" onClick={() => openDialog(null)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Adicionar forma de pagamento
        </Button>
      </CardContent>

      <PaymentMethodDialog open={dialogOpen} onOpenChange={setDialogOpen} method={editing} onSubmit={handleSubmit} />
    </Card>
  )
}
