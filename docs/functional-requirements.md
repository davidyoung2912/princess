# Princess Cruises Guest Web App — Functional Requirements (Draft v0.1)

Status: **Draft v0.9 — scope decisions recorded (§22, including round five in §22.7); single vessel = Sun Princess, single cruise = 7-night Western Caribbean with Mexico from Fort Lauderdale (§22.6; see `sun-princess-ship-profile.md`). Round-five research gap analysis (§23) approved. No code has been written.**
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

### 4.1 Demo accounts (mock, all with established Princess/Carnival accounts)

Fictional people and names. Every account already exists with Captain's Circle membership, saved profile, payment method, passport on file (fictional data) and a booking on the single supported cruise (§22.6). The scenario switcher moves each account through journey stages independently.

**Solo / independent personas** (do not interact with anyone else in the app)

| Persona | Name | Profile | Status / booking |
| --- | --- | --- | --- |
| Platinum repeat guest (primary, older repeat guest) | **Gerald Whitfield**, 71 | Retired engineer, 18 prior Princess cruises, prefers large text (**default text size "Large"**, §22.7), traditional dining, phone-call fallback, specialty-dining regular; has a simulated family **helper** (e.g. his son) who can manage bookings on his behalf with consent | Captain's Circle Platinum; balcony stateroom |
| First-timer | **Maria Delgado**, 38 | Nurse, first cruise, anxious about logistics, price-conscious, cruising solo | New account, Gold-eligible after sailing; interior or oceanview stateroom |
| Accessibility guest | **Linda Okafor**, 66 | Wheelchair user, travels with a mobility scooter; needs accessible stateroom, accessible routes, tender assistance, assistance requests | Ruby; accessible balcony stateroom (one of the 51 accessible rooms) |
| Sanctuary suite guest | **Alexander Reyes**, 54 | Business owner, premium traveller | Captain's Circle Elite; Sanctuary Collection Mini-Suite with Premier bundle |

**The two linked families** (friends who share a travel group, activities and messaging; they interact with each other only)

*The Harper family* (Family A)

| Role | Name | Age | Notes |
| --- | --- | --- | --- |
| Father (booker, account holder) | **Daniel Harper** | 41 | Software manager; organiser of the shared trip; Ruby |
| Mother | **Priya Harper** | 39 | Dietary: vegetarian; wants spa time |
| Son | **Ethan Harper** | 14 | Teen: The Underground; has own supervised account |
| Daughter | **Maya Harper** | 8 | Neon Grove (ages 8–12); nut allergy (exercises allergy flows) |

*The Brennan family* (Family B)

| Role | Name | Age | Notes |
| --- | --- | --- | --- |
| Father (booker, account holder) | **Marcus Brennan** | 43 | Teacher; enthusiastic about excursions; Gold |
| Mother | **Elena Brennan** | 40 | Pharmacist; wants quiet time; interested in wine and spa |
| Son | **Lucas Brennan** | 6 | Firefly Park (ages 3–7) |
| Daughter | **Sofia Brennan** | 11 | Neon Grove (ages 8–12) |

Together the kids cover all three youth venues (Firefly Park, Neon Grove, The Underground), which exercises Find-My-Kid, club check-in/out and age gating.

**Staterooms (illustrative):** Harpers: two connecting balcony staterooms. Brennans: one family-size balcony stateroom plus an adjoining interior or oceanview for the children, to show different cabin arrangements. Family members hold individual Medallion identities; the booker sees and manages the party.

**Interaction rules**
1. The Harpers and Brennans form one **linked travel group** ("friends travelling together"). Members can see each other's shared itinerary items, join each other's excursions, dining reservations and show plans, use free group and one-to-one chat, and (with consent) share location.
2. Parents control what their children can see and share; children (Ethan 14, Sofia 11, Maya 8, Lucas 6) have age-appropriate accounts: teens can message approved contacts, under-13s cannot chat freely and are visible to parents through Find-My-Kid.
3. **Solo personas are isolated**: Gerald, Maria, Linda and Alexander never appear in the families' contacts, chats, group plans or location sharing, and the families do not appear in theirs. Cross-persona realism (other guests on the ship) is simulated by the mock layer as anonymous crowd data only.
4. All other travellers, crew and Guest Services contacts are simulated (scripted or AI-backed).

**Resulting requirements**
- ACT-05 (household/companion accounts) and MNG-16 (travel party coordination) are raised to **Must** and are demonstrated by the families.
- A **linked travel group** concept (distinct from a booking party) is required: invite, accept, permissions per member, per-child controls, leave group.
- MSG-01 includes group chats (families together, parents only, kids), with parental supervision rules and age gating (MSG-05).
- DIN-09, PRE-13 and ENT-07 (group dining, shared itinerary, social) are raised to **Should** and are exercised by the families.
- A persona switcher in demo mode signs in as any of the 12 people; chat and shared plans update across the two families' accounts using local storage/BroadcastChannel.
- One person per device is the real-world model; the switcher is a demo-only control.

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

**Critical dependency:** The product needs **APIs from Princess/Carnival Corp** (bookings, inventory, pricing, check-in, folio, reservations, messaging, ship location). We do not have these. **Decision (§22):** the application uses a **mock API layer** with realistic fixtures, IndexedDB persistence and clean contracts, so real services could be swapped in later.

---

## 21. Proposed delivery phases

Aligned with the project's rule: build one phase, commit, stop. Each phase includes tests and accessibility checks.

| Phase | Theme | Contents |
| --- | --- | --- |
| **0** | Foundations | Project scaffold, design language proposal and system (tokens, components, themes), routing, PWA shell, accessibility baseline, mock API client + IndexedDB persistence, demo clock/scenario switcher, string externalisation |
| **1** | Discover | DIS-01…DIS-05, DIS-08, DIS-11, destinations/ships/itineraries with mock data, search & compare |
| **2** | Account & My Trips | ACT-01…03, MNG-01…05, MNG-14, SUP-01/02 |
| **3** | Book | BOK-01…08, BOK-18/19 |
| **4** | Pre-book & personalise | PRE-01…03, PRE-06, PRE-15, MNG-07/08/10 |
| **5** | Check-in & embarkation | CHK-01…05, CHK-08, CHK-12 |
| **6** | Onboard core | OB-01…04, SAF-01/02, DIN-01/02, POR-01…03, ACC-01, MSG-01/02, offline |
| **7** | Onboard extended | DIN-04/05 (ordering), ENT, SHP, ROM, NET, kids' tools |
| **8** | Disembark & post-cruise | DEB-*, POS-* |
| **9** | AI concierge & delight (Claude API; see §22.2) | DIS-09, SUP-03, PRE-12, POS-03 |
| **10** | Hardening | Performance, a11y audit, security review, observability |

---

## 22. Scope decisions (answered) and resulting constraints

| # | Question | Decision |
| --- | --- | --- |
| 1 | Backend/API access | **None.** All data is mock. A simulated API layer (async, with latency and failure injection) returns fixture data; user-provided data persists in browser storage. No real backend is built. |
| 2 | Positioning | **Independent concept/redesign.** Use Princess colours, logos, imagery and gathered content to feel real. Show a clear "unofficial concept, not affiliated with Princess Cruises" notice. |
| 3 | Scope of "soup to nuts" | **All phases end to end**, including booking and payment, against the mock API. |
| 4 | Hardware | **Medallion/keycard remains the door and payment device.** The app reads/displays its data (status, charges, location as supplied by ship systems) and never replaces it. |
| 5 | Markets/languages | **US English only.** Keep strings externalised so i18n can be added later (cheap now, costly later). |
| 6 | Auth | **Assume the existing Princess/Carnival identity** (mocked), behind an auth-provider abstraction so passkeys, email/password, magic link and SSO options can be configured as the industry offers. |
| 7 | Showpiece | **Onboard daily planner + offline + free messaging, and a best-in-class check-in flow.** |
| 8 | AI concierge | **In scope** (DIS-09, SUP-03). See §22.2 for the API key handling. |
| 9 | Persona priority | **Older repeat guests first**, while every persona (§4) must be properly served. |
| 10 | Brand/design | Borrow Princess colours, icons and imagery, but pursue a **new UX design not bound by existing Princess design constraints**. A design language will be proposed in Phase 0. |
| 11 | Crew/admin | **Out of scope.** Crew-side behaviour (chat replies, request fulfilment, queues) is simulated by the mock layer. |
| 12 | Competitive headline features | **All five are headline features**: free chat, Find-My-Kid, smart-room control, photo browsing, virtual queues. |

### 22.1 Consequences of the mock-only, local-storage approach

| Area | Implication | Handling |
| --- | --- | --- |
| Storage limits | localStorage is ~5 MB and synchronous; photos/documents will not fit | Use IndexedDB for structured data, photos and documents; localStorage only for small settings. Request persistent storage; handle quota errors |
| Eviction | Safari may evict storage for sites unused ~7 days (less so when installed) | Prompt install; offer export/import of "my data" backup; versioned schema with migrations |
| Single device | No cross-device sync or real multi-user | Offer a "reset demo" and "load scenario" control (e.g. pre-booking, day 3 at sea, disembarkation day) so every stage can be demoed. Time can be simulated (a "demo clock") |
| Free messaging | Real guest-to-guest chat is impossible without a server | Simulate travel-party members and crew as scripted/AI-backed contacts; use BroadcastChannel so two tabs can chat to demonstrate behaviour. Architecture keeps a transport interface for a real service later |
| Find-My-Kid / locator | No real location source | Simulated ship positions on deck plans from the mock layer, with the same consent and privacy UX as the real thing |
| Smart room, queues, photos | No ship systems | Mock devices, mock queue progression, and a bundled photo set with simulated face/venue grouping |
| Payments | No real processing | Mock gateway with test-card behaviours (success, decline, 3-D Secure challenge, timeout). Never collect or store real card numbers; show a "demo payments only" notice and block real PANs |
| Passports/IDs | Real personal documents must not be stored casually | Warn users to use fictional data; keep on-device only; offer one-click wipe |
| Auth | Identity is mocked | Mock identity provider with demo accounts per persona and per loyalty tier; no real credentials |
| Contract fidelity | Mocks tend to be unrealistically perfect | Mock layer includes latency, intermittent failures, offline behaviour and the real-world failure modes found in research (e.g. booking temporarily not loading) so the resilience requirements (PERF-04/06) are genuinely exercised |

No concern with this approach for a concept/demo; the items above are the main design consequences. Keeping a clean API client interface means the mock can later be swapped for real services.

### 22.2 AI concierge and the API key

- **A browser-only app cannot keep an API key secret.** Any key bundled into client code, or called directly from the browser, can be read by any visitor. This is the main concern with the AI scope.
- **The key was pasted into the chat and has intentionally not been written into this document or the repository.** Because it appeared in plain text, treat it as exposed and consider rotating it.
- Proposed handling, for you to confirm:
  1. Keep the key out of source control (a git-ignored `.env.local`, or entered by the user at runtime in a settings screen and held only on their device).
  2. For local development, call the API through a small dev-only proxy so the key never ships in the production bundle. A deployed demo would need a real proxy/serverless function; if that is unwanted, the concierge can run in a "bring your own key" mode, or fall back to a scripted mock concierge when no key is present.
  3. Guardrails: grounded only on app data (itineraries, ships, ports, venues, the guest's own mock bookings) via tools; no real booking/payment actions without an explicit confirmation step; refuse medical/legal/safety-critical advice and hand off to the simulated crew/Guest Services; visible "AI-generated" labelling; conversation history stored on device and clearable; spend/rate limits.
  4. Model choice to be set in configuration; default to a current Claude model chosen when Phase 9 starts.

### 22.3 Requirement adjustments from these decisions

| ID | Change |
| --- | --- |
| ALL | Backed by a mock API client + IndexedDB persistence; every requirement is satisfied against mock data |
| ACT-01 | Mock Princess/Carnival identity with pluggable auth methods; demo personas |
| ROM-05 | Smart-room control raised from **C to S** (headline feature), implemented against mock devices |
| SAF-05 / ENT-04 | Find-My-Kid raised to **S, headline**: parent-set kid zones, last-seen location on deck plan, geofence alerts, club check-in/out |
| SHP-02 | Photo browsing raised to **S, headline**: by day/venue/person, favourites, purchase flow (mock) |
| DIN-02 | Virtual queues raised to **S, headline**: join/leave, live position and ETA, "your table is ready" alert |
| MSG-01 | Free chat is a headline **M**; includes travel party, friends and Guest Services |
| NET-01 | Messaging and all app functions must work without paid internet; offline outbox applies |
| ACS-* / A11Y-* | Older repeat guests first: default-large text option, simple mode, high contrast, minimal-gesture navigation, phone-call fallback visible |
| ACC-09 / CHK-11 | Medallion/keycard stays the physical device; app shows its status, charges and activation only |
| DIS-18 | US English, USD only for v1 |
| CNT-01 | Content from public Princess material and mock fixtures; branding disclaimer shown |
| SEC-02 / SEC-03 | Reframed for a demo: no real card/passport data stored; warnings and wipe controls |

### 22.4 Round-two decisions

| Question | Decision |
| --- | --- |
| API key handling | User suggested inlining the key. **Recommendation, adopted unless you object:** read it from a Vite env variable (`VITE_ANTHROPIC_API_KEY`) in a git-ignored `.env.local`, never in source. Inlining would commit the key to the GitHub repo (already pushed). Either way the key is visible in the browser bundle; env use avoids leaking it through git history. A server-side proxy remains a later hardening step. If no key is set the concierge falls back to a scripted mock. |
| Scenario switcher and demo clock | **Yes to both.** |
| Design language | **Proposed first and reviewed by you before any component code.** Phase 0 begins with a design-language document, not code. |
| Real vs sample content | **Deep research on Sun Princess as the single supported vessel**, captured in `sun-princess-ship-profile.md`. Remaining content (cabins, prices, schedules, itineraries) is authored as representative fixtures and flagged as illustrative. |

**Single-vessel consequences**
- One ship profile: the deck plan, venues, capacities, staterooms and entertainment come from the ship profile.
- Discover/Book: ship comparison (DIS-03) is reduced to Sun Princess vs "other Princess ships" teaser content; itineraries are all Sun Princess sailings.
- Onboard features (daily planner, queues, Find-My-Kid zones, smart room, photos) are designed against the real Sun Princess venue geography.
- Sanctuary Collection (215 staterooms) entitlements are a first-class segment.

### 22.5 Round-three decisions

| Question | Decision |
| --- | --- |
| Demo accounts | **Originally five personas; revised in §4.1:** four solo personas (Gerald Whitfield, Maria Delgado, Linda Okafor, Alexander Reyes) plus **two linked families of four** (Harper, Brennan) = 12 people, all with existing mock Princess/Carnival accounts. Each has seeded bookings, preferences and a loyalty tier; the scenario switcher moves any of them through the journey stages. |
| Main demo cruise | **7-night Western Caribbean with Mexico, round trip Fort Lauderdale, Sun Princess** (§22.6). |
| Imagery | **Use real Princess web imagery** and gathered content for the concept. Handling notes: (1) the repo is on GitHub, so avoid committing bulk copies of copyrighted images; prefer referencing the source URLs, or keep downloaded assets in a git-ignored folder with a manifest recording each image's source URL; (2) keep the "unofficial concept, not affiliated with Princess Cruises" notice visible; (3) alt text for every image (A11Y); (4) offline/PWA caching of remote images needs care (cross-origin opaque responses), so key images used offline are best bundled locally and kept out of git. |

**Still open (minor, can be decided during Phase 0):** ~~primary persona's default text size, the exact set of demo sailing dates~~ (both answered in §22.7), and the final design language (to be proposed for your review before any component code).

### 22.5a Round-four decisions

| Question | Decision |
| --- | --- |
| Cruise choice and dates | **Confirmed.** 7-night Western Caribbean with Mexico, reference sailing 21–28 Mar 2027; mock dates and port order/times are acceptable. |
| API key | **Confirmed.** The provided key is stored in a git-ignored `.env.local` as `VITE_ANTHROPIC_API_KEY` and read at runtime via `import.meta.env`. For deployment, the same variable is set in Vercel's environment settings. The key is not in source control or in these docs. Note: any `VITE_` variable is bundled into the browser build, so the key is visible to site visitors once deployed; the earlier advice to rotate it, and eventually to move calls behind a server-side function, still stands. A `.env.example` (no key) will be added in Phase 0. |
| Phase order | **Natural journey order**: Discover, Book, Pre-book, Check-in, Onboard, Disembark/Post-cruise, then AI and hardening (§21 stands as written). |
| Ship data gaps | **Mock it so it feels real.** Specialty-restaurant prices, stateroom categories and codes, the show lineup, the deck plan and daily programmes are authored fixtures; they need to be plausible and internally consistent, not factual. They are not marked illustrative in the UI beyond the concept disclaimer. |

### 22.6 Single-cruise scope

**Decision:** guests can only book the **7-night Western Caribbean with Mexico**, round trip Fort Lauderdale, on Sun Princess (reference sailing 21–28 Mar 2027: sea day, Cozumel, Belize City (tender), Roatán, two sea days). Popularity could not be verified from sources; the choice is a judgement (see ship profile §11.1) and is easy to change because the mock data is fixture-driven.

| Area | Change |
| --- | --- |
| DIS-02, DIS-03, DIS-04 | Destination/ship/cruise search collapses to one featured cruise and ship; no filters or comparison. Browse = the cruise, the ship, the ports, the sailing dates |
| DIS-06 (quiz), DIS-08 (compare list), DIS-10 (alerts) | Reduced: quiz recommends cabin category/packages instead of cruises; price alert applies to the one cruise |
| BOK-14, BOK-15 | Cruisetours and air/hotel packages dropped (W); optional pre/post hotel and transfer add-ons only as simple mock upsells |
| BOK | Booking = choose sailing date, cabin category/cabin, guests, fare/package, extras, pay |
| Sailing dates | 6 to 8 mock 7-night departures, one every 1 to 2 weeks, Nov 2026 – Mar 2027 (reference sailing 21–28 Mar 2027; §22.7) so booking, pre-cruise countdown, and past/post-cruise can all be demonstrated, with the scenario switcher and demo clock selecting the stage |
| Itinerary changes (MNG-15) | Retained as a demo scenario (e.g. port swap) |
| Ports | Only Cozumel, Belize City (tender), Roatán, plus Fort Lauderdale; port guides and excursions authored for these |
| POS-06 Rebooking | Rebook the same cruise (different date), plus a teaser for "other Princess voyages" |
| Phase 1 | Re-scoped from "Discover" to "Discover the cruise and ship" |

### 22.7 Round-five decisions (answers to the §23 questions)

| # | Question | Decision |
| --- | --- | --- |
| 1 | Gerald's default text size | **"Large" by default for Gerald**; every persona can change text size in settings. Other personas default to standard. |
| 2 | Demo sailing dates | **6 to 8 mock departures**, roughly one every 1 to 2 weeks between Nov 2026 and Mar 2027, with **21–28 Mar 2027 as the reference sailing**. All mock. Departures before the demo clock's date are past sailings; the demo clock and scenario switcher select the stage. |
| 3 | Design language | **Agreed.** Phase 0 starts with a design-language document (proposed direction: warm navy and gold based on Princess colours, large type, generous spacing) for review before any component code. |
| 4 | New Must items from §23 | **Approved**: UX-01, UX-02, OB-08, DIN-10, CHK-13, CHK-14, SUP-08, POR-11, PRE-16, and the promotions of POR-04 and MNG-11 to Must. The remaining §23.4 items stand at their stated priorities. |
| 5 | Offer restraint (UX-02) | **Yes, strict.** No countdown-pressure timers or false scarcity, even though the real app uses them. It is a deliberate differentiator. |
| 6 | Helper role (INC-01) | **Yes, in scope** (not deferred). A family member can manage bookings for another guest with that guest's consent. Demo case: a simulated helper account for Gerald (a family member such as his son). This is a seventh relationship type in the account model, in addition to booker/party member and linked-group member; the helper is simulated and is not a thirteenth full persona. Raised in the account model alongside ACT-05 and SUP-07, and scheduled for Phase 2. |
| 7 | Printable views | **Yes, a real feature.** Daily plan, boarding pass, itinerary and excursion tickets get print layouts (plain CSS, large-print option). INC-01 is therefore firm for printing. |
| 8 | "Verify" facts | **Authored as plausible content** (passport rules, terminal number, time-zone behaviour), covered by the concept disclaimer; no extra visible flag in the UI. |
| 9 | Commit | Done at the user's request; changes committed and pushed. |
| 10 | API key | The provided key continues to be used for now (git-ignored `.env.local`, as in §22.5a); the user will rotate it on a regular basis. `.env.example` (no key) is added in Phase 0. |

---

## 23. Round-five research: gap analysis for a best-in-class experience

Purpose: test whether §5–§19 are sufficient for a best-in-class guest experience, using fresh research on the live Princess app, competitors, guest complaints and the specific cruise. Findings are mostly from App Store listings, trade press and cruise blogs/forums, so treat them as indicative; items marked **(verify)** need a check.

### 23.1 What the new research found

**Princess app, current state (Oct 2026)**
- A major redesign shipped 30 Jun 2026 (v1.10: new navigation bar, renamed tabs, simplified terminology, promotional offers with countdown timers, shore-excursion browsing for back-to-back cruisers). v1.11 (Oct 2026) added a credit-card application, login redesign and email-verified account creation. Apple Wallet boarding pass arrived in v1.9. iPhone App Store rating is about 3.1 from ~4.5K ratings.
- Current feature list includes OceanReady, dining, Plus/Premier purchase, excursions, spa, OceanNow, Safety Essentials, shipmate location, bookmarks, "CrewCall" 24/7 chat, and live spend/package tracking.
- Recent review complaints: key features buried several menu levels deep; events cannot be sorted; one unavailable item blocks a whole food order; drink delivery 30–45 minutes with no way to contact anyone about the order; photo download errors and photo packages purchasable without selecting photos; rescheduling a dinner left the guest with no booking and unable to book any slot; lost check-in data and payment methods with hard-to-reach support; app feels like it promotes upsells over required tasks.

**Competitors (new items not already in §3)**
- Royal Caribbean: escalating "all aboard" alert in the final hour (Mar 2026), casino rewards tracking, digital keycard, digital safety drill, ship/destination badges, and app room-service ordering still being piloted (beta charged $7.95 + 18%).
- MSC for Me: free on-ship chat with no internet package; internet-usage management in-app.
- Virgin Voyages: the Planner (schedule + personal agenda + excursions in one view) shipped with bugs, including missing evening events and empty schedules, which shows how quickly trust is lost when a schedule is wrong.
- Holland America: mixed reviews citing login failures, unreliable connectivity and missing features after a rebuild.

**Cross-line guest pain points**
- Reliability before boarding (the app is needed just to board), reachable humans for urgent non-medical problems (e.g. a key that fails), an option for guests who do not use the app, and the risk that heavy app dependence disadvantages less tech-savvy guests.

**This cruise specifically**
- Fort Lauderdale round trip with Mexico is a "closed-loop" cruise: US citizens can generally sail with a birth certificate plus photo ID (a passport is still strongly recommended); non-citizens need a passport. Sources conflict on Belize and Honduras passport rules **(verify)**; the app should present a clear per-guest document requirement and the safe recommendation.
- Belize City is a tender port (ship anchors roughly five miles out; boats take about 15–20 minutes); ship-sponsored excursions usually tender first; tender tickets are issued at Guest Services/tender area. Roatán can tender depending on port congestion; Cozumel has multiple piers, so which pier and walking distance vary by day.
- Princess uses Port Everglades Terminal 2 (Terminal 4 when two Princess ships are in port) **(verify)**; bags should be dropped with porters before parking; porters are port employees and expect tips; no luggage storage; staterooms are often not ready on arrival; arrival windows exist to stagger crowds.
- Time zones: in March 2027 Florida is on daylight time (from 14 Mar) while Cozumel (EST all year), Belize and Roatán (CST all year) do not change, so ship time, local time and phone time can all differ **(inferred; verify)**. This is a real missed-ship risk and a differentiator if handled well.
- Plus/Premier pricing rose $5 per person per day for sailings from 13 Oct 2026 (Sun Princess: Plus $75, Premier $110; earlier purchases are price-honoured). Plus includes up to 15 drinks per day (capped $15 each), four casual specialty meals, room service, gratuities, one-device Wi-Fi; Premier is unlimited drinks (capped $20), unrestricted casual and specialty dining, up to four Wi-Fi devices, and up to $300 excursion credit **(verify package terms; sources conflict on Wi-Fi)**. Mock fixtures should use these numbers.
- Dine My Way access is loyalty-gated: Elite and Platinum guests can reserve main and specialty dining at booking, others after full payment; Anytime Dining guests are not assigned a time; guests can select travel companions to coordinate. This affects Gerald (Platinum) versus Maria and the families.
- Accessibility services often need advance notice (large-print/Braille menus and daily plans 30–60 days, other requests 45–90 days at some lines); tenders are a known barrier for wheelchair users; companion policies differ.
- Health: about half of cruise medical patients are over 65; ship doctors ask guests to report vomiting/diarrhoea immediately rather than self-treat; medical centre hours are limited and fees are not usually covered by home insurance.
- Post-cruise practice at Princess is thinly documented; other lines convert leftover future-cruise credit to onboard credit and offer reduced deposits/onboard credit for booking at sea.

### 23.2 Verdict

The existing requirements cover the **breadth** a best-in-class app needs: every stage of the journey, the five headline competitive features, accessibility, offline and the persona set. The gaps are in **depth and trust**: the research shows guests do not abandon cruise apps for lack of features but because of broken flows (lost reservations, blocked orders, empty schedules), unreachable help, buried navigation and upsell pressure. The requirements below turn those failure modes into explicit, testable requirements, and add specifics for this cruise (tender, time zones, closed-loop documents, package entitlements, loyalty-gated dining).

### 23.3 Complaint-to-requirement traceability

Each documented failure mode must have a specific requirement and a demo scenario (§23.5) that proves it is handled.

| Reported failure | Requirement(s) |
| --- | --- |
| Booking or check-in data "disappears"; payment methods lost | MNG-01, PERF-06, **CHK-13** (permanent "what we have on file" receipt) |
| Rescheduled dinner leaves no booking | **DIN-10** (atomic change: old booking held until new one confirmed) |
| One unavailable item blocks the whole order | **DIN-11** (partial availability, substitutions) |
| Delivery slow, nobody to contact about it | DIN-04, **DIN-11** (live status, contact-about-this-order, cancel/refund) |
| Events cannot be sorted; schedule wrong or missing | OB-02, **OB-08** (schedule integrity), **OB-09** (sort/filter, simple view) |
| Features buried several levels deep | **UX-01** (navigation depth budget) |
| Photo download errors; packages bought without selecting photos | SHP-02, **SHP-07** (select-before-buy, resumable downloads) |
| App is upsell-first, not task-first | **UX-02** (task-first, offer restraint), CNT-02 |
| Support chat goes unanswered; no human for urgent non-medical issues | MSG-02, SUP-02, **SUP-08** (urgent help always visible, ship phone number offline) |
| Guests who do not use the app are disadvantaged | **INC-01** (non-app parity) |
| App needed just to board; fails pre-cruise | CHK-04, PERF-03, **CHK-14** (boarding-pass failsafes) |
| Missed ship through time confusion | POR-02, **POR-11** (three clocks) |
| Tender ports hard to plan and hard for wheelchair users | POR-04 raised to **M**, **POR-12**, ACS-02 |

### 23.4 New and changed requirements

#### Trust and reliability

| ID | Priority | Requirement |
| --- | --- | --- |
| UX-01 | M | **Navigation depth budget**: any of the top 15 tasks (show boarding pass, find today's events, my reservations, order food, ask for help, my bill, deck map, call/chat Guest Services, change a dining reservation, find my family, add a package, all-aboard time, emergency info, my excursions, settings/text size) reachable in at most two taps from home. Verified by a task-path test in Phase 10 and checked at the end of every phase |
| UX-02 | M | **Task-first, offer-restrained**: required tasks (check-in, documents, payments due, safety) always outrank offers; offers live in one dedicated area plus at most one contextual card on home; no countdown-pressure timers, no false scarcity; "dismiss for this trip" on every offer; no offers on safety, emergency or checkout screens |
| OB-08 | M | **Schedule integrity**: every schedule view shows "last updated"; changed, moved or cancelled events are visibly flagged with what changed; bookmarked items notify on change; an event can never silently disappear (cancelled items remain, struck through, until the day ends); offline copy shows its age |
| OB-09 | M | **Planner usability**: sort and filter by time, venue, deck, interest, age group, accessibility and "included vs extra cost"; "happening now" and "next up" shortcuts; a one-column simple view for large text; personal agenda and ship schedule are one view (à la Virgin) with clear distinction |
| DIN-10 | M | **Atomic reservation changes**: modifying or moving a reservation holds the original until the replacement is confirmed; failures leave the guest with their original booking and a clear message; every change produces a confirmation and an entry in an audit trail the guest can see; waitlist and no-show rules shown before booking |
| DIN-11 | S | **Order resilience**: unavailable items are flagged before checkout and during preparation; the guest chooses substitute, remove item or cancel that item without losing the order; live order status with realistic ETA, a "contact about this order" action, delivery-location correction, cancel and refund rules; package entitlements applied visibly |
| SHP-07 | S | **Photo purchase integrity**: pick photos first, then see package options priced against the selection; included-with-Premier photos shown as included; downloads are resumable, retried automatically and verifiable ("12 of 12 saved"); purchase receipts and a re-download window |
| CHK-13 | M | **"What we have on file"** receipt after check-in: per guest, shows each item saved (passport, photo, card, contract, emergency contact) with timestamp and how to correct it; survives sign-out and app updates; a visible "not saved yet" state if offline |
| CHK-14 | M | **Boarding-pass failsafes**: pass cached offline and shown in simulated Wallet; printable PDF version; pass retrievable by booking number from the login screen without full sign-in; plain-language "what if my phone dies or has no signal" card; keycard/Guest Services fallback described |
| SUP-08 | M | **Urgent help always reachable**: a persistent "Get help now" action showing the ship phone number and emergency extension available offline; urgent non-medical issues (key fails, locked out, lost child, lost documents) have a dedicated path that does not rely on chat; chat shows expected response time and queue position |
| INC-01 | **M** (raised in §22.7) | **Non-app parity and low-tech support**: printable daily plan, boarding pass, excursion tickets and itinerary (large-print option); a "helper" role so a family member can view and manage bookings on someone's behalf with their consent (ties to ACT-05, SUP-07); every critical task has a documented desk or phone alternative shown in-app |

#### This cruise: ports, time and documents

| ID | Priority | Requirement |
| --- | --- | --- |
| POR-04 | **M** (was S) | Tender information is core because Belize City is a tender port: ticket groups and call times, live tender status and wait estimate, ship-excursion priority explained, return-tender planning, last tender back, weather-dependent "may switch to tender" flag for Roatán, and accessibility on tenders (see POR-12) |
| POR-11 | M | **Three clocks**: ship time, local port time and phone time shown together on port days and in the all-aboard card; a change-of-time notice when the ship clock changes; reminders always fire against ship time; "all aboard" stated in ship time with the local equivalent. Authored mock data must encode the March 2027 daylight-saving difference **(verify)** |
| POR-12 | S | **Accessible port planning**: per-port accessible route, pier or tender arrangement, accessible transport, which excursions are wheelchair-suitable, and how to request tender assistance; links to MNG-12 requests |
| POR-08 | **S** (was C) | "What if I'm late" explainer: ship-sponsored versus independent excursion guarantees, what the agent can do, what to do if the ship has left, with the contacts from POR-07 |
| POR-13 | S | **Port-day readiness checklist**: ID/sail-and-sign card, sun protection, cash, swimwear, tender ticket, all-aboard time, back-on-board route; one tap to share with the travel party |
| MNG-11 | M (was S) | **Documents engine for closed-loop cruises**: per guest by citizenship and age, show what is required (e.g. US citizens: birth certificate plus photo ID acceptable, passport strongly recommended; non-citizens: passport), with a clear recommendation, an "I have this" tracker, expiry warnings, and a flag where rules differ by country **(verify)**; local port or passenger fees explained where applicable **(verify)** |
| CHK-15 | S | **Embarkation specifics**: terminal assignment shown (Terminal 2, sometimes 4) with change alerts; "drop bags with porters before you park" guidance and tipping norms; carry-on checklist (documents, medication, swimwear, chargers); "your stateroom is ready" notification; luggage-delivered-to-cabin status; first-afternoon plan (lunch, muster, sail-away) |
| MNG-12 | S | Extend: deadline tracker for services needing notice (large-print menus/daily plans, assistive listening, accessible equipment, dietary, medical-device power); countdown with "request now" before the cut-off; confirmation visible to the guest and recorded in their profile |

#### Entitlements, loyalty and money

| ID | Priority | Requirement |
| --- | --- | --- |
| PRE-16 | M | **Entitlement engine**: one place that computes what each guest gets from fare, package (Plus, Premier), loyalty tier (Gold, Ruby, Platinum, Elite) and suite class (Sanctuary), and applies it everywhere (drink cap per beverage, casual versus specialty meals remaining, Wi-Fi devices, excursion credit, gratuities). Guests see "what's included for me" in plain words, and a running balance of used versus remaining |
| DIN-12 | S | **Loyalty-gated dining windows**: reservations open for Elite/Platinum at booking and for others after full payment (mock rules); Anytime Dining guests see no assigned time; companion selection for group dining; the app explains why a slot is not yet available and when it will be |
| PRE-17 | S | **Price-change protection**: show "your price is locked" when a package was bought before a price rise; price-drop refund or credit on add-ons (extends PRE-11); package value calculator uses the current Sun Princess figures |
| POS-06 | S | Extend rebooking: onboard-booking incentives (reduced deposit, onboard credit), conversion of leftover future-cruise credit to onboard credit, and a bookable appointment with the Future Cruise desk (deck 9 midship) |

#### Health and wellbeing

| ID | Priority | Requirement |
| --- | --- | --- |
| SAF-03 | S | Extend: medical centre hours (sea day versus port day), fee disclosure and insurance reminder, "report illness early" flow for vomiting/diarrhoea with clear isolation and meal-delivery guidance, seasickness help request, medication and device-power requests; sensitive-data handling per SEC-07 |
| SAF-08 | S | Cardiac and mobility alerts: guided "I need medical help now" path with the emergency number and cabin number ready to read aloud; designed for stress (very large buttons, minimal text) |
| MNG-19 | C | Pre-cruise health and comfort preparation: motion-sickness tips, medications to pack, travel-insurance reminders |

### 23.5 Demo scenarios the mock layer must support

The scenario switcher (§22) should include these, because each exercises a documented failure or a cruise-specific risk. Each persona in §4.1 should be steerable into at least two.

| Scenario | Exercises |
| --- | --- |
| Booking not visible after sign-in (sync lag), then recovers | MNG-01, MNG-18, PERF-06 |
| Check-in interrupted by lost connection at the passport step | CHK-02, CHK-13, NET-03 |
| Dinner reschedule fails halfway | DIN-10 |
| Food order with one item out of stock; delivery runs late | DIN-11 |
| Daily plan changes mid-day (show moved, event cancelled) | OB-08 |
| Belize tender: ticket groups, delay, weather switch for Roatán | POR-04, POR-12 |
| Ship clock change and daylight-saving mismatch on a port day | POR-11, POR-02 |
| Port skipped for weather; itinerary change with options and credit | MNG-15, SUP-06 |
| Guest running late in port; missed-ship guidance | POR-02, POR-08 |
| Phone dead or offline at embarkation | CHK-14 |
| Illness report and medical request | SAF-03 |
| Package price rise after purchase | PRE-17 |
| Photo download fails mid-way and resumes | SHP-07 |
| Child missing from expected zone | SAF-05, SUP-08 |
| Chat with Guest Services slow; escalate to phone | MSG-02, SUP-08 |

### 23.6 Experience quality bar

"Best-in-class" is made measurable so each phase can be judged against it (checked with unit and a11y tests plus manual walkthroughs; no browser automation per project rules):

1. **Two-tap rule** for the top 15 tasks (UX-01).
2. **First useful screen** after sign-in shows the single next required action (MNG-02) with no offer above it.
3. **Check-in** completable by Maria in a single sitting, resumable if interrupted, and by Daniel for all four Harpers without re-entering shared data (A11Y-05 redundant entry).
4. **Gerald test**: every top-15 task usable at the largest text size, with high contrast and a visible phone alternative, without gestures.
5. **Linda test**: every port-day and route screen shows accessibility information up front; no feature needs drag, hover or fine motor control.
6. **No dead ends**: every error state offers a next step and a human route; every offline state shows data age.
7. **Trust ledger**: nothing the guest booked, paid for, requested or saved can vanish silently; every change is visible in history.
8. **Offer restraint**: at most one contextual offer per screen and none on task-critical screens.
9. **Consistency**: one planner, one wallet of documents, one inbox, one place for help (A11Y-05 consistent help).

### 23.7 Phase impacts (§21)

| Phase | Additions |
| --- | --- |
| 0 | UX-01 and UX-02 as design-language rules; entitlement-engine data model (PRE-16); three-clock time model and demo clock (POR-11); scenario catalogue (§23.5); printable-view styles (INC-01) |
| 2 | Documents engine MNG-11; helper role (INC-01) |
| 3–4 | PRE-16, PRE-17, DIN-12, MNG-12 deadline tracker |
| 5 | CHK-13, CHK-14, CHK-15 |
| 6 | OB-08, OB-09, DIN-10, SUP-08, POR-04, POR-11, POR-12 |
| 7 | DIN-11, SHP-07, SAF-03, SAF-08 |
| 8 | POS-06 extension |
| 10 | UX-01 task-path audit, quality bar review (§23.6) |

### 23.8 Remaining uncertainty

- Several facts are from fan sites, forums and aggregators; the "verify" items (Belize/Honduras passport rules, terminal assignment, time zones, package terms, accessibility notice periods) should be confirmed before they appear as fact in the UI. Per round-four decisions they may be authored as plausible mock content; the concept disclaimer covers this.
- Unofficial Google Sites pages in the results (claiming voice-controlled cabins and AR/VR) were disregarded as unreliable.
- Viking, Celebrity and Disney app detail is still thin; the current requirements already cover their headline strengths (smart-room remote, Disney delight, youth-club registration). No further research is needed for Phase 0.

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

Round five (§23)
- Princess app on the App Store (v1.11, reviews): https://apps.apple.com/us/app/princess-cruises/id6469049279
- Princess app redesign (Jun 2026), via search summary: https://crew-center.com/princess-cruises-unveils-major-mobile-app-redesign
- Princess AI app announcement: https://www.princess.com/news/news-releases/2026/09/princess-cruises-becomes-first-global-cruise-line-to-launch-AI-powered-cruise-planning-app
- Royal Caribbean app updates (all-aboard alert, room-service pilot), via search summary: https://www.royalcaribbeanblog.com/2026/03/12/royal-caribbean-app-alert-prevent-missing-cruise-ship · https://www.royalcaribbeanblog.com/2026/09/21/royal-caribbean-testing-room-service-delivery-app-one-ship
- MSC for Me: https://www.msccruisesusa.com/en-us/Discover-MSC/MSC-For-Me.aspx
- Virgin Voyages Planner: https://vvinsider.com/virgin-voyages-app-update-introduces-new-planner-tab/
- Plus/Premier 2026 pricing: https://www.cruisemummy.co.uk/?p=12034 · https://www.cruisemapper.com/news/16653-princess-cruises-details-dining-beverage-benefits-plus-premier-packages-sun-princess
- Dine My Way: https://cruisemapper.com/news/8862-princess-cruises-introduces-new-medallionclass-enhancement-dine-my-way
- Closed-loop cruise documents: https://www.afar.com/magazine/what-is-a-closed-loop-cruise · https://www.royalcaribbeanblog.com/2025/11/07/cruise-without-passport
- Belize tender discussions: https://boards.cruisecritic.co.uk/topic/2094023-tendering-in-belize/
- Port Everglades logistics: https://www.cruisecritic.com/articles/port-everglades-cruise-port-parking-address-amenity-info
- Cruise accessibility overview: https://cluballiance.aaa.com/the-extra-mile/articles/prepare/travel/cruise-passengers-with-disabilities
- Cruise health overview: https://kffhealthnews.org/aging/how-cruise-ship-passengers-should-prepare-for-sickness-or-injury-at-sea/

## Appendix B — Research gaps to close next

- Direct review of the live Princess app (App Store/Play listing text, screenshots, release notes) to confirm which features are web vs native, and what the "new" app actually shipped with.
- Princess website booking flow (steps, fields, pricing presentation).
- Royal Caribbean, Celebrity, NCL, Holland America, Viking and MSC apps — only partially covered; Viking, Holland America, MSC and Celebrity detail is thin or absent.
- Post-cruise practices at Princess and competitors (surveys, FCC, rebooking) — little found.
- Accessibility features of existing cruise apps (largely undocumented in sources).
- Regulatory details per market (health declarations, advance passenger info) — to be validated with Princess compliance.
