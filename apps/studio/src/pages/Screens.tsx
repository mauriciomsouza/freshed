import {
  validateScreen,
  type ComponentDefinition,
  type Screen,
  type ScreenNode,
} from '@freshed-cms/schema'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { PhoneFrame, ScreenPreview, usePreviewLog } from '../preview/Phone'
import type { Route } from '../router'
import { IconDown, IconPlus, IconTrash, IconUp } from '../ui/icons'
import { PropField } from '../ui/PropField'
import {
  flattenTree,
  getAt,
  insertChild,
  moveAt,
  removeAt,
  samePath,
  summarize,
  updateAt,
  type Path,
} from '../ui/tree'

export function ScreensPage({ slug, navigate }: { slug?: string; navigate: (r: Route) => void }) {
  const { workspace, status } = useStore()
  const screens = workspace.screens
  const current = screens.find((s) => s.slug === slug) ?? screens[0]
  const diff = status?.diff.screens

  return (
    <div className="page-body">
      <aside className="col col-list" aria-label="Screens">
        <div className="col-head">
          <span className="col-title">{screens.length} screens</span>
        </div>
        <ul className="list col-scroll">
          {screens.map((s) => {
            const state = diff?.added.includes(s.slug)
              ? 'new'
              : diff?.changed.includes(s.slug)
                ? 'draft'
                : 'live'
            return (
              <li key={s.slug}>
                <button
                  className="list-item"
                  aria-current={s.slug === current?.slug}
                  onClick={() => navigate({ page: 'screens', slug: s.slug })}
                >
                  <span className="list-item-row">
                    <span className="list-item-title">{s.title}</span>
                    <span
                      className={`dot dot-${state}`}
                      title={
                        state === 'live'
                          ? 'Published'
                          : state === 'new'
                            ? 'New draft'
                            : 'Unpublished changes'
                      }
                    />
                  </span>
                  <span className="list-item-sub">/{s.slug}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>
      {current ? (
        <ScreenEditor key={current.slug} screen={current} />
      ) : (
        <div className="empty">No screens yet.</div>
      )}
    </div>
  )
}

function ScreenEditor({ screen }: { screen: Screen }) {
  const { workspace, saveScreen, toast } = useStore()
  const [draft, setDraft] = useState<Screen>(screen)
  const [selected, setSelected] = useState<Path | null>(screen.root.children?.length ? [0] : [])
  const [mode, setMode] = useState<'tree' | 'json'>('tree')
  const { log, push, clear } = usePreviewLog()

  // Persist edits shortly after typing stops: drafts are cheap and never public.
  useEffect(() => {
    if (draft === screen) return
    const t = setTimeout(() => void saveScreen(draft), 350)
    return () => clearTimeout(t)
  }, [draft, screen, saveScreen])

  const registry = useMemo(
    () => new Map(workspace.components.map((c) => [c.name, c])),
    [workspace.components],
  )
  const result = useMemo(
    () => validateScreen(draft, workspace.components),
    [draft, workspace.components],
  )
  const node = selected ? getAt(draft.root, selected) : undefined
  const def = node ? registry.get(node.type) : undefined
  const screenSlugs = workspace.screens.map((s) => s.slug)

  const setRoot = (root: ScreenNode) => setDraft((d) => ({ ...d, root }))
  const errors = result.issues.filter((i) => i.severity === 'error')

  return (
    <>
      <section className="col col-edit" aria-label="Screen editor">
        <div className="col-head">
          <input
            className="input"
            aria-label="Screen title"
            style={{
              border: 'none',
              padding: 0,
              fontWeight: 600,
              fontSize: 15,
              background: 'transparent',
              boxShadow: 'none',
              maxWidth: 260,
            }}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <code className="crumb">/{draft.slug}</code>
          <span className="spacer" />
          {errors.length ? (
            <span className="state" style={{ color: 'var(--danger)' }}>
              <span className="dot" style={{ background: 'var(--danger)' }} />
              {errors.length} {errors.length === 1 ? 'issue' : 'issues'}
            </span>
          ) : (
            <span className="state">
              <span className="dot dot-live" />
              Valid
            </span>
          )}
          <div className="segmented" role="group" aria-label="Editor mode">
            <button aria-pressed={mode === 'tree'} onClick={() => setMode('tree')}>
              Tree
            </button>
            <button aria-pressed={mode === 'json'} onClick={() => setMode('json')}>
              JSON
            </button>
          </div>
        </div>
        {mode === 'tree' ? (
          <div className="editor-split">
            <TreeView
              root={draft.root}
              selected={selected}
              onSelect={setSelected}
              registry={registry}
            />
            <div className="inspector">
              {node && selected ? (
                <Inspector
                  node={node}
                  def={def}
                  path={selected}
                  screens={screenSlugs}
                  components={workspace.components}
                  onChange={(n) => setRoot(updateAt(draft.root, selected, () => n))}
                  onRemove={() => {
                    setRoot(removeAt(draft.root, selected))
                    setSelected(selected.slice(0, -1))
                    toast(`Removed ${node.type}`)
                  }}
                  onMove={(delta) => {
                    const r = moveAt(draft.root, selected, delta)
                    setRoot(r.root)
                    setSelected(r.path)
                  }}
                  onAdd={(type) => {
                    const r = insertChild(draft.root, selected, {
                      id: `${type.toLowerCase()}-${Date.now().toString(36).slice(-4)}`,
                      type,
                      props: {},
                    })
                    setRoot(r.root)
                    setSelected(r.path)
                  }}
                />
              ) : (
                <div className="empty">Select a node to edit its props.</div>
              )}
              {errors.length ? (
                <ul className="issues" aria-label="Validation issues">
                  {errors.slice(0, 6).map((i, k) => (
                    <li key={k} className="issue">
                      {i.message}
                      <code>{i.path}</code>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : (
          <JsonEditor screen={draft} onChange={setDraft} />
        )}
      </section>
      <PreviewTable
        screen={draft}
        log={log}
        onAction={(e) => push(draft.slug, e)}
        onClear={clear}
      />
    </>
  )
}

function TreeView({
  root,
  selected,
  onSelect,
  registry,
}: {
  root: ScreenNode
  selected: Path | null
  onSelect: (p: Path) => void
  registry: Map<string, ComponentDefinition>
}) {
  const rows = flattenTree(root)
  return (
    <ul className="tree" role="tree" aria-label="Component tree">
      {rows.map(({ node, path, depth }) => {
        const known = registry.has(node.type)
        return (
          <li key={path.join('.') || 'root'} role="none">
            <button
              role="treeitem"
              aria-selected={samePath(selected, path)}
              aria-level={depth + 1}
              className={`tree-row${known ? '' : ' tree-unknown'}`}
              style={{ paddingLeft: 8 + depth * 16 }}
              onClick={() => onSelect(path)}
            >
              {Array.from({ length: depth }).map((_, i) => (
                <span key={i} className="tree-guide" style={{ left: 15 + i * 16 }} aria-hidden />
              ))}
              <span className="tree-glyph" aria-hidden>
                {node.type[0]}
              </span>
              <span className="tree-type">{node.type}</span>
              <span className="tree-summary">{summarize(node)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Inspector({
  node,
  def,
  path,
  screens,
  components,
  onChange,
  onRemove,
  onMove,
  onAdd,
}: {
  node: ScreenNode
  def: ComponentDefinition | undefined
  path: Path
  screens: string[]
  components: ComponentDefinition[]
  onChange: (n: ScreenNode) => void
  onRemove: () => void
  onMove: (d: -1 | 1) => void
  onAdd: (type: string) => void
}) {
  const isRoot = path.length === 0
  return (
    <>
      <div className="inspector-head">
        <h2 className="inspector-title">{node.type}</h2>
        {node.id ? <code className="crumb">#{node.id}</code> : null}
        {!isRoot ? (
          <div className="inspector-actions">
            <button
              className="btn btn-ghost icon-btn"
              aria-label="Move up"
              onClick={() => onMove(-1)}
            >
              <IconUp />
            </button>
            <button
              className="btn btn-ghost icon-btn"
              aria-label="Move down"
              onClick={() => onMove(1)}
            >
              <IconDown />
            </button>
            <button
              className="btn btn-ghost icon-btn btn-danger"
              aria-label="Remove node"
              onClick={onRemove}
            >
              <IconTrash />
            </button>
          </div>
        ) : null}
      </div>
      {def?.description ? <p className="inspector-desc">{def.description}</p> : null}
      {!def ? (
        <div className="issue">
          “{node.type}” is not in the registry. Apps render a fallback for it.
        </div>
      ) : (
        Object.entries(def.props).map(([name, spec]) => (
          <PropField
            key={name}
            name={name}
            spec={spec}
            value={node.props?.[name]}
            screens={screens}
            onChange={(v) => {
              const props = { ...node.props }
              if (v === undefined) delete props[name]
              else props[name] = v
              onChange({ ...node, props })
            }}
          />
        ))
      )}
      {def?.children ? (
        <div className="field">
          <span className="field-label">Add child</span>
          <div className="add-menu">
            {components
              .filter((c) => c.name !== 'Stack' || path.length < 3)
              .map((c) => (
                <button key={c.name} className="btn btn-sm" onClick={() => onAdd(c.name)}>
                  <IconPlus />
                  {c.name}
                </button>
              ))}
          </div>
        </div>
      ) : null}
    </>
  )
}

function JsonEditor({ screen, onChange }: { screen: Screen; onChange: (s: Screen) => void }) {
  const [text, setText] = useState(() => JSON.stringify(screen, null, 2))
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="json-pane">
      <textarea
        className="textarea code"
        spellCheck={false}
        aria-label="Screen JSON"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          try {
            const parsed = JSON.parse(e.target.value) as Screen
            if (parsed.slug !== screen.slug) throw new Error('Slug cannot change here')
            setError(null)
            onChange(parsed)
          } catch (err) {
            setError((err as Error).message)
          }
        }}
      />
      <div className="json-status">
        <span
          className={`dot ${error ? '' : 'dot-live'}`}
          style={error ? { background: 'var(--danger)' } : undefined}
        />
        {error ?? 'Parsed. Changes save as a draft.'}
      </div>
    </div>
  )
}

export function PreviewTable({
  screen,
  log,
  onAction,
  onClear,
  head,
  handlers,
  overlay,
}: {
  screen: Screen
  log: ReturnType<typeof usePreviewLog>['log']
  onAction: Parameters<typeof ScreenPreview>[0]['onAction']
  onClear: () => void
  head?: React.ReactNode
  handlers?: Parameters<typeof ScreenPreview>[0]['handlers']
  overlay?: React.ReactNode
}) {
  return (
    <section className="table" aria-label="Live preview">
      <div className="table-head">
        {head ?? (
          <>
            <span className="col-title">Preview</span>
            <span className="spacer" style={{ flex: 1 }} />
            <span className="state">
              <span className="dot dot-new" />
              Same renderer as the app
            </span>
          </>
        )}
      </div>
      <div className="table-stage">
        <PhoneFrame label={`Preview of ${screen.title}`}>
          <ScreenPreview screen={screen} handlers={handlers} onAction={onAction} />
          {overlay}
        </PhoneFrame>
      </div>
      <div className="log" aria-live="polite">
        <div className="log-head">
          <span>Actions</span>
          {log.length ? (
            <button className="btn btn-ghost btn-sm" style={{ height: 18 }} onClick={onClear}>
              Clear
            </button>
          ) : null}
        </div>
        {log.length ? (
          <ol>
            {log.map((e) => (
              <li key={e.id} className={e.handled ? '' : 'unhandled'}>
                <span className="log-from">{e.screen}</span>
                <span>{e.label}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="log-empty">Tap buttons in the preview to see the actions they send.</div>
        )}
      </div>
    </section>
  )
}
