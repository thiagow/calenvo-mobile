'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function LogsPage() {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchLogs()
    }, [])

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/saas-admin/audit-logs')
            if (res.ok) {
                const data = await res.json()
                setLogs(data.logs)
            }
        } catch (error) {
            console.error('Error fetching logs:', error)
        } finally {
            setLoading(false)
        }
    }

    const getActionColor = (action: string) => {
        if (action.includes('BLOCKED')) return 'destructive'
        if (action.includes('UNBLOCKED')) return 'default'
        return 'secondary'
    }

    const getActionLabel = (action: string) => {
        const labels: Record<string, string> = {
            'TENANT_BLOCKED': 'Tenant Bloqueado',
            'TENANT_UNBLOCKED': 'Tenant Desbloqueado',
            'ADMIN_LOGIN': 'Login Admin'
        }
        return labels[action] || action
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Logs de Auditoria</h1>
                <p className="text-muted-foreground">Histórico de ações administrativas</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Ações Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">Nenhum log encontrado</div>
                    ) : (
                        <div className="space-y-3">
                            {logs.map((log) => (
                                <div
                                    key={log.id}
                                    className="flex items-start justify-between p-3 border rounded-lg"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={getActionColor(log.action)}>
                                                {getActionLabel(log.action)}
                                            </Badge>
                                            <span className="text-sm text-muted-foreground">
                                                {new Date(log.createdAt).toLocaleString('pt-BR')}
                                            </span>
                                        </div>
                                        {log.details && (
                                            <div className="mt-2 text-sm">
                                                {log.details.tenantName && (
                                                    <p>Tenant: <span className="font-medium">{log.details.tenantName}</span></p>
                                                )}
                                                {log.details.tenantEmail && (
                                                    <p className="text-muted-foreground">{log.details.tenantEmail}</p>
                                                )}
                                                {log.details.reason && (
                                                    <p className="text-muted-foreground italic">Motivo: {log.details.reason}</p>
                                                )}
                                            </div>
                                        )}
                                        {log.ipAddress && (
                                            <p className="text-xs text-muted-foreground mt-1">IP: {log.ipAddress}</p>
                                        )}
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
