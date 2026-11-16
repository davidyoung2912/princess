# Explorer Harmony Plan

One consistent onboard experience across the six Explorer pages (Dining, Entertainment, Shopping, Spa, Exercise, Activities), feeding Today's Plan.

Status: **plan only, nothing built.** Work proceeds in phases; each phase ends with a commit and a stop (CLAUDE.md). Verification for every phase is `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`. No browser testing and no `dotnet test`.

---

## 1. Where we are today (findings)

| Page | Route | Today | Gap against the brief |
|---|---|---|---|
| Dining | `/dining-today` | Only the guest's dinner reservations for the current day, plus a link to `/plan/dining` | No venue list, no date, no menus, no events, no pins |
| Entertainment | `/entertainment` | Flat day programme from `EVENTS`/served `ProgramView`, filter chips, "next" card, plan toggle via `api.onboard.togglePlan` | No venues, no date picker (current day only), no venue detail |
| Shopping | `/shopping-today` | `MyPicks` + `ItemList` of `special` items | Not venue-based, no hours or events |
| Spa | `/spa-explorer` | `MyPicks` + `ItemList` of `spa` catalogue items | No reservations view, no venues, no date |
| Exercise | `/exercise-explorer` | `MyPicks` + `ItemList` of `fitness` items | Same |
| Activities | `/activities-explorer` | `MyPicks` + `ItemList` of `faith` items + `Parties` | Same |
| Today's Plan | `/today-plan` | Port + plan-toggled programme events + dinner reservations, current day only | Does not include shopping, spa, exercise or activity items |

What already exists and should be reused rather than rebuilt:

- **Dining data:** `domain/dining.ts` (`VENUES`, slots, reservation clash rules), `domain/menus.ts` (`DIRECTORY`: hours by sea/port, dishes tagged for allergens, `dishesFor(diets)`, `venueState`), per-ship swap in `domain/shipVenues.ts`, served from `/reference/ships/{id}/venues` (Sun is authored, Sky and Sapphire are concept samples in `server/.../Content/ship-venues.json`).
- **Reservation CRUD for dining:** `api.plan.dining` has `view`, `slots`, `reserve`, `cancel`, `move`, `late`. The UI is `ReservationsScreen`, `/plan/dining` and `/plan/reservations/:id`. Waitlists are in `Waits.tsx`.
- **Programme:** `domain/program.ts` (`ShipEvent`, `DatedEvent`, day kinds, mid-day `PLAN_CHANGES`, `overlapping()`, `REMINDER_MINUTES`) and `domain/entertainment.ts`. Server: `/onboard/program/{day}` and `/onboard/plan/{eventId}` (the `mine` list), per-ship `ship-programmes.json`.
- **Catalogue items (spa, fitness, faith, shop, special):** `domain/catalogue.ts` with `times`, `limit`, `mode: book | order | going`, and the `/selections` add/remove API. These are Sun-only and venue-less (`placeId` only). There is no update/move.
- **Time:** `useNow`, `useShipTime`, `useCurrentDay`, `shipZoneAt`, `itinerary(sailing)`, `useShipDay` (sea/port).
- **Pinning:** `togglePin` in `domain/tileOrder.ts` and `settings.pins` (per device, max 5, screens only). Server favourites (`api.discover.favourites`, `kind:id` keys, cross-tab sync through `channel`) exist for sailing, port and ship.
- **Shell:** `EXPLORER_PATHS` gives the shared green Explorer colour. `Card`, `Chip`, `StatusBadge`, `Saved` (offline copy), `SendToChat`, `useSavedCopy`.

Content sources (`docs/princess-*.md`) and what they contain:

| File | Gives us |
|---|---|
| `princess-restuarants.md` | Dining venues for Sun, Sky and Sapphire (complimentary, casual, specialty), 7-day MDR dinner rotation (theme, starters, entrées, desserts), breakfast specials, sea-day lunch, buffet themes, static specialty and casual menus |
| `princess-bars.md` | Bar and lounge matrix per ship, cocktail menus, package caps |
| `princess-entertainment.md` | Venue short and long descriptions per ship, 7-day Morning / Noon / Night schedule per ship |
| `princess-spa-casino.md` | Lotus Spa, Enclave, salon, casino (closed in port, opens 30–45 min after sailaway), tech desks; 7-day schedule |
| `princess-exercise.md` | Gym, studios, courts, pools with hours, short and long text; 7-day class grid by day status |
| `princess-shopping.md` | Retail hours rules (closed in port), venue directory, pop-ups, 7-day schedule |
| `princess-activities.md`, `princess-cruises-sea-vs-port-activities.md` | Activity hubs per ship, about 38 activities in eight time bands, sea vs port variants |
| `princess-special-events.md` | Niche events: winemaker dinners, 360, tastings, enrichment |
| `princess-today-plan.md` | Day-mode state machine (embark, port, scenic, sea, disembark), plan header |
| `onboard-dining-management-requirements.md`, `onboard-entertainment-management-requirements.md` | Requirements: venue detail fields, booking states, disruption handling, offline, notifications, IA and screens, journeys A–H |

**Key content constraint:** the docs give each event as a *bucket* (Morning / Noon / Night), not an exact start time, and the schedule is for a 7-day sailing. We must (a) author start times and durations when converting, and (b) map "Day n" onto the existing day-kind system (`embark`, `sea`, `port`, `seaMid`, `last`, and so on) so sailings of other lengths still work.

---

## 2. Target experience (the contract every Explorer obeys)

### 2.1 Explorer main page (identical skeleton on all six)

1. **Header card:** page title, one-line purpose.
2. **Ship clock card (directly under the header):** `Day 3 of 7 · Tue 12 Nov · 2:32 pm ship time · At sea` (or port name). It updates each minute, uses the ship's zone (`shipZoneAt`), and shows "Clocks go forward tonight" style notes where the zone changes.
3. **Pick a Date button:** opens an accessible dialog, a vertical list or grid of every sailing day (day number, weekday and date, port or "At sea", a dot where the guest has plans). Choosing a day closes the dialog and returns focus to the button. A "Today" shortcut and previous / next day buttons sit beside it. The chosen day is shown clearly ("Viewing Day 5, Fri 14 Nov") and is *not* the same as the ship's today when they differ.
4. **My reservations for the day (Dining and Spa only):** the guest's reservations for the chosen day, each with time, venue, party, status and Change / Cancel; empty state with "Book a table / Book a treatment"; a "New reservation" button.
5. **Venue list**, pinned first (see 2.3), then the default order for that explorer. Each **venue card** has:
   - short title and a pin toggle (`aria-pressed`)
   - short description (one line), then the longer description (clamped, with "More" on the detail page)
   - open / closed state for the chosen day ("Open now", "Opens 5:30 pm", "Closed in port, opens 45 min after sailaway")
   - **next 1–3 events** for that venue on the chosen day (rule in 2.4)
   - the whole card is one link to the venue detail page (the pin is a separate button).
6. **Filters (light):** a chip row per explorer for kinds (for example Dining: Included / Specialty / Casual / Bars; Entertainment: Shows / Music / Nightlife). Search box when there are more than about 12 venues.
7. Everything is wrapped in `Saved` so a cached copy shows offline, with a "last updated" note.

### 2.2 Venue detail page

Route pattern: `/<explorer>/<venueId>?day=N`.

1. Header with venue name, deck and location (link to the deck plan with the pin placed on the venue), pin toggle and Share to chat.
2. Ship clock card and **Pick a Date** button (same component and state as the main page; the date carries over).
3. **Reservations for this venue and day (Dining and Spa):** the guest's reservations here, plus "Reserve" with a slot picker.
4. **Summary:** short and long description, open / closed hours *for the chosen day* (sea vs port rule), price or cover charge, dress code, age limits, accessibility notes, what's included in packages, tips.
5. **Menu for the day (restaurants):** meal periods (breakfast, lunch, dinner) with that day's themed menu from the 7-day rotation, formal night flag, specials, allergen and diet badges, a "suits my diet" filter using the guest's profile, and an "ask the maître d'" note for halal and kosher (existing `NEEDS_ASKING`).
6. **Events for the day:** every event at the venue, in time order, each as a row with time range, title, short detail, cost, age, status badges (moved, cancelled, filling up, now, next) and an **Add to plan / Remove from plan** toggle (`aria-pressed`, announced politely). Clash warning if it overlaps something already planned.
7. Adjacent info: related venues, "Open now nearby" and a link to the deck plan.

### 2.3 Pinning

- Pinned venues sort first within their explorer; relative order inside pinned and unpinned groups stays stable.
- Same visual and behaviour as the screen pin (`Pin` icon, `aria-pressed`, `aria-label` "Pin <venue>").
- **Storage (confirmed):** extend server favourites with a `venue` kind (`venue:<shipId>.<venueId>`) so pins follow the guest across devices (matches the "thin client" rule) and sync across tabs through the existing channel. The ordering is a pure function `orderVenues(venues, pinnedKeys)` in a plain TS module.
- Cap at 10 pins per explorer (message when full, as chat pins do with `pin.full`).

### 2.4 "Upcoming" rule for venue cards

For chosen day D, ship time `now`, and each venue's events:

- **D is the ship's current day:** keep events whose end is no earlier than `now − 15 min` (so anything in progress, upcoming, or ended within 15 minutes remains). Sort by start and take the first 3. In-progress events get a "Now" badge; cancelled events are shown struck through only if they would otherwise qualify, and never count toward the three.
- **D is a future day:** the first 3 events of the day.
- **D is a past day:** no "upcoming" lines. The card says "This day has finished"; the detail page still lists the day's events read-only (no plan toggles).
- The rule is a pure function `upcomingEvents(events, chosenDay, currentDay, now, { graceMinutes: 15, max: 3 })` with table-driven tests (boundary at exactly 15 minutes, midnight rollover, zone change days, moved and cancelled events).
- Note on interpretation: "expired" is measured from the *end* of an event so a long event (a two-hour sale) doesn't vanish 15 minutes after it starts. Confirm this reading (open question 2).

### 2.5 Plan integration

- One plan model for everything with a time. Events from all six Explorers use the same toggle. Server-side this extends today's `mine` list on `/onboard/plan/{eventId}` so ids from catalogue-derived events (spa classes, fitness classes, special events) are accepted too, with `day` included.
- Reservations (dining and spa) appear in the plan automatically; they are managed in the Explorers and don't need a separate toggle.
- **Today's Plan** becomes the seventh member of the family: same ship clock card, same Pick a Date button (so future days can be reviewed), one time-ordered timeline mixing planned events, dining reservations, spa appointments and tours, grouped by Morning / Afternoon / Evening, with clash warnings (`overlapping()`), and per-item links back to the venue.
- Reminders reuse `REMINDER_MINUTES` (15 min) and the existing push and reminder pipeline; moved or cancelled planned events surface a banner with the ship's reason.

### 2.6 Reservations (full CRUD)

| | Dining (exists, to be surfaced) | Spa (new) |
|---|---|---|
| Create | `api.plan.dining.reserve` with venue, day, time, party | New `api.plan.spa.reserve`: treatment, day, time slot, guests, therapist preference, notes (allergies, pressure) |
| Read | `view`, filtered to chosen day / venue | `view`, same filtering |
| Update | `move` (day and time), `late` | New `move`, plus edit party and notes |
| Delete | `cancel` | New `cancel` with the cancellation rule shown before confirming (24 h policy from the doc, server-configurable) |
| Rules | Clash check (`tableClash`), dining window (`diningWindow`), specialty cover charge via `mealCharge`, waitlist when full | Overlap check (same guest cannot have two treatments at once or one while a dinner is booked), age limits (`minAge`), price and folio charge shown up front |

UI: one `ReservationList` + `ReservationEditor` dialog pair shared by both, with focus trap, Escape to close, inline errors and `role="status"` confirmations. Full-page `/plan/reservations/:id` stays as the deep-link target.

### 2.7 Venue-aware hours

Generalise `venueState` / `openAt` from dining to every venue with an hours rule that supports:
- fixed windows by day type (sea / port / embark / last);
- relative rules ("opens 30–45 min after sailaway; closed while alongside": shops, casino);
- 24-hour venues with staffed hours (gym);
- temporary unavailability set by the ship (`unavailableSince`).

---

## 3. Architecture

### 3.1 Unified model (framework-free TypeScript, then mirrored in C#)

```ts
type ExplorerKind = 'dining' | 'entertainment' | 'shopping' | 'spa' | 'exercise' | 'activities'

interface ExplorerVenue {
  id: string; shipId: string; explorer: ExplorerKind; kind: string   // e.g. 'main' | 'specialty' | 'bar'
  title: string; short: string; long: string
  placeId: string; deckLabel: string
  hours: HoursRule[]; unavailableSince?: string
  price?: { cover?: Cents; note?: string }; dress?: DressCode; minAge?: number
  features: string[]; accessibility: string[]
  bookable: 'none' | 'dining' | 'spa'
  order: number
}

interface VenueEvent {
  id: string; venueId: string; explorer: ExplorerKind
  day: number; start: string; minutes: number
  title: string; detail: string
  price: Cents; age: AgeGroup; interest: EventInterest | string
  status: 'on' | 'moved' | 'cancelled'; reason?: string
  capacity?: { total: number; left: number }      // drives "filling up"
}

interface VenueDay {                                 // everything for one venue on one day
  venue: ExplorerVenue
  hours: Window[]                                    // resolved for that date
  menus?: MealMenu[]                                 // restaurants only
  events: VenueEvent[]
}
```

Pure, unit-tested modules under `src/domain/explorer/`: `upcoming.ts` (rule 2.4), `venueOrder.ts` (pins), `hours.ts`, `dayMapping.ts` (7-day doc schedule → day kinds), `planTimeline.ts` (merge and clash), `explorerDay.ts` (chosen-day resolution).

### 3.2 Backend (C# in `server/`, SQL scripts in `db/`)

- Content: new `Content/ship-explorer.json` (or one file per explorer) per ship (Sun, Sky, Sapphire) generated by `scripts/gen-ship-explorer.ts` from authored data in `scripts/ship-explorer-data/*.ts`, following the existing `gen-ship-venues.ts` / `gen-ship-programmes.ts` pattern. The same rows seed `ref.*` tables in `db/seed`.
- Endpoints (all external data mocked behind interfaces, so the front end never knows what is simulated):
  - `GET /onboard/explorer/{kind}?day=N` → `{ day, ship clock info, venues: VenueDay-lite[] }` (venue summaries plus that day's events per venue).
  - `GET /onboard/explorer/{kind}/{venueId}?day=N` → full `VenueDay`.
  - `GET|POST|PUT|DELETE` spa reservations under `/plan/spa/...`, mirroring the dining routes.
  - Favourites `venue` kind (validate against the venue list, as `isSavable` does for sailings).
  - Plan toggle extended to accept any `VenueEvent.id` with its day.
- Live changes: the existing `IProgramChanges` mid-day change feed applies to all `VenueEvent`s, not just programme events.
- Capacity and availability are simulated deterministically (the same hash approach as `slotsFor` and `takenByOthers`) behind an interface.
- Secrets stay in user-secrets or environment variables.

### 3.3 Front end

- New shared kit in `src/ui/explorer/`: `ExplorerPage` (skeleton from 2.1), `ShipClockCard`, `DatePickerDialog` (+ `PickDateButton`), `ReservationList`, `ReservationEditor`, `VenueCard`, `PinButton`, `VenueDetailPage`, `EventRow` (with `PlanToggle`), `MenuPanel`, `HoursBadge`, `FilterChips`.
- State: `useExplorerDay()` holds the chosen day, kept in the URL (`?day=N`, so back and forward and shared links work) and remembered for the session so the date carries between Explorers; it falls back to the ship's current day. `useVenuePins()` wraps favourites.
- Data hooks use `useSavedCopy` keyed by `ship:kind:day` for offline copies.
- Routes: keep the six existing top-bar paths and add `/:venueId` children; register in `routes/routes.ts`, `routes/screens.ts` (new X-ids), `stageNav` and the i18n `en.ts` only (English only for now).
- Delete the old per-page implementations and the `ItemList`/`MyPicks` use on these pages once each Explorer is migrated. Anything the backend can serve is removed from the front end (no mock path).

### 3.4 Accessibility and mobile-first (every phase)

- Dialogs trap focus and close on Escape; focus returns to the trigger.
- Date list is a proper radio group or listbox with day, date and port in the accessible name.
- Pins and plan toggles are `aria-pressed` buttons with the venue or event name in the label; changes are announced in a polite live region.
- Status never colour-only (badge text plus icon); contrast checked via `design/contrast.ts`; targets at least 44 px; `prefers-reduced-motion` honoured.
- Layout: single column on phones; at 1024 px and wider, list and detail sit side by side (master/detail) but remain separate routes.
- New copy must pass the existing wording, dark-pattern and promise tests (`wordingGuards`, `darkPatterns`, `h5–h8Promises`).

---

## 4. Beyond the brief (ways to push the envelope)

Ranked by value; the first four are in scope of the phases below, the rest are stretch.

1. **Happening Now strip:** one swipeable row at the top of every Explorer: what is on right now across *that* Explorer, with time left.
2. **Clash and walking-time awareness:** when adding to the plan, warn if it overlaps, and show "about N min walk from your previous item" using the existing deck graph (`deckGraph`) and a "leave by" time.
3. **Diet-aware menus:** show only dishes that suit the profile's dietary needs first, with an "All dishes" toggle.
4. **Live disruption handling:** moved or cancelled events and closed venues flow into cards, detail pages, Today's Plan and reminders with the ship's reason.
5. **Bundles:** "Plan my evening" (dinner at a specialty venue, then the show that fits, with timing buffers); "Port-day return" bundle (back aboard, then sail-away).
6. **Add to calendar (.ics) and share to chat** for any event or reservation (`calendar.ts`, `SendToChat` exist).
7. **Dinner waitlist from a full slot** (reuse `Waits`).
8. **Stanley suggestions** as a quiet "For you" chip ordering within unpinned venues (never above pins).
9. **Sea vs port day awareness:** venue chips for "Closed in port" and a "Back aboard by" marker on port days; ship-day mode (embark, scenic, formal night) shown in the clock card.

---

## 5. Phased delivery

Each phase ends with: tests, lint, `tsc -b`, build green; commit; **stop for `/clear`**. I will not start the next phase until asked. (Work is committed only when you ask.)

### Phase 0: Spec lock and pure foundations
- Resolve the open questions in section 6.
- Write `src/domain/explorer/` pure modules with full unit tests: `upcoming.ts`, `venueOrder.ts`, `hours.ts`, `dayMapping.ts`, `explorerDay.ts`, types.
- Day-mapping: document how each "Day n" in the 7-day doc schedules maps to day kinds and how a 5-, 10- or 14-day sailing reuses them.
- Exit: tests cover the 15-minute boundary, pin ordering stability, relative hours (sailaway + 45 min), day mapping for several sailing lengths.

### Phase 1: Backend contract and content pipeline
- Define C# contracts and `ship-explorer.json` schema; generator script; embed per ship (Sun, Sky, Sapphire); seed SQL in `db/seed`.
- Endpoints `explorer/{kind}` and `explorer/{kind}/{venueId}`; `venue` favourites; plan toggle accepting any event id; spa reservations CRUD (service, rules, SQL schema in `db/01-schema.sql`).
- Front end: `src/api` types, guards, `httpApi` client functions, contract tests (`httpApi.test`, guard tests, `check-api-coverage`).
- Verification caveat: with no `dotnet test` allowed, server logic is verified by TypeScript-side contract and fixture tests only; I will keep server rules small, mirror them in tested TS where possible, and list every server file changed so you can run the server yourself.

### Phase 2: Shared UI kit and Dining Explorer (the pilot)
- Build the kit (2.1, 2.2, 3.3) and migrate **Dining** first because it has the most surface: reservations for the day, venue list with next events (service periods, themed nights, tastings, winemaker dinners), pins, venue detail with the 7-day menu, hours, dress, cover charges, diet filter, reservation CRUD wired to the existing dining APIs.
- Content for Dining (from `princess-restuarants.md`, `princess-bars.md`, `princess-special-events.md`) for all three ships.
- Exit: Dining meets every point in section 2; the kit contains no dining-specific code.

### Phase 3: Spa Explorer
- Venues: Lotus Spa and salon, Enclave thermal suite, barber / medi-spa (as in `princess-spa-casino.md`); treatments become bookable slots and spa events (seminars, port-day specials, tours).
- Spa reservations CRUD (create, move, edit notes, cancel with policy), clash checks against dining and tours, price and folio display.

### Phase 4: Entertainment Explorer
- Venues: Arena / Theater, Dome, Piazza, Princess Live!, Crooners, lounges, casino (closed-in-port rules), movies under the stars; events from the three 7-day schedules with authored times, show capacities and "filling up".
- Keep what works today (kinds filter, mid-day changes) inside the new skeleton; the old `EntertainmentScreen` is removed.

### Phase 5: Exercise Explorer
- Venues: fitness centre (24 h, staffed hours), studios, courts, pools, running track; classes from `princess-exercise.md` by day status; free vs paid, capacity, minimum age.

### Phase 6: Shopping Explorer
- Venues: shops by ship, photo and art galleries, pop-ups; retail-hours rules (closed in port); events (auctions, jewellery events, sales, tastings). Keep order-for-pickup items as venue detail content.

### Phase 7: Activities Explorer
- Venues/hubs: Piazza, Princess Live!, library and card room, sports court, Camp Discovery / teen areas, faith and community meetings; ~38 activities from the sea-vs-port catalogue in eight time bands, authored times, sea vs port variants.

### Phase 8: Today's Plan integration and cross-Explorer polish
- Today's Plan timeline merges everything, with the ship clock and Pick a Date; clash detection, walking-time hints, reminders, moved/cancelled banners.
- Happening Now strip, share to chat, add to calendar, offline caches checked, empty and error states, Stanley and search hooks pointing at the new routes.

### Phase 9: Hardening
- Accessibility audit (keyboard paths, focus order, dialog behaviour, contrast, reduced motion), performance (list virtualisation if needed, bundle check `check-bundle`), desktop master/detail layout, remove dead code and old strings, update `README`/`docs/runbook.md`, final full run of the four npm checks.

---

## 6. Decisions (confirmed)

1. **Pins are stored on the server everywhere pins are shown.** This covers venue pins in all six Explorers *and* the existing screen pins (`settings.pins`, `ScreenList`, `EditFavourites`, the Home shortcut bar), which move off the device. Added to Phase 1: a server-side pins store (venue and screen kinds), a one-time migration that uploads any existing local `settings.pins` on first sign-in then clears the local copy, and the `MAX_PINS` limit enforced by the server. Cross-tab sync stays on the existing `channel`.
2. **"Expired" is measured from the event's end** (15-minute grace after the end).
3. **The chosen date is shared across all Explorers** (and Today's Plan) for the session; the `?day=N` URL param wins when present.
4. **All three ships (Sun, Sky, Sapphire) in every phase.**
5. **Backend testing is done by you.** I will not run `dotnet test`; each phase that touches `server/` ends with a list of the server files changed and what to try, and TypeScript-side contract tests cover the shapes.

Still defaulting as recommended unless you say otherwise: bars live in Dining and their live music is also shown in Entertainment; casino in Entertainment and tech desks in Activities; spa booking shows price and charges the onboard account behind a mock payment interface; Today's Plan gets the same date picker; I author the start times that the docs omit and you review them in the data-file diffs.
