'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  TEMPLATES,
  getContrastWarnings,
  resolveTheme,
  type BookingTemplateId,
} from '@/lib/booking-theme'
import { TemplatePicker } from './_components/template-picker'
import { ColorField } from './_components/color-field'
import { CoverControl } from './_components/cover-control'
import { PhonePreview } from './_components/phone-preview'

interface Appearance {
  template: BookingTemplateId
  bgColor: string | null
  textColor: string | null
  accentColor: string | null
  coverEnabled: boolean
}

interface AppearanceResponse extends Appearance {
  businessName: string
  publicSlug: string
  coverImage: string | null
  businessLogo: string | null
}

const pickAppearance = (a: Appearance): Appearance => ({
  template: a.template,
  bgColor: a.bgColor,
  textColor: a.textColor,
  accentColor: a.accentColor,
  coverEnabled: a.coverEnabled,
})

export default function PublicPageAppearance() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')

  const [business, setBusiness] = useState<{
    name: string
    slug: string
    logo: string | null
  } | null>(null)
  const [saved, setSaved] = useState<Appearance | null>(null)
  const [draft, setDraft] = useState<Appearance | null>(null)
  const [coverImage, setCoverImage] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings/booking-appearance')
      .then(async (res) => {
        if (res.status === 403) {
          setForbidden(true)
          return
        }
        if (!res.ok) throw new Error()
        const data: AppearanceResponse = await res.json()
        setBusiness({ name: data.businessName, slug: data.publicSlug, logo: data.businessLogo })
        setSaved(pickAppearance(data))
        setDraft(pickAppearance(data))
        setCoverImage(data.coverImage)
      })
      .catch(() => toast.error('Erro ao carregar a aparência'))
      .finally(() => setLoading(false))
  }, [])

  const theme = useMemo(
    () => (draft ? resolveTheme({ ...draft, coverImage }) : null),
    [draft, coverImage]
  )
  const defaults = useMemo(() => (draft ? resolveTheme({ template: draft.template }) : null), [draft])
  const warnings = useMemo(() => (theme ? getContrastWarnings(theme) : []), [theme])

  const dirty = Boolean(saved && draft && JSON.stringify(saved) !== JSON.stringify(draft))

  const update = useCallback((patch: Partial<Appearance>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }, [])

  const handleTemplate = (template: BookingTemplateId) => {
    if (!draft || template === draft.template) return
    // Cores personalizadas eram calibradas para o template anterior.
    update({ template, bgColor: null, textColor: null, accentColor: null })
  }

  const handleSave = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings/booking-appearance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      setSaved(pickAppearance(data))
      setDraft(pickAppearance(data))
      toast.success('Aparência da página salva')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-[640px]" />
          <Skeleton className="h-[640px]" />
        </div>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="space-y-4">
        <Header onBack={() => router.back()} />
        <p className="text-sm text-muted-foreground">Apenas o administrador pode personalizar a página pública.</p>
      </div>
    )
  }

  if (!draft || !theme || !defaults || !business) return null

  return (
    <div className="space-y-6">
      <Header
        onBack={() => router.back()}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/booking/${business.slug}`, '_blank')}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Ver página
          </Button>
        }
      />

      {/* Abas só no mobile; no desktop controles e preview ficam lado a lado. */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 lg:hidden" role="tablist">
        {(['edit', 'preview'] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={mobileTab === tab}
            onClick={() => setMobileTab(tab)}
            className={cn(
              'rounded-md py-1.5 text-sm font-medium transition-colors',
              mobileTab === tab ? 'bg-background shadow-sm' : 'text-muted-foreground'
            )}
          >
            {tab === 'edit' ? 'Personalizar' : 'Pré-visualizar'}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className={cn('space-y-6', mobileTab !== 'edit' && 'hidden lg:block lg:space-y-6')}>
          <Card>
            <CardHeader>
              <CardTitle>Template</CardTitle>
              <CardDescription>O estilo geral da página: layout, tipografia e cartões.</CardDescription>
            </CardHeader>
            <CardContent>
              <TemplatePicker value={draft.template} onChange={handleTemplate} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Capa</CardTitle>
              <CardDescription>Disponível em todos os templates.</CardDescription>
            </CardHeader>
            <CardContent>
              <CoverControl
                enabled={draft.coverEnabled}
                onEnabledChange={(coverEnabled) => update({ coverEnabled })}
                coverImage={coverImage}
                presetSrc={TEMPLATES[draft.template].coverPreset}
                onCoverImageChange={setCoverImage}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cores</CardTitle>
              <CardDescription>
                Ajuste as cores do template. O texto dos botões se adapta automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ColorField
                label="Cor de fundo"
                value={theme.colors.background}
                customized={draft.bgColor !== null}
                onChange={(bgColor) => update({ bgColor })}
                onReset={() => update({ bgColor: null })}
              />
              <ColorField
                label="Cor do texto"
                value={theme.colors.foreground}
                customized={draft.textColor !== null}
                onChange={(textColor) => update({ textColor })}
                onReset={() => update({ textColor: null })}
              />
              <ColorField
                label="Cor de destaque"
                hint="Botões, ícones e seleções."
                value={theme.colors.primary}
                customized={draft.accentColor !== null}
                onChange={(accentColor) => update({ accentColor })}
                onReset={() => update({ accentColor: null })}
              />

              {warnings.length > 0 && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <ul className="space-y-1">
                    {warnings.map((w) => (
                      <li key={w.message}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={!dirty || saving} className="w-full" size="lg">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {dirty ? 'Salvar alterações' : 'Tudo salvo'}
          </Button>
        </div>

        <div className={cn('lg:sticky lg:top-6', mobileTab !== 'preview' && 'hidden lg:block')}>
          <p className="mb-3 text-center text-xs font-medium text-muted-foreground">Pré-visualização ao vivo</p>
          <PhonePreview theme={theme} businessName={business.name} businessLogo={business.logo} />
          {dirty && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Alterações ainda não salvas: a página pública só muda após salvar.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Header({ onBack, action }: { onBack: () => void; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="icon" onClick={onBack} aria-label="Voltar">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-0 flex-1">
        <h1 className="text-3xl font-bold">Página pública</h1>
        <p className="text-muted-foreground">Personalize a aparência da sua página de agendamento</p>
      </div>
      {action}
    </div>
  )
}
