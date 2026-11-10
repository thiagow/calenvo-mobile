'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { formatBps, parseMoneyInput, parsePercentToBps } from '@/lib/finance/money'
import { cn } from '@/lib/utils'
import { PAYMENT_METHOD_TYPES } from './payment-method-icon'
import type { PaymentMethodDto, PaymentMethodType } from './types'

export interface PaymentMethodFormValues {
  name: string
  type: PaymentMethodType
  feeBps: number
  feeFixedCents: number
  isActive: boolean
}

interface PaymentMethodDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = nova forma de pagamento */
  method: PaymentMethodDto | null
  onSubmit: (values: PaymentMethodFormValues) => Promise<void>
}

const centsToInput = (cents: number) => (cents === 0 ? '' : (cents / 100).toFixed(2).replace('.', ','))

export function PaymentMethodDialog({ open, onOpenChange, method, onSubmit }: PaymentMethodDialogProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<PaymentMethodType>('PIX')
  const [feePercent, setFeePercent] = useState('')
  const [feeFixed, setFeeFixed] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(method?.name ?? '')
    setType(method?.type ?? 'PIX')
    setFeePercent(method && method.feeBps > 0 ? formatBps(method.feeBps) : '')
    setFeeFixed(centsToInput(method?.feeFixedCents ?? 0))
    setIsActive(method?.isActive ?? true)
    setError(null)
  }, [open, method])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const feeBps = feePercent.trim() ? parsePercentToBps(feePercent) : 0
    const feeFixedCents = feeFixed.trim() ? parseMoneyInput(feeFixed) : 0
    if (!name.trim()) return setError('Informe um nome')
    if (feeBps === null) return setError('Taxa percentual inválida (ex.: 2,99)')
    if (feeFixedCents === null) return setError('Taxa fixa inválida (ex.: 0,50)')

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ name: name.trim(), type, feeBps, feeFixedCents, isActive })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{method ? 'Editar forma de pagamento' : 'Nova forma de pagamento'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pm-name">Nome</Label>
            <Input
              id="pm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Crédito Stone"
              maxLength={60}
              autoFocus={!method}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_METHOD_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  aria-pressed={type === value}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[11px] font-medium transition-colors',
                    type === value
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            {type === 'CASH' && (
              <p className="text-[11px] text-muted-foreground">Entra na conferência da gaveta no fechamento do caixa.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pm-fee-pct">Taxa (%)</Label>
              <Input
                id="pm-fee-pct"
                inputMode="decimal"
                value={feePercent}
                onChange={(e) => setFeePercent(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm-fee-fixed">Taxa fixa</Label>
              <Input
                id="pm-fee-fixed"
                inputMode="decimal"
                value={feeFixed}
                onChange={(e) => setFeeFixed(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>
          <p className="-mt-2 text-[11px] text-muted-foreground">
            O que a operadora desconta por transação. Usado no valor líquido e, se você escolher, na comissão.
          </p>

          {method && (
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <span className="text-sm">Disponível para receber</span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </label>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
