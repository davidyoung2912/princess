# Stanley reminders: deep-dive requirements

Status: **draft for review (2026-11-10).** Nothing here is built. It expands the "reminders" feature through the permanent 1:1 Stanley chat (`docs/chat-features-research.md` section 15): which reminders a guest wants, how they are created, and above all **how a guest is told when one comes due, runs late or lapses**. It is the detailed companion to `docs/stanley-actions-and-proactive-plan.md`.

Follows `CLAUDE.md`: thin client (the server owns reminders so they follow the guest between devices), English only, the backend mocks every external service behind an interface, WCAG 2.2 AA, phases that commit and stop, checks are `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` only.

"Expiry" is used in two senses below and both are specified: **due** (the moment a reminder is meant to fire) and **lapse** (a reminder nobody saw, or one that no longer matters).

---

## 1. What exists today

| Piece | What it does | Limit |
|---|---|---|
| `remind_me` action (`StanleyActions.cs`, `stanleyAction.ts`) | "Remind me at 4:15 to be back" becomes a previewed, confirmed action | Regex-parsed clock time only (`HH:MM`), on the guest's current day, ship zone; text up to 80 characters. No "in 30 minutes", no "tomorrow", no "before my tour", no repeat |
| `dbo.StanleyReminders`, `StanleyReminderService` | Server copy of the reminder; due ones go out in the existing push run as a `reminder` notice (category `checkin`, skips budget and quiet hours, not a switched-off channel) | The push sender is still the mock; real VAPID keys are a deployment step. Evaluation runs when the app calls `/me/push/dispatch`, not on a server clock (see chat research 15.11, 0b) |
| `localReminders.ts` | Works out reminders due now from the trip: final payment (7 days, then near, then overdue), check-in (day before, on the day), all-aboard (120, 60, 30 minutes), plus guest reminders | Shows only while the app is open, and says so: "not a background alert" |
| Notices (`NotificationRules.BuildNotices`) | Ten system notices: pay overdue, pay due, instalment due/failed/taken, passport problem, documents missing, tender watch, flight watch, check-in opens | Each is one notice; no escalation ladder, no snooze, no acknowledgement except the urgent chat path |
| Chat urgency (`ChatUrgentRetryService`, `urgentUnacked`, "Got it") | Retries an urgent chat message until acknowledged | Built for person-to-person chat, not yet used for reminders |
| Chat research section 15 (planned) | One inbox; lanes **critical, important, reminder, info, suggestion**; "Needs you" strip; supersede and expire; `Remind me later` reply; lock-screen redaction; fail-open direct push | Plan only |
| Push settings | Categories, quiet hours (default 22:00 to 07:00), do-not-disturb until a time, critical always on | Per notice category, not per reminder |

**Reading of the gap.** The system *notices* are reasonably complete. The guest's **own** reminders are a one-shot clock alarm with no list, no edit, no snooze, no repeat, no link to anything in the plan, and no honest account of what happens at sea with poor signal.

---

## 2. What guests actually want reminded

Grouped by who owns the reminder. The stage column says when it matters most (the 11 stages: Dream, Discover, Book, Manage, Prebook, Get to the ship, Embark, Sea, Port, Disembark, Remember). Priority: P0 must have, P1 should, P2 later.

### A. System reminders (the company or ship, from the guest's own facts; nobody has to ask)

| ID | Reminder | Stage | Lane | Pri | Today |
|---|---|---|---|---|---|
| REM-A01 | Final payment (14, 7, 3, 1 days; overdue) and instalment due, failed, taken | 4 | important; overdue and failed-near-date critical | P0 | Partly (7 and near, overdue) |
| REM-A02 | Documents or traveller details missing, per traveller with a due date | 4 | important | P0 | Count only |
| REM-A03 | Online check-in opens / not done; boarding pass not saved for offline | 6 | important | P0 | Opens only |
| REM-A04 | Travel day: flight status change, leave-for-the-terminal time | 6 | critical when it can cost the sailing, else important | P0 | Flight watch |
| REM-A05 | Boarding window and muster drill not confirmed | 7 | critical | P0 | Screens only |
| REM-A06 | **All aboard**: 120, 90, 60, 30, 10 minutes and the guest's own walking buffer; "tender" returns | 9 | critical | P0 | 120, 60, 30 on screen |
| REM-A07 | Reserved dinner, show, spa, excursion: **lead time before** (excursion: tomorrow evening and 90 minutes before meeting time; dinner: 60 minutes) | 5, 8, 9 | reminder | P0 | None |
| REM-A08 | Bag night, exit slot, final bill ready, customs form | 10 | important; bag night critical | P1 | Screens only |
| REM-A09 | Clock change overnight (ship time shifts) | 8, 9 | important | P1 | Hub copy |
| REM-A10 | Case update: Guest Services answered, a reply is due | 8, 10, 11 | important | P1 | Case notice |
| REM-A11 | Retention warning: a chat or photos will be deleted in 7 days | 11 | important | P1 | Plan |
| REM-A12 | Feedback requested, photos ready, next voyage | 11 | info or suggestion; never critical | P2 | Plan |

Rules: a system reminder is **derived from facts** (booking, programme, clock), so it can never disagree with them, it is **recomputed when a fact moves**, and it **stops when the need is gone** (paid, checked in, confirmed).

### B. Reminders the guest asks for (typed or spoken to Stanley, or from a button)

| ID | What the guest says | Kind | Pri |
|---|---|---|---|
| REM-B01 | "Remind me at 4:15 to be back" | **Clock**: a time today or on a named day | P0 (exists, narrow) |
| REM-B02 | "Remind me in 30 minutes to move the laundry" | **Relative**: from now | P0 |
| REM-B03 | "Tomorrow at 7am wake me for the excursion" | **Clock with a day**, ship time | P0 |
| REM-B04 | "Remind me an hour before the show" / "before my tour" | **Anchored** to a plan item; follows the item if it moves | P0 |
| REM-B05 | "Remind me to be back 45 minutes before all aboard" | **Anchored** to the all-aboard time; follows it | P0 |
| REM-B06 | "Remind me at 10pm each night to set out tomorrow's clothes" | **Repeating**: daily on this trip, ends at disembark | P1 |
| REM-B07 | "Remind me to take my tablets at 8am and 8pm" | **Repeating, private** (health text is sensitive; see section 6) | P1 |
| REM-B08 | "Remind me to call Mum when we reach Cozumel" | **Port-anchored**: the first hour after arrival in a named port (ship arrival time, port local time shown) | P1 |
| REM-B09 | "Remind me to leave the pool for lunch" | Clock | covered |
| REM-B10 | "Remind me to book the spa when check-in opens" | **Event-triggered**: fires when a fact becomes true (booking window opens, price changes) | P2 |
| REM-B11 | "Tell me when the next tender is free" / "tell me if the show is cancelled" | **Watch**: not a time reminder but a condition; handled by the change engine, listed here so Stanley can answer "I'll keep an eye on it" honestly | P2 |

### C. Reminders Stanley offers (suggestions, never silently added)

| ID | Moment | Offer | Pri |
|---|---|---|---|
| REM-C01 | The guest confirms an excursion or dinner | "Shall I remind you an hour before?" (one tap, defaulted to the standard lead time) | P0 |
| REM-C02 | Final payment date set / an instalment plan chosen | "Remind me a week before and the day before?" | P1 |
| REM-C03 | Ashore, guest plans a long stop | "Want a nudge 60 minutes before you need to head back?" Uses the walk time from the port pilot | P0 |
| REM-C04 | A sea day, free window and an unbooked dinner | "Dinner not booked yet; remind me at 3pm?" | P2 |
| REM-C05 | The guest snoozed the same reminder three times | "This keeps coming up. Move it, or drop it?" | P2 |

Offers sit in the **suggestion** lane, obey the proactivity level and the daily budget, and are never added without the guest's tap.

### D. Shared and supervised reminders

| ID | Reminder | Pri |
|---|---|---|
| REM-D01 | **Meeting time for a group**: "Meet at the atrium at 5:10." A group member proposes, each member confirms their own copy; nobody gets a reminder they did not accept | P1 |
| REM-D02 | **Guardian copy of a child's critical notices** (muster station, all aboard): arrives in the guardian's Stanley thread labelled with the child's first name (chat research 15.7). A child's own thread is notice-only | P0 |
| REM-D03 | **Helper-prepared reminder**: a helper can prepare a reminder for a guest to accept; it is never active until the guest confirms (extends the existing prepare-only helper path) | P2 |

### E. Gentle and wellbeing reminders (off by default)

Rest breaks, water, sun cream (the existing "Gentle reminders" day plan option), step-free-route timing. Opt-in per type, reminder lane, never medical advice; no tone of nagging; a quiet-hours-respecting default.

---

## 3. Creation: how a reminder is made

**REM-CR-01 Everyday words.** The server reads a request into one typed **reminder intent**: `when` (clock, relative, anchored to a plan item, anchored to all-aboard or to a port arrival, repeating, or an event), `text`, `who`. The browser does not parse time words. A model may help to read a phrase on the **small** tier; **a deterministic parser runs first** and the guest always sees the result before it exists.

**REM-CR-02 Preview before it exists.** Stanley shows the existing preview card: the text, the exact moment **in ship time with the weekday and date** ("Tomorrow, Wed 12 Nov, 7:00 ship time"), what it is anchored to, how it will be delivered, and Confirm / Change. Nothing is scheduled before Confirm; the existing idempotency, expiry and undo rules apply.

**REM-CR-03 Ask, don't guess.** An ambiguous time ("remind me later", "at 5") asks one short question with two buttons (for "at 5": today 5:00 PM / tomorrow 5:00 AM, only the one that is in the future). A past time is refused with the next possible one offered. A time more than the trip length away is refused.

**REM-CR-04 Time zones.** A reminder stores an **instant** plus the **zone it was meant in**. While aboard the zone is the ship's; at home or in a port the screen shows both when they differ ("4:15 PM ship time, 3:15 PM in Cozumel"). A clock change overnight moves a "7:00" wake-up with the ship (it stays 7:00 ship time) and the thread says so once ("Clocks go forward tonight. Your 7:00 reminder is still 7:00 ship time"). An anchored reminder recomputes when its anchor moves.

**REM-CR-05 Anchored reminders follow.** If the tour, show or all-aboard time moves, the reminder moves with it and Stanley posts one info message: "Your reminder moved to 3:30 because the tour now starts at 4:30." If the anchor is cancelled, the reminder is cancelled and the guest is told, with an offer to keep it as a plain clock reminder. It is never silently dropped.

**REM-CR-06 Where reminders can be made.** The Stanley thread (typed or spoken), a **Remind me** button on a plan item, a dinner, an excursion, a port day and any Stanley card, and the "Remind me later" reply on any notice (REM-SN-01). All use the same server service.

**REM-CR-07 Limits.** At most 25 active reminders per guest and 10 repeating; text 80 characters, no links or markup; a reminder at most one trip long; a minimum gap of one minute between two firings of the same reminder. Reaching a limit gets a plain refusal naming what to remove.

**REM-CR-08 Not a reminder.** Stanley refuses to schedule anything that is not a note to the guest: it will not remind someone else, send a message, book, pay or cancel. Medical wording is stored but never interpreted (section 6).

---

## 4. Lifecycle

```
scheduled -> due -> delivered -> acknowledged
                 \-> snoozed -> due ...            (not for critical)
                 \-> late -> missed                (nobody saw it)
scheduled -> superseded | cancelled | no longer needed
```

| State | Meaning | What the guest sees |
|---|---|---|
| scheduled | Waiting for its moment | In **My reminders** with the moment and anchor |
| due | The moment has arrived; delivery is under way | A message in the thread (below) |
| delivered | Reached the guest by at least one route | Message plus the route shown on tap ("Sent to your phone at 4:15") |
| acknowledged | Guest tapped **Got it** or **Done**, or acted on it | Collapses to a one-line record |
| snoozed | Guest asked for it again | "I'll remind you again at 4:25" |
| late | Past its moment and not yet delivered or seen | Delivered with the word "Late" and the real time |
| missed | Past its useful window, never acknowledged | Posted once as a summary line; stays in **Needs you** only if still useful |
| superseded | A newer one of the same occasion replaced it | "Replaced by a newer message at 3:10", no action |
| no longer needed | The need is gone (paid, checked in, plan item dropped) | "No longer needed", no action |
| cancelled | The guest removed it | Gone from the list; a one-line record in the thread |

Each reminder has a **useful window** by kind (for example: all-aboard 10 minutes after the moment is still useful until the ship sails, a dinner reminder is useful until the dinner time, a clock reminder for 4 hours, a daily reminder until the next day's occurrence). Past its window a reminder is **lapsed**: it is no longer sent as an alert, and appears only as a quiet "You missed this one" line.

---

## 5. When it comes due: how the guest is told

This is the core of the document. Principle from chat research 15.4: **the thread is the inbox and the push is the doorbell**; safety-critical facts also stay on their own screen and go out as a direct push if the thread write fails.

### 5.1 Delivery ladder (by lane)

| Step | Critical (all aboard, muster, travel that can cost the sailing, instalment failure near date) | Important (payment, documents, check-in, reservation) | Reminder (dinner, tour lead time, guest's own reminders) |
|---|---|---|---|
| 1. In the thread | At once, **top of "Needs you"**, urgent style | At once, in "Needs you" | At once, normal style |
| 2. App open | In-app **pop-up with Got it** (the existing urgent pattern), spoken to a screen reader as an alert | Banner, polite announcement | Banner, polite announcement |
| 3. App closed | **Phone push** immediately; fail-open direct push if the thread cannot be written | Push, within quiet hours | Push, within quiet hours (see 5.3 for the guest's own) |
| 4. No response | **Retry**: 2 and 5 minutes after, then at the next lead time (all aboard: 60, 30, 10) until Got it or the occasion passes | One follow-up next morning (if the due date is still ahead) | None; one "missed" line later |
| 5. Last resort | **SMS** (critical always allowed by notification settings) if the guest set a phone number and the SMS bridge is on | None | None |
| 6. Record | Acknowledgement kept as today's urgent-ack and muster records | Quiet record | Quiet record |

**REM-DL-01** Every reminder produces **exactly one thread message per occasion** (stable key per reminder and firing), so a retry never duplicates it. A retry **updates** the message ("Still due. All aboard in 30 minutes") and re-notifies.
**REM-DL-02** The message states **what, when in ship time, why now, and one action**: "Be back on board by 4:30 PM. All aboard is in 45 minutes. [Got it] [Open port plan] [Remind me in 15]".
**REM-DL-03** The notification count on the Chat tab and the app icon reflects **unacknowledged** critical and important reminders, not every message.
**REM-DL-04** Lock-screen text follows `PushRules.Redact`: a guest's own reminder text is **redacted by default** ("Stanley: your reminder") with the detail only in the open thread; all-aboard and muster stay plain because they are safety facts and contain no personal data.
**REM-DL-05** Sound and vibration use the system's defaults for each lane; critical has a distinct but not alarming pattern. Nothing animates for attention and reduced motion is respected.

### 5.2 Honest delivery at sea

A phone at sea often has no signal and ship Wi-Fi is patchy. A web app installed as a PWA **cannot promise that a locally scheduled alarm fires while closed**. So:

**REM-DL-06** Reminders are held on the **server** and sent by a **server clock**, not only when the app calls in (moves the evaluation described in chat research 0b). The server pushes at the due moment.
**REM-DL-07** The guest's phone also keeps a **local copy** of their next 24 hours of reminders (with the app's saved-copy loader), used to show a due reminder **the moment the app is opened or regains signal**, with the true time ("4:15 PM, shown 4:40 PM because you were offline").
**REM-DL-08** At creation, when the guest is aboard or offline-prone, Stanley states the limit **once**, plainly: "I send reminders to your phone when it has signal. If you may be out of signal, I also keep a copy to show when you reopen the app. For a deadline you cannot miss, set your phone's own alarm too." A **Add to my phone's calendar** option (an `.ics` download with an alarm) is offered for the P0 guest reminders as the offline-proof route.
**REM-DL-09** All-aboard and muster reminders never rely on a phone alone: the ship's announcements and signage are unchanged, and the thread says nothing that suggests it replaces them.
**REM-DL-10** Delivery is never described as guaranteed. Wording on a reminder past its moment: "Late" plus the actual time sent.

### 5.3 Quiet hours, do-not-disturb and the guest's own reminders

| Situation | Rule |
|---|---|
| Critical | Bypasses quiet hours, do-not-disturb, calm mode and the budget. Small published list under change control |
| A guest's **own** timed reminder | **Delivered at the time asked**, even inside quiet hours, because the guest chose that time. At creation, if it falls in quiet hours, Stanley says so and offers "Send it then" or "Move to 7:00". Do-not-disturb holds it to its end unless it is also tied to a deadline |
| Important and system reminders | Held to the end of quiet hours, then sent; shown in the thread immediately without a push |
| Suggestions and offers | Within quiet hours and the daily budget; never bypass |
| Calm mode / simple mode | Critical only plus the guest's own reminders |

### 5.4 Snooze, done and "remind me later"

**REM-SN-01** Every non-critical reminder offers **Remind me in 15 minutes / 1 hour / this evening / tomorrow morning** and **Done**. A snooze never passes a deadline: "Remind me in 1 hour" is refused with an explanation if the useful window ends sooner ("Dinner is in 40 minutes").
**REM-SN-02** **Critical reminders cannot be snoozed**, only acknowledged. A guest can ask Stanley for a **personal buffer** instead (e.g. "alert me 15 minutes earlier than the standard times") stored in memory and applied to all-aboard.
**REM-SN-03** At most three snoozes; at the third Stanley offers to move or drop it (REM-C05).
**REM-SN-04** **Done** from any device clears it everywhere; the acknowledgement syncs through the server.

### 5.5 Lapse and no-longer-needed

**REM-EX-01 Missed.** A reminder past its useful window and never acknowledged becomes **missed**. It is posted once as a quiet info line in the thread ("You asked me to remind you at 4:15 to be back. It reached you after you'd boarded."), not pushed, and removed from **Needs you** if it no longer matters.
**REM-EX-02 Late but useful.** Sent late inside its window: marked **Late** with the real time; the action stays.
**REM-EX-03 No longer needed.** Paid, checked in, plan item dropped, trip ended: the message collapses to "No longer needed" and loses its action. The guest is **told why** in one line.
**REM-EX-04 Superseded.** A newer time replaces the older message, which reads "Replaced by a newer message at 3:10".
**REM-EX-05 End of trip.** At disembark all trip-scoped reminders end with one summary ("Your 3 daily reminders ended with the cruise"). Repeating reminders never carry onto the next sailing unless the guest recreates them.
**REM-EX-06 Retention.** Reminder rows are deleted `Retention:StanleyDays` (180) after they were due, as today; the thread keeps the one-line record under its retention rule; no reminder text is ever logged.

---

## 6. Privacy, safety, children, accessibility

- **Sensitive text.** A reminder may hold health, medication or access wording typed by the guest. It is the guest's alone, never sent to a model **except** to read the time phrase on the small tier with the text removed where possible; never shown on a lock screen; deleted with the account; not used for suggestions or offers. Stanley never gives medical advice and never says a reminder "makes sure" a medicine is taken: "I'll send you a note at 8:00."
- **No impersonation.** A reminder is always from Stanley as the guest's own note, labelled "Your reminder", distinct from company and ship notices ("From Sun Princess").
- **Anti-phishing line.** The thread's pinned note still applies (the company never asks for card, passport or password in chat); a reminder never contains a link other than into the app.
- **Children.** A supervised child's thread is **notice-only** (chat research 15.7): no guest reminders, no suggestions. All-aboard and muster for the child are also delivered to the guardian. A guardian can see what was sent to the child.
- **Helpers.** A helper can only prepare a reminder (REM-D03); the guest confirms.
- **Accessibility (WCAG 2.2 AA).** Messages and pop-ups are real, focus-managed controls; a due reminder is announced by a status role (polite) or alert role (critical); **Got it**, **Done** and the snooze options are buttons with visible focus and 44px targets; nothing relies on colour or sound; reminder times are read in full ("4:15 PM, ship time, Wednesday") by screen readers; the **My reminders** list is keyboard-operable; reduced motion respected; text zoom to 200% does not clip actions.
- **Honest wording.** No false urgency; "Last chance" only with a real, sourced deadline.

---

## 7. Where the guest sees and manages reminders

| Surface | What |
|---|---|
| The Stanley thread | Each firing as a message; the **Needs you** strip for unacknowledged critical and important items; reply chips (**Got it**, **Done**, **Remind me in...**, **Why?**) |
| **My reminders** (one screen, from the thread header and Settings) | Upcoming, repeating and recently missed, with the delivery route and the anchor; edit time, text and lead time; delete; **Pause all non-critical for today** |
| Plan items, dinners, excursions, port day | A **Remind me** control with the default lead time and a clear on/off state |
| Home / stage Next steps | The next due system reminder as the Next step (the Next step and its notice are the same item) |
| Settings, **Stanley notices** | Categories (my reminders, payment, documents, check-in, reservations, gentle), quiet hours, do-not-disturb, personal all-aboard buffer, SMS for critical, calendar export |

---

## 8. Measures

| Signal | Target | Review when |
|---|---|---|
| Critical reminder in the thread and pushed within 10 seconds of its moment (app closed or open) | 95% | Below 90% over a day |
| A guest's own reminder delivered within 60 seconds of the asked time | 95% | Below 90% |
| Duplicate messages for one firing | Zero | Any |
| Reminders delivered "late" because the phone had no signal | Reported | Rising share after launch |
| Missed (never acknowledged, window passed) share by kind | Tracked | A kind over 20% |
| Snooze three-times rate | Reported | Over 10% of reminders (lead time wrong) |
| Reminders created that Stanley previewed with the wrong time (guest hit Change) | Under 5% | Over 10% (the parser is weak) |
| Opt-out of reminder push after launch | No rise | Rise of 2 points or more |
| Reminder text on a lock screen unredacted | Zero | Any (hard stop) |

---

## 9. Phases (commit and stop after each; the server code is written with tests and run by the owner)

Order (decided): R1, R2, then R3 built against the mock sender but **released only with real push**, then R4, R5, R6. In the wider plan R1 and R2 are phase P2a and R3 is P2b.

| Phase | Scope | Done when |
|---|---|---|
| **R1: Smarter creation** | Reminder intent model; deterministic time parser on the server (relative, "tomorrow", weekday, "in an hour"); preview in ship time with date and zone note; ask-don't-guess; limits; `GET/DELETE /me/stanley/reminders` and **My reminders** list | "Remind me in 30 minutes", "tomorrow at 7" and a deleted reminder all work from the thread and the list |
| **R2: Anchors** | Anchored kinds (plan item, all aboard, port arrival); recompute when the anchor moves; "reminder moved" and "cancelled because" lines; the **Remind me** control on plan items and Stanley's offers (REM-C01, C03) | Moving a tour in the plan moves its reminder and tells the guest |
| **R3: Delivery ladder** | Server clock (not only on app call); one-message-per-firing key; Got it and snooze; retry rules for critical and important; late, missed, no-longer-needed, superseded states; lane rules and quiet-hours behaviour in 5.3; calendar (`.ics`) export | A closed-app reminder arrives as one message and one push; ignoring a critical one triggers the retries |
| **R4: System reminder set** | Escalation ladders for REM-A01 to A09 (payment, documents, check-in, travel, muster, all-aboard, reservation lead times, bag night, exit slot) mapped into lanes; the "Needs you" strip; personal all-aboard buffer; the Chat tab count | Each system reminder appears at its lead times, stops when the need is met |
| **R5: Repeating, private and shared** | Daily repeats, sensitive-text handling and redaction, group meeting reminders each member accepts, guardian copies | A daily 10pm reminder runs to disembark and ends with a summary; a guardian receives the child's all-aboard |
| **R6: Offline and polish** | 24-hour local copy with true "shown at" times, the sea-signal wording, SMS for critical, accessibility pass, metrics and kill switch per lane | Offline open shows due reminders with their real time; all measures in section 8 are reported |

---

## 10. Decisions

**Decided by the owner (2026-11-10):**

1. **No "AI" wording anywhere in the guest-facing UX.** A reminder, notice or card shows Stanley's picture and name (and "Your reminder" or the persona subtitle) and never an "AI" label, badge or sentence. This overrides the AI-label wording in `docs/chat-features-research.md` and `docs/chat-stanley-plan.md` (see the notes added to them). Honesty is kept without the word: Stanley says "automatic notice" for system messages, names a person when a person wrote it, and never claims to be a crew member.
2. **A guest's own reminders fire at the time asked, even in quiet hours (5.3),** with a one-line note at creation ("That is in your quiet hours. I will still send it") and the choice to move it.
3. **Server check:** the owner will build and run the Stanley server tests before the delivery work (R3).

**Decided on my judgement (change if wrong):**

4. **Order.** R1 (creation, list) and R2 (anchors) need no real push, so they come **first**. R3 (the delivery ladder) is built next against the mock sender, but it is **not released** until real push keys and a real sender are in place (a deployment step the owner must schedule).
5. **SMS for critical reminders:** last resort for all-aboard and muster only, only to a verified phone number the guest has chosen to use for notices.
6. **Groups (REM-D01):** each member confirms their own copy; the organiser cannot set a reminder for others.
7. **Calendar export:** included in R3, as the only offline-proof route.
8. **Repeats:** daily repeats are in R5, ending at disembark.
9. **Stanley-added reminders (REM-C):** always a one-tap offer, never added silently.

**Still open:** none that blocks R1.

---

## 11. Requirement index

REM-A01 to A12 (system), REM-B01 to B11 (guest-asked), REM-C01 to C05 (Stanley-offered), REM-D01 to D03 (shared and supervised), REM-CR-01 to 08 (creation), REM-DL-01 to 10 (delivery), REM-SN-01 to 04 (snooze), REM-EX-01 to 06 (lapse and expiry).
