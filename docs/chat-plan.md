# Chat: connections, conversations and notifications

Plan for person-to-person and group chat between guests. Written 2026-11-09. Phase 1 is built with this plan; later phases are built only when asked.

## 1. What the guest gets

- Search for another guest by name, ask them to connect, and be told the moment they accept or decline.
- Once connected, each person appears as a chat target on the other's device.
- A guest can chat with **one person** or with **a defined group**. **Each conversation has its own history**, and only the people in it can ever read it.
- Either side can stop chatting at any time (end a direct chat, or leave a group).
- A guest hears about connection requests, answers and unread messages: live when the app is open, by phone push when it is not, and by the app itself when they next open it after being offline.

## 2. Decisions (from the owner)

| Question | Decision |
| --- | --- |
| Who can be invited | Search by name, as Princess does. Scoped to guests on the same sailing (see 4.2). |
| Supervised (child) accounts | A guardian (the booker) approves both sending and accepting, and can read the child's conversations. Every other member is told that. |
| Moderation | The same `ProfanityFilter` applies to chat. A message that fails it is **not sent** and the sender is told so. Reporting and blocking stay; reports go to staff. |
| Message text in push | **Opt-in** per guest. The default push says only who it is from. |
| Real time | **SignalR**. |
| Quality bar | Chat is the most-used feature on board, so the experience is designed first (section 4.8) and every chat screen is checked against it. |
| Guests ashore | **SMS bridge**: a guest who is off the ship can chat by text with people on the ship (section 4.9). Opt-in, verified numbers only. |
| One person or a group | Both. Conversations are separate and private to their members. |

## 3. What exists today, and what changes

Already built (MSG-01, MSG-05): `ChatGroups`, `ChatGroupMembers`, `ChatMessages`, `ChatReads`, `ChatBlocks`, `ChatReports`, `ChatService` and `/me/chat/*`, and the screen `src/ui/onboard/ChatScreen.tsx`. Web Push (`PushService`, `IPushSender`, `PushSubscriptions`, `PushDeliveries`) is built but runs only when the app asks (`/me/push/dispatch`); nothing pushes on an event. There is no SignalR.

Problems with what exists, which this plan fixes:

1. **One pooled feed.** `ListMessagesAsync` returns the messages of every group the person is in, mixed together, and `AddMessageAsync` posts to the person's first group. That cannot give separate histories. It is replaced by per-conversation reads and writes (phase 4). Until then, new direct and group conversations carry `Kind <> 'party'` and the old queries are limited to `Kind = 'party'`, so a private chat can never leak into "My group".
2. **No profanity filter on chat.** `ChatService` only applies `ServiceRules.ChildSafeProblem`. Phase 4 adds `ProfanityFilter`.
3. **Groups are set up by seed scripts or staff.** Guests cannot make one. Phase 5 adds it.
4. **No notification on an event.** Phase 1 adds `ChatNotifier`; phase 3 adds SignalR.

## 4. Design

### 4.1 Model

- A **conversation** is a `ChatGroups` row with a new `Kind`: `party` (the existing booking group), `direct` (exactly two people) or `group` (guest-made, 3 or more). Everything below that says "conversation" means a `ChatGroups` row.
- **Membership** is `ChatGroupMembers`. New columns: `Status` (`active`, `left`, `removed`), `JoinedAt`, `LeftAt`, `Muted`. A person reads a message only if they were a member when it was sent: `message.At >= JoinedAt` and (`LeftAt` is null or `message.At <= LeftAt`). A person added later never sees earlier history.
- **Connections** are `ChatConnections`, one row per request between two people. Accepting a direct request creates the `direct` conversation. A group invitation (phase 5) is a per-invitee row in the same table with a `GroupId`.
- **Access rule, everywhere:** every read and write goes through a membership check on the conversation id. There is no query that spans conversations except the summary counts, which return numbers and ids only.
- Ending a direct chat keeps the history readable by both people but closes sending. Leaving a group removes the leaver's access to later messages and leaves their earlier messages visible to the remaining members. A system line ("Sam left") is added.
- A deleted or hidden account leaves its messages in place for the remaining members (`FromUserId` has no cascade, as today).

### 4.2 Finding people

`GET /me/chat/people?query=` returns guests who are on a **confirmed booking for the same sailing** as the caller, matched on first or last name, at least 3 characters, at most 10 results. A result is the person's public id, first name and last initial, and their relationship to the caller (`none`, `requested`, `connected`, `blocked`). No email, phone, cabin or booking number is returned. Excluded: the caller, anyone who has blocked the caller, anyone the caller has blocked, and supervised children unless they share a booking with the caller. Rate-limited per signed-in person. A guest can turn off being found (phase 2 setting, stored with chat preferences).

### 4.3 Connection requests (`ChatConnections`)

Statuses: `awaitingGuardian`, `pending`, `accepted`, `declined`, `cancelled`, `expired`, `ended`.

```
adult x  -> adult y         pending -> accepted | declined | cancelled | expired -> (accepted) ended
child x  -> adult y         awaitingGuardian(x's guardian) -> pending -> ...
adult x  -> child y         awaitingGuardian(y's guardian); the guardian's approval is the acceptance
child x  -> child y         awaitingGuardian(x's guardian) -> awaitingGuardian(y's guardian) -> accepted
```

Rules (in `ChatConnectionRules`, pure and tested):

- No request to yourself, to someone who blocked you (the sender sees an ordinary pending request; nothing tells them), or to someone you already have an open or accepted connection with.
- If y already asked x, x's request counts as accepting y's.
- At most 10 open outgoing requests and 20 requests a day. After a decline, the same sender cannot ask the same person again for 7 days.
- A request expires after 7 days.
- The respondent can decline, accept, or **block** (which also declines). Declining says only "declined"; no reason is passed on.
- Either side can end an accepted connection at any time. The other side sees "no longer available", never who ended it.

### 4.4 Notifying people

The connection row is the durable inbox: a request waiting for y is a `pending` row; an answer waiting for x is a responded row x has not yet seen (`RequesterSeenAt`). `GET /me/chat/summary` returns the counts, and the client always loads it on launch, on `visibilitychange` and on reconnect. Nothing depends on a notification arriving.

Delivery, in order:

| Phase | Mechanism |
| --- | --- |
| 1 | `ChatNotifier` sends a Web Push at once when the event happens (request, answer, guardian approval needed). It respects the person's quiet hours and calm mode, ignores the daily notice budget, writes the send to the push log, and sends nothing if the person has no subscribed phone. |
| 3 | A SignalR hub (`/hubs/chat`, JWT) sends the same event to `user:{publicId}` for open apps. Push is sent only if no live connection acknowledged within about 8 seconds, so an open app is not buzzed. Badges update live. |
| 4 | Message events use the same path. Group messages collapse by conversation (push `tag`). A conversation can be muted. |

Push text carries no message text unless the guest opts in. The title is "New message from Sam" (first name only); the body is "Open Princess to read it." With the opt-in on, the body is the first 80 characters of a message that passed the filter. A push opens the conversation (`path`).

### 4.5 Sending a message (phase 4)

`POST /me/chat/conversations/{id}/messages {text, clientId}`:

1. Caller must be an `active` member and the conversation not closed.
2. Trim, 1 to 2000 characters, plus the existing age rule for under-18s (no phone numbers or links).
3. **`ProfanityFilter.IsBlocked(text)`** fails the send with `400 blocked`; nothing is stored and the sender is told (the screen says "That message can't be sent. Please reword it."). The matched word is never returned or logged, and the text is not logged.
4. `clientId` makes a retry safe (a repeat returns the stored message), so a message queued offline never doubles.
5. Stored, then fanned out to every other active member through `ChatNotifier`. Members who blocked the sender receive nothing.

Read state is per member per conversation (`ChatReads` today is per message; phase 4 adds `LastReadMessageId` on the member row so unread counts are cheap and consistent across devices).

### 4.6 Guardians

A supervised child's guardian is their booker. The guardian approves new connections (4.3), can read the child's conversations through `GET /me/chat/children/{childId}/conversations/{id}/messages` (read-only, audited, never sends as the child), and gets a push when a request needing approval arrives. When a conversation includes a supervised child, it shows "A parent or guardian can read this chat" to every member, and a member who does not want that can leave. The child cannot remove the guardian's access.

### 4.7 Privacy and retention

- Only members read a conversation. Staff see only reported messages, and only the reported message with a few lines around it (phase 6).
- Reports reuse `ChatReports` and the four reasons in `ServiceRules.ReportReasons`.
- Retention follows MSG-05: messages are kept 30 days after the cruise ends, and the screen says so. Phase 6 enforces it (the gap analysis notes it is not enforced today).
- Search is limited to the same sailing, shows a first name and last initial only, and can be switched off.

### 4.8 Experience design

Chat is opened many times a day, often one-handed, often on a slow ship connection. The rules below are acceptance criteria for phases 2, 4 and 5.

**Structure**
- Chat opens on the **conversation list**, newest activity first: avatar or initials, name, last line, time, unread count. Direct and group chats sit in one list. "My group" (the booking chat) is simply the first conversation.
- Pending requests are a banner at the top of the list ("2 people want to chat"), not a separate hidden screen. One tap opens them; each has Accept, Decline and a quieter Block.
- **New chat** is one button: search by name, tap a person, send the request. Already-connected people open their conversation instead. Starting a group comes from the same button (phase 5).
- Inside a conversation: the composer is at the bottom within thumb reach, the keyboard never covers it, Send is a large target, the header shows the name and who is in it, and back always returns to the list at the same scroll position.

**Feel**
- A message appears in the thread **at once** when sent, marked "Sending", then "Sent", then "Delivered", then (if both have receipts on) "Read". With no signal it says "Waiting for signal" and sends by itself later. Never a spinner that blocks typing.
- A blocked message (filter) stays in the composer with a plain note under it ("That message can't be sent. Please reword it."), so the guest does not lose their text.
- Incoming messages arrive without moving what the guest is reading; if they have scrolled up, a "New messages" chip appears instead of jumping.
- Unread counts are the same on every device and clear when the conversation is read. The Chat tab and the app icon show the total.
- Every state is worded and easy to tell apart without colour: waiting for a reply to a request, declined, ended ("no longer available"), someone left, a guardian can read this chat, a person who is ashore.
- Declines and endings are quiet and kind. No one is told who ended a chat or why.

**Asking permission at the right moment**
- Notifications are asked for the first time a guest sends or accepts a request ("Want to hear when they reply?"), not at launch. The answer, and how to change it, is on the chat settings screen.

**Slow and offline ship connections**
- Small payloads and one request to open the list. The thread loads the latest 30 messages and fetches older ones on scroll. Lists and the open thread are cached so they show instantly, then refresh. Writes go through the outbox with idempotent retry.

**Accessibility (WCAG 2.2 AA)**
- Full keyboard use; focus-trapped dialogs that close on Escape; target size at least 44 px; no focus stolen by an incoming message; incoming messages and answers announced politely in a live region; text size and reduced-motion settings respected; contrast checked in both themes.

**Check before each phase is called done:** a guest can start a chat, send, and see a reply in three taps or fewer; every state above has a name; nothing in the screen depends on colour alone.

### 4.9 SMS bridge for guests ashore

A guest in port often has no data but still has a phone number. Text lets them stay in the conversation.

**When it applies.** A conversation message goes to a member by text only when **all** hold: the member has turned on "Let people on the ship reach me by text when I'm ashore"; their number is verified (`PhoneCheckService`); they are currently away from the ship (the Away From Ship flow, `AwayRules`) or, if they chose it, have no live app connection or push for a few minutes; and they are an adult. Supervised children never get SMS chat.

**What the guest ashore sees.** "Sam: are you coming for lunch?" with a short code when they have more than one conversation ("[2] Sam: ..."). They reply by text:
- A plain reply goes to the conversation they were last texted from.
- "2 on my way" goes to conversation 2. "LIST" returns their numbered conversations. "STOP" turns the bridge off and confirms. "HELP" explains. "BACK" says they are back on board.
- On return to the ship (or when the Away flow ends) the bridge stops and a note says "Back on board: chat continues in the app."

**What the people on the ship see.** The conversation is unchanged. A message that arrived by text is labelled "by text", and the person ashore shows as "Ashore, replies by text", so replies are not expected to be instant.

**Rules**
- Inbound texts go through the same checks as app messages: membership, the `ProfanityFilter` (a blocked message gets a short text back), the 2000 character limit, and the idempotency key (the carrier message id).
- Text is not private: a text leaves the app. So the bridge is opt-in, the first message explains that, and the app says "Texts pass through your phone company".
- **Groups** are bridged as a digest with a cap (for example at most 5 texts an hour per conversation, then "N more messages, open the app"), and mutes are respected.
- **Cost and abuse**: a per-guest daily cap on outbound texts (default 30), a per-conversation cap, rate limits on inbound, and a global switch. The sender is a configured number or short code; the provider is behind `ISmsSender` and the inbound webhook is the existing signed `/public/sms/inbound`, so a real provider changes configuration only.
- **Message text in SMS is never logged**; the log keeps the conversation id, member and outcome.
- A person's number is never shown to the other members. Replies are matched by the verified number on the server.
- If a number is shared, reassigned or fails verification, the bridge stops until it is verified again.

## 5. API summary

| Route | Phase | Purpose |
| --- | --- | --- |
| `GET /me/chat/people?query=` | 1 | Search by name. |
| `GET /me/chat/connections` | 1 | My chat targets, requests waiting for me, requests I sent, and children's requests waiting for my approval. |
| `POST /me/chat/requests {toUserId}` | 1 | Ask to connect. |
| `POST /me/chat/requests/{id}/respond {accept, block?}` | 1 | Accept or decline (a guardian does this for a child). |
| `POST /me/chat/requests/{id}/cancel` | 1 | Withdraw my request. |
| `POST /me/chat/connections/{id}/end` | 1 | Stop chatting with this person. |
| `POST /me/chat/connections/seen` | 1 | The sender has seen the answers. |
| `GET/PUT /me/chat/settings` | 2 | Findable by name; notice text preview. |
| `GET /me/chat/summary` | 1 | Counts for badges: requests waiting, answers unseen, later unread messages. |
| `/hubs/chat` (SignalR) | 3 | Live events. |
| `GET /me/chat/conversations`, `GET/POST /me/chat/conversations/{id}/messages`, `POST …/read`, `PUT …/mute` | 4 | Per-conversation chat. |
| `POST /me/chat/groups`, `…/{id}/invite`, `…/{id}/leave` | 5 | Groups. |
| `GET/PUT /me/chat/sms` | 6 | The text bridge: on or off, and whether it applies. |
| `POST /public/sms/inbound` (existing) | 6 | Replies by text are routed into conversations. |

## 6. Phases

Each phase ends with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` passing, then a commit, and stops so the work can be cleared. The server is not built or tested here (project rule); its tests are written and run by the owner.

### Phase 1: connection requests (backend) — built

- Schema: `ChatGroups.Kind`, `ChatGroupMembers` status columns, `ChatConnections` (one open pair at a time), and `00-drop-all.sql`.
- The existing pooled chat queries are limited to `Kind = 'party'`.
- `UserPrefs.ChatFindable` (whether others can find the guest by name), read by the search.
- `ChatConnectionRules` (names, limits, transitions, routing for guardians, notice text) with unit tests.
- `IChatConnectionStore` and its Dapper implementation; `ChatConnectionService`; `ChatNotifier` and `PushService.NotifyChatAsync`.
- Endpoints in section 5 marked phase 1, with summaries, and a rate limit on search.
- `docs/backend-data-model.md` rows.
- Not in this phase: any front-end screen, SignalR, messages.

### Phase 2: connection screens (front end) — built

Designed to section 4.8: the conversation list is the home of Chat, requests are a banner on it, and "New chat" is a single button.

- `src/api` types and `httpApi.ts` calls. The `chat` push kind added to the front end's accepted kinds.
- A "People" area in Chat: search, request, requests waiting (accept, decline, block), requests sent (cancel), my chat targets (end), the guardian approvals list.
- Badge on the Chat tab from `/me/chat/summary`, refreshed on launch, focus and after an action. Offline copy ("Connect when you have signal").
- Setting: let others find me by name. Setting: show message text in notifications (stored now, used in phase 4). Added `GET/PUT /me/chat/settings` and `UserPrefs.ChatShowPreview` for these (phase 1 had only the column for finding).
- Built as a "People" chip in Chat beside My group and Guest Services, with a "N people want to chat" banner on the other two. The tab badge is a count (`tabs__count`), not the dot, and the Chat tab reads `/me/chat/summary` through `useChatSummary`.
- Accessibility: focus-trapped dialogs that close on Escape, live region for answers, reduced motion, contrast.

### Phase 3: SignalR

- `ChatHub` at `/hubs/chat`, JWT through `access_token`, group `user:{publicId}`; `IRealtimeHub` interface and a real implementation; acknowledgements; push only when no live acknowledgement.
- Client connection with reconnect and fallback, and live badges. Events are "something changed" nudges; the client refetches over REST, so a lost event costs nothing.
- Backplane (Redis or Azure SignalR) documented as configuration for more than one server.

### Phase 4: conversations and messages

- Per-conversation list, history, send, read, unread counts, mute. Retire the pooled `/me/chat/messages` for party chat (the party group becomes one conversation among others).
- `ProfanityFilter` on send, with the sender told; idempotent `clientId`; offline outbox with "Sending, Sent, Waiting for signal".
- Message push with the opt-in preview and per-conversation collapse.
- Tests prove that a member of conversation A cannot read, count, search or be notified about conversation B.

### Phase 5: groups

- A guest makes a group from people they are connected with; each invitee accepts or declines; leave; remove (creator); rename. A group's history starts at each member's join time.
- Group size limit (for example 12). Guardian rules apply to every child in the group.

### Phase 6: SMS bridge

- Opt-in setting (verified number, away-from-ship or no-connection trigger), outbound routing with short codes, inbound routing with `LIST`, `STOP`, `HELP`, `BACK`, caps and rate limits, the "by text" and "ashore" labels, and the matching screen text.
- Reuses `ISmsSender`, `PhoneCheckService`, `AwayRules` and the signed inbound webhook. Simulated provider by default.

### Phase 7: guardians, moderation and retention

- Guardian read-only view with audit; the "a guardian can read this chat" notice.
- Staff review of reports; blocking from inside a conversation; retention job at 30 days after the cruise; an access log for reads of someone else's conversation.

## 7. Open points to revisit

- Whether "discoverable" should default to on (as Princess does) or off.
- A hard group size limit.
- Whether "ashore" should also be detectable without the Away flow (for example no live connection for 30 minutes).
- Whether photos in conversations (supported today in party chat) carry over to direct chats.
