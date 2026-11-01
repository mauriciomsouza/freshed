import type { ComponentDefinition, PropSpec } from '@freshed/schema'
import type { NewComponent } from './plan.js'

/**
 * Code generation for new app components.
 *
 * Output is source text written to files for human review. freshed never
 * imports, evaluates or runs it. A model may suggest a JSX body; it is only
 * used if it passes a conservative static guard, otherwise a deterministic,
 * accessible scaffold is generated from the props spec.
 */

const ALLOWED_TAGS = new Set(['View', 'Text', 'Pressable', 'Image'])
const FORBIDDEN = [
  /\bimport\b/,
  /\brequire\s*\(/,
  /\beval\b/,
  /\bFunction\s*\(/,
  /\bnew\s+Function\b/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bglobalThis\b/,
  /\bprocess\b/,
  /\bdangerouslySetInnerHTML\b/,
  /\bsetTimeout\b|\bsetInterval\b/,
  /\b(window|document|localStorage|AsyncStorage)\b/,
  /`/,
]

export function checkImplementation(source: string): { ok: true } | { ok: false; reason: string } {
  for (const pattern of FORBIDDEN) {
    if (pattern.test(source))
      return { ok: false, reason: `contains forbidden token ${pattern.source}` }
  }
  const tags = [...source.matchAll(/<\/?([A-Za-z][A-Za-z0-9.]*)/g)].map((m) => m[1]!)
  if (!tags.length) return { ok: false, reason: 'no JSX found' }
  const bad = tags.find((t) => !ALLOWED_TAGS.has(t))
  if (bad)
    return { ok: false, reason: `uses <${bad}>; only ${[...ALLOWED_TAGS].join(', ')} are allowed` }
  return { ok: true }
}

function literal(value: unknown): string {
  return JSON.stringify(value)
}

function specSource(spec: PropSpec): string {
  const opts: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(spec)) {
    if (k !== 'type' && k !== 'values' && v !== undefined) opts[k] = v
  }
  const o = Object.keys(opts).length ? literal(opts) : ''
  switch (spec.type) {
    case 'enum':
      return `prop.enum(${literal(spec.values)}${o ? `, ${o}` : ''})`
    case 'string[]':
      return `prop.stringList(${o})`
    default:
      return `prop.${spec.type}(${o})`
  }
}

/** Deterministic, accessible scaffold derived from the props spec. */
export function scaffoldBody(def: ComponentDefinition): string {
  const entries = Object.entries(def.props)
  const strings = entries.filter(([, s]) => s.type === 'string').map(([n]) => n)
  const lists = entries.filter(([, s]) => s.type === 'string[]').map(([n]) => n)
  const actions = entries.filter(([, s]) => s.type === 'action').map(([n]) => n)
  const images = entries.filter(([, s]) => s.type === 'image').map(([n]) => n)
  const [heading, ...rest] = strings
  const lines: string[] = []
  lines.push(`    <View style={styles.container} accessibilityRole="summary">`)
  for (const img of images) {
    lines.push(
      `      {${img} ? <Image source={{ uri: ${img} }} style={styles.image} accessibilityIgnoresInvertColors /> : null}`,
    )
  }
  if (heading)
    lines.push(
      `      {${heading} ? <Text style={styles.heading} accessibilityRole="header">{${heading}}</Text> : null}`,
    )
  for (const s of rest) lines.push(`      {${s} ? <Text style={styles.body}>{${s}}</Text> : null}`)
  for (const l of lists) {
    lines.push(`      {(${l} ?? []).map((item) => (`)
    lines.push(`        <Text key={item} style={styles.body}>{'\\u2022 '}{item}</Text>`)
    lines.push(`      ))}`)
  }
  for (const a of actions) {
    const label = heading ?? a
    lines.push(`      {${a} ? (`)
    lines.push(
      `        <Pressable onPress={${a}} accessibilityRole="button" accessibilityLabel={String(${heading ?? `'${label}'`})} style={styles.action}>`,
    )
    lines.push(`          <Text style={styles.actionLabel}>${humanize(a)}</Text>`)
    lines.push(`        </Pressable>`)
    lines.push(`      ) : null}`)
  }
  if (def.children) lines.push(`      {children}`)
  lines.push(`    </View>`)
  return lines.join('\n')
}

function humanize(name: string): string {
  const words = name
    .replace(/^on/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim()
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase()
}

export type GeneratedFile = { path: string; contents: string }

export type CodegenOptions = {
  /** Directory for component files, relative to the app root. */
  componentsDir: string
  /** Import specifier for the renderer package. */
  rendererImport?: string
}

/** Renders a `defineComponent` file for a new component. */
export function componentFile(component: NewComponent, options: CodegenOptions): GeneratedFile {
  const def = component.definition
  const propNames = Object.keys(def.props)
  const params = [...propNames, ...(def.children ? ['children'] : [])].join(', ')
  const guard = component.implementation
    ? checkImplementation(component.implementation)
    : { ok: false as const }
  const body = guard.ok ? indent(component.implementation!.trim(), 4) : scaffoldBody(def)
  const meta: string[] = [`  name: ${literal(def.name)},`]
  if (def.category) meta.push(`  category: ${literal(def.category)},`)
  if (def.description) meta.push(`  description: ${literal(def.description)},`)
  if (def.children) meta.push(`  children: true,`)
  const props = Object.entries(def.props)
    .map(([name, spec]) => `    ${name}: ${specSource(spec)},`)
    .join('\n')

  const contents = `// Generated by freshed ai. Review before merging: this file is not executed by freshed.
// Purpose: ${component.purpose.replace(/\n/g, ' ')}
${guard.ok ? '// Body suggested by the model and checked by the static guard.' : '// Body scaffolded from the props spec. Style it with your design system.'}
import { defineComponent, prop } from '${options.rendererImport ?? '@freshed/react-native'}'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

export const ${def.name} = defineComponent(
  {
${meta.map((m) => `  ${m}`).join('\n')}
    props: {
${props.replace(/^/gm, '  ')}
    },
  },
  function ${def.name}({ ${params} }) {
    return (
${body}
    )
  },
)

const styles = StyleSheet.create({
  container: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: '#F6F1EA' },
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12 },
  heading: { fontSize: 18, fontWeight: '600', color: '#1F1A17' },
  body: { fontSize: 15, lineHeight: 21, color: '#4A403A' },
  action: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#1F1A17' },
  actionLabel: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
})
`
  // Unused imports are harmless but noisy; keep only the primitives the body uses.
  const used = ['Image', 'Pressable', 'Text', 'View'].filter((t) =>
    new RegExp(`<${t}\\b`).test(body),
  )
  const rnImport = `import { ${[...used, 'StyleSheet'].sort().join(', ')} } from 'react-native'`
  return {
    path: `${options.componentsDir.replace(/\/+$/, '')}/${def.name}.tsx`,
    contents: contents.replace(
      /import \{ Image, Pressable, StyleSheet, Text, View \} from 'react-native'/,
      rnImport,
    ),
  }
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((l) => (l.trim() ? pad + l : l))
    .join('\n')
}

export const REGISTRY_IMPORTS_MARKER = '// freshed:imports'
export const REGISTRY_COMPONENTS_MARKER = '// freshed:components'

export class RegistryPatchError extends Error {
  override name = 'RegistryPatchError'
}

/**
 * Adds imports and entries for new components to the app's registry file.
 * The file must contain the two marker comments; they make the edit
 * predictable and reviewable instead of guessing at arbitrary code.
 */
export function patchRegistry(
  source: string,
  names: string[],
  importFrom: (name: string) => string,
): string {
  if (!source.includes(REGISTRY_IMPORTS_MARKER) || !source.includes(REGISTRY_COMPONENTS_MARKER)) {
    throw new RegistryPatchError(
      `Registry file must contain "${REGISTRY_IMPORTS_MARKER}" and "${REGISTRY_COMPONENTS_MARKER}" markers`,
    )
  }
  let out = source
  for (const name of names) {
    if (new RegExp(`\\bimport \\{ ${name} \\}`).test(out)) continue
    out = out.replace(
      REGISTRY_IMPORTS_MARKER,
      `import { ${name} } from '${importFrom(name)}'\n${REGISTRY_IMPORTS_MARKER}`,
    )
    out = out.replace(
      new RegExp(`^([ \\t]*)${escapeRegExp(REGISTRY_COMPONENTS_MARKER)}`, 'm'),
      (_m, ws: string) => `${ws}${name},\n${ws}${REGISTRY_COMPONENTS_MARKER}`,
    )
  }
  return out
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
