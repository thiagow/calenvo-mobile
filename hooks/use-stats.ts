
'use client'

import { useState, useEffect } from 'react'
import { statsApi, ApiError } from '@/lib/api'

export function useStats(autoFetch: boolean = true) {
  const [stats, setStats] = useState({
    todayAppointments: 0,
    thisWeekAppointments: 0,
    totalClients: 0,
    appointmentsByStatus: {} as Record<string, number>
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await statsApi.getStats()
      setStats(data)
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Erro ao carregar estatísticas'
      setError(errorMessage)
      console.error('Error fetching stats:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (autoFetch) {
      fetchStats()
    }
  }, [autoFetch])

  return {
    stats,
    loading,
    error,
    fetchStats,
    refetch: fetchStats
  }
}
