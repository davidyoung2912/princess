# Phased implementation plan for the leading-features requirements

Status: **Plan saved 2026-11-01. Phases H1 to H6 are built (sections 5 to 10); H7 is in progress (slices 1 to 5 built, section 11). H8 slice 0, the audit, is done (section 12).**
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
| H3 | Port Day Pilot | S6A-01…S6A-15, S6-12, XG-03 | H1 (confirm, ledger), H2 (disruption hooks) | **Built** (section 7) |
| H4 | Door to door and embark | S4A-01…S4A-12, S5-01…S5-06 | H2 (I'm delayed, ETA sharing) | **Built** (section 8) |
| H5 | Autopilot, Ship Pulse, inclusion, assistant | S6-01…S6-05, S4-01, S4-02, XI-01…XI-05, XA-01, XA-02 | H1 (nudges), H3 (port plan), H2 | **Built** (section 9) |
| H6 | Cabin chooser, memory loop, dream | S1-02…S1-08, S8-01…S8-12, S0-01…S0-10 | H3 and H5 for recap inputs | **Built, in part** (section 10) |
| H7 | Backlog | Remaining S and C items, sorted after each phase review | | **In progress**, slices 1 to 5 built (section 11) |

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

## 7. Phase H3 notes

Built 2026-11-01. Front end only; no server or REST contract changes (`api:check` not needed). State is per booking on the device in `src/port/store.ts` (kept under the booker like the party notes, so everyone on the booking sees the same record on this device).

- **Port Day Pilot (S6A-01):** `src/domain/portPilot.ts` `planPortDay` works backward from all-aboard: safety buffer (30, 45 or 60 minutes), return queue by crowd, gate walk (pier) or last tender (tender day), then the trip back, giving a leave-by time, a time-at-destination figure and whether a chosen excursion fits (`latestStart` gives the latest start). Times show in ship time with local time beside them; a late tender moves the first time ashore, never the deadline. On `/ship/port`.
- **Crowd and ships in port (S6A-02):** `src/domain/portCrowd.ts`: a stable simulated count per port and date (`source: 'sim'`), a crowd level, an hourly shape, the quietest window, and a "the ship is quiet" note when a port is busy.
- **Fair prices, scam alerts, safety, local rules, don't bring it back, phrases, allergy cards, walks, day passes, kids, local vendors (S6A-03, 07 to 13):** `src/domain/portContent.ts` (authored, every local-law line tagged "(verify)") and a new offline-friendly page `/ship/port/guide` with a port chooser.
- **Plan B (S6A-04):** four plan Bs per port (rain, heat, tender late, low energy), one tap to choose, and the tender one is suggested when tenders are late or the ship may tender.
- **I'm back aboard (S6A-05):** `src/domain/portParty.ts` `backCheck`: three states (ashore, heading back, back), a nudge inside a window the guest chooses (30 to 90 minutes), a child listed apart for a plain "call or find them" line, and gangway guidance under 30 minutes. It records what people tell the app; it never reads a position.
- **Shared plan (S6A-06):** one person proposes, everyone in the booking says yes, and one tap stops it.
- **Split ledger (XG-03):** `src/domain/ledgerSplit.ts` and `/plan/split`: families, shared costs in whole cents, equal or by-head split with leftover cents shared out so shares add up, balances that sum to zero, and the fewest payments to settle. No money moves.
- **Rendezvous (S6-12):** a place and a time in port time, "on my way" and "here" per person, a no-signal fallback place after a grace period, and a quiet note to adults only when a child is late.
- **Tender day card (S6A-15):** ticket group, wait, last tender, weather switch and accessible-tender steps in one card (the existing tender card stays).
- **Routes:** `/ship/port/guide`, `/plan/split`. `/ship/port` gains the pilot, crowd, plan B, shared plan, back-aboard and meeting cards.
- **Verified:** `npm run test` (1265 passed), `npm run lint`, `npx tsc -b`, `npm run build`.
- **Not done:** audio for phrases and walks (text only; no recordings exist) and a map layer for walks; a port photo snapshot (S6A-14); split items in the trust ledger; shared state across devices (it only crosses people on the same device until a server holds it); a push or local notification for the back-aboard nudge (it shows when the page is open; critical-notice delivery and the nudge budget are not wired to it); real crowd, ship and hour data; rendered tests of the port-day screen with data (the first paint in tests shows the loading state); a rendered check (no browser testing by rule).

## 8. Phase H4 notes

Built 2026-11-01. Front end only; no server or REST contract changes (`api:check` not needed). State is per person on the device in `src/journey/store.ts` (door-to-ship plan, packing ticks, bag log, embarkation plan).

- **Door-to-ship timeline (S4A-01, S4A-11, S4A-12):** `src/domain/journey.ts` `buildJourney` works back from the terminal and forward from landing or the road time to give each leg, the spare time before the gangway closes (13:30) and a status: on track (2 hours or more), tight (1 to 2 hours), at risk (under 1 hour). Staying the night before starts the day at the hotel, with a checkout and leave-hotel time. `/plan/getting-there`.
- **Fly the day before (S4A-02):** `flyEarlyAdvice` recommends it when same-day spare time is under two hours, sets a hotel night beside the cost of missing the ship (authored guides, tagged "(verify)"), and names a landing time that would be comfortable.
- **Flight watch (S4A-04):** `flightStatus`, a stable simulated status per flight and date (`source: 'sim'`): mostly on time, some late, a few cancelled. A delay is pushed through the timeline so "at risk" shows early, and links to `/home/delayed`.
- **Ground transport, driving, conditions (S4A-06, S4A-07, S4A-12):** authored ground options (one step-free), pick-up notes that sit on the page offline, bags-first driving steps, a countdown to the window, and simulated traffic and weather with a "leave earlier" figure. There is no map; directions are text.
- **Packing split and bag log (S4A-09, S4A-10):** carry-on against checked lists with ticks, and a bag list with a "photographed" tick. **The app does not take or store pictures**; they stay in the phone's camera roll.
- **Arrival window (S5-01):** `src/domain/embark.ts` `recommendWindow` picks the quietest reachable window, earliest first; `swapEffect` shows the change in waiting and in when the guest is aboard.
- **Forecast, quiet lane (S5-02):** `forecast` gives walk and queue per step (terminal, security, photo, gangway) with an accessible lane always shown, a quiet lane option, and shorter queues for priority boarding. Queue times are a simulation from window crowd.
- **First three hours (S5-03), quick-start (S5-04):** the plan changes order by whether the cabin is ready (13:00); a five-line stateroom card with an authored steward name.
- **Family plan (S5-05), welcome (S5-06):** roles (together, ahead, parking), a plain warning when only children go ahead or a child is set to park, a meeting place and a ready tick per person, with the booking's check-in state. The welcome shares only the fields the guest ticks, and the wording is tested for selling words.
- **Routes:** `/plan/getting-there`, `/home/embarkation/plan` (linked from Plan and from Embarkation).
- **Verified:** `npm run test` (1310 passed), `npm run lint`, `npx tsc -b`, `npm run build`.
- **Not done:** an offline map and real pick-up points; real flight, traffic and weather feeds; parking booking; photos in the bag log; a per-person check-in status (the API gives the booking's only); sharing the family plan and the ETA across devices; the welcome reaching the ship; the delay screen taking its reason from flight watch; a rendered check (no browser testing by rule).

## 9. Phase H5 notes

Built 2026-11-01. Front end only; no server or REST contract changes (`api:check` not needed). State is per person on the device in `src/pilot/store.ts` (plan changes and their log, slot watches, week preferences, the inclusion settings). Calm mode is a display setting (`Settings.calm`).

- **One change rule (S6-02, XA-02):** `src/domain/planChange.ts`. Autopilot and the assistant both make a `Change`: it starts as a proposal with a preview; only an explicit accept applies it; accept is refused if it would make the day cross itself where it did not before, or after the day (Autopilot) or two hours (assistant) is over; an accepted change can be undone inside that period; a dropped item stays in the list struck through until the day ends; every decision stays in the log. A source test (`src/h5Promises.test.ts`) checks that no effect or timer calls accept or book.
- **Autopilot day (S6-02):** `/plan/autopilot`. "Check now" finds the ship's own mid-day changes (a show moved or cancelled), simulated rain and a what-if for late tenders, and proposes: move a show, swap a cancelled event for one that fits, move outdoor events indoors (a shore tour is left to its operator), start a tour later with a warning when the margin gets thin. A proposal is offered once per cause and day.
- **Gentle mode (S6-03):** `gentleNotes` adds a rest after three items close together, a drink before a hot outdoor item, a sun reminder for strong UV, and a warning for a long walk with little time. UV, heat and rain come from `simWeather` (`source: 'sim'`).
- **Week optimiser (S4-01):** `optimiseWeek` gives a week with nothing crossing at three paces (relaxed keeps tours easy and leaves some port days free), with mobility, a tour budget, kids and no-early-starts, an alternative per day, and the tour total.
- **Slot watch (S4-02):** `Watch` needs consent, a cap above zero, a title and a slot at least an hour ahead. An opening is simulated and stable. It ends as "a place opened" (within the cap) or "opened above your limit" (told, not offered); the guest books with one tap, through the confirm-before-charge check. A swap keeps the old slot until the new one is booked, then releases it in the same step. **Booking only changes the watch in this demo; it does not create a reservation.**
- **Ship Pulse, quiet spaces, lines (S6-01, S6-04, S6-05):** `src/domain/pulse.ts`, `/ship/pulse`. A simulated level per venue from the hour, less when guests are ashore, each with its age, confidence and "estimate"; a good time to go; five authored quiet spaces on real deck-map places with noise, shade, seating, step-free and hours; show, dining and service lines with the wait now, the shortest window in three hours and a link to the dining virtual queue where one exists.
- **Calm and inclusion (XI-01 to XI-05):** `/me/calm`. Calm mode (`data-calm`: one column, softened colour, motion off, countdowns hidden, no Home offer card); a sensory profile that warns about loud moments (horn at sail-away, the drill alarm, shows) and busy venues, lists the calmest times and spaces and points to the quiet lane; an eight-step social story in words; a now-next-later schedule that names what moved; a sensory-kit request (status is a simulation; **the line's own offer must be checked**); a simple support mode with a large "show me the way to my cabin" button; a caregiver who needs the guest's consent or a stated legal authority and never sees a location.
- **Ask your cruise (XA-01, XA-02):** `/home/ask`, `src/domain/assistant.ts`. Answers dinner time, what is next, what is left to do, a charge by amount (with the plain-English reason from H1) and all-aboard, each with its source; it says "I do not know" otherwise, and says it cannot see a list that has not loaded. "Move dinner to 8", "skip trivia" and "add the movie" show a preview and run through the same accept, conflict and undo rules.
- **Routes:** `/home/ask`, `/plan/autopilot`, `/ship/pulse`, `/me/calm`.
- **Verified:** `npm run test` (1390 passed), `npm run lint`, `npx tsc -b`, `npm run build`.
- **Found, not changed:** `DayWish.maxTour` is documented as cents but the excursion filter reads it in dollars, and the concierge tool `search_excursions` multiplies its dollar limit by 100 before the filter multiplies again. H5 converts in `wishOf`; the concierge tool is untouched.
- **Not done:** real pulse, line and weather feeds; a map layer for quiet spaces; pictures in the social story; the caregiver's own view (needs a server), and the sensory-kit request reaching the ship; assistant actions beyond the day plan (requesting an item, adding an excursion); the assistant inside the existing concierge chat; Autopilot proposals as Home cards counted against the nudge budget; the week optimiser applying a week to the plan in one tap; booking a watched place for real; real cabin routing for the cabin button; a rendered check (no browser testing by rule).

## 10. Phase H6 notes

Built 2026-11-01. Front end only; no server or REST contract changes (`api:check` not needed). State is per person on the device in `src/memory/store.ts` (journal, "what I would change", drinks and anniversary choices, contacts, blocks, package use, fit answers, budget). It is cleared with the other `princess:` keys.

- **Cabin chooser (S1-02 to S1-05, S1-07, S1-08):** `src/domain/cabinScore.ts`, `/home/cabins`. Sleep, motion and noise are each 1 to 5 (5 best) with the reasons in words (thrusters, engines, the Dome, lifts, the pool deck), from the authored sample plan in `cabins.ts`. Filters for quiet, calm seas, accessible, clear view and still free. Sun side from the ship's heading each day (`HEADINGS`, `source: 'sim'`): morning, afternoon, both or shaded, and an interior says nothing. Compare up to three, with the all-in price (gratuities and taxes already in), and a "not included in this fare" list from the entitlement numbers.
- **Dream and decide (S0-01 to S0-05, S0-10):** `src/domain/dream.ts`, `/home/decide`. An honest-fit page (who it suits, who it does not, seven "tick what is true for you" questions with plain answers, the tender port first), the six real fears and a glossary, a budget-first search (what fits, what is left each person each day, the nearest misses when nothing fits), a quality note per sailing (crowds, weather, hurricane season, school holidays, price; each with its "why", `source: 'sim'`), a decision summary (decided, still to do, could change my mind) to send to someone, and an invitation as text.
- **Wrapped, hindsight, anniversary, expenses (S8-01, S8-04, S8-07, S8-08):** `src/domain/wrapped.ts`, `/me/wrapped`. Quiet cards that never carry a name or cabin; drinks are opt-in and off. Package hindsight from what the guest paid and remembers using (worth, close or not worth, said plainly). "This day last year" only when switched on. A CSV of the folio with formula-looking text made safe, and print or save as PDF.
- **Memory book, reflections, next trip, contacts (S8-02, S8-03, S8-05, S8-06):** `src/domain/memoryBook.ts`, `/me/memories`. A note per day goes into a printable book (all eight days shown, even without a note) made on the device. "What I would change" notes are private unless marked shared, and a shared note has cabin numbers masked. The next trip is a draft after the 14-day gap, carries the lessons (drops a package that did not pay for itself), and books and holds nothing. Stay in touch: first name and one line, consent first, no emails, links or numbers, remove and block, a pretend reply, and a "sail again together" list only from accepted contacts once a draft exists.
- **Routes:** `/home/cabins`, `/home/decide`, `/me/wrapped`, `/me/memories`. Linked from Plan and the sailing page, and from Me.
- **Verified:** `npm run test` (1435 passed), `npm run lint`, `npx tsc -b`, `npm run build`. `src/h6Promises.test.ts` checks the promises above.
- **Already covered earlier, not changed:** loyalty in plain words (S8-10, `/me/loyalty`), honest referral (S8-11, `/me/rebook` and `postcruise.ts`), the marketing pause while a complaint is open (S8-09, `/me/marketing`), and data download and deletion (S8-12, `/me/privacy`). They were not re-checked against the new requirement text and may need a review.
- **Not done:** guest photos and obstruction notes for a real cabin (S1-06); dream board with votes (S0-06); continue from an outside assistant (S0-07); real-guest day stories (S0-08); occasion starter (S0-09); a link-previewable invitation (needs a server, so it is text); photos in the memory book and the group album (XG-05); family traditions (XG-04); a real "sail again" group and real contact exchange (needs a server and moderation); package hindsight from actual purchases (the guest types the amounts); a PDF made by the app (it uses the browser's print); the real deck plan and heading; a rendered check (no browser testing by rule).

## 11. Phase H7 notes (backlog, slice 1)

Built 2026-11-01. H7 has no fixed list, so the first slice takes four Should items that need no server and no new store, and the remainder stays the backlog below. Front end only; no REST contract changes (`api:check` not needed).

- **What happens if (S2-01):** `src/domain/whatIf.ts`, `/plan/what-if`. Cancel on a date, one traveller cannot go, the fare drops, move to another sailing; each shows dollars and dates through the same `cancelTerms` and `changeCheck` rules as the real screens, plus the dates the cost steps up. It only calculates; the screen makes no booking, cancel or payment call. Concept rules, said on the screen.
- **Payment calendar (S2-05):** the same screen. Deposit and balance with paid, due soon, overdue or later; what a missed final payment means in dollars; a calendar file with a reminder a week before and on the day for each instalment still owing (`buildIcsCalendar` in `calendar.ts`; `buildIcs` is unchanged in behaviour). A hosted, subscribable feed needs a server and is not done.
- **Sun, moon and stars (S6-07):** `src/domain/sky.ts`, `/ship/sky`. Sunrise and sunset from the date and an authored position for each day, in the ship's clock; the moon from the mean lunar cycle; constellations by month; the side of the ship facing the sunset; a note when sail-away falls at sunset. `source: 'sim'`, and the screen says times can be minutes out. **No planets** (no ephemeris feed), and the test checks none is named.
- **Briefing (XA-04):** `src/domain/briefing.ts`, `/home/briefing`. Morning (weather, what changed, all-aboard, first item, one thing to do) or evening (what is left tonight, sunset and moon, tomorrow's first item, one thing to do); at most five lines, each with where it came from, and a line with nothing to say is left out. Made only when opened (no timer or effect), read aloud from a button, or copied.
- **Assistant evaluation set (XA-09):** `src/domain/assistantEval.test.ts`. Fixed questions with required answers and sources, five questions it must decline or say it cannot see, and a check that every time or amount in an answer is in the facts it was given.
- **Routes:** `/plan/what-if`, `/home/briefing`, `/ship/sky`. Linked from Plan, Home and Ship. `src/h7Promises.test.ts` checks the promises above.
- **Verified:** `npm run test` (1478 passed), `npm run lint`, `npx tsc -b`, `npm run build`.
- **Not done in this slice:** the briefing as a Home card or a push (it would count against the nudge budget), a briefing text size set by the guest beyond the app's own setting, the sunset time for the real port, a map of where to stand.
- **Backlog left after slice 1 (see slice 2 below for what was taken):** S2-02 price-drop watch, S2-03 short hold, S2-04 pay-your-share links, S2-06 accessibility-first booking, S2-08 trip contract page, S2-10 draft-safe checkout; S3-01 per-person readiness, S3-02 document sanity checks, S3-03 weekly companion, S3-04 storm watch, S3-05 medical card, S3-06 packing for this ship, S3-11 away-from-home checklist, S3-13 allergy confirmation; S4-03 to S4-09 (honest difficulty, comparator, group poll, surprise mode, taste profile, budget bar, child brief); S6-09 to S6-10, S6-13 to S6-22, S6-25; S6A-08 to S6A-10; XG-01, XG-02, XG-07; XA-05 to XA-07, XA-10. Some may already be covered by the base phases and need a check before building.

### Slice 2 (document sanity checks, storm watch)

Built 2026-11-01. Front end only; no REST contract changes.

- **Document sanity checks (S3-02):** `src/domain/papersCheck.ts`, shown under each guest on `/me/documents`. The guest types the name as printed on the passport and it is compared with the booking (case, accents, hyphens and spacing ignored; middle name, swapped order, one or two letters out, or different). Also: passport expiry against the return date plus six months, the US adult birth certificate and photo ID combination, a certified-copy note, a passport for an overseas guest, and consent letters for a minor travelling with one parent or neither. Each problem links to a fix path. Rules, not scanning; nothing typed is saved or sent.
- **Storm watch (S3-04):** `src/domain/storm.ts`, `/plan/storm`. An authored typical chance by month for the route, a band in plain words, what the line may do, what the guest can do, and how much attention is sensible at this distance from sailing. `source: 'sim'`; it never says a storm is coming and raises no alert or notice.
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` (1495 tests passed; lint, tsc and build clean).
- **Not done:** S3-01 per-person readiness (needs a decision on how the checklist and documents combine per traveller); the real hurricane feed; a storm notice (it would count against the nudge budget).
- **Backlog left:** as in slice 1, minus S3-02 and S3-04.

### Slice 3 (away-from-home checklist)

Built 2026-11-01. Front end only; no REST contract changes.

- **Away-from-home checklist (S3-11):** `src/domain/awayHome.ts`, `/plan/away`. Fourteen items in five groups (people and pets, the house, money, work, health), each with a date counted back from sailing and a plain reason; one is marked overdue only while sailing has not started. The guest ticks items and adds up to ten of their own; ticks and own items are kept on the device in the H6 memory store (`away`, `awayExtras`). The list can be sent as text. No reminder, schedule or server call; a note says it is ideas, not advice about the home or insurance.
- **Verified:** `npm run test` (1503 passed), `npm run lint`, `npx tsc -b`, `npm run build`. `src/h7Promises.test.ts` checks the on-device promise.
- **Not done:** a shared copy that two people tick (needs a server); a reminder (would count against the nudge budget).
- **Backlog left:** as in slice 1, minus S3-02, S3-04 and S3-11.

### Slice 4 (medical card)

Built 2026-11-01. Front end only; no REST contract changes.

- **Medical readiness card (S3-05):** `src/domain/medicalCard.ts`, `/plan/medical`. Five lists (medicines with dose, allergies, conditions, devices that need power, vaccines), up to twelve lines of 80 characters each, repeats dropped. A section with nothing says "Nothing listed" so a blank is never read as "none". Kept on the device in the H6 memory store (`medical`); printed (browser print or save as PDF), copied as text, or cleared with one button. Said on the screen: written by the guest, not checked by a doctor, not medical advice.
- **Verified:** `npm run test` (1510 passed), `npm run lint`, `npx tsc -b`, `npm run build`. `src/h7Promises.test.ts` checks the on-device promise.
- **Not done:** the optional, consented pre-cruise notice to the ship's medical centre (needs a server and a privacy review); a lock or PIN on the card (it is in local storage like the rest of the memory store); per-traveller cards for a party.
- **Backlog left:** as in slice 1, minus S3-02, S3-04, S3-05 and S3-11.

### Slice 5 (finishing "Ask your cruise": plain-English summaries, handoff with context)

Built 2026-11-01. Front end only; no REST contract changes (the handoff uses the existing `support.email`).

- **Plain-English summaries (XA-05):** `src/domain/plainSummary.ts`, `/home/summary`. The day, the bill, or one of the four notices (terms, health, minimum age, pregnancy), at three levels: short (main points), plain (everything, a line each) and step by step (numbered, with the reason for each charge). Rules over the original, not a model: nothing is reworded. A notice keeps the original's own sentences (short keeps those with a number or a rule word). The original is always in the card beside it, with a link to its screen. `unsupportedNumbers` checks that a summary has no time, amount or number the original lacks. Read aloud from a button, or copy. "Summarise my day" and "summarise my bill" in Ask your cruise give the plain level, with the source and a link to the page. Made only when asked; nothing sent or saved.
- **Handoff with context (XA-06):** `src/domain/handoff.ts`, `src/ui/ai/HandoffCard.tsx`. When the concierge hands a guest to a person, the card shows the whole message: the question, the booking facts (name, sailing, number of guests, open checklist items) and the last of the conversation (at most 1000 characters; oldest turns go first). The guest ticks which parts to include, can edit the text, and sends it with a button. A medical handoff leaves the conversation out until the guest ticks it. An emergency makes no message: it shows the number. No card, passport or health data is ever added by the app.
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`. Four new cases in `assistantEval.test.ts` and two promise tests in `src/h7Promises.test.ts`.
- **Signature feature 11 (Ask your cruise, XA-01 to XA-06) is now complete** on the front end.
- **Not done:** summaries of free text the app does not hold (a long notice from the line is not in the app); a summary reworded by a model (kept rule-based so it cannot invent); the handoff arriving in the chat thread or the crew's own view (the message goes into Contact us as an email request, as before); XA-07 preference memory and XA-10 cost caps and a server-side key proxy (left on the backlog; the proxy needs backend work).
- **Backlog left:** as in slice 1, minus S3-02, S3-04, S3-05, S3-11, XA-05 and XA-06.

## 12. H8 slice 0: requirements audit (2026-11-01)

Method: every ID in `docs/leading-features-requirements.md` (183) checked against the phases this file records as built, the route list in `src/screens.ts`, and keyword checks of `src/domain` and `src/ui`. This is an inventory, not a line-by-line review: each "partly" item is opened and confirmed when its slice starts. No code changed.

**Result: 107 built, 76 open.** The 107 are H1 to H5 in full, H6 except the items below, and the H7 slices 1 to 5 (S2-01, S2-05, S3-02, S3-04, S3-05, S3-11, S6-07, XA-04, XA-05, XA-06, XA-09). S6A-09, S6A-11 and S6A-12 look uncited in code but are built (`src/domain/portContent.ts`: don't-bring-it-back lists, day passes, local-law notes), so they are not open.

| Group | Count | IDs |
| --- | --- | --- |
| Blocked (needs a server, moderation or guest photos; stays out of H8) | 7 | S1-06, S1-09, S3-09, S3-10, S6-11, XG-05, XT-09 (S1-06: the obstruction note is built, the photos are not) |
| Partly built (a stand-in exists; top up) | 16 | S1-01, S2-09, XT-08, S2-10, S4-08, S6-16, S6-22, S6-23, S7-01, S7-02, S7-03, S7-04, S7-08, S7-10, XI-06, XI-07 |
| Not built, doable on one device | 53 | S0-06, S0-07, S0-08, S0-09, S2-02, S2-03, S2-04, S2-06, S2-07, S2-08, S3-01, S3-03, S3-06, S3-12, S3-13, S3-14, S4-03, S4-04, S4-05, S4-06, S4-07, S4-09, S4-10, S4-11, S6-08, S6-09, S6-10, S6-13, S6-14, S6-15, S6-17, S6-18, S6-19, S6-20, S6-21, S6-25, S6-26, S6A-14, S7-06, S7-07, S7-09, XA-07, XA-08, XA-10, XG-01, XG-02, XG-04, XG-06, XG-07, XI-08, XI-09, XI-10, XI-11 |

What the partly-built items already have: S1-01 a price note per sailing in `dream.ts` but no per-room fare indicator; S2-09 and XT-08 a `/me/sustainability` screen but no estimate range with its method; S2-10 `/book/resume/:id`; S4-08 `/home/cruise/cost` without the 80 and 100 percent notes; S6-16 the cabin button on `/me/calm` linking to the deck map but with no words-only route; S6-22 per-day notes in `memoryBook.ts` but no automatic timeline; S6-23 crew thanks in `postcruise.ts`; S7-01 to S7-04, S7-08, S7-10 the disembark, customs, onward, final-night and feedback screens without the new behaviour; XI-06 read-aloud on the summary and briefing only; XI-07 a captions setting and captioned showings but no visual or vibration alerts.

Corrections to the H7 backlog list: XG-04 and XG-05 sit with H6's "not done" items; S4-11, S6-26, XG-06, XI-08 to XI-11, S2-07, S2-09, S3-12, S3-14 and all of S7 were missing from it and are now counted.

## 13. H8 slice A, part 1: booking and preparation (2026-11-01)

Front end only; no REST contract changes. Pure logic in `src/domain/bookingPrep.ts`, screens in `src/ui/plan/PrepScreens.tsx` (routes under `/plan`, linked from Plan), state per person in the H6 memory store (`hold`, `access`, `allergy`, `shares`). Promise tests in `src/h8Promises.test.ts`.

- **S2-02 price-drop watch** (`/plan/price-watch`): a simulated weekly fare history (same every time for a booking), lowest seen, whether re-pricing is allowed through the existing `priceDrop` rule, the saving and three steps; "Ask a person" goes to Contact us.
- **S2-03 short hold** (`/plan/hold`): 48 hours on the device; the time left is in words and shows on that screen only; lapses in words. Not tied to any cruise-line inventory, and the screen says so.
- **S2-04 pay-your-share ledger** (`/plan/shares`): even split to the cent, tick who has paid, owed and paid totals. No links, nothing collected.
- **S2-06 accessibility profile** (`/plan/access`): six flags plus mobility device, captured once; shows what the cabin chooser, dining, excursions and disembarkation will look out for.
- **S2-08 trip contract** (`/plan/contract`): booking, paid, not paid, rules, dates, who to ask; print or copy.
- **S3-01 readiness** (`/plan/readiness`): one number per traveller, each item weighted by `1 + days before sailing / 30`, papers counted double and listed first.
- **S3-13 allergy pre-flag** (`/plan/allergy`): allergies listed once; galley status is simulated (noted, then acknowledged after 12 hours) and labelled so. XI-09 can read `allergy`.
- **Verified:** `npm run test` (1549 passed), `npm run lint`, `npx tsc -b`, `npm run build`.
- **Not done in part 1:** S2-10 audit and Home "continue" card; S3-03 weekly companion; S3-06 packing for this ship; S2-07, S2-09 and XT-08 (guaranteed-cabin odds, carbon range); S3-12 and S3-14 (money plan, child trip story); S0-07 paste-a-plan; S0-08 and S0-09. Also: the accessibility profile is shown but the cabin chooser, dining, excursions and disembark screens do not yet read it; readiness uses the booking-wide checklist for everyone and per-guest papers only; the hold is not a Home card (it would spend the nudge budget).

## 14. H8 slice A, part 2: booking and preparation (2026-11-01)

Front end only; no REST contract changes. Logic in `src/domain/prepMore.ts`, screens in `src/ui/plan/PrepMoreScreens.tsx`, Home cards in `src/ui/home/PrepCards.tsx`; memory store gains `companionOff` and `pasted`. Promise tests in `src/h8Promises.test.ts`.

- **S2-10 audit:** the draft is already saved by the booking funnel and `/book/resume/:id` reopens it. Added a Home card "Pick up your booking" shown only when a draft with something in it exists.
- **S3-03 weekly companion:** one note per week from eight weeks out (`companionWeek`), a Home card that is silent when the nudge budget is zero or calm mode is on, with a one-tap "Turn these off".
- **S3-06 packing for this ship** (`/plan/ship-packing`): not-allowed list, plugs, dress nights from the same rule as `packing.ts`.
- **S2-07 guaranteed-cabin odds** (`/plan/guarantee`): authored history by category, labelled as concept figures.
- **S2-09 and XT-08 carbon range:** a card on `/me/sustainability` with a low to high range and the method written out.
- **S3-12 money plan** (`/plan/money-plan`): daily budget by sea or port day, cash for ports, rest on card; editable, not saved.
- **S3-14 child trip story** (`/plan/child-story`): ten short lines from the itinerary, printable.
- **S0-07 paste a plan** (`/plan/paste`): lines read into a draft, links and repeats dropped; only ticked lines are kept, on the device.
- **S0-08 and S0-09** (`/plan/starter`): occasion starter pointing at the first screens to visit, and authored day stories by style for the three port days.
- **Verified:** `npm run test` (1569 passed), `npm run lint`, `npx tsc -b`, `npm run build`.
- **Not done:** the day stories follow four styles, not the demo personas; kept pasted lines are shown but not yet merged into the day plan; the money plan is not saved and not tied to the bill; the carbon range uses seven nights, not the booked sailing's length; the Home continue card does not name the step reached.

Slice A is now complete apart from the part 1 gaps (screens that should read the accessibility profile, per-guest checklist).

## 15. H8 slice B: planning and groups on one device (2026-11-01)

Front end only; no REST contract changes. Logic in `src/domain/planning.ts`, screens in `src/ui/plan/PlanningScreens.tsx` (routes under `/plan`), state per person in the H6 memory store under one `planning` field. Promise tests in `src/h8Promises.test.ts`.

- **S4-03 honest difficulty** (`/plan/difficulty`): distance, steps, heat, shade, seats, restrooms and wet footing authored for all twelve excursions (tested), with concerns matched to the accessibility profile from slice A.
- **S4-04 comparator** (`/plan/compare`): ship against independent, with cost (estimate at 65 percent of the ship price), what happens if late, flexibility and cancelling.
- **S4-05 and S0-06** (`/plan/group-poll`): a poll (one vote per name, no winner on a tie) and a dream board with hearts, run on one phone and labelled so.
- **S4-06 surprise mode** (`/plan/surprises`): hidden items; `withoutSurprises` is the filter anything shared must pass, with a preview as the family would see it.
- **S4-07 and XA-07** (`/plan/taste`): every inference listed with its source, each removable, one switch for all (`tasteInferences`).
- **S4-08 budget notes**: a budget field on `/home/cruise/cost` with notes at 80 percent and over 100 percent of the cheapest option.
- **S4-09 child brief** (`/plan/child-brief`): written once, shown with only the fields the right club would see.
- **S4-10 rhythm** (`/plan/rhythm`): wake time, nap, late meals; one tap writes them into the week settings.
- **XG-01, XG-02** (`/plan/organiser`): counts from the party store and ledger; privacy defaults all off, medical never shareable.
- **XG-07** (`/plan/cabins`): cabins and their excursions, what is done together and what only some do.
- **XG-04** (`/plan/traditions`): checklist that carries over with boxes clear.
- **S4-02 follow-up:** "Put this week in my plan" on the week planner creates one accepted, undoable change per day through `acceptChange` (`applyWeek`).
- **Not done:** the assistant does not yet read `tasteInferences` (the store is ready); privacy defaults are stored but no shared screen reads them yet; the cabins' shared day is excursions only; the child brief is not tied to club check-in; shared copies of polls, boards and the organiser view across phones need a server.

## 16. H8 slice C: on board (2026-11-01)

Front end only; no REST contract changes. Logic in `src/domain/aboardMore.ts`, screens in `src/ui/onboard/AboardMoreScreens.tsx` (routes under `/ship`, linked from the Ship tab under "More on board"), state per person in the H6 memory store under one `aboard` field. Promise tests in `src/h8Promises.test.ts`. Reminder features say plainly on the screen that nothing is sent to anyone.

- **S6-09 seasickness first aid** (`/ship/seasick`): calmest places (midship, deck 8 or lower, step-free), what helps, when to see the doctor, a one-tap request whose reply is simulated after 30 minutes.
- **S6-10 lounger fair use** (`/ship/loungers`): a simulated board of eight; your hold is real on the device (40 minutes, "due back in X min", lapses), report one left too long.
- **S6-13 kids' report** (`/ship/kids-report`): simulated club summary from the child brief's age, shown only after the parent ticks consent.
- **S6-14, S6-15, S6-17** (`/ship/teen`, `/ship/ok-tap`, `/ship/solo`): teen agreement signed by both, an "I'm OK" tap with a due time, a solo timer with due and overdue states. On-screen only.
- **S6-16 audit:** `calm.ts` only linked to the deck map. Added a words-only route (lift bank, deck, side, number) as a card on `/me/calm` from a cabin number the guest types.
- **S6-18 do not disturb** (`/ship/dnd`): up to four schedules over midnight; the weekly companion obeys them; critical notices are never held (`dndNow`).
- **S6-19, S6-20, S6-21, S6-25** (`/ship/you-said`, `/ship/dining-prefs`, `/ship/steps`, `/ship/lost-found`): authored board, favourites and table preferences, typed steps with deck laps and goal days (no leaderboard), local lost report matched against an authored handed-in list.
- **S6-08 sightings** (`/ship/sightings`): the guest's log plus an authored, simulated "told about today".
- **Verified:** `npm run test` (1645 passed), `npm run lint`, `npx tsc -b`, `npm run build`.
- **Not done:** only the weekly companion obeys do not disturb (other Home nudges and the notification screen do not read it yet); the cabin number is typed, not read from the booking; the kids' report uses the child brief's age and name, not the club check-in; the lounger board, kids' report, found list and sightings are simulated; steps are typed, not read from a phone sensor; nothing here reaches another device, a crew member or a caregiver.
