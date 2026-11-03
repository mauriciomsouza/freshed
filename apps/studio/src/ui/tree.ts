import {
  checkPropValue,
  MAX_DEPTH,
  measure,
  type ComponentDefinition,
  type PropSpec,
  type PropValue,
  type ScreenNode,
} from '@freshed-cms/schema'

/** Path-addressed immutable tree edits used by the screen editor. */
export type Path = number[]

export function getAt(root: ScreenNode, path: Path): ScreenNode | undefined {
  let node: ScreenNode | undefined = root
  for (const i of path) node = node?.children?.[i]
  return node
}

export function updateAt(
  root: ScreenNode,
  path: Path,
  fn: (n: ScreenNode) => ScreenNode,
): ScreenNode {
  if (!path.length) return fn(root)
  const [head, ...rest] = path
  const children = [...(root.children ?? [])]
  children[head!] = updateAt(children[head!]!, rest, fn)
  return { ...root, children }
}

export function removeAt(root: ScreenNode, path: Path): ScreenNode {
  const parent = path.slice(0, -1)
  const index = path.at(-1)!
  return updateAt(root, parent, (n) => ({
    ...n,
    children: (n.children ?? []).filter((_, i) => i !== index),
  }))
}

export function moveAt(
  root: ScreenNode,
  path: Path,
  delta: -1 | 1,
): { root: ScreenNode; path: Path } {
  const parentPath = path.slice(0, -1)
  const index = path.at(-1)!
  const parent = getAt(root, parentPath)
  const to = index + delta
  if (!parent?.children || to < 0 || to >= parent.children.length) return { root, path }
  const next = updateAt(root, parentPath, (n) => {
    const c = [...(n.children ?? [])]
    ;[c[index], c[to]] = [c[to]!, c[index]!]
    return { ...n, children: c }
  })
  return { root: next, path: [...parentPath, to] }
}

/** Insert a node at `index` among the children of `parentPath`. */
export function insertAt(
  root: ScreenNode,
  parentPath: Path,
  index: number,
  node: ScreenNode,
): { root: ScreenNode; path: Path } {
  const count = getAt(root, parentPath)?.children?.length ?? 0
  const at = Math.max(0, Math.min(index, count))
  return {
    root: updateAt(root, parentPath, (n) => {
      const c = [...(n.children ?? [])]
      c.splice(at, 0, node)
      return { ...n, children: c }
    }),
    path: [...parentPath, at],
  }
}

/** True when `a` is `b` itself or one of its ancestors. */
export const isPrefix = (a: Path, b: Path) => a.length <= b.length && a.every((v, i) => v === b[i])

/**
 * Where a drop lands relative to the row it is over:
 * before/after it as a sibling, inside it as the first or last child.
 */
export type DropPosition = 'before' | 'after' | 'first' | 'inside'
export type Slot = { parent: Path; index: number }

export function dropSlot(root: ScreenNode, over: Path, position: DropPosition): Slot | null {
  const node = getAt(root, over)
  if (!node) return null
  if (position === 'inside') return { parent: over, index: node.children?.length ?? 0 }
  if (position === 'first') return { parent: over, index: 0 }
  if (!over.length) return null
  const index = over.at(-1)!
  return { parent: over.slice(0, -1), index: position === 'before' ? index : index + 1 }
}

/**
 * Move the node at `from` to `index` among the children of `parent`, both
 * given in the tree as it is before the move. Returns null when the move is
 * impossible (the root, or a node into itself or its own subtree).
 */
export function moveTo(
  root: ScreenNode,
  from: Path,
  parent: Path,
  index: number,
): { root: ScreenNode; path: Path } | null {
  if (!from.length || isPrefix(from, parent)) return null
  const node = getAt(root, from)
  if (!node || !getAt(root, parent)) return null
  const fromParent = from.slice(0, -1)
  const fromIndex = from.at(-1)!
  const target = [...parent]
  const depth = fromParent.length
  // Removing the node shifts later siblings (and their subtrees) up by one.
  if (target.length > depth && isPrefix(fromParent, target) && target[depth]! > fromIndex) {
    target[depth] = target[depth]! - 1
  }
  const at = samePath(fromParent, parent) && index > fromIndex ? index - 1 : index
  if (samePath(fromParent, target) && at === fromIndex) return { root, path: from }
  return insertAt(removeAt(root, from), target, at, node)
}

/** Move a node into its previous sibling, as its last child. */
export function indent(
  root: ScreenNode,
  path: Path,
  accepts: (n: ScreenNode) => boolean,
): { root: ScreenNode; path: Path } | null {
  const index = path.at(-1)
  if (index === undefined || index === 0) return null
  const prevPath = [...path.slice(0, -1), index - 1]
  const prev = getAt(root, prevPath)
  const node = getAt(root, path)
  if (!prev || !node || !accepts(prev) || !fitsDepth(prevPath, node)) return null
  return moveTo(root, path, prevPath, prev.children?.length ?? 0)
}

/** Move a node out of its parent, right after it. */
export function outdent(root: ScreenNode, path: Path): { root: ScreenNode; path: Path } | null {
  if (path.length < 2) return null
  const parentPath = path.slice(0, -1)
  return moveTo(root, path, parentPath.slice(0, -1), parentPath.at(-1)! + 1)
}

/** Whether `node` can sit under `parent` without exceeding the schema's depth limit. */
export function fitsDepth(parent: Path, node: ScreenNode, max = MAX_DEPTH): boolean {
  return parent.length + 1 + measure(node).depth <= max
}

/**
 * A fresh node of a registered type, with a short readable id. Required props
 * without a default get a valid placeholder, so the new layer renders and
 * validates straight away instead of reaching the component without them.
 */
export function newNode(type: string, def?: ComponentDefinition): ScreenNode {
  const props: Record<string, PropValue> = {}
  for (const [name, spec] of Object.entries(def?.props ?? {})) {
    if (!spec.required || ('default' in spec && spec.default !== undefined)) continue
    const value = placeholder(spec, type)
    if (value !== undefined && checkPropValue(spec, value) === null) props[name] = value
  }
  return {
    id: `${type.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    props,
  }
}

/** A short valid value for a prop, derived from its spec. Bundled art for images. */
function placeholder(spec: PropSpec, type: string): PropValue | undefined {
  const label = (text: string) => text.slice(0, spec.type === 'string' ? spec.maxLength : undefined)
  switch (spec.type) {
    case 'string':
      return label(type)
    case 'string[]':
      return [`${type} item`]
    case 'enum':
      return spec.values[0]
    case 'number':
      return spec.min ?? (spec.max !== undefined && spec.max < 0 ? spec.max : 0)
    case 'boolean':
      return false
    case 'image':
      return 'asset:beans'
    case 'action':
      return { type: 'emit', event: 'tap' }
  }
}

export function flattenTree(root: ScreenNode): { node: ScreenNode; path: Path; depth: number }[] {
  const out: { node: ScreenNode; path: Path; depth: number }[] = []
  const visit = (n: ScreenNode, path: Path) => {
    out.push({ node: n, path, depth: path.length })
    n.children?.forEach((c, i) => visit(c, [...path, i]))
  }
  visit(root, [])
  return out
}

/** A short human summary of a node for the tree row. */
export function summarize(node: ScreenNode): string {
  const p = node.props ?? {}
  for (const key of ['title', 'label', 'text', 'alt', 'code']) {
    const v = p[key]
    if (typeof v === 'string' && v) return v
  }
  if (Array.isArray(p.items)) return `${p.items.length} items`
  if (typeof p.size === 'string') return p.size
  if (typeof p.gap === 'string') return `gap ${p.gap}`
  return ''
}

export const samePath = (a: Path | null, b: Path) =>
  !!a && a.length === b.length && a.every((v, i) => v === b[i])
