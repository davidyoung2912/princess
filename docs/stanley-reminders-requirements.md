# Stanley reminders: deep-dive requirements

Status: **draft for review (2026-11-10), expanded the same day after owner feedback round 2: reminders become a core feature of the whole app, with a deep dive on all 11 stages** (sections 11 to 43, which supersede parts of sections 2, 3, 5, 9 and 10 where marked). Nothing here is built. It expands the "reminders" feature through the permanent 1:1 Stanley chat (`docs/chat-features-research.md` section 15): which reminders a guest wants, how they are created, and above all **how a guest is told when one comes due, runs late or lapses**. It is the detailed companion to `docs/stanley-actions-and-proactive-plan.md`.

Follows `CLAUDE.md`: thin client (the server owns reminders so they follow the guest between devices), English only, the backend mocks every external service behind an interface, WCAG 2.2 AA, phases that commit and stop, checks are `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` only.

"Expiry" is used in two senses below and both are specified: **due** (the moment a reminder is meant to fire) and **lapse** (a reminder nobody saw, or one that no longer matters).

---

## 1. What exists today

| Piece | What it does | Limit |
|---|---|---|
| `remind_me` action (`StanleyActions.cs`, `stanleyAction.ts`) | "Remind me at 4:15 to be back" becomes a previewed, confirmed action | Regex-parsed clock time only (`HH:MM`), on the guest's current day, ship zone; text up to 80 characters. No "in 30 minutes", no "tomorrow", no "before my tour", no repeat |
| `dbo.StanleyReminders`, `StanleyReminderService` | Server copy of the reminder; due ones go out in the existing push run as a `reminder` notice (category `checkin`, skips budget and quiet hours, not a switched-off channel) | The push sender is still the mock; real VAPID keys are a deployment step. Evaluation runs inside `/me/push/dispatch`, which the app calls **and** the `WatchSchedulerService` calls every 15 minutes for up to 500 people per pass (verified in section 30), so there is a server clock but it is coarse: a reminder can be up to 15 minutes late |
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

**REM-CR-07 Limits.** *(Superseded by section 25.4: the server today allows 10 pending; the new limits separate the guest's own, Stanley's and the trip's automatic reminders.)* At most 25 active reminders per guest and 10 repeating; text 80 characters, no links or markup; a reminder at most one trip long; a minimum gap of one minute between two firings of the same reminder. Reaching a limit gets a plain refusal naming what to remove.

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

## 9. Phases (round 1; superseded by section 26)

Order (decided in round 1; **superseded by section 26**): R1, R2, then R3 built against the mock sender but **released only with real push**, then R4, R5, R6. In the wider plan R1 and R2 are phase P2a and R3 is P2b.

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

**Still open:** none that blocks R1. *(Round 2 adds the open questions in section 28.)*

---

---

## 11. Owner feedback round 2: reminders as a core feature of the whole app

**The feedback (2026-11-10).** Reminders have super powerful potential. Everyone needs to be reminded of things all the time, so make this a **core feature of the app**. Increase the scope, go deep on **all 11 stages** and document which reminders suit each, and push the boundaries of what can be done.

### 11.1 Findings from the deep dive

**What the code says today** (read, not run; the earlier warning that the server code has never been compiled or run here still applies):

| # | Finding | Where | Consequence for the design |
|---|---|---|---|
| 1 | The guest's own reminder is a **clock time only**, within the next 24 hours, ship zone, up to 10 pending, 80 characters, and **expires 12 hours after it was due** | `StanleyReminderRules` (`MaxPending = 10`, `LateHours = 12`, `NextDue`) | Every one of the 11 stages needs more: days ahead (payment, passport), relative ("in 30 minutes"), anchored, repeating, and a **useful window per kind**, not one flat 12 hours |
| 2 | System reminders are computed **on the device while the app is open** (pay at 7 days, check-in the day before and on the day, all-aboard at 120, 60 and 30 minutes) and say they are not a background alert | `localReminders.ts` | The company's most important reminders are the least reliable. They must move to a **server clock** and become real firings with a delivery record |
| 3 | **Corrected after the code check (section 30):** a server clock **does** exist: `WatchSchedulerService` runs the same dispatch every 15 minutes for up to 500 people per pass under a database lock. It polls people, not due times, and is too coarse for "within 60 seconds" or "within 10 seconds". The push sender is still a mock | `WatchSchedulerService`, `PushService.DispatchAsync` | R3 adds a **due-queue** beside it (precision and scale) and migrates the dispatch to it; the poll stays as a safety net. Shared with the standing rules in `stanley-actions-and-proactive-plan.md` (its P2c) |
| 4 | **Corrected after the code check:** a **live subscribable calendar feed already exists**: `CalendarFeedService`, `GET/POST/DELETE /me/calendar-feed`, `GET /calendar/{token}`, a hashed 43-character token, revoke, and **`VALARM` alarms** already written by `CalendarRules.Build`. It carries only the sailing, check-in, final payment and sail-away. The front end also has `buildIcsCalendar` | `CalendarFeedService.cs`, `CalendarRules.cs`, `src/domain/calendar.ts` | R5 **extends** the existing feed with reminder-level entries, alarms per class, sequence numbers and a private-text exclusion; it does not build a feed |
| 5 | A separate **"Remind me in a week" email** exists for guests deciding on a sailing (small delights DL5, signed unsubscribe link) | `ReminderRules.cs` | Two reminder systems already exist. Unify under one engine, keep the email as a delivery channel and its signed one-click unsubscribe |
| 6 | Reminder **thresholds are constants** (`REMINDER_THRESHOLDS = 120, 60, 30`) on the device. **Leave-by already exists on the server:** `AwayRules.LandingByMs` (all aboard less buffer, queue and walk; default buffer 45 minutes, gate walk 15, pier queue 15, tender queue 25, last tender), a guest `alertBefore` setting (default 45) and "head back" notices (with a text to a verified phone for a guest who is away) | `allaboard.ts`, `AwayRules.cs`, `PushService.cs` | It is one pace for everyone. A slow walker, a guest in a wheelchair and a family need **different** values (section 17); the server rule is the base to extend |
| 7 | Push has **categories, quiet hours, do-not-disturb, a daily budget and a critical bypass**, plus email and SMS as channel choices, **a delivery log with an `Acked` flag, an acknowledge endpoint (`/me/push/ack`) and an unacknowledged-safety-alert fallback** (COM-04: after 10 minutes, once, by text to a verified phone or else email to a verified address; stale after 3 hours) | `PushRules.cs`, `PushService.cs` | More of the ladder exists than the first draft said. Missing: **per-class ladders, the repeat steps before 10 minutes, more than one fallback, per-reminder acknowledgement and snooze** |
| 8 | Chat urgency already **retries until acknowledged** (`ChatUrgentRetryService`, a hosted service) | `ChatUrgentRetryService` | Reuse the pattern and its acknowledgement store for critical reminders |
| 9 | The all-aboard time is **identical for every guest on the ship** | itinerary | A ship of four thousand guests has reminders due in the **same second**. This is a fleet-scale burst (section 25.3), not a per-guest problem |
| 10 | No plan item, dinner or excursion carries a **Remind me** control; no screen lists the guest's reminders | screens | Reminders are invisible to the guest until they fire |
| 11 | **PWA limits are real:** web push on iPhone works only for an installed Home Screen app (iOS 16.4 and later) and only after permission; the Badging API arrived with it; Safari 18.4 added declarative web push; **notification action buttons on iOS and the EU status are unconfirmed** and must be tested on devices before they are relied on (section 30). A closed page cannot schedule its own alarm. The service worker (`push-sw.js`) already shows notifications, keeps critical ones on screen, tags and re-notifies, and opens the right screen on tap; it has **no action buttons, no badge and no share target** | platform, `push-sw.js`, manifest | Delivery must be honest, tested per device state, and backed by channels that do not depend on the browser (SMS, email, **the phone's own calendar**) |
| 12 | The doc's 8 delivery rules are right but cover only the *firing*. Missing: **permission journey, a delivery self-test, burst handling, per-class ladders, lock-screen actions, app badge, nag-until-done, feed to the phone calendar, ship-side channels** | this document | Section 16 |

**What the first round got right and stays:** the lifecycle states, the lane ladder, one thread message per firing, "Late" honesty, critical cannot be snoozed, no "AI" wording, guest reminders firing in quiet hours, redaction on the lock screen.

### 11.2 The idea: reminders are the app's spine

A cruise is a long sequence of deadlines, appointments and small tasks across **months** (payments, documents, check-in) and then **days** (all aboard, muster, dinner, tour, bags), then **memories** (feedback, credits, photos). Every feature already holds the facts; none of them tells the guest *when it matters to them*. The reminder engine turns every dated fact in the app into a **timed, explained, actionable, acknowledgeable nudge** that works across devices and, as far as the platform allows, with no signal.

> **One engine, many sources.** Payments, documents, check-in, the day plan, dinners, shows, tours, polls, cases, packing, tips, bags, photos, feedback, the guest's own words and Stanley's offers all produce reminders through the same service, the same ladder, the same screen and the same record.

That is what makes it core: any screen can say **Remind me**, any date can **become** a reminder, and the guest has one place to see and trust all of them.

### 11.3 Principles (added to the round 1 rules)

1. **Derived, not duplicated.** A system reminder is computed from the fact that causes it (a booking, a plan item, the programme, the clock). When the fact moves, the reminder moves; when the need ends, it ends. Nothing is typed twice.
2. **Three owners, one list.** *Yours* (the guest created it), *Trip* (automatic from the booking and ship, switchable by kind except safety), *Added by Stanley* (an offer the guest accepted or a rung 4 act under AUT-02, with who added it and why). The guest sees all three in one list with the owner on each row.
3. **Safety is never only a reminder.** All-aboard, muster and travel-day cut-offs remain on the ship's own screens and announcements; the reminder is an aid and says so.
4. **Every reminder knows its useful window, its stop condition and its next best channel.**
5. **Honest about delivery.** No promise that a phone alarm fires. Every guest can test their own delivery path and see which channels are live.
6. **Calm by design.** Reminders obey the arbiter (a roll-up, a daily budget, a dedupe), the guest's quiet hours (with the guest's own timed reminders as the stated exception) and calm mode. Volume is a design target (section 22), not an accident.
7. **Guest-controlled intensity.** Per kind, per stage, per lane: more (nag until done, earlier, more channels), less (once, in the thread only) or off. Critical is the only thing that cannot be switched off, and it is a short, published list.
8. **Private by default.** Health and access wording, and any reminder the guest marks private, never leaves the account, never reaches a lock screen or a calendar feed unless the guest includes it.
9. **No commercial pressure.** A reminder is never a sales nudge. Offers stay in the suggestion lane under the guest's level, and "last chance" appears only with a real sourced deadline.
10. **A reminder never acts for the guest.** It can **open** the right screen or **prepare** the right action (rung 2); it never pays, cancels, books or messages by itself. (A guest at level 4 can allow Stanley to *create* reminders, AUT-01 and AUT-02, which is a different thing.)

### 11.4 The reminder object (one model for everything)

Every reminder, whatever its source, is the same typed record on the server. The screens render what it says (thin client).

| Field | Meaning | Example |
|---|---|---|
| **Source** | `guest`, `trip` (automatic), `stanley` (offered, accepted), `stanley-auto` (AUT-02), `group`, `helper`, `ship` (content team) | trip |
| **Audience** | Whose reminder: one account, a guardian for a child, a group member's own copy | the guest |
| **Purpose** | do, be-there, deadline, bring, check, rest and wellbeing, social, money, memory, safety (section 12.2) | be-there |
| **When** | a typed spec: `clock`, `relative`, `anchored(item, offset)`, `repeating(rule, until)`, `event(fact)`, `conditional(fact, then)`, `sequence(after reminder)` | anchored to all-aboard minus 45 minutes |
| **Zone** | the zone it was meant in; shown with the other when they differ | ship time |
| **Lane and class** | critical, important, reminder, info, suggestion; and a **ladder class** (section 16.4) | critical, class A |
| **Useful window** | until when a late firing is still useful; after that it lapses | until the ship sails |
| **Stop condition** | the fact that ends it | guest is aboard (scanned) |
| **Text** | up to 80 characters, plain, or a template key with typed parameters for system reminders | "Be back on board by 4:30 PM" |
| **Actions** | Got it, Done, Snooze (non-critical), Open (a screen), Prepare (an action), Undo | Open port plan |
| **Privacy class** | normal, private (never on a lock screen or in the calendar feed), safety (plain on the lock screen) | safety |
| **Delivery plan** | the ladder for its class, the guest's overrides, and channels tried | push, retry at 60 and 30 |
| **Provenance** | what fact it was made from, as of when, and who created it | itinerary, as of 10:42 |
| **State** | the lifecycle in section 4 | scheduled |

### 11.5 Where it lives in the app (so a core feature is easy to find and trust)

| Surface | Role | Decision |
|---|---|---|
| **The Stanley thread** | The inbox and the doorbell (unchanged). Reminders arrive as messages with action chips | exists in plan |
| **Reminders sheet** (new): a bell in the top bar, beside Help and Search, **with a badge** of unacknowledged critical and important reminders | One tap from any screen to: **Needs you**, **Next up**, **Today**, **Later**, and **Add a reminder**. A focus-trapped sheet that closes on Escape; also a full page from Me | **Open decision (section 28, question 1):** a third always-on top-bar control changes the shell from the stage plan, so it needs your yes |
| **Remind me, everywhere** (new) | A standard **Remind me** action on every plan item, dinner, show, excursion, port day, payment, document, deadline, poll, chat message, case and Stanley card, using the default lead time for that kind and one tap | A shared component |
| **Home: Next up** | The next due reminder is the stage's Next step (the Next step and its notice are one item) | extends stage Home |
| **Settings, Stanley notices** | Kinds, lanes, quiet hours, delivery check, personal buffers, nag, SMS, email, calendar feed | extends section 7 |
| **Phone calendar** (new) | A live, private **calendar feed** the guest subscribes to, so the phone's own alarms fire with no signal (section 16.7) | new |
| **App badge** (new) | `navigator.setAppBadge` with the count of unacknowledged critical and important items, where the device allows | new |

---

## 12. The taxonomy: every kind of reminder, in one table

### 12.1 By how it is triggered (the **When**)

| Trigger | Meaning | Example | New or exists |
|---|---|---|---|
| **Clock** | A time on a day | "Tomorrow 7:00" | Exists (today only) |
| **Relative** | An interval from now | "In 30 minutes" | New |
| **Anchored** | Offset from a plan item, a dining slot, a show, a tour, **all aboard**, a port arrival, a flight, check-in opening, sail-away, a deadline | "An hour before the show" | New |
| **Ladder** | A set of anchored times for one deadline | Final payment: 30, 14, 7, 2 days, the day | Partly (7 and near) |
| **Repeating** | Every N hours or at set times, ending at a time, a day or disembark | "Every night at 10" | New |
| **Event** | When a fact **becomes true** | "When check-in opens", "when the tender starts", "when a table opens" | New |
| **Conditional** | An event plus a condition | "If it rains tomorrow, remind me to pack the poncho" | New |
| **Sequence** | After another reminder is done | "After muster, remind me about dinner" | New |
| **Leave-by** | Computed from distance, walking pace, tender, traffic and the guest's buffer | "Leave for the pier at 3:50" | New (uses `portPilot`) |
| **Nag** | A chosen persistence: repeat until Done, at most N times | "Keep reminding me until I confirm" | New |
| **Check-back** | A reminder that asks a follow-up | "Did you take it? Yes / Not yet" | New (private) |

### 12.2 By purpose (what the guest is being asked to do)

| Purpose | Intent | Examples |
|---|---|---|
| **Do** | Complete a task | Upload a passport, order towels, pay |
| **Be there** | A time and place | All aboard, muster, the tour meeting point, dinner |
| **Deadline** | A date after which it costs money or access | Final payment, check-in cut-off, dining freeze, bag night |
| **Bring** | Items to carry | ID and ship card ashore, swimwear, passport copy, meds in the carry-on |
| **Check** | Verify something | The bill, tags on bags, the safe before leaving |
| **Rest and wellbeing** | Gentle, opt-in | Water, sun cream, a rest after a long port day |
| **Social** | People | Call home, meet the party, message a friend when Wi-Fi is available |
| **Money** | Spending and credit | Tip decision, unused credit, spend pace, settle up with a friend |
| **Memory** | Capture and recall | Photos, feedback, a thank-you, an anniversary |
| **Safety** | Protect the guest | Muster, tender delays, port safety advisories, medication times (private) |

### 12.3 By source

| Source | Who sets it | Who can switch it off |
|---|---|---|
| **Guest** | The guest, by words or a button | The guest |
| **Trip** (automatic) | The booking, programme and clock | The guest, by kind (not critical) |
| **Stanley** (offered) | Stanley offers; the guest accepts | The guest |
| **Stanley auto** (AUT-02) | Stanley, under the guest's level 4 switch | The guest; labelled "Added by Stanley" |
| **Group** | A member proposes; each member accepts their own copy | Each member |
| **Helper** | A helper prepares; the guest confirms | The guest |
| **Ship** | The content team (per ship or port packs, section 14) | The guest, by pack |

### 12.4 The expanded catalogue (additions to section 2)

Section 2 stays. These are **new** kinds the deep dive adds; the per-stage lists in section 13 use these IDs where they apply.

| ID | Kind | What it does | Trigger | Pri |
|---|---|---|---|---|
| REM-E01 | **Leave-by** | "Leave now to be back by 4:30" from walk time, tender and the guest's own buffer; updates when conditions change | Leave-by | P0 |
| REM-E02 | **Bring list** | A reminder carrying a small tick-list ("passport copy, ship card, sun cream") the guest ticks in the card | Anchored | P1 |
| REM-E03 | **Ladder with consequence** | Each step says what happens if missed ("After 12 Jan the fee is $420") | Ladder | P0 |
| REM-E04 | **Conditional weather** | A reminder only if the forecast meets a condition | Conditional | P2 |
| REM-E05 | **Sequence** | A chain of two or three steps for an occasion (muster, then dinner, then the show) | Sequence | P2 |
| REM-E06 | **Check-back** | "Did you do it?" with Yes or Not yet; Not yet re-asks once | Check-back | P2 |
| REM-E07 | **Nag until done** | Guest-chosen persistence, at most 5 repeats, gentle wording | Nag | P1 |
| REM-E08 | **Quiet pre-alert** | A silent in-thread note 10 minutes before a loud one, so nothing arrives as a surprise | Anchored | P2 |
| REM-E09 | **Roll-up** | Several reminders in the same window as one card ("Before dinner: 3 things") | Arbiter | P0 |
| REM-E10 | **Time-zone change warning** | Before a clock change and before a port whose clock differs from ship time | Event | P1 |
| REM-E11 | **Credit and expiry** | An unused credit, an expiring photo link, a future-cruise credit with its real date | Deadline | P1 |
| REM-E12 | **Wake-up** | A wake-up reminder and an offer to prepare a ship **wake-up call** request (rung 2) | Clock | P1 |
| REM-E13 | **Occasion** | Birthdays, anniversaries, first time at sea, one year on | Clock | P2 |
| REM-E14 | **Phone-calendar copy** | The same reminder appears in the guest's phone calendar feed with an alarm | Feed | P0 |
| REM-E15 | **Pack** | A set of reminders added together (section 14) | Pack | P0 |
| REM-E16 | **Shared card** | A reminder the guest sends as a calendar file through the phone's share sheet (a guest action, not a Stanley message) | Share | P1 |
| REM-E17 | **"Remind me about this"** | On any message, post, card or plan item; the message itself is not copied, only an 80 character label the guest can edit | Anchored | P0 |
| REM-E18 | **Voice reply** | "Snooze 15" or "Done" spoken to the thread | Speech | P2 |

---
## 13. Per-stage deep dive: which reminders suit each of the 11 stages

**How to read it.** Stages and tabs are from `docs/stage-experience-plan.md` 5.1. Each stage has: the **guest's job** at that stage; the **trip (automatic) set** the guest gets by default; **guest-asked examples** Stanley must handle; **Stanley offers**; and **pushing the boundary** ideas. Rows have an ID `RS-<stage>.<n>`. **Lane** is critical (C), important (I), reminder (R), info (N) or suggestion (S). **Stops when** is the fact that ends it. **Needs** names a gap that must exist first (the scheduler, section 25, is needed by all). The last column is the **priority**: P0 is the first release, P1 the second, P2 the third (section 32). Default for a row is **on** for C and I, **on** for R the guest created, **off until asked** for S. P0, P1, P2 as before. Lead times are defaults; the guest can change them and a personal buffer applies (section 17).

### 13.1 Dream (Explore, Ask)

**Guest's job:** decide whether to cruise and with whom. **Tone:** the lightest touch of all; there is nothing to lose yet, so no deadlines and no pressure.

| ID | Reminder | When | Lane | Stops when | Needs  Pri |
|---|---|---|---|---|---|---|
| RS-1.1 | **Come back to this.** "Remind me in a week" as an in-app item **and** the existing signed email, one engine | Relative, chosen by the guest | S | The guest saves a sailing or turns it off | Unify with DL5 | P1 |
| RS-1.2 | **Decide by.** A date agreed with a partner on the dream board; each member accepts their own copy | The decide-by date minus 2 days, and the day | R | The sailing is saved or the board closes | Group reminder (REM-D01) | P2 |
| RS-1.3 | **Price moved** on a favourite, one line with the reason | Event (fare change) | S | The guest opens it or the favourite is removed | Mock fare feed | P2 |
| RS-1.4 | **Passport check before you fall in love.** When a sailing is saved: "Does everyone's passport last 6 months past the return?" | Once, on first save | N | Acknowledged | Document rules | P2 |
| RS-1.5 | **Quiz unfinished.** One nudge a day later, never more | Relative | S | Finished, or one nudge sent | Quiz state | P2 |
| RS-1.6 | **Occasion start.** "Your anniversary is in 4 months. Look at cruises?" from a date the guest gave | Clock, optional | S | Dismissed once | Occasion memory | P2 |
| RS-1.7 | **A sale ends** only for a sailing the guest saved, with the real date and source; off by default (commercial) | Event | S | The sale ends | Fare feed, real source | P2 |

*Asked:* "Remind me on Sunday to talk to Sam about this." *Offered:* RS-1.1 after the quiz ends. *Boundary:* the dream board shows a quiet **countdown to decide-by** the partner also sees.

### 13.2 Discover (Sailing, Cabin, Cost)

**Guest's job:** pick sailing, cabin and fare with confidence. **Tone:** honest and calm; a hold is a real deadline, never a pressure device.

| ID | Reminder | When | Lane | Stops when | Needs  Pri |
|---|---|---|---|---|---|---|
| RS-2.1 | **Hold ending.** The 48-hour hold: 24 hours, 6 hours, 1 hour before it lapses, each saying what happens (the cabin is released), no countdown clock | Ladder | I | Booked, released or lapsed | Hold flow | P1 |
| RS-2.2 | **Callback.** The consultant's callback: 1 hour before and at the time; if missed, one offer to rebook | Anchored | I | Call took place | Callback record | P2 |
| RS-2.3 | **Cabin like this opened** (a cabin matching remembered needs: quiet, midship, accessible) | Event | S | Opened or dismissed | Mock inventory | P2 |
| RS-2.4 | **Fare or tax changed** on the shortlist, with the new total and why | Event | I | Opened | Fare feed | P2 |
| RS-2.5 | **Poll closes.** Party poll on sailings or cabins: 1 day left, and who has not answered (to the poller only) | Anchored | R | Poll closed | Polls | P2 |
| RS-2.6 | **Compare the last two.** The guest said "narrow it down by Friday" | Clock | R | Friday | Guest-set | P2 |
| RS-2.7 | **Advisor link seen.** Someone opened the shared brief; one info note, no names beyond what the share showed | Event | N | Acknowledged | Share links | P2 |

*Asked:* "Remind me to check the cabin price after payday." *Offered:* RS-2.1 when a hold is placed ("Want 24-hour and 1-hour notes?" on by default). *Boundary:* a **decision brief** reminder that arrives with the three things left to decide.

### 13.3 Book (Booking, Travellers, Pay)

**Guest's job:** complete a booking without a mistake. **Tone:** supportive; the stage is short and anxious.

| ID | Reminder | When | Lane | Stops when | Needs  Pri |
|---|---|---|---|---|---|---|
| RS-3.1 | **Checkout left half done.** Back to the step they left, one nudge after 2 hours and one next day, never a third | Relative | R | Booking completed or discarded | Draft checkout | P2 |
| RS-3.2 | **Payment failed or needs 3-D Secure.** What to do next and by when | Event | C when a hold or due date is near, else I | Paid | Payment status | P0 |
| RS-3.3 | **Names must match passports.** Before the pay step, only if a mismatch is found | Event | I | Fixed | Document facts | P1 |
| RS-3.4 | **Share-the-cost: someone has not paid.** To the booker only, with a ready **draft** nudge the booker may send; Stanley never contacts the payer | Day before each payer's date | R | Paid | Payer links | P2 |
| RS-3.5 | **Your share is due** (to a payer who has an email on the link): one email, signed one-click stop | Anchored | I | Paid | Payer links | P2 |
| RS-3.6 | **Insurance decision window** where the policy has a time limit after deposit, with the real date | Ladder | I | Decided | Policy rules | P2 |
| RS-3.7 | **Confirmation not seen.** If no confirmation is opened in 15 minutes, "Your confirmation is in your email and in My Trips" | Relative | N | Opened | Confirmation | P2 |
| RS-3.8 | **Cancellation costs change on [date]** in plain money | Ladder (30, 7 days) | I | The date passes | Policy rules | P1 |

*Asked:* "Remind me to pay the deposit on Friday." *Offered:* RS-3.8 once the booking is confirmed. *Boundary:* a **what happens if I miss it** line on every payment reminder.

### 13.4 Manage (Trip, Needs, Group)

**Guest's job:** get ready, over months. **Tone:** this is where a quiet, reliable reminder earns loyalty. It is the longest stage and holds the most **deadlines**.

| ID | Reminder | When | Lane | Stops when | Needs  Pri |
|---|---|---|---|---|---|---|
| RS-4.1 | **Final payment ladder** with the amount and the consequence | 30, 14, 7, 2 days; the day; overdue | I; C when overdue near the date | Paid | Payment calendar (partly exists) | P0 |
| RS-4.2 | **Instalment due, taken, failed** (failed is critical near the date) | Ladder | I / C | Paid | Exists as notices | P0 |
| RS-4.3 | **Card on file expires before the final payment** | 45 and 14 days before the card's expiry | I | Card replaced | Card expiry (mock charging) | P1 |
| RS-4.4 | **Documents:** missing, expiring or short of the 6 months rule, per traveller, naming the traveller | At 90, 45 and 14 days | I | Resolved | Document rules | P0 |
| RS-4.5 | **Visa, ETA or health form** needed for this itinerary and citizenship, with the real lead time | 60 and 21 days | I | Marked done | Rule table per country | P1 |
| RS-4.6 | **Special assistance cut-off:** requests need 30 to 90 days; days left and status | At 14 days before the cut-off | I | Confirmed | Needs tracker | P1 |
| RS-4.7 | **Booking windows open** (excursions, dining, shows, spa, packages) with the discount end if real | Event, at open and 2 days before a real discount ends | S, I if a real deadline | Booked or dismissed | Programme dates | P1 |
| RS-4.8 | **Flights and hotel:** "Arrive the day before sailing" nudge when no flight is on the trip | 120 and 60 days | S | Added | Travel plan | P2 |
| RS-4.9 | **Phone and money set-up** (roaming off, ship Wi-Fi plan, card travel notice) | 7 days before | R | Ticked | Phone guide | P1 |
| RS-4.10 | **Before I go** checklist (stop mail, bank, out-of-office, charge devices, offline maps, print documents) as a **pack** | T minus 10 to 1 | R | Ticked | Pack (section 14) | P1 |
| RS-4.11 | **Packing ladder:** start at 7 days, finish at 2 days, weigh bags at 2 days | Ladder | R | Ticked | Packing | P1 |
| RS-4.12 | **Medicines:** check supply covers the trip plus 7 days (only if the guest listed medicines); private | 21 days | R (private) | Done | Needs card | P2 |
| RS-4.13 | **Itinerary changed: choose by [date].** The change explainer with the real decision deadline | Event, then ladder to the deadline | I | Chosen | Change engine (exists) | P0 |
| RS-4.14 | **Helper summary:** a weekly "what is left" for an authorised helper | Weekly | N | Disembark | Helper role | P2 |
| RS-4.15 | **Family at home page:** "Share your trip page with someone at home?" once | 14 days | S | Done or declined | Family page | P2 |
| RS-4.16 | **Hurricane or storm watch** for the sailing in season, plain and sourced | Event | I | The sailing leaves | Weather (mock) | P1 |

*Asked:* "Remind me to renew Maya's passport." (Stanley asks who, then sets a ladder.) *Offered:* RS-4.4 as a ladder when the first document gap appears. *Boundary:* a **single deadline radar** card (CHK-08) lists every dated item in consequence order and each row has Remind me.

### 13.5 Prebook (Plan, Prepare, Group)

**Guest's job:** book the experience (dining, tours, shows, spa) and plan the days. **Tone:** timely, not hurried; the booking windows are real competition for seats.

| ID | Reminder | When | Lane | Stops when | Needs  Pri |
|---|---|---|---|---|---|---|
| RS-5.1 | **Booking window opens** for each kind the guest cares about (the guest picks kinds once) | Event at open, plus 1 hour before if the programme gives a time | R | Booked | Programme | P1 |
| RS-5.2 | **Dining plan freezes in 3 days** (booker only; the existing rule) | 6 and 3 days | I | Frozen | Dining plan | P1 |
| RS-5.3 | **Space opened** for a thing the guest watched | Event | R | Booked or dismissed | Mock inventory | P2 |
| RS-5.4 | **Reconfirm a specialty table** where the venue asks 48 hours before | 72 and 48 hours | I | Confirmed | Venue rule | P1 |
| RS-5.5 | **Excursion: tomorrow evening and 90 minutes before the meeting time**, with the **bring list** | Anchored | R | The tour starts | Excursions | P0 |
| RS-5.6 | **Pre-cruise order or gift deadline** closes in 3 days, with the real cut-off | Ladder | I | Ordered | Services | P1 |
| RS-5.7 | **Package pre-purchase window closes** | Ladder | I | Decided | Entitlements | P1 |
| RS-5.8 | **Poll: your party has not answered** (to the poller) and **poll closes tomorrow** | Anchored | R | Closed | Polls | P2 |
| RS-5.9 | **Occasion request deadline** (cake, decoration, celebration) | 14 and 7 days | I | Requested | Services | P2 |
| RS-5.10 | **Formal nights ahead:** the dates and the dress code, once | 7 days | N | Acknowledged | Programme | P2 |
| RS-5.11 | **Plan lint result:** "Two things overlap on Tuesday" | Event | I | Fixed | Plan lint (CHK-02) | P1 |
| RS-5.12 | **A show or dinner moved** and what it does to the plan | Event | I | Resolved | Change engine | P0 |

*Asked:* "Remind me when excursions open for Cozumel." *Offered:* REM-C01 as the guest confirms a tour. *Boundary:* the **day-by-day reminder pack** for the whole cruise generated from the plan with one tap (section 14).

### 13.6 Get to the ship (Board, Travel, Plan)

**Guest's job:** reach the terminal on time with the right papers. **Tone:** precise and calm; this is the first stage with real clock risk.

| ID | Reminder | When | Lane | Stops when | Needs  Pri |
|---|---|---|---|---|---|---|
| RS-6.1 | **Check-in opens; not done** | At open; 48, 24 and 3 hours before the cut-off | I | Checked in | Check-in state | P0 |
| RS-6.2 | **Boarding pass saved offline** | Once pass exists; 24 hours before | I | Saved | Pass state | P0 |
| RS-6.3 | **Flight watch:** status change and the **leave-for-the-airport** time | Anchored to the flight | C when it can cost the sailing, else I | Landed | Flight (mock) | P0 |
| RS-6.4 | **Leave for the terminal** from the arrival window, traffic and the guest's pace | Leave-by | I | Arrived | Traffic (mock), travel plan | P0 |
| RS-6.5 | **Arrival window opens at [time]** (arriving earlier means waiting outside) | Anchored | N | At the terminal | Boarding data | P1 |
| RS-6.6 | **Luggage tags attached** | Evening before | R | Ticked | Checklist | P1 |
| RS-6.7 | **Carry-on contents:** passport, boarding pass, medicines, valuables, a swimsuit; the pack | Evening before | R | Ticked | Pack | P1 |
| RS-6.8 | **Hotel check-out time** and **transfer pick-up** | Anchored | R | Done | Travel plan | P1 |
| RS-6.9 | **Wake-up** with an offer to prepare a hotel or ship **wake-up call** request | Clock | R | Acknowledged | Guest-set | P1 |
| RS-6.10 | **Time-zone change at the port** ("Clocks at the port are one hour behind your home") | Event | N | Acknowledged | Itinerary | P1 |
| RS-6.11 | **Party meeting at the terminal** each member accepts | Anchored | R | Met | Group reminder | P2 |
| RS-6.12 | **Running late path:** if a flight or traffic threatens the sailing, the **missed-ship path** and a drafted "running late" note (the guest sends it) | Event | C | Resolved | CHK-03, SR-6.4 | P0 |

*Asked:* "Remind me to take the passport out of the safe." *Offered:* RS-6.4 as soon as a flight is on the trip. *Boundary:* **leave-by that adapts** to live traffic and updates the message in place (section 17).

### 13.7 Embark (Board, Ship, Plan)

**Guest's job:** get aboard, find the cabin, complete the muster. **Tone:** direct; nothing may compete with muster.

| ID | Reminder | When | Lane | Stops when | Needs  Pri |
|---|---|---|---|---|---|---|
| RS-7.1 | **Muster drill** at the guest's time, with the station and the walk from the cabin; children's stations go to the guardian too | Anchored: 30 and 10 minutes, and at start | C | Muster marked done | Muster data | P0 |
| RS-7.2 | **Sail-away** and the guest's **all-aboard for the first day** | 60, 30, 10 minutes | C | Ship sails | Itinerary | P0 |
| RS-7.3 | **Cabin ready** and where | Event | N | Seen | Ship feed (mock) | P1 |
| RS-7.4 | **Bags not arrived by [time]**, with the call route | Clock (guest-set or default 18:00) | R | Bags arrive | Guest-set | P2 |
| RS-7.5 | **First dinner** and **first show** with the walk from the cabin | 60 and 20 minutes | R | Attended | Plan | P0 |
| RS-7.6 | **Set up aboard:** card on file, Wi-Fi plan, kids club registration, drink package activation, offline pack | Hour 1 to hour 3 | R | Ticked | Checklist | P1 |
| RS-7.7 | **Photo of your cabin number** (so children and the guest can find it) | Once | N | Done | none | P2 |
| RS-7.8 | **Specialty booking window** opens on board | Event | R | Booked | Programme | P2 |
| RS-7.9 | **Safety first night:** muster station photo, emergency number, safe code (private) | Evening | N | Done | Safety content | P1 |
| RS-7.10 | **Tonight's quiet hours** and the next-morning wake-up | Evening | N | Acknowledged | Programme | P2 |

*Asked:* "Remind me to unpack before dinner." *Offered:* the **first-four-hours** sequence as one pack. *Boundary:* a **quiet pre-alert** 10 minutes before muster (REM-E08).

### 13.8 Sea (Today, Ship, People)

**Guest's job:** enjoy the ship. **Tone:** a helpful companion; the busiest stage for guest-created reminders and for the arbiter.

| ID | Reminder | When | Lane | Stops when | Needs  Pri |
|---|---|---|---|---|---|---|
| RS-8.1 | **Show or event in my plan** with walk time | 30 minutes (the market default; the guest's lead time applies), with the walk time in the text | R | Starts | Plan | P0 |
| RS-8.2 | **Dinner** and **a specialty reservation** | 60 and 20 minutes | R | Seated | Plan | P0 |
| RS-8.3 | **Spa, class, kids club pick-up** (the pick-up time goes to the guardian) | Anchored | R / C for pick-up | Done | Plan | P0 |
| RS-8.4 | **Time moved** (the show, dinner or event) and what it changes | Event | I | Resolved | Change engine | P0 |
| RS-8.5 | **Clocks change tonight** | 20:00 the evening before | I | Acknowledged | Itinerary | P0 |
| RS-8.6 | **Tomorrow is a port day:** tender tickets, excursion meeting time, what to bring | 18:00 | R | Acknowledged | Port pilot | P0 |
| RS-8.7 | **Tender ticket pick-up** if the port is a tender port | Anchored | I | Collected | Tender flow | P1 |
| RS-8.8 | **Excursion booking for tomorrow closes at [time]** | Ladder, real cut-off | I | Booked | Excursions | P1 |
| RS-8.9 | **Formal night:** the evening before and at 17:00 | Anchored | R | Done | Programme | P1 |
| RS-8.10 | **Spend pace:** 80% of the daily budget (guest-set) | Event | I | Day ends | Spend (exists) | P1 |
| RS-8.11 | **Mid-cruise bill check** and **unused package value** | Day 3 | S | Opened | Bill watch | P2 |
| RS-8.12 | **Medicines at 8:00 and 20:00** (private, repeating, check-back) | Repeating | R (private) | Disembark | Private reminders | P1 |
| RS-8.13 | **Gentle:** water, sun cream every 2 hours on deck, rest | Repeating, opt-in | R | Guest stops it | Gentle option | P2 |
| RS-8.14 | **Photo pick-up** and the date the ship photo gallery closes | Ladder | R | Collected | Content | P2 |
| RS-8.15 | **Party meets at 5:10** (accepted copies only) | Anchored | R | Met | Group reminder | P1 |
| RS-8.16 | **Occasion on board:** a birthday or anniversary dessert or message the guest arranged | Anchored | R | Done | Services | P2 |
| RS-8.17 | **Call home window** when Wi-Fi is cheap or a port has signal (a note, never a call) | Event | N | Acknowledged | Guest-set | P2 |
| RS-8.18 | **Gratuity decision opens** with the real cut-off date | Event | I | Decided | Gratuity rules | P1 |

*Asked:* "Remind me at 3 to join trivia." *Offered:* REM-C01 on every booking. *Boundary:* a **morning brief** (ACT-06) that is the day's reminders as one card, and the **evening look-ahead** that is tomorrow's.

### 13.9 Port (Port, Ship, People)

**Guest's job:** enjoy the port and **be back**. **Tone:** the highest stakes of the cruise; critical reminders live here.

| ID | Reminder | When | Lane | Stops when | Needs  Pri |
|---|---|---|---|---|---|---|
| RS-9.1 | **All aboard** with the guest's own buffer | 120, 90, 60, 30, 10 minutes; leave-by | C | The guest is aboard (scan) or the ship sails | Itinerary, scan event | P0 |
| RS-9.2 | **Head back now:** leave-by computed from walk or tender time, queue outlook and the personal buffer, updated in place | Leave-by | C | Aboard | Port pilot, tender (mock) | P0 |
| RS-9.3 | **Last tender** (different from all aboard) and **tender delays** | Anchored, event | C | Aboard | Tender (mock) | P0 |
| RS-9.4 | **Excursion meeting time:** 90 and 30 minutes before, with the **bring list** (ID, ship card, sun cream, water) | Anchored | R | Starts | Excursions | P0 |
| RS-9.5 | **Excursion late back warning** if the tour's return time threatens the buffer | Event | C | Resolved | Port pilot | P0 |
| RS-9.6 | **Ship time versus port time:** every ashore reminder shows both when they differ | Always | N | n/a | Itinerary | P0 |
| RS-9.7 | **Excursion or port changed or cancelled** and the replacement (RUL-01) | Event | I | Resolved | Change engine | P1 |
| RS-9.8 | **Weather turns or a safety advisory** for the port, official source only | Event | I; C for a safety advisory | Port day ends | Weather (mock), advisories | P1 |
| RS-9.9 | **Port pack and offline map** ready | Day before, on Wi-Fi | N | Downloaded | Offline pack | P1 |
| RS-9.10 | **Leaving the ship:** ID and ship card, a copy of the passport, valuables in the safe, local money | 30 minutes before gangway | R | Left | Port content | P1 |
| RS-9.11 | **Phone:** switch off data roaming leaving the ship | At gangway | R | Done | Phone guide | P2 |
| RS-9.12 | **Call home when we dock** (a guest-set note) | Port-anchored | R | Acknowledged | Guest-set | P2 |
| RS-9.13 | **Dinner tonight at 19:30:** will you be back? Shows the buffer | Midday | N | Acknowledged | Plan lint | P2 |
| RS-9.14 | **Meet-me-here** each member accepts; a drafted "running late" the guest may send | Anchored | R | Met | Meeting points | P1 |
| RS-9.15 | **Local rules once** (dress, tipping, photos, currency) | Port start | N | Acknowledged | Port content | P1 |
| RS-9.16 | **Back aboard:** "Welcome back. Dinner is at 19:30" and nothing else | On scan | N | n/a | Scan event | P2 |

*Asked:* "Remind me to buy a gift for Mum an hour before we leave." *Offered:* REM-C03 as the guest plans a long stop. *Boundary:* **the missed-ship ladder** (CHK-03) as the single, escalating critical reminder.

### 13.10 Disembark (Leave, Ship, People)

**Guest's job:** leave smoothly and settle up. **Tone:** orderly; many small tasks the night before.

| ID | Reminder | When | Lane | Stops when | Needs  Pri |
|---|---|---|---|---|---|---|
| RS-10.1 | **Bag night:** tags and bags out by the cut-off | 18:00 and 60 minutes before | C | Bags out | Disembark data | P0 |
| RS-10.2 | **Pick your exit time** | Evening before | I | Chosen | Exit flow | P0 |
| RS-10.3 | **Final bill ready; unused credit** | Last evening | I | Reviewed | Bill watch | P1 |
| RS-10.4 | **Tips decision closes** at the real cut-off | Last evening | I | Decided | Gratuity rules | P1 |
| RS-10.5 | **Customs form** | Last full day | I | Submitted | Customs flow | P1 |
| RS-10.6 | **Safe, drawers, under the bed, chargers, passport** (the leave-nothing-behind pack) | Final morning | R | Ticked | Pack | P1 |
| RS-10.7 | **Carry-on:** medicines, documents, a change of clothes | Last evening | R | Ticked | Pack | P2 |
| RS-10.8 | **Vacate the cabin by [time]** | Anchored | I | Left | Disembark data | P0 |
| RS-10.9 | **Your colour or group is called at [time]** | Anchored | I | Left | Exit data | P1 |
| RS-10.10 | **Flight or transfer:** leave-by to the airport, updated on live status | Leave-by | I; C when it can cost the flight | Departed | Flight (mock) | P0 |
| RS-10.11 | **Return the borrowed:** towels, devices, a wheelchair | Anchored | R | Done | Services | P2 |
| RS-10.12 | **Crew thank-you** (a draft for the guest to send, or a card) | Last evening | S | Done | Drafts | P2 |
| RS-10.13 | **Wake-up call request** prepared for the early start | Evening | R | Done | Wake-up (REM-E12) | P2 |

*Asked:* "Remind me to set out clothes for tomorrow." *Offered:* the **last night pack**. *Boundary:* **one tick-list card** for bag night and the final morning, shared by the thread and the Leave tab.

### 13.11 Remember (Memories, Next, Feedback)

**Guest's job:** keep the memories and close the loop. **Tone:** warm and sparse; nothing urgent; paused while a serious case is open.

| ID | Reminder | When | Lane | Stops when | Needs  Pri |
|---|---|---|---|---|---|---|
| RS-11.1 | **Photos ready and the date the link expires** | Event, then 7 days before | R | Saved | Photo content | P1 |
| RS-11.2 | **Feedback request** with a draft the guest edits; once, then once more | Disembark plus 2 and 9 days | S | Sent or declined | Feedback | P1 |
| RS-11.3 | **Retention warning:** a chat or photos will be deleted in 7 days | 7 and 1 day | I | Kept or lapsed | Chat retention | P1 |
| RS-11.4 | **Credit and expiry:** onboard or future-cruise credit with its real date | 60, 14 days | I | Used or lapsed | Loyalty data | P1 |
| RS-11.5 | **Check your card statement** matches the ship bill | Disembark plus 5 days | R | Done | Bill watch | P2 |
| RS-11.6 | **Lost and found:** the claim window | Disembark plus 2 and 14 days if a claim is open | I | Closed | Cases | P1 |
| RS-11.7 | **Next trip** idea built from kept preferences | Disembark plus 10 days | S | Dismissed | Memory | P2 |
| RS-11.8 | **On this day:** one year on, a favourite photo and a note | Clock | N | Seen | Memory book | P2 |
| RS-11.9 | **Post-trip health notice** only when the ship or authority issues one, official wording | Event | I | Acknowledged | Advisories | P1 |
| RS-11.10 | **Thank-you** to a crew member (a draft the guest sends) | Disembark plus 3 days | S | Done | Drafts | P2 |
| RS-11.11 | **Settle up** with a friend from the shared notebook (a note, nothing paid or sent) | Disembark plus 2 days | R | Done | Split notebook | P2 |
| RS-11.12 | **Back to normal:** mail, bills, a gentle "unpack and rest" for those who set it | Disembark plus 1 day | S | Done | Pack | P2 |

*Asked:* "Remind me to write a review next weekend." *Offered:* RS-11.2. *Boundary:* **a memory timeline** reminder that surfaces the diary at meaningful dates.

### 13.12 What the stage deep dive tells us

- **About 130 reminders across the 11 stages** (this section) plus the cross-stage kinds in section 2 and 12.4; about a third are **critical or important** (derived deadlines and safety), about a third are **reminders** (appointments and tasks) and the rest are **info or suggestions**.
- **Volume peaks in Port and Sea.** A port day can produce 12 or more candidate reminders; the arbiter's roll-up and budget (section 22) decide what is pushed, what waits in the thread and what is dropped.
- **The longest stage has the most money at stake.** Manage and Book carry the deadlines that cost money; the consequence line (REM-E03) matters more than the number of reminders.
- **Stops-when is the most important column.** Most guest complaints about reminders are about a reminder that fires after the thing is done. Every row has a fact that ends it and a test for it (section 21).
- **Time is two clocks.** Every Port and Embark row involves ship time and port or home time; section 17 and 18 cover it.
- **Three stages need strong data first.** Get to the ship (flight, traffic), Port (tender, advisories) and Remember (loyalty credit) depend on providers the backend only simulates today; the rows say "mock" and degrade to "I cannot check this right now", never to a guess.
- **Dream and Discover are the lightest and least valuable.** Build them last (as in the actions plan).

---

## 14. Reminder packs: a stage's reminders in one tap

A **pack** is a named set of reminders with default times, shown as a list of toggles the guest edits before adding. Packs are authored by the content team (and the **ship** source in 12.3) and served by the server, so a new pack needs no front-end change.

| Pack | Stage | Contents (from section 13) | Shown when |
|---|---|---|---|
| **Before I go** | Manage | RS-4.9, RS-4.10, RS-4.11, RS-4.12 (if meds) | 10 days out |
| **Travel day** | Get to the ship | RS-6.4 to RS-6.9 | The day before |
| **First four hours** | Embark | RS-7.1, 7.2, 7.5, 7.6, 7.7 | On boarding |
| **A day at sea** | Sea | RS-8.1, 8.2, 8.9, 8.13 as chosen | Each morning (the brief) |
| **A port day** | Port | RS-9.1, 9.2, 9.4, 9.10, 9.11 | The evening before |
| **Bag night and last morning** | Disembark | RS-10.1 to 10.8 | The last evening |
| **After the trip** | Remember | RS-11.1 to 11.5 | Disembark day |
| **Family** | Manage to Disembark | Kids club, muster for each child, meet-up times, bedtime (guardian only) | Booking has a child |
| **Celebration** | Prebook to Sea | RS-5.9, RS-8.16, occasion reminders | An occasion in the profile |
| **Wellbeing** | Sea, Port | RS-8.12, 8.13 and a rest after a long port day (opt-in) | The guest turns it on |
| **Accessibility** | Manage to Port | RS-4.6, tender and deck-route cautions, assistance check-ins | Needs recorded |
| **Port by Princess** (ship packs, one per port) | Port | Local rules, last tender, currency and tipping, an offline map, an essentials bring list, authored per port | A port on the itinerary |

**Pack rules.** A pack adds reminders marked with its name so it can be removed as a set; the guest edits or removes any row; a pack never adds a critical reminder the trip set already provides; a pack's times follow the itinerary if it changes; a pack can be **saved by the guest as their own** ("my usual port day") and reused next trip, with times relative to the stage not to dates.

---
## 15. Creation in depth: words, buttons and the parser

Section 3 stays. This adds the language coverage, the entry points and the ambiguity rules, so the parser can be specified and tested.

### 15.1 What the parser must understand

| Family | Examples the guest might say | Reads as |
|---|---|---|
| **Clock** | "at 4:15", "at 4", "4pm", "half past 4", "quarter to 5", "noon", "midnight", "7 in the morning" | A time; AM or PM asked when unclear |
| **Day** | "tomorrow", "Thursday", "on day 4", "on the sea day", "formal night", "embarkation day", "the last night" | A date on this trip, in ship time |
| **Relative** | "in 30 minutes", "in an hour and a half", "in 2 hours", "in a bit" (asks) | An interval from now |
| **Anchored** | "an hour before the show", "45 minutes before all aboard", "when we dock", "after dinner", "when check-in opens", "the evening before my tour" | An offset from a plan item, the all-aboard time, a port arrival or an event |
| **Repeating** | "every night at 10", "twice a day at 8 and 8", "every 2 hours until 6", "each morning" | A repeat rule with an end (trip end by default) |
| **Conditional** | "if it rains", "if the tender is delayed" | An event plus a condition (P2) |
| **Place** | "when we get to Cozumel", "at 9 in Cozumel" | Port arrival, or a time in the port's own zone |
| **Group** | "remind us", "tell Jordan" | Refused to others; offers the share-a-calendar-file route (REM-E16) |
| **Task words** | "to take my tablets", "to call Mum", "to bring sun cream" | The reminder text; private if it looks like health wording (a small word list and the guest's own toggle) |

**Deterministic first.** A server grammar reads every family above. Only when it cannot read a phrase does it ask a model on the **small** tier, with the guest's text removed where possible and typed fields returned (when, anchor, repeat, text). The guest always sees the result before it exists. The parser never schedules anything it cannot show.

**Corpus and targets.** A reviewed corpus of at least **500 phrases** (including mistakes, slang and mixed order) with expected output for each; the deterministic grammar must read at least 90% correctly and **never return a wrong time silently** (a wrong read must be a refusal or a question). Every wrong read found in use becomes a corpus entry.

### 15.2 Ambiguity and refusal rules (each is a test)

1. **"Tomorrow" after midnight.** Between 00:00 and 04:00 ship time, "tomorrow" asks: "Tonight or tomorrow?" with both dates shown.
2. **Bare hour.** "At 5" offers only the next 5:00 that is in the future (today 5:00 PM or tomorrow 5:00 AM), not both if one has passed.
3. **Past time.** Refused with the next possible one offered.
4. **Too far.** More than the trip length away is refused (except system reminders).
5. **Clock change.** A time that does not exist or exists twice on a clock-change night takes the first valid instant and says so.
6. **Port or ship?** "At 9 in Cozumel" is read in the port's zone; the preview shows both zones when they differ.
7. **Anchor missing.** "Before the show" with two shows asks which, as buttons.
8. **Anchor moves.** Follows (REM-CR-05).
9. **Vague.** "Later", "soon" ask for a time with three buttons.
10. **Not a note to the guest.** Remind someone else, book, pay, cancel: refused with the right alternative (REM-CR-08).
11. **Too many.** At a limit: names what to remove.
12. **Medical wording.** Stored as private, never interpreted, never advised on.
13. **Link or markup.** Stripped; a reminder never carries a link except into the app.
14. **Very short interval.** Under 5 minutes from now is accepted; a repeat under 30 minutes is refused (a nag has its own gentle schedule).

### 15.3 Entry points (all produce the same typed intent)

| Entry | How |
|---|---|
| The Stanley thread | Typed or spoken |
| **Remind me** on any item | One tap; default lead time for the kind; a long-press or "More" for other times |
| **Reminders sheet** (the bell) | **Add**: a short form (what, when with a native time and date control, repeat, how loud) as an alternative to words, for guests who prefer a form |
| A notice or reminder | "Remind me in..." reply |
| A chat message, post or Stanley card | **Remind me about this** (REM-E17): only an editable 80 character label, never the message text |
| The **phone's share sheet** into the app (a Web Share Target, where supported) | Share a line of text or a link; Stanley turns it into a reminder preview |
| A **pack** | Add many at once (section 14) |
| **Stanley's offer** | A one-tap preview (REM-C) |
| **Voice** | Existing speech input; the spoken text goes through the same preview |

### 15.4 The preview card (what the guest sees before it exists)

```
Reminder
"Be back on board"
Tomorrow, Wed 12 Nov, 4:30 PM ship time        (3:30 PM in Cozumel)
45 minutes before all aboard. Follows it if it moves.
How: push, and in your phone calendar.         [Change]
[ Confirm ]   [ Change ]   [ Not now ]
```

The card names the weekday and date, both zones where they differ, the anchor and whether it follows, the channels it will use, and the stop condition ("Ends when you are back aboard").

---

## 16. Delivery in depth

Section 5 stays as the base. This section adds the channels, the permission journey, the self-test, the ladders per class, lock-screen actions, the badge, the calendar feed and ship-side options.

### 16.1 Channels catalogue

| Channel | Works when | Cost and limits | Status | Used for |
|---|---|---|---|---|
| **In the thread** | App open or opened later | Free | Planned | Every reminder (record) |
| **In-app pop-up and banner** | App open | Free | Exists (urgent chat pattern) | Critical (pop-up), others (banner) |
| **Web push** | Phone has signal, permission granted; on iPhone **only for an installed app** | Free; the provider can delay | Mock sender today | Every lane except info |
| **App icon badge** (`setAppBadge`) | Installed app, supported device | Free | New | Count of unacknowledged critical and important |
| **Notification buttons** (Got it, Snooze, Open) | Supported browsers and installed app | Free | New | Acting without opening the app |
| **Email** | Signal or Wi-Fi at any time | Free | **Exists** (verified addresses only; payment and travel notices; the safety fallback) | Backup for important; the evening look-ahead; payer notes |
| **SMS** | Phone cell service (not Wi-Fi only) | Per message; fraud risk | **Exists** (`ISmsSender`; verified numbers only; used for payment and travel notices, the head-back notice and the 10-minute safety fallback); the sender is a mock | **Critical last resort only**, to a verified number the guest chose |
| **Phone calendar** (file and **live feed**) | Always, with **no signal**, because the phone raises its own alarm | Free | **Feed and alarms exist** for the sailing, check-in, payment and sail-away; reminder entries new | The offline-proof copy of the reminders the guest chooses |
| **Local copy on the device** | App reopened | Free | Partly exists | A due reminder shown the moment the app opens, with the true time |
| **Read aloud** | App open, speech on | Free | Exists as read-aloud | Critical in-app reminder, for guests who want it |
| **Watch** | The phone mirrors a notification to a paired watch | Free | Platform behaviour | Short title, one action, no private text |
| **Ship wake-up call and cabin screen** | Aboard | Staff or ship system | **Mock behind an interface**, later real | A **prepared request** for a wake-up call (rung 2) and, if the ship offers it, a message on the cabin screen for critical items |

**Rule:** a channel is used only if the guest has it available and has not turned it off for that lane. Critical can use every available channel and cannot be switched off entirely, but **SMS and email for critical need the guest's opt-in** (as decided in round 1).

### 16.2 The permission journey (when and how we ask for push)

| Step | Rule |
|---|---|
| **Do not ask at launch.** | The browser prompt is a one-shot; a refusal is hard to undo |
| **Ask in context.** | The first time a guest creates or accepts a reminder, Stanley asks: "Want this to reach your phone even when the app is closed?" with Yes (opens the browser prompt) and Not now (the thread still works) |
| **iPhone.** | If the app is not installed, explain once: "To get alerts when the app is closed, add it to your Home Screen" with the three steps and a picture; never block |
| **Denied.** | The Reminders sheet shows "Phone alerts are off" with the steps to turn them on for that browser, and the calendar and email routes offered instead |
| **Unsupported.** | Same, with the calendar route first |
| **State shown.** | One line in Settings and in the sheet: Push on, Push off, Not installed, Not supported, plus Email on or off, SMS on or off, Calendar linked or not |

### 16.3 Delivery self-test (a trust feature)

A **Send me a test reminder** button in Settings and the sheet sends one real reminder through every channel the guest has on and reports, per channel: **sent**, **received on this device** (the app confirms), or **not received**. If push is not received within 20 seconds the card says so and offers the fix (permission, install, calendar, email). A **health line** appears on the Reminders sheet ("Phone alerts checked 3 days ago") and the sheet nudges again if the last check is older than 14 days or the device changed. The test message is labelled "Test" and is not counted in any budget or measure.

### 16.4 The ladder per class (what happens when nobody responds)

Each reminder has a **class** that sets its ladder; the guest can make a ladder **stronger** for any non-critical class (more repeats, more channels) or **gentler**.

| Class | Used for | Ladder | Channels | Ends when |
|---|---|---|---|---|
| **A: Safety and be-back** | All aboard, last tender, muster, missed-ship | Thread and push at the step; no Got it by +2 min: retry; +5 min: retry with pop-up if open; next step; the **last step** adds SMS if opted in; the guest's own **leave-by** is a step | thread, push, pop-up, SMS (opt-in), calendar fixed alarms | Scanned aboard, ship sails, or occasion ends |
| **B: Critical deadline** | Payment failed near the date, check-in cut-off close, travel that can cost the sailing | Thread and push now; retry at +10 min and +1 hour if unacknowledged; one follow-up next morning if the date is ahead | thread, push, email (opt-in) | Resolved or date passes |
| **C: Important deadline** | Payment ladder, documents, assistance, windows | Thread now; push in waking hours; one follow-up next morning if the date is ahead | thread, push, email | Resolved |
| **D: Appointment** | Dinner, show, tour, class, meeting | Thread and push at the lead time; no retry; a "missed" line later | thread, push, calendar | The time passes, or attended |
| **E: The guest's own** | Reminders the guest created | At the time asked, even in quiet hours; the guest may choose **nag** (REM-E07) | thread, push, calendar | Done |
| **F: Info and suggestion** | Offers, "on this day", "photos ready" | Thread only; at most one push per day in waking hours if the guest allowed suggestions | thread | Seen or expired |
| **G: Private** | Health and access wording | Like E but redacted everywhere, never in the calendar feed or on a lock screen | thread, push (redacted) | Done, with the optional check-back |

**Anchor of the ladder.** Every step is a *separate firing* with its own key (so retries never duplicate), and **scanning aboard** (or the equivalent stop fact) cancels all later steps at once.

### 16.5 Lock-screen and notification actions

| Rule | Detail |
|---|---|
| **Actions** | Got it, Snooze (non-critical), Open, and for check-back, Yes and Not yet; where the device supports buttons |
| **Text** | Complete without opening the app, 60 characters for the title and 120 for the body, in plain words ("All aboard in 30 minutes. Be back on the ship by 4:30 PM.") |
| **Redaction** | Private reminders show "Stanley: your reminder"; safety reminders are plain; company notices say "From Sun Princess" |
| **Grouping** | Notifications for one booking in one period collapse under one title with the roll-up count |
| **Tags** | A retry **replaces** the earlier notification (same tag), never stacks |
| **Sound and vibration** | System defaults per lane; critical uses a distinct pattern; never sound-only |
| **Badge** | The count of unacknowledged critical and important items; cleared as they are acknowledged on any device |

### 16.6 When the guest has no signal (the honest ladder)

1. The server sends at the due moment (push, and SMS for class A only if opted in).
2. If the phone has no signal the push waits at the provider. The app, on next open, shows every missed firing with the true times and "Late" where relevant.
3. The **phone calendar** carries fixed alarms the guest chose, so those sound **without** signal.
4. **Critical safety is never only a reminder**: the ship's screens, announcements and the cabin teams are unchanged, and the thread says so.
5. At creation Stanley says the limit **once** (REM-DL-08) and offers the calendar route.
6. A guest who is aboard can enable **Ship Wi-Fi reminders mode** (opt-in): while the app is open on ship Wi-Fi, the due-soon list refreshes every minute and the screen keeps awake only if the guest asks.

### 16.7 The phone calendar feed (offline-proof, live) *(the feed exists; this section is what R5 adds)*

| Aspect | Design |
|---|---|
| **What it is** | The **existing** private calendar subscription (`/calendar/{token}.ics`, hashed token, revoke) extended so it carries an event and an **alarm** for each reminder the guest includes, so the phone's own calendar alerts it |
| **What goes in** | Class A, B, C and D reminders and the guest's own non-private reminders; **never** private (class G) text and never the company's sensitive notes; titles are plain ("All aboard 4:30 PM ship time") |
| **Alarms** | A fixed set per class (all aboard: 60, 30 and 10 minutes), so the phone has the whole ladder even if the app is closed |
| **Updates** | Each change increments the event's sequence so calendars update; the entry says "Latest time is in the app" because calendar apps refresh on their own schedule (minutes to hours, never promised) |
| **Security** | **Already so:** a 43-character random token stored only as a hash, shown once, a new one cancels the old, off removes it, supervised accounts refused. **Add:** revoke at sign-out-everywhere, rate limiting and the private-text exclusion test |
| **Manual file** | **Add to calendar** on one reminder downloads a one-off file (the existing builder, now with an alarm) for guests who do not want a feed |
| **Honesty** | Settings says: "Your phone's calendar sounds the alarm even without signal. If a time changes while you are offline, the calendar will not know until it refreshes." |

### 16.8 Ship-side channels (parked behind an interface)

Wake-up calls and cabin-screen messages are real things a ship does. Stanley's part is only to **prepare a request** to the existing service desk flow (rung 2: the guest confirms) and, when a real provider exists, to show a status. A wearable (a medallion or similar) haptic alert is a **future channel** behind the same interface. No front-end change is needed when a provider appears. Nothing is promised to guests until a real provider exists.

---

## 17. Smart timing and personalisation

### 17.1 Leave-by: the most useful reminder in the app

`leave-by = deadline − (travel time at the guest's pace + queue outlook + personal buffer + safety margin)`

| Input | Source |
|---|---|
| **Deadline** | All aboard, last tender, a tour meeting, a flight, a dinner |
| **Travel time** | Walk time from the port pilot or deck graph, **at the guest's recorded pace** (relaxed, normal, brisk; mobility or a step-free route need), plus the tender time and ride |
| **Queue outlook** | Tender queue or terminal wait estimates (mock, with an age) |
| **Personal buffer** | The guest's own extra minutes for all-aboard (REM-SN-02), default 0 for a normal pace, 15 suggested for a mobility need, children, or a tender port |
| **Margin** | A small fixed margin per class, published |

It is **re-computed** when any input changes (a tender delay, a traffic jam) and the thread message is **updated in place** with "Updated 3:42" (never a second message); a worsening outlook can raise the lane (important to critical).

### 17.2 Learned lead times (with the guest's yes)

- After **two snoozes** of the same kind, Stanley offers "Want these earlier next time?" (never automatic).
- After **three on-time acknowledgements** with plenty of margin, an offer of a **shorter** lead.
- A guest who always takes the 10-minute step and ignores the 60 could be offered "Skip the early ones" for that kind.
- All learned values are **visible and forgettable** memories with scope and why.

### 17.3 Clustering and calm

| Behaviour | Rule |
|---|---|
| **Roll-up** | Reminders for the same booking within 10 minutes become one card ("Before dinner: 3 things") unless one is critical |
| **Dedupe** | The same fact from a trip reminder, a pack and the guest's own reminder is one firing with all sources listed |
| **Cooling** | A kind snoozed three times pauses for the rest of the day with a note |
| **Seen-already** | If the guest has the relevant screen open, the push is skipped and the banner shown |
| **Already done** | A scan, a check-in, a payment or an attended event cancels the matching reminder before it fires |
| **During muster or a ship alert** | Non-critical reminders wait; critical safety first |
| **Sleep** | Class D and below wait until the guest's wake time unless the guest asked for that time |
| **Budget** | The daily budget in settings applies to push; critical and the guest's own reminders do not count |

### 17.4 Persistence the guest chooses (nag, check-back)

- **Nag until done** (REM-E07): the guest picks per reminder: repeat up to 3 or 5 times at 5, 10 or 15 minute intervals; gentle wording that changes each time ("Still here when you are ready"); never for private health items without the guest turning it on; never beyond the useful window.
- **Check-back** (REM-E06): after a private or important reminder, one follow-up "Did you take it?" with Yes and Not yet; Not yet re-asks once in 15 minutes; no streaks, no scores, no shame.
- Both are **opt-in**, shown with their limits, and obey quiet hours except for the guest's own time.

### 17.5 Time and place

- **Two clocks always:** every ashore reminder shows ship time and port time when they differ (RS-9.6).
- **Ship time rules onboard:** a reminder set for "7:00" stays 7:00 ship time across a clock change and Stanley says so once (REM-CR-04).
- **Phone clock wrong or zone auto-changed:** a mismatch between the device's time and the server's is detected on open and shown ("Your phone's clock is 18 minutes off; reminders use ship time").
- **Pre-trip anchors** (payment, passport) use the guest's **home zone**; onboard anchors use **ship time**.
- **Flight times** show the zone of each airport.

---

## 18. When a reminder goes wrong: mistakes and repair

| # | What went wrong | What the guest sees | Repair | System response |
|---|---|---|---|---|
| RM1 | **Wrong time** because of AM/PM or ship versus home time | "I set 4:15 PM ship time. You may have meant 4:15 AM." (preview asked first; after the fact, a correction) | One-tap fix | The preview names both; corpus entry added |
| RM2 | **Fired after the thing was done** (paid, checked in, aboard) | Never reaches the guest; if it does, "No longer needed" and an apology line | Gone | Stop-when facts checked immediately before every firing (21.2) |
| RM3 | **Duplicate** from retry or two devices | One message, updated | n/a | Firing key unique; test |
| RM4 | **Push never arrived** (denied, not installed, no signal) | The thread shows it; the next open says "Late, shown 4:40 because you were offline" | Delivery check offers the fix | Delivery self-test and the health line (16.3) |
| RM5 | **Reminder arrived at 3 a.m.** | It was the guest's own time, or critical, or a bug | Move or drop | Quiet-hours table test; critical list audited |
| RM6 | **Anchor moved while offline** | The calendar copy is stale; the app updates on open | The card says "Updated; your calendar copy may differ" | Sequence number and the feed's honest note |
| RM7 | **Clock changed overnight** | A 7:00 reminder is still 7:00 ship time; one note | n/a | Clock fixture test |
| RM8 | **Lock-screen leak of private text** | Never; if reported it is S1 | Redaction fix | Hard-stop test: private text never in a push body or feed |
| RM9 | **Snoozed past the deadline** | Refused with the reason | Choose an earlier time | Window check (REM-SN-01) |
| RM10 | **Too many reminders** | A roll-up card; a "too much" chip on any reminder | Drops the kind or lowers the lane | Arbiter budget; the chip adjusts intensity |
| RM11 | **A reminder for a plan item that was dropped** | "Cancelled because your tour was dropped. Keep it as a clock reminder?" | One tap | Anchor cancel rule (REM-CR-05) |
| RM12 | **Wrong person reminded** (group copy, guardian copy) | A group copy is the member's own; a child's critical goes to the guardian | Remove | Audience tests, no copy without acceptance |
| RM13 | **A reminder after boarding for a port already left** | Lapsed, a quiet "missed" line | n/a | Useful window (REM-EX-01) |
| RM14 | **The phone calendar fires an old time** | The entry says "Latest time is in the app" | Update the feed | Sequence bump; honest note |
| RM15 | **SMS to a number that is not the guest's** | Only to a verified number | Remove the number | Verification at opt-in; per-guest cap; fraud monitor |
| RM16 | **Provider outage** (push, SMS) | One honest notice, then the next channel on the ladder | Auto-resume | Per-channel health flag and fallback |
| RM17 | **The guest says "stop reminding me"** | "Which? All of them, only this kind, or only today?" | Applied, shown | Natural-language control (as actions plan 19.4) |
| RM18 | **A reminder is wrong because data was wrong** | "I was wrong about this time. Corrected to X." One-tap list of what it affected | Reissue | Correction notice type; audit links the fact to the firings |

**Repair pattern** (as the actions plan 18.2): say it first and plainly; fix in the same card; explain on tap; prevent a repeat; record. **Severity:** a wrong all-aboard or muster time, a leaked private text or a reminder storm across a ship is **S1** (global pause, on-call); a failing channel is S2; one guest's missed reminder is S3.

---
## 19. Who gets the reminder: personas, shared trips and shared reminders

The test plans (`docs/test-plan-solo-cruiser.md`, `test-plan-family-of-four.md`, `test-plan-two-friends.md`) show a constraint that shapes reminders: **only the booker has an account**; other adults on a direct booking have none, children cannot register, and linking a booking works only for agent bookings. A reminder system built on "each person gets their own phone alert" would leave most of a family or a pair of friends with nothing.

### 19.1 The audience rule

| Audience | Rule |
|---|---|
| **The account holder** | Receives every reminder for their own items and for the booking they hold |
| **A traveller on the booking with no account** | Receives **nothing from Stanley**. The booker can **share** a reminder, a pack or the whole trip as a **calendar file or feed through the phone's own share sheet** (REM-E16). That is the booker's action; Stanley sends nothing to anyone |
| **A second adult with their own account** (agent booking or a later link) | Gets their **own copy** only after they accept it (REM-D01) and sets their own level and channels |
| **A supervised child** | No reminders of their own. Critical items about the child (muster station, kids-club pick-up, all aboard) go to the **guardian**, labelled with the child's first name (REM-D02) |
| **A helper** | May **prepare** a reminder (REM-D03). A new option **REM-D04 (the guest chooses): the helper receives copies of class A and B reminders** (never private), with the guest's consent recorded and revocable, for guests who may not look at their phone |
| **A group organiser** | Proposes a meeting reminder; each member accepts their own copy; an unanswered proposal is shown to the organiser as "not yet accepted", never sent as a nag |

### 19.2 Solo cruiser (Sam)

| Stage | Reminders that matter | Notes |
|---|---|---|
| Dream, Discover | RS-1.1, 1.3, 2.1 (hold ladder) | Light touch; no party reminders |
| Book, Manage | RS-3.2, 4.1 to 4.6, 4.9, 4.11 | Single set of documents; one traveller makes the payment ladder simple. Hide RS-3.4 and RS-3.5 (no payers to chase) |
| Prebook | RS-5.1, 5.4, 5.5, 5.6 | Offer shared dining (a solo preference), never poll reminders |
| Get to the ship, Embark | RS-6.1 to 6.4, 7.1, 7.2 | The highest-value reminders for someone with no one to check with |
| Sea, Port | RS-8.1 to 8.8, 9.1 to 9.4 | The all-aboard ladder matters most; a **solo buffer** suggestion (a quieter 15 extra minutes at a tender port) |
| Disembark, Remember | RS-10.1 to 10.5, 11.1 to 11.5 | |
| **Solo additions** | **RS-S.1** an optional "all well?" evening check the guest can switch on, with a gentle prompt to share where they are with someone at home (consented, ship-level only, the family-at-home page); **RS-S.2** a **meet-people** reminder for a solo meet-up the guest chose | Off by default |

### 19.3 Family of four (Dad booker; Mom, a 16-year-old and a 12-year-old with no accounts)

| Topic | Finding | Design |
|---|---|---|
| **Mom has no Stanley** | If she registers, she cannot link Dad's booking (direct booking) | Dad shares the **family calendar feed** (REM-E16); the share goes through the phone's own share sheet to Mom's calendar. Her alarms fire with no signal and need no account |
| **Per-traveller deadlines** | "Maya's passport" is a deadline about a person | Traveller-scoped reminders belong to the booking, appear for the booker as "for Maya" and never message Maya |
| **Kids' critical items** | Muster station, kids-club pick-up, all aboard | Delivered to Dad (the account holder) as guardian copies, one card per child per event, rolled up |
| **Teen meet-up time** | A guardian-set rule | A reminder to the guardian; Dad shows or shares the time to the teen himself; Stanley sends nothing to a child |
| **Four people's reminders = four times the noise** | A parent receiving everything for everyone | **Roll-up per booking and period** (REM-E09): "Today for the family: 4 things" |
| **Different needs** | The 12-year-old's pick-up from the kids club; the 16-year-old's later quiet hours | Per-traveller pace and age bands feed leave-by and reminders |

**Family pack** (guardian only): kids club registration, pick-up and drop-off times, each child's muster station and the walk, meet-up times, bedtime and quiet hours, age-gated activities, sun cream and water every two hours on deck (opt-in), the leave-nothing-behind list per child.

### 19.4 Two friends (Alex booker, Jordan with no account)

| Topic | Finding | Design |
|---|---|---|
| **Jordan has nothing** | Everything runs on Alex's account | Alex shares a **"Jordan's trip" calendar feed** or one-off files (REM-E16) |
| **Meet at 5:10** | A group reminder with one account | Alex's own reminder plus a **shareable calendar entry**; Stanley does not message Jordan |
| **Late nights** | They stay out late and go ashore at every port | A **night-owl all-aboard buffer** suggestion; the missed-ship ladder scales with a "I stay out late" memory; party quiet hours at 23:00 |
| **Fill every day** | Many bookings, tight walks | Clustering and the plan-lint warnings (RS-5.11) matter more than more reminders |
| **Settling costs** | A notebook, no money moves | RS-11.11 reads the notebook and says who owes what; nothing is paid or sent |
| **Route 2 or 3 (Jordan has an account)** | Two accounts on one booking | Each accepts their own copy; each sets their own level; Alex cannot set Jordan's reminders |

### 19.5 Other personas (needed packs)

| Persona | Needs | Design |
|---|---|---|
| **Older guest, managed by a relative** | A helper who sees what is outstanding; a phone that is often silent | REM-D04 helper copies of class A and B (consented), the weekly helper summary (RS-4.14), **SMS as the critical last step enabled at set-up by the helper with the guest's agreement**, large text and plain wording |
| **Mobility or access needs** | Longer, safer lead times; tender and step-free cautions | Personal buffer and pace feed leave-by; assistance cut-off ladder (RS-4.6); an **accessibility pack** |
| **Celebration** | A dinner, cake, photo | Occasion reminders and the celebration pack |
| **Large group or reunion (10 or more)** | Organiser tasks and who has answered | Organiser roll-ups, meeting points and a poll ladder; never one notice per person |
| **Returning guest on a second trip** | Habits carried over | Reminder preferences (lead times, buffers, packs saved as "mine") **travel with the guest**; one-time reminders and grants **do not** |

---

## 20. Staff and operations: seeing, supporting and controlling reminders

The most serious complaint a reminder system can cause is **"the app didn't tell me, and I missed the ship."** Staff need to answer it truthfully in minutes.

### 20.1 The delivery log (the evidence)

One row per **firing** (no reminder text): reminder id and kind, class, source, due time, each attempt with channel, sent time, provider result, **device-confirmed receipt** where the app reported it, acknowledged time and by which device, and the stop reason (scanned aboard, paid, cancelled, expired). A guest-visible version (**What happened to this reminder**, one tap on any reminder) shows the same in plain words.

### 20.2 Roles

| Role | Sees | Cannot see |
|---|---|---|
| **Guest Services agent** | For a guest with an **open case and consent in the hand-off**: the delivery log for the relevant firings, the guest's channel state at the time (push permission, installed or not, SMS on or off, quiet hours) and the standard explanation | Reminder text for private reminders; chat; anything unrelated to the case |
| **Supervisor** | The same, plus the ability to **resend** a missed critical notice, pause a kind for a guest, and open a defect with the reminder id | Other guests |
| **Content team** | Packs, per-port content, default lead times, the **critical list** (see 20.4) | Individual guests |
| **Product operations** | **Aggregates**: delivery latency, success by channel, acknowledgement and missed rates by kind and class, snooze and nag rates, SMS spend, volume per ship per hour | Individuals |
| **Engineer on call** | Redacted replays and the switches | Personal data by default |

### 20.3 The operations console

| Screen | Content |
|---|---|
| **Delivery health** | Per channel and class: sent, delivered, acknowledged, late, failed, p95 latency; the fan-out of any ship-wide burst; provider status |
| **Ship view** | Per sailing: reminders due in the next hour, queue depth, burst timing against the 10-second target, and a **ship alert** switch that holds non-critical reminders while the ship makes announcements |
| **Switches** | Global, per lane, class, kind, channel, pack and cohort (ship, sailing, stage). Each change records who, why and when; a global switch needs two people |
| **Breakers** | A channel or kind that fails or storms is paused automatically with a notice to the guest and a staff alert |
| **Replay** | Re-run a reminder's rule from stored inputs against the engine to see what it would do now |
| **Spend** | SMS and email volume against a monthly cap, with alerts |
| **Corrections** | Issue a **correction notice** (RM18) to every affected guest and list who was reached |

### 20.4 Change control for the critical list

The list of things allowed to bypass quiet hours and budgets (all aboard, last tender, muster, missed-ship, a failed payment near a date, a travel cut-off) is **short, published and under change control**: a change needs the content owner and the product owner, a recorded reason, a test and a release note; a `Bypass` without a safety or deadline reason fails a gate test (as in the chat plan).

### 20.5 Guest Services playbook and a new case type

A case type **"A reminder did not reach me"** with the firing id, what the guest expected and what they want (explain, correct, compensate by policy). The agent reads the log aloud in plain words ("Your 60-minute reminder was sent at 3:30 and your phone did not confirm receipt. Your phone's alerts for this app were off"). The standard line includes the honest policy: **reminders are an aid and never replace the ship's own announcements and the guest's own watch** (as published in the terms and in the guest explainer, REM-DL-09). The policy wording and any compensation rule are for the owner and legal to set.

---

## 21. The test harness: how we prove reminders before a guest depends on them

All of this fits `CLAUDE.md`: front-end checks are `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`; server tests are written with the code and **run by the owner, targeted, never a full `dotnet test`**.

### 21.1 Foundations

| Piece | What it is |
|---|---|
| **Injectable clock** | The scheduler and every rule read time from one clock the tests (and the demo test bar) control |
| **Fake channels** | Push, SMS, email, calendar and device receipt with scripted failure and delay |
| **Stage fixtures** | The three test-plan journeys (solo, family, friends), a helper-managed guest, a mobility-needs guest, the seeded supervised family, and event fixtures: a tour moved, a tender delayed, a flight cancelled, a show cancelled, a clock change, a provider outage |
| **The timeline golden** | For each fixture, fast-forward the whole trip on the fake clock and record the **reminder timeline** (every firing, time, class, lane, channel and stop reason) as a stored golden. A change to a golden is a reviewed diff. This one artefact tests all 11 stages at once |
| **Phrase corpus** | The 500-phrase parser corpus (15.1) with expected intents |

### 21.2 Invariants (property tests that must always hold)

1. **A reminder never fires after its stop condition**, and the stop fact is re-read **immediately before** each firing.
2. **One thread message per firing**; a retry updates it and re-notifies (no duplicates, including with two devices).
3. **A firing never lands outside its useful window as an alert.**
4. **Critical safety is never switched off by any setting, budget, calm mode or quiet hours**, and is never silenced by the arbiter.
5. **Quiet hours and do-not-disturb** obey the table in 5.3 for every class and lane.
6. **Private text** is **never** present in a push body, an email, an SMS, a calendar feed, a log or an audit event (a grep-style fixture test over every output channel).
7. **A snooze never passes the deadline.**
8. **An anchored reminder follows its anchor** (moved, cancelled, restored) with the right message.
9. **No reminder is created for another person**, and none is sent to a child.
10. **No reminder contains a link** except into the app.
11. **Every reminder has a window, a stop condition, a class and a ladder**; a spec without them does not compile.
12. **No guest-facing string contains the word "AI".**
13. **The ladder cancels at the stop fact** (scanned aboard cancels every later all-aboard step).
14. **Ship time versus home or port time** is always labelled when they differ.

### 21.3 Other tests

| Layer | Tests |
|---|---|
| **Parser** | The corpus; a mutation test (random word order and punctuation) that never returns a wrong time silently |
| **Clock** | A clock-change night, a daylight-saving day, a ship crossing zones, a phone clock 20 minutes wrong |
| **Ladders** | Each class with each failure (no signal, push refused, SMS off); the exact times of retries |
| **Burst and load** | A simulated ship of **4,000 guests** with identical all-aboard times: critical push delivery within **10 seconds** for 95% on the fake provider with realistic latency; queue depth and memory reported |
| **Soak** | A fleet of ships over a season on the fake clock: due-queue throughput, duplicate count (must be zero), missed count (must be zero), database load |
| **Chaos** | Provider outage, slow provider, duplicate webhook, worker restart mid-run, database failover: reminders resume, none lost, none duplicated |
| **Feed** | Token security, revoke, rotation, private exclusion, sequence bump, the calendar file parses in common calendars |
| **Arbiter** | Storm and roll-up golden cases |
| **Accessibility** | The sheet and cards extend the existing `stanleyAccessibility.test.ts` style; role and announcement tests |
| **Red team** | Injection in the reminder text, SMS header and email header injection, a forged feed token, a replayed confirm token |
| **Delivery self-test** | The test reminder reports correctly for each fake channel state |

### 21.4 Shadow and rollout

1. **Shadow:** compute the system sets for real bookings and compare with what the guest did (did they board on time, pay on time) without sending.
2. **Canary:** one ship or sailing first, then more; class A is released **last** and only after the burst test, the console and the playbook.
3. **Per-cohort kill:** by ship, sailing, stage, kind or channel without a release.
4. **Holdback:** a small fixed group on the old behaviour to measure the effect.

---

## 22. Volume, cost and the reminder diet

A reminder engine that sends everything is unusable. Volume is a design target.

### 22.1 Candidate firings versus what is delivered (assumptions to measure)

| Stage | Candidate firings (7-night trip) | After roll-up and budget: threads | Pushes | Notes |
|---|---|---|---|---|
| Dream, Discover, Book | 5 to 15 over weeks | 5 to 10 | 0 to 3 | Mostly thread and email; no push unless a hold or a payment is near |
| Manage | 25 to 40 over months | 20 to 30 | 8 to 15 | Payment, documents and windows ladders |
| Prebook | 15 to 25 | 10 to 15 | 4 to 8 | |
| Get to the ship | 15 to 20 over two days | 12 to 15 | 6 to 10 | Includes leave-by |
| Embark | 10 to 12 | 8 | 4 to 6 | Muster and sail-away are class A |
| Sea (each day) | 10 to 15 | 6 to 9 | 3 to 6 | The guest's own reminders dominate |
| Port (each day) | 12 to 18 | 8 to 11 | 5 to 8 | Class A pushes at the ladder steps |
| Disembark | 12 to 15 over two days | 10 | 5 to 8 | |
| Remember | 8 to 12 over weeks | 6 to 8 | 0 to 3 | Mostly thread and email |

### 22.2 The diet (defaults, all visible and changeable)

- **Pushes per day** follow the guest's existing `nudgesPerDay`; the default is generous on a port day and tight in Manage. **Critical and the guest's own** reminders never count against it.
- **Info and suggestions** never push unless the guest allowed suggestions; they appear in the thread and the sheet.
- **One roll-up card** replaces many notices (REM-E09).
- **Essentials only** (a calm setting): critical plus the guest's own plus three trip kinds.
- **Every reminder has a "too much" chip** that lowers its kind.

### 22.3 Cost model (shape, not prices)

| Work | Cost class | Driver |
|---|---|---|
| Firing, ladder, arbiter, log | Code and database | Firings per hour; one indexed due-queue; no model |
| Parser | Code first; a **small model** only for phrases the grammar cannot read (target under 10% of creations) | Guests creating reminders |
| System reminder wording | **Templates**; no model | None |
| Web push | Free | Volume |
| Email | Low | Opt-in only |
| **SMS** | **The largest variable cost** | Class A last step for opted-in guests only; per-guest cap; monthly budget alert; a fraud monitor |
| Storage | Small | Firings and logs with the retention below |

**Retention:** reminder rows 180 days after due (existing); firing and delivery detail 90 days after disembark then counters only (proposal); no reminder text in logs.

---

## 23. Accessibility of reminders and the sheet

Target WCAG 2.2 AA (`CLAUDE.md`), with these specifics (extending section 6).

| Need | Design |
|---|---|
| **The sheet** | A focus-trapped dialog opened from the bell, closing on Escape, returning focus to the bell; headings for Needs you, Next up, Today, Later; each reminder a list item with a real heading for its title |
| **Announcements** | Class A: an alert role; B and C: polite; D to F: a quiet status; never more than one announcement per firing |
| **Reading times** | "Four fifteen PM, ship time, Wednesday", with the other zone when it differs; a live "in 30 minutes" refreshes politely each minute, **never as a ticking seconds countdown** (no false urgency) |
| **Entering a time** | Typed words **or** a form with native date and time controls; both give the same preview; times are never entered by dragging or on a clock face only (2.5.7) |
| **Acting** | Got it, Done and the snooze menu are real buttons with a visible focus, 44 px targets, not hover-only, reachable by keyboard from the thread, the sheet and the notification |
| **Notifications** | Text complete without opening the app; vibration **and** visual, never sound alone; plain language at about a grade 6 to 8 reading level |
| **Colour and motion** | State by words and shape; no animation for attention; reduced motion respected; high contrast checked |
| **Zoom** | 200% text and 320 px width without clipping actions |
| **Cognitive load** | One order for every reminder: **what, when, one action**; an **Essentials only** mode; plain-language ladders; no jargon ("tender" has a gloss) |
| **Nag and check-back** | Clear controls with the limits stated; easy to stop from the reminder itself |
| **SMS verification** | The code can be pasted or auto-filled, has no short time limit, and offers resend; no puzzle or memory test (3.3.8) |
| **Consistent help** | The Help button stays in the same place (3.2.6) |
| **Voice** | Reminders can be created and acknowledged by speech through the existing input; the result is always read back |
| **Verification** | `jsx-a11y` lint, extended Vitest accessibility tests, and a **manual screen reader and 200% zoom pass by the owner** as a phase gate (no browser testing from here, per `CLAUDE.md`) |

---

## 24. Privacy and security

*A design review, not legal advice. A privacy and legal review of the consent wording, SMS opt-in and policy line is a launch gate.*

### 24.1 What is stored

| Data | Purpose | Retention | Never |
|---|---|---|---|
| Reminder text and spec | Delivery | 180 days after due; deleted with the account | Used for suggestions or models (private text); logged |
| Firing and delivery log | Evidence, health | Detail 90 days after disembark, then counters | Reminder text |
| Push endpoints and device capability | Delivery | Until the device is removed or 90 days idle | Shared |
| Verified phone number | SMS last resort | Until removed | Used for any other purpose |
| Calendar feed token (hash) | The live feed | Until revoked or sign-out-everywhere | Stored in clear |
| Packs saved by the guest | Reuse | Life of the account | Shared without the guest |
| Consent records (SMS, email, feed, helper copies) | Prove consent | Life of the account | Free text |

### 24.2 Threats and controls

| Threat | Control |
|---|---|
| **Private text on a lock screen or in a feed** | Redaction by class; a hard-stop test over every channel (21.2, rule 6) |
| **Calendar feed token leaks** | Long random token, hashed at rest, revoke and rotate, revoked at sign-out-everywhere, rate-limit, contains only what the guest included |
| **SMS pumping and wrong numbers** | SMS only to a **verified** number the guest chose, class A last step only, per-guest and monthly caps, a fraud monitor, easy removal |
| **Impersonation of the company** | A reminder is always "Your reminder" from Stanley; company notices say "From Sun Princess"; a reminder carries no link but into the app |
| **Injection** (text, email or SMS headers, calendar fields) | Plain text only, stripped of markup and control characters, escaped per channel, 80 characters |
| **Replay or forgery of a confirm token or revert link** | Single-use, expiring, bound to the guest and the preview |
| **Cross-guest access** | Every endpoint scoped to the account, with a test per endpoint; feed tokens unguessable |
| **Insider browsing** | Role-scoped views (20.2), case-scoped and consented, audited |
| **Child exposure** | No reminder to a supervised child; guardian copies only; a gate test |
| **Marketing dressed as reminders** | The suggestion lane only, under the guest's level; promotional content in a reminder is a policy and test failure; SMS is never promotional |
| **Dark patterns** | Nag and SMS are opt-in with their limits shown; "no" is as easy as "yes"; no countdowns |

### 24.3 Consent and rights

Consent is **specific** (SMS, email, feed, helper copies, nag each separate), **informed** (the sentence is shown and versioned), **withdrawable** at any time as easily as it was given, and **recorded**. The guest can **export** their reminders and delivery history as a file and **delete** them with the account.

---
## 25. Technical design (so the plan is buildable)

### 25.1 The shape

Reminders become **one engine with many sources**. A **source** (the booking, the programme, the plan, the guest, a pack, a rule) turns facts into **reminder specs**. The engine **materialises** each spec into **firings** (one row per occasion on a due queue), the scheduler claims due firings, **re-reads the stop fact**, builds the message from a template, passes it through the arbiter and the guest's quiet hours and sends it by the ladder for its class, recording every step. The same scheduler core serves the standing rules in `stanley-actions-and-proactive-plan.md` (its P2c); reminders build the first slice.

```
fact changes -> source builds spec -> materialise firings (due queue)
due firing -> lease -> re-check stop fact -> template -> arbiter -> ladder step -> channels
                                                         \-> record (no text) -> acknowledge / retry / lapse
```

### 25.2 Tables (SQL Server scripts in `db/`)

| Table | Purpose |
|---|---|
| `StanleyReminders` (extend) | Add: kind, when-spec JSON, anchor type and id, zone, source, audience, purpose, lane, class, window end, stop condition, privacy class, pack id, snooze count, state. Existing rows migrate as `clock` kind |
| `StanleyReminderFirings` | One row per occasion and ladder step: reminder, due at, step, **idempotency key unique**, lease owner and expiry, state, attempts, last result |
| `StanleyReminderDeliveries` | One row per attempt: firing, channel, sent at, provider result, device receipt, acknowledged at and by; **no text**. **Builds on the existing push delivery log** (`PushDeliveryRow`: key, kind, bypass, outcome, held reason, devices, params, time, read, acked) rather than a second log |
| `StanleyReminderPacks`, `...PackItems` | Authored packs and ship or port packs, with default offsets and the stage |
| `StanleyReminderPrefs` | Per guest: lanes and channels, kinds on or off, personal buffer and pace, nag defaults, essentials mode, wake time, delivery self-test result |
| `StanleyReminderDevices` | Push endpoints, capability (installed, permission), last seen, last test |
| *Calendar feed (exists)* | The token hash lives in the push store (`SaveFeedHashAsync`); add trip scope, last fetched and the include-list |
| `StanleyChannelHealth`, `StanleyReminderBreakers` | Provider and kind health and breaker state |
| `StanleyReminderConsents` | SMS, email, feed, helper copies, nag, with wording version |

### 25.3 The scheduler and fleet-aligned bursts

**What exists.** `WatchSchedulerService` ticks every 15 minutes, takes a database lock so only one instance runs, and checks up to 500 people per pass, carrying on after the last id. That is fine for payment and check-in notices, but it polls people instead of due times and is too slow and too small for reminders (a 4,000-guest ship is eight passes). **The problem.** An all-aboard time is the same for every guest on the ship. A 4,000-guest ship has about 4,000 critical firings due in the **same second**, several times a day on a port day.

| Concern | Design |
|---|---|
| **Claiming** | Due rows claimed with `UPDLOCK, READPAST` leases in batches so several worker instances run in parallel; the due index is `(state, due_at, class)` so the cost is the burst, not the guest count |
| **Priority** | Class A rows are claimed first; D to F wait; the guest's own reminders are never delayed behind a burst |
| **Fan-out** | Messages are **pre-rendered** (the template and parameters are fixed at materialisation); the send stage is a pool of concurrent senders with per-provider rate-limit handling and exponential backoff; **no database write per send beyond one set-based update per batch** |
| **Target** | **95% of class A pushed within 10 seconds** of the due moment for a 4,000-guest ship, checked by the burst test (21.3) |
| **Jitter** | **None** for A, B and E; up to 20 seconds for C and F (never for anything the guest set) |
| **Per-cohort** | Sailing and ship ids on every firing so a cohort can be paused or throttled |
| **Idempotency** | Unique key (reminder, occasion, step); a duplicate event or a restarted worker cannot send twice |
| **Dead letter** | Firings that fail after the ladder go to a dead-letter table and a staff alert |
| **Clock** | Injectable; the same clock the demo test bar moves |
| **Worker** | A separate process sharing the domain library with the API (as decided in the actions plan), unless the owner prefers a hosted service |

### 25.4 Limits (supersedes REM-CR-07)

| Limit | Value | Why |
|---|---|---|
| The guest's own, active | 40 (the server allows 10 today) | A trip has more than 10 things |
| Repeating, active | 20; the minimum repeat is 30 minutes | Prevent a nag loop |
| Added by Stanley (AUT-02) | 30 per trip | Bounded automation |
| Trip (automatic) | Bounded by the catalogue; no guest limit | Derived |
| Packs active | 10 | Clarity |
| Nag repeats | 5 at most | Not a siren |
| Snoozes | 3 | Then offer to move or drop |
| SMS | 10 per trip, class A last step only | Cost and abuse |
| Test reminders | 5 per day | Abuse |
| Text | 80 characters, plain | Lock screen and injection |
| Calendar feeds | 1 per trip, rotatable | Security |

### 25.5 The server computes; the screen renders

| Piece | Where |
|---|---|
| Parsing, anchoring, windows, stop facts, ladders, leave-by, quiet hours, arbiter | **Server** |
| Preview card, list, sheet, reminder card, delivery check, pack picker, bell badge | Front end, driven by server data |
| Pure formatting (reading times in two zones) | Plain TypeScript module, unit-tested |
| `localReminders.ts` | **Retired as a source** of system reminders; kept only to render **cached firings** offline with their "shown at" times |
| `portPilot.ts` (front-end TypeScript) | **Already ported:** `AwayRules.cs` holds `LandingByMs`, the buffer, queues and the head-back notices, with `TenderRules.cs` and `Itinerary.cs`. R4 extends it with the guest's pace and needs, and moves the 120, 90, 60, 30 and 10 minute steps from the device to the server |
| Existing "remind me in a week" email | Becomes a **channel and a source** of the unified engine; the signed unsubscribe link is kept |

### 25.6 Endpoints (sketch)

| Endpoint | Purpose |
|---|---|
| `POST /me/stanley/reminders/preview`, `POST /me/stanley/reminders` | Read words into an intent and a preview; confirm |
| `GET /me/stanley/reminders` | The list: Yours, Trip, Added by Stanley, with state, next due, owner, channels |
| `PATCH`, `DELETE /me/stanley/reminders/{id}` | Edit, snooze, done, pause a kind, remove |
| `POST /me/stanley/reminders/{id}/ack`, `.../snooze`, `.../done` | From the thread, the sheet and the notification button |
| `GET /me/stanley/reminders/{id}/history` | "What happened to this reminder" |
| `GET /me/stanley/reminder-packs`, `POST .../{id}/add` | Browse and add a pack |
| `GET`, `PUT /me/stanley/reminder-prefs` | Channels, buffers, essentials, nag defaults |
| `POST /me/stanley/reminders/test` | The delivery self-test |
| `POST /me/push/subscribe`, `/unsubscribe`, `/ack`, `/read`, `/dispatch` | **Exist**; extend `/ack` for per-reminder done and snooze |
| `GET`, `POST`, `DELETE /me/calendar-feed`, `GET /calendar/{token}` (**exist**); add `POST /me/calendar-feed/rotate` and an include-list | The live calendar feed |
| `POST /me/stanley/reminders/{id}/share` | A one-off calendar file for the share sheet |
| `GET /staff/stanley/cases/{id}/reminders`, `/ops/stanley/reminders/*` | Case-scoped log; console, switches, breakers, replay, correction |

**New action kinds** for the existing preview and confirm pipeline: `add_reminder_pack`, `share_reminder`, `prepare_wakeup_request`, `set_nag`.

### 25.7 Migration and documents to update

Existing `StanleyReminders` rows become `clock` reminders; the on-device system reminders (`dueReminders`) are replaced by server firings in R4 with the same stop rules; the "remind me in a week" email moves onto the engine without changing its link. **Documents updated in the same change as each phase:** `stanley-data-inventory.md` (every table and retention), `audit-trail.md` (new event kinds), `runbook.md` (S1 to S4, switches, replay, bursts), `functional-requirements.md` and `requirements-clauses.md` (new ids), `server/README.md` (endpoints), the reminder strings, the **stage welcome text** (one reminder line per stage), and the three test plans (a reminders section each).

---

## 26. Delivery plan: research, phases, gates and risks

**This section replaces section 9.** Sizes are relative (S about a week, M two to three, L four or more). Each phase commits and stops; server code is written with tests and run by the owner (targeted, never a full `dotnet test`). Mapping to `stanley-actions-and-proactive-plan.md` is in the last column.

### 26.1 Research first (RR, no code)

| Step | What | Pass mark | If it fails |
|---|---|---|---|
| **RR1: What do guests want reminded?** | A card sort of the section 12 and 13 kinds (want, neutral, creepy, noise) with 6 to 8 people per persona | Each kept kind is "want" for at least half of the personas it applies to and "creepy or noise" for under 10% | Cut or demote |
| **RR2: The preview** | Show the preview card (15.4) and the Reminders sheet; ask "when will this fire, and what happens if you have no signal?" | At least 80% answer both correctly | Reword; add the signal line to the preview |
| **RR3: How much is too much?** | Show a port-day timeline with 5, 8 and 12 pushes | The preferred level sets the default budget | Adjust the diet (22.2) |
| **RR4: Channels** | Who installs the app, grants push, uses the calendar feed, would give a phone number for SMS | Install and grant rates, feed comprehension | If under 40% enable push, make the calendar route the lead offer |
| **RR5: Language** | Read 50 phrases the guests actually say, add to the corpus | Corpus at 500 | n/a |

### 26.2 Phases

| Phase | Scope | Size | Depends on | Done when | Actions plan |
|---|---|---|---|---|---|
| **RR: Research** | 26.1 | S | none | Findings recorded here | R |
| **R1: Smarter creation and the list** | Intent model; deterministic parser and the corpus; preview with ship and port time; ask-don't-guess; limits (25.4); the **Reminders** page (list, edit, delete) from the thread and Settings | M | RR | "In 30 minutes", "tomorrow at 7" and a deleted reminder all work from the thread and the list; the corpus passes | P2a |
| **R2: Anchors and Remind me everywhere** | Anchored kinds; recompute and "moved or cancelled" lines; the **Remind me** control and the **offer** (REM-C01, C03); **Remind me about this** (REM-E17) | M | R1 | Moving a tour moves its reminder and tells the guest | P2a |
| **R3: The scheduler core and the delivery ladder** | Due queue and leases (beside the existing 15-minute `WatchSchedulerService`, which stays as a safety net), injectable clock, firings and deliveries, classes A to G, retries, acknowledge and snooze, all states, quiet-hours and lane rules, redaction, one message per firing, mock senders, **burst test harness** | L | R2 | A closed-app reminder arrives as one message and one push; ignoring a critical one triggers the ladder; the burst test meets 10 seconds | P2c core, P2b |
| **R3b: Real push and the permission journey** | The permission journey (16.2), the **delivery self-test** (16.3), the health line, iPhone install help; **released only with real push keys** | M | R3 and the deployment step | A guest knows, and can test, whether alerts reach them | P2b release |
| **R4: Trip reminder sets** | Server-side system reminders for the stage sets in section 13 (in this order of value and risk: Port, Embark, Disembark, Get to the ship, Manage, Prebook, Sea, Remember, Book, Discover, Dream), the **all-aboard ladder with leave-by**, the arbiter and roll-ups, the bell, badge and **Needs you** | L | R3, server port rules | Each set appears at its lead times and stops when the need is met; the timeline golden passes for the three journeys | P3 and P7 use it |
| **R5: Calendar** | **Extend the existing feed** (reminder entries, alarms by class, sequence numbers, include-list, rotate, private exclusion); per-reminder files; share through the phone's share sheet | S to M | R3 | A subscribed phone sounds a ladder with no signal; revoke works | |
| **R6: Packs and bring lists** | Authoring, serving and adding packs; bring lists in the card; saved personal packs; ship and port packs | M | R2 | A pack adds a set and removes it as a set | |
| **R7: Repeating, private, nag, check-back** | Repeats, sensitive-text class G, the nag and check-back | M | R3 | A daily reminder runs to disembark and ends with a summary; private text never leaves | |
| **R8: Group, guardian, helper, share-sheet** | Meeting reminders each member accepts; guardian copies; helper copies (REM-D04); family and friends flows | M | R3 | A guardian receives a child's all-aboard; a booker shares a family feed | P11 |
| **R9: Staff and operations** | Delivery log, case type and playbook, console, switches, breakers, replay, correction, content tools for packs and the critical list | L | R3 | Staff answer "did my reminder fire?" in under two minutes | P3b |
| **R10: Offline and device** | Local copy with true "shown at" times, the Ship Wi-Fi mode, badge, notification buttons, read-aloud | M | R3b | An offline open shows due reminders with their real times | P3c |
| **R11: SMS last resort** | Verified number, opt-in, class A last step, caps, fraud monitor | S | R3b, R9 | A critical last step reaches an opted-in guest with no data | |
| **R12: Smart timing** | Adaptive leave-by, learned lead times (offered), clustering and cooling | M | R4 | A worsening tender updates the message in place and raises the lane | |
| **R13: Hardening** | Manual screen reader and zoom pass, soak, chaos, red team, privacy and legal review, S1 rehearsal, staff training; also run before each gate | M | any gate | Section 27 targets met | P12 |

### 26.3 Gates

| Gate | Before | Must be true |
|---|---|---|
| **RG0** | R1 is final | RR2 passes (guests understand the preview and the no-signal line) |
| **RG1** | First real push | Delivery self-test works; the redaction hard-stop test passes; consent for email is recorded |
| **RG2** | Class A (all aboard, muster, last tender) reaches a guest | Burst test passes (95% within 10 seconds for 4,000); console, switches and playbook live and rehearsed; the stop-when invariants pass; the policy wording ("an aid, never a replacement") published and legally reviewed; shadow results acceptable; canary on one sailing |
| **RG3** | SMS | Verification, opt-in, caps and fraud monitor; legal review of the wording |
| **RG4** | The calendar feed | Token security review and the private-exclusion test |

**Stop points that stand alone:** after R2 (guests can say a reminder and see it); after R3b (reminders arrive reliably and the guest can test them); after R4 for Port, Embark and Disembark (the safety-critical value); after R5 (offline-proof).

### 26.4 Risks

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| 1 | A missed critical reminder is blamed for a missed ship | M | H | Honest "aid" policy, the delivery log, the ladder, the calendar route, SMS opt-in, ship announcements unchanged |
| 2 | Burst at all-aboard overruns delivery | M | H | Pre-rendered sends, priority classes, per-provider backoff, the burst test, per-ship cohorts |
| 3 | Notification fatigue | H | M | Diet, roll-ups, budget, "too much" chip, essentials mode |
| 4 | Parser reads a time wrong | M | H | Preview always, ask-don't-guess, corpus, mutation tests |
| 5 | iPhone push needs an installed app, so reach is low | H | M | Permission journey, install help, the calendar and email routes as equals |
| 6 | The push sender is still a mock | H | H | R3b released only with real keys; in-thread delivery works first |
| 7 | The server code has never been compiled or run here | H | H | Owner build and targeted test run before R3 |
| 8 | Leave-by assumes one pace for everyone (the server rule exists, with fixed queues and buffers) | M | M | Extend `AwayRules` with pace and needs; keep the guest's `alertBefore`; fixtures for mobility and family |
| 9 | SMS cost or fraud | M | M | Verified numbers, class A last step only, caps, monthly alert |
| 10 | Private text leaks | L | H | Class G, the hard-stop test, no text in logs |
| 11 | Feed token leaks | L | M | Hashed token, rotate, revoke, minimal content |
| 12 | Scope is very large | H | M | Stop points, stage order in R4, packs and persona work after the core |
| 13 | A top-bar bell changes the stage shell | M | M | Decision 12 below; fall back to the Reminders page from the thread and Me |

---

## 27. Measures (consolidated and extended)

Section 8 stays; these add the new capabilities and the gates.

| Measure | Target | Gate or review |
|---|---|---|
| Class A reminder pushed within 10 seconds of its moment | 95% (4,000-guest burst test, then production) | RG2; below 90% over a day |
| The guest's own reminder within 60 seconds of the asked time | 95% | Below 90% |
| Duplicates and missed firings | Zero | Any |
| A reminder that fired after its stop condition | Zero | Any is a defect |
| Parser wrong read shown to the guest (they hit Change) | Under 5% | Over 10% |
| Parser silent wrong read | Zero | Any is S2 |
| Reminders created per guest per trip, by source | Reported | A kind with under 10% usage |
| Acknowledged within the window, by class | A over 90%, others reported | A under 80% (wrong lead time) |
| Missed share by kind | Under 20% | A kind over 20% |
| Snooze three-times rate; nag opt-in rate | Reported | Snooze over 10% |
| Pushes per guest per day, by stage | Within 22.1 | Median over the guest's budget |
| Guests with push on, with the calendar feed linked, with SMS opted in | Reported | Push under 40% |
| Delivery self-test pass rate on first try | Over 80% | Under 60% (permission journey too hard) |
| Calendar feed fetch success; guests who revoke | Reported | Revokes over 5% |
| Private text in any output channel | Zero | Any (hard stop) |
| "A reminder did not reach me" cases; staff time to answer | Falling; under 2 minutes | Any rise; over 5 minutes |
| Boarded on time after a class A ladder | Reported against the holdback | Worse than holdback |
| Guests who add a pack; who save their own | Reported | Under 10% add a pack |
| Reminder SMS spend per guest | Under the monthly cap | 80% of cap |
| Guests who disable reminder push after launch | No rise | Rise of 2 points or more |
| Welcome: guests who open the Reminders sheet in week one | Reported | Under 20% (not discoverable) |

---

## 28. Decisions and open questions (round 2)

**Decided on my judgement (change if wrong; numbering continues from section 10):**

10. **One engine, many sources.** Trip (automatic), the guest's own, Stanley-added, group, helper and ship packs are one model, one list and one record (11.3, 11.4).
11. **The three-owner list.** The guest sees **Yours, Trip and Added by Stanley** in one place with the owner on each row; the guest can turn off a Trip kind except critical.
12. **A bell in the top bar** with a badge and the **Reminders sheet**, beside Help and Search, plus the Reminders page from Me and the thread. This changes the shell from the stage plan, so it **needs your yes**; if no, the page and the thread header carry it.
13. **Calendar as an equal channel.** The live phone-calendar feed and one-off files with alarms are the offline-proof route and the way to reach people with no account (family, friends). They are offered next to push, not after it (RR4 can change this).
14. **SMS only as the critical last resort** (class A last step), opt-in, verified, capped. Unchanged from round 1 but now with caps and a fraud monitor.
15. **Ladders by class (16.4);** the guest can strengthen a non-critical ladder (nag, more channels) or soften it; critical cannot be switched off.
16. **Limits raised** (25.4): the guest's own 40 active (10 today), repeating 20 with a 30-minute minimum.
17. **Critical list under change control (20.4).**
18. **Stop-when is mandatory.** No reminder spec compiles without a window, a stop condition, a class and a ladder (21.2).
19. **Reminders are an aid, never a replacement.** The policy line is published in the terms, the explainer and the thread, and legally reviewed before class A ships.
20. **Per-stage rollout order** in R4: Port, Embark, Disembark, Get to the ship, Manage, Prebook, Sea, Remember, Book, Discover, Dream (safety value first).
21. **Scheduler shared** with the actions plan's P2c; reminders (R3) build the core, standing rules (P9) add rule triggers.
22. **No "AI" word** in any reminder, pack, sheet, preview or notification string, tested.
23. **Detail retention** 90 days after disembark then counters (proposal; confirm with policy).

**Open for the owner:**

1. **The top-bar bell** (decision 12): yes, or the page and the thread header only?
2. **Who owns the legal wording** of the "aid, not a guarantee" line and any compensation rule?
3. **Real push:** is there a date? R3b and class A depend on it.
4. **SMS:** is a real provider and a budget in scope, or should SMS stay a later phase?
5. ~~Server port logic~~ **Answered by the code check:** `AwayRules` already ports leave-by; R4 extends it with pace and needs (section 30).
6. **Packs:** who authors the ship and port packs, and who keeps them current?
7. **Research participants:** where do they come from (staff families, past guests, a panel)?
8. **Wake-up calls:** will the ship offer a real request route, or stay a mock for now?
9. **Do you accept that no phase after R3 begins until the owner has built and run the earlier Stanley server code** (risk 7)?

---

---

## 29. How to read this document (map and reading paths)

The document grew in three layers: round 1 (sections 1 to 10, the first requirements), round 2 (11 to 28, reminders as a core feature) and round 3 (30 to 43, verification and the build specification). **Where layers disagree, section 31 wins and 42.3 lists what was replaced.**

| Part | Sections | What it holds |
|---|---|---|
| **A. Foundations** | 1 to 10 | What exists, the kinds guests want, creation, lifecycle, delivery rules, privacy, screens, measures, first decisions |
| **B. Vision and model** | 11 to 14 | The feedback, the findings, the principles, the object model, the taxonomy, the per-stage deep dive (with priorities) and packs |
| **C. Behaviour** | 15 to 19 | The parser, delivery in depth, smart timing, mistakes, personas |
| **D. Operate** | 20 to 24 | Staff and operations, the test harness, volume and cost, accessibility, privacy and security |
| **E. Build** | 25 to 29 | Technical design, the delivery plan, measures, decisions, this map |
| **F. Verify and specify** | 30 to 41 | The code and market check, the spec at a glance, releases, the state machine, machine-readable specs, acceptance criteria, the copy deck, screens, edge cases, analytics, migration, defaults |
| **G. Reference** | 42, 43 | Glossary, shared ownership, supersession register, the index |

**Reading paths**

| You are | Read |
|---|---|
| **The product owner** | 11, 13, 31, 32, 26, 28, 41 |
| **A developer** | 30, 31, 33, 34, 25, 35, 40 |
| **A designer or writer** | 11.5, 15, 16, 36, 37, 23 |
| **A tester** | 21, 35, 38, 33 |
| **Guest Services or operations** | 18, 20, 38 |
| **Privacy, security or legal** | 24, 36.4, 36.6, 26.3, 31.6 |

---

## 30. Verification pass: what the code and the market actually say

This section records a read of the code and a short external scan, done after the first two rounds, so the plan rests on facts. **Nothing was run** (per `CLAUDE.md` no browser testing, and no full `dotnet test`); these are source reads. Where a fact changed the plan, the earlier sections were corrected in place (marked *Corrected*).

### 30.1 Corrections to the first two rounds

| # | Earlier claim | What the code says | Effect |
|---|---|---|---|
| 1 | "No server clock; evaluation only when the app calls in" | `WatchSchedulerService` (a hosted service) calls the same dispatch **every 15 minutes** for up to **500 people per pass**, under a database lock | A coarse clock exists. R3 adds a **due-queue** for precision and scale and keeps the poll as a safety net |
| 2 | "A calendar feed is new" | `CalendarFeedService`, `/me/calendar-feed`, `/calendar/{token}`, hashed token, revoke, **`VALARM` alarms** exist | R5 **extends** the feed to carry reminders; smaller |
| 3 | "A second delivery log is needed" | `PushDeliveryRow` already records key, kind, bypass, outcome, held reason, device count, params, time, `Read`, `Acked`; `/me/push/ack` exists | Build the delivery log on it |
| 4 | "SMS fallback for critical is new" | `PushRules.FallbackAfter` is **10 minutes** and `FallbackExpires` **3 hours**: an unacknowledged safety alert goes once by text to a **verified** phone, else by email to a **verified** address (COM-04); the "head back" notice for a guest who is away also goes straight by text | Keep; extend to per-class ladders and the earlier retries |
| 5 | "Leave-by may not exist on the server" | `AwayRules.LandingByMs` (all aboard less buffer, queue and walk; default buffer 45, gate walk 15, pier queue 15, tender queue 25, last tender), a guest `alertBefore` setting (default 45) and head-back notices exist | Extend with pace and needs; risk 8 downgraded |
| 6 | "Push is only a mock" | The sender is a mock but the **service worker is real**: `push-sw.js` handles `push` and `notificationclick`, keeps critical notices on screen (`requireInteraction`), tags and re-notifies, and opens the right screen | R3b needs real keys only, not new browser plumbing |
| 7 | "Add notification buttons and a badge" | `push-sw.js` has **no `actions`, no badge** and the manifest has **no `share_target`** (it has three shortcuts) | Still new; each needs device testing |
| 8 | "Thread messages for firings are all new" | The Stanley thread already carries **thread-only notices** (muster drill, documents, check-in, answered cases) built by `StanleyNoticeRules.ScreenNotices`, "none of which is ever pushed", and proactive moments | Reminders reuse the thread-message path |
| 9 | "Reminders are guest-only" | Existing push kinds: `allAboard`, `backAboard`, `scheduleChange`, `disruption`, `payment`, `reminder`, `travel`, `reservation`, `case`, `change`, `helper`, `chat` | The mapping to the new kinds and classes is in section 40 |
| 10 | "Only 10 pending reminders" | Confirmed: `StanleyReminderRules.MaxPending = 10`, `LateHours = 12`, `TextMax = 80`, within 24 hours | Replaced by section 25.4 |

### 30.2 What exists to build on

| Piece | Where | Use |
|---|---|---|
| Push dispatch, quiet hours, do-not-disturb, calm, daily budget, critical bypass | `PushService`, `PushRules` | The arbiter's first form |
| Delivery log with `Acked`, `/me/push/ack`, `/me/push/read` | `PushDeliveryRow`, `PushEndpoints` | The delivery log (20.1) |
| Unacknowledged-alert fallback to text or email | `PushRules.FallbackDue`, `PushService.FallbackAsync` | Class A and B ladders |
| Email and SMS to **verified** addresses and numbers only | `EmailCheckService`, `PhoneCheckService` | SMS opt-in and consent (24.3) |
| 15-minute scheduler with lock | `WatchSchedulerService`, `IWatchLock` | Safety net beside the due-queue |
| Chat urgent retry (hosted) | `ChatUrgentRetryService` | Retry pattern |
| Calendar feed, token, alarms | `CalendarFeedService`, `CalendarRules` | R5 |
| Leave-by, head-back notices, `alertBefore` | `AwayRules`, `PushService` | R4 and section 17 |
| Tender outlook | `TenderRules` | Leave-by input |
| Guest reminder (clock only) | `StanleyReminderRules`, `StanleyReminderService` | R1 migrates it |
| "Remind me in a week" email, signed unsubscribe | `ReminderRules`, `ReminderEmailService` | A channel and a source |
| Thread-only notices | `StanleyNoticeRules.ScreenNotices` | The firing record in the thread |
| On-device due list | `localReminders.ts` | Offline fallback only |
| Service worker | `public/push-sw.js` | Extend with actions and badge |
| Nudge budget, calm and simple mode | `nudges`, `settings.ts` | The diet (22.2) |

### 30.3 What does not exist (the real gaps)

A due-queue and per-firing records; snooze and Done per reminder; anchored, relative, repeating, event and conditional reminders; a parser beyond `HH:MM`; a Reminders list, sheet or bell; a **Remind me** control anywhere; packs; reminder entries in the calendar feed; a pace or needs input to leave-by; notification action buttons, the app badge and a share target; a real push key and a real SMS provider; a per-class ladder and the steps before 10 minutes; reminder analytics.

### 30.4 Platform findings (external scan, to be confirmed on devices)

| Finding | Source | Decision |
|---|---|---|
| Web push on iPhone arrived with **iOS 16.4** and works **only for a site added to the Home Screen**; other browsers on iOS do not count; the app must be installable | [Pushpad](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications), [MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) | The permission journey and install help (16.2) are required, not optional |
| iOS 16.4 also added the **Badging API** for Home Screen web apps | [OneSignal](https://documentation.onesignal.com/docs/web-push-for-ios) | Badge is feasible on iPhone and Android installed apps |
| **Safari 18.4** added Declarative Web Push; **iOS 26** opens Home Screen sites as web apps by default | [Slight Future](https://slightfuture.com/webdev/progressive-web-apps-2026/) | Plan to test declarative push; no dependency yet |
| **Notification action buttons on iOS: not confirmed** by the scan | none found | Treat buttons as an enhancement; **Got it and Snooze must also be one tap in the thread** |
| **EU status of Home Screen web apps and push: conflicting reports** | [Monterail](https://www.monterail.com/blog/pwa-for-apple-ios) and others | Test on a real EU-region iPhone before launch; the calendar and email routes are the fallback |

### 30.5 Market findings (what competitors do)

| Finding | Source | What we do with it |
|---|---|---|
| Royal Caribbean sends **all-aboard alerts starting one hour before**, with a **countdown and progress bar** showing the time left in each | [Cruise Hive](https://www.cruisehive.com/royal-caribbean-app-floods-users-with-message-notifications/175751) and [AOL](https://www.aol.com/articles/royal-caribbean-tries-solve-cruise-131931425.html) | We match and exceed: a ladder from 120 minutes, **leave-by** (not just all aboard) and a **delivery check**. A time-left bar is allowed for class A only, **refreshed each minute, never a ticking seconds clock** (decision 24) |
| Adding an event to the calendar in the app triggers a **push 30 minutes before it starts** | [Royal Caribbean Blog](https://www.royalcaribbeanblog.com/2025/08/26/6-royal-caribbean-app-upgrades-need-be-added) | The market default for events is **30 minutes**; RS-8.1 now says so |
| In May 2025 the Royal Caribbean app sent a **burst of test notifications** ("test segment 1" to "19") to real guests | [Cruise Hive](https://www.cruisehive.com/royal-caribbean-app-floods-users-with-message-notifications/175751) | Test messages never go to real guests: a **test flag**, a **cohort allow-list** for staging sends, a **kill switch** and a rehearsal (RG2, 21.4) |
| Celebrity sends **email reminders and app notifications** for important steps along the way | [Celebrity Cruises](https://www.celebritycruises.com/blog/celebrity-cruises-app) | Email as a first-class second channel for Manage (important lane) |
| Third-party "all aboard" apps say they **do not replace official cruise line communications** | [All Aboard on the App Store](https://apps.apple.com/app/id6763932232) | Our "an aid, never a replacement" line (decision 19) is the accepted norm |
| Princess and Carnival reminder behaviour could not be verified from public pages | search results | Check the live Princess app's notification settings directly before launch (an owner task) |

---

## 31. The specification at a glance (the canonical reference)

If earlier text and this section disagree, **this section wins.** It is written so a developer can build from one page.

### 31.1 Lanes and classes

| Class | Lane | Used for | Windows (useful until) | Ladder (steps, all firings) | Channels | Snooze | Bypass quiet hours | Stops when |
|---|---|---|---|---|---|---|---|---|
| **A** Safety and be-back | critical | All aboard, last tender, muster, head back, missed-ship | Until the ship sails (all aboard); until muster ends; until aboard | See 31.3 | thread, push, in-app pop-up, SMS and email fallback (10 minutes, existing), calendar fixed alarms | No (acknowledge only) | Yes | Scanned aboard or the ship sails |
| **B** Critical deadline | critical | Payment failed or overdue near the date, check-in cut-off within 3 hours, a travel cut-off that can cost the sailing | Until the deadline | Now; +10 minutes; +1 hour; next morning if the date is ahead | thread, push, email (opt-in) | No | Yes | Resolved or date passes |
| **C** Important deadline | important | Payment ladder, documents, assistance, booking windows, dining freeze | Until the deadline | Now (waking hours); next morning | thread, push, email | Yes | No (held to waking hours) | Resolved |
| **D** Appointment | reminder | Dinner, show, tour, class, meeting | Until the start time | At the lead time | thread, push, calendar | Yes (never past the start) | No | Time passes or attended |
| **E** The guest's own | reminder | Anything the guest created | 4 hours after the moment; a repeat until the next occurrence | At the time asked; optional nag | thread, push, calendar | Yes | **Yes (the guest chose the time)** | Done |
| **F** Info and suggestion | info or suggestion | Offers, "photos ready", "on this day" | 24 hours; a week for "photos" | Thread; one push a day only if suggestions are on | thread | Yes | No | Seen or expired |
| **G** Private | reminder | Health and access wording | As E | As E, redacted everywhere, optional check-back | thread, push (redacted) | Yes | Yes (the guest's time) | Done |

### 31.2 Lead-time defaults (the guest can change each; a personal buffer applies to class A)

| Occasion | Default |
|---|---|
| Show or event in the plan | **30 minutes** before, with the walk time in the text |
| Dinner or a specialty reservation | 60 and 20 minutes before |
| Excursion | The evening before and **90 minutes** before the meeting time; the bring list in the card |
| Muster | 30 and 10 minutes before, and at the start |
| Kids club pick-up (guardian) | 30 and 10 minutes before |
| Tender ticket pick-up | Per the ship's time, 30 minutes before |
| Final payment | 30, 14, 7 and 2 days, and the day; overdue daily for 3 days |
| Check-in | At opening; 48, 24 and 3 hours before the cut-off |
| Bag night | 18:00 and 60 minutes before the cut-off |
| Booking windows | At opening |
| Documents | 90, 45 and 14 days |
| Payment, documents (email second channel) | The same day, in the important lane |

### 31.3 The all-aboard ladder (class A, per port day)

| Step | When | Delivered by | Notes |
|---|---|---|---|
| 1 | 120 minutes before all aboard | **Thread only** (a quiet note) | The guest can promote it to a push |
| 2 | 90 minutes | Thread only | |
| 3 | 60 minutes | Thread and **push** | The first loud one |
| 4 | **Leave-by** (computed) | Thread and push | Updated in place when tender or queue changes |
| 5 | 30 minutes | Thread and push; **retry** at +2 and +5 minutes if not acknowledged | |
| 6 | 10 minutes | Thread, push, **pop-up** if the app is open; **text** to a verified phone if opted in | |
| Fallback | +10 minutes after any unacknowledged push | **Text** (or email) once, as COM-04 does today | Stale after 3 hours |
| Stop | Scanned aboard or the ship sails | Cancels all later steps | |

The guest's `alertBefore` and personal buffer shift steps 4 to 6. Tender ports add the **last tender** as its own class A reminder.

### 31.4 Limits (final)

The guest's own: 40 active, 20 repeating (minimum repeat 30 minutes), text 80 characters. Added by Stanley (AUT-02): 30 per trip. Packs active: 10. Nag: at most 5 repeats. Snoozes: 3. SMS: 10 per trip, class A last step only. Test reminders: 5 a day. Calendar feeds: 1 per trip (extends the existing one-per-guest feed), rotatable.

### 31.5 Quiet hours and bypass

Quiet hours default 22:00 to 07:00 (the existing default). **Bypass** only for class A, class B, class E and class G at the guest's chosen time, and for a ship alert. Everything else is **held to the end of quiet hours**, shown in the thread at once, pushed after. A `Bypass` without a safety or deadline reason, other than the guest's own time, fails a gate test.

### 31.6 The critical list (published, under change control, section 20.4)

All-aboard ladder; last tender; muster drill; head-back notice for a guest who is away; missed-ship path; a payment that failed or is overdue within 7 days of the final date; check-in cut-off within 3 hours; a travel disruption that can cost the sailing; a child's muster station, kids-club pick-up and all aboard (to the guardian); a ship-wide alert. **Nothing else.**

### 31.7 Time

Pre-trip anchors in the guest's home zone; onboard anchors in **ship time**; every time labelled with its zone when two differ; a time that does not exist or repeats on a clock-change night takes the first valid instant and says so; the guest's own "7:00" stays 7:00 ship time across a clock change.

### 31.8 Channels per class (summary)

Thread: all. Push: all but F (conditional). Email: B, C (opt-in) and the A fallback. SMS: A last step and the 10-minute fallback, **verified numbers only**, never promotional. Calendar feed: A, B, C, D, E non-private. Local copy and read-aloud: A in the app. Ship wake-up call: a prepared request only.

---

## 32. Priorities and releases: what ships first

The stage tables in section 13 now carry a priority (P0 31, P1 51, P2 49). A **release** is a set of reminders and the capabilities they need, meaningful to a guest on its own.

### 32.1 Release 1: "Safe and on time" (all P0)

| Scope | Content |
|---|---|
| **Stage reminders** | The 31 P0 rows: payment failure and the payment and instalment ladders (RS-3.2, 4.1, 4.2); documents and itinerary-change deadlines (4.4, 4.13); check-in, boarding pass, flight and leave-by and the running-late path (6.1 to 6.4, 6.12); muster, sail-away and first dinner (7.1, 7.2, 7.5); the whole port day (9.1 to 9.6); the day plan, dinners, time moves, clock changes and tomorrow's port (8.1 to 8.6); excursion lead times and plan moves (5.5, 5.12); bag night, exit time, vacate and onward travel (10.1, 10.2, 10.8, 10.10) |
| **Kinds** | REM-A01 to A07 P0, REM-B01 to B05, REM-C01 and C03, REM-D02 (guardian copies), REM-E01 leave-by, E03 ladders with consequence, E09 roll-up, E14 phone-calendar copy, E15 three packs (**Travel day, First four hours, A port day**), E17 Remind me about this |
| **Capabilities** | The parser and the preview; the list and the bell with badge; Remind me everywhere; the due-queue, classes A to E and the ladder; the delivery self-test; the permission journey; the calendar feed extension; **operations v1** (the delivery log, switches, breakers, the playbook, the correction notice); the thread record |
| **Phases** | RR, R1, R2, R3, R3b, R4 (Port, Embark, Disembark, Get to the ship, Manage, Prebook, Sea), R5, R9 (v1), R13 |
| **Gates** | RG0, RG1, RG2 (class A), RG4 (feed) |
| **What a guest notices** | "Stanley tells me when to leave the pier and again when to hurry, and I can test it works." |

Stages with **no P0 row**: Dream, Discover and Remember. They ship in releases 2 and 3.

### 32.2 Release 2: "Smart and shared" (P1)

The 51 P1 rows (early deadlines, booking windows, packs, bring lists, Remember essentials); **repeating**, **private** (class G), **nag** and **check-back**; **group, guardian and helper** copies and the **share sheet** for people with no account; **SMS** for the class A last step and its caps; **leave-by pace** and learned lead times (offered); **offline** local copy, badge and notification buttons; **ship and port packs**; the **morning brief and evening look-ahead**; staff tools v2 (replay, spend, cohorts). Phases R6, R7, R8, R10, R11, R12; gates RG3.

### 32.3 Release 3: "Delight" (P2)

The 49 P2 rows (Dream and Discover nudges, occasion, wellbeing packs, conditional and sequence reminders, wake-up request, voice, read-aloud), the memory timeline, and anything that waited for usage numbers.

### 32.4 The thin slice, if time is very short

**Class A for the port day (RS-9.1 to 9.3), the payment ladder (RS-4.1, 4.2), check-in (RS-6.1), the guest's own reminders (REM-B01 to B04) and the delivery self-test.** This is the smallest set that addresses "I missed the ship" and "I missed a payment", and it needs RR, R1, R3, R3b and a trimmed R4.

---

## 33. The state machine (formal)

### 33.1 Two levels

A **reminder** (the series: what and when) and a **firing** (one occasion and ladder step). Most states in section 4 are firing states; the series has only three.

**Reminder (series) states:** `active`, `paused` (the guest or ops paused it), `ended` (with a reason: `done`, `cancelled`, `expired`, `no-longer-needed`, `trip-ended`).

**Firing states:** `scheduled`, `leased` (claimed by a worker), `sending`, `delivered`, `acknowledged`, `late`, `missed`, `superseded`, `skipped` (no longer needed or held and dropped), `failed` (to dead-letter).

### 33.2 Firing transitions

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| (new) | Materialise | The spec is valid (window, stop, class, ladder) | `scheduled` | Idempotency key stored |
| `scheduled` | Fact changed and the time moved | Anchored | `scheduled` (new time) | One "moved" message; sequence bump in the feed |
| `scheduled` | Anchor cancelled | | `skipped` | "Cancelled because..." and an offer to keep it as a clock reminder |
| `scheduled` | Time arrives | The worker wins the lease | `leased` | |
| `leased` | **Stop fact re-read** says done | | `skipped` | No message; the reason recorded |
| `leased` | Held by quiet hours or budget | Not bypass | `scheduled` (at the end of the hold) | Thread message now, no push |
| `leased` | Past its useful window | | `missed` | A quiet "missed" line |
| `leased` | OK to send | | `sending` | Template rendered |
| `sending` | A channel accepts | | `delivered` | Delivery row; the thread message created or updated |
| `sending` | All channels refuse | Ladder has a next channel | `sending` (next channel) | Channel health updated |
| `sending` | All channels refuse | Ladder exhausted | `failed` | Dead-letter and a staff alert |
| `delivered` | Guest taps Got it or Done, on any device | | `acknowledged` | Syncs everywhere; later ladder steps cancelled if the need is met |
| `delivered` | Guest snoozes | Not class A or B; snoozes under 3; the new time within the window | `superseded` | A new firing at the snooze time |
| `delivered` | Snooze refused | Past the window | `delivered` | Reason shown ("Dinner is in 40 minutes") |
| `delivered` | Ladder retry due | Class A or B and not acknowledged | `sending` | The same message updated, re-notified |
| `delivered` | Sent after the due moment | Inside the window | `late` | "Late" and the real time on the message |
| `delivered` or `late` | Window ends | Not acknowledged | `missed` | One quiet line |
| any live | A newer firing for the same occasion | | `superseded` | "Replaced by a newer message" |
| any live | The guest deletes the reminder | | `skipped` | Record in the thread |
| any live | The need is gone (paid, checked in, scanned aboard) | | `skipped` | "No longer needed" on the message |

### 33.3 Reminder (series) transitions

| From | Event | To | Notes |
|---|---|---|---|
| `active` | The guest pauses a kind or "pause all for today" | `paused` | Class A, B and the guest's own are not pausable by "pause all" |
| `paused` | The pause ends | `active` | Missed firings are not replayed |
| `active` | All firings terminal and no repeat left | `ended` (`done`) | |
| `active` | The trip ends | `ended` (`trip-ended`) | One summary |
| `active` | The guest deletes it | `ended` (`cancelled`) | |
| `active` | The need is gone for good | `ended` (`no-longer-needed`) | |
| `active` | Past its end date | `ended` (`expired`) | |

### 33.4 Rules on the machine

A firing never moves backward. `acknowledged`, `missed`, `superseded`, `skipped` and `failed` are terminal. The **stop fact is re-read at the `leased` step every time**. Every transition writes one row (no text). A bad transition is a test failure, not a runtime surprise.

---
## 34. Machine-readable specifications

These are the shapes the server stores and the tests assert. They are written so a developer can implement them without further questions; field names are indicative and the final spelling follows `db/` and the contracts.

### 34.1 The reminder spec (fields and validation)

| Field | Type | Rules |
|---|---|---|
| `id` | GUID | Server-made |
| `source` | enum `guest`, `trip`, `stanley`, `stanley-auto`, `group`, `helper`, `ship` | `trip` and `ship` specs are generated; the guest cannot create them |
| `owner` | account id | Whose list it is in |
| `audience` | enum `owner`, `guardian-of:{personId}`, `member-copy:{accountId}`, `helper-copy:{accountId}` | A copy exists only after acceptance (group) or consent (helper) |
| `kind` | string from the catalogue | e.g. `allAboard`, `payFinal`, `clock`, `anchored`, `leaveBy` |
| `class` | enum `A`..`G` | Required; sets the ladder (31.1) |
| `lane` | enum `critical`, `important`, `reminder`, `info`, `suggestion` | Derived from the class unless the guest lowers it (never raises it above the class) |
| `purpose` | enum from 12.2 | |
| `when` | one of `clock{at, zone}`, `relative{from, seconds}`, `anchored{anchorType, anchorId, offsetSeconds}`, `ladder{anchor, offsetsSeconds[]}`, `repeating{rule, until}`, `event{fact}`, `conditional{event, condition}`, `sequence{after}`, `leaveBy{deadlineRef, pace, bufferMinutes}` | At least one; `repeating` minimum interval 30 minutes; `at` must be in the future and within the trip unless `source=trip` |
| `zone` | IANA id | The zone it was meant in (ship, home or port) |
| `windowEnd` | rule or instant | Required; a late firing after it becomes `missed` |
| `stop` | `{fact, ref}` | Required; the fact that ends it (31.1) |
| `text` | string 1 to 80, plain | Required for `guest`; for `trip` a **template key** and parameters |
| `templateKey`, `params` | string, object | For generated reminders |
| `actions` | list of `gotIt`, `done`, `snooze`, `open{path}`, `prepare{actionKind}`, `undo` | `snooze` only where the class allows |
| `privacy` | enum `normal`, `private`, `safety` | `private` forces class G handling |
| `delivery` | `{ladder, channelsOn, overrides}` | Overrides may only **strengthen** a non-critical ladder or soften it; never remove class A or B |
| `pack` | string or null | |
| `provenance` | `{fact, asOf, createdBy}` | Shown in "Why am I seeing this?" |
| `state` | enum (33.1) | |
| `snoozes` | int 0 to 3 | |
| `createdAt`, `updatedAt` | UTC | |

**Validation that must reject:** no window, no stop, no class, text over 80, a link or markup in text, a time in the past, a repeat under 30 minutes, an audience that is another person's account without acceptance, a supervised child as the audience, more than the limits (25.4).

### 34.2 Three examples

```json
{ "source": "trip", "kind": "allAboard", "class": "A", "lane": "critical", "purpose": "be-there",
  "when": { "ladder": { "anchor": { "type": "allAboard", "id": "port:2027-03-12:COZ" },
                         "offsetsSeconds": [-7200, -5400, -3600, "leaveBy", -1800, -600] } },
  "zone": "ship", "windowEnd": { "rule": "shipSails" },
  "stop": { "fact": "presence=back|shipSailed", "ref": "port:2027-03-12:COZ" },
  "templateKey": "reminder.allAboard", "params": { "port": "Cozumel" },
  "actions": ["gotIt", "open:/port/today"], "privacy": "safety",
  "delivery": { "ladder": "A", "channelsOn": ["thread", "push", "calendar"] },
  "provenance": { "fact": "itinerary", "asOf": "2027-03-12T10:42:00Z", "createdBy": "trip" } }
```

```json
{ "source": "guest", "kind": "anchored", "class": "E", "lane": "reminder", "purpose": "be-there",
  "when": { "anchored": { "anchorType": "allAboard", "anchorId": "port:2027-03-12:COZ", "offsetSeconds": -2700 } },
  "zone": "ship", "windowEnd": { "rule": "anchorTime" },
  "stop": { "fact": "presence=back", "ref": "port:2027-03-12:COZ" },
  "text": "Be back on board", "actions": ["gotIt", "snooze"], "privacy": "normal",
  "delivery": { "ladder": "E", "channelsOn": ["thread", "push", "calendar"] } }
```

```json
{ "source": "guest", "kind": "repeating", "class": "G", "lane": "reminder", "purpose": "rest",
  "when": { "repeating": { "rule": "daily@08:00,20:00", "until": "disembark" } },
  "zone": "ship", "windowEnd": { "rule": "nextOccurrence" }, "stop": { "fact": "tripEnded" },
  "text": "(private; never in a push body, email, SMS or feed)", "actions": ["done", "snooze"],
  "privacy": "private", "delivery": { "ladder": "G", "channelsOn": ["thread", "push-redacted"], "checkBack": true } }
```

### 34.3 The class parameters as data

```json
{ "A": { "lane": "critical", "snooze": false, "bypassQuiet": true, "retryMinutes": [2, 5], "fallbackAfterMinutes": 10, "fallbackStaleHours": 3, "jitterSecondsMax": 0,  "calendarAlarmsMinutes": [60, 30, 10] },
  "B": { "lane": "critical", "snooze": false, "bypassQuiet": true, "retryMinutes": [10, 60], "nextMorning": true,   "jitterSecondsMax": 0 },
  "C": { "lane": "important", "snooze": true, "bypassQuiet": false, "nextMorning": true,                          "jitterSecondsMax": 20 },
  "D": { "lane": "reminder",  "snooze": true, "bypassQuiet": false,                                                  "jitterSecondsMax": 0 },
  "E": { "lane": "reminder",  "snooze": true, "bypassQuiet": true, "nagMax": 5, "nagIntervalsMinutes": [5, 10, 15], "jitterSecondsMax": 0 },
  "F": { "lane": "info",      "snooze": true, "bypassQuiet": false, "pushPerDayMax": 1,                              "jitterSecondsMax": 20 },
  "G": { "lane": "reminder",  "snooze": true, "bypassQuiet": true, "redact": "everywhere", "checkBack": true,       "jitterSecondsMax": 0 } }
```

The defaults mirror the existing `FallbackAfter` (10 minutes) and `FallbackExpires` (3 hours). A change to a class parameter is a reviewed change with a test, and a change to class A or B needs the critical-list approval (20.4).

### 34.4 How each Release 1 reminder is derived (the P0 rows)

*"verify" marks a store or service I did not open in the code check; confirm its name and shape in R4.*

| RS id | Source facts | Generator | Re-materialise when | Stop fact | Template key |
|---|---|---|---|---|---|
| 3.2 | Payment attempt status | `PaymentFailed` | A payment event | Payment succeeded; booking cancelled | `reminder.pay.failed` |
| 4.1 | Booking `FinalDueDate`, balance (`TripService.BuildAsync`, `Plan.FinalDue`) | `PayFinalLadder` (30, 14, 7, 2, 0, overdue) | Payment or date change | Balance is zero | `reminder.pay.final` |
| 4.2 | Instalment schedule (verify store) | `InstalmentLadder` | Schedule or card change | Taken | `reminder.pay.instalment` |
| 4.4 | Traveller documents, return date (`DocumentService`, `DocumentRules`) | `DocGuard` (90, 45, 14) | A document or the itinerary changes | Resolved | `reminder.docs.guard` |
| 4.13 | Change record and its decision deadline (`StanleyChangeService`) | `ChangeDecision` | A new change | A choice made | `reminder.change.decide` |
| 5.5 | Booked excursion and meeting time (excursion store, verify) | `ExcursionLead` (evening before; 90 minutes) | Excursion or plan change | The tour starts; cancelled | `reminder.excursion.lead` |
| 5.12 | Programme versus plan items (`program.Current`, plan store) | `TimeMoved` | A programme change | Resolved | `reminder.plan.moved` |
| 6.1 | Check-in `OpensAt`, cut-off and state (`CheckinService`, `TripRules`) | `CheckinLadder` | State or date change | Checked in | `reminder.checkin` |
| 6.2 | Boarding pass state and a device-saved flag (verify) | `PassSaved` | Pass issued | Saved offline | `reminder.pass.save` |
| 6.3 | Flight status (mock) | `FlightWatch` | A status change | Landed | `reminder.flight.watch` |
| 6.4 | Arrival window, traffic (mock), guest pace | `LeaveForTerminal` (leave-by) | Traffic, plan or pace change | At the terminal | `reminder.terminal.leave` |
| 6.12 | Flight and traffic risk against the sailing | `RunningLate` | A status change | Resolved | `reminder.late.path` |
| 7.1 | Drill time (`AboardRules.DrillAt`), station, muster flag (`IOnboardStore`) | `MusterLadder` (30, 10, start) | Itinerary change | Muster done | `reminder.muster` |
| 7.2 | Sail-away (`Itinerary`) | `SailAway` | Itinerary change | The ship sails | `reminder.sailaway` |
| 7.5 | Plan items for the first evening | `PlanItemLead` | Plan change | The time passes | `reminder.plan.lead` |
| 8.1, 8.2, 8.3 | Plan items, dinner and spa bookings, kids club times | `PlanItemLead` (30; 60 and 20 for dinner) | Plan or programme change | The time passes | `reminder.plan.lead` |
| 8.4 | Programme diff | `TimeMoved` | Programme change | Resolved | `reminder.plan.moved` |
| 8.5 | Itinerary zone change tonight | `ClockChange` | Itinerary change | Acknowledged | `reminder.clock.change` |
| 8.6 | Tomorrow's port day, excursion, tender (`AboardRules.PortDayAt`, `TenderRules`) | `TomorrowPort` (18:00) | Itinerary or plan change | Acknowledged | `reminder.port.tomorrow` |
| 9.1 | All-aboard (`AboardRules.WithState`), presence rows (`AwayRules`) | `AllAboardLadder` (31.3) | Itinerary or presence change | Presence `back`, or the ship sails | `reminder.allAboard.*` |
| 9.2 | `AwayRules.LandingByMs`, `alertBefore`, buffer, presence | `HeadBack` (leave-by) | Presence, tender or queue change | Presence `back` | `reminder.headBack` |
| 9.3 | Last tender rule, tender outlook (`TenderRules`) | `LastTender` | Outlook change | Presence `back` | `reminder.lastTender` |
| 9.4 | Excursion meeting time | `ExcursionMeeting` (90, 30 minutes) | Plan change | Starts | `reminder.excursion.meeting` |
| 9.5 | Tour return time against the buffer | `LateBackWarning` | Plan or tender change | Resolved | `reminder.excursion.lateBack` |
| 9.6 | Itinerary zones | Formatting, not a reminder | n/a | n/a | n/a |
| 10.1 | Disembark data (`DisembarkService`): bag cut-off | `BagNight` (18:00; 60 minutes before) | Itinerary change | Bags out | `reminder.bags` |
| 10.2 | Exit-time choice (verify) | `PickExit` | Itinerary change | Chosen | `reminder.exit.pick` |
| 10.8 | Vacate time (verify) | `VacateCabin` | Itinerary change | Left | `reminder.vacate` |
| 10.10 | Onward flight (mock), transfer | `OnwardLeaveBy` | Flight change | Departed | `reminder.onward.leave` |

### 34.5 The fact changes that re-materialise reminders

Booking changed; payment event; itinerary or programme change; plan item added, moved or removed; document added or changed; check-in state change; boarding pass issued; scan events (aboard, back aboard, at the terminal); presence changes (leaving, ashore, back); tender outlook change; flight or traffic status (mock); change record created; excursion booked, moved or cancelled; a pack added or removed; the guest's buffer, pace or channel change. Each change **re-materialises only the affected reminders**, with a debounce of 5 seconds so a burst of edits is one pass.

### 34.6 Template keys

`reminder.<kind>.<variant>.title`, `.body`, `.push.title`, `.push.body`, with typed parameters (`time`, `zone`, `minutes`, `port`, `name`, `amount`, `date`, `consequence`). Only parameters declared for the key are accepted; a missing one fails the build. Wording lives in `en.ts` (English only, per `CLAUDE.md`), never in the server's code.

---

## 35. Acceptance criteria

Each criterion is a Given, When, Then that becomes a test (Vitest for pure TypeScript; targeted server tests written with the code and **run by the owner**, never a full `dotnet test`). IDs are `AC-<phase>-<n>`.

### 35.1 R1: Smarter creation and the list

- **AC-R1-01** Given the guest types "remind me in 30 minutes to move the laundry", when the preview shows, then it names the weekday, date, time and zone, and nothing exists until Confirm.
- **AC-R1-02** Given "remind me at 5" at 3 p.m., then only today 5:00 PM is offered; at 6 p.m. only tomorrow 5:00 AM and today is not offered.
- **AC-R1-03** Given "tomorrow at 7" at 01:00 ship time, then Stanley asks "Tonight or tomorrow?" with both dates.
- **AC-R1-04** Given a past time, then it is refused and the next possible time is offered.
- **AC-R1-05** Given "remind me later", then Stanley asks for a time with three buttons.
- **AC-R1-06** Given any phrase in the corpus, then the deterministic parser's result equals the expected intent in at least 90% of cases and a wrong read is never silent.
- **AC-R1-07** Given the guest has 40 active reminders, when they add one, then it is refused and names what to remove.
- **AC-R1-08** Given text with a link or markup, then it is stripped and a link is never kept.
- **AC-R1-09** Given "remind Jordan at 5", then Stanley refuses and offers to share a calendar entry.
- **AC-R1-10** Given a reminder is deleted from the list on one device, then it is gone on every device.
- **AC-R1-11** Given a clock-change night, then a "7:00" reminder stays 7:00 ship time and the thread says so once.
- **AC-R1-12** Given an existing `clock` reminder from before the change, then it still fires and appears in the list.

### 35.2 R2: Anchors and Remind me everywhere

- **AC-R2-01** Given a reminder anchored to a tour, when the tour moves 60 minutes later, then the reminder moves with it and one message says so.
- **AC-R2-02** Given its anchor is cancelled, then the reminder is skipped, the guest is told why and offered a plain clock reminder.
- **AC-R2-03** Given a **Remind me** tap on a dinner, then a reminder is created at the default lead time with no further question and a preview line.
- **AC-R2-04** Given "Remind me about this" on a chat message, then only an editable 80-character label is stored, never the message text.
- **AC-R2-05** Given the guest confirms an excursion, then Stanley offers a reminder once and never adds it without a tap.

### 35.3 R3: The scheduler and the ladder

- **AC-R3-01** Given a reminder due at 16:15:00 and the app closed, then one thread message and one push exist within 60 seconds.
- **AC-R3-02** Given a duplicate event or a restarted worker, then exactly one message exists (the idempotency key holds).
- **AC-R3-03** Given a class A firing not acknowledged, then retries happen at +2 and +5 minutes updating the same message, and the existing 10-minute text or email fallback fires once to a verified number or address.
- **AC-R3-04** Given the guest scans aboard, then every later step of the ladder is skipped.
- **AC-R3-05** Given a class C reminder in quiet hours, then the message is in the thread now and the push is sent at the end of quiet hours.
- **AC-R3-06** Given the guest's own reminder at 02:00, then it is delivered at 02:00.
- **AC-R3-07** Given a snooze of "1 hour" for a dinner in 40 minutes, then it is refused with the reason.
- **AC-R3-08** Given a class A or B reminder, then there is no snooze and no setting turns the ladder off.
- **AC-R3-09** Given a firing past its window, then it becomes `missed` and is not pushed.
- **AC-R3-10** Given the stop fact is true at the lease step, then the firing is skipped with no message.
- **AC-R3-11** Given a simulated 4,000-guest ship with identical all-aboard times, then at least 95% of class A pushes are sent within 10 seconds on the fake provider.
- **AC-R3-12** Given a provider outage, then one honest notice is posted and the next channel is used.
- **AC-R3-13** Given the injectable clock jumps over a daylight-saving boundary, then no firing is lost or doubled.

### 35.4 R3b: Real push and the permission journey

- **AC-R3b-01** Given a new guest, then no browser permission prompt appears at launch.
- **AC-R3b-02** Given the guest creates their first reminder, then Stanley asks in context, and "Not now" leaves the thread working.
- **AC-R3b-03** Given an iPhone not installed, then the explanation and three steps appear once and nothing is blocked.
- **AC-R3b-04** Given **Send me a test reminder**, then it is sent through every channel the guest has on and each channel reports sent, received or not received, and the test is excluded from budgets and measures.
- **AC-R3b-05** Given push is not received within 20 seconds, then the card offers the fix and the calendar and email routes.

### 35.5 R4: Trip reminder sets

- **AC-R4-01** Given the three test-plan journeys fast-forwarded on the fake clock, then the **timeline golden** matches (every firing, time, class, lane, channel and stop reason).
- **AC-R4-02** Given a port day, then the all-aboard ladder follows 31.3 and the leave-by step is updated in place when the tender outlook worsens.
- **AC-R4-03** Given a mobility need with a 15-minute buffer, then leave-by is earlier by that amount.
- **AC-R4-04** Given the final payment is made, then the remaining payment steps are skipped and the message collapses to "No longer needed".
- **AC-R4-05** Given a document that falls short of the 6-month rule for one traveller, then the reminder names the traveller.
- **AC-R4-06** Given 12 candidate firings in one port-day window, then the arbiter delivers within the diet (22.1) and rolls the rest into one card.
- **AC-R4-07** Given a ship-wide alert, then non-critical reminders wait and class A is not delayed.

### 35.6 R5: Calendar

- **AC-R5-01** Given a feed with class A, B, C, D and E reminders, then each appears with the alarm set for its class.
- **AC-R5-02** Given a private reminder, then it never appears in the feed or any file.
- **AC-R5-03** Given a reminder moves, then its sequence number increases and the entry says "Latest time is in the app".
- **AC-R5-04** Given rotate, then the old address stops working and the new one is shown once.
- **AC-R5-05** Given sign-out-everywhere, then the feed is revoked.

### 35.7 R6 to R8

- **AC-R6-01** Given a pack is added, then each row can be toggled before adding and the set removes as a set.
- **AC-R6-02** Given a pack and the trip set both provide a critical reminder, then only one is created.
- **AC-R7-01** Given a daily private reminder, then its text appears in no push body, email, SMS, feed or log.
- **AC-R7-02** Given nag until done is on with a limit of 3, then at most 3 repeats occur and they stop at Done or the window end.
- **AC-R7-03** Given a check-back "Not yet", then it re-asks once in 15 minutes and then stops.
- **AC-R8-01** Given a proposed group reminder, then no member gets a copy until they accept.
- **AC-R8-02** Given a child's muster, then the guardian receives it labelled with the child's first name and the child receives nothing.
- **AC-R8-03** Given "share to calendar", then the guest's phone share sheet opens and Stanley sends nothing to anyone.
- **AC-R8-04** Given helper copies are on, then the helper receives class A and B copies and never private ones, and the guest can revoke.

### 35.8 R9 to R13

- **AC-R9-01** Given an open case with consent, then Guest Services see the delivery log for the relevant firings without any private text.
- **AC-R9-02** Given a global switch, then it needs two people and is recorded.
- **AC-R9-03** Given a correction notice, then every affected guest is listed and reached.
- **AC-R10-01** Given the app opens after being offline, then missed firings show with their true times and "Late" where relevant.
- **AC-R10-02** Given an unacknowledged class A with the badge supported, then the badge count includes it and clears on acknowledgement from any device.
- **AC-R11-01** Given SMS is not opted in or the number is not verified, then no text is sent.
- **AC-R11-02** Given the cap of 10 texts per trip, then the eleventh is not sent.
- **AC-R12-01** Given a worsening tender outlook, then the lane is raised and the message updated in place.
- **AC-R13-01** Given the manual screen reader and 200% zoom pass, then there are zero blockers.
- **AC-R13-02** Given a rehearsal of S1, then the global pause, the correction notice and the post-incident note are completed within the target time.

### 35.9 Cross-cutting (every phase)

- **AC-X-01** No guest-facing reminder string contains the word "AI".
- **AC-X-02** No reminder, notification or feed contains a link except into the app.
- **AC-X-03** Every reminder shows ship time and the other zone when they differ.
- **AC-X-04** Every spec has a window, a stop condition, a class and a ladder, or it does not compile.
- **AC-X-05** Every string key exists and takes only its declared parameters.

---

## 36. Copy deck (English only)

All wording lives in `en.ts` as `reminder.*` keys. Rules for every string: plain words at about a grade 6 to 8 reading level; no "AI"; the ship-time label whenever a time is shown; **no false urgency** ("last chance" only with a real, sourced deadline); a safety message never suggests it replaces the ship's announcements; push titles at most 60 characters and bodies at most 120. A test checks length, the banned words and the parameters. Parameters are in braces.

### 36.1 Creating a reminder

| Key | Text |
|---|---|
| `reminder.preview.title` | Reminder |
| `reminder.preview.when` | {weekday}, {date}, {time} {zone} |
| `reminder.preview.other` | {time} in {place} |
| `reminder.preview.anchor` | {offset} before {item}. I will follow it if it moves. |
| `reminder.preview.how` | How I will tell you: {channels}. |
| `reminder.preview.ends` | This ends when {stop}. |
| `reminder.preview.confirm` | Confirm |
| `reminder.preview.change` | Change |
| `reminder.preview.notNow` | Not now |
| `reminder.ask.tonightOrTomorrow` | Do you mean tonight or tomorrow? |
| `reminder.ask.am` | {time} in the morning or the evening? |
| `reminder.ask.vague` | What time would you like? |
| `reminder.ask.which` | Which one: {a} or {b}? |
| `reminder.refuse.past` | That time has passed. The next one is {time}. Use it? |
| `reminder.refuse.far` | That is after your cruise ends. Pick a time on your trip. |
| `reminder.refuse.limit` | You have {n} reminders. Remove one to add another. |
| `reminder.refuse.notNote` | I can only remind you. I cannot {verb} for you or anyone else. |
| `reminder.refuse.someone` | I cannot message other people. I can make a calendar entry for you to share. |
| `reminder.refuse.repeat` | I can repeat a reminder every 30 minutes or more. |
| `reminder.created` | Done. I will remind you {when}. |
| `reminder.quiet.note` | That is in your quiet hours. I will still send it. |
| `reminder.quiet.move` | Move it to {time} |
| `reminder.limit.signal` | I send reminders to your phone when it has signal. For something you cannot miss, add it to your phone's calendar too. |

### 36.2 When it arrives (the main ones)

| Key | Title | Body |
|---|---|---|
| `reminder.allAboard.120` | All aboard at {time} | The ship leaves {port} at {sailAt}. You need to be back by {time} ship time. |
| `reminder.allAboard.60` | All aboard in 60 minutes | Be back on the ship by {time} ship time. Leave by {leaveBy}. |
| `reminder.headBack` | Time to head back | Leave now to be on board by {time} ship time. Updated {updated}. |
| `reminder.allAboard.30` | 30 minutes to all aboard | Be on the ship by {time} ship time. |
| `reminder.allAboard.10` | 10 minutes to all aboard | Head to the ship now. |
| `reminder.lastTender` | Last tender at {time} | The last boat back leaves {place} at {time} ship time. |
| `reminder.muster` | Safety drill at {time} | Go to {station}. It is {minutes} minutes from your cabin. |
| `reminder.sailaway` | Sail-away at {time} | The ship leaves in {minutes} minutes. |
| `reminder.pay.final` | Final payment in {days} days | {amount} is due on {date}. After that {consequence}. |
| `reminder.pay.overdue` | Your payment is overdue | {amount} was due on {date}. Pay now to keep your booking. |
| `reminder.pay.failed` | Your payment did not go through | {reason}. Try again by {date}. |
| `reminder.checkin.open` | Online check-in is open | Check in before {cutoff} ship time. It takes about {minutes} minutes. |
| `reminder.checkin.close` | Check-in closes in {hours} hours | After that, the terminal desk takes over. |
| `reminder.docs.guard` | {name}'s passport needs a look | It must last {months} months past your return on {date}. |
| `reminder.plan.lead` | {item} at {time} | It is {walk} minutes from where you usually are. |
| `reminder.plan.moved` | {item} moved to {time} | It was {old}. Your reminder moved with it. |
| `reminder.clock.change` | Clocks change tonight | Your 7:00 reminder is still 7:00 ship time. |
| `reminder.port.tomorrow` | Tomorrow: {port} | Tender tickets, your tour at {time} and what to bring. |
| `reminder.excursion.lead` | Your tour is tomorrow | Meet at {place} at {time}. Bring {items}. |
| `reminder.excursion.meeting` | Tour in {minutes} minutes | Meet at {place} at {time}. |
| `reminder.bags` | Bags out by {time} | Put your tagged bags outside your door. |
| `reminder.exit.pick` | Pick your exit time | Choose a time before {time} ship time. |
| `reminder.vacate` | Leave your cabin by {time} | Check the safe and under the bed. |
| `reminder.onward.leave` | Time to leave for the airport | Your flight leaves at {time}. Updated {updated}. |
| `reminder.own` | {text} | Your reminder for {time} ship time. |
| `reminder.guardian` | {child}: {text} | For {child}. {detail} |

### 36.3 Buttons and states

| Key | Text |
|---|---|
| `reminder.action.gotIt` | Got it |
| `reminder.action.done` | Done |
| `reminder.action.open` | Open {screen} |
| `reminder.action.snooze` | Remind me later |
| `reminder.snooze.15` | In 15 minutes |
| `reminder.snooze.60` | In 1 hour |
| `reminder.snooze.evening` | This evening |
| `reminder.snooze.morning` | Tomorrow morning |
| `reminder.snooze.set` | I will remind you again at {time}. |
| `reminder.snooze.refuse` | That is too late. {item} is in {minutes} minutes. |
| `reminder.action.why` | Why am I seeing this? |
| `reminder.action.tooMuch` | Too much |
| `reminder.action.fewer` | Fewer like this |
| `reminder.action.share` | Add to a calendar |
| `reminder.state.late` | Late. Sent at {time}. |
| `reminder.state.missed` | You asked me to remind you at {time}. It did not reach you in time. |
| `reminder.state.superseded` | Replaced by a newer message at {time}. |
| `reminder.state.noLonger` | No longer needed: {reason}. |
| `reminder.state.moved` | Your reminder moved to {time} because {item} now starts then. |
| `reminder.state.cancelled` | Cancelled because {item} was dropped. Keep it as a plain reminder? |
| `reminder.state.summary` | Your {n} daily reminders ended with the cruise. |
| `reminder.nag.still` | Still here when you are ready. |
| `reminder.checkback` | Did you do it? |
| `reminder.checkback.yes` | Yes |
| `reminder.checkback.notYet` | Not yet |

### 36.4 The honest lines (policy, no-signal and mistakes)

| Key | Text |
|---|---|
| `reminder.policy.short` | Reminders help. They can be late if your phone is off or has no signal. The ship's announcements always come first. |
| `reminder.policy.long` | I am a helper, not a crew member. My reminders can be late or miss you if your phone is off, has no signal or has alerts turned off. For all-aboard, the safety drill and anything you cannot miss, listen to the ship's announcements and watch the time yourself. |
| `reminder.late.offline` | You were offline, so this is late. It was due at {due} and I am showing it at {now}. |
| `reminder.clock.off` | Your phone's clock is {minutes} minutes off. Reminders use ship time. |
| `reminder.error.wrongTime` | I got the time wrong. It should have been {time}. I have fixed it. |
| `reminder.error.after` | This reminder came too late. It should have reached you by {time}. |
| `reminder.error.data` | I was wrong about this time. It is {time}. I have changed {n} reminders. |
| `reminder.error.channel` | I could not send this to your phone. I have sent it another way. |
| `reminder.error.outage` | I cannot check {source} right now. Reminders that need it are paused. |
| `reminder.error.back` | Back to normal. |
| `reminder.quiet.ship` | I am quiet while the ship makes an announcement. |
| `reminder.help.history` | What happened to this reminder |

### 36.5 Permission journey and the delivery check

| Key | Text |
|---|---|
| `reminder.perm.ask` | Want this to reach your phone even when the app is closed? |
| `reminder.perm.yes` | Yes, send alerts |
| `reminder.perm.notNow` | Not now |
| `reminder.perm.install` | To get alerts when the app is closed, add it to your Home Screen. Tap Share, then Add to Home Screen, then open it from there. |
| `reminder.perm.denied` | Alerts are off for this app. Turn them on in your browser settings, or use your calendar or email instead. |
| `reminder.perm.unsupported` | This browser cannot send alerts. Your calendar and email will still work. |
| `reminder.status.push.on` | Phone alerts: on |
| `reminder.status.push.off` | Phone alerts: off |
| `reminder.status.push.install` | Phone alerts: add the app to your Home Screen |
| `reminder.status.calendar` | Calendar: {linked} |
| `reminder.status.sms` | Texts: {state} |
| `reminder.check.button` | Send me a test reminder |
| `reminder.check.sent` | Sent to: {channels}. |
| `reminder.check.received` | Got it on this phone. |
| `reminder.check.notReceived` | Not received yet. Check your alerts or use your calendar. |
| `reminder.check.health` | Alerts checked {when}. |
| `reminder.check.old` | It has been a while. Check your alerts again? |
| `reminder.check.test` | Test |

### 36.6 Consent lines (shown in full, versioned)

| Key | Text |
|---|---|
| `reminder.consent.sms` | Send me a text if I have not seen an all-aboard or safety alert. Texts go only to {number}, which you confirmed. Normal text rates may apply. You can turn this off at any time. |
| `reminder.consent.email` | Email me important reminders such as payments and documents. You can turn this off at any time. |
| `reminder.consent.feed` | Add my trip reminders to my phone's calendar. Your phone sounds the alarms even with no signal. If a time changes while you are offline, the calendar will not know until it refreshes. Anyone with the link can see these entries, so keep it private. |
| `reminder.consent.nag` | Keep reminding me, up to {n} times, until I say Done. I can stop it at any time. |
| `reminder.consent.helper` | Send {name} a copy of my important and safety reminders. They will not see anything marked private. I can stop this at any time. |
| `reminder.consent.private` | Keep this one private. It will not show on my lock screen, in my calendar or in any email or text. |
| `reminder.consent.revoke` | Turn off |

### 36.7 Lists, packs, empty states and chips

| Key | Text |
|---|---|
| `reminder.list.title` | Reminders |
| `reminder.list.needsYou` | Needs you |
| `reminder.list.next` | Next up |
| `reminder.list.today` | Today |
| `reminder.list.later` | Later |
| `reminder.list.yours` | Yours |
| `reminder.list.trip` | For your trip |
| `reminder.list.stanley` | Added by Stanley |
| `reminder.list.empty` | Nothing waiting. Say "remind me" to add one. |
| `reminder.list.noneSeen` | Nothing yet. Reminders for your trip will appear here as your dates get closer. |
| `reminder.list.pause` | Pause the quiet ones for today |
| `reminder.add.title` | Add a reminder |
| `reminder.add.what` | What |
| `reminder.add.when` | When |
| `reminder.add.repeat` | Repeat |
| `reminder.pack.add` | Add this set |
| `reminder.pack.remove` | Remove this set |
| `reminder.pack.travel` | Travel day |
| `reminder.pack.first4` | First four hours |
| `reminder.pack.port` | A port day |
| `reminder.pack.bags` | Bag night and last morning |
| `reminder.pack.family` | Family |
| `reminder.pack.mine` | Save as my own |
| `reminder.offer.dinner` | Want a reminder an hour before? |
| `reminder.offer.tour` | Want a reminder the evening before and 90 minutes before? |
| `reminder.offer.head` | Want a nudge 60 minutes before you need to head back? |
| `reminder.share.title` | Share with someone with no account |
| `reminder.helper.title` | Copies for {name} |
| `reminder.essentials` | Essentials only: safety, your own reminders and three kinds of trip reminder |
| `reminder.badge.label` | {n} reminders need you |

**Review checklist for copy:** the legal and policy lines (36.4) and the consent lines (36.6) go to the owner's legal review before release; every string passes the reading-age check; every time string passes the zone check; no string uses "AI", "smart", "intelligent" or "guarantee".

---
## 37. Screen specifications

Wireframes are phone first (one column, text-only boxes); desktop widens the same layout. Components are server-driven (the lists, states and wording come from the server) and built once: `ReminderBell`, `ReminderSheet`, `ReminderCard`, `ReminderPreview`, `RemindMeButton`, `ReminderForm`, `RemindersPage`, `DeliveryCheck`, `PackPicker`, `ReminderSettings`.

### 37.1 The bell and the sheet (decision 12; falls back to the page if the bell is declined)

```
 TOP BAR                                   SHEET (focus-trapped dialog; Escape closes)
+--------------------------------+      +----------------------------------------+
| Princess      [Search][Bell 3][?]|      | Reminders                        [Close]|
+--------------------------------+      | [Needs you 2][Next up][Today][Later]   |
                                        |                                        |
 Bell badge = unacknowledged critical    | NEEDS YOU                              |
 and important items (a number, and      |  All aboard in 60 minutes     4:30 PM  |
 the label "3 reminders need you").      |  Be back on the ship by 4:30 ship time |
                                        |  [Got it]  [Open port plan]            |
                                        |  Final payment in 7 days     12 Jan    |
                                        |  [Got it]  [Open payments]             |
                                        | NEXT UP                                |
                                        |  Dinner 7:00 PM  . in 2 h 15 min       |
                                        |                                        |
                                        | [ Add a reminder ]                     |
                                        | Delivery check . Settings              |
                                        +----------------------------------------+
```

**Behaviour.** The bell opens the sheet from any screen; the sheet remembers the last tab; **Needs you** is first when it has items and otherwise **Next up** opens; focus moves to the sheet title on open and returns to the bell on close; each reminder is a list item with a real heading; the badge number is also in the bell's accessible name. On desktop the sheet is a side panel.

### 37.2 The reminder card (in the thread, the sheet and the page)

```
 CRITICAL (class A)                      LATE                       MISSED (quiet)
+------------------------------+   +--------------------------+  +---------------------------+
| ! All aboard in 30 minutes   |   | Late. Sent at 4:40 PM.   |  | You asked me to remind    |
|   Be on the ship by 4:30 PM  |   | Dinner at 7:00 PM        |  | you at 4:15. It did not   |
|   ship time (3:30 PM Cozumel)|   | It is 10 minutes away.   |  | reach you in time.        |
|   [Got it] [Open port plan]  |   | [Done] [Remind me later] |  +---------------------------+
|   Why am I seeing this?      |   +--------------------------+
+------------------------------+
 NO LONGER NEEDED                        SNOOZED                    MOVED
+------------------------------+   +--------------------------+  +---------------------------+
| No longer needed: you paid.  |   | I will remind you again  |  | Your reminder moved to    |
+------------------------------+   | at 4:25 PM.              |  | 3:30 because the tour now |
                                   +--------------------------+  | starts at 4:30.           |
                                                                 +---------------------------+
```

**Rules.** Order is always **what, when, one action**; a critical card has **no snooze** and a visible "Got it"; both zones show whenever they differ; the time-left line (class A only) refreshes each minute and is **not** a ticking clock; colour never carries meaning alone (a word or an icon always does); the card is a status or an alert role by class (23).

### 37.3 The preview (see 15.4) and the add form

```
 ADD A REMINDER (form alternative to words)
+----------------------------------------+
| What      [ Be back on board         ] |   80 characters, counted
| When      (o) At a time  ( ) Before something  ( ) Repeat
|           Day [Wed 12 Nov v]  Time [4:30 PM]   (native controls)
|           Ship time (3:30 PM in Cozumel)
| Private   [ ] Keep this one private    |
| How       [x] Phone alert  [x] Calendar  [ ] Email
| [ Preview ]                  [ Cancel ]|
+----------------------------------------+
```

The form produces the **same typed intent** as words and shows the **same preview** before anything exists. Date and time use native controls; nothing is entered by dragging.

### 37.4 The Reminders page (from Me, Settings and the sheet)

```
+----------------------------------------+
| Reminders                              |
| [Needs you][Upcoming][Repeating][Done] |
| YOURS                                  |
|  Be back on board    Wed 4:30 PM  . phone, calendar   [Edit]
|  Take tablets (private) 8:00, 8:00 PM  every day      [Edit]
| FOR YOUR TRIP                          |
|  Final payment       12 Jan . phone, email             [Turn off]
|  Check-in opens      9 Mar                             [Turn off]
|  All aboard (safety)  every port day   cannot be turned off
| ADDED BY STANLEY                       |
|  Bag night 6:00 PM   added 9 Mar . why?                [Remove]
| [ Add a reminder ]   [ Add a set ]     |
+----------------------------------------+
```

**Per row:** the owner group, the next time with both zones where they differ, the channels, the state; **Edit** opens the form; **Turn off** applies to a trip kind (not critical); **What happened to this reminder** opens the history (20.1). The page is keyboard operable with a heading per group and a list per heading.

### 37.5 The delivery check (16.3)

```
+----------------------------------------+
| Check my alerts                        |
| Phone alerts: on          Calendar: linked      Texts: off
| [ Send me a test reminder ]            |
|                                        |
| Result (after you press the button)    |
|  Phone: received on this phone  (4 s)  |
|  Calendar: linked, last fetched 10:12  |
|  Email: sent                           |
| Alerts checked 3 days ago.             |
+----------------------------------------+
```

If a channel is not received after 20 seconds the line says so and offers the fix beneath it: permission, **Add to Home Screen** (with the three steps), the calendar route or email.

### 37.6 Settings: Stanley notices, reminders

| Block | Controls |
|---|---|
| **Channels** | A table of lane by channel: critical (locked on), important, reminders, suggestions, each with phone, email, text, calendar switches that apply |
| **Quiet hours** | Switch and times (the existing control); a plain line that "your own reminders and safety alerts still come through" |
| **Budget** | The existing `nudgesPerDay` control and **Essentials only** |
| **Me** | Pace (relaxed, normal, brisk), mobility need, **extra minutes for all aboard** (the personal buffer), wake time |
| **Persistence** | Nag defaults, check-back on or off |
| **Copies** | Helper copies (with the consent line), guardian copies (shown, not editable) |
| **Calendar** | Link, copy, rotate, turn off; the include-list per class |
| **Text and email** | Opt-in with the consent text; the verified number or address; Remove |
| **Check my alerts** | Opens 37.5 |
| **History** | Consent history |

### 37.7 The pack picker

```
+----------------------------------------+
| A port day                             |
| 6 reminders for Cozumel, Wed 12 Nov    |
| [x] All aboard (safety)  cannot change |
| [x] Leave the ship: ID and ship card   6:30 PM
| [x] Tour meeting          7:30 AM      |
| [ ] Sun cream every 2 hours            |
| [x] Phone: data roaming off  at the gangway
| [ Add this set ]   [ Save as my own ]  |
+----------------------------------------+
```

### 37.8 Family, helper and sharing

| Surface | Spec |
|---|---|
| **Guardian card** | One card per child per event: "Maya: muster at Station C. 4 minutes from your cabin." No child sees it |
| **Helper view** | A read-only list of the copies the helper receives (class A and B), with "What is left" weekly; no edit |
| **Share** | **Add to a calendar** opens the phone's own share sheet with a one-off file or the feed link; copy states "I do not send anything to anyone" |

### 37.9 Empty and error states

| State | Text and action |
|---|---|
| No reminders yet | "Nothing waiting. Say 'remind me' to add one." |
| Before booking | "Reminders for your trip will appear here as your dates get closer." |
| Push off | "Phone alerts are off." plus the steps and the calendar route |
| Offline | A banner "You are offline. Reminders will show when you reconnect." and the cached list with "last checked" |
| Provider outage | "I cannot check {source} right now. Reminders that need it are paused." |
| A limit reached | "You have 40 reminders. Remove one to add another." |
| Preview failed | "I could not read that. Try 'tomorrow at 7' or use the form." |

### 37.10 Accessibility by screen (extends section 23)

| Screen | Key requirements |
|---|---|
| Bell and sheet | Dialog role, focus trap, Escape, focus returns to the bell, badge in the accessible name, tab list pattern for the four tabs |
| Card | Status or alert role by class, one announcement per firing, buttons with visible focus and 44 px targets, time read in full ("four thirty PM ship time") |
| Add form | Labelled native controls, the preview announced politely, errors beside the field and in the summary |
| Page | One heading per group, a list per group, no hover-only controls |
| Delivery check | The result region is polite; each channel result is a list item with text, never colour only |
| Settings | Fieldsets and legends for channels; consent text linked by `aria-describedby` |
| Pack picker | A checkbox list with the safety row disabled and explained |

---

## 38. Edge cases

| # | Case | Behaviour |
|---|---|---|
| E1 | **Back-to-back cruises** | Reminders are per trip; the earlier trip's end summary and the next trip's set start separately; repeating reminders never carry over |
| E2 | **Trip cancelled or rebooked** | The cancelled trip's trip-source reminders end with one note; the guest's own stay unless anchored to the dropped trip, then follow the anchor rule (cancelled with an offer); a new booking regenerates the sets |
| E3 | **Stage moves backward** (cancellation to Discover) | Trip sets for later stages end; Dream and Discover reminders resume |
| E4 | **Several bookings on one account** | The current trip drives the sets; another trip appears as one "Your other trip" roll-up with only its next deadline |
| E5 | **Itinerary changes: port skipped or swapped** | The all-aboard ladder for the skipped port ends with a note; the new port's set is created |
| E6 | **Overnight port stay** | Two all-aboard ladders only if the ship leaves and returns; otherwise one for the final departure |
| E7 | **Ship arrives late** | All-aboard moves with the itinerary; the message says why and the buffer is recomputed |
| E8 | **Tender cancelled or ship docks instead** | Leave-by recalculates for the dock; one note |
| E9 | **Sea day** | No all-aboard ladder; the day plan and dinner reminders only |
| E10 | **Very short trip (2 nights)** | The ladders compress to the days that exist; no payment ladder if already paid |
| E11 | **Very long trip (world voyage)** | The 40-reminder limit counts only the guest's own; repeating ends at disembark; the stage engine moves as normal |
| E12 | **Account deleted** | All reminders, firings, devices, the feed token and consents are deleted; the delivery log keeps counters only |
| E13 | **New phone** | The server keeps the reminders; the new device re-subscribes; the old endpoint is retired on the first failed send; the delivery check is prompted |
| E14 | **Two devices acknowledge together** | The first write wins; the second sees "already done" |
| E15 | **Sign out everywhere** | Devices removed, the feed revoked, pending nags stop |
| E16 | **Guest travels across zones** | Home-zone anchors stay home-zone; onboard anchors stay ship time; the preview shows both |
| E17 | **Airplane mode at sea, Wi-Fi only** | Push does not arrive; the calendar and the app's local copy carry it; the offline wording appears on open |
| E18 | **Demo accounts and the test bar** | The demo clock drives the scheduler; **external sends are off** (thread only; no SMS, no email, no push to real devices) so a demo never texts anyone |
| E19 | **A child turns 18 during the trip** | No change on the trip; the next trip offers an account |
| E20 | **The booker changes or a party member leaves** | Guardian and group copies end for the person who left; the booker's set updates |
| E21 | **A cabin or sailing change** | Anchored reminders re-materialise; a sailing date change regenerates all trip sets |
| E22 | **The guest replies STOP to a text** | The existing SMS reply handler switches texts off and says so in the thread (verify it covers reminders) |
| E23 | **An email bounces** | The address is marked unverified; the guest is told in the thread; critical falls back to push and SMS |
| E24 | **The phone number changes** | The number must be confirmed again before any text |
| E25 | **A guest has calm or simple mode on** | Class A and the guest's own only, plus three trip kinds (Essentials) |
| E26 | **Do-not-disturb until a time** | Held as in 31.5; class A, B, E and G bypass |
| E27 | **24-hour clocks and units** | Times follow the guest's clock setting; the zone label stays |
| E28 | **A reminder is created for a time during a power-off period** | Delivered when the phone returns, with "Late" and inside the window, otherwise missed |
| E29 | **A ship alert is active** | Non-critical waits; the ship alert message appears; resumes after |
| E30 | **The guest turns off a trip kind and then a deadline nears** | A single note at the deadline: "You turned this off. It is due on {date}. Turn it back on?" (class B and A only; others stay off) |

---

## 39. Analytics events and dashboards

Events go through the existing diagnostics path (`src/diagnostics`), carry **no reminder text, names or places**, and are aggregated by the measures in section 27. Properties are enumerations, counts and durations only.

| Event | When | Properties |
|---|---|---|
| `reminder_previewed` | A preview shown | entry (thread, button, form, pack, offer, voice, share), parser (grammar or model), outcome (confirmed, changed, abandoned), when type |
| `reminder_created` | Confirmed | source, kind, class, when type, anchored (yes or no), private (yes or no), pack |
| `reminder_firing_sent` | A ladder step sent | class, kind, step, channel, latency (ms from due), jitter, ship cohort |
| `reminder_delivered` | A channel accepted, or the device confirmed receipt | channel, device confirmed (yes or no), latency |
| `reminder_acknowledged` | Got it or Done | class, kind, seconds since sent, device |
| `reminder_snoozed` | A snooze | class, kind, snooze count, interval |
| `reminder_missed`, `reminder_late` | State changes | class, kind, reason (no signal, quiet, window) |
| `reminder_skipped` | A firing skipped | reason (stop fact, deleted, no longer needed, held and dropped) |
| `reminder_failed` | Dead-letter | class, kind, last channel |
| `reminder_moved` | An anchored move | cause (anchor, itinerary, guest) |
| `reminder_deleted` | Removed | source, kind, state |
| `pack_added`, `pack_removed`, `pack_saved` | Pack actions | pack, rows on, rows off |
| `delivery_check_run` | The self-test | channels on, result per channel, seconds to receive |
| `permission_prompted`, `permission_result` | The push journey | context, result (granted, denied, dismissed, unsupported), installed (yes or no) |
| `feed_created`, `feed_rotated`, `feed_revoked`, `feed_fetched` | Calendar feed | include classes, fetch interval |
| `sms_optin`, `sms_optout`, `sms_sent` | Text consent and sends | step, class, verified (yes or no) |
| `helper_copy_on`, `helper_copy_off`, `nag_on`, `nag_off` | Consent changes | scope |
| `too_much_tapped` | The chip | kind, lane |
| `essentials_on`, `essentials_off` | The setting | source |
| `sheet_opened`, `bell_badge_shown` | Discoverability | from (bell, thread, home, me), badge count band |
| `correction_sent` | A correction notice | affected count, kind |

**Dashboards** (operations console, section 20.3): delivery latency by class and channel against the targets; acknowledged, missed and late by kind; the preview funnel (previewed to confirmed); push, calendar and text adoption; delivery-check pass rate; snooze and nag rates; volume per ship per hour; spend. **Privacy:** events are batched, carry the same consent as other diagnostics, are deleted with the account, and are aggregated to counts after 30 days.

---

## 40. Building on what exists: mapping and migration

### 40.1 Existing pieces to the new model

| Existing | New |
|---|---|
| Push kind `allAboard` and `backAboard` | Class A kinds `allAboard` ladder and `headBack` |
| `scheduleChange`, `change` | `plan.moved`, `change.decide` (class C) |
| `disruption` | A class A or B notice by consequence |
| `payment` (pay due, overdue, instalment due, failed, taken) | `payFinal` (C, B when overdue or failed near the date), `instalment` |
| `reminder` (the guest's clock reminder) | `clock` (class E) |
| `travel` (flight watch, tender watch) | `flight.watch`, `lastTender` (class A or B by consequence) |
| `reservation` | `plan.lead` (class D) |
| `case` | Info; `case.update` |
| `helper` | Helper copy (REM-D04) |
| `chat` | Not a reminder (stays chat) |
| `NotificationRules.BuildNotices` (ten notices) | Each becomes a spec generator in 34.4 |
| `StanleyNoticeRules.ScreenNotices` (muster drill, documents, check-in, answered case) | Class A (muster), class C (documents, check-in), info (case); moved from "thread only, never pushed" to the class's ladder (muster becomes a push) |
| `localReminders.ts` (`pay`, `checkin`, `allAboard`, `custom`) | Replaced as a source by server firings; kept to **render cached firings offline** |
| `StanleyReminders` rows | `clock` reminders with defaults |
| "Remind me in a week" email | A **channel and a source** (`kind: comeBack`); the signed unsubscribe link is unchanged |
| Calendar feed and file | Extended with reminders (R5) |
| `WatchSchedulerService` (15 minutes) | Kept as the **safety net**; the due-queue is primary |
| `FallbackDue` (10 minutes, 3 hours) | Kept; becomes the class A fallback step |
| `AwayRules.LandingByMs`, `alertBefore` | The base of leave-by; extended with pace and needs |

### 40.2 Cutover without double-sending

1. **One notice key per occasion.** The new firing key reuses the legacy notice key where the occasion is the same (for example `awayReturn:{date}`), so the two systems cannot both send.
2. **Shadow first.** For two weeks the new engine computes firings and **compares** with what the legacy dispatch sent, without sending (21.4).
3. **Per-cohort flag** (`reminders.engine`): legacy off for a cohort and new on, one ship or sailing at a time, class A last.
4. **Rollback** is flipping the flag; the legacy dispatch and the 15-minute poll are untouched until the final cohort.
5. **Data:** add columns with defaults to `StanleyReminders`; create the new tables; no destructive change until the legacy path is removed in a later phase.
6. **Strings:** `reminder.*` keys added; existing strings remain until their screens move.

---

## 41. The open questions, with proposed defaults

If you do not decide, I proceed with these (each is cheap to change before its phase).

| # | Question | Proposed default | If we are wrong |
|---|---|---|---|
| 1 | The top-bar bell | Build the bell behind a flag; the Reminders page and the thread header carry the same content | Remove the bell; no data change |
| 2 | Legal wording and compensation | Draft the policy line (36.4); **class A does not reach guests** until legal has reviewed it (RG2) | A delay to class A only |
| 3 | Real push date | Build against the mock; release at RG1 when keys exist | R3b waits |
| 4 | SMS provider and budget | Keep the existing `ISmsSender` (a mock) and the 10-minute fallback; **no new SMS spend until RG3** | Class A last step stays email and push |
| 5 | Server port logic | Answered: it exists; extend (section 30) | n/a |
| 6 | Pack authors | The product owner writes the three Release 1 packs as files in the repo; port packs wait | Packs ship later |
| 7 | Research participants | Staff families and past guests | A delay to RG0 |
| 8 | Wake-up calls | A mock behind an interface; a prepared request only | n/a |
| 9 | Run the earlier Stanley server code | Assume the owner builds and runs it before R3; if not, R3 begins with a **smoke-test sub-phase** | A week of rework |
| 10 | Level of the progress bar | Class A shows time left, **refreshed each minute** (decision 24) | Remove the bar |
| 11 | Defaults for events | 30 minutes (decision 25) | Change one constant |

### 41.1 Further decisions (numbering continues from section 28)

24. **A time-left display for class A** is allowed, refreshed each minute and **never a ticking seconds clock**; no countdown for any other class.
25. **The default lead time for events is 30 minutes** (the market norm); dinners stay at 60 and 20.
26. **Test sends never reach real guests:** every test message has a test flag, staging sends go only to an allow-listed cohort, a kill switch exists, and a rehearsal precedes class A (the May 2025 competitor incident, section 30.5).
27. **Verify before building:** the corrections in 30.1 stand as fact; anything marked "verify" in 34.4 is opened and confirmed at the start of R4.
28. **Three releases** (32): Safe and on time; Smart and shared; Delight.
29. **Analytics carry no text, names or places** (39).
30. **Demo accounts send nothing external** (E18).
31. **A STOP reply to a text switches texts off** and is confirmed in the thread (E22).
32. **One operations console** serves reminders and standing rules (the actions plan 20); reminders add the delivery views.
33. **The `WatchSchedulerService` stays** as the safety net after the due-queue exists.

---

## 42. Glossary, shared ownership and the supersession register

### 42.1 Glossary

| Term | Meaning |
|---|---|
| **Lane** | How loud a message is: critical, important, reminder, info, suggestion |
| **Class** | The ladder a reminder follows, A to G (31.1) |
| **Firing** | One occasion and ladder step of a reminder (33) |
| **Anchor** | A fact a reminder is timed against (a tour, all aboard, check-in opening) |
| **Ladder** | The set of steps and retries for a class |
| **Leave-by** | The computed time to set off so you arrive by a deadline |
| **Window** | How long a late reminder is still useful |
| **Stop fact** | The fact that ends a reminder (paid, aboard, checked in) |
| **Arbiter** | The part that ranks, rolls up and limits what is pushed |
| **Roll-up** | Several reminders shown as one card |
| **Pack** | A named set of reminders added together |
| **Feed** | The private, subscribable calendar link |
| **Burst** | Many guests' reminders due in the same second (all aboard) |
| **Receipt** | The structured record of what Stanley did and why |
| **Bypass** | Skipping quiet hours and the budget, allowed only for safety and the guest's own time |

### 42.2 One owner per topic (shared with `stanley-actions-and-proactive-plan.md`)

| Topic | Canonical in | The other document |
|---|---|---|
| Reminder behaviour, classes, ladders, copy, screens | **This document** | Points here |
| Standing rules, levels and permissions, rung 4 classes | **Actions plan** (sections 11 and 12) | Reminders honour the level (AUT-01, AUT-02) |
| Scheduler core and due-queue | **This document** (25.3, R3) | Actions plan P2c adds rule triggers |
| Arbiter | Actions plan 22.1 | This document adds the reminder diet (22) |
| Receipts and "Why did you do that?" | Actions plan 19.1 | Reminders use it for AUT-02 additions |
| Delivery log | **This document** (20.1, on `PushDeliveryRow`) | Actions plan ledger links to it |
| Operations console, switches, breakers | **One console**, specified in actions plan 20 | This document adds delivery, burst and ship views (20.3) |
| Test harness (clock, fixtures, golden) | Actions plan 23 for fixtures; **this document** for the timeline golden and the burst test | Same fixtures |
| Privacy and security | Each document for its own data; the shared threats are in actions plan 26 | |
| Accessibility | Actions plan 25 for the shared base; this document 23 and 37.10 for reminders | |
| Cost | Actions plan 24 for model calls; this document 22.3 for push, SMS and storage | |

### 42.3 Supersession register (which earlier text is replaced)

| Earlier text | Replaced by |
|---|---|
| Section 5.1 delivery ladder table | 16.4 and 31.1 |
| REM-CR-07 limits | 25.4 and 31.4 |
| Section 9 phases | Section 26 and 32 |
| "Evaluation only when the app calls in" (section 1) | 30.1 (a 15-minute poll exists) |
| "Calendar export included in R3" (decision 7) | 16.7 and R5 (the feed exists) |
| Decision 4 (order) | Section 26 |
| Round 1 SMS rule (decision 5) | 31.1 and 31.8 (extends the existing fallback) |
| All-aboard "120, 90, 60, 30, 10" as pushes | 31.3 (60, leave-by, 30, 10 are pushed; 120 and 90 are thread-only) |

---

## 43. Requirement index

REM-A01 to A12 (system), REM-B01 to B11 (guest-asked), REM-C01 to C05 (Stanley-offered), REM-D01 to D04 (shared, supervised and helper), REM-E01 to E18 (expanded kinds), REM-CR-01 to 08 (creation), REM-DL-01 to 10 (delivery), REM-SN-01 to 04 (snooze), REM-EX-01 to 06 (lapse and expiry), RS-1.1 to RS-11.12 with priorities (per-stage reminders, section 13), RS-S.1 and S.2 (solo), RM1 to RM18 (mistakes, section 18), RR1 to RR5 (research), RG0 to RG4 (gates), R1 to R13 (phases), AC-R1-01 to AC-X-05 (acceptance, section 35), E1 to E30 (edge cases, section 38), the copy keys `reminder.*` (section 36), the analytics events (section 39), decisions 10 to 33.
