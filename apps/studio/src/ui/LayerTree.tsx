import type { ComponentDefinition, ScreenNode } from '@freshed-cms/schema'
import { useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { IconDown, IconIndent, IconOutdent, IconTrash, IconUp } from './icons'
import {
  dropSlot,
  fitsDepth,
  flattenTree,
  getAt,
  indent,
  insertAt,
  isPrefix,
  moveAt,
  moveTo,
  newNode,
  outdent,
  removeAt,
  samePath,
  summarize,
  type DropPosition,
  type Path,
  type Slot,
} from './tree'

/**
 * The layers panel used by the screen editor and the playground: the
 * component tree, with drag and drop to reorder and nest nodes, a toolbar and
 * Alt+arrow shortcuts to move a layer up, down, in and out, and a palette of
 * registered components to drag in. Every edit is a pure tree operation.
 */

type Drag = { kind: 'node'; path: Path } | { kind: 'component'; type: string }
// HTML5 drag data cannot be read during dragover, so the drag source is kept here.
let dragging: Drag | null = null

type Drop = { over: Path | null; position: DropPosition }

export function LayerTree({
  root,
  selected,
  onSelect,
  onChange,
  registry,
  components,
  disabled,
}: {
  root: ScreenNode
  selected: Path | null
  onSelect: (p: Path) => void
  /** A structural edit: the new tree, the path to select, and a note for a toast. */
  onChange: (root: ScreenNode, select: Path, note?: string) => void
  registry: Map<string, ComponentDefinition>
  /** Components offered in the palette. */
  components: ComponentDefinition[]
  /** Read-only, with a reason (e.g. the JSON does not parse). */
  disabled?: string
}) {
  const rows = flattenTree(root)
  const [drop, setDrop] = useState<Drop | null>(null)
  const [draggingPath, setDraggingPath] = useState<Path | null>(null)
  const list = useRef<HTMLUListElement>(null)
  const focusAfter = useRef<Path | null>(null)
  const paletteId = useId()
  const sel = selected && getAt(root, selected) ? selected : null
  const selNode = sel ? getAt(root, sel) : undefined

  const accepts = (n: ScreenNode | undefined) => !!n && !!registry.get(n.type)?.children
  // New layers get placeholders for their required props, so they render straight away.
  const create = (type: string) => newNode(type, registry.get(type))

  // Keep keyboard focus on a layer after it moves.
  useEffect(() => {
    const p = focusAfter.current
    if (!p) return
    focusAfter.current = null
    list.current?.querySelector<HTMLElement>(`[data-path="${p.join('.')}"]`)?.focus()
  })

  const allowed = (drag: Drag, slot: Slot | null): slot is Slot => {
    if (!slot || !accepts(getAt(root, slot.parent))) return false
    if (drag.kind === 'component') return fitsDepth(slot.parent, create(drag.type))
    const node = getAt(root, drag.path)
    return !!node && !isPrefix(drag.path, slot.parent) && fitsDepth(slot.parent, node)
  }

  const slotOf = (d: Drop) =>
    d.over ? dropSlot(root, d.over, d.position) : { parent: [], index: root.children?.length ?? 0 }

  /** Pick where a drag over a row would land, from the pointer's height in the row. */
  const pick = (e: DragEvent<HTMLElement>, path: Path, node: ScreenNode): Drop | null => {
    if (!dragging) return null
    const rect = e.currentTarget.getBoundingClientRect()
    const y = (e.clientY - rect.top) / rect.height
    let order: DropPosition[]
    if (!path.length) order = ['first']
    else if (accepts(node)) {
      const bottom = node.children?.length ? 'first' : 'after'
      order = y < 0.25 ? ['before'] : y > 0.75 ? [bottom, 'inside'] : ['inside', 'before']
    } else order = y < 0.5 ? ['before'] : ['after']
    for (const position of order) {
      const d = { over: path, position }
      if (allowed(dragging, slotOf(d))) return d
    }
    return null
  }

  const commit = (d: Drop) => {
    const drag = dragging
    const slot = slotOf(d)
    dragging = null
    setDrop(null)
    setDraggingPath(null)
    if (!drag || !allowed(drag, slot)) return
    if (drag.kind === 'component') {
      const r = insertAt(root, slot.parent, slot.index, create(drag.type))
      onChange(r.root, r.path, `Added ${drag.type}`)
      return
    }
    const r = moveTo(root, drag.path, slot.parent, slot.index)
    if (r && r.root !== root) onChange(r.root, r.path)
  }

  const dropKey = (d: Drop | null) => (d ? `${d.over?.join('.') ?? 'end'}:${d.position}` : '')
  // dragover fires continuously; only re-render when the target changes.
  const setDropIfChanged = (d: Drop | null) =>
    setDrop((cur) => (dropKey(cur) === dropKey(d) ? cur : d))

  // ---------- Structural actions (toolbar and shortcuts) ----------

  const act = (r: { root: ScreenNode; path: Path } | null, focus: boolean) => {
    if (!r || r.root === root) return
    if (focus) focusAfter.current = r.path
    onChange(r.root, r.path)
  }
  const canMove = (delta: -1 | 1) => {
    if (!sel?.length) return false
    const siblings = getAt(root, sel.slice(0, -1))?.children?.length ?? 0
    const to = sel.at(-1)! + delta
    return to >= 0 && to < siblings
  }
  const actions = {
    up: (focus = false) => sel && act(moveAt(root, sel, -1), focus),
    down: (focus = false) => sel && act(moveAt(root, sel, 1), focus),
    in: (focus = false) => sel && act(indent(root, sel, accepts), focus),
    out: (focus = false) => sel && act(outdent(root, sel), focus),
    remove: () => {
      if (!sel?.length || !selNode) return
      const index = sel.at(-1)!
      const parent = sel.slice(0, -1)
      const next = removeAt(root, sel)
      const siblings = getAt(next, parent)?.children?.length ?? 0
      onChange(
        next,
        siblings ? [...parent, Math.min(index, siblings - 1)] : parent,
        `Removed ${selNode.type}`,
      )
    },
  }

  const onRowKey = (e: KeyboardEvent<HTMLElement>, path: Path) => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(path)
      return
    }
    if (!e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      const i = rows.findIndex((r) => samePath(path, r.path))
      const next = rows[i + (e.key === 'ArrowDown' ? 1 : -1)]
      if (next) {
        focusAfter.current = next.path
        onSelect(next.path)
      }
      return
    }
    if (!e.altKey || !samePath(sel, path)) return
    const map: Record<string, () => void> = {
      ArrowUp: () => actions.up(true),
      ArrowDown: () => actions.down(true),
      ArrowRight: () => actions.in(true),
      ArrowLeft: () => actions.out(true),
    }
    if (map[e.key]) {
      e.preventDefault()
      map[e.key]!()
    }
  }

  const insertFromPalette = (type: string) => {
    // Inside the selected container, after the selected leaf, or at the end of the screen.
    const candidates: Slot[] = []
    if (sel && accepts(selNode))
      candidates.push({ parent: sel, index: selNode?.children?.length ?? 0 })
    if (sel?.length) candidates.push({ parent: sel.slice(0, -1), index: sel.at(-1)! + 1 })
    candidates.push({ parent: [], index: root.children?.length ?? 0 })
    const slot = candidates.find((s) => allowed({ kind: 'component', type }, s))
    if (!slot) return
    const r = insertAt(root, slot.parent, slot.index, create(type))
    onChange(r.root, r.path, `Added ${type}`)
  }

  const level = sel ? (sel.length ? `Level ${sel.length}` : 'Root') : ''
  const parentType = sel?.length ? getAt(root, sel.slice(0, -1))?.type : undefined

  return (
    <div className="layers">
      <div className="layers-bar" role="toolbar" aria-label="Layer actions">
        <span
          className="layers-title"
          title={level ? 'How deep the selected layer is nested' : undefined}
        >
          {level ? (
            <>
              {level}
              {parentType ? <span className="layers-parent"> · in {parentType}</span> : null}
            </>
          ) : (
            'Layers'
          )}
        </span>
        <span className="spacer" />
        <button
          className="btn btn-ghost icon-btn"
          aria-label="Move up"
          aria-keyshortcuts="Alt+ArrowUp"
          title="Move up (Alt+↑)"
          disabled={!!disabled || !canMove(-1)}
          onClick={() => actions.up()}
        >
          <IconUp />
        </button>
        <button
          className="btn btn-ghost icon-btn"
          aria-label="Move down"
          aria-keyshortcuts="Alt+ArrowDown"
          title="Move down (Alt+↓)"
          disabled={!!disabled || !canMove(1)}
          onClick={() => actions.down()}
        >
          <IconDown />
        </button>
        <button
          className="btn btn-ghost icon-btn"
          aria-label="Move out of parent"
          aria-keyshortcuts="Alt+ArrowLeft"
          title="Move out of its parent, one level up (Alt+←)"
          disabled={!!disabled || !sel || !outdent(root, sel)}
          onClick={() => actions.out()}
        >
          <IconOutdent />
        </button>
        <button
          className="btn btn-ghost icon-btn"
          aria-label="Move into previous container"
          aria-keyshortcuts="Alt+ArrowRight"
          title="Move into the container above, one level down (Alt+→)"
          disabled={!!disabled || !sel || !indent(root, sel, accepts)}
          onClick={() => actions.in()}
        >
          <IconIndent />
        </button>
        <button
          className="btn btn-ghost icon-btn btn-danger"
          aria-label="Remove layer"
          title="Remove layer"
          disabled={!!disabled || !sel?.length}
          onClick={actions.remove}
        >
          <IconTrash />
        </button>
      </div>
      {disabled ? <div className="layers-note">{disabled}</div> : null}
      <ul
        ref={list}
        className="tree"
        role="tree"
        aria-label="Component tree"
        aria-disabled={!!disabled || undefined}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropIfChanged(null)
        }}
      >
        {rows.map(({ node, path, depth }) => {
          const known = registry.has(node.type)
          const isDrop = drop?.over && samePath(drop.over, path)
          const lineDepth = isDrop && drop.position === 'first' ? depth + 1 : isDrop ? depth : 0
          return (
            <li key={path.join('.') || 'root'} role="none" className="tree-item">
              <div
                role="treeitem"
                tabIndex={0}
                data-path={path.join('.')}
                aria-selected={samePath(sel, path)}
                aria-level={depth + 1}
                aria-label={`${node.type}${summarize(node) ? `, ${summarize(node)}` : ''}`}
                draggable={!disabled && path.length > 0}
                className={[
                  'tree-row',
                  known ? '' : 'tree-unknown',
                  isDrop && drop.position === 'inside' ? 'drop-inside' : '',
                  draggingPath && isPrefix(draggingPath, path) ? 'is-dragging' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ paddingLeft: 8 + depth * 16 }}
                onClick={() => onSelect(path)}
                onKeyDown={(e) => onRowKey(e, path)}
                onDragStart={(e) => {
                  dragging = { kind: 'node', path }
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', node.type)
                  // Defer so the drag image is captured before the row fades.
                  requestAnimationFrame(() => setDraggingPath(path))
                }}
                onDragEnd={() => {
                  dragging = null
                  setDraggingPath(null)
                  setDrop(null)
                }}
                onDragOver={(e) => {
                  if (disabled) return
                  const d = pick(e, path, node)
                  setDropIfChanged(d)
                  if (!d) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = dragging?.kind === 'component' ? 'copy' : 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const d = pick(e, path, node)
                  if (d) commit(d)
                  else setDrop(null)
                }}
              >
                {Array.from({ length: depth }).map((_, i) => (
                  <span key={i} className="tree-guide" style={{ left: 15 + i * 16 }} aria-hidden />
                ))}
                <span className="tree-glyph" aria-hidden>
                  {node.type[0]}
                </span>
                <span className="tree-type">{node.type}</span>
                <span className="tree-summary">{summarize(node)}</span>
              </div>
              {isDrop && drop.position !== 'inside' ? (
                <span
                  className={`drop-line drop-line-${drop.position === 'before' ? 'top' : 'bottom'}`}
                  style={{ left: 8 + lineDepth * 16 }}
                  aria-hidden
                />
              ) : null}
            </li>
          )
        })}
        {!disabled ? (
          <li
            role="none"
            className="tree-end"
            onDragOver={(e) => {
              if (!dragging) return
              const d: Drop = { over: null, position: 'inside' }
              if (!allowed(dragging, slotOf(d))) return
              setDropIfChanged(d)
              e.preventDefault()
              e.dataTransfer.dropEffect = dragging.kind === 'component' ? 'copy' : 'move'
            }}
            onDrop={(e) => {
              e.preventDefault()
              commit({ over: null, position: 'inside' })
            }}
          >
            {drop && !drop.over ? (
              <span className="drop-line drop-line-top" style={{ left: 24 }} aria-hidden />
            ) : null}
          </li>
        ) : null}
      </ul>
      {!disabled ? (
        <div className="palette">
          <div className="palette-head" id={paletteId}>
            Drag a component into the layers, or press it to add it at the selection.
          </div>
          <div className="palette-items" role="group" aria-labelledby={paletteId}>
            {components.map((c) => (
              <div
                key={c.name}
                role="button"
                tabIndex={0}
                className="btn btn-sm chip"
                draggable
                title={c.description}
                onClick={() => insertFromPalette(c.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    insertFromPalette(c.name)
                  }
                }}
                onDragStart={(e) => {
                  dragging = { kind: 'component', type: c.name }
                  e.dataTransfer.effectAllowed = 'copy'
                  e.dataTransfer.setData('text/plain', c.name)
                }}
                onDragEnd={() => {
                  dragging = null
                  setDrop(null)
                }}
              >
                <span className="tree-glyph" aria-hidden>
                  {c.name[0]}
                </span>
                {c.name}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
