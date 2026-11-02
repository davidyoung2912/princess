# Multi-device plan 2: nothing but a thin client

Status: **Plan written 2026-11-01 (audit of the front end and back end). All seven phases have a first build (Phases 3 to 6 in part; Phase 7 as a ratchet). The "Not done" lines in each record are the remaining work.** Follows `docs/multi-device-plan.md` (Phases 1 to 5 there) and replaces its "Phase 5 decision: what was left alone".

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
4. **(Built in part: route and parity test only.) Reference data from the server.** `GET /reference/*` for the catalogue; cached copy; seed becomes the source and mock fixtures are generated from it; parity tests; difficulty columns on `ref.Excursions`.
5. **(Built in part: sign-out flush and sync indicator only.) Account-state loose ends.** Sign-out flush, user-id keying (and no-persona accounts), sync indicator, outbox sync, demo state from the server plus `/demo/jump` and `/demo/reset`, consent for calm profile and contacts, copy sweep, budget unification, Autopilot changes into the day plan.
6. **(Built in part: the staff queue for call backs only.) Features needing a server.** Signed family links and public page, port ledger rows, `IStaffQueue` for caregiver / callback / kit.
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

Built 2026-11-02, **in part**.

- **Done:** `GET /reference/catalogue` (excursions, dining venues, ports) from the server's own rules, and `src/domain/catalogueParity.test.ts`, which fails when the client's `EXCURSIONS` or `VENUES` and the server's C# copies differ in any priced or timed field.
- **Not done:** the client does not yet read its catalogue from the server (59 files import `pricing`, 66 import `sailings`; a cached copy needs those to go through one provider), the server seed is not yet the source the mock fixtures are generated from, and `ref.Excursions` has no difficulty columns (a schema change; the difficulty figures stay in `ReferenceRules`).

## Phase 5 record

Built 2026-11-02, **in part**.

- **Done:** signing out first sends any change still waiting (`signOutSaving` in the runtime; a failed send does not block signing out), and the Me screen shows whether everything is saved to the account, saving, or waiting for a connection (`useSyncStatus`, `sync.*` strings).
- **Not done:** user-id keying for persona-keyed stores and accounts with no persona, the outbox sync, demo state from the server with `/demo/jump` and `/demo/reset`, consent for the calm profile and family contacts, the "stays on this device" copy sweep, budget unification, and Autopilot changes merged into the day plan.

## Phase 6 record

Built 2026-11-02, **in part**.

- **Done:** `IStaffQueue` (simulated `SimStaffQueue`) and `POST /me/staff-requests` for `callback`, `caregiver` and `kit`; the disruption hub's call-back button asks the server in REST mode (`staffRequest` in the runtime) and keeps the on-device pretend queue in mock mode or when the server cannot be reached. Tests: `StaffQueueTests` (C#, not run).
- **Not done:** the caregiver and sensory-kit screens do not call the route yet (they have no request screen to wire), signed family-home links with a public page, and the port ledger and presence as rows.

## Phase 7 record

Built 2026-11-02, **as a ratchet**.

- `src/auditGate.test.ts` fails when a screen under `src/ui` imports an authored catalogue or simulation module (`pricing`, `sailings`, `excursions`, `dining`, `ports`, `portCrowd`, `pulse`, `cabinScore`) that is not on the known list (98 screens today), or when a file outside the stores, settings, sync, runtime and a short allowlist uses `localStorage`. Both lists must be edited when work removes an entry, so they can only shrink. A strict version (empty lists) is the end state of Phases 3 and 4.
- **Compile check (finding F):** the user ran the server tests on 2026-11-01; the build compiled and four test-helper failures were fixed (`null` bodies read as `JsonValueKind.Null`; `InMemoryJourney.PurgeAsync` tolerates a booking with no party). Everything written since (Phases 1 to 6 of this plan) is still uncompiled.
