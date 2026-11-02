# Phased implementation plan for the leading-features requirements

Status: **Plan saved 2026-11-01. Phases H1 and H2 are built (sections 5 and 6); H3 to H6 are not started.**
Source: `docs/leading-features-requirements.md` (IDs below are from that file; decisions in its §22 are accepted).

## 1. Ground rules (from `CLAUDE.md` and the earlier G phases)

- One phase at a time. Tests with each phase. Verify with `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`, and `npm run api:check` when the `Api` interface changes. Never a full `dotnet test`; no browser or Playwright testing.
- Commit and stop after each phase; commit or push only when asked.
- Logic lives in plain TypeScript under `src/domain` (node-testable); React screens stay thin. Strings go in `src/i18n/en.ts`. Every route goes in `src/routes/routes.ts` and `src/screens.ts` (a test fails otherwise), and is covered by the existing accessibility audit.
- Both modes keep working: the mock API and the REST API. **H1 to H6 are front end first**: new state stays on the device per person (as in G3, G5, G6) behind small stores, and any server storage is listed as "not done" at the end of the phase rather than bundled in.
- Simulated feeds (crowds, flight status, sky and so on) are built as pure functions over a seed and the demo clock, with a `source` field so a real feed can replace them.
- Offer restraint (UX-02) and the two-tap rule (UX-01) bind every phase. Anything that talks to the guest unprompted counts against the nudge budget built in H1 (XA-03).
- Each phase's notes go into `docs/design-language.md`, and the status table below is updated.

## 2. Phase table

| Phase | Name | Requirements | Depends on | Status |
| --- | --- | --- | --- | --- |
| **H1** | Trust and money | XT-01…XT-07, XT-10, S3-07, S6-06, S7-05, XA-03 | none | **Built** (section 5) |
| **H2** | Disruption Hub and family-at-home | XD-01…XD-10, S3-08, S6-24, S4A-03, S4A-08 | H1 (nudge budget, ledger) | **Built** (section 6) |
| H3 | Port Day Pilot | S6A-01…S6A-15, S6-12, XG-03 | H1 (confirm, ledger), H2 (disruption hooks) | Not started |
| H4 | Door to door and embark | S4A-01…S4A-12, S5-01…S5-06 | H2 (I'm delayed, ETA sharing) | Not started |
| H5 | Autopilot, Ship Pulse, inclusion, assistant | S6-01…S6-05, S4-01, S4-02, XI-01…XI-05, XA-01, XA-02 | H1 (nudges), H3 (port plan), H2 | Not started |
| H6 | Cabin chooser, memory loop, dream | S1-02…S1-08, S8-01…S8-12, S0-01…S0-10 | H3 and H5 for recap inputs | Not started |
| H7 | Backlog | Remaining S and C items, sorted after each phase review | | Not started |

Order rationale and the option to swap H3 and H5 are in the requirements doc §21.

## 3. Phase H1 in detail: Trust and money

**Goal:** a guest can see, understand and control every dollar, and nothing in the app pressures them. All of it works offline and against both APIs.

### 3.1 What gets built

| Slice | IDs | Domain module (new unless noted) | Screens and wiring |
| --- | --- | --- | --- |
| Explain this charge, fee ledger | XT-02, S7-05 | `src/domain/moneyShield.ts`: `explainCharge`, `feeLedger` | Bill: "Explain" on each line and a "Where the money goes" card; Final bill: the same explainer and a "Question this charge" link to cases |
| Confirm before charge | XT-03 | `moneyShield.ts`: `ChargeGuard`, `needsConfirm`; `Settings.confirmAbove` | `ConfirmCharge` dialog used by Wi-Fi add and upgrade, top-up and order checkout; Money screen "Charge checks" setting |
| Spend coach | S6-06 | `moneyShield.ts`: `spendCoach` (pace, forecast, package use) | Card on Bill; informational tone, tested wording |
| No-shaming gratuity stance | XT-04 | wording and a test | Statement on Money (gratuities) and Privacy; a test fails if any string or share view labels guests by tipping |
| Why am I seeing this | XT-05 | `offers.ts`: `offerReason` | Reason line on Offers and the Home card, with the existing "Not for this trip" as the stop control |
| Nothing renews by itself | XT-06 | `moneyShield.ts`: `renewalNotice`, `autoRenewing` rule | Promise card on Money; a catalogue test fails if any item is marked recurring |
| Trust ledger | XT-07 | `src/domain/trustLedger.ts`: merge payments and onboard charges into one timeline | New `/me/ledger`, linked from Me and Bill. **Reduced scope:** only sources that exist today (payments, receipts, folio); later phases add their own events |
| Roaming and Wi-Fi guard, phone setup | XT-01, S3-07 | `src/domain/phoneSetup.ts`: checklist, `roamingMoment`, `wifiCoach` | New `/plan/phone`; notice on Wi-Fi screen; Wi-Fi usage coach (data used against plan, cheapest plan that fits) |
| Notification budget | XA-03 | `src/domain/nudges.ts`: `Settings.nudgesPerDay`, `takeNudges` | Setting in the notifications centre; the Home offer card obeys it (0 hides it). Critical notices are exempt |
| Dark-pattern tests | XT-10 | `src/darkPatterns.test.ts` | Scans strings and screens for countdowns, pre-ticked boxes, confirm-shaming and hidden-cost wording |

### 3.2 Definition of done

- Unit tests for every new domain function, including edge cases (zero, negative credits, covered charges, children, no budget).
- New routes in `ROUTES` and `SCREENS`; the accessibility audit passes for each.
- `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` all clean.
- H1 notes added to `docs/design-language.md`; this file's status updated; the "not done" list is honest.

### 3.3 Out of H1 (deliberately)

- Server storage for the charge limit, nudge count and ledger (device-local like G3, G5, G6).
- Real roaming data (the guard is guidance, not a data feed).
- A ledger of bookings, requests and changes outside payments and the folio (H2 onward add their events).

### 3.4 Risks

- The ledger could look empty for a guest with few transactions. It states what it covers and what joins it later.
- Confirm-before-charge must never block a safety or required payment: it only applies to optional purchases.

## 4. Later phases at a glance

Each gets its own detailed section here when it starts.

| Phase | Core domain modules | New screens | Main risks |
| --- | --- | --- | --- |
| H2 | `disruption` hub model on the existing `disruption.ts`, `homeLink.ts` (family-at-home), `delay.ts` | `/home/disruption`, `/plan/family-link`, simulated public link `/at-sea/:token` | Public-style link must be signed, expiring and revocable; no live location |
| H3 | `portPilot.ts` (backward plan from all-aboard), `portCrowd.ts` (sim), `ledgerSplit.ts` | Port day pilot inside `/ship/port`; shared plan; `/plan/split` | Time-zone correctness (three clocks); fair-price content must be authored plausibly |
| H4 | `journey.ts` (door-to-ship legs, buffers), `flightWatch.ts` (sim) | `/plan/getting-there` | Many small items; keep to one timeline |
| H5 | `autopilot.ts` (reflow with approve/undo), `pulse.ts` (sim), `calm.ts`, assistant tools | Calm mode setting, quiet-space layer, assistant actions | Highest complexity; the confirm-and-undo discipline must be tested first |
| H6 | `cabinScore.ts`, `wrapped.ts`, `memoryBook.ts`, `dream.ts` | Cabin chooser, recap cards, memory book, dream board | Content volume; keep scores explainable, not decorative |

## 5. Phase H1 notes

Built 2026-11-01. Front end only; no server or REST contract changes (`api:check` not needed).

- **Explain and fee ledger (XT-02, S7-05):** `src/domain/moneyShield.ts` (`explainCharge`, `feeLedger`, `canQuestion`). A "What is this?" disclosure on every Bill line and on every charge in a new "Every charge in plain English" section of the Final bill; "Question this charge" goes to the existing query form. "Where the money goes" card on the Bill.
- **Confirm before charge (XT-03):** `needsConfirm`, `Settings.chargeCheck` (never, over $25, over $50 default, over $100, always), `useConfirmCharge` and a dialog. Wired to Wi-Fi add and upgrade, order placement and photo purchase. Not applied to top-ups, gratuities, required payments or anything safety-related. Set on the Money screen.
- **Spend coach (S6-06):** `spendCoach` (straight-line forecast over 7 nights against the budget; covered value; package drinks today against 15 where the package is Plus-sized, an authored value). Wording tested for blame.
- **Private gratuities (XT-04):** statements on Money and Privacy, and a wording test. **This is a promise in text and a guard against labelling in strings, not an access-control change**: no view in the app exposes tipping to others today.
- **Why am I seeing this (XT-05):** `offerReasons` and a disclosure on each offer card. The existing "Not for this trip" is the stop control; a per-kind mute was not built.
- **Nothing renews (XT-06):** `renewalNotice` (refuses a renewing item without a date and amount), a promise card on Money, and string and Wi-Fi-plan tests. Nothing in the app renews today.
- **Trust ledger (XT-07):** `src/domain/trustLedger.ts` and `/me/ledger`. **Reduced scope:** payments and onboard account lines only; the page says so.
- **Phone setup and Wi-Fi guard (XT-01, S3-07):** `src/domain/phoneSetup.ts`, `/plan/phone`, tick state per person on the device (`src/phone/store.ts`), a stage-aware reminder, a notice on the Wi-Fi screen and a per-device data coach (`wifiAdvice`). Guidance only; the app cannot see the phone.
- **Notification budget (XA-03):** `src/domain/nudges.ts` (`rankNudges`, `takeNudge`), `Settings.nudgesPerDay` (0, 1, 3 default, 5), set in the notifications centre. Today only the Home offer card obeys it (0 hides it). `rankNudges` and `takeNudge` are ready for H2 and H5 but have no other caller yet.
- **Dark-pattern tests (XT-10):** `src/darkPatterns.test.ts`.
- **Verified:** `npm run test` (1167 passed), `npm run lint`, `npx tsc -b`, `npm run build`. `npm ci` was needed first because `node_modules` was absent; the lockfile did not change.
- **Not done:** server storage for the charge check, suggestions budget, phone steps and ledger; a ledger of bookings, requests and changes; a per-kind offer mute; confirm on top-ups; a rendered check (no browser testing by rule); the phone-setup list is not yet linked from Home or the check-in flow, only from Plan.

## 6. Phase H2 notes

Built 2026-11-01. Front end only; no server or REST contract changes (`api:check` not needed). State is per person on the device in `src/hub/store.ts` (one record: family page, delay, callback, follow-ups).

- **Disruption Hub (XD-01, XD-02, XD-03):** `src/domain/disruptionHub.ts` adds hub detail to every disruption in `disruption.ts` (what it means, what is already done, knock-on items already refunded, moved, cancelled or kept, what was given, when, and what the guest must do, what happens next). `/home/disruption` shows it with the same choice buttons and acknowledgement as `/home/updates`, which stays. The Home changes banner now opens the hub. Knock-on items are authored concept values, not computed from the guest's bookings.
- **Callback (XD-04):** `requestCallback`, `queueEstimate`, `callbackStatus`: a pretend queue (place 1 to 6, four minutes a place, lapses after two hours, `source: 'sim'`). The desk number is printed on the page for offline use.
- **Guides (XD-05, XD-06, XD-08, XD-09):** stranded, lost phone, outage and health guides, always on the hub (health first during a health notice). Outage mode: when the demo network is offline the hub shows a banner listing what still works.
- **Follow-up (XD-10):** one question after a change ends; a "poor" answer says a person will read it. Kept on the device only; nothing is sent.
- **Family at home (S3-08, XD-07, S6-24):** `src/domain/homeLink.ts`, `/plan/family-link`, and the public-style `/at-sea/:token` (outside the shell, no sign-in, noindex). Links are signed with a per-device keyed hash (a simulation, not cryptography), expire after 3, 7 or 14 days, are one live link per person, and can be stopped one by one or all at once; removing a person stops their links. The page shows only a fixed list of ship-level fields (tested: no cabin, location, email, bill or deck) and an official notice for ship-wide changes. Postcards are ready-made messages with an optional short note, queued while offline and sent on reconnect. **The link only opens on the device that made it** until a server issues and checks tokens.
- **I'm delayed (S4A-03, S4A-08):** `src/domain/delay.ts`, `/home/delayed`: reason and minutes, tells the line (mock) and optionally the party (a note on the party page), shows next steps for the stage, a new ETA against the next all-aboard, a claim-ready record, and a switch to stop sharing the flag.
- **Routes:** `/home/disruption`, `/home/delayed`, `/plan/family-link`, `/at-sea/:token` (`public: true` in the route table; the app skips sign-in for it).
- **Not done:** server storage and a real signed link; real callbacks; knock-on fixes computed from actual bookings; a photo on postcards; the debrief and callback as Home cards counted against the nudge budget; ledger entries for changes; a valid-link render test (only the refusal states render in tests, the logic is unit tested); a rendered check (no browser testing by rule).
