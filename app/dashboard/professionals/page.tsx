'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Plus, Search, Edit, Trash2, UserCheck, UserX, Phone } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { getProfessionalLimit } from '@/lib/plan-limits'

interface Professional {
  id: string; name: string; email: string; whatsapp: string
  isActive: boolean; createdAt: string; role: string
  scheduleProfessionals?: any[]
}

export default function ProfessionalsPage() {
  const router = useRouter()
  const { status } = useSession()
  const [loading, setLoading] = useState(true)
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [canAddMore, setCanAddMore] = useState(false)
  const [planType, setPlanType] = useState('BASICO')

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status !== 'authenticated') return
    Promise.all([fetch('/api/professionals'), fetch('/api/user/plan')])
      .then(async ([pRes, planRes]) => {
        if (pRes.status === 403) { toast.error('Acesso negado'); router.push('/dashboard'); return }
        if (pRes.ok) setProfessionals(await pRes.json())
        if (planRes.ok) {
          const d = await planRes.json()
          setPlanType(d.planType)
          const limit = getProfessionalLimit(d.planType)
          setCanAddMore(limit === -1 || professionals.length + 1 < limit)
        }
      })
      .catch(() => toast.error('Erro ao carregar profissionais'))
      .finally(() => setLoading(false))
  }, [status])

  const handleToggleActive = async (pro: Professional) => {
    try {
      const res = await fetch(`/api/professionals/${pro.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !pro.isActive })
      })
      if (!res.ok) throw new Error()
      setProfessionals(p => p.map(x => x.id === pro.id ? { ...x, isActive: !x.isActive } : x))
      toast.success(`Profissional ${!pro.isActive ? 'ativado' : 'desativado'}`)
    } catch { toast.error('Erro ao atualizar') }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/professionals/${id}`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      setProfessionals(p => p.filter(x => x.id !== id))
      toast.success('Profissional removido')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao remover') }
  }

  if (loading) return (
    <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
  )

  const filtered = professionals.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.whatsapp?.includes(searchTerm)
  )

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, e-mail ou WhatsApp..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
      </div>

      {/* Aviso de limite */}
      {!canAddMore && planType !== 'BUSINESS' && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-700 flex-1">Limite de profissionais do plano {planType} atingido.</p>
          <Link href="/dashboard/plans">
            <Button size="sm" variant="outline" className="text-xs h-7">Upgrade</Button>
          </Link>
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {searchTerm ? 'Nenhum profissional encontrado' : 'Nenhum profissional cadastrado'}
          </p>
          {!searchTerm && canAddMore && (
            <Button size="sm" onClick={() => router.push('/dashboard/professionals/new')}>
              <Plus className="h-4 w-4 mr-1.5" />Adicionar profissional
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(pro => (
            <Card key={pro.id} className={`border border-border ${!pro.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{pro.name}</p>
                      <Badge variant={pro.isActive ? 'default' : 'secondary'} className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${pro.isActive ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''}`}>
                        {pro.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{pro.email}</p>
                    {pro.whatsapp && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{pro.whatsapp}</span>
                      </div>
                    )}
                    {pro.scheduleProfessionals && pro.scheduleProfessionals.length > 0 && (
                      <p className="text-[10px] text-primary mt-1">{pro.scheduleProfessionals.length} agenda(s) vinculada(s)</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => router.push(`/dashboard/professionals/${pro.id}`)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className={`h-8 w-8 ${pro.isActive ? 'text-amber-600' : 'text-green-600'}`} onClick={() => handleToggleActive(pro)}>
                      {pro.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(pro.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* FAB */}
      {canAddMore && (
        <button
          onClick={() => router.push('/dashboard/professionals/new')}
          className="fixed right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 1rem)' }}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  )
}
