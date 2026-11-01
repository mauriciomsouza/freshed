# Agent team

freshed is built by a small team of specialised agents coordinated by an orchestrator, with one
human owner who makes the calls that matter. The same operating model runs every iteration, from a
one-line copy fix to a new protocol version.

## Roles

| Role         | Agent                                       | Owns                                                                | Typical deliverable                                         |
| ------------ | ------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| Orchestrator | main session                                | Scope, sequencing, handoffs, keeping CLAUDE.md rules enforced       | Iteration brief, task breakdown, final summary to the owner |
| Business     | [business](../.claude/agents/business.md)   | Problem, users, positioning, pricing model, success metrics         | Updates to BUSINESS.md, a one-page bet with a metric        |
| Design       | [design](../.claude/agents/design.md)       | Lightbox visual system, Studio UX, component accessibility contract | DESIGN_SPEC.md changes, annotated screenshots, copy         |
| Dev          | [dev](../.claude/agents/dev.md)             | Schema, renderer, server, Studio, AI connector, CLI                 | Small commits with tests                                    |
| QA           | [qa](../.claude/agents/qa.md)               | Independent verification, regression and compatibility tests        | Test report with pass/fail per acceptance criterion         |
| Infra        | [infra](../.claude/agents/infra.md)         | CI, Docker, Pages deploy, migrations, secrets hygiene               | Workflow and compose changes, deploy checks                 |
| Release      | [release](../.claude/agents/release.md)     | Versioning, changelog, merge, tags, npm publishing                  | CHANGELOG entry, release notes, merged PR                   |
| Marketing    | [marketing](../.claude/agents/marketing.md) | Launch narrative, README pitch, posts, demo script                  | LAUNCH.md drafts, README hero copy                          |

## One iteration

```
           owner
             │  goal + constraints
             ▼
     ┌───────────────┐
     │ Orchestrator  │  writes the brief, splits work, names acceptance criteria
     └──────┬────────┘
            │
   ┌────────┼──────────────┐
   ▼        ▼              ▼
Business  Design          Infra
(why,     (spec, copy,    (CI, deploy,
 metric)   screens)        migrations)
   └────────┬──────────────┘
            ▼
          Dev ──── small commits + tests ────┐
            │                                 │
            ▼                                 │ fixes
           QA  ── independent checks ─────────┘
            │   (tests, compat matrix, verify-pages, screenshots)
            ▼
         Release ── changelog, version, merge
            │
            ▼
        Marketing ── notes, posts (when user-facing)
            │
            ▼
           owner  ◄── summary + screenshots + anything needing a decision
```

freshed ai follows the same path: the model is a tool Dev uses, not a team member. Its output
enters at "Dev" as a draft or a branch and goes through QA and Release like any other change.

## Points that require the human owner

| Decision                                                    | Why it is the owner's call                               |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| Bumping `PROTOCOL_VERSION`                                  | Affects every shipped app build; needs a migration story |
| Publishing to npm, creating tags, making the repo public    | Irreversible and public                                  |
| Changing the license or the open-core boundary              | Business model                                           |
| Adding a dependency on a paid or third-party hosted service | Cost and lock-in                                         |
| Any change to how LLM keys are handled                      | Security and trust promise                               |
| Merging AI-generated component code into the default branch | Generated code always gets a human reviewer              |
| Publishing content to a production project                  | Users will see it                                        |
| Launch timing and public posts                              | Reputation                                               |

## Team rules

1. Whoever implements does not approve. QA signs off; Release merges.
2. Every agent reads CLAUDE.md before starting and cites the rule when it blocks something.
3. Acceptance criteria are written before implementation, by the Orchestrator with Design or
   Business, and QA tests against them, not against the implementation.
4. Every UI change ships with screenshots (light and dark) that someone actually looked at.
5. Docs are part of the change. If behaviour changes, the spec changes in the same PR.
6. Prefer the smallest change that solves the problem. Scope creep goes back to the Orchestrator.
7. When in doubt about anything in the owner table, stop and ask.
