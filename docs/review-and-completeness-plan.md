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
| A | 4, 5, 6: venues, events, menus per ship | data audit, guard test, content fills | [ ] |
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
