# Chat: features, reach across all 11 stages, and a proactive Stanley

Research and phased plan. First written 2026-11-09, updated the same day with the owner's answers (section 2). Nothing here is built. Phases are built one at a time, only when asked. It extends `chat-plan.md` (connections, conversations, groups, SMS bridge, guardians), `chat-urgency-plan.md`, `chat-ashore-plan.md` and `chat-stanley-plan.md`, and uses the stage model in `stage-experience-plan.md`.

The comparison set is WhatsApp, iMessage, Telegram, Signal, Messenger, Slack/Teams (group coordination) and Discord (communities). The question is not "what do they have" but "what makes chat more useful to a guest at every point of the journey, not only on the ship".

## 1. Contents

1. Contents
2. Owner decisions and how each is applied
3. What we already have
4. The vision: one chat across the 11 stages, with a Stanley who moves the guest forward
5. Feature gap analysis (what popular apps do that we don't)
6. Chat by stage: who can chat with whom, and what Stanley proactively offers
7. The proactive Stanley engine (design)
8. Rooms, channels and public posting beyond the ship (design)
9. Cross-cutting rules
10. Data and API additions
11. Phases (the build plan)
12. Risks, open points and measures of success
13. Sources and method

## 2. Owner decisions and how each is applied

Answers given 2026-11-09. "Applied as" is how this plan reads each answer; anything marked **assumed** is my reading and should be corrected if wrong.

| Question | Owner's answer | Applied as |
| --- | --- | --- |
| Plan the trip, or just talk? | Chat should span **all 11 stages**. Stanley should be able to push things into conversations to help guests move forward in planning and execution. "Can Stanley become more proactive?" | Yes. Chat is available, in some form, at every stage (section 6). A new private **Stanley conversation** and optional group cards carry proactive "moments" (section 7), under a guest-controlled proactivity setting and strict caps. Plans, polls, RSVP and share-from-app cards (phases 3 and 4) are the way chat turns into action. |
| Public room posting: ship only, or beyond? | "Has to work beyond the ship." | Rooms and channels exist **before, during and after** a sailing, not only aboard (section 8). Guests can post in rooms, with moderation. Staff-only broadcast channels are a separate, simpler kind. **Assumed:** posting needs a booking (current or past) on the guest's account; people who have not yet booked can read and ask Stanley but not post (decision to confirm, section 12). |
| Voice notes | "I don't think so." | **Dropped.** Not built, not planned. The SMS bridge and quick replies cover the "I don't want to type" need. Removed from earlier drafts. |
| Edit and delete windows | "Within 15 minutes of sending a message." | Both **edit** and **delete for everyone** are allowed for 15 minutes after sending, then neither. After the window a guest can still report or (for their own view) hide a message. A staff removal after a report is unaffected by the window. |
| Typing indicator and read receipts defaults | "A triple dot bubble I presume." | The typing indicator is an **animated three-dot bubble** ("Sam is typing" for screen readers). **Assumed:** it is **on by default** for direct chats and groups, with a switch in chat settings; with reduced motion on, the dots are still and the text "typing" shows. Read receipts are **unchanged**: they work as today (shown only when both people have them on); no new default is introduced. |

## 3. What we already have

So that nothing below is proposed twice.

| Area | Built |
| --- | --- |
| Connecting | Search by name on the same sailing, requests, accept, decline, block, end, hide me, findable setting |
| Conversations | Direct, group (up to 25), "My group" (booking chat), per-conversation history, join-time windows, system lines |
| Messages | Text (2000 chars), photos, idempotent `clientId`, offline outbox, Sending, Sent, Read, "Waiting for signal", `seenBy` read receipts, profanity filter, age rule for under-18s |
| Notifications | SignalR live nudges, push only if no live ack, per-conversation collapse, opt-in preview, mute, one-tap do not disturb |
| Importance | `normal`, `important`, `urgent` with acknowledgement; urgent only from staff or a guardian |
| Ashore | SMS bridge with `LIST`, `STOP`, `HELP`, `BACK`; "by text" and "Ashore" labels; optional "I'm leaving or back on the ship" notice |
| Safety | Guardian read-only view (audited), report and block per message, staff review, 30-day retention, access log |
| Performance | Device cache of list and thread, 30-message pages, older on scroll, "New messages" chip that never jumps the page |
| Stanley | Planned in `chat-stanley-plan.md`: request cards, reword, icebreakers, ask Stanley in a conversation, group welcome, optional nudges. Stanley elsewhere in the app: `StanleyService`, `IConciergeModel`, model meter, limits, moments and the TripWatch alerts |

Known gaps already on record: the **Delivered** state is not tracked; push fan-out for 25-person groups is sequential; no re-invite after a decline cool-down; chat is built and surfaced for on-board stages and for "Group" tabs only, with search scoped to a **sailing** the guest has a confirmed booking for, and messages are kept only **30 days after the cruise**.

## 4. The vision: one chat across the 11 stages, with a Stanley who moves the guest forward

Today chat is "talk to the people I met". The owner's direction makes it a **thread that runs through the whole journey**:

1. **Before the cruise**, a guest's travel party and sailing-mates talk about what to book, bring and do. Stanley nudges what is due (documents, payments, check-in, excursions to book) as cards in the chat the guest already opens.
2. **On the ship**, groups plan the day (plans and RSVP, polls, "meet me here" cards), staff broadcast, and Stanley helps with the next best action (the port, the all-aboard time, dinner).
3. **After the cruise**, the group keeps its photos and its plans for the next trip, with an opt-in way to keep a chat beyond 30 days.

Three ideas make this work, and each is a later section:

- **Stage-aware availability** (section 6): the same Chat surface, different content, matched to the stage tabs (`Group`, `Plan`, `Board`, `People`).
- **A proactive Stanley, with limits** (section 7): he speaks first with a small set of well-timed, useful cards, and the guest controls how often. He proposes; people and staff decide; nothing is booked, paid or sent without a confirmation.
- **Rooms and channels that live outside the ship** (section 8): by sailing, by interest, and after the trip.

## 5. Feature gap analysis

Scored for **value** (how much a guest would notice), **effort** (S under a week, M one phase, L several phases) and **fit** (our constraints: slow ship connection, strangers who share only a sailing, supervised children, retention, thin client, English only, WCAG 2.2 AA). "Phase" points to section 11.

### A. Everyday expressiveness

| Feature | What it is | Value | Effort | Phase | Notes for us |
| --- | --- | --- | --- | --- | --- |
| **Reactions** | Tap-and-hold or a "React" button; a fixed set of 6 (👍 ❤️ 😂 😮 🙏 ✅). Shown as chips with a count. | High | M | 1 | Cheapest way to answer "OK" in a group without a notification storm. One reaction per person per message. No push for a reaction. Fixed set keeps moderation and screen-reader text simple; no custom emoji for under-18s. |
| **Reply to a message (quote)** | Reply on a message; the new message carries a short quote. | High | M | 1 | Makes groups of 6 to 25 readable. The quote is read through the same membership window, so it never reveals what the reader was not a member for. A removed message shows "Message removed". Tap the quote to jump (focus moves with it). |
| **Quick replies** | "On my way", "Be there in 5", "Where are you?", "Running late", "Thanks!" under the composer; context ones on plan cards ("I'm in", "Can't make it"). | High | S | 1 | One-handed and good for older guests; replaces the need for voice notes. A fixed English set; sends as an ordinary message that passes the filter. |
| **Edit a message** | Fix a message for **15 minutes** after sending; shows "edited". | Medium | M | 2 | Re-runs the profanity filter and age rule. The original is kept for staff review if reported (never shown to members). Sends no new notification. |
| **Delete for everyone** | Replaces my own message with "This message was deleted" for all members, for **15 minutes** after sending. | High | M | 2 | A reported message is held for staff until resolved (same path as staff `remove`). After 15 minutes the guest can report it or hide it from their own view only. |
| **Typing indicator** | An animated **three-dot bubble** in the thread while someone types. | Medium | S | 2 | Ephemeral SignalR event, never stored, throttled to one per 3 s, expires after 6 s of silence. On by default, switch in chat settings. Screen readers get a polite "Sam is typing" at most once per burst. Reduced motion: still dots. Not sent from or to SMS-bridge members. Not shown to a guardian's read-only view. |
| **Emoji picker** | A picker in the composer for desktop. | Medium | S | 9 | Phones have a system emoji keyboard; the gap is desktop. Small "common" row and the OS picker; no bundled emoji dataset (size). |
| **Multiple photos and a gallery** | Up to 10 photos in one message, compressed on the device first; full-screen view with swipe; a "Photos in this chat" view. | Medium | M | 9 | Ship bandwidth drives on-device resize. Lightbox traps focus and closes on Escape. No video or arbitrary files for now (size, moderation). |
| ~~Voice notes~~ | | | | none | **Dropped by the owner.** |
| ~~Link previews~~ | | | | none | **Not recommended**: needs server fetch of arbitrary URLs (SSRF), and under-18s may not send links. Our own deep-link cards (phase 3) replace the need. |

### B. Staying in sync

| Feature | What it is | Value | Effort | Phase | Notes for us |
| --- | --- | --- | --- | --- | --- |
| **@mentions** | Type @ to pick a member; they are notified even in a muted group. | High (groups) | M | 3 | A mention breaks through **mute** but not do-not-disturb (only `urgent` does that). Stored as member ids so renames do not break them. Also how a member addresses Stanley (`@Stanley`, chat-stanley-plan 3.5). |
| **Pinned message** | The creator or an admin pins up to 3 messages in a group ("Meet at the atrium 5pm"). | High | S | 3 | System line "Sam pinned a message". Pinned items stay readable to members within their window. |
| **Unread divider and jump** | A "3 new messages" line; open at the first unread. | High | S | 1 | Client only, from `LastReadMessageId`. |
| **Draft saving** | Half-typed text survives leaving a thread and a reload. | Medium | S | 1 | Device only, per conversation, cleared on send. |
| **Delivered state** | The tick between Sent and Read. | Medium | M | 1 | Needs a client ack when a device receives a message (SignalR `Ack` plumbing exists). Shares plumbing with reactions and typing. |
| **Timed mute and mentions-only** | Mute for 1 hour, 8 hours, until tomorrow, or "mentions only" in a group. | Medium | S | 2 | Reuses the "ends by itself" model of `ChatDnd`. |
| **Archive** | Hide a conversation from the list; returns on a new message. | Low-Medium | S | 2 | Ended chats clutter the list. A flag on the member row. |
| **Search** | Find a message or a photo, in one conversation or all of mine. | Medium | M | 9 | Server-side, only within each membership window. Never across a conversation the caller left. |
| **Read receipts setting** | Turn off sending read receipts. | Medium | S | 2 | Appears to exist; make sure it is on the chat settings screen. No new default. |

### C. Group coordination (where a trip chat earns its keep)

| Feature | What it is | Value | Effort | Phase | Notes for us |
| --- | --- | --- | --- | --- | --- |
| **Polls** | 2 to 5 options, live tally, changeable vote, closes on demand or after 24 h. | High | M | 4 | Results also as text for screen readers. Poll text passes the filter. Visible voters (groups are small). |
| **Plans with RSVP** | "Trivia, 7pm, Piazza" with Going, Maybe, Can't. **Going** adds it to the guest's programme (`PlanEvents`). | **Very high** | M | 4 | Where chat and the rest of Princess meet. Works before the cruise too (an excursion or dinner to book together). Respects ship clock changes (`ShipClockChanges`). |
| **Share from the app** | "Send to chat" from a dining booking, excursion, show, port day or packing list. A card that opens the screen. | **Very high** | M | 3 | Only public facts (name, time, place) travel in the card, never a price, folio line or cabin. A booking card offers "Ask to join" rather than exposing the booking. |
| **"Meet me here" place card** | A named place from the ship profile or port plan (deck, venue, muster station, tender pier) with a time. | High | M | 3 | **Not GPS.** No live tracking. A set expiry. Safer with strangers met in chat. |
| **Back-on-board line** | A group header shows who is back before all-aboard. | Medium | S | 4 | Builds on `ChatAwayRules`; opt-in as now. |
| **Group admins** | More than one admin; "only admins can post" for announcement groups. | Medium | M | 4 | Today one creator. Matters when the creator is ashore, offline or leaves. |
| **Invite link or QR** | Join a group by scanning a code in person. | Low-Medium | M | later | Only same sailing, under the 25 limit, guardian rules intact. Connect-by-name stays the default. |
| Shared lists and tasks | A checklist ("pack sunscreen"). | Low | M | none | Pins, polls and the packing list share-card cover most of it. |

### D. Reaching the right person, quickly

| Feature | What it is | Value | Effort | Phase | Notes for us |
| --- | --- | --- | --- | --- | --- |
| **Stanley smart replies** | Two or three suggested short replies, on tap, never automatic. | Medium | M | in the Stanley plan | Consent rules from `chat-stanley-plan.md` section 5 apply. |
| **Guest Services chat** | Already built. | Done | | | Give it the same photo, reply and reaction features so guests do not meet two UIs (phase 2). |
| Voice or video calls | Calling over the internet. | High ashore | L | none | **Not recommended**: ship internet cost; the SMS bridge covers ashore. |
| Translate a message | Tap to translate. | Medium | M | later | English only for now. When added: one tap, show the original, never alter what is stored. |

### E. Announcements, rooms and community (beyond the ship)

| Feature | What it is | Value | Effort | Phase | Notes for us |
| --- | --- | --- | --- | --- | --- |
| **Staff broadcast channels** | Read-only: "Cruise Director", "Kids Club", "Today on Sun Princess", and before sailing "Your sailing: news". Guests follow or unfollow. | High | M | 8 | Counts against the notice budget so it cannot spam. A channel is not a person-to-person chat, so guardian and retention rules stay simple. |
| **Sailing rooms** | One room per **sailing**, open to anyone with a booking on it, from booking to 30 days after. "Who else is on the 14 March Sun Princess?" | High | L | 8 | The pre-cruise community is where Dream-to-Prebook guests meet. Moderated (section 8). |
| **Interest rooms** | "Solo travellers", "First-timers", "Accessibility", "Foodies", "Photography". Not tied to one sailing. | Medium-High | L | 8 | Open to guests with a current or past booking (**assumed**). The place for the "beyond the ship" answer. |
| **Alumni and next-trip rooms** | After the cruise, an opt-in "Keep in touch" for a group or a sailing, and "Plan our next cruise". | Medium-High | M | 8 | Needs the retention change in phase 5. |
| **Meet-up matching** | Stanley introduces two guests with a shared interest, both consenting. | Medium | L | later | Opt-in, public facts only (Stanley plan request cards). |
| **Service chat extras** | "Replying within 5 minutes", attach a photo, "mark solved". | Medium | S | 2 | Parity with person-to-person chat. |

### F. Privacy, trust and safety

| Feature | What it is | Value | Effort | Phase | Notes for us |
| --- | --- | --- | --- | --- | --- |
| **Block and report from the header** | One tap to block or report a person, not only a message. | Medium | S | 2 | Today it is per message or from People. |
| **Send rate limits and slow mode** | A per-member rate (for example 20 a minute) and a slow mode for large rooms. | Medium | S | 2 | Protects 25-person groups and rooms. |
| **Safety nudges** | A gentle note before an adult shares a phone or cabin number with a new connection. | Medium | S | Stanley plan 3.6/3.8 | Under-18s are already blocked from numbers and links. |
| **Export or "keep my chat"** | Save a conversation or keep it past 30 days (opt-in). | Medium | M | 5, 9 | See section 8.5. Never exports a supervised child's chat to anyone but their guardian. |
| End-to-end encryption | Only devices read messages. | High for trust | L | none | **Not recommended.** The server must read messages for the filter, child rules, guardian view, staff review and retention. Say so plainly in settings instead. |
| Disappearing messages | A timer deletes messages. | Low-Medium | M | none | Cannot apply where a supervised child is a member, nor erase a reported message. Not worth the rules. |

### G. Delight and identity

| Feature | What it is | Value | Effort | Phase | Notes for us |
| --- | --- | --- | --- | --- | --- |
| **Avatars** | A chosen colour and a small set of ship-themed icons, plus initials. No photo upload (moderation, children). | Low-Medium | S | 9 | Also a subtle ring for ashore and back-aboard. |
| **Status line** | "At the pool", 24 h, optional. | Low | S | later | |
| **Haptics and sounds** | A gentle in-app sound and vibration. | Low | S | 9 | Setting, off by default, silenced by do-not-disturb. |
| Stickers and GIFs | Third-party search. | Low | M | none | Not recommended (children, privacy). A curated 20-image ship set is a safe alternative if wanted. |
| Chat themes | Colour per chat. | Low | S | none | Skip. |

## 6. Chat by stage: who can chat with whom, and what Stanley proactively offers

The eleven stages and their tabs come from `stage-experience-plan.md` 5.1. Chat is not a tab; it lives in **Group** (Manage, Prebook), **Plan** (Get to the ship), **Board** (Embark) and **People** (Sea, Port, Disembark). Dream, Discover and Book have no such tab today, and Remember has none. This plan adds a way into Chat for every stage (section 6.2).

### 6.1 Who the guest can talk to, by stage

| # | Stage | Person-to-person | Rooms and channels | Stanley conversation |
| --- | --- | --- | --- | --- |
| 1 | Dream | None (no booking, no sailing) | Read-only previews of interest rooms (**assumed**); no posting | Yes: the existing "Ask" Stanley, shown as a conversation |
| 2 | Discover | None | Same, plus the sailing's channel preview when a sailing is under consideration | Yes |
| 3 | Book | Only the **people on the booking** (travel party chat starts at booking) | Can follow the sailing channel after the booking confirms | Yes |
| 4 | Manage | Travel party, plus sailing-mates once the booking is confirmed | Sailing room, interest rooms, staff channel | Yes |
| 5 | Prebook | Same | Same | Yes |
| 6 | Get to the ship | Same | Same | Yes |
| 7 | Embark | Same, plus on-board Guest Services | Same, plus the ship's channels | Yes |
| 8 | Sea | Same | Same | Yes |
| 9 | Port | Same, plus SMS bridge when ashore | Same, plus port channel | Yes |
| 10 | Disembark | Same | Same | Yes |
| 11 | Remember | Same, and "keep in touch" for chats the guest chooses to keep | Alumni and next-trip rooms; the sailing room closes 30 days after the cruise unless the guest keeps it | Yes |

Eligibility is computed on the **server** from the guest's bookings (confirmed booking, sailing dates, stage), so a guest can move between devices and the screen never decides who may talk to whom.

### 6.2 Where chat is reached from, by stage

| Stages | Entry |
| --- | --- |
| 1 to 3 (Dream, Discover, Book) | The Stanley conversation from **Ask** (and **Cost** or **Booking** where Ask is not a tab). After booking, **Booking** and **Travellers** show a "Chat with your travel party" action. |
| 4 to 6 (Manage, Prebook, Get to the ship) | Existing **Group** or **Plan** tab entry, now opening the unified conversation list (Stanley first, then party, then people, rooms). |
| 7 to 10 (Embark to Disembark) | Existing **Board** or **People** entry, same list. |
| 11 (Remember) | **Memories** and **Next** each show a "Keep in touch" and "Share your photos" action into the conversation. |

The Chat tab badge, summary and push behaviour follow the same rules at every stage.

## 7. The proactive Stanley engine (design)

### 7.1 Principles

1. **Useful, timed and few.** A card appears because something about the guest's trip is due, changed or about to matter, not because a model felt chatty. Every moment has a trigger, a purpose and an expiry.
2. **People decide.** Stanley proposes a single next action. The guest confirms. Stanley never books, pays, sends, accepts, declines, blocks or reports on his own.
3. **Driven by trip facts, not by reading conversations.** Proactive moments come from the booking, the stage, dates, programme, folio, documents, weather and ship data. They do **not** read what guests say to each other. The existing opt-in pattern checks for scams (chat-stanley-plan 3.8) stay separate and opt-in.
4. **Deterministic first.** Rules decide **whether** and **when** (pure `ChatProactiveRules`, tested). A model is used only to word a card when a template is not enough, on the small tier, behind the existing meter and limits. If the model is down, the plain template is used and chat works as it does today.
5. **Guest controls the volume.** Three modes (below), quiet hours, per-topic off switches, and "Don't show again" that sticks unless the facts change.
6. **Private by default, shared by consent.** A moment goes to the guest's **own Stanley conversation**. It reaches a group only if the group's admin turned on "Stanley helps this group" **and** the moment is about the group (a plan, a poll, a shared deadline). Every member can mute his lines.
7. **No pressure.** No countdown timers, false scarcity or shaming (rule 7 of the journey doc). Offers never outrank required tasks.
8. **Children.** Stanley is off in any conversation a supervised child belongs to (as in the Stanley plan). A child's proactive moments, if any, go to the guardian's Stanley conversation, never to the child, until a guardian opts in.

### 7.2 Proactivity setting

Stored with chat preferences so it follows the guest across devices. Matches the three-mode idea in `stanley-gap-analysis-and-plan.md` 7.6.

| Mode | Behaviour |
| --- | --- |
| **Only what affects my trip** | Critical and due-date moments only (payment due, documents missing, check-in opens, all-aboard, disruption). Default for guests who have not chosen. |
| **Offer suggestions** | The above plus well-timed suggestions (book an excursion, a dinner, a plan with the group, a photo recap). |
| **Guide me through everything** | The above plus a gentle step-by-step on each stage's three Next steps (`stageHome.ts`). |

Caps (in `ChatProactiveRules`): at most **one** proactive card is on screen at a time; at most **3 new** non-critical cards a day; critical ones are separate and do not use the daily cap; a dismissed card is not shown again unless the underlying facts change (a new due date, a new price, a new time); nothing between the guest's quiet hours; an open do-not-disturb holds everything except critical items that are already urgent notices elsewhere in the app.

### 7.3 What a card is

A **typed message** (`Kind = card`) in the Stanley conversation, labelled "Stanley" with the AI label (as the Stanley plan requires), with:

- a one-line headline and one or two lines of why now ("Your final payment is due in 5 days"),
- **one primary action** (a deep link to the screen, or a one-tap confirmation such as "Add to my plan"),
- **Not now** (snooze to tomorrow) and **Don't show this again**,
- a stable `MomentKey` so the same moment is never posted twice, and an `ExpiresAt`, after which it reads "No longer needed" and loses its action.

A card never carries a price, a cabin number or a payment detail in a push; the push says "Stanley has a suggestion". The card opens inside the app.

### 7.4 Pushing to groups (shared moments)

Opt-in per group by the creator or an admin. Examples: "Three of you haven't picked a dinner time. Make a poll?", "The group's excursion is Thursday: 4 of 6 are going. Share the meeting point?" The card is addressed to the group's admin first ("Post this to the group?"); only on their tap does it appear for everyone. Members can mute Stanley's lines. No group card in a conversation that includes a supervised child.

### 7.5 How a moment is chosen

```
trigger (event, schedule or stage change)
  -> ChatProactiveRules.Candidates(stage, facts, prefs, history)
  -> filter: mode, quiet hours, DnD, caps, dismissed, expired, child rules
  -> rank: critical > due soon > helps a group > suggestion
  -> render: template (or small-tier wording behind the meter)
  -> post one card into the Stanley conversation, nudge the open app, push only if allowed by the notice budget
```

Triggers come from the places that already know: `StageService` (stage change), `TripWatch` (instalments, tender outlook, flight), `PlanService` (programme changes), `FolioRules`, the document and check-in services, the port day (`AboardRules`), the weather and ship-telemetry mocks, and a daily scheduled pass.

### 7.6 Moments by stage (the catalogue)

IDs are stable `MomentKey` prefixes. "Mode" shows the lowest mode in which the moment appears (O = only what affects my trip, S = offer suggestions, G = guide me through everything). Actions open existing screens.

| # | Stage | Moment | Trigger | Card and primary action | Mode |
| --- | --- | --- | --- | --- | --- |
| 1 | Dream | `dream.first-look` | First time in the app | "Tell me what you're hoping for and I'll find sailings." → open Ask | G |
| 1 | Dream | `dream.compare` | A saved idea sits for 3 days | "Want me to compare these two trips?" → comparison | S |
| 2 | Discover | `discover.cabin-help` | Three cabin views, no choice | "Want help choosing a cabin type?" → Cabin | S |
| 2 | Discover | `discover.true-cost` | Cost tab opened | "Here is the real total including gratuities." → Cost | S |
| 3 | Book | `book.invite-party` | Booking confirmed, party chat empty | "Invite your travel party to chat." → party chat | O |
| 3 | Book | `book.traveller-details` | A traveller's details missing | "Sam's passport details are needed." → Travellers | O |
| 3 | Book | `book.pay-deposit` | Deposit unpaid within the option window | "Your deposit is due on 12 Dec." → Pay | O |
| 4 | Manage | `manage.final-payment` | Final payment due in 14, 7, 3 days | "Final payment due in 7 days." → Pay | O |
| 4 | Manage | `manage.documents` | Documents or health forms missing | "2 travellers still need documents." → Needs | O |
| 4 | Manage | `manage.group-poll` | Party of 3+ with no shared plan | "Make a poll for what your group wants to do?" (shared, admin only) | S |
| 4 | Manage | `manage.needs-check` | Special needs unset | "Any mobility, dietary or medical needs?" → Needs | O |
| 5 | Prebook | `prebook.first-excursion` | 30 days out, no excursion | "Popular excursions at your first port." → Plan | S |
| 5 | Prebook | `prebook.dining` | Dining windows open | "Dinner times open today; shall I look at your group's options?" → Dining | S |
| 5 | Prebook | `prebook.group-plan` | Two or more in a group booked the same excursion | "Share it as a plan so everyone can RSVP?" (shared) | S |
| 5 | Prebook | `prebook.packing` | 14 and 3 days out | "Your packing list is ready; share it with your group?" → Packing | S |
| 6 | Get to the ship | `getship.checkin-open` | Online check-in opens | "Check-in is open." → Board | O |
| 6 | Get to the ship | `getship.boarding-pass` | Check-in done, pass not saved | "Save your boarding pass for offline." → Board | O |
| 6 | Get to the ship | `getship.travel` | Flights or transfer within 48 h | "Flight status and the transfer time." → Travel | O |
| 6 | Get to the ship | `getship.meet-before` | Group members in the same city or flight | "Share where you're meeting before the ship?" (shared place card) | S |
| 7 | Embark | `embark.boarding-window` | Boarding group called | "Your boarding window opens at 1:00." → Board | O |
| 7 | Embark | `embark.muster` | Muster not confirmed | "Confirm your muster drill." → Muster | O |
| 7 | Embark | `embark.first-night` | Boarded | "Three things worth doing tonight." → Plan | S |
| 7 | Embark | `embark.find-friends` | Boarded, chat on | "Say hello to your group, and see who's on board." → conversation list | G |
| 8 | Sea | `sea.today` | Morning of a sea day | "Today at sea: 3 things your group might enjoy." → Today (shared option: post to group) | S |
| 8 | Sea | `sea.dining-gap` | Dinner not booked by 3pm | "No dinner plan tonight. Look at options?" → Dining | S |
| 8 | Sea | `sea.group-meet` | A plan has 3 Going | "Three are going to trivia. Post a 'meet me here' card?" (shared) | S |
| 8 | Sea | `sea.bag-night` | Night before the last day | "Bags go out by 11pm tonight." → Leave | O |
| 9 | Port | `port.all-aboard` | Port day starts, and at T-90 and T-30 | "All aboard is 4:30; last tender 4:00." → Port (mirrors the existing all-aboard notice; does not replace it) | O |
| 9 | Port | `port.ashore-bridge` | Guest leaves, SMS bridge off, group active | "Want your group to reach you by text ashore?" → SMS settings | S |
| 9 | Port | `port.group-lunch` | Midday ashore, group has a plan | "Share where you're having lunch?" (shared place card) | S |
| 9 | Port | `port.tender-delay` | Tender outlook worsens | "Tenders are running late; plan to return early." → Port | O |
| 10 | Disembark | `leave.exit-time` | Evening before | "Your exit slot is 8:15." → Leave | O |
| 10 | Disembark | `leave.bill` | Folio has an unexpected line | "Your final bill is ready; one charge may need a look." → Bill | O |
| 10 | Disembark | `leave.swap-contacts` | Last day, group active | "Keep in touch? Choose which chats to keep after the cruise." → keep chats (shared offer) | S |
| 11 | Remember | `remember.photos` | 2 days after | "Share your photos with your group." → gallery (shared) | S |
| 11 | Remember | `remember.feedback` | 3 days after | "How did it go? It takes 2 minutes." → Feedback | O |
| 11 | Remember | `remember.next-trip` | 14 days after | "Plan the next cruise with the same group?" → Next (shared) | S |
| 11 | Remember | `remember.retention-warning` | 7 days before chats expire | "Keep this chat? It will be deleted on 14 April." → keep | O |

Notes on the table:

- A moment with "(shared)" is posted to the group only after the group admin confirms (7.4) and only when "Stanley helps this group" is on. Every other moment is private to the guest's Stanley conversation.
- Port, all-aboard, muster and bag-night moments **mirror** notices the app already sends; chat is a second place to see them, not a second source of truth, and a card is never the only way a guest learns about something safety-critical.
- The table is a first catalogue. Each phase 7 pack (section 11) builds a slice, with its own rules tests, and the owner can drop or add moments.

## 8. Rooms, channels and public posting beyond the ship (design)

### 8.1 Kinds

| Kind | Who posts | Who can read | Lives |
| --- | --- | --- | --- |
| **Channel** | Staff only | Anyone following (booking holders, plus read-only previews before booking if allowed) | A sailing, a ship, a port, or the brand |
| **Sailing room** | Guests with a booking on that sailing | Same | Booking to 30 days after, unless kept |
| **Interest room** | Guests with a current or past booking (**assumed**) | Same, plus read-only previews to prospective guests (**assumed**) | Persistent |
| **Alumni and next-trip room** | Members who opted in | Members | Until members leave; a retention period applies (8.5) |

### 8.2 Who may post

- Posting needs **a verified booking** (current or past) on the guest's account, checked on the server. A guest without one reads, follows and asks Stanley, but cannot post. This keeps anonymous visitors out of the public conversation and matches the "strangers share only a sailing" model.
- Names are first name and last initial only. No email, phone, cabin or booking number is ever shown. A guest can hide from rooms in one setting without hiding from their friends.
- **Supervised children** never join rooms. The guardian's view does not cover rooms because children are not in them.

### 8.3 Moderation (required before any room opens)

| Control | Detail |
| --- | --- |
| Filter | `ProfanityFilter` on every post; links and phone numbers held for staff review in rooms, not sent (a safer default than in private chats). |
| Report | Per message and per person, to staff, with context lines (reuses `ChatReports`). |
| Staff tools | Staff moderators per room: remove a message, mute a person for an hour, a day or the room, remove a person, pin the rules. All actions audited with no message text in the audit log. |
| Rate and slow mode | Per-member rate limit, and a slow mode (one message per 30 s) that staff can switch on. |
| Rules | Rules are pinned at the top and accepted on first post. |
| Volume | Rooms have a member cap per room (for example 500, then a second room), and a muted-by-default notification state: a room never pushes unless the guest turns it on or is mentioned. |
| Safety | Safety-critical content (an emergency, a missing person) is redirected to "Get help now" and staff, never handled in a room. |
| Review | A weekly moderation summary for staff: reports, actions, rooms busiest, rooms with no moderator. |

### 8.4 Stage fit

Pre-cruise rooms give Manage and Prebook guests people to talk to ("Is the 3pm excursion worth it?"). Aboard, rooms and channels sit beside party and direct chat in the conversation list, never ahead of it. After the cruise, rooms are the place for photos and the next trip.

### 8.5 Retention beyond 30 days (decision to confirm)

Today messages are deleted 30 days after the cruise, and the screen says so. The vision needs chats that outlive the cruise:

- **Default stays 30 days** for private chats and sailing rooms.
- **Keep this chat** is opt-in **per conversation, by every member** (a member who does not agree sees the chat leave their list on schedule; the chat stays for those who kept it, with a system line). A kept chat is held for **12 months** after the cruise (**proposed**), with a visible date.
- A chat with a supervised child cannot be kept past 30 days without the guardian's choice, and the guardian's reading rights remain.
- Interest and alumni rooms have their own retention (proposed: posts kept 12 months, then removed).
- Retention changes touch the retention job, the privacy notice and the "kept for 30 days" screen text. This is done in phase 5 and must be reviewed before it ships.

## 9. Cross-cutting rules

1. **Server decides.** Every new thing passes through the membership window check, the profanity filter where it carries text, the age rule for under-18s and the guardian view. The front end does not know whether Stanley, a room's staff action or a provider is a mock.
2. **Small and offline-friendly.** New events are nudges that cause a refetch, not payloads that must arrive. A reaction, vote, RSVP or edit goes through the outbox with an idempotency key and says "Waiting for signal" until it lands.
3. **No push for lightweight actions.** Reactions, votes, typing and Stanley suggestions never push by default. Mentions, plans and staff channels may, within the notice budget and do-not-disturb.
4. **Supervised accounts.** Each feature states what a child can do and what the guardian sees. A child cannot start a poll, pin, plan or room post unless explicitly allowed.
5. **Accessible by construction.** A gesture (long-press, swipe) always has a button alternative; reactions, polls, plans and typing announce changes politely as text; no reliance on colour or animation alone; targets at least 44 px; reduced motion respected; dialogs trap focus and close on Escape; incoming content never steals focus.
6. **Retention and audit.** New tables fall under the retention job and the delete-message path; anything staff or a guardian reads is audited without text.
7. **Edit and delete window.** The 15-minute window is a server rule on `At`, checked on the server clock, not the device. Editing never resends notifications. A reported or staff-removed message cannot be restored by the sender.
8. **Stanley is labelled and bounded.** Every Stanley line is labelled, capped, dismissible and driven by trip facts. A proactive card is never the only way a guest learns something critical.
9. **English only for now.** New strings are English; do not add Spanish.
10. **Thin client.** Types and calls go in `src/api` and `httpApi.ts`; pure logic (windows, caps, ranking) lives in framework-free modules with unit tests; the server holds the data.

## 10. Data and API additions

### 10.1 Data

| Table or column | Purpose | Phase |
| --- | --- | --- |
| `ChatReactions(MessageId, UserId, Emoji, At)` | One reaction per person per message | 1 |
| `ChatMessages.ReplyToId` | Quote | 1 |
| `ChatMessageDeliveries(MessageId, UserId, DeliveredAt)` | Delivered state | 1 |
| `ChatMessages.EditedAt`, `DeletedAt`, `OriginalText` (staff only) | Edit and delete | 2 |
| `ChatGroupMembers.ArchivedAt`, `MutedUntil`, `MentionsOnly` | Archive and timed mute | 2 |
| `UserPrefs.ChatTyping` | Typing indicator switch | 2 |
| `ChatMessages.Kind` (`text`, `photo`, `system`, `card`, `place`, `plan`, `poll`, `stanley`) and `Payload` (JSON) | Typed messages in one table so windows, reports and retention stay in one place | 3 |
| `ChatMentions(MessageId, UserId)`, `ChatPins(GroupId, MessageId, PinnedBy, At)` | Mentions and pins | 3 |
| `ChatPolls`, `ChatPollOptions`, `ChatPollVotes` | Polls | 4 |
| `ChatPlans(MessageId, ProgramEventId?, Title, Place, StartsAt)`, `ChatPlanRsvps(PlanId, UserId, Answer)` | Plans and RSVP | 4 |
| `ChatGroupMembers.Role` (`creator`, `admin`, `member`) | Admins | 4 |
| `ChatGroups.Kind` gains `stanley`, `channel`, `room`; `ChatGroups.SailingId`, `ChatGroups.Topic` | Stanley conversation, channels and rooms | 5, 6, 8 |
| `ChatKeeps(GroupId, UserId, KeptAt)`, `ChatGroups.KeepUntil` | Keep-a-chat | 5 |
| `StanleyChatPrefs(UserId, Mode, QuietFrom, QuietTo, TopicsOff)` | Proactivity | 6 |
| `StanleyMoments(UserId, MomentKey, PostedAt, ExpiresAt, DismissedAt, SnoozedUntil, FactsHash)` | Dedupe, caps, "don't show again unless facts change" | 6 |
| `ChatGroupStanley(GroupId, On, TurnedOnBy)` | Group opt-in for shared cards | 7 |
| `ChatChannels`, `ChatChannelFollows`, `ChatRoomModeration` | Channels, rooms and staff actions | 8 |

### 10.2 API (new routes, grouped by phase)

| Phase | Routes |
| --- | --- |
| 1 | `PUT/DELETE /me/chat/conversations/{id}/messages/{mid}/reaction`, reply field on `POST …/messages`, `POST …/delivered` |
| 2 | `PATCH …/messages/{mid}` (edit), `DELETE …/messages/{mid}` (delete for everyone), `POST …/typing`, `PUT …/archive`, `PUT …/mute {until, mentionsOnly}`, `POST /me/chat/people/{id}/block`, `POST …/people/{id}/report`, `GET/PUT /me/chat/settings` gains `typing` |
| 3 | `POST …/messages {kind: card|place}`, `PUT …/pins/{mid}`, mentions on send, `GET /me/chat/shareable` (what can be shared from where the guest is) |
| 4 | `POST …/polls`, `POST …/polls/{id}/vote`, `POST …/polls/{id}/close`, `POST …/plans`, `PUT …/plans/{id}/rsvp`, `PUT …/members/{id}/role` |
| 5 | `GET /me/chat/eligibility` (what chat the guest may use at this stage), `PUT …/conversations/{id}/keep` |
| 6 | `GET /me/chat/stanley/feed`, `POST …/moments/{key}/dismiss`, `…/snooze`, `PUT /me/chat/stanley/prefs` |
| 7 | `PUT …/groups/{id}/stanley`, `POST …/moments/{key}/post-to-group` |
| 8 | `GET /me/chat/channels`, `POST …/channels/{id}/follow`, `GET/POST …/rooms…`, `/admin/chat/rooms/**` (moderation) |
| 9 | `GET /me/chat/search`, `POST …/photos` (multi), `GET /me/chat/export` |

## 11. Phases

Each phase ends with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` passing, then a commit, and **stops** so the work can be cleared (project rule). The server is not built or tested here; its tests are written for the owner to run. Do not start the next phase until asked. Each phase lists its **scope**, **server**, **front end**, **tests** and **done when**.

### Phase 1: a modern thread (reactions, replies, delivered, quick replies)

*Why first:* it adds the event plumbing and the message shape changes everything else sits on.

- **Server:** `ChatReactions`, `ChatMessages.ReplyToId`, `ChatMessageDeliveries`; reaction set of 6; a reply quote read through the membership window ("Message removed" when gone); delivered ack from a device; reactions and delivery as nudges to refetch, never pushes. Pure `ChatReactionRules` and delivery rules.
- **Front end:** React button plus long-press; reaction chips with counts and screen-reader text; Reply action and quote block with tap-to-jump; quick-reply row under the composer (fixed English set); unread divider and "jump to first unread"; draft saving per conversation (device only); Delivered between Sent and Read (`deliveryOf`, `chatThread.ts`).
- **Tests:** unit tests for reaction toggling, one-per-person, reply window safety, delivery states, divider position, drafts; a test that a non-member cannot react to or quote a message.
- **Done when:** a guest can react, reply, send a quick reply and see Delivered then Read, by keyboard and screen reader, offline-safe, with no push for any of it.

### Phase 2: control and safety (typing bubble, edit and delete, header safety, mute)

- **Server:** edit and delete for everyone with a **15-minute** window on server time; edit re-runs filter and age rule and sets `EditedAt`; delete replaces the text for all members and keeps `OriginalText` for staff review of reports; typing events (throttled one per 3 s, expire after 6 s, not stored, not sent to SMS-bridge members or a guardian's view); `UserPrefs.ChatTyping`; per-member send rate limit and slow-mode flag; timed mute, mentions-only flag and archive; block and report a person from the header.
- **Front end:** animated three-dot typing bubble (still with reduced motion; polite "Sam is typing" once per burst); Edit and Delete actions shown only while the window is open (the window closes live, with a "Too late to change this" message); "edited" and "This message was deleted" states; header menu with Block, Report, Mute, Archive; chat settings gain the typing switch; Guest Services chat gets photos, replies and reactions parity; confirm the read-receipts switch is on the settings screen.
- **Tests:** window boundaries (14:59 passes, 15:01 refuses), edit re-filtering, original kept for reports, rate limit, mute-until expiry, typing expiry and throttling.
- **Done when:** a guest can fix or retract a message for 15 minutes; sees a typing bubble that respects reduced motion and the switch; and can block or report from the header; and no new notification fires for an edit.

### Phase 3: typed messages and cards (share from the app, place cards, pins, mentions)

- **Server:** `ChatMessages.Kind` and `Payload`; card and place payload shapes with only public facts; `GET /me/chat/shareable` builds what can be shared from a booking, excursion, dining, show, port day and packing list (names, times, places only); place cards use named places from the ship profile and port plan, with an expiry; pins (up to 3, creator or admin); mentions stored as member ids, breaking through mute but not do-not-disturb; `@Stanley` hook (shared with the Stanley plan phase 3).
- **Front end:** "Send to chat" on the source screens; card renderer (opens the source screen, shows "no longer available" when stale); place card with "Meet me here"; pin bar and pin action; @mention picker.
- **Tests:** a card never carries price, folio, cabin or booking number; place expiry; mention notification rules; pin limits.
- **Done when:** a guest can send an excursion or dinner to their group, drop a meeting point, pin the plan and mention a member who has the group muted.

### Phase 4: group planning (polls, plans with RSVP, admins, back-on-board line)

- **Server:** polls (2 to 5 options, changeable vote, close on demand or after 24 h); plans with RSVP (`Going` calls the programme toggle and respects `ShipClockChanges`); second admin and announcement-only groups; back-on-board line from `ChatAwayRules` (opt-in per group).
- **Front end:** poll and plan composers; result text for screen readers; RSVP buttons; "Add to my plan" confirmation; group header showing who is back; admin management in Group details.
- **Tests:** vote rules, close rules, RSVP updating the plan and undoing it, admin promotion, guardian rules for a child in a poll or plan.
- **Done when:** a group can vote on dinner and agree a plan that lands in each Going member's programme, before or during the cruise.

### Phase 5: chat across all 11 stages (eligibility, entry points, keep a chat)

- **Server:** `GET /me/chat/eligibility` computed from bookings, sailing dates and stage (section 6.1); party chat starts at booking confirmation (members of the booking); sailing-mate connections allowed once a booking is confirmed (the search remains scoped to the sailing); retention: `Keep this chat` per member, `ChatKeeps`, `KeepUntil` (12 months proposed), the retention job and the guardian rules (section 8.5); a Stanley-conversation kind **reserved** (created in phase 6).
- **Front end:** the unified conversation list reachable from **Group**, **Plan**, **Board**, **People**, and the added entries in Ask, Cost, Booking, Travellers, Memories and Next (section 6.2); "Keep in touch" and "Keep this chat" screens with the deletion date visible; the "kept for 30 days" notice updated; offline copy per stage.
- **Tests:** eligibility per stage (a Dream guest cannot message a person; a booked guest can chat with the booking party), retention and keep rules, a chat with a child cannot be kept without the guardian.
- **Done when:** a guest at any of the 11 stages sees a sensible chat entry, and a group can keep a conversation past 30 days with every member's consent.

### Phase 6: Stanley conversation and the proactive engine

- **Server:** a private `stanley` conversation per guest, always first in the list; `ChatProactiveRules` (pure: mode, caps, quiet hours, dismissed, facts changed, child rules, ranking); `StanleyChatPrefs` and `StanleyMoments`; the daily pass and event triggers wired to `StageService`, `TripWatch`, `PlanService`, `FolioRules`, document and check-in services; card typed messages with `MomentKey`, `ExpiresAt`, **Not now** and **Don't show again**; wording from templates first, small-tier model behind the meter when needed; audit rows with no text; the three proactivity modes (7.2).
- **Front end:** the Stanley conversation (labelled and with the AI label), card renderer with one primary action, snooze and dismiss, "No longer needed" state; the proactivity setting and quiet hours in chat settings; a quiet badge rather than a push by default.
- **Tests:** caps, dedupe by `MomentKey`, "don't show again unless facts change", quiet hours, mode filtering, child exclusion, that no card includes a price or cabin in push text.
- **Done when:** a booked guest sees at most one helpful card at a time in their Stanley conversation, can silence any of them, and sees none during quiet hours.

### Phase 7: the proactive catalogue by stage (built in four slices)

Each slice adds the moments in section 7.6 for its stages, with their own rules tests, copy and deep links. Stops after each slice.

- **7a Dream, Discover, Book (stages 1 to 3):** the Ask-conversation moments, cabin and cost help, party invite, traveller details, deposit.
- **7b Manage, Prebook, Get to the ship (stages 4 to 6):** final payment, documents, needs, first excursion, dining, packing, check-in, boarding pass, travel. Adds the **group** card path (`ChatGroupStanley`, `post-to-group`) for plan and poll suggestions.
- **7c Embark, Sea, Port, Disembark (stages 7 to 10):** boarding, muster (mirrors existing notice), first night, sea day, dinner gap, group meet, all-aboard and tender (mirrors), exit time, bill, "keep in touch".
- **7d Remember (stage 11):** photos, feedback, next trip, retention warning.
- **Done when (each slice):** every moment in the slice has a trigger, a template, an action that opens an existing screen, an expiry and a test; the owner has seen the copy.

### Phase 8: channels and rooms beyond the ship

- **Server:** `channel` and `room` conversation kinds, `SailingId`, `Topic`; follow and unfollow; the posting rule (verified booking, current or past); the moderation controls in 8.3 (filter plus link and number hold, report, staff tools, slow mode, member caps, rules accepted on first post, audit); channels use the notice budget; supervised children excluded; weekly moderation summary; a feature switch per kind so staff can turn rooms off without a release.
- **Front end:** channel and room entries in the list; read-only previews for guests without a booking (if confirmed); post, report and mute; staff moderation screens under admin; rules sheet.
- **Tests:** a guest without a booking cannot post; a child cannot join; a held link is not delivered; moderator actions are audited without text; slow mode.
- **Done when:** staff can run a sailing channel and a sailing room with live moderation before any guest sees it; interest and alumni rooms follow behind a switch.
- **Gate:** do not open rooms to guests until a staffing plan for moderation is agreed (section 12).

### Phase 9: media, search and polish

- Multiple photos with on-device resize, gallery and lightbox; search (one conversation, then all mine, within each membership window); export my chat (own chats only); emoji picker for desktop; avatars (colour and ship icons); optional haptics and sounds; accessibility and performance review of the whole chat (keyboard, live regions, reduced motion, contrast, slow-connection checks).
- **Done when:** the quality bar in `chat-plan.md` 4.8 is re-checked against every new screen and the chat accessibility review has no open AA failures.

### Dependencies and order

```
1 thread -> 2 control -> 3 cards -> 4 planning
                         \-> 5 all stages -> 6 Stanley engine -> 7a..7d proactive catalogue
                                         \-> 8 channels and rooms
                                                         9 media and polish (any time after 2)
```

Phase 3's typed messages are required by 4, 6 and 8. Phase 5 is required by 6, 7 and 8. Phases 7 and 8 are independent of each other once 6 and 5 are done.

## 12. Risks, open points and measures of success

### Risks

| Risk | Mitigation |
| --- | --- |
| A proactive Stanley feels like spam | Mode setting, caps, quiet hours, sticky dismissal, no push by default, a "Why am I seeing this?" line on every card, a measured dismiss rate that triggers a review |
| Rooms attract abuse, and moderation is a people cost | Posting needs a booking; staff tools before launch; link and number hold; slow mode; a staffing plan is a gate for phase 8 |
| Longer retention is a privacy change | Opt-in per member, visible deletion date, guardian rules, a privacy-notice and screen-text update in the same phase |
| Cards leak private facts | Cards carry only public facts; prices, cabin and folio never go in a card or push; tests assert it |
| A card for something safety-critical is relied on | Chat mirrors existing notices and is never the only channel |
| Edit and delete are used to hide abuse | Original kept for staff review of reports; a reported message cannot be edited or deleted by the sender |
| Scope is large | Each phase is independently useful and ends in a commit; 7 is four slices |

### Open points for the owner

1. **Who may post in public rooms?** This plan assumes a verified booking (current or past). Confirm, or say whether people who have not booked may post in an "Ask the community" room.
2. **Read-only previews before booking.** Should Dream and Discover guests be able to read rooms (assumed yes), and should the channel for a sailing be visible before booking?
3. **Retention for kept chats:** 12 months proposed. Is that right, and does legal need to review?
4. **Default proactivity mode:** "Only what affects my trip" is proposed for new guests. Should it be "Offer suggestions" instead?
5. **Typing indicator default:** on for both direct chats and groups (assumed from "a triple dot bubble"). Say if groups should be off by default.
6. **Read receipts:** unchanged (shown when both have them on). Say if a new default is wanted.
7. **Moderation staffing:** who moderates sailing and interest rooms, and in which hours?
8. **Group cards:** should the admin confirm each shared Stanley card (proposed), or should a group be able to allow them without asking each time?

### Measures of success

- Share of conversations with at least one reaction or reply; share of groups using a plan or poll; plan RSVPs that become programme entries.
- Median time from a Stanley card to its action; dismiss, snooze and "don't show again" rates per moment (a moment with a high dismiss rate is rewritten or dropped).
- Proportion of guests who open chat at each stage; pre-cruise and post-cruise message volume; chats kept past 30 days.
- Report rate per 1,000 room messages; time from report to staff action.
- No rise in push opt-outs after proactive cards launch.

## 13. Sources and method

A review of the shipped features of the named apps as of late 2026, from their public help pages and release notes and from general product knowledge, matched against what the repository already does (`docs/chat-*.md`, `docs/stage-experience-plan.md`, `docs/stanley-gap-analysis-and-plan.md`, `src/api/chatTypes.ts`, `src/ui/onboard/Chat*.tsx`). No live web research was run, so a short check of current WhatsApp, iMessage and Telegram feature sets is worth doing before phase 1. Effort figures are estimates, not quotes.
