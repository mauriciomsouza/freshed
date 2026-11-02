import {
  FlowPayload,
  isCompatible,
  PROTOCOL_HEADER,
  PROTOCOL_VERSION,
  ScreenPayload,
  UnsupportedProtocolError,
} from '@freshed-cms/schema'
import type { z } from 'zod'

/** AsyncStorage-compatible. Pass `@react-native-async-storage/async-storage` in an app. */
export type CacheStorage = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}

export function memoryStorage(): CacheStorage & { dump(): Record<string, string> } {
  const map = new Map<string, string>()
  return {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => {
      map.set(k, v)
    },
    dump: () => Object.fromEntries(map),
  }
}

export type ClientOptions = {
  /** e.g. "https://cms.example.com". */
  baseUrl: string
  /** Public, read-only key for the project (starts with `fr_pub_`). */
  apiKey: string
  storage?: CacheStorage
  fetch?: typeof fetch
  /** Request timeout. After it, the last good cache is used. Default 4000ms. */
  timeoutMs?: number
  /** Override for tests; production apps should leave this alone. */
  protocol?: number
}

export type FetchSource = 'network' | 'not-modified' | 'cache'

export type FetchResult<T> = {
  data: T
  source: FetchSource
  /** Set when the network failed and a cached copy was returned instead. */
  error?: unknown
}

type CacheEntry<T> = { etag: string | null; data: T; storedAt: number }

const CACHE_PREFIX = 'freshed:v1:'

export class FreshedHttpError extends Error {
  override name = 'FreshedHttpError'
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`freshed request failed with ${status}: ${url}`)
  }
}

/**
 * Read client for published content.
 *
 * - Sends `If-None-Match` with the cached ETag; a 304 costs no body.
 * - Every good payload is stored as the "last good" copy.
 * - When the network fails, times out, returns 5xx, or returns a payload
 *   this build cannot read, the last good copy is served instead, so a
 *   CMS or network problem never blanks a screen that worked before.
 */
export function createClient(options: ClientOptions) {
  const storage = options.storage ?? memoryStorage()
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  const protocol = options.protocol ?? PROTOCOL_VERSION
  const base = options.baseUrl.replace(/\/+$/, '')

  async function readCache<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const raw = await storage.getItem(CACHE_PREFIX + key)
      return raw ? (JSON.parse(raw) as CacheEntry<T>) : null
    } catch {
      return null
    }
  }

  async function writeCache<T>(key: string, entry: CacheEntry<T>) {
    try {
      await storage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
    } catch {
      // A full or broken cache must never break rendering.
    }
  }

  async function get<S extends z.ZodType<{ protocol: number }>>(
    path: string,
    schema: S,
  ): Promise<FetchResult<z.infer<S>>> {
    type T = z.infer<S>
    const cached = await readCache<T>(path)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 4000)
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
        [PROTOCOL_HEADER]: String(protocol),
      }
      if (cached?.etag) headers['If-None-Match'] = cached.etag
      const res = await doFetch(`${base}${path}`, { headers, signal: controller.signal })

      if (res.status === 304 && cached) return { data: cached.data, source: 'not-modified' }
      if (!res.ok) throw new FreshedHttpError(res.status, path)

      const body: unknown = await res.json()
      const parsed = schema.safeParse(body)
      if (!parsed.success)
        throw new Error(`Invalid payload for ${path}: ${parsed.error.issues[0]?.message ?? ''}`)
      const data = parsed.data as T
      if (!isCompatible(data.protocol, protocol))
        throw new UnsupportedProtocolError(data.protocol, protocol)

      await writeCache<T>(path, { etag: res.headers.get('ETag'), data, storedAt: Date.now() })
      return { data, source: 'network' }
    } catch (error) {
      // 404 means the content was unpublished on purpose: do not resurrect it.
      if (error instanceof FreshedHttpError && error.status === 404) throw error
      if (cached) return { data: cached.data, source: 'cache', error }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    screen: (slug: string) => get(`/v1/screens/${encodeURIComponent(slug)}`, ScreenPayload),
    flow: (slug: string) => get(`/v1/flows/${encodeURIComponent(slug)}`, FlowPayload),
    /** Read the cached copy without touching the network (instant first paint). */
    cached: async (kind: 'screens' | 'flows', slug: string) =>
      (await readCache<ScreenPayload | FlowPayload>(`/v1/${kind}/${encodeURIComponent(slug)}`))
        ?.data ?? null,
  }
}
export type FreshedClient = ReturnType<typeof createClient>

/**
 * A client that serves fixed payloads. Used by the Studio preview, tests
 * and Storybook-style development without a server.
 */
export function createStaticClient(source: {
  screens: () => ScreenPayload['screen'][]
  flows: () => FlowPayload['flow'][]
  version?: number
}): FreshedClient {
  const version = source.version ?? 1
  return {
    screen: async (slug) => {
      const screen = source.screens().find((s) => s.slug === slug)
      if (!screen) throw new FreshedHttpError(404, `/v1/screens/${slug}`)
      return { data: { protocol: PROTOCOL_VERSION, version, screen }, source: 'network' }
    },
    flow: async (slug) => {
      const flow = source.flows().find((f) => f.slug === slug)
      if (!flow) throw new FreshedHttpError(404, `/v1/flows/${slug}`)
      const screens = source.screens().filter((s) => flow.screens.includes(s.slug))
      return { data: { protocol: PROTOCOL_VERSION, version, flow, screens }, source: 'network' }
    },
    cached: async () => null,
  }
}
