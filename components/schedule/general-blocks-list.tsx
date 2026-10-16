'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, Lock, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDialog } from '@/components/providers/dialog-provider'
import { formatBlockPeriod, type BlockPeriod } from './format-block-period'

export interface GeneralBlock extends BlockPeriod {
  groupId: string
  isAllDay: boolean
  reason: string | null
  isPast: boolean
  professional: { id: string; name: string } | null
  canManage: boolean
  schedules: { id: string; name: string }[]
  missingSchedules: { id: string; name: string }[]
}

interface GeneralBlocksListProps {
  /** Muda para recarregar (ex.: depois de criar um bloqueio). */
  refreshKey?: number
  emptyText?: string
}

const MAX_NAMES = 3

function summarizeNames(names: string[]): string {
  if (names.length <= MAX_NAMES) return names.join(', ')
  return `${names.slice(0, MAX_NAMES).join(', ')} e mais ${names.length - MAX_NAMES}`
}

/**
 * Bloqueios de várias agendas e pessoais de profissionais, um cartão por grupo.
 * Administrador gerencia todos; profissional só os próprios (`canManage`) — os da
 * agenda inteira aparecem só para explicar por que o dia está fechado.
 */
export function GeneralBlocksList({ refreshKey = 0, emptyText = 'Nenhum bloqueio ativo' }: GeneralBlocksListProps) {
  const { confirm } = useDialog()
  const [groups, setGroups] = useState<GeneralBlock[] | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/schedule-blocks')
      if (!response.ok) throw new Error('Erro ao buscar bloqueios')
      const data = await response.json()
      setGroups(Array.isArray(data.groups) ? data.groups : [])
    } catch (error) {
      console.error('Error fetching general blocks:', error)
      setGroups([])
      toast.error('Erro ao carregar bloqueios')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const upcoming = useMemo(() => (groups ?? []).filter((g) => !g.isPast), [groups])
  const pastCount = (groups?.length ?? 0) - upcoming.length
  const visible = showPast ? groups ?? [] : upcoming

  const handleDelete = async (group: GeneralBlock) => {
    const count = group.schedules.length
    const confirmed = await confirm({
      title: count > 1 ? 'Remover bloqueio de todas as agendas' : 'Remover bloqueio',
      description:
        count > 1
          ? `O bloqueio de ${formatBlockPeriod(group)} será removido das ${count} agendas. Os dias voltam a ficar disponíveis (a menos que outro bloqueio os cubra).`
          : `O bloqueio de ${formatBlockPeriod(group)} será removido. Os dias voltam a ficar disponíveis (a menos que outro bloqueio os cubra).`,
      variant: 'destructive',
      confirmText: count > 1 ? 'Remover de todas' : 'Remover',
    })
    if (!confirmed) return

    setBusyId(group.groupId)
    try {
      const response = await fetch(`/api/schedule-blocks/${group.groupId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Erro ao remover bloqueio')
      toast.success(count > 1 ? 'Bloqueio removido de todas as agendas!' : 'Bloqueio removido com sucesso!')
    } catch (error) {
      console.error('Error deleting general block:', error)
      toast.error('Erro ao remover bloqueio')
    } finally {
      setBusyId(null)
      await load()
    }
  }

  const handleExtend = async (group: GeneralBlock) => {
    setBusyId(group.groupId)
    try {
      const response = await fetch(`/api/schedule-blocks/${group.groupId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleIds: group.missingSchedules.map((s) => s.id) }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Erro ao aplicar bloqueio')
      toast.success(`Bloqueio aplicado a mais ${data.schedulesCount ?? group.missingSchedules.length} agenda(s)!`)
    } catch (error) {
      console.error('Error extending general block:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao aplicar bloqueio')
    } finally {
      setBusyId(null)
      await load()
    }
  }

  return (
    <div className="space-y-3">
      {groups === null ? (
        <>
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </>
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        visible.map((group) => (
          <div key={group.groupId} className={`rounded-lg border p-4 ${group.isPast ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="font-medium">{formatBlockPeriod(group)}</span>
                </div>
                {group.reason && <p className="ml-6 text-sm text-gray-600">{group.reason}</p>}
                <div className="ml-6 flex flex-wrap items-center gap-1.5">
                  {group.professional ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                      <User className="h-3 w-3" />
                      Só {group.professional.name}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Agenda inteira
                    </span>
                  )}
                  {!group.canManage && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      <Lock className="h-3 w-3" />
                      Definido pelo administrador
                    </span>
                  )}
                  {group.isPast && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Encerrado
                    </span>
                  )}
                </div>
                <p className="ml-6 text-xs text-muted-foreground">
                  {group.schedules.length === 1 ? 'Agenda' : `${group.schedules.length} agendas`}:{' '}
                  {summarizeNames(group.schedules.map((s) => s.name))}
                </p>
                {group.canManage && group.missingSchedules.length > 0 && (
                  <div className="ml-6 flex flex-wrap items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                    <span>
                      Não inclui {group.missingSchedules.length}{' '}
                      {group.missingSchedules.length === 1 ? 'agenda' : 'agendas'}:{' '}
                      {summarizeNames(group.missingSchedules.map((s) => s.name))}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      disabled={busyId === group.groupId}
                      onClick={() => handleExtend(group)}
                    >
                      Aplicar também
                    </Button>
                  </div>
                )}
              </div>
              {group.canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === group.groupId}
                  onClick={() => handleDelete(group)}
                  aria-label="Remover bloqueio"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          </div>
        ))
      )}

      {pastCount > 0 && (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowPast((v) => !v)}>
          {showPast ? 'Ocultar bloqueios encerrados' : `Mostrar bloqueios encerrados (${pastCount})`}
        </Button>
      )}
    </div>
  )
}

export default GeneralBlocksList
