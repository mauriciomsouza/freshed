import type { z } from 'zod'
import { Action, isSafeUrl } from './actions.js'
import { ComponentDefinition } from './component.js'
import { Flow, FLOW_END } from './flow.js'
import type { PropSpec, PropsSpec } from './props.js'
import { Screen, walk, type PropValue, type ScreenNode } from './screen.js'

export type Issue = {
  /** JSON-pointer-like path, e.g. "root.children.1.props.title". */
  path: string
  message: string
  severity: 'error' | 'warning'
}

export type Result<T> = { ok: true; value: T; issues: Issue[] } | { ok: false; issues: Issue[] }

function fromZod(error: z.ZodError, prefix = ''): Issue[] {
  return error.issues.map((i) => ({
    path: [prefix, ...i.path.map(String)].filter(Boolean).join('.'),
    message: i.message,
    severity: 'error' as const,
  }))
}

export function parseScreen(input: unknown): Result<Screen> {
  const r = Screen.safeParse(input)
  return r.success
    ? { ok: true, value: r.data, issues: [] }
    : { ok: false, issues: fromZod(r.error) }
}

export function parseFlow(input: unknown): Result<Flow> {
  const r = Flow.safeParse(input)
  return r.success
    ? { ok: true, value: r.data, issues: [] }
    : { ok: false, issues: fromZod(r.error) }
}

export function parseComponent(input: unknown): Result<ComponentDefinition> {
  const r = ComponentDefinition.safeParse(input)
  return r.success
    ? { ok: true, value: r.data, issues: [] }
    : { ok: false, issues: fromZod(r.error) }
}

/** Checks one prop value against its spec. Returns an error message or null. */
export function checkPropValue(spec: PropSpec, value: PropValue | undefined): string | null {
  if (value === undefined || value === null) {
    return spec.required && !('default' in spec && spec.default !== undefined)
      ? 'is required'
      : null
  }
  switch (spec.type) {
    case 'string':
      if (typeof value !== 'string') return 'must be a string'
      if (spec.maxLength && value.length > spec.maxLength)
        return `must be at most ${spec.maxLength} characters`
      return null
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) return 'must be a number'
      if (spec.min !== undefined && value < spec.min) return `must be >= ${spec.min}`
      if (spec.max !== undefined && value > spec.max) return `must be <= ${spec.max}`
      return null
    case 'boolean':
      return typeof value === 'boolean' ? null : 'must be true or false'
    case 'enum':
      return typeof value === 'string' && spec.values.includes(value)
        ? null
        : `must be one of ${spec.values.map((v) => `"${v}"`).join(', ')}`
    case 'image':
      return typeof value === 'string' && (isSafeUrl(value) || value.startsWith('asset:'))
        ? null
        : 'must be an https URL or an asset: reference'
    case 'action':
      return Action.safeParse(value).success ? null : 'must be a valid action'
    case 'string[]':
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string'))
        return 'must be a list of strings'
      if (spec.maxItems && value.length > spec.maxItems)
        return `must have at most ${spec.maxItems} items`
      return null
  }
}

export type Registry = Map<string, ComponentDefinition> | ComponentDefinition[]

function toMap(registry: Registry): Map<string, ComponentDefinition> {
  return Array.isArray(registry) ? new Map(registry.map((c) => [c.name, c])) : registry
}

/**
 * Validates a screen against the component registry: unknown components,
 * unknown props, wrong prop types, missing required props and children on
 * leaf components. Structural validity (zod) is checked first.
 */
export function validateScreen(input: unknown, registry: Registry): Result<Screen> {
  const parsed = parseScreen(input)
  if (!parsed.ok) return parsed
  const map = toMap(registry)
  const issues: Issue[] = []

  const visit = (node: ScreenNode, path: string) => {
    const def = map.get(node.type)
    if (!def) {
      issues.push({ path, message: `Unknown component "${node.type}"`, severity: 'error' })
      return
    }
    issues.push(...checkProps(def.props, node.props ?? {}, `${path}.props`))
    if (node.children?.length && !def.children) {
      issues.push({
        path: `${path}.children`,
        message: `"${node.type}" does not accept children`,
        severity: 'error',
      })
    }
    node.children?.forEach((child, i) => visit(child, `${path}.children.${i}`))
  }
  visit(parsed.value.root, 'root')

  const ids = new Set<string>()
  walk(parsed.value.root, (n) => {
    if (!n.id) return
    if (ids.has(n.id))
      issues.push({ path: 'root', message: `Duplicate node id "${n.id}"`, severity: 'warning' })
    ids.add(n.id)
  })

  return issues.some((i) => i.severity === 'error')
    ? { ok: false, issues }
    : { ok: true, value: parsed.value, issues }
}

export function checkProps(
  spec: PropsSpec,
  props: Record<string, PropValue>,
  path: string,
): Issue[] {
  const issues: Issue[] = []
  for (const name of Object.keys(props)) {
    if (!spec[name])
      issues.push({
        path: `${path}.${name}`,
        message: `Unknown prop "${name}"`,
        severity: 'warning',
      })
  }
  for (const [name, propSpec] of Object.entries(spec)) {
    const error = checkPropValue(propSpec, props[name])
    if (error)
      issues.push({ path: `${path}.${name}`, message: `"${name}" ${error}`, severity: 'error' })
  }
  return issues
}

/**
 * Validates a flow against the screens that exist, and checks that every
 * `emit` event on a flow screen has an edge (warning) and every `navigate`
 * points to an existing screen (error).
 */
export function validateFlow(
  input: unknown,
  screens: Pick<Screen, 'slug' | 'root'>[],
): Result<Flow> {
  const parsed = parseFlow(input)
  if (!parsed.ok) return parsed
  const flow = parsed.value
  const bySlug = new Map(screens.map((s) => [s.slug, s]))
  const issues: Issue[] = []

  flow.screens.forEach((slug, i) => {
    const screen = bySlug.get(slug)
    if (!screen) {
      issues.push({
        path: `screens.${i}`,
        message: `Screen "${slug}" does not exist`,
        severity: 'error',
      })
      return
    }
    walk(screen.root, (node) => {
      for (const value of Object.values(node.props ?? {})) {
        const action = Action.safeParse(value)
        if (!action.success) continue
        const a = action.data
        if (a.type === 'emit' || (a.type === 'submit' && a.event)) {
          const event = a.type === 'emit' ? a.event : a.event!
          if (!flow.edges.some((e) => e.from === slug && e.event === event)) {
            issues.push({
              path: `screens.${i}`,
              message: `"${slug}" emits "${event}" but the flow has no edge for it`,
              severity: 'warning',
            })
          }
        }
        if (a.type === 'navigate' && !bySlug.has(a.to)) {
          issues.push({
            path: `screens.${i}`,
            message: `"${slug}" navigates to unknown screen "${a.to}"`,
            severity: 'error',
          })
        }
      }
    })
  })

  flow.edges.forEach((edge, i) => {
    if (edge.to !== FLOW_END && !bySlug.has(edge.to)) {
      issues.push({
        path: `edges.${i}.to`,
        message: `Screen "${edge.to}" does not exist`,
        severity: 'error',
      })
    }
  })

  return issues.some((i) => i.severity === 'error')
    ? { ok: false, issues }
    : { ok: true, value: flow, issues }
}

/** Formats issues for humans and for LLM repair prompts. */
export function formatIssues(issues: Issue[]): string {
  return issues.map((i) => `- [${i.severity}] ${i.path || '(root)'}: ${i.message}`).join('\n')
}
