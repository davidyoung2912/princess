# Best-in-market plan 2: proving "Built" and closing the gaps

Status: **Written 2026-11-08 for your review. Nothing in this plan is built yet.** It follows `docs/best-in-market-plan.md` (BM1 to BM15) and uses `docs/best-in-market-matrix.md` as its starting point. Source requirements: `docs/princess_cruises_expanded_best_in_market_requirements.md`.

## 1. The question, and the short answer

The matrix says 216 of 292 requirements are "Built", but only 15 rows were read against their acceptance wording (basis R). The other 277 were found by file name or search (basis F). You asked whether there is a better way to confirm what is still outstanding inside "Built".

**Yes, and a first version of it was run for this plan.** Three findings:

1. **Every requirement has testable acceptance wording** (502 clauses across 292 IDs; the 58 cross-stage rows have one clause each, no separate acceptance column). The matrix judged each *row*, not each *clause*. Clause-level checking is the missing step.
2. **"Built" is weakly proved.** By a script that checks for a test file beside each cited source file: **87 of 217 Built rows (41 of 101 P0 rows) cite no test at all.** A test beside the file is not proof either, so the real figure is worse.
3. **Spot checks found real misses inside P0 "Built" rows.** I checked about 30 distinctive clauses by hand-written searches of `src` (including `src/i18n/locales/en.ts`, because screens keep their wording there). Section 3 lists what the checks found. Roughly one clause in four that I probed was absent. That is a small, biased sample, not a rate to quote, but it is enough to say the 216 is an upper bound by a margin, and that a systematic pass is worth doing.

## 2. How to confirm outstanding gaps: a five-layer method

Each layer catches something the layer above it cannot. All run under the project rules (no browser, no `dotnet test`; checks are `npm run test`, `lint`, `npx tsc -b`, `build`).

| Layer | What it is | Catches | Cost |
| --- | --- | --- | --- |
| **L1 Clause register** | `docs/requirements-clauses.md`, generated from the requirements document by a script kept in `scripts/`. One row per acceptance clause (about 500), with a verdict (`proved`, `gap`, `not code`, `server only`), the proof (a test name or `file:line`), and the date checked. | Rows judged Built because the screen exists while one clause is missing. | Medium. The script is small; the reading is the work. |
| **L2 ID-tagged tests with a ratchet** | A convention: a test names the clauses it proves (`it('DEB-02#1 ...')` or a `// proves: DEB-02#1` comment). `src/traceability.test.ts` reads the register and fails if a clause marked `proved` has no tag, or a tag points at no clause. The allow-list of untagged clauses may only shrink. | "Built" with no test; claims that drift as code changes. | Low once L1 exists. |
| **L3 Wording guards** | Tests that read `src/i18n/locales/en.ts` for required statements (for example "crew instructions override this app"). Some acceptance clauses are sentences the guest must be able to read. | Missing or edited safety and trust wording, which no behaviour test sees. | Low. |
| **L4 Release-gate scenarios** | The document's 10 P0 release gates (section 9.1) written as node tests that drive the domain modules and the `httpApi` client with the test double: double tap does not duplicate a charge, stale value shows age and next step, every critical error has a human route, and so on. | Cross-feature failures that no single row shows. | Medium. |
| **L5 Server and human lists** | A short checklist of C# tests written but never run (BM7 to BM15), and a device/screen-reader checklist for what only a person can check (320 px reflow, brightness, wake lock, install prompts). | The parts this environment cannot prove. | You run them; I only write the list. |

Why a register and not a smarter script: a keyword probe over the cited files flagged 175 of 217 Built rows as having some clause with little keyword overlap. That is far too noisy to act on, and it also misses wording that lives in the i18n file. It is useful only to *order* the reading (P0 first, no test first), which is how L1 uses it.

## 3. Hidden gaps found so far inside "Built" rows

Checked by search this session. "Absent" means no match in the cited files or the English strings. "Needs a read" means the cited file had no match but the feature may sit elsewhere.

| ID | Pri | Clause | Result |
| --- | --- | --- | --- |
| MOB-14 | P0 | "detect time-zone/date-line changes" | **Absent.** Clocks are shown and tested (BM4), but nothing notices that the phone's zone or the ship's zone changed and says so. |
| EMB-02 | P0 | "app states that crew instructions and announcements override app content" | **Absent** from the muster card wording. |
| DEB-02 | P0 | "final assignment comes from operations and is distinguished from preference" | **Absent.** No wording or state separating the guest's preference from the assigned group. |
| DEB-04 / SEA-14 | P0 | "final, pending, disputed, refunded and adjusted charges are separate" | **Needs a read.** `src/domain/folio.ts` has no refund, dispute or adjusted state; `ledgerSplit.ts` covers pending and posted only. |
| EMB-01 | P0 | "boarded only by manifest or authorised scan; local QR never means boarded" | **Needs a read.** `src/domain/boarding.ts` has no source field for the boarded state. |
| BOK-05 | P0 | "audit record stores the accepted version" of fare and terms | **Needs a read.** No fare-version token found. (BOK-15's versioned legal acceptance is confirmed: table `dbo.Acceptances` has `Version`.) |
| MNG-11 / SEA-20 | P0 | owner or team, ETA or reason for none, escalation, reopen keeps history | **Needs a read.** `assistance.ts` has no owner or team. |
| MNG-05 | P0 | "sensitive data is not included in push previews" | **Needs a read.** No redaction rule found. |
| SEC-06 / SEA-16 | P0 | age-aware messaging controls | **Partial at most.** `ChatSafe.tsx` has a photo minimum age; no age-aware message rule found. |
| SEC-07 | P1 | "sign out everywhere" | **Cheaper than the matrix says.** The server already has `Users.SessionsValidFrom`, honoured in `ConfigureJwtBearer.cs`, but only a password reset sets it. An endpoint that sets it is small. A device list needs a sessions table. |
| REM-01 | P0 | "past trips remain searchable and downloadable" | **Needs a read.** `HistoryScreen.tsx` has no search or filter. |
| POR-04 | P0 | "distinguishes Princess-operated from independent activity" | **Needs a read.** `PortCard.tsx` has no such label. |

Matrix housekeeping found at the same time:

- **Stale rows:** MOB-24, GTS-15 and MOB-15 were closed by BM3 and BM4 but the matrix still says Partial or lists them as open. IDN-05 and MNG-07 still say four permissions; BM6 to BM12 added documents, payments, folio, check-in and trip.
- **Misattributed evidence:** AST-04 cites `src/ai/guard.ts` (the handoff screen, not confirmation); the confirmation component is `src/ui/ai/StanleyConfirm.tsx`. Six Built rows cite no file at all (GTS-16, EMB-08, DEB-03, DEB-06, DEB-10, DEB-13); they name a route instead.
- **Count:** the matrix says 216 Built; the script counts 217. To be reconciled when the register is built.

## 4. The 57 known gaps (51 Partial, 6 Not built), sorted by what closes them

Counts are from the matrix. "FE" is front end only; "Server" needs C# and a schema change I cannot compile or run here (so each lands as written-not-run, like BM7 to BM15).

### A. Closable in the front end, no new decisions (do first)

| IDs | Pri | Work |
| --- | --- | --- |
| MNG-03 | P0 | Sync chip shows pending (outbox has items), unavailable and not linked as distinct states, using `useOutbox` and the session. |
| MOB-05, OFF-01 | P0 | One `src/domain/offlineContract.ts`: every action and screen declares `offline`, `queued`, `view-only` or `needs-connection`; a test fails when a registered route has no entry; controls show the label before commit. |
| MOB-03, QOL-04 | P0 | Guest chooses which kinds the capsule keeps; "last test" is stored (needs an allowed place under `src/data/`, see the audit gate). |
| MOB-04 | P0 | Export and recover local drafts and outbox as a file; corrupt-store handling with a plain message. IndexedDB stays out (decided in the first plan). |
| MOB-23 | P0 | In-app due-reminder fallback while the app is open or on next open. Never claims background delivery. |
| DRM-10, DSC-11 | P0 | One accessibility filter across ship, cabin, port and excursion; "unknown" shown as unknown; one whole-journey comparison. |
| OFF-06 | P1 | Image loading control (off in data-light mode), no autoplay, confirmed by a test. |
| DSC-05, 06, 12, DSC-13 | P1/P2 | Pick an exact cabin on the deck plan; noise, motion and lift indicators; connecting cabins for a party; cabin-to-venue walking overlay using `deckGraph.ts`. |
| GTS-09, POR-07, EMB-13, QOL-10 | P1/P2 | Terminal and port step-free routes; sail-away viewpoints; live route recalculation when a lift is marked closed. |
| MOB-13, MOB-22, MOB-10 | P1/P2 | Foreground geolocation started by the guest only; compass from device orientation (north-up fallback); QR scan with `BarcodeDetector` where the browser has it, typed-code fallback, and never treated as boarding proof. |
| MOB-25, MOB-09 | P1 | Local preview, delete, and location-metadata strip on shared photos. |
| DRM-07, DRM-09, MNG-16, QOL-17, QOL-18 | P1/P2 | Occasion filters, solo inventory view, reusable cabin and dining preferences, layered deck cutaway, photo curation. |
| TRU-05 | P0 | Test the failed-reschedule screen: original stays, message is plain. |

### B. Needs server work (written, not compiled or run)

| IDs | Pri | Work |
| --- | --- | --- |
| IDN-04, IDN-05, IDN-07 | P0 | One relationship type and one permission set across helper, family link and party; remaining permissions (edit booking, message); leave-group on every row of "who can see what". The helper sees check-in, folio, payments, trip and documents today. |
| IDN-03 | P0 | Duplicate-profile detection on sign-up and booking link, with a "needs a person" state. |
| IDN-08, MNG-01 | P0/P1 | Advisor-booked and external bookings in My Trips; linking by verified booking data. |
| TRU-07 | P0 | `/me/status` reads a served status and incident feed instead of client demo scenarios. |
| COM-04 | P0 | Acknowledged state for critical alerts, with a fallback rule. Can only be tested against the simulated senders. |
| MOB-07, COM-06 | P1 | Deep link resolves to the exact object and shows its current state. |
| SEC-07 | P1 | "Sign out everywhere" (small), then a device list (needs a sessions table), then suspicious sign-in notice. |

### C. Needs content or a source (data, not code)

DSC-07 cabin photos with provenance (S1-06), DSC-15 reviews by ship, sailing, cabin and port (no source), BOK-12 future cruise credit wording, REM-04 per-photo consent, REM-14 referral, SEA-18 per-event accommodation requests, DRM-12 interactive map (text itinerary exists).

### D. Not code, or blocked by a decision

GTS-14 (operator sign-off), SEA-07 (Medallion location), A11Y-07, EMB-03, SEC-08 (research and safety owners), A11Y-08 (English only by project rule, so closed as "not planned"). MOB-16 wallet passes stay out.

## 5. Phases

One phase at a time, each committed on its own, per `CLAUDE.md`. Order puts proof first so every later fix is checked by the register.

| Phase | Work | Output |
| --- | --- | --- |
| **BM16** | L1 for the 101 P0 Built rows plus the 12 hidden-gap candidates in section 3: script, register, verdict per clause. Includes the matrix corrections. | `scripts/` generator, `docs/requirements-clauses.md`, updated matrix. |
| **BM17** | L2 and L3: tag convention, `src/traceability.test.ts` with a shrinking allow-list, and wording guards for the safety and trust sentences. | Failing-then-passing tests for the P0 gaps found. |
| **BM18** | Close the confirmed P0 gaps from section 3 that need only the front end: MOB-14 zone-change notice, EMB-02 crew-override line, DEB-02 preference vs assigned, POR-04 label, REM-01 search, plus any "needs a read" item that proves absent. | Small fixes with tests. |
| **BM19** | Group A P0 items: MNG-03, MOB-05 and OFF-01 together, then MOB-03, MOB-04, MOB-23. | Offline contract table and its gate. |
| **BM20** | L1 for the remaining 116 Built rows (P1 and P2 and QOL), same method. | Register complete. |
| **BM21** | L4: the 10 release-gate scenarios as node tests. | Gate tests; failures become BM-numbered fixes. |
| **BM22 on** | Group A P1 and P2, then group B in the order: SEC-07 sign-out, TRU-07, IDN-04/05/07, IDN-03, MOB-07/COM-06, COM-04. | One theme per phase. |

Folio states (DEB-04, SEA-14), boarded-source semantics (EMB-01), accepted fare version (BOK-05), assistance ownership (MNG-11/SEA-20) and push-preview redaction (MNG-05) become BM18 items if BM16 confirms them absent; some touch the server contract and would be split out.

## 5a. BM16 result (built, not committed)

- **Tool**: `scripts/requirements-register.mjs` reads the requirements document, the matrix, `docs/requirements-probes.tsv` (121 searches, one or more per P0 requirement) and `docs/requirements-verdicts.tsv` (a person's findings), and writes `docs/requirements-clauses.md`: all 502 clauses, 49 probes that found nothing, and the judged rows. Run `node scripts/requirements-register.mjs --explain` to see where the same words appear elsewhere, which is how a probe with the wrong scope is told apart from a real gap.
- **Judged**: 19 requirements: **5 gaps** (MOB-14, EMB-02, EMB-01, DEB-02, BOK-05), **5 partial** (PRE-18, DEB-05, DEB-04, IDN-01, SEC-07), **9 still to read** (MNG-05, MNG-11, SEA-20, PRE-01, GTS-01, TRU-03, REM-01, POR-04, SEC-06). Nine P0 rows moved from Built to Partial in the matrix; MOB-24 and GTS-15 moved the other way (stale since BM3).
- **Honest limits**: most of the 49 absent probes are my search being too narrow or in the wrong file, not missing features. They are a reading list, not a gap list. Of the 101 P0 rows, about 20 have been read; the other 80 have a search that found something, which proves only that the words exist. The remaining P0 reading carries into BM17 (as the tests are written) and the rest into BM20.
- **Not done**: the pasted API key was not saved anywhere in the repo. It goes in user-secrets or an environment variable when COM-04 is built.

## 5b. BM17 result (built, not committed)

- **Convention**: a test names what it proves with a `proves: ID#n` comment. `src/traceability.test.ts` checks every tag points at a real requirement and clause, that every P0 requirement the matrix calls Built is tagged or on `docs/requirements-untagged.txt` (89 today, down from 101 P0 Built rows as BM17 tags two), that the list only shrinks, and that every requirement judged a GAP has a pinning test.
- **Wording guards**: `src/wordingGuards.test.ts` reads `en.ts` and the source. Two guards pass today (DEB-08 "not legal advice", OFF-03 saved-copy wording). Nine confirmed gaps are written as `it.fails` (EMB-02, MOB-14, DEB-02, DEB-05, PRE-18, EMB-01, DEB-04, BOK-05, MNG-05): they pass while the gap exists and fail when it is closed, which is the cue to turn them into `it`. BM18 does exactly that.
- **Limit**: the 89 untagged rows are still only "found by search"; tagging them is the work of BM18, BM19 and BM20 as each is read.

## 6. Decisions I need from you

1. **Order.** Start with BM16 and BM17 (proof first), or go straight to closing known gaps (BM19 first)? I recommend proof first: the register tells BM18 and BM19 what to fix and prevents the same drift later.
2. **Clause-level reading.** BM16 and BM20 mean reading about 500 clauses against code. Acceptable as slow, careful work, or limit it to P0?
3. **COM-04 and email/SMS.** Needs a sender decision before it can be more than a simulated test.
4. **IDN-04.** Unifying helper, family link and party into one relationship model touches three server areas and the `Helper` table. Approve the design before BM22+ reaches it.
5. **Camera and location features** (MOB-10, MOB-13, MOB-22). Both are permission-gated and device-dependent, and I cannot test them on a device. OK to build with feature detection and manual fallbacks, flagged "untested on device"?
6. **C# tests.** BM7 to BM15 added about ten server tests I never ran. Please run them once yourself before relying on helper features.

## 7. What I did not do

- I did not build any of the gaps. You asked for a plan to review, and `CLAUDE.md` says to stop after each phase, so BM16 onward waits.
- I did not read the C# endpoints behind the rows; server-side clauses stay unconfirmed until L5.
- The spot checks in section 3 are searches, not proof. A match means the wording or state exists, not that the behaviour is correct.

## 5c. BM18 result (built, not committed)

Closed with tests: MOB-14 (zone-change notice in `ThreeClocks`, `zoneChangeNear`), EMB-02 (crew-override line on the muster card), DEB-02 (preference-not-guarantee note), POR-04 (Princess excursion label on port-day tours), REM-01 (search on trip history, `matchTrips`). Their `it.fails` guards are now `it`. REM-01 and POR-04 came off the untagged list. Not done: POR-04 has no server-side operator flag, so every listed tour is labelled Princess-operated because it is booked through the ship; independent tours need a server contract change. Remaining `it.fails` gaps: DEB-05, PRE-18, EMB-01, DEB-04, BOK-05, MNG-05.

## 5d. BM19 result (built, not committed)

Built with tests: MNG-03 (`chipKind`: current, stale, pending, unavailable, not linked; `SyncChip` shows the pending count), MOB-05 and OFF-01 (`src/domain/offlineContract.ts` with a test that fails when a route has no entry; `OfflineNote` in the shell), MOB-03 (guest chooses optional kinds, last test stored in `princess:capsule-prefs`), MOB-04 (export and restore of waiting items, unreadable lists reported and clearable), MOB-23 (`LocalReminders`: pay, check-in and all-aboard while the app is open or on next open; never claims background delivery).
Not done: the matrix rows and `requirements-verdicts.tsv` for these six are not yet updated to Built. No device test of the file download or restore. `lookup` on `SyncChip` is wired but no screen passes it yet. The contract classes were assigned by reading which screens use saved copies and the outbox; the rest default to needs-connection.

## 5e. BM20 result (built, not committed)

Added 119 probes to `docs/requirements-probes.tsv`, one per remaining Built P1, P2 and QOL row (register now 240 probes). Absent probes were checked by reading the named files, not by search alone. Eleven more were read in a second pass (BOK-10, GTS-10, SEA-04, QOL-15 moved to Partial; GTS-16 still to read), so ten rows were Partial. A third pass moved DRM-14, MNG-15, PRE-15 and PRE-10 as well (14), and a fourth moved PRE-12, EMB-07, REM-08, QOL-20 and MNG-09 (19 in all; OFF-07, DEB-10 and DEB-15 judged OK, the last two unread beyond existence), confirmed UX-04 OK and left GTS-16 to read. First pass: seven judged: **6 moved Built to Partial** (DRM-16 no fare alert, REM-07 no last-sync or discrepancy report, REM-10 no credit wallet, PRE-07 no exertion or operator-confirm flag, SEA-05 no temporarily-unavailable state, AST-02 no source or freshness label) and MNG-06 confirmed OK.
Honest limit: only the probes that came back absent were read; the other rows have a search hit, which proves the words exist, not that each clause is met. Matrix totals were hand-adjusted (-6 Built, +6 Partial), not regenerated. These six are candidates for BM22 onward.
Still unread after BM20: the other absent probes (the ones that found a hit). Every Partial above rests on a negative search of the named files, so it is a lead for BM22 to confirm by reading, not a proven gap; several returned nothing because the named file path or my wording was wrong.

## 5f. BM21 result (built, not committed)

`src/releaseGates.test.ts`: the 10 P0 release gates (document section 9.1) as 56 node tests, 50 passing and 6 `it.fails` that each name a gap. They drive the outbox, `createHttp`, the offline cache, the offline contract, sync labels, sharing and retention rules, and read the source where the behaviour lives in a React screen. No requirement tags (`proves:`) were added: these are scenarios, not clause readings.

Gaps found (each becomes a BM22-on fix; turn its `it.fails` into `it` when closed):
1. **Gate 1:** `enqueue` keeps the newest 20 and silently drops the oldest; a guest who queues 21 requests offline loses the first unseen.
2. **Gate 2:** the client never sends an `Idempotency-Key`. The server accepts one and treats the same booking draft twice as one booking, but `pay-balance` has no draft, so a retry after a lost reply is not protected.
3. **Gate 8:** "Delete my data" wipes this browser only; `DELETE /me/state` exists on the server but no client call reaches it.
4. **Gate 10:** the status screen still uses a client demo scenario (TRU-07); the runbook has no incident section (owner, who is told, how guests are told); the `Email` and `Sms` providers are not in the runbook.

Limits: gates 5, 6, 7 and 9 read strings and source, so they prove the route exists, not that it works on a device. Gate 9 cannot show a desktop and a phone each completing a task (needs a browser walk, scorecard B rows). Gate 8 does not test the server's permission checks (C# tests not run, per project rules).

## 5g. BM22 result (built, not committed)

Theme: no silent loss and safe retry. Closed three of the BM21 gate gaps in the front end, each `it.fails` now an `it`:
1. **Gate 1:** `enqueue` no longer drops the oldest waiting action. A full outbox (`hasRoom` false) refuses the new one; `hold` returns false, the chat and service screens keep the typed text and show `outbox.full`.
2. **Gate 2:** `RequestOptions.idempotent` sends an `Idempotency-Key` (one per call, the same on the resend after a silent refresh). Used for `book` and the three pay-balance posts.
3. **Gate 8:** the privacy centre's "Delete my data" calls `deleteMyData` (`DELETE /me/state`, then the local wipe). If the server cannot be reached nothing is wiped and the error is shown.
Limits: the key lasts one call, so a retry the guest makes by tapping again gets a new key (the server's draft de-duplication still covers `/bookings`; `payments/balance` has no server-side check of the header yet, so it is sent but not honoured). Booking documents shared with other guests are not deleted (server rule). Gate 10 (TRU-07 served status, runbook incident section and providers) is server and docs work, left for its own phase. Group A P1/P2 items (OFF-06 onward) are untouched.

## 5h. BM23 result (built, not committed)

Theme: images and data-light (OFF-06, MOB-25).
1. **OFF-06:** new `DeferredImage` (`src/ui/DeferredImage.tsx`). In data-light mode a content photo is a "Show photo" button and no `<img>` or request exists until tapped. Used by ship photos (both lists) and chat photos; `MediaImage` (guest's kept pictures) defers the authenticated fetch the same way. `src/ui/dataLightImages.test.tsx` checks both modes, that the screens have no raw `<img>`, and that nothing autoplays (the only `.play()` is the camera preview after the guest taps start). Matrix row moved to Built.
2. **MOB-25:** read `shrinkPicture`: the canvas redraw drops location and time, so the strip is real where the browser supports it (the server strips again). Delete exists. Still missing: a local preview before upload (the picker sends on choose), so the row stays Partial.
Limits: decorative icons and the mascot still load in data-light mode (small, cached by the service worker). jsdom only, no device check. Next in group A: MOB-25/MOB-09 preview-before-send, then DSC-05/06/12/13.

## 5i. BM24 result (built, not committed)

Theme: preview before sending (MOB-25). `PicturePicker` now shrinks the chosen picture, shows it with "Nothing has been sent yet", and uploads only when the guest taps "Send this picture"; "Choose another" discards it and revokes the preview URL. `src/ui/picturePreview.test.tsx` checks nothing is uploaded before the tap. Used by every picker (cabin, book, family link, cases). MOB-25 moved to Built.
Limits: jsdom only, no device check; MOB-09 (passport and tag scan) stays Partial. The matrix Built/Partial totals were not regenerated. Next in group A: DSC-05/06/12/13.

## 5j. BM25 result (built, not committed)

Theme: cabin chooser honesty (DSC-06, DSC-13). Partly done; DSC-05 and DSC-12 are not started.
1. **DSC-06:** `src/domain/cabinComfort.ts` gives each cabin noise, motion, lift proximity, connecting door and obstruction indicators, each tagged Confirmed, Typical, Guest-reported or Unknown and shown on the chooser. Nothing is Confirmed or Guest-reported unless a source passes it in (none does yet); connecting door is Unknown. A line says no guest reports exist and that they would not be a guarantee. Test: `src/domain/cabinComfort.test.ts`.
2. **DSC-13:** the existing cabin walk times (`cabinWalks`) now say whether the way is on the cabin's deck or by lift, and the note says closures and lift outages are not known and the time is not a verified step-free route. The row moved Not built to Partial: the overlay already existed (the matrix was wrong), but there are no stairs, no closure data and no verified route data.
Limits: the tags describe modelled sample data, not a real deck plan; the server does not serve per-indicator provenance or a connecting-door fact, so a real source would add `ConfirmedFacts`. jsdom and unit tests only. Matrix totals not regenerated.
Not started: DSC-05 (pick an exact cabin on the deck plan, recheck inventory before hold) and DSC-12 (connecting or nearby cabins for a party) both need cabin adjacency and a hold step that the front end does not have; they are the next phase.

## 5k. BM26 result (built, not committed)

Theme: pick on a map and plan a party's staterooms (DSC-05, DSC-12). Both rows stay Partial.
1. **DSC-05:** `CabinMap` (`src/ui/book/CabinMap.tsx`, logic in `src/domain/cabinMap.ts`) draws each deck as a grid (port/starboard rows, forward/midship/aft cells) of real buttons; status is written (free, booked, chosen), and the existing radio list stays as the text alternative. Choosing a stateroom, from the map or the list, fetches the inventory again; if it was taken meanwhile or is no longer offered it is not kept and a plain message says so.
2. **DSC-12:** when guests exceed one room's capacity, the room step says how many staterooms are needed and lists up to three sets of free staterooms on one deck within one part of the ship. It says close together does not mean connecting doors, and that the draft holds one stateroom only.
Limits: there is no hold step on the server, so the recheck is a look, not a reservation; the booking's `cabinTaken` is still the final word. The map is a schematic of sample staterooms. Multi-stateroom booking, per-cabin guest counts and connecting-door data are not built (they need a draft and server change). Tests are node unit tests for `cabinMap.ts`; the UI recheck is not covered by a component test, and nothing was checked in a browser. Matrix totals not regenerated.

## 5l. BM27 result (built, not committed)

Theme: replan around a closed lift (QOL-10). Only this row was taken; GTS-09, POR-07 and EMB-13 are not started.
`wayBetween` and `routeBetween` take a set of closed lift banks; the route finder has a "Lift X closed" toggle for each bank, says when the way was changed, and says plainly when no way exists without them. Tests in `src/domain/deckGraph.test.ts` (reroute, no way, unchanged).
Limits: there is no closure feed (the server would have to serve one), so the guest's report is the only source; the other callers of `wayBetween` (cabin walks, embark delights, plan polish) ignore closures. No browser check. Matrix totals not regenerated; QOL-10 stays Partial.
Next in group A: GTS-09, POR-07, EMB-13 (terminal and port step-free routes, sail-away viewpoints).

## 5m. BM28 result (built, not committed)

Theme: step-free sail-away (EMB-13). Only EMB-13 was built.
`src/domain/sailAwayViews.ts` lists the deck plan's open-deck places, step-free first, with a step-free filter on the sky screen and a link to the route finder. Test: `sailAwayViews.test.ts`. It does not claim a best spot, because the plan has no pier side or sight lines.
Not built: GTS-09 (terminal map and step-free route) and POR-07 (per-port return routes). I read the code and found no terminal or pier data anywhere, so building them would mean inventing it; they move to group C (need a source). Matrix totals not regenerated; EMB-13 stays Partial. No browser check.
Next in group A: MOB-13, MOB-22, MOB-10 (foreground location, compass, QR scan).

## 5n. BM29 result (built, not committed)

Theme: device sensors, started by the guest (MOB-13, MOB-22, MOB-10). All three rows stay Partial.
1. **MOB-13:** `PortDirection` on the port guide: one tap reads the position once (no watch, nothing stored or sent), then gives distance and direction to the approximate port point from `PORT_COORDS`. A poor fix (over 500 m) is called too rough. Denied or unavailable is said plainly.
2. **MOB-22:** after a fix, a second tap starts the device compass (asks iOS permission); an arrow turns toward the port and words say left or right. With no reading the answer stays north-up.
3. **MOB-10:** `CodeScanner` on the deck map: camera scan through `BarcodeDetector` where the browser has it, typed code always. A code finds a ship place or opens this app's own page; other addresses are shown as text and never opened. A note says it is not proof of boarding, check-in or payment.
Maths and code reading are in `deviceSense.ts` and `scanCode.ts` with node tests. Limits: no component test for the UI, no device or browser check of geolocation, compass or camera; the port point is a rough centre, not the pier; ship-side positioning (GPS aboard) is not attempted. Matrix totals not regenerated.
Next in group A: DRM-07, DRM-09, MNG-16, QOL-17, QOL-18 (occasion filters, solo inventory, reusable preferences, deck cutaway, photo curation).
Guard changes: `DeviceTools.tsx` is allowed one guest-started `.play()` (scan preview, stopped on cleanup) and one polling `setTimeout` (ended by the effect cleanup flag, not `clearTimeout`).

## 5o. BM30 result (built, not committed)

Theme: solo cruiser view (DRM-09). Only this row was taken; DRM-07, MNG-16, QOL-17 and QOL-18 are not started.
`soloView` in `src/domain/dream.ts` lists each room type for one guest with fare, solo supplement and all-in total, cheapest first; the decide screen shows it when the party is one and says plainly that staterooms are not set aside for solo guests, that no hosted social events are listed, and that nobody is matched as a roommate. Test in `dream.test.ts`. DRM-09 stays Partial: single-occupancy inventory and hosted social options need a source.
Limits: no component test, no browser check. Matrix totals not regenerated.
Next in group A: DRM-07 (needs occasion tags on sailings, a content source), MNG-16, QOL-17, QOL-18.

## 5p. BM31 result (built, not committed)

Theme: reusable preferences (MNG-16). Only this row was taken; DRM-07, QOL-17 and QOL-18 are not started.
`preferenceUse` in `src/domain/preferenceUse.ts` turns the saved food, access, bedding and request answers into plain lines saying where each is used (dining, excursion flags, checklist reminders, room team); the profile shows them under "How these are used", marks health and child data as not used for marketing, and says there is no way yet to leave one out of a later sailing. Test in `preferenceUse.test.ts`.
MNG-16 stays Partial: an opt-out per preference, and cabin-location and message preferences, need a server field. Limits: no component test, no browser check. Matrix totals not regenerated.
Next in group A: DRM-07 (needs occasion tags, a content source), QOL-17, QOL-18.
