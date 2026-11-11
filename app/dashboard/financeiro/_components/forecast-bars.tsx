'use client'

import { useMemo, useRef, useState } from 'react'
import type { ForecastDayDto } from '@/components/finance/types'
import { formatMoney, type CurrencyCode } from '@/lib/finance/money'

const W = 640
const H = 190
const PAD = { top: 12, right: 8, bottom: 24, left: 8 }
const label = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
const longLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' })

const SERIES = [
  { key: 'confirmedCents', name: 'Confirmado', className: 'fill-money-positive', swatch: 'bg-money-positive' },
  { key: 'unconfirmedCents', name: 'A confirmar', className: 'fill-money-warn', swatch: 'bg-money-warn' },
  { key: 'receivablesCents', name: 'Já a receber', className: 'fill-primary', swatch: 'bg-primary' }
] as const

const dayDate = (date: string) => new Date(`${date}T12:00:00Z`)
const total = (d: ForecastDayDto) => d.confirmedCents + d.unconfirmedCents + d.receivablesCents

/**
 * Barras empilhadas por dia (confirmado, a confirmar, já a receber). Foco por
 * teclado (setas, Home/End, Esc) e leitura em voz alta do dia ativo; a lista
 * "por dia" abaixo da tela é a alternativa em texto do gráfico.
 */
export function ForecastBars({ days, currency }: { days: ForecastDayDto[]; currency: CurrencyCode }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [active, setActive] = useState<number | null>(null)

  const geometry = useMemo(() => {
    const max = Math.max(1, ...days.map(total))
    const innerW = W - PAD.left - PAD.right
    const innerH = H - PAD.top - PAD.bottom
    const slot = innerW / Math.max(1, days.length)
    const barW = Math.max(2, Math.min(28, slot * 0.68))
    const y = (value: number) => (value / max) * innerH
    return { max, slot, barW, y, innerH }
  }, [days])

  if (days.length === 0) return null

  const onPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((event.clientX - rect.left) / rect.width) * W - PAD.left
    setActive(Math.max(0, Math.min(days.length - 1, Math.floor(x / geometry.slot))))
  }

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const last = days.length - 1
    let next: number | null = null
    if (event.key === 'ArrowRight') next = Math.min(last, (active ?? -1) + 1)
    else if (event.key === 'ArrowLeft') next = Math.max(0, (active ?? last + 1) - 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    else if (event.key === 'Escape') {
      setActive(null)
      return
    } else return
    event.preventDefault()
    setActive(next)
  }

  const current = active != null ? days[active] : null
  const ticks = days.length <= 7 ? days.map((_, i) => i) : [0, Math.floor((days.length - 1) / 3), Math.floor(((days.length - 1) * 2) / 3), days.length - 1]
  const baseY = H - PAD.bottom
  const grand = days.reduce((sum, d) => sum + total(d), 0)

  return (
    <figure className="space-y-3">
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none select-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          role="img"
          tabIndex={0}
          aria-label={`Previsão de recebimento nos próximos ${days.length} dias, total de ${formatMoney(grand, currency)}. Use as setas para ver cada dia.`}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          <line x1={PAD.left} x2={W - PAD.right} y1={baseY} y2={baseY} className="stroke-border" strokeWidth={1} />
          {days.map((d, i) => {
            const x = PAD.left + i * geometry.slot + (geometry.slot - geometry.barW) / 2
            let stackTop = baseY
            return (
              <g key={d.date} opacity={active == null || active === i ? 1 : 0.45}>
                {SERIES.map((s) => {
                  const height = geometry.y(d[s.key])
                  if (height <= 0) return null
                  stackTop -= height
                  return <rect key={s.key} x={x} y={stackTop} width={geometry.barW} height={height} rx={2} className={s.className} />
                })}
              </g>
            )
          })}
          {ticks.map((i) => (
            <text
              key={i}
              x={PAD.left + i * geometry.slot + geometry.slot / 2}
              y={H - 7}
              textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'}
              className="fill-muted-foreground text-[11px]"
            >
              {label.format(dayDate(days[i].date))}
            </text>
          ))}
        </svg>

        {current && active != null && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-48 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md"
            style={{ left: `${Math.min(80, Math.max(20, ((PAD.left + active * geometry.slot + geometry.slot / 2) / W) * 100))}%` }}
          >
            <p className="font-medium capitalize">{longLabel.format(dayDate(current.date))}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex justify-between text-muted-foreground">
                {s.name} <span className="tabular-nums text-foreground">{formatMoney(current[s.key], currency)}</span>
              </p>
            ))}
            <p className="mt-1 flex justify-between border-t border-border pt-1 font-medium">
              {current.appointments} {current.appointments === 1 ? 'atendimento' : 'atendimentos'}
              <span className="tabular-nums">{formatMoney(total(current), currency)}</span>
            </p>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {current
            ? `${longLabel.format(dayDate(current.date))}: ${SERIES.map((s) => `${s.name} ${formatMoney(current[s.key], currency)}`).join(', ')}, ${current.appointments} atendimentos`
            : ''}
        </p>
      </div>

      <figcaption>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${s.swatch}`} aria-hidden="true" />
              {s.name}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}
