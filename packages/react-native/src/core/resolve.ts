import {
  Action,
  checkPropValue,
  MAX_DEPTH,
  type PropValue,
  type ScreenNode,
} from '@freshed-cms/schema'
import type { Registry } from './registry.js'

export type ResolvedComponent<R> = {
  kind: 'component'
  key: string
  type: string
  render: R
  /** Props after defaults and validation. Action props are bound callbacks. */
  props: Record<string, unknown>
  children: ResolvedNode<R>[]
}

export type FallbackReason = 'unknown-component' | 'max-depth'

export type ResolvedFallback = {
  kind: 'fallback'
  key: string
  type: string
  reason: FallbackReason
  props: Record<string, PropValue>
}

export type ResolvedNode<R> = ResolvedComponent<R> | ResolvedFallback

export type ResolveWarning = { key: string; type: string; message: string }

export type ResolveOptions = {
  /** Turns an Action into a callback. Called once per action prop. */
  bindAction: (action: Action, node: { key: string; type: string }) => () => void
  onWarning?: (warning: ResolveWarning) => void
}

/**
 * Resolves a JSON screen tree into a tree of registered components.
 *
 * This is the heart of the renderer and is deliberately pure:
 * - unknown components become `fallback` nodes (never a crash);
 * - invalid prop values are dropped and replaced by the spec default, so a
 *   bad edit in the CMS degrades one prop instead of the whole screen;
 * - required props that are missing after defaults turn the node into a
 *   warning but still render (the component decides how to cope);
 * - action props are bound through `bindAction`; nothing is ever evaluated.
 */
export function resolveTree<R>(
  root: ScreenNode,
  registry: Registry<R>,
  options: ResolveOptions,
): ResolvedNode<R> {
  const warn = (key: string, type: string, message: string) =>
    options.onWarning?.({ key, type, message })

  const visit = (node: ScreenNode, key: string, depth: number): ResolvedNode<R> => {
    if (depth > MAX_DEPTH) {
      warn(key, node.type, `Tree is deeper than ${MAX_DEPTH}; subtree skipped`)
      return {
        kind: 'fallback',
        key,
        type: node.type,
        reason: 'max-depth',
        props: node.props ?? {},
      }
    }
    const def = registry.get(node.type)
    if (!def) {
      warn(key, node.type, `Unknown component "${node.type}"; rendering fallback`)
      return {
        kind: 'fallback',
        key,
        type: node.type,
        reason: 'unknown-component',
        props: node.props ?? {},
      }
    }

    const raw = node.props ?? {}
    const props: Record<string, unknown> = {}
    for (const [name, spec] of Object.entries(def.props)) {
      let value: PropValue | undefined = raw[name]
      if (value !== undefined && checkPropValue(spec, value) !== null) {
        warn(key, node.type, `Prop "${name}" ${checkPropValue(spec, value)}; using default`)
        value = undefined
      }
      if (value === undefined && 'default' in spec && spec.default !== undefined)
        value = spec.default
      if (value === undefined || value === null) {
        if (spec.required) warn(key, node.type, `Required prop "${name}" is missing`)
        continue
      }
      if (spec.type === 'action') {
        const action = Action.parse(value)
        props[name] = options.bindAction(action, { key, type: node.type })
      } else {
        props[name] = value
      }
    }

    const children = def.children
      ? (node.children ?? []).map((child, i) => visit(child, `${key}.${child.id ?? i}`, depth + 1))
      : []
    if (!def.children && node.children?.length) {
      warn(
        key,
        node.type,
        `"${node.type}" does not accept children; ignoring ${node.children.length}`,
      )
    }

    return { kind: 'component', key, type: node.type, render: def.render, props, children }
  }

  return visit(root, root.id ?? 'root', 1)
}

/** Flattens a resolved tree, handy for tests and analytics. */
export function flatten<R>(node: ResolvedNode<R>): ResolvedNode<R>[] {
  return node.kind === 'component' ? [node, ...node.children.flatMap(flatten)] : [node]
}
