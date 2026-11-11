'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import type { CurrencyCode } from '@/lib/finance/money'
import { Money, type MoneyTone } from './money'

/**
 * `Money` que conta até o valor (ease-out, ~600ms) quando ele muda. Só para
 * números de destaque: respeita "reduzir movimento" e começa já no valor
 * inicial (sem contar do zero no primeiro render, para não parecer carregando).
 */
export function AnimatedMoney({
  cents,
  currency = 'BRL',
  className,
  signed,
  tone
}: {
  cents: number
  currency?: CurrencyCode
  className?: string
  signed?: boolean
  tone?: MoneyTone
}) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(cents)
  const from = useRef(cents)

  useEffect(() => {
    if (reduce || from.current === cents) {
      from.current = cents
      setShown(cents)
      return
    }
    const controls = animate(from.current, cents, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (value) => setShown(Math.round(value)),
      onComplete: () => {
        from.current = cents
        setShown(cents)
      }
    })
    return () => {
      from.current = shown
      controls.stop()
    }
    // `shown` é só o ponto de partida ao interromper; não deve reiniciar a animação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents, reduce])

  return <Money cents={shown} currency={currency} className={className} signed={signed} tone={tone} />
}
