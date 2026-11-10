'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { CommissionBase, FinanceConfigDto } from './types'

const COMMISSION_BASES: { value: CommissionBase; title: string; text: string }[] = [
  {
    value: 'AFTER_DISCOUNT',
    title: 'Valor cobrado',
    text: 'Comissão sobre o que o cliente pagou, já com descontos.'
  },
  {
    value: 'AFTER_FEES',
    title: 'Valor líquido',
    text: 'Também desconta a taxa da maquininha antes de calcular.'
  }
]

interface FinanceRulesCardProps {
  config: FinanceConfigDto
  saving: boolean
  onChange: (changes: Partial<FinanceConfigDto>) => void
}

export function FinanceRulesCard({ config, saving, onChange }: FinanceRulesCardProps) {
  return (
    <Card className="border border-border">
      <CardContent className="space-y-5 p-4">
        <div className="space-y-2.5">
          <div>
            <p className="text-sm font-medium">Base da comissão</p>
            <p className="text-xs text-muted-foreground">Vale para comissões em percentual.</p>
          </div>
          <div role="radiogroup" aria-label="Base da comissão" className="grid grid-cols-2 gap-2">
            {COMMISSION_BASES.map((option) => {
              const selected = config.commissionBase === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={saving}
                  onClick={() => !selected && onChange({ commissionBase: option.value })}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
                    saving && 'opacity-60'
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span
                      aria-hidden
                      className={cn(
                        'flex h-3.5 w-3.5 items-center justify-center rounded-full border',
                        selected ? 'border-primary' : 'border-muted-foreground/40'
                      )}
                    >
                      {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    </span>
                    {option.title}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{option.text}</span>
                </button>
              )
            })}
          </div>
        </div>

        <ToggleRow
          title="Exigir caixa aberto para receber"
          text="Todo recebimento fica vinculado a um caixa, para o fechamento bater."
          checked={config.requireOpenCashSession}
          disabled={saving}
          onCheckedChange={(v) => onChange({ requireOpenCashSession: v })}
        />
        <ToggleRow
          title="Acertar só o que já foi pago"
          text="Comissão de atendimento em aberto (fiado) espera o cliente pagar."
          checked={config.settleOnlyPaidCommissions}
          disabled={saving}
          onCheckedChange={(v) => onChange({ settleOnlyPaidCommissions: v })}
        />
      </CardContent>
    </Card>
  )
}

function ToggleRow({
  title,
  text,
  checked,
  disabled,
  onCheckedChange
}: {
  title: string
  text: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} className="mt-0.5" />
    </label>
  )
}
