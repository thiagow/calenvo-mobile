
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Trash2, Calendar, AlertCircle, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { format, isSameMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useDialog } from '@/components/providers/dialog-provider'

interface ScheduleBlock {
  id: string
  reason?: string
  isAllDay: boolean
  groupId?: string | null
  groupSize?: number | null
  /** Dias de calendário "YYYY-MM-DD" e horários "HH:mm" já no fuso do negócio (vêm prontos da API). */
  firstDay: string
  lastDay: string
  startTime: string | null
  endTime: string | null
}

interface ScheduleBlocksProps {
  scheduleId: string
  scheduleName?: string
}

// "YYYY-MM-DD" sem horário é lido como meia-noite LOCAL — o dia nunca desloca com o fuso do navegador.
const formatDay = (day: string) => format(parseISO(day), "d 'de' MMMM 'de' yyyy", { locale: ptBR })

function formatBlockWhen(block: ScheduleBlock): string {
  try {
    if (!block.isAllDay) {
      return `${formatDay(block.firstDay)} · ${block.startTime}–${block.endTime}`
    }
    if (block.firstDay === block.lastDay) return formatDay(block.firstDay)

    const first = parseISO(block.firstDay)
    const last = parseISO(block.lastDay)
    return isSameMonth(first, last)
      ? `${format(first, 'd')} a ${formatDay(block.lastDay)}`
      : `${formatDay(block.firstDay)} a ${formatDay(block.lastDay)}`
  } catch {
    return `${block.firstDay} – ${block.lastDay}`
  }
}

export function ScheduleBlocks({ scheduleId, scheduleName }: ScheduleBlocksProps) {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([])
  const { confirm } = useDialog()
  const [deleteTarget, setDeleteTarget] = useState<ScheduleBlock | null>(null)

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
    // Bloco criado para várias agendas: o dono escolhe o alcance da remoção.
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Bloqueios de Períodos
        </CardTitle>
        <CardDescription>
          Dias e horários em que a agenda não estará disponível
          {scheduleName && ` para ${scheduleName}`}. Para criar um bloqueio, use o botão
          “Bloqueio de Períodos” na página de Agendas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {blocks.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              Nenhum bloqueio configurado ainda
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Crie bloqueios para férias, feriados ou outros eventos pela página de Agendas
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
                      <span className="font-medium">{formatBlockWhen(block)}</span>
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
                          {block.groupSize} agendas
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBlock(block)}
                    aria-label="Remover bloqueio"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

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
