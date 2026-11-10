/**
 * Utilitários do lado do cliente para o Módulo Financeiro. Sem dependências de
 * servidor: pode ser importado por qualquer componente 'use client'.
 */

/** fetch JSON com erro legível vindo da API (`{ error }`). */
export async function financeFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const error = new Error((body as { error?: string } | null)?.error ?? 'Não foi possível concluir a operação') as Error & { status?: number }
    error.status = res.status
    throw error
  }
  return body as T
}

export const SALE_CREATED_EVENT = 'calenvo:finance-sale-created'

export interface SaleCreatedDetail {
  saleId: string
}

/**
 * Chamado depois de concluir um atendimento: se a resposta trouxe a comanda
 * gerada pelo Financeiro, avisa o host global para abrir "Fechar comanda".
 */
export function announceSaleFromAppointmentResponse(response: unknown) {
  if (typeof window === 'undefined' || !response || typeof response !== 'object') return
  const saleId = (response as { financeSaleId?: unknown }).financeSaleId
  if (typeof saleId !== 'string') return
  window.dispatchEvent(new CustomEvent<SaleCreatedDetail>(SALE_CREATED_EVENT, { detail: { saleId } }))
}

export function openSaleSheet(saleId: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<SaleCreatedDetail>(SALE_CREATED_EVENT, { detail: { saleId } }))
}
