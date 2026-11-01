import { mockProvider, type AdminClient } from '@freshed/ai'
import { brewWorkspace, recordedPlan } from '@freshed/example-brew'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { branchName, CliError, prBody, runAiCommand } from '../src/index.js'

const REGISTRY = `import { Hero } from './components/Hero'
// freshed:imports

export const components = [
  Hero,
  // freshed:components
]
`

let dir: string
const git = (...args: string[]) =>
  execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()

function fakeAdmin() {
  const writes: string[] = []
  const client: AdminClient = {
    workspace: async () => brewWorkspace(),
    putComponent: async (c) => void writes.push(`component:${c.name}`),
    putScreen: async (s) => void writes.push(`screen:${s.slug}`),
    putFlow: async (f) => void writes.push(`flow:${f.slug}`),
  }
  return { client, writes }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'freshed-cli-'))
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'dev@example.com')
  git('config', 'user.name', 'Dev')
  git('config', 'commit.gpgsign', 'false')
  mkdirSync(join(dir, 'src/freshed/components'), { recursive: true })
  writeFileSync(join(dir, 'src/freshed/registry.ts'), REGISTRY)
  writeFileSync(join(dir, 'src/freshed/components/Hero.tsx'), 'export const Hero = {}\n')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
})

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('freshed ai CLI', () => {
  it('writes the component, patches the registry and commits on a new branch', async () => {
    const mainBefore = git('rev-parse', 'main')
    const { client, writes } = fakeAdmin()
    const result = await runAiCommand({
      prompt: 'Add a referral screen',
      appDir: dir,
      provider: mockProvider([recordedPlan]),
      adminClient: client,
    })

    expect(result.branch).toBe(branchName('referral-step'))
    expect(git('rev-parse', '--abbrev-ref', 'HEAD')).toBe('freshed/ai-referral-step')
    // The default branch is untouched.
    expect(git('rev-parse', 'main')).toBe(mainBefore)
    expect(git('status', '--porcelain')).toBe('')

    const component = readFileSync(join(dir, 'src/freshed/components/ReferralCode.tsx'), 'utf8')
    expect(component).toMatch(/export const ReferralCode = defineComponent/)
    const registry = readFileSync(join(dir, 'src/freshed/registry.ts'), 'utf8')
    expect(registry).toContain(`import { ReferralCode } from './components/ReferralCode'`)
    expect(registry).toContain('  ReferralCode,\n  // freshed:components')
    expect(existsSync(join(dir, '.freshed/ai/referral-step.json'))).toBe(true)

    expect(result.files.map((f) => `${f.status} ${f.path}`)).toEqual([
      'added src/freshed/components/ReferralCode.tsx',
      'modified src/freshed/registry.ts',
      'added .freshed/ai/referral-step.json',
    ])
    expect(result.diffStat).toMatch(/3 files changed/)
    expect(git('log', '-1', '--format=%s')).toBe(
      'feat(freshed-ai): Add a referral step at the end of onboarding',
    )

    // Synced as drafts, components first. Nothing published.
    expect(writes).toEqual(['component:ReferralCode', 'screen:referral', 'flow:onboarding'])
  })

  it('never writes to the default branch, even when started from it', async () => {
    const { client } = fakeAdmin()
    await runAiCommand({
      prompt: 'p',
      appDir: dir,
      provider: mockProvider([recordedPlan]),
      adminClient: client,
    })
    expect(git('log', 'main', '--format=%s')).toBe('init')
    expect(git('show', 'main:src/freshed/registry.ts')).toBe(REGISTRY.trim())
  })

  it('picks a fresh branch name when one already exists', async () => {
    git('branch', 'freshed/ai-referral-step')
    const { client } = fakeAdmin()
    const result = await runAiCommand({
      prompt: 'p',
      appDir: dir,
      provider: mockProvider([recordedPlan]),
      adminClient: client,
    })
    expect(result.branch).toBe('freshed/ai-referral-step-2')
  })

  it('refuses to run on a dirty working tree', async () => {
    writeFileSync(join(dir, 'scratch.txt'), 'wip')
    const { client } = fakeAdmin()
    await expect(
      runAiCommand({
        prompt: 'p',
        appDir: dir,
        provider: mockProvider([recordedPlan]),
        adminClient: client,
      }),
    ).rejects.toThrow(CliError)
    expect(git('rev-parse', '--abbrev-ref', 'HEAD')).toBe('main')
  })

  it('dry run touches neither git nor the server', async () => {
    const { client, writes } = fakeAdmin()
    const result = await runAiCommand({
      prompt: 'p',
      appDir: dir,
      provider: mockProvider([recordedPlan]),
      adminClient: client,
      dryRun: true,
    })
    expect(result.branch).toBeNull()
    expect(writes).toEqual([])
    expect(git('rev-parse', '--abbrev-ref', 'HEAD')).toBe('main')
    expect(existsSync(join(dir, 'src/freshed/components/ReferralCode.tsx'))).toBe(false)
  })

  it('does not overwrite an existing component file', async () => {
    writeFileSync(join(dir, 'src/freshed/components/ReferralCode.tsx'), 'mine\n')
    git('add', '.')
    git('commit', '-q', '-m', 'existing')
    const { client } = fakeAdmin()
    await expect(
      runAiCommand({
        prompt: 'p',
        appDir: dir,
        provider: mockProvider([recordedPlan]),
        adminClient: client,
      }),
    ).rejects.toThrow(/already exists/)
    expect(readFileSync(join(dir, 'src/freshed/components/ReferralCode.tsx'), 'utf8')).toBe(
      'mine\n',
    )
  })

  it('--pr opens a draft PR against the default branch via gh', async () => {
    const bare = mkdtempSync(join(tmpdir(), 'freshed-remote-'))
    execFileSync('git', ['init', '-q', '--bare', bare])
    git('remote', 'add', 'origin', bare)
    git('push', '-q', '-u', 'origin', 'main')
    const ghCalls: string[][] = []
    const { client } = fakeAdmin()
    await runAiCommand({
      prompt: 'Add a referral screen',
      appDir: dir,
      provider: mockProvider([recordedPlan]),
      adminClient: client,
      pr: true,
      runGh: (args) => {
        ghCalls.push(args)
        return 'https://github.example/pr/1'
      },
    })
    expect(ghCalls[0]).toEqual(
      expect.arrayContaining([
        'pr',
        'create',
        '--draft',
        '--base',
        'main',
        '--head',
        'freshed/ai-referral-step',
      ]),
    )
    rmSync(bare, { recursive: true, force: true })
  })

  it('PR body says nothing is published', () => {
    const body = prBody('p', recordedPlan as never)
    expect(body).toMatch(/Nothing is published/)
    expect(body).toMatch(/`ReferralCode`/)
  })
})
