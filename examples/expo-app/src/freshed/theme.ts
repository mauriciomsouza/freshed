/** Brew's design tokens. Fictional brand, used by the example app only. */
export const color = {
  ink: '#22170F',
  inkSoft: '#5E5047',
  inkMuted: '#8C7E74',
  paper: '#FBF8F4',
  surface: '#FFFFFF',
  line: '#E8E0D6',
  accent: '#2F6B4F',
  accentInk: '#FFFFFF',
  focus: '#2F6B4F',
} as const

export const tones = {
  cream: { bg: '#F2EADF', ink: '#22170F', shape1: '#C99A6B', shape2: '#7A4E2D', shape3: '#FBF8F4' },
  roast: { bg: '#3A2518', ink: '#FBF3EA', shape1: '#C27A47', shape2: '#F0C89A', shape3: '#5B3A26' },
  sage: { bg: '#DDE6DA', ink: '#1C2B22', shape1: '#2F6B4F', shape2: '#A9C2A3', shape3: '#F4F7F2' },
  berry: { bg: '#F1DDDC', ink: '#2A1414', shape1: '#9A3648', shape2: '#E6A4A0', shape3: '#FFF6F4' },
} as const
export type Tone = keyof typeof tones

export const space = { none: 0, xs: 4, sm: 8, md: 16, lg: 24, xl: 40 } as const

export const radius = { sm: 10, md: 16, lg: 24 } as const

export const type = {
  title: { fontSize: 28, lineHeight: 33, fontWeight: '700' as const, letterSpacing: -0.6 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' as const, letterSpacing: -0.3 },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
}
