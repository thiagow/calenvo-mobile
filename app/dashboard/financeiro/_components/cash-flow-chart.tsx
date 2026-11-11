'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { formatMoney, type CurrencyCode } from '@/lib/finance/money'
import { cn } from '@/lib/utils'

export interface FlowDay {
  date: string
  inCents: number
  outCents: number
  balanceCents: number
}

const W = 640
const H = 180
const PAD = { top: 16, right: 12, bottom: 22, left: 12 }
const shortDay = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })

/**
 * Saldo projetado acumulado (uma série): linha 2px + área, eixo zero discreto,
 * cursor com dica no hover/toque. Sem legenda — o título nomeia a série.
 */
export function CashFlowChart({ days, currency }: { days: FlowDay[]; currency: CurrencyCode }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gradientId = useId().replace(/:/g, '')
  const [hover, setHover] = useState<number | null>(null)

  const geometry = useMemo(() => {
    const values = days.map((d) => d.balanceCents)
    const min = Math.min(0, ...values)
    const max = Math.max(0, ...values)
    const span = max - min || 1
    const innerW = W - PAD.left - PAD.right
    const innerH = H - PAD.top - PAD.bottom
    const x = (i: number) => PAD.left + (days.length <= 1 ? innerW / 2 : (i / (days.length - 1)) * innerW)
    const y = (v: number) => PAD.top + ((max - v) / span) * innerH
    const points = days.map((d, i) => [x(i), y(d.balanceCents)] as const)
    const line = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
    const zeroY = y(0)
    const area = `${line} L${points[points.length - 1][0].toFixed(1)},${zeroY.toFixed(1)} L${points[0][0].toFixed(1)},${zeroY.toFixed(1)} Z`
    return { x, y, line, area, zeroY, min }
  }, [days])

  if (days.length === 0) return null

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const relative = ((event.clientX - rect.left) / rect.width) * W
    const innerW = W - PAD.left - PAD.right
    const index = Math.round(((relative - PAD.left) / innerW) * (days.length - 1))
    setHover(Math.max(0, Math.min(days.length - 1, index)))
  }

  // Teclado: setas movem o cursor dia a dia, Home/End vão às pontas, Esc limpa.
  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const last = days.length - 1
    const current = hover ?? (event.key === 'ArrowLeft' ? last + 1 : -1)
    let next: number | null = null
    if (event.key === 'ArrowRight') next = Math.min(last, current + 1)
    else if (event.key === 'ArrowLeft') next = Math.max(0, current - 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    else if (event.key === 'Escape') {
      setHover(null)
      return
    } else return
    event.preventDefault()
    setHover(next)
  }

  const active = hover != null ? days[hover] : null
  // Saldo final negativo = linha em vermelho (o gráfico não esconde que o caixa fica no vermelho).
  const endsNegative = days[days.length - 1].balanceCents < 0
  const ticks = [0, Math.floor((days.length - 1) / 2), days.length - 1]

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={cn('h-auto w-full touch-none select-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', endsNegative ? 'text-money-negative' : 'text-primary')}
        role="img"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onBlur={() => setHover(null)}
        aria-label={`Saldo projetado nos próximos ${days.length} dias, terminando em ${formatMoney(days[days.length - 1].balanceCents, currency)}. Use as setas para ver cada dia.`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={PAD.left} x2={W - PAD.right} y1={geometry.zeroY} y2={geometry.zeroY} className="stroke-border" strokeWidth={1} strokeDasharray="3 4" />
        <path d={geometry.area} fill={`url(#${gradientId})`} />
        <path d={geometry.line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {ticks.map((i) => (
          <text key={i} x={geometry.x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'} className="fill-muted-foreground text-[11px]">
            {shortDay.format(new Date(`${days[i].date}T12:00:00Z`))}
          </text>
        ))}
        {active && hover != null && (
          <g>
            <line x1={geometry.x(hover)} x2={geometry.x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-muted-foreground/40" strokeWidth={1} />
            <circle cx={geometry.x(hover)} cy={geometry.y(active.balanceCents)} r={5} fill="currentColor" className="stroke-background" strokeWidth={2} />
          </g>
        )}
      </svg>
      <p className="sr-only" aria-live="polite">
        {active
          ? shortDay.format(new Date(active.date + 'T12:00:00Z')) + ': entra ' + formatMoney(active.inCents, currency) + ', sai ' + formatMoney(active.outCents, currency) + ', saldo ' + formatMoney(active.balanceCents, currency)
          : ''}
      </p>
      {active && hover != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-44 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md"
          style={{ left: `${Math.min(85, Math.max(15, (geometry.x(hover) / W) * 100))}%` }}
        >
          <p className="font-medium">{shortDay.format(new Date(`${active.date}T12:00:00Z`))}</p>
          <p className="flex justify-between text-muted-foreground">
            Entra <span className="tabular-nums text-foreground">{formatMoney(active.inCents, currency)}</span>
          </p>
          <p className="flex justify-between text-muted-foreground">
            Sai <span className="tabular-nums text-foreground">{formatMoney(active.outCents, currency)}</span>
          </p>
          <p className="mt-1 flex justify-between border-t border-border pt-1 font-medium">
            Saldo <span className="tabular-nums">{formatMoney(active.balanceCents, currency)}</span>
          </p>
        </div>
      )}
    </div>
  )
}
