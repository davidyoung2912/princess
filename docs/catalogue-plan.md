# Phase X0: the three-ship catalogue

Status: **Plan written 2026-11-03. X0a to X0o are built and the server builds and passes (checked by the owner after X0o). X0h (cleanup) is done: the date-based feed parameters are gone (feeds take `sailing`), the single-route ceilings are at zero except the placeholder sailing, placeholder art ids exist for ships, regions and the 25 Tier A ports (`src/domain/artIds.ts`, tested against the seed), and the README, runbook and data-model docs are current. The trip-cost, cabin chooser and decide screens run on the served sailings and rooms. Still open: the art files and an `Art` component (ART0/ART1), verification of the authored port content, and the accessible-room count for Sky and Sapphire (no source).** Follows the project's rules (`CLAUDE.md`): phases, each ending in a commit and a stop; verify with `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` (plus `api:check`, `db:check`, `db:seed:check` when the REST surface or schema changes); never run a full `dotnet test`; secrets stay out of git.

Inputs: `docs/catalogue-2027-research.md` (ship facts, sample 2027 sailings and ports, the leg pattern) and `docs/experience-extension-ideas.md` sections 12, 15 and 16.

Decisions already made: Sun Princess, Sky Princess and Sapphire Princess with their 2027 itineraries; the Fort Lauderdale Western Caribbean route stays; art is generated outside this work and placeholders are used until then; Tier A port art (about 25) plus six region scenes first.

## 1. Goal and scope

**Goal.** Replace "one ship, one eight-day route, five ports" with a real catalogue of ships, sailings, itineraries and ports, so Dream and Discover have something to choose from and every later stage works on whichever sailing the guest booked.

**In scope.** Data model and seed; server reference endpoints; front-end catalogue store; Discover and Dream screens on the new data; per-sailing rules (length, ports, time zones, currency); port content tiers; cleanup.

**Out of scope (later phases).** Booking a stack of legs as one booking (X0 stores legs and shows them, the booking flow still books one sailing); real-time inventory and real prices; the art itself (placeholders only); aboard features for Sky and Sapphire beyond catalogue depth (section 5); multi-currency payments.

## 2. What the audit found

The database is further along than the code. The front end and the server's authored rules are where the single-ship assumption lives.

### 2.1 Already multi-ship (keep)

- `ref.Ships` (name, class, decks, tonnage, capacity, home zone, `ProfileJson`), `ref.Decks`, `ref.Cabins`, `ref.MusterStations`, `ref.CrewMembers` are all keyed by `ShipId`.
- `ref.Sailings` has `ShipId`, `Departure`, `Nights`, `Title`, holiday and reference flags, and a unique index on `(ShipId, Departure)`.
- `ref.ItineraryDays` is keyed by `(SailingId, Day)` with arrive, depart, all-aboard and clock-change columns, so it can already hold any length and any ports. `ref.ExcursionDepartures`, `ref.EventDays`, `dbo.TourBookings` and `dbo.Bookings` all reference it or `SailingId`.
- `ref.Ports` has a country and a time zone.

### 2.2 Single-ship or single-route (change)

| Where | Assumption | Evidence |
|---|---|---|
| Front end, `src/domain/sailings.ts` | One itinerary **template** of exactly eight days applied to every sailing (`itinerary(s)` maps the template and adds days); a closed `PortId` union (`fll`, `sea`, `cozumel`, `belize`, `roatan`); two global clock zones (`SHIP_HOME_ZONE`, `SHIP_WEST_ZONE`); one "reference" sailing the demo opens on. | `sailings.ts`, `sailingsServed.ts` (rejects anything but eight days) |
| Front end, `src/domain/ship.ts`, `cruise.ts` | A single `SHIP` object and a single `CRUISE` constant (name, nights, home port, intro, best time). | `ship.ts`, `cruise.ts` |
| Front end, about 39 files | Literal port ids (`'cozumel'`, `'belize'`, `'roatan'`, `'fll'`); about 30 UI files import the constants. | grep |
| Front end, content | Port guides, tipping, phrases and weather for three ports (`portContent.ts` and served `ports`); dress nights, packing and day counts assume seven nights; games and trivia are about this ship. | `portContent.ts`, `games.ts` |
| Server `Domain/Itinerary.cs` | "Every sailing runs the same eight days from its departure date"; `ShipZoneOnDate` hard-codes the clock change. | file header |
| Server `Domain/Pricing.cs` | `Nights = 7` constant; interior fare **by departure date** and room-type ratios held in code, not in a table. | file header |
| Server feeds | Several `/feeds/...` endpoints take a **departure date** (`pulse`, `route`, `ship-position`, `sea-conditions`, `sky-night`, `storm`). With three ships departing the same Sunday, a date is **ambiguous**. | `ReferenceEndpoints.cs` |
| Server reference | `/reference/ship` and `/reference/ports` return one ship and one port set (`ShipReference.cs` holds `"id": "sun-princess"`). | `ReferenceEndpoints.cs` |
| Database, not ship-keyed | `ref.Venues`, `MenuItems`, `Events`, `Excursions`, `Fares`, `Packages`, `CabinCategories`, `PhotoCatalogue`, `ServiceItems` have no `ShipId`. | `01-schema.sql` |
| Seeds | `db/seed/reference/*.sql` are **generated from TypeScript** (`npm run db:seed:gen`), so today the front-end constants are the source of the database, the reverse of what a catalogue needs. | `package.json`, `scripts/gen-reference-seed.ts` |

## 3. Target data model

**One idea drives it** (from the research): a **leg** is a 7-night (sometimes 5 to 10) trip on a date; a **sailing** is one or more consecutive legs, bookable as one; an **itinerary pattern** is a repeating shape (Eastern, Western A, Western B, Western Med, Greek Isles, Japan loop).

Keep `ref.Sailings` and `ref.ItineraryDays` as the **materialised truth** (every sailing gets its day rows), so the many existing foreign keys (tours, events, bookings, journey events) keep working. The new tables describe where they come from and add the missing facts.

| Table | Purpose | Change |
|---|---|---|
| `ref.Regions` | Caribbean, Western Med, Eastern Med and Adriatic, Atlantic, Northern Europe, Scandinavia and Baltic, Japan and Korea, Southeast Asia, Australia and New Zealand | new |
| `ref.Ports` | Add `Region`, `CountryCode`, `Lat`, `Lon`, `Currency`, `Languages` (JSON), `Tier` (`A`, `B`, `C`), `GuideStatus`, `ArtId`, `Tender` stays | extend (backfill existing five) |
| `ref.Terminals` | Terminal name, address and notes per port, optional | new, can be empty at first |
| `ref.ItineraryPatterns` | `Id`, name, `RegionId`, `Nights`, `StartPortId`, `EndPortId`, description | new |
| `ref.ItineraryPatternDays` | The days of a pattern (relative day, port or sea, arrive, depart, all-aboard, clock change) | new |
| `ref.Sailings` | Add `PatternId` (nullable for custom), `StartPortId`, `EndPortId`, `LegCount`, `RegionId`, `DataStatus` (`served`, `sample`, `verified`) | extend |
| `ref.SailingLegs` | `SailingId`, `LegNo`, `PatternId`, `StartDay` | new |
| `ref.ItineraryDays` | Same shape; generated from the legs; allow up to 40 days; clock-change columns stay | unchanged shape |
| `ref.Ships` | Add `LengthFt`, `BeamFt`, `Crew`, `Staterooms`, `Entered`, `Intro`, `Depth` (`browse` or `aboard`); the existing `ProfileJson` holds highlights, class and venue summary | extend |
| `ref.CabinCategories`, `Venues`, `Events`, `Excursions`, `MenuItems` | Add `ShipId` (backfill `sun-princess`); categories differ by ship | extend |
| `ref.SailingFares` | `SailingId`, `CategoryId`, `PerNightCents`; replaces the `Pricing` dictionaries so price lives in data | new |
| `ref.DressNights` | Per sailing day: `casual`, `smart` or `elegant` (computed at seed time from the leg length, replacing the "nights 2 and 7" rule) | new |

**Ids.** Keep every existing sailing and port id stable (the personas and bookings depend on them). New ids: sailings `<ship>-<yyyy-mm-dd>-<nights>` (for example `sun-2027-01-24-7`), ports a short lower-case slug (`cozumel`, `grand-turk`, `santa-margherita`), patterns `<region>-<name>` (for example `carib-west-a`).

## 4. Source of truth and the seed pipeline

Flip the direction of the seed. Today `db:seed:gen` turns front-end TypeScript into SQL. For the catalogue:

1. **One reviewed JSON source** in `db/seed/catalogue/`: `ships.json`, `ports.json`, `patterns.json`, `sailings-2027.json` (sailing → ordered legs → pattern ids and dates), `fares.json`. People edit and review these.
2. A script `scripts/gen-catalogue-seed.ts` (new `npm run catalogue:gen`) validates the JSON (every port exists, days are consecutive, dates match the pattern, no duplicate sailing) and writes `db/seed/reference/02-catalogue.sql` and the front-end **fallback cache** (below).
3. `npm run catalogue:check` fails when the JSON and the generated SQL disagree (like `db:seed:check` today).
4. **Initial content** comes from `catalogue-2027-research.md`: the whole Sun Princess January to March Fort Lauderdale run; the Sun Mediterranean spring set (7, 14 and 21-night legs from Barcelona, Civitavecchia and Athens); a Sky Princess Port Canaveral winter set, a transatlantic and a Southampton summer set; a Sapphire Japan, Singapore and Australia set. All `DataStatus = sample` and labelled in the app as "dates and ports to be confirmed".
5. **Later:** a polite scraper (`scripts/catalogue-scrape.mjs`) writes a candidate JSON and a diff for a person to approve; it never writes straight to the seed. Check the source sites' terms and `robots.txt` first.

The front end must keep working offline, so it keeps a small **cache of the last served catalogue** (as it does for sailings today); the generated fallback only seeds a fresh install.

## 5. Ship depth: what each ship needs

Not every screen needs a full deck plan. Add `Depth` to each ship:

| Depth | Contains | Ships at first |
|---|---|---|
| **browse** | Facts, class, highlights, deck list, venue list (names, kind, deck, hours approximate), stateroom categories with sample prices, photos (placeholder art), accessibility summary | None now (Sky and Sapphire were `browse` until AB6; the depth stays in the schema for a future ship) |
| **aboard** | Everything above plus cabins by number, muster stations, deck graph, menus, programme (events and shows), excursions, services, photos catalogue, the games and trivia set | Sun, Sky and Sapphire Princess |

Screens that need aboard depth (deck map, cabin chooser scores, walking times, muster, venue menus, order, programme) show an honest message when the sailing's ship is `browse` ("The deck plan for Sky Princess is not in the app yet") and offer the next best thing. The demo personas stay on Sun Princess. Bringing a ship to `aboard` is a content phase per ship (Sky and Sapphire: `docs/aboard-plan.md`, AB1 to AB6, done 2026-11-03; their content is concept sample data).

## 6. API

**Add** (all read-only, cached with a version string like today's `/reference/sailings`):

| Endpoint | Returns |
|---|---|
| `GET /reference/catalogue/ships` | All ships: facts, highlights, depth |
| `GET /reference/catalogue/ships/{id}` | One ship with decks, venues, categories (browse depth) |
| `GET /reference/catalogue/regions` | Regions |
| `GET /reference/catalogue/ports` | All ports: country, region, zone, coordinates, currency, languages, tier, guide status, art id |
| `GET /reference/catalogue/patterns` | Itinerary patterns with their days |
| `GET /reference/sailings` | **Extended**: id, ship, departure, nights, title, region, start and end port, legs, holiday, booking open, data status; query filters `ship`, `region`, `from`, `to`, `nightsMin`, `nightsMax`, `port` |
| `GET /reference/sailings/{id}/itinerary` | The days of one sailing (replaces the single "template") with ports, times, clock changes, dress nights |

**Change:**

- The `/feeds/*` endpoints that take `departure` take **`sailing`** (an id) instead; keep the date parameter working for one phase (X0c to X0h) behind a deprecation note, then remove it. **Done (checked 2026-11-03): every sailing feed takes only `sailing`; `DepartureOfAsync` is an internal lookup of that sailing's date for the simulators, not a parameter. `date` stays on `/feeds/sky`, `flight` and `port-crowd` because those are about a port or a flight on a day, not a sailing.**
- `PricingReference` reads `ref.SailingFares` instead of the code dictionaries; `Pricing.Nights` becomes the sailing's nights.
- `Itinerary.cs` reads days from the table; the clock-change helper (`ShipZoneOnDate`) reads the day rows instead of a hard-coded Belize rule.
- Booking, deposit and final-payment dates, and cancellation steps, key off the sailing's length and departure (the existing rules take them from the sailing row; confirm each).
- `/reference/ship` and `/reference/ports` stay as compatibility reads of the Sun Princess and its ports for one phase, then go.

Update `docs/backend-data-model.md` (API surface) and the API docs; `npm run api:check` must pass.

## 7. Front-end changes

**A catalogue store** (replacing the singletons), in `src/domain/catalogue*.ts` and the runtime:

- `ships`, `sailings`, `regions`, `ports` (a map by string id), `patterns`, and per-sailing **itinerary days** loaded on demand (`/reference/sailings/{id}/itinerary`) and cached.
- `PortId` becomes a plain string. `Port` gains country, region, currency, languages, tier and `artId`.
- `SHIP` and `CRUISE` become `shipOf(sailingId)` and `cruiseOf(sailingId)` (name, nights, region, home port, intro built from the pattern). During the transition, `SHIP` stays as an adapter that returns the Sun Princess so untouched screens keep working; a test counts remaining imports and the count goes to zero by X0h.
- `useSailing()` already exists for the focused sailing; add `useShip()` and `useItinerary()` built on it.
- `SHIP_HOME_ZONE` and `SHIP_WEST_ZONE` go: the ship clock comes from the day rows (each day carries its zone and any clock change).

**Pure rules, tested in node** (`CLAUDE.md`): `legs.ts` (combine and split legs), `catalogueFilter.ts` (filter and sort sailings), `nightsRules.ts` (dress nights, laundry, medication supply, "mid-voyage" nudges by length), `portTier.ts` (which guide to show). Each ships with tests for 6, 7, 8, 10, 14, 21 and 31 nights.

**Screens:**

| Screen | Change |
|---|---|
| H06 The cruise | Becomes the **itinerary page** for a pattern or sailing (route map, day by day, regret cards by region), reached from a sailing, not a fixed link |
| H07 Sailing Dates | **Browse the catalogue**: filters (ship, region, month, nights, port), sort (soonest, cheapest, shortest), grouping by month, leg badges ("7 nights, or add the next 7"), data-status note |
| H08 Sailing Details | Per sailing: ship, region, legs, days, from-price, links; the day strip handles up to 40 days |
| H09 Port Details | Any port id; tiered content (section 8); region art fallback |
| H10 Your Ship | `/home/ships` list and `/home/ships/:id` pages; compare two ships (facts table); the "other ships" teaser becomes real links |
| H02 Quiz | Adds region and month to the answers and picks a **sailing** as well as a room |
| H11 Saved | Saves sailings, ports, ships; compare two or three sailings |
| H12 Trip cost, H14 Cabins | Per ship categories and prices; honest `browse` note for deck-based scores |
| Booking steps | The sailing step chooses from the catalogue; the rest key off the chosen sailing's ship and nights |
| X02 Trial Day | Chooses a sample day of any aboard-depth sailing |
| Demo controls (M41) | Choose ship, sailing and scenario |
| New | **Explore by region and month** page; **Compare ships** page |

## 8. Port content tiers

About 120 distinct ports across the three ships. Tiers (from the research):

| Tier | Content | Count at X0 | Art |
|---|---|---|---|
| **A** | Full guide (arrival style, hours, money, language and phrases, tipping, weather by month, getting around, safety, entry notes, things to do) | About 25 | Postcard |
| **B** | Short guide (what it is, how the ship arrives, 3 tips, weather by month, official link) | Frequent ports | Region scene |
| **C** | Official link, map, weather, time zone, all-aboard time, "guide not yet written" | The rest | Region scene |

Tier A is the research list: Cozumel, Belize City, Roatán, Celebration Key, San Juan, Grand Turk, Amber Cove, Barcelona, Marseille, Genoa, La Spezia, Civitavecchia, Naples, Palma, Athens, Santorini, Mykonos, Kusadasi, Southampton, Copenhagen, Tokyo, Hakodate, Singapore, Sydney (24 so far; add Fort Lauderdale for 25).

Entry rules grow from four rows to **a row per country** (Mexico, Belize, Honduras, Bahamas, Dominican Republic, US territories, Spain, France, Italy, Greece, Turkey, Montenegro, UK, Denmark, Norway, Germany, Iceland, Portugal, Morocco, Japan, South Korea, Taiwan, Hong Kong, Vietnam, Singapore, Malaysia, Thailand, Indonesia, Australia, New Zealand). Each row keeps the app's pattern: months of passport validity, visa or authorisation hint, official link, **date last checked**. These are authored with a clear "check the official source" note.

## 9. Phases

Each phase ends with a commit and a stop. Sizes are rough. Server C# is compiled with `dotnet build` only (never `dotnet test`).

### X0a: Contract and guard rails (S, no behaviour change)

- Write the catalogue JSON schemas and the data-model doc (`docs/catalogue-data-model.md`), the endpoint contract, and the migration notes.
- Add `catalogue:gen` and `catalogue:check` scripts against an empty catalogue.
- Add a **test that counts single-route references** (imports of `SHIP`, `CRUISE`, `REFERENCE_SAILING`, literal port ids, `SHIP_HOME_ZONE`) and records today's number as a ceiling, so each later phase must lower it.
- Done when: all npm checks pass and the baseline number is recorded in this doc.

### X0b: Server data model and seed (M)

- Schema additions (section 3), with the idempotent `IF OBJECT_ID` pattern the schema uses; update `00-drop-all.sql` and `docs`.
- Backfill `ShipId` on the ship-keyed tables with `sun-princess`; backfill port fields.
- Author the catalogue JSON from the research (sample status), run `catalogue:gen`.
- Seed the three ships (Sun at `aboard`, Sky and Sapphire at `browse`) with facts from the research and highlights.
- Done when: `db:check`, `db:seed:check`, `catalogue:check` pass; `dotnet build` of the solution is clean; the persona seed still loads (existing sailing and port ids unchanged).

### X0c: Server API (M)

- New endpoints (section 6) and the extended sailings reference; feeds switch to `sailing`; pricing, itinerary and clock helpers read from tables; booking date rules key off the sailing.
- Compatibility reads kept.
- Unit tests for the rules (compile only, not run, per the project rule), and `api:check` updated.
- Done when: `api:check`, `dotnet build` pass and `docs/backend-data-model.md` is updated.

### X0d: Front-end catalogue store (M)

- New served-catalogue module and cache, the open `PortId`, per-sailing itinerary loading, `shipOf`, `cruiseOf`, `useShip`, `useItinerary`, and the adapters for `SHIP` and `CRUISE`.
- Replace `SHIP_HOME_ZONE` and `SHIP_WEST_ZONE` with per-day zones.
- Done when: all npm checks pass; **the single-route reference count is at or below the baseline and the adapters are the only importers of the old constants outside screens not yet moved**.

### X0e: Browse, compare and ships (L)

- H07 catalogue browse, H06 itinerary page, H08 per-sailing, H10 ships list and page, compare ships, explore by region and month, H11 save and compare, quiz with region and month.
- English and Spanish strings for everything new.
- Done when: new screens have render tests; the stage matrix regenerates (`docs/stage-menus-matrix.md`); accessibility tests pass.

### X0f: Per-sailing rules (M)

- `nightsRules`: dress nights, packing counts, laundry, medication supply, mid-voyage nudges by length; plan day counts up to 40; embark, port and disembark day logic by the real first and last day; per-port zones and the clock-change nudge for the many zones in the new regions.
- Cabin categories and prices per ship; `browse`-depth messages.
- Done when: tests cover 6, 7, 8, 10, 14, 21 and 31 nights, a clock-change leg (Western Caribbean to Belize), a transatlantic leg and a Japan leg.

### X0g: Port content tiers and entry rules (L, content-heavy)

- Port content schema, Tier A guides (about 25) authored with English and Spanish where the port is in a Spanish-speaking area and English elsewhere, Tier B short guides, Tier C fallback; per-country entry rows; currency and tipping data; phrases per port language (read-aloud from the browser's speech).
- Done when: the port guide, port day, snapshot, entry and rates screens work for any port id; `content-verification.md` updated with what is authored and what is not.

### X0h: Cleanup (S to M)

- Remove the adapters and the old endpoints and the date-based feed parameters; the single-route test ceiling goes to zero.
- Update `README.md`, `docs/backend-data-model.md`, `docs/stage-menus-matrix.md`, `docs/runbook.md`.
- Add placeholder art ids to the manifest for ships, regions and the 25 ports (ties to the ART0 plan in `experience-extension-ideas.md` 16.6).
- Done when: all npm checks pass and `dotnet build` is clean.

**Suggested order with the other work.** X0a to X0d can run in parallel with the look-and-feel and Stanley kit phases (X1, SG1) because they touch different files. X0e is where Dream and Discover change; do it before X4 (choose with confidence). X0g can continue after X0h, one region at a time.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Itinerary and price data are third-party and may be wrong | `DataStatus = sample` shown in the app; a verification checklist; no price claims beyond "estimate"; a person approves any scraper diff |
| Ambiguous feeds when ships share a departure date | Switch every feed to `sailing` in X0c, with tests for two ships on one date |
| Many literal port ids and seven-night assumptions | The single-route test ceiling (X0a) forces them down phase by phase |
| Booking rules assume 7 nights (deposit, final payment, cancel steps) | Audit in X0c; tests for short (3, 6) and long (14, 31) sailings |
| Sky and Sapphire have no deck data, so cabin scores and maps cannot work | Depth flag and honest messages (section 5); bring each ship to `aboard` in a later content phase |
| 120 ports is more than can be authored | Tiers; region art fallback; "guide not yet written" is honest |
| The generated seed and the front-end cache drift | `catalogue:check` in CI-style checks; one JSON source |
| Persona and demo data are on Sun Princess sailings | Keep their ids; add a Sky and a Sapphire persona only when a ship reaches `aboard` |

## 11. Decisions (all five accepted 2026-11-03)

| # | Question | Decision |
|---|---|---|
| 1 | Should **Sky Princess and Sapphire Princess be bookable** in the demo at `browse` depth (booking works, aboard screens say "not yet")? | Yes: it proves the catalogue and the booking flow without waiting for deck plans |
| 2 | **Stacked legs:** show them in X0 and book only a single sailing, or build "book legs 1 and 2 together" now? | Show only now; book later (a separate phase) |
| 3 | **Prices:** authored by a formula from ship class, length and season (clearly "estimate"), or do you have real fares? | Formula first, labelled as estimates |
| 4 | **Which Sky and Sapphire sailings** to seed first: a handful per region, or everything the research found? | A handful per region (about 20 sailings total), more later |
| 5 | **Demo clock:** keep it opening on the 21 March 2027 Western Caribbean sailing? | Yes; it exists in the research and fits the route you want to keep |

## 12. Progress

- **X0a done (2026-11-03):** `docs/catalogue-data-model.md`; `scripts/catalogue.ts` (types and validation), `catalogue:gen` and `catalogue:check` over empty JSON in `db/seed/catalogue/`; `src/domain/singleRoute.test.ts` with the baseline recorded in the data-model doc; `src/domain/catalogueSource.test.ts`.
- **X0d done (2026-11-03):** `src/domain/shipCatalogue.ts` (served ships, regions, ports, patterns and sailing entries with all-or-nothing readers; `shipOf`, `cruiseOf`, `loadItinerary`), `src/hooks/useShipCatalogue.ts` (`useShip`, `useCruise`, `useItinerary`), runtime tables for `/reference/catalogue/*` and an itinerary loader that keeps the last answer per sailing on the device. `PortId` is a plain string and `portById` reads the catalogue's ports. The ship clock now comes from a `shipZone` on every itinerary day (new field on the legacy template and on `/reference/sailings/{id}/itinerary`, worked out by the server's `Timeline`); `SHIP_HOME_ZONE` and `SHIP_WEST_ZONE` are gone (`shipHomeZone(sailing)` replaces them). `portAt` and `allAboardEpoch` work from the first and last day instead of `fll`. Discover Landing, Cruise, Confirmed, Exports, Saved and three delight screens use the hooks and `shipOf`/`cruiseOf`. Ceilings lowered (see `catalogue-data-model.md`). Port screens that only have guides for Cozumel, Belize and Roatán now show those sections only for guide ports (X0g gives the rest).
- **X0f done on the front end (2026-11-03):** `src/domain/nightsRules.ts` (3 to 40 nights, day numbers to 41; elegant evenings by length, packing counts, medicine supply days, mid-voyage nudges, clock-change nudges for any number of zones) with `nightsRules.test.ts` (6, 7, 8, 10, 14, 21 and 31 nights; Western Caribbean to Belize; transatlantic; Hawaii to Japan). Dress nights, the packing list, the ship packing screen, the planner and autopilot day pickers, the money plan and child story (first and last day, home port from the itinerary), the final-night checklist and every served-day validator (`feeds`, `pilot`, `memory`, `programServed`, `planPolish`) now use the sailing's length. Server: `Itinerary.MaxDay = 41` replaces the `1 to 8` request checks; the folio, today view and concierge `build_day` use the sailing's day count. **Not compiled or run: `dotnet` is not installed in this shell, so build the server before relying on it.**
- X0f leaves: authored events (`ProgramRules`, `ShowRules`, photo spots, laundry-free dining nights) are still the week's, so days past 8 list nothing; cabin categories and prices per ship, and `browse`-depth messages, move to X0g with the port content.
- **X0g part 1 done (2026-11-03):** `src/domain/portTier.ts` (`guideLevelOf` full/short/link, `portFacts`, `guidePickerPorts`, `shortSnapshot`), tested. The port guide, read-aloud and port snapshot screens now list the sailing's own ports and work for any port id: a port without authored knowledge shows the catalogue facts (country, currency, languages, landing) and a plain "not written yet" note, with no invented prices. **Not done:** authoring the Tier A guides and knowledge (still only Cozumel, Belize, Roatán), Tier B short guides, per-country entry rows, currency and tipping data beyond the three ports (`tippingNorm`), phrases per language, the port day pilot and ashore contacts for other ports, and the `content-verification.md` update. Spanish is not added (CLAUDE.md).
- **X0g part 2 done (2026-11-03):** the other 21 Tier A ports (all 25 now have a guide; 24 have knowledge, the home port Fort Lauderdale is guide-only) are authored in `PortsReference.cs` with excursions, fair prices, scams, phrases and a nut-allergy card in the port's language (es, fr, it, el, tr, da, ja; English ports have none), a walk, a day pass, family notes, vendors and souvenirs, plus coordinates and a tipping norm each. The served shape gains an optional `lang` on the knowledge and on each allergy card, and the guide screen uses it. `portGuidesAuthored.test.ts` reads the C# file and checks all of it. All content is unverified (see `content-verification.md`). **Still not done:** Tier B short guides, ashore contacts, the port day pilot and crowd feed for the new ports, and a native-speaker check of the phrases.
- **X0h done (2026-11-03):** per-country entry rows. `GET /reference/entry` now serves a row per ISO country code (36, every code the catalogue holds plus New Zealand) with `country`, `monthsUs`, `monthsOther`, `visaCheckOther`; the app resolves a stop's country from the catalogue port (older route ports map to US, MX, BZ, HN) and the passport-by-port card works for any sailing. `entryRows.test.ts` checks the served table covers every catalogue country. Values are unverified samples; no per-row official link or checked date yet.
- **X0i part 1 done (2026-11-03): the port day pilot for every port.** `PortPilot` shows on every port day (outings come from the port's guide, none when it has none); `planBFor` keeps the authored plan B for Cozumel, Belize and Roatán and builds one for every other port from that port's own walks and day passes (no invented places). `CrowdPort` is any port id and the server's `ShipFeedRules.ValidPort` accepts any catalogue port id (default comfort 8,000 guests and 3 ships). Ashore contacts stay on the three ports that have them. **Not compiled or run: `dotnet` is not installed here**, so build `server/` (changed: `ShipFeedRules.cs`, `ProviderTests.cs`). Still to do: Tier B short guides, then the entry-row links and dates.
- **X0j done (2026-11-03):** Tier B short guides for all 35 Tier B ports in `PortsReference.cs` (guide and coordinates only, empty `excursions`, no knowledge, so they show at the `short` level with no invented prices), checked by `portGuidesAuthored.test.ts`. Entry rows gain `source` (official https link) and `asOf` (date the sample was written, not verified): served by `ReferenceRules.cs`, read by `normalizeEntry` (a non-https link or a bad date is dropped), shown under each stop in the passport check. **Not compiled or run: `dotnet` is not installed here**, so build `server/` (changed: `ReferenceRules.cs`, `PortsReference.cs`). Still to do: verify the content, ashore contacts for the new ports.
- **Cleanup done (2026-11-03):** the quiz, port screen, carbon card, money plan, child story and starter screen follow the current sailing (`useSailing`). The `CRUISE` constant is gone; `shipOf` and `cruiseOf` answer with an empty summary before the catalogue arrives (no authored fallback), and the `SHIP` singleton is now `SUN_SHIP` (the served facts of the aboard-depth ship, used by its screen and the seed script). Home-port assumptions (`'fll'`) are gone from the plan, all-aboard, wrapped, memory book, day strip, trial day, sky, at-sea and passport screens (home port is the sailing's first port); the feed validators accept any catalogue port. The cruise and landing screens list the sailing's own ports. **The front end now sends `sailing` (an id) to every ship feed; the server's `departure` parameter is removed** (`ReferenceEndpoints.cs`, `ProviderTests.cs`; **not compiled or run: `dotnet` is not installed here**, so build `server/`). `/reference/ship` and `/reference/ports` stay because the app still reads them. Placeholder art ids: `src/domain/artIds.ts` (ship, region and Tier A postcard ids, tested against the seed). README, runbook and data-model docs updated; the stage matrix is unchanged. **Ceilings now:** `SHIP` 0, `CRUISE` 0, `REFERENCE_SAILING` 3 files / 8 hits (the placeholder sailing, demo state, account fallback), literal port ids 7 files / 35 hits (`sea` and `src/testing` not counted). Also done in this pass: `ROUTE`/`routePoints`/`mayTenderInstead` removed, `GUIDE_PORTS` gone (any port with knowledge is a guide port), the excursions screen lists the ports that have excursions, the clearance cards show only the sailing's own stops, the ship clock's `shipZone` is `home`/`other` (server `NavigationRules.cs`), and Belize's knowledge carries `lang: en`. **Not zero:** the remaining port ids are the authored Western Caribbean sample week of the aboard ship (demo stage ids, photo spots, port contacts, plan B, clearance rows, call-port phrases, scenarios); moving that to served data is later work.
- **X0l part 1 done (2026-11-03): the demo stage machine is generic.** `StageId` is now `booked | preCruise | checkIn | embarkation | seaDay | portDay | farewell | disembark | postCruise`; `stageStarts(sailing)` derives one stage per cruise day from the itinerary (a sea day, a port day, the last sea day before the final morning as `farewell`), so a sailing of any length works. `stageRank` makes sea and port days share a rank for `useReached`; `timeForStage(sailing, stage, nth)` jumps to the nth stage of a kind. Scenarios target `portDay` or `seaDay`; the persona seed keeps its own names (`cozumel`, `belize`, `roatan`, `seaDay2`) and maps them to the nth port or sea day of the sample week. Any catalogue port is a call port (stamps, pins, take-me-back; `takeMeBackFor` gives a plain English card for a port with no authored words). The contacts, plan B and take-me-back tables are keyed by plain port id. **Not done (still authored for the sample week, later work):** moving contacts, plan B, take-me-back words and clearance rows into served per-port data in `PortsReference.cs`, and the photo spots (`SPOTS`, also read by `PhotoRules.cs` and `ref.PhotoCatalogue`) deriving from the itinerary. Verified with test, lint, `tsc -b` and build; no server change this part.
- **X0l part 2 done (2026-11-03): per-port ashore content is served.** `GET /reference/ports` gains an optional `ashore` object keyed by port id (`PortsReference.cs`), each entry optional `contacts`, `planB`, `takeMeBack` and `clearance` (entry papers). The app's `PORT_CONTACTS`, `PLAN_B`, take-me-back words and `CLEARANCE` tables are now empty at start and filled by `applyAshore` in `portsServed.ts` (validated all or nothing; an older server with no `ashore` still reads). Authored values are the same sample ones (fll, Cozumel, Belize, Roatán), so more ports are now a server-data change only. Tests seed from `reference-fixture.json` (`ashore` added) and `portGuidesAuthored.test.ts` checks the C# file. Verified with test, lint, `tsc -b` and build. **Not compiled: `dotnet` is not installed here**, so build `server/` (changed: `PortsReference.cs`, data only). **Not done:** ashore rows for the other ports.
- **X0l part 3 done (2026-11-03): photo spots come from the sailing's days.** `PhotoRules.SpotsFor(timeline)` gives the gangway on day 1, portraits on each elegant evening (same rule as `elegantDays`), a spot on every port call (tender piers earlier) and the pool and dining room on every sea day; `PhotographersFor` does the same for the posted sessions. Photo ids carry the day and port. Schema: `ref.PhotoCatalogue` and `ref.PhotographerSlots` and the two foreign keys to them are dropped (idempotent, in `01-schema.sql`); the seed no longer writes them. The front end's `SPOTS`, `PHOTOGRAPHERS` and `photosFor` are gone (the screen only reads what the server serves). Tests: `ShipboardRulesTests` (7-night ids, 4/6/7/14 nights). Verified with test, lint, `tsc -b`, build, `db:seed:check`; **server not compiled by me, so build `server/`** and re-run `01-schema.sql` on a DB.
- **X0m done (2026-11-03): ashore rows for the other Tier A ports.** `PortsReference.cs` now serves `contacts`, four `planB` cards, `clearance` (entry papers) and `takeMeBack` for all 24 ports with knowledge (21 new, plus Cozumel, Belize, Roatán) and Fort Lauderdale's clearance. Plan B cards are built from each port's own walk and (for beach ports) day pass, with no invented places; take-me-back words are in the port's language (es, fr, it, el, tr, da, ja, en). The served-shape check now accepts any language code for take-me-back (it was `es` or `en`). Emergency numbers are the public ones for each country; consulate and agent numbers are fictional `555-01xx` samples like the existing ones. Everything is **unverified** (see `content-verification.md`). Tier B ports have no ashore rows (short guide only). `portGuidesAuthored.test.ts` checks coverage of every Tier A port. Verified with test, lint, `tsc -b` and build; **build `server/`** (data only, in `PortsReference.cs`).
- **X0n done (2026-11-03): the authored programme follows the sailing's own days.** New `DayKinds.cs` (server) and `src/domain/dayKinds.ts` (client), the same rule in both: an event says when it runs by kind of day (`embark`, `night`, `last`, `sea`, `seaMid`, `firstSea`, `port`, `portOdd`) instead of day numbers 1 to 8. `ProgramRules` and `ShowRules` (and the client's `program.ts`, `eventsOn`) use it, so a 3-night or a 31-night sailing lists events on every day; the sample week gives back exactly the old days (tested both sides). `ShipEvent.days` became `when` on the wire (`GET /reference/program`); the plan-change check no longer needs a day. Dinner nights are day 1 to the last night (`DiningRules.IsDinnerDay`, client `dinnerDays(days)`), the Future Cruise desk days are the sailing's sea days (`PostCruiseRules.DeskDays(timeline)`), `Shipboard.DayAt` clamps to the sailing's last day, and `TogglePlan` checks the day against the sailing. **Schema:** `ref.EventDays` and the foreign key from `dbo.PlanEvents` to it are dropped (idempotent in `01-schema.sql`; they only held the sample sailings' days, so plan events on a catalogue sailing could not be saved); the seed no longer writes them. New server tests: a 14-night and a 3-night sailing (`OnboardRulesTests`). **Not compiled or run here: `dotnet` is not installed; build `server/` and re-run `01-schema.sql`.** **Still the week's:** the bookable activity catalogue (`CatalogueRules.Items` and the client's `catalogue.ts` `days`: spa, fitness, faith, access showings), which has the same shape and can use the same day kinds; cabin categories and prices per ship; and `browse`-depth messages.
- **X0o done (2026-11-03): activities, rooms and browse-depth notes.** (1) **Activity catalogue** (`CatalogueRules.Items`, client `catalogue.ts`): `days` became `when` (day kinds, with two new kinds `portEven` and `friday`; the Shabbat service is now on the sailing's calendar Friday, which is day 6 of the sample week, not day 5). `CatalogueRules.Problem` takes the sailing's `Timeline`; the client's `selectionProblem(s, age, days, taken)` takes the sailing's days, `itemDays(item, days)` lists the days an item runs, and the item card and text-help screen use the sailing's own days. (2) **Cabin categories and prices per ship:** `FareBook` now knows each sailing's ship and every ship's categories (`ref.CabinCategories`), so `Pricing.Category`, `CategoriesOf`, `CheapestCategory`, `FareFor`, `Quote` and the "from" price work for a Sky or Sapphire sailing in that ship's own categories (a Sun category is refused on a Sky sailing and the other way round; a sailing is offered when it has a fare for any room type, not only `interior`). `RoomOptionDto` gains `name`, `suite`, `sizeSqFt`, `description`. New `GET /reference/sailings/{id}/rooms` gives any priced sailing's room types with sample fares, open for booking or not. Front end: `CategoryId` is a string; `src/domain/shipRooms.ts` (+ `useSailingRooms`, `useShipRooms`) loads a sailing's or a ship's rooms on demand; the sailing page lists the ship's room types with sample prices when it cannot be booked yet and uses them for the estimate when it can; the ship page lists a browse ship's rooms; the booking room step lists whatever the server sends. **Still Sun-only (later moved, see the trip cost note below):** the trip-cost, cabin chooser and decide screens, and cabin numbers/scores (the deck plan is Sun's). (3) **Browse-depth notes:** `aboardDepth.ts` lists the screens that need an `aboard` ship (deck plan, cabins, venues and dining, muster, order); `BrowseDepthNote` in the shell says plainly when the sailing's ship is `browse` and links to the ship page. Tests: `dayKinds`, `aboard`, `shipRooms`, `aboardDepth` (front end); `AboardRulesTests`, `NightsPricingTests` (server). **Not compiled or run here: `dotnet` is not installed; build `server/`** (changed: `DayKinds.cs`, `CatalogueRules.cs`, `FareBook.cs`, `Pricing.cs`, `DiscoverService.cs`, `ReferenceEndpoints.cs`, `BookingContracts.cs`, `DapperJourneyStores.cs`, `JourneyRecords.cs`, `AboardServices.cs`). No schema change in this part.

- **Leftover ceilings (2026-11-03):** literal port ids are now **0 files / 0 hits** (the ceiling in `singleRoute.test.ts` is lowered; the earlier 7 / 35 had already been moved to served data by X0l). `REFERENCE_SAILING` stays at 3 files / 8 hits: it is the placeholder object the served table fills in place (`sailings.ts`), the first-run demo state and the account fallback, which all need a sailing before the table arrives. `/reference/ship` and `/reference/ports` stay by decision: they are the served aboard-depth ship (categories, deck plan, muster) and port guides/knowledge/ashore rows, not a single-route leftover; the app reads them through `runtime/index.ts`. `docs/stage-menus-matrix.md` is regenerated from `STAGE_TABS` (Stanley names, Trip Diary `M42`, Remember now 50 screens).

- **Trip cost, cabin chooser and decide on the served sailings (2026-11-03):** the three sailing pickers now list every sailing with fares, of any ship (`pricedSailings()` in `shipCatalogue.ts`, from the catalogue entries' `fromCents`; the cabin chooser keeps to aboard-depth ships because the deck plan and cabin scores are Sun's). Prices work for any ship's room types: `fareFor`, `quote` and `bookingQuote` read the room the server served for the sailing (`GET /reference/sailings/{id}/rooms`, loaded by `useSailingRooms`) before the older Sun tables, and the nights come from the sailing (`nightsOf`) instead of a fixed 7, in `pricing`, `fares`, `tripCost` and `dream`. The room pickers use the sailing's own room types (`useRoomChoices`, moved out of `SailingScreen`), trip cost lists only the excursions at ports on the chosen sailing's days (`useDaysOf`), and the invitation text names the sailing's ship, length, home port and cruise (`inviteTrip`) instead of Sun Princess's week. Tests: `sailingFares.test.ts`. Still the older tables: `INTERIOR_FARE` fallback for Sun sailings before their rooms load, drinks/Wi-Fi/dining prices (`packages`, not per ship), and cabin numbers and scores (Sun's deck plan by design). Not run: `dotnet` (no server change).
