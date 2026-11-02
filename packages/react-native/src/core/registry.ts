import { ComponentDefinition, type InferProps, type PropsSpec } from '@freshed-cms/schema'

/**
 * A component the app ships, paired with its CMS-facing definition.
 * `R` is the render function type (a React component in practice); core
 * stays framework-free so it can be unit tested without React Native.
 */
export type RegisteredComponent<R = unknown> = ComponentDefinition & { render: R }

export type Registry<R = unknown> = {
  get(name: string): RegisteredComponent<R> | undefined
  has(name: string): boolean
  names(): string[]
  /** Plain-data definitions, safe to send to the server (no render functions). */
  definitions(): ComponentDefinition[]
}

export class RegistryError extends Error {
  override name = 'RegistryError'
}

export function createRegistry<R>(components: readonly RegisteredComponent<R>[]): Registry<R> {
  const map = new Map<string, RegisteredComponent<R>>()
  for (const component of components) {
    const { render, ...definition } = component
    const parsed = ComponentDefinition.safeParse(definition)
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      throw new RegistryError(`Invalid component "${component.name}": ${detail}`)
    }
    if (map.has(component.name))
      throw new RegistryError(`Component "${component.name}" is registered twice`)
    if (render === undefined || render === null) {
      throw new RegistryError(`Component "${component.name}" has no render function`)
    }
    map.set(component.name, component)
  }
  return {
    get: (name) => map.get(name),
    has: (name) => map.has(name),
    names: () => [...map.keys()],
    definitions: () =>
      [...map.values()].map(
        ({ render: _render, ...definition }) => definition as ComponentDefinition,
      ),
  }
}

/** Typed props for a component definition, as received at render time. */
export type PropsOf<P extends PropsSpec, Children extends boolean | undefined> = InferProps<P> &
  (Children extends true ? { children?: unknown } : unknown)
