'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Lock, Unlock, Zap } from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useDialog } from '@/components/providers/dialog-provider'

export default function TenantDetailsPage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const { confirm, alert } = useDialog()
    const [tenant, setTenant] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [updatingPlan, setUpdatingPlan] = useState(false)

    useEffect(() => {
        fetchTenantDetails()
    }, [])

    const fetchTenantDetails = async () => {
        try {
            const res = await fetch(`/api/saas-admin/tenants/${params.id}`)
            if (res.ok) {
                const data = await res.json()
                setTenant(data.tenant)
            }
        } catch (error) {
            console.error('Error fetching tenant details:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleToggleStatus = async () => {
        if (!tenant) return

        const confirmed = await confirm({
            title: tenant.isActive ? 'Bloquear Cliente' : 'Desbloquear Cliente',
            description: `Tem certeza que deseja ${tenant.isActive ? 'bloquear' : 'desbloquear'} este cliente?`,
            variant: tenant.isActive ? 'destructive' : 'default',
            confirmText: tenant.isActive ? 'Bloquear' : 'Desbloquear'
        })

        if (!confirmed) return

        try {
            const res = await fetch(`/api/saas-admin/tenants/${params.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isActive: !tenant.isActive,
                    reason: tenant.isActive ? 'Bloqueado pelo admin' : 'Desbloqueado pelo admin'
                })
            })

            if (res.ok) {
                fetchTenantDetails()
            }
        } catch (error) {
            console.error('Error toggling tenant status:', error)
        }
    }

    const handlePlanChange = async (newPlan: string) => {
        if (!tenant || newPlan === tenant.planType) return

        const confirmed = await confirm({
            title: 'Alterar Plano',
            description: `Tem certeza que deseja alterar o plano para ${newPlan}?`,
            confirmText: 'Alterar'
        })

        if (!confirmed) return

        setUpdatingPlan(true)
        try {
            const res = await fetch(`/api/saas-admin/tenants/${params.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planType: newPlan,
                    reason: `Alteração de plano para ${newPlan} pelo administrador`
                })
            })

            if (res.ok) {
                fetchTenantDetails()
            } else {
                await alert({
                    title: 'Erro',
                    description: 'Erro ao atualizar plano',
                    variant: 'error'
                })
            }
        } catch (error) {
            console.error('Error updating plan:', error)
            await alert({
                title: 'Erro',
                description: 'Erro ao atualizar plano',
                variant: 'error'
            })
        } finally {
            setUpdatingPlan(false)
        }
    }

    if (loading) {
        return <div className="text-center py-8">Carregando...</div>
    }

    if (!tenant) {
        return <div className="text-center py-8">Cliente não encontrado</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Voltar
                </Button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold">{tenant.businessName || tenant.name}</h1>
                    <p className="text-muted-foreground">{tenant.email}</p>
                </div>
                <Button
                    variant={tenant.isActive ? 'destructive' : 'default'}
                    onClick={handleToggleStatus}
                >
                    {tenant.isActive ? (
                        <>
                            <Lock className="h-4 w-4 mr-1" />
                            Bloquear Cliente
                        </>
                    ) : (
                        <>
                            <Unlock className="h-4 w-4 mr-1" />
                            Desbloquear Cliente
                        </>
                    )}
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Informações do Negócio</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Status:</span>
                            <Badge variant={tenant.isActive ? 'default' : 'destructive'}>
                                {tenant.isActive ? 'Ativo' : 'Bloqueado'}
                            </Badge>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Zap className="h-4 w-4 text-primary" />
                                Plano Atual:
                            </label>
                            <Select
                                disabled={updatingPlan}
                                defaultValue={tenant.planType}
                                onValueChange={handlePlanChange}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecione um plano" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="FREEMIUM">Freemium</SelectItem>
                                    <SelectItem value="STANDARD">Standard</SelectItem>
                                    <SelectItem value="PREMIUM">Premium</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex justify-between border-t pt-4">
                            <span className="text-sm font-medium">Segmento:</span>
                            <span className="text-sm">{tenant.segmentType}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm font-medium">Telefone:</span>
                            <span className="text-sm">{tenant.phone || 'Não informado'}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Métricas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-sm font-medium">Profissionais:</span>
                            <span className="text-sm">{tenant._count.professionals}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm font-medium">Agendamentos:</span>
                            <span className="text-sm">{tenant._count.appointments}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm font-medium">Clientes:</span>
                            <span className="text-sm">{tenant._count.clients}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm font-medium">Serviços:</span>
                            <span className="text-sm">{tenant._count.services}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm font-medium">Agendas:</span>
                            <span className="text-sm">{tenant._count.schedules}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {tenant.professionals && tenant.professionals.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Profissionais da Equipe</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {tenant.professionals.map((prof: any) => (
                                <div key={prof.id} className="flex items-center justify-between p-2 border rounded">
                                    <div>
                                        <p className="font-medium">{prof.name}</p>
                                        <p className="text-sm text-muted-foreground">{prof.email}</p>
                                    </div>
                                    <Badge variant={prof.isActive ? 'default' : 'secondary'}>
                                        {prof.isActive ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
