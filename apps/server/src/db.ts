import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The smallest database surface the server needs. Implemented for `pg`
 * (production) and PGlite (tests, local demos) so every query runs against
 * real Postgres semantics either way.
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>
  close(): Promise<void>
}

export async function connectPg(connectionString: string): Promise<Db> {
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString, max: 10 })
  const wrap = (client: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>
  }): Db => ({
    query: async <T>(sql: string, params?: unknown[]) =>
      (await client.query(sql, params)).rows as T[],
    transaction: async (fn) => fn(wrap(client)),
    close: async () => {},
  })
  return {
    query: async <T>(sql: string, params?: unknown[]) =>
      (await pool.query(sql, params)).rows as T[],
    transaction: async <T>(fn: (tx: Db) => Promise<T>) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const out = await fn(wrap(client))
        await client.query('COMMIT')
        return out
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    },
    close: () => pool.end(),
  }
}

export async function connectPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite')
  const pg = new PGlite(dataDir)
  type Q = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }
  const wrap = (q: Q): Db => ({
    query: async <T>(sql: string, params?: unknown[]) => (await q.query(sql, params)).rows as T[],
    transaction: async (fn) => fn(wrap(q)),
    close: async () => {},
  })
  return {
    ...wrap(pg),
    transaction: <T>(fn: (tx: Db) => Promise<T>) =>
      pg.transaction((tx) => fn(wrap(tx as unknown as Q))),
    close: () => pg.close(),
  }
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

/** Applies pending `migrations/*.sql` in order, each in its own transaction. */
export async function migrate(db: Db): Promise<string[]> {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`)
  const applied = new Set(
    (await db.query<{ name: string }>('SELECT name FROM schema_migrations')).map((r) => r.name),
  )
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  const ran: string[] = []
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    await db.transaction(async (tx) => {
      for (const statement of splitSql(sql)) await tx.query(statement)
      await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
    })
    ran.push(file)
  }
  return ran
}

/** Splits on semicolons at end of line, keeping $$-quoted function bodies intact. */
export function splitSql(sql: string): string[] {
  const out: string[] = []
  let current = ''
  let inDollar = false
  for (const line of sql.split('\n')) {
    if (/^\s*--/.test(line) && !inDollar) continue
    current += line + '\n'
    const dollars = line.match(/\$\$/g)?.length ?? 0
    if (dollars % 2 === 1) inDollar = !inDollar
    if (!inDollar && /;\s*$/.test(line)) {
      out.push(current.trim())
      current = ''
    }
  }
  if (current.trim()) out.push(current.trim())
  return out
}
