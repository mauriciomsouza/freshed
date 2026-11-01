import { FLOW_END, resolveEdge, type Flow, type Screen } from '@freshed/schema'
import type { ActionHandlers } from './actions.js'

export type FlowState = {
  current: string
  history: string[]
  ended: boolean
}

export type FlowTransition =
  | { type: 'moved'; from: string; to: string; event?: string }
  | { type: 'ended'; from: string; event: string }
  | { type: 'ignored'; reason: string }

/**
 * A tiny, immutable state machine for a flow. Screens emit events; edges
 * decide where each event leads. Keeping navigation in data means the CMS
 * can reorder an onboarding without an app release.
 */
export function createFlowState(flow: Pick<Flow, 'start'>): FlowState {
  return { current: flow.start, history: [], ended: false }
}

export function transition(
  flow: Pick<Flow, 'edges' | 'screens'>,
  state: FlowState,
  input:
    | { type: 'emit'; event: string }
    | { type: 'navigate'; to: string }
    | { type: 'back' }
    | { type: 'reset'; start: string },
): { state: FlowState; result: FlowTransition } {
  if (input.type === 'reset') {
    return {
      state: { current: input.start, history: [], ended: false },
      result: { type: 'moved', from: state.current, to: input.start },
    }
  }
  if (state.ended) return { state, result: { type: 'ignored', reason: 'Flow has ended' } }

  if (input.type === 'back') {
    const previous = state.history.at(-1)
    if (!previous)
      return { state, result: { type: 'ignored', reason: 'Already at the first screen' } }
    return {
      state: { current: previous, history: state.history.slice(0, -1), ended: false },
      result: { type: 'moved', from: state.current, to: previous },
    }
  }

  if (input.type === 'navigate') {
    if (!flow.screens.includes(input.to)) {
      return {
        state,
        result: { type: 'ignored', reason: `"${input.to}" is not part of this flow` },
      }
    }
    return {
      state: { current: input.to, history: [...state.history, state.current], ended: false },
      result: { type: 'moved', from: state.current, to: input.to },
    }
  }

  const to = resolveEdge(flow, state.current, input.event)
  if (!to)
    return {
      state,
      result: { type: 'ignored', reason: `No edge for "${input.event}" on "${state.current}"` },
    }
  if (to === FLOW_END) {
    return {
      state: { ...state, ended: true },
      result: { type: 'ended', from: state.current, event: input.event },
    }
  }
  return {
    state: { current: to, history: [...state.history, state.current], ended: false },
    result: { type: 'moved', from: state.current, to, event: input.event },
  }
}

/**
 * A controller that owns flow state and exposes action handlers. The React
 * `useFlow` hook and the Studio preview both wrap this.
 */
export function createFlowController(
  flow: Flow,
  screens: Screen[],
  listener: (state: FlowState, result: FlowTransition) => void,
) {
  let state = createFlowState(flow)
  const bySlug = new Map(screens.map((s) => [s.slug, s]))
  const apply = (input: Parameters<typeof transition>[2]) => {
    const next = transition(flow, state, input)
    state = next.state
    listener(state, next.result)
    return next.result
  }
  const handlers: ActionHandlers = {
    emit: (a) => void apply({ type: 'emit', event: a.event }),
    navigate: (a) => void apply({ type: 'navigate', to: a.to }),
    back: () => {
      apply({ type: 'back' })
    },
    submit: (a) => {
      if (a.event) apply({ type: 'emit', event: a.event })
    },
  }
  return {
    get state() {
      return state
    },
    screen: () => bySlug.get(state.current),
    emit: (event: string) => apply({ type: 'emit', event }),
    navigate: (to: string) => apply({ type: 'navigate', to }),
    back: () => apply({ type: 'back' }),
    reset: () => apply({ type: 'reset', start: flow.start }),
    handlers,
  }
}
export type FlowController = ReturnType<typeof createFlowController>
