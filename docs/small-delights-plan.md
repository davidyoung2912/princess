# Phased implementation plan for the small delights

Status: **Plan saved 2026-11-02. Phase DL1 is built (section 5); DL2 to DL9 are planned.**
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
| DL2 | Calendar, print and share cards | D2-4, D4-7, D8-6, D4-8, D1-8, D8-4, D8-9, D3-6, D7-5 | DL1 (`delights.ts`) | Planned |
| DL3 | Discover and cabin helpers | D1-2, D1-4, D1-5, D1-6, D1-7, D0-3, D0-6, D0-1, D0-7 | none | Planned |
| DL4 | Plan polish | D4-1, D4-2, D4-4, D4-5, D4-6, D2-5, D2-7 | DL2 (calendar) | Planned |
| DL5 | Prepare | D3-1, D3-2, D3-3, D3-5, D3-8, D0-2, D0-4, D0-8, D2-6, D2-8 | DL1 | Planned |
| DL6 | Travel day and embark | D4A-1, D4A-2, D4A-6, D4A-8, D5-1 to D5-8 | DL1 | Planned |
| DL7 | Sea days | D6-2 (tonight badge), D6-4, D6-5, D6-7, D6-8, D6-9, D6-10 | none | Planned |
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
