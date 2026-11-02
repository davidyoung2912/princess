# Multi-device plan: account data lives on the server

Status: **Plan written 2026-11-01. Phases 1 to 3 built; Phases 4 and 5 open.** Companion to `docs/backend-plan.md` and `docs/backend-data-model.md`.

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
