# Explorer Planning Plan

One home for every reservation, before the trip and on board: the Dining, Spa and Excursions Explorers take over the pre-trip booking pages in the Plan tab.

Status: **plan only, nothing built.** To be started **after the current Stanley phases are complete** (the P2 series and what follows in `docs/stanley-actions-and-proactive-plan.md`). Work proceeds in phases; each phase ends with a commit and a stop (CLAUDE.md). Verification for every phase is `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build`. No browser testing and no `dotnet test`; server tests are written with the code and run by the owner, targeted. English only: no Spanish strings for this work.

Builds on `docs/explorer-harmony-plan.md` (the Explorer skeleton, ship clock, date picker, venue detail, reservations CRUD). Where the two disagree, this plan applies to dining, spa and excursions.

---

## 1. The gap

A guest can book a table, a treatment or a tour in two different places that do not know about each other.

| Thing | Pre-trip home (Plan tab) | Onboard home (Explorer) |
|---|---|---|
| Dining | `/plan/dining` (`DiningScreen`, P38), `/plan/reservations` and `/plan/reservations/:id` (`ReservationsScreen`, P35 and P36) | `/dining-today` and `/dining-today/:venueId` (`DiningExplorerScreen`, `DiningVenueScreen`) |
| Spa | none before sailing, `/ship/spa` (S18) onboard | `/spa-explorer` and `/spa-explorer/:venueId` |
| Excursions | `/plan/excursions` (`ExcursionsScreen`, P37) | `/excursions-explorer` and `/excursions-explorer/:venueId` |

What each side has that the other lacks:

- **Plan-tab pages only:** the loyalty booking window ("opens on 12 Jan"), the main dining plan (early, late or anytime seating), the count of specialty meals the packages still cover, the excursion-credit banner, the cart and its payment panel, "read only" notes when the signed-in person cannot book.
- **Explorer pages only:** a choice of cruise day (`useExplorerDay`, `?day=N`), the ship clock, every venue with its events and hours for that day, menus, clash-aware planning, pins, "my reservations for the day" in the same list as the venues.

Links still point the wrong way: the venue page's Reserve button, the "Find a table" button on the reservations page, the saved-link map in `BookAheadScreens.tsx` (`excursion` and `venue` go to `/plan/...`), `RecomposerCard`, `PortTours`, the Stanley library text (`embark`, `port`, `prebook`, `sea`), `StanleyActionCard`, `disruption.ts`, `stageWelcome.ts`, `stageNav` screen lists and `pageArt.ts`.

What already works before sailing, and should be kept: `useExplorerDay` resolves a day from `?day=`, then the remembered day, then the ship's day clamped to the sailing, so the Explorers already open on day 1 of a future sailing. The reservation editors (`ReservationEditor`, `SpaEditor`) and `ExcursionCart` are already shared with the Explorers.

## 2. Principles

1. **One page per thing, for the whole journey.** Dining lives at `/dining-today`, spa at `/spa-explorer`, excursions at `/excursions-explorer`, from the day of booking to the last day aboard. The Plan tab and the checklist point into them.
2. **The stage changes the lens, not the page.** Before sailing the page shows booking state and a trip-wide view; aboard it shows "now", "next" and today. The same components render both, driven by one pure function of (sailing, now).
3. **Booking rules come from the server and are shown, not guessed.** The window, the plan, credit, the cancellation rule and "can this person book" are all in views the server already returns; the client renders them. The client never knows whether a provider is simulated.
4. **One reservation model across dining, spa and excursions** (list, editor, clash check, change and cancel with the rule shown first), differing only in the extra step each kind needs (seating plan, treatment note, cart and payment).
5. **Nothing is lost on the way.** Every old path redirects; saved links, push links and Stanley text keep working until they are rewritten.
6. **Accessibility as in the harmony plan** (focus-trapped dialogs, Escape, `aria-pressed` toggles, status never by colour alone, reduced motion, 44 px targets).

## 3. Target experience

### 3.1 The stage lens (pure, unit tested)

`explorerStage(sailing, nowAt)` in `src/domain/explorer/stage.ts` returns one of:

| Stage | When | Ship clock card says | Venue cards show | Reservation block shows |
|---|---|---|---|---|
| `ahead` | Before departure | "Sails in 23 days" (and the chosen day's date, port or "At sea") | Hours for that day type, events for that day; no "Open now" and no "Now" badge | Booking card (3.2), then the chosen day's reservations |
| `aboard` | Departure to disembark | Today's ship-clock card as built | As built (open now, next 1 to 3 events) | The chosen day's reservations, as built |
| `after` | After disembark | "Your cruise has finished" | Read-only | Read-only list, no change or cancel |

The date picker lists every sailing day in all stages. Before sailing there is no "Today" shortcut; it becomes "Day 1". The picker marks days that hold a reservation (the existing dot).

### 3.2 The booking card (new shared component, one per bookable Explorer)

`BookingCard` sits directly under the ship clock card, above the reservations. It is a small card, not a page. It shows only what applies, from the server view:

| Explorer | Contents (all from existing views) |
|---|---|
| Dining | Window state from `DiningView.window` (open, or "Opens on {date}" with the loyalty link), main dining plan and assigned seating (`plan`, `seating`), specialty meals still covered (`mealsLeft`), "read only" when `canBook` is false |
| Spa | `canBook`, the cancellation rule (`cancelFreeHours`, `lateFeePercent`), party limit (`maxParty`). **No window**: the spa view has none today (see open question 1) |
| Excursions | Credit left and applied (`creditLeft`, `creditApplied`), the cart summary with a "Review and pay" button, `canBook` |

While a window is closed the Reserve buttons are replaced by the window message, with the reason and the date, never a bare disabled button. Aboard, the card collapses to a single line (for example "2 meals left on your package") unless something needs attention (cart not paid, seating not set).

### 3.3 My reservations: day and whole trip

The "My reservations" block on each Explorer gets a two-option control, **This day / Whole trip** (a radio group, remembered in `?view=trip`):

- **This day** is today's block, unchanged.
- **Whole trip** lists every reservation of that kind grouped by day (day number, weekday and date, port or "At sea"), with time, venue, party, status and Change or Cancel, plus a "Book another" per day with none. Before sailing, Whole trip is the default; aboard, This day is.

Rows link to the venue detail page for that day (`/dining-today/:venueId?day=N`) and to the existing deep-link page.

### 3.4 One trip-wide list: `/plan/reservations`

Keep a single cross-type page, rebuilt as an aggregate: everything the guest has booked (dinners, treatments, tours, and waitlist entries) in one time-ordered list grouped by day, with clash warnings across kinds (a spa treatment during a dinner, a tour overlapping a show). Each row opens the owning Explorer at that item. It does not create or change anything itself: it is a view that links in. `/plan/reservations/:id` becomes a redirect to the owning Explorer's venue page with the reservation opened.

This is also where Today's Plan and the harmony plan's "one time-ordered timeline" meet: the aggregate reuses `planTimeline.ts` (merge and clash) rather than a second implementation.

### 3.5 Per-kind extras

**Dining.** The main dining plan and seating, the window, and specialty meal coverage move into the booking card and the "reserve" dialog. Waitlist (`Waits.tsx`) stays, reached from the venue page. `ReadOnly` and the guest picker are reused as they are.

**Spa.** Treatments already have a reserve, move, update and cancel API. Pre-trip booking uses the same editor; the only new rule is a booking window if the owner decides on one (open question 1).

**Excursions.** The cart, credit banner and `PayPanel` already render inside the Explorer through `ExcursionCart` and `CreditBanner`. What moves is the pre-trip list of offers and the "booked tours" list, which become the Whole trip view. Aboard, booking continues to work from the venue page for the port day. Tour changes and cancellations keep the existing dialogs (`CancelDialog`, `ChangeDialog`, `GuestDialog`).

### 3.6 Entry points

- The Plan tab screen list (`stageNav`) shows **Dining**, **Spa**, **Excursions** and **Reservations** tiles that open the Explorers (pre-trip view) and the aggregate.
- The checklist and "what to do next" items that say "book your dinner" or "book a tour" link to the Explorer with `?view=trip`.
- Stanley's library text and action cards link to the Explorer paths. Stanley's own reserve actions keep calling the same API; only the "open it" link changes.
- Push and email deep links to the old paths keep working through redirects, then are rewritten.

## 4. Architecture

### 4.1 Front end (framework-free logic first)

New pure modules in `src/domain/explorer/`, each with table tests:

- `stage.ts`: `explorerStage(sailing, nowAt)`; the "Sails in N days" text inputs.
- `bookingState.ts`: one function per kind turning the server view into a small `BookingCardModel` (`status`, `message key`, `facts`, `action`), so the component is presentation only.
- `reservationsByDay.ts`: group and order reservations of one kind by day; the cross-kind merge for the aggregate reuses `planTimeline.ts`.
- `routeMap.ts`: the old-to-new path table used by the redirects and by a test that proves every old route has a target.

New or changed components in `src/ui/explorer/`: `BookingCard`, `ReservationScope` (the This day / Whole trip control), `TripReservations` (the grouped list), a small change to `ShipClockCard` for the `ahead` and `after` stages, and a rewritten `ReservationsScreen` (aggregate). `DiningScreen` and the old excursions page are deleted once their content is in the Explorers. Anything the backend can serve is removed from the front end (no mock path).

Routes: the old paths stay in `routes.ts` as redirect-only entries until phase E5, then are removed. `routes/screens.ts` ids P35 to P38 are re-pointed or retired with their `stageNav` and `stageProgress` entries. i18n changes go in `en` only.

### 4.2 Back end (C#, `server/`)

Most data already exists, so the server work is small and additive:

- A **trip view** for each kind or one combined `GET /plan/reservations/trip`: every reservation, appointment and tour for the signed-in booking, with day, time, venue id and status, in one response for the aggregate page. Mirrors the existing views; no new tables.
- `SpaView` gains an optional `window` (same shape as `DiningWindow`) and `daysToDeparture`, only if the owner confirms a spa booking window (open question 1). Default is "always open", so the field is absent.
- No change to dining, excursion or spa booking, payment or cancellation rules.
- Deep-link resolution: `GET /plan/reservations/:id` already returns what the redirect needs; confirm it returns the kind and venue id (add if missing).
- Tests (written with the code, run by the owner, targeted): the trip view groups by day, hides other bookings' items, and is read-only for a person who cannot book.

### 4.3 Data and privacy

No new personal data. The trip view returns only what the person can already see in the three existing views, so authorisation reuses the existing booking checks. Update `docs/stanley-data-inventory.md` only if Stanley's reads change (they should not).

## 5. Phases

Each phase is independently releasable and ends with a commit and a stop. Order is chosen so the riskiest pattern (the booking card on a live booking flow) is proven on dining first.

| Phase | Scope | Size | Done when |
|---|---|---|---|
| **E1: Dining ahead** | `explorerStage`, ship clock card for `ahead` and `after`, `BookingCard` for dining (window, plan, seating, meals left, read only), Reserve replaced by the window message while closed, "Find a table" and the venue page's Reserve link to `/dining-today` | M | A guest can reserve a table from the Dining Explorer before sailing; closed-window and read-only states are shown with reasons; pure-module tests pass |
| **E2: Whole trip, and the reservations aggregate** | `ReservationScope` and `TripReservations` in Dining, server trip view, `/plan/reservations` rebuilt as the cross-type list with clash warnings, `/plan/reservations/:id` redirects, `/plan/dining` redirects to `/dining-today?view=trip`, old `DiningScreen` deleted | M | Dining is fully managed from the Explorer; the aggregate lists dinners now and takes spa and tours as they arrive |
| **E3: Spa ahead** | Booking card for spa, Whole trip view, pre-trip booking through the same editor, optional window if confirmed, spa rows join the aggregate, `/ship/spa` entry points updated | S | Spa works before sailing and aboard from one page |
| **E4: Excursions ahead** | Booking card for excursions (credit, cart, pay), Whole trip view of offers and booked tours, `/plan/excursions` redirects, tours join the aggregate, `ExcursionsScreen` and its duplicate content deleted | M | Tours are browsed, carted, paid and managed from the Excursions Explorer; the old page is gone |
| **E5: Entry points and cleanup** | `stageNav`, `stageWelcome`, `stageProgress`, checklist and "what next" links, Stanley library and action cards, push and email deep links, `BookAheadScreens` saved-link map, `pageArt`, old redirect-only routes removed once nothing links to them, screen ids retired, docs updated | S | No code path or text mentions the old pages; `routeMap` test proves nothing dangling |

Stop points that stand alone: after E2 (dining is complete and the pattern is proven), after E4 (all three kinds).

## 6. Tests

- **Pure:** `explorerStage` (before, at departure, during, at disembark, after, across a zone change), each `bookingState` function (window open or closed, plan fixed or anytime, no meals left, cannot book, cart empty or full, credit larger than the cart), `reservationsByDay` (empty days, several per day, cancelled hidden or struck through, ordering by ship time), aggregate clash across kinds.
- **Route map:** every old path has a target, every target is a registered route, no old path appears in a link, a Stanley string or a push payload.
- **Components** (existing `render.test.tsx` style): booking card states, scope control (keyboard, `aria-checked`, URL), whole-trip list, closed-window message in place of Reserve, read-only state.
- **Accessibility:** the existing pattern extended to the booking card and the scope control; live-region announcements on change.
- **Wording:** new copy passes `wordingGuards`, `darkPatterns` and the promise tests; no "AI" wording.
- **Server (owner, targeted):** the trip view and, if added, the spa window.

## 7. Risks and how to handle them

| Risk | Handling |
|---|---|
| Dead links in saved items, push notifications, emails and Stanley text | Redirects stay until E5; the route-map test is the gate for removal |
| The booking card hides a rule the old page showed | Phase E1 starts with a checklist of every sentence and state on `DiningScreen`; each is either in the card or deliberately dropped, recorded in the phase commit |
| Explorers feel "onboard only" before sailing | Stage lens removes "now" language; wording reviewed in E1 |
| Three kinds drift apart again | One `BookingCardModel` shape and one scope control; kinds differ only in the model builders |
| Aggregate page grows into a fourth booking surface | It never edits; every row links into the owning Explorer |
| Day numbering before sailing | Reuse `resolveExplorerDay` (already clamps); add a test for day 1 of a future sailing |

## 8. Open questions

1. **Spa before sailing.** The spa API has no booking window or days-to-departure today, so spa is bookable at any time. Is that right, or should spa have a window (for example opens 90 days out, or after final payment)? Default: no window; the phase still works either way.
2. **One aggregate or none.** This plan keeps `/plan/reservations` as a cross-type list. If you would rather remove it and rely on each Explorer's Whole trip view, E2 gets smaller and the clash-across-kinds warning moves to Today's Plan.
3. **Tour changes after payment before sailing.** Existing change and cancel dialogs are reused unchanged; confirm no new rule is wanted for the pre-trip period.
4. **Waitlists.** Kept on the dining venue page as now. Should spa and tours get waitlists later (they do not today)? Out of scope here.
5. **Seating plan changes.** Setting or changing early, late or anytime dining stays where it is (booking management) and the card links to it. Confirm it should not move into the Dining Explorer.

## 9. Out of scope

Stanley's own booking actions (covered in the Stanley plans), new venue content, group dining and polls, pricing and payment rules, crew-side tools, non-English strings.
