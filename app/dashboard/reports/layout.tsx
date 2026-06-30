'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    BarChart3,
    Trophy,
    UserMinus,
    DollarSign,
    Package
} from 'lucide-react'

export default function ReportsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
                    <p className="text-gray-600 mt-1">
                        Análise detalhada do desempenho dos seus agendamentos e clientes
                    </p>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    <BarChart3 className="mr-1 h-3 w-3" />
                    Métricas
                </Badge>
            </div>

            {/* Navegação por Abas Centralizada */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-2">
                        <Link href="/dashboard/reports">
                            <Button
                                variant={pathname === '/dashboard/reports' ? 'default' : 'outline'}
                                size="sm"
                                className="gap-2"
                            >
                                <BarChart3 className="h-4 w-4" />
                                Visão Geral
                            </Button>
                        </Link>
                        <Link href="/dashboard/reports/top-clients">
                            <Button
                                variant={pathname === '/dashboard/reports/top-clients' ? 'default' : 'outline'}
                                size="sm"
                                className="gap-2"
                            >
                                <Trophy className="h-4 w-4" />
                                Top Clientes
                            </Button>
                        </Link>
                        <Link href="/dashboard/reports/inactive-clients">
                            <Button
                                variant={pathname === '/dashboard/reports/inactive-clients' ? 'default' : 'outline'}
                                size="sm"
                                className="gap-2"
                            >
                                <UserMinus className="h-4 w-4" />
                                Clientes Inativos
                            </Button>
                        </Link>
                        <Link href="/dashboard/reports/ltv">
                            <Button
                                variant={pathname === '/dashboard/reports/ltv' ? 'default' : 'outline'}
                                size="sm"
                                className="gap-2"
                            >
                                <DollarSign className="h-4 w-4" />
                                LTV
                            </Button>
                        </Link>
                        <Link href="/dashboard/reports/packages">
                            <Button
                                variant={pathname === '/dashboard/reports/packages' ? 'default' : 'outline'}
                                size="sm"
                                className="gap-2"
                            >
                                <Package className="h-4 w-4" />
                                Pacotes
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* Content Render */}
            <div className="pt-2">
                {children}
            </div>
        </div>
    )
}
