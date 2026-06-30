'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Package, Plus, Trash2, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { useDialog } from '@/components/providers/dialog-provider'

interface Service { id: string; name: string; price: number | null }
interface PackageItem { id: string; serviceId: string; totalSessions: number; service: Service }
interface PackageTemplate { id: string; name: string; price: number | null; isActive: boolean; items: PackageItem[] }

export default function PackagesPage() {
  const { confirm } = useDialog()
  const [templates, setTemplates] = useState<PackageTemplate[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [items, setItems] = useState<{ serviceId: string; sessions: number }[]>([])

  const fetchData = async () => {
    try {
      const [tRes, sRes] = await Promise.all([fetch('/api/packages'), fetch('/api/services')])
      if (tRes.ok) setTemplates(await tRes.json())
      if (sRes.ok) { const d = await sRes.json(); setServices(d.services || d) }
    } catch { toast.error('Erro ao carregar dados') } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  // Auto-calcula preço
  useEffect(() => {
    if (!sheetOpen) return
    let total = 0; let hasPrice = false
    items.forEach(({ serviceId, sessions }) => {
      const svc = services.find(s => s.id === serviceId)
      if (svc?.price) { total += svc.price * sessions; hasPrice = true }
    })
    if (hasPrice) setPrice(total.toFixed(2))
  }, [items, services, sheetOpen])

  const addService = (serviceId: string) => {
    if (!items.find(i => i.serviceId === serviceId)) setItems(p => [...p, { serviceId, sessions: 1 }])
  }

  const removeService = (serviceId: string) => setItems(p => p.filter(i => i.serviceId !== serviceId))

  const changeSessions = (serviceId: string, delta: number) => setItems(p =>
    p.map(i => i.serviceId === serviceId ? { ...i, sessions: Math.max(1, i.sessions + delta) } : i)
  )

  const resetForm = () => { setName(''); setPrice(''); setItems([]) }

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Nome do pacote é obrigatório'); return }
    if (items.length === 0) { toast.error('Adicione pelo menos um serviço'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/packages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price: price ? parseFloat(price) : null, items: items.map(i => ({ serviceId: i.serviceId, totalSessions: i.sessions })) })
      })
      if (!res.ok) throw new Error()
      toast.success('Pacote criado!')
      setSheetOpen(false); resetForm(); await fetchData()
    } catch { toast.error('Erro ao criar pacote') } finally { setSubmitting(false) }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: 'Excluir Pacote', description: 'Pacotes já vendidos não serão afetados.', variant: 'destructive', confirmText: 'Excluir' })
    if (!ok) return
    try {
      await fetch(`/api/packages/${id}`, { method: 'DELETE' })
      toast.success('Pacote excluído!'); setTemplates(t => t.filter(p => p.id !== id))
    } catch { toast.error('Erro ao excluir') }
  }

  if (loading) return (
    <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
  )

  return (
    <div className="space-y-4">
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Package className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum pacote criado</p>
          <p className="text-xs text-muted-foreground max-w-[200px]">Crie pacotes recorrentes para facilitar a vida dos seus clientes</p>
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Criar pacote
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <Card key={t.id} className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{t.name}</p>
                      {t.price && (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] px-1.5 py-0">
                          R$ {t.price.toFixed(2)}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 space-y-0.5">
                      {t.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{item.service.name}</span>
                          <span className="font-medium text-primary">{item.totalSessions}x</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {t.items.reduce((acc, i) => acc + i.totalSessions, 0)} sessão(ões) no total
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => { resetForm(); setSheetOpen(true) }}
        className="fixed right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 1rem)' }}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Sheet de criação */}
      <Sheet open={sheetOpen} onOpenChange={open => { setSheetOpen(open); if (!open) resetForm() }}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle>Novo Pacote</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 pb-6">
            <div>
              <Label>Nome do Pacote *</Label>
              <Input className="mt-1" placeholder="Ex: Pacote 10 Drenagens" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label>Valor Total (R$)</Label>
              <Input className="mt-1" type="number" placeholder="Calculado automaticamente" value={price} onChange={e => setPrice(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">Calculado a partir dos serviços. Pode editar manualmente.</p>
            </div>

            <div>
              <Label>Adicionar Serviço</Label>
              <Select onValueChange={addService}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar serviço..." /></SelectTrigger>
                <SelectContent>
                  {services.map(s => (
                    <SelectItem key={s.id} value={s.id} disabled={!!items.find(i => i.serviceId === s.id)}>
                      {s.name}{s.price ? ` · R$${s.price}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {items.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Serviços inclusos</p>
                {items.map(item => {
                  const svc = services.find(s => s.id === item.serviceId)
                  return (
                    <div key={item.serviceId} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5">
                      <span className="text-sm font-medium truncate flex-1 mr-2">{svc?.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => changeSessions(item.serviceId, -1)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-sm font-bold w-5 text-center">{item.sessions}</span>
                        <button onClick={() => changeSessions(item.serviceId, 1)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                          <Plus className="h-3 w-3" />
                        </button>
                        <button onClick={() => removeService(item.serviceId)} className="w-7 h-7 rounded-full flex items-center justify-center text-destructive ml-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleCreate} disabled={submitting}>
                {submitting ? 'Salvando...' : 'Criar Pacote'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
