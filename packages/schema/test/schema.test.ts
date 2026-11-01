import { describe, expect, it } from 'vitest'
import {
  Action,
  checkWorkspace,
  componentsUsed,
  contentHash,
  diffSnapshots,
  Flow,
  isCompatible,
  isSafeUrl,
  MAX_DEPTH,
  parseProtocolHeader,
  parseScreen,
  prop,
  PROTOCOL_VERSION,
  snapshotHash,
  stableStringify,
  unreachableScreens,
  validateFlow,
  validateScreen,
  type ComponentDefinition,
  type InferProps,
  type Screen,
  type ScreenNode,
} from '../src/index.js'

const registry: ComponentDefinition[] = [
  { name: 'Stack', children: true, props: { gap: prop.enum(['sm', 'md'], { default: 'md' }) } },
  {
    name: 'Text',
    props: {
      text: prop.string({ required: true, maxLength: 20 }),
      variant: prop.enum(['body', 'title']),
    },
  },
  {
    name: 'Button',
    props: { label: prop.string({ required: true }), action: prop.action({ required: true }) },
  },
  {
    name: 'Image',
    props: { src: prop.image({ required: true }), alt: prop.string({ required: true }) },
  },
]

const screen = (root: ScreenNode, slug = 'home'): Screen => ({ slug, title: 'Home', root })

describe('Screen schema', () => {
  it('accepts a valid tree', () => {
    const r = parseScreen(
      screen({ type: 'Stack', children: [{ type: 'Text', props: { text: 'Hello' } }] }),
    )
    expect(r.ok).toBe(true)
  })

  it('rejects bad slugs and non-PascalCase component names', () => {
    const r = parseScreen({ slug: 'Home Screen', title: 'x', root: { type: 'text' } })
    expect(r.ok).toBe(false)
    expect(r.issues.map((i) => i.path)).toEqual(expect.arrayContaining(['slug', 'root.type']))
  })

  it('rejects trees deeper than MAX_DEPTH', () => {
    let node: ScreenNode = { type: 'Text', props: { text: 'leaf' } }
    for (let i = 0; i < MAX_DEPTH; i++) node = { type: 'Stack', children: [node] }
    const r = parseScreen(screen(node))
    expect(r.ok).toBe(false)
    expect(r.issues[0]?.message).toMatch(/deeper/)
  })

  it('lists components used in tree order', () => {
    const s = screen({
      type: 'Stack',
      children: [
        { type: 'Text', props: { text: 'a' } },
        { type: 'Stack', children: [{ type: 'Text' }] },
      ],
    })
    expect(componentsUsed(s)).toEqual(['Stack', 'Text'])
  })
})

describe('validateScreen against a registry', () => {
  it('passes a correct screen', () => {
    const r = validateScreen(
      screen({
        type: 'Stack',
        children: [
          { type: 'Text', props: { text: 'Hi', variant: 'title' } },
          { type: 'Button', props: { label: 'Go', action: { type: 'navigate', to: 'next' } } },
        ],
      }),
      registry,
    )
    expect(r.ok).toBe(true)
  })

  it('flags unknown components, wrong types, missing required props and illegal children', () => {
    const r = validateScreen(
      screen({
        type: 'Stack',
        children: [
          { type: 'Carousel' },
          { type: 'Text', props: { text: 42 as unknown as string, variant: 'huge' } },
          { type: 'Button', props: { label: 'Go' } },
          {
            type: 'Text',
            props: { text: 'x' },
            children: [{ type: 'Text', props: { text: 'y' } }],
          },
        ],
      }),
      registry,
    )
    expect(r.ok).toBe(false)
    const messages = r.issues.map((i) => i.message).join('\n')
    expect(messages).toMatch(/Unknown component "Carousel"/)
    expect(messages).toMatch(/"text" must be a string/)
    expect(messages).toMatch(/"variant" must be one of/)
    expect(messages).toMatch(/"action" is required/)
    expect(messages).toMatch(/does not accept children/)
  })

  it('treats unknown props as warnings, not errors', () => {
    const r = validateScreen(
      screen({ type: 'Text', props: { text: 'Hi', colour: 'red' } }),
      registry,
    )
    expect(r.ok).toBe(true)
    expect(r.issues).toEqual([
      expect.objectContaining({ severity: 'warning', message: 'Unknown prop "colour"' }),
    ])
  })

  it('enforces maxLength and image URL safety', () => {
    const r = validateScreen(
      screen({
        type: 'Stack',
        children: [
          { type: 'Text', props: { text: 'x'.repeat(21) } },
          { type: 'Image', props: { src: 'javascript:alert(1)', alt: 'x' } },
        ],
      }),
      registry,
    )
    expect(r.ok).toBe(false)
    expect(r.issues.map((i) => i.message)).toEqual(
      expect.arrayContaining([
        '"text" must be at most 20 characters',
        '"src" must be an https URL or an asset: reference',
      ]),
    )
  })
})

describe('Actions', () => {
  it.each([
    ['https://brew.example/plan', true],
    ['mailto:hi@brew.example', true],
    ['tel:+15550100', true],
    ['brew://plan/add', true],
    ['http://insecure.example', false],
    ['javascript:alert(1)', false],
    ['JavaScript:alert(1)', false],
    ['data:text/html,hi', false],
    ['file:///etc/passwd', false],
    ['not a url', false],
  ])('isSafeUrl(%s) = %s', (url, ok) => {
    expect(isSafeUrl(url)).toBe(ok)
  })

  it('rejects unknown action types', () => {
    expect(Action.safeParse({ type: 'eval', code: '1+1' }).success).toBe(false)
    expect(Action.safeParse({ type: 'openUrl', url: 'javascript:void(0)' }).success).toBe(false)
    expect(Action.safeParse({ type: 'emit', event: 'next' }).success).toBe(true)
  })
})

describe('Flow', () => {
  const base = {
    slug: 'onboarding',
    title: 'Onboarding',
    start: 'a',
    screens: ['a', 'b', 'c'],
    edges: [
      { from: 'a', event: 'next', to: 'b' },
      { from: 'b', event: 'next', to: '@end' },
    ],
  }

  it('accepts a valid flow and reports unreachable screens', () => {
    expect(Flow.safeParse(base).success).toBe(true)
    expect(unreachableScreens(base)).toEqual(['c'])
  })

  it('rejects edges to screens outside the flow, a missing start and duplicate edges', () => {
    const r = Flow.safeParse({
      ...base,
      start: 'z',
      edges: [...base.edges, { from: 'a', event: 'next', to: 'x' }],
    })
    expect(r.success).toBe(false)
    const messages = r.error!.issues.map((i) => i.message)
    expect(messages).toEqual(
      expect.arrayContaining([
        'Start screen "z" is not in the flow',
        '"x" is not in the flow',
        'Duplicate edge for event "next" on "a"',
      ]),
    )
  })

  it('warns when a screen emits an event the flow does not handle', () => {
    const screens = [
      screen(
        { type: 'Button', props: { label: 'x', action: { type: 'emit', event: 'next' } } },
        'a',
      ),
      screen(
        { type: 'Button', props: { label: 'x', action: { type: 'emit', event: 'skip' } } },
        'b',
      ),
      screen({ type: 'Text', props: { text: 'c' } }, 'c'),
    ]
    const r = validateFlow(base, screens)
    expect(r.ok).toBe(true)
    expect(r.issues).toEqual([
      expect.objectContaining({
        severity: 'warning',
        message: expect.stringMatching(/emits "skip"/),
      }),
    ])
  })
})

describe('Protocol versioning', () => {
  it('accepts payloads at or below the client protocol only', () => {
    expect(isCompatible(1, 1)).toBe(true)
    expect(isCompatible(2, 1)).toBe(false)
    expect(isCompatible(1, 3)).toBe(true)
    expect(isCompatible(0, 1)).toBe(false)
  })

  it('treats a missing or malformed header as protocol 1', () => {
    expect(parseProtocolHeader(undefined)).toBe(1)
    expect(parseProtocolHeader('banana')).toBe(1)
    expect(parseProtocolHeader('3')).toBe(3)
    expect(PROTOCOL_VERSION).toBeGreaterThanOrEqual(1)
  })
})

describe('Hashing and diffs', () => {
  it('hashes equal content equally regardless of key order', () => {
    expect(stableStringify({ b: 1, a: [{ d: 1, c: 2 }] })).toBe('{"a":[{"c":2,"d":1}],"b":1}')
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }))
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }))
  })

  it('snapshot hash ignores array order of top-level entities', () => {
    const s1 = screen({ type: 'Text', props: { text: 'a' } }, 'a')
    const s2 = screen({ type: 'Text', props: { text: 'b' } }, 'b')
    expect(snapshotHash({ components: registry, screens: [s1, s2], flows: [] })).toBe(
      snapshotHash({ components: [...registry].reverse(), screens: [s2, s1], flows: [] }),
    )
  })

  it('diffs added, changed and removed entities', () => {
    const a = screen({ type: 'Text', props: { text: 'a' } }, 'a')
    const b = screen({ type: 'Text', props: { text: 'b' } }, 'b')
    const d = diffSnapshots(
      { components: registry, screens: [a, b], flows: [] },
      {
        components: registry,
        screens: [{ ...a, title: 'Changed' }, screen({ type: 'Text', props: { text: 'c' } }, 'c')],
        flows: [],
      },
    )
    expect(d.screens).toEqual({ added: ['c'], changed: ['a'], removed: ['b'] })
    expect(d.total).toBe(3)
  })

  it('checkWorkspace scopes issues per screen and flow', () => {
    const r = checkWorkspace({
      components: registry,
      screens: [screen({ type: 'Nope' }, 'x')],
      flows: [],
    })
    expect(r.ok).toBe(false)
    expect(r.issues[0]).toMatchObject({ scope: 'screen:x', severity: 'error' })
  })
})

describe('prop builder type inference', () => {
  it('infers required, optional and defaulted props', () => {
    const _props = {
      title: prop.string({ required: true }),
      tone: prop.enum(['a', 'b'], { default: 'a' }),
      subtitle: prop.string(),
      onPress: prop.action(),
    }
    type P = InferProps<typeof _props>
    const ok: P = { title: 'x', tone: 'b' }
    // @ts-expect-error title is required
    const missing: P = { tone: 'a' }
    // @ts-expect-error tone only accepts declared values
    const wrong: P = { title: 'x', tone: 'c' }
    expect([ok, missing, wrong]).toHaveLength(3)
  })
})
