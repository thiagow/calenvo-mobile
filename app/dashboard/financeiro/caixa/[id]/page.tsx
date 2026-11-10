'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Money } from '@/components/finance/money'
import { financeFetch } from '@/lib/finance/client'
import type { CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'
import { FinanceShell } from '../../_components/finance-shell'
import { CashBreakdown, CashTransactions, type CashReport } from '../../_components/cash-report'

const dateTime = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })

export default function CashSessionPage({ params }: { params: { id: string } }) {
  return (
    <FinanceShell title="Fechamento de caixa" access="cash">
      {(finance) => <SessionContent id={params.id} currency={finance.currency} />}
    </FinanceShell>
  )
}

function SessionContent({ id, currency }: { id: string; currency: CurrencyCode }) {
  const [report, setReport] = useState<CashReport | null>(null)

  useEffect(() => {
    financeFetch<{ report: CashReport }>(`/api/finance/cash-sessions/${id}`)
      .then(({ report }) => setReport(report))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar o caixa'))
  }, [id])

  if (!report) return <Skeleton className="h-64 w-full rounded-2xl" />
  const diff = report.session.differenceCents

  return (
    <div className="space-y-5">
      <Link href="/dashboard/financeiro/caixa" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Caixa
      </Link>
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm capitalize text-muted-foreground">{dateTime.format(new Date(report.session.openedAt))}</p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Troco inicial" cents={report.session.openingCents} currency={currency} />
          <Stat label="Esperado" cents={report.session.expectedCashCents ?? report.summary.expectedCashCents} currency={currency} />
          <Stat label="Contado" cents={report.session.countedCashCents ?? 0} currency={currency} />
          <div>
            <dt className="text-[11px] text-muted-foreground">Diferença</dt>
            <dd>
              {diff == null ? (
                <span className="text-sm text-muted-foreground">em aberto</span>
              ) : (
                <Money cents={diff} currency={currency} signed className={cn('text-lg font-semibold', diff === 0 ? 'text-emerald-500' : 'text-amber-500')} />
              )}
            </dd>
          </div>
        </dl>
        {report.session.notes && <p className="whitespace-pre-line text-xs text-muted-foreground">{report.session.notes}</p>}
        <p className="text-[11px] text-muted-foreground">
          Aberto por {report.session.openedBy}
          {report.session.closedBy && ` · fechado por ${report.session.closedBy}`}
        </p>
      </section>
      <CashBreakdown report={report} currency={currency} />
      <CashTransactions report={report} currency={currency} />
    </div>
  )
}

function Stat({ label, cents, currency }: { label: string; cents: number; currency: CurrencyCode }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd>
        <Money cents={cents} currency={currency} className="text-lg font-semibold" />
      </dd>
    </div>
  )
}
