// Armazenamento temporário em memória para dados do checkout
// Em produção, usar Redis ou similar

import { SegmentType } from '@prisma/client'

export interface TemporaryData {
  email: string
  password: string
  name: string
  businessName: string
  segmentType: SegmentType
  phone: string
  customerId: string
  timestamp: number
}

const storage = new Map<string, TemporaryData>()

export function setTemporaryData(sessionId: string, data: TemporaryData) {
  storage.set(sessionId, data)
  
  // Limpar dados expirados (mais de 1 hora)
  const oneHourAgo = Date.now() - 60 * 60 * 1000
  for (const [key, value] of storage.entries()) {
    if (value.timestamp < oneHourAgo) {
      storage.delete(key)
    }
  }
}

export function getTemporaryData(sessionId: string): TemporaryData | undefined {
  return storage.get(sessionId)
}

export function deleteTemporaryData(sessionId: string) {
  storage.delete(sessionId)
}
