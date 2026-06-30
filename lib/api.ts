
// API client utilities
const API_BASE = '/api'

export interface ApiResponse<T> {
  data?: T
  error?: string
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }

  try {
    const response = await fetch(url, config)

    if (!response.ok) {
      let errorMessage = 'An error occurred'

      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorMessage
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`
      }

      throw new ApiError(response.status, errorMessage)
    }

    const data = await response.json()
    return data
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(500, 'Network error')
  }
}

// Appointments API
export const appointmentsApi = {
  // Get appointments with filters
  getAll: (params?: {
    search?: string
    status?: string
    modality?: string
    specialty?: string
    professional?: string
    dateFrom?: string
    dateTo?: string
    view?: string
    currentDate?: string
  }) => {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) searchParams.append(key, value)
      })
    }
    const query = searchParams.toString()
    return apiRequest<any[]>(`/appointments${query ? `?${query}` : ''}`)
  },

  // Create appointment
  create: (data: {
    clientId: string
    date: string
    duration?: number
    status?: string
    modality?: string
    specialty?: string
    insurance?: string
    serviceType?: string
    professional?: string
    notes?: string
    price?: number
  }) => {
    return apiRequest<any>('/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Update appointment
  update: (id: string, data: Partial<{
    clientId: string
    date: string
    duration: number
    status: string
    modality: string
    specialty: string
    insurance: string
    serviceType: string
    professional: string
    notes: string
    price: number
  }>) => {
    return apiRequest<any>(`/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // Delete appointment
  delete: (id: string) => {
    return apiRequest<{ message: string }>(`/appointments/${id}`, {
      method: 'DELETE',
    })
  }
}

// Clients API
export const clientsApi = {
  // Get all clients
  getAll: (search?: string) => {
    const query = search ? `?search=${encodeURIComponent(search)}` : ''
    return apiRequest<any[]>(`/clients${query}`)
  },

  // Create client
  create: (data: {
    name: string
    phone: string
    email?: string
    cpf?: string
    birthDate?: string
    address?: string
    insurance?: string
    skinType?: string
    hairType?: string
    allergies?: string
    preferences?: string
    notes?: string
  }) => {
    return apiRequest<any>('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}

// Stats API
export const statsApi = {
  // Get dashboard stats
  getStats: () => {
    return apiRequest<{
      todayAppointments: number
      thisWeekAppointments: number
      totalClients: number
      appointmentsByStatus: Record<string, number>
    }>('/stats')
  }
}


// Professionals API
export const professionalsApi = {
  // Reset professional password
  resetPassword: (id: string) => {
    return apiRequest<{ message: string; tempPassword: string }>(`/professionals/${id}/reset-password`, {
      method: 'POST',
    })
  }
}

export { ApiError }
