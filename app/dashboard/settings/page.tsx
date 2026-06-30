'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Store, Clock, Globe, Upload, Copy, ExternalLink, Loader2, Save, Info, ChevronDown, ChevronRight } from 'lucide-react'
import { generateSlug } from '@/lib/utils'
import { toast } from 'sonner'
import { useUserRole } from '@/hooks/use-user-role'

interface BusinessConfig {
  autoConfirm: boolean
  allowOnlineBooking: boolean
  businessLogo: string | null
  publicUrl: string | null
  workingDays: number[]
  startTime: string
  endTime: string
  lunchStart: string | null
  lunchEnd: string | null
  address: string | null
  description: string | null
}

const DIAS_SEMANA = [
  { id: 0, label: 'Dom' }, { id: 1, label: 'Seg' }, { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' }, { id: 4, label: 'Qui' }, { id: 5, label: 'Sex' }, { id: 6, label: 'Sáb' },
]

function Section({ title, icon: Icon, iconColor, children, defaultOpen = false }: { title: string; icon: any; iconColor: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="border border-border">
      <button
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColor}`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <CardContent className="pt-0 pb-4 px-4 border-t border-border">
          <div className="pt-4 space-y-4">
            {children}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const { isProfessional } = useUserRole()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const [config, setConfig] = useState<BusinessConfig>({
    autoConfirm: false, allowOnlineBooking: true, businessLogo: null, publicUrl: null,
    workingDays: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00',
    lunchStart: '12:00', lunchEnd: '13:00', address: '', description: ''
  })
  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')

  const fetchConfig = async () => {
    const res = await fetch('/api/settings/business-config')
    if (res.ok) {
      const d = await res.json()
      setConfig({ autoConfirm: d.autoConfirm || false, allowOnlineBooking: d.allowOnlineBooking ?? true, businessLogo: d.businessLogo || null, publicUrl: d.publicUrl || null, workingDays: d.workingDays || [1,2,3,4,5], startTime: d.startTime || '08:00', endTime: d.endTime || '18:00', lunchStart: d.lunchStart || '12:00', lunchEnd: d.lunchEnd || '13:00', address: d.address || '', description: d.description || '' })
    }
  }

  const fetchProfile = async () => {
    const res = await fetch('/api/user/profile')
    if (res.ok) { const d = await res.json(); setBusinessName(d.businessName || d.name || ''); setPhone(d.phone || '') }
    setLoading(false)
  }

  useEffect(() => { fetchConfig(); fetchProfile() }, [])

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5MB'); return }
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return }
    const reader = new FileReader()
    reader.onloadend = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
    setSaving(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/upload/logo', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const d = await res.json()
      setConfig(c => ({ ...c, businessLogo: d.cloud_storage_path }))
      toast.success('Logo enviado!')
      await fetchConfig()
    } catch { toast.error('Erro ao enviar logo') } finally { setSaving(false) }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      await fetch('/api/user/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessName, phone }) })
      await fetch('/api/settings/business-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
      toast.success('Perfil salvo!')
      await fetchConfig(); await fetchProfile()
    } catch { toast.error('Erro ao salvar') } finally { setSaving(false) }
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/business-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
      if (!res.ok) throw new Error()
      toast.success('Configurações salvas!')
      await fetchConfig()
    } catch { toast.error('Erro ao salvar') } finally { setSaving(false) }
  }

  const toggleDay = (id: number) => setConfig(c => {
    const s = new Set(c.workingDays)
    s.has(id) ? s.delete(id) : s.add(id)
    return { ...c, workingDays: Array.from(s).sort((a, b) => a - b) }
  })

  const getPublicUrl = () => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const slug = config.publicUrl || generateSlug(businessName) || (session?.user as any)?.id?.substring(0, 8) || 'agendamento'
    return `${base}/booking/${slug}`
  }

  const copyUrl = () => { navigator.clipboard.writeText(getPublicUrl()); toast.success('URL copiada!') }

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
    </div>
  )

  if (isProfessional) return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium">Visualização limitada</p>
          <p className="text-xs text-muted-foreground mt-0.5">Apenas o admin pode alterar configurações do negócio.</p>
        </div>
      </div>
      <Card className="border border-border">
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">URL de Agendamento</Label>
          <div className="flex gap-2">
            <Input value={getPublicUrl()} readOnly className="bg-muted text-xs" />
            <Button size="icon" variant="outline" onClick={copyUrl}><Copy className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" onClick={() => window.open(getPublicUrl(), '_blank')}><ExternalLink className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Perfil */}
      <Section title="Perfil da Empresa" icon={Store} iconColor="bg-primary/10 text-primary" defaultOpen>
        <div className="flex items-center gap-4 pb-2">
          <div className="w-16 h-16 rounded-xl border border-border flex items-center justify-center bg-muted overflow-hidden flex-shrink-0">
            {logoPreview || config.businessLogo ? (
              <img src={logoPreview || `/api/files/logo?key=${config.businessLogo}`} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <Upload className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <Input type="file" accept="image/*" onChange={handleLogoChange} disabled={saving} className="text-xs" />
            <p className="text-[10px] text-muted-foreground mt-1">PNG/JPG, máx 5MB</p>
          </div>
        </div>

        <div>
          <Label>Nome da Empresa</Label>
          <Input className="mt-1" placeholder="Ex: Salão da Ana" value={businessName} onChange={e => setBusinessName(e.target.value)} />
        </div>
        <div>
          <Label>Telefone / WhatsApp</Label>
          <Input className="mt-1" placeholder="(11) 99999-9999" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        <div>
          <Label>Endereço</Label>
          <Textarea className="mt-1" placeholder="Rua das Flores, 123 - São Paulo, SP" value={config.address || ''} onChange={e => setConfig(c => ({ ...c, address: e.target.value }))} rows={2} />
          <p className="text-[10px] text-muted-foreground mt-1">Informado pelo Agente IA quando clientes perguntarem a localização.</p>
        </div>
        <div>
          <Label>Descrição e Regras</Label>
          <Textarea className="mt-1" placeholder="Descreva seu negócio, regras, formas de pagamento..." value={config.description || ''} onChange={e => setConfig(c => ({ ...c, description: e.target.value }))} rows={3} />
          <p className="text-[10px] text-muted-foreground mt-1">Contexto extra para o Agente IA responder clientes.</p>
        </div>
        <Button className="w-full" onClick={saveProfile} disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><Save className="mr-2 h-4 w-4" />Salvar Perfil</>}
        </Button>
      </Section>

      {/* Horários */}
      <Section title="Horários de Funcionamento" icon={Clock} iconColor="bg-orange-500/10 text-orange-600">
        <div>
          <Label className="text-xs text-muted-foreground mb-3 block">Dias de atendimento</Label>
          <div className="flex gap-2 flex-wrap">
            {DIAS_SEMANA.map(d => (
              <button
                key={d.id}
                onClick={() => toggleDay(d.id)}
                className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${config.workingDays.includes(d.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div>
            <Label className="text-xs">Abertura</Label>
            <Input className="mt-1" type="time" value={config.startTime} onChange={e => setConfig(c => ({ ...c, startTime: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Fechamento</Label>
            <Input className="mt-1" type="time" value={config.endTime} onChange={e => setConfig(c => ({ ...c, endTime: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Início almoço</Label>
            <Input className="mt-1" type="time" value={config.lunchStart || ''} onChange={e => setConfig(c => ({ ...c, lunchStart: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Fim almoço</Label>
            <Input className="mt-1" type="time" value={config.lunchEnd || ''} onChange={e => setConfig(c => ({ ...c, lunchEnd: e.target.value }))} />
          </div>
        </div>
        <Button className="w-full" variant="outline" onClick={saveConfig} disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><Save className="mr-2 h-4 w-4" />Salvar Horários</>}
        </Button>
      </Section>

      {/* Agendamento Online */}
      <Section title="Agendamento Online" icon={Globe} iconColor="bg-purple-500/10 text-purple-600">
        <div>
          <Label className="text-xs text-muted-foreground">URL pública</Label>
          <div className="flex gap-2 mt-1">
            <Input value={getPublicUrl()} readOnly className="bg-muted text-xs flex-1" />
            <Button size="icon" variant="outline" onClick={copyUrl}><Copy className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" onClick={() => window.open(getPublicUrl(), '_blank')}><ExternalLink className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          {[
            { id: 'allowOnlineBooking', label: 'Agendamento Online', desc: 'Clientes podem agendar pela URL pública', field: 'allowOnlineBooking' as const },
            { id: 'autoConfirm', label: 'Confirmação Automática', desc: config.autoConfirm ? 'Agendamentos confirmados e bloqueiam o horário automaticamente' : 'Requer aprovação manual antes de bloquear', field: 'autoConfirm' as const },
          ].map(item => (
            <div key={item.id} className="flex items-center justify-between gap-3 bg-muted/50 rounded-lg px-3 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              <Switch
                checked={config[item.field]}
                onCheckedChange={v => setConfig(c => ({ ...c, [item.field]: v }))}
              />
            </div>
          ))}
        </div>
        <Button className="w-full" variant="outline" onClick={saveConfig} disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><Save className="mr-2 h-4 w-4" />Salvar Preferências</>}
        </Button>
      </Section>
    </div>
  )
}
