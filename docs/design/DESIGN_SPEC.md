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
| `--guide`  | `#3346d3` | `#3346d3` | Safe-area guides, same in both themes |

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
- Radius by hierarchy: 5 px controls, 8 px cards and panels, 12 px specimen surfaces. The device
  frame uses the device's own screen radius plus its 12 pt bezel.
- Elevation is reserved for the device frame and popovers. Everything else is separated by 1 px lines.

## Components

| Component         | Notes                                                                             |
| ----------------- | --------------------------------------------------------------------------------- |
| Sidebar nav       | 32 px rows; current page has a 2 px signal inset bar; Publish shows a draft count |
| Column header     | 44 px, title in `--text-2`, actions right-aligned                                 |
| List item         | Title + monospace slug; status dot (live/draft/new) at the right                  |
| Tree row          | 30 px, 16 px indent with guide lines, type glyph, component name, summary         |
| Layers            | Tree rows drag to reorder and nest (see below); toolbar with level and actions    |
| Palette           | Registered components as chips under the layers; drag to place, click to add      |
| Prop field        | Label + monospace type + `required`; control by prop type (see below)             |
| Segmented control | Enums with up to 4 values; selects for longer enums                               |
| Switch            | Booleans                                                                          |
| Action editor     | Action type select + one field for its target                                     |
| Status chip       | Dot + label; state colors only                                                    |
| Issue row         | Soft red (error) or soft amber (warning) with the path in monospace               |
| Device bar        | Device select (size in pt), aspect ratio select, rotate, Safe area toggle         |
| Device frame      | Drawn at the device's size in pt, scaled to fit; status bar, cutout, home bar     |
| Device readout    | Under the frame: width × height inputs in pt; Fit (with its zoom %) / 100%        |
| Action log        | Monospace list under the phone: `screen  emit "next"`                             |
| Timeline          | Version history with a live node in green                                         |
| Diff block        | File header + status tag; added lines on `--live-soft` with a `+` gutter          |

### Layers

- Dragging a row over another row: the top quarter drops before it, the middle drops inside a
  container (Stack, Card) as its last child, the bottom quarter drops after it, or as the first
  child when the container already has children. Leaves split at half height. The empty space
  under the last row appends to the screen.
- Feedback: a 2 px signal line with a dot at the depth the node will land, or a signal outline on
  the container it will enter. The dragged row and its subtree fade to 40%. Drops that would put a
  node inside itself, into a leaf, or deeper than the schema's depth limit are not offered.
- Levels count from the root, which is level 0 and shows as "Root"; its direct children are
  "Level 1". The toolbar shows the selected layer's level and parent ("Level 2 · in Card") and
  moves it up, down, out of its parent and into the container above, or removes it.
- Keyboard: the tree is one tab stop, on the selected row (the root when nothing is selected).
  ↑/↓ move focus between rows without selecting; Enter, Space or a click selects. Alt+↑/↓
  reorder and Alt+←/→ change the level of the focused row, selecting it first; Alt+arrows never
  reach the browser, so Alt+←/→ do not go back or forward in history. Focus follows a moved
  layer. Every drag has this keyboard equivalent, and palette chips add on Enter or Space.
- New layers from the palette get a placeholder for every required prop without a default (the
  component name, one list item, the first enum value, a bundled image, an `emit` action), so
  they render and validate at once.
- The same panel serves the screen editor and the playground, where edits rewrite the JSON. The
  playground locks the layers while its JSON does not parse or cannot render: "Showing the last
  valid JSON. Fix the JSON to edit the layers again." Copy in the panel: palette hint "Drag a
  component into the layers, or click it to add it at the selection."; toolbar "Move out of its
  parent (Alt+←)" and "Move into the container above (Alt+→)".

### Device preview

The preview lays screens out at a device's logical size, one point per CSS pixel, so text wraps
and content fits exactly as on the phone. The frame is then scaled to fit the light table (Fit),
or shown at 100% with scrolling. Content sits inside the safe area, like an app that wraps
screens in `SafeAreaView` (the Expo example does). The setting is shared by every preview and
remembered per browser.

| Preset           | Size (pt)  | Ratio  | Safe area portrait (t, b) | Landscape (t, r, b, l) | Chrome               |
| ---------------- | ---------- | ------ | ------------------------- | ---------------------- | -------------------- |
| iOS compact      | 375 × 667  | 16:9   | 20, 0                     | 0, 0, 0, 0             | status bar           |
| iOS standard     | 393 × 852  | 19.5:9 | 59, 34                    | 0, 59, 21, 59          | island, home bar     |
| iOS large        | 430 × 932  | 19.5:9 | 59, 34                    | 0, 59, 21, 59          | island, home bar     |
| iOS tablet       | 820 × 1180 | 1.44:1 | 24, 20                    | 24, 0, 20, 0           | home bar             |
| Android compact  | 360 × 800  | 20:9   | 24, 24                    | 24, 0, 24, 32          | punch-hole, home bar |
| Android standard | 412 × 915  | 20:9   | 32, 24                    | 24, 0, 24, 32          | punch-hole, home bar |
| Android tablet   | 800 × 1280 | 16:10  | 24, 24                    | 24, 0, 24, 0           | home bar             |

- Insets are typical for each class of device, not one model's exact figures. Names are generic:
  the preview is about layout classes, not brands.
- Picking an aspect ratio (4:3, 3:2, 16:10, 16:9, 18:9, 19.5:9, 20:9, 21:9) keeps the short side
  and sets the long side; ratios whose long side would pass 1600 pt (21:9 on a tablet) are
  disabled. Typing a width or height (240–1600 pt) keeps it on that axis and turns the device to
  landscape or portrait when it becomes the long side. Both show the device as "Custom · <preset>
  safe area", which keeps the preset's safe area and chrome.
- **Safe area** draws hatched bands over the unsafe edges, each labelled with its inset in pt, and
  a dashed outline around the safe area. Labels sit off-centre (75% across the top and bottom
  bands, a quarter down the side bands) so they never cover the cutout or the home bar. The
  guides use the `--guide` tokens, the light signal ultramarine in both themes, because they sit
  on the app's own background, not the Studio's. The button's tooltip lists the insets ("Safe-area
  insets in pt: top 59, right 0, bottom 34, left 0").
- In narrow preview columns (under 440 px, like the AI page) the Safe area button shows only its
  icon and keeps "Safe area" as its accessible name, so the device select is not cut off.
- A component that throws while rendering shows an inline alert inside the device ("This screen
  could not render: … Check the props of the last edited layer.") instead of breaking the Studio;
  the next edit renders again.

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
│ list │layers│ props │ phone │ │ graph                │ phone │
│      │+add  │       │ + log │ │                      │ + log │
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

| Screen           | Purpose                                                             | Screenshot                                                                              |
| ---------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Screens editor   | Edit a screen as a tree or JSON with live preview and action log    | `screens/screens-editor.png`, `screens-editor-dark.png`                                 |
| Flows            | Graph of screens and events; click through in the phone             | `screens/flow-graph.png`                                                                |
| Components       | Registry: specimen, props table, usage, definition                  | `screens/components.png`                                                                |
| Layers           | Mid-drag: the dragged layer fades, the target container is outlined | `screens/layers-drop.png`, `layers-drop-dark.png`                                       |
| Device preview   | Device presets, aspect ratio, rotation and safe-area guides         | `screens/device-preview.png`, `device-preview-dark.png`, `device-preview-landscape.png` |
| Playground       | Paste JSON or drag layers, see validation and the render            | `screens/playground.png`                                                                |
| Publish          | Unpublished changes, publish, history with rollback                 | `screens/version-history.png`                                                           |
| Generate with AI | Prompt, BYO key, proposed drafts, preview, code diff                | `screens/ai-panel.png`, `ai-panel-dark.png`                                             |

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
  `treeitem` with `aria-selected` and `aria-level` in a `tree` labelled "Layers", with a roving
  tabindex (one tab stop on the selected row).
- Visible 2 px focus ring in the signal color.
- Toasts use `role="status"`; validation lists are labelled.
- The device frame is a labelled region; preview components keep their own roles and labels.
  Status bar, cutout and safe-area guides are `aria-hidden`; the Safe area button's tooltip
  states the insets.
- Drag and drop is never the only way: layer moves have toolbar buttons with
  `aria-keyshortcuts` and Alt+arrow shortcuts, and palette chips add on Enter or Space.
