'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AVAILABLE_SEGMENTS, PLAN_CONFIGS } from '@/lib/types'
import { PlanType, SegmentType } from '@prisma/client'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useDialog } from '@/components/providers/dialog-provider'

const PLAN_OPTIONS: PlanType[] = ['BASICO', 'PRO', 'BUSINESS']

export default function NewTenantPage() {
    const router = useRouter()
    const { alert } = useDialog()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        businessName: '',
        segmentType: 'BEAUTY_SALON' as SegmentType,
        phone: '',
        planType: 'BASICO' as PlanType,
        billingInterval: 'MONTHLY' as 'MONTHLY' | 'ANNUAL',
    })

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await fetch('/api/saas-admin/tenants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Erro ao criar cliente')
            }

            router.push(`/saas-admin/tenants/${data.tenant.id}`)
        } catch (error) {
            await alert({
                title: 'Erro',
                description: error instanceof Error ? error.message : 'Erro ao criar cliente',
                variant: 'error'
            })
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="flex items-center gap-4">
                <Link href="/saas-admin/tenants">
                    <Button variant="outline" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Voltar
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">Novo Cliente</h1>
                    <p className="text-muted-foreground">Cadastro manual com isenção de pagamento (cortesia/parceria)</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Dados do cliente</CardTitle>
                    <CardDescription>
                        Esta conta será criada sem cobrança no Stripe. Use para cortesias, parcerias ou contas de teste.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome completo</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Senha inicial</Label>
                            <Input
                                id="password"
                                type="password"
                                minLength={6}
                                value={formData.password}
                                onChange={(e) => handleChange('password', e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="businessName">Nome do negócio</Label>
                            <Input
                                id="businessName"
                                value={formData.businessName}
                                onChange={(e) => handleChange('businessName', e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="segmentType">Segmento</Label>
                            <Select
                                value={formData.segmentType}
                                onValueChange={(value) => handleChange('segmentType', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {AVAILABLE_SEGMENTS.map((segment) => (
                                        <SelectItem key={segment.value} value={segment.value}>
                                            {segment.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefone</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="planType">Plano</Label>
                                <Select
                                    value={formData.planType}
                                    onValueChange={(value) => handleChange('planType', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PLAN_OPTIONS.map((plan) => (
                                            <SelectItem key={plan} value={plan}>
                                                {PLAN_CONFIGS[plan].name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="billingInterval">Intervalo</Label>
                                <Select
                                    value={formData.billingInterval}
                                    onValueChange={(value) => handleChange('billingInterval', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MONTHLY">Mensal</SelectItem>
                                        <SelectItem value="ANNUAL">Anual</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Criando...
                                </>
                            ) : (
                                'Criar cliente isento de pagamento'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
