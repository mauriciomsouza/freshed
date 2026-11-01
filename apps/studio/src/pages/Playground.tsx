import { validateScreen, type Screen } from '@freshed/schema'
import { useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { usePreviewLog } from '../preview/Phone'
import { PreviewTable } from './Screens'

const STARTER: Screen = {
  slug: 'playground',
  title: 'Playground',
  root: {
    type: 'Stack',
    props: { gap: 'lg', padding: 'lg', grow: true },
    children: [
      {
        type: 'Hero',
        props: {
          eyebrow: 'Try it',
          title: 'Edit this JSON',
          subtitle: 'The preview uses the same renderer and components as the app.',
          image: 'asset:ember',
          tone: 'roast',
        },
      },
      { type: 'Countdown', props: { until: '2026-12-24' } },
      {
        type: 'List',
        props: {
          items: ['Unknown components fall back', 'Invalid props use defaults'],
          style: 'check',
        },
      },
      { type: 'Spacer', props: { size: 'flex' } },
      {
        type: 'Button',
        props: { label: 'Send an action', action: { type: 'emit', event: 'tap' } },
      },
    ],
  },
}

/** Unknown components are allowed here on purpose: the preview shows how apps fall back. */
const isRenderable = (issues: { message: string; severity: string }[]) =>
  issues.every(
    (i) =>
      i.severity === 'warning' ||
      i.message.startsWith('Unknown component') ||
      /is required/.test(i.message),
  )

export function PlaygroundPage() {
  const { workspace, saveScreen, toast } = useStore()
  const [text, setText] = useState(() => JSON.stringify(STARTER, null, 2))
  const { log, push, clear } = usePreviewLog()
  const lastGood = useRef<Screen>(STARTER)

  const { error, result, screen } = useMemo(() => {
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch (e) {
      return { error: (e as Error).message, result: null, screen: lastGood.current }
    }
    const r = validateScreen(json, workspace.components)
    if ((r.ok || isRenderable(r.issues)) && json && typeof json === 'object' && 'root' in json) {
      lastGood.current = json as Screen
    }
    return { error: null, result: r, screen: lastGood.current }
  }, [text, workspace.components])

  const exists = workspace.screens.some((s) => s.slug === screen.slug)

  return (
    <div className="page-body">
      <section className="col col-edit" aria-label="Playground JSON">
        <div className="col-head">
          <span className="col-title">Screen JSON</span>
          <span className="spacer" />
          <button className="btn btn-sm" onClick={() => setText(JSON.stringify(STARTER, null, 2))}>
            Reset
          </button>
          <button
            className="btn btn-sm"
            disabled={!result?.ok || exists}
            title={exists ? `A screen called "${screen.slug}" already exists` : undefined}
            onClick={async () => {
              if (!result?.ok) return
              await saveScreen(result.value)
              toast(`Saved “${result.value.title}” as a draft`)
            }}
          >
            Save as draft
          </button>
        </div>
        <div className="json-pane">
          <textarea
            className="textarea code"
            spellCheck={false}
            aria-label="Screen JSON"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error ? (
            <div className="issue">JSON: {error}</div>
          ) : result && result.issues.length ? (
            <ul className="issues" aria-label="Validation">
              {result.issues.map((i, k) => (
                <li
                  key={k}
                  className={`issue${i.severity === 'warning' || i.message.startsWith('Unknown component') ? ' issue-warning' : ''}`}
                >
                  {i.message}
                  <code>{i.path}</code>
                </li>
              ))}
            </ul>
          ) : (
            <div className="json-status">
              <span className="dot dot-live" />
              Valid against the registry
            </div>
          )}
        </div>
      </section>
      <PreviewTable
        screen={screen}
        log={log}
        onAction={(e) => push(screen.slug, e)}
        onClear={clear}
      />
    </div>
  )
}
