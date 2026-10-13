'use client'

import useSWR from 'swr'

export interface ReactivationCounts {
  upcoming: number
  overdue: number
  lost: number
}

const fetcher = (url: string) => fetch(url).then(r => (r.ok ? r.json() : null))

/**
 * Contadores da tela de Retorno, compartilhados (SWR deduplica) entre o badge
 * da navegação, as abas de Clientes e o card do dashboard — uma requisição só.
 */
export function useReactivationSummary() {
  const { data, mutate } = useSWR<{ counts: ReactivationCounts } | null>('/api/reactivation/summary', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })
  return { counts: data?.counts ?? null, refresh: mutate }
}
