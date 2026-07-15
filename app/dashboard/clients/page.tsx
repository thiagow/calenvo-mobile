'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Plus, Phone, History, Package, Edit, Users, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { useSegmentConfig } from '@/contexts/segment-context'
import { BRAZILIAN_STATES } from '@/lib/brazilian-states'

interface Client {
  id: string
  name: string
  email: string | null
  phone: string
  cpf: string | null
  birthDate: string | null
  address: string | null
  city: string | null
  state: string | null
  notes?: string | null
  createdAt: string
  appointmentsCount: number
  loyaltyPoints?: number | null
}

const emptyForm = { name: '', email: '', phone: '', cpf: '', birthDate: '', address: '', city: '', state: '', gender: '', notes: '' }

export default function ClientsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { config: segmentConfig } = useSegmentConfig()
  const t = segmentConfig.terminology

  const [clients, setClients] = useState<Client[]>([])
  const [stats, setStats] = useState({ totalClients: 0, newClientsThisMonth: 0, totalAppointments: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loyaltyActive, setLoyaltyActive] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [formData, setFormData] = useState(emptyForm)

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients/stats')
      if (res.ok) {
        const data = await res.json()
        setClients(data.clients || [])
        setStats(data.stats)
        setLoyaltyActive(data.loyaltyActive || false)
      }
    } catch {
      toast.error('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchClients() }, [])

  const openNew = () => { setFormData(emptyForm); setIsEditMode(false); setSelectedClient(null); setSheetOpen(true) }
  const openEdit = (p: Client) => {
    setFormData({ name: p.name, email: p.email || '', phone: p.phone, cpf: p.cpf || '', birthDate: p.birthDate ? new Date(p.birthDate).toISOString().split('T')[0] : '', address: p.address || '', city: p.city || '', state: p.state || '', gender: '', notes: p.notes || '' })
    setSelectedClient(p); setIsEditMode(true); setSheetOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.phone) { toast.error('Nome e WhatsApp são obrigatórios'); return }
    setSaving(true)
    try {
      const url = isEditMode && selectedClient ? `/api/clients/${selectedClient.id}` : '/api/clients'
      const res = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, email: formData.email || null, cpf: formData.cpf || null, address: formData.address || null, city: formData.city || null, state: formData.state || null, notes: formData.notes || null, birthDate: formData.birthDate || null })
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Erro ao salvar') }
      toast.success(isEditMode ? 'Cliente atualizado!' : 'Cliente criado!')
      setSheetOpen(false)
      await fetchClients()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar cliente')
    } finally {
      setSaving(false)
    }
  }

  const set = (field: string, value: string) => setFormData(f => ({ ...f, [field]: value }))

  const filtered = clients.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    p.phone.includes(searchTerm)
  )

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Buscar ${t.clients.toLowerCase()}...`}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Stats rápidas */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {[
          { label: `Total de ${t.clients}`, value: stats.totalClients },
          { label: 'Novos este mês', value: stats.newClientsThisMonth },
          { label: `${t.appointments} realizados`, value: stats.totalAppointments },
        ].map(s => (
          <div key={s.label} className="flex-shrink-0 bg-muted rounded-lg px-3 py-2 text-center min-w-[110px]">
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {searchTerm ? `Nenhum ${t.client.toLowerCase()} encontrado` : `Nenhum ${t.client.toLowerCase()} cadastrado`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(client => (
            <Card key={client.id} className="border border-border active:bg-muted/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{client.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{client.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {client.appointmentsCount} {client.appointmentsCount === 1 ? t.appointment.toLowerCase() : t.appointments.toLowerCase()}
                      </Badge>
                      {loyaltyActive && client.loyaltyPoints != null && client.loyaltyPoints > 0 && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">
                          ⭐ {client.loyaltyPoints} pts
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => router.push(`/dashboard/clients/${client.id}/packages`)}>
                      <Package className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => router.push(`/dashboard/clients/${client.id}/history`)}>
                      <History className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(client)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {client.notes && (
                  <p className="mt-2 text-xs text-muted-foreground bg-muted rounded px-2 py-1 truncate">
                    {client.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={openNew}
        className="fixed right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 1rem)' }}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Sheet de formulário */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle>{isEditMode ? 'Editar' : 'Novo'} {t.client}</SheetTitle>
          </SheetHeader>

          <div className="space-y-3 pb-6">
            <div>
              <Label>Nome Completo *</Label>
              <Input className="mt-1" placeholder="Nome do cliente" value={formData.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <Label>WhatsApp *</Label>
              <Input className="mt-1" placeholder="(11) 99999-9999" value={formData.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input className="mt-1" type="email" placeholder="email@exemplo.com" value={formData.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPF</Label>
                <Input className="mt-1" placeholder="000.000.000-00" value={formData.cpf} onChange={e => set('cpf', e.target.value)} />
              </div>
              <div>
                <Label>Nascimento</Label>
                <Input className="mt-1" type="date" value={formData.birthDate} onChange={e => set('birthDate', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input className="mt-1" placeholder="Rua, número, complemento" value={formData.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cidade</Label>
                <Input className="mt-1" placeholder="Cidade" value={formData.city} onChange={e => set('city', e.target.value)} />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={formData.state} onValueChange={v => set('state', v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map(uf => <SelectItem key={uf.value} value={uf.value}>{uf.value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Input className="mt-1" placeholder="Anotações sobre o cliente" value={formData.notes} onChange={e => set('notes', e.target.value)} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : isEditMode ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
