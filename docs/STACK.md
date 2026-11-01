# Stack

Choices, the reason for each, and what we gave up.

| Area           | Choice                                                       | Why                                                                                              | Trade-off                                                                                      |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Language       | TypeScript (strict, `noUncheckedIndexedAccess`)              | One language from schema to app to server; types flow from the schema                            | Build step for publishing packages                                                             |
| Monorepo       | pnpm workspaces                                              | Fast, strict dependency isolation, good for publishing several packages                          | Expo/Metro needs the workspace-aware config (supported since SDK 52)                           |
| Schemas        | zod 4                                                        | Runtime validation and static types from one definition; `z.toJSONSchema` feeds LLM tool schemas | Larger than hand-written validators                                                            |
| Renderer       | `@freshed/react-native`, pure core + thin React bindings     | Core (resolve, actions, flows, cache) is unit-tested without a device                            | Two layers to understand                                                                       |
| Server         | Hono on Node 22                                              | Small, typed, fetch-native; `app.request()` makes route tests trivial                            | Fewer batteries than larger frameworks                                                         |
| Database       | Postgres via `pg`, plain SQL migrations                      | JSONB for screen trees, transactions and a trigger for immutable versions; no ORM magic          | Hand-written SQL                                                                               |
| Test database  | PGlite (`@electric-sql/pglite`)                              | Real Postgres (WASM) in-process: the same SQL and trigger run in tests, no Docker in CI          | Slower start than mocks (~1 s per test file setup)                                             |
| Studio         | React 19 + Vite 8                                            | Fast dev loop, static build that runs on GitHub Pages                                            | No SSR (not needed)                                                                            |
| Studio preview | `react-native` aliased to `react-native-web`                 | The preview runs the **same** renderer package and the **same** app components as the Expo app   | App components must avoid native-only modules, or provide `.web` files                         |
| Routing        | Hash routing                                                 | Deep links work on GitHub Pages without rewrites                                                 | `#/` in URLs                                                                                   |
| Demo data      | In-browser backend with the same rules as the server         | The public demo needs no server and leaks nothing; data stays in `localStorage`                  | Publishing rules are implemented twice (shared helpers in `@freshed/schema` keep them aligned) |
| AI             | `@freshed/ai`, fetch-based provider adapters                 | Same code in CLI, server and browser; no SDK lock-in; trivial to mock                            | We maintain two small adapters                                                                 |
| CLI            | Node `parseArgs`, `execFile` for git/gh                      | No dependencies, no shell injection surface                                                      | Minimal UX niceties                                                                            |
| Tests          | Vitest                                                       | Fast, TS-native, same runner everywhere                                                          | -                                                                                              |
| Lint/format    | ESLint 9 flat config + typescript-eslint, Prettier           | Standard, boring, reliable                                                                       | -                                                                                              |
| E2E checks     | Playwright (`playwright-core`) with system Chrome            | Screenshots and the Pages verification run the real build                                        | Needs Chrome locally                                                                           |
| Fonts (Studio) | Instrument Sans, JetBrains Mono (self-hosted via Fontsource) | Precise, slightly warm grotesk; no third-party font requests                                     | ~100 KB of woff2                                                                               |

## The preview decision

The brief allowed a "faithful web renderer of the same registry" if react-native-web proved too
heavy. It did not: the Studio bundle is about 160 KB gzipped including React Native Web, and the
alias is two lines of Vite config. The payoff is large: what you see in the Studio is the app's own
`Hero`, `Card` and `Button` rendered by `@freshed/react-native`, so there is no second
implementation to drift. The example app's components avoid native-only modules for this reason;
illustrations are drawn with `View`s instead of an SVG library.

## The AI decision

- **Forced tool calls over free-text JSON.** Both Anthropic and OpenAI-compatible APIs support a
  forced tool call with a JSON Schema. It is the most reliable way to get structured output across
  providers, and the schema comes from zod, so the server and the model agree by construction.
- **Validate after constraining.** Providers do not all enforce every JSON Schema keyword, and
  structure is not semantics. Output is always parsed with zod and checked against the registry,
  with one repair turn.
- **BYO key, three surfaces.** CLI (env), Studio (browser, session only), server (env, for teams
  who prefer a shared key). No key is ever stored by freshed.
- **Codegen is deterministic by default.** A suggested body is accepted only through a strict
  static guard; otherwise the scaffold is generated from the spec. Review is easier when output is
  predictable.

## Versions

Node 22, pnpm 10, TypeScript 5.9, React 19.3, React Native 0.88 / Expo SDK 58, react-native-web
0.21, Vite 8, Vitest 5, Hono 4, zod 4, PGlite 0.5.
