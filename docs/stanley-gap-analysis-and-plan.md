# Stanley: gap analysis and phased implementation plan

Status: **draft for review (2026-11-09).** Nothing here is built yet. It compares `docs/princess_cruises_stanley_ai_strategy_requirements.md` (the "strategy document", dated 7 Nov 2026) with the code in this repository, and proposes the phases that would close the gaps and add more.

Follows the working rules in `CLAUDE.md`: phases, commit and stop after each, English only, backend mocks every external service behind an interface, verify with `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` only (no browser testing, no full `dotnet test`).

## How to read this

- **Evidence.** I read the strategy document in full, `docs/stanley-plan.md`, every module in `src/ai/`, the Stanley components in `src/ui/ai/`, the server's `StanleyService`, `StanleyRules`, `StanleyFacts`, `ConciergeRules` and the Stanley endpoint, and the baseline matrix (`docs/best-in-market-matrix.md`, rows AST-01 to AST-08). For features outside Stanley (plan, autopilot, cases, folio, polls, route finder, packing) I confirmed by search that the screen or module exists; I did not audit its quality.
- **Status words.** *Built* = Stanley does it as the requirement reads. *Partial* = something real exists, but it is not what the requirement asks (very often: **the feature exists in the app but Stanley cannot see, explain or act on it**). *Missing* = nothing found.
- **Caveat.** Status in section 4 is my reading of the code, not a test run. Where I only confirmed that a related screen exists, I say Partial. Spot-check anything that decides a phase's scope.

---

## 1. Headline findings

1. **The cheap, safe front half of the strategy is largely done.** Persona, four-level Quiet Stanley, authored library (129 general entries plus about 890 page-specific Q&As in `en.ts`), page chips, Stanley Next, five journey modes, explainers, coach tours, milestone moments, storyteller, word filter, safety screen, topic gate, PII-free trip facts, confirm-before-change card. This is Wave 0 and part of Wave 1 of the strategy.
2. **The real gap is the middle: there is no Stanley gateway.** Today the *browser* decides which source answers (`stanleyRoute.ts`: regex word lists, then the library, then one of four back ends). The server's `/me/stanley` is a thin chat with no tools and a PII-free facts block. The "trip" and "before" answers come from a *different* endpoint (`/me/concierge`) with seven read-only tools. There is no one place that applies policy, picks a model, logs a tier, enforces a kill switch or builds a context packet (strategy sections 8.2, 9.1, 9.4, 10.4).
3. **Stanley cannot see the guest's plan.** The server facts cover sailing, ports, tours, dinners and packages only. The plan, checklist, folio, entitlements, open cases and reservations that the app already holds are invisible to him, so questions like "what changed?", "what do I still owe?", "is this included for me?" fall to a regex route or a model that guesses.
4. **Actions are regex-parsed in the browser.** `isActionRequest` fires on words like "add", "move", "skip", "remove". "What should I add to my packing list?" is treated as a change request. There is no typed intent, no server-held preview, no confirmation token scoped to a preview, no idempotency key, no receipt tied to the Trust Ledger (strategy 5.3, STN-BOK-04, Wave 3). Only three action types exist (plan change, order an item, add an excursion).
5. **Human handoff is half-built.** `HandoffCard` (consent-style summary, edit, send) exists but is **not mounted anywhere** (only a text test reads the file). The Stanley dialog just links to the Chat tab. Strategy 7.8 and AST-06 call this Built; it is not reachable.
6. **Provenance is thinner than it looks.** Every answer shows "as of {time}", but the time is *when Stanley replied*, not when the underlying data was last updated (`StanleyDialog.tsx`, `new Date(m.at)`). There is no expandable "Based on" detail, no live/cached/estimated/simulated flag, no abstention rule by topic.
7. **No memory the guest can see.** `MemoryScreen` is the trip keepsake book. There is no "what Stanley remembers and why", no per-preference scope (this trip / future trips), no forget, and preferences are scattered (pilot prefs, access profile, `fit`, concierge `likes`). The chat thread lives in browser memory only and is lost on refresh and across devices (conflicts with the "guest can move between devices" principle in `CLAUDE.md`).
8. **Proactive recovery is the strategy's biggest bet and is mostly absent.** The Autopilot is a one-shot *week optimiser* (`AutopilotService`), the Disruption Hub is authored scenario content, and TripWatch covers instalments, tender outlook and one flight. There is no canonical change-event model, no impact assessment against the guest's plan, no "what changed / why it affects you / recommended / other options / confirm" card, no severity ranking or quiet hours for Stanley.
9. **Governance is the thinnest area.** No versioned evaluation set, no content metadata (owner, review date, expiry, risk, scope) on library entries, no per-route kill switch, no prompt-injection test corpus, tier counts are kept on the device only (no aggregate cost or helpfulness view), and the "Was that helpful?" prompt was removed (commit `39bcb35`), so the strategy's outcome feedback step has no signal.
10. **Two product decisions conflict with the strategy document** and need your call before building (section 7): AI disclosure (commit `39b5177` removed AI wording; the strategy requires AI answers to be labelled) and outcome feedback (removed; the strategy wants it).

---

## 2. What exists today (baseline)

| Area | What is built | Where |
|---|---|---|
| Entry points | Left-nav button (desktop), round button in the top bar (phone), prefill API so any screen can open Stanley with words ready, speech dot for urgent reasons | `Shell.tsx`, `stanleyOpen.ts`, `stanleyDot.ts` |
| Levels | Chatty / Helpful / Only when asked / Off; calm and simple mode cap at "asked" | `StanleySettings.tsx`, `settings.ts` |
| Chat | Dialog with focus trap, typing indicator, 3-words-at-a-time reveal (a device-side effect, not server streaming), cooldown after 3 blocked replies, follow-up chips | `StanleyDialog.tsx`, `stanley.ts`, `stanleyFollow.ts` |
| Server pipeline | Word filter, safety screen (emergency/medical/legal/person), shared hourly limit (20), topic prescan, answer with trip facts, scripted fallback with no model | `Stanley.cs`, `StanleyRules.cs`, `StanleyFacts.cs`, `StanleyTripLoader.cs` |
| Library | 129 general entries across the 11 stages, about 890 page-specific Q&As, fuzzy local match, "Show me" links, related-page links | `stanleyLibrary/`, `en.ts` |
| Routing | Safety screen, library, action request, ship fact, before-booking assistant, trip assistant, open model | `stanleyRoute.ts`, `StanleyDialog.tsx` |
| Concierge | Seven read-only tools: sailings, itinerary, port, excursions, restaurants, build_day, my_trip | `ConciergeRules.cs`, `Concierge.cs` |
| Next step | Rules-only "what should I do next?" with urgent reasons | `stanleyNext.ts`, `StanleyNext.tsx` |
| Modes | Boarding Day, First Four Hours, Sea Day (Right Now), Port Day, Last Morning, with walk minutes from the deck graph and a port-day buffer | `stanleyModes.ts`, `StanleyModeScreen.tsx` |
| Asks | One-question-at-a-time cabin chooser and quiz, "why we ask" lines on booking steps | `stanleyAsk.ts`, `StanleyAsk.tsx` |
| Explain | `?` help tips and plain-language explainers | `StanleyExplain.tsx`, `HelpTip` |
| Coach | Spotlight tours on 5 screens | `StanleyCoach.tsx`, `coachSpotlight.ts` |
| Moments | 11 milestone celebrations that can add a diary line | `stanleyMoments.ts`, `StanleyMoment.tsx` |
| Storyteller | Template-based day-note drafts from a chosen "favourite bit"; never overwrites guest text | `stanleyStory.ts`, `StanleyStoryteller.tsx` |
| Confirm | Preview and Confirm for a plan change, an item order or an excursion add, with 2-hour undo for plan changes | `StanleyConfirm.tsx`, `planChange.ts` |
| Diagnostics | Tier counts on the device only (no text kept) | `stanleyTiers.ts` |
| Related app features Stanley could build on | Autopilot week and day optimiser, plan changes, polls (`board.ts`), disruption hub, route finder on the deck graph, packing, excursion fit, entitlements, folio and ledger split, Trust Ledger, cases screens, trip watch (instalments, tender, flight), accessibility profile, trip diary, memory book, offline capsule, local reminders, speech recognition in Ask, read-aloud | see `docs/best-in-market-matrix.md` |

---

## 3. Architecture gaps (cross-cutting)

These cause most of the Partial rows in section 4, so they come first in the plan.

| # | Gap | Strategy reference | Effect |
|---|---|---|---|
| A1 | Routing and tiering run in the browser with regex word lists; the server has no gateway | 8.2, 9.1 | No central policy, logging, kill switch or model choice; brittle intent detection; each route behaves differently |
| A2 | Two AI endpoints (`/me/stanley`, `/me/concierge`) with different rules and limits | 1.2, 9.1 | The guest "talks to Stanley" but gets different knowledge depending on a client guess |
| A3 | No context packet: stage, current screen, active voyage and guest role are not sent | 9.4, 1.1 | Cannot answer "this page" or "this trip" questions reliably; cannot guarantee he never switches voyage |
| A4 | The model has no typed tools over the plan, folio, entitlements, cases or checklist | 9.3 | Cannot ground plan, money or case answers |
| A5 | No action orchestration layer (interpret, check, prepare, confirm token, execute, reconcile, receipt) | 5.3 | Actions are client-side string parsing; cannot extend safely |
| A6 | No server-held voyage memory or persisted thread; no memory UI | 5.4 | Cannot resume on another device; guest cannot see or delete what is remembered |
| A7 | Freshness shows reply time, not data time; no provenance model; no abstention rules | 5.5, 5.6 | Looks sourced but is not |
| A8 | No change-event model or impact engine | 7.1, 7.2 | No Voyage Autopilot, no "explain this change" |
| A9 | No evaluation set, content metadata, kill switch or injection corpus; tier counts device-only | 8.5, 10 | Cannot prove quality or control risk |
| A10 | `HandoffCard` unmounted; no case receipt in Stanley; no "where is my request" | 7.8 | Strategy's "feels continuous" handoff unreachable |
| A11 | Streaming is simulated on the device | 8.3 | Slow first word on ship Wi-Fi for long answers |
| A12 | Thread, memory and feedback are device-local while `CLAUDE.md` says the client keeps no data store | CLAUDE.md | Needs a decision on what moves server-side (section 7) |

---

## 4. Requirement-by-requirement comparison

Phase column refers to section 5. "S" = Stanley wiring only, "F" = feature work as well.

### Stage 1 Dream

| ID | Pri | Status | What exists | Gap | Phase |
|---|---|---|---|---|---|
| STN-DRM-01 | P1 | Partial | Quiz and cabin chooser as one-question-at-a-time Asks; Back/Skip | Choice-only; free-text answers are not understood | 8 |
| STN-DRM-02 | P1 | Missing | Free text goes to the model as prose | No structured output into editable search filters, no listed assumptions | 8 |
| STN-DRM-03 | P1 | Built | Dream library entries and explainers | Content metadata and review dates (phase 2) | 2 |
| STN-DRM-04 | P1 | Missing | Quiz gives one result | At least two distinct directions with trade-offs | 8 |
| STN-DRM-05 | P2 | Partial | Dream board and planning polls (`planning` state) | Share brief that omits sensitive needs by default | 8 |
| STN-DRM-06 | P2 | Partial | Occasion filter, wanted places | Low-pressure interest-based inspiration linked to catalogue | 8 |

### Stage 2 Discover

| ID | Pri | Status | What exists | Gap | Phase |
|---|---|---|---|---|---|
| STN-DSC-01 | P0 | Partial | Concierge tools return catalogue facts | Model writes the prose; no per-claim record link; freshness not shown | 4, 3 |
| STN-DSC-02 | P1 | Partial | Compare saved sailings screen | Stanley cannot drive or explain it; no adjustable weights | 8 |
| STN-DSC-03 | P1 | Missing | Port times in itinerary data | Generated trade-off summary from real port hours and tender flags | 8 |
| STN-DSC-04 | P1 | Partial | Cabin chooser, cabin score and comfort | Evidence and confidence labels; exact vs category | 8 |
| STN-DSC-05 | P1 | Partial | Trip cost, offer compare, packages | Stanley explanation by traveller, assumptions shown | 12 |
| STN-DSC-06 | P2 | Missing | None | "If you value X choose Y" with changeable ranking | 8 |
| STN-DSC-07 | P2 | Partial | Excursion fit UI | Stanley check against actual call and party; human verification route | 9 |
| STN-DSC-08 | P2 | Missing | Saved sailings only | Resumable decision brief across devices | 8 |

### Stage 3 Book

| ID | Pri | Status | What exists | Gap | Phase |
|---|---|---|---|---|---|
| STN-BOK-01 | P0 | Built | Why-we-ask lines, explainers on booking steps | None found | - |
| STN-BOK-02 | P0 | Partial | Field validators in the booking flow | Stanley flags likely name/date mistakes; validator stays the judge | 8 |
| STN-BOK-03 | P0 | Partial | `plainSummary.ts`, review step | Stanley-spoken summary built from the final preview | 3 |
| STN-BOK-04 | P0 | Partial | Confirm card for plan/order/excursion only | Server preview with confirmation token and expiry; booking and payment never run by Stanley | 5 |
| STN-BOK-05 | P0 | Partial | Payment plumbing and idempotency on the server | Stanley reads transaction status and refuses to suggest a second payment while unknown | 3, 5 |
| STN-BOK-06 | P1 | Partial | `HandoffCard`, unmounted | Mount it with the booking draft summary | 6 |
| STN-BOK-07 | P2 | Partial | Cost guard-rails on the trip cost page | Illustrative scenarios from the pricing service | 12 |

### Stage 4 Manage

| ID | Pri | Status | What exists | Gap | Phase |
|---|---|---|---|---|---|
| STN-MNG-01 | P0 | Partial | Checklist, Stanley Next, check-in | Per-traveller readiness with owner and due date, answered in chat | 3 |
| STN-MNG-02 | P0 | Partial | Document screens and library | Official source and verification date on each document answer | 3 |
| STN-MNG-03 | P0 | Partial | Party roles and helper access | Group summary respects traveller permissions in Stanley answers | 4 |
| STN-MNG-04 | P1 | Partial | `packing.ts` | Itinerary-aware plan with forecast horizon, drafted by Stanley and editable | 10 |
| STN-MNG-05 | P1 | Partial | Money pages, ledger split | Posted/pending/forecast kept distinct in answers | 12 |
| STN-MNG-06 | P1 | Partial | Requests with case reference and team | Submitted vs acknowledged vs fulfilled stated by Stanley | 6 |
| STN-MNG-07 | P2 | Missing | Group board | "What remains" task-level summary for the organiser | 9 |

### Stage 5 Prebook

| ID | Pri | Status | What exists | Gap | Phase |
|---|---|---|---|---|---|
| STN-PRE-01 | P0 | Partial | Day and week optimiser on real catalogue and programme | Stanley builds from the guest's *actual* reservations | 4, 9 |
| STN-PRE-02 | P0 | Partial | Plan change refusals, autopilot timing | Hard vs soft conflicts, "ready" label blocked | 9 |
| STN-PRE-03 | P1 | Partial | Interest preferences, day wishes | Each suggestion explains fit, price, duration, cancellation | 9 |
| STN-PRE-04 | P1 | Partial | `entitlements.ts` | One entitlement service Stanley can call per traveller | 4, 12 |
| STN-PRE-05 | P1 | Partial | Polls and board; Stanley can prefill a poll | Expiry, reminders, owner controls, no silence-as-consent | 9 |
| STN-PRE-06 | P1 | Partial | Accept change keeps base until accepted, undo 2 hours | Server-side substitute flow with confirmation token | 5 |
| STN-PRE-07 | P1 | Partial | Allergy pre-flag, requests | Receipt and crew acknowledgement shown; never "safe" | 6 |
| STN-PRE-08 | P2 | Partial | Day wishes (pace, interests) | Pace scenarios in chat, editable result with assumptions | 9 |
| STN-PRE-09 | P2 | Partial | Change preview | Whole-plan consequences: new conflicts, lost options, price, deadline | 9 |

### Stage 6 Get to the ship

| ID | Pri | Status | What exists | Gap | Phase |
|---|---|---|---|---|---|
| STN-GTS-01 | P0 | Built | Boarding Day mode from check-in and arrival window | None found | - |
| STN-GTS-02 | P0 | Partial | Boarding pass, offline QR | Stanley states pass state only from authoritative status | 3 |
| STN-GTS-03 | P0 | Partial | Delay screen, contacts, handoff screen | Dedicated missed-ship path with verified numbers and message draft | 6 |
| STN-GTS-04 | P1 | Partial | Flight and tender watch on server | Stanley explains and offers alternatives with provider and timestamp | 10 |
| STN-GTS-05 | P1 | Built | Stanley Next, mode list | None found | - |
| STN-GTS-06 | P2 | Missing | None | Disruption summary the guest reviews and sends to agent/port team | 6 |

### Stage 7 Embark

| ID | Pri | Status | What exists | Gap | Phase |
|---|---|---|---|---|---|
| STN-EMB-01 | P0 | Built | First Four Hours mode with muster state | None found | - |
| STN-EMB-02 | P0 | Built | Muster screens separate; safety screen precedes any answer | Add a test that muster text never routes through a model | 2 |
| STN-EMB-03 | P1 | Partial | Route finder on the deck graph, walk minutes | Stanley answers "how do I get to the theatre" with that route and flags no verified accessible route | 4 |
| STN-EMB-04 | P1 | Partial | Embark delights | Goal-based orientation (essentials/family/dining/quiet/access) | 10 |
| STN-EMB-05 | P1 | Partial | Requests with case ref, owner; no photo | Stanley drafts, guest reviews text and photo, receipt follows | 6 |
| STN-EMB-06 | P2 | Missing | Coach tours on five screens | Optional ship-literacy mini tour with text map | 15 |

### Stage 8 Sea

| ID | Pri | Status | What exists | Gap | Phase |
|---|---|---|---|---|---|
| STN-SEA-01 | P0 | Partial | Sea Day mode shows next planned events with walk | Source and data time on each part; venue hours | 3 |
| STN-SEA-02 | P0 | Partial | Ship facts, programme changes | Disclose stale or unavailable feeds | 3 |
| STN-SEA-03 | P0 | Partial | Bill screen, folio, ledger split | Chat summary with posted/pending/disputed/estimated | 12 |
| STN-SEA-04 | P0 | Partial | Requests, escalate, reopen | Draft in chat, submit on approval, show owner/status/ETA | 6 |
| STN-SEA-05 | P1 | Partial | Library entry "three hours", day plan | Real options for a free window with reach time and entitlements | 9 |
| STN-SEA-06 | P1 | Partial | Program changes flow into day plan | "What changed / what is affected / alternatives" card; never auto-cancel | 11 |
| STN-SEA-07 | P1 | Partial | Order service and entitlements | Order preview with delivery location, timing, substitutions | 5 |
| STN-SEA-08 | P1 | Missing | None | "Quiet", "nearby", "good for children" mapped to explicit data; no fake occupancy | 9 |
| STN-SEA-09 | P2 | Missing | None | "Three ways to spend the next hour", each real and reachable | 9 |
| STN-SEA-10 | P2 | Partial | Diary and recap | Opt-in daily recap in chat from approved events | 13 |

### Stage 9 Port

| ID | Pri | Status | What exists | Gap | Phase |
|---|---|---|---|---|---|
| STN-POR-01 | P0 | Built | Port Day mode on all-aboard and ship clock | Label ship/local/device time in chat answers | 3 |
| STN-POR-02 | P0 | Built | Port pilot with buffer, return plan | Explicit assumptions in the card; "ship will not wait" wording check | 3 |
| STN-POR-03 | P0 | Partial | Contacts, handoff screen | Verified local contact lookup per port in chat | 6 |
| STN-POR-04 | P1 | Partial | Port guides, offline capsule | Independent itinerary builder with time budget and offline pack | 10 |
| STN-POR-05 | P1 | Partial | Phrases on the port guide | Labelled machine vs reviewed; "show this to a person" card | 10 |
| STN-POR-06 | P1 | Partial | Excursion fit | Risk trade-offs with access evidence | 9 |
| STN-POR-07 | P1 | Partial | Tender and weather feeds | Replan only on verified alert, guest approves | 11 |
| STN-POR-08 | P2 | Missing | None | Camera-assisted sign/menu translation (guest-initiated) | 10 |
| STN-POR-09 | P2 | Partial | Port moment adds a diary line | Stanley asks what to remember; no location or photo shared | 13 |

### Stage 10 Disembark

| ID | Pri | Status | What exists | Gap | Phase |
|---|---|---|---|---|---|
| STN-DEB-01 | P0 | Built | Last Morning mode | None found | - |
| STN-DEB-02 | P0 | Partial | Folio screens, history | Explain line items in chat; dispute creates tracked case | 12 |
| STN-DEB-03 | P0 | Partial | Customs library entries and screen | Official-source links with jurisdiction labels; no model-only answers | 10 |
| STN-DEB-04 | P1 | Partial | Onward travel screens | Tight-connection assessment with visible assumptions | 10 |
| STN-DEB-05 | P1 | Built | Cases screen, lost-item flow with photos, team and due time | Start from Stanley with a drafted case | 6 |
| STN-DEB-06 | P2 | Partial | Offline capsule | Departure pocket card, printable | 15 |

### Stage 11 Remember

| ID | Pri | Status | What exists | Gap | Phase |
|---|---|---|---|---|---|
| STN-REM-01 | P1 | Built | Storyteller (template drafts, never overwrites) | Optional richer drafts (phase 13) | 13 |
| STN-REM-02 | P1 | Partial | Recap and wrapped screens | Per-milestone source, remove/correct in a Stanley recap | 13 |
| STN-REM-03 | P1 | Partial | Album and media with sharing rules | Stanley help organising selected photos; no default face recognition | 13 |
| STN-REM-04 | P0 | Missing | Cases exist | Suppress rebooking prompts while a serious case is open; show case status | 13 |
| STN-REM-05 | P1 | Partial | History and loyalty pages | Source-owned balance, tier, expiry explained | 12 |
| STN-REM-06 | P2 | Partial | Want-next, sail-again group | Explainable next-voyage recommendation from kept preferences | 13 |
| STN-REM-07 | P2 | Missing | None | "Which preferences carry to next cruise" with scope | 7 |
| STN-REM-08 | P2 | Partial | Memory book | Voyage Story in three versions (private, family, export) | 13 |

### Cross-stage signature experiences (strategy section 7)

| Item | Status | Gap | Phase |
|---|---|---|---|
| 7.1 Voyage Autopilot | Partial | Week optimiser only; no event model, impact assessment, severity ranking, quiet hours or confirm card | 11 |
| 7.2 Explain this change | Partial | Disruption Hub is authored scenarios; needs structured change events answering all six questions | 11 |
| 7.3 Group Trip Diplomat | Partial | Polls and board exist; no poll expiry, reminders, compromise suggestions, availability aggregation | 9 |
| 7.4 Accessibility-aware planner | Partial | Access profile and step-free flags exist; no sourced attributes with verification date and confidence, no "verified vs reported vs unknown" separation, no printable large-text plan | 9, 15 |
| 7.5 Entitlement and spend coach | Partial | Entitlements, budget and ledger exist; Stanley cannot answer "is this included for me?" | 12 |
| 7.6 Proactive, not noisy | Partial | Dot and moments exist; no three-mode proactivity setting ("only what affects my trip / offer suggestions / guide me through everything"), no severity table | 7, 11 |
| 7.7 Multilingual bridge | Deferred | Out of scope by `CLAUDE.md` (English only for now). "Show this to crew" cards in English are in phase 6 | later |
| 7.8 Human handoff | Partial | Card unmounted; no case follow-through in chat | 6 |

### AI architecture, security and quality (sections 5 and 8 to 10)

| ID / topic | Status | Note | Phase |
|---|---|---|---|
| 5.1 Response ladder, tier logging | Partial | Tiers exist on the client; server logs none; counts device-only | 1 |
| 5.2 Model limits (no invented facts) | Partial | Prompt rules only; no checks that numbers in an answer come from a source | 3, 4 |
| 5.3 Action lifecycle | Partial | See A5 | 5 |
| 5.4 Memory | Missing | See A6 | 7 |
| 5.5 Grounding and freshness | Partial | See A7 | 3 |
| 5.6 Abstention by topic | Missing | High-risk topics (deadlines, tender, payment, access) need an explicit "cannot confirm" rule | 3 |
| 8.3 Reviewed library | Partial | Volume met; no owner, review date, scope, risk, expiry | 2 |
| 8.3 Deterministic resolvers (25 to 40) | Partial | Roughly 8 exist, scattered across `stanleyNext`, `stanleyModes`, `answerCards`, `stanleyFacts` | 3 |
| 8.3 Response cache | Missing | Authored answers are static in the bundle; no server cache for public content | 1 |
| 8.3 Model routing (small vs large) | Missing | One model client; prescan is a second call to the same model | 4 |
| 8.3 Prompt and output limits | Partial | Brief-answer rule; no structured card output | 3 |
| 8.5 Cost metrics | Missing | Device counts only | 1, 2 |
| AI-SEC-01 Permissions outside the LLM | Partial | Safe today because Stanley has no tools; must be built into the tool gateway before tools arrive | 4 |
| AI-SEC-02 Data minimisation inventory | Partial | `StanleyTrip` is PII-free by construction; no written data inventory | 4 |
| AI-SEC-03 No payment data in prompts | Built | Plus add a test that scans prompts and logs | 2 |
| AI-SEC-04 Minors and linked cabins | Partial | `child` check in confirm; no cross-party tests for Stanley | 4 |
| AI-SEC-05 AI disclosure and memory controls | Partial | Prompt says "AI if asked"; UI label removed; no memory controls | 7 and decision |
| AI-SEC-06 Prompt injection | Partial | Prompt rules and prescan; no corpus, no tests | 2 |
| AI-SEC-07 Provider retention terms | Out of code | Needs a decision record | 7 (docs) |
| AI-SEC-08 Privacy-safe diagnostics | Partial | Device-only; add server aggregate by tier/topic/outcome | 1 |
| AI-SEC-09 Review before sharing | Partial | `HandoffCard` has it; unmounted | 6 |
| 9.7 Offline and degraded mode | Partial | Library offline in bundle, on-device safety screen; need cached trip facts with cached-at, reconcile-before-retry, visible "Ask a crew member" fallback | 3, 6 |
| 10.1 Evaluation set | Missing | Unit tests per module only | 2 |
| 10.3 Content ownership fields | Missing | See above | 2 |
| 10.4 Incident handling, kill switches | Missing | No way to turn off one route or tool | 1 |
| Outcome feedback (8.2 step 10) | Missing | Removed from UI; the device store `stanleyFeedback.ts` is still present | decision, 2 |

**Tally** (the 82 STN requirement rows in the stage tables, counted from them): Built 11, Partial 58, Missing 13. Most Partial rows are features the app already has that Stanley cannot yet see, explain or act on.

---

## 5. Phased implementation plan

Each phase is a build phase under the `CLAUDE.md` rule: do it, run the npm checks, commit, **stop** so you can `/clear`. Server code is written to the same standard as the existing server, with xUnit tests written but not run here. External sources stay mocked behind interfaces. Sizes: S about a session, M about two, L three or more.

The order follows the strategy's own sequencing principle ("earn trust before autonomy"): gateway and governance first, then grounded answers, then actions, then proactivity.

### Phase 1: Stanley Gateway on the server (L)

**Goal.** One server door for Stanley, so policy, tiering, logging and kill switches live in one place.
- `POST /me/stanley/v2` (or evolve `/me/stanley`): accepts message, thread, **context packet** (stage, screen id, selected sailing id, level), returns a typed reply: `{ tier, kind, blocks[], actions[], sources[], handoff?, receipt? }`. Old reply shape stays readable.
- Move the routing now in `stanleyRoute.ts` to the server as `StanleyRouter`: safety, word filter, library lookup id, resolver, structured search, grounded model, action, handoff. The browser keeps the offline library, the on-device safety screen and rendering.
- Retire the concierge as a separate AI (decision 4): move its seven tools behind the same door, switch the Concierge screen to call the gateway, then delete `/me/concierge` and its separate rules and limits once nothing calls it. The old reply shape stays readable until that switch is done.
- Model tiers and budget from decision 6, in server configuration: small, default and large model names, per-request call caps, per-tier token caps, the per-guest daily ceiling, and the order of attempts (deterministic first). When a cap is hit the reply says so and comes from the deterministic tiers.
- Server tier log: counts by tier, stage, topic, outcome and token cost, **no message text** (AI-SEC-08). Aggregate endpoint for the diagnostics page.
- Per-route kill switches in configuration (library, resolver, model, actions, handoff) and a visible degraded state.
- Cache for public ship and port content by version.
- **Closes:** A1, A2, A3, 5.1, 8.3 cache, 8.5 (start), 10.4, AI-SEC-08.
- **Acceptance.** Browser holds no regex routing; a request with the model switched off still answers from library and resolvers; a tier log row exists for every reply, including model tier and token cost; the Concierge screen works through the gateway and `/me/concierge` is gone; exceeding a call cap or the daily ceiling produces the deterministic fallback; tests cover each route, each switch and each cap.
- **Status (2026-11-09): built; server tests written, not run here.** Carried over: the browser keeps the `act` word list until phase 5 and ship-fact keywords (authored content); the `handoff` kill switch arrives with phase 6; `actions` and `library` switches are read by the device from `GET /me/stanley/status`; the reply's `actions[]` and `receipt` fields arrive with phases 3 and 5; the tier log has no retention job yet.

### Phase 2: Evaluation and content governance foundation (M)

**Goal.** Build the safety net before widening what the model can do (strategy 10.1: "build an evaluation set before expanding the model").
- Versioned eval set (JSON) of 200+ guest questions across the 11 stages with expected tier, expected source, must-abstain and must-handoff flags; includes permission, stale-data, time-zone, tender/all-aboard and injection cases.
- Vitest runner for the client parts (library match, safety screen, ship facts, modes); server fixtures for the router with a stub model.
- Content metadata on every library entry: owner, review date, expiry, risk level, ship/sailing scope, fallback. A test fails when an entry is past expiry.
- Prompt-injection corpus (guest text, port descriptions, menu text) and a test that retrieved content never changes tools or policy.
- Tests that muster and emergency text never route through a model; that no PAN/CVV pattern reaches a prompt or log.
- Tier mix, model-call share and repeat-question view on the Diagnostics page (aggregate from phase 1). No per-answer thumb (decision 2).
- Eval cases for the retired concierge's questions (sailings, itinerary, port, excursions, restaurants, build a day) so the merge in phase 1 cannot lose capability.
- **Closes:** 10.1, 10.3, AI-SEC-03, AI-SEC-06, STN-EMB-02 check, STN-DRM-03.
- **Acceptance.** `npm run test` fails on a regression in any eval case; library coverage report shows entries missing metadata = 0.
- **Status (2026-11-09): built; server tests written, not run here.** The set is `src/ai/eval/cases.json` (261 cases over the eleven stages, one per library entry in its own words plus about 130 written ones) with `injection.json` (24 examples in guest, port, menu and excursion text); `src/ai/eval/eval.test.ts` runs the device half through `decideStanley` (`src/ai/stanleyDecide.ts`, now the one place the dialog's order of steps lives) and `server/Princess.Api.Tests/StanleyEvalTests.cs` reads the same file for the router, the safety screen, the word filter, muster, card numbers and the injection checks with a stub model. Library metadata is in `src/ai/stanleyLibrary/governance.ts` (derived by stage and a high-risk list, not stored per entry); `governance.test.ts` fails on an expired entry. What the set found and fixed: the library's stop words were applied after stemming (so "does" matched "does"), a hint word counted twice, a one-word question answered a long sentence, "child is missing" and "liable" were not screened, "emergency muster drill" was taken for an emergency; matches on a risk topic now need a high-risk entry and a question about now or the guest's own booking goes to the server; a plain change request ("move dinner") goes to Ask your cruise ahead of a library explainer; muster questions are answered only by the authored entry or the server's fixed answer; card numbers and codes are masked on the device and again on the server. Carried over: per-answer expected sources and `abstain` wording are recorded as tags and checked only for library answers until phase 3 builds provenance and resolvers; the Diagnostics tier mix, model-call share and repeat-question view are per device (the server's `GET /me/stanley/tiers` has no screen yet); `dream.seasick` is unreachable as a chip because the medical screen takes it first, listed in the eval test.

### Phase 3: Answer cards, provenance and deterministic resolvers (L)

**Goal.** Make most answers Tier 0 and make every answer show where it came from.
- `StanleyAnswerCard` with a structured body, provenance chips (**Your booking**, **Ship schedule**, **Princess policy**, **Estimated**, **Cached**), and an expandable **Based on** panel: source owner, **data time** (not reply time), live/cached/estimated/provisional, a "check with a person" route. Remove the reply-time "as of" wording.
- Abstention rules by topic: deadlines, tender, payment, access, entry rules and safety always show "I cannot confirm" language when data is stale or missing; they never fall to a model guess.
- 25 to 40 resolvers behind one interface (`IStanleyResolver`): next task, next event, all aboard (ship/local/device time labelled), reservation lookup, venue hours, package inclusion, bill status split posted/pending/disputed/estimated, open cases, readiness per traveller, document tasks with source and date, boarding-pass state, "what changed" (stub until phase 11), return brief.
- Cached trip facts with a cached-at time for offline answers.
- **"Explain this screen"** (idea 2): one tap from any page, answered from the screen id and the library with the plain-words next step. Mostly authored; no model call.
- **"Why am I seeing this?"** (idea 3): a button on every suggestion, tip and chip that opens the fact and rule behind it, using the same Based on panel. This is a provenance explainer, not an AI label (decision 1).
- **Closes:** A7, 5.5, 5.6, STN-SEA-01/02, STN-MNG-01/02, STN-GTS-02, STN-POR-01/02, STN-BOK-03/05 (read side), 9.7.
- **Acceptance.** For the resolver list, a question returns a card with a correct data time and no model call; stale-source fixtures produce the abstention wording.
- **Status (2026-11-09): built in part; server tests written, not run here.** Server: `StanleyResolvers` (`server/Princess.Api/Domain/StanleyResolvers.cs`) holds 17 resolvers behind `IStanleyResolver` (tender, check-in deadline, all aboard, bill, cases, readiness, what changed, next event, tours, dinners, packages, venue hours, itinerary, where the ship is, countdown, stateroom, party). The gateway runs them first, after the muster answer and before the router, behind the existing `Resolver` switch; a reply carries `tier: resolver` and a `card` with provenance (chips, owner, data time, live/cached/estimated/provisional, check-with-a-person, note). Data time is `StanleyTrip.AsOf` (when the booking was read) or the published date for schedule and policy text; there is no reply-time wording. Tender, check-in, all aboard, bill, cases and readiness abstain ("I cannot confirm", a route to a person) when facts are missing or older than 30 minutes. Device: `StanleyAnswerCard` with a keyboard-operable **Based on** panel, `stanleyCard.ts` (reads the card, builds the explainers), **Explain this screen** (button in the chat; answered on the device from the screen id and its authored description, no server) and **Why am I seeing this?** (a button on follow-up chips, page chips, starter questions and the Home tip). The old "as of {time}" source lines are gone. Tests: `StanleyResolverTests.cs`, gateway tests in `StanleyTests.cs`, `stanleyCard.test.ts`. Follow-up: the eval set now names the resolver card for 20 cases (`card` in `cases.json`: id, abstain, chips, stale-abstains), checked by `eval.test.ts` and `StanleyEvalTests.cs`, which also fails if any other booked question is taken by a resolver; `GET /me/stanley/facts` gives the device seven saved cards (tours, dinners, packages, ports, countdown, stateroom, party; nothing that goes stale in a day), kept by `feeds/stanleyFacts.ts` for a day, forgotten at sign-out and shown as Cached cards with the original data time when a question cannot reach the server; **Why am I seeing this?** is also on the daily moment and the diary prompt, and the coach tour says why it appeared. Resolver questions are tightened so planning requests, "how long is the tender ride" and "delete my reservations" are not taken. Carried over: the plan's 25 to 40 resolvers are 17 here, because the other planned ones need data the trip facts do not hold (bill split by posted/pending/disputed/estimated, open cases, per-traveller readiness, document tasks, boarding-pass state, return brief); bill, cases and readiness answer with an abstention card until phase 4's read tools and permission model provide the data; **what changed** is a stub until phase 11; the library still answers some generic deadline and all-aboard questions from authored text before a resolver sees them (for example "when does check-in close"), as phase 2 decided.

### Phase 4: Context packet and typed read tools (L)

**Goal.** Let the model reason over the guest's real plan and money, safely.
- Minimal context packet builder (strategy 9.4): opaque guest id, role, active voyage, stage, screen, allowed facts, allowed tools. Active voyage chosen explicitly; Stanley asks when two voyages are possible and never switches silently.
- Tool gateway with permission checks at *execution* time (AI-SEC-01). Read tools: `get_guest_visible_plan`, `check_plan_conflicts`, `search_ship_venues`, `get_venue_hours_and_menu`, `calculate_package_value`, `get_case_status`, `get_verified_all_aboard_details`, `get_route` (deck graph), plus the existing seven.
- Party and child permission model applied to every tool; cross-party tests (family, guardian, helper, revoked) as automated fixtures.
- Model routing per decision 6: the small tier prescans and classifies, the default tier answers with tools, the large tier only when the router flags a multi-constraint request. Tool calls count against the phase 1 caps; each new tool ships with a test that it cannot push a request over its cap.
- Written data inventory (purpose, field, provider, retention).
- **Closes:** A3, A4, 9.3, 9.4, AI-SEC-01/02/04, STN-MNG-03, STN-EMB-03, STN-PRE-01/04 (read side), STN-DSC-01.
- **Acceptance.** The model cannot obtain another traveller's data even if told to; every tool call is logged without content; eval set grows with plan-grounded questions.

- **Status (2026-11-09): built; server tests written, not run here (no `dotnet` on this machine, and the rule is not to run it).** Server: `StanleyPacket.cs` (the context packet: opaque keyed guest reference, role, voyage, stage, screen, allowed facts and tools, travellers by reference and first name; the party and child permission model `StanleyPermissions`; `StanleyVoyageChoice`), `StanleyReadTools.cs` (eight read tools: `get_guest_visible_plan`, `check_plan_conflicts`, `search_ship_venues`, `get_venue_hours_and_menu`, `calculate_package_value`, `get_case_status`, `get_verified_all_aboard_details`, `get_route`), `StanleyPackets.cs` (the builder from the stores). The tool loop in `StanleyToolService` adds the packet to the instructions, offers the read tools with the existing seven, checks access on every call, counts tool calls and refusals on the meter and logs each call by name, outcome and guest reference only. With two voyages and none named the gateway answers with a **Which trip do you mean?** card (`whichTrip`) and never picks; the chosen sailing also scopes the older tools. Tests: `StanleyPacketTests.cs` (family, guardian, helper and revoked fixtures, a child, probing a name, every tool, the call cap for every tool, a refused cross-traveller read, log content, the trip question). Eval set: nine plan-grounded questions, two of them asking for another traveller's data. Data inventory: `docs/stanley-data-inventory.md`. Carried over: the helper path is in the permission model and fixtures but the device cannot yet name a guest to act for, so the builder only loads the guest's own booking (phase 7 adds the way to name one); `get_route` is an outline by deck and end of the ship because the server holds no corridor graph; model routing is unchanged (small prescan, default with tools, large for planning); the model reads bill totals through no tool yet, so the bill and readiness resolvers still abstain until a bill read tool is added with the money permission.

### Phase 5: Bounded action orchestration (L)

**Goal.** Replace regex-parsed confirm cards with the strategy's full lifecycle.
- Model interprets a request to a typed intent (JSON schema) with parameters; unknown intent falls back to a clarifying question.
- Server `prepare` returns a non-binding preview with an id, exact items, who is affected, price/credit/refund, cancellation terms and an expiry; it is stored server-side and invalidated if availability or price changes.
- `confirm` takes the preview id plus an idempotency key and re-checks permissions; server executes through existing services (plan, orders, excursions, dining), reconciles unknown outcomes before any retry, and returns a **receipt** that is written to the Trust Ledger and audit trail.
- Action set (strategy 8.4): add/remove plan item, move a dinner, order an item, add an excursion, create a group poll, draft a service case. Never: pay, cancel a booking, change a cabin, share data.
- Existing 2-hour undo kept; the original reservation stays until the replacement is confirmed.
- **Remind me** (idea 7): "remind me at 4:15 to be back" creates a local reminder through `localReminders.ts` as a prepare/confirm action, showing the all-aboard time it is based on.
- Remove `CHANGE_WORDS` regex routing (and the false "add to packing list" trigger).
- **Closes:** A5, 5.3, STN-BOK-04, STN-PRE-06, STN-SEA-07, Wave 3 exit gate.
- **Acceptance.** Test matrix: expired preview, changed availability, duplicate confirm, wrong party, child account, pending outcome. No mutating call runs without a valid preview token.

- **Status (2026-11-09): built in part; server tests written, not run here (no `dotnet` on this machine, and the rule is not to run it).** Server: `StanleyActions.cs` in `Domain` (the closed set of six action kinds, the typed `StanleyIntent`, `StanleyIntents.Validate` for the model's `propose_action` tool input and `StanleyIntents.Parse` for the words when no model can be called, the never list: pay, cancel a booking, change a cabin, share data, which has no kind, no tool and no code path, the preview and receipt shape `StanleyActionDto`) and `StanleyActions.cs` in `Services` (`StanleyActionService`: `PrepareAsync` stores a non-binding preview with an expiry ten minutes ahead; `ConfirmAsync` takes the preview id and an idempotency key, re-checks expiry, the child and permission rules and a fingerprint of the price and availability, then carries it out; a repeated confirm returns the same receipt; an unknown outcome is `pending` and is settled against what exists before anything is retried; `UndoAsync` for two hours; `ReceiptsAsync`; every step writes the audit trail by action name and kind, never content). Effects go through the existing services as the guest, so their own checks apply at execution time: stateroom requests (`ServiceRequestService`), the excursion cart (`PlanService.AddToCartAsync`, never checkout), dining (`PlanService.MoveTableAsync`, which checks the new slot first so the old table stays until the new one is accepted), and cases (`CaseService.OpenAsync`, lost item and complaint only). A day-plan change and a reminder are checked and receipted on the server and applied by the device from the confirmed receipt, because those live on the device. The gateway reads a request into an intent ahead of the resolvers and the router (new tier `action`, new `Action` field on the reply), the model gets one extra tool, `propose_action`, only for a booked adult guest, may make at most one preview a turn and is told never to say it is done, and the `actions` switch turns the whole thing off. Table `dbo.StanleyActions` (a preview, then its receipt; the typed intent and preview text, never the chat). Endpoints: `POST /me/stanley/actions/prepare`, `POST /me/stanley/actions/{id}/confirm`, `GET /me/stanley/actions/{id}`, `POST /me/stanley/actions/{id}/undo`, `GET /me/stanley/receipts`. Device: the `act` route and `CHANGE_WORDS` are gone (and with them the false "add to packing list" trigger, and `parseItemRequest`/`parseExcursionRequest`); `StanleyActionCard` shows the preview (exact items, who, price, terms, expiry), confirms with one key per card, shows the receipt with Undo, and applies a plan change or a reminder (`stanleyAction.ts`, `data/customReminders.ts`; a due reminder shows in the existing reminder strip and says it is not a background alert); the dialog sends today's plan (titles and times) and the all-aboard time with its clock label; Ask your cruise hands every request to Stanley; the Trust Ledger screen lists the receipts. Tests: `StanleyActionTests.cs` (the matrix: expired preview, changed availability, duplicate confirm, key reuse, wrong party, child account, pending outcome and its settling, undo window, the kill switch, no call without a valid preview, the never list, the typed intent), `StanleyEvalTests.cs` (the action step takes exactly the cases the set names), `stanleyAction.test.ts`. Eval set: the ten old `act` cases are re-pointed (`tier: action` for the three the server turns into a preview or a refusal, the rest to the route that now answers them). Carried over: **create a group poll** is not an action yet (a poll is a device state document with no server service to call; the "Plan it with the group" button stays); **Remind me** is a reminder on the device, shown when the app is open, not a push; the typed intent for a plan change names an item from the plan the device sends, so the server cannot check it against anything but that snapshot; dinner is moved by naming a time (and a night when there are several), a "late seating" change is still a library explainer; the order of an item has no price because stateroom requests are free, and an in-room order with a price waits for a service to call; the receipt is listed beside the ledger, not as a row in the money timeline, because none of these actions moves money; `dbo.StanleyActions` and the tier log are deleted by the retention job after `Retention:StanleyDays` (180) days, and an unconfirmed preview after a day (not run here).

### Phase 6: Human handoff and service-case follow-through (M)

**Goal.** Make "get me to a person" continuous and trustworthy.
- Mount `HandoffCard` inside the dialog whenever the safety screen or the guest asks for a person; add the missing consent step (called out in AST-06) and a clear preview of exactly what is sent.
- Handoff payload per strategy 7.8: sailing and role, issue, requested outcome, booking/order reference, what was tried, source and status, approved attachment.
- Stanley says "handed to Guest Services" **only** after a case reference exists; shows case owner, status, next update, and overdue escalation.
- Intent flows that draft a case for review: cabin issue (with optional photo), lost property, billing dispute, allergy request (receipt plus acknowledgement), special request status (submitted/acknowledged/fulfilled), disruption summary for an agent/port team, missed-ship path with verified numbers.
- "Show this to crew" large-text cards in English: dietary, mobility, lost item, lost passport.
- **Closes:** A10, 7.8, STN-BOK-06, STN-GTS-03/06, STN-EMB-05, STN-SEA-04, STN-DEB-05, STN-MNG-06, STN-PRE-07, STN-POR-03, AI-SEC-09.
- **Acceptance.** No claim of escalation without a case id; case status renders in chat; emergency never makes a message, only the numbers.

### Phase 7: Voyage memory, preferences and proactivity settings (M)

**Goal.** Give the guest a visible, controllable Stanley memory.
- **What Stanley remembers** screen: each remembered preference with its reason, scope (this trip / future trips), edit, forget, and an opt-out; booking facts shown separately and read-only.
- Server-held preference store, consolidating the scattered ones (pilot prefs, fit, likes, access profile) behind one API; per-traveller privacy (one cabin member's data never personalises another's answers).
- The chat thread stays on the device (decision 3); nothing about it is added to the server in this phase.
- Proactivity setting (decision 5): the strategy's three plain choices layered over the four existing levels, which remain the mechanism: "Tell me only what affects my trip", "Offer suggestions", "Guide me through everything".
- Carry-forward chooser at Remember (STN-REM-07).
- Decision record for provider retention and training terms (AI-SEC-07).
- **Closes:** A6, 5.4, STN-REM-07, 7.6 setting. A12 and AI-SEC-05 are accepted gaps (decisions 1 and 3). Child and teen Stanley is out of scope (decision 7).
- **Acceptance.** Forget removes the item from every device and from the model context; tests prove a deleted preference is not used.

### Phase 8: Dream and Discover intelligence (L)

**Goal.** Conversational discovery that produces editable filters, not paragraphs.
- Free-text cruise-fit interview using structured output: "late spring, about a week, warm, few tender ports" yields filter chips plus listed assumptions, populating the existing search and sailing filters.
- Two or more distinct directions with trade-offs from catalogue data.
- Explainable comparison: the app's compare screen driven by Stanley with changeable priority weights; missing data labelled; port-hour and tender explanations computed from sailing data; cabin evidence vs category and confidence.
- "If you value X choose Y" ranking with visible criteria; no hidden commercial ranking.
- Server-side decision brief (shortlist, comparison, answers) resumable across devices; shareable "our ideal cruise" brief that omits sensitive needs by default.
- Booking help: likely name/date mistakes flagged by Stanley while the validator remains the authority.
- **Closes:** STN-DRM-01/02/04/05/06, STN-DSC-02/03/04/06/08, STN-BOK-02.
- **Acceptance.** Every figure in a comparison is calculated by services; eval set covers discovery phrasings.

### Phase 9: Planner, Group Diplomat and Sea-time intelligence (L)

**Goal.** Stanley as the day and group planner on the real calendar.
- "Shape my day" scenarios (relaxed, active, family, culture, food, mixed) building an editable day from actual reservations with hard/soft conflicts, walking and transfer buffers, and a "ready" label blocked by hard conflicts.
- Whole-plan consequence preview: new conflicts, lost options, price change, cancellation deadline.
- Free-window suggestions and "three ways to spend the next hour", each open, reachable in time and labelled free/included/paid; venue discovery for quiet, nearby, child-friendly using explicit definitions, saying "no live occupancy" when none exists.
- Group Trip Diplomat: poll expiry, reminders and owner controls, aggregate availability without private reasons, compromise suggestions, silence never counted as consent; organiser "what remains" at task level.
- **Plan my evening in one tap** (idea 4): show, dinner and a quiet last drink in order, with walk times and a reserve step through phase 5 actions.
- **Meeting-point messages** (idea 5): Stanley drafts "meet at the atrium at 5:10, deck 5" from the existing meeting-point and sharing code; the guest sends it.
- **"How does this day work for Dad?"** (idea 10): run the day through a named traveller's access and pace profile and list what to change.
- **Compare two excursions in chat** (idea 11): table of duration, exertion, transport, return arrangement, price and inclusions.
- Accessibility-aware planning: access attributes recorded as sourced data (verified / guest-reported / unknown, with date and confidence); a plan for a named traveller; unverified routes trigger a human check; printable large-text plan.
- Excursion fit and risk trade-offs with age, exertion, return arrangement and accessible-service evidence.
- **Closes:** STN-PRE-01/02/03/05/08/09, STN-SEA-05/08/09, STN-MNG-07, STN-DSC-07, STN-POR-06, 7.3, 7.4.
- **Acceptance.** Planner cannot create an opening that does not exist; conflict engine tests cover tender buffers and time zones.

### Phase 10: Travel-day, port and onward-travel intelligence (M)

**Goal.** Make the days that need the most care calm.
- Flight and traffic replan from verified provider updates (mock provider behind the existing interface), with provider, timestamp, confidence, alternatives and a message draft.
- Independent port itinerary builder from interests, distance, mode, time budget and opening hours; offline port pack; return brief with explicit buffer.
- Phrase help labelled machine-generated or reviewed, with a "show this to a person" fallback; camera-assisted sign and menu reading (guest-initiated, excludes documents, shows confidence) as P2 and last in the phase.
- Itinerary and forecast-aware packing list, editable.
- Embark goals tour (essentials / family / dining / quiet / access).
- Customs and immigration answers that link to current official sources with jurisdiction labels; onward-connection timing check.
- **Closes:** STN-GTS-04, STN-POR-04/05/08, STN-MNG-04, STN-EMB-04, STN-DEB-03/04.
- **Acceptance.** Document and entry-rule answers cannot come from the model; every time shown names its clock.

### Phase 11: Voyage Autopilot v2 and Explain this change (L)

**Goal.** The strategy's headline differentiator: Stanley notices what matters and helps recover.
- Canonical **change event** model on the server (itinerary, port call, venue, tender, weather advisory, flight, reservation, order, case), each marked verified, provisional or forecast, with source and time.
- Impact engine that recomputes only affected plan segments and ranks consequence: safety/deadline, lost reservation, meaningful conflict, preference improvement, optional.
- One card: **What changed / Why it affects you / Recommended option / Other options / Confirm** (confirm uses phase 5 actions). Nothing cancels, rebooks or pays automatically.
- "Explain this change" answers the six questions from the event, not from chat history.
- Delivery rules: critical alerts separate from suggestions, quiet hours, one proactive element per screen, three per session, a dismissed tip stays dismissed unless facts change.
- **"What did I miss?"** (idea 1): on opening after a port day or time offline, the changes since last open ranked by the same consequence order, from the change events.
- **Rough-seas companion** (idea 8): when the nautical feed shows rough seas, a quiet non-medical tip (stay midship, lower decks, where the reviewed information is) linking to the seasickness page; it obeys the delivery rules above.
- Push integration for reservation and case alerts (noted as missing in MOB-07 and COM-06).
- **Closes:** A8, 7.1, 7.2, STN-SEA-06, STN-POR-07, 7.6 (delivery rules; the setting is in phase 7).
- **Acceptance.** Replay test: scenario fixtures produce expected alerts with no false positives on unrelated changes.

### Phase 12: Entitlement, spend and loyalty coach (M)

**Goal.** Money questions answered precisely and kindly.
- Entitlement service for per-traveller inclusion ("is this cocktail included for me?"), used by resolvers and tools.
- Spend coach: "if we book this, what will the family total be?" and pace versus budget, with scenarios labelled illustrative.
- **Spend pace alerts** (idea 6): a gentle mid-week "at this pace you will be around X" against the budget the guest set, delivered under the phase 11 rules and the guest's proactivity choice.
- Folio explanation with posted, pending, disputed and estimated kept distinct; final folio explainer; dispute opens a tracked case (phase 6) and never marks it resolved.
- Package value comparison from the family's chosen likely use.
- Captain's Circle progress, credits and expiry from a mocked loyalty service behind an interface; no predicted guaranteed status.
- **Closes:** STN-DSC-05, STN-BOK-07, STN-MNG-05, STN-PRE-04, STN-SEA-03, STN-DEB-02, STN-REM-05, 7.5.
- **Acceptance.** All numbers come from services; tests prove the model cannot change a figure.

### Phase 13: Remember, storyteller and relationship (M)

**Goal.** Warmer endings that respect the guest's words and open concerns.
- Optional model-written drafts from guest-selected facts, with the current template as fallback and the same never-overwrite rule.
- Recap and Voyage Story: each milestone sourced; preview, remove, correct, export; private, family-share and public-export versions; tone control.
- Organise selected photos and notes; no face recognition, no use of another guest's media.
- **Compliment or feedback drafter** (idea 12): helps write a thank-you for a crew member or a survey answer; the guest edits, approves and sends.
- **Photo caption helper** (idea 13): guest-selected photos only; suggests a caption from the diary day; no face recognition.
- Daily recap in chat from approved events; port memory asks what to keep.
- Carry unresolved cases forward; **suppress or soften rebooking prompts while a serious case is open**.
- Explainable next-voyage suggestions from preferences the guest chose to keep, with total-cost range.
- **Closes:** STN-REM-01/02/03/04/06/08, STN-SEA-10, STN-POR-09.

### Phase 14: Quality gates and operations (M)

**Goal.** Run Stanley like a product.
- Cost per resolved task and tier mix dashboard (aggregate only); repeat-question rate and escalation precision as signals.
- Incident playbook in `docs/runbook.md` for the eight incident classes in strategy 10.4; tested kill switches.
- Release gates for AI added to `releaseGates.test.ts`: no unconfirmed mutating action, no cross-party leak, no unsupported critical claim.
- Content review workflow (owner, due date) surfaced to authors; stale-entry report.
- **Crew-side content console** (idea 15): a small internal screen listing library entries due for review and the questions with high repeat or abstain rates (no thumb signal, decision 2).
- **Stale-tip expiry** (idea 16): tips and chips time out when their screen or fact changes, so nothing nags; builds on the "dismissed stays dismissed" rule in phase 11.
- Cost per resolved task is measured against the decision 6 targets (60% no model call, under 10% large tier).
- Accessibility audit of every Stanley surface.

### Phase 15: Voice, accessibility and polish (S to M)

- Voice input in the Stanley dialog (the Ask screen already uses SpeechRecognition); read-aloud for answers.
- True streaming (SSE) once the gateway exists, replacing the device-side reveal.
- **Stanley pocket card** (idea 14): one printable or offline page with boarding, contacts, key times and the dietary and mobility cards from phase 6.
- Printable and large-text plan; departure pocket card; ship-literacy mini tour with text map.
- Reduced-motion and screen-reader pass.
- Multilingual remains deferred (English only per `CLAUDE.md`).

---

### Open carry-over items (kept here so none is lost)

The per-phase status notes above give the detail; this is the running list of what was deliberately left, with where it is expected to land. Tick an item off (and say which commit) when it is done.

| Item | From | Expected in |
|---|---|---|
| Group poll as a prepare/confirm action (needs a server poll service; a poll is a device document today) | 5 | 6 or 7 |
| Reminders as push, not only shown when the app is open | 5 | 15, with push |
| In-room order with a price (stateroom requests are free today) | 5 | when an order service exists |
| "Change my dining time to late seating" is a library explainer; no dining-plan service | 5 | 9 |
| Plan change is checked only against the plan snapshot the device sends | 5 | 11 |
| Receipts listed beside the ledger, not as money rows (by design while no action moves money) | 5 | revisit with any paid action |
| Helper path: the device cannot yet name a guest to act for, so only the guest's own booking is loaded | 4 | 7 |
| `get_route` is an outline; the server holds no corridor graph | 4 | 10 |
| Bill read tool with the money permission, so the bill and readiness resolvers stop abstaining | 4 | 12 |
| Eleven of the 25 to 40 planned resolvers (bill split, open cases, per-traveller readiness, document tasks, boarding-pass state, return brief) need data the trip facts lack | 3 | 6, 10, 12 |
| "What changed" resolver is a stub | 3 | 11 |
| Diagnostics tier mix is per device; the server's `GET /me/stanley/tiers` has no screen | 2 | 14 |
| `handoff` kill switch | 1 | 6 |
| Server tests (phases 1 to 5) written but never run or compiled here; run `dotnet build server/Princess.Sln` and the Stanley tests by hand | 1 to 5 | before release |

Done since first noted: the browser's `act` word list (phase 5, `06dc128`), retention for the tier log and actions (phase 5 follow-up, `1266e9b`).

## 6. Additional ideas from the review (beyond the strategy document)

Ordered by value to the guest. All except idea 9 are now built into the phases shown in brackets, and each phase lists them by idea number. Idea 9 is parked (decision 7).

1. **"What did I miss?" catch-up.** On opening after a port day or time offline: changes since last open, ranked by consequence. (Pairs with phase 11.)
2. **"Explain this screen."** One tap from any page that uses the screen id and library to explain the page in plain words, with the next step. (Cheap, mostly authored; phase 3.)
3. **"Why am I seeing this?"** A button on every suggestion, tip and chip listing the fact and rule behind it. (Trust; phase 3.)
4. **Plan my evening in one tap.** Show, dinner, and a quiet last drink, in order, with walk times and a reserve step. (Phase 9.)
5. **Meeting-point messages.** Stanley drafts a message to the party ("meet at the atrium at 5:10, deck 5") using the existing meeting-point and sharing code; the guest sends. (Phase 9.)
6. **Spend pace alerts.** A gentle mid-week "at this pace you will be around X" with the budget the guest set. (Phase 12.)
7. **Remind me.** "Remind me at 4:15 to be back" creating a local reminder from `localReminders.ts`; shows the all-aboard time it is based on. (Phase 5.)
8. **Rough-seas companion.** When the nautical feed shows rough seas, a quiet, non-medical tip (stay midship, lower decks, where the reviewed info is) linked to the existing seasickness page. (Phase 11.)
9. **Teen and child Stanley. OUT OF SCOPE for now (decided 2026-11-09).** A restricted Stanley for children on the booking: kids' activities and the meeting point only, no actions, guardian-visible settings. Parked.
10. **"How does this day work for Dad?"** Run the day plan through a named traveller's access and pace profile and show what to change. (Phase 9.)
11. **Compare two excursions in chat.** Table: duration, exertion, transport, return arrangement, price, what is included. (Phase 9.)
12. **Compliment or feedback drafter.** At Remember, help the guest write a thank-you for a crew member or a survey answer, guest approves and sends. (Phase 13.)
13. **Photo caption helper.** Guest-selected photos only; Stanley suggests a caption from the diary day. (Phase 13.)
14. **Stanley pocket card.** One printable or offline page with boarding, contacts, key times, dietary and mobility cards. (Phase 15.)
15. **Crew-side content console.** A small internal screen for authors to see library entries due for review and questions with high repeat or abstain rates. (Phase 14.)
16. **Stale-tip expiry.** Tips and chips that time out when their screen or fact changes, so nothing nags. (Phase 14.)

---

## 7. Decisions

**Decided (2026-11-09):** all eight items below are decided. No open questions remain.

1. **AI disclosure. DECIDED: no "AI helper" wording for now.** The strategy (4.1, AI-SEC-05) would label AI answers; we accept that gap. Do not add AI labels in any phase; revisit later.
2. **Outcome feedback. DECIDED: no thumb on model answers for now.** The quality loop relies on server tier counts and repeat-question rate (phases 1, 2, 14).
3. **Where the chat thread lives. DECIDED: stays on the device.** Phase 7 drops the server-persisted thread; only the preference memory moves server-side.
4. **Retire the concierge as a separate AI. DECIDED: yes.** Stanley becomes the only conversational surface. The Concierge screen keeps its page but calls the same gateway (phase 1); the concierge's seven tools move behind the gateway and its separate rules, limits and endpoint behaviour are removed once the screen has moved over (keep the old reply shape until then, per section 8).
5. **Proactivity naming. DECIDED: layer, do not rename.** The strategy's three plain choices ("Tell me only what affects my trip", "Offer suggestions", "Guide me through everything") sit over the existing four levels, which stay as the underlying mechanism (phase 7).
6. **Model use and budget. DECIDED (my judgement; tune with real tier logs):**
   - **Provider.** Anthropic only, behind the existing model interface, so a provider can be swapped with no front-end change. Model names live in server configuration, never in the client.
   - **Small tier** (prescan, classification, routing, short rephrasing): a Haiku-class model, currently `claude-haiku-5-5`.
   - **Default tier** (grounded answers with tools): a Sonnet-class model, currently `claude-sonnet-5-5` (today's configured default).
   - **Large tier** (multi-constraint planning, group diplomacy, Autopilot explanations): an Opus-class model, currently `claude-opus-5-5`, only when the router flags a multi-constraint request. Never the default.
   - **Order of attempts.** Deterministic resolver or library first (no model), then small, then default, then large. A call escalates only when the cheaper tier reports low confidence or the request needs more tools.
   - **Budget.** The gateway enforces a per-request cap of model calls (3 for chat, 5 for planning) and a token cap per tier, plus a per-guest daily ceiling. Starting values: small 300 output tokens, default 900 (today's `MaxTokens`), large 1,500; daily ceiling 60 model calls per guest. When a cap is hit, Stanley answers from the deterministic tiers and says so plainly. Target mix to aim for: at least 60% of questions resolved with no model call; under 10% reaching the large tier. These are starting numbers, set in configuration and revisited after phase 2's tier counts show real use.
7. **Child and teen Stanley. DECIDED: out of scope for now.** Idea 9 in section 6 is parked, not scheduled in phase 7 or any other phase. The existing `child` checks in confirm and the cross-party tests (AI-SEC-04) still apply.
8. **Server verification. DECIDED:** the user runs targeted `dotnet test` themselves; server phases still land with tests written, and I do not run dotnet.

## 8. Risks

- **Data feeds are simulated.** Plans, venues, loyalty, folio and flight data are mocks behind interfaces. Phases 9 to 12 build the *shape*; claims such as "verified" must stay honest ("simulated" labels per the strategy's 1.2, handled in the provenance model of phase 3).
- **Scope of phase 1 and 5.** They touch the contract between client and server. Keep the old reply shape working until the end of each phase so a half-finished phase never leaves Stanley broken.
- **Model cost creep.** Phase 4's tools can multiply calls. The tier log and per-route budgets in phase 1 are the guard; do not ship phase 4 without them.
- **Sensitive data.** Access, allergy and medical details are the highest-risk inputs. Keep them out of the context packet unless the guest chose them for the request at hand.

## 9. Suggested order if time is short

Phases **1, 2, 3, 6, 5** make Stanley measurably more useful and safe (gateway, evals, honest sourced cards, working handoff, real actions). Add **4** next for plan-grounded answers, then **11** for the Voyage Autopilot differentiator. Phases 7, 8, 9, 10, 12 and 13 can follow in the order of the stage you want to improve first.
