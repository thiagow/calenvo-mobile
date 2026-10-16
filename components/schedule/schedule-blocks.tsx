'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, Calendar, AlertCircle, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { useDialog } from '@/components/providers/dialog-provider'
import { formatBlockPeriod, type BlockPeriod } from './format-block-period'

interface ScheduleBlock extends BlockPeriod {
  id: string
  reason?: string | null
  isAllDay: boolean
  isPast: boolean
  canManage: boolean
}

interface ScheduleBlocksProps {
  scheduleId: string
  scheduleName?: string
}

export function ScheduleBlocks({ scheduleId, scheduleName }: ScheduleBlocksProps) {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([])
  const [generalBlocksCount, setGeneralBlocksCount] = useState(0)
  const [showPast, setShowPast] = useState(false)
  const { confirm } = useDialog()

  useEffect(() => {
    fetchBlocks()
  }, [scheduleId])

  const fetchBlocks = async () => {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/blocks`)
      if (!response.ok) throw new Error('Erro ao buscar bloqueios')

      const data = await response.json()
      setBlocks(Array.isArray(data.blocks) ? data.blocks : [])
      setGeneralBlocksCount(data.generalBlocksCount ?? 0)
    } catch (error) {
      console.error('Error fetching blocks:', error)
      toast.error('Erro ao carregar bloqueios')
    }
  }

  const handleDeleteBlock = async (block: ScheduleBlock) => {
    const confirmed = await confirm({
      title: 'Remover Bloqueio',
      description: 'Deseja realmente remover este bloqueio? Os dias voltam a ficar disponíveis nesta agenda.',
      variant: 'destructive',
      confirmText: 'Remover'
    })
    if (!confirmed) return

    try {
      const response = await fetch(`/api/schedules/${scheduleId}/blocks/${block.id}`, { method: 'DELETE' })
      // 404 = já não existe (removido em outra aba/aparelho): o objetivo está cumprido, só falta atualizar a tela.
      if (!response.ok && response.status !== 404) throw new Error('Erro ao remover bloqueio')
      toast.success('Bloqueio removido com sucesso!')
    } catch (error) {
      console.error('Error deleting block:', error)
      toast.error('Erro ao remover bloqueio')
    } finally {
      // Sempre recarrega: a lista nunca fica com item fantasma.
      await fetchBlocks()
    }
  }

  const upcoming = useMemo(() => blocks.filter((b) => !b.isPast), [blocks])
  const past = useMemo(() => blocks.filter((b) => b.isPast), [blocks])
  const visible = showPast ? blocks : upcoming

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Bloqueios de Períodos
        </CardTitle>
        <CardDescription>
          Dias e horários em que {scheduleName ? `a agenda ${scheduleName}` : 'esta agenda'} não estará disponível.
          O último dia do período também fica bloqueado. Para criar, use o botão “Bloqueio de Períodos” na página de
          Agendas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {generalBlocksCount > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
            <Layers className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {generalBlocksCount === 1
                ? '1 bloqueio geral ou de profissional também afeta esta agenda.'
                : `${generalBlocksCount} bloqueios gerais ou de profissionais também afetam esta agenda.`}{' '}
              Eles são criados para várias agendas (ou para um profissional) e ficam em{' '}
              <Link href="/dashboard/schedules?bloqueios=gerais" className="font-medium underline underline-offset-2">
                Agendas → Bloqueios gerais
              </Link>
              .
            </p>
          </div>
        )}

        {visible.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Nenhum bloqueio específico desta agenda</p>
            <p className="text-xs text-gray-400 mt-1">
              Crie bloqueios para férias, feriados ou outros eventos pela página de Agendas
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((block) => (
              <div
                key={block.id}
                className={`border rounded-lg p-4 hover:border-blue-300 transition-colors ${block.isPast ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{formatBlockPeriod(block)}</span>
                    </div>
                    {block.reason && <p className="text-sm text-gray-600 ml-6">{block.reason}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-2 ml-6">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        {block.isAllDay ? 'Dia Inteiro' : 'Horário Específico'}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        Só esta agenda
                      </span>
                      {block.isPast && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Encerrado
                        </span>
                      )}
                    </div>
                  </div>
                  {block.canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteBlock(block)}
                      aria-label="Remover bloqueio"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {past.length > 0 && (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowPast((v) => !v)}>
            {showPast ? 'Ocultar bloqueios encerrados' : `Mostrar bloqueios encerrados (${past.length})`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
