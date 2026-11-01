import type { ComponentDefinition, InferProps, PropsSpec } from '@freshed/schema'
import type { ComponentType, ReactNode } from 'react'
import type { RegisteredComponent } from './core/registry.js'

type ChildrenProp<D> = D extends { children: true }
  ? { children?: ReactNode }
  : { children?: never }

/** Props a component receives, inferred from its definition. */
export type ComponentProps<D extends { props: PropsSpec }> = InferProps<D['props']> &
  ChildrenProp<D>

/**
 * Pairs a component spec with its React Native implementation. Props are
 * fully typed from the spec:
 *
 *   const Hero = defineComponent(
 *     { name: 'Hero', props: { title: prop.string({ required: true }) } },
 *     ({ title }) => <Text>{title}</Text>,  // title: string
 *   )
 */
export function defineComponent<const D extends ComponentDefinition>(
  definition: D,
  render: ComponentType<ComponentProps<D>>,
): RegisteredComponent<ComponentType<Record<string, unknown>>> & D {
  return { ...definition, render: render as unknown as ComponentType<Record<string, unknown>> }
}
