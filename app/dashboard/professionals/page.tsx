
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Users, Plus, Search, Edit, Trash2, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Professional {
  id: string
  name: string
  email: string
  whatsapp: string
  image?: string
  isActive: boolean
  createdAt: string
  role: string
  scheduleProfessionals?: any[]
}

export default function ProfessionalsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; professionalId: string | null }>({
    open: false,
    professionalId: null
  })
  const [userPlan, setUserPlan] = useState<string>('FREEMIUM')
  const [canAddMore, setCanAddMore] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    fetchProfessionals()
    fetchUserPlan()
  }, [status, router])

  const fetchUserPlan = async () => {
    try {
      const response = await fetch('/api/user/plan')
      if (response.ok) {
        const data = await response.json()
        setUserPlan(data.planType)
        
        // Verificar se pode adicionar mais profissionais
        const planLimits: any = {
          FREEMIUM: 1,
          STANDARD: 5,
          PREMIUM: -1 // Ilimitado
        }
        
        const limit = planLimits[data.planType] || 1
        const currentCount = professionals.length + 1 // +1 para o master
        
        setCanAddMore(limit === -1 || currentCount < limit)
      }
    } catch (error) {
      console.error('Error fetching user plan:', error)
    }
  }

  const fetchProfessionals = async () => {
    try {
      const response = await fetch('/api/professionals')
      
      if (response.status === 403) {
        toast.error('Acesso negado. Apenas usuários master podem gerenciar profissionais.')
        router.push('/dashboard')
        return
      }
      
      if (!response.ok) throw new Error('Erro ao carregar profissionais')
      
      const data = await response.json()
      setProfessionals(data)
    } catch (error) {
      console.error('Error fetching professionals:', error)
      toast.error('Erro ao carregar profissionais')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/professionals/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao deletar profissional')
      }

      toast.success('Profissional deletado com sucesso')
      fetchProfessionals()
      setDeleteDialog({ open: false, professionalId: null })
    } catch (error) {
      console.error('Error deleting professional:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao deletar profissional')
    }
  }

  const handleToggleActive = async (professional: Professional) => {
    try {
      const response = await fetch(`/api/professionals/${professional.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !professional.isActive
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar profissional')
      }

      toast.success(`Profissional ${!professional.isActive ? 'ativado' : 'desativado'} com sucesso`)
      fetchProfessionals()
    } catch (error) {
      console.error('Error toggling professional status:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar profissional')
    }
  }

  const filteredProfessionals = professionals.filter(prof =>
    prof.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prof.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prof.whatsapp?.includes(searchTerm)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6" />
            Profissionais da Equipe
          </h1>
          <p className="text-gray-600 mt-1">
            Gerencie os profissionais da sua equipe
          </p>
        </div>
        <Button
          onClick={() => router.push('/dashboard/professionals/new')}
          className="bg-blue-600 hover:bg-blue-700"
          disabled={!canAddMore}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Profissional
        </Button>
      </div>

      {!canAddMore && userPlan !== 'PREMIUM' && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm text-amber-800">
              ⚠️ Você atingiu o limite de profissionais do plano {userPlan}. 
              <Button variant="link" className="text-amber-900 underline p-0 ml-1">
                Faça upgrade para adicionar mais profissionais
              </Button>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar por nome, e-mail ou WhatsApp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Professionals List */}
      {filteredProfessionals.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'Nenhum profissional encontrado' : 'Nenhum profissional cadastrado'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm 
                ? 'Tente buscar com outros termos' 
                : 'Comece adicionando profissionais à sua equipe'}
            </p>
            {!searchTerm && canAddMore && (
              <Button
                onClick={() => router.push('/dashboard/professionals/new')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Profissional
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProfessionals.map((professional) => (
            <Card key={professional.id} className={!professional.isActive ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{professional.name}</CardTitle>
                      <CardDescription className="text-xs">{professional.email}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={professional.isActive ? "default" : "secondary"}>
                    {professional.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-gray-600">
                  <p>📱 {professional.whatsapp || 'Sem WhatsApp'}</p>
                  {professional.scheduleProfessionals && professional.scheduleProfessionals.length > 0 && (
                    <p className="mt-2 text-xs text-blue-600">
                      Vinculado a {professional.scheduleProfessionals.length} agenda(s)
                    </p>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/dashboard/professionals/${professional.id}`)}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(professional)}
                    className={professional.isActive ? 'text-amber-600 hover:text-amber-700' : 'text-green-600 hover:text-green-700'}
                  >
                    {professional.isActive ? (
                      <UserX className="h-4 w-4" />
                    ) : (
                      <UserCheck className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteDialog({ open: true, professionalId: professional.id })}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este profissional? Esta ação não pode ser desfeita.
              Os agendamentos vinculados a este profissional serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog.professionalId && handleDelete(deleteDialog.professionalId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
