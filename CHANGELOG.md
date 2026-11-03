# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the packages follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Studio: device preview with presets for iOS and Android phones and tablets, an aspect ratio
  selector, custom width and height in points, portrait and landscape, Fit or 100% zoom, and
  safe-area insets with optional guides. Screens lay out at the device's real logical size.
- Studio: layers panel in the screen editor and the playground. Drag layers to reorder and nest
  them, drag components in from a palette, and change a layer's level with the toolbar or
  Alt+arrow keys. The playground's layers edit its JSON.

### Fixed

- Brew example: a `List` without `items` no longer crashes the screen; it renders nothing, and an
  `Image` without `src` shows placeholder art.
- Studio: a component that fails to render now shows a message inside the preview device instead
  of blanking the whole Studio, and components added from the palette start with placeholder
  values for their required props.

## [0.1.0] - 2026-11-01

### Added

- `@freshed-cms/schema`: components, screens, actions, flows and versions as zod schemas; validation
  against a registry; protocol versioning (protocol 1); stable hashing and snapshot diffs.
- `@freshed-cms/react-native`: `FreshedProvider`, `FreshedScreen`, `FreshedFlow`, `useFlow`,
  `defineComponent` with props inferred from the spec, fallbacks for unknown components and
  invalid props, ETag revalidation and a last-good cache.
- Server: drafts CRUD, publish, rollback, immutable versions (enforced by a database trigger),
  protocol-aware public reads with ETag/304, hashed API keys, SQL migrations, Docker Compose.
- Studio: components, screens (tree and JSON) with live preview, flow graph with click-through,
  playground, publish and version history with rollback, light and dark themes.
- Demo mode and GitHub Pages deployment of the Studio.
- freshed ai: provider-agnostic generation (Anthropic, OpenAI-compatible) constrained by the
  schema with one repair turn; Studio panel with bring-your-own key; `npx @freshed-cms/cli ai` CLI that
  writes components on a review branch and syncs drafts; `POST /v1/ai/generate`.
- Brew example: fictional coffee subscription app with an onboarding flow and a promo screen.
