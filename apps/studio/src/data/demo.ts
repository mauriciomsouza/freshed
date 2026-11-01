import { brewComponents, brewFlows, brewScreens, seedHistory } from '@freshed/example-brew'
import {
  checkWorkspace,
  diffSnapshots,
  PROTOCOL_VERSION,
  snapshotHash,
  toSnapshot,
  type Version,
  type VersionSummary,
  type Workspace,
} from '@freshed/schema'
import { safeStorage, type Backend } from './backend'

/**
 * Demo backend: the same publish/rollback rules as the server, running in
 * the browser. State is saved to localStorage when available and is never
 * sent anywhere.
 */

const KEY = 'freshed:demo:v1'

type DemoState = { drafts: Workspace; versions: Version[] }

const DAY = 86_400_000

function seedState(): DemoState {
  const versions: Version[] = []
  const now = Date.now()
  seedHistory.forEach((step, i) => {
    const snapshot = toSnapshot({
      components: brewComponents,
      screens: step.screens,
      flows: step.flows,
    })
    versions.push({
      number: i + 1,
      protocol: PROTOCOL_VERSION,
      message: step.message,
      createdAt: new Date(now - (seedHistory.length - i) * 3 * DAY + i * 3_600_000).toISOString(),
      createdBy: ['Ana', 'Ana', 'Theo'][i],
      hash: snapshotHash(snapshot),
      snapshot,
    })
  })
  return {
    drafts: structuredClone({ components: brewComponents, screens: brewScreens, flows: brewFlows }),
    versions,
  }
}

const summarize = (v: Version): VersionSummary => {
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

export function demoBackend(options: { persist?: boolean; reset?: boolean } = {}): Backend {
  const storage = safeStorage('local')
  const persist = options.persist !== false
  let state: DemoState = options.reset ? seedState() : load()
  if (options.reset) save()

  function load(): DemoState {
    if (!persist) return seedState()
    try {
      const raw = storage.get(KEY)
      if (raw) return JSON.parse(raw) as DemoState
    } catch {
      // corrupted: reseed
    }
    return seedState()
  }
  function save() {
    if (persist) storage.set(KEY, JSON.stringify(state))
  }
  const clone = <T>(v: T): T => structuredClone(v)
  const live = () => state.versions.at(-1) ?? null

  function append(snapshot: Version['snapshot'], message: string, rolledBackFrom?: number) {
    const version: Version = {
      number: (live()?.number ?? 0) + 1,
      protocol: PROTOCOL_VERSION,
      message,
      createdAt: new Date().toISOString(),
      createdBy: 'You',
      hash: snapshotHash(snapshot),
      rolledBackFrom,
      snapshot: clone(snapshot),
    }
    state.versions.push(version)
    return version
  }

  return {
    kind: 'demo',
    async workspace() {
      return clone(state.drafts)
    },
    async status() {
      const l = live()
      return {
        live: l ? { number: l.number, hash: l.hash } : null,
        diff: diffSnapshots(l?.snapshot ?? null, toSnapshot(state.drafts)),
      }
    },
    async saveScreen(screen) {
      const i = state.drafts.screens.findIndex((s) => s.slug === screen.slug)
      if (i >= 0) state.drafts.screens[i] = clone(screen)
      else state.drafts.screens.push(clone(screen))
      save()
    },
    async deleteScreen(slug) {
      state.drafts.screens = state.drafts.screens.filter((s) => s.slug !== slug)
      save()
    },
    async saveFlow(flow) {
      const i = state.drafts.flows.findIndex((f) => f.slug === flow.slug)
      if (i >= 0) state.drafts.flows[i] = clone(flow)
      else state.drafts.flows.push(clone(flow))
      save()
    },
    async saveComponent(component) {
      const i = state.drafts.components.findIndex((c) => c.name === component.name)
      if (i >= 0) state.drafts.components[i] = clone(component)
      else state.drafts.components.push(clone(component))
      save()
    },
    async versions() {
      return [...state.versions].reverse().map(summarize)
    },
    async version(number) {
      const v = state.versions.find((x) => x.number === number)
      return v ? clone(v) : null
    },
    async publish(message) {
      const check = checkWorkspace(state.drafts)
      if (!check.ok) {
        return {
          ok: false,
          message: 'Fix validation errors before publishing',
          issues: check.issues.filter((i) => i.severity === 'error'),
        }
      }
      const snapshot = toSnapshot(state.drafts)
      const l = live()
      if (l && l.hash === snapshotHash(snapshot))
        return { ok: true, version: summarize(l), created: false }
      const v = append(snapshot, message)
      save()
      return { ok: true, version: summarize(v), created: true }
    },
    async rollback(to) {
      const target = state.versions.find((v) => v.number === to)
      if (!target) throw new Error(`Version ${to} does not exist`)
      const v = append(target.snapshot, `Roll back to v${to}`, to)
      state.drafts = clone(target.snapshot)
      save()
      return summarize(v)
    },
    async reset() {
      state = seedState()
      save()
    },
  }
}
