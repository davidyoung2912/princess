# Catalogue research: Sun Princess, Sky Princess and Sapphire Princess, 2027

Status: **Research gathered 2026-11-03 from public web pages. Not verified against Princess's own schedule.** It is the input for phase X0 (the catalogue phase) in `experience-extension-ideas.md` section 15. Nothing here is in the app yet.

## 1. How this was gathered, and how far to trust it

- Ship facts: Wikipedia (class, tonnage, length, decks, capacity, crew), Princess's own Sapphire Princess features page, a Sky Princess guide (`travelextra.ie`) and trade articles. Where sources disagreed I list the Wikipedia figure and say so.
- Sailings: the agent site `taoticket.com` (one page per ship and month), plus trade news (`cruisemapper.com`, `cruisehive.com`, `cruisecritic.com`). Port lists were read off those pages as they appeared. Sea days are left out. Port names are as spelled by the source.
- **Not Princess's own data.** Princess's website and the big aggregators (`icruise.com`, `gangwaze.com`) would not load for the tool (blank page or a rate limit). Agent pages can lag, differ on spellings, and be partial: several month pages said "10 of 14 sailings shown". **Missing months are marked.** Treat this as a good first sample and as a *shape* for the data model, not as the final schedule.
- Prices were on some pages. I did **not** record them: they are per-person starting prices that change daily, and the app serves prices from its own pricing tables.
- Next step for real data: either a feed or spreadsheet from the owner, or a small, polite scraper script that reads these agent pages on a schedule and writes a reviewed JSON file (see section 7). Check each site's terms before automating.

## 2. Ship fact sheets

| | **Sun Princess** | **Sky Princess** | **Sapphire Princess** |
|---|---|---|---|
| Class | Sphere (first of two; sister Star Princess) | Royal (fourth Royal-class ship) | Gem class (also called Grand-class family; Wikipedia says Gem) |
| In service | 2024 (maiden voyage 28 Feb 2024, Mediterranean; Florida from Oct 2024) | Oct 2019 | 2004 (christened 10 Jun 2004) |
| Gross tonnage | 177,882 | 145,281 | 115,875 |
| Length / beam | 1,133 ft (345 m) / 155 ft (47 m) | 1,080 ft (330 m) / 126 ft (38.4 m) | 951 ft (290 m) / 121 ft (37 m) |
| Decks | 21 (17 guest decks) | 19 | 13 |
| Guests (double occupancy) | 4,300 | 3,660 (one source says 3,560) | 2,670 |
| Crew | 1,600 | 1,346 | 1,100 |
| Staterooms | not stated | 1,830, of which 81% have a balcony | not stated |
| Fuel and notes | First Princess ship fuelled by LNG | | Too wide for the Panama Canal; has no stern "wing" |
| Signature features | A glass Sphere over the three-level Piazza; the glass-enclosed Dome (pool by day, shows by night); Arena theatre; Sanctuary; Sanctuary Collection suites (see `sun-princess-ship-profile.md`) | **SeaWalk** (a glass-bottomed walkway that extends about 28 ft beyond the ship's side, over the sea); three-deck **Piazza**; **The Sanctuary** adults-only retreat with private cabanas; **Sky Suites** (two top-deck suites with wraparound balconies, 270-degree views); **Movies Under the Stars**; **MedallionClass**; Camp Discovery youth centre (ages 3 to 17) | **The Sanctuary** (the last ship to receive it); **Piazza** (Italian-inspired: International Café, Vines Wine Bar); **Movies Under the Stars** (the last ship to receive it); **Lotus Spa and Fitness**; **Skywalkers Nightclub** (top deck); indoor and outdoor pools and an adults-only Serenity pool; The Conservatory (enclosed pool and hot tubs) |
| Dining | Per the ship profile (Alfredo's, Sanctuary and Reserve Collection venues, and others) | Soleil, Cielo and Estrella dining rooms; Crown Grill; Sabatini's; The Catch by Rudi; Alfredo's; World Fresh Marketplace buffet; Chef's Table Lumiere; International Café | International (traditional, fixed times); Anytime rooms Pacific Moon, Santa Fe, Savoy, Vivaldi; specialty Sabatini's and Sterling Steakhouse; Horizon Court buffet, Alfredo's, Prego Pizzeria, Trident Grill, Sundaes, Patisserie, afternoon tea, 24-hour room service |
| Bars and lounges | Per the ship profile | Vines, Take Five (jazz), Vista Lounge (comedy and cabaret) | Wheelhouse Bar, Churchill Lounge, Crooners, Wake View Bar, Explorers Lounge, Club Fusion, Grand Casino |
| Theatres | Princess Arena, Dome, Piazza | Princess Theatre (shows named by one source: "Rock Opera", "5-SKIES") | Princess Theater; outdoor Movies Under the Stars screen |

**Corrections to the art briefs** (section 16 of the ideas document, already applied): Sapphire Princess **has no wing or spoiler at the stern** (an earlier prompt said it did), and its Skywalkers Nightclub is on the top deck. It is Gem class with 13 decks and no glass dome or sphere.

**Still unconfirmed:** exact venue lists on Sky and Sapphire (venues are renamed in refits), stateroom counts for Sun and Sapphire, the funnel shape of each ship (the art prompts keep it generic), and Sapphire's last refit year (sources say 2012 or 2018).

## 3. The weekly pattern behind the schedules (important for the data model)

Almost every Sun Princess sailing is a **7-night leg**, and the 14, 21 and 28-night "sailings" are simply **legs joined back to back**. Example (Fort Lauderdale, 3 January 2027): the 14-night sailing is the 7-night Eastern leg (Grand Turk, San Juan, Amber Cove) plus the next week's 7-night Western leg (Roatán, Cozumel), with a Fort Lauderdale call in the middle. The Mediterranean works the same way, with legs that start from Barcelona, Civitavecchia and Athens and rotate in a repeating cycle.

So the catalogue should model:

- **Leg**: a 7-night (sometimes 5, 6, 8 or 10-night) trip between two ports on a date.
- **Sailing**: one or more consecutive legs, which a guest books as a single booking. The same ship, same dates, three offers: the single leg, two legs and three legs.
- **Itinerary pattern**: the repeating shape (Eastern, Western A, Western B; Western Med; Greek Isles).

The current app's "7-night Western Caribbean with Mexico" (Fort Lauderdale to Cozumel, Belize City and Roatán) is one pattern, **Western A**.

## 4. Sun Princess, 2027

### 4.1 Caribbean from Fort Lauderdale, January to March

Three repeating 7-night legs, all round trip from Fort Lauderdale:

| Pattern | Ports of call (sea days omitted) | Appears on |
|---|---|---|
| **Eastern** | Grand Turk, San Juan, Amber Cove | 3, 17, 31 Jan; 14, 28 Feb; 14 Mar |
| **Western A** (the app's current route) | Cozumel, Belize City, Roatán | 24 Jan; 21 Mar; also as the second week of 14-night sailings (24 Jan, 28 Feb, 7 and 14 Mar) |
| **Western B** | Celebration Key (Grand Bahama), Roatán, Cozumel (the sailing named "Central America: United States, Honduras, Mexico") | 10 Jan; 7, 21 Feb |

Complete list found for January to March 2027 (departures from Fort Lauderdale; 14-night sailings are two legs):

| Date | Nights | Ports |
|---|---|---|
| 3 Jan | 7 | Grand Turk, San Juan, Amber Cove (sold out on the page) |
| 3 Jan | 14 | Grand Turk, San Juan, Amber Cove, then Roatán, Cozumel |
| 10 Jan | 7 | Celebration Key, Roatán, Cozumel |
| 10 Jan | 14 | Celebration Key, Roatán, Cozumel; Fort Lauderdale; Celebration Key, San Juan, Amber Cove |
| 17 Jan | 7 | Celebration Key, San Juan, Amber Cove |
| 17 Jan | 14 | Celebration Key, San Juan, Amber Cove; Fort Lauderdale; Cozumel, Belize City, Roatán |
| 24 Jan | 7 | Cozumel, Belize City, Roatán |
| 24 Jan | 14 | Cozumel, Belize City, Roatán; Fort Lauderdale; Grand Turk, San Juan, Amber Cove |
| 31 Jan | 7 | Grand Turk, San Juan, Amber Cove |
| 31 Jan | 14 | Grand Turk, San Juan, Amber Cove; Fort Lauderdale; Celebration Key, Roatán, Cozumel |
| 7 Feb | 7 | Celebration Key, Roatán, Cozumel |
| 7 Feb | 14 | as above, then Grand Turk, San Juan, Amber Cove |
| 14 Feb | 7 | Grand Turk, San Juan, Amber Cove |
| 14 Feb | 14 | Eastern, then Roatán, Cozumel, Celebration Key |
| 21 Feb | 7 | Roatán, Cozumel, Celebration Key |
| 21 Feb | 14 | Western B, then Amber Cove, San Juan, Grand Turk |
| 28 Feb | 7 | Amber Cove, San Juan, Grand Turk |
| 28 Feb | 14 | Eastern, then Cozumel, Roatán, Belize City |
| 7 Mar | 7 | Cozumel, Roatán, Belize City |
| 7 Mar | 14 | Western A, then Grand Turk, San Juan, Amber Cove |
| 14 Mar | 7 | Grand Turk, San Juan, Amber Cove |
| 14 Mar | 14 | Eastern, then Cozumel, Belize City, Roatán |
| 21 Mar | 7 | Cozumel, Belize City, Roatán |

(Departure dates are Sundays. The page also lists the 15 Nov, 22 Nov and 29 Nov 2026 sailings, which are the same patterns plus Costa Maya.)

**Fit with the app:** the app's route is Western A. The real schedule has it only on **24 January and 21 March 2027** as a single 7-night leg (and a few more as half of a 14-night sailing). That matches "yes, this should stay" but also shows the current data (eight sailings, all the same route) is far from the real schedule.

### 4.2 Repositioning crossing, 28 March

- 28 Mar, 14 nights, Fort Lauderdale to Barcelona: Santa Cruz de Tenerife, Cartagena, Palma de Mallorca, Barcelona.
- 28 Mar, 21 nights, Fort Lauderdale to Civitavecchia: the above, then Palma de Mallorca, Marseille, Genoa, La Spezia (two nights), Civitavecchia.

### 4.3 Mediterranean, April to October (from Barcelona, Civitavecchia and Athens/Piraeus)

Sun Princess runs a three-way rotation, each week starting in a different port, with 7-night legs joined into 14 and 21-night sailings (and some 28 and 31-night ones in summer):

| Leg | Ports of call |
|---|---|
| **Barcelona, Western Med** (Apr, early May, Sep, Oct) | Palma de Mallorca (and from May, Ibiza), Marseille, Genoa or Santa Margherita, La Spezia (often two nights), Civitavecchia |
| **Civitavecchia, Greek Isles** | Naples, Chania (Crete), Kusadasi (Ephesus), Mykonos, Athens |
| **Athens, Adriatic** | Santorini, Bar (Montenegro), Corfu, Messina (Sicily), Barcelona (7 nights) |

Examples: 11 Apr from Barcelona 7, 14 and 21 nights; 18 Apr from Civitavecchia 7, 14, 21 nights; 25 Apr from Athens 7, 14, 21 nights; 2, 9, 16 and 23 May the same three legs again (23 May is a 14-night Barcelona sailing).

**Summer variation (July):** longer, with Athens departures reaching Heraklion, Stromboli, Palermo, Taranto and a Barcelona link:
- 4 Jul, 11 nights from Athens: Heraklion, Kusadasi, Santorini, Mykonos, Chania, Messina, Stromboli, Naples, Civitavecchia, Barcelona. (21 and 31-night versions extend with Marseille, Santa Margherita, Palermo, Bar, Taranto.)
- 15 Jul, 10, 20 and 31 nights from Barcelona: Marseille, Santa Margherita, Civitavecchia, Naples, Palermo, Heraklion, Kusadasi, Mykonos, Athens (then Bar, Taranto, Messina and the Greek islands again).
- 25 Jul, 10, 21 and 28 nights from Athens: Bar, Taranto, Messina, Santorini, Mykonos, Kusadasi, Chania, Athens.

**September and October** return to the 7-night legs of spring: 5 Sep Barcelona, 12 Sep Civitavecchia, 19 Sep Athens, 26 Sep Barcelona; 3 Oct Civitavecchia, 10 Oct Athens, 17 Oct Barcelona, 24 Oct Civitavecchia (October legs swap Santa Margherita for Genoa and add Taranto). Ibiza appears on some.

**Gaps:** June and August pages were not read, and the May, September and October pages were each partial. **Istanbul** does not appear in any Sun Princess listing here (CruiseHive reports it was removed from some 2027 sailings). **Kusadasi, Chania and Mykonos are listed**, which differs from a report that they were replaced by Zadar, Bar and Kotor; Bar and Corfu do appear. Treat Turkey and the Adriatic as uncertain.

### 4.4 November 2027

The November page listed only 2026 sailings (Fort Lauderdale again), so **where Sun Princess goes after October 2027 is not known** from these pages.

## 5. Sky Princess, 2027

| Period | Ports and routes |
|---|---|
| **Jan to early Mar, Port Canaveral, Caribbean** | 4 Jan (6 nights): Celebration Key, Amber Cove, Grand Turk. 10 Jan (8): Celebration Key, San Juan, Amber Cove, Grand Turk. 18 Jan (6): as 4 Jan. 24 Jan (8): as 10 Jan. 1 Feb (6): Turks and Caicos with Princess Cays (one agent). 1 Mar (6): Nassau, Grand Turk, Celebration Key. (Several February pages not read.) |
| **7 Mar, transatlantic to Europe** | 15 nights Port Canaveral to Southampton: Freeport, Ponta Delgada (Azores), Casablanca, A Coruña. A 22-night version continues: Southampton, A Coruña, Bilbao, Bordeaux, Cherbourg. |
| **Mar to Oct, from Southampton** | 22 Mar (7): A Coruña, Bilbao, Bordeaux, Cherbourg. 29 Mar (14): Cádiz, Barcelona, Toulon, Livorno, Civitavecchia. 12 Apr (12): Vigo, Funchal, Santa Cruz de Tenerife, Las Palmas, Lanzarote, Lisbon. 24 Apr (14): Skagen, Copenhagen, Warnemünde, Tallinn, Helsinki, Stockholm (2 days), Visby, Kristiansand. |
| **Summer** | 12 Jun (14, Norwegian fjords and Arctic): South Queensferry, Skjolden, Nordfjordeid, Trondheim, Honningsvåg, Tromsø, Molde, Bergen. 26 Jun (14, Iceland): Haugesund, Skjolden, Nordfjordeid, Ålesund, Akureyri, Ísafjörður, Reykjavík, Grundarfjörður. 10 Jul (7): Haugesund, Skjolden, Nordfjordeid, Stavanger; (14) adds Zeebrugge, Oslo, Copenhagen, Skagen. 17 Jul (7): Zeebrugge, Oslo, Copenhagen, Skagen. **24 Jul (14, the eclipse cruise)**: Vigo, Barcelona, Toulon, Cartagena, Cádiz, Lisbon (eclipse of 2 Aug viewed off southern Spain). 7 Aug (14) and 28 Aug (14): Cádiz, Barcelona, Toulon, Livorno, Civitavecchia. 21 Aug (7): Kristiansand, Oslo, Copenhagen, Skagen. |
| **26 Oct, transatlantic to Florida** | 15 nights Southampton to Fort Lauderdale: Vigo, Lisbon, Funchal, Santa Cruz de Tenerife. |

**Gaps:** May, September and the rest of October were not read; a 31-night "Mediterranean Marvel" was reported by trade news but not seen on a month page; February and early March pages were not read. The itinerary names the sources use are generic ("Northern Europe", "Mediterranean").

## 6. Sapphire Princess, 2027

| Period | Ports and routes |
|---|---|
| **Winter 2026 to 27** | A 33-night Los Angeles to Singapore voyage from 22 Nov 2026 (Hawaii, Japan, Taiwan, Hong Kong, Vietnam). Then Asia with Diamond Princess on 10 to 42-night itineraries; January and February 2027 pages not read. |
| **Japan season, March to December** | Trade press: the line's largest Japan deployment; 50 itineraries and 78 departures from the Tokyo region across both ships; cherry blossom voyages (9 to 24 nights), summer **festival cruises** in August (Aomori Nebuta, Hakodate Minato, Yamagata Hanagasa, Kumano fireworks), longer stays in Osaka, Hiroshima, Hakodate, Sakata and Halong Bay, 21 UNESCO sites including Mount Fuji. |
| Sampled sailings | 6 Mar (11 nights): Tokyo, Toba, Kochi, Busan, Nagasaki, Kagoshima, Miyazaki, Kobe, Tokyo; (23 nights) continues Nagoya, Tokushima, Hiroshima, Beppu. 21 Apr (11): Aomori, Muroran, Hakodate, Sakaiminato, Busan, Nagasaki, Kagoshima. 7 Jul (10): Nagoya, Osaka, Kochi, Hiroshima, Busan, Nagasaki, Shimizu (and a 17-night version with Toba, Jeju). 17 Jul (7): Toba, Kochi, Jeju, Nagasaki. 24 Jul (22): Nagoya, Osaka, Kochi, Hiroshima, Busan, Hakodate, Hitachinaka, Akita, Sakata, Kanazawa, Sakaiminato, Nagasaki, Kagoshima. |
| **Tokyo to Southeast Asia, September** | 4 Sep (24): Toba, Wakayama, Miyazaki, Busan, Hiroshima, Kochi, Shimizu, Tokyo, Kochi, Okinawa, Kaohsiung, Hong Kong, Chân Mây (Da Nang), Ho Chi Minh, Singapore. 14 Sep (14): Kochi, Okinawa, Kaohsiung, Hong Kong, Chân Mây, Ho Chi Minh, Singapore. |
| **Singapore to Australia, late Sep** | 28 Sep (12): Port Klang, Penang, Phuket, Benoa (Bali, 2 days), Perth. A 25 and a 28-night version continue Broome (2 days), Darwin, Cairns, Willis Island, Brisbane (and Sydney). |
| **October** | 10 Oct (13 or 16): Perth, Broome, Darwin, Cairns, Willis Island, Brisbane (Sydney). 23 Oct (3): Brisbane to Sydney. |
| **2027 to 28 summer** | Homeports in Fremantle, Western Australia (nine cruises) per the Wikipedia ship page. |

**Gaps:** May, June, August and December 2027 pages not read; the Wikipedia page also says Sapphire sails Scandinavia in summer 2026 and returns to Western Australia in 2027 to 28. Note the **Japanese port list is long** (about 25 ports) and several are rarely seen in cruise apps (Toba, Kochi, Hitachinaka, Sakata, Sakaiminato, Wakayama, Muroran, Tokushima).

## 7. Cross-ship summary

| Region | Ship and months | Distinct ports named |
|---|---|---|
| Caribbean | Sun (Jan to Mar, Fort Lauderdale), Sky (Jan to Mar, Port Canaveral) | Celebration Key, Grand Turk, San Juan, Amber Cove, Cozumel, Belize City, Roatán, Costa Maya, Nassau, Princess Cays, Freeport |
| Western and Central Med | Sun (Apr to Oct), Sky (Mar, Jul, Aug, Oct) | Barcelona, Palma, Ibiza, Marseille, Toulon, Genoa, La Spezia, Livorno, Santa Margherita, Civitavecchia, Naples, Cartagena, Cádiz, Palermo, Messina, Stromboli, Taranto |
| Eastern Med and Adriatic | Sun | Athens (Piraeus), Santorini, Mykonos, Chania, Heraklion, Kusadasi, Corfu, Bar |
| Atlantic Iberia and islands | Sky (Mar, Apr, Oct) | A Coruña, Vigo, Lisbon, Bilbao, Funchal, Santa Cruz de Tenerife, Las Palmas, Lanzarote, Ponta Delgada, Casablanca |
| Northern Europe, Scandinavia, Baltic, Iceland | Sky (Apr to Aug) | Southampton, Cherbourg, Bordeaux, Zeebrugge, Skagen, Copenhagen, Warnemünde, Oslo, Kristiansand, Stavanger, Haugesund, Bergen, Ålesund, Trondheim, Tromsø, Honningsvåg, Molde, Skjolden, Nordfjordeid, Tallinn, Helsinki, Stockholm, Visby, South Queensferry (Edinburgh), Reykjavík, Akureyri, Ísafjörður, Grundarfjörður |
| Japan and Korea | Sapphire (Mar to Sep) | Tokyo, Yokohama region, Toba, Kochi, Kobe, Osaka, Nagoya, Shimizu, Wakayama, Tokushima, Beppu, Miyazaki, Kagoshima, Nagasaki, Hiroshima, Sakaiminato, Kanazawa, Akita, Sakata, Aomori, Muroran, Hakodate, Hitachinaka, Okinawa, Jeju, Busan |
| Southeast Asia | Sapphire (Sep) | Kaohsiung, Hong Kong, Chân Mây, Ho Chi Minh, Singapore, Port Klang, Penang, Phuket, Benoa (Bali) |
| Australia | Sapphire (Sep to Oct and the 2027 to 28 season) | Perth (Fremantle), Broome, Darwin, Cairns, Willis Island, Brisbane, Sydney |

About **120 distinct ports** across the three ships. That is too many to hand-author guides and art for. Plan three tiers:

- **Tier A (full guide and a postcard):** the 15 to 20 ports most often visited or most worth a guide. Suggested: Cozumel, Belize City, Roatán, Celebration Key, San Juan, Grand Turk, Amber Cove, Barcelona, Marseille, Genoa, La Spezia, Civitavecchia (Rome), Naples, Palma, Athens, Santorini, Mykonos, Kusadasi, Southampton, Copenhagen, Tokyo, Hakodate, Singapore, Sydney.
- **Tier B (short guide and the region art):** frequent ports.
- **Tier C (the official link, a map, the weather and the all-aboard time, with the region art):** the rest.

## 8. Suggested next step for the data

1. The owner confirms the three ships and that the Fort Lauderdale Western Caribbean route stays (done: yes). Confirm the **ships' 2027 deployments** from a Princess feed if one exists.
2. Build the **leg, sailing, itinerary pattern** model (section 3) and seed it with this file: the full Sun Princess January to March run, a Sun Mediterranean spring set, a Sky Princess Southampton and Caribbean set, and a Sapphire Japan, Singapore and Australia set. Mark the data **sample, from third-party pages, to be verified**.
3. Write a **small scraper** (`scripts/catalogue-scrape.mjs`) for the agent month pages with a polite rate limit, caching and a diff report, writing a *reviewed* JSON file that the server reads. A person approves each change. Respect the sites' terms and `robots.txt` before running it regularly.
4. Replace the app's eight-sailing, one-route data with this model, one screen family at a time (see `experience-extension-ideas.md` section 15.4).

## 9. Sources

- [Sapphire Princess, Wikipedia](https://en.wikipedia.org/wiki/Sapphire_Princess)
- [Sky Princess (2019), Wikipedia](https://en.wikipedia.org/wiki/Sky_Princess_(2019))
- [Sun Princess (2024), Wikipedia](https://en.wikipedia.org/wiki/Sun_Princess_(2024))
- [Sapphire Princess features, Princess Cruises](https://princess.com/find/details/features/SA.html)
- [Sky Princess guide, Travel Extra](https://www.travelextra.ie/cruise-ship-the-sky-princess-from-princess-cruises-what-guests-can-expect/)
- [Sun Princess month pages, Taoticket (Jan, Feb, Mar, Apr, May, Jul, Sep, Oct, Nov)](https://www.taoticket.com/en_AU/co/princess-cruises/na/sun-princess/january)
- [Sky Princess month pages, Taoticket (Jan, Mar, Apr, Jun, Jul, Aug, Oct)](https://www.taoticket.com/en_AU/co/princess-cruises/na/sky-princess/march)
- [Sapphire Princess month pages, Taoticket (Mar, Apr, Jul, Sep, Oct)](https://www.taoticket.com/en_AU/co/princess-cruises/na/sapphire-princess/march)
- [Princess 2027 European itineraries, CruiseMapper](https://www.cruisemapper.com/news/14867-princess-cruises-charts-expansive-2027-european-itineraries)
- [Princess doubling Japan deployment in 2027, CruiseHive](https://www.cruisehive.com/princess-cruises-doubling-ship-deployment-to-japan-in-2027/183224)
- [Princess 2027 to 2028 Australia and South Pacific, CruiseMapper](https://www.cruisemapper.com/news/15568-princess-cruises-australia-south-pacific-program)
- [Istanbul removed from some 2027 sailings, CruiseHive](https://www.cruisehive.com/princess-cruises-quietly-removes-istanbul-from-multiple-2027-sailings/209688)
- [Eclipse cruises in 2027, Shipmonk](https://shipmonk.co.uk/2025/06/03/enchanted-sky-princess-cruises-will-offer-views-of-solar-eclipse-on-two-ships-in-2027/)
