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
| B | 7: excursions per port | data audit, content fills | [ ] |
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
