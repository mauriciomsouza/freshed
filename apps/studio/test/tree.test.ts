import { brewComponents } from '@freshed-cms/example-brew'
import {
  checkPropValue,
  MAX_DEPTH,
  prop,
  validateScreen,
  type ComponentDefinition,
  type ScreenNode,
} from '@freshed-cms/schema'
import { describe, expect, it } from 'vitest'
import {
  dropSlot,
  fitsDepth,
  getAt,
  indent,
  insertAt,
  isPrefix,
  moveTo,
  newNode,
  outdent,
  type Path,
} from '../src/ui/tree'

const n = (id: string, children?: ScreenNode[]): ScreenNode => ({
  id,
  type: children ? 'Stack' : 'Text',
  ...(children ? { children } : {}),
})

// root
// ├─ a
// ├─ b (container)
// │  ├─ b1
// │  └─ b2
// ├─ c
// └─ d (container, empty)
const tree = () => n('root', [n('a'), n('b', [n('b1'), n('b2')]), n('c'), n('d', [])])
const ids = (node: ScreenNode): unknown =>
  node.children ? [node.id, node.children.map(ids)] : node.id
const allIds = (node: ScreenNode): string[] =>
  [node.id!, ...(node.children ?? []).flatMap(allIds)].sort()
const accepts = (x: ScreenNode) => x.type === 'Stack'

describe('tree moves', () => {
  it('reorders siblings forward and backward', () => {
    const fwd = moveTo(tree(), [0], [], 3)!
    expect(ids(fwd.root)).toEqual(['root', [['b', ['b1', 'b2']], 'c', 'a', ['d', []]]])
    expect(fwd.path).toEqual([2])
    expect(getAt(fwd.root, fwd.path)?.id).toBe('a')

    const back = moveTo(tree(), [2], [], 0)!
    expect(ids(back.root)).toEqual(['root', ['c', 'a', ['b', ['b1', 'b2']], ['d', []]]])
    expect(back.path).toEqual([0])
  })

  it('moves a node into a later container, adjusting for the removal', () => {
    const r = moveTo(tree(), [0], [1], 1)!
    expect(ids(r.root)).toEqual(['root', [['b', ['b1', 'a', 'b2']], 'c', ['d', []]]])
    expect(r.path).toEqual([0, 1])
    expect(getAt(r.root, r.path)?.id).toBe('a')
  })

  it('moves a node out to the root and into an empty container', () => {
    const out = moveTo(tree(), [1, 1], [], 0)!
    expect(ids(out.root)).toEqual(['root', ['b2', 'a', ['b', ['b1']], 'c', ['d', []]]])
    const into = moveTo(tree(), [1, 0], [3], 0)!
    expect(ids(into.root)).toEqual(['root', ['a', ['b', ['b2']], 'c', ['d', ['b1']]]])
    expect(getAt(into.root, into.path)?.id).toBe('b1')
  })

  it('refuses to move the root or a node into its own subtree', () => {
    expect(moveTo(tree(), [], [1], 0)).toBeNull()
    expect(moveTo(tree(), [1], [1], 0)).toBeNull()
    expect(moveTo(tree(), [1], [1, 0], 0)).toBeNull()
  })

  it('treats dropping a node onto its own slot as a no-op', () => {
    const t = tree()
    for (const index of [1, 2]) {
      const r = moveTo(t, [1], [], index)!
      expect(r.root).toBe(t)
      expect(r.path).toEqual([1])
    }
  })

  it('computes drop slots before, after and inside a row', () => {
    const t = tree()
    expect(dropSlot(t, [1], 'before')).toEqual({ parent: [], index: 1 })
    expect(dropSlot(t, [1], 'after')).toEqual({ parent: [], index: 2 })
    expect(dropSlot(t, [1], 'first')).toEqual({ parent: [1], index: 0 })
    expect(dropSlot(t, [1], 'inside')).toEqual({ parent: [1], index: 2 })
    expect(dropSlot(t, [], 'before')).toBeNull()
    expect(dropSlot(t, [9], 'after')).toBeNull()
  })

  it('every drop slot round-trips the moved node to where it was dropped', () => {
    const t = tree()
    const paths: Path[] = [[0], [1], [1, 0], [1, 1], [2], [3]]
    for (const from of paths) {
      for (const over of paths) {
        for (const pos of ['before', 'after', 'first', 'inside'] as const) {
          const slot = dropSlot(t, over, pos)
          if (!slot) continue
          const r = moveTo(t, from, slot.parent, slot.index)
          if (!r) {
            expect(isPrefix(from, slot.parent)).toBe(true)
            continue
          }
          expect(getAt(r.root, r.path)?.id).toBe(getAt(t, from)?.id)
          // Nothing is lost or duplicated.
          expect(allIds(r.root)).toEqual(allIds(t))
        }
      }
    }
  })
})

describe('layer levels', () => {
  it('indents into the previous sibling container as its last child', () => {
    const r = indent(tree(), [2], accepts)!
    expect(ids(r.root)).toEqual(['root', ['a', ['b', ['b1', 'b2', 'c']], ['d', []]]])
    expect(r.path).toEqual([1, 2])
  })

  it('does not indent the first child or into a leaf', () => {
    expect(indent(tree(), [0], accepts)).toBeNull()
    expect(indent(tree(), [1], accepts)).toBeNull() // previous sibling "a" is a leaf
    expect(indent(tree(), [], accepts)).toBeNull()
  })

  it('outdents to right after the parent', () => {
    const r = outdent(tree(), [1, 0])!
    expect(ids(r.root)).toEqual(['root', ['a', ['b', ['b2']], 'b1', 'c', ['d', []]]])
    expect(r.path).toEqual([2])
    expect(outdent(tree(), [1])).toBeNull()
  })

  it('respects the schema depth limit', () => {
    expect(fitsDepth([], n('x'))).toBe(true)
    const deepParent: Path = Array.from({ length: MAX_DEPTH - 1 }, () => 0)
    expect(fitsDepth(deepParent, n('x'))).toBe(false)
    expect(fitsDepth(deepParent.slice(1), n('x'))).toBe(true)
    expect(fitsDepth(deepParent.slice(1), n('x', [n('y')]))).toBe(false)
  })

  it('inserts at a clamped index and makes fresh nodes', () => {
    const r = insertAt(tree(), [3], 5, newNode('Text'))
    expect(r.path).toEqual([3, 0])
    expect(getAt(r.root, r.path)?.type).toBe('Text')
    expect(newNode('Card').id).toMatch(/^card-[a-z0-9]+$/)
  })
})

describe('new layers', () => {
  const screenWith = (node: ScreenNode) => ({
    slug: 'new',
    title: 'New',
    root: { type: 'Stack', children: [node] },
  })

  it('seed required props so every Brew component validates when added', () => {
    for (const def of brewComponents) {
      const node = newNode(def.name, def)
      const r = validateScreen(screenWith(node), brewComponents)
      expect(
        r.issues.filter((i) => i.severity === 'error'),
        def.name,
      ).toEqual([])
    }
  })

  it('leave optional props and props with a default unset', () => {
    const button = brewComponents.find((c) => c.name === 'Button')!
    const props = newNode('Button', button).props ?? {}
    expect(Object.keys(props).sort()).toEqual(['action', 'label'])
    expect(props.action).toEqual({ type: 'emit', event: 'tap' })
    const list = brewComponents.find((c) => c.name === 'List')!
    expect(newNode('List', list).props?.items).toHaveLength(1)
  })

  it('make a valid placeholder for every prop type and its limits', () => {
    const def: ComponentDefinition = {
      name: 'Everything',
      props: {
        s: prop.string({ required: true, maxLength: 3 }),
        n: prop.number({ required: true, min: 5, max: 9 }),
        neg: prop.number({ required: true, max: -2 }),
        b: prop.boolean({ required: true }),
        e: prop.enum(['b', 'a'], { required: true }),
        i: prop.image({ required: true }),
        a: prop.action({ required: true }),
        l: prop.stringList({ required: true, maxItems: 1 }),
      },
    }
    const props = newNode(def.name, def).props ?? {}
    for (const [name, spec] of Object.entries(def.props)) {
      expect(checkPropValue(spec, props[name]), name).toBeNull()
    }
    expect(props.e).toBe('b')
    expect(props.n).toBe(5)
  })

  it('works without a definition', () => {
    expect(newNode('Mystery').props).toEqual({})
  })
})
