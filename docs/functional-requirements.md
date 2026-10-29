# Princess Cruises Guest Web App — Functional Requirements (Draft v0.1)

Status: **Research draft for review and discussion. No code has been written.**
Date: 2026-10-28
Target: mobile-first, responsive, installable PWA (React + Vite + TypeScript, see `CLAUDE.md`).

---

## 0. How to read this document

- **Section 1** summarises the research and what it implies for the product.
- **Sections 2–3** describe the current Princess app and the competition (what exists today).
- **Section 4** is the guest journey model and personas.
- **Sections 5–14** are the functional requirements, organised by journey stage. Each requirement has an ID, a priority and a short description.
- **Sections 15–19** cover cross-cutting requirements: accessibility, performance/offline, privacy, content, analytics, and non-functional constraints.
- **Section 20** lists the PWA/web platform constraints that shape what is feasible.
- **Section 21** proposes delivery phases (consistent with the project's phase-and-stop rule).
- **Section 22** lists open questions for you.
- **Appendix A** lists sources and a confidence note.

### Priority key (MoSCoW)

| Tag | Meaning |
| --- | --- |
| **M** | Must have: core to the product; without it the app is not credible |
| **S** | Should have: high value, expected by the competitive set |
| **C** | Could have: differentiator or delighter, schedule permitting |
| **W** | Won't (for now): recorded for completeness, depends on hardware/partner access, or out of scope for a web app |

### Confidence note

Facts about Princess and competitors come from web research (blogs, trade press, Princess pages, forums). Many sources are third-party and some are dated; app features vary by ship and change often. Items marked **(verify)** should be checked against the live apps before we commit to scope. Items marked **(inferred)** are industry-standard functions I have not confirmed on a specific competitor.

---

## 1. Research summary and strategic implications

### 1.1 What we found

1. **Princess's app is a combined booking/boarding/onboard companion** built around the OceanMedallion wearable ("MedallionClass"). The older "Medallion" app has been replaced by a rebuilt **Princess Cruises app** with a new UI, personalisation, larger fonts and lower battery/memory use; the two apps coexisted for a period (verify current state).
2. **Core Princess capabilities today**: OceanReady pre-cruise check-in, boarding (Green/Blue lane, QR code), keyless stateroom entry (Medallion), OceanNow (order food/drinks/items delivered to your location), MedallionPay, OceanCompass (wayfinding, Shipmate Locator, offline messaging), JourneyView (daily planner, Dine My Way reservations, venue capacity), shore excursion booking, muster drill check-in via Medallion, OceanView TV/VOD, OceanTagalong (kids' avatars/games), casino play from the app, MedallionNet (paid Wi-Fi; "Max" Starlink tier included with Plus/Premier), guest-services chat.
3. **Princess launched an AI cruise-planning app inside ChatGPT (28 Sep 2026) and Claude (5 Oct 2026)**, claiming to be the first global line to do so. It covers search, itinerary/ship comparison, ports, excursions, pricing and availability; booking/payment is not confirmed (verify). This signals that conversational planning is now table stakes for the "first engagement" end of the journey.
4. **Pain points are well documented.** Princess app/store ratings are mediocre (an App Store listing at ~3.0; Trustpilot ~2/5; ProductReview.com.au ~2.2/5 from ~520 reviews). Recurring complaints: bookings not visible in the app, app not recognising the guest for days pre-cruise, dining reservations failing pre-boarding, a 2024 dining-reservation outage, a split between what can be done on web vs app ("restrictive" web), and guest-service pushed into app chat with no response.
5. **Competitors set high bars** in specific areas: Royal Caribbean (pre-cruise depth, free app use on ship Wi-Fi, show reservations, Find My Kid, photos), Disney Navigator (free chat, youth-club registration, delight), Carnival HUB (food delivery, paid chat), Celebrity (smart-room remote on Edge ships, in-app booking), Virgin Voyages (virtual dining queues, Planner tab, pre-bookable spa), Norwegian (paid chat; reputation for glitches).

### 1.2 Where Princess is exposed (our opportunity)

| Weakness reported | Product response |
| --- | --- |
| Booking/cruise "disappears" from app | One reliable "My Trips" source of truth, with clear states and a visible sync status |
| Pre-cruise checklist friction (OceanReady) | Guided, resumable, progress-saving, document scan, plain-language errors, equal web/mobile capability |
| Dining reservations failing / contested | Transparent availability, waitlist, virtual queue, confirmation and reminders |
| Web vs app feature split | Full-featured responsive web = full-featured app (one codebase) |
| Support chat goes unanswered | Visible response-time expectation, ticket status, escalation, human handoff |
| Messaging/Wi-Fi costs elsewhere | Free app + free on-ship messaging as a baseline principle |
| App is a transaction tool, not a joy | Delightful moments, countdowns, memories, personalised daily plan |

### 1.3 Guiding product principles

1. **Mobile first, one-thumb friendly.** Primary actions in the lower half of the screen.
2. **The right thing at the right time.** The home screen is contextual to the guest's stage (planning, countdown, check-in, embarkation day, at sea, in port, disembarkation, post-cruise).
3. **Works on a ship.** Poor/slow/absent connectivity is the default environment; design offline-first for onboard content.
4. **Never lose the guest's data.** Draft state is saved; interrupted flows resume.
5. **Accessible by default** (WCAG 2.2 AA) — the Princess demographic skews older and includes many guests with mobility, vision and hearing needs.
6. **Transparent pricing.** Show totals, taxes, gratuities, deposits and cancellation rules before commitment.
7. **Personal, not creepy.** Personalisation with clear consent and controls.
8. **Family and group aware.** A cabin, a party, and a travel group are first-class objects, not an afterthought.

---

## 2. Princess today — current functionality inventory

> Sources: Princess pages, trade press, third-party guides. Check **(verify)** items.

### 2.1 Pre-cruise

| Function | Description |
| --- | --- |
| Account / Captain's Circle login | Princess account; loyalty tiers Gold/Ruby/Platinum/Elite (thresholds approx. 1 / 3 cruises or 30 days / 5 or 50 / 15 or 150) |
| Booking management | View reservation, balance, documents (verify depth in-app vs web) |
| OceanReady | Checklist: passport upload or manual entry, security photo, payment card (MedallionPay), passage contract, emergency contact. Finish ≥13 days before sail for Medallion by mail (US/CA/PR). |
| Medallion fulfilment | Mailed (~$10/stateroom) or terminal pickup |
| Boarding | Green Lane (OceanReady complete) vs Blue Lane; QR code for terminal |
| Pre-book | Shore excursions, dining (Dine My Way/specialty), spa, packages, Wi-Fi, drinks (verify full catalogue in-app) |
| Package upsell | Princess Plus / Princess Premier (gratuities, beverage cap, Wi-Fi, casual dining, specialty dining, excursion credit on Premier) |
| AI planning | ChatGPT / Claude app: search, compare, ports, excursions, pricing, availability |

### 2.2 Onboard

| Function | Description |
| --- | --- |
| Keyless door | Medallion unlocks stateroom |
| OceanNow | Order food/drink/items to your current location; included with Plus/Premier, else ~$14.99 per-cruise activation (verify) |
| MedallionPay | Contactless pay by linked card; spend tracking in app |
| OceanCompass | Turn-by-turn venue directions, Shipmate Locator, messaging that works without Wi-Fi/cell; location privacy toggle |
| JourneyView | Daily planner, event bookmarking, reservation, real-time venue capacity |
| Safety drill | Video in app or TV; Medallion scan at muster station |
| Interactive portals | Ship screens recognise Medallion: deck plans, schedules, directions |
| OceanView | In-room TV VOD, 100+ hours Princess originals |
| OceanTagalong | Kids' avatars, scavenger hunts, games |
| Casino | Select wager games on the app |
| MedallionNet | Paid Wi-Fi (Classic 1 or 4 devices; Max Starlink tier bundled with Plus/Premier; Platinum/Elite 50% off Classic) |
| Guest services chat | In-app chat with crew (reliability complained about) |
| OceanFront | Physical help desk staffed by OceanNavigators |

### 2.3 Post-cruise
Little documented in research. Presumably: receipts/folio, feedback survey, future cruise credits/offers, Captain's Circle updates, photo purchase (verify).

### 2.4 Privacy/safety
Medallion stores only an encrypted guest ID; location hiding in settings; keycard alternative at Guest Services; pacemaker advisory; lost Medallion replaced free.

---

## 3. Competitive landscape

| Capability | Princess | Royal Caribbean | Carnival HUB | Celebrity | Norwegian | Disney Navigator | Virgin Voyages |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Browse/book cruise in app | Yes (verify) | Yes, incl. plan next cruise | Yes (verify) | Yes | Yes | Limited (inferred) | Yes (verify) |
| Pre-cruise check-in & boarding pass | OceanReady + QR | Check-in from ~45 days, arrival time selection, mobile boarding pass | Yes | Yes | Yes | Yes | Yes |
| Pre-book dining | Yes | Yes (with dining package) | Yes | Yes | Yes | Yes | Yes + virtual queue |
| Show/entertainment reservations | Partial | Yes, frequent use | Limited | Yes | Yes | Yes | Yes |
| Excursions booking | Yes | Yes | Yes | Yes | Yes | Yes | Yes (Shore Things) |
| Spa pre-booking | Yes (verify) | Yes | Yes | Yes | Yes | Yes | Trial |
| In-app messaging | Free (OceanCompass, offline-capable) | Free for travel party (without Wi-Fi package) | **$5/pp** | Yes (verify) | **$9.95** | **Free** | Guest-service chat |
| Use app on ship Wi-Fi free | Yes | Yes | Yes | Yes (verify) | Yes (verify) | Yes | Yes |
| Food/drink delivery | **OceanNow** | Limited / varies | Yes (e.g. pizza) | Limited (verify) | Limited | Limited | Ship Eats (missing at launch) |
| Wayfinding / deck plans | **Strong (OceanCompass)** | Deck plans, Find My Kid | Searchable deck plans | Yes | Yes | Yes | Yes |
| Child locator | Shipmate Locator (group) | **Find My Kid** | Limited | — | — | Youth club tools | — |
| Room control | TV/portals | — | — | **Phone as remote (Edge-class)** | — | — | In-room via app (inferred) |
| Photos | Via photo packages (verify) | **View/buy in app** | Yes (verify) | Yes (verify) | Yes (verify) | PhotoPass-style | Yes (verify) |
| Loyalty | Captain's Circle | Crown & Anchor | Fun Select/Cruise Rewards | Captain's Club | Latitudes | Castaway Club | Sailor loyalty |
| AI assistant | **LLM app (ChatGPT, Claude)** | (verify) | (verify) | (verify) | (verify) | — | — |

**Competitive takeaways**
- Princess's wearable-enabled features (keyless entry, ordering, location) are a **moat** that a web app cannot replicate fully; we should integrate with them via account/data APIs, and treat the Medallion as complementary hardware (see §20).
- Competitor wins to match or beat: **free chat for everyone**, **reservations that actually work** (queues, waitlists), **Find My Kid-style safety**, **photos in-app**, **Planner-style unified itinerary** (Virgin), **smart-room control** (Celebrity), **delight** (Disney).
- Gaps to exploit: post-cruise relationship (rebooking, memories), accessibility, group trip planning, trust/transparency, offline-first onboard use, and AI-assisted concierge across the whole journey (not only planning).

---

## 4. Personas and key scenarios

| Persona | Needs |
| --- | --- |
| **First-time cruiser (Maria, 38)** | Reassurance, clear price breakdowns, what-to-pack, what happens on embarkation day, no surprises |
| **Loyal repeater (Gerald, 71, Platinum)** | Fast rebooking, loyalty status, his usual dining, larger fonts, phone call option |
| **Multigenerational family (the Okafors)** | One cabin plan for 3 cabins, kids' clubs, finding each other, shared itinerary, split billing |
| **Accessibility guest (Linda, 66, wheelchair user)** | Accessible cabins/excursions, tender-port info, assistance requests, screen reader support |
| **Solo traveller (Priya, 29)** | Solo cabin pricing, meeting people, safe, social events |
| **Group/organiser (Tom, 45)** | Wedding/reunion block, invite flow, roster, payments tracking |
| **Travel advisor (Ann)** | Agent-booked guests need linkage to their reservation; agents need guest visibility (out of scope for v1, noted) |
| **Crew / Guest Services (internal)** | Responding to chat, issuing replacements; assumed out of scope except API contracts |

---

## 5. Stage 1 — Discover and engage (first engagement)

| ID | Priority | Requirement |
| --- | --- | --- |
| DIS-01 | M | Landing page and home explaining the product with fast load (<2.5 s LCP on 4G), no account needed |
| DIS-02 | M | Destination explorer: regions (Alaska, Caribbean, Mediterranean, Europe, Asia, Australia/NZ, Hawaii, Canada/New England, Panama Canal, world cruises), seasonality, best time to go |
| DIS-03 | M | Ship explorer: fleet pages (class, capacity, year, dining, entertainment, cabins, deck plans, accessibility notes), compare ships side by side |
| DIS-04 | M | Cruise search: filter by destination, date range, duration, departure port, ship, price, cruise type (cruisetour, Grand Voyages, theme), accessible, solo-friendly, family-friendly |
| DIS-05 | M | Itinerary detail: day-by-day map, ports, arrive/depart times, sea days, tender vs dock, sample excursions |
| DIS-06 | S | Guided "Find my cruise" quiz (vibe, budget, travelling with, mobility, must-haves) producing a ranked shortlist |
| DIS-07 | S | Inspiration content: video, 360 tours, real guest photos/reviews, stories, "Love Boat" heritage |
| DIS-08 | S | Save/favourite cruises, ships, ports; compare list; share via link/message |
| DIS-09 | S | Conversational AI concierge ("plan a 7-night Alaska trip in June for 4 including a toddler under $X") with grounded results, citations to itineraries, handoff to a human, and escalation to booking |
| DIS-10 | S | Price alerts and deal tracking (subscribe to itinerary/ship/price drop) |
| DIS-11 | S | Pricing transparency: fare "from" prices per person with taxes/fees/gratuities visible in the estimate; no hidden totals |
| DIS-12 | C | Cruise-cost calculator: fare + excursions + packages + flights/hotel + tips vs all-inclusive packages comparison |
| DIS-13 | C | Virtual ship tour, cabin 360, "view from balcony" at ports |
| DIS-14 | C | Social proof: ratings by ship/itinerary from verified past guests |
| DIS-15 | S | Request a callback / chat with a cruise consultant; find a travel advisor |
| DIS-16 | S | Marketing consent management and lead capture (email/phone), with double opt-in per region |
| DIS-17 | C | Group/shared planning board (invite friends/family to a wish list; vote on cruises) |
| DIS-18 | S | Localisation: language, currency, units, regional itineraries and promotions (US, CA, UK, AU, others — scope TBD) |

---

## 6. Stage 2 — Book

| ID | Priority | Requirement |
| --- | --- | --- |
| BOK-01 | M | Booking funnel with progress, back/forward without data loss, saved drafts, and resume via email/SMS link |
| BOK-02 | M | Guest details: names matching passports, DOB, citizenship, gender field per regulations, contact, address, special needs; scan-to-fill passport (camera, on device) |
| BOK-03 | M | Stateroom category selection (inside, oceanview, balcony, mini-suite, suite, Sanctuary Collection) with deck plan, location, and view obstruction info; "Guaranteed" vs pick your cabin |
| BOK-04 | M | Fare types and what each includes (e.g. Princess Plus / Premier / standard), side by side with total price difference |
| BOK-05 | M | Pricing breakdown: fare, taxes/port fees, gratuities, add-ons, promotions, onboard credit, deposit vs final; currency; price lock |
| BOK-06 | M | Payment: card, digital wallets (Apple Pay/Google Pay via Payment Request API), saved methods, 3-D Secure/SCA, deposit and final-payment scheduling, split between payers |
| BOK-07 | M | Confirmation: booking number, e-documents, calendar file, email/SMS, add to wallet |
| BOK-08 | M | Cancellation / change policy displayed at purchase; ability to view, change, cancel (where allowed) |
| BOK-09 | S | Multi-cabin / family / group booking with adults/children per cabin, bed config, shared payer |
| BOK-10 | S | Insurance / protection offering (travel insurance, cancel-for-any-reason) with clear disclosure |
| BOK-11 | S | Future Cruise Credit (FCC) and on-board booking credit redemption |
| BOK-12 | S | Loyalty: Captain's Circle number capture, tier-based pricing/perks applied |
| BOK-13 | S | Promo codes, military/senior/resident rates (as per Princess rules), automatic best-price check |
| BOK-14 | S | Cruise + land packages (cruisetours) with day-by-day, lodges, rail |
| BOK-15 | S | Pre-cruise hotels, transfers, air (Princess air or integrated flight search) (verify partner availability) |
| BOK-16 | C | Book on behalf of others; agent-assisted booking handoff |
| BOK-17 | C | Waitlist for sold-out cabins and notification |
| BOK-18 | S | Dining time/seating preference (Anytime vs fixed), special occasions, dietary and allergy declaration captured at booking |
| BOK-19 | M | Legal/regulatory content: terms, ticket contract, health requirements, minimum age, pregnancy policy, with explicit acceptance logging |

---

## 7. Stage 3 — Manage booking and prepare (booking → sail)

| ID | Priority | Requirement |
| --- | --- | --- |
| MNG-01 | M | **My Trips**: all current/future/past bookings in one place, reliably, even when booked by agent or on another channel; link by booking number + name |
| MNG-02 | M | Trip dashboard: countdown, status (deposit/final payment due, documents needed, check-in status), next best action |
| MNG-03 | M | Payment due dates, pay balance, view receipts, update card, pay by others via link |
| MNG-04 | M | Edit passenger details, add/remove guests, change names (with rules), special requests |
| MNG-05 | M | Documents wallet: e-ticket, boarding pass, visas, vaccine/health docs, insurance, passport status, expiry warnings (passport must be valid 6 months past return, etc.) |
| MNG-06 | S | Cabin upgrade offers and bidding (bid-up/upgrade marketplace) |
| MNG-07 | S | Pre-cruise checklist with reminders (timeline: 90/60/30/14/7/1 days) |
| MNG-08 | S | Packing list generator based on itinerary, weather, dress codes, ship type; shareable |
| MNG-09 | S | Weather and climate outlook per port/date |
| MNG-10 | S | Travel-to-port planner: embarkation port info, parking, hotel suggestions, transport options, arrival-window selection |
| MNG-11 | S | Entry requirements per country (visa, eTA/ESTA, vaccination), with links and "I've done this" tracking |
| MNG-12 | S | Special assistance and accessibility requests (mobility, hearing, vision, medical devices, CPAP, oxygen, dietary, service animals) and confirmation |
| MNG-13 | S | Special occasions (birthday, anniversary, honeymoon) with gift/celebration purchases |
| MNG-14 | M | Notifications centre; push/email/SMS preferences; critical notices (itinerary changes, port closures, weather, health advisories) |
| MNG-15 | S | Itinerary change handling: clear diff of what changed, options offered, compensation/FCC, and acknowledgement |
| MNG-16 | C | Travel party coordination: invite co-travellers, see who has completed check-in, shared notes |
| MNG-17 | C | Add to Apple/Google Wallet and calendars |
| MNG-18 | S | Fix-it flows: "I can't see my booking", "name mismatch", "lost documents" with guided self-service and escalation |

---

## 8. Stage 4 — Pre-book and personalise ("Cruise Personalizer" equivalent, pre-cruise shopping)

| ID | Priority | Requirement |
| --- | --- | --- |
| PRE-01 | M | **Shore excursions** catalogue by port: description, duration, difficulty, accessibility, price, rating, meeting point, availability; filter by interest, activity level, price, family, accessible |
| PRE-02 | M | Excursion booking, cart, payment, modification, cancellation rules, and itinerary-aware conflict detection (ship's all-aboard time, tender vs dock) |
| PRE-03 | M | **Dining reservations** (Dine My Way/specialty): venue info, menu, price, dress code, availability grid by day/time, party size, dietary notes; confirmation and reminders |
| PRE-04 | S | Entertainment/shows pre-booking where applicable (Princess shows, Broadway-style, comedy) |
| PRE-05 | S | Spa, salon, fitness, thermal suite pre-booking |
| PRE-06 | S | Beverage, wine, specialty dining, photo, Wi-Fi, laundry, and Plus/Premier package purchase with a clear "is it worth it?" calculator |
| PRE-07 | S | Gifts and amenities: flowers, champagne, cakes, stateroom decor, kids' packages |
| PRE-08 | S | Activities and kids/teen clubs registration (Camp Discovery, Teen), including health/allergy/pick-up authorisation |
| PRE-09 | S | Casino and gaming pre-registration (age/ID) (verify availability) |
| PRE-10 | S | Prepaid gratuities and onboard credit purchase |
| PRE-11 | S | Cart, saved items, price drop notifications on add-ons (if price falls, offer refund/credit) |
| PRE-12 | C | AI "build my day" suggestions per port and per sea day, based on interests and mobility |
| PRE-13 | C | Shared itinerary: friends and family see and join excursion/dining plans |
| PRE-14 | S | Sold-out waitlists with auto-booking on release |
| PRE-15 | S | Unified **Plan** tab (à la Virgin's Planner) showing everything booked and not yet booked, per day |

---

## 9. Stage 5 — Check-in (OceanReady) and embarkation

| ID | Priority | Requirement |
| --- | --- | --- |
| CHK-01 | M | **Online check-in** (equivalent of OceanReady) with steps: confirm guests, passport (scan/OCR on device, manual fallback), security photo (guidance for lighting/framing, quality validation), emergency contact, payment method linking, contract acceptance, health questionnaire (if required), arrival time slot |
| CHK-02 | M | Progress and resume: per-guest status, "what's left", works for each traveller (parent completes for minors), can be done on desktop or phone |
| CHK-03 | M | Plain-language errors and validation (e.g. "Your passport photo is blurry; try holding the phone steady in good light") |
| CHK-04 | M | Boarding pass / QR code stored offline and in Wallet; large, high-contrast display; brightness boost |
| CHK-05 | M | Embarkation-day screen: arrival time, terminal address, map, traffic/parking, luggage drop, document checklist, wait times (if available) |
| CHK-06 | S | Medallion / keycard status: shipment tracking, pickup instructions, activation, lost-device flow |
| CHK-07 | S | Live queue/terminal status (via Princess ops API if available) and push when your boarding window opens |
| CHK-08 | S | Fallback: check-in at terminal flow; help for guests who didn't finish ("what to expect in the Blue Lane") |
| CHK-09 | S | Luggage tags: print, e-tag, or order; baggage tracking (inferred, if supported) |
| CHK-10 | S | Port-of-call pre-clearance and immigration forms (e.g. Canada ArriveCAN replacements, Australia, US CBP) guidance |
| CHK-11 | C | Express boarding via biometric (face) match — depends on Princess's own on-site systems |
| CHK-12 | S | "Embarkation day" companion mode: step-by-step cards (terminal → security → photo → gangway → muster → cabin) |

---

## 10. Stage 6 — On board

### 10.1 Home and daily planner

| ID | Priority | Requirement |
| --- | --- | --- |
| OB-01 | M | Contextual home: today's date, location (at sea/port), next events, reservations, deadlines (all-aboard), weather, sail-away |
| OB-02 | M | **Daily planner** ("Patter") — events and activities by time and venue with filter by interest, kids, 18+, accessible; add to My Plan; reminders |
| OB-03 | M | Offline-first: daily schedule, deck plans, menus, maps, my reservations available without any connection |
| OB-04 | M | Deck plans: interactive, searchable, accessible, with "you are here" if location is available; elevators, accessible routes, muster stations |
| OB-05 | S | Venue capacity/busyness indicators (where fed by Princess systems) |
| OB-06 | S | Ship info: Captain's announcements, bridge position, speed, weather, ship tracker, noon report |
| OB-07 | S | Search across all content ("pool", "Italian", "bingo") |

### 10.2 Safety

| ID | Priority | Requirement |
| --- | --- | --- |
| SAF-01 | M | Muster drill: instructions, video, assembly station, check-in confirmation, accessible alternatives, multi-language |
| SAF-02 | M | Emergency information: always-available offline card with cabin number, muster station, emergency contacts, medical help, how to call (extension), and "report an emergency" |
| SAF-03 | S | Health: medical centre hours, appointment/request, report illness, outbreak notices, health declarations |
| SAF-04 | S | Man-overboard / security reporting channel |
| SAF-05 | S | Child safety: kids' locator (if supported by Princess devices), reunion plan, clubs check-in/out status |
| SAF-06 | S | Alerts: weather, itinerary change, medical, safety announcements as high-priority notifications with acknowledgements |

### 10.3 Dining and drinks

| ID | Priority | Requirement |
| --- | --- | --- |
| DIN-01 | M | Venue directory with hours, menus (with allergen and dietary tags), dress code, price (included vs specialty) |
| DIN-02 | M | Reservations: view/modify/cancel, find available tables, waitlist, virtual queue, reminders, late-arrival handling |
| DIN-03 | S | Dietary and allergy profile that follows the guest into every venue and notifies the maître d'; allergen filter on menus |
| DIN-04 | S | OceanNow-style **order delivery**: menu, customise, pay or apply package, track status, ETA, delivery location (cabin, deck zone, pool, with fallback to manual location) |
| DIN-05 | S | Room service: menu, order, schedule breakfast delivery (door-hanger replacement), tipping policy |
| DIN-06 | S | Bar menu, Plus/Premier cap tracker, drinks package status, "what have I used", responsible alcohol alerts |
| DIN-07 | C | Table-side ordering/payment in venues via QR code |
| DIN-08 | C | Wine list and pairing recommendations, favourites, rate dishes |
| DIN-09 | S | Group dining: add friends to a reservation, split bill |

### 10.4 Entertainment, activities and youth

| ID | Priority | Requirement |
| --- | --- | --- |
| ENT-01 | M | Shows, movies under the stars, live music, trivia, classes, enrichment talks, with reservations/ticketing where needed |
| ENT-02 | S | Casino info, tournaments, wager games (verify regulatory limits: gaming in app is jurisdictional) |
| ENT-03 | S | Spa, salon, fitness: book services, classes, view products, specials |
| ENT-04 | S | Kids and teen clubs: schedule, check-in/out, parent notifications, pager-style alerts, photos, authorisations |
| ENT-05 | S | Games and gamification: scavenger hunts, trivia, bingo cards, achievements for kids and adults |
| ENT-06 | S | In-room TV companion: channel guide, VOD, remote, cast to TV |
| ENT-07 | C | Social: find events with interests, groups (solo travellers, LGBTQ+ gatherings, Circle Host meetups), friend finder (opt-in) |
| ENT-08 | C | Live-show "now playing" and wait-in-line alerts |
| ENT-09 | C | Augmented reality ship tour / navigation (camera-based; PWA limits apply) |

### 10.5 Ports and shore excursions

| ID | Priority | Requirement |
| --- | --- | --- |
| POR-01 | M | Port guide: map, what to do, walking distance from the ship, accessible routes, currency, language, transport, free Wi-Fi spots, safety tips, shopping, local customs |
| POR-02 | M | **All-aboard countdown** with live local time vs ship time, push at 2 h / 1 h / 30 min, and "ship is leaving" alert |
| POR-03 | M | My excursions: meeting points, tickets, QR codes, offline access, delay/cancellation notices |
| POR-04 | S | Tender information: ticketing, status, wait time |
| POR-05 | S | Book last-minute excursions on board, with sell-out visibility |
| POR-06 | S | Offline map and navigation for the port |
| POR-07 | S | Emergency contacts ashore: consulate, local emergency number, ship's agent |
| POR-08 | C | Ship-guaranteed independent excursion explainer ("what if I'm late") |
| POR-09 | C | Local currency converter, translation helper (tools using on-device features) |
| POR-10 | C | Port ratings and guests' tips |

### 10.6 Account, spend and payments

| ID | Priority | Requirement |
| --- | --- | --- |
| ACC-01 | M | Onboard account ("folio"): itemised charges, running total, credits, packages, tips, taxes, with search and filter |
| ACC-02 | M | Spending alerts and limits (e.g. alert at 80% of budget), kids' spending limits |
| ACC-03 | S | Add/remove payment method, cash deposit/credit top-up, reset PIN |
| ACC-04 | S | Dispute a charge: guided flow with status |
| ACC-05 | S | Gratuity management (adjust, prepay, remove) per policy |
| ACC-06 | S | Bill preview before disembarkation and eReceipt; express checkout |
| ACC-07 | S | Currency display and exchange rates |
| ACC-08 | C | Shared account view for family members, with permissions |
| ACC-09 | W | Contactless pay via the app in venues: requires Princess POS integration and wearable/NFC capabilities not possible from a browser; use Medallion or keycard |

### 10.7 Connectivity

| ID | Priority | Requirement |
| --- | --- | --- |
| NET-01 | M | App must be usable on ship Wi-Fi's free tier (no paid internet package required) for all app functions |
| NET-02 | S | Wi-Fi: buy, manage devices, usage meter, upgrade, sign-in troubleshooting steps |
| NET-03 | S | Connectivity status banner (offline/slow/connected) and offline queue for actions (e.g. send message, request) that retries |
| NET-04 | S | Data-light mode (low bandwidth, no autoplay) |

### 10.8 Messaging and guest services

| ID | Priority | Requirement |
| --- | --- | --- |
| MSG-01 | M | **Free** messaging among travel party and friends (competitive differentiator vs Carnival $5 and NCL $9.95); group chats; read receipts optional; photos |
| MSG-02 | M | Guest Services chat with named channel types (housekeeping, dining, medical, guest services, shore excursions), visible response time, ticket status, escalation, call-back by phone number |
| MSG-03 | S | Service requests with one tap: housekeeping (towels, turndown, cleaning), maintenance (AC, TV), do-not-disturb, extra items, with live status |
| MSG-04 | S | Ship phone dialler: call cabin, call guest services (VoIP over ship Wi-Fi if available), directory |
| MSG-05 | S | Message safeguards: report/block, parental controls, age gating, moderation, retention policy |
| MSG-06 | S | Translation of messages for multilingual guests/crew |
| MSG-07 | C | Share location with friends (opt-in per person/time), meeting-point drops |

### 10.9 Shopping, services, and extras

| ID | Priority | Requirement |
| --- | --- | --- |
| SHP-01 | S | Onboard shops, catalogue, offers, pre-order for pickup, gift cards |
| SHP-02 | S | Photos: browse all photos by face/venue/day, favourites, buy prints/digital packages, download, share; photographer schedule |
| SHP-03 | S | Laundry, pressing, dry cleaning requests and tracking |
| SHP-04 | S | Art auctions, jewellery events, bingo packages, daily specials |
| SHP-05 | C | Cabin delivery of purchases |
| SHP-06 | S | Religious and community services, meetups (e.g. Catholic Mass, Friends of Bill W.) |

### 10.10 Stateroom

| ID | Priority | Requirement |
| --- | --- | --- |
| ROM-01 | M | Cabin information card: number, steward, amenities, safe info, Wi-Fi, emergency routes |
| ROM-02 | S | Room-service and housekeeping scheduling; preferred cleaning times |
| ROM-03 | S | Digital Do-Not-Disturb/Make-Up-Room toggle |
| ROM-04 | S | Digital keycard/door unlock — Medallion/keycard only (browser cannot do NFC door unlock on iOS; see §20) |
| ROM-05 | C | In-room control (TV, lights, temperature, shades) like Celebrity's Edge-class phone remote, **if** Princess exposes APIs (verify) |
| ROM-06 | S | Cabin-to-cabin: invite to a cabin party |

### 10.11 Accessibility onboard

| ID | Priority | Requirement |
| --- | --- | --- |
| ACS-01 | M | Persistent accessibility profile applied across app: text size, contrast, reduced motion, screen reader, captions, simple mode |
| ACS-02 | M | Accessible route finder (avoid stairs, doors width, slope, tender accessibility) |
| ACS-03 | S | Request assistance (mobility, hearing amplifier, accessible shower, evacuation assistance), see history |
| ACS-04 | S | Captioned/transcribed shows (if provided), sign language interpreter schedule |
| ACS-05 | S | Voice navigation and voice commands |
| ACS-06 | S | Large-print and high-contrast menu and daily plan |

---

## 11. Stage 7 — Disembarkation and immediate post-cruise

| ID | Priority | Requirement |
| --- | --- | --- |
| DEB-01 | M | Disembarkation guide: sequence, colour/number groups, timing, luggage options, customs forms, final folio |
| DEB-02 | M | Select disembarkation time/option (self-assist, express, early walk-off) and luggage tags |
| DEB-03 | M | Final bill and receipts; unresolved charges workflow; tip adjustment deadline |
| DEB-04 | S | Customs and immigration prep: forms, declarations (digital), what to declare |
| DEB-05 | S | Onward travel: airport transfers, flight check-in, hotel, parking exits, ride-share pickup point |
| DEB-06 | S | Lost-and-found: report and track |
| DEB-07 | S | Final-night checklist (packing, tags, valuables, settle bill) with reminders |
| DEB-08 | S | Offline access to disembarkation information |

---

## 12. Stage 8 — Post-cruise (relationship and loyalty)

| ID | Priority | Requirement |
| --- | --- | --- |
| POS-01 | M | Trip history: past cruises, itineraries, receipts, tax docs |
| POS-02 | M | Feedback: rate cruise, ship, dining, entertainment, crew, excursions; short (2 min) with progressive detail; recognise crew by name |
| POS-03 | S | Trip memories: auto-generated trip recap (map, ports, photos, stats, favourite meals), shareable video/story |
| POS-04 | S | Photo access post-cruise: bought and available photos with extended download window |
| POS-05 | S | Loyalty: updated Captain's Circle status, progress to next tier, benefits and expiry |
| POS-06 | S | Rebooking: "book your next cruise" with onboard-booking credits/FCC, personalised suggestions, price-protection, loyalty benefits |
| POS-07 | S | Lost item and claims; refund status; billing disputes; complaints with case number and tracking |
| POS-08 | S | Refer-a-friend and share referral credit |
| POS-09 | C | Review syndication (to Princess pages, with consent) |
| POS-10 | C | Community: past-guest groups, ship alumni, cruise forums moderated by Princess |
| POS-11 | S | Service recovery: if feedback is poor, trigger human contact and offer resolution within a defined SLA |
| POS-12 | S | Carbon/sustainability info: shore power, itinerary impact, programmes (optional) |
| POS-13 | C | Gifting: give a cruise credit or gift card |
| POS-14 | S | Survey consent and data use disclosure |

---

## 13. Loyalty, account and identity (cross-stage)

| ID | Priority | Requirement |
| --- | --- | --- |
| ACT-01 | M | Sign in / sign up: email + password, passkeys (WebAuthn), social login optional, magic link; MFA; account recovery that works without support |
| ACT-02 | M | Link bookings by booking number + last name + date; merge duplicate profiles |
| ACT-03 | M | Profile: personal details, passports (stored securely), preferences (dietary, bedding, accessibility), emergency contacts, payment methods, travel companions |
| ACT-04 | M | Captain's Circle: number, tier, days/cruises, benefits, progress, tier-specific offers, member events |
| ACT-05 | S | Household/companion accounts: manage minors and dependents; delegate access with permissions |
| ACT-06 | S | Privacy centre: consents, data export, delete account, marketing preferences, location sharing |
| ACT-07 | S | Notifications preferences by category and channel; quiet hours |
| ACT-08 | S | Language, region, currency, units, timezone handling (ship time vs home time) |
| ACT-09 | C | Digital wallet pass for loyalty card |

---

## 14. Support, help and trust (cross-stage)

| ID | Priority | Requirement |
| --- | --- | --- |
| SUP-01 | M | Help centre/FAQ with search, contextual help ("?" on each screen), and guided troubleshooting |
| SUP-02 | M | Contact options: chat, phone (click to call), email, callback, with hours and expected wait time shown; ticket tracking |
| SUP-03 | S | AI assistant for support with transparent handoff to humans, escalation, and conversation history that travels with the guest |
| SUP-04 | S | Status page: app/system status and known issues (e.g. dining booking outage) |
| SUP-05 | S | In-app feedback and bug report with screenshot |
| SUP-06 | M | Crisis communications: itinerary disruption, weather, medical, security events with clear guidance |
| SUP-07 | S | Vulnerable guest support: assisted booking, caregiver role, bereavement/medical cancellation flow |

---

## 15. Accessibility requirements (WCAG 2.2 AA minimum)

| ID | Priority | Requirement |
| --- | --- | --- |
| A11Y-01 | M | Full keyboard operability, visible focus indicators, logical focus order, no keyboard traps; focus-trapped dialogs that close on Escape |
| A11Y-02 | M | Colour contrast ≥4.5:1 text, ≥3:1 UI components; do not rely on colour alone; automated contrast checks |
| A11Y-03 | M | Screen reader support (VoiceOver, TalkBack, NVDA, JAWS) with semantic landmarks, labels, live regions for status and chat |
| A11Y-04 | M | Text resizing to 200% without loss; supports OS font scaling; reflow at 320 CSS px |
| A11Y-05 | M | Touch targets ≥24×24 CSS px (WCAG 2.2 target size), recommend ≥44 px; dragging alternatives (2.5.7); consistent help (3.2.6); accessible authentication (3.3.8) with no cognitive tests; redundant entry (3.3.7) minimised |
| A11Y-06 | M | Reduced motion, no auto-play, pause/stop/hide for moving content; no flashing |
| A11Y-07 | M | Captions and transcripts for video; audio description where applicable |
| A11Y-08 | S | Dark mode and high-contrast theme; large-text mode; simple-mode layout |
| A11Y-09 | S | Plain language (reading level ~grade 8), consistent iconography with labels |
| A11Y-10 | S | Form accessibility: labels, error summaries, input purpose (autocomplete) |
| A11Y-11 | S | Testing: axe/lint (jsx-a11y) in CI, manual screen reader test plan, user testing with older adults and disabled users |

---

## 16. Performance, offline and reliability

| ID | Priority | Requirement |
| --- | --- | --- |
| PERF-01 | M | Mobile web vitals: LCP <2.5 s, INP <200 ms, CLS <0.1 on mid-range Android over 4G; JS budget per route |
| PERF-02 | M | PWA: installable, service worker with versioned caching, offline fallback, update prompt without data loss |
| PERF-03 | M | Offline-capable content: boarding pass, itinerary, daily plan, deck plans, menus, bookings, documents, emergency info |
| PERF-04 | M | Resilience on high-latency, intermittent satellite links: request timeouts, retries with backoff, optimistic UI, outbox for deferred actions |
| PERF-05 | S | Background sync (where supported), cached images, image formats (AVIF/WebP), lazy loading |
| PERF-06 | S | Graceful degradation when APIs are down (e.g. show cached bookings with "last updated" stamp rather than blank/"missing" booking — directly addresses a top Princess complaint) |
| PERF-07 | S | Observability: crash/error reporting, performance RUM, feature flags, A/B testing |
| PERF-08 | M | Battery and data frugality (reduce wake locks and polling; critical on ships) |

---

## 17. Privacy, security and compliance

| ID | Priority | Requirement |
| --- | --- | --- |
| SEC-01 | M | Data minimisation, encryption in transit and at rest, secure sessions, CSRF/XSS protections, CSP |
| SEC-02 | M | PCI DSS scope reduction: hosted fields/tokenisation; never store PAN |
| SEC-03 | M | Passport/ID and biometric photo handling: purpose limitation, retention limits, encryption, access logs, deletion after sail + statutory period |
| SEC-04 | M | Regulatory: GDPR/UK GDPR, CCPA/CPRA, PIPEDA, Australian Privacy Act, COPPA (kids under 13), consent management, cookie banner |
| SEC-05 | M | Location: explicit opt-in, purpose explained, easy off switch, retention limits |
| SEC-06 | S | Fraud and abuse controls: bot protection, rate limiting, account takeover protection, suspicious-login alerts |
| SEC-07 | S | Health data (e.g. medical declarations): treat as sensitive, minimal and segregated |
| SEC-08 | S | Accessibility and privacy of minors' data (parent-managed) |
| SEC-09 | S | Audit trail for contract acceptance and consent |
| SEC-10 | S | Responsible disclosure policy and periodic pen test |

---

## 18. Content, marketing and analytics

| ID | Priority | Requirement |
| --- | --- | --- |
| CNT-01 | M | CMS-driven content: destinations, ships, ports, venues, FAQs, with editorial workflow, localisation, and image alt text |
| CNT-02 | S | Personalised offers and merchandising by journey stage and loyalty tier, with caps (avoid spam), suppression after purchase |
| CNT-03 | S | Analytics: funnels (search → book), check-in completion, feature usage; privacy-respecting, consent-based |
| CNT-04 | S | Experimentation framework; accessibility-safe tests |
| CNT-05 | S | SEO and shareability for public pages (SSR/prerender considerations, Open Graph) |
| CNT-06 | C | User-generated content moderation (reviews, photos) |

---

## 19. Notifications and communications

| ID | Priority | Requirement |
| --- | --- | --- |
| NOT-01 | M | Transactional email and SMS (booking confirmation, payment due, itinerary change, check-in reminder) |
| NOT-02 | S | Web push for installed PWA (iOS requires Home Screen install; Android Chrome supports directly) with categories and quiet hours |
| NOT-03 | S | In-app notification inbox with history; deep links to relevant screen |
| NOT-04 | S | Notification relevance: no more than N marketing messages per week; transactional exempt |
| NOT-05 | S | On-ship notifications limited by connectivity: queue and deliver on reconnect; local notifications for scheduled reminders via service worker where supported |

---

## 20. Platform constraints (web/PWA reality check)

| Capability | Web/PWA feasibility | Notes |
| --- | --- | --- |
| NFC tap (door unlock, pay) | **No** on iOS; limited Web NFC on Android Chrome (read/write tags only) | Use Medallion/keycard hardware; the app shows status only |
| Bluetooth LE (medallion-like location) | Web Bluetooth not on iOS Safari | Location-based features depend on ship systems/Medallion; app can show server-provided location |
| Background location | Not available to PWAs | Use foreground only, or server-fed ship location |
| Push notifications | Android: yes. iOS 16.4+: only for Home Screen-installed PWAs | Requires onboarding to prompt install |
| Offline | Service workers, IndexedDB, Cache Storage | iOS evicts storage after ~7 days of non-use for non-installed sites; installed PWAs are more durable |
| Camera / document scan | getUserMedia supported; OCR must be on-device (WASM) or server | Privacy: prefer on-device processing |
| Wallet passes | Apple Wallet/Google Wallet via .pkpass / links | Needs backend pass generation |
| Biometric login | WebAuthn passkeys supported | Good fit for ACT-01 |
| Payments | Payment Request API / Apple Pay on web | Hosted fields for PCI |
| Background sync | Chromium only | Must degrade gracefully |
| App store presence | Not by default | Option: wrap as TWA/Capacitor later if required |

**Critical dependency:** The product needs **APIs from Princess/Carnival Corp** (bookings, inventory, pricing, check-in, folio, reservations, messaging, ship location). We do not have these. Until access is secured, the application will use a **mock/sandbox backend** with realistic fixtures and clean API contracts so we can swap in real services. This is the largest scope and feasibility risk and should be a decision point (Q1 below).

---

## 21. Proposed delivery phases

Aligned with the project's rule: build one phase, commit, stop. Each phase includes tests and accessibility checks.

| Phase | Theme | Contents |
| --- | --- | --- |
| **0** | Foundations | Project scaffold, design system (tokens, components, themes), routing, PWA shell, accessibility baseline, mock API layer and domain models, i18n |
| **1** | Discover | DIS-01…DIS-05, DIS-08, DIS-11, destinations/ships/itineraries with mock data, search & compare |
| **2** | Account & My Trips | ACT-01…03, MNG-01…05, MNG-14, SUP-01/02 |
| **3** | Book | BOK-01…08, BOK-18/19 |
| **4** | Pre-book & personalise | PRE-01…03, PRE-06, PRE-15, MNG-07/08/10 |
| **5** | Check-in & embarkation | CHK-01…05, CHK-08, CHK-12 |
| **6** | Onboard core | OB-01…04, SAF-01/02, DIN-01/02, POR-01…03, ACC-01, MSG-01/02, offline |
| **7** | Onboard extended | DIN-04/05 (ordering), ENT, SHP, ROM, NET, kids' tools |
| **8** | Disembark & post-cruise | DEB-*, POS-* |
| **9** | AI concierge & delight | DIS-09, SUP-03, PRE-12, POS-03 |
| **10** | Hardening | Performance, a11y audit, security review, observability |

---

## 22. Open questions for you

1. **Backend/API access.** Do we have (or expect to get) access to Princess APIs? Or is this a standalone concept/prototype with mock data? (Determines the entire integration strategy.)
2. **Positioning.** Is this an official Princess product, an independent concept/redesign, or a portfolio demonstration? (Affects branding, logos, trademark use, and content.)
3. **Scope of "soup to nuts".** Do you want booking/payment implemented end-to-end (mock), or the booking flow as a UI only?
4. **Hardware.** Should we assume the Medallion/keycard remains the door/payment device and the app integrates with its data, or should we design for a phone-only experience?
5. **Markets and languages.** US-only English first, or multi-region from day one?
6. **Auth.** Passkeys + email, or integration with an existing Princess/Carnival identity?
7. **Priority of experiences.** Which journey stage should be the showpiece? (My recommendation: onboard daily-planner + offline + free messaging, and a best-in-class check-in flow, since these are Princess's biggest weaknesses.)
8. **AI.** Should the concierge (DIS-09/SUP-03) be in scope? If so, with what model/provider and guardrails?
9. **Persona priority.** Do you want to optimise first for older repeat guests, families, or first-timers?
10. **Brand/design.** Do you have visual direction (Princess brand blue, "Come Back New" tone, fonts), or should I propose a design language?
11. **Crew/admin side.** Out of scope, or do you want a minimal staff console for chat and requests?
12. **Competitor features to emphasise.** Free chat, Find-My-Kid, smart-room control, photo browsing, virtual queues: which of these should be headline features?

---

## Appendix A — Sources

Princess
- Princess MedallionClass: https://www.princess.com/ships-and-experience/princess-medallionclass
- CruiseWeb, Princess Medallion guide: https://cruiseweb.com/blog/princess-cruises-medallion-guide
- Seatrade, OceanMedallion all-in-one app: https://www.seatrade-cruise.com/information-technology/oceanmedallion-cruising-gets-simpler-with-all-in-one-app
- Travel Weekly, new Princess app (page not retrievable; summarised via search): https://www.travelweekly.com/Cruise-Travel/Princess-Cruises-says-onboard-app-new-and-improved
- Princess AI planning app (ChatGPT, 28 Sep 2026): https://cruiseindustrynews.com/cruise-news/2026/09/princess-launches-ai-powered-cruise-planning-app/
- Princess AI planning app in Claude (5 Oct 2026): https://cruiseindustrynews.com/cruise-news/2026/10/princess-ai-cruise-planning-app-debuts-in-claude/
- Plus/Premier terms: https://www.princess.com/cruise-deals-promotions/plus-premier-cruise-packages/terms-and-conditions
- Plus vs Premier: https://www.cruiseweb.com/blog/princess-plus-vs-princess-premier
- Captain's Circle benefits: https://www.princess.com/content/dam/pdf/captains-circle-loyalty-benefits.pdf
- User complaints (Trustpilot, Cruise Critic, ProductReview, Trip Bacon): https://ie.trustpilot.com/review/www.princess.com?page=4 · https://www.ajust.com.au/businesses/princess-cruises-complaints · https://www.tripbacon.com/videos/cruise-news-princess-app-problems-carnival-changes-a-big-announcement-tonight-lets-go-travel-tips

Competitors
- Royal Caribbean app: https://www.royalcaribbean.com/guides/5-ways-royal-caribbeans-app-changes-cruising · https://www.royalcaribbeanblog.com/2024/12/31/royal-caribbean-best-app (not retrievable directly; summarised via search)
- Carnival HUB: https://www.cruisehive.com/18-must-know-things-about-carnival-hub-app/22834 · https://cruzely.com/the-complete-guide-to-carnivals-hub-app/
- Cross-line comparison: https://www.cruisecritic.com/articles/cruise-apps-you-need-right-now · https://thepointsguy.com/cruise/best-cruise-apps · https://www.cruisebooking.com/articles/first-time-cruisers/ultimate-guide-to-the-best-cruise-apps
- Virgin Voyages: https://www.virginvoyages.com/app · https://vvinsider.com/virgin-voyages-app-update-introduces-new-planner-tab/ · https://vvinsider.com/virgin-voyages-rolls-out-virtual-dining-queues-across-the-fleet/

## Appendix B — Research gaps to close next

- Direct review of the live Princess app (App Store/Play listing text, screenshots, release notes) to confirm which features are web vs native, and what the "new" app actually shipped with.
- Princess website booking flow (steps, fields, pricing presentation).
- Royal Caribbean, Celebrity, NCL, Holland America, Viking and MSC apps — only partially covered; Viking, Holland America, MSC and Celebrity detail is thin or absent.
- Post-cruise practices at Princess and competitors (surveys, FCC, rebooking) — little found.
- Accessibility features of existing cruise apps (largely undocumented in sources).
- Regulatory details per market (health declarations, advance passenger info) — to be validated with Princess compliance.
