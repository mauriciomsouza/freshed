import { z } from 'zod'
import { Action, Slug } from './actions.js'

export const ComponentName = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[A-Z][A-Za-z0-9]*$/, 'Component names are PascalCase, e.g. "Hero"')

/** A prop value as stored in JSON. Actions are objects with a `type`. */
export type PropValue = string | number | boolean | null | string[] | Action

export const PropValue: z.ZodType<PropValue> = z.union([
  z.string().max(4000),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string().max(4000)).max(100),
  Action,
])

export interface ScreenNode {
  /** Stable id inside the screen; used by the editor and for analytics. */
  id?: string
  /** Name of a component registered in the app, e.g. "Hero". */
  type: string
  props?: Record<string, PropValue>
  children?: ScreenNode[]
}

export const MAX_DEPTH = 12
export const MAX_NODES = 400

export const ScreenNode: z.ZodType<ScreenNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(64).optional(),
    type: ComponentName,
    props: z.record(z.string().max(64), PropValue).optional(),
    children: z.array(ScreenNode).max(100).optional(),
  }),
)

export const Screen = z
  .object({
    slug: Slug,
    title: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    /** The root node of the tree, usually a layout like "Stack". */
    root: ScreenNode,
  })
  .superRefine((screen, ctx) => {
    const stats = measure(screen.root)
    if (stats.depth > MAX_DEPTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['root'],
        message: `Tree is deeper than ${MAX_DEPTH} levels`,
      })
    }
    if (stats.nodes > MAX_NODES) {
      ctx.addIssue({
        code: 'custom',
        path: ['root'],
        message: `Tree has more than ${MAX_NODES} nodes`,
      })
    }
  })
export type Screen = z.infer<typeof Screen>

export function measure(node: ScreenNode, depth = 1): { depth: number; nodes: number } {
  let maxDepth = depth
  let nodes = 1
  for (const child of node.children ?? []) {
    const s = measure(child, depth + 1)
    maxDepth = Math.max(maxDepth, s.depth)
    nodes += s.nodes
  }
  return { depth: maxDepth, nodes }
}

/** Depth-first walk. Return `false` from the visitor to skip a subtree. */
export function walk(
  node: ScreenNode,
  visit: (node: ScreenNode, path: number[]) => void | false,
  path: number[] = [],
): void {
  if (visit(node, path) === false) return
  node.children?.forEach((child, i) => walk(child, visit, [...path, i]))
}

/** Every component name a screen references, deduplicated, in tree order. */
export function componentsUsed(screen: Pick<Screen, 'root'>): string[] {
  const seen = new Set<string>()
  walk(screen.root, (n) => {
    seen.add(n.type)
  })
  return [...seen]
}

/** Every action found in a screen's props, with the node that owns it. */
export function actionsUsed(
  screen: Pick<Screen, 'root'>,
): { node: ScreenNode; prop: string; action: Action }[] {
  const out: { node: ScreenNode; prop: string; action: Action }[] = []
  walk(screen.root, (node) => {
    for (const [prop, value] of Object.entries(node.props ?? {})) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        out.push({ node, prop, action: value })
      }
    }
  })
  return out
}
