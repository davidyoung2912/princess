# Stage welcome and stage progress

The stage welcome (`/welcome`, screen X07) is shown once when a guest enters a stage, and any time from the **Stage overview** link on the Home landing card or the **stage chip** under the date in the top bar. It builds on the stage engine in `docs/stage-experience-plan.md`.

## What the page shows

1. Where the guest came from, the stage's focus, and what to have ready (ticks kept on the device).
2. How the stage leads to the next one.
3. **Your progress in this stage**: "N of M steps done", done steps ticked, the rest as links, and how many are still to do.
4. **What moves you on**: the real trigger for leaving the stage (see below).

## The top bar

The date and the current stage chip show for every guest. The chip opens `/welcome`. Only demo accounts can open the date and time picker (and see the time block).

## How a step counts as done

- **By data**: payment paid, documents in order, check-in done, muster done, a sailing saved, a cabin category chosen (`nextSteps` in `src/routes/stageHome.ts`, facts from `useStageFacts`).
- **By visiting**: opening the screen the step points at (`stepsAt` in `src/routes/stageProgress.ts`). Steps whose link depends on the guest's data, or can be reached two ways, list their addresses in `STEP_ADDRESSES`.
- Visits are the `stageProgress` document in `/me/state`: `{ visited: { "<stage>[:<sailingId>]#<step>": atMs } }`, validated in `StateRules.cs` (at most 300 entries, step 1 to 9), merged by keeping every visit, and cleared by **Reset Stage Welcomes** in Settings. From Manage on, a new sailing starts its steps again.

## Finishing the steps does not change the stage

The stage is derived on the server from the booking and the clock and nothing is stored (stage-experience-plan section 3), so a guest can never be stuck and every device agrees. The checklist is guidance only. The page therefore says what really moves the guest on, one line per stage (`welcome.<stage>.moveOn`), taken from `StageRules.cs`:

| Stage | Moves on when |
|---|---|
| Dream | a sailing is saved, or looked at closely or priced |
| Discover | a booking is started |
| Book | the booking is confirmed |
| Manage | paid in full, or two weeks before sailing |
| Prebook | online check-in opens, or is finished |
| Get to the ship | boarding begins, or the guest says they are at the terminal |
| Embark | the ship sails |
| Sea / Port | the ship's day (08:00 ship time) becomes a sea or port day; the last morning is Disembark |
| Disembark | the cruise ends (about midday on the last day) |
| Remember | about ten days after the trip ends |

If a rule in `StageRules.cs` changes, update the matching `moveOn` line.
