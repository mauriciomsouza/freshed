import { welcome } from '@freshed/example-brew'
import { describe, expect, it } from 'vitest'
import { demoBackend } from '../src/data/demo'
import { parseHash, toHash } from '../src/router'

describe('demo backend', () => {
  it('seeds three versions with drafts equal to live', async () => {
    const b = demoBackend({ persist: false })
    expect((await b.versions()).map((v) => v.number)).toEqual([3, 2, 1])
    expect((await b.status()).diff.total).toBe(0)
  })

  it('publishes drafts as a new version and is a no-op when nothing changed', async () => {
    const b = demoBackend({ persist: false })
    await b.saveScreen({ ...welcome, title: 'Hi' })
    expect((await b.status()).diff.screens.changed).toEqual(['welcome'])
    const r = await b.publish('Retitle')
    expect(r.ok && r.version.number).toBe(4)
    const again = await b.publish('Same')
    expect(again.ok && again.created).toBe(false)
  })

  it('blocks publishing invalid drafts', async () => {
    const b = demoBackend({ persist: false })
    await b.saveScreen({ slug: 'bad', title: 'Bad', root: { type: 'Carousel' } })
    const r = await b.publish('nope')
    expect(r.ok).toBe(false)
  })

  it('rolls back by appending a copy and resetting drafts', async () => {
    const b = demoBackend({ persist: false })
    const v = await b.rollback(1)
    expect(v).toMatchObject({ number: 4, rolledBackFrom: 1 })
    const ws = await b.workspace()
    expect(ws.screens.map((s) => s.slug).sort()).toEqual(['ready', 'taste', 'welcome'])
    expect((await b.versions()).length).toBe(4)
  })

  it('works without browser storage', async () => {
    const b = demoBackend()
    await b.saveScreen({ ...welcome, title: 'No storage' })
    expect((await b.workspace()).screens.find((s) => s.slug === 'welcome')?.title).toBe(
      'No storage',
    )
  })
})

describe('hash router', () => {
  it('round-trips deep links', () => {
    for (const r of [
      { page: 'screens', slug: 'welcome' },
      { page: 'flows', slug: 'onboarding' },
      { page: 'components', name: 'Card' },
      { page: 'playground' },
      { page: 'publish' },
      { page: 'ai' },
    ] as const) {
      expect(parseHash(toHash(r))).toEqual(r)
    }
    expect(parseHash('')).toEqual({ page: 'screens', slug: undefined })
    expect(parseHash('#/nonsense')).toEqual({ page: 'screens', slug: undefined })
  })
})
