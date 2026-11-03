import { describe, expect, it } from 'vitest'
import {
  ASPECT_RATIOS,
  DEFAULT_SETTINGS,
  DEVICES,
  aspectFits,
  aspectLabel,
  clampSide,
  fitScale,
  matchAspect,
  parseSettings,
  resolveDevice,
  withAspect,
  withSize,
} from '../src/preview/devices'

describe('device presets', () => {
  it('have unique ids and portrait sizes with sane insets', () => {
    expect(new Set(DEVICES.map((d) => d.id)).size).toBe(DEVICES.length)
    for (const d of DEVICES) {
      expect(d.width).toBeLessThan(d.height)
      for (const o of ['portrait', 'landscape'] as const) {
        const i = d.insets[o]
        const [w, h] = o === 'portrait' ? [d.width, d.height] : [d.height, d.width]
        expect(i.top + i.bottom).toBeLessThan(h / 4)
        expect(i.left + i.right).toBeLessThan(w / 4)
      }
    }
  })

  it('label common phone ratios the way people say them', () => {
    const label = (id: string) => {
      const d = DEVICES.find((x) => x.id === id)!
      return aspectLabel(d.width, d.height)
    }
    expect(label('ios-compact')).toBe('16:9')
    expect(label('ios-standard')).toBe('19.5:9')
    expect(label('android-standard')).toBe('20:9')
    expect(label('android-tablet')).toBe('16:10')
    expect(label('ios-tablet')).toBe('1.44:1')
    expect(matchAspect(852, 393)).toBe('19.5:9')
  })
})

describe('resolving settings', () => {
  it('defaults to a standard phone in portrait with its safe area', () => {
    const d = resolveDevice(DEFAULT_SETTINGS)
    expect([d.width, d.height]).toEqual([393, 852])
    expect(d.insets).toEqual({ top: 59, right: 0, bottom: 34, left: 0 })
    expect(d.custom).toBe(false)
  })

  it('swaps the size and uses landscape insets when rotated', () => {
    const d = resolveDevice({ ...DEFAULT_SETTINGS, orientation: 'landscape' })
    expect([d.width, d.height]).toEqual([852, 393])
    expect(d.insets.left).toBe(59)
    expect(d.insets.top).toBe(0)
  })

  it('changes the ratio by keeping the short side', () => {
    for (const a of ASPECT_RATIOS) {
      const s = withAspect(DEFAULT_SETTINGS, a.id)
      const d = resolveDevice(s)
      expect(d.width).toBe(393)
      expect(d.aspect).toBe(a.id)
      expect(d.custom).toBe(true)
      // Rotating a custom size keeps its ratio.
      expect(resolveDevice({ ...s, orientation: 'landscape' }).aspect).toBe(a.id)
    }
  })

  it('offers only the ratios whose long side fits the size limit', () => {
    const fitting = (short: number) =>
      ASPECT_RATIOS.filter((a) => aspectFits(short, a.id)).map((a) => a.id)
    // 820 pt short side: 16:9 is 1458 pt long, 18:9 would be 1640 pt.
    expect(fitting(820)).toEqual(['4:3', '3:2', '16:10', '16:9'])
    // Exactly the limit is fine: 800 at 18:9 is 1600 pt.
    expect(aspectFits(800, '18:9')).toBe(true)
    expect(aspectFits(800, '19.5:9')).toBe(false)
    expect(fitting(393)).toEqual(ASPECT_RATIOS.map((a) => a.id))
    // A ratio that does not fit leaves the settings alone instead of clamping.
    const tablet = { ...DEFAULT_SETTINGS, device: 'ios-tablet' }
    expect(withAspect(tablet, '21:9')).toBe(tablet)
  })

  it('sets the oriented width or height by hand, clamped', () => {
    const land = { ...DEFAULT_SETTINGS, orientation: 'landscape' as const }
    const d = resolveDevice(withSize(land, 'width', 1000))
    expect([d.width, d.height]).toEqual([1000, 393])
    expect(resolveDevice(withSize(DEFAULT_SETTINGS, 'height', 5))).toMatchObject({
      width: 393,
      height: 240,
    })
    expect(clampSide(99999)).toBe(1600)
    expect(clampSide(Number.NaN)).toBe(240)
  })

  it('keeps a typed size on its axis, rotating when it becomes the long side', () => {
    // Portrait 393×852: a width of 1000 makes the screen wider than tall.
    const wide = withSize(DEFAULT_SETTINGS, 'width', 1000)
    expect(wide.orientation).toBe('landscape')
    expect(resolveDevice(wide)).toMatchObject({ width: 1000, height: 852 })

    // Landscape 852×393: a height of 900 makes it taller than wide.
    const land = { ...DEFAULT_SETTINGS, orientation: 'landscape' as const }
    const tall = withSize(land, 'height', 900)
    expect(tall.orientation).toBe('portrait')
    expect(resolveDevice(tall)).toMatchObject({ width: 852, height: 900 })

    // Within the current orientation nothing rotates.
    const narrow = withSize(DEFAULT_SETTINGS, 'width', 320)
    expect(narrow.orientation).toBe('portrait')
    expect(resolveDevice(narrow)).toMatchObject({ width: 320, height: 852 })
    const short = withSize(land, 'height', 300)
    expect(short.orientation).toBe('landscape')
    expect(resolveDevice(short)).toMatchObject({ width: 852, height: 300 })

    // A square keeps the orientation it had.
    for (const s of [DEFAULT_SETTINGS, land]) {
      const square = withSize(s, s.orientation === 'portrait' ? 'width' : 'height', 852)
      expect(square.orientation).toBe(s.orientation)
      expect(resolveDevice(square)).toMatchObject({ width: 852, height: 852 })
    }

    // Clamping applies before the comparison.
    const huge = withSize(DEFAULT_SETTINGS, 'height', 99999)
    expect(resolveDevice(huge)).toMatchObject({ width: 393, height: 1600 })
  })

  it('parses stored settings defensively', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings({ device: 'nope', zoom: 'huge', custom: { width: 'x' } })).toEqual(
      DEFAULT_SETTINGS,
    )
    expect(
      parseSettings({
        device: 'android-compact',
        orientation: 'landscape',
        safeArea: true,
        zoom: 'actual',
        custom: { width: 10, height: 700 },
      }),
    ).toEqual({
      device: 'android-compact',
      orientation: 'landscape',
      safeArea: true,
      zoom: 'actual',
      custom: { width: 240, height: 700 },
    })
  })
})

describe('fitting the frame', () => {
  it('scales down to fit and never scales up', () => {
    expect(fitScale({ width: 400, height: 800 }, { width: 400, height: 400 })).toBe(0.5)
    expect(fitScale({ width: 400, height: 800 }, { width: 200, height: 2000 })).toBe(0.5)
    expect(fitScale({ width: 100, height: 100 }, { width: 400, height: 400 })).toBe(1)
    expect(fitScale({ width: 100, height: 100 }, { width: 0, height: 0 })).toBe(1)
  })
})
