
'use client'

import { useState, useEffect } from 'react'
import { appointmentsApi, ApiError } from '@/lib/api'

export interface UseAppointmentsOptions {
  search?: string
  status?: string | string[]
  service?: string
  professional?: string
  dateFrom?: string
  dateTo?: string
  view?: string
  currentDate?: string
  autoFetch?: boolean
}

export function useAppointments(options: UseAppointmentsOptions = {}) {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAppointments = async () => {
    setLoading(true)
    setError(null)

    try {
      const params: any = { ...options }

      // Handle status array
      if (Array.isArray(options.status)) {
        params.status = options.status.join(',')
      }

      const data = await appointmentsApi.getAll(params)

      // Convert date strings to Date objects
      const appointmentsWithDates = data.map((apt: any) => ({
        ...apt,
        date: new Date(apt.date)
      }))

      setAppointments(appointmentsWithDates)
    } catch (err) {
      const errorMessage = err instanceof ApiError
        ? err.message
        : 'Erro ao carregar agendamentos'
      setError(errorMessage)
      console.error('Error fetching appointments:', err)
    } finally {
      setLoading(false)
    }
  }

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
  }, [
    options.search,
    options.status,
    options.service,
    options.professional,
    options.dateFrom,
    options.dateTo,
    options.view,
    options.currentDate
  ])

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
