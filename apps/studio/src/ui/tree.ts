import type { ScreenNode } from '@freshed/schema'

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

export function insertChild(
  root: ScreenNode,
  parentPath: Path,
  node: ScreenNode,
): { root: ScreenNode; path: Path } {
  const parent = getAt(root, parentPath)
  const index = parent?.children?.length ?? 0
  return {
    root: updateAt(root, parentPath, (n) => ({ ...n, children: [...(n.children ?? []), node] })),
    path: [...parentPath, index],
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
