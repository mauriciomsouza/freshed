# Business

## Problem

In a mobile app, small content changes are expensive. A new onboarding step, a seasonal promo or a
copy fix means a code change, a build, store review and waiting for users to update. Teams either
batch these changes (slow) or hard-code escape hatches (fragile). Product, design and growth people
depend on engineers for changes that are mostly content.

Server-driven UI solves this by sending screen descriptions from a server and rendering them with
components the app already has. Large companies build this in-house. Smaller teams rarely can.

## Who it is for

- **Primary:** product teams of roughly 3 to 30 people shipping an Expo or React Native app, with
  at least one engineer comfortable self-hosting a Node service and Postgres.
- **Champion:** a design engineer or a product-minded developer who owns onboarding, promos or
  growth surfaces.
- **Day-to-day user:** a PM, designer or marketer who edits screens in the Studio after engineers
  register components.
- **Not for (yet):** teams that need a fully hosted, enterprise-governed platform today, or apps
  that are mostly native (non-RN) UI.

## Positioning

> Ship new screens to your Expo app without a store release. Self-hosted, typed, data only.

freshed sits between "change everything over the air" and "change nothing without a release".

| Alternative                               | What it does well                                             | Where freshed differs                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Over-the-air JS updates (e.g. EAS Update) | Ship any JS change quickly, including logic fixes             | Still an engineering release per change. freshed changes content and composition with no code deploy, and is complementary |
| Feature flags / remote config             | Toggle features and tune values safely                        | Values, not screens. freshed composes whole screens and flows from typed components                                        |
| Headless CMSs                             | Rich content modelling, editorial workflows, localisation     | Not built around mobile UI composition, actions, flows or protocol compatibility with old app builds                       |
| Open-source SDUI renderers                | Render JSON layouts in RN                                     | Usually a renderer only. freshed adds the registry, Studio, versioning, rollback and a compatibility model                 |
| Commercial SDUI platforms                 | Hosted, collaborative, analytics and experimentation built in | freshed is self-hosted, MIT and small; you own the data and the infrastructure                                             |
| Building in-house                         | Exactly fits your app                                         | Takes months to reach versioning, rollback, previews and compat; freshed is a starting point you can fork                  |

We describe categories rather than score specific vendors. Capabilities change; check current
documentation before comparing.

**freshed ai** strengthens the wedge: one prompt creates the draft screens and, if needed, the
missing component on a review branch. Most AI UI tools generate code that becomes the product;
freshed generates data within an existing design system, plus small, reviewable components.

The Studio's drag-and-drop layers and device preview are editing aids, not a no-code app builder.
Editors arrange only the components the app already ships, nest them only where the registry
allows and change them only through declared props. The design system and logic stay in app code.

## Sustainability: open core

- **MIT, forever:** protocol and schemas, renderer, server, Studio, CLI and freshed ai. Everything
  needed to self-host and ship screens.
- **Possible paid offerings (later, only with demand):**
  - Managed hosting with backups, CDN for public reads and uptime guarantees.
  - Team features: SSO, roles and approvals, audit log, scheduled and staged publishes.
  - Support and migration help for larger teams.
- **Never paywalled:** the renderer, the protocol, rollback, or anything that would make a
  self-hosted install worse over time.

## Metrics

| Stage      | Metric                                                                        |
| ---------- | ----------------------------------------------------------------------------- |
| Interest   | Demo visits that reach the Flows page; repo stars; README → demo clicks       |
| Activation | Installs that publish a first version within a day of `docker compose up`     |
| Value      | Content changes published per week per active project (vs. app releases)      |
| Trust      | Rollbacks per 100 publishes, and time from bad publish to rollback            |
| AI         | Share of AI drafts that get published (after human edits) and merged branches |
| Retention  | Projects still publishing after 8 weeks                                       |

## Assumptions to test

- Teams will register 10 to 30 components before they get value. (Interview design partners.)
- Non-engineers will edit in the Studio once components exist. (Watch first sessions: can they
  add, reorder and nest components in the layers panel without JSON mode or an engineer?)
- Previewing at device sizes with safe areas catches layout problems before publish. (Ask design
  partners to tag rollbacks caused by layout on a device class: clipped, overflowing, under the
  notch or home bar.)
- AI drafts save time only if the registry is well described. (Compare publish rates with and
  without component descriptions.)
