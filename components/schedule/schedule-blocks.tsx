
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Trash2, Calendar, AlertCircle, AlertTriangle, Layers } from 'lucide-react'
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
  groupId?: string | null
  groupSize?: number | null
}

interface BlockConflictInfo {
  conflictingAppointments: number
  schedulesCount: number
  sample: { date: string; clientName: string; serviceName: string }[]
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
  const [scope, setScope] = useState<'single' | 'all'>('single')
  const [totalSchedules, setTotalSchedules] = useState(0)
  const [conflict, setConflict] = useState<BlockConflictInfo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScheduleBlock | null>(null)

  useEffect(() => {
    fetchBlocks()
  }, [scheduleId])

  useEffect(() => {
    // Total de agendas (inclusive inativas) para o texto "Todas as agendas (N)"
    fetch('/api/schedules?includeInactive=true')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setTotalSchedules(Array.isArray(data) ? data.length : 0))
      .catch(() => setTotalSchedules(0))
  }, [])

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

    await submitBlock(false)
  }

  const submitBlock = async (confirmConflicts: boolean) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, applyToAll: scope === 'all', confirmConflicts })
      })
      const data = await response.json().catch(() => ({}))

      // Já existem agendamentos no período: nada foi criado ainda. Pede
      // confirmação ao dono antes de concluir (os existentes serão mantidos).
      if (response.status === 409 && data.code === 'BLOCK_HAS_APPOINTMENTS') {
        setConflict(data as BlockConflictInfo)
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar bloqueio')
      }

      const count = data.schedulesCount ?? 1
      toast.success(
        scope === 'all'
          ? `Bloqueio criado em ${count} agenda${count === 1 ? '' : 's'}!`
          : 'Bloqueio criado com sucesso!'
      )
      setConflict(null)
      setDialogOpen(false)
      setScope('single')
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

  const deleteBlock = async (block: ScheduleBlock, removeAll: boolean) => {
    try {
      const response = await fetch(
        `/api/schedules/${scheduleId}/blocks/${block.id}${removeAll ? '?scope=all' : ''}`,
        { method: 'DELETE' }
      )

      if (!response.ok) throw new Error('Erro ao remover bloqueio')

      toast.success(removeAll ? 'Bloqueio removido de todas as agendas!' : 'Bloqueio removido com sucesso!')
      fetchBlocks()
    } catch (error) {
      console.error('Error deleting block:', error)
      toast.error('Erro ao remover bloqueio')
    }
  }

  const handleDeleteBlock = async (block: ScheduleBlock) => {
    // Bloco criado para todas as agendas: o dono escolhe o alcance da remoção.
    if (block.groupId && (block.groupSize ?? 1) > 1) {
      setDeleteTarget(block)
      return
    }

    const confirmed = await confirm({
      title: 'Remover Bloqueio',
      description: 'Deseja realmente remover este bloqueio?',
      variant: 'destructive',
      confirmText: 'Remover'
    })

    if (!confirmed) return
    await deleteBlock(block, false)
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

                <div className="space-y-2">
                  <Label>Aplicar a</Label>
                  <RadioGroup value={scope} onValueChange={(v) => setScope(v as 'single' | 'all')}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="single" id="scope-single" />
                      <Label htmlFor="scope-single" className="cursor-pointer font-normal">
                        Somente esta agenda
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="scope-all" />
                      <Label htmlFor="scope-all" className="cursor-pointer font-normal">
                        Todas as agendas{totalSchedules > 0 ? ` (${totalSchedules})` : ''}
                      </Label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    Ninguém poderá agendar nestas datas (painel, página pública e chat).
                    Agendamentos já marcados são mantidos.
                  </p>
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
                      {block.groupId && (block.groupSize ?? 1) > 1 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <Layers className="h-3 w-3" />
                          Todas as agendas
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBlock(block)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Já existem agendamentos no período: confirmar antes de bloquear */}
      <Dialog open={conflict !== null} onOpenChange={(open) => !open && setConflict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Já existem agendamentos neste período
            </DialogTitle>
            <DialogDescription>
              Há {conflict?.conflictingAppointments} agendamento
              {conflict?.conflictingAppointments === 1 ? '' : 's'} marcado
              {conflict?.conflictingAppointments === 1 ? '' : 's'} nas datas escolhidas.
              Os agendamentos existentes serão mantidos; o bloqueio vale apenas para novos agendamentos.
            </DialogDescription>
          </DialogHeader>

          {conflict && conflict.sample.length > 0 && (
            <ul className="space-y-1 rounded-md border p-3 text-sm">
              {conflict.sample.map((item, index) => (
                <li key={index} className="flex justify-between gap-3">
                  <span className="truncate">{item.clientName} — {item.serviceName}</span>
                  <span className="shrink-0 text-muted-foreground">{formatDateTime(item.date)}</span>
                </li>
              ))}
              {conflict.conflictingAppointments > conflict.sample.length && (
                <li className="text-xs text-muted-foreground">
                  e mais {conflict.conflictingAppointments - conflict.sample.length}…
                </li>
              )}
            </ul>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConflict(null)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={() => submitBlock(true)} disabled={loading}>
              {loading ? 'Criando...' : 'Bloquear mesmo assim'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remover bloqueio de grupo: escolher o alcance */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Bloqueio</DialogTitle>
            <DialogDescription>
              Este bloqueio foi criado para {deleteTarget?.groupSize} agendas. Deseja remover apenas
              desta agenda ou de todas?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const target = deleteTarget
                setDeleteTarget(null)
                if (target) await deleteBlock(target, false)
              }}
            >
              Só desta agenda
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const target = deleteTarget
                setDeleteTarget(null)
                if (target) await deleteBlock(target, true)
              }}
            >
              Todas as agendas
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
