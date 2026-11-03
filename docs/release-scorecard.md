# Release scorecard (N8.6)

A checklist to run before a pilot or release. Each row says how it is checked. "Auto" rows are covered by `npm run test`, `npm run lint`,
`npx tsc -b` and `npm run build`; "Walk" rows are done by a person on a real phone (the project does no browser automation). Mark the date
and initials when a row passes.

## A. Automatic gates (every release)

| # | Check | How | Passed |
|---|---|---|---|
| A1 | Unit and screen tests pass | `npm run test` (Auto) | |
| A2 | Lint clean, including jsx-a11y | `npm run lint` (Auto) | |
| A3 | Types clean | `npx tsc -b` (Auto) | |
| A4 | Production build and bundle size caps | `npm run build` (Auto) | |
| A5 | Server builds and its tests pass | `dotnet build` and `dotnet test` run by the owner on a machine with .NET (Walk) | |

## B. The nine quality measures (functional requirements §23.6)

| # | Measure | Check | Passed |
|---|---|---|---|
| B1 | Two-tap rule for the top 15 tasks | Count taps from Home for each task (Walk) | |
| B2 | First useful screen shows the next required action, no offer above it | Sign in as each stage persona (use the testing date) (Walk) | |
| B3 | Check-in finishable in one sitting, resumable; family data entered once | Maria and Daniel walkthroughs (Walk) | |
| B4 | Gerald test: top-15 tasks at the largest text size, high contrast, phone alternative visible, no gestures | Walk at 200% text | |
| B5 | Linda test: access information up front on port and route screens; no drag, hover or fine motor | Walk | |
| B6 | No dead ends: every error offers a next step and a person; offline shows data age | Switch to airplane mode on five screens (Walk) | |
| B7 | Trust ledger: nothing booked, paid, requested or saved vanishes; changes in history | Make, change and cancel a booking; read My activity (Walk) | |
| B8 | Offer restraint: one offer per screen, none on task-critical screens | Look at Home, Pay, Check-in, Boarding (Walk) | |
| B9 | Consistency: one planner, one wallet, one inbox, one help | Search for each; confirm one place (Walk) | |

## C. Content and safety

| # | Check | How | Passed |
|---|---|---|---|
| C1 | Every "(verify)" line has a source or is removed | `docs/content-verification.md`, owner sign-off | |
| C2 | Hand-off for emergency, medical, legal and person messages never reaches a model | Concierge tests (Auto) and three phrases by hand (Walk) | |
| C3 | Children's accounts cannot share, pay or message outside the party | Supervised-child persona (Walk) | |

## D. Operations

| # | Check | How | Passed |
|---|---|---|---|
| D1 | `/health/providers` shows `ok` for every provider that is switched on | `docs/runbook.md` | |
| D2 | JSON logs on (`Logging:Json=true`) and read by the log tool | Runbook | |
| D3 | Secrets only in user-secrets or environment | Search the repo (Auto-ish) | |
| D4 | Export and delete work for a real account | Privacy centre: download, then delete (Walk) | |
| D5 | Retention rules honoured (rows past their day are gone) | Runbook retention section | |

## E. Guest research (process)

Book sessions with five kinds of guest and record findings against the measures above: an older cruiser, a neurodivergent cruiser, a solo
cruiser, a parent travelling with young children, and someone using a screen reader. Each session: the top-15 tasks, thinking aloud, one
hour, with a note of what blocked them. **Not booked: needs people and dates from the owner.**
