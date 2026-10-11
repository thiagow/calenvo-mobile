'use client'

import { useState, useMemo } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Filter, AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import toast from 'react-hot-toast'
import { useDialog } from '@/components/providers/dialog-provider'

import { AgendaViewSelector, ViewType } from '@/components/agenda/agenda-view-selector'
import {
  ActiveFilterChips,
  AgendaFiltersComponent,
  AgendaFilters,
  countActiveFilters,
  useAgendaFilterOptions,
} from '@/components/agenda/agenda-filters'
import { DateNavigation, NavigationType } from '@/components/agenda/date-navigation'
import { AgendaDayView } from '@/components/agenda/agenda-day-view'
import { AgendaWeekView } from '@/components/agenda/agenda-week-view'
import { AgendaMonthView } from '@/components/agenda/agenda-month-view'
import { AgendaListView } from '@/components/agenda/agenda-list-view'
import { AgendaTimelineView } from '@/components/agenda/agenda-timeline-view'
import { EditAppointmentDialog } from '@/components/agenda/edit-appointment-dialog'
import { useAppointments } from '@/hooks/use-appointments'

export default function AgendaPage() {
  const { data: session, status } = useSession() || {}
  const { confirm } = useDialog()

  const [currentView, setCurrentView] = useState<ViewType>('day')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [filters, setFilters] = useState<AgendaFilters>({})
  const [showFilters, setShowFilters] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<any>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const filterOptions = useAgendaFilterOptions()

  const isRangeView = currentView === 'list' || currentView === 'timeline'

  const { appointments, loading, error, updateAppointment, deleteAppointment, refetch } = useAppointments({
    search: filters.search,
    status: filters.status,
    service: filters.service,
    professional: filters.professional,
    // Período só vale em Lista e Linha de Tempo (sempre de hoje em diante).
    dateFrom: isRangeView ? filters.dateFrom : undefined,
    dateTo: isRangeView ? filters.dateTo : undefined,
    view: currentView,
    // Dia de calendário (não instante): o servidor monta as janelas no fuso do negócio.
    currentDate: format(currentDate, 'yyyy-MM-dd'),
    autoFetch: !!session,
  })

  const viewFilteredAppointments = useMemo(() => {
    if (currentView === 'list' || currentView === 'timeline') return appointments
    switch (currentView) {
      case 'day':
        return appointments.filter(apt => new Date(apt.date).toDateString() === currentDate.toDateString())
      case 'week': {
        const start = new Date(currentDate)
        const d = start.getDay()
        start.setDate(start.getDate() - d + (d === 0 ? -6 : 1))
        start.setHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setDate(start.getDate() + 6)
        end.setHours(23, 59, 59, 999)
        return appointments.filter(apt => { const ad = new Date(apt.date); return ad >= start && ad <= end })
      }
      case 'month':
        return appointments.filter(apt => {
          const ad = new Date(apt.date)
          return ad.getMonth() === currentDate.getMonth() && ad.getFullYear() === currentDate.getFullYear()
        })
      default:
        return appointments
    }
  }, [appointments, currentView, currentDate])

  const handleEditAppointment = (id: string) => {
    const apt = appointments.find(a => a.id === id)
    if (apt) { setEditingAppointment(apt); setShowEditDialog(true) }
  }

  const handleUpdateAppointment = async (id: string, data: any) => {
    await updateAppointment(id, data)
    setShowEditDialog(false)
    setEditingAppointment(null)
    await refetch()
  }

  const handleDeleteAppointment = async (id: string) => {
    const confirmed = await confirm({
      title: 'Excluir Agendamento',
      description: 'O agendamento será removido da agenda e dos relatórios. Esta ação não pode ser desfeita pela interface.',
      variant: 'destructive',
      confirmText: 'Excluir',
    })
    if (!confirmed) return false
    try {
      await deleteAppointment(id)
      toast.success('Agendamento excluído!')
      return true
    } catch {
      toast.error('Erro ao excluir agendamento')
      return false
    }
  }

  const getNavigationType = (view: ViewType): NavigationType => {
    if (view === 'day') return 'day'
    if (view === 'week') return 'week'
    if (view === 'month') return 'month'
    return 'week'
  }

  // Fora de Lista/Linha de Tempo o período fica guardado, mas não conta nem aparece.
  const visibleFilters: AgendaFilters = isRangeView ? filters : { ...filters, dateFrom: undefined, dateTo: undefined }
  const activeFiltersCount = countActiveFilters(visibleFilters)
  const handleChipsChange = (next: AgendaFilters) =>
    setFilters(isRangeView ? next : { ...next, dateFrom: filters.dateFrom, dateTo: filters.dateTo })

  if (status === 'loading') return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>
  if (!session) { redirect('/login'); return null }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Toolbar compacta para mobile — navegação de data e seleção de vista em linhas separadas para não espremer */}
      <div className="space-y-2">
        {isRangeView ? (
          <div className="flex min-h-10 items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              {currentView === 'list' ? 'Lista' : 'Linha de Tempo'} · a partir de hoje
            </h2>
            <p className="text-xs text-gray-600">
              {viewFilteredAppointments.length} agendamento{viewFilteredAppointments.length !== 1 ? 's' : ''}
            </p>
          </div>
        ) : (
          <DateNavigation
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            navigationType={getNavigationType(currentView)}
            appointmentCount={viewFilteredAppointments.length}
          />
        )}
        <div className="flex items-center justify-between gap-2">
          <AgendaViewSelector currentView={currentView} onViewChange={setCurrentView} />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className="relative h-9 w-9 flex-shrink-0"
          >
            <Filter className="h-4 w-4" />
            {activeFiltersCount > 0 && (
              <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <ActiveFilterChips
        filters={visibleFilters}
        onFiltersChange={handleChipsChange}
        options={filterOptions}
      />
      <AgendaFiltersComponent
        filters={filters}
        onFiltersChange={setFilters}
        isOpen={showFilters}
        onToggle={() => setShowFilters(!showFilters)}
        options={filterOptions}
        showPeriod={isRangeView}
      />

      {/* View */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {currentView === 'day' && <AgendaDayView date={currentDate} appointments={viewFilteredAppointments} onEditAppointment={handleEditAppointment} onDeleteAppointment={handleDeleteAppointment} />}
          {currentView === 'week' && <AgendaWeekView date={currentDate} appointments={viewFilteredAppointments} onEditAppointment={handleEditAppointment} onDeleteAppointment={handleDeleteAppointment} />}
          {currentView === 'month' && <AgendaMonthView date={currentDate} appointments={viewFilteredAppointments} onDayClick={(d) => { setCurrentDate(d); setCurrentView('day') }} onAppointmentClick={(apt) => { setEditingAppointment(apt); setShowEditDialog(true) }} />}
          {currentView === 'list' && <AgendaListView appointments={viewFilteredAppointments} onEditAppointment={handleEditAppointment} onDeleteAppointment={handleDeleteAppointment} />}
          {currentView === 'timeline' && <AgendaTimelineView appointments={viewFilteredAppointments} onEditAppointment={handleEditAppointment} onDeleteAppointment={handleDeleteAppointment} />}
        </>
      )}

      {/* FAB — Novo Agendamento */}
      <Link href="/dashboard/appointments/new" className="fixed bottom-20 right-4 z-40" style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 1rem)' }}>
        <Button size="icon" className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90">
          <Plus className="h-6 w-6" />
        </Button>
      </Link>

      {editingAppointment && (
        <EditAppointmentDialog
          isOpen={showEditDialog}
          onClose={() => { setShowEditDialog(false); setEditingAppointment(null) }}
          appointment={editingAppointment}
          onUpdate={handleUpdateAppointment}
          onDelete={async (id) => {
            const deleted = await handleDeleteAppointment(id)
            if (deleted) {
              setShowEditDialog(false)
              setEditingAppointment(null)
              await refetch()
            }
          }}
        />
      )}
    </div>
  )
}
