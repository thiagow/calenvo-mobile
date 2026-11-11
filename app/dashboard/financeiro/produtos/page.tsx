'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Boxes, History, Loader2, PackagePlus, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { EmptyState, ErrorState } from '@/components/finance/empty-state'
import { Money, MoneyInput } from '@/components/finance/money'
import { SegmentedControl } from '@/components/finance/segmented-control'
import { STOCK_KIND_LABELS, type ProductDto, type StockMovementDto } from '@/components/finance/types'
import { financeFetch } from '@/lib/finance/client'
import type { CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'
import { FinanceShell } from '../_components/finance-shell'

const dateTime = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const NO_CATEGORY = 'Sem categoria'

export default function ProductsPage() {
  return (
    <FinanceShell title="Produtos" description="O que você vende no balcão, com preço, custo e estoque." access="master">
      {(finance) => <ProductsContent currency={finance.currency} />}
    </FinanceShell>
  )
}

type StockState = 'ok' | 'low' | 'negative' | 'untracked'

function stockState(p: ProductDto): StockState {
  if (!p.trackStock) return 'untracked'
  if (p.stockQty < 0) return 'negative'
  if (p.minStockQty != null && p.stockQty <= p.minStockQty) return 'low'
  return 'ok'
}

function ProductsContent({ currency }: { currency: CurrencyCode }) {
  const [products, setProducts] = useState<ProductDto[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<ProductDto | 'new' | null>(null)
  const [stockFor, setStockFor] = useState<ProductDto | null>(null)
  const [removing, setRemoving] = useState<ProductDto | null>(null)

  const load = useCallback(async () => {
    try {
      const { products } = await financeFetch<{ products: ProductDto[] }>('/api/finance/products?all=1')
      setProducts(products)
      setFailed(false)
      // Mantém a folha de estoque aberta com o saldo atualizado.
      setStockFor((current) => (current ? products.find((p) => p.id === current.id) ?? null : null))
    } catch (err) {
      setFailed(true)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar os produtos')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const visible = (products ?? []).filter(
      (p) => (showInactive || p.isActive) && (!q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
    )
    const map = new Map<string, ProductDto[]>()
    for (const p of visible) map.set(p.category ?? NO_CATEGORY, [...(map.get(p.category ?? NO_CATEGORY) ?? []), p])
    return [...map.entries()].sort(([a], [b]) => (a === NO_CATEGORY ? 1 : b === NO_CATEGORY ? -1 : a.localeCompare(b)))
  }, [products, search, showInactive])

  const alerts = (products ?? []).filter((p) => p.isActive && ['low', 'negative'].includes(stockState(p))).length
  const inactiveCount = (products ?? []).filter((p) => !p.isActive).length
  const categories = useMemo(() => [...new Set((products ?? []).map((p) => p.category).filter((c): c is string => Boolean(c)))], [products])

  const remove = async (product: ProductDto) => {
    try {
      const result = await financeFetch<{ deleted: boolean; deactivated: boolean }>(`/api/finance/products/${product.id}`, { method: 'DELETE' })
      toast.success(result.deactivated ? 'Produto já vendido: foi desativado e some das vendas.' : 'Produto excluído')
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir')
    }
  }

  if (!products && failed) return <ErrorState message="Não foi possível carregar os produtos." onRetry={() => void load()} />
  if (!products) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Button className="min-h-11 w-full sm:w-auto" onClick={() => setEditing('new')}>
        <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Novo produto
      </Button>

      {alerts > 0 && (
        <p role="status" className="rounded-xl border border-money-warn/30 bg-money-warn/5 px-4 py-3 text-sm">
          <span className="font-medium">{alerts}</span> {alerts === 1 ? 'produto com estoque baixo ou negativo' : 'produtos com estoque baixo ou negativo'}.
        </p>
      )}

      {products.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou código"
              className="min-h-11 pl-9"
              aria-label="Buscar produto"
            />
          </div>
          {inactiveCount > 0 && (
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm text-muted-foreground">
              Mostrar inativos ({inactiveCount})
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            </label>
          )}
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Nenhum produto cadastrado"
          description="Cadastre o que você vende no balcão para lançar na comanda do cliente e acompanhar o estoque."
          action={
            <Button className="min-h-11" onClick={() => setEditing('new')}>
              <PackagePlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Cadastrar o primeiro
            </Button>
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState icon={Search} title="Nada encontrado" description="Tente outro nome ou ajuste os filtros." />
      ) : (
        groups.map(([category, rows]) => (
          <section key={category} className="space-y-2">
            <h2 className="px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category}</h2>
            <Card className="overflow-hidden border border-border">
              <CardContent className="p-0">
                {rows.map((p, index) => (
                  <div key={p.id}>
                    {index > 0 && <Separator />}
                    <ProductRow
                      product={p}
                      currency={currency}
                      onEdit={() => setEditing(p)}
                      onStock={() => setStockFor(p)}
                      onRemove={() => setRemoving(p)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        ))
      )}

      <ProductSheet
        product={editing}
        currency={currency}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          void load()
        }}
      />
      <StockSheet product={stockFor} onClose={() => setStockFor(null)} onChanged={() => void load()} />
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Excluir ${removing?.name ?? 'produto'}?`}
        description="Se o produto já foi vendido, ele é desativado (o histórico e os relatórios continuam corretos). Senão, é excluído."
        confirmText="Excluir"
        variant="destructive"
        onConfirm={() => removing && remove(removing)}
      />
    </div>
  )
}

function ProductRow({
  product: p,
  currency,
  onEdit,
  onStock,
  onRemove
}: {
  product: ProductDto
  currency: CurrencyCode
  onEdit: () => void
  onStock: () => void
  onRemove: () => void
}) {
  const state = stockState(p)
  const margin = p.costCents != null && p.priceCents > 0 ? Math.round(((p.priceCents - p.costCents) / p.priceCents) * 100) : null
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', !p.isActive && 'opacity-60')}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{p.name}</span>
          {!p.isActive && <Badge variant="secondary">Inativo</Badge>}
        </p>
        <p className="text-xs text-muted-foreground">
          <Money cents={p.priceCents} currency={currency} />
          {margin != null && <span> · margem {margin}%</span>}
          {p.sku && <span> · {p.sku}</span>}
        </p>
      </div>

      <button
        type="button"
        onClick={onStock}
        className="min-h-11 min-w-16 rounded-lg px-2 text-right transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={p.trackStock ? `Estoque de ${p.name}: ${p.stockQty}. Ajustar` : `${p.name} sem controle de estoque`}
        disabled={!p.trackStock}
      >
        {p.trackStock ? (
          <>
            <span
              className={cn(
                'block text-sm font-semibold tabular-nums',
                state === 'negative' && 'text-money-negative',
                state === 'low' && 'text-money-warn'
              )}
            >
              {p.stockQty}
            </span>
            <span className={cn('block text-xs', state === 'negative' ? 'text-money-negative' : state === 'low' ? 'text-money-warn' : 'text-muted-foreground')}>
              {state === 'negative' ? 'negativo' : state === 'low' ? 'baixo' : 'em estoque'}
            </span>
          </>
        ) : (
          <span className="block text-xs text-muted-foreground">sem controle</span>
        )}
      </button>

      <div className="flex">
        <Button size="icon" variant="ghost" className="h-11 w-11" onClick={onEdit} aria-label={`Editar ${p.name}`}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-11 w-11 text-muted-foreground hover:text-destructive" onClick={onRemove} aria-label={`Excluir ${p.name}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------- Cadastro / edição ------------------------------- */

function ProductSheet({
  product,
  currency,
  categories,
  onClose,
  onSaved
}: {
  product: ProductDto | 'new' | null
  currency: CurrencyCode
  categories: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = product === 'new'
  const existing = product && product !== 'new' ? product : null
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState<number | null>(null)
  const [cost, setCost] = useState<number | null>(null)
  const [trackStock, setTrackStock] = useState(true)
  const [initialStock, setInitialStock] = useState('')
  const [minStock, setMinStock] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!product) return
    setName(existing?.name ?? '')
    setCategory(existing?.category ?? '')
    setSku(existing?.sku ?? '')
    setPrice(existing?.priceCents ?? null)
    setCost(existing?.costCents ?? null)
    setTrackStock(existing?.trackStock ?? true)
    setInitialStock('')
    setMinStock(existing?.minStockQty != null ? String(existing.minStockQty) : '')
    setIsActive(existing?.isActive ?? true)
  }, [product]) // eslint-disable-line react-hooks/exhaustive-deps

  const toInt = (value: string) => (value.trim() === '' ? null : Number.parseInt(value, 10))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return toast.error('Informe o nome do produto')
    if (price == null) return toast.error('Informe o preço de venda')
    const min = toInt(minStock)
    const initial = toInt(initialStock)
    if ((min != null && (Number.isNaN(min) || min < 0)) || (initial != null && (Number.isNaN(initial) || initial < 0))) {
      return toast.error('Quantidades precisam ser números inteiros, zero ou mais')
    }

    setSubmitting(true)
    try {
      const body = {
        name: name.trim(),
        category: category.trim() || null,
        sku: sku.trim() || null,
        priceCents: price,
        costCents: cost,
        trackStock,
        minStockQty: trackStock ? min : null
      }
      if (isNew) {
        await financeFetch('/api/finance/products', { method: 'POST', body: JSON.stringify({ ...body, ...(trackStock && initial ? { initialStock: initial } : {}) }) })
        toast.success('Produto cadastrado')
      } else if (existing) {
        await financeFetch(`/api/finance/products/${existing.id}`, { method: 'PUT', body: JSON.stringify({ ...body, isActive }) })
        toast.success('Produto atualizado')
      }
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar')
    } finally {
      setSubmitting(false)
    }
  }

  const margin = cost != null && price ? Math.round(((price - cost) / price) * 100) : null

  return (
    <Sheet open={Boolean(product)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-xl overflow-y-auto rounded-t-2xl px-4 pb-6 pt-5 sm:px-6">
        <SheetHeader className="space-y-1 pr-6 text-left">
          <SheetTitle className="text-xl tracking-tight">{isNew ? 'Novo produto' : 'Editar produto'}</SheetTitle>
          <SheetDescription>Preço, custo e estoque. O custo é só seu: o cliente nunca vê.</SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prod-name">Nome</Label>
            <Input id="prod-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus={isNew} className="min-h-11" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prod-category">Categoria</Label>
              <Input id="prod-category" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={40} list="prod-categories" placeholder="Opcional" className="min-h-11" />
              <datalist id="prod-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-sku">Código</Label>
              <Input id="prod-sku" value={sku} onChange={(e) => setSku(e.target.value)} maxLength={40} placeholder="Opcional" className="min-h-11" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prod-price">Preço de venda</Label>
              <MoneyInput id="prod-price" valueCents={price} onValueChange={setPrice} currency={currency} className="min-h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-cost">Custo</Label>
              <MoneyInput id="prod-cost" valueCents={cost} onValueChange={setCost} currency={currency} placeholder="Opcional" className="min-h-11" />
            </div>
          </div>
          {margin != null && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Margem de <span className={cn('font-medium', margin < 0 ? 'text-money-negative' : 'text-foreground')}>{margin}%</span> por unidade.
            </p>
          )}

          <Separator />

          <label className="flex min-h-11 cursor-pointer items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-medium">Controlar estoque</span>
              <span className="block text-xs text-muted-foreground">Cada venda baixa a quantidade. Desligue para itens sem contagem.</span>
            </span>
            <Switch checked={trackStock} onCheckedChange={setTrackStock} className="mt-0.5" />
          </label>

          {trackStock && (
            <div className="grid grid-cols-2 gap-3">
              {isNew && (
                <div className="space-y-1.5">
                  <Label htmlFor="prod-initial">Quantidade em estoque</Label>
                  <Input id="prod-initial" inputMode="numeric" value={initialStock} onChange={(e) => setInitialStock(e.target.value.replace(/\D/g, ''))} placeholder="0" className="min-h-11" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="prod-min">Avisar quando restar</Label>
                <Input id="prod-min" inputMode="numeric" value={minStock} onChange={(e) => setMinStock(e.target.value.replace(/\D/g, ''))} placeholder="Opcional" className="min-h-11" />
              </div>
            </div>
          )}
          {!isNew && trackStock && <p className="-mt-2 text-xs text-muted-foreground">Para mudar a quantidade, use “Ajustar estoque” na lista (fica registrado no histórico).</p>}

          {!isNew && (
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
              <span className="text-sm font-medium">Ativo (aparece nas vendas)</span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </label>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="min-h-11 flex-1" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11 flex-[2]" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isNew ? 'Cadastrar' : 'Salvar'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/* ---------------------------------- Estoque ---------------------------------- */

function StockSheet({ product, onClose, onChanged }: { product: ProductDto | null; onClose: () => void; onChanged: () => void }) {
  const [kind, setKind] = useState<'PURCHASE' | 'ADJUSTMENT'>('PURCHASE')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [movements, setMovements] = useState<StockMovementDto[] | null>(null)

  const loadMovements = useCallback(async (id: string) => {
    try {
      setMovements((await financeFetch<{ movements: StockMovementDto[] }>(`/api/finance/products/${id}/movements`)).movements)
    } catch {
      setMovements([])
    }
  }, [])

  const productId = product?.id
  useEffect(() => {
    if (!productId) return
    setKind('PURCHASE')
    setQuantity('')
    setNote('')
    setMovements(null)
    void loadMovements(productId)
  }, [productId, loadMovements])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!product) return
    const parsed = Number.parseInt(quantity, 10)
    if (Number.isNaN(parsed) || parsed === 0) return toast.error('Informe uma quantidade diferente de zero')
    if (kind === 'PURCHASE' && parsed < 0) return toast.error('Compra precisa ser positiva. Para tirar do estoque use Ajuste.')

    setSubmitting(true)
    try {
      await financeFetch(`/api/finance/products/${product.id}/stock`, {
        method: 'POST',
        body: JSON.stringify({ kind, quantity: parsed, note: note.trim() || undefined })
      })
      toast.success(kind === 'PURCHASE' ? 'Entrada registrada' : 'Ajuste registrado')
      setQuantity('')
      setNote('')
      onChanged()
      void loadMovements(product.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={Boolean(product)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-xl overflow-y-auto rounded-t-2xl px-4 pb-6 pt-5 sm:px-6">
        <SheetHeader className="space-y-1 pr-6 text-left">
          <SheetTitle className="text-xl tracking-tight">{product?.name}</SheetTitle>
          <SheetDescription>
            Em estoque agora: <span className="font-semibold tabular-nums text-foreground">{product?.stockQty ?? 0}</span>
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <SegmentedControl
            aria-label="Tipo de movimento"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'PURCHASE', label: 'Entrada (compra)' },
              { value: 'ADJUSTMENT', label: 'Ajuste' }
            ]}
          />
          <div className="grid grid-cols-[7rem_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="stock-qty">Quantidade</Label>
              <Input
                id="stock-qty"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(kind === 'ADJUSTMENT' ? /[^\d-]/g : /\D/g, ''))}
                placeholder={kind === 'ADJUSTMENT' ? '-2 ou 5' : '10'}
                className="min-h-11"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock-note">Motivo</Label>
              <Input id="stock-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={kind === 'PURCHASE' ? 'Ex.: NF 1234' : 'Ex.: contagem, perda'} className="min-h-11" />
            </div>
          </div>
          {kind === 'ADJUSTMENT' && <p className="text-xs text-muted-foreground">No ajuste, número negativo tira do estoque (perda ou quebra).</p>}
          <Button type="submit" className="min-h-11 w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </form>

        <section className="mt-6 space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            Histórico
          </h3>
          {movements === null ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum movimento ainda.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{STOCK_KIND_LABELS[m.kind]}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {dateTime.format(new Date(m.createdAt))}
                      {m.createdBy && ` · ${m.createdBy}`}
                      {m.note && ` · ${m.note}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-sm font-semibold tabular-nums', m.quantity < 0 ? 'text-money-negative' : 'text-money-positive')}>
                      <span className="sr-only">{m.quantity < 0 ? 'saiu ' : 'entrou '}</span>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">saldo {m.balanceAfter}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </SheetContent>
    </Sheet>
  )
}
