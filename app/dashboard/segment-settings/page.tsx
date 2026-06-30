
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Building2, Check, Info, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useSegmentConfig } from '@/contexts/segment-context'
import { getAvailableSegments, SegmentType } from '@/lib/segment-config'

export default function SegmentSettingsPage() {
  const router = useRouter()
  const { config: currentConfig, segmentType: currentSegmentType, isLoading } = useSegmentConfig()
  const [selectedSegment, setSelectedSegment] = useState<SegmentType | ''>('')
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const availableSegments = getAvailableSegments()

  useEffect(() => {
    if (currentSegmentType && !isLoading) {
      setSelectedSegment(currentSegmentType)
    }
  }, [currentSegmentType, isLoading])

  const handleSave = async () => {
    if (!selectedSegment) {
      toast.error('Por favor, selecione um tipo de negócio')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentType: selectedSegment })
      })

      if (!response.ok) {
        throw new Error('Erro ao atualizar configuração')
      }

      toast.success('Configuração atualizada com sucesso!')
      
      // Dar um tempo para o toast aparecer antes de recarregar
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      console.error('Error updating segment:', error)
      toast.error('Erro ao atualizar configuração')
    } finally {
      setSaving(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    window.location.reload()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tipo de Negócio</h1>
        <p className="text-gray-600">Configure o tipo de negócio para personalizar a interface do sistema</p>
      </div>

      {/* Current Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Configuração Atual
          </CardTitle>
          <CardDescription>
            O tipo de negócio define a terminologia e campos exibidos no sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-blue-900">Tipo Atual:</span>
              <Badge className="bg-blue-600">
                {availableSegments.find(s => s.value === currentSegmentType)?.label || 'Não definido'}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Cliente:</span>
                <span className="ml-2 font-medium">{currentConfig.terminology.client}</span>
              </div>
              <div>
                <span className="text-gray-600">Agendamento:</span>
                <span className="ml-2 font-medium">{currentConfig.terminology.appointment}</span>
              </div>
              <div>
                <span className="text-gray-600">Profissional:</span>
                <span className="ml-2 font-medium">{currentConfig.terminology.professional}</span>
              </div>
              <div>
                <span className="text-gray-600">Serviço:</span>
                <span className="ml-2 font-medium">{currentConfig.terminology.service}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-blue-200">
              <span className="text-xs font-medium text-blue-900 mb-2 block">Campos Visíveis:</span>
              <div className="flex flex-wrap gap-2">
                {currentConfig.fields.showInsurance && (
                  <Badge variant="outline" className="text-xs">Convênio</Badge>
                )}
                {currentConfig.fields.showModality && (
                  <Badge variant="outline" className="text-xs">Modalidade</Badge>
                )}
                {currentConfig.fields.showSpecialty && (
                  <Badge variant="outline" className="text-xs">Especialidade</Badge>
                )}
                {currentConfig.fields.showProducts && (
                  <Badge variant="outline" className="text-xs">Produtos</Badge>
                )}
                {currentConfig.fields.showDepositRequired && (
                  <Badge variant="outline" className="text-xs">Sinal/Depósito</Badge>
                )}
              </div>
            </div>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar Visualização
          </Button>
        </CardContent>
      </Card>

      {/* Change Segment Type */}
      <Card>
        <CardHeader>
          <CardTitle>Alterar Tipo de Negócio</CardTitle>
          <CardDescription>
            Selecione o tipo que melhor descreve seu negócio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> Ao alterar o tipo de negócio, a terminologia em todo o sistema 
              será atualizada automaticamente. Por exemplo, "Paciente" pode se tornar "Cliente", 
              "Consulta" pode se tornar "Agendamento", etc.
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="segmentType">Tipo de Negócio *</Label>
            <Select 
              value={selectedSegment} 
              onValueChange={(value) => setSelectedSegment(value as SegmentType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de negócio" />
              </SelectTrigger>
              <SelectContent>
                {availableSegments.map((segment) => (
                  <SelectItem key={segment.value} value={segment.value}>
                    <div>
                      <div className="font-medium">{segment.label}</div>
                      <div className="text-xs text-gray-500">{segment.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSegment && selectedSegment !== currentSegmentType && (
            <Alert className="bg-amber-50 border-amber-200">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900">
                Você está prestes a alterar o tipo de negócio. A página será recarregada 
                após salvar para aplicar as mudanças.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button 
              onClick={handleSave}
              disabled={saving || !selectedSegment || selectedSegment === currentSegmentType}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
            
            {selectedSegment !== currentSegmentType && (
              <Button 
                variant="outline"
                onClick={() => setSelectedSegment(currentSegmentType)}
              >
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Exemplos de Terminologia por Tipo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {availableSegments.map((segment) => {
              const segmentConfig = require('@/lib/segment-config').getSegmentConfig(segment.value)
              return (
                <div key={segment.value} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant={segment.value === currentSegmentType ? 'default' : 'outline'}>
                      {segment.label}
                    </Badge>
                    {segment.value === currentSegmentType && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Ativo
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Cliente:</span>
                      <div className="font-medium">{segmentConfig.terminology.client}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Agendamento:</span>
                      <div className="font-medium">{segmentConfig.terminology.appointment}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Profissional:</span>
                      <div className="font-medium">{segmentConfig.terminology.professional}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Serviço:</span>
                      <div className="font-medium">{segmentConfig.terminology.service}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
