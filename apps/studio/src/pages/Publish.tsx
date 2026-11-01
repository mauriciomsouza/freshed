import type { ScopedIssue, SnapshotDiff } from '@freshed/schema'
import { useState } from 'react'
import { useStore } from '../data/store'
import { IconPublish, IconRestart } from '../ui/icons'

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

function changeRows(diff: SnapshotDiff) {
  const rows: { kind: 'added' | 'changed' | 'removed'; what: string; name: string }[] = []
  for (const [what, set] of [
    ['Screen', diff.screens],
    ['Flow', diff.flows],
    ['Component', diff.components],
  ] as const) {
    for (const kind of ['added', 'changed', 'removed'] as const)
      for (const name of set[kind]) rows.push({ kind, what, name })
  }
  return rows
}

export function PublishPage() {
  const { status, versions, publish, rollback, toast, workspace } = useStore()
  const [message, setMessage] = useState('')
  const [issues, setIssues] = useState<ScopedIssue[]>([])
  const [confirm, setConfirm] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const rows = status ? changeRows(status.diff) : []
  const liveNumber = status?.live?.number
  const titleFor = (kind: string, name: string) =>
    kind === 'Screen'
      ? (workspace.screens.find((s) => s.slug === name)?.title ?? name)
      : kind === 'Flow'
        ? (workspace.flows.find((f) => f.slug === name)?.title ?? name)
        : name

  return (
    <div className="publish">
      <section className="publish-card" aria-label="Publish">
        <div>
          <h2>
            {rows.length
              ? `${rows.length} unpublished change${rows.length === 1 ? '' : 's'}`
              : 'Everything is live'}
          </h2>
          <p className="field-hint" style={{ marginTop: 4, fontSize: 13 }}>
            {rows.length
              ? 'Publishing creates a new version. Apps pick it up on their next request.'
              : `Drafts match v${liveNumber ?? 0}. Edit a screen to start a new version.`}
          </p>
        </div>
        {rows.length ? (
          <ul className="changes">
            {rows.map((r) => (
              <li key={`${r.what}:${r.name}`}>
                <span className={`change-kind change-${r.kind}`}>
                  {r.kind[0]!.toUpperCase() + r.kind.slice(1)}
                </span>
                <span style={{ flex: 1 }}>{titleFor(r.what, r.name)}</span>
                <span className="tag">{r.what}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="field">
          <label className="field-label" htmlFor="publish-message">
            What changed
          </label>
          <input
            id="publish-message"
            className="input"
            placeholder="e.g. Shorter welcome copy"
            value={message}
            maxLength={200}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        {issues.length ? (
          <ul className="issues" aria-label="Publish blocked">
            {issues.map((i, k) => (
              <li key={k} className="issue">
                {i.message}
                <code>{i.scope}</code>
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <button
            className="btn btn-primary"
            style={{ height: 34, padding: '0 16px' }}
            disabled={!rows.length || busy}
            onClick={async () => {
              setBusy(true)
              const r = await publish(message.trim() || 'Update content')
              setBusy(false)
              if (!r.ok) {
                setIssues(r.issues)
                return
              }
              setIssues([])
              setMessage('')
              toast(`Published v${r.version.number}`)
            }}
          >
            <IconPublish />
            Publish v{(versions[0]?.number ?? 0) + 1}
          </button>
        </div>
        <div className="ai-note">
          <span>
            Versions are immutable. Rolling back publishes a copy of an older version, so history
            only grows and every app build can still be served a version it understands.
          </span>
        </div>
      </section>
      <section aria-label="Version history" style={{ background: 'var(--bg)' }}>
        <div className="col-head" style={{ background: 'var(--panel)' }}>
          <span className="col-title">History</span>
          <span className="spacer" />
          <span className="field-hint">{versions.length} versions</span>
        </div>
        <ol className="timeline">
          {versions.map((v) => {
            const isLive = v.number === liveNumber
            return (
              <li key={v.number} className={isLive ? 'is-live' : ''}>
                <span className="node" aria-hidden />
                <div>
                  <div className="v-title">
                    <span className="v-num">v{v.number}</span>
                    {v.message}
                    {isLive ? <span className="tag tag-live">Live</span> : null}
                    {v.rolledBackFrom ? (
                      <span className="tag">Copy of v{v.rolledBackFrom}</span>
                    ) : null}
                  </div>
                  <div className="v-meta">
                    {v.createdBy ?? 'Someone'} published {relative(v.createdAt)}
                  </div>
                  <div className="v-counts">
                    <span className="tag">{v.counts.screens} screens</span>
                    <span className="tag">
                      {v.counts.flows} flow{v.counts.flows === 1 ? '' : 's'}
                    </span>
                    <span className="tag">{v.counts.components} components</span>
                  </div>
                  {confirm === v.number ? (
                    <div
                      className="confirm"
                      role="alertdialog"
                      aria-label={`Roll back to v${v.number}`}
                    >
                      <span style={{ flex: 1 }}>
                        Publish a copy of v{v.number} as v{(versions[0]?.number ?? 0) + 1}? Drafts
                        reset to match it.
                      </span>
                      <button className="btn btn-sm" onClick={() => setConfirm(null)}>
                        Cancel
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={async () => {
                          const nv = await rollback(v.number)
                          setConfirm(null)
                          toast(`Rolled back. v${nv.number} is live.`)
                        }}
                      >
                        Roll back
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="v-actions">
                  {!isLive && confirm !== v.number ? (
                    <button className="btn btn-sm" onClick={() => setConfirm(v.number)}>
                      <IconRestart />
                      Roll back
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
