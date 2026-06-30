
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  Calendar,
  Users,
  User,
  History,
  Package
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { useSegmentConfig } from '@/contexts/segment-context'
import { BRAZILIAN_STATES } from '@/lib/brazilian-states'

interface Patient {
  id: string
  name: string
  email: string | null
  phone: string
  cpf: string | null
  birthDate: string | null
  address: string | null
  city: string | null
  state: string | null
  notes?: string | null
  createdAt: string
  appointmentsCount: number
  loyaltyPoints?: number | null
}

interface ClientStats {
  totalClients: number
  newClientsThisMonth: number
  totalAppointments: number
}

export default function PatientsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { config: segmentConfig, isLoading: segmentLoading } = useSegmentConfig()
  const [patients, setPatients] = useState<Patient[]>([])
  const [stats, setStats] = useState<ClientStats>({
    totalClients: 0,
    newClientsThisMonth: 0,
    totalAppointments: 0
  })
  const [loading, setLoading] = useState(true)
  const [loyaltyActive, setLoyaltyActive] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    birthDate: '',
    address: '',
    city: '',
    state: '',
    gender: '',
    notes: ''
  })

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      cpf: '',
      birthDate: '',
      address: '',
      city: '',
      state: '',
      gender: '',
      notes: ''
    })
    setIsEditMode(false)
    setSelectedPatient(null)
  }

  const handleEditClient = (patient: Patient) => {
    setFormData({
      name: patient.name,
      email: patient.email || '',
      phone: patient.phone,
      cpf: patient.cpf || '',
      birthDate: patient.birthDate ? new Date(patient.birthDate).toISOString().split('T')[0] : '',
      address: patient.address || '',
      city: patient.city || '',
      state: patient.state || '',
      gender: '',
      notes: patient.notes || ''
    })
    setSelectedPatient(patient)
    setIsEditMode(true)
    setIsDialogOpen(true)
  }

  const handleSaveClient = async () => {
    try {
      if (!formData.name || !formData.phone) {
        toast.error('Preencha os campos obrigatórios')
        return
      }

      setLoading(true)

      const url = isEditMode && selectedPatient
        ? `/api/clients/${selectedPatient.id}`
        : '/api/clients'

      const method = isEditMode ? 'PUT' : 'POST'

      // Limpar campos vazios para evitar envio de strings vazias onde deveria ser null/undefined se necessário
      // Mas para simplificar, enviamos como string vazia se a API aceitar, ou null
      const payload = {
        ...formData,
        email: formData.email || null,
        cpf: formData.cpf || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        notes: formData.notes || null,
        birthDate: formData.birthDate || null
      }

      console.log('Sending payload:', payload)

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Server error:', errorData)
        throw new Error(errorData.error || 'Erro ao salvar cliente')
      }

      toast.success(isEditMode ? 'Cliente atualizado com sucesso!' : 'Cliente criado com sucesso!')
      setIsDialogOpen(false)
      resetForm()

      // Refresh list
      const updatedResponse = await fetch('/api/clients/stats')
      if (updatedResponse.ok) {
        const data = await updatedResponse.json()
        setPatients(data.clients || [])
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error saving client:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar cliente')
    } finally {
      setLoading(false)
    }
  }

  // Buscar dados reais do banco
  useEffect(() => {
    const fetchClientsData = async () => {
      try {
        const response = await fetch('/api/clients/stats')
        if (response.ok) {
          const data = await response.json()
          setPatients(data.clients || [])
          setStats(data.stats)
          setLoyaltyActive(data.loyaltyActive || false)
        }
      } catch (error) {
        console.error('Error fetching clients data:', error)
        toast.error('Erro ao carregar dados dos clientes')
      } finally {
        setLoading(false)
      }
    }

    fetchClientsData()
  }, [])

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (patient.email && patient.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    patient.phone.includes(searchTerm)
  )

  // Terminologia dinâmica
  const t = segmentConfig.terminology

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.clients}</h1>
          <p className="text-gray-600">Gerencie {t.clients === 'Pacientes' ? 'seus pacientes' : `seus ${t.clients.toLowerCase()}`} e histórico</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              {t.client === 'Paciente' ? 'Novo Paciente' : `Novo ${t.client}`}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Editar' : 'Novo'} {t.client === 'Paciente' ? 'Paciente' : t.client}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  placeholder="Digite o nome completo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="phone">WhatsApp *</Label>
                <Input
                  id="phone"
                  placeholder="(11) 99999-9999"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="birthDate">Data de Nascimento</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="gender">Sexo</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData({ ...formData, gender: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  placeholder="Rua, número, complemento"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  placeholder="Nome da cidade"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="state">Estado</Label>
                <Select
                  value={formData.state}
                  onValueChange={(value) => setFormData({ ...formData, state: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map((uf) => (
                      <SelectItem key={uf.value} value={uf.value}>
                        {uf.value} - {uf.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSaveClient}>
                {isEditMode ? 'Salvar Alterações' : `Salvar ${t.client === 'Paciente' ? 'Paciente' : t.client}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de {t.clients}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground">
              {t.clients} cadastrados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos Este Mês</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newClientsThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              {t.clients} novos neste mês
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.appointments} Realizados</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalAppointments}
            </div>
            <p className="text-xs text-muted-foreground">
              Total de {t.appointments.toLowerCase()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Patients List */}
      <div className="space-y-4">
        {filteredPatients.map((patient) => (
          <Card key={patient.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">{patient.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">
                        {patient.appointmentsCount} {patient.appointmentsCount === 1 ? t.appointment.toLowerCase() : t.appointments.toLowerCase()}
                      </Badge>
                      {loyaltyActive && patient.loyaltyPoints != null && patient.loyaltyPoints > 0 && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          ⭐ {patient.loyaltyPoints} pts
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {patient.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="h-4 w-4" />
                        {patient.email}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4" />
                      {patient.phone}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {patient.birthDate && (
                      <div className="text-sm text-gray-600">
                        <strong>Nascimento:</strong> {formatDate(patient.birthDate)}
                      </div>
                    )}
                    {patient.cpf && (
                      <div className="text-sm text-gray-600">
                        <strong>CPF:</strong> {patient.cpf}
                      </div>
                    )}
                    {patient.address && (
                      <div className="text-sm text-gray-600">
                        <strong>Endereço:</strong> {patient.address}
                        {patient.city && ` - ${patient.city}`}
                        {patient.state && `/${patient.state}`}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    title="Acessar Pacotes do Cliente"
                    onClick={() => router.push(`/dashboard/patients/${patient.id}/packages`)}
                  >
                    <Package className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title={`Histórico de ${t.appointments.toLowerCase()}`}
                    onClick={() => router.push(`/dashboard/patients/${patient.id}/history`)}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleEditClient(patient)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {patient.notes && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="text-sm text-yellow-800">
                    <strong>Observações:</strong> {patient.notes}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPatients.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchTerm
                ? `Nenhum ${t.client.toLowerCase()} encontrado`
                : `Nenhum ${t.client.toLowerCase()} cadastrado`
              }
            </h3>
            <p className="text-gray-600 text-center mb-4">
              {searchTerm
                ? `Tente buscar com outros termos ou cadastre um novo ${t.client.toLowerCase()}`
                : `Comece cadastrando seu primeiro ${t.client.toLowerCase()} no sistema`
              }
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t.client === 'Paciente' ? 'Cadastrar Primeiro Paciente' : `Cadastrar Primeiro ${t.client}`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
