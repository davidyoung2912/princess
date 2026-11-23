# MCP integration plan

Plan for bringing the Model Context Protocol (MCP) into Princess, written 23 November 2026 from `docs/princess_stanley_free_mcp_services_research.md` plus a live probe of the public endpoints and a read of the existing code. It covers Stanley and the rest of the app, and adds Google Maps visuals for places and routes.

## 1. What the live probe changed

The research document lists providers from their documentation. On 23 Nov 2026 I called each endpoint from this machine (`initialize`, then `tools/list` and a few `tools/call`). Four of its assumptions do not hold, and the plan is built around that.

| Provider | Probe result | Consequence |
|---|---|---|
| GoVisit `https://govisit.ai/mcp` | Works with no key. Plain JSON-RPC over HTTP POST. 23 tools. Tool names differ from the doc: `search_destinations`, `search_places`, `list_destination_highlights`, `list_destination_activities`, `list_destination_places`, `get_place_visit_facts`, `list_related_places` and others; most take a `pagePath` taken from an earlier search. | The adapter uses the real names. |
| GoVisit coverage | Prague, Barcelona and Cozumel match. **Kotor and Santorini do not**: the search returns unrelated fuzzy matches (Bozkır, Ko Chang, La Oliva). | An external result must pass a relevance gate (name match plus distance from the port) before Stanley may use it. When it fails, the authored guide answers. The research doc ranks GoVisit first for ports; for Princess ports it is a supplement, not the base. |
| Siloah `https://mcp.siloah.travel/mcp` | HTTP 403, Cloudflare bot challenge (`cf-mitigated: challenge`). | A server-to-server client cannot use it without defeating a bot check, which we will not do. Kept as a configured-but-disabled adapter; needs the provider's permission or an allowlisted key. |
| OctoTrip Flights | HTTP 403 `ua_blocked`: "Automated access from this client is blocked". | Same. We will not spoof a user agent. The flights operation ships with a local provider and a disabled adapter. |
| Currency MCP (`currency-mcp.wesbos.com`) | HTTP 404 at the documented root. | Not used. The app already has `Providers:Rates` (Frankfurter-compatible). |
| Open-Meteo MCP (`open-meteo.caseyjhand.com/mcp`) | Works. Replies as `text/event-stream`. | The client must parse both JSON and SSE replies. Free tier is non-commercial; it stays off by default and flagged. The existing REST provider (`Providers:Weather=openmeteo`) already covers the sky. |

Lesson for the design: public MCP endpoints are unreliable, differently shaped and sometimes hostile to automation. The gateway therefore treats every provider as optional, gated and replaceable, and the app must be fully useful with none of them reachable.

## 2. Principles

1. **Nothing depends on an external service.** Every canonical operation has a `local` provider built from data we own (99 authored port guides with 409 attractions that already carry coordinates, the ship's timetable, the deck plans). MCP providers enrich or replace it by configuration. No secret, account or approval is needed to run any phase.
2. **Back end only.** MCP clients live in `server/`, never in browser JavaScript. The front end stays a thin client and does not know which provider answered (CLAUDE.md). It does see **provenance** (see 3), because the research doc is right that third-party data must be labelled as such. That is a data-quality label, not a "simulated" label.
3. **Reuse the existing seams.** Providers are chosen in `ProviderRegistration` under `Providers:*`, wrapped in `ProviderGuard` (timeout, 3-failure circuit, fall back), reported at `/health/providers`. MCP providers register the same way, so one setting turns each off.
4. **Read-only.** Only an allowlisted set of tools per provider can be called. No booking, payment or change tool is reachable.
5. **Privacy by construction.** Outbound arguments are built from a typed record that has no field for a name, booking number, cabin, email or any guest id. Only a place, a date, an interest and a distance can leave. Enforced in code and covered by tests.
6. **External output is untrusted data.** Results are parsed into typed records, text is length-capped and stripped of control characters and markup, URLs are checked, and nothing returned is ever placed in the system prompt. Stanley receives it as clearly marked tool-result data.
7. **Authority stays with the app.** Arrival and all-aboard times, the guest's plan and the ship's facts come from our data only. An MCP result can suggest; it cannot set the return-to-ship time.
8. **Google Maps without a key or an account.** The official keyless Maps URLs (`search`, `dir` with waypoints and `travelmode=walking`) are the baseline and already exist for single places. In-app visuals are drawn by us as SVG (works offline, no tracking, no tile licence issues). An optional click-to-load Google embed appears only when a public, referrer-restricted Embed API key is configured.

## 3. Architecture

```
Stanley tool loop / REST endpoints / scripted fallbacks
        |
        v
Canonical operations (C# interfaces in Services/Mcp)
  IDestinationIntel   places and highlights for a port
  IWalkingRoutes      leg distances, times, visiting order
  IPortWeather        port-day forecast and marine
  ICruiseDiscovery    sailings and ships (phase 8)
  IFlightSearch       pre/post cruise flights (phase 8)
        |
        v   each: Providers:<Key> = local | mcp | (future) mobi
Provider adapters  --  McpToolCaller (guarded)  --  McpClient (Streamable HTTP)
                          |                           |
                  allowlist + egress policy     initialize / tools/list / tools/call,
                  response sanitiser            JSON or SSE replies, session id
```

- **`McpClient`** speaks the MCP Streamable HTTP transport with plain `HttpClient` and `System.Text.Json`: `initialize`, `notifications/initialized`, `tools/list`, `tools/call`; handles `Mcp-Session-Id`, JSON and SSE replies, JSON-RPC errors and `isError` results; per-call timeout. No new NuGet dependency, so nothing to restore or approve. It is small and fully unit-testable on strings.
- **`McpEgressPolicy`**: per provider, the tool allowlist and per-tool argument allowlist with value rules (length, pattern). A call outside it throws before any network I/O.
- **`McpSanitiser`**: bounds text, strips control characters and HTML, rejects instruction-like strings aimed at a model, validates URLs (https only, no credentials).
- **`McpProviderOptions`** (`Mcp:*` configuration): per provider `Enabled`, `Endpoint`, `TimeoutSeconds`, `Attribution`, `Licence` note, and `Commercial` (`true`/`false`) so a non-commercial-only source shows a warning in the runbook and in `/health/providers`.
- **Provenance**: every result carries `source` (`princess`, `external`, `estimate`), `provider` name, retrieval time and freshness. It maps onto the existing card provenance and adds one chip, "Third-party". External results are shown with attribution and the text "Not confirmed by Princess".
- **Audit**: tool name, provider, outcome, latency. Never arguments' free text and never any guest id.
- **Caching**: low-volatility answers (place lists, route legs) are cached in memory per provider with a TTL; weather has a short TTL; nothing priced or live is cached as current.

## 4. Where MCP helps across the app (not only Stanley)

| Stage | Surface | What it gains |
|---|---|---|
| 1 to 3 Dream, Discover, Book | Destination pages, sailing pages | Port highlights and maps; (later) external sailings comparison, labelled third-party |
| 5 Prebook | Port guide, excursion planner | Map of every attraction, walking legs, weather outlook for the date |
| 6 and 10 Travel to and from the ship | Travel page | (later) flight search links, ground-travel map |
| 7 Embark | Ship and terminal | Map of the terminal area and the way to the pier |
| 9 Port | Port screen, "Port day" plan, Stanley | **Core value**: a mapped, timed plan that respects the all-aboard time; weather-aware suggestions |
| 11 Remember | Memories | Place names and map pins for photos (local first) |
| Everywhere | Stanley | New read tools: places near the port, a walking route and plan, port weather |
| Partner/enterprise | `/mcp` endpoint | Princess's public ship and port knowledge exposed as an MCP server, so other assistants can read it, and so the provider-replacement story can be shown without any outside service |

## 5. Phases

Each phase ends with: tests, lint, `tsc -b`, `npm run build` green, a commit, and a note in section 8. The C# compiles with `dotnet build` only; per CLAUDE.md no `dotnet test` is run, so server tests are written but not executed here and are flagged in the commit.

### Phase 1: Maps foundation (front end, no server change)
- `src/maps/geo.ts`: haversine distance, walking minutes (4.5 km/h with a 1.25 street factor, and a slower pace option for "easy"), bounding box, equirectangular projection to a viewBox, nearest-neighbour visiting order, cluster centroid.
- `src/maps/googleMaps.ts`: URL builders: place, multi-stop walking route (`origin`, `destination`, `waypoints`, `travelmode=walking`), embed URL (only with a key).
- `PlaceMap` component: SVG map of numbered pins with a route polyline, scale bar, keyboard-focusable pins, and an ordered text list as the accessible equivalent (WCAG 2.2: not colour alone, reduced motion respected). "Open in Google Maps" and "Directions" links. Optional "Show Google map" button that loads an embed iframe only on tap, only when `VITE_GOOGLE_MAPS_EMBED_KEY` is set (CSP `frame-src` added conditionally).
- Wire into Port Details: a "Map of things to do" card above the attractions, each attraction card gets "Show on map" (focus and highlight), and tier colours/shapes reuse the existing tier grouping.
- Tests for geo maths, URL builders, projection, ordering, CSP generation.

### Phase 2: MCP core (server)
- `Services/Mcp/`: `McpClient`, `McpSseReader`, `McpEgressPolicy`, `McpSanitiser`, `McpProviderOptions`, `McpToolCaller` (guard, cache, audit log line), registration in `ProviderRegistration`, `/health/providers` rows, `appsettings.json` `Mcp` section (all disabled).
- xUnit tests for parsing (JSON and SSE bodies captured from the live probe), sanitiser, egress policy, privacy (no guest-identifying field type exists in the egress record).

### Phase 3: Destination intelligence
- `IDestinationIntel` with `local` (authored guide: attractions, tier, coordinates) and `mcp` (GoVisit adapter using `search_destinations` then `list_destination_highlights` / `list_destination_places`; relevance gate: name similarity and distance from the port's own coordinates under a threshold; otherwise fall through to local). The merged answer is local first, external supplement second, labelled.
- Endpoint `GET /ports/{id}/ideas` (public reference data; no guest data) returning places with coordinates, source and attribution.
- Port Details: "More nearby ideas" section for external supplements, labelled "From GoVisit. Not confirmed by Princess".
- Stanley read tool `search_port_places` (port id, interest, near-ship only); scripted fallback uses the local provider.

### Phase 4: Port-day plan with map and route
- `IWalkingRoutes` with `local` (great-circle times, nearest-neighbour order, same maths as the front end so both agree) and an optional `mcp` adapter shape for a self-hosted `osm-mcp` (`Mcp:Routing`). Accessibility caution: no accessibility claim is made from map data.
- `PortDayPlanner` (pure domain code): inputs port, minutes ashore (from the verified timetable minus a buffer), pace, interests, mobility, meal break; output ordered stops, legs, a timeline, and a "back on board by" time taken only from the ship's verified schedule. Property tests: never exceeds the window, always ends with the return buffer.
- Endpoint `POST /me/ports/{day}/plan` and a "Plan my port day" card on the port screen showing the map, timeline and Google Maps walking-route link; Stanley tool `plan_port_day` and an action card so chat can show the same plan.

### Phase 5: Weather and marine
- `IPortWeather` with `local` (existing `IWeatherService`), `openmeteo` (existing REST) and `mcp` (Open-Meteo MCP: marine, wind, rain) adapters, gated by `Commercial` flag.
- Stanley tool `get_port_weather`; port-day plan gains a "weather note" (rain window, wind, heat) and indoor alternatives from the authored guide.

### Phase 6: Trust and transparency
- Third-party provenance chip and attribution component used by every external result.
- "Connected services" page under Help: which sources are on, what is sent (place, date, interests only), what is never sent, how to read a "Third-party" label. Reads `GET /help/connected-services` (no secrets).
- Runbook, `docs/static-host-headers.md` (frame-src) and README updates; per-provider licence table.

### Phase 7: Princess as an MCP server
- `POST /mcp` Streamable HTTP endpoint, public read-only tools only: `list_ports`, `get_port_guide`, `search_ship_venues`, `list_excursions`. Rate limited, no authentication-gated data, no guest tools. Hand-written JSON-RPC (no dependency), tests on the dispatcher.
- Registered in the gateway as a `princess` MCP provider so the app can consume its own tools through the same code path: this is the offline demonstration of "swap the provider, nothing else changes".

### Phase 8: Cruise discovery, flights, currency, and the Mobi adapter
- `ICruiseDiscovery` (`local` over our sailings and catalogue, `mcp` shape for Siloah/CruiseHops/Mobi), `IFlightSearch` (`local` link builder to the airline/search pages, `mcp` shape for OctoTrip), currency through the existing `IRateFeed`.
- `docs/mobi-mcp-mapping.md`: expected tool mapping, auth scopes, questions for Mobi (from the research doc section 8), which operations are blocked until access exists. Providers that blocked automated access are listed as such with the reason, not worked around.

### Later, not started
Excursion discovery (GetExperience, Peek) once an endpoint is verified reachable; live ship timetable from Mobi; transactional tools (only with confirmation and server-side permission checks).

## 6. Risks and how they are handled

| Risk | Handling |
|---|---|
| Provider down, slow or blocking | Per-provider timeout and circuit via `ProviderGuard`; local fallback; `/health/providers` |
| Wrong place returned (as GoVisit does for Kotor) | Relevance gate; local authority first; labelled supplement only |
| Prompt injection in tool output | Typed parse, sanitiser, data-only channel, no tool chaining on returned URLs, allowlist |
| Guest data leaking | Egress record type has no guest fields; tests assert it; audit never logs free text |
| Licence limits (Open-Meteo free tier non-commercial, GoVisit excerpts and attribution) | `Commercial` flag, attribution field, off by default, documented per provider |
| Map tile or API terms | We draw our own SVG; Google only by official URLs or an optional restricted embed key |
| Cannot test C# here | `dotnet build` for compilation; logic kept in pure static classes with xUnit tests written for later runs; front end fully covered by vitest |
| Accessibility of a map | Text list equivalent first, keyboard pins, not colour alone, no motion |

## 7. Decisions made without asking (revisit tomorrow)

- Kept all MCP providers disabled in the base configuration; `local` is the default so the app and tests never touch the network.
- Did not use Siloah or OctoTrip because they block automated access; did not use the currency MCP (404).
- Chose self-drawn SVG maps over map tiles; Google Maps by keyless URLs plus an optional embed key.
- Hand-rolled the MCP client rather than add the official C# SDK, to avoid a dependency I could not restore-test or approve with you. Swapping to the SDK later only touches `McpClient`.

## 8. Progress log

(Updated as each phase is committed.)

- **Phase 1 done.** `src/maps/geo.ts` and `googleMaps.ts` (pure, tested), `PlaceMap` (SVG map, numbered pins, optional route, text list, Google links, click-to-load embed only with `VITE_GOOGLE_MAPS_EMBED_KEY`), wired into Port Details with pin numbers on each attraction and a "Show on map" button. CSP gains `frame-src https://www.google.com/maps/embed/` only when the key is set at build time. To switch the embed on: create a Maps Embed API key restricted to the site's referrer and set `VITE_GOOGLE_MAPS_EMBED_KEY` for the build (optional; everything works without it).
- **Phase 2 done.** `server/Princess.Api/Services/Mcp/`: `McpClient` (Streamable HTTP, JSON and SSE replies, session handling), `McpWire` (message format), `McpSanitiser`, `McpEgressPolicy` (allowlisted read-only GoVisit tools; no rule accepts a guest detail), `McpGateway` (policy, per-provider `ProviderGuard`, optional cache, health row `Mcp:<name>`), `AddMcp` in `Program.cs`, `Mcp` section in `appsettings.json` (all off). `ProviderGuard.RunAsync` added. xUnit tests in `McpCoreTests.cs` are compiled but not run (per CLAUDE.md). I did exercise the gateway against the live GoVisit server with a throwaway console harness outside the repo: initialize, call, policy refusal and health all behaved.
- **Phase 3 revised: GoVisit is not a useful sightseeing source, so no adapter was shipped.** Live probes on 23 Nov 2026: `search_places` with a proximity filter timed out after 25 s (twice, with and without `mode=intent`); `list_destination_highlights` returned no items for Barcelona; `list_destination_places` returned hotels, and a `category=attraction` filter returned nothing; Kotor and Santorini do not resolve at all. Against 409 authored attractions with coordinates this adds nothing, and a supplement that returns hotels would lower the quality of the port screen. The egress rules for GoVisit stay (they are tested and harmless while the provider is off), but one rule needs correcting before anyone enables a proximity search: GoVisit's `near` is `{ coordinates: { latitude, longitude }, radiusMeters }`, not the flat shape in `ArgRule.Coordinates`.
- **Status of the rest.** Phases 4 to 8 are not started. The recommended next step, which needs no outside service and no approval, is the port-day planner (phase 4) built on the authored attractions, the verified all-aboard time and `src/maps`. The Mobi mapping document (phase 8) is also unblocked. Phases 5 and 7 are worth doing but lower value than they looked in the research document. Siloah, OctoTrip and the currency MCP remain unusable for the reasons in section 1.
- **Honest summary for review.** What exists and works: a verified MCP client and gateway (live-tested), a strict egress policy, maps on the port screen. What the research document promised that did not survive contact with the real endpoints: GoVisit as the first-choice port source, Siloah and OctoTrip as free hosted services, and the currency MCP.
- **Phase 4 built (front end only, no server change).** `src/maps/portDay.ts` (pure, 8 tests) and `PortDayPlanner` (3 tests) on Port Details for a port the guest's ship calls at. It picks walking places (a walk-off tier, or within 1.5 km of the first), orders them by nearest next stop, and fits them between getting ashore (20 min, 60 by tender) and a buffer before the ship's published all-aboard time (60 min, 90 by tender), at a steady or easy pace, with an optional hour for a meal. It shows a timed list, the walking-route map, the time to start walking back and the spare time. The return time comes only from the ship's all-aboard time. Limits stated on the page: no pier position in our data, so the walk is counted from the first stop and back to it; ports with too few walkable places say so instead of inventing a plan. Not done: a Stanley tool and a server endpoint for the same plan, and weather notes (phase 5).
- **Phase 4 finished: server endpoint, Stanley tool and weather notes.**
  - `Domain/PortDayRules.cs`: the same planner as the front end in C#, checked against it on three cases (identical stops, times and totals) with a throwaway harness outside the repo. `PortGuides.Places(id)` reads a port's attractions with map points.
  - Stanley read tool `plan_port_day` (port, day, pace, meal): picks the call from the guest's own sailing timeline, plans from the guide's places, returns timed stops, walking minutes, spare minutes, when to start back, a weather block and the standing reminder that the ship's notice has the last word. It is read-only and in the packet's allowed tools. The weather comes through the existing `IWeatherService` (so `Providers:Weather=openmeteo` gives a real forecast for ports in its table, else the simulation), passed in through an optional `Sky` function on `StanleyReadData`.
  - `GET /reference/port-guides/{id}/walking-plan?arrive&allAboard&tender&pace&meal&date`: the same plan for any client, with weather notes when a `date` is given. Needs a sign-in like the other reference routes; validates the times, pace and date.
  - Weather notes on the page (`weatherNotes` in `src/maps/portDay.ts`, 3 tests) via the existing sky feed: rain only when it overlaps the hours ashore, heat of 90 F or more, UV of 8 or more; otherwise a calm "no problem expected, conditions can change". Never says a plan is safe.
  - C# tests are in `PortDayRulesTests.cs`: compiled with `dotnet build` of the solution, not run.
  - The page still computes its own plan (so it works offline with the cached guide); per the thin-client rule it could call the endpoint instead, which is a later simplification.
- **Phase 7 built: Princess as an MCP server, consumed through the gateway.** `Services/Mcp/PrincessMcpServer.cs` is the whole protocol (initialize, ping, tools/list, tools/call) as a pure function; `POST /api/v1/mcp` serves it (sign-in required, 16 KB limit, 202 for notifications). Tools: `list_ports`, `get_port_guide`, `plan_walking_day`, all read-only with no guest data. A new `princess` provider is `InProcess` (no network) and goes through the same egress policy, guard and health as any outside provider. `IPortKnowledge` (`Providers:PortKnowledge` = `local` or `mcp`, default local) is the swap seam: the walking-plan endpoint reads places through it, falling back to the embedded guide. Checked with a scratch harness: protocol replies, unknown tool and method errors, policy refusing a bad port, and the mcp and local paths giving identical places and plans. Tests are written in `PrincessMcpServerTests.cs` and compiled, not run.
- **Phase 8 document:** `docs/mobi-mcp-mapping.md` lists the tools we would want from Mobi, what each unlocks, and questions for Princess.
