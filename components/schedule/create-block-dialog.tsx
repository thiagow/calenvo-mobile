'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarOff, ChevronsUpDown } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export interface BlockableSchedule {
  id: string
  name: string
  color: string
  isActive: boolean
}

interface BlockConflictInfo {
  conflictingAppointments: number
  schedulesCount: number
  sample: { date: string; clientName: string; serviceName: string }[]
}

interface CreateBlockDialogProps {
  onCreated?: () => void
}

const EMPTY_FORM = { startDate: '', endDate: '', date: '', startTime: '', endTime: '', reason: '', isAllDay: true }

export function CreateBlockDialog({ onCreated }: CreateBlockDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  // Inclui agendas inativas: se uma for reativada depois, a data continua fechada.
  const [schedules, setSchedules] = useState<BlockableSchedule[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [conflict, setConflict] = useState<BlockConflictInfo | null>(null)

  const allSelected = schedules.length > 0 && selectedIds.length === schedules.length

  const pickerLabel = useMemo(() => {
    if (selectedIds.length === 0) return 'Selecione as agendas'
    if (allSelected) return `Todas as agendas (${schedules.length})`
    if (selectedIds.length === 1) return schedules.find((s) => s.id === selectedIds[0])?.name ?? '1 agenda'
    return `${selectedIds.length} agendas`
  }, [selectedIds, allSelected, schedules])

  const toggleAll = () => setSelectedIds(allSelected ? [] : schedules.map((s) => s.id))
  const toggleOne = (id: string) =>
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setForm(EMPTY_FORM)
      setSelectedIds([])
      setConflict(null)
      fetch('/api/schedules?includeInactive=true')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setSchedules(Array.isArray(data) ? data : []))
        .catch(() => toast.error('Erro ao carregar agendas'))
    }
  }

  const validate = (): string | null => {
    if (selectedIds.length === 0) return 'Selecione ao menos uma agenda'
    if (form.isAllDay) {
      if (!form.startDate) return 'Informe a data de início'
      if (form.endDate && form.endDate < form.startDate) return 'A data de término não pode ser anterior à de início'
      return null
    }
    if (!form.date) return 'Informe a data'
    if (!form.startTime || !form.endTime) return 'Informe o horário inicial e final'
    if (form.endTime <= form.startTime) return 'O horário final deve ser posterior ao inicial'
    return null
  }

  const submit = async (confirmConflicts: boolean) => {
    setLoading(true)
    try {
      const period = form.isAllDay
        ? { isAllDay: true, startDate: form.startDate, endDate: form.endDate || form.startDate }
        : { isAllDay: false, date: form.date, startTime: form.startTime, endTime: form.endTime }

      const response = await fetch('/api/schedule-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...period, reason: form.reason, scheduleIds: selectedIds, confirmConflicts }),
      })
      const data = await response.json().catch(() => ({}))

      // Já existem agendamentos no período: nada foi criado ainda. Pede
      // confirmação ao dono antes de concluir (os existentes serão mantidos).
      if (response.status === 409 && data.code === 'BLOCK_HAS_APPOINTMENTS') {
        setConflict(data as BlockConflictInfo)
        return
      }
      if (!response.ok) throw new Error(data.error || 'Erro ao criar bloqueio')

      const count = data.schedulesCount ?? selectedIds.length
      toast.success(count > 1 ? `Bloqueio criado em ${count} agendas!` : 'Bloqueio criado com sucesso!')
      setConflict(null)
      setOpen(false)
      onCreated?.()
    } catch (error) {
      console.error('Error creating block:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar bloqueio')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    const problem = validate()
    if (problem) {
      toast.error(problem)
      return
    }
    await submit(false)
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => handleOpenChange(true)}>
        <CalendarOff className="h-4 w-4 mr-1.5" />
        Bloqueio de Períodos
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Bloqueio</DialogTitle>
            <DialogDescription>
              Bloqueie um dia, um período ou uma faixa de horário em que não haverá atendimento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Agendas */}
            <div className="space-y-2">
              <Label>Aplicar a</Label>
              {/* modal: o popover sai do Dialog (portal) e o bloqueio de rolagem do Dialog travava a lista; modal libera a rolagem dentro dele */}
              <Popover open={pickerOpen} onOpenChange={setPickerOpen} modal>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={pickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className={cn('truncate', selectedIds.length === 0 && 'text-muted-foreground')}>
                      {pickerLabel}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                  collisionPadding={12}
                >
                  <Command>
                    <CommandList className="max-h-[min(18rem,var(--radix-popover-content-available-height))] overscroll-contain">
                      <CommandEmpty>Nenhuma agenda</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="todas-as-agendas" onSelect={toggleAll}>
                          <Checkbox checked={allSelected} className="mr-2 pointer-events-none" />
                          <span className="font-medium">Todas as agendas ({schedules.length})</span>
                        </CommandItem>
                      </CommandGroup>
                      <CommandSeparator />
                      <CommandGroup>
                        {schedules.map((schedule) => (
                          <CommandItem
                            key={schedule.id}
                            value={`${schedule.name}-${schedule.id}`}
                            onSelect={() => toggleOne(schedule.id)}
                          >
                            <Checkbox
                              checked={selectedIds.includes(schedule.id)}
                              className="mr-2 pointer-events-none"
                            />
                            <span
                              className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: schedule.color }}
                            />
                            <span className="truncate">{schedule.name}</span>
                            {!schedule.isActive && (
                              <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                                Inativa
                              </Badge>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Ninguém poderá agendar nestas datas (painel, página pública e chat). Agendamentos já marcados são
                mantidos.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="block-all-day"
                checked={form.isAllDay}
                onCheckedChange={(checked) => setForm({ ...form, isAllDay: checked })}
              />
              <Label htmlFor="block-all-day" className="cursor-pointer">
                Dia inteiro
              </Label>
            </div>

            {form.isAllDay ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="block-start">Data de início *</Label>
                  <Input
                    id="block-start"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="block-end">Data de término</Label>
                  <Input
                    id="block-end"
                    type="date"
                    min={form.startDate || undefined}
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
                <p className="sm:col-span-2 -mt-1 text-xs text-muted-foreground">
                  Deixe o término em branco para bloquear apenas um dia.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="block-date">Data *</Label>
                  <Input
                    id="block-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="block-from">Das *</Label>
                  <Input
                    id="block-from"
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="block-to">Até *</Label>
                  <Input
                    id="block-to"
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="block-reason">Motivo (opcional)</Label>
              <Textarea
                id="block-reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Ex: Férias, Feriado, Congresso..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading ? 'Criando...' : 'Criar Bloqueio'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Já existem agendamentos no período: confirmar antes de bloquear */}
      <Dialog open={conflict !== null} onOpenChange={(next) => !next && setConflict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Já existem agendamentos neste período
            </DialogTitle>
            <DialogDescription>
              Há {conflict?.conflictingAppointments} agendamento
              {conflict?.conflictingAppointments === 1 ? '' : 's'} marcado
              {conflict?.conflictingAppointments === 1 ? '' : 's'} no período escolhido. Os agendamentos existentes
              serão mantidos; o bloqueio vale apenas para novos agendamentos.
            </DialogDescription>
          </DialogHeader>

          {conflict && conflict.sample.length > 0 && (
            <ul className="space-y-1 rounded-md border p-3 text-sm">
              {conflict.sample.map((item, index) => (
                <li key={index} className="flex justify-between gap-3">
                  <span className="truncate">
                    {item.clientName} — {item.serviceName}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {format(new Date(item.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
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
            <Button onClick={() => submit(true)} disabled={loading}>
              {loading ? 'Criando...' : 'Bloquear mesmo assim'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default CreateBlockDialog
