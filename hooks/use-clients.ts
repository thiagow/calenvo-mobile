
'use client'

import { useState, useEffect } from 'react'
import { clientsApi, ApiError } from '@/lib/api'

export interface UseClientsOptions {
  search?: string
  autoFetch?: boolean
}

export function useClients(options: UseClientsOptions = {}) {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchClients = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await clientsApi.getAll(options.search)
      setClients(data)
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Erro ao carregar clientes'
      setError(errorMessage)
      console.error('Error fetching clients:', err)
    } finally {
      setLoading(false)
    }
  }

  const createClient = async (clientData: any) => {
    try {
      const newClient = await clientsApi.create(clientData)
      setClients(prev => [...prev, newClient])
      return newClient
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : 'Erro ao criar cliente'
      setError(errorMessage)
      throw err
    }
  }

  // Auto fetch on mount and when search changes
  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchClients()
    }
  }, [options.search])

  return {
    clients,
    loading,
    error,
    fetchClients,
    createClient,
    refetch: fetchClients
  }
}
