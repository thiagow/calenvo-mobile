'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ClientCombobox, type ClientOption } from '@/components/finance/client-combobox'
import { MoneyInput } from '@/components/finance/money'
import { SegmentedControl } from '@/components/finance/segmented-control'
import { FINANCE_CHANGED_EVENT } from '@/components/finance/close-sale-sheet'
import type { SaleDto, SaleOptionsDto } from '@/components/finance/types'
import { financeFetch, openSaleSheet } from '@/lib/finance/client'
import type { CurrencyCode } from '@/lib/finance/money'

const NONE = '__none__'

interface NewSaleDialogProps {
  open: boolean
  currency: CurrencyCode
  onClose: () => void
  /** Cliente já escolhido (vindo de "Comanda do cliente"). */
  initialClient?: ClientOption | null
}

/**
 * Nova comanda: cliente (opcional) e o primeiro item, serviço ou produto. Cria
 * a comanda e abre "Fechar comanda" para adicionar mais itens e receber.
 */
export function NewSaleDialog({ open, currency, onClose, initialClient = null }: NewSaleDialogProps) {
  const [options, setOptions] = useState<SaleOptionsDto | null>(null)
  const [client, setClient] = useState<ClientOption | null>(null)
  const [kind, setKind] = useState<'service' | 'product'>('service')
  const [description, setDescription] = useState('')
  const [serviceId, setServiceId] = useState<string>(NONE)
  const [productId, setProductId] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [professionalId, setProfessionalId] = useState<string>(NONE)
  const [price, setPrice] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setClient(initialClient)
    setKind('service')
    setDescription('')
    setServiceId(NONE)
    setProductId('')
    setQuantity(1)
    setProfessionalId(NONE)
    setPrice(null)
    financeFetch<SaleOptionsDto>('/api/finance/sales/options')
      .then(setOptions)
      .catch(() => setOptions({ services: [], professionals: [], products: [] }))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const service = options?.services.find((s) => s.id === serviceId)
  const product = options?.products.find((p) => p.id === productId)
  const hasProducts = (options?.products.length ?? 0) > 0

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const isProduct = kind === 'product'
    if (isProduct && !product) return toast.error('Escolha o produto')
    const itemDescription = isProduct ? product!.name : service?.name ?? description.trim()
    if (!itemDescription) return toast.error('Escolha um serviço ou descreva a venda')
    if (price == null) return toast.error('Informe o valor')

    setSubmitting(true)
    try {
      const { sale } = await financeFetch<{ sale: SaleDto }>('/api/finance/sales', {
        method: 'POST',
        body: JSON.stringify({
          clientId: client?.id ?? null,
          description: (client ? `${itemDescription} · ${client.name}` : description.trim() || itemDescription).slice(0, 120),
          items: [
            isProduct
              ? { productId: product!.id, description: itemDescription, quantity, unitPriceCents: price }
              : {
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
      toast.error(err instanceof Error ? err.message : 'Não foi possível criar a comanda')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle>Nova comanda</DialogTitle>
          <DialogDescription>Comece por um item. Depois você confere, adiciona o que faltar e recebe.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sale-client">Cliente</Label>
            <ClientCombobox id="sale-client" value={client} onChange={setClient} clearable placeholder="Sem cliente (venda avulsa)" />
          </div>

          {hasProducts && (
            <SegmentedControl
              aria-label="Tipo do primeiro item"
              value={kind}
              onChange={(value) => {
                setKind(value)
                setPrice(null)
              }}
              options={[
                { value: 'service', label: 'Serviço' },
                { value: 'product', label: 'Produto' }
              ]}
            />
          )}

          {kind === 'product' ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="sale-product">Produto</Label>
                <Select
                  value={productId}
                  onValueChange={(v) => {
                    setProductId(v)
                    const p = options?.products.find((x) => x.id === v)
                    if (p) setPrice(p.priceCents)
                  }}
                >
                  <SelectTrigger id="sale-product" className="min-h-11">
                    <SelectValue placeholder="Escolha o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.trackStock && <span className="text-muted-foreground"> · {p.stockQty} em estoque</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sale-qty">Quantidade</Label>
                  <Input
                    id="sale-qty"
                    inputMode="numeric"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.min(99, Math.max(1, Number.parseInt(e.target.value.replace(/\D/g, ''), 10) || 1)))}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sale-price">Valor unitário</Label>
                  <MoneyInput id="sale-price" valueCents={price} onValueChange={setPrice} currency={currency} className="min-h-11" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="sale-service">Serviço</Label>
                <Select
                  value={serviceId}
                  onValueChange={(v) => {
                    setServiceId(v)
                    const s = options?.services.find((x) => x.id === v)
                    if (s?.priceCents != null) setPrice(s.priceCents)
                  }}
                >
                  <SelectTrigger id="sale-service" className="min-h-11">
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={NONE}>Outro (taxa, serviço fora da lista…)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {serviceId === NONE && (
                <div className="space-y-1.5">
                  <Label htmlFor="sale-desc">Descrição</Label>
                  <Input id="sale-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Taxa de encaixe" maxLength={120} className="min-h-11" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sale-pro">Profissional</Label>
                  <Select value={professionalId} onValueChange={setProfessionalId}>
                    <SelectTrigger id="sale-pro" className="min-h-11">
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
                  <Label htmlFor="sale-price-s">Valor</Label>
                  <MoneyInput id="sale-price-s" valueCents={price} onValueChange={setPrice} currency={currency} className="min-h-11" />
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" className="min-h-11" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continuar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
