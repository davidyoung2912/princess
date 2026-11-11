# Stanley beyond answers: actions, watching and proactive help

Status: **draft for review (2026-11-10), revised the same day after owner feedback round 2** (guest-chosen support level, a welcome-page checklist, and a per-stage deep dive; sections 11 to 15) **and extended in round 3 into a complete plan** (validation before coding, persona walkthroughs, mistakes and trust repair, staff and operations, offline, rule arbitration, test harness, cost, accessibility, privacy and security, delivery plan; sections 16 to 31). Sections 11 to 31 supersede parts of sections 2, 3, 8 and 10 where marked; **the delivery plan in section 27 replaces the phase tables in sections 8 and 13.** Nothing here is built. It answers: *what can Stanley do for the guest other than answer questions, can he take actions, and what new proactive or suggestive help could save time, catch problems and get more out of the app?* It ends with phases and a proposal for explaining all of it on the Stanley welcome page.

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
| AUT-04 | **Free reservations I always want** | Reserves free, fee-free-to-cancel items the guest has a standing preference for (main-dining table, free shows) when the window opens | 2 per day | Specialty dining with a cover charge, paid shows, anything on another adult's own account. The one exception is the **booker reserving on the booking** (decision 18) |
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

## 13. Revised phases (round 2; superseded by section 27)

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

---

## 16. Validate before coding: test the weakest assumptions first

The whole round 2 design rests on three guesses: guests will *understand* four support levels, a meaningful share will *choose* more than "Keep watch", and they will *forgive* the occasional wrong act. All three are cheap to test before any server work. This section is the pre-build research plan; its outcome can change sections 11 and 12.

### 16.1 What the welcome flow looks like (static wireframes for the test)

Four screens, one column, phone first. These are the screens shown to test guests as plain pictures or a click-through; no server needed.

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
|                                |      |  [off] Set my reminders  [Raise]|
|  What I never do >             |      |  [Continue]  [Skip for now]    |
+--------------------------------+      +--------------------------------+

 SCREEN C: SUMMARY (before leaving)       SCREEN D: SETTINGS "What Stanley may do"
+--------------------------------+      +--------------------------------+
|  You chose: Do the legwork     |      |  Level: Do the legwork   [Change]|
|  7 things are on. 3 are off.   |      |  [ Pause everything ]          |
|  You can change this any time  |      |  Now: Prebook                  |
|  in Settings > What Stanley    |      |   [on] Book first-night table  |
|  may do.                       |      |        last used: 2 days ago   |
|  [Try it: Check my trip]       |      |  Later stages (collapsed) >    |
|  [Done]                        |      |  History of changes >          |
+--------------------------------+      +--------------------------------+
```

### 16.2 The research plan

| Step | What | Who and how many | Pass mark | If it fails |
|---|---|---|---|---|
| **R1: Comprehension** | Show screens A to C cold; ask "what did you just choose?", "what will Stanley never do?", "could he spend your money?" | 6 to 8 people per persona: a first-time family parent, a solo traveller, two friends, an over-65 traveller, one screen-reader user, one on 200% text | At least 80% say what they chose; 90% say he cannot pay; nobody believes "Handle the small stuff" includes paying | Reword. Test the alternate level names below |
| **R2: Choice** | Ask them to pick a level for *their own* next cruise and say why | Same group | A real spread (not all level 1 or all level 4); reasons mention time saved or fear of mistakes, not confusion | If nearly all pick level 1: the pitch is weak; lead with examples, not levels |
| **R3: Forgiveness** | Tell a story ("Stanley booked a dinner you did not want; here is the undo"); show the receipt and the apology | Same group | At least 80% would still use level 3 or 4 after the story | If under 60%: ship practice mode (19.2) as the default for levels 3 and 4 |
| **R4: Examples** | Show ten section 12 rules as one-line cards; rate "useful", "neutral", "creepy" | Same group | Each kept rule is "useful" for at least half of the personas it applies to and "creepy" for under 10% | Cut or demote to rung 1 |
| **R5: Dry run on the three test plans** | Walk `test-plan-solo-cruiser`, `test-plan-family-of-four` and `test-plan-two-friends` against section 12 (done on paper in section 17) | Owner and me | Every finding triaged | See section 17 |

**Alternate level names** to test against the current set (one reads better for a given audience; pick by R1):

| Set | Level 1 | Level 2 | Level 3 | Level 4 |
|---|---|---|---|---|
| **A (current)** | Just answer | Keep watch | Do the legwork | Handle the small stuff |
| **B** | Only when asked | Keep an eye on things | Sort things out with me | Take care of the small things |
| **C** | Ask me | Warn me | Prepare for me | Do it for me (small, free things) |

**Copy tests in the same session:** whether "never pays" should come before or after the levels; whether a short worked example under each level helps; whether "Handle" or "Take care of" signals too much trust.

**No code needed:** the wireframes are images; the sessions can be run on a click-through prototype. Findings are written into this document, not into a backlog.

---

## 17. Walkthroughs on paper: the three test-plan personas

Method: read each persona's journey in `docs/test-plan-*.md` against section 12, and for each stage ask *which rules would fire, which would be noise, which would feel creepy, and what in the app stops the rule from working.* The test plans are the right fixtures because they are the real journeys the team already runs by hand.

### 17.1 Facts from the test plans that constrain the design

| Fact (from the test plans) | What it means for Stanley's authority |
|---|---|
| **Sign-up is adults only; children are guests on the booker's account** (family plan 0) | Stanley's permission record belongs to an *account*. A child has no account and no level; anything for a child is the guardian's decision on the guardian's account, or the supervised-child notice-only rule |
| **Only the booker sees the money; other adults on a direct booking have no account** (friends plan 0) | A non-booker adult may have **no Stanley at all**, or a Stanley that sees no booking. Rules about payment, dining plan and bookings run **only on the booker's account** |
| **Linking a booking works only for agent bookings** (both plans) | A second adult who registers may land on an **empty** Stanley: the welcome checklist must say "I have nothing of yours to watch yet; link a booking" rather than offer switches that do nothing |
| **The fare split is a notebook, kept on the device** (friends plan) | No rule may touch cost splitting; there is no money movement to automate |
| **Cabin parties stop at 23:00** | Party rules (digest, invites) respect existing quiet hours |
| **Demo clock only for `IsDemo` accounts** (solo plan 0.2) | The rule scheduler needs an injectable clock so the same demo jump works for rules (essential for testing every stage; see 23.1) |

### 17.2 Solo cruiser (Sam, one adult)

| Stage | Rules that fire | Noise or risk | Finding |
|---|---|---|---|
| Dream, Discover | SR-1.1 shortlist, SR-1.3 price watch, SR-2.2 | SR-1.4 and SR-1.5 add little | **Cut** SR-1.4 (brief) and SR-1.5 (trial-day nudge) as separate rules; fold the brief into SR-1.1's weekly note |
| Book | SR-3.1, SR-3.3, SR-3.5 | none | Keep. SR-3.2 (fill travellers) is trivial for one traveller; it is a **smart default** at level 2, not a rule |
| Manage | SR-4.1, SR-4.2, SR-4.6 | SR-4.2 at four lead times is four notices | **Compress** the payment ladder to 14 days, 2 days and the day itself |
| Prebook | SR-5.1, 5.2, 5.3, 5.6 | SR-5.4 (poll), SR-5.7 never apply | **Hide party rules** when the booking has one traveller. Dining for one: ask early if she wants shared tables (a solo-persona preference) |
| Get to the ship, Embark | SR-6.1, 6.2, 6.3, 7.1, 7.2 | none | Strong. This is where level 4 saves most taps |
| Sea, Port | SR-8.1 to 8.3, 9.1 to 9.3 | SR-8.9 (party digest) never fires | Solo guests need a **meet-people** rule instead: suggest a solo meet-up or a shared table (opt-in; ties to chat) |
| Disembark, Remember | SR-10.1 to 10.3, 11.1, 11.2 | none | Keep |

**Solo-specific additions:** SR-S.1 *Safety check-in*: a daily "all well?" nudge she can switch on, and a gentle prompt to share her whereabouts with a person at home (consented, revocable; ties to family-at-home page). SR-S.2 *Eating alone, comfortably*: prefer shared tables or counter seating when she says so. SR-S.3 *Single supplement honesty*: explain it where it appears.

### 17.3 Family of four (Dad, Mom, 16, 12)

| Topic | Finding | Decision |
|---|---|---|
| **Whose Stanley?** Only Dad (booker) sees the trip; Mom's own account may see nothing | Mom's Stanley has no data. Mom can still be given a **view** of the trip if Dad adds her as helper (existing helper role) | Show Mom a clear "link or ask Dad to add you" state. Rules never fire against a booking the account is not on |
| **Who consents?** Dad's level governs actions on the booking | Mom's items (her own plan items) are hers only if she has an account; otherwise they are the booking's | Booking-wide acts need the **booker's** level. Anything affecting another adult's own items is **rung 3 only** (prepare for their yes) |
| **The 16 and the 12** | No account, so no consent. Teen and child rules must be set by the guardian | Add a **family pack** below. Supervised children never receive proactive items directly |
| **"My plan, topped up" (AUT-03)** in a shared plan | A topped-up plan the whole family sees is not "only the guest" | AUT-03 applies to a **personal plan** only. Family plan items from Stanley are rung 3 (prepare, the booker confirms) |
| **Dinner (AUT-04)** | Reserving for four includes people who did not consent | AUT-04 allowed only for the **booker acting on the booking** (the same authority the booker has in the app today), showing the party names and the usual size; never for a non-booker account |
| **Noise** | A parent receiving every rule for four people gets four times the notices | **Roll up** per booking: "3 things for the family today", not twelve |

**Family pack (new rules, level 3, guardian only):**

| ID | Rule | Trigger | Rung |
|---|---|---|---|
| SR-F.1 | **Kids club ready.** Reminds about registration, age bands and times; prepares the registration for the guardian to confirm | Stage entry, club opens | 3 |
| SR-F.2 | **Age-fit check.** Flags a tour, activity or show with an age limit that a child on the booking does not meet | Add to cart or plan | 1 |
| SR-F.3 | **Teen check-in time.** Reminds the guardian of agreed meet-up times set by the guardian (nothing sent to the teen by Stanley) | Guardian's rule | 3 |
| SR-F.4 | **Everyone's muster.** Lists each family member's station and the walk from the cabin; flags a child not yet marked done | Muster | 1 |
| SR-F.5 | **Find my family.** Prepares the meeting-point card (not a message) | On request | 3 |
| SR-F.6 | **Kid-safe port day.** Filters excursions for ages, strollers and heat; prepares two options | Port day | 3 |
| SR-F.7 | **Bedtime and quiet hours.** Reminds the guardian of the quiet-hours window for the cabin and family programme | Evening | 1 |

### 17.4 Two friends (Alex booker, Jordan no account)

| Topic | Finding | Decision |
|---|---|---|
| **Jordan has no Stanley.** Everything runs on Alex's account | A rule that says "your friend" acts on Jordan's behalf | **Never** act on Jordan's own items. Reservations on the booking for both are the booker's authority only (as AUT-04 above). Digests and party cards are rung 3 |
| **Everything on the booking is shared** | AUT-03 (plan top-up) and AUT-08 (keep timings) could change what Jordan expects | Both apply only to Alex's **personal** items; shared plan items are rung 3 |
| **"Do everything" persona** | They want maximum fill, so the plan lint (CHK-02) and travel-time warnings matter most | A **fill the day** bundle (ACT-01) with a "pace" setting (relaxed, balanced, packed) and a check that every pair of bookings has a real walk time |
| **Late nights** | Party rules, quiet hours 23:00, late return from port | **Late-night guard:** a missed-ship nudge scales with the "I stay out late" memory; party rules honour the 23:00 quiet start |
| **Settling costs** | The split is a notebook; no money moves | A **settle-up note** at disembark (rung 1) that reads the notebook and says who owes what; nothing is paid or sent |
| **Two accounts via Route 2 or 3** | Only then can both receive Stanley | A "second adult joins" nudge: when a second account links, Stanley asks *them* for their own level (their consent, not Alex's) |

### 17.5 Persona packs from other test fixtures and plans (also needed)

| Persona | Source | Pack | Notes |
|---|---|---|---|
| **Older guest managed by a relative** (the Gerald test) | `customer-journey-priorities` MNG, INC-01 | **Helper pack:** a helper can prepare, never confirm; weekly "what is left" (SR-4.8); the guest's level governs, the helper cannot raise it | The helper sees ledger and rules read-only |
| **Accessibility and medical needs** (the Linda test) | CHK-06, S3-05 | **Needs pack:** assistance deadlines (SR-4.3), tender and deck-route checks, medical card, dining allergy confirmation tracking | Sensitive data never reaches a model unless switched on (section 7) |
| **Celebration** (milestone trips) | S0-09, SR-5.7 | **Occasion pack:** table and cake requests as drafts, a shared plan for the family | Sensitive wording for bereavement trips |
| **Group or reunion** (10 or more) | XG-01 | **Organiser pack:** poll roll-ups, who-has-not-answered, group meeting points; all rung 3 | Roll-ups only, never one notice per person |

### 17.6 Net result of the walkthroughs

- **Cut or fold:** SR-1.4, SR-1.5, the four-step payment ladder, the SR-5.4 poll for a one-person booking.
- **Add:** family pack (7), solo additions (3), late-night guard, settle-up note, fill-the-day bundle with pace, helper, needs, occasion and organiser packs.
- **Change the model:** every ability gets an **applies-when** clause (traveller count, ages, role, persona) so it is invisible when it does not apply; ownership of items is *personal* or *booking*, and rung 4 touches only personal items, with the one booker exception (AUT-04 on the booking).
- **New first-class idea: roll-ups.** Several rules for several people become one item per booking per period.
- **Honesty about empty states:** a guest with nothing linked sees what Stanley *would* do once a booking is linked, not dead switches.

---

## 18. When Stanley gets it wrong: mistakes, apology and repair

Autonomy earns trust only if the failure is cheap and visible. This section is the missing half of the design.

### 18.1 The scenarios and what the guest sees

| # | What went wrong | Guest sees | Undo and repair | System response |
|---|---|---|---|---|
| M1 | An auto-booked dinner clashes with something the guest did **outside** the app (a show booked at the desk) | A notice: "Your 6:00 table clashes with Show X. Keep which?" | One-tap move or cancel the auto-booking | Rule re-reads the plan before every act and again at the start of the undo window |
| M2 | A reminder fires at the wrong clock time (ship time versus home time) | "I got the time wrong. It should have been 4:15 ship time." | Reminder corrected and re-fired | Time-zone fixture test (23.2); the zone is always shown with the time |
| M3 | A "Stanley's pick" in the plan is not wanted | Chips on the item: Not for me, Fewer like this, Stop adding | Removed; memory updated with scope and why | "Not for me" teaches memory (visible and forgettable) |
| M4 | A wrong replacement tour was prepared | Nothing was done; the preview just was not wanted | Not now | Rung 3, no harm; still counted in the quality measure |
| M5 | A rule fires **twice** (duplicate event) | One item with a note, never two | Idempotency key per (rule, trigger, subject) prevents the second act | Property test in the harness |
| M6 | A prepared fix is **stale** when confirmed (tour already refilled) | "That option has gone; here is the next best" | New preview; the old one cannot confirm | Previews expire and re-validate at confirm |
| M7 | The **data was wrong** (a time the provider published incorrectly) | "I was wrong about this. Here is the right time and what I changed." | Affected acts are listed with one-tap undo of all | A data-correction notice type; the audit event links all acts that used the bad fact |
| M8 | **Undo is impossible** (past the free window, venue already used it) | Honest message, not an error: "This is past the free change time. I can ask Guest Services to look." | Hand-off case drafted with consent text | An undo failure opens a hand-off case automatically with the guest's consent |
| M9 | A **notification storm** after reconnection at sea | A single catch-up card, ranked | Dismiss all, or open Activity | Arbitration (section 22) and the "what did I miss" card that exists |
| M10 | **Someone else** raises the level on a shared or stolen device | An email and an in-app notice on other devices: "Your level changed to X. Not you? Switch back." | One-tap revert link; step-up needed to raise again | Step-up authentication to raise a level (section 26) |
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
| **Examples work** | Each welcome-page and checklist example runs through the real router and returns a card (6.4) |
| **Accessibility** | The existing `stanleyAccessibility.test.ts` pattern extended to the checklist and ledger components |
| **Soak and cost** | A simulated fleet (for example 10,000 guests over a 14-day trip on the fake clock): tick time, queue depth, model calls and cost against the ceiling |
| **Chaos** | Provider outage, slow provider, duplicate webhook, partial DB failure: rules pause and recover with one notice |
| **Red team** | Prompt injection through reminder text, a chat message, a draft, a port description: the executor takes only typed, validated arguments |

### 23.4 Gates in the pipeline

`npm run test` (all Vitest), `npm run lint`, `npx tsc -b`, `npm run build`, and (owner, targeted) the new Stanley server test classes. A rule card without fixtures fails a test; a string with "AI" fails a test; a missing kill switch fails a test.

### 23.5 Shadow mode and rollout in production

1. **Shadow:** the engine computes what it *would* do for a random 100% of level 3 and 4 guests and logs it (no acts, no notices). Compare with what the guest did next ("would we have been right?").
2. **Canary:** 1% of eligible guests, then 10%, then 50%, then 100%, per class, each step gated on the measures in section 29 for at least a week.
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

| Data | Source | Purpose | Kept | Never |
|---|---|---|---|---|
| Trip facts (booking, plan, programme, folio, documents as validity facts, weather, ship data) | Existing, listed in `stanley-data-inventory.md` | Triggers and wording | As today | Document numbers, conversation text |
| Permission records and consent history | New | Prove what the guest agreed | The life of the account; wording versions kept | Free text |
| Ledger | New | Receipts, undo, support | **Detail for 90 days after disembark, then counters only** (proposal; set by retention policy) | Message text, drafts |
| Rules (a guest's own) | New | Evaluate | To disembark plus 3 days | Anything about others |
| Practice-mode and shadow logs | New | Calibration | Aggregated, without ids after 30 days | Personal fields |

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

**This section replaces the phase tables in sections 8 and 13.** Sizes are relative effort (S about one week, M two to three, L four or more) for planning order only. As always, each phase commits and stops; server code is written with tests and run by the owner (targeted, never a full `dotnet test`).

### 27.1 Phases

| Phase | Scope | Size | Depends on | Done when |
|---|---|---|---|---|
| **R: Research and copy** | Section 16: wireframes, R1 to R5, level-name test, copy decisions; findings written into sections 11 and 12 | S | none (no code) | Gate **G0** passed |
| **P0: Explain what exists** | Welcome page rewrite (6.2, 6.3), Try-it chips, capability catalogue endpoint, **What Stanley can do** screen, example-works test, "AI" word test | M | R | A new guest sees what Stanley answers, does, watches and never does, and can try each in one tap |
| **P0a: Levels, permissions and checklist** | `StanleyPermissions`, consent history, step-up authentication, the enforcement point and its path test, level radio and ten-row checklist (welcome and Settings), Pause everything, empty-state for an account with nothing linked, helper and child rules | L | P0, R | Gate **G1** passed: the server refuses everything switched off, on every path |
| **P1: Stanley activity and receipts** | The ledger (typed fields only), the six-field receipt (19.1), Did, Watching, Remembers, undo, stop buttons, consent history view, "Why did you do that?" | M | P0a | A guest can see, explain and stop everything Stanley did or watches |
| **P2a, P2b: Reminders** | As in `stanley-reminders-requirements.md` | M, M | P1 | See that document |
| **P2c: Scheduler and arbiter** | Worker with a due-queue and leases, injectable clock, trigger types (time, change, inventory, state), arbiter (22.1), circuit breakers, kill switches, ship-alert suppression | L | P0a | A rule fires on time with the app closed; a storm is one card; a runaway class pauses itself |
| **P2d: Harness** | 23.1 and 23.2: fixtures, event scripts, goldens, invariant tests, rule-card format and its test | M | P2c (in step) | Every later phase adds cards and fixtures to this harness |
| **P3: Trip check-up and plan lint** | CHK-01, CHK-02, CHK-08 and the "Fix this" actions | M | P2c | Ranked findings with a fix each; no false alarm on a clean fixture |
| **P3a: Classifier flags** | Free, fee-free-until, only-me, reversible-until on dining, shows, excursions, services; the act-or-ask gate (19.6) | M | P2c | A paid or shared item can never be acted on at rung 4 |
| **P3b: Staff and operations** | Section 20: Guest Services view and case type, supervisor pause, venue tag, health, switches, breakers, replay, announcement | L | P1, P2c | Gate **G2** staff prerequisites met |
| **P3c: Offline and ship time** | Section 21: reminder mirroring, cached last results, queued confirms with re-validation, ship-time rules, time-zone fixtures | M | P2a, P2c | A guest offline at sea gets the right reminder and no blind applies |
| **P2b release** | Reminder delivery R3 with real push | M | real push | As in the reminders document |
| **P7 Briefs, P6 Value and bill, P4 Bundles and drafts, P5 Checklist concierge and smart defaults, P8 Missed-ship and group gaps** | As in section 8 (ACT-06, VAL-01, CHK-04, CHK-05, ACT-01, ACT-03, ACT-02, ACT-04, CHK-03, CHK-07) | M each | P3, P3a | As in section 8; all of these run under the arbiter |
| **P9a: Rules engine, practice mode, cross-journey rules** | Rung 3 engine, RUL-01 to RUL-04, RUL-06, watch-and-prepare (VAL-03, RUL-05 reworded), **practice mode** (19.2), level suggestions (19.3), plain-words control (19.4), week in review (19.5) | L | P3a, P3b, P2d | Gate **G2** passed (shadow, then canary) |
| **P9b: Manage and Prebook pack** | SR-4.x, SR-5.x, helper and needs packs | M | P9a | Each rule's fixtures and goldens pass; stage welcome ask offers them |
| **P9c: Get to the ship and Embark pack** | SR-6.x, SR-7.x | M | P9a | As above |
| **P9d: Sea, Port, Disembark pack** | SR-8.x, SR-9.x, SR-10.x, late-night guard, settle-up note | L | P9a | As above |
| **P9e: Family, solo, occasion and organiser packs** | Section 17.3 to 17.5 | M | P9b to P9d | As above |
| **P9f: Remember pack, then Dream, Discover, Book packs** | SR-11.x, then SR-1.x to SR-3.x (last; earn least) | M | P9a | As above |
| **P10a: Rung 4 safe classes** | AUT-01, 02, 05, 07 | M | P9a, **G3** | Gate **G3** passed; each class acts only on eligible items |
| **P10b: Rung 4 plan classes** | AUT-03, 06 | M | P10a | Undo rate under 5% for a full cohort season |
| **P10c: Rung 4 booking and staff classes** | AUT-08, then AUT-04, then AUT-09 | M | P10b, gate **G4** | Venue sign-off, no-show breaker proven, undo under 5% |
| **P11: Group, voice, shared briefs** | VAL-07, ACT-07, REM-D01 | M | P9 | A shared brief is posted only after the organiser confirms |
| **P12: Hardening and launch checks** (also run before each gate) | Manual screen-reader and 200% zoom pass, privacy and legal review of final wording, soak and cost report, chaos and red-team runs, S1 runbook rehearsal, support training | M | any gate | Section 29 targets met |

**Stop points that each stand alone:** after P0a (levels 1 and 2 mean what they do today and the guest can see and set them); after P3 and P7 (the best value for the least risk); after P9a (real standing rules at level 3); after P10a (the safest automation).

### 27.2 Gates (go or no-go)

| Gate | Before | Must be true |
|---|---|---|
| **G0** | P0a screens are final | Research R1 and R3 pass marks met, or the copy and defaults changed and re-tested |
| **G1** | Any rung 3 code path runs for a real guest | The permission path test passes; step-up works; consent history is written; the checklist passes the manual accessibility pass; privacy review signed off |
| **G2** | Rung 3 for guests | Staff view, switches, breakers and playbook live and rehearsed; shadow mode ran for at least two weeks with a wrong-prepare rate under 10%; canary at 1% then 10% each held for a week with abandon under 50% and no S1 or S2 |
| **G3** | Rung 4 for guests | Rung 3 undo and complaint numbers within target for a season; practice mode default on; classifier proven by the invariant tests; soak within the cost ceiling; legal review of consent wording; S1 rehearsal passed |
| **G4** | AUT-04, 08, 09 | Venue and stateroom operations agree in writing; no-show breaker proven; undo under 5% for AUT-01 to 07 |

### 27.3 Technical design notes (so the plan is buildable)

**Tables (SQL Server scripts in `db/`):** `StanleyPermissions` (account, ability, state, wording version, source, changed at, by), `StanleyConsentLog` (append only), `StanleyRules` (a guest's rules, template id, typed arguments, expires), `StanleyRuleDue` (the due queue: account, rule, due at, **idempotency key unique**, lease owner and expiry, state), `StanleyLedger` (typed receipt fields, rule, class, undo-until, outcome; no text), `StanleyClassState` (per account per class: paused, practice, counters, last undo), `StanleyBreaker` (per class and platform), `StanleyPractice` (would-have-done entries), `StanleyOpsFlags` (switches and cohorts), `StanleyNoShow` (counters).

**Scheduler:** a worker process (preferred) or hosted service sharing the same domain library as the API, claiming due rows with `UPDLOCK, READPAST` leases so several instances can run, an **injectable clock**, per-account serialisation, idempotency keys (rule, trigger, subject), retries with backoff, a dead-letter table, and a "ship alert" suppression read at every claim.

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

**Front end (thin):** one `useStanleyCapabilities` hook, one checklist component used by the welcome page and Settings, one receipt component used by the thread, Activity and the case view; no ability list in the bundle. Plain TypeScript modules for anything pure (the level-to-rows mapping the page uses for pre-ticking is **served by the server**, not hard-coded).

**Documents updated in the same change as each phase:** `stanley-data-inventory.md` (every new table and the retention), `audit-trail.md` (new event kinds), `runbook.md` (S1 to S4, switches, replay), `functional-requirements.md` and `requirements-clauses.md` (new requirement ids), `server/README.md` (endpoints), the Stanley welcome strings, and the test plans (a Stanley section for each: solo, family, friends).

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
| 12 | Simulated data (no real inventory) makes watches feel fake | M | M | Honest "as of" labels; rules say "tell me and line it up", never "hold"; the real provider swaps in behind the interface |
| 13 | Scope: this plan is large | H | M | Stop points (27.1), cut list (17.6), P9f and P10c last, each pack ships alone |

### 27.6 Launch and communication

- **Staff training** before G2: a one-page playbook (20.3) and a short walkthrough using the three test plans.
- **Guest explainer pages:** *What Stanley may and may not do* (public page, no "AI" wording), *How to turn things off*, *What happens if Stanley gets it wrong*.
- **In-app first-use lines** (never repeated), a "What is new from Stanley" note when an ability is added (one line, once, counts against the caps).
- **No overclaiming:** marketing and the welcome page never say Stanley "handles everything", never promise time saved we cannot measure, and always say he does not pay or cancel.

---

## 28. Further improvements to this area worth pursuing

Ranked inside each band; items marked **(P)** are parked until there are usage numbers.

### 28.1 Do soon (cheap, raise the quality of everything above)

| ID | Idea | Why |
|---|---|---|
| IMP-01 | **Pre-trip interview** (a two-minute conversation in Manage: pace, interests, dining style, late nights, party, anything Stanley should never do) | Feeds applies-when, AUT-04's usual table and plan quality; makes levels 3 and 4 feel right from day one. Answers are visible and forgettable memories |
| IMP-02 | **Rule cards generate the catalogue and the help page** | One source for the welcome page, Settings, the help page and tests; stops copy drifting from behaviour |
| IMP-03 | **Human review sample:** each week a product owner reviews 50 random acts and previews | Catches quality problems the counts miss |
| IMP-04 | **Game days:** rehearse S1 to S3 with a fake bad rule and a fake provider outage | The first real incident should not be the first practice |
| IMP-05 | **Trust pages** (27.6) published with the welcome page | Honest, easy to find, linkable by staff |
| IMP-06 | **Feedback chips on every item** (Good, Not for me, Too much, Stop) | The cheapest tuning signal there is |

### 28.2 Do with the main build

| ID | Idea | Why |
|---|---|---|
| IMP-07 | **Venue no-show loop** (counters to the venue view; auto-pause) | Protects staff and guests from automation noise |
| IMP-08 | **Booking-time email** explaining the levels with a link; consent captured only in the app | Gets guests thinking before the first sign-in |
| IMP-09 | **Preferences travel with the guest** across trips; grants do not | Better second trips with no re-consent risk |
| IMP-10 | **Per-traveller readiness score** feeding Stanley Next and the check-up | One honest measure the guest, the helper and staff all understand |
| IMP-11 | **Spoken level control** ("be quieter") through existing speech input | Helps guests who find forms hard |
| IMP-12 | **Anniversary and occasion memory** (visible and forgettable) | Improves the occasion pack |

### 28.3 Parked, with the reason **(P)**

| ID | Idea | Why parked |
|---|---|---|
| IMP-13 | Phone location as a trigger | A privacy cost the plan can avoid; ship position comes from ship data. Revisit only with explicit consent and a clear gain |
| IMP-14 | Spending on the guest's behalf under a cap | Breaks the ceiling; see decision 13 |
| IMP-15 | Read-only capability API for outside assistants (journey priorities note Princess is in external assistants) | Valuable, but it needs its own security review and no authority |
| IMP-16 | Anonymous "people like you did X" suggestions | Privacy and fairness risk; needs real volume |
| IMP-17 | Voice calls or messages to staff for the guest | Never; a person is reached through the existing hand-off |
| IMP-18 | Reading chats to trigger anything | Breaks "trip facts, not eavesdropping" (principle 4) |

---

## 29. Measures and gates (consolidated)

Sections 9 and 15 hold the first targets; this adds research and rollout.

| Measure | Target | Gate or review |
|---|---|---|
| Research R1: guests who say what they chose | 80% | G0 |
| Research R1: guests who say he cannot pay | 90% | G0 |
| Research R3: would still use level 3 or 4 after a mistake story | 80% | G0; under 60% makes practice mode the default |
| Welcome flow completion time | Under 60 s | Review if over 90 s |
| Guests who skip the checklist | Reported | Over 50%: flow too long |
| Wrong-prepare rate in shadow mode (a prepared fix the guest would not have wanted) | Under 10% | G2 |
| Rung 3 abandon (previews not confirmed) | Under 50% | G2 |
| Undo rate by rung 4 class | Under 5% | G3, G4; over 10% trips the breaker |
| Guest-reported errors per 1,000 acts | Under 2 | Any S3 reviewed |
| S1 and S2 incidents | Zero | Any halts the next gate |
| Duplicate or missed fires (soak and production) | Zero | Any is a defect |
| Model calls per guest per trip (by level) | Within 24.2 | Review at the first canary |
| Cost per guest per trip | Within the daily ceiling | Median rising week on week |
| Staff time to answer "what did Stanley do" | Under 2 minutes | Review if over 5 |
| Level 3 or 4 share | Reported | Under 10% or over 60% needs a look |
| Manual accessibility pass | Zero blockers | G1, G3 |

---

## 30. Decisions and open questions (round 3)

**Decided on my judgement (change if wrong; numbering continues from section 14):**

17. **Research comes first.** Run section 16 before the P0a screens are final; names, defaults and order may change from the result.
18. **Ownership rule (22.3).** Rung 4 touches only the account holder's personal items, with one exception: AUT-04 for the **booker acting on the booking**. Anything affecting another adult or a child stops at rung 3.
19. **Step-up to raise.** Raising to level 3 or 4, or enabling any rung 4 class, needs the emailed code; lowering needs nothing. Changes notify other devices and the email with a one-tap revert.
20. **Practice mode** is on by default for rung 4 classes and optional for rung 3 rules.
21. **Stanley never raises his own authority.** He may offer after three confirmations; the guest decides.
22. **Staff and operations (section 20) are a prerequisite of rung 3, not a follow-up.**
23. **Reservation quiet window** 07:00 to 22:00 ship time for any act that books something; reminders any time.
24. **Ledger retention** proposed as detail for 90 days after disembark, then counters only; confirm with the retention policy.
25. **Rollout** by shadow, then canary (1%, 10%, 50%, 100%), per class, with a small permanent holdback.
26. **Cut and fold** per 17.6; **add** the family, solo, helper, needs, occasion and organiser packs.
27. **No phone-location triggers** (IMP-13).
28. **Public explanation pages** ship with the welcome page (27.6).
29. **Scheduler is a worker** sharing the domain library, using SQL Server leases and an injectable clock (27.3), unless the owner prefers a hosted service in the API.

**Open for the owner:**

1. Who owns the **legal and privacy review** of the consent wording, and when (G1 and G3)?
2. Will **dining, spa and stateroom operations** be involved before AUT-04, AUT-08 and AUT-09 (G4)? If not, drop those three.
3. Should the **persona packs** (family, solo, occasion, organiser) ship in the first rung 3 release, or follow the stage packs? I recommend following.
4. **Where do research participants come from** (staff families, past guests, a panel)?
5. Do you want **Set A, B or C** level names tested, or all three?
6. Is **real push** on a date? P2b release and several notices depend on it.
7. Do you accept that **no phase after P2c starts until the owner has built and run the earlier Stanley server code** (risk 11)?

---

## 31. Requirement index

ACT-01 to 08 (save time), CHK-01 to 08 (catch issues), VAL-01 to 07 (get more), RUL-01 to 06 (rules), CL-01 to 10 (welcome checklist), AUT-01 to 09 (rung 4 classes), SR-1.1 to SR-11.6 (per-stage rules, section 12), SR-F.1 to F.7 (family pack), SR-S.1 to S.3 (solo additions), M1 to M18 (mistake scenarios, section 18), IMP-01 to 18 (further improvements), R1 to R5 (research), G0 to G4 (gates), plus REM-* in `docs/stanley-reminders-requirements.md`.
