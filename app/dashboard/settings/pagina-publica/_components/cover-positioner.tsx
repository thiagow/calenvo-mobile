'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Move } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Proporção da capa gravada pelo servidor (1600×700). O quadro precisa ter a
// mesma, senão `object-position` deixa de equivaler ao recorte do servidor.
const COVER_ASPECT = 1600 / 700
const KEY_STEP = 0.05

interface CoverPositionerProps {
  file: File
  busy: boolean
  onCancel: () => void
  onConfirm: (focal: { x: number; y: number }) => void
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export function CoverPositioner({ file, busy, onCancel, onConfirm }: CoverPositionerProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; focal: { x: number; y: number } } | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [focal, setFocal] = useState({ x: 0.5, y: 0.5 })
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    setNatural(null)
    setFocal({ x: 0.5, y: 0.5 })
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Sobra da foto (em px do quadro) em cada eixo, depois de escalada para cobrir.
  const overflow = (() => {
    const frame = frameRef.current
    if (!natural || !frame) return { x: 0, y: 0 }
    const { width: fw, height: fh } = frame.getBoundingClientRect()
    const scale = Math.max(fw / natural.w, fh / natural.h)
    return { x: Math.max(0, natural.w * scale - fw), y: Math.max(0, natural.h * scale - fh) }
  })()
  const canMove = overflow.x > 1 || overflow.y > 1

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canMove || busy) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, focal }
    setDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start) return
    // Arrastar a foto para a direita revela o lado esquerdo: o foco anda ao contrário do dedo.
    const next = {
      x: overflow.x > 0 ? clamp01(start.focal.x - (e.clientX - start.x) / overflow.x) : start.focal.x,
      y: overflow.y > 0 ? clamp01(start.focal.y - (e.clientY - start.y) / overflow.y) : start.focal.y,
    }
    setFocal(next)
  }

  const endDrag = () => {
    drag.current = null
    setDragging(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canMove || busy) return
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    }
    const move = delta[e.key]
    if (!move) return
    e.preventDefault()
    setFocal((f) => ({
      x: overflow.x > 0 ? clamp01(f.x + move[0]) : f.x,
      y: overflow.y > 0 ? clamp01(f.y + move[1]) : f.y,
    }))
  }

  return (
    <div className="space-y-3">
      <div
        ref={frameRef}
        role="slider"
        tabIndex={0}
        aria-label="Posição da foto na capa. Use as setas do teclado ou arraste."
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((overflow.y > overflow.x ? focal.y : focal.x) * 100)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        style={{ aspectRatio: COVER_ASPECT, touchAction: 'none' }}
        className={cn(
          'relative w-full select-none overflow-hidden rounded-lg border border-border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring',
          canMove && (dragging ? 'cursor-grabbing' : 'cursor-grab')
        )}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="Pré-visualização da capa"
            draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            style={{ objectPosition: `${focal.x * 100}% ${focal.y * 100}%` }}
            className="pointer-events-none h-full w-full object-cover"
          />
        )}
        {canMove && !dragging && (
          <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium backdrop-blur">
            <Move className="h-3 w-3" />
            Arraste para ajustar
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {natural && !canMove
          ? 'A foto já tem a proporção da capa — não há o que ajustar.'
          : 'Arraste a foto (ou use as setas do teclado) para escolher o enquadramento.'}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy || !natural} onClick={() => onConfirm(focal)}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar capa
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
