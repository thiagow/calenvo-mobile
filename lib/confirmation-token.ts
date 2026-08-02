import crypto from 'crypto'

export interface GeneratedConfirmationToken {
  token: string // texto puro — só existe neste momento, nunca é salvo
  tokenHash: string
  tokenPrefix: string
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** 128 bits de entropia, base64url (sem +, /, =) — curto o bastante para o WhatsApp não truncar o preview do link. */
export function generateConfirmationToken(): GeneratedConfirmationToken {
  const token = crypto.randomBytes(16).toString('base64url')
  return {
    token,
    tokenHash: hashToken(token),
    tokenPrefix: token.slice(0, 8),
  }
}

export function hashConfirmationToken(token: string): string {
  return hashToken(token)
}

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{22}$/

export function isValidTokenShape(token: string): boolean {
  return TOKEN_SHAPE.test(token)
}

function appBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
}

export function buildConfirmationUrl(token: string): string {
  return `${appBaseUrl()}/c/${token}`
}
