import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import { encryptSecret, decryptSecret, CryptoConfigError } from '@/lib/crypto'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env.SECRETS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64')
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('encryptSecret / decryptSecret', () => {
  it('faz round-trip do valor original', () => {
    const plaintext = 'inst-token-89f193c6-d842-4503-b628-b66048fc776e'
    const encrypted = encryptSecret(plaintext)
    expect(decryptSecret(encrypted)).toBe(plaintext)
  })

  it('nunca produz o mesmo ciphertext duas vezes (IV aleatório)', () => {
    const plaintext = 'mesmo-token'
    const a = encryptSecret(plaintext)
    const b = encryptSecret(plaintext)
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe(plaintext)
    expect(decryptSecret(b)).toBe(plaintext)
  })

  it('detecta adulteração do ciphertext (autenticado)', () => {
    const encrypted = encryptSecret('token-secreto')
    const [iv, authTag, ciphertext] = encrypted.split(':')
    const tamperedCiphertext = Buffer.from(ciphertext, 'base64')
    tamperedCiphertext[0] ^= 0xff
    const tampered = [iv, authTag, tamperedCiphertext.toString('base64')].join(':')

    expect(() => decryptSecret(tampered)).toThrow()
  })

  it('lança CryptoConfigError se SECRETS_ENCRYPTION_KEY estiver ausente', () => {
    delete process.env.SECRETS_ENCRYPTION_KEY
    expect(() => encryptSecret('x')).toThrow(CryptoConfigError)
  })

  it('lança CryptoConfigError se a chave não tiver 32 bytes', () => {
    process.env.SECRETS_ENCRYPTION_KEY = Buffer.from('curta-demais').toString('base64')
    expect(() => encryptSecret('x')).toThrow(CryptoConfigError)
  })
})
