'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
    Gift, Star, TrendingUp, Users, Edit, Plus, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { toast } from 'sonner'

interface LoyaltyConfig {
    id: string
    name: string
    mode: 'FREQUENCY' | 'VALUE'
    pointsPerCurrency: number
    pointsToReward: number
    rewardValue: number
    isActive: boolean
    createdAt: string
}

interface LoyaltyStats {
    totalPointsEarned: number
    totalPointsRedeemed: number
    activeClientsWithBalance: number
}

export default function LoyaltyPage() {
    const router = useRouter()
    const [config, setConfig] = useState<LoyaltyConfig | null>(null)
    const [stats, setStats] = useState<LoyaltyStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [toggling, setToggling] = useState(false)

    const fetchData = async () => {
        try {
            const res = await fetch('/api/loyalty/config')
            const data = await res.json()
            setConfig(data.config)
            setStats(data.stats)
        } catch {
            toast.error('Erro ao carregar programa de fidelidade')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    const handleToggle = async (isActive: boolean) => {
        setToggling(true)
        try {
            const res = await fetch('/api/loyalty/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive })
            })
            if (res.ok) {
                const updated = await res.json()
                setConfig(updated)
                toast.success(isActive ? 'Programa ativado!' : 'Programa desativado')
            }
        } catch {
            toast.error('Erro ao atualizar status')
        } finally {
            setToggling(false)
        }
    }

    if (loading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="flex items-center gap-3 mb-6">
                    <Gift className="h-7 w-7 text-amber-500" />
                    <h1 className="text-2xl font-bold">Fidelidade</h1>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="pt-6"><div className="h-20 bg-gray-200 rounded" /></CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    // Se não tem programa criado
    if (!config) {
        return (
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="flex items-center gap-3 mb-6">
                    <Gift className="h-7 w-7 text-amber-500" />
                    <h1 className="text-2xl font-bold">Fidelidade</h1>
                </div>
                <Card className="max-w-lg mx-auto">
                    <CardContent className="pt-8 pb-8 text-center space-y-4">
                        <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
                            <Gift className="h-10 w-10 text-amber-500" />
                        </div>
                        <h2 className="text-xl font-semibold">Crie seu Programa de Fidelidade</h2>
                        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                            Recompense seus clientes por frequência ou valor gasto. Fidelize e aumente o retorno!
                        </p>
                        <Button
                            onClick={() => router.push('/dashboard/loyalty/edit')}
                            className="bg-amber-500 hover:bg-amber-600 text-white"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Criar Programa
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Gift className="h-7 w-7 text-amber-500" />
                    <div>
                        <h1 className="text-2xl font-bold">{config.name}</h1>
                        <p className="text-muted-foreground text-sm">Programa de Fidelidade</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                            {config.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                        <Switch
                            checked={config.isActive}
                            onCheckedChange={handleToggle}
                            disabled={toggling}
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/dashboard/loyalty/edit')}
                    >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                    </Button>
                </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-3">
                <Badge variant={config.isActive ? 'default' : 'secondary'} className={config.isActive ? 'bg-green-100 text-green-800' : ''}>
                    {config.isActive ? '● Ativo' : '○ Inativo'}
                </Badge>
                <Badge variant="outline">
                    {config.mode === 'FREQUENCY' ? '🔢 Modo Frequência' : '💰 Modo Valor'}
                </Badge>
            </div>

            {/* KPIs */}
            {stats && (
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pontos Emitidos</CardTitle>
                            <ArrowUpRight className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                                {stats.totalPointsEarned.toLocaleString('pt-BR')}
                            </div>
                            <p className="text-xs text-muted-foreground">Total acumulado</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Resgates</CardTitle>
                            <ArrowDownRight className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">
                                {stats.totalPointsRedeemed.toLocaleString('pt-BR')}
                            </div>
                            <p className="text-xs text-muted-foreground">Pontos resgatados</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Clientes com Saldo</CardTitle>
                            <Users className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-600">
                                {stats.activeClientsWithBalance}
                            </div>
                            <p className="text-xs text-muted-foreground">Clientes ativos no programa</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Detalhes do Programa */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Detalhes do Programa</CardTitle>
                    <CardDescription>Configurações de acúmulo e resgate</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Modo</p>
                            <p className="text-sm font-semibold mt-1">
                                {config.mode === 'FREQUENCY' ? 'Frequência (1 visita = 1 ponto)' : `Valor (R$ 1 = ${config.pointsPerCurrency} pts)`}
                            </p>
                        </div>
                        {config.mode === 'VALUE' && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Taxa de Conversão</p>
                                <p className="text-sm font-semibold mt-1">{config.pointsPerCurrency} ponto(s) por R$ 1,00</p>
                            </div>
                        )}
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Meta p/ Resgate</p>
                            <p className="text-sm font-semibold mt-1">{config.pointsToReward} pontos</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Valor do Desconto</p>
                            <p className="text-sm font-semibold mt-1">R$ {config.rewardValue.toFixed(2)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
