'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Eye, Lock, Unlock } from 'lucide-react'
import { useDialog } from '@/components/providers/dialog-provider'

interface Tenant {
    id: string
    name: string | null
    email: string
    businessName: string | null
    segmentType: string
    planType: string
    isActive: boolean
    createdAt: string
    _count: {
        professionals: number
    }
}

export default function TenantsPage() {
    const router = useRouter()
    const { confirm, alert } = useDialog()
    const [tenants, setTenants] = useState<Tenant[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)

    useEffect(() => {
        fetchTenants()
    }, [page, search])

    const fetchTenants = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20'
            })

            if (search) {
                params.append('search', search)
            }

            const res = await fetch(`/api/saas-admin/tenants?${params}`)
            if (res.ok) {
                const data = await res.json()
                setTenants(data.tenants)
                setTotal(data.pagination.total)
            }
        } catch (error) {
            console.error('Error fetching tenants:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleToggleStatus = async (tenantId: string, currentStatus: boolean) => {
        const confirmed = await confirm({
            title: currentStatus ? 'Bloquear Cliente' : 'Desbloquear Cliente',
            description: `Tem certeza que deseja ${currentStatus ? 'bloquear' : 'desbloquear'} este cliente?`,
            variant: currentStatus ? 'destructive' : 'default',
            confirmText: currentStatus ? 'Bloquear' : 'Desbloquear'
        })

        if (!confirmed) return

        try {
            const res = await fetch(`/api/saas-admin/tenants/${tenantId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isActive: !currentStatus,
                    reason: currentStatus ? 'Bloqueado pelo admin' : 'Desbloqueado pelo admin'
                })
            })

            if (res.ok) {
                fetchTenants()
            } else {
                await alert({
                    title: 'Erro',
                    description: 'Erro ao atualizar status do cliente',
                    variant: 'error'
                })
            }
        } catch (error) {
            console.error('Error toggling tenant status:', error)
            await alert({
                title: 'Erro',
                description: 'Erro ao atualizar status do cliente',
                variant: 'error'
            })
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Clientes</h1>
                    <p className="text-muted-foreground">Gerenciar donos de negócio cadastrados</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nome, email ou negócio..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value)
                                    setPage(1)
                                }}
                                className="pl-10"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                    ) : tenants.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</div>
                    ) : (
                        <div className="space-y-4">
                            {tenants.map((tenant) => (
                                <div
                                    key={tenant.id}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold">{tenant.businessName || tenant.name || 'Sem nome'}</h3>
                                            <Badge variant={tenant.isActive ? 'default' : 'destructive'}>
                                                {tenant.isActive ? 'Ativo' : 'Bloqueado'}
                                            </Badge>
                                            <Badge variant="outline">{tenant.planType}</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{tenant.email}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {tenant._count.professionals} profissionais • {tenant.segmentType}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => router.push(`/saas-admin/tenants/${tenant.id}`)}
                                        >
                                            <Eye className="h-4 w-4 mr-1" />
                                            Detalhes
                                        </Button>
                                        <Button
                                            variant={tenant.isActive ? 'destructive' : 'default'}
                                            size="sm"
                                            onClick={() => handleToggleStatus(tenant.id, tenant.isActive)}
                                        >
                                            {tenant.isActive ? (
                                                <>
                                                    <Lock className="h-4 w-4 mr-1" />
                                                    Bloquear
                                                </>
                                            ) : (
                                                <>
                                                    <Unlock className="h-4 w-4 mr-1" />
                                                    Desbloquear
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Paginação simples */}
                    {!loading && tenants.length > 0 && (
                        <div className="flex items-center justify-between mt-6">
                            <p className="text-sm text-muted-foreground">
                                Total: {total} clientes
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={tenants.length < 20}
                                >
                                    Próxima
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
