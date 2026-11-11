'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MoneyInput } from '@/components/finance/money'
import { FINANCE_CHANGED_EVENT } from '@/components/finance/close-sale-sheet'
import type { EntryStatus } from '@/components/finance/types'
import { financeFetch } from '@/lib/finance/client'
import { useFeatures } from '@/hooks/use-features'
import type { CurrencyCode } from '@/lib/finance/money'
import { FinanceShell } from '../_components/finance-shell'
import { ClientTabDialog } from '../_components/client-tab-dialog'
import { NewSaleDialog } from '../_components/new-sale-dialog'
import type { ClientOption } from '@/components/finance/client-combobox'
import { EntryList, FilterPills, type EntryFilter } from '../_components/entry-list'
import { ReceivableDialog } from '../_components/receivable-dialog'

interface ReceivableRow {
  id: string
  description: string
  clientName: string | null
  category: string
  amountCents: number
  paidCents: number
  dueDate: string
  status: EntryStatus
  saleId: string | null
  origin: string
}

export default function ReceivablesPage() {
  const [creating, setCreating] = useState<'tab' | 'sale' | 'manual' | null>(null)
  const [saleClient, setSaleClient] = useState<ClientOption | null>(null)
  const isMaster = useFeatures().features?.finance.isMaster === true
  return (
    <FinanceShell
      title="A receber"
      description="Atendimentos, pacotes e vendas que ainda não entraram, ou já entraram."
      access="cash"
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Novo
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setCreating('tab')}>Comanda do cliente</DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setSaleClient(null)
                setCreating('sale')
              }}
            >
              Venda sem cliente
            </DropdownMenuItem>
            {isMaster && <DropdownMenuItem onSelect={() => setCreating('manual')}>Conta a receber</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {(finance) => (
        <>
          <ReceivablesContent currency={finance.currency} isMaster={finance.isMaster} />
          <ClientTabDialog
            open={creating === 'tab'}
            currency={finance.currency}
            onClose={() => setCreating((c) => (c === 'tab' ? null : c))}
            onNewSale={(client) => {
              setSaleClient(client)
              setCreating('sale')
            }}
          />
          <NewSaleDialog open={creating === 'sale'} currency={finance.currency} initialClient={saleClient} onClose={() => setCreating(null)} />
          <NewReceivableDialog
            open={creating === 'manual' && finance.isMaster}
            currency={finance.currency}
            onClose={() => setCreating(null)}
          />
        </>
      )}
    </FinanceShell>
  )
}

function ReceivablesContent({ currency, isMaster }: { currency: CurrencyCode; isMaster: boolean }) {
  const [filter, setFilter] = useState<EntryFilter>('open')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<ReceivableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: filter })
      if (search.trim()) params.set('q', search.trim())
      const { receivables } = await financeFetch<{ receivables: ReceivableRow[] }>(`/api/finance/receivables?${params}`)
      setRows(receivables)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(load, search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [load, search])

  useEffect(() => {
    window.addEventListener(FINANCE_CHANGED_EVENT, load)
    return () => window.removeEventListener(FINANCE_CHANGED_EVENT, load)
  }, [load])

  return (
    <div className="space-y-3">
      <FilterPills value={filter} onChange={setFilter} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente ou descrição" className="pl-9" />
      </div>
      <EntryList
        rows={rows.map((r) => ({
          id: r.id,
          title: r.clientName ? `${r.clientName}` : r.description,
          subtitle: r.clientName ? r.description.replace(` · ${r.clientName}`, '') : r.category,
          amountCents: r.amountCents,
          paidCents: r.paidCents,
          dueDate: r.dueDate,
          status: r.status
        }))}
        currency={currency}
        loading={loading}
        empty={filter === 'open' ? 'Nada em aberto. Tudo recebido.' : 'Nenhuma conta aqui.'}
        onSelect={setSelected}
      />
      <ReceivableDialog receivableId={selected} currency={currency} isMaster={isMaster} onClose={() => setSelected(null)} />
    </div>
  )
}

function NewReceivableDialog({ open, currency, onClose }: { open: boolean; currency: CurrencyCode; onClose: () => void }) {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setDescription('')
    setAmount(null)
    setDueDate(new Date().toISOString().slice(0, 10))
    financeFetch<{ categories: { id: string; name: string }[] }>('/api/finance/categories?kind=INCOME')
      .then(({ categories }) => {
        setCategories(categories)
        setCategoryId(categories[0]?.id ?? '')
      })
      .catch(() => setCategories([]))
  }, [open])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!description.trim() || !amount || !categoryId) return toast.error('Preencha descrição, categoria e valor')
    setSubmitting(true)
    try {
      await financeFetch('/api/finance/receivables', {
        method: 'POST',
        body: JSON.stringify({ description: description.trim(), categoryId, amountCents: amount, dueDate: `${dueDate}T12:00:00` })
      })
      toast.success('Conta a receber criada')
      window.dispatchEvent(new CustomEvent(FINANCE_CHANGED_EVENT))
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível criar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conta a receber</DialogTitle>
          <DialogDescription>Um valor a receber que não veio de atendimento (ex.: sublocação de sala).</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rec-desc">Descrição</Label>
            <Input id="rec-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <MoneyInput valueCents={amount} onValueChange={setAmount} currency={currency} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-due">Vencimento</Label>
              <Input id="rec-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
