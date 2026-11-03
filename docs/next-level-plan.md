# Next-level plan: from "feature complete" to best in class

Status: **Plan written 2026-11-02. N1 to N4 are built and N5 is built except N5.3 and N5.4; N6 is built (see the records at the end of its section); N7 is built except N7.4; N8 is started (N8.1 and N8.2 weather built, see its record).** Source: `docs/customer-journey-priorities.md` (the "journey doc"), checked against the code as it stands today.

## 1. How the audit was done, and how far to trust it

- Read `docs/leading-features-plan.md` (phases H1 to H8 and their "not done" lists), `docs/multi-device-plan-3.md`, `docs/backend-plan.md` and `src/auditGate.test.ts`.
- Counted routes, stores, server endpoints and providers; grepped `src` for capabilities the journey doc relies on (push, wallet, maps, audio, locales, referral, and so on).
- Ran `npm run test`: **123 files, 1547 tests, all passing.** I did not run lint, tsc or build, and I did not open any screen (no browser testing, by rule).
- **`dotnet` is not installed in this environment**, so no server C# could be compiled or run. Several recent commits say "C# not compiled". Treat the server as unverified until you build it.
- Keyword hits are evidence that something exists, not that it works well. Where a row says "Built" it means specified, tested in the domain, and wired to a screen; it does not mean good on a phone.

## 2. What the audit found

### 2.1 The journey doc's 20-item shortlist

| # | Shortlist item | Status | Evidence / gap |
| --- | --- | --- | --- |
| 1 | My Trips, one next action | Built | Base phases; Home continue card (H8) |
| 2 | Draft-safe booking and check-in | Built | `/book/resume/:id`, outbox, sync status chip |
| 3 | Boarding-pass failsafes | Built, partly simulated | `FindPassScreen`, printable pass; **Wallet is simulated** (no signed pass) |
| 4 | Real total price | Built | Fare tables served by `GET /reference/pricing` |
| 5 | Documents engine | Built | `documents.ts`, `papersCheck.ts`; no passport scan (camera) |
| 6 | Door-to-ship, "I'm delayed" | Built | `journey.ts`, `delay.ts`, `/feeds/flight` (simulated provider) |
| 7 | Three clocks, Port Day Pilot | Built | `portPilot.ts`, `ThreeClocks.tsx` |
| 8 | Schedule integrity | Built | OB-08 base phase |
| 9 | Offline-first | **Partial** | Caches and a sync chip exist; nothing proves a full offline day works |
| 10 | Two-tap rule, Get help now | Built, **narrow** | `nav.test.ts` covers the 15 top tasks only; 187 routes |
| 11 | Money shield | Built | `moneyShield.ts`, confirm-before-charge |
| 12 | Entitlement engine | Built | `entitlements.ts` |
| 13 | Atomic changes, resilient orders | Built (confirm depth) | Rules exist; one-file hit for the atomic rule, so re-read before relying on it |
| 14 | Disruption Hub | Built | `disruptionHub.ts`; hub text still authored in the client |
| 15 | Cabin chooser | Built, no photos | S1-06 guest photos missing |
| 16 | Family-at-home, child safety | Built | Server-issued signed links (`FamilyHomeEndpoints.cs`); zones |
| 17 | Accessibility, non-app parity | Built | WCAG audit test, print views, helper role |
| 18 | Autopilot, Ship Pulse | Built | Server-fed (`/feeds/pulse`, autopilot service) |
| 19 | Calm mode, sensory plan | Built | `/me/calm` |
| 20 | Memory loop | Built, no photos | PDF is the browser's print; no photos in the book |

**Conclusion: the specified features are almost all built.** The next level is not "more features". It is making what exists findable, deliverable, shared between people, verified, and real.

### 2.2 Real gaps, in order of how much they hurt a guest

| # | Gap | Evidence | Journey-doc impact |
| --- | --- | --- | --- |
| G1 | **Alerts only show when the app is open.** No web push, no service-worker notifications. The all-aboard escalation, back-aboard nudge, schedule change and disruption notice cannot reach a guest in a pocket | 0 hits for `PushManager` or `requestPermission`; H3 and H8 notes say "shows when the page is open" | Port Day Pilot, schedule integrity, Disruption Hub all lose their teeth |
| G2 | **Sharing between people is mostly one person's copy.** Polls, dream board, organiser view, split ledger, rendezvous and shared port plan are stored per user or per booking and labelled "run on one phone" | H8 slice B "Not done"; no poll or board endpoint in the server | Groups and family (Split ledger signature) is half a feature |
| G3 | **Findability.** 187 routes (Plan 52, Ship 46, Home 45, Me 40) on five tabs; only 15 tasks have a depth test. The top review complaint about the Princess app is features buried in menus | `routes.ts`, `nav.test.ts` | Contradicts rule 1 and the two-tap promise for everything outside the top 15 |
| G4 | **No maps, no audio, one language.** No graphic deck plan or port map (OB-04 is open), phrases and walks are text, only `en.ts`, "take me to my cabin" is a words route | 0 hits for tiles or map libraries; `src/i18n` has one locale | Wayfinding, Port Day Pilot, inclusion, international guests |
| G5 | **Unverified at the edges.** Server C# not compiled here; only 29 render cases for ~200 screens (first paint shows the loading state, not data); no bundle budget; no proof of an offline day | Notes in `multi-device-plan-3.md`; `render.test.tsx` | Everything above could regress silently |
| G6 | **All providers are simulated and there is no fallback wrapper.** Weather, flight, route, telemetry, staff queue and concierge are all `"sim"`; a real provider with a timeout would have nothing to fall back to | `appsettings.json`, `multi-device-plan-3.md` Phase 6 | Fine for a demo, a blocker for a real pilot |
| G7 | **No guest media.** No photo upload, so no real-cabin photos (S1-06), no group album (XG-05), no photos in the memory book or postcards | 3 files touch file inputs; none store images | Cabin chooser and memory loop are text-only |
| G8 | **A few small journey-doc ideas are untouched.** Trial-day simulator, "what I'd regret" cards, meeting-point card, shareable recap for someone at home, a one-tap cabin-service screen (the requests API exists; the assistant can ask for towels) | Zero hits for "regret"; no dedicated screens | Delight tier, cheap |
| G9 | **Unfinished loose ends from earlier phases.** XT-09 and S1-09 advisor link, S3-09/S3-10/S6-11/S8-06 moderated social features (blocked on a server), S8-10 benefit values, S8-11 referral, S8-12 full-history download, text-based emergency channel and interpreter times (XI-07), real exchange rates (ACC-07), passport scan | `leading-features-plan.md` §18 "Not done"; `gap-analysis-plan.md` §2 | Small, scattered |

## 3. Principles for the phases

1. **Keep the thin-client rule.** Anything a guest would miss on another device goes to the server (`CLAUDE.md`). New sources go behind a backend interface; the front end must not know whether data is simulated.
2. **Verify with the npm checks only** (`test`, `lint`, `tsc -b`, `build`, plus `api:check`, `db:check`, `db:seed:check` when the REST surface or schema changes). No browser testing, no full `dotnet test`.
3. **Server C# cannot be compiled here.** Each phase that changes C# ends with an explicit "please run `dotnet build`" line. If the build fails, fixing it is the first task of the next session.
4. **One phase per session.** Commit and stop at the end of each phase; start the next only when asked.
5. **Every phase must make something a guest would notice.** No pure refactors except N1.

## 4. The phases

Named **N1 to N8** to avoid the G, H and numeric phases.

| Phase | Theme | Closes | Size | Needs server C# | Depends on |
| --- | --- | --- | --- | --- | --- |
| N1 | Prove what is built | G5 | M | No | none |
| N2 | Findability | G3 | M | Small (search index) | N1 |
| N3 | Reach the guest (push and calendar) | G1 | L | Yes | N1 |
| N4 | Between people | G2, part of G9 | L | Yes | N1, N3 (nudges) |
| N5 | The way and the word (maps, audio, language) | G4, G9 (XI-07) | L | Small | N2 |
| N6 | Small delights | G8 | S to M | Small | N2 |
| N7 | Guest media | G7 | M | Yes | N4 |
| N8 | Real providers and pilot readiness | G6, G9 | L | Yes | N1, N3 |

Recommended order is N1 to N8 as listed. If you want the strongest guest-visible jump first, do **N3 right after N1**, then N2. If you plan a real pilot sooner, bring N8 forward after N3.

---

### N1. Prove what is built

**Goal:** be able to say, with tests, that the A-tier works with data in it and offline, before building on it.

| Slice | What | Notes |
| --- | --- | --- |
| N1.1 A-tier matrix | Turn §2.1 into `docs/a-tier-matrix.md`: for each A-tier row in the journey doc, the file, the test that proves it, and the "clear-to-use test" sentence | Mark anything without a test |
| N1.2 Rendered tests with data | Using the test fixtures in `src/testing`, render the screens behind the top 15 tasks and the emotional scenarios (§23.5 of the base doc) with data loaded, not just the loading state; assert the key text and the single next action | Extend `render.test.tsx`; keep node-friendly |
| N1.3 Offline day | A test that boots the stores from kept copies with the network off and checks the schedule, pass, deck map, menus and reservations still render with their age shown | Uses existing `useSavedCopy` caches |
| N1.4 Bundle budget | A test or build script that fails if the main chunk or any route chunk grows beyond a set size | Supports PERF-01 without a browser |
| N1.5 Server build check | Ask you to run `dotnet build` on `server/`; fix whatever breaks | The only slice that waits on you |
| N1.6 Fix list | Fix defects the above find; record the rest | Time-boxed |

**Done when:** every A-tier row has a test or an explicit "no test" note, the offline test passes, the budget is set, and the server builds.

**N1 record (2026-11-02):**
- **N1.1 done:** `docs/a-tier-matrix.md`. Logic is well covered; no test shows any screen with data in it.
- **N1.2 done:** `jsdom`, `@testing-library/react` and `@testing-library/dom` added as dev dependencies. `src/testing/harness.tsx` stubs `fetch` with a table of answers (`src/testing/fixtures.ts`: one signed-in person aboard on day 3) and renders the real app, so the real API client, guards, stores and screens run. `src/ui/dataScreens.test.tsx` has 17 tests covering the screens behind all 15 top tasks (UX-01), each written as the task's clear-to-use sentence. Other test files are unchanged and still run in `node`; only files with `// @vitest-environment jsdom` use the DOM.
- **N1.3 done:** `src/offlineDay.test.ts` (ten must-work-offline kinds are kept; every screen showing a kept copy shows its age; cache age rules). It found and fixed one defect: the plain-English summary showed a kept bill without its age.
- **N1.4 done:** `scripts/check-bundle.mjs`, `npm run bundle:check` (run after `npm run build`). First load 331 kB gzip of a 340 kB budget; the English strings are about 122 kB of that.
- **N1.5 done:** you confirmed the server builds and runs.
- **N1.6 fixes (from the new tests):**
  - **A guest with no signal waited for a spinner before the saved boarding pass appeared.** Loads retry with a growing delay (about 3 to 6 seconds in all) and the saved copy was shown only after the last try. Now an offline phone fails at once (`withRetries` no longer retries `offline`), and on a link that answers nothing the saved copy takes the spinner's place after 1.5 seconds (`SLOW_COPY_MS` in `useSavedCopy`).
  - The plain-English summary showed a kept bill without its age (found by N1.3).
- **Found, not changed:** 33 strings in `en.ts` say the app is a concept or "simulated" (for example the pass screen's "Pretend wallet for this concept" and the family page's "simulated in this concept"). That is honest for a demo, but it conflicts with the rule that the front end must not know whether data is simulated. It needs a decision before a real pilot (N8).

---

### N2. Findability

**Goal:** a guest can reach any feature in three taps or one search, and Home always shows the one thing to do next, whatever the stage.

| Slice | What | Notes |
| --- | --- | --- |
| N2.1 Stage-aware Home | Home shows a **journey strip** (where you are in the 11 stages) and the single next action across stages (pay, document, leave-by time, all-aboard, bag night). Offers stay below it | Builds on `briefing`, `readiness`, `stageAt` |
| N2.2 Hubs instead of lists | Group the 52 Plan screens into about eight hubs by stage (Money and contract, Documents and health, Travel day, Pack and prepare, Plan the week, Group, Wish list, Rules and promises). Same for Ship (46) and Me (40). Old paths keep working | Pure routing and layout; no logic moves |
| N2.3 One search | Extend `searchIndex` to cover every screen and feature by plain words ("allergy", "taxi price", "late", "towel"), with recent items; reachable from every tab | OB-07 |
| N2.4 Depth budget for all | Replace the 15-task test with a rule: every `ROUTES` entry has a stage, a hub parent and a depth of at most three taps from Home, or the test fails. Add 25 more named tasks (stage-specific) with a two-tap target | Extends `nav.test.ts` |
| N2.5 Plain labels | Review the hub and button labels against the journey doc's "clear-to-use test" sentences; fix jargon | Strings in `en.ts` |

**Done when:** the new test passes, no route is more than three taps deep, search finds each screen by at least two plain phrases, and the Gerald and Linda tests in the base doc §23.6 still pass for the new hubs.

**N2 record (2026-11-02):**
- **N2.1 done:** `JourneyStrip` (eleven stages, current one marked, one "Next:" link for the stage) at the top of Home, for a booked or aboard guest. The stage comes from `stageAt` through `useJourneyStage`. The action is one fixed screen per stage (`STAGE_ACTION`); the live next step (pay, documents, leave-by, all-aboard, bag night) is still the existing `NextStep`, nudge and on-board cards below it. Not merged into one computed action.
- **N2.2 done:** `src/routes/hubs.ts` files every screen in one hub of its tab (Home 5, Plan 7, Ship 5, Me 5) and keeps a short "Most used" list per tab. `HubList` shows both on Home, Plan, Ship and Me; the hub for the guest's current stage opens by itself. No path moved, so no redirects were needed.
- **N2.3 done:** every screen has plain phrases (`screenWords.ts`) and the search index uses them; Search is a link in the top bar, so it is on every tab; the last five screens opened from search are kept on the device (`settings/recentSearches.ts`).
- **N2.4 done:** `hubProblems()` fails the test if a screen has no hub, is in two hubs, or is more than three taps from launch (tab, open the hub, tap the screen; id screens are one below their list). 25 stage tasks (`FIND_TASKS`) must come up in the first five search results. The 15 top tasks and their two-tap test are unchanged.
- **N2.5 partly done:** hub labels were written in plain words. A full review of every button label against the journey doc's sentences was not done.
- **Not done:** the Gerald and Linda tests in the base doc 23.6 were not run for the new hubs (they are manual).

**Risk:** moving screens can break deep links and bookmarks. Keep the old paths as redirects, and keep the existing `screens.ts` registration test.

---

### N3. Reach the guest

**Goal:** the safety and schedule alerts the app already knows how to compute arrive on the phone, within the guest's own limits.

| Slice | What | Notes |
| --- | --- | --- |
| N3.1 Service worker and permission flow | Custom service worker alongside `vite-plugin-pwa`; a permission request that appears in context ("Allow all-aboard warnings?"), never on first load | iOS only works once the PWA is installed; say so on the screen |
| N3.2 Server push provider | `IPushSender` interface with a simulation (records, delivers nothing), subscription endpoints, and a queue that applies the **nudge budget, do-not-disturb and calm mode on the server**; critical safety notices bypass them | New C#; `db` table for subscriptions |
| N3.3 The first five notices | All-aboard escalation (final hour), back-aboard party nudge, schedule change on a bookmarked item, disruption notice, payment due | Reuses `nudges.ts`, `portParty.ts`, `OB-08` rules |
| N3.4 Subscribable calendar | A signed, revocable `.ics` feed per guest (payments, itinerary, port-day plan) | Replaces the one-off file; S2-05 |
| N3.5 Wake Lock and badge | Screen Wake Lock on the boarding pass and rendezvous screens; unread badge | LF §20 |
| N3.6 Delivery log | The guest can see what was sent and held, and why (ties to the trust ledger) | XT-07 |

**Done when:** a notice created by the server reaches the service worker in tests (simulated sender), the budget and quiet rules are enforced server-side and unit tested, and the screen tells the guest honestly what their browser can and cannot do.

**N3 record (2026-11-02):**
- **N3.1 done:** `public/push-sw.js` (push and tap handlers) is loaded by the generated worker through `importScripts` in `vite.config.ts`; tested by running the real script against a stand-in worker scope (`src/push/serviceWorker.test.ts`). `PushSwitch` asks only on a tap, in context ("Allow all-aboard warnings?" on the port day, "Get alerts on this phone?" on Notifications), and says honestly when the phone needs the app on the Home Screen (iOS), the browser cannot do it, the browser blocked it, or the server cannot send.
- **N3.2 done:** `IPushSender` (seam `Providers:PushSender`, simulation `SimPushSender` records and delivers nothing; its key is a real P-256 point so a browser can subscribe), `PushService`, `/me/push*` endpoints, tables `PushSubscriptions`, `PushDeliveries`, `CalendarFeeds`. The budget, calm mode, quiet hours and the push channel per category are applied on the server in `PushRules.Decide`; safety notices (all-aboard, a critical disruption, an overdue payment) bypass them. With several phones the strictest limit applies.
- **N3.3 done:** the five notices are built in `PushRules.Build` from what the server knows: all-aboard in the final hour (60, 30 and 10 minute steps), the back-aboard nudge (a person in the port rows not marked back, inside the guest's lead time), a schedule change on an event in the day the guest built, a disruption, payment due or overdue. Each is sent once (stable key).
- **N3.4 done:** `GET/POST/DELETE /me/calendar-feed` and the public `GET /calendar/{token}.ics`: payment date, each day, and all-aboard times with a one-hour reminder. Only a hash of the token is stored, so the address is shown once; a new one cancels the old.
- **N3.5 done:** `useWakeLock` (one place, now also used by the boarding pass and the meeting place screen) and the app-icon badge from the unread count.
- **N3.6 done:** "What we sent you" on Notifications: each alert sent or held back with the reason.
- **Decisions and limits (read these):**
  - **Web Push, not SignalR.** Push has to reach a closed or backgrounded app; a SignalR connection only exists while the app is open. SignalR could be added later for live in-app updates (N4's shared rendezvous), alongside this.
  - **Nothing is delivered for real yet.** The simulated sender records only; a real Web Push sender with VAPID keys is N8. Until then the log shows what would have been sent.
  - **The check runs when the app asks** (on open, on return to the front, every five minutes while visible) through `POST /me/push/dispatch`. A scheduler calling `PushService.DispatchAsync` for every subscribed person is the missing piece for alerts to a phone with the app closed; the rules do not change.
  - "Bookmarked item" is the events in the day the guest built on the Build my day screen (the server has no other list of saved events).
  - The C# was written without a compiler on this machine (no `dotnet`), so `PushRulesTests.cs` and the server build have **not been run**; build the server before relying on them.


**Risks:** push permission is easy to annoy people with; the Wallet pass (real Apple/Google signing) is deliberately **not** in this phase because it needs certificates (a decision for you; see §6).

---

### N4. Between people

**Goal:** a party actually shares a plan across their phones, with consent and privacy defaults enforced by the server.

| Slice | What | Notes |
| --- | --- | --- |
| N4.1 Party-scoped state on the server | Membership checks, per-member visibility using the XG-02 privacy defaults, and a change log; extends the existing booking-scoped state | The one piece everything else needs |
| N4.2 Poll, dream board, shared port plan | Move from "one phone" to real shared votes and plans; one confirmation each | S4-05, S0-06, S6A-06 |
| N4.3 Split ledger and pay-your-share | Shared costs visible to all families in the party; settle-up status; payment links for shares (card charging stays simulated behind the existing gateway) | XG-03, S2-04 |
| N4.4 Rendezvous, ETA and back aboard across phones | Each person's "on my way / here" state is shared; nudges use N3 | S6-12, S4A-08, S6A-05 |
| N4.5 Organiser dashboard | Real roster, payments, documents and check-in status from the server | XG-01 |
| N4.6 Caregiver and advisor views | Consent-based, revocable, read-only views (caregiver check-in, advisor progress link); never a live location | S6-15, XI-05, XT-09, S1-09 |
| N4.7 Opt-in "stay in touch" | Mutual-consent contact exchange within a sailing, block and report, tiny directory | S3-09, S6-11, S8-06; **keep optional**, may be cut if moderation is not available |

**Done when:** two simulated people on one booking see each other's updates; privacy defaults are enforced on the server and tested for every shared view; revoking consent removes access immediately.

**N4 record (2026-11-02):**
- **What was already shared before N4 (found, not rebuilt):** the port day's presence, "I'm back", the shared plan, meeting places with each person's state, and the split ledger (families, expenses, settled-at) have been saved as booking-wide rows since multi-device plan 2, Phase 6 (`PortRows`, `src/port/rows.ts`). N4.3 (split ledger) and N4.4 (rendezvous, "back aboard") were therefore mostly done; the back-aboard nudge to the party is the N3 notice built from those rows.
- **N4.1 done:** membership is checked on every route (any guest reads, an adult guest writes, a child is read-only). Each person's four sharing switches (`plans`, `status`, `spending`, `photos`; the medical card has no switch and is never shared) are kept in their own `sharing` document, off by default, saved to the account and read by the server (`PartyRules.Shares`). `GET /bookings/{n}/party-log` is the change log of the shared plan (newest 30 changes to polls, ideas, meeting places, the ledger).
- **N4.2 done:** the group poll and dream board moved from one person's memory to the booking's rows (new kinds `poll`, `vote`, `idea`, `heart`; a vote is a row of its own per person, so two phones voting at once both count). The "run on one phone" screen is now "everyone votes from their own phone, one vote each". `src/domain/board.ts` holds the logic. The shared port plan already existed (see above).
- **N4.3 partly done:** the split ledger is shared already. **Not done:** payment links for shares and a server-held pay-your-share ledger (`/plan/shares` is still one person's list in their private notes).
- **N4.4 already done:** see above. Nothing new was needed.
- **N4.5 done:** `GET /bookings/{n}/organiser`: the roster, each person's check-in progress and documents on file **only if they share their status** (or it is the person themself, or the booker of a supervised child), and the money for the booker alone. The Organiser screen reads it. **Not done:** per-person payment status (the booking is paid as one).
- **N4.6 done:** `ShareLinks` table, `/bookings/{n}/share-links` and the public `/public/share/{token}` with the page `/shared/:token`. A caregiver link shows the ship, the dates, days to go, whether check-in is finished and the guest's "I am fine" note; an advisor link (booker only) shows paid or not, check-in progress (only people whose status the booker may see) and the head count. Neither shows a position, a medical detail or an amount. Only a hash of the secret is stored and the address is shown once; ending a link deletes it, so access stops at once. Links last 120 days and a guest may have six. **Not done:** the guest cannot yet pick which facts a caregiver sees (the list is fixed and written on the screen).
- **N4.7 not built (cut, as the plan allows):** mutual-consent contact exchange needs moderation (block and report review) that does not exist. The existing local contacts screens are unchanged.
- **Decisions and limits (read these):**
  - **The sharing switches decide what the organiser view and the share links show.** The poll, board, meeting places and ledger are shared with the whole booking by being used, not by a switch: opening them is the act of sharing, and the screens now say so. The `plans`, `spending` and `photos` switches are saved and visible to the server but no other screen reads them yet.
  - **No live push between phones.** A phone sees another's vote at the next sync (a few seconds after it sends, and on return to the front). SignalR is still the option if that is too slow.
  - **The C# was written without a compiler on this machine** (no `dotnet`), so `PartyRulesTests.cs` and the server build have **not been run**. Please run `dotnet build` on `server/`; fixing any error is the first task of the next session. No API-level tests were written for the new routes (the in-memory test stores do not cover `IShareStore`).
  - The first load is now 339.0 kB gzip of the 340 kB budget; the next phase that adds English text must raise the budget or trim.
  - Found and fixed on the way: `t('poll.votes', { n })` and the same for hearts and the organiser counts passed `n`, but a plural form is chosen by `count`, so those lines showed their key. They now pass `count`.

---

### N5. The way and the word

**Goal:** guests can find their way, hear it, and read it in their language.

| Slice | What | Notes |
| --- | --- | --- |
| N5.1 Graphic deck plan | Inline SVG deck plans from the ship data already served (`/reference/ship`), with accessible routes, lifts, muster stations, the quiet-space layer and "you are here" when the guest chooses | OB-04 (open since the base plan) |
| N5.2 Real cabin routing | Build a small graph from the deck data so "take me back to my cabin" gives true step-by-step words (and the line on the map) | Replaces the words-only guess in `calm.ts` |
| N5.3 Port maps offline | Small bundled static maps for the three port days with walking lines for the self-guided walks; no tile service | Keep each under a size cap (N1.4) |
| N5.4 Audio | Pre-recorded phrase and walk audio for the three ports where the line supplies it; the existing browser read-aloud as fallback | Needs content from you |
| N5.5 Locales | Split `en.ts` into per-locale files, add Spanish first (ports are Mexico, Belize, Honduras), a language switch on the first screen, currency and units follow | DIS-18; the largest slice |
| N5.6 Deaf and hard-of-hearing | Interpreter times and a text-based emergency channel (a text request that reaches the desk, simulated) | XI-07 |

**Done when:** the deck plan passes the accessibility audit (keyboard, labels, contrast), each deck route is covered by a graph test, and the locale test fails if a key is missing in Spanish.


**N5 record (2026-11-02):**
- **N5.1 done:** `DeckPlan` draws a schematic SVG of each deck (bow at the left, port above) from the same places, lift banks and muster stations as the text lists (`src/domain/deckPlan.ts` holds the geometry). It is one labelled image (`role="img"`, title and description), with a numbered key under it carrying every fact, a sideways-scroll region reachable by keyboard, and marks that never rely on colour (muster letters, a ring for quiet spaces, a dashed outline for steps). "You are here" appears only if the guest picks a nearby place; nothing is sensed or sent. The quiet-space layer uses an authored list (`QUIET_PLACE_IDS`).
- **N5.2 done:** `src/domain/deckGraph.ts` builds a graph (a hall per section per deck, a lift node per bank per deck, a shaft per bank) and finds the shortest way with Dijkstra. `routeBetween` now puts that way into words and returns the waypoints, so the same way is drawn as a line on each deck it crosses. Either end may be the guest's cabin (`cabin:8123`); the route finder offers "My cabin" and a "Take me back to my cabin" button. Tests cover a way between every pair of listed places.
- **N5.5 partly done:** the app has a language setting (`settings.language`, per device, not synced) with a switch on the sign-in screen and in display settings. Spanish (`src/i18n/locales/es.ts`) is a separate download, loaded only when chosen, so first load is unchanged. It covers the shell, tabs, every page title, the deck map and route finder, and the display settings; a test fails if a key in those groups is missing in Spanish or its `{values}` differ from English. Other screens fall back to English and the switch says so.
- **Not done:** N5.3 (port maps: needs real, checked geography and walking lines; I did not draw maps I cannot verify) and N5.4 (audio: needs recordings from the line).
- **Limits (read these):**
  - **Cabin position is a guess.** The deck is read from the cabin number, and the section from the last three digits (under 200 forward, under 350 midship, otherwise aft). The real number-to-position table must replace `cabinPlace` before real use.
  - **`<html lang>` follows the chosen language, but screens still in English are not marked `lang="en"`.** That is a WCAG 3.1.2 gap until Spanish covers all screens.
  - The Spanish was written without a native review. Have a Spanish speaker check it, especially nautical words (proa, popa, camarote, cubierta).
  - No server change in this phase, so no `dotnet build` is needed.


**N5 follow-up record (2026-11-02): N5.6 and the N5.5 leftovers**
- **N5.6 done:** screen `/ship/text-help` ("Ask for help by text"). A guest writes up to 300 letters, may say which place they are near, and sends it as a health request of the new kind `textHelp` (the existing `/health/requests` route, so no new table; `HealthRules.RequestProblem` requires words for this kind). The screen opens with a warning that a text is not an alarm and points to the emergency number, the emergency card and the nearest crew member before the form; a failed send says in bold that the message was NOT sent. Replies are described as "usually within 10 minutes" (`RESPONSE_MINUTES.textHelp`, an authored figure). It lists the signed-show times from the catalogue as interpreter times. Children see the warning and the read-only note, not the form. It is in the Ship safety hub and in search.
- **N5.5 leftovers done:** language files now live in `src/i18n/locales/` (`en.ts`, `es.ts`); the i18n test skips that folder when counting used keys. Units follow the language (Spanish starts on metric) until the guest picks units themselves (`settings.unitsChosen`, per device). **Currency deliberately does not follow the language:** it is a booking-wide display choice, a language does not say which country a guest lives in, and every charge is in US dollars; the settings text says so and the currency link is next to it.
- **Not done:** splitting English into lazily loaded screen groups to cut first load (it would make `t()` asynchronous); dates and numbers are still formatted for US English.
- **The server delivers nothing to a person yet.** The message is stored and listed, like every other health request; a real desk integration (staff view, paging, a service level) is N8. Until then the reply time is only a statement, so the wording tells the guest to use the alarm first and not to wait.
- **C# not compiled here:** please run `dotnet build` on `server/`. Changed: `HealthRules.cs` (`RequestProblem`, the new kind), `HealthService.cs`, and `ShipboardRulesTests.cs` (new tests, not run). `server/Princess.Api/Content/reference-content.json` was regenerated with `npm run content:gen`.

---

### N6. Small delights

**Goal:** the cheap, memorable ideas from journey doc §16 that nobody else has.

| Slice | Idea | Notes |
| --- | --- | --- |
| N6.1 | **Trial-day simulator** ("a Tuesday on this ship, for you") on the public side | Uses the day plan feed and the taste profile; no sign-in |
| N6.2 | **"What I'd regret" cards** on cabins and itineraries | Seeded from the reflections feature and authored content; one line each, with the evidence |
| N6.3 | **Cabin service in one tap** (towels, turndown, do not disturb, "fix this") with status | Reuses the requests API and the assistant's quantity rules |
| N6.4 | **Meeting-point card** for drop-off and pick-up | A shareable link with address and a picture-free landmark description |
| N6.5 | **Share the cruise with someone at home** | A recap link on the family-at-home mechanism, with no account |
| N6.6 | **Private crew thank-you** | Already partly in `postcruise.ts`; add the "crew see the note, never the tip" display and test |
| N6.7 | **Currency helper** | Real exchange rates through a provider (ACC-07), offline last-known with age |

**Done when:** each has a plain-language "clear-to-use" test in `render.test.tsx` and passes the dark-pattern and no-shaming tests.

**N6 record (2026-11-02):**
- **N6.2 done:** `src/domain/regret.ts`. Cabin cards (at most three) are read from the server's own scores and reasons (a blocked view, weak noise, motion or sleep scores, no window on an inside room) and each quotes the reason it came from. Route cards come from the served timeline, port guides and clock changes (a tender port, a short stay, two or more sea days, the ship's clock moving). No evidence means no card. They show on the cabin chooser and on the cruise page, under a note that none of it is a reason to buy. A test checks that no card uses pressure words.
- **N6.3 done:** a "Most asked" row at the top of the requests screen (towels, turn-down, ice: one tap each, same rules as the list below), with a link to Do not disturb and a link down to the repairs ("Something is broken"). Status is the existing list. The full list is unchanged.
- **N6.4 done, as a card and not as a link:** screen `/home/meeting-point` builds a written card (address, time, a landmark in words, a map link, an optional phone line and note) on the device. The guest copies it, sends it from their own messages (Web Share where the phone has it) or prints it. Nothing is stored or sent from here. **A shareable link needs a server endpoint and is not built.** The landmark wording is authored; verify it with the port.
- **N6.6 done:** `crewNotes` in `postcruise.ts` builds exactly what a thanked crew member sees (the note, and the guest's first name only if allowed). The feedback form shows that preview. The function takes no tip input, and a test checks that the output carries no tip, amount or rating. **The server side is not checked here:** the C# must also leave tips and ratings out of anything shown to crew.
- **Not done:** N6.1 (the trial-day simulator needs a public server endpoint that builds a day from a taste profile with no sign-in; the day plan feed is per guest today), N6.5 (the recap link for someone at home needs a signed link and an endpoint on the family-at-home mechanism) and N6.7 (real exchange rates need a provider, ACC-07). These three need server C#.
- **Bundle:** the first load went to 342.8 kB gzip, so the budget in `scripts/check-bundle.mjs` is now 350 kB. The English strings are still the cause; lazy loading them is still not done.
- Spanish has only the page title for the new screen (the i18n test requires it); the rest falls back to English.
- No C# changed, so no `dotnet build` is needed.

**N6 follow-up record (2026-11-02): N6.1, N6.5 and N6.7**
- **N6.1 done:** screen `/trial-day` ("A day on this ship"), the first screen a visitor can open with no account besides the family page (`isPublicPath` in `routes.ts` now decides this, and no longer matches a route's neighbours by accident). The visitor picks a day, interests, how they get around and whether children come; the server builds the day with the same rules as the signed-in "Build my day". **Design decision:** the reference tables need a sign-in, so a visitor's device holds no sailings or itinerary. The new route `POST /public/trial-day` therefore takes only `{ day, wish }`, chooses the sailing itself (the next one to leave, else the last) and answers `{ days[{ day, port, place }], plan }`, so the page needs no client-side ship data. Rate-limited by address (it shares the pass-lookup limiter, 10 a minute). It keeps nothing, and the page says so. The signed-in taste profile is not used (it is a signed-in document); the visitor answers the same few questions instead.
- **N6.5 done:** a "Share the cruise with someone at home" section on the family-link screen. The text starts from the trip-memories recap, the guest reads and edits every word, and `PUT /me/family-recap` keeps it (12 lines, 200 characters a line, 800 in all; nothing is cut, a text over a limit is refused with `badRecap`). The family page shows it under the guest's first name; `DELETE /me/family-recap` removes it. It sits in the guest's own `familyRecap` state document, so it is removed by the account-deletion and retention paths that clear state. It reuses the existing signed links, so there is no account, a stopped link shows nothing, and the page still never shows where the guest is. **Limit:** the screen cannot tell the guest whether a recap is already posted (there is no read route for it), so "Take it off the page" is always offered.
- **N6.7 done (server side; the screen already existed):** the exchange-rate source is now a seam. `Providers:Rates` is `sim` (default, as before) or `http`, a Frankfurter-compatible feed (`Rates:BaseUrl`, default `https://api.frankfurter.dev/v1`, no key). `RateService` asks it at most every six hours however many devices ask, keeps the last good table, and when the feed fails serves that table with its own older date, or with none ever the sample table dated 2026-10-01, so the app's existing "out of date, {days} days old" line shows. **Limits:** the Belize dollar is pegged and the Honduran lempira is not an ECB currency, so both keep their authored sample rates even on the real feed (the table shows one date for all). Nothing marks those two as not live. The `http` provider was not run against the real service from here.
- **Verified here:** `npx tsc -b`, `npm run lint`, `npm run test` (140 files, 1686 tests), `npm run build`, `npm run bundle:check` (first load 346.2 kB of 350), `npm run api:check` and `npm run db:check`. **Not verified:** none of the C# has been compiled or run.
- **Please run `dotnet build` on `server/`.** Changed or new: `Domain/RatesRules.cs`, `Services/RateFeed.cs` (new), `Services/ProviderRegistration.cs`, `Endpoints/ReferenceEndpoints.cs`, `Services/AutopilotService.cs` (new constructor argument `IClock`), `Domain/DayPlanRules.cs`, `Endpoints/ConciergeEndpoints.cs`, `Domain/FamilyHomeRules.cs`, `Services/FamilyHomeService.cs`, `Endpoints/FamilyHomeEndpoints.cs`, `appsettings.json`, and tests `RatesTests.cs`, `FamilyRecapTests.cs` (new) and `SwaggerCoverageTests.cs`. If it fails, fixing it is the first task of the next session.

---

### N7. Guest media

**Goal:** real photos where a guest would expect them.

| Slice | What | Notes |
| --- | --- | --- |
| N7.1 Upload pipeline | Server image upload with size and type limits, scanning hook, EXIF stripping, per-guest storage and deletion | New C# and schema; `db:check` |
| N7.2 Cabin photos and obstruction notes | Guests submit photos for a cabin they stayed in; light moderation queue (simulated); shown on the cabin chooser | S1-06 |
| N7.3 Memory book with photos | Photos the guest chose go into the book; the PDF is generated on the device | S8-02 |
| N7.4 Group album | Shared album for a party, each person's privacy choice enforced | XG-05, depends on N4 |
| N7.5 Postcards with a photo | Add a photo to a family-at-home postcard | S6-24 |

**Risks:** storage cost, moderation and privacy of children's images. Do not show other guests' photos until the moderation answer is settled.

**N7 record (2026-11-02):**
- **N7.1 done (server and app):** `POST /me/media` keeps a JPEG or PNG sent as the request body. The server reads the real type from the bytes, refuses more than 2 MB, 8000 pixels a side or 25 million pixels (`MediaRules`), passes it to an `IMediaScanner` (a provider seam, `Providers:MediaScanner`, simulated: it refuses the antivirus test string), strips the EXIF/XMP, comments and other application blocks from a JPEG and every chunk but the drawing ones from a PNG, and keeps it in the new `GuestMedia` table under the guest (40 pictures, 20 MB; deleting the account deletes them by cascade). A supervised child cannot keep pictures. The app shrinks a picture to 1600 pixels on a canvas first (`src/media/shrink.ts`), which also turns it upright; that is a courtesy and the server does not rely on it. `Http` gained `upload` and `blob`, because an image tag cannot send the sign-in token: a picture is fetched with it and shown from an object URL that is let go afterwards.
- **N7.2 done:** the cabin chooser has a "Pictures of this room type" card. A guest who ticks "I stayed in this type of room" adds a picture of the room, the view, something in the way or noise, with a caption. The server cannot check that they stayed, so the tick is a statement, not proof. A picture is `pending`, and the simulated moderator calls it `approved` after 10 minutes. **Other guests' pictures are not shown unless the server runs with `Media:ShowOthers=true` (default off)**, following the plan's rule; the card's words say a picture is checked first and that other guests' pictures may not be shown yet, and promise only that the guest's own are always shown to them.
- **N7.3 done:** the memory book takes pictures for the front page and for each day. They are kept on the server for the guest only, shown in the book on the page and printed with it (the PDF is the browser's own print-to-PDF, so it is made on the device). They are **not** in the copied text.
- **N7.5 done:** a postcard can carry a picture. The guest adds it first (it needs signal, so it cannot wait in the offline queue and the send buttons say so), then sends the postcard with `photoId`. The family page shows it through `GET /public/family/{token}/photos/{id}`, which works only for a live link and only for a picture on a postcard the page shows. `FamilyPostcards.MediaId` has no foreign key (SQL Server rejects the second cascade path from Users); the media store clears it when the picture is deleted, and the public route also checks the picture still exists.
- **Not done:** **N7.4 (group album).** It needs each person's privacy choice on every picture and a party-wide list, and it must wait for the moderation answer that this phase deliberately did not settle (children's images in a shared album most of all). The `GuestMedia` table, the cleaning and the scanner are what it would build on.
- **Limits (read these):**
  - **Moderation is simulated.** Nothing is ever `rejected` by the simulated moderator, so a real one must replace `MediaRules.EffectiveStatus` before `Media:ShowOthers` is turned on. There is no staff view of the queue.
  - **JPEGs with metadata after the first scan** (rare multi-scan files) are copied as they are. The usual EXIF block comes before the scan and is removed.
  - **A picture has no alternative text beyond the caption the guest writes**; without one a screen reader hears "Picture from day N" or the cabin kind. Nothing describes a picture's content.
  - **The offline book:** pictures need a connection to load; the book prints without them when offline.
  - The cabin card is not in Spanish (the keys fall back to English).
  - Pictures live in SQL Server (`VARBINARY(MAX)`); at any scale they belong in blob storage behind `IMediaStore`.
- **Verified here:** `npx tsc -b`, `npm run lint`, `npm run test` (143 files, 1702 tests), `npm run build`, `npm run bundle:check` (first load 347.3 kB of 350), `npm run api:check` and `npm run db:check`. **Not verified:** none of the C# has been compiled or run (`dotnet` is not installed here).
- **Please run `dotnet build` on `server/`.** New or changed: `Domain/MediaRules.cs`, `Services/MediaService.cs` (with `IMediaScanner`), `Data/MediaStores.cs`, `Data/DapperMediaStore.cs`, `Endpoints/MediaEndpoints.cs`, `Program.cs`, `Services/ProviderRegistration.cs`, `Data/FamilyHomeStores.cs`, `Data/DapperFamilyHomeStore.cs`, `Services/FamilyHomeService.cs` (new constructor argument `IMediaStore`), `Endpoints/FamilyHomeEndpoints.cs`, and tests `MediaTests.cs`, `Support/InMemoryMedia.cs`, `Support/ApiFactory.cs`, `Support/InMemoryFamilyHome.cs`, `SwaggerCoverageTests.cs`. The database needs the new `GuestMedia` table and `FamilyPostcards.MediaId`; the script creates tables only when absent, so an existing database must be reset (`db/reset-db.ps1`). If the build fails, fixing it is the first task of the next session.

---

### N8. Real providers and pilot readiness

**Goal:** the app could be put in front of a real cruise line without surprises.

| Slice | What | Notes |
| --- | --- | --- |
| N8.1 Provider wrapper | Timeouts, retries, circuit breaker and automatic fall-back to the simulation, with the age and "estimate" word kept honest in what the client sees | Closes the gap noted in plan 3 Phase 6 |
| N8.2 First real providers | One real weather provider and one real flight-status provider behind the existing interfaces, chosen by configuration, off by default | Needs keys from you (user-secrets) |
| N8.3 Content verification | Walk every authored line tagged "(verify)" in `PortsReference.cs`, `documents.ts`, `safety.ts`, `homeLink.ts` and similar, record a source or remove it; sign-off by the owner | Legal and safety text must not ship unverified |
| N8.4 Operations | Health checks, structured logs, an error-reporting hook (PERF-07), a retention report, and a runbook | Server-side |
| N8.5 Full account export | Whole trip history download (S8-12) and the deletion explanation | |
| N8.6 Quality scorecard | A release checklist built from the journey doc's clear-to-use tests and the nine measures of base doc §23.6; guest-research sessions booked (the five older, neurodivergent and solo cruisers) | Process, not code |

**Done when:** you can switch one provider from `sim` to real by configuration and see it fall back automatically in a test.

**N8 record (2026-11-02):**
- **N8.1 done:** `ProviderGuard` (`Services/ProviderGuard.cs`) wraps a real provider: a call that throws or has no answer uses the simulation for that call; after 3 failures in a row the circuit opens for 2 minutes and the network is not touched; the next call is a trial. One guard per provider. The timeout belongs to the provider's HttpClient (4 s for weather).
- **N8.2 weather done, flights not:** `Providers:Weather` = `openmeteo` (default stays `sim`) gives a real forecast for the sky (UV, high, afternoon rain) at Fort Lauderdale, Cozumel, Belize and Roatan, for today and the next 15 days. Sea days, later dates, failures and an open circuit give the simulated sky. `source` is `forecast` or `sim`; the app does not read it for logic. Climate and today's weather on board stay simulated. Open-Meteo is free without a key for non-commercial use; a pilot needs their paid plan (`OpenMeteo:BaseUrl`, `OpenMeteo:ApiKey` in user-secrets). **A flight-status provider needs a keyed service you choose; not started.** `Providers:Rates` = `http` was already built and can be switched on now.
- **N8.3 prepared, not signed off:** `docs/content-verification.md` lists every "(verify)" line with a Source and Status column for the owner to fill; nothing is checked yet.
- **N8.4 partly done:** `GET /health/providers` shows each real provider as `ok`, `degraded` or `fallback`; `docs/runbook.md` covers checks, providers, logs, retention, export and deletion. **Not built:** the error-reporting hook (PERF-07), structured JSON logs, a retention report.
- **N8.5 partly done:** `/me/export` now also carries `trips` (number, sailing, ship, departure, nights, room type). It still holds only what the account's documents and bookings hold; orders, bookings detail and other server tables are not in it, and there is no download button in the app. The deletion explanation is in the runbook, not yet on a screen.
- **Update (later 2026-11-02):** N8.5 download button added to the privacy centre (it calls `GET /me/export` through `api.account.exportData` and saves a JSON file) with a plain explanation of what download and delete do; N8.4 opt-in JSON console logs (`Logging:Json`, not compiled here); N8.6 `docs/release-scorecard.md` written. Still not built: error-reporting hook (the audit trail and `POST /telemetry` cover app problems), retention report, orders and booking detail in `/me/export`.
- **Not done:** flight-status provider (needs your choice of service); N5.3, N5.4, N7.4, N8.3 are waiting on you (see section 6).
- **Tests added:** `ProviderGuardTests.cs` (circuit, parse, fall-back, no call for sea or far dates, configuration switch). **Not compiled or run** (`dotnet` is not installed here); please run `dotnet build` on `server/`. Front end untouched.

---

## 5. What I would not do yet

- **Real Apple/Google Wallet passes.** They need Apple and Google signing certificates and a pass server. The simulated pass plus the printable fallback is acceptable for now.
- **Live ship systems** (door, Medallion, keyless, real queue feeds). Still out of reach (LF §20).
- **Voice assistant beyond the current "fills the question box".** The confirm-before-act rule makes deeper voice a design project of its own.
- **A native app.** The PWA limits (no Live Activities, no lock-screen widgets) are real, but none of the above needs native.

## 6. Decisions I need from you

| # | Question | My recommendation |
| --- | --- | --- |
| 1 | Run **N1 first** (verification and tests, no new features)? | Yes. It is the cheapest way to avoid building on sand, and the server build check is overdue |
| 2 | Is **web push** worth the permission and iOS caveats? | Yes, for safety notices only (all-aboard, back aboard, disruption); keep the rest in-app |
| 3 | Do you want **moderated social features** (N4.7) kept? | Keep optional; cut first if time is short |
| 4 | Which **second language** first? | Spanish (the cruise calls at three Spanish-speaking ports) |
| 5 | Is there a **real provider** you want to wire first (weather, flights)? | Weather: lowest risk, easiest to verify |
| 6 | Can you supply **content** for audio phrases and port maps, or should the app use browser read-aloud and simple SVG only? | Browser read-aloud and SVG for now; swap in recordings later |
| 7 | Is a **real pilot** with a line planned? | If yes, bring N8 forward after N3 |

## 7. Suggested first step

Start with **N1**. When you are ready, say "Start N1 of docs/next-level-plan.md". It makes no visible changes, but it tells us how solid the base is, and the result may change the order of the rest.
