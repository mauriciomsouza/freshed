import { validateFlow, validateScreen, type Issue } from './validate.js'
import { contentHash, stableStringify, type VersionSnapshot } from './version.js'

/** The editable state of a project: everything that can be published. */
export type Workspace = VersionSnapshot

export type ScopedIssue = Issue & { scope: `screen:${string}` | `flow:${string}` }

/**
 * Runs every publish-time check. Publishing is blocked by any error;
 * warnings are shown but do not block.
 */
export function checkWorkspace(ws: Workspace): { ok: boolean; issues: ScopedIssue[] } {
  const issues: ScopedIssue[] = []
  for (const screen of ws.screens) {
    const r = validateScreen(screen, ws.components)
    issues.push(...r.issues.map((i) => ({ ...i, scope: `screen:${screen.slug}` as const })))
  }
  for (const flow of ws.flows) {
    const r = validateFlow(flow, ws.screens)
    issues.push(...r.issues.map((i) => ({ ...i, scope: `flow:${flow.slug}` as const })))
  }
  return { ok: !issues.some((i) => i.severity === 'error'), issues }
}

/** Sorted, normalized snapshot so equal content always hashes equally. */
export function toSnapshot(ws: Workspace): VersionSnapshot {
  const by =
    <T>(key: (t: T) => string) =>
    (a: T, b: T) =>
      key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0
  return {
    components: [...ws.components].sort(by((c) => c.name)),
    screens: [...ws.screens].sort(by((s) => s.slug)),
    flows: [...ws.flows].sort(by((f) => f.slug)),
  }
}

export function snapshotHash(snapshot: VersionSnapshot): string {
  return contentHash(stableStringify(toSnapshot(snapshot)))
}

export type ChangeSet = { added: string[]; changed: string[]; removed: string[] }
export type SnapshotDiff = {
  components: ChangeSet
  screens: ChangeSet
  flows: ChangeSet
  total: number
}

function diffBy<T>(before: T[], after: T[], key: (t: T) => string): ChangeSet {
  const a = new Map(before.map((t) => [key(t), stableStringify(t)]))
  const b = new Map(after.map((t) => [key(t), stableStringify(t)]))
  return {
    added: [...b.keys()].filter((k) => !a.has(k)).sort(),
    removed: [...a.keys()].filter((k) => !b.has(k)).sort(),
    changed: [...b.keys()].filter((k) => a.has(k) && a.get(k) !== b.get(k)).sort(),
  }
}

/** What changed between two snapshots (e.g. drafts vs. live, or v3 vs. v4). */
export function diffSnapshots(
  before: VersionSnapshot | null,
  after: VersionSnapshot,
): SnapshotDiff {
  const empty: VersionSnapshot = { components: [], screens: [], flows: [] }
  const b = before ?? empty
  const components = diffBy(b.components, after.components, (c) => c.name)
  const screens = diffBy(b.screens, after.screens, (s) => s.slug)
  const flows = diffBy(b.flows, after.flows, (f) => f.slug)
  const count = (c: ChangeSet) => c.added.length + c.changed.length + c.removed.length
  return { components, screens, flows, total: count(components) + count(screens) + count(flows) }
}
