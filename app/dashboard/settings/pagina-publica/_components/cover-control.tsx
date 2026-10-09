'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED = 'image/jpeg,image/png,image/webp'

interface CoverControlProps {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  /** Chave da capa enviada; nulo = usando a capa padrão do template. */
  coverImage: string | null
  presetSrc: string
  onCoverImageChange: (key: string | null) => void
}

export function CoverControl({
  enabled,
  onEnabledChange,
  coverImage,
  presetSrc,
  onCoverImageChange,
}: CoverControlProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_BYTES) {
      toast.error('Imagem muito grande. Máximo 5MB')
      return
    }
    if (!ACCEPTED.split(',').includes(file.type)) {
      toast.error('Use uma imagem JPG, PNG ou WebP')
      return
    }

    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/upload/booking-cover', { method: 'POST', body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar a capa')
      onCoverImageChange(data.coverImage)
      onEnabledChange(true)
      toast.success('Capa enviada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar a capa')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/upload/booking-cover', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onCoverImageChange(null)
      toast.success('Foto removida. Usando a capa padrão')
    } catch {
      toast.error('Erro ao remover a foto')
    } finally {
      setBusy(false)
    }
  }

  const thumbSrc = coverImage ? `/api/files/logo?key=${encodeURIComponent(coverImage)}` : presetSrc

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="cover-enabled">Exibir imagem de capa</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">Uma foto no topo da página, atrás do logo.</p>
        </div>
        <Switch id="cover-enabled" checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      {enabled && (
        <div className="space-y-3">
          <div className="relative h-24 w-full overflow-hidden rounded-lg border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbSrc} alt="Capa atual" className="h-full w-full object-cover" />
            {!coverImage && (
              <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium backdrop-blur">
                Capa padrão
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
              {coverImage ? 'Trocar foto' : 'Enviar sua foto'}
            </Button>
            {coverImage && (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={handleRemove}>
                <Trash2 className="mr-2 h-4 w-4" />
                Remover
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            JPG, PNG ou WebP, até 5MB. Ajustamos para 1600×700 automaticamente; prefira fotos horizontais.
          </p>
        </div>
      )}
    </div>
  )
}
