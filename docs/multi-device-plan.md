# Multi-device plan: account data lives on the server

Status: **Plan written 2026-11-01. Phases 1 to 3 built; Phase 4 partly built; Phase 5 built as far as it usefully goes (slices 1 to 6: rates, access reference, sky feed, flight feed, route conditions, demo state); the rest is parked, see the Phase 5 decision.** Companion to `docs/backend-plan.md` and `docs/backend-data-model.md`.

## Goal and rules

A guest must be able to move between phone and desktop and find all account data where they left it. Apart from data that depends on an external source (weather, ship telemetry, flight feeds, card charging, the AI concierge), nothing account-critical may live only on one device. The front end must not use mocked data that should come from our backend.

- Display-only preferences stay per device by design: theme, contrast, text size, reduce motion, data-light.
- Both modes keep working: with `VITE_API_URL` set the stores sync to the server; without it they stay on the device (mock mode).
- Verify with `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`, plus `npm run api:check` and the schema checker when the REST surface or schema changes. No browser testing, no `dotnet test`.
- Build in phases. Stop after each so the user can `/clear`. Commit only when asked.

## Finding (audit, 2026-11-01)

Nothing under `server/`, `db/` or `src/api/` has changed since Phase G6 (`491bc9e`). Phases H1 to H8 kept all new state on the device, as their plans said. Every `Api` group is REST-backed; the gap is the state that never goes through `Api`.

### Device-only stores today

| Store (`princess:<kind>:<id>`) | Holds | Scope | Sensitivity | Target | Phase |
| --- | --- | --- | --- | --- | --- |
| `settings` (account-level fields) | `simple`, `calm`, `captions`, `units`, `region`, `chargeCheck`, `nudgesPerDay` | user | low | `UserState` key `settings` | 1 |
| `offers` | dismissed offers per booking, marketing-sent times | user | low (compliance: weekly cap) | `UserState` `offers`; cap moves server-side in Phase 4 | 1 |
| `shop` | delivery and gift choices | user | low | `UserState` `shop` | 1 |
| `phone` | phone-setup ticks | user | low | `UserState` `phone` | 1 |
| `memory` | medical card, access profile, allergy flag, hold, shares, journal, reflections, contacts and blocks, away checklist, pasted lines, and the nested `planning`, `aboard`, `finish` | user | **high** (medical, allergy, child brief) | `UserState` `memory`; medical card, access and allergy get dedicated storage in Phase 4 | 2 (4) |
| `pilot` | plan changes and log, slot watches, week prefs, calm profile, caregiver, kit request | user | medium | `UserState` `pilot`; accepted changes merge into the server day plan in Phase 4 | 3 (4) |
| `trip` | door-to-ship plan, packing ticks, bag log, embarkation plan | user | low | `UserState` `trip` (check overlap with `PackingTicks`, `EmbarkProgress`) | 3 |
| `hub` | family contacts, links, postcards, delay, callback, debriefs | user | medium | `UserState` `hub`; links need signed server tokens and a public page in Phase 4 | 3 (4) |
| `port` | port-day presence, plan, plan B, rendezvous, split ledger | **booking** | medium | `BookingState` `port`; ledger becomes real rows in Phase 4 | 3 (4) |
| `party` | travel-party invites and shared notes | **booking** | medium | `BookingState` `party` | 3 |
| `rates` | last rate table | shared | none | `GET /rates` (built, Phase 5 slice 1) | 5 |
| Concierge history (IndexedDB) | chat thread | user | medium | decision: stays on device (SUP-03), say so on the screen | none |
| Demo clock and scenarios | offset, speed, scenarios | user (demo only) | none | `/demo/*` routes (documented in data model 6.7, never built) | 5 |

### Duplicates that must be reconciled (Phase 4)

- **Day plan.** The server owns `PlanEvents`, tours and dining; accepted Autopilot changes live only in `pilot`.
- **Budget.** Server `Budgets`, `memory.budget`, `planning.budget` and `planning.moneyDaily` are four places for one idea.
- **Quiet hours.** Server `NotificationPrefs.quiet` against the local do-not-disturb schedules and `nudgesPerDay`.
- **Dietary and needs.** `ProfileTags` against the local accessibility profile and allergy flag, so server-side dining and cabin logic cannot see them.
- **Marketing cap.** Counted from `offers.sent` on the device; two devices get two caps.
- **Embark ticks.** `trip.carryOn`/`checked` against `boarding.setCarryOn`/`setBags` (check).

### Cannot work without a server

Family-at-home links (signed with a per-device secret, so they open only on the device that made them), shared port ledger and presence, party notes, caregiver "I'm OK", callbacks, the sensory-kit request.

### Mocked data that should come from the backend (Phase 5)

- Simulated feeds (`source: 'sim'`): flight status, weather and forecast, traffic, ship pulse and lines, port crowd, storm chance, sky. Route through the server's `IWeatherService` and `IShipTelemetry` stubs so every device sees the same values.
- `fareHistory` (price watch), `stubRates`, lounger board, found list, "you said, we did" board, sightings, guaranteed-cabin odds.
- Authored reference data held only in the client: `DIFFICULTY` (add columns to `ref.Excursions`), `hasAccessibleCabins` (against `CabinRules.cs`), port content, ship packing, dress nights, day stories.

## Design

### Generic document tables (Phase 1)

Precedent: `UserPrefs.Json`, `Budgets.Json`, `NotificationPrefs.Prefs`, `GameProgress`, `TvState`.

- `dbo.UserState (UserId, [Key], Json, CreatedAt, UpdatedAt, RowVersion)`, PK (`UserId`, `Key`), `ISJSON` check.
- `dbo.BookingState (BookingId, [Key], Json, ...)`, same shape, booking-scoped.
- Routes: `GET/PUT/DELETE /me/state/{key}`, `GET/PUT/DELETE /bookings/{number}/state/{key}`. `GET /me/state` lists every key with its version so a device can load in one call.
- Keys are a fixed whitelist per scope, each with a size cap (a key outside the list is `400 invalid`, an oversize body is `400 invalid`).
- Concurrency: each document has an integer `version` (starts at 1, +1 per save). `PUT` carries `{ data, baseVersion }` in the body (the HTTP wrapper has no header support, and the body is easier to test); a different current version is `409` (`stale`) and the client fetches the newer copy. On a clash this device's copy is sent on top of the newer version unless the store supplies a `merge`.
- Authorisation: `/me/state` is the signed-in person only (a supervised child's booker uses view-as, as everywhere else). Booking state needs booking membership, adult members write.
- Privacy: rows cascade on user and booking delete, are included in the privacy export, and the retention purge removes booking state with the booking.

### Client adapter (Phase 1)

One `syncedStore` module replaces the hand-rolled `load*/save*` pairs. A store keeps its `normalize*` function and its in-memory cache and subscribers; the adapter adds:

- **Device cache first** (localStorage as today) so screens paint at once and work offline.
- **Pull** after sign-in, when the tab is shown again and when the connection returns: fetch each key and replace the device copy when the server's is different.
- **Push** after each change (800 ms debounce). A change that cannot be sent stays marked and goes out on the next change or pull (the sync module keeps its own dirty flag; the mutation outbox is not used because these are whole documents, not commands).
- **First sign-in import:** if the server has no document for a key and the device has one, push the device copy once.
- Without `VITE_API_URL` the adapter is a no-op and behaviour is unchanged.
- "Wipe everything" clears the device cache only; "Delete my data" is the server's job (privacy routes).

### Dedicated tables and routes (Phase 4)

Family-link tokens (public, signed, expiring), medical card (encrypted, consent-gated), access profile and allergy into `Profiles`/`ProfileTags`, do-not-disturb into `NotificationPrefs`, one budget, split ledger and port presence as rows, accepted plan changes into the day plan, marketing cap, callbacks, `/demo/*`.

## Phases

1. **Foundation.** Tables, routes, in-memory test store, `syncedStore` adapter, privacy export/delete coverage, schema and API docs. Migrate `settings` (account-level fields), `offers`, `shop`, `phone`.
2. **Memory blob.** `memory` including `planning`, `aboard`, `finish` (high-sensitivity notice and consent copy first).
3. **Trip, pilot, hub, port, party.** The last two use booking scope.
4. **Dedicated tables and routes** from the list above, one sub-slice per item.
5. **Feeds and reference data.** Simulated feeds through server stubs, fare history, rates, difficulty columns, `/demo/*`.

Each phase ends with a "Not done" list here and the status header refreshed.

## Phase 1 record

Built 2026-11-01. Nothing committed yet.

- **Schema:** `dbo.UserState` and `dbo.BookingState` in `db/01-schema.sql`, named in data model section 4 and the routes in the new section 6.8 (`npm run db:check` passes; `npm run api:check` passes).
- **Server (not compiled or run; the project rule is no `dotnet test`, and I did not run `dotnet build` either):** `Domain/StateRules.cs` (key whitelist and size caps), `Data/StateStores.cs` and `DapperStateStore.cs`, `Services/StateService.cs`, `Endpoints/StateEndpoints.cs`, DTOs in `JourneyContracts.cs`, registration in `Program.cs`. Booking routes need membership to read and an adult member to write.
- **Server tests written, not run:** `StateTests.cs` (rules, two devices, stale version, bad key/body, delete, booking sharing and the child's read-only access), `Support/InMemoryState.cs`, wired into `ApiFactory`. **Run `dotnet build` and the `State*` tests once before relying on any of it.**
- **Client:** `src/sync/sync.ts` (framework-free manager: debounced push, pull at sign-in / tab shown / back online, version tracking, clash handling, one-time import of a known person's device copy), `httpRemote.ts`, `index.ts` (singleton, remote set only with `VITE_API_URL`), `bindings.ts` (settings, offers, shop, phone). Stores call `sync.changed(...)` after each update and expose `applyRemote*` to take a server copy without echoing it back. Wired in `src/runtime/index.ts`. Mock mode is unchanged (no remote, every call does nothing).
- **Account-level settings** (`simple`, `calm`, `captions`, `units`, `region`, `chargeCheck`, `nudgesPerDay`) sync; theme, contrast, text size, reduce motion and data-light stay per device (`SYNCED_FIELDS` in `settings.ts`).
- **Verified:** `npm run test` (1736 passed, including `src/sync/*.test.ts`), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run db:check`, `npm run api:check`.
- **Not done:**
  - **Sign-out flush.** Changes waiting at sign-out are not sent (the token is gone by then); a pending change is lost if the guest signs out inside the 800 ms pause or while offline.
  - **Accounts with no persona.** Stores key the device copy by persona id, so every account that is not one of the twelve shares the `''` copy. The sync module never uploads that shared copy and resets it on sign-in; the real fix is keying by user id.
  - **Booking-scope client** (`BookingState` routes exist and are tested; no client uses them until Phase 3).
  - **Privacy export, retention purge and "delete my data"** do not list the new tables yet (rows do cascade on user and booking delete). Needed before Phase 2 puts health data here.
  - **Sync indicator.** `sync.status()` exists; no screen shows it yet.
  - **Settings per user in REST mode** still use the persona key for the device copy.
  - **Swagger coverage list** (`SwaggerCoverageTests.Routes`) does not include the eight state routes; `ApiSurfaceTests` covers them from the data-model table.

## Phase 2 record

Built 2026-11-01.

- **Consent first.** New account-level setting `syncPrivate` (default off, synced with the other account settings). Privacy centre card "Private notes and health details" (REST mode only) explains what is kept, who can read it, that this version stores it with ordinary account data (not yet the separate encrypted store of Phase 4), and that turning it off deletes the account copy. `medical.intro` now says the card can follow the guest if they choose.
- **Memory binding.** `memory` (including `planning`, `aboard`, `finish`) syncs through `UserState` key `memory`, but only while `syncPrivate` is on. `Binding.enabled` gates push, pull and change tracking; with it off nothing is read from or sent to the server.
- **Turning on** (`src/sync/consent.ts`, `setKeepPrivate`) pulls: the account copy is taken if there is one, otherwise this device's copy is sent. **Turning off** calls `sync.withdraw('memory')`, which deletes the server copy (new `Remote.remove`, `DELETE /me/state/memory`) and retries at the next pull if offline. The device keeps its own copy.
- **New device:** `pull()` fetches the settings first, then looks again at keys that were gated, so a consent that arrived in the same pull enables `memory` at once.
- **Verified:** `npm run test` (1742 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`. No server code changed in this phase, so no schema or REST checks were needed.
- **Not done:**
  - **Privacy export and "delete my data".** The server has no export route or account-deletion route to extend; `UserState` rows cascade on user delete and the retention purge does not touch them. Both belong with the privacy work in Phase 4.
  - **Dedicated storage** for the medical card, access profile and allergy (encryption, server-side use) is still Phase 4. Until then they are plain JSON inside `memory`.
  - **Copy on other screens.** Many memory-backed screens still say "stays on this device" (kept so as not to claim more than is true in mock mode, and `h7Promises.test.ts` pins some of it). Only `medical.intro` and the privacy centre mention the account option.
  - **Carried over from Phase 1:** sign-out flush, accounts with no persona, sync indicator, per-user settings keys, Swagger coverage list.

## Phase 3 record

Built 2026-11-01.

- **User scope.** `trip`, `pilot` and `hub` sync through `UserState` like the Phase 1 stores (`updateX` calls `sync.changed`, new `applyRemoteX`; bindings in `src/sync/bindings.ts`). No consent switch: the plan puts them at low and medium sensitivity.
- **Booking scope.** `port` and `party` sync through `BookingState` (`/bookings/{number}/state/{key}`). New in `sync.ts`: `Binding.scope: 'booking'`, `Binding.localFor` (the stores are keyed by the booker, the sync owner is the signed-in persona, so `bookerOf` maps one to the other), optional `scope` argument on `Remote.get/put/remove`, and `Remote.bookingNumber()`. The number is the current trip (same rule as `httpApi.ts`: the `current` trip, else the first upcoming), looked up at each `pull()`; a new number starts those documents afresh, and a person with no trip keeps them on the device.
- **Two adults at once.** `src/sync/merges.ts`: party keeps every invitation and note from both sides; port keeps the later presence per person, both sides' meeting places, split families and expenses, and this device's plan and settings. A removal made on one side comes back after a clash (the cost of keeping both additions).
- **Children.** A supervised child can read the booking's documents but the server refuses their writes (`forbidden`); the sync module drops that change without an error and the next pull gives them the adults' copy.
- **Verified:** `npm run test` (1751 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`. No server code or schema changed, so no schema check, and nothing server-side was run.
- **Not done:**
  - **Calm profile and family contacts** (inside `pilot` and `hub`) are sensory and contact details sent without the Phase 2 consent switch. Decide whether to put them behind `syncPrivate` or leave as is.
  - **Port ledger and presence as real rows**, accepted plan changes merged into the day plan, signed family links and the caregiver, callback and sensory-kit requests reaching staff remain Phase 4: today they are documents only other devices of the same booking can read.
  - **Screen copy** that says "stays on this device" (trip, pilot, hub, port, party screens) is unchanged and `h7Promises.test.ts` still pins some of it.
  - **Embark ticks duplicate** (`trip.carryOn`/`checked` against `boarding.setCarryOn`/`setBags`) is still open for Phase 4.
  - **Server booking-state routes** are exercised only by the Phase 1 server tests (not run); nothing here has run against a real server.
  - **Carried over from Phase 1 and 2:** sign-out flush, accounts with no persona, sync indicator, per-user settings keys, Swagger coverage list, privacy export and deletion coverage.

## Phase 4 record (slice: privacy export and delete)

Built 2026-11-01. Only this slice of Phase 4 was built; the other items in "Dedicated tables and routes" are still open.

- **Server (not compiled or run; no `dotnet` commands per the project rules):** `GET /me/export` (the person's own documents, plus the documents of each booking they are a guest on or have linked) and `DELETE /me/state` (removes every document of their own). `IStateStore.DeleteAllAsync`, `StateService.ExportAsync/DeleteAllAsync`, DTOs `StateExportDto`/`BookingStateExportDto`, in-memory store and a test in `StateTests.cs` (written, not run). Data model section 6.8 lists both routes.
- **Not done:**
  - **Booking documents are not deleted** by "delete my data" (other guests share them) and the retention purge does not remove them. A retention kind for `BookingState` would change the rules mirrored in `src/domain/privacy.ts` and `dataRules.ts`, so it needs a decision first.
  - **No client screen** calls export or delete yet, and there is still no account-deletion route; export covers account state only, not the rest of the person's records.
  - **Swagger coverage list** now includes the two new routes (the eight older state routes are still covered only by `ApiSurfaceTests`).
  - **Remaining Phase 4 items:** dedicated medical/access/allergy storage, one budget, quiet hours, marketing cap, embark ticks, port ledger rows, plan changes into the day plan, signed family links, caregiver/callback/kit requests, `/demo/*`.

## Phase 4 record (slice 2: the rest that could be built here)

Built 2026-11-01.

- **Encrypted health document.** New user key `health` (medical card, access profile, allergy flag) split out of `memory`. The server stores it as `{"enc":...}` through Data Protection and refuses a save (`403`) unless the person's `settings` document has `syncPrivate` on; reads and the export decrypt it. Client: `memory` binding now carries everything except those three, a new `health` binding carries them, both held back by the same consent switch, and withdrawing deletes both copies. (Not compiled or run; test written in `StateTests.cs`.)
- **Booking state retention.** The retention purge deletes `BookingState` rows with the `message` kind (30 days after the cruise), in `DapperPrivacyStore.PurgeAsync`. No new retention rule, so the privacy centre and the client rule table are unchanged.
- **Marketing cap.** A clash on `offers` now merges: messages sent on any device count toward the one weekly cap, and dismissals from both stay (`mergeOffers`).
- **Dietary and needs.** The access profile and the account profile share four answers (mobility, hearing, vision, service animal). Changing one now sets the other (`needsWithAccess`, `accessWithNeeds`), so the server's profile tags, which dining and cabin rules read, match what the guest entered in the access profile.
- **Quiet hours.** The account's quiet hours (server `NotificationPrefs.quiet`) now hold notices back in the notifications list the same way a do-not-disturb schedule does (`withQuietHours`). The two settings are still separate screens.
- **Embark ticks.** A carry-on tick on the embark screen is written to the journey packing list, and a tick on the packing list is sent to the boarding record (best effort).
- **Verified:** `npm run test` (1754 passed), `npm run lint`, `npx tsc -b`, `npm run build`. Server changes are not compiled or run.
- **Not done, and why:**
  - **Budget.** Left as is. On inspection these are different ideas: the server `Budgets` is the aboard spending limit; `planning.budget` is the trip-price target; `memory.budget` is read only by the gift suggestions and nothing writes it; `planning.moneyDaily` is the daily money plan. Merging them needs a product decision on which are the same thing.
  - **Port ledger and presence as real rows, and accepted plan changes merged into the day plan.** Still documents (`port`, `pilot`). Rows need new tables, a settle-up flow and a server day-plan merge; not started.
  - **Signed family links and the public page.** Needs a token scheme, a public unauthenticated route and a page; not started.
  - **Caregiver, callback and sensory-kit requests reaching staff.** The callback queue is a simulation (`source: 'sim'`) and there is no staff side in this repo, so they stay documents.
  - **`/demo/*` routes** (data model 6.7): not started.
  - **Open from earlier phases:** sign-out flush, accounts with no persona, sync indicator, per-user settings keys, calm profile and family contacts consent decision, screen copy that says "stays on this device".

## Phase 5 record (slice 1: rates)

Built 2026-11-01. Only this slice of Phase 5 was built.

- **Server (not compiled or run; no `dotnet` commands per the project rules):** `Domain/RatesRules.cs` (the sample rates and a daily drift, with the same hash as the client's `stubRates`, so both sides give the same table), `Endpoints/ReferenceEndpoints.cs` (`GET /rates`, signed-in), registered in `Program.cs`. Tests written, not run: `RatesTests.cs`, and the route is in `SwaggerCoverageTests.Routes`. Data model section 6.9 lists the route.
- **Client:** `fetchRates` in `src/runtime/index.ts` (null in mock mode). `useRates` uses it for "Update rates" and refreshes an out-of-date table when a rates screen opens; if the server cannot be reached the saved table stays and is called out of date. Mock mode still uses the local stub.
- **Verified:** `npm run test` (1754 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`.
- **Not done (rest of Phase 5):**
  - **Simulated feeds** (flight status, weather and forecast, traffic, ship pulse and lines, port crowd, storm chance, sky). The server has no `IWeatherService` or `IShipTelemetry` yet (weather is a rules function in `PlanRules`/`AboardRules`); the client simulations in `src/domain/*` are unchanged. Each needs a route, a contract and a client switch.
  - **`fareHistory`, lounger board, found list, "you said, we did" board, sightings, guaranteed-cabin odds** still client-only.
  - **Reference columns:** `DIFFICULTY` (needs columns on `ref.Excursions`, schema and seed changes) and `hasAccessibleCabins` (against `CabinRules.cs`), plus port content, ship packing, dress nights and day stories.
  - **`/demo/*` routes** (data model 6.7; `IDemoStore` exists, no routes).

## Phase 5 record (slice 2: access reference data)

Built 2026-11-01.

- **Server (not compiled or run):** `GET /reference/access` returns the excursion difficulty figures and the room types with accessible staterooms. `Domain/ReferenceRules.cs` holds the twelve difficulty rows (copied from the client `DIFFICULTY`); `CabinRules.HasAccessibleCabins` / `AccessibleCategories` replace the inline test so the stateroom list and the endpoint agree. Tests written, not run (`ReferenceRulesTests` in `RatesTests.cs`); route added to `SwaggerCoverageTests.Routes` and data model 6.9.
- **Client:** `src/domain/accessReference.ts` keeps the server's copy (`setServedAccess`, `normalizeAccessReference`); `difficultyOf` and `hasAccessibleCabins` use it when present and the authored copies otherwise. `runtime` fetches it at sign-in in REST mode; a failed fetch leaves the authored copies. Tests in `accessReference.test.ts`.
- **Verified:** `npm run test` (1757 passed), `npm run lint`, `npx tsc -b`, `npm run build`.
- **Not done:**
  - **Columns on `ref.Excursions`.** The figures sit in server code, not the database; moving them needs schema, seed generator and Dapper changes.
  - **Late arrival.** Screens already open when the fetch lands keep the authored values until their next render (they match today, so nothing differs).
  - Still open from slice 1: simulated feeds, fare history and the other client-only boards, port content, ship packing, dress nights, day stories, `/demo/*`.

## Phase 5 record (slice 3: the sky feed)

Built 2026-11-01. The first simulated feed moved behind the server; it is the pattern for the others.

- **Server (not compiled or run):** `GET /feeds/sky?date=&port=` returns `{ uv, tempF, rainFrom, rainTo, source: 'sim' }` from `Domain/FeedRules.cs` (the client's `simWeather` ported, same hash, so values match). A missing or out-of-range query is `400 badFeedQuery`. Tests written, not run (`FeedRulesTests` in `RatesTests.cs`); Swagger list and data model 6.9 updated.
- **Client:** `src/feeds/sky.ts` (fetcher set by the runtime in REST mode, per-day cache cleared on sign-in or out, `skyNow` gives the server value or the local simulation) and `useSky` hook, used by `useDayPlan`. The effect is in `useSky`, not `useDayPlan`, because `h5Promises.test.ts` forbids effects there. Mock mode is unchanged.
- **Verified:** `npm run test` (1761 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`.
- **Not done:** the other feeds (flight status, traffic, ship pulse and lines, port crowd, storm chance, sky objects, ship heading) still run on the client. The server also has two older weather stubs (`PlanRules.WeatherFor`, `AboardRules.WeatherOn`) that give different figures from this feed; they should be unified when a real provider is chosen. Fare history, boards, port content, `/demo/*` also open.

## Phase 5 record (slice 4: the flight feed)

Built 2026-11-01.

- **Server (not compiled or run):** `GET /feeds/flight?number=&date=` returns `{ state, delayMinutes, source: 'sim' }` from `FeedRules.Flight` (the client's `flightStatus` ported with the same FNV hash). A bad number or date is `400 badFeedQuery`. Tests written, not run (`FlightFeedTests`); Swagger list and data model 6.9 updated.
- **Client:** `src/feeds/flight.ts` (fetcher set by the runtime in REST mode, cache cleared on sign-in or out) and the `useFlightStatus` hook, used by `JourneyScreen`. Mock mode unchanged; a failed fetch keeps the simulation.
- **Verified:** `npm run test` (1764 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`.
- **Not done:** route conditions (traffic and sky on the way to the port, `routeConditions`), ship pulse and lines, port crowd, storm chance, sky objects, ship heading; fare history and the boards; port content; `/demo/*`.

## Phase 5 record (slice 5: route conditions)

Built 2026-11-01.

- **Server (not compiled or run):** `GET /feeds/route?departure=&crowd=` returns `{ traffic, sky, leaveEarlierMinutes, source: 'sim' }` from `FeedRules.Route` (client `conditionsFor` ported). The client sends the arrival window's crowd rather than the window, so the server does not need the window table. Bad date or crowd is `400 badFeedQuery`. Tests written, not run (`RouteFeedTests`); Swagger list and data model 6.9 updated.
- **Client:** `journey.ts` split `routeConditions` into `crowdOfWindow` and `conditionsFor` (wrapper kept). `src/feeds/route.ts`, `useRouteConditions`, used by `JourneyScreen`; mock mode unchanged.
- **Verified:** `npm run test` (1767 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`.
- **Not done:** ship pulse and lines, port crowd, storm chance, sky objects, ship heading; fare history and the boards; port content; `/demo/*`.

## Phase 5 record (slice 6: demo state)

Built 2026-11-01.

- **Server (not compiled or run):** `GET/PUT /demo/state` (`DemoEndpoints`, `DemoService`, `DemoRules`), `IDemoStore.GetStateAsync/SaveStateAsync` (Dapper and in-memory). Demo accounts only; others get 404. Scenario ids mirror `src/domain/scenarios.ts` (`DemoRules.ScenarioIds`, kept in step by hand). Tests written, not run (`DemoTests.cs`); Swagger list and data model 6.7 updated.
- **Client:** `src/demo/publish.ts` (payload from the clock, fire-and-forget publisher) called from the demo store on each change; the runtime sets the publisher in REST mode and only for `isDemo` sessions. Mock mode unchanged.
- **Verified:** `npm run test` (1769 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`.
- **Not done:**
  - **Server speed.** The server stores the speed but `UserClock` applies the offset only, so a running fast clock drifts on the server between sends; the screens' own clock is exact.
  - **Server to client.** A new device does not take the saved controls from the server; the device keeps its own.
  - **`POST /demo/jump` and `/demo/reset`.**
  - **Scenario ids** are listed in two places; no test ties them together.
  - Still open: ship pulse and lines, port crowd, storm chance, sky objects, ship heading; fare history and the boards; port content.

## Phase 5 decision: what was left alone, and why

Decided 2026-11-01 after reading the remaining items in the code.

- **Deterministic simulations already agree across devices.** Ship pulse and lines (`pulse.ts`), quiet spaces, port crowd, storm chance, sky objects, ship heading, `fareHistory`, the lounger board, `FOUND`, guaranteed-cabin odds and the like are pure functions of a seed (a booking number, a sailing, a date) and the demo clock. Two devices on the same account and clock get the same answer, so nothing account-critical is stranded on one device. The things a guest *does* with them (lounger hold, lost reports, sightings, price watch choices) are in `memory`, `trip` or `pilot`, which sync.
- **Why no routes for them yet.** A route would only copy the same function to C# (the pulse tables and the ship's port schedule would be duplicated and have to be kept in step by hand) with no change in what a guest sees. Slices 3 to 5 did that for the sky, flight and route feeds because they are the ones a real provider (weather, flight status, traffic) would replace first; the pattern (`src/feeds/*`, `FeedRules`, a fetcher set by the runtime) is there to copy when a provider is chosen.
- **Parked until a real source or a product need exists:** the on-board feeds above; port content, ship packing, dress nights and day stories (authored text; the server already serves packing through `PackingView` and ports through `ref.Ports`, so the question is whether the client copies should be removed, which is a content decision); `ref.Excursions` columns for difficulty (a schema and seed change with nothing the guest would notice); `POST /demo/jump` and `/demo/reset`.
- **Still to do from earlier phases** (unchanged): sign-out flush, accounts with no persona, sync indicator, per-user settings keys, the calm profile and family contacts consent decision, screen copy that says "stays on this device", port ledger rows, plan changes into the day plan, signed family links, budget unification.
- **Nothing in Phases 4 and 5 has been compiled or run on the server.** Before relying on any of it, run `dotnet build` and the new tests (`State*`, `Rates*`, `Reference*`, `Feed*`, `FlightFeed*`, `RouteFeed*`, `Demo*`) once.
