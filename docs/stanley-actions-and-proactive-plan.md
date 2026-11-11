# Stanley beyond answers: actions, watching and proactive help

Status: **draft for review (2026-11-10), revised the same day after owner feedback round 2** (guest-chosen support level, a welcome-page checklist, and a per-stage deep dive of everything Stanley could do if allowed; see sections 11 to 13, which supersede parts of sections 2, 3, 8 and 10 where marked). Nothing here is built. It answers: *what can Stanley do for the guest other than answer questions, can he take actions, and what new proactive or suggestive help could save time, catch problems and get more out of the app?* It ends with phases and a proposal for explaining all of it on the Stanley welcome page.

Companion documents: `docs/stanley-reminders-requirements.md` (the reminders deep dive, which is one track of this plan), `docs/chat-features-research.md` section 15 (the permanent 1:1 Stanley chat that carries all of this), `docs/stanley-gap-analysis-and-plan.md` (what Stanley already is) and `docs/stanley-data-inventory.md` (what he may read).

Follows `CLAUDE.md`: thin client (the server decides, the screen renders), external services mocked behind interfaces, English only, WCAG 2.2 AA, phases that commit and stop, verified with `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` only.

**Evidence and caveat.** Based on the documents above, the `src/ai` modules, `server/Princess.Api/Domain/Stanley*.cs`, and `StanleyIntro.tsx`. I did not run anything. The gap plan records that the server code for its phases 1 to 12 and the carry-over phases was written but **never compiled or run here**, so "built" below means "written", and a build and targeted test run by the owner should come before anything is relied on.

---

## 1. Yes, he can act: what Stanley does today beyond answers

Stanley is already more than a Q&A box. The pattern is **prepare, preview, confirm, receipt, undo**: the server turns a request into a typed intent and a stored preview; the guest confirms once; the same service the screens use makes the change; a receipt appears and, for plan changes, can be undone for two hours. Paying, cancelling a booking, changing a cabin and sharing data are never actions.

| Family | What he does now | Where |
|---|---|---|
| **Confirmable actions (9)** | Order a stateroom item; add an excursion to the cart; reserve a dinner; move a dinner; change dining seating (booker only, frozen 3 days out); draft a service case (lost item, complaint); change the day plan (add, move, drop); set a reminder; start a group poll | `StanleyActions.cs`, `stanleyAction.ts`, `StanleyActionCard.tsx` |
| **Hand-off to a person** | Drafts a case with the guest's consent text, optional photo, and shows owner, status and next update | `StanleyHandoffs.cs`, `HandoffCard.tsx`, `HandoffCases.tsx` |
| **Helper path** | A helper the guest authorises can *prepare* five action kinds; the guest confirms | `StanleyHelper.cs` |
| **Read tools** | Sailings, itinerary, port, excursions, restaurants, route, the guest's trip, plan, cases; the bill answers come from money rules as a card, never a model-quoted figure | `StanleyTools.cs`, `StanleyResolvers.cs` |
| **Planning** | Day and week planner, group diplomat, compare excursions, weighted sailing compare, cabin chooser, decision brief | `StanleyPlanner.cs`, `StanleyDiscover.cs` |
| **Money** | Entitlement and spend answers, trip budget pace, charge questions that open a billing case | `StanleyMoney.cs` |
| **Travel day** | Flight, traffic, shore plan, phrases, port pack, onward travel, packing edits | `StanleyTravel.cs` |
| **Proactive (already)** | "What changed" cards with a ranked consequence, "What did I miss", rough-seas tip, Stanley Next, five journey modes (boarding, first four hours, sea day, port day, last morning), 11 milestone moments, speech dot for urgent reasons, coach tours, "Why am I seeing this?" | `StanleyChanges.cs`, `stanleyNext.ts`, `stanleyModes.ts`, `stanleyMoments.ts`, `stanleyDot.ts` |
| **Memory and control** | Visible, forgettable preferences with scope; four volume levels layered as three plain choices; per-lane kill switches | `StanleyMemory.cs`, `StanleyOps` |
| **Welcome page today** | Four lines ("answer questions", "show what to do next and remind you", "help you plan", "tell you when something changes") and the volume choice | `StanleyIntro.tsx`, `stanleyIntro.can.1..4` |

**What is missing is not capability so much as three things:**

1. **Guests do not know.** The welcome page names four abilities; Stanley has more than twenty. Nothing explains that he can *do* things (preview and confirm) or *watch* things.
2. **Everything is one request, one action.** There are no bundles ("plan my evening"), no standing rules ("if my tour is cancelled, offer me another"), and no way to say how much he may do alone.
3. **Checking is passive.** He explains when asked and surfaces what *changed*, but does not routinely look at the whole trip and say "here are four things that will cause trouble".

---

## 2. Principles (the guardrails every new capability keeps)

1. **People decide how much Stanley may do; inside that, he acts.** *(Revised, round 2.)* By default every change goes through the existing preview and confirm token. A guest may choose to let him go further (sections 11 and 12): standing rules that prepare for them, and a short list of free, reversible things he does and reports. He never acts outside what the guest switched on, and never above the ceiling.
2. **An autonomy ladder, with a hard ceiling** (section 3, widened in section 11). Nothing above "reversible and pre-authorised" exists. Pay, cancel, change cabin, share data and message another person are **never** automated.
3. **Deterministic first, model last.** Rules find the problem; a template words it; a model is used only to word or plan when a template is not enough, on the cheapest tier that works, behind the existing meter.
4. **Trip facts, not eavesdropping.** Proactive help comes from the booking, plan, programme, folio, documents, weather and ship data, never from reading conversations.
5. **Few, timed, explained.** Every proactive item has a trigger, a purpose, an expiry and a "Why am I seeing this?". The existing caps hold (one proactive element per screen, three per session, a dismissed item stays dismissed until its facts change).
6. **Honest provenance.** Every claim shows its source and "as of" time; a simulated source is not called verified; Stanley says "I can't confirm" rather than guess.
7. **Delivery through the permanent thread.** Everything proactive lands in the guest's 1:1 Stanley chat in a lane (critical, important, reminder, info, suggestion), with the existing quiet hours, budget and calm mode. A safety-critical fact is never only in chat.
8. **Easy to see, easy to stop.** One place lists everything Stanley did and is watching for the guest, with a stop button on each.
9. **Children and helpers.** A supervised child's Stanley is notice-only; anything proactive about a child goes to the guardian. A helper can prepare, never confirm.
10. **No commercial pressure.** Value-finding (section 4C) highlights what the guest already has paid for; offers stay a separate opt-in category.

---

## 3. The autonomy ladder

Today's behaviour is rung 2. The plan adds rungs 1 and 3 only for narrow, safe classes and caps the ladder.

| Rung | Name | What Stanley does | Examples | Guest control |
|---|---|---|---|---|
| 0 | **Tell** | Answers or explains, nothing changes | "What does this charge mean?" | none needed |
| 1 | **Notice** | Flags something unprompted, in the right lane | "Your passport expires within six months of the return date" | volume level, per-topic off |
| 2 | **Prepare** | Builds a preview; the guest confirms each time | Add excursion, move dinner, draft case (exists) | Confirm or Not now |
| 3 | **Standing preparation** | The guest sets a **rule** once; when it fires Stanley prepares the preview and notifies; still one tap to confirm | "If my tour is cancelled, find me a replacement the same day" | Rule list, pause, delete |
| 4 | **Pre-authorised and reversible** | For the **classes the guest switched on** (section 11.4: AUT-01 to AUT-09), Stanley acts and tells them, with an undo window. *(Widened in round 2 from one class to nine; every class still meets the five tests below.)* | Set my deadline reminders; add free items to my plan marked "Stanley's pick"; reserve a free main-dining table I always want; keep my dinner when the show moves | Per-class switch (off unless the chosen support level includes it), daily cap, undo, activity ledger, one master pause |
| Never | | Pay, cancel a booking, change cabin or cruise, share personal data, send a message to another person, answer for the guest to staff | | not available |

**Rung 4 candidates must meet all of:** free, reversible within the guest's own window, affects only the guest, no commercial effect, no data leaves the account. *(Round 2: the list is now the nine classes in section 11.4. Anything not on it still needs a new decision.)*

---

## 4. New capabilities

Grouped by the value to the guest. Each has a priority (P0 must, P1 should, P2 later), the rung it uses, and what it builds on. IDs are used in the phases.

### A. Save time

| ID | Capability | What it does | Rung | Pri | Builds on |
|---|---|---|---|---|---|
| ACT-01 | **Bundles** ("plan my evening", "sort my arrival day") | One request becomes an ordered set of previews (show, dinner, a quiet drink, walk times) confirmed together or one by one, with a single receipt and one-tap undo of the set | 2 | P0 | Planner, action previews, route finder |
| ACT-02 | **Trip checklist concierge** | Walks through what is outstanding per traveller (documents, check-in, boarding pass saved, dining, excursions), opening the right screen or preparing the right action for each, and ticks them off | 2 | P0 | Checklist, Stanley Next, per-traveller facts |
| ACT-03 | **Drafts for approval** | Drafts the awkward thing for the guest to review: message to the party ("meet at the atrium at 5:10"), a case, a thank-you to a crew member, a survey answer, a late-arrival note to the ship | 2 | P1 | Handoff drafts, meeting-point code, storyteller |
| ACT-04 | **Smart defaults** | Pre-fills a booking, order or form from remembered preferences and the party ("table for four, early seating, window if possible") with the source shown | 2 | P1 | Memory, party |
| ACT-05 | **Reminders, rebuilt** | Natural-language, anchored, snoozable, with an honest delivery ladder | 2 and 4 | P0 | See `docs/stanley-reminders-requirements.md` |
| ACT-06 | **Morning brief and evening look-ahead** | A short message at the time the guest chooses: today's plan, the all-aboard time, what is unbooked, what changed overnight; in the evening, tomorrow at a glance and any deadline (bag night) | 1 | P0 | Day modes, change engine, plan |
| ACT-07 | **Voice shortcuts** | "Hey Stanley, remind me...", "what's next" using the existing speech input | 0 to 2 | P2 | `StanleyVoice` |
| ACT-08 | **One-tap repeat** | "Same as last time" for a dinner request or an order the guest makes often | 2 | P2 | Receipts |

### B. Catch issues before they cost something

| ID | Capability | What it checks | Rung | Pri | Builds on |
|---|---|---|---|---|---|
| CHK-01 | **Trip check-up** (a run-on-demand and a scheduled pass) | Passport validity against the return date and each country's rule; names matching documents; missing documents per traveller; travel-day connection tight; check-in not done; payment dates; arrival-day plan has a buffer | 1 | P0 | Resolvers, documents, trip facts |
| CHK-02 | **Plan lint** | Overlaps (show and dinner), too-tight transitions using real walk times, a tour that clashes with all-aboard, an excursion unsuitable for a traveller's pace or access, a booked dinner on the night of a late port return | 1 | P0 | Planner, route finder, excursion fit |
| CHK-03 | **Missed-ship guard** | Compares the guest's *planned return* with all-aboard and the walk and tender time; a quiet nudge when the buffer shrinks, a critical one when it is gone; offers the missed-ship path | 1 | P0 | Port pilot, tender outlook |
| CHK-04 | **Bill watch** | Duplicate or unexpected charges, a charge for something a package includes, a credit unused near disembark, posted vs pending; drafts a billing question for the guest to send | 1 and 2 | P0 | Money rules, billing case |
| CHK-05 | **Forgot something?** | Packing list tuned to itinerary, weather, formal nights, port rules (swimwear, covered shoulders, passport copies), what to carry ashore | 1 | P1 | `packing.ts`, forecast |
| CHK-06 | **Access and needs check** | A traveller's stated mobility, diet or allergy against dining, excursions, tender ports and routes, with the evidence and a human-verification route; never says "safe" | 1 | P1 | Memory (sensitive off by default), travellers |
| CHK-07 | **Group gaps** | Who has not answered a poll, who has no dinner, who is on a different excursion; "three of you have not chosen a dinner" | 1 | P1 | Polls, group diplomat |
| CHK-08 | **Deadline radar** | A single list of every date that can cost money or access (final payment, instalments, cancellation windows, dining freeze, document upload) ordered by consequence | 1 | P1 | Notices, plan |

### C. Get more out of the app and the trip

| ID | Capability | What it does | Rung | Pri | Builds on |
|---|---|---|---|---|---|
| VAL-01 | **Included-value finder** | "Your package includes a drink at the pool bar and you have not used it this week." "You have credit left; here are three ways to use it" (transparent, no push to spend more) | 1 | P0 | Entitlements, spend |
| VAL-02 | **Feature discovery at the right moment** | Introduces a feature when it is useful: route finder on first lost-in-the-ship moment, offline pack before the first port, polls when the party has three adults | 1 | P1 | Coach, moments |
| VAL-03 | ~~**Availability watch**~~ (dropped for now) | "Tell me if a table opens at the specialty restaurant on Thursday", "tell me if this excursion gets space"; on a hit, a one-tap preview | 3 | P1 | Dining, excursions, reminder service |
| VAL-04 | **Today at sea / in port, curated** | "Three ways to spend the free hour", each real and reachable now, with walk time and cost | 1 | P1 | Day modes, planner |
| VAL-05 | **Memory-powered suggestions** | Uses preferences the guest left switched on (pace, interests) to rank, with "why this" on each | 1 | P1 | Memory |
| VAL-06 | **After the trip** | Recap, photos, feedback drafts, loyalty explained, a next-voyage idea built from kept preferences; paused while a serious case is open | 1 | P2 | Storyteller, loyalty |
| VAL-07 | **Daily digest for the party** (opt-in, shared) | A single shared card the organiser posts: today's plan, meeting points, who is where | 2 | P2 | Group, meeting points |

### D. Standing rules and watches (the new building block)

A **rule** is "when X happens, prepare Y". The guest creates it in plain words or from a template; the server evaluates it on a clock, not only when the app is open.

| ID | Template | Trigger | Result |
|---|---|---|---|
| RUL-01 | "If my excursion is cancelled or moved, find me a replacement" | Change event on a booked tour | Rung 3: a preview of the best same-day option, with other options |
| RUL-02 | "Keep my dinner at 8:00 if the show moves" | Programme change | Rung 3: a preview moving the dinner, or a warning if it cannot |
| RUL-03 | "Tell me when check-in opens" | Check-in state | Rung 1 or 4 |
| RUL-04 | "Tell me if tenders are delayed on port days" | Tender outlook worsens | Rung 1, critical when the buffer is gone |
| RUL-05 | ~~"If a table opens at X, hold it for me"~~ | Dropped for now (no real availability to hold) | |
| RUL-06 | "Remind me to set out my formal clothes the night before formal night" | Programme | Rung 4 (reminder) |

Rule limits: at most 10 active; each shows what it did and last fired; expires at disembark; paused by do-not-disturb except critical; **never** pays, cancels, messages another person or changes the booking.

---

## 5. Where it appears (one design, many surfaces)

| Surface | Role |
|---|---|
| **The permanent Stanley thread** | The inbox and the doorbell for every proactive item and every receipt. Lanes: critical, important, reminder, info, suggestion. "Needs you" strip for what is outstanding. Reply chips: Got it, Why?, Do it, Not now, Don't show again |
| **Stanley activity** (one screen) | Three tabs: **Did** (receipts, undo), **Watching** (rules, availability watches, reminders), **Remembers** (preferences). A stop button on every row. This is also the answer to "what has he been doing for me?" |
| **Stage Home Next steps** | The next due item from the check-up or reminders is the Next step; the same item as its notice |
| **In context** | A Stanley chip on a plan item, excursion, dinner, port day, bill line: "Check this", "Remind me", "Watch this", "Why this?" |
| **The guest's volume** | The existing level (only what affects my trip, offer suggestions, guide me through everything) governs rung 1 and the suggestion lane; rung 3 and 4 are separate explicit opt-ins |

---

## 6. Explaining it to the guest: the Stanley welcome page

### 6.1 Problem
`StanleyIntro.tsx` lists four abilities and a volume choice. It does not say Stanley can **do** things or **keep watch**, does not show examples, and does not explain what he will never do or how to stop him. A guest who thinks Stanley is a FAQ will never try the best features.

### 6.2 Proposed structure (same page, richer, still one screen on a phone)

> **Round 2:** the page now also asks the guest what level of support they want and walks them through a short checklist (section 11.2 and 11.3). Steps 4 and 5 below are replaced by that flow; steps 1 to 3 stay.

1. **Hero:** Stanley's wave pose and "Hello, I am Stanley" (kept).
2. **Four short cards, one idea each,** each with a **Try it** chip that opens Stanley with the words ready (the existing prefill API) and then returns:
   - **I answer.** "Ask me about your ship, the ports, your plans and your bill, in plain words." *Try: "What time must I be back in Cozumel?"*
   - **I do things for you, with your OK.** "I can book a dinner, add an excursion, change your day, set a reminder or start a poll. I always show you first, and nothing happens until you say yes. You can undo most things." *Try: "Plan my evening."*
   - **I keep watch so you don't have to.** "I check your trip for problems, tell you when something changes and what it means, and nudge you before a deadline." *Try: "Check my trip."*
   - **I help you get more from your trip.** "I find what you have already paid for, suggest things you will enjoy, and help you remember it afterwards." *Try: "What is included for me?"*
3. **"What I will never do"** card, short and concrete: never pay or cancel for you, never change your booking without your yes, never share your details, never message anyone for you, never replace the ship's announcements for safety. *"I am not a crew member. For anything urgent, ask a person."*
4. **"You are in control"** card: the volume choice (kept), a link to **Stanley activity** ("see everything I did and everything I am watching, and stop any of it"), and a link to **Stanley notices** settings (quiet hours, categories).
5. **Continue** (kept).

### 6.3 Draft wording (English only)
- `stanleyIntro.can.1` Answer your questions about your cruise, your ship, the ports and your bill, in plain words.
- `stanleyIntro.can.2` Do things for you, with your OK: book a dinner, add an excursion, change your day, set a reminder. I always show you first, and most things can be undone.
- `stanleyIntro.can.3` Keep watch: check your trip for problems, tell you when something changes and what it means for you, and remind you before a deadline.
- `stanleyIntro.can.4` Help you get more from your trip: find what you have already paid for and suggest things you will enjoy.
- `stanleyIntro.never.title` What I will never do
- `stanleyIntro.never.body` Pay for anything, cancel or change your booking without your yes, share your details, message other people for you, or replace the ship's announcements. I am not a crew member. For anything urgent, ask a person.
- `stanleyIntro.control.body` You decide how much I say. See what I have done and what I am watching in Stanley activity, and stop any of it.

### 6.4 Beyond the first visit
- **What Stanley can do** screen, reachable from Help and from the thread header, driven by the **server's capability list** (the thin-client rule): each capability with its stage, an example, whether it is on, and a **Try it** button. New capabilities appear without a front-end change.
- **First-use explainers.** The first time a guest meets a new kind of help (a rule, a check-up result, a bundle) one short line explains it and how to stop it; never repeated.
- **Stage tips.** On entering a stage, one "Stanley can help here" line with a single try-it (reuses stage welcome); counts against the proactive caps.
- **Accessibility.** The page is one column, cards are headings with real lists, Try-it chips are buttons, focus is managed on return from Stanley, nothing relies on colour, reduced motion respected, text zoom to 200% fine.
- **Honesty.** Examples use words Stanley really handles, and a test fails if an example does not return an answer.

---

## 7. Data, privacy and safety additions

| Area | Rule |
|---|---|
| **New stored data** | Rules (per guest, max 10, deleted at disembark and with the account), availability watches, activity ledger entries (kind, outcome, receipt number, never message text), pre-authorisation switches. All added to `docs/stanley-data-inventory.md` in the same change |
| **Permissions and consent** *(round 2)* | Per account on the server: support level, one row per ability (state, wording version, source, time), a consent history, the pause switch, and per-class counters for caps and the circuit breaker. Wording shown is stored by version so we can prove what the guest agreed to. Lapses three days after disembark. Added to `docs/stanley-data-inventory.md` in P0a |
| **Check-up and lint inputs** | The same PII-free facts the packet already allows; documents are read as validity facts (expiry date, match yes or no), never document numbers |
| **Sensitive needs** | Mobility, diet and allergy stay off by default and reach a model only when switched on; checks that use them run on the server by rule, not by model |
| **Notices** | Delivered under the thread's lanes, quiet hours, calm mode and budget; critical list is small, published and under change control; a `Bypass` without a safety or deadline reason fails a gate test |
| **Kill switches** | Per capability and per lane; a runaway rule engine can be stopped without touching critical delivery |
| **Model cost** | Rule evaluation and checks are code, not model calls; only wording and planning use a model, on the existing tiers and daily ceiling |
| **Prompt-injection** | Rules and drafts take typed fields; free text a guest enters (reminder text, a draft) is data in a delimited block and never an instruction |
| **Audit** | The audit trail records action kind and outcome only |

---

## 8. Phases (commit and stop after each; server code is written with tests and run by the owner)

> **Round 2 changed this plan: use the revised phases in section 13.** The table below is kept as the record of the first draft.

| Phase | Scope | Closes | Done when |
|---|---|---|---|
| **P0: Explain what exists** | Welcome page rewrite (6.2, 6.3) with Try-it chips; a server **capability catalogue** endpoint and the **What Stanley can do** screen; a test that every example works; `stanleyIntro` strings | Guests do not know | A new guest sees what Stanley answers, does, watches and will never do, and can try each in one tap |
| **P1: Stanley activity** | One screen: **Did** (receipts, undo), **Watching** (reminders now; rules later), **Remembers**; stop button per row | Control and trust | A guest can see and stop everything Stanley did or is doing |
| **P2: Reminders rebuilt** | Reminders R1 to R3 from `docs/stanley-reminders-requirements.md` (natural-language, anchored, delivery ladder) | Reminders weak | See that document's acceptance |
| **P3: Trip check-up and plan lint** | CHK-01, CHK-02, CHK-08: the check-up engine (pure, tested), results as thread messages with "Fix this" actions; run on demand and on a schedule | Catch issues | "Check my trip" returns ranked findings with a fix action each, no false alarm on a clean trip fixture |
| **P4: Bundles and drafts** | ACT-01, ACT-03: multi-preview bundles with one receipt and set undo; drafts for party messages and notes | Save time | "Plan my evening" gives a confirmable set; undo reverses the set |
| **P5: Checklist concierge and smart defaults** | ACT-02, ACT-04 | Save time | The checklist closes items by opening or preparing the right action |
| **P6: Value and bill** | VAL-01, CHK-04, CHK-05: included-value finder, bill watch, forgot-something | Get more | Unclaimed entitlement and duplicate charge fixtures each produce the right message |
| **P7: Briefs** | ACT-06: morning brief and evening look-ahead at guest-chosen times | Save time | A guest-set brief arrives once a day with the right content and honours quiet hours |
| **P8: Missed-ship guard and group gaps** | CHK-03, CHK-07 | Catch issues | Shrinking buffer fixture nudges, then escalates, then offers the missed-ship path |
| **P9: Standing rules (narrow)** | Rules engine at rung 3 only and templates RUL-01, 02, 03/04 and 06 (RUL-05 and VAL-03 dropped); server clock evaluation | Standing help | A cancelled-tour fixture prepares a replacement preview and tells the guest |
| **P10: Reversible, pre-authorised (rung 4)** | One class only: a reminder that follows a moved anchor; off by default, switch, undo, ledger | Time saved without taps | A reminder follows its moved tour with undo, and everything else is still refused |
| **P11: Group and voice** | VAL-07, ACT-07, REM-D01 group reminders | Delight | A shared brief is posted only after the organiser confirms |

**Order (decided):** P0, P1, P2a (reminders R1 and R2), P3, P2b (reminders R3, released with real push), then P7, P6, P4, P5, P8, P9, P10, P11. If time is short stop after P3 and P7. They are mostly rung 1 and 2, reuse engines that exist, and change what the guest *experiences* the most. P9 and P10 are the highest-risk and should wait for real usage numbers.

---

## 9. Measures

| Measure | Target | Review when |
|---|---|---|
| Guests who try at least one "do" or "watch" capability in their first week | 40% | Under 20% |
| Proactive item acted on (confirmed or opened) | 30% | Under 15% (too noisy) |
| Proactive item dismissed with "Don't show again" | Under 10% | Over 20% |
| Check-up finding confirmed true by the guest | 90% | Under 75% |
| Action previews confirmed vs abandoned | Reported | Abandon over 50% |
| Undo after a rung 3 or 4 action | Under 5% | Over 10% (wrong action) |
| Complaints or cases mentioning Stanley | Zero rising | Any rise |
| Cost per guest per trip | Within the daily ceiling | Median call count rising week on week |
| Welcome page: guests who open Stanley activity | Reported | Under 10% (not discoverable) |

---

## 10. Decisions

**Decided by the owner (2026-11-10):**

1. **No "AI" wording anywhere in the guest-facing UX.** This applies to the welcome page, the thread, cards, receipts and notices. Stanley is shown by picture and name only. The chat research and chat plan mentions of an "AI label" are overridden (notes added to both). The welcome page copy in section 6 already avoids the word and must keep doing so; a test should fail the build if a guest-facing string for Stanley contains "AI" as a word.
2. **A guest's own reminders fire at the time asked, even in quiet hours.**
3. **Server check:** the owner will build and run the earlier Stanley server tests before P3.

**Decided on my judgement (change if wrong):**

4. **Standing rules: build, but narrow and late.** *(Superseded in part by decisions 10 to 15: the guest now chooses how far, and the rule list grows to per-stage packs. RUL-05 and VAL-03 are reinstated as watch-and-prepare, not hold.)* Rules are the most powerful and riskiest idea, so P9 ships only rung 3 (Stanley *prepares and tells*, the guest confirms) with four templates: RUL-01 replacement for a cancelled or moved excursion, RUL-02 keep my dinner if the show moves, RUL-03/04 tell me when check-in opens or tenders are delayed, RUL-06 reminder before formal night. **RUL-05 (hold a table) and VAL-03 (availability watch) are dropped for now** because the catalogue has no real availability to hold, and a "hold" that is not real would break the honesty rule. Rung 4 shrinks to one class: **reminders that follow a moved anchor.** P9 only starts after P3 and P7 have shown usage numbers.
5. **Order.** Reminders first within the first slice: **P0, P1, then reminders R1 and R2, then P3**, with reminder delivery (R3) built after P3 and released only when real push exists. This lets the explanation, the control screen and the better creation flow land without waiting for the push deployment.
6. **Briefs and nudges:** off until the guest chooses, except the check-in and payment notices that already exist; Stanley offers the morning brief once, at the end of Embark.
7. **Value finder (VAL-01):** strictly "what you already have". Paid options appear only if the guest asks "what else is there?".
8. **Check-up depth (CHK-01):** document-validity and name-match rules are mocked behind an interface now, with the rule table authored per country, labelled in the card as the rule applied ("6 months beyond return"), and never described as an official check.
9. **The ceiling (section 3)** stands as written *(still true after round 2; rung 4 is wider but meets the same five tests)*: rung 4 only for free, reversible, own-account actions; never pay, cancel, change cabin, share data or message another person.

**Revised order:** P0, P1, P2a (reminders R1 and R2), P3, P2b (reminders R3, released with real push), P7, P6, P4, P5, P8, P9, P10, P11.

---

## 11. Owner feedback round 2: let the guest choose how far Stanley goes

**The feedback (2026-11-10).** The first draft is a great start, but Stanley can do more *if allowed*. Ask the guest on the Stanley welcome page what level of support they want and be more aggressive when they choose it (the autonomy ladder is the reference). Give them a quick checklist on that page to switch abilities on, which they manage later in Settings. Take a deeper dive across **all 11 stages**, especially the **standing rules** that could be offered at each one.

### 11.1 Findings from the deep dive

1. **Two separate dials, not one.** Today's `stanleyLevel` (chatty, helpful, asked, off; `settings.ts`) is **voice**: how much he *says*. What the feedback asks for is **authority**: how much he may *do* without being asked. They must stay separate. A guest can want a quiet Stanley who quietly handles things, or a chatty one who never touches anything.
2. **Authority must live on the server, per account.** The voice level is a per-device display setting, which is right for voice. Authority is a *permission to act when the app is closed*, so it must be stored on the server against the account (a guest on a second device, or a helper, sees the same grants), checked by the server on **every** action path, and recorded with the wording version the guest agreed to. The front end only renders the catalogue and sends switches (thin-client rule).
3. **Rules need a clock.** `StanleyReminderService` evaluates only when the app calls `/me/push/dispatch`. Every rung 3 and 4 behaviour needs a **server scheduler** (a hosted service ticking each minute with a per-guest lock). This is the single biggest piece of new plumbing and it comes before any rule.
4. **The classifier is the real safety feature.** Whether a thing may be rung 4 depends on facts the data must carry per item: *free or paid*, *cancellable without fee until when*, *affects only this guest or others too*. The catalogues (dining, shows, excursions, services) need those flags, and the executor must refuse a rung 4 action on any item that fails them. Without the flags nothing above rung 3 should ship.
5. **Some "forms" are attestations.** Online check-in, customs and health declarations are statements the guest signs. Stanley may **pre-fill and save a draft**; he must never submit them.
6. **One of the earlier "dropped" ideas was dropped for the wrong reason.** Availability watch (VAL-03) and RUL-05 were dropped because "a hold that is not real breaks honesty". The backend already simulates dining and excursion capacity behind an interface. A **watch that notifies and prepares a booking** (no hold) is honest with simulated data and with a real provider alike. Reinstated as watch-and-prepare. "Hold a table for me" stays dropped.
7. **Most of the power is in standing rules, and rules are mostly stage-shaped.** Section 12 finds about **70 rules and abilities** across the 11 stages; roughly half are rung 3 and a quarter qualify for rung 4. They share about a dozen server building blocks (scheduler, trigger types, preview builder, classifier, ledger), so the cost is in the platform, not each rule.
8. **Consent fatigue is the risk on the welcome page.** Eleven stages of choices at sign-up would be ignored. Ask the **cross-journey** choices once on the welcome page (ten items, one screen), and ask each **stage's** extras when the guest enters that stage, using the stage welcome that already exists (`stage-welcome-plan.md`).
9. **Autonomy needs a brake.** Powerful automation without a circuit breaker will eventually do something a guest dislikes. Add caps per class per day, a global "acted without a tap" ceiling, an automatic pause of a class when its undo rate passes a threshold, and a visible "Pause everything" switch.

### 11.2 Four support levels (the first question on the welcome page)

Plain words, no "AI", one radio group. Each level includes the one above it; the guest can fine-tune in the checklist that follows. The ladder rung each maps to is shown for the design team only.

| Level | Guest-facing name and line | Rungs | What changes |
|---|---|---|---|
| **1** | **Just answer.** "I answer when you ask, and nothing else." | 0, 2 on request | No unprompted notices, no rules. Today's *asked* voice plus actions he is asked for |
| **2** | **Keep watch.** "I check your trip, warn you about problems and tell you what changed. You decide everything." | 0 to 2, plus 1 | Check-ups, change explanations, deadline notices, briefs the guest sets. **Default for a new guest** (matches today's behaviour) |
| **3** | **Do the legwork.** "When something happens, I line up the fix and ask for your yes. Rules I offer you at each stage." | 0 to 3 | Standing rules from the stage packs; bundles; drafts and pre-filled forms; watches that prepare a booking. Still one tap to confirm each |
| **4** | **Handle the small stuff.** "For small free things you can undo, I just do them and tell you. I never pay or cancel." | 0 to 4 | Adds the nine rung 4 classes (11.4), each separately switchable, with caps, undo and a ledger |

Interplay with **voice** (the existing dial): Voice *off* means authority is capped at level 1. Voice *asked* (and calm and simple mode, which already cap voice) keeps rung 3 and 4 working but their notices go to the thread and Stanley activity **without a push**, except critical items. A level 3 or 4 guest on *asked* therefore finds a prepared fix waiting in the thread, never a buzz. Level changes take effect for new events only; nothing already prepared is cancelled silently.

The **ceiling is unchanged at every level**: Stanley never pays, cancels a booking, changes a cabin or cruise, shares personal data, messages another person on his own, answers for the guest to staff, or submits a signed declaration. (Section 14, decision 13, records the one future option, a capped spend, as *not built*.)

### 11.3 The welcome-page checklist (and the same list in Settings)

**Flow on the welcome page** (still `StanleyIntro`): hero, the four ability cards and the "never do" card (section 6), then **Step 1: choose a level** (11.2), **Step 2: the checklist**, then **Continue**. It is skippable at every step; skipping leaves level 2 with the three safest items on. Target time: under 60 seconds.

**Step 2 is pre-ticked from the chosen level**, one switch per row, plain sentence plus a one-line example, grouped under three headings. Rows above the chosen level are shown switched off and marked "needs level 3" (or 4) so the guest sees what more is available and can raise the level with one tap.

| ID | Row (guest wording) | Example shown | Needs level | Rung | Built from |
|---|---|---|---|---|---|
| **Watching** |
| CL-01 | Check my trip for problems | "Your passport expires within 6 months of the return date." | 2 | 1 | CHK-01, CHK-02 |
| CL-02 | Tell me when something changes and what it means | "Your tour moved to 9:30. You now have 20 minutes less in port." | 2 | 1 | change engine |
| CL-03 | Watch my bill and what I already have | "A charge appears twice." "Your package includes the pool bar drink." | 2 | 1 | CHK-04, VAL-01 |
| CL-04 | Morning brief and evening look-ahead (choose the times) | "Today at a glance, and tomorrow's early start." | 2 | 1 | ACT-06 |
| **Preparing** |
| CL-05 | Line up a fix when a plan breaks, for my yes | "Your tour is cancelled. Here is the best replacement today." | 3 | 3 | RUL-01, 02, 04 |
| CL-06 | Fill in forms and drafts for me to check | "Check-in is open. I filled it in; please check and send." | 3 | 3 | ACT-03, ACT-04 |
| CL-07 | Tell me when a table or space opens, with a ready booking | "A table for four opened on Thursday at 7:30." | 3 | 3 | VAL-03 reinstated |
| **Handling** |
| CL-08 | Set my reminders for me (deadlines, check-in, bag night, all aboard) | "I added 6 reminders for your trip. Change any of them." | 4 | 4 | AUT-02 |
| CL-09 | Plan my days and keep the plan up to date with free things | "I added a free show at 8:30 as Stanley's pick. Remove it if you like." | 4 | 4 | AUT-03 |
| CL-10 | Book the free things I always want (main dining, free shows) | "I booked your usual table for four at 6:00. Undo for 2 hours." | 4 | 4 | AUT-04 |

Per-stage extras (section 12) are **not** in this list; they are offered at stage entry.

**Rules for every row.** The consent sentence is shown in full and versioned; the switch writes one server record (guest, ability, state, wording version, source `welcome`, `settings` or `stage`, time). Every row says what it will **never** do. Turning a row on never retro-fires on old events. A row's example must work, or the build fails (as in 6.4). Rows are served by the **capability catalogue** (P0) so a provider switch-off or a kill switch hides a row with no front-end change.

**Settings: "What Stanley may do"** (under Settings and help, plum, linked from the welcome page, Stanley activity and the thread header):

1. Level radio (11.2) with a plain note when voice limits it.
2. The ten rows above, then **each stage's extras** in stage order (current stage first, future stages collapsed), each with switch, one-line example, **last used** and **times used**.
3. **Pause everything** (one switch; rules and rung 4 stop, notices and answers continue; reversible).
4. Changing the level that would switch on new rows asks once: "This also turns on 3 more things: [list]. Turn on?" Lowering the level asks nothing and switches the rows off at once.
5. **Consent history** (what was switched on or off, when, from where) and a link to Stanley activity (Did, Watching, Remembers).
6. A new guest on a second device sees the same state. A **helper** can see it but not change it. A **supervised child** has level 1 only; the guardian chooses for them.

**Expiry and re-asking.** Level 3 and 4 grants lapse three days after disembark and are asked again on the guest's next trip. The first time a rung 3 or 4 ability acts, one line explains what happened, how to undo it and where to switch it off. Never repeated.

### 11.4 Rung 4: the nine classes a guest can allow ("Handle the small stuff")

Each class is a separate server switch, off unless the level includes it, with a daily cap, a ledger line per act, an undo window (default 2 hours, and never past the point the thing becomes non-refundable), and the five tests (free, reversible, only the guest, no commercial effect, no data leaves the account). A class fires only on items the **classifier** (finding 4) marks eligible.

| ID | Class | What Stanley does alone | Cap | Never |
|---|---|---|---|---|
| AUT-01 | **Reminders that follow** | Moves a reminder when its anchor moves (earlier plan, kept) | none | Fires a reminder earlier than the guest set without telling them |
| AUT-02 | **Deadline reminders** | Creates reminders for the dates that matter (final payment, check-in opens, documents, dining freeze, bag night, all aboard, exit time), with the guest's usual lead times | 20 per trip | Creates a recurring reminder or one that is not tied to a trip date |
| AUT-03 | **My plan, topped up** | Adds free events, walks and meeting points to the guest's own plan, labelled "Stanley's pick", and removes his own picks that no longer fit; **never** removes anything the guest added | 4 per day | Adds anything with a cost, or a time that overlaps a booked item |
| AUT-04 | **Free reservations I always want** | Reserves free, fee-free-to-cancel items the guest has a standing preference for (main-dining table, free shows) when the window opens | 2 per day | Specialty dining with a cover charge, paid shows, anything for another person's name |
| AUT-05 | **Lists kept current** | Updates the guest's packing list, document "bring" list, trip checklist, shortlist and comparison when facts change (forecast, itinerary, a document added) | none | Deletes a guest's own entry |
| AUT-06 | **Drafts saved** | Saves pre-filled forms and drafts (check-in, customs, feedback, a note to the party) as drafts the guest reviews | 1 draft per form | Submits, signs or sends |
| AUT-07 | **Saved for me** | Saves the boarding pass to Wallet when ready, downloads the offline pack on Wi-Fi before a port, saves receipts and the recap, builds the photo album | none | Anything that uses data the guest has not already given |
| AUT-08 | **Keep my timings** | Moves the guest's own **same-price** booking (a dinner) when a show or port time shifts and the move keeps it free; otherwise prepares a fix (rung 3) | 2 per day | Moves a paid booking, or one for another person |
| AUT-09 | **My standing order** | Repeats a free stateroom request the guest has made three times (ice, towels, an extra pillow) at the time they chose | 1 per day | Orders anything with a charge |

AUT-04 and AUT-09 have a real-world effect on staff, so they ship last and only after usage numbers.

---

## 12. Per-stage deep dive: what Stanley can do at each of the 11 stages if allowed

**How to read it.** Stages and tabs come from `docs/stage-experience-plan.md` 5.1. **Today** is what exists (section 1). **Stage welcome ask** is the two to four extras offered when the guest enters the stage (the stage welcome screen), shown only for abilities the chosen level allows. Rule IDs are `SR-<stage>.<n>`. Rung is the **highest** rung the rule uses; a level 3 guest gets it as "prepare", a level 4 guest gets it as "act" only where an AUT class is named. "Needs" lists a gap that must exist first (all rows also need the scheduler, finding 3). Rules expire at disembark unless stated.

Cross-journey abilities (CL-01 to CL-10) apply at every stage from Manage on; they are not repeated below.

### 12.1 Dream (Explore, Ask)

**Today:** quiz, grounded planner chat, compare, dream board, favourites and price alerts.
**Stage welcome ask:** SR-1.1, SR-1.3.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-1.1 | **Shortlist for me.** Keeps a shortlist of up to three sailings that fit the quiz answers; refreshes weekly; tells the guest what changed | Weekly clock, new sailing published | 4 (AUT-05) | Sailing feed (mock) |
| SR-1.2 | **Dream-board referee.** Tells the party when two people's picks disagree and prepares a poll | Board edit | 3 | Polls, group diplomat |
| SR-1.3 | **Price watch on favourites** with a plain "price fell 8%" note and the reason | Fare change | 1 | Mock fare feed |
| SR-1.4 | **What would change my mind.** After a week, a short brief: decided, left, what could change it | 7 days | 1 | Decision brief |
| SR-1.5 | **Trial day.** Offers the five-minute "a day aboard" once after the second save | Second save | 1 | Trial-day simulator (NEW in journey priorities) |

### 12.2 Discover (Sailing, Cabin, Cost)

**Today:** cabin chooser, sailing compare, cost calculator, decision brief, 48-hour hold.
**Stage welcome ask:** SR-2.1, SR-2.2.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-2.1 | **Cabin like this.** Watches for a cabin that matches the guest's remembered needs (quiet, midship, not under a pool, accessible) and prepares a side-by-side with the one they like | Inventory change | 3 | Mock inventory |
| SR-2.2 | **Keep my cost honest.** Refreshes the cost calculator when fares, taxes or the package price change and says what moved | Fare change | 4 (AUT-05) | Mock fare feed |
| SR-2.3 | **Hold before it goes.** When the guest has compared the same two sailings twice, offers a 48-hour hold, never a countdown | Behaviour | 3 | Hold flow |
| SR-2.4 | **Tell me what I'd regret.** For any shortlisted sailing or cabin, the top three things past guests wished they had known | Open of a card | 1 | Review notes (priority list NEW) |
| SR-2.5 | **Package break-even.** Works out if a drinks or dining package pays for the guest's stated habits and says when it does not | Calculator edit | 1 | Entitlement data |

### 12.3 Book (Booking, Travellers, Pay)

**Today:** draft-safe checkout, split payments, plain contract, name capture.
**Stage welcome ask:** SR-3.1, SR-3.2.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-3.1 | **Check before I pay.** Compares each traveller's name with their document and flags dietary, allergy and accessibility needs not yet captured | Before the pay step | 1 (blocks nothing) | Document facts |
| SR-3.2 | **Fill the travellers for me** from remembered details, with the source on every field | Travellers step | 3, 4 for the draft (AUT-06) | Memory, party |
| SR-3.3 | **What happens if.** Turns the cancellation policy into "cancel on 12 Jan costs $420" for the guest's real dates | On request, and at pay | 1 | Policy rules |
| SR-3.4 | **Share-the-cost links.** Prepares the pay-your-share links for each payer; the guest sends them | Booking with 2+ payers | 3 | Payer links |
| SR-3.5 | **Deposit reminder** before a hold lapses | Hold clock | 4 (AUT-02) | Hold flow |
| SR-3.6 | **Price-drop re-pricing.** If the fare drops after booking, prepares the re-price request | Fare change | 3 | Re-pricing rules |

### 12.4 Manage (Trip, Needs, Group)

**Today:** documents engine, payment calendar, change handling, special assistance, phone-at-sea guide, helper role, packing.
**Stage welcome ask:** SR-4.1, SR-4.2, SR-4.3.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-4.1 | **Document guard.** When a passport or visa is missing, near expiry or does not cover the return date, prepares the upload or renewal reminder per traveller | Weekly, document change | 3 | Rule table per country |
| SR-4.2 | **Payment ladder.** Reminders at 30, 14, 7 and 2 days before final payment, with the amount and what happens if missed; prepares the pay screen, never pays | Payment dates | 4 (AUT-02) | Payment calendar |
| SR-4.3 | **Assistance deadlines.** Starts special-assistance and dietary requests early enough for the notice period and tracks the confirmation | Cut-off minus lead | 3 | Needs tracker |
| SR-4.4 | **Itinerary change responder.** On a change, explains the effect, lists the choices and prepares the one that fits the guest's rules | Change event | 3 | Change engine (exists) |
| SR-4.5 | **Weekly what to expect**, one note, one action, tuned to the guest | Weekly | 1 | Persona |
| SR-4.6 | **Packing kept current** as forecast and itinerary change | Forecast, itinerary | 4 (AUT-05) | Packing |
| SR-4.7 | **Family-at-home page refresh** reminder, never posted without the guest | Before sailing | 3 | Family page |
| SR-4.8 | **Helper summary.** A weekly "what is left" for a helper the guest authorised | Weekly | 1 | Helper role |

### 12.5 Prebook (Plan, Prepare, Group)

**Today:** dining, excursions, shows, spa, packages, plan and polls.
**Stage welcome ask:** SR-5.1, SR-5.2, SR-5.3.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-5.1 | **First-night booking.** When the booking window opens, books or prepares the main-dining table the guest usually wants (timing, party size, seating) | Window opens | 4 (AUT-04) | Window dates, fee-free flag |
| SR-5.2 | **Plan my days.** Builds a day-by-day plan from interests, pace and mobility with free picks and gaps; keeps it current | Plan edit, change | 4 (AUT-03) | Planner, route finder |
| SR-5.3 | **Space opens.** Watches a named excursion, specialty table, spa slot or show and, on a hit, prepares the booking with one tap | Inventory change | 3 | Mock inventory (VAL-03) |
| SR-5.4 | **Dinner for everyone.** Starts a poll for the party, then prepares the reservations for each person for their own confirmation | Party of 3+ | 3 | Polls |
| SR-5.5 | **Package check.** Compares buying a package now with paying as you go and says if it is worth it | Package view | 1 | Entitlements |
| SR-5.6 | **Excursion fit.** Flags a tour that clashes with all-aboard, pace or access need and offers two alternatives | Add to cart | 3 | Excursion fit |
| SR-5.7 | **Occasion helper.** For a birthday or anniversary, prepares the cake, table decoration or celebration request for the guest to send | Occasion in profile | 3 | Services |

### 12.6 Get to the ship (Board, Travel, Plan)

**Today:** online check-in, boarding pass, flight and traffic, travel plan, arrival window, phrases, onward travel; the boarding-day mode.
**Stage welcome ask:** SR-6.1, SR-6.2, SR-6.3.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-6.1 | **Check-in ready.** The moment check-in opens, pre-fills it from the documents and saves it as a draft to check and send; **never submits** | Check-in opens | 4 for the draft (AUT-06), submit is 2 | Check-in flow |
| SR-6.2 | **Leave on time.** Sets the leave-for-the-terminal reminder and moves it when traffic or a flight changes | Travel plan, traffic | 4 (AUT-01) | Traffic and flight (mock) |
| SR-6.3 | **Boarding pass saved** to Wallet and offline the moment it exists | Pass issued | 4 (AUT-07) | Wallet |
| SR-6.4 | **Flight watch.** If a flight is late or cancelled enough to threaten the ship, says so, shows the missed-ship path and drafts the "running late" note to the cruise line | Flight status | 3 (draft) | Flight (mock) |
| SR-6.5 | **Terminal ETA draft** for the party, one tap to send | Leave time | 3 | Party chat |
| SR-6.6 | **Phone and money set-up.** The roaming and card checklist, ticked off from what is done | 3 days out | 1 | Phone guide |

### 12.7 Embark (Board, Ship, Plan)

**Today:** terminal and arrival help, muster, medallion, first-four-hours mode, ship explorer, route finder.
**Stage welcome ask:** SR-7.1, SR-7.2.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-7.1 | **First night, sorted.** Builds the first evening (muster, a walk to dinner, a sailaway spot) from what the guest booked and adds the free parts | Boarding | 4 (AUT-03) | Planner |
| SR-7.2 | **Muster, never missed.** A reminder at the guest's lead time with the station and the walk from the cabin | Muster time | 4 (AUT-02) | Muster data |
| SR-7.3 | **Cabin ready.** Tells the guest when the cabin is ready and where it is | Cabin status | 1 | Ship feed (mock) |
| SR-7.4 | **First-night ordering.** Prepares the usual stateroom items (ice, towels) for the evening | Boarding | 3, 4 (AUT-09) | Stateroom service |
| SR-7.5 | **Set the ship up.** Offers the offline pack, the route finder and chat once, at the moment each is useful | Aboard | 1 | Coach |

### 12.8 Sea (Today, Ship, People)

**Today:** day plan, events, dining, spa, packages, spend pace, people and chat; the sea-day mode.
**Stage welcome ask:** SR-8.1, SR-8.2, SR-8.3.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-8.1 | **Build my day.** Each morning, tops up the day with free picks that fit pace, interests and walking, leaving gaps | 7:00 ship time | 4 (AUT-03) | Planner |
| SR-8.2 | **Nothing late.** A reminder before each item in the plan with the walk time; moved when the item moves | Plan items | 4 (AUT-01, AUT-02) | Walk times |
| SR-8.3 | **Keep dinner and show in step.** If the show or dinner moves, moves the dinner when it is free and fits; otherwise prepares a fix | Programme change | 4 (AUT-08) | Same-price flag |
| SR-8.4 | **Free hour ideas.** Three real things to do now, with walk time and cost | A gap in the plan | 1 | Planner |
| SR-8.5 | **Spend guard.** Tells the guest at 80% of the daily budget they set and shows what is already included | Folio | 1 | Spend pace (exists) |
| SR-8.6 | **Space opens at the spa or a specialty table** | Inventory | 3 | Mock inventory |
| SR-8.7 | **Formal night, ready.** Reminds the evening before and lists the dress code | Programme | 4 (AUT-02) | Programme |
| SR-8.8 | **Tomorrow's port, prepared.** The evening before a port, prepares the shore plan and the tender outlook | 18:00 | 3 | Port pilot |
| SR-8.9 | **Party digest.** A shared card the guest posts for the party | Daily | 3 | Group |

### 12.9 Port (Port, Ship, People)

**Today:** port pilot, all-aboard and tender outlook, excursions, shore plan, phrases, weather, the port-day mode.
**Stage welcome ask:** SR-9.1, SR-9.2, SR-9.3.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-9.1 | **Missed-ship guard.** Watches the guest's return buffer against all-aboard, tender and walk time; a quiet nudge as it shrinks, critical when gone; always in more than chat | Port clock | 1 | Port pilot |
| SR-9.2 | **Back on time.** Sets "head back" at the buffer time and moves it when the tender or traffic changes | Buffer | 4 (AUT-01) | Tender (mock) |
| SR-9.3 | **Tour cancelled? Replacement.** When a booked excursion is cancelled or moved, prepares the best same-day option and the alternatives | Change event | 3 | Excursion inventory |
| SR-9.4 | **Rain plan.** When the forecast turns, prepares an indoor alternative for the day | Forecast | 3 | Weather (mock) |
| SR-9.5 | **Port pack ready.** Downloads the offline pack on Wi-Fi before arrival | Day before | 4 (AUT-07) | Offline pack |
| SR-9.6 | **Local rules.** Dress, currency, tipping and photo rules for this port, once | Port day start | 1 | Port data |
| SR-9.7 | **Tender tickets.** Prepares the tender ticket request when the ship uses tendering | Tender day | 3 | Tender flow |
| SR-9.8 | **Meet-me-here.** Prepares the shared meeting point and a "running late" note | On request | 3 | Meeting points |

### 12.10 Disembark (Leave, Ship, People)

**Today:** bags, exit time, customs, tips, folio, last-morning mode.
**Stage welcome ask:** SR-10.1, SR-10.2, SR-10.3.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-10.1 | **Bag night.** Reminds the guest in time and prepares the bag tags and the exit time pick for the guest's own confirmation | Last evening | 4 (AUT-02), pick is 3 | Disembark data |
| SR-10.2 | **Final-bill review.** Reads the folio before disembark, flags duplicates, unexpected items and unused credit, and drafts the billing question | Last evening | 3 | Bill watch |
| SR-10.3 | **Customs ready.** Pre-fills the customs declaration as a draft; never submits | Last full day | 4 for the draft (AUT-06) | Customs flow |
| SR-10.4 | **Tips explained.** Shows suggested tips and what changing them costs; any change is rung 2 | Last evening | 2 | Gratuity rules |
| SR-10.5 | **Onward travel watch.** Watches the flight and transfer and tells the guest when to leave | Flight status | 1, 4 for the reminder (AUT-01) | Flight (mock) |
| SR-10.6 | **Leave nothing behind.** A last-look checklist (safe, drawers, charger, passport, bag tags) | Final morning | 1 | Checklist |

### 12.11 Remember (Memories, Next, Feedback)

**Today:** storyteller, photos, feedback, keep chats, next trip, diary.
**Stage welcome ask:** SR-11.1, SR-11.2.

| ID | Standing rule or ability | Trigger | Rung | Needs |
|---|---|---|---|---|
| SR-11.1 | **Recap and album built.** Builds the recap, the photo album and the receipts pack from the guest's own data | Disembark + 1 day | 4 (AUT-07) | Storyteller |
| SR-11.2 | **Feedback drafted.** Drafts the survey answers and a thank-you for a crew member for the guest to edit; never sends | Disembark + 2 days | 4 for the draft (AUT-06) | Feedback |
| SR-11.3 | **Keep my chats.** Prompts before chats are cleared | Retention clock | 1 | Chat retention |
| SR-11.4 | **Next voyage, from what I liked.** Suggests a trip built from the preferences left on; offers are a separate opt-in; paused while a serious case is open | 10 days | 1 | Memory |
| SR-11.5 | **Loyalty explained** in plain words, with what the guest has earned | Disembark | 1 | Loyalty |
| SR-11.6 | **Expense export.** A tidy trip cost summary on request | On request | 1 | Folio |

### 12.12 Patterns, risks and what the deep dive says about build order

- **Three shapes cover almost everything:** *watch then tell* (rung 1), *watch then prepare* (rung 3: a trigger, a preview, a notice) and *keep a thing of mine current* (rung 4: AUT-02, 03, 05, 07). Only AUT-04, 08 and 09 touch a booking or a person other than the guest.
- **The first two stages are rule-poor on purpose.** Before booking the guest has no money at stake and no trip to protect; the honest value there is a better decision, not automation.
- **The densest stages are Prebook, Sea and Port.** They carry the most rules and the largest share of time saved. They are also where a wrong automatic act would hurt most, so they get their rung 4 classes last.
- **Shared rooms and parties.** Rung 4 touches only the guest's own items. Anything for the party (a dinner for all, a digest, a meeting point) stops at rung 3, and in a shared room the **booker** owns dining plan and excursion changes.
- **Dependencies, in order:** scheduler; classifier flags (free, fee-free until, only-me); preview and ledger generalised beyond the nine action kinds (new kinds for *save_shortlist*, *watch*, *prefill_form*, *set_deadline_reminders*); mock fare and inventory feeds behind interfaces; document-validity rule table.

---

## 13. Revised phases (replaces section 8 for planning)

The first three phases of section 8 stay (P0 explain, P1 activity, P2 reminders). New phases are inserted where they unlock the most, and P9 and P10 are broken up so each stage pack ships, is measured and can be stopped on its own.

| Phase | Scope | Done when |
|---|---|---|
| **P0: Explain what exists** | As in section 8 (welcome copy, Try-it chips, capability catalogue, What Stanley can do) | A new guest sees what Stanley answers, does, watches and will never do |
| **P0a: Support level and permissions** *(new)* | `StanleyPermissions` table (guest, ability, state, wording version, source, time) and consent history; the catalogue now carries rung, level, stage and wording version; **one enforcement point** every action and rule path calls; level radio and the ten-row checklist on the welcome page; Settings "What Stanley may do" with Pause everything; a test that **no action path runs without the check**; voice and authority interplay (11.2) | A guest sets a level and checklist in under a minute, changes it in Settings, and the server refuses everything switched off |
| **P1: Stanley activity** | As in section 8, now also lists permissions, Pause everything and the consent history | A guest sees and stops everything Stanley did or is doing |
| **P2a, P2b: Reminders** | As in section 8 | See the reminders document |
| **P2c: The scheduler** *(new)* | Server clock service with per-guest locking, trigger types (time, change event, inventory, state), a rules table, firing and expiry, circuit breaker on undo rate; tests with a fake clock | A rule fires on time with the app closed, and a runaway rule is paused automatically |
| **P3: Trip check-up and plan lint** | As in section 8 | Ranked findings with a fix each, no false alarm on a clean fixture |
| **P3a: Classifier flags** *(new)* | Free, fee-free-until and only-me flags on dining, shows, excursions, services; "reversible until" on every action; executor refuses a rung 4 act on an ineligible item | A paid or shared item can never be acted on at rung 4 |
| **P7, P6, P4, P5, P8** | As in section 8 | As in section 8 |
| **P9a: Rules engine and cross-journey rules** | Rung 3 engine, templates RUL-01 to RUL-04, RUL-06 and the reinstated watch-and-prepare (VAL-03, RUL-05 as *notify and prepare*, not hold) | A cancelled-tour and a space-opens fixture each prepare the right preview |
| **P9b to P9f: Stage packs** | Rung 3 and 1 rules from section 12, one pack per phase: **B** Manage and Prebook (SR-4, SR-5), **C** Get to the ship and Embark (SR-6, SR-7), **D** Sea, Port and Disembark (SR-8 to SR-10), **E** Remember (SR-11), **A** Dream, Discover, Book (SR-1 to SR-3, built last because it earns least) | Each pack's rules fire on fixtures and the stage welcome ask offers them |
| **P10a to P10c: Rung 4 classes** | In this order, each behind its switch, cap and ledger: **a** AUT-01, 02, 05, 07; **b** AUT-03, 06; **c** AUT-08 then AUT-04 then AUT-09, only after P10a and P10b have run for a season with an undo rate under 5% | Each class acts only on eligible items, tells the guest, and undoes cleanly |
| **P11: Group and voice** | As in section 8 | A shared brief is posted only after the organiser confirms |

**Order:** P0, P0a, P1, P2a, P2c, P3, P3a, P2b, P7, P6, P4, P5, P8, P9a, P9b, P9c, P9d, P9e, P10a, P10b, P9f, P10c, P11. **Stop points:** after P0a the welcome page works end to end with levels 1 and 2 meaning what they do today; after P9a a level 3 guest has real standing rules. Rung 4 classes should not begin until the scheduler, classifier and ledger have run on rung 3 and the undo and abandon numbers are known.

---

## 14. Decisions

**Decided on my judgement for round 2 (change if wrong; numbering continues from section 10):**

10. **Two dials.** Voice (exists, per device) and authority (new, per account on the server) stay separate; authority is capped by voice as in 11.2.
11. **Default for a new guest is level 2, Keep watch,** which is today's behaviour. Levels 3 and 4 are one tap away on the welcome page but never pre-selected.
12. **Where to ask.** Ten cross-journey rows on the welcome page; stage extras at stage entry through the stage welcome; everything in Settings at any time. Grants lapse three days after disembark.
13. **Spending stays out.** "Delegate with a cap" (for example, replace a cancelled tour up to the same price) was considered and **is not built**. It breaks the ceiling, needs strong authentication and refund rules, and carries the highest harm if wrong. Revisit only with usage numbers, a refund policy and the owner's explicit decision; if ever built it would be a fifth level with a per-item and per-trip cap, a two-factor set-up, a receipt and a cancel window.
14. **Availability watch is reinstated as watch-and-prepare** (VAL-03, RUL-05 reworded to "tell me and line it up"); "hold a table for me" stays dropped.
15. **Rung 4 is nine classes** (11.4), shipped in the P10 order. AUT-04, AUT-08 and AUT-09, which touch a booking or staff, come last and only on measured safety.
16. **A guest-facing "AI" word test** (decision 1) now also covers the checklist and Settings strings.

**Open for the owner:** whether the level names (Just answer, Keep watch, Do the legwork, Handle the small stuff) read well to guests; whether AUT-09 (standing stateroom order) is worth the staff-facing risk or should be dropped; whether level 3 should be the preselected choice instead of level 2 for guests who arrive from a booking rather than from Dream.

---

## 15. Measures added in round 2

| Measure | Target | Review when |
|---|---|---|
| Guests who choose level 3 or 4 | Reported by level | Under 10% (not compelling) or over 60% (check they understood) |
| Guests who change the level in Settings in the first week | Under 20% | Over 35% (wrong default or confusing) |
| Rule or class paused by the circuit breaker | Zero | Any |
| Undo rate per rung 4 class | Under 5% | Over 10% |
| Guest switches a row off after its first firing | Under 15% | Over 25% (wrong action) |
| "Stanley did something I did not expect" reports | Zero | Any |
| Time saved: taps avoided per guest per trip (acts at rung 4 plus rung 3 confirmed) | Reported | Flat after launch |
| Rows still unanswered after welcome (skipped) | Reported | Over 50% (flow too long) |

---

## 16. Requirement index

ACT-01 to 08 (save time), CHK-01 to 08 (catch issues), VAL-01 to 07 (get more), RUL-01 to 06 (rules), CL-01 to 10 (welcome checklist), AUT-01 to 09 (rung 4 classes), SR-1.1 to SR-11.6 (per-stage rules, section 12), plus REM-* in `docs/stanley-reminders-requirements.md`.
