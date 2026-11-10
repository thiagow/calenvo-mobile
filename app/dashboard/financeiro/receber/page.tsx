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
import type { EntryStatus, SaleDto, SaleOptionsDto } from '@/components/finance/types'
import { financeFetch, openSaleSheet } from '@/lib/finance/client'
import { useFeatures } from '@/hooks/use-features'
import type { CurrencyCode } from '@/lib/finance/money'
import { FinanceShell } from '../_components/finance-shell'
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
  const [creating, setCreating] = useState<'sale' | 'manual' | null>(null)
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
            <DropdownMenuItem onSelect={() => setCreating('sale')}>Venda avulsa</DropdownMenuItem>
            {isMaster && <DropdownMenuItem onSelect={() => setCreating('manual')}>Conta a receber</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {(finance) => (
        <>
          <ReceivablesContent currency={finance.currency} isMaster={finance.isMaster} />
          <NewSaleDialog open={creating === 'sale'} currency={finance.currency} onClose={() => setCreating(null)} />
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

const NONE = '__none__'

/** Venda avulsa: cria a comanda e abre "Fechar comanda" para adicionar itens e receber. */
function NewSaleDialog({ open, currency, onClose }: { open: boolean; currency: CurrencyCode; onClose: () => void }) {
  const [options, setOptions] = useState<SaleOptionsDto | null>(null)
  const [description, setDescription] = useState('')
  const [serviceId, setServiceId] = useState<string>(NONE)
  const [professionalId, setProfessionalId] = useState<string>(NONE)
  const [price, setPrice] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setDescription('')
    setServiceId(NONE)
    setProfessionalId(NONE)
    setPrice(null)
    financeFetch<SaleOptionsDto>('/api/finance/sales/options').then(setOptions).catch(() => setOptions({ services: [], professionals: [] }))
  }, [open])

  const service = options?.services.find((s) => s.id === serviceId)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const itemDescription = service?.name ?? description.trim()
    if (!itemDescription) return toast.error('Escolha um serviço ou descreva a venda')
    if (price == null) return toast.error('Informe o valor')
    setSubmitting(true)
    try {
      const { sale } = await financeFetch<{ sale: SaleDto }>('/api/finance/sales', {
        method: 'POST',
        body: JSON.stringify({
          description: description.trim() || itemDescription,
          items: [
            {
              serviceId: service?.id ?? null,
              description: itemDescription,
              professionalId: professionalId === NONE ? null : professionalId,
              quantity: 1,
              unitPriceCents: price
            }
          ]
        })
      })
      onClose()
      window.dispatchEvent(new CustomEvent(FINANCE_CHANGED_EVENT))
      openSaleSheet(sale.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível criar a venda')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Venda avulsa</DialogTitle>
          <DialogDescription>Um serviço sem agendamento ou um produto. Depois você confere e recebe na comanda.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Serviço</Label>
            <Select
              value={serviceId}
              onValueChange={(v) => {
                setServiceId(v)
                const s = options?.services.find((x) => x.id === v)
                if (s?.priceCents != null) setPrice(s.priceCents)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {options?.services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
                <SelectItem value={NONE}>Outro (produto, taxa…)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {serviceId === NONE && (
            <div className="space-y-1.5">
              <Label htmlFor="sale-desc">Descrição</Label>
              <Input id="sale-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Shampoo 300ml" maxLength={120} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Profissional</Label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options?.professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <MoneyInput valueCents={price} onValueChange={setPrice} currency={currency} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continuar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
