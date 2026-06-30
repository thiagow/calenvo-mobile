
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  Calendar,
  CheckCircle,
  XCircle,
  UserX,
  BarChart3,
  X,
  Trophy,
  UserMinus,
  DollarSign
} from 'lucide-react'
import { useSegmentConfig } from '@/contexts/segment-context'

interface MainStats {
  total: number
  confirmed: number
  cancelled: number
  noShow: number
}

interface ServiceStat {
  serviceName: string
  count: number
  percentage: number
}

interface EvolutionData {
  month: string
  appointments: number
}

interface PeriodInfo {
  label: string
  startDate: string
  endDate: string
}

export default function ReportsPage() {
  const { config: segmentConfig, isLoading: segmentLoading } = useSegmentConfig()
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [periodInfo, setPeriodInfo] = useState<PeriodInfo | null>(null)
  const [mainStats, setMainStats] = useState<MainStats>({
    total: 0,
    confirmed: 0,
    cancelled: 0,
    noShow: 0
  })
  const [servicesStats, setServicesStats] = useState<ServiceStat[]>([])
  const [evolutionData, setEvolutionData] = useState<EvolutionData[]>([])
  const [loading, setLoading] = useState(true)

  // Generate month options (last 12 months)
  const generateMonthOptions = () => {
    const options = []
    const now = new Date()

    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      options.push({ value, label })
    }

    return options
  }

  const monthOptions = generateMonthOptions()

  // Buscar dados reais
  useEffect(() => {
    const fetchReportsData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (selectedMonth) {
          params.append('month', selectedMonth)
        }

        const response = await fetch(`/api/reports/stats?${params}`)
        if (response.ok) {
          const data = await response.json()
          setPeriodInfo(data.period)
          setMainStats(data.mainStats)
          setServicesStats(data.servicesStats || [])
          setEvolutionData(data.evolutionData || [])
        }
      } catch (error) {
        console.error('Error fetching reports data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReportsData()
  }, [selectedMonth])

  // Terminologia dinâmica
  const t = segmentConfig.terminology

  const clearFilter = () => {
    setSelectedMonth(null)
  }

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Período de Referência
              </label>
              <Select value={selectedMonth || ''} onValueChange={(value) => setSelectedMonth(value || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Mês atual" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedMonth && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilter}
                className="mt-6"
              >
                <X className="mr-1 h-3 w-3" />
                Limpar filtro
              </Button>
            )}

            {/* Period Badge */}
            <div className="flex-1 flex items-center justify-end min-w-[200px]">
              {periodInfo && (
                <Badge className="bg-blue-600 text-white px-4 py-2 text-sm">
                  <Calendar className="mr-2 h-4 w-4" />
                  Mês de Referência: {periodInfo.label}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>

          {/* Stats Cards - ATUALIZADO */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total de Agendas
                </CardTitle>
                <Calendar className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {mainStats.total}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.appointments} no período
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Confirmados
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {mainStats.confirmed}
                </div>
                <p className="text-xs text-green-600">
                  {mainStats.total > 0 ? `${Math.round((mainStats.confirmed / mainStats.total) * 100)}%` : '0%'} do total
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Cancelados
                </CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {mainStats.cancelled}
                </div>
                <p className="text-xs text-red-600">
                  {mainStats.total > 0 ? `${Math.round((mainStats.cancelled / mainStats.total) * 100)}%` : '0%'} do total
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Faltou
                </CardTitle>
                <UserX className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {mainStats.noShow}
                </div>
                <p className="text-xs text-orange-600">
                  {mainStats.total > 0 ? `${Math.round((mainStats.noShow / mainStats.total) * 100)}%` : '0%'} do total
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Reports */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Evolução Mensal - ATUALIZADO */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5 text-blue-600" />
                  Evolução Mensal
                </CardTitle>
                <CardDescription>
                  Últimos 6 meses incluindo o período selecionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {evolutionData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Nenhum dado disponível ainda</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {evolutionData.map((item, index) => {
                      // Na ordem decrescente, o mês cronologicamente anterior está no próximo índice
                      const hasPreviousMonthInList = index < evolutionData.length - 1
                      const previousMonthData = hasPreviousMonthInList ? evolutionData[index + 1] : null
                      const previousCount = previousMonthData ? previousMonthData.appointments : item.appointments
                      const growth = previousCount > 0 ? Math.round(((item.appointments - previousCount) / previousCount) * 100) : 0

                      return (
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                          <div>
                            <p className="font-medium text-gray-900 capitalize">{item.month}</p>
                            <p className="text-sm text-gray-600">{item.appointments} {item.appointments === 1 ? t.appointment.toLowerCase() : t.appointments.toLowerCase()}</p>
                          </div>
                          <div className="text-right">
                            {hasPreviousMonthInList && (
                              <p className={`text-xs ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {growth >= 0 ? '+' : ''}{growth}%
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Serviços Agendados - ATUALIZADO (antes era "Perfil dos Pacientes") */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="mr-2 h-5 w-5 text-green-600" />
                  {t.services} Agendados
                </CardTitle>
                <CardDescription>
                  Distribuição por {t.service.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {servicesStats.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Nenhum {t.service.toLowerCase()} agendado ainda</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {servicesStats.map((item, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{item.serviceName}</span>
                          <span className="text-sm text-gray-600">{item.count} {item.count === 1 ? t.appointment.toLowerCase() : t.appointments.toLowerCase()} ({item.percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
