import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, CheckCircle2, CircleDashed, Users } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function PackagesReport() {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
        redirect('/login')
    }

    const userId = (session.user as any).id

    // Busca apenas pacotes ativos (conforme requisito)
    const activePackages = await prisma.clientPackage.findMany({
        where: {
            userId: userId,
            status: 'ACTIVE'
        },
        include: {
            client: {
                select: {
                    id: true,
                    name: true,
                    phone: true
                }
            },
            items: {
                include: {
                    service: {
                        select: { name: true }
                    }
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    })

    // Calcular KPI's
    const totalPackages = activePackages.length

    let totalSessions = 0
    let usedSessions = 0

    activePackages.forEach((pkg: any) => {
        pkg.items.forEach((item: any) => {
            totalSessions += item.totalSessions
            usedSessions += item.usedSessions
        })
    })

    const remainingSessions = totalSessions - usedSessions
    const usagePercentage = totalSessions > 0 ? Math.round((usedSessions / totalSessions) * 100) : 0

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-blue-100 bg-blue-50/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-800">
                            Pacotes Ativos
                        </CardTitle>
                        <Package className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-900">{totalPackages}</div>
                        <p className="text-xs text-blue-600 mt-1">Vendidos em andamento</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-700">
                            Total de Sessões
                        </CardTitle>
                        <div className="h-4 w-4 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-500">
                            ∑
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{totalSessions}</div>
                        <p className="text-xs text-gray-500 mt-1">Sessões compradas ao todo</p>
                    </CardContent>
                </Card>
                <Card className="border-green-100 bg-green-50/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-green-800">
                            Sessões Realizadas
                        </CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-900">{usedSessions}</div>
                        <p className="text-xs text-green-600 mt-1">{usagePercentage}% das sessões concluídas</p>
                    </CardContent>
                </Card>
                <Card className="border-orange-100 bg-orange-50/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-orange-800">
                            Sessões Restantes
                        </CardTitle>
                        <CircleDashed className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-900">{remainingSessions}</div>
                        <p className="text-xs text-orange-600 mt-1">Ainda a serem agendadas</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabela de Listagem */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Detalhamento dos Pacotes Ativos</CardTitle>
                </CardHeader>
                <CardContent>
                    {activePackages.length === 0 ? (
                        <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed">
                            <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                            <h3 className="text-lg font-medium text-gray-900">Nenhum pacote ativo</h3>
                            <p className="text-sm text-gray-500">Os pacotes vendidos aos clientes aparecerão aqui.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-600 uppercase bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Paciente / Cliente</th>
                                        <th className="px-4 py-3 font-medium">Pacote</th>
                                        <th className="px-4 py-3 font-medium">Andamento das Sessões</th>
                                        <th className="px-4 py-3 font-medium text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activePackages.map((pkg) => {
                                        // Somar progresso desse pacote específico
                                        const pkgTotal = pkg.items.reduce((acc: number, i: any) => acc + i.totalSessions, 0)
                                        const pkgUsed = pkg.items.reduce((acc: number, i: any) => acc + i.usedSessions, 0)
                                        const pkgPct = pkgTotal > 0 ? Math.round((pkgUsed / pkgTotal) * 100) : 0

                                        return (
                                            <tr key={pkg.id} className="border-b hover:bg-gray-50/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-gray-900">{pkg.client.name}</div>
                                                    <div className="text-xs text-gray-500">{pkg.client.phone}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-blue-700">{pkg.name}</div>
                                                    {pkg.price !== null && (
                                                        <div className="text-xs text-green-600 font-medium">R$ {parseFloat(pkg.price.toString()).toFixed(2)}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="max-w-[200px]">
                                                        <div className="flex justify-between text-xs mb-1">
                                                            <span className="font-medium">{pkgPct}% Concluído</span>
                                                            <span className="text-gray-500">{pkgUsed} de {pkgTotal}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${pkgPct}%` }}></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Link href={`/dashboard/patients/${pkg.client.id}/packages`}>
                                                        <Button size="sm" variant="outline" className="text-xs">
                                                            <Users className="h-3 w-3 mr-1" />
                                                            Gerenciar
                                                        </Button>
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
