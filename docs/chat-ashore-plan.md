# Chat: tell people when I leave or return to the ship

Plan for an opt-in "tell them when I go ashore or come back" flag on each chat conversation. Written 2026-11-09. Built in a single phase (server and screen together), at the owner's request.

## 1. What the guest gets

- In a direct chat or a group chat, a switch: **Tell people here when I leave or return to the ship**. **Off by default**, and it only ever affects that one conversation.
- When the guest goes ashore or comes back, the people in that conversation who are allowed to be told (section 2) hear "Sam has left the ship" or "Sam is back on the ship".
- Nothing else is shared: no port position, no map, no time ashore beyond the moment of each notice.

## 2. Who is told

A member of the conversation receives the notice only if all hold:

1. The sender's flag is on for that conversation.
2. The recipient has an **accepted** connection with the sender (`ChatConnections.Status = 'accepted'`). In a group, a member who is not connected to the sender is skipped, so joining the same group never exposes someone's whereabouts. The sender is not told who was skipped.
3. Neither has blocked the other, and the recipient is an active member (not left or removed).
4. The recipient has not muted the conversation (a muted chat gets the line but no phone buzz, as for messages).

The flag belongs to the **sender's membership row**, so each person in a chat chooses for themselves; it is not a group setting anyone else can change.

## 3. Decisions to confirm

| Question | Proposed default |
| --- | --- |
| What the recipient sees | A system line in the conversation ("Sam left the ship", with the time) **plus** a normal-urgency notice that obeys do not disturb, quiet hours and calm mode. |
| What counts as leaving | Presence status `ashore` is "left"; `back` is "returned". `leaving` (heading out, not yet scanned) sends nothing. |
| Flapping | A repeat of the same status sends nothing; a change within 5 minutes of the last notice for that person is held and only the latest is sent. |
| Supervised (child) accounts | A supervised child cannot turn the flag on (`403 supervised`, as for the text bridge). A guardian can still be told by the existing flows. |
| Port days only | Presence is only recorded while the ship is in port, so notices happen only then. |
| Who can see the flag is on | The sender's thread header and the conversation info show "Tells this chat when you leave or return"; recipients see a quiet "Sam shares when they go ashore" line the first time. |

## 4. Design

### 4.1 Data

- `ChatGroupMembers.NotifyAway BIT NOT NULL DEFAULT 0` (the sender's choice for that conversation; direct chats are `ChatGroups` rows too, so one column covers both).
- System messages reuse the chat system-line mechanism already used for "Sam left". New kind `away` with `back` or `ashore` in its data, so the app words it in English from the kind, not from stored text.

### 4.2 Server

- `ChatAwayRules` (pure, unit tested): `Transition(previous, next)` returns `Left`, `Returned` or nothing; `Debounce`; notice words; `Recipients(senderMemberships, connections, blocks, members)` applying section 2.
- `ChatAwayService.OnPresenceAsync(user, status, atMs)`: loads the sender's conversations with `NotifyAway = 1`, filters recipients, writes the system line and calls `ChatNotifier`.
- **One hook for both writers of presence**: `GangwayService.RecordAsync` (the Medallion scan) and `PortRowService.ApplyAsync` (the guest tapping it by hand). The hook fires only for a `presence` row whose key is the actor's own and whose status changed.
- `PUT /me/chat/conversations/{id}/notify-away {on}`; the flag is returned on `ChatConversationDto` (`NotifyAway`, omitted when false). `403 supervised`, `404` for a non-member.
- `ChatNotifier.AwayAsync`: key `chat:away:{conversation}:{user}:{status}:{date}`, so a retry never doubles. Not urgent, not a bypass.
- Failures are logged and never fail the scan or the port-row write.

### 4.3 Front end (thin client)

- A switch in the conversation info (and the chat settings list of conversations), with the explanation from section 1, 44 px target, labelled for screen readers, announced when changed.
- The thread renders the `away` system line with an icon and text (not colour alone).
- Text in `en.ts` only.

## 5. Phases

Each phase ends with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` passing, then a commit, and stops. The server is not built or tested here; its tests are written for the owner to run.

### Phase 1: server

- Schema column, rows and fake store, `ChatAwayRules` and `ChatAwayRulesTests`, `ChatAwayService`, the hook in both presence writers, the endpoint and DTO field, `ChatNotifier.AwayAsync`, `docs/backend-data-model.md`.

### Phase 2: screen

- `src/api` types and `httpApi.ts`, the switch, the system line, strings, a pure helper and its test for wording and which conversations show the switch.

## 6. As built

- One phase, as asked. The server is not built or tested here (project rule); `ChatAwayRulesTests` is written for the owner to run.
- System lines are stored as text, like the existing "Sam left the group" lines, not as a kind. A line is written only when **every** other active member may be told (a system line is read by the whole chat); otherwise the allowed members get the notice alone.
- Flapping: a repeat of the same status tells no one (`ChatGroupMembers.AwayStatus`, claimed in one `UPDATE ... OUTPUT`, so a retried scan never doubles). A real change is always sent at once: there is no 5-minute hold, because holding needs a background job and a late "back on the ship" is worse than an extra line.
- A first "back" with nothing known before records the status and tells no one.
- Skipped: the one-time "Sam shares when they go ashore" hint for recipients (the system line already says it) and a separate list of conversations in settings; the switch is in the chat's Options.
