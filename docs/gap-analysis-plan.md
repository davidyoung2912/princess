# Functional gap analysis and plan to close it

Status: **Proposed, for your review. No code has been changed.** Written 2026-10-29 after Phase 10, from a read of the requirements (`docs/functional-requirements.md`), the per-phase notes (`docs/design-language.md` §11 to §19), the route table, the API types, the i18n strings and keyword searches across `src`.

## 1. How this was done, and how far to trust it

- **Source of truth for the list:** every requirement ID that has its own table row in the requirements document: **248 IDs** (the document restates some IDs in §23 with a new priority; the highest priority wins, so POR-04, MNG-11 and INC-01 count as Must).
- **"Done" means** the phase notes say it was built and I found its screen or logic in the code, or a code search found it. For about 60 IDs that no phase note names, I relied on the screens and API methods that exist (for example Captain's Circle, the notifications inbox, support tickets) and did not open each file. **Treat "Done" as likely, not proven.** Section 8 names the ones I would re-check first.
- **"Partial" means** something real exists but part of the requirement text is missing. **"Not built"** means I found nothing.
- **Not measured:** the performance targets (LCP, INP, CLS) and a screen-reader and keyboard pass need a browser, which the project rules exclude. They stay open until someone runs them by hand.
- **Not run:** the real Claude API call (no key here).

## 2. Scoreboard

| Priority | IDs | Done | Done in reduced scope | Partial | Not built | Open (partial + not built) |
| --- | --- | --- | --- | --- | --- | --- |
| Must | 85 | 57 | 3 | 23 | 2 | 25 |
| Should | 133 | 52 | 1 | 24 | 56 | 80 |
| Could | 29 | 6 | 0 | 5 | 18 | 23 |
| Won't (ACC-09) | 1 | 0 | 1 | 0 | 0 | 0 |
| **All** | 248 | 115 | 5 | 52 | 76 | 128 |

**What the numbers say**
- **Must:** 60 of 85 are done. 25 are open, and two are wholly missing (ACC-02, spending alerts; SEC-03, retention and deletion). The other 23 each lack a specific piece: most often real delivery of notifications, a scan, a video, a graphic map, or real sign-in methods.
- **Should:** about half are done. The open ones are mostly on-board extras (shops, spa, shows ticketing, games), small pre-trip extras, and anything that needs a server.
- **Could:** nearly all open, as expected.
- **By kind of work** (open items only): build now 75, needs a library or device test 9, needs a real server 23, needs ship hardware or systems 5, needs a product decision 8, excluded by decision 8.

**The pattern.** Nothing is missing from the journey itself (discover, book, pre-book, check in, on board, get off, afterwards). The gaps are in four places: (1) **delivery** (push, email and SMS are simulated and the screens say so), (2) **trust and privacy plumbing** (retention, consents, real sign-in), (3) **breadth on board** (ticketing, spa, shops, games, ship information) and (4) **the safety net around the UX promises** (an offers area that is deliberately restrained, printable plans for people who do not use the app, outbox and update behaviour).

## 3. Must requirements that are not 100% done (do these first)

| ID | Requirement | Status | Built today | Still missing | Kind |
| --- | --- | --- | --- | --- | --- |
| ACC-02 | Spending alerts and limits (e.g. alert at 80% of budget), kids'… | Not built | Nothing | Spending alerts at a percentage of a budget; kids spending limits; settings and alert display on bill and Home | Build now |
| ACS-01 | Persistent accessibility profile applied across app: text size,… | Partial | Text size, contrast (standard/high), theme, reduced motion, persisted per person | Captions setting (no video yet), an explicit simple mode, and a screen-reader preference summary page | Build now |
| ACS-02 | Accessible route finder (avoid stairs, doors width, slope, tender… | Partial | Step-free marks on the deck map, accessible tours and port arrangements (POR-12) | An accessible route finder (start, end, avoid stairs, door width, slope) for ship and port | Build now |
| ACT-01 | Sign in / sign up: email + password, passkeys (WebAuthn), social… | Partial | Auth-provider abstraction; demo sign-in as a persona | Real sign-in methods: password, passkey (WebAuthn), magic link, MFA, recovery. Needs a server to be meaningful | Needs a real server |
| BOK-02 | Guest details: names matching passports, DOB, citizenship, gender… | Partial | Guest details, names, DOB, citizenship, contact, special needs | Scan-to-fill passport (camera and text recognition); shared with CHK-01 | Needs a library or device test |
| CHK-01 | Online check-in (equivalent of OceanReady) with steps: confirm… | Partial | Every step with manual passport entry, security photo guidance, saved receipt | On-device passport scan/OCR (needs a recognition library and a camera that can be tested) | Needs a library or device test |
| CNT-01 | CMS-driven content: destinations, ships, ports, venues, FAQs, with… | Partial | Authored fixtures, externalised strings, alt text on images | A content-management layer with editorial workflow; fixtures are not a CMS (by design for a mock) | Needs a real server |
| DIN-02 | Reservations: view/modify/cancel, find available tables, waitlist,… | Partial | View, move, cancel, late-arrival handling, reminders, audit trail (DIN-10) | Waitlist and virtual queue (the screen says it is not built) | Build now |
| ENT-01 | Shows, movies under the stars, live music, trivia, classes,… | Partial | Events and shows appear in the daily planner with times, venues and cost | Reservations/ticketing for shows and classes; movies, talks and live-music detail beyond the planner entry | Build now |
| INC-01 | Non-app parity and low-tech support: printable daily plan, boarding… | Partial | Helper role (consent, manage on behalf); desk/phone alternative on help screens; print for boarding pass, packing list, final bill, confirmation | Printable daily plan, itinerary and excursion tickets; large-print option; documented desk/phone alternative on every critical task | Build now |
| MNG-14 | Notifications centre; push/email/SMS preferences; critical notices… | Partial | Notifications centre with categories, channels, quiet hours, critical notices always on | Real web push or email/SMS; today a reminder only shows a date and the screen says nothing is sent | Needs a real server |
| MSG-01 | Free messaging among travel party and friends (competitive… | Partial | Free group chat with the booking and linked people, optional read receipts | Photos in chat (upload, size limits, child safeguards; see MSG-05) | Build now |
| NOT-01 | Transactional email and SMS (booking confirmation, payment due,… | Partial | Booking, payment and check-in notices recorded as "sent by email/SMS" in the account | Real delivery; templates; the screens say nothing is sent | Needs a real server |
| OB-04 | Deck plans: interactive, searchable, accessible, with "you are here"… | Partial | Searchable text deck map by deck/zone, lift banks, muster stations, step-free marks | Graphic interactive deck plan; "you are here" (a web page cannot know where on the ship it is) | Needs a product decision |
| PERF-01 | Mobile web vitals: LCP <2.5 s, INP <200 ms, CLS <0.1 on mid-range… | Partial | Route-level code splitting; first-load script 271 kB (83 kB gzip); skip link and focus handling | No measured LCP/INP/CLS and no per-route JS budget test (measuring needs a browser or a Lighthouse run, which the project rules exclude) | Needs a library or device test |
| PERF-02 | PWA: installable, service worker with versioned caching, offline… | Partial | Installable PWA, service worker, offline fallback, stale-file reload | Versioned update prompt ("a new version is ready") instead of silent auto-update; protect unsaved input during update | Build now |
| PERF-04 | Resilience on high-latency, intermittent satellite links: request… | Partial | Failure-and-retry on key actions; unsent chat text kept; saved copies with age | Request timeouts with backoff everywhere; an outbox that retries deferred actions (also NET-03) | Build now |
| PERF-08 | Battery and data frugality (reduce wake locks and polling; critical… | Partial | Few timers, polling only on live screens | No audit of timers, wake locks or polling intervals; no test that screens stop polling when hidden | Build now |
| POR-02 | All-aboard countdown with live local time vs ship time, push at 2 h /… | Partial | All-aboard card: deadline in ship and local time, three clocks, countdown, reminder points, late steps | Push alerts at 2 h / 1 h / 30 min and "ship is leaving" (needs push, see NOT-02) | Needs a real server |
| SAF-01 | Muster drill: instructions, video, assembly station, check-in… | Partial | Muster page: station, nearest lifts, check-in for all guests, five languages, alternatives | The briefing video (needs a media file and captions) | Needs a product decision |
| SEC-01 | Data minimisation, encryption in transit and at rest, secure… | Partial | CSP, no HTML injection (tested), referrer policy, key kept out of source | Encryption at rest for IndexedDB records; HTTP security headers (a meta CSP cannot set frame-ancestors); CSRF is n/a with no server | Needs a real server |
| SEC-03 | Passport/ID and biometric photo handling: purpose limitation,… | Not built | Documents are stored as entered; a wipe removes everything | Retention limits, deletion after the sail plus statutory period, access log, purpose statement for passport and photo data | Build now |
| SEC-04 | Regulatory: GDPR/UK GDPR, CCPA/CPRA, PIPEDA, Australian Privacy Act,… | Partial | Data export, wipe, supervised accounts, data-use disclosure on feedback | Consent management for all uses, cookie/storage notice, COPPA parental consent flow, region rules | Build now |
| SUP-06 | Crisis communications: itinerary disruption, weather, medical,… | Partial | Scenario banners (port skipped, tender delay, plan change), critical notices | A crisis-communications surface: severity levels, guidance steps, acknowledgement, history (shared with SAF-06, MNG-15) | Build now |
| UX-02 | Task-first, offer-restrained: required tasks (check-in, documents,… | Partial | Required tasks lead on Home; no offers on safety, emergency or checkout; no timers or false scarcity | One dedicated offers area, at most one contextual card on Home, "dismiss for this trip" on every offer | Build now |

Also Must but **done in reduced scope** by an approved decision: DIS-02, DIS-03 and DIS-04 (one cruise, one ship; no filters or comparison, §22.6). Nothing to do unless you reverse that decision.

## 4. Should requirements that are not 100% done

| ID | Requirement | Status | Built today | Still missing | Kind |
| --- | --- | --- | --- | --- | --- |
| ACC-03 | Add/remove payment method, cash deposit/credit top-up, reset PIN | Partial | Add and remove cards; pay balance | Cash deposit/credit top-up, reset PIN | Build now |
| ACC-05 | Gratuity management (adjust, prepay, remove) per policy | Partial | Gratuity adjustment on the final bill; package covers it | Prepay and remove gratuities per policy during the cruise | Build now |
| ACC-07 | Currency display and exchange rates | Not built | US dollars only | Currency display and exchange rates | Build now |
| ACS-04 | Captioned/transcribed shows (if provided), sign language interpreter… | Not built | Nothing | Captioned or transcribed shows, sign-language schedule | Build now |
| ACS-05 | Voice navigation and voice commands | Not built | Nothing | Voice navigation and commands | Needs a library or device test |
| ACS-06 | Large-print and high-contrast menu and daily plan | Partial | Large print can be requested (MNG-12) | A large-print, high-contrast menu and daily plan view and print | Build now |
| ACT-06 | Privacy centre: consents, data export, delete account, marketing… | Partial | Export my data, wipe everything, notification preferences | A privacy centre: consents list, delete account, marketing and location preferences in one place | Build now |
| ACT-08 | Language, region, currency, units, timezone handling (ship time vs… | Partial | Ship time versus home time, three clocks | Region, currency and units settings | Build now |
| BOK-09 | Multi-cabin / family / group booking with adults/children per cabin,… | Not built | Single cabin only (by scope) | Multi-cabin and group booking | Excluded by decision |
| BOK-10 | Insurance / protection offering (travel insurance,… | Not built | Not built (by scope) | Insurance / cancel-for-any-reason offer with disclosure | Excluded by decision |
| BOK-11 | Future Cruise Credit (FCC) and on-board booking credit redemption | Partial | Future cruise credit and onboard credit work in rebooking (POS-06) | FCC and credit redemption inside the booking funnel | Build now |
| BOK-12 | Loyalty: Captain's Circle number capture, tier-based pricing/perks… | Partial | Tier-based perks applied from the persona; Loyalty screen | Captain’s Circle number capture in booking and tier pricing applied at booking | Build now |
| BOK-13 | Promo codes, military/senior/resident rates (as per Princess rules),… | Not built | Not built (by scope) | Promo codes, military/senior/resident rates, best-price check | Excluded by decision |
| BOK-14 | Cruise + land packages (cruisetours) with day-by-day, lodges, rail | Not built | Dropped by decision (§22.6) | Cruisetours | Excluded by decision |
| BOK-15 | Pre-cruise hotels, transfers, air (Princess air or integrated flight… | Not built | Dropped by decision (§22.6) | Pre-cruise hotel, transfer and air upsells | Excluded by decision |
| CHK-06 | Medallion / keycard status: shipment tracking, pickup instructions,… | Not built | Nothing | Medallion/keycard shipment, pickup, activation, lost-device flow | Build now |
| CHK-07 | Live queue/terminal status (via Princess ops API if available) and… | Not built | Nothing | Live terminal queue and push when the boarding window opens | Needs a real server |
| CHK-09 | Luggage tags: print, e-tag, or order; baggage tracking (inferred, if… | Not built | Nothing | Luggage tags: print, e-tag, order, tracking | Build now |
| CHK-10 | Port-of-call pre-clearance and immigration forms (e.g. Canada… | Not built | Nothing | Port-of-call pre-clearance and immigration form guidance | Build now |
| CNT-02 | Personalised offers and merchandising by journey stage and loyalty… | Not built | Nothing | Personalised offers by stage and tier with caps and suppression (depends on UX-02) | Build now |
| CNT-03 | Analytics: funnels (search → book), check-in completion, feature… | Not built | Nothing | Consent-based analytics funnels | Needs a real server |
| CNT-04 | Experimentation framework; accessibility-safe tests | Not built | Nothing | Experimentation framework | Needs a real server |
| CNT-05 | SEO and shareability for public pages (SSR/prerender considerations,… | Not built | Nothing | SEO and Open Graph tags for public pages | Build now |
| DIN-06 | Bar menu, Plus/Premier cap tracker, drinks package status, "what have… | Partial | Package cap shown; bill shows what a package paid | A "what have I used" drinks tracker against the cap, with a responsible-alcohol alert | Build now |
| DIN-09 | Group dining: add friends to a reservation, split bill | Partial | Companions chosen on a reservation | Adding friends to a reservation as a group and splitting the bill | Build now |
| DIS-06 | Guided "Find my cruise" quiz (vibe, budget, travelling with,… | Not built | Nothing | Guided quiz (reduced by §22.6 to recommend a cabin category/package) | Build now |
| DIS-07 | Inspiration content: video, 360 tours, real guest photos/reviews,… | Not built | Nothing (text and numbers only; no media) | Inspiration content: video, 360 tours, reviews, stories | Needs a product decision |
| DIS-10 | Price alerts and deal tracking (subscribe to itinerary/ship/price… | Not built | Nothing | Price alerts for the one cruise (needs push or email to mean anything) | Needs a real server |
| DIS-15 | Request a callback / chat with a cruise consultant; find a travel… | Partial | Contact screen with callback request and tracked ticket | Find a cruise consultant or travel advisor; chat with a consultant | Build now |
| DIS-16 | Marketing consent management and lead capture (email/phone), with… | Not built | Nothing | Marketing consent capture with double opt-in | Build now |
| DIS-18 | Localisation: language, currency, units, regional itineraries and… | Not built | US English only by decision (§22 #5); strings externalised | Languages, currency and units | Excluded by decision |
| ENT-02 | Casino info, tournaments, wager games (verify regulatory limits:… | Not built | Nothing | Casino info and tournaments (jurisdictional) | Needs a product decision |
| ENT-03 | Spa, salon, fitness: book services, classes, view products, specials | Not built | Nothing | Spa, salon, fitness: services, classes, products, specials | Build now |
| ENT-05 | Games and gamification: scavenger hunts, trivia, bingo cards,… | Not built | Nothing | Games: scavenger hunts, trivia, bingo cards, achievements | Build now |
| ENT-06 | In-room TV companion: channel guide, VOD, remote, cast to TV | Not built | Stateroom TV demo control only | Channel guide, video on demand, remote, casting | Build now |
| MNG-06 | Cabin upgrade offers and bidding (bid-up/upgrade marketplace) | Not built | Nothing | Cabin upgrade offers and bidding | Build now |
| MNG-09 | Weather and climate outlook per port/date | Partial | Weather on the packing list | Climate/weather outlook per port and date as its own screen | Build now |
| MNG-13 | Special occasions (birthday, anniversary, honeymoon) with… | Partial | Occasion captured at booking and passed on | Gifts and celebration purchases (see PRE-07) | Build now |
| MNG-15 | Itinerary change handling: clear diff of what changed, options… | Partial | Port skipped and tender delay scenarios show banners | The full flow: a clear diff of what changed, options, compensation or FCC, and acknowledgement | Build now |
| MNG-18 | Fix-it flows: "I can't see my booking", "name mismatch", "lost… | Partial | Help centre answers for "I can’t see my booking", "name mismatch", "lost documents" | Guided self-service steps with escalation to a case (the answers are text only) | Build now |
| MSG-03 | Service requests with one tap: housekeeping (towels, turndown,… | Partial | Do Not Disturb, Make Up Room, cleaning and turndown times (ROM-02/03) | One-tap towels, maintenance and extra items with live status (a mock `requests` call exists but no screen uses it) | Build now |
| MSG-04 | Ship phone dialler: call cabin, call guest services (VoIP over ship… | Not built | Nothing | Ship phone dialler: call cabin, directory (VoIP over ship Wi-Fi) | Needs ship hardware or systems |
| MSG-05 | Message safeguards: report/block, parental controls, age gating,… | Not built | Supervised accounts cannot write to the crew | Report/block, parental controls in chat, age gating, moderation and retention | Build now |
| MSG-06 | Translation of messages for multilingual guests/crew | Not built | Nothing | Message translation | Needs a library or device test |
| NET-03 | Connectivity status banner (offline/slow/connected) and offline queue… | Partial | Offline banner; chat keeps unsent text | An outbox that holds requests and retries on reconnect | Build now |
| NET-04 | Data-light mode (low bandwidth, no autoplay) | Not built | Nothing | Data-light mode | Build now |
| NOT-02 | Web push for installed PWA (iOS requires Home Screen install; Android… | Not built | Nothing | Web push for the installed PWA with categories and quiet hours (needs a push server) | Needs a real server |
| NOT-04 | Notification relevance: no more than N marketing messages per week;… | Partial | Offers category and quiet hours in preferences | A weekly cap on marketing messages (n/a until offers exist) | Build now |
| NOT-05 | On-ship notifications limited by connectivity: queue and deliver on… | Not built | Nothing | Queue and deliver on reconnect; local scheduled reminders from the service worker | Needs a library or device test |
| OB-05 | Venue capacity/busyness indicators (where fed by Princess systems) | Not built | Nothing | Venue busyness indicators (fed by ship systems) | Needs ship hardware or systems |
| OB-06 | Ship info: Captain's announcements, bridge position, speed, weather,… | Not built | Nothing | Captain’s announcements, bridge position, speed, weather, noon report | Build now |
| OB-07 | Search across all content ("pool", "Italian", "bingo") | Not built | Deck map has its own search | Search across all content ("pool", "Italian", "bingo") | Build now |
| PERF-05 | Background sync (where supported), cached images, image formats… | Partial | Screens load on demand | Image formats and lazy images (the app has almost no images) | Build now |
| PERF-07 | Observability: crash/error reporting, performance RUM, feature flags,… | Partial | On-device problem log, slow-load note | Real crash/error reporting, performance RUM, feature flags and A/B tests (needs a server) | Needs a real server |
| POR-05 | Book last-minute excursions on board, with sell-out visibility | Not built | Tours can be booked until the day before, not on board | Last-minute excursions on board with sell-out visibility | Build now |
| POR-06 | Offline map and navigation for the port | Not built | Nothing | Offline map and navigation for the port | Needs a library or device test |
| POR-07 | Emergency contacts ashore: consulate, local emergency number, ship's… | Not built | Ship numbers only | Consulate, local emergency number and ship’s agent per port | Build now |
| POR-13 | Port-day readiness checklist: ID/sail-and-sign card, sun protection,… | Not built | Checklist covers pre-cruise only | Port-day readiness checklist with one-tap share | Build now |
| PRE-04 | Entertainment/shows pre-booking where applicable (Princess shows,… | Not built | Nothing | Show pre-booking (see ENT-01) | Build now |
| PRE-05 | Spa, salon, fitness, thermal suite pre-booking | Not built | Nothing | Spa, salon, fitness booking (see ENT-03) | Build now |
| PRE-07 | Gifts and amenities: flowers, champagne, cakes, stateroom decor,… | Not built | Nothing | Gifts and amenities: flowers, champagne, cakes, decor, kids’ packages | Build now |
| PRE-08 | Activities and kids/teen clubs registration (Camp Discovery, Teen),… | Not built | Club check-in on board (SAF-05) | Kids’ and teen club registration with health, allergy and pick-up authorisation before sailing | Build now |
| PRE-09 | Casino and gaming pre-registration (age/ID) (verify availability) | Not built | Nothing | Casino pre-registration (age/ID) | Needs a product decision |
| PRE-10 | Prepaid gratuities and onboard credit purchase | Not built | Gratuities inside Plus/Premier only | Prepaid gratuities and onboard credit purchase | Build now |
| PRE-11 | Cart, saved items, price drop notifications on add-ons (if price… | Partial | Excursion cart; add-on price-drop credit (PRE-17) | A single saved-items cart across excursions, dining and add-ons | Build now |
| PRE-14 | Sold-out waitlists with auto-booking on release | Not built | Nothing | Sold-out waitlists with auto-booking on release | Build now |
| ROM-04 | Digital keycard/door unlock — Medallion/keycard only (browser cannot… | Not built | Nothing | Digital door unlock (Medallion/keycard only; a browser cannot do it) | Needs ship hardware or systems |
| ROM-06 | Cabin-to-cabin: invite to a cabin party | Not built | Nothing | Cabin-to-cabin party invites | Build now |
| SAF-04 | Man-overboard / security reporting channel | Not built | Nothing | Security and man-overboard reporting channel | Build now |
| SAF-06 | Alerts: weather, itinerary change, medical, safety announcements as… | Partial | Critical notices in the centre; scenario banners | High-priority alerts with acknowledgement and a record | Build now |
| SEC-06 | Fraud and abuse controls: bot protection, rate limiting, account… | Not built | Nothing | Bot protection, rate limiting, suspicious-login alerts (needs a server) | Needs a real server |
| SEC-07 | Health data (e.g. medical declarations): treat as sensitive, minimal… | Partial | Health reports stored under the reporter only | Segregation and minimisation rules written down and tested; medical declarations | Build now |
| SEC-08 | Accessibility and privacy of minors' data (parent-managed) | Partial | Supervised child accounts cannot see account or write to crew | Parent-managed minors’ data rules (export, deletion, photo consent) written down and tested | Build now |
| SEC-10 | Responsible disclosure policy and periodic pen test | Not built | Nothing | Responsible disclosure policy (a security.txt and page) and periodic pen test | Needs a product decision |
| SHP-01 | Onboard shops, catalogue, offers, pre-order for pickup, gift cards | Not built | Nothing | Onboard shops, catalogue, pre-order, gift cards | Build now |
| SHP-04 | Art auctions, jewellery events, bingo packages, daily specials | Not built | Nothing | Art auctions, jewellery events, bingo packages, specials | Build now |
| SHP-06 | Religious and community services, meetups (e.g. Catholic Mass,… | Not built | Nothing | Religious and community services, meetups | Build now |
| SUP-04 | Status page: app/system status and known issues (e.g. dining booking… | Not built | Nothing | Status page and known issues | Build now |
| SUP-05 | In-app feedback and bug report with screenshot | Not built | Nothing | In-app feedback and bug report with screenshot (a report could use the problem log) | Build now |
| SUP-07 | Vulnerable guest support: assisted booking, caregiver role,… | Partial | Helper role and supervised accounts | Assisted booking and a bereavement/medical-cancellation flow | Build now |

## 5. Could and Won't requirements that are not done

| ID | Requirement | Status | Built today | Still missing | Kind |
| --- | --- | --- | --- | --- | --- |
| ACT-09 | Digital wallet pass for loyalty card | Not built | Nothing | Loyalty card wallet pass | Needs a real server |
| BOK-16 | Book on behalf of others; agent-assisted booking handoff | Partial | Helper role covers some of this | Book on behalf of others; agent handoff | Excluded by decision |
| BOK-17 | Waitlist for sold-out cabins and notification | Not built | Nothing | Waitlist for sold-out cabins | Excluded by decision |
| CHK-11 | Express boarding via biometric (face) match — depends on Princess's… | Not built | Nothing | Biometric express boarding (ship systems) | Needs ship hardware or systems |
| CNT-06 | User-generated content moderation (reviews, photos) | Not built | Nothing | User-generated content moderation | Needs a real server |
| DIS-12 | Cruise-cost calculator: fare + excursions + packages + flights/hotel… | Partial | Package calculator exists (PRE-06) | Whole-trip cost calculator with flights and hotel | Build now |
| DIS-13 | Virtual ship tour, cabin 360, "view from balcony" at ports | Not built | Nothing | Virtual ship tour, cabin 360 | Needs a product decision |
| DIS-14 | Social proof: ratings by ship/itinerary from verified past guests | Not built | Nothing | Verified-guest ratings | Needs a real server |
| DIS-17 | Group/shared planning board (invite friends/family to a wish list;… | Not built | Nothing | Shared wish list and voting | Needs a real server |
| ENT-07 | Social: find events with interests, groups (solo travellers, LGBTQ+… | Not built | Nothing | Social groups and friend finder | Needs a real server |
| ENT-08 | Live-show "now playing" and wait-in-line alerts | Not built | Nothing | Live-show "now playing" and queue alerts | Needs a real server |
| ENT-09 | Augmented reality ship tour / navigation (camera-based; PWA limits… | Not built | Nothing | Augmented reality tour (PWA limits) | Needs ship hardware or systems |
| MNG-16 | Travel party coordination: invite co-travellers, see who has… | Partial | Chat with the party; check-in status per guest | Invites, shared notes | Build now |
| MNG-17 | Add to Apple/Google Wallet and calendars | Partial | Calendar file; simulated wallet pass | Real Apple/Google Wallet pass (needs signing keys) | Needs a real server |
| MNG-19 | Pre-cruise health and comfort preparation: motion-sickness tips,… | Not built | Nothing | Motion-sickness tips, medicines to pack, insurance reminders | Build now |
| MSG-07 | Share location with friends (opt-in per person/time), meeting-point… | Partial | Family locator is simulated (SAF-05) | Share location with friends, meeting-point drops | Needs a library or device test |
| POR-09 | Local currency converter, translation helper (tools using on-device… | Not built | Nothing | Currency converter and translation helper | Needs a library or device test |
| POR-10 | Port ratings and guests' tips | Not built | Nothing | Port ratings and guests’ tips | Needs a real server |
| POS-09 | Review syndication (to Princess pages, with consent) | Not built | Nothing | Review syndication | Needs a product decision |
| POS-10 | Community: past-guest groups, ship alumni, cruise forums moderated by… | Not built | Nothing | Past-guest community | Needs a real server |
| POS-13 | Gifting: give a cruise credit or gift card | Not built | Nothing | Gifting a cruise credit | Build now |
| PRE-13 | Shared itinerary: friends and family see and join excursion/dining… | Not built | Nothing | Shared itinerary for friends and family | Needs a real server |
| SHP-05 | Cabin delivery of purchases | Not built | Nothing | Cabin delivery of purchases | Build now |

ACC-09 (Won't) stays out: a browser cannot take contactless payments, and the Medallion remains the payment device.

## 6. Open items by kind of work

| Kind | Items | Notes |
| --- | --- | --- |
| Build now | DIS-06, DIS-12, DIS-15, DIS-16, BOK-11, BOK-12, MNG-06, MNG-09, MNG-13, MNG-15, MNG-16, MNG-18, PRE-04, PRE-05, PRE-07, PRE-08, PRE-10, PRE-11, PRE-14, CHK-06, CHK-09, CHK-10, OB-06, OB-07, SAF-04, SAF-06, DIN-02, DIN-06, DIN-09, ENT-01, ENT-03, ENT-05, ENT-06, POR-05, POR-07, ACC-02, ACC-03, ACC-05, ACC-07, NET-03, NET-04, MSG-01, MSG-03, MSG-05, SHP-01, SHP-04, SHP-05, SHP-06, ROM-06, ACS-01, ACS-02, ACS-04, ACS-06, POS-13, ACT-06, ACT-08, SUP-04, SUP-05, SUP-06, SUP-07, PERF-02, PERF-04, PERF-05, PERF-08, SEC-03, SEC-04, SEC-07, SEC-08, CNT-02, CNT-05, NOT-04, UX-02, INC-01, POR-13, MNG-19 | Plain TypeScript and React against the mock API. No new dependency. |
| Needs a library or device test | BOK-02, CHK-01, POR-06, POR-09, MSG-06, MSG-07, ACS-05, PERF-01, NOT-05 | Passport scan needs text recognition and a real camera; the offline port map, translation and voice need libraries and a device. |
| Needs a real server | DIS-10, DIS-14, DIS-17, MNG-14, MNG-17, PRE-13, CHK-07, ENT-07, ENT-08, POR-02, POR-10, POS-10, ACT-01, ACT-09, PERF-07, SEC-01, SEC-06, CNT-01, CNT-03, CNT-04, CNT-06, NOT-01, NOT-02 | Push, email and SMS delivery, real sign-in methods, analytics, experiments, error reporting, a CMS, rate limiting. The mock cannot make these true. |
| Needs ship hardware or systems | CHK-11, OB-05, ENT-09, MSG-04, ROM-04 | Busyness feeds, door unlock, ship phones, biometrics, AR. |
| Needs a product decision | DIS-07, DIS-13, PRE-09, OB-04, SAF-01, ENT-02, POS-09, SEC-10 | Casino, media (video, 360), review syndication, security disclosure wording, graphic deck plan and muster video content. |
| Excluded by decision | DIS-18, BOK-09, BOK-10, BOK-13, BOK-14, BOK-15, BOK-16, BOK-17 | Cut by §22.6 or the language decision. Reverse the decision first if you want them. |

## 7. Proposed plan

The same rules as before: one phase at a time, tests with each, `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` to verify, commit and stop after each phase, and nothing started until you ask. Each phase lists the requirements it closes, so the scoreboard can be re-counted at the end.

**Phase 11: Close the Must gaps that need only code** (closes every "Build now" Must item)
- *Money and offers:* ACC-02 (budget and alerts, kids’ limits), UX-02 with CNT-02 and NOT-04 (one offers area, at most one Home card, "dismiss for this trip", per-week cap, none on safety, emergency or checkout screens).
- *Low-tech parity:* INC-01 and ACS-06 (print layouts for the daily plan, itinerary and excursion tickets, a large-print option, the desk or phone alternative on every top task), ACS-01 (simple mode, captions setting) and ACS-02 (accessible route finder for ship and port).
- *Queues and tickets:* DIN-02 (waitlist and a virtual queue), ENT-01 (reserve and ticket shows and classes).
- *Disruption:* SUP-06 with SAF-06 and MNG-15 (one disruption flow: what changed, options, compensation, acknowledgement, a record).
- *Privacy:* SEC-03, SEC-04 and ACT-06 (retention rules and deletion after the sail, a privacy centre with consents, storage notice, parental consent for under-13s).
- *Resilience:* PERF-02 (update prompt that protects unsaved input), PERF-04 with NET-03 (timeouts, backoff, an outbox), PERF-08 (timer audit and a test).
- Exit check: all of Section 3 marked Done except the items that need a library, a server or a decision.

**Phase 12: Should gaps, on board** (OB-06, OB-07, SAF-04, MSG-03, MSG-05, DIN-06, DIN-09, ENT-03, ENT-05, POR-05, POR-07, POR-13, ACC-03, ACC-05, ACC-07, SHP-01, SHP-04, SHP-06, ROM-06, ACS-04, SUP-04, SUP-05, NET-04, plus MSG-01 photos in chat, ENT-06 and PERF-05)

**Phase 13: Should gaps, before and after the cruise** (DIS-06, DIS-15, DIS-16, BOK-11, BOK-12, MNG-06, MNG-09, MNG-13, MNG-18, MNG-19, PRE-04, PRE-05, PRE-07, PRE-08, PRE-10, PRE-11, PRE-14, CHK-06, CHK-09, CHK-10, SEC-07, SEC-08, CNT-05, ACT-08, SUP-07)

**Phase 14: Library and device work** (needs a decision to add dependencies and a way to test on a device, since the project rules rule out browser testing)
- BOK-02 and CHK-01 passport scan; POR-06 offline port map; MSG-06 translation; ACS-05 voice; NOT-05 local reminders; PERF-01 measured against real devices and a JS budget test.

**Phase 15: Make it real (a server)**, only if you want this to leave the concept stage
- A small server for the Claude key (the standing hardening step, §22.2), real sign-in (ACT-01), push, email and SMS (NOT-01, NOT-02, MNG-14, POR-02, CHK-07, DIS-10), error reporting and analytics (PERF-07, CNT-03, CNT-04), rate limiting (SEC-06), a content layer (CNT-01), security headers and encryption (SEC-01). This is a different project from the front end and needs its own plan.

**Backlog, not scheduled (Could-haves and social features):** DIS-12, DIS-14, DIS-17, MNG-16, MNG-17, PRE-13, ENT-07, ENT-08, POR-09, POR-10, MSG-07, SHP-05, POS-10, POS-13, ACT-09, CNT-06. Pick from these after Phase 13 if there is appetite.

**Left out on purpose:** the hardware items, the media-heavy items (video, 360, AR), the Could-haves that need other people (community, reviews) and anything excluded by the single-cruise decision. List them again if scope changes.

## 8. Things I am least sure about (check these first)

- IDs I marked Done without opening the code, relying on the phase notes and screen names: ACT-02 (merging duplicate profiles), ACT-04, MNG-03 (pay by others via link), OB-08 (bookmarked items notifying on change), DIN-03, ROM-05, SAF-05, POS-05, POS-06, PERF-06.
- **Done in the notes but with simulated delivery:** anything that says "a reminder" or "notified" (checklist, packing reminders, CHK-04 Wallet pass, BOK-07 email and SMS) shows the intent only. If you count simulated delivery as not done, MNG-07, BOK-07 and CHK-14 move to Partial.
- **Priorities:** the document’s two priority views differ for a few IDs (POR-04, MNG-11, INC-01, CHK-13 to CHK-15). I used the raised priority.
- **Scope reductions:** I counted DIS-02, DIS-03, DIS-04 and DIS-08 as done in reduced scope only because §22.6 says so.

## 9. Decisions I need from you before Phase 11

1. Do you want the **offers area** (UX-02) at all? It is a Must, but it means building something the product also chooses to restrain.
2. For items that **need a server** (Section 6), do you want a Phase 15 later, or should the concept stay front-end only and those items be recorded as out of scope?
3. For **media** (muster video, graphic deck plan, 360), will you supply assets, or should text and simple drawings stand in?
