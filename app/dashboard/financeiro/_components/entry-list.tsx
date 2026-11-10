'use client'

import { ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Money } from '@/components/finance/money'
import { STATUS_LABELS, type EntryStatus } from '@/components/finance/types'
import type { CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'

export type EntryFilter = 'open' | 'overdue' | 'paid' | 'all'

export const FILTERS: { value: EntryFilter; label: string }[] = [
  { value: 'open', label: 'Em aberto' },
  { value: 'overdue', label: 'Vencidas' },
  { value: 'paid', label: 'Pagas' },
  { value: 'all', label: 'Todas' }
]

export function FilterPills({ value, onChange }: { value: EntryFilter; onChange: (v: EntryFilter) => void }) {
  return (
    <div role="tablist" className="grid grid-cols-4 rounded-lg bg-muted p-1">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          role="tab"
          type="button"
          aria-selected={value === f.value}
          onClick={() => onChange(f.value)}
          className={cn(
            'rounded-md py-1.5 text-xs font-medium transition-all sm:text-sm',
            value === f.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

export interface EntryRow {
  id: string
  title: string
  subtitle: string
  amountCents: number
  paidCents: number
  dueDate: string
  status: EntryStatus
}

const dayFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

function dueLabel(dueDate: string, status: EntryStatus) {
  if (status === 'PAID' || status === 'CANCELLED') return STATUS_LABELS[status]
  const due = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return `Venceu ${dayFormatter.format(due)}`
  if (days === 0) return 'Vence hoje'
  if (days === 1) return 'Vence amanhã'
  return `Vence ${dayFormatter.format(due)}`
}

export function EntryList({
  rows,
  currency,
  loading,
  empty,
  onSelect
}: {
  rows: EntryRow[]
  currency: CurrencyCode
  loading: boolean
  empty: string
  onSelect: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    )
  }
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>

  const totalOpen = rows.reduce((acc, r) => acc + (r.status === 'PAID' ? r.amountCents : r.amountCents - r.paidCents), 0)
  return (
    <div className="space-y-2">
      <Card className="overflow-hidden border border-border">
        <CardContent className="p-0">
          {rows.map((row, index) => {
            const overdue = (row.status === 'OPEN' || row.status === 'PARTIAL') && new Date(row.dueDate) < new Date(new Date().setHours(0, 0, 0, 0))
            const open = row.amountCents - row.paidCents
            return (
              <div key={row.id}>
                {index > 0 && <Separator />}
                <button
                  type="button"
                  onClick={() => onSelect(row.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      <span className={cn(overdue && 'font-medium text-rose-500')}>{dueLabel(row.dueDate, row.status)}</span>
                      {row.subtitle && ` · ${row.subtitle}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <Money
                      cents={row.status === 'PAID' ? row.amountCents : open}
                      currency={currency}
                      className={cn('text-sm font-semibold', row.status === 'PAID' && 'text-muted-foreground')}
                    />
                    {row.status === 'PARTIAL' && (
                      <p className="text-[10px] text-muted-foreground">
                        de <Money cents={row.amountCents} currency={currency} />
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                </button>
              </div>
            )
          })}
        </CardContent>
      </Card>
      <p className="px-1 text-right text-xs text-muted-foreground">
        {rows.length} {rows.length === 1 ? 'conta' : 'contas'} · <Money cents={totalOpen} currency={currency} className="font-medium text-foreground" />
      </p>
    </div>
  )
}
