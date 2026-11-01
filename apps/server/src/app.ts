import { generatePlan, type Provider } from '@freshed/ai'
import {
  ComponentDefinition,
  diffSnapshots,
  Flow,
  parseProtocolHeader,
  PROTOCOL_HEADER,
  Screen,
  toSnapshot,
  validateFlow,
  validateScreen,
  type Version,
} from '@freshed/schema'
import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import type { Db } from './db.js'
import { verifyApiKey, type KeyKind } from './keys.js'
import { createStore, PublishError } from './store.js'

export type AppOptions = {
  db: Db
  /** Server-side AI provider (key from server env only). Omit to disable /v1/ai. */
  ai?: Provider | null
  /** Origins allowed to call the admin API from a browser (the Studio). */
  corsOrigins?: string[]
}

type Env = { Variables: { keyKind: KeyKind } }

function bearer(c: Context): string | undefined {
  const header = c.req.header('authorization')
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined
}

function auth(db: Db, need: KeyKind): MiddlewareHandler<Env> {
  return async (c, next) => {
    const kind = await verifyApiKey(db, bearer(c))
    if (!kind) return c.json({ error: 'unauthorized', message: 'Missing or invalid API key' }, 401)
    if (need === 'admin' && kind !== 'admin') {
      return c.json({ error: 'forbidden', message: 'This endpoint needs an admin key' }, 403)
    }
    c.set('keyKind', kind)
    await next()
  }
}

/** Weak ETag: version hash + resource. Changes whenever published content changes. */
function etagFor(version: Version, resource: string) {
  return `W/"${version.hash}-${version.number}-${resource}"`
}

function matches(ifNoneMatch: string | undefined, etag: string) {
  if (!ifNoneMatch) return false
  return ifNoneMatch.split(',').some((t) => t.trim() === etag || t.trim() === '*')
}

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return undefined
  }
}

const PublishBody = z.object({ message: z.string().max(200).optional() }).default({})
const RollbackBody = z.object({
  to: z.number().int().positive(),
  restoreDrafts: z.boolean().optional(),
})
const AiBody = z.object({ prompt: z.string().min(3).max(2000), save: z.boolean().optional() })

export function createApp(options: AppOptions) {
  const { db } = options
  const store = createStore(db)
  const app = new Hono<Env>()

  app.use(
    '*',
    cors({
      origin: options.corsOrigins ?? [],
      allowHeaders: ['Authorization', 'Content-Type', 'If-None-Match', PROTOCOL_HEADER],
      exposeHeaders: ['ETag'],
    }),
  )

  app.onError((err, c) => {
    if (err instanceof PublishError)
      return c.json({ error: 'publish_failed', message: err.message, issues: err.issues }, 422)
    console.error(err)
    return c.json({ error: 'internal', message: 'Internal server error' }, 500)
  })

  app.get('/health', (c) => c.json({ ok: true }))

  // ---------------------------------------------------------------------------
  // Public read API: published content only, cacheable, protocol-aware.
  // ---------------------------------------------------------------------------
  const pub = new Hono<Env>()
  pub.use('*', auth(db, 'public'))

  pub.get('/screens/:slug', async (c) => {
    const protocol = parseProtocolHeader(c.req.header(PROTOCOL_HEADER))
    const live = await store.live(protocol)
    const screen = live?.snapshot.screens.find((s) => s.slug === c.req.param('slug'))
    if (!live || !screen)
      return c.json({ error: 'not_found', message: 'Screen is not published' }, 404)
    const etag = etagFor(live, `s:${screen.slug}`)
    c.header('ETag', etag)
    c.header('Cache-Control', 'no-cache')
    c.header('Vary', `Authorization, ${PROTOCOL_HEADER}`)
    if (matches(c.req.header('if-none-match'), etag)) return c.body(null, 304)
    return c.json({ protocol: live.protocol, version: live.number, screen })
  })

  pub.get('/flows/:slug', async (c) => {
    const protocol = parseProtocolHeader(c.req.header(PROTOCOL_HEADER))
    const live = await store.live(protocol)
    const flow = live?.snapshot.flows.find((f) => f.slug === c.req.param('slug'))
    if (!live || !flow) return c.json({ error: 'not_found', message: 'Flow is not published' }, 404)
    const etag = etagFor(live, `f:${flow.slug}`)
    c.header('ETag', etag)
    c.header('Cache-Control', 'no-cache')
    c.header('Vary', `Authorization, ${PROTOCOL_HEADER}`)
    if (matches(c.req.header('if-none-match'), etag)) return c.body(null, 304)
    const screens = live.snapshot.screens.filter((s) => flow.screens.includes(s.slug))
    return c.json({ protocol: live.protocol, version: live.number, flow, screens })
  })

  // ---------------------------------------------------------------------------
  // Server-side AI: key comes from server env only. Creates drafts, never publishes.
  // ---------------------------------------------------------------------------
  pub.post('/ai/generate', async (c) => {
    if (c.get('keyKind') !== 'admin')
      return c.json({ error: 'forbidden', message: 'This endpoint needs an admin key' }, 403)
    if (!options.ai) {
      return c.json(
        {
          error: 'ai_disabled',
          message: 'Set FRESHED_AI_KEY on the server to enable server-side generation',
        },
        501,
      )
    }
    const body = AiBody.safeParse(await readJson(c))
    if (!body.success) return c.json({ error: 'invalid', issues: body.error.issues }, 400)
    const workspace = await store.workspace()
    const result = await generatePlan(options.ai, { prompt: body.data.prompt, workspace })
    if (!result.ok)
      return c.json(
        { error: 'generation_invalid', issues: result.issues, attempts: result.attempts },
        422,
      )

    const saved = body.data.save !== false
    if (saved) {
      for (const comp of result.plan.newComponents) await store.upsertComponent(comp.definition)
      for (const screen of result.plan.screens) await store.upsertScreen(screen)
      for (const flow of result.drafts.flows) {
        if (result.plan.flowEdges.some((e) => e.flow === flow.slug)) await store.upsertFlow(flow)
      }
    }
    return c.json({
      plan: result.plan,
      saved,
      published: false,
      attempts: result.attempts,
      warnings: result.warnings,
      model: result.model,
    })
  })

  app.route('/v1', pub)

  // ---------------------------------------------------------------------------
  // Admin API: drafts, publish, rollback. Used by the Studio and the CLI.
  // ---------------------------------------------------------------------------
  const admin = new Hono<Env>()
  admin.use('*', auth(db, 'admin'))

  admin.get('/workspace', async (c) => c.json(await store.workspace()))

  admin.get('/status', async (c) => {
    const [ws, live] = await Promise.all([store.workspace(), store.live()])
    const diff = diffSnapshots(live?.snapshot ?? null, toSnapshot(ws))
    return c.json({ live: live ? { number: live.number, hash: live.hash } : null, diff })
  })

  admin.get('/components', async (c) => c.json((await store.workspace()).components))
  admin.put('/components/:name', async (c) => {
    const parsed = ComponentDefinition.safeParse(await readJson(c))
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400)
    if (parsed.data.name !== c.req.param('name'))
      return c.json({ error: 'invalid', message: 'Name mismatch' }, 400)
    await store.upsertComponent(parsed.data)
    return c.json(parsed.data)
  })
  admin.delete('/components/:name', async (c) =>
    (await store.deleteComponent(c.req.param('name')))
      ? c.body(null, 204)
      : c.json({ error: 'not_found' }, 404),
  )

  admin.get('/screens', async (c) => c.json((await store.workspace()).screens))
  admin.get('/screens/:slug', async (c) => {
    const screen = await store.getScreen(c.req.param('slug'))
    return screen ? c.json(screen) : c.json({ error: 'not_found' }, 404)
  })
  admin.put('/screens/:slug', async (c) => {
    const parsed = Screen.safeParse(await readJson(c))
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400)
    if (parsed.data.slug !== c.req.param('slug'))
      return c.json({ error: 'invalid', message: 'Slug mismatch' }, 400)
    await store.upsertScreen(parsed.data)
    const { components } = await store.workspace()
    // Drafts may be work in progress: save them, and report registry issues alongside.
    return c.json({ screen: parsed.data, issues: validateScreen(parsed.data, components).issues })
  })
  admin.delete('/screens/:slug', async (c) =>
    (await store.deleteScreen(c.req.param('slug')))
      ? c.body(null, 204)
      : c.json({ error: 'not_found' }, 404),
  )

  admin.get('/flows', async (c) => c.json((await store.workspace()).flows))
  admin.put('/flows/:slug', async (c) => {
    const parsed = Flow.safeParse(await readJson(c))
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400)
    if (parsed.data.slug !== c.req.param('slug'))
      return c.json({ error: 'invalid', message: 'Slug mismatch' }, 400)
    await store.upsertFlow(parsed.data)
    const { screens } = await store.workspace()
    return c.json({ flow: parsed.data, issues: validateFlow(parsed.data, screens).issues })
  })
  admin.delete('/flows/:slug', async (c) =>
    (await store.deleteFlow(c.req.param('slug')))
      ? c.body(null, 204)
      : c.json({ error: 'not_found' }, 404),
  )

  admin.get('/versions', async (c) => c.json(await store.versions()))
  admin.get('/versions/:number', async (c) => {
    const v = await store.version(Number(c.req.param('number')))
    return v ? c.json(v) : c.json({ error: 'not_found' }, 404)
  })

  admin.post('/publish', async (c) => {
    const body = PublishBody.safeParse((await readJson(c)) ?? {})
    if (!body.success) return c.json({ error: 'invalid', issues: body.error.issues }, 400)
    const { version, created } = await store.publish({ message: body.data.message })
    return c.json({ version: { ...version, snapshot: undefined }, created }, created ? 201 : 200)
  })

  admin.post('/rollback', async (c) => {
    const body = RollbackBody.safeParse(await readJson(c))
    if (!body.success) return c.json({ error: 'invalid', issues: body.error.issues }, 400)
    const { version } = await store.rollback({
      to: body.data.to,
      restoreDrafts: body.data.restoreDrafts,
    })
    return c.json({ version: { ...version, snapshot: undefined } }, 201)
  })

  app.route('/api', admin)
  // The CLI and docs use the same paths under /api for admin and /v1 for public reads.
  return app
}
