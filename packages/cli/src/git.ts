import { execFileSync } from 'node:child_process'

/**
 * Thin git wrapper. Uses execFile (no shell), so prompts and slugs can never
 * be interpreted as shell syntax.
 */
export function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

export function isGitRepo(cwd: string): boolean {
  try {
    return git(cwd, ['rev-parse', '--is-inside-work-tree']) === 'true'
  } catch {
    return false
  }
}

export function currentBranch(cwd: string): string {
  return git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
}

/**
 * The default branch: origin/HEAD when a remote exists, otherwise the
 * first of main/master that exists locally, otherwise the current branch.
 */
export function defaultBranch(cwd: string): string {
  try {
    const ref = git(cwd, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'])
    return ref.replace(/^refs\/remotes\/origin\//, '')
  } catch {
    // no remote HEAD
  }
  for (const name of ['main', 'master']) {
    try {
      git(cwd, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`])
      return name
    } catch {
      // try next
    }
  }
  return currentBranch(cwd)
}

export function isClean(cwd: string): boolean {
  return git(cwd, ['status', '--porcelain']) === ''
}

export function branchExists(cwd: string, name: string): boolean {
  try {
    git(cwd, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`])
    return true
  } catch {
    return false
  }
}
