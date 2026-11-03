# Multi-device plan 2: nothing but a thin client

Status: **Plan written 2026-11-01. Phases 1 to 7 are built; what each "Not done" line left open was finished in `docs/multi-device-plan-3.md` (reconciled 2026-11-02, see the end of this file), except the items marked Open there.** Follows `docs/multi-device-plan.md` (Phases 1 to 5 there) and replaces its "Phase 5 decision: what was left alone".

## Goal and rules

1. **No data store on the front end that a guest would miss on another device.** Per-device display settings, the session token, diagnostics and caches stay local.
2. **Every external source or service is mocked by the backend**, behind an interface, so the real provider replaces the mock without any front-end change. The front end never knows whether data is simulated (`source` is shown to the guest only as the app does today).
3. Mock mode (no `VITE_API_URL`) keeps working on the device, as `CLAUDE.md` requires.
4. Verify with `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` (plus `npm run api:check` and `db:check` when the REST surface or schema changes). No browser testing and no `dotnet test`. Stop after each phase. Commit only when asked.

## Audit findings

**A. Front end calls an external service directly.** `src/ai/client.ts` calls `api.anthropic.com` from the browser with `VITE_ANTHROPIC_API_KEY` (shipped in the bundle). Its tools read the client's authored catalogue; rate limit and scripted fallback run on the client; the thread is in IndexedDB.

**B. Simulated external data computed on the client.** Ship pulse, venue lines, quiet spaces (`pulse.ts`), port crowd, storm, sky objects, ship heading, disruption hub, fare history and price watch, lounger board, found list, "you said, we did" board, sightings, cabin odds (`cabinScore`), Autopilot sims (`simulatedOpening`, `simWeather`), memory-book `simulatedReply`, the service-status page, and the telemetry sink (an on-device queue). The server's two older weather stubs gave figures unrelated to `/feeds/sky`, and none of the feeds sat behind an interface.

**C. Authored catalogue compiled into the client.** Excursions, dining, sailings, ports, pricing, programme, ship, cabins (`pricing` is imported by 59 files, `sailings` by 66). The server's `ref.*` seed is generated from the client's TypeScript, so the client copy is the source of truth. Server ports of client logic (hashes, difficulty rows, rates) are kept in step by hand.

**D. State still device-only or half-synced.** Sign-out flush, accounts with no persona, persona-keyed stores, the unsent outbox, demo state (no server-to-client, no server speed, no `/demo/jump` / `/demo/reset`), no sync indicator, calm profile and family contacts synced without consent, "stays on this device" copy, four budgets, Autopilot changes not merged into the day plan.

**E. Needs a server side.** Family-home links (secret made on the device), port ledger and presence as rows, caregiver / callback / sensory-kit requests (no staff side). `IPaymentGateway` is already correctly behind the server.

**F. Unverified server code.** Nothing from Phases 4 and 5 of plan 1 has been compiled. Run `dotnet build server/Princess.sln` (not `dotnet test`) before relying on it.

## Decisions (2026-11-01)

1. **Concierge thread moves to the account** (`UserState` key, 60-message cap, "clear" deletes the server copy), behind the existing `syncPrivate` consent. This reverses SUP-03's "stays on device".
2. **Catalogue: the server is the source of truth.** The client keeps a cached copy for offline use (`useSavedCopy` pattern); mock mode keeps fixtures generated from the same seed.
3. **Staff-side requests** get a stub staff inbox on the server behind `IStaffQueue`.
4. **Compile check** is the user's to run (project rule: npm checks only).

## Phases

1. **Backend provider seams.** `IWeatherService`, `IFlightStatusProvider`, `IRouteConditionsProvider`, `ITelemetrySink`, each with a simulated implementation; packing and the on-board day read weather through the seam; `POST /telemetry`; contract tests per provider. (`IShipTelemetry`, `IFareFeed` arrive in Phase 3 with their data, `IConciergeModel` and `IStaffQueue` in Phases 2 and 6.)
2. **Concierge on the server (built).** `POST /me/concierge`; tools run server-side over `ref.*` and the booking; guard, hourly limit and scripted fallback move; model key in user-secrets behind `IConciergeModel`; thread synced; remove `VITE_ANTHROPIC_API_KEY` and `askClaude` from the client.
3. **(Built in part: see the Phase 3 record for what remains.) Feeds to the server, client sims removed from the REST path.** Routes and `src/feeds/*` fetchers for pulse and lines, quiet spaces, port crowd, storm, sky objects, heading, disruption hub, fare history, boards, sightings, cabin odds, Autopilot sims, service status. Mock mode keeps the local functions.
4. **(Built.) Reference data from the server.** `GET /reference/*` for the catalogue; cached copy; seed becomes the source and mock fixtures are generated from it; parity tests; difficulty columns on `ref.Excursions`.
5. **(Built.) Account-state loose ends.** Sign-out flush, user-id keying (and no-persona accounts), sync indicator, outbox sync, demo state from the server plus `/demo/jump` and `/demo/reset`, consent for calm profile and contacts, copy sweep, budget unification, Autopilot changes into the day plan.
6. **(Built.) Features needing a server.** Signed family links and public page, port ledger rows, `IStaffQueue` for caregiver / callback / kit.
7. **(Built as a ratchet.) Audit gate.** A test that fails when a UI file imports an authored catalogue or simulation module in REST mode, or uses `localStorage` outside an allowlist.

## Phase 1 record

Built 2026-11-01.

- **Server (not compiled or run):** `Services/Providers.cs` holds the four interfaces and their simulated implementations (`SimWeatherService`, `SimFlightStatusProvider`, `SimRouteConditionsProvider`, `LoggingTelemetrySink`), registered in `Program.cs`. `/feeds/sky`, `/feeds/flight` and `/feeds/route` now call the interfaces. `PlanService` (packing weather) and `OnboardService` (today's weather) read `IWeatherService`, so a real weather provider replaces all three uses at once. `POST /telemetry` (`Domain/TelemetryRules.cs` validates: at most 100 items, known kinds and event names, scrubbed length) hands a batch to `ITelemetrySink`; it carries no person.
- **Tests written, not run:** `ProviderTests.cs` (each simulated provider returns the contract shape and `source: 'sim'`, is stable, and the telemetry validator accepts and refuses the right batches; the endpoint is in `SwaggerCoverageTests.Routes`).
- **Client:** `flushTelemetry` in `src/diagnostics/telemetry.ts` sends the queue and clears what was accepted; the runtime sets the sender in REST mode and flushes when the tab is hidden and when the connection returns. Mock mode keeps the on-device queue.
- **Not done:** the monthly climate (packing) and the per-day sky (`/feeds/sky`) are still two different simulations behind one interface; their figures will agree only when a real provider serves both. `IShipTelemetry`, `IFareFeed` and the others wait for Phase 3.

## Phase 2 record

Built 2026-11-01.

- **Server (not compiled or run):** `POST /me/concierge` (`Endpoints/ConciergeEndpoints.cs`) → `ConciergeService` (`Services/Concierge.cs`). `Domain/ConciergeRules.cs` holds the guard (`Screen`, the 500-character message and 12-message context limits), the instructions, the seven tools (run over `ExcursionRules`, `DiningRules`, `Itinerary`, `Pricing`, the bookable `ref.Sailings` and the guest's own booking and party, first names only) and the scripted concierge. `IConciergeModel` has `AnthropicConciergeModel` (registered only when `Concierge:ApiKey` is set) and `UnavailableConciergeModel`; `ConciergeLimiter` allows 20 model questions an hour per person (in memory). A handoff never reaches a model; no key, the limit, or a failed call gives the scripted answer with `fallback` saying why. The `concierge` key (128,000 characters) is added to `StateRules.UserKeys`.
- **Tests written, not run:** `ConciergeTests.cs` (guard, thread limits, every tool, day timing, scripted answers, the limiter; the endpoint with no key, a handoff, a bad thread and signed out) and the route in `SwaggerCoverageTests`.
- **Client:** `src/ai/client.ts`, `askClaude`, `configFrom`, `VITE_ANTHROPIC_API_KEY` and the `api.anthropic.com` CSP host are gone (the security test now fails if either returns). `ask` sends the thread to the server (`sendConcierge` in the runtime) and falls back to the built-in helper in mock mode, offline, or on an unreadable answer. The thread moved from IndexedDB to a per-person store (`src/ai/history.ts`) that syncs as `concierge` behind `syncPrivate`; clearing it deletes the account's copy, and withdrawing consent does too.
- **Differences from the old client tools:** the server has no port-guide prose or the programme (events), so `get_port` returns the pier or tender, the arrival and all-aboard times and the tours, and `build_day` gives the tour and dinner only. They come with Phase 4's reference data.
- **Existing threads:** a conversation kept in IndexedDB before this change is not carried over.

## Phase 3 record

Built 2026-11-02, **in part**.

- **Done:** `IShipTelemetry` (port crowd) and `IFareFeed` (fare history) in `Services/Providers.cs` with simulated implementations ported exactly from the client (`Domain/ShipFeedRules.cs`: same hashes and rounding); `GET /feeds/port-crowd` and `GET /feeds/fares`; client fetchers `src/feeds/portCrowd.ts` and `fares.ts` (local simulation first, the server's figures when they arrive, unreadable answers ignored) behind `usePortCrowd` and `useFareHistory`, used by the port guide, the Port Day Pilot and the price-drop watch. Tests: `ShipFeedTests` (C#, not run) and `src/feeds/served.test.ts`.
- **Second build (2026-11-02):** `Domain/OnboardFeedRules.cs` ports `levelAt` (ship pulse), `stormWatch`, `skyNight`, `loungerBoard` (the other loungers), `FOUND`, `seenToday` and `simulatedOpening` with the same hashes, tables and rounding. Providers: `IShipTelemetry` gains `Pulse`, `Loungers`, `Sightings`, `SkyNight`; new `IStormOutlook`, `ILostProperty`, `ISlotWatchFeed`. Routes: `/feeds/pulse`, `/storm`, `/sky-night`, `/loungers`, `/sightings`, `/found`, `/watch-opening`. Client: `src/feeds/feed.ts` (`createFeed`: local figures first, the server's when they arrive, unreadable answers ignored) and `useFeed`, with `pulse.ts`, `storm.ts`, `skyNight.ts` and `onboard.ts` feeds. Pulse works through one seam: `PulseEnv.served` gives the server's level for an exact moment and `levelAt` falls back to its own formula, so `pulseAt`, `goodTime`, `lineReading` and `quietSpaces` are unchanged; the hook reads whole minutes (nothing shown changes) so one answer covers a minute. Wired into the Pulse, Calm, Storm, Sky, Briefing, Lounger, Lost and found, Sightings and Slot watch screens and the storm nudge. Tests: `OnboardFeedTests` and `OnboardFeedApiTests` (C#, not run; the expected figures were read from the client's own functions) and `src/feeds/onboard.test.ts`.
- **Parity risk to check on the first compile:** `sunsetAt` uses trigonometry, which can differ in the last bit between runtimes; the C# test allows 2 ms, and the displayed times are to the minute.
- **Left on the device, with the reason:**
  - Memory-book friend replies (`simulatedReply`): it needs a contact's name sent to the server for a pretend answer. That waits for the consent work in Phase 5/6 (family contacts), where a real invite replaces it.
  - Ship heading and cabin odds (`HEADINGS`, `scoreCabin`, `sunSummary`): authored cabin-chooser rules over the cabin catalogue, not a changing feed; they move with the catalogue in Phase 4. The heading is already used server-side for the sunset side in `/feeds/sky-night`.
  - Disruption hub (`HUB`, `GUIDES`) and the "you said, we did" board (`YOU_SAID`): authored content, which is Phase 4's reference content. The hub's one live part, the call-back queue, is already on the server (Phase 6).
  - Autopilot week optimiser (`optimiseWeek`): a rule over the excursions, programme and dining catalogues, so it moves with Phase 4. Only its simulated opening and sky (Phase 1) are feeds.
  - The service-status page (`/me/status`, `systemStatus`): a function of the demo's scenario switches and network flag, not a feed of its own. It moves with Phase 5's demo state from the server (a real build reads service health).
- **Still uncompiled:** the C# above, as with every server change since the 2026-11-01 compile check.

## Phase 4 record

Built 2026-11-02, in two parts.

- **First part:** `GET /reference/catalogue` (excursions, dining venues, ports) from the server's own rules, and `src/domain/catalogueParity.test.ts`, which fails when the client's `EXCURSIONS` or `VENUES` and the server's C# copies differ in any priced or timed field.
- **Second part:**
  - **The client reads the server's catalogue.** `src/domain/catalogueServed.ts` (`normalizeCatalogue`, `applyCatalogue`) vets the answer (a bad entry is dropped; nothing usable leaves the authored copy in place) and swaps it into `EXCURSIONS` and `VENUES` *in place*, so the 13 files that import them (and the domain code behind pricing, autopilot, the day builder and search) needed no change. For dining, only the server's name, kind, cover charge and walk-in flag are laid over the authored rooms; deck, cuisine, dress code and menu stay authored because the server has no such fields. `useCatalogue` redraws the screens that list the catalogue (difficulty, compare, cabins, trip cost); the others get their data through the API, which prices on the server.
  - **Cached copy.** In REST mode `loadCatalogue` (runtime) applies the copy kept on the device at once (`cacheGet`, kind `catalogue`), then the server's answer replaces it and is kept (`cachePut`). The route is public, so this runs before sign-in. Offline or unreadable: the kept copy, else the authored one. Mock mode is unchanged.
  - **Difficulty columns.** `ref.Excursions` gains `WalkKm, Steps, Heat, Shade, Seats, Restrooms, Wet` (nullable; `db/01-schema.sql` in both the table and the add-column section), and the seed generator fills them from `DIFFICULTY` in `planning.ts`. `ReferenceRules.Difficulty` in C# stays what `/reference/access` serves, since the server reads the catalogue from C# and not from these tables.
  - **Fixtures and the seed.** The seed SQL is already generated *from* the client fixtures (`npm run db:seed:gen`, checked by `db:seed:check`), and the C# copy is tied to them by the parity test, so the three agree by test and not by one generator. Making the C# the single source and generating the TypeScript from it was **not** done: it would reverse the existing generator and the compile check on the C# is still the user's.
  - Tests: `catalogueServed.test.ts` (swap in place, authored rooms keep their menus, return to authored, bad entries, listeners).
- **Verified:** `npm run test` (1832 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run db:check`, `npm run db:seed:check`, `npm run api:check`. No server C# changed in this part; no SQL ran.
- **Not done:** ports are served but the client still takes them from `sailings.ts` (the arrival and all-aboard times differ per sailing and are not in the catalogue answer); the other catalogues (fares, packages, events, shop items) are not served by `/reference/catalogue`.

## Phase 5 record

Built 2026-11-02 (the first half the same day; the rest follows). **Server C# not compiled or run**, as with everything since the 2026-11-01 compile check.

- **Sign-out flush and sync indicator:** `signOutSaving`; the Me screen shows saved, saving or waiting (`useSyncStatus`, `sync.*`).
- **Keying by user id:** `ownerIdOf(session)` is the persona id for a demo persona, else the server user id. Every store hook (`useMemory`, `useTrip`, `useHub`, `usePilot`, `usePort`, `useParty`, `useOffers`, `usePhoneSetup`, `useShopExtras`), the concierge thread, the settings and the sync module use it, so an account that is not one of the twelve gets its own device copy and imports it on first sign-in (before, they all shared the key `…:` and never imported). The chat outbox is keyed the same way.
- **The outbox is not synced, on purpose.** It holds messages that never reached the server; a second device sending the same queue would duplicate them. It is per account on the device and retries as before.
- **Demo state:** `POST /demo/jump {at}` (measured on the server's clock) and `POST /demo/reset`; `GET /demo/state` answers `savedAt`; `UserClock` follows a running fast clock from `savedAt` (`DemoRules.OffsetAt`), so the server no longer drifts. A new device takes a demo account's saved clock and scenarios (`pullDemoFromServer` at sign-in, when the tab is shown and when the connection returns), unless the server's copy is the one this device last sent or received, so a clock stopped here stays stopped. Scenario ids are tied by `src/demo/scenarioParity.test.ts`. Tests: `DemoClockTests`, `DemoApiTests` (C#, not run), `publish.test.ts`.
- **Consent for the calm profile and family contacts:** two new keys, `calm` and `family` (encrypted at rest, accepted only while `syncPrivate` is on, deleted when it is turned off). `pilot` and `hub` no longer carry them; a binding `clean` hook sends an older copy back without them the first time it is pulled. Copy: the privacy centre text lists them.
- **Copy sweep:** `data.intro`, `priv.intro`, `priv.keep.body`, `party.shared.intro`, `money.checksNote`, `delay.record.why` now say what is saved to the account and when. Strings about things that really are device-only (diagnostics, the wipe, boarding pass on the device) were left.
- **One trip budget:** `memory.budget` is the trip budget; the second copy under `planning.budget` (money plan, trip-cost note) is gone and an older value is taken when there is no other. The aboard spending limit (`Budgets`, with alert level and child limits) stays a separate thing, a limit to be warned at, but starts from the trip budget when none is saved.
- **Autopilot changes reach the programme:** when a change is accepted (Autopilot, Ask, "apply my week") or undone, the events it drops or adds are set on the guest's own plan on the account (`programmeFollows` → `togglePlan`), so the programme matches on every device. Tours, dinners and moves are not pushed: a tour or dinner is a booking the guest changes themselves, and an event cannot start at another time. They stay in the suggested-day overlay as before.
- **Verified:** `npm run test` (1809 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`, `npm run db:check`.
- **Not done:** the server does not read `pilot` itself, so server-side views (briefing, concierge tools) do not see overlay-only changes (moves, tour and dinner drops). A stopped demo clock is stored as speed 1 (the column cannot hold 0), so the server does not follow it. The concierge-thread consent copy was already right and was not changed.

## Phase 6 record

Built 2026-11-02, in two parts (the second part is the port rows, the public-page delay and the consent bullets below). **Server C# not compiled or run**, as with everything since the 2026-11-01 compile check.

- **Staff queue:** `IStaffQueue` (simulated `SimStaffQueue`) and `POST /me/staff-requests` for `callback`, `caregiver` and `kit`. The disruption hub's call-back button, the sensory-kit request and the caregiver link on the calm screen all tell the server in REST mode (the kit and caregiver are best effort: the request is kept on the account either way). The hub keeps the on-device pretend queue in mock mode or when the server cannot be reached. Tests: `StaffQueueTests` (C#, not run).
- **Signed family-home links and a public page:** `POST /me/family-links` (3, 7 or 14 days), `DELETE /me/family-links/{id}` and `DELETE /me/family-links`, `POST /me/family-postcards`, and `GET /public/family/{token}` (no sign-in, rate-limited by address). The token is `owner.link.expiresMs.signature`, an HMAC-SHA256 with a key derived from the token signing key (so it can never be a sign-in token); the new `FamilyLinks` row says whether it is live, so a stop takes effect at once, and `FamilyPostcards` holds what the page shows (newest 30). The contacts' names and addresses stay in the encrypted `family` document: the server never sees them. In REST mode `FamilyLinkScreen` changes nothing on screen unless the server agreed and says so when it did not; `AtSeaScreen` asks the server and shows the reason (signature, unknown, revoked, expired). Mock mode keeps the device-signed links. Tests: `FamilyHomeTests` (C#, not run), the route in `SwaggerCoverageTests`, `homeLink.test.ts`, `render.test.tsx`.
- **Port ledger and presence as rows (built, second part):**
  - **Server:** a `PortRows` table (`BookingId, Kind, RowKey, Json, At, Deleted`, a row per person's presence on a day, per day's plan and back-up plan, per meeting place, per person's state at a meeting, per family and expense in the split ledger, and the two settings), `IPortRowStore` (`DapperPortRowStore`), `PortRowRules`, `PortRowService` and `GET`/`POST /bookings/{n}/port-rows` (any guest reads; adult guests change; a child gets `403 supervised`). The later `At` wins each row and a tie keeps the stored one; a delete is a row with `Deleted` set, kept 30 days; an `At` more than five minutes ahead of the server is cut back; at most 100 changes a call and 1,000 rows a booking. The privacy export lists the rows as `port-rows`.
  - **Client:** `src/port/rows.ts` turns a `PortState` into rows and back (`valuesOf`, `diffState`, `stateOfRows`, `legacyRows`, `layer`), so the screens, `usePort` and `port/store.ts`'s shape are unchanged. `store.ts` tells `onPortChanged` listeners of each change a person makes; `src/sync/portRows.ts` queues the changed rows (kept on the device, so a change made offline survives a reload), sends them after a pause, and takes the server's rows as the state shown. `src/sync/httpPortRows.ts` is the HTTP remote. The `port` binding and `mergePort` are gone. The sync indicator now covers the rows as well as the documents. Mock mode is unchanged (no remote, nothing queued).
  - **One-time import:** the first time a device syncs a booking it uploads its own record and the old `port` document (read through the state routes, deleted once its contents are in rows). Rows with no time of their own get a small counting number, so any real change or delete is later; expenses and presence keep their own times. A delete made before another device first syncs therefore beats that device's old copy. Tests: `rows.test.ts`, `portRows.test.ts` (two devices, offline, restart, import, batches, a child), `PortRowTests` (C#, not run).
  - **What a row clash costs:** two people changing the *same* row at the same time (the same person's presence, the same plan) go to the later change; changes to different rows (two people's presence, two people at a meeting place, two expenses) both stay. The day's plan is one row, so two people agreeing to it at once can lose one agreement (the other taps again). A family deleted on one device while another adds an expense paid by it leaves that expense unreadable (the ledger drops an expense whose payer is gone). A child on the booking cannot save, and the next pull replaces what they changed on their own device with the booking's rows.
- **The public page shows a delay:** the server reads the guest's `hub` document (not encrypted) and sends `delayedMinutes` when the open delay was told to the party and ETA sharing is on (`FamilyHomeRules.SharedDelayMinutes`, the same test as the app's `delayVisibleToOthers`). Test: `TheDelayShowsOnThePageOnlyWhenTheGuestToldTheirPartyAndSharesTheArrivalTime` (C#, not run), `homeLink.test.ts`.
- **Turning `syncPrivate` off stops the links:** `StateService.SaveAsync` revokes every family link when a `settings` save takes `syncPrivate` from on to off, so it holds from any device and when the save was waiting for the connection. A settings save that never had it on leaves the links alone. Test: `WithdrawingConsentToKeepPrivateDetailsStopsTheLinks` (C#, not run).
- **Verified:** `npm run test` (1828 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`, `npm run db:check`. The server C# was not built or run, and no SQL ran.
- **Not done, and why:** making a new family link still needs a connection and a signed-in session, on purpose: the server signs the link, so there is nothing to make offline (the screen says so). The old on-device signed links (mock mode) are unchanged.

## Phase 7 record

Built 2026-11-02, **as a ratchet**.

- `src/auditGate.test.ts` fails when a screen under `src/ui` imports an authored catalogue or simulation module (`pricing`, `sailings`, `excursions`, `dining`, `ports`, `portCrowd`, `pulse`, `cabinScore`) that is not on the known list (98 screens today), or when a file outside the stores, settings, sync, runtime and a short allowlist uses `localStorage`. Both lists must be edited when work removes an entry, so they can only shrink. A strict version (empty lists) is the end state of Phases 3 and 4.
- **Compile check (finding F):** the user ran the server tests on 2026-11-01; the build compiled and four test-helper failures were fixed (`null` bodies read as `JsonValueKind.Null`; `InMemoryJourney.PurgeAsync` tolerates a booking with no party). Everything written since (Phases 1 to 6 of this plan) is still uncompiled.

## Reconciliation (2026-11-02)

| Item left open above | Now |
|---|---|
| Climate and per-day sky as two simulations (Phase 1) | Done: one weather model (plan 3 Phase 4 slice 4) |
| `IShipTelemetry`, `IFareFeed` and the other feeds (Phase 1) | Done (plan 3 Phase 4) |
| Existing concierge threads in IndexedDB not carried over (Phase 2) | Accepted: IndexedDB is gone entirely (plan 3 Phase 7) |
| Ports from `sailings.ts`; other catalogues not served (Phase 3) | Done: sailings, ports, fares, packages, pricing and content are served; the authored copies are deleted from the client (plan 3 Phase 7) |
| Server does not read `pilot` | **Open** |
| Stopped demo clock stored as speed 1 | **Open, minor** |
| Making a family link needs a connection | By design |
| Compile check of Phases 1 to 6 | **Open**: run `dotnet build server/Princess.sln` |
