import { describe, it, expect } from 'vitest'
import {
  generateConfirmationToken,
  hashConfirmationToken,
  isValidTokenShape,
  buildConfirmationUrl,
} from '@/lib/confirmation-token'

describe('generateConfirmationToken', () => {
  it('gera token no formato esperado (22 chars, base64url)', () => {
    const { token } = generateConfirmationToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/)
  })

  it('gera tokens únicos em 1000 gerações', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateConfirmationToken().token))
    expect(tokens.size).toBe(1000)
  })

  it('tokenHash é determinístico e tem 64 chars hex (sha256)', () => {
    const { token, tokenHash } = generateConfirmationToken()
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashConfirmationToken(token)).toBe(tokenHash)
  })

  it('tokenPrefix são os 8 primeiros caracteres do token', () => {
    const { token, tokenPrefix } = generateConfirmationToken()
    expect(tokenPrefix).toBe(token.slice(0, 8))
  })

  it('hashes de tokens diferentes nunca colidem entre si', () => {
    const a = generateConfirmationToken()
    const b = generateConfirmationToken()
    expect(a.tokenHash).not.toBe(b.tokenHash)
  })
})

describe('isValidTokenShape', () => {
  it('aceita um token gerado de verdade', () => {
    const { token } = generateConfirmationToken()
    expect(isValidTokenShape(token)).toBe(true)
  })

  it('rejeita string vazia', () => {
    expect(isValidTokenShape('')).toBe(false)
  })

  it('rejeita comprimento errado (21 ou 23 chars)', () => {
    expect(isValidTokenShape('a'.repeat(21))).toBe(false)
    expect(isValidTokenShape('a'.repeat(23))).toBe(false)
  })

  it('rejeita caracteres fora do alfabeto base64url', () => {
    expect(isValidTokenShape('a'.repeat(18) + '+/==')).toBe(false)
  })

  it('rejeita tentativa de path traversal', () => {
    expect(isValidTokenShape('../../../../etc/passwd')).toBe(false)
  })
})

describe('buildConfirmationUrl', () => {
  it('monta a URL com o path /c/<token>', () => {
    const { token } = generateConfirmationToken()
    const url = buildConfirmationUrl(token)
    expect(url.endsWith(`/c/${token}`)).toBe(true)
  })
})
