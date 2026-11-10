'use client'

import { useEffect, useState } from 'react'
import { useFeatures } from '@/hooks/use-features'
import { SALE_CREATED_EVENT, type SaleCreatedDetail } from '@/lib/finance/client'
import { CloseSaleSheet } from './close-sale-sheet'

/**
 * Montado uma vez no layout do dashboard. Abre "Fechar comanda" sempre que um
 * atendimento concluído gera comanda — em qualquer tela (lista, agenda,
 * histórico do cliente) — para quem opera o caixa. Sem o módulo, não renderiza nada.
 */
export function SaleSheetHost() {
  const { features } = useFeatures()
  const [saleId, setSaleId] = useState<string | null>(null)
  const enabled = features?.finance.active === true && features.finance.canOperateCash

  useEffect(() => {
    if (!enabled) return
    const handler = (event: Event) => setSaleId((event as CustomEvent<SaleCreatedDetail>).detail.saleId)
    window.addEventListener(SALE_CREATED_EVENT, handler)
    return () => window.removeEventListener(SALE_CREATED_EVENT, handler)
  }, [enabled])

  if (!enabled) return null
  return <CloseSaleSheet saleId={saleId} currency={features!.finance.currency} onClose={() => setSaleId(null)} />
}
