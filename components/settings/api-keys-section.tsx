'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Plus, Trash2, Copy, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDialog } from '@/components/providers/dialog-provider'

interface ApiKey {
  id: string
  name: string
  tokenPrefix: string
  scopes: string[]
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

/** Chaves de API do negócio (parceiros externos e agentes de IA). Vive dentro de uma seção de Configurações. */
export function ApiKeysSection() {
  const { confirm, alert } = useDialog()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [revealedToken, setRevealedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchKeys = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/api-keys')
      if (res.ok) {
        const data = await res.json()
        setKeys(data.tokens)
      }
    } catch (error) {
      console.error('Error fetching API keys:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [])

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error('Informe um nome para a chave')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/dashboard/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar chave')
      }

      setRevealedToken(data.token)
      setNewKeyName('')
      setCreateOpen(false)
      fetchKeys()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar chave')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (key: ApiKey) => {
    const confirmed = await confirm({
      title: 'Revogar chave de API',
      description: `Tem certeza que deseja revogar a chave "${key.name}"? Qualquer integração usando este token deixará de funcionar imediatamente.`,
      variant: 'destructive',
      confirmText: 'Revogar',
    })

    if (!confirmed) return

    try {
      const res = await fetch(`/api/dashboard/api-keys/${key.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      fetchKeys()
    } catch {
      await alert({ title: 'Erro', description: 'Erro ao revogar a chave', variant: 'error' })
    }
  }

  const handleCopy = () => {
    if (!revealedToken) return
    navigator.clipboard.writeText(revealedToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Gere tokens para integrar parceiros externos e agentes de IA à sua agenda. Documentação em{' '}
          <code className="bg-muted px-1 py-0.5 rounded">/api/v1</code>.
        </p>
        <Button size="sm" variant="outline" className="flex-shrink-0" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nova chave
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-sm text-muted-foreground">Carregando...</div>
      ) : keys.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">Nenhuma chave criada ainda</div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{key.name}</p>
                  {key.revokedAt ? (
                    <Badge variant="destructive">Revogada</Badge>
                  ) : (
                    <Badge variant="default">Ativa</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono">{key.tokenPrefix}...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Criada em {new Date(key.createdAt).toLocaleDateString('pt-BR')}
                  {key.lastUsedAt && ` · Último uso em ${new Date(key.lastUsedAt).toLocaleDateString('pt-BR')}`}
                </p>
              </div>
              {!key.revokedAt && (
                <Button variant="ghost" size="sm" onClick={() => handleRevoke(key)} aria-label={`Revogar chave ${key.name}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dialog: criar nova chave */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova chave de API</DialogTitle>
            <DialogDescription>
              Dê um nome para identificar onde esta chave será usada (ex: &quot;Integração Zapier&quot;, &quot;Agente de IA&quot;).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keyName">Nome</Label>
              <Input
                id="keyName"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Ex: Integração Zapier"
              />
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Criar chave
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: exibir token gerado (uma única vez) */}
      <Dialog open={!!revealedToken} onOpenChange={(open) => !open && setRevealedToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chave criada com sucesso</DialogTitle>
            <DialogDescription>
              Copie este token agora — por segurança, ele não será mostrado novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <code className="text-sm flex-1 break-all">{revealedToken}</code>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button onClick={() => setRevealedToken(null)} className="w-full">
              Já copiei, fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ApiKeysSection
