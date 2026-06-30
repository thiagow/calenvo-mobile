'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'sonner'

export default function LoyaltyEditPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [isNew, setIsNew] = useState(true)
    const [form, setForm] = useState({
        name: 'Programa Fidelidade',
        mode: 'FREQUENCY' as 'FREQUENCY' | 'VALUE',
        pointsPerCurrency: 1,
        pointsToReward: 10,
        rewardValue: 0
    })

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/loyalty/config')
                const data = await res.json()
                if (data.config) {
                    setIsNew(false)
                    setForm({
                        name: data.config.name,
                        mode: data.config.mode,
                        pointsPerCurrency: data.config.pointsPerCurrency,
                        pointsToReward: data.config.pointsToReward,
                        rewardValue: data.config.rewardValue
                    })
                }
            } catch {
                // Novo programa
            } finally {
                setLoading(false)
            }
        }
        fetchConfig()
    }, [])

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error('Nome do programa é obrigatório')
            return
        }

        setSaving(true)
        try {
            const method = isNew ? 'POST' : 'PUT'
            const res = await fetch('/api/loyalty/config', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            })

            if (res.ok) {
                toast.success(isNew ? 'Programa criado com sucesso!' : 'Programa atualizado!')
                router.push('/dashboard/loyalty')
            } else {
                const err = await res.json()
                toast.error(err.error || 'Erro ao salvar')
            }
        } catch {
            toast.error('Erro de conexão')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-2xl mx-auto">
                    <Card className="animate-pulse">
                        <CardContent className="pt-6"><div className="h-64 bg-gray-200 rounded" /></CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/loyalty')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">{isNew ? 'Criar Programa' : 'Editar Programa'}</h1>
                        <p className="text-muted-foreground text-sm">Configure as regras de fidelização</p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Configurações do Programa</CardTitle>
                        <CardDescription>Defina como os pontos são acumulados e resgatados</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Nome */}
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome do Programa *</Label>
                            <Input
                                id="name"
                                value={form.name}
                                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Ex: Programa Fidelidade VIP"
                            />
                        </div>

                        {/* Modo */}
                        <div className="space-y-2">
                            <Label htmlFor="mode">Modo de Acúmulo *</Label>
                            <Select
                                value={form.mode}
                                onValueChange={(value: 'FREQUENCY' | 'VALUE') => setForm(prev => ({ ...prev, mode: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="FREQUENCY">
                                        🔢 Frequência — 1 agendamento concluído = 1 ponto
                                    </SelectItem>
                                    <SelectItem value="VALUE">
                                        💰 Valor — Pontos proporcionais ao valor pago
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {form.mode === 'FREQUENCY'
                                    ? 'Cada agendamento concluído automaticamente soma 1 ponto ao cliente.'
                                    : 'O valor pago no agendamento é convertido em pontos com base na taxa definida.'}
                            </p>
                        </div>

                        {/* Pontos por Real (só no modo VALUE) */}
                        {form.mode === 'VALUE' && (
                            <div className="space-y-2 p-4 bg-amber-50 rounded-lg border border-amber-200">
                                <Label htmlFor="pointsPerCurrency">Pontos por R$ 1,00</Label>
                                <Input
                                    id="pointsPerCurrency"
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    value={form.pointsPerCurrency}
                                    onChange={(e) => setForm(prev => ({ ...prev, pointsPerCurrency: parseFloat(e.target.value) || 0 }))}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Ex: Se 1, um serviço de R$ 100 = 100 pontos. Se 0.5, R$ 100 = 50 pontos.
                                </p>
                            </div>
                        )}

                        {/* Meta de Resgate */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="pointsToReward">Meta de Pontos para Resgate</Label>
                                <Input
                                    id="pointsToReward"
                                    type="number"
                                    min="1"
                                    value={form.pointsToReward}
                                    onChange={(e) => setForm(prev => ({ ...prev, pointsToReward: parseInt(e.target.value) || 0 }))}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Quantos pontos o cliente precisa para resgatar
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="rewardValue">Valor do Desconto (R$)</Label>
                                <Input
                                    id="rewardValue"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.rewardValue}
                                    onChange={(e) => setForm(prev => ({ ...prev, rewardValue: parseFloat(e.target.value) || 0 }))}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Desconto aplicado ao atingir a meta
                                </p>
                            </div>
                        </div>

                        {/* Preview da Regra */}
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-sm font-medium text-blue-800">📋 Resumo da Regra:</p>
                            <p className="text-sm text-blue-700 mt-1">
                                {form.mode === 'FREQUENCY'
                                    ? `A cada agendamento concluído, o cliente ganha 1 ponto. Ao acumular ${form.pointsToReward} pontos, poderá resgatar um desconto de R$ ${form.rewardValue.toFixed(2)}.`
                                    : `A cada R$ 1,00 gasto, o cliente ganha ${form.pointsPerCurrency} ponto(s). Ao acumular ${form.pointsToReward} pontos, poderá resgatar um desconto de R$ ${form.rewardValue.toFixed(2)}.`
                                }
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Ações */}
                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => router.push('/dashboard/loyalty')}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Salvando...' : (isNew ? 'Criar Programa' : 'Salvar Alterações')}
                    </Button>
                </div>
            </div>
        </div>
    )
}
