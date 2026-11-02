# A-tier matrix (N1.1)

Written 2026-11-02 for phase N1 of `docs/next-level-plan.md`. It answers one question for the 20 shortlist items in `docs/customer-journey-priorities.md` §15: **what proves it works?**

How to read the evidence columns:

- **Logic test**: a vitest file that imports the domain module (checked by import, so a test may cover only part of a module). The server's C# has its own 774 test facts in `server/Princess.Api.Tests`, which this project's rules say not to run, so they are not counted as evidence here.
- **Screen proof**: what checks the *screen* (not just the logic). Today that is: every route renders its title, landmarks and help button (`src/ui/render.test.tsx`), the accessibility audit (`src/ui/a11y.test.tsx`), the two-tap rule for 15 tasks (`src/routes/nav.test.ts`), and a few source-scan promise tests (`src/h5Promises.test.ts` to `src/h8Promises.test.ts`, `src/darkPatterns.test.ts`, `src/offlineDay.test.ts`).
- **Screen proof, updated after N1.2**: `src/ui/dataScreens.test.tsx` renders the screens behind the 15 top tasks with data, in jsdom, against a stubbed network. Rows whose screen is one of those say so. All other screens are still proved only by the route render test.
- **Gap**: what is *not* proved.
- The clear-to-use sentence is from the journey doc and has no automated check unless a row says so.

| # | Shortlist item | Logic test | Screen proof | Gap |
| --- | --- | --- | --- | --- |
| 1 | My Trips and one next action | `ahead.test.ts` (readiness), `account.test.ts` | Route render only | Next action is not asserted on Home with data |
| 2 | Draft-safe booking and check-in | `booking.test.ts`, `checkin.test.ts`, `outbox.test.ts`, `ui/book/steps.test.tsx` | Route render | "Close mid-payment and resume" is not exercised end to end |
| 3 | Boarding-pass failsafes | `checkin.test.ts` (`boarding.ts`), `offlineDay.test.ts` (copy kept and aged) | `dataScreens.test.tsx` (pass, saved copy offline, slow link) | Printable pass and dead-phone card unchecked; Wallet is simulated |
| 4 | Real total price | `pricingServed.test.ts`, `discover.test.ts`, `catalogueParity.test.ts` | Route render | First price equals last price is not tested across screens |
| 5 | Documents engine | `account.test.ts`, `papersCheck.test.ts` | Route render | No scan of a passport; expiry rule tested in logic only |
| 6 | Door-to-ship, "I'm delayed" | `journey.test.ts`, `delay.test.ts`, `flight.test.ts` | Route render | "One tap" is not asserted |
| 7 | Three clocks, Port Day Pilot | `portPilot.test.ts`, `onboard.test.ts` | Route render | Leave-by being the largest element is not checked |
| 8 | Schedule integrity | `onboard.test.ts`, `aboard.test.ts`, `offlineDay.test.ts` | Route render; **age on every copy now enforced** | Cancelled-stays-struck-through is logic-only |
| 9 | Offline-first | `offlineCache` cases in `data/deviceCopies.test.ts`, `offlineDay.test.ts` | New source scan | Fixed in N1.3: the plain-English summary showed a kept bill without its age. Still unproved: full offline day in a browser |
| 10 | Two-tap rule and Get help now | `nav.test.ts` | Route render checks the help button on every route | Only 15 tasks have a depth test; 187 routes exist (N2) |
| 11 | Money shield | `moneyShield.test.ts`, `darkPatterns.test.ts` | Source-scan | Confirm dialog on screen not rendered |
| 12 | Entitlement engine | `domain.test.ts`, `prebook.test.ts`, `onboard.test.ts` | `dataScreens.test.tsx` (packages) | "Used vs remaining" not asserted |
| 13 | Atomic changes, resilient orders | `prebook.test.ts` (dining), `extras.test.ts` (orders) | Route render | The rule lives in the server too; a failed reschedule on screen is untested. Re-read before relying on it |
| 14 | Disruption Hub | `disruptionHub.test.ts`, `demo/scenarioParity.test.ts` | Route render | Hub text is authored in the client |
| 15 | Cabin chooser | `cabinScore.test.ts` | Route render | Photos missing (S1-06) |
| 16 | Family-at-home, child safety | `homeLink.test.ts` | Route render, family-link refusal states | A valid link is not rendered with data |
| 17 | Accessibility, non-app parity | `contrast.test.ts`, `textSize.test.ts` | `a11y.test.tsx` audit | Gerald and Linda tests are by hand |
| 18 | Autopilot and Ship Pulse | `autopilot.test.ts`, `pulse.test.ts`, `planChange.test.ts`, `h5Promises.test.ts` | Source-scan | Feeds are simulated on the server |
| 19 | Calm mode, sensory plan | `calm.test.ts` | Route render | Calm mode's one-column layout is CSS, unchecked |
| 20 | Memory loop | `memoryBook.test.ts`, `wrapped.test.ts` | Route render | Photos missing; PDF is the browser's print |

## Reading the matrix

- **Logic is well covered**: 64 domain test files and only four small domain modules (`contacts`, `people`, `priceShapes`, `referenceStatus`) are not imported by any test.
- **Screens with data were not covered at all** before N1.2: the route render test uses `renderToString`, which never runs effects. The 15 top-task screens now are (jsdom, stubbed network). The other ~170 screens are still covered by the route render test only.
- **Two real defects found and fixed**: with no signal the saved boarding pass sat behind a spinner for several seconds (retries first, copy last); and the plain-English summary screen showed the kept copy of the bill without saying how old it is (breaks OB-08 and journey rule 3). `src/offlineDay.test.ts` now fails if any screen keeps a copy and does not show its age.
- **Budget**: first load is about 331 kB gzip against a 340 kB budget; the biggest single piece is the English strings (about 122 kB gzip, `i18n` chunk), loaded before any screen. Splitting strings per screen group would cut first load, and is part of the locale work in N5.5.
