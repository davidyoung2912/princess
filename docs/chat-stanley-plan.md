# Chat: Stanley as a friendly host

Plan for letting Stanley make chat feel friendlier: softer wording around connection requests, help with writing and rewording, and gentle nudges in conversations. Written 2026-11-09. Phases are built one at a time, only when asked. The decisions in section 1 are proposals until the owner confirms them.

## 1. Principles and proposed decisions

> **Owner decision (2026-11-10): no "AI" wording anywhere in the guest-facing UX.** Wherever this document says "AI label", read "Stanley's picture and name only". Honesty is kept by other means ("automatic notice", naming a person who wrote a message, never claiming to be a crew member). A test should fail the build if a guest-facing Stanley string contains the word "AI".

| Question | Proposed decision |
| --- | --- |
| Who decides | **People and staff decide; Stanley speaks and suggests.** Accept, decline, block, remove, report and end stay with guests and staff. Stanley never accepts, declines, blocks, sends or reports on anyone's behalf. |
| What stays deterministic | Everything that protects: `ProfanityFilter`, guardian approval, child restrictions (no phone numbers, links or photos), rate limits, daily caps, the 7-day decline cool-down, blocks and the report flow. A model never gates any of these. |
| Privacy | Stanley sees **only what a guest hands him**: a draft they ask him to improve, a message they tap "Ask Stanley about this" on, a request they ask him to explain, or a question they ask him in the conversation itself (3.5). He does not read a conversation in the background. Background nudges (phase 6) are optional, off by default and opt-in per guest, with a visible notice (section 5); the owner may drop them, because asking him in the chat covers most of the need. |
| Asking Stanley in a chat | A member can ask him a question in a group or one-to-one conversation (owner, 2026-11-09), and his answer is a message everyone in the conversation sees. Asking is the consent. It works in the app only; the SMS bridge is left out of the first version (owner, 2026-11-09). |
| Children | Stanley is off in any conversation a supervised child is an active member of, and never helps a supervised child's request. A guardian can switch him on for their child later (not in this plan). |
| Voice | Warm, brief, plain English. Always labelled "Stanley" with his picture and the AI label; never written as if from the other guest. English only (project rule). |
| Cost | Local rules first. A model call is made only on a guest's tap (rewrite, icebreaker, explain), on the **small** tier, behind the existing model meter, hourly limit and daily ceiling. Nothing is called per message. |
| Failure | If Stanley is off, the model is unavailable or a cap is reached, chat works exactly as it does today. Every Stanley feature has a plain fallback and none blocks sending, accepting or declining. |
| Front end | A thin client. The server builds Stanley's wording and suggestions; the screen renders them. The front end does not know whether a suggestion came from a script or a model. |

## 2. What exists, and what changes

Exists today (see `docs/chat-plan.md`, `docs/chat-urgency-plan.md`, `docs/stanley-plan.md`):

- Connection rules in `ChatConnectionRules` and `ChatConnectionService`; notices in `ChatNotifier` (`RequestNotice`, `AcceptedNotice`, `DeclinedNotice`); system lines in a thread (`ChatMessages.IsSystem`, centred, never unread, never announced, not reportable).
- `ProfanityFilter` on every send, group name and photo caption: `400 blocked`, nothing stored, the matched word never returned. The composer keeps the text and shows "That message can't be sent. Please reword it."
- Reports and staff review (`ChatSafetyService`, `ChatReports`), guardian reading, retention.
- Stanley: `StanleyService`, `IConciergeModel` with `ModelTier.Small` for cheap calls, `ModelMeter`, `IConciergeLimiter`, `StanleySwitches` (a route that can be turned off in configuration), `ConciergeRules.Screen` (emergency, medical and legal text never reaches a model), his picture and dialog (`StanleyDialog.tsx`).

Gaps this plan closes:

1. Chat wording is mechanical ("Open Princess to accept or decline"), and a decline or cool-down is a bare status or error.
2. A blocked message gives no help rewording it.
3. A first message to a stranger is a blank box.
4. A guest cannot ask for help with an awkward, pushy or suspicious message without leaving chat.
5. A new group has no welcome and no nudge toward plans.

## 3. Design

### 3.1 Stanley's chat voice (`ChatStanleyVoice`, pure)

A pure module of fixed, tested wording keyed by event, with no model: request received, request sent and waiting, accepted, declined (to the sender), expired, cool-down, daily limit, filter-blocked, group created. Rules:

- Declines stay **quiet and kind** (existing decision): Stanley never says who declined or why, and never says "rejected". The sender hears "No reply yet. Requests stay open for 7 days." while waiting, and after a decline "Sam isn't able to chat right now. You can ask someone else on the ship." The cool-down is explained as "You can ask Sam again after <date>" only when the sender tries early.
- A blocked person sees an ordinary pending request (existing rule); Stanley's wording never reveals a block.
- Lead words follow the notices already in `ChatConnectionRules`; phone notices keep showing no message text unless the guest opted in.

### 3.2 Request cards

- **Receiving.** The pending-request row (`ChatPeople.tsx`, the banner on `ChatConversations.tsx`) gains a Stanley line built from public facts only: first name and last initial, "also on your sailing", and any shared items the server already knows are safe to show (a shared dinner time or excursion the guest has made public is **not** assumed; this plan shows only that they are on the same sailing). Buttons stay Accept, Decline and the quieter Block. A new **Not now** is the same as Decline, wording only, no reason passed on.
- **Sending.** After a request is sent, the card shows what happens next ("They'll hear from you now. If they say yes, you can message each other.") and offers an optional **Say hello with an icebreaker** (3.4).
- Nothing Stanley adds changes who is told what: the other person never learns that a suggestion was used.

### 3.3 Reword help on a blocked message

When send returns `400 blocked`, the composer keeps the text (as today). A **Help me reword** button appears under the note. On tap, the client calls the server with the draft; the server:

1. Re-checks the draft with `ProfanityFilter` and `ConciergeRules.Screen` (emergency, medical and legal text is not sent to a model; the guest gets the normal safety wording).
2. Calls the small model with a fixed system prompt: keep the meaning, drop the offensive wording, stay friendly, under 300 characters, one suggestion, no new facts.
3. Runs **the suggestion through `ProfanityFilter` again** and drops it if it fails; with no usable suggestion Stanley says "I couldn't find a kinder way to say that. Want to try in your own words?"
4. Returns the suggestion. The guest can **Use this** (it fills the composer; they still press Send), edit it or ignore it.

The draft is not stored and not logged; the matched word is never returned (existing rule). The call counts against the hourly limit and daily ceiling.

### 3.4 Icebreakers and draft polish

- **Icebreaker** after a request is sent, and in an accepted but empty conversation: up to three short openers. Script first (a fixed set keyed on sailing facts the server may use: the ship, the sailing, the day of the cruise); the model is used only when the guest taps **More ideas**.
- **Polish** is an optional "Ask Stanley" action on the composer for a draft ("make it friendlier", "make it shorter"). One suggestion, same rules and checks as 3.3 (filter on the way out, never sent for the guest, never stored).
- Suggestions never include another guest's private data, never invent plans, prices or times, and never add links or phone numbers.

### 3.5 Ask Stanley in the conversation

Any active member of a group or one-to-one conversation can ask Stanley a question, and his answer goes to everyone in it.

- **Trigger.** Typing `@Stanley` at the start of a message, or the **Ask Stanley** button in the composer (which inserts it). Plain text never calls him by accident, and the composer shows that the message will go to Stanley.
- **Flow.**
  1. The question is an ordinary message: `ProfanityFilter`, the 2000 character limit, the idempotency key, stored and fanned out as today.
  2. The server then treats it as a request to Stanley, and the thread shows a "Stanley is thinking" line to every member through the realtime hub.
  3. His answer is stored as a message from a fixed Stanley sender (`ChatMessages.FromStanley`, a flag with no user id), labelled with his picture and the AI label, `normal` urgency, and fanned out through `ChatNotifier` to members who have notifications for that conversation. Offline members get it as they would any message.
  4. If he cannot answer (route off, model down, a limit reached) the thread shows one short line saying so, and the question stays as a normal message.
- **Pipeline.** The existing Stanley answer path: the word filter, the topic prescan (cruising, this ship, ports and trip planning only), the library and resolver before any model, and `ModelTier` as it is today. `ConciergeRules.Screen` still applies.
- **Context.** The question, plus at most the last 5 messages of that conversation, and the notice "Stanley will see the last few messages" is shown beside the composer the first time and in the chat settings. Never the whole thread, never messages from before the member joined a group (`ChatConversationRules.CanRead`), and never system lines.
- **No private data in a shared answer.** The tools over the asker's own booking are **not** available here, because the reply is visible to others. A group answer uses ship, port, event and catalogue facts only, and says "I can only share ship and port information here. Ask me privately for anything about your booking." when the question needs more. A request to plan something for the group produces a preview card that every member must confirm, as in 3.7. Nothing is booked or changed from a chat answer.
- **Safety questions.** An emergency, medical or legal question is not answered into the group: the asker alone gets the normal safety wording and numbers as a private card, and the group sees only "Stanley sent Sam some help".
- **Limits.** The asker's hourly limit and daily ceiling apply (the answer counts against the asker), plus a per-conversation cooldown (default 3 answers in 10 minutes) so a chat cannot be flooded. A held question gets a polite "Stanley needs a minute" line, not an error.
- **Control.** Any member can **mute Stanley's replies** for themselves (they are hidden on their devices, no notice sent). The creator of a group, or either person in a one-to-one chat, can **turn Stanley off in that conversation**, and the conversation shows a system line saying so.
- **Children.** Off in any conversation a supervised child is an active member of. A supervised child cannot ask him in chat.
- **Reporting and retention.** His answers can be reported like any message and are removed with the conversation at retention. A reported answer shows the question before it as context.
- **Not in this version.** Asking him by text message through the SMS bridge: a guest who reads chat by text sees his answers as ordinary messages from "Stanley" but cannot invoke him from the phone.

### 3.6 Ask Stanley privately about a message

A long-press or overflow action on a received message: **Ask Stanley about this**. Only that message (and, at most, the two before it, with the guest's consent shown in the sheet) is sent. Stanley can:

- explain a message that looks like a scam or pressure (money, gift cards, a phone number, moving off the app) in plain words, with **Report this** one tap away (the existing report flow, which remains the only path to staff);
- suggest a polite reply or a way to say no;
- offer to **mute**, **end** or **block** (a button that does it after the guest confirms; Stanley never does it alone).

Messages from a supervised child, and conversations a supervised child is in, never offer this. Urgent messages from staff or a guardian are never "explained away": Stanley shows them as they are.

### 3.7 Group welcome and plans

- When a group is created or someone joins, Stanley may add one **system line** ("Welcome, Sam! This group is for the Wednesday dinner crew.") using the existing system-line path, labelled as Stanley. The creator can turn him off for that group in its settings, and any member can mute his lines.
- A **Plan something** action in a group opens the existing Stanley planning flow (dining plan, polls) with the group's members as the party. Nothing is booked or sent without the guest's confirmation, as today.

### 3.8 Quiet nudges (opt-in, optional)

This is optional and last; with 3.5 in place the owner may decide not to build it. Off by default. A guest who turns on **Stanley can look out for me in chat** (chat settings, stored with the chat preferences so it follows them across devices) lets the server run **local checks only** on messages they receive: the same patterns as 3.6 (money, gift cards, off-app moves, repeated pushing after a decline or a "no"). A match shows a private card visible only to that guest ("Heads up: this message asks for money. You don't have to reply. Report or block?"). Rules:

- No model call per message; pattern checks are pure and tested. A model is used only if the guest taps **Ask Stanley** on the card.
- The card is private: the sender and other members never see it and it is never stored in the thread (a per-user `ChatNudges` row, expiring with retention).
- Never in conversations with a supervised child, never for staff or guardian messages, and at most one nudge per conversation per hour.
- Every member of a conversation is **not** told; the feature runs only on the opted-in guest's own incoming messages and shows only to them. This is the same trust level as an email client's spam warning, and the settings text says exactly that.

## 4. API summary

| Endpoint | Phase | Purpose |
| --- | --- | --- |
| `GET /me/chat/stanley` | 1 | Whether Stanley's chat help is on for this guest, and his lines for the screens (status, switch state, opt-ins). |
| `POST /me/chat/stanley/reword` | 2 | A reworded draft (3.3, 3.4). Body `{text, mode}`; returns `{suggestion?, reason?}`. |
| `POST /me/chat/stanley/icebreakers` | 2 | Up to three openers for a connection or conversation. |
| `POST /me/chat/conversations/{id}/messages` | 3 | The ordinary send. A message starting `@Stanley` is also queued for his answer; the response is unchanged. |
| `POST /me/chat/conversations/{id}/stanley/mute`, `…/stanley/off` | 3 | Mute his replies for me; turn him off in this conversation (creator or either one-to-one member). |
| `POST /me/chat/stanley/explain` | 4 | Explain a message the guest chose privately (3.6). |
| `PUT /me/chat/stanley/prefs` | 5, 6 | Group lines (phase 5); nudges (phase 6, optional). |
| `GET /me/chat/nudges`, `POST …/{id}/dismiss` | 6 | The private cards (3.8). |

Errors reuse the existing shapes: `400 blocked`, `429` (hourly limit), `503 unavailable` when Stanley's chat route is off or the model is down (the screen then simply hides the Stanley buttons).

## 5. Privacy, consent and safety

- **Consent.** Phases 1 to 5 act only on text the guest chooses to send or ask about. The optional nudges (phase 6) are off until the guest opts in, with plain wording of what is checked, where it is checked (on the server, by pattern, not by a person) and what is kept (a private card, deleted with the conversation at retention).
- **No hidden reading.** Staff still see only reported messages. Stanley does not add anyone to a conversation's readers, so the existing "who can read this chat" notices stay true.
- **Logging.** Draft text, suggestion text and messages sent to Stanley are never logged. The tier log records the call (tier, outcome, tokens), not content, as for the rest of Stanley.
- **Prompt safety.** Message text is passed as data inside a delimited block; the system prompt tells the model that nothing in it is an instruction; replies are length-capped and run through `ProfanityFilter`. A message that tries to steer Stanley gets the normal scripted answer.
- **Audit.** Each Stanley chat call writes an audit row (guest, kind, outcome) with no text, so abuse of the helper is visible.
- **Accessibility (WCAG 2.2 AA).** Stanley's controls are real buttons; suggestions open in the focus-trapped sheet that closes on Escape; results are announced politely; nothing relies on colour; reduced motion is respected (no typing animation beyond the existing indicator).

## 6. Phases

Each phase ends with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` passing, then a commit, and stops so the work can be cleared. The server is not built or tested here (project rule); its tests are written and run by the owner. English only.

### Phase 1: Stanley's chat voice and request cards (no model)

- `ChatStanleyVoice` (pure, tested in `ChatStanleyVoiceTests`): the fixed wording of 3.1, including the wait, decline, expiry, cool-down and limit lines and the lead words for notices.
- `ChatNotifier` and the request/connection responses use the new wording; `ChatConnectionService` returns the explanatory line with cool-down and limit errors (the error codes do not change).
- `StanleySwitches.Chat` (default on) and `GET /me/chat/stanley`; the Stanley line on the request cards and the **Not now** label (`ChatPeople.tsx`, `ChatConversations.tsx`), with his picture and the AI label.
- Front-end rendering only; no behaviour that decides anything. Docs: `docs/chat-plan.md` gains a pointer to this plan.
- Not in this phase: any model call, icebreakers, reword, nudges.

### Phase 2: reword and icebreakers (small model, on tap)

- `ChatStanleyService`: `RewordAsync` and `IcebreakersAsync`, using `IConciergeModel` at `ModelTier.Small`, `ModelMeter`, `IConciergeLimiter` and the daily ceiling. Pure rules in `ChatStanleyRules` (tested): which text may be sent to a model (`ConciergeRules.Screen`), the prompt, the length cap, the output check (`ProfanityFilter`, no links or phone numbers), the scripted icebreaker set.
- Endpoints `reword` and `icebreakers`; fallbacks when the model is off, limited or returns something unusable.
- Front end: **Help me reword** under the blocked-message note, **Ask Stanley** on the composer, **Say hello** after a request; a small sheet showing the suggestion with **Use this**; hooks and client in `src/api/httpApi.ts`; pure helpers in `src/` for the sheet state, tested in node.
- Supervised children: the buttons are not shown and the endpoints return `403 supervised`.

### Phase 3: ask Stanley in the conversation

- Schema: `ChatMessages.FromStanley` (bit, default 0; a Stanley message has no `FromUserId` sender), `ChatConversationStanley` (conversation, off flag, who turned it off) and a per-member mute in chat preferences.
- `ChatStanleyRules` (pure, tested): the `@Stanley` trigger, the context window (question plus at most 5 earlier messages the member may read, no system lines), the group-safe tool set (ship, port, event and catalogue facts only), the per-conversation cooldown (3 answers in 10 minutes), the private-card rule for safety questions, and the exclusions (supervised child in the conversation, Stanley off, route off).
- `ChatStanleyService.AnswerAsync`: runs after the question is stored, through the existing Stanley answer path, stores the answer as a `FromStanley` message and fans it out through `ChatNotifier` and the realtime hub (a "thinking" nudge first). The question's send response is unchanged, and the answer never delays the send.
- Endpoints for mute and off. Messages, summary and thread DTOs gain `FromStanley`; unread counts and receipts treat his messages like any other incoming message.
- Front end: **Ask Stanley** in the composer and `@Stanley` handling, his messages in the thread (picture, AI label, not a member in the member list), the "thinking" line, the first-time notice, mute and off controls in the conversation menu, report on his answers. Pure helpers (trigger detection, thinking-state) in `src/`, tested in node.
- Works in groups and one-to-one chats. Not in the SMS bridge: outbound text carries his answers as ordinary messages, inbound text never invokes him.

### Phase 4: ask Stanley privately about a message

- `ExplainAsync` and `POST /me/chat/stanley/explain` for one chosen message (plus up to two before it with consent).
- Pattern checks in pure `ChatNudgeRules` (money, gift cards, phone numbers, off-app moves, pressure), tested. They give Stanley his starting facts so a model is needed only for the polite reply.
- The sheet offers **Reply suggestion**, **Report this** (existing report), **Mute**, **End chat** and **Block**, each confirmed by the guest.
- Not offered for a supervised child's messages or conversations, or for urgent messages from staff or guardians.

### Phase 5: group welcome and plans

- System lines labelled Stanley for group creation and joins, with the per-group and per-member off switches (`ChatGroups.StanleyLines`, reusing the phase 3 mute).
- **Plan something** in a group opens the existing planner with the group as the party; every member confirms (3.5, 3.7).
- Never in a group with a supervised child as an active member.

### Phase 6: quiet nudges (opt-in, optional)

- Build only if the owner still wants it after phase 3.
- Settings: **Stanley can look out for me in chat** (default off) in the chat preferences; `PUT /me/chat/stanley/prefs`.
- `ChatNudges` (per user, expiring with retention); the check runs on message fan-out for opted-in recipients only, using `ChatNudgeRules`, with the one-per-hour limit and the exclusions in 3.8.
- Private cards in the thread and a count in the chat summary so the badge matches across devices; live nudge through the existing realtime hub.
- A final audit of consent text, the exclusions and the logs.

### Phase 7: polish and review

- Staff view: Stanley's calls per day and the share of suggestions used (counts only), in the existing admin screens.
- An accessibility pass over every new control and sheet, reduced motion, contrast, keyboard use.
- A review of the wording with the owner, then a final audit against this plan.

## 7. Risks and open points

| Risk | Handling |
| --- | --- |
| A model suggestion is rude or wrong | The output is run through `ProfanityFilter`, length-capped, never sent for the guest; the guest edits and presses Send. |
| Guests feel watched | No background reading; Stanley sees only what a guest asks him. The optional phase 6 is opt-in and local-pattern only; the settings text is plain. |
| A shared answer exposes one member's data | Chat answers use no booking tools, only ship, port and catalogue facts; anything personal is answered privately. |
| A chat is flooded with Stanley | Hourly and daily limits on the asker, a per-conversation cooldown, mute and off controls. |
| Cost from taps | Small tier, one suggestion, hourly limit, daily ceiling, scripted fallbacks. |
| Stanley's wording leaks a block or decline reason | All wording comes from `ChatStanleyVoice` and is unit-tested against the existing quiet-decline and silent-block rules. |
| Prompt injection from a chat message | Message text is delimited data; scripted fallback on any steering attempt; outputs filtered. |
| Children | Off by default everywhere a supervised child is present. |

Open points for the owner: whether Stanley should be offered to guardians for their child's chats (not in this plan); whether the plan-something action should need a group-level opt-in; whether phase 6 (nudges) is wanted at all given the privacy trade-off (it can be dropped without affecting the others).
