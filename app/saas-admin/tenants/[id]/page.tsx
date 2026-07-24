'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Lock, Unlock, Zap, Gift, Users, CalendarDays, UserRound, Briefcase, CalendarRange, Trash2, AlertTriangle } from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useDialog } from '@/components/providers/dialog-provider'
import { SegmentMultiSelect } from '@/components/shared/segment-multi-select'
import { toast } from 'sonner'

function MetricTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-border p-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
                <p className="text-lg font-semibold leading-none">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground truncate">{label}</p>
            </div>
        </div>
    )
}

export default function TenantDetailsPage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const { confirm, alert } = useDialog()
    const [tenant, setTenant] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [updatingPlan, setUpdatingPlan] = useState(false)
    const [editingSegments, setEditingSegments] = useState<string[]>([])
    const [savingSegments, setSavingSegments] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletePassword, setDeletePassword] = useState('')
    const [deleteError, setDeleteError] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        fetchTenantDetails()
    }, [])

    useEffect(() => {
        if (tenant) setEditingSegments(tenant.segmentTypes as string[])
    }, [tenant])

    const segmentsChanged = !!tenant &&
        JSON.stringify([...editingSegments].sort()) !== JSON.stringify([...(tenant.segmentTypes as string[])].sort())

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

    const handleToggleExempt = async () => {
        if (!tenant) return

        const nextValue = !tenant.isPaymentExempt

        const confirmed = await confirm({
            title: nextValue ? 'Isentar de Pagamento' : 'Revogar Isenção',
            description: nextValue
                ? 'Esta conta deixará de ser cobrada pelo Stripe e nunca será bloqueada por falta de pagamento.'
                : 'Esta conta voltará a depender de uma assinatura Stripe ativa para não ser suspensa.',
            confirmText: nextValue ? 'Isentar' : 'Revogar'
        })

        if (!confirmed) return

        try {
            const res = await fetch(`/api/saas-admin/tenants/${params.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isPaymentExempt: nextValue,
                    reason: nextValue ? 'Isenção de pagamento concedida pelo admin' : 'Isenção de pagamento revogada pelo admin'
                })
            })

            if (res.ok) {
                fetchTenantDetails()
            } else {
                await alert({
                    title: 'Erro',
                    description: 'Erro ao atualizar isenção de pagamento',
                    variant: 'error'
                })
            }
        } catch (error) {
            console.error('Error toggling payment exemption:', error)
            await alert({
                title: 'Erro',
                description: 'Erro ao atualizar isenção de pagamento',
                variant: 'error'
            })
        }
    }

    const handleSaveSegments = async () => {
        if (!tenant || editingSegments.length === 0) return

        const confirmed = await confirm({
            title: 'Alterar Segmentos',
            description: 'Isso vai atualizar a terminologia e os campos exibidos para esse negócio, incluindo os profissionais vinculados.',
            confirmText: 'Salvar'
        })

        if (!confirmed) return

        setSavingSegments(true)
        try {
            const res = await fetch(`/api/saas-admin/tenants/${params.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segmentTypes: editingSegments,
                    reason: 'Segmentos alterados pelo administrador'
                })
            })

            if (res.ok) {
                fetchTenantDetails()
            } else {
                await alert({
                    title: 'Erro',
                    description: 'Erro ao atualizar segmentos',
                    variant: 'error'
                })
            }
        } catch (error) {
            console.error('Error updating segments:', error)
            await alert({
                title: 'Erro',
                description: 'Erro ao atualizar segmentos',
                variant: 'error'
            })
        } finally {
            setSavingSegments(false)
        }
    }

    const handleDeleteTenant = async () => {
        if (!tenant || !deletePassword.trim()) return

        setIsDeleting(true)
        setDeleteError('')

        try {
            const res = await fetch(`/api/saas-admin/tenants/${params.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: deletePassword })
            })

            if (!res.ok) {
                const data = await res.json()
                setDeleteError(data.error || 'Erro ao excluir tenant')
                return
            }

            setDeleteDialogOpen(false)
            toast.success('Tenant excluído permanentemente')
            router.push('/saas-admin/tenants')
        } catch (error) {
            console.error('Error deleting tenant:', error)
            setDeleteError('Erro ao excluir tenant. Tente novamente.')
        } finally {
            setIsDeleting(false)
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
                    variant={tenant.isPaymentExempt ? 'outline' : 'secondary'}
                    onClick={handleToggleExempt}
                >
                    <Gift className="h-4 w-4 mr-1" />
                    {tenant.isPaymentExempt ? 'Revogar Isenção' : 'Isentar de Pagamento'}
                </Button>
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

                        {tenant.isPaymentExempt && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Pagamento:</span>
                                <Badge variant="secondary">Isento</Badge>
                            </div>
                        )}

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
                                    <SelectItem value="BASICO">Básico</SelectItem>
                                    <SelectItem value="PRO">PRO</SelectItem>
                                    <SelectItem value="BUSINESS">Avançado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 border-t pt-4">
                            <label className="text-sm font-medium">Segmentos:</label>
                            <SegmentMultiSelect value={editingSegments} onChange={setEditingSegments} />
                            {segmentsChanged && (
                                <Button
                                    size="sm"
                                    onClick={handleSaveSegments}
                                    disabled={savingSegments || editingSegments.length === 0}
                                    className="w-full sm:w-auto"
                                >
                                    {savingSegments ? 'Salvando...' : 'Salvar Segmentos'}
                                </Button>
                            )}
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
                    <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                            <MetricTile
                                icon={Users}
                                label="Profissionais"
                                value={1 + (tenant.professionals?.length ?? 0)}
                            />
                            <MetricTile icon={CalendarDays} label="Agendamentos" value={tenant._count.appointments} />
                            <MetricTile icon={UserRound} label="Clientes" value={tenant._count.clients} />
                            <MetricTile icon={Briefcase} label="Serviços" value={tenant._count.services} />
                            <MetricTile icon={CalendarRange} label="Agendas" value={tenant._count.schedules} />
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

            <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        Ações irreversíveis. Tenha cuidado ao proceder.
                    </p>
                    <Button
                        variant="destructive"
                        onClick={() => {
                            setDeletePassword('')
                            setDeleteError('')
                            setDeleteDialogOpen(true)
                        }}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir Conta Permanentemente
                    </Button>
                </CardContent>
            </Card>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir conta permanentemente</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3 mt-4">
                            <div>
                                <p className="font-medium text-destructive mb-2">Esta ação é irreversível.</p>
                                <p className="text-sm">
                                    Você está prestes a excluir permanentemente a conta de <strong>{tenant.businessName || tenant.name}</strong>.
                                </p>
                            </div>
                            <div className="rounded-lg bg-muted p-3">
                                <p className="text-xs font-medium mb-2">Será removido:</p>
                                <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
                                    <li>Todos os agendamentos</li>
                                    <li>Todos os clientes</li>
                                    <li>Todos os serviços</li>
                                    <li>Todas as agendas</li>
                                    <li>Todos os profissionais da equipe</li>
                                    <li>Configurações (WhatsApp, fidelidade, etc.)</li>
                                </ul>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Confirme sua senha para continuar
                                </label>
                                <Input
                                    type="password"
                                    placeholder="Sua senha"
                                    value={deletePassword}
                                    onChange={(e) => {
                                        setDeletePassword(e.target.value)
                                        setDeleteError('')
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && deletePassword.trim() && !isDeleting) {
                                            handleDeleteTenant()
                                        }
                                    }}
                                    disabled={isDeleting}
                                />
                                {deleteError && (
                                    <p className="text-xs text-destructive">{deleteError}</p>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>
                            Cancelar
                        </AlertDialogCancel>
                        <button
                            onClick={handleDeleteTenant}
                            disabled={!deletePassword.trim() || isDeleting}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 px-4 py-2"
                        >
                            {isDeleting ? 'Excluindo...' : 'Excluir Permanentemente'}
                        </button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
