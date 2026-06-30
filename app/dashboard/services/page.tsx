'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Briefcase, Plus, Edit, Trash2, Clock, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { useDialog } from '@/components/providers/dialog-provider'

interface Service {
  id: string; name: string; description: string | null; duration: number
  price: number | null; category: string | null; isActive: boolean
  requiresDeposit: boolean; depositAmount: number | null
  schedules: any[]; _count: { appointments: number }
}

export default function ServicesPage() {
  const router = useRouter()
  const { status } = useSession()
  const { confirm } = useDialog()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/services')
        .then(r => r.ok ? r.json() : [])
        .then(setServices)
        .catch(() => toast.error('Erro ao carregar serviços'))
        .finally(() => setLoading(false))
    }
  }, [status])

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: 'Excluir Serviço', description: 'Tem certeza?', variant: 'destructive', confirmText: 'Excluir' })
    if (!ok) return
    try {
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Serviço excluído!')
      setServices(s => s.filter(sv => sv.id !== id))
    } catch { toast.error('Erro ao excluir serviço') }
  }

  if (status === 'loading' || loading) return (
    <div className="space-y-2">
      {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
    </div>
  )

  const byCategory = services.reduce((acc, s) => {
    const cat = s.category || 'Geral'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {} as Record<string, Service[]>)

  return (
    <div className="space-y-4">
      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Briefcase className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado</p>
          <Button size="sm" onClick={() => router.push('/dashboard/services/new')}>
            <Plus className="h-4 w-4 mr-1.5" />Criar serviço
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byCategory).map(([category, list]) => (
            <div key={category}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{category}</p>
              <div className="space-y-2">
                {list.map(service => (
                  <Card key={service.id} className="border border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{service.name}</p>
                            {!service.isActive && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inativo</Badge>}
                            {service.requiresDeposit && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Sinal: R${service.depositAmount?.toFixed(2)}</Badge>}
                          </div>
                          {service.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{service.description}</p>}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />{service.duration}min
                            </span>
                            {service.price && (
                              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                <DollarSign className="h-3 w-3" />R${service.price.toFixed(2)}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">{service._count.appointments} agendamentos</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => router.push(`/dashboard/services/${service.id}`)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(service.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => router.push('/dashboard/services/new')}
        className="fixed right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 1rem)' }}
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  )
}
