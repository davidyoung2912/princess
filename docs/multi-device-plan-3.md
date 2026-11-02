# Multi-device plan 3: a client with nothing of its own

Status: **Plan written 2026-11-02 from a second audit of the front end and back end. Phases 1 and 2 built; Phase 3 step 1 (sailings) built; the rest of Phase 3 and Phases 4 to 7 not started.** Follows `docs/multi-device-plan.md` and `docs/multi-device-plan-2.md`. It replaces their "mock mode keeps working" rule (see Decisions).

## Goal and rules

1. **The front end holds no data a guest would miss on another device.** What stays local: display settings (theme, contrast, text size, reduce motion, data-light), the session token, diagnostics, and caches of server answers.
2. **Every data source and every external service is behind the backend**, behind an interface, so a real provider replaces a simulated one with no front-end change. The front end does not know whether data is simulated.
3. **There is one mode.** The in-browser mock API, mock auth and demo picker are removed; the front end always talks to the server. `CLAUDE.md` was changed on 2026-11-02 to say so.
4. Verify with `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` (plus `api:check`, `db:check`, `db:seed:check` when the REST surface or schema changes). No browser testing, no `dotnet test`. Stop after each phase. Commit only when asked.

## Decisions (2026-11-02)

1. **Mock mode is dropped.** `VITE_API_URL` becomes required (default `/api/v1` through the Vite proxy). The server must be running for `npm run dev`.
2. **Server tests replace the mock tests.** The `src/api/*.test.ts` files that exercise the mocks go with them; the C# suite covers the same rules (the user runs it; the project rule is no `dotnet test` here).
3. **Rules over served data may stay on the client** (formatting, sorting, "what is next"). What goes is authored data and anything simulated.

## Audit findings

Verified in the code on 2026-11-02. Most are things plans 1 and 2 did not list.

### A. Identity, time and sailing are device state (most serious)

- `useSailing()` returns `sailingById(demo.sailingId)`, where `demo.sailingId` is device-local (`src/demo/state.ts`; the server's `/demo/state` carries only clock and scenarios). 45 files use it. A real account's trip never picks the sailing; two devices can show two sailings.
- `demoNow()` is the client's "now" for **every** account, real ones included. First run is `timeForStage(REFERENCE_SAILING, 'preCruise')` (two weeks before departure), running at real speed from that device's first run. The server uses the real clock for non-demo users (`UserClock`). So a real account's phone and desktop disagree with each other and with the server about the date. 57 files use `useNow()`.
- `usePersona()` maps the session to one of twelve client-held personas (63 files). A real account is not a persona, so it returns null and screens fall back (`personaById(me.booker)?.firstName ?? ''`, `firstName(id)` returns the raw id, chat names). Names, children, bookers and party members must come from the server.
- `PERSONAS` is imported by the sign-in and demo screens; the demo account list is client data.

### B. The in-browser backend still exists

`src/api/*Mock.ts`, `mock.ts`, `auth/mockProvider.ts`, `data/store.ts` + `idbStore.ts` (IndexedDB), `data/sync.ts`, the demo network/latency simulation, and `withHttpGroups(mockApi, …)` all remain. In REST mode every `Api` group is overridden, so the mocks are dead weight there, but they are the second source of truth for rules (for example `arrivalWindows` is used by `planMock`, `checkinMock` and `boarding.ts`).

### C. Authored catalogue compiled into the client

The audit gate lists 98 screens, but 33 of them import only `formatMoney` from `pricing` (formatting, fine). The real ones are 65 screens importing `sailings` (60: `PORTS`, `itinerary`, `sailingById`, `SAILINGS`, `shipZoneAt`, `stageAt`), `excursions`, `dining`, `ports`, `portCrowd`, `pulse`, `cabinScore`. The gate does not look at other authored modules at all; 88 screens import one of these:

| Module | What it holds | Server today |
| --- | --- | --- |
| `sailings.ts` | sailings, itinerary, ports, stages, ship time zones | `/sailings*`, `Itinerary.Ports` (catalogue serves ports but the client ignores them) |
| `ship.ts`, `cabins.ts`, `deck.ts` | ship facts, categories, deck places, elevators, muster stations | categories via `/rooms`; no deck or ship routes |
| `program.ts` | events, scripted `PLAN_CHANGES` (a simulated disruption feed) | `ProgramRules.cs` has a copy; `/program/{day}` |
| `portContent.ts`, `ports.ts` | port guides, phrases, fair prices, walks, day passes | none |
| `packages.ts` | add-on prices and unit rules | priced server-side; client copy used for display and break-even |
| `excursions.ts`, `dining.ts` | catalogue | served and swapped in place (plan 2, Phase 4) |
| `services.ts`, `ahead.ts`, `postcruise.ts`, `finishMore.ts`, `disembark.ts`, `embark.ts`, `help.ts`, `policy.ts`, `games.ts`, `tv.ts`, `wifi.ts`, `laundry.ts`, `photos.ts`, `health.ts`, `safety.ts`, `room.ts`, `orders.ts`, `menus.ts` | mixed: option lists, limits, times, authored text. Needs a per-file read to split limits and options the server enforces (serve them) from interface copy (keep) | partly enforced in `*Rules.cs`, not served |

### D. Simulations still computed on the client

- **Arrival-window queue times and welcome forecast** (`embark.ts`, `EMBARK_SOURCE = 'sim'`).
- **Sailing quality notes** (`dream.ts`, `source: 'sim'`), used by the Decide screen.
- **Cabin heading and sun side** (`cabinScore.ts`, `HEADINGS`) and cabin scoring/compare (`chooseCabins`, `compareMatrix`).
- **Disruption hub** content and its callback queue fallback (`disruptionHub.ts`).
- **Service status** (`systemStatus` from demo scenarios, `SupportScreens`).
- **Memory-book friend replies** (`simulatedReply`).
- **Scripted plan changes** (`PLAN_CHANGES`) and the Autopilot week optimiser (`optimiseWeek`) over client catalogues.
- **`AskScreen` uses `domain/assistant.ts` `ask()`**, a second, local, rule-based answerer next to the server concierge.
- **Sky, storm, pulse, loungers, sightings, found, fares, flight, route, port crowd** are served, but each feed still computes locally first and then replaces the figure (local-first, server-second). The guest can see a value change a moment later, and the client keeps a full copy of every simulation.

### E. Device stores that are the only copy (or leak)

- **Sign-out leaves private data behind.** `signOut()` clears tokens only. The device copies of `memory`, `health`, `calm`, `family` and `concierge` (medical card, allergies, contacts, chat) stay in `localStorage` for the next person on a shared device. They were consent-gated for the server, but the device copy has no such gate.
- **Per-persona keys.** Stores are keyed by `ownerIdOf(session)`; with mock mode gone the persona branch and the first-sign-in import logic in `sync.ts` go too.
- **Chat outbox** (`princess:outbox:*`) and **port-row queue** hold unsent changes on one device (by design, so a second device cannot duplicate them). Keep, but document, and show them in the sync indicator.
- **Demo clock, scenarios, sailing, phone zone, network** (`princess:demo`) are per device; only clock and scenarios reach the server, and only for demo accounts.
- **Offline `found` pass cache** (`FindPassScreen`) keeps a looked-up pass by booking number and last name. Fine as a cache; add an expiry and clear it at sign-out.
- **Server staff tickets** are not stored (`SimStaffQueue` logs and returns a ticket); the guest's copy lives in the `hub` document. A real desk could not see or answer it.

### F. Server

- **Providers are hard-wired** in `Program.cs` (`AddSingleton<IWeatherService, SimWeatherService>` and so on). Swapping one is a code change, not configuration.
- **Two older weather stubs** (`PlanRules.WeatherFor`, `AboardRules.WeatherOn`) still back `SimWeatherService.Climate/Today`, apart from `FeedRules` for `/feeds/sky`. Packing, the day brief and the sky can disagree.
- **`ConciergeLimiter` is in memory**, so the hourly limit is per server instance and resets on restart.
- **Hashes, difficulty rows, rates and scenario ids are copied by hand** between TypeScript and C# and tied by tests. Once the client drops its copies this risk goes away.
- **Nothing written since the 2026-11-01 compile check has been built.** The user runs `dotnet build server/Princess.sln` before any phase below relies on it.

## Phases

### Phase 1: One source for who, when and which trip

Server:
- `GET /me/context` (or extend `/auth/me`): the person (names, role, child, booker), the party with first names, the current booking and sailing id, the stage, and server `now` (ms) with `serverTimeOffset` guidance. Non-demo users get the real clock; demo users get their offset (existing `UserClock`).
- Demo state gains `sailingId` and `phoneZone` (so a demo user's sailing follows them between devices). `PUT /demo/state` takes them.
- Child/booker names come from the server for every account.

Client:
- A `useContext()` hook (`src/hooks/useAccountContext.ts`) replaces `usePersona`, `useSailing`, `useNow`'s source and `personaById(...).firstName` in 63/45/57 files. `useNow()` reads `Date.now() + serverOffset` (offset taken from the server's time, refreshed on pull and when the tab is shown).
- `src/demo/*` shrinks to the demo controls for demo accounts only (jump, speed, scenarios, sailing); real accounts never see or use a simulated clock.
- `personas.ts` is cut to what the sign-in screen needs, then served (Phase 2).

Done when: a real account, on two devices opened minutes apart, shows the same date, sailing, names and stage.

### Phase 2: Remove the in-browser backend

- Delete `src/api/*Mock.ts`, `mock.ts`, `auth/mockProvider.ts`, `data/store.ts`, `idbStore.ts`, `data/sync.ts` (the cross-tab channel stays only if the session needs it), the network/latency simulation and `withHttpGroups`; `api` is the HTTP groups directly. `Api` types and `guards.ts` stay.
- `VITE_API_URL` required; `usesRealAuth` and every `if (!rest)` branch go; the Vite proxy default is documented in the README.
- The demo picker becomes a **server** list: `GET /auth/demo-accounts` (demo environment only) and the sign-in screen signs in with it. `PERSONAS` leaves the client.
- Move the useful `src/api/*.test.ts` assertions to the C# suite where they are not already there (list them first; delete the rest). Keep `guards` and `httpApi.test.ts`.
- `wipeAll`/`resetDemoData` lose the IndexedDB parts.

Done when: `src/api` has `http.ts`, `httpApi.ts`, `types.ts`, `guards.ts`, `errors.ts` and the type files only, and nothing imports `idbStore`.

### Phase 3: Authored data comes from the server

Order by how many screens use it:
1. **Sailings, itinerary, ports, stages and ship zones** → `GET /reference/sailings` (list, itinerary days, port arrival/all-aboard times, tender flag, zone). `sailingById`, `itinerary`, `PORTS`, `stageAt`, `shipZoneAt` read a served table with the same cached-copy pattern as the catalogue (`useSavedCopy`, kept in `localStorage` as a cache). This also removes the 33-to-65 screen ratchet entries for `sailings`.
2. **Ship, categories, deck places, elevators, muster stations** → `/reference/ship`.
3. **Programme events** → use `/program/{day}` as the only source; delete `EVENTS` and `PLAN_CHANGES` from the client (the server's `ProgramRules.PlanChanges` becomes the simulated disruption feed behind `IProgramChanges`, so a real operations feed replaces it).
4. **Port guides and port content** → `/reference/ports/{id}/guide`.
5. **Packages/add-ons** → `/reference/packages` (prices stay server-computed; the break-even screen reads served bases).
6. **Option lists and limits** in `services`, `ahead`, `postcruise`, `finishMore`, `disembark`, `embark`, `policy`, `help`, `games`, `tv`, `wifi`, `laundry`, `photos`, `health`, `safety`, `room`, `orders`, `menus`: read each file; serve what the server enforces (limits, ETAs, tag groups, SLAs), keep interface copy in i18n.
7. `excursions`/`dining`: remove the authored copies. The client reads only the served catalogue; dining deck, cuisine, dress code and menu move to the server (the open gap from plan 2, Phase 4).
8. Cache, not copy: `localStorage` keeps the last served tables for offline reading, versioned by an `ETag`/`version` field on every reference route so a stale cache is refreshed.

Parity tests (`catalogueParity.test.ts` and hand-kept hashes) are deleted as each copy goes.

### Phase 4: Simulations move behind the server, and the client stops simulating first

- New providers with simulated implementations and routes: `IEmbarkQueue` (arrival-window queues and welcome forecast), `ISailingQuality` (dream/Decide notes), `ICabinGuide` (heading, sun side, scoring and compare, so `chooseCabins` and `compareMatrix` run on the server), `IServiceStatus` (health of the services, no longer a function of demo scenarios on the client), `IFriendReply` (memory-book replies, only after the consent decision on contacts), `IDisruptionContent` (hub and guides).
- `src/feeds/feed.ts` changes from "local figure first, server second" to **server only**, with the cached last answer (and "loading" otherwise). The client copies of `pulse`, `portCrowd`, `sky`, `storm`, `fares`, `flight`, `route`, `onboard` simulation functions are deleted, along with the client side of every hash. The fixed-seed formulas stay in C#.
- `AskScreen`'s local `ask()` and `domain/assistant.ts` go; the screen uses the server concierge (`/me/concierge`) with its scripted fallback. `ai/scripted.ts`, `ai/tools.ts` and `ai/guard.ts` on the client go with it (the guard already runs on the server).
- Unify weather: `IWeatherService.Climate` and `Today` both call the `FeedRules` model so packing, the brief and `/feeds/sky` agree; then one real provider replaces all of them.
- Autopilot's week optimiser and scripted openings: decide whether `optimiseWeek` moves to `POST /me/autopilot/plan` (recommended; it reads catalogues, programme, dining and the guest's plan, all server data, and its accepted changes already reach the programme).

### Phase 5: Device copies and sign-out

- Sign-out (and "switch account") clears every `princess:*` device copy that belongs to the person, after the flush. Display settings and diagnostics stay.
- With one mode, remove the persona-keyed code path and the first-sign-in import in `sync.ts`: the server is always the source; a new device pulls.
- Give the `found` pass cache and every `cachePut` kind a maximum age.
- Persist staff tickets: `StaffTickets` table behind `IStaffQueue` so a desk reads them; the hub shows the server's ticket (status, position) instead of a copy in the `hub` document.
- Document the outbox and port-row queue as the only unsent-change stores; both show in the sync indicator.

### Phase 6: Server hardening for swappable providers

- Provider selection by configuration: `Providers:Weather`, `Providers:Flight`, `Providers:Route`, `Providers:Telemetry`, `Providers:StaffQueue`, `Providers:Concierge` (default `sim`), resolved in one `AddProviders(config)` method. A contract test per interface runs against every registered implementation.
- `ConciergeLimiter` to the database (or a distributed cache), so limits survive restarts and instances.
- Real-provider notes in `server/README.md`: what each interface must return, timeouts, fallbacks to the simulated answer, and that nothing changes in the client.
- Compile check: the user runs `dotnet build server/Princess.sln` before Phase 1 starts and after each server phase (the project rule keeps `dotnet test` out of our hands).

### Phase 7: The audit gate becomes strict

- `src/auditGate.test.ts` lists go to empty: no UI file imports an authored-data or simulation module; no file outside the sync stores, settings and cache helpers touches `localStorage`; no import of `idbStore`, `*Mock` or `personas` outside tests; no `source: 'sim'` literal in `src`.
- Add a test that every string in `src` that names a persona id is gone, and that `VITE_API_URL` is read in exactly one place.

## Order and size

| Phase | Risk | Size | Notes |
| --- | --- | --- | --- |
| 1 Who, when, which trip | high | large | touches ~100 files by hook swap; do first, everything else assumes it |
| 2 Remove mock backend | medium | large | mostly deletion; test migration is the work |
| 3 Authored data | medium | very large | one reference route per step; stop after each |
| 4 Simulations | medium | large | each is a copy of the pattern in plan 2 |
| 5 Device copies, sign-out, tickets | low | medium | needs a small schema addition |
| 6 Hardening | low | medium | |
| 7 Strict gate | low | small | ratchet closes |

## Assumptions made (2026-11-02, user said "make necessary assumptions")

- Demo accounts are available when `Demo:Enabled` is set (default on in development, off otherwise).
- A first load with no network shows cached reference tables and the last-synced documents only. That is acceptable.
- `optimiseWeek` and the cabin chooser move to server routes (Phase 4).
- A real account's "now" is the real time plus the offset between this device's clock and the server's; a demo account's "now" is the server's demo clock.
- A real account's sailing is its current trip (the `current` trip, else the first upcoming), as `httpApi.ts` already chooses. A demo account's sailing is the one saved in its demo state.

## Not decided

Nothing open; the three earlier questions are settled by the assumptions above.

## Phase 1 record

Built 2026-11-02. **Server C# not compiled or run** (project rule: no `dotnet` commands here); the new tests are written, not run.

- **Server:** `GET /me/context` (`Services/ContextService.cs`, DTOs in `JourneyContracts.cs`, route in `AuthEndpoints.cs`) answers `{ person, party, booking, sailingId, phoneZone, nowMs, isDemo }`. The current trip is the soonest confirmed, non-agent booking that has not finished (the rule `TripService` uses); `nowMs` goes through `IUserClock`, so a demo account's demo offset applies and a real account gets real time. Demo state gains `SailingId` and `PhoneZone` (`demo.DemoState` add-column lines in `db/01-schema.sql`, `DemoStateDto`, `DemoStateRow`, `DapperDemoStore`, `DemoRules.Problem` with `badSailing` and `badZone`). Data model section 6.7 describes both. Tests written, not run: `ContextTests.cs`, `DemoTests.TheSailingAndPhoneZoneAreCheckedAndKept`, the route in `SwaggerCoverageTests`.
- **Client:**
  - `src/account/context.ts` (framework-free): the context store (`normalizeContext`, `setContext`, `refreshContext`), `serverNow()` (this device's clock plus the offset measured at the middle of the request), `followsServer()` (true for a real account from sign-in, before the answer arrives), `personFrom`, `personFirstName`, `partyPeople`. `src/account/sailing.ts`: `sailingFor` (a real account's trip, else the next sailing that has not left; a demo account's chosen sailing).
  - `runtime/index.ts` loads the context at sign-in, when the tab is shown and when the connection returns, clears it at sign-out, and drops an answer that arrives after the account changed.
  - `demoNow()` is the server's time for a real account and the demo clock only for a demo account (or mock mode). `currentStage`, `jumpToStage` use `sailingFor`.
  - `usePersona()` returns a `Person` (new type in `personas.ts`: `Persona` with `id` and `booker` as strings): the demo persona, or for a real account the person from the context. `useSailing()` and `useNow()` follow the rules above. `useMine` now reloads when a real account changes (before, a real account had no persona and its owner key was always empty).
  - 13 screens and `people.ts` no longer look names up in the persona table (`personFirstName`); 9 screens and hooks take the party from `partyPeople` (the server's party for a real account). `ProfileScreen` accepts only people on the trip. The API types for `account.profile`, `account.saveProfile`, `plan.excursions.addToCart` and `aboard.lastMinute.book` take plain string ids.
  - Demo controls: `DemoPayload` and the server answer carry `sailingId` and `phoneZone`; a new device takes the account's sailing and zone with its clock and scenarios.
- **Verified:** `npm run test` (1844 passed, including `src/account/context.test.ts`), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`, `npm run db:check`, `npm run db:seed:check`.
- **Not done:**
  - **`PersonaId` is still in the API type files** (return types and most parameters); the wire already carries guids for real people, so those types are wrong for them. They go with the mock layer in Phase 2.
  - **Persona-only code paths remain:** `ai/tools.ts` (`partyOf`), `AtSeaScreen`'s device-signed link branch and the mock `*Mock.ts` files. All go in Phases 2 and 4.
  - **A real account's trip sailing that the client catalogue does not know** falls back to the next sailing until Phase 3 serves the sailings table.
  - **Role, stateroom, group and text size** are neutral for a real account (`role: ''`, `group: 'solo'`); no screen reads them for a real account except the demo screen.
  - **The demo sailing switcher** (`DemoScreen`) saves to the server only for demo accounts, as intended; not exercised against a running server.
  - Before Phase 2: the user should run `dotnet build server/Princess.sln` once (everything since 2026-11-01 is uncompiled).

## Phase 2 record

Built 2026-11-02. **Server C# not compiled or run** (project rule); the new route is registered in `SwaggerCoverageTests` but no test exercises it.

- **Removed:** all `src/api/*Mock.ts`, `mock.ts`, `rng.ts`, `auth/mockProvider.ts`, `data/store.ts`, `idbStore.ts`, `backup.ts`, `errors.ts`, the network/latency simulation in the runtime, `withHttpGroups` (now `toApi`, which joins the REST groups; the groups already covered all of `Api`), `usesRealAuth` and every `if (!rest)` branch, the `fake-indexeddb` dev dependency, and the demo screen's persona picker and pretend-network card. `Export my data` is gone from the device settings (nothing is kept there to export). `sendConcierge`, `staffRequest`, `familyHome` and `fetchRates` are no longer nullable.
- **One mode:** `API_URL` defaults to `/api/v1`; `startRuntime` restores the session and never signs in on its own. `data/sync.ts` (the cross-tab channel) stays for the session. `data/lifecycle.ts` now only clears this device's keys.
- **Server:** `GET /auth/demo-accounts` (anonymous; 404 in production) lists the seeded demo accounts; the sign-in page shows them in non-production builds (`src/auth/demoAccounts.ts`). `IUserStore.ListDemoAsync`, `DemoAccountDto`; documented in data model 6.1.
- **Tests:** deleted the eleven `src/api/*.test.ts` files that drove the mocks and the discover-API block in `domain/discover.test.ts`; `data.test.ts` keeps the reset/wipe and channel tests. **The assertions were not ported to C#** (the plan asked to list and move the useful ones); the rules they covered live in the server services, and the C# suite is the place to check them when the user next runs it. `guards`, `httpApi` and `bounded` tests stay.
- **Verified:** `npm run test` (1519 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`, `npm run db:check`.
- **Not done (Phase 4 or later):** the device-signed family link branch (`FamilyLinkScreen`, `AtSeaScreen` with `issueLink`/`verifyLink`), the pretend callback queue in `DisruptionHubScreen`, the local feed simulations, `PersonaId` in the API type files and `domain/personas` use in domain code, and the `src/api/personaIds.ts` guid mapping. Stale "mock mode" comments remain in `feeds/*`, `sync/*` and `ai/concierge.ts`.

## Phase 3 record

### Step 1: sailings, ports, itinerary, ship zones (built 2026-11-02)

**Server C# not compiled or run** (project rule); the route is registered in `SwaggerCoverageTests` but no test exercises it.

- **Server:** `GET /reference/sailings` (`ReferenceRules.Sailings`, `ReferenceEndpoints.cs`; data model section 6.9 table) answers `{ version, sailings[{ id, departure, holiday, reference }], ports[{ id, name, zone, tender }], itinerary[{ day, port, arrive, allAboard, depart }], shipHomeZone, shipWestZone }`. Sailings come from `ref.Sailings`; the itinerary and ports from `Itinerary`. `version` is a hash of the content.
- **Client:** `src/domain/sailingsServed.ts` (`normalizeSailings`, all-or-nothing: one reference sailing, unique ids, eight days in order, every port listed, valid dates and times; `applySailings`) swaps the table into `sailings.ts` in place (`replaceSailings`: `SAILINGS`, `PORTS` and the reference object keep their identity; the itinerary template and the two ship zones are module values). `runtime/index.ts` `loadSailings()` applies the cached answer at once, then the server's, and caches the raw answer (`cacheGet`/`cachePut` kind `sailings`). Screens redraw through the catalogue's change notice (`useCatalogue`).
- **Verified:** `npm run test` (1533 passed, including `sailingsServed.test.ts`), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`, `npm run db:check`.
- **Not done in step 1:** the authored sailings, ports and itinerary in `sailings.ts` still exist as the first-paint fallback (the plan's "cache, not copy" needs a loading state on 65 screens; do it with Phase 7 when the gate closes). The rules over the table (`shipClockChanges` on days 4 and 7, `stageStarts` offsets) stay on the client. The audit gate's `sailings` ratchet is unchanged. A real account's sailing the client table does not know now resolves once the table arrives.
- **Next:** steps 2 to 8 (ship and deck, programme, port guides, packages, option lists, excursions/dining copies, version/ETag on every reference route), one per phase stop.
