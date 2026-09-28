/**
 * Criptografia simétrica para segredos em repouso (ex.: token de instância
 * Uazapi salvo em `WhatsAppConfig.apiKey`). AES-256-GCM: autenticado, evita
 * tanto leitura quanto adulteração silenciosa do valor cifrado no banco.
 *
 * Chave em `SECRETS_ENCRYPTION_KEY` (env), 32 bytes em base64
 * (`openssl rand -base64 32`). Lida sob demanda, nunca no import — mesma
 * razão documentada em `lib/uazapi.ts`: um módulo não pode explodir ao ser
 * importado em CI sem o segredo configurado.
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // recomendado para GCM
const AUTH_TAG_LENGTH = 16

export class CryptoConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CryptoConfigError'
  }
}

function getKey(): Buffer {
  const encoded = process.env.SECRETS_ENCRYPTION_KEY
  if (!encoded) throw new CryptoConfigError('SECRETS_ENCRYPTION_KEY não configurada')

  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32) {
    throw new CryptoConfigError('SECRETS_ENCRYPTION_KEY precisa decodificar para 32 bytes (base64 de uma chave AES-256)')
  }
  return key
}

/** Formato armazenado: `<iv>:<authTag>:<ciphertext>`, tudo em base64. */
export function encryptSecret(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':')
}

export function decryptSecret(stored: string): string {
  const key = getKey()
  const parts = stored.split(':')
  if (parts.length !== 3) {
    throw new Error('Formato inválido de segredo cifrado (esperado iv:authTag:ciphertext)')
  }

  const [ivB64, authTagB64, ciphertextB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const ciphertext = Buffer.from(ciphertextB64, 'base64')

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Formato inválido de segredo cifrado (tamanho de iv/authTag incorreto)')
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
