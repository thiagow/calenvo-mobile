'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Key, Plus, Trash2, Copy, Check, Loader2 } from 'lucide-react'
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

export default function ApiKeysPage() {
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
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Chaves de API</h1>
          <p className="text-muted-foreground">Gere tokens para integrar parceiros externos e agentes de IA à sua agenda</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Chave
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Suas chaves
          </CardTitle>
          <CardDescription>
            Veja a documentação em <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/api/v1</code> para detalhes de uso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : keys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma chave criada ainda</div>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{key.name}</p>
                      {key.revokedAt ? (
                        <Badge variant="destructive">Revogada</Badge>
                      ) : (
                        <Badge variant="default">Ativa</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">{key.tokenPrefix}...</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Criada em {new Date(key.createdAt).toLocaleDateString('pt-BR')}
                      {key.lastUsedAt && ` · Último uso em ${new Date(key.lastUsedAt).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                  {!key.revokedAt && (
                    <Button variant="ghost" size="sm" onClick={() => handleRevoke(key)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: criar nova chave */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova chave de API</DialogTitle>
            <DialogDescription>
              Dê um nome para identificar onde esta chave será usada (ex: "Integração Zapier", "Agente de IA").
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
    </div>
  )
}
