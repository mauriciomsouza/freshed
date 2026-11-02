import {
  FLOW_END,
  formatIssues,
  validateFlow,
  validateScreen,
  type ComponentDefinition,
  type Issue,
  type Workspace,
} from '@freshed-cms/schema'
import type { z } from 'zod'
import { applyPlan } from './apply.js'
import { GenerationPlan, PLAN_TOOL_DESCRIPTION, PLAN_TOOL_NAME, planJsonSchema } from './plan.js'
import type { ChatMessage, Provider } from './providers/types.js'
import { checkImplementation } from './codegen.js'

export type GenerateInput = {
  prompt: string
  /** Current drafts: registered components, screens and flows. */
  workspace: Workspace
  /** Extra app context (e.g. design guidance). Never include secrets. */
  context?: string
  signal?: AbortSignal
}

export type GenerateResult =
  | {
      ok: true
      plan: GenerationPlan
      /** The workspace with the plan applied, as drafts. Nothing is published. */
      drafts: Workspace
      attempts: number
      warnings: Issue[]
      model: string
    }
  | { ok: false; issues: Issue[]; attempts: number; raw: unknown; model: string }

function zodIssues(error: z.ZodError): Issue[] {
  return error.issues.map((i) => ({
    path: i.path.map(String).join('.'),
    message: i.message,
    severity: 'error' as const,
  }))
}

export function describeRegistry(components: ComponentDefinition[]): string {
  return components
    .map((c) => {
      const props = Object.entries(c.props)
        .map(([name, spec]) => {
          const extra = spec.type === 'enum' ? `(${spec.values.join('|')})` : ''
          return `${name}${spec.required ? '' : '?'}: ${spec.type}${extra}`
        })
        .join(', ')
      return `- ${c.name}${c.children ? ' [children]' : ''}: ${c.description ?? ''} { ${props} }`
    })
    .join('\n')
}

export function buildSystemPrompt(ws: Workspace, context?: string): string {
  const flows = ws.flows
    .map(
      (f) =>
        `- ${f.slug} (start: ${f.start}) screens: ${f.screens.join(', ')}; edges: ${f.edges
          .map((e) => `${e.from} --${e.event}--> ${e.to}`)
          .join('; ')}`,
    )
    .join('\n')
  return [
    'You design screens for a mobile app that uses freshed, a server-driven UI CMS.',
    'Screens are JSON trees of components that already exist in the app. You return data only, never code to execute.',
    '',
    'Rules:',
    '- Use only the registered components below. Respect each prop type and enum.',
    '- If, and only if, the request needs something no registered component can express, add it to newComponents',
    '  with a precise props spec. Keep new components small, generic and reusable. Prefer composition.',
    '- Actions: navigate {to}, emit {event}, back, dismiss, openUrl {url: https|mailto|tel|app scheme}, submit {name, event?},',
    '  copy {text}, share {message, url?}. Inside a flow, prefer emit + a flow edge over navigate.',
    `- To place a screen in a flow, add flowEdges. Use "${FLOW_END}" as the target to end the flow.`,
    '  To insert a screen between A and B, replace the A edge to point at the new screen and add an edge from it to B.',
    '- Every Image needs meaningful alt text. Buttons need short, specific labels. Write concise, friendly copy.',
    '- Give nodes short stable ids. Screen slugs are kebab-case.',
    '- Everything you produce is a draft reviewed by a human; say what you assumed in notes.',
    '',
    'Registered components:',
    describeRegistry(ws.components),
    '',
    `Existing screens: ${ws.screens.map((s) => `${s.slug} ("${s.title}")`).join(', ') || 'none'}`,
    'Flows:',
    flows || '- none',
    context ? `\nApp context:\n${context}` : '',
  ].join('\n')
}

/**
 * Checks a parsed plan against the workspace: component names, screen trees
 * (against the registry plus any new components), flow edges, and the
 * static guard on suggested implementations.
 */
export function checkPlan(
  plan: GenerationPlan,
  ws: Workspace,
): { errors: Issue[]; warnings: Issue[] } {
  const errors: Issue[] = []
  const warnings: Issue[] = []
  const existing = new Set(ws.components.map((c) => c.name))

  plan.newComponents.forEach((c, i) => {
    if (existing.has(c.definition.name)) {
      errors.push({
        path: `newComponents.${i}.definition.name`,
        message: `"${c.definition.name}" is already registered; use it instead of redefining it`,
        severity: 'error',
      })
    }
    if (c.implementation) {
      const guard = checkImplementation(c.implementation)
      if (!guard.ok) {
        warnings.push({
          path: `newComponents.${i}.implementation`,
          message: `Suggested implementation rejected (${guard.reason}); a scaffold will be generated instead`,
          severity: 'warning',
        })
      }
    }
  })

  const registry = [...ws.components, ...plan.newComponents.map((c) => c.definition)]
  plan.screens.forEach((screen, i) => {
    const r = validateScreen(screen, registry)
    for (const issue of r.issues) {
      const scoped = { ...issue, path: `screens.${i}.${issue.path}` }
      ;(issue.severity === 'error' ? errors : warnings).push(scoped)
    }
  })

  const screenSlugs = new Set([...ws.screens, ...plan.screens].map((s) => s.slug))
  plan.flowEdges.forEach((edge, i) => {
    if (!ws.flows.some((f) => f.slug === edge.flow)) {
      errors.push({
        path: `flowEdges.${i}.flow`,
        message: `Flow "${edge.flow}" does not exist`,
        severity: 'error',
      })
    }
    for (const end of [edge.from, edge.to]) {
      if (end !== FLOW_END && !screenSlugs.has(end)) {
        errors.push({
          path: `flowEdges.${i}`,
          message: `Screen "${end}" does not exist`,
          severity: 'error',
        })
      }
    }
  })

  if (!errors.length) {
    const drafts = applyPlan(ws, plan)
    for (const flow of drafts.flows) {
      if (!plan.flowEdges.some((e) => e.flow === flow.slug)) continue
      const r = validateFlow(flow, drafts.screens)
      for (const issue of r.issues) {
        const scoped = { ...issue, path: `flow:${flow.slug}.${issue.path}` }
        ;(issue.severity === 'error' ? errors : warnings).push(scoped)
      }
    }
  }
  return { errors, warnings }
}

/**
 * One prompt in, one validated plan out.
 *
 * The model is forced to call a single tool whose input schema is derived
 * from the zod schemas, so it can only answer with a plan-shaped object.
 * The answer is then parsed with zod and checked against the workspace.
 * If it is invalid, the issues are sent back once for a repair attempt.
 * After that, the result is a failure with the issues: never a guess.
 */
export async function generatePlan(
  provider: Provider,
  input: GenerateInput,
): Promise<GenerateResult> {
  const system = buildSystemPrompt(input.workspace, input.context)
  const tool = {
    name: PLAN_TOOL_NAME,
    description: PLAN_TOOL_DESCRIPTION,
    inputSchema: planJsonSchema(),
  }
  const messages: ChatMessage[] = [{ role: 'user', content: input.prompt }]
  const maxAttempts = 2
  let lastIssues: Issue[] = []
  let raw: unknown = null
  let model = provider.model

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await provider.generate({ system, messages, tool, signal: input.signal })
    raw = response.output
    model = response.model

    const parsed = GenerationPlan.safeParse(typeof raw === 'string' ? safeJson(raw) : raw)
    if (parsed.success) {
      const { errors, warnings } = checkPlan(parsed.data, input.workspace)
      if (!errors.length) {
        return {
          ok: true,
          plan: parsed.data,
          drafts: applyPlan(input.workspace, parsed.data),
          attempts: attempt,
          warnings,
          model,
        }
      }
      lastIssues = errors
    } else {
      lastIssues = zodIssues(parsed.error)
    }

    messages.push(
      { role: 'assistant', content: `Proposed plan:\n${JSON.stringify(raw).slice(0, 12000)}` },
      {
        role: 'user',
        content:
          `That plan is invalid. Fix every issue below and call ${PLAN_TOOL_NAME} again with the complete corrected plan.\n` +
          formatIssues(lastIssues),
      },
    )
  }
  return { ok: false, issues: lastIssues, attempts: maxAttempts, raw, model }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
