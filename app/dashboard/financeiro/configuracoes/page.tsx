'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BackButton } from '@/components/dashboard/back-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useFeatures } from '@/hooks/use-features'
import { useUserRole } from '@/hooks/use-user-role'
import { FinanceShell } from '../_components/finance-shell'
import { CategoriesCard } from '../_components/categories-card'
import { FinanceIntro } from '../_components/finance-intro'
import { FinanceRulesCard } from '../_components/finance-rules-card'
import { PaymentMethodsCard } from '../_components/payment-methods-card'
import {
  financeFetch,
  type CurrencyCode,
  type FinanceCategoryDto,
  type FinanceConfigDto,
  type PaymentMethodDto
} from '../_components/types'

interface Settings {
  config: FinanceConfigDto
  currency: CurrencyCode
  paymentMethods: PaymentMethodDto[]
  categories: FinanceCategoryDto[]
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

export default function FinanceSettingsPage() {
  const { isMaster, isLoading: roleLoading } = useUserRole()
  const { features, isLoading: featuresLoading, refresh: refreshFeatures } = useFeatures()
  const entitled = features?.finance.entitled === true

  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)

  const load = useCallback(async () => {
    try {
      const { config, currency } = await financeFetch<{ config: FinanceConfigDto; currency: CurrencyCode }>(
        '/api/finance/config'
      )
      if (!config.isActive) {
        setSettings({ config, currency, paymentMethods: [], categories: [] })
        return
      }
      const [{ paymentMethods }, { categories }] = await Promise.all([
        financeFetch<{ paymentMethods: PaymentMethodDto[] }>('/api/finance/payment-methods?all=1'),
        financeFetch<{ categories: FinanceCategoryDto[] }>('/api/finance/categories?all=1')
      ])
      setSettings({ config, currency, paymentMethods, categories })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar o Financeiro')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (featuresLoading || roleLoading) return
    if (entitled && isMaster) {
      void load()
    } else {
      setLoading(false)
    }
  }, [entitled, featuresLoading, roleLoading, isMaster, load])

  const updateConfig = async (changes: Partial<FinanceConfigDto>) => {
    if (!settings) return
    const previous = settings.config
    setSettings({ ...settings, config: { ...previous, ...changes } }) // otimista
    setSaving(true)
    try {
      const { config } = await financeFetch<{ config: FinanceConfigDto }>('/api/finance/config', {
        method: 'PUT',
        body: JSON.stringify(changes)
      })
      const switchedState = changes.isActive !== undefined
      if (switchedState) {
        await Promise.all([load(), refreshFeatures()])
        toast.success(config.isActive ? 'Financeiro ativado' : 'Financeiro desativado')
      } else {
        setSettings((current) => (current ? { ...current, config } : current))
      }
    } catch (err) {
      setSettings((current) => (current ? { ...current, config: previous } : current))
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar')
    } finally {
      setSaving(false)
    }
  }

  if (featuresLoading || roleLoading || loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }

  if (!isMaster) {
    return (
      <div className="space-y-4">
        <BackButton />
        <p className="text-sm text-muted-foreground">Apenas o administrador da conta acessa as configurações do Financeiro.</p>
      </div>
    )
  }

  if (!entitled || !settings) {
    return (
      <div className="space-y-4">
        <BackButton />
        <FinanceIntro entitled={false} />
      </div>
    )
  }

  if (!settings.config.isActive) {
    return (
      <div className="space-y-4">
        <BackButton />
        <FinanceIntro entitled activating={saving} onActivate={() => updateConfig({ isActive: true })} />
      </div>
    )
  }

  const { config, currency, paymentMethods, categories } = settings

  return (
    <FinanceShell
      title="Configurações"
      description={config.activatedAt ? `Ativo desde ${dateFormatter.format(new Date(config.activatedAt))}` : 'Ativo'}
      access="master"
    >
      {() => (
        <div className="space-y-6">
          <Section title="Regras" description="Como as comissões e os recebimentos se comportam.">
            <FinanceRulesCard config={config} saving={saving} onChange={updateConfig} />
          </Section>

          <Link
            href="/dashboard/financeiro/comissoes"
            className="flex min-h-11 items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors hover:bg-muted/50"
          >
            <span>
              <span className="block font-medium">Comissão por profissional</span>
              <span className="block text-xs text-muted-foreground">Percentual ou valor fixo, com exceções por serviço.</span>
            </span>
            <span aria-hidden="true" className="text-muted-foreground">→</span>
          </Link>

          <Section title="Formas de pagamento" description="Cadastre a taxa de cada maquininha para ver o valor líquido real.">
            <PaymentMethodsCard methods={paymentMethods} currency={currency} onChanged={load} />
          </Section>

          <Section title="Categorias" description="Organizam receitas e despesas nos relatórios.">
            <CategoriesCard categories={categories} onChanged={load} />
          </Section>

          <Section title="Zona de risco" description="Nada do que já foi lançado é apagado.">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Desativar o Financeiro</p>
                <p className="text-xs text-muted-foreground">Você pode ligar de novo quando quiser.</p>
              </div>
              <Button variant="outline" className="min-h-11 flex-shrink-0" disabled={saving} onClick={() => setConfirmOff(true)}>
                Desativar
              </Button>
            </div>
          </Section>

          <ConfirmDialog
            open={confirmOff}
            onOpenChange={setConfirmOff}
            title="Desativar o Financeiro?"
            description="Atendimentos concluídos deixam de entrar no caixa e nas comissões enquanto estiver desligado. Nada do que já foi lançado é apagado, e você pode ligar de novo quando quiser."
            confirmText="Desativar"
            variant="destructive"
            onConfirm={() => updateConfig({ isActive: false })}
          />
        </div>
      )}
    </FinanceShell>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="px-0.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground/80">{description}</p>
      </div>
      {children}
    </section>
  )
}
