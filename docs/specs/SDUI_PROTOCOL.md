# freshed SDUI protocol

Version: **protocol 1**. Source of truth: `packages/schema`. This document explains the rules; the
zod schemas enforce them.

## Principle: data only, never code

A freshed screen is a JSON tree that names components the app **already ships** and gives them
props. The renderer maps each name to a component in the app's registry. Nothing in a payload is
ever evaluated, imported or downloaded as code. Behaviour is expressed as declarative actions that
the app implements.

This keeps freshed inside the rules of the app stores (no remote code), keeps the attack surface
small, and means the worst a bad payload can do is render the wrong copy.

## Objects

### ComponentDefinition

What the CMS knows about a component in the app. No code.

```json
{
  "name": "Button",
  "category": "Input",
  "description": "Primary, secondary or text button that triggers an action.",
  "props": {
    "label": { "type": "string", "required": true, "maxLength": 32 },
    "variant": {
      "type": "enum",
      "values": ["primary", "secondary", "ghost"],
      "default": "primary"
    },
    "action": { "type": "action", "required": true }
  },
  "children": false
}
```

Prop types: `string`, `number`, `boolean`, `enum`, `image` (https URL or `asset:<name>` bundled in
the app), `action`, `string[]`. In app code the same spec is written with the `prop` builder and
`defineComponent`, which infers the component's TypeScript props from it.

### Screen

```json
{
  "slug": "welcome",
  "title": "Welcome",
  "root": {
    "id": "root",
    "type": "Stack",
    "props": { "gap": "lg", "padding": "lg", "grow": true },
    "children": [
      { "id": "hero", "type": "Hero", "props": { "title": "Fresh beans, on your schedule" } },
      {
        "id": "cta",
        "type": "Button",
        "props": { "label": "Get started", "action": { "type": "emit", "event": "next" } }
      }
    ]
  }
}
```

Limits: depth 12, 400 nodes, 100 children per node, slugs `kebab-case`, component names
`PascalCase`.

### Actions

| Type       | Fields            | Meaning                                                          |
| ---------- | ----------------- | ---------------------------------------------------------------- |
| `navigate` | `to`              | Go to a screen by slug                                           |
| `emit`     | `event`           | Emit a named event; inside a flow, an edge decides where it goes |
| `back`     |                   | Go back (flow history first, then the app's navigation)          |
| `dismiss`  |                   | Close the current presentation                                   |
| `openUrl`  | `url`             | `https:`, `mailto:`, `tel:` or an app scheme (`brew://`)         |
| `submit`   | `name`, `event?`  | Hand collected values to the app, optionally emit an event       |
| `copy`     | `text`            | Copy text to the clipboard                                       |
| `share`    | `message`, `url?` | Open the share sheet                                             |

`javascript:`, `data:`, `file:`, `blob:` and plain `http:` URLs are rejected at validation time.
Unhandled actions are a no-op reported to `onAction`, not an error.

### Flow

Screens connected by events. Screens stay reusable because they emit events rather than naming the
next screen.

```json
{
  "slug": "onboarding",
  "title": "Onboarding",
  "start": "welcome",
  "screens": ["welcome", "taste", "cadence", "ready"],
  "edges": [
    { "from": "welcome", "event": "next", "to": "taste" },
    { "from": "ready", "event": "finish", "to": "@end" }
  ]
}
```

`@end` ends the flow and hands control back to the app. Validation rejects edges to unknown screens
and duplicate `(from, event)` pairs, and warns when a screen emits an event the flow does not handle.

### Version

An immutable snapshot of all components, screens and flows at publish time, with a monotonic
`number`, the `protocol` it was written with, a message, author and a content `hash`.

## Versioning and compatibility

- `PROTOCOL_VERSION` is an integer. It increases only when an older renderer **cannot** read the
  new format. Additive changes (an optional field, a new component, a new action an older renderer
  ignores) do not bump it.
- Renderers send `Freshed-Protocol: <n>` on every request. A missing header means 1.
- The server answers with the newest published version whose `protocol <= n`. A build from two
  years ago keeps receiving the last content it can read.
- Renderers reject payloads with a higher protocol (`UnsupportedProtocolError`) and keep showing
  their last good copy.
- Component evolution: add props as optional with defaults. To change a prop's meaning, add a new
  prop or a new component (`HeroV2`) and keep the old one registered until old builds age out.

## Publishing and rollback

- Drafts are freely editable and never served to apps.
- Publishing validates every screen against the registry and every flow against the screens. Any
  error blocks publishing; warnings do not.
- Publishing identical content is a no-op that returns the current version.
- Rollback publishes a **copy** of an older version as a new version and resets drafts to match.
  History only grows. A database trigger rejects `UPDATE` and `DELETE` on `versions`.

## Caching

- Public reads return a weak ETag derived from the version hash, version number and resource.
  `Cache-Control: no-cache` means "revalidate every time"; a matching `If-None-Match` gets a `304`
  with no body.
- Responses vary on `Authorization` and `Freshed-Protocol`.
- The client stores every good payload as the **last good copy** (AsyncStorage in apps). When the
  network fails, times out, returns 5xx, returns an invalid body or a newer protocol, the last good
  copy is rendered instead. A `404` is not masked: unpublished content stays unpublished.
- Flows are fetched in one request with all of their screens, so a flow never renders half-loaded.

## Fallback behaviour

| Situation                    | Renderer behaviour                                          |
| ---------------------------- | ----------------------------------------------------------- |
| Unknown component            | Fallback node (nothing in production, a visible box in dev) |
| Invalid prop value           | Dropped; default used if the spec has one; warning reported |
| Missing required prop        | Rendered anyway; warning reported; the component decides    |
| Children on a leaf component | Ignored with a warning                                      |
| Tree deeper than the limit   | Subtree replaced by a fallback                              |
| Invalid action               | Not bound; the control does nothing                         |
| Unhandled action             | No-op, reported to `onAction`                               |

## Security

- API keys: `fr_pub_*` keys can only read published content and are safe to ship in apps.
  `fr_admin_*` keys can edit drafts and publish; keep them server-side or in the Studio session.
  Keys are stored as SHA-256 hashes; the plaintext is shown once.
- Payloads are validated on write (server) and on read (client). Size and depth limits bound the
  cost of rendering.
- URLs in `openUrl` and images are allow-listed by scheme.
- CORS for the admin API is limited to configured Studio origins.
