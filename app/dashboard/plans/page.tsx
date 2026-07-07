
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { CheckCircle, Star, CreditCard, Zap, Loader2 } from 'lucide-react'
import { PLAN_CONFIGS } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

interface PlanUsageData {
  appointmentsThisMonth: number
  monthlyLimit: number
  usagePercentage: number
  planType: string
  userLimit: number
}

const PLAN_ORDER = ['BASICO', 'PRO', 'BUSINESS']

const PLAN_DESCRIPTIONS: Record<string, string> = {
  BASICO: 'Perfeito para começar',
  PRO: 'Para negócios em crescimento',
  BUSINESS: 'Para negócios estabelecidos',
}

export default function PlansPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState('')
  const [usageLoading, setUsageLoading] = useState(true)
  const [usageData, setUsageData] = useState<PlanUsageData | null>(null)

  // Fetch real usage data
  useEffect(() => {
    const fetchUsageData = async () => {
      try {
        const response = await fetch('/api/plans/usage')
        if (response.ok) {
          const data = await response.json()
          setUsageData(data)
        }
      } catch (error) {
        console.error('Error fetching usage data:', error)
      } finally {
        setUsageLoading(false)
      }
    }

    fetchUsageData()
  }, [])

  const currentPlan = usageData?.planType || 'BASICO'

  const handleUpgrade = async (planId: string) => {
    setLoading(planId)

    try {
      // TODO: wire to uma API real de troca de assinatura (stripe.subscriptions.update
      // com proration), diferente do fluxo de checkout de um novo cadastro.
      await new Promise(resolve => setTimeout(resolve, 2000))
      toast.success(`Redirecionando para o pagamento do Plano ${PLAN_CONFIGS[planId as keyof typeof PLAN_CONFIGS]?.name}...`)
    } catch (error) {
      toast.error('Erro ao processar upgrade. Tente novamente.')
    } finally {
      setLoading('')
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Badge className="bg-green-100 text-green-700">
            Plano Atual: {PLAN_CONFIGS[currentPlan as keyof typeof PLAN_CONFIGS]?.name}
          </Badge>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          Gerencie seu Plano
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Faça upgrade para desbloquear recursos avançados e expandir as possibilidades do seu negócio
        </p>
      </div>

      {/* Current Plan Status */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Zap className="h-5 w-5 text-blue-600 mr-2" />
            Status do Plano Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : usageData ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {usageData.appointmentsThisMonth}
                </div>
                <p className="text-sm text-gray-600">Agendamentos este mês</p>
                {usageData.usagePercentage > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {usageData.usagePercentage}% utilizado
                  </p>
                )}
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {usageData.monthlyLimit === -1
                    ? '∞'
                    : usageData.monthlyLimit}
                </div>
                <p className="text-sm text-gray-600">Limite mensal</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {usageData.userLimit}
                </div>
                <p className="text-sm text-gray-600">Usuários permitidos</p>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Não foi possível carregar os dados de uso
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plans Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(PLAN_CONFIGS).map(([planId, config]) => {
          const isCurrent = currentPlan === planId
          const isUpgrade = PLAN_ORDER.indexOf(planId) > PLAN_ORDER.indexOf(currentPlan)

          return (
            <Card key={planId} className={`relative ${isCurrent ? 'border-blue-500 shadow-lg' : ''} ${planId === 'PRO' ? 'scale-105' : ''}`}>
              {isCurrent && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500">
                  Plano Atual
                </Badge>
              )}
              {planId === 'PRO' && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-green-500">
                  <Star className="h-3 w-3 mr-1" />
                  Mais Popular
                </Badge>
              )}

              <CardHeader>
                <CardTitle className="text-xl text-center">
                  {config.name}
                </CardTitle>
                <CardDescription className="text-center">
                  {PLAN_DESCRIPTIONS[planId]}
                </CardDescription>
                <div className="text-center py-4">
                  <span className="text-3xl font-bold">
                    {formatCurrency(config.priceMonthly)}
                  </span>
                  <p className="text-sm text-gray-600 mt-1">/mês</p>
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3 mb-6">
                  {config.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button className="w-full" disabled>
                    Plano Atual
                  </Button>
                ) : isUpgrade ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        className={`w-full ${planId === 'PRO' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                        variant={planId === 'PRO' ? 'default' : 'outline'}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Fazer Upgrade
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          Confirmar Upgrade - {config.name}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="text-center p-6 bg-blue-50 rounded-lg">
                          <h3 className="text-lg font-semibold mb-2">
                            {config.name}
                          </h3>
                          <div className="text-3xl font-bold text-blue-600 mb-2">
                            {formatCurrency(config.priceMonthly)}
                            <span className="text-sm font-normal text-gray-600">/mês</span>
                          </div>
                          <p className="text-sm text-gray-600">
                            Cobrança recorrente mensal
                          </p>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-semibold">Recursos inclusos:</h4>
                          <ul className="space-y-1">
                            {config.features.slice(0, 4).map((feature, index) => (
                              <li key={index} className="flex items-center text-sm">
                                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" className="flex-1">
                            Cancelar
                          </Button>
                          <Button
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleUpgrade(planId)}
                            disabled={loading === planId}
                          >
                            {loading === planId ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Processando...
                              </div>
                            ) : (
                              <>
                                <CreditCard className="h-4 w-4 mr-2" />
                                Confirmar Upgrade
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    Fazer Downgrade
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
