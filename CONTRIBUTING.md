# Contributing

Thanks for helping. freshed is small on purpose; the best contributions keep it that way.

## Setup

```bash
corepack enable
pnpm install
pnpm test
pnpm dev            # Studio in demo mode on http://localhost:5173
pnpm dev:server     # API on http://localhost:8787 with embedded Postgres (PGlite)
```

Node 22 and pnpm 10. Tests need no Docker and no network.

## Before you open a PR

1. Read [CLAUDE.md](CLAUDE.md). The inviolable rules apply to humans too: data only, old app
   versions keep working, published versions are immutable, no secrets, fictional data, accessible
   components, and AI only creates drafts and branches.
2. `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` pass.
3. New behaviour has tests. Bug fixes start with a failing test.
4. UI changes: `pnpm --filter @freshed/studio build:pages && node scripts/verify-pages.mjs`, then
   `pnpm screenshots`, look at the PNGs (light and dark) and include them in the PR.
5. If you change the wire format, read the versioning section of
   [SDUI_PROTOCOL.md](docs/specs/SDUI_PROTOCOL.md) first and say in the PR whether older renderers
   can still read it.
6. Docs change in the same PR as behaviour.

## Commits

Small, conventional commits: `feat(server): ...`, `fix(studio): ...`, `docs: ...`, `test: ...`.

## Review

Someone other than the author approves every change. AI-generated code is welcome and gets the same
review as any other code.

## Reporting security issues

Please do not open a public issue. Email the maintainer listed on the GitHub profile with details
and steps to reproduce.
