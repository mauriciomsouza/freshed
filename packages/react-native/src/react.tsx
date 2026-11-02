import type { Action, Flow, Screen } from '@freshed-cms/schema'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { Text, View } from 'react-native'
import {
  createDispatcher,
  type ActionContext,
  type ActionEvent,
  type ActionHandlers,
} from './core/actions.js'
import type { FetchSource, FreshedClient } from './core/client.js'
import { createFlowState, transition, type FlowState, type FlowTransition } from './core/flow.js'
import { createRegistry, type RegisteredComponent, type Registry } from './core/registry.js'
import {
  resolveTree,
  type ResolvedFallback,
  type ResolvedNode,
  type ResolveWarning,
} from './core/resolve.js'

type AnyComponent = ComponentType<Record<string, unknown>>

export type FallbackProps = { node: ResolvedFallback }

type ContextValue = {
  client: FreshedClient
  registry: Registry<AnyComponent>
  actions: ActionHandlers
  Fallback: ComponentType<FallbackProps>
  onAction?: (event: ActionEvent) => void
  onWarning?: (warning: ResolveWarning) => void
}

const FreshedContext = createContext<ContextValue | null>(null)

export type FreshedProviderProps = {
  client: FreshedClient
  /** Either a registry from `createRegistry` or the list of components. */
  registry: Registry<AnyComponent> | readonly RegisteredComponent<AnyComponent>[]
  /** App implementations for actions: openUrl, share, copy, submit, dismiss... */
  actions?: ActionHandlers
  /** Rendered in place of components this build does not know. Defaults to nothing in production. */
  fallback?: ComponentType<FallbackProps>
  onAction?: (event: ActionEvent) => void
  onWarning?: (warning: ResolveWarning) => void
  children: ReactNode
}

/**
 * Default fallback: in development it shows a visible placeholder so a
 * missing component is obvious; in production it renders nothing, which is
 * the safest thing an old build can do with a component it does not have.
 */
export function DefaultFallback({ node }: FallbackProps) {
  const dev = typeof __DEV__ !== 'undefined' ? __DEV__ : false
  if (!dev) return null
  return (
    <View
      accessibilityRole="alert"
      style={{
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#d4a017',
      }}
    >
      <Text style={{ fontSize: 12, color: '#8a6d00' }}>Unknown component “{node.type}”</Text>
    </View>
  )
}

declare const __DEV__: boolean | undefined

export function FreshedProvider(props: FreshedProviderProps) {
  const { client, registry, actions, fallback, onAction, onWarning, children } = props
  const value = useMemo<ContextValue>(
    () => ({
      client,
      registry: 'get' in registry ? registry : createRegistry(registry),
      actions: actions ?? {},
      Fallback: fallback ?? DefaultFallback,
      onAction,
      onWarning,
    }),
    [client, registry, actions, fallback, onAction, onWarning],
  )
  return <FreshedContext.Provider value={value}>{children}</FreshedContext.Provider>
}

export function useFreshed(): ContextValue {
  const ctx = useContext(FreshedContext)
  if (!ctx) throw new Error('freshed: wrap your app in <FreshedProvider>')
  return ctx
}

function RenderNode({
  node,
  Fallback,
}: {
  node: ResolvedNode<AnyComponent>
  Fallback: ComponentType<FallbackProps>
}) {
  if (node.kind === 'fallback') return <Fallback node={node} />
  const Component = node.render
  const children = node.children.map((child) => (
    <RenderNode key={child.key} node={child} Fallback={Fallback} />
  ))
  return <Component {...node.props}>{children.length ? children : undefined}</Component>
}

export type ScreenRendererProps = {
  screen: Screen
  /** Extra handlers layered before the provider's (flows use this). */
  handlers?: ActionHandlers
}

/** Renders an already-loaded Screen object. Used by FreshedScreen, flows and the Studio preview. */
export function ScreenRenderer({ screen, handlers }: ScreenRendererProps) {
  const { registry, actions, Fallback, onAction, onWarning } = useFreshed()
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const tree = useMemo(() => {
    const dispatch = createDispatcher([handlersRef.current ?? {}, actions], { onAction })
    const context: ActionContext = { screen: screen.slug }
    return resolveTree(screen.root, registry, {
      bindAction: (action: Action) => () => void dispatch(action, context),
      onWarning,
    })
  }, [screen, registry, actions, onAction, onWarning])

  return <RenderNode node={tree} Fallback={Fallback} />
}

type LoadState<T> =
  | { status: 'loading'; data: null; source: null; error: null }
  | { status: 'ready'; data: T; source: FetchSource; error: unknown }
  | { status: 'error'; data: null; source: null; error: unknown }

function useLoad<T>(
  load: () => Promise<{ data: T; source: FetchSource; error?: unknown }>,
  key: string,
) {
  const [state, setState] = useState<LoadState<T>>({
    status: 'loading',
    data: null,
    source: null,
    error: null,
  })
  const [nonce, setNonce] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    let alive = true
    loadRef.current().then(
      (r) =>
        alive &&
        setState({ status: 'ready', data: r.data, source: r.source, error: r.error ?? null }),
      (error: unknown) => alive && setState({ status: 'error', data: null, source: null, error }),
    )
    return () => {
      alive = false
    }
  }, [key, nonce])
  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, reload }
}

export type FreshedScreenProps = {
  slug: string
  loading?: ReactNode
  /** Shown when nothing could be loaded and there is no cached copy. */
  error?: ReactNode | ((error: unknown, retry: () => void) => ReactNode)
}

/** Fetches a published screen by slug and renders it. */
export function FreshedScreen({ slug, loading = null, error = null }: FreshedScreenProps) {
  const { client } = useFreshed()
  const state = useLoad(() => client.screen(slug), slug)
  if (state.status === 'loading') return <>{loading}</>
  if (state.status === 'error')
    return <>{typeof error === 'function' ? error(state.error, state.reload) : error}</>
  return <ScreenRenderer screen={state.data.screen} />
}

export type UseFlowResult = {
  status: 'loading' | 'ready' | 'error'
  flow: Flow | null
  screen: Screen | null
  state: FlowState | null
  last: FlowTransition | null
  error: unknown
  emit: (event: string) => void
  back: () => boolean
  reset: () => void
  /** Handlers to pass to ScreenRenderer so emit/navigate/back drive the flow. */
  handlers: ActionHandlers
}

/**
 * Loads a published flow (all of its screens in one request) and drives it.
 * `back()` returns false at the first screen so the app can fall back to
 * its own navigation (e.g. leave the onboarding stack).
 */
export function useFlow(
  slug: string,
  options: { onEnd?: (from: string, event: string) => void } = {},
): UseFlowResult {
  const { client } = useFreshed()
  const loaded = useLoad(() => client.flow(slug), slug)
  const [flowState, setFlowState] = useState<FlowState | null>(null)
  const [last, setLast] = useState<FlowTransition | null>(null)
  const onEndRef = useRef(options.onEnd)
  onEndRef.current = options.onEnd

  const flow = loaded.status === 'ready' ? loaded.data.flow : null
  const screens = loaded.status === 'ready' ? loaded.data.screens : null

  useEffect(() => {
    if (flow) setFlowState(createFlowState(flow))
  }, [flow])

  const stateRef = useRef(flowState)
  stateRef.current = flowState

  const apply = useCallback(
    (input: Parameters<typeof transition>[2]): FlowTransition | null => {
      if (!flow || !stateRef.current) return null
      const next = transition(flow, stateRef.current, input)
      stateRef.current = next.state
      setFlowState(next.state)
      setLast(next.result)
      if (next.result.type === 'ended') onEndRef.current?.(next.result.from, next.result.event)
      return next.result
    },
    [flow],
  )

  const handlers = useMemo<ActionHandlers>(
    () => ({
      emit: (a) => void apply({ type: 'emit', event: a.event }),
      navigate: (a) => void apply({ type: 'navigate', to: a.to }),
      back: () => void apply({ type: 'back' }),
      submit: (a) => {
        if (a.event) apply({ type: 'emit', event: a.event })
      },
    }),
    [apply],
  )

  const screen = useMemo(
    () =>
      flowState && screens ? (screens.find((s) => s.slug === flowState.current) ?? null) : null,
    [flowState, screens],
  )

  return {
    status: loaded.status === 'ready' && !flowState ? 'loading' : loaded.status,
    flow,
    screen,
    state: flowState,
    last,
    error: loaded.error,
    emit: (event) => void apply({ type: 'emit', event }),
    back: () => apply({ type: 'back' })?.type === 'moved',
    reset: () => flow && void apply({ type: 'reset', start: flow.start }),
    handlers,
  }
}

export type FreshedFlowProps = {
  slug: string
  onEnd?: (from: string, event: string) => void
  loading?: ReactNode
  error?: ReactNode
}

/** Renders a whole flow: the current screen, wired so actions move through edges. */
export function FreshedFlow({ slug, onEnd, loading = null, error = null }: FreshedFlowProps) {
  const flow = useFlow(slug, { onEnd })
  if (flow.status === 'loading') return <>{loading}</>
  if (flow.status === 'error' || !flow.screen) return <>{error}</>
  return <ScreenRenderer screen={flow.screen} handlers={flow.handlers} />
}
