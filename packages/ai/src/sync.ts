import type { ComponentDefinition, Flow, Screen } from '@freshed-cms/schema'
import type { GenerationPlan } from './plan.js'

/**
 * Minimal admin client used by the CLI to sync a plan to a freshed server
 * as drafts. It only calls draft endpoints; there is intentionally no
 * publish method here.
 */
export type AdminClientOptions = {
  baseUrl: string
  /** Admin key (fr_admin_...) for the project. Read from env, never from the plan. */
  adminKey: string
  fetch?: typeof fetch
}

export function createAdminClient(options: AdminClientOptions) {
  const base = options.baseUrl.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await doFetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${options.adminKey}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`)
    }
    return (await res.json()) as T
  }
  return {
    workspace: () =>
      call<{ components: ComponentDefinition[]; screens: Screen[]; flows: Flow[] }>(
        'GET',
        '/api/workspace',
      ),
    putComponent: (c: ComponentDefinition) =>
      call('PUT', `/api/components/${encodeURIComponent(c.name)}`, c),
    putScreen: (s: Screen) => call('PUT', `/api/screens/${encodeURIComponent(s.slug)}`, s),
    putFlow: (f: Flow) => call('PUT', `/api/flows/${encodeURIComponent(f.slug)}`, f),
  }
}
export type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Pushes a plan to the server as drafts, components first so screens that
 * use them validate. Returns what was written.
 */
export async function syncPlanToServer(
  client: AdminClient,
  plan: GenerationPlan,
  drafts: { flows: Flow[] },
): Promise<{ components: string[]; screens: string[]; flows: string[] }> {
  for (const c of plan.newComponents) await client.putComponent(c.definition)
  for (const s of plan.screens) await client.putScreen(s)
  const flowSlugs = [...new Set(plan.flowEdges.map((e) => e.flow))]
  for (const slug of flowSlugs) {
    const flow = drafts.flows.find((f) => f.slug === slug)
    if (flow) await client.putFlow(flow)
  }
  return {
    components: plan.newComponents.map((c) => c.definition.name),
    screens: plan.screens.map((s) => s.slug),
    flows: flowSlugs,
  }
}
