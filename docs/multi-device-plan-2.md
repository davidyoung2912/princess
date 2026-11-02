# Multi-device plan 2: nothing but a thin client

Status: **Plan written 2026-11-01 (audit of the front end and back end). Phases 1 and 2 built; Phases 3 to 7 not started.** Follows `docs/multi-device-plan.md` (Phases 1 to 5 there) and replaces its "Phase 5 decision: what was left alone".

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
3. **Feeds to the server, client sims removed from the REST path.** Routes and `src/feeds/*` fetchers for pulse and lines, quiet spaces, port crowd, storm, sky objects, heading, disruption hub, fare history, boards, sightings, cabin odds, Autopilot sims, service status. Mock mode keeps the local functions.
4. **Reference data from the server.** `GET /reference/*` for the catalogue; cached copy; seed becomes the source and mock fixtures are generated from it; parity tests; difficulty columns on `ref.Excursions`.
5. **Account-state loose ends.** Sign-out flush, user-id keying (and no-persona accounts), sync indicator, outbox sync, demo state from the server plus `/demo/jump` and `/demo/reset`, consent for calm profile and contacts, copy sweep, budget unification, Autopilot changes into the day plan.
6. **Features needing a server.** Signed family links and public page, port ledger rows, `IStaffQueue` for caregiver / callback / kit.
7. **Audit gate.** A test that fails when a UI file imports an authored catalogue or simulation module in REST mode, or uses `localStorage` outside an allowlist.

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
