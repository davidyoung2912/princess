# Catalogue data model and contract (X0a, X0b)

Companion to `docs/catalogue-plan.md`. This is the contract the later X0 phases build to. X0b added the tables and the seed; no endpoint or screen reads them yet, so behaviour has not changed.

## Source of truth

`db/seed/catalogue/*.json` is edited and reviewed by people. `npm run catalogue:gen` validates it (`scripts/catalogue.ts`) and writes `db/seed/catalogue/generated/catalogue.sql`; `npm run catalogue:check` fails if the JSON is inconsistent or the SQL is stale. The generated file is loaded last by `db/seed/reference/run-all.sql`: it needs the ships, ports, categories and sailings the other seeds create, and only fills the catalogue columns on them.

| File | Row type | Key rules |
|---|---|---|
| `regions.json` | `CatalogueRegion` | slug ids |
| `ships.json` | `CatalogueShip` | `depth` is `browse` or `aboard`; Sun Princess is `aboard` |
| `ports.json` | `CataloguePort` | region exists; two-capital country code; coordinates in range; `tier` A, B or C |
| `patterns.json` | `CataloguePattern` | `days.length === nights + 1`; days consecutive from 1; ports exist or `sea` |
| `sailings-2027.json` | `CatalogueSailing` | ordered `legs` of pattern ids; one sailing per ship per departure date; `dataStatus` served, sample or verified |
| `categories.json` | `CatalogueCategory` | stateroom categories for the browse ships (Sun Princess keeps the six in `01-ship.sql`) |
| `fares.json` | `CatalogueFare` | positive whole cents per person per night, per ship and an existing category |

## Ids

Existing sailing and port ids stay stable. New sailings: `<ship>-<yyyy-mm-dd>-<nights>`. Ports: lower-case slugs. Patterns: `<region>-<name>`.

## Endpoint contract (read endpoints built in X0c; see "Left for X0d onward")

`GET /reference/catalogue/{ships,regions,ports,patterns}`, `GET /reference/catalogue/ships/{id}`, extended `GET /reference/sailings` (filters `ship`, `region`, `from`, `to`, `nightsMin`, `nightsMax`, `port`), `GET /reference/sailings/{id}/itinerary`. Feeds take `sailing` (an id) instead of `departure`. Full table in `catalogue-plan.md` section 6.

### What X0c built

- `ICatalogueStore` (`Data/CatalogueStore.cs`) reads the catalogue tables once and holds them ten minutes; `Domain/ShipCatalogueRules.cs` shapes them (pure, tested in `ShipCatalogueRulesTests`, compiled only).
- The five `/reference/catalogue/*` reads, `GET /reference/sailings/{id}/itinerary`, and `entries` plus the seven filters on `GET /reference/sailings`. `entries[].fromCents` is the cheapest fare times the nights, per person, before taxes. The older fields of `/reference/sailings` are unchanged.
- The `/feeds/*` that took `departure` (route, pulse, pulse-day, storm, sky-night, ship-position, sea-conditions, along-the-way) take `sailing` (an id) and no longer accept `departure` (removed in the cleanup phase); a missing or unknown sailing is `badFeedQuery`.

### Price and length from data (X0c, second half)

- `Domain/FareBook.cs` holds each sailing's nights, booking state and per-night fares, set from `ref.Sailings` and `ref.SailingFares` whenever the sailings are loaded. `Pricing.NightsOf(sailing)` and `Pricing.FareFor` use it for any sailing not in the older code tables (fare = per-night cents times the nights); `HasPrice` is true for an open sailing that has an interior fare. Quotes, gratuities, the package line and the from-price follow the sailing's nights.
- `Scope.Nights` and `LastDay` (and the same on the plan context) come from the booking's sailing row. Dining and plan "closed" checks, aboard windows, trip-over time, gratuities due and charged, package units and upgrade cost use them instead of a fixed seven. Rules keep a default of 7 for callers with no sailing.
- Tests: `NightsPricingTests` (3, 6, 14 and 31 nights, an older sailing, a closed sailing). Compiled only.
- The 12 older Sun Princess sailings keep the code fare tables, because their whole-dollar room-type prices do not divide into whole per-night cents. X0h reconciles them and removes the tables. Catalogue sailings stay closed (`BookingOpen = 0`) until a person opens them in data.

### Itinerary from the day rows (X0c, last part)

- `Domain/Timeline.cs`: a `Timeline` is one sailing's days plus everything worked out from them (`PortAt`, `AtSea`, `Aboard`, `AllAboardAt`, `ShipZoneAt`, `ShipZoneOnDate`, `ClockChanges`, `IsCall`, `LastDay`, `HomeZone`, `FinalZone`). `TimelineBook` holds the day rows and ports of every sailing, set whenever the sailings load (like `FareBook`), and `TimelineBook.For(sailingId, departure)` returns the sailing's timeline, or the older Western A route when the sailing has no rows.
- The ship's clock follows the day rows' `ClockChangeHours` (at 02:00 unless the row says otherwise). The new zone is the home zone or a port zone on the route with the matching offset on that date, otherwise a fixed `Etc/GMT` zone.
- Rules and services that used `Itinerary.Days(departure)` and friends now take a `Timeline` (a `Scope` and the plan context carry one). `Itinerary` keeps the old departure-only API as `Timeline.Legacy(departure)`, and `DateOnly` converts to a `Timeline` implicitly, so callers with only a date (tests) still get the old route. Ports come from `Itinerary.PortOf` (catalogue first, then the four older ports).
- First and last days are the embarkation and disembarkation days (replacing the `"fll"` checks); the disembarkation, photo, post-cruise and folio rules count from the last day rather than day 8.
- The ship-position, sea-conditions and along-the-way feeds use the authored tracks where a leg follows one, and a straight line between the ports otherwise (landmarks only where they lie within reach). The pulse, sky-night, position, sea and along feeds take the sailing's timeline; the route, storm and the other feeds still work from the date.
- Tests: `TimelineTests` (the day-row timeline matches the built-in route on three dates including daylight-saving weeks; a four-night Mediterranean sailing; a clock change between zones; no rows). Compiled only.

### Left for X0d onward (not done in X0c)

- Day numbers are still capped at 8 in request checks (`Day is < 1 or > 8`), the packing, laundry and plan screens assume a week, and `PhotoService` clamps the cruise day to 8. Planning for 3 to 40 days is X0f.
- Authored content is still the Western A route's: excursions (Cozumel, Belize, Roatan), port crowd comfort figures, photo spots, concierge port list, the along-the-way landmarks, the storm outlook, and the weather coordinates. Port content for the rest is X0g.
- The `departure` feed parameter is gone. `/reference/ship` and `/reference/ports` stay: they still serve the aboard ship's categories, deck plan and the port guides the app reads. The ship clock's `shipZone` is `"home"` or `"other"` (the sailing's home zone or the zone after a clock change).

## Migration notes

1. X0b (done) adds the tables and columns to `db/01-schema.sql` (which is not an upgrade script: reset the database with `db/00-drop-all.sql`, then run the schema and seeds). `ShipId` on venues, menu items, events, excursions and categories is `NOT NULL DEFAULT 'sun-princess'`, so the existing seeds backfill themselves.
2. `/reference/ship` and `/reference/ports` stay (see above); the `departure` feed parameter is removed.
3. Demo personas keep their sailing ids.

## What X0b seeded

- 9 regions, 3 ships (all `aboard` since AB6; Sky and Sapphire are concept samples), 99 ports (25 tier A), 32 itinerary patterns, 68 sample 2027 sailings (all `DataStatus = sample`), fares for each ship, and sample stateroom categories for Sky and Sapphire.
- Each sailing is materialised into `ref.Sailings`, `ref.ItineraryDays`, `ref.SailingLegs`, `ref.DressNights` and `ref.SailingFares` by `scripts/catalogue.ts` (`materialiseSailing`). Joined legs share their turnaround day. Ship clock changes are worked out from the real zone offsets on each date (so a March sailing sees US daylight saving).
- `ref.Sailings.BookingOpen` is 0 for the catalogue sailings and `Pricing.HasPrice` is false for them, so Discover and booking do not offer them until X0c.
- **The 12 seeded Sun Princess sailings stay as they are** (ids `sun-yyyy-mm-dd`, Western A route) and are backfilled to pattern `carib-west-a`, region `caribbean`, one leg. The catalogue leaves out the 7-night sailings on 17 Jan, 7 Feb, 28 Feb and 21 Mar 2027, which clash with them (the research shows different routes on three of those dates; X0h reconciles). The 14-night sailings on those dates are in the catalogue.
- The old unique index on `(ShipId, Departure)` is now `(ShipId, Departure, Nights)`, because one departure is sold as 7, 14 and 21 nights. The feeds now take `sailing`, so those dates are no longer ambiguous.
- The 12 seeded sailings have no `ref.SailingFares` or `ref.DressNights` rows yet; X0c moves `Pricing` onto the table and backfills them.
- Port `GuideStatus` follows the tier at seed time (A `full`, B `short`, C `link`) although only the existing five ports have guides in the app today. X0g writes the content.

### Front end (X0d)

- `src/domain/shipCatalogue.ts` holds the served catalogue: `catalogueShips`, `catalogueRegions`, `cataloguePatterns`, `catalogueSailings` (the `entries` of `/reference/sailings`), ports in `CATALOGUE_PORTS` (read with `portById`), and each sailing's days on demand (`loadItinerary`, `GET /reference/sailings/{id}/itinerary`, kept on the device after the first answer). `shipOf(sailingId)` and `cruiseOf(sailingId)` answer for any sailing and fall back to the older `SHIP` and `CRUISE` until the catalogue arrives. Hooks: `useShip`, `useCruise`, `useItinerary`.
- Each itinerary day carries `shipZone`, the zone the ship's clocks follow that day (the server works it out from the day rows); a change of zone between days is a clock change at 02:00. The legacy sailings template carries it too.
- Not done in X0d: the stage list (`StageId`, `stageStarts`) is still the eight-day route's; `itinerary(sailing)` returns the older template for a sailing whose days are not loaded; port guides, crowd, plan-B and excursions exist only for Cozumel, Belize and Roatán. The old constants remain as adapters (`SHIP`, `CRUISE`, `REFERENCE_SAILING`) for screens not yet moved (X0e).

### Front end (X0e)

- Pure rules in `src/domain/catalogueBrowse.ts` (filter, sort, group by month, leg badges, sailing and ship comparison, region by month grid, the quiz match, route sketch), tested in `catalogueBrowse.test.ts`. Before the catalogue arrives the older sailings stand in.
- Screens: H07 browse (filters kept in the address), H08 per sailing (price estimate only when the sailing can be booked), H06 itinerary page (`?sailing=`), H10 any ship (`/home/ships/:id`, `/home/ship` for the current one), new H47 ships, H48 compare ships, H50 explore by region and month, H51 compare saved sailings; the quiz also picks sailings by region, month and length. Saved items accept catalogue sailings, ports and ships.
- English only (CLAUDE.md): no Spanish strings for X0e; the two tests that required Spanish page titles and keys are skipped.
- Not done: H09 port pages and the aboard-stage screens still read the older route's ports (X0f, X0g); the booking sailing step still lists the older sailings.

## Guard rail

`src/domain/singleRoute.test.ts` counts single-route references in non-test source and fails if a count rises. Baseline (2026-11-03), with the ceilings after X0d and after the cleanup phase in the last columns:

| Reference | Files | Hits | After X0d (files / hits) | After cleanup (files / hits) |
|---|---|---|---|---|
| `SHIP` | 13 | 48 | 6 / 27 | 0 / 0 |
| `CRUISE` | 5 | 19 | 2 / 4 | 0 / 0 |
| `REFERENCE_SAILING` | 7 | 20 | 7 / 20 | 3 / 8 (the placeholder sailing, the demo state and the account fallback) |
| `SHIP_HOME_ZONE` | 3 | 15 | 0 / 0 | 0 / 0 |
| `SHIP_WEST_ZONE` | 1 | 4 | 0 / 0 | 0 / 0 |
| literal port ids (`cozumel`, `belize`, `roatan`, `fll`, `sea`) | 63 | 227 | 63 / 219 | 7 / 35 (`sea` is not counted, nor is `src/testing`) |

Lower the ceilings in the test as each phase removes references; The `SHIP` constant is now `SUN_SHIP`, the served facts of Sun Princess (not a singleton for the whole app). What remains of the literal port ids is the authored Western Caribbean sample week of that ship (demo stage ids, photo spots, port contacts, plan B, clearance rows, call-port phrases, scenarios); moving it to served data is later work. Never raise a ceiling.
