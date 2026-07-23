'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { PLAN_CONFIGS } from '@/lib/types'
import { PlanType } from '@prisma/client'
import { Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useDialog } from '@/components/providers/dialog-provider'
import { applyPhoneMask } from '@/lib/utils'
import { SegmentMultiSelect } from '@/components/shared/segment-multi-select'

const PLAN_OPTIONS: PlanType[] = ['BASICO', 'PRO', 'BUSINESS']

export default function NewTenantPage() {
    const router = useRouter()
    const { alert } = useDialog()
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        businessName: '',
        segmentTypes: ['BEAUTY_SALON'] as string[],
        phone: '',
        planType: 'BASICO' as PlanType,
        billingInterval: 'MONTHLY' as 'MONTHLY' | 'ANNUAL',
        isPaymentExempt: true,
    })

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (formData.segmentTypes.length === 0) {
            await alert({
                title: 'Erro',
                description: 'Selecione ao menos um segmento',
                variant: 'error'
            })
            return
        }

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
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    minLength={6}
                                    value={formData.password}
                                    onChange={(e) => handleChange('password', e.target.value)}
                                    className="pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
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
                            <Label>Segmentos</Label>
                            <SegmentMultiSelect
                                value={formData.segmentTypes}
                                onChange={(value) => setFormData(prev => ({ ...prev, segmentTypes: value }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefone</Label>
                            <Input
                                id="phone"
                                type="tel"
                                inputMode="numeric"
                                placeholder="(11) 99999-0000"
                                value={formData.phone}
                                onChange={(e) => handleChange('phone', applyPhoneMask(e.target.value))}
                                required
                            />
                        </div>

                        <div className="flex items-center gap-2 rounded-md border border-input p-3">
                            <Checkbox
                                id="isPaymentExempt"
                                checked={formData.isPaymentExempt}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPaymentExempt: checked === true }))}
                            />
                            <Label htmlFor="isPaymentExempt" className="cursor-pointer font-normal">
                                Isentar de pagamento (cortesia/parceria, sem cobrança no Stripe)
                            </Label>
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
                                formData.isPaymentExempt ? 'Criar cliente isento de pagamento' : 'Criar cliente'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
