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

## 5q. BM32 result (built, not committed)

Theme: visual ship literacy (QOL-17). Only this row was taken; DRM-07 and QOL-18 are not started.
`shipLiteracy` and `cutaway` in `src/domain/shipLiteracy.ts` use the deck graph to say, for a typed cabin number, how many decks up or down, how many sections toward bow or stern and which lift banks lead to guest services, the Piazza, main dining, the Lido, medical and the gangway. `ShipLiteracy` on the deck-map screen shows four deck rules, those lines and a top-to-bottom deck list with the cabin deck marked, and says it is not navigation. Test in `shipLiteracy.test.ts`.
QOL-17 stays Partial: there is no ship art or true layered cutaway (needs art), and no orientation-confidence or help-request measure. Limits: no component test, no browser check. Matrix totals not regenerated.
Next in group A: DRM-07 (needs occasion tags, a content source), QOL-18.

## 5r. BM33 result (built, not committed)

Theme: photo-to-memory curation (QOL-18). Only this row was taken; DRM-07 is not started.
`buildStory`, `applyOmissions` and `storyText` in `src/domain/memoryStory.ts` arrange the guest's favourite photos and their own (not app-written) diary notes by trip day; `MemoryStory` on the photos screen lets the guest leave out any photo or note and copy the result as text. Nothing is uploaded and no faces are matched. Test in `memoryStory.test.ts`.
QOL-18 stays Partial: no memory-book or video renderer (Print It stays separate), no generative text, no completion or export measure. Limits: no component test, no browser check. Matrix totals not regenerated.
Next in group A: DRM-07 (needs occasion tags on sailings, a content source).

## 5s. BM34 result (built, not committed)

Theme: occasion-led discovery (DRM-07). Last row of group A.
`occasionsOf` and the `occasion` filter in `src/domain/catalogueBrowse.ts` match a sailing on facts the catalogue has: holiday (served flag or departure 20 Dec to 3 Jan), summer break (15 Jun to 31 Aug) and a big trip (14 nights or more). The sailings screen has an Occasion select (kept in the address only) and a note saying the match is by date or length, that Princess has not tagged sailings, and that optional services are not matched. Nothing is saved or shared. Test in `catalogueBrowse.test.ts`.
DRM-07 stays Partial: real occasion tags (anniversary, reunion, celebration) and optional-service matching need a content source. Limits: no component test, no browser check. Matrix totals not regenerated.
Group A is now done apart from rows moved to group C.

## 5t. BM35 result (built, not committed)

Theme: sign out everywhere (SEC-07, first row of group B).
`POST /auth/logout-all` (`AuthEndpoints.cs`, `AuthService.LogoutEverywhereAsync`, `ISignInStore.EndAllSessionsAsync`) sets `Users.SessionsValidFrom` to now and revokes every open refresh token, so access tokens already issued stop working too (the check in `ConfigureJwtBearer.cs` was already there). The password is untouched. A view-as token gets 403. An audit line `auth.logoutEverywhere` is written. On the account page a "Sign out everywhere" card asks once to confirm, then calls it through `account.signOutEverywhere` and `signOutEverywhereSaving`; if the server cannot be reached nothing changes and the guest is told, because a local-only sign out would leave the other devices in. Not shown for the demo accounts. Tests: `httpProvider.test.ts` (front end) and `SignInFlowsApiTests.SignOutEverywhereEndsEverySessionButKeepsThePassword` (server, written but not run, per the project rule).
SEC-07 stays Partial: the device list (needs a sessions table) and the suspicious sign-in notice are not built. Limits: no component test, no browser check. Matrix not regenerated.

## 5u. BM36 result (built, not committed)

Theme: served service status (TRU-07, Gate 10 first half). `GET /help/status` returns `[{id, health}]` for booking, check-in, dining, ordering, chat, photos and account. It is a new provider seam, `Providers:ServiceStatus` (`IServiceStatus`, `SimServiceStatus` in `Providers.cs`); the simulation says everything works, and a demo account that has switched a fault on sees that fault, so the demo scenario now lives on the server and the screen no longer knows about scenarios. The client's `systemStatus` became `statusRows(served, offline)`; offline still shows every part not working, and a failed load shows the usual retry rather than "all working". The "this page reflects demo controls" line was removed. The Gate 10 `it.fails` became `it`.
Added to `docs/runbook.md`: the `Providers:ServiceStatus` line. Server tests (`StatusListsEveryPartAndNeedsASignIn`, `ADemoFaultShowsAsSlowOrDown`, the swagger route list) written, not run.
Not done: an incident feed with a start time and message (the served shape is health only), the runbook's incident section (owner, who is told, how guests are told) and the Email and Sms provider lines (the other two Gate 10 `it.fails`). TRU-07 stays Partial for that reason. Limits: no component test, no browser check.

## 5v. BM37 result (built, not committed)

Theme: one vocabulary and an immediate stop for who can see what (IDN-04, IDN-05, IDN-07, first slice). This is the front-end part only. I did not merge the three server stores (helper, family link, party), because that is the design you asked to approve and I could not run the C# tests; so the stores stay as they are and a shared layer sits over them.
- `src/domain/relationships.ts`: the relationship kinds the app really records (`helper`, `household` for the family link, `party`, `invite`), the eight tasks of IDN-05 (itinerary, check-in, pay, edit booking, bill, documents, message, location) and `taskOf`/`tasksFor`, which map every helper permission and sharing facet to a task (or to none: profile edits and shared photos).
- `accessRows` rows now carry `tasks` and `stoppable`. On `/me/helper` each row reads "Can: See the itinerary, Pay", and an active or waiting row has a **Stop now** button (**Cancel invitation** for an invite) that ends it at once with no confirm step: helper revoked, family links revoked on the server and in the hub, invite removed, or every party facet switched off. If the server cannot be reached the row stays and the guest is told. A footnote names the tasks nothing grants yet (edit booking, message) and the one never shared (location).
- Tests: `relationships.test.ts`.
Not done: edit-booking and message permissions (need server enforcement on those endpoints); household, cabin party, linked group and shipmate as recorded relationships; one server table for all grants; a confirm-free stop for a helper also removes their history entry only as the existing revoke does. IDN-04 and IDN-05 stay Partial, IDN-07 moves to Built for the lists that exist. Limits: no component test, no browser check, matrix not regenerated.

## 5w. BM38 result (built, not committed)

Theme: duplicate-profile detection at sign-up (IDN-03), with a "needs a person" state.
- **Server:** `AuthService.RegisterAsync` asks `ISignInStore.FindPossibleDuplicateAsync` for an existing adult, non-demo account with the same first and last name (case and accent blind, `Latin1_General_CI_AI`) and date of birth. A match with no `confirmedDifferent` answers 409 `possibleDuplicate` and creates nothing; it does not say whose account it is. With `confirmedDifferent: true` the account is created with `Users.ReviewReason = 'duplicate'` (new column, idempotent in `db/01-schema.sql`; run the script) and the audit row for the sign-up records the matching account's public id, which is the queue a person at Guest Services works from. Nothing is merged by machine. `MeResponse.NeedsReview` carries the flag.
- **Front end:** the sign-up form shows an "Is this you already?" step (sign in instead, change the details, or "It is not me, create my account"). A flagged account sees a note on the account page. Tests: `httpProvider.test.ts`; server test `ASecondSignUpWithTheSameNameAndBirthdayAsksFirstThenFlagsForAPerson` (written, not run).
- **Limits and not done:** the 409 does confirm that some adult account has this name and birthday (rate limited with the other sign-up calls; the alternative, never asking, defeats the point). There is no staff screen to resolve a flag and nothing clears `ReviewReason`; the audit row is the queue. The booking-link half of IDN-03 (matching a booking to an existing profile) is not built. A twin name with a different spelling, or a different birthday, is not caught. IDN-03 moves from Not built to Partial. No browser check.

## 5x. BM39 result (built, not committed)

Theme: alert links that name the trip and the change (MOB-07, COM-06). Before, a tap opened a bare screen path (`/ship/port`, `/home/updates`, `/me/payments`) with nothing saying which trip or which change the alert was about.
- **Server:** `PushRules.WithLink` adds `?trip=<booking number>` to every alert's path, and `&update=<id>` for a ship-change alert; `PushService` applies it after the notices are built, so the notice keys and the budget rules are unchanged. Only plain letters, digits, `-` and `_` go in; anything else leaves the path as it was.
- **Front end:** `src/push/deepLink.ts` reads them. `DeepLinkNote` (in the shell) shows a warning when the alert was about a different trip from the one the app is on; the Disruption Hub shows "That change is no longer current" when the `update` is not among the active ones, once the list has loaded. The service worker and `princess-open` already carried the whole path including the query, and still reject any address outside the app.
- **Signed out:** the sign-in gate renders in place at the same address, so the guest lands on the link after signing in; no token is in the link. I read this from `App.tsx` and did not test it in a browser.
- Tests: `deepLink.test.ts`; server `ALinkNamesTheTripAndForAShipChangeWhichOne` (written, not run).
- **Not done:** links to a specific reservation, port-day row or case (the alerts only exist for the screens above, and `/home/ports/{port}` already names its port); a "switch to that trip" button (the app has one current trip, so the note points to My trips); a check that old alerts in the notification centre use the new paths (their stored path is unchanged). MOB-07 and COM-06 stay Partial. No component test, no browser check.

## 5y. BM40 result (built, not committed)

Theme: acknowledged delivery of safety alerts, with a fallback channel (COM-04), and Pingram as the real email and text sender. Last row of group B.
- **Acknowledged state:** `PushDeliveries.AckedAt` (new column, idempotent in `db/01-schema.sql`; run the script). The guest acknowledges a safety alert by tapping the notification (the service worker now passes the alert's id to the app, which calls `POST /me/push/ack`) or pressing **Got it** in the alert log. `PushLogDto.Acked` and `PushLogEntry.acked` carry it.
- **Fallback rule:** `PushRules.FallbackDue`: a safety (bypass) alert that reached a phone, is not acknowledged, is between 10 minutes and 3 hours old and has not already gone by text or email goes once more by text to a confirmed phone, else by email to a confirmed address ("Not yet seen. ..."). `PushService.FallbackAsync` runs inside the normal check (the app's and the background scheduler's), writes the usual `sms:` or `email:` log row so it is never repeated, and only fires while the alert still applies. A failed send is not logged and is tried again.
- **Pingram:** `PingramSender` implements both `IEmailSender` and `ISmsSender` over `POST https://api.pingram.io/send` (bearer key; `type`, `to`, `email.subject`/`email.html` or `sms.message`, from Pingram's API reference). Selected with `Providers:Email=pingram` and `Providers:Sms=pingram`; needs `Pingram:ApiKey` from user-secrets or the environment, and the server refuses to start without it. Both providers are now in `docs/runbook.md` (which also closes the Gate 10 `it.fails` for them). The default stays `sim`.
- **Tests:** `PushRulesTests.ASafetyAlertNobodyAcknowledgedFallsBackOnceBetweenTenMinutesAndThreeHours`, `ProviderContractTests` (Pingram needs its key; request bodies), the service-worker test, and the existing npm suite. Server tests written, not run.
- **Not verified:** nothing has been sent through Pingram. The request shape comes from their reference pages; in particular I did not confirm whether a notification type needs its email or SMS channel switched on in their dashboard, or whether a sender address or number must be registered first. Try one real send before relying on the fallback. The email carries no one-click unsubscribe headers (the endpoint has no custom-header field).
- **Limits:** acknowledging while offline fails quietly, so the fallback may still go (the safe side). The fallback needs the check to run (the scheduler does that with the app closed). A guest with no confirmed phone or email gets no fallback. COM-04 moves to Partial.

## 5z. Reconciliation after BM40 (not committed)

Docs only, no code. Read the code for the seven rows that were still "needs a read" and corrected rows the later phases had moved.
- **Read and moved to Partial:** TRU-03 (six badge kinds, not the nine states), PRE-01 (only confirmed items, no planned ones), GTS-01 (saved only), MNG-11 and SEA-20 (stage and ETA only: no owner, no reason without an ETA, no escalation, closure or reopen aboard), MNG-05 (no push-preview redaction). **SEC-06 confirmed Built** (age rules enforced on the server).
- **Gap text corrected:** TRU-07 (BM36), SEC-07 and IDN-01 (BM35), OFF-07 (BM19).
- **Totals now:** 197 Built, 74 Partial, 13 Simulated, 2 Not built, 6 Out of reach; 32 rows read, 260 found only. P0: 95 Built, 24 Partial, 2 Simulated, 1 Out of reach. The untagged list is 83.
- **Still unread:** 83 P0 Built rows are "found by search" only, so more hidden gaps are possible there.
- `npm run test`, `npm run lint` and `npx tsc -b` pass.

## 5aa. BM41 result (built, not committed)

Theme: push-preview redaction (MNG-05). BM41 was not defined in the plan; I took the row the BM40b reconciliation labelled "BM41 prep".
- **Server:** `PushRules.Redact` replaces the title and body of payment, travel (flight, tender) and schedule-change notices with "Stanley: something to look at" / "Open the app to see the details." Safety, port, disruption and reminder notices are unchanged. Applied in `PushService` after `WithLink`, so the SMS and email fallback text is covered too; kind, path and params are untouched.
- **Tests:** server `PreviewsOfMoneyFlightsAndShipReasonsAreRedactedAndSafetyOnesAreNot` (written, not run); the MNG-05 wording guard is now `it` instead of `it.fails`. `npm run test`, `npm run lint`, `npx tsc -b` pass.
- **Limits:** params (dates, amounts) still travel in the encrypted push payload and the in-app log; only the visible preview is redacted. There is no per-guest "show details" switch. Encryption at rest and export/delete for documents were not read, so MNG-05 stays Partial. No browser check.

## 5ab. BM42 result (built, not committed)

Theme: two wording gaps on money screens (PRE-18, DEB-05). BM42 was not defined in the plan; I took the two `it.fails` wording guards that need only the front end.
- **PRE-18:** `hub.portSkipped.comp.arrives` now says refunds "usually reach your card in about 5 working days" and that this is an estimate until the card company confirms it.
- **DEB-05:** the report form shows `case.noReversal` above the send button: sending a case does not mean a charge is reversed, and the outcome is told in the app.
- **Tests:** both guards in `src/wordingGuards.test.ts` changed from `it.fails` to `it`. `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` pass.
- **Limits:** both rows stay Partial. There is no provider-confirmed refund state, and a case shows no owner or response expectation at submission. English only. No browser check. Remaining `it.fails` wording gaps: EMB-01, DEB-04, BOK-05 (all need server or domain work).

## 5ac. BM43 result (built, not committed)

Theme: the runbook incident section. BM43 was not defined in the plan; I took the one `it.fails` release gate that needs only docs.
- **Runbook:** new "Incidents" section in `docs/runbook.md`: owner, detect, contain (set the provider to `sim`), who staff are told, how guests are told (Status screen, push alerts and the COM-04 fallback, Disruption Hub), and after.
- **Test:** the gate in `src/releaseGates.test.ts` changed from `it.fails` to `it`. `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` pass.
- **Limits:** no incident owner is named and there is no paging or alert hook (PERF-07), so the section says so rather than inventing a process. The operator must fill in the owner and sign it off in the scorecard. No requirement row moves. Remaining `it.fails`: EMB-01, DEB-04, BOK-05 (server or domain work).

## 5ab. BM44 result (built, not committed)

Theme: bill states and accepted fare version (DEB-04, BOK-05).
- **DEB-04:** `dbo.FolioLines.State` (posted, pending, disputed, refunded, adjusted) carried through `FolioWrite`, `FolioRow`, `FolioLine` and the client `FolioLine.state`. The gratuity adjustment line is written as adjusted and an order-cancel refund as refunded. `FolioTotals.pending` sums pending charges. The final bill labels each charge, shows a charge with an open query as being queried, lists refunded and adjusted lines in their own section, and notes any pending amount. Nothing writes `pending` yet.
- **BOK-05:** `dbo.Bookings.AcceptedFareVersion` and `AcceptedTermsVersion` are set at checkout from `PolicyRules.FareVersion` and `PolicyRules.LegalVersion`. Both are null on bookings made before this. The fare version is a constant that must be bumped by hand when fares change.
- **Tests:** the DEB-04 and BOK-05 guards are now `it`. No server test written; no `dotnet` run. The schema change needs `db/reset-db.ps1` on an existing database.

## 5ad. BM45 result (built, not committed)

Theme: boarded source and request ownership (EMB-01, MNG-11, SEA-20).
- **EMB-01:** `dbo.EmbarkProgress.BoardedAt` and `BoardedSource` (manifest or scan) reach the client as `EmbarkView.boarded`. `BoardingRules.Boarded` takes a recorded time first; with none, the simulated manifest lists a checked-in guest as boarded 90 minutes after the terminal opens. The embark plan says whether the ship shows the guest aboard and relabels the typed time as the guest's own estimate. The `it.fails` guard is now `it`.
- **MNG-11 and SEA-20:** requests carry a team (housekeeping or maintenance), escalate (after 10 open minutes, once per round), confirm and reopen (up to twice, clock restarts, history kept) through new `POST /requests/{id}/escalate|confirm|reopen` and `dbo.ServiceRequestEvents`. The screen shows the team, why there is no time once a request is done or cancelled, the actions and a history list.
- **Tests:** three server rule tests (written, not run). `npm run test`, `npm run lint` and `npx tsc -b` pass.
- **Limits:** no scan or manifest writer exists, so a recorded boarded time can only be set in the database. The owner is a team, not a person; an escalation pages nobody. Stage still follows the clock. The schema change needs `db/reset-db.ps1`. English only; no browser check. All three rows stay Partial.

## 5ae. BM47 result (built, not committed)

Theme: the Guest Services screen that settles a flagged duplicate account (IDN-03).
- **Server:** `GET /admin/reviews` lists accounts with `ReviewReason` set, oldest first, each with the accounts that share its name and birthday (account number and date opened; never an email address). `POST /admin/reviews/{id}/resolve` takes `different` or `same`, clears the flag, and audits `account.review.resolve` with the administrator as actor. Administrators only (403 for anyone else, including a booker viewing as a child); 404 when the account is not flagged; 400 for any other decision. Nothing is merged.
- **Front end:** `ReviewCard` on the account page, shown only when the signed-in role is `admin`. It lists each flagged account with its matches and two buttons. It is a card, not a route, so no route, offline-contract or screen-id entries were needed. The flagged guest's own note ("a person is checking") disappears on their next load.
- **Tests:** `httpProvider.test.ts`; server `OnlyAnAdministratorSeesTheFlaggedAccountsAndSettlingOneClearsTheFlag` (written, not run; `dotnet` is not installed in this shell, so the C# was not even compiled).
- **Not done:** "same guest" only records the decision, it does not join the accounts; the booking-link half of IDN-03; a staff sign-in separate from the guest app. IDN-03 stays Partial. No component test, no browser check.

## 5af. BM48 result (built, not committed)

Theme: linking a booking made elsewhere (MNG-01, IDN-08).
- **Already there:** `POST /trips/link` matches an agent booking on number, lead guest's last name and sailing date, rate limited, with one `notFound` for any mismatch. Linked bookings show the agent and no documents.
- **MNG-01#2:** an account with `ReviewReason` set (possible duplicate, IDN-03) gets 403 `review` on link, and the My Trips form says a person is checking the account. A booking is never attached to a profile that may belong to someone else.
- **Unlink:** `DELETE /trips/{number}/link` (`TripService.UnlinkAsync`, `ITripStore.UnlinkAsync`) removes only a link the person made; any other number is 404; supervised accounts get 403. History records `tripUnlink`. The trip page shows "Remove from My Trips" for a linked booking.
- **Tests:** server test `ALinkedBookingCanBeRemovedAndLinkedAgainButAnotherNumberIsNotFound` (written, not run, not compiled). `npm run test`, `lint`, `tsc -b` and `build` per the working rules.
- **Not done:** external (non-agent) channels; no `external` booking kind exists. IDN-08 access for advisor-booked guests (a linked guest still gets no check-in or documents; the agent handles them). Both rows stay Partial.

## 5ag. BM49 result (built, not committed)

Theme: TRU-05 and UX-02.
- **TRU-05:** `src/ui/failedReschedule.test.tsx` moves a dinner against a stubbed server that refuses (409 full, 500). The original time still shows with "Nothing was changed", the message is plain, no cancel call is made. Row now Built.
- **UX-02:** `.page--wide` on the two catalogue compare screens, the excursion compare and the difficulty screen; `.workspace` side filter column on the whole-journey filter. CSS at 1280px and up only, so phones are unchanged.
- **Also:** BM48 left `traceability.test.ts` failing (DRM-10, DSC-11 Built with no tag); tagged `journeyAccess.test.ts`.
- **Not done:** no browser check, so UX-02 stays Partial; the planning day view has no wide layout.

## 5ah. BM50 result (built, not committed)

Theme: assistant and search (AST-02, SEA-04, SEA-05).
- **AST-02:** the ship source now says "as of {time}"; the library source says it is written ahead of time and not live. Test `src/ai/answerFreshness.test.ts`. Row Built.
- **SEA-04:** answer cards show scope and source with a time; results end with a source line. Row stays Partial: only three topics have direct answers.
- **SEA-05:** `venueState` gives open, closed or temporarily unavailable (`unavailableSince`, set by the ship); venue list and page show it with a ship-time stamp. Row stays Partial until the server sends `unavailableSince`.
- `npm run test`, `lint`, `tsc -b` per the working rules.

## 5ai. BM51 result (built, not committed)

Theme: loyalty and rebook (REM-04, REM-07, REM-08, REM-10, REM-14).
- **REM-04:** album copy says who can see it and that there is no download button; `albumRules` (`mySharedIds`, `canTakeBack`) and a "Take back everything I shared" button. Row Built. Sharing, per-person take-back and party-only visibility already existed.
- **REM-07:** `LoyaltyView.syncedAt` ("Checked {time}"), `POST /me/loyalty-summary/reports` (table `LoyaltyReports`, five open at a time), the guest's own reports listed. No staff screen answers a report; nothing on the record changes. Row Built.
- **REM-08:** rebook options carry `reasons` (`cabin`, `party`, `length`, `credit`); `GET /bookings/{n}/rebook?category=&guests=` prices for another stateroom type or party size and `POST /rebook/holds` takes the same two fields. Screen has two selects, a reset, and the "no health or children's details" line. Row Built; only those two inputs are editable.
- **REM-10:** `LoyaltyView.credits` (source, original, left, expiry, expired, `eligible`), `used` (redemptions from `fcc` folio lines), currency, and `walletTotals` which flags a history that does not add up. Row Built; onboard credit from holds is not in the wallet.
- **REM-14:** `POST /me/referrals` (first name only, ten open, needs a loyalty record) and `DELETE /me/referrals/{id}` (only while `invited`); incentive and payment timing stated. Row stays Partial: no reunion tool.
- **Tests:** `wallet.test.ts`, `albumRules.test.ts`, `httpApi.test.ts`; server tests in `FinishApiTests.cs` (written, not run). `dotnet` is not installed here, so none of the C# was compiled; `InMemoryFinish.cs` was updated for the new store methods. Run `npm run test`, `lint`, `tsc -b` per the working rules; no browser check.
- **Not done:** the front end does not yet show the "who can use it" text for any code other than `booker`; selecting a new stateroom reloads the dates with no focus management.

## 5aj. BM52 result (built, not committed)

Theme: pre-cruise (PRE-07, PRE-10, PRE-12, PRE-15, PRE-17).
- **PRE-07:** `Excursion.ConfirmAccess` (server, four authored tours) reaches the front end as `confirmAccess`; the tour card shows "Exertion: ..." and the confirm-with-operator line, and the fit finder's reason says so. Row Built.
- **PRE-10:** `accommodationStatus` lists each ticket guest's wheelchair, listening or large-print request and its status under "Your seats". Row Built; requests stay booking-wide.
- **PRE-12:** guardian-consent wording and state, `signOutAuthority` list, guardian-only note for a child's own account. No server change: `confirmed` was already required and `Manages` already restricts saving to the booker. Row Built.
- **PRE-15:** `UsageWindowDto` on `PackagesViewDto`; the screen states the window and keeps an expired sailing's list as history. Row Built.
- **PRE-17:** `tableAllocation` and an allocation card (shared time, seats by cabin, split flag). Row stays Partial: no friend replies and no linked-booking time search.
- **Tests:** `excursionFit.test.ts`, `ahead.test.ts`, `entitlements.test.ts`, `tickets.test.ts`, `aboard.test.ts`. `dotnet` is not installed, so the two C# changes (`ExcursionRules.cs`, `PlanService.cs`/`PlanContracts.cs`) were not compiled. Per the working rules only `npm run test`, `lint`, `tsc -b`, `build` were used; no browser check.

