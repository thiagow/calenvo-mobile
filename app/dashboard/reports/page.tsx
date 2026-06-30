'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, Calendar, CheckCircle, XCircle, UserX, BarChart3, Trophy, UserMinus, DollarSign, ChevronRight } from 'lucide-react'
import { useSegmentConfig } from '@/contexts/segment-context'

interface MainStats { total: number; confirmed: number; cancelled: number; noShow: number }
interface ServiceStat { serviceName: string; count: number; percentage: number }
interface EvolutionData { month: string; appointments: number }
interface PeriodInfo { label: string; startDate: string; endDate: string }

export default function ReportsPage() {
  const { config: segmentConfig } = useSegmentConfig()
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [periodInfo, setPeriodInfo] = useState<PeriodInfo | null>(null)
  const [mainStats, setMainStats] = useState<MainStats>({ total: 0, confirmed: 0, cancelled: 0, noShow: 0 })
  const [servicesStats, setServicesStats] = useState<ServiceStat[]>([])
  const [evolutionData, setEvolutionData] = useState<EvolutionData[]>([])
  const [loading, setLoading] = useState(true)

  const monthOptions = (() => {
    const opts = []; const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      opts.push({ value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) })
    }
    return opts
  })()

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (selectedMonth) params.append('month', selectedMonth)
    fetch(`/api/reports/stats?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setPeriodInfo(data.period); setMainStats(data.mainStats); setServicesStats(data.servicesStats || []); setEvolutionData(data.evolutionData || []) } })
      .finally(() => setLoading(false))
  }, [selectedMonth])

  const t = segmentConfig.terminology

  const kpis = [
    { label: 'Total', value: mainStats.total, icon: Calendar, color: 'text-primary', sub: `${t.appointments} no período` },
    { label: 'Confirmados', value: mainStats.confirmed, icon: CheckCircle, color: 'text-green-600', sub: mainStats.total > 0 ? `${Math.round((mainStats.confirmed / mainStats.total) * 100)}% do total` : '—' },
    { label: 'Cancelados', value: mainStats.cancelled, icon: XCircle, color: 'text-red-600', sub: mainStats.total > 0 ? `${Math.round((mainStats.cancelled / mainStats.total) * 100)}% do total` : '—' },
    { label: 'Faltou', value: mainStats.noShow, icon: UserX, color: 'text-orange-600', sub: mainStats.total > 0 ? `${Math.round((mainStats.noShow / mainStats.total) * 100)}% do total` : '—' },
  ]

  return (
    <div className="space-y-4">
      {/* Filtro de mês */}
      <div className="flex items-center gap-2">
        <Select value={selectedMonth || ''} onValueChange={v => setSelectedMonth(v || null)}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Mês atual" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {selectedMonth && (
          <Button variant="outline" size="sm" onClick={() => setSelectedMonth(null)}>Limpar</Button>
        )}
      </div>

      {periodInfo && (
        <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs">
          <Calendar className="mr-1.5 h-3 w-3" />
          {periodInfo.label}
        </Badge>
      )}

      {/* KPI grid 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map(({ label, value, icon: Icon, color, sub }) => (
          <Card key={label} className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  {loading ? <Skeleton className="h-7 w-10 mt-1" /> : <p className="text-2xl font-bold mt-0.5">{value}</p>}
                  <p className={`text-[10px] mt-0.5 ${color}`}>{sub}</p>
                </div>
                <Icon className={`h-5 w-5 ${color} mt-0.5`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Links para sub-relatórios */}
      <Card className="border border-border">
        <CardContent className="p-0 divide-y divide-border">
          {[
            { label: 'Top Clientes', icon: Trophy, href: '/dashboard/reports/top-clients' },
            { label: 'Clientes Inativos', icon: UserMinus, href: '/dashboard/reports/inactive-clients' },
            { label: 'Lifetime Value (LTV)', icon: DollarSign, href: '/dashboard/reports/ltv' },
            { label: 'Uso de Pacotes', icon: BarChart3, href: '/dashboard/reports/packages' },
          ].map(({ label, icon: Icon, href }) => (
            <Link key={href} href={href} className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 active:bg-muted transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium">{label}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Evolução mensal */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Evolução Mensal
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : evolutionData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum dado disponível</p>
          ) : (
            <div className="space-y-2">
              {evolutionData.map((item, i) => {
                const prev = evolutionData[i + 1]
                const growth = prev && prev.appointments > 0 ? Math.round(((item.appointments - prev.appointments) / prev.appointments) * 100) : null
                return (
                  <div key={i} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium capitalize">{item.month}</p>
                      <p className="text-xs text-muted-foreground">{item.appointments} {item.appointments === 1 ? t.appointment.toLowerCase() : t.appointments.toLowerCase()}</p>
                    </div>
                    {growth !== null && (
                      <span className={`text-xs font-medium ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {growth >= 0 ? '+' : ''}{growth}%
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Serviços */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-green-600" />
            {t.services} Agendados
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : servicesStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum {t.service.toLowerCase()} agendado ainda</p>
          ) : (
            <div className="space-y-3">
              {servicesStats.map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate flex-1 mr-2">{item.serviceName}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
