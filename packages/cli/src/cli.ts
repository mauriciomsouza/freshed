#!/usr/bin/env node
import { providerFromEnv } from '@freshed/ai'
import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { CliError, runAiCommand } from './ai-command.js'

const HELP = `freshed ai: one prompt in, draft screens and app components out.

Usage
  freshed ai "<prompt>" [--app ./] [--server <url>] [--pr] [--dry-run]

Options
  --app <dir>       App root (default: current directory)
  --server <url>    freshed server; reads the workspace and syncs drafts to it
  --pr              Push the branch and open a draft PR with the GitHub CLI
  --dry-run         Show the plan only; do not touch git or the server
  -h, --help        Show this help

Environment
  FRESHED_AI_KEY        Your LLM API key (required; never stored by freshed)
  FRESHED_AI_PROVIDER   anthropic (default) | openai-compatible
  FRESHED_AI_MODEL      Model name (optional for anthropic)
  FRESHED_AI_BASE_URL   Custom endpoint (optional)
  FRESHED_ADMIN_KEY     freshed admin key, required with --server

Guarantees
  Works on a new branch (freshed/ai-<slug>), never on the default branch.
  Never runs generated code. Never publishes: screens are saved as drafts.
`

async function main(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      app: { type: 'string', default: '.' },
      server: { type: 'string' },
      pr: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })
  const [command, ...rest] = positionals
  if (values.help || command !== 'ai' || !rest.length) {
    console.log(HELP)
    process.exit(values.help ? 0 : 1)
  }

  const provider = providerFromEnv(process.env)
  if (!provider) throw new CliError('Set FRESHED_AI_KEY to your LLM API key (bring your own key).')

  const result = await runAiCommand({
    prompt: rest.join(' '),
    appDir: values.app,
    server: values.server,
    adminKey: process.env.FRESHED_ADMIN_KEY,
    provider,
    pr: values.pr,
    dryRun: values['dry-run'],
    log: (line) => console.log(line),
    runGh: (args, cwd) => execFileSync('gh', args, { cwd, encoding: 'utf8' }).trim(),
  })

  console.log('')
  console.log(`  ${result.plan.summary}`)
  for (const f of result.files) console.log(`  ${f.status === 'added' ? 'A' : 'M'}  ${f.path}`)
  for (const s of result.plan.screens) console.log(`  draft screen  ${s.slug}`)
  for (const n of result.plan.notes) console.log(`  note: ${n}`)
  if (result.branch)
    console.log(
      `\n  Review on branch ${result.branch}. Publish the drafts from the Studio when ready.`,
    )
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof CliError ? `freshed: ${error.message}` : error)
  process.exit(1)
})
