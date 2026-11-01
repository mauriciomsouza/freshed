import { z } from 'zod'

/**
 * Actions are declarative intents. The renderer never evaluates code: it
 * hands each action to a handler that the app (or the Studio preview)
 * implements with code that already ships in the bundle.
 */

export const Slug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes')
export type Slug = z.infer<typeof Slug>

export const EventName = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z][a-zA-Z0-9_-]*$/, 'Event names start with a lowercase letter')

/** Go to a specific screen by slug. */
export const NavigateAction = z.object({
  type: z.literal('navigate'),
  to: Slug,
})

/**
 * Emit a named event. Inside a flow, the flow's edges decide where the
 * event leads, so the same screen can be reused across flows.
 */
export const EmitAction = z.object({
  type: z.literal('emit'),
  event: EventName,
})

export const BackAction = z.object({ type: z.literal('back') })

export const DismissAction = z.object({ type: z.literal('dismiss') })

export const OpenUrlAction = z.object({
  type: z.literal('openUrl'),
  url: z.string().max(2048).refine(isSafeUrl, {
    message: 'Only https:, mailto:, tel: and app deep links (scheme://) are allowed',
  }),
})

const BLOCKED_SCHEMES = new Set(['javascript', 'data', 'file', 'vbscript', 'blob', 'http'])

/** https, mailto, tel and custom app schemes (`brew://...`). Never script-like schemes. */
export function isSafeUrl(url: string): boolean {
  const match = /^([a-z][a-z0-9+.-]*):(.*)$/i.exec(url.trim())
  if (!match) return false
  const scheme = match[1]!.toLowerCase()
  const rest = match[2]!
  if (BLOCKED_SCHEMES.has(scheme)) return false
  if (scheme === 'https') return /^\/\/[^\s/]+/.test(rest)
  if (scheme === 'mailto' || scheme === 'tel') return rest.length > 0
  return rest.startsWith('//')
}

/** Send the screen's field values to the app, then optionally emit an event. */
export const SubmitAction = z.object({
  type: z.literal('submit'),
  /** Name the app uses to route the submission, e.g. "onboarding.preferences". */
  name: z.string().min(1).max(64),
  event: EventName.optional(),
})

export const CopyAction = z.object({
  type: z.literal('copy'),
  text: z.string().min(1).max(500),
})

export const ShareAction = z.object({
  type: z.literal('share'),
  message: z.string().min(1).max(500),
  url: z.string().url().optional(),
})

export const Action = z.discriminatedUnion('type', [
  NavigateAction,
  EmitAction,
  BackAction,
  DismissAction,
  OpenUrlAction,
  SubmitAction,
  CopyAction,
  ShareAction,
])
export type Action = z.infer<typeof Action>
export type ActionType = Action['type']

export const ACTION_TYPES = Action.options.map((o) => o.shape.type.value) as ActionType[]
