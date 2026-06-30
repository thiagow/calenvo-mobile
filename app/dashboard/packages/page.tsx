'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Package, Plus, Trash2, Edit } from 'lucide-react'
import { toast } from 'sonner'
import { useDialog } from '@/components/providers/dialog-provider'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Service {
    id: string
    name: string
    price: number | null
}

interface PackageTemplateItem {
    id: string
    serviceId: string
    totalSessions: number
    service: Service
}

interface PackageTemplate {
    id: string
    name: string
    price: number | null
    isActive: boolean
    items: PackageTemplateItem[]
}

export default function PackagesPage() {
    const router = useRouter()
    const { confirm } = useDialog()

    // Lista
    const [templates, setTemplates] = useState<PackageTemplate[]>([])
    const [services, setServices] = useState<Service[]>([])
    const [loading, setLoading] = useState(true)

    // Form
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [packageName, setPackageName] = useState('')
    const [packagePrice, setPackagePrice] = useState<string>('')
    const [selectedServices, setSelectedServices] = useState<{ serviceId: string, sessions: number }[]>([])

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            setLoading(true)
            const [templatesRes, servicesRes] = await Promise.all([
                fetch('/api/packages'),
                fetch('/api/services')
            ])

            if (templatesRes.ok) {
                const data = await templatesRes.json()
                setTemplates(data)
            }
            if (servicesRes.ok) {
                const data = await servicesRes.json()
                setServices(data.services || data)
            }
        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Erro ao carregar dados.')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: 'Excluir Pacote',
            description: 'Tem certeza que deseja excluir este modelo de pacote? (Pacotes já vendidos não serão afetados)',
            variant: 'destructive',
            confirmText: 'Excluir'
        })

        if (!confirmed) return

        try {
            const response = await fetch(`/api/packages/${id}`, {
                method: 'DELETE'
            })

            if (!response.ok) throw new Error('Erro ao excluir')

            toast.success('Pacote excluído com sucesso!')
            fetchData()
        } catch (error) {
            console.error('Error deleting template:', error)
            toast.error('Erro ao excluir modelo de pacote')
        }
    }

    // Handlers do Form
    const handleAddService = (serviceId: string) => {
        if (!selectedServices.find(s => s.serviceId === serviceId)) {
            setSelectedServices([...selectedServices, { serviceId, sessions: 1 }])
        }
    }

    const handleRemoveService = (serviceId: string) => {
        setSelectedServices(selectedServices.filter(s => s.serviceId !== serviceId))
    }

    const handleChangeSessions = (serviceId: string, sessions: string) => {
        const val = parseInt(sessions) || 1
        setSelectedServices(selectedServices.map(s => s.serviceId === serviceId ? { ...s, sessions: val } : s))
    }

    // Auto-calcula o preço baseando-se nos serviços adicionados
    useEffect(() => {
        let total = 0
        let hasPrice = false
        selectedServices.forEach(ss => {
            const serv = services.find(s => s.id === ss.serviceId)
            if (serv && serv.price) {
                total += serv.price * ss.sessions
                hasPrice = true
            }
        })
        if (hasPrice && !isDialogOpen) {
            // se o form está fechado não atualize (evita loop)
        } else if (hasPrice) {
            setPackagePrice(total.toString())
        }
    }, [selectedServices, services])


    const handleCreatePackage = async () => {
        if (!packageName.trim()) return toast.error('Nome do pacote é obrigatório')
        if (selectedServices.length === 0) return toast.error('Adicione pelo menos um serviço')

        try {
            setIsSubmitting(true)
            const result = await fetch('/api/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: packageName,
                    price: packagePrice ? parseFloat(packagePrice) : null,
                    items: selectedServices.map(s => ({
                        serviceId: s.serviceId,
                        totalSessions: s.sessions
                    }))
                })
            })

            if (result.ok) {
                toast.success('Modelo de Pacote criado com sucesso!')
                setIsDialogOpen(false)
                resetForm()
                fetchData() // recarregar
            } else {
                toast.error('Erro ao salvar o modelo')
            }
        } catch (error) {
            console.error('Error in handleCreate:', error)
            toast.error('Erro de servidor')
        } finally {
            setIsSubmitting(false)
        }
    }

    const resetForm = () => {
        setPackageName('')
        setPackagePrice('')
        setSelectedServices([])
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Catálogo de Pacotes</h1>
                    <p className="text-sm sm:text-base text-gray-600 mt-1">
                        Crie os pacotes que a sua clínica oferece para vender aos seus clientes
                    </p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                            <Plus className="h-4 w-4 mr-2" />
                            Novo Pacote
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl">
                        <DialogHeader>
                            <DialogTitle>Criar Modelo de Pacote</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <Label>Nome do Pacote *</Label>
                                    <Input placeholder="Ex: Pacote 10 Drenagens (Verão)" value={packageName} onChange={e => setPackageName(e.target.value)} />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <Label>Valor Total R$</Label>
                                    <Input type="number" placeholder="Automático" value={packagePrice} onChange={e => setPackagePrice(e.target.value)} />
                                    <p className="text-xs text-gray-500 mt-1">Soma calculada a partir dos serviços.</p>
                                </div>
                            </div>

                            <div className="border-t pt-4 mt-2">
                                <Label className="block mb-2 font-medium">Serviços Inclusos *</Label>
                                <Select onValueChange={handleAddService}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecionar e Adicionar Serviço..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {services.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name} {s.price ? `(R$ ${s.price})` : ''}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                    {selectedServices.length === 0 && (
                                        <p className="text-sm text-gray-400 italic">Nenhum serviço atrelado ainda. Selecione acima.</p>
                                    )}
                                    {selectedServices.map(ss => {
                                        const serv = services.find(s => s.id === ss.serviceId)
                                        return (
                                            <div key={ss.serviceId} className="flex items-center justify-between p-3 bg-gray-50 border rounded-md shadow-sm">
                                                <div className="flex-1 font-medium text-sm text-gray-700">{serv?.name}</div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <Label className="text-xs text-gray-500 uppercase tracking-wider">Sessões:</Label>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            className="w-16 h-8 text-center"
                                                            value={ss.sessions}
                                                            onChange={e => handleChangeSessions(ss.serviceId, e.target.value)}
                                                        />
                                                    </div>
                                                    <Button variant="ghost" size="sm" className="text-red-500 h-8 w-8 p-0 hover:bg-red-50" onClick={() => handleRemoveService(ss.serviceId)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancelar</Button>
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCreatePackage} disabled={isSubmitting}>
                                {isSubmitting ? 'Salvando...' : 'Criar Pacote'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* List */}
            {templates.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Nenhum pacote criado
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Facilite a rotina criando pacotes recorrentes para seus clientes.
                        </p>
                        <Button
                            onClick={() => setIsDialogOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Criar Primeiro Pacote
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map((template) => (
                        <Card key={template.id} className="hover:shadow-lg transition-shadow">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 pr-2">
                                        <CardTitle className="text-lg flex items-center gap-2 mb-1">
                                            {template.name}
                                        </CardTitle>
                                        <div className="text-xs text-gray-500">
                                            {template.items.reduce((acc, i) => acc + i.totalSessions, 0)} sessão(ões) no total
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(template.id)}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {template.price && (
                                    <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                                        R$ {template.price.toFixed(2)}
                                    </Badge>
                                )}

                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Serviços Inclusos:</p>
                                    <ul className="space-y-1">
                                        {template.items.map(item => (
                                            <li key={item.id} className="text-sm flex justify-between items-center text-gray-700">
                                                <span>{item.service.name}</span>
                                                <span className="font-medium text-blue-600">{item.totalSessions}x</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
