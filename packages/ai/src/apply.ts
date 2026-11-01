import { FLOW_END, type Flow, type Workspace } from '@freshed/schema'
import type { GenerationPlan } from './plan.js'

/**
 * Applies a plan to a workspace and returns new drafts. Pure: the input is
 * not mutated, nothing is persisted and nothing is published.
 *
 * - new component definitions are appended to the registry;
 * - screens are upserted by slug;
 * - flow edges are upserted by (flow, from, event); screens referenced by a
 *   new edge are added to the flow's screen list.
 */
export function applyPlan(ws: Workspace, plan: GenerationPlan): Workspace {
  const components = [...ws.components, ...plan.newComponents.map((c) => c.definition)]

  const screens = [...ws.screens]
  for (const screen of plan.screens) {
    const i = screens.findIndex((s) => s.slug === screen.slug)
    if (i >= 0) screens[i] = screen
    else screens.push(screen)
  }

  const flows: Flow[] = ws.flows.map((flow) => {
    const changes = plan.flowEdges.filter((e) => e.flow === flow.slug)
    if (!changes.length) return flow
    const edges = [...flow.edges]
    const flowScreens = [...flow.screens]
    for (const change of changes) {
      const edge = { from: change.from, event: change.event, to: change.to }
      const i = edges.findIndex((e) => e.from === edge.from && e.event === edge.event)
      if (i >= 0) edges[i] = edge
      else edges.push(edge)
      for (const slug of [edge.from, edge.to]) {
        if (slug !== FLOW_END && !flowScreens.includes(slug)) flowScreens.push(slug)
      }
    }
    return { ...flow, screens: flowScreens, edges }
  })

  return { components, screens, flows }
}
