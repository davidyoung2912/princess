# Sun Princess — Ship Profile (Research Draft v0.1)

Purpose: the single supported vessel for the concept app. This profile is the content source for ship, deck-plan, venue, stateroom, entertainment and itinerary fixtures (mock data).
Date: 2026-10-28

## Confidence key

- **[F]** Princess official fact sheet (princess.com Sun Princess fact sheet).
- **[R]** Review/guide/trade press (single or multiple secondary sources).
- **[?]** Sources conflict or only one weak source; verify before showing as fact. In the app these should be authored fixtures, not claims.
- **Not found**: no usable data in research; we author representative fixtures and flag as illustrative.

Deck numbers for most venues come from one review (Quiltripping) and are **[R]**; the official fact sheet gives few deck numbers. Do a deck-plan verification pass (see §13) before building the deck-plan UI.

---

## 1. Vessel basics

| Attribute | Value | Source |
| --- | --- | --- |
| Class | Sphere class (first of two; sister: Star Princess) | [F][R] |
| Builder | Fincantieri, Monfalcone, Italy | [F] |
| Entered service | 2024 | [R] |
| Gross tonnage | 177,882 | [F] |
| Length / width / height | 1,133 ft / 139 ft / 200 ft | [F] |
| Speed | 22 knots max | [F] |
| Propulsion | Dual-fuel LNG and marine diesel | [R] |
| Guests | 4,300 lower berths (up to ~5,200–5,400 maximum) | [F][?] |
| Crew | 1,600 (one source says ~1,700) | [F][?] |
| Decks | 21 (Wikipedia says 20; 17 guest decks) | [F][?] |
| Staterooms | 2,157 incl. 80 suites; 51 accessible; 100 connecting | [F] |
| Signature feature | Glass suspended "Sphere" over the three-level Piazza; glass-enclosed Dome | [F][R] |
| Elevators | Six banks (A–F) with touchscreens that assign a car; interactive deck maps by each bank | [R] |

---

## 2. Staterooms

| Category | Notes | Source |
| --- | --- | --- |
| Interior | ~135–145 sq ft | [R] |
| Premium Oceanview (no balcony) | ~215 sq ft | [R] |
| Balcony (Deluxe) | ~236 sq ft typical; two singles convertible, sofa bed, desk, mini-fridge, USB outlets, large closet, glass shower; motion-sensing bathroom light | [R] |
| Mini-Suite | Exists (incl. Sanctuary Mini-Suites, grade M1; Cabana Mini-Suite listing); size not found | [R] |
| Signature Suite | ~270 sq ft with ~35 sq ft balcony | [R][?] |
| Signature Owner's Suite | ~565 sq ft | [R][?] |
| Sky Suite | ~1,260 sq ft with balcony (largest) | [R][?] |
| Accessible | 51 staterooms | [F] |
| Connecting | 100 staterooms | [F] |
| Balcony counts | Sources conflict (1,042 vs 1,518) | [?] |

**Sanctuary Collection** [F]: 215 staterooms in total — 80 Signature Collection Suites, 123 Mini-Suites, 12 Premium Deluxe Balconies. Guests get access to The Sanctuary and the Princess Premier bundle.

Fixtures needed: category codes, price ladders, cabin numbers per deck, view type (obstructed, Piazza view, aft wake view), proximity notes ("cabins to avoid": noise, above/below venues). Not found: authoritative full category list with codes — author illustrative codes and mark as concept data.

---

## 3. Dining (included in fare)

| Venue | Deck | Capacity | Notes | Source |
| --- | --- | --- | --- | --- |
| Soleil Dining Room | 6 aft | 941 | Traditional fixed seating (reported 5:00 pm / 7:30 pm) | [F][R] |
| Eclipse Dining Room | 7 aft | 664 | Anytime dining, reservable or walk-in; same menu as Soleil; houses Chef's Table | [F][R] |
| All American Dining Room | 8 | 326 | Listed in fact sheet; limited detail | [F] |
| Horizons Dining Room | — | (reviews: ~1,931 cap.) | Named in some guides, **not** in the fact sheet | [?] |
| The Eatery | 9 | 742 | Main buffet with international and made-to-order stations | [F][R] |
| Americana Diner | 9 aft | — | Included, family-friendly; breakfast all day / dinner | [R] |
| The Lido (Lido Eats) | 17 | 414 | Lido Greens, Grill, Slice, Tacos; Coffee & Cones | [F][R] |
| Promenade Dining | 9 aft (outdoor) | 570 | Promenade Grill, Slice, Ice Cream; alfresco | [F][R] |
| International Café | 9 midship | 20 | 24-hour; food included, specialty coffee extra | [F][R] |
| Room service | — | — | 24-hour; one-time delivery fee unless Plus/Premier | [F] |

## 4. Dining (specialty and casual, fee-based)

| Venue | Deck | Cap. | Cuisine / notes | Price | Source |
| --- | --- | --- | --- | --- | --- |
| Alfredo's Pizzeria | 9 (Piazza) | 88 | Neapolitan pizza; casual: 4 meals with Plus, unlimited Premier | $14.99 3-course without a package [R] | [F][R] |
| O'Malley's Irish Pub | 7 | 86 | Pub fare, whiskey flights; casual (same package terms) | $14.99 [R] | [F][R] |
| Crown Grill | 7 aft | 132 | Steakhouse | Not found | [F][R] |
| Sabatini's | 8 aft | 116 | Italian trattoria | Not found | [F][R] |
| The Catch by Rudi | 7 midship | 88 | Seafood with Chef Rudi Sodamin | Not found | [F][R] |
| Butcher's Block / Table by Dario | 7 | 88 | Dario Cecchini steakhouse; fact sheet spells it both ways | Not found | [F][R] |
| Makoto Ocean | 8 | 70 | Edomae sushi, Makoto Okuwa; Japanese spirits | Not found | [F][R] |
| Umai Teppanyaki and Umai Hot Pot | 8 | 57 each | Teppanyaki performance; hot pot | Not found | [F][R] |
| Love by Britto | 17 aft | 68 | Prix fixe, artist Romero Britto, wake-view | Not found | [F][R] |
| Chef's Table | 7 (Eclipse) | small | Curated multi-course with wine pairings | Not found | [R] |
| Sanctuary Restaurant | 8 aft | — | Sanctuary guests only | Included for Sanctuary | [R] |
| Reserve Collection Restaurant / Signature Restaurant / Signature Lounge | Decks 15–16 aft | 180 / 124 / flexible | Premium venues for suite/Sanctuary guests | — | [F][R] |

Celebrity collaborations [F]: Rudi Sodamin (The Catch), Dario Cecchini, Romero Britto, Makoto Okuwa, Rob Floyd (Good Spirits at Sea), Gerard Bertrand (wine tasting), Darren McGrady (Royal Afternoon Tea).

Counts of venues vary by source (17 / 28 / 30) because of what counts as a venue — author our own catalogue from this list.

Packages [R]: Plus = four casual meals; Premier = unlimited casual and specialty subject to availability. See main requirements doc for package details.

## 5. Bars and lounges

| Venue | Capacity | Deck / location | Source |
| --- | --- | --- | --- |
| Good Spirits at Sea (Rob Floyd) | 40 | 7 fwd | [F][R] |
| Bellini's Cocktail Bar | 55 | 7 Piazza | [F][R] |
| Coffee Currents | 55 | 7 Piazza | [F][R] |
| Sea View Bar | 60 | 17 fwd | [F][R] |
| Wheelhouse Bar | 70 | 7 aft | [F][R] |
| Crooners (jazz, vintage radios) | 86 | 8 Piazza | [F][R] |
| Coffee & Cones | 150 | 17 | [F][R] |
| Lido Bar | 150 | 17 | [F][R] |
| Sun Bar | 150 | 18 fwd | [F][R] |
| The MIX | 150 | 17 | [F][R] |
| Cascades Bar | — | 17 (Dome entrance) | [F][R] |
| Promenade bars | — | 9 aft (outdoor) | [F][R] |
| Wake View Terrace bar | 100 (terrace) | 8 aft | [F][R] |
| Princess Live! (bar, bingo, comedy) | 200 | 7 fwd | [F][R] |
| Spellbound by Magic Castle (magic + mixology) | — | 8 fwd (no longer includes dinner) | [F][R] |

## 6. Entertainment and public spaces

| Venue | Capacity | Notes | Source |
| --- | --- | --- | --- |
| Princess Arena | 990 (≈900 seats reported) | Decks 7–8 fwd; three configurations (proscenium, keyhole 270°, in-the-round) | [F][R] |
| The Dome | 250 | Glass geodesic dome (Santorini-inspired); pool by day, acrobatic theatre by night (Cirque Éloize), DJ dance party late; decks 17–18 | [F][R] |
| The Piazza | 300 | Three levels (decks 7–9) under the Sphere; live music, game shows, roaming performers, Champagne Waterfall (reported) | [F][R] |
| Princess Casino | — | Deck 8 fwd | [F][R] |
| Movies Under the Stars | — | Poolside screen | [F] |
| Signature Sun Deck / Signature Suite Lounge | — | Suites; decks 15–16 aft | [F][R] |

**Shows (pre-launch announcements, may have changed) [?]:** Arena productions "Vallora, A Pirate Quest", "Stage Struck", "Viva La Música", and reimagined "Fiera!"; Dome shows from Cirque Éloize: "Blue", "Come Fly Away", "Artbeat". Standard Princess events: Sailaway Party, Welcome Show, themed deck party, game shows, Farewell show. Verify current lineup; for the concept we author a plausible weekly programme.

## 7. Outdoor, pools, sports

| Item | Details | Source |
| --- | --- | --- |
| Pools | 5 per fact sheet: two Lido pools, Dome pool (indoor/outdoor), Sanctuary Pool, Wake View infinity pool (other sources say 4) | [F][?] |
| Hot tubs | 9 | [F][R] |
| Sea View Terrace | 206 capacity, forward | [F] |
| Wake View Terrace | 100 capacity, aft, infinity pool | [F] |
| The Sanctuary | 200 capacity, top-deck adults retreat for Sanctuary guests, 18 | [F][R] |
| Sport Court and track | Deck 19; 7 laps ≈ 1 mile; basketball/pickleball; shuffleboard; chess; hammocks | [R] |

## 8. Spa, fitness, shops, services

| Item | Details | Source |
| --- | --- | --- |
| Lotus Spa | Two-story; treatment rooms deck 5, entrance deck 6; heated massage pool, heated loungers, wet and salt saunas (thermal suite is likely extra-fee) | [F][R] |
| Lotus Salon | Deck 18 midship | [F][R] |
| Fitness Center, Fitness Studio, Wellness Studio | Deck 18 midship | [F][R] |
| Shops of Princess | 5,800+ sq ft across two decks (7–8), 200+ brands; Breitling Boutique, Fine Timepieces (Longines, Rado, Tissot, Hamilton, pre-owned Rolex), Beauty & Wellness (Chanel, Dior, Lancôme, Estée Lauder, etc.) | [F] |
| Guest Services | Deck 6 forward | [R] |
| Medical Center | Deck 4 forward | [R] |
| Shore Excursions + Photos + Future Cruise & Loyalty desks | Deck 9 midship | [R] |
| OceanFront (Medallion help/accessories) | Deck 8 midship | [R] |
| The Landing (embarkation) | Deck 4 midship | [R] |
| Self-service laundry | Most cabin decks | [R] |

## 9. Kids, teens, families

| Venue | Ages | Deck | Source |
| --- | --- | --- | --- |
| Family Play Times | 6 months–2 with parent | Firefly Park | [F] |
| Firefly Park | 3–7 (some sources say ≤7) | 6 fwd | [F][R] |
| Neon Grove Tweens Club | 8–12 | 7 fwd | [F][R] |
| The Underground Teen Lounge | 13–17 | 7 fwd | [F][R] |

Sanctuary is adults-only (16+ reported) [?].

## 10. Technology on board

- Princess Medallion / OceanMedallion ecosystem: keyless doors, OceanNow, OceanCompass, MedallionNet (see main requirements doc §2).
- Touchscreen elevator dispatch (six banks) and interactive deck maps by elevators [R].
- Interactive portals (Medallion-aware screens) [R, fleet-wide].
- Starlink-backed "Max" internet tier with Plus/Premier [R, from fleet-wide sources].

## 11. Itineraries and the single supported cruise

### 11.1 Why this cruise

No source publishes popularity or sales rankings, so "most popular" cannot be proven. The choice is a judgement from available evidence:

- Fort Lauderdale is the ship's winter homeport, and the 7-night Caribbean round trip is the standard product.
- **7-night Western Caribbean with Mexico** is a recurring fixed itinerary (about nine scheduled sailings Nov 2026 – Mar 2027, plus a holiday variant on 27 Dec 2026) with the only published "from" fare (about $1,539 pp) among the Caribbean listings reviewed.
- The longer 14-night Adventurer runs more often (23 sailings) but is a niche, longer product; the 7-night Eastern Caribbean (with Puerto Rico) has a similar sailing count (9).
- It mixes a dock port (Cozumel), a tender port (Belize City) and a dock/anchor port (Roatán), plus two consecutive sea days — good coverage for the product's port, tender and sea-day features.

**Decision (pending your confirmation): the only bookable cruise is the 7-night Western Caribbean with Mexico, round trip from Fort Lauderdale (Port Everglades), on Sun Princess.**

### 11.2 Reference itinerary (sailing 21–28 March 2027) [?]

Port order and times vary between sailings and between sources; this is the authored reference timeline.

| Day | Date | Port | Arrive | Depart | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Sun 21 Mar | Fort Lauderdale (Port Everglades) | — | 3:00 PM | Embarkation; muster drill; sail-away |
| 2 | Mon 22 Mar | At sea | — | — | |
| 3 | Tue 23 Mar | Cozumel, Mexico | 7:00 AM | 5:00 PM | Pier |
| 4 | Wed 24 Mar | Belize City, Belize | 7:00 AM | 5:00 PM–6:00 PM [?] | Tender port |
| 5 | Thu 25 Mar | Roatán, Honduras | 8:00 AM–9:00 AM [?] | 5:00 PM–6:00 PM [?] | Mahogany Bay / Coxen Hole [?] |
| 6 | Fri 26 Mar | At sea | — | — | |
| 7 | Sat 27 Mar | At sea | — | — | Packing, luggage tags, farewell show |
| 8 | Sun 28 Mar | Fort Lauderdale | 6:00 AM | — | Disembarkation |

Alternative orderings seen in listings (Cozumel → Belize → Roatán; Roatán → Belize → Cozumel; a variant with Princess Cays and Roatán/Cozumel). The app fixes one order.

### 11.3 Excluded sailings (not supported)

Eastern Caribbean, 14-night Adventurer, transatlantic, Mediterranean, cruisetours and all other itineraries. The app has no cruise search across itineraries: Discover and Book revolve around this one cruise and its sailing date(s).

### 11.4 Facts to author for the ports

- Cozumel: pier, shopping, Mayan ruins and beach clubs, snorkelling.
- Belize City: tender, Altun Ha, cave tubing, Belize Barrier Reef, Lamanai.
- Roatán: Mahogany Bay or Coxen Hole, beaches, snorkelling, zip lines, wildlife.
- Excursion catalogue, prices, meeting points, durations, accessibility ratings: authored fixtures (not found in research).

## 12. Implications for the product

1. **Single ship simplifies content** and lets us build a genuinely detailed deck plan, venue catalogue and per-venue capacities (also feeds virtual queues, busyness indicators, the Find-My-Kid locator and smart-room control).
2. **Rich venue data already exists** (capacity per venue, hours to author) — enough for virtual queue and reservation simulations.
3. **Decks 6–9 are the social core** (guest services, Piazza, dining, excursions desk, shops); **17–19 are the recreation core** (Dome, Lido, pools, sport). Deck-plan design should treat these as the primary navigation surfaces.
4. **Piazza and Dome programmes** drive the daily planner; the schedule must reflect the Arena (two configurations of show times), Dome (day pool / night shows), Spellbound (separate ticketed experience).
5. **Sanctuary Collection** (215 staterooms) creates a distinct guest segment with different venues (Sanctuary Restaurant, Signature Lounge, Sanctuary Club) and bundled Premier — the app must handle both entitlement sets.
6. **Kid venues** map to Find-My-Kid zones: Firefly Park (6), Neon Grove and Underground (7).

## 13. Research gaps and verification pass

- Full deck-by-deck plan (official PDF) to confirm venue decks and forward/midship/aft positions.
- Stateroom category codes, counts, and prices; view obstruction notes.
- Current show titles and daily programme; show times; Spellbound pricing and format.
- Specialty restaurant prices and hours; drink prices; package current inclusions.
- Official imagery and branding assets and their usage terms (concept app; see main doc §22).
- Reconcile conflicts: decks (20 vs 21), crew (1,600 vs 1,700), pool count (4 vs 5), Horizons Dining Room existence, Firefly Park age band.

## Sources

- Princess Sun Princess fact sheet: https://www.princess.com/news/backgrounders-and-fact-sheets/sun-princess-fact-sheet
- Princess Cruises Blog restaurant guide: https://www.princesscruisesblog.com/blog/sun-princess-complete-restaurant-guide
- Quiltripping Sun Princess review (deck layout): https://quiltripping.com/sun-princess-review-with-cruise-tips/
- Sun Princess (2024), Wikipedia: https://en.wikipedia.org/wiki/Sun_Princess_(2024)
- The Travel, Sun Princess guide: https://www.thetravel.com/cruises/princess-cruises/sun-princess/
- Cruise Passenger, Sun Princess guide: https://cruisepassenger.com.au/princess-cruises/sun-princess/
- Cruise Critic / Nautical Flock / CruiseLine dining listings: https://www.cruisecritic.com/cruise/princess/sun-princess/dining · https://www.nauticalflock.com/ships/sun-princess/dining · https://cruiseline.com/ship/sun-princess/features/dining
- CruiseMapper cabins: https://www.cruisemapper.com/cabins/Sun-Princess-2167
- Cruise Mummy cabins to avoid: https://www.cruisemummy.co.uk/sun-princess-cabins
- Entertainment announcements (2023): https://www.princess.com/news/news-releases/2023/11/sun-princess-will-mesmerize-guests · https://cruiseindustrynews.com/cruise-news/2023/11/princess-cruises-unveils-entertainment-onboard-sun-princess/
- Itinerary listings (aggregators, conflicting): https://www.cruisemapper.com/ships/Sun-Princess-2167 · https://cruisesheet.com/route/princess-sun-14-night-barcelona-to-ft-lauderdale
