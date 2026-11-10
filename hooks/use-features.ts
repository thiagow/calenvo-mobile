'use client'

import useSWR from 'swr'

export interface FeaturesState {
  finance: { entitled: boolean; active: boolean }
}

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null))

/**
 * Módulos opcionais da conta (menu e telas condicionais). Só decide o que
 * aparece — toda rota do módulo revalida no servidor.
 */
export function useFeatures() {
  const { data, isLoading, mutate } = useSWR<FeaturesState | null>('/api/features', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000
  })
  return { features: data ?? null, isLoading, refresh: mutate }
}
