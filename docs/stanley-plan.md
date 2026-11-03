# Stanley: the cruise chat helper

Status: **plan agreed (2026-11-03). S1 (word filter), S2 (endpoint) and S3 (front end) and S4 (polish) are built.**

Stanley is a friendly guide the guest chats with in a dialog opened from his logo button, above Help in the left nav (and in the top bar on phones). He answers questions about cruising, this ship and its ports. He refuses rude messages and anything unrelated to cruising, politely.

## What already exists and is reused

- The server's AI concierge (`Services/Concierge.cs`, `Domain/ConciergeRules.cs`): the model client (`IConciergeModel`), the hourly per-person limit (`IConciergeLimiter`), history and message size caps, and the rule that emergency, medical, legal and "talk to a person" messages never reach a model (`ConciergeRules.Screen`). Stanley keeps that safety rule.
- The front end's `Dialog` (focus trap, closes on Escape), the person-to-person chat for layout ideas, and the nav button pattern used by the logo.

Stanley is a separate endpoint (`/me/stanley`), not a mode of the concierge, because his rules differ: no tools, no account actions, a topic gate and a word filter.

## The pipeline (all on the server; the server is the only authority)

1. **Word filter.** Any listed word anywhere in the message blocks it. No model is called. Stanley replies that he does not appreciate that kind of question.
2. **Safety screen.** The existing emergency, medical, legal and "talk to a person" check. These get a handoff answer, never a model.
3. **Topic prescan.** A small, cheap model call that answers only allowed or not allowed: is the message about cruising, this ship, ports, travel to and from the cruise, or cruise planning? It also sees the last two turns so follow-ups such as "what about the second one?" are allowed.
4. **Answer.** The main model answers, with a system prompt that also limits it to cruising (the prescan alone can be fooled by prompt injection).
5. **History.** The most recent 10 round trips (20 messages) are sent. Blocked and rejected messages are never added to the context.

The server returns a result `kind` (`blocked`, `offtopic`, `handoff`, `answer`, `unavailable`); the front end shows Stanley's wording from its own English and Spanish strings, the way concierge handoffs work today.

## The word filter (S1)

- Lives in `server/Princess.Api/Domain/ProfanityFilter.cs`, pure logic, no framework.
- **English and Spanish** (the app has both).
- Matches **whole words**, so "assist", "cockpit", "Essex", "class" are fine. A small set of strong stems (for example the f-word) match inside longer words, with an allow-list for innocent ones ("Scunthorpe", "shitake").
- Normalises before matching: lower case, accents removed (but not the Spanish ñ), look-alike digits and symbols (`$h1t`), repeated letters (`fuuuck`), spaced or dotted letters (`f u c k`, `f.u.c.k`) and star masks (`f*ck`).
- Also matches a few phrases ("shut up", "kill yourself") and abbreviations (`wtf`, `stfu`).
- Deliberately **not** listed because they are legitimate in cruising: "hell" (Hell, Grand Cayman is a real excursion stop), "dyke" (Dutch sea walls), "balls" (masquerade balls), "cono", "concha" and similar. Medical and anatomical words are not listed. The list is data, so it can be tuned.
- The matched term is never shown to the guest and the message text is never logged.

## Phases (commit and stop after each, per `CLAUDE.md`)

| Phase | Scope | Output |
|---|---|---|
| **S1** | **Word filter.** Dictionary, normaliser and unit tests on the server. | `ProfanityFilter.cs` plus `ProfanityFilterTests.cs` |
| **S2** | **Stanley endpoint.** `/me/stanley`: filter, safety screen, prescan, answer, 10-round-trip trim, hourly limit, scripted reply when no model key is set. | endpoint, rules, tests, API docs |
| **S3** | **Front end.** Stanley button above Help (left nav) and in the top bar on phones; chat dialog with his logo, title and subtext; typing indicator; English and Spanish strings; API client; an optimised copy of `stanley.png`. | working chat |
| **S4** | **Polish.** Streamed replies, a cooldown after repeated blocked messages, docs and a final audit. | final check |

## Decisions (defaults, change if wrong)

1. Stanley answers general cruise questions, including this ship and its ports, and (from S5) questions about the guest's own trip using PII-free facts. He never sees names, documents, contact or payment data, or the booking number. Account actions stay with the existing concierge.
2. The conversation lives in memory only: closing the dialog keeps the session, a refresh clears it.
3. Replies appear all at once with a typing indicator in S3; real streaming is S4.
4. The word list is English and Spanish.
5. `stanley.png` is 1.4 MB; the button and dialog use a small optimised copy (the app already precaches about 4.3 MB).

## Testing note

`CLAUDE.md` says never to run a full `dotnet test`. Server tests for S1 and S2 are written but not run here (no `dotnet` in this environment, so S2 has not even been compiled); the front end is verified with the npm checks. A targeted run, `dotnet test --filter ProfanityFilter`, can be run by hand.

## S2 as built

- `POST /me/stanley` (`Endpoints/StanleyEndpoints.cs`) calls `StanleyService` (`Services/Stanley.cs`); the pure rules are in `Domain/StanleyRules.cs`. Tests: `StanleyTests.cs`.
- Reply: `{ kind, text, handoff, source, fallback }` (see `docs/backend-data-model.md`). Only `answer` carries text.
- The model client is the concierge's `IConciergeModel`, called with no tools (the Anthropic client now omits an empty `tools` list). The prescan and the answer are two calls; the limiter counts one question.
- The hourly limit is **shared with the concierge** (the same 20 an hour per person), so no new table is needed. A separate budget would need a new `ConciergeUses`-style table; say if you want one.
- Blocked and handed-off messages are dropped from the context by the server as well as by the client, so a client that resends them cannot get them into a prompt. A message the prescan called off topic is not known to the server on the next turn, so **the S3 client should leave off-topic and blocked exchanges out of the history it sends**.
- With no model: a keyword gate (English and Spanish) stands in for the prescan, and a fixed scripted answer is returned.

## S3 as built

- `src/ai/stanley.ts` (pure, tested in `stanley.test.ts`): reply reading (`normalizeStanley`), the history sent (`historyToSend`: only clean round trips, latest 10, then the new message, so blocked, off-topic, handed-off and failed exchanges never go back to the server), the on-device safety screen (an emergency shows the numbers with no signal), and the in-memory thread (closing the dialog keeps it, a refresh clears it).
- `src/ui/ai/StanleyDialog.tsx`: the chat in the shared `Dialog` (focus trap, Escape), his picture, subtext, an AI label, example questions, a typing indicator (still under reduced motion) and the box. Stanley's wording for every non-answer kind is in the English and Spanish strings (`stanley.*`); handoffs reuse the concierge's `ai.handoff.*` wording.
- `Shell.tsx`: a Stanley button above Help in the left nav (from 1024px) and a round picture button in the top bar on phones. `runtime` has `sendStanley` (`POST /me/stanley`).
- `src/assets/stanley-small.png` is a 192-pixel copy (60 KB) of the 1.4 MB `stanley.png`; only the small one is imported, so only it is precached.
- Replies still appear all at once; streaming is S4.

## S4 as built

- **Cooldown** (`cooldownSeconds` in `src/ai/stanley.ts`, tested): after 3 blocked replies in a row the box pauses for 30 seconds, with a countdown message (`stanley.cooldown`). A good answer ends the run. It is derived from the in-memory thread, so closing the dialog does not skip it. It is a courtesy only; the server's word filter and hourly limit remain the authority.
- **Streamed look** (`revealSteps`, tested): an answer appears three words at a time; with reduced motion it appears at once. This is done on the device from the full reply. **True server streaming (SSE) was not built**: the server could not be compiled here (no `dotnet`), and a streaming endpoint would also have to run the word filter, prescan and limit before the first byte. It can replace `revealSteps` later with no change to the reply shape.
- **Audit**: the model key stays on the server; blocked, off-topic, handed-off and failed exchanges are never resent; the matched word is never shown or logged; the dialog uses the shared focus-trapped `Dialog`, status regions and reduced-motion handling. Server tests for S1 and S2 are still unrun by hand (`dotnet test --filter Stanley`).

## S5 as built: trip facts without personal data

- `StanleyTripLoader` (`Services/`) reads the signed-in guest's current or next confirmed trip and reduces it to a `StanleyTrip` record (`Domain/StanleyFacts.cs`): sailing dates, ship, cabin category, dinner arrangement, party size and **ages only**, dinners and tours booked (venue or tour name, day, time) and package names. The ports and times come from the fixed itinerary. There is no field for names, booking or cabin number, documents, contact or payment data, so they cannot reach a model or a reply.
- The server builds the facts for each question and appends them to the answer instructions (`StanleyRules.AnswerSystemFor`); the browser sends nothing extra, so a guest cannot alter them. The topic prescan never sees them.
- With no model, `StanleyFacts.Scripted` answers from the same facts (a port's arrival and all-aboard times and the tour booked that day, booked tours, dinners, packages, the sailing date or countdown, the stateroom), and falls back to the topic answers when the question is about something else or the guest has no trip.
- The answer rules no longer open with an introduction ("I am Stanley"). Tests: `StanleyTests.cs` (not run here; no `dotnet`).
