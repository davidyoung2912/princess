# Returning-guest Home: "Pick up where you left off" and stronger Next steps

Status: **plan agreed (2026-11-03). R1 (server) and R2 (front-end logic) are built; R3 and R4 are not started.**

## Why

- A guest who signs back in lands on Home with no memory of where they were. We keep the last three screens they visited on the server, so a guest on any device can jump back in.
- "Your next steps" and "What matters now" (`src/ui/home/StageHome.tsx`) are plain lists on the page background. Nothing says which to look at first, and a done step is struck through, which reads as "removed".

## Agreed decisions

1. **Server-side**, so it follows the guest across devices (thin-client rule).
2. **Which screens count:** every named screen (one `screenForPath` resolves) except Home, Sign-in, Search and Settings.
3. **Order:** when something is urgent, Next steps comes first and the recent card second; otherwise the recent card comes first (see "Urgent" below).
4. R3 and R4 can be built in either order.

## Storage (changed from the first proposal)

No new table. The existing per-guest document store is reused: `GET/PUT /me/state/recent` (`UserState`, versioned, 409 `stale` when another device saved first; the device fetches, merges and saves again, as every other key does). It is therefore already in the privacy export and "delete my data". It is not encrypted and not consent-gated: it holds only app paths and times, never names or ids of other people.

Document shape:

```json
{ "items": [ { "path": "/book/resume/abc", "at": 1762128000000 } ] }
```

Server checks (`StateRules`): at most 3 items; each path is a string of at most 200 characters that starts with a single `/`, has no `//`, no `:` before the first `?`, no backslash and no control characters (so a stored address can never be an outside link); `at` is a number. The whole document is capped at 2,000 characters.

## What the card shows

A hero card at the top of Home, up to three rows, newest first: the screen's icon, its title, and a relative time ("Yesterday"). The first row has a "Continue" button. A small "Clear" link empties it, with the line "Only you see this".

- A screen is recorded after the guest has stayed on it (not on Back or Forward, and not twice in a row); visiting again moves it to the front.
- Paths keep their ids (`/book/resume/:id`, `/home/sailings/:id`) so "Continue booking" really resumes. Query strings are dropped.
- Rows that no longer resolve for the guest's current stage (`accessAt` says Home) are left out. No rows, no card. Hidden in essentials mode.

## Urgent (what decides the order)

A pure rule in `src/routes/stageHome.ts` (`urgentStep`), from facts Home already has. Next steps leads when any of these is true, and its first undone step gets the primary button:

- a payment is unpaid and the final payment date is within 14 days (or past);
- check-in is open and not done, and departure is within 3 days;
- documents are missing or a passport has a problem, and departure is within 30 days;
- aboard, on embarkation day and the muster drill is not done;
- the last full day aboard and the bags step is not done.

Otherwise the recent card leads. Both blocks are always shown; only the order and the weight change.

## Restyle

- **Next steps:** a tinted panel in the area colour with a thick left border (like the tip card), numbered circles instead of list markers, the first undone step larger with a primary button, done steps with a check icon and "done" instead of a strikethrough, and a "1 of 3 done" line.
- **What matters now:** each whole tile is the link, with its screen icon (`SCREEN_ICONS`), a larger title, and the state line below. A tile that needs attention gets an accent badge. Two columns on phones, three from desktop width.
- AA contrast, focus rings and reduced motion are checked in `a11y.test.tsx`.

## Phases (one commit each, stop after each)

- **R1: Server.** Add the `recent` key to `StateRules.UserKeys`, with the shape check above. Tests in `StateTests.cs`. Not run here (no `dotnet test`, per project rules); the npm checks are the gate.
- **R2: Front-end logic (built; the list is held in memory only, the server copy is the real one).** `src/routes/recent.ts` (what counts, dedupe, cap at three, safe path, relative time, resolve to a screen); a sync binding and merge for `recent` (`src/sync/bindings.ts`, `merges.ts`); the Shell records a visit next to `recordVisit`. Vitest in node.
- **R3: Recent card.** `RecentCard.tsx`, placed in every Home variant, English and Spanish strings, Clear button, `urgentStep` and the ordering.
- **R4: Restyle.** New `StageHome` markup and CSS; render and a11y tests updated.
