import type { ScopedIssue, Version, VersionSummary, Workspace } from '@freshed-cms/schema'
import type { Backend, Status } from './backend'

/** Talks to a real freshed server with an admin key held in memory for the session. */
export function httpBackend(baseUrl: string, adminKey: string): Backend {
  const base = baseUrl.replace(/\/+$/, '')
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${base}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminKey}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (res.status === 204) return undefined as T
    const json = (await res.json().catch(() => ({}))) as T & { message?: string }
    if (!res.ok && res.status !== 422)
      throw new Error(json.message ?? `Request failed (${res.status})`)
    return json
  }
  return {
    kind: 'server',
    workspace: () => call<Workspace>('GET', '/workspace'),
    status: () => call<Status>('GET', '/status'),
    saveScreen: async (s) => void (await call('PUT', `/screens/${s.slug}`, s)),
    deleteScreen: async (slug) => void (await call('DELETE', `/screens/${slug}`)),
    saveFlow: async (f) => void (await call('PUT', `/flows/${f.slug}`, f)),
    saveComponent: async (c) => void (await call('PUT', `/components/${c.name}`, c)),
    versions: () => call<VersionSummary[]>('GET', '/versions'),
    version: (n) => call<Version | null>('GET', `/versions/${n}`),
    async publish(message) {
      const r = await call<{
        version?: VersionSummary
        created?: boolean
        issues?: ScopedIssue[]
        message?: string
      }>('POST', '/publish', { message })
      if (r.issues) return { ok: false, issues: r.issues, message: r.message ?? 'Publish failed' }
      return { ok: true, version: r.version!, created: r.created ?? true }
    },
    rollback: async (to) =>
      (await call<{ version: VersionSummary }>('POST', '/rollback', { to })).version,
  }
}
