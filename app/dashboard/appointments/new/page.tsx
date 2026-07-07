'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar, Clock, User, Phone, ArrowLeft, Save, Search, X, UserPlus, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useSegmentConfig } from '@/contexts/segment-context'
import { applyPhoneMask } from '@/lib/utils'

interface NewAppointmentForm {
  clientId: string; scheduleId: string; serviceId: string; professionalId: string
  patientName: string; patientEmail: string; patientPhone: string; patientCpf: string
  date: string; time: string; specialty: string; professional: string
  appointmentType: 'presencial' | 'teleconsulta'; insuranceType: 'convenio' | 'particular'
  insuranceName: string; duration: string; notes: string
}

const EMPTY: NewAppointmentForm = {
  clientId: '', scheduleId: '', serviceId: '', professionalId: '',
  patientName: '', patientEmail: '', patientPhone: '', patientCpf: '',
  date: '', time: '', specialty: '', professional: '',
  appointmentType: 'presencial', insuranceType: 'particular',
  insuranceName: '', duration: '30', notes: ''
}

export default function NewAppointmentPage() {
  const router = useRouter()
  const { status } = useSession()
  const { config: segmentConfig } = useSegmentConfig()
  const [loading, setLoading] = useState(false)
  const [schedules, setSchedules] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [availableServices, setAvailableServices] = useState<any[]>([])
  const [professionals, setProfessionals] = useState<any[]>([])
  const [availableProfessionals, setAvailableProfessionals] = useState<any[]>([])
  const [availableTimeSlots, setAvailableTimeSlots] = useState<any[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [allowsMultipleProfessionals, setAllowsMultipleProfessionals] = useState(false)
  const [clientSearchText, setClientSearchText] = useState('')
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([])
  const [isSearchingClients, setIsSearchingClients] = useState(false)
  const [showClientSuggestions, setShowClientSuggestions] = useState(false)
  const [formData, setFormData] = useState<NewAppointmentForm>(EMPTY)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status !== 'authenticated') return
    fetch('/api/user/plan').then(r => r.ok ? r.json() : null).then(d => {
      if (d) { const multi = d.planType === 'PRO' || d.planType === 'BUSINESS'; setAllowsMultipleProfessionals(multi) }
    })
    Promise.all([fetch('/api/schedules'), fetch('/api/services'), fetch('/api/professionals')])
      .then(async ([sRes, svRes, pRes]) => {
        if (sRes.ok) setSchedules((await sRes.json()).filter((s: any) => s.isActive))
        if (svRes.ok) setServices((await svRes.json()).filter((s: any) => s.isActive))
        if (pRes.ok) setProfessionals((await pRes.json()).filter((p: any) => p.isActive))
      })
  }, [status])

  useEffect(() => {
    if (!formData.scheduleId) { setAvailableServices([]); setAvailableProfessionals([]); setAvailableTimeSlots([]); return }
    const schedule = schedules.find(s => s.id === formData.scheduleId)
    if (schedule?.services) {
      const ids = schedule.services.map((ss: any) => ss.serviceId)
      const filtered = services.filter(s => ids.includes(s.id))
      setAvailableServices(filtered)
      if (filtered.length === 1) setFormData(p => ({ ...p, serviceId: filtered[0].id, duration: filtered[0].duration.toString() }))
      else setFormData(p => ({ ...p, serviceId: '', duration: schedule.slotDuration?.toString() || '30' }))
    } else { setAvailableServices([]) }
    if (allowsMultipleProfessionals && schedule?.professionals) {
      const ids = schedule.professionals.map((sp: any) => sp.professionalId)
      setAvailableProfessionals(professionals.filter(p => ids.includes(p.id)))
      setFormData(p => ({ ...p, professionalId: '' }))
    } else { setAvailableProfessionals([]) }
    setAvailableTimeSlots([])
    setFormData(p => ({ ...p, time: '' }))
  }, [formData.scheduleId, schedules, services, professionals, allowsMultipleProfessionals])

  useEffect(() => {
    if (formData.serviceId) {
      const svc = services.find(s => s.id === formData.serviceId)
      if (svc) setFormData(p => ({ ...p, duration: svc.duration.toString(), specialty: svc.name }))
    }
  }, [formData.serviceId, services])

  useEffect(() => {
    if (formData.scheduleId && formData.date && formData.serviceId) {
      setLoadingSlots(true)
      const params = new URLSearchParams({ scheduleId: formData.scheduleId, date: formData.date, serviceId: formData.serviceId })
      if (formData.professionalId) params.append('professionalId', formData.professionalId)
      fetch(`/api/appointments/available-slots?${params}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => setAvailableTimeSlots(d?.slots || []))
        .catch(() => toast.error('Erro ao carregar horários'))
        .finally(() => setLoadingSlots(false))
    } else { setAvailableTimeSlots([]) }
  }, [formData.scheduleId, formData.date, formData.serviceId, formData.professionalId])

  useEffect(() => {
    const t = setTimeout(() => {
      if (clientSearchText.trim().length >= 3) {
        setIsSearchingClients(true)
        fetch(`/api/clients?search=${encodeURIComponent(clientSearchText)}`)
          .then(r => r.json()).then(d => { setClientSearchResults(Array.isArray(d) ? d : []); setShowClientSuggestions(true) })
          .catch(() => {}).finally(() => setIsSearchingClients(false))
      } else { setClientSearchResults([]); setShowClientSuggestions(false) }
    }, 500)
    return () => clearTimeout(t)
  }, [clientSearchText])

  const set = (field: keyof NewAppointmentForm, value: string) => setFormData(p => ({ ...p, [field]: value }))

  const handleSelectClient = (client: any) => {
    setFormData(p => ({ ...p, clientId: client.id, patientName: client.name, patientEmail: client.email || '', patientPhone: client.phone || '', patientCpf: client.cpf || '' }))
    setClientSearchText(''); setShowClientSuggestions(false)
    toast.success('Cliente selecionado')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.scheduleId) { toast.error('Selecione uma agenda'); return }
    if (!formData.serviceId) { toast.error('Selecione um serviço'); return }
    if (!formData.patientName || !formData.patientPhone || !formData.date || !formData.time) { toast.error('Preencha todos os campos obrigatórios'); return }
    setLoading(true)
    try {
      let clientId = formData.clientId
      if (!clientId) {
        const res = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: formData.patientName, email: formData.patientEmail || null, phone: formData.patientPhone, cpf: formData.patientCpf || null }) })
        if (!res.ok) throw new Error((await res.json()).error || 'Erro ao criar cliente')
        clientId = (await res.json()).id
      }
      const res = await fetch('/api/appointments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, scheduleId: formData.scheduleId, serviceId: formData.serviceId, professionalId: formData.professionalId || null, date: new Date(`${formData.date}T${formData.time}:00`).toISOString(), duration: parseInt(formData.duration), status: 'SCHEDULED', modality: formData.appointmentType === 'presencial' ? 'PRESENCIAL' : 'TELECONSULTA', specialty: formData.specialty || null, insurance: formData.insuranceType === 'convenio' ? formData.insuranceName : 'Particular', notes: formData.notes || null })
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao criar agendamento')
      toast.success('Agendamento criado!')
      router.push('/dashboard/agenda')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar agendamento')
    } finally { setLoading(false) }
  }

  if (status === 'loading') return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (status === 'unauthenticated') return null

  const t = segmentConfig.terminology
  const fields = segmentConfig.fields
  const placeholders = segmentConfig.placeholders
  const availableSlots = availableTimeSlots.filter((s: any) => s.available)

  return (
    <div className="space-y-4 pb-28">
      {/* Voltar */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Agenda e Serviço */}
        <Card className="border border-border">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Agenda e Serviço
            </p>
            <div>
              <Label>{t.schedule} *</Label>
              <Select value={formData.scheduleId} onValueChange={v => set('scheduleId', v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a agenda" /></SelectTrigger>
                <SelectContent>
                  {schedules.length === 0
                    ? <SelectItem value="none" disabled>Nenhuma agenda disponível</SelectItem>
                    : schedules.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.name}
                          </div>
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
              {schedules.length === 0 && <p className="text-xs text-amber-600 mt-1">Crie uma agenda primeiro</p>}
            </div>
            <div>
              <Label>{t.service} *</Label>
              <Select value={formData.serviceId} onValueChange={v => set('serviceId', v)} disabled={!formData.scheduleId || availableServices.length === 0}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={!formData.scheduleId ? `Selecione ${t.schedule.toLowerCase()} primeiro` : availableServices.length === 0 ? 'Nenhum serviço vinculado' : `Selecione o ${t.service.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {availableServices.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.duration}min){s.price ? ` · R$ ${s.price.toFixed(2)}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {formData.duration && formData.serviceId && (
              <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-3 py-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Duração: <strong>{formData.duration} min</strong></span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cliente */}
        <Card className="border border-border">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> {t.client}
            </p>

            {/* Busca de cliente */}
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={formData.clientId ? formData.patientName : clientSearchText}
                  onChange={e => { if (!formData.clientId) setClientSearchText(e.target.value) }}
                  placeholder="Buscar cliente cadastrado..."
                  className={`pl-9 ${formData.clientId ? 'bg-primary/5 border-primary/30' : ''}`}
                  readOnly={!!formData.clientId}
                  autoComplete="off"
                />
                {formData.clientId && (
                  <button type="button" onClick={() => setFormData(p => ({ ...p, clientId: '', patientName: '', patientEmail: '', patientPhone: '', patientCpf: '' }))} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {(showClientSuggestions || isSearchingClients) && !formData.clientId && (
                <div className="absolute z-30 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                  {isSearchingClients && <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Buscando...</div>}
                  {!isSearchingClients && clientSearchResults.length === 0 && clientSearchText.length >= 3 && (
                    <div className="p-4 flex flex-col items-center gap-3">
                      <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>
                      <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" onClick={() => { setShowClientSuggestions(false); setFormData(p => ({ ...p, patientName: clientSearchText })) }}>
                        <UserPlus className="h-3.5 w-3.5" />Cadastrar como novo
                      </Button>
                    </div>
                  )}
                  {clientSearchResults.map(c => (
                    <button key={c.id} type="button" onClick={() => handleSelectClient(c)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 border-b last:border-0 text-left">
                      <span className="font-medium text-sm">{c.name}</span>
                      {c.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Campos do cliente (manual se não selecionado da base) */}
            {!formData.clientId && (
              <>
                <div>
                  <Label>Nome Completo *</Label>
                  <Input className="mt-1" value={formData.patientName} onChange={e => set('patientName', e.target.value)} placeholder={placeholders.clientName} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>WhatsApp *</Label>
                    <Input className="mt-1" value={formData.patientPhone} onChange={e => set('patientPhone', applyPhoneMask(e.target.value))} placeholder="(11) 99999-0000" required />
                  </div>
                  <div>
                    <Label>CPF</Label>
                    <Input className="mt-1" value={formData.patientCpf} onChange={e => set('patientCpf', e.target.value)} placeholder="000.000.000-00" />
                  </div>
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input className="mt-1" type="email" value={formData.patientEmail} onChange={e => set('patientEmail', e.target.value)} placeholder="email@exemplo.com" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Data / Horário / Profissional */}
        <Card className="border border-border">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Data e Horário
            </p>

            <div className={allowsMultipleProfessionals && availableProfessionals.length > 0 ? 'grid grid-cols-2 gap-3' : ''}>
              <div>
                <Label>Data *</Label>
                <Input className="mt-1" type="date" value={formData.date} onChange={e => set('date', e.target.value)} min={new Date().toISOString().split('T')[0]} required />
              </div>
              {allowsMultipleProfessionals && availableProfessionals.length > 0 && (
                <div>
                  <Label>{t.professional}</Label>
                  <Select value={formData.professionalId} onValueChange={v => set('professionalId', v)} disabled={!formData.scheduleId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                    <SelectContent>
                      {availableProfessionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Grade de horários */}
            <div>
              <Label>Horário *</Label>
              {!formData.date || !formData.serviceId ? (
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {!formData.scheduleId ? 'Selecione uma agenda' : !formData.serviceId ? 'Selecione um serviço' : 'Selecione uma data'}
                </div>
              ) : loadingSlots ? (
                <div className="mt-1 grid grid-cols-4 gap-1.5">
                  {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-9 rounded-lg" />)}
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="mt-1 flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-lg px-3 py-2.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Nenhum horário disponível nesta data
                </div>
              ) : (
                <div className="mt-1 grid grid-cols-4 gap-1.5">
                  {availableSlots.map((slot: any) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => set('time', slot.time)}
                      className={`h-9 rounded-lg text-xs font-medium transition-colors ${formData.time === slot.time ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/70'}`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {fields.showModality && (
              <div>
                <Label>Modalidade</Label>
                <Select value={formData.appointmentType} onValueChange={v => set('appointmentType', v as 'presencial' | 'teleconsulta')}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="teleconsulta">Online / Remoto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Convênio */}
        {fields.showInsurance && (
          <Card className="border border-border">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Convênio</p>
              <div>
                <Label>Tipo de Atendimento</Label>
                <Select value={formData.insuranceType} onValueChange={v => set('insuranceType', v as 'convenio' | 'particular')}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="particular">Particular</SelectItem>
                    <SelectItem value="convenio">Convênio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.insuranceType === 'convenio' && (
                <div>
                  <Label>Nome do Convênio</Label>
                  <Input className="mt-1" value={formData.insuranceName} onChange={e => set('insuranceName', e.target.value)} placeholder="Ex: Unimed, Bradesco Saúde..." />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Observações */}
        <Card className="border border-border">
          <CardContent className="p-4 space-y-2">
            <Label>Observações</Label>
            <Textarea value={formData.notes} onChange={e => set('notes', e.target.value)} placeholder={placeholders.appointmentNotes} rows={3} />
          </CardContent>
        </Card>
      </form>

      {/* Barra de ações fixa */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border px-4 pt-3 flex gap-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <Button variant="outline" className="flex-1" onClick={() => router.back()}>Cancelar</Button>
        <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</> : <><Save className="h-4 w-4 mr-2" />Criar {t.appointment}</>}
        </Button>
      </div>
    </div>
  )
}
