# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the packages follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-01

### Added

- `@freshed/schema`: components, screens, actions, flows and versions as zod schemas; validation
  against a registry; protocol versioning (protocol 1); stable hashing and snapshot diffs.
- `@freshed/react-native`: `FreshedProvider`, `FreshedScreen`, `FreshedFlow`, `useFlow`,
  `defineComponent` with props inferred from the spec, fallbacks for unknown components and
  invalid props, ETag revalidation and a last-good cache.
- Server: drafts CRUD, publish, rollback, immutable versions (enforced by a database trigger),
  protocol-aware public reads with ETag/304, hashed API keys, SQL migrations, Docker Compose.
- Studio: components, screens (tree and JSON) with live preview, flow graph with click-through,
  playground, publish and version history with rollback, light and dark themes.
- Demo mode and GitHub Pages deployment of the Studio.
- freshed ai: provider-agnostic generation (Anthropic, OpenAI-compatible) constrained by the
  schema with one repair turn; Studio panel with bring-your-own key; `npx freshed ai` CLI that
  writes components on a review branch and syncs drafts; `POST /v1/ai/generate`.
- Brew example: fictional coffee subscription app with an onboarding flow and a promo screen.
