
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Briefcase, Plus, Edit, Trash2, Clock, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { useDialog } from '@/components/providers/dialog-provider'

interface Service {
  id: string
  name: string
  description: string | null
  duration: number
  price: number | null
  category: string | null
  isActive: boolean
  requiresDeposit: boolean
  depositAmount: number | null
  schedules: any[]
  _count: {
    appointments: number
  }
}

export default function ServicesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { confirm } = useDialog()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated') {
      fetchServices()
    }
  }, [status])

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/services')
      if (!response.ok) throw new Error('Erro ao buscar serviços')
      const data = await response.json()
      setServices(data)
    } catch (error) {
      console.error('Error fetching services:', error)
      toast.error('Erro ao carregar serviços')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Excluir Serviço',
      description: 'Tem certeza que deseja excluir este serviço?',
      variant: 'destructive',
      confirmText: 'Excluir'
    })

    if (!confirmed) return

    try {
      const response = await fetch(`/api/services/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Erro ao excluir serviço')

      toast.success('Serviço excluído com sucesso!')
      fetchServices()
    } catch (error) {
      console.error('Error deleting service:', error)
      toast.error('Erro ao excluir serviço')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Agrupar serviços por categoria
  const servicesByCategory = services.reduce((acc, service) => {
    const category = service.category || 'Sem Categoria'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(service)
    return acc
  }, {} as Record<string, Service[]>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Serviços</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Gerencie os serviços/procedimentos oferecidos
          </p>
        </div>
        <Button
          onClick={() => router.push('/dashboard/services/new')}
          className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Serviço
        </Button>
      </div>

      {/* Services List */}
      {services.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhum serviço cadastrado
            </h3>
            <p className="text-gray-600 mb-6">
              Crie seu primeiro serviço para começar a receber agendamentos
            </p>
            <Button
              onClick={() => router.push('/dashboard/services/new')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Serviço
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">{category}</h2>
              <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {categoryServices.map((service) => (
                  <Card key={service.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {service.name}
                            {!service.isActive && (
                              <Badge variant="secondary" className="text-xs">Inativo</Badge>
                            )}
                          </CardTitle>
                          {service.description && (
                            <CardDescription className="text-sm mt-1">
                              {service.description}
                            </CardDescription>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/dashboard/services/${service.id}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(service.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Duration and Price */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-700">{service.duration} min</span>
                        </div>
                        {service.price && (
                          <div className="flex items-center gap-1 text-green-600 font-medium">
                            <DollarSign className="h-4 w-4" />
                            {service.price.toFixed(2)}
                          </div>
                        )}
                      </div>

                      {/* Deposit */}
                      {service.requiresDeposit && (
                        <Badge variant="outline" className="text-xs">
                          Requer Sinal: R$ {service.depositAmount?.toFixed(2)}
                        </Badge>
                      )}

                      {/* Stats */}
                      <div className="flex items-center justify-between text-xs pt-2 border-t">
                        <span className="text-gray-600">
                          {service.schedules.length} agenda(s)
                        </span>
                        <span className="text-gray-600">
                          {service._count.appointments} agendamento(s)
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
