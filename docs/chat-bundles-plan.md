# Chat bundles: send anything from the app into a chat, and plan together with it

Plan for a **generic way to send any "thing" in the app into any 1:1 or group chat**, so recipients can read it, act on it, and, above all, **decide things together about future activities**. Written 2026-11-22, revised the same day (the first version was game-centred; this one is app-wide with group planning at its centre). Nothing is built yet; one phase per session, and later phases start only when asked.

## 1. The idea in one paragraph

Anything worth finding in the app (a restaurant, a menu, a dish, a show, an event on a day, an excursion, a port, a place on the ship, a day's plan, a game puzzle) can be sent to a chat as a **bundle**: a clear card that reads on its own and carries **actions that fit what it is**. Bundles are also the **building blocks of group decisions**: a poll can be made of bundles ("Which dinner on Tuesday?" with three real restaurants as the options, each openable), anyone in the group can **suggest** another, the group votes, the admin **decides**, and the decision **lands on everyone's own day** as a plan with a reminder. Games are one family of bundle ("try this puzzle"), not the model.

## 2. What the guest gets

**Send (from anywhere).** A chat icon on every shareable thing opens one **send dialog**: pick one or more conversations, see exactly what will be sent, add a short note, send.

**Read and act (in the thread).** Each bundle shows a summary, a state ("tomorrow 19:00", "cancelled", "on your day already", "clashes with your excursion") and its actions.

**Decide together (the main value).**

1. **Propose**: send one bundle ("how about this?") and ask **Going / Maybe / No** (the existing plan card, extended to any bundle that has a time).
2. **Compare**: make a **poll whose options are bundles** (venues, shows, excursions, ports, days, times), each option a card with a preview, an **Open** button and a vote button. Anyone in the group may **add an option** (if the admin allows), up to six.
3. **Pick a time**: a **time-slot poll** ("Tue 19:00 / Tue 20:30 / Wed 19:00") that shows, privately to each voter, which slots **clash with their own day** before they vote.
4. **See who is in**: counts always, names for Going only (as plans do today), "3 of 5 answered", a nudge to the people who have not (the existing coordinator, counts only).
5. **Decide**: the admin taps **Decide**; the poll closes, a **decision card** is posted ("Dinner at Sabatini's, Tue 19:00, 4 going") and the winner is offered to each person as **Add to my day** (never automatic).
6. **Make it happen**: Add to my day, **Set a reminder**, **Book** (opens the normal booking screen for the venue or excursion with the group size in mind; chat never books, pays or cancels), and a **follow-up** ("How was it?") that feeds the existing group recap.
7. **Build a day together**: a **day board** bundle: the group's plan for one day, a short list of bundles with times that people can tick in or out of, and that anyone can add an item to. This reuses the group plan board the app already has (`src/domain/groupBoard.ts`).
8. **Before anyone has booked**: the same mechanism inside a **trip huddle**, where a shortlist card (sailing, port, cabin type) is a bundle too, so "Alaska or the Caribbean?" is one poll of two bundles.

Everything else a guest sends (a game puzzle, a place to meet, a menu, a dish) rides the same dialog and the same card, with actions suited to the type (section 5.3).

**Hand it over in person (QR, no chat needed).** Everywhere a guest can send a bundle, the same dialog also offers **Show QR code**. One guest shows the code on their phone; the person next to them taps the **scan icon in the top bar**, points the camera, and **immediately sees what it is with the choice of what to do**: play this puzzle, add this show to my day, join this group, connect with this person. Nothing is sent through chat, nothing happens until the receiver chooses, and the scanner never leaves the app (section 5.6).

## 3. What already exists (so we build on it, not beside it)

| Exists | Where | How bundles use it |
| --- | --- | --- |
| Typed messages: `Kind` `text`, `card`, `place`, `plan`, `poll`; JSON `Payload`; server-built words; forbidden-key guard | `ChatCardRules`, `ChatCard`, `ChatShareService`, `src/domain/chatCards.ts`, `ChatCards.tsx` | New kind `bundle` rides the same send path, preview, push text, search, reactions, replies, pins, mentions, thread cache, guardian visibility, block and report |
| `venue` and `menu` cards through a one-conversation `<details>` | `SendToChat.tsx` | Replaced by the shared dialog; legacy cards keep working |
| **Polls**: question plus 2 to 5 **text** options, changeable vote, 24 h life, counts only | `ChatPlanningRules`, `ChatPlanning.tsx`, `ChatResponses` | Options become **text or bundle**; same tally, vote, close and answer-while-offline rules |
| **Plans with RSVP**: one programme event, Going/Maybe/No, Going adds to the programme and can undo | `ChatPlanningRules`, `ChatShareService.EventsAsync` | Generalised from "programme event" to any **bundle with a day and time** (excursion, dinner, show, port visit); a Going on a bookable thing never books it |
| **Coordinator**: remind the people who have not answered, tally card, compromise when the vote splits | `ChatCoordinatorRules`, phase 11 | Reused as is for bundle polls; compromise extended to time slots |
| **Group recap**, **huddle shortlist** (public cards before booking), **group plan board** (who is doing each tour or dinner, clashes) | `ChatRecapStore`, `ChatHuddleRules`, `groupBoard.ts` | Bundles feed all three (decision cards into the recap, shortlist cards are bundles, the day board is a bundle) |
| Plan import, Save, programme toggle, clash checks | `SaveButton.tsx`, `planCard`, `excursions.ts`, `dining.ts` | The actions of a received bundle |
| Games generate puzzles on the device with `Math.random`, nothing stored or sent | `src/domain/games/*`, `src/ui/explorer/games/*`, `parts.tsx` | Need a describe, encode, restore adapter per game (a later phase) |

Known limits today that this plan removes: a plan can only be about a programme event (an excursion or dinner card cannot be answered Going), polls have text options only, a group can have only one open poll or plan at a time for Stanley's offers, and nothing carries a decision through to the guest's own day.

## 4. Decisions

| Question | Decision | Why |
| --- | --- | --- |
| New kind or new card types | **New kind `bundle`** for the card, and a **new poll payload version** whose options may be bundles. `Kind NVARCHAR(12)` fits `bundle`, no CHECK constraint, so no change to the messages table. Legacy `card`, `place`, `plan` and text polls stay exactly as they are. | A chat that works well must not regress. Legacy kinds can be folded into the registry at the end, only if wanted. |
| Two trust models | **Reference** (the server rebuilds the words from its own data; used for everything the server knows: venues, menus, dishes, events, shows, excursions, ports, places, days) and **Snapshot** (client-supplied bounded data validated by shape; used for games). | Reference is the existing safe model; snapshot is needed only where the server has no data. |
| What a poll option can be | A text line (as now) **or** a reference bundle. Mixed options are allowed. A bundle option is rebuilt by the server and **re-checked at read time** (cancelled, past, not on your sailing). | Lets "which dinner" be real venues, not typed names. |
| Who can add options | Poll creator chooses **Admin only** (default in made groups), **Anyone** (default in 1:1 and party chats). Max 6 options, max 2 added by one person. | Keeps a poll from becoming a free-for-all. |
| Who can decide | The poll's creator or a group admin; in a 1:1 or party chat, either person. After deciding, the poll is closed and cannot be reopened (a new proposal is made instead). | Same admin rule as pins and polls today. |
| Decision effect | **Never automatic.** A decision card offers each member Add to my day / Remind me / Book. Going on a plan keeps the existing rule (adds to the programme, can be undone, never removes something the guest saved themselves). | A chat must not change someone's day, spend money or book without their own tap. |
| Booking | **Hand-off only**: Book opens the existing booking screen for that venue or excursion with the day, time and party size filled in as hints. No booking, payment or cancellation from chat. | Matches the "answering never books" rule. |
| Time-slot polls | Slots are explicit date and time pairs on the sender's sailing. Each voter privately sees clashes with their **own** plan (never anyone else's, never shown to the group). | Useful, and the privacy rule is simple. |
| Where game state travels | In the payload, opened by **message id** (`?bundle=<conversationId>.<messageId>`), never in a URL. Explicit compact puzzle plus a version, not a seed; the solution is never sent and is recomputed by the game's own solver. | No bypass of chat membership; survives generator changes. |
| Several recipients | The dialog multi-selects conversations; one message per conversation with its own client id (idempotent), partial failure reported per conversation. | "These three chats" is more useful than one. |
| Price and identity | **Never in a bundle** (same `ForbiddenKeys` guard). Offers and prices are out of scope unless the owner says otherwise. | Same rule as cards. |
| Offline | Reading is offline (cached thread). Votes and answers are held and sent later (existing `answerJob`). Sends are queued. Opening a game from a bundle works offline. | Existing offline contract. |
| Language | English only; strings in `enCore.ts` and `enLate.ts`, every key a literal `t('...')`. | CLAUDE.md. |
| QR for every bundle | The registry gives **every bundle type a QR form automatically**; a phase is not done until its types show **Show QR code** in the dialog. Two forms: a **direct code** for public reference bundles (the code holds only the type and ref) and a **handoff code** (a short-lived server token) for anything personal, large or private: game snapshots, booked excursions and dinners, group invites, connect codes. | One mental model, no per-feature QR work, and a code never carries more than the server would have sent in chat. |
| Scanner | One in-app scanner opened from the **top-bar scan icon**, using `BarcodeDetector` where present and a JavaScript decoder fallback (Safari on iPhone, Firefox). It only acts on this app's own addresses; any other code is shown as text and never opened. A scan **never acts by itself**: it opens a receive sheet with the preview and the choices. | Safe on a ship full of strangers; matches the existing `readCode` rule. |
| Hosting headers | Widen `Permissions-Policy` from `camera=()` to `camera=(self)` in `SecurityHeaders.cs` and `docs/static-host-headers.md` (microphone and geolocation stay off). | The camera is blocked today, so no scanner can work until this changes. |

## 5. Design

### 5.1 The bundle message

`Kind = 'bundle'`, `Payload` JSON:

```
{ "type": "event", "v": 1, "title": "Trivia: Ship Secrets", "subtitle": "Day 3, 16:00, Explorers Lounge",
  "path": "/entertainment/...", "day": 3, "time": "16:00", "place": "Explorers Lounge",
  "when": { "day": 3, "time": "16:00", "minutes": 60 }, "ref": "event:abc:3",
  "data": { ... type-specific, bounded ... }, "note": "who is in?" }
```

- Types are `<family>` or `<family>.<name>`: `venue`, `menu`, `dish`, `event`, `show`, `activity`, `excursion`, `port`, `place`, `day`, `board`, `decision`, `game.<id>`.
- `title`, `subtitle`, `path`, `day`, `time`, `place`, `note` are always plain fields, so any client, the push preview, search and a screen reader can show a bundle **without** understanding `data`. An unknown `type` (an older app) shows the title and subtitle and says "Update the app to open this".
- `when` marks a bundle as **plannable** (it can be proposed, put in a time-slot poll, added to a day, reminded, clash-checked). A venue or menu has no `when`; an event, show, excursion or dinner does.
- Reference bundles: client sends `{ type, ref }`; server rebuilds everything from `ShipReference`, `ExplorerCatalogue`, `ProgramRules`, `ExcursionRules`, `Itinerary`, the sender's timeline. Snapshot bundles (games): server writes the words from a fixed table; only `data` (never rendered as text) comes from the client. `data` cap 4 KB, character allow-list, no forbidden key, depth at most 3. The note goes through `ProfanityFilter` and `CleanNote` (80 characters, no contact info).

### 5.2 Planning objects

All are messages in the thread; none is a separate screen.

| Object | Made of | States | Answers |
| --- | --- | --- | --- |
| **Proposal** (generalised plan) | one plannable bundle, optional note | open, decided, withdrawn | Going / Maybe / No (existing `ChatResponses`) |
| **Bundle poll** | question plus 2 to 6 options, each text or bundle | open, closed (24 h, on demand, or decided), decided | one changeable vote (existing) |
| **Time poll** | one bundle plus 2 to 6 date-time slots | as above | one vote, or "any of these" later |
| **Decision card** | the winning bundle (or slot), the counts, who is going | final | Add to my day, Remind me, Book, "Done, how was it?" |
| **Day board** | a day, up to 8 bundles with times, each with an "I'm in" toggle, anyone may add (admin setting) | open, past | per item in/out; clashes shown per person to that person only |

Server: extend `ChatPlanningRules` (option cleaning with bundle refs, option add limits, who may add, decide rules, slot validation against the sailing's days), add `ChatBundleRules` (type table, validation, previews, plannable `when`), `ChatBundleService` (build, re-check on read), and a small `ChatOptions` table (`MessageId, OptionNo, Kind, Ref, AddedBy`) for options that were added after the poll was sent. A decided poll stores `DecidedOption` and `DecidedBy` on the message. Votes reuse `ChatResponses`.

### 5.3 Actions (what "actionable" means)

An action is `{ id, label, run }` in a registry; the server withholds actions that cannot apply (cancelled, past, wrong sailing). Shared ids: `open`, `save`, `addToDay` (with a clash warning and the existing confirm), `rsvp`, `vote`, `suggest` (add an option), `decide`, `remind`, `book` (hand-off), `directions` (deck plan), `askGroup` (make a poll from this), `forward`, `playSame`, `playFresh`, `beat`, `sendResult`.

| Bundle | Reads as | Actions for the recipient |
| --- | --- | --- |
| Dining venue or menu | name, deck, hours, today's menu | Open, Save, **Propose dinner** (opens the composer with this venue), Directions |
| Show, event or activity on a day | title, day, time, place | **Going/Maybe/No**, Add to my day, Remind me, Save |
| Excursion | tour, port, day, meeting time | Open, Save, **Ask the group** (poll), Book (hand-off) |
| Port | port, day, arrival and departure, one tip | Open the port guide, Save, **Plan the day here** (starts a day board) |
| Place on the ship | name, deck, section | **Directions**, Meet me here |
| Day plan / day board | the day and its items | **Add all to my day**, I'm in per item, Add an item |
| Decision | winner, counts | Add to my day, Remind me, Book, How was it? |
| Game: start | "Sudoku, Hard, 24 clues" plus thumbnail | **Play this puzzle**, Try a new one |
| Game: current | "Alex is stuck on Sudoku (Hard)" | **Pick up from here**, **Start from the original clues** |
| Game: result | "Solved Kakuro in 9:12" | **Beat it**, Send my time |

Rules: an action never books, pays or cancels; anything that changes the recipient's own data happens on their screen after the normal confirm; clash and "already on your day" are computed for the recipient only.

### 5.4 Front end

Framework-free (`src/domain`, node-tested):

- `chatBundles.ts`: registry `BUNDLE_TYPES[type] = { family, label, icon, openPath, actions, plannable, thumbnail?, parse }`; `parseBundle` (total, null for garbage); `bundleLink` with an allow-list generated **from the routes** (so a new route is allowed without editing `CARD_PATH`); `bundleSummary`.
- `chatPlanning.ts` gains option types (text or bundle), `canAddOption`, `canDecide`, slot helpers, `clashesFor(slot, myDay)`, decision text.
- `games/share.ts` (a later phase): `GameShareAdapter` per game (`describe`, `encode`, `decode` that rebuilds the solution and returns null if unsolvable or malformed, `thumbnail`), with round-trip and fuzz tests.

UI:

- `ui/chat/SendDialog.tsx` (modal; focus-trapped; Escape closes and returns focus; conversation checkboxes with a search once there are more than 8; recent first; Stanley and closed chats excluded; exact preview; a **What do you want to do?** choice: Just send / Ask Going or not / Start a poll with this / Add to a day board; note; result region `role="status"`).
- `ui/chat/ShareButton.tsx`: the chat icon (`MessageSquarePlus`), name "Send <title> to chat". `SendToChat` becomes a thin wrapper so existing venue, menu and plan buttons gain multi-select.
- `ui/onboard/BundleCard.tsx`: renders any bundle from the registry, with state line and actions. `ChatPlanning.tsx` renders bundle options as mini cards with Open and Vote, the Suggest and Decide controls, and the decision card.
- Poll composer: add options by **picking from the explorers** (an in-dialog picker over venues, events, excursions, ports for the sender's sailing) or typing text; time-slot composer limited to days of the sailing.
- Games: a `GameShare` control in `parts.tsx` and `useIncomingBundle(gameId)` on each screen (banner "From Alex: starting position. Back to chat · Try a different puzzle"; failure falls back to a normal new game).
- No new screens, so nav, coverage and screen-count tests do not change; new strings follow the literal-key rule.

### 5.5 Safety, privacy, accessibility

- Membership check on every read and write; supervised children follow the guardian rules already in chat; blocked people cannot add options or vote.
- Reference bundles carry only what is already public to the sailing or the sender's own booking facts; never price, folio, cabin, booking number, or where the sender is. Clashes and "on your day" are private to the viewer.
- Counts for votes, names only for Going (as today); "who has not answered" is never shown by name to the group.
- Bundle options and added options are rebuilt by the server and re-checked on read, so a cancelled event shows as "no longer available" and cannot win a decision.
- The recipient's game decoder is the trust boundary (bounded, total, no HTML, route from the registry not from the payload).
- Accessibility (WCAG 2.2 AA): dialogs trap focus and close on Escape; options are a labelled radio group with spoken results (`pollResultText` extended); cards are `role="group"` with text summaries; thumbnails `aria-hidden`; targets at least 44 px; state never by colour alone; reduced motion honoured.

### 5.6 QR hand-over (scan instead of chat)

**What exists:** `QrCode.tsx` draws a code on the device as one SVG (works offline, black on white in every theme); `CodeScanner` and `scanCode.ts` read a code through the camera (Chromium only) and follow only this app's own addresses.

**Two kinds of code**

| | Direct code | Handoff code |
| --- | --- | --- |
| For | public reference bundles: venue, menu, dish, event or show on a day, port, place, a tour from the public catalogue | personal or private things: a booked excursion or dinner, game snapshots, a day board, a group invite, a connect code |
| Holds | `https://<app>/s?t=<type>&r=<ref>` (about 100 bytes) | `https://<app>/s/<code>`, a short unguessable code |
| Needs a server call to make | No: works with no signal | Yes: `POST /me/shares` stores the bundle or invite and returns the code |
| Life | none (it is public catalogue data) | 15 minutes by default; the sender may choose 1 hour or 24 hours; can be stopped at once; the sender sees "scanned by 2" |
| Why two | Offline on a ship is the normal case, and a public ref reveals nothing | A game board can be 4 KB, far past what a code scans reliably (about 500 bytes in practice), and private things must be revocable |

**Receive sheet (the "immediate receipt and action decision").** A scan opens a bottom sheet, never a page change: what it is (the same bundle card as in chat, with thumbnail), who it is from (first name and last initial, as in people search, for people on the same sailing; otherwise "a guest"), the state for the receiver (on your day already, clashes with your excursion, not on your sailing, expired code), and the **same actions as the chat card** plus Dismiss. For games the actions are Play this puzzle and Start from the original clues. The sheet traps focus, closes on Escape and says what it did (`role="status"`). The receiver's server re-checks everything, exactly as for a chat bundle.

**What can be handed over**

| Type | Direct or handoff | Receiver's choices |
| --- | --- | --- |
| Venue, menu, dish, event or show, activity, port, place | direct | Open, Save, Add to my day, Directions, Going/Maybe/No (as a one-off answer; see below) |
| Booked excursion or dinner, day plan | handoff | Open the public entry, Save, Add to my day (never the sender's booking) |
| Game (start, current, result) | handoff | Play this puzzle, Start from the original clues, Beat it |
| **Group invite** | handoff, made by an admin | **Join** or Decline; eligibility as for any invitation (same sailing, not blocked, group not full, a supervised child needs their guardian's approval); the code stops working when the group is full or the admin stops it |
| **Connect code** (one person) | handoff, made by the guest | **Send a connection request** or Decline; a scan is only an introduction, it never skips the other person's acceptance or the guardian rules |
| Poll, proposal, day board (belong to a chat) | handoff, made by an admin | A member opens it in the chat; a non-member sees the group invite for the chat and, after joining, lands on it; otherwise "Make your own poll from these options" (default, open question 8) |

**Rules**

- A scan **never acts by itself** and never signs anyone in. A signed-out receiver is taken to sign-in, then back to the sheet (the code is kept for 10 minutes in session storage only).
- The code names a message-less share; it never puts personal data in the address, and the QR text for a handoff is just the code. A group or poll code is generated only by someone allowed to invite or to share that object in chat.
- Throttled per person (creating and scanning); a wrong or expired code gives one message ("This code has stopped working") and never says whether it ever existed.
- A direct code is only public catalogue data; if its ref is not found on the receiver's sailing it says "Not available on your sailing".
- Supervised children: a child can scan and see public entries; anything that creates a connection or joins a group follows the guardian rules already in chat; a child cannot create a group invite.
- The scanner turns the camera off the moment it closes, when the tab is hidden, and after a result. It asks permission only when opened and keeps the typed-code box for guests who decline the camera.
- Accessibility (WCAG 2.2 AA): the show-code view has a text version of what the code contains and a Copy link button (so a code can also be handed over without a camera); the scanner has a labelled video, a spoken "Looking for a code" and "Found" status, a large Close button and no time pressure; reduced motion honoured.

### 5.7 Out of scope

Live shared boards or two people playing one puzzle (the Games "multi-player" mode is its own plan); money, prices, splitting costs, booking or paying from chat; sending to people outside the app (the trip huddle's own invite link is separate); the SMS bridge shows only a bundle's words with no actions, as other typed messages do (checked in B1).

## 6. Phases

Order: Q0 (scanner), B1, Q1 (QR for bundles), Q2 (QR invites), then B2 onward; each B phase also adds its types to the QR forms (Q1) and is not done until it shows **Show QR code** in the dialog.

Rules for every phase (CLAUDE.md): English only; verify with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` only (no browser testing, no `dotnet test`); commit only when asked, then stop so the user can `/clear`; do not start the next phase until asked. Server code gets unit tests written but not run (open question 2).

### Q0: the in-app QR scanner (before B1)

> **Built 2026-11-22** (front end checked with test, lint, tsc and build; no browser testing, so the camera on a real iPhone and Android phone is for the owner to check). **Done:** scan icon first in the top ribbon (`ScanButton` in `TestBar.tsx`, there is no brand bar on phones) opening a dialog over the page; `ScannerPanel` shared with the Tools card (`CodeScanner`); `useCodeScanner` (browser reader when it reads QR codes, otherwise `jsqr` loaded only on first scan as its own 48 kB gzip chunk; camera released on close, on a result and when the page is hidden, and restarted when it is back); pure `scanSession.ts` and `scanCode.ts` (now reads `/s/<code>` and `/s?t=&r=` as `share`, still follows only this origin) with tests; `Permissions-Policy` now `camera=(self)` in `SecurityHeaders.cs` and `docs/static-host-headers.md` (**the real static host must send the same header when it is deployed**). A share code shows "not available yet" until Q1.

- Top-bar **scan icon** beside Search (name "Scan a code"); opens a full-screen scanner dialog without leaving the page: focus-trapped, Escape closes, camera off on close, tab hidden or result found; typed-code box kept for guests who decline the camera.
- **Safari and Firefox fallback**: a small JavaScript QR decoder used when `BarcodeDetector` is missing (the existing `CodeScanner` shows no scan button on an iPhone today). Check the bundle cost and load it only when the scanner opens.
- **Fix the headers**: `Permissions-Policy` `camera=(self)` in `server/Princess.Api/Services/SecurityHeaders.cs` and `docs/static-host-headers.md`, with the security test updated.
- `scanCode.ts` extended to know the new `/s` and `/s/<code>` addresses and hand them to a receive-sheet component (a stub that says "Not available yet" until Q1). Existing place and link codes keep working. The `CodeScanner` card reuses the same scanner component.
- Strings, a shared `useCamera` hook (permission states: asking, denied, unavailable, in use), tests for the reader and the hook's state logic, and the icon in the header.
- Done when: the top-bar icon opens a scanner that reads a place code on Chrome and on a browser with only the fallback, and the camera light goes off when it closes.

### B1: the foundation (send dialog, bundle card, registry), with venue and menu

- Server: `ChatBundleRules`, `ChatBundleService`, `kind: 'bundle'` on send and read, preview and push words, stats and search treatment of `bundle`, `ChatBundleRulesTests.cs`. Venue and menu re-expressed through the registry.
- Front end: `chatBundles.ts`, `parseBundle`, `bundleLink`, `SendDialog`, `ShareButton`, `BundleCard`, thread hook-up, fallback for unknown types, queued send, SMS-bridge check; `SendToChat` opens the dialog.
- Done when: a venue or menu goes to two chats at once, an older client shows the fallback, and the old card kinds are untouched.

> **Built 2026-11-22** (front end checked with test, lint, tsc and build; C# written but not compiled or run, so please run `dotnet build` once). **Done:** `ChatBundleRules` and `ChatBundleService`-style `BundleAsync` in `ChatShareService` (venue and menu rebuilt from the ship's data, note through the profanity and child-safety rules, forbidden-key guard), `kind: 'bundle'` on send and read, `Bundle` in `ChatMessageDto`, no edit for a bundle, `ChatBundleRulesTests.cs`; front end `chatBundles.ts` (registry, total `parseBundle`, `bundleLink`, `shareInput`, `sendToMany`) with tests, `SendDialog` (multi-select, search above 8 chats, note, per-chat result), `ShareButton`, `BundleCard` (unknown type or newer version shows "Update the app to open this"), thread hook-up; `SendToChat` now opens the dialog and sends venue and menu as bundles while excursion, dinner and plan keep their old kinds. **Not done, on purpose:** no `ChatBundleService` class (not needed for two types, `ChatShareService` builds them); read-time re-check is deferred to B2 (a venue or menu cannot be cancelled); a send is not queued offline, like the old cards, because it has to be true when sent; the "What do you want to do?" choice arrives with B2; the SMS bridge sends the bundle's words (title and subtitle) as it does for other typed messages, with no actions.

### Q1: show a QR code for any bundle, and the receive sheet

- Server: `ChatShareService`-style **handoff**: `POST /me/shares` (the bundle or invite, a life of 15 minutes, 1 hour or 24 hours), `GET /me/shares/{code}` (the receiver's rebuilt, re-checked preview), `DELETE /me/shares/{code}` (stop), scan counts to the sender, table `Shares` and script, throttles, tests written beside the chat tests (not run; open question 2).
- Front end: the registry gives each type its QR form (direct or handoff); `SendDialog` gains **Show QR code** next to Send (same preview, same note, same mode choice); show-code view with the text version, **Copy link**, a life picker for handoff codes and **Stop sharing**; the **receive sheet** opened by the scanner, with the bundle card, who it is from, the receiver's state line and the same actions as the chat card; signed-out round trip.
- Applies to everything built so far (venue, menu); **every later phase adds its types to the QR forms as part of its own done-when**.
- Done when: one guest shows a venue code, a second guest scans it from the header and chooses Save or Add to my day with no chat involved, and a stopped or expired code gives the single "stopped working" message.

> **Built 2026-11-22** (front end checked with test, lint, tsc and build; C# written but not compiled or run, so please run `dotnet build` once). **Done:** server `ShareCodeRules`, `BundleShareService`, `ShareEndpoints` (`GET /me/shares/direct`, `GET /me/shares/{code}`, `POST /me/shares`, `GET /me/shares`, `DELETE /me/shares/{id}`, a 60 a minute limiter per person), table `BundleShares` (only a hash of the code is kept) in `db/01-schema.sql` and `00-drop-all.sql`, `ShareCodeRulesTests.cs`; front end `shareCodes.ts` (with tests), `qr` on each registry row (venue and menu are `direct`), **Show QR code** in `SendDialog` (`ShowCode`: QR, text version, Copy link, and for handoff types a life picker, scan count and Stop sharing), `ReceiveSheet` (the chat card, who it is from, Save as a venue pin, Dismiss; "This code has stopped working" and "Not available on your sailing") opened by the scanner and by the new `/s` and `/s/:code` pages (not in the route table or any menu; sign-in keeps the address, so a signed-out receiver lands back on it). **Deviations:** venue and menu are public, so only direct codes are in use today; the handoff path is built and tested in its rules but nothing in the registry uses it until a personal type arrives (B2 onward). A handoff code carries no note. "Add to my day" is not offered for a venue or menu (it has no time); it arrives with the event types in B2. The receive sheet shows inside the scanner dialog rather than as a separate bottom sheet. The sender's scan count is refreshed by a button, not live.

### Q2: group invites and connect codes by QR

- **Group invite code** (admin of a made group, or the creator): scan, see the group's name, who is in it and who invited, then Join or Decline; eligibility, size cap, blocks, same-sailing and guardian approval exactly as for an in-app invitation (reuse `ChatGroupRules` and the invitation flow; no new way into a group); the admin can stop it, and it stops itself when the group is full.
- **Connect code** (a guest's own, from the chat People page): scan, see the person (first name and last initial), then **Send a connection request**; the other person still accepts; a supervised child's requests follow the guardian rules.
- Poll, proposal and day-board codes from B3 to B6: members open them in chat; a non-member gets the group-invite sheet and then lands on the object (default of open question 8).
- Done when: two guests next to each other can connect, or one can join the other's group, by scan alone, with every existing safety rule still enforced and tested.

> **Built 2026-11-22** (front end checked with test, lint, tsc and build; C# written but not compiled or run, so please run `dotnet build` once). **Done:** group invite codes (`invite:<group id>`, made only by an adult creator) and connect codes (`connect:me`) are handoff codes in the same `BundleShares` table, so they keep the 15 minute / 1 hour / 24 hour life, Stop sharing and the scan count; `POST /me/shares/{code}/accept` makes the ordinary invitation (`ChatGroupService.JoinByCodeAsync`, same cap, blocks, same-sailing search rule and guardian approval; an adult is answered yes through the normal `RespondAsync`) or the ordinary request (`ChatConnectionService.ConnectByCodeAsync` over `RequestAsync`, so eligibility, limits, cooldown and guardian routing all apply, and the owner still accepts); a scan only previews (`SharePreviewDto.Intro`: name, member count, state) and a non-findable scanner gets the same 404 as a stopped code; front end `ReceiveSheet` shows Join or Send a connection request only when the state is `open`; **Show a QR code to join** on the group page (creator) and **Show my connect code** on the People page; `ShareCodeRulesTests` extended. **Deviations:** only the creator makes a group invite code (admins arrive with B3); poll, proposal and day-board codes wait for B3 to B6.

### B2: plannable bundles and proposals (events, shows, excursions, dinners)

- Bundle types `event`, `show`, `activity`, `excursion`, `dinner` with `when`; chat icon on their explorer rows and detail pages (dining, entertainment, activities, exercise, spa, shopping events, excursions).
- **Proposal** generalises the plan card to any plannable bundle: Going/Maybe/No, Add to my day with clash warning, Remind me, state line (past, cancelled, on your day, clashes). Going on an excursion or dinner records the answer and **never books**.
- Done when: an excursion or dinner can be proposed to a group and answered Going, which removes the "plan only for programme events" limit.

> **Built 2026-11-22** (front end checked with test, lint, tsc and build; C# written but not compiled or run, so please run `dotnet build` once). **Done:** one new ref form, `event:<eventId>:<day>` (the same `eventId:day` a plan uses), built by `BundleAsync` through `PlanAsync` so the sailing, the day and the excursion or dinner rules are the plan's own; the bundle's type is `excursion` for a tour, `dinner` for a dinner and `event` for any other programme or Explorer event; all three are public, so their QR codes are direct. Registry rows with `plannable`, `isPlannable`, `REF_TYPES` (so a booked `excursion:<id>` card stays an older card and gets no QR), `SendEventToChat`, and a **What do you want to do?** choice in the send dialog (Just send it, or Ask who is going, which sends the existing plan so Going/Maybe/No, Add to my programme and the clash rules are unchanged and answering never books). Chat icon on venue event rows and on excursion cards. **Deviations:** the proposal is the existing plan kind rather than a new object; the `show` and `activity` types are folded into `event` (a show is an Explorer event); no chat icon yet on dinner rows (a dinner is shared today only from a booked table, which stays an older card; the dinner bundle exists on the server for the next phase's pickers); the receive sheet does not offer Add to my day for these yet.

### B3: bundle polls (the options are real things)

- Poll payload v2: options are text or bundle; composer with the explorer picker; bundle options shown as mini cards with Open and Vote; Suggest (add option) with who-can-add and the limits; server re-check on read; `ChatOptions` table and script; held votes and counts unchanged; spoken results extended.
- Coordinator reuse: remind, tally card, compromise text for bundle options.
- Done when: "Which dinner on Tuesday?" can be a poll of three real venues, anyone allowed can add a fourth, and everyone can open each.

> **Built 2026-11-23** (front end checked with test, lint, tsc and build; C# written but not compiled or run, so please run `dotnet build` once, as open question 2 planned after B3). **Done:** poll payload gains `Refs` (one per option, a bundle ref or null; the option's words are the bundle's title, so an older app reads plain text and the old payload still parses); `POST` poll takes `optionRefs`, rebuilds each through `BundleAsync` (400 `shareRef` when this sailing lacks it), up to six options when one is a bundle (five otherwise, so Stanley's polls are unchanged); on every read the options are rebuilt for the reader (`Bundles`, and `Gone` for one that is no longer available to them); `ChatPlanningRules.CleanPoll` overload with tests; front end `cleanPollRows`, the poll form's **Add a thing from the app** picker (the plannable events, tours and dinners the guest's own trip runs), bundle options shown with where, when and Open, "No longer available" for a gone one. **Not done, on purpose (moved to B4):** Suggest (anyone adds an option), the who-can-add setting and the `ChatOptions` table, coverage of venues and ports in the picker (arrives with B7), and coordinator compromise text for bundle options.

### B4: decide and make it happen

- **Decide** (creator or admin): closes the poll and posts the **decision card**; `DecidedOption` and `DecidedBy`; refuses a cancelled or past winner; ties resolved by the decider choosing.
- Decision actions: Add to my day (reuses the plan import, clash warning, existing confirm), Remind me (uses the existing reminder system), **Book** hand-off to the normal booking screen with day, time and party size as hints, **How was it?** follow-up feeding the group recap.
- Done when: a group goes from poll to decision to each person's own day and reminder without chat ever booking anything.

> **Built 2026-11-23** (front end checked with test, lint, tsc and build; C# written but not compiled or run, so please run `dotnet build` once, as open question 2 planned after B4). **Done:** `POST .../messages/{id}/decide` (`ChatPlanningService.DecideAsync`; who asked, a made group's admin, or either person in a 1:1; once only; the winner is rebuilt for the decider and refused as `gone` if unavailable; closes the poll; nothing booked or added), `DecidedOption` and `DecidedBy` on `ChatMessages` (`db/01-schema.sql`), `Decided` and `MayDecide` on the tally, `ChatPlanningRules.MayDecide` with a test; front end `decidePoll`, a Decide picker on the poll, and a decision block in the poll (`decisionActions`, tested): **Add to my day**, **Remind me** (30 minutes ahead) for a programme event, **Open to book** for a tour or dinner. **Deviations:** the decision shows inside the poll message rather than as a new message, so there is no separate decision card to forward; **How was it?** waits for B10 (it needs the outcome table); Suggest (anyone adds an option), the `ChatOptions` table and coordinator compromise text for bundle options are still not done and move to B5.

### B5: time-slot polls and clash-aware voting

- Time poll payload and composer (slots only on days of the sailing); private per-voter clash markers from their own plan and bookings; compromise suggestion across slots; "any of these" answer if the owner wants it.
- Done when: a group can pick a time for a chosen activity and each person sees their own clashes before voting.

> **Built 2026-11-23** (front end checked with test, lint, tsc and build; C# written but not compiled or run, so please run `dotnet build` once). **Done:** a poll gains `Slots` (`day@HH:mm`, two to six, days 1 to the sailing's length; the options' words are built by the server, so the sender types none; `ChatPlanningRules.CleanSlotPoll`, `ParseSlot`, `SlotClashes`, tests written); `ChatShareService.SailingDaysAsync` and `SlotClashesAsync`; on every read the reader gets `Clashes` (slots that overlap their own programme events, a slot taken as 60 minutes), never anyone else's and never stored; front end `SlotPollForm` (day, time, add, remove), a "Clashes with your plans" marker beside each clashing slot, a compromise hint when the vote is tied (first leading slot that does not clash with you; `compromiseSlot`, tested). Decide, close and vote are unchanged. **Deviations:** clashes look at the programme plan only (booked tours and dinners are not yet counted); the activity is named in the question rather than carried as a bundle; no "any of these" answer; Suggest, `ChatOptions` and compromise text for bundle options remain not done.

### B6: day boards and the pre-booking huddle

- **Day board** bundle (up to 8 items, I'm in per item, anyone may add by setting, add all to my day), built on `groupBoard.ts`; "Plan the day here" from a port bundle.
- Huddle: shortlist cards (sailing, port, cabin type) become bundles so a huddle poll can compare them; keeps the huddle's adult-only, no-price-personal rules.
- Done when: a group can build a port day together, and a huddle can poll between two sailings using the same cards.

> **Built 2026-11-23, day board only** (front end checked with test, lint, tsc and build; C# written but not compiled or run, so please run `dotnet build` once). **Done:** a new message kind `board` (`ChatBoardRules`: a day of the sailing and one to eight `event:` refs on that day, rebuilt for each reader on every read, so an item gone for them shows "No longer available"); "I'm in" per item kept as one bit per item in the member's single `ChatResponses.Choice` (no new table), `PUT .../messages/{id}/board`, counts per item in the tally, `mine` as the reader's bits; the reader's own clashes marked per item (private, never stored); front end `BoardForm` (under Plan with the group: a day and up to eight events) and `BoardMessage` (I'm in toggle, count, Open, Add the ones I'm in for to my day, Add all to my day, programme events only, tours and dinners never added from chat). **Not done (left for a later pass):** anyone-may-add and its admin setting (items are fixed when the board is sent), "Plan the day here" from a port bundle (ports are B7), and the whole huddle half (shortlist cards as bundles, a huddle poll between two sailings); the done-when above is therefore met for a group building a day from programme events, not yet for ports or huddles. Show QR code for boards is not added (members open them in chat, per Q2).

### B7: places, ports, dishes and the rest of the explorers

- Types `port`, `place` (Directions, Meet me here), `dish` (from `DishSave`), `day` (the day summary as an itinerary with **Add all to my day**), shortlist and trip itinerary.
- A **coverage test** lists every explorer and sub-screen route and states its bundle type or why it has none, so nothing is missed silently.
- Done when: every explorer item worth sharing has a chat icon, and the coverage test proves it.

> **Built 2026-11-23, port, place and dish only** (front end checked with test, lint, tsc and build; C# written but not compiled or run, so please run `dotnet build` once). **Done:** refs `port:<portId>` (a port the guest's own sailing calls at; first call's day, arrival and all aboard; opens the port guide), `place:<placeId>` (name, deck, section; no time, no screen) and `dish:<venueId>:<slug>` (dish name and restaurant; opens the restaurant page; no price, no order), all built by `BundleAsync`, direct QR codes, none plannable; registry rows, chat icon on the port page and on each dish (menu and children's menu); `BUNDLE_COVERAGE` and its test in `chatBundles.test.ts`. **Not done:** chat icon for a place on the ship (deck-plan screens), Directions and Meet me here actions, `day` and itinerary bundles with Add all to my day, shortlist; the coverage list marks the last two "none yet".

### B8: games, part 1 (infrastructure, Sudoku family, Binairo)

- `GameShareAdapter` and registry, `GameShare` control in `parts.tsx`, `useIncomingBundle`, banner and failure fallback, route allow-listing, server `game.*` snapshot validation.
- Adapters with round-trip and fuzz tests for Sudoku, Diagonal, Jigsaw, Killer and Binairo; modes Start and Current (notes only when ticked).
- Done when: a Sudoku board sent from the game opens the same puzzle (start or current) on another device.

> **Built 2026-11-23** (front end checked with test, lint, tsc and build; C# written but not compiled or run, so please run `dotnet build` once, as open question 2 planned after B8). **Done:** `games/share.ts` (`encodeGame` and total, bounded `decodeGame` for Sudoku, Diagonal, Jigsaw, Killer and Binairo; text of `key=value` pairs over letters, digits, `=`, `;` and `,`; the solution is never sent and is rebuilt by the receiver's own solver, which refuses a puzzle that is not solvable, or not unique for the plain variants; modes Start and Current, notes only when ticked) with round-trip, mutation and fuzz tests; `solveUniqueWithin` (node budget) in `sudoku.ts`; server `ChatBundleRules.BuildGame` and `GameDataOk` (type `game.<id>`, words and screen from a fixed table, `Data` capped at 4000 characters and allow-listed), `Data` on the bundle, its DTO and the send request, `BundleAsync` takes the text, tests; front end registry rows for `game.<id>`, `gameOfBundle`, `parseBundle` keeps `data` only when plain, `games-explorer` added to the openable paths, `BundleCard` shows Play this puzzle, or Pick up from here and Start from the original clues, and an undecodable puzzle says it cannot be opened; `GameShare` (choose start or board so far, pencil notes optional, then the send dialog) and `IncomingNote` / `useIncomingGame` in `parts.tsx`, wired into the Sudoku family and Binairo screens. **Deviations:** the puzzle is handed to the game screen in memory (`games/incoming.ts`, 30 seconds, one game) rather than by `?bundle=` message id, so nothing about it is in an address and it works offline; `game` is not in the server's ref types, so no poll, board or QR code can name a game; **Show QR code is not offered for games yet** (a handoff code would have to hold the puzzle text, left for a later pass); no thumbnail; the server checks the puzzle text's shape, not that it is a solvable puzzle (the receiver's decoder is the trust boundary, as planned).

### B9: games, part 2 (the other 12)

Futoshiki, KenKen, Crossmath, Kakuro; Hitori, Slitherlink, Nurikabe, Hashi, Nonogram; Cruise Wordle (result pattern and word-list index, never the word as text), Word Search, Codeword, Minesweeper (decide whether the layout is sent; the payload is never rendered). Thumbnails per family. Worth splitting into two sessions if it runs long.

> **Built 2026-11-23, part 1 only: Futoshiki, KenKen and Hitori** (front end checked with test, lint, tsc and build; C# written but not compiled or run). **Done:** `games/share.ts` encodes and decodes the three (digits plus `s` signs for Futoshiki, `g`/`o`/`t` cages for KenKen, `e` entries or marks; the solution is never sent and the receiver's own logic solver must finish the grid with no rule broken, else the text is refused), tests for round trips, cages, signs and nonsense; server `Games` table and clue sizes for the three; send from and open in the three screens, as for Binairo. **Not done (left for a later pass):** pencil notes for Futoshiki and KenKen are not sent; **still to do from B9:** Crossmath, Kakuro, Slitherlink, Nurikabe, Hashi, Nonogram, Cruise Wordle, Word Search, Codeword, Minesweeper, and thumbnails per family.

> **Built 2026-11-23, part 2: Crossmath, Kakuro, Slitherlink, Nurikabe, Hashi and Nonogram** (front end checked with test, lint, tsc and build; C# written but not compiled or run). **Done:** `games/share.ts` encodes and decodes the six (Crossmath: layout kinds, signs, given numbers and the tray, equations found again from the layout; Kakuro: white squares, run sums and givens; Slitherlink: numbers; Nurikabe and Hashi: clue or island positions and numbers; Nonogram: row and column clues). The solution is never sent: the receiver's logic solver must finish the puzzle (and check it) or the text is refused. Tests for round trips, nonsense, mutation and fuzz; server `Games` table and size checks; send from and open in the six screens. **Not done:** Cruise Wordle, Word Search, Codeword and Minesweeper (next pass), Kakuro pencil notes, and thumbnails per family.

> **Built 2026-11-23, part 3: Cruise Wordle, Word Search, Codeword and Minesweeper** (front end checked with test, lint, tsc and build; C# written but not compiled or run). **Done:** `games/share.ts` encodes and decodes the four. Wordle sends the answer's place in the word list (never the word as text) and, for the board so far, the guesses, which the receiver plays again to get the result; Word Search sends the letters, word list, hidden answer and found words, and the receiver checks every square is covered by a listed word or the answer and that no listed word hides over the answer; Codeword sends the layout, numbers and given letters and the receiver's word-list logic must finish it; Minesweeper sends the mines and start square (layout is sent, never shown as text) and the receiver checks the start is safe and logic clears it. Tests for round trips, nonsense, mutation and fuzz; server `Games` table and size checks; send from and open in the four screens. **Not done:** Kakuro pencil notes, Futoshiki and KenKen notes, and thumbnails per family. All sixteen games are now sendable.

### B10: results, challenges and "played" counts

- `SolvedCard` gets Send my result; **Beat it** opens the same puzzle with a target time; `ChatBundleOutcomes` and an outcome endpoint; "Solved by 3 of 5" counts, names only for people who chose to report. The same outcome table gives a decision card its "Done, how was it?" tally.

> **Built 2026-11-23, part 1 only: results and Beat it** (front end checked with test, lint, tsc and build; C# written but not compiled or run). **Done:** "My result: solved in 9:12" in each game's Send to chat dialog once the puzzle is solved (Cruise Wordle: once won), sent as `game:<id>:result` with the starting position plus a time (`tm`, 1 to 359999 seconds, never the answer); the card says "solved in 9:12" and its action is **Beat it**, which opens the same puzzle from the clues and shows "Time to beat" in the note above it; `ChatBundleRules.BuildGame` accepts `result` only with a sensible time (and refuses a time on a start or current), with tests on both sides. **Not done (B10 part 2):** `ChatBundleOutcomes` table and outcome endpoint, "Solved by 3 of 5" counts with names only for people who chose to report, the "Done, how was it?" tally on decision cards, and a won or missed message when a beat attempt ends.

> **Built 2026-11-23, part 2: "I did it" and counts** (front end checked with test, lint, tsc and build; C# written but not compiled or run). **Done:** `PUT .../messages/{id}/outcome` (`ChatPlanningService.OutcomeAsync`) records that the caller did the thing a bundle names, or takes it back; bundle messages now carry a tally (`counts[0]` people who did it, `going` the names of the others who said so, first name and last initial, blocked people left out), so a game card shows an **I did it** toggle and "Done by 3 people", or the names. **Deviations:** it reuses the `ChatResponses` table (choice 1) instead of a new `ChatBundleOutcomes` table, as nothing more is stored; the toggle is on game cards only for now. **Not done:** "Done, how was it?" tally on decision cards and a won or missed message when a beat attempt ends; no C# test added for the new tally branch.

### B11: pass it on, share from everywhere, polish

- **Forward** a bundle to another chat (original sender named, re-validated); chat icon on Home "today" cards, explorer landing tiles and Stanley answers (admin confirm in made groups, as the existing Stanley share); "recently sent to" ordering.
- Thumbnails everywhere, empty, error and stale states reviewed for every type, accessibility pass, release gates ("every bundle type has a preview, a fallback and an action", "every game has an adapter"), docs, and, only if the owner wants it, folding the legacy `card`, `place`, `plan` and text-poll kinds into the registry.

> **Built 2026-11-23, part 1 only: Forward** (front end checked with test, lint, tsc and build; no server change). **Done:** a **Forward** button on every bundle card you can act on, opening the send dialog; only the bundle's `ref` (plus a game's puzzle text) and an optional note go, so the server rebuilds and re-validates it for the new chat (`forwardInput`, tested). **Not done (B11 part 2):** naming the original sender, chat icon on Home cards, explorer tiles and Stanley answers, "recently sent to" ordering, thumbnails, state review, accessibility pass, release gates and docs.

> **Built 2026-11-23, part 2 (small): recently sent to and release gates** (front end checked with test, lint, tsc and build; no server change). **Done:** the send dialog lists the chats last sent to first (`chatRecents.ts`, ids only, kept on this device in `data/recentSent.ts`); node gates that every bundle type has a label, family and code kind and every shareable game has an adapter. **Not done (B11 part 3):** naming the original sender of a forward (needs the server), chat icon on Home cards, explorer tiles and Stanley answers, thumbnails, state review, accessibility pass, docs.

> **Built 2026-11-23, part 3 (small): chat icon on Home** (front end checked with test, lint, tsc and build; no server change). **Done:** the Home "what is on next" events and tonight's dining reservations carry the send-to-chat icon (an event as a bundle or a plan, a booking as a card; no price or booking number goes). **Not done (B11 part 4):** icon on explorer landing tiles and Stanley answers, naming the original sender of a forward (needs the server), thumbnails, state review, accessibility pass.

> **Built 2026-11-23, part 4 (small): chat icon on explorer venue tiles** (front end checked with test, lint, tsc and build; no server change). **Done:** each venue card in the explorer lists sends the venue as a bundle. **Not done (B11 part 5):** Stanley answers (needs the server: admin confirm in made groups), naming the original sender of a forward (server), thumbnails, state review, accessibility pass.

> **Built 2026-11-23, part 5 (small): states review** (front end checked with test, lint, tsc and build; no server change). **Done:** the send dialog offers **Try again** when the chat list fails to load; the **I did it** toggle says when it could not be saved, and its count is a standing status region so a screen reader hears changes. **Not done (B11 part 6):** Stanley answers (server: admin confirm in made groups), naming the original sender of a forward (server), thumbnails, a fuller keyboard pass.

## 7. Risks

- **Scope creep in B2 to B6.** Each planning object is built once, in a fixed order, and each phase is usable on its own.
- **Old clients.** A poll with bundle options must degrade to readable text on an older app (title and subtitle per option); tested in B3.
- **Decision against changing facts.** A winner can be cancelled or pass before the decision; the server re-checks at decide time and at read time.
- **Privacy in clashes.** Clash markers are computed on the viewer's device or for the viewer only; a test asserts that no endpoint returns another person's clash.
- **Payload size and decode cost for games** on the largest grids: the 4 KB cap, tight encoders, and a measured "Setting up the puzzle" state for hard Killer and 13x13 Codeword.
- **Chat stats and search** count messages by kind; `bundle` and v2 polls are included or excluded deliberately in B1 and B3.
- **Strangers' codes.** A QR is anonymous to look at; the receive sheet never acts, never opens another origin, names the sender only for people on the same sailing, and codes are short-lived, throttled and stoppable. A fake code pasted over a real one can do no more than a person typing the address could.
- **Camera on iPhone** needs the JavaScript fallback and the header change together; Q0 checks both (the header change is the likelier thing to be forgotten).
- **Code size.** Only public refs are direct codes; anything larger goes through a handoff code so a code stays easy to scan.
- **C# changes are not compiled by the npm checks** (open question 2).

## 8. Open questions (defaults I will use unless told otherwise)

1. **Prices and offers**: left out of bundles (default).
2. **Verifying server code**: `dotnet test` is ruled out. Default: write the C# and its tests, review them, and ask you to run `dotnet build` yourself after B1, B3, B4 and B8 (or allow `dotnet build` alone, which does not run tests).
3. **Who may add poll options**: admin only in made groups, anyone in 1:1 and party chats (default).
4. **Who decides**: creator or a group admin; either person in a 1:1 (default).
5. **Decision effect**: offers Add to my day, never automatic (default).
6. **"Anyone can add to a day board"**: on in 1:1 and party chats, admin-set in made groups (default).
7. **Game notes and results**: notes only when ticked; result time and level always, hints used only when ticked; "Solved by" counts for all, names only for those who report (default).
8. **Poll, proposal and board codes for non-members**: show the group invite and land on the object after joining; if the group does not allow invites, offer "Make your own poll from these options" (default).
9. **Handoff code life**: 15 minutes by default, 1 hour or 24 hours on request; scanned by many until it expires or is stopped (default).
10. **Name on the receive sheet**: first name and last initial for people on the same sailing, otherwise "a guest" (default).
