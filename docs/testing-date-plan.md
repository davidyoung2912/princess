# Testing date and stage-tailored UX: plan

## Idea

Every signed-in guest is in one of the eleven journey stages (`JOURNEY_STAGES` in `src/routes/hubs.ts`). The menus, screens and messaging
should follow that stage, and within a stage they should follow the **day** of it: on board, the restaurant menus and the entertainment
depend on which sailing day it is; before the trip, the messages are countdowns ("12 days to boarding", "5 days left to pay").

Testers need an easy way to be a guest at any point of the journey. The **testing date** is the date the app treats as "now".

## Rules

- **Stage = f(booking, time).** No booking means the guest is before booking (dream, discover, book). A booking places the guest on that
  sailing's timeline (`stageAt`, mapped to a journey stage by `JOURNEY_OF_STAGE`). The date picker moves only time; stage follows.
- **Day within the stage** is part of the position, not just the stage. It drives menus, entertainment and countdown messages.
- **One "now".** Everything reads `demoNow()` on the front end and the server's per-user clock (`IUserClock`) on the server. The testing
  date is already saved to the server for a demo account (`publishJump`), so server feeds (menus, entertainment, ship position) see it.
- **Tester bar only for demo accounts / test mode.** A real account follows the server's real time and never shows the bar.
- Framework-free logic lives in `src/domain` and is unit tested in node. The server stays the source of data; the front end does not
  know the data is simulated.

## Phase 1: tester bar and date/time picker (this phase)

- `src/domain/journeyPosition.ts` (pure): from booking presence, sailing and now, returns journey stage, sailing stage, day of stage
  (and total), days to departure, whether the guest is on board, and the zone the guest's clock shows.
- Tester bar in the app shell, top left and right:
  - left: ship date, with the journey stage and day underneath ("At sea · day 3 of 8");
  - right: time, with "Local time" or "Ship time" underneath (ship time from embarkation to disembarkation, by the ship's zone at that
    moment; otherwise the guest's phone zone).
- Clicking the date or the time opens a focus-trapped dialog (Escape closes) with a date and a time field; applying it calls `jumpTo`.
- Shown for demo accounts only; strings in English and Spanish; tests for the position module and the bar.

## Phase 2: audit what depends on the date

- Find every screen and server feed that shows a day, a menu, an entertainment slot or a countdown, and check it reads the testing date
  (`demoNow()` / `IUserClock`) rather than the real clock. List the leaks before fixing them.
- Add the countdown messages that are missing (days to boarding, days left to pay, check-in opens in N days), from the position module.

## Phase 3: stage-tailored menus

- Draft a matrix of stage to tabs, hubs and screens for review.
- Filter or reorder tabs and hubs from the matrix; keep every screen reachable by search so nothing is lost.

## Working rules

Verify with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` only. No browser testing, no `dotnet test`. Commit and stop
after each phase; commit only when asked.
