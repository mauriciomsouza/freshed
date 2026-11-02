import { mockProvider } from '@freshed-cms/ai'
import { recordedPlan, welcome } from '@freshed-cms/example-brew'
import { PROTOCOL_HEADER, type Screen } from '@freshed-cms/schema'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { connectPglite, migrate, splitSql, type Db } from '../src/db.js'
import { createApiKey } from '../src/keys.js'
import { seed } from '../src/seed.js'

let db: Db
let app: ReturnType<typeof createApp>
let admin: string
let pub: string

type Json = Record<string, unknown>

async function call(
  method: string,
  path: string,
  opts: { key?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { ...opts.headers }
  if (opts.key) headers.authorization = `Bearer ${opts.key}`
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  const res = await app.request(path, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  const text = await res.text()
  return {
    status: res.status,
    headers: res.headers,
    json: (text ? JSON.parse(text) : null) as Json,
  }
}

async function setup(ai?: Parameters<typeof createApp>[0]['ai']) {
  db = await connectPglite()
  await migrate(db)
  await seed(db)
  admin = (await createApiKey(db, { name: 'test admin', kind: 'admin' })).key
  pub = (await createApiKey(db, { name: 'test app', kind: 'public' })).key
  app = createApp({ db, ai })
}

beforeEach(async () => {
  await setup()
})
afterEach(async () => {
  await db.close()
})

describe('auth', () => {
  it('requires a key for public reads and an admin key for writes', async () => {
    expect((await call('GET', '/v1/screens/welcome')).status).toBe(401)
    expect((await call('GET', '/v1/screens/welcome', { key: 'fr_pub_nope' })).status).toBe(401)
    expect((await call('GET', '/api/workspace', { key: pub })).status).toBe(403)
    expect((await call('POST', '/api/publish', { key: pub })).status).toBe(403)
    expect((await call('GET', '/api/workspace', { key: admin })).status).toBe(200)
  })

  it('stores only key hashes', async () => {
    const rows = await db.query<{ key_hash: string; prefix: string }>(
      'SELECT key_hash, prefix FROM api_keys',
    )
    for (const row of rows) {
      expect(row.key_hash).toMatch(/^[0-9a-f]{64}$/)
      expect([admin, pub]).not.toContain(row.key_hash)
      expect(row.prefix.length).toBeLessThan(16)
    }
  })
})

describe('migrations', () => {
  it('are idempotent and keep $$ function bodies intact', async () => {
    expect(await migrate(db)).toEqual([])
    const parts = splitSql(
      "CREATE FUNCTION f() RETURNS trigger AS $$\nBEGIN\n  RAISE EXCEPTION 'x';\nEND;\n$$ LANGUAGE plpgsql;\nSELECT 1;",
    )
    expect(parts).toHaveLength(2)
  })
})

describe('seed', () => {
  it('creates three published versions with a story and drafts equal to live', async () => {
    const versions = (await call('GET', '/api/versions', { key: admin })).json as unknown as {
      number: number
      message: string
    }[]
    expect(versions.map((v) => `${v.number}:${v.message}`)).toEqual([
      '3:Winter Ember promo',
      '2:Add delivery cadence step',
      '1:Initial onboarding',
    ])
    const status = await call('GET', '/api/status', { key: admin })
    expect((status.json.diff as { total: number }).total).toBe(0)
    expect(await seed(db)).toEqual({ seeded: false })
  })
})

describe('public read API', () => {
  it('serves a published screen with an ETag, then 304 for If-None-Match', async () => {
    const first = await call('GET', '/v1/screens/welcome', { key: pub })
    expect(first.status).toBe(200)
    expect(first.json).toMatchObject({ protocol: 1, version: 3, screen: { slug: 'welcome' } })
    const etag = first.headers.get('etag')!
    expect(etag).toMatch(/^W\/"/)
    expect(first.headers.get('cache-control')).toBe('no-cache')

    const second = await call('GET', '/v1/screens/welcome', {
      key: pub,
      headers: { 'If-None-Match': etag },
    })
    expect(second.status).toBe(304)
    expect(second.json).toBeNull()
  })

  it('serves a flow with all of its screens in one response', async () => {
    const res = await call('GET', '/v1/flows/onboarding', { key: pub })
    expect(res.status).toBe(200)
    const screens = (res.json.screens as Screen[]).map((s) => s.slug).sort()
    expect(screens).toEqual(['cadence', 'ready', 'taste', 'welcome'])
  })

  it('never serves drafts', async () => {
    await call('PUT', '/api/screens/welcome', {
      key: admin,
      body: { ...welcome, title: 'Draft title' },
    })
    const res = await call('GET', '/v1/screens/welcome', { key: pub })
    expect((res.json.screen as Screen).title).toBe('Welcome')
    const draftOnly = await call('PUT', '/api/screens/draft-only', {
      key: admin,
      body: { slug: 'draft-only', title: 'x', root: { type: 'Spacer' } },
    })
    expect(draftOnly.status).toBe(200)
    expect((await call('GET', '/v1/screens/draft-only', { key: pub })).status).toBe(404)
  })

  it('returns 404 for unknown flows and screens', async () => {
    expect((await call('GET', '/v1/flows/nope', { key: pub })).status).toBe(404)
    expect((await call('GET', '/v1/screens/nope', { key: pub })).status).toBe(404)
  })

  it('never sends a payload newer than the client protocol', async () => {
    // Simulate a future protocol-2 version being published.
    const live = await db.query<{ snapshot: unknown }>(
      'SELECT snapshot FROM versions WHERE number = 3',
    )
    await db.query(
      `INSERT INTO versions (number, protocol, message, hash, snapshot) VALUES (4, 2, 'future', 'h4', $1)`,
      [JSON.stringify(live[0]!.snapshot)],
    )
    const old = await call('GET', '/v1/screens/welcome', {
      key: pub,
      headers: { [PROTOCOL_HEADER]: '1' },
    })
    expect(old.json.version).toBe(3)
    const modern = await call('GET', '/v1/screens/welcome', {
      key: pub,
      headers: { [PROTOCOL_HEADER]: '2' },
    })
    expect(modern.json.version).toBe(4)
    // Missing header means protocol 1.
    expect((await call('GET', '/v1/screens/welcome', { key: pub })).json.version).toBe(3)
  })
})

describe('drafts CRUD', () => {
  it('validates input and reports registry issues on save', async () => {
    const bad = await call('PUT', '/api/screens/x', {
      key: admin,
      body: { slug: 'x', title: '', root: {} },
    })
    expect(bad.status).toBe(400)
    const mismatch = await call('PUT', '/api/screens/x', { key: admin, body: { ...welcome } })
    expect(mismatch.status).toBe(400)
    const unknown = await call('PUT', '/api/screens/x', {
      key: admin,
      body: { slug: 'x', title: 'X', root: { type: 'Carousel' } },
    })
    expect(unknown.status).toBe(200)
    expect(unknown.json.issues).toEqual([
      expect.objectContaining({ message: 'Unknown component "Carousel"' }),
    ])
  })

  it('creates, reads and deletes components, screens and flows', async () => {
    const comp = { name: 'Badge', props: { label: { type: 'string', required: true } } }
    expect((await call('PUT', '/api/components/Badge', { key: admin, body: comp })).status).toBe(
      200,
    )
    expect(
      (
        (await call('GET', '/api/components', { key: admin })).json as unknown as { name: string }[]
      ).map((c) => c.name),
    ).toContain('Badge')
    expect((await call('DELETE', '/api/components/Badge', { key: admin })).status).toBe(204)
    expect((await call('DELETE', '/api/components/Badge', { key: admin })).status).toBe(404)
    expect((await call('GET', '/api/screens/welcome', { key: admin })).json.slug).toBe('welcome')
    expect((await call('DELETE', '/api/flows/onboarding', { key: admin })).status).toBe(204)
  })
})

describe('publish and rollback', () => {
  it('blocks publishing when drafts have errors', async () => {
    await call('PUT', '/api/screens/broken', {
      key: admin,
      body: { slug: 'broken', title: 'B', root: { type: 'Carousel' } },
    })
    const res = await call('POST', '/api/publish', { key: admin, body: { message: 'nope' } })
    expect(res.status).toBe(422)
    expect(res.json.issues).toEqual([expect.objectContaining({ scope: 'screen:broken' })])
  })

  it('publishes a new version, changes the ETag, and is a no-op for identical content', async () => {
    const before = await call('GET', '/v1/screens/welcome', { key: pub })
    await call('PUT', '/api/screens/welcome', {
      key: admin,
      body: { ...welcome, title: 'Hello there' },
    })

    const published = await call('POST', '/api/publish', {
      key: admin,
      body: { message: 'New title' },
    })
    expect(published.status).toBe(201)
    expect(published.json.version).toMatchObject({ number: 4, message: 'New title' })

    const after = await call('GET', '/v1/screens/welcome', {
      key: pub,
      headers: { 'If-None-Match': before.headers.get('etag')! },
    })
    expect(after.status).toBe(200)
    expect((after.json.screen as Screen).title).toBe('Hello there')

    const again = await call('POST', '/api/publish', { key: admin, body: { message: 'Same' } })
    expect(again.status).toBe(200)
    expect(again.json.created).toBe(false)
    expect((again.json.version as { number: number }).number).toBe(4)
  })

  it('rolls back by publishing a copy of an older version (history is append-only)', async () => {
    const res = await call('POST', '/api/rollback', { key: admin, body: { to: 1 } })
    expect(res.status).toBe(201)
    expect(res.json.version).toMatchObject({
      number: 4,
      rolledBackFrom: 1,
      message: 'Roll back to v1',
    })

    // v1 had no cadence screen.
    expect((await call('GET', '/v1/screens/cadence', { key: pub })).status).toBe(404)
    const flow = await call('GET', '/v1/flows/onboarding', { key: pub })
    expect((flow.json.screens as Screen[]).map((s) => s.slug).sort()).toEqual([
      'ready',
      'taste',
      'welcome',
    ])

    // Drafts follow the rollback so editors start from what is live.
    const status = await call('GET', '/api/status', { key: admin })
    expect((status.json.diff as { total: number }).total).toBe(0)

    // Rolling forward again is just another rollback.
    await call('POST', '/api/rollback', { key: admin, body: { to: 3 } })
    expect((await call('GET', '/v1/screens/cadence', { key: pub })).status).toBe(200)
    const versions = (await call('GET', '/api/versions', { key: admin }))
      .json as unknown as unknown[]
    expect(versions).toHaveLength(5)
  })

  it('rejects rollback to a version that does not exist', async () => {
    expect((await call('POST', '/api/rollback', { key: admin, body: { to: 99 } })).status).toBe(422)
    expect((await call('POST', '/api/rollback', { key: admin, body: {} })).status).toBe(400)
  })

  it('published versions are immutable at the database level', async () => {
    await expect(
      db.query(`UPDATE versions SET message = 'tampered' WHERE number = 1`),
    ).rejects.toThrow(/immutable/)
    await expect(db.query('DELETE FROM versions WHERE number = 1')).rejects.toThrow(/immutable/)
  })
})

describe('POST /v1/ai/generate', () => {
  it('is disabled without a server-side key', async () => {
    const res = await call('POST', '/v1/ai/generate', {
      key: admin,
      body: { prompt: 'Add a referral screen' },
    })
    expect(res.status).toBe(501)
  })

  it('requires an admin key', async () => {
    await db.close()
    await setup(mockProvider([recordedPlan]))
    expect(
      (await call('POST', '/v1/ai/generate', { key: pub, body: { prompt: 'x x x' } })).status,
    ).toBe(403)
  })

  it('creates drafts (component, screen, flow) and never publishes', async () => {
    await db.close()
    await setup(mockProvider([recordedPlan]))
    const res = await call('POST', '/v1/ai/generate', {
      key: admin,
      body: { prompt: 'Add a referral screen at the end of onboarding' },
    })
    expect(res.status).toBe(200)
    expect(res.json).toMatchObject({ saved: true, published: false, attempts: 1 })

    const ws = (await call('GET', '/api/workspace', { key: admin })).json as unknown as {
      components: { name: string }[]
      screens: { slug: string }[]
      flows: { slug: string; edges: { from: string; to: string }[] }[]
    }
    expect(ws.components.map((c) => c.name)).toContain('ReferralCode')
    expect(ws.screens.map((s) => s.slug)).toContain('referral')
    expect(ws.flows[0]!.edges).toContainEqual(
      expect.objectContaining({ from: 'ready', to: 'referral' }),
    )

    // Still on v3; the referral screen is not public.
    expect(
      ((await call('GET', '/api/versions', { key: admin })).json as unknown as unknown[]).length,
    ).toBe(3)
    expect((await call('GET', '/v1/screens/referral', { key: pub })).status).toBe(404)

    // A human can publish the drafts, and they validate.
    expect(
      (await call('POST', '/api/publish', { key: admin, body: { message: 'Referral step' } }))
        .status,
    ).toBe(201)
    expect((await call('GET', '/v1/screens/referral', { key: pub })).status).toBe(200)
  })
})
