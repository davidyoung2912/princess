# Explorer Planning Plan

One home for every reservation, before the trip and on board: the Dining, Spa and Excursions Explorers take over the pre-trip booking pages in the Plan tab. Part B (section 10 onward) widens the question to how all seven Explorers are reached and used at every stage of the journey: **information is open at (almost) every stage, actions open only when the server says they can.**

Status: **plan only, nothing built.** To be started **after the current Stanley phases are complete** (the P2 series and what follows in `docs/stanley-actions-and-proactive-plan.md`). Work proceeds in phases; each phase ends with a commit and a stop (CLAUDE.md). Verification for every phase is `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build`. No browser testing and no `dotnet test`; server tests are written with the code and run by the owner, targeted. English only: no Spanish strings for this work.

Part A (sections 1 to 9) is the reservation gap. Part B (sections 10 to 15) is the stage question and **replaces Part A's phase table (section 5) with the revised order in section 14**.

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

---

# Part B: The Explorers at every stage

## 10. What the code does today (findings)

I read the stage registry (`src/routes/screens.ts`, `stageNav.ts`) and listed which screens each of the eleven journey stages shows. Findings:

1. **None of the seven Explorer pages appears in any stage's tabs, tiles or search.** `stageUses()` is false for Entertainment, Dining, Shopping, Excursions, Spa, Exercise and Activities (X08, X13, X14, X17 to X19, X28) at every stage. The registry says a screen a stage does not use "is hidden: not in a tab, on Home or in search".
2. **So the Explorers are reachable only by side doors:** the links on Today's Plan (`TodayPlanScreen`), chat cards and shared links (`chatCards.ts` allows the paths), Stanley's text, and the venue and reserve buttons on other screens. A guest in the Plan stage has no tile that says "explore dining".
3. **Two screens are already on in every stage:** the Ship Explorer (`/ship-explorer`, X20) and Deck plans (X16). A third, the venue directory (`/ship/venues`, S02), is on in ten of eleven stages, and `/ship/venues/:id` (S03) in five. These are the closest thing to a front door for general information.
4. **The old Plan-tab booking pages are stage-limited:** `/plan/dining` (P38) appears in prebook, getToShip, embark and sea; `/plan/excursions` (P37) and `/plan/reservations` (P35) in those four plus port; `/ship/spa` (S18) in prebook, sea and port. Dream, discover, book and manage see none of them.
5. **Booking rules are not stage-based at all.** They come from the server: the loyalty window (`DiningView.window`), `canBook`, `daysToDeparture`, excursion credit, `cancelFreeHours`. A guest in `manage` can already book dining or tours if the window is open, even though the stage hides the screens.
6. **The Explorer data is tied to the guest's own sailing and "now".** `useExplorerData(kind, day)` calls `api.onboard.explorerDay(kind, day)`, which needs a confirmed booking. A guest still deciding (dream, discover, book) has no sailing to read, so the Explorers cannot show them a ship's dining, spa or entertainment at all. The ship-level content exists (`ship-venues.json`, `ship-programmes.json`, `ship-explorer.json`, per ship) and is served through `/reference/ships/{id}/...`.
7. **Offline classes are already set** (`offlineContract.ts`): the Explorer paths are `view-only`, which fits "read anywhere, change when connected".

### What this means

The current rule works by accident: *stage hides the page* and *the server limits the action* are two separate mechanisms, and the first one hides information that the second one never meant to hide. The cost falls on research. The guest who is deciding between two cruises, or building a plan before the dining window opens, cannot browse what the ship offers, which is the most valuable thing the Explorers know.

## 11. Recommendation: separate "see" from "do"

### 11.1 Four levels of use

| Level | What the guest can do | Needs | Example |
|---|---|---|---|
| **0 Read** | Information: venues, hours by day type, menus, events, prices, descriptions, accessibility, deck location | Nothing (a ship and, if available, a sailing) | "What does the specialty restaurant cost?" |
| **1 Save** | Shortlist or pin things of interest, keep a note | A signed-in account | "Remember this restaurant and this tour for later" |
| **2 Plan** | Add an event or a day idea to the plan, see clashes and walking time, no commitment made | A confirmed booking | "Put the 8 pm show on my Tuesday" |
| **3 Reserve** | Make a commitment that holds inventory or money: table, treatment, tour, cart and pay | A confirmed booking **and** the server saying `canBook` and the window is open | "Book a table for four at 7" |
| **4 Manage** | Change, move, cancel, add guests, join a waitlist | An existing reservation, within the rules shown (free-cancel hours, deadlines) | "Move my massage to Thursday" |

**Rule: levels 0 and 1 are open at every stage, in every Explorer. Levels 2 to 4 are limited by the facts of the guest's booking and the server's rules, not by which stage tab they happen to be in.**

### 11.2 Who decides what is open

One source of truth, the server's views. The client has a stage table only for *wording and emphasis* (section 12.3), never to switch an action on or off.

- A button that cannot be used is replaced by the reason, in words and with the date where there is one ("Opens for you on 12 Jan. Save it and I will remind you.") rather than a disabled button or a hidden one.
- The reason is data from the view: `status` (`open`, `opensOn`, `needsBooking`, `readOnly`, `closed`, `finished`) and an optional date, from one shared `ActionGate` shape produced for each kind (it generalises the `BookingCardModel` in section 4.1).
- The stage can tighten wording ("after you book") but cannot loosen anything the server forbids.

### 11.3 Stage by stage

Maximum level and the shape of the page per stage. "Sample day" means a typical sea, port or embarkation day for the ship, because the guest has no dated sailing to look at yet (section 13).

| Stage | Explorer data source | Max level | What the page offers |
|---|---|---|---|
| **dream** | Ship reference content, sample day | 1 | Read and save. "What could my days look like on this ship?" Cards say "Pick a cruise to plan dates" |
| **discover** | The sailing being considered (ship and itinerary) | 1 | Read and save for that ship; day picker shows that itinerary's day kinds and ports |
| **book** | The sailing being booked | 1 | Read and save; every Reserve says "You can reserve once your booking is confirmed" |
| **manage** | The guest's own sailing, dated | 2, and 3 where the window is open | Read, plan, and reserve whatever the server has opened (tours and spa may open before dining); the booking card says what opens when |
| **prebook** | Own sailing, dated | 4 | Everything. Whole trip view by default; the booking card leads |
| **getToShip** | Own sailing, dated | 4 | As prebook, with the first-day items (embarkation, muster, the first dinner) at the top |
| **embark** | Own sailing, day 1 | 4 | As aboard; "Now" and "Next" for day 1 |
| **sea** | Own sailing, today | 4 | The Explorers as built: ship clock, open now, next 1 to 3 events, today's reservations |
| **port** | Own sailing, today | 4 | As sea, with the port-day hours rules, tours for today first |
| **disembark** | Own sailing | 4 for items still ahead; 0 for the rest | Today's remaining items only; the rest read-only |
| **remember** | Own past sailing, finished | 0 (and 1 for "next time") | "Your cruise" read-only: what you booked, what you did. Save a venue or tour for next time |

Entertainment, Shopping, Exercise and Activities have no reservation (the harmony plan treats events as plan toggles). For them, "limited" means only level 2 (plan) and only while a dated sailing exists; level 0 and 1 are always open.

### 11.4 Research and planning, in practice

The most useful behaviours for a guest who is still thinking:

1. **Browse any Explorer from the first stage.** The Explorer front door lists the seven with a one-line state for the guest's stage (section 12.1).
2. **Save, then be reminded.** "Save for later" on a venue, show, treatment or tour (level 1) keeps it in a shortlist. When the guest can first reserve it (window opens, booking confirmed), the card says so, and Stanley can offer a reminder using the existing anchored reminders (R1 and R2), so a saved item turns into a nudge on the day the window opens. The shortlist uses the server favourites already used for pins (`venue` kind in the harmony plan), so it follows the guest across devices.
3. **Plan before you can reserve.** At manage and prebook the guest can build a draft day (level 2) against the real itinerary even where the reservation window is closed; the dining row says "Ask for a table when your window opens" and carries the shortlist's preferred venue and time into the reserve dialog when it opens.
4. **Compare.** The existing compare patterns (saved cruises, ports, ships) extend naturally to venues and tours later; out of scope here, noted so the shortlist data shape allows it.

## 12. How the Explorers are reached at every stage

### 12.1 Use the Ship Explorer as the front door

`/ship-explorer` (X20) is already on in all eleven stages. Make it the single entry that shows the seven Explorers, rather than adding seven tiles to each stage's tab lists (which would crowd the tabs and make the stages inconsistent).

- Seven large tiles: Entertainment, Dining, Shopping, Excursions, Spa, Exercise, Activities, in the Explorer colour (`EXPLORER_PATHS` already gives them one).
- Each tile has a **stage-aware second line** from the same `ActionGate` data:

| Stage | Dining | Spa | Excursions | Entertainment and the other three |
|---|---|---|---|---|
| dream, discover | "See the restaurants" | "See the treatments" | "See what ports offer" | "See what is on" |
| book | "Reserve after you book" | as dining | as dining | "See what is on" |
| manage | "Opens for you on 12 Jan" (or "Open now") | "Open now" | "Open now" | "Plan your days" |
| prebook, getToShip | "2 booked, 1 to go" | "Book a treatment" | "1 in your cart" | "Plan your days" |
| embark, sea, port | "Next: dinner at 7:00" | "Next: massage at 2:30" | "Today: tour at 9:00" | "On now: 3 events" |
| disembark | "Last meal" or nothing | nothing | nothing | nothing |
| remember | "Where you ate" | "Your treatments" | "Your tours" | "What you saw" |

- The existing detail pages (`/dining-today/:venueId` and the rest) are unchanged in path.
- Where a stage's tab already has a natural place (the Ship tab onboard, the Plan tab before sailing, Today at sea), that tab carries **one** tile, "Explore the ship", pointing to the front door, plus the booked items for that stage (for example "Your reservations" in Plan). Nothing is added to Home.

### 12.2 Fold the venue directory in

`/ship/venues` (S02) and `/ship/venues/:id` (S03) already exist at most stages and duplicate part of the Explorers, with a separate "Reserve" link to the old dining page. At the start of E5, decide per kind (open question 6): the likely answer is that S02 becomes the "All places" list view of the front door (a filter on kind), S03 redirects to the right Explorer venue page, and the "Reserve" link follows the redirect map (section 4.1).

### 12.3 What each stage's wording and emphasis do (and do not) change

A single pure function `explorerLens(stage, gate)` returns the heading, the one-line purpose, which block comes first (booking card, whole trip, today) and the default scope (This day or Whole trip). It never returns "enabled" or "disabled"; that stays with the gate.

## 13. Data and server changes for early stages

The Explorers need a read path for guests who do not yet have a dated booking.

- **Ship-level Explorer read:** `GET /reference/ships/{shipId}/explorer/{kind}?dayKind=sea|port|embark|last` returning the same `ExplorerDay` shape with a day kind in place of a date (no reservations, no "now"). Built from the existing per-ship content, so it costs a handler and a mapper, not new data. For discover and book, `?sailingId=` selects the itinerary's day kinds and ports.
- **Dated read (unchanged):** `GET /onboard/explorer/{kind}?day=N` for guests with a booking.
- **Shortlist:** reuses server favourites (`venue` kind, validated against the ship's venue list, per the harmony plan); add `tour` and `treatment` kinds for excursions and spa.
- **Window and gate data:** each view that needs it exposes an `ActionGate` summary (status, opens-on date, reason key), so the client never recomputes a rule. Dining already has `window`, `canBook` and `daysToDeparture`; spa and excursions get the same small summary.
- **Authorisation:** the ship-level read needs no booking and can be open to a signed-out guest (it is public marketing information; open question 7); the shortlist needs an account; everything dated needs the booking, as now. All external or provider data stays mocked behind the existing interfaces, and the client does not know it is simulated.
- **Offline:** the ship-level read and the dated read both use `useSavedCopy`; `view-only` stays the offline class for every Explorer path.

## 14. Revised phases (replaces section 5)

Part A's phases are kept; phase E0 is added at the start, and Part B's work is slotted in where it depends on them. Each phase ends with a commit and a stop.

| Phase | Scope | Size | Done when |
|---|---|---|---|
| **E0: Gate, lens and front door** | Pure `ActionGate` and `explorerLens` modules and tests; the Ship Explorer front door with seven stage-aware tiles; the stage table above in code; no behaviour change to any booking | M | Every stage reaches every Explorer from the front door, with the right second line; nothing becomes bookable that was not |
| **E1: Dining ahead** | As Part A, using `ActionGate` for the booking card, Reserve replaced by the reason | M | As Part A |
| **E2: Whole trip, aggregate list** | As Part A | M | As Part A |
| **E3: Spa ahead** | As Part A, plus the spa gate summary | S | As Part A |
| **E4: Excursions ahead** | As Part A, plus the excursions gate summary | M | As Part A |
| **E5: Ship-level read for early stages** | `GET /reference/ships/{id}/explorer/{kind}` with sample days, Explorers usable at dream, discover and book, "Pick a cruise to plan dates" states, the venue directory folded in or redirected (section 12.2) | M | A guest who has not booked can read all seven Explorers for a ship, with no Reserve button and a reason in its place |
| **E6: Shortlist and "remind me when it opens"** | Save on venues, shows, treatments and tours (server favourites, kinds extended), the shortlist view, carry-over into the reserve dialog, Stanley reminder offer anchored to the window date | M | A saved item surfaces at the right time and pre-fills the first reservation |
| **E7: Past and finished states** | `after` and `remember` states: read-only "Your cruise", disembark day shows only what is ahead, save for next time | S | The Explorers make sense after the trip |
| **E8: Entry points and cleanup** | Part A's E5 scope: stage tiles, checklist and "what next" links, Stanley text, push links, saved-link map, old routes removed once the route map proves nothing dangles | S | Nothing mentions the old pages |

Stop points that stand alone: after E0 (information open at every stage), after E2 (dining complete), after E5 (research works before booking), after E8.

## 15. Tests, risks and open questions for Part B

### Tests

- **Stage table:** a table test over all eleven stages and seven Explorers: level 0 and 1 are never closed by stage; levels 2 to 4 follow the gate only.
- **Front door:** each stage shows seven tiles; the second line matches the table; nothing says "disabled" without a reason.
- **Gate:** one test per kind and per status (`open`, `opensOn`, `needsBooking`, `readOnly`, `closed`, `finished`), including a guest at `manage` with a window open before the stage "would" have allowed it.
- **Ship-level read:** no reservation fields, no "now", correct day kinds for a 7-night itinerary and for a different length; a signed-out guest can read and cannot save.
- **Server (owner, targeted):** the ship-level read, the new favourite kinds, and the gate summaries.
- **Wording:** `wordingGuards`, `darkPatterns` and the promise tests on every new reason string; "Opens for you on 12 Jan" must not imply a guarantee of availability.

### Risks

| Risk | Handling |
|---|---|
| Information everywhere makes pre-booking guests expect to reserve | Every Reserve is replaced by a plain reason and a next step ("book your cruise", "opens 12 Jan", "save it") |
| A sample day misleads (a port day on one ship is not a port day on another) | The sample comes from the itinerary's own day kinds where a sailing is known; otherwise labelled "a typical sea day" |
| Stage tables drift from server rules | The table drives wording only; a test proves no code path reads the stage to enable an action |
| Seven tiles on the front door overwhelm | The second line and an order that follows the stage (dining and excursions first before sailing, today's items first aboard) |
| Shortlist duplicates pins | One store (server favourites); pins on the Explorer pages and shortlist items are the same thing, shown in two places |

### Open questions (in addition to section 8)

6. **The venue directory (`/ship/venues`).** Fold it into the front door and redirect, or keep it as a separate, deck-oriented directory? Recommended: fold in; confirm at the start of E5 after reading what S02 and S03 hold that the Explorers do not (for example, non-Explorer places such as the medical centre and guest services).
7. **Signed-out guests.** May a signed-out visitor read the Explorers for a ship? Recommended yes (it is public marketing content, and it helps the research use case); saving needs an account.
8. **Where in the journey a guest first sees the Explorers.** Recommended: dream and discover through the Explore and Sailing tabs' "Explore the ship" tile, and the front door at every later stage. Confirm the tile wording and whether Home should ever feature it.
9. **Disembark and remember.** Should a finished cruise's reservations stay visible in the Explorers (recommended, read-only) or only in Memories?
10. **Entertainment, Shopping, Exercise, Activities before sailing.** They have no reservation, so only read and save apply. Confirm that planning toggles ("add to my plan") should wait for a dated sailing (recommended) rather than allow a draft plan earlier.
