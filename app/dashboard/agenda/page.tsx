
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Plus,
  Filter,
  Eye,
  Calendar,
  Loader2,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import toast from 'react-hot-toast'
import { useDialog } from '@/components/providers/dialog-provider'

// Components
import { AgendaViewSelector, ViewType } from '@/components/agenda/agenda-view-selector'
import { AgendaFiltersComponent, AgendaFilters } from '@/components/agenda/agenda-filters'
import { DateNavigation, NavigationType } from '@/components/agenda/date-navigation'
import { AgendaDayView } from '@/components/agenda/agenda-day-view'
import { AgendaWeekView } from '@/components/agenda/agenda-week-view'
import { AgendaMonthView } from '@/components/agenda/agenda-month-view'
import { AgendaListView } from '@/components/agenda/agenda-list-view'
import { AgendaTimelineView } from '@/components/agenda/agenda-timeline-view'
import { EditAppointmentDialog } from '@/components/agenda/edit-appointment-dialog'

// Hooks
import { useAppointments } from '@/hooks/use-appointments'
import { useStats } from '@/hooks/use-stats'

// Types
import { AppointmentStatus, ModalityType } from '@prisma/client'

export default function AgendaPage() {
  const { data: session, status } = useSession() || {}
  const { confirm } = useDialog()

  // State - All hooks must be declared before any conditional returns
  const [currentView, setCurrentView] = useState<ViewType>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [filters, setFilters] = useState<AgendaFilters>({})
  const [showFilters, setShowFilters] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<any>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)

  // Get appointments from database
  const {
    appointments,
    loading: appointmentsLoading,
    error: appointmentsError,
    updateAppointment,
    deleteAppointment,
    refetch: refetchAppointments
  } = useAppointments({
    search: filters.search,
    status: filters.status,
    service: filters.service,
    professional: filters.professional,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    view: currentView,
    currentDate: currentDate.toISOString(),
    autoFetch: !!session
  })

  // Get stats
  const { stats, loading: statsLoading } = useStats()

  // Get navigation type based on current view
  const getNavigationType = (view: ViewType): NavigationType => {
    switch (view) {
      case 'day':
        return 'day'
      case 'week':
        return 'week'
      case 'month':
        return 'month'
      default:
        return 'week'
    }
  }

  // Filter appointments based on current view and date (client-side filtering for view-specific data)
  const viewFilteredAppointments = useMemo(() => {
    if (currentView === 'list' || currentView === 'timeline') {
      return appointments
    }

    switch (currentView) {
      case 'day':
        return appointments.filter(apt => {
          const aptDate = new Date(apt.date)
          return aptDate.toDateString() === currentDate.toDateString()
        })

      case 'week':
        const startOfWeek = new Date(currentDate)
        const day = startOfWeek.getDay()
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
        startOfWeek.setDate(diff)
        startOfWeek.setHours(0, 0, 0, 0)

        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)
        endOfWeek.setHours(23, 59, 59, 999)

        return appointments.filter(apt => {
          const aptDate = new Date(apt.date)
          return aptDate >= startOfWeek && aptDate <= endOfWeek
        })

      case 'month':
        return appointments.filter(apt => {
          const aptDate = new Date(apt.date)
          return aptDate.getMonth() === currentDate.getMonth() &&
            aptDate.getFullYear() === currentDate.getFullYear()
        })

      default:
        return appointments
    }
  }, [appointments, currentView, currentDate])

  // Handlers
  const handleEditAppointment = async (id: string) => {
    const appointment = appointments.find(apt => apt.id === id)
    if (appointment) {
      setEditingAppointment(appointment)
      setShowEditDialog(true)
    }
  }

  const handleUpdateAppointment = async (id: string, data: any) => {
    await updateAppointment(id, data)
    setShowEditDialog(false)
    setEditingAppointment(null)
    await refetchAppointments()
  }

  const handleCloseEditDialog = () => {
    setShowEditDialog(false)
    setEditingAppointment(null)
  }

  const handleDeleteAppointment = async (id: string) => {
    const confirmed = await confirm({
      title: 'Excluir Agendamento',
      description: 'Tem certeza que deseja excluir este agendamento?',
      variant: 'destructive',
      confirmText: 'Excluir'
    })

    if (!confirmed) return

    try {
      await deleteAppointment(id)
      toast.success('Agendamento excluído com sucesso!')
    } catch (error) {
      toast.error('Erro ao excluir agendamento')
    }
  }

  const handleDayClick = (date: Date) => {
    setCurrentDate(date)
    setCurrentView('day')
  }

  const handleAppointmentClick = (appointment: any) => {
    setEditingAppointment(appointment)
    setShowEditDialog(true)
  }

  // Redirect if not authenticated - AFTER all hooks
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {appointmentsError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {appointmentsError}
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col space-y-3 sm:space-y-4">
        {/* Title */}
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Agendamento</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Visualize e gerencie todos os seus agendamentos
          </p>
        </div>

        {/* Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Stats - Hidden on very small screens */}
          <div className="hidden md:flex items-center space-x-4 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>
                Hoje: {statsLoading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : `${stats.todayAppointments} agendamento(s)`}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>
                Semana: {statsLoading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : `${stats.thisWeekAppointments} agendamento(s)`}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filters Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`text-xs sm:text-sm ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}
            >
              <Filter className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Filtros</span>
              {Object.keys(filters).filter(key =>
                filters[key as keyof AgendaFilters] !== undefined &&
                filters[key as keyof AgendaFilters] !== '' &&
                !(Array.isArray(filters[key as keyof AgendaFilters]) &&
                  (filters[key as keyof AgendaFilters] as any[]).length === 0)
              ).length > 0 && (
                  <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs h-4 w-4 sm:h-5 sm:w-auto flex items-center justify-center p-0 sm:px-2">
                    {Object.keys(filters).filter(key =>
                      filters[key as keyof AgendaFilters] !== undefined &&
                      filters[key as keyof AgendaFilters] !== '' &&
                      !(Array.isArray(filters[key as keyof AgendaFilters]) &&
                        (filters[key as keyof AgendaFilters] as any[]).length === 0)
                    ).length}
                  </Badge>
                )}
            </Button>

            {/* View Selector */}
            <AgendaViewSelector
              currentView={currentView}
              onViewChange={setCurrentView}
            />

            {/* New Appointment */}
            <Link href="/dashboard/appointments/new" className="flex-1 sm:flex-initial">
              <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9">
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Novo Agendamento</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats mobile - Only on small screens */}
        <div className="md:hidden flex items-center justify-around text-xs text-muted-foreground bg-muted rounded-lg p-2">
          <div className="flex items-center space-x-1">
            <Calendar className="h-3 w-3" />
            <span>Hoje: {statsLoading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : `${stats.todayAppointments} agendamento(s)`}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="h-3 w-3" />
            <span>Semana: {statsLoading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : `${stats.thisWeekAppointments} agendamento(s)`}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <AgendaFiltersComponent
        filters={filters}
        onFiltersChange={setFilters}
        isOpen={showFilters}
        onToggle={() => setShowFilters(!showFilters)}
      />



      {/* Main Content */}
      <div className="min-h-[400px]">
        {appointmentsLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Carregando agendamentos...</p>
            </div>
          </div>
        ) : (
          <>
            {currentView === 'day' && (
              <AgendaDayView
                date={currentDate}
                appointments={viewFilteredAppointments}
                onEditAppointment={handleEditAppointment}
                onDeleteAppointment={handleDeleteAppointment}
                onDateChange={setCurrentDate}
              />
            )}

            {currentView === 'week' && (
              <AgendaWeekView
                date={currentDate}
                appointments={viewFilteredAppointments}
                onEditAppointment={handleEditAppointment}
                onDeleteAppointment={handleDeleteAppointment}
                onDateChange={setCurrentDate}
              />
            )}

            {currentView === 'month' && (
              <AgendaMonthView
                date={currentDate}
                appointments={viewFilteredAppointments}
                onDayClick={handleDayClick}
                onAppointmentClick={handleAppointmentClick}
                onDateChange={setCurrentDate}
              />
            )}

            {currentView === 'list' && (
              <AgendaListView
                appointments={viewFilteredAppointments}
                onEditAppointment={handleEditAppointment}
                onDeleteAppointment={handleDeleteAppointment}
              />
            )}

            {currentView === 'timeline' && (
              <AgendaTimelineView
                appointments={viewFilteredAppointments}
                onEditAppointment={handleEditAppointment}
                onDeleteAppointment={handleDeleteAppointment}
              />
            )}
          </>
        )}
      </div>

      {/* Results Summary */}
      {viewFilteredAppointments.length === 0 && Object.keys(filters).length > 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhuma consulta encontrada
            </h3>
            <p className="text-muted-foreground mb-4">
              Não há consultas que correspondam aos filtros aplicados.
              Tente ajustar os filtros ou limpar todos os filtros.
            </p>
            <Button
              variant="outline"
              onClick={() => setFilters({})}
            >
              Limpar Filtros
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Appointment Dialog */}
      {editingAppointment && (
        <EditAppointmentDialog
          isOpen={showEditDialog}
          onClose={handleCloseEditDialog}
          appointment={editingAppointment}
          onUpdate={handleUpdateAppointment}
        />
      )}
    </div>
  )
}
