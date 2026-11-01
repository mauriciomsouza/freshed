# Launch

## Goal

Get freshed in front of React Native and Expo developers, collect design partners, and make the
live demo the first thing people try.

- Live demo: https://mauriciomsouza.github.io/freshed/
- Repo: https://github.com/mauriciomsouza/freshed

## Plan

| When     | What                                                                                                | Owner           |
| -------- | --------------------------------------------------------------------------------------------------- | --------------- |
| T−7 days | Freeze v0.1, verify Pages demo, record a 60 s screen capture of the AI panel and flow click-through | Release, Design |
| T−3      | Publish packages to npm (owner approval), tag v0.1.0                                                | Release         |
| T−1      | Final README pass, screenshots current, drafts below reviewed                                       | Marketing       |
| T0 am    | Show HN post; X and LinkedIn thread                                                                 | Owner           |
| T0       | Answer every comment for the first 6 hours; log questions as issues                                 | Owner, Dev      |
| T+2      | Product Hunt                                                                                        | Owner           |
| T+7      | Write-up: what people asked, what we are changing                                                   | Marketing       |

Demo script (60 s): open the demo → Flows → click through onboarding in the phone → Generate with
AI → Show an example → Save as draft → Flows shows the new step → Publish → roll back.

## Drafts

### Show HN

**Title:** Show HN: freshed – ship new screens to your Expo app without a store release

I build product UI, and the slowest part of most mobile work I have seen is not the code; it is
waiting. A new onboarding step or a promo means a build, store review and users updating.

freshed is a small, self-hosted CMS for server-driven UI in Expo / React Native. You register the
components your app already ships (typed, with a props spec), compose screens and flows from them
in a Studio, and publish versioned JSON. The app renders it with a small renderer package.

A few decisions I cared about:

- Data only. Screens reference components in the app bundle. No remote code, no eval.
  Unknown components fall back instead of crashing.
- Old builds keep working. Clients send a protocol version; the server serves the newest
  published version they can read.
- Published versions are immutable. Rollback publishes a copy of an older version (a Postgres
  trigger enforces it).
- The Studio preview runs the same renderer and the same app components through
  react-native-web, so the preview is the app, not a mock.

It also has freshed ai: one prompt ("add a referral screen after onboarding with a code to copy
and a share button") creates draft screens in the CMS and, if the app is missing a component,
writes it on a new git branch with `defineComponent` and syncs its props spec to the CMS. Bring
your own key. Output is validated against the schema and repaired once or rejected. It never
publishes and never touches your default branch.

Live demo (runs in your browser, no signup): https://mauriciomsouza.github.io/freshed/
Code (MIT): https://github.com/mauriciomsouza/freshed

Stack: TypeScript, zod, Hono, Postgres (PGlite in tests), React + Vite, react-native-web.
I would love feedback on the protocol and the compatibility model in particular.

### X / LinkedIn thread

1/ I built freshed: ship new screens to your Expo app without a store release.
Self-hosted, typed, MIT. Live demo runs in your browser: https://mauriciomsouza.github.io/freshed/

2/ The idea is server-driven UI without the scary parts. You register components your app already
has. The CMS composes screens from them. The app receives data, never code.

3/ Old app builds keep working. Every request carries a protocol version and the server only sends
what that build can read. Unknown components fall back. Bad publish? Roll back in one click.
History is append-only.

4/ The preview in the Studio is not a mock. It is your app's components, rendered by the same
renderer, through react-native-web. Click through a whole onboarding flow in the browser.

5/ freshed ai: one prompt → draft screens in the CMS + the missing component on a git branch,
wired together. Your key, validated by schema, repaired once or rejected. Humans publish and merge.

6/ How it was built: a small agent team (business, design, dev, QA, infra, release, marketing)
with one rule that matters most: whoever implements doesn't approve. Write-up in the repo.
https://github.com/mauriciomsouza/freshed

### Product Hunt

- **Name:** freshed
- **Tagline:** Ship new screens to your Expo app without a store release
- **Description:** freshed is a self-hosted CMS for server-driven UI in Expo and React Native.
  Register your app's components, compose screens and flows in a visual Studio with a live preview,
  and publish versioned JSON your app renders instantly. Old app builds keep working, every version
  is immutable, and rollback is one click. freshed ai turns one prompt into draft screens plus any
  missing component on a review branch, using your own LLM key. Open source, MIT.
- **First comment:** Hi Product Hunt. I made freshed because copy and onboarding changes in mobile
  apps take a release cycle they do not deserve. The demo runs entirely in your browser with a
  fictional coffee app, so you can click through the onboarding, edit it, publish and roll back
  without signing up. If you try freshed ai, the key stays in your browser tab. I would love to
  hear which screens you would move to the server first.
- **Gallery:** `docs/design/screens/screens-editor.png`, `flow-graph.png`, `ai-panel.png`,
  `version-history.png`, `screens-editor-dark.png`.
