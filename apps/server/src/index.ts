import { providerFromEnv } from '@freshed/ai'
import { serve } from '@hono/node-server'
import { createHash } from 'node:crypto'
import { createApp } from './app.js'
import { connectPg, connectPglite, migrate, type Db } from './db.js'
import { seed } from './seed.js'

/**
 * Environment:
 *   DATABASE_URL        postgres://... (omit to use an embedded PGlite database)
 *   PGLITE_DIR          data dir for PGlite (default: in-memory)
 *   PORT                default 8787
 *   FRESHED_ADMIN_KEY   bootstrap admin key (fr_admin_...), stored hashed
 *   FRESHED_PUBLIC_KEY  bootstrap public key (fr_pub_...), stored hashed
 *   FRESHED_SEED        "brew" to seed the demo project on first start
 *   FRESHED_CORS        comma-separated origins allowed to call the admin API
 *   FRESHED_AI_KEY / FRESHED_AI_PROVIDER / FRESHED_AI_MODEL  optional server-side AI
 */
async function main() {
  const db: Db = process.env.DATABASE_URL
    ? await connectPg(process.env.DATABASE_URL)
    : await connectPglite(process.env.PGLITE_DIR)
  const ran = await migrate(db)
  if (ran.length) console.log(`Applied migrations: ${ran.join(', ')}`)

  await bootstrapKey(db, process.env.FRESHED_ADMIN_KEY, 'admin')
  await bootstrapKey(db, process.env.FRESHED_PUBLIC_KEY, 'public')
  if (process.env.FRESHED_SEED === 'brew' && (await seed(db)).seeded)
    console.log('Seeded Brew demo project')

  const ai = providerFromEnv(process.env)
  const app = createApp({
    db,
    ai,
    corsOrigins: (process.env.FRESHED_CORS ?? 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim()),
  })
  const port = Number(process.env.PORT ?? 8787)
  serve({ fetch: app.fetch, port }, () => {
    console.log(
      `freshed server on http://localhost:${port} (${process.env.DATABASE_URL ? 'postgres' : 'pglite'})`,
    )
    console.log(
      ai
        ? `Server-side AI enabled (${ai.id}, ${ai.model})`
        : 'Server-side AI disabled (no FRESHED_AI_KEY)',
    )
  })
}

async function bootstrapKey(db: Db, key: string | undefined, kind: 'admin' | 'public') {
  if (!key) return
  const expected = kind === 'admin' ? 'fr_admin_' : 'fr_pub_'
  if (!key.startsWith(expected) || key.length < expected.length + 16) {
    throw new Error(
      `${kind} key must start with ${expected} and be at least 16 characters after the prefix`,
    )
  }
  const hash = createHash('sha256').update(key).digest('hex')
  await db.query(
    `INSERT INTO api_keys (id, name, kind, prefix, key_hash) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (key_hash) DO NOTHING`,
    [
      `env-${kind}-${hash.slice(0, 8)}`,
      `env ${kind}`,
      kind,
      key.slice(0, expected.length + 4),
      hash,
    ],
  )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
