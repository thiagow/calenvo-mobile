'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MessageCircle, Copy, Check, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'

interface ChatWidgetConfig {
  enabled: boolean
  displayName: string
  avatarUrl: string | null
  welcomeMessage: string
  primaryColor: string
  position: 'bottom-right' | 'bottom-left'
  showLauncherText: boolean
  slug: string
}

export default function ChatWidgetPage() {
  const [config, setConfig] = useState<ChatWidgetConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [copiedScript, setCopiedScript] = useState(false)
  const [copiedIframe, setCopiedIframe] = useState(false)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Máximo 5MB'); return }
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return }
    const reader = new FileReader()
    reader.onloadend = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)
    setUploadingAvatar(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/upload/chat-avatar', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const d = await res.json()
      setConfig(c => c && ({ ...c, avatarUrl: d.cloud_storage_path }))
      toast.success('Avatar enviado!')
    } catch {
      toast.error('Erro ao enviar avatar')
    } finally {
      setUploadingAvatar(false)
    }
  }

  useEffect(() => {
    fetch('/api/dashboard/chat-widget')
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch(() => toast.error('Erro ao carregar configuração'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      const res = await fetch('/api/dashboard/chat-widget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error()
      toast.success('Configuração salva')
    } catch {
      toast.error('Erro ao salvar configuração')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !config) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const scriptSnippet = `<script src="${origin}/widget-loader.js" data-business="${config.slug}" data-position="${config.position}"></script>`
  const iframeSnippet = `<iframe src="${origin}/widget/chat/${config.slug}" style="position:fixed;bottom:20px;${config.position === 'bottom-left' ? 'left' : 'right'}:20px;width:380px;height:600px;border:none;z-index:2147483647;" title="Chat de agendamento"></iframe>`

  const copy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Chat de IA no seu site</h1>
        <p className="text-muted-foreground">Um assistente que agenda horários automaticamente, direto no seu site</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Configuração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4 pb-1">
            <div className="w-16 h-16 rounded-full border border-border flex items-center justify-center bg-muted overflow-hidden flex-shrink-0">
              {avatarPreview || config.avatarUrl ? (
                <img src={avatarPreview || `/api/files/logo?key=${config.avatarUrl}`} alt="Avatar do chat" className="w-full h-full object-cover" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Label>Foto de perfil no chat</Label>
              <Input type="file" accept="image/*" onChange={handleAvatarChange} disabled={uploadingAvatar} className="text-xs mt-1" />
              <p className="text-[10px] text-muted-foreground mt-1">PNG/JPG, máx 5MB. Aparece no ícone flutuante, no cabeçalho e nas respostas do chat.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Nome exibido no chat</Label>
            <Input
              id="displayName"
              placeholder="Agendamento Online"
              value={config.displayName}
              onChange={(e) => setConfig({ ...config, displayName: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Deixe em branco para usar o padrão "Agendamento Online"</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enabled">Chat ativo</Label>
              <p className="text-sm text-muted-foreground">Habilita o widget para responder e agendar pelos sites onde ele estiver instalado</p>
            </div>
            <Switch
              id="enabled"
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showLauncherText">Mostrar texto ao lado do ícone</Label>
              <p className="text-sm text-muted-foreground">Exibe uma frase de convite ("Faça seu agendamento aqui.") ao lado do ícone flutuante quando o chat está minimizado</p>
            </div>
            <Switch
              id="showLauncherText"
              checked={config.showLauncherText}
              onCheckedChange={(checked) => setConfig({ ...config, showLauncherText: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">Mensagem de boas-vindas</Label>
            <Input
              id="welcomeMessage"
              value={config.welcomeMessage}
              onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Cor principal</Label>
              <div className="flex items-center gap-2">
                <input
                  id="primaryColor"
                  type="color"
                  value={config.primaryColor}
                  onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                  className="w-10 h-10 rounded border border-input cursor-pointer"
                />
                <Input
                  value={config.primaryColor}
                  onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Posição</Label>
              <Select
                value={config.position}
                onValueChange={(value) => setConfig({ ...config, position: value as 'bottom-right' | 'bottom-left' })}
              >
                <SelectTrigger id="position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">Canto inferior direito</SelectItem>
                  <SelectItem value="bottom-left">Canto inferior esquerdo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar configuração
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instalar no seu site</CardTitle>
          <CardDescription>Escolha uma das duas formas de instalar. A opção 1 é a mais comum e fácil.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="font-medium text-sm">Opção 1 — Script (recomendado)</p>
            <p className="text-xs text-muted-foreground">Cole esta linha antes do fechamento da tag &lt;/body&gt; do seu site. A bolha aparece flutuando automaticamente.</p>
            <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
              <code className="text-xs flex-1 break-all">{scriptSnippet}</code>
              <Button variant="outline" size="sm" onClick={() => copy(scriptSnippet, setCopiedScript)}>
                {copiedScript ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-sm">Opção 2 — Iframe manual</p>
            <p className="text-xs text-muted-foreground">Use se o seu site/construtor de páginas não permitir scripts personalizados. Fica um pouco mais simples, sem a animação de abrir/fechar.</p>
            <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
              <code className="text-xs flex-1 break-all">{iframeSnippet}</code>
              <Button variant="outline" size="sm" onClick={() => copy(iframeSnippet, setCopiedIframe)}>
                {copiedIframe ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
