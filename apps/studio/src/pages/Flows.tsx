import {
  createFlowState,
  transition,
  type ActionHandlers,
  type FlowState,
} from '@freshed-cms/react-native'
import { FLOW_END, validateFlow, type Flow, type Screen } from '@freshed-cms/schema'
import { useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { usePreviewLog } from '../preview/Phone'
import type { Route } from '../router'
import { IconBack, IconRestart } from '../ui/icons'
import { PreviewTable } from './Screens'

export function FlowsPage({ slug, navigate }: { slug?: string; navigate: (r: Route) => void }) {
  const { workspace } = useStore()
  const flow = workspace.flows.find((f) => f.slug === slug) ?? workspace.flows[0]
  if (!flow) return <div className="empty">No flows yet.</div>
  return (
    <div className="page-body">
      <FlowView
        key={flow.slug}
        flow={flow}
        flows={workspace.flows}
        screens={workspace.screens}
        navigate={navigate}
      />
    </div>
  )
}

/** Layered left-to-right layout: column = shortest distance from the start screen. */
function layout(flow: Flow) {
  const depth = new Map<string, number>([[flow.start, 0]])
  const queue = [flow.start]
  while (queue.length) {
    const cur = queue.shift()!
    for (const e of flow.edges) {
      if (e.from === cur && e.to !== FLOW_END && !depth.has(e.to)) {
        depth.set(e.to, depth.get(cur)! + 1)
        queue.push(e.to)
      }
    }
  }
  let maxDepth = Math.max(0, ...depth.values())
  for (const s of flow.screens) if (!depth.has(s)) depth.set(s, ++maxDepth)
  const columns = new Map<number, string[]>()
  for (const s of flow.screens) {
    const d = depth.get(s)!
    columns.set(d, [...(columns.get(d) ?? []), s])
  }
  const W = 164
  const H = 128
  const GX = 56
  const GY = 36
  const pos = new Map<string, { x: number; y: number }>()
  const tallest = Math.max(...[...columns.values()].map((c) => c.length))
  for (const [d, col] of columns) {
    const offset = ((tallest - col.length) * (H + GY)) / 2
    col.forEach((s, i) => pos.set(s, { x: 24 + d * (W + GX), y: 76 + offset + i * (H + GY) }))
  }
  const cols = Math.max(...columns.keys()) + 1
  const end = { x: 24 + cols * (W + GX) + 10, y: 76 + (tallest * (H + GY) - GY) / 2 - 20 }
  return { pos, W, H, end, width: end.x + 40, height: 76 + tallest * (H + GY) + 70 }
}

function FlowView({
  flow,
  flows,
  screens,
  navigate,
}: {
  flow: Flow
  flows: Flow[]
  screens: Screen[]
  navigate: (r: Route) => void
}) {
  const [state, setState] = useState<FlowState>(() => createFlowState(flow))
  const [taken, setTaken] = useState<Set<string>>(new Set())
  const { log, push, clear } = usePreviewLog()
  const stateRef = useRef(state)
  stateRef.current = state

  const g = useMemo(() => layout(flow), [flow])
  const bySlug = useMemo(() => new Map(screens.map((s) => [s.slug, s])), [screens])
  const check = useMemo(() => validateFlow(flow, screens), [flow, screens])
  const current = bySlug.get(state.current)

  const apply = (input: Parameters<typeof transition>[2]) => {
    const prev = stateRef.current
    const next = transition(flow, prev, input)
    if (input.type === 'emit' && next.result.type !== 'ignored') {
      setTaken((t) => new Set(t).add(`${prev.current}:${input.event}`))
    }
    stateRef.current = next.state
    setState(next.state)
  }
  const restart = () => {
    apply({ type: 'reset', start: flow.start })
    setTaken(new Set())
    clear()
  }
  const handlers: ActionHandlers = {
    emit: (a) => apply({ type: 'emit', event: a.event }),
    navigate: (a) => apply({ type: 'navigate', to: a.to }),
    back: () => apply({ type: 'back' }),
    submit: (a) => {
      if (a.event) apply({ type: 'emit', event: a.event })
    },
  }
  const visited = new Set([...state.history, state.current])

  const edgePath = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    backwards: boolean,
  ) => {
    const sx = from.x + g.W
    const sy = from.y + g.H / 2
    if (backwards) {
      const tx = to.x + g.W / 2
      const ty = to.y + g.H
      return `M ${from.x + g.W / 2} ${from.y + g.H} C ${from.x + g.W / 2} ${from.y + g.H + 60}, ${tx} ${ty + 60}, ${tx} ${ty}`
    }
    const tx = to.x
    const ty = to.y + g.H / 2
    const mx = (sx + tx) / 2
    return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`
  }

  const edges = flow.edges.flatMap((e) => {
    const from = g.pos.get(e.from)
    const isEnd = e.to === FLOW_END
    const to = isEnd ? { x: g.end.x - 18, y: g.end.y - g.H / 2 } : g.pos.get(e.to)
    if (!from || !to) return []
    const backwards = !isEnd && to.x <= from.x
    // Edges that skip over other screens arc above the row so they never cross a node.
    const skips = to.x - (from.x + g.W) > 120
    if (skips) {
      const sx = from.x + g.W / 2
      const tx = to.x + 18
      const top = Math.min(from.y, to.y) - 44
      const ty = isEnd ? g.end.y - 18 : to.y
      const d = `M ${sx} ${from.y} C ${sx} ${top}, ${tx} ${top}, ${tx} ${ty}`
      const w = e.event.length * 7 + 16
      return [
        {
          key: `${e.from}:${e.event}`,
          event: e.event,
          d,
          lx: (sx + tx) / 2,
          ly: top + 11,
          w,
          taken: taken.has(`${e.from}:${e.event}`),
        },
      ]
    }
    const d = edgePath(from, to, backwards)
    const lx = backwards ? (from.x + to.x) / 2 + g.W / 2 : (from.x + g.W + to.x) / 2
    const ly = backwards ? Math.max(from.y, to.y) + g.H + 46 : (from.y + to.y) / 2 + g.H / 2
    return [
      {
        key: `${e.from}:${e.event}`,
        event: e.event,
        d,
        lx,
        ly,
        w: e.event.length * 7 + 16,
        taken: taken.has(`${e.from}:${e.event}`),
      },
    ]
  })

  return (
    <>
      <section className="graph-wrap" aria-label="Flow graph">
        <div className="col-head">
          {flows.length > 1 ? (
            <select
              className="select"
              aria-label="Flow"
              style={{ width: 'auto' }}
              value={flow.slug}
              onChange={(e) => navigate({ page: 'flows', slug: e.target.value })}
            >
              {flows.map((f) => (
                <option key={f.slug} value={f.slug}>
                  {f.title}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontWeight: 600, fontSize: 15 }}>{flow.title}</span>
          )}
          <code className="crumb">/{flow.slug}</code>
          <span className="tag">{flow.screens.length} screens</span>
          <span className="spacer" />
          {check.issues.length ? (
            <span className="state" style={{ color: 'var(--draft)' }}>
              <span className="dot dot-draft" />
              {check.issues.length} warning{check.issues.length === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="state">
              <span className="dot dot-live" />
              Every event has an edge
            </span>
          )}
        </div>
        <div className="graph">
          <svg
            viewBox={`0 0 ${g.width} ${g.height}`}
            style={{ width: '100%', height: 'auto', maxHeight: '100%' }}
            role="img"
            aria-label={`${flow.title} flow with ${flow.screens.length} screens`}
          >
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M0 0 8 4 0 8z" fill="var(--line-strong)" />
              </marker>
              <marker
                id="arrow-on"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M0 0 8 4 0 8z" fill="var(--signal)" />
              </marker>
            </defs>
            {edges.map((e) => (
              <g key={e.key} className={`graph-edge${e.taken ? ' is-taken' : ''}`}>
                <path d={e.d} markerEnd={`url(#${e.taken ? 'arrow-on' : 'arrow'})`} />
              </g>
            ))}
            {flow.screens.map((slug) => {
              const p = g.pos.get(slug)!
              const s = bySlug.get(slug)
              const isCurrent = slug === state.current && !state.ended
              return (
                <g
                  key={slug}
                  className={`graph-node${isCurrent ? ' is-current' : ''}${visited.has(slug) ? ' is-visited' : ''}`}
                  transform={`translate(${p.x} ${p.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Jump to ${s?.title ?? slug}`}
                  onClick={() => apply({ type: 'navigate', to: slug })}
                  onDoubleClick={() => navigate({ page: 'screens', slug })}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') apply({ type: 'navigate', to: slug })
                  }}
                >
                  <rect className="card" width={g.W} height={g.H} rx={10} />
                  <Thumb screen={s} w={g.W} />
                  <text className="title" x={12} y={g.H - 30}>
                    {s?.title ?? slug}
                  </text>
                  <text className="slug" x={12} y={g.H - 13}>
                    /{slug}
                  </text>
                  {slug === flow.start ? (
                    <g className="graph-start">
                      <text x={0} y={g.H + 18}>
                        Start
                      </text>
                    </g>
                  ) : null}
                </g>
              )
            })}
            {edges.map((e) => (
              <g key={e.key} className={`graph-edge${e.taken ? ' is-taken' : ''}`}>
                <rect x={e.lx - e.w / 2} y={e.ly - 10} width={e.w} height={20} rx={10} />
                <text x={e.lx} y={e.ly + 4} textAnchor="middle">
                  {e.event}
                </text>
              </g>
            ))}
            <g className="graph-end" transform={`translate(${g.end.x} ${g.end.y})`}>
              <circle r={18} />
              <text textAnchor="middle" y={4}>
                End
              </text>
            </g>
          </svg>
        </div>
        <div className="edge-table">
          <table className="data">
            <thead>
              <tr>
                <th>From</th>
                <th>Event</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {flow.edges.map((e) => (
                <tr key={`${e.from}:${e.event}`}>
                  <td>{bySlug.get(e.from)?.title ?? e.from}</td>
                  <td>
                    <code>{e.event}</code>
                  </td>
                  <td>
                    {e.to === FLOW_END ? (
                      <span className="tag">End of flow</span>
                    ) : (
                      (bySlug.get(e.to)?.title ?? e.to)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {current ? (
        <PreviewTable
          screen={current}
          log={log}
          onAction={(e) => push(stateRef.current.current, e)}
          onClear={clear}
          handlers={handlers}
          head={
            <>
              <span className="col-title">Click through</span>
              <span className="spacer" style={{ flex: 1 }} />
              <button
                className="btn btn-sm"
                onClick={() => apply({ type: 'back' })}
                disabled={!state.history.length}
              >
                <IconBack />
                Back
              </button>
              <button className="btn btn-sm" onClick={restart}>
                <IconRestart />
                Restart
              </button>
            </>
          }
          overlay={
            state.ended ? (
              <div className="phone-ended">
                <div>
                  <strong>Flow ended</strong>
                  <p>The app takes over from here, for example to show the home screen.</p>
                  <button className="btn" onClick={restart}>
                    Restart flow
                  </button>
                </div>
              </div>
            ) : null
          }
        />
      ) : null}
    </>
  )
}

/** A tiny wireframe of the screen: one bar per top-level node, shaped by component type. */
function Thumb({ screen, w }: { screen?: Screen; w: number }) {
  const kids = screen?.root.children ?? []
  let y = 10
  const bars: React.ReactNode[] = []
  for (const [i, k] of kids.entries()) {
    if (y > 70) break
    const h =
      k.type === 'Hero'
        ? 30
        : k.type === 'Image'
          ? 22
          : k.type === 'Card'
            ? 12
            : k.type === 'Spacer'
              ? 0
              : k.type === 'Button'
                ? 9
                : 6
    if (!h) continue
    const width = k.type === 'Text' ? (w - 24) * 0.6 : w - 24
    const fill =
      k.type === 'Button' && k.props?.variant !== 'ghost' ? 'var(--text-2)' : 'var(--sunken)'
    bars.push(
      <rect
        key={i}
        className="thumb"
        x={12}
        y={y}
        width={width}
        height={h}
        rx={k.type === 'Button' ? 4.5 : 3}
        style={{ fill }}
      />,
    )
    y += h + 5
  }
  return <g aria-hidden>{bars}</g>
}
