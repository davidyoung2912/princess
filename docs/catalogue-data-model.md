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

## Endpoint contract (built in X0c)

`GET /reference/catalogue/{ships,regions,ports,patterns}`, `GET /reference/catalogue/ships/{id}`, extended `GET /reference/sailings` (filters `ship`, `region`, `from`, `to`, `nightsMin`, `nightsMax`, `port`), `GET /reference/sailings/{id}/itinerary`. Feeds take `sailing` (an id) instead of `departure`. Full table in `catalogue-plan.md` section 6.

## Migration notes

1. X0b (done) adds the tables and columns to `db/01-schema.sql` (which is not an upgrade script: reset the database with `db/00-drop-all.sql`, then run the schema and seeds). `ShipId` on venues, menu items, events, excursions and categories is `NOT NULL DEFAULT 'sun-princess'`, so the existing seeds backfill themselves.
2. `/reference/ship`, `/reference/ports` and the `departure` feed parameter stay until X0h.
3. Demo personas keep their sailing ids.

## What X0b seeded

- 9 regions, 3 ships (Sun `aboard`, Sky and Sapphire `browse`), 99 ports (25 tier A), 32 itinerary patterns, 68 sample 2027 sailings (all `DataStatus = sample`), fares for each ship, and sample stateroom categories for Sky and Sapphire.
- Each sailing is materialised into `ref.Sailings`, `ref.ItineraryDays`, `ref.SailingLegs`, `ref.DressNights` and `ref.SailingFares` by `scripts/catalogue.ts` (`materialiseSailing`). Joined legs share their turnaround day. Ship clock changes are worked out from the real zone offsets on each date (so a March sailing sees US daylight saving).
- `ref.Sailings.BookingOpen` is 0 for the catalogue sailings and `Pricing.HasPrice` is false for them, so Discover and booking do not offer them until X0c.
- **The 12 seeded Sun Princess sailings stay as they are** (ids `sun-yyyy-mm-dd`, Western A route) and are backfilled to pattern `carib-west-a`, region `caribbean`, one leg. The catalogue leaves out the 7-night sailings on 17 Jan, 7 Feb, 28 Feb and 21 Mar 2027, which clash with them (the research shows different routes on three of those dates; X0h reconciles). The 14-night sailings on those dates are in the catalogue.
- The old unique index on `(ShipId, Departure)` is now `(ShipId, Departure, Nights)`, because one departure is sold as 7, 14 and 21 nights. Feeds that take only a `departure` date are ambiguous for those dates until X0c switches them to `sailing`.
- The 12 seeded sailings have no `ref.SailingFares` or `ref.DressNights` rows yet; X0c moves `Pricing` onto the table and backfills them.
- Port `GuideStatus` follows the tier at seed time (A `full`, B `short`, C `link`) although only the existing five ports have guides in the app today. X0g writes the content.

## Guard rail

`src/domain/singleRoute.test.ts` counts single-route references in non-test source and fails if a count rises. Baseline (2026-11-03):

| Reference | Files | Hits |
|---|---|---|
| `SHIP` | 13 | 48 |
| `CRUISE` | 5 | 19 |
| `REFERENCE_SAILING` | 7 | 20 |
| `SHIP_HOME_ZONE` | 3 | 15 |
| `SHIP_WEST_ZONE` | 1 | 4 |
| literal port ids (`cozumel`, `belize`, `roatan`, `fll`, `sea`) | 63 | 227 |

Lower the ceilings in the test as each phase removes references; X0h sets them to zero. Never raise one.
