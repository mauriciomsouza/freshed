import {
  componentFile,
  createProvider,
  DEFAULT_ANTHROPIC_MODEL,
  generatePlan,
  mockProvider,
  patchRegistry,
  type GenerateResult,
  type ProviderId,
} from '@freshed/ai'
import { recordedPlan, recordedPrompt } from '@freshed/example-brew'
import { FLOW_END, type Screen } from '@freshed/schema'
import { useMemo, useState } from 'react'
import { safeStorage } from '../data/backend'
import { useStore } from '../data/store'
import { PhoneFrame, ScreenPreview } from '../preview/Phone'
import type { Route } from '../router'
import { IconShield, IconSpark } from '../ui/icons'

/**
 * Generate with AI. The key is used only for the request from this browser
 * tab to the provider. It is kept in sessionStorage (cleared when the tab
 * closes), never sent to the freshed server and never logged.
 */

const session = safeStorage('session')
const KEY_STORAGE = 'freshed:ai:key'

const REGISTRY_SOURCE = `import { createRegistry } from '@freshed/react-native'
import { Button, Card, Hero, Image, List, Spacer, Stack, Text } from './components'
// freshed:imports

export const components = [
  Stack,
  Hero,
  Text,
  Button,
  Image,
  Card,
  List,
  Spacer,
  // freshed:components
]
`

function lineDiff(before: string, after: string) {
  const a = new Set(before.split('\n'))
  return after
    .split('\n')
    .map((line) => ({ line, added: !a.has(line) }))
    .filter((l, i, arr) => l.added || arr[i - 1]?.added || arr[i + 1]?.added)
}

export function AiPage({ navigate }: { navigate: (r: Route) => void }) {
  const { workspace, saveScreen, saveFlow, saveComponent, toast } = useStore()
  const [provider, setProvider] = useState<ProviderId>('anthropic')
  const [model, setModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState(() => session.get(KEY_STORAGE) ?? '')
  const [prompt, setPrompt] = useState(recordedPrompt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<(GenerateResult & { ok: true; recorded: boolean }) | null>(
    null,
  )
  const [tab, setTab] = useState(0)
  const [saved, setSaved] = useState(false)

  const hasKey = apiKey.trim().length > 0

  async function run(useRecording: boolean) {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const p = useRecording
        ? mockProvider([recordedPlan], { model: 'pre-recorded', delayMs: 650 })
        : createProvider({
            provider,
            apiKey: apiKey.trim(),
            model: model.trim() || (provider === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : undefined),
            baseUrl: baseUrl.trim() || undefined,
            browser: true,
          })
      const r = await generatePlan(p, { prompt: useRecording ? recordedPrompt : prompt, workspace })
      if (!r.ok) {
        setError(
          `The model returned an invalid plan twice. First issue: ${r.issues[0]?.message ?? 'unknown'}`,
        )
        setResult(null)
      } else {
        setResult({ ...r, recorded: useRecording })
        setTab(0)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function saveDrafts() {
    if (!result) return
    for (const c of result.plan.newComponents) await saveComponent(c.definition)
    for (const s of result.plan.screens) await saveScreen(s)
    for (const f of result.drafts.flows) {
      if (result.plan.flowEdges.some((e) => e.flow === f.slug)) await saveFlow(f)
    }
    setSaved(true)
    toast('Saved as draft. Nothing is published yet.')
  }

  const files = useMemo(() => {
    if (!result) return []
    const comps = result.plan.newComponents.map((c) =>
      componentFile(c, { componentsDir: 'src/freshed/components' }),
    )
    if (!comps.length) return []
    const patched = patchRegistry(
      REGISTRY_SOURCE,
      result.plan.newComponents.map((c) => c.definition.name),
      (n) => `./components/${n}`,
    )
    return [
      ...comps.map((f) => ({
        path: f.path,
        status: 'new file' as const,
        lines: f.contents
          .trimEnd()
          .split('\n')
          .map((line) => ({ line, added: true })),
      })),
      {
        path: 'src/freshed/registry.ts',
        status: 'modified' as const,
        lines: lineDiff(REGISTRY_SOURCE, patched),
      },
    ]
  }, [result])

  const screen: Screen | undefined = result?.plan.screens[tab]

  return (
    <div className="ai">
      <section className="ai-form" aria-label="Generate with AI">
        <div>
          <h2>Describe the change</h2>
          <p className="field-hint" style={{ marginTop: 4, fontSize: 13 }}>
            Describe a screen. freshed ai proposes drafts built from your registered components,
            plus any component the app is missing.
          </p>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ai-prompt">
            Prompt
          </label>
          <textarea
            id="ai-prompt"
            className="textarea ai-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
        <div className="ai-row">
          <div className="field">
            <label className="field-label" htmlFor="ai-provider">
              Provider
            </label>
            <select
              id="ai-provider"
              className="select"
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderId)}
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai-compatible">OpenAI-compatible</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ai-model">
              Model
            </label>
            <input
              id="ai-model"
              className="input"
              placeholder={provider === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : 'required'}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>
        </div>
        {provider === 'openai-compatible' ? (
          <div className="field">
            <label className="field-label" htmlFor="ai-base">
              Base URL
            </label>
            <input
              id="ai-base"
              className="input"
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
        ) : null}
        <div className="field">
          <label className="field-label" htmlFor="ai-key">
            Your API key
          </label>
          <input
            id="ai-key"
            className="input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              if (e.target.value) session.set(KEY_STORAGE, e.target.value)
              else session.remove(KEY_STORAGE)
            }}
          />
        </div>
        <div className="ai-note">
          <IconShield />
          <span>
            Your key stays in this browser tab. It goes straight to the provider you picked, is
            never sent to a freshed server, and is cleared when you close the tab.
          </span>
        </div>
        <div className="ai-actions">
          <button
            className="btn btn-primary"
            style={{ height: 34, padding: '0 14px' }}
            disabled={!hasKey || busy || prompt.trim().length < 3}
            onClick={() => run(false)}
          >
            {busy && hasKey ? <span className="spinner" /> : <IconSpark />}
            Generate drafts
          </button>
          <button className="btn" style={{ height: 34 }} disabled={busy} onClick={() => run(true)}>
            {busy && !hasKey ? <span className="spinner" /> : null}
            Show an example
          </button>
        </div>
        {!hasKey ? (
          <p className="field-hint">
            Add a key to generate from your own prompt, or play a pre-recorded generation for the
            Brew app.
          </p>
        ) : null}
        {error ? <div className="issue">{error}</div> : null}
      </section>

      <section className="ai-result" aria-label="Proposed changes">
        {!result ? (
          <div className="empty">
            <h2>Nothing proposed yet</h2>
            Generated screens appear here with a live preview, the components they need, and the
            code freshed would add to your app. Nothing is saved until you choose to.
          </div>
        ) : (
          <>
            <div className="ai-summary">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3>{result.plan.summary}</h3>
                {result.recorded ? <span className="tag">Pre-recorded example</span> : null}
              </div>
              <div className="meta">
                {result.model} · validated against the schema
                {result.attempts > 1 ? ' after one repair' : ' on the first try'}
              </div>
              <div className="ai-actions" style={{ marginTop: 6 }}>
                <button className="btn btn-primary" disabled={saved} onClick={saveDrafts}>
                  {saved ? 'Saved as draft' : 'Save as draft'}
                </button>
                {saved && screen ? (
                  <button
                    className="btn"
                    onClick={() =>
                      navigate({ page: 'flows', slug: result.plan.flowEdges[0]?.flow })
                    }
                  >
                    Open in flow
                  </button>
                ) : null}
                <span className="field-hint">Publishing stays a separate, human step.</span>
              </div>
            </div>
            <div className="ai-grid">
              <div className="ai-details">
                {result.plan.screens.length > 1 ? (
                  <div className="ai-tabs" role="tablist">
                    {result.plan.screens.map((s, i) => (
                      <button
                        key={s.slug}
                        role="tab"
                        aria-selected={i === tab}
                        className={`btn btn-sm${i === tab ? ' btn-primary' : ''}`}
                        onClick={() => setTab(i)}
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div>
                  <h4>CMS drafts</h4>
                  <ul className="changes">
                    {result.plan.screens.map((s) => (
                      <li key={s.slug}>
                        <span
                          className={`change-kind change-${workspace.screens.some((x) => x.slug === s.slug) ? 'changed' : 'added'}`}
                        >
                          {workspace.screens.some((x) => x.slug === s.slug) ? 'Changed' : 'Added'}
                        </span>
                        <span style={{ flex: 1 }}>{s.title}</span>
                        <span className="tag">Screen</span>
                      </li>
                    ))}
                    {result.plan.flowEdges.map((e) => (
                      <li key={`${e.flow}:${e.from}:${e.event}`}>
                        <span className="change-kind change-changed">Edge</span>
                        <span style={{ flex: 1 }}>
                          <code>{e.from}</code> on <code>{e.event}</code> →{' '}
                          <code>{e.to === FLOW_END ? 'end' : e.to}</code>
                        </span>
                        <span className="tag">{e.flow}</span>
                      </li>
                    ))}
                    {result.plan.newComponents.map((c) => (
                      <li key={c.definition.name}>
                        <span className="change-kind change-added">Added</span>
                        <span style={{ flex: 1 }}>{c.definition.name}</span>
                        <span className="tag tag-signal">Component</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {files.length ? (
                  <div>
                    <h4>App code, on branch freshed/ai-{result.plan.slug}</h4>
                    <p className="field-hint" style={{ margin: '-4px 0 8px' }}>
                      The CLI writes these files for review:{' '}
                      <code>npx freshed ai "…" --app ./</code>. freshed never runs generated code.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {files.map((f) => (
                        <div className="diff" key={f.path}>
                          <div className="diff-head">
                            <span style={{ flex: 1 }}>{f.path}</span>
                            <span
                              className={`tag ${f.status === 'new file' ? 'tag-live' : 'tag-draft'}`}
                            >
                              {f.status}
                            </span>
                          </div>
                          <pre>
                            {f.lines.map((l, i) => (
                              <span
                                key={i}
                                className={`ln ${l.added && f.status === 'modified' ? 'ln-add' : 'ln-ctx'}`}
                              >
                                {l.line}
                              </span>
                            ))}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {result.plan.notes.length ? (
                  <div>
                    <h4>Notes from the model</h4>
                    <ul className="notes">
                      {result.plan.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              {screen ? (
                <div className="table" style={{ width: 400 }}>
                  <div className="table-head">
                    <span className="col-title">{screen.title}</span>
                  </div>
                  <div className="table-stage" style={{ alignItems: 'start' }}>
                    <div
                      style={{
                        transform: 'scale(0.9)',
                        transformOrigin: 'top center',
                        marginBottom: -70,
                      }}
                    >
                      <PhoneFrame label={`Preview of ${screen.title}`}>
                        <ScreenPreview screen={screen} />
                      </PhoneFrame>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
