import { StyleSheet, View, type ViewStyle } from 'react-native'
import { tones, type Tone } from './theme'

/**
 * Bundled illustrations, referenced from the CMS as `asset:<name>`.
 * Built from plain Views so they render identically on iOS, Android and
 * react-native-web (the Studio preview) without an SVG dependency.
 */

type Palette = (typeof tones)[Tone]

function Shape({ style }: { style: ViewStyle }) {
  return <View style={[{ position: 'absolute' }, style]} />
}

function Beans({ p }: { p: Palette }) {
  return (
    <>
      <Shape
        style={{
          width: 150,
          height: 150,
          borderRadius: 75,
          backgroundColor: p.shape3,
          left: '50%',
          marginLeft: -75,
          top: 18,
        }}
      />
      {[
        { left: '30%', top: 46, r: '-28deg' },
        { left: '50%', top: 70, r: '18deg' },
        { left: '38%', top: 104, r: '-6deg' },
      ].map((b, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: b.left as `${number}%`,
            top: b.top,
            width: 54,
            height: 72,
            borderRadius: 30,
            backgroundColor: i === 1 ? p.shape2 : p.shape1,
            transform: [{ rotate: b.r }],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 4,
              height: 50,
              borderRadius: 2,
              backgroundColor: p.bg,
              opacity: 0.55,
              transform: [{ rotate: '8deg' }],
            }}
          />
        </View>
      ))}
    </>
  )
}

function Calendar({ p }: { p: Palette }) {
  const cells = Array.from({ length: 14 })
  return (
    <View
      style={{
        position: 'absolute',
        left: '50%',
        marginLeft: -92,
        top: 22,
        width: 184,
        borderRadius: 16,
        backgroundColor: p.shape3,
        padding: 12,
      }}
    >
      <View
        style={{
          height: 14,
          width: 72,
          borderRadius: 7,
          backgroundColor: p.shape1,
          marginBottom: 12,
        }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {cells.map((_, i) => (
          <View
            key={i}
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: i === 2 || i === 9 ? p.shape1 : p.bg,
            }}
          />
        ))}
      </View>
    </View>
  )
}

function Box({ p }: { p: Palette }) {
  return (
    <>
      <Shape
        style={{
          width: 170,
          height: 170,
          borderRadius: 85,
          backgroundColor: p.shape3,
          left: '50%',
          marginLeft: -85,
          top: 10,
        }}
      />
      <Shape
        style={{
          width: 132,
          height: 92,
          borderRadius: 12,
          backgroundColor: p.shape1,
          left: '50%',
          marginLeft: -66,
          top: 72,
        }}
      />
      <Shape
        style={{
          width: 146,
          height: 26,
          borderRadius: 8,
          backgroundColor: p.shape2,
          left: '50%',
          marginLeft: -73,
          top: 60,
        }}
      />
      <Shape
        style={{
          width: 18,
          height: 118,
          borderRadius: 4,
          backgroundColor: p.shape3,
          left: '50%',
          marginLeft: -9,
          top: 56,
          opacity: 0.85,
        }}
      />
    </>
  )
}

function Ember({ p }: { p: Palette }) {
  return (
    <>
      <Shape
        style={{
          width: 120,
          height: 150,
          borderRadius: 20,
          backgroundColor: p.shape1,
          left: '50%',
          marginLeft: -60,
          top: 26,
        }}
      />
      <Shape
        style={{
          width: 120,
          height: 36,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          backgroundColor: p.shape2,
          left: '50%',
          marginLeft: -60,
          top: 26,
        }}
      />
      <Shape
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: p.shape3,
          left: '50%',
          marginLeft: -28,
          top: 88,
        }}
      />
      <Shape
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: p.shape2,
          left: '50%',
          marginLeft: -11,
          top: 105,
        }}
      />
      <Shape
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: p.shape2,
          left: '22%',
          top: 40,
        }}
      />
      <Shape
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: p.shape1,
          left: '74%',
          top: 64,
        }}
      />
    </>
  )
}

function Gift({ p }: { p: Palette }) {
  return (
    <>
      <Shape
        style={{
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: p.shape3,
          left: '50%',
          marginLeft: -80,
          top: 14,
        }}
      />
      <Shape
        style={{
          width: 92,
          height: 110,
          borderRadius: 14,
          backgroundColor: p.shape2,
          left: '50%',
          marginLeft: -86,
          top: 56,
          transform: [{ rotate: '-8deg' }],
        }}
      />
      <Shape
        style={{
          width: 92,
          height: 110,
          borderRadius: 14,
          backgroundColor: p.shape1,
          left: '50%',
          marginLeft: -6,
          top: 50,
          transform: [{ rotate: '7deg' }],
        }}
      />
      <Shape
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: p.bg,
          left: '50%',
          marginLeft: 26,
          top: 90,
        }}
      />
    </>
  )
}

function Placeholder({ p }: { p: Palette }) {
  return (
    <Shape
      style={{
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: p.shape3,
        left: '50%',
        marginLeft: -60,
        top: 40,
      }}
    />
  )
}

const library = { beans: Beans, calendar: Calendar, box: Box, ember: Ember, gift: Gift } as const
export type IllustrationName = keyof typeof library
export const illustrationNames = Object.keys(library) as IllustrationName[]

export function Illustration({
  name,
  tone = 'cream',
  height = 200,
}: {
  name: string
  tone?: Tone
  height?: number
}) {
  const p = tones[tone]
  const Art = library[name as IllustrationName] ?? Placeholder
  return (
    <View style={[styles.frame, { backgroundColor: p.bg, height }]} accessible={false}>
      <Art p={p} />
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { width: '100%', overflow: 'hidden', borderRadius: 24, position: 'relative' },
})
