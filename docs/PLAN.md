# Plan

## Phases

### Phase 0: Protocol (done)

- Schemas for components, screens, actions, flows and versions; validation against a registry.
- Protocol versioning rules and compatibility helpers.
- **Gate:** schema tests green; the Brew example content validates with zero warnings.

### Phase 1: Render and publish (done)

- `@freshed/react-native`: registry, tree resolution with fallbacks, actions, flows, ETag +
  last-good cache, `defineComponent`, `FreshedProvider`, `FreshedScreen`, `useFlow`.
- Server: drafts CRUD, publish, rollback, immutable versions, protocol-aware public reads, API
  keys, SQL migrations, PGlite tests, Docker Compose.
- Expo example app consuming the Brew onboarding.
- **Gate:** server tests cover publish, rollback, ETag/304 and protocol selection; renderer core
  tests cover fallback and caching; Expo app typechecks.

### Phase 2: Studio and demo (done)

- Studio: components, screens (tree + JSON), flows (graph + click-through), playground, publish and
  history, light and dark.
- Demo mode on GitHub Pages; hash routing; localStorage persistence.
- **Gate:** `verify-pages` passes; screenshots reviewed in both themes.

### Phase 3: freshed ai (done, v0.1)

- Provider-agnostic core (Anthropic, OpenAI-compatible), schema-constrained generation with one
  repair, component codegen, registry patching, draft sync.
- CLI on a review branch, Studio panel with BYO key and a pre-recorded example, server endpoint.
- **Gate:** mocked-provider tests for every guarantee in AI_CONNECTOR.md; CLI tests on a temp git
  repo prove the default branch is never written.

### Phase 4: Team use (next)

- Studio auth (sessions instead of a build-time admin key), roles (editor, publisher).
- Scheduled publishes and staged rollouts (percentage of installs per version).
- Screen-level analytics hooks (`onAction` → your analytics), A/B variants as data.
- Input components and `submit` collection (forms) with validation in the spec.
- **Gate:** a design partner team runs it in production for a month.

### Phase 5: Ecosystem

- Published npm packages with provenance; `create-freshed` starter.
- Component spec extraction from existing app code (TypeScript AST) for faster onboarding.
- Web renderer package for React DOM apps reusing the same protocol.

## Risks

| Risk                                            | Likelihood | Impact | Mitigation                                                                     |
| ----------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------ |
| Store review concerns about server-driven UI    | Low        | High   | Data only, no remote code, components ship in the binary; documented clearly   |
| Old app builds break on new content             | Medium     | High   | Protocol header, server-side version selection, fallbacks, compat tests        |
| Bad content reaches users                       | Medium     | Medium | Validation blocks publish; instant rollback; immutable history                 |
| AI produces plausible but wrong screens or code | High       | Medium | Schema + registry validation, one repair, drafts and branches only, review     |
| LLM key leakage in the browser                  | Medium     | High   | Session-only storage, direct-to-provider calls, clear copy, server option      |
| Studio preview drifts from the device           | Medium     | Medium | Same renderer and components via react-native-web; device check before publish |
| Scope creep into a full app builder             | Medium     | Medium | Non-goals in specs; owner approves new surface area                            |
| Maintenance burden for a solo maintainer        | High       | Medium | Small core, boring stack, tests that do not need infrastructure                |
