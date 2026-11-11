'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { SegmentedControl } from '@/components/finance/segmented-control'
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
          <SegmentedControl
            aria-label="Base da comissão"
            variant="cards"
            disabled={saving}
            value={config.commissionBase}
            onChange={(value) => onChange({ commissionBase: value })}
            options={COMMISSION_BASES.map((o) => ({ value: o.value, label: o.title, description: o.text }))}
          />
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
