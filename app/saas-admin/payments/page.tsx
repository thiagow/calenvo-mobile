'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

export default function PaymentsPage() {
    const [payments, setPayments] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchPayments()
    }, [])

    const fetchPayments = async () => {
        try {
            const res = await fetch('/api/saas-admin/payments')
            if (res.ok) {
                const data = await res.json()
                setPayments(data.payments)
            }
        } catch (error) {
            console.error('Error fetching payments:', error)
        } finally {
            setLoading(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return 'default'
            case 'open': return 'secondary'
            case 'void': return 'destructive'
            default: return 'outline'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'paid': return 'Pago'
            case 'open': return 'Aberto'
            case 'void': return 'Cancelado'
            case 'uncollectible': return 'Não cobrável'
            default: return status
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Pagamentos</h1>
                <p className="text-muted-foreground">Transações processadas via Stripe</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Histórico de Transações</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                    ) : payments.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">Nenhum pagamento encontrado</div>
                    ) : (
                        <div className="space-y-4">
                            {payments.map((payment) => (
                                <div
                                    key={payment.id}
                                    className="flex items-center justify-between p-4 border rounded-lg"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold">
                                                {payment.tenant?.businessName || payment.tenant?.name || 'Tenant não identificado'}
                                            </h3>
                                            <Badge variant={getStatusColor(payment.status)}>
                                                {getStatusLabel(payment.status)}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {payment.tenant?.email || 'Email não disponível'}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {new Date(payment.created).toLocaleDateString('pt-BR')}
                                            {payment.periodStart && payment.periodEnd && (
                                                <> • Período: {new Date(payment.periodStart).toLocaleDateString('pt-BR')} - {new Date(payment.periodEnd).toLocaleDateString('pt-BR')}</>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="font-bold text-lg">
                                                R$ {payment.amount.toFixed(2)}
                                            </p>
                                            <p className="text-xs text-muted-foreground uppercase">{payment.currency}</p>
                                        </div>
                                        {payment.hostedInvoiceUrl && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => window.open(payment.hostedInvoiceUrl, '_blank')}
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </Button>
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
