'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, FileText, MoreVertical, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  EXAMPLE_REACTIVATION_VARS,
  REACTIVATION_VARIABLES,
  TEMPLATE_BODY_MAX,
  TEMPLATE_NAME_MAX,
  findUnknownVariables,
  renderTemplate,
} from '@/lib/message-template'
import { cn } from '@/lib/utils'

interface Template {
  id: string
  name: string
  body: string
  isDefault: boolean
}

type Draft = { id: string | null; name: string; body: string }

/**
 * Modelos do lembrete de retorno (envio manual pela tela Clientes → Retorno).
 * Só o MASTER chega aqui com edição — a API também bloqueia (403).
 */
export function MessageTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/message-templates')
      if (res.ok) setTemplates((await res.json()).templates)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const unknown = draft ? findUnknownVariables(draft.body) : []

  const insertVariable = (key: string) => {
    if (!draft) return
    const token = `{{${key}}}`
    const el = bodyRef.current
    const start = el?.selectionStart ?? draft.body.length
    const end = el?.selectionEnd ?? draft.body.length
    const body = draft.body.slice(0, start) + token + draft.body.slice(end)
    setDraft({ ...draft, body: body.slice(0, TEMPLATE_BODY_MAX) })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const request = async (url: string, init: RequestInit, success: string) => {
    const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
    toast.success(success)
    await load()
  }

  const save = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const payload = JSON.stringify({ name: draft.name, body: draft.body })
      if (draft.id) await request(`/api/message-templates/${draft.id}`, { method: 'PATCH', body: payload }, 'Modelo salvo')
      else await request('/api/message-templates', { method: 'POST', body: payload }, 'Modelo criado')
      setDraft(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const makeDefault = (t: Template) =>
    request(`/api/message-templates/${t.id}`, { method: 'PATCH', body: JSON.stringify({ isDefault: true }) }, `"${t.name}" agora é o padrão`).catch(
      e => toast.error(e.message)
    )

  const remove = (t: Template) =>
    request(`/api/message-templates/${t.id}`, { method: 'DELETE' }, 'Modelo excluído').catch(e => toast.error(e.message))

  return (
    <section id="modelos" className="scroll-mt-20">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Modelos de mensagem</p>
            <p className="text-xs text-muted-foreground">Usados no lembrete de retorno (Clientes → Retorno)</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setDraft({ id: null, name: '', body: '' })}>
          <Plus className="h-3.5 w-3.5" /> Novo
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <Card key={t.id} className="border border-border">
              <CardContent className="flex items-start gap-3 p-4">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setDraft({ id: t.id, name: t.name, body: t.body })}
                >
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                    {t.isDefault && (
                      <Badge variant="outline" className="border-primary/20 bg-primary/10 px-1.5 py-0 text-[10px] text-primary">
                        Padrão
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.body}</p>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Ações de ${t.name}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setDraft({ id: t.id, name: t.name, body: t.body })}>
                      <Pencil className="mr-2 h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDraft({ id: null, name: `${t.name} (cópia)`.slice(0, TEMPLATE_NAME_MAX), body: t.body })}
                    >
                      <Copy className="mr-2 h-4 w-4" /> Duplicar
                    </DropdownMenuItem>
                    {!t.isDefault && (
                      <DropdownMenuItem onClick={() => makeDefault(t)}>
                        <Star className="mr-2 h-4 w-4" /> Definir como padrão
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => remove(t)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!draft} onOpenChange={open => !open && setDraft(null)}>
        <SheetContent side="bottom" className="h-[92vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle>{draft?.id ? 'Editar modelo' : 'Novo modelo'}</SheetTitle>
          </SheetHeader>

          {draft && (
            <div className="mx-auto max-w-lg space-y-4 pb-6">
              <div className="space-y-1.5">
                <Label htmlFor="template-name">Nome</Label>
                <Input
                  id="template-name"
                  value={draft.name}
                  maxLength={TEMPLATE_NAME_MAX}
                  placeholder="Ex.: Retorno de limpeza"
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="template-body">Mensagem</Label>
                  <span
                    className={cn(
                      'text-xs tabular-nums',
                      draft.body.length > TEMPLATE_BODY_MAX * 0.9 ? 'text-amber-600' : 'text-muted-foreground'
                    )}
                  >
                    {draft.body.length}/{TEMPLATE_BODY_MAX}
                  </span>
                </div>
                <Textarea
                  id="template-body"
                  ref={bodyRef}
                  rows={6}
                  value={draft.body}
                  maxLength={TEMPLATE_BODY_MAX}
                  onChange={e => setDraft({ ...draft, body: e.target.value })}
                  aria-invalid={unknown.length > 0}
                  className={cn(unknown.length > 0 && 'border-destructive focus-visible:ring-destructive')}
                />
                {unknown.length > 0 && (
                  <p className="text-xs text-destructive">
                    Variável desconhecida: {unknown.map(v => `{{${v}}}`).join(', ')}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Toque para inserir no cursor</p>
                <div className="flex flex-wrap gap-1.5">
                  {REACTIVATION_VARIABLES.map(v => (
                    <button
                      key={v.key}
                      type="button"
                      title={v.description}
                      onClick={() => insertVariable(v.key)}
                      className="rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-[11px] text-primary transition-colors hover:bg-muted"
                    >
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Prévia com um cliente de exemplo</p>
                <div className="rounded-2xl rounded-tl-sm bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-950 whitespace-pre-wrap break-words dark:bg-emerald-950/40 dark:text-emerald-50">
                  {draft.body.trim() ? (
                    renderTemplate(draft.body, EXAMPLE_REACTIVATION_VARS)
                  ) : (
                    <span className="italic opacity-60">Escreva a mensagem para ver a prévia…</span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setDraft(null)} disabled={saving}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={save}
                  disabled={saving || !draft.name.trim() || !draft.body.trim() || unknown.length > 0}
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  )
}
