/**
 * Device presets for the preview: logical resolution, aspect ratio and
 * safe-area insets. Pure data and math so it can be unit tested.
 *
 * Sizes are logical points (dp on Android), the units React Native lays out
 * in. Insets are typical values for each class of device, not exact figures
 * for one model. Names are generic on purpose: the preview is about layout
 * classes, not brands.
 */

export type Orientation = 'portrait' | 'landscape'
export type Insets = { top: number; right: number; bottom: number; left: number }
export type Cutout = 'island' | 'punch' | 'none'

export type DevicePreset = {
  id: string
  name: string
  group: 'iOS' | 'Android'
  form: 'phone' | 'tablet'
  /** Portrait width and height in points. */
  width: number
  height: number
  insets: Record<Orientation, Insets>
  cutout: Cutout
  /** Gesture bar at the bottom of the screen. */
  homeIndicator: boolean
  /** Screen corner radius in points. */
  radius: number
}

const none: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
const ins = (top: number, right: number, bottom: number, left: number): Insets => ({
  top,
  right,
  bottom,
  left,
})

export const DEVICES: readonly DevicePreset[] = [
  {
    id: 'ios-compact',
    name: 'iOS compact',
    group: 'iOS',
    form: 'phone',
    width: 375,
    height: 667,
    insets: { portrait: ins(20, 0, 0, 0), landscape: none },
    cutout: 'none',
    homeIndicator: false,
    radius: 0,
  },
  {
    id: 'ios-standard',
    name: 'iOS standard',
    group: 'iOS',
    form: 'phone',
    width: 393,
    height: 852,
    insets: { portrait: ins(59, 0, 34, 0), landscape: ins(0, 59, 21, 59) },
    cutout: 'island',
    homeIndicator: true,
    radius: 55,
  },
  {
    id: 'ios-large',
    name: 'iOS large',
    group: 'iOS',
    form: 'phone',
    width: 430,
    height: 932,
    insets: { portrait: ins(59, 0, 34, 0), landscape: ins(0, 59, 21, 59) },
    cutout: 'island',
    homeIndicator: true,
    radius: 55,
  },
  {
    id: 'ios-tablet',
    name: 'iOS tablet',
    group: 'iOS',
    form: 'tablet',
    width: 820,
    height: 1180,
    insets: { portrait: ins(24, 0, 20, 0), landscape: ins(24, 0, 20, 0) },
    cutout: 'none',
    homeIndicator: true,
    radius: 18,
  },
  {
    id: 'android-compact',
    name: 'Android compact',
    group: 'Android',
    form: 'phone',
    width: 360,
    height: 800,
    insets: { portrait: ins(24, 0, 24, 0), landscape: ins(24, 0, 24, 32) },
    cutout: 'punch',
    homeIndicator: true,
    radius: 24,
  },
  {
    id: 'android-standard',
    name: 'Android standard',
    group: 'Android',
    form: 'phone',
    width: 412,
    height: 915,
    insets: { portrait: ins(32, 0, 24, 0), landscape: ins(24, 0, 24, 32) },
    cutout: 'punch',
    homeIndicator: true,
    radius: 32,
  },
  {
    id: 'android-tablet',
    name: 'Android tablet',
    group: 'Android',
    form: 'tablet',
    width: 800,
    height: 1280,
    insets: { portrait: ins(24, 0, 24, 0), landscape: ins(24, 0, 24, 0) },
    cutout: 'none',
    homeIndicator: true,
    radius: 16,
  },
]

export const DEFAULT_DEVICE = 'ios-standard'

/** Named aspect ratios, long side first, as people say them ("19.5:9"). */
export const ASPECT_RATIOS = [
  { id: '4:3', long: 4, short: 3 },
  { id: '3:2', long: 3, short: 2 },
  { id: '16:10', long: 16, short: 10 },
  { id: '16:9', long: 16, short: 9 },
  { id: '18:9', long: 18, short: 9 },
  { id: '19.5:9', long: 19.5, short: 9 },
  { id: '20:9', long: 20, short: 9 },
  { id: '21:9', long: 21, short: 9 },
] as const

export type AspectId = (typeof ASPECT_RATIOS)[number]['id']

/** The named ratio within 1% of w×h (in either orientation), if any. */
export function matchAspect(w: number, h: number): AspectId | undefined {
  const r = Math.max(w, h) / Math.min(w, h)
  return ASPECT_RATIOS.find((a) => Math.abs(a.long / a.short - r) / r < 0.01)?.id
}

/** "19.5:9" for a named ratio, otherwise "2.17:1". */
export function aspectLabel(w: number, h: number): string {
  return matchAspect(w, h) ?? `${(Math.max(w, h) / Math.min(w, h)).toFixed(2)}:1`
}

export const MIN_SIDE = 240
export const MAX_SIDE = 1600
export const clampSide = (n: number) =>
  Math.round(Math.min(MAX_SIDE, Math.max(MIN_SIDE, Number.isFinite(n) ? n : MIN_SIDE)))

export type DeviceSettings = {
  /** Preset id. A custom size keeps the preset's insets and chrome. */
  device: string
  /** Portrait size override; set when the size or ratio was changed by hand. */
  custom: { width: number; height: number } | null
  orientation: Orientation
  /** Draw the safe-area guides over the screen. */
  safeArea: boolean
  zoom: 'fit' | 'actual'
}

export const DEFAULT_SETTINGS: DeviceSettings = {
  device: DEFAULT_DEVICE,
  custom: null,
  orientation: 'portrait',
  safeArea: false,
  zoom: 'fit',
}

export type ResolvedDevice = {
  preset: DevicePreset
  custom: boolean
  orientation: Orientation
  /** Oriented size in points. */
  width: number
  height: number
  insets: Insets
  aspect: string
}

export function findDevice(id: string): DevicePreset {
  return DEVICES.find((d) => d.id === id) ?? DEVICES.find((d) => d.id === DEFAULT_DEVICE)!
}

export function resolveDevice(s: DeviceSettings): ResolvedDevice {
  const preset = findDevice(s.device)
  const pw = s.custom?.width ?? preset.width
  const ph = s.custom?.height ?? preset.height
  const landscape = s.orientation === 'landscape'
  const width = landscape ? Math.max(pw, ph) : Math.min(pw, ph)
  const height = landscape ? Math.min(pw, ph) : Math.max(pw, ph)
  return {
    preset,
    custom: !!s.custom,
    orientation: s.orientation,
    width,
    height,
    insets: preset.insets[s.orientation],
    aspect: aspectLabel(width, height),
  }
}

/** Keep the short side, set the long side from a named ratio. */
export function withAspect(s: DeviceSettings, id: AspectId): DeviceSettings {
  const a = ASPECT_RATIOS.find((r) => r.id === id)
  if (!a) return s
  const d = resolveDevice(s)
  const short = Math.min(d.width, d.height)
  return { ...s, custom: { width: short, height: clampSide((short * a.long) / a.short) } }
}

/**
 * Set the oriented width or height by hand; stored as a portrait override.
 * The typed value stays on its axis: a width longer than the height turns
 * the device to landscape, a height longer than the width to portrait.
 */
export function withSize(
  s: DeviceSettings,
  side: 'width' | 'height',
  value: number,
): DeviceSettings {
  const d = resolveDevice(s)
  const next = { width: d.width, height: d.height, [side]: clampSide(value) }
  const orientation: Orientation =
    next.width > next.height ? 'landscape' : next.height > next.width ? 'portrait' : s.orientation
  return {
    ...s,
    orientation,
    custom: { width: Math.min(next.width, next.height), height: Math.max(next.width, next.height) },
  }
}

/** Largest scale (never above 1) that fits a frame into the available box. */
export function fitScale(
  frame: { width: number; height: number },
  box: { width: number; height: number },
): number {
  if (frame.width <= 0 || frame.height <= 0 || box.width <= 0 || box.height <= 0) return 1
  return Math.min(1, box.width / frame.width, box.height / frame.height)
}

/** Parse settings saved by an older or newer Studio without trusting them. */
export function parseSettings(raw: unknown): DeviceSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<string, unknown>>
  const custom =
    o.custom &&
    typeof o.custom === 'object' &&
    typeof (o.custom as { width?: unknown }).width === 'number' &&
    typeof (o.custom as { height?: unknown }).height === 'number'
      ? {
          width: clampSide((o.custom as { width: number }).width),
          height: clampSide((o.custom as { height: number }).height),
        }
      : null
  return {
    device: typeof o.device === 'string' ? findDevice(o.device).id : DEFAULT_DEVICE,
    custom,
    orientation: o.orientation === 'landscape' ? 'landscape' : 'portrait',
    safeArea: o.safeArea === true,
    zoom: o.zoom === 'actual' ? 'actual' : 'fit',
  }
}
