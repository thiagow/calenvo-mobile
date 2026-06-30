
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Stethoscope,
  Search,
  MoreVertical,
  Trash2,
  Edit,
  Plus,
  Clock
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useDialog } from '@/components/providers/dialog-provider'

interface Specialty {
  id: string
  name: string
  description?: string
  duration: number // duração padrão em minutos
  active: boolean
  color: string
}

const COLORS = [
  { value: '#3B82F6', label: 'Azul' },
  { value: '#10B981', label: 'Verde' },
  { value: '#F59E0B', label: 'Amarelo' },
  { value: '#EF4444', label: 'Vermelho' },
  { value: '#8B5CF6', label: 'Roxo' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#6366F1', label: 'Índigo' },
  { value: '#14B8A6', label: 'Teal' },
]

export default function SpecialtiesPage() {
  const { data: session } = useSession() || {}
  const { confirm } = useDialog()
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSpecialty, setEditingSpecialty] = useState<Specialty | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: 30,
    active: true,
    color: '#3B82F6'
  })

  // Mock data - Em produção, virá do banco de dados
  useEffect(() => {
    const mockSpecialties: Specialty[] = [
      {
        id: '1',
        name: 'Cardiologia',
        description: 'Especialidade médica que trata do coração e sistema cardiovascular',
        duration: 45,
        active: true,
        color: '#EF4444'
      },
      {
        id: '2',
        name: 'Dermatologia',
        description: 'Especialidade que cuida da saúde da pele, cabelos e unhas',
        duration: 30,
        active: true,
        color: '#EC4899'
      },
      {
        id: '3',
        name: 'Ortopedia',
        description: 'Especialidade médica que cuida do sistema locomotor',
        duration: 40,
        active: true,
        color: '#3B82F6'
      },
      {
        id: '4',
        name: 'Pediatria',
        description: 'Especialidade médica dedicada à saúde de crianças e adolescentes',
        duration: 30,
        active: true,
        color: '#10B981'
      },
      {
        id: '5',
        name: 'Clínico Geral',
        description: 'Atendimento médico geral e acompanhamento de saúde',
        duration: 30,
        active: true,
        color: '#8B5CF6'
      },
      {
        id: '6',
        name: 'Neurologia',
        description: 'Especialidade que trata de doenças do sistema nervoso',
        duration: 50,
        active: true,
        color: '#6366F1'
      }
    ]
    setSpecialties(mockSpecialties)
  }, [])

  const filteredSpecialties = specialties.filter(specialty =>
    specialty.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    specialty.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleOpenDialog = (specialty?: Specialty) => {
    if (specialty) {
      setEditingSpecialty(specialty)
      setFormData({
        name: specialty.name,
        description: specialty.description || '',
        duration: specialty.duration,
        active: specialty.active,
        color: specialty.color
      })
    } else {
      setEditingSpecialty(null)
      setFormData({
        name: '',
        description: '',
        duration: 30,
        active: true,
        color: '#3B82F6'
      })
    }
    setIsDialogOpen(true)
  }

  const handleSave = () => {
    if (!formData.name) {
      toast.error('Nome da especialidade é obrigatório')
      return
    }

    if (editingSpecialty) {
      // Update existing specialty
      setSpecialties(prev =>
        prev.map(s =>
          s.id === editingSpecialty.id
            ? { ...s, ...formData }
            : s
        )
      )
      toast.success('Especialidade atualizada com sucesso!')
    } else {
      // Create new specialty
      const newSpecialty: Specialty = {
        id: Date.now().toString(),
        ...formData
      }
      setSpecialties(prev => [...prev, newSpecialty])
      toast.success('Especialidade cadastrada com sucesso!')
    }

    setIsDialogOpen(false)
  }

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Excluir Especialidade',
      description: 'Tem certeza que deseja excluir esta especialidade?',
      variant: 'destructive',
      confirmText: 'Excluir'
    })

    if (confirmed) {
      setSpecialties(prev => prev.filter(s => s.id !== id))
      toast.success('Especialidade excluída com sucesso!')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Especialidades</h1>
          <p className="text-gray-600 mt-1">
            Gerencie as especialidades médicas da sua clínica
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Nova Especialidade
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar especialidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Specialties List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSpecialties.map((specialty) => (
          <Card key={specialty.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div
                    className="p-2 rounded-full"
                    style={{ backgroundColor: `${specialty.color}20` }}
                  >
                    <Stethoscope
                      className="h-5 w-5"
                      style={{ color: specialty.color }}
                    />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{specialty.name}</CardTitle>
                    {specialty.description && (
                      <CardDescription className="mt-1 line-clamp-2">
                        {specialty.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenDialog(specialty)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => handleDelete(specialty.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-3 w-3" />
                Duração padrão: {specialty.duration} minutos
              </div>
              <div className="pt-2">
                <Badge variant={specialty.active ? 'default' : 'secondary'}>
                  {specialty.active ? 'Ativa' : 'Inativa'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSpecialties.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Stethoscope className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma especialidade encontrada
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm
                ? 'Tente ajustar os filtros de busca'
                : 'Comece adicionando uma nova especialidade'}
            </p>
            {!searchTerm && (
              <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Especialidade
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog for Add/Edit */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSpecialty ? 'Editar Especialidade' : 'Nova Especialidade'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da especialidade médica
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Cardiologia"
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Breve descrição da especialidade"
              />
            </div>
            <div>
              <Label htmlFor="duration">Duração Padrão (minutos)</Label>
              <Input
                id="duration"
                type="number"
                min="15"
                step="5"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="color">Cor</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`h-10 rounded-md border-2 transition-all ${formData.color === color.value
                        ? 'border-gray-900 scale-110'
                        : 'border-gray-200'
                      }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              {editingSpecialty ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
