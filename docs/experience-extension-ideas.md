# Experience extension ideas: more value, more polish, more fun

Status: **Research written 2026-11-03. Nothing here is built or scheduled.** It is a menu to choose from, not a plan. When you pick items, they become phases in the usual way (one phase, commit, stop).

Companion documents: `stage-menus-matrix.md` (what each stage shows today), `small-delights-plan.md` (the DL1 to DL9 work already built), `next-level-plan.md` (N1 to N8), `leading-features-requirements.md`. This document tries not to repeat anything those already built.

## 1. How this was done, and how far to trust it

- Read `CLAUDE.md`, the README, the stage matrix, `src/routes/screens.ts` (the registry of about 165 screens), all the "Built" and "Not done" notes of the delight phases, and the next-level plan.
- Ran a script over the screen components under `src/ui` that lists the headings, labels and cards each one shows (it maps each `t('...')` key to its English text), and read the code of a handful in full (quiz, sailings, saved, games, the tab list, the journey strip). I did not read every line of every screen or of the `src/domain` rules, so a "Today" line is a summary of what the screen's text says it does.
- Looked at the styling: 17 CSS files totalling 1,419 lines, one motion keyframe (`fade-in`), two images in `src/assets` (the logo and Stanley), and the theme list (light, dark, night, high contrast).
- I did not open a browser, run the app, run `dotnet`, or run any test (project rules). So "Today" lines are what the code and strings say, not what a guest sees. Where I guessed, I say "I think". Check a line before building from it.
- I did not read every server service. Ideas tagged **SV** (needs server work) are my reading of what the front end cannot do alone, under the thin-client rule in `CLAUDE.md`.

### 1.1 Tags used on every idea

| Tag | Meaning |
|---|---|
| **S / M / L** | Rough size. S is a day or less of work in one phase, M is a phase, L is a phase plus a follow-up. |
| **FE** | Front end only. Any state it keeps goes in the synced per-person memory store, so a guest can change device. |
| **SV** | Needs a server endpoint, table or service as well. |
| **PR** | Needs a provider seam (`IWeather`-style) with a simulated implementation behind it, per `CLAUDE.md`. The front end must not know it is simulated. |
| **ART** | Needs illustration, photography or icon work that code alone cannot supply. |
| ★ to ★★★ | My view of the guest value. ★★★ is "a guest would tell a friend about this". |

Each page has two lines: **Improve** (a better version of what is there) and **New** (something that does not exist yet). Pages that appear in several stages are covered once, where they first matter, and each later stage notes how the page should behave differently there.

## 2. What the app already does well (so the ideas below build on it)

- The stage model works. Eleven stages derived on the server, three tabs per stage, and the same tab order every time.
- Honesty is a real design rule. Prices say "estimate", simulated data says so, nothing is hidden behind a countdown, and charge checks exist. That trust is the app's best asset, and the ideas below keep it.
- The "small delights" set (DL1 to DL9) already covers many one-off touches: ring on readiness, leave-by time, driver card, ship-lengths to go, rest blocks, sunset watch spots, thank-yous, postcards to a future self, ports stamps, a land map of where you have sailed. I have not suggested any of those again.
- Accessibility is built in (calm mode, simple mode, high contrast, captions, read-aloud, large print, paper copies).

## 3. What I found: ten themes that cut across the stages

These came out of reading all the screens in a row. Most individual ideas later in the document are an instance of one of them.

### 3.1 The app is a very good form and a thin brochure

Almost every screen is a card of text, a form, or a list of links. The whole app has two bitmap images (logo and Stanley), no illustrations, no photography of the ship or the ports, one animation (`fade-in`), and icons used mainly on the tab bar and in a few cards. The photos screen literally says "No picture previews in this concept" and shows each photo as a text description. For something people choose for fun, the tone is correct (calm, plain, trustworthy) but the surface is flat. The biggest styling win is not a restyle. It is **adding things to look at** (section 4).

### 3.2 There is one cruise, and the app does not lean into that

The catalogue is one route, one ship (Sun Princess) and eight sailings that differ only in date and price. That is a limit for Discover, but it is also an opportunity. With one cruise, every page can be *deeper* than a generic travel site could manage: real day-by-day shapes, every venue, every port, an exact walking route from the gangway to each dinner. Several "Find My Cruise" and "Compare" screens are written as if there were a catalogue, and then show a list of room types. Either lean in (make the single cruise feel richly known) or make the screens honest about the narrower job (section 6, Dream and Discover).

### 3.3 Stage tabs are text link lists

`ScreenList` renders each tab as a vertical list of title plus one-line subtext. The Ship tab already has groups, but it still lists around 35 destinations as text at Sea and Port. A guest in a hurry cannot tell, from the tab, what is open now, what has a wait, or what needs them. The tab pages are the app's shop window and they show no goods. Live values on the tile ("Open now", "4 min wait", "2 of 3 packed", "Due Friday") and icons on every tile would make each tab useful without opening anything (section 4.4).

### 3.4 Stanley is a button, not a guide

Stanley (the cruise helper) has a top-bar button and a tab-bar button, and a chat dialog. He does not appear anywhere else: not in empty states, not on success moments, not as the voice of the first-time guest's walkthrough. Empty and loading states across the app are plain sentences ("You have not asked for help", "Nothing booked yet"). A consistent mascot with a few poses is the cheapest way to add warmth and consistency (section 4.2). It also gives the AI a natural hand-off from any page ("Ask Stanley about this").

### 3.5 Pages inform, but few pages *close the loop*

Several screens end in a copy button, a "tick" or a "tell the ship", and then nothing comes back. Examples: the allergy flag follows from kitchen to table but the guest never gets "confirmed by the galley" as a moment; special assistance is requested but there is no confirmation card to show a crew member; thank-yous are sent and there is no "you said, we did" for them; the price watch tells you of a drop but does not say what to do. A small **"what happened to this"** status, consistently shown (requested → seen → done), would turn many one-way screens into relationships.

### 3.6 The app knows a lot and shows it one screen at a time

The server holds the booking, the party, ages, needs, preferences, the plan, the bill, the weather, the ship's position and the Pulse numbers. Yet most screens answer one question each. There is very little **joining up** across screens: the day card knows your dinner and your gangway walk, but the packing list does not know it is formal night, Autopilot does not know the weather looks wet, the bill does not know the package is nearly paid back, the Port Day does not know your mobility profile. The strongest ideas below are those that connect two things the app already knows.

### 3.7 Moments are not marked

The journey has real emotional peaks: the booking is confirmed, check-in finishes, the boarding pass appears, the medallion switches on, you step on board, the muster drill is done, first sail-away, first port, the last night, the last morning, "welcome home". Right now these are a Banner or a tick. There is no shared "moment" component. A small, reusable celebration (a short animation, a Stanley pose, a stamp that lands in a passport, a line in the trip diary) respects the calm tone and makes the journey feel like a journey (section 4.3).

### 3.8 Little "home field advantage" is used

Guests carry a phone with a camera, a clock, a compass-less browser, vibration (on Android), speech, notifications and offline storage. Barely any of that is used: no camera in the app except the photo upload, no haptics, no share-sheet use except in a few cards, no "add to Wallet" beyond the simulated pass, no widgets. Within the PWA limits, there is room (section 4.5).

### 3.9 The lists are long and the "why this first" is missing

Prebook's Plan tab lists 22 screens; the Ship tab at Sea lists 35; the Me tab at Manage lists 13 plus 18 settings. Each list is in a good order, but there is no personalisation: a wheelchair user, a family with a 5-year-old, a solo traveller on a budget and a honeymooner see the same order. The party profile (ages, needs, occasion, mobility) already exists. **Reordering and pinning tabs by the party profile** is cheap and would make the app feel built for each guest (section 4.4).

### 3.10 There are four assistants with four names

A guest can ask **Stanley** (the top-bar helper, cruising only), **Ask the Concierge** (H04, pre-booking facts), **Ask Your Cruise** (H05, their own booking, and it can change the plan after confirmation) and **Ask the Ship** (S14, ship data). Each has its own screen, its own rules and its own empty state. The rules behind them are sound (each only answers from its own data), but the guest does not know which to pick, and "Concierge" sounds like it can book. One front door (Stanley) that routes to the right data source and says which one it used would cut the choice to one. The other three become modes or tools behind him, with the same confirm-before-act rule. Size L, FE plus SV (the pipeline in `stanley-plan.md` already has the pieces). ★★★.

## 4. Cross-cutting upgrades

### 4.1 A "fun" language for the whole app (styling)

Keep the calm, honest voice. Add playfulness through visuals and tiny interactions, not through jokes in the copy, and always behind the existing reduced-motion, calm-mode and simple-mode switches.

| # | Idea | Size | Notes |
|---|---|---|---|
| 4.1.1 | **Stage hero art.** One wide, simple illustration (pixel art in Stanley's style; see section 14) at the top of each stage's Home: a dreamy horizon (Dream), a ship on a calendar (Book), a half-packed suitcase (Prebook), a gangway (Embark), a sunset wake (Sea), a postcard port (Port), a sunrise skyline (Disembark), a photo album (Remember). It also swaps by time of day, using the sunrise and sunset the app already reads from the sky feed. | M, ART, FE | ★★★. The single biggest "looks fun" lever. Small WebP files keep it light; a night variant covers the dark themes, and high contrast hides the art. |
| 4.1.2 | **Port palettes and postcards.** Each port gets a colour pair and a flat illustration (Cozumel reef, Belize cayes, Roatán hills). The port guide, port day, packing weather and the keepsakes use it. | M, ART, FE | ★★. Gives the three ports a face. Contrast checks already exist for themes, so the palettes slot into that test. |
| 4.1.3 | **Icons everywhere a list is.** Every row in a tab list, every venue, every excursion and every event gets an icon from one set (`screenIcons.ts` already maps screens). | S, FE | ★★. Lifts scanning speed a great deal at no cost to meaning. |
| 4.1.4 | **A shape and motion vocabulary.** The hero card already has the signature rounded corner (`--radius-hero: 48px 8px 8px 8px`). Extend it: a "ticket" card (notched edge) for passes and tours, a "postcard" card (stamp corner) for memories, a "badge" for milestones. Three motions only: *lift* (cards on tap), *drift* (a slow wave line on hero art), *land* (a stamp or tick pressing in). | M, FE | ★★. Small CSS set, all disabled by `data-motion='reduced'`. |
| 4.1.5 | **Depth and light.** Surfaces are flat today. A soft gradient on hero cards that follows the theme (warmer at dusk, cooler at dawn), a gentle shadow ladder, and a "glass" top bar over hero art. | S, FE | ★. Polish, not function. |
| 4.1.6 | **A voice for success.** Every success banner gets one of five short, warm lines chosen by stage, not "Saved." ("Booked. Seven nights to look forward to.") with the tone setting from calm mode honoured (quiet and neutral there). | S, FE | ★★. Copy only plus a tiny picker. |
| 4.1.7 | **A trip colour.** The guest chooses one accent (teal, coral, gold, plum, sea-green) at onboarding or in Settings. It tints the hero art, the avatar dots in the party (the app already assigns traveller colours) and the share cards. | S, FE | ★. Personal ownership; the contrast test must pass for each. |

### 4.2 Stanley as the app's guide

| # | Idea | Size |
|---|---|---|
| 4.2.1 | **Sixteen poses** (see section 14.2) as small WebP images, used in empty states, success moments, error states and loading. | M, ART, FE |
| 4.2.2 | **"Ask Stanley about this"** chip at the foot of any page that opens his dialog pre-filled with the page and the trip context (the server already loads trip facts without personal data). The question starts as a sentence the guest can edit. | S, FE (SV exists) |
| 4.2.3 | **Stanley notes.** A dismissible one-line tip on a page, written in his voice, from the stage and the party ("On the day you board, almost everyone forgets the swimsuit in the checked bag."). Max one per page, never in calm mode. The existing `TipCard` is the host. | S, FE |
| 4.2.4 | **Stanley daily.** A single morning line on Home at Sea and Port: weather, one idea, one thing not to miss. Spoken aloud on request via the briefing's existing read-aloud. | S, FE |

### 4.3 A shared "moment" component

One `Moment` component (stamp lands, Stanley pose, one line, and a link to add it to the trip diary), fired by the server's journey events or the client's own actions. Candidate moments, with their stage: booking confirmed (Book), documents all ready (Manage), check-in done (Get to the ship), boarding pass shown (Get to the ship), medallion switched on (Embark), muster done (Embark), first sail-away (Embark), each port stamped (Port), last night (Sea), off the ship (Disembark), back home (Remember). Each one also writes a line to a **Trip diary** (new, section 4.6), which becomes the spine of the Remember stage. Size M, FE (events) plus S SV (diary sync). ★★★.

### 4.4 Tabs that show live values, and tabs that know the party

- **Live tiles (L, FE).** `ScreenList` gets an optional live value per screen: `Dining Reservations — Tonight 7:30 pm, Soleil Dining`; `Packing List — 14 of 40`; `Documents — 1 passport expires soon`; `Restaurants and Bars — 6 open now`. Each screen already loads this data for its own page. A small per-screen "summary" function, loaded lazily with the tab, gives tiles a pulse. ★★★.
- **Party-aware order and pins (M, FE).** The party (ages, needs, occasion, mobility) reorders the tab list and promotes three "for you" tiles at the top. A family with young children sees Kids' Clubs, Find My Family and Teen Agreement first; a guest with a mobility profile sees Step-free routes, Special Assistance and the muster accessible route first. A "pin" lets the guest override. ★★★.
- **A shortcut bar on Home (S, FE).** A horizontal row of up to five chips the guest chooses (default: the stage's best five). The recent-screens card (R2) already exists; this is the deliberate version.
- **Search that answers (M, FE).** The existing ship search and global search find screens. Add answer cards: typing "wifi" shows the price and a Buy button; "dinner" shows tonight's reservation; "late" shows I'm Delayed. Size M. ★★.

### 4.5 Using the phone better (within the PWA limits)

| # | Idea | Size | Caveat |
|---|---|---|---|
| 4.5.1 | **Haptic ticks** (`navigator.vibrate`) on a tick, a success moment and the all-aboard warnings, off in calm mode and with the "visual and vibration alerts" setting. | S, FE | Android only; iOS Safari does not vibrate. |
| 4.5.2 | **Web Share** with a file for cards (postcard, ticket stub, day poster, certificate) so a guest shares an image directly, not "save then attach". | S, FE | Already have the image export; this adds the share sheet. |
| 4.5.3 | **Camera to capture** a luggage tag number, a cabin number at the door, a receipt, a lost item or a sign. Photo stays on the device unless the guest attaches it to a case. | M, FE/SV | Uses the existing media seam (approved, then shown). |
| 4.5.4 | **Wake lock** while the boarding pass, the muster card or the leave-by countdown is open so the screen does not sleep. | S, FE | `navigator.wakeLock`, supported on current browsers. |
| 4.5.5 | **Screen-brightness hint** on the pass and the QR cards ("turn your brightness up"), plus a high-contrast white card. A brightness view already exists on the pass; extend it to the check-in QR and the Wi-Fi QR. | S, FE | A web page cannot set brightness. |
| 4.5.6 | **Install nudge** after the first booking confirmation ("Add to your home screen so the pass works with no signal"), with the per-platform steps. | S, FE | Needs the `beforeinstallprompt` event on Android, instructions on iOS. |

### 4.6 A Trip diary (new, cross-stage)

A running, private, dated timeline of the trip made from what happens: booked, documents ready, checked in, boarded, each meal reserved or eaten (from the plan), each port, steps walked, photos taken in the app, notes the guest adds, moments. It starts the day of booking, not the day of boarding. Today the memory book is assembled at the end from notes, favourites, stubs and the map. The diary is the same content, built as it happens, searchable, and exportable as the memory book, the "Wrapped" cards and the family update. This is the single feature that links Book to Remember. Size L, FE plus SV (a `TripDiary` table or a part of the synced memory document, text only). ★★★.

### 4.7 The "help me with this" panel

A bottom-sheet on every screen (not a new page) with four buttons: *Read this to me* (exists as S49), *Explain this in plain words* (the plain-English summary, H23), *Ask Stanley about this* (4.2.2), *Call or chat with a person* (Guest Services number from the contact screen). Today these are four different places; the panel makes every page a place a worried guest can recover from. Size M, FE. ★★★.

## 5. The ten bets I would make first

Ranked by guest value over effort, with a lean towards things that join up what the app already knows.

| # | Bet | Where | Size | Why |
|---|---|---|---|---|
| 1 | **Live tiles and party-aware tab order** (4.4) | All stages | L | Turns the text menus into a dashboard and removes the "where is it?" problem. |
| 2 | **Hero art, port palettes, icons** (4.1.1 to 4.1.3) | All stages | M to L | The app stops looking like a form. |
| 3 | **Moments and Trip diary** (4.3, 4.6) | Book to Remember | L | Gives the journey a shape and feeds the memory book without effort. |
| 4 | **Boarding Day "Today" strip** (see Get to the ship, N-G1) | Get to the ship, Embark | M | The most stressful day gets one plan with the time, the walk, the bags, the queue and the next step. |
| 5 | **Price calendar and "which date" helper** (see Dream, N-D1) | Dream, Discover | M | With eight same-route sailings, date is the only real choice, and it is not visualised. |
| 6 | **Wallet-style "Today" card for Sea and Port** (see Sea, N-S1) | Sea, Port | M | A single card of what is next, where, how far and how long, pinned to the top of Home. |
| 7 | **"What happened to this" status on every request** (3.5) | Manage to Disembark | M | Allergy, assistance, laundry, requests, lost items and complaints all gain closure. |
| 8 | **Stanley poses and "Ask Stanley about this"** (4.2) | All stages | M | Warmth and a safety net on every page. |
| 9 | **Group Plan board** (see Prebook, N-P1) | Manage, Prebook, Sea | L | A shared plan with votes and who is where makes the group features real, not per-phone. |
| 10 | **Memory book from the diary, with real photos** (4.6, Remember N-R1) | Remember | L | The end of the journey becomes the reason to book the next one. |

A bigger point of view on order: **1 and 2 first** (they change how every other idea lands), then **3 and 4** (the journey), then the rest as the party's needs suggest.


## 6. Stage by stage

Each stage starts with a short read of what it is for and where it falls short, then new pages for the stage, then every page the stage uses, in tab order.

---

## Stage 1: Dream

**What it is for.** Turn a vague wish into "yes, this one". The guest has no account and no commitment. Tabs: Explore, Ask. Home tiles: quiz, "is this for me", dates, concierge, group poll, saved.

**Where it falls short.**
- Dream is a brochure with a quiz. It has almost nothing to *look at*, and no sense of the place.
- The quiz is called "Find My Cruise", but there is one cruise, so it picks a room type and a package. The honest job is "find my room and my date".
- Date is the only real choice among eight sailings and is shown as eight cards.
- Three of the six tiles ask the guest to *think* (quiz, is-this-for-me, concierge). Only one invites them to *feel* something.

### New pages for this stage

| ID | Page | What it is | Size / value |
|---|---|---|---|
| **N-D1** | **Date and Price Calendar** | A month grid or timeline of the eight sailings. Each date shows the from-price as a bar, holiday and school-break tags, hurricane-season shading, "cheapest", "quietest", "best value" badges and how many weeks away. Pick two to compare. The data is the offers feed the sailings page already loads. | M, FE, ★★★ |
| **N-D2** | **Your First Cruise, Step by Step** | A Stanley-led, one-screen-per-step story: getting there, boarding, your room, dinner, a sea day, a port day, leaving. Each step has a flat illustration, 40 words and a "what to do" tip. It answers "what is it actually like?" and leads into the trial day. | M, ART, FE, ★★★ |
| **N-D3** | **Compare with My Last Holiday** | The guest types what they spent on their last holiday (people, nights, total). The page shows this cruise, all-in, per person per day, side by side, with what each includes. Replaces the single authored land-holiday range ($180 to $320 a day) with the guest's own number. | S, FE, ★★ |
| **N-D4** | **When Should I Go?** | A chart by month of temperature, rain days, crowd level and price for the route, with the eight sailings marked. It answers "best time" with evidence, and sends the guest to the calendar. | M, PR (weather), FE, ★★ |

### Pages

**H02 Find My Cruise** (quiz)
- *Today:* five question groups on one form (vibe, budget, who with, mobility, musts) plus six mood tiles; returns up to three room categories with reasons and a package suggestion, with a link to book or ask an advisor.
- **Improve:** one question per screen with a progress dot row and Stanley asking it (a form with 20 radio buttons is hard on a phone). Rename to "Find My Room" or make it also choose a *date* (budget picks the cheap weeks, "with kids" picks school breaks, "quiet" picks shoulder season). End with **"Use these answers"**, which pre-fills the cabin chooser, the trip-cost page and the booking room step so the guest never repeats themselves. *M, FE, ★★★.*
- **New:** **"Why not the others?"** under the result: one sentence for each room type not picked ("Interior suits you on budget but you said you like to be outside"). Builds trust and shows the quiz thought about it. *S, FE, ★★.*

**H13 Is This Cruise for Me?** (Decide)
- *Today:* who it suits and does not, a tick-what's-true list, "real worries" with answers, a budget helper, a coin flip, read-aloud, email summary, nickname and "remind me in a week".
- **Improve:** a plain **fit read** after the ticks: "Good fit", "Mixed" or "Probably not", with the two reasons that drove it and a link to the proof for each worry (seasickness links to the cabin motion scores and the sea-sickness page; "will I be bored" to the day shapes). No number, no score. *M, FE, ★★★.*
- **New:** **Worry report-back.** The worries the guest ticked are kept. At Remember the app asks "You worried about X. Was it true?" with one tap each. The answers are private to the guest, and (with consent, aggregated) tell the cruise line which Dream worries are real. Closes a loop no other page does. *M, FE+SV, ★★★.*

**H07 Sailing Dates**
- *Today:* eight cards (range, holiday tag, lowest tag, wants matched, from-price, book and save).
- **Improve:** a **list / calendar toggle**, a sort (soonest, cheapest, holiday), a filter (can still book, weeks away), and a tiny **price trend** on each card from the fare points the price watch already keeps. *M, FE, ★★★.*
- **New:** N-D1 above, opened from a "See on a calendar" button at the top.

**H04 Ask the Concierge**
- *Today:* an AI chat limited to this app's data; says it is AI and cannot book; saves the conversation on this device; can hand off to an advisor.
- **Improve:** answers should be *cards*, not paragraphs: a price answer shows the price block with its "Book" button; a port answer shows the port card; each answer names the screen it came from. Add suggested follow-up chips after each answer. *M, FE, ★★★.*
- **New:** **Merge with Stanley** (theme 3.10). H04 becomes "Ask Stanley (before you book)". The screen keeps the pre-booking data scope and gains his name, face and poses. *L, FE+SV, ★★★.*

**P49 Group Poll and Dream Board**
- *Today:* shared by the booking; one vote each; hearts; the leader is shown; up to six polls.
- **Improve:** a **deadline** and a **"decided" lock** ("We're going with the 14 March sailing") that writes the choice to the plan and tells everyone. A **quiet voting** option (votes hidden until all are in or the deadline) removes the pressure to follow the loudest. *M, FE+SV, ★★★.*
- **New:** **Date finder.** Each person ticks the sailings they can do; the page shows the dates everyone can make, then the cheapest of those. It is the one thing a group actually needs from a poll, and the sailings are a fixed list so it is easy. *M, FE+SV, ★★★.*

**H11 Saved Sailings**
- *Today:* a plain list of saved sailings, ports and the ship, with remove; a trip nickname; "remind me in a week".
- **Improve:** a **compare** view for two or three saved sailings side by side (dates, from-price, holiday, wanted places matched, cabin picks), plus a short note on each saved item ("Mum's birthday week"). Show **"price changed since you saved it"** on a card. *M, FE, ★★★.*
- **New:** **Dream countdown.** A saved sailing shows "If you book by Friday, 147 days to go" on Home as a soft, optional widget. Off in calm mode. *S, FE, ★.*

**H06 7-Night Western Caribbean with Mexico** (the cruise)
- *Today:* ship, nights, port, route map, day by day, regret cards, best time to go, link to dates.
- **Improve:** present the day by day as a **swipeable story** with a flat illustration per day (sea, Cozumel, Belize, Roatán, sea, sea) and "hours in port" on each. The route map gets a ship line that draws in, once, on first view. *M, ART, FE, ★★.*
- **New:** link to **N-D4 When Should I Go?** and N-D2 as the next two steps.

**H08 Sailing Details**
- *Today:* price estimate by room and guests, day strip, itinerary, on-that-date map, links to cabin choice, trip cost and "is it for me".
- **Improve:** a **sticky price bar** at the bottom ("from $X a person · Book") so the main action is always there on a long page, and a plain line, "What is the same on every date: route, ship, ports. What changes: price." *S, FE, ★★.*
- **New:** **"Hold the dates in my calendar"** that writes a tentative calendar entry for this sailing (the calendar writer already supports tentative holds, used on the memories screen). The guest sees the week against their own diary before they commit. *S, FE, ★★.*

**H09 Port Details**
- *Today:* tender or dock, which day, getting ashore, best time, things to do, sample tours with price and hours.
- **Improve:** a **time-ashore timeline** (ship arrives, off the ship, all aboard) so "how long do I really have?" is one picture, minus the tender queue. Add **best-for tags** (beach, ruins, snorkel, shopping, kids, step-free) with a filter. *M, FE, ★★★.*
- **New:** **Port in 60 seconds**: a short, auto-advancing set of four cards (what you'll see, what it costs, how hard it is, one tip) with the port's palette. Uses 4.1.2. *M, ART, FE, ★★.*

**P04 Occasion Starter**
- *Today:* start a plan from an occasion (honeymoon, birthday, remembrance) with fitting wording and suggestions.
- **Improve:** each occasion becomes a **bundle** the guest can accept in one tap: the celebration note to the ship (the celebrations endpoint exists), a dinner hold, a photo package, a cabin gift idea, a quiet day. Today it suggests; make it do. *M, FE+SV, ★★★.*
- **New:** **Surprise mode.** Mark a part of the plan as a surprise for one traveller; their view hides it and shows "something is planned". Pairs with the existing D6-8 celebration messages. *M, FE+SV, ★★.*

**X02 A Day on This Ship** (trial day, no sign-in)
- *Today:* pick a day, tours and what you enjoy; returns a plan from the ship's programme.
- **Improve:** after the plan, show **what that day would cost** (with the package, without) and a "Book this exact day" button that carries the result into the booking and, on sign-up, into the Plan screen. Today the plan is a dead end. *M, FE, ★★★.*
- **New:** **Day playback**: a 20-second animated timeline of the plan (sun arcs across, events light up in order, the all-aboard bell near the end). Reduced-motion shows the static timeline. *M, ART, FE, ★★.*

**H03 Talk to a Travel Advisor**
- *Today:* pick an advisor by speciality and language, chat or call-back, see past conversations.
- **Improve:** show **when each advisor is free** and offer a call-back time picker in the guest's own time zone (the contact screen shows Eastern only). Attach the quiz result, saved sailings and group poll winner as "what I have in mind" automatically. *M, FE+SV, ★★★.*
- **New:** **Advisor prep card.** A one-page brief for the call: "Three things to ask", the guest's own answers and budget, and space for notes, printable or copyable. *S, FE, ★★.*

**P21 Paste a Plan**
- *Today:* bring in a plan made elsewhere (an AI assistant) and turn it into an editable draft.
- **Improve:** list what *could not* be matched, with a reason and the nearest alternative ("'Sunset at the rooftop bar': this ship has no rooftop bar. Closest: Sun Terrace"). Today the guest has to find the gaps. *M, FE, ★★.*
- **New:** **Copy a prompt for my assistant.** One button copies a ready-made prompt that includes the sailing, the ports, the guest's party and constraints and the format the paste screen understands, so the round trip to any AI assistant works without the guest writing the prompt. *S, FE, ★★★.*

**P50 Links for Someone at Home or Your Advisor**
- *Today:* read-only links with a "what they see / never see" list; the guest sees every link and can switch one off.
- **Improve:** a **preview as the recipient** before a link is created, plus a QR code for showing it to someone beside you. *S, FE, ★★.*
- **New:** **Reactions and replies.** The person with the link can send a heart or a short comment; the guest sees them as a small inbox ("Mum hearted your Day 3 plan"). The shared-trip page (X04) already allows comments, so this is the return path. *M, FE+SV, ★★.*

**H10 Your Ship** *(also in Discover and Book)*
- *Today:* class, size, decks, on-board lists, stateroom types, accessibility at a glance, other ships.
- **Improve:** a **deck-by-deck tour** with an illustration of each deck and what lives there, in place of lists. *M, ART, FE, ★★★.*
- **New:** **"What's included vs extra"** as a plain table for this ship (dining rooms, entertainment, kids' clubs, specialty dining, Wi-Fi, drinks). Answers the most-asked pre-booking question in one place and links to the cost page. *S, FE, ★★★.*

**Me tab in Dream** (Saved Sailings, settings and help): see section 7.

---

## Stage 2: Discover

**What it is for.** The guest has a sailing in mind. They want the real cost, the right room, and a reason to book now or not. Tabs: Sailing, Cabin, Cost.

**Where it falls short.**
- The cabin chooser scores sleep, motion and noise, and the cost page adds up extras. Both are good. They sit on different pages and the guest has to carry numbers between them.
- No view of the actual room. Guest photos are built (`CabinPhotos`) but only appear when someone uploads one.
- The Cost tab has five screens that all answer "is this a good price?" without a verdict on one page.

### New pages for this stage

| ID | Page | What it is | Size / value |
|---|---|---|---|
| **N-V1** | **My Shortlist Summary** | A single page that combines the chosen sailing, room, fare, cost estimate and "is it for me" read into one printable, shareable "case for this trip". Today the pieces live on four pages, and the decide screen's email summary is only for the Decide step. | M, FE, ★★★ |
| **N-V2** | **Cabin Views Gallery** | For each room category, a flat illustration or photo gallery of the room, bathroom, balcony and the view from that deck, plus guest photos from the real cabins that have them. | M, ART, FE+SV, ★★★ |
| **N-V3** | **Where Does My Money Go?** | A simple stacked bar of the trip price (fare, taxes and port fees, gratuities, what is included) with what each piece pays for, in plain words. Builds on the existing price breakdown. | S, FE, ★★ |

### Pages

**H08 Sailing Details, H07 Sailing Dates, H09 Port Details, H06 Cruise, H10 Ship, H13 Decide:** as in Dream; in Discover, the sailing page should lead with the *cost and cabin* actions rather than the story.

**S01 Deck Map, S02 Restaurants and Bars, S03 Venue Details** (as a preview before boarding)
- *Today:* the same screens as on board, shown without live data.
- **Improve:** a pre-boarding **"first 24 hours" overlay** on the map: pins for where you board, your muster station class, the buffet, the pool, the spa. At Discover, a short guided tour path. Avoid "Open now" labels (meaningless before sailing) and show typical hours. *M, FE, ★★.*
- **New:** **"Walk to dinner"**: choose a deck and a restaurant and see the walk in minutes and steps, with lifts. The cabin walk logic exists on the Plan day cards; this makes it a Discover-time tool for choosing a deck. *M, FE, ★★.*

**H14 Choose Your Cabin**
- *Today:* sleep/motion/noise scores out of 5 with reasons, sun by day, walking minutes to key places, the rooms above and below, regret cards, filters, share card, "pick up where you left off", guest photos.
- **Improve:** **"Tell me which one"**: three questions (do you sleep badly? hate motion? want a balcony?) pick the single best match and explain it, with the table below it for people who want to compare. Many guests will not read ten scored cards. *S, FE, ★★.* Also add a **deck-position strip** (a side-on ship outline with the cabin's spot highlighted) next to each card so "midship and low" is seen, not read. *M, ART, FE, ★★★.*
- **New:** **Neighbours check**: show what is directly above, below and next door (a lounge, a laundry, a lift) as an icon row with a plain "quiet / some noise" tag. Partly in the existing noise note; make it the first thing on the card. *S, FE, ★★.*

**P19 Guaranteed-Cabin Odds**
- *Today:* what you are likely to get with a guarantee fare and whether the saving is worth it.
- **Improve:** a **visual odds bar** (what share of past guarantee guests got which deck zone) and a worst-case card ("You could be near the show lounge or the engines"). *S, FE, ★★.*
- **New:** **"What I would do"**: two inputs (how much you'd pay to choose, how much motion or noise bothers you) and a one-line recommendation. *S, FE, ★.*

**H12 What the Whole Trip Costs**
- *Today:* toggle lines (drinks, Wi-Fi, specialty dinners, excursions, flights, tips) to see an all-in total, with a package check.
- **Improve:** a **per person per day** line at the top and a **sensible defaults button** ("People like you usually spend…") that fills the toggles from the quiz and party. A visual **bar** of the total split by category. Share it as a card. *M, FE, ★★★.*
- **New:** **Budget guard-rails**: set a ceiling and a target; the page shows which lines to drop to get under it, in order of least regret. *M, FE, ★★★.*

**H15 Offers for Your Trip**
- *Today:* offers after required tasks, with "why am I seeing this", "not for this trip" to hide, paused during a complaint.
- **Improve:** a **comparison of two offers** ("5% off now" vs "$100 credit") in plain money for the guest's own party. Today the guest has to do the sum. *M, FE, ★★★.*
- **New:** **"Stack or choose"** helper that states which offers combine and which exclude each other, with the best combination for this booking highlighted. *M, FE+SV, ★★.*

**P17 Price-Drop Watch**
- *Today:* the guest asks to be told if the price falls and stops with one tap.
- **Improve:** show the **price history line** and **how far from the lowest** ever seen for this sailing, and let the guest set a target price. Offer a calendar / push alert option on the screen itself. *M, FE+SV, ★★★.*
- **New:** **"If it drops, what then?"** A pre-written next step ("Rebook at the lower price: no fee until final payment; here are the steps") so a drop is something to act on, not just see. *S, FE, ★★.*

**P18 Is This Fare Fair?**
- *Today:* compares the fare to what is typical for the sailing and gives a plain verdict.
- **Improve:** a **range bar** (low / typical / high) with the guest's price marked, and a sentence on *why* the price is where it is (holiday week, last cabins, early-booking). *S, FE, ★★.*
- **New:** **"Is it worth waiting?"** An honest read based on past drop patterns ("prices fell 8% on average in the 6 weeks before final payment") with the caveat that it is not a guarantee. *M, SV (data), ★★.*

**H16 Book Your Cruise**
- *Today:* room type and guests to see the all-in price and start the booking.
- **Improve:** carry over the quiz, cabin picks and cost toggles automatically. Show a **"your trip so far" ribbon** (sailing · room · guests · est. total). *M, FE, ★★★.*
- **New:** **"Book later, hold now"**: link to the 48-hour hold (P20) from here, with the honest countdown, as a visible alternative to "Book". *S, FE, ★★.*

**H03 Talk to a Travel Advisor, H04 Ask the Concierge:** as in Dream. In Discover the advisor handoff should include the cabin picks and cost toggles.

---

## Stage 3: Book

**What it is for.** Get from "yes" to a confirmed booking without losing anything. Tabs: Booking, Travellers, Pay.

**Where it falls short.**
- The booking flow has a good stepper and saves each field, which is excellent. But it is **long** and feels like paperwork: sailing, room, fare, guests, dining, review, pay.
- Nothing during the steps reminds the guest *why* they are doing it (no running trip summary, no art, no encouragement).
- The booking steps are not screens in the registry, so the stage tabs do not describe them. I treat them here as part of H16/H17.

### New pages for this stage

| ID | Page | What it is | Size / value |
|---|---|---|---|
| **N-B1** | **Booking Summary Drawer** | A pull-up bottom sheet visible on every step: sailing, room, guests, price, deposit and balance, and the cancellation line. Same data as the review step, always one tap away. | M, FE, ★★★ |
| **N-B2** | **Who Can Pay for What?** | A small planner before payment: one payer, split between travellers, or a parent pays for a child. It leads to the split ledger and pay-your-share links in a guided way instead of finding them under Pay. | M, FE, ★★ |
| **N-B3** | **Before You Press Pay** | A plain, 6-line final check: names match passports, dates, room, total, deposit, cancellation rule. Each line has a "fix" link. The review step does this; a separate check at the pay step is the last, calm pause. | S, FE, ★★ |

### Pages

**H16 Book Your Cruise / H17 Your Booking** (the stepper)
- *Today:* sailing → room → fare → guests → dining → review → pay, saved after each field, resumable, email-a-link, start over.
- **Improve:** N-B1 above, plus **progress with time**: "About 6 minutes left" (from the steps still to do). Merge dining into the guests step on small screens. Let the lead guest **fill from "My details"** for themselves with one tap (they may already; confirm). *M, FE, ★★★.*
- **New:** **Stanley in the margin**: on each step, one line of context and an "ask me" chip ("What does 'guaranteed' mean?"). Tied to 4.2.3. *S, FE, ★★.*

**H18 Finish Your Booking**
- *Today:* resume a started booking exactly where it stopped.
- **Improve:** show **what's left** ("2 steps and a payment") and **how long the price is held** (the review step already says the hold time). *S, FE, ★★★.*
- **New:** **"Share my draft"**: a read-only link so a partner can review before pay. Pairs with P50. *M, FE+SV, ★★.*

**H20 Booking Confirmed**
- *Today:* confirmation number (grouped, spoken form, copy), booking details, calendar file, print, download.
- **Improve:** a **celebration moment** (4.3) and a **"what happens next" timeline** with the next five dates (documents due, final payment, check-in opens, boarding). Right now the next steps are not on the confirmation page. *M, FE, ★★★.*
- **New:** **Add to Wallet / email to my partner**: a one-tap "send this confirmation to a travel companion" (using the party, not a free-text address) and an install-to-home-screen prompt (4.5.6). *S, FE, ★★.*

**P13 Trip Contract**
- *Today:* the terms on one page, in plain words, large print, read-aloud.
- **Improve:** a **"the 6 things most people want to know"** summary at the top (cancel fee by date, change fee, what's refundable, health rules, travel insurance, liability), each linking to the clause. *M, FE, ★★★.*
- **New:** **"Marked-up" mode**: the guest highlights the clauses that matter to them and the app saves a personal one-pager. *S, FE, ★.*

**P22 What Happens If**
- *Today:* exact cost, in dollars and dates, of cancelling, changing, or missing the ship; payment schedule; calendar reminder.
- **Improve:** a **timeline graphic** (money you'd lose over time as steps) and **side-by-side scenarios** ("cancel now" vs "cancel after final payment"). *M, FE, ★★★.*
- **New:** **"Insurance check"**: ask whether the guest has trip insurance and what it covers; show which scenarios would be covered (with the caveat that it is general information, not advice). *M, FE, ★★.*

**P20 Hold a Cabin for 48 Hours**
- *Today:* hold one thing with an honest countdown shown only on that page.
- **Improve:** an **opt-in reminder** before the hold ends (push or calendar), since the countdown is deliberately only on the page. *S, FE+SV, ★★★.*
- **New:** **"Hold two, compare"**: keep two options (a balcony on one date, an ocean-view on another) and see them next to each other with the cost, so the hold ends in a choice. *M, FE, ★★.*

**P47 Your Travel Party**
- *Today:* who is going, ages, needs; everything else is built from this list.
- **Improve:** **roles and relationships** (partner, child, parent, friend), and **chips for needs** (wheelchair, allergy, hearing, anxious flyer) instead of a free-text field, feeding 4.4's party-aware tab order. *M, FE, ★★★.*
- **New:** **Travel-party card**: a printable one-pager listing everyone, ages, needs and the emergency contact. For a hotel, a taxi, a babysitter or the school. *S, FE, ★★.*

**M05 Traveller Details** *(also Manage)*
- *Today:* one traveller's name, documents and needs.
- **Improve:** **per-field confidence**: show "matches passport" (when the papers check ran), "needs expiry date", with a one-tap fix. *M, FE, ★★.*
- **New:** **"Autofill from a photo of a passport"** (camera, parse the MRZ on the device, never upload). The guest step says passport scan "is not available in this concept"; a client-side MRZ read is realistic. *L, FE, ★★★.*

**P09 Accessibility Profile**
- *Today:* tell us once; it follows you through check-in and on board.
- **Improve:** a **visible "what the ship will do" list** after saving ("A step-free cabin has been requested. Your muster station is accessible. Assistance at the terminal: requested") so the guest can see the profile *working*. *M, FE+SV, ★★★.*
- **New:** **Access card for crew**: a large-text card the guest shows to any crew member that says what help they need, in plain words, in English and Spanish. *S, FE, ★★★.*

**P10 Special Assistance**
- *Today:* make requests with lead-time deadlines that count down, status per request.
- **Improve:** the **"what happened to this"** status (3.5): requested → received → confirmed by the ship → done, with the name of the team and a time. *M, FE+SV, ★★★.*
- **New:** **Request templates** for the common ones (wheelchair at terminal, oxygen, extra time, sign-language interpreter) with the lead time shown before the guest types. *S, FE, ★★.*

**P11 Allergy Pre-Flag**
- *Today:* tell the galley before sailing; the request is followed from kitchen to table.
- **Improve:** show **acknowledgement** from the galley with a time, and include a **menu check** preview of this ship's dishes that contain the allergen. *M, FE+SV, ★★★.*
- **New:** **Allergy card** in plain language (English plus Spanish for the ports) for restaurants ashore. The port safety page and Allergy Confidence (S33) are the natural homes. *S, FE, ★★★.*

**P46 Several Cabins, One Day**
- *Today:* plan one day for a group in several rooms; everyone sees where to meet and when.
- **Improve:** show each **room's location** and the **meeting point on the deck map**, with walking time from each cabin. *M, FE, ★★.*
- **New:** **"Where's my cabin from yours?"** a mini-map between two cabin numbers ("Your cousin is 2 decks up and 4 lift-lobbies forward"). *M, FE, ★★.*

**H19 Pay Your Balance**
- *Today:* pay in full or just your own share; shows amount and date before confirm.
- **Improve:** **autopay opt-in** with a clear date ("We'll charge on 12 Jan; you can cancel until 10 Jan") and a **reminder 7 days before**. *M, FE+SV, ★★★.*
- **New:** **"Pay in instalments"** planner (equal monthly payments up to the final payment date) that shows each date and amount. This needs the payment provider seam (card charging is mocked). *L, SV+PR, ★★★.*

**P14 Money Plan**
- *Today:* deposit, final payment and what is left, by date.
- **Improve:** a **timeline graphic** with money paid, due and remaining, and a **single next-payment card on Home**. *S, FE, ★★★.*
- **New:** **"Savings goal"**: a monthly amount that gets the guest to the final payment, with a gentle progress bar ("You've set aside $1,200 of $3,900"). The app does not move money; the guest ticks. *M, FE, ★★.*

**P15 Split Costs / P16 Pay Your Share**
- *Today:* families, shared costs, fair settle-up; pay a share from a link with no account.
- **Improve:** after a pay, the payer gets a **receipt** and the organiser sees a **live "who has paid"** list (names, not amounts, by default). *M, FE+SV, ★★★.*
- **New:** **"Chase kindly"**: a one-tap polite reminder text to those who haven't paid, with the amount and the link, in three tones (friendly, neutral, firm). It copies; it never sends. *S, FE, ★★★.*

**M07 Payments** *(also Manage, Prebook)*
- *Today:* cards, payments made and due, add or change card.
- **Improve:** **expiry warnings** on a card that will expire before final payment and **which card is used for what** (deposit, balance, on-board account). *S, FE, ★★★.*
- **New:** **Receipts folder**: all receipts by year in one place with a "send to accountant" export. *M, FE, ★.*

**M02 My Trips** *(Me tab)*
- *Today:* all bookings with the next step for each.
- **Improve:** a **timeline view** (past and future trips on a line). *S, FE, ★.*
- **New:** **"Link a trip by photo"**: scan the confirmation email or QR to link a travel-agent booking. *M, FE, ★★.*

---

## Stage 4: Manage

**What it is for.** The booking is confirmed; there are weeks or months to sailing. The job is to get everything *ready*: documents, money, needs, group. Tabs: Trip, Needs, Group.

**Where it falls short.**
- The Trip tab lists 15 screens. Nothing says which three matter *this week*. The Readiness ring and Home's "What matters now" help, but the Trip tab is still a flat list.
- Readiness is by traveller (good), but there is no **countdown plan**: a weekly rhythm of what to do at 12, 8, 4, 2 weeks, 1 week, 3 days.
- The group tab has nine screens but the group does not yet feel like a team.

### New pages for this stage

| ID | Page | What it is | Size / value |
|---|---|---|---|
| **N-M1** | **The Countdown Plan** | A time-shaped plan from booking to sailing: "12 weeks: passports. 8 weeks: excursions open. 4 weeks: online check-in opens. 1 week: pack. 3 days: leave-by time." Each node expands into the app's existing screens. The checklist (P01) is a tick list; this is a map with dates, and shows at a glance whether the guest is ahead or behind. | M, FE, ★★★ |
| **N-M2** | **Group Readiness Board** | One page for the organiser: every traveller's readiness ring, what each still needs, and a **"nudge"** that opens a pre-written message for that person. | M, FE+SV, ★★★ |
| **N-M3** | **Insurance and Cover** | A short guide (what trip insurance usually covers, what the cruise line's cover is, what to check), a place to record a policy number and phone number, and a link into What Happens If. | S, FE, ★★ |
| **N-M4** | **Trip Info Pack** | Auto-assembled one-pager or PDF per traveller: dates, terminal, check-in dates, contacts, documents list, emergency details. For printing, an airline, a hotel, or a relative. Extends the print screen. | M, FE, ★★ |

### Pages

**M02 My Trips / M03 Trip Details**
- *Today:* list of bookings with next step; one booking with payments, documents and changes.
- **Improve:** M03 opens with a **"status in 5 lines"** card (paid / documents / check-in opens / ready score / next step). Today it jumps to long lists. *S, FE, ★★★.*
- **New:** N-M4 is linked from here.

**H21 Changes to Your Trip**
- *Today:* what changed, what it means, the options; items needing a decision first.
- **Improve:** a **"before / after"** compare for each change (old time, new time; old terminal, new terminal) with a coloured marker, and an **acknowledge** button so the guest can say "I've seen this". *M, FE, ★★★.*
- **New:** **Change digest**: when there are several changes, one summary ("3 changes: 1 needs you") in the notifications, and an "add all to my calendar" button. *S, FE, ★★.*

**H23 Plain-English Summaries**
- *Today:* short / plain / step-by-step summary of the booking, a policy or a change; made on the device; original beside it.
- **Improve:** a **"read to me"** (the briefing already reads aloud) and **translate to Spanish** for the summary (the app has `es`). *S, FE, ★★.*
- **New:** **Summaries for someone else**: "Explain this to my mother in two sentences" with a copy button. *S, FE, ★★.*

**H05 Ask Your Cruise**
- *Today:* questions about the guest's own booking with sources; can change the plan but only after confirm; speak-to-fill.
- **Improve:** merge into Stanley (3.10); in the meantime show **"as of" time** on every answer and the source screen as a link. *M, FE, ★★★.*
- **New:** **"Ask the group"** shortcut: a question the AI can't answer ("who is bringing the cards?") becomes a poll or a chat message in one tap. *S, FE, ★★.*

**P01 Pre-Cruise Checklist**
- *Today:* due-dated items in order; the app ticks what it can see; reminders per notification settings.
- **Improve:** group by **time window** (now / this month / later) with the N-M1 map, and show a **"minutes needed"** on each item so a guest with 10 minutes picks one. *M, FE, ★★★.*
- **New:** **Add my own item** with a due date and reminder, and **assign to a person** in the party. *M, FE+SV, ★★★.*

**P13, P14, P15, P16, P17, P18, M07, M09, M14:** see Book (money) and Remember (rewards).

**M06 Documents**
- *Today:* what each traveller needs, what is held, expiry dates; warns in good time; countries on the cruise; papers check.
- **Improve:** a **"valid until" bar** per passport against the return date plus six months, red when it fails. Offer the **"renewal takes N weeks"** hint for the guest's nationality. *M, FE, ★★★.*
- **New:** **Document photo vault (on-device)**: the guest keeps a photo of each document on the device only (not the server), available offline at the terminal. Encrypted at rest via the browser; never uploaded. The app already says it keeps no numbers or copies, so this is explicitly *opt-in and local*. *L, FE, ★★★.*

**P12 Readiness for Each Traveller**
- *Today:* documents, payments and forms per traveller with one ring.
- **Improve:** a **"fix it" button per gap** that opens the exact screen (already partially); add **"who is blocking"** on the organiser view. *S, FE, ★★★.*
- **New:** N-M2 above.

**P08 Medical Card / P07 Health and Comfort**
- *Today:* write conditions and medication on one page for the ship doctor; stays on the device; clear it. Health checklist for medication and comfort.
- **Improve:** a **medication timeline** across time zones ("take at 8:00 home time = 7:00 ship time"). The ship moves one hour back at Belize, and many guests mis-dose. *M, FE, ★★★.*
- **New:** **Pharmacy plan**: how many days of medication to bring (trip length plus a buffer plus one delay day), what to carry in hand luggage, and what the ship does and doesn't stock. *M, FE, ★★★.*

**H38 Port Entry Rules**
- *Today:* entry, visa and customs rules per port; the passport expiry check by stop; the currency card.
- **Improve:** **"Am I OK for all four?" traffic light** per traveller across all ports (one tap to see failing ports). *M, FE, ★★★.*
- **New:** **Official links with last-checked dates**: each rule shows the official government link and the date the app last confirmed the rule. *S, FE+SV, ★★.*

**C01 Party Chat and Guest Services**
- *Today:* group chat and Guest Services chat; messages free; report and hide; photos for older ages.
- **Improve:** **pinned message** for the group (meeting time, deck, WhatsApp number) and **read receipts** by name. *M, FE+SV, ★★★.*
- **New:** **Chat plan cards**: send "meet at the Piazza at 7 pm" as a card with an "add to my plan" button. Replaces a lot of text coordination. *M, FE+SV, ★★★.*

**P48 Family at Home / P50 Share links / X03 Following the Trip / X04 A Trip Shared with You**
- *Today:* read-only follow page showing where the ship is and a note from the guest.
- **Improve:** a **"daily postcard"** the guest can send to people at home (a photo and a line), shown on the follow page as a feed. *M, FE+SV, ★★★.*
- **New:** **"Safe-arrival" pings**: the follower sees a gentle "boarded", "at sea", "in port", "home", driven by the journey events. They never see the location of the guest, only the ship. *S, FE, ★★★.*

**P43 Organiser and Privacy**
- *Today:* choose who can see and change the plans.
- **Improve:** **role presets** (organiser, planner, viewer, child) with one-line summaries of what each can do, rather than switches. *S, FE, ★★.*
- **New:** **"Hand over organiser"** to another adult (for when the organiser can't travel) with consent from both. *M, FE+SV, ★★.*

**P51 Trip Story for a Child / P52 Child Brief**
- *Today:* a short story about what's coming; a one-page brief for the kids' club.
- **Improve:** make the story **personal**: the child's name and age, the cruise's real ports, and a **picture per page**. *M, ART, FE, ★★★.*
- **New:** **Countdown calendar for the child**: a paper-chain style daily "sleeps to go" with a small task or fact each day, printable. *M, ART, FE, ★★★.*

**M14 Family Helper**
- *Today:* let a trusted person help with the booking; explicit permissions; stop any time.
- **Improve:** show the helper's **recent actions** in plain words and a **"what they can do" test** ("They can pay but not cancel"). *S, FE, ★★.*
- **New:** **Guest Services-by-phone card** (exists in the copy) as a printable card to hand to the helper. *S, FE, ★.*

**M09 Captain's Circle and Rewards** *(Me)*
- see Remember.



---

## Stage 5: Prebook

**What it is for.** Shape the days before sailing: tours, dinners, shows, packages, packing. Tabs: Plan, Prepare, Group. This is the stage with the most *tools* in the app (Autopilot, week planner, slot watch, rest blocks, taste, rhythm).

**Where it falls short.**
- The Plan tab lists 22 screens. Excursions, dining, shows, spa and clubs are separate places. They end up in one plan, but the guest builds them in five places and sees the whole only on the Plan screen. There is no single canvas.
- The tools disagree on names: Build My Day, Autopilot Day, My Daily Rhythm, Build my week. A guest cannot tell which to use.
- Group planning is done *by* the guest, not *with* the group. Each person's day is their own.
- Money is spread across Packages, Prepay, Basket, Excursion cart, Upgrades. There is no running "what I will spend on board" total.

### New pages for this stage

| ID | Page | What it is | Size / value |
|---|---|---|---|
| **N-P1** | **Group Plan Board** | One shared week for the whole booking: each day a column, each person a colour. Items show who is doing them ("Ana, Ben, Cy: Snorkel, 9:30"), with a **Join** button for others. Clashes are flagged per person. The data already exists in the plan, the party colours and the organiser privacy settings. | L, FE+SV, ★★★ |
| **N-P2** | **On-Board Spend Forecast** | A running total of everything bought or planned before sailing (packages, excursions, dining, prepay, upgrades, gifts) set against the budget from Dream and the estimate from Trip Cost. A bar by category, with "left to spend" and a gentle warning. | M, FE, ★★★ |
| **N-P3** | **Excursion Fit Finder** | Three questions (how active, how much to spend, who is going) rank the port's tours with a reason each ("Easy, 3 hours, back by 2:30, step-free"). Uses the difficulty, price and time data each tour already has. | M, FE, ★★★ |
| **N-P4** | **Outfit Planner** | Maps the dress nights (elegant on nights 2 and 7, smart casual otherwise) to a simple outfit slot per night and ties it to the packing list. | S, FE, ★★ |
| **N-P5** | **One-Page Plan** | A single printable sheet: the week, the bookings, the ports and the all-aboard times. Extends the existing week poster (D4-8) with the group and the money. | S, FE, ★★ |

### Pages

**P37 My Excursions**
- *Today:* shore trips per port with honest difficulty, duration and all-aboard time; tours that do not fit the day are not offered; excursion credit; a cart with a pay step; guest picker.
- **Improve:** **filters and a compare**: difficulty, step-free, price, duration, kid-friendly, indoors/outdoors; compare two tours side by side. A **"fits your day"** badge on each card using the all-aboard buffer the app already computes. *M, FE, ★★★.*
- **New:** N-P3 above, and **short, moderated guest tips per tour** ("Bring water shoes", "Sit on the left of the bus"), authored first, collected later. *M, FE+SV, ★★.*

**P38 Dining Reservations**
- *Today:* specialty restaurant reservations (open once paid in full, or for loyalty tiers); main dinner info; reservations; slot watch.
- **Improve:** a **night-by-night grid** (7 nights by 3 seatings) showing free and taken slots and clashes with shows already booked, so a guest can see "Thursday is free" at a glance. Tag each restaurant **cost and dress** and **who in the party can eat there** (using allergies). *M, FE, ★★★.*
- **New:** **Dining plan builder**: "I want three specialty nights and one quiet night" proposes a set across the week and books with one confirm. *M, FE, ★★.*

**M08 Packages** *(also Embark, Sea, Me)*
- *Today:* what the fare includes for each guest, credits, packages to buy, worth-it check.
- **Improve:** a **break-even slider** ("You'd need 5 drinks a day for this to pay off. Most guests like you have 3.") and the same advice per traveller (an adult who does not drink should not be asked about a drinks package). *M, FE, ★★★.*
- **New:** **"Was it worth it?"** report in the last days: the drinks tracker and Wi-Fi use compared with what the package cost. Feeds the next booking's advice. *M, FE, ★★.*

**P02 Packing List**
- *Today:* a list built from ports, season, dress codes and booked excursions; ticks shared on the booking (with who ticked); weather; share, print.
- **Improve:** **by person and by bag** (checked, carry-on, day bag), and a "**carry-on for day one**" block (swimsuit, medication, charger, documents, a change of clothes). *M, FE, ★★★.*
- **New:** **"Buy it on board instead"**: next to each non-essential item, the price in the ship shop, so a guest can skip packing sunscreen or an adaptor. Also a **"copy last trip's list"** button. *M, FE, ★★.*

**P03 Packing for This Ship**
- *Today:* allowed, sold, not allowed; plugs in the cabin; dress nights.
- **Improve:** a **"Can I bring…?" search box** that answers in one line ("Kettle: not allowed. Hair dryer: provided."). *S, FE, ★★★.*
- **New:** N-P4.

**P05 Phone Setup Before You Sail**
- *Today:* a tick list of settings to avoid roaming charges, with guidance only.
- **Improve:** **device-specific steps** (iPhone or Android, from the user agent) with the exact menu path, and a **reminder on boarding day** to switch to airplane mode. *M, FE, ★★★.*
- **New:** **Data cost estimator**: how much do you use (messaging, maps, video)? compare roaming, ship Wi-Fi plans, and a local eSIM at each port. *M, FE, ★★.*

**P35 My Reservations / P36 Reservation Details**
- *Today:* dinners, shows and tours, open to change, cancel or "I'm running late".
- **Improve:** one **agenda view** for all bookings by day with clash warnings, a **walk time** between items, and "Add to calendar" per item. *M, FE, ★★★.*
- **New:** **Ticket wallet**: each booking becomes a ticket card (with a QR or code) that opens offline, and can be shared with a party member. *M, FE, ★★★.*

**P26 Book Ahead**
- *Today:* reserve shows, spa and gifts ahead; nothing charged until on board.
- **Improve:** show a **week of shows at a glance** (title, length, age, seats left) and a "pick for my group" button that suggests two shows from the party's ages and rhythm. *M, FE, ★★★.*
- **New:** **Seat chooser** for the main theatre (a simple sections map with accessible seating marked). *M, FE+SV, ★★.*

**P27 Kids' and Teens' Clubs**
- *Today:* ages, hours, sign-up, a form for allergies, medical needs and medicines.
- **Improve:** an **hours strip** showing when each club runs against the parents' own plan (the dinner reservation, the show), so the family sees when everyone is free. *M, FE, ★★★.*
- **New:** **Child pass card**: a printable or saved card with the child's name, club, pickup rules, allergies and the parent's cabin, for staff to scan or read. *S, FE, ★★★.*

**P24 Saved Items and Basket / P23 Prepay and Credit**
- *Today:* saved excursions and extras with total; pay for gratuities or onboard credit in advance.
- **Improve:** **"keep for later"** instead of delete; a **per-person split** of the basket; N-P2's budget bar on top. *S, FE, ★★★.*
- **New:** **Prepay calculator**: "At $X a day for 7 nights, prepay saves/costs…" with the real figures and an honest "it makes no difference to the price, only to when you pay". *S, FE, ★★.*

**P25 Room Upgrades**
- *Today:* bid to move up a room type, or pay now; bids decided three days before sailing.
- **Improve:** **side-by-side room view** (current vs target: deck, size, balcony, motion score) and "what a win would feel like" in plain words. *M, FE, ★★★.*
- **New:** **Upgrade watch**: tell me if an upgrade opens at or under $X per night. Same pattern as slot watch. *M, FE+SV, ★★.*

**P28 Gift Ideas**
- *Today:* ideas to send to a cabin or for a next trip; nothing bought without a say.
- **Improve:** **sort by occasion, budget and delivery night**, and show the delivery time. *S, FE, ★★.*
- **New:** **Gift scheduler**: choose a gift, pick the night it should land, and add a note (printed in the guest's words). Pairs with celebrations. *M, FE+SV, ★★★.*

**P34 Build My Day**
- *Today:* pick events and meals; the plan adjusts when something changes.
- **Improve:** a **timeline lane** view (the day as a vertical strip with each item's length), clash warnings, and **"walk 6 min" connectors** between items. *M, FE, ★★★.*
- **New:** **Plan B for rain**: for any outdoor item, a one-tap indoor alternative stored with the day, switched on automatically when the weather feed says rain. *M, FE, ★★★.*

**P39 Autopilot Day**
- *Today:* a suggested whole day from tastes; only suggests; shows exactly what will change; undo; week builder; slot watch.
- **Improve:** an **"explain this"** on every suggestion ("because you hearted jazz and you rest after lunch"), and a **"swap this"** that offers two alternatives. *M, FE, ★★★.*
- **New:** **"I have three hours" mode**: a quick button on Home that offers three fragments (relax, explore, eat) from the current time. *M, FE, ★★★.*

**P40 My Daily Rhythm**
- *Today:* pace of days (early bird, night owl).
- **Improve:** a **rhythm per traveller** and a **blend for the group** ("Ana wakes at 7, Ben at 10: breakfast at 8:30 works for both"). *M, FE, ★★.*
- **New:** **Rhythm preview**: a thumbnail of a typical day for each setting, so the choice is not abstract. *S, FE, ★★.*

**P41 Surprises**
- *Today:* turn small unplanned treats on or off.
- **Improve:** a **frequency dial** and **categories** (food, views, small gifts), plus a **log** of what was a surprise, so the guest can find it. *S, FE, ★★.*
- **New:** **Surprise someone**: send a small surprise to a party member (see Occasion Starter's surprise mode, P04). *M, FE+SV, ★★.*

**P42 What the App Thinks You Like**
- *Today:* see, correct or clear the tastes the app inferred.
- **Improve:** **show the evidence** ("because you hearted Wok & Roll and the thermal suite") and give a **"not me" one-tap** on each line. *M, FE, ★★★.*
- **New:** **Cruise personality card**: a shareable "I'm a Sunset Chaser" card built from tastes, with a group view that shows what the party has in common. Fun, and on-brand. *M, ART, FE, ★★.*

**P44 Ship or Independent**
- *Today:* compare doing a port yourself with the ship's tour on cost, risk and time.
- **Improve:** a **risk gauge** with plain reasons (tender queue, distance to the pier, the ship waits only for its own tours), and a **time-buffer picture**. *M, FE, ★★★.*
- **New:** **Independent day builder**: taxi fares, bus route, an authored simple walking loop, and the "take me back" words card. Pairs with the port pilot. *L, FE, ★★★.*

**P45 Family Traditions**
- *Today:* note rituals that appear as reminders in plans.
- **Improve:** a **starter list** (toast at sail-away, matching shirts night, postcard from every port) with one-tap add and placing on a day. *S, FE, ★★★.*
- **New:** **Tradition scrapbook** across trips: the memory book groups the same ritual by year ("The sail-away toast, 2025, 2027"). *M, FE, ★★.*

**P06 How Hard Is It?**
- *Today:* walking, stairs and stamina for each activity, rated honestly.
- **Improve:** filter by the **guest's access profile** and show actual numbers (steps, minutes, heat, shade, seats along the way). *M, FE, ★★★.*
- **New:** **Mobility match**: for every traveller, a green/amber/red per activity with a one-line reason and the alternative. *M, FE, ★★★.*

**S18 Spa, Salon and Fitness / S19 Dining Favourites and Table / S38 Port Know-How**
- *Today:* treatments and classes with times; table preference and dietary needs; money, language, tenders and advice per port.
- **Improve (S18):** a **price and availability grid by day** and a "quiet times" tag. **(S19):** show a **dietary matrix** for the whole party on every table request. **(S38):** an **offline "port pack"** downloaded in one tap (map, phrases, prices, numbers). *M, FE, ★★★.*
- **New (S18):** **Spa day bundler** (treatment + class + lunch). **(S19):** **table-mates**: the same table for the whole party, with notes. **(S38):** **phrasebook with speech** (ten phrases per port, spoken with read-aloud). *M, FE, ★★.*

**P29 Getting to the Port**
- *Today:* flights, hotels and the day before; how early to arrive.
- **Improve:** a **night-before planner** with hotels near the port, distance to the terminal, shuttle, parking costs, and a sleep-in time. *M, FE+PR, ★★★.*
- **New:** **Flight buffer check**: enter the flight number; the app tells you how much margin you have between landing and the terminal window with the flight provider seam (already behind an interface). *M, PR, ★★★.*

**P31 Weather by Port**
- *Today:* weather for each port on the dates, to pack and plan.
- **Improve:** an **hour-by-hour day in port** with UV and rain; feeds the packing list ("add rain jackets"). *M, FE+PR, ★★★.*
- **New:** **Tender outlook**: swell and wind for tender ports, and a plain note on what happens if tendering is cancelled. *M, PR, ★★.*

**P33 Away from Home**
- *Today:* tick list for mail, pets, security, who to call; out-of-office text in three tones.
- **Improve:** **assign items to a person** and share a live checklist with a house-sitter. *M, FE+SV, ★★.*
- **New:** **Sitter card**: one printable page with feeding, keys, alarm code location, vets and emergency contacts. *S, FE, ★★.*

**H24 When Something Changes**
- *Today:* options and who to call when plans change; steps in order.
- **Improve:** a **scenario picker** ("I missed my flight", "the port is closed", "I'm sick") that shows only the steps for that case. *M, FE, ★★★.*
- **New:** **Plan B pack**: save the numbers, hotel and rebooking steps for offline use. *S, FE, ★★.*

**P01, P47, P43, P48, P49, P50, P46, P51, P52, M14, C01:** see Manage.

---

## Stage 6: Get to the ship

**What it is for.** The last days and the travel to the terminal: check in online, get the pass, travel, arrive in the window. Tabs: Board, Travel, Plan. Home tiles: pass, check-in, getting there, documents, I'm delayed, emergency card.

**Where it falls short.**
- This is the most stressful stage and the screens treat it as seven separate tasks. A guest needs one sequence.
- The leave-by time, the arrival window, the pass and the weather are on different screens.
- Check-in is one-traveller-at-a-time on one device; the other adults cannot do their own on their own phones, as far as I can see.

### New pages for this stage

| ID | Page | What it is | Size / value |
|---|---|---|---|
| **N-G1** | **Boarding Day Mode** | A full-screen sequence that starts from the leave-by time: wake, leave home, road, terminal, bag drop, security, pass, photo, gangway. One big next step, the time, the weather and a "I'm done" button; the rest of the day is a thin strip on top. It is the same data as H32, H33, H34, P30 and H31 in one calm view. Starts automatically on the morning of sailing (and can be turned off). | L, FE, ★★★ |
| **N-G2** | **Check-In Together** | Each adult gets a link (by text or QR) to complete their own check-in on their own phone, with the lead guest seeing everyone's progress. Children are done by a parent. | M, FE+SV, ★★★ |
| **N-G3** | **Terminal Map** | An illustrated map of the terminal with the lanes, bag drop, security, check-in desks and where drivers stop. Authored; one terminal at first. | M, ART, FE, ★★ |
| **N-G4** | **The Night Before** | A one-page card: charge devices, print or save the pass, set the alarm, pack the carry-on, check the weather, confirm the ride, read the leave-by time. Each item ticks. | S, FE, ★★★ |

### Pages

**H27 Online Check-In**
- *Today:* per traveller: photo, documents, payment card, emergency contact; stop and resume; a ticket-shaped progress.
- **Improve:** N-G2, plus a **time estimate** on each step and a **"what you'll need"** pre-flight screen listing passport, card and photo conditions per traveller. *M, FE, ★★★.*
- **New:** **Photo coach**: a live camera frame with an oval, "step back" and "more light" tips, and one-tap retake. Only helps the guest take a better photo; the check is still the ship's. *M, FE, ★★.*

**H28 Check-In for One Traveller**
- *Today:* finish or fix one traveller's check-in; retry photo or document.
- **Improve:** say **exactly why a step failed** in plain words and what to do ("The photo was too dark. Try near a window."). *S, FE, ★★★.*
- **New:** **Hand the phone over** mode: a locked screen for a child or an older relative that shows only their step, with large text and one button. *M, FE, ★★.*

**H29 What We Have on File**
- *Today:* everything submitted, per guest, with timestamps; passport numbers masked; offline copy.
- **Improve:** a **"Looks right?"** tick per section that shows who has confirmed what, and an **edit** link back to the step. *S, FE, ★★.*
- **New:** **Send for review**: a read-only copy a family member can look at before the guest sails. *S, FE+SV, ★.*

**H30 Check in at the Terminal**
- *Today:* what to bring and expect; the Blue lane; "I'm at the terminal".
- **Improve:** a **bring-list with ticks per traveller** and an expected wait from the queue feed. *S, FE, ★★★.*
- **New:** **Terminal route** (N-G3) and a **time-to-board estimate**. *M, FE, ★★.*

**H31 Boarding Pass**
- *Today:* pass with code, offline copy, print, brightness view, keep a stub, failsafe card.
- **Improve:** **wake lock and brightness hint**; **one code at a time** with a swipe to the next traveller, auto-advancing after a scan. Show "saved on this phone at 8:12" so the guest trusts the offline copy. *S, FE, ★★★.*
- **New:** **Add to Apple / Google Wallet** (today the pass is simulated; a signed pass needs certificates, see `next-level-plan.md` §5). Keep as the target, not a quick win. *L, PR, ★★★.*

**H26 Find My Boarding Pass**
- *Today:* get the pass back from a booking number and surname with no sign-in.
- **Improve:** **send me a link** by email or text so the pass is on the phone before the guest leaves home. *S, FE+SV, ★★.*
- **New:** **"Print at the hotel"** help: a clean PDF and a short guide to asking the front desk. *S, FE, ★.*

**H32 Embarkation Day / H34 Embarkation Plan**
- *Today:* arrival window, terminal, steps in order; queue estimates; needs (priority, step-free, quiet lane).
- **Improve:** a **queue forecast chart** across the day with the guest's window marked and "best for you". N-G1 absorbs the day-of use. *M, FE, ★★★.*
- **New:** **Role card** for who carries what, who holds the passports, who meets at the terminal; printable. *S, FE, ★★.*

**H36 My Medallion**
- *Today:* what it does, setup, tracking number, switch on, lost.
- **Improve:** a **"what it opens"** diagram (door, pay, ID, find me) and a per-person status ("Ana: on. Ben: not yet"). *S, FE, ★★.*
- **New:** **Medallion checklist before boarding** (photo done, linked, charged if applicable). *S, FE, ★.*

**H37 Luggage Tags**
- *Today:* print or collect tags; when bags arrive; a tag card per guest.
- **Improve:** a **tag preview** with the bag number and colour, per bag. *S, FE, ★★.*
- **New:** **Bag buddy**: a photo of each bag and a note ("blue hard case, red ribbon"), shown at pickup to recognise it, and a "my bag arrived" tick. *S, FE, ★★★.*

**S26 Emergency Card** *(also Embark, Sea)*
- *Today:* what to do in an emergency, readable offline.
- **Improve:** put the guest's own details on it (cabin, muster station, medical card flag) so the card is *theirs*. *S, FE, ★★★.*
- **New:** **Lock-screen image**: save the card as an image to use as a phone wallpaper. *S, FE, ★★.*

**P29, P31, P33, H24, H38, P22:** see Prebook and Manage. In this stage, P31 should switch to "the next 3 days" at the departure city and the port.

**P30 Getting to the Ship**
- *Today:* door-to-ship timeline, on-track / at-risk card, leave-by time, driver card, last look, arrived message, ship-lengths to go.
- **Improve:** **live traffic** from a traffic provider seam (the current minutes-by-road are typed) with a push when the leave-by changes by more than 10 minutes. *L, PR+SV, ★★★.*
- **New:** **Share my ETA** with the party and the person at home as a short-lived link: "Arriving about 11:20." *M, FE+SV, ★★★.*

**P32 Storm Watch**
- *Today:* probability in typical seasons; what the line may do; what you can do.
- **Improve:** a **seasonal chart** of typical storm frequency by week with the guest's sailing marked. *S, FE, ★★.*
- **New:** **Hurricane-season playbook**: what changes at "watch", "warning", "reroute", "cancel", and who to call. *M, FE, ★★★.*

**H25 I'm Delayed**
- *Today:* tell the line and the party in one step; what to do next; how late is too late.
- **Improve:** a **live cut-off clock** ("The gangway closes at 3:30 pm. You have 47 minutes."), and **options by how late** (taxi, run, tender, fly to the next port). *M, FE, ★★★.*
- **New:** **Port agent card**: a ready message and number for the port agent, plus a one-tap "book a taxi" link by the provider seam. *M, PR, ★★.*

---

## Stage 7: Embark

**What it is for.** The first hours aboard: board, find the cabin, muster, orient, sail away. Tabs: Board, Ship, Plan. Home tiles: companion, meeting-point card, muster, deck map, Wi-Fi, medical help.

**Where it falls short.**
- The Ship tab appears in full from the first minute: 24 screens, text list. A new guest needs *ten*: where is my cabin, where is food, where do I muster, how do I get online, who do I call.
- Nothing teaches the ship. The deck map is a map; there is no "walk with me".
- The first sail-away is the day's best moment and the app does not mark it.

### New pages for this stage

| ID | Page | What it is | Size / value |
|---|---|---|---|
| **N-E1** | **First Four Hours** | A short guided plan: cabin, drop bags, lunch, muster, a walk of the ship, sail-away, dinner. Times are filled in from the sailing; each step opens the right screen. This is the Embark equivalent of Boarding Day Mode and replaces the long Ship tab as the default view for the first day. | M, FE, ★★★ |
| **N-E2** | **Self-Guided Ship Tour** | A 15-minute walk through the key spaces with a path on the deck map, a stamp at each stop and a one-line fact. Ties into the scavenger hunt. | M, ART, FE, ★★★ |
| **N-E3** | **Cabin Arrival Check** | A 6-point list: photograph any damage (kept on the device or sent to Guest Services), set the safe code, find the plugs, test the TV, meet your steward, set Do Not Disturb. | S, FE, ★★ |
| **N-E4** | **Sail-Away Guide** | Where to watch from (step-free marked), what time, what to bring, where the party is, which side faces the skyline. | S, FE, ★★ |

### Pages

**H33 Embarkation Companion / H35 Meeting-Point Card**
- *Today:* one card at a time, tick off, "now: step 3 of 8"; a card showing where a group meets.
- **Improve:** N-E1 supersedes the long list; add **haptic and a moment** on the last step ("Welcome aboard"). The meeting-point card gains a **photo or landmark** the guest adds. *S, FE, ★★★.*
- **New:** **"I'm here" ping**: one tap tells the group the guest has arrived at the meeting point. *S, FE+SV, ★★.*

**S25 Muster Drill**
- *Today:* station, drill time, check-in from an hour before, everyone on the booking, a crew scan.
- **Improve:** an **animated route** from the cabin to the station (extend D5-4's three landmarks) and an **"accessible route"** variant for the party's profile. *M, FE, ★★★.*
- **New:** **Practice the drill**: a 90-second interactive "what do I do?" (life jackets, signals, stay calm) that ends with a **Drill done** moment. *M, FE, ★★★.*

**S23 Wi-Fi**
- *Today:* plans, QR to join, airplane-mode steps, devices included.
- **Improve:** a **plan chooser by use** ("messaging only", "video calls", "work") and number of devices. *S, FE, ★★★.*
- **New:** **"Save my data" tips** (turn off auto-updates, download maps first, photo backup off) on one card. *S, FE, ★★.*

**S27 Medical Help Now**
- *Today:* reach the Medical Center or urgent help; number and steps.
- **Improve:** a **call script** auto-filled with cabin, deck, the traveller's age and flagged conditions, to read out. *S, FE, ★★★.*
- **New:** **Defibrillator and Medical Center markers** on the deck map from the guest's selected place. *S, FE, ★★★.*

**S40 Find My Family** *(also Sea, Port)*
- *Today:* family locations by choice; children from club check-in or the band; reunion plan.
- **Improve:** show **how fresh** each location is and where it came from ("Kids' club, 12 minutes ago"), never a precise dot. *S, FE, ★★★.*
- **New:** **Meet-up proposal**: "Pizza at the Piazza at 6?" with Accept and Can't buttons for each person. *M, FE+SV, ★★★.*

**H29, H31, H36, H37, H26, H24, H25, C01:** see Get to the ship.

**S01 Deck Map**
- *Today:* find any venue, lift, stair; step-free filter; quiet spaces; "you are here" only if the guest says; route finder; park my spot.
- **Improve:** **offline pan and zoom**, a deck switcher that remembers the last deck, and "walk time from the place I picked" on each result. *M, FE, ★★★.*
- **New:** **QR place markers**: stick-on codes at each lift lobby; the guest scans one to set "I'm here". The guest chooses to scan, so the app still never tracks. Needs ship cooperation. *M, ART+FE, ★★★.*

**S02 Restaurants and Bars / S03 Venue Details**
- *Today:* every place to eat and drink with hours and what's included; menus with allergens; hearted dishes; thank-yous; queue control.
- **Improve:** **live waits** and **"open now"** with a filter; allergen icons and **dietary filters on the menu**. *M, FE, ★★★.*
- **New:** **"Where should we eat?"** a decision helper for the party: diet, budget, mood, wait. *M, FE, ★★★.*

**S04 Ship News**
- *Today:* the captain's message, noon report, weather, today's notices.
- **Improve:** a **"since you last looked"** badge, and categories (safety / today / offers). *S, FE, ★★★.*
- **New:** **Listen to the noon report** with read-aloud (the speech helper exists). *S, FE, ★.*

**S05 Search the Ship / S14 Ask the Ship**
- *Today:* find a venue, event or service by name; quick questions answered from ship data.
- **Improve:** **answers, not links** (4.4), and one search box that serves both screens. *M, FE, ★★★.*
- **New:** **Voice search** using the speech API already used for Ask Your Cruise. *S, FE, ★★.*

**S15 Order Food and Drinks / S20 Laundry / S21 Cabin Requests / S22 My Stateroom / S24 Cabin TV / S36 Do Not Disturb**
- *Today:* order to cabin or deck with costs shown; laundry and pressing; requests to the steward; cabin details and controls; phone-as-TV-remote; quiet hours.
- **Improve:** every request shows a **status with a time estimate** (3.5); **"same again"** on orders; **price calculator** on laundry; presets on DND (nap, early night, do not clean). *M, FE+SV, ★★★.*
- **New:** **Recurring requests** ("towels every morning"); **photo attach** on a repair; **wake-up call**; **TV favourites and a "remind me" for a show**. *M, FE+SV, ★★.*

**S28 Ask for Help by Text / S29 Report a Security Concern**
- *Today:* write to Guest Services when speaking is hard; private security report.
- **Improve:** **templates** ("I'm lost", "I feel unwell", "I can't find my child") and **speech-to-text** for typing. *S, FE, ★★★.*
- **New:** **Optional photo and deck/section chooser** on the security report, so the guest points rather than types. *S, FE+SV, ★★.*

**S30 Health and Medical Center / S31 Seasickness First Aid**
- *Today:* hours, prices, what it treats, early illness report, requests; quick steps for seasickness.
- **Improve (S31):** pair the steps with **today's motion level** and the **calmest deck** on one card. **(S30):** an "ask before you go" form that sends the Medical Card summary. *M, FE+SV, ★★★.*
- **New:** **Dose timer** for seasickness tablets (when to take the next), local only. *S, FE, ★★.*

**S33 Allergy Confidence / S34 Lost and Found / S35 Captioned and Signed Shows**
- *Today:* follow the allergy flag from galley to table; report a lost item; find captioned shows.
- **Improve:** timestamps for each allergy hand-off; a **photo and description** on a lost item; a **list of accessible shows with the best seats**. *M, FE+SV, ★★★.*
- **New:** **"Ask the chef"** button on each dish that sends the allergy flag with the dish name; a **found-items gallery** to claim from; **live captions** on the phone for a show (stretch). *L, FE+SV, ★★.*

**P35, P36, P37, P38, P34, P26:** see Prebook; aboard they become **today-first**, defaulting to today's items.

**M10 My Bill, M12 Top Up, PIN and Gratuities, M11 Everything Paid, M08 Packages, M02, M06** *(Me tab on board)*
- see Sea.



---

## Stage 8: Sea

**What it is for.** Days on board: the biggest stage (93 screens). Tabs: Today, Ship, People. Home tiles: briefing, dining, build my day, find my family, deck map, everything paid.

**Where it falls short.**
- The Ship tab lists around 35 screens. It is grouped, but it is a library, not a day. A guest on deck 12 with ten minutes wants "what's on, what's near, what's quiet".
- The ship feeds (Pulse, sky, sea, position) are good and are used only on their own screens. They do not change Home. A pool that is empty, a sunset in twenty minutes and a whale sighting are all things Home could say.
- Games are light: six clues, six trivia questions, one bingo card.
- Kids' and teens' tools are there; there is little a child can do with *their own* screen.

### New pages for this stage

| ID | Page | What it is | Size / value |
|---|---|---|---|
| **N-S1** | **Right Now Card** | One card at the very top of Home and the Today tab: what is next on the guest's plan, where it is, how far, how long to walk, plus one live "good now" suggestion (a quiet pool, a sunset in 20 minutes, a sighting). It is the Sea version of Boarding Day Mode. | M, FE, ★★★ |
| **N-S2** | **Sea Day Ideas** | Three ideas for the hours ahead, by mood (relax, active, together, solo, with kids) and weather. Replaces "what do I do?" with three buttons. Autopilot is a whole day; this is the next three hours. | M, FE, ★★★ |
| **N-S3** | **Daily Challenge** | A small daily mission for the guest or family ("Find a deck with no one on it", "Watch the sunset from the stern", "Try a dish you can't pronounce"), earning a stamp. Pairs with the scavenger hunt and the Trip Diary. | M, ART, FE, ★★ |
| **N-S4** | **Tomorrow Preview** | Shown in the evening briefing: tomorrow's port or sea day, weather, key times, what to book tonight. | S, FE, ★★ |
| **N-S5** | **Quick Diary** | Add a line, a photo or a mood to today in 10 seconds (feeds 4.6). | S, FE, ★★★ |

### Pages

**H22 Morning and Evening Briefing**
- *Today:* events, reservations, weather and all-aboard in one page; read aloud; copy as text; only when opened.
- **Improve:** turn it into a **swipeable story** (weather → plan → dining → port → one idea) with Stanley's daily line, and an **evening look-ahead** (N-S4). *M, FE, ★★★.*
- **New:** **Briefing as a notification** at a time the guest picks (off by default, respecting the nudge budget), with the first card as the notification text. *M, FE+SV, ★★.*

**S06 Steps and Deck Laps**
- *Today:* count steps and laps, set a goal, see progress.
- **Improve:** a **lap tap-counter** with a big button and **group challenge** (party total). *S, FE, ★★.*
- **New:** **Named walks**: "Sunrise Mile" (Promenade, 4 laps), "Stairs not lifts" (decks 5 to 14), each with a distance and a map line. *M, ART, FE, ★★.*

**S07 Loungers**
- *Today:* see where loungers are free; save one.
- **Improve:** **return reminder** and **sun side** using the ship's heading ("Starboard is in the sun until 2 pm"). *S, FE, ★★★.*
- **New:** **Shade finder**: where it is shady now, from the sun's angle and the deck layout. *M, FE, ★★★.*

**S08 Sightings**
- *Today:* see wildlife and landmarks others spotted; add your own.
- **Improve:** each sighting gets a **picture card of the species** and an "I saw it too" tap. *S, ART, FE, ★★.*
- **New:** **Spotter's life list**: tick species seen on this trip (dolphin, flying fish, frigatebird, nurse shark) with badges; shows in Wrapped. *M, ART, FE, ★★.*

**S09 Where Are We / S10 The Sea Beneath Us / S11 Along the Way / S12 Sun, Moon and Stars**
- *Today:* position, speed, next port; depth, water and weather; what you are passing; sunrise, sunset, moon.
- **Improve (S09):** a **trail on the map** and a **live countdown to the next port** ("Cozumel in 4 h 12 min"). **(S10):** a **cross-section illustration** of the water column, with depth marked. **(S11):** a **"look left now"** alert option. **(S12):** a **star chart** for tonight, made on the device from time, latitude and longitude. *M, ART, FE, ★★★.*
- **New:** **"Where we are" share card** (S09), **fact of the day** (S10), **audio commentary** with read-aloud (S11), **satellite and ISS passes** (S12, needs a provider seam). *M, FE+PR, ★★.*

**S13 Ship Pulse**
- *Today:* how busy places are, with the age and confidence of each number; quietest in the next four hours; standby lines.
- **Improve:** an **hour-by-hour heat strip** per venue (earlier today, now, forecast). *M, FE, ★★★.*
- **New:** **"Tell me when it's quiet"** for a chosen place (like slot watch): a notice when the wait drops below N minutes. *M, FE+SV, ★★★.*

**S16 Bar Menu and Drinks Tracker / S17 Shops and Specials**
- *Today:* bar menu and a private drinks diary with gentle warnings and package value; shop specials and pre-order.
- **Improve (S16):** a **package payoff meter** and a **hydration reminder**. **(S17):** a **"today's specials"** strip with port-day deals first. *S, FE, ★★★.*
- **New (S16):** **zero-proof highlights** and "the one you liked on day 2". **(S17):** **souvenir list** by person with a budget, tied to the customs allowance. *M, FE, ★★.*

**S41 Kids' Club Report / S42 Teen Agreement / S43 Games / S49 Read Aloud**
- *Today:* how a child's club day went; agreed rules with a teen; scavenger hunt, trivia, bingo, badges; read any screen aloud.
- **Improve (S41):** add a **consented photo** and a **mood emoji**. **(S42):** a **curfew timeline** picture and "what happens if I'm late". **(S43):** **daily-rotating** content, **team mode** and 20+ clues across all decks. **(S49):** voice and speed choice, and the **current sentence highlighted**. *M, FE+SV, ★★★.*
- **New (S41):** **kid's own page**: a child-safe screen of stickers for what they did. **(S42):** **both sign**: the teen and parent each tap to agree, saved to both. **(S43):** **Family Quest**: a story across the week with stamps and a final certificate. **(S49):** **auto-read** a screen on open. *L, ART, FE+SV, ★★★.*

**S44 Services and Meet-Ups / S45 Solo Safety Timer / S46 I'm OK Check / S47 You Said, We Did**
- *Today:* services, worship and meet-ups; a timer that tells someone if you do not check in; one tap to say you're fine; what guests asked for and what changed.
- **Improve (S44):** **who's going** counts and add-to-calendar. **(S45/S46):** show **exactly who is told and when** (escalation steps) and a **test run**. **(S47):** **vote on ideas** with a status (heard / planned / done). *M, FE+SV, ★★★.*
- **New (S44):** **interest circles** for solo travellers, moderated. **(S45):** **safe-walk-home** with a route and timer for late nights. **(S46):** **scheduled check-ins** for a teen or a solo guest, set by the guest. **(S47):** link **thank-yous to "we passed it on"**. *L, FE+SV, ★★.*

**S48 Photos** *(also Disembark, Remember)*
- *Today:* the photographers' photos as text descriptions; choose; options and quotes; package use.
- **Improve:** **real thumbnails** through the media seam (the app already approves guest photos before showing them) and a **bundle price calculator** that shows the cheapest way to buy the chosen set. *L, ART+SV, ★★★.*
- **New:** **Add to Trip Diary** and **group album** (photos from any party member shown to the party, each with consent). *L, FE+SV, ★★★.*

**H24, H25, H22, H39, H40, H41, H44, H45** *(Today tab)*
- Show **automatically** from the last full day, in order: the Today tab at Sea should *promote* the Disembark screens on the second-to-last evening, not list them from day 1.

**P34, P35, P36, P37, P38, P39, P40, P41, P42, P26:** see Prebook. **At sea** these should be **today-first** and pair with N-S1.

**P27, P43, P45, P47, C01, S40:** see Prebook, Manage and Embark.

**M10 My Bill**
- *Today:* charges so far, credits, what packages paid; a budget card and alerts; currency; fee ledger; spend coach; "explain this line".
- **Improve:** a **daily-spend chart** against the budget, a **projected final bill**, and a **biggest charge** callout. *M, FE, ★★★.*
- **New:** **By person and by category** views, and a **"this looks wrong"** button on each line that opens a query pre-filled with the line. *M, FE+SV, ★★★.*

**M11 Everything Paid and Charged / M12 Top Up, PIN and Gratuities / M24 Lost Items, Claims and Complaints**
- *Today:* a permanent ledger; add credit, set a PIN, change gratuities (private); cases with numbers and due dates.
- **Improve (M11):** **search, filter and CSV export**. **(M12):** a **summary of what changes** before confirm. **(M24):** a **status timeline** with the person's name and the next due date. *M, FE, ★★.*
- **New (M12):** **low-balance top-up rule**, confirm-before-charge always. **(M24):** an **evidence kit** (photos, receipts, a template of what to include). *M, FE+SV, ★★.*

**M08, M02, M06:** see Prebook, Manage.

---

## Stage 9: Port

**What it is for.** A day ashore, back on time. Tabs: Port, Ship, People. Home tiles: Port Day, Port Know-How, My Excursions, Safe Ashore, Weather, Find My Family.

**Where it falls short.**
- The Port Day screen is strong (three clocks, pilot, party check-in, tender, tours, last-minute). It is also **long**: around ten cards. On the pier, the guest needs five things.
- Everything is **authored** for three ports and says so. The guide is a sample, which is honest but limits value.
- The ship tab at Port repeats the full 35 screens that make no sense while the guest is ashore.

### New pages for this stage

| ID | Page | What it is | Size / value |
|---|---|---|---|
| **N-O1** | **Port Day Mode** | The same pattern as Boarding Day Mode. Full-screen, big: *leave the ship by*, *back at the gangway by*, countdown ring, weather now, one plan card and a "Help" button (call ship, show the take-me-back card). Offline. Starts automatically on a port morning. | M, FE, ★★★ |
| **N-O2** | **Pocket Pack** | An offline bundle per port: map with the pier, ten key places, ATM, toilets, taxi stand, phrases and numbers, saved in one tap. | L, ART, FE, ★★★ |
| **N-O3** | **Money Ashore** | Currency, tipping norms, "fair" prices (taxi, water, beach chair), and a converter with the day's rate. Merges the tipping card, the fair-prices table and the rate card. | S, FE, ★★ |
| **N-O4** | **Day Report-Back** | At the day's end, a 30-second review of the port (how was it, what to tell the next guest, a photo) that feeds the Trip Diary and the port tips. | S, FE+SV, ★★ |
| **N-O5** | **Shore Photo Trail** | Three or four photogenic spots per port with a tip, a small map and a stamp for each. | M, ART, FE, ★★ |

### Pages

**S37 Port Day**
- *Today:* the all-aboard time on three clocks, urgency word, port pilot (plan worked back from all-aboard), party "I'm back aboard", tender, tours, last-minute tours, readiness, pins, offline day card.
- **Improve:** N-O1, plus a **buffer slider** ("I like to be back 60 minutes early") and **push alerts** at 90, 60 and 30 minutes (the all-aboard escalation exists; make it obvious it can reach a pocket). *M, FE, ★★★.*
- **New:** **Tender queue estimate** so the plan accounts for the line to get back. *M, PR, ★★★.*

**S38 Port Know-How / S39 Port Snapshot**
- *Today:* money, language, tenders and advice; weather, distances and time on one page.
- **Improve:** N-O2 and N-O3. Add **sunset, UV and tide** to the snapshot and a one-line verdict ("Good beach day. Bring water shoes."). *M, FE+PR, ★★★.*
- **New:** **Crew picks**: three recommendations per port from crew who know it (authored), and a **share snapshot** card to the family chat. *S, FE, ★★.*

**H09 Port Details** *(in Port)*
- *Today:* the same page seen before booking.
- **Improve:** switch to **today's view**: what's open today (day of week, local holidays), what the weather means for each activity. *M, FE, ★★★.*
- **New:** N-O5.

**P37 My Excursions / P44 Ship or Independent**
- *Today:* the guest's booked tours with all-aboard time; compare ship tour with independent.
- **Improve:** **pick-up point and meeting time** shown big, with a **"find the guide"** photo or sign description. *S, FE, ★★★.*
- **New:** **Check-in for a tour** ("I'm at the meeting point") notifies the organiser and the party. *S, FE+SV, ★★.*

**S32 Safe Ashore for You / S33 Allergy Confidence**
- *Today:* tips and warnings for the port; the allergy flag path.
- **Improve (S32):** an **area traffic-light map** and **time-of-day notes**. **(S33):** an **allergy card in the local language** to show at a restaurant ashore. *M, FE, ★★★.*
- **New (S32):** **emergency numbers per port** (police, hospital, consulate, ship's agent) in one card, saved offline. *S, FE, ★★★.*

**S45 Solo Safety Timer / S46 I'm OK Check**
- see Sea; in Port the timer should **default to the all-aboard time** minus the buffer, with one tap to start. *S, FE, ★★★.*

**P31 Weather by Port / H38 Port Entry Rules / H25 I'm Delayed / H22 Briefing / P34 Build My Day / P35 My Reservations**
- see Prebook, Manage, Get to the ship, Sea. **At Port**, the briefing should show **the port first**, and **I'm Delayed** should open with the live cut-off clock.

**S40 Find My Family / C01 Party Chat**
- *Today:* family locations by choice; group chat.
- **Improve:** a **"back by"** line for each person (what they said they'd do) and a **chat pin** for the meeting time and place. *S, FE, ★★.*
- **New:** **Ashore buddy list**: pair up for a day, see each other's *chosen* "I'm okay" status and the all-aboard countdown. *M, FE+SV, ★★.*

**Ship tab at Port (S01 to S36)**
- *Improve:* at Port, **collapse the Ship tab to what matters ashore or while ashore**: the ship's phone, the take-me-back card, the gangway, the all-aboard clock, the quiet pool, port-day specials and spa deals. The full list stays one tap away.
- *New:* **"While you're away"**: the ship's quiet-time offers (spa, pool, show tickets) for the guest who stays on board in port.

---

## Stage 10: Disembark

**What it is for.** The last night and morning: bags, bill, exit, customs, home. Tabs: Leave, Ship, People. Home tiles: getting off, bag night, final bill, customs, cabin sweep, getting home.

**Where it falls short.**
- The screens are time-ordered but the Leave tab is a list. A guest needs a **timeline**: tonight 9 pm bags out, 6 am wake, 7:30 breakfast, 8:15 exit, 9:30 customs.
- The ship tab and people tab shrink to a handful, which is good. The Leave tab is the one that needs the most care.
- Everything for leaving is on separate pages that each assume a calm guest. The last morning is not calm.

### New pages for this stage

| ID | Page | What it is | Size / value |
|---|---|---|---|
| **N-L1** | **Last Morning Mode** | The Disembark equivalent of Boarding Day Mode. A time-ordered strip for tonight and tomorrow, with the next action large and everything else behind it. | M, FE, ★★★ |
| **N-L2** | **Departure Pocket Card** | One offline card: exit time, walk-off group, door, bag area, the customs form status, the ride, the flight, Guest Services number. | S, FE, ★★★ |
| **N-L3** | **Pack-Down Helper** | A reverse of the packing list: what's dirty, what's souvenirs, what goes in carry-on for travel, what must be at the top for customs. | S, FE, ★★ |
| **N-L4** | **Thanks Round** | A short list of the crew the guest has thanked, the ones they'd like to, and a way to write one note to a team (the thank-you records already exist). | S, FE, ★★ |

### Pages

**H39 Getting Off the Ship**
- *Today:* choose exit time; steps for leaving; special assistance link; key times; final-day strip; credit note; last look; empty-cabin photo.
- **Improve:** N-L1, plus a **queue forecast** for each walk-off option and a **walk-off group colour** card. *M, FE, ★★★.*
- **New:** **Alarm helper** that exports a calendar entry with an alarm for the wake-up, bags-out and exit times. *S, FE, ★★★.*

**H40 Bag Night / H41 Final Night Checklist / H42 Cabin Sweep**
- *Today:* tag bags and learn the hallway deadline; tick off tonight's list; check every drawer, the safe and the bathroom.
- **Improve:** a **countdown to the bag deadline** with a push at 30 and 10 minutes; **time-sorted** list with the items done for the guest shown as such; cabin sweep **built from the packing list** ("you packed two chargers. Found one."). *M, FE, ★★★.*
- **New:** **Bag inventory**: a quick list or photo of what is in each tagged bag, kept private, for a lost-bag claim. *M, FE, ★★★.*

**H43 Customs and Immigration**
- *Today:* what to declare; the family's declaration form; allowance left under the goods field.
- **Improve:** **per-person allowance** and a **receipts shoebox** (photos of receipts kept on the device). *M, FE, ★★★.*
- **New:** **Customs line timeline** and what the officer will likely ask, in plain words, with a rehearsal for children. *S, FE, ★★.*

**H44 Plan Around My Flight / H45 Getting Home from the Port / H46 Share a Ride**
- *Today:* an exit time that fits the flight; rides, transit and hotels; split a taxi with other guests.
- **Improve (H44):** a **recommended exit time** with the arithmetic shown. **(H45):** **rides compared** by cost and time. **(H46):** names-first matching, reviewed by the guest. *M, FE+PR, ★★★.*
- **New (H44):** **flight status watch** with a push. **(H45):** a **drop-off card** for the driver (exists as a message; make it a card). **(H46):** a **split calculator** that feeds the split ledger. *M, PR, ★★.*

**M13 Final Bill and Receipts / M10 My Bill**
- *Today:* line-by-line bill, receipts, a way to question a charge, payment to the card on file after midnight, no-card flow.
- **Improve:** a **"what changed since last night"** diff and **one-tap dispute** per line. *M, FE+SV, ★★★.*
- **New:** **Expense export**: a clean PDF or CSV for a work claim or a family split. *M, FE, ★★.*

**M20 Three-Tap Farewell**
- *Today:* say goodbye and settle the last things in three taps.
- **Improve:** a **Moment** (4.3): a farewell card with a Stanley wave and the trip's stats. *S, FE, ★★★.*
- **New:** **Say goodbye to your crew**: tap the team you'd like to thank (steward, dining, entertainer) and send one message per team. *M, FE+SV, ★★.*

**S34 Lost and Found / S01, S02, S15, S21, S23, S26, S27, S28, S30**
- see Embark. At Disembark, **S34** gains a "**left something behind?**" form that works **after** disembarking (the guest has gone) and **S23 Wi-Fi** shows how to keep the connection until they leave the terminal.

**C01 / S40 / S47 / S48**
- see Embark and Sea. At Disembark **S48** should prominently show "photos available until [date]" with **download all**.

---

## Stage 11: Remember

**What it is for.** Keep the trip, say how it went, and want the next one. Tabs: Memories, Next, Feedback. Home tiles: trip memories, memory book, rate your cruise, rewards, history, book the next one.

**Where it falls short.**
- This stage has the *best raw material* in the app: notes, favourites, stubs, pins, postcards, a sailed map, Wrapped cards. It is presented as forms (a textarea per day).
- Photos are the missing ingredient. The media seam exists, approval exists, but the Memory screen's "pictures stay on the ship's server for you only" is a small feature, not the heart.
- "Next" is limited by the catalogue: one route, one ship. A guest who loved this cruise can only book the same cruise again.
- Feedback is all about the cruise line; very little is about the guest's own reflection.

### New pages for this stage

| ID | Page | What it is | Size / value |
|---|---|---|---|
| **N-R1** | **Highlight Reel** | An automatically built 45-second slideshow: the map line growing, each port's postcard, three photos, the stats, the best-moment line. Played in the app and saved as a video or shared as an image set. | L, ART, FE, ★★★ |
| **N-R2** | **Trip Timeline** | The Trip Diary (4.6) shown as a day-by-day scroll with photos, moments, meals and steps. Searchable. This is what the memory book is made *from*. | L, FE+SV, ★★★ |
| **N-R3** | **Our Album** | A shared album for the party: each person adds photos; everyone sees the whole set; each person's photos can be hidden at any time. | L, FE+SV, ★★★ |
| **N-R4** | **Plan the Reunion** | Invite the party (and friends) to sail again: pick a date together (the date finder from the Dream poll), and hold it. | M, FE+SV, ★★★ |
| **N-R5** | **Print It** | Order a printed memory book or a postcard set. Needs a print-on-demand provider seam. | L, PR, ★★ |

### Pages

**M16 Trip Memories / M17 Memory Book and Next Trip**
- *Today:* recap, ticket stubs, postcards to a future self, favourites ranked, sailed map; notes per day, pictures, print to PDF, "what I would change", wanted places.
- **Improve:** make the **notes come from the diary** (N-R2) so the guest only edits, not writes from scratch; **layout templates** with the port palettes (4.1.2); **photos auto-placed** by day. *L, FE, ★★★.*
- **New:** N-R1 and **co-authors**: each party member writes a page for the same book. *L, FE+SV, ★★★.*

**M18 Your Cruise, Wrapped**
- *Today:* quiet cards; "this day last year"; share card; drinks card optional.
- **Improve:** an **animated carousel** with real personal stats (steps walked, sunsets watched, ports, favourite dish, days at sea) and the port palettes. *M, ART, FE, ★★★.*
- **New:** **Group Wrapped**: opt-in per person ("Ana walked the most; Ben ate the most dessert") and **compare with your last cruise**. *M, FE+SV, ★★.*

**S48 Photos / S47 You Said, We Did / M15 Trip History and Receipts**
- *Today:* photos available until a date; guest ideas and ship changes; every cruise and its receipts.
- **Improve (S48):** **download all** and **share to the album**. **(M15):** a **timeline with totals** (nights, ports, spend). *M, FE, ★★.*
- **New (S47):** "**You said, we did**" for *your* trip: a list of what the guest raised and what happened. **(M15):** **bucket-list map** of visited and wanted places (the map and wants exist; join them). *M, FE, ★★.*

**M22 Book Your Next Cruise** *(Next tab)*
- *Today:* hold a date, keep the price, use credit; dates; options; onboard offer.
- **Improve:** **same party prefilled** with "same room type" or "one step up", and a **cost comparison with this trip** ("$180 less than last time"). *M, FE, ★★★.*
- **New:** N-R4, and a **"bring someone new"** referral flow tied to the Captain's Circle code. *M, FE+SV, ★★.*

**H06, H07, H08, H09, H11, H02, H13, H04, P28, P04** *(Next tab)*
- *Today:* the Dream pages again.
- **Improve:** mark things the guest has **already done** ("You have been to Cozumel"), switch the quiz to "**same again, with a twist**", and show **different season** options for the same route.
- **New:** because the catalogue is one route, the Next tab should say so honestly and offer **three ways to make the same cruise new**: a different season, a different cabin class, or a different party. **Open question for you:** is a second route planned? It would change the whole Next tab. *S, FE, ★★★.*

**M09 Captain's Circle and Rewards**
- *Today:* level, next tier, benefits in plain words, referral code, lifetime nights and ports.
- **Improve:** **benefits in dollars** (this is a known gap, S8-10) and a **"what you'd gain at the next tier"** simulation; a **progress ring**. *M, FE+SV, ★★★.*
- **New:** **Referral tracker**: who has used the code and what reward is pending. *M, FE+SV, ★★.*

**M19 Rate Your Cruise / M21 Health Note After the Trip / M20 Three-Tap Farewell**
- *Today:* quick rating with optional detail and a crew-thank preview; a note on health; the farewell.
- **Improve (M19):** **per-area faces** (dining, cabin, entertainment, staff) with a prompt each and a photo, and **"was it what you expected?"** that shows the guest's own Dream worries (the report-back from H13). **(M21):** a **symptom quick-check**. *M, FE+SV, ★★★.*
- **New (M19):** **"What we changed because of you"** after the fact. **(M21):** a **follow-up reminder** at 3 and 7 days. *S, FE+SV, ★★.*

**M23 Caring for the Sea**
- *Today:* the trip's footprint, what the ship does, what you can do.
- **Improve:** a **personal footprint** (miles, per person) and a **comparison with a flight** in plain terms. *M, FE, ★★.*
- **New:** **Pledge** three small actions for the next trip; they appear in the Prebook checklist. *S, FE, ★.*

**M24 Lost Items, Claims and Complaints**
- see Sea.

---

## 7. Me tab, settings and help (every stage)

These 18 settings-and-help screens and the Me screens appear at every stage. They are mostly forms and lists, so the lift is in making them *live* (4.4) and *easier to check*.

**Me front page (MeScreen)**
- *Today:* Captain's Circle tier, the trip, recent changes, the screens list, sign out.
- **Improve:** a **dashboard header**: next payment, next deadline, ready ring, new messages; the screens list below. *M, FE, ★★★.*
- **New:** **"Your travel year"** card (trips this year, nights, ports, spend) that links to history. *S, FE, ★.*

**M04 My Details / M05 Traveller Details**
- **Improve:** a **completeness meter** and **verify email / phone** with a one-time code. *M, FE+SV, ★★.*
- **New:** **how the crew should address you** (name, pronouns, nickname) used on the dining table, the stateroom card and the cabin steward's note. *S, FE+SV, ★★.*

**M33 Settings**
- **Improve:** a **live preview** pane and **presets** ("Large and clear", "Quiet", "Night owl"). *M, FE, ★★★.*
- **New:** **Trip colour** (4.1.7) and **more languages**: French, German, Portuguese next, since the cruise carries international guests. The i18n set-up has `en` and `es` only. *L, FE, ★★★.*

**M28 Notifications / M29 Visual and Vibration Alerts**
- **Improve:** **preview each notice** and a **"send me a test"**. **(M29)** vibration **patterns per type** (all-aboard, safety, plan change). *S, FE, ★★★.*
- **New:** a **daily digest** (one notice a day) as an alternative to individual ones, and a **grouped history**. *M, FE+SV, ★★.*

**M25 Privacy and Data / M26 Offers and News / M34 My Activity**
- **Improve:** a **diagram of "who can see what"**; **topic-level** offer choices; **group the activity** by day. *M, FE, ★★.*
- **New:** a **privacy check-up** (three steps, two minutes), **sharing expiry** for every link, and **export my activity**. *M, FE+SV, ★★.*

**M30 Calm and Inclusion / M31 Travelling After a Loss / M32 Feeling Anxious**
- **Improve:** a single **"make it quiet" button** at the top of every screen's help panel (4.7) that turns on calm mode in one tap. *S, FE, ★★★.*
- **New:** a 60-second **breathing exercise** (a slow circle, with text steps for reduced motion) and a **"what to expect" story** with pictures, for guests who do better knowing exactly what happens (like P51 for children). *M, ART, FE, ★★★.*

**M35 Help Centre / M36 Contact Us / M37 Fix a Problem / M38 Extra Help and Cancelling Kindly / M39 System Status / M40 Report a Problem**
- **Improve:** the Help Centre shows the **top five questions for the current stage**. Contact shows the **real wait** and offers a **call-back**. **Report a problem** adds the **app version and the stage** automatically. *S, FE, ★★★.*
- **New:** a **Trip Tech Check** ("Ready for the ship?"): tests notifications, the offline pass, the clock difference, camera access and the app version in one pass, with a green/amber/red result and a fix for each. This is the single best thing for the "it didn't work on the day" problem. **Also a "send what I'm seeing"** button that attaches the page and the trip context (no documents) to a message, so the agent doesn't ask again. *M, FE+SV, ★★★.*

**M27 Paper Copies**
- **Improve:** a **pack builder**: tick "everything for the terminal" and get one PDF. *S, FE, ★★.*
- **New:** a **QR on every sheet** that opens the live version. *S, FE, ★.*

**M41 Demo Controls / X01 Component Kit**
- **Improve:** a **guided demo script** ("Walk the 11 stages") that steps the demo clock through each stage with a short caption. *M, FE, ★★ (for stakeholders).*
- **New:** a **screenshot-friendly mode** that fills the app with a nice fixed persona and hides demo chrome. *S, FE, ★.*

**X05 Your Account**
- **Improve:** **devices signed in** with a "sign out everywhere" button. *S, FE+SV, ★★.*
- **New:** **linked travel agent** and a "who can see my account" summary. *M, FE+SV, ★.*

---

## 8. All the new pages in one place

Everything marked "N-" above, with the stage it belongs to. "Mode" pages are full-screen single-purpose views that start by themselves at the right time.

| ID | Page | Stage | Size | Value |
|---|---|---|---|---|
| N-D1 | Date and Price Calendar | Dream | M | ★★★ |
| N-D2 | Your First Cruise, Step by Step | Dream | M | ★★★ |
| N-D3 | Compare with My Last Holiday | Dream | S | ★★ |
| N-D4 | When Should I Go? | Dream | M | ★★ |
| N-V1 | My Shortlist Summary | Discover | M | ★★★ |
| N-V2 | Cabin Views Gallery | Discover | M | ★★★ |
| N-V3 | Where Does My Money Go? | Discover | S | ★★ |
| N-B1 | Booking Summary Drawer | Book | M | ★★★ |
| N-B2 | Who Can Pay for What? | Book | M | ★★ |
| N-B3 | Before You Press Pay | Book | S | ★★ |
| N-M1 | The Countdown Plan | Manage | M | ★★★ |
| N-M2 | Group Readiness Board | Manage | M | ★★★ |
| N-M3 | Insurance and Cover | Manage | S | ★★ |
| N-M4 | Trip Info Pack | Manage | M | ★★ |
| N-P1 | Group Plan Board | Prebook | L | ★★★ |
| N-P2 | On-Board Spend Forecast | Prebook | M | ★★★ |
| N-P3 | Excursion Fit Finder | Prebook | M | ★★★ |
| N-P4 | Outfit Planner | Prebook | S | ★★ |
| N-P5 | One-Page Plan | Prebook | S | ★★ |
| N-G1 | Boarding Day Mode | Get to the ship | L | ★★★ |
| N-G2 | Check-In Together | Get to the ship | M | ★★★ |
| N-G3 | Terminal Map | Get to the ship | M | ★★ |
| N-G4 | The Night Before | Get to the ship | S | ★★★ |
| N-E1 | First Four Hours | Embark | M | ★★★ |
| N-E2 | Self-Guided Ship Tour | Embark | M | ★★★ |
| N-E3 | Cabin Arrival Check | Embark | S | ★★ |
| N-E4 | Sail-Away Guide | Embark | S | ★★ |
| N-S1 | Right Now Card | Sea | M | ★★★ |
| N-S2 | Sea Day Ideas | Sea | M | ★★★ |
| N-S3 | Daily Challenge | Sea | M | ★★ |
| N-S4 | Tomorrow Preview | Sea | S | ★★ |
| N-S5 | Quick Diary | Sea | S | ★★★ |
| N-O1 | Port Day Mode | Port | M | ★★★ |
| N-O2 | Pocket Pack | Port | L | ★★★ |
| N-O3 | Money Ashore | Port | S | ★★ |
| N-O4 | Day Report-Back | Port | S | ★★ |
| N-O5 | Shore Photo Trail | Port | M | ★★ |
| N-L1 | Last Morning Mode | Disembark | M | ★★★ |
| N-L2 | Departure Pocket Card | Disembark | S | ★★★ |
| N-L3 | Pack-Down Helper | Disembark | S | ★★ |
| N-L4 | Thanks Round | Disembark | S | ★★ |
| N-R1 | Highlight Reel | Remember | L | ★★★ |
| N-R2 | Trip Timeline (Diary) | Remember | L | ★★★ |
| N-R3 | Our Album | Remember | L | ★★★ |
| N-R4 | Plan the Reunion | Remember | M | ★★★ |
| N-R5 | Print It | Remember | L | ★★ |
| (cross) | Trip Tech Check | Me | M | ★★★ |
| (cross) | Help Panel (4.7) | all | M | ★★★ |
| (cross) | Trip Diary (4.6) | all | L | ★★★ |
| (cross) | One assistant (3.10) | all | L | ★★★ |

Total: 46 new pages and 4 cross-cutting additions, plus about 300 improvements and new ideas on the existing pages (148 of each).

## 9. Suggested phases

These follow the project's rules: one phase, commit, stop. Each phase touches the front end first, and each new string needs Spanish. Phases are ordered so each makes the next cheaper.

| Phase | Theme | Contains | Size |
|---|---|---|---|
| **X1** | **Look and feel** | Hero art, icons on every list, the motion vocabulary, trip colour, Stanley's poses in empty and success states, success lines (4.1, 4.2.1) | M |
| **X2** | **Live tabs** | Live tiles, party-aware tab order, shortcut bar, answer cards in search, the Help Panel (4.4, 4.7) | L |
| **X3** | **The journey in modes** | Boarding Day Mode, First Four Hours, Port Day Mode, Last Morning Mode, Right Now Card, Moments (N-G1, N-E1, N-O1, N-L1, N-S1, 4.3) | L |
| **X4** | **Choose with confidence** | Date calendar, compare saved, last-holiday compare, cost guard-rails, shortlist summary, offers compare (N-D1, N-D3, N-V1, H11, H12, H15) | M |
| **X5** | **Plan together** | Group Plan Board, spend forecast, excursion fit finder, poll date finder, chat plan cards (N-P1, N-P2, N-P3, P49, C01) | L |
| **X6** | **Close the loop** | "What happened to this" statuses, allergy and assistance acknowledgements, request tracking, group readiness board, chase-kindly, safe-arrival pings (3.5, N-M2) | M |
| **X7** | **The diary and the book** | Trip Diary, Quick Diary, timeline, memory book from the diary, Wrapped upgrade, highlight reel (4.6, N-S5, N-R1, N-R2, M17, M18) | L |
| **X8** | **Photos and sharing** | Real photo previews, Our Album, Print It, photo coach, camera uses (S48, N-R3, N-R5, 4.5.3) | L |
| **X9** | **One assistant** | Merge Concierge, Ask Your Cruise and Ask the Ship into Stanley; answer cards; "ask about this" (3.10, 4.2.2) | L |
| **X10** | **Real-world edge** | Live traffic, tender outlook, flight watch, Wallet pass, instalments, languages (PR items) | L |

If you want only one thing to start with: **X1 then X2**. They change how every later idea looks and feels, and nothing else depends on content you do not yet have, except the illustration work in X1 (see question 1).

## 10. What I would not do

- **Track the guest's location.** Several ideas could be easier with a location dot (find-my-family, deck map, solo timer). The app's current rule is that it never knows where a guest is on the ship unless they say so, and that rule is part why the app is trusted. The ideas above use QR markers, "pick where you are", and club check-ins instead.
- **Rank or review crew.** The thank-you note has no rating and no tip on purpose. Keep it.
- **Countdown timers and scarcity.** "Only 2 left!" is a pattern the design language rejects. Where a limit is real (a deadline for a request), it is shown as a date once, not as a ticking clock.
- **Face matching** in photos. The photo ideas assume the guest chooses, not that a system recognises people.
- **AI-written reviews or fake "guests like you" numbers.** Where I suggest "others like you", it must come from real data or be absent.
- **A native app.** The PWA limits are real (no widgets, no Live Activities) but none of the above needs native.

## 11. Questions for you

| # | Question | My lean |
|---|---|---|
| 1 | Who makes the **illustrations** (hero art, Stanley poses, port postcards, species cards)? Code can draw simple flat SVG, but a person should draw the characters. | Commission a small set (10 to 15 pieces); I can build the rest around them. |
| 2 | Is a **second route or ship** planned? It changes the Next tab, the quiz, the compare screens and half of Dream. | If not soon, use the "same cruise, new twist" approach in Remember. |
| 3 | **One assistant** (Stanley) for everything, or keep the four? | One front door. |
| 4 | Are **guest photos** in scope for real (Our Album, previews, memory book)? They need moderation and storage rules. | Yes for the guest's own and the party's, behind the existing approval seam. |
| 5 | Which **languages** after Spanish? | French and German, then Portuguese. |
| 6 | Do you want **modes** (Boarding Day, Port Day, Last Morning) to **start automatically**, or only when the guest opens them? | Auto-start with one-tap off, off in calm mode. |
| 7 | Which of the **PR items** (traffic, flight status, tender outlook, Wallet pass, print-on-demand, instalments) are worth a provider seam next? | Traffic and flight first; Wallet last. |
| 8 | Is **fun** a hard requirement in **calm mode**? I assumed no: calm mode removes animation, moments, challenges and Stanley notes. | Yes, calm mode stays calm. |


## 12. Decisions so far (2026-11-03) and what they change

| Question | Answer | What it changes |
|---|---|---|
| Illustrations (Q1) | The owner will make them in OpenAI image tools from detailed prompts that we write. | The briefs are now in section 14 (they supersede the style notes here; Stanley is pixel art, so the whole set is pixel art). The earlier plan was an **illustration brief**: one prompt per piece with a shared style guide (flat shapes, the brand palette, light and dark variants, transparent background, consistent Stanley character sheet), file names, sizes and where each is used. Pieces: 8 stage heroes (with a dawn/dusk variant), 5 Stanley poses, 3 port postcards (more per new itinerary), species cards, cabin and deck art. Generated art must be checked for contrast, text-free output, and a consistent look before it goes in. SVG tracing or PNG/WebP at 2x are both fine; keep each under ~60 KB for the PWA. |
| More routes (Q2) | Yes: at least 3 ships and their 2027 itineraries. | This is the biggest change in the document. The "one cruise" limit (3.2) goes away, so **Dream and Discover get a real catalogue**: Find My Cruise can choose a *cruise*, not just a room; H07 needs ship and itinerary filters; Saved/compare (H11) becomes much more valuable; the Next tab (Remember) can offer genuinely new ports and ships; the date calendar (N-D1) becomes a calendar across itineraries. New pages worth adding: **Compare Itineraries**, **Compare Ships**, **Explore by Region/Month**. Port palettes and postcards (4.1.2) multiply with the ports. Much existing content is single-route (authored port guides, dress nights, trivia, scavenger hunt, sky/route feeds, the land map, packing); each needs to become data per sailing. This needs a **catalogue phase first** (server tables, reference content, and the screens that currently import `CRUISE` and `SAILINGS` constants), before any of the Dream and Next ideas. |
| One assistant (Q3) | Yes, Stanley, but keep AI cost down and use Stanley much more across the UX to guide and promote Q&A so guests feel empowered. | See 12.1. |

### 12.1 A cheap-first Stanley

The principle: **most questions never reach the model.** Stanley is a *persona and a router*, with three tiers:

1. **Free, instant (no model):** answers built from data the app already has: tonight's dinner, the all-aboard time, what a package includes, what is open now. These are the "answer cards" in 4.4 and 3.10. Typing in the search box or tapping a suggestion chip gets one.
2. **Cheap (cached or templated):** a fixed library of Q&A per page and stage ("What does guaranteed mean?", "How early should I arrive?"), written once, reviewed, translated, and shown as **question chips** at the foot of each page ("Ask Stanley: ..."). Taps cost nothing. Common free-text questions are matched to these by keyword before any model call.
3. **Model (paid):** only for open questions that tiers 1 and 2 cannot answer, with the existing limits (word filter, per-guest limit, cooldown, trip facts without personal data).

Ways to use Stanley through the UX so guests feel guided rather than filling forms:
- **Stanley asks, not the form.** Quiz, booking steps, packing and plan setup are presented as a short conversation with one question at a time and Stanley's pose changing with the answer. The answers still fill the same fields.
- **A "Stanley says" line on every page** (4.2.3) with one suggestion and one or two question chips. Authored, so it costs nothing.
- **Empty states and success moments** use his poses (4.2.1, 4.3).
- **"What should I do next?"** on Home: a free, rules-based answer from the checklist, deadlines and the stage, spoken by Stanley.
- **Explain-it chips** next to hard words and numbers (fare, tender, muster, final payment).
- **Show the saving:** the doc's 3.10 merge becomes "one persona, many sources", with the tier logged in diagnostics so you can see what share of questions cost money and tune the library.

Stanley's phases are now SG1 to SG7 in section 13.7. Earlier suggestion: split **X9** into **X9a** (Stanley persona, chips and the free and cheap tiers) and **X9b** (merge the other three assistants behind him). Do X9a right after X1, because it makes every later page feel guided. The catalogue phase (new **X0**) comes before X4 and the Remember "Next" work.

### 12.2 Updated order

| Phase | Theme |
|---|---|
| **X0** | Catalogue: 3 ships, their 2027 itineraries, data per sailing instead of constants |
| **X1** | Look and feel (needs the illustration brief; start the brief now since art takes time) |
| **X9a** | Stanley persona, question chips, free and cheap answer tiers |
| **X2** | Live tabs and the Help Panel |
| **X3** | Journey modes and moments |
| **X4 to X8, X9b, X10** | As in section 9, with X4 now covering catalogue-wide compare and filters |

## 13. Stanley as the friendly guide, everywhere

**Goal (your direction):** guests should feel *guided and empowered*, not left to fill in forms. Stanley is the app's host: he is on every page that benefits from a friend, he asks the questions, he explains the hard words, he celebrates the good moments, and he is quiet when quiet matters. **Cost rule:** nearly all of this is authored text and rules, not model calls (see 12.1).

### 13.1 Who Stanley is (so every screen sounds the same)

Today he is a pixel-art teddy bear in a captain's cap, white jacket and black bow tie (`src/assets/stanley.png`), with a chat dialog and the rules in `stanley-plan.md`. As the guide he is:

- **Warm, brief, plain.** One to two short sentences. First person ("I'd start with your passports"). No jokes that need a second reading, no emoji, no exclamation marks except in celebrations. Nautical flavour at most once a page ("Smooth sailing").
- **Offers, never nags.** He says what he would do and why, and lets the guest say no. A dismissed note does not come back for that screen.
- **Honest about being a helper.** He is labelled AI where he answers freely; his authored notes are not labelled AI because they are written text. He never claims to book, pay or change anything himself; he points at the button that does.
- **Silent where it could cost safety or trust.** No notes on the emergency card, muster, medical help, security report or any confirm-before-charge dialog. On those pages he appears only as the neutral "Ask Stanley" button.
- **Never in the way.** Max one unprompted element per screen, max three unprompted appearances per session, and a setting to turn it down (13.7).

**Voice samples** (for the writers and for the AI persona prompt):

| Situation | Stanley says |
|---|---|
| Greeting, first visit | "Hello, I'm Stanley. I'll point out the useful bits as we go. You can turn me down any time." |
| Explaining | "'Tender' means small boats take you ashore. It adds about 40 minutes each way." |
| Suggesting | "Most families book dinner on night two first. Want me to show the free slots?" |
| Encouraging | "Four of five documents done. Only Ben's passport date to go." |
| Celebrating | "Booked. Seven nights to look forward to." |
| Empty state | "Nothing saved yet. When you heart a sailing it will wait for you here." |
| Error | "I couldn't load that. Your answers are safe. Try again in a moment." |
| Gentle mode | "Take your time. Nothing here is urgent." |

### 13.2 The Stanley component kit

Built once, used on every screen. Each is a small React component over the existing `Card`, `Dialog` and image setup, with the English and Spanish strings in the locale files and the content in one Q&A library (13.5).

| # | Component | What it does | Where it appears |
|---|---|---|---|
| 1 | **StanleyNote** | An inline card with his pose, one or two lines and an optional action button; dismissible, and the dismissal is saved to the guest's synced settings so it stays dismissed on other devices. | The top of most pages; Home. |
| 2 | **StanleyChips** | Two or three **question chips** at the foot of a page ("What does 'guaranteed' mean?", "How early should I arrive?"). Tapping one opens a small bottom sheet that answers inline from the library or from live data (free), with a "Ask Stanley something else" link into the chat dialog. | Every content screen. |
| 3 | **StanleyAsks** | A **conversation-style form**: one question at a time, Stanley's pose changing with the answer, a progress dot row, Back and Skip. It fills the same fields as the existing form (the form stays as "Show all questions" for people who prefer it and for accessibility). | Quiz, booking steps, packing set-up, plan set-up, check-in tips, allergy and access profile, rhythm, taste. |
| 4 | **StanleyEmpty / StanleyOops** | A friendly empty state, loading line or error with a pose and the next step. | Every empty list, error and offline notice. |
| 5 | **StanleyMoment** | The celebration (4.3): stamp lands, pose, one line, "add to my diary". | Booking confirmed, documents ready, check-in done, boarded, drill done, sail-away, each port, last night, off the ship, home. |
| 6 | **StanleyExplain** | A "?" next to a hard word or number that opens a one-line explanation (fare, taxes, tender, muster, all-aboard, final payment, guarantee, medallion). Free. | Inline in booking, cost, port and boarding screens. |
| 7 | **StanleyNext** | "What should I do next?" on Home: one rules-based answer from the checklist, deadlines, stage and time of day, with a button. Free. | Home at every stage. |
| 8 | **StanleyCoach** | A first-visit tour of a screen (2 or 3 spotlight steps: "This is where your plan sits. Tap a day to see it."). Shown once per screen, replayable from the help panel. | Plan, Deck map, Boarding pass, Port day, Bill. |
| 9 | **StanleyDock** | His small face fixed at a screen corner (replacing the current top-bar and tab-bar buttons as one consistent place). A **speech dot** appears only when he has something genuinely useful (a deadline today, a quiet pool, the leave-by time moved), at most once a day per reason. Tap opens the chat. | Global. |
| 10 | **Stanley's voice in notifications** | The notification sender and icon are Stanley, and the text is in his voice ("Leave by 11:20 to be at the terminal in your window"). Safety notices stay neutral and official. | Push and in-app notices. |
| 11 | **Stanley sign-off on shares** | A small bear stamp in the corner of cards the guest shares or prints (postcard, ticket stub, day poster, certificate). Optional, on by default, removable. | Cards, prints, Wrapped. |

### 13.3 Stanley's job at each stage

| Stage | His role | First things he does |
|---|---|---|
| Dream | **The enthusiastic friend** who makes it feel easy | Asks the quiz one question at a time; explains cruise words; answers "is this for me?" worries; suggests a date from the calendar. |
| Discover | **The honest advisor** | Explains the cost lines ("This is what's in the price; this is what isn't"); compares two cabins in words; says plainly when a fare is not a bargain. |
| Book | **The calm co-pilot** | Walks through each booking step with a one-line "why we ask"; reassures about saving; marks the confirmation as a moment. |
| Manage | **The organiser** | "What matters now" in his words; reminds of the next deadline; nudges the group kindly; explains documents and policies. |
| Prebook | **The planner** | Asks what kind of day the guest likes, suggests excursions and dinners, explains "ship or independent", helps pack. |
| Get to the ship | **The steady hand** | Runs Boarding Day Mode with short instructions; reassures about the offline pass; keeps wording calm if time is tight. |
| Embark | **The tour guide** | Leads the first four hours and the self-guided ship tour; practises the muster drill with the guest. |
| Sea | **The cruise director** | The daily line; "I have three hours" ideas; "tell me when it's quiet"; sightings; games and the daily challenge. |
| Port | **The local friend** | Port Day Mode, the take-me-back words, tender and heat tips, a gentle reminder at 90, 60, 30 minutes. |
| Disembark | **The packer** | Last Morning Mode; the bag deadline; the cabin sweep; a warm goodbye. |
| Remember | **The storyteller** | Writes the first draft of the diary entries, asks "what was your favourite bit?", assembles the book, suggests the next trip. |

### 13.4 Where he shows up, page by page

"Note" is a StanleyNote, "Chips" are question chips, "Asks" is the conversational form, "Explain" is the "?" popover, "Moment" is a celebration. Only the pages with the strongest case are listed; the rest get default chips from their stage's library.

| Page | Stanley treatment | Example line or chip |
|---|---|---|
| Home (all stages) | **Next** + one Note | "Your next step: confirm Ben's passport date." |
| H02 Find My Cruise | **Asks** (whole quiz) | "Who's coming with you?" |
| H13 Is This Cruise for Me? | Note + Chips on each worry | "Worried about seasickness? Here's the real picture." |
| H07 Sailing Dates | Note + Chips | "Cheapest week is 14 March. Want to see why?" |
| H08, H09 | Explain (tender, all-aboard) + Chips | "How long will I really have ashore?" |
| H14 Cabin | **Asks** ("Tell me which one") + Chips | "Do you sleep lightly?" |
| H12 Trip cost | Note + Explain on each line | "Most guests add drinks. Does your party drink?" |
| H15, P17, P18 | Note | "This fare is in the middle of the usual range." |
| H16–H17 Booking steps | **Asks** + Explain per field + Moment on confirm | "Enter names as on the passport. I'll check the common slips." |
| H19, P14 Money | Note + Chips | "Your balance is due in 34 days. Want a reminder?" |
| P09, P10, P11 Needs | **Asks** | "Tell me once; I'll make sure the ship knows." |
| P12 Readiness | Note naming who is blocking | "Only Ben's passport date left." |
| P01 Checklist | Note + Chips | "Thirty minutes this week gets you ahead." |
| P02, P03 Packing | **Asks** (set-up) + Chip "Can I bring…?" | "Is anyone in the party under 5?" |
| P05 Phone setup | Note | "Switch to airplane mode before the ship leaves the dock." |
| P37 Excursions | **Asks** (Fit Finder) | "How active do you want to be?" |
| P38 Dining | Chips + Explain ("specialty", "anytime") | "Which night works for a special dinner?" |
| P34, P39 Day planner | Note: "why this suggestion" | "I put the show after your rest time." |
| H27 Check-in | Coach + Note, photo tips | "Stand by a window. No hat, no glasses." |
| H31 Boarding pass | Note (offline reassurance) | "This copy is saved on your phone. It works with no signal." |
| H32/N-G1 Boarding Day | **Stanley leads** the whole mode | "Next: drop your bags. Porters are on the left." |
| H25 I'm Delayed | Calm Note | "Tell the ship first. I'll show what to do next." |
| S25 Muster | **Practice the drill** (Asks) + Moment | "Show me where to go if the alarm sounds." |
| S01 Deck Map | Coach + Chips | "How do I get to the buffet from my cabin?" |
| S02/S03 Venues | Note + Chips | "Where should we eat tonight?" |
| S15 Order | Chips | "How long will it take?" |
| S13 Pulse | Note "good time now" | "The pool is quiet right now." |
| H22 Briefing | **Stanley's daily line** | "Cozumel today. All aboard at 4:30." |
| S37 Port Day | **Stanley leads** (N-O1) | "Leave the ship by 1:00 to be back with time to spare." |
| S38/S39 Port | Chips + phrase explain | "How do I say 'thank you' here?" |
| S32 Safe ashore | Gentle Note | "Taxis here use a posted fare. Ask before you get in." |
| M10 Bill | Note + Chips | "You're on track for your budget." |
| H39–H42 Leaving | **Stanley leads** (N-L1) | "Bags out by 10 pm. Mine would be tagged now." |
| H43 Customs | Explain + Chips | "What counts as 'goods bought abroad'?" |
| M16–M18 Memories | **Writes the draft** + Moment | "Day 3: you snorkelled in Cozumel and loved the pastry. Shall I start there?" |
| M19 Rate | Note | "Two minutes. A person reads it." |
| M22 Rebook | Note + Chips | "Same party, same room? I've filled it in." |
| M33 Settings | Note + "Quiet Stanley" control | "Want me to talk less? Choose below." |
| M30–M32 Calm, loss, anxiety | Gentle Note only, no chips by default | "Take your time." |
| M35–M40 Help | Search falls back to Stanley | "I couldn't find that in the help. Ask me?" |

### 13.5 The Q&A library (how it stays cheap)

- **One library file per stage** (`src/ai/stanleyLibrary/<stage>.ts` and the Spanish text in the locale files), each entry: `{ id, stages, screens, question, answer | resolver, follow-ups, link }`.
- **`answer`** is authored text. **`resolver`** is a small tested function that reads data the app already has (plan, bill, weather, ship feed) and returns a sentence plus a link. Both are free.
- **Scale to author:** about 15 Q&A per stage (about 165), plus about 30 resolvers (next dinner, next deadline, all-aboard time, bill so far, what is open now). One writer can do this in a day per stage.
- **Matching free text:** a free-text question is scored against library questions on the device (keywords and a small synonym list). A strong match answers from the library and never calls the model. Only a weak match goes to the model. This is the main cost saver.
- **Learning loop:** unmatched questions are counted by a topic label the server already derives in its prescan, with no personal data, so the next batch of library entries is written from real demand.
- **Helpfulness:** "Was that helpful?" under each answer, which prunes weak entries.
- **Safety:** the existing rule stays: emergency, medical, legal and "talk to a person" messages never reach a model, and the library has no medical advice beyond what is already authored in the app.

### 13.6 Rules and guard rails

- **Quiet Stanley** setting with four levels: *Chatty* (notes, chips, dock bubbles, coach), *Helpful* (default: notes and chips), *Only when asked* (just the dock button), *Off*. Calm mode and simple mode default to *Only when asked*. Per-device, and synced if the guest wants.
- **No unprompted Stanley** on the safety pages listed in 13.1, in confirm-before-charge dialogs, or in the first minute after an error that cost the guest something.
- **Frequency caps:** one Note per page, three unprompted appearances per session, a dismissed Note stays dismissed, the dock bubble once per reason per day.
- **Accessibility:** notes are plain text in a labelled region (not a live region, so a screen reader is not interrupted), pose images are decorative (`alt=""`) except where the pose *is* the information, everything works by keyboard, text is Spanish-ready, art is hidden or simplified in high contrast, and animations stop under reduced motion.
- **Tone checks:** a short test that every Stanley line is under the length limit and has no exclamation mark outside Moments, and the same word-quality tests the app already runs on its strings.
- **Privacy:** he sees only the PII-free trip facts the server already builds for him (`StanleyFacts`); the library resolvers run on the device and read what the guest already sees.

### 13.7 Phases for Stanley (replaces X9a in 12.2 with more detail)

| Phase | What | Needs | Size |
|---|---|---|---|
| **SG1** | **The kit.** StanleyNote, Chips (with the bottom-sheet answer), Empty/Oops, Quiet Stanley setting, the dock, and the pose images wired in (5 poses first). 40 library entries for Dream, Discover, Book. | Poses 1 to 5 (14.2) | M |
| **SG2** | **Asks.** The quiz, the booking steps and the cabin "tell me which one" as conversations, with the old forms kept as "Show all questions". | SG1 | M to L |
| **SG3** | **Next and Explain.** StanleyNext on Home at every stage and the "?" explainers (20 terms). Library for Manage, Prebook, Get to the ship. | SG1 | M |
| **SG4** | **Moments and Coach.** The celebration component with stamps, plus coach marks on five screens. | Poses and stamps (14.2, 14.7) | M |
| **SG5** | **Leads the modes.** Stanley as the voice of Boarding Day, First Four Hours, Port Day and Last Morning; the daily line; notifications in his voice. Library for Embark, Sea, Port, Disembark. | X3 modes | M |
| **SG6** | **Storyteller.** First-draft diary entries and memory book text, "what was your favourite bit?", Remember library. | Trip Diary (4.6) | M |
| **SG7** | **Merge the other assistants** behind him (3.10, was X9b). | SG1 to SG5 | L |

SG1 can start now, in parallel with the catalogue phase X0, because it needs no new data.

---

## 14. Illustration briefs

You will generate these in OpenAI's image tool. This section is written to be pasted straight in. Everything is a **prompt template plus a list of subjects**, so every piece comes out in one family.

### 14.1 Art direction (read first)

**Decision to confirm: pixel art, matching Stanley.** `stanley.png` is chunky pixel art with soft shading and a warm palette. Drawing everything else as smooth flat vector would make him look pasted in. The recommendation is to make the whole app's illustration language **pixel art in the same style** ("a cosy 16-bit postcard"): it is distinctive and playful, it is memorable, it compresses small, and it stays crisp when scaled with `image-rendering: pixelated`. It is warmer than the line's polished photography, which is the point of a guide character. If you would rather have smooth vector art, redo Stanley first, then use the same briefs with the *style block* swapped (alternate block at the end of 14.1).

**One master style block.** Paste it at the start of every prompt:

> STYLE BLOCK (pixel art): "Cosy 16-bit pixel art illustration, chunky visible pixels on a consistent grid, soft dithering only for gradients in skies and water, gentle warm lighting, rounded friendly shapes, thick clean pixel outlines in a darker shade of each colour (never pure black except small details). Limited palette of about 24 colours drawn from: deep navy #003595 and ink #020215, sea teal #00707c, soft sky #cce7eb and #e8f0fd, sand #f2efed and #f8eedb, warm gold #aa8247 and #e8c98a, coral pink #b5004a with pale pink #fde8f1, plum #5b2a86, plus natural teddy brown, cream and white. No text, no letters, no numbers, no logos, no watermarks. No real brand marks. Looks hand-made and kind, not corporate, not photoreal, not 3D, no gloss, no neon, no gradients except dithered ones."

**Alternate style block (smooth vector):** "Flat vector illustration, simple geometric shapes, soft rounded corners, no outlines, subtle paper-grain shading, the same palette and rules as above."

**Stanley character sheet (attach `stanley.png` as the reference image to every Stanley prompt):**

> STANLEY: "Stanley, a friendly brown teddy bear ship's host. Round face with a cream muzzle, a dark brown nose, two small black shiny eyes with a white glint, a gentle closed-mouth smile with a small curve. White sailor-captain's cap with a black band and a thin gold trim. White crew jacket and a black bow tie. Soft fur texture suggested with pixel dither. Short round arms and legs, round belly, about 2.5 heads tall. Same face, same cap, same bow tie, same proportions in every picture. Keep this exact design as in the reference image."

**Technical rules for all pieces**

| Item | Rule |
|---|---|
| **Sizes** | The image tool makes 1024×1024 (square), 1536×1024 (wide) or 1024×1536 (tall). Generate at those sizes. I will crop and downscale to the sizes in each table. |
| **Background** | Characters, icons and stamps: **transparent background**. If the tool cannot give transparency, ask for a **solid flat magenta #FF00FF background with no shadows** so it can be keyed out. Scenes (heroes, postcards): full bleed, no border. |
| **Outline for dark mode** | Characters get a **1 pixel light cream outline** (#fff8ea) around the silhouette so they read on both the white and the near-black (#020215) themes. |
| **Safe area** | Heroes keep the important subject in the **middle 60%**; the sides are cropped on different screens (phone 3:2, desktop 4:1). Leave calm, low-detail sky or water at the top and bottom edges for text to sit on. |
| **Text** | The picture must contain **no text at all**. Anything written is added by the app (it needs translating and contrast checking). |
| **Consistency** | Same lighting direction (sun from the upper left), same palette, same outline treatment. After generating, **reject any piece where Stanley's cap, bow tie, nose or proportions drift.** |
| **After generation** | Save the **prompt used and the raw 1024 file** in `art/source/` in the repo. I will add a small script (`scripts/art.mjs`) that crops, snaps to a pixel grid (nearest-neighbour downscale to 1/4 or 1/6, then re-upscale), limits the palette, writes WebP with alpha, and reports file sizes. Generated pixel art is rarely a true grid, and this step is what makes the set match. |
| **Weight** | Poses: ≤ 40 KB each at 512 px. Heroes: ≤ 90 KB each at 1200×400 and 600×300. Icons and stamps: ≤ 8 KB. Total art over the first six phases: ≤ 1.2 MB, **not precached** except the five core poses (the PWA already precaches about 4.3 MB). |
| **Accessibility** | Art is decorative: `alt=""`. Any information (a pose that means "error") is also in text. Heroes are hidden in high contrast and softened in calm mode. |
| **Legal** | The brief avoids real logos, and ship pictures use a generic ship shape. Confirm OpenAI's current terms allow your commercial use of generated images, and that the cruise line is happy with a ship likeness, before shipping. Keep the prompts and raw files as a record of how each piece was made. |

### 14.2 Stanley poses (16)

Prompt = STYLE BLOCK + STANLEY + the **pose line** below + "Full body, centred, facing slightly to the front, transparent background, 1024×1024." Used at 512, 256 and 128 px. File name in the first column (`src/assets/art/stanley/`).

| # | File | Pose line | Where used |
|---|---|---|---|
| 1 | `wave.webp` | "Waving hello with one raised paw, mouth a little open in a welcome, other paw at his side." | Greeting, Home, first run, dock. |
| 2 | `think.webp` | "One paw on his chin, head tilted, looking up, a small pixel thought-bubble with three dots beside him (no text)." | Searching, loading, "let me check". |
| 3 | `thumbs.webp` | "Standing proud, one paw giving a thumbs-up, a small sparkle at the cap." | Success, done, saved. |
| 4 | `lifebuoy.webp` | "Holding a round red and white lifebuoy ring in both paws, calm and kind expression." | Help, contact, problems. |
| 5 | `sleep.webp` | "Curled up asleep on a small deck chair, cap tipped over his eyes, a little 'z' made of pixels (no letter shapes beyond a simple zig-zag)." | Quiet mode, night, empty "nothing yet". |
| 6 | `point.webp` | "Pointing with one paw to the side (to the viewer's right) with an encouraging smile, as if showing something nearby." | Notes, "look here", coach marks. |
| 7 | `binoculars.webp` | "Looking through a pair of old brass binoculars held to his eyes, standing on tiptoe." | Port, sightings, search the ship. |
| 8 | `clipboard.webp` | "Holding a clipboard with a ticked checklist drawn as small lines and ticks (no words), pencil behind his ear." | Checklists, readiness, planning. |
| 9 | `suitcase.webp` | "Standing beside a small brown suitcase with a sticker and a luggage tag, holding its handle, smiling." | Packing, boarding, travel. |
| 10 | `cheer.webp` | "Arms up in joy, confetti and tiny pennant flags falling, mouth open in a happy cheer." | Moments (booked, boarded, done). |
| 11 | `oops.webp` | "Gentle apologetic shrug, both paws turned up, small sweat-drop, kind eyes. Not sad, just 'sorry about that'." | Errors, offline, "I could not find that". |
| 12 | `map.webp` | "Holding a folded treasure-style map with a dotted route and a brass compass in his other paw." | Navigation, deck map, where are we. |
| 13 | `tray.webp` | "Carrying a silver serving tray with a covered dish and a small glass, like a friendly waiter." | Dining, orders, venues. |
| 14 | `lifejacket.webp` | "Wearing a bright orange life jacket over his jacket, holding both straps, calm and ready." | Muster drill, safety (used only on the drill practice, not on emergencies). |
| 15 | `umbrella.webp` | "Holding a navy umbrella over his head in light rain, a few pixel raindrops, still smiling." | Weather, storm watch, plan B. |
| 16 | `camera.webp` | "Holding a small old-style camera up to take a picture, one eye closed, a little flash star." | Photos, memories, diary. |

**Mood extras** (smaller, head and shoulders only, 512 px, same rules): `gentle.webp` (soft, slightly lowered gaze, quiet smile, for calm and loss screens), `proud.webp` (chest out, tiny medal), `wink.webp`, `sunglasses.webp` (beach day, sunglasses and a lei), `sailor-salute.webp` (formal salute, for the farewell).

### 14.3 Stage heroes (11, plus 3 night variants)

Wide scenes at the top of each stage Home. Prompt = STYLE BLOCK + **scene** + "Wide panoramic composition 1536×1024, main subject in the centre, calm low-detail sky at the top and calm foreground at the bottom, no text. Stanley appears small (about 15% of the height) in the lower third, in the pose given, in the brand style." Final crops: 1200×400 (desktop) and 600×400 (phone). File names in `src/assets/art/heroes/`.

| # | File | Scene | Stanley |
|---|---|---|---|
| 1 | `dream.webp` | "Dawn on a calm sea, a distant cruise ship silhouette on the horizon, a pink and gold sky, a thought-cloud made of tiny postcards drifting up from a deck chair in the foreground." | In a deck chair, `think` pose. |
| 2 | `discover.webp` | "A big old-fashioned wall calendar and a brass magnifying glass beside a tiny model ship on a sand-coloured table, soft window light." | `binoculars` with a magnifier. |
| 3 | `book.webp` | "A ticket-shaped booking confirmation with a ribbon and a small gold seal on a navy desk, with a pen, a passport shape and a tiny globe." | `thumbs`. |
| 4 | `manage.webp` | "A tidy desk calendar with ticked days, a passport, a small plant, a mug and a ship model, in warm afternoon light." | `clipboard`. |
| 5 | `prebook.webp` | "An open suitcase half packed with a sun hat, flip-flops, a swimsuit, sunscreen and a folded map, beside a bright beach towel, on a bed with a view of a sunny window." | `suitcase`. |
| 6 | `getToShip.webp` | "A road at golden hour leading to a harbour terminal with a big ship behind it, a small car and a suitcase, tall palms either side." | `point` toward the ship. |
| 7 | `embark.webp` | "A gangway leading up into a ship's open entrance, bunting, a brass bell, a red carpet, and a welcoming crew arm out of frame." | `wave`. |
| 8 | `sea.webp` | "The wide top deck of a cruise ship at sunset: loungers, a pool, a funnel, long soft shadows, a wake behind, a few gulls." | `sunglasses`. |
| 9 | `port.webp` | "A small tropical harbour town seen from the sea: pastel buildings, palms, turquoise water, a tender boat approaching a pier, a hill behind." | `binoculars`. |
| 10 | `disembark.webp` | "Early morning at a quiet terminal: stacks of tagged suitcases on a trolley, the ship's side with the sun rising behind it, a skyline." | `sailor-salute`. |
| 11 | `remember.webp` | "A cosy table with a photo album open to postcards, a seashell, a ticket stub and a small framed picture of a ship, in lamplight." | `camera`. |

**Night variants** (also used by the Night theme): `sea-night.webp`, `port-night.webp`, `embark-night.webp`. Same scene as above but "after sunset, deep navy sky with soft stars and a pale moon, warm lights glowing from windows, cooler palette with navy and teal, the same composition so the two images can crossfade".

### 14.4 Ports and ships (ready for the three-ship catalogue)

**Port postcard template** (square 1024; used at 600 and 300 px; `src/assets/art/ports/<port-id>.webp`): STYLE BLOCK + "A vintage-style postcard view of [PORT NAME], [COUNTRY]: [3 to 5 landmarks or features], [typical colours of the place], [weather and time of day], [how a ship arrives: docks at a pier or anchors offshore with a tender]. A thin cream postcard border with a small round postmark stamp in one corner, no readable text. A small Stanley in a [pose] in the lower corner."

Prompts for the ports the app has today:

| Port | Filled-in subject |
|---|---|
| Fort Lauderdale (Port Everglades) | "palm trees, a long cruise terminal with a ship alongside, a lighthouse, bright sun, flat blue sky, a few pelicans." |
| Cozumel | "turquoise reef water, a long pier with a ship alongside, a snorkel mask on the rail, a small white church tower, hibiscus flowers, hot noon sun." |
| Belize City | "a ship at anchor offshore with a small tender boat heading to a low wooden pier, colourful wooden Caribbean houses on stilts, a swing bridge, mangroves." |
| Roatán | "green hills tumbling to a bay, a bright white sandy beach, a zip-line cable across the sky, a small wooden jetty, a parrot on a branch." |

**For each new 2027 itinerary:** send me the list of ports and I will write all the prompts from the template. Because three ships means more ports than the four above, plan for **about 6 to 10 new port postcards per ship** (many ports repeat). I also need **three region motifs** for the ship-and-itinerary pages: a Caribbean one, and two more for the other regions the 2027 itineraries cover (for example Mediterranean, Alaska, Mexican Riviera, Northern Europe). Template: STYLE BLOCK + "A wide landscape of [REGION], the signature scenery, a cruise ship silhouette on the water, [season], no text."

**Ship portrait template** (wide 1536×1024, used at 800×300; `src/assets/art/ships/<ship-id>.webp`): STYLE BLOCK + "A [SHIP NAME] cruise ship seen from the water at the front-left, white hull, [number of decks] decks, [distinct features: a dome, a sky-walk, a funnel shape], on a calm sea with a gentle wake, blue sky, a few gulls. A generic cruise ship, not a real-world logo, no text on the hull." Send me the three ships' names and features and I will fill these in.

### 14.5 Cabins and ship scenes

Square 1024, used at 600 px. `src/assets/art/cabins/`.

| File | Prompt line |
|---|---|
| `interior.webp` | STYLE BLOCK + "A cosy cruise-ship interior stateroom with no window: a double bed with a navy throw, a small desk, a round mirror, warm lamp light, a porthole-shaped poster, neat and tidy." |
| `oceanview.webp` | STYLE BLOCK + "A cruise-ship stateroom with a large picture window showing the sea and sky, double bed, a small sofa, a desk, morning light." |
| `balcony.webp` | STYLE BLOCK + "A cruise-ship stateroom with glass sliding doors opening onto a small balcony with two chairs, the sea beyond, sunset light." |
| `suite.webp` | STYLE BLOCK + "A spacious cruise-ship suite: a large bed, a sitting area, a wide balcony with a loveseat, a champagne bucket, warm evening light." |
| `bathroom.webp` | STYLE BLOCK + "A small ship bathroom with a walk-in shower, a round mirror and folded towels shaped like a swan." |
| `view-ocean.webp` | STYLE BLOCK + "The view from a ship balcony over the rail: a wide blue sea and a coloured sunset sky, a bit of a funnel and deck at the edge." |

The side-on **ship position diagram** (bow/stern, decks, midship) is drawn in code, not generated.

### 14.6 Wildlife and sky icons (sightings, 10 plus 4)

Icons: STYLE BLOCK + "A single [subject], side view, cute, simple, centred, transparent background, 1024×1024, large and readable at 96 px". Used at 128 and 64 px. `src/assets/art/wildlife/`. Subjects: bottlenose dolphin, flying fish skimming the water, magnificent frigatebird, brown pelican, green sea turtle, humpback whale tail, manta ray, nurse shark (friendly), parrot, seagull. Sky: crescent moon, full moon, a ringed planet, a shooting star. Each is a collectable "life list" tick (13.4, N-S3).

### 14.7 Stamps, badges and frames

| Set | Count | Prompt | Used |
|---|---|---|---|
| **Port stamps** | 1 per port | STYLE BLOCK + "A round travel passport stamp for [PORT], with a worn ink look, a simple icon of the place in the middle (reef, hill, lighthouse), a ring of tiny dots around it, in teal or plum ink, **no readable text, use abstract tick marks where letters would be**, transparent background, 1024×1024." | Passport stamps, Wrapped, memory book. |
| **Moment stamps** | 10 | Same style: "an ink stamp with a [booked ticket / ticked box / key / life ring / bell / sunset / anchor / gangway / suitcase / heart]", no text. | Moments (4.3). |
| **Game badges** | 12 | STYLE BLOCK + "A shiny round pixel badge with a ribbon, with a small icon of [lens / trophy / compass / shell / dice / dolphin / star / flag / lifebuoy / binoculars / camera / crown], gold and navy, no text." | Scavenger hunt, trivia, Daily Challenge. |
| **Frames** | 4 | STYLE BLOCK + "An empty [postcard / ticket stub / certificate / polaroid photo] frame, with an empty centre ready for text and a photo, decorative corners, cream paper texture, no text." | The card exports in `Cards.tsx`, the memory book. |

### 14.8 Textures and spot art

| File | Prompt | Use |
|---|---|---|
| `wave-strip.webp` (seamless, 1536×512) | STYLE BLOCK + "A seamlessly tiling horizontal strip of gentle pixel waves in two blues, left and right edges match exactly." | The slow 'drift' line on heroes (motion vocabulary 4.1.4). |
| `stars.webp` (seamless, 1024×1024) | STYLE BLOCK + "A seamlessly tiling night sky of small pixel stars on deep navy #020215, tiles on all four edges." | Night theme backgrounds. |
| `paper.webp` (seamless, 1024×1024) | "A seamlessly tiling very subtle cream paper grain texture, nearly flat, #f2efed." | Cards and the memory book. |
| `confetti.webp` | STYLE BLOCK + "A sprinkling of tiny pixel confetti and pennants in navy, teal, gold, pink and plum on a transparent background." | Moments. |
| `ship-icon.webp`, `anchor.webp`, `compass.webp`, `lifebuoy-icon.webp`, `suitcase-icon.webp`, `ticket-icon.webp`, `postcard-icon.webp`, `sun-icon.webp`, `moon-icon.webp` | STYLE BLOCK + "A single pixel icon of [subject], front view, bold and simple, transparent background, readable at 48 px." | Tile icons on tabs (4.1.3) where a pixel icon suits better than the line icon set. |

### 14.9 Order of work (so art does not block code)

1. **Round 1 (needed for SG1 and X1):** poses 1 to 5, the `think` and `oops` extras, the three Home-stage heroes you will see first (`dream`, `sea`, `port`), and the five frames/stamps for Moments. About 15 images.
2. **Round 2:** the remaining 11 poses, the other 8 heroes, cabins, the Fort Lauderdale, Cozumel, Belize and Roatán postcards. About 30 images.
3. **Round 3 (after the ships and ports are known):** ship portraits, new port postcards and stamps, region art, wildlife, badges. About 40 images.
4. **For every piece:** generate 3 candidates, pick one, save the prompt and raw file, run `scripts/art.mjs`, and I will check size, contrast on all five themes (light, dark, night, high contrast, calm), and that no text got in.

### 14.10 What I need from you

- A yes or no on **pixel art** (14.1).
- The **three ships' names** and their distinct features, and the **2027 itinerary port lists** so the prompts can be filled in.
- Tell me if the image tool you are using can produce **transparent PNGs**, so I know whether to plan for the magenta-key step.

---

## 15. The three-ship catalogue for 2027 (research, 2026-11-03)

**Ships:** Sun Princess, Sky Princess, Sapphire Princess. Itineraries below come from web searches of trade news and agent listings (sources at the end of the section). They disagree in places and Princess has been changing 2027 ports. **Treat every port list as provisional.** The real list must come from Princess's own schedule (or whatever data feed the owner has) when the catalogue phase X0 starts.

**Detailed research now lives in `docs/catalogue-2027-research.md`**: confirmed ship fact sheets, the full Sun Princess January to March 2027 Fort Lauderdale schedule, and sampled sailings and port lists for all three ships, with sources and a list of the gaps. The headline findings from it are in 15.6 below; sections 15.1 to 15.3 were written first and remain correct unless 15.6 says otherwise.

### 15.1 What the research found

| Ship | Facts (approximate, sources differ) | 2027 pattern |
|---|---|---|
| **Sun Princess** | Sphere class, launched 2024. About 177,900 gross tons, about 4,300 guests, about 1,130 ft. Signature features: a glass "Sphere" over the three-level Piazza, a glass-enclosed Dome (pool by day, shows by night), a big Arena theatre. (Details are in `docs/sun-princess-ship-profile.md`.) | **January to March:** Caribbean from Fort Lauderdale (7 and 14 night, Eastern and Western, including Celebration Key, Amber Cove, San Juan, Grand Turk). **April to November:** Mediterranean, eight months, from Barcelona, Civitavecchia (Rome) and Piraeus (Athens), 7 to 32 nights. |
| **Sky Princess** | Royal class, launched 2019. 145,281 gross tons, 3,660 guests, 1,080 ft, 19 decks, 1,830 staterooms (81% balcony). Features: the SeaWalk glass-floored walkway over the water, Sky Suites, Piazza, The Sanctuary with cabanas, Movies Under the Stars, MedallionClass. | **January to early March:** Eastern Caribbean from Port Canaveral (6 and 8 night). **March:** transatlantic to Southampton. **March to October:** Northern Europe and Mediterranean from Southampton (7 to 31 nights), including the 24 July 14-night total solar eclipse cruise (eclipse on 2 August off southern Spain). **October:** transatlantic back to Port Canaveral. |
| **Sapphire Princess** | Gem class, launched 2004. 115,875 gross tons, 2,670 guests, 951 ft, 13 decks. Too wide for the Panama Canal. Smaller and older than the other two; no stern wing. Features: The Sanctuary, Piazza, Movies Under the Stars, Skywalkers Nightclub, Lotus Spa. | **March to September:** Japan from Tokyo (the line's largest Japan season, cherry blossom spring and summer festivals). **September:** Southeast Asia (Singapore, Penang, Phuket, Bali) to Fremantle. **October and November:** Australia and New Zealand (Fremantle, Sydney, Auckland). |

**The big surprise:** only Sun Princess is in the Caribbean, and only until March. After that **the three ships are in five different parts of the world** (Mediterranean, Northern Europe and the Atlantic, Japan, Southeast Asia, Australia and New Zealand). The app today is built around one Caribbean route, so the catalogue phase is bigger than "add two more ships".

### 15.2 Provisional port lists (to verify)

| Ship and run | Ports named in the sources |
|---|---|
| Sun, Caribbean (Fort Lauderdale, Jan to Mar) | Fort Lauderdale, Celebration Key (Grand Bahama), Amber Cove (Dominican Republic), San Juan, Grand Turk; the app's existing Western Caribbean route (Cozumel, Belize City, Roatán) |
| Sun, Western Mediterranean (Apr to Oct) | Barcelona, Marseille, Ajaccio, Genoa, La Spezia (a two-night stay on some), Civitavecchia (Rome), Palma de Mallorca, Santa Margherita (for Portofino), Ibiza |
| Sun, Eastern Mediterranean and longer | Civitavecchia, Piraeus (Athens), Mykonos, Corfu, Kusadasi (Ephesus), and, reported as replacements, Zadar, Bar and Kotor. Princess is said to have removed Istanbul from some 2027 sailings. |
| Sky, Caribbean (Port Canaveral, Jan to Mar) | Port Canaveral, Celebration Key, Grand Bahama, Amber Cove, Grand Turk, San Juan, Princess Cays, Nassau |
| Sky, Atlantic (Mar and Oct) | Port Canaveral, Bermuda (West End), Ponta Delgada (Azores), Casablanca, A Coruña, Madeira, Santa Cruz de Tenerife, Southampton |
| Sky, Northern Europe and Mediterranean (Southampton, Mar to Oct) | Southampton, A Coruña, Bilbao, Bordeaux, Cherbourg, Skagen, Copenhagen, Warnemünde (Berlin), and on the 31-night Mediterranean Marvel Spain, France, Italy, Turkey, Greece and Malta |
| Sapphire, Japan (Mar to Sep) | Tokyo, Hakodate, Niigata, Busan, Sasebo, Kagoshima, Hiroshima |
| Sapphire, Southeast Asia (Sep) | Singapore, Port Klang, Penang, Phuket, Bali (Benoa), Fremantle |
| Sapphire, Australia and New Zealand (Oct to Nov) | Fremantle, Sydney, Auckland and about 8 more ports |

### 15.3 What this does to the app (beyond what 12 already said)

| Area | Effect |
|---|---|
| **Languages** | Spanish was chosen for the Caribbean calls. With these ships the useful phrase sets are Italian, French, Greek, Japanese, Spanish (Barcelona, Palma, Ibiza, A Coruña, Bilbao) and Malay and Bahasa. Port phrase cards (S38) and the take-me-back words become **per-port data** instead of three authored ports. The app's own language list (English, Spanish) stays, and French and German are still the sensible next two for Europe. |
| **Time and money** | Many time zones (Japan, Europe, Australia), a different currency per region (euro, yen, Australian and New Zealand dollars, Singapore dollar, ringgit), different tipping norms. The three-clocks, rates and tipping cards need a per-port record. |
| **Entry rules** | The passport and visa table (H38, D3-3) has four rows today. It needs a row per country: Japan, Turkey, Morocco (Casablanca), Malaysia, Indonesia, Singapore, Australia (ETA), New Zealand (NZeTA), UK (ETA), Schengen (ETIAS from 2026 to 2027). Rules change often, so keep the "check the official source and the date we last checked" pattern. |
| **Packing** | Dress nights, weather, plugs (UK, EU, Japan, Australia are all different), the sunscreen and layers advice, and the packing list's port rules all become per-sailing. The "Can I bring…?" answers need per-ship rules. |
| **Getting to the ship** | Fort Lauderdale and Port Canaveral are drive-or-fly in the US. Southampton, Barcelona, Civitavecchia, Piraeus, Tokyo (Yokohama), Singapore, Fremantle and Sydney each have their own transport, terminal and flight patterns. The journey planner (P29, P30), the driver card and the terminal map (N-G3) all become **per-terminal data**. |
| **Cruise lengths** | 6 to 32 nights. Dress nights, the drinks-package break-even, laundry, medication supply, the "mid-cruise slump" and the memory book all scale with length. The code that assumes seven nights (elegant on nights 2 and 7, "day 4 of 7") must become per-sailing rules. |
| **Special sailings** | The eclipse cruise, the cherry-blossom and festival cruises and the Christmas and New Year weeks each deserve a **themed page** (what to see, when, where to stand, how to protect your eyes for an eclipse) and a themed Stanley note. |
| **Long crossings** | Transatlantic and the 31-night sailings are mostly sea days. Autopilot, games, sea-day ideas, sleep and the clock changes (one hour almost every night) matter far more. The clock card and "clocks go forward tonight" nudges become key. |
| **Seasickness and storms** | The Atlantic and North Sea make S31 and Storm Watch (P32) real; hurricane season matters only for the Caribbean and Atlantic legs. |
| **Ship differences** | Each ship needs its own deck plan, venue list, stateroom types, programme and "what's included". The deck-map code, the venue and menu data, the Arena or Dome schedule and the ship profile all become per-ship records. Sapphire Princess is smaller and older, so some features (a Dome, a Sphere) do not exist there. |
| **Discover and Dream** | Now there is a real choice. The catalogue pages gain: browse by **region, month, ship, length and port**; compare two sailings on price per night, ports and days at sea; an **"Explore the world map"** page of all 2027 sailings; and the quiz can choose a *cruise*, not just a room. This is where the earlier Dream and Discover ideas (N-D1 calendar, H11 compare, Compare Itineraries, Compare Ships) become the heart of the app. |
| **Home port timing** | Sailings leave from at least eight ports. The "arrival window", the leave-by time and the all-aboard clock use the departure port's time zone and terminal data. |

### 15.4 A sensible shape for the catalogue phase (X0)

1. **Data model first (server):** Ship, Itinerary, Sailing, Port, PortCall, Terminal, Region, plus per-ship deck and venue references. Seed the three ships and a handful of 2027 sailings **per run** (for example 2 or 3 per region), not all of 2027. The existing reference-content JSON and the `CRUISE` and `SAILINGS` constants become served data.
2. **Make the single-route assumptions explicit and remove them**, one screen family at a time (a test that greps for the old constants helps).
3. **Content per port** as a small schema (arrival style, hours, currency, language, phrases, tipping, ATM and taxi notes, weather by month, entry rules, safety notes, art id). Author the **ten most-visited ports first** and show an honest "guide not yet written" for others, with the official link.
4. **Keep the Fort Lauderdale Western Caribbean route** as sailing set 1, since it is built and tested, and add the Mediterranean run on Sun Princess next (same ship, so cheapest), then Sky Princess, then Sapphire.
5. **A content checklist per ship and per port** (the project already has `content-verification.md`).

### 15.6 What the deeper research changed

- **The model is legs, not cruises.** Nearly every sailing is a 7-night *leg* round trip or point to point, and 14, 21 and 28-night sailings are legs joined back to back (for example, Eastern Caribbean then Western Caribbean with a Fort Lauderdale call between). The catalogue should store legs and let a guest book one or several. The app's current "one 7-night cruise" is exactly one leg pattern.
- **Your Western Caribbean route is one of three Sun Princess Fort Lauderdale patterns** (Eastern: Grand Turk, San Juan, Amber Cove; Western A: Cozumel, Belize City, Roatán, which is the current app route; Western B: Celebration Key, Roatán, Cozumel). As a single 7-night leg, Western A sails only on 24 January and 21 March 2027, with more as half of 14-night sailings. Keep it, and treat the other two patterns as new content.
- **Istanbul is absent** from the Sun Princess listings found. Reports about dropped ports conflict (Kusadasi, Chania and Mykonos are listed). Do not hard-code Turkey.
- **About 120 distinct ports** across the three ships. Use three tiers (full guide and postcard, short guide, official link plus region art) instead of authoring and drawing everything. See research section 7.
- **Sapphire is Gem class with 13 decks and no stern wing.** The earlier portrait prompt was wrong and is fixed in 16.2.
- **Sapphire Princess 2027 to 28 summer homeports in Fremantle**, and Sky Princess repositions across the Atlantic twice, so transatlantic crossings are real catalogue items, not edge cases.

### 15.5 Sources

Itinerary and ship details in this section came from these pages (third-party and trade news; unverified against Princess's own schedule):
- [Sun Princess new Western Mediterranean ports, 2026 to 2027 (Cruise Industry News)](https://cruiseindustrynews.com/cruise-news/2025/09/sun-princess-offers-new-ports-on-western-med-2026-and-2027-voyages/)
- [Princess Cruises UK and Europe 2027 programme (Travelling for Business)](https://travellingforbusiness.co.uk/news/princess-cruises-announces-uk-and-europe-2027-cruise-programme/)
- [Princess Cruises quietly removes Istanbul from multiple 2027 sailings (CruiseHive)](https://www.cruisehive.com/princess-cruises-quietly-removes-istanbul-from-multiple-2027-sailings/209688)
- [Sun Princess January 2027 Caribbean departures (iCruise)](https://www.icruise.com/itineraries/14-night-eastern-western-caribbean-adventurer-cruise_sun-princess_1-24-2027.html)
- [Sky Princess Eastern Caribbean from Port Canaveral, February 2027 (Gangwaze)](https://gangwaze.com/cruise-lines/princess-cruises/sky-princess/2027-02-01/6-nights)
- [Princess increases ex-UK sailings for 2027 (Travel Gossip)](https://travelgossip.co.uk/cruise-news/princess-increases-ex-uk-sailings-for-2027/)
- [Eclipse cruises on two ships in 2027 (Shipmonk)](https://shipmonk.co.uk/2025/06/03/enchanted-sky-princess-cruises-will-offer-views-of-solar-eclipse-on-two-ships-in-2027/)
- [Princess Cruises doubling ship deployment to Japan in 2027 (CruiseHive)](https://www.cruisehive.com/princess-cruises-doubling-ship-deployment-to-japan-in-2027/183224)
- [Princess Cruises 2027 to 2028 Australia and South Pacific itineraries (CruiseMapper)](https://www.cruisemapper.com/news/15568-princess-cruises-australia-south-pacific-program)
- [Princess cruise ships by size (CruiseHive)](https://www.cruisehive.com/princess-cruise-ships-by-size/)

---

## 16. Art briefs filled in for the three ships, and the placeholder plan

### 16.1 Decisions

- **Pixel art for the whole set: yes.** You will generate the images outside this process. We do not need to supply art ourselves.
- **Transparent PNGs: yes.** No background-removal step. The briefs in 14.1 that mention a magenta key background are not needed. Ask for "transparent background" and check the corners of each file for stray colour.
- **Placeholders first.** The code and screens are built with placeholder images, and the real pictures are dropped in later in a **separate art-apply phase (ART1)**.

### 16.2 Ship portraits (3)

Use the **STYLE BLOCK** from 14.1. Wide 1536×1024. Files: `src/assets/art/ships/sun-princess.png`, `sky-princess.png`, `sapphire-princess.png`.

| File | Subject (add after the style block) |
|---|---|
| `sun-princess.png` | "A very large modern white cruise ship seen from the front left on a calm turquoise sea, with a huge clear glass sphere on the upper front of the ship, a glass geodesic dome toward the rear of the upper decks, a long slim white hull with a thin navy stripe, many balcony decks stacked on the side, a soft white wake, a few gulls, a sunny blue sky with small clouds. Generic ship, no logos, no text on the hull." |
| `sky-princess.png` | "A large white cruise ship seen from the front left on a deep blue sea at golden hour, a gently curved bow, a tall white funnel with a navy fin near the rear, a glass-floored walkway shown jutting out from the side of the ship over the water, rows of balconies, a pale wake, soft pink and gold clouds. Generic ship, no logos, no text on the hull." |
| `sapphire-princess.png` | "A mid-sized classic white cruise ship seen from the front left on a calm silver-blue sea, a rounded white superstructure, a slim funnel, a plain rounded stern with no wing or spoiler, a dark nightclub window room on the top deck near the front of the funnel, only 13 decks so noticeably lower and shorter than a modern megaship, a soft wake, a hazy blue sky. Generic ship, no logos, no text on the hull." |

### 16.3 Region scenes (6)

STYLE BLOCK + "A wide landscape of [REGION]: [scene]. A small cruise-ship silhouette on the water, [season and light], no text." 1536×1024; files in `src/assets/art/regions/`.

| File | Region scene |
|---|---|
| `caribbean.png` | "A turquoise Caribbean bay, white sand, palm trees, a small pier, a bright sun, a few puffy clouds." |
| `med-west.png` | "A Western Mediterranean harbour town with terracotta roofs, a stone tower and fishing boats, warm evening light." |
| `med-east.png` | "A Greek island scene with white cubic houses, blue domes, a windmill on a hill, a deep blue sea." |
| `north-europe.png` | "A Northern European waterfront with narrow coloured gabled houses, a lighthouse, a pale blue-grey sky and calm grey-green water, long light." |
| `japan.png` | "A Japanese bay with a snow-capped volcano in the distance, cherry blossoms in the foreground, a red torii gate in the water, soft pink light." |
| `asia-pacific.png` | "A bright tropical Southeast Asian and Australian blend: a tall futuristic city skyline across a bay, longtail boats, a sail-shaped opera-house-like building in the distance, warm light." |

### 16.4 Port postcards (about 36)

Use the **port postcard template** in 14.4 (square 1024, vintage-style postcard with a postmark, a small Stanley in the lower corner), and use the subject below. Files: `src/assets/art/ports/<port-id>.png`. Author these in the order shown; the first ten are the ones the first catalogue phase needs.

| Port | Country | Subject for the template |
|---|---|---|
| **Fort Lauderdale** | USA | palm trees, a long cruise terminal with a ship alongside, a lighthouse, flat blue sky, pelicans. |
| **Cozumel** | Mexico | turquoise reef water, a long pier, a snorkel mask on a rail, a small white church tower, hibiscus. |
| **Belize City** | Belize | a ship at anchor, a tender heading to a wooden pier, colourful wooden houses on stilts, a swing bridge. |
| **Roatán** | Honduras | green hills to a bay, a white sand beach, a zip-line across the sky, a wooden jetty, a parrot. |
| **Celebration Key** | Bahamas | a brand-new tropical island beach with a long lagoon, loungers, a shaded walkway, a tender-free pier. |
| **Amber Cove** | Dominican Republic | a cruise pier with a colourful terminal, green mountains behind, palm trees, a gondola. |
| **San Juan** | Puerto Rico | the old fort on a green headland, pastel colonial buildings, blue cobblestones, a ship in the harbour. |
| **Grand Turk** | Turks and Caicos | a white lighthouse, a long beach, a small cruise centre, turquoise water, a donkey on the sand. |
| **Nassau** | Bahamas | pastel colonial government buildings, a straw market, a pier, a bright sky. |
| **Princess Cays** | Bahamas | a private beach with palms and a pier, calm turquoise water, cabanas. |
| Barcelona | Spain | tall tapering church spires in the distance, a harbour with a cable car, a seafront promenade. |
| Marseille | France | an old harbour with fishing boats, a basilica on a hill, blue shutters. |
| Ajaccio | France (Corsica) | a pastel old town on a bay, a citadel, mountains behind, a quiet harbour. |
| Genoa | Italy | a tall old lighthouse, a harbour with an aquarium shape, ochre and red old buildings climbing a hill. |
| La Spezia | Italy | a gulf with tall pastel cliff-side villages nearby (Cinque Terre), a small train, a vineyard. |
| Civitavecchia (Rome) | Italy | a round ancient arena in the distance, a stone fortress at the harbour, pine trees. |
| Palma de Mallorca | Spain | a huge golden cathedral by the sea, palm trees, a marina, windmills. |
| Santa Margherita and Portofino | Italy | a tiny pastel harbour with moored boats, a hilltop castle, green hills. |
| Ibiza | Spain | a white walled old town on a hill with a cathedral, a calm bay, a sailing boat. |
| Piraeus (Athens) | Greece | an ancient hilltop temple with columns, a busy harbour, white buildings. |
| Mykonos | Greece | white cube houses, blue doors, a row of windmills, bougainvillea, a small harbour. |
| Corfu | Greece | an old town with arcades, a green fortress, a calm blue sea, olive trees. |
| Kusadasi (Ephesus) | Turkey | ancient columned library ruins, a harbour town, a fort on a small island, a bright sky. |
| Kotor | Montenegro | a deep fjord-like bay with steep mountains, a walled town with a red roof clock tower. |
| Zadar | Croatia | an old stone town on a peninsula, a seaside walkway, a sunset, a sea organ shape on the steps. |
| Southampton | England | a waterfront with a ship alongside, a tall old stone gate, a gentle grey-blue sky. |
| A Coruña | Spain | an ancient lighthouse on a headland, glass-fronted balconies, a seaside promenade. |
| Bilbao | Spain | a curved silver museum by a river, a red bridge, green hills. |
| Bordeaux | France | a grand stone square with a shallow mirror of water, a river, elegant stone buildings. |
| Cherbourg | France | a large harbour, a lighthouse, a granite fort, a grey-blue sky. |
| Skagen | Denmark | yellow low houses with red roofs, a long sand spit where two seas meet, dune grass. |
| Copenhagen | Denmark | a canal with tall coloured gabled houses and wooden boats, a small mermaid statue on a rock. |
| Warnemünde | Germany | a red-and-white lighthouse, a white beach with wicker chairs, a canal with fishing boats. |
| Madeira (Funchal) | Portugal | terraced green hills, a cable car, red roofs, a blue bay, flowers. |
| Santa Cruz de Tenerife | Spain | a huge volcano mountain with a cloud, a modern auditorium by the sea, black sand. |
| Ponta Delgada (Azores) | Portugal | black and white mosaic pavement, green crater lakes, whales' tails in the sea, hydrangeas. |
| Bermuda | UK | pink sand beaches, a clock tower on a naval dockyard, pastel houses with white roofs. |
| Casablanca | Morocco | a huge mosque by the sea with a tall minaret, a palm-lined avenue, a sandy sky. |
| Tokyo (Yokohama) | Japan | a big bay with a ferris wheel, a snow-capped mountain behind, cherry blossoms. |
| Hakodate | Japan | a hillside seen at night as a curved sparkle of lights, a star-shaped fort, a ropeway. |
| Hiroshima (Miyajima) | Japan | a red torii gate standing in the sea, a pagoda, deer. |
| Kagoshima | Japan | a smoking volcano across the bay, a ferry, palm trees, steam. |
| Busan | South Korea | a hillside village of pastel houses stacked like blocks, a long bridge, the sea. |
| Singapore | Singapore | tall tree-like garden structures, a hotel with a ship-shaped roof, a skyline across a bay. |
| Penang | Malaysia | colourful street art on old shophouses, trishaws, a hilltop, a harbour. |
| Phuket | Thailand | a long-tail boat on a green bay with limestone cliffs, a golden temple, palms. |
| Bali (Benoa) | Indonesia | stepped rice terraces, a tall carved gate, a temple on a rock, offerings. |
| Fremantle | Australia | an old round stone prison tower, a harbour with a ship, a sunny street of old stone shops. |
| Sydney | Australia | a sail-shaped opera house, a steel harbour bridge, a ferry, a blue harbour. |
| Auckland | New Zealand | a tall slim city tower, a harbour full of sailboats, a green volcanic hill. |

Port stamps (14.7) and the port palettes (4.1.2) follow the same list, so the same IDs are reused.

### 16.5 Ship and region count, so you can budget the generation

| Round | Content | Count |
|---|---|---|
| 1 | Poses 1 to 5, `think`, `oops`, 3 Home heroes, moment stamps and frames | about 15 |
| 2 | Remaining poses, 8 heroes and 3 night heroes, cabin scenes, the first 10 port postcards | about 40 |
| 3 | 3 ship portraits, 6 region scenes, the other 36 postcards and their 46 stamps, wildlife, badges, textures | about 120 |

If the third round is too much, generate postcards only for ports actually on the first few sailings, and use the region scene as a fallback image for any port without one.

### 16.6 The placeholder plan (so code is not blocked)

**Phase ART0 (with SG1, X0 or X1, whichever comes first): placeholders and the plumbing.**

- **One manifest** (`src/assets/art/manifest.ts`): every art id, its file name, native size, a plain-words alt (empty for decorative), the stage or port it belongs to, and the placeholder colour. The code asks for art **by id**, never by file name.
- **An `Art` component** that shows the real image if it exists, and otherwise a **placeholder**: a soft rectangle in the stage or port colour with a small pixel pattern and the art id in tiny letters (visible only in a dev flag). It reserves the right aspect ratio so nothing shifts when the real image arrives.
- **Placeholder generator** (`scripts/art-placeholders.mjs`): writes a flat-colour PNG for every manifest entry in the right size and with transparency where the real one will have it, so layouts can be reviewed and the build size checked. (These are throwaway files and are replaced by name.)
- **A drop-in check** (`npm run art:check`): lists which ids still have placeholders and fails on a file with the wrong size, type or without alpha (for the ones that need it), a corner pixel that is not transparent, or more than the weight budget in 14.1.
- **Lazy loading and no precache** for heroes, postcards and ships, as in 14.1.

**Phase ART1 (when the images are ready): apply.** Drop the files in, run the art script (grid snap, palette limit, WebP), run `art:check`, review each of the five themes, and commit. No component changes should be needed.

### 16.7 Open items (updated)

- **Itineraries and ship features:** resolved by web research, now in `docs/catalogue-2027-research.md` (third-party sources, partial for some months, to be verified against Princess's own schedule before real use).
- **Fort Lauderdale Western Caribbean route:** stays (your answer).
- **Postcard scope (decided 2026-11-03):** generate **Tier A postcards only** (about 25, the list in section 7 of the research file) plus the 6 region scenes, and use the region scene as the image for every other port. More postcards can be added later by id without code changes.
- **Port-list verification:** a person should check the final 2027 deployment and port list against Princess before anything is shown to a guest as fact.
