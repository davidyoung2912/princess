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

### Phase 10: Event reminders and change alerts
- Scope (ENT-084..092, DIN-245..253): a planned Explorer event gets a reminder (lead time the guest can choose), and a planned event or reservation that is moved, cancelled or sold out raises an alert. Covers the open "reminders for planned events" item from Phase 9.
- Needs server work you test (reminder pipeline). Check first what the existing reminder pipeline covers, then extend it rather than add a second one.
- Built: no new store and no second pipeline; the existing push check (`PushService.RunAsync`) now also looks at the Explorer events the guest planned for today and tomorrow. `PushRules.AddExplorerNotices` builds (a) a reminder, kind `reminder`, category `checkin`, once per event and start time, inside the lead time the guest chose, only while the event still runs, linking to the venue page (`ExplorerCatalogue.PathOf`); a moved event has a new start so it reminds again at its new time; a cancelled event never reminds; a removed event is no longer in the plan; and (b) a change alert, kind `scheduleChange`, category `critical`, for a planned event that moved or was cancelled, skipped when the programme watch already covers the same event id. Reminders keep to calm mode, quiet hours, do-not-disturb and the daily budget like other check-in notices. The lead time is a new notification preference `explorerLead` (0 off, 10, 15, 30 or 60 minutes; default 15), normalised on both sides (`NotificationRules.cs`, `src/domain/notifications.ts`) and set from a new "Planned events" group on the Notifications screen. Dedup comes from the stable notice key plus the delivery log. Tests: `src/domain/notifications.test.ts` and new cases in `PushRulesTests.cs`.
- Not verified: the C# changes (`PushRules.cs`, `NotificationRules.cs`, `PushService.cs`, `ExplorerCatalogue.cs`) and the new `PushRulesTests` cases were not compiled or run here (the project rule is npm checks only), so please build and run them. The npm checks (test, lint, `tsc -b`, build) pass.
- Left for later: dining reservations and spa appointments are not yet reminded by this route (they have their own stores; DIN-245..248 reservation timing stays at the existing fixed lead); per-event reminder choices (ENT-089); action buttons on the notification (ENT-091); the waitlist-ready and order-status pushes (DIN-250, 251); reminders for events more than a day ahead (the check covers today and tomorrow); a reminder keeps to the guest's limits, so one held by quiet hours or the budget is tried again at the next check and is dropped once the event has started.

### Phase 11: Share, Navigate and the deck-plan pin
- Scope (ENT-098, ENT-106, DIN-143): share to chat for events, venues and menus; a Navigate action that opens the venue on the deck plan with a pin; tours on the Today's Plan timeline if the server can serve more than today's port day.
- Needs server work you test (share text for events and venues) and venue coordinates on the plan pictures.
- Built: Share to chat. `ChatShareService` now accepts Explorer events as plan cards (`eventId:day`, same ref as programme events, so "Going" adds the event to the plan; the card opens the venue page) and a new `venue:<id>` card type (`ChatCardRules.Venue`, `VenueRef`, `ExplorerCatalogue.VenuePath`). The venue page has a Send to chat control for the venue and one on each non-cancelled event (`SendToChat` takes `kind`). Client: `venue` card type, label and card link paths for the six Explorer routes. Navigate: `src/domain/explorer/navigate.ts` reads the deck and section from the venue's place or deck label; the venue page has a "Navigate" button. On decks the schematic map lists (4, 6 to 9, 17, 18) it opens `/ship/map` with a labelled diamond (`DeckPlan` `target`); on other decks it opens that ship's deck-plan picture at the deck with a text note and no mark. Venues with no deck in their label get no button. Tests: `navigate.test.ts`, two cases in `ChatCardRulesTests.cs`. npm test, lint, `tsc -b` and build pass.
- Not verified: the C# changes (`ChatShareService.cs`, `ChatCardRules.cs`, `ExplorerCatalogue.cs`, the new tests) were not compiled or run (project rule); please build and run them.
- Left for later: tours on the timeline (the server serves only today's port day); true pin coordinates on the deck-plan pictures; the plan composer's event picker still lists only programme events; share-to-chat for menus (DIN-143).

### Phase 11b: Open items from Phases 10 and 11 (done)
- Scope: everything left open by Phases 10 and 11, in one phase, built in this order. Commit once at the end; the C# changes are for you to build and test (npm checks only here).
  1. Front end and light server work: the chat plan composer's event picker lists Explorer events as well as programme events; menu sharing (a `menu:<venueId>:<meal>` card opening the venue page); per-event reminder choices (ENT-089), stored with the plan item and overriding the `explorerLead` preference; the reminder check looks more than a day ahead.
  2. Reminder pipeline: extend `PushRules` and `PushService` to dining reservations and spa appointments (DIN-245..248), then the waitlist-ready and order-status pushes (DIN-250, 251, with the galley and waitlist side mocked behind an interface), then notification action buttons (ENT-091, needs the service worker).
  3. Tours on the Today's Plan timeline: a server endpoint that returns booked tours for any cruise day (today it serves only today's port day), merged in `planItems.ts`.
  4. Deck-plan pin: venue coordinates on the deck-plan pictures. Open question for the user: place them by eye from the pictures for review, or keep the text note only.
- Built:
  1. The chat plan composer lists Explorer events as well as programme events (`ChatShareService.EventsAsync`). Menu sharing: a `menu:<venueId>:<meal>` card (`ChatCardRules.MenuRef`, `ChatShareService.MenuCardAsync`, checked against the ship's menus) opening the venue page, with a Send to chat control on each menu. Per-event reminders (ENT-089): `dbo.PlanEvents.ReminderLead` (new column in `db/01-schema.sql`, NULL follows the preference), set with `PUT /onboard/plan/{eventId}` and `lead` (0 off, 10, 15, 30, 60, or -1 for the preference); the Explorer day returns `reminders`; each planned event on the venue page has a Reminder select. `PushRules` uses the event's own lead before `explorerLead`. The push check now reads planned events from today to the end of the cruise, so change alerts cover events more than a day ahead.
  2. `PushRules.AddDiningNotices` and the new `IDiningFeed` (`DiningFeed`, simulated from the guest's own tables, spa appointments, waitlist and orders using `WaitRules` and `OrderRules`, so a real galley or waitlist system replaces it by registration): a reminder before a dinner table or spa appointment (same lead as events, once per booking and start time; the preference label now says so), a push when a waitlisted table is offered (DIN-250) and when the guest's own order is on its way or delivered (DIN-251). Action buttons (ENT-091): `PushRules.ActionsFor` and `actions` in the push payload; `public/push-sw.js` shows up to two and opens the one pressed. Buttons are links: "View new time" and "See alternatives" for a moved or cancelled event, "Take the table", "Track order", "View details". Nothing changes state from the notification itself.
  3. Tours on the timeline: `GET /bookings/{number}/onboard/tours?day=N` (`ExplorerService.ToursAsync`, the caller's booked tours for any cruise day), `api.onboard.dayTours`, `useDayTours` (with an offline copy), `buildPlanItems` merges them as `tour` lines linking to `/plan/excursions`.
  4. Deck-plan pin: decided with you to keep the text note only, so there are no coordinates.
  Tests: `planItems.test.ts`, `explorerApi.test.ts`, `serviceWorker.test.ts`; C# cases in `PushRulesTests.cs` and `ChatCardRulesTests.cs`. npm test, lint, `tsc -b`, build and `bundle:check` pass.
- Not verified: the C# changes (`ChatShareService.cs`, `ChatCardRules.cs`, `PushRules.cs`, `PushService.cs`, `DiningFeed.cs`, `ExplorerService.cs`, `ExplorerEndpoints.cs`, `OnboardStores.cs`, `DapperOnboardStore.cs`, `InMemoryOnboard.cs`, `PushProviders.cs`, `Program.cs`) and the new tests were not compiled or run (project rule); please build and run them, and apply the new `ReminderLead` column (`db/01-schema.sql` adds it if missing).
- Left for later: a tour's walking hint (it has no deck-plan place); tour changes (a cancelled tour drops off the list rather than raising an alert); a separate reminder lead for dinners and spa (they share the event lead); the pins on the deck-plan pictures (kept as a text note by choice).

### Phase 12: Event and venue detail fields
- Scope: event performer, series, accessibility attributes, dress and arrival notes (ENT-013, 017, 019, 023, 129..130); Dining venue accessibility, children's menu and family facilities (DIN-047, 210, 214, 224). Small items that touch the same screens fit here: the "you have plans" dot on the date list.
- Mostly content and schema; the content scripts under `scripts/ship-explorer-*.ts` carry the authored values for your review.
- Built: `scripts/ship-explorer-details.ts` works out the new fields from what each row already says, so one rule covers all three ships and nothing names a person. Events gain optional `performer` (only where the title says who), `series` (showings or rounds that belong together), `access` (the six codes of `src/domain/eventAccess.ts`, by venue kind), `dress` and `arrive`. Venues gain `accessibility` notes for every venue, and restaurants (not bars) gain `family` (children's menu, high chairs and boosters, baby policy) and `kidsMenu` (a short dish list). Server: optional trailing fields on `ExplorerEventDef`, `ExplorerEventDto`, `ExplorerVenue` and `ExplorerVenueDto` (old data still loads). Client: the event row shows performer, series, dress, arrival and access; the venue page has an "Access" chip filter over its events and a "For families" section with the children's menu. Test: new case in `shipExplorer.test.ts`. npm test, lint, `tsc -b`, build and `bundle:check` pass. All values are authored concept content for your review in the `ship-explorer.json` diff.
- Not verified: the C# record changes (`ExplorerCatalogue.cs`, `ExplorerRules.cs`) were not compiled or run (project rule); please build them.
- Left for later: the "you have plans" dot on the date list (needs a server list of the days that hold a plan); performer profiles with images and trailers (ENT-020); a real children's menu per restaurant instead of the shared short list; events are still rows, not pages of their own.

### Phase 13: Dietary request status
- Scope (DIN-110..112, 119..120): a dietary request attached to a reservation with received, under review and confirmed states, shown to the guest and updated by the server. The only safety-related gap in the review.
- Needs server work you test. The backend mocks the galley's side behind an interface.
- Built: A request is one per guest per reservation (`dbo.DiningDietaryRequests`, added to `db/01-schema.sql`; kind allergy, diet or other, a note up to 300 characters, when the guest acknowledged the allergy process, when it was sent). The status is not stored: `IDiningGalley` (simulated by `DiningGalley` through `DietaryRules.StatusAt`) answers from the request and the clock, so a real galley system replaces it by registration. Received for 2 minutes, under review until 10 minutes, then confirmed for a plain diet, "staff will speak with you" (contact) for an allergy or anything else, and "cannot be accommodated" (unable) for a kosher diet (no kosher kitchen aboard). An unreviewed request is never shown as approved. `PUT /bookings/{n}/dining/reservations/{id}/dietary` (guest, kind, note, acknowledged; 400 `dietary` unless kind, note and acknowledgement are good, 400 `guest` if the guest is not at the table, 409 `closed` once the dinner has passed; sending again restarts the review) and `DELETE .../dietary/{guest}`; every reservation in the dining view carries `requests`. Front end: `src/domain/dietaryRequest.ts` (states, badges, send check), `DietaryRequests` on the reservation page (who, kind, words, the acknowledgement checkbox, each request with a status badge, a plain sentence on what it means and a Withdraw button), `api.plan.dining.setDietary` and `withdrawDietary`. Tests: `dietaryRequest.test.ts`; C# `DietaryRulesTests.cs` and a case in `PlanApiTests.cs`. npm test, lint, `tsc -b`, build pass.
- Not verified: the C# changes (`DietaryRules.cs`, `DietaryStores.cs`, `DiningGalley.cs`, `PlanService.cs`, `PlanContracts.cs`, `PlanEndpoints.cs`, `Program.cs`, the in-memory store and tests) were not compiled or run (project rule, and no dotnet here); please build and run them, and apply the new table (`db/01-schema.sql` adds it if missing).
- Left for later: the status does not appear on the Explorer's reservation list or the venue page (only the reservation page); no push when the status changes; no way for a guest to mark that they have spoken with staff, so "contact" does not clear; the booking wizard's pre-sailing diet note is not turned into requests; the status is derived from the clock rather than stored, so a real galley's answer needs a store when one is wired in.

### Phase 14: Dining discovery
- Scope (DIN-004, 055..058, 212): meal-period quick filters, dish search, sort, and a family-friendly filter. Mostly front end over existing data. A VIP or deck-sale filter for Shopping can ride along if the interest is authored.
- Built: `src/domain/explorer/diningDiscovery.ts` (framework-free) and `ui/explorer/DiningDiscovery.tsx`, used by the Dining Explorer's list only. Meal chips Breakfast, Lunch, Dinner and Late night keep places whose hours that day overlap the period (06:00 to 10:30, 11:30 to 14:30, 17:00 to 22:00, 22:00 to midnight), plus a Room service link to the order screen. Idea chips: Quick meal (casual), Family-friendly (not a bar, no age limit, has family facilities or a children's menu), Special occasion (specialty), Included dining (no cover, not a bar), Open late. A Children's menu chip appears when any place has one. Kind chips stay. The search also matches dishes on the day's menus and the card says "On the menu: ..." with the matching dishes. Sort: Suggested (pins, then authored order), Open now first, Price lowest first. Clear filters button. Server: `ExplorerService.DayAsync` now returns menus for the Dining list (`withMenus: kind == "dining"`) so dishes can be searched; the wire shape is unchanged. Test: `diningDiscovery.test.ts`. npm test, lint, `tsc -b` and build pass.
- Not verified: the one-line C# change in `ExplorerService.cs` was not compiled or run (project rule).
- Left for later: sorts by soonest available table and by walking distance (no availability feed or reliable distances); the "Near my next activity" idea; cuisine, ambience and indoor/outdoor filters (not authored); a dietary-attribute filter on the list (it exists on a venue's own menu); Shopping's VIP and deck-sale filter.

### Phase 15: Alternatives and What changed
- Scope (ENT-047, 070, 078, DIN-030, 137, 238): suggest alternatives after a clash, a cancellation or a full slot (with a dinner waitlist if the server supports it); then the What changed summaries (ENT-080, DIN-011, 241).
- Built: `src/domain/explorer/alternatives.ts` (framework-free). A plan line that clashes with another, or that the ship moved or cancelled, gets up to three suggestions on Today's Plan. For an event: another showing of the same series or title first, then something of the same interest in the same Explorer; never one that is cancelled, full (`left` 0), already planned, already started or overlapping the rest of the plan. For a dinner reservation: other bookable restaurants open for the whole meal (no table availability is claimed, the line says to check). Spa and tours get none. Each suggestion links to its venue page for the day. `src/domain/explorer/whatChanged.ts` and `ui/explorer/WhatChanged.tsx`: a card at the top of every Explorer lists the day's moved and cancelled events with the ship's reason, linking to the venue, with an "On your plan" badge on the guest's own; titled "What changed today?" on Entertainment and "Dining updates" on Dining; hidden when nothing changed, dropped once over, empty on a past day. `useTodayPlan` now returns the `explorers` it loaded. Test: `alternatives.test.ts`. npm test, lint, `tsc -b` and build pass. No server change.
- Left for later: a one-tap "add to plan" on a suggestion (it links to the venue page); alternatives for a full dinner slot beyond the existing alternative slots, and a dinner waitlist from the suggestion (the waitlist exists in `Waits.tsx`); alternatives for spa and tours; a menu-item-unavailable or shortened-meal-period change (no such feed), so DIN-011 and DIN-241 cover moved and cancelled events only, not reservation updates or closures.

### Phase 16: Recommendations and interest profile
- Scope (ENT-007, 148..152, DIN-258..261): an interest profile and a "For you" ordering and chip, last because the documents rank it below trust and planning. Before scheduling, check each section 4 stretch idea against the code ("Plan my evening", port-day return bundles, diet-aware menus first, Stanley "For you" chip), since some may already exist.
- Built: (to fill in)
- Left for later: (to fill in)

### Backlog (not scheduled)
Features, not data: therapist preference, personal training, thermal pass purchase, Camp Discovery registration, posting spa prices to the folio, and a per-itinerary scenic flag for scenic cruising. The earlier ranked "Outstanding issues" list is replaced by Phases 10 to 16 and this backlog; the Phase 9 "Still open" line records what was open at that point.

---

## 6. Decisions (confirmed)

1. **Pins are stored on the server everywhere pins are shown.** This covers venue pins in all six Explorers *and* the existing screen pins (`settings.pins`, `ScreenList`, `EditFavourites`, the Home shortcut bar), which move off the device. Added to Phase 1: a server-side pins store (venue and screen kinds), a one-time migration that uploads any existing local `settings.pins` on first sign-in then clears the local copy, and the `MAX_PINS` limit enforced by the server. Cross-tab sync stays on the existing `channel`.
2. **"Expired" is measured from the event's end** (15-minute grace after the end).
3. **The chosen date is shared across all Explorers** (and Today's Plan) for the session; the `?day=N` URL param wins when present.
4. **All three ships (Sun, Sky, Sapphire) in every phase.**
5. **Backend testing is done by you.** I will not run `dotnet test`; each phase that touches `server/` ends with a list of the server files changed and what to try, and TypeScript-side contract tests cover the shapes.

Still defaulting as recommended unless you say otherwise: bars live in Dining and their live music is also shown in Entertainment; casino in Entertainment and tech desks in Activities; spa booking shows price and charges the onboard account behind a mock payment interface; Today's Plan gets the same date picker; I author the start times that the docs omit and you review them in the data-file diffs.

---

## 7. Requirements review: Entertainment and Dining documents

A line-by-line check of `docs/onboard-entertainment-management-requirements.md` (ENT, OPS, NFR) and `docs/onboard-dining-management-requirements.md` (DIN, OPS, NFR) against the code as it stands after Phase 9. OPS and NFR ids repeat across the two documents, so they are written `EOPS`/`ENFR` for Entertainment and `DOPS`/`DNFR` for Dining. A row may cover a range of ids that share one verdict. "Pri" is the priority the document gives (P0 essential to P3 future).

How the verdicts were reached: by reading the requirement against the routes, domain modules, server services and strings in this repository, not by running the app (CLAUDE.md rules out browser testing). A requirement is "done" only when its main behaviour is present; "partial" says what is missing.

**What counts as not applicable and ignored:**

- Crew and shipboard operations tooling (all `OPS` ids except where the content pipeline or server already does the job). This is a guest app; the ship's systems are mocked behind interfaces (CLAUDE.md).
- Anything that needs a live ship feed we do not have (point-of-sale, kitchen, scanners, indoor positioning, occupancy sensors).
- Non-English content (English only for now).
- P3 items, and P2 items that need data or operations we do not have. The documents themselves say P3 waits until the basics are excellent.

### 7.1 Summary

| Group | Not applicable | Done completely | Done partially | Not done but should be | Total |
|---|---:|---:|---:|---:|---:|
| Entertainment guest (ENT) | 41 | 41 | 56 | 28 | 166 |
| Entertainment operations (OPS) | 33 | 0 | 5 | 0 | 38 |
| Entertainment non-functional (NFR) | 1 | 16 | 8 | 0 | 25 |
| Dining guest (DIN) | 81 | 88 | 82 | 42 | 293 |
| Dining operations (OPS) | 54 | 3 | 7 | 0 | 64 |
| Dining non-functional (NFR) | 0 | 17 | 10 | 0 | 27 |
| **All** | **210** | **165** | **168** | **70** | **613** |

Of the not-done-but-should-be items, by document priority: P0 10, P1 56, P2 4, P3 0. Of the partial items: P0 73, P1 82, P2 13, P3 0.

### 7.2 Done completely

| Id | Pri | Requirement | Evidence |
|---|---|---|---|
| ENT-001 | P0 | Entertainment entry point | `/entertainment` is a top-bar Explorer path. |
| ENT-002 | P0 | Today view with ship day and time | `ShipClockCard`: day n of N, ship time, sea or port. |
| ENT-003 | P0 | My Plan area separate from the programme | Today's Plan (`/today`) is the plan; Explorers show only toggles. |
| ENT-005 | P0 | Event key facts at a glance | Title, time, length, venue, cost, age, status badges. |
| ENT-006 | P0 | Schedule changes visible, with reason | Moved and cancelled badges carry the ship's reason (`exp.event.movedWhy`). |
| ENT-014 | P0 | Fee, included or package status | `exp.event.cost` / `exp.event.included`. |
| ENT-018 | P0 | Consistent date, time, venue, status everywhere | One served record feeds every surface. |
| ENT-030 | P0 | Clear filters, active filter visible | Chips with `aria-pressed` and an All chip. |
| ENT-034 | P1 | Starting soon respects ship time | `upcomingEvents` rule with a 15-minute grace. |
| ENT-038 | P0 | Day-by-day calendar for the sailing | Pick a Date plus Today's Plan for any day. |
| ENT-039 | P0 | Add to plan without booking, labelled planned | Plan toggle on every event. |
| ENT-041 | P0 | Reservations alongside saved events | Dining and spa appear in the timeline. |
| ENT-042 | P0 | Overlap detection | `overlapping()` in `planTimeline.ts`. |
| ENT-055 | P0 | Reserve from the event page | Where a booking service exists (dining, spa, show seats ahead). Other events are not bookable by design. |
| ENT-056 | P0 | Guests covered by the reservation | Party size and guest names on dining and spa. |
| ENT-057 | P0 | Explicit success, failure or pending | `role="status"` result after every action. |
| ENT-059 | P0 | Manage all reservations in one place | `/plan/reservations`. |
| ENT-060 | P0 | Prevent duplicate bookings | `tableClash`, spa overlap rules. |
| ENT-062 | P1 | Cancel and modify | Dining move and cancel; spa move, edit, cancel with policy. |
| ENT-073 | P0 | Propagate changes to every surface | Single server record plus the mid-day change feed. |
| ENT-075 | P0 | Stale and offline indicator | Saved copies show their age. |
| ENT-081 | P1 | Staff explanation note | The reason field is served and shown. |
| ENT-088 | P0 | Notification centre with read state | `NotificationsScreen` and updates inbox. |
| ENT-090 | P1 | Quiet hours, separate controls | `QuietHours`, per-category channel prefs, offers separate. |
| ENT-096 | P0 | Venue name and deck everywhere | Venue page and plan rows. |
| ENT-099 | P0 | Names match ship signage | Authored from the ship docs. |
| ENT-101 | P1 | Walking time | Estimated from the deck graph in the timeline. |
| ENT-118 | P0 | Child data not exposed | Guardian controls in chat; events carry no child data. |
| ENT-125..128 | P0 | WCAG 2.2 AA, screen readers, not colour alone, plain language | Phase 9 accessibility pass, contrast report, status badges with text and icon. |
| ENT-143 | P1 | Screenings in the catalogue | Movies under the stars and screenings are events. |
| ENT-157 | P0 | Core pages without general internet | PWA with offline copies. |
| ENT-158 | P0 | Cache schedule, details, venues, plan | Saved copies for six Explorer days and the plan. |
| ENT-159..160 | P0 | Last sync shown; cache readable | Saved copy shows its age. |
| ENT-161..162 | P0 | No false completion; pending and retry states | Actions show errors and retry; nothing is queued as done. |
| ENT-164 | P1 | Text-first, light media | No media on Explorer pages; bundle budgets enforced. |
| ENT-165 | P1 | Fallback when push is missing | `localReminders` in-app fallback. |
| ENFR-001..003 | P0 | Render speed, search without reload, text-first detail | Bundle budgets in `check-bundle`; client-side filters. |
| ENFR-004 | P1 | Date-scoped loading | One day per request. |
| ENFR-006 | P0 | Keep the plan through poor connectivity | Plan is on the server; saved copies offline. |
| ENFR-007 | P0 | Authoritative results, safe timeouts | Server-confirmed actions. |
| ENFR-009 | P0 | Graceful failure | Partial-failure retry banner. |
| ENFR-011..012 | P0 | Encryption; authentication and authorisation | JWT, security headers, data protection. |
| ENFR-015..016 | P0 | Child profiles hidden; privacy controls | Guardian rules and privacy screens. |
| ENFR-018 | P1 | Audit trail | `/me/audit` and `/audit`. |
| ENFR-019..022 | P0 | Responsive, installable PWA, cached shell, no push dependence | `vite-plugin-pwa`; in-app reminders. |
| DIN-001..003 | P0 | Dining entry, ship time and day, Open now | `/dining-today`; `ShipClockCard`; `venueState` and `HoursBadge`. |
| DIN-005 | P0 | Upcoming reservations prominent | Reservations card for the chosen day. |
| DIN-007 | P0 | Open, opening soon, closed, unavailable, modified hours | Hours badge and `unavailableSince`. |
| DIN-016 | P0 | Complete venue catalogue | All three ships. |
| DIN-019 | P0 | Included, cover charge, package | Price kind and cover amount. |
| DIN-020 | P0 | Hours by date and meal period, port-day exceptions | `HoursRule` by day kind. |
| DIN-024 | P1 | Support for recorded dietary needs, with caveat | Diet filter and allergy note on menus. |
| DIN-028 | P1 | Save a venue | Pins, synced to the server. |
| DIN-034..035 | P0 | Current menu per venue and meal period; correct venue, ship, date | 7-day menus per ship. |
| DIN-038 | P0 | Menu last updated | `ven.asOf`. |
| DIN-039 | P0 | Approved allergen labels | Eight allergen tags (`CONTAINS`). |
| DIN-041 | P0 | Never say allergen-free | `ven.allergyNote` and "suits" wording. |
| DIN-042 | P1 | Verified diet filters | `dishesFor`. |
| DIN-054 | P0 | Clear filters | All chip. |
| DIN-059 | P1 | Only operating venues or next opening | Hours badge says "Opens 5:30 pm". |
| DIN-066..067 | P0 | Reserve from venue; date, time, party | `ReservationEditor` with slots. |
| DIN-068 | P0 | Guests covered | Party and names. |
| DIN-070 | P0 | Explicit result | `role="status"`. |
| DIN-071 | P0 | All reservations in one place | `/plan/reservations`. |
| DIN-072 | P0 | Included, credit or cover charge shown | `mealCharge` with covered and pays. |
| DIN-074 | P0 | No duplicate bookings | `tableClash`. |
| DIN-075 | P0 | Windows, eligibility, packages | `diningWindow`, entitlements. |
| DIN-076 | P0 | Traditional assigned dining | Early and late seatings (`DINING_PLAN`). |
| DIN-077..078 | P1 | Modify, cancel; flexible daily times | Move, cancel, late. |
| DIN-083 | P1 | Alternative times | Slot list. |
| DIN-085 | P1 | Pre-cruise and onboard booking access | `/plan/dining`, slot watch. |
| DIN-086 | P2 | Reservation waitlist | `Waits.tsx`. |
| DIN-093 | P1 | Virtual queue | `QueueControl`. |
| DIN-096 | P1 | Leave a queue | `leaveQueue`. |
| DIN-106 | P0 | Dietary profile | Account dietary list and per-guest booking step. |
| DIN-109 | P0 | Explain a request is not a guarantee | `ven.allergyNote`. |
| DIN-118 | P1 | Verified dietary tags | As DIN-042. |
| DIN-128 | P0 | Day-by-day dining view | Pick a Date. |
| DIN-129 | P0 | Save a meal idea | Pins. |
| DIN-130..131 | P0 | My dining; remove saved without cancelling | Pins and reservations are separate. |
| DIN-132 | P0 | Conflicts with other commitments | Clash rules and plan timeline. |
| DIN-139 | P1 | Voyage and daily views | Pick a Date. |
| DIN-159..160 | P0 | Room-service hours, menu, fees; chargeable items | `/ship/order`, `orders.ts`. |
| DIN-161..164 | P0 | Place order; confirmation; states; no false acceptance | Server `OrderService` drives stages. |
| DIN-165..166 | P1 | Public-place delivery without tracking | `DELIVERY_ZONES`. |
| DIN-167 | P1 | Delivery estimate | `etaAt`. |
| DIN-168..169 | P1 | Modify, cancel; substitutions | `canCancel`, `needsChoice`. |
| DIN-171 | P1 | Entitlements and fees | `priceOrder`. |
| DIN-173..174 | P2 | Scheduled delivery; progress | `deliverAt`, breakfast slots. |
| DIN-180 | P1 | No paid internet for menus | Offline copies. |
| DIN-188 | P2 | Accessible digital menus | Plain text lists. |
| DIN-193..195 | P0 | Included or chargeable; price and currency; fees shown first | Cover and `ConfirmCharge`. |
| DIN-197 | P0 | Expected account charge | Before confirming. |
| DIN-198 | P1 | Remaining credits | Entitlements. |
| DIN-200 | P1 | Exceeds allowance, incremental charge | `mealCharge`. |
| DIN-202 | P1 | Link to billing | Bill and folio. |
| DIN-219..222 | P0 | WCAG, screen readers, not colour alone, plain language | Phase 9 pass. |
| DIN-227 | P1 | Accessible menus and text equivalents | Text only. |
| DIN-232 | P0 | Operational states | `venueState`. |
| DIN-233 | P0 | Hours changes reach every view | Single source. |
| DIN-236 | P0 | Cached info flagged | Saved copy age. |
| DIN-237 | P0 | Closed venue not bookable | `venue.gone` and closed states. |
| DIN-242 | P1 | Staff explanation | Reason served. |
| DIN-249 | P0 | Notification centre | `NotificationsScreen`. |
| DIN-252 | P1 | Quiet hours | `QuietHours`. |
| DIN-262 | P1 | Include included dining beside paid | All venues listed with labels. |
| DIN-273 | P1 | Staff fallback | Crew cards and assistance. |
| DIN-283..288 | P0 | Local network, cache, sync time, offline reading, no false completion, retry | PWA copies, `offlineContract`. |
| DIN-290..291 | P1 | Compact data; push fallback | No images; in-app reminders. |
| DOPS-015..017 | P0 | Source of truth, booking rules, duplicate protection | Server rules. |
| DNFR-001..004 | P0/P1 | Speed, search, text-first, scoping | As ENFR. |
| DNFR-006..007 | P0 | Intermittent connectivity; authoritative results | Server-confirmed. |
| DNFR-009 | P0 | Graceful failure | Retry banner. |
| DNFR-010 | P0 | Stale data not shown as safe | Menu "as of" time and offline age. |
| DNFR-012..013 | P0 | Security, authorisation | JWT and headers. |
| DNFR-017..018 | P0 | Child data hidden; privacy controls | Guardian and privacy screens. |
| DNFR-020 | P1 | Audit | Audit endpoints. |
| DNFR-021..024 | P0 | Responsive, PWA, cache, no push dependence | PWA. |

### 7.3 Done partially and needs more work

"Needs" says what is still missing.

| Id | Pri | Requirement | What is missing / needs |
|---|---|---|---|
| ENT-004 | P0 | Happening now / starting soon / tonight / all today | Happening Now strip and the day list exist; no Tonight or Starting soon shortcuts. |
| ENT-012 | P0 | Searchable catalogue of all events | Search box finds venues only, not events or performers; the global search index lists venues. |
| ENT-013 | P0 | Event detail page with the minimum fields | Events are rows on the venue page, not pages of their own. Missing: performer, dress, weather, language, series. |
| ENT-015 | P0 | Mandatory age restriction vs suggestion | Age group is shown; formal and suggested are not distinguished. |
| ENT-016 | P0 | Reservation rules in plain language | Dining and spa say it; show and class events give no rule. |
| ENT-021 | P1 | What to expect, arrival advice | Free-text detail only; no come-and-go or arrival field. |
| ENT-022 | P1 | What is and is not included | Cost shown; inclusions only in prose. |
| ENT-027 | P0 | Keyword search incl. performer and venue | Venue names and descriptions only. |
| ENT-028 | P0 | Category browsing | Interest filter (shows, music, games, family...) and venue kinds; not the doc's ten categories or icons. |
| ENT-029 | P0 | Filter by day, time, category, venue, reservation | Day, venue and interest filters; no time range or reservation filter. |
| ENT-040 | P0 | Remove, reschedule, change reminder | Remove works; no per-event reminder setting. |
| ENT-043 | P0 | Hard vs soft conflicts | Overlap and walking-time notes exist; not named hard and soft. |
| ENT-044 | P0 | Venue and route action from the plan | Each item links to its Explorer page; no Navigate button. |
| ENT-045 | P1 | Combined day with dining, excursions, appointments | Dining and spa are in; tours are not (server serves only today's port day). |
| ENT-046 | P1 | Warn when travel time is too short | Walk estimate and leave-by time shown; no explicit too-tight warning. |
| ENT-049 | P1 | Voyage and daily views without reselecting the date | Date is shared and sticky; no voyage-wide calendar grid. |
| ENT-054 | P0 | Reservation model shown | Dining, spa and book-ahead show seats are modelled; events do not state one. |
| ENT-058 | P0 | Confirmation reference and arrival instructions | Reference shown; arrival and check-in text is thin. |
| ENT-061 | P0 | Honest capacity | "Filling up" and "Full" badges from simulated capacity; no source or refresh time shown. |
| ENT-063 | P1 | Waitlist or standby | Dining waitlists and walk-in queues exist (`Waits.tsx`); none for shows or classes. |
| ENT-064 | P1 | Notify a waitlisted guest with deadline | Dining waitlist offers have a deadline and accept step; not for events. |
| ENT-065 | P1 | Group reservations with partial result | Dining party booking; no "2 of 4 confirmed" wording. |
| ENT-066 | P1 | Release policy | Spa 24-hour rule and dining cancel; not stated per event. |
| ENT-067 | P1 | QR or digital confirmation with fallback | Show tickets exist in book-ahead (`Tickets.tsx`); not on Explorer events. |
| ENT-072 | P0 | Operational statuses | On, moved, cancelled, plus filling up and full; no delayed, registration closed or completed. |
| ENT-074 | P0 | Show what changed, old and new | New state and reason; old time or venue not always shown. |
| ENT-076..077 | P0 | Notify guests of changes to booked and saved events | Plan banner and push exist for programme changes; Explorer-event changes are only a banner on Today's Plan. |
| ENT-080 | P1 | "What changed today?" summary | Today's Plan lists moved and cancelled items; no whole-programme summary. |
| ENT-084..085 | P0 | Enable reminders; configure timing | Global notification settings exist; planned Explorer events have no reminder yet and timing is fixed at 15 minutes. |
| ENT-086 | P0 | Critical change alerts | As ENT-076. |
| ENT-087 | P0 | No duplicate reminders | Dedup exists in the push pipeline; not verified for Explorer events (none are sent). |
| ENT-091 | P1 | Action buttons and deep links | Links to the affected page; no action buttons. |
| ENT-097 | P0 | Venue linked to deck plan | Opens the plan without placing a pin (venues have no coordinates on the pictures). |
| ENT-098 | P0 | Navigate action from event, plan, reminder | `RouteFinder` exists under Ship; not linked from events or the plan. |
| ENT-100 | P1 | Step-by-step, accessible routing | `RouteFinder` and deck graph exist; accessible-route coverage not confirmed. |
| ENT-103 | P1 | Venue detail page | Description, hours, events, staffed hours; no seating or accessibility details. |
| ENT-104 | P2 | Near this venue | "Other venues" list; not by proximity. |
| ENT-107..110 | P1 | Shared shortlist, attendance, propose and invite, group reservation | Chat planning, polls and group day plans exist; not wired to Explorer events. |
| ENT-112 | P1 | Group poll | Chat and Stanley polls exist; not on events. |
| ENT-113..114 | P2 | Group schedule; meet-here pin | Group day plans and the meeting point screen exist. |
| ENT-116 | P0 | Age suitability on family events | Age badge shown; no accompaniment wording. |
| ENT-119 | P1 | Filter by children's ages | Kids, teens, adults chips only. |
| ENT-120 | P1 | Youth hours and registration | Hours authored for the youth venues; no registration status. |
| ENT-132 | P1 | Large text without truncation | Responsive layout; no large-text test. |
| ENT-136 | P1 | How to take part | Instructions in event text only. |
| ENT-144 | P1 | Link to stateroom TV catalogue | TV screen exists; not linked from Explorer. |
| ENT-145 | P2 | Movie details | Title and time only. |
| ENT-148 | P1 | Interest themes | Event interest filter; no saved profile. |
| ENT-163 | P1 | Queue safe preference changes | Pins and plan toggles need a connection; not queued. |
| ENT-166 | P2 | Printable daily summary | `.ics` export of the day; no print view. |
| EOPS-004 | P0 | Validate required fields | A test fails when the generated file breaks a rule. |
| EOPS-009 | P0 | Published changes update guest caches | Mid-day change feed reaches clients; no crew publish step. |
| EOPS-011 | P1 | Copy-forward revalidated per sailing | `dayMapping.ts` reuses a 7-day schedule for any sailing length. |
| EOPS-015..016 | P0 | Source of truth for capacity; protected transactions | Server is the source and booking rules are transactional for dining and spa; event capacity is simulated. |
| ENFR-005 | P1 | Image sizing, video on demand | Few images on Explorer pages; no video. |
| ENFR-008 | P0 | Schedule change service level | Feed exists; no stated service level. |
| ENFR-010 | P1 | Monitoring | Provider health and operator alerts exist; no schedule-sync monitor. |
| ENFR-014 | P0 | Permission before sharing plans | Chat and party sharing is consented; no event sharing yet. |
| ENFR-017 | P1 | Minimise retention | `RetentionPurgeService` exists; attendance and location are not collected. |
| ENFR-023 | P1 | Deep links | Routes carry `?day=N`; no notification or QR deep links for events. |
| ENFR-024..025 | P1 | Rotation, low-power, PWA fallbacks | CLAUDE.md rules out browser and device testing; fallbacks designed, not tested. |
| DIN-006 | P0 | Venue facts at a glance | Name, kind, hours, deck, cover; reservation need not on the card. |
| DIN-008 | P0 | Menu from venue cards and reservations | Menu is on the venue page; not linked from a reservation row. |
| DIN-010 | P1 | Next booked meal with actions | Reservation card has Change and Cancel; no menu or navigate action. |
| DIN-011 | P1 | Dining changes summary | Moved and cancelled items show on Today's Plan only. |
| DIN-014 | P2 | Voyage-wide special dining events | Events on any day via Pick a Date; no voyage list. |
| DIN-017 | P0 | Venue detail with minimum info | No photos, accessibility or dining model fields. |
| DIN-018 | P0 | Dining model (reservation, walk-in...) | Walk-in vs bookable only. |
| DIN-021 | P0 | Deck, location and map action | Deck label shown; map link places no pin. |
| DIN-022 | P0 | Age restrictions | `minAge` shown; no formal vs suggested. |
| DIN-023 | P1 | Filter and compare by cuisine, ambience, price... | Kind chips and text search only. |
| DIN-027 | P1 | Photos, sample menus, what to expect | Sample menus yes; venue art is illustrative, no photos. |
| DIN-032 | P2 | Service notes (buffet layout, entrance) | Short text in the description. |
| DIN-036 | P0 | Dish description and price | Dish names and tags; no descriptions or prices. |
| DIN-037 | P0 | Mark menus as sample or subject to change | Intro text says it; no per-menu label. |
| DIN-040 | P0 | Contains vs may contain vs unknown | Contains only. |
| DIN-043 | P1 | Explain what labels mean | Short note only. |
| DIN-046 | P1 | Modifications and substitutions | "Ask the maître d'" note for halal and kosher. |
| DIN-051 | P0 | Search across venues, cuisine, dishes | Venue name and description; dishes not searched. |
| DIN-052 | P0 | Consistent categories | Main, Specialty, Casual, Bars; no Buffet, Café, Room service. |
| DIN-053 | P0 | Filter by date, meal period, status, type, price, reservation | Date and type only. |
| DIN-060 | P1 | No-match alternatives | Empty message only. |
| DIN-065 | P0 | Reservation model per venue and meal | Bookable or walk-in. |
| DIN-069 | P0 | Confirmation details | Reference and time; arrival note thin. |
| DIN-073 | P0 | Cancellation deadline and no-show fee shown | Spa shows its rule; dining does not. |
| DIN-080 | P1 | Celebration details | Special occasion at booking time, not at reservation. |
| DIN-084 | P1 | Package credits shown | Meals left in the cover calculation. |
| DIN-088 | P2 | Times suggested around the schedule | `StanleyDiningPlan`. |
| DIN-091..092 | P0 | Walk-in and check-in instructions | Walk-in flag; no check-in text. |
| DIN-094 | P1 | Queue estimates labelled | Position and state shown; estimate wording not confirmed. |
| DIN-095 | P1 | Table-ready notice with window | Ready state shown in-app. |
| DIN-097 | P1 | Party and location on the queue | Venue shown; party size not. |
| DIN-107..108 | P0 | Distinct allergy workflow with severity | Allergy tags and a note at booking; no separate workflow. |
| DIN-116 | P0 | Contact the dining team | Service requests screen; not from venue pages. |
| DIN-117 | P1 | Update dietary needs, status visible | Editable; no status. |
| DIN-121 | P1 | Guardian-managed diet for children | Per-guest answers at booking. |
| DIN-122 | P1 | Printable summary for crew | Crew cards ("I have a food allergy"). |
| DIN-133 | P0 | Hard vs soft conflicts | As ENT-043. |
| DIN-134 | P0 | Planner entry details and navigation | No navigate action. |
| DIN-135 | P1 | Integrated day | Tours missing. |
| DIN-136 | P1 | Travel-time warning | As ENT-046. |
| DIN-143 | P0 | Share venue, menu, reservation | Reservations share to chat; venues and menus do not. |
| DIN-144..145 | P1 | Share shortlists; invite companions | Chat and party exist; not wired. |
| DIN-146 | P1 | Accepted and declined status | Group board only. |
| DIN-147 | P1 | Group request | `GroupTable`. |
| DIN-148 | P1 | Table-size limits | `MAX_PARTY` of 8; larger-party guidance missing. |
| DIN-151 | P1 | Lightweight poll | Chat polls. |
| DIN-152 | P1 | Share meeting point | `MeetingPointScreen`. |
| DIN-170 | P1 | Contact about a late order | General requests screen. |
| DIN-172 | P1 | Dietary instructions on orders | Free note per line. |
| DIN-179 | P1 | QR or in-app menu | In-app; no QR or NFC. |
| DIN-182 | P1 | Service assistance | Requests screen. |
| DIN-196 | P0 | Package conditions in plain language | Packages screen; not on the venue page. |
| DIN-199 | P1 | Entitlement states with last updated | Counts, no states. |
| DIN-201 | P1 | Per-guest package rules | Per-guest entitlements are not fully shown. |
| DIN-203 | P2 | Voyage view of specialty dining and credits | Packages screen. |
| DIN-208 | P0 | Age and accompaniment rules | Age only. |
| DIN-211 | P0 | Guardian allergy requests | See DIN-121. |
| DIN-213 | P1 | Children in a reservation | Party size. |
| DIN-223 | P0 | Readable at large text | As ENT-132. |
| DIN-229 | P2 | Cultural and dietary labels | Halal, kosher via the maître d'. |
| DIN-230 | P2 | Printable request summary | See DIN-122. |
| DIN-234..235 | P0 | Notify and show what changed on a reservation | Plan banner; no old and new comparison. |
| DIN-240 | P1 | Kitchen delay notices | Order stages. |
| DIN-245 | P0 | Dining reminders on and off | Global settings only. |
| DIN-246 | P0 | Configurable reservation reminders | Fixed 15 minutes. |
| DIN-247 | P0 | Material change alerts | In-app banner and push for programme changes only. |
| DIN-248 | P0 | No duplicate reminders | As ENT-087. |
| DIN-250 | P1 | Waitlist-ready notice | In-app offer. |
| DIN-251 | P1 | Order status updates | In-app progress; not push. |
| DIN-253 | P1 | Suppress on cancel | Same gap as ENT-092. |
| DIN-257 | P1 | Dining preferences (cuisine, price) | Diet only. |
| DIN-269 | P1 | Contact action from venue, reservation, order | Not on each page. |
| DIN-270..272 | P1 | Report issues, route with reference, status | Requests screen has reference and status. |
| DIN-289 | P1 | Queue preference changes | Not queued. |
| DIN-292 | P2 | Printable summary | Calendar export only. |
| DIN-293 | P2 | Confirmed reservations offline with diet acknowledgement | Reservations yes; no acknowledgement. |
| DOPS-003 | P0 | Date-specific hours | Authored per day kind; no per-date exceptions. |
| DOPS-007 | P0 | Validate before publishing | Content tests. |
| DOPS-010 | P0 | Cache invalidation | As EOPS-009. |
| DOPS-019 | P0 | Traditional dining records | Early and late seating per guest. |
| DOPS-024 | P1 | No-show and release policy | Late arrivals handled; no no-show policy. |
| DOPS-025 | P1 | Linked reservations | Party only. |
| DOPS-053 | P0 | Audit trail | Guest audit exists; no crew audit. |
| DNFR-005 | P1 | Image sizing | Few images. |
| DNFR-008 | P0 | Change propagation service level | No stated level. |
| DNFR-011 | P1 | Monitoring | As ENFR-010. |
| DNFR-014 | P0 | Least privilege on diet data | Server-side; crew access not built. |
| DNFR-015 | P0 | Permission before sharing plans | Chat consent only. |
| DNFR-016 | P0 | Protect allergy data | Stored with the account, no extra controls. |
| DNFR-019 | P1 | Minimise retention | `RetentionPurgeService`. |
| DNFR-025 | P1 | Deep links | Routes, not QR or notifications. |
| DNFR-026..027 | P1 | Device tests; PWA fallbacks | Not tested, by working rule. |

### 7.4 Not done but should be

Ordered by document, then id. Each is an Explorer or account-level gap a guest would notice.

| Id | Pri | Requirement | Note |
|---|---|---|---|
| ENT-007 | P1 | Recommended for you | No personalised area on the Entertainment page. |
| ENT-008 | P1 | "You have time for..." gap suggestions | Not built; the plan timeline has walking times but no gap suggestions. |
| ENT-017 | P0 | Recurring series vs single session | No series model. |
| ENT-019..020 | P1 | Performer profiles; images and trailers | Not built (the data has no performer field). |
| ENT-023 | P1 | Filterable accessibility attributes | `EventAccess` exists in the old programme code but is not wired to Explorer events. |
| ENT-031 | P1 | Filters for age, price, language, access, indoor/outdoor | Only interest. |
| ENT-032 | P1 | Sort orders | Time order and pins only. |
| ENT-033 | P1 | Discovery prompts (Under an hour, Live music tonight) | Not built. |
| ENT-047 | P1 | Alternatives on a conflict | Not built. |
| ENT-048 | P1 | Multiple personal lists | One plan only. |
| ENT-070 | P2 | Next-best session when full | Not built. |
| ENT-078 | P1 | Alternatives after a cancellation | Not built. |
| ENT-079 | P1 | Weather contingency, alternate venue | No weather rule on events. |
| ENT-089 | P1 | Per-event choices | Not built. |
| ENT-092 | P1 | Suppress reminders after cancel or removal | Needed once Explorer reminders exist. |
| ENT-102 | P1 | Nearby amenities | Not built. |
| ENT-106 | P0 | Share an event | Server builds share text only for tours and reservations. |
| ENT-111 | P1 | Keep some items private | Not built for events. |
| ENT-117 | P0 | Accompaniment, check-in, registration rules | Camp Discovery registration is not modelled. |
| ENT-121 | P1 | Family activities in a shared planner | Not built. |
| ENT-122 | P1 | Movie age guidance | Not authored. |
| ENT-129..130 | P1 | Accessibility attributes and accommodations on events | Not authored or filterable. |
| ENT-149..152 | P1 | Recommendation signals, reasons, dismiss, balance | No recommendation area (see ENT-007). |
| DIN-004 | P0 | Quick access: Breakfast, Lunch, Dinner, Late night, Room service | Filters are by venue kind only; room service lives under Ship. |
| DIN-009 | P1 | Good options right now | Happening Now is events only. |
| DIN-012 | P1 | Dining that fits around a show | Not built. |
| DIN-025 | P1 | Table and seating options | Not modelled. |
| DIN-026 | P1 | Typical dining duration | 90 and 120 minutes used internally but not shown. |
| DIN-030 | P2 | Alternatives when closed or full | Alternative slots on a full time exist; no alternative venues. |
| DIN-044 | P1 | Menu photos | None. |
| DIN-047 | P1 | Children's menu view | Not authored. |
| DIN-055 | P1 | Cuisine, ambience, access filters | Not built. |
| DIN-056 | P1 | Sort orders | Pins then authored order. |
| DIN-057 | P1 | Dish-level search | Not built. |
| DIN-058 | P1 | Discovery prompts | Not built. |
| DIN-079 | P1 | Seating preferences | Not built. |
| DIN-081..082 | P1 | Linked cabins; partial group result | Not built. |
| DIN-098 | P1 | Stay-near guidance | Not stated. |
| DIN-110 | P0 | Acknowledgement of the allergy process | Not built. |
| DIN-111..112 | P0 | Special diet request with received, review, confirmed states | No request status. |
| DIN-115 | P0 | Declared vs cross-contact vs unknown | Not modelled. |
| DIN-119..120 | P1 | Attach request to a reservation; venue acknowledgement | Not built. |
| DIN-137 | P1 | Alternatives on conflict | Not built. |
| DIN-138 | P1 | Multiple lists | Not built. |
| DIN-149 | P1 | Linked split reservations | Not built. |
| DIN-150 | P1 | Private meal plans | Not built. |
| DIN-175 | P2 | Repeat orders | Not built. |
| DIN-176 | P2 | Contactless preference | Not built. |
| DIN-209 | P0 | Children's menu | See DIN-047. |
| DIN-210 | P0 | High chairs, boosters | Not authored. |
| DIN-212 | P1 | Family-friendly filter | Not built. |
| DIN-214 | P1 | Infant policies | Not authored. |
| DIN-215 | P1 | Youth-club integration | Not built. |
| DIN-224 | P1 | Venue accessibility attributes | Not authored. |
| DIN-225 | P1 | Mobility needs in a reservation | Not built for dining. |
| DIN-238 | P1 | Alternatives | Not built. |
| DIN-239 | P1 | Weather changes to outdoor dining | Not built. |
| DIN-241 | P1 | Dining updates summary | Not built. |
| DIN-258..261 | P1 | Signals, reasons, dismiss, balance | No recommendation area. |

### 7.5 Not applicable, ignored

"Why" gives the reason.

| Id | Pri | Requirement | Why |
|---|---|---|---|
| ENT-009 | P1 | Near me view | Needs indoor location; the app deliberately does not track position (ENT-105). |
| ENT-010..011 | P2 | Editorial collections; voyage preview of signature events | P2, deferred. |
| ENT-024..026 | P2/P3 | Similar events; editorial content; previews | P2/P3, deferred. |
| ENT-035..037 | P2/P3 | Curated collections; reasoned recommendations; natural-language discovery | P2/P3, deferred. Stanley already answers grounded questions. |
| ENT-050..053 | P2/P3 | Templates, pace, shareable itinerary, smart replanning | P2/P3, deferred (ENT-052 is partly covered by the .ics export). |
| ENT-068..069 | P2 | Live standby queue; occupancy numbers | Needs trustworthy ship data; deferred. |
| ENT-071 | P3 | Dynamic release of unused places | P3, needs operations. |
| ENT-082 | P2 | Rebuild plan after a disruption | P2, deferred. |
| ENT-083 | P2 | Crew communication status | Crew-side. |
| ENT-093..095 | P2/P3 | Context reminders, digest, intensity | P2/P3, deferred. |
| ENT-105 | P2 | Location-aware prompts | The app avoids location tracking by design. |
| ENT-115 | P3 | Family locator integration | P3. |
| ENT-123..124 | P2 | Child interest profiles; family together / adult time | P2. |
| ENT-131 | P1 | Translations | English only for now (CLAUDE.md). |
| ENT-133..135 | P2 | Captions; sensory info; low-stimulation filter | P2, data not available. |
| ENT-137..142 | P2/P3 | Live polls, follow a series, post-event feedback, loyalty, keepsakes | P2/P3, deferred. |
| ENT-146..147 | P2 | Sports broadcast schedule; watch-later flag | Needs a content system. |
| ENT-153..156 | P2/P3 | Context, modes, learning, conversational recommendations | P2/P3 (Stanley is the conversational route). |
| EOPS-001..003 | P0 | Crew event creation, publishing, templates | Crew tooling; content is authored in `scripts/ship-explorer-*.ts`. |
| EOPS-005..008 | P0 | Preview, audit trail, review states, mobile crew edits | Crew tooling. |
| EOPS-010 | P1 | Bulk upload | Crew tooling. |
| EOPS-012..014 | P1/P2 | Operational conflicts, weather alternates, quality dashboard | Crew tooling. |
| EOPS-017..022 | P0/P1/P2 | Crew check-in, manual fallback, live roster, standby | Crew-side. |
| EOPS-023..029 | P0/P1/P2 | Content governance and approval workflow | Out of scope for a guest app. |
| EOPS-030..038 | P0/P1/P2 | Analytics and experiments | No analytics store, by design (privacy); revisit only with a stated purpose. |
| ENFR-013 | P0 | Crew least privilege | No crew tools. |
| DIN-013 | P2 | Curated collections | P2. |
| DIN-015 | P3 | "What should I eat?" flow | P3 (Stanley covers dining planning). |
| DIN-029 | P2 | Curated collections | P2. |
| DIN-031 | P2 | Chef profiles | P2. |
| DIN-033 | P3 | Contextual recommendations | P3. |
| DIN-045 | P1 | Sold-out status | Needs POS or kitchen feed. |
| DIN-048..050 | P2/P3 | Nutrition; chef stories; ingredient exploration | P2/P3. |
| DIN-061..064 | P2/P3 | Collections, comparison, reasons, natural language | P2/P3. |
| DIN-087 | P2 | Ranked alternative times | P2. |
| DIN-089..090 | P2/P3 | Preferred server; voyage dining itinerary | P2/P3. |
| DIN-099 | P1 | Crew-assisted check-in fallback | Crew-side. |
| DIN-100..105 | P2/P3 | Nearby alternative, occupancy, mobility needs, revalidation, predictive queue | P2/P3. |
| DIN-113..114 | P0 | Staff access to allergy data | Crew-side. |
| DIN-123..127 | P2/P3 | Identify to staff, cross-venue sharing, history, staff prompts, personalised | P2/P3. |
| DIN-140..142 | P2/P3 | Templates, pace, smart replanning | P2/P3. |
| DIN-153..158 | P2/P3 | Group schedule, per-member preferences, linked status, celebrations, suggestions, locator | P2/P3. |
| DIN-177..178 | P3 | Contextual offers; predictive timing | P3. |
| DIN-181 | P1 | Non-digital alternative | Physical menus are the ship's. |
| DIN-183..187 | P2 | Table ordering, requests, table charges, item charges, bill disputes | Needs POS integration. |
| DIN-189..192 | P3 | Split bill, tipping, table-side, post-meal feedback | P3 or POS. |
| DIN-204..207 | P2/P3 | Compare included vs paid, promotions, insights, group allocation | P2/P3. |
| DIN-216..218 | P2/P3 | Family suggestions and profiles | P2/P3. |
| DIN-226 | P1 | Menu translations | English only for now. |
| DIN-228 | P2 | Sensory information | P2. |
| DIN-231 | P3 | Accessibility-aware discovery | P3. |
| DIN-243..244 | P2 | Smart re-planning; staff acknowledgement | P2. |
| DIN-254..256 | P2/P3 | Context reminders, digest, intensity | P2/P3. |
| DIN-263..268 | P2/P3 | Context, modes, learning, group, conversational, voyage meal plan | P2/P3 (Stanley covers part). |
| DIN-274..282 | P2/P3 | Meal feedback, reviews, recovery, themes, summaries | P2/P3; the end-of-cruise feedback screen exists. |
| DOPS-001..002 | P0 | Crew venue management, templates | Crew tooling. |
| DOPS-004..006 | P0 | Structured menus, approvals, versioning | Crew tooling; menus authored in scripts. |
| DOPS-008..009 | P0 | Preview; urgent crew controls | Crew tooling. |
| DOPS-011..014 | P1/P2 | Bulk menu upload, copy-forward, completeness, taxonomy | Crew tooling. |
| DOPS-018 | P0 | Crew reservation tools | Crew-side. |
| DOPS-020..023 | P0/P1 | Check-in, fallback, live view, table configuration | Crew-side. |
| DOPS-026..028 | P1/P2 | Overbooking warnings, forecasts, host-stand mode | Crew-side. |
| DOPS-029..040 | P0/P1/P2 | Allergy operations workflow | Crew and food-safety process. |
| DOPS-041..049 | P0/P1/P2 | Queue, order and kitchen operations | Crew-side; the guest sees the simulated results. |
| DOPS-050..052 | P0 | Content ownership, notes, approvals | Governance. |
| DOPS-054..064 | P0/P1/P2 | Incidents, templates, analytics | Crew or analytics, by design. |

### 7.6 What this review suggests doing next

The not-done P0 and P1 items group into a few pieces of work, in the order they would help guests most:

1. **Event reminders and change alerts for planned Explorer events** (ENT-084..092, DIN-245..253): the largest gap against the P0 list, and it is already in the outstanding issues.
2. **Share to chat and a Navigate action for events, venues and menus** (ENT-098, ENT-106, DIN-143), plus the deck-plan pin.
3. **Event detail fields**: performer, series, accessibility attributes, dress and arrival notes (ENT-013, 017, 019, 023, 129..130), and venue accessibility, children's menu and family facilities for Dining (DIN-047, 210, 214, 224).
4. **Dietary request status** (DIN-110..112, 119..120): a request with received, under review and confirmed states, attached to a reservation. This is the only safety-related gap and needs server work you test.
5. **Dining discovery**: meal-period quick filters, dish search, sort and a family-friendly filter (DIN-004, 055..058, 212).
6. **Alternatives after a conflict, cancellation or full slot** (ENT-047, 070, 078, DIN-030, 137, 238), then the What changed summaries (ENT-080, DIN-011, 241).
7. **Recommendations and interest profile** (ENT-007, 148..152, DIN-258..261), last, because the documents rank them below trust and planning.
