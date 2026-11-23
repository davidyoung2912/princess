# Measures and baselines for the pain-points work (R8)

Source: section 8 of `docs/princess_passenger_pain_points_pwa_research.md`. The research says to measure whether guests finish important tasks, not how many log in. This page says which of its measures the prototype can produce today, how, and what needs people or Princess data.

## What the app can measure now, on the phone

| Research measure | What exists | Where | Limit |
| --- | --- | --- | --- |
| Completion of the top tasks, and time to find | `taskFunnel`: per top-15 task, how often its first screen opened, how often its last screen opened within the two-tap rule before Home, and the median seconds | Me > Settings > Diagnostics, "How the top tasks went on this phone" | Screens only; it cannot tell a guest who succeeded from one who wandered there. Help-only tasks are left out. On this phone only, never sent |
| Taps to key tasks | `TOP_TASKS` and `navProblems()` assert the two-tap rule | `src/routes/nav.test.ts` | Counts designed taps, not real ones |
| Cached records with a visible age | `src/gates/offlineDay.test.ts` fails the build when a screen shows a kept copy without its age | test suite | Code check, not a user check |
| Essential screens available offline | `MUST_WORK_OFFLINE` kinds asserted; the Phone screen "Download my cruise" reports what was and was not saved; the night-before test | tests, Phone screen | Airplane-mode behaviour is not proven without a device |
| Voyage pack download | last result kept on the phone (done, failed, size, time) | Phone screen | Per phone |
| Problems the app hit | scrubbed error reports, with a support reference | Diagnostics, telemetry | Needs the server sender and consent |
| Search success | `searchContent` hits, "no result" counts are not recorded | none | Needs an event for "no hits" and "opened a hit" |
| Duplicate bookings | idempotency keys on booking and payment writes | server | No count reported |

## What needs a person or Princess data

| Research measure | What is needed |
| --- | --- |
| Booking association completion; login failure rate | Server-side counts from the link and sign-in endpoints (the codes `noMatch`, `alreadyLinked`, `review` are already distinct) |
| Time to locate a reservation | A moderated session: five guests, "find your spa appointment", timed. The release scorecard's group E covers the people |
| Passengers who can say whether data is current | A question in the same sessions: "is this up to date?" with the sync chip visible and hidden |
| Multi-cabin parties connected before embarkation | Server count of connect and group-invite acceptances per booking set, before the departure date |
| Support contacts per 1,000 guests, repeat-contact rate | Princess's contact-centre data |
| Offline success in airplane mode | A device walk of the ten must-work screens (`docs/release-scorecard.md`, B6) |
| Port confidence: all-aboard and ship vs local time | Comprehension questions in the walk |

## How to set a baseline

1. Pick the ten tasks. Use `TOP_TASKS` minus the Help-only ones (boarding pass, today's events, my reservations, order food, my bill, deck map, change dining, find family, add package, my excursions, text size).
2. Run the same timed task with five guests on the current Princess app, and again on this app, on the same phones, recording success, time, taps and where they went wrong.
3. Record Princess's existing support-contact data for the same journeys over the same weeks before launch.
4. Keep the sessions' notes against the release scorecard's measures B1 to B9.
5. Re-measure after each release and compare with the baseline, never with raw downloads, logins or session counts.

## What this does not do

It does not send task counts anywhere (a deliberate choice: no usage counts leave a phone without the guest's consent, and these never do). Turning it into a fleet measure needs a consent-gated event name added to `telemetry.ts` and a server table; that is listed as an open item in `docs/pain-points-round2-gaps.md`.
