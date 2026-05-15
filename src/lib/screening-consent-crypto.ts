import crypto from 'crypto'

const VERSION = 'v1'
const IV_LEN = 12
const KEY_BYTES = 32

function getKeyBuffer(): Buffer {
  const raw = process.env.SCREENING_CONSENT_ENCRYPTION_KEY
  if (!raw?.trim()) {
    throw new Error('SCREENING_CONSENT_ENCRYPTION_KEY is not configured')
  }
  const buf = Buffer.from(raw.trim(), 'base64')
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `SCREENING_CONSENT_ENCRYPTION_KEY must be ${KEY_BYTES} bytes when base64-decoded (got ${buf.length})`,
    )
  }
  return buf
}

/** AES-256-GCM; returns `${VERSION}:${ivB64}:${tagB64}:${cipherB64}` */
export function encryptScreeningSsn(plainDigits: string): string {
  const key = getKeyBuffer()
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plainDigits, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':')
}

export function decryptScreeningSsn(payload: string): string {
  const key = getKeyBuffer()
  const parts = payload.split(':')
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Invalid encrypted SSN payload')
  }
  const [, ivB64, tagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
