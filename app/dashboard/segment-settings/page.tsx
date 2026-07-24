
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, Check, Info } from 'lucide-react'
import { toast } from 'sonner'
import { SegmentMultiSelect } from '@/components/shared/segment-multi-select'
import { SEGMENT_CONFIGS } from '@/lib/types'

export default function SegmentSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState('')
  const [currentSegments, setCurrentSegments] = useState<string[]>([])
  const [selectedSegments, setSelectedSegments] = useState<string[]>([])

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user/profile')
      if (res.ok) {
        const data = await res.json()
        setRole(data.role)
        setCurrentSegments(data.segmentTypes || [])
        setSelectedSegments(data.segmentTypes || [])
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = JSON.stringify([...selectedSegments].sort()) !== JSON.stringify([...currentSegments].sort())

  const handleSave = async () => {
    if (selectedSegments.length === 0) {
      toast.error('Selecione ao menos um segmento')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentTypes: selectedSegments })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Erro ao atualizar segmentos')
      }

      toast.success('Segmentos atualizados com sucesso!')

      // A terminologia exibida no dashboard (contexts/segment-context.tsx) só
      // é recalculada no carregamento da página — recarrega pra refletir.
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error: any) {
      console.error('Error updating segments:', error)
      toast.error(error.message || 'Erro ao atualizar segmentos')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Segmentos do Negócio</h1>
        <p className="text-gray-600">Define a terminologia e os campos exibidos no sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Segmentos Atuais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {currentSegments.map((s) => (
              <Badge key={s} className="bg-violet-600">
                {SEGMENT_CONFIGS[s as keyof typeof SEGMENT_CONFIGS]?.name ?? s}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar Segmentos</CardTitle>
          <CardDescription>
            Selecione todos os tipos de negócio que se aplicam — é possível escolher mais de um
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {role !== 'MASTER' ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Apenas o administrador da conta pode alterar os segmentos do negócio.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Importante:</strong> Ao alterar os segmentos, a terminologia em todo o
                  sistema será atualizada automaticamente, inclusive para os profissionais da equipe.
                </AlertDescription>
              </Alert>

              <SegmentMultiSelect value={selectedSegments} onChange={setSelectedSegments} />

              <div className="flex gap-3">
                <Button
                  onClick={handleSave}
                  disabled={saving || !hasChanges || selectedSegments.length === 0}
                  className="bg-violet-600 hover:bg-violet-700"
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

                {hasChanges && (
                  <Button variant="outline" onClick={() => setSelectedSegments(currentSegments)}>
                    Cancelar
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
