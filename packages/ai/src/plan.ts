import { ComponentDefinition, EventName, FLOW_END, Screen, Slug } from '@freshed/schema'
import { z } from 'zod'

/**
 * A GenerationPlan is the only thing a model is allowed to produce. It is
 * data: draft screens, flow edge changes and the definitions of any new
 * components the app needs. It is used as the tool input schema, so the
 * model is constrained to this shape, and it is validated again afterwards.
 */

export const NewComponent = z.object({
  definition: ComponentDefinition,
  /** One sentence for the reviewer: why this component is needed. */
  purpose: z.string().min(1).max(280),
  /**
   * Optional JSX for the component body. It may reference the component's
   * props by name and only the React Native primitives View, Text, Pressable
   * and Image. It is written to a file for human review and never executed
   * by freshed. If it is missing or fails the static guard, a deterministic
   * scaffold is generated instead.
   */
  implementation: z.string().max(6000).optional(),
})
export type NewComponent = z.infer<typeof NewComponent>

export const FlowEdgeChange = z.object({
  flow: Slug,
  from: Slug,
  event: EventName,
  to: z.union([Slug, z.literal(FLOW_END)]),
})
export type FlowEdgeChange = z.infer<typeof FlowEdgeChange>

export const GenerationPlan = z.object({
  /** One line, imperative, e.g. "Add a referral step at the end of onboarding". */
  summary: z.string().min(1).max(160),
  /** Short slug used for the git branch name, e.g. "referral-step". */
  slug: Slug,
  newComponents: z.array(NewComponent).max(4),
  /** New draft screens. Existing screens may be returned to edit them (e.g. to add a button). */
  screens: z.array(Screen).max(6),
  /** Upserted by (flow, from, event): an existing edge with the same key is replaced. */
  flowEdges: z.array(FlowEdgeChange).max(20),
  /** Anything the reviewer should know: assumptions, follow-ups, app-side work. */
  notes: z.array(z.string().max(280)).max(8),
})
export type GenerationPlan = z.infer<typeof GenerationPlan>

export const PLAN_TOOL_NAME = 'propose_freshed_changes'
export const PLAN_TOOL_DESCRIPTION =
  'Propose draft screens, flow edge changes and any new app components for freshed. ' +
  'Everything you return is a draft that a human reviews before it is published or merged.'

/** JSON Schema for the tool input, derived from the zod schema (single source of truth). */
export function planJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(GenerationPlan, {
    target: 'draft-7',
    unrepresentable: 'any',
  }) as Record<string, unknown>
  delete schema.$schema
  return schema
}
