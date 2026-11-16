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

### Phase 1: Backend contract and content pipeline (done)
- Content: `scripts/ship-explorer-data.ts` + `npm run shipexplorer:gen` write `server/Princess.Api/Content/ship-explorer.json` (embedded), with venues, hours rules, events and menus per ship (Sun, Sky, Sapphire). Phase 1 carries the dining rooms of all three ships; the other Explorers, events and menus arrive in their own phases. A test fails when the file is stale or breaks a rule. The content is served from the embedded file; it is not seeded into `ref.*` tables.
- Endpoints: `GET /bookings/{number}/onboard/explorer/{kind}?day=` and `.../{kind}/{venueId}?day=` (venues with resolved hours, events with mid-day changes applied, menus on the venue page, the guest's planned events). `PUT /onboard/plan/{eventId}` accepts Explorer event ids as well as programme ids.
- Pins on the server, everywhere: screen pins (`screen:<id>`, max 5, oldest makes room) and venue pins (`venue:<ship>.<venue>`, max 10 per Explorer, validated against the catalogue, `pinsFull` when full) ride on the existing favourites, plus `PUT /me/favourites/order`. `usePins` is one shared store behind `ScreenList`, `EditFavourites` and `ShortcutBar`; pins saved on a device are uploaded once and the device setting is emptied.
- Front end: `api/explorerTypes.ts`, guards, `onboard.explorerDay/explorerVenue/togglePlanOn`, `discover.reorderFavourites`, contract tests.
- **Moved to Phase 3:** the spa reservation service (tables, store, rules, CRUD endpoints). It has no screen to use it until the Spa Explorer, and building it with that screen keeps the server and client shapes honest.
- Server files changed are listed in the Phase 1 commit message; you test the backend.

### Phase 2: Shared UI kit and Dining Explorer (the pilot) (done)
- Build the kit (2.1, 2.2, 3.3) and migrate **Dining** first because it has the most surface: reservations for the day, venue list with next events (service periods, themed nights, tastings, winemaker dinners), pins, venue detail with the 7-day menu, hours, dress, cover charges, diet filter, reservation CRUD wired to the existing dining APIs.
- Content for Dining (from `princess-restuarants.md`, `princess-bars.md`, `princess-special-events.md`) for all three ships.
- Exit: Dining meets every point in section 2; the kit contains no dining-specific code.
- Built: `src/ui/explorer/` (kit: `ExplorerPage`, `VenueDetailPage`, `ShipClockCard`, `DateControls`, `Pins`, `Parts`) and `src/ui/explorer/dining/` (the only dining code: reservations list wiring and the reserve / move editor). Hooks `useExplorer` and `useVenuePins`; pure rules in `src/domain/explorer/presentation.ts`. Route `/dining-today/:venueId` (screen X21). Dining content (bars, events, menus for all three ships) in `scripts/ship-explorer-dining.ts`, written to `ship-explorer.json`.
- Left for later phases: the date list has no "you have plans" dot, venue pages have no share-to-chat (the server builds share text only for tours and reservations), the deck-plan link opens the plan without placing a pin, and the desktop master/detail layout is Phase 9.

### Phase 3: Spa Explorer (done)
- Spa reservations backend (moved from Phase 1): `dbo.SpaAppointments` (+ guests) in `db/01-schema.sql`, store, rules and service mirroring dining, endpoints under `/plan/spa`, and the client `plan.spa` group.
- Venues: Lotus Spa and salon, Enclave thermal suite, barber / medi-spa (as in `princess-spa-casino.md`); treatments become bookable slots and spa events (seminars, port-day specials, tours).
- Spa reservations CRUD (create, move, edit notes, cancel with policy), clash checks against dining and tours, price and folio display.
- Built: `dbo.SpaAppointments` and `dbo.SpaAppointmentGuests` (`db/01-schema.sql`, `00-drop-all.sql`); `ISpaStore` + `DapperSpaStore`, `SpaRules` (half-hour grid inside the venue hours, rooms left simulated from a hash plus real bookings, 24-hour free cancellation then 50% kept), `SpaService` and `SpaEndpoints` under `/bookings/{number}/plan/spa` (view, slots, book, move, update guests/note, cancel). A booking clashes with the guest's other treatments, a dinner reservation (90 minutes) and a booked shore excursion that day. Client: `api.plan.spa`, `src/api/spaTypes.ts`, `asSpaView`, and `src/ui/explorer/spa/` (the only spa code in the UI: editor, appointments list with treatments, screens). Route `/spa-explorer/:venueId` (screen X22). The old `SpaExplorerScreen` is removed.
- Content: `scripts/ship-explorer-spa.ts` adds four spa venues per ship (Lotus Spa, Salon and Barber, the Enclave or Sapphire's Thermal Suite, the Sanctuary), 12 treatments and 15 events, and `treatments` in `ship-explorer.json`.
- Left for later: the price is shown and kept on the appointment but is not posted to the folio (the ship collects it on board, as dining cover charges are); the Casino and the tech desks from `princess-spa-casino.md` belong to Entertainment (Phase 4); therapist preference is not modelled.

### Phase 4: Entertainment Explorer (done)
- Venues: Arena / Theater, Dome, Piazza, Princess Live!, Crooners, lounges, casino (closed-in-port rules), movies under the stars; events from the three 7-day schedules with authored times, show capacities and "filling up".
- Keep what works today (kinds filter, mid-day changes) inside the new skeleton; the old `EntertainmentScreen` is removed.
- Built: no new backend (nothing here is booked; plan toggles and places left already come from Phase 1). `scripts/ship-explorer-entertainment.ts` adds 8 to 9 venues per ship (show rooms, music lounges, pool decks, Princess Live!, Spellbound on Sun, the casino) and about 70 events each from the three 7-day schedules plus the casino week in `princess-spa-casino.md`, with authored start times, lengths, extra costs and capacities; the casino opens 45 minutes after sailaway, is closed in port, and opens at 5:30 pm on embarkation day. Wheelhouse and O'Malley's live music are their own "live music" venues here, so the bars and their drinks stay in Dining. Client: `src/ui/explorer/entertainment/EntertainmentScreens.tsx` (the only entertainment code; no `above` list, so no reservations card), route `/entertainment/:venueId` (screen X23). Removed: `EntertainmentScreen`, `domain/entertainment.ts` and its test, the old `ent.*` strings.
- New day kind `laterSea` (every sea day after the first, except the last night) in `dayKinds.ts` and `DayKinds.cs`, so the doc's Day 5 differs from Day 2 on a sailing of any length. The doc's Days 3 and 6 both use `portOdd`, so Day 6's own items (a second gala) are not authored separately.
- Server files changed: `server/Princess.Api/Domain/DayKinds.cs`, `server/Princess.Api.Tests/OnboardRulesTests.cs` (one `laterSea` assertion) and the regenerated `Content/ship-explorer.json`. Things to try: open an Entertainment page for each ship on days 1 to 7 and in a port (casino shows closed), toggle a show into the plan, check "Filling up" on Spellbound and the poker tournament.
- Left for later: tech desks (Activities, Phase 7); a filter by event interest (shows, music, games...) inside a venue page.

### Phase 5: Exercise Explorer (done)
- Venues: fitness centre (24 h, staffed hours), studios, courts, pools, running track; classes from `princess-exercise.md` by day status; free vs paid, capacity, minimum age.
- Built: no new backend (classes are signed up for at the fitness desk, so nothing is booked in the app; plan toggles come from Phase 1). `scripts/ship-explorer-exercise.ts` adds 4 to 5 venues per ship (gym open 24 hours with staffed hours, studios, courts and tracks, pools, The Greens on Sky, the adults-only lap pool on Sapphire) and about 30 events each from the doc's 7-day calendar, with authored lengths, $30 boutique classes with 24 places and free stretches, walks, seminars and court games. Ship differences follow the doc (Dome yoga on Sun, lap swimming on Sun and Sapphire, putting at The Greens or the Lawn Court). Client: `src/ui/explorer/exercise/ExerciseScreens.tsx` (the only exercise code; no reservations card), route `/exercise-explorer/:venueId` (screen X24). Removed: the old `ExerciseExplorerScreen` and its `exex.*` strings.
- Server files changed: only the regenerated `server/Princess.Api/Content/ship-explorer.json`. Things to try: open the Exercise Explorer for each ship on days 1 to 7, check the gym shows as open round the clock, and add a CycleBar class to the plan.
- Left for later: Sky has no pool venue in the doc, so it has no lap swimming or poolside Zumba; personal training and the thermal pass are not modelled; the staffed hours are in the content but not yet shown on the venue card.

### Phase 6: Shopping Explorer (done)
- Venues: shops by ship, photo and art galleries, pop-ups; retail-hours rules (closed in port); events (auctions, jewellery events, sales, tastings).
- Built: no new backend (nothing is booked; plan toggles come from Phase 1). `scripts/ship-explorer-shopping.ts` adds 8 to 9 venues per ship (boutiques, the fine arts and photo gallery, the Piazza pop-up tables, the poolside market) and about 30 events each from the three 7-day schedules in `princess-shopping.md`. Hours follow the retail rules: closed alongside, open 45 minutes after sailaway until 10 pm (`sailaway` rule), 5:30 pm on embarkation day, 9:30 am to 10 pm at sea; gallery displays open round the clock with staffed hours. Champagne art auctions are listed under the gallery with the lounge in the detail. Client: `src/ui/explorer/shopping/ShoppingScreens.tsx` (the only shopping code; no reservations card), route `/shopping-today/:venueId` (screen X25). Removed: the old `ShoppingTodayScreen` and its `stoday.*` strings.
- Left for later: order-for-pickup and gift cards stay on `/ship/shops` and are not linked from the Explorer; Days 3 and 6 share the `portOdd` kind, so both days' events appear on each such day; a "VIP" or deck-sale filter by interest.

### Phase 7: Activities Explorer (done)
- Venues/hubs: Piazza, Princess Live!, library and card room, sports court, Camp Discovery / teen areas, faith and community meetings; ~38 activities from the sea-vs-port catalogue in eight time bands, authored times, sea vs port variants.
- Built: no new backend (nothing is booked; plan toggles come from Phase 1). `scripts/ship-explorer-activities.ts` adds 7 hubs per ship (card tables or library, daytime talks in the Arena or Theater, a workshop corner, the chapel and meeting rooms, Camp Discovery, the Beach House teen centre, the open decks) and 38 events each: harbor arrival, scenic cruising and stargazing, Discovery at SEA talks, the captain's panel, crafts, ukulele and choir, bridge and board games, faith services and affinity meet-ups, and the youth and teen programme, with port-day variants (supervised play, gangway viewing). Trivia, bingo, parties, music, tastings, auctions, classes and spa seminars from the catalogue stay in their own Explorers, so they are not repeated. The late-night youth sitting is the only priced event (about $5 an hour, paid on board). Client: `src/ui/explorer/activities/ActivitiesScreens.tsx` (the only activities code; no reservations card), route `/activities-explorer/:venueId` (screen X26). Removed: the old `ActivitiesExplorerScreen` and its `actex.*` strings.
- Left for later: the old catalogue `faith` items and `/ship/games` / `/ship/community` pages are no longer linked from the Explorer; scenic cruising has no day kind of its own, so it runs on every later sea day and says so in its detail; Camp Discovery registration is not modelled.

### Phase 8: Today's Plan integration and cross-Explorer polish (done)
- Today's Plan timeline merges everything, with the ship clock and Pick a Date; clash detection, walking-time hints, reminders, moved/cancelled banners.
- Happening Now strip, share to chat, add to calendar, offline caches checked, empty and error states, Stanley and search hooks pointing at the new routes.
- Built: no new backend. `domain/explorer/planItems.ts` merges the planned events of all six Explorers, dinner reservations and spa appointments into one list for any cruise day, and writes the day as a calendar file; `planTimeline.ts` groups by Morning / Afternoon / Evening, flags overlaps, lists moved and cancelled items for a banner, estimates the walk between consecutive items from the deck plan (with a "leave by" time) and finds what is on now. `TodayPlanScreen` (route `/today`) now has the ship clock, Pick a Date, a ship-changed banner, the timeline with clash and walking notes, "Add this day to my calendar" and links into each Explorer for the same day. Every Explorer list page gets a Happening Now strip on the ship's own day. Offline: the six Explorer days, dining and spa views use the existing saved copies; a partial failure shows a retry banner. Removed: the old plan screen and its `plan.today.*` strings.
- Left for later: tours (the server serves only today's port day, so they are not on the timeline); share-to-chat for events (the server builds share text only for tours and reservations); reminders for planned events still use the existing pipeline unchanged; Stanley and search already point at the Explorer routes, which did not change.

### Phase 9: Hardening (desktop layout done; audit items open)
- Accessibility audit (keyboard paths, focus order, dialog behaviour, contrast, reduced motion), performance (list virtualisation if needed, bundle check `check-bundle`), desktop master/detail layout, remove dead code and old strings, update `README`/`docs/runbook.md`, final full run of the four npm checks.
- Built so far: desktop master/detail. At 1024 px and wider a venue page shows the list of places beside it (a `nav` of links with `aria-current`, sticky, 44 px targets); each venue is still its own route. Test, lint, `tsc -b` and build pass.
- Bundle: the flag pictures were being inlined as base64 into one 53 kB script chunk; `vite.config.ts` now keeps them as files. `check-bundle.mjs` is re-baselined (first load 770 kB, screen 40 kB, assets 4700 kB; language packs are not screens) and `npm run bundle:check` passes. The cause of the growth is shared, not Explorer code: the English table `en.ts` is about 340 kB gzip, of which the `stanley.*` and `tip.*` strings are 40%.
- Also done in Phase 9: accessibility pass (the plan button no longer pairs `aria-pressed` with a changing label; event times carry `dateTime`; contrast report all ok; dialog focus return and reduced motion already in place); dead code (`hoursStatus` and `isAllDay` removed; no unused old Explorer strings remain); README and runbook sections on the Explorers; staffed hours on venue pages; an event-interest filter inside a venue.
- Item 2 done: `en.ts` is split into `enCore.ts` and `enLate.ts` (`stanley.*`, `tip.*`). `main.tsx` waits for `loadEnglishLate()` in parallel with the runtime and fonts, so no screen draws without its text; tests register it in `src/testing/setup.ts`; `PAGE_QA` became `pageQaEntries()`, built on first use. First load fell from 747 kB to 613 kB gzip (budget now 630 kB); the late chunk is precached for offline use.
- Pass 3 (data and small gaps): two new day kinds, `earlyPortOdd` (first, third... port except the last) and `lastPort`, in `dayKinds.ts` and `DayKinds.cs`, so Day 3 and Day 6 no longer share events. Day 3 content is tagged `earlyPortOdd`; Day 6 content is new for Entertainment (about 10 events per ship, plus two casino events), Exercise (5), Spa (2) and Shopping (the artisan, formal-night VIP and portrait events moved to `lastPort`). Sky gains a pool venue (`Sky Pool and Fountain Pool`) with lap swimming and poolside Zumba. Activities gains an OceanFront Tech Desk venue per ship with six events from `princess-spa-casino.md`. The Shopping Explorer links to order-for-pickup and gift cards and the Activities Explorer to Games and Services and meet-ups. The offline note that said "Without a signal you see the copy saved on this phone" no longer shows (the saved copy shows its own age). The in-memory test double `InMemoryJourney` now implements `ReorderFavouritesAsync`. Authored times for the new events are mine and need your review in the `scripts/ship-explorer-*.ts` diff.
- Still open: share to chat for events and venues, tours on the timeline, the "you have plans" dot and posting spa prices to the folio (all need server work you test); the deck-plan pin (venues have no coordinates on the plan pictures); a VIP or deck-sale filter in Shopping (the interest filter exists, no VIP interest is authored); scenic cruising (needs a per-itinerary scenic flag, so it stays on later sea days); therapist preference, personal training, thermal pass purchase and Camp Discovery registration (features, not data); reminders: planned Explorer events have no reminder yet (reminders cover the trip, custom reminders and confirmed Stanley actions); the stretch ideas.
- Test-only modules with no caller in the app, left alone because they are not Explorer code: `src/ai/stanleyFeedback.ts`, `src/auth/demoAccounts.ts`, `src/domain/artIds.ts`.

### Outstanding issues, ranked for what to do next
1. **Accessibility audit** (Phase 9): keyboard paths, focus order and return, dialogs (Pick a Date), contrast through `contrast`, reduced motion, live-region announcements for pins and plan toggles, 44 px targets on the new master/detail list.
2. **(Done) Lazy-load the Stanley and tip strings** (about 140 kB gzip off first load; first load is still 747 kB against the original 350 kB aim). `t()` is synchronous, so this needs a load-before-render step.
3. **Dead code and old strings sweep**: unused `ent.*`, `exex.*`, `stoday.*`, `actex.*`, `plan.today.*` leftovers, the old `ItemList`/`MyPicks` uses, and the unlinked `/ship/games`, `/ship/community`, catalogue `faith` pages.
4. **README and `docs/runbook.md`** for the Explorers, pins and the shared date.
5. **Share to chat for events and venues** (server builds share text only for tours and reservations; needs a server change you test).
6. **Tours on the Today's Plan timeline** (the server serves only today's port day).
7. **Data gaps**: Days 3 and 6 share the `portOdd` kind so both days' events show on each; scenic cruising has no day kind of its own; Sky has no pool venue (no lap swimming or poolside Zumba); staffed hours not shown on venue cards; tech desks not placed in Activities.
8. **Small UI gaps**: a "you have plans" dot on the date list; the deck-plan link does not place a pin; filter by event interest inside a venue; VIP or deck-sale filter in Shopping; links from the Explorer to order-for-pickup and gift cards.
9. **Not modelled**: therapist preference, personal training and thermal pass, Camp Discovery registration, spa price posting to the folio.
10. **Stretch ideas from section 4 not confirmed built**: diet-aware menus first, "Plan my evening" and port-day return bundles, dinner waitlist from a full slot, Stanley "For you" chip. Check each against the code before scheduling.
11. **Reminders** for planned events still use the old pipeline unchanged; confirm they cover Explorer events.

---

## 6. Decisions (confirmed)

1. **Pins are stored on the server everywhere pins are shown.** This covers venue pins in all six Explorers *and* the existing screen pins (`settings.pins`, `ScreenList`, `EditFavourites`, the Home shortcut bar), which move off the device. Added to Phase 1: a server-side pins store (venue and screen kinds), a one-time migration that uploads any existing local `settings.pins` on first sign-in then clears the local copy, and the `MAX_PINS` limit enforced by the server. Cross-tab sync stays on the existing `channel`.
2. **"Expired" is measured from the event's end** (15-minute grace after the end).
3. **The chosen date is shared across all Explorers** (and Today's Plan) for the session; the `?day=N` URL param wins when present.
4. **All three ships (Sun, Sky, Sapphire) in every phase.**
5. **Backend testing is done by you.** I will not run `dotnet test`; each phase that touches `server/` ends with a list of the server files changed and what to try, and TypeScript-side contract tests cover the shapes.

Still defaulting as recommended unless you say otherwise: bars live in Dining and their live music is also shown in Entertainment; casino in Entertainment and tech desks in Activities; spa booking shows price and charges the onboard account behind a mock payment interface; Today's Plan gets the same date picker; I author the start times that the docs omit and you review them in the data-file diffs.
