# freshed ai

One prompt in. Draft screens in the CMS and, when needed, the matching component in the app repo,
wired together. Bring your own LLM key. Nothing publishes or merges without a human.

> "Add a referral screen at the end of onboarding with a code to copy and a share button"

produces:

- a draft screen `referral` built from registered components (Hero, Button, Spacer);
- flow edge changes: `ready --finish--> referral`, `referral --done--> @end`;
- a new component `ReferralCode` (props: `label`, `code`, `copy`) because nothing registered can
  show a copyable code;
- on a new branch `freshed/ai-referral-step`: `src/freshed/components/ReferralCode.tsx` written with
  `defineComponent`, and the registry file patched to include it;
- the component definition synced to the CMS so the draft screen validates.

## Architecture

```
            prompt + workspace (registry, screens, flows)
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ packages/ai                                              │
│  buildSystemPrompt ─► Provider.generate (forced tool call)│
│          ▲                     │ raw tool input           │
│          │ issues              ▼                          │
│          └──── repair once ◄── GenerationPlan.safeParse   │
│                                + checkPlan (registry,     │
│                                  flows, code guard)       │
│                                │ valid plan               │
│                                ▼                          │
│                    applyPlan (pure) ─► drafts             │
│                    componentFile, patchRegistry ─► files  │
└───────────────┬──────────────────────────┬───────────────┘
                │                          │
     Studio / server: save drafts   CLI: branch, write, commit,
     (never publish)                sync drafts, optional draft PR
```

### Provider-agnostic core

`Provider` is one method: `generate({ system, messages, tool })` returning the tool input. Adapters
use `fetch` only, so the same code runs in Node and in the browser.

| Adapter               | Structured output mechanism                                     |
| --------------------- | --------------------------------------------------------------- |
| `anthropic` (default) | Messages API, `tools` + `tool_choice: { type: "tool", name }`   |
| `openai-compatible`   | Chat Completions, `tools` + `tool_choice: { type: "function" }` |
| `mock`                | Replays canned outputs; used by tests and the demo recording    |

Configuration: `FRESHED_AI_KEY` (required), `FRESHED_AI_PROVIDER` (`anthropic` default),
`FRESHED_AI_MODEL` (Anthropic default `claude-sonnet-5`; required for OpenAI-compatible),
`FRESHED_AI_BASE_URL` (optional). The default model is a constant you can override; pick whatever
current model your provider recommends for tool use.

### Constrained by the schema

The tool's input schema is generated from the zod `GenerationPlan` schema
(`z.toJSONSchema`), which itself is built from the protocol schemas (`Screen`, `ComponentDefinition`,
`FlowEdge`). There is one source of truth: the model is asked for exactly the shape the server and
renderer accept.

Constraining the shape is not enough, so every answer is checked:

1. `GenerationPlan.safeParse` (structure, slugs, URL schemes, size limits).
2. `checkPlan`: every screen validates against the registry **plus** the proposed new components;
   new components do not redefine registered ones; flow edges reference existing flows and screens;
   the resulting flows validate.
3. If anything fails, the issues are sent back to the model once
   ("That plan is invalid. Fix every issue below..."). If the second answer still fails, the result
   is `{ ok: false, issues }`. freshed never patches model output by guessing.

### App-side code generation

- `componentFile` writes a `defineComponent` file with the props spec rendered as `prop.*` calls,
  so the component's TypeScript props are inferred from the same spec the CMS stores.
- The model may suggest a JSX body. It is used only if it passes a conservative static guard:
  only `View`, `Text`, `Pressable`, `Image`; no imports, `require`, `eval`, `fetch`, timers, globals
  or template literals. Otherwise a deterministic, accessible scaffold is generated from the spec.
- `patchRegistry` adds the import and the registry entry between two marker comments
  (`// freshed:imports`, `// freshed:components`). Markers make the edit predictable and reviewable.
- freshed never imports, evaluates or runs generated code. It is text on a branch for a human.

## Surfaces

### CLI

```bash
export FRESHED_AI_KEY=sk-ant-...          # your key
export FRESHED_ADMIN_KEY=fr_admin_...     # to sync drafts
npx freshed ai "Add a referral screen after checkout with a code to copy and a share button" \
  --app ./ --server https://cms.example.com [--pr] [--dry-run]
```

1. Refuses to run on a dirty working tree.
2. Reads the workspace from the server (or a local JSON snapshot via `freshed.config.json`).
3. Generates and validates the plan.
4. Creates `freshed/ai-<slug>` from the current HEAD (suffixes `-2`, `-3` if taken). Refuses if the
   target equals the default branch.
5. Writes component files (refuses to overwrite), patches the registry, saves the plan to
   `.freshed/ai/<slug>.json`, and commits on the new branch.
6. Prints a diff summary. Syncs component definitions, then draft screens, then flows. **Never
   publishes.**
7. `--pr` pushes the branch and opens a **draft** PR with `gh`. Git and gh are invoked with
   `execFile`, never a shell.

App config (`freshed.config.json`): `registry`, `componentsDir`, optional `workspace` and
`context` (design guidance passed to the model).

### Studio panel

- Prompt, provider, model, and key fields. The key is kept in component state and
  `sessionStorage` (wrapped in try/catch; cleared when the tab closes). It is sent only to the
  provider's API, directly from the browser. It is never sent to a freshed server, never logged and
  never written to `localStorage`.
- Anthropic requires an explicit opt-in header for browser calls:
  `anthropic-dangerous-direct-browser-access: true`. The Studio sets it only in browser mode. The
  name is deliberate: a key in a browser can be read by anything running on that page. Use your own
  key on your own machine, or use the server endpoint for shared setups.
- The result shows the CMS drafts (screens, edges, components), a live preview rendered with the
  app's components, and a diff of the files the CLI would write. "Save as draft" stores the drafts;
  publishing remains a separate action on the Publish page.
- Without a key, the panel stays usable: "Show an example" replays a pre-recorded generation for
  Brew through the mock provider, with the same validation and preview.

### Server endpoint

`POST /v1/ai/generate` with an admin key and `{ "prompt": "...", "save": true }`.

- The provider key comes from the server environment only (`FRESHED_AI_KEY`); there is no way to
  send a key in the request. Without it the endpoint returns `501`.
- Valid plans are saved as drafts (`save: false` returns the plan only). The response always says
  `"published": false`.
- The endpoint does not write app code. Component definitions are stored so drafts validate; the
  implementation still has to land in the app through the CLI or by hand.

## Guarantees and tests

| Guarantee                                              | Test                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| Tool schema is derived from zod and the tool is forced | `packages/ai/test/ai.test.ts` (schema-constrained generation)  |
| Invalid output is repaired once, then rejected         | `repairs invalid output once`, `fails with issues`             |
| Component definitions sync before screens; no publish  | `component sync to the CMS`                                    |
| Generated code passes or is replaced by a scaffold     | `uses a suggested body only when it passes the static guard`   |
| CLI writes on a new branch and commits there           | `packages/cli/test/cli.test.ts` (temp git repo)                |
| CLI never writes to the default branch                 | `never writes to the default branch`                           |
| CLI refuses dirty trees and existing files             | `refuses to run on a dirty working tree`, `does not overwrite` |
| Server endpoint creates drafts, never publishes        | `apps/server/test/server.test.ts` (`POST /v1/ai/generate`)     |
| Keys are redacted from provider errors                 | `redacts keys from provider error messages`                    |

All tests use the mock provider or a mocked `fetch`. None touch the network.

## Non-goals

- Running or hot-loading generated code. Ever.
- Auto-publishing, auto-merging, or pushing to a default branch.
- Storing users' LLM keys on a freshed server.
- Generating whole apps. freshed ai works inside an existing registry and design system.
