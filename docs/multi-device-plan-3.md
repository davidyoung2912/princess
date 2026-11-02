# Multi-device plan 3: a client with nothing of its own

Status: **Plan written 2026-11-02 from a second audit of the front end and back end. Phases 1 and 2 built; Phase 3 built in full (steps 1 to 8, see its record, with the authored first-paint copies kept); Phase 4 built in slices 1 to 7; Phase 5 built (see its record); Phase 6 built (server C# not compiled or run); Phase 7 built as a wider ratchet, not an empty gate (see its record).** Follows `docs/multi-device-plan.md` and `docs/multi-device-plan-2.md`. It replaces their "mock mode keeps working" rule (see Decisions).

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
- **(Done in Phase 4 slice 4.) Two older weather stubs** (`PlanRules.WeatherFor`, `AboardRules.WeatherOn`) still back `SimWeatherService.Climate/Today`, apart from `FeedRules` for `/feeds/sky`. Packing, the day brief and the sky can disagree.
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

### Step 2: ship, categories, deck places, elevators, muster stations (built 2026-11-02)

**Server C# not compiled or run** (project rule); the route is registered in `SwaggerCoverageTests`, no test exercises it.

- **Server:** `GET /reference/ship` (`Domain/ShipReference.cs`, data model section 6.9 table) answers `{ version, ship, highlights, categories, accessibility, otherShips, places, elevators, muster }`. The content was moved from `ship.ts` and `deck.ts` by script into one embedded JSON block in `ShipReference.cs` (parsed once into DTOs); `version` is a hash of it. There is no database table for places or elevators yet, so it is authored in C# like `ReferenceRules.Difficulty`.
- **Client:** `src/domain/shipServed.ts` (`normalizeShip`, all-or-nothing: valid sections, kinds and letters, unique place ids, muster stations at listed places; `applyShip`) swaps the values into `ship.ts` (`SHIP`, `SHIP_HIGHLIGHTS`, `CATEGORIES`, `SHIP_ACCESSIBILITY`, `OTHER_SHIPS`) and `deck.ts` (`PLACES`, `DECKS`, `ELEVATORS`, `MUSTER_STATIONS`) in place. `SHIP` lost `as const` (it is now a `ShipFacts`). `runtime/index.ts` `loadShip()` applies the cached answer, then the server's, and caches the raw answer.
- **Verified:** `npm run test` (1545 passed, including `shipServed.test.ts`), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`, `npm run db:check`.
- **Not done:** the authored copies stay as the first-paint fallback (same reason as step 1). Category prices still come from the server's quote; the `ratio` here is display only. `cabins.ts` (sample staterooms) is not in this step: the server already serves cabins through `/sailings/{id}/cabins`, so the client generator goes with the Phase 4 cabin guide.

### Steps 3 to 8 (built 2026-11-02)

**Server C# not compiled or run** (project rule). Every new route is registered in `SwaggerCoverageTests`; none has a test of its own yet.

- **One loader.** `runtime/index.ts` `loadTable(kind, path, normalize, apply)` applies the cached answer at once, fetches the route anonymously, applies it when its `version` differs, and caches the raw answer. Sailings, ship, programme, ports, packages, limits and the catalogue all use it. Every table is read all-or-nothing by a `normalizeX` function and swapped in place by `replaceX`, so existing imports see the new values and `useCatalogue` redraws (`notifyCatalogue`).
- **Step 3, programme.** `GET /reference/program` (`ProgramRules.Reference`): events and the plan changes in force. New seam `IProgramChanges` (`SimProgramChanges`, registered in `Program.cs`); `OnboardService.ProgramAsync` reads its changes from it and `ProgramRules.On` takes them as an optional argument. Client: `programServed.ts`, `replaceProgram`.
- **Step 4, ports.** `GET /reference/ports` (`PortsReference.cs`, the guides, port knowledge and map coordinates as one embedded JSON block moved from `ports.ts` and `portContent.ts` by script and checked equal to the source) answers all ports at once rather than one route per port (three ports; one fetch and one cache). Client: `portsServed.ts`, `replacePorts`, `replacePortKnowledge`.
- **Step 5, packages.** `GET /reference/packages` (`PackageRules.Reference`): add-on names, blurbs, units, bases, price changes and minimum ages, the average drink and cover figures, the service charge and the refund window. `AVG_DRINK`, `SERVICE_CHARGE`, `AVG_COVER` and `CANCEL_UNTIL_DAYS` are now live `let` exports. Prices a guest pays are still worked out by the server. Client: `packagesServed.ts`.
- **Step 6, option lists and limits.** I read the exported constants of the 18 files. Scalar limits, windows, fees and rates whose name and value match a `public const` in the server rules (64 of them, found by script) are served by `GET /reference/limits` (`LimitsReference.cs`; each entry is the rule's own constant, so a screen's limit is the rule that checks it). Client: `limits.ts` (`limit(name, set, initial)` registers a setter; `setLimits` applies by name and kind), the 64 constants are now `export let` with a registration line, `limitsServed.ts`. A test checks that at least 64 are registered.
- **Step 7, excursions and dining.** `Venue` on the server gained `Deck`, `Cuisine`, `Dress` and `Menu`; the catalogue answers them, so the client takes dining rooms whole (`replaceVenues` replaces `replaceVenueTerms`). The catalogue answer gained `version`.
- **Step 8, cache and versions.** Every reference route above carries `version` (a hash of its content) and the client keeps the last answer in `localStorage` (kind `catalogue`, `sailings`, `ship`, `program`, `ports`, `packages`, `limits`, key `v1`). The cache keeps working after a restart and a stale one is replaced when the version differs.
- **Verified:** `npm run test` (1586 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`, `npm run db:check`.
- **Not done (honest list):**
  - **The authored copies are still in the client** as first-paint values (sailings, ship, deck, programme, port content, add-ons, excursions, dining). "Delete the copies" needs a loading state on most screens; it belongs with the Phase 7 strict gate. `catalogueParity.test.ts` stays while the copies do (its dining check now covers deck, cuisine, dress and menu).
  - **`EVENTS` and `PLAN_CHANGES` are not deleted** and `eventsOn` still runs on the client over the served table; `/onboard/program/{day}` is not yet the only source. Moving `eventsOn`, `planChange.ts`, `autopilot.ts` and the search index to async server answers is a Phase 4 job with the Autopilot optimiser.
  - **Step 6 is the scalars only.** Arrays, records and objects (`REQUEST_ITEMS`, `BAR_MENU`, `SLA_HOURS`, `TIER_DAYS`, `PRICES`, `DESK`, `BREATH`, `FAQS`, `CANCEL_ROWS`, `LEGAL`, `TAG_GROUPS`, `ONWARD_MODES`, `PHOTOGRAPHERS`, `SPOTS`, `MENU`, `DIRECTORY`, `CHANNELS`, `HUNT`, `TRIVIA`, the quiz and consent lists, and so on) are still client copies. The 25 scalars with no same-named server constant (`TOPUP_*`, `MAX_DEVICES`, `MAX_DAYS`, `MAX_PER_LINE`, `MAX_LINES`, `ISOLATE_HOURS`, `CASH_LIMIT_USD` and others) are inline or differently named in C#; moving them into named constants and `LimitsReference` is the next small job. `MAX_PARTY`, `SITTING_MINUTES` and `FREE_CANCEL_DAYS` in `dining.ts` and `excursions.ts` are likewise not served.
  - **The cache has no maximum age** (Phase 5) and `/reference/access` and `/rates` have no `version`.
  - **`SEEDED_PURCHASES`, `REFERRALS`, `FCC_LEFT` and `DINING_PLAN`** are demo data keyed by persona and go with the persona removal in Phase 7.

## Phase 4 record

### Slice 1: the client stops simulating the feeds (built 2026-11-02)

**Server C# not touched** (no change needed: every route already existed). Only the front end changed in this slice.

- **One feed pattern, server only.** `src/feeds/feed.ts` `createFeed(key, normalize, kind?)` has no local value. `now()` is this session's server answer, else the last answer kept on the device (`princess:cache:feed-<kind>:<key>`, only when `kind` is given; feeds keyed by the minute are not kept), else `null`. `load()` asks once per key and session; a failure or a malformed answer leaves what is known. `forget()` (sign-out) clears memory and the kept copies.
- **Converted:** `fares`, `flight`, `portCrowd`, `sky`, `route` (the five hand-written copies of the pattern) now use `createFeed` (`faresFeed`, `flightFeed`, `crowdFeed`, `skyFeed`, `conditionsFeed`); `skyNight`, `storm`, `onboard` (loungers, found, sightings, slot-watch opening) and `pulse` lost their local argument. Kept on device: fares, flight, crowd, sky, route, sky-night, storm, found, sightings.
- **Deleted from the client:** `crowdFor`, `fareHistory`, `simWeather`, `conditionsFor`/`routeConditions`, `flightStatus`, `skyNight` (with `sunTimes`, `moonAt`, `POSITIONS`, the star table), `stormWatch` (with the monthly chances), `loungerOthers`, `FOUND`, `seenToday`, `simulatedOpening`, and their tests. `domain/sky.ts` and `domain/storm.ts` now hold only the answer shapes (and `bestSpot`). `watchState`/`bookWatch` take the server's opening time as a required argument, `loungerBoard` and `matchFound` take the server's list.
- **Screens** show a polite `FeedWaiting` banner (`feed.waiting`) in place of figures that have not arrived: sky guide, storm watch, port crowd card, route conditions card, price watch, lounger board, lost and found, sightings, Autopilot's sky line. The briefing leaves out the weather and sunset lines, gentle mode skips its heat and sun notes, the nudge cards skip the storm nudge, and Getting There adds no extra leave-earlier time until the answers arrive. The Port Day Pilot works out its plan with a middling crowd until the crowd arrives (a planning default, not a figure shown).
- **Audit gate:** `src/feeds/feed.ts` is listed as a cache helper allowed to use `localStorage`.
- **Verified:** `npm run test` (1572 passed), `npm run lint`, `npx tsc -b`, `npm run build`.
- **Not done in Phase 4 yet:**
  - **Pulse** was finished in Slice 3.
  - **The server providers** `IEmbarkQueue`, `ISailingQuality`, `ICabinGuide`, `IServiceStatus`, `IFriendReply`, `IDisruptionContent`, the weather unification (`IWeatherService.Climate` and `Today` through `FeedRules`) and `POST /me/autopilot/plan` are untouched. So are the client side of `optimiseWeek`, `chooseCabins`/`compareMatrix`, the embark queue and service-status simulations, the hub content, `AskScreen`'s local `ask()`, `domain/assistant.ts` and `ai/scripted.ts`/`tools.ts`/`guard.ts`.
  - **Server-side hash formulas** the client no longer mirrors: the server's feeds are now the only definition. Their C# tests should be run by the user at the next compile check.

### Slice 2: concierge, decide notes, friend replies, embark queue, cabin guide (built 2026-11-02)

**Server C# not compiled or run** (project rule). New routes are listed in `SwaggerCoverageTests`; rule tests were written and not run (`SailingQualityRulesTests`, `EmbarkQueueRulesTests`, `CabinGuideRulesTests`, and the bad/good queries in `OnboardFeedApiTests`).

- **Concierge.** `AskScreen` now asks the server concierge (`POST /me/concierge` through `ai/concierge.ask`) instead of `domain/assistant.ts`; its plan-change, item and excursion previews are unchanged. `domain/assistant.ts`, `ai/scripted.ts`, `ai/tools.ts` and their tests are deleted. When the server cannot be reached the guest is told so (`ai.unreachable`); nothing is answered from the device. **`ai/guard.ts` stays**: `ask()` still runs `screen()` first so an emergency or medical message shows the numbers to call with no signal, and `HandoffCard` and `handoff.ts` use it to pick the card.
- **`ISailingQuality`** (`Domain/SailingQualityRules.cs`, `GET /feeds/sailing-quality?sailing=`): the five decide notes moved from `dream.ts`. Client `feeds/sailingQuality.ts`; `DecideScreen` shows a waiting banner until they arrive.
- **`IFriendReply`** (`GET /feeds/friend-reply?name=`): the pretend sail-again reply moved from `memoryBook.ts`. Client `feeds/friend.ts`, never kept on the device; it is asked only when the guest presses the existing button for a contact they added with consent. The contact's name goes to the server for this one call.
- **`IEmbarkQueue`** (`Domain/EmbarkQueueRules.cs`, `GET /feeds/embark-queue`): windows, waits, forecast and the recommended window for the guest's needs. `reachableWindows`, `recommendWindow`, `waitFor` and `forecast` are gone from `embark.ts`; `swapEffect` is arithmetic on the served waits. Client `feeds/embark.ts`, `EmbarkPlanScreen`.
- **`ICabinGuide`** (`Domain/CabinGuideRules.cs`, `GET /sailings/{id}/cabin-guide`): scoring, reasons, sun side and filters moved from `cabinScore.ts` (which keeps the shapes, `notIncluded` and `compareMatrix`, now fed the served score of each picked cabin). Client `feeds/cabinGuide.ts`, `useFeedList` for the comparison, `CabinChooserScreen`.
- **Verified:** `npm run test` (1531 passed), `npm run lint`, `npx tsc -b`, `npm run build`.
- **Still not done in Phase 4:**
  - **Weather unification** (`IWeatherService.Climate`/`Today`/`Sky` through one model): `Sky` is keyed by sailing id and day with no date, while climate is by month, so one model needs a date on the sky route first.
  - **`POST /me/autopilot/plan`:** `optimiseWeek` rests on the client's `buildDay` over the programme, which the server's concierge `build_day` does not match (no events), and `basePlan` is used by plan changes and the day screens. Porting them together is its own slice.
  - **`IDisruptionContent`/`IServiceStatus`:** the hub definitions are keyed i18n strings (`HUB`, `GUIDES`, `OUTAGE_WORKS`) and the callback queue estimate (`queueEstimate`) is still local; serving them means serving the text as well.
  - **Pulse** keeps its local model (see slice 1). `domain/cabins.ts` stays for `findCabin`, boarding and the booking helpers.

### Slice 3: Pulse server-only, callback queue served (built 2026-11-02)

- **Pulse:** `GET /feeds/pulse-day?departure=&day=` returns `{ day, startAt, venues: { <id>: [48 levels] }, source }` (half-hour steps from ship-zone midnight). The client's local model (`SHAPE`, `ASHORE_DROP`, wobble) is deleted; `PulseEnv` is `{ hour, served }`, `levelAt` reads the live minute first and the served day second, and a moment with neither reads 0. Pulse and Calm show `FeedWaiting` until the answers arrive.
- **Callback:** `queueEstimate` and `requestCallback` are removed from `domain/disruptionHub.ts`; the hub asks `POST /me/staff-requests` and, if it fails, says so with the guest services number instead of pretending.
- **Verified:** `npm run test` (1531 passed), `npm run lint`, `npx tsc -b`. C# is written but not compiled here; run its tests at the next compile check.
- **Still not done:** weather unification (`IWeatherService.Climate`/`Today`/`Sky` through one model; the sky route needs a date); `POST /me/autopilot/plan` (needs `buildDay`/`basePlan` with programme events ported to C#, shared with plan changes and the day screens); hub content, service status and guides (i18n-keyed text). `ai/guard.ts` stays on the client on purpose, for the offline emergency screen.

### Slice 4: one weather model (built 2026-11-02)

**Server C# not compiled or run** (project rule); tests written, not run.

- **One model.** The month's climate (`PlanRules.WeatherFor`) is the base. `FeedRules.RainOn(date)` draws whether the afternoon rains from the month's odds (low 1 in 8, some 1 in 4, high 1 in 2) and the hour; `FeedRules.Sky(date, port)` takes UV from the port, the temperature from the month's high (0 to 2 °F under) and the rain from `RainOn`; `AboardRules.WeatherOn` says "Showers likely" exactly when `RainOn` does. So packing advice, today's weather and `/feeds/sky` agree. Today's high and low and the sea line are unchanged; for 2027-03-22 the draw is dry, so the existing "Mostly sunny" test still holds (checked by hand).
- **Route change.** `GET /feeds/sky` now takes `date=YYYY-MM-DD&port=` (was `sailing`, `day`, `port`), so the sky has a date. `IWeatherService.Sky(DateOnly, string)`. Client: `skyFeed` and `useSky` take `(date, port)`; `useDayPlan` passes the itinerary day's date.
- **Tests:** `FeedRulesTests` rewritten, plus `TheSkyTodaysWeatherAndThePackingAdviceAgree` (a year of dates), `ProviderTests` updated.
- **Verified:** `npm run test` (1531 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`.
- **Remaining Phase 4:** see below.

### Slice 5: the week optimiser on the server (built 2026-11-02)

**Server C# not compiled or run** (project rule); tests written, not run.

- **Scope, narrower than first feared.** The optimiser needs only `buildDay` (tour pick, event pick, dinner) over the server's own excursion catalogue, programme (`ProgramRules.On`, `TimingProblem`) and ship places (`StepFree`), all already there. It does **not** need `basePlan`, so `basePlan`, the plan-change rules and the day screens were not ported. The client keeps `buildDay`/`basePlan` for those.
- **Server:** `POST /me/autopilot/plan` (`Domain/AutopilotRules.cs`, `Services/AutopilotService.cs`, route in `ConciergeEndpoints.cs`) takes `{ sailingId, prefs }` and answers the week. It keeps and books nothing; the sailing must be a known sailing; bad prefs or sailing are `400 badAutopilot`. Ties break on id in ordinal order, as the client did. Tests: `AutopilotRulesTests` (same cases as the deleted client tests, plus validation) and the Swagger list.
- **Client:** `optimiseWeek`, `weekProblems` and their tests are deleted from `domain/autopilot.ts` (the shapes stay). `feeds/week.ts` (`weekFeed`, `normalizeWeek`, `weekKey`) and `hooks/useWeek.ts`; `WeekPlanner` shows `FeedWaiting` and a disabled Apply button until the week arrives. `applyWeek` takes the served week; its two tests use `domain/weekFixture.ts` (test only).
- **Verified:** `npm run test` (1530 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`.
- **Still open in Phase 4:** `buildDay`, `basePlan` and the plan-change rules are still client copies behind the day screens (a `POST /me/day-plan` style route would retire them); `applyWeek` computes the per-day edits from the client's `basePlan`, so it can disagree with the server's week if the two catalogues ever differ. Hub content, service status and guides wait on a localisation decision; `ai/guard.ts` stays by design.

### Slice 6: the day plan on the server (built 2026-11-02)

**Server C# not compiled or run** (project rule); tests written, not run.

- **Server:** `POST /me/day-plan` (`Domain/DayPlanRules.cs`, `AutopilotService.DayAsync`) is `buildDay` plus the day parts of `planChange.ts`: the items with their lengths, outdoor flag, path and reason, the "back by" time, the included events that could join the day, and the ship's moved or cancelled events (from `IProgramChanges`). `AutopilotRules` now builds on `DayPlanRules.Build`, and each day in the week carries `base` (the guest's wishes) and `target` (the week's), so applying a week needs no day plan of its own. Tests: `DayPlanRulesTests` (the deleted client cases plus ship changes, wish checks and base/target); Swagger list updated.
- **Client:** `buildDay`, `bestTour`, `pickEvents`, `basePlan`, `alternativesFor` and their tests are deleted. `domain/day.ts` holds only `DayWish`. `feeds/dayPlan.ts` (`dayPlanFeed`, `wishKey`, `normalizeDay`) feeds `useDayPlan` (which now says `ready`), the Build my day screen, tomorrow's first item in the briefing and `programmeFollows` (now async: it asks for the day it needs first). `shipChangesFor` reads the server's list. `applyWeek(s, week, changes, now)` uses the week's own `base` and `target`, so it can no longer disagree with the server's week.
- **Plan-change rules stay on the client on purpose:** `applyChanges`, `proposeReflow`, `acceptChange`, `undoChange` and `requestChange` work on the guest's own changes and the rows the server gave, and use no catalogue. They are the guest's decisions, not data the server serves.
- **Verified:** `npm run test` (1528 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`.
- **Not done:** until the day arrives, `useDayPlan` gives an empty plan with `ready: false`; only Autopilot and Build my day wait on it, the briefing, summary, calm, ask and finish screens still read the empty plan for that moment. `programmeEffects` still checks `eventById` on the client programme table. Hub content, service status and guides still wait on a localisation decision, and `ai/guard.ts` stays by design.

### Slice 7: waiting states on the day screens, more served limits (built 2026-11-02)

**Server C# edit not compiled or run** (project rule): 51 entries added to `LimitsReference`, and two new constants.

- **Day screens wait for the day.** Read aloud, the plain-English summary, Calm (its visual schedule and sensory plan), the briefing (lines, read aloud and copy) and Ask (a change request) now show `FeedWaiting` or the existing loading line until `useDayPlan(...).ready`, instead of reading an empty plan as a free day.
- **Limits.** 51 more scalars are served by `GET /reference/limits` (115 in all): `TOPUP_*`, `MAX_DEVICES`, `MAX_DAYS`, `MAX_PER_LINE`, `MAX_LINES`, `MAX_PARTY`, `SITTING_MINUTES`, `FREE_CANCEL_DAYS`, the queue and waitlist windows, the fare and trip money rules, booking ages, chat escalation and others. Each had a server constant of the same value, found by script and checked equal, except `ISOLATE_HOURS` (`HealthRules.IsolateHours`) and `CASH_LIMIT_USD` (`DisembarkRules.CashLimitUsd`), which were new constants. `limitsServed.test.ts` now loads every domain module and expects 115 registrations.
- **Left on the device on purpose:** names that are ambiguous on the server (`MAX_MESSAGE`, `NOTE_MAX`, `DUE_SOON_DAYS`, `ADULT_AGE`, `MAX_GUESTS`, `MAX_ITEMS`), `MAX_LINES` in `briefing.ts` (a display cap, not the order limit), the offline emergency and support numbers, demo codes, feed sources and structural figures (`NIGHTS`, `HOME_ZONE`), and pure interface caps (diagnostics, outbox, titles).
- **Still not served:** the arrays, records and objects listed in the Phase 3 record (`REQUEST_ITEMS`, `BAR_MENU`, `FAQS`, `LEGAL` and so on).
- **Verified:** `npm run test` (1528 passed), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`.

## Phase 5 record

Built 2026-11-02. **Server C# not compiled or run** (project rule); the new tests are written, not run.

- **Sign-out clears the person's copies.** `data/lifecycle.ts` `isPersonKey` / `clearPersonCopies` remove every `princess:*` key that belongs to a person (documents, saved copies, feed answers, demo controls). Kept: display settings (`princess:settings*`), diagnostics, the improve switch and waiting reports, the shared reference tables (`catalogue`, `sailings`, `ship`, `program`, `ports`, `packages`, `limits`). `signOutSaving` flushes, signs out, then clears; if the sync indicator still shows an unsent document or port row it clears nothing, and the unsent outbox is always left.
- **One owner per device.** `princess:owner` holds the server user id the copies belong to. When a different person signs in, `claimDevice` (runtime) removes the earlier person's copies (the unsent outbox excepted). A shared phone never shows or sends the wrong person's data.
- **The server is the source.** `sync.ts` no longer imports a device copy when the server has none: it applies "empty" instead. The two exceptions are the guest's own acts: a change made before the first answer arrived, and a document held back by the guest's choice (health details, private notes, the concierge thread, family contacts) that they later turn on. The persona-keyed `localId === null` branch is gone. A new or cleared device simply pulls.
- **Maximum age.** `cacheGet(..., now)` refuses a copy older than its kind's limit (`maxAgeFor`: feeds one day, the programme three, everything else thirty, including the `found` pass). Callers pass the clock the copy was saved by (`Date.now()` for tables and feeds, `demoNow()` for saved screens and passes). Without `now` there is no limit (tests).
- **Staff tickets on the server.** `dbo.StaffTickets` (schema, drop-all and data model section 4), `IStaffTicketStore` (Dapper plus an in-memory test double). `POST /me/staff-requests` keeps the ticket; new `GET /me/staff-requests` lists the last two hours with `status` (`waiting|due|lapsed`) and a position that counts down (`StaffRules.Status`); `DELETE /me/staff-requests/{id}` cancels (404 for someone else's). The queue (`IStaffQueue`) still only answers; a real desk reads the table. The hub's call-back card reads the server's ticket (`staffTickets`, `normalizeCallbacks`) and cancels through the server; the `callback` field left the `hub` document, so a second device sees the same ticket. Tests written, not run: `StaffTicketRulesTests`, `StaffTicketApiTests`, and the two routes in `SwaggerCoverageTests`.
- **Unsent-change stores.** There are three, and the sync indicator covers all: the synced documents, the port day's rows (`portRows`) and the outbox of unsent messages and requests (`data/outbox.ts`, keys `princess:outbox:*`, which exist only while an outbox is non-empty). `syncStatus()` now reports `error` (waiting for the connection) when any outbox holds something. Everything else on the device is a copy of server data or a display setting.
- **Verified:** `npm run test` (1535 passed, including `data/deviceCopies.test.ts` and the changed `sync.test.ts`), `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`, `npm run db:check`, `npm run db:seed:check`.
- **Not done:** `personaById` is still used by `bindings.ts` and `portRows.ts` (`bookerOf`) and by the settings owner switch; it goes with the persona table in Phase 7. `/reference/access` and `/rates` still have no `version`. The `hub.cb.sim` copy still says "pretend queue". Reference-table caches (thirty days) are not swept; they are refused on read and replaced on the next load.

## Phase 6 record

Built 2026-11-02. **Server C# not compiled or run** (project rule); the new tests are written, not run. Run `dotnet build server/Princess.sln` before relying on it.

- **One registration point.** `Services/ProviderRegistration.cs` `AddProviders(config)` replaces the hand-written registrations in `Program.cs`. Each seam (`Weather`, `Flight`, `Route`, `Telemetry`, `StaffQueue`, `FareFeed`, `ProgramChanges`, `StormOutlook`, `LostProperty`, `SlotWatchFeed`, `SailingQuality`, `EmbarkQueue`, `CabinGuide`, `FriendReply`, `PaymentGateway`, `TelemetrySink`) is chosen by `Providers:<Key>`, default `sim`; an unregistered name stops start-up and lists the choices. `Providers:Concierge` is `sim` or `anthropic` (unset: `anthropic` when `Concierge:ApiKey` exists, else `sim`). No real provider exists yet, so each seam lists only `sim`.
- **Concierge limit in the database.** `IConciergeLimiter` with `DapperConciergeLimiter` (`dbo.ConciergeUses`, schema, drop-all, data model) as the default and `MemoryConciergeLimiter` for `Providers:ConciergeLimit=memory` (the test factory sets it). The old `ConciergeLimiter` class is gone.
- **Contract tests.** `ProviderContractTests` runs one check per implementation of every seam in the catalogue (plus start-up selection, unknown names, the limiter). A seam added without a check fails with a message.
- **Docs.** `server/README.md` has a "Providers" section: what each interface must return, timeouts, and the fall back to the simulation.
- **Verified:** `npm run db:check`, `npm run db:seed:check`; the npm checks below.
- **Not done:** no real provider was written, so the timeouts and fall-backs in the README are guidance, not code (there is no wrapper that falls back to `sim` on failure); `Providers:*` is not shown in `appsettings.json`.

## Phase 7 record

Built 2026-11-02 as a ratchet, **not** the empty gate the plan described. `src/auditGate.test.ts` now also fails on: any IndexedDB, `idbStore`, `*Mock` or `mockProvider` reference; `VITE_API_URL` read anywhere but `src/runtime/index.ts`; a new file importing the persona table or ids (44 known); a new file naming a `'sim'` source (15 known). The two older lists (101 screens importing authored modules, 3 screens using `localStorage`) are unchanged.

- **Why not empty:** the catalogue modules (`sailings`, `pricing`, `excursions`, `dining`, `ports` and so on) still hold authored first-paint copies (kept deliberately in Phase 3), so 101 screens import them for display and formatting. Emptying that list means deleting those copies and every screen waiting on the served table. The persona table is typed into 44 files (`PersonaId`).
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`, `npm run db:check`, `npm run db:seed:check`.

## Follow-up fixes (2026-11-02)

After Phases 6 and 7, in separate commits: `Providers:*` shown in `appsettings.json`; `sweepExpiredCopies` removes expired reference tables and feed answers at start-up; `programmeEffects` trusts the served entry kind (the client `eventById` is gone); every client `'sim'` source (types, constants, feed results, one on-screen "source" word) is removed and the audit gate now requires **none** (the server still sends `source`; the client ignores it). The day screens already waited for the served day (Slice 7), so nothing more was needed there. Still open: `version` on `/reference/access` and `/rates` (a server C# edit, left for the next server phase), the persona table (44 importers), the 101 catalogue-importing screens, the unserved arrays, a provider fall-back wrapper, and the localisation-only "simulated" copy in `en.ts`.

### Served content (built 2026-11-02, after the follow-up fixes)

**Server C# not compiled or run.** The arrays and records of the 18 domain modules (about 100: `REQUEST_ITEMS`, `BAR_MENU`, `FAQS`, `LEGAL`, `MENU`, `DIRECTORY`, quizzes, tags, drill languages and so on) are registered with `registerContent('<module>', { ... })` (`src/domain/content.ts`). `npm run content:gen` writes them to `server/Princess.Api/Content/reference-content.json`, embedded in the assembly and served by `GET /reference/content` (`ContentReference`, `version` = hash). The client loads it with the same `loadTable` as the other tables (kind `content`) and `setContent` replaces each list or record **in place**, so no importing file changed. `contentServed.test.ts` fails when the embedded file is stale. Left out on purpose: `EMPTY_*` and `DEFAULT_*` (shapes of a guest's own documents) and the persona-keyed demo data (`REFERRALS`, `FCC_LEFT`). The authored copies stay as first paint, as in Phase 3.

**Found and fixed:** every `/reference/*` route requires a sign-in on the server, but the client had fetched them with no token (so they answered 401 and never loaded). The runtime now applies the kept copy at start and asks the server with the person's token each time someone is signed in (`loadTables`). Before sign-in only the kept copy and the authored first-paint copy are in use.

**Copy reworded (2026-11-02):** `hub.cb.sim`, `crowd.sim`, `journey.watch.sim`, `journey.cond.sim`, `autopilot.simulated`, `fare.sim` and `pwatch.sim` no longer say "pretend" or "simulated"; they say the figure is an estimate. Left as they are, on purpose: the labels a promise test requires (`lounge.sim`, `kreport.sim`, `sight.sim`, `chain.sim`, `allergy.sim`) and the safety and payment notes that tell the guest a reply is not real (allergy, sick, kit, wallet). Whether those disclosures stay is a product decision.

### Personas removed, catalogue imports reduced (2026-11-02)

- **Persona table gone.** `domain/personas.ts` and `api/personaIds.ts` are deleted. People come only from `GET /me/context`; ids are the server's guids and pass through `httpApi` unchanged (no slug/guid swap). Types live in `domain/people.ts`. `Session.personaId`, the `demo` sign-in method and `personaForEmail` are gone. Scenarios steer by `audience` (`all` or `family`: a trip with a child) instead of persona lists; the story style default is one constant. Deleted as dead (only tests used them): `defaultProfile`, `normalizeProfile` (account), `assignmentFor`, `seqOf`, `bookingNumber`, `pastTrips`, `paysLate`, `finalPaymentDays`, `loyaltyStatus`, `daysBefore`, `referralCode`, `REFERRALS`, `FCC_LEFT`, `fccBefore`, `SEEDED_HELPER`, `SEEDED_PURCHASES`. Lost: a demo account no longer gets an authored role, stateroom kind or default text size on the client (neutral values; the server never held them). The gate now fails on any persona import or persona name in `src`. The seed generators keep their own people in `scripts/persona-seed.ts`.
- **Catalogue screens: 115 to 66.** `formatMoney` and `Cents` moved to `domain/money.ts`, so screens that only format money no longer count as importing the pricing catalogue.
- **Why 66 remain (not removable safely now):** they read `PORTS`, `sailingById`, `itinerary`, `shipZoneAt`, `SAILINGS` and the like, which are served in place but still hold an authored first-paint copy. Deleting the copies blanks the signed-out pages (landing, sailings list), because the reference tables need a sign-in on the server and load only after sign-in. Deleting them needs: (1) public reference routes (an owner decision on `AllowAnonymous()`), (2) a loading state on each of those screens, (3) a browser check, which this project's rules exclude. The ratchet in `auditGate.test.ts` keeps the list from growing.

### Authored reference data deleted from the client (2026-11-02)

- **Emptied:** the sailings, ports, excursions, dining rooms, port guides and port knowledge. The client holds none of it; `loadTables` fills the stores in place from `GET /reference/*` (fetched with the token).
- **`ReferenceGate`** (in `SignInGate`): after sign-in the app waits for `catalogue`, `sailings` and `ports` (or a kept copy), shows a retry if they fail, then draws. The signed-out family page `/at-sea/:token` is exempt and degrades to an empty itinerary rather than crashing.
- **Tests** seed the stores from `src/testing/reference-fixture.json` through the vitest `setupFiles` entry `src/testing/setup.ts`. `emptyStart.test.ts` loads every module unseeded and checks the stores stay empty. The gate forbids anything outside tests importing `src/testing`.
- **Catalogue screens: 66 to 0.** The gate list is empty. `pulse` (which venues the Pulse screen shows) and `cabinScore` (comparison logic) hold no reference data and left the gate's module list; only `pricing` remains on it.
- **Still on the client:** the fare tables (`INTERIOR_FARE`, `FUTURE_DEPARTURES`, taxes, gratuities, `FARES`) used for estimates. Real quotes come from the server. Serving these through a `GET /reference/pricing` route is the next candidate. The server C# was not compiled here.

### Fare tables served, `/rates` version (2026-11-02)

**Server C# not compiled or run** (please `dotnet build server/Princess.sln`).

- **`GET /reference/pricing`** (`PricingReference.cs`, secured like its siblings): the interior fare by open sailing, the next-season departures (id, date, fare), taxes and fees, the nightly gratuity by room type, and the three fares (name, nightly price, tagline; `FareInfo` gained `Tagline`). `version` is a hash of all of it. Client: `pricingServed.ts` (`normalizePricing`, `applyPricing`), `replacePricing` in `pricing.ts`, in the `TABLES` list as `required`, cached under `pricing`.
- **Client tables emptied:** `INTERIOR_FARE` (now exported and filled in place), `FUTURE_DEPARTURES`, `TAXES_AND_FEES`, `GRATUITY_PER_NIGHT(_SUITE)` and the `FARES` names, prices and taglines. The fare rules (`quote`, `bookingQuote`, `fareFor`) stay on the client over the served tables. `lowestFromPrice` returns null with no sailings.
- **Tests** get the tables from the `pricing` entry in `reference-fixture.json`, seeded by `src/testing/setup.ts`; `emptyStart.test.ts` checks they are empty on a cold start.
- **`/rates`** now carries a `version` (hash of the day and rates). The client ignores it for now: the table is read on demand and `asOf` still drives the stale note.
- **Left as recorded decisions:** the provider fall-back wrapper waits for the first real provider; the ~100 content arrays keep their authored first-paint copy (their data is already served and replaced in place).
