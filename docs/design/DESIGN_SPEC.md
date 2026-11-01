# Lightbox: the freshed Studio visual system

The Studio is a workbench for someone else's app. Its job is to make the app preview the most vivid
thing on screen and to make state (draft, live, invalid) unmistakable. The name comes from the
photographer's light table: a quiet, evenly lit surface you lay work on to judge it.

## Principles

1. **The app carries the color.** Studio chrome is cool neutral. The only saturated pixels besides
   state are the app preview and the signal hue.
2. **State before decoration.** Amber means draft, green means live, red means blocked. These hues
   are never used for anything else.
3. **One signal.** Ultramarine marks selection, focus and the primary action on a page. There is at
   most one primary button per view.
4. **The real thing, not a mock.** Previews render the app's own components with the app's renderer.
5. **Dense, not cramped.** 13.5 px base text, 4 px grid, columns that align across views.

## Tokens

### Color

| Token      | Light     | Dark      | Use                                   |
| ---------- | --------- | --------- | ------------------------------------- |
| `--bg`     | `#f7f7f8` | `#101013` | App background, sidebar               |
| `--panel`  | `#ffffff` | `#16161a` | Columns, editors                      |
| `--sunken` | `#f1f1f3` | `#1d1d22` | Hover, inactive segments              |
| `--line`   | `#e6e6ea` | `#26262d` | Dividers                              |
| `--text`   | `#17171c` | `#ececf0` | Primary text                          |
| `--text-2` | `#55555f` | `#a4a4ae` | Secondary text                        |
| `--text-3` | `#8b8b96` | `#6f6f7a` | Hints, metadata                       |
| `--signal` | `#3346d3` | `#7f8cff` | Selection, focus ring, primary action |
| `--draft`  | `#b26b00` | `#e3a54a` | Unpublished changes                   |
| `--live`   | `#1d7f4e` | `#52c48a` | Published, valid                      |
| `--danger` | `#c4323a` | `#f0767b` | Errors, destructive                   |
| `--table`  | `#ececef` | `#0c0c0f` | The light table behind previews       |

Each state hue has a `-soft` background variant for chips and rows. All text pairs meet WCAG AA in
both themes. Dark mode follows the system and can be overridden (`data-theme`).

### Type

- UI: **Instrument Sans** (variable). Precise grotesk with a slightly warm, humanist feel; reads
  well at 12–14 px.
- Code, slugs, events: **JetBrains Mono** (variable), ligatures off.
- Scale (px): 11.5 / 12.5 / 13.5 / 15 / 19 / 24. Headings use weight and tracking (−0.01 to
  −0.02 em), not size jumps.
- Sentence case everywhere. No all-caps labels.

### Space, radius, elevation

- 4 px grid: 4, 8, 12, 16, 20, 24, 32.
- Radius by hierarchy: 5 px controls, 8 px cards and panels, 12 px specimen surfaces, 46 px phone.
- Elevation is reserved for the phone frame and popovers. Everything else is separated by 1 px lines.

## Components

| Component         | Notes                                                                             |
| ----------------- | --------------------------------------------------------------------------------- |
| Sidebar nav       | 32 px rows; current page has a 2 px signal inset bar; Publish shows a draft count |
| Column header     | 44 px, title in `--text-2`, actions right-aligned                                 |
| List item         | Title + monospace slug; status dot (live/draft/new) at the right                  |
| Tree row          | 30 px, 16 px indent with guide lines, type glyph, component name, summary         |
| Prop field        | Label + monospace type + `required`; control by prop type (see below)             |
| Segmented control | Enums with up to 4 values; selects for longer enums                               |
| Switch            | Booleans                                                                          |
| Action editor     | Action type select + one field for its target                                     |
| Status chip       | Dot + label; state colors only                                                    |
| Issue row         | Soft red (error) or soft amber (warning) with the path in monospace               |
| Phone frame       | 340 px wide, height follows the viewport; status bar, island, home indicator      |
| Action log        | Monospace list under the phone: `screen  emit "next"`                             |
| Timeline          | Version history with a live node in green                                         |
| Diff block        | File header + status tag; added lines on `--live-soft` with a `+` gutter          |

Prop controls: `string` input (textarea when multiline or long, with a character counter),
`number` input, `boolean` switch, `enum` segmented or select, `image` input (`asset:` or https),
`string[]` textarea one item per line, `action` action editor. Values are validated as you type.

## Layouts

```
Shell
┌──────────── demo banner (demo mode only) ─────────────┐
├──────────┬────────────────────────────────────────────┤
│ sidebar  │ page header                                │
│ 224 px   ├────────────────────────────────────────────┤
│          │ page body                                  │
└──────────┴────────────────────────────────────────────┘

Screens                         Flows
┌──────┬──────────────┬───────┐ ┌──────────────────────┬───────┐
│ list │ tree │ props │ phone │ │ graph                │ phone │
│      │      │       │ + log │ │                      │ + log │
│      │      │       │       │ ├──────────────────────┤       │
│      │      │       │       │ │ edge table           │       │
└──────┴──────────────┴───────┘ └──────────────────────┴───────┘

Publish                         Generate with AI
┌──────────────┬──────────────┐ ┌──────────┬───────────┬───────┐
│ changes      │ history      │ │ prompt   │ summary + save    │
│ message      │ timeline     │ │ provider ├───────────┬───────┤
│ publish      │ roll back    │ │ key      │ drafts    │ phone │
└──────────────┴──────────────┘ │ note     │ code diff │       │
                                └──────────┴───────────┴───────┘
```

The phone always sits on the light table at the right edge so the eye knows where "the app" is.

## Screen catalog

| Screen           | Purpose                                                          | Screenshot                                              |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| Screens editor   | Edit a screen as a tree or JSON with live preview and action log | `screens/screens-editor.png`, `screens-editor-dark.png` |
| Flows            | Graph of screens and events; click through in the phone          | `screens/flow-graph.png`                                |
| Components       | Registry: specimen, props table, usage, definition               | `screens/components.png`                                |
| Playground       | Paste JSON, see validation and the render, including fallbacks   | `screens/playground.png`                                |
| Publish          | Unpublished changes, publish, history with rollback              | `screens/version-history.png`                           |
| Generate with AI | Prompt, BYO key, proposed drafts, preview, code diff             | `screens/ai-panel.png`, `ai-panel-dark.png`             |

## The Brew example app

Brew is a fictional coffee subscription app used for every example. It has its own small design
system (warm paper background, roast browns, a green accent) defined in
`examples/expo-app/src/freshed/theme.ts`. Illustrations are composed from plain Views and
referenced from the CMS as `asset:beans`, `asset:calendar`, `asset:box`, `asset:ember`,
`asset:gift`. No photos of people, no stock imagery.

## Motion

Only in response to the user: toast entrance (180 ms), switch thumb (120 ms), spinner while
generating. `prefers-reduced-motion` disables all of it.

## Accessibility checklist

- Every interactive element is a real `button`, `a`, `input` or has a role; tree rows use
  `treeitem` with `aria-selected` and `aria-level`.
- Visible 2 px focus ring in the signal color.
- Toasts use `role="status"`; validation lists are labelled.
- The phone frame is a labelled region; preview components keep their own roles and labels.
