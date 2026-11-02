# Multi-device plan: account data lives on the server

Status: **Plan written 2026-11-01. Phase 1 built (not committed); Phases 2 to 5 open.** Companion to `docs/backend-plan.md` and `docs/backend-data-model.md`.

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
| `rates` | last rate table | shared | none | server rates endpoint (Phase 5) | 5 |
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
