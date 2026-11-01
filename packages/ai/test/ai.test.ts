import { brewWorkspace, recordedInvalidPlan, recordedPlan } from '@freshed/example-brew'
import { checkWorkspace } from '@freshed/schema'
import { describe, expect, it, vi } from 'vitest'
import {
  anthropicProvider,
  applyPlan,
  checkImplementation,
  componentFile,
  createAdminClient,
  generatePlan,
  GenerationPlan,
  mockProvider,
  openAICompatibleProvider,
  patchRegistry,
  PLAN_TOOL_NAME,
  planJsonSchema,
  providerFromEnv,
  redact,
  syncPlanToServer,
  type NewComponent,
} from '../src/index.js'

const prompt =
  'Add a referral screen at the end of onboarding with a code to copy and a share button'

describe('schema-constrained generation', () => {
  it('derives the tool schema from zod and forces that tool', async () => {
    const provider = mockProvider([recordedPlan])
    await generatePlan(provider, { prompt, workspace: brewWorkspace() })
    const req = provider.requests[0]!
    expect(req.tool.name).toBe(PLAN_TOOL_NAME)
    expect(req.tool.inputSchema).toEqual(planJsonSchema())
    const schema = req.tool.inputSchema as {
      properties: Record<string, unknown>
      required: string[]
    }
    expect(Object.keys(schema.properties)).toEqual(
      expect.arrayContaining(['summary', 'slug', 'newComponents', 'screens', 'flowEdges', 'notes']),
    )
    expect(req.system).toMatch(/Registered components:/)
    expect(req.system).toMatch(/- Hero: /)
    expect(req.system).toMatch(/onboarding \(start: welcome\)/)
  })

  it('returns a validated plan and drafts with the plan applied', async () => {
    const result = await generatePlan(mockProvider([recordedPlan]), {
      prompt,
      workspace: brewWorkspace(),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.attempts).toBe(1)
    expect(result.plan.newComponents.map((c) => c.definition.name)).toEqual(['ReferralCode'])
    const flow = result.drafts.flows.find((f) => f.slug === 'onboarding')!
    expect(flow.screens).toContain('referral')
    expect(flow.edges).toContainEqual({ from: 'ready', event: 'finish', to: 'referral' })
    expect(flow.edges).toContainEqual({ from: 'referral', event: 'done', to: '@end' })
    // The edge that used to end the flow was replaced, not duplicated.
    expect(flow.edges.filter((e) => e.from === 'ready' && e.event === 'finish')).toHaveLength(1)
    expect(checkWorkspace(result.drafts).ok).toBe(true)
  })

  it('repairs invalid output once, sending the issues back to the model', async () => {
    const provider = mockProvider([recordedInvalidPlan, recordedPlan])
    const result = await generatePlan(provider, { prompt, workspace: brewWorkspace() })
    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(2)
    const repair = provider.requests[1]!.messages.at(-1)!
    expect(repair.role).toBe('user')
    expect(repair.content).toMatch(/That plan is invalid/)
    expect(repair.content).toMatch(/"variant" must be one of/)
    expect(repair.content).toMatch(/"action" is required/)
  })

  it('fails with issues (never a guess) when the repair is still invalid', async () => {
    const provider = mockProvider([recordedInvalidPlan, { summary: 'nope' }])
    const result = await generatePlan(provider, { prompt, workspace: brewWorkspace() })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.attempts).toBe(2)
    expect(result.issues.length).toBeGreaterThan(0)
    expect(provider.requests).toHaveLength(2)
  })

  it('rejects plans that redefine an existing component or target unknown flows', async () => {
    const bad = {
      ...recordedPlan,
      newComponents: [
        { ...recordedPlan.newComponents[0]!, definition: { name: 'Hero', props: {} } },
      ],
      flowEdges: [{ flow: 'checkout', from: 'ready', event: 'x', to: 'referral' }],
    }
    const result = await generatePlan(mockProvider([bad, bad]), {
      prompt,
      workspace: brewWorkspace(),
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    const messages = result.issues.map((i) => i.message).join('\n')
    expect(messages).toMatch(/"Hero" is already registered/)
    expect(messages).toMatch(/Flow "checkout" does not exist/)
  })

  it('accepts JSON-string tool arguments (OpenAI-style)', async () => {
    const result = await generatePlan(mockProvider([JSON.stringify(recordedPlan)]), {
      prompt,
      workspace: brewWorkspace(),
    })
    expect(result.ok).toBe(true)
  })

  it('applyPlan is pure', () => {
    const ws = brewWorkspace()
    const before = JSON.stringify(ws)
    applyPlan(ws, GenerationPlan.parse(recordedPlan))
    expect(JSON.stringify(ws)).toBe(before)
  })
})

describe('provider adapters (no network)', () => {
  const okResponse = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

  it('Anthropic: forced tool_choice, browser header only when asked, tool input returned', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      okResponse({
        model: 'claude-test',
        content: [{ type: 'tool_use', name: PLAN_TOOL_NAME, input: recordedPlan }],
      }),
    )
    const provider = anthropicProvider({
      apiKey: 'sk-ant-test-123456789',
      browser: true,
      fetch: fetchMock as typeof fetch,
    })
    const out = await provider.generate({
      system: 's',
      messages: [{ role: 'user', content: 'p' }],
      tool: { name: PLAN_TOOL_NAME, description: 'd', inputSchema: planJsonSchema() },
    })
    expect(out.output).toEqual(recordedPlan)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('https://api.anthropic.com/v1/messages')
    const headers = init!.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant-test-123456789')
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    const body = JSON.parse(String(init!.body)) as {
      tool_choice: unknown
      tools: { name: string }[]
    }
    expect(body.tool_choice).toEqual({ type: 'tool', name: PLAN_TOOL_NAME })
    expect(body.tools[0]!.name).toBe(PLAN_TOOL_NAME)

    const server = anthropicProvider({ apiKey: 'k', fetch: fetchMock as typeof fetch })
    await server.generate({
      system: 's',
      messages: [],
      tool: { name: PLAN_TOOL_NAME, description: '', inputSchema: {} },
    })
    expect(
      (fetchMock.mock.calls[1]![1]!.headers as Record<string, string>)[
        'anthropic-dangerous-direct-browser-access'
      ],
    ).toBeUndefined()
  })

  it('OpenAI-compatible: function tool_choice and parsed arguments', async () => {
    const fetchMock = vi.fn(async () =>
      okResponse({
        choices: [
          {
            message: {
              tool_calls: [
                { function: { name: PLAN_TOOL_NAME, arguments: JSON.stringify(recordedPlan) } },
              ],
            },
          },
        ],
      }),
    )
    const provider = openAICompatibleProvider({
      apiKey: 'k',
      model: 'm',
      baseUrl: 'https://llm.example/v1',
      fetch: fetchMock as typeof fetch,
    })
    const out = await provider.generate({
      system: 's',
      messages: [],
      tool: { name: PLAN_TOOL_NAME, description: '', inputSchema: {} },
    })
    expect(out.output).toEqual(recordedPlan)
  })

  it('redacts keys from provider error messages', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('{"error":"invalid x-api-key: sk-ant-abcdefghijklmnop"}', { status: 401 }),
    )
    const provider = anthropicProvider({
      apiKey: 'sk-ant-abcdefghijklmnop',
      fetch: fetchMock as typeof fetch,
    })
    await expect(
      provider.generate({
        system: '',
        messages: [],
        tool: { name: 't', description: '', inputSchema: {} },
      }),
    ).rejects.toThrow(/401/)
    await provider
      .generate({ system: '', messages: [], tool: { name: 't', description: '', inputSchema: {} } })
      .catch((e: Error) => expect(e.message).not.toContain('abcdefghijklmnop'))
    expect(redact('key sk-ant-abcdefghijklmnop')).toBe('key sk-…redacted')
  })

  it('providerFromEnv: null without a key, anthropic by default', () => {
    expect(providerFromEnv({})).toBeNull()
    const p = providerFromEnv({ FRESHED_AI_KEY: 'k' })!
    expect(p.id).toBe('anthropic')
    expect(() =>
      providerFromEnv({ FRESHED_AI_KEY: 'k', FRESHED_AI_PROVIDER: 'openai-compatible' }),
    ).toThrow(/model/)
  })
})

describe('code generation', () => {
  const referral = GenerationPlan.parse(recordedPlan).newComponents[0]!

  it('scaffolds a typed defineComponent file from the props spec', () => {
    const file = componentFile(referral, { componentsDir: 'src/freshed/components' })
    expect(file.path).toBe('src/freshed/components/ReferralCode.tsx')
    expect(file.contents).toMatch(/export const ReferralCode = defineComponent\(/)
    expect(file.contents).toMatch(/code: prop\.string\(\{"required":true,"maxLength":16\}\)/)
    expect(file.contents).toMatch(/copy: prop\.action\(/)
    expect(file.contents).toMatch(/accessibilityRole="button"/)
    expect(file.contents).toMatch(/not executed by freshed/)
  })

  it('uses a suggested body only when it passes the static guard', () => {
    const good: NewComponent = { ...referral, implementation: '<View><Text>{code}</Text></View>' }
    expect(componentFile(good, { componentsDir: 'c' }).contents).toMatch(
      /checked by the static guard/,
    )
    for (const bad of [
      'import fs from "fs"',
      '<View>{eval("1")}</View>',
      '<WebView source={{ uri: code }} />',
      '<View>{fetch(code)}</View>',
      '<View>{`${code}`}</View>',
    ]) {
      expect(checkImplementation(bad).ok, bad).toBe(false)
      expect(
        componentFile({ ...referral, implementation: bad }, { componentsDir: 'c' }).contents,
      ).toMatch(/scaffolded/)
    }
  })

  it('patches the registry between markers, idempotently', () => {
    const source = `import { Hero } from './components/Hero'\n// freshed:imports\n\nexport const components = [\n  Hero,\n  // freshed:components\n]\n`
    const once = patchRegistry(source, ['ReferralCode'], (n) => `./components/${n}`)
    expect(once).toContain(
      `import { ReferralCode } from './components/ReferralCode'\n// freshed:imports`,
    )
    expect(once).toContain(`  ReferralCode,\n  // freshed:components`)
    expect(patchRegistry(once, ['ReferralCode'], (n) => `./components/${n}`)).toBe(once)
    expect(() => patchRegistry('export const components = []', ['X'], () => '')).toThrow(/markers/)
  })
})

describe('component sync to the CMS', () => {
  it('pushes component definitions first, then draft screens and flows; never publishes', async () => {
    const calls: string[] = []
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(`${init?.method} ${String(url).replace('https://cms.example', '')}`)
      return new Response('{}', { status: 200 })
    })
    const client = createAdminClient({
      baseUrl: 'https://cms.example',
      adminKey: 'fr_admin_x',
      fetch: fetchMock as typeof fetch,
    })
    const plan = GenerationPlan.parse(recordedPlan)
    const synced = await syncPlanToServer(client, plan, applyPlan(brewWorkspace(), plan))
    expect(calls).toEqual([
      'PUT /api/components/ReferralCode',
      'PUT /api/screens/referral',
      'PUT /api/flows/onboarding',
    ])
    expect(calls.some((c) => c.includes('publish'))).toBe(false)
    expect(synced).toEqual({
      components: ['ReferralCode'],
      screens: ['referral'],
      flows: ['onboarding'],
    })
    const auth = (fetchMock.mock.calls[0]![1]!.headers as Record<string, string>).authorization
    expect(auth).toBe('Bearer fr_admin_x')
  })
})
