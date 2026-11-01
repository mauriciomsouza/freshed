import {
  checkWorkspace,
  ComponentDefinition,
  Flow,
  PROTOCOL_VERSION,
  Screen,
  snapshotHash,
  toSnapshot,
  VersionSnapshot,
  type ScopedIssue,
  type Version,
  type VersionSummary,
  type Workspace,
} from '@freshed/schema'
import type { Db } from './db.js'

type VersionRow = {
  number: number
  protocol: number
  message: string
  hash: string
  snapshot: unknown
  created_at: Date | string
  created_by: string | null
  rolled_back_from: number | null
}

const iso = (d: Date | string) =>
  typeof d === 'string' ? new Date(d).toISOString() : d.toISOString()

function toVersion(row: VersionRow): Version {
  return {
    number: row.number,
    protocol: row.protocol,
    message: row.message,
    hash: row.hash,
    createdAt: iso(row.created_at),
    createdBy: row.created_by ?? undefined,
    rolledBackFrom: row.rolled_back_from ?? undefined,
    snapshot: VersionSnapshot.parse(row.snapshot),
  }
}

function summarize(v: Version): VersionSummary {
  const { snapshot, ...rest } = v
  return {
    ...rest,
    counts: {
      components: snapshot.components.length,
      screens: snapshot.screens.length,
      flows: snapshot.flows.length,
    },
  }
}

export class PublishError extends Error {
  override name = 'PublishError'
  constructor(
    message: string,
    readonly issues: ScopedIssue[] = [],
  ) {
    super(message)
  }
}

/** All persistence lives here; routes stay thin. */
export function createStore(db: Db) {
  const store = {
    async workspace(): Promise<Workspace> {
      const [components, screens, flows] = await Promise.all([
        db.query<{ definition: unknown }>('SELECT definition FROM components ORDER BY name'),
        db.query<{ data: unknown }>('SELECT data FROM screens ORDER BY slug'),
        db.query<{ data: unknown }>('SELECT data FROM flows ORDER BY slug'),
      ])
      return {
        components: components.map((r) => ComponentDefinition.parse(r.definition)),
        screens: screens.map((r) => Screen.parse(r.data)),
        flows: flows.map((r) => Flow.parse(r.data)),
      }
    },

    async upsertComponent(def: ComponentDefinition) {
      await db.query(
        `INSERT INTO components (name, definition) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET definition = EXCLUDED.definition, updated_at = now()`,
        [def.name, JSON.stringify(def)],
      )
    },
    async deleteComponent(name: string) {
      return (
        (await db.query('DELETE FROM components WHERE name = $1 RETURNING name', [name])).length > 0
      )
    },

    async upsertScreen(screen: Screen) {
      await db.query(
        `INSERT INTO screens (slug, data) VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [screen.slug, JSON.stringify(screen)],
      )
    },
    async getScreen(slug: string) {
      const rows = await db.query<{ data: unknown }>('SELECT data FROM screens WHERE slug = $1', [
        slug,
      ])
      return rows[0] ? Screen.parse(rows[0].data) : null
    },
    async deleteScreen(slug: string) {
      return (
        (await db.query('DELETE FROM screens WHERE slug = $1 RETURNING slug', [slug])).length > 0
      )
    },

    async upsertFlow(flow: Flow) {
      await db.query(
        `INSERT INTO flows (slug, data) VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [flow.slug, JSON.stringify(flow)],
      )
    },
    async getFlow(slug: string) {
      const rows = await db.query<{ data: unknown }>('SELECT data FROM flows WHERE slug = $1', [
        slug,
      ])
      return rows[0] ? Flow.parse(rows[0].data) : null
    },
    async deleteFlow(slug: string) {
      return (await db.query('DELETE FROM flows WHERE slug = $1 RETURNING slug', [slug])).length > 0
    },

    async versions(): Promise<VersionSummary[]> {
      const rows = await db.query<VersionRow>('SELECT * FROM versions ORDER BY number DESC')
      return rows.map((r) => summarize(toVersion(r)))
    },
    async version(number: number): Promise<Version | null> {
      const rows = await db.query<VersionRow>('SELECT * FROM versions WHERE number = $1', [number])
      return rows[0] ? toVersion(rows[0]) : null
    },
    /** Newest published version a client speaking `protocol` can read. */
    async live(protocol: number = PROTOCOL_VERSION): Promise<Version | null> {
      const rows = await db.query<VersionRow>(
        'SELECT * FROM versions WHERE protocol <= $1 ORDER BY number DESC LIMIT 1',
        [protocol],
      )
      return rows[0] ? toVersion(rows[0]) : null
    },

    /**
     * Publishes the current drafts as a new immutable version. Blocked by
     * any validation error. Publishing identical content is a no-op that
     * returns the current version, so double-clicks do not spam history.
     */
    async publish(input: {
      message?: string
      createdBy?: string
    }): Promise<{ version: Version; created: boolean }> {
      const ws = await store.workspace()
      const check = checkWorkspace(ws)
      if (!check.ok) {
        throw new PublishError(
          'Fix validation errors before publishing',
          check.issues.filter((i) => i.severity === 'error'),
        )
      }
      const snapshot = toSnapshot(ws)
      return insertVersion(snapshot, { message: input.message ?? '', createdBy: input.createdBy })
    },

    /**
     * Rolls back by publishing a copy of an older version as the newest one.
     * History is append-only; nothing is edited or deleted.
     */
    async rollback(input: { to: number; createdBy?: string; restoreDrafts?: boolean }) {
      const target = await store.version(input.to)
      if (!target) throw new PublishError(`Version ${input.to} does not exist`)
      const result = await insertVersion(target.snapshot, {
        message: `Roll back to v${target.number}`,
        createdBy: input.createdBy,
        rolledBackFrom: target.number,
        force: true,
      })
      if (input.restoreDrafts !== false) await store.replaceDrafts(target.snapshot)
      return result
    },

    /** Replaces all drafts with a snapshot (used after rollback so editors start from what is live). */
    async replaceDrafts(snapshot: VersionSnapshot) {
      await db.transaction(async (tx) => {
        await tx.query('DELETE FROM components')
        await tx.query('DELETE FROM screens')
        await tx.query('DELETE FROM flows')
        for (const c of snapshot.components) {
          await tx.query('INSERT INTO components (name, definition) VALUES ($1, $2)', [
            c.name,
            JSON.stringify(c),
          ])
        }
        for (const s of snapshot.screens) {
          await tx.query('INSERT INTO screens (slug, data) VALUES ($1, $2)', [
            s.slug,
            JSON.stringify(s),
          ])
        }
        for (const f of snapshot.flows) {
          await tx.query('INSERT INTO flows (slug, data) VALUES ($1, $2)', [
            f.slug,
            JSON.stringify(f),
          ])
        }
      })
    },
  }

  async function insertVersion(
    snapshot: VersionSnapshot,
    meta: { message: string; createdBy?: string; rolledBackFrom?: number; force?: boolean },
  ): Promise<{ version: Version; created: boolean }> {
    const hash = snapshotHash(snapshot)
    return db.transaction(async (tx) => {
      // Serialize publishers so version numbers stay gapless and monotonic.
      await tx.query('LOCK TABLE versions IN SHARE ROW EXCLUSIVE MODE')
      const latest = await tx.query<VersionRow>(
        'SELECT * FROM versions ORDER BY number DESC LIMIT 1',
      )
      if (!meta.force && latest[0] && latest[0].hash === hash) {
        return { version: toVersion(latest[0]), created: false }
      }
      const number = (latest[0]?.number ?? 0) + 1
      const rows = await tx.query<VersionRow>(
        `INSERT INTO versions (number, protocol, message, hash, snapshot, created_by, rolled_back_from)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          number,
          PROTOCOL_VERSION,
          meta.message,
          hash,
          JSON.stringify(snapshot),
          meta.createdBy ?? null,
          meta.rolledBackFrom ?? null,
        ],
      )
      return { version: toVersion(rows[0]!), created: true }
    })
  }

  return store
}
export type Store = ReturnType<typeof createStore>
