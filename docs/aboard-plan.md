# Phase AB: all three ships at `aboard` depth

Status: **Plan written 2026-11-03. AB1 to AB4 built (see the notes at the end); AB5 onwards not built.** Decision (owner): Sun Princess, Sky Princess and Sapphire Princess are supported equally, so all three are `aboard` depth. Follows `CLAUDE.md`: phases, each ending in a commit and a stop; verify with `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` (plus `api:check`, `db:check`, `db:seed:check` when the REST surface or schema changes); never run `dotnet test`; secrets out of git. `dotnet` is not installed in the working environment, so server changes are built by the owner.

## 1. What "aboard" needs, and where it is single-ship today

`ref.Ships.Depth` and the schema are already per ship (`ref.Decks`, `ref.Cabins`, `ref.MusterStations`, `ref.CabinCategories`, `ref.Venues`, `ref.MenuItems`, `ref.Excursions` all carry `ShipId`). The gap is that the **content is Sun's and mostly authored in code**, and the code reads it as if there were one ship.

| Part | Where it is single-ship now | Becomes |
|---|---|---|
| Deck plan: places, elevator banks, muster stations, accessibility notes, highlights | `ShipReference.cs` (one JSON), `GET /reference/ship`, client `deck.ts` + `shipServed.ts` (`replaceDeck`, `replaceShip`), 12 screens and domain files read `PLACES`, `ELEVATORS`, `MUSTER_STATIONS`, `placeById` | Per-ship plans authored in `AboardPlans.cs` (the same way Sun's is in `ShipReference.cs`; moving them to tables is optional later), `GET /reference/ships/{id}/aboard`, client store keyed by ship id, read through the focused sailing's ship |
| Muster | `ProgramRules.MusterStations` + `PlaceNames` (A to F, Sun's rooms), `OnboardService` | Per ship, from the same rows |
| Cabins by number, positions, sun side, cabin scores | `CabinRules.Decks` (Sun's six category ids and decks), used in 11 places (`CabinGuideRules`, `BoardingRules`, `AheadService`, `BookingService`, `DiscoverService`, ...) | Generated from `ref.Cabins` per ship and the ship's own categories (`sky-balcony`, ...) |
| Venues, dining, menus, room-service order | `DiningRules.Venues`, `ref.MenuItems` filtered to Sun, client `dining.ts`, `menus.ts`, `orders.ts` | Per-ship venues and menus read by the sailing's ship |
| Programme and shows | `ProgramRules.Events`, `ShowRules`, `ref.Events` (no `ShipId`), client `program.ts` | `ShipId` on events; each ship its own theatre, pool and show names |
| Ship feeds that name rooms (loungers, pulse, queues, lost property places) | Hard-coded place ids such as `lido-pool`, `eatery`, `guest-services` | Ids that exist on every ship, or per-ship lookups |
| Screens that gate on depth | `aboardDepth.ts`, `BrowseDepthNote` | Stay as a safety net; no ship is `browse` once AB6 is done |

## 2. Content rule

Sky and Sapphire content is **concept sample data, in the same honest way as Sun's** (`content-verification.md`): plausible decks, places, venues and cabins in the right classes (Sky is Royal class, Sapphire is Gem class), clearly marked unverified, never presented as the real deck plan. Where the real ship has a well-known feature (Sky's SeaWalk, Sapphire's Movies Under the Stars) the sample may use it; numbers (cabin counts, positions) are generated, not claimed. Each ship gets a `dataStatus: sample` until someone verifies it.

## 3. Phases

**AB1: Ship-keyed deck plan (server and client).** Author Sky and Sapphire plans in code (about 30 places each, six elevator banks, six muster stations; Sun's stays in `ShipReference.cs`); `GET /reference/ships/{id}/aboard`; client keeps one deck plan per ship and `PLACES`, `ELEVATORS`, `MUSTER_STATIONS`, `placeById` read the focused sailing's ship; single-ship test ceiling for them goes to zero. Done when the deck map, route finder, muster and boarding pass work for a Sky sailing with its own rooms.

**AB2: Cabins per ship.** `ref.Cabins` seeded for each ship (generated, deterministic); `CabinRules` reads them with the ship's categories; cabin guide, scores, sun side, accessible cabins and "cabin guide" feed take the sailing's ship; the cabin chooser offers every ship's priced sailings. Done when the chooser compares cabins on a Sapphire sailing.

**AB3: Venues, dining and menus per ship.** Venues and menu items for Sky and Sapphire; reservations, walk-in, dining times, room-service order and allergy matching read the sailing's ship.

**AB4: Programme, shows and activities per ship.** `ShipId` on `ref.Events`; Sky and Sapphire programmes and shows; the activity catalogue keeps its day kinds and names venues from the ship.

**AB5: Feeds and the remaining hard-coded places.** Pulse, loungers, lost property, queues, day plan and Stanley's place talk use ids from the ship; contacts and guest-services places per ship.

**AB6: Flip to `aboard`.** Set Sky and Sapphire to `aboard` in `db/seed/catalogue/ships.json`; run `catalogue:gen`; the "ship page" no longer lists them as browse; update `aboardDepth.ts` text, `catalogue-plan.md` section 5, the README, `stage-menus-matrix.md` and `content-verification.md`. Done when no screen shows a browse-depth note for any of the three ships.

Order matters: AB1 and AB2 first (they unblock the most screens), the flip last so no screen ever promises what the data lacks. Each phase is one commit.

## 4. Risks

| Risk | Handling |
|---|---|
| Authoring two more ships is a lot of sample content | Generate from small per-class templates plus a short hand-written list of signature places; label as sample |
| Single-ship ids hidden in rules (`lido-pool`, `eatery`) | A test lists the place ids every ship must have; AB5 removes the rest |
| Server changes cannot be compiled here | Each phase lists the files changed; the owner builds `server/` and re-runs `01-schema.sql` and the seeds |
| Real Sky and Sapphire layouts differ from the sample | Marked `sample`; a verified deck plan replaces the rows with no code change |

## 5. AB1 done (2026-11-03)

- **Server:** `AboardPlans.cs` holds each ship's deck plan: Sun's from `ShipReference`, Sky Princess (Royal class, decks 4 to 18) and Sapphire Princess (Gem class, decks 4 to 13) as **concept samples**. `GET /reference/ships/{id}/aboard` serves one (404 for a ship with no plan). Every ship keeps the place ids other content names (`AboardPlans.CoreIds`), each with its own name and deck. The muster view and the emergency card read the booking's ship (`AboardPlans.ShipOfSailing`, `Station`, `StationByLabel`, `PlaceName`), and the emergency card places the Medical Center and Guest Services on that ship's own deck (`AboardRules.ContactsOn`). New tests: `AboardPlansTests`. **Not compiled or run here: `dotnet` is not installed; build `server/`** (changed: `AboardPlans.cs`, `FareBook.cs`, `AboardRules.cs`, `OnboardService.cs`, `ReferenceEndpoints.cs`, `SwaggerCoverageTests.cs`, `AboardPlansTests.cs`). No schema change.
- **Front end:** `src/domain/aboardPlans.ts` keeps a plan per ship and `activateDeck(shipId)` puts that ship's plan where the screens already read it (`PLACES`, `ELEVATORS`, `MUSTER_STATIONS`, `DECKS` in `deck.ts`), so the 20-odd readers did not change. `useActiveDeck()` (called by the `Shell`) follows the focused sailing's ship, asks for the plan when it is not kept, and the runtime keeps each answer on the device (kind `aboard`) for offline use. The deck map, route finder, deck plan and text-help screens redraw when the plan changes. Sun's plan still arrives with `/reference/ship` and is kept as its plan. Tests: `aboardPlans.test.ts`.
- **Still Sun's until AB3 to AB5:** venues, menus and the programme name Sun's places (`arena`, `dome`, `eclipse` and so on), which a Sky or Sapphire plan does not have. The depth stays `browse` until AB6.

## 6. AB2 done (2026-11-03)

- **Server:** `CabinRules` now has a layout per ship (`ShipCabinProfile`: decks per room class, the pool deck, the lifeboat deck) for Sun, Sky and Sapphire; `CabinsFor(sailingId, ...)` takes the ship from the sailing, and `CabinsOn(shipId, ...)` from the ship. A ship's own category ids (`sky-balcony`, `sapphire-minisuite`) map to the room class (`ClassOf`); Sun's numbers are unchanged. Numbers stay unique per ship (Sapphire's mini-suite has its own salt). The cabin guide scores read the ship's profile (bow thrusters, galley, pool noise); the Dome note stays Sun's. `CabinGuideRules.ValidCategory` accepts any catalogue category, and the accessible-room list includes the other ships' categories. Tests: `CabinsPerShipTests` in `AboardPlansTests.cs`. **Not compiled or run here (`dotnet` is not installed): build `server/`.**
- **Seed:** `catalogue.sql` now also seeds `ref.Decks`, `ref.MusterStations` (`sky-station-a` ...) and `ref.Cabins` (54 per ship) for Sky and Sapphire, generated by `scripts/ship-cabin-rows.ts` from the same generator the server mirrors. Re-run the catalogue seed.
- **Front end:** `cabins.ts` has the same per-ship layouts (`cabinsFor(sailingId, category, shipId)`, `classOf`, `ownCategoryId`); `findCabin` searches every ship. The cabin chooser offers every priced sailing and that ship's own room types (the room choice carries across ships by class). Tests: `cabins.test.ts`.
- **Left for later:** the comparison table's size and view rows show a dash for Sky and Sapphire rooms until their category features are served (AB6 or earlier).

## 7. AB3 done (2026-11-03)

- **Data:** `scripts/ship-venue-data.ts` is the one authored copy of Sky's and Sapphire's dining (concept samples): two main rooms each (Allegro and Concerto; Santa Fe and Vivaldi), Crown Grill, Sabatini's, Alfredo's, the buffet, the pool grill and the café, with dishes tagged for allergens and diets, plus a room-service menu (Sun's items under the ship's own ids, plus one dish of its own). `npm run shipvenues:gen` writes `server/Princess.Api/Content/ship-venues.json` (embedded); `npm run catalogue:gen` seeds the same rows into `ref.Venues`, `ref.MenuItems` and `ref.MenuExtras`. Venue and item ids are prefixed with the ship (`sky-crown`, `sky-cheeseburger`) because they are primary keys; a directory entry's `placeId` is still the deck-plan place (`crown`).
- **Server:** `ShipDining.cs` serves each ship's dining (`GET /reference/ships/{id}/venues`; Sun's from `DiningRules`, `OrderRules` and the served content) and answers per ship: `VenueOn` (a booking reserves only its own ship's rooms: slots, reserve, move, waitlist), `QueueOf` (walk-in queues from the ship's own walk-in rooms), `MenuFor(kind, shipId)`, delivery zones, and the `orderStock` scenario's item ids. The concierge's restaurant list follows the booking's ship. Tests: `ShipDiningTests`. **Not compiled or run here (`dotnet` is not installed): build `server/`.** Changed: `ShipDining.cs`, `ContentReference.cs`, `DiningRules.cs`, `OrderRules.cs`, `WaitRules.cs`, `ConciergeRules.cs`, `OrderService.cs`, `PlanService.cs`, `WaitService.cs`, `ReferenceEndpoints.cs`, `Princess.Api.csproj`, `SwaggerCoverageTests.cs`.
- **Front end:** `shipVenues.ts` keeps each ship's set and `activateVenues(shipId)` puts it where the screens already read it (`VENUES`, `DIRECTORY`, `MENU`, `DELIVERY_ZONES`), so allergy matching, the venue directory, reservations and the order screen did not change. `useActiveDeck()` follows the focused sailing; the runtime keeps each answer on the device (kind `venues`); the Sun lists that arrive later with the catalogue or content do not overwrite another ship's. Tests: `shipVenues.test.ts`.
- **Still Sun's until AB4 and AB5:** `seaDelights.ts` (`FIXED_MENU` names `eatery`, `lido` and so on) and the pulse and queue feeds name Sun's venue ids; the programme names Sun's rooms. Re-run `db/01-schema.sql` is not needed (no schema change); re-run the catalogue seed.


## 8. AB4 done (2026-11-03)

- **Data:** `scripts/ship-programme-data.ts` is the one authored copy of Sky's and Sapphire's programme (concept samples): Sun's programme with each ship's own rooms (Princess Theater for the main shows, Explorers Lounge for trivia, bingo and jazz, Movies Under the Stars, the SeaWalk or the Sea View Bar in place of the Dome). Event ids are the same on every ship; the Dome events become `late-show` (ticketed) and `late-dj`. `npm run shipprogrammes:gen` writes `server/Princess.Api/Content/ship-programmes.json` (embedded); `npm run catalogue:gen` seeds the same rows into `ref.Events` with `ShipId` (row ids prefixed `sky-`, `sapphire-`; Deck left null, since those decks are authored in `AboardPlans.cs`).
- **Server:** `ShipPrograms.cs` holds each ship's events (Sun's from `ProgramRules.Events`). `ProgramRules.On`, `ById` and `Reference`, `ShowRules.On` and `Find`, `DayPlanRules.Build` and `Plan` and `AutopilotRules.OptimiseWeek` take an optional ship id, and the programme, plan toggle, show seats and tickets, day plan and week plan read the booking's ship. Ticketed capacities are by event id (`ShowRules`), the ship's programme says which it runs. `GET /reference/ships/{id}/program` serves one (404 for a ship with none). Tests: `ShipProgramTests`. **Not compiled or run here (`dotnet` is not installed): build `server/`.** Changed: `ShipPrograms.cs`, `ProgramRules.cs`, `ShowRules.cs`, `DayPlanRules.cs`, `AutopilotRules.cs`, `OnboardService.cs`, `WaitService.cs`, `AutopilotService.cs`, `ReferenceEndpoints.cs`, `ShipDining.cs` (a build fix), `Princess.Api.csproj`, `SwaggerCoverageTests.cs`, `ShipProgramTests.cs`.
- **Front end:** `programServed.ts` keeps a programme per ship and `activateProgram(shipId)` puts it where the screens already read it (`EVENTS`, `PLAN_CHANGES`); the Sun programme that arrives with the reference tables is kept as Sun's and does not replace another ship's in use. `useActiveDeck()` follows the focused sailing; the runtime keeps each answer on the device (kind `programme`). `late-show` is in `TICKETED`. Tests: `programServed.test.ts`.
- **Still Sun's until AB5:** the day plan's dinner (`eclipse`), `seaDelights.ts`, and the pulse and queue feeds. Re-run the catalogue seed; no schema change.
