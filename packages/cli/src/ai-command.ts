import {
  applyPlan,
  componentFile,
  createAdminClient,
  generatePlan,
  patchRegistry,
  syncPlanToServer,
  type AdminClient,
  type GenerationPlan,
  type Provider,
} from '@freshed-cms/ai'
import type { Workspace } from '@freshed-cms/schema'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { branchExists, currentBranch, defaultBranch, git, isClean, isGitRepo } from './git.js'

/**
 * App-side configuration, read from `freshed.config.json` at the app root.
 * Paths are relative to the app root.
 */
export type AppConfig = {
  /** File that exports the component registry and contains the freshed markers. */
  registry: string
  /** Directory where new component files are written. */
  componentsDir: string
  /** Optional JSON file with the workspace snapshot, used when no server is given. */
  workspace?: string
  /** Free-form design guidance passed to the model. */
  context?: string
}

export const DEFAULT_CONFIG: AppConfig = {
  registry: 'src/freshed/registry.ts',
  componentsDir: 'src/freshed/components',
}

export type AiCommandOptions = {
  prompt: string
  appDir: string
  provider: Provider
  /** freshed server URL; when set, the workspace is read from it and drafts are synced to it. */
  server?: string
  adminKey?: string
  /** Open a PR with `gh` after committing. */
  pr?: boolean
  /** Print the plan and diff without touching git or the server. */
  dryRun?: boolean
  log?: (line: string) => void
  /** Injected for tests. */
  adminClient?: AdminClient
  runGh?: (args: string[], cwd: string) => string
}

export type AiCommandResult = {
  plan: GenerationPlan
  branch: string | null
  files: { path: string; status: 'added' | 'modified' }[]
  synced: { components: string[]; screens: string[]; flows: string[] } | null
  diffStat: string
}

export class CliError extends Error {
  override name = 'CliError'
}

export function loadConfig(appDir: string): AppConfig {
  const path = join(appDir, 'freshed.config.json')
  if (!existsSync(path)) return DEFAULT_CONFIG
  return { ...DEFAULT_CONFIG, ...(JSON.parse(readFileSync(path, 'utf8')) as Partial<AppConfig>) }
}

export function branchName(slug: string): string {
  return `freshed/ai-${slug}`
}

/**
 * `freshed ai "<prompt>"`
 *
 * 1. Reads the workspace (from the server, or a local JSON snapshot).
 * 2. Asks the model for a schema-constrained plan (validated, repaired once).
 * 3. Creates `freshed/ai-<slug>` from the current HEAD. Refuses to run on a
 *    dirty tree, and never commits to the default branch.
 * 4. Writes new component files and patches the registry, then commits.
 * 5. Syncs component definitions, draft screens and flows to the server.
 *    Nothing is published.
 * 6. Optionally opens a PR with `gh`.
 *
 * Generated code is written, never imported or executed.
 */
export async function runAiCommand(options: AiCommandOptions): Promise<AiCommandResult> {
  const log = options.log ?? (() => {})
  const appDir = resolve(options.appDir)
  const config = loadConfig(appDir)

  if (!options.dryRun) {
    if (!isGitRepo(appDir)) throw new CliError(`${appDir} is not a git repository`)
    if (!isClean(appDir))
      throw new CliError('Working tree has uncommitted changes. Commit or stash them first.')
  }

  const admin =
    options.adminClient ??
    (options.server
      ? createAdminClient({ baseUrl: options.server, adminKey: requireAdminKey(options.adminKey) })
      : null)
  const workspace = admin ? await admin.workspace() : readLocalWorkspace(appDir, config)

  log(`Generating with ${options.provider.id} (${options.provider.model})…`)
  const result = await generatePlan(options.provider, {
    prompt: options.prompt,
    workspace,
    context: config.context,
  })
  if (!result.ok) {
    throw new CliError(
      `The model did not produce a valid plan after ${result.attempts} attempts:\n` +
        result.issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n'),
    )
  }
  const { plan } = result
  log(`Plan: ${plan.summary}${result.attempts > 1 ? ' (repaired once)' : ''}`)

  const files = plan.newComponents.map((c) =>
    componentFile(c, {
      componentsDir: config.componentsDir,
      rendererImport: '@freshed-cms/react-native',
    }),
  )
  const registryPath = join(appDir, config.registry)

  if (options.dryRun) {
    return {
      plan,
      branch: null,
      files: [
        ...files.map((f) => ({ path: f.path, status: 'added' as const })),
        ...(files.length ? [{ path: config.registry, status: 'modified' as const }] : []),
      ],
      synced: null,
      diffStat: '',
    }
  }

  const base = currentBranch(appDir)
  const protectedBranch = defaultBranch(appDir)
  let branch = branchName(plan.slug)
  for (let n = 2; branchExists(appDir, branch); n++) branch = `${branchName(plan.slug)}-${n}`
  if (branch === protectedBranch) throw new CliError('Refusing to write to the default branch')
  git(appDir, ['switch', '-c', branch])
  log(`Created branch ${branch} from ${base}`)

  const written: AiCommandResult['files'] = []
  try {
    for (const file of files) {
      const abs = join(appDir, file.path)
      if (existsSync(abs)) throw new CliError(`${file.path} already exists; refusing to overwrite`)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, file.contents)
      written.push({ path: file.path, status: 'added' })
    }
    if (files.length) {
      if (!existsSync(registryPath))
        throw new CliError(`Registry file not found: ${config.registry}`)
      const source = readFileSync(registryPath, 'utf8')
      const patched = patchRegistry(
        source,
        plan.newComponents.map((c) => c.definition.name),
        (name) => {
          const target = join(appDir, config.componentsDir, name)
          let rel = relative(dirname(registryPath), target).replace(/\\/g, '/')
          if (!rel.startsWith('.')) rel = `./${rel}`
          return rel
        },
      )
      writeFileSync(registryPath, patched)
      written.push({ path: config.registry, status: 'modified' })
    }

    const planPath = `.freshed/ai/${plan.slug}.json`
    mkdirSync(join(appDir, '.freshed/ai'), { recursive: true })
    writeFileSync(
      join(appDir, planPath),
      JSON.stringify({ prompt: options.prompt, plan }, null, 2) + '\n',
    )
    written.push({ path: planPath, status: 'added' })

    git(appDir, ['add', '--', ...written.map((f) => f.path)])
    git(appDir, [
      'commit',
      '--no-verify',
      '-m',
      `feat(freshed-ai): ${plan.summary}`,
      '-m',
      `Generated by freshed ai from the prompt:\n\n  ${options.prompt}\n\nDrafts only. Review the component code, then publish screens from the Studio.`,
    ])
  } catch (error) {
    // Leave the branch for inspection, but never leave the user stranded on it with a half-written tree.
    log(`Failed; branch ${branch} kept for inspection`)
    throw error
  }

  const diffStat = git(appDir, ['diff', '--stat', `${base}...${branch}`])
  log(diffStat)

  let synced: AiCommandResult['synced'] = null
  if (admin) {
    synced = await syncPlanToServer(admin, plan, applyPlan(workspace, plan))
    log(
      `Synced drafts: ${[...synced.components, ...synced.screens, ...synced.flows].join(', ') || 'nothing'}`,
    )
  }

  if (options.pr) {
    const runGh = options.runGh
    if (!runGh) throw new CliError('--pr requires the GitHub CLI (gh)')
    git(appDir, ['push', '-u', 'origin', branch])
    const url = runGh(
      [
        'pr',
        'create',
        '--draft',
        '--base',
        protectedBranch,
        '--head',
        branch,
        '--title',
        plan.summary,
        '--body',
        prBody(options.prompt, plan),
      ],
      appDir,
    )
    log(`Opened draft PR: ${url}`)
  }

  return { plan, branch, files: written, synced, diffStat }
}

function requireAdminKey(key: string | undefined): string {
  if (!key) throw new CliError('Set FRESHED_ADMIN_KEY to sync drafts to the server')
  return key
}

function readLocalWorkspace(appDir: string, config: AppConfig): Workspace {
  if (!config.workspace) {
    throw new CliError(
      'Pass --server <url> or set "workspace" in freshed.config.json to a workspace JSON file',
    )
  }
  return JSON.parse(readFileSync(join(appDir, config.workspace), 'utf8')) as Workspace
}

export function prBody(prompt: string, plan: GenerationPlan): string {
  return [
    `Generated by **freshed ai** from:`,
    '',
    `> ${prompt}`,
    '',
    `### Summary`,
    plan.summary,
    '',
    plan.newComponents.length ? '### New components' : '',
    ...plan.newComponents.map((c) => `- \`${c.definition.name}\`: ${c.purpose}`),
    '',
    '### Draft screens',
    ...plan.screens.map((s) => `- \`${s.slug}\` (${s.title})`),
    '',
    plan.notes.length ? '### Notes' : '',
    ...plan.notes.map((n) => `- ${n}`),
    '',
    'Screens were saved as drafts. Nothing is published until someone publishes from the Studio.',
  ]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n')
}
