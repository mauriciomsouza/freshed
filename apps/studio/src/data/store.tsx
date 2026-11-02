import type {
  Flow,
  Screen,
  VersionSummary,
  Workspace,
  ComponentDefinition,
} from '@freshed-cms/schema'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Backend, PublishResult, Status } from './backend'

type StoreValue = {
  backend: Backend
  ready: boolean
  workspace: Workspace
  status: Status | null
  versions: VersionSummary[]
  refresh: () => Promise<void>
  saveScreen: (s: Screen) => Promise<void>
  deleteScreen: (slug: string) => Promise<void>
  saveFlow: (f: Flow) => Promise<void>
  saveComponent: (c: ComponentDefinition) => Promise<void>
  publish: (message: string) => Promise<PublishResult>
  rollback: (to: number) => Promise<VersionSummary>
  reset?: () => Promise<void>
  toast: (message: string) => void
  toastMessage: { id: number; text: string } | null
}

const Ctx = createContext<StoreValue | null>(null)

const empty: Workspace = { components: [], screens: [], flows: [] }

export function StoreProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace>(empty)
  const [status, setStatus] = useState<Status | null>(null)
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [ready, setReady] = useState(false)
  const [toastMessage, setToast] = useState<{ id: number; text: string } | null>(null)

  const refresh = useCallback(async () => {
    const [ws, st, vs] = await Promise.all([
      backend.workspace(),
      backend.status(),
      backend.versions(),
    ])
    setWorkspace(ws)
    setStatus(st)
    setVersions(vs)
    setReady(true)
  }, [backend])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const toast = useCallback((text: string) => setToast({ id: Date.now(), text }), [])
  useEffect(() => {
    if (!toastMessage) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toastMessage])

  const value = useMemo<StoreValue>(() => {
    const after =
      <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
      async (...args: A) => {
        const r = await fn(...args)
        await refresh()
        return r
      }
    return {
      backend,
      ready,
      workspace,
      status,
      versions,
      refresh,
      saveScreen: after(backend.saveScreen.bind(backend)),
      deleteScreen: after(backend.deleteScreen.bind(backend)),
      saveFlow: after(backend.saveFlow.bind(backend)),
      saveComponent: after(backend.saveComponent.bind(backend)),
      publish: after(backend.publish.bind(backend)),
      rollback: after(backend.rollback.bind(backend)),
      reset: backend.reset ? after(backend.reset.bind(backend)) : undefined,
      toast,
      toastMessage,
    }
  }, [backend, ready, workspace, status, versions, refresh, toast, toastMessage])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore outside StoreProvider')
  return v
}

/** Number of unpublished changes, for the sidebar badge. */
export function usePendingCount() {
  return useStore().status?.diff.total ?? 0
}
