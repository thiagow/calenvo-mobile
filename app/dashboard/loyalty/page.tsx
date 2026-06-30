'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Gift, Users, Edit, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { toast } from 'sonner'

interface LoyaltyConfig {
  id: string; name: string; mode: 'FREQUENCY' | 'VALUE'
  pointsPerCurrency: number; pointsToReward: number; rewardValue: number
  isActive: boolean; createdAt: string
}

interface LoyaltyStats {
  totalPointsEarned: number; totalPointsRedeemed: number; activeClientsWithBalance: number
}

export default function LoyaltyPage() {
  const router = useRouter()
  const [config, setConfig] = useState<LoyaltyConfig | null>(null)
  const [stats, setStats] = useState<LoyaltyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    fetch('/api/loyalty/config')
      .then(r => r.json())
      .then(d => { setConfig(d.config); setStats(d.stats) })
      .catch(() => toast.error('Erro ao carregar programa de fidelidade'))
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (isActive: boolean) => {
    setToggling(true)
    try {
      const res = await fetch('/api/loyalty/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive }) })
      if (res.ok) { setConfig(await res.json()); toast.success(isActive ? 'Programa ativado!' : 'Programa desativado') }
    } catch { toast.error('Erro ao atualizar') } finally { setToggling(false) }
  }

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
    </div>
  )

  if (!config) return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
      <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center">
        <Gift className="h-10 w-10 text-amber-500" />
      </div>
      <h2 className="text-xl font-semibold">Programa de Fidelidade</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Recompense seus clientes por frequência ou valor gasto e aumente o retorno!
      </p>
      <Button onClick={() => router.push('/dashboard/loyalty/edit')} className="bg-amber-500 hover:bg-amber-600 text-white">
        <Plus className="h-4 w-4 mr-2" />Criar Programa
      </Button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header do programa */}
      <Card className="border border-border">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Gift className="h-5 w-5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{config.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {config.mode === 'FREQUENCY' ? '🔢 Frequência' : '💰 Valor'}
                  </Badge>
                  <Badge variant={config.isActive ? 'default' : 'secondary'} className={`text-[10px] px-1.5 py-0 ${config.isActive ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''}`}>
                    {config.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Switch checked={config.isActive} onCheckedChange={handleToggle} disabled={toggling} />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => router.push('/dashboard/loyalty/edit')}>
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Emitidos', value: stats.totalPointsEarned.toLocaleString('pt-BR'), icon: ArrowUpRight, color: 'text-green-600' },
            { label: 'Resgatados', value: stats.totalPointsRedeemed.toLocaleString('pt-BR'), icon: ArrowDownRight, color: 'text-blue-600' },
            { label: 'C/ saldo', value: stats.activeClientsWithBalance.toString(), icon: Users, color: 'text-amber-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border border-border">
              <CardContent className="p-3 text-center">
                <Icon className={`h-4 w-4 ${color} mx-auto mb-1`} />
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detalhes */}
      <Card className="border border-border">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Regras do Programa</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-xs text-muted-foreground">Modo</span>
              <span className="text-xs font-medium">{config.mode === 'FREQUENCY' ? '1 visita = 1 ponto' : `R$ 1 = ${config.pointsPerCurrency} pts`}</span>
            </div>
            {config.mode === 'VALUE' && (
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-xs text-muted-foreground">Taxa de conversão</span>
                <span className="text-xs font-medium">{config.pointsPerCurrency} pt(s)/R$1</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-xs text-muted-foreground">Meta para resgate</span>
              <span className="text-xs font-medium">{config.pointsToReward} pontos</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-xs text-muted-foreground">Valor do desconto</span>
              <span className="text-xs font-medium text-green-600">R$ {config.rewardValue.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full" onClick={() => router.push('/dashboard/patients')}>
        <Users className="h-4 w-4 mr-2" />
        Ver Clientes com Pontos
      </Button>
    </div>
  )
}
