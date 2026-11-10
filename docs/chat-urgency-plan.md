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

### Phase 2: acknowledgement

- `ChatMessageAcks` (message, user, at) and `POST /me/chat/conversations/{id}/messages/{messageId}/ack`; reading an urgent message in the open thread does not acknowledge it, only the explicit tap does.
- The sender's thread shows who has acknowledged (names follow the receipts rule: first name and last initial, only members).
- The summary gains `urgentUnacked` (a count and the conversation ids) so badges and the pinned state are the same on every device. A live nudge on acknowledge.

### Phase 3: presentation (front end)

- `src/api` types and `httpApi.ts`; a pure `domain/chatUrgency.ts` (labels, sort, announce mode) with tests.
- Message bubble label and icon; list ordering and pin; the badge; the composer's urgency control (shown only to people who may send urgent; important for everyone) with a clear explanation.
- `ChatToast`: persistent urgent notice with **Got it**, assertive announcement, ignores calm mode and the pop-ups setting; static under reduced motion. Contrast checked in both themes.
- Text in `en.ts` only.

### Phase 4: do not disturb, limits and audit

- One-tap "Do not disturb for 1 hour / until morning" in Chat, stored with the notification prefs, honoured by `PushRules.Decide` and the in-app pop-up, ends by itself, and shows clearly when on.
- Per-user rate limit on `important` and on `urgent` (staff and guardians), audit rows `chat.urgent.send` (sender, conversation, never the text).
- SMS bridge rules for `important` and `urgent`, including the single retry of an unacknowledged `urgent`.
