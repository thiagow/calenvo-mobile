
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Trash2, Calendar, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useDialog } from '@/components/providers/dialog-provider'

interface ScheduleBlock {
  id: string
  startDate: string
  endDate: string
  reason?: string
  isAllDay: boolean
}

interface ScheduleBlocksProps {
  scheduleId: string
  scheduleName?: string
}

export function ScheduleBlocks({ scheduleId, scheduleName }: ScheduleBlocksProps) {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const { confirm } = useDialog()
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    isAllDay: true
  })

  useEffect(() => {
    fetchBlocks()
  }, [scheduleId])

  const fetchBlocks = async () => {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/blocks`)
      if (!response.ok) throw new Error('Erro ao buscar bloqueios')

      const data = await response.json()
      setBlocks(data)
    } catch (error) {
      console.error('Error fetching blocks:', error)
      toast.error('Erro ao carregar bloqueios')
    }
  }

  const handleCreateBlock = async () => {
    if (!formData.startDate || !formData.endDate) {
      toast.error('Preencha as datas de início e fim')
      return
    }

    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      toast.error('Data de fim deve ser posterior à data de início')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar bloqueio')
      }

      toast.success('Bloqueio criado com sucesso!')
      setDialogOpen(false)
      setFormData({
        startDate: '',
        endDate: '',
        reason: '',
        isAllDay: true
      })
      fetchBlocks()
    } catch (error) {
      console.error('Error creating block:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar bloqueio')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    const confirmed = await confirm({
      title: 'Remover Bloqueio',
      description: 'Deseja realmente remover este bloqueio?',
      variant: 'destructive',
      confirmText: 'Remover'
    })

    if (!confirmed) return

    try {
      const response = await fetch(
        `/api/schedules/${scheduleId}/blocks/${blockId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) throw new Error('Erro ao remover bloqueio')

      toast.success('Bloqueio removido com sucesso!')
      fetchBlocks()
    } catch (error) {
      console.error('Error deleting block:', error)
      toast.error('Erro ao remover bloqueio')
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    } catch {
      return dateString
    }
  }

  const formatDateTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    } catch {
      return dateString
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Bloqueios de Períodos
            </CardTitle>
            <CardDescription>
              Bloqueie dias específicos em que a agenda não estará disponível
              {scheduleName && ` para ${scheduleName}`}
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Bloqueio
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Bloqueio</DialogTitle>
                <DialogDescription>
                  Bloqueie um período específico em que não haverá atendimento
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="startDate">Data de Início *</Label>
                  <Input
                    id="startDate"
                    type={formData.isAllDay ? 'date' : 'datetime-local'}
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="endDate">Data de Término *</Label>
                  <Input
                    id="endDate"
                    type={formData.isAllDay ? 'date' : 'datetime-local'}
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isAllDay"
                    checked={formData.isAllDay}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isAllDay: checked })
                    }
                  />
                  <Label htmlFor="isAllDay" className="cursor-pointer">
                    Dia inteiro
                  </Label>
                </div>

                <div>
                  <Label htmlFor="reason">Motivo (opcional)</Label>
                  <Textarea
                    id="reason"
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    placeholder="Ex: Férias, Feriado, Congresso..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateBlock} disabled={loading}>
                    {loading ? 'Criando...' : 'Criar Bloqueio'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {blocks.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              Nenhum bloqueio configurado ainda
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Adicione bloqueios para períodos de férias, feriados ou outros eventos
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {blocks.map((block) => (
              <div
                key={block.id}
                className="border rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">
                        {block.isAllDay ? (
                          <>
                            {formatDate(block.startDate)}
                            {block.startDate !== block.endDate && (
                              <> até {formatDate(block.endDate)}</>
                            )}
                          </>
                        ) : (
                          <>
                            {formatDateTime(block.startDate)} até{' '}
                            {formatDateTime(block.endDate)}
                          </>
                        )}
                      </span>
                    </div>
                    {block.reason && (
                      <p className="text-sm text-gray-600 ml-6">
                        {block.reason}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 ml-6">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        {block.isAllDay ? 'Dia Inteiro' : 'Horário Específico'}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBlock(block.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
