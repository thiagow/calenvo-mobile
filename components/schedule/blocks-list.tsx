'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Calendar, Lock, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDialog } from '@/components/providers/dialog-provider'
import { agendaLink } from '@/lib/dashboard-links'
import { cn } from '@/lib/utils'
import { formatBlockPeriod, type BlockPeriod } from './format-block-period'

export interface ListedBlock extends BlockPeriod {
  key: string
  groupId: string | null
  blockId: string
  isAllDay: boolean
  reason: string | null
  isPast: boolean
  professional: { id: string; name: string } | null
  canManage: boolean
  schedules: { id: string; name: string }[]
  missingSchedules: { id: string; name: string }[]
  affectedAppointments: number | null
}

interface BlocksListProps {
  /** Muda para recarregar (ex.: depois de criar um bloqueio). */
  refreshKey?: number
  /** Agenda já filtrada ao abrir (vem do link "Ver bloqueios" da agenda). */
  initialScheduleId?: string
  /** Administrador filtra também por profissional. */
  showProfessionalFilter?: boolean
}

type Status = 'active' | 'ended'

// Os mesmos status que o bloqueio avisa na criação: agendamentos que ainda vão acontecer.
const OPEN_STATUSES = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] as const

const ALL = 'all'
const WIDE = 'wide'
const MAX_NAMES = 3

function summarizeNames(names: string[]): string {
  if (names.length <= MAX_NAMES) return names.join(', ')
  return `${names.slice(0, MAX_NAMES).join(', ')} e mais ${names.length - MAX_NAMES}`
}

/**
 * Todos os bloqueios, um cartão por bloqueio — de uma agenda, de várias e pessoais
 * de profissional. Administrador gerencia todos; profissional só os próprios
 * (`canManage`) — os da agenda inteira aparecem só para explicar por que o dia está fechado.
 */
export function BlocksList({ refreshKey = 0, initialScheduleId, showProfessionalFilter = false }: BlocksListProps) {
  const { confirm } = useDialog()
  const [blocks, setBlocks] = useState<ListedBlock[] | null>(null)
  const [allSchedules, setAllSchedules] = useState<{ id: string; name: string }[]>([])
  const [status, setStatus] = useState<Status>('active')
  const [scheduleFilter, setScheduleFilter] = useState(initialScheduleId || ALL)
  const [scopeFilter, setScopeFilter] = useState(ALL)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  useEffect(() => {
    if (initialScheduleId) setScheduleFilter(initialScheduleId)
  }, [initialScheduleId])

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/schedule-blocks')
      if (!response.ok) throw new Error('Erro ao buscar bloqueios')
      const data = await response.json()
      setBlocks(Array.isArray(data.blocks) ? data.blocks : [])
    } catch (error) {
      console.error('Error fetching blocks:', error)
      setBlocks([])
      toast.error('Erro ao carregar bloqueios')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  // Opções do filtro de agenda: todas as agendas, mesmo as sem bloqueio (a lista vazia diz "nenhum bloqueio nesta agenda").
  useEffect(() => {
    fetch('/api/schedules?includeInactive=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { id: string; name: string }[]) =>
        setAllSchedules(Array.isArray(list) ? list.map((s) => ({ id: s.id, name: s.name })) : [])
      )
      .catch(() => setAllSchedules([]))
  }, [])

  const professionals = useMemo(() => {
    const byId = new Map<string, string>()
    for (const block of blocks ?? []) if (block.professional) byId.set(block.professional.id, block.professional.name)
    return Array.from(byId, ([id, name]) => ({ id, name }))
  }, [blocks])

  const filtered = useMemo(
    () =>
      (blocks ?? []).filter((block) => {
        if (scheduleFilter !== ALL && !block.schedules.some((s) => s.id === scheduleFilter)) return false
        if (scopeFilter === WIDE && block.professional) return false
        if (scopeFilter !== ALL && scopeFilter !== WIDE && block.professional?.id !== scopeFilter) return false
        return true
      }),
    [blocks, scheduleFilter, scopeFilter]
  )

  const activeCount = filtered.filter((b) => !b.isPast).length
  const endedCount = filtered.length - activeCount
  const visible = filtered.filter((b) => (status === 'active' ? !b.isPast : b.isPast))

  const handleDelete = async (block: ListedBlock) => {
    const count = block.schedules.length
    const confirmed = await confirm({
      title: count > 1 ? 'Remover bloqueio de todas as agendas' : 'Remover bloqueio',
      description:
        count > 1
          ? `O bloqueio de ${formatBlockPeriod(block)} será removido das ${count} agendas. Os dias voltam a ficar disponíveis (a menos que outro bloqueio os cubra).`
          : `O bloqueio de ${formatBlockPeriod(block)} será removido. Os dias voltam a ficar disponíveis (a menos que outro bloqueio os cubra).`,
      variant: 'destructive',
      confirmText: count > 1 ? 'Remover de todas' : 'Remover',
    })
    if (!confirmed) return

    setBusyKey(block.key)
    try {
      // Bloqueio sem grupo é um bloco só: remove-se pela agenda a que pertence.
      const url = block.groupId
        ? `/api/schedule-blocks/${block.groupId}`
        : `/api/schedules/${block.schedules[0].id}/blocks/${block.blockId}`
      const response = await fetch(url, { method: 'DELETE' })
      if (!response.ok) throw new Error('Erro ao remover bloqueio')
      toast.success(count > 1 ? 'Bloqueio removido de todas as agendas!' : 'Bloqueio removido com sucesso!')
    } catch (error) {
      console.error('Error deleting block:', error)
      toast.error('Erro ao remover bloqueio')
    } finally {
      setBusyKey(null)
      await load()
    }
  }

  const handleExtend = async (block: ListedBlock) => {
    if (!block.groupId) return
    setBusyKey(block.key)
    try {
      const response = await fetch(`/api/schedule-blocks/${block.groupId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleIds: block.missingSchedules.map((s) => s.id) }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Erro ao aplicar bloqueio')
      toast.success(`Bloqueio aplicado a mais ${data.schedulesCount ?? block.missingSchedules.length} agenda(s)!`)
    } catch (error) {
      console.error('Error extending block:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao aplicar bloqueio')
    } finally {
      setBusyKey(null)
      await load()
    }
  }

  const scheduleOptions = allSchedules.length > 0 ? allSchedules : Array.from(
    new Map((blocks ?? []).flatMap((b) => b.schedules).map((s) => [s.id, s])).values()
  )
  const showScopeFilter = showProfessionalFilter && professionals.length > 0
  const filtering = scheduleFilter !== ALL || scopeFilter !== ALL
  const emptyText = filtering
    ? 'Nenhum bloqueio com esses filtros'
    : status === 'active'
      ? 'Nenhum bloqueio ativo'
      : 'Nenhum bloqueio encerrado'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Situação do bloqueio">
          {(
            [
              ['active', `Ativos (${activeCount})`],
              ['ended', `Encerrados (${endedCount})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              aria-pressed={status === value}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                status === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {scheduleOptions.length > 1 && (
          <Select value={scheduleFilter} onValueChange={setScheduleFilter}>
            <SelectTrigger className="h-9 w-auto min-w-[9rem] text-xs" aria-label="Filtrar por agenda">
              <SelectValue placeholder="Agenda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as agendas</SelectItem>
              {scheduleOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {showScopeFilter && (
          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="h-9 w-auto min-w-[9rem] text-xs" aria-label="Filtrar por profissional">
              <SelectValue placeholder="Quem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              <SelectItem value={WIDE}>Agenda inteira</SelectItem>
              {professionals.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  Só {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {blocks === null ? (
        <>
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </>
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        visible.map((block) => (
          <div key={block.key} className={cn('rounded-lg border p-4', block.isPast && 'opacity-60')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{formatBlockPeriod(block)}</span>
                </div>
                {block.reason && <p className="ml-6 text-sm text-muted-foreground">{block.reason}</p>}
                <div className="ml-6 flex flex-wrap items-center gap-1.5">
                  {block.professional ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                      <User className="h-3 w-3" />
                      Só {block.professional.name}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Agenda inteira
                    </span>
                  )}
                  {!block.canManage && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      Definido pelo administrador
                    </span>
                  )}
                  {block.isPast && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Encerrado
                    </span>
                  )}
                </div>
                <p className="ml-6 text-xs text-muted-foreground">
                  {block.schedules.length === 1 ? 'Agenda' : `${block.schedules.length} agendas`}:{' '}
                  {summarizeNames(block.schedules.map((s) => s.name))}
                </p>
                {block.affectedAppointments !== null && block.affectedAppointments > 0 && (
                  <p className="ml-6 flex flex-wrap items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {block.affectedAppointments}{' '}
                      {block.affectedAppointments === 1 ? 'agendamento marcado' : 'agendamentos marcados'} neste período
                    </span>
                    <Link
                      href={agendaLink({
                        view: block.firstDay === block.lastDay ? 'day' : 'week',
                        date: block.firstDay,
                        status: OPEN_STATUSES,
                      })}
                      className="font-medium underline underline-offset-2"
                    >
                      Ver na agenda
                    </Link>
                  </p>
                )}
                {block.canManage && block.missingSchedules.length > 0 && (
                  <div className="ml-6 flex flex-wrap items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                    <span>
                      Não inclui {block.missingSchedules.length}{' '}
                      {block.missingSchedules.length === 1 ? 'agenda' : 'agendas'}:{' '}
                      {summarizeNames(block.missingSchedules.map((s) => s.name))}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      disabled={busyKey === block.key}
                      onClick={() => handleExtend(block)}
                    >
                      Aplicar também
                    </Button>
                  </div>
                )}
              </div>
              {block.canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyKey === block.key}
                  onClick={() => handleDelete(block)}
                  aria-label="Remover bloqueio"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default BlocksList
