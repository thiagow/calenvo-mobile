'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar, Plus, Edit, Trash2, Clock, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { useDialog } from '@/components/providers/dialog-provider'

interface Schedule {
  id: string; name: string; description: string | null; color: string
  isActive: boolean; workingDays: number[]; startTime: string; endTime: string
  slotDuration: number; bufferTime: number; services: any[]
  _count: { appointments: number }
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function SchedulesPage() {
  const router = useRouter()
  const { status } = useSession()
  const { confirm } = useDialog()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/schedules')
      .then(r => r.ok ? r.json() : [])
      .then(setSchedules)
      .catch(() => toast.error('Erro ao carregar agendas'))
      .finally(() => setLoading(false))
  }, [status])

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: 'Excluir Agenda', description: 'Tem certeza que deseja excluir esta agenda?', variant: 'destructive', confirmText: 'Excluir' })
    if (!ok) return
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setSchedules(s => s.filter(x => x.id !== id))
      toast.success('Agenda excluída!')
    } catch { toast.error('Erro ao excluir agenda') }
  }

  if (status === 'loading' || loading) return (
    <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}</div>
  )

  return (
    <div className="space-y-4">
      {schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhuma agenda cadastrada</p>
          <p className="text-xs text-muted-foreground max-w-[200px]">Crie sua primeira agenda para gerenciar seus atendimentos</p>
          <Button size="sm" onClick={() => router.push('/dashboard/schedules/new')}>
            <Plus className="h-4 w-4 mr-1.5" />Criar agenda
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map(schedule => (
            <Card key={schedule.id} className={`border border-border ${!schedule.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                {/* Nome e ações */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: schedule.color }} />
                    <p className="font-semibold text-sm truncate">{schedule.name}</p>
                    {!schedule.isActive && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">Inativa</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => router.push(`/dashboard/schedules/${schedule.id}`)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(schedule.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Dias de atendimento */}
                <div className="flex gap-1 mb-2">
                  {DAY_NAMES.map((d, i) => (
                    <span
                      key={i}
                      className={`text-[10px] w-7 h-6 flex items-center justify-center rounded font-medium ${schedule.workingDays.includes(i) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                    >
                      {d}
                    </span>
                  ))}
                </div>

                {/* Horários e stats */}
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{schedule.startTime}–{schedule.endTime}</span>
                    <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] ml-1">{schedule.slotDuration}min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{schedule.services.length} serv.</span>
                    <span>{schedule._count.appointments} agend.</span>
                  </div>
                </div>

                {schedule.description && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">{schedule.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => router.push('/dashboard/schedules/new')}
        className="fixed right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 1rem)' }}
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  )
}
