import type {
  ComponentDefinition,
  Flow,
  Screen,
  ScopedIssue,
  SnapshotDiff,
  Version,
  VersionSummary,
  Workspace,
} from '@freshed-cms/schema'

export type PublishResult =
  | { ok: true; version: VersionSummary; created: boolean }
  | { ok: false; issues: ScopedIssue[]; message: string }

export type Status = { live: { number: number; hash: string } | null; diff: SnapshotDiff }

/**
 * Everything the Studio needs from a backend. Two implementations:
 * `demoBackend` (in the browser, for the static demo) and `httpBackend`
 * (a real freshed server). The UI cannot tell them apart.
 */
export interface Backend {
  readonly kind: 'demo' | 'server'
  workspace(): Promise<Workspace>
  status(): Promise<Status>
  saveScreen(screen: Screen): Promise<void>
  deleteScreen(slug: string): Promise<void>
  saveFlow(flow: Flow): Promise<void>
  saveComponent(component: ComponentDefinition): Promise<void>
  versions(): Promise<VersionSummary[]>
  version(number: number): Promise<Version | null>
  publish(message: string): Promise<PublishResult>
  rollback(to: number): Promise<VersionSummary>
  /** Demo only: wipe local changes and reseed. */
  reset?(): Promise<void>
}

/** Storage that never throws: private windows, blocked storage and quota errors all degrade to memory. */
export function safeStorage(kind: 'local' | 'session') {
  const memory = new Map<string, string>()
  const target = () => {
    try {
      return kind === 'local' ? window.localStorage : window.sessionStorage
    } catch {
      return null
    }
  }
  return {
    get(key: string): string | null {
      try {
        return target()?.getItem(key) ?? memory.get(key) ?? null
      } catch {
        return memory.get(key) ?? null
      }
    },
    set(key: string, value: string) {
      memory.set(key, value)
      try {
        target()?.setItem(key, value)
      } catch {
        // keep the in-memory copy
      }
    },
    remove(key: string) {
      memory.delete(key)
      try {
        target()?.removeItem(key)
      } catch {
        // ignore
      }
    },
  }
}
