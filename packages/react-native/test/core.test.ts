import { onboarding, brewWorkspace } from '@freshed/example-brew'
import { prop, type Action, type ScreenNode } from '@freshed/schema'
import { describe, expect, it, vi } from 'vitest'
import {
  createClient,
  createDispatcher,
  createFlowController,
  createFlowState,
  createRegistry,
  createStaticClient,
  describeAction,
  flatten,
  memoryStorage,
  RegistryError,
  resolveTree,
  transition,
  type ResolvedComponent,
} from '../src/core/index.js'

const render = (name: string) => `<${name}/>`

const registry = createRegistry([
  {
    name: 'Stack',
    children: true,
    props: { gap: prop.enum(['sm', 'md'], { default: 'md' }) },
    render: render('Stack'),
  },
  {
    name: 'Text',
    props: {
      text: prop.string({ required: true }),
      tone: prop.enum(['default', 'muted'], { default: 'default' }),
    },
    render: render('Text'),
  },
  {
    name: 'Button',
    props: { label: prop.string({ required: true }), action: prop.action({ required: true }) },
    render: render('Button'),
  },
])

const bindAction = (action: Action) => Object.assign(() => {}, { action })

describe('registry', () => {
  it('rejects invalid or duplicate components', () => {
    expect(() => createRegistry([{ name: 'lowercase', props: {}, render: 1 }])).toThrow(
      RegistryError,
    )
    expect(() =>
      createRegistry([
        { name: 'A', props: {}, render: 1 },
        { name: 'A', props: {}, render: 2 },
      ]),
    ).toThrow(/registered twice/)
  })

  it('exposes plain-data definitions without render functions', () => {
    const defs = registry.definitions()
    expect(defs.map((d) => d.name)).toEqual(['Stack', 'Text', 'Button'])
    expect(defs.every((d) => !('render' in d))).toBe(true)
  })
})

describe('resolveTree', () => {
  it('resolves a tree, applies defaults and binds actions', () => {
    const tree = resolveTree(
      {
        type: 'Stack',
        children: [
          { id: 'title', type: 'Text', props: { text: 'Hello' } },
          {
            id: 'cta',
            type: 'Button',
            props: { label: 'Go', action: { type: 'emit', event: 'next' } },
          },
        ],
      },
      registry,
      { bindAction },
    ) as ResolvedComponent<string>
    expect(tree.kind).toBe('component')
    expect(tree.props).toEqual({ gap: 'md' })
    expect(tree.children.map((c) => c.key)).toEqual(['root.title', 'root.cta'])
    const [text, button] = tree.children as ResolvedComponent<string>[]
    expect(text!.props).toEqual({ text: 'Hello', tone: 'default' })
    expect(typeof button!.props.action).toBe('function')
    expect((button!.props.action as unknown as { action: Action }).action).toEqual({
      type: 'emit',
      event: 'next',
    })
  })

  it('renders a fallback for unknown components instead of crashing', () => {
    const warnings: string[] = []
    const tree = resolveTree(
      {
        type: 'Stack',
        children: [
          { type: 'Carousel', props: { items: ['a'] } },
          { type: 'Text', props: { text: 'still here' } },
        ],
      },
      registry,
      { bindAction, onWarning: (w) => warnings.push(w.message) },
    )
    const nodes = flatten(tree)
    expect(nodes.map((n) => `${n.kind}:${n.type}`)).toEqual([
      'component:Stack',
      'fallback:Carousel',
      'component:Text',
    ])
    expect(nodes[1]).toMatchObject({ reason: 'unknown-component', props: { items: ['a'] } })
    expect(warnings).toEqual(['Unknown component "Carousel"; rendering fallback'])
  })

  it('drops invalid prop values, falling back to the default', () => {
    const warnings: string[] = []
    const tree = resolveTree({ type: 'Text', props: { text: 'Hi', tone: 'neon' } }, registry, {
      bindAction,
      onWarning: (w) => warnings.push(w.message),
    }) as ResolvedComponent<string>
    expect(tree.props.tone).toBe('default')
    expect(warnings[0]).toMatch(/Prop "tone" must be one of/)
  })

  it('never binds an invalid action', () => {
    const bind = vi.fn(bindAction)
    const tree = resolveTree(
      {
        type: 'Button',
        props: { label: 'x', action: { type: 'openUrl', url: 'javascript:alert(1)' } as Action },
      },
      registry,
      { bindAction: bind },
    ) as ResolvedComponent<string>
    expect(bind).not.toHaveBeenCalled()
    expect(tree.props.action).toBeUndefined()
  })

  it('ignores children on leaf components and stops at max depth', () => {
    const warnings: string[] = []
    const leaf = resolveTree(
      { type: 'Text', props: { text: 'x' }, children: [{ type: 'Text', props: { text: 'y' } }] },
      registry,
      { bindAction, onWarning: (w) => warnings.push(w.message) },
    ) as ResolvedComponent<string>
    expect(leaf.children).toEqual([])
    expect(warnings[0]).toMatch(/does not accept children/)

    let deep: ScreenNode = { type: 'Text', props: { text: 'leaf' } }
    for (let i = 0; i < 20; i++) deep = { type: 'Stack', children: [deep] }
    const nodes = flatten(resolveTree(deep, registry, { bindAction }))
    expect(nodes.at(-1)).toMatchObject({ kind: 'fallback', reason: 'max-depth' })
  })
})

describe('actions', () => {
  it('tries layers in order and reports unhandled actions without throwing', async () => {
    const flow = { emit: vi.fn() }
    const app = { emit: vi.fn(), openUrl: vi.fn() }
    const events: string[] = []
    const dispatch = createDispatcher([flow, app], {
      onAction: (e) => events.push(`${e.action.type}:${e.handled}`),
    })
    expect(await dispatch({ type: 'emit', event: 'next' }, { screen: 'a' })).toBe(true)
    expect(flow.emit).toHaveBeenCalledOnce()
    expect(app.emit).not.toHaveBeenCalled()
    expect(await dispatch({ type: 'openUrl', url: 'https://x.example' }, { screen: 'a' })).toBe(
      true,
    )
    expect(await dispatch({ type: 'share', message: 'hi' }, { screen: 'a' })).toBe(false)
    expect(events).toEqual(['emit:true', 'openUrl:true', 'share:false'])
  })

  it('isolates handler errors', async () => {
    const onError = vi.fn()
    const dispatch = createDispatcher(
      [
        {
          back: () => {
            throw new Error('boom')
          },
        },
      ],
      { onError },
    )
    expect(await dispatch({ type: 'back' }, { screen: 'a' })).toBe(true)
    expect(onError).toHaveBeenCalledOnce()
  })

  it('describes actions for the event log', () => {
    expect(describeAction({ type: 'navigate', to: 'b' })).toBe('navigate → b')
    expect(describeAction({ type: 'submit', name: 'prefs', event: 'next' })).toBe(
      'submit prefs then "next"',
    )
  })
})

describe('flows', () => {
  it('walks the Brew onboarding by events, supports back, and ends', () => {
    let s = createFlowState(onboarding)
    expect(s.current).toBe('welcome')
    const step = (input: Parameters<typeof transition>[2]) => {
      const r = transition(onboarding, s, input)
      s = r.state
      return r.result
    }
    expect(step({ type: 'emit', event: 'next' })).toMatchObject({ type: 'moved', to: 'taste' })
    expect(step({ type: 'emit', event: 'next' })).toMatchObject({ type: 'moved', to: 'cadence' })
    expect(step({ type: 'back' })).toMatchObject({ type: 'moved', to: 'taste' })
    expect(step({ type: 'emit', event: 'next' })).toMatchObject({ to: 'cadence' })
    expect(step({ type: 'emit', event: 'next' })).toMatchObject({ to: 'ready' })
    expect(s.history).toEqual(['welcome', 'taste', 'cadence'])
    expect(step({ type: 'emit', event: 'nope' })).toMatchObject({ type: 'ignored' })
    expect(step({ type: 'emit', event: 'finish' })).toEqual({
      type: 'ended',
      from: 'ready',
      event: 'finish',
    })
    expect(s.ended).toBe(true)
    expect(step({ type: 'emit', event: 'next' })).toMatchObject({
      type: 'ignored',
      reason: 'Flow has ended',
    })
  })

  it('back at the first screen is ignored so the app can handle it', () => {
    const r = transition(onboarding, createFlowState(onboarding), { type: 'back' })
    expect(r.result).toMatchObject({ type: 'ignored' })
  })

  it('controller exposes action handlers that drive the flow', async () => {
    const ws = brewWorkspace()
    const listener = vi.fn()
    const ctrl = createFlowController(onboarding, ws.screens, listener)
    const dispatch = createDispatcher([ctrl.handlers])
    await dispatch({ type: 'emit', event: 'next' }, { screen: 'welcome' })
    expect(ctrl.state.current).toBe('taste')
    expect(ctrl.screen()?.title).toBe('Your taste')
    await dispatch({ type: 'navigate', to: 'promo-holiday' }, { screen: 'taste' })
    expect(ctrl.state.current).toBe('taste')
    ctrl.reset()
    expect(ctrl.state).toEqual({ current: 'welcome', history: [], ended: false })
    expect(listener).toHaveBeenCalledTimes(3)
  })
})

describe('client caching', () => {
  const payload = { protocol: 1, version: 3, screen: brewWorkspace().screens[0] }

  function fakeServer() {
    const etag = 'W/"abc"'
    let down = false
    let body: unknown = payload
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (down) throw new TypeError('Network request failed')
      const headers = init?.headers as Record<string, string>
      if (headers['If-None-Match'] === etag) return new Response(null, { status: 304 })
      return new Response(JSON.stringify(body), { status: 200, headers: { ETag: etag } })
    })
    return {
      fetchMock,
      setDown: (v: boolean) => (down = v),
      setBody: (b: unknown) => (body = b),
    }
  }

  it('sends the protocol header and auth, uses ETag for 304s', async () => {
    const server = fakeServer()
    const client = createClient({
      baseUrl: 'https://cms.example/',
      apiKey: 'fr_pub_x',
      fetch: server.fetchMock as typeof fetch,
    })
    const first = await client.screen('welcome')
    expect(first.source).toBe('network')
    const [url, init] = server.fetchMock.mock.calls[0]!
    expect(String(url)).toBe('https://cms.example/v1/screens/welcome')
    expect(init!.headers).toMatchObject({
      Authorization: 'Bearer fr_pub_x',
      'Freshed-Protocol': '1',
    })

    const second = await client.screen('welcome')
    expect(second.source).toBe('not-modified')
    expect(second.data.screen.slug).toBe('welcome')
  })

  it('serves the last good copy when the network fails', async () => {
    const server = fakeServer()
    const storage = memoryStorage()
    const client = createClient({
      baseUrl: 'https://cms.example',
      apiKey: 'k',
      storage,
      fetch: server.fetchMock as typeof fetch,
    })
    await client.screen('welcome')
    server.setDown(true)
    const offline = await client.screen('welcome')
    expect(offline.source).toBe('cache')
    expect(offline.error).toBeInstanceOf(TypeError)
    expect(await client.cached('screens', 'welcome')).toMatchObject({ version: 3 })
  })

  it('keeps the last good copy when the payload is newer than this build or invalid', async () => {
    const server = fakeServer()
    const client = createClient({
      baseUrl: 'https://cms.example',
      apiKey: 'k',
      fetch: server.fetchMock as typeof fetch,
    })
    await client.screen('welcome')
    // Force a full response by changing the ETag-matching path: new client storage keeps the copy.
    server.fetchMock.mockImplementationOnce(
      async () =>
        new Response(JSON.stringify({ ...payload, protocol: 99 }), {
          status: 200,
          headers: { ETag: 'W/"new"' },
        }),
    )
    const future = await client.screen('welcome')
    expect(future.source).toBe('cache')
    expect((future.error as Error).name).toBe('UnsupportedProtocolError')

    server.fetchMock.mockImplementationOnce(
      async () => new Response('{"nope":true}', { status: 200 }),
    )
    expect((await client.screen('welcome')).source).toBe('cache')
  })

  it('throws when there is nothing cached, and does not resurrect unpublished content (404)', async () => {
    const server = fakeServer()
    server.setDown(true)
    const client = createClient({
      baseUrl: 'https://cms.example',
      apiKey: 'k',
      fetch: server.fetchMock as typeof fetch,
    })
    await expect(client.screen('welcome')).rejects.toThrow(/Network/)

    server.setDown(false)
    await client.screen('welcome')
    server.fetchMock.mockImplementationOnce(async () => new Response('{}', { status: 404 }))
    await expect(client.screen('welcome')).rejects.toThrow(/404/)
  })

  it('a broken storage never breaks rendering', async () => {
    const server = fakeServer()
    const client = createClient({
      baseUrl: 'https://cms.example',
      apiKey: 'k',
      fetch: server.fetchMock as typeof fetch,
      storage: {
        getItem: async () => {
          throw new Error('disk')
        },
        setItem: async () => {
          throw new Error('full')
        },
      },
    })
    expect((await client.screen('welcome')).source).toBe('network')
  })

  it('static client serves fixtures for previews', async () => {
    const ws = brewWorkspace()
    const client = createStaticClient({ screens: () => ws.screens, flows: () => ws.flows })
    const flow = await client.flow('onboarding')
    expect(flow.data.screens).toHaveLength(4)
    await expect(client.screen('missing')).rejects.toThrow(/404/)
  })
})
