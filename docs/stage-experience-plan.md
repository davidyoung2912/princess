# One app, eleven stages: the staged-experience plan

Status: **v3, approved by the product owner (2026-11-03). P1 (the stage engine on the server), P2 (the screen registry), P3 (page header and colour) and P4 (shell and navigation) and P5 (Home for Dream, Discover and Book) P6 (Home for Manage, Prebook and Get to the ship) and P7 (Home for Embark, Sea, Port and Disembark) and P8 (Home for Remember, other trips) are built; P9 is not started.** This version follows your structure: every screen gets an ID, a Title Case title and a goal-describing subtext shown in the coloured header; each of the 11 stages has Home first, Me last and two or three stage tabs between; every screen a stage uses is reachable from one of those tabs.

It builds on `docs/customer-journey-priorities.md` (what matters at each stage) and replaces the earlier "reorder but hide nothing" approach in `docs/stage-menus-matrix.md`.

---

## 1. What is wrong today (findings from the code)

| # | Finding | Evidence | Consequence |
|---|---|---|---|
| F1 | **`dream` and `book` can never happen.** The stage comes from `journeyPosition()`: no booking is always `discover`, and a booking only produces `manage` or later. | `src/domain/journeyPosition.ts`, `src/routes/hubs.ts` | The dream account's header says "Discover", and the dream and book menus and the "Dreaming of a cruise?" card are dead code. |
| F2 | **Nothing is hidden.** All five tabs show at every stage, and every stage still lists every hub (closed). | `src/ui/Shell.tsx`, `stageMenus.ts` | A new customer is one tap from about 190 screens. |
| F3 | **The ship is shown before there is a ship.** `/home/ship`, `/ship/info` and the Ship tab are open with no sailing chosen. | `routes.ts`, `STAGE_MENUS.dream.quick.ship` | "Which ship?" has no answer, because the ship belongs to a sailing. |
| F4 | **Stage is decided only by a booking plus the clock.** Nothing records "I have a sailing in mind". | `journeyPosition.ts` | The app cannot tell dreaming from comparing. |
| F5 | **Each hub has one `stage`.** A screen has no "first shown at / last shown at". | `HUBS[].stage` | We cannot hide a screen early or retire it later. |
| F6 | **Titles repeat and have no subtext.** Several routes share a title (`Online check-in`, `Book your cruise`, `My details`), and the header has no subtext. | `en.ts` `route.*` | Guests (and screen readers) cannot tell screens apart. |
| F7 | **Stage logic is client-side**, against the thin-client rule in `CLAUDE.md`. | `useJourneyPosition` | Two devices can disagree. |

---

## 2. Principles

Your six rules, as the design contract:

1. **Every screen has a clear, unique title and a subtext that states its goal**, both in the coloured header at the top, like Home has today.
2. **Each stage has a defined set of screens.** A screen not in the stage's set is not shown at that stage: not in a tab, not on Home, not in search.
3. **Home is always first.** It holds the stage's top actions: "Next steps" plus the six things to care about.
4. **Me is always last.** It holds the account, what is due, and the things to be aware of at this stage. Repeating something from Home is fine.
5. **Two or three stage tabs sit between them, in priority order,** each a single word that names a group of screens for that stage.
6. **Every screen a stage uses is reachable from one of its tabs** (Home, the stage tabs, or Me). A generated check proves this (section 9).

Supporting rules:
- **One app, not eleven.** Same shell, same header, same components, same voice at every stage. Only the content of the tabs changes. Where adjacent stages share a tab (Plan in Prebook, Get to the ship and Embark; Ship from Embark to Disembark) it keeps its name and its order.
- **Colour tells you where you are.** Each tab has its own colour, and every screen opened from that tab wears it (section 5.3).
- **Never show it early.** No greyed items, no "coming soon". A stale address simply goes to Home.
- **Earlier stages demote, not vanish.** What still has value (receipts, contract, confirmation, history) sits under **Me**, so nothing the guest paid for or agreed to is lost.
- **Safety and access are always on.** The Help button, Search (stage-filtered), text size and the Settings and help group exist at every stage.
- **The ship is a property of the sailing.** Ship content appears only once a sailing is chosen and is named for that sailing's ship.

---

## 3. The stage engine: how we recognise the stage, and what pushes a guest to the next one

### 3.1 The stage is derived from facts, never stored

The server works the stage out from what the guest has **done** (their events) and, after booking, **where the sailing is in time**. It is recomputed on every read, so a guest can never be "stuck" in a stage, and every device agrees. The server also records the event that caused each change, so we can always answer "why is this guest in Discover?" (the test bar will show it for demo accounts).

Rules of the engine:
- **Action first, clock as a backstop.** Before booking, only guest actions move the stage. After booking, an action moves it early when one exists, and the clock moves it at the latest.
- **Looking is not intent.** Browsing sailings, reading a port page or taking the quiz does **not** leave Dream. Only a deliberate "this one" action does.
- **Forward only once confirmed.** After a booking is confirmed the stage only moves forward (a cancellation is the one exception).
- **Before confirmation it is reversible.** Un-saving the last sailing returns a guest to Dream; an abandoned draft returns them to Discover.
- **Stage is per trip.** See 3.4 for guests with more than one.

### 3.2 Trigger table: what moves a guest from one stage to the next

| From → To | Trigger (first that happens) | Where it comes from | Back again when |
|---|---|---|---|
| **(sign-up) → Dream** | Account created or first sign-in, no sailing in focus | account | — |
| **Dream → Discover** | Guest does any one of: **saves a sailing**; taps **"Look closer at this sailing"** on a quiz result; asks for a **price or cabin view for a specific sailing** (cost calculator, cabin chooser, quote); **accepts a sailing from a shared dream board or advisor link**; imports a plan that names a sailing | guest event | the last saved or quoted sailing is removed and no quote is open, so back to Dream |
| **Discover → Book** | Guest taps **"Book this sailing"** (a draft is created) or places a **hold** | `bookings` draft or hold | draft cancelled, abandoned, or the hold lapses, so back to Discover with that sailing still in focus |
| **Book → Manage** | **Deposit paid and booking confirmed** (a confirmation number exists), or an **agent booking is linked** to the account | `bookings.status = confirmed` | a cancellation or refund returns them to Discover |
| **Manage → Prebook** | **Final payment made** (the trip is paid in full), **or** 14 days before departure, whichever is first | `PaymentState`, sailing date | — |
| **Prebook → Get to the ship** | **Check-in opens** (3 days before) **or** the guest starts check-in, whichever is first | `TripRules.CheckinWindow` | — |
| **Get to the ship → Embark** | Guest taps **"I'm at the terminal"** or the **boarding pass is scanned**, or **boarding begins** (embarkation day, 11:00 ship time), whichever is first | scan event, sailing time | — |
| **Embark → Sea** | **Sailaway** (ship leaves port) or the guest is **confirmed aboard** and it is a sea day | sailing itinerary | — |
| **Sea ↔ Port** | The itinerary day is a **sea day** (Sea) or a **port day** (Port): ship time at 08:00 | itinerary | alternates through the cruise |
| **Sea → Disembark** | **Final morning 06:00** (ship time). Disembarkation tasks (bags, exit time) appear *one night earlier as a Home item*, but the stage is still Sea | sailing itinerary | — |
| **Disembark → Remember** | Guest **scans off the ship**, or **12:00** on the last morning, whichever is first | scan event, sailing time | — |
| **Remember → (next trip)** | After **10 days**, or when the guest saves a sailing: the **Next trip** track starts (3.4) | guest event | — |

Edge cases, one line each:
- **Several sailings saved:** one is "in focus" (the last one touched; the guest can change it). Saved sailings never advance the stage past Discover by themselves.
- **Agent-booked trips** skip Discover and Book and begin at Manage.
- **Demo testing date** still overrides the whole engine for demo accounts, as now.
- **Duplicate or odd data:** an unknown or missing signal resolves to the *earlier* stage, so the app never shows a guest something too early.

### 3.3 The ship is a property of the focus sailing

Anything about "the ship" (deck map, venues, ship info, packing for the ship) is shown only once a sailing is in focus (Discover onward), is titled with **that sailing's ship name**, and reads its data from that sailing. Today the catalog has one ship (Sun Princess), but the rule must hold when there are more. In Dream there is no ship.

### 3.4 Guests with more than one trip

Each trip has its own stage. Home follows the **current trip** (the one that `/me/trips` marks, normally the next to sail). Tabs are decided by the current trip's stage. Any other trip appears as one **"Your other trip"** item on Home. A returning guest in Remember has a **Next trip** track (Dream or Discover for the new idea) shown as an item on Home, without changing their tabs. When they confirm a new booking, that trip becomes the current one and starts at Manage.

---


## 4. The screen standard (what every screen gets)

- **Header.** A coloured bar at the top of every screen with the **title** (Title Case, one line where possible) and under it the **subtext** (one or two sentences that say what the guest can accomplish here). The Home page already does this, so the same component (`PageHeader`) is used everywhere.
- **Title rules.** Title Case. Unique across the app. Plain words, no internal names. States the thing, not the action menu ("Packing List", not "Packing Tools"). The one dynamic title is **Your Ship**, which also shows the ship's name in the body.
- **Subtext rules.** One or two full sentences. First says what the screen is for; second says the result or benefit. No marketing. No "click here".
- **Colour comes from the tab the screen is under** (section 5.3). The header bar, the active tab, section titles and card edges all use that tab's colour.
- **Accessibility.** The title is the page's one `h1`; the subtext is the first paragraph; focus moves to the title on navigation (as today).
- **Titles and subtexts live in the locale files** (`en.ts`, `es.ts`), not in the components, so translation and review stay in one place.

---

## 5. The navigation model

### 5.1 The 11 stages and their tabs

Home is always first and Me is always last. The tabs between are the stage's own, most important first.

| # | Stage | Tabs, left to right (colour) |
|---|---|---|
| 1 | Dream | Home (Princess blue) · **Explore** (teal) · **Ask** (pink) · Me (plum) |
| 2 | Discover | Home (Princess blue) · **Sailing** (teal) · **Cabin** (pink) · **Cost** (gold) · Me (plum) |
| 3 | Book | Home (Princess blue) · **Booking** (teal) · **Travellers** (pink) · **Pay** (gold) · Me (plum) |
| 4 | Manage | Home (Princess blue) · **Trip** (teal) · **Needs** (pink) · **Group** (gold) · Me (plum) |
| 5 | Prebook | Home (Princess blue) · **Plan** (teal) · **Prepare** (pink) · **Group** (gold) · Me (plum) |
| 6 | Get to the ship | Home (Princess blue) · **Board** (gold) · **Travel** (pink) · **Plan** (teal) · Me (plum) |
| 7 | Embark | Home (Princess blue) · **Board** (gold) · **Ship** (pink) · **Plan** (teal) · Me (plum) |
| 8 | Sea | Home (Princess blue) · **Today** (teal) · **Ship** (pink) · **People** (gold) · Me (plum) |
| 9 | Port | Home (Princess blue) · **Port** (teal) · **Ship** (pink) · **People** (gold) · Me (plum) |
| 10 | Disembark | Home (Princess blue) · **Leave** (teal) · **Ship** (pink) · **People** (gold) · Me (plum) |
| 11 | Remember | Home (Princess blue) · **Memories** (teal) · **Next** (pink) · **Feedback** (gold) · Me (plum) |

Why these tabs:
- **Dream has only two stage tabs.** There is little to do except browse and ask, and there is no ship, no cabin and no cost yet.
- **Chat is not a tab.** Party chat and Guest Services (`C01`) live in **Group** (Manage and Prebook), **Plan** (Get to the ship), **Board** (Embark) and **People** (Sea to Disembark), because that is where the guest is thinking about their companions. The AI concierge (`H04`) is under **Ask** and **Cost** before booking.
- **Ship appears at Embark.** Before that, ship information is a read-only part of **Sailing** (Discover) and **Trip** (Manage), for the sailing the guest has chosen.
- **Safety lives in Ship** (muster, emergency, help now, health, lost and found, captioned shows, do not disturb), and at Embark `S25` and `S26` are also in **Board**. At Get to the ship the emergency card `S26` is in **Board** and on Home.
- **Plan** is for building something (excursions, dining, days). It appears at Prebook, when there is a booking to plan around, and stays until Embark. In Sea and Port its screens move into **Today** and **Home**.
- **Memories, Next and Feedback** keep Remember simple: keep the trip, start the next one, tell us how it went.

### 5.3 Colour by tab (so the colour tells the guest where they are)

**The palette.** Home is **Princess blue**. The three stage tabs use **teal, pink and gold**, which are already in `themes.css` and already pass contrast. **Me gets a new deep plum**, because the current navy for Me is too close to Princess blue to tell apart at a glance.

| Area | Colour | Text and accent value | Header bar (start → end) | Pale tint (cards, chips) | White text on the bar | Colour on white |
|---|---|---|---|---|---|---|
| **Home** | Princess blue | `#003595` (existing `--primary`) | `#002a77` → `#1a5fd0` (existing) | `#e8f0fd` | 13.1 : 1 → 5.9 : 1 | 10.8 : 1 |
| **Teal tabs** | Teal | `#00707c` (existing) | `#00424b` → `#00707c` (existing) | `#e0f3f5` | 11.2 : 1 → 5.8 : 1 | 5.8 : 1 |
| **Pink tabs** | Pink | `#b5004a` (existing) | `#7a0033` → `#b5004a` (existing) | `#fde8f1` | 11.2 : 1 → 6.9 : 1 | 6.9 : 1 |
| **Gold tabs** | Gold | `#7a5a24` (existing `--gold-text`) | `#5c4318` → `#7a5a24` (existing) | `#f8eedb` | 9.3 : 1 → 6.3 : 1 | 6.3 : 1 |
| **Me** | **Plum (new)** | `#5b2a86` | `#3b1760` → `#5b2a86` | `#efe7f7` | 14.2 : 1 → 9.9 : 1 | 9.9 : 1 |

All pairs clear WCAG AA (4.5 : 1 for text). Plum needs dark, high-contrast and night variants added to `themes.css`, which `src/design/contrast.test.ts` already checks.

**Which colour each tab gets.** A tab keeps the **same colour at every stage it appears in**, and the three stage tabs of any stage are always **three different colours**, so the colour never repeats within a stage.

| Colour | Tabs |
|---|---|
| **Teal** | Explore · Sailing · Booking · Trip · **Plan** · Today · Port · Leave · Memories |
| **Pink** | Ask · Cabin · Travellers · Needs · Prepare · Travel · **Ship** · Next |
| **Gold** | Cost · Pay · **Group** · **Board** · **People** · Feedback |
| **Princess blue** | **Home** (every stage) |
| **Plum** | **Me** (every stage) |

The recurring tabs (**Plan** teal, **Ship** pink, **Group**, **Board** and **People** gold) keep their colour from stage to stage, so the app feels like one app that grows.

**What takes the tab's colour.**
- The coloured header bar of every screen (title and subtext), and the screen's `h2` section titles.
- The active tab (a filled indicator in the tab's colour, plus the label) on the phone bar and the desktop rail.
- Card edges and chips. Today cards rotate through four accents; in the new scheme cards in an area use **that area's colour**, so the rotation no longer dilutes the signal. Status colours (success, warning, danger) keep their own meaning.

**Which colour a screen wears when it appears under more than one tab.** The colour follows **the tab the guest opened it from** (kept in the navigation state). On a refresh or a direct link, the screen uses its **primary tab for the stage**: the first stage tab that lists it; otherwise Me if Me lists it; otherwise Home. Every screen in **Settings and help** is always plum. This keeps the colour stable while the guest moves around inside one area.

**Colour is never the only signal.** The tab label, the active-tab indicator and the screen title always name the area; colour reinforces them. The palette is checked in light, dark, high-contrast and night themes.


### 5.2 What does not change

- Home and Me are always there; the guest never loses their way.
- The **Help** button and **Search** in the top bar are always there. Search only finds screens in the guest's current stage (and labels earlier ones "From your trip").
- Moving to a new stage adds a one-line note on Home the first time a new tab appears ("Your ship is ready. We've added Ship.").
- **Essentials and simple modes** trim content within a stage, never across stages.

---


## 6. Screen catalogue

Every route in `src/routes/routes.ts` (195 patterns) is here exactly once: 191 screens, plus the 4 tab front pages (`/`, `/plan`, `/ship`, `/me`), which become the tab landing pages in section 7. The letter in the ID shows the content family (`H` Home, `P` Plan, `S` Ship, `C` chat and people, `M` Me); it does not set the colour, which comes from the tab (5.3). **Stages** uses the numbers in section 5.1; "all" means every stage (the Settings and help group).


### 6.1 Home family (`/home/*`, `/book/*`)

| ID | Title | Subtext (shown under the title) | Route | Stages |
|---|---|---|---|---|
| `H02` | Find My Cruise | Answer a few questions about what you love and get a short list of cruises that fit, with the reason behind each pick. This is the quickest way to turn a vague wish into a plan. | `/home/quiz` | 1, 11 |
| `H03` | Talk to a Travel Advisor | Ask a travel advisor to call you back, or share your plan so they can see what you have in mind. Use this when you want a person's advice before you decide. | `/home/advisors` | 1–2 |
| `H04` | Ask the Concierge | Ask any question about the cruise, the ports and the ship. Answers come only from the app's own data, and the screen says plainly that it is AI. | `/home/concierge` | 1–2, 11 |
| `H05` | Ask Your Cruise | Ask questions about your own booking, such as dates, what is included and what you owe. Answers come from your trip details, so they are specific to you. | `/home/ask` | 4 |
| `H06` | 7-Night Western Caribbean with Mexico | See the route, the ports and what a day on board is like. Read this to decide whether this cruise is the kind of trip you want. | `/home/cruise` | 1–2, 11 |
| `H07` | Sailing Dates | Compare every departure, see how soon each one leaves and whether it can still be booked. Pick a date that suits you and your budget. | `/home/sailings` | 1–2, 11 |
| `H08` | Sailing Details | See the dates, ports, season notes and the from-price for one departure. Use this to judge whether this particular sailing is right for you. | `/home/sailings/:id` | 1–4, 11 |
| `H09` | Port Details | Learn what to expect at this port, including whether the ship docks or tenders, how long you have and what there is to do. It helps you decide what to do ashore. | `/home/ports/:id` | 1–2, 4–5, 9, 11 |
| `H10` | Your Ship | See the decks, rooms, dining and entertainment on the ship that sails on your chosen sailing. Read this to picture your trip on board. | `/home/ship` | 2–4 |
| `H11` | Saved Sailings | Keep the sailings you are watching or comparing in one place. Come back to them, compare them and choose the one to look at closely. | `/home/saved` | 1–2, 11 |
| `H12` | What the Whole Trip Costs | See the real total for the whole trip: fare, taxes, extras, flights and tips. Switch lines on and off so the number matches how you will really travel. | `/home/cruise/cost` | 2–3 |
| `H13` | Is This Cruise for Me? | Find out who this cruise suits and who it does not, what you can afford and which common worries are true. It helps you and anyone you travel with decide with confidence. | `/home/decide` | 1–2, 11 |
| `H14` | Choose Your Cabin | Compare rooms scored for sleep, motion and noise, with the plain reasons behind each score. Pick the room you will be glad to wake up in. | `/home/cabins` | 2–3 |
| `H15` | Offers for Your Trip | See deals that apply to this sailing and your booking. Offers are shown after your required tasks, never before. | `/home/offers` | 2–3 |
| `H16` | Book Your Cruise | Choose a room type and the number of guests to see the all-in price. Start your booking from here when you are ready. | `/book` | 2–3 |
| `H17` | Your Booking | Enter travellers, extras and payment details for your booking. Everything is saved after each field, so you can stop and come back without losing anything. | `/book/:id` | 3 |
| `H18` | Finish Your Booking | Return to a booking you started and carry on from exactly where you stopped. Nothing you entered is lost. | `/book/resume/:id` | 3 |
| `H19` | Pay Your Balance | Pay the balance you owe, in full or just your own share. You see the amount and the date before you confirm. | `/book/pay/:id` | 3 |
| `H20` | Booking Confirmed | See your confirmation number and the documents to keep. This is the record that your booking exists and what it includes. | `/book/confirmed/:id` | 3–4, 11 |
| `H21` | Changes to Your Trip | See what has changed on your trip, what it means for you and the options you have. Anything that needs your decision is shown first. | `/home/updates` | 4 |
| `H22` | Morning and Evening Briefing | Read your day on one page: events, reservations, weather and the all-aboard time. Check it in the morning and again in the evening. | `/home/briefing` | 8–9 |
| `H23` | Plain-English Summaries | Read your booking, the policies and any changes in plain words. Use this when the official wording is hard to follow. | `/home/summary` | 4 |
| `H24` | When Something Changes | See your options and who to call when plans change, such as a missed flight, a closed port or a late arrival. It tells you what to do next, in order. | `/home/disruption` | 5–8 |
| `H25` | I'm Delayed | Tell the ship and your group that you are running late. You then see what to do next and how late is too late. | `/home/delayed` | 6–9 |
| `H26` | Find My Boarding Pass | Get your boarding pass back using your booking number, even if you have lost your phone or never saved it. This keeps you from being stuck at the terminal. | `/home/find-pass` | 6–7 |
| `H27` | Online Check-In | Complete check-in for everyone in your party: photo, documents and payment card, one traveller at a time. You can stop and resume at any point. | `/home/check-in` | 6 |
| `H28` | Check-In for One Traveller | Finish or fix check-in for one person in your party. Use this when someone's photo or document needs another try. | `/home/check-in/:id` | 6 |
| `H29` | What We Have on File | Review everything you submitted at check-in. Use it to confirm the ship has the right details before you arrive. | `/home/check-in/receipt` | 6–7 |
| `H30` | Check in at the Terminal | Learn what to bring and what to expect if you did not finish check-in online. The terminal can complete it, and this screen shows you how. | `/home/check-in/terminal` | 6 |
| `H31` | Boarding Pass | Show your boarding pass at the terminal, with a copy that works offline and can be printed. It is always one tap away on boarding day. | `/home/boarding-pass` | 6–7 |
| `H32` | Embarkation Day | See your arrival window, your terminal and the steps for boarding day in order. The goal is a calm morning with no surprises. | `/home/embarkation` | 6–7 |
| `H33` | Embarkation Companion | Follow each step from the terminal to your cabin and tick them off as you go. It tells you what comes next and how long it usually takes. | `/home/embarkation/steps` | 7 |
| `H34` | Embarkation Plan | Choose your arrival time, who carries what and where your group meets. Planning this ahead makes boarding day smoother. | `/home/embarkation/plan` | 6–7 |
| `H35` | Meeting-Point Card | Show where and when your group meets, on a card anyone can read. Share it so nobody has to guess. | `/home/meeting-point` | 7 |
| `H36` | My Medallion | Learn what your wearable medallion does and how to set it up. It opens your door and identifies you on board. | `/home/medallion` | 6–7 |
| `H37` | Luggage Tags | Print or collect your luggage tags and find out when bags reach your door. This avoids lost or late luggage on the first night. | `/home/luggage` | 6–7 |
| `H38` | Port Entry Rules | See the entry, visa and customs rules for each port on your route. Check it before you travel so nothing stops you going ashore. | `/home/clearance` | 4–6, 9 |
| `H39` | Getting Off the Ship | Choose your exit time and see the steps for leaving the ship. This is the starting point for your last morning. | `/home/disembark` | 8, 10 |
| `H40` | Bag Night | Tag your bags and learn the hallway deadline so they are collected on time. It tells you when you are done for the night. | `/home/disembark/bags` | 8, 10 |
| `H41` | Final Night Checklist | Work through everything to do before bed on the last night. Tick items off so nothing is left to the morning. | `/home/disembark/final-night` | 8, 10 |
| `H42` | Cabin Sweep | Check every drawer, the safe and the bathroom before you leave. It stops you leaving things behind. | `/home/disembark/sweep` | 10 |
| `H43` | Customs and Immigration | Learn what to declare and how the line works at your port. It helps you get through customs quickly and correctly. | `/home/disembark/customs` | 10 |
| `H44` | Plan Around My Flight | Choose an exit time that fits your flight, with a safe margin. It shows the latest you can leave without risk. | `/home/disembark/flight` | 8, 10 |
| `H45` | Getting Home from the Port | Find rides, transit and hotels for getting from the ship to home. Pick one and book it before your last morning. | `/home/disembark/onward` | 8, 10 |
| `H46` | Share a Ride | Split a taxi or shuttle with other guests heading the same way. It saves money and sorts the ride before you disembark. | `/home/disembark/ride` | 10 |

### 6.2 Plan family (`/plan/*`)

| ID | Title | Subtext (shown under the title) | Route | Stages |
|---|---|---|---|---|
| `P01` | Pre-Cruise Checklist | See what to do and by when, in order. Tick items off as you go so you always know what is left. | `/plan/checklist` | 4–6 |
| `P02` | Packing List | Build a packing list from your trip, the weather and your plans. Tick items as you pack them. | `/plan/packing` | 5–6 |
| `P03` | Packing for This Ship | See what this ship allows, sells and does not allow. Use it so nothing you pack is taken away. | `/plan/ship-packing` | 5–6 |
| `P04` | Occasion Starter | Start your plan from an occasion such as a honeymoon, birthday or remembrance. The wording and suggestions fit the occasion. | `/plan/starter` | 1, 11 |
| `P05` | Phone Setup Before You Sail | Set up your phone before you sail so you stay connected without surprise charges. It lists the settings to change and why. | `/plan/phone` | 5–6 |
| `P06` | How Hard Is It? | See how much walking, stairs and stamina each activity needs, rated honestly. Choose what suits you and your group. | `/plan/difficulty` | 5 |
| `P07` | Health and Comfort | Sort out medication, motion sickness and comfort before you go. It is a short checklist tailored to your trip. | `/plan/health-prep` | 4–6 |
| `P08` | Medical Card | Record conditions and medication you choose to share with the ship. Only what you enter is shared, and you can remove it any time. | `/plan/medical` | 4 |
| `P09` | Accessibility Profile | Tell us once what you need, and it follows you through check-in and on board. You never have to repeat it. | `/plan/access` | 3–4 |
| `P10` | Special Assistance | Ask for mobility, hearing, vision or other help ahead of time. The ship plans for you before you arrive. | `/plan/assistance` | 3–4 |
| `P11` | Allergy Pre-Flag | Tell the galley about your allergies before you sail. Your request is followed from the kitchen to your table. | `/plan/allergy` | 3–4 |
| `P12` | Readiness for Each Traveller | See documents, payments and forms for each traveller, with one score per person. Fix what is missing before it becomes a problem. | `/plan/readiness` | 4–6 |
| `P13` | Trip Contract | Read your terms on one page, in plain words, with large print and read-aloud. It tells you what you have agreed to. | `/plan/contract` | 3–6, 11 |
| `P14` | Money Plan | See your deposit, final payment and what is left, by date. It helps you plan your money so nothing is paid late. | `/plan/money-plan` | 3–5 |
| `P15` | Split Costs | Divide the trip between the people paying. Everyone sees their share and what is still owed. | `/plan/split` | 3–5 |
| `P16` | Pay Your Share | Pay your part of the trip from a link, with no account needed. You see exactly what you are paying for. | `/plan/shares` | 3–5 |
| `P17` | Price-Drop Watch | Be told if the price of your sailing falls, and stop watching with one tap. No pressure, just a heads-up. | `/plan/price-watch` | 2, 4–5 |
| `P18` | Is This Fare Fair? | See how your fare compares with what is typical for this sailing. It tells you plainly whether you got a fair price. | `/plan/fare-check` | 2, 4–5 |
| `P19` | Guaranteed-Cabin Odds | See what you are likely to get if you choose a guarantee fare. It helps you decide if the saving is worth not picking a room. | `/plan/guarantee` | 2–3 |
| `P20` | Hold a Cabin for 48 Hours | Keep a cabin for 48 hours without paying while you decide. The countdown is honest and nothing is charged. | `/plan/hold` | 3 |
| `P21` | Paste a Plan | Bring in a plan made elsewhere, such as in an AI assistant, and turn it into an editable draft. You keep what you like and change the rest. | `/plan/paste` | 1 |
| `P22` | What Happens If | See the exact cost of cancelling, changing or missing the ship. Pick a scenario to find out before you commit. | `/plan/what-if` | 3, 6 |
| `P23` | Prepay and Credit | Pay for gratuities or on-board credit before you sail. You see what is covered and what it saves. | `/plan/prepay` | 5–6 |
| `P24` | Saved Items and Basket | See the excursions and extras you have saved, with the total. Check out when you are ready, or remove what you do not want. | `/plan/cart` | 5–6 |
| `P25` | Room Upgrades | See better rooms open to your booking, with the real price difference. Move up only if it is worth it to you. | `/plan/upgrades` | 5–6 |
| `P26` | Book Ahead | Reserve shows, dining and treats before you board. Booking early gets the times you want. | `/plan/ahead` | 5–8 |
| `P27` | Kids' and Teens' Clubs | See ages, hours and sign-up for the kids' and teens' clubs. Register your child so they can join from the first day. | `/plan/clubs` | 5, 8–9 |
| `P28` | Gift Ideas | Find gifts to send to a cabin, or ideas for your next trip. It is for planning ahead, and nothing is bought without your say. | `/plan/gifts` | 5, 11 |
| `P29` | Getting to the Port | Plan flights, hotels and the day before you sail. It shows how early to arrive so you do not miss the ship. | `/plan/travel` | 5–6 |
| `P30` | Getting to the Ship | See your door-to-ship timeline and whether you are on track or at risk. It tells you when to leave and what to do if you slip. | `/plan/getting-there` | 6 |
| `P31` | Weather by Port | See what the weather will be in each port on your dates. Use it to pack and to plan your days ashore. | `/plan/weather` | 5–6, 9 |
| `P32` | Storm Watch | Get alerts and see your options if a storm threatens your sailing. It tells you what is happening and what happens next. | `/plan/storm` | 6 |
| `P33` | Away from Home | Make sure home is looked after while you are away. A short list covers mail, pets, security and who to call. | `/plan/away` | 5–6 |
| `P34` | Build My Day | Pick the events and meals that fit your day. The plan adjusts when you change something. | `/plan/day` | 5, 7–9 |
| `P35` | My Reservations | See the dining, shows and spa you have booked. Open any one to change or cancel it. | `/plan/reservations` | 5–9 |
| `P36` | Reservation Details | See the time and place of one reservation and how to change or cancel it. Everything you need for that booking is here. | `/plan/reservations/:id` | 5–8 |
| `P37` | My Excursions | See the shore trips you have booked, with honest difficulty, duration and the all-aboard time. Choose ones that fit you and get back on time. | `/plan/excursions` | 5–9 |
| `P38` | Dining Reservations | Find a table and book it. You see what is available before you decide. | `/plan/dining` | 5–8 |
| `P39` | Autopilot Day | Let the app suggest a whole day based on what you like. Accept it, tweak it or ignore it. | `/plan/autopilot` | 5, 8 |
| `P40` | My Daily Rhythm | Set the pace of your days, whether you are an early bird or a night owl. Suggestions then match your rhythm. | `/plan/rhythm` | 5, 8 |
| `P41` | Surprises | Turn on small, unplanned treats, or turn them off. You decide how many surprises you want. | `/plan/surprises` | 5, 8 |
| `P42` | What the App Thinks You Like | See, correct or clear what the app has inferred about your tastes. You are always in control of what it knows. | `/plan/taste` | 5, 8 |
| `P43` | Organiser and Privacy | Choose who in your group can see and change your plans. Privacy is set by you. | `/plan/organiser` | 4–5, 8–9 |
| `P44` | Ship or Independent | Compare doing a port yourself with taking the ship's tour. See the cost, the risk and the time on each side. | `/plan/compare` | 5, 9 |
| `P45` | Family Traditions | Note the family rituals you want to keep on every trip. They show up in your plans as reminders. | `/plan/traditions` | 5, 8–9 |
| `P46` | Several Cabins, One Day | Plan one day for a group spread across several rooms. Everyone sees where to meet and when. | `/plan/cabins` | 3–5 |
| `P47` | Your Travel Party | Record who is going, their ages and their needs. Everything else in the trip is built from this list. | `/plan/party` | 3–6, 8–9 |
| `P48` | Family at Home | Let someone at home follow your trip with a read-only view. They can see where you are without needing the app. | `/plan/family-link` | 4–6 |
| `P49` | Group Poll and Dream Board | Vote and heart ideas together, one vote each. It helps a group decide without a long chat thread. | `/plan/group-poll` | 1, 4–5 |
| `P50` | Links for Someone at Home or Your Advisor | Create read-only links to share your plan with someone at home or your advisor. You can turn a link off at any time. | `/plan/share-links` | 1, 4–5 |
| `P51` | Trip Story for a Child | Read a short story that tells a child what is coming. It makes the trip less scary and more exciting. | `/plan/child-story` | 4–5 |
| `P52` | Child Brief | Fill in one page about your child for the kids' club. Staff then know what they need to know, and you do not repeat it. | `/plan/child-brief` | 4–5 |

### 6.3 Ship family (`/ship/*`)

| ID | Title | Subtext (shown under the title) | Route | Stages |
|---|---|---|---|---|
| `S01` | Deck Map | Find any venue, lift or stairway on any deck. Use it to get from A to B without asking. | `/ship/map` | 2, 4, 7–10 |
| `S02` | Restaurants and Bars | See every place to eat and drink, with hours and what is included. Choose where to go next. | `/ship/venues` | 2, 4, 7–10 |
| `S03` | Venue Details | See the menu, hours, price and how to reserve one venue. Book a table from here. | `/ship/venues/:id` | 2, 4, 7–9 |
| `S04` | Ship News | Read today's notices and changes from the ship. Check it so you do not miss anything that affects you. | `/ship/info` | 7–9 |
| `S05` | Search the Ship | Find a venue, an event or a service by name. It searches only what is on this ship. | `/ship/search` | 7–9 |
| `S06` | Steps and Deck Laps | Count your steps and your laps around the deck. Set a goal and see your progress. | `/ship/steps` | 8–9 |
| `S07` | Loungers | See where loungers are free and save one. It saves wandering the decks in the heat. | `/ship/loungers` | 8–9 |
| `S08` | Sightings | See wildlife and landmarks spotted from the ship. Add your own sightings for others. | `/ship/sightings` | 8–9 |
| `S09` | Where Are We | See your position, speed and the next port. It answers "where are we?" at a glance. | `/ship/where` | 8–9 |
| `S10` | The Sea Beneath Us | See depth, water and weather around the ship. It turns the sea outside into something you can understand. | `/ship/sea` | 8–9 |
| `S11` | Along the Way | See what you are passing, as you pass it. Look up from the screen at the right time. | `/ship/along` | 8–9 |
| `S12` | Sun, Moon and Stars | See what is in the sky tonight from where you are. It tells you when and where to look. | `/ship/sky` | 8–9 |
| `S13` | Ship Pulse | See how busy the ship is right now, with the age of each figure. Pick a quiet time or place. | `/ship/pulse` | 8–9 |
| `S14` | Ask the Ship | Ask quick questions about the ship and get answers from ship data. It does not guess, and it says when it does not know. | `/ship/ask-ship` | 7–9 |
| `S15` | Order Food and Drinks | Order food and drinks to your cabin or your seat and see the cost first. Follow the order until it arrives. | `/ship/order` | 7–10 |
| `S16` | Bar Menu and Drinks Tracker | See the bar menu and track what you have had against your package. It shows whether the package is paying off. | `/ship/drinks` | 8–9 |
| `S17` | Shops and Specials | See what the shops are selling today. Browse specials without leaving your deck. | `/ship/shops` | 8–9 |
| `S18` | Spa, Salon and Fitness | See treatments, classes and open times. Book a slot that fits your day. | `/ship/spa` | 5, 8–9 |
| `S19` | Dining Favourites and Table | Set your table, favourite venues and dietary needs. Dining then works the way you like. | `/ship/dining-prefs` | 5, 7–9 |
| `S20` | Laundry and Pressing | See prices, drop-off and pick-up for laundry and pressing. Plan it so clothes are back when you need them. | `/ship/laundry` | 7–9 |
| `S21` | Cabin Requests | Ask your steward for something and follow the request until it is done. Nothing gets lost. | `/ship/requests` | 7–10 |
| `S22` | My Stateroom | See your cabin's details, controls and what is in it. Use it to set up your room the way you like. | `/ship/room` | 7–9 |
| `S23` | Wi-Fi | See plans, prices and how to connect to Wi-Fi. Pick the plan that suits how you will use it. | `/ship/wifi` | 7–10 |
| `S24` | Cabin TV | See what is on and how to use your TV. Find shows without searching a remote. | `/ship/tv` | 7–9 |
| `S25` | Muster Drill | Find your muster station and learn how the drill works. Do this before the drill so you are not rushed. | `/ship/muster` | 7–9 |
| `S26` | Emergency Card | See what to do in an emergency, readable offline. It is always available, whatever your connection. | `/ship/emergency` | 6–10 |
| `S27` | Medical Help Now | Reach the medical centre or call for urgent help right now. It gives you the number and the steps. | `/ship/help-now` | 7–10 |
| `S28` | Ask for Help by Text | Ask for help by text when you cannot call. Someone replies and tells you what is happening. | `/ship/text-help` | 7–10 |
| `S29` | Report a Security Concern | Tell the ship's security team about a concern, privately. You decide whether to give your name. | `/ship/report` | 7–9 |
| `S30` | Health and Medical Center | See the Medical Center's hours, prices and what it can treat. Know before you need it. | `/ship/health` | 7–10 |
| `S31` | Seasickness First Aid | Learn what helps with seasickness and when to see a doctor. Quick steps you can follow straight away. | `/ship/seasick` | 7–9 |
| `S32` | Safe Ashore for You | See tips and warnings for the port you are visiting. Stay safe and enjoy the day. | `/ship/safe-ashore` | 9 |
| `S33` | Allergy Confidence | Follow your allergy flag from the galley to your table. It shows who knows and who confirmed. | `/ship/allergy-chain` | 7–9 |
| `S34` | Lost and Found | Report a lost item or see whether one has been found. Follow it through to the end. | `/ship/lost-found` | 7–10 |
| `S35` | Captioned and Signed Shows | Find shows with captions or sign language. Pick one you can follow. | `/ship/access` | 7–9 |
| `S36` | Do Not Disturb | Set quiet hours for your cabin. Your steward and the ship respect them. | `/ship/dnd` | 7–9 |
| `S37` | Port Day | See the all-aboard time on three clocks and when you need to head back to the ship. It keeps a day ashore relaxed and gets you back on time. | `/ship/port` | 9 |
| `S38` | Port Know-How | Learn what to know before you step ashore. It covers money, language, tenders and local advice. | `/ship/port/guide` | 5, 9 |
| `S39` | Port Snapshot | See the port on one page: weather, distances and time. A quick check before you go. | `/ship/port/snapshot` | 9 |

### 6.4 People family (chat and the people-on-this-trip screens)

| ID | Title | Subtext (shown under the title) | Route | Stages |
|---|---|---|---|---|
| `C01` | Party Chat and Guest Services | Chat with your group or with Guest Services. The phone number is always shown in case you need a person. | `/chat` | 4–10 |
| `S40` | Find My Family | See where family members have chosen to share their location. It helps you meet up without a search. | `/ship/family` | 7–10 |
| `S41` | Kids' Club Report | See how your child's day went at the kids' club. It tells you what they did and who they met. | `/ship/kids-report` | 8–9 |
| `S42` | Teen Agreement | Set what your teen can do on their own, agreed together. Both of you see the same rules. | `/ship/teen` | 8–9 |
| `S43` | Games | Play games with your group. Pick one that suits everyone. | `/ship/games` | 8–9 |
| `S44` | Services and Meet-Ups | Find services, worship and meet-ups for guests like you. Join one, or just see what is on. | `/ship/community` | 8–9 |
| `S45` | Solo Safety Timer | Set a timer and tell someone if you do not check in. It is a safety net for time on your own. | `/ship/solo` | 8–9 |
| `S46` | I'm OK Check | Tell your group you are fine with one tap. It saves a worried search. | `/ship/ok-tap` | 8–9 |
| `S47` | You Said, We Did | See what guests asked for and what the ship changed as a result. Add your own idea. | `/ship/you-said` | 8–11 |
| `S48` | Photos | View, choose and buy your photos from the ship. Nothing is bought until you confirm. | `/ship/photos` | 8–11 |
| `S49` | Read Aloud | Have any screen read to you. Useful if your eyes are tired or reading is hard. | `/ship/read-aloud` | 8–9 |

### 6.5 Me family (`/me/*`)

| ID | Title | Subtext (shown under the title) | Route | Stages |
|---|---|---|---|---|
| `M02` | My Trips | See all your bookings in one place, with the next step for each. Open one to see everything about it. | `/me/trips` | 3–11 |
| `M03` | Trip Details | See everything about one booking and what to do next. Payments, documents and changes are all here. | `/me/trips/:id` | 4–6, 11 |
| `M04` | My Details | Check and update your name, contact details and what we hold about you. Correct anything that is wrong. | `/me/profile` | all |
| `M05` | Traveller Details | See one traveller's name, documents and needs. Keep it right so check-in works. | `/me/profile/:id` | 3–4 |
| `M06` | Documents | See what each traveller needs, and what is missing or about to expire. Fix gaps early. | `/me/documents` | 4–9, 11 |
| `M07` | Payments | See your cards, the payments you have made and what is due. Add or change a card here. | `/me/payments` | 3–6 |
| `M08` | Packages | See drinks, Wi-Fi and dining packages and whether they are worth it for you. Add or remove one. | `/me/packages` | 5–9 |
| `M09` | Captain's Circle and Rewards | See your Captain's Circle status, the next tier and what each benefit is worth. Everything is in plain words, so you know what you actually get. | `/me/loyalty` | 4–5, 11 |
| `M10` | My Bill | See what you have charged so far on board. Check it as you go so there are no surprises. | `/me/bill` | 7–10 |
| `M11` | Everything Paid and Charged | See every payment and charge in date order. Use it to find anything that does not look right. | `/me/ledger` | 7–10 |
| `M12` | Top Up, PIN and Gratuities | Add credit, set your PIN and adjust gratuities. Manage your on-board money from one screen. | `/me/money` | 7–10 |
| `M13` | Final Bill and Receipts | See your bill line by line, with receipts and a way to question a charge. Check it before you leave. | `/me/bill/final` | 10–11 |
| `M14` | Family Helper | Let someone you trust help with your trip. They can see and do only what you allow. | `/me/helper` | 4–6 |
| `M15` | Trip History and Receipts | See every trip you have taken, with receipts that never vanish. Come back any time. | `/me/history` | 11 |
| `M16` | Trip Memories | See a recap of where you went and what you did. It is made from your own trip. | `/me/recap` | 11 |
| `M17` | Memory Book and Next Trip | Keep your memory book and see ideas for your next trip. Print it or keep it offline. | `/me/memories` | 11 |
| `M18` | Your Cruise, Wrapped | See your trip in numbers and moments. Share it if you like. | `/me/wrapped` | 11 |
| `M19` | Rate Your Cruise | Tell us how your cruise went. A person reads it, and we follow up if you want. | `/me/feedback` | 10–11 |
| `M20` | Three-Tap Farewell | Say goodbye and settle the last things in three taps. It is the quickest way to finish well. | `/me/farewell` | 10–11 |
| `M21` | Health Note After the Trip | Tell us how you are if you were unwell. We follow up if you need us. | `/me/follow-up` | 11 |
| `M22` | Book Your Next Cruise | Pick up your next trip from where you left off. Your details and preferences carry over. | `/me/rebook` | 11 |
| `M23` | Caring for the Sea | See what this trip's footprint was and what we do about it. Choose what matters to you. | `/me/sustainability` | 11 |
| `M24` | Lost Items, Claims and Complaints | Follow anything you have reported, to the end. Lost items, claims and complaints are all here. | `/me/cases` | 8–11 |
| `M25` | Privacy and Data | See, export or delete what we hold about you. You decide what we keep. | `/me/privacy` | all |
| `M26` | Offers and News | Choose what we send you, if anything. Turn offers and news on or off. | `/me/marketing` | all |
| `M27` | Paper Copies | Print what you need if your phone is not enough. Paper copies of your pass, plan and key details. | `/me/print` | all |
| `M28` | Notifications | Choose what we tell you, and when. Critical alerts always come through. | `/me/notifications` | all |
| `M29` | Visual and Vibration Alerts | Get alerts through light and vibration instead of sound. Useful if you cannot hear or need quiet. | `/me/alerts` | all |
| `M30` | Calm and Inclusion | Switch to quieter screens and simpler wording. It reduces noise and clutter. | `/me/calm` | all |
| `M31` | Travelling After a Loss | Use a gentler way through the app after a loss. It avoids cheerful wording and sudden reminders. | `/me/gentle` | all |
| `M32` | Feeling Anxious | See things that help when you feel anxious and switch on a calm mode. A short guide to what to expect. | `/me/anxiety` | all |
| `M33` | Settings | Set text size, language, contrast and motion. Make the app comfortable for you. | `/me/settings` | all |
| `M34` | My Activity | See what you have done in the app. Check or clear it. | `/me/activity` | all |
| `M35` | Help Centre | Find answers to common questions. Search or browse by topic. | `/me/help` | all |
| `M36` | Contact Us | See phone, chat and email options, with hours. Reach a person when you need one. | `/me/contact` | all |
| `M37` | Fix a Problem | Follow step-by-step fixes for common problems. Most can be solved without calling. | `/me/fix-it` | all |
| `M38` | Extra Help and Cancelling Kindly | Get extra help, and learn how to cancel without a fight. A kind, plain path through hard moments. | `/me/assist` | all |
| `M39` | System Status | See whether everything is working. Check here before you report a problem. | `/me/status` | all |
| `M40` | Report a Problem | Tell us what went wrong. We follow it until it is fixed. | `/me/report-problem` | all |
| `M41` | Demo Controls | Change the date, ship and scenario on a test account. It is only for demo accounts. | `/me/demo` | all |

### 6.6 Outside the tabs

| ID | Title | Subtext (shown under the title) | Route | Stages |
|---|---|---|---|---|
| `X01` | Component Kit | A developer page showing the app's components. It is not part of the guest app. | `/kit` | developer only |
| `X02` | A Day on This Ship | Try a five-minute taste of a day on board, with no sign-in. See what your Tuesday could look like. | `/trial-day` | 1–2 |
| `X03` | Following the Trip | Follow someone's trip, read-only, from a link they sent you. No account is needed. | `/at-sea/:token` | link only |
| `X04` | A Trip Shared with You | See a trip a friend or an advisor has shared with you. Open it and comment without signing up. | `/shared/:token` | link only |

`M41` (Demo controls) is shown only on demo accounts. `X03` and `X04` open from a link someone sends; `X01` is a developer page.


## 7. Tab landing pages

Each tab opens on a landing page with the same coloured header (title = tab name, plus the subtext below). Its body is the list of the screens assigned to that tab for the current stage, grouped and in priority order. **Home** and **Me** appear at every stage and use stage-specific subtext (section 8).

| Tab | Colour | First appears at | Subtext |
|---|---|---|---|
| **Home** | Princess blue | every stage | The home base: your next steps and the six things to care about. |
| **Explore** | teal | Dream | Browse the cruise, the sailings and the ports. |
| **Ask** | pink | Dream | Get answers and advice before you decide. |
| **Sailing** | teal | Discover | Everything about the sailing you are considering. |
| **Cabin** | pink | Discover | Pick the room that suits you. |
| **Cost** | gold | Discover | The real, all-in price, and ways to pay less. |
| **Booking** | teal | Book | Your booking, from price to confirmation. |
| **Travellers** | pink | Book | Who is going, and what each person needs. |
| **Pay** | gold | Book | Deposit, balance and sharing the cost. |
| **Trip** | teal | Manage | Your confirmed trip, and what changes. |
| **Needs** | pink | Manage | Documents, health and access for every traveller. |
| **Group** | gold | Manage | Your travel party and the people at home. |
| **Plan** | teal | Prebook | Book excursions and dining and shape your days. |
| **Prepare** | pink | Prebook | Pack, travel and sort things at home. |
| **Board** | gold | Get to the ship | Check-in, your pass and getting aboard. |
| **Travel** | pink | Get to the ship | Getting to the ship, on time, and what to do if plans change. |
| **Today** | teal | Sea | Your day on board: events, meals and what is next. |
| **Ship** | pink | Embark | Everything aboard in one place, including safety. |
| **People** | gold | Sea | Your family, your group and the community. |
| **Port** | teal | Port | Your day ashore, with the all-aboard time. |
| **Leave** | teal | Disembark | Everything for leaving the ship. |
| **Memories** | teal | Remember | Your trip, kept. |
| **Next** | pink | Remember | Where to next. |
| **Feedback** | gold | Remember | Tell us how it went. |
| **Me** | plum | every stage | Your account, and what you need to know at this stage. |

## 8. The 11 stages: tabs and the screens each tab opens

Order of tabs is the order shown: **Home first, Me last, two or three stage tabs between, most important first.** Home lists the six tile destinations (each tile also shows a one-line state); Home's **Next steps** are actions, not screens. Every other screen the stage uses is under one of the stage tabs or Me. **Settings and help (SH)** is the same group under Me at every stage: `M04` My Details · `M33` Settings · `M28` Notifications · `M25` Privacy and Data · `M26` Offers and News · `M35` Help Centre · `M36` Contact Us · `M30` Calm and Inclusion · `M31` Travelling After a Loss · `M32` Feeling Anxious · `M29` Visual and Vibration Alerts · `M27` Paper Copies · `M34` My Activity · `M37` Fix a Problem · `M38` Extra Help and Cancelling Kindly · `M39` System Status · `M40` Report a Problem · `M41` Demo Controls.


### 1. Dream

**Tabs:** Home (Princess blue) · Explore (teal) · Ask (pink) · Me (plum)

**Home** (Princess blue). Title *Home*; subtext "Let's find a cruise you'll love. Start with the quiz."
- Next steps: 1 Take the quiz · 2 Save a sailing you like · 3 Invite someone to dream with you
- Six tiles → `H02` Find My Cruise; `H13` Is This Cruise for Me?; `H07` Sailing Dates; `H04` Ask the Concierge; `P49` Group Poll and Dream Board; `H11` Saved Sailings

**Explore** (teal). Subtext "Browse the cruise, the sailings and the ports."
- `H06` 7-Night Western Caribbean with Mexico; `H07` Sailing Dates; `H08` Sailing Details; `H09` Port Details; `H11` Saved Sailings; `P04` Occasion Starter; `X02` A Day on This Ship

**Ask** (pink). Subtext "Get answers and advice before you decide."
- `H04` Ask the Concierge; `H03` Talk to a Travel Advisor; `H02` Find My Cruise; `H13` Is This Cruise for Me?; `P21` Paste a Plan; `P49` Group Poll and Dream Board; `P50` Links for Someone at Home or Your Advisor

**Me** (plum). Subtext "Your details and the sailings you have saved."
- `H11` Saved Sailings; plus the SH group.

### 2. Discover

**Tabs:** Home (Princess blue) · Sailing (teal) · Cabin (pink) · Cost (gold) · Me (plum)

**Home** (Princess blue). Title *Home*; subtext "Your sailing, its real cost and your room, in one place."
- Next steps: 1 Choose a room type · 2 Check the real total · 3 Compare, hold or book
- Six tiles → `H08` Sailing Details; `H12` What the Whole Trip Costs; `H14` Choose Your Cabin; `H10` Your Ship; `H11` Saved Sailings; `H03` Talk to a Travel Advisor

**Sailing** (teal). Subtext "Everything about the sailing you are considering."
- `H08` Sailing Details; `H07` Sailing Dates; `H09` Port Details; `H06` 7-Night Western Caribbean with Mexico; `H10` Your Ship; `S01` Deck Map; `S02` Restaurants and Bars; `S03` Venue Details; `H13` Is This Cruise for Me?; `X02` A Day on This Ship

**Cabin** (pink). Subtext "Pick the room that suits you."
- `H14` Choose Your Cabin; `P19` Guaranteed-Cabin Odds; `H13` Is This Cruise for Me?

**Cost** (gold). Subtext "The real, all-in price, and ways to pay less."
- `H12` What the Whole Trip Costs; `H15` Offers for Your Trip; `P17` Price-Drop Watch; `P18` Is This Fare Fair?; `H16` Book Your Cruise; `H03` Talk to a Travel Advisor; `H04` Ask the Concierge

**Me** (plum). Subtext "Your saved sailings, price watches and details."
- `H11` Saved Sailings; `P17` Price-Drop Watch; plus the SH group.

### 3. Book

**Tabs:** Home (Princess blue) · Booking (teal) · Travellers (pink) · Pay (gold) · Me (plum)

**Home** (Princess blue). Title *Home*; subtext "Finish booking. Nothing is lost if you stop."
- Next steps: 1 Finish your booking · 2 Pay the deposit · 3 Check names against passports
- Six tiles → `H18` Finish Your Booking; `H17` Your Booking; `P47` Your Travel Party; `P15` Split Costs; `P22` What Happens If; `P13` Trip Contract

**Booking** (teal). Subtext "Your booking, from price to confirmation."
- `H16` Book Your Cruise; `H17` Your Booking; `H18` Finish Your Booking; `H20` Booking Confirmed; `P13` Trip Contract; `P22` What Happens If; `P20` Hold a Cabin for 48 Hours; `P19` Guaranteed-Cabin Odds; `H08` Sailing Details; `H12` What the Whole Trip Costs; `H14` Choose Your Cabin; `H15` Offers for Your Trip; `H10` Your Ship

**Travellers** (pink). Subtext "Who is going, and what each person needs."
- `P47` Your Travel Party; `M05` Traveller Details; `P09` Accessibility Profile; `P10` Special Assistance; `P11` Allergy Pre-Flag; `P46` Several Cabins, One Day

**Pay** (gold). Subtext "Deposit, balance and sharing the cost."
- `H19` Pay Your Balance; `P14` Money Plan; `P15` Split Costs; `P16` Pay Your Share; `M07` Payments

**Me** (plum). Subtext "Your draft, payments and travellers' details."
- `M02` My Trips; `M07` Payments; `P13` Trip Contract; plus the SH group.

### 4. Manage

**Tabs:** Home (Princess blue) · Trip (teal) · Needs (pink) · Group (gold) · Me (plum)

**Home** (Princess blue). Title *Home*; subtext "Your booking is confirmed. Here is what needs you next."
- Next steps: The next *required* task by due date: payment, passport, medical form, then readiness gaps
- Six tiles → `P14` Money Plan; `M06` Documents; `P12` Readiness for Each Traveller; `H21` Changes to Your Trip; `H10` Your Ship; `P09` Accessibility Profile

**Trip** (teal). Subtext "Your confirmed trip, and what changes."
- `M02` My Trips; `M03` Trip Details; `H20` Booking Confirmed; `H21` Changes to Your Trip; `H23` Plain-English Summaries; `H05` Ask Your Cruise; `H08` Sailing Details; `H09` Port Details; `H10` Your Ship; `S01` Deck Map; `S02` Restaurants and Bars; `S03` Venue Details; `P01` Pre-Cruise Checklist; `P13` Trip Contract; `P14` Money Plan

**Needs** (pink). Subtext "Documents, health and access for every traveller."
- `M06` Documents; `M05` Traveller Details; `P12` Readiness for Each Traveller; `P08` Medical Card; `P09` Accessibility Profile; `P10` Special Assistance; `P11` Allergy Pre-Flag; `P07` Health and Comfort; `H38` Port Entry Rules

**Group** (gold). Subtext "Your travel party and the people at home."
- `C01` Party Chat and Guest Services; `P47` Your Travel Party; `P48` Family at Home; `P49` Group Poll and Dream Board; `P50` Links for Someone at Home or Your Advisor; `P43` Organiser and Privacy; `P46` Several Cabins, One Day; `P51` Trip Story for a Child; `P52` Child Brief; `M14` Family Helper

**Me** (plum). Subtext "Payments, documents and what is due."
- `M02` My Trips; `M03` Trip Details; `M06` Documents; `M07` Payments; `M09` Captain's Circle and Rewards; `P13` Trip Contract; `P14` Money Plan; `P12` Readiness for Each Traveller; `P15` Split Costs; `P16` Pay Your Share; `P17` Price-Drop Watch; `P18` Is This Fare Fair?; `M14` Family Helper; plus the SH group.

### 5. Prebook

**Tabs:** Home (Princess blue) · Plan (teal) · Prepare (pink) · Group (gold) · Me (plum)

**Home** (Princess blue). Title *Home*; subtext "Shape your days before you sail."
- Next steps: 1 Book your first excursion · 2 Reserve dining · 3 Start the packing list
- Six tiles → `P37` My Excursions; `P38` Dining Reservations; `M08` Packages; `P02` Packing List; `P01` Pre-Cruise Checklist; `P47` Your Travel Party

**Plan** (teal). Subtext "Book excursions and dining and shape your days."
- `P37` My Excursions; `P38` Dining Reservations; `P35` My Reservations; `P36` Reservation Details; `P26` Book Ahead; `P27` Kids' and Teens' Clubs; `P24` Saved Items and Basket; `P23` Prepay and Credit; `P25` Room Upgrades; `P28` Gift Ideas; `P34` Build My Day; `P39` Autopilot Day; `P40` My Daily Rhythm; `P41` Surprises; `P42` What the App Thinks You Like; `P44` Ship or Independent; `P45` Family Traditions; `P06` How Hard Is It?; `S18` Spa, Salon and Fitness; `S19` Dining Favourites and Table; `S38` Port Know-How; `H09` Port Details

**Prepare** (pink). Subtext "Pack, travel and sort things at home."
- `P01` Pre-Cruise Checklist; `P02` Packing List; `P03` Packing for This Ship; `P05` Phone Setup Before You Sail; `P07` Health and Comfort; `P29` Getting to the Port; `P31` Weather by Port; `P33` Away from Home; `H38` Port Entry Rules; `H24` When Something Changes

**Group** (gold). Subtext "Your travel party and the people at home."
- `C01` Party Chat and Guest Services; `P47` Your Travel Party; `P48` Family at Home; `P49` Group Poll and Dream Board; `P50` Links for Someone at Home or Your Advisor; `P43` Organiser and Privacy; `P46` Several Cabins, One Day; `P51` Trip Story for a Child; `P52` Child Brief; `M14` Family Helper

**Me** (plum). Subtext "Payments, documents, packages and rewards."
- `M02` My Trips; `M03` Trip Details; `M06` Documents; `M07` Payments; `M08` Packages; `M09` Captain's Circle and Rewards; `P13` Trip Contract; `P14` Money Plan; `P12` Readiness for Each Traveller; `P15` Split Costs; `P16` Pay Your Share; `P17` Price-Drop Watch; `P18` Is This Fare Fair?; `M14` Family Helper; plus the SH group.

### 6. Get to the ship

**Tabs:** Home (Princess blue) · Board (gold) · Travel (pink) · Plan (teal) · Me (plum)

**Home** (Princess blue). Title *Home*; subtext "Get to the ship with time to spare."
- Next steps: 1 Get your boarding pass (check-in) · 2 Confirm how you're getting there · 3 Check your documents
- Six tiles → `H31` Boarding Pass; `H27` Online Check-In; `P30` Getting to the Ship; `M06` Documents; `H25` I'm Delayed; `S26` Emergency Card

**Board** (gold). Subtext "Check-in, your pass and getting aboard."
- `H27` Online Check-In; `H28` Check-In for One Traveller; `H29` What We Have on File; `H30` Check in at the Terminal; `H31` Boarding Pass; `H26` Find My Boarding Pass; `H32` Embarkation Day; `H34` Embarkation Plan; `H36` My Medallion; `H37` Luggage Tags; `S26` Emergency Card

**Travel** (pink). Subtext "Getting to the ship, on time, and what to do if plans change."
- `P29` Getting to the Port; `P30` Getting to the Ship; `P31` Weather by Port; `P32` Storm Watch; `H24` When Something Changes; `H25` I'm Delayed; `H38` Port Entry Rules; `P22` What Happens If; `P33` Away from Home

**Plan** (teal). Subtext "Book excursions and dining and shape your days."
- `P01` Pre-Cruise Checklist; `P02` Packing List; `P03` Packing for This Ship; `P05` Phone Setup Before You Sail; `P07` Health and Comfort; `P35` My Reservations; `P36` Reservation Details; `P37` My Excursions; `P38` Dining Reservations; `P26` Book Ahead; `P24` Saved Items and Basket; `P23` Prepay and Credit; `P25` Room Upgrades; `P47` Your Travel Party; `P48` Family at Home; `C01` Party Chat and Guest Services

**Me** (plum). Subtext "Your documents and anything still to settle."
- `M02` My Trips; `M03` Trip Details; `M06` Documents; `M07` Payments; `M08` Packages; `P13` Trip Contract; `P12` Readiness for Each Traveller; `M14` Family Helper; plus the SH group.

### 7. Embark

**Tabs:** Home (Princess blue) · Board (gold) · Ship (pink) · Plan (teal) · Me (plum)

**Home** (Princess blue). Title *Home*; subtext "Welcome aboard. One step at a time."
- Next steps: 1 Your next boarding step · 2 Find your group · 3 Attend the muster
- Six tiles → `H33` Embarkation Companion; `H35` Meeting-Point Card; `S25` Muster Drill; `S01` Deck Map; `S23` Wi-Fi; `S27` Medical Help Now

**Board** (gold). Subtext "Check-in, your pass and getting aboard."
- `H32` Embarkation Day; `H33` Embarkation Companion; `H34` Embarkation Plan; `H35` Meeting-Point Card; `H31` Boarding Pass; `H36` My Medallion; `H37` Luggage Tags; `H29` What We Have on File; `H26` Find My Boarding Pass; `H24` When Something Changes; `H25` I'm Delayed; `S40` Find My Family; `C01` Party Chat and Guest Services; `S25` Muster Drill; `S26` Emergency Card

**Ship** (pink). Subtext "Everything aboard in one place, including safety."
- `S01` Deck Map; `S02` Restaurants and Bars; `S03` Venue Details; `S04` Ship News; `S05` Search the Ship; `S14` Ask the Ship; `S15` Order Food and Drinks; `S19` Dining Favourites and Table; `S20` Laundry and Pressing; `S21` Cabin Requests; `S22` My Stateroom; `S23` Wi-Fi; `S24` Cabin TV; `S25` Muster Drill; `S26` Emergency Card; `S27` Medical Help Now; `S28` Ask for Help by Text; `S29` Report a Security Concern; `S30` Health and Medical Center; `S31` Seasickness First Aid; `S33` Allergy Confidence; `S34` Lost and Found; `S35` Captioned and Signed Shows; `S36` Do Not Disturb

**Plan** (teal). Subtext "Book excursions and dining and shape your days."
- `P35` My Reservations; `P36` Reservation Details; `P37` My Excursions; `P38` Dining Reservations; `P34` Build My Day; `P26` Book Ahead

**Me** (plum). Subtext "Your account on board: bill, top-up and help."
- `M10` My Bill; `M12` Top Up, PIN and Gratuities; `M11` Everything Paid and Charged; `M08` Packages; `M02` My Trips; `M06` Documents; plus the SH group.

### 8. Sea

**Tabs:** Home (Princess blue) · Today (teal) · Ship (pink) · People (gold) · Me (plum)

**Home** (Princess blue). Title *Home*; subtext "Today on board, and what is next."
- Next steps: 1 Today's next event or reservation · 2 Tonight's dinner or tomorrow's port · (last full day) 3 Bag night and exit time
- Six tiles → `H22` Morning and Evening Briefing; `P38` Dining Reservations; `P34` Build My Day; `S40` Find My Family; `S01` Deck Map; `M11` Everything Paid and Charged

**Today** (teal). Subtext "Your day on board: events, meals and what is next."
- `H22` Morning and Evening Briefing; `P34` Build My Day; `P35` My Reservations; `P36` Reservation Details; `P37` My Excursions; `P38` Dining Reservations; `P39` Autopilot Day; `P40` My Daily Rhythm; `P41` Surprises; `P42` What the App Thinks You Like; `P26` Book Ahead; `S04` Ship News; `H24` When Something Changes; `H25` I'm Delayed; `H39` Getting Off the Ship; `H40` Bag Night; `H41` Final Night Checklist; `H44` Plan Around My Flight; `H45` Getting Home from the Port

**Ship** (pink). Subtext "Everything aboard in one place, including safety."
- `S01` Deck Map; `S02` Restaurants and Bars; `S03` Venue Details; `S04` Ship News; `S05` Search the Ship; `S06` Steps and Deck Laps; `S07` Loungers; `S08` Sightings; `S09` Where Are We; `S10` The Sea Beneath Us; `S11` Along the Way; `S12` Sun, Moon and Stars; `S13` Ship Pulse; `S14` Ask the Ship; `S15` Order Food and Drinks; `S16` Bar Menu and Drinks Tracker; `S17` Shops and Specials; `S18` Spa, Salon and Fitness; `S19` Dining Favourites and Table; `S20` Laundry and Pressing; `S21` Cabin Requests; `S22` My Stateroom; `S23` Wi-Fi; `S24` Cabin TV; `S25` Muster Drill; `S26` Emergency Card; `S27` Medical Help Now; `S28` Ask for Help by Text; `S29` Report a Security Concern; `S30` Health and Medical Center; `S31` Seasickness First Aid; `S33` Allergy Confidence; `S34` Lost and Found; `S35` Captioned and Signed Shows; `S36` Do Not Disturb

**People** (gold). Subtext "Your family, your group and the community."
- `C01` Party Chat and Guest Services; `S40` Find My Family; `S41` Kids' Club Report; `S42` Teen Agreement; `S43` Games; `S44` Services and Meet-Ups; `S45` Solo Safety Timer; `S46` I'm OK Check; `S47` You Said, We Did; `S48` Photos; `S49` Read Aloud; `P27` Kids' and Teens' Clubs; `P47` Your Travel Party; `P43` Organiser and Privacy; `P45` Family Traditions

**Me** (plum). Subtext "Your bill, your spending and anything to sort out."
- `M10` My Bill; `M11` Everything Paid and Charged; `M12` Top Up, PIN and Gratuities; `M08` Packages; `M24` Lost Items, Claims and Complaints; `M02` My Trips; `M06` Documents; plus the SH group.

### 9. Port

**Tabs:** Home (Princess blue) · Port (teal) · Ship (pink) · People (gold) · Me (plum)

**Home** (Princess blue). Title *Home*; subtext "Your day ashore, and when to be back."
- Next steps: 1 Leave-by time · 2 Pick the day's excursion or plan · 3 Safe-ashore tips
- Six tiles → `S37` Port Day; `S38` Port Know-How; `P37` My Excursions; `S32` Safe Ashore for You; `P31` Weather by Port; `S40` Find My Family

**Port** (teal). Subtext "Your day ashore, with the all-aboard time."
- `S37` Port Day; `S38` Port Know-How; `S39` Port Snapshot; `H09` Port Details; `P37` My Excursions; `P44` Ship or Independent; `S32` Safe Ashore for You; `P31` Weather by Port; `H38` Port Entry Rules; `S33` Allergy Confidence; `S45` Solo Safety Timer; `S46` I'm OK Check; `H25` I'm Delayed; `H22` Morning and Evening Briefing; `P34` Build My Day; `P35` My Reservations

**Ship** (pink). Subtext "Everything aboard in one place, including safety."
- `S01` Deck Map; `S02` Restaurants and Bars; `S03` Venue Details; `S04` Ship News; `S05` Search the Ship; `S06` Steps and Deck Laps; `S07` Loungers; `S08` Sightings; `S09` Where Are We; `S10` The Sea Beneath Us; `S11` Along the Way; `S12` Sun, Moon and Stars; `S13` Ship Pulse; `S14` Ask the Ship; `S15` Order Food and Drinks; `S16` Bar Menu and Drinks Tracker; `S17` Shops and Specials; `S18` Spa, Salon and Fitness; `S19` Dining Favourites and Table; `S20` Laundry and Pressing; `S21` Cabin Requests; `S22` My Stateroom; `S23` Wi-Fi; `S24` Cabin TV; `S25` Muster Drill; `S26` Emergency Card; `S27` Medical Help Now; `S28` Ask for Help by Text; `S29` Report a Security Concern; `S30` Health and Medical Center; `S31` Seasickness First Aid; `S33` Allergy Confidence; `S34` Lost and Found; `S35` Captioned and Signed Shows; `S36` Do Not Disturb

**People** (gold). Subtext "Your family, your group and the community."
- `C01` Party Chat and Guest Services; `S40` Find My Family; `S41` Kids' Club Report; `S42` Teen Agreement; `S43` Games; `S44` Services and Meet-Ups; `S45` Solo Safety Timer; `S46` I'm OK Check; `S47` You Said, We Did; `S48` Photos; `S49` Read Aloud; `P27` Kids' and Teens' Clubs; `P47` Your Travel Party; `P43` Organiser and Privacy; `P45` Family Traditions

**Me** (plum). Subtext "Your bill, your spending and anything to sort out."
- `M10` My Bill; `M11` Everything Paid and Charged; `M12` Top Up, PIN and Gratuities; `M08` Packages; `M24` Lost Items, Claims and Complaints; `M02` My Trips; `M06` Documents; plus the SH group.

### 10. Disembark

**Tabs:** Home (Princess blue) · Leave (teal) · Ship (pink) · People (gold) · Me (plum)

**Home** (Princess blue). Title *Home*; subtext "Getting home: your exit, your bags and your bill."
- Next steps: 1 Choose your exit time · 2 Bags out tonight · 3 Check your bill
- Six tiles → `H39` Getting Off the Ship; `H40` Bag Night; `M13` Final Bill and Receipts; `H43` Customs and Immigration; `H42` Cabin Sweep; `H45` Getting Home from the Port

**Leave** (teal). Subtext "Everything for leaving the ship."
- `H39` Getting Off the Ship; `H40` Bag Night; `H41` Final Night Checklist; `H42` Cabin Sweep; `H43` Customs and Immigration; `H44` Plan Around My Flight; `H45` Getting Home from the Port; `H46` Share a Ride; `M13` Final Bill and Receipts; `M10` My Bill; `S34` Lost and Found

**Ship** (pink). Subtext "Everything aboard in one place, including safety."
- `S01` Deck Map; `S02` Restaurants and Bars; `S15` Order Food and Drinks; `S21` Cabin Requests; `S23` Wi-Fi; `S26` Emergency Card; `S27` Medical Help Now; `S28` Ask for Help by Text; `S30` Health and Medical Center; `S34` Lost and Found

**People** (gold). Subtext "Your family, your group and the community."
- `C01` Party Chat and Guest Services; `S40` Find My Family; `S47` You Said, We Did; `S48` Photos

**Me** (plum). Subtext "Your final bill, your receipts and goodbye."
- `M13` Final Bill and Receipts; `M10` My Bill; `M11` Everything Paid and Charged; `M12` Top Up, PIN and Gratuities; `M20` Three-Tap Farewell; `M24` Lost Items, Claims and Complaints; `M19` Rate Your Cruise; `M02` My Trips; plus the SH group.

### 11. Remember

**Tabs:** Home (Princess blue) · Memories (teal) · Next (pink) · Feedback (gold) · Me (plum)

**Home** (Princess blue). Title *Home*; subtext "Your trip, and where to next."
- Next steps: 1 See your recap · 2 Tell us how it went · 3 Dream up the next one
- Six tiles → `M16` Trip Memories; `M17` Memory Book and Next Trip; `M19` Rate Your Cruise; `M09` Captain's Circle and Rewards; `M15` Trip History and Receipts; `M22` Book Your Next Cruise

**Memories** (teal). Subtext "Your trip, kept."
- `M16` Trip Memories; `M17` Memory Book and Next Trip; `M18` Your Cruise, Wrapped; `S48` Photos; `S47` You Said, We Did; `M15` Trip History and Receipts

**Next** (pink). Subtext "Where to next."
- `M22` Book Your Next Cruise; `H06` 7-Night Western Caribbean with Mexico; `H07` Sailing Dates; `H08` Sailing Details; `H09` Port Details; `H11` Saved Sailings; `H02` Find My Cruise; `H13` Is This Cruise for Me?; `H04` Ask the Concierge; `P28` Gift Ideas; `P04` Occasion Starter; `M09` Captain's Circle and Rewards

**Feedback** (gold). Subtext "Tell us how it went."
- `M19` Rate Your Cruise; `M21` Health Note After the Trip; `M20` Three-Tap Farewell; `M23` Caring for the Sea; `M24` Lost Items, Claims and Complaints

**Me** (plum). Subtext "Your history, receipts, rewards and settings."
- `M15` Trip History and Receipts; `M13` Final Bill and Receipts; `M09` Captain's Circle and Rewards; `M06` Documents; `M02` My Trips; `M03` Trip Details; `P13` Trip Contract; `H20` Booking Confirmed; plus the SH group.

## 9. Coverage checks (generated from the same data, and the tests in P2 will repeat them)

- Routes in `routes.ts`: 195. Catalogued: 191 screens + 4 tab landing pages. Missing from the catalogue: 0.
- Titles are unique across all 191 screens: yes.
- Screens reachable from a tab in at least one stage: 188 of 191. The other 3 are outside the tabs by design (`X01` developer page, `X03` and `X04` link-only pages).
- Every stage has Home first and Me last, and 2 or 3 stage tabs between (Dream has 2, all others 3).
- Screens a stage uses: Dream 32; Discover 38; Book 43; Manage 58; Prebook 73; Get to the ship 62; Embark 67; Sea 93; Port 88; Disembark 48; Remember 47.
- **Not in Dream:** any `S` (ship) screen, `H10` and every cost, cabin or booking screen. The first ship screens (`S01`–`S03`, `H10`) appear in Discover, for the sailing in focus.

---

## 10. Implementation plan (phased; I will commit and stop after each phase, per `CLAUDE.md`)

Verification for every phase is `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` only. No browser testing and no `dotnet test`.

| Phase | Scope | Output |
|---|---|---|
| **P0** | Your review of this document | agreed screens, titles, subtexts and tab sets |
| **P1** | **Stage engine on the server** (section 3): record the events that matter, derive `stage`, `focusSailingId` and the reason, return them from the context endpoint. The testing-date override stays. | `dream` and `book` become reachable; the "Discover" header bug is fixed |
| **P2** | **Screen registry.** One TypeScript table: `id`, `path`, `title key`, `subtext key`, `family`, and per stage the tab it sits in. It replaces `HUBS`, `STAGE_MENUS` and `QUICK`. Generated tests: every route has an entry; every entry has a unique title and a subtext; every stage has Home first, Me last and 2 or 3 tabs between; every stage screen is under a tab. | `src/routes/screens.ts` plus tests |
| **P3** | **Page header and colour.** A `PageHeader` (title plus subtext in the coloured bar) on every screen, coloured by tab (5.3): new plum tokens in `themes.css` (light, dark, high-contrast, night) checked by `contrast.test.ts`, the area colour on cards and section titles, and the "opened from" navigation state; titles and subtexts added to `en.ts` and `es.ts`. | all 191 screens have the new header |
| **P4** | **Shell and navigation.** Tabs by stage, desktop rail with the same tabs, tab landing pages, search filtered to the stage, stale-address-goes-Home, first-appearance note. | tabs appear and change with the stage |
| **P5** | **Home rebuilt** on Next steps plus six tiles, with Dream, Discover and Book content. | the new-customer experience is complete |
| **P6** | **Manage, Prebook, Get to the ship** (tabs, Home and Me contents). | before sailing |
| **P7** | **Embark, Sea, Port, Disembark.** | on board |
| **P8** | **Remember and the Next trip track,** multi-trip and cancelled-booking cases. | full loop |
| **P9** | **Docs and audit.** Update `stage-menus-matrix.md` and the README; final coverage tests. | final check |

---

## 11. Decisions and risks

**Settled:** Plum for Me. A tab keeps its colour at every stage, and a stage's three tabs are always different colours. Cards take the area's colour instead of rotating through four accents. Dream, Discover and Book show no Plan, Ship or Chat tab. No locked screens. Paying in full early opens excursions and dining. A guest can move themselves to Embark ("I'm at the terminal"). The disembark items appear on Home and in **Today** one night early while the stage is still Sea.

**Also settled (review of v3):**
- **Tab names** in 5.1 are approved as they are.
- **Dream keeps two stage tabs** (Explore, Ask); we can add a third later if needed.
- **Sea's Today tab** carries the last-full-day disembark screens (`H39`–`H41`, `H44`, `H45`).
- **Safety screens live inside Ship**, with no separate Safety tab.
- **Chat is not a tab for now.** Party chat and Guest Services sit inside Group, Plan, Board or People. Pulling Chat out onto its own tab is a likely later change, so the registry (P2) should make moving `C01` to a tab a data change, not a code change.
- **Titles, subtexts and tab placements** in sections 6 and 8 are approved as drafted.

**No decisions are open.** The next step is P2 when you ask for it.

**P1 as built (2026-11-03).**
- `server/Princess.Api/Domain/StageRules.cs` is the engine: pure, unit tested (`StageRulesTests`). `ContextService` feeds it saved sailings (favourite keys `sailing:<id>`), the draft, recent `JourneyEvents`, bookings and payments, and `GET /me/context` now returns `stage`, `focusSailingId` and `stageReason`.
- Events are in `dbo.JourneyEvents`. `POST /booking/quote` records `priceView`; `POST /me/journey/events` accepts `lookCloser`, `priceView`, `cabinView`, `sharedAccepted`, `planImported` and `atTerminal`. An intent keeps a sailing in focus for 24 hours (the length of a quote lock). The screens that send `lookCloser`, `cabinView`, `sharedAccepted` and `planImported` arrive with P5; until then Dream moves to Discover on a save or a priced quote.
- The testing date still drives everything: events carry the demo clock's "now", and a demo account's chosen sailing is used for the dates. The app asks for the context again every minute while visible, after a demo-clock change reaches the server, and after saving or removing a sailing. The test bar shows the reason as a tooltip.
- Not built because the app has no such feature yet: the 48-hour cabin hold (Book via a hold), "boarding pass scanned" and "scanned off" (staff-side scans), and "confirmed aboard". The clock covers them. Agent bookings count as a confirmed trip for the stage, though `booking` in the context still excludes them.
- The trip a finished guest is in (stage Remember) is kept for 10 days after the last day; `booking` in the context is not, so Remember screens that need the booking are P8's to settle.

**Risks:**
- **Reclassifying 191 screens** is the biggest piece of work. The generated check proves coverage, not whether each placement is right; I need your read of sections 6 and 8.
- **Server first.** P1 changes the context endpoint; `docs/backend-plan.md` and the API docs are updated with it.
- **Guests don't progress in a straight line.** The reversals and multi-trip rules in section 3 are the likeliest to need adjusting.
- **Long Ship tab at Sea.** It holds about 35 screens. The landing page groups them (Find, Services, Safety) to keep it readable.

**P2 as built (2026-11-03).**
- `src/routes/screens.ts` is the registry, generated from sections 6 and 8 of this plan: 191 `ScreenDef`s (`id`, `path`, `title`, `subtext`, `family`), `STAGE_TABS` (per stage: Home subtext and six tiles, 2 or 3 tabs with colour, subtext and ordered screen IDs, and Me), `SETTINGS_AND_HELP`, and helpers (`placementIn`, `screensOfStage`, `primaryTab`, `stageUses`, `screenForPath`). Moving a screen, `C01` included, between tabs is a data edit.
- Titles and subtexts are plain English in the registry for now. P3 moves them to `en.ts` and `es.ts` as keys (the i18n test requires every key to be used, so they cannot be added before the header uses them).
- `HUBS`, `STAGE_MENUS` and `QUICK` are **not removed yet**: `HubList` and the tab front pages still read them. P4 switches the shell to the registry and deletes them. Until then both exist side by side.
- `src/routes/screens.test.ts` repeats the section 9 checks (every route has an entry, unique titles, 2 or 3 tabs, every stage screen under a tab, per-stage counts 32/38/43/58/73/62/67/93/88/48/47).

**P3 as built (2026-11-03).**
- `src/ui/PageHeader.tsx` is the coloured bar (the page's one `h1` plus the subtext). The **Shell** draws it above every screen that has a registry entry and is not public (`X02`–`X04` sit outside the shell and keep their own `h1`); the 5 tab front pages (`/`, `/plan`, `/ship`, `/me`, and `/chat` which is also `C01`) are decided in P4/P5. The per-screen `h1`s were removed (about 120 files). Where an `h1` carried live information (sailing dates, port name, ship name, trip dates, check-in step, "Saved"), it is now an `h2` in the body.
- Titles and subtexts are keys `screen.<ID>.title` and `screen.<ID>.subtext` in `en.ts`; `screens.ts` holds `titleKey`/`subtextKey`. **Spanish is not done:** the 382 strings fall back to English. `es.ts` does not require the `screen.` group yet; translate them before enabling it.
- Colour: `--plum`, `--plum-tint`, `--header-plum-start/end` in all five theme blocks, and eight plum pairs in `contrast.ts` (checked by `contrast.test.ts`). The shell carries `data-area` (blue, teal, pink, gold, plum) in place of `data-section`; cards, section titles, the header and big figures read `--sec`, so the card colour rotation is gone.
- `areaFor` (in `screens.ts`) picks the colour: Settings and help are plum; else the tab the link says it was opened from (`openedFrom(colour)` as router state), if the stage lists the screen under it; else the area the guest just left, by the same test; else the screen's primary tab; else the old tab colour. No link sends `openedFrom` yet (P4 wires the new tabs); the "area just left" rule covers moving around inside one area meanwhile.
- `mp.title` and `dl6.essentials.title` were dropped (their screens now use the registry title).

**P4 as built (2026-11-03).**
- `src/routes/stageNav.ts` is the navigation logic (framework-free, tested in `stageNav.test.ts`): `navTabs(stage)` (Home, the stage's tabs, Me), `tabAtPath`, `tabScreenIds`, `accessAt` (show, or send Home), `areaAt`, `activeTabKey`, `listedScreens`, `newTabLabels`.
- The Shell shows the stage's tabs (phone bar and desktop rail, one colour per tab, `--tab-count` columns). The stage is the server's (`useJourneyPosition`). Tab names and subtexts and the Home and Me subtexts are keys in `en.ts` (`tabname.*`, `tabsub.*`, `stage.<stage>.home|me`), checked against the registry by a test; Spanish falls back to English.
- **Landing pages.** Plan and Ship keep `/plan` and `/ship` (their existing content stays above the list); every other stage tab opens `/tab/<name>` (`TabLanding`). Home, Me, Plan and Ship now list the registry's screens for the stage (`TabScreens`/`ScreenList`: title as link, subtext beneath, `openedFrom` colour in the link state) in place of `HubList`. The landing header is drawn by the Shell (tab name and subtext); the per-page `h1` of Home, Plan, Ship and Me was removed (the trip dates on Home are an `h2`). Screens that need an id (a port, a reservation, a booking step) are left out of lists; H08 and M03 use the focus sailing and booking number. A Ship tab of more than twelve screens is split into Find (S01–S14), Services (S15–S24) and Safety (S25–S36) headings.
- **Stale addresses go Home.** A registry screen the stage does not use, a Plan or Ship address at a stage without that tab, or an unknown `/tab/` name, redirects to `/`. It waits until the server's context has arrived, so a deep link is not judged on a guessed stage. `X` screens and addresses outside the registry are left alone.
- **Search** (`/ship/search`) offers only screens the stage uses, and content results (venues, events, tours, ports) only when their screen is open at the stage. Screens of an earlier stage that the current stage no longer uses come after, labelled "From your trip", and open from the result (link state `earlier`); typed or refreshed, they still go Home.
- **First-appearance note** (`NewTabsNote`, on Home): "We've added Ship." once per device per new tab, with a Got it button; a device with nothing recorded starts from the current stage's tabs so a fresh install says nothing. The seen tabs are kept in `localStorage` (`princess.seenTabs`).
- **Removed:** `HUBS`, `QUICK`, `PARENT`, the depth and hub checks (`hubs.ts` keeps the stage list, `JOURNEY_OF_STAGE` and `STAGE_ACTION`), `stageMenus.ts` and `HubList`, with their tests and the `hub.*` strings. `nav.ts` still holds the five legacy `TABS` and the 15 `TOP_TASKS` for the tap-budget check; `findFamily` now starts at `/tab/people`.
- The test harness (`renderAt`) puts a signed-in guest at the first stage that uses the screen under test.

**Follow-ups to P1 and P3 (2026-11-03).**
- **Journey events are sent.** `recordJourney(kind, sailingId)` in `src/runtime/index.ts` posts to `/me/journey/events` (once per kind and sailing per session, signed in only, never throws) and asks for the stage again. Wired: `lookCloser` when a sailing's details open (H08), `cabinView` on the cabin chooser (H14), `planImported` when kept lines are saved on Paste a Plan (P21), and `atTerminal` from a new "I'm at the terminal" button on H30, which then opens the embarkation screen. **`sharedAccepted` is not wired:** no screen lets a signed-in guest accept a shared sailing yet. The 48-hour hold, "pass scanned", "scanned off" and "confirmed aboard" still have no feature behind them.
- **Spanish is complete for the registry.** All 382 screen titles and subtexts, the 21 tab names and subtexts, the 22 Home and Me subtexts and the 12 demo stage names are in `es.ts`, and the Spanish test now requires the `screen.`, `stage.`, `tabname.`, `tabsub.` and `tabs.` groups.
- **`openedFrom`** is still sent only by the tab lists. Other links rely on the "area just left" rule, which gives the right colour except for a screen under two tabs reached by a typed address; P5 sends it from the Home tiles.

**P5 as built (2026-11-03).**
- `src/routes/stageHome.ts` (framework-free, tested) holds the three Next steps per stage and the six tiles with their addresses; `src/ui/home/StageHome.tsx` draws them. Steps and tiles are keys `stage.next.*`, `stage.tile.*` in `en.ts` and `es.ts`.
- **Scope:** Home is rebuilt for Dream, Discover and Book when the guest has no trip. Manage onward keeps the existing Home until P6 to P8. A signed-out or new guest sees Next steps, six tiles and the lost-pass finder; the old Explore block, quick links and journey strip no longer sit on those Homes (Explore, Ask, Sailing, Cabin and Cost hold them).
- A step is marked done only when the data shows it: a saved sailing (Dream 2), a chosen room type in the draft (Discover 1). The quiz, the dream-board invite, the cost check and the passport check keep no record yet, so they are never ticked. The tiles say "N saved" for Saved Sailings and "not started" for the booking tiles; the others show the screen's subtext. Tiles send `openedFrom('blue')`.
- Not done: the `sharedAccepted` event still has no screen. `render.test.tsx` was updated (ports are reached from Sailing Details, not Home).

**P6 as built (2026-11-03).**
- The tabs and Me lists for Manage, Prebook and Get to the ship came with P2 to P4 (the registry); P6 is their Home. `stageHome.ts` now has `TRIP_STAGES` and three Next steps each: Manage (pay what is due, documents for every traveller, readiness), Prebook (first excursion, dining, packing list) and Get to the ship (boarding pass, how you are getting there, documents). Six tiles come from the registry. Keys `stage.next.manage|prebook|getToShip.1-3` are in `en.ts` and `es.ts`.
- A step is ticked only from trip data: paid in full, no missing documents or passport problems, check-in done. The excursion, dining, packing, readiness and travel steps keep no record, so they are never ticked. Agent bookings send payment to Payments, since the agent handles it.
- `HomeScreen` shows, for a guest with a trip at these stages (not aboard, not in essentials mode): the sailing dates, the updates banner, booking number and countdowns, the one next-action banner, then `StageHome`. The old Explore block, quick links, offers and small-delight cards no longer sit on these Homes. Embark onward is P7.

**P7 as built (2026-11-03).**
- `stageHome.ts` has `ABOARD_STAGES` and the Next steps for Embark (next boarding step, meeting point, muster drill), Sea (today's plan, dining, and bag night from the last full day), Port (port day, excursions, safe ashore) and Disembark (exit time, bags, bill). Keys `stage.next.embark|sea|port|disembark.*` are in `en.ts` and `es.ts`. Six tiles come from the registry.
- A step is ticked only from data: the muster drill (`today.muster.done`). Sea's third step appears only on the last full day or later. The others keep no record.
- `HomeScreen`, for a guest on board at these stages: updates and nudges, then `StageHome`, then the live on-board card (`OnboardHome`: port countdown, weather, tonight). The landing card, journey strip, offer card and old tab list no longer sit on this Home. The tabs, Me lists and subtexts came with P2 to P4.

**P8 as built (2026-11-03).**
- `stageHome.ts` has `REMEMBER_STAGES` and the Remember Next steps (see your recap, tell us how it went, dream up the next one). Only the third is ticked, once a sailing is saved (which is also what starts the Next trip track on the server). Keys `stage.next.remember.1-3` and `stage.otherTrip` are in `en.ts` and `es.ts`.
- `HomeScreen`, at Remember: updates, `StageHome` (steps and six tiles), then one "Your other trip" line per booking still to sail, so a returning guest with a new booking is not lost. The old after-cruise card no longer sits on this Home.
- Multi-trip and cancelled-booking cases need no new rule here: the server's stage engine already returns a cancelled booking to Discover (P1), and the "other trips" list reads `/me/trips`.
