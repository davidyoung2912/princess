# "What should I do now?": the next-steps guidance plan

Status: **v2 (2026-11-17). Decisions made (section 9). G1 (the guide engine), G2 (Home rebuilt on the guide) and G3 (skip and later, counts, personal fit, all done) and G3b (the fit prompt) are built; G4 (in-flow guidance) is next.**

Goal: at every one of the 11 stages, at any moment, a guest can answer "what should I do now, why, by when, and what comes after?" in one glance, and every screen they land on keeps them oriented. This should be one of the app's two defining strengths, alongside Stanley.

It builds on `docs/stage-experience-plan.md` (stage engine, tabs), `docs/stage-welcome-plan.md` (welcome and progress), `docs/returning-home-plan.md` (urgent rules), `docs/customer-journey-priorities.md` (what matters per stage) and the Stanley plans. It replaces none of them. It joins up what they already built.

---

## 1. My honest opinion

**What is already strong.** The stage engine is derived from facts and works across devices. There is a stage welcome page with a "what moves you on" line. Home has Next steps and six tiles. Stanley gives a rules-based "next" sentence and an urgency dot. There is a 90/60/30/14/7/1 checklist, push "moments", and a Stanley reminder system. Most apps have none of this.

**What is weak.** Each of these pieces answers "what next?" on its own, with its own data and its own wording, and they can disagree on the same screen. The guest sees guidance, but not a plan. The code facts behind that:

| # | Finding | Evidence |
|---|---|---|
| G-1 | **Next steps are three fixed items per stage.** They are chosen by stage only and never re-ordered, added to or retired by what the guest has actually done. | `nextSteps()` in `src/routes/stageHome.ts` |
| G-2 | **Only about 8 of the 32 steps can ever be "done" from data.** The rest are done only by opening the screen. Dream "Invite someone", Discover "Compare, hold or book", all of Prebook, Port and Disembark can never be seen as truly finished. | `done: false` in `nextSteps()`; visit tracking in `stageProgress.ts` |
| G-3 | **The facts Home sees are thin.** `HomeFacts` knows paid, documents, check-in, muster, a draft and saved sailings. The server already knows excursions booked, dining booked, assistance, travel plan, packages, packing (it drives the checklist's "auto" items), but Home cannot see them. | `HomeFacts`; `AutoKey` in `src/domain/checklist.ts` |
| G-4 | **At least seven separate "next" surfaces, with no shared source.** The landing card (`STAGE_ACTION`, static copy), the journey strip's "Next:" link, Stanley's next sentence, the trip `NextStep` banner (`trip.next`), the Next steps list, the checklist, and the welcome page steps. Manage and Prebook both send the landing card to the checklist, whose order differs from the Next steps order. | `StageLanding`, `JourneyStrip`, `StanleyNext`, `NextStep`, `StageHome`, `ChecklistScreen`, `StageWelcomeScreen` |
| G-5 | **Home has four different layouts for the same job.** Tile stages, trip stages, aboard and the default branch each assemble their own cards, so guidance is in a different place at different stages. | `HomeScreen.tsx` |
| G-6 | **Steps carry no "why", no due date, no effort and no consequence.** Only the checklist has dates, and only for Manage to Prebook. "Check the real total" does not say why or how long it takes. | `stage.next.*` strings |
| G-7 | **Nothing carries over.** An unfinished step from one stage (documents, say) just stops being listed when the stage changes. | step lists are per stage |
| G-8 | **Dead ends in the checklist.** `insurance`, `phone` and `bags` have no link (`to: null`), so the app tells the guest to do something and gives them nowhere to go. | `CHECKLIST` |
| G-9 | **No guidance inside the flow.** When a guest finishes a task (pay, check in, documents), what comes next is ad hoc: the pass screen has "next", the confirmation has two links, the others have none. No screen says "step 2 of 5" or "back to your steps". | `PassScreen`, `ConfirmedScreen`, `ReceiptScreen` |
| G-10 | **"What moves you on" lives only on the welcome page** (`/welcome`). Home never says "check-in opens in 6 days", which is the thing a guest in Prebook most wants to know. | `welcome.<stage>.moveOn` |
| G-11 | **No personal fit.** A solo traveller, a family with children and a guest who needs access support get the same three steps. There is no "not for me" or "skip". | `nextSteps()` takes no profile |
| G-12 | **"All done" is a dead end.** Stanley says "up to date" with no button, and nothing says what happens next or when. | `stanley.next.allDone` |
| G-13 | **Onboard steps ignore time.** Sea, Port and Disembark are hour-sensitive (all-aboard, bag night, exit time, dinner), but their steps are static. Only the evening nudge in `stanleyNext` and the bags rule are time-aware. | `stanleyNext.ts`, `urgentStep` |
| G-14 | **No way to ask Stanley "what's next?" from the guide.** The deterministic next answer and Stanley's chat answers are separate code paths. | `stanleyNext.ts` vs `stanleyLibrary` |
| G-15 | **No evidence it works.** We record visits, not whether guests finish stages' tasks before the deadline, so we cannot tell which guidance helps. | `stageProgress` only |

---

## 2. Principles

1. **One guide, many views.** One source of truth for "what is the guest's plan right now", rendered everywhere (Home, welcome, tab landings, Stanley, notices, in-flow footers). Surfaces may differ in size, never in content.
2. **Lead with one thing.** One "Do this now" at the top, a short "Coming up" with dates, and "Done" tucked away. Never more than one primary button on Home.
3. **Every task answers five questions:** what, why, by when, how long, and what happens next. If it can't, it isn't a task, it's a link (and belongs in a tab).
4. **Done is real.** A task is done because the data says so, whenever the data can say so. Visits count only as a last resort, and the task says so.
5. **Nothing is lost between stages.** Open tasks carry forward with a plain "still to do from Manage" label.
6. **The guest can say no.** "Not for me" and "Do later" remove clutter and are remembered. A shorter, personal list beats a complete one.
7. **Respect the clock and the ship.** Dates and times are in the right zone; onboard guidance follows ship time.
8. **No pressure** (journey rule 7). Urgency is explained, never a countdown timer or a scare. Calm mode and Stanley "asked/off" quieten nudges, not the list itself.
9. **Thin client.** The guide is worked out on the server (as the stage already is) so every device agrees, and no front-end mock is kept. Providers stay behind the existing interfaces.
10. **Works offline and for everyone.** The last guide is cached for offline use; status is never conveyed by colour alone; completion is announced to screen readers.

---

## 3. The proposal: a Journey Guide

### 3.1 The task model

One server rule set, `GuideRules` (framework-free, next to `StageRules`), produces for the guest's current trip an ordered list of tasks:

```
GuideTask {
  id            // stable, e.g. "manage.documents"
  stage         // the stage it belongs to (may be earlier than the current one: carried over)
  titleKey / whyKey / doneKey   // locale keys: the action, the reason, what "done" looked like
  to            // where to do it (always set; no dead ends)
  state         // todo | doing | done | skipped | waiting (not open yet) | blocked (needs something first)
  urgency       // now | soon | later | none, with a reason code (payment, checkin, documents, muster, bags, ...)
  due           // date or ship-time, with its zone and its source ("from your booking")
  opensAt       // for waiting tasks: "opens in 6 days"
  minutes       // honest effort estimate: 2, 5, 15
  who           // you | each traveller (with counts: "2 of 4 ready")
  doneBy        // data | visit | tick, so the UI can say how we know
  helpTopic     // optional Stanley topic for "Help me with this"
}
```

`GuideRules` returns `{ primary, soon[], later[], done[], carriedOver[], moveOn }`. `moveOn` is the real trigger for the next stage, with a date where there is one ("Check-in opens Thu 19 Nov").

Inputs are the facts the server already assembles: the stage, trip and payment plan, checklist auto-facts, documents, excursions, dining, assistance, packages, muster, bags, bill, feedback, saved sailings and the draft, the profile (party, children, access needs, first cruise), the clock and the ship zone. The push "moment" facts (`MomentFacts`) already hold many of these, so the guide and the push use one fact builder.

New endpoint `GET /me/guide`, with a cached copy in the offline store, a `useGuide()` hook, and client types in `src/api/types.ts`. The client keeps no rules, so `nextSteps()`, `urgentStep()` and `STAGE_ACTION` are retired once the guide is in.

State the guest controls (skip, do later, ticks) is one small document in `/me/state`, like `stageProgress`, with limits in `StateRules.cs`.

### 3.2 Views of the guide

| Surface | Today | Proposed |
|---|---|---|
| **Home, every stage** | Four layouts, three fixed steps, a landing card, a strip, a banner | One `StageGuide` block at the top of every Home layout: stage name and "step X of Y", a **Do this now** card (what, why, by when, minutes, one button, a "Not for me / Later" menu), **Coming up** (next 2 to 3 with dates), **Carried over** if any, **Done** collapsed. |
| **Stage line** | Strip of 11 stage names | Under the guide: "Manage · Pay in full or reach 14 days out to move on to Prebook (4 Dec)." Always the real trigger with its date. |
| **Welcome page** | Static steps list, "what moves you on" | The same guide tasks, plus the stage story. The first-time welcome becomes a short "your plan for this stage" with the primary task. |
| **Tab landings** | Screens listed in priority order | Each screen row shows a state chip taken from the guide (Needs you, Done, Opens soon) and the first needed one is marked "Start here". The tab shows a dot when it holds a task that needs the guest. |
| **Me** | Trip card with trip `NextStep` | The guide's "Due" view (what is owed and by when), plus carried-over tasks. The trip `NextStep` banner reads the guide's primary. |
| **In-flow screens** (pay, documents, check-in, muster, bags, bill, feedback) | Ad hoc | A slim "Step 2 of 4 · Your next steps" crumb on top when opened from the guide, and a **What's next** footer on completion with the next task as a button and the stage's "moves you on" line. |
| **Stanley** | A rules sentence plus a separate chat library | "What should I do now?" is a first-class chip everywhere, answered from the guide with the why, a button, and (where Stanley actions exist) "Do it for me". Every task has "Help me with this". |
| **Notices and push** | Moments by `ChatProactiveRules` | Moments are keyed to guide task ids so the app, the chat card and the phone alert never say different things or repeat. |
| **All done** | "Up to date", no button | "You're ahead. Next: online check-in opens 19 Nov. Meanwhile, optional: ..." with 1 to 2 optional delights and the next stage's date. |

### 3.3 Carry-over, skip and personalisation

- **Carry-over.** Any task with a hard deadline (documents, payment, check-in, insurance) stays on the list in later stages until done, labelled with where it came from.
- **Skip and later.** "Not for me" (stays hidden; reversible in Me) and "Later" (returns at a stated time or stage). The guide always shows how many are hidden, so nothing is silently dropped.
- **Personal fit.** Rules read the profile: children (kids club, family plan, car seats), access needs (assistance first), first cruise (muster, what to expect, packing basics), solo (meet people), group (each traveller's progress), offers quiet (no upsell tasks). Optional "Make this plan fit me" prompt of three taps in Dream/Discover that fills the profile, since Stanley can already ask.

---

## 4. What each stage's guide contains

Each stage has at most 5 to 8 tasks, and Home shows the primary plus two. "Data" is what marks it done. Items marked **new** do not exist as steps today; screens named are existing routes. Where a destination is not an existing screen, it is listed under section 8 as a gap to fill first.

| Stage | Tasks (in order; **bold** = typical primary) | Done by | Key dates and "moves on" |
|---|---|---|---|
| **1 Dream** | **Take the quiz** · Look at a sailing you like (`/home/sailings`) · Save one (**data: saved**) · Ask Stanley a question (**new**) · Invite someone to dream with you (`/plan/group-poll`; data: poll created) | quiz result, favourites, poll | Moves on when a sailing is saved or priced |
| **2 Discover** | **Choose a room type** (`/home/cabins`; data: category) · See the real total (`/home/cruise/cost`; data: quote opened with sailing) · Check offers and price watch (**new**, `/home/offers`) · Decide between sailings (`/home/decide`, only if 2+ saved) · Talk to an advisor (optional) · Start booking | category, quote, saved count | Moves on when booking starts; "price held until..." if a hold exists |
| **3 Book** | **Finish your booking** (resume) · Check names against passports · Pay the deposit · Add travellers and who pays (`/plan/party`) · Choose dining/extras at booking (optional) | draft step, deposit | "Deposit due by ..." from the booking |
| **4 Manage** | **Pay what is due** (balance, with date) · Complete documents for **each traveller** (counts) · Tell us about access/health needs (**data**) · Check each traveller is ready (`/plan/readiness`) · Insurance (**new link**, was dead end) · Add family/home contacts (**new**) | payment, documents, assistance, readiness, tick | Final payment date or 14 days out, whichever is first |
| **5 Prebook** | **Book your first excursion** (`/excursions-explorer`; data: count) · Reserve dining (`/dining-today`; data: count) · Packages and drinks (`/me/packages`) · Start packing (`/plan/packing`; data: list started) · Plan how you will get there (`/plan/travel`; data) · Set up your phone for the ship (`/plan/phone`; replaces dead-end) · Share the plan with your group | counts, lists | **Check-in opens date** (3 days out), shown on Home |
| **6 Get to the ship** | **Check in online** (data) · Get your boarding pass (data) · Confirm how you're getting there (data: travel plan) · Check documents once more · Luggage tags and what's in your carry-on (`/home/luggage`; replaces dead-end) · Arrival time slot | check-in, pass, plan | Moves on when you say "I'm at the terminal" or boarding begins; show boarding time |
| **7 Embark** | **Take your next boarding step** (`/home/embarkation/steps`) · Find your group (`/home/meeting-point`) · **Attend muster** (data, always urgent until done) · Set up your room: cabin, Medallion (`/home/medallion`) · Settle your account (card on file) · First look: venues and deck map | boarding scan, muster, card | Moves on at sailaway |
| **8 Sea** | **Today's next event** (time-aware, ship clock) · Tonight's dinner (booked? where? when?) · Tomorrow's port (what to prepare tonight; links to `/ship/port`) · Check your bill (`/me/bill`, once a day) · On the **last full day**: bag night, exit time, bill (urgent) | reservations today, diary, bags | Moves on at 08:00 ship time to Port, or last morning to Disembark |
| **9 Port** | **Leave-by and all-aboard time** (always first, in ship time, with the tender note) · Today's excursion or your own plan (data: booked or plan) · Safe-ashore tips · Be back on time: reminder set (data) · What's open on the ship tonight | excursion, plan, reminder | Moves on at the next 08:00 ship time |
| **10 Disembark** | **Choose exit time** · **Put bags out** (night before, with time) · Settle the bill · Customs and documents (`/home/disembark/customs`) · Getting home: ride, flight, onward (`/home/disembark/ride`, `.../flight`) · Final sweep (`/home/disembark/sweep`) | exit time, bags, bill, plans | Moves on at midday on the last day |
| **11 Remember** | **See your recap** (`/me/recap`) · Tell us how it went (`/me/feedback`; data) · Keep your photos and chats (data) · Claim anything owed: refunds, onboard credit (**new**) · Dream the next one (saved sailing; data) | recap viewed, feedback, keep, saved | Next-trip track starts after 10 days, or on a saved sailing |

**Time-aware rules for stages 7 to 10** (G-13): the primary task changes through the day on ship time. For example, on a Sea day: morning is today's plan, lunchtime is dinner booking, 18:00 onward is tomorrow, and the last full day puts bag night first from lunchtime. Port days put the all-aboard time first until the guest is aboard again. These are guide rules, with tests that fix the hour boundaries (as `EVENING_HOUR` is fixed today).

---

## 5. Guidance inside screens (the part that keeps people from getting lost)

1. **Crumb.** When a screen is opened from a guide task (we already carry `openedFrom` state), the header gets a small line: "Step 2 of 4 · Documents · Your next steps". It is a link back to the guide.
2. **What's next footer.** A shared `WhatNext` component on the screens that complete a task. It reads the guide, so the button is the next task, and it says what is left ("2 more before check-in opens").
3. **Completion moment.** When a task becomes done, a polite live-region message ("Documents done. 2 steps left in Manage.") and, if it was the last task, a short, calm celebration that points to the next stage and its date. Reduced-motion safe.
4. **Dead ends fixed.** Every checklist item and every guide task has a destination. Where the destination is only information (insurance, phone setup, bag preparation), we write a short screen or sheet rather than leave a bare line.
5. **Tab hints.** Tab dot when the tab holds a task that needs the guest, "Start here" on the first needed screen, and no hint when nothing is needed.
6. **Search and Help.** The global Help sheet leads with "What should I do now?" and Search puts the primary task first.
7. **Printable plan.** "Your plan" printout of the guide (journey rule 6: works without the app).

---

## 6. Stanley's part

- **"What should I do now?"** is a chip on every Stanley entry point. Its answer is built from the guide (never a model guess), with the why, the date and a button, so it is always the same as Home.
- **"Help me with this"** on every task opens Stanley with that task's context, answered from the existing library entries tied to the task's screens.
- **"Do it for me"** where an action already exists (reminders, bookings Stanley can make, dining plan), the task offers it with the usual confirmation.
- **"Remind me"** on any dated task creates a Stanley reminder (the system exists) at a sensible time before the due date.
- **Proactive cards and push** use the guide's urgency and task ids as their `moment` keys, so a Stanley card is never about something Home doesn't show, and a done task silences its own card.
- **Stanley levels** keep their meaning: Off/Asked hide nudges and the dot, but the guide on Home stays (it is the app, not Stanley).

---

## 7. Phased build

Each phase ends with a commit and a stop, as the working rules say. Verification for all phases is `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`. Server rules get C# unit tests written alongside, but **I won't run `dotnet test`** (per CLAUDE.md), so server rules should be kept pure and simple, and the client contract tested with fixtures.

| Phase | Scope | Outcome |
|---|---|---|
| **G1 Guide engine** | `GuideRules` and contract on the server, `GET /me/guide`, client types, `useGuide()` with offline cache, fixtures. Port the existing 32 steps and the checklist into one catalogue with ids, why, due, minutes, `doneBy`. No visible change yet except that Home reads the guide. | One source of truth. G-1, G-3 (partly), G-6 |
| **G2 Home rebuilt** | `StageGuide` on every Home layout (Do now / Coming up / Done), the stage line with real dates, landing card, journey strip, Stanley next sentence and trip `NextStep` all read the guide. Retire `nextSteps`, `urgentStep`, `STAGE_ACTION`. | G-4, G-5, G-10, G-12 |
| **G3 Real "done" and carry-over** | Server facts for excursions, dining, packing, travel, packages, assistance, insurance; per-traveller counts; carry-over; skip and later; personal-fit rules and the three-tap profile prompt; "all done" state with what's next. | G-2, G-7, G-11, G-12 |
| **G4 In-flow guidance** | Crumb, `WhatNext` footer on about 25 task screens, completion announcement, tab dots and "Start here", dead ends fixed (new short screens where needed), printable plan, Help sheet and Search lead. | G-8, G-9 |
| **G5 Stanley** | "What should I do now?" chip, "Help me with this", "Do it for me" and "Remind me" per task, moments and push keyed to guide ids, dedupe. | G-14 |
| **G6 Stage content passes** (two or three sessions) | 6a Dream to Book; 6b Manage to Get to the ship; 6c Embark to Remember with the time-aware rules. Each is a content review of that stage's tasks, why-lines, links and copy against `customer-journey-priorities.md`. | G-13 and the quality of every task |
| **G7 Prove it** | Generated coverage tests (every task has a destination, why, date source and a reachable screen in its stage; every stage has a primary at every time of day in test dates; no task in two stages without carry-over), a11y tests (focus, live region, no colour-only), wording guards for the new keys, and a local-diagnostics funnel of tasks seen / done / skipped (no new personal data). Update the docs. | G-15 |

**Recommended order:** G1, G2, G3 give most of the value (the guide itself). G4 and G5 make it feel designed. G6 is where it becomes great, and it can be done stage by stage, starting with the stages where mistakes cost most (Manage, Get to the ship, Disembark).

If you only want a smaller first step: G1 plus G2 alone remove the contradictions (G-4, G-5) and add the why, date and real "moves on", with no new data work.

---

## 8. Gaps to fill first (screens and facts the guide needs)

Found while reading the code. None are built; each is small.

- **Insurance, phone setup and bag preparation** have no screen (checklist items with `to: null`). Short information screens with a "mark as done" are enough.
- **Excursions, dining, packing, travel plan, packages and assistance** must be exposed to Home as facts (they exist for the checklist auto-flags; Home cannot see them).
- **Per-traveller readiness** (documents, check-in, muster) needs counts, so "2 of 4 ready" and a link to the traveller who is not.
- **Group poll created**, **quiz result seen**, **price/quote opened for the focused sailing** and **feedback sent** are needed as done-signals for Dream, Discover and Remember.
- **Reminder set for all-aboard** is needed as a done-signal for Port.
- **Profile fields** (children, access, first cruise) are probably present; the guide must read them without asking again.
- **"Claim what's owed"** at Remember (refunds, onboard credit) may need a screen or a bill sub-view.

## 9. Decisions (made 2026-11-17)

1. **Server-side guide: yes.** C# tests are written alongside but not run (CLAUDE.md).
2. **Home shows up to 5 open tasks at a time** (the first is the "Do this now" card, the rest are "Coming up"), not 1 + 2. The rest are one tap away.
3. **Tasks with hard deadlines can only be put off, never hidden.** The server marks them `hard` (payment, documents, check-in, muster, bag night).
4. **An urgent carried-over task may take the top slot.** Built in G1: an unpaid balance or missing documents stay on the list in Prebook and Get to the ship, labelled with the stage they came from.
5. **Order: G1, then G2**, stopping for review after each.

## 10. Build log

**G1, the guide engine (built).**
- `server/Princess.Api/Domain/GuideRules.cs`: the pure catalogue and ordering. 36 tasks across the 11 stages, each with a destination, minutes, `hard`, `optional`, how it is known done (`data`, `tick` or `visit`), a due date and where it came from, and an urgency. The five urgent reasons are the old `urgentStep` rules (payment, check-in, documents, muster, bags). Order: open tasks first (urgent, then soon, then later; required before optional), then blocked, then waiting (by the date they open), then done. Check-in waits until it opens; the boarding pass is blocked until check-in is done. `moveOn` carries the real date (14 days out, check-in opens, boarding).
- `Services/GuideService.cs` gathers the facts (the stage from `ContextService`, the trip, the checklist's data and ticks, the draft, saved sailings, muster, the last full day, feedback). `GET /me/guide` in `Endpoints/GuideEndpoints.cs`. Nothing is stored.
- Client: `src/api/guideTypes.ts`, `api.guide.get()`, `asGuideView` (guards a kept copy), `useGuide()` (kept on the phone for three days, with `stale`), `src/guide/words.ts` and the `guide.*` text in `enLate.ts`. A test (`src/guide/guide.test.ts`) reads the server catalogue and fails if a task has no words, or words have no task.
- Tests written, not run: `GuideRulesTests.cs`, and the route in `SwaggerCoverageTests.cs`.
- **Not changed yet:** Home, the welcome page, Stanley's sentence and the trip banner still use `nextSteps()`, `urgentStep()` and `STAGE_ACTION`. G2 switches them to the guide and retires those.
- **Left for later phases:** visits are still recorded on the client (`stageProgress`), so G2 overlays them on `visit` tasks. Per-traveller counts, skip and later, personal fit and the "all done" state are G3. Insurance, phone setup and bag preparation are still without a screen (section 8), so they are not in the catalogue yet.

**G2, Home rebuilt on the guide (built).**
- `src/guide/view.ts` (pure): `applyVisits` lays the guest's recorded visits over the guide (a `visit` task is done once its screen was opened, via `VISIT_STEP`, the welcome step number it counts for, so visits already kept on the server still count; done tasks drop to the end, a task they blocked opens, primary and counts follow), `openTasks` (at most five), `moreCount`, `doneTasks`, `urgentReason`, `urgentTask`, `stepDoneInGuide`. `useGuideView()` is the guide with visits applied; every surface reads it.
- `StageGuide` (`src/ui/home/StageGuide.tsx`): the stage line with "n of m done" and the real "moves on" sentence with its date, **Do this now** (what, why, "Needs you soon" when urgent, due or opens date, minutes, one button), **Coming up** (up to four more, with a "n more are not shown" link), and **Done** collapsed. When nothing is open it says so and offers "Look ahead" to the first waiting task. It also feeds Stanley's speech dot. It is in `StageHome` (Dream to Book, the trip stages, Remember, on board) and in the two other Home layouts (default, and aboard outside the on-board stages). The essentials home is unchanged.
- One source now: the landing card has no button of its own (the guide's button is just below it), the journey strip's "Next:" link is the guide's first task, `stanleyNext` and `stanleyDot` take the guide (the same five urgent reasons), the Home trip layout and `Journey` no longer show the trip `NextStep` banner (it stays on Me and the trip page until G3), and the welcome page's checks come from the same guide plus its visits.
- Retired: `nextSteps`, `urgentStep`, `STAGE_ACTION`, `HomeFacts.trip` and `.aboard`, the `stage.next.*`, `land.go.*` and `journey.go.*` text (English and the matching Spanish keys, removed, not edited). The welcome page keeps its own list of step links (`STEP_LINKS` in `stageWelcome.ts`). The "browse from where you are" pill after a miss now opens Home, which shows the stage's guide and tiles.
- Tests: `src/guide/view.test.ts` (new), and the Stanley next, Stanley dot, stage Home and hubs tests rewritten on guide fixtures (`src/guide/fixture.ts`). No server change in this phase.
- **Left for G3:** the facts for excursions, dining, packing and so on, per-traveller counts, skip and later, personal fit, and the trip banner on Me reading the guide.

**G3, skip and later, per-traveller counts, personal fit, all done (built).**
- **Skip and later.** A new `guideChoices` document in `/me/state` (`{ skipped: { id: atMs }, later: { id: "yyyy-MM-dd" } }`, limits and checks in `StateRules.cs`). `GuideRules` leaves a skipped or put-off task out (a put-off one returns on its day) and lists them in `hidden` and `deferred`; a task marked `hard` is never left out. The client (`src/guide/choices.ts`, `choicesStore.ts`, a sync binding) lays the same choices over a guide it already has, so a tap takes effect at once. Home's guide shows "Later" (tomorrow) and "Not for me" on every task that can be put aside, a "Put aside (n)" list with "Bring back" (it saves, then reads the plan again), and a polite live-region message.
- **Per-traveller counts.** The trip's documents now carry how many travellers are ready and how many are children; the documents task says "2 of 4 travellers ready" while any are not.
- **Personal fit.** Children in the party add an optional "Look at the kids and teens clubs" task in Prebook. Access needs, first cruise and quiet offers are not read yet (they live in encrypted or client-side documents), so they are left for G6.
- **All done.** With nothing open Home says "You are ahead", then "Next:" with the stage's real move-on line and date.
- **Me.** The trip card's next step (and the trip page's) is the guide's first task for the current trip, falling back to the trip's own next step for other bookings.
- **Already there from G1:** the facts for excursions, dining, packing, travel, packages and assistance come from the checklist's own data, so no new fact builders were needed. Carry-over of payment and documents was built in G1.
- **Not done (moved on):** the three-tap "Make this plan fit me" prompt, and an insurance task (no screen yet, section 8). Both belong with G6's content passes.
- Tests: `choices.test.ts`, the guard test; C# `GuideRulesTests` and `StateTests` written, not run (no `dotnet test`, and `dotnet` is not installed in this shell, so the C# has not been compiled either).

**G3b, "Make this plan fit me" (built).**
- A plain `guideFit` document in `/me/state` (`{ firstCruise, solo, quiet, at }`, checked in `StateRules.cs`) holds three answers. Nothing about health or access is kept in it, and the access-needs answer was left out on purpose: the assistance task already carries that.
- `FitPrompt` (Dream and Discover Home): three toggle buttons and "Save my answers" or "No thanks"; asked once, then a "Change how this plan fits me" button. Saving flushes the sync and reads the plan again (`src/guide/refresh.ts`, also used by "Bring back").
- Rules (`GuideRules`): first cruise adds `prebook.firstTime` (Occasion Starter, `/plan/starter`); quiet drops `prebook.packages`; solo, or a booking with one guest, adds the optional `prebook.solo` (the solo safety timer, `/ship/solo`).
- Tests: `fit.test.ts`; C# `GuideRulesTests` and `StateTests` written, not run or compiled.
- **Still open:** an insurance task (G4, with the other missing screens), and a "meet people" task for solo guests (no suitable screen yet).
