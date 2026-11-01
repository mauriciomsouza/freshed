import type { Action, ActionType } from '@freshed/schema'

export type ActionContext = {
  /** Slug of the screen the action came from. */
  screen: string
  /** Values collected from input components on the screen, for `submit`. */
  values?: Record<string, unknown>
}

type HandlerFor<T extends ActionType> = (
  action: Extract<Action, { type: T }>,
  context: ActionContext,
) => void | Promise<void>

/**
 * App-provided implementations. Every action type is optional so a renderer
 * can run with a partial set (the Studio preview, tests, a minimal app).
 */
export type ActionHandlers = { [T in ActionType]?: HandlerFor<T> }

export type ActionEvent = { action: Action; context: ActionContext; handled: boolean }

export type Dispatcher = (action: Action, context: ActionContext) => Promise<boolean>

/**
 * Builds a dispatcher. Handlers are looked up by action type; layers are
 * tried in order so a flow can intercept `emit`/`back` before the app's
 * own handlers. Unhandled actions resolve to `false` and are reported to
 * `onUnhandled` instead of throwing, so an action an older app build does
 * not know about is a no-op, not a crash.
 */
export function createDispatcher(
  layers: ActionHandlers[],
  hooks: {
    onAction?: (event: ActionEvent) => void
    onError?: (error: unknown, action: Action) => void
  } = {},
): Dispatcher {
  return async (action, context) => {
    for (const layer of layers) {
      const handler = layer[action.type] as HandlerFor<typeof action.type> | undefined
      if (!handler) continue
      try {
        await handler(action as never, context)
      } catch (error) {
        hooks.onError?.(error, action)
      }
      hooks.onAction?.({ action, context, handled: true })
      return true
    }
    hooks.onAction?.({ action, context, handled: false })
    return false
  }
}

/** Human-readable label, used by the Studio event log. */
export function describeAction(action: Action): string {
  switch (action.type) {
    case 'navigate':
      return `navigate → ${action.to}`
    case 'emit':
      return `emit "${action.event}"`
    case 'back':
      return 'back'
    case 'dismiss':
      return 'dismiss'
    case 'openUrl':
      return `open ${action.url}`
    case 'submit':
      return `submit ${action.name}${action.event ? ` then "${action.event}"` : ''}`
    case 'copy':
      return `copy "${action.text}"`
    case 'share':
      return `share "${action.message}"`
  }
}
