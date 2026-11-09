# Princess Cruises: Best-in-Market Guest App
## Deep functional requirements, mobile/PWA capabilities and differentiated guest experiences across all 11 stages

**Expanded edition:** 7 November 2026  
**Product surfaces:** responsive phone experience + full desktop web experience  
**Audience:** product leadership, UX, engineering, operations, digital commerce and shipboard stakeholders  
**Status:** expanded strategic recommendation and proposed functional baseline; not an approved Princess product specification

---

## 0. Executive summary

### The recommendation

Build a **trusted voyage operating system**: one continuous guest experience that helps people choose the right cruise, book it confidently, prepare the whole party, enjoy the ship and ports, get home smoothly, and keep the memories.

The product should not try to win by having the largest feature list. Most major cruise lines already offer some combination of mobile check-in, dining and excursion reservations, event schedules, deck maps, shipboard accounts, messaging and onboard Wi-Fi access. Princess already has an unusually strong foundation in Medallion-enabled ship experiences. Its opportunity is to make all of those capabilities feel like one reliable service, from first inspiration to post-cruise loyalty.

The winning proposition is:

> **One voyage. One plan. One trusted place to know what is happening, what is next, and what has actually been confirmed.**

### The five strategic bets

1. **Trust and transaction integrity.** A booking, payment, reservation, order or service request must never silently disappear. Give every meaningful action a receipt, status, timestamp, recovery path and accountable owner.
2. **One live voyage plan.** Combine reservations, activities, travel logistics, ship operations, group plans, port times and personal preferences into one contextual plan. The plan is not a static calendar; it is the guest's operating view of the voyage.
3. **Travel-party coordination as a first-class product.** Support families, linked cabins, multigenerational groups, solo guests and helpers. Give guests control over exactly what others can see and do.
4. **Offline-first, operationally grounded utility.** Design for ship Wi-Fi, intermittent satellite links, port roaming gaps and low battery. Essential information must remain usable without a live connection.
5. **Distinctive Princess continuity.** Integrate properly with Medallion, OceanNow, OceanCompass, JourneyView and Captain's Circle where interfaces are available; then extend the relationship into the pre-cruise and post-cruise journey.

### Expanded requirement inventory

| Workstream | Proposed scope |
|---|---:|
| Detailed stage requirements (Dream through Remember) | **187** |
| Phone/PWA-specific requirements | **25** |
| Differentiated quality-of-life concepts | **22** |
| Cross-stage foundations | Retained and consolidated from the original baseline |

The 187 stage requirements are individually identified and include priority, testable acceptance criteria and dependencies. The 22 quality-of-life concepts are proposals to validate, not a claim that each capability is already unique in the cruise market.

### What should be built first

The first product investment should be the **trust and data foundation**, not AI, photo effects or more content screens. Establish identity, booking resolution, sailing and ship catalogue, itinerary/leg modelling, entitlement rules, reservation transactions, offline contracts, service case tracking, analytics and accessibility. Then build the core guest journeys on top of it.

### Priority definitions

| Priority | Meaning | Product test |
|---|---|---|
| **P0 — Critical** | Required for a safe, trustworthy and commercially credible product | Without it, the guest can lose money, miss the ship, misunderstand a booking, fail a critical task or reach a dead end. |
| **P1 — Competitive** | Expected by leading cruise apps or creates a substantial guest benefit | A guest should reasonably expect it in a best-in-market cruise companion. |
| **P2 — Differentiating** | A meaningful Princess advantage once core reliability exists | Improves planning, delight, personalisation, loyalty or convenience beyond table stakes. |
| **P3 — Exploratory** | Worth testing, but depends on evidence, APIs, ship capability or economics | Do not commit until guest research and operational readiness support it. |

Priority is about guest and business consequence, not implementation size. A P0 may require several releases; a small P2 should not displace it.

### Scope assumption and decision

The October functional-requirements draft sets a mock-only, single-vessel / single 7-night Western Caribbean concept as its initial scope. The November 3 experience-extension document records the decision to support **at least three ships and their 2027 itineraries**, and notes that some 14-, 21- and 28-night itineraries are combinations of voyage legs. I recommend a **single-sailing pilot experience with a multi-ship, multi-itinerary catalogue architecture from day one**. A pilot can expose only one ship or itinerary; it should not hard-code the business model to one ship or one cruise.

---

# 1. Review of the two supplied documents

I reviewed:

1. **Princess Cruises Guest Web App — Functional Requirements, draft v0.9 (28 October 2026).** A detailed, MoSCoW-tagged functional baseline covering discovery, booking, booking management, pre-booking, check-in, onboard functions, disembarkation, post-cruise, identity, support, accessibility, reliability, security, content, notifications and PWA constraints.
2. **Experience extension ideas: more value, more polish, more fun (3 November 2026).** A code-and-screen-oriented review organised around the 11-stage model. It identifies where a large screen library still behaves like a set of forms and lists, and proposes live tiles, stage-aware modes, group planning, closure/status on requests, Stanley as a unified guide, trip moments and a diary/memory book.

## 1.1 What is already strong in the supplied work

The documents correctly identify several principles that should remain product laws:

- Mobile-first, one-thumb usability, without sacrificing desktop capability.
- The experience changes with the guest's stage of the journey.
- Shipboard offline and low-bandwidth use are primary operating conditions, not edge cases.
- Drafts and guest-entered data must survive interrupted flows.
- Pricing, package inclusions, availability and simulated data must be represented honestly.
- Accessibility, larger text, high contrast, calm/simple modes, captions, read-aloud and printable alternatives are product requirements.
- A booking cabin, booking party and wider travel group are separate concepts.
- Crew-side fulfilment must be accounted for even if the concept's crew tools are out of scope.
- The PWA must complement, not pretend to replace, Medallion/keycard hardware.
- A successful experience closes the loop: request received, confirmed, fulfilled, changed or declined—with an explanation.

The extension document's best insight is that the app has a lot of information but does not yet join it up. A guest should not have to move between five screens to answer a simple question such as: *Can our group make dinner after the excursion, how far is the restaurant, what will it cost, and is the reservation actually confirmed?*

## 1.2 Gaps and tensions that need to be resolved

### A. Single-cruise prototype versus multi-sailing product

The October draft describes one Sun Princess sailing and a mock API. The November extension document states that at least three ships and their 2027 itineraries are in scope and recommends a catalogue phase. The latter should govern the data model. A demo may limit selectable inventory; the architecture should represent:

- Ship and ship class.
- Sailing departure/return and itinerary.
- Port calls, sea days and local/ship time events.
- A voyage as one or multiple linked legs.
- Back-to-back combinations and turnaround port events.
- Fare, cabin inventory and entitlements attached to the right sailing and guest.

### B. Formal journey taxonomy versus experience taxonomy

The formal draft groups several guest activities into broader sections. The extension document explicitly uses 11 stages. Use the 11-stage model as the customer-facing journey and analytics taxonomy:

1. Dream
2. Discover
3. Book
4. Manage
5. Prebook
6. Get to the ship
7. Embark
8. Sea
9. Port
10. Disembark
11. Remember

The backend should not force a guest into a single stage if their journey is unusual. For example, a guest can book a second voyage while currently at sea, or link a later voyage during the Remember stage. Stage is a contextual view, not a rigid state machine.

### C. Prototype status is not fully consistent across the two documents

The October document says no code has been written and describes a mock-only plan. The November document reports a review of a codebase, screen registry, styling and some built delight/next-level work. Before backlog grooming, create a **verified implementation baseline**: feature exists, partially exists, is a mock, is planned, or is a research idea. Do not treat a screen's presence as evidence that a real transaction or ship integration works.

### D. Front-end completeness versus operational completeness

The extension document rightly highlights a thin brochure, long link lists and incomplete feedback loops. The deeper product gap is that some guest-facing features depend on operational services: dining capacity, tender forecasts, food delivery, lost items, photo availability, assistance requests, guest services chat, club check-in/out and room controls. These features are not complete when a screen is drawn. Each requires:

- A source-of-truth system.
- An accountable service owner.
- A response/fulfilment expectation.
- A failure, fallback and escalation path.
- An auditable guest-visible status.

### E. More ideas are not automatically better priorities

The extension catalogue includes many worthwhile additions: daily challenges, quizzes, wildlife spotting, visual themes, extra art, port postcards, AI tips, camera uses, haptics and memory experiences. These can improve warmth and repeat use. They should not outrank reservation integrity, booking visibility, offline emergency information, accessible port planning, service recovery or travel-party permissions.

## 1.3 What I would preserve, elevate, change or defer

| Treatment | Recommendations |
|---|---|
| **Preserve** | 11 stages; one responsive experience; offline-first; accessibility; price honesty; guest-controlled location; non-app parity; one trip diary; clear demo/simulated-data labels. |
| **Elevate to P0** | My Trips reliability; booking/transaction ledger; payment and reservation integrity; critical notification delivery; offline boarding/muster/port information; human emergency/support routes; accessible tender and port constraints; entitlement correctness. |
| **Elevate to P1** | Shared group plan; linked travel groups; universal messaging; live schedule/venue data; request fulfilment tracking; personalisation based on real trip context; desktop planning parity. |
| **Change** | Replace one-cruise constants with a data-driven catalogue; separate booking party from social travel group; unify multiple assistants behind one front door; represent time with explicit ship/local/device clocks; turn tab lists into contextual task dashboards. |
| **Defer or gate** | Biometric boarding, AR navigation, room controls, automatic face grouping of photos, predictive crowd intelligence, wearable-dependent location and all features that lack ship/system support. |

---

# 2. Competitive analysis: what the market actually teaches us

## 2.1 Market baseline

The major cruise applications are no longer simply digital brochures. Official product descriptions show that the competitive baseline includes pre-cruise check-in, booking or managing add-ons, daily event schedules, dining and excursion reservations, ship maps, account balances, onboard messaging and free access to at least some app functions over ship Wi-Fi.

The 2026 Travel Market Report Ocean Cruise Outlook reports the most important app features as restaurant reservations (81%), real-time updates (78%), booking onboard events/activities (76%), check-in/check-out (72%) and booking shore excursions (69%). Navigation is 56%. This is survey evidence from a travel-industry report, not a universal consumer census, but it reinforces a clear priority: **make the core cruise tasks work extremely well before investing heavily in AI novelty.** [Source: Travel Market Report, 2026 Ocean Cruise Outlook](https://cdn.travelmarketreport.com/tmr/Outlooks/TMROceanOutlook2026.pdf).

## 2.2 Competitive comparison

| Brand | Publicly documented strengths | What Princess should learn | Princess opportunity |
|---|---|---|---|
| **Princess** | OceanReady check-in; Medallion-enabled contactless boarding, keyless room entry and payment; OceanNow delivery; OceanCompass wayfinding and shipmate features; JourneyView activities and reservations; app/web check-in options. Princess has also launched a ChatGPT cruise-planning integration. | The hardware/service ecosystem is a meaningful competitive asset. Use it as an integrated platform, not as a disconnected list of branded experiences. | Unify My Trips, the plan, the folio, service requests, party permissions and post-cruise memories. Be the most reliable end-to-end guest companion. |
| **Royal Caribbean** | Official app description promotes pre-cruise packages, shore excursions, spa and specialty dining; onboard dining and excursion reservations, travel-party chat, activities, onboard account, deck maps, venue hours and menus. | Breadth and transaction access are expected. Guests should be able to plan before boarding and execute quickly onboard. | Outperform on cross-cabin/group planning, desktop comparison, transparent transaction status, offline recovery and accessibility. |
| **Carnival HUB** | Online check-in, purchases, daily events, maps, food and drink menus, account management, kids/teens, select reservations, delivery and virtual queues. Carnival says core app functionality works over ship Wi-Fi without an internet package; its FAQ says chat has a voyage fee. | Free access to essential app functionality over onboard Wi-Fi matters. Delivery and virtual queues reduce friction when integrated well. | Make messaging free, and pair queues with accurate ETAs, live status and clear cancellation/notification behaviour. Do not charge guests just to coordinate their party. |
| **Disney Navigator** | Pre-cruise payments, online check-in, excursions, adult dining, spa, nursery and transportation; onboard event calendar; personal planner; rotational dining details and table number; deck plans; one-to-one and group chat. | Disney demonstrates that family journeys need dedicated consideration, and a personal planner should combine the day's activities rather than merely list them. | Better cross-cabin permissions, parent/dependent task views, allergy-confidence status, group planning and clear accessible options. |
| **Virgin Voyages** | App supports check-in, dining, Shore Things and onboard activities; its new app describes tailored suggestions and 24/7 Sailor Services. The same official page explicitly notes that some Ship Eats and Shake for Champagne functions still route to the existing app while the new one catches up. | A concierge tone and a unified planner are attractive, but app fragmentation can undermine the promise. | Deliver continuity across service channels; one front door should know whether it can execute the task and should show when it cannot. |
| **MSC for Me** | Check-in, itinerary, boarding pass, excursions/dining/spa, ship map, onboard reservations, messaging without an internet package, live-updated expenses and wristband services for room access/payments on supported ships. | A wristband plus app ecosystem can provide practical convenience; chat and account visibility are competitive expectations. | Integrate wearable signals with guest-facing controls while maintaining web access and alternatives for guests without compatible devices. |
| **Celebrity** | App promotes cruise booking, check-in, pre-cruise add-ons, onboard reservations, activities, account, maps, menus and venue hours. Official material describes a broader in-app brand experience and ship-specific features. | Room/ship controls are attractive when they are genuinely supported by a ship's systems. | Offer room-control integration only where ship APIs and operational support are real; otherwise do not create fake controls or fleet-wide promises. |
| **Norwegian** | Official app page promotes check-in, dining, entertainment and excursion reservations, full cruise itinerary, detailed daily schedule, purchase history and access through onboard Wi-Fi without consuming purchased internet minutes. | A practical no-internet-minutes companion is now a common competitive message. | Make low-bandwidth use, cached essentials and guest-to-guest communication a consistent Princess promise. |

### 2.3 Princess's relative position

**Strengths to exploit**

- Medallion is more than a loyalty token: it connects identity to entry, delivery, location-aware services and payment. This is a physical-digital differentiator that a standalone PWA cannot reproduce.
- OceanNow and OceanCompass are strong functional anchors. The new app should not reimplement them as shallow imitations; it should integrate them into a better plan and service model.
- Princess already promotes an app plus web version for key pre-cruise tasks, and its public materials describe a newer, more personalised app experience.
- Princess's 2026 LLM integration creates a discovery channel and early AI-commerce positioning. The next challenge is continuity from conversation to authenticated guest account, booking, payment and service.

**Vulnerabilities to treat as product risks**

The supplied October requirements document records recurring guest complaints in its research: booking visibility and account-linking friction, pre-cruise checklist problems, dining reservation failures, web/mobile feature splits and support chat with no useful response. These are not merely UX defects. They are symptoms of data integration, transaction reliability and operational ownership problems. The response must be architectural and operational—not just a redesign.

### 2.4 What not to copy blindly

- Do not copy every competitor's chat fee or paid feature boundary. Free basic app access and free travel-party messaging are powerful trust builders.
- Do not promise live queue, location, tender or room-control information unless there is a reliable data source and a shipboard owner.
- Do not imitate an AI concierge that sounds capable but cannot transact or escalate.
- Do not turn every square inch of the interface into an upsell. Protect task-critical screens from marketing.
- Do not make the app mandatory for boarding, muster, medical help, accessible information or disembarkation.

---

# 3. Product principles and experience model

## 3.1 Non-negotiable product principles

1. **Truth before persuasion.** Confirmed, estimated, stale, unavailable and simulated data must look different.
2. **One voyage plan.** All planned activities, bookings, port logistics, ship events and party plans appear in one place.
3. **Never lose an action.** Every transaction and request has a durable state and safe retry.
4. **Offline is a designed state.** Every screen states what remains usable and what requires connection.
5. **People control their data.** Location, health, identity documents, child data and party sharing are consent-led and scoped.
6. **Accessibility is core functionality.** No critical flow should require fine motor control, colour perception, hearing, animation or a smartphone.
7. **One assistant, clear authority.** AI can explain and orchestrate but never invent source data or silently commit a transaction.
8. **Desktop is first-class.** Wide-screen workflows should be designed, not simply stretched.
9. **Operational promises need owners.** Every request, live feed, queue and alert needs an accountable service.
10. **Princess character without friction.** Stanley, visual moments, ship and port art, and trip storytelling add warmth; they never obscure a task or delay it.

## 3.2 The 11-stage guest journey as a contextual state model

Each stage changes the Home experience and the default actions, but a guest can move between stages or have overlapping voyages. The app should calculate the most relevant current context based on verified sailing dates, booking state and ship/port status—not just a manually set stage flag.

| Stage | Guest's primary question | Home experience |
|---|---|---|
| Dream | Is cruising right for me? | Inspiration, quiz, budget, dates, confidence |
| Discover | Which ship, itinerary, date and cabin are right? | Compare, shortlist, cabin and itinerary truth |
| Book | Can I book this accurately and safely? | Booking progress, total price, payment, confirmation |
| Manage | What must I prepare and who is doing it? | Readiness, documents, payments, group tasks |
| Prebook | How do I shape the voyage? | One plan, excursions, dining, shows, packages, conflicts |
| Get to the ship | How do I get to the terminal and board? | Boarding Day Mode, check-in, travel, offline pass |
| Embark | What should I do first aboard? | First Four Hours, muster, cabin, orientation, Medallion |
| Sea | What is happening now and what can I do next? | Right Now, daily plan, live venues, service, spend |
| Port | How do I enjoy ashore and return on time? | Port Day Mode, three clocks, excursion, offline port pack |
| Disembark | How do I leave smoothly and get home? | Last Morning Mode, folio, baggage, customs, onward travel |
| Remember | How do I keep the trip and what comes next? | Diary, photos, feedback, loyalty, next-cruise inspiration |

## 3.3 Three experience modes

- **Plan mode (desktop-forward):** compare, decide, coordinate, review money and documents, build schedules.
- **Companion mode (phone-forward):** time-critical steps, passes, maps, chat, alerts, service requests, offline access.
- **Calm mode (everywhere):** simplified display, no motion or unsolicited delight, larger text, direct language and fewer simultaneous choices.

---

# 4. Expanded, testable functional requirements across the 11 stages

This section expands the compact baseline above into **187 individually identified requirements**. Each row is a product behaviour, not merely a screen. Acceptance criteria are intended to seed stories and QA scenarios; exact numeric SLAs, legal rules and accessibility data must be agreed with Princess owners before production.

**How to read the tables:** P0 is critical to trust/safety/transaction integrity; P1 is competitive baseline or major guest value; P2 is differentiated or experiment-ready. “Dependencies” name the system/data/operational capability required. A front-end-only mock may demonstrate a flow, but it must label mock inventory/status and must not imply a real booking or crew action.

## Stage 1 — Dream

**Guest outcome:** Understand whether cruising fits and create a confident shortlist.

| ID | Priority | Detailed requirement | Acceptance criteria / edge cases | Dependencies |
|---|---|---|---|---|
| DRM-01 | P0 | Allow anonymous discovery of cruises, destinations and ships without account creation. | A new visitor can search and open a sailing before being prompted to sign in; prompts appear only when saving, booking or linking personal data. | Catalogue API, public content |
| DRM-02 | P1 | Explore destinations by region, country, port, season, climate, duration and interest. | Filters combine without losing prior selections; unavailable combinations show a useful empty state and nearby alternatives. | Port catalogue, content taxonomy |
| DRM-03 | P0 | Search across multiple ships and sailings by departure port, date range, duration, destination, price and ship. | Results identify exact ship, embarkation date, itinerary and fare basis; catalogue supports at least three ships and 2027 sailings without hard-coded route constants. | Multi-ship catalogue, pricing |
| DRM-04 | P1 | Offer a flexible date and price calendar across comparable sailings. | Calendar labels lowest observed fare, occupancy assumptions, currency and quote time; clicking a date opens the exact sailing and revalidates the price. | Pricing and inventory APIs |
| DRM-05 | P1 | Provide a guided cruise finder that asks one useful question at a time. | Guest may skip, revise or reset answers; results explain the preferences used and never treat accessibility or health answers as marketing permission. | Preference store, recommendation rules |
| DRM-06 | P1 | Explain first-cruise concepts in plain language before purchase. | Sea days, tenders, muster, dining, cabins, gratuities, packages and port time are explained with ship/itinerary-specific caveats and no sales-pressure gate. | Editorial CMS, glossary |
| DRM-07 | P2 | Support occasion-led discovery such as celebration, reunion, anniversary or milestone travel. | Occasion filters surface relevant itineraries and optional services; no sensitive occasion is shared with a group unless the guest chooses. | Content tags, consent |
| DRM-08 | P1 | Provide family and multigenerational cruise discovery. | Results expose age suitability, adjoining-cabin options, child/youth facilities and port exertion; child details remain private. | Ship capabilities, cabin inventory |
| DRM-09 | P1 | Support solo-cruiser discovery with accurate solo pricing and cabin choices. | Solo supplement, single-occupancy inventory and hosted social options are labelled separately; no assumed roommate matching. | Pricing, inventory, ship content |
| DRM-10 | P0 | Make accessibility a first-class discovery filter spanning ship, cabin, port and excursion. | Guest can filter step-free routes, lift access, wheelchair/tender limits and accessible transport; unknown details are explicitly unknown. | Accessibility catalogue, port data |
| DRM-11 | P0 | Estimate the full holiday cost beyond cruise fare. | Estimate separates cruise, travel, hotel, transfers, insurance, gratuities, packages and discretionary spend; assumptions and uncertainty range are visible. | Pricing, optional travel providers |
| DRM-12 | P1 | Display an interactive itinerary map with port sequence and sea-day context. | Map order matches the selected sailing and shows provisional versus confirmed calls; an accessible text itinerary is always available. | Geospatial port catalogue |
| DRM-13 | P1 | Provide ship profiles and explain meaningful differences among vessels. | Capacity, class, dining, entertainment, accessible features, connectivity and room-control capability are sourced per ship and updated with effective dates. | Ship CMS, operations catalogue |
| DRM-14 | P1 | Create a group wish list with votes for destinations, dates and ships. | Invited members can vote without seeing private fare/payment details; organiser can close voting and export the result. | Group identity, invite service |
| DRM-15 | P1 | Share a shortlist through a secure, revocable link. | Link is read-only by default, can expire, and exposes only explicitly selected options; opening the link never grants booking access. | Share service, consent |
| DRM-16 | P2 | Offer opt-in sailing/fare/availability alerts with useful price context. | Alert is tied to exact sailing, cabin/fare assumptions and currency; guest sets thresholds and can pause/delete it in one action. | Push/email, price history |

## Stage 2 — Discover

**Guest outcome:** Choose the right ship, itinerary, fare and cabin with fewer surprises.**

| ID | Priority | Detailed requirement | Acceptance criteria / edge cases | Dependencies |
|---|---|---|---|---|
| DSC-01 | P0 | Compare at least four sailings side by side. | Comparison normalises date, ship, itinerary, fare, occupancy, cabin category, included items and total estimate; missing data is not fabricated. | Catalogue, pricing |
| DSC-02 | P0 | Score itinerary quality using port hours, overnights, sea-day cadence and embark/disembark timing. | The score is explainable and can be viewed as raw facts; no single “best” score hides trade-offs. | Itinerary data, scoring rules |
| DSC-03 | P1 | Show port reality, including dock/tender, scheduled time alongside and usable independent time. | Arrival/departure, tender expectation, excursion meeting constraints and local/ship time are separately shown with source and freshness. | Port operations feed, time service |
| DSC-04 | P0 | Compare cabin categories using occupancy, bed layout, balcony/window, bathroom and included amenities. | Category-level characteristics are not confused with the exact cabin attributes; differences are readable in a compact comparison. | Cabin catalogue |
| DSC-05 | P1 | Select an exact available cabin on a deck plan. | Selection rechecks inventory before hold; deck plan is keyboard- and screen-reader-usable with a text alternative. | Live inventory, deck plan |
| DSC-06 | P1 | Expose cabin comfort indicators for noise, motion, lift proximity, connecting door and known obstruction. | Each indicator is tagged confirmed, typical, guest-reported or unknown; guest reports are moderated and never represented as guarantees. | Cabin metadata, review moderation |
| DSC-07 | P1 | Provide cabin galleries with clear image provenance. | Every image states exact cabin, category representative, ship sister-vessel or illustrative; outdated images have review dates. | Media CMS, ship metadata |
| DSC-08 | P0 | Compare fare and package inclusions with total-cost transparency. | Guests can expand every included/extra item and see conditions, guest eligibility, tax/service charges and cancellation terms. | Fare rules, entitlement engine |
| DSC-09 | P1 | Calculate whether a beverage, Wi-Fi, dining or broader package is likely to be worthwhile. | Calculator uses stated guest habits and current published prices; shows break-even assumptions and is explicitly an estimate. | Package catalogue, price book |
| DSC-10 | P2 | Provide an explainable personal-fit score for ships and sailings. | Score shows positive matches and compromises, allows weights to be changed, and does not use protected or sensitive attributes to exclude options. | Preference model |
| DSC-11 | P0 | Compare accessibility across the complete journey, not just the cabin. | Ship, gangway, tender, port transport, tour surfaces, restroom access and transfer limitations appear in one checklist with unknowns highlighted. | Accessibility and port data |
| DSC-12 | P1 | Plan connecting or nearby cabins for multi-cabin parties. | Map shows adjacency and inventory status; final selection respects per-cabin guest counts and hold rules. | Inventory, group booking |
| DSC-13 | P2 | Overlay walking distance and comfort from selected cabin to key venues. | Routes distinguish stairs/lifts, estimated walk time and known closures; distance is not advertised as accessible without verified route data. | Deck graph, accessibility data |
| DSC-14 | P1 | Compare ship-specific technology and service capabilities. | Matrix identifies Medallion functions, OceanNow availability, app/Wi-Fi access, room controls and feature exceptions by ship. | Ship capabilities registry |
| DSC-15 | P1 | Provide guest feedback by ship, sailing, cabin and port with provenance. | Verified purchaser, unverified guest, editorial and partner content are distinct; moderation and recency are visible. | Review platform, moderation |
| DSC-16 | P1 | Maintain a persistent decision workspace across phone and desktop. | Shortlists, notes, comparison sets and selected cabin persist after sign-in; shared participants have scoped access. | Account sync, share service |

## Stage 3 — Book

**Guest outcome:** Complete an accurate, transparent and recoverable purchase.**

| ID | Priority | Detailed requirement | Acceptance criteria / edge cases | Dependencies |
|---|---|---|---|---|
| BOK-01 | P0 | Provide a resumable booking flow across mobile and desktop. | A guest can leave, reauthenticate and resume at the last completed step; draft expiry and inventory risk are explained. | Identity, booking orchestration |
| BOK-02 | P0 | Collect traveller legal details with field-level validation. | Validation identifies the exact field and expected format; legal name changes do not silently alter a confirmed booking. | Booking API, document rules |
| BOK-03 | P1 | Scan passport or approved travel document with camera-assisted extraction. | OCR values are suggestions only; guest confirms every field and can enter data manually; temporary images follow a deletion policy. | Camera, OCR provider, privacy controls |
| BOK-04 | P0 | Hold an exact sailing, fare and cabin with a server-issued hold ID and expiry. | Countdown comes from server expiry, not device clock; hold renewal/failure is explicit and a stale client cannot imply inventory is reserved. | Inventory hold API |
| BOK-05 | P0 | Retain the selected fare code, promotion and associated terms through checkout. | A change to fare or terms forces a clear review before payment; audit record stores the accepted version. | Pricing, contract store |
| BOK-06 | P0 | Show an itemised quote for the full party. | Each line identifies traveller, amount, currency, tax/fee, one-time/recurring status and due date; total reconciles mathematically. | Quote service, tax rules |
| BOK-07 | P0 | Revalidate price, inventory and eligibility immediately before payment. | If anything changes, checkout pauses and shows before/after impact with guest choice to continue or return. | Pricing/inventory APIs |
| BOK-08 | P0 | Use hosted or tokenised payment capture. | PAN/CVV never enter application logs, analytics or browser persistence; payment provider returns token and transaction reference only. | Payment gateway, PCI controls |
| BOK-09 | P0 | Protect payments against duplicate charge and uncertain timeout. | Repeated submit, refresh or network retry uses idempotency; UI checks transaction status before offering retry. | Payment orchestration, ledger |
| BOK-10 | P1 | Support split payment and invited payer contributions. | Payer sees their amount and deadline; organiser sees paid/pending/failed status but not another person's payment credentials. | Party roles, payment ledger |
| BOK-11 | P1 | Present deposit, final payment and instalment schedule. | Due dates, amounts, method and failure recovery are visible; reminders are opt-in and payment failure never silently cancels a booking. | Payment schedule API, notifications |
| BOK-12 | P1 | Apply loyalty, future cruise credits, onboard credits and eligible promotions with explanation. | Every credit shows source, amount, eligibility and residual balance; ineligible credits explain why. | Loyalty, promotion, credit services |
| BOK-13 | P1 | Offer optional insurance, transfers, packages and extras with clear disclosures. | Opt-in is explicit; exclusions and refund policy link are visible; no prechecked high-value extras. | Ancillary catalogue |
| BOK-14 | P0 | Require a final pre-payment review. | Review includes guests, cabin, sailing, fare, total, payment schedule and terms; guest must affirm material details before submission. | Checkout flow |
| BOK-15 | P0 | Version and record legal contract/waiver acceptance. | Record stores traveller, timestamp, contract version, locale and acceptance method; changed terms require renewed acceptance. | Contract service, audit |
| BOK-16 | P0 | Issue confirmation only after authoritative booking confirmation. | Receipt includes booking ID, cabin, guest list, itinerary, amount charged/due and next action; pending state is clearly not confirmation. | Booking API, trust ledger |

## Stage 4 — Manage

**Guest outcome:** Know what is booked, what remains to do and who owns each task.**

| ID | Priority | Detailed requirement | Acceptance criteria / edge cases | Dependencies |
|---|---|---|---|---|
| MNG-01 | P0 | Show My Trips across Princess direct, advisor and supported external booking channels. | A trip can be linked by secure verification; ambiguous duplicate profiles route to resolution rather than displaying another guest's booking. | Identity resolution, booking APIs |
| MNG-02 | P0 | Provide readiness dashboard and per-guest next best action. | Every task shows owner, due date, status, action link and consequence of missing the deadline. | Task engine, booking data |
| MNG-03 | P0 | Expose sync state as current, stale, pending, unavailable or not linked. | A failed lookup never appears as “no cruise”; cached trip details remain visible with timestamp and retry option. | Sync service, cache |
| MNG-04 | P0 | Maintain traveller-specific document checklist against official itinerary requirements. | Requirement source, jurisdiction and last-verified date are shown; app flags uncertainty and directs guests to official authority. | Rules engine, official content feeds |
| MNG-05 | P0 | Offer secure document wallet for confirmations, travel documents and receipts. | Documents are encrypted, access-scoped and export/delete controls are provided; sensitive data is not included in push previews. | Encrypted storage, identity |
| MNG-06 | P1 | Show party-wide readiness without exposing private documents. | Organiser sees task status only unless the traveller explicitly delegates document access. | Party permissions, task engine |
| MNG-07 | P1 | Support helper/delegate access for older guests or people needing assistance. | Guest grants named scopes and expiry; delegate cannot pay, cancel or edit legal identity unless separately authorised. | Delegation service, MFA |
| MNG-08 | P1 | Generate itinerary-aware packing lists. | Suggestions account for climate, ports, dress guidance, excursion type and guest-entered needs; all items remain editable. | Itinerary, weather provider, CMS |
| MNG-09 | P1 | Create travel-to-port workspace for flight, hotel, parking, transfer and terminal. | Each item has provider, reference, contact, timing and disruption plan; external bookings are not described as Princess-confirmed. | Travel detail store, integrations |
| MNG-10 | P0 | Show payment schedule and booking balance. | Paid, due, pending, failed and refunded are distinct; amount matches authoritative booking/payment records. | Payment and booking systems |
| MNG-11 | P0 | Track special-assistance and guest-service requests. | Each request has receipt, owner/team, current state, expected response or reason no ETA exists, and escalation path. | Case management |
| MNG-12 | P1 | Maintain dietary/allergy preferences with audience-specific sharing. | Guest chooses whether a preference is saved and where it is shared; crew acknowledgement is visible and not described as a safety guarantee. | Profile, consent, dining operations |
| MNG-13 | P1 | Show itinerary changes as a before/after comparison. | Change notice identifies affected port, times, reservation and onward travel; options and action deadline are prominent. | Itinerary event feed, notifications |
| MNG-14 | P1 | Provide a unified notification centre with category filters. | Transactional, safety, service and marketing are separated; duplicate notices are collapsed without losing the canonical record. | Messaging service |
| MNG-15 | P1 | Track deadlines for check-in, final payment, travel documents, excursions and special requests. | Time zone and source are explicit; deadline changes produce a new event rather than overwriting history. | Rules engine, time service |
| MNG-16 | P2 | Save reusable preferences for cabin, dining, accessibility display and communication. | Preference is opt-in, editable and can be excluded from future voyages; health/child data is not reused for marketing. | Preference store, consent |
| MNG-17 | P1 | Display Captain's Circle status, benefits and eligible credits. | Tier, points/credits and expiry reconcile to loyalty source; stale status is identified. | Loyalty API |
| MNG-18 | P1 | Produce printable trip pack with large-print and low-ink variants. | Trip pack includes only selected documents and current itinerary; QR codes and small text remain legible in print test. | Document renderer, print CSS |

## Stage 5 — Prebook

**Guest outcome:** Build one feasible plan for the whole voyage and travel party.**

| ID | Priority | Detailed requirement | Acceptance criteria / edge cases | Dependencies |
|---|---|---|---|---|
| PRE-01 | P0 | Maintain one day-by-day voyage planner for reservations, activities, port plans and travel logistics. | Every confirmed booking appears automatically; planned and confirmed items are visibly different; edits sync across devices. | Planner, booking/reservation APIs |
| PRE-02 | P0 | Detect schedule conflicts and impossible transitions. | Conflict engine considers overlapping time, venue walking time, ship announcements, port transfer, tender buffers and party constraints; user can override with warning. | Planner, deck graph, itinerary |
| PRE-03 | P0 | Search and reserve dining by venue, day, time, party size and preference. | Availability is revalidated at commit; reservation produces reference ID, party details and cancellation rules. | Dining inventory API |
| PRE-04 | P0 | Replace a dining reservation without losing the original prematurely. | New slot is secured before old reservation is cancelled, or the UI explains that atomic replacement is unsupported and asks for informed consent. | Reservation orchestration |
| PRE-05 | P1 | Support waitlist with position/estimated time where the source supports it. | Join, leave and promotion notifications are recorded; no invented queue position or promise is shown. | Waitlist/queue service |
| PRE-06 | P1 | Provide virtual queue entry for supported venues and services. | Guest receives queue token, party size, join time, status and call instructions; expired/abandoned queue entries are explicit. | Queue service, push/in-app alerts |
| PRE-07 | P1 | Compare shore excursions by length, exertion, transport, age, accessibility and cancellation policy. | Each listing provides inclusion/exclusion details; uncertain accessibility claims are flagged for operator confirmation. | Excursion catalogue, port data |
| PRE-08 | P0 | Check excursion fit for every member of a party. | A booking cannot be represented as suitable for all until age and mobility restrictions are checked for each traveller. | Party profiles, excursion rules |
| PRE-09 | P1 | Build independent port-day plans from verified attractions and transport assumptions. | Plan shows travel time range, all-aboard buffer, currency, opening hours and offline pack status; does not imply Princess endorsement. | Port CMS, map/directions provider |
| PRE-10 | P1 | Book shows and events with accessibility accommodations. | Reservations show seat/space information where available, accommodation request status and cancellation terms. | Event inventory, accessibility service |
| PRE-11 | P1 | Book spa, fitness, enrichment and paid onboard experiences. | Time, duration, location, price, package inclusion and cancellation window appear before commit. | Activity inventory, entitlement engine |
| PRE-12 | P1 | Register children/youth for clubs and capture guardian permissions. | Age eligibility, sign-in/out authority, schedule and consent state are recorded; minors cannot bypass guardian rules. | Youth registration, identity roles |
| PRE-13 | P1 | Provide group plan board with availability polling and voting. | Each guest can accept, decline or propose alternatives without exposing private calendar or personal reason. | Group roles, planner |
| PRE-14 | P1 | Forecast package value and likely onboard spend before sailing. | Forecast assumptions are editable and distinguish included, prepaid, expected and discretionary charges. | Entitlement engine, price book |
| PRE-15 | P1 | Present a wallet of entitlements, vouchers, credits and prepaid services. | Each item states eligible guest, quantity/balance, usage window and redemption status; expired items remain in history. | Entitlement service |
| PRE-16 | P0 | Close the loop on allergy/dietary handoff to the responsible venue. | Guest sees profile submitted, received, acknowledged or unresolved; no UI text guarantees allergen-safe food without operational confirmation. | Dining operations, case ledger |
| PRE-17 | P1 | Coordinate group dining across linked cabins. | Search supports shared times and split cabin seating; organiser sees each response and confirmed table allocation. | Group roles, dining inventory |
| PRE-18 | P0 | Explain cancellations, refunds, credits and modification limits before purchase. | Terms are specific to item and sailing; estimated refund timing is labelled estimate until payment provider confirms. | Policy engine, payment service |

## Stage 6 — Get to the ship

**Guest outcome:** Arrive at the correct terminal with every traveller and credential ready.**

| ID | Priority | Detailed requirement | Acceptance criteria / edge cases | Dependencies |
|---|---|---|---|---|
| GTS-01 | P0 | Complete OceanReady-style check-in per traveller with resumable progress. | Each field shows saved/submitted/accepted state; supported web and phone tasks stay in sync. | Check-in API, identity |
| GTS-02 | P0 | Issue receipt for each traveller's submitted check-in information. | Receipt identifies data category and time received; “submitted” is not shown as “approved” where manual review remains. | Check-in API, trust ledger |
| GTS-03 | P0 | Cache boarding QR/pass, booking reference, terminal and emergency contacts. | Pass renders in airplane mode and high contrast; paper/terminal fallback is explicit. | Pass service, offline store |
| GTS-04 | P0 | Show terminal, arrival group, luggage drop and current embarkation instructions. | Details match ship/date/port; arrival-group change is timestamped and only sourced from booking/terminal operations. | Terminal operations, booking API |
| GTS-05 | P0 | Offer Boarding Day Mode with sequential, context-aware tasks. | Mode includes next task, documents, terminal and group status; can be manually entered/exited and never hides urgent help. | Journey state, checklist engine |
| GTS-06 | P1 | Calculate leave-by time from guest location only when explicitly requested. | Inputs include address/airport, traffic provider, travel mode and check-in window; estimate shows assumptions and is not a boarding guarantee. | User-entered origin, routing provider |
| GTS-07 | P1 | Monitor flight/transfer disruption when guest links or enters a trip. | Flight source and last update are shown; stale/no-feed state never appears as “on time”. | Flight/transfer provider |
| GTS-08 | P0 | Provide late-arrival and missed-connection rescue workflow. | Contact path, booking details and steps remain cached; app never promises the ship will wait. | Support, port agent contact data |
| GTS-09 | P1 | Provide terminal map and step-free accessible route. | Map reflects terminal version/date and identifies stairs, lifts, shuttle and assistance desk; textual fallback exists. | Terminal map, accessibility content |
| GTS-10 | P1 | Coordinate party arrival without continuous tracking. | Members can send one-time “departed”, “arrived” or “at meeting point” signals; sharing expires after embarkation. | Group messaging |
| GTS-11 | P1 | Provide luggage preparation and tag workflow. | Correct sailing/cabin tags are downloadable/printable; tracking is shown only if carrier/port integration exists. | Booking data, document renderer |
| GTS-12 | P0 | Handle check-in exceptions and rejected documents. | Reason, required correction, due date and human contact are provided; edits create a new receipt/version. | Check-in exception API |
| GTS-13 | P2 | Show queue/terminal wait information only from a verified feed. | Time includes source, updated-at and confidence; absent feed hides the estimate rather than substituting a guess. | Terminal telemetry |
| GTS-14 | P0 | Provide accessible embarkation plan and assistance confirmation. | Request shows received/acknowledged/assigned state and contact; guest can print the plan and retain a fallback. | Accessibility operations |
| GTS-15 | P1 | Offer a night-before checklist and device readiness test. | Checks downloaded pass, login, battery advice, offline maps and Medallion status; failure gives a practical alternative. | Offline test, device capability |
| GTS-16 | P1 | Explain Medallion order, delivery/pick-up and activation status. | Country, sailing and eligibility conditions are reflected; keycard/terminal fallback is visible. | Medallion fulfilment |

## Stage 7 — Embark

**Guest outcome:** Board safely, meet obligations, find the cabin and get oriented.**

| ID | Priority | Detailed requirement | Acceptance criteria / edge cases | Dependencies |
|---|---|---|---|---|
| EMB-01 | P0 | Show authoritative boarded status and timestamp. | Boarding is confirmed only by ship/terminal manifest or authorised scan; local QR display alone never means boarded. | Manifest/boarding API |
| EMB-02 | P0 | Provide assigned muster station card and completion state. | Station, deck, route and completion are cached; app states that crew instructions and announcements override app content. | Muster assignment, deck graph |
| EMB-03 | P0 | Present verified accessible muster alternative and assistance contact. | Alternative is ship-specific and confirmed by safety operations; app does not invent an accessible evacuation route. | Ship safety data, accessibility operations |
| EMB-04 | P1 | Launch a First Four Hours sequence after embarkation. | Steps adapt to confirmed muster, cabin readiness, venue hours and ship announcements; each can be dismissed or revisited. | Boarding state, event feed |
| EMB-05 | P1 | Show cabin arrival card with deck, route, steward contact and practical first steps. | Cabin and route match confirmed assignment; accessible alternative and keycard/Medallion troubleshooting are linked. | Booking, deck map |
| EMB-06 | P1 | Show luggage/cabin readiness with source and certainty. | “Delivered”, “in transit” and “expected” are distinct; no fake bag tracking is shown when no sensor/integration exists. | Housekeeping/luggage feed |
| EMB-07 | P1 | Allow cabin issue reporting with category, optional photo and preferred contact. | Submission creates case ID, timestamp and owner; guest sees updates and can add detail without duplicate case. | Service desk, photo upload |
| EMB-08 | P1 | Provide Medallion/keycard status and troubleshooting. | The app identifies whether it is reporting status or performing a device action; lost-device and keycard fallback is clear. | Medallion service, Guest Services |
| EMB-09 | P1 | Offer ship-specific self-guided tour in short, long and step-free modes. | Stops open correct deck/venue info; route remains usable offline; tour is optional and can be paused. | Deck graph, ship CMS |
| EMB-10 | P1 | Create shareable meeting-point cards with explicit arrival check-in. | Landmark, deck and time are visible; one-time “I'm here” updates only to invited party and expire. | Group messaging, map |
| EMB-11 | P0 | Explain ship Wi-Fi connection and free-app versus paid-internet boundaries. | Instructions are ship-specific; app never suggests that third-party internet is free or that PWA access bypasses captive portal rules. | Network operations, content |
| EMB-12 | P1 | Show first-day venues with opening hours, crowd state and package eligibility. | Hours and eligibility are timestamped and ship/date-specific; unknown crowd status is omitted. | Venue feed, entitlement engine |
| EMB-13 | P2 | Provide an accessible sail-away guide and viewpoint finder. | Viewpoint recommendation includes step-free route and weather/open-deck caveat; no crowd prediction without data. | Deck map, weather |
| EMB-14 | P1 | Support family reunion and guardian handover plan. | Authorised adults, children and meeting locations are explicit; no unattended child-tracking assumption. | Guardian roles, youth service |
| EMB-15 | P0 | Keep emergency quick actions available offline. | Muster, emergency phone/crew instructions and ship address are reachable in two taps or less without login after cache. | Offline capsule, safety CMS |

## Stage 8 — Sea

**Guest outcome:** Navigate ship life, spend confidently and get service without friction.**

| ID | Priority | Detailed requirement | Acceptance criteria / edge cases | Dependencies |
|---|---|---|---|---|
| SEA-01 | P0 | Provide a Right Now home card. | Shows next planned item, time, venue, deck, reservation confirmation and route; missing/live data is labelled rather than inferred. | Planner, ship time, deck map |
| SEA-02 | P0 | Provide one unified daily planner for booked, saved and recommended items. | Planner reconciles reservations and changes; cancelled/moved events are removed from the active view but retained in history. | Event and reservation APIs |
| SEA-03 | P0 | Offer an offline ship capsule. | Guest can save schedule, tickets, confirmed reservations, deck maps, muster, contacts and selected menus; cache age and size are visible. | PWA offline storage |
| SEA-04 | P1 | Search across ship facilities, services, policies and activities. | Search returns direct answers and actions with ship/day scope; result freshness and source are available. | Search index, ship CMS |
| SEA-05 | P1 | Provide venue directory with hours, location, price, menu, inclusion and accessibility. | Venue state is open/closed/temporarily unavailable with timestamp; included versus extra charge is clear. | Venue catalogue, entitlement engine |
| SEA-06 | P0 | Provide interactive deck maps with accessible route options. | Routes account for lifts, stairs, closures and restricted areas; text directions and manual location fallback are available. | Deck graph, accessibility feed |
| SEA-07 | P1 | Offer opt-in location modes: manual, QR/landmark check-in or authorised Medallion location. | Source is stated and user can turn off or revoke sharing; no continuous device GPS is needed for core navigation. | Medallion integration, consent |
| SEA-08 | P2 | Show crowd/wait metrics and quiet-time suggestions where telemetry exists. | Each value is measured or estimated with confidence and timestamp; absent data does not produce fabricated occupancy. | Occupancy telemetry, analytics |
| SEA-09 | P0 | Manage dining reservations, waitlists and table changes. | A confirmed reservation always has a receipt; change flow preserves old reservation until replacement rules are clear. | Dining inventory, trust ledger |
| SEA-10 | P1 | Provide a unified queue wallet for dining, shows, tender and service desk where supported. | Each queue token has state, party size, current instructions and cancel/leave control; queue type is identified. | Queue services |
| SEA-11 | P1 | Integrate OceanNow food and beverage ordering. | Cart shows included/extra price, package entitlement, delivery address/location, substitutions, tax/tip and order status before submit. | OceanNow/order APIs, folio, location |
| SEA-12 | P1 | Provide order tracking and issue resolution. | Guest sees received/preparing/out-for-delivery/delivered/exception states only when source confirms; late/missing item creates linked support case. | Order fulfilment, case management |
| SEA-13 | P0 | Provide central package and entitlement tracker. | Shows allowance, consumption, exclusions and validity per guest; folio remains financial source of truth. | Entitlement and folio APIs |
| SEA-14 | P0 | Display itemised onboard folio with pending and posted transactions. | Each charge has date/time, venue, amount, currency, status and dispute path; totals reconcile to official statement. | Folio API |
| SEA-15 | P1 | Provide personal spend forecast and category budget controls. | Forecast distinguishes posted, pending and predicted spend; alerts are guest-configured and child spend uses guardian rules. | Folio, entitlement, preferences |
| SEA-16 | P1 | Offer age-aware family/group messaging over ship app network. | One-to-one and group chat support block/report, guardian consent and message delivery state; no sensitive notification previews by default. | Messaging, guardian controls |
| SEA-17 | P1 | Show youth-club schedule, registration, attendance and authorised pickup. | Only authorised guardians can view/update; check-in/out state comes from staff system and is timestamped. | Youth service, identity roles |
| SEA-18 | P1 | Find accessible shows/events and request accommodations. | Captions, hearing assistance, seating/access route and sensory notes are shown when verified; requests are tracked. | Event CMS, accessibility operations |
| SEA-19 | P0 | Track allergy/dietary handoff through profile, booking, venue acknowledgement and meal-service confirmation where systems allow. | Each stage is explicit; “received” never means food is allergen-safe; unresolved acknowledgement routes to staff. | Allergy service, dining operations |
| SEA-20 | P0 | Provide service request lifecycle for cabin, housekeeping, maintenance, laundry and guest services. | Request has owner, status, ETA/confidence, updates, escalation and closure confirmation; reopening retains history. | Case management, crew workflow |
| SEA-21 | P2 | Offer room controls only for compatible ship/cabin systems. | Control is hidden when unsupported; guest receives confirmed device state or explicit failure, not optimistic UI success. | Ship room-control API |
| SEA-22 | P1 | Generate a daily briefing with personalised agenda and operational changes. | Brief includes ship time, reservations, itinerary notices, weather and relevant action; suppresses marketing in calm mode. | Planner, events, weather, CMS |
| SEA-23 | P1 | Show ship position, weather, sunrise/sunset and sea-state context. | Each feed has timestamp/source and operational caveat; navigational/safety decisions defer to bridge/crew. | Ship telemetry, weather provider |
| SEA-24 | P1 | Show medical-centre hours, location, contact and accessibility information. | Directory is available offline and prominently says it is not diagnosis or medical advice; urgent instructions defer to crew/emergency process. | Ship CMS, safety operations |
| SEA-25 | P0 | Provide low-bandwidth mode for onboard Wi-Fi constraints. | Defer large images/video, avoid background refresh loops and preserve task functionality over the ship's app-only network. | Performance budget, ship network |

## Stage 9 — Port

**Guest outcome:** Enjoy shore time while understanding local logistics and returning safely.**

| ID | Priority | Detailed requirement | Acceptance criteria / edge cases | Dependencies |
|---|---|---|---|---|
| POR-01 | P0 | Provide Port Day Mode with next event, excursion, all-aboard and return plan. | Mode is ship-time-first and includes return buffer, meeting point and offline readiness; app cannot hide all-aboard behind promotional content. | Itinerary, ship time, excursions |
| POR-02 | P0 | Show three clocks: ship time, port local time and device/home time. | Every deadline names its governing clock; DST changes and date-line crossings are tested; ship time comes from authoritative sailing feed. | Time service, itinerary |
| POR-03 | P0 | Build downloadable per-port offline pack. | Contains pier/terminal, excursion tickets, maps, contacts, all-aboard and return guidance; download completion is tested before going ashore. | Offline store, port CMS |
| POR-04 | P0 | Provide excursion card with meeting point, return time and operator details. | Card distinguishes Princess-operated from independent activity, shows cancellation/contact route and remains available offline. | Excursion booking, port CMS |
| POR-05 | P0 | Show tender status, ticket group, last tender and accessible tender process. | Current status is sourced from ship operations and timestamped; no estimated status is labelled confirmed. | Tender operations feed |
| POR-06 | P0 | Calculate return-to-ship time budget. | Uses all-aboard, selected buffer, walking/transport estimates and tender wait where available; assumptions and uncertainty are shown. | Map/routing, tender feed |
| POR-07 | P1 | Provide accessible shore information and return routes. | Surface, slope, curb, lift, restroom and transport details are source-tagged; unknowns are visible and guest can request human help. | Accessibility content, port data |
| POR-08 | P1 | Build independent port day plans with stops and time constraints. | Plan warns about distance, opening-hour uncertainty, transit and ship-return risk; alternatives can be saved offline. | Map/directions, port CMS |
| POR-09 | P1 | Provide local safety guide and verified emergency contacts. | Contacts are port- and sailing-specific, tested and cached; app distinguishes emergency services from ship agent/Princess support. | Port operations, verified CMS |
| POR-10 | P1 | Offer currency converter with cached reference rate. | Rate source/time are shown; conversion is indicative and never represented as a payment/ATM rate guarantee. | FX provider, offline cache |
| POR-11 | P1 | Offer offline phrasebook and key local-language phrases. | Guest can search and play locally cached phrases; text remains usable without audio; translation is labelled practical not authoritative. | Language content, audio assets |
| POR-12 | P1 | Provide weather, sea and tender advisories. | Source, timestamp and forecast horizon are visible; safety action follows ship announcements and local authorities. | Weather, operations |
| POR-13 | P1 | Allow explicit meeting-point check-in. | Guest sends one-time arrival signal to named party; no background location share is implied. | Group messaging |
| POR-14 | P1 | Show party ashore board with voluntary status. | Members can mark aboard, ashore, excursion, returning or safe; stale status auto-expires and is never treated as manifest status. | Group roles, consent |
| POR-15 | P0 | Manage port disruption with replan and support handoff. | Cancelled port, delayed tender or excursion change identifies impacted bookings, credits/refunds policy and new plan; no silent itinerary overwrite. | Operations feed, planner, case system |
| POR-16 | P0 | Provide missed-ship rescue instructions and contacts. | Explains immediate steps and required documents, stores port agent/shore support contacts offline and never promises the vessel will wait. | Port agent directory, support |

## Stage 10 — Disembark

**Guest outcome:** Close out the voyage and continue onward travel smoothly.**

| ID | Priority | Detailed requirement | Acceptance criteria / edge cases | Dependencies |
|---|---|---|---|---|
| DEB-01 | P0 | Provide Last Morning Mode with ordered tasks and departure group. | Shows cabin deadline, breakfast availability, luggage, meeting point, gangway/route and next transport; all data is sailing-specific. | Disembark operations, ship time |
| DEB-02 | P0 | Let guest confirm or view assigned departure option where ship policy allows. | Selection shows capacity and consequence; final assignment comes from operations and is distinguished from preference. | Disembark inventory |
| DEB-03 | P0 | Provide luggage-tag, collection and reclaim instructions. | Instructions identify tag group, location, accessibility help and lost-bag contact; offline/printable copy exists. | Luggage operations, document renderer |
| DEB-04 | P0 | Reconcile final folio and settlement state. | Final, pending, disputed, refunded and adjusted charges are separate; official receipt can be exported. | Folio, payment service |
| DEB-05 | P0 | Allow charge dispute with evidence and reference ID. | Case links to transaction, preserves receipt and gives owner/response expectation; submission does not imply charge is reversed. | Case management, folio |
| DEB-06 | P1 | Provide cabin sweep checklist. | Checklist covers documents, medications, chargers, valuables, safe, drawers and borrowed equipment; editable and dismissible. | CMS, user preferences |
| DEB-07 | P1 | Show breakfast/venue finder with departure-day hours. | Venue hours reflect disembark schedule and capacity; closed or changed venues are not shown as open. | Venue operations |
| DEB-08 | P0 | Provide customs and immigration information with official sources. | Country, nationality and itinerary scope are clear; current source and update date are shown; app does not make legal eligibility guarantees. | Official government links, content QA |
| DEB-09 | P1 | Create onward travel workspace for airport, hotel, transfer and pickup. | Address, booking reference, pickup zone, buffer and contact are visible; suggested connections are labelled estimates. | Travel details, routing |
| DEB-10 | P1 | Link to airline check-in and travel provider apps/sites. | Deep link opens correct carrier and flight context where supported; no credentials are transmitted to a third party by default. | External deep links |
| DEB-11 | P1 | Create and track lost-property reports. | Item description, optional photo, location/time and contact preference are captured; case remains in My Trips. | Lost property service |
| DEB-12 | P1 | Provide post-cruise document pack. | Includes itinerary, folio, receipts, purchased photos and relevant certificates; each file has retention/availability information. | Document store, photo API |
| DEB-13 | P1 | Give terminal exit and onward transport directions. | Directions are terminal-specific and include accessible route and pickup restrictions; source/freshness are visible. | Terminal map, port operations |
| DEB-14 | P0 | Carry unresolved onboard service cases into shore-side support. | Case owner, history, evidence and guest communication preference transfer without forcing the guest to restate the issue. | CRM/case integration |
| DEB-15 | P1 | Generate a departure pocket card. | One-page print/download includes group, time, luggage, meeting point, terminal and onward travel contacts; can be cached. | Document renderer, offline store |

## Stage 11 — Remember

**Guest outcome:** Keep the memories, resolve issues and strengthen loyalty.**

| ID | Priority | Detailed requirement | Acceptance criteria / edge cases | Dependencies |
|---|---|---|---|---|
| REM-01 | P0 | Archive voyages with itinerary, confirmations, folio, receipts, credits and cases. | Past trips remain searchable and downloadable according to retention policy; booking and passenger permissions remain enforced. | Booking, folio, document store |
| REM-02 | P1 | Create editable trip timeline/diary from confirmed events and guest notes. | Imported milestone is labelled as sourced; generated text is editable and guest can remove any item. | Planner history, diary service |
| REM-03 | P1 | Build a personal memory book with selected notes, ports and images. | Guest chooses content and layout, previews before export/order, and can delete the project. | Diary, media store |
| REM-04 | P1 | Provide shared album with per-photo ownership and consent. | Owner controls download/share; each contributor can withdraw their photo; private images never become public by default. | Media store, consent model |
| REM-05 | P1 | Offer purchased photo archive and resumable batch downloads. | Download resumes after interruption, verifies completeness and states purchase/expiry terms; originals are not recompressed without notice. | Photo provider, object storage |
| REM-06 | P0 | Route poor-experience feedback into service recovery. | Guest can choose survey only or request follow-up; requested follow-up creates owned case and prevents marketing offers from masking unresolved issue. | Survey, CRM case |
| REM-07 | P1 | Show loyalty status, milestones and benefits. | Tier/credits/expiry reconcile with source and identify last sync; guest can report discrepancy. | Loyalty API |
| REM-08 | P1 | Recommend next voyages based on explicit stated preferences and history. | Reason for recommendation is shown; guest can edit/remove inputs; no sensitive health or child details used for targeting. | Preference model, catalogue |
| REM-09 | P1 | Enable faster rebooking with consented traveller details. | Guest reviews each reused field and current terms; outdated passport/payment/assistance data is revalidated. | Identity, booking |
| REM-10 | P1 | Provide future cruise credit and onboard credit wallet. | Credit source, value, currency, expiry, eligibility and redemption history are clear and reconcilable. | Credit/loyalty service |
| REM-11 | P1 | Use progressive post-cruise survey. | Guest can answer a short survey first and optionally expand; accessibility and service issues are captured without forcing a long form. | Survey service |
| REM-12 | P1 | Allow crew thank-you/recognition with receipt. | Message routes to approved channel; no public rating, ranking or employment-impact score is exposed. | Crew recognition workflow |
| REM-13 | P2 | Generate a shareable voyage recap. | Guest previews names/photos/locations and approves every external share; no other guest is included without permission. | Diary, media, share service |
| REM-14 | P2 | Support opt-in reunion and referral tools. | Invitations are revocable and contact details are not exposed to other guests without consent; incentives are disclosed. | Group service, referral engine |
| REM-15 | P2 | Offer print-on-demand memory products. | Price, shipping, photo rights and proof approval are required before charge; production provider receives only chosen assets. | Print provider, payment |
| REM-16 | P0 | Provide privacy and retention centre for trip data. | Guest can view, export, correct and request deletion where legally permitted; retention exceptions are explained. | Consent, privacy workflow |

# 5. Dedicated phone and PWA requirements

The phone experience should exploit useful device capabilities without pretending a browser is a native app or replacing Princess's Medallion, keycard, terminal or crew systems. The app must remain fully useful when guests decline permissions, do not install it, use older devices or have limited connectivity.

## 5.1 Phone-specific functional requirements (25)

| ID | Priority | Requirement | Acceptance criteria / PWA boundary |
|---|---|---|---|
| MOB-01 | P0 | Installable home-screen PWA with standalone presentation. | Provide contextual install guidance for supported platforms; guest can continue in browser and all core tasks remain usable without install. |
| MOB-02 | P0 | Versioned service-worker app shell and controlled updates. | Cache shell/assets by version, retain user drafts across deploys, announce updates and never force-reload during a critical transaction. |
| MOB-03 | P0 | Guest-managed Offline Capsule by journey stage. | Let user select voyage, ship, ports, maps, tickets, documents and media; show download progress, size, expiry and last test. |
| MOB-04 | P0 | Durable local persistence using IndexedDB. | Drafts and outbox survive reload/crash; storage quota, migration, corruption and eviction are handled with export/recovery options. |
| MOB-05 | P0 | Per-action offline contract. | Each control states available offline, queued, view-only or requires connection before user commits; no silent optimism. |
| MOB-06 | P1 | Web Push notifications with contextual permission prompts. | Ask only after explaining a specific benefit and user gesture; on iOS/iPadOS, describe Home Screen installation requirement and fallback channels. |
| MOB-07 | P1 | Deep-link push notifications to exact trip object/action. | Links authenticate safely, resolve to the correct voyage and show current state if the original event has changed. |
| MOB-08 | P1 | Native share-sheet integration where supported. | Share only guest-selected content; handle unsupported browsers and cancellation with copy-link fallback. |
| MOB-09 | P1 | Camera capture for travel documents, receipts, luggage tags, cabin issues and diary. | Preview, crop/retake, manual entry and delete are available; uploads require explicit confirmation and purpose notice. |
| MOB-10 | P1 | QR/barcode scanner for boarding, venue, map and ticket actions. | Validate payload type and issuer; never treat a scanned QR as authoritative boarding/muster completion by itself. |
| MOB-11 | P1 | Optional Screen Wake Lock while displaying pass, muster card or map route. | Request only during active visible task; show when unavailable/revoked and release on task completion; never make it required for scanning. |
| MOB-12 | P0 | One-thumb phone interaction and touch targets. | Primary actions stay in reachable zones; avoid hover, drag-only, tiny icons and multi-step modals; meet WCAG 2.2 AA target-size criteria. |
| MOB-13 | P1 | Foreground geolocation for guest-requested port navigation. | Permission requested only when the user starts the feature; no continuous/background tracking; manual address/map fallback is present. |
| MOB-14 | P0 | Explicit ship-time/local-time/device-time handling on phone. | Label governing clock beside each deadline, detect time-zone/date-line changes and never silently rely on the phone clock for sailing events. |
| MOB-15 | P1 | Add-to-calendar export for selected events and reminders. | Export uses correct time zone and updated/cancelled event identifiers where supported; explain that external calendar sync may lag. |
| MOB-16 | P2 | Server-generated Apple/Google wallet passes where eligible. | Use signed, provider-compliant passes with update/revocation support; web app does not claim it can create a native pass entirely client-side. |
| MOB-17 | P1 | High-contrast full-screen boarding and muster display. | Large QR/text, brightness guidance and manual fallback; PWA cannot force hardware brightness, so user controls remain explicit. |
| MOB-18 | P1 | Tap-to-call, SMS, email and map links for verified urgent contacts. | Numbers/URLs are port/ship scoped, tested and available offline; the guest chooses before the device opens another app. |
| MOB-19 | P1 | User-initiated text-to-speech/read-aloud for key instructions. | Works with system/browser capability where available; text remains visible and user controls pause/rate; screen-reader compatibility retained. |
| MOB-20 | P2 | Optional voice input for search and quick notes. | Only supported after explicit activation; text entry remains equivalent; no always-listening mode and no voice biometric assumptions. |
| MOB-21 | P2 | Optional vibration/haptic feedback for discreet acknowledgements. | Feature-detect and test support; provide visual/text alternative and never use vibration as the only safety signal. |
| MOB-22 | P2 | Optional device orientation/compass helper for map orientation. | Request permission where required; offer north-up/manual orientation fallback and never use heading as authoritative ship navigation. |
| MOB-23 | P0 | Background-safe reminder strategy. | Server push and in-app inbox are primary; Background Sync/periodic sync are progressive enhancements only, never required for all-aboard, emergency or payment safety. |
| MOB-24 | P1 | Data saver and battery-aware mode. | Defer video/large photography, reduce polling, batch safe refreshes and preserve current confirmed reservations and tickets. |
| MOB-25 | P1 | Photo/file import, local preview, save/share and delete. | User chooses each asset and destination; strip location metadata from shared copies by default unless user opts in; respect photo ownership and consent. |

## 5.2 PWA capability reality check

| Capability | Practical use | Constraint and product rule |
|---|---|---|
| Installable PWA | Home-screen launch, standalone window, app icon and cached shell. | Installation prompts and criteria vary; provide browser mode and platform instructions. |
| Service worker + Cache Storage | Offline app shell and selected static assets. | Cache strategy must be versioned; do not cache authenticated sensitive responses indiscriminately. |
| IndexedDB | Drafts, selected trip snapshot, offline notes and safe outbox. | Storage can be cleared/evicted; provide export, revalidation and clear user-visible sync status. |
| Web Push | Reminders and important updates. | Requires server-side push infrastructure and user permission; iOS/iPadOS support is for Home Screen web apps on 16.4+; delivery is not guaranteed. |
| Web Share | OS share sheet for itinerary, invitation or memory card. | Limited browser availability; secure context and user gesture required; provide copy/download fallback. |
| Camera / file input | Document scanning, QR reading, photos and receipts. | Browser permission, HTTPS and user gesture; manual/typed fallback always available. |
| Screen Wake Lock | Keep a pass/route visible while the user is actively looking at it. | Visible document only; OS may revoke (for example low battery); use only temporarily and allow release. |
| Geolocation | Foreground turn-by-turn or nearby port assistance. | Permission and accuracy vary; do not assume background tracking, always-on positioning or indoor ship accuracy. |
| Web NFC / Bluetooth | Potential peripheral experiments. | Not a reliable cross-platform substitute for Medallion or secure door/payment hardware; do not promise universal capability. |
| Speech recognition/synthesis | Voice search or read-aloud. | Browser/language support and offline behaviour vary; text and assistive-technology paths remain first-class. |
| Vibration API | Optional tactile feedback on supported devices. | Not universal, may be ignored by OS/browser; never sole alert channel. |
| Wallet passes | Boarding/loyalty/booking credential in OS wallet. | Requires server-side pass generation/signing and eligibility; PWA alone cannot guarantee wallet support. |
| Background Sync | Retry eligible safe commands after connectivity returns. | Limited browser availability and scheduling control; never assume timely execution or use for safety-critical work. |

## 5.3 Offline design rules

1. **Offline is not one boolean.** Every record has freshness, source and whether it is safe to rely on.
2. **Read offline; transact honestly.** Guests can view cached tickets and submit safe drafts offline, but live inventory, payments, reservations, refunds and manifest changes need authoritative confirmation.
3. **Outbox only for safe commands.** Notes, feedback drafts and non-financial requests may queue if the server supports deduplication. Payments and inventory reservations should require connectivity and explicit server confirmation.
4. **Conflict resolution is a product flow.** If the server changed an itinerary or reservation while a device was offline, show both versions and ask the guest how to resolve it.
5. **Test real cruise conditions.** Include airplane mode + Wi-Fi-only ship portal, captive portal reauthentication, intermittent latency, roaming disabled, low battery, storage pressure and app update during use.

## 5.4 Phone interaction patterns worth standardising

- **One primary action per screen:** secondary actions are visible but not competing.
- **Thumb-zone controls:** put urgent actions and navigation in reachable lower zones while respecting OS safe areas.
- **Context cards, not tab walls:** show the next relevant action, confirmed plan, changed item and one helpful alternative.
- **Progressive disclosure:** simple explanation first; policy, technical detail and full itinerary on demand.
- **Large tap-safe pass view:** bright, high contrast, legible in sun, with a persistent manual fallback.
- **Explicit offline badge:** identify cached, pending, stale and live data in plain language.
- **No compulsory motion:** animation and haptics are optional and suppressed in calm/reduced-motion mode.
- **Accessible alternatives:** every map has text steps; every QR has a reference code; every voice action has typing; every push has an inbox record.

# 6. Competitive differentiation: 22 quality-of-life concepts

The user brief asks for features “no one else has.” The responsible competitive claim is narrower: cruise competitors already market planners, chat, delivery, account views, maps, reservations, queues, and family features. It would be misleading to claim any one of those is unique. The stronger proposition is a **distinctive integrated experience**: features that combine Princess's Medallion/ship services with one trusted plan, transparent service ownership, offline readiness and consent-based group coordination. The concepts below are hypotheses to validate, not claims that no competitor has any similar component.

## 6.1 Flagship differentiators to prototype first

1. **Voyage Autopilot (QOL-01):** turn a messy collection of reservations and preferences into a feasible plan, with walk time, conflicts and party constraints explained.
2. **Voyage Trust Ledger (QOL-03):** prove what happened to every booking, payment, reservation, request and refund. This directly addresses the anxiety of app/booking uncertainty.
3. **Offline Capsule Manager (QOL-04):** let guests download and test everything needed for boarding, ship life and ports before they lose reliable connectivity.
4. **Port Return Guardian (QOL-11):** combine tender state, all-aboard, transport and return buffers into a transparent plan, not a generic countdown.
5. **Allergy Chain of Custody (QOL-09):** provide explicit acknowledgement through the dining workflow without making unsafe guarantees.
6. **Privacy-Safe Rendezvous (QOL-08):** help families and groups meet through landmarks and one-time signals, not compulsory location tracking.

These six are more defensible than a generic AI chat bubble because they depend on integrated data, operational processes, and a guest-trust contract that is difficult to reproduce with front-end polish alone.

## 6.2 Full quality-of-life feature set

| ID | Feature | What it does | Guest value | Required integrations | Guardrails and proof of value |
|---|---|---|---|---|---|
| QOL-01 | **Voyage Autopilot** | Turns the itinerary into a feasible recommended day plan using reservations, venue hours, walking time, party constraints, weather and guest-selected pace. | Guest value: one tap produces a realistic “best next plan” in relaxed, active, family and accessibility-aware modes, with reasons and trade-offs. | Planner, deck graph, event/venue feeds, weather, party preferences and accessibility data. | Do not silently alter bookings; recommendations must show confidence and allow manual override. Validate with time-to-plan, missed-conflict rate and guest-rated usefulness. |
| QOL-02 | **Universal Queue Wallet** | Unifies supported dining, tender, show standby, service desk and other queue tokens in one place. | Guest value: no hunting across separate services; every place in line has clear state, instructions and cancellation. | Queue adapters, operational owners, notification service and standard queue schema. | Not a fabricated queue aggregator: only show queue types with real integration. Measure wait-time accuracy and abandonment. |
| QOL-03 | **Voyage Trust Ledger** | A chronological, guest-visible ledger for bookings, payments, reservations, orders, requests, credits, itinerary changes and refunds. | Guest value: answer “did it go through?” and “what happened?” with receipt, source, timestamp and status. | Canonical event model, idempotent APIs, booking/payment/CRM integrations. | This is the foundational differentiator. Measure unmatched transactions, duplicate charge rate and “where is my booking?” contacts. |
| QOL-04 | **Offline Capsule Manager** | A guided download and readiness check for the exact ship, sailing and ports before leaving home or going ashore. | Guest value: know what is saved, when it was updated, how much space it uses and which tasks still require a connection. | Service worker, IndexedDB, cache manifests, voyage data packaging. | Mark content stale and expiry clearly; validate success under airplane mode and captive portal conditions. |
| QOL-05 | **One-Tap Contextual Rescue** | Creates a support case with the relevant trip, screen, object ID, error code and recent steps, with redaction/preview before submission. | Guest value: eliminates repetitive explanations and helps staff diagnose a specific failure quickly. | Client diagnostics, case management, identity consent and agent console. | Never upload passport, health, message or location contents by default; guest reviews the attached context. Measure resolution time and repeat-contact rate. |
| QOL-06 | **Quietest-Next Finder** | Finds quieter venues or times for pools, buffet, lifts and public spaces. | Guest value: suggests a less crowded alternative without requiring the guest to wander or guess. | Validated occupancy sensors/telemetry, venue directory, forecast model. | Gate behind measured data and confidence; hide on poor feed. Measure forecast error and guest avoidance success. |
| QOL-07 | **Party Consensus Engine** | Polls a group asynchronously on dining, shore excursions, dates, meeting times and independent port plans. | Guest value: finds the option that best satisfies shared constraints and makes non-response visible without nagging. | Group roles, polling, itinerary planner, booking inventory. | Do not expose private reason or personal calendar; poll must have close date and organiser controls. Measure decision time and participation. |
| QOL-08 | **Privacy-Safe Rendezvous** | Uses named landmarks, one-time “I’m here” signals and optional short-lived ETA rather than continuous tracking. | Guest value: easier family/friend meetups with explicit control over who sees each update. | Ship map landmarks, group messaging, optional foreground location. | No background tracking default; signals expire automatically. Measure reunion friction and consent/revocation success. |
| QOL-09 | **Allergy Chain of Custody** | Tracks dietary/allergy note from guest profile through reservation, venue receipt, crew acknowledgement and meal-service confirmation where supported. | Guest value: visibility into whether the request reached a human and what remains unresolved. | Consent-scoped profile, dining/POS workflow, crew acknowledgement and escalation. | Never promise allergen safety; requires food-safety review, clear limitations and direct crew confirmation before service. |
| QOL-10 | **Accessible Route Replanner** | Recalculates ship routes using lift outages, step-free paths, door widths/gradients where known and guest-selected mobility constraints. | Guest value: fewer blocked routes and less uncertainty when an elevator or accessible route is unavailable. | Accurate indoor graph, live lift/closure feed, accessibility QA. | High verification burden; if data is incomplete show safe route uncertainty and crew contact rather than false assurance. |
| QOL-11 | **Port Return Guardian** | Combines all-aboard time, personal buffer, route/transport, excursion timing, tender status and port disruption into a live return plan. | Guest value: a calm, actionable return countdown with “leave now” reasoning and safe alternatives. | Ship-time service, excursion and tender feed, routing, notifications and port contacts. | Never guarantee vessel wait or create unsafe urgency; show source, assumptions and contact actions. Measure late-return incidents and alert accuracy. |
| QOL-12 | **Entitlement Explainer & Spend Coach** | Explains what is included for each traveller, what has been consumed and what a proposed choice will cost. | Guest value: no surprise when Plus/Premier, loyalty or prepaid credits differ by guest or item. | Single entitlement engine, POS/folio, package catalogue and guest identity. | Folio/entitlement system remains authoritative; forecast vs posted values clearly separated. Measure billing questions and package satisfaction. |
| QOL-13 | **Cabin Comfort Profile** | Stores preferred sleep temperature, housekeeping timing, pillow/quiet preferences and supported controls. | Guest value: a cabin feels more tailored across repeat voyages, with a quick way to set preferences. | Guest preference store; room-control APIs and housekeeping workflow for actionable items. | Do not show nonfunctional controls or assume requests are fulfilled. Clearly label preference vs confirmed device setting. |
| QOL-14 | **One Concierge, Many Sources** | Stanley is the single guest-facing guide; behind it, deterministic answers, reviewed quick prompts, search and then an LLM are used in that order. | Guest value: one approachable guide knows the stage, trip and plan while keeping answers affordable and grounded. | Permission-aware search, rules/FAQ cards, booking context, model gateway, cost controls, human support. | Never let the LLM invent availability, time, price or policy; transactions require confirmation and audit. Measure answer resolution, escalation and cost/task. |
| QOL-15 | **Weather-to-Plan Recomposer** | When weather or port/venue disruption affects plans, identifies impacted reservations and proposes alternatives. | Guest value: the day is re-planned without manually finding every affected booking. | Weather/operations feeds, planner conflict engine, alternative catalogue. | Suggestions do not auto-cancel or rebook; use official operational status for safety decisions. Measure replan acceptance and recovery time. |
| QOL-16 | **No-Surprise Money View** | Combines fare, deposits, instalments, prepaid add-ons, package entitlements, folio and likely remaining spend into one voyage cost view. | Guest value: understand total trip cost before sailing and spending remaining onboard. | Booking/payment, package, folio and currency services. | Keep paid, pending, forecast and optional estimates separate; reconcile against official bill. |
| QOL-17 | **Visual Ship Literacy** | A short, illustrated, ship-specific orientation that teaches deck logic and the guest’s route from cabin to common destinations. | Guest value: reduce first-day disorientation, especially on large ships and for infrequent cruisers. | Ship art, deck graph, venue directory and accessible route model. | Illustrations are not authoritative navigation; always pair with actual map and text. Measure orientation confidence and help requests. |
| QOL-18 | **Photo-to-Memory Curation** | Lets guests select photos and diary notes, then proposes a story, daily recap or port sequence. | Guest value: a useful memory product with less editing effort and full guest control. | Photo storage, metadata, consent, memory-book renderer and optional generative text. | No default facial recognition or public upload; people approve their own photos/sharing. Measure memory completion and export. |
| QOL-19 | **Travel Disruption Command Centre** | Brings flights, transfer, terminal, ship departure, missed-connection contacts, evidence and service case into one rescue view. | Guest value: one place to act when the journey to the ship breaks down. | Flight/traffic providers, booking details, port agent/shore support, CRM and notifications. | Provider status is not a rescue guarantee; show last update and human phone path. Measure recovery time and guest confidence. |
| QOL-20 | **Personal Accessibility Passport** | A reusable, guest-controlled profile of accommodation preferences shared selectively with booking, transfers, ship and excursions. | Guest value: less repetitive disclosure and fewer mismatches along the complete journey. | Consent/permission engine, profile, booking, accessibility operations and excursion partners. | Not a medical record or guarantee; guest previews recipients, can revoke, and sees acknowledgement state. |
| QOL-21 | **Voyage Time Intelligence** | A single time service resolves ship, port, destination, user-device and home time with source and governing deadline. | Guest value: eliminate missed events caused by DST/date-line confusion. | Itinerary events, trusted ship clock, port time-zone database and client display. | Never infer sailing deadline from handset clock; test DST transitions and date-line crossings. Measure time-related support incidents. |
| QOL-22 | **Service Promise Tracker** | Shows every ship/shore request owner, queue, target response, last update, next step and escalation. | Guest value: service feels accountable even when work cannot be completed immediately. | CRM/crew work management, SLA rules, push/in-app notifications and escalation paths. | Only publish realistic service targets; distinguish target from guarantee. Measure time-to-first-response and resolution. |

## 6.3 What could make the experience feel unmistakably Princess

- **Stanley as an actual guide, not a chatbot launcher:** he notices a stage transition, points to a verified next action, remembers the active sailing context and hands off with context when a human is needed. He never blocks the guest from using direct navigation.
- **Medallion-aware continuity:** when Princess-approved integrations expose Medallion/OceanCompass/OceanNow/JourneyView states, use them to enrich the Plan and Trust Ledger; the web app must not pretend it can emulate the physical Medallion.
- **Ship-specific truth:** every live feature is filtered by ship and sailing. A control, venue, queue or accessible route appears only when that ship supports it and an owner maintains the data.
- **A genuinely useful pre-cruise-to-post-cruise relationship:** the same Plan, party permissions, documents, credits, service cases and memories follow the guest through all 11 stages.
- **No coercive engagement:** calm mode, quiet notifications, no false scarcity and no forced phone adoption. The 2026 advisor research notes that not every traveller wants a smartphone-based trip, so paper, desktop, phone support and crew alternatives remain part of the service.

## 6.4 Novelty and defensibility scorecard

Use this framework during concept testing rather than asserting competitors lack a feature:

| Concept | Likely novelty as a bundled execution | Why it could be defensible | Main risk |
|---|---|---|---|
| Voyage Autopilot | High | Requires unified event, venue, walking, weather and guest-constraint data. | Wrong recommendations damage trust. |
| Voyage Trust Ledger | High | Requires transaction-level source-of-truth and operational status events. | Legacy systems may not expose enough event detail. |
| Offline Capsule Manager | Medium-high | Best-in-class content manifest, freshness and per-task offline contract. | Storage, stale content and sync complexity. |
| Port Return Guardian | Medium-high | Combines ship operations, tender, local routing and time intelligence. | Unsafe if feeds are stale or assumptions hidden. |
| Allergy Chain of Custody | High | Requires meaningful integration with dining staff workflows and acknowledgement. | Food-safety risk; requires operational validation. |
| Privacy-Safe Rendezvous | Medium | Strong privacy posture integrated with ship-specific landmarks. | Medallion and indoor-position support may vary. |
| Personal Accessibility Passport | Medium-high | End-to-end scoped sharing and acknowledgement across multiple providers. | Data correctness and partner adoption. |
| Service Promise Tracker | High | Operational ownership, SLA and escalation integrated into guest-facing status. | It exposes service gaps; operations must be ready to act. |


# 7. Cross-stage functional requirements and service foundations

These requirements apply to the entire journey and should be planned before stage-specific polish.

## 5.1 Identity, bookings, parties and permissions

| ID | Priority | Requirement |
|---|---|---|
| IDN-01 | P0 | Support secure Princess account sign-in, account recovery, session management and step-up verification for sensitive changes. |
| IDN-02 | P0 | Link a booking through verified booking data without exposing another guest's reservation through guessable booking references. |
| IDN-03 | P0 | Support duplicate-profile detection and safe account/booking reconciliation with human resolution for ambiguous matches. |
| IDN-04 | P0 | Model guest, household, booking party, cabin party, linked travel group, helper/delegate and shipmate as distinct relationships. |
| IDN-05 | P0 | Provide permissions by person and task: view itinerary, manage check-in, pay assigned amount, edit booking, see folio, see documents, message, share location. |
| IDN-06 | P0 | Parent/guardian controls for minors, age-appropriate communication, authorised pickup and consent. |
| IDN-07 | P1 | Show “who can see what” and provide immediate revoke/leave-group controls. |
| IDN-08 | P1 | Support account access for guests who booked through a travel advisor or another permitted channel. |

## 5.2 Trust ledger and transaction state

| ID | Priority | Requirement |
|---|---|---|
| TRU-01 | P0 | Maintain a guest-visible history of bookings, payments, reservations, orders, requests, itinerary changes and consent changes. |
| TRU-02 | P0 | Assign a durable receipt/reference ID to each successful material action. |
| TRU-03 | P0 | Distinguish draft, submitted, pending, confirmed, declined, cancelled, refunded, expired and failed states. |
| TRU-04 | P0 | Implement idempotent create/change/payment APIs and safe reconciliation after timeouts. |
| TRU-05 | P0 | Never replace a confirmed booking with a new booking until the new reservation is confirmed, unless the guest explicitly chooses otherwise. |
| TRU-06 | P0 | Show last-updated timestamp and source/freshness for cached or live information. |
| TRU-07 | P0 | Provide an operational status centre for app/API/ship-service incidents. |
| TRU-08 | P1 | Explain policy-based failures in plain language and provide a next step or human route. |

## 5.3 One assistant and search

| ID | Priority | Requirement |
|---|---|---|
| AST-01 | P1 | Use one assistant front door (Stanley) across stages, routing behind the scenes to planning, booking, trip, ship, policy and support data. |
| AST-02 | P1 | Answer from permission-checked source data; label source and freshness for consequential information. |
| AST-03 | P1 | Use deterministic answer cards for common trip questions before calling a model. |
| AST-04 | P0 | Ask explicit confirmation before booking, paying, cancelling, changing a reservation or sharing personal data. |
| AST-05 | P0 | Escalate urgent safety, medical, security, legal and unsupported matters to the appropriate human/service channel. |
| AST-06 | P1 | Pass conversation summary, trip context and attempted actions to human agents with guest consent. |
| AST-07 | P1 | Provide global search that returns answers/actions (e.g. tonight's dinner, Wi-Fi instructions, all-aboard time), not only page links. |
| AST-08 | P2 | Add voice input/read-aloud where supported, with keyboard and touch alternatives. |

## 5.4 Notifications and communications

| ID | Priority | Requirement |
|---|---|---|
| COM-01 | P0 | Maintain one in-app inbox for transactional, safety, itinerary and service communications. |
| COM-02 | P0 | Separate critical/service updates from marketing; marketing consent and caps must not suppress safety or transactional messages. |
| COM-03 | P0 | Support push, email, SMS and in-app channels according to consent, availability and criticality. |
| COM-04 | P0 | Critical alerts use acknowledged delivery state where supported and fallback channel rules. |
| COM-05 | P1 | Allow user-controlled categories, quiet hours and notification frequency, without disabling required safety notices. |
| COM-06 | P1 | Deep-link a notification to the exact changed booking, reservation, port or case. |

## 5.5 Offline and resilience contract

| ID | Priority | Requirement |
|---|---|---|
| OFF-01 | P0 | Define offline read/write capability per feature; do not imply all transactions can be completed offline. |
| OFF-02 | P0 | Cache boarding pass, booking essentials, emergency/muster information, daily itinerary, confirmed reservations, tickets, deck map and port pack. |
| OFF-03 | P0 | Display cache timestamp and whether content is safe to rely on; critical data includes a “verify with crew/official notice” fallback. |
| OFF-04 | P0 | Queue only safe actions; show queued/sending/sent/failed and provide conflict resolution when reconnecting. |
| OFF-05 | P0 | Retry with exponential backoff and idempotency; avoid duplicate orders, messages and payments. |
| OFF-06 | P1 | Provide low-data mode, image loading controls, no autoplay and battery-conscious refresh. |
| OFF-07 | P1 | Handle browser storage eviction/quota with export/backup guidance and graceful re-download. |

## 5.6 Accessibility and inclusion

| ID | Priority | Requirement |
|---|---|---|
| A11Y-01 | P0 | Meet WCAG 2.2 AA for responsive web, including keyboard, visible focus, logical reading order, accessible names and error handling. |
| A11Y-02 | P0 | Support screen readers (VoiceOver, TalkBack, NVDA, JAWS), 200% text resize and reflow at 320 CSS px. |
| A11Y-03 | P0 | Never rely on colour, sound, motion, drag, hover or precise gestures as the only way to complete a task. |
| A11Y-04 | P0 | Support captions/transcripts, reduced motion, high contrast and large text; include calm/simple modes. |
| A11Y-05 | P0 | Provide a documented non-app route for all safety, boarding, check-in, help and disembarkation tasks. |
| A11Y-06 | P0 | Show accessibility constraints at discovery and prebook—not after payment. |
| A11Y-07 | P1 | Test with older adults and people with visual, hearing, mobility, cognitive and neurodiverse needs in realistic cruise conditions. |
| A11Y-08 | P1 | Provide multilingual and plain-language content, with translation reviewed for safety/operational accuracy. |

## 5.7 Privacy, security and compliance

| ID | Priority | Requirement |
|---|---|---|
| SEC-01 | P0 | Minimise personal data and encrypt it in transit and at rest; define access controls and audit logs. |
| SEC-02 | P0 | Use hosted/tokenised payment methods; never store raw payment card numbers in app storage. |
| SEC-03 | P0 | Protect passport, identity, photo, health, child and location data with purpose limitation, least privilege and retention schedules. |
| SEC-04 | P0 | Provide clear consent, export, correction, deletion and marketing controls appropriate to applicable jurisdictions. |
| SEC-05 | P0 | Make location sharing opt-in, scoped by person/time/purpose, easy to stop and never silently activated. |
| SEC-06 | P0 | Apply parent/guardian safeguards and age-aware messaging controls. |
| SEC-07 | P1 | Support account-device review, sign-out everywhere, suspicious login alerts and secure account recovery. |
| SEC-08 | P1 | Complete threat modelling, penetration testing, vendor review and incident response before production. |

## 5.8 Desktop and phone parity

| ID | Priority | Requirement |
|---|---|---|
| UX-01 | P0 | Provide functional parity for account, booking, My Trips, payment, documents, planning, reservations, check-in and support across phone and desktop, except explicitly hardware-dependent functions. |
| UX-02 | P0 | Design desktop comparison and planning as a wide-screen workspace, not an enlarged mobile layout. |
| UX-03 | P0 | Ensure phone supports one-handed, time-critical tasks with primary actions in reachable zones and large targets. |
| UX-04 | P1 | Synchronise plan, saved searches, documents, preferences and case history across authenticated devices. |
| UX-05 | P1 | Provide printable/exportable views for trip pack, boarding pass, itinerary, tickets, folio and memory book. |

---

# 8. Desktop versus phone: intended division of strengths

A responsive application should not mean identical layouts at every breakpoint. It should preserve the same underlying tasks and information while optimising each surface.

| Area | Phone experience | Desktop experience |
|---|---|---|
| Dream / Discover | Swipeable inspiration, quick quiz, compact shortlist, share | Rich destination browsing, itinerary/ship/cabin comparison, price calendar, multi-column analysis |
| Book | Simple guided steps, camera scan, wallet/pay integration | Full booking review, multiple traveller/cabin comparison, detailed fare/payment audit |
| Manage | Countdown, task completion, notifications, document wallet | Household readiness board, document review, delegated tasks, trip pack printing |
| Prebook | Fast reservation, ticket, plan changes | Drag-free visual calendar, group planning, conflict analysis, package value comparison |
| Get to ship | Boarding Day Mode, offline pass, terminal wayfinding | Pre-trip check-in, review, print, flight/transfer detail and family readiness dashboard |
| Embark / Sea | Right Now, maps, chat, service requests, delivery, folio alerts | Full itinerary, daily schedule, account history, accessible plan review, photo gallery |
| Port | Three clocks, offline port pack, excursion ticket, return alert | Detailed shore-day plan, accessible excursion comparison, port research before sailing |
| Disembark | Last Morning Mode, ticket, pickup and urgent contact | Folio review, claims, export, onward travel coordination |
| Remember | Quick diary, photo selection, share card | Full trip archive, memory book editing, photo batch download, loyalty comparison and next-cruise research |

**Parity rule:** A guest should never be forced onto a phone simply because the desktop version omitted a task. Native-only or ship-hardware features may have a different execution channel, but the desktop app should still explain status, prerequisites and alternatives.

---

# 9. Architecture and integration recommendations

## 7.1 Core domain model

Model the domain around **Voyage Leg**, not a single hard-coded cruise. Minimum entities:

- Guest, account, household, child/dependent and helper/delegate.
- Booking, booking party, linked travel group, cabin and traveller.
- Ship, ship class, sailing, voyage leg, port call, sea day and itinerary event.
- Fare, package, loyalty entitlement, inventory and price quote.
- Reservation, waitlist, ticket, order, folio entry and payment transaction.
- Guest request, service case, service owner, SLA and status event.
- Document, consent, notification, offline snapshot and audit event.
- Trip plan, diary entry, photo asset, feedback and loyalty balance.

A 14-night cruise can be two connected 7-night legs; a back-to-back guest may have an intermediate turnaround, cabin move, manifest update or port day. These are data relationships, not UI exceptions.

## 7.2 Service boundaries

Create explicit provider interfaces for:

1. Identity and account.
2. Booking and sailing catalogue.
3. Pricing and inventory.
4. Payments and refunds.
5. Check-in and travel documents.
6. Reservations and queues.
7. Itinerary, ship events and venue status.
8. Medallion / OceanNow / OceanCompass / JourneyView integration.
9. Folio and package entitlements.
10. Messaging and notification delivery.
11. Guest Services and service requests.
12. Ship/port operations, tender and emergency contacts.
13. Photos, diary and loyalty.

For a concept build, these can be simulated behind the same interfaces. The simulated layer should deliberately inject realistic latency, timeouts, stale data, duplicate callbacks, reservation conflicts and service outages. A perfect mock will hide the most important product risks.

## 7.3 Entitlement engine

Do not scatter Plus/Premier, loyalty, cabin class, age and package rules throughout UI components. Centralise eligibility and consumption rules. Every screen—browse, cart, confirmation, delivery, folio and upgrade—should use the same engine and show why a benefit is included or unavailable.

## 7.4 Ship and port data governance

For each live or authored data set, store:

- Source system/provider.
- Responsible data owner.
- Effective sailing/ship/port scope.
- Last verified/updated timestamp.
- Expiry or freshness threshold.
- Confidence and provisional status.
- Offline behaviour and fallback.

This is especially important for terminal assignments, port arrival/departure, local time, tender operations, all-aboard, accessibility, customs and entry requirements.

## 7.5 PWA and native/hardware boundary

A PWA is a strong fit for a responsive guest planning and information layer. It can support installation, service-worker caching, IndexedDB, camera access, web authentication/passkeys, some push scenarios and payment redirection/hosted fields. It should not be assumed to provide:

- Reliable background location tracking.
- Full Bluetooth Low Energy integration across iOS and Android browsers.
- Universal NFC door unlock or Medallion replacement.
- Universal background sync or guaranteed background notification delivery.
- Native wallet and OS integrations without backend/platform-specific work.
- Hardware-level room control without ship device APIs.

**Recommendation:** Use the PWA for guest workflow, content, planning, communication UI and offline snapshots. Use Medallion/keycard, approved native capabilities and ship systems for hardware-dependent actions. Do not promise a web feature that requires an unavailable browser capability.

---

# 10. Delivery roadmap: risk-first, then guest value

The roadmap below assumes a concept/demo can use mock services initially, but the production architecture is designed for real Princess integration.

| Wave | Focus | What must be true at exit |
|---|---|---|
| **0 — Product and data foundation** | Confirm scope/implementation baseline; multi-ship/leg catalogue; identity model; API contracts; entitlement engine; analytics; design system; accessibility; offline strategy; trust ledger. | Data model supports several ships and linked itinerary legs. Failure states and receipt/status design are proven. Demo vs real data is unmistakable. |
| **1 — Voyage core** | My Trips, booking visibility/linking, booking/payment certainty, trip dashboard, documents, one plan, inbox, help front door. | The guest can find the trip, understand next action, complete/resume a core booking task and see what happened. |
| **2 — Choice and coordination** | Ship/itinerary/cabin comparison, group board, household permissions, split payer, package value, excursion fit, dining/allergen confidence. | A multi-cabin group can select and coordinate without sharing credentials or exposing sensitive documents. |
| **3 — Boarding and ship companion** | Check-in, Boarding Day Mode, offline boarding pass, First Four Hours, muster, deck maps, daily planner, free travel-party chat. | Critical boarding and onboard paths work in airplane mode after cache; ship Wi-Fi app tier is validated. |
| **4 — Port and disruption intelligence** | Port Day Mode, three clocks, tender/accessibility, offline port pack, traffic/flight disruptions, port support. | Port instructions are sourced, fresh, time-zone-safe and useful without roaming. |
| **5 — Ship service orchestration** | Reservation queues, OceanNow integration, request tracking, venue status, folio and family/youth flows. | Each live service has API owner, operational owner, SLA/ETA contract and outage fallback. |
| **6 — Remember and loyalty** | Diary, photos, memory book, feedback recovery, Captain's Circle, next-cruise recommendation. | Trip archive is complete, exportable and privacy-controlled; unresolved service issues suppress promotional rebooking. |
| **7 — Differentiation experiments** | Live crowd intelligence, smart-room controls, AI proactivity, richer photo/memory products, community/reunion, contextual delight. | Each experiment has verified ship/guest data, measurable lift, accessibility review and operational approval. |

## 8.1 Phase sequencing recommendations

- Do not start with AI. Start with catalogue, My Trips, trust ledger, offline and help.
- Build the one Plan and one Inbox before proliferating stage-specific screen lists.
- Build group permissions before group chat, child location or multi-cabin spend.
- Build reservation integrity before virtual queues and smart suggestions.
- Build the operational service contract before guest-facing live ETAs.
- Build diary capture and consent progressively, not as a post-cruise data scrape.

---

# 11. Release gates and measurable success

## 9.1 P0 release gates

A release is not ready because the happy-path demo works. It must pass:

1. **No silent loss:** booking, payment, reservation, order and request actions produce a durable state or a clear pending/failure state.
2. **Safe retry:** double tap, refresh, back navigation, timeout and reconnect do not create duplicate charges or reservations.
3. **Offline survivability:** boarding pass, muster card, ship itinerary, booked tickets and port pack can be opened without network after being saved.
4. **Freshness clarity:** stale cached values display age/source and a safe next step.
5. **Human recovery:** every critical error and urgent flow provides a working human route, not just a bot or FAQ.
6. **Accessibility:** top guest tasks work with keyboard, screen reader, large text, high contrast, reduced motion and without drag/hover.
7. **No app coercion:** boarding, safety, medical help and disembarkation have paper/desk/phone alternatives.
8. **Privacy:** child, location, passport, health and group-sharing scenarios pass permission and revocation tests.
9. **Cross-surface parity:** desktop and phone independently complete critical booking, manage, check-in, plan and support tasks.
10. **Operational readiness:** all live features have an owner, runbook, support path and incident status.

## 9.2 North-star outcomes

The north star should be **successful, low-effort guest task completion across the full voyage**. Supporting measures:

| Dimension | Example measure |
|---|---|
| Discovery confidence | Search-to-shortlist; shortlist-to-book; cost estimate accuracy; booking mismatch/cancel rate |
| Booking trust | Payment reconciliation failure; duplicate charge; pending-to-confirmed time; booking-link success |
| Readiness | Check-in completion by deadline; missing-document incidents; per-person task completion |
| Prebook planning | Reservation success; conflict rate; waitlist conversion; package satisfaction; unplanned spend surprise |
| Embarkation | Boarding-pass retrieval failure; check-in support contacts; time-to-cabin; muster completion |
| Onboard utility | Planner success; dining/queue wait reduction; order fulfilment; support case resolution; offline usage success |
| Port safety | All-aboard alert delivery; missed tender/ship incidents; excursion disruption resolution; accessible mismatch reports |
| Disembarkation | Folio dispute resolution; baggage guidance satisfaction; onward-transfer failure |
| Remember/loyalty | Memory creation/share; photo download completion; service recovery closure; repeat booking/referral |
| Quality and equity | Task completion by device, age band, accessibility profile, language, connection quality and booking channel |

Track **task completion**, not only app opens, clicks, chat volume or time spent. A guest who finds the answer in 10 seconds and closes the app has had a successful experience.

---

# 12. Decisions Princess should make explicitly

These are product decisions, not details to leave to screen design:

1. **Catalogue scope:** build for multiple ships and voyage legs; use one sailing as a pilot if needed.
2. **Channel parity:** which tasks are identical on web and app, and which require a native/hardware path?
3. **Free app access:** will core app functions and travel-party messaging remain free over ship Wi-Fi without purchasing a full internet plan?
4. **Group model:** who can link cabins, invite people, see plans, see balances and manage minors?
5. **Location model:** what is sourced from Medallion, what is guest-entered, and what is never collected?
6. **Service ownership:** who owns each queue, request, chat, case, allergy handoff and escalation?
7. **Entitlement authority:** which service is the single source of truth for Plus/Premier, loyalty, suite, age and package balances?
8. **AI authority:** which tasks can the assistant execute, which require confirmation and which always go to a human?
9. **Data freshness:** what is the freshness SLA for booking, folio, schedule, venue, tender and port information?
10. **Privacy and retention:** how long are identity documents, medical information, messages, location and photo data held?
11. **Accessibility and non-app parity:** who is accountable for paper, telephone, terminal and crew alternatives?
12. **Implementation baseline:** which screens/features are truly implemented, mocked, planned or simply described in the source documents?

---

# 13. The features I would deliberately not prioritise

These may be interesting later, but should not displace the core product:

- **AI as the headline differentiator.** Princess already has a public AI discovery integration. The more important work is trustworthy continuity into the actual account and voyage.
- **More static screens.** The answer to a large screen catalogue is not a larger screen catalogue. Use one plan, live tiles, contextual modes and answer cards.
- **AR ship navigation before accurate indoor routing.** A route that is wrong is worse than a simple map.
- **Always-on location tracking.** Use Medallion/approved ship location where guests choose it, explicit location-sharing controls and manual/QR meeting points. Never make passive tracking the default.
- **Face recognition in guest photo libraries.** Use guest-selected albums and explicit sharing approval unless there is a separately approved privacy and safety case.
- **Predictive live queues without real data.** A fabricated estimate is a trust failure.
- **Smart-room controls across the fleet before APIs exist.** Offer the feature by ship/cabin only when the control is actually supported.
- **Marketing offers on critical task pages.** Do not interrupt check-in, boarding, emergency, all-aboard, medical or dispute workflows.
- **Gamification that competes with calm mode.** Daily challenges, badges, Stanley tips and motion should be optional, accessible and fully suppressible.
- **A native app by default.** Start with a strong responsive PWA unless hardware integration, background capabilities, app-store distribution or ship operations demonstrate a clear native-app need.

---

# 14. Final recommendation

Princess should aim to be the cruise line whose app guests trust most—not merely the one with the most things to tap.

The strongest product is a continuous experience in which:

- Discovery gives an honest view of the cruise and its cost.
- Booking is resumable and financially safe.
- The trip is visible even when systems are imperfect.
- The entire travel party can coordinate with clear privacy boundaries.
- A single plan keeps the voyage coherent.
- Boarding, muster, ship life, port days and disembarkation work offline where they must.
- Every request has an owner and a visible outcome.
- Medallion and Princess shipboard services feel integrated, not bolted on.
- The post-cruise experience preserves memories, resolves issues and earns the next booking.

**My strongest recommendation:** make the first release prove five things exceptionally well: **My Trips always tells the truth; reservations and payments cannot silently fail; one Plan keeps the whole voyage together; the app remains useful without paid internet; and help reaches a real person when it matters.** Those five capabilities would do more to make Princess competitive than dozens of additional feature screens.

---

# Appendix A — Research sources and validation notes

The competitor comparison is based on publicly available product pages and FAQs checked on **5 November 2026**. Feature availability can vary by ship, sailing, region, account state, app version and operational rollout. These sources establish what each line publicly describes, not that every guest receives every feature on every ship.

## Princess Cruises

- [Princess Cruises App — legal feature description](https://www.princess.com/en-int/legal/princess-cruises-app) — names OceanNow, OceanCompass, OceanView, OceanReady and JourneyView; documents conditions and Medallion-related dependencies.
- [Princess OceanReady / new app overview](https://www.princess.com/en-int/plan/oceanready) — current app claims, check-in requirements, arrival groups and app/web alternatives.
- [Princess MedallionClass](https://www.princess.com/en-int/ships-and-experience/princess-medallionclass) — contactless boarding, keyless entry, OceanNow, dining, payment, wayfinding, shipmates and events.
- [Princess MedallionClass FAQs](https://www.princess.com/en-int/ships-and-experience/princess-medallionclass/ocean-faq) — check-in steps, group check-in, dependent support and app availability notes.
- [Princess Cruises AI-powered cruise planning app announcement, 28 September 2026](https://www.princess.com/en-int/news/news-releases/2026/09/princess-cruises-becomes-first-global-cruise-line-to-launch-AI-powered-cruise-planning-app) — LLM discovery, comparison, destination/ship/excursion and pricing/availability use cases.

## Competitors

- [Royal Caribbean — What is the new Royal Caribbean app?](https://www.royalcaribbean.com/faq/questions/what-is-the-new-royal-caribbean-app) — pre-cruise savings and onboard dining, excursions, chat, activities, account, maps, hours and menus.
- [Carnival — HUB app FAQ](https://www.carnival.com/help?topicid=1386) — check-in, purchases, events, maps, menus, kids/teens, queues, food delivery, free ship Wi-Fi app access and chat fee details.
- [Disney Cruise Line — Navigator app features](https://disneycruise.disney.go.com/en/faq/navigator-app/features/) — pre-cruise booking/check-in, daily calendar, personal planner, dining, deck plan, youth clubs and onboard chat.
- [Virgin Voyages — New app](https://www.virginvoyages.com/app) — check-in, dining, Shore Things, onboard activities, tailored suggestions and Sailor Services; page also notes some features remain on the prior app.
- [MSC Cruises — MSC for Me](https://www.msccruises.ca/on-board/internet-and-apps/msc-for-me) — check-in, boarding pass, excursions/dining/spa, maps, chat without internet package, onboard spending and wristband integration.
- [Celebrity Cruises — App FAQ](https://www.celebritycruises.com/faqs/celebrity-app) and [app overview](https://www.celebritycruises.com/celebrity-app) — pre-cruise add-ons, check-in, onboard reservations, maps, menus, events and account.
- [Norwegian Cruise Line — App](https://www.ncl.com/cruise-preparation/downloads/app) — check-in, reservations, itinerary, purchase history, schedule and onboard Wi-Fi app access without consuming purchased internet minutes.

## Industry context

- [Travel Market Report — 2026 Ocean Cruise Outlook](https://cdn.travelmarketreport.com/tmr/Outlooks/TMROceanOutlook2026.pdf) — reported guest/client priorities for cruise app features, including restaurant reservations, real-time updates, onboard events, check-in/out, excursions and navigation.

## Source interpretation and limitations

1. Official product pages are authoritative for what the brand currently markets, but they may not describe every ship-specific limitation or rollout state.
2. The supplied October functional draft includes third-party reviews and pain-point research. Treat the reported app ratings and complaints as qualitative signals until validated against current store listings and a representative guest sample.
3. The supplied November experience-extension document explicitly says it did not run the app or tests and did not inspect every line of the domain/server code. Its “Today” descriptions should therefore be treated as a code-and-copy inventory, not proof of end-to-end production behaviour.
4. This report adds product and architecture recommendations. It does not claim that Princess currently exposes every API needed for the proposed production product. The detailed acceptance criteria are proposed test conditions to refine with product, engineering, accessibility, safety and shipboard operations.
5. Before external launch, validate all itinerary/port/terminal/time-zone/immigration/accessibility data against official Princess and jurisdictional sources for the specific sailing.

---

# Appendix B — Suggested backlog taxonomy

Use a stable feature ID prefix and preserve a traceability link back to the two source documents and any approved business decision.

| Prefix | Domain | Example |
|---|---|---|
| DRM | Dream | DRM-03 honest estimated trip cost |
| DSC | Discover | DSC-03 cabin truth layer |
| BOK | Book | BOK-04 safe payment |
| MNG | Manage | MNG-01 My Trips source of truth |
| PRE | Prebook | PRE-01 unified Plan |
| GTS | Get to ship | GTS-02 offline boarding credentials |
| EMB | Embark | EMB-01 emergency/muster card |
| SEA | Sea | SEA-05 human help front door |
| POR | Port | POR-01 Port Day Mode and three clocks |
| DEB | Disembark | DEB-02 folio/dispute |
| REM | Remember | REM-02 trip diary |
| IDN | Identity/permissions | IDN-05 scoped permissions |
| TRU | Trust/transactions | TRU-04 idempotent transaction |
| AST | Assistant/search | AST-04 confirm-before-act |
| COM | Communications | COM-04 critical alert delivery |
| OFF | Offline/reliability | OFF-03 cache freshness |
| A11Y | Accessibility | A11Y-05 non-app parity |
| SEC | Security/privacy | SEC-03 sensitive data controls |
| UX | Cross-surface UX | UX-02 desktop workspace |

For each backlog story, add: guest outcome, source/owner system, dependencies, operational owner, priority, acceptance criteria, offline behaviour, accessibility notes, data/privacy classification, analytics event and test scenarios.


# Appendix C — Updated research references and verification notes (7 November 2026)

The links below were checked for this expanded edition. Public product pages describe marketed capability; availability can still vary by ship, sailing, geography, guest status, app version and operational rollout.

## Princess

- [Princess app feature terms](https://www.princess.com/en-int/legal/princess-cruises-app) — OceanReady, OceanNow, OceanCompass and JourneyView feature scope and Medallion dependencies.
- [Princess OceanReady overview](https://www.princess.com/en-int/plan/oceanready) — new app/web alternative, Travel Checklist, boarding QR, Arrival Groups, check-in tasks and timeline.
- [Princess Arrival Groups](https://www.princess.com/en-int/plan/oceanready/arrival-groups) — group arrival selection and availability constraints.
- [Princess AI-powered cruise planning launch, 28 September 2026](https://www.princess.com/en-int/news/news-releases/2026/09/princess-cruises-becomes-first-global-cruise-line-to-launch-AI-powered-cruise-planning-app) — conversational search and comparison across 345+ destinations and 17 ships, with pricing/availability exploration.

## Competitor official product sources

- [Royal Caribbean app overview](https://www.royalcaribbean.com/faq/questions/what-is-the-new-royal-caribbean-app) — pre-cruise packages/excursions and onboard dining, chat, events, account, maps, venue hours and menus.
- [Carnival HUB](https://www.carnival.com/hub-app) and [HUB FAQ](https://www.carnival.com/help/1152) — reservations, planner, food delivery, chat, ship Wi-Fi access, family/kids and virtual queues.
- [Disney Navigator features](https://disneycruise.disney.go.com/en/faq/navigator-app/features/) — daily calendar, personal planner, dining details, deck plan, youth facilities and chat.
- [Virgin Voyages app](https://www.virginvoyages.com/app) — check-in, dining, Shore Things, personal suggestions and Sailor Services; the official page notes some ordering functions remain in a legacy app.
- [MSC for Me](https://www.msccruises.ca/on-board/internet-and-apps/msc-for-me) — check-in, map, reservations, messaging without an internet package, expenses and supported wristband functions.
- [Celebrity app FAQ](https://www.celebritycruises.com/faqs/celebrity-app) — reservations, chat at no extra charge on Guest Wi-Fi, planner, maps, venue hours and ship-specific variation.
- [Norwegian Cruise Line apps](https://www.ncl.com/in/en/apps) — check-in, itinerary, reservations, account credits and onboard access without consuming Wi-Fi minutes.

## Industry and web-platform sources

- [Travel Market Report, 2026 Ocean Cruise Outlook](https://cdn.travelmarketreport.com/tmr/Outlooks/TMROceanOutlook2026.pdf) — advisor survey feature priorities: dining reservations, real-time updates, onboard activities, check-in/out and shore excursions; also notes that app use should not be compulsory for guests without smartphones.
- [Apple: Web Push for web apps and browsers](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers) — server push setup and iOS 16.4+ Home Screen web app support.
- [MDN: Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) — active visible-document behaviour and revocation conditions.
- [MDN: Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API) — secure-context, user-gesture and compatibility constraints.
- [MDN: Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API) — limited browser availability; unsuitable as a mandatory safety/transaction dependency.

## Interpretation notes

1. The original October 28 functional-requirements draft was a mock-only, single-Sun-Princess / single-itinerary starting point. The November 3 experience-extension record documents the later decision to support at least three ships and their 2027 itineraries, including multi-leg itinerary combinations. This expanded report therefore recommends multi-ship/multi-leg data structures from the beginning, even when a pilot exposes a smaller catalogue.
2. The November 3 extension document describes a source-code/screen inventory, not an end-to-end usability or production integration audit. The current existence of a screen or button is not evidence that its booking, payment, crew, ship or queue integration works.
3. “No one else has this” is not asserted for individual feature categories. Competitors already describe a variety of comparable functions. Differentiation here is the depth of orchestration, status integrity, accessibility, offline behaviour and privacy-safe group coordination.
4. Do not represent Princess APIs or real-time ship feeds as available until Princess confirms access, data contracts, support owner, refresh guarantees and ship coverage.
5. This is a recommendation baseline, not an approved Princess product specification. Legal, accessibility, privacy, safety, food-safety and shipboard operating requirements require review by the responsible Princess teams before release.
