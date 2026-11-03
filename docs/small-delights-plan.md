# Phased implementation plan for the small delights

Status: **Plan saved 2026-11-02. Phases DL1 to DL7 are built (sections 5 to 11); DL8 and DL9 are planned.**
Source: `docs/small-delights.md` (IDs below, such as `D2-1`, are from that file).

## 1. Ground rules (from `CLAUDE.md` and the leading-features plan)

- One phase at a time. Tests with each phase. Verify with `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`, and `npm run api:check` when the `Api` interface changes. Never a full `dotnet test`; no browser or Playwright testing.
- Commit and stop after each phase; commit or push only when asked.
- Logic lives in plain TypeScript under `src/domain` (node-testable); React stays thin. Strings go in `src/i18n/locales/en.ts`. Every new route goes in `src/routes/routes.ts`, `src/screens.ts` and `src/routes/screenWords.ts`, and is reachable from a hub in `src/routes/hubs.ts`.
- Front end first, as in H1 to H8: small per-person state goes through the existing memory store (`src/hooks/useMemory.ts`); anything that needs the server to follow the guest between devices is listed as "not done" at the end of the phase rather than bundled in.
- Simulated data is a pure function over the demo clock or a seed, and the front end never says it is simulated beyond the existing concept notices.
- Every delight is optional and quiet (UX-02, XT-10), works at large text and with reduced motion, and counts against the nudge budget if it speaks unprompted.
- Each phase's notes go into this file, and the status table below is updated.

## 2. What is in and out

**Already built (found in the audit), so not planned:** D6-1 clocks change tonight (`onb.clockChange` banner), D6-3 noon report (`shipInfo.ts`), D6-6 deck-walk counter (steps and `LAP_STEPS`), D4-3 and D6-2 dress code as venue data (only the "tonight" badge is new, planned in DL6).

**Left out because they need an external source or licensed content:** D0-5 typical weather for a sailing, D4A-5 near the terminal, D6A-4 fifteen-minute circle, D6A-6 opening-hours check, D8-8 take-home recipes. D6A-3 (UV and heat nudge) reuses the existing sky feed and stays in; D3-4 (packing follows the forecast) is in only where the existing feed already gives a forecast.

**Everything else (about 80 items) is planned below.**

## 3. Phase table

| Phase | Name | Delights | Depends on | Status |
| --- | --- | --- | --- | --- |
| **DL1** | Words, texts and small checks (pure, no storage) | D1-1, D1-3, D2-1, D2-2, D2-3, D3-7, D4A-3, D4A-4, D4A-7, D6A-5, D7-3, D7-7 | none | **Built** (section 5) |
| DL2 | Calendar, print and share cards | D2-4, D4-7, D8-6, D4-8, D1-8, D8-4, D8-9, D3-6, D7-5 | DL1 (`delights.ts`) | **Built** (section 6) |
| DL3 | Discover and cabin helpers | D1-2, D1-4, D1-5, D1-6, D1-7, D0-3, D0-6, D0-1, D0-7 | none | **Built** (section 7) |
| DL4 | Plan polish | D4-1, D4-2, D4-4, D4-5, D4-6, D2-5, D2-7 | DL2 (calendar) | **Built** (section 8) |
| DL5 | Prepare | D3-1, D3-2, D3-3, D3-5, D3-8, D0-2, D0-4, D0-8, D2-6, D2-8 | DL1 | **Built** (section 9) |
| DL6 | Travel day and embark | D4A-1, D4A-2, D4A-6, D4A-8, D5-1 to D5-8 | DL1 | **Built** (section 10) |
| DL7 | Sea days | D6-2 (tonight badge), D6-4, D6-5, D6-7, D6-8, D6-9, D6-10 | none | **Built** (section 11) |
| DL8 | Ports and the way home | D6A-1, D6A-2, D6A-3, D6A-7, D6A-8, D6A-9, D7-1, D7-2, D7-4, D7-6, D7-8, D7-9 | DL1, DL2 | Planned |
| DL9 | Memory and return | D8-1, D8-2, D8-3, D8-5, D8-7 | DL8 (stamps, pins, numbers) | Planned |

Order rationale: DL1 builds the shared module and proves the wiring cheaply. DL2 adds the export helpers that DL4, DL8 and DL9 reuse. DL3 to DL7 follow the guest's journey and are independent of each other, so they can be reordered. DL9 comes last because it consumes what DL8 collects (port stamps, pinned spots, trip numbers).

## 4. Phase outlines

Each phase gets its own detailed section (like section 5) when it starts. The outlines below are the intended shape.

### DL2 Calendar, print and share cards
`src/domain/export.ts`: one `.ics` builder (reusing `calendar.ts`) for the whole journey (D2-4), a day or week (D4-7) and a soft same-week-next-year hold (D8-6); print-ready views for bag tags, a poster of the week, a comparison card, a best-moment card and a certificate (D3-6, D4-8, D1-8, D8-4, D8-9) using print stylesheets and a canvas image where a share image is wanted; one keepsake page of ports, dates and menus (D7-5). No photos leave the device.

### DL3 Discover and cabin helpers
Pure helpers over the existing sailings, cabin and port data: sea/port strip (D1-2), sun side by day from the itinerary heading (D1-4), walk time from a cabin over the deck graph (D1-5, `deckGraph.ts`), neighbours above and below (D1-6), "pick up where you left off" from the recent-searches store (D1-7), "on that date you would be" (D0-3), cost per day against an authored land-holiday range with the method shown (D0-6), gut-check flip (D0-1), read-aloud button reusing the speech code already in `SummaryScreen` (D0-7).

### DL4 Plan polish
Rest block (D4-1) as a plan entry that the optimiser respects; walk between bookings from the deck graph (D4-2); sunrise and sunset on each day from the sky module (D4-4); a private note per booking (D4-5) and colour per traveller (D4-6) in the per-person store; birthday-at-sea note (D2-5); who-pays-what sliders over `ledgerSplit.ts` (D2-7).

### DL5 Prepare
Ready ring from `readiness.ts` (D3-1); one small thing a week from the weekly companion (D3-2); six-month passport check against an authored per-port rule table (D3-3); shared packing ticks (D3-5, device-first; server sharing listed as not done); currency at home from `rates.ts` (D3-8); trip nickname (D0-2); mood tiles that re-rank the shortlist (D0-4); remind-me-in-a-week (D0-8) and saved travellers (D2-6) and email-this-summary (D2-8), the last three device-first with the server work listed as not done.

### DL6 Travel day and embark
Traffic-light card from the door-to-ship timeline (D4A-1); show-the-driver card in the local language from authored terminal data (D4A-2); essentials-only mode as a display setting (D4A-6); ship-lengths progress (D4A-8); the check-in "ticket that fills in" (D5-1); cabin-ready message with a words route (D5-3); three landmarks to muster (D5-4); typical bag delivery window from authored ship data (D5-5); sail-away spot (D5-6); Wi-Fi QR and steps (D5-7, the QR code component exists); ticket stub saved to memory (D5-8); photo tips (D5-2).

### DL7 Sea days
Tonight dress-code badge on Home (D6-2); dish favourites (D6-4) and drink diary (D6-10) in the per-person store, with a menu match for the first; park-my-spot pin on the deck plan (D6-5); say thanks to a venue (D6-7, no rating, no tip data); celebration day card (D6-8); night-friendly red theme as a display palette with a contrast test (D6-9).

### DL8 Ports and the way home
Pocket stopwatch in ship time (D6A-1); take-me-back card (D6A-2); UV and heat prompt from the sky feed (D6A-3); port stamps, pinned spots, offline day card (D6A-7, D6A-8, D6A-9); empty-cabin photo kept on the device (D7-1); final-day strip (D7-2); onboard credit note (D7-4); last-look prompt (D7-6); customs allowance left from the existing allowance data (D7-8); trip numbers from recap data (D7-9).

### DL9 Memory and return
Postcard to future self (D8-1); where I have sailed map (D8-2); favourites ranked from the guest's own notes (D8-3); nights at sea in the loyalty view (D8-5); ports I want next feeding Stage 0 (D8-7).

## 5. Phase DL1 in detail: words, texts and small checks

**Goal:** twelve delights that need no storage and no server, built as one tested module (`src/domain/delights.ts`) plus small additions to screens that already exist.

### 5.1 What gets built

| ID | Function in `delights.ts` | Where it shows |
| --- | --- | --- |
| D2-1, D2-2 | `ticketName`, `nameWarnings` | Traveller name fields on the booking and sign-up forms |
| D2-3 | `groupBookingNumber` | Confirmation screen and My Trips, with a copy button |
| D1-1 | `shipInFamiliarTerms` | Ship screen |
| D1-3 | `perNightPrice` | Sailing screen price toggle |
| D6A-5 | `tippingNorm` | Port guide |
| D3-7 | `outOfOfficeText` | Away screen |
| D4A-3 | `lastLookChecklist` | Getting-there screen |
| D4A-4, D7-7 | `arrivedMessage`, `rideMessage` | Getting-there and disembark onward screens, as copy-to-send text |
| D4A-7 | `setWatchPrompt` | Getting-there screen |
| D7-3 | `chargeUpReminder` | Final-night screen |

### 5.2 Definition of done

- Unit tests for each function, including edge cases (empty names, one-word names, zero nights, no ports).
- Every new string in `en.ts`; no new route unless a screen needs one (then `routes.ts`, `screens.ts`, `screenWords.ts` and a hub).
- `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` clean.
- This file's status and notes updated; the "not done" list is honest.

### 5.3 Built (2026-11-02)

Front end only; no REST contract changes. Logic in `src/domain/delights.ts` (19 tests in `delights.test.ts`); cards in `src/ui/delights/Delights.tsx`; a shared `CopyText` component for text the guest sends themselves.

- **D2-1, D2-2** on the booking guests step: shows the name as printed (`SMITH/JANE`) and hints for both names in one box, titles, digits, quotes, single letters and a possible swap. Hints never block.
- **D2-3** on the booking confirmation: number in groups of four, spoken form for a screen reader, copy button.
- **D1-1** on the ship screen: football pitches and a small-town population. **D1-3** on the sailing screen: the quote as whole party, per person or per person per night.
- **D6A-5** on the port guide: customary tipping for Mexico, Belize and Honduras (authored sample, marked as a general guide).
- **D3-7** on the away screen: out-of-office text in three tones with the return date from the sailing.
- **D4A-3, D4A-4, D4A-7** on getting there: last look at the door (not saved), an "I have arrived" message, and whether the device clock differs from ship time. **D7-7** on onward travel: a message for whoever is picking you up. **D7-3** on the final night: a charge-up reminder, earlier when a bag deadline comes first.
- **Verified:** `npm run test` (1721 passed), `npm run lint`, `npx tsc -b`, `npm run build`.
- **Not done:** the arrived and ride messages name Terminal 2 and do not read a moved terminal from the booking; the tipping norms cover only the three guide ports; D1-3 uses the quote's estimate, not a booked price; the messages are copied, never sent; the new screen text has no Spanish.

## 6. Phase DL2 in detail: calendar, print and share cards

**Goal:** the export helpers that DL4, DL8 and DL9 reuse, as plain tested TypeScript (`src/domain/export.ts`) with thin screens.

### 6.1 Built (2026-11-02)

Front end only; no REST contract changes. `calendar.ts` now also writes timed events (clock time with no zone) and tentative holds. Cards share one model (`Card`) and one layout (`cardLayout`) for paper and the saved PNG; `src/ui/delights/Cards.tsx` renders them, with print, save-as-image and copy-the-words buttons. 11 tests in `export.test.ts`.

- **D2-4** on the booking confirmation: one file with the sailing, check-in opens and closes, final payment (only when a balance is left) and sail-away.
- **D4-7** on the Plan screen: the whole week, or one day from its card, to a calendar; days with nothing booked add nothing.
- **D4-8** on the Plan screen: a poster of the week (print, image, or copy).
- **D3-6** on the luggage screen when the guest prints: a tag card per guest with a large-print option; no document detail.
- **D1-8** on the cabin chooser: the side-by-side as a card.
- **D8-4, D8-9, D7-5, D8-6** on Trip memories: best-moment card (one line, optional photo read in the browser only), certificate, itinerary keepsake, and a tentative same-week-next-year hold that says nothing is booked.
- **Follow-up fixes (same day):**
  - Calendar times are now written in UTC from the port's zone (the ship's zone on sea days, the home zone for check-in), so they land at the right moment in any time zone. Only all-day entries stay floating.
  - The keepsake lists every restaurant dined at (the recap gained `dinnerVenues`).
  - Bag tags carry the booking number: `TagsViewDto` and `TagsView` gained `number` (server change read-checked only; `dotnet` is not installed in this shell, so the server was not built here).
  - The comparison card has a link (`/home/cabins?s=&g=&f=&c=`) that opens the same sailing, party, fare and picks. `parseCompareQuery` drops anything that is not a plain token, and the screen ignores ids the guide does not know. It holds no names.
  - Spanish for all 108 `dl.*` strings (DL1 and DL2); native review still needed.
- **Verified:** `npm run test` (1736 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`.
- **Not done:** the text baked into calendar files and card layouts (event titles, "Sail-away", "Tables:") is English only; the image is a plain layout with no ship artwork.

## 7. Phase DL3 in detail: discover and cabin helpers

**Goal:** nine small helpers on the sailing, cabin chooser and decide screens, as pure tested functions (`src/domain/discoverDelights.ts`, 20 tests) with thin cards in `src/ui/delights/DiscoverDelights.tsx`.

### 7.1 Built (2026-11-02)

Front end only; no REST contract changes.

- **D1-2** on the sailing screen: a strip of days (sea, home port, dock, tender) with hours in port and a one-line count. Words carry the meaning; border style is only a second cue.
- **D0-3** on the sailing screen: pick a day and see where the ship would be, with times and a link to the port guide.
- **D0-6** on the sailing screen's price: cost per person per day beside an authored land-holiday range ($180 to $320 a day), with the method in a details block and "a guide, not a quote".
- **D1-4, D1-5, D1-6** on each cabin card, in one details block: sun by day (from the ship's heading on each sea day; nothing claimed on port days), walking minutes to the buffet, the arena and Guest Services plus the lift bank, and the public rooms above and below with a noise note.
- **D1-7** on the cabin chooser: the last comparison is remembered on this device when the guest ticks a cabin (not on a timer, per the H6 promise test), and offered once as "Pick up where you left off" with Reopen and Forget. A visit from a shared link ignores it.
- **D0-1** on Decide: a coin between two sailings, then "Were you hoping for that one?", then a hint that says only the guest can decide.
- **D0-7** on Decide: a read-aloud button on the decision summary (the same browser speech as the briefing).
- Spanish for all `dl3.*` strings; native review still needed.
- **Verified:** `npm run test` (1756 passed), `npm run lint`, `npx tsc -b`, `npm run build`.
- **Not done:** sun uses a simple east and west rule from the heading, with no time of year or latitude; walk times assume the cabin sits in the middle of its section; the cabin's deck and section come from the served cabin guide, not from a real deck plan; the land-holiday range is one authored figure for all destinations; read-aloud is on the decision summary only, not on the "is this for me" card; the last comparison keeps only picks, sailing, party and fare, and is not shared between devices.

## 8. Phase DL4 in detail: plan polish

**Goal:** seven small additions to the Plan screen and the pay-your-share ledger, as pure tested functions (`src/domain/planPolish.ts`, 15 tests) with thin cards in `src/ui/delights/PlanPolish.tsx`.

### 8.1 Built (2026-11-02)

Front end only; no REST contract changes. State is the new `polish` part of the per-person memory store (rest days, notes, colours, occasions).

- **D4-1** on each day card: set the day aside for rest. The day shows a rest line, stops offering tour and dinner gaps, and "Build my week" (`applyWeek`, new `skipDays` argument) leaves it alone.
- **D4-2** on each day card: the walk from the gangway (tours, sail-away, all-aboard) to a booked dining room, in minutes, decks and whether a lift is needed, reusing `walkMinutes` and the deck graph.
- **D4-4** on each day card: sunrise and sunset from the served sky feed, with a step-free place to watch each.
- **D4-5** on each booking: a private note (120 characters).
- **D4-6** on the plan: a dot beside each traveller's name, auto-assigned or chosen; the name and colour name are always in text.
- **D2-5** on the Plan screen: birthdays and anniversaries; ones that fall on a trip day say so and offer a copyable note for the ship, with a surprise option. Month and day only.
- **D2-7** on the share ledger: a slider per person that moves the others to keep the total; shares marked paid are locked.
- Spanish for all `dl4.*` strings; native review still needed.
- **Verified:** `npm run test` (1771 passed), `npm run lint`, `npx tsc -b`, `npm run build`.
- **Follow-up (same day):**
  - The `polish` part already travels in the synced `memory` document (`restOf`), so notes, colours, rest blocks and birthdays follow the guest between devices; a test now covers the round trip. The earlier "this device only" note was wrong.
  - A rest block can be all day, morning (before noon), afternoon (noon to 6) or evening (after 6). Applying the week and the week preview leave anything starting inside it alone (`inRest`, `applyWeek(..., rest)`). Older saves with a plain list of days load as whole days.
  - Walks now also cover cabin to the first dining room and back from the last, when the booking has a cabin number (`dayWalks`, `useMyCabin`).
  - Sunset is watched from the promenade on the side the sun sets; sunrise from the other side; with the sun ahead or behind, the open Lido deck (sunset) or Sea View (sunrise), either side (`watchSpot`).
- **Verified:** `npm run test` (1777 passed), `npm run lint`, `npx tsc -b`, `npm run build`.
- **Server follow-up (same day):**
  - The week builder (`POST /me/autopilot/plan`) takes an optional `rest` list in its preferences (`{ day, part }`, one per day, parts all, morning, afternoon, evening) and plans nothing that starts inside it; it also does not suggest a tour inside a rest block. The client sends the blocks with the request (`weekKey`) and still filters, so applying a week never touches them. Bad blocks give `400 badAutopilot`.
  - `GET/PUT /bookings/{number}/celebrations` (table `dbo.Celebrations`) tells the ship about birthdays and anniversaries that fall during the trip. Only the label, month and day and the surprise flag are kept (never a year). Saving replaces the list (at most 12) and stamps each new or changed entry with the time it was told; an unchanged one keeps its first time. Errors: `400 badCelebrations/tooManyCelebrations/badLabel/badDate`, `403` for a child account, `409 notConfirmed`. The Plan screen's birthday card shows whether the ship has been told and has a Tell/Update button; the copyable note stays.
  - `dotnet` works in this shell with `DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1` and `~/.dotnet` on the path.
- **Verified:** `npm run test` (1779 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`, and `dotnet build` of the solution (0 warnings, 0 errors). The new server tests (`AutopilotRulesTests`, `CelebrationRulesTests`) compile but were not run, per the rule against `dotnet test`.
- **Not done:** the ship's side only reads the table (there is no staff screen); the rest block is not stored on the server, only sent with each week request; walks cover the gangway, cabin and dining rooms only because tours are ashore and ship events are not in the plan.

## 9. Phase DL5 in detail: prepare

**Goal:** ten small additions to Home, the readiness, clearance, quiz, decide, saved and guests screens, as pure tested functions (`src/domain/prepareDelights.ts`, 27 tests) with thin cards in `src/ui/delights/PrepareDelights.tsx`. No new routes.

### 9.1 Built (2026-11-02)

Front end only; no REST contract changes. State is the new `prepare` part of the per-person memory store, which travels in the synced `memory` document (a test covers the round trip).

- **D3-1** on the readiness screen: a ring beside each traveller's existing number and bar (`personReadiness`); the percent is written in the ring and in text.
- **D3-2** on Home: one two-minute task, the oldest one due and not done (ten authored tasks from 26 weeks out). Done ticks it off; "Not for me, stop these" turns it off for good. Silent in calm mode or with a nudge budget of zero.
- **D3-3** on the clearance screen: type a passport expiry date and see each stop checked (authored rule: Mexico and the home port must not expire during the trip; Belize and Honduras ask for six months). The date is not kept. Nothing says "approved"; the card sends the guest to the official source.
- **D3-5** on the packing screen: a line saying ticks are kept on the booking. They already were (`dbo` ticks per booking id), so everyone who opens the booking sees the same list; nothing new was built.
- **D3-8** on the clearance screen: what $100 is worth in the home currency and in pesos, Belize dollars and lempiras, from the served rate table, with its date.
- **D0-2** on Saved and Decide: a trip nickname, shown on Home and put in front of the decision summary, the invitation and the emailed recap.
- **D0-4** on the quiz screen: six mood tiles; the three stops are put in order of how many tiles they match, each with the reason in words. Sea days are said to come from the ship.
- **D0-8** on Saved and Decide: "Remind me in a week" stores a date; Home shows one plain note once the week is up, until the guest taps "Thanks, that is all".
- **D2-6** on the guests step: save the person being typed (names, date of birth, citizenship) and fill another guest from the saved list. Up to 8; forgettable one by one.
- **D2-8** on Decide: "Open in my email" builds a `mailto:` link with the summary and what is not in the price, to an optional address. Nothing is sent from the app.
- Spanish for all `dl5.*` strings; native review still needed.
- **Verified:** `npm run test` (1806 passed), `npm run lint`, `npx tsc -b`, `npm run build`.
- **Follow-up (same day), the four "not done" items:**
  - **Ring on Home:** `HomeReadyCard` shows the signed-in traveller's ring, the percent in words and the next open item with its due date, once the checklist and documents have loaded.
  - **Passport rules served and by nationality:** `GET /reference/entry` returns the months by stop for a U.S. passport and another one, and whether to check for a visa; the client keeps the authored rows until the table arrives (`normalizeEntry`, `applyEntry`, runtime `TABLES`). The card starts from the first traveller's citizenship in Documents and lets the guest change it.
  - **Saved travellers in their own encrypted document:** new user state key `travellers` (encrypted, written only while "keep my private notes" is on, deleted on withdrawal). The memory document no longer carries them; a copy of the memory document pulled from before is sent back cleaned.
  - **Reminder pushed by the server:** new user state key `reminder` (`{ at, sailingId }` or `{}`, in the clear so the push service can read it). `PushRules.Build` adds a `reminder` notice once `at` has passed (category offers, so the budget, calm mode and quiet hours hold it back like any suggestion); it is sent once per `at`. It works for a guest with no booking. The Home note stays for a phone without alerts.
  - **Verified:** `npm run test` (1810 passed), `npm run lint`, `npx tsc -b`, `npm run build`, and `dotnet build` of the solution (0 warnings, 0 errors). The new server tests (`PushRulesTests`, `StateTests`, `EntryReferenceTests`) compile but were not run, per the rule against `dotnet test`.
- **Second follow-up (same day):**
  - **Reminder email:** a new provider seam `IEmailSender` (`Providers:Email`, default `sim`: records and delivers nothing). The reminder document gained `email`; the guest ticks "Also send one email" when setting the reminder (or later). `POST /me/push/dispatch` now also calls `ReminderEmailService.SendIfDueAsync`: one email to the account address, once per reminder date (logged in the push delivery log under `reminder:{at}:email`), only if asked for and due. Each email carries a link to `GET /public/reminder/unsubscribe/{token}` (anonymous, rate-limited, HMAC token bound to the user and date under a key derived from the signing key) that switches the email off and answers a small page. The app asks the server to check when the time has come, with no alert permission needed (`useReminderEmail`). Base address for the link: `Public:ApiBaseUrl` (relative when unset).
  - **Who ticked a packing item:** `dbo.PackingTicks.TickedBy` (added idempotently to existing databases); `PackingViewDto.TickedBy` maps an item to the first name of the guest who ticked it, only for people on the booking; the packing screen shows "Ticked by {name}". Items ticked before this show no name.
  - **Mood tiles move the room picks:** `recommend(answers, moods)` adds a reason-bearing boost: slow-day moods (sea days, quiet beach) favour balcony and suites, out-and-about moods favour interior and oceanview; each pick says so, and without tiles the result is unchanged.
  - **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`, `dotnet build` (0 warnings, 0 errors); new server tests (`ReminderRulesTests`, `FirstNameTests`) compile but were not run.
- **Still not done:**
  - The email is the simulated sender until a real provider is chosen; there is no bounce handling, and no scheduler (the check runs when the guest's app asks).
  - The entry table is four authored rows with months and a visa hint, and knows only U.S. or other.
  - Packing ticks are per booking; there is no shared list across separate bookings.
  - The summary email (D2-8) is composed by the guest's own mail app; there is no server send.

## 10. Phase DL6 in detail: travel day and embark

**Goal:** twelve small additions to the getting-there, check-in, embarkation, Wi-Fi, pass and memory screens, as pure tested functions (`src/domain/embarkDelights.ts`, 15 tests) with thin cards in `src/ui/delights/EmbarkDelights.tsx`. No new routes.

### 10.1 Built (2026-11-02)

Front end only; no REST contract changes. Ticket stubs are the new `embark` part of the per-person memory store (it travels in the synced `memory` document); "Essentials only" is a per-device display setting.

- **D4A-1** on getting there: a green, amber or red card (shape and word as well as colour) with the leave-by time in the largest type, or the time to be at the terminal when there is no road leg.
- **D4A-2** on getting there: a big-text card for a driver, in English or Spanish, with the terminal and address. The card text stays in the chosen language whatever the app language is.
- **D4A-8** on getting there: when driving, "N ship-lengths to go (M miles)", counting down from the leave-by time (45 mph assumed; ship length from the ship facts).
- **D4A-6** in display settings: "Essentials only". Before boarding, Home shows the boarding pass, the leave-by time and the Guest Services number, and motion is reduced.
- **D5-1** on the check-in overview: a ticket-shaped list that fills in line by line, with the state also in text for a screen reader.
- **D5-2** the face-photo step already shows the four tips before the camera; the document step takes typed details and has no camera, so nothing was added.
- **D5-3** on the embarkation screen: when the stateroom is ready, its number, deck and a route in words (lift bank in the cabin's section, and which side), with a copy button.
- **D5-4** on the embarkation screen: up to three places on the way from the cabin to the guest's muster station, ending with the station.
- **D5-5** on the embarkation screen: "Bags usually reach cabins between 1:00 pm and 5:00 pm", with its source, until bags are delivered.
- **D5-6** on the embarkation screen: the Promenade on deck 9 and the time to be there (twenty minutes before sailing).
- **D5-7** on the Wi-Fi screen: a QR to join the guest network (open, so no password) and the airplane-mode and roaming steps.
- **D5-8** on the boarding pass: "Keep a ticket stub in my memories" (asked for, never automatic); stubs show first in Trip memories and can be removed.
- Spanish for all `dl6.*` strings; native review still needed.
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`.
- **Not done:**
  - D5-3 is shown in the app when the stateroom is ready; the "cabin ready" notification (a push notice) and a server-side route are not built.
  - The bag window (D5-5) is one authored window for the ship, not read from the ship.
  - The route to the cabin names the lift bank and side by a rule on the cabin number, not from a real deck plan; the three landmarks are the first named rooms on the decks the route crosses.
  - The Wi-Fi network name is authored and the QR only joins the network; the sign-in page still asks for the stateroom number and last name.
  - The driver card has English and Spanish only, and the address is Port Everglades; no card for the ports of call.
  - The mileage behind the ship-lengths is minutes at an assumed speed, not a map distance.

## 11. Phase DL7 in detail: sea days

**Goal:** the sea-day delights as pure tested functions (`src/domain/seaDelights.ts`, 14 tests) with thin cards in `src/ui/delights/SeaDelights.tsx`. No new routes.

### 11.1 Built (2026-11-02)

Front end only; no REST contract changes. Favourites, diary, parked spot, kept thank-yous and celebration messages are the new `sea` part of the per-person memory store (it travels in the synced `memory` document). "Night" is a new colour theme choice, per device.

- **D6-2** on Home while aboard: "Tonight: elegant evening / smart casual / casual" as a badge with a mark and a word. Elegant follows the packing rule (nights 2 and 7 of a seven-night cruise); the first and last evenings are casual.
- **D6-4** on each venue's menu: a "Heart this dish" toggle button. Hearted dishes show on Home and the venues list when their room is open for dinner today.
- **D6-5** on the deck plan screen: park a lounger or table at a pool deck, bar, dining room or show lounge, with a note and a 30 to 90 minute timer; the pin shows on the plan (dashed square and the words "My spot"), and the card says when it is due back.
- **D6-7** on the venue screen and the venues list: words to thank a team (and a person if named). No rating, no tip. Copy it, and optionally keep a copy in memories.
- **D6-8** on Home on the day of a birthday or anniversary the guest entered in Plan: a card with the guest's own private messages (up to six).
- **D6-9** in display settings: "Night (red, low glare)". All colours are in `themes.css`, checked by the contrast test in standard and high contrast (text at 7:1 or better); the browser bar colour follows.
- **D6-10** on the drinks screen: a private diary (liked, fine, not again) with an "Order again" list of liked drinks.
- Spanish for all `dl7.*` strings; native review still needed.
- **Verified:** `npm run test` (1844 passed), `npm run lint`, `npx tsc -b`, `npm run build`.
- **Not done:** see 11.2, which closes most of what was left here.

### 11.2 Follow-ups (2026-11-02)

- **D6-7 sent to the ship:** `POST /bookings/{n}/thanks` and `GET /thanks` (table `Thanks`, `SeaService`, `SeaRules`). An adult guest on a confirmed booking sends; 30 per booking. No rating, no tip, no reply.
- **D6-8 cabin-mates:** `GET /celebrations/wishes` and `POST /celebrations/{id}/wishes` (table `CelebrationWishes`). Anyone on the booking, including a supervised child, adds up to six messages per celebration, shown with a first name. The local-only `wishes` in the memory part is no longer used by the screen.
- **D6-4 tonight's menu:** `onTonight` rotates the dishes of the dining rooms and specialty restaurants by cruise day (about two nights in three); counters and cafés stay fixed. This is an authored concept rotation, not the ship's menu, so the card says to check the menu on the night.
- **D6-5 reminder:** after a tap that grants notification permission, a timer in the page shows a notification through the service worker when the spot is due. It is not a server push, so it is lost if the browser closes the page.
- **D6-10 cruise day:** now the ship's date (`shipZoneAt`), not the UTC date.
- **Verified:** `npm run test` (1847 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`. **The C# was not compiled or tested** (no `dotnet` run, by the project rule): run `dotnet build` in `server/` and `SeaRulesTests` before relying on it. The new tables are in `db/01-schema.sql` and need the schema script run on the database.
- **Still not done:**
  - A surprise celebration's messages are visible to everyone on the booking, including the person it is for; the card tells guests to keep surprises out.
  - No server-scheduled push for the spot timer, and no "you said, we did" loop for thank-yous.
  - The rotation is client-side authored; a real menu feed would replace `onTonight`.
