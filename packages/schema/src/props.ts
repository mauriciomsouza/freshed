import { z } from 'zod'

/**
 * Prop specs describe a component's props as plain data, so the same
 * description can live in app code (via `defineComponent`), in Postgres
 * (as a ComponentDefinition) and in an LLM tool schema.
 */

const base = {
  description: z.string().max(280).optional(),
  required: z.boolean().optional(),
}

export const StringPropSpec = z.object({
  type: z.literal('string'),
  ...base,
  default: z.string().optional(),
  maxLength: z.number().int().positive().optional(),
  multiline: z.boolean().optional(),
})

export const NumberPropSpec = z.object({
  type: z.literal('number'),
  ...base,
  default: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
})

export const BooleanPropSpec = z.object({
  type: z.literal('boolean'),
  ...base,
  default: z.boolean().optional(),
})

export const EnumPropSpec = z.object({
  type: z.literal('enum'),
  ...base,
  values: z.array(z.string().min(1)).min(1),
  default: z.string().optional(),
})

/** A URL to an image. Rendered by app components; never executed. */
export const ImagePropSpec = z.object({
  type: z.literal('image'),
  ...base,
})

/** An Action (see actions.ts). The renderer turns it into a callback. */
export const ActionPropSpec = z.object({
  type: z.literal('action'),
  ...base,
})

/** A list of strings, e.g. bullet points or option labels. */
export const StringListPropSpec = z.object({
  type: z.literal('string[]'),
  ...base,
  default: z.array(z.string()).optional(),
  maxItems: z.number().int().positive().optional(),
})

export const PropSpec = z.discriminatedUnion('type', [
  StringPropSpec,
  NumberPropSpec,
  BooleanPropSpec,
  EnumPropSpec,
  ImagePropSpec,
  ActionPropSpec,
  StringListPropSpec,
])
export type PropSpec = z.infer<typeof PropSpec>
export type PropType = PropSpec['type']

export const PropsSpec = z.record(z.string().regex(/^[a-z][A-Za-z0-9]*$/), PropSpec)
export type PropsSpec = z.infer<typeof PropsSpec>

type Opts<S> = Omit<S, 'type'>

/**
 * Small builder so app code reads naturally and TypeScript can infer
 * component props from the spec:
 *
 *   props: { title: prop.string({ required: true }), onPress: prop.action() }
 */
export const prop = {
  string: <const O extends Opts<z.infer<typeof StringPropSpec>>>(o?: O) =>
    ({ type: 'string', ...o }) as { type: 'string' } & O,
  number: <const O extends Opts<z.infer<typeof NumberPropSpec>>>(o?: O) =>
    ({ type: 'number', ...o }) as { type: 'number' } & O,
  boolean: <const O extends Opts<z.infer<typeof BooleanPropSpec>>>(o?: O) =>
    ({ type: 'boolean', ...o }) as { type: 'boolean' } & O,
  enum: <
    const V extends [string, ...string[]],
    const O extends Omit<Opts<z.infer<typeof EnumPropSpec>>, 'values'>,
  >(
    values: V,
    o?: O,
  ) => ({ type: 'enum', values, ...o }) as { type: 'enum'; values: V } & O,
  image: <const O extends Opts<z.infer<typeof ImagePropSpec>>>(o?: O) =>
    ({ type: 'image', ...o }) as { type: 'image' } & O,
  action: <const O extends Opts<z.infer<typeof ActionPropSpec>>>(o?: O) =>
    ({ type: 'action', ...o }) as { type: 'action' } & O,
  stringList: <const O extends Opts<z.infer<typeof StringListPropSpec>>>(o?: O) =>
    ({ type: 'string[]', ...o }) as { type: 'string[]' } & O,
}

type ValueOf<S> = S extends { type: 'string' }
  ? string
  : S extends { type: 'number' }
    ? number
    : S extends { type: 'boolean' }
      ? boolean
      : S extends { type: 'enum'; values: readonly (infer V)[] }
        ? V
        : S extends { type: 'image' }
          ? string
          : S extends { type: 'action' }
            ? () => void
            : S extends { type: 'string[]' }
              ? string[]
              : never

type IsRequired<S> = S extends { required: true }
  ? true
  : S extends { default: unknown }
    ? true
    : false

/** Infers the props a component receives at render time from its spec. */
export type InferProps<P> = {
  [K in keyof P as IsRequired<P[K]> extends true ? K : never]: ValueOf<P[K]>
} & {
  [K in keyof P as IsRequired<P[K]> extends true ? never : K]?: ValueOf<P[K]>
}
