
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { appointmentsApi, ApiError } from '@/lib/api'

export interface UseAppointmentsOptions {
  search?: string
  status?: string | string[]
  /** id do serviço */
  service?: string
  /** id do profissional */
  professional?: string
  dateFrom?: string
  dateTo?: string
  view?: string
  /** Dia de referência da vista, "YYYY-MM-DD" */
  currentDate?: string
  autoFetch?: boolean
}

const SEARCH_DEBOUNCE_MS = 300

/** Valor com atraso: evita uma requisição por tecla digitada. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function useAppointments(options: UseAppointmentsOptions = {}) {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Só a última requisição pode escrever o resultado; as anteriores são abortadas.
  const inFlight = useRef<AbortController | null>(null)

  const search = useDebounced(options.search, SEARCH_DEBOUNCE_MS)
  const statusKey = Array.isArray(options.status) ? options.status.join(',') : options.status

  const fetchAppointments = useCallback(async () => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller

    setLoading(true)
    setError(null)

    try {
      const data = await appointmentsApi.getAll(
        {
          search,
          status: statusKey,
          service: options.service,
          professional: options.professional,
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
          view: options.view,
          currentDate: options.currentDate,
        },
        controller.signal
      )

      // Convert date strings to Date objects
      const appointmentsWithDates = data.map((apt: any) => ({
        ...apt,
        date: new Date(apt.date)
      }))

      setAppointments(appointmentsWithDates)
    } catch (err) {
      if (controller.signal.aborted) return // substituída por uma busca mais nova
      const errorMessage = err instanceof ApiError
        ? err.message
        : 'Erro ao carregar agendamentos'
      setError(errorMessage)
      console.error('Error fetching appointments:', err)
    } finally {
      if (inFlight.current === controller) setLoading(false)
    }
  }, [
    search,
    statusKey,
    options.service,
    options.professional,
    options.dateFrom,
    options.dateTo,
    options.view,
    options.currentDate,
  ])

  const createAppointment = async (appointmentData: any) => {
    try {
      const newAppointment = await appointmentsApi.create(appointmentData)
      setAppointments(prev => [...prev, newAppointment])
      return newAppointment
    } catch (err) {
      const errorMessage = err instanceof ApiError
        ? err.message
        : 'Erro ao criar agendamento'
      setError(errorMessage)
      throw err
    }
  }

  const updateAppointment = async (id: string, updateData: any) => {
    try {
      const updatedAppointment = await appointmentsApi.update(id, updateData)
      setAppointments(prev =>
        prev.map(apt => apt.id === id ? updatedAppointment : apt)
      )
      return updatedAppointment
    } catch (err) {
      const errorMessage = err instanceof ApiError
        ? err.message
        : 'Erro ao atualizar agendamento'
      setError(errorMessage)
      throw err
    }
  }

  const deleteAppointment = async (id: string) => {
    try {
      await appointmentsApi.delete(id)
      setAppointments(prev => prev.filter(apt => apt.id !== id))
    } catch (err) {
      const errorMessage = err instanceof ApiError
        ? err.message
        : 'Erro ao excluir agendamento'
      setError(errorMessage)
      throw err
    }
  }

  // Auto fetch on mount and when options change
  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchAppointments()
    }
    return () => inFlight.current?.abort()
  }, [fetchAppointments, options.autoFetch])

  return {
    appointments,
    loading,
    error,
    fetchAppointments,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    refetch: fetchAppointments
  }
}
