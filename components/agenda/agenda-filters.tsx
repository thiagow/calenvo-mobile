'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { Search, X } from 'lucide-react'
import { AppointmentStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface AgendaFilters {
  search?: string
  status?: AppointmentStatus[]
  /** id do serviço */
  service?: string
  /** id do profissional */
  professional?: string
  /** "YYYY-MM-DD" */
  dateFrom?: string
  dateTo?: string
}

interface Option {
  id: string
  name: string
}

export interface AgendaFilterOptions {
  services: Option[]
  professionals: Option[]
}

/** Serviços e profissionais para os seletores e para os nomes dos chips. */
export function useAgendaFilterOptions(): AgendaFilterOptions {
  const [services, setServices] = useState<Option[]>([])
  const [professionals, setProfessionals] = useState<Option[]>([])

  useEffect(() => {
    const load = async (url: string, set: (items: Option[]) => void) => {
      try {
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          if (Array.isArray(data)) set(data)
        }
      } catch (error) {
        console.error(`Error fetching ${url}:`, error)
      }
    }
    load('/api/services', setServices)
    load('/api/professionals', setProfessionals)
  }, [])

  return { services, professionals }
}

/** Quantos filtros o usuário escolheu (o "só futuro" padrão da lista não conta). */
export function countActiveFilters(filters: AgendaFilters): number {
  let count = 0
  if (filters.search) count++
  if (filters.status?.length) count++
  if (filters.service) count++
  if (filters.professional) count++
  if (filters.dateFrom || filters.dateTo) count++
  return count
}

const ymd = (date: Date) => format(date, 'yyyy-MM-dd')
const dm = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`

interface PeriodPreset {
  id: string
  label: string
  range: () => { dateFrom: string; dateTo: string }
}

const PERIOD_PRESETS: PeriodPreset[] = [
  { id: 'today', label: 'Hoje', range: () => ({ dateFrom: ymd(new Date()), dateTo: ymd(new Date()) }) },
  {
    id: 'tomorrow',
    label: 'Amanhã',
    range: () => ({ dateFrom: ymd(addDays(new Date(), 1)), dateTo: ymd(addDays(new Date(), 1)) }),
  },
  {
    id: 'week',
    label: 'Esta semana',
    range: () => ({
      dateFrom: ymd(startOfWeek(new Date(), { weekStartsOn: 1 })),
      dateTo: ymd(endOfWeek(new Date(), { weekStartsOn: 1 })),
    }),
  },
  {
    id: 'next7',
    label: 'Próximos 7 dias',
    range: () => ({ dateFrom: ymd(new Date()), dateTo: ymd(addDays(new Date(), 6)) }),
  },
  {
    id: 'month',
    label: 'Este mês',
    range: () => ({ dateFrom: ymd(startOfMonth(new Date())), dateTo: ymd(endOfMonth(new Date())) }),
  },
]

interface AgendaFiltersProps {
  filters: AgendaFilters
  onFiltersChange: (filters: AgendaFilters) => void
  isOpen: boolean
  onToggle: () => void
  options: AgendaFilterOptions
  /** O período só existe nas vistas Lista e Linha de Tempo (que mostram de hoje em diante). */
  showPeriod: boolean
}

/** Filtros da agenda num bottom sheet: campos grandes para o toque e "Aplicar" fixo no rodapé. */
export function AgendaFiltersComponent({ filters, onFiltersChange, isOpen, onToggle, options, showPeriod }: AgendaFiltersProps) {
  const [draft, setDraft] = useState<AgendaFilters>(filters)
  const [customPeriod, setCustomPeriod] = useState(false)

  // Cada abertura parte do que está aplicado de fato.
  useEffect(() => {
    if (!isOpen) return
    setDraft(filters)
    const matchesPreset = PERIOD_PRESETS.some((p) => {
      const r = p.range()
      return r.dateFrom === filters.dateFrom && r.dateTo === filters.dateTo
    })
    setCustomPeriod(Boolean((filters.dateFrom || filters.dateTo) && !matchesPreset))
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const activePreset = useMemo(
    () =>
      PERIOD_PRESETS.find((p) => {
        const r = p.range()
        return r.dateFrom === draft.dateFrom && r.dateTo === draft.dateTo
      })?.id,
    [draft.dateFrom, draft.dateTo]
  )

  const set = <K extends keyof AgendaFilters>(key: K, value: AgendaFilters[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const toggleStatus = (status: AppointmentStatus) => {
    const current = draft.status ?? []
    const next = current.includes(status) ? current.filter((s) => s !== status) : [...current, status]
    set('status', next.length > 0 ? next : undefined)
  }

  const pickPreset = (preset: PeriodPreset) => {
    if (activePreset === preset.id) {
      setDraft((d) => ({ ...d, dateFrom: undefined, dateTo: undefined }))
      return
    }
    setCustomPeriod(false)
    setDraft((d) => ({ ...d, ...preset.range() }))
  }

  const apply = () => {
    onFiltersChange({
      ...draft,
      search: draft.search?.trim() || undefined,
      // Fora da Lista/Linha de Tempo o período não aparece: mantém o já escolhido para quando voltar.
      ...(showPeriod ? {} : { dateFrom: filters.dateFrom, dateTo: filters.dateTo }),
    })
    onToggle()
  }

  const clearAll = () => {
    setCustomPeriod(false)
    setDraft({})
  }

  const draftCount = countActiveFilters(showPeriod ? draft : { ...draft, dateFrom: undefined, dateTo: undefined })
  const today = ymd(new Date())
  const chip = (selected: boolean) =>
    cn(
      'h-10 rounded-full border px-4 text-sm font-medium transition-colors',
      selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted'
    )

  return (
    <Sheet open={isOpen} onOpenChange={(open) => open !== isOpen && onToggle()}>
      <SheetContent
        side="bottom"
        className="flex max-h-[90dvh] flex-col gap-0 rounded-t-2xl p-0 sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription className="sr-only">Filtrar os agendamentos da agenda</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Busca */}
          <div className="space-y-2">
            <Label htmlFor="agenda-search">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="agenda-search"
                type="search"
                inputMode="search"
                placeholder="Cliente, serviço ou profissional"
                value={draft.search ?? ''}
                onChange={(e) => set('search', e.target.value || undefined)}
                className="h-11 pl-9 pr-10 text-base"
              />
              {draft.search && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => set('search', undefined)}
                  className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Período: só Lista e Linha de Tempo, que mostram de hoje em diante */}
          {showPeriod && (
          <div className="space-y-2">
            <Label>Período</Label>
            <div className="flex flex-wrap gap-2">
              {PERIOD_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={activePreset === preset.id}
                  onClick={() => pickPreset(preset)}
                  className={chip(activePreset === preset.id)}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={customPeriod}
                onClick={() => setCustomPeriod((v) => !v)}
                className={chip(customPeriod)}
              >
                Personalizado
              </button>
            </div>
            {customPeriod && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="agenda-from" className="text-xs text-muted-foreground">De</Label>
                  <Input
                    id="agenda-from"
                    type="date"
                    value={draft.dateFrom ?? ''}
                    min={today}
                    max={draft.dateTo || undefined}
                    onChange={(e) => set('dateFrom', e.target.value || undefined)}
                    className="h-11 text-base"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="agenda-to" className="text-xs text-muted-foreground">Até</Label>
                  <Input
                    id="agenda-to"
                    type="date"
                    value={draft.dateTo ?? ''}
                    min={draft.dateFrom && draft.dateFrom > today ? draft.dateFrom : today}
                    onChange={(e) => set('dateTo', e.target.value || undefined)}
                    className="h-11 text-base"
                  />
                </div>
              </div>
            )}
          </div>
          )}

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABELS) as AppointmentStatus[]).map((status) => {
                const selected = draft.status?.includes(status) ?? false
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleStatus(status)}
                    className={cn(
                      'h-10 rounded-full border px-4 text-sm font-medium transition-colors',
                      selected ? `${STATUS_COLORS[status]} border-current` : 'border-border bg-background hover:bg-muted'
                    )}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Serviço e profissional */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Serviço</Label>
              <Select
                value={draft.service ?? 'all'}
                onValueChange={(value) => set('service', value === 'all' ? undefined : value)}
              >
                <SelectTrigger className="h-11 text-base">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {options.services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Profissional</Label>
              <Select
                value={draft.professional ?? 'all'}
                onValueChange={(value) => set('professional', value === 'all' ? undefined : value)}
              >
                <SelectTrigger className="h-11 text-base">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {options.professionals.map((pro) => (
                    <SelectItem key={pro.id} value={pro.id}>
                      {pro.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div
          className="flex gap-3 border-t bg-background px-5 pt-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={clearAll} disabled={draftCount === 0}>
            Limpar
          </Button>
          <Button type="button" className="h-11 flex-[2]" onClick={apply}>
            Aplicar{draftCount > 0 ? ` (${draftCount})` : ''}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface ActiveFilterChipsProps {
  filters: AgendaFilters
  onFiltersChange: (filters: AgendaFilters) => void
  options: AgendaFilterOptions
}

/** Filtros aplicados como chips removíveis com um toque. */
export function ActiveFilterChips({ filters, onFiltersChange, options }: ActiveFilterChipsProps) {
  const chips: { key: string; label: string; remove: () => void }[] = []

  if (filters.search) {
    chips.push({ key: 'search', label: `“${filters.search}”`, remove: () => onFiltersChange({ ...filters, search: undefined }) })
  }
  if (filters.dateFrom || filters.dateTo) {
    const label =
      filters.dateFrom && filters.dateTo
        ? filters.dateFrom === filters.dateTo
          ? dm(filters.dateFrom)
          : `${dm(filters.dateFrom)} – ${dm(filters.dateTo)}`
        : filters.dateFrom
          ? `A partir de ${dm(filters.dateFrom)}`
          : `Até ${dm(filters.dateTo!)}`
    chips.push({
      key: 'period',
      label,
      remove: () => onFiltersChange({ ...filters, dateFrom: undefined, dateTo: undefined }),
    })
  }
  for (const status of filters.status ?? []) {
    chips.push({
      key: `status-${status}`,
      label: STATUS_LABELS[status],
      remove: () => {
        const next = (filters.status ?? []).filter((s) => s !== status)
        onFiltersChange({ ...filters, status: next.length > 0 ? next : undefined })
      },
    })
  }
  if (filters.service) {
    chips.push({
      key: 'service',
      label: options.services.find((s) => s.id === filters.service)?.name ?? 'Serviço',
      remove: () => onFiltersChange({ ...filters, service: undefined }),
    })
  }
  if (filters.professional) {
    chips.push({
      key: 'professional',
      label: options.professionals.find((p) => p.id === filters.professional)?.name ?? 'Profissional',
      remove: () => onFiltersChange({ ...filters, professional: undefined }),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" aria-label="Filtros aplicados">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.remove}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-muted px-3 text-xs font-medium"
          aria-label={`Remover filtro ${chip.label}`}
        >
          {chip.label}
          <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  )
}
