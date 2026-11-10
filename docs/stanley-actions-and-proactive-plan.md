# Stanley beyond answers: actions, watching and proactive help

Status: **draft for review (2026-11-10).** Nothing here is built. It answers: *what can Stanley do for the guest other than answer questions, can he take actions, and what new proactive or suggestive help could save time, catch problems and get more out of the app?* It ends with phases and a proposal for explaining all of it on the Stanley welcome page.

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

1. **People decide, Stanley prepares.** Every change goes through the existing preview and confirm token. New capability widens *what he can prepare and watch*, not *what he may do unasked*.
2. **An autonomy ladder, with a hard ceiling** (section 3). Nothing above "reversible and pre-authorised" exists. Pay, cancel, change cabin, share data and message another person are **never** automated.
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
| 4 | **Pre-authorised and reversible** | For a short list of low-stakes, undoable actions the guest has explicitly allowed, Stanley acts and tells them, with an undo window | Move a **reminder** when its anchor moves; move a reminder when its anchor moves (the only rung 4 class) | Per-class switch (off by default), undo, activity ledger |
| Never | | Pay, cancel a booking, change cabin or cruise, share personal data, send a message to another person, answer for the guest to staff | | not available |

**Rung 4 candidates must meet all of:** free, reversible within the guest's own window, affects only the guest, no commercial effect, no data leaves the account. The initial list is short on purpose (reminders that follow a moved anchor). Anything else needs a new decision.

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
| **Check-up and lint inputs** | The same PII-free facts the packet already allows; documents are read as validity facts (expiry date, match yes or no), never document numbers |
| **Sensitive needs** | Mobility, diet and allergy stay off by default and reach a model only when switched on; checks that use them run on the server by rule, not by model |
| **Notices** | Delivered under the thread's lanes, quiet hours, calm mode and budget; critical list is small, published and under change control; a `Bypass` without a safety or deadline reason fails a gate test |
| **Kill switches** | Per capability and per lane; a runaway rule engine can be stopped without touching critical delivery |
| **Model cost** | Rule evaluation and checks are code, not model calls; only wording and planning use a model, on the existing tiers and daily ceiling |
| **Prompt-injection** | Rules and drafts take typed fields; free text a guest enters (reminder text, a draft) is data in a delimited block and never an instruction |
| **Audit** | The audit trail records action kind and outcome only |

---

## 8. Phases (commit and stop after each; server code is written with tests and run by the owner)

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

4. **Standing rules: build, but narrow and late.** Rules are the most powerful and riskiest idea, so P9 ships only rung 3 (Stanley *prepares and tells*, the guest confirms) with four templates: RUL-01 replacement for a cancelled or moved excursion, RUL-02 keep my dinner if the show moves, RUL-03/04 tell me when check-in opens or tenders are delayed, RUL-06 reminder before formal night. **RUL-05 (hold a table) and VAL-03 (availability watch) are dropped for now** because the catalogue has no real availability to hold, and a "hold" that is not real would break the honesty rule. Rung 4 shrinks to one class: **reminders that follow a moved anchor.** P9 only starts after P3 and P7 have shown usage numbers.
5. **Order.** Reminders first within the first slice: **P0, P1, then reminders R1 and R2, then P3**, with reminder delivery (R3) built after P3 and released only when real push exists. This lets the explanation, the control screen and the better creation flow land without waiting for the push deployment.
6. **Briefs and nudges:** off until the guest chooses, except the check-in and payment notices that already exist; Stanley offers the morning brief once, at the end of Embark.
7. **Value finder (VAL-01):** strictly "what you already have". Paid options appear only if the guest asks "what else is there?".
8. **Check-up depth (CHK-01):** document-validity and name-match rules are mocked behind an interface now, with the rule table authored per country, labelled in the card as the rule applied ("6 months beyond return"), and never described as an official check.
9. **The ceiling (section 3)** stands as written: rung 4 only for free, reversible, own-account actions; never pay, cancel, change cabin, share data or message another person.

**Revised order:** P0, P1, P2a (reminders R1 and R2), P3, P2b (reminders R3, released with real push), P7, P6, P4, P5, P8, P9, P10, P11.

---

## 11. Requirement index

ACT-01 to 08 (save time), CHK-01 to 08 (catch issues), VAL-01 to 07 (get more), RUL-01 to 06 (rules), plus REM-* in `docs/stanley-reminders-requirements.md`.
