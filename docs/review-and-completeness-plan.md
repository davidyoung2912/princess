# Review and completeness plan (2026-11-23)

Fourteen workstreams, run in order, one commit per phase. Each phase writes its findings into this file (a `Findings` section), fixes what is safe to fix, and records what is left. Verify with `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` and `dotnet build server/Princess.sln` only (no `dotnet test`, no browser testing, English only).

Status key: [ ] not started, [~] in progress, [x] done.

## Starting facts

- Ships with full explorer data: Sun, Sky and Sapphire Princess (`server/Princess.Api/Content/ship-explorer.json`: `venues`, `events`, `menus`, `treatments`, `menuTemplate` per ship). Older per-ship files: `ship-venues.json`, `ship-programmes.json` (Sky and Sapphire only).
- Ports: 99 guides in `port-guides.json`; excursions seeded in `db/seed/reference/04-excursions.sql`.
- Earlier security and performance pass: `docs/security-performance-plan.md` (Phases 1 to 7). This review builds on it and re-checks, it does not repeat it.
- Size at start: about 166k lines of TypeScript under `src`, 67k lines of C# under `server/Princess.Api`.

## Method per workstream

1. Measure with a script or a targeted search, not by impression.
2. Write findings (with file references) under the workstream.
3. Fix the high-value, low-risk items in the same phase; list the rest as follow-ups with a priority.
4. Where a finding can be kept true by a test (for example "every dining venue has a menu for every day"), add the test so it stays true.

## Phases

| Phase | Steps | Kind | Status |
| --- | --- | --- | --- |
| A | 4, 5, 6: venues, events, menus per ship | data audit, guard test, content fills | [x] |
| B | 7: excursions per port | data audit, candidate catalogue, guard test (wiring open) | [~] |
| C | 13: stats page integrity | audit, fixes | [ ] |
| D | 1: security | review, fixes | [ ] |
| E | 2: performance | review, fixes | [ ] |
| F | 3: code health (outside-reviewer view) | review, fixes, scorecard | [ ] |
| G | 8, 9: pages per stage, journey guidance | review, new guidance | [ ] |
| H | 10, 11: chat and day planning | review, improvements | [ ] |
| I | 12: guided tour coverage | tour content | [ ] |
| J | 14: Stanley ideas | document only | [ ] |

## Findings

(Filled in phase by phase below.)

### Phase A: venues, events and menus (steps 4, 5, 6)

Measured with a script over `ship-explorer.json` on the sample week (embark, sea, port, port, sea, port, sea, disembark morning).

**Step 4, venues.** Each ship has 61 (Sun), 56 (Sky) and 57 (Sapphire) venues across the six Explorers: dining (main, specialty, casual, bar), spa (spa, salon, thermal suite, sanctuary), entertainment (shows, music rooms, pool deck, Princess Live!, casino), exercise (gym, studios, courts, tracks, pools), shopping (boutiques, gallery, pop-ups) and activities (card tables, talks, workshops, meet-ups, Camp Discovery, teen centre, open decks, tech desk). Service places (Medical Center, Guest Services, excursion desk) live in the deck plans (`AboardPlans.cs`), not the Explorers, so they are covered. The three ships share one template, so Sky and Sapphire are near copies of each other apart from room names. Not found: any missing *type* of venue. Still open (content, not structure): hot tubs and whirlpools, a self-service laundry, and a real library as separate venues; all are minor and need a source for each ship before authoring (see `docs/content-verification.md`, all of this content is authored concept content).

**Step 5, events.** Before: 313 to 317 events per ship, but the morning of disembarkation had **zero** (and no venue was open that morning because hours only know `sea` and `night`), most specialty restaurants and several bars had no event, port days had one to five dining events, and children and teens had 16 events in a week. After this phase (`scripts/ship-explorer-third-events.ts`): a `disembark` day kind (TypeScript `dayKinds.ts` and C# `DayKinds.cs`, kept in step), opening hours for the rooms that open that morning, six disembarkation events, six more embarkation-afternoon events, a dinner or tasting at every specialty restaurant, port-day food and drink, late-night events and a block of children's and teens' events (27 a week). `src/domain/explorer/shipCompleteness.test.ts` now keeps those floors: events every day, morning, afternoon and evening covered, late nights, young guests on every sea and port day, all six Explorers active on sea and port days, every specialty restaurant with an event, a dinner for each of the seven nights in each main dining room.

**Step 6, menus.** Every dining venue has a menu; each main dining room has dinner for all seven nights (the three main rooms on a ship share the nightly menu, as on the real ships), breakfast and sea-day lunch; the Eatery has breakfast, lunch and a themed dinner each night. Weak spots, left as follow-ups: specialty and casual venues have one standing menu of 6 to 14 dishes (no seasonal feature, no tasting-menu page, no separate lunch menu); Sky and Sapphire reuse Sun's templates for the main rooms; bars list 7 to 10 signature drinks with no wine or beer list. These need real source material, so they are listed rather than invented.

Other findings: `npx tsc -b` reports 42 to 45 errors in `scripts/` imports (node16 resolution, `.js` extensions) that existed before this work, so the `tsc -b` check in CLAUDE.md does not pass on a clean tree (carried to Phase F). `dotnet` is not installed in this environment, so the one-line C# change could not be built here.

### Phase B: excursions (step 7)

**Finding (the most important one so far).** The bookable catalogue (`ExcursionRules.Catalogue` in C#, mirrored by `ref.Excursions`; the front end's own list `AUTHORED_EXCURSIONS` is empty and is replaced by what the server serves) holds **12 tours at 3 ports** (Cozumel, Belize City, Roatan). The three ships' 2027 sailings (68 sailings: Sun 40, Sky 17, Sapphire 11) call at 99 distinct ports: Sun 24 ports apart from Fort Lauderdale, Sky 48, Sapphire 34. So a guest on any itinerary except the western Caribbean one has no bookable tour at all, although the port guides (all 99 ports, 4 to 5 attractions each) describe guided and full-day options with travel time, effort, weather and a "can I do it in four hours" call.

**What was built.** `scripts/port-excursions-data.ts` derives a candidate catalogue from the guided, full-day and private-driver attractions of the port guides, and `npm run portexcursions:gen` writes `server/Princess.Api/Content/port-excursions.json`: 160 tours (91 moderate, 40 strenuous, 29 easy), with lengths from the guide's travel time (3 to 9 hours), prices from length, effort from the guide's "Physical" line, step-free only when the guide says so and the tour is easy, interests from keywords, and rating, reviews and capacity from a hash of the id (authored concept data, the same standing as the existing 12; never a source). Coverage of the ports each ship calls at: Sun 22 of 24 (92%), Sky 39 of 48 (81%), Sapphire 30 of 34 (88%); ports with no guided attraction in their guide: Bergen, Cartagena, Copenhagen, Genoa, Helsinki, Nagasaki, Nagoya, Oslo, Singapore, South Queensferry, Stockholm, Tallinn, Trondheim, Willis Island. `src/domain/portExcursions.test.ts` keeps the file in step with the generator, checks ids against the `ref.Excursions` column, and holds the coverage floors (85%, 75%, 80%).

**Not done: loading the file on the server.** It is deliberately not embedded or served yet, for two reasons that need a C# compiler and test run (this environment has no `dotnet`, and CLAUDE.md forbids a full `dotnet test`):
1. Code and tests assume every catalogue tour's port is on the itinerary being looked at: `PlanRulesTests` (line 31) calls `ExcursionRules.DayOf(Departure, x)` on every tour (`First` throws for a port not on the timeline); `ExplorerRulesTests` use `Catalogue[0]` and `Catalogue[^1]`; `StanleyClassifierTests` loops the whole list. Production loops that walk the whole list and need a "port is on this timeline" filter checked: `PlanService.cs:183`, `DayPlanRules.cs:55`, `ChatShareService.cs:75`, `StanleyStanding.cs:58`, `Services/StanleyStanding.cs`, `ConciergeRules.cs:136,217`, `StanleyActions.cs:368`, `StanleyResolvers.cs:140`.
2. `ref.ExcursionDepartures` needs a row per (tour, sailing, day) for each sailing that calls at the tour's port (the seed generator `scripts/reference-seed.ts` reads the empty TypeScript list today), plus `ShipId` on `ref.Excursions`, and the tender flag per port, which is not in the catalogue port data.
The plan for the wiring phase: (a) embed `port-excursions.json`, (b) `ExcursionRules.Catalogue = fixture tours + file tours`, (c) add `ExcursionRules.OnTimeline(timeline)` and use it at each site above, (d) make the seed generator write departures for every sailing, (e) run only `ExcursionPlanTests`, `PlanRulesTests`, `ExplorerRulesTests` and `StanleyClassifierTests` by name when a compiler is available.
