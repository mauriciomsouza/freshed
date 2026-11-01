import { z } from 'zod'
import { PropsSpec } from './props.js'
import { ComponentName } from './screen.js'

/**
 * A ComponentDefinition is the CMS-side description of a component that
 * already exists in the app bundle. It holds no code: only a name, a props
 * spec and some editor metadata.
 */
export const ComponentDefinition = z.object({
  name: ComponentName,
  description: z.string().max(280).optional(),
  /** Editor grouping, e.g. "Layout", "Content", "Input". */
  category: z.string().max(32).optional(),
  props: PropsSpec,
  /** Whether the component renders child nodes. */
  children: z.boolean().optional(),
  /** Protocol version that introduced this component. Defaults to 1. */
  since: z.number().int().positive().optional(),
})
export type ComponentDefinition = z.infer<typeof ComponentDefinition>

/**
 * Declares a component spec as plain data. Use it in a module that does not
 * import React Native, so the same spec can be shared with the server, the
 * Studio and tooling, then pass it to `defineComponent` in the app.
 */
export function componentSpec<const S extends ComponentDefinition>(spec: S): S {
  return spec
}
