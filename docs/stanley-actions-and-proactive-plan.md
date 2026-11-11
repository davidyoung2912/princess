# Stanley beyond answers: actions, watching and proactive help

Status: **one reconciled specification (2026-11-10). Nothing here is built.** It replaces three layers of drafting (the first draft and two rounds of owner feedback) with a single document that has one phase plan, one decision list, one measures table and no superseded text. Section 17 records what was reconciled and where the old text went.

It answers: *what can Stanley do for the guest other than answer questions, can he take actions, and what proactive or suggestive help could save time, catch problems and get more out of the app?* It ends with the delivery plan, gates and risks.

**Companion documents.** `docs/stanley-reminders-requirements.md` is canonical for everything about reminders (classes, ladders, lead times, limits, copy, screens) and for the scheduler core, delivery log and push; this document is canonical for levels, permissions, standing rules, rung 4 classes, receipts, the arbiter, the operations console and the shared test harness (ownership table in section 15). Also: `docs/chat-features-research.md` section 15 (the permanent 1:1 Stanley chat that carries all of this), `docs/stanley-gap-analysis-and-plan.md` (what Stanley already is), `docs/stanley-data-inventory.md` (what he may read), `docs/stage-experience-plan.md` (the 11 stages) and `docs/stage-welcome-plan.md`.

Follows `CLAUDE.md`: thin client (the server decides, the screen renders), external services mocked behind interfaces, English only, WCAG 2.2 AA, phases that commit and stop, verified with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` only. Server tests are written with the code and run by the owner, targeted, never a full `dotnet test`.

**Evidence and caveat.** Based on the documents above, the `src/ai` modules, `server/Princess.Api/Domain/Stanley*.cs`, the scheduler and email-check services, and `StanleyIntro.tsx`. Section 8 lists what was checked against the code. Nothing was run. The gap plan records that server code for its phases 1 to 12 and the carry-over phases was written but **never compiled or run here**, so "built" below means "written", and an owner build and targeted test run comes before anything is relied on.

---

## 1. Yes, he can act: what Stanley does today beyond answers

Stanley is already more than a Q&A box. The pattern is **prepare, preview, confirm, receipt, undo**: the server turns a request into a typed intent and a stored preview; the guest confirms once; the same service the screens use makes the change; a receipt appears and, for plan changes, can be undone. Paying, cancelling a booking, changing a cabin and sharing data are never actions.

| Family | What he does now | Where |
|---|---|---|
| **Confirmable actions (9)** | `order_item`, `add_excursion`, `reserve_dinner`, `move_dinner`, `change_seating` (booker only, frozen 3 days out), `draft_case` (lost item, complaint), `plan_change` (add, move, drop), `remind_me`, `create_poll` | `StanleyActions.cs`, `stanleyAction.ts`, `StanleyActionCard.tsx` |
| **Hand-off to a person** | Drafts a case with the guest's consent text, optional photo; shows owner, status and next update | `StanleyHandoffs.cs`, `HandoffCard.tsx`, `HandoffCases.tsx` |
| **Helper path** | A helper the guest authorises can *prepare* five kinds (`add_excursion`, `reserve_dinner`, `move_dinner`, `change_seating`, `create_poll`); the guest confirms | `StanleyHelper.cs` |
| **Read tools** | Sailings, itinerary, port, excursions, restaurants, route, the guest's trip, plan, cases; bill answers come from money rules as a card, never a model-quoted figure | `StanleyReadTools.cs`, `StanleyResolvers.cs` |
| **Planning** | Day and week planner, group diplomat, compare excursions, weighted sailing compare, cabin chooser, decision brief | `StanleyPlanner.cs`, `StanleyDiscover.cs` |
| **Money** | Entitlement and spend answers, trip budget pace, charge questions that open a billing case | `StanleyMoney.cs` |
| **Travel day** | Flight, traffic, shore plan, phrases, port pack, onward travel, packing edits | `StanleyTravel.cs` |
| **Proactive (already)** | "What changed" cards with a ranked consequence, "What did I miss", rough-seas tip, Stanley Next, five journey modes, 11 milestone moments, speech dot for urgent reasons, coach tours, "Why am I seeing this?", thread-only notices (muster drill, documents, check-in, answered cases) | `StanleyChanges.cs`, `StanleyNoticeRules.cs`, `stanleyNext.ts`, `stanleyModes.ts`, `stanleyMoments.ts`, `stanleyDot.ts` |
| **Memory and control** | Visible, forgettable preferences with scope; four volume levels (chatty, helpful, asked, off) layered as three plain choices; per-lane kill switches | `StanleyMemory.cs`, `StanleyOps` |
| **Welcome page today** | Four lines and the volume choice | `StanleyIntro.tsx`, `stanleyIntro.can.1..4` |

**What is missing is three things:**

1. **Guests do not know.** The welcome page names four abilities; Stanley has more than twenty. Nothing explains that he can *do* things (preview and confirm) or *watch* things.
2. **Everything is one request, one action.** There are no bundles ("plan my evening"), no standing rules ("if my tour is cancelled, offer me another"), and no way to say how much he may do alone.
3. **Checking is passive.** He explains when asked and surfaces what *changed*, but does not routinely look at the whole trip and say "here are four things that will cause trouble".

---

## 2. Principles (the guardrails every capability keeps)

1. **People decide how much Stanley may do; inside that, he acts.** By default every change goes through the preview and confirm token. A guest may let him go further (section 11): standing rules that prepare for them, and a short list of free, reversible things he does and reports. He never acts outside what the guest switched on, and never above the ceiling.
2. **An autonomy ladder with a hard ceiling** (section 3). Pay, cancel, change cabin or cruise, share data, message another person, answer for the guest to staff and submit a signed declaration are **never** automated.
3. **Deterministic first, model last.** Rules find the problem; a template words it; a model is used only to word or plan when a template is not enough, on the cheapest tier that works, behind the existing meter.
4. **Trip facts, not eavesdropping.** Proactive help comes from the booking, plan, programme, folio, documents, weather and ship data, never from reading conversations.
5. **Few, timed, explained.** Every proactive item has a trigger, a purpose, an expiry and a "Why am I seeing this?". Existing caps hold (one proactive element per screen, three per session, a dismissed item stays dismissed until its facts change), and all output passes the arbiter (22.1).
6. **Honest provenance.** Every claim shows its source and "as of" time; a simulated source is not called verified; Stanley says "I can't confirm" rather than guess. The front end never knows whether data is simulated.
7. **Delivery through the permanent thread.** Everything proactive lands in the guest's 1:1 Stanley chat in a lane (critical, important, reminder, info, suggestion) with the existing quiet hours, budget and calm mode. A safety-critical fact is never only in chat. The critical list is published and under change control (reminders 31.6); Stanley's support level does **not** switch it off.
8. **Easy to see, easy to stop.** One place lists everything Stanley did and is watching, with a stop button on each, plus one "Pause everything".
9. **Children, helpers and other adults.** A supervised child's Stanley is notice-only; anything proactive about a child goes to the guardian. A helper can prepare, never confirm. Rung 4 touches only the account holder's own items (22.3).
10. **No commercial pressure.** Value-finding highlights what the guest already has; offers are a separate opt-in.
11. **Only when it applies.** Every ability carries an *applies-when* clause (traveller count, ages, role, persona, stage) and is invisible when it does not apply. Several items for one booking in one period roll up into one.

---

## 3. The autonomy ladder

Today's behaviour is rung 2. The plan adds rungs 1, 3 and 4 only for narrow, safe classes.

| Rung | Name | What Stanley does | Examples | Guest control |
|---|---|---|---|---|
| 0 | **Tell** | Answers or explains, nothing changes | "What does this charge mean?" | none needed |
| 1 | **Notice** | Flags something unprompted, in the right lane | "Your passport expires within six months of the return date" | voice level, per-topic off |
| 2 | **Prepare** | Builds a preview; the guest confirms each time | Add excursion, move dinner, draft case (exists) | Confirm or Not now |
| 3 | **Standing preparation** | The guest sets a **rule** once, or switches on a pack ability; when it fires Stanley prepares the preview and notifies; one tap to confirm | "If my tour is cancelled, find me a replacement the same day" | Rule list, pause, delete |
| 4 | **Pre-authorised and reversible** | For the **classes the guest switched on** (AUT-01 to AUT-09, 11.4), Stanley acts and tells them, with an undo window | Set my deadline reminders; add free items to my plan marked "Stanley's pick"; keep my dinner when the show moves | Per-class switch, daily cap, undo, activity ledger, one master pause |
| Never | | Pay, cancel a booking, change cabin or cruise, share personal data, message another person, answer for the guest to staff, submit a signed declaration | | not available |

**A rung 4 act must meet all five tests:** free, reversible within the guest's own window, affects only the guest's own items (the one booker exception is AUT-04, 22.3), no commercial effect, no data leaves the account. The code form is the act-or-ask gate (19.6). Anything not on the nine-class list needs a new decision.

---

## 4. Capabilities

Each has a priority (P0 must, P1 should, P2 later), the rung it uses, and what it builds on. IDs are used in the phases (section 27).

### A. Save time

| ID | Capability | What it does | Rung | Pri | Builds on |
|---|---|---|---|---|---|
| ACT-01 | **Bundles** ("plan my evening", "fill the day" with a pace setting) | One request becomes an ordered set of previews (show, dinner, a quiet drink, walk times) confirmed together or one by one, one receipt and one-tap undo of the set | 2 | P0 | Planner, previews, route finder |
| ACT-02 | **Trip checklist concierge** | Walks through what is outstanding per traveller (documents, check-in, boarding pass saved, dining, excursions), opening the right screen or preparing the right action, and ticks them off | 2 | P0 | Checklist, Stanley Next |
| ACT-03 | **Drafts for approval** | Drafts the awkward thing for review: message to the party, a case, a thank-you to a crew member, a survey answer, a late-arrival note to the ship | 2 | P1 | Handoff drafts, meeting-point code, storyteller |
| ACT-04 | **Smart defaults** | Pre-fills a booking, order or form from remembered preferences and the party, with the source shown | 2 | P1 | Memory, party |
| ACT-05 | **Reminders, rebuilt** | Natural language, anchored, snoozable, honest delivery ladder | 2 and 4 | P0 | **Owned by the reminders document** |
| ACT-06 | **Morning brief and evening look-ahead** | A short message at the time the guest chooses: today's plan, all-aboard time, what is unbooked, what changed overnight; in the evening, tomorrow and any deadline (bag night) | 1 | P0 | Day modes, change engine, plan |
| ACT-07 | **Voice shortcuts** | "Hey Stanley, remind me...", "what's next" using existing speech input | 0 to 2 | P2 | `StanleyVoice` |
| ACT-08 | **One-tap repeat** | "Same as last time" for a dinner request or an order made often | 2 | P2 | Receipts |

### B. Catch issues before they cost something

| ID | Capability | What it checks | Rung | Pri | Builds on |
|---|---|---|---|---|---|
| CHK-01 | **Trip check-up** (on demand and scheduled) | Passport validity against the return date and each country's rule; names matching documents; missing documents per traveller; tight travel-day connection; check-in not done; payment dates; arrival-day buffer | 1 | P0 | Resolvers, documents |
| CHK-02 | **Plan lint** | Overlaps, too-tight transitions using real walk times, a tour that clashes with all-aboard, an excursion unsuitable for a traveller's pace or access, a booked dinner on a late-port night | 1 | P0 | Planner, route finder, excursion fit |
| CHK-03 | **Missed-ship guard** | Compares the guest's planned return with all-aboard and walk and tender time; quiet nudge as the buffer shrinks, critical when gone; offers the missed-ship path; scales with the "I stay out late" memory | 1 | P0 | Port pilot, tender outlook, `AwayRules` |
| CHK-04 | **Bill watch** | Duplicate or unexpected charges, a charge for something a package includes, an unused credit near disembark, posted vs pending; drafts a billing question | 1 and 2 | P0 | Money rules, billing case |
| CHK-05 | **Forgot something?** | Packing list tuned to itinerary, weather, formal nights, port rules | 1 | P1 | `packing.ts`, forecast |
| CHK-06 | **Access and needs check** | A traveller's stated mobility, diet or allergy against dining, excursions, tender ports and routes, with evidence and a human-verification route; never says "safe" | 1 | P1 | Memory (sensitive off by default) |
| CHK-07 | **Group gaps** | Who has not answered a poll, who has no dinner; "three of you have not chosen a dinner" | 1 | P1 | Polls, group diplomat |
| CHK-08 | **Deadline radar** | One list of every date that can cost money or access, ordered by consequence | 1 | P1 | Notices, plan |

### C. Get more out of the app and the trip

| ID | Capability | What it does | Rung | Pri | Builds on |
|---|---|---|---|---|---|
| VAL-01 | **Included-value finder** | "Your package includes a drink at the pool bar and you have not used it this week." Strictly what the guest already has; paid options only if they ask "what else is there?" | 1 | P0 | Entitlements, spend |
| VAL-02 | **Feature discovery at the right moment** | Introduces a feature when useful: route finder on a first lost-in-the-ship moment, offline pack before the first port | 1 | P1 | Coach, moments |
| VAL-03 | **Availability watch** (watch and prepare) | "Tell me if a table opens Thursday", "tell me if this excursion gets space"; on a hit, a one-tap booking preview. **Never holds anything.** Honest with simulated and real inventory alike | 3 | P1 | Dining, excursions, scheduler |
| VAL-04 | **Today at sea / in port, curated** | "Three ways to spend the free hour", each real and reachable now, with walk time and cost | 1 | P1 | Day modes, planner |
| VAL-05 | **Memory-powered suggestions** | Uses preferences left switched on (pace, interests) to rank, with "why this" | 1 | P1 | Memory |
| VAL-06 | **After the trip** | Recap, photos, feedback drafts, loyalty explained, a next-voyage idea; paused while a serious case is open | 1 | P2 | Storyteller, loyalty |
| VAL-07 | **Daily digest for the party** (opt-in, shared) | A shared card the organiser posts: today's plan, meeting points | 3 | P2 | Group, meeting points |

### D. Standing rules and watches

A **rule** is "when X happens, prepare Y", created in plain words or from a template, evaluated by the server on a clock. **Two kinds exist and share one engine:** *guest-made rules* from the templates below (at most 10 active), and *pack abilities* from the stage tables (section 12), which are switches with no count limit. Both expire at disembark, are paused by do-not-disturb except critical, and **never** pay, cancel, message another person or change the booking itself. At most 5 prepared previews wait for a guest at once; extras roll up.

| ID | Template | Trigger | Result |
|---|---|---|---|
| RUL-01 | "If my excursion is cancelled or moved, find me a replacement" | Change event on a booked tour | Rung 3: best same-day option, with alternatives |
| RUL-02 | "Keep my dinner at 8:00 if the show moves" | Programme change | Rung 3 (rung 4 only via AUT-08): moves the dinner or warns it cannot |
| RUL-03 | "Tell me when check-in opens" | Check-in state | Rung 1 |
| RUL-04 | "Tell me if tenders are delayed on port days" | Tender outlook worsens | Rung 1, critical when the buffer is gone |
| RUL-05 | "If a table opens at X, tell me and line it up" | Inventory change | Rung 3: booking preview, no hold (same engine as VAL-03) |
| RUL-06 | "Remind me to set out my formal clothes the night before formal night" | Programme | A reminder (class E or AUT-02) |

---

## 5. Where it appears (one design, many surfaces)

| Surface | Role |
|---|---|
| **The permanent Stanley thread** | The inbox and doorbell for every proactive item and receipt. Lanes: critical, important, reminder, info, suggestion. "Needs you" strip. Reply chips: Got it, Why?, Do it, Not now, Too much, Don't show again |
| **Stanley activity** (one screen) | Tabs **Did** (receipts, undo), **Watching** (rules, watches, reminders), **Remembers** (preferences); also permissions, Pause everything and consent history. A stop button on every row |
| **Stage Home Next steps** | The next due item from the check-up or reminders is the Next step; the same item as its notice |
| **In context** | A Stanley chip on a plan item, excursion, dinner, port day, bill line: "Check this", "Remind me", "Watch this", "Why this?" |
| **Voice level** | The existing per-device display setting governs how much he *says* (rung 1 and the suggestion lane); authority (rungs 3 and 4) is a separate server-side choice (11.1) |
| **Settings: What Stanley may do** | The level and the full checklist (11.3) |

---

## 6. Explaining it to the guest: the Stanley welcome page

### 6.1 Problem
`StanleyIntro.tsx` lists four abilities and a volume choice. It does not say Stanley can **do** things or **keep watch**, shows no examples, and does not explain what he will never do or how to stop him. A guest who thinks Stanley is a FAQ will never try the best features. Separately, it does not ask how much he may do.

### 6.2 Flow (same page, still one column on a phone, under 60 seconds, skippable at every step)

1. **Hero:** Stanley's wave pose and "Hello, I am Stanley".
2. **Four short cards**, each with a **Try it** chip that opens Stanley with the words ready (the existing prefill API) and returns:
   - **I answer.** "Ask me about your ship, the ports, your plans and your bill, in plain words." *Try: "What time must I be back in Cozumel?"*
   - **I do things for you, with your OK.** "I can book a dinner, add an excursion, change your day, set a reminder or start a poll. I always show you first, and nothing happens until you say yes. You can undo most things." *Try: "Plan my evening."*
   - **I keep watch so you don't have to.** "I check your trip for problems, tell you when something changes and what it means, and nudge you before a deadline." *Try: "Check my trip."*
   - **I help you get more from your trip.** "I find what you have already paid for, suggest things you will enjoy, and help you remember it afterwards." *Try: "What is included for me?"*
3. **"What I will never do"** card: never pay or cancel for you, never change your booking without your yes, never share your details, never message anyone for you, never replace the ship's announcements. "I am not a crew member. For anything urgent, ask a person."
4. **Step 1: choose a level** (11.2).
5. **Step 2: the checklist** (11.3), pre-ticked from the level. Skipping leaves level 2 with CL-01 to CL-03 on.
6. **Summary** ("You chose Do the legwork. 7 things are on, 3 are off.") with a Try-it, then **Continue**. A link to Stanley activity and to notice settings (quiet hours, categories).

An account with nothing linked sees what Stanley *would* do once a booking is linked ("link a booking") instead of dead switches.

### 6.3 Wireframes (static, used in research R1 to R4)

```
 SCREEN A: LEVEL                         SCREEN B: CHECKLIST (level 3 chosen)
+--------------------------------+      +--------------------------------+
|  [Stanley waves]               |      |  Here is what I will do        |
|  How much help do you want?    |      |  Change anything you like.     |
|                                |      |                                |
|  ( ) Just answer               |      |  WATCHING                      |
|      I answer when you ask.    |      |  [on ] Check my trip for       |
|  (o) Keep watch  (recommended) |      |        problems                |
|      I warn you; you decide.   |      |        e.g. "Passport expires  |
|  ( ) Do the legwork            |      |        within 6 months"        |
|      I line up fixes; you say  |      |  [on ] Tell me what changed    |
|      yes.                      |      |  ...                           |
|  ( ) Handle the small stuff    |      |  PREPARING                     |
|      Small free things I just  |      |  [on ] Line up a fix when a    |
|      do and tell you. I never  |      |        plan breaks             |
|      pay or cancel.            |      |  HANDLING  (needs level 4)     |
|                                |      |  [off] Set my reminders [Raise]|
|  What I never do >             |      |  [Continue]  [Skip for now]    |
+--------------------------------+      +--------------------------------+

 SCREEN C: SUMMARY                       SCREEN D: SETTINGS "What Stanley may do"
+--------------------------------+      +--------------------------------+
|  You chose: Do the legwork     |      |  Level: Do the legwork  [Change]|
|  7 things are on. 3 are off.   |      |  [ Pause everything ]          |
|  Change this any time in       |      |  Now: Prebook                  |
|  Settings > What Stanley may   |      |   [on] Book first-night table  |
|  do.                           |      |        last used: 2 days ago   |
|  [Try it: Check my trip]       |      |  Later stages (collapsed) >    |
|  [Done]                        |      |  History of changes >          |
+--------------------------------+      +--------------------------------+
```

### 6.4 Wording (English only; the word "AI" never appears; a test fails the build if it does)
- `stanleyIntro.can.1` Answer your questions about your cruise, your ship, the ports and your bill, in plain words.
- `stanleyIntro.can.2` Do things for you, with your OK: book a dinner, add an excursion, change your day, set a reminder. I always show you first, and most things can be undone.
- `stanleyIntro.can.3` Keep watch: check your trip for problems, tell you when something changes and what it means for you, and remind you before a deadline.
- `stanleyIntro.can.4` Help you get more from your trip: find what you have already paid for and suggest things you will enjoy.
- `stanleyIntro.never.title` What I will never do
- `stanleyIntro.never.body` Pay for anything, cancel or change your booking without your yes, share your details, message other people for you, or replace the ship's announcements. I am not a crew member. For anything urgent, ask a person.
- `stanleyIntro.control.body` You decide how much I say and how much I may do. See what I have done and what I am watching in Stanley activity, and stop any of it.

### 6.5 Beyond the first visit
- **What Stanley can do** screen, reachable from Help and the thread header, driven by the **server's capability catalogue** (thin client): each capability with its stage, an example, whether it is on, and **Try it**. New capabilities appear without a front-end change.
- **First-use explainers.** The first time a guest meets a new kind of help (a rule, a check-up result, a bundle, a rung 3 or 4 act) one short line explains what it is, how to undo it and how to stop it; never repeated.
- **Stage tips.** On entering a stage, one "Stanley can help here" line with a try-it, plus that stage's extras (11.3); counts against the proactive caps.
- **Accessibility:** section 25. **Honesty:** examples use words Stanley really handles, and a test fails if an example does not return an answer.

---

## 7. What is stored

All additions go in `docs/stanley-data-inventory.md` in the same change as the table.

| Data | Purpose | Kept | Never stored |
|---|---|---|---|
| **Permissions and consent history** (account, ability, state, wording version, source, time, by) | Prove what the guest agreed; enforce | Life of the account; grants lapse 3 days after disembark | Free text |
| **Support level, pause state, per-class counters** | Caps, circuit breaker | Account life | |
| **Rules** (a guest's own, typed arguments) and pack-ability switches | Evaluate | To disembark plus 3 days | Anything about others |
| **Ledger** (kind, class, rule id, trigger, fact ids and as-of, undo-until, outcome, receipt number) | Receipts, undo, support | Detail for **90 days after disembark, then counters only** (confirm with retention policy) | Message text, drafts, free-text reminder text |
| **Practice and shadow logs** | Calibration | Aggregated without ids after 30 days | Personal fields |
| **Trip facts used by checks** | Triggers and wording | As today | Document numbers (validity facts only), conversation text |
| **Sensitive needs** (mobility, diet, allergy) | Checks by server rule | Off by default; reach a model only when switched on | |

Further rules: notices follow the thread's lanes, quiet hours, calm mode and budget; a `Bypass` without a safety, deadline or guest-chosen-time reason fails a gate test; kill switches exist per capability, lane, class, cohort; rule evaluation and checks are code, not model calls; guest free text is data in a delimited block, never an instruction; the audit trail records action kind and outcome only.

---

## 8. Verified against the code

A source read (nothing run). Corrections are applied in the text above and below.

| # | Plan assumption | What the code says | Effect |
|---|---|---|---|
| 1 | Nine confirmable action kinds | Confirmed in the `propose_action` tool definition (`StanleyActions.cs`): `order_item`, `add_excursion`, `move_dinner`, `reserve_dinner`, `draft_case`, `plan_change`, `remind_me`, `create_poll`, `change_seating` | None |
| 2 | Helper may prepare five kinds | Confirmed (`StanleyHelperRules.Preparable`); the grant lasts a set number of days from the last save of the helper link | None |
| 3 | "Voice level is per device" | It is a per-device display setting (`settings.ts`) **but is already synced to the server** by `useStanleyLevelSync` (the server wins on open) | Voice stays separate from authority, and authority is server-only. The earlier "per device, not synced" wording is dropped |
| 4 | "No server clock" | `WatchSchedulerService` runs the push dispatch **every 15 minutes**, up to 500 people per pass, under `IWatchLock`; `ChatUrgentRetryService` retries urgent chat | Too coarse for rules. A due-queue is built by reminders phase R3 (= P2c core); the poll stays as a safety net |
| 5 | Step-up authentication is new | `EmailCheckService` and `PhoneRules` already send, hash, expire and attempt-limit an emailed code for a verified address | Step-up **reuses** that code path, generalised from "verify an address" to "confirm this change"; P0a gets smaller |
| 6 | Capability catalogue, permissions, consent log, ledger, classifier flags, rules | A filename-level search of server and front end found no Stanley permission, step-up, ledger or catalogue code (`StanleyPacket.cs` matched "capability" and was not read for relevance) | Confirmed as real gaps; phases P0, P0a, P1, P3a stand |
| 7 | Undo exists for plan changes | Undo handling is present in `StanleyActions.cs` and nowhere else in the domain | The two-hour window and which kinds support undo were **not** verified; P1 confirms before building the ledger on it |
| 8 | Server code never compiled or run here | Still the gap plan's own statement; not re-checked | Owner build and targeted test run before P2c (decision D3) |

**Not done:** a fresh competitor scan beyond the one in the reminders document (section 30.5 there: Royal Caribbean, Celebrity, third-party apps). I did not check whether any cruise app offers user-chosen levels of autonomy, so the wording and research steps (section 13) carry that uncertainty. Check the live Princess app before launch.

**Effect on phases:** no phase was added or removed by this check. Changes: step-up is cheaper (item 5), and the scheduler and delivery work is owned by reminders R3 (item 4).

---

## 9. Measures (consolidated: product, safety, research and rollout)

| Measure | Target | Gate or review when |
|---|---|---|
| Research R1: guests who say what they chose | 80% | G0 |
| Research R1: guests who say he cannot pay | 90% | G0 |
| Research R3: would still use level 3 or 4 after a mistake story | 80% | G0; under 60% makes practice mode the default |
| Welcome flow completion time | Under 60 s | Over 90 s |
| Guests who skip the checklist | Reported | Over 50% (flow too long) |
| Guests who try one "do" or "watch" capability in week one | 40% | Under 20% |
| Guests who choose level 3 or 4 | Reported by level | Under 10% (not compelling) or over 60% (check they understood) |
| Guests who change level in Settings in week one | Under 20% | Over 35% (wrong default or confusing) |
| Guests who open Stanley activity | Reported | Under 10% (not discoverable) |
| Proactive item acted on (confirmed or opened) | 30% | Under 15% (too noisy) |
| Proactive item dismissed with "Don't show again" | Under 10% | Over 20% |
| Check-up finding confirmed true by the guest | 90% | Under 75% |
| Wrong-prepare rate in shadow mode | Under 10% | G2 |
| Rung 3 previews abandoned | Under 50% | G2 |
| Undo rate per rung 4 class | Under 5% | G3, G4; over 10% trips the breaker |
| Guest switches a row off after its first firing | Under 15% | Over 25% (wrong action) |
| Guest-reported errors per 1,000 acts; "Stanley did something I did not expect" reports | Under 2; zero | Any S3 reviewed |
| Class or rule paused by the circuit breaker; S1 or S2 incidents | Zero | Any halts the next gate |
| Duplicate or missed fires (soak and production) | Zero | Any is a defect |
| Complaints or cases mentioning Stanley | Zero rising | Any rise |
| Taps avoided per guest per trip (rung 4 acts plus confirmed rung 3) | Reported | Flat after launch |
| Model calls and cost per guest per trip, by level | Within 24.2 and the daily ceiling | Median rising week on week |
| Staff time to answer "what did Stanley do" | Under 2 minutes | Over 5 |
| Manual accessibility pass | Zero blockers | G1, G3 |

---

## 10. Decisions and open questions

### 10.1 Decided by the owner (2026-11-10)

- **D1. No "AI" wording anywhere in guest-facing Stanley text** (welcome page, thread, cards, receipts, notices, checklist, Settings). Stanley is shown by picture and name. A test fails the build if such a string contains "AI" as a word. The chat research and chat plan "AI label" mentions are overridden.
- **D2. A guest's own reminders fire at the time asked, even in quiet hours.**
- **D3. The owner builds and runs the earlier Stanley server tests (targeted) before P2c.** (The first draft said before P3; the scheduler is the first phase that depends on that code, so the earlier point is used.)

### 10.2 Proposed defaults (owner may change)

- **D4. Two dials.** Voice (exists, per device, server-synced) and authority (new, per account, server) stay separate; voice caps how loudly authority speaks (11.2).
- **D5. Default for a new guest is level 2, Keep watch** (today's behaviour). Levels 3 and 4 are one tap away but **never pre-selected**, including for guests who arrive from a booking (this closes the earlier open question).
- **D6. Where to ask.** Ten cross-journey rows on the welcome page; stage extras at stage entry; everything in Settings at any time. Grants lapse three days after disembark.
- **D7. Briefs and nudges are off until the guest chooses**, except the check-in and payment notices that already exist. CL-04 (briefs) is never pre-ticked because it needs times; Stanley offers it once at the end of Embark.
- **D8. Value finder (VAL-01) is strictly "what you already have".**
- **D9. Check-up depth.** Document-validity and name-match rules are mocked behind an interface, authored per country, labelled with the rule applied ("6 months beyond return") and never described as an official check.
- **D10. The ceiling (section 3) stands at every level.**
- **D11. Spending stays out.** "Delegate with a cap" is **not built**: it breaks the ceiling and needs strong authentication and refund rules. Revisit only with usage numbers, a refund policy and the owner's explicit decision.
- **D12. Availability watch is watch-and-prepare** (VAL-03, RUL-05). "Hold a table for me" stays dropped.
- **D13. Rung 4 is nine classes** (11.4) shipped in the order of P10a to P10c; AUT-04, AUT-08 and AUT-09 (booking or staff effect) come last and only on measured safety.
- **D14. Standing rules: build, but narrow and late.** The rung 3 engine (P9a) is built after P3, P3a, P3b and P2d and reaches guests only through gate G2 (shadow, then canary). Stage packs ship one at a time.
- **D15. Research first.** Section 13 runs before the P0a screens are final; names, defaults and order may change from the result.
- **D16. Ownership rule (22.3).** Rung 4 touches only the account holder's personal items, with one exception: AUT-04 for the **booker acting on the booking**. Anything affecting another adult or a child stops at rung 3.
- **D17. Step-up to raise.** Raising to level 3 or 4, or enabling any rung 4 class, needs the emailed code; lowering needs nothing. Changes notify the other devices and the email with a one-tap revert.
- **D18. Practice mode** is on by default for rung 4 classes and optional for rung 3 rules.
- **D19. Stanley never raises his own authority.** He may offer after three confirmations; the guest decides.
- **D20. Staff and operations (section 20) are a prerequisite of rung 3, not a follow-up.**
- **D21. Reservation quiet window** 07:00 to 22:00 ship time for any act that books something; reminders any time.
- **D22. Ledger retention** 90 days after disembark, then counters only; confirm with the retention policy.
- **D23. Rollout** by shadow, then canary (1%, 10%, 50%, 100%) per class, with a small permanent holdback.
- **D24. Walkthrough cuts and additions** (section 14) are applied: SR-1.4 and SR-1.5 retired, the persona packs added.
- **D25. No phone-location triggers** (IMP-13).
- **D26. Public explanation pages** ship with the welcome page (27.6).
- **D27. The scheduler is a worker** sharing the domain library, using SQL Server leases and an injectable clock, unless the owner prefers a hosted service in the API.
- **D28. Reminder behaviour belongs to the reminders document.** Where the two disagree on lead times, ladders, limits or classes, the reminders document wins (this document uses its limit of 30 reminders per trip for AUT-02, not the earlier 20).
- **D29. Level 1 turns off Stanley's own unprompted items, not the critical list or the notices the guest already controls in notice settings.**

### 10.3 Open for the owner

1. Who owns the **legal and privacy review** of the consent wording, and when (G1 and G3)?
2. Will **dining, spa and stateroom operations** be involved before AUT-04, AUT-08 and AUT-09 (G4)? Recommendation: if not, drop those three (AUT-09 first, as its benefit is smallest).
3. Should the **persona packs** (family, solo, occasion, organiser) ship in the first rung 3 release or follow the stage packs? Recommendation: follow.
4. **Where do research participants come from** (staff families, past guests, a panel)?
5. Test level-name **Set A, B or C, or all three?** Recommendation: all three; it costs one extra screen set.
6. Is **real push** on a date? P2b and several notices depend on it.
7. Do you accept that **no phase after P2c starts until the owner has built and run the earlier Stanley server code** (risk 11)?

---

## 11. Levels, permissions and the checklist: let the guest choose how far Stanley goes

### 11.1 Design findings

1. **Two dials, not one.** `stanleyLevel` (chatty, helpful, asked, off) is **voice**: how much he *says*. Authority is how much he may *do* without being asked. A guest can want a quiet Stanley who handles things, or a chatty one who never touches anything.
2. **Authority lives on the server, per account.** It is a permission to act when the app is closed, so it is stored against the account (a second device sees the same grants), checked by the server on **every** action path, and recorded with the wording version agreed to. The front end renders the catalogue and sends switches.
3. **Rules need a precise clock** (section 8 item 4): reminders R3 builds the due-queue; rules add triggers.
4. **The classifier is the real safety feature.** Whether something may be rung 4 depends on per-item facts: *free or paid*, *fee-free until when*, *affects only this guest or others too*. Catalogues need those flags and the executor refuses a rung 4 act on any item that fails them. Without the flags nothing above rung 3 ships (P3a).
5. **Some forms are attestations.** Online check-in, customs and health declarations are statements the guest signs. Stanley may pre-fill and save a **draft**; he never submits.
6. **Consent fatigue is the risk on the welcome page.** Ask the ten cross-journey choices once; ask each stage's extras when the guest enters that stage.
7. **Autonomy needs a brake:** caps per class per day, a global ceiling on acts without a tap, automatic pause of a class when its undo rate passes a threshold, and a visible "Pause everything".
8. **Most of the power is in stage-shaped standing rules** (section 12): about 70 rules across 11 stages sharing about a dozen server building blocks (scheduler, trigger types, preview builder, classifier, ledger), so cost is in the platform, not each rule.

### 11.2 Four support levels (the first question on the welcome page)

Plain words, no "AI", one radio group. Each level includes the one above it; the checklist fine-tunes. Rungs are for the design team only.

| Level | Guest-facing name and line | Rungs | What changes |
|---|---|---|---|
| **1** | **Just answer.** "I answer when you ask, and nothing else." | 0, 2 on request | No unprompted Stanley items, no rules. The critical list and the notices the guest controls in notice settings continue (D29) |
| **2** | **Keep watch.** "I check your trip, warn you about problems and tell you what changed. You decide everything." | 0 to 2, plus 1 | Check-ups, change explanations, deadline notices; briefs once the guest sets times. **Default for a new guest** |
| **3** | **Do the legwork.** "When something happens, I line up the fix and ask for your yes. Rules I offer you at each stage." | 0 to 3 | Standing rules and pack abilities; bundles; drafts and pre-filled forms; watches that prepare a booking. One tap to confirm each |
| **4** | **Handle the small stuff.** "For small free things you can undo, I just do them and tell you. I never pay or cancel." | 0 to 4 | Adds the nine rung 4 classes (11.4), each separately switchable, with caps, undo and a ledger |

**Interplay with voice.** Voice *off* caps authority at level 1. Voice *asked*, calm mode and simple mode keep rungs 3 and 4 working but their notices go to the thread and Stanley activity **without a push**, except critical items: a level 3 or 4 guest on *asked* finds a prepared fix waiting, never a buzz. Level changes affect new events only; nothing already prepared is cancelled silently.

**The ceiling is unchanged at every level** (section 3).

### 11.3 The welcome-page checklist (and the same list in Settings)

**Step 2 is pre-ticked from the chosen level**, one switch per row, a plain sentence plus a one-line example, under three headings. Rows above the level are shown off and marked "needs level 3" (or 4) so the guest sees what more exists and can raise the level in one tap (with step-up).

| ID | Row (guest wording) | Example shown | Needs level | Rung | Built from |
|---|---|---|---|---|---|
| **Watching** |
| CL-01 | Check my trip for problems | "Your passport expires within 6 months of the return date." | 2 | 1 | CHK-01, CHK-02 |
| CL-02 | Tell me when something changes and what it means | "Your tour moved to 9:30. You now have 20 minutes less in port." | 2 | 1 | change engine |
| CL-03 | Watch my bill and what I already have | "A charge appears twice." "Your package includes the pool bar drink." | 2 | 1 | CHK-04, VAL-01 |
| CL-04 | Morning brief and evening look-ahead (choose the times) | "Today at a glance, and tomorrow's early start." | 2, **never pre-ticked** (needs times) | 1 | ACT-06 |
| **Preparing** |
| CL-05 | Line up a fix when a plan breaks, for my yes | "Your tour is cancelled. Here is the best replacement today." | 3 | 3 | RUL-01, 02, 04 |
| CL-06 | Fill in forms and drafts for me to check | "Check-in is open. I filled it in; please check and send." | 3 | 3 | ACT-03, ACT-04 |
| CL-07 | Tell me when a table or space opens, with a ready booking | "A table for four opened on Thursday at 7:30." | 3 | 3 | VAL-03, RUL-05 |
| **Handling** |
| CL-08 | Set my reminders for me (deadlines, check-in, bag night, all aboard) | "I added 6 reminders for your trip. Change any of them." | 4 | 4 | AUT-02 |
| CL-09 | Plan my days and keep the plan up to date with free things | "I added a free show at 8:30 as Stanley's pick. Remove it if you like." | 4 | 4 | AUT-03 |
| CL-10 | Book the free things I always want (main dining, free shows) | "I booked your usual table for four at 6:00. Undo for 2 hours." | 4 | 4 | AUT-04 |

**Skipping** leaves level 2 with CL-01, CL-02 and CL-03 on. Per-stage extras (section 12) are offered at stage entry, not here.

**Rules for every row.** The consent sentence is shown in full and versioned; the switch writes one server record (guest, ability, state, wording version, source `welcome`, `settings` or `stage`, time). Every row says what it will **never** do. Turning a row on never retro-fires on old events. A row's example must work or the build fails. Rows are served by the **capability catalogue**, so a provider switch-off or kill switch hides a row with no front-end change.

**Settings: "What Stanley may do"** (plum, linked from the welcome page, Stanley activity and the thread header):

1. Level radio (11.2), with a plain note when voice limits it.
2. The ten rows, then **each stage's extras** in stage order (current stage first, later stages collapsed), each with switch, one-line example, **last used** and **times used**.
3. **Pause everything** (rules and rung 4 stop; notices and answers continue; reversible), and "pause for today" until midnight ship time.
4. Raising the level asks once: "This also turns on 3 more things: [list]. Turn on?" and needs step-up. Lowering asks nothing and switches rows off at once.
5. **Consent history** and a link to Stanley activity.
6. A second device sees the same state. A **helper** can see it but not change it. A **supervised child** has level 1 only; the guardian chooses for them.

**Expiry and re-asking.** Level 3 and 4 grants lapse three days after disembark and are asked again on the next trip. Preferences travel with the guest across trips; grants do not (IMP-09).

### 11.4 Rung 4: the nine classes ("Handle the small stuff")

Each is a separate server switch, off unless the level includes it, with a daily cap, a ledger line per act, an undo window (default 2 hours, never past the point the thing becomes non-refundable) and the five tests. A class fires only on items the **classifier** marks eligible, and only through the act-or-ask gate (19.6). Reminder limits and lead times come from the reminders document (31.4). A reminder or device-side action (AUT-02, AUT-07) is *due* on the server and delivered or performed by the app, so the rule "no data leaves the account" holds.

| ID | Class | What Stanley does alone | Cap | Never |
|---|---|---|---|---|
| AUT-01 | **Reminders that follow** | Moves a reminder when its anchor moves, and says so | none | Fires a reminder earlier than the guest set without telling them |
| AUT-02 | **Deadline reminders** | Creates reminders for the dates that matter (final payment, check-in opens, documents, dining freeze, bag night, all aboard, exit time) with the guest's usual lead times | 30 per trip (reminders 31.4) | Creates a recurring reminder or one not tied to a trip date |
| AUT-03 | **My plan, topped up** | Adds free events, walks and meeting points to the guest's **personal** plan, labelled "Stanley's pick", and removes his own picks that no longer fit | 4 per day | Removes anything the guest added; adds anything with a cost or overlapping a booked item; touches a shared plan |
| AUT-04 | **Free reservations I always want** | Reserves free, fee-free-to-cancel items the guest has a standing preference for (main-dining table, free shows) when the window opens | 2 per day | Specialty dining with a cover charge, paid shows, anything on another adult's own account. The one exception: the **booker reserving on the booking** |
| AUT-05 | **Lists kept current** | Updates packing list, document "bring" list, trip checklist, shortlist and comparison when facts change | none | Deletes a guest's own entry |
| AUT-06 | **Drafts saved** | Saves pre-filled forms and drafts (check-in, customs, feedback, a note to the party) for the guest to review | 1 draft per form | Submits, signs or sends |
| AUT-07 | **Saved for me** | Saves the boarding pass to Wallet, prepares the offline pack on Wi-Fi before a port, saves receipts and the recap, builds the photo album | none | Uses data the guest has not already given |
| AUT-08 | **Keep my timings** | Moves the guest's own **same-price** booking (a dinner) when a show or port time shifts and the move stays free; otherwise prepares a fix (rung 3) | 2 per day | Moves a paid booking or one for another person |
| AUT-09 | **My standing order** | Repeats a free stateroom request made three times (ice, towels, a pillow) at the time chosen | 1 per day | Orders anything with a charge |

AUT-04, AUT-08 and AUT-09 affect staff or a booking, so they ship last and only after G4.

---

## 12. Per-stage deep dive: what Stanley can do at each of the 11 stages if allowed

**How to read it.** Stages and tabs come from `docs/stage-experience-plan.md` 5.1. **Stage welcome ask** is the two to four extras offered at stage entry (through the stage welcome), shown only for abilities the level allows. Rule IDs are `SR-<stage>.<n>`; retired IDs are not reused. **Rung** is the highest the rule uses: a level 3 guest gets it as "prepare", a level 4 guest as "act" only where an AUT class is named. "Needs" is a gap that must exist first (all rows also need the scheduler). Rules expire at disembark unless stated. Cross-journey rows (CL-01 to CL-10) apply from Manage on and are not repeated. **Reminder timings in this section defer to the reminders document** (lead times 31.2, ladders 31.1, all-aboard ladder 31.3); a rule here says *whether* a reminder exists, that document says *when*.

### 12.1 Dream (Explore, Ask)
Today: quiz, grounded planner chat, compare, dream board, favourites, price alerts. Stage welcome ask: SR-1.1, SR-1.3.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-1.1 | **Shortlist for me.** Keeps up to three sailings that fit the quiz answers; refreshes weekly; tells the guest what changed and, once a week, what could change their mind (the retired SR-1.4 brief folds in here) | Weekly clock, new sailing | 4 (AUT-05) | Sailing feed (mock) |
| SR-1.2 | **Dream-board referee.** Tells the party when two picks disagree and prepares a poll (hidden for a one-traveller booking) | Board edit | 3 | Polls, group diplomat |
| SR-1.3 | **Price watch on favourites** with a plain "price fell 8%" note and reason | Fare change | 1 | Mock fare feed |

*Retired: SR-1.4 (folded into SR-1.1), SR-1.5 trial-day nudge (stays a normal coach moment, not a rule).*

### 12.2 Discover (Sailing, Cabin, Cost)
Today: cabin chooser, sailing compare, cost calculator, decision brief, 48-hour hold. Stage welcome ask: SR-2.1, SR-2.2.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-2.1 | **Cabin like this.** Watches for a cabin that matches remembered needs (quiet, midship, not under a pool, accessible) and prepares a side-by-side | Inventory change | 3 | Mock inventory |
| SR-2.2 | **Keep my cost honest.** Refreshes the cost calculator when fares, taxes or package price change and says what moved | Fare change | 4 (AUT-05) | Mock fare feed |
| SR-2.3 | **Hold before it goes.** After comparing the same two sailings twice, offers a 48-hour hold, never a countdown | Behaviour | 3 | Hold flow |
| SR-2.4 | **Tell me what I'd regret.** For a shortlisted sailing or cabin, the top three things past guests wished they had known | Open of a card | 1 | Review notes |
| SR-2.5 | **Package break-even.** Works out whether a drinks or dining package pays for the guest's stated habits | Calculator edit | 1 | Entitlement data |

### 12.3 Book (Booking, Travellers, Pay)
Today: draft-safe checkout, split payments, plain contract, name capture. Stage welcome ask: SR-3.1, SR-3.2.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-3.1 | **Check before I pay.** Compares each traveller's name with their document and flags dietary, allergy and accessibility needs not yet captured | Before the pay step | 1 (blocks nothing) | Document facts |
| SR-3.2 | **Fill the travellers for me** from remembered details with the source on every field. For one traveller this is a level 2 smart default (ACT-04), not a rule | Travellers step | 3; draft at 4 (AUT-06) | Memory, party |
| SR-3.3 | **What happens if.** Turns the cancellation policy into "cancel on 12 Jan costs $420" for the guest's real dates | On request, at pay | 1 | Policy rules |
| SR-3.4 | **Share-the-cost links.** Prepares pay-your-share links for each payer; the guest sends them | 2+ payers | 3 | Payer links |
| SR-3.5 | **Deposit reminder** before a hold lapses | Hold clock | 4 (AUT-02) | Hold flow |
| SR-3.6 | **Price-drop re-pricing.** Prepares the re-price request if the fare drops after booking | Fare change | 3 | Re-pricing rules |

### 12.4 Manage (Trip, Needs, Group)
Today: documents engine, payment calendar, change handling, special assistance, phone-at-sea guide, helper role, packing. Stage welcome ask: SR-4.1, SR-4.2, SR-4.3.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-4.1 | **Document guard.** When a passport or visa is missing, near expiry or does not cover the return date, prepares the upload or renewal reminder per traveller | Weekly, document change | 3 | Rule table per country |
| SR-4.2 | **Payment ladder.** Reminders before final payment with the amount and what happens if missed; prepares the pay screen, never pays. Dates per reminders 31.2 (30, 14, 7, 2 days and the day); the arbiter rolls them up, and the guest can thin them | Payment dates | 4 (AUT-02) | Payment calendar |
| SR-4.3 | **Assistance deadlines.** Starts special-assistance and dietary requests early enough for the notice period and tracks the confirmation | Cut-off minus lead | 3 | Needs tracker |
| SR-4.4 | **Itinerary change responder.** Explains the effect, lists the choices, prepares the one that fits the guest's rules | Change event | 3 | Change engine (exists) |
| SR-4.5 | **Weekly what to expect**, one note, one action | Weekly | 1 | Persona |
| SR-4.6 | **Packing kept current** as forecast and itinerary change | Forecast, itinerary | 4 (AUT-05) | Packing |
| SR-4.7 | **Family-at-home page refresh** reminder, never posted without the guest | Before sailing | 3 | Family page |
| SR-4.8 | **Helper summary.** A weekly "what is left" for an authorised helper | Weekly | 1 | Helper role |

### 12.5 Prebook (Plan, Prepare, Group)
Today: dining, excursions, shows, spa, packages, plan and polls. Stage welcome ask: SR-5.1, SR-5.2, SR-5.3.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-5.1 | **First-night booking.** When the window opens, books or prepares the main-dining table the guest usually wants | Window opens | 4 (AUT-04) | Window dates, fee-free flag |
| SR-5.2 | **Plan my days.** Builds a day-by-day plan from interests, pace and mobility with free picks and gaps; keeps it current | Plan edit, change | 4 (AUT-03) | Planner, route finder |
| SR-5.3 | **Space opens.** Watches a named excursion, specialty table, spa slot or show and, on a hit, prepares the booking | Inventory change | 3 | Mock inventory (VAL-03) |
| SR-5.4 | **Dinner for everyone.** Starts a poll, then prepares each person's reservation for their own confirmation (hidden for one traveller) | Party of 3+ | 3 | Polls |
| SR-5.5 | **Package check.** Compares buying a package now with paying as you go | Package view | 1 | Entitlements |
| SR-5.6 | **Excursion fit.** Flags a tour that clashes with all-aboard, pace or access need and offers two alternatives | Add to cart | 3 | Excursion fit |
| SR-5.7 | **Occasion helper.** Prepares the cake, decoration or celebration request for the guest to send | Occasion in profile | 3 | Services |

### 12.6 Get to the ship (Board, Travel, Plan)
Today: online check-in, boarding pass, flight and traffic, travel plan, arrival window, phrases, onward travel; boarding-day mode. Stage welcome ask: SR-6.1, SR-6.2, SR-6.3.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-6.1 | **Check-in ready.** When check-in opens, pre-fills it from the documents and saves a draft to check and send; **never submits** | Check-in opens | 4 for the draft (AUT-06); submit is 2 | Check-in flow |
| SR-6.2 | **Leave on time.** Sets the leave-for-the-terminal reminder and moves it when traffic or a flight changes | Travel plan, traffic | 4 (AUT-01) | Traffic and flight (mock) |
| SR-6.3 | **Boarding pass saved** to Wallet and offline once it exists | Pass issued | 4 (AUT-07) | Wallet |
| SR-6.4 | **Flight watch.** If a flight threatens the ship, says so, shows the missed-ship path and drafts the "running late" note to the cruise line | Flight status | 3 (draft) | Flight (mock) |
| SR-6.5 | **Terminal ETA draft** for the party, one tap to send | Leave time | 3 | Party chat |
| SR-6.6 | **Phone and money set-up.** The roaming and card checklist, ticked from what is done | 3 days out | 1 | Phone guide |

### 12.7 Embark (Board, Ship, Plan)
Today: terminal and arrival help, muster, medallion, first-four-hours mode, ship explorer, route finder. Stage welcome ask: SR-7.1, SR-7.2.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-7.1 | **First night, sorted.** Builds the first evening (muster, a walk to dinner, a sailaway spot) from what the guest booked and adds the free parts | Boarding | 4 (AUT-03) | Planner |
| SR-7.2 | **Muster, never missed.** A reminder with the station and the walk from the cabin (class A, reminders 31.1) | Muster time | 4 (AUT-02) | Muster data |
| SR-7.3 | **Cabin ready.** Tells the guest when the cabin is ready and where | Cabin status | 1 | Ship feed (mock) |
| SR-7.4 | **First-night ordering.** Prepares the usual stateroom items for the evening | Boarding | 3; 4 (AUT-09) | Stateroom service |
| SR-7.5 | **Set the ship up.** Offers the offline pack, route finder and chat once, when each is useful | Aboard | 1 | Coach |

### 12.8 Sea (Today, Ship, People)
Today: day plan, events, dining, spa, packages, spend pace, people and chat; sea-day mode. Stage welcome ask: SR-8.1, SR-8.2, SR-8.3.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-8.1 | **Build my day.** Each morning, tops up the day with free picks that fit pace, interests and walking, leaving gaps | 7:00 ship time | 4 (AUT-03) | Planner |
| SR-8.2 | **Nothing late.** A reminder before each plan item with the walk time; moved when the item moves | Plan items | 4 (AUT-01, AUT-02) | Walk times |
| SR-8.3 | **Keep dinner and show in step.** If the show or dinner moves, moves the dinner when it is free and fits; otherwise prepares a fix | Programme change | 4 (AUT-08) | Same-price flag |
| SR-8.4 | **Free hour ideas.** Three real things to do now, with walk time and cost | A gap in the plan | 1 | Planner |
| SR-8.5 | **Spend guard.** Tells the guest at 80% of the daily budget they set and shows what is already included | Folio | 1 | Spend pace (exists) |
| SR-8.6 | **Space opens at the spa or a specialty table** | Inventory | 3 | Mock inventory |
| SR-8.7 | **Formal night, ready.** Reminds the evening before and lists the dress code | Programme | 4 (AUT-02) | Programme |
| SR-8.8 | **Tomorrow's port, prepared.** The evening before a port, prepares the shore plan and tender outlook | 18:00 | 3 | Port pilot |
| SR-8.9 | **Party digest.** A shared card the guest posts for the party (never fires for one traveller) | Daily | 3 | Group |

### 12.9 Port (Port, Ship, People)
Today: port pilot, all-aboard and tender outlook, excursions, shore plan, phrases, weather, port-day mode. Stage welcome ask: SR-9.1, SR-9.2, SR-9.3.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-9.1 | **Missed-ship guard.** Watches the return buffer against all-aboard, tender and walk time; quiet nudge as it shrinks, critical when gone; always in more than chat (= CHK-03) | Port clock | 1 | Port pilot |
| SR-9.2 | **Back on time.** Sets "head back" at the buffer time and moves it when tender or traffic changes | Buffer | 4 (AUT-01) | Tender (mock) |
| SR-9.3 | **Tour cancelled? Replacement.** Prepares the best same-day option and alternatives (= RUL-01) | Change event | 3 | Excursion inventory |
| SR-9.4 | **Rain plan.** When the forecast turns, prepares an indoor alternative | Forecast | 3 | Weather (mock) |
| SR-9.5 | **Port pack ready.** Prepares the offline pack on Wi-Fi before arrival | Day before | 4 (AUT-07) | Offline pack |
| SR-9.6 | **Local rules.** Dress, currency, tipping and photo rules for this port, once | Port day start | 1 | Port data |
| SR-9.7 | **Tender tickets.** Prepares the tender ticket request when the ship tenders | Tender day | 3 | Tender flow |
| SR-9.8 | **Meet-me-here.** Prepares the shared meeting point and a "running late" note | On request | 3 | Meeting points |

### 12.10 Disembark (Leave, Ship, People)
Today: bags, exit time, customs, tips, folio, last-morning mode. Stage welcome ask: SR-10.1, SR-10.2, SR-10.3.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-10.1 | **Bag night.** Reminds in time and prepares bag tags and the exit-time pick for the guest's confirmation | Last evening | 4 (AUT-02); pick is 3 | Disembark data |
| SR-10.2 | **Final-bill review.** Flags duplicates, unexpected items and unused credit, and drafts the billing question (= CHK-04 at the end) | Last evening | 3 | Bill watch |
| SR-10.3 | **Customs ready.** Pre-fills the customs declaration as a draft; never submits | Last full day | 4 for the draft (AUT-06) | Customs flow |
| SR-10.4 | **Tips explained.** Shows suggested tips and what changing them costs; any change is rung 2 | Last evening | 2 | Gratuity rules |
| SR-10.5 | **Onward travel watch.** Watches the flight and transfer and says when to leave | Flight status | 1; 4 for the reminder (AUT-01) | Flight (mock) |
| SR-10.6 | **Leave nothing behind.** A last-look checklist | Final morning | 1 | Checklist |
| SR-10.7 | **Settle-up note** for friends sharing costs: reads the guest's notebook and says who owes what; nothing is paid or sent | Disembark | 1 | Fare-split notebook |

### 12.11 Remember (Memories, Next, Feedback)
Today: storyteller, photos, feedback, keep chats, next trip, diary. Stage welcome ask: SR-11.1, SR-11.2.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-11.1 | **Recap and album built** from the guest's own data | Disembark + 1 day | 4 (AUT-07) | Storyteller |
| SR-11.2 | **Feedback drafted.** Drafts survey answers and a thank-you for a crew member; never sends | Disembark + 2 days | 4 for the draft (AUT-06) | Feedback |
| SR-11.3 | **Keep my chats.** Prompts before chats are cleared | Retention clock | 1 | Chat retention |
| SR-11.4 | **Next voyage, from what I liked.** Built from preferences left on; offers are a separate opt-in; paused while a serious case is open | 10 days | 1 | Memory |
| SR-11.5 | **Loyalty explained** in plain words | Disembark | 1 | Loyalty |
| SR-11.6 | **Expense export** on request | On request | 1 | Folio |

### 12.12 Patterns, risks and build order

- **Three shapes cover almost everything:** *watch then tell* (rung 1), *watch then prepare* (rung 3) and *keep a thing of mine current* (rung 4: AUT-02, 03, 05, 07). Only AUT-04, 08 and 09 touch a booking or another person.
- **The first two stages are rule-poor on purpose.** Before booking there is no money at stake and no trip to protect; the honest value is a better decision, not automation.
- **The densest stages are Prebook, Sea and Port.** They save the most time and a wrong automatic act hurts most there, so their rung 4 classes come last.
- **Shared rooms and parties.** Rung 4 touches only the guest's own items. Anything for the party stops at rung 3, and in a shared room the **booker** owns dining plan and excursion changes.
- **Dependencies, in order:** scheduler (reminders R3); classifier flags (free, fee-free until, only-me); preview and ledger generalised beyond the nine action kinds; mock fare and inventory feeds behind interfaces; document-validity rule table.

---

## 13. Validate before coding: test the weakest assumptions first

The design rests on three guesses: guests will *understand* four levels, a meaningful share will *choose* more than "Keep watch", and they will *forgive* the occasional wrong act. All three are cheap to test before server work. Outcomes may change sections 11 and 12. Wireframes are in 6.3; no code is needed (images or a click-through).

| Step | What | Who | Pass mark | If it fails |
|---|---|---|---|---|
| **R1: Comprehension** | Show screens A to C cold; ask "what did you just choose?", "what will Stanley never do?", "could he spend your money?" | 6 to 8 per persona: first-time family parent, solo traveller, two friends, over-65 traveller, one screen-reader user, one on 200% text | 80% say what they chose; 90% say he cannot pay; nobody believes "Handle the small stuff" includes paying | Reword; test the alternate names |
| **R2: Choice** | Pick a level for their own next cruise and say why | Same group | A real spread (not all 1 or all 4); reasons are time saved or fear of mistakes, not confusion | If nearly all pick 1, lead with examples not levels |
| **R3: Forgiveness** | Tell a story ("Stanley booked a dinner you did not want; here is the undo"); show the receipt | Same group | 80% would still use level 3 or 4 | Under 60%: practice mode (19.2) is the default for levels 3 and 4 |
| **R4: Examples** | Rate ten section 12 rules as one-line cards: useful, neutral, creepy | Same group | Each kept rule useful for at least half the personas it applies to, creepy for under 10% | Cut or demote to rung 1 |
| **R5: Paper walkthrough** | The three test plans against section 12 | Owner and me | Every finding triaged | Done: section 14 |

| Set | Level 1 | Level 2 | Level 3 | Level 4 |
|---|---|---|---|---|
| **A (current)** | Just answer | Keep watch | Do the legwork | Handle the small stuff |
| **B** | Only when asked | Keep an eye on things | Sort things out with me | Take care of the small things |
| **C** | Ask me | Warn me | Prepare for me | Do it for me (small, free things) |

Copy tests in the same session: whether "never pays" comes before or after the levels; whether a worked example under each level helps; whether "Handle" or "Take care of" signals too much trust. Findings are written into this document, not into a backlog. Research for the reminder kinds themselves is RR1 to RR5 in the reminders document and can share sessions.

---

## 14. Personas, packs and who owns what

Method: each persona's journey in `docs/test-plan-*.md` read against section 12.

### 14.1 Facts from the test plans that constrain the design

| Fact | What it means |
|---|---|
| Sign-up is adults only; children are guests on the booker's account | Permission records belong to an *account*. A child has no account and no level; anything for a child is the guardian's decision on the guardian's account, or the supervised-child notice-only rule |
| Only the booker sees the money; other adults on a direct booking have no account | A non-booker adult may have no Stanley or one that sees no booking. Payment, dining plan and booking rules run **only on the booker's account** |
| Linking a booking works only for agent bookings | A second adult may land on an empty Stanley: the checklist says "I have nothing of yours to watch yet; link a booking" |
| The fare split is a notebook on the device | No rule touches cost splitting; the only item is the read-only settle-up note (SR-10.7) |
| Cabin parties stop at 23:00 | Party rules respect existing quiet hours |
| Demo clock only for `IsDemo` accounts | The scheduler needs an injectable clock so the same demo jump works for rules |

### 14.2 What the walkthroughs changed

- **Retired or folded:** SR-1.4 (into SR-1.1), SR-1.5, a four-notice payment ladder as separate items (now rolled up by the arbiter on the reminders ladder), the SR-5.4 poll and SR-8.9 digest for one-person bookings (hidden by applies-when).
- **Added:** solo additions, family pack, helper, needs, occasion and organiser packs, late-night guard (CHK-03), settle-up note (SR-10.7), fill-the-day bundle with pace (ACT-01).
- **Model changes:** every ability has an *applies-when* clause; items are *personal* or *booking*-owned; several rules for several people become one **roll-up** per booking per period ("3 things for the family today"); an empty account sees what Stanley *would* do.

### 14.3 Solo cruiser (one adult)
Strong value at Get to the ship, Embark, Sea and Port. Additions (level 2 or 3, all optional): **SR-S.1** *Safety check-in*, a daily "all well?" nudge she can switch on and a gentle prompt to share whereabouts with a person at home (consented, revocable; ties to the family-at-home page); **SR-S.2** *Eating alone, comfortably*, preferring shared tables or counter seating when she says so; **SR-S.3** *Single supplement honesty*, explained where it appears; and a **meet-people** rule suggesting a solo meet-up or shared table (opt-in; ties to chat).

### 14.4 Family of four (Dad is booker; Mom, a 16-year-old and a 12-year-old)
| Topic | Decision |
|---|---|
| Whose Stanley? | Only the booker sees the trip. Mom gets "link or ask [the booker] to add you", or a helper view. Rules never fire against a booking the account is not on |
| Who consents? | Booking-wide acts need the **booker's** level. Anything touching another adult's own items is **rung 3 only** |
| Children | No account, no consent. Guardian-set rules only; supervised children never receive proactive items |
| AUT-03 in a shared plan | AUT-03 is for a **personal** plan only; family plan items from Stanley are rung 3 (the booker confirms) |
| AUT-04 for four | Only for the booker acting on the booking, showing party names and the usual size; never for a non-booker account |
| Noise | Roll up per booking |

**Family pack (level 3, guardian only):** **SR-F.1** kids club ready (registration, age bands, times; prepared for the guardian to confirm, rung 3); **SR-F.2** age-fit check (a tour, activity or show with an age limit a child on the booking does not meet, rung 1); **SR-F.3** teen check-in time (reminds the guardian of meet-up times the guardian set; nothing is sent to the teen, rung 3); **SR-F.4** everyone's muster (each member's station and walk; flags a child not yet marked done, rung 1); **SR-F.5** find my family (prepares the meeting-point card, not a message, rung 3); **SR-F.6** kid-safe port day (filters for ages, strollers and heat; two options, rung 3); **SR-F.7** bedtime and quiet hours (reminds the guardian of the window, rung 1).

### 14.5 Two friends (booker with an account; friend with none)
Everything runs on the booker's account. Stanley **never** acts on the friend's own items; reservations on the booking for both are the booker's authority only. AUT-03 and AUT-08 apply only to the booker's personal items; shared items are rung 3. A **fill the day** bundle with a pace setting (relaxed, balanced, packed) and a real-walk-time check suits the "do everything" persona; the **late-night guard** scales the missed-ship nudge with the "I stay out late" memory. When a second adult links, Stanley asks *them* for their own level; the booker's level never applies to them.

### 14.6 Other personas
| Persona | Pack | Notes |
|---|---|---|
| **Older guest managed by a relative** | **Helper pack:** a helper can prepare, never confirm; weekly "what is left" (SR-4.8); the guest's level governs, the helper cannot raise it | Helper sees the ledger and rules read-only |
| **Accessibility and medical needs** | **Needs pack:** assistance deadlines (SR-4.3), tender and deck-route checks, medical card, dining allergy confirmation tracking | Sensitive data never reaches a model unless switched on |
| **Celebration** | **Occasion pack:** table and cake requests as drafts, a shared plan for the family | Sensitive wording for bereavement trips |
| **Group or reunion (10 or more)** | **Organiser pack:** poll roll-ups, who-has-not-answered, group meeting points; all rung 3 | Roll-ups only, never one notice per person |

---

## 15. How this document and the reminders document fit together

### 15.1 One owner per topic

| Topic | Canonical in | The other document |
|---|---|---|
| Reminder behaviour, classes, ladders, lead times, limits, copy, screens | **Reminders** | Points there |
| Levels, permissions, standing rules, rung 4 classes | **This document** (11, 12) | Reminders honour the level (AUT-01, AUT-02) |
| Scheduler core and due-queue | **Reminders** (25.3, R3) | P2c adds rule triggers and the arbiter |
| Arbiter | **This document** (22.1) | Reminders add the reminder diet |
| Receipts and "Why did you do that?" | **This document** (19.1) | Reminders use it for AUT-02 additions |
| Delivery log | **Reminders** (on `PushDeliveryRow`) | The ledger links to it |
| Operations console, switches, breakers | **One console**, specified here (20) | Reminders add delivery, burst and ship views |
| Test harness | **This document** (23) for fixtures; reminders for the timeline golden and burst test | Same fixtures |
| Privacy, security, accessibility, cost | Each for its own data; shared threats in 26, shared base in 25, model cost in 24 | Reminders cover push, SMS and storage cost |

### 15.2 Phase mapping

| This document | Reminders | Note |
|---|---|---|
| P2a | R1, R2 | Smarter creation, list, anchors, Remind me |
| P2c (scheduler core) | R3 | Due-queue and delivery ladder built **once**, in R3 |
| P2b release | R3b | Real push and permission journey; only with real keys |
| P3b | R9 | One console |
| P3c | R10 | Offline and device |
| P7 (briefs) | R4 onward | Briefs need the lead-time sets and the arbiter; they ship with or after R4, not before |
| P11 (group) | R8 | |
| P12 (hardening) | R13 | One hardening pass |

---

## 16. Further improvements worth pursuing

**Do soon (cheap, raise quality):** IMP-01 **pre-trip interview** (two minutes in Manage: pace, interests, dining style, late nights, party, anything Stanley should never do; feeds applies-when, AUT-04's usual table and plan quality; answers are visible and forgettable memories). IMP-02 **rule cards generate the catalogue and the help page** (one source for welcome page, Settings, help and tests). IMP-03 **weekly human review** of 50 random acts and previews. IMP-04 **game days** rehearsing S1 to S3. IMP-05 **trust pages** (27.6). IMP-06 **feedback chips on every item** (Good, Not for me, Too much, Stop).

**Do with the main build:** IMP-07 **venue no-show loop**. IMP-08 **booking-time email** explaining the levels (consent captured only in the app). IMP-09 **preferences travel with the guest** across trips; grants do not. IMP-10 **per-traveller readiness score** feeding Stanley Next and the check-up. IMP-11 **spoken level control** ("be quieter"). IMP-12 **anniversary and occasion memory**.

**Parked (P), with the reason:** IMP-13 phone location as a trigger (a privacy cost the plan can avoid; revisit only with explicit consent and clear gain). IMP-14 spending on the guest's behalf under a cap (breaks the ceiling, D11). IMP-15 read-only capability API for outside assistants (needs its own security review). IMP-16 anonymous "people like you" suggestions (privacy and fairness). IMP-17 voice calls or messages to staff for the guest (never; use the hand-off). IMP-18 reading chats to trigger anything (breaks principle 4).

---

## 17. Reconciliation log (what was merged, corrected or dropped)

Source: the three-layer draft (first draft; owner feedback round 2; round 3 extension). Section numbers 11, 12, 18 to 26 and phase IDs are kept because `stanley-reminders-requirements.md` cites them.

| # | Conflict in the layered draft | Resolution |
|---|---|---|
| 1 | Three phase tables (old sections 8, 13, 27.1) | One plan, section 27 |
| 2 | Principle 1 ("every change confirmed") against rung 4 | Principle 1 restated: the guest chooses how far; inside that he acts |
| 3 | Rung 4 shrunk to one class (decision 4, old P10) against nine classes (round 2) | Nine classes, ordered P10a to P10c (D13) |
| 4 | VAL-03 and RUL-05 struck through as dropped, then reinstated | Reinstated as watch-and-prepare, never hold (D12); strikethroughs removed |
| 5 | Rule limit of 10 against ~70 pack rules | Ten applies to guest-made rules; pack abilities are switches; 5 previews waiting at once (4D) |
| 6 | "Voice is per device" | Per-device display setting that is **already server-synced**; authority is separate and server-only (section 8 item 3) |
| 7 | "No server clock" | A 15-minute poll exists; the due-queue is built once in reminders R3 (section 8 item 4) |
| 8 | Checklist pre-ticked CL-04 at level 2 against "briefs off until chosen" and "skip leaves three safest" | CL-04 never pre-ticked; skip leaves CL-01 to CL-03 (D7, 11.3) |
| 9 | Level 1 "no unprompted notices" against existing critical notices | Level 1 stops Stanley's own items, not the critical list or notice settings (D29) |
| 10 | AUT-02 cap 20 per trip against the reminders limit of 30 | 30, reminders owns it (D28) |
| 11 | Payment ladder compressed to three notices (walkthrough) against the reminders ladder of five | Reminders' ladder stands; the arbiter rolls up; the guest can thin it (SR-4.2) |
| 12 | Owner server test run "before P3" against "before P2c" against reminders "before R3" | Before P2c = R3 (D3) |
| 13 | Open question on pre-selecting level 3 for guests from a booking | Closed: never above 2 (D5, dark-pattern rule in 26.2) |
| 14 | Decisions numbered 1 to 9, 10 to 16, 17 to 29 with four sources | One list D1 to D29 (section 10) |
| 15 | Measures in three places (old 9, 15, 29) | One table, section 9 |
| 16 | Step-up authentication treated as wholly new | Reuses the emailed-code path in `EmailCheckService` (section 8 item 5) |
| 17 | P7 (briefs) ordered before the reminders it depends on | P7 ships with or after reminders R4 (15.2) |
| 18 | Sections 11.3 and 27.1 both described the welcome "Step 2" and the Settings page | Single description in 11.3; screens in 6.3 |

---

## 18. When Stanley gets it wrong: mistakes, apology and repair

Autonomy earns trust only if the failure is cheap and visible. This is the other half of the design.

### 18.1 The scenarios and what the guest sees

| # | What went wrong | Guest sees | Undo and repair | System response |
|---|---|---|---|---|
| M1 | An auto-booked dinner clashes with something the guest did **outside** the app (a show booked at the desk) | A notice: "Your 6:00 table clashes with Show X. Keep which?" | One-tap move or cancel the auto-booking | Rule re-reads the plan before every act and again at the start of the undo window |
| M2 | A reminder fires at the wrong clock time (ship time versus home time) | "I got the time wrong. It should have been 4:15 ship time." | Reminder corrected and re-fired | Time-zone fixture test (23.3, clock); the zone is always shown with the time |
| M3 | A "Stanley's pick" in the plan is not wanted | Chips on the item: Not for me, Fewer like this, Stop adding | Removed; memory updated with scope and why | "Not for me" teaches memory (visible and forgettable) |
| M4 | A wrong replacement tour was prepared | Nothing was done; the preview just was not wanted | Not now | Rung 3, no harm; still counted in the quality measure |
| M5 | A rule fires **twice** (duplicate event) | One item with a note, never two | Idempotency key per (rule, trigger, subject) prevents the second act | Property test in the harness |
| M6 | A prepared fix is **stale** when confirmed (tour already refilled) | "That option has gone; here is the next best" | New preview; the old one cannot confirm | Previews expire and re-validate at confirm |
| M7 | The **data was wrong** (a time the provider published incorrectly) | "I was wrong about this. Here is the right time and what I changed." | Affected acts are listed with one-tap undo of all | A data-correction notice type; the audit event links all acts that used the bad fact |
| M8 | **Undo is impossible** (past the free window, venue already used it) | Honest message, not an error: "This is past the free change time. I can ask Guest Services to look." | Hand-off case drafted with consent text | An undo failure opens a hand-off case automatically with the guest's consent |
| M9 | A **notification storm** after reconnection at sea | A single catch-up card, ranked | Dismiss all, or open Activity | Arbitration (section 22) and the "what did I miss" card that exists |
| M10 | **Someone else** raises the level on a shared or stolen device | An email and an in-app notice on other devices: "Your level changed to X. Not you? Switch back." | One-tap revert link; step-up needed to raise again | Step-up authentication to raise a level (section 26 and D17) |
| M11 | A proactive item reaches a **supervised child** | It cannot: the item goes to the guardian | n/a | Gate test: no non-critical Stanley output addressed to a supervised account |
| M12 | A **simulated** fact is described as verified | Never allowed; every claim has source and as-of | n/a | Existing provenance rule plus a string test |
| M13 | A rung 4 act during a **serious case** or a bereavement flag | Pause: no cheerful acts or suggestions | Resume when closed | The "paused while a serious case is open" rule (VAL-06) applies to every rung 3 and 4 class |
| M14 | An act during an **emergency** (muster, medical, ship alert) | All non-critical Stanley acts pause; critical info appears first | Resume after | A platform-wide "ship alert" suppression flag checked by the scheduler |
| M15 | A **provider outage** (flights, weather, inventory mock off) | One honest notice: "I cannot check flights right now; rules that need it are paused." | Auto-resume with a quiet "back" note | Per-provider health flag; rules degrade to paused, never to guessing |
| M16 | The guest says "**stop** doing that" in chat | Stanley switches off the class, says which, and offers undo | Reverse via the switch | A natural-language control path (19.4) with confirmation; guest words never *raise* authority without the explicit checklist step |
| M17 | An auto-booked table is a **no-show** twice | "You did not use two tables I booked. I have paused this; want me to ask first?" | One tap to resume | A no-show counter pauses AUT-04 for that guest |
| M18 | The guest is **annoyed** by volume | A "too much" chip anywhere lowers level or turns off the class that fired | Immediate | "Too much" is always one tap on any Stanley item |

### 18.2 The five-step repair pattern (the wording and flow for every error)

1. **Say it plainly and first**: what Stanley did, what is wrong, in one sentence (no apology theatre, no "AI").
2. **Fix or offer the fix in the same card**: undo, replace, or ask a person.
3. **Explain why it happened** only if the guest taps "Why": the rule, the fact, the time.
4. **Prevent**: pause the class or ask before the next one, and say so.
5. **Record**: the ledger shows the mistake and the fix; the measure "guest-reported errors" counts it; a repeat becomes a bug with the rule id attached.

### 18.3 Severity and who is called

| Sev | Meaning | Examples | Automatic action | Human action |
|---|---|---|---|---|
| **S1** | A wrong act affects many guests or touches a safety fact | A bad time published for a muster-linked reminder; a rule firing for everyone | Global pause of rung 4 and the affected rule | On-call engineer and product owner, notice to affected guests, post-incident note |
| **S2** | A class misbehaves | Undo rate over 10%, no-show pattern, duplicate acts | Class paused for all, flag in the console | Fix in the next release; message to affected guests |
| **S3** | One guest harmed or upset | A wrong dinner, a bad reminder | None | Guest Services case with the ledger entry |
| **S4** | Cosmetic | Wording, ordering | None | Normal backlog |

---

## 19. Trust features: explainability, practice mode, week in review and control

These are the features that make levels 3 and 4 *safe to choose*. Most of them are cheap and share the ledger.

### 19.1 "Why did you do that?" on everything Stanley does

Every rung 3 preview and rung 4 act carries one receipt with the same six fields. This is the guest's answer to *"what has he been doing?"* and the support agent's answer to *"what happened?"*

| Field | Example |
|---|---|
| **What I did** | "Added a free show at 8:30 to your plan." |
| **Why** | "Because you switched on *Plan my days* and you like live music." |
| **Facts I used and when** | "Programme, as of 10:42 ship time. Your plan has a gap from 8:00 to 10:00." |
| **Who it affects** | "Only you." |
| **How to undo** | "Remove it, any time. Free until the show starts." |
| **How to stop this kind of thing** | "Turn off *Plan my days*" (one tap) |

Stored in the ledger as typed fields (rule id, trigger, fact ids and as-of, class, undo-until). Never stored: message text or free text the guest wrote.

### 19.2 Practice mode: "Show me what you would do"

When a guest first turns on a rung 3 or 4 class, Stanley can run it in **practice** for the rest of the current stage (or 24 hours, whichever is longer): he works out what he *would* have done and lists it in Stanley activity ("I would have added 2 free items today. Want me to do it for real?") without acting. The guest graduates each class with one tap. Practice mode is **on by default for level 4 classes** and **optional for level 3 rules**. It doubles as our own shadow-mode data (23.5).

### 19.3 A level suggestion, never an automatic change

After three or more confirmations of the same kind of prepared item and no undo, Stanley may offer once: "You have said yes to my dinner suggestions three times. Want me to book your usual table myself next time?" One tap enables the class (with step-up where required). The reverse also works: after two undos, "Want me to ask first from now on?" Stanley **never** raises authority on his own.

### 19.4 Control in plain words

Guest sentences map to a fixed set of controls, shown back for confirmation:

| Guest says | What changes |
|---|---|
| "Stop booking dinners" | Turns off AUT-04; confirmed |
| "Be more careful" | Drops one level for the stage |
| "Do more" | Offers the checklist rows above the current level (never enables silently) |
| "Pause everything for today" | Pause until midnight ship time |
| "Undo everything you did today" | Lists acts with one-tap undo for each; one confirm undoes all that are still free |
| "Why did you do that?" | Opens the receipt for the last act |

### 19.5 Week in review ("Stanley's trip so far")

At the end of each sea or port day (and in Remember), one card: how many things he did, how many the guest confirmed, how many were undone, what changed because of him ("you saved 3 taps and one overlap"), and **one question**: "More, the same, or less?" The answer adjusts level suggestions (19.3); it never changes authority by itself. Honest numbers only; no claims of "time saved" that we cannot measure (we count taps avoided and conflicts caught).

### 19.6 Act-or-ask gate (how a rung 4 act decides)

A rung 4 act happens only when **all** are true; otherwise it falls back to a rung 3 preview. This is the code form of the five tests.

1. The class is on, not paused, not in practice mode, and within its daily cap.
2. The item passed the classifier (free, fee-free, only-me, reversible until a known time).
3. Every fact used is **fresh** (as-of within the class's limit) and from a source marked healthy.
4. Nothing it touches overlaps a booked or confirmed item of the guest's.
5. No serious case, ship alert, quiet period (reservations only 07:00 to 22:00 ship time; reminders any time) or supervised-child flag applies.
6. The guest has not undone or declined this *kind* of act twice.
7. A step-up check was passed at the time the class was enabled.

---

## 20. Staff and operations: seeing, stopping and supporting Stanley

The first draft had nothing for the people who support guests. Autonomous acts create effects on dining, shows and stateroom service, and a guest will phone Guest Services when something is odd.

### 20.1 Roles and what each sees

| Role | Sees | Cannot see | Why |
|---|---|---|---|
| **Guest Services agent** | For a guest with an **open case and the guest's consent in the hand-off**, the last 7 days of Stanley receipts (what, when, rule, undo state) | Chat text, free-text reminders, drafts, anything about sensitive needs unless the case needs it | Support must answer "what did Stanley do" without reading the guest's mind |
| **Supervisor** | The same, plus the per-class state for that guest and a button to pause a class for that guest | Other guests' data | Quick relief without engineering |
| **Venue staff** (dining, spa, stateroom) | A neutral tag on a reservation: "made by the guest's assistant" and the cancel route | Why or rule | Lets venues reconcile no-shows and tell Guest Services |
| **Product operations** | **Aggregates only**: fire rate, undo rate, pause events, error rates, cost, by rule, class, stage, level | Individuals | Run the product without personal data |
| **Engineer on call** | Redacted event replays (ids, not names), kill switches | Personal data by default | Debug without PII |

### 20.2 The operations console

| Screen | Content |
|---|---|
| **Health** | Per rule and class: fires per hour, acts, confirms, undos, pauses, errors, p95 latency, model calls, cost against the ceiling, provider status |
| **Switches** | Global, per lane, per class and per ability, per **cohort** (sailing, ship, stage, level). Every change records who, why and when; a global switch needs two people |
| **Circuit breakers** | The state of each: closed, tripped (reason, since, affected guests), with the one-button reset after review |
| **Replay** | Re-run a rule from stored inputs (redacted) against the engine to reproduce what it would do now |
| **Venue view** | Auto-booked reservations, no-show counters, upcoming load from Stanley |
| **Announcement** | Post a platform "ship alert" suppression and release it; every guest gets a calm "I am quiet while the ship talks" status |
| **Cohorts and flags** | Rollout percent per ability and class, and a read-only list of what each cohort has |

### 20.3 Guest Services playbook

A one-page script, and a new case type **"Stanley did something I did not expect"** with fields: which act, which receipt, what the guest wants (undo, explain, stop). Agents can undo for the guest while they are on the phone (with the guest's agreement recorded), pause a class, and file a defect that carries the rule id. Training line: *"I can see what the assistant did and I can undo it. Tell me what you would like."*

### 20.4 Audit

Every act, pause, switch and console action is an audit event (action kind, outcome, ids); never message text, never personal fields beyond ids. The audit trail keeps the existing "never fails the guest" rule.

---

## 21. Offline, ships and time: what runs where

A ship is the worst place for a cloud-only automation: slow, expensive, intermittent connectivity, and two clocks.

### 21.1 Where each ability runs

| Behaviour | Server | Device | When offline |
|---|---|---|---|
| Rules and rung 4 acts | **Yes** (scheduler) | No | They keep running on the server; results wait in the thread |
| Reminders (AUT-01, AUT-02) | Source of truth | **Mirrored as local notifications** (the existing local reminders) | The device fires them without a network. Anchor moves cannot arrive until reconnect, so the reminder shows "may have moved, last checked 10:42" |
| Check-ups and plan lint | Yes | Cached last result with cached-at | Shows the last result and its age |
| Missed-ship guard (CHK-03, SR-9.1) | Computes the buffer | **Local timer** for "head back" using cached all-aboard time | A local nudge fires at the cached buffer time; if the time is stale, the card says so |
| Previews and confirms | Create and validate | Confirm taps are **queued** | "Waiting to send" with an expiry; applied on reconnect only if still valid (re-validated); never applied silently |
| Offline answers | Library in the bundle | On-device safety screen, offline library | Existing behaviour; "ask a crew member" fallback always visible |

### 21.2 Rules for the offline case

1. **Never apply a queued confirm blindly.** On reconnect, re-validate; if the facts changed, show the new preview.
2. **Show age on every number** (existing rule). Offline cards say "last checked".
3. **Critical things never depend on Stanley's connection:** muster and all-aboard are shown by the ship's own screens too.
4. **Catch-up on reconnect is one card**, ranked (M9), not a flood.
5. **Offline pack** (offline capsule) is built when the class is on and Wi-Fi is available; storage cap and clear-out at disembark.

### 21.3 Time

- **Pre-trip anchors** (payments, check-in) use the guest's home zone; **onboard anchors** (muster, dining, shows, all-aboard) use **ship time**. Every time on screen names its zone when the two differ.
- A **time-zone jump** (ship clock change, the guest's phone clock) re-evaluates every pending reminder; a test fixture covers a clock change and a daylight-saving day.
- Rules fire in **ship time** onboard, even if the phone clock is wrong.

---

## 22. Arbitration, conflicts and multi-traveller ownership

### 22.1 Many rules, one guest: the arbiter

Without arbitration, ten rules produce ten notices. All proactive output passes one **arbiter** per guest per booking.

| Concern | Rule |
|---|---|
| **Priority** | Safety, then money and deadlines, then missed-ship, then plan problems, then convenience, then suggestions. Within a rank, soonest consequence first |
| **Budget** | The guest's `nudgesPerDay` and the existing caps (one per screen, three per session) hold. Items beyond budget wait in the thread; critical ignores budget |
| **Roll-up** | Items about the same booking in the same period combine ("3 things for the family today") |
| **Dedupe** | The same fact from a rule and from the check-up becomes one item with one source list |
| **One fix per problem** | A cancelled tour gets one primary replacement with alternatives, not three previews |
| **Quiet hours** | Per section 19.6 (reservations 07:00 to 22:00 ship time); anything else queues |
| **Calm and simple mode** | Cap voice at "asked" (existing); rung 3 and 4 notices go to the thread without a push |

### 22.2 Conflicts between rules

1. **Precedence:** guest's explicit action, then a guest's rule, then a Stanley default. A guest's manual edit of an item **locks** it: no rule moves or removes it.
2. **No cascades:** an act by a rule cannot trigger another rule (depth one). A trigger caused by Stanley's own act is marked and ignored by rules.
3. **One owner per slot:** two rules wanting the same time slot resolve by precedence; the loser prepares nothing and logs why.
4. **Loop guard:** the same rule cannot act on the same item more than twice in a day.

### 22.3 Who owns what (the multi-traveller rule)

| Item owned by | Examples | Highest rung Stanley may use |
|---|---|---|
| **The account holder alone** (personal plan, reminders, lists, drafts, shortlist) | Own plan items, own reminders | 4 |
| **The booking** (shared plan, dining plan, shared dinners) | Family plan, a dinner for four | 3, and the booker's confirm; **AUT-04 only for the booker acting on the booking** |
| **Another adult's account** | Mom's own items | 3, **only if Stanley is on that adult's account**; never from another account |
| **A child** | A supervised child's items | 1 (notice to guardian) or 3 (guardian confirms) |
| **A helper's authority** | An older guest's items | The helper can **prepare**, the guest confirms |

A second adult who links to a booking is asked for **their own** level when they first open Stanley; the booker's level never applies to them.

---

## 23. The test harness: how we prove it before a guest sees it

Everything below is written to work under `CLAUDE.md`: Vitest, `npm run lint`, `npx tsc -b`, `npm run build` for the front end; server tests are written with the code and **run by the owner, targeted, never a full `dotnet test`**.

### 23.1 Foundations

| Piece | What it is |
|---|---|
| **Injectable clock** | The scheduler never reads the system time; tests (and demo accounts, via the existing test bar) move it |
| **Trip fixtures** | The three test-plan journeys (solo, family, friends), the seeded supervised family, a helper-managed older guest, a needs guest, plus scenario fixtures: tour cancelled, tender delayed, show moved, duplicate folio charge, flight cancelled, provider outage |
| **Event scripts** | A small typed format: *at T, do X* (advance the clock, change a fact, withdraw inventory, a guest confirm or undo). Each fixture is a script |
| **Golden outputs** | For each script: the expected previews, acts, notices, ledger lines and ordering as stored JSON; a change to a golden is a reviewed diff |
| **Rule cards** | Every rule is one file (23.2) |

### 23.2 The rule card (the unit of authoring and of review)

Each ability or rule has one card holding: id, name, stage, level, rung, class, **applies-when**, trigger, inputs and freshness limit, output kind, wording keys, classifier needs, caps, undo window, kill-switch name, metrics, example prompt (used by the "example works" test), fixtures it must pass, privacy inputs (cross-check with the data inventory), accessibility notes, and the "never" line. A rule is **not mergeable** without every field and its fixtures.

### 23.3 What is tested

| Layer | Tests |
|---|---|
| **Pure rule logic** (TypeScript or C#, no I/O) | Table tests per rule: trigger in, decision out; applies-when; freshness; overlap; cap |
| **Invariants (property tests)** | For every action kind and class: **never** charges, **never** messages another person, **never** touches a paid or shared item at rung 4, **never** runs when its switch is off or the level is below it, **never** acts for a supervised child, **never** acts during pause, a ship alert or a serious case; each act has a ledger entry and an undo or a stated reason |
| **Idempotency and ordering** | Duplicate events, out-of-order events, restart mid-run: one act only |
| **Clock** | Ship-time versus home-time, a daylight-saving day, a clock jump, rules at the edges of quiet hours |
| **Arbiter** | Storm fixture: 30 events in a minute produce one ranked card and respect budgets |
| **Permissions** | Table test over every path (chat, screen, scheduler, helper, hand-off) that the switch is checked: the P0a gate |
| **Authorisation** | A guest cannot read or change another guest's rules; a helper cannot confirm; a supervised child cannot enable anything |
| **Wording** | The model-wording layer is covered by the existing `src/ai/eval` style (golden prompts, banned words including "AI", length, reading age) with a fixed model stub in unit tests |
| **Examples work** | Each welcome-page and checklist example runs through the real router and returns a card (6.5) |
| **Accessibility** | The existing `stanleyAccessibility.test.ts` pattern extended to the checklist and ledger components |
| **Soak and cost** | A simulated fleet (for example 10,000 guests over a 14-day trip on the fake clock): tick time, queue depth, model calls and cost against the ceiling |
| **Chaos** | Provider outage, slow provider, duplicate webhook, partial DB failure: rules pause and recover with one notice |
| **Red team** | Prompt injection through reminder text, a chat message, a draft, a port description: the executor takes only typed, validated arguments |

### 23.4 Gates in the pipeline

`npm run test` (all Vitest), `npm run lint`, `npx tsc -b`, `npm run build`, and (owner, targeted) the new Stanley server test classes. A rule card without fixtures fails a test; a string with "AI" fails a test; a missing kill switch fails a test.

### 23.5 Shadow mode and rollout in production

1. **Shadow:** the engine computes what it *would* do for a random 100% of level 3 and 4 guests and logs it (no acts, no notices). Compare with what the guest did next ("would we have been right?").
2. **Canary:** 1% of eligible guests, then 10%, then 50%, then 100%, per class, each step gated on the measures in section 9 for at least a week.
3. **Per-cohort kill:** a ship, a sailing or a stage can be switched off without a release.
4. **Holdback:** a small fixed group never receives rung 3 and 4 so we can measure the real effect.

---

## 24. Cost model (planning assumptions, to be replaced by measurement)

All figures below are **counts and shapes, not prices**; model prices change and are set by the existing tiers and the daily ceiling. They are the numbers to check in shadow mode.

### 24.1 What costs what

| Work | Kind | Frequency driver |
|---|---|---|
| Scheduler tick, trigger match, classifier, arbiter | Code and a database read; **no model** | One indexed "next due" queue, not a scan per guest; cost grows with events, not with guests |
| Notices | **Templates**; a model only for a novel word choice | Mostly zero model calls |
| Plans (build my day, bundles, replacement ranking) | A model on a mid tier, once per plan, cached by inputs | Once per day per guest at level 4, per request at level 3 |
| Check-up | Code | Weekly plus on demand |
| Chat | Existing router and tiers | On request |
| Practice mode | Same as the live path, no acts | Once during practice |

### 24.2 Expected shape per guest for a 7-night trip (assumptions to measure)

| Level | Proactive items | Rung 4 acts | Model calls (planning and wording) |
|---|---|---|---|
| 1 | 0 | 0 | Only chat |
| 2 | About 10 | 0 | About 2 |
| 3 | About 35 (incl. previews) | 0 | About 8 |
| 4 | About 35 items and 20 to 30 acts | 20 to 30 | About 15 |

### 24.3 Controls

- **Daily per-guest model ceiling** (existing): when reached, wording falls back to templates and plans are not rebuilt; **safety, deadlines and missed-ship never degrade.**
- **Per-class budget** in the console, with an alert at 80% and an automatic degrade at 100%.
- **Cache keys** for plans (the plan is rebuilt only when its inputs change).
- **Cheapest tier that passes the golden wording evals** per output type; promote only with evidence.
- **Soak test** (23.3) reports calls and tick time per 1,000 guests; the number goes in the release scorecard.

---

## 25. Accessibility of the checklist and every autonomous surface

The checklist asks guests to give consent, so it must be the *most* accessible page in the app. Target WCAG 2.2 AA (`CLAUDE.md`), with these specifics.

### 25.1 The welcome flow and Settings

| Need | Design |
|---|---|
| **Structure** | One column. Each group (Watching, Preparing, Handling) is a `fieldset` with a `legend`; the level choice is a `radiogroup`; each row is a labelled switch (checkbox with `role="switch"` semantics) with the consent sentence linked by `aria-describedby` |
| **Order** | Heading, level, checklist, summary, Continue; the summary is announced politely after any change ("7 things on, 3 off") |
| **Consent text** | Visible, not in a tooltip, full sentence, plain words at about a grade 6 to 8 reading level; "never" line always visible |
| **Target size** | 44 px minimum (above the 24 px minimum of 2.5.8) |
| **No timers** | No timeouts or countdowns anywhere in the flow (2.2.1) |
| **Focus** | Focus stays on the toggled switch; sticky headers never cover focus (2.4.11); focus returns to the row after a "Raise level" dialog closes |
| **Dialogs** | The raise-level step-up is a focus-trapped dialog closing on Escape |
| **Consistent help** | The Help button stays in the same place (3.2.6) |
| **No repeated entry** | The checklist never asks again for something already known (3.3.7) |
| **Authentication** | Step-up uses the existing emailed code, no puzzle or memory test (3.3.8) |
| **Colour and motion** | State shown by words and shape, not colour; reduced motion respected; high contrast mode checked |
| **Zoom and reflow** | Works at 200% text and 320 px width with no horizontal scrolling |
| **Read aloud** | The consent text and summary can be read aloud (existing read-aloud) |
| **Cognitive load** | A one-tap **"Keep it simple"**: pick a level and skip the checklist; the pre-ticked rows follow the level. An easy-read version of the consent text is a first-class setting |
| **Screen reader names** | "Check my trip for problems, on" (state in the name), not "toggle 1" |

### 25.2 Autonomous output

- **Receipts** (19.1) are structured text, readable standalone, with no information in images only.
- **Undo** is a real button, reachable by keyboard from the thread, the receipt and the push action, with a label that names the thing ("Undo: free show at 8:30").
- **Undo time** is shown as a clock time ("until 4:30 pm"), never as a ticking countdown (no false urgency).
- **Push text** is complete without opening the app and never says only "Stanley did something".
- **Live regions:** acts are announced politely in the thread, not as alerts, except critical.
- **Practice mode and mistakes** use the same card patterns, so a screen reader user learns one shape.
- **Reading age and tone** are checked by the wording evals (23.3).

### 25.3 Verification

`jsx-a11y` lint, the extended Vitest accessibility tests, contrast checks on the new components, and a **manual screen-reader and 200% zoom pass by the owner** (no browser testing from here, per `CLAUDE.md`) listed as a phase gate. A user with a screen reader is part of research R1.

---

## 26. Privacy and security review

*This is a design review, not legal advice. A privacy and legal review of the final wording and consent flow is a launch gate (section 27).*

### 26.1 What the new capability reads and keeps

See section 7 (one table of what is stored, why, how long, and what is never stored). New tables are listed in 27.3.

### 26.2 Threats and controls

| Threat | Control |
|---|---|
| **Stolen or shared session raises the level** | **Step-up authentication** (emailed one-time code) to raise to level 3 or 4 or enable any rung 4 class; notice by email and on other devices; one-tap revert link |
| **Someone with a device acts as the guest** | Rung 4 bounded by caps and the five tests; no money; undo; a lost-device "pause Stanley" from any signed-in device |
| **Prompt injection** via reminder text, chat, drafts, port data | Typed arguments validated against the catalogue; guest free text is data in a delimited block; models produce wording, never actions |
| **Confirm-token replay** | Single-use, expiring, bound to the guest and the preview |
| **Cross-guest access (IDOR)** | Every rule and ledger endpoint scoped to the account, with a test per endpoint |
| **Venue spam** (rules that flood a restaurant) | Per-class and per-venue rate limits; AUT-04 cap; no-show breaker |
| **Helper abuse** | Helper can prepare, never confirm; sees but cannot change level or rules; the guest is told when a helper prepares something |
| **Insider browsing** | Role-scoped views (20.1), every view audited, case-scoped access with the guest's consent |
| **Model provider data** | The existing provider retention and training terms decision (AI-SEC-07); sensitive needs reach a model only when switched on |
| **Children** | No rung 3 or 4 on a supervised account; nothing proactive reaches a child |
| **Dark patterns** | Levels are never pre-selected above 2; "no" is as easy as "yes"; no countdowns; consent is not bundled with a purchase |

### 26.3 Consent and rights

- Consent is **specific** (per row), **informed** (the sentence shown, versioned), **freely given** (the guest can skip and still use everything at level 2), **recorded** (who, what, when, from where, wording version) and **withdrawable** at any time with the same ease.
- **Export:** the guest can download their ledger and permission history as a file; **delete** with the account.
- **Region:** wording is held per region (settings has `region`); a regional variant can be added without code.
- **Expiry:** grants lapse after the trip (11.3) so old consent does not carry to a future trip.

### 26.4 Tests for this section

Authorisation per endpoint, step-up required, revert link works once, confirm token cannot be replayed, ledger contains no text fields (schema test), expiry job, export contains what is stored and nothing else.



---

## 27. Delivery plan: phases, gates, technical design and risks

**This is the only phase plan.** Sizes are relative effort (S about one week, M two to three, L four or more). Each phase commits and stops; server code is written with tests and run by the owner (targeted, never a full `dotnet test`). Reminder phases R1 to R13 are specified in the reminders document and mapped in 15.2.

### 27.1 Phases

| Phase | Scope | Size | Depends on | Done when |
|---|---|---|---|---|
| **R: Research and copy** | Section 13: R1 to R5, level-name test, copy decisions; findings written into sections 11 and 12 | S | none (no code) | Gate **G0** passed |
| **P0: Explain what exists** | Welcome page rewrite (6.2 to 6.4), Try-it chips, capability catalogue endpoint, **What Stanley can do** screen, example-works test, "AI" word test | M | R | A new guest sees what Stanley answers, does, watches and never does, and can try each in one tap |
| **P0a: Levels, permissions and checklist** | `StanleyPermissions`, consent history, step-up (reusing the emailed-code path), the enforcement point and its path test, level radio and ten-row checklist (welcome and Settings), Pause everything, empty-state, helper and child rules | L | P0, R | Gate **G1** passed: the server refuses everything switched off, on every path |
| **P1: Stanley activity and receipts** | The ledger (typed fields only), six-field receipt (19.1), Did, Watching, Remembers, undo (after confirming which kinds support undo, section 8 item 7), stop buttons, consent history view, "Why did you do that?" | M | P0a | A guest can see, explain and stop everything Stanley did or watches |
| **P2a: Reminders R1, R2** | Per the reminders document | M | P1 | See that document |
| **P2c: Scheduler and arbiter** (due-queue, leases and clock are built by reminders **R3**) | Worker with due-queue and leases, injectable clock, trigger types (time, change, inventory, state), arbiter (22.1), circuit breakers, kill switches, ship-alert suppression | L | P0a; owner server build (D3) | A rule fires on time with the app closed; a storm is one card; a runaway class pauses itself |
| **P2d: Harness** | 23.1 and 23.2: fixtures, event scripts, goldens, invariant tests, rule-card format and its test | M | P2c (in step) | Every later phase adds cards and fixtures to this harness |
| **P3: Trip check-up and plan lint** | CHK-01, CHK-02, CHK-08 and the "Fix this" actions | M | P2c | Ranked findings with a fix each; no false alarm on a clean fixture |
| **P3a: Classifier flags** | Free, fee-free-until, only-me, reversible-until on dining, shows, excursions, services; the act-or-ask gate (19.6) | M | P2c | A paid or shared item can never be acted on at rung 4 |
| **P2b release: Real push** | Reminders R3b, released only with real push keys | M | real push | As in the reminders document |
| **P3b: Staff and operations** | Section 20: Guest Services view and case type, supervisor pause, venue tag, health, switches, breakers, replay, announcement (= reminders R9) | L | P1, P2c | Gate **G2** staff prerequisites met |
| **P3c: Offline and ship time** | Section 21 (= reminders R10) | M | P2a, P2c | A guest offline at sea gets the right reminder and no blind applies |
| **P7: Briefs** | ACT-06 (CL-04) | M | P3, reminders R4 | A guest-set brief arrives once a day with the right content and honours quiet hours |
| **P6, P4, P5, P8** | **P6** Value and bill (VAL-01, CHK-04, CHK-05); **P4** Bundles and drafts (ACT-01, ACT-03); **P5** Checklist concierge and smart defaults (ACT-02, ACT-04); **P8** Missed-ship and group gaps (CHK-03, CHK-07) | M each | P3, P3a | Each ships alone; all run under the arbiter |
| **P9a: Rules engine and cross-journey rules** | Rung 3 engine, RUL-01 to RUL-06, watch-and-prepare (VAL-03), **practice mode** (19.2), level suggestions (19.3), plain-words control (19.4), week in review (19.5) | L | P3a, P3b, P2d | Gate **G2** passed (shadow, then canary) |
| **P9b: Manage and Prebook pack** | SR-4.x, SR-5.x, helper and needs packs | M | P9a | Each rule's fixtures and goldens pass; the stage welcome ask offers them |
| **P9c: Get to the ship and Embark pack** | SR-6.x, SR-7.x | M | P9a | As above |
| **P9d: Sea, Port, Disembark pack** | SR-8.x, SR-9.x, SR-10.x | L | P9a | As above |
| **P9e: Family, solo, occasion and organiser packs** | 14.3 to 14.6 (open question 3 recommends after the stage packs) | M | P9b to P9d | As above |
| **P9f: Remember pack, then Dream, Discover, Book packs** | SR-11.x, then SR-1.x to SR-3.x (last; earn least) | M | P9a | As above |
| **P10a: Rung 4 safe classes** | AUT-01, 02, 05, 07 | M | P9a, **G3** | Each class acts only on eligible items |
| **P10b: Rung 4 plan classes** | AUT-03, 06 | M | P10a | Undo rate under 5% for a full cohort season |
| **P10c: Rung 4 booking and staff classes** | AUT-08, then AUT-04, then AUT-09 | M | P10b, **G4** | Venue sign-off, no-show breaker proven, undo under 5% |
| **P11: Group, voice, shared briefs** | VAL-07, ACT-07, reminders R8 | M | P9 | A shared brief is posted only after the organiser confirms |
| **P12: Hardening and launch checks** (also before each gate) | Manual screen-reader and 200% zoom pass, privacy and legal review of final wording, soak and cost report, chaos and red team, S1 rehearsal, support training (= reminders R13) | M | any gate | Section 9 targets met |

**Order:** R, P0, P0a, P1, P2a, P2c, P2d, P3, P3a, P2b release, P3b, P3c, P7, P6, P4, P5, P8, P9a, P9b, P9c, P9d, P10a, P9e, P9f, P10b, P10c, P11, with P12 before each gate. **Stop points that stand alone:** after P0a (levels 1 and 2 mean what they do today and the guest can see and set them); after P3 and P7 (best value for least risk); after P9a (real standing rules at level 3); after P10a (the safest automation). Rung 4 classes do not begin until the scheduler, classifier and ledger have run on rung 3 and the undo and abandon numbers are known.

### 27.2 Gates (go or no-go)

| Gate | Before | Must be true |
|---|---|---|
| **G0** | P0a screens are final | Research R1 and R3 pass marks met, or copy and defaults changed and re-tested |
| **G1** | Any rung 3 code path runs for a real guest | Permission path test passes; step-up works; consent history is written; the checklist passes the manual accessibility pass; privacy review signed off |
| **G2** | Rung 3 for guests | Staff view, switches, breakers and playbook live and rehearsed; shadow mode ran at least two weeks with wrong-prepare under 10%; canary at 1% then 10%, each held a week, abandon under 50% and no S1 or S2 |
| **G3** | Rung 4 for guests | Rung 3 undo and complaint numbers within target for a season; practice mode default on; classifier proven by invariant tests; soak within the cost ceiling; legal review of consent wording; S1 rehearsal passed |
| **G4** | AUT-04, 08, 09 | Venue and stateroom operations agree in writing; no-show breaker proven; undo under 5% for AUT-01 to 07 |

Reminder gates RG0 to RG4 are in the reminders document; RG2 (class A) and G2 are independent.

### 27.3 Technical design notes

**Tables (SQL Server scripts in `db/`):** `StanleyPermissions`, `StanleyConsentLog` (append only), `StanleyRules`, `StanleyRuleDue` (the due queue: account, rule, due at, **unique idempotency key**, lease owner and expiry, state; shared with reminders R3), `StanleyLedger` (typed receipt fields, no text), `StanleyClassState` (per account per class: paused, practice, counters, last undo), `StanleyBreaker`, `StanleyPractice`, `StanleyOpsFlags` (switches and cohorts), `StanleyNoShow`.

**Scheduler:** a worker process (D27) sharing the domain library, claiming due rows with `UPDLOCK, READPAST` leases so several instances can run, an **injectable clock**, per-account serialisation, idempotency keys (rule, trigger, subject), retries with backoff, a dead-letter table, and a "ship alert" suppression read at every claim. The existing 15-minute `WatchSchedulerService` stays as a safety net.

**Endpoints (sketch; the front end renders what the server says):**

| Endpoint | Purpose |
|---|---|
| `GET /me/stanley/capabilities` | The catalogue: ability, stage, level, rung, wording, example, applies-when, state for this account |
| `GET /me/stanley/permissions`, `PUT /me/stanley/permissions/{ability}` | Read and set; raising requires a step-up token |
| `POST /me/stanley/permissions/stepup`, `.../stepup/verify` | The emailed code |
| `POST /me/stanley/permissions/revert/{token}` | One-tap revert link |
| `POST /me/stanley/pause` and `DELETE` | Pause everything or a class, with until |
| `GET /me/stanley/ledger`, `POST /me/stanley/ledger/{id}/undo`, `POST /me/stanley/ledger/undo-today` | Receipts and undo |
| `GET /me/stanley/practice`, `POST /me/stanley/practice/{class}/graduate` | Practice mode |
| `GET`, `POST`, `DELETE /me/stanley/rules` | A guest's own rules, from templates |
| `GET /staff/stanley/cases/{id}/ledger` | Case-scoped receipts (role and consent checked) |
| `/ops/stanley/*` | Health, switches, breakers, replay, cohorts, announcement |

**New action kinds** for the existing preview and confirm pipeline: `save_shortlist`, `watch`, `prefill_form`, `set_deadline_reminders`, `settle_up_note`, `family_card`, each with typed arguments, preview, receipt and (where it qualifies) an undo.

**Front end (thin):** one `useStanleyCapabilities` hook, one checklist component used by the welcome page and Settings, one receipt component used by the thread, Activity and the case view; no ability list in the bundle. Pure logic in plain TypeScript modules; the level-to-rows mapping used for pre-ticking is **served by the server**, not hard-coded.

**Documents updated in the same change as each phase:** `stanley-data-inventory.md`, `audit-trail.md`, `runbook.md`, `functional-requirements.md` and `requirements-clauses.md`, `server/README.md`, the Stanley welcome strings, and the test plans (a Stanley section each for solo, family, friends).

### 27.4 Definition of ready and done for a rule or class

**Ready:** a rule card with every field (23.2), an owner, applies-when written, fixtures sketched, classifier needs known, privacy inputs listed.
**Done:** card merged; fixtures and goldens pass; invariants pass; example works; kill switch, cohort flag and metrics exist; strings in English with no "AI"; accessibility notes met; docs updated; canary plan written.

### 27.5 Risk register

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| 1 | Guests do not understand or do not want the levels | M | H | Research R1 to R3 before P0a; examples-first copy; default level 2 |
| 2 | A wrong autonomous act harms a guest or a venue | M | H | Five tests, classifier, caps, practice mode, undo, breakers, staged classes |
| 3 | Notification overload erodes trust | H | M | Arbiter, roll-ups, budgets, "too much" chip, level suggestions |
| 4 | Scheduler reliability (missed or double fires) | M | H | Leases, idempotency keys, dead-letter, soak and chaos tests, fake-clock goldens |
| 5 | Data provider (mock now, real later) is wrong or down | M | M | Freshness limits, provider health flags, rules pause not guess, correction notices |
| 6 | Consent or privacy complaint | L | H | Specific, versioned, withdrawable consent; step-up; ledger without text; legal review |
| 7 | Model cost grows beyond the ceiling | M | M | Templates first, cache, per-class budgets, degrade to templates, soak report |
| 8 | Staff are surprised by autonomous bookings | M | M | Venue tag, console, playbook, venue sign-off for AUT-04 and AUT-09 |
| 9 | Real push is late, so reminders and notices are weak | M | M | P2b release is separate; in-thread delivery works first; local mirror |
| 10 | Rule list becomes unmaintainable | M | M | Rule cards, one test per card, packs by stage, retire rules with low "useful" rating |
| 11 | The existing server code has never been compiled or run here | H | H | Owner build and targeted test run before P2c; no phase depends on unrun code |
| 12 | Simulated data makes watches feel fake | M | M | Honest "as of" labels; "tell me and line it up", never "hold"; a real provider swaps in behind the interface |
| 13 | Scope: this plan is large | H | M | Stop points, retired rules (section 14), P9f and P10c last, each pack ships alone |
| 14 | The undo window or kinds that support undo are narrower than assumed | M | M | Confirm in P1 before the ledger depends on it (section 8 item 7) |

### 27.6 Launch and communication

- **Staff training** before G2: the one-page playbook (20.3) and a short walkthrough using the three test plans.
- **Guest explainer pages** (no "AI" wording): *What Stanley may and may not do*, *How to turn things off*, *What happens if Stanley gets it wrong*.
- **In-app first-use lines** (never repeated); a "What is new from Stanley" note when an ability is added (one line, once, counts against the caps).
- **No overclaiming:** marketing and the welcome page never say Stanley "handles everything", never promise time saved we cannot measure, and always say he does not pay or cancel.

---

## 28. Requirement index

ACT-01 to 08 (save time), CHK-01 to 08 (catch issues), VAL-01 to 07 (get more), RUL-01 to 06 (rules), CL-01 to 10 (welcome checklist), AUT-01 to 09 (rung 4 classes), SR-1.1 to SR-11.6 (per-stage rules, section 12; SR-1.4 and SR-1.5 retired; SR-10.7 added), SR-F.1 to F.7 (family pack), SR-S.1 to S.3 (solo additions), M1 to M18 (mistake scenarios, 18.1), IMP-01 to 18 (section 16), R1 to R5 (research, section 13), G0 to G4 (gates), D1 to D29 (decisions, section 10), plus REM-* in `docs/stanley-reminders-requirements.md`.
