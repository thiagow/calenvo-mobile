
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Plus, Edit, Trash2, Clock, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useDialog } from '@/components/providers/dialog-provider'

interface Schedule {
  id: string
  name: string
  description: string | null
  color: string
  isActive: boolean
  workingDays: number[]
  startTime: string
  endTime: string
  slotDuration: number
  bufferTime: number
  services: any[]
  _count: {
    appointments: number
  }
}

export default function SchedulesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { confirm } = useDialog()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSchedules()
    }
  }, [status])

  const fetchSchedules = async () => {
    try {
      const response = await fetch('/api/schedules')
      if (!response.ok) throw new Error('Erro ao buscar agendas')
      const data = await response.json()
      setSchedules(data)
    } catch (error) {
      console.error('Error fetching schedules:', error)
      toast.error('Erro ao carregar agendas')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Excluir Agenda',
      description: 'Tem certeza que deseja excluir esta agenda?',
      variant: 'destructive',
      confirmText: 'Excluir'
    })

    if (!confirmed) return

    try {
      const response = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Erro ao excluir agenda')

      toast.success('Agenda excluída com sucesso!')
      fetchSchedules()
    } catch (error) {
      console.error('Error deleting schedule:', error)
      toast.error('Erro ao excluir agenda')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Agendas</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Configure suas agendas e horários de atendimento
          </p>
        </div>
        <Button
          onClick={() => router.push('/dashboard/schedules/new')}
          className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Agenda
        </Button>
      </div>

      {/* Schedules List */}
      {schedules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhuma agenda cadastrada
            </h3>
            <p className="text-gray-600 mb-6">
              Crie sua primeira agenda para começar a gerenciar seus atendimentos
            </p>
            <Button
              onClick={() => router.push('/dashboard/schedules/new')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Agenda
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
          {schedules.map((schedule) => (
            <Card key={schedule.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: schedule.color }}
                      />
                      <CardTitle className="text-lg">{schedule.name}</CardTitle>
                      {!schedule.isActive && (
                        <Badge variant="secondary">Inativa</Badge>
                      )}
                    </div>
                    {schedule.description && (
                      <CardDescription className="text-sm">
                        {schedule.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/dashboard/schedules/${schedule.id}`)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(schedule.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Working Days */}
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">
                    Dias de Atendimento
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                      <Badge
                        key={day}
                        variant={schedule.workingDays.includes(day) ? 'default' : 'outline'}
                        className={`text-xs px-2 ${schedule.workingDays.includes(day)
                            ? 'bg-blue-600'
                            : 'text-gray-400'
                          }`}
                      >
                        {dayNames[day]}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Working Hours */}
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-700">
                    {schedule.startTime} às {schedule.endTime}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {schedule.slotDuration}min
                  </Badge>
                </div>

                {/* Services Count */}
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      {schedule.services.length} serviço(s)
                    </span>
                  </div>
                  <div className="text-gray-600">
                    {schedule._count.appointments} agendamento(s)
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
