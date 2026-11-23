# Chat bundles: send anything from the app into a chat

Plan for sending rich, actionable "bundles" from anywhere in the app into any 1:1 or group chat. Written 2026-11-22. Nothing is built yet; one phase per session, and later phases start only when asked.

## 1. What the guest gets

- A **chat icon** on every game board, and on every explorer item worth sharing (a venue, menu, dish, show, event, excursion, port, place, the day's plan). Tapping it opens a **send dialog**.
- In the dialog the guest picks **one or more conversations** (1:1 or group), sees exactly what will be sent, optionally adds a short note, and sends.
- The recipients see a **bundle card** in the thread: a clear summary they can read on its own, plus **actions that suit the kind of thing sent**.
- For a game, the card says what it is ("Sudoku, Hard, starting position"), shows a small thumbnail of the board, and has a button that **opens the same game with the same conditions**: the starting puzzle, or the sender's current position.
- Later: send a **result** ("Solved Killer Sudoku Hard in 12:41, beat it?"), see who in the group has played it, and send a bundle on to another chat.

Example of "actions that make sense for the type":

| Bundle | Reads as | Actions for the recipient |
| --- | --- | --- |
| Game: starting position | "Sudoku (Hard). 24 clues." plus thumbnail | **Play this puzzle**, Try a new one |
| Game: current position | "Alex is stuck on Sudoku (Hard). 41 of 81 filled." | **Pick up from here**, **Start from the original clues** |
| Game: result | "Alex solved Kakuro (Medium) in 9:12, no hints" | **Beat it** (same puzzle), Send my time |
| Dining venue or menu | name, deck, hours, today's menu | Open, Save, Plan dinner (opens a plan card), Directions |
| Show or event on a day | title, day, time, place | **Going / Maybe / No** (the existing plan card), Add to my day, Set reminder |
| Excursion (browsed, not booked) | tour, port, day, meeting time | Open, Save, Ask the group (poll) |
| Port | port, day, arrival and departure, one tip | Open the port guide, Save |
| Place on the ship | name, deck, section | **Directions** (deck plan), Meet me here |
| The day's plan | day, list of items with times | Add all to my day, Open |

## 2. What already exists (so we build on it, not beside it)

- **Typed chat messages**: `ChatMessages.Kind` is `text`, `card`, `place`, `plan` or `poll`, with a server-built JSON `Payload` (`ChatCardRules`, `ChatCard`, `ChatShareService`). The `venue` and `menu` cards are already shared from Explorer pages through `src/ui/onboard/SendToChat.tsx` (a `<details>` list, one conversation at a time).
- **Trust model today ("reference bundle")**: the client sends only a `shareRef`; the server rebuilds the words from its own data and refuses any key that names money or identity (`ChatCardRules.ForbiddenKeys`, `HasForbiddenKey`). This is the right model for anything the server already knows (venues, events, excursions, ports, places).
- **Client**: `src/ui/onboard/ChatCards.tsx` (`CardMessage`), `src/domain/chatCards.ts` (`cardLink` with an allow-list regex of openable paths, `cardSummary`), `src/domain/chatPlanning.ts` (plan and RSVP), `src/ui/explorer/SaveButton.tsx`, `src/routes/openedByLink.ts`.
- Everything a typed message already gets for free: reactions, replies, pins, mentions, search, push preview (`ChatCardRules.Preview`), the thread cache for offline reading, guardian visibility for supervised children, block and report. A bundle must ride on these, not re-implement them.
- **Games** (`src/domain/games/*.ts`, `src/ui/explorer/games/*Screen.tsx`, 17 games): puzzles are generated **on the device with `Math.random`** and are never stored or sent anywhere; leaving the page loses the game (`docs/games-plan.md`). Several generators already take a `random` parameter; the screens do not pass one. There is a shared kit in `src/ui/explorer/games/parts.tsx` (`GameClock`, `LevelBar`, `HintBox`, `SolvedCard`, `GameHelp`).
- Two gaps this plan must close: (1) a game has no way to be **described, encoded and restored** (so there is nothing to send), and (2) the card allow-list `CARD_PATH` does not include game routes, and a game route has nowhere to receive "load this bundle".

## 3. Decisions

| Question | Decision | Why |
| --- | --- | --- |
| New message kind or new card types | **New kind `bundle`** (fits `Kind NVARCHAR(12)`, no CHECK constraint, so **no schema change**). Existing `card`, `place`, `plan`, `poll` stay exactly as they are. | No regression risk to a chat that works well. Legacy kinds can be re-expressed through the registry later (phase B10) if it is worth it. |
| Where game state travels | **In the message payload, opened by message id**, not in a URL. The link is `<game route>?bundle=<conversationId>.<messageId>`; the game screen fetches the payload through the membership-checked chat API (or the cached thread offline). | A URL with the state in it can be forwarded outside the chat, bypassing membership, and gets long. Message-id links keep the access rule "only people in the conversation can read it". |
| Seed or explicit puzzle | **Explicit compact puzzle** (givens, layout, clues) plus a `v` version, not a random seed. | A seed breaks the day a generator is improved; an explicit puzzle never does. The recipient's device recomputes the solution with the game's own solver (puzzles are unique by construction), so the solution is never sent. |
| Who validates a game payload | The **server validates shape only** (known game id, level, size cap, character allow-list, forbidden keys, note moderation); the **recipient's game decoder validates the puzzle** and fails safely. | The server holds no game logic, and CLAUDE.md keeps framework-free logic in TypeScript modules that node tests cover. The sender is a member of the chat, so the worst a tampered client can do is send a puzzle that will not open; the decoder must be total (never throws, bounded size). |
| Price and identity | **Never in a bundle**, as today. Offers and prices are out of scope unless the owner says otherwise (open question 1). | Same guard as cards. |
| Several recipients | The dialog **multi-selects conversations**; one message is created per conversation with its own client id (idempotent), partial failure is reported per conversation. | "Any 1:1 or group chat" is more useful as "these three chats". |
| Spoilers | Starting position carries no entries; current position carries entries and notes only if the sender ticks **Include my notes**; the **solution is never sent**. Wordle sends the pattern and a word index, never the word in readable text. | Others can enjoy the puzzle. |
| Offline | Reading a bundle works offline (it is in the cached thread); opening a game from one works offline (game routes are already `offline` in `offlineContract.ts`). Sending is **queued** like other chat sends. | Matches the existing offline contract. |
| Language | English only; strings in `enCore.ts` and `enLate.ts`, every key a literal `t('...')`. | CLAUDE.md. |

## 4. Design

### 4.1 The bundle message

`Kind = 'bundle'`. `Payload` is JSON:

```
{ "type": "game.sudoku", "v": 1, "mode": "start" | "current" | "result",
  "title": "Sudoku", "subtitle": "Hard, starting position",
  "path": "/games-explorer/sudoku",
  "data": { ... type-specific, bounded ... },
  "note": "bet you cannot do this one" }
```

- `type` is `<family>.<name>`: `game.*`, `venue`, `menu`, `dish`, `event`, `show`, `excursion`, `port`, `place`, `day`. A **registry** (below) knows each type.
- `title`, `subtitle`, `path` and `note` are always present or null, so any client, the push preview, search and a screen reader can show a bundle **without** understanding `data`. An unknown `type` (an older app) still shows the title and subtitle and says "Update the app to open this".
- Two trust models, chosen per type in the registry:
  - **Reference** (`venue`, `event`, `excursion`, `port`, `place`, `day`): client sends `{ type, ref }`; the server rebuilds `title`, `subtitle`, `data` from its own data. Reuses `ChatShareService`.
  - **Snapshot** (`game.*`): client sends `{ type, mode, data, note }`; the server checks shape and size and writes the card words itself from a fixed table (title from the game id, subtitle from level and mode), so words in the card are never client-supplied. Only `data` comes from the client, and it is never rendered as text, only decoded by the game.
- `data` size cap 4 KB (largest grids are 13x13 Codeword and 10x10 Kakuro), character allow-list `[A-Za-z0-9 .,;:|_/+=-]`, no key from `ForbiddenKeys`, max depth 3. The note goes through `ProfanityFilter` and `ChatCardRules.CleanNote` (80 characters, one line, blocked contact info), like a place note.

### 4.2 Server (C#, behind existing interfaces)

- `Domain/ChatBundleRules.cs`: pure rules. Type table (id, trust model, allowed modes, path template, preview words, which actions the server may offer), `Validate(type, mode, data)`, `Words(type, mode, ...)`, `Preview(bundle)` (for list lines and push: "Alex sent a Sudoku puzzle"), `ParseRef`/`Ref` helpers like `ChatCardRules.VenueRef`.
- `Services/ChatBundleService.cs`: builds reference bundles (from `ShipReference`, `ExplorerCatalogue`, `ExcursionRules`, `Itinerary`, the guest's timeline), validates snapshots, and **repeats the checks on read** to add `gone`/`past`/`cancelled`/`notOnYourSailing` state for the recipient (as `IsGone` does for cards).
- `POST /me/chat/conversations/{id}/messages` accepts `kind: 'bundle'` with the body above (extends `ChatTypedSend`); same membership, block, closed-chat, child-guardian, rate-limit and idempotency checks as other typed sends.
- `GET /me/chat/conversations/{id}/messages/{mid}/bundle`: the payload for a message the caller may read (the game screen's loader). 404 for anyone else, same as a message.
- Outcomes (phase B6): table `ChatBundleOutcomes (MessageId, UserId, Status, ResultJson, At)`; `PUT .../bundle/outcome`; group counts only for people who chose to report.
- Tests written beside the existing `Chat*RulesTests.cs` (`ChatBundleRulesTests.cs`). Per CLAUDE.md they are **not run** here; see open question 3.

### 4.3 Front end

Framework-free (`src/domain`, node-tested):

- `chatBundles.ts`: the **registry** `BUNDLE_TYPES[type] = { family, label, icon, openPath(bundle), actions(bundle, state), thumbnail?(bundle), parse(raw) }`, plus `parseBundle(raw)` (total; returns null for garbage), `bundleLink(bundle, ref)` (builds the `?bundle=` path and checks it against an allow-list generated **from the routes** so a new game route is allowed automatically; replaces hand-editing `CARD_PATH` for bundles), `bundleSummary` for accessibility and previews.
- `games/share.ts`: `GameShareAdapter<G, S>` per game: `describe(game, state): {title, subtitle, level}`, `encode(game, state, mode): string`, `decode(data): { game: G, state: S } | null`, `thumbnail(game): Thumb`. `decode` rebuilds the solution with the game's own solver and returns null if the puzzle is not uniquely solvable, oversized or malformed. A registry `GAME_SHARE[id]`. Generators that do not take a `random` argument keep their signature; **nothing needs a seed** because the puzzle is explicit.
- Round-trip and fuzz tests per game: `decode(encode(x))` equals `x`; random garbage never throws; truncated input returns null.

UI:

- `ui/chat/SendDialog.tsx` (new, modal): focus-trapped, Escape closes, returns focus to the chat icon; conversation list with checkboxes (search box once there are more than 8; "recent" first; Stanley and closed chats excluded as `SendToChat` does today), the bundle **preview** exactly as recipients will see it, mode choice where the type has one (Starting position / Where I am now), note field, Send. Result region `role="status"` listing "Sent to Cabin 9 crew, Sam". Reduced motion honoured. `SendToChat` becomes a thin button that opens it, so the venue, menu and plan buttons keep working and gain multi-select.
- `ui/chat/ShareButton.tsx`: the chat icon button (lucide `MessageSquarePlus`), accessible name "Send <title> to chat", used everywhere.
- `ui/onboard/BundleCard.tsx`: renders any bundle from the registry: type label, title, subtitle, thumbnail, note, action buttons, and the state line for the recipient ("Played", "Solved by 3 of 5", "No longer available"). Hooked into the thread renderer next to `CardMessage`.
- Games: a `GameShare` control in the shared kit (`parts.tsx`), placed in the game header next to the clock, given the screen's adapter and current state. Each screen supplies `describe/encode` (a few lines) rather than its own UI.
- Opening: each game screen reads `?bundle=` through one hook, `useIncomingBundle(gameId)`. While loading it shows the usual puzzle area with a status; on success it starts from the decoded puzzle and shows a dismissable banner ("From Alex: starting position. Back to chat · Try a different puzzle"); on failure ("This puzzle can't be opened") it starts a normal new game. Marks the address `markOpenedByLink` so refresh and Back are not treated as stale.
- Strings, routes, screen ids: no new screens are needed (the dialog is not a route), so `nav.test.ts`, `coverage.test.ts` and `screens.test.ts` counts do not change; the new strings follow the literal-key rule.

### 4.4 Actions (what "actionable" means)

An action is `{ id, label, run(bundle, ctx) }` in the registry; the server may withhold actions that cannot apply (event cancelled, wrong sailing, already on the recipient's day). Common ids: `open`, `save` (reuses `SaveButton`'s store), `addToDay` (reuses the plan import), `rsvp` (existing plan card), `remind`, `directions` (deck plan), `playSame`, `playFresh`, `beat` (same puzzle, compare time), `sendResult`, `askGroup` (creates a poll, reusing chat planning), `forward`. Rules: an action never books, pays or cancels anything (same rule as plans: answering never books); anything that changes the recipient's own data happens on their screen after a normal confirm.

### 4.5 Safety, privacy, accessibility

- Membership check on every read and write; a bundle in a conversation is readable only by its members and (for a supervised child) the guardian, exactly like a message.
- Reference bundles carry only what the catalogue or the sender's own booking already makes public to the sailing; **never** price, folio, cabin, booking number, or where the sender is. Game snapshots carry puzzle data only, never the timer or hints used unless the result type says so and the sender chose to send it.
- Note text moderated like any message; blocked or contact-info notes are refused with the usual error.
- A recipient's game decoder is the trust boundary: bounded, total, no HTML, no navigation target taken from the payload (the route comes from the registry, not from `path` in the data).
- Accessibility (WCAG 2.2 AA): dialog traps focus, closes on Escape, labelled; checkbox list with proper names; card is a `role="group"` with a text summary; thumbnails are `aria-hidden` with the summary text carrying the meaning; targets at least 44 px; state is never colour only.

### 4.6 Out of scope for this plan

Live shared boards or two people playing one puzzle together (that is the Games "multi-player" mode, a separate plan); sending money, prices or bookings; sending to people outside the app; guests off the ship by SMS bridge (they get the card's words only, with no actions, as other typed messages do today; check in B1).

## 5. Phases

Rules for every phase (CLAUDE.md): English only; verify with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` only (no browser testing, no `dotnet test`); commit only when asked, then stop so the user can `/clear`; do not start the next phase until asked. Server changes get unit tests written but not run (open question 3).

### B1: the bundle foundation, proved with one reference type (venue and menu)

- Server: `ChatBundleRules`, `ChatBundleService`, extend send and read endpoints for `kind: 'bundle'`, preview words for push and list lines, `ChatBundleRulesTests.cs`. Re-express **venue** and **menu** through the registry (their old `venue`/`menu` card sends keep working untouched).
- Front end: `chatBundles.ts` registry, `parseBundle`, `bundleLink`, `SendDialog`, `ShareButton`, `BundleCard`, thread hook-up, offline queueing check, SMS-bridge behaviour check, strings. `SendToChat` opens the dialog (multi-select).
- Tests: registry and parser (including unknown type and garbage), link allow-list, summary, dialog logic helpers (selection, partial failure), server rule tests.
- Done when: sending a venue or menu to two chats at once works end to end in code and tests, an older client shows the fallback text, and nothing about the existing card kinds changed.

### B2: game sharing infrastructure, plus the Sudoku family and Binairo

- `GameShareAdapter` type and registry, `GameShare` control in `parts.tsx` (chat icon in the header of every game, shown only for games that have an adapter), `useIncomingBundle`, banner, failure fallback, route allow-listing.
- Adapters and round-trip tests for **Sudoku, Diagonal Sudoku, Jigsaw Sudoku, Killer Sudoku** (one engine, `variant` and `rules`) and **Binairo**. Modes: start and current (entries and notes).
- Server: `game.*` types and snapshot validation for these ids.
- Done when: from the Sudoku board a guest sends the starting position to a group, and the card in the thread opens the same puzzle on another device; same for current position.

### B3: Latin-square and arithmetic games

Futoshiki, KenKen, Crossmath, Kakuro. Each adapter (givens, signs, cages, sums, tray) with round-trip and fuzz tests; thumbnails for the families added so far. Server id table extended.

### B4: logic and shading games

Hitori, Slitherlink, Nurikabe, Hashi, Nonogram. Same pattern; check that each `decode` can recover a unique solution (Nonogram and Hashi clues are explicit; Slitherlink and Nurikabe layouts need the solver). Server id table extended.

### B5: word and chance games

Cruise Wordle (share the **result pattern** without spoiling the word, and "play this word" by word-list index, so the card never shows the word as text), Word Search (grid and word list), Codeword (grid and revealed letters), Minesweeper (the board's revealed state; decide whether the mine layout is sent or re-derived, since it is the puzzle: the payload is never rendered, so sending it is acceptable). After this phase **all 17 games** can be sent.

### B6: challenges and results

- `SolvedCard` gets **Send my result**: a `game.*` bundle with `mode: 'result'` (level, time, hints used if the sender ticks it) that references the original puzzle so **Beat it** opens the same puzzle with a target time shown.
- `ChatBundleOutcomes` table, `db/` script, outcome endpoint, "Played / Solved by 3 of 5" line on the card for members (names only for people who chose to report; counts otherwise), push text kept to who it is from.
- Done when: a group can pass one puzzle around and see how many solved it.

### B7: explorer sweep, things that happen (events, shows, activities, excursions)

Add `event`, `show`, `excursion` (browsed, not only booked) and `activity` bundle types and the chat icon on their explorer rows and detail pages (dining, entertainment, activities, exercise, spa, shopping events, excursions). Actions: RSVP (reusing the plan card), Add to my day, Remind me, Save, Ask the group (poll). Server rebuilds from `ExplorerCatalogue`, `ProgramRules`, `ExcursionRules`; `gone`/`past`/`notOnYourSailing` states.

### B8: explorer sweep, places and days (ports, dishes, deck-plan places, the day)

`port` (arrival, departure, one tip, link to the port guide), `dish` (from `DishSave`), `place` with **Directions**, `day` (the day summary from `DaySummaryCard` as an itinerary the recipient can **Add all to my day**), the shortlist and trip itinerary. A coverage test lists every explorer route and states, for each, either its bundle type or why it has none, so nothing is missed silently.

### B9: share from everywhere and pass it on

**Forward** a received bundle to another chat (action on the message menu; the sender becomes the forwarder, the original sender is named on the card, bundle re-validated); chat icon on Home "today" cards, Stanley answers (reusing the idea behind `StanleyGroupShareService`, with an admin's confirm in made groups), and the explorer landing tiles. "Recently sent to" ordering in the dialog.

### B10: polish, audit and consolidation

Thumbnails for every game family, empty/error/stale states reviewed against every type, accessibility pass (focus order, names, reduced motion, contrast, target size), `docs/` and `README` updates, release checks (`releaseGates.test.ts` style tests for "every game has an adapter" and "every bundle type has a preview, a fallback and at least one action"), and, **only if the owner wants it**, re-expressing the legacy `card`, `place` and `plan` kinds through the registry.

## 6. Risks

- **Generators that are slow or non-deterministic** are not a problem, because puzzles travel explicitly; but **`decode` needs a solver pass** on the recipient's device. Hard Killer and 13x13 Codeword must decode within a frame budget or show a short "Setting up the puzzle" state (measure in B2 and B4).
- **Payload size** on 13x13 and 10x10 grids with notes: the 4 KB cap and an encoder that packs digits tightly; tested at the largest level of each game.
- **Chat stats and search** count messages by kind; confirm `bundle` is included or deliberately excluded in each (B1 checklist), as photos were.
- **Two ways to send a venue** during B1 to B10 (legacy card and bundle): the legacy send path is removed from the UI in B1 for venue and menu so guests only see one button.
- **C# changes are not compiled by the npm checks.** See open question 3.

## 7. Open questions (defaults I will use unless told otherwise)

1. **Prices and offers**: leave out of bundles (default). If you want "offer" bundles, they need a public-price rule and a separate phase.
2. **Current position and notes**: include entries always for "Where I am now", notes only when ticked (default).
3. **Verifying server code**: the working rules forbid `dotnet test`. Default: write the C# and its tests, check them by review, and ask you to run `dotnet build` yourself after B1, B2, B6 (or allow `dotnet build` only, which does not run tests).
4. **Result sharing detail**: time and level always, hints used only when ticked (default).
5. **Who may see "Solved by"**: counts for everyone in the chat, names only for those who chose to report (default).
