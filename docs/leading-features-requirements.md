# Princess Guest Web App — Industry-Leading Features (Functional Requirements, Companion Document)

Status: **Draft v0.2 — decisions in §22 accepted (2026-11-01). Nothing here is built; Phases H1 (Trust and money), H2 (Disruption Hub and family-at-home) and H3 (Port Day Pilot) are built; H4 is next when you ask for it. See `docs/leading-features-plan.md`.**
Date: 2026-11-01
Companion to: `docs/functional-requirements.md` (the base requirements, 248 IDs) and `docs/gap-analysis-plan.md` (what is built and what is open). Read those first.

---

## 0. Purpose and how to read this

The base document gets the app to **parity and trust**: every stage covered, the five headline competitive features, the complaint-driven fixes of §23. This document asks a different question: **what would make guests choose this app over every other cruise app, and tell their friends?**

- **Section 1** says how the research was done and what it changes in our thinking.
- **Section 2** tests the eight-stage journey model and **extends it to eleven stages** (three new ones, one renamed).
- **Section 3** lists the 12 **signature features**: the short list that actually defines "industry leading".
- **Sections 4–14** are the requirements, grouped by journey stage. Every ID is new (prefixed by stage, e.g. `S6-04`), and none repeats a base ID. Where a requirement extends something already built, the "Builds on" column says what.
- **Sections 15–19** are cross-cutting requirement families that do not belong to one stage: disruption, inclusion, groups, trust, and AI.
- **Section 20** lists web/PWA opportunities and limits.
- **Section 21** is a proposed phase plan (H1–H6, named to avoid the G and numeric phases).
- **Section 22** lists decisions I need from you. **Section 23** records the research gaps. **Appendix** lists sources.

### Priority key

Same MoSCoW as the base document (M / S / C / W), with one addition for this document's purpose:

| Tag | Meaning |
| --- | --- |
| **M, S, C, W** | As in `functional-requirements.md` §0 |
| ★ | **Signature**: one of the 12 features in §3 that carries the "industry leading" claim |

Because the base document already holds all the Musts, almost everything here is **S** or **C**. A requirement is a Must here only if leaving it out would undercut a signature feature.

### Scope rules carried over (unchanged)

- Everything is built against the **mock API and the in-browser layer**; real ship systems, door unlock, NFC, biometrics, AR, on-device scanning and live feeds are **out of reach** and stay deferred (gap analysis §4). Where a feature needs a feed we do not have, it is specified with a **simulated source** and flagged *(sim)*.
- US English, USD, one ship (Sun Princess), one cruise (7-night Western Caribbean with Mexico, round trip Fort Lauderdale), per §22.6 of the base document.
- Crew and admin tools stay out of scope; crew behaviour is simulated.
- The **offer-restraint** rule (UX-02) and **navigation depth budget** (UX-01) bind every requirement below. Nothing here may add a screen that breaks the two-tap rule for the top 15 tasks.
- Device testing, Playwright and browser testing stay out per `CLAUDE.md`.

### Confidence note

Competitor and market facts come from web research done 2026-11-01 (see Appendix). Many sources are trade press, vendor reports and cruise blogs; some are marketing. Facts that matter to a requirement are tagged **(verify)**. I did **not** re-audit `src` against this document: the "Builds on" column comes from a keyword check of `src/domain` and `src/ui`, so confirm before scheduling any item.

---

## 1. Research summary: what "industry leading" actually means

### 1.1 What the 2026 research says

1. **The industry is maturing, not leaping.** A 2026 survey of 21 cruise apps found that most have the same core set (activities, chat, deck maps, dining, itinerary, folio, notifications, schedules, spa) and that 2026 is "less about new adoption and more about maturation". The things only **one or two** apps have are the open field: biometric login, an AR game, a travel companion beyond the cruise, a guest-services chatbot, a virtual art guide, and **live tracking of travel-party members**.
2. **Named gaps with no one filling them:** sustainability tracking (none found), health and safety features (no new functionality), accessibility (screen reader and high-contrast support in only a handful of apps), and **personalisation that stays static** once aboard ("strong at the infrastructure level, but the onboard experience remains relatively static").
3. **AI is moving from planning to doing.** Princess (ChatGPT, Sep 2026; Claude, Oct 2026), Virgin Voyages (assistant "Rovey") and MSC (multilingual onboard assistant on *Belissima*) show the direction: assistants that **curate and adapt**, not just answer. Sources expect proactive suggestions of drinks, dining times and excursions, but this is forward-looking. More than half of onboard revenue is reportedly booked before boarding, which makes the pre-cruise stages the commercial centre of gravity **(verify)**.
4. **Offline-first booking** is predicted for 2027 and called difficult (conflict handling when connectivity drops mid-transaction). We already have an outbox and atomic-change rules, so this is a place we can lead.
5. **Trust incidents are real and fresh.** On 2026-11-01 a Carnival programme that marks guests who prepaid gratuities drew public criticism. Gratuity creep and service charges are an ongoing grievance. A visibly **non-shaming, fee-transparent** app is a differentiator in itself.
6. **Inclusion is a service, not a toggle.** Royal Caribbean, Carnival (KultureCity "sensory inclusive") and Celebrity run autism-friendly programmes with social stories, sensory bags and lanyards, and quiet films. None of this is in their apps as first-class features.
7. **Solo and social cruisers are being served by third-party apps** (Seaya, Cruise Friends, Sea Meet, CabinMate, Cruzero), which proves unmet demand for meeting people on your own sailing, finding a cabin mate and small-group plans.
8. **Port crowding is a growing problem.** Ports get congested (a Celebrity call at Santorini was cut short by three hours in 2025); guides tell people to book early or stay aboard on crowded days. Nobody gives guests a crowd-aware port day.
9. **Travel advisors want visibility** into clients' pre-cruise registration progress. This is a B2B2C opportunity, but crew/agent tools are out of scope for us; we can still offer a *consented, shareable progress link*.

### 1.2 What this means for strategy

The base document's strategic position is "reliable, honest, accessible, offline". That wins trust. To **stand out** we add four more positions, each of which a competitor could copy but none currently owns:

| Position | One line | Where it lives |
| --- | --- | --- |
| **Anticipatory** | The app notices what is about to go wrong (or right) and acts before you ask, within limits you set | §3 signatures 1–4, §19 |
| **Whole-journey** | The app is useful from "dreaming" to "next trip", including the unglamorous hours (the flight, the customs queue, the drive home) | New stages 0, 4A, 6A, 8 |
| **Protective** | Money, health, family and safety get active protection, not just information | §3 signatures 5–8, §15, §17 |
| **Humane** | Designed for the whole guest: older, anxious, neurodivergent, disabled, solo, grieving, and the people who love them at home | §16, §3 signatures 9–12 |

---

## 2. Are eight stages enough? (No: eleven)

### 2.1 The base model

Stages 1–8 in `functional-requirements.md`: Discover, Book, Manage and prepare, Pre-book and personalise, Check-in and embarkation, On board, Disembarkation, Post-cruise.

### 2.2 What it misses

I tested the model against the whole life of a trip, including time outside the ship, and against how guests actually behave.

| Gap in the model | Evidence | Fix |
| --- | --- | --- |
| **Nothing before "Discover".** People do not start by searching; they are inspired by a friend, a video, a milestone birthday or a conversation. The decision to cruise is made before any search | Competitors' share and invite features, third-party "who is on my sailing" apps; AI-first planning (Princess in ChatGPT) | **Add Stage 0: Dream and decide** |
| **"Get to the ship" is smeared across stages 3 and 5.** The flight, hotel, drive, parking and a delayed arrival are the commonest cause of a ruined start (and a missed sailing), yet only MNG-10 and CHK-05 touch it | Closed-loop and fly-in travel realities; base §23 embarkation specifics | **Add Stage 4A: Get to the ship** (travel day, door to terminal) |
| **Port days are a different product from sea days.** The base model puts both in "On board". Port days have a different rhythm (a fixed window, a hard deadline, foreign ground, tender queues, money and safety ashore) and need their own planner | Port crowding, tender, time-zone and missed-ship issues dominate guest anxiety | **Split Stage 6 into 6 "Sea days and ship life" and add Stage 6A: In port** |
| **Post-cruise ends at "rebook".** The relationship continues: memories, learning ("what would I do differently?"), staying in touch with people met, and the next trip. This is a loop, not a line | 2026 app report: only one or two apps have a "travel companion beyond the cruise" | **Rename Stage 8 to "Remember, return and refer"**, and make its output feed Stage 0 and Stage 1 |
| **Disruption has no home.** Storms, skipped ports, medical diversions, delays and outages cut across every stage | Base §23.5 scenarios; hurricane-season sailings | **Cross-cutting family: Disruption and recovery (§15)** |
| **Inclusion, groups, trust and AI cut across every stage.** | Persona set; competitor gaps | **Cross-cutting families (§16–§19)** |

### 2.3 The extended journey

```
 0  Dream & decide            (new)
 1  Discover
 2  Book
 3  Manage & prepare
 4  Pre-book & personalise
 4A Get to the ship           (new)
 5  Check-in & embark
 6  Sea days & ship life      (On board, narrowed)
 6A In port                   (new, recurring)
 7  Disembark
 8  Remember, return & refer  (renamed Post-cruise; loops back to 0)

 Cross-cutting: Disruption & recovery · Inclusion & wellbeing · Groups & family ·
                Trust & money · AI & anticipation · Delight · Platform
```

Is this sufficient? **Yes for the guest's own journey.** Two other life-cycles exist but are deliberately not stages: the **household at home** (family and friends following the trip) is served by a cross-cutting feature (S3-08, S6-24), and the **advisor/agent** relationship is a consented sharing feature (XT-09) rather than a journey, because crew and agent tools are out of scope.

### 2.4 How the new stages map to the base IDs and to the app's routes

| New stage | Closest base IDs it extends | Home in the app (proposed) |
| --- | --- | --- |
| 0 Dream & decide | DIS-01, DIS-06, DIS-08, DIS-09 | Public landing, `/home/cruise` |
| 4A Get to the ship | MNG-10, CHK-05, CHK-15, DEB-05 | Plan tab → "Getting there" |
| 6A In port | POR-01…POR-13 | Port day card on Today; `/aboard/ports` |
| 8 Remember & return | POS-01…POS-14, DIS-08 | Trip history; Home when disembarked |

---

## 3. The 12 signature features (★)

These are the features I would put in the product's story. Each is a combination of smaller requirements below, so each can be built in slices.

| # | Signature | What the guest experiences | Why it stands out | Requirements |
| --- | --- | --- | --- | --- |
| 1 | ★ **Autopilot day** | The day plan reflows itself when something changes (a show fills, rain moves the pool event, a tender runs late) and offers one-tap, reversible swaps. You approve; it never acts silently | Industry plans are static lists; Virgin's Planner showed how trust collapses when a schedule is wrong. This keeps the schedule true and adapts to you | S4-01, S6-02, S6-03, XA-02 |
| 2 | ★ **Port Day Pilot** | A crowd-aware, all-aboard-safe plan for each port: leave-by time, tender timing, ships in port, fair taxi prices, scam alerts, plan B, accessible route, "I'm back aboard" | Nobody plans the port day as a time-boxed mission with a safety net | S6A-01…S6A-08 |
| 3 | ★ **Door to door** | One timeline from your front door to your cabin, aware of your flight, the hotel, the terminal and the ship's window, with a one-tap "I'm delayed" | Embarkation is where trips go wrong, and no cruise app owns the journey before the terminal | S4A-01…S4A-06 |
| 4 | ★ **Disruption Hub** | When anything goes wrong, one screen answers: what happened, what it means for me, what has already been done for me, what I can choose, and how to reach a human | Cruise apps push alerts and make you hunt. This is a guided recovery | XD-01…XD-08 |
| 5 | ★ **Money shield** | Bill-shock prevention: roaming-at-sea warnings, charge confirmation over a limit, "explain this charge", package-use meter, fee ledger, and a no-shaming gratuity stance | The strongest trust differentiator, aligned with this week's gratuity controversy | XT-01…XT-06, S6-06 |
| 6 | ★ **Cabin chooser** | Choose a cabin by sleep quality, motion, noise, sun side and view, with plain reasons, not just a deck number | Picking a cabin is the biggest irreversible decision and is made nearly blind | S1-02…S1-06 |
| 7 | ★ **Family-at-home view** | A read-only, consented page for the people who stay behind: where the ship is, "we are OK" check-ins, the itinerary, and an official disruption notice | Addresses a real anxiety, and the trip becomes shareable | S3-08, S6-24, XD-07 |
| 8 | ★ **Calm mode and visual schedule** | A sensory-friendly, predictable experience: a social story before you sail, a visual day schedule, quiet-space finder, noise and crowd information, a "take me back to my cabin" button | Peers do this with sensory bags and staff training; none do it in the app | XI-01…XI-05 |
| 9 | ★ **Ship Pulse** | A live (simulated) sense of the ship: short lines, standby seats, quiet spots, busy pools, "good time to go" | Busyness is the most-wished-for ship-data feature; we present it honestly with age and confidence | S6-01, S6-04, S6-05 |
| 10 | ★ **Split ledger** | Two families share a trip and costs: who owes what for shared excursions, dinners and taxis, settled with a tap outside the ship account | A real friction for the Harper/Brennan scenario; no app does it | XG-03, S6A-06 |
| 11 | ★ **Ask your cruise** | An assistant that answers from your own data ("What time is dinner?", "Why was I charged $18?", "What do I still need to do?") and can do things with explicit confirmation, always undoable | Grounded on the guest's data, with a confirm-and-undo discipline that the competitors' planning chat apps do not have | XA-01…XA-06 |
| 12 | ★ **Memory loop** | The trip becomes a recap, a memory book, a "what I'd change" note and a seeded next-trip plan; friends made on board can reunite | Closes the loop from post-cruise back to dream, and the 2026 report shows almost no app does this | S8-01…S8-08 |

---

## 4. Stage 0 — Dream and decide (new)

Goal: help someone decide to cruise at all, and to cruise *this* cruise, without pressure.

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| S0-01 | S | **"Is this for me?" honest-fit page**: who this cruise suits and who it does not (e.g. "if you dislike tenders, Belize City will frustrate you"; "if you want quiet, choose these decks"), based on the persona set; no marketing language | DIS-06 |
| S0-02 | S | **First-timer reassurance**: plain answers to the real fears (seasickness, cost, crowds, "what if I hate it?", "do I have to dress up?", "what if I get ill?"), with a cruise-jargon glossary (muster, tender, folio, Medallion, port side); readable and read-aloud ready | DIS-01 |
| S0-03 | S | **Budget-first search**: "I have $X for the week, two adults" returns what each room type, package and excursion budget looks like and how far the money stretches, instead of starting from a cabin | DIS-12, `tripCost` |
| S0-04 | S | **Sailing quality indicator** per departure: expected crowd level at each port (ships in port that day), weather season, hurricane-season risk, school-holiday family load, and price trend, each with a plain "why" *(sim)* | DIS-04 |
| S0-05 | S | **Invite a friend**: a shareable, link-previewable invitation card ("Come cruise with me on 21 March") that opens an anonymous preview and, when accepted, forms a **dream board** and later a linked travel group | DIS-08, DIS-17, MNG-16 |
| S0-06 | C | **Dream board**: shared wish list (cabin, excursions, dinners) with votes, comments and a running "if we all went" total | DIS-17 |
| S0-07 | S | **Continue from my assistant**: import a plan started in an external AI assistant (Princess's ChatGPT or Claude app) via a pasted summary or shared link, parsed into a draft itinerary the guest can confirm; works without the external app | DIS-09 |
| S0-08 | C | **Real-guest day stories**: short, moderated "a day on this cruise" stories by persona (first-timer, accessible traveller, family with a toddler), linked to the same events the app offers | DIS-07 |
| S0-09 | C | **Occasion starter**: begin from a milestone (honeymoon, 70th birthday, memorial, family reunion) and get a suggested shape of trip, with sensitive wording for bereavement and recovery trips | PRE-07 |
| S0-10 | S | **Decision confidence summary**: one page of "what you have decided, what is left, what could change your mind", exportable to a person you are deciding with | DIS-08 |

---

## 5. Stage 1 — Discover (extensions)

Focus: the cabin, the price, and the honesty.

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| S1-01 | S | **Fair-price indicator**: for a sailing and room type, show whether the current fare is low, typical or high against the sailing history *(sim)*, and which fare tier is the best value for the guest's stated habits; recommend "you probably do not need Premier" when true | DIS-11, PRE-06 |
| S1-02 | ★ S | **Sleep-quality score per cabin**: from what is above, below and beside it (night club, galley, lifts, thrusters, laundry), shown as a plain rating and reasons, never hidden for the sake of a sale | BOK-03 |
| S1-03 | ★ S | **Motion score**: how much a cabin pitches and rolls (midship, low decks are calmer), with a seasickness-prone filter | BOK-03 |
| S1-04 | ★ S | **Sun-side planner**: for this itinerary, which side of the ship gets morning and afternoon sun and which balconies are shaded in port, from the ship's heading *(sim)* | BOK-03 |
| S1-05 | ★ S | **Noise and nearness warnings**: near lifts, stairs, pool deck, theatre, accessible-cabin notes, connecting-door sound, with a "quiet cabins" filter | BOK-03 |
| S1-06 | ★ C | **Real view and photos from guests** for the actual cabin (not a stock picture), plus obstruction notes (lifeboats) | BOK-03, DIS-13 |
| S1-07 | S | **Decision comparison matrix**: two or three cabins or fares side by side on price, size, motion, noise, sun, accessibility and what is included | DIS-03 |
| S1-08 | S | **Plain-language "what is not included"** list on every fare, so the first total is the real total | BOK-04, DIS-11 |
| S1-09 | C | **Share-with-my-advisor link**: a consented, read-only view of a shortlist or booking progress that an advisor can open without an account | DIS-15 |

---

## 6. Stage 2 — Book (extensions)

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| S2-01 | S | **"What happens if" simulator**: before paying, the guest picks a hypothetical (cancel in 30 days, one traveller cannot go, a price drop) and sees the exact cost in dollars and dates, not policy text | BOK-08 |
| S2-02 | S | **Price-drop watch and re-pricing**: after booking, watch the fare for the same cabin and tell the guest if lowering it is allowed, with the steps and the saving; one-tap request to a human (mock) | BOK-05, PRE-17 |
| S2-03 | S | **Short free hold**: hold a cabin for 48 hours with a visible countdown, no card; the hold lapses in plain words and returns the cabin to sale (no fake urgency elsewhere) | BOK-17 |
| S2-04 | S | **Pay-your-share links**: each member of a party or group pays their own part by link, with a running ledger of who has paid, when each part is due, and automatic reminders that never shame | MNG-03, BOK-06 |
| S2-05 | S | **Payment calendar**: all instalments, final-payment date and what happens if missed, as a subscribable calendar and a plain schedule | MNG-03 |
| S2-06 | S | **Accessibility-first booking**: capture mobility, hearing, vision, sensory, medical-device, service-animal and companion needs once, flag the right cabin categories, and carry the needs forward to every later step so nobody repeats them | MNG-12, A11Y-05 |
| S2-07 | C | **Guaranteed-cabin odds**: for guaranteed fares, explain which decks and types are likely and unlikely, using history *(sim)*, with an upgrade-probability note | BOK-03 |
| S2-08 | S | **One-page plain-English trip contract**: the booking, what is paid, what is not, rules, deadlines and contact, with read-aloud and a large-print/PDF version | BOK-19, INC-01 |
| S2-09 | C | **Carbon estimate at booking**: an honest range with the method visible and no green-washing claims; opt-in | XT-08 |
| S2-10 | S | **Draft-safe checkout**: the booking is saved on every field, including across offline loss and app updates, with a "continue where you stopped" card on Home | BOK-01, PERF-04 |

---

## 7. Stage 3 — Manage and prepare (extensions)

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| S3-01 | S | **Readiness score per person**: one number and a short plain list of "what is left", weighted by deadline, for each traveller; the party view shows who is behind | MNG-02, MNG-16, `readiness` |
| S3-02 | S | **Document sanity checks**: rule-based checks that the name on the passport matches the booking, expiry is far enough past the return, birth certificate plus ID combos are valid for the guest's citizenship, children's consent letters, with a fix path *(rules, not scanning)* | MNG-05, MNG-11 |
| S3-03 | S | **Weekly "what to expect" companion**: from 8 weeks out, one short, calm note per week tuned to the persona (first-timer, mobility, family) and ending in a single action; a hard weekly cap, off with one tap | MNG-07 |
| S3-04 | S | **Hurricane and storm watch**: from booking, the likelihood and meaning of a storm affecting this sailing, what the line may do, and what you can do, with plain language and no alarm *(sim)* | MNG-09, MNG-15 |
| S3-05 | S | **Medical readiness card**: prescriptions (generic names), allergies, conditions, device power needs, vaccines, and a printable one-page summary the guest can show a ship doctor; stored locally with consent controls; a pre-cruise notice to the ship's medical centre is optional and consented | MNG-12, SAF-03, SEC-07 |
| S3-06 | S | **Packing for this ship**: ship rules (prohibited items such as irons, extension cords, alcohol limits **(verify)**), voltage and outlet types, dress code nights, with shared family lists and check-offs that work offline | MNG-08, `packing` |
| S3-07 | S | **Bill-shock shield**: what happens to your phone at sea (roaming, ship cellular, Wi-Fi), the exact steps to avoid charges, and a pre-sailing checklist (airplane mode, data roaming off, ship Wi-Fi plan); a guided "phone setup" with plain steps | NET-02, XT-01 |
| S3-08 | ★ S | **Family-at-home page**: a read-only, consent-controlled link for named people at home showing the itinerary, the "ship is here" status page, and the check-in messages the guest chooses to send; no live location of the guest, only ship-level information; revocable at any time | MNG-16, SEC-05 |
| S3-09 | S | **Who is on my sailing (opt-in)**: solo travellers, hobby groups and families find each other before boarding; a moderated, safety-first directory that exposes only what each person chooses, with block and report | ENT-07 |
| S3-10 | C | **Cabin-mate matching** for solo travellers sharing a cabin, with preferences, mutual consent and safety guidance **(verify the line's policy)** | BOK-09 |
| S3-11 | S | **Away-from-home checklist**: pets, mail, bills, work out-of-office, medication supply, a home safety checklist, shareable | MNG-07 |
| S3-12 | C | **Money plan**: spending money split into cash, card on ship, and ashore, a daily budget by day type and a tipping cash guide | ACC-02, `budget` |
| S3-13 | S | **Dietary and allergy pre-flag with confirmation**: the galley's acknowledgement (simulated) is shown as a status, so the guest knows it was received, not just sent | BOK-18, DIN-03 |
| S3-14 | C | **Kids' preparation pack**: a child-friendly story of the trip, a muster-drill preview, club introductions and a "my cabin" drawing to personalise | PRE-08 |

---

## 8. Stage 4 — Pre-book and personalise (extensions)

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| S4-01 | ★ S | **Build my week optimiser**: one tap proposes a conflict-free plan across excursions, dinners, shows and rest, using budget, energy level, mobility, tender timing and all-aboard windows; a **pace slider** (relaxed, balanced, packed), with alternatives and the reason for each choice | PRE-12, PRE-15 |
| S4-02 | S | **Slot watch**: for a sold-out dinner, show or excursion, watch for cancellations and book when one opens (with the guest's standing consent and a spending cap); swap-watch to move to a better slot without losing the current one | PRE-14, DIN-10 |
| S4-03 | S | **Honest difficulty ratings**: excursion difficulty in real terms (distance, steps, heat, shade, seats, restrooms, wet footing, sitting time), not "moderate"; matched to the guest's mobility profile | PRE-01 |
| S4-04 | S | **Independent versus ship excursion comparator**: cost, risk, flexibility, and what the line does if you are late, with a calm, fair explanation | POR-08 |
| S4-05 | S | **Group poll**: the travel group votes on excursions or dinners with a quorum, and the winning plan is booked for all with one confirmation each | PRE-13 |
| S4-06 | S | **Surprise mode for celebrations**: plan a birthday or anniversary (cake, flowers, photographer, table) with items hidden from the recipient and cabin-mates until the day; keep secrecy rules so a shared itinerary does not leak | PRE-07, PRE-13 |
| S4-07 | S | **Explainable taste profile**: the app learns likes and dislikes from ratings and choices, shows "why am I seeing this", and lets the guest edit or switch off any inference; no hidden profiling | CNT-02, XT-05 |
| S4-08 | S | **Budget bar**: a visible total of everything pre-bought against the guest's chosen budget, with a gentle note at 80% and 100% | ACC-02, `tripCost` |
| S4-09 | S | **Child brief**: allergies, bedtime, toilet-training, buddy preferences, collection authorisations and a recent photo, entered once and shared with the right club only | PRE-08 |
| S4-10 | C | **Rhythm profile**: early bird or night owl, nap needs, and "no early starts" preferences shape suggestions everywhere | S4-01 |
| S4-11 | C | **Gifts that read the room**: bundle suggestions for occasions that respect the guest's budget and dietary needs, and never appear on task-critical screens | PRE-07 |

---

## 9. Stage 4A — Get to the ship (new)

Goal: the journey from home to the terminal, including the flight, hotel, parking and a delayed arrival.

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| S4A-01 | ★ S | **Door-to-ship timeline**: one timeline from leaving home (or the hotel) to the cabin, with the guest's flight, transfers, hotel, bag drop and the boarding window; each leg shows buffer time and a plain "you are on track / at risk" status | MNG-10, CHK-05 |
| S4A-02 | ★ S | **Fly the day before**: a clear recommendation, with the cost of a hotel against the cost of missing the ship, and the line's position on missed embarkation **(verify)** | MNG-10 |
| S4A-03 | ★ S | **"I'm delayed" button**: one tap tells the line (mock) and the travel party, shows the next steps (call, port agent, catch-up options), and keeps a record for insurance claims | SUP-08, S4A-05 |
| S4A-04 | S | **Flight watch**: the guest enters a flight number and the app shows its status and a revised leave time *(sim)*; if a delay threatens the sailing the app raises the "at risk" state early | MNG-10 |
| S4A-05 | S | **Insurance-claim helper**: a record of what went wrong and when (delay, receipts, messages) in a form a claim needs; informational, no policy sales | BOK-10 |
| S4A-06 | S | **Ground transport**: book or find shuttles, shared rides and accessible vans; ride-share pick-up and drop-off points for the terminal **(verify)** with a map that works offline | MNG-10, DEB-05 |
| S4A-07 | S | **Drive-in mode**: parking reservation, route, fuel stops, "bags first, then park" guidance, a countdown to the arrival window, offline directions | MNG-10, CHK-15 |
| S4A-08 | S | **Share my ETA** with the travel party and the family-at-home page; a visible "one of us is delayed" flag so the others plan around it | MNG-16, S3-08 |
| S4A-09 | C | **Bag photo log**: photograph each bag before drop-off, stored on the device for lost-luggage claims | CHK-09 |
| S4A-10 | S | **Arrival-day packing split**: a carry-on checklist versus the checked bags (medication, documents, swimwear, chargers) because stateroom bags may arrive late | CHK-15 |
| S4A-11 | S | **Hotel handoff**: pre-cruise hotel and late-checkout notes, luggage hold, and the leave-hotel time computed from the guest's arrival window | BOK-15 |
| S4A-12 | S | **Terminal weather and traffic conditions** along the route *(sim)*, with "leave earlier" suggestions | CHK-05 |

---

## 10. Stage 5 — Check-in and embark (extensions)

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| S5-01 | S | **Smart arrival window**: recommends a window from the terminal's expected queue *(sim)*, the guest's travel time and mobility needs, and allows a swap with the consequences shown | CHK-01 |
| S5-02 | S | **Embarkation forecast**: expected walk and queue times for each step (terminal, security, photo, gangway) with an accessible lane and priority assistance visible, and a **quiet lane** option for guests who need low stimulation | CHK-12, XI-02 |
| S5-03 | S | **First three hours plan**: after boarding, a short tailored plan (lunch tip, muster, find your cabin, when your bags arrive, sail-away) that adapts to whether the cabin is ready | CHK-15 |
| S5-04 | S | **Stateroom quick-start card**: Wi-Fi connect steps, TV, safe, thermostat, power, lights, emergency, steward's name, the "what to do first" in five lines | ROM-01 |
| S5-05 | S | **Family boarding plan**: who goes ahead with the children, who parks, and where to meet, with each person's check-in status in one view | MNG-16 |
| S5-06 | C | **Welcome-aboard moment**: a short, personal, non-promotional greeting using preferences the guest chose to share (occasion, name pronunciation, dietary), designed for delight, not selling | XA-07 |

---

## 11. Stage 6 — Sea days and ship life (extensions)

### 11.1 Anticipation and adaptation

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| S6-01 | ★ S | **Ship Pulse**: simulated live crowd levels per venue (pools, buffet, theatre, spa, guest services), with a plain "quiet / busy" label, age of data and confidence, and a "good time to go" suggestion; never shown without its age | OB-05 |
| S6-02 | ★ S | **Autopilot day**: when an event changes or the weather turns, the day plan proposes a reflowed day with one-tap accept, edit or ignore; changes are previewed, reversible, and logged; cancelled items stay visible until the day ends | OB-08, OB-09 |
| S6-03 | ★ S | **Gentle mode**: for older guests and anyone who asks, the plan builds in rest breaks, hydration and sun reminders based on weather and UV *(sim)*, avoids long walks back to back, and keeps notifications to a short list the guest chose | ACS-01 |
| S6-04 | ★ S | **Quiet-space finder**: calm spots by deck and time, noise level, shade, seating and accessibility, as a map layer and a list | OB-04 |
| S6-05 | ★ S | **Standby and shortest-line**: for shows, dining and services, show the current queue and the likeliest short window, with a virtual queue where the venue supports it | DIN-02, ENT-08 |
| S6-06 | ★ S | **Spend coach**: pacing against the budget ("on track", "above pace"), drink-package use ("9 of 15 today"), package value so far, and the end-of-cruise forecast; tone is informational, never shaming | ACC-02, DIN-06 |
| S6-07 | S | **Sun, moon and stars guide**: tonight's sunset, moonrise, visible planets and constellations at the ship's position and heading *(sim)*, and the best deck to see them; a "sail-away time" prompt for the evening | OB-06 |
| S6-08 | C | **Wildlife and sightings log**: crew-curated (simulated) dolphin, whale and bird sightings with time and side of ship | OB-06 |
| S6-09 | S | **Seasickness first aid**: where on the ship is calmest, what helps, what the medical centre can provide, and a one-tap request, with a clear "when to see the doctor" | SAF-03 |
| S6-10 | S | **Lounger fair-use**: a voluntary timed hold on a pool or deck lounger, a visible "returns in X minutes" tag, and a way to report an abandoned hold, designed to cut the towel-hold conflict | ENT-03 |

### 11.2 People, family and safety

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| S6-11 | S | **Meet people**: opt-in, interest-led meet-ups ("find a fourth for trivia", "solo travellers' table", hobby clubs), with icebreakers, daytime public venues only, block and report, and no profile exposure beyond what the guest chose | ENT-07, S3-09 |
| S6-12 | S | **Rendezvous**: "meet me at X at time Y", with each person's "on my way / here" state, a fallback if someone has no signal, and a quiet note to the others if a child is late | MSG-07 |
| S6-13 | S | **Kids' daily report**: with the parent's consent, a club sends a short summary of what the child did (activities, a photo if the parent allows), and pick-up reminders ("ready in 10 minutes") | ENT-04 |
| S6-14 | S | **Teen agreement**: a short, editable agreement between parent and teen for zones, check-in times and sharing; shown to both and used by the safe-zone alerts | SAF-05 |
| S6-15 | S | **Caregiver check-in**: an optional "I'm OK" daily tap for an older guest, visible to a named family member (on board or at home), with a gentle reminder if missed and an escalation the guest agreed to | INC-01, S3-08 |
| S6-16 | S | **Take me back to my cabin**: one very large button giving the simplest route from where the guest is, in words, with a call-for-help option; designed for confusion, fatigue or memory problems | OB-04, SAF-08 |
| S6-17 | S | **Solo-safety buddy**: a timed check-in for solo travellers on a late-night walk or an ashore trip; if the timer is missed, a contact is told | SAF-04 |
| S6-18 | S | **Do-not-disturb the world**: scheduled quiet times that hold every non-critical notification, with safety and critical notices always getting through | NOT-02 |

### 11.3 Ship life and community

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| S6-19 | S | **You said, we did**: one-tap feedback on any venue or event, and a ship-wide board of what guests asked for and what the ship changed (curated, simulated), so feedback visibly leads somewhere | POS-02 |
| S6-20 | S | **Dining that remembers**: ratings of dishes build a personal favourites list; first-time guests get a gentle dress-code guide; table preferences (big table, quiet table, window) and a "shared table matching" for solo guests | DIN-08 |
| S6-21 | S | **Move and play**: step and deck-lap challenges, family and team scoreboards, achievements for every age, all optional and quiet by default | ENT-05 |
| S6-22 | S | **Daily journal**: the day auto-assembles as a timeline of places, events, meals and photos the guest chose to keep, with a note field; it feeds the recap | POS-03 |
| S6-23 | C | **Crew kudos**: thank a named crew member with a short note that the crew can see; a gratuity view that is **never** a public or staff-visible mark of who tipped | XT-04 |
| S6-24 | S | **"We're OK" postcards**: a one-tap, pre-written message with a chosen photo for the family-at-home page, sent when the guest has signal; queued offline | S3-08 |
| S6-25 | S | **Lost and found, live**: report a lost item with a photo and place; browse the found items by deck; a match notification | DEB-06 |
| S6-26 | C | **Ask a crew member**: a structured "ask the ship" for facts that are not a service request ("where does the ship go next?", "what is the engine room tour?") answered from curated content | OB-06 |

---

## 12. Stage 6A — In port (new, recurring)

Goal: make each port day a time-boxed mission with a safety net. Mexican, Belizean and Honduran ports for the reference cruise are specifics to author.

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| S6A-01 | ★ S | **Port Day Pilot**: one plan for the port day computed backward from the all-aboard time in ship time, including tender or pier walk, the return queue and a safety buffer; it shows the **leave-by time** and updates when anything changes | POR-02, POR-11 |
| S6A-02 | ★ S | **Crowd and ships-in-port**: how many ships are docked today and the expected crowd, with the quietest hours for key sites *(sim)* and a "stay aboard, the ship is quiet" note when a port is crowded | POR-01 |
| S6A-03 | ★ S | **Fair-price card**: a rate card for taxis, tours and tips for common routes, a "do not pay more than" line, scam and pressure-selling alerts, and how to find an official taxi stand | POR-01, POR-07 |
| S6A-04 | ★ S | **Plan B**: a rainy-day, too-hot, tender-delayed or low-energy alternative automatically attached to each plan, selectable in one tap | S6-02, S6A-01 |
| S6A-05 | ★ S | **"I'm back aboard"**: a one-tap confirmation that tells the party the guest is back; if someone is not back at a chosen time (for example 45 minutes before all-aboard) the party is nudged and the gangway guidance is shown | POR-02 |
| S6A-06 | ★ S | **Shared port plan and split costs**: the group agrees on a plan, splits the taxi or tour cost in the ledger, and sees each other's "leaving / back" state | XG-03 |
| S6A-07 | S | **Pocket phrasebook and etiquette**: key phrases with audio (pre-recorded, not translation), customs, tipping norms, what is polite and what is not; allergy phrase cards (for the nut-allergic child, in Spanish) | POR-09 |
| S6A-08 | ★ S | **Port-day safety**: advisories (heat, water, rip currents, areas to avoid), local-law notes (for example drugs, vaping, camouflage clothing, coral and shell protection **(verify)**), and safe-return guidance, with a calm tone | POR-07 |
| S6A-09 | S | **Don't bring it back**: a pre-landing check of what cannot be brought home (coral, turtle shell, certain foods and plants, counterfeits) and duty-free limits, linked to the customs screen on the way home | DEB-04, `customs` |
| S6A-10 | S | **Self-guided walks**: short offline audio-and-map walks for each port, with accessible variants and a "where to sit" and "restroom" layer | POR-06 |
| S6A-11 | S | **Beach and pool day-pass finder**: options from the ship's partners and fellow guests (curated), with price, distance and a crowd signal *(sim)* | POR-10 |
| S6A-12 | S | **Kids and prams ashore**: shade, restrooms, stroller access, food and changing options for each port | POR-12 |
| S6A-13 | S | **Support local, spend wisely**: reef-safe sunscreen, a directory of local vendors and what is a fair souvenir price; opt-in, no commission steering | XT-08 |
| S6A-14 | C | **Port snapshot**: a shared photo set for the port day for the recap and the group | S8-01 |
| S6A-15 | S | **Tender day mode**: a combined tender ticket, wait, the last tender back and weather-switch state (Roatán) in one card, with accessible-tender instructions | POR-04, POR-12 |

---

## 13. Stage 7 — Disembarkation (extensions)

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| S7-01 | S | **Flight-aware disembark choice**: recommends the option and group from the guest's flight, with a computed leave-by and a note about early flights; warns when a plan is risky | DEB-02, `disembark` |
| S7-02 | S | **Cabin sweep checklist**: a last look in the safe, drawers, chargers, under the bed, with a one-tap "all checked" and a photo option | DEB-06 |
| S7-03 | S | **Bag night**: tag status, the countdown to the hallway deadline, and "my bags are out / collected" states | DEB-07 |
| S7-04 | S | **Customs pre-fill**: from the guest's shop and port purchases (with consent), draft the declaration items and duty-free amounts, with the official form still done officially | DEB-04, `customs` |
| S7-05 | S | **Bill line-by-line explainer**: each charge in plain English, with a one-tap "question this" that opens a dispute before the last day, and the gratuity-adjust window | ACC-06, XT-02 |
| S7-06 | S | **Low-stress mode for older guests**: slower pacing, extra buffer, accessible assist booked, no promotions | ACS-01, S6-03 |
| S7-07 | S | **Meet-up and ride-pool**: agree where to meet outside and pool a ride with another party, in the ledger | XG-03, DEB-05 |
| S7-08 | S | **Three-tap farewell**: "one moment I will remember" and a rating of the whole cruise captured while fresh, with detail optional; feeds the recap | POS-02 |
| S7-09 | S | **After-cruise health follow-up**: a consented note at 3 and 7 days to report illness after the trip and, if unwell, what to tell a doctor; supports the ship's outbreak tracking | SAF-03 |
| S7-10 | S | **Day-of-leaving onward plan**: ground transport, hotel late-checkout, airport check-in prompts and a "take your time" option | DEB-05 |

---

## 14. Stage 8 — Remember, return and refer (renamed)

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| S8-01 | ★ S | **Cruise "wrapped"**: shareable cards with the trip's stats (nautical miles, ports, steps, favourite spots, dishes, shows) in a quiet design; **drinks totals are opt-in and off by default**; shareable as images, never auto-posted | POS-03, `recap` |
| S8-02 | ★ S | **Memory book**: a printable or PDF book of the journal, photos the guest chose, maps and notes; generated on the device; available offline | POS-03, POS-04 |
| S8-03 | ★ S | **What I'd change**: a short reflection on what to do differently next time (a package that was or was not worth it, a cabin issue, a port to skip), kept as private notes and shareable to friends | POS-02, PRE-06 |
| S8-04 | ★ S | **Package hindsight**: "you used $X of $Y", with what a different fare would have cost, so the next purchase is based on experience, not guesswork | PRE-06 |
| S8-05 | ★ S | **Seeded next trip**: a draft plan for a repeat or related trip that carries the lessons (cabin, packages, shore days, dinners) and the price watch; booked only on the guest's confirmation | POS-06 |
| S8-06 | ★ S | **Stay in touch**: people met on board can opt in to a mutual contact exchange, and a "sail again together" group is created for the next sailing; strict consent, block and report | POS-10, ENT-07 |
| S8-07 | S | **Anniversaries**: a "this day last year" memory, and an optional anniversary prompt; quiet, easily switched off | POS-03 |
| S8-08 | S | **Expense and tax export**: receipts and the folio as a clean CSV and PDF for expense claims or reimbursement | POS-01 |
| S8-09 | S | **Complaint-aware marketing pause**: while a complaint or low rating is open, all marketing is paused and a human contact is offered; resumed only after resolution | POS-11, UX-02 |
| S8-10 | S | **Loyalty in plain words**: status, the next tier, how many days away, and what each benefit is worth, with no pressure and no countdown | POS-05 |
| S8-11 | S | **Honest referral**: a shareable recommendation (cabin, dinners, ports) with the guest's own tips; the credit for both sides is shown before sending | POS-08 |
| S8-12 | C | **Data portability and graceful exit**: the whole trip history as a download, and a deletion that explains what is kept for legal reasons | ACT-06 |

---

## 15. Cross-cutting — Disruption and recovery (XD)

The base document handles itinerary changes (MNG-15), crisis comms (SUP-06) and the scenarios of §23.5, and the app has a `disruption` domain. This family adds the **single recovery experience** that ties them together. Signature: ★ Disruption Hub.

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| XD-01 | ★ S | **Disruption Hub**: one screen for any disruption (storm, skipped port, delay, medical diversion, outage). It shows: what happened, what it means for **me**, what has already been done for me, what I can choose, what is happening next, and how to reach a human | MNG-15, SUP-06 |
| XD-02 | ★ S | **Automatic knock-on fixes**: when a port is skipped or shortened, affected excursions, dinners and transport are listed, refunded or moved automatically, with the result shown before the guest does anything | MNG-15, DIN-10 |
| XD-03 | ★ S | **Compensation clarity**: what was given (credit, refund, cancellation rights), when it will arrive, and what the guest has to do, if anything | MNG-15 |
| XD-04 | S | **No-hold-music callback**: for urgent matters, a callback with a position in the queue and a time; the phone number is shown offline | SUP-08 |
| XD-05 | S | **Stranded-ashore flow**: if the guest misses the ship, a single card with the port agent, consulate, the ship's next port, the line's policy, and a record for insurance | POR-08 |
| XD-06 | S | **Lost phone or documents**: a recovery path from another device or the desk, a reissue of the boarding pass and Medallion, and a paper backup of key facts | CHK-14 |
| XD-07 | ★ S | **Family-at-home disruption notice**: an official, plain-language update for the guest's named contacts on the family-at-home page, reducing frantic calls | S3-08 |
| XD-08 | S | **Outage mode**: when the ship's network or the app's service is down, the app declares it, shows what still works, what the guest can do without it, and what is queued | PERF-06, SUP-04 |
| XD-09 | S | **Health event mode**: outbreak or illness notices with plain instructions (isolation, meals, hygiene, medical), reducing fear without hiding facts | SAF-03 |
| XD-10 | C | **Post-disruption debrief**: a short follow-up asking whether it was handled well, with a human review where it was not | POS-11 |

---

## 16. Cross-cutting — Inclusion and wellbeing (XI)

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| XI-01 | ★ S | **Calm mode**: a user-chosen reduced-stimulation experience: fewer notifications, no motion, softened colours, a one-column layout, simplified wording, no countdowns; separate from high contrast | A11Y-08 |
| XI-02 | ★ S | **Sensory profile and plan**: noise, light, crowd and touch preferences produce a day plan with quiet venues, low-stimulation times, a quiet lane for boarding, and warnings for loud events (the fireworks, the horn at sail-away) | ACS-01, S5-02 |
| XI-03 | ★ S | **Social story and visual schedule**: a pre-cruise picture story of the trip (airport, terminal, muster, cabin, dinner) and, on board, a picture-based day schedule that shows "now, next, later" with predictable changes announced early | ACS-06 |
| XI-04 | ★ S | **Sensory kit and lanyard request**: request noise-cancelling headphones, a fidget kit and a staff-recognisable lanyard before boarding, with a confirmation status, matching what peers offer physically **(verify the line's offer)** | MNG-12 |
| XI-05 | ★ S | **Caregiver and cognitive support mode**: a simplified app for guests with dementia or cognitive difficulty, a linked caregiver view (with the guest's consent or legal authority), and a "take me back to my cabin" button | INC-01, S6-16 |
| XI-06 | S | **Audio wayfinding and menus**: spoken directions and read-aloud menus and daily plan for blind and low-vision guests, with described routes | ACS-05 |
| XI-07 | S | **Deaf and hard-of-hearing**: visual and vibration alerts (as far as the web allows), captioned show schedule, text-based emergency channel, interpreter times | ACS-04 |
| XI-08 | S | **Safe-ashore notes for different travellers**: women, LGBTQ+ guests, older guests, and guests with disabilities get relevant local-law and safety notes per port, factual and not alarmist **(verify)** | S6A-08 |
| XI-09 | S | **Allergy confidence**: a visible chain from the pre-flag (S3-13) to each venue's acknowledgement, a per-venue "safe options" list, and an alert if an item changes; designed for the child with a nut allergy | DIN-03 |
| XI-10 | S | **Bereavement and recovery trips**: gentle wording, flexible changes, and a quiet-space prompt for guests travelling after a loss or with a memorial (ashes policy **(verify)**) | S0-09, SUP-07 |
| XI-11 | C | **Anxiety toolkit**: short breathing and grounding guides, a "I'm struggling" path to a quiet person, and no gamified pressure | SAF-08 |

---

## 17. Cross-cutting — Groups and family (XG)

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| XG-01 | S | **Group dashboard for the organiser**: roster, payments, documents, dietary, rooming and check-in status for a whole group, with reminders sent from the organiser's name | MNG-16, BOK-09 |
| XG-02 | S | **Per-person privacy within a group**: each member decides what the group sees (itinerary, location, spending), with the defaults the safest | SEC-05, ACT-05 |
| XG-03 | ★ S | **Split ledger**: a running tally of who paid what for shared items (excursions, dinners, taxis, cabin purchases) across cabins and families, with a fair settle-up at the end and no money moving inside the app | S2-04, ACC-08 |
| XG-04 | S | **Family traditions**: a recurring "family tradition" checklist (the first-night photo, a dinner on night three) that the group can set and repeat on the next trip | S8-05 |
| XG-05 | S | **Group photo album**: a shared album for the party with each person's privacy choice, built into the recap | SHP-02, S8-02 |
| XG-06 | C | **Reunion and wedding mode**: guest list, RSVP, schedule, welcome message, dress code and a group-wide announcement channel | BOK-16, DIS-17 |
| XG-07 | S | **Multi-cabin shared plans**: see which cabin each member is in and a single shared day for the group, with personal items private | PRE-13 |

---

## 18. Cross-cutting — Trust and money (XT)

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| XT-01 | ★ S | **Roaming and Wi-Fi bill-shock guard**: clear guidance at the moment a guest is likely to incur a charge (on departure, at the first sea day), and a usage coach for ship Wi-Fi | S3-07, NET-02 |
| XT-02 | ★ S | **Fee ledger and "explain this charge"**: every charge shows what it is, why, and how to question it; a plain explanation can be requested for any line and is available offline | ACC-01, ACC-04 |
| XT-03 | ★ S | **Confirm-before-charge**: any single charge over a limit the guest sets needs an explicit confirm, shown with the running total; a global "ask me every time" option for guests who want it | ACC-02 |
| XT-04 | ★ S | **No-shaming gratuity stance**: gratuity choices are private to the guest and Guest Services; the app never flags, labels or ranks guests by tipping, and says so in the privacy centre | ACC-05 |
| XT-05 | S | **Why am I seeing this**: every recommendation and every offer shows its reason and a one-tap "stop showing this kind"; the full list of inferences is visible and editable | CNT-02, UX-02 |
| XT-06 | S | **Subscription-free promise**: no auto-renewing add-ons without a plain, visible "this will charge you on <date>" and a one-tap cancel | PRE-10 |
| XT-07 | S | **Trust ledger**: a timeline of everything booked, paid, requested, changed or cancelled, with before-and-after values, visible and exportable; nothing disappears silently | §23.6 (7) |
| XT-08 | C | **Sustainability, honestly**: an estimate of the trip's emissions as a range with its method shown, opt-in offset information that names its limits, and the ship's real programmes (shore power, waste); no claims the line cannot back **(verify)** | POS-12 |
| XT-09 | C | **Advisor view by consent**: the guest can share a read-only progress link with a travel advisor, who sees the same readiness as the guest and nothing else; revocable | S1-09, S3-01 |
| XT-10 | S | **Dark-pattern test suite**: automated tests that fail on countdown timers, pre-ticked add-ons, hidden costs, hard-to-find cancel buttons and confirm-shaming wording, extending the existing offer-wording test | UX-02 |

---

## 19. Cross-cutting — AI and anticipation (XA)

The base document scopes the concierge (DIS-09, SUP-03) and the guardrails (§22.2). This family changes its role from **answering** to **grounded helping**.

| ID | Priority | Requirement | Builds on |
| --- | --- | --- | --- |
| XA-01 | ★ S | **Ask your cruise**: the assistant answers from the guest's own bookings, plan, folio, documents and ship data ("what time is dinner?", "what do I still need to do?", "why was I charged $18?"), with sources shown and "I do not know" when it does not | DIS-09, SUP-03 |
| XA-02 | ★ S | **Propose, confirm, do, undo**: any action the assistant takes (move a dinner, add an excursion, request an item) is a proposal with a clear preview, needs the guest's confirmation, runs through the same atomic-change rules as a manual action, and offers undo for a stated period | DIN-10, S6-02 |
| XA-03 | ★ S | **Notification budget**: the guest sets how many proactive nudges they want per day (including zero); the assistant ranks its own suggestions and drops the rest; critical safety notices are exempt | NOT-04, ACT-07 |
| XA-04 | S | **Morning briefing and evening preview**: one short, optional digest (weather, what matters today, deadlines, what is changing, tomorrow's first event) in the guest's chosen text size and read-aloud ready | OB-01 |
| XA-05 | S | **Plain-English summaries**: of the daily plan, the bill, a policy or a long notice, at a chosen reading level, always showing the original beside it | A11Y-09 |
| XA-06 | S | **Handoff with context**: when the guest asks for a human, the conversation, the guest's question and the relevant booking arrive with them, so nothing is asked twice | SUP-03 |
| XA-07 | S | **Preference memory with a visible brain**: what the assistant has learned, with a delete for any item and a global off; no hidden inference | S4-07, XT-05 |
| XA-08 | C | **Voice mode**: hands-free questions and commands on devices that support it, with the same confirm-before-act rule | ACS-05 |
| XA-09 | S | **Evaluation set**: a fixed set of sample questions with expected answers that runs in tests so grounded answers do not regress; hallucination checks against fixtures | PERF-07 |
| XA-10 | S | **Cost and rate controls**: a per-session spending and request cap, a graceful fallback to the scripted concierge, and the key never in the bundle for production *(carry-over from §22.2)* | §22.2 |

---

## 20. Platform opportunities and limits (web/PWA)

| Capability | Feasible? | Use |
| --- | --- | --- |
| Web Share and share target | Yes | Share invitations, memory cards and itinerary; receive a pasted AI plan (S0-07) |
| Subscribable calendar (ICS) | Yes (needs a hosted feed; offline one-off file works now) | Payment calendar (S2-05), itinerary, port-day plan |
| Screen Wake Lock | Yes (most browsers) | Boarding pass, rendezvous screens, read-aloud |
| Badging and notification actions | Partial | Unread counts and "accept / ignore" on Autopilot proposals |
| Contact Picker | Android Chrome | Invites and family-at-home contacts |
| Speech synthesis (read-aloud) | Yes | Plain-language summaries, menus, social stories |
| Speech recognition | Partial | Voice mode (XA-08) |
| Vibration | Android | Deaf and hard-of-hearing alerts (XI-07) |
| Periodic background sync | Chromium only | Refresh the plan and crowd data; degrade gracefully |
| Geolocation | Foreground only | Port Day Pilot distances; never required |
| Live Activities, lock-screen widgets, watch apps | **No** | Not available to a PWA; use the notification, badge and Wake Lock instead |
| Real ship feeds (crowds, queues, position, tender) | **No** | All S6, S6A and S4A live data is simulated through the mock layer with the same shape as a real feed |

---

## 21. Proposed delivery phases (H1–H6)

Names avoid collision with the base numeric phases and the G phases. Each phase follows the project rule: build, verify with the npm checks, commit, stop.

| Phase | Theme | Contents |
| --- | --- | --- |
| **H1** | Trust and money | XT-01…XT-07, XT-10, S3-07, S7-05, S6-06, XA-03 (the Money shield, the highest return for the least risk, and fully mock-able) |
| **H2** | Disruption Hub and family-at-home | XD-01…XD-10, S3-08, S6-24, S4A-03, S4A-08 |
| **H3** | Port Day Pilot | S6A-01…S6A-15, S6-12 (rendezvous), XG-03 (split ledger) |
| **H4** | Door to door and embark | S4A-01…S4A-12, S5-01…S5-06 |
| **H5** | Autopilot, Ship Pulse and inclusion | S6-01…S6-05, S4-01, S4-02, XI-01…XI-05, XA-01, XA-02 |
| **H6** | Cabin chooser, memory loop and dream | S1-02…S1-08, S8-01…S8-12, S0-01…S0-10 |

**Rationale:** H1–H3 address failure and fear (the things that lose trust), H4–H5 turn on the anticipatory features, H6 completes the two ends of the journey. If you want the strongest "wow" first, swap H3 and H5.

**Remaining Should/Could items** not named in a phase (S2, S3 remainder, S4 remainder, S6 ship-life, XG, XA remainder) become an H7 backlog, sorted after each phase review.

---

## 22. Decisions (accepted 2026-11-01)

All nine recommendations below were accepted as written. The "My recommendation" column is now the decision.

| # | Question | Decision (my recommendation, accepted) |
| --- | --- | --- |
| 1 | Do you accept the **three new stages (0, 4A, 6A)** and the renamed Stage 8, and the numbering in §2? | Yes. They match how trips actually go wrong and are re-usable in the nav |
| 2 | Are the **12 signatures (§3)** the right headline set? Anything to swap? | Yes. If you want fewer, drop 9 (Ship Pulse, it is the most simulation-heavy) and 12 |
| 3 | **Simulated live data** (crowds, queues, flight status, sky, sightings): is it acceptable to ship these as clearly simulated sources behind real-feed-shaped interfaces? | Yes. Same approach as ship telemetry and weather today |
| 4 | **Autopilot and "do on your behalf"** (S6-02, XA-02): are you comfortable with an assistant that can change bookings after a confirm-and-undo? | Yes, with no change ever made without a preview and a confirm |
| 5 | **Social features** (S3-09, S6-11, S8-06): these need moderation, which crew tooling would normally provide. Keep, or restrict to the travel group? | Keep as opt-in with block and report, but the directory stays small and only shows what each person chose |
| 6 | **Family-at-home page** needs a public-style link. For the demo it would be a signed-in, simulated link; fine? | Yes, a simulated link with an expiry |
| 7 | **Sensory kit, ash scattering, room-mate matching** depend on the line's real offers. Author plausible mock content, as for the other (verify) items? | Yes |
| 8 | Where should the phase order go (H1 first)? | Money shield first, then disruption: phase order H1 to H6 stands as written in §21 |
| 9 | Are there features here you consider **off-brand or too much**? | None struck. All requirements stand at their stated priorities |

---

## 23. Remaining uncertainty and research gaps

- Much of the competitive information is from blogs, vendor reports and press releases; the vendor that published the 2026 apps report also runs four of the 21 apps it studied. Treat counts as indicative.
- I did **not** find a 2026 survey ranking guest wish-list features, so the priorities here rest on pain points, peer practice and judgement, not on a measured ranking. Guest research (even five conversations with older and neurodivergent cruisers) would be worth more than more desk research.
- Virgin Voyages, Disney, Viking and Celebrity app detail is still thin.
- Port-specific rules (Belize, Honduras, Mexico), terminal assignments, accessibility notice periods, kit programmes and missed-ship policies are all **(verify)** and may be authored as plausible mock content.
- The "Builds on" column comes from a keyword check, not a code audit.
- AI features depend on the Claude API key handling already decided (§22.2 of the base document); nothing here changes that.

---

## Appendix — Sources

2026 research (this document)
- Cruise Mobile Apps — 2026 Annual Report (OnDeck/Sourcetoad): https://ondecksoftware.com/app-reports/2026-oceans-report/
- Princess launches AI-powered cruise planning app: https://www.princess.com/news/news-releases/2026/09/princess-cruises-becomes-first-global-cruise-line-to-launch-AI-powered-cruise-planning-app
- Cruise passengers criticise a programme identifying early tippers (1 Nov 2026): https://www.wfmd.com/2026/11/01/cruise-passengers-criticize-new-program-identifying-early-tippers-on-board/
- Royal Caribbean app features guests overlook (Oct 2026): https://www.royalcaribbeanblog.com/2026/10/08/underrated-royal-caribbean-app-features
- Do cruise line apps leave some cruisers out in the cold? (Travel Market Report): https://www.travelmarketreport.com/articles/do-cruise-line-apps-leave-some-cruisers-out-in-the-cold
- Cruise social apps compared (Nautir, Seaya, CruiseHuddle, DeckMate, Shipmate): https://nautir.com/compare/
- More cruise lines add AI tools (AOL): https://www.aol.com/articles/more-cruise-lines-add-ai-154911000.html
- Technology is driving the future of the cruise industry: https://www.hospitalityupgrade.com/magazine-articles/technology-is-driving-the-future-of-the-cruise-industry
- Cruise Planners AI and technology release (press release, advisor tools): https://www.morningstar.com/news/pr-newswire/20261021fl75655/cruise-planners-sets-the-standard-for-ai-and-technology-innovation-in-the-travel-industry
- Autism-friendly ships (Celebrity): https://www.celebritycruises.com/autismfriendly
- Autism-friendly ships (Royal Caribbean): https://www.royalcaribbean.com/sgp/en/experience/accessible-cruising/autism-friendly-ships
- Carnival ships "sensory inclusive": https://www.intltravelnews.com/node/16087.html
- Port congestion (Celebrity at Santorini): https://www.cruisehive.com/celebrity-ships-port-of-call-shortened-mid-voyage-due-to-congestion/182959
- Cruise Friends and Seaya (solo social apps): https://apps.apple.com/us/app/id6753626100

Base document sources: see `docs/functional-requirements.md`, Appendix A.
