import { z } from 'zod'
import { EventName, Slug } from './actions.js'

/** Special edge target that ends the flow (the app decides what happens next). */
export const FLOW_END = '@end'

export const FlowEdge = z.object({
  from: Slug,
  /** Event emitted by an `emit` action on the `from` screen. */
  event: EventName,
  to: z.union([Slug, z.literal(FLOW_END)]),
})
export type FlowEdge = z.infer<typeof FlowEdge>

export const Flow = z
  .object({
    slug: Slug,
    title: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    start: Slug,
    screens: z.array(Slug).min(1).max(50),
    edges: z.array(FlowEdge).max(200),
  })
  .superRefine((flow, ctx) => {
    const set = new Set(flow.screens)
    if (set.size !== flow.screens.length) {
      ctx.addIssue({ code: 'custom', path: ['screens'], message: 'Screens must be unique' })
    }
    if (!set.has(flow.start)) {
      ctx.addIssue({
        code: 'custom',
        path: ['start'],
        message: `Start screen "${flow.start}" is not in the flow`,
      })
    }
    const seen = new Set<string>()
    flow.edges.forEach((edge, i) => {
      if (!set.has(edge.from)) {
        ctx.addIssue({
          code: 'custom',
          path: ['edges', i, 'from'],
          message: `"${edge.from}" is not in the flow`,
        })
      }
      if (edge.to !== FLOW_END && !set.has(edge.to)) {
        ctx.addIssue({
          code: 'custom',
          path: ['edges', i, 'to'],
          message: `"${edge.to}" is not in the flow`,
        })
      }
      const key = `${edge.from}:${edge.event}`
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['edges', i],
          message: `Duplicate edge for event "${edge.event}" on "${edge.from}"`,
        })
      }
      seen.add(key)
    })
  })
export type Flow = z.infer<typeof Flow>

/** Where an event on a screen leads inside a flow, or `undefined` if nowhere. */
export function resolveEdge(
  flow: Pick<Flow, 'edges'>,
  from: string,
  event: string,
): string | undefined {
  return flow.edges.find((e) => e.from === from && e.event === event)?.to
}

/** Screens that cannot be reached from the start screen. */
export function unreachableScreens(flow: Pick<Flow, 'start' | 'screens' | 'edges'>): string[] {
  const reached = new Set<string>([flow.start])
  const queue = [flow.start]
  while (queue.length) {
    const current = queue.shift()!
    for (const edge of flow.edges) {
      if (edge.from === current && edge.to !== FLOW_END && !reached.has(edge.to)) {
        reached.add(edge.to)
        queue.push(edge.to)
      }
    }
  }
  return flow.screens.filter((s) => !reached.has(s))
}
