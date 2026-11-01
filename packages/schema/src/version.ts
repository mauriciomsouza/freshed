import { z } from 'zod'
import { ComponentDefinition } from './component.js'
import { Flow } from './flow.js'
import { Screen } from './screen.js'

/**
 * A Version is an immutable snapshot of everything the app can read:
 * component definitions, screens and flows, as they were at publish time.
 * Rolling back never edits history; it publishes a new Version whose
 * content is copied from an older one.
 */
export const VersionSnapshot = z.object({
  components: z.array(ComponentDefinition),
  screens: z.array(Screen),
  flows: z.array(Flow),
})
export type VersionSnapshot = z.infer<typeof VersionSnapshot>

export const Version = z.object({
  /** Monotonic, starts at 1. */
  number: z.number().int().positive(),
  protocol: z.number().int().positive(),
  message: z.string().max(200),
  createdAt: z.string(),
  createdBy: z.string().max(80).optional(),
  /** Set when this version was created by rolling back to an older one. */
  rolledBackFrom: z.number().int().positive().optional(),
  /** Content hash; doubles as the ETag seed for public reads. */
  hash: z.string(),
  snapshot: VersionSnapshot,
})
export type Version = z.infer<typeof Version>

export type VersionSummary = Omit<Version, 'snapshot'> & {
  counts: { components: number; screens: number; flows: number }
}

/** What `GET /v1/screens/:slug` returns. */
export const ScreenPayload = z.object({
  protocol: z.number().int().positive(),
  version: z.number().int().positive(),
  screen: Screen,
})
export type ScreenPayload = z.infer<typeof ScreenPayload>

/** What `GET /v1/flows/:slug` returns: the flow and every screen in it, in one request. */
export const FlowPayload = z.object({
  protocol: z.number().int().positive(),
  version: z.number().int().positive(),
  flow: Flow,
  screens: z.array(Screen),
})
export type FlowPayload = z.infer<typeof FlowPayload>

/** Stable JSON: object keys sorted, so equal content hashes equally. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * Small, dependency-free 53-bit hash (cyrb53). Not cryptographic: it only
 * needs to change when content changes, for ETags and cache keys.
 */
export function contentHash(value: unknown): string {
  const str = typeof value === 'string' ? value : stableStringify(value)
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}
