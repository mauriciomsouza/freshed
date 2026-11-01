import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Db } from './db.js'

export type KeyKind = 'public' | 'admin'

const PREFIX: Record<KeyKind, string> = { public: 'fr_pub_', admin: 'fr_admin_' }

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

/**
 * Creates an API key. Only the SHA-256 hash is stored; the plaintext is
 * returned once and must be shown to the operator immediately.
 */
export async function createApiKey(db: Db, input: { name: string; kind: KeyKind }) {
  const secret = PREFIX[input.kind] + randomBytes(24).toString('base64url')
  const id = randomBytes(8).toString('hex')
  await db.query(
    'INSERT INTO api_keys (id, name, kind, prefix, key_hash) VALUES ($1, $2, $3, $4, $5)',
    [id, input.name, input.kind, secret.slice(0, PREFIX[input.kind].length + 4), sha256(secret)],
  )
  return { id, key: secret }
}

/**
 * Verifies a bearer token and returns its kind. Admin keys can also read
 * public content; public keys can never write.
 */
export async function verifyApiKey(db: Db, token: string | undefined): Promise<KeyKind | null> {
  if (!token) return null
  const hash = sha256(token)
  const rows = await db.query<{ kind: KeyKind; key_hash: string }>(
    'SELECT kind, key_hash FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL',
    [hash],
  )
  const row = rows[0]
  if (!row) return null
  const a = Buffer.from(row.key_hash, 'hex')
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b) ? row.kind : null
}

export async function revokeApiKey(db: Db, id: string) {
  await db.query('UPDATE api_keys SET revoked_at = now() WHERE id = $1', [id])
}
