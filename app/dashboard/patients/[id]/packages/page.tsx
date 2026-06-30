'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Package, Plus, Phone, Mail, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { useSegmentConfig } from '@/contexts/segment-context'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClientPackage } from '@/app/actions/packages'

interface ClientInfo {
    id: string
    name: string
    phone: string
    email: string | null
}

interface PackageItem {
    id: string
    serviceName: string
    serviceId: string
    totalSessions: number
    usedSessions: number
}

interface ClientPackage {
    id: string
    name: string
    price: number | null
    status: 'ACTIVE' | 'EXHAUSTED' | 'CANCELLED'
    createdAt: string
    items: PackageItem[]
}

interface PackageTemplateItem {
    id: string
    serviceId: string
    totalSessions: number
    service: {
        id: string
        name: string
        price: number | null
    }
}

interface PackageTemplate {
    id: string
    name: string
    price: number | null
    isActive: boolean
    items: PackageTemplateItem[]
}

export default function ClientPackagesPage() {
    const params = useParams()
    const router = useRouter()
    const clientId = params.id as string
    const { config: segmentConfig } = useSegmentConfig()

    const [client, setClient] = useState<ClientInfo | null>(null)
    const [packages, setPackages] = useState<ClientPackage[]>([])
    const [templates, setTemplates] = useState<PackageTemplate[]>([])
    const [loading, setLoading] = useState(true)

    // modal states
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
    const [salePrice, setSalePrice] = useState<string>('')

    const t = segmentConfig.terminology

    const fetchData = async () => {
        try {
            setLoading(true)
            const [clientRes, packagesRes, templatesRes] = await Promise.all([
                fetch(`/api/clients/${clientId}`),
                fetch(`/api/clients/${clientId}/packages`),
                fetch('/api/packages')
            ])

            if (clientRes.ok) {
                const data = await clientRes.json()
                setClient(data.client || data)
            }
            if (packagesRes.ok) {
                const data = await packagesRes.json()
                setPackages(data.packages || [])
            }
            if (templatesRes.ok) {
                const data = await templatesRes.json()
                setTemplates(data)
            }
        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Erro ao carregar os dados.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (clientId) {
            fetchData()
        }
    }, [clientId])

    // Atualiza o valor default com base no template escolhido
    useEffect(() => {
        if (selectedTemplateId) {
            const tmpl = templates.find(t => t.id === selectedTemplateId)
            if (tmpl && tmpl.price !== null) {
                setSalePrice(tmpl.price.toString())
            } else {
                setSalePrice('')
            }
        } else {
            setSalePrice('')
        }
    }, [selectedTemplateId, templates])

    const handleCreatePackage = async () => {
        if (!selectedTemplateId) return toast.error('Selecione um template de pacote')

        const selectedTemplate = templates.find(t => t.id === selectedTemplateId)
        if (!selectedTemplate) return toast.error('Template inválido')

        try {
            setIsSubmitting(true)

            // Deep copy do Template para transformar no ClientPackage vendido
            const itemsPayload = selectedTemplate.items.map(item => ({
                serviceId: item.serviceId,
                totalSessions: item.totalSessions
            }))

            const result = await createClientPackage({
                clientId,
                name: selectedTemplate.name,
                price: salePrice ? parseFloat(salePrice) : null,
                items: itemsPayload
            })

            if (result.success) {
                toast.success('Pacote vendido e vinculado com sucesso!')
                setIsDialogOpen(false)
                setSelectedTemplateId('')
                setSalePrice('')
                fetchData() // recarregar pacotes
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            console.error('Error in handleCreate:', error)
            toast.error('Erro de servidor ao processar venda')
        } finally {
            setIsSubmitting(false)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Ativo</Badge>
            case 'EXHAUSTED': return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-200">Finalizado</Badge>
            case 'CANCELLED': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">Cancelado</Badge>
            default: return null
        }
    }

    if (loading && !client) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/patients')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Pacotes e Contratos</h1>
                        {client && (
                            <div className="flex flex-wrap items-center gap-4 mt-1">
                                <span className="text-gray-600 font-medium">{client.name}</span>
                                {client.phone && (
                                    <span className="flex items-center gap-1 text-sm text-gray-500">
                                        <Phone className="h-3 w-3" /> {client.phone}
                                    </span>
                                )}
                                {client.email && (
                                    <span className="flex items-center gap-1 text-sm text-gray-500">
                                        <Mail className="h-3 w-3" /> {client.email}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open)
                    if (!open) {
                        setSelectedTemplateId('')
                        setSalePrice('')
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="h-4 w-4 mr-2" />
                            Vincular Pacote
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Vincular Novo Pacote</DialogTitle>
                        </DialogHeader>

                        {templates.length === 0 ? (
                            <div className="py-8 text-center bg-yellow-50 rounded-md border border-yellow-200 text-yellow-800">
                                <FileText className="h-10 w-10 mx-auto mb-2 text-yellow-500" />
                                <p className="mb-4">Você ainda não tem nenhum modelo de pacote cadastrado.</p>
                                <Button onClick={() => router.push('/dashboard/packages')} variant="outline" className="border-yellow-400 text-yellow-700 hover:bg-yellow-100">
                                    Acessar Catálogo de Pacotes
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-4 py-4">
                                <div className="space-y-4">
                                    <div>
                                        <Label className="block mb-2 font-medium">Selecione o Pacote *</Label>
                                        <Select onValueChange={setSelectedTemplateId} value={selectedTemplateId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Escolha um pacote do catálogo..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {templates.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>
                                                        {t.name} {t.price ? `(R$ ${t.price})` : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {selectedTemplateId && (() => {
                                        const tmpl = templates.find(t => t.id === selectedTemplateId)
                                        if (!tmpl) return null
                                        return (
                                            <div className="bg-gray-50 p-4 rounded-md border text-sm mt-2">
                                                <Label className="text-gray-500 uppercase tracking-wider text-xs mb-2 block">Resumo do Módulo Incluído</Label>
                                                <ul className="space-y-1 mb-4">
                                                    {tmpl.items.map(i => (
                                                        <li key={i.id} className="flex justify-between text-gray-700">
                                                            <span>{i.service.name}</span>
                                                            <span className="font-semibold text-blue-600">{i.totalSessions}x</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                                <div>
                                                    <Label className="block mb-2">Valor de Venda Acordado (R$)</Label>
                                                    <Input
                                                        type="number"
                                                        placeholder="Ex: 1500"
                                                        value={salePrice}
                                                        onChange={e => setSalePrice(e.target.value)}
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">Este valor pode ser diferente do catálogo em caso de descontos negociados na hora da venda.</p>
                                                </div>
                                            </div>
                                        )
                                    })()}
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancelar</Button>
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCreatePackage} disabled={isSubmitting || templates.length === 0 || !selectedTemplateId}>
                                {isSubmitting ? 'Processando venda...' : 'Confirmar Venda'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {packages.length === 0 && !loading && (
                    <div className="col-span-full py-16 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed hover:bg-gray-100 transition-colors">
                        <Package className="h-14 w-14 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhum pacote vinculado</h3>
                        <p className="text-sm">Vincule um pacote ao cliente para realizar o abatimento de suas sessões de serviço.</p>
                    </div>
                )}
                {packages.map(pkg => (
                    <Card key={pkg.id} className={`transition-all hover:shadow-md ${pkg.status !== 'ACTIVE' ? 'opacity-80 bg-gray-50/50' : 'border-blue-100'}`}>
                        <CardHeader className="pb-3 border-b bg-gray-50/50">
                            <div className="flex justify-between items-start gap-2">
                                <div>
                                    <CardTitle className="text-lg leading-tight mb-1" title={pkg.name}>{pkg.name}</CardTitle>
                                    <div className="text-xs text-gray-500">
                                        Data de Início: {new Date(pkg.createdAt).toLocaleDateString('pt-BR')}
                                    </div>
                                </div>
                                <div className="shrink-0">{getStatusBadge(pkg.status)}</div>
                            </div>
                            {pkg.price !== null && (
                                <div className="mt-2 text-sm font-semibold text-green-700 bg-green-50 w-fit px-2 py-0.5 rounded-full border border-green-100">
                                    R$ {parseFloat(pkg.price.toString()).toFixed(2)}
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="space-y-4">
                                {pkg.items.map(item => {
                                    const isComplete = item.usedSessions >= item.totalSessions
                                    const percentage = Math.min(((item.usedSessions / item.totalSessions) * 100), 100)
                                    return (
                                        <div key={item.id} className="space-y-1.5">
                                            <div className="flex justify-between text-sm items-center">
                                                <span className={`font-medium truncate pr-2 ${isComplete ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                                    {item.serviceName}
                                                </span>
                                                <span className={`font-semibold shrink-0 ${isComplete ? 'text-green-600' : 'text-blue-600'}`}>
                                                    {item.usedSessions} / {item.totalSessions}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-200">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
