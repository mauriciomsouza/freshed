import { checkWorkspace, unreachableScreens, validateScreen } from '@freshed-cms/schema'
import { describe, expect, it } from 'vitest'
import { brewComponents, brewWorkspace, onboarding, seedHistory } from '../src/index.js'

describe('Brew seed content', () => {
  it('is a valid workspace with no errors or warnings', () => {
    const r = checkWorkspace(brewWorkspace())
    expect(r.issues).toEqual([])
    expect(r.ok).toBe(true)
  })

  it('every screen in the onboarding flow is reachable', () => {
    expect(unreachableScreens(onboarding)).toEqual([])
  })

  it('every historical version is valid too', () => {
    for (const step of seedHistory) {
      const r = checkWorkspace({
        components: brewComponents,
        screens: step.screens,
        flows: step.flows,
      })
      expect(
        r.issues.filter((i) => i.severity === 'error'),
        step.message,
      ).toEqual([])
    }
  })

  it('every Image has alt text (accessibility rule)', () => {
    for (const screen of brewWorkspace().screens) {
      expect(validateScreen(screen, brewComponents).ok).toBe(true)
    }
  })
})
