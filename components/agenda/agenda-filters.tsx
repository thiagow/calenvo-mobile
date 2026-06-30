
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Filter,
  X,
  Search,
  Calendar,
  User,
  Stethoscope
} from 'lucide-react'
import { AppointmentStatus, ModalityType } from '@prisma/client'
import { STATUS_LABELS, MODALITY_LABELS } from '@/lib/types'

export interface AgendaFilters {
  search?: string
  status?: AppointmentStatus[]
  service?: string
  dateFrom?: string
  dateTo?: string
  professional?: string
}

interface AgendaFiltersProps {
  filters: AgendaFilters
  onFiltersChange: (filters: AgendaFilters) => void
  isOpen: boolean
  onToggle: () => void
}

export function AgendaFiltersComponent({
  filters,
  onFiltersChange,
  isOpen,
  onToggle
}: AgendaFiltersProps) {

  const [services, setServices] = useState<{ id: string, name: string }[]>([])
  const [professionals, setProfessionals] = useState<{ id: string, name: string }[]>([])

  useEffect(() => {
    fetchServices()
    fetchProfessionals()
  }, [])

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/services')
      if (response.ok) {
        const data = await response.json()
        setServices(data)
      }
    } catch (error) {
      console.error('Error fetching services:', error)
    }
  }

  const fetchProfessionals = async () => {
    try {
      const response = await fetch('/api/professionals')
      if (response.ok) {
        const data = await response.json()
        setProfessionals(data)
      }
    } catch (error) {
      console.error('Error fetching professionals:', error)
    }
  }

  const updateFilter = <K extends keyof AgendaFilters>(
    key: K,
    value: AgendaFilters[K]
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  const clearFilters = () => {
    onFiltersChange({})
  }

  const toggleStatus = (status: AppointmentStatus) => {
    const currentStatuses = filters.status || []
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status]

    updateFilter('status', newStatuses.length > 0 ? newStatuses : undefined)
  }

  const hasActiveFilters = Object.values(filters).some(value =>
    value !== undefined && value !== '' &&
    !(Array.isArray(value) && value.length === 0)
  )

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (value === undefined || value === '') return false
    if (Array.isArray(value) && value.length === 0) return false
    return true
  }).length

  return (
    <Card className={`transition-all duration-200 ${isOpen ? 'shadow-md' : 'shadow-sm'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center">
            <Filter className="mr-2 h-4 w-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs text-red-600 hover:text-red-700"
              >
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="text-xs"
            >
              {isOpen ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="space-y-4">
          {/* Busca */}
          <div>
            <Label className="text-xs font-medium text-gray-700">Buscar</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por paciente, profissional..."
                value={filters.search || ''}
                onChange={(e) => updateFilter('search', e.target.value || undefined)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs font-medium text-gray-700">Status</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(STATUS_LABELS).map(([status, label]) => {
                const isSelected = filters.status?.includes(status as AppointmentStatus) || false
                return (
                  <Button
                    key={status}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleStatus(status as AppointmentStatus)}
                    className="text-xs h-7"
                  >
                    {label}
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Serviços */}
            <div>
              <Label className="text-xs font-medium text-gray-700">Serviços</Label>
              <Select
                value={filters.service || 'all'}
                onValueChange={(value) => updateFilter('service', value === 'all' ? undefined : value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.name}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Profissional */}
            <div>
              <Label className="text-xs font-medium text-gray-700">Profissional</Label>
              <Select
                value={filters.professional || 'all'}
                onValueChange={(value) => updateFilter('professional', value === 'all' ? undefined : value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {professionals.map((pro) => (
                    <SelectItem key={pro.id} value={pro.id}>
                      {pro.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Período */}
            <div>
              <Label className="text-xs font-medium text-gray-700">Período</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <Input
                    type="date"
                    placeholder="Data inicial"
                    value={filters.dateFrom || ''}
                    onChange={(e) => updateFilter('dateFrom', e.target.value || undefined)}
                  />
                </div>
                <div>
                  <Input
                    type="date"
                    placeholder="Data final"
                    value={filters.dateTo || ''}
                    onChange={(e) => updateFilter('dateTo', e.target.value || undefined)}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
