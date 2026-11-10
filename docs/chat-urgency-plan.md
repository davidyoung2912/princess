# Chat: message urgency and do not disturb

Plan for an urgency rating on chat messages and notifications. Written 2026-11-09. Phases are built one at a time, only when asked.

## 1. Decisions (from the owner, 2026-11-09)

| Question | Decision |
| --- | --- |
| Levels | Three: `normal` (default), `important`, `urgent`. No more; more levels make people argue about which to use. |
| Who may send `urgent` | **Staff** (administrators; the app has only the roles `guest` and `admin`, so staff means `admin`) and a **guardian** writing into a conversation that a supervised child they book is an active member of. Everyone else gets `403 urgency`. System notices (set by the server) may be urgent. |
| Who may send `important` | Any member, with a per-user rate limit (phase 4). |
| Do not disturb | Only `urgent` breaks through. `important` and `normal` obey it. |
| Colour | Never the only signal (WCAG 2.2 AA): icon plus text plus border. |
| Front end | A thin client. The server stores and validates the level and who may send it; the screen only renders it. |

## 2. Do not disturb: what exists

Do not disturb already exists, as two settings that the push path honours (`PushRules.Decide`):

- **Quiet hours** (`UserPrefs` JSON, `quiet: {on, from, to}`, on the notifications screen).
- **Calm mode** (a per-phone setting).

Chat notices go through the same `Decide`, so both already hold back chat pushes (`ChatNotifier` sends them with `Bypass = false`). A held notice is logged as `held` and the message is still waiting in the app. Gaps this plan closes:

1. Nothing can break through. Phase 1 makes an `urgent` message a `Bypass` notice (it also breaks through a muted conversation).
2. The in-app pop-up (`ChatToast`) is switched off by calm mode and by the per-device "Chat pop-ups" setting, with no exception for urgent (phase 3).
3. There is no one-tap "do not disturb for the next hour" (phase 4). Quiet hours are a daily schedule only. A one-tap control belongs on the Chat list header and in the Chat settings, stored with the notification prefs so it follows the guest across devices, and it ends by itself.

## 3. Presentation to the receiver

- **`normal`**: unchanged.
- **`important`**: an "Important" label with an icon and a stronger border; the unread badge is raised and the conversation sorts above normal unread ones; announced politely (`aria-live="polite"`). It obeys do not disturb.
- **`urgent`**:
  - The in-app notice is persistent (no auto-dismiss) and needs an explicit **Got it**. It ignores calm mode and the "Chat pop-ups" setting.
  - Announced assertively (`role="alert"`). Icon, text and a high-contrast treatment. Under `prefers-reduced-motion` there is no pulsing: a static style carries the weight.
  - The conversation is pinned to the top of the list until acknowledged.
  - Breaks through quiet hours, calm mode and a muted conversation; the phone notice reads "Urgent message from Sam R." and still shows no message text unless the guest opted in.
  - The sender sees "Seen by…" once it is acknowledged.
- **SMS bridge** (phase 6 of chat): `important` and `urgent` reach an offline guest by text; an unacknowledged `urgent` is retried once. `normal` follows the current rules. Messages that arrive by text, and photos, are always `normal`.

## 4. Phases

Each phase ends with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` passing, then a commit, and stops so the work can be cleared. The server is not built or tested here (project rule); its tests are written and run by the owner.

### Phase 1: urgency on the server — built

- Schema: `ChatMessages.Urgency` (`normal|important|urgent`, default `normal`, CHECK-constrained).
- `ChatUrgencyRules` (pure, tested in `ChatUrgencyRulesTests`): parse (blank is normal, unknown is `400 urgency`), who may send, guardian test, breaks-through, the notice lead words.
- `SendChatRequest.Urgency` and `ChatMessageDto.Urgency` (omitted when normal). `ChatService.SendAsync` validates the level and enforces the `urgent` permission (`403 urgency`). `ChatPeerRow.BookerUserId` lets it tell a guardian without another query. Photos and text-bridge messages stay `normal`.
- `ChatNotifier.MessageAsync`: urgent is a `Bypass` notice (priority 90) and buzzes the phone even when the conversation is muted; titles read "Urgent message from …" and "Important message from …".
- Rows, the fake store and `docs/backend-data-model.md` updated.
- Not in this phase: any front-end change, acknowledgement, list ordering, rate limit, audit, SMS rules.

### Phase 2: acknowledgement — built

- `ChatMessageAcks` (message, user, at) and `POST /me/chat/conversations/{id}/messages/{messageId}/ack`; reading an urgent message in the open thread does not acknowledge it, only the explicit tap does.
- The sender's thread shows who has acknowledged (names follow the receipts rule: first name and last initial, only members).
- The summary gains `urgentUnacked` (a count and the conversation ids) so badges and the pinned state are the same on every device. A live nudge on acknowledge.

As built:

- Schema: `ChatMessageAcks (MessageId, UserId, AckedAt)`, keyed by the pair, cascading from the message.
- `POST /me/chat/conversations/{id}/messages/{messageId}/ack` (`ChatService.AckAsync`): 204; idempotent; `404` for a message the caller cannot read (not a member, left, outside their window, from someone they blocked); `400 notUrgent` for a message that is not urgent, a system line or their own (`ChatUrgencyRules.CanAck`). Reading or marking a conversation read never acknowledges.
- Thread messages: the sender of an urgent message gets `ackedBy` (public ids of members, empty until someone acknowledges); a reader gets `acked` (bool) on urgent messages from others. Both are omitted otherwise. Acknowledgement is deliberate, so it shows whatever the read-receipts setting is; names are resolved by the app from the member list (first name and last initial).
- `GET /me/chat/summary` gains `urgentUnacked` and `urgentConversations` (ids, distinct), from `IChatStore.ListUnackedUrgentAsync`.
- `ChatNotifier.AckedAsync`: a live nudge (kind `acked`, never a phone notice) to the sender and to the acknowledger's other devices.
- Not in this phase: any front-end change, list ordering or pinning (phase 3).

### Phase 3: presentation (front end) — built

- `src/api` types and `httpApi.ts`; a pure `domain/chatUrgency.ts` (labels, sort, announce mode) with tests.
- Message bubble label and icon; list ordering and pin; the badge; the composer's urgency control (shown only to people who may send urgent; important for everyone) with a clear explanation.
- `ChatToast`: persistent urgent notice with **Got it**, assertive announcement, ignores calm mode and the pop-ups setting; static under reduced motion. Contrast checked in both themes.
- Text in `en.ts` only.

As built:

- Two small server additions the screen needed: `ChatThreadDto.MayUrgent` (staff or a guardian here, so the composer knows whether to offer urgent) and `ChatLastDto.Urgency` (the last message's level, so the list can raise unread important chats). Not built or tested here; the owner runs the server tests.
- `domain/chatUrgency.ts` (levels offered, announce mode, list order, unacknowledged messages, acknowledgement count) and `chatUrgency.test.ts`; `chooseUrgentNotice` and `mayNotifyUrgent` in `chatNotice.ts`.
- List: urgent conversations (from `urgentConversations` in the summary) are pinned first, then unread important ones; each carries an icon-and-word tag and a heavier border; the unread badge turns red for urgent. The Chat tab badge counts an urgent message that was read but not acknowledged.
- Thread: tag and border on messages; **Got it** on urgent messages from others, "Nobody has confirmed this yet" or "Seen and confirmed by …" on your own; an urgent arrival is announced through a separate `role="alert"` line. The composer shows a Normal/Important(/Urgent) choice with a plain explanation, resets to Normal after each send, and keeps the level when a send is held in the outbox.
- `ChatToast`: urgent notices go in their own `role="alert"` region, have no timer, no close button and no Escape; **Got it** acknowledges every unacknowledged urgent message in that conversation, and **Open** goes to the chat. They ignore calm mode and the pop-ups setting, and are hidden only while the guest is inside Chat. No animation, so reduced motion needs nothing more.
- Group chats show a count of who confirmed rather than names (the thread carries only public ids and the member list has names only for direct chats).

### Phase 4: do not disturb, limits and audit — built

As built (the server is not built or tested here; the owner runs the server tests):

- **Do not disturb:** `NotificationRules.NormalizePrefs` keeps `dnd: {until}` (ms, 0 off). `GET/PUT /me/chat/do-not-disturb` (`{mode: hour|morning|off}`; `morning` runs to the end of the guest's quiet hours, 07:00 by default; `400 mode`, `403 supervised`). `PushRules.Decide` holds every non-bypass notice with reason `dnd` until it ends; urgent chat bypasses. The Chat list has a control that says when it ends, and the in-app pop-up (`mayNotify`) honours it; the urgent notice never does. Shown in the push log as "Do not disturb was on".
- **Limits:** `important` 20 an hour and `urgent` 10 an hour per sender (`429 urgencyLimit`, `ChatUrgencyRules.OverLimit`, `IChatStore.CountSentAsync`). Audit row `chat.urgent.send` (conversation and staff/guardian, never the text).
- **Text bridge:** urgent texts start `URGENT:`, important `Important:`; urgent ignores mute and the hourly and daily caps. `ChatSmsLog.MessageId` (new column) ties a text to its message; `ChatUrgentRetryService` (every minute, under the scheduler lock) sends one reminder, with no message text, 5 minutes to 2 hours after an urgent text nobody confirmed.
- Senders are never told that a recipient is in do not disturb.
- Not done: a do-not-disturb control in the Chat settings screen (the list header only).

- One-tap "Do not disturb for 1 hour / until morning" in Chat, stored with the notification prefs, honoured by `PushRules.Decide` and the in-app pop-up, ends by itself, and shows clearly when on.
- Per-user rate limit on `important` and on `urgent` (staff and guardians), audit rows `chat.urgent.send` (sender, conversation, never the text).
- SMS bridge rules for `important` and `urgent`, including the single retry of an unacknowledged `urgent`.
