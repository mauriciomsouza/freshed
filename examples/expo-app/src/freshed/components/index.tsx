import * as specs from '@freshed-cms/example-brew'
import { defineComponent } from '@freshed-cms/react-native'
import { Image as RNImage, Pressable, Text as RNText, View, StyleSheet } from 'react-native'
import { Illustration } from '../illustrations'
import { color, radius, space, tones, type } from '../theme'

/**
 * Brew's components. Each one pairs a spec (plain data, shared with the CMS)
 * with a React Native implementation. Props are typed from the spec.
 */

export const Stack = defineComponent(
  specs.Stack,
  ({ direction, gap, padding, align, grow, children }) => (
    <View
      style={{
        flexDirection: direction === 'horizontal' ? 'row' : 'column',
        gap: space[gap],
        padding: space[padding],
        alignItems: { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' }[
          align
        ] as 'flex-start' | 'center' | 'flex-end' | 'stretch',
        flexGrow: grow ? 1 : undefined,
      }}
    >
      {children}
    </View>
  ),
)

function isAsset(src?: string): src is `asset:${string}` {
  return !!src && src.startsWith('asset:')
}

export const Hero = defineComponent(specs.Hero, ({ eyebrow, title, subtitle, image, tone }) => {
  const p = tones[tone]
  return (
    <View style={{ gap: space.md }}>
      {image ? (
        isAsset(image) ? (
          <Illustration name={image.slice(6)} tone={tone} />
        ) : (
          <RNImage
            source={{ uri: image }}
            style={styles.heroImage}
            accessibilityIgnoresInvertColors
          />
        )
      ) : null}
      <View style={{ gap: space.xs }}>
        {eyebrow ? (
          <RNText style={[type.caption, { color: tone === 'roast' ? p.shape1 : color.accent }]}>
            {eyebrow}
          </RNText>
        ) : null}
        <RNText accessibilityRole="header" style={[type.title, { color: color.ink }]}>
          {title}
        </RNText>
        {subtitle ? (
          <RNText style={[type.body, { color: color.inkSoft }]}>{subtitle}</RNText>
        ) : null}
      </View>
    </View>
  )
})

export const Text = defineComponent(specs.Text, ({ text, variant, align, tone }) => (
  <RNText
    accessibilityRole={variant === 'title' || variant === 'heading' ? 'header' : 'text'}
    style={[
      type[variant],
      { textAlign: align === 'center' ? 'center' : 'left' },
      { color: tone === 'muted' ? color.inkMuted : tone === 'accent' ? color.accent : color.ink },
    ]}
  >
    {text}
  </RNText>
))

export const Button = defineComponent(
  specs.Button,
  ({ label, variant, action, accessibilityHint }) => (
    <Pressable
      onPress={action}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: color.ink },
        variant === 'secondary' && {
          backgroundColor: color.surface,
          borderWidth: 1,
          borderColor: color.line,
        },
        variant === 'ghost' && { backgroundColor: 'transparent', minHeight: 40 },
        pressed && { opacity: 0.8 },
      ]}
    >
      <RNText
        style={[
          styles.buttonLabel,
          {
            color:
              variant === 'primary'
                ? color.accentInk
                : variant === 'ghost'
                  ? color.inkSoft
                  : color.ink,
          },
        ]}
      >
        {label}
      </RNText>
    </Pressable>
  ),
)

const aspect = { square: 1, wide: 16 / 9, tall: 3 / 4 } as const

export const Image = defineComponent(specs.Image, ({ src, alt, aspect: a, rounded }) =>
  isAsset(src) || !src ? (
    <View accessible accessibilityRole="image" accessibilityLabel={alt}>
      {/* A missing src shows the bundled placeholder art instead of an empty image. */}
      <Illustration name={src ? src.slice(6) : ''} tone="cream" height={a === 'wide' ? 150 : 220} />
    </View>
  ) : (
    <RNImage
      source={{ uri: src }}
      accessibilityLabel={alt}
      style={{ width: '100%', aspectRatio: aspect[a], borderRadius: rounded ? radius.md : 0 }}
    />
  ),
)

export const Card = defineComponent(
  specs.Card,
  ({ title, caption, badge, selected, action, children }) => {
    const body = (
      <>
        {title || badge ? (
          <View style={styles.cardHead}>
            {title ? (
              <RNText style={[type.body, { fontWeight: '600', color: color.ink, flexShrink: 1 }]}>
                {title}
              </RNText>
            ) : null}
            {badge ? (
              <View style={styles.badge}>
                <RNText style={styles.badgeText}>{badge}</RNText>
              </View>
            ) : null}
          </View>
        ) : null}
        {caption ? (
          <RNText style={[type.caption, { color: color.inkSoft, fontWeight: '400' }]}>
            {caption}
          </RNText>
        ) : null}
        {children}
      </>
    )
    const style = [styles.card, selected && styles.cardSelected]
    return action ? (
      <Pressable
        onPress={action}
        accessibilityRole="button"
        accessibilityState={{ selected: !!selected }}
        accessibilityLabel={[title, caption].filter(Boolean).join('. ')}
        style={({ pressed }) => [...style, pressed && { opacity: 0.85 }]}
      >
        {body}
      </Pressable>
    ) : (
      <View style={style}>{body}</View>
    )
  },
)

/**
 * Required props can still be missing at runtime (an older screen, a hand-edited draft); the
 * renderer passes the node on and leaves it to the component, so List and Image cope.
 */
export const List = defineComponent(specs.List, ({ items, style }) => {
  const list = Array.isArray(items) ? items : []
  if (!list.length) return null
  return (
    <View style={{ gap: space.sm }} accessibilityRole="list">
      {list.map((item, i) => (
        <View
          key={`${i}-${item}`}
          style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}
        >
          {style === 'check' ? (
            <View style={styles.check}>
              <View style={styles.checkMark} />
            </View>
          ) : (
            <RNText style={[type.body, { color: color.accent, width: 18 }]}>
              {style === 'number' ? `${i + 1}.` : '•'}
            </RNText>
          )}
          <RNText style={[type.body, { color: color.ink, flex: 1 }]}>{item}</RNText>
        </View>
      ))}
    </View>
  )
})

export const Spacer = defineComponent(specs.Spacer, ({ size }) =>
  size === 'flex' ? (
    <View style={{ flexGrow: 1, minHeight: space.md }} />
  ) : (
    <View style={{ height: space[size] }} />
  ),
)

const styles = StyleSheet.create({
  heroImage: { width: '100%', height: 200, borderRadius: radius.lg },
  button: {
    minHeight: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  buttonLabel: { fontSize: 16, fontWeight: '600', letterSpacing: -0.1 },
  card: {
    gap: 4,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  cardSelected: { borderColor: color.accent, borderWidth: 2, padding: space.md - 1 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#E3EEE7',
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: color.accent },
  check: {
    width: 20,
    height: 20,
    marginTop: 1.5,
    borderRadius: 10,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    width: 9,
    height: 5,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#fff',
    transform: [{ rotate: '-45deg' }, { translateY: -1 }],
  },
})
