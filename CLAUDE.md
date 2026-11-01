# CLAUDE.md

Rules for every agent (and human) working in this repository. Read this first.

## What freshed is

freshed is a small, self-hosted CMS for server-driven UI in Expo and React Native apps. Teams register
the components their app already ships, compose screens and flows from them in the Studio, and
publish versioned JSON that the app renders at runtime. Copy changes, new onboarding steps and promo
screens ship without a store release. **freshed ai** turns one prompt into draft screens and, when
needed, the matching component code on a review branch.

## Source of truth

| Topic                             | Where                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| Protocol, schemas, versioning     | `packages/schema` + [docs/specs/SDUI_PROTOCOL.md](docs/specs/SDUI_PROTOCOL.md)           |
| AI connector behaviour and limits | `packages/ai`, `packages/cli` + [docs/specs/AI_CONNECTOR.md](docs/specs/AI_CONNECTOR.md) |
| Renderer behaviour                | `packages/react-native` (core is pure and tested)                                        |
| Server, persistence, API          | `apps/server` (migrations in `apps/server/migrations`)                                   |
| Studio UI and visual system       | `apps/studio` + [docs/design/DESIGN_SPEC.md](docs/design/DESIGN_SPEC.md)                 |
| Stack choices and trade-offs      | [docs/STACK.md](docs/STACK.md)                                                           |
| Plan, phases, gates, risks        | [docs/PLAN.md](docs/PLAN.md)                                                             |
| Positioning and sustainability    | [docs/business/BUSINESS.md](docs/business/BUSINESS.md)                                   |
| Launch plan and copy              | [docs/marketing/LAUNCH.md](docs/marketing/LAUNCH.md)                                     |
| Who does what                     | [docs/AGENT_TEAM.md](docs/AGENT_TEAM.md) and `.claude/agents/`                           |
| Example content (fictional)       | `examples/brew`                                                                          |

If code and docs disagree, the code plus its tests win, and the doc gets fixed in the same change.

## Inviolable rules

1. **SDUI is data only.** Screens reference components that already exist in the app bundle. Never
   ship, evaluate or download code at runtime: no `eval`, no remote JS, no WebViews as a backdoor.
   Actions are declarative (`navigate`, `emit`, `openUrl`, ...) and the app implements them.
2. **Old app versions must keep working.** Any wire-format change that an older renderer cannot read
   bumps `PROTOCOL_VERSION`. The server never serves a payload newer than the client's protocol.
   Unknown components and invalid props degrade gracefully; they never crash a screen.
3. **Published versions are immutable.** Rollback publishes a copy of an older version. Never edit or
   delete a row in `versions` (a database trigger enforces this; do not remove it).
4. **No secrets in the repo.** No API keys, tokens, passwords or `.env` files. Use `.env.example`
   with placeholders.
5. **LLM keys belong to the user.** freshed never persists a user's LLM key server-side, never logs
   it and never commits it. In the Studio it lives in memory or `sessionStorage` only and is sent
   only to the provider the user picked. Server-side generation reads its key from server env only.
6. **AI output is data, validated by schema.** Model output is parsed with the zod schemas and
   checked against the registry. Invalid output is repaired once or rejected, never guessed at.
7. **AI only creates drafts and branches. Humans publish and merge.** No code path lets AI publish a
   version, push to a default branch or merge a PR. Generated code is written for review and never
   executed by freshed.
8. **Fictional data only.** Examples, seeds, screenshots and docs use invented brands and people
   (the Brew coffee app). No real companies, customers or personal data.
9. **Accessibility is part of the component contract.** Images require alt text, buttons have
   labels and roles, touch targets are at least 44pt, text meets WCAG AA contrast, and the Studio
   is keyboard navigable with visible focus.

## How to work

- **Tests before "done".** A change is done when `pnpm typecheck && pnpm lint && pnpm test` pass and
  the Studio builds. New behaviour comes with tests; bugs come with a failing test first.
- **Independent review.** Whoever implements a change does not approve it. Dev implements, QA
  verifies against the spec and acceptance criteria, Release merges.
- **Small commits.** One logical change per commit, conventional commit messages
  (`feat(server): ...`, `fix(studio): ...`, `docs: ...`).
- **Every UI change produces screenshots sent to the owner.** Run
  `pnpm --filter @freshed/studio build:pages && pnpm screenshots`, look at every PNG, and attach
  them to the change. Light and dark for anything visual.
- **Verify the demo.** `node scripts/verify-pages.mjs` must pass before a Studio change merges.
- **Keep the core pure.** Renderer logic lives in `packages/react-native/src/core` and stays free of
  React Native imports so it can be unit tested.
- **Ask the owner** for anything listed in "Points that require the human owner" in
  [docs/AGENT_TEAM.md](docs/AGENT_TEAM.md).

## Commands

```bash
pnpm install
pnpm dev                     # Studio on http://localhost:5173 (demo mode)
pnpm dev:server              # API on http://localhost:8787 (embedded PGlite)
pnpm test                    # all packages
pnpm --filter @freshed/studio build:pages && node scripts/verify-pages.mjs
pnpm screenshots             # refresh docs/design/screens
```
