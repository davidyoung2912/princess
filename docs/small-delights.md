# Princess Guest Web App — Small Delights

Status: **Draft v0.1 (2026-11-02), for review.** A menu of small, functional additions for each of the 11 customer stages in `docs/customer-journey-priorities.md`. It is a menu, not a plan. Nothing here is scheduled.

I did not audit `src` for this pass. Costs are rough estimates for one developer who knows the codebase, and they may be off if a feature is already partly built. I tried to avoid anything already specified in FR, LF or the journey-priorities doc (including its NEW items), but check before scheduling.

---

## 1. How to read this

**What counts as a small delight.** It is functional, not decoration. It does one small useful thing well, and it is optional and quiet. A guest should notice it only when it helps, and then remember it. It never delays a required task (UX-02), never creates pressure (XT-10), and always works with reduced motion, large text and a screen reader.

**Cost scale** (front end plus any server work, including tests):

| Size | Rough effort | Typical shape |
| --- | --- | --- |
| **XS** | up to half a day | Copy, a small component, or a pure function. No server change. |
| **S** | 1 to 2 days | A new card or screen using data we already hold. |
| **M** | 3 to 5 days | A new view with its own logic, or a small server endpoint. |
| **L** | 1 to 2 weeks | New data, a new provider mock behind an interface, or real content work. |

`+API` marks anything that needs a new or changed server endpoint. The front end stays a thin client (CLAUDE.md), so a delight that needs data must get it from the backend, with any simulated source hidden behind an interface.

**IDs** (`D0-1`, `D4A-3` and so on) are for your review comments. They are not requirement IDs.

---

## 2. Stage 0 — Dream and decide

| ID | Delight | What it does | Cost | Customer value |
| --- | --- | --- | --- | --- |
| D0-1 | **Gut-check flip** | When torn between two sailings, flip a coin. The app then asks, "Were you hoping for heads?" and shows the answer as a hint, not a verdict. | XS | Surfaces the guest's real preference in one tap. It is friendly and makes no sales push. |
| D0-2 | **Name your dream** | Give the draft trip a nickname ("Mum's 70th") that follows it through every later stage. | XS | Makes the trip feel owned from the first minute, and the partner knows what the link is about. |
| D0-3 | **"On that date you'd be…"** | On any sailing, pick a calendar day and see where the ship would be and what the port is like. | S | Turns an abstract itinerary into a picture of one real day. |
| D0-4 | **Mood tiles** | Tap a handful of photos you like (quiet beach, buzzing market, glacier). The shortlist re-ranks and says why. | M | A fast, low-effort way to start for guests who cannot answer a quiz. |
| D0-5 | **Typical weather for those dates** | A small strip per sailing: typical highs, rain days and sea state by port, with its source. | S (+API) | Answers "will it be nice?" without leaving the page. |
| D0-6 | **Cost per day, side by side** | Shows the cruise's cost per person per day next to a clearly labelled typical land holiday figure. | S (+API) | Honest value framing that new guests ask for. The method is visible so it does not read as a sales claim. |
| D0-7 | **Read it to me** | A speaker button on the decision summary and the "is this for me" page, using the browser's built-in speech. | XS | Helps low-vision and older guests. Also helps couples who read aloud together. |
| D0-8 | **"Remind me in a week"** | One tap saves the draft and sends a single plain reminder email or notification, never more. | S (+API) | Keeps the decision alive with no pressure, and the guest controls the timing. |

---

## 3. Stage 1 — Discover

| ID | Delight | What it does | Cost | Customer value |
| --- | --- | --- | --- | --- |
| D1-1 | **Ship in familiar terms** | Size shown as "about 3 football pitches long" and "a town of 4,000 people", beside the real numbers. | XS | Gives a feel for scale that statistics do not. |
| D1-2 | **Sea-day / port-day strip** | One strip per itinerary with a block for each day: sea, tender, dock, with hours in port. | S | The shape of the trip is clear at a glance. It protects guests from a "mostly sea" surprise. |
| D1-3 | **Per person per night toggle** | A switch that changes every price between total, per person, and per person per night. | XS | Lets guests compare against hotels and other cruises on their own terms. |
| D1-4 | **Sun on my balcony** | On the cabin card, a small arrow shows which side the sun is on for each day of the itinerary. | M | Answers "which side is shady?" The most common cabin regret with a clear plain-words fix. |
| D1-5 | **Walk-time from this cabin** | Shows "2 min to the buffet, 5 min to the theatre, 1 min to a lift" using the deck plan. | M | Matters for tired, older and mobility-limited guests, and makes the cabin chooser concrete. |
| D1-6 | **Neighbours in icons** | A simple "above / below / beside" strip (pool deck above, crew area below) with a plain noise note. | S | A cheap version of the cabin quiet score, available even on cabins with no guest photo. |
| D1-7 | **Pick up where you left off** | On return, a card says "You were comparing two Deck 9 cabins" and reopens them. | XS | Saves a long search being restarted. Feels attentive, not creepy, because it is the guest's own list. |
| D1-8 | **Comparison card to share** | Turn a side-by-side into a clean image or link to send to a partner or a friend. | S | The easiest way to get a second opinion, which many bookings need. |

---

## 4. Stage 2 — Book

| ID | Delight | What it does | Cost | Customer value |
| --- | --- | --- | --- | --- |
| D2-1 | **"As printed on your ticket"** | A live preview of each traveller's name as it will appear, with a gentle check against the passport wording. | XS | Prevents the most painful downstream error and shows the guest why it matters. |
| D2-2 | **Swapped-name catcher** | Warns if first and last names look swapped, or a title or nickname is typed in a name field. | XS | A quiet safety net that costs nothing. |
| D2-3 | **Booking number, easy to read and copy** | Large digits in readable groups with a one-tap copy and "read aloud". | XS | Helps on a phone call with an agent and for guests with low vision. |
| D2-4 | **One calendar file for the whole journey** | One download adds sailing, final payment, document, check-in and sail-away dates to the guest's calendar. | S | Reliable reminders without relying on our notifications. |
| D2-5 | **"Your birthday is at sea"** | If a traveller's birthday or an anniversary falls during the trip, the app notes it and offers to tell the ship, optionally keeping it a surprise. | S (+API) | A warm moment for little cost, and it feeds the celebration features. |
| D2-6 | **Saved travellers** | Remember the family's details (on the server, so it follows the guest between devices) and reuse them on the next booking. | S (+API) | Removes repeat typing, especially for families and groups. |
| D2-7 | **Who-pays-what sliders** | In checkout, drag to split the total between payers and see each share update. | M | Makes group bookings easier, and sets up the pay-your-share links. |
| D2-8 | **Email this summary to someone** | One tap sends a plain-language recap (what, when, total, what is not included) to a partner or parent. | S (+API) | Supports the "I need to check with someone" step that often stalls bookings. |

---

## 5. Stage 3 — Manage and prepare

| ID | Delight | What it does | Cost | Customer value |
| --- | --- | --- | --- | --- |
| D3-1 | **Ready ring** | A simple ring per traveller that fills as documents, payments and requests are done. | S | A calm, glanceable progress cue that supports the one-next-action rule. |
| D3-2 | **One small thing this week** | A single card each week with one two-minute task, such as "check your passport expiry". It can be dismissed forever. | S | Spreads preparation over months, which keeps anxious guests calm. |
| D3-3 | **Six-month passport check** | Enter an expiry date and see whether it meets the entry rules of each port, in plain words. | S (+API) | Prevents a denied boarding. It is the single most useful tiny check. |
| D3-4 | **Packing list follows the forecast** | The list adds or drops items from the typical weather for the sailing week. | M (+API) | A list that is right for this trip, not generic. |
| D3-5 | **Shared packing ticks** | A couple or family shares one list. Items ticked by one person appear ticked for all. | M (+API) | Stops duplicates and forgotten items. |
| D3-6 | **Printable bag tags preview** | A print-ready PDF of the tag with the guest's name, cabin and sailing, including a large-print option. | S | Saves a step at the terminal and works without the app. |
| D3-7 | **Out-of-office text** | Offers a ready-to-copy "I'm away on a ship, back on [date]" message with a tone choice. | XS | A small thing nobody else thinks of, and it feels personal. |
| D3-8 | **Currency at home** | Shows what $100 is worth in the guest's own currency, and on the ship, with the date of the rate. | S (+API) | Removes mental arithmetic and supports the money shield. |

---

## 6. Stage 4 — Pre-book and personalise

| ID | Delight | What it does | Cost | Customer value |
| --- | --- | --- | --- | --- |
| D4-1 | **Add a rest block** | Place a deliberate "do nothing" block on any day. The optimiser then plans around it. | XS | Honest design: a good week includes rest. It is a favourite for older guests. |
| D4-2 | **Walk between bookings** | Between two bookings, show the walk in minutes and decks ("8 min, two decks, one lift"). | M | Prevents plans that look fine but are impossible for slower walkers. |
| D4-3 | **Dress code on the day card** | A small icon on each evening shows formal, smart casual or casual. | XS | A quiet answer to a question every first-timer asks. |
| D4-4 | **Golden-hour marker** | Show sunset and sunrise times on each day of the plan, with the best deck. | S (+API) | A free, lovely detail that nudges guests to look up. |
| D4-5 | **Sticky note on a booking** | A private note on any booking ("ask for a window table"). | XS | Helps guests remember small requests. It stays on the server so it moves between devices. |
| D4-6 | **Colour per traveller** | In a shared plan, each person has a colour, and the day view shows who is doing what. | S | Makes a family or group plan readable at a glance. |
| D4-7 | **Plan to my calendar** | Export the day or whole week to a calendar file. | S | Fits the plan into tools the guest already uses. |
| D4-8 | **Poster of my week** | An image of the week, with ship, ports and bookings, to share or print. | S | Easy to share and quietly builds anticipation. |

---

## 7. Stage 4A — Get to the ship

| ID | Delight | What it does | Cost | Customer value |
| --- | --- | --- | --- | --- |
| D4A-1 | **Traffic-light card** | One home-screen card shows green, amber or red for "on track", with the leave-by time in the largest type. | S | The simplest possible answer to the guest's one question. |
| D4A-2 | **Show-the-driver card** | A big-text card with the terminal name, address and gate, in the local language, for taxis and rides. | S (+API) | Removes a common point of miscommunication and works offline. |
| D4A-3 | **Last look at the door** | A six-item tick list (passport, boarding pass, medication, charger, keys, tags) that appears on departure morning. | XS | A tiny checklist that prevents the most expensive forgotten items. |
| D4A-4 | **"I've arrived" text** | A ready-to-send message for family that includes the terminal and the time. | XS | Calms the people at home, and needs no account for them. |
| D4A-5 | **Near the terminal** | Pharmacy, cash machine, café and toilet near the terminal with opening hours. | M (+API) | Handy for early arrivals and anyone with a gap to fill. |
| D4A-6 | **Essentials-only mode** | One toggle strips the app to the boarding pass, leave-by time and phone number to save battery. | S | Protects the guest on a travel day when the battery is low. |
| D4A-7 | **Set your watch** | A prompt to set the phone or watch to ship time, with the exact moment to do it. | XS | Prevents the classic time-zone slip before it starts. |
| D4A-8 | **Distance in ship-lengths** | When driving in, the progress bar reads "14 ship-lengths to go" as well as miles. | XS | A small smile on a long drive that helps nobody get lost. |

---

## 8. Stage 5 — Check-in and embark

| ID | Delight | What it does | Cost | Customer value |
| --- | --- | --- | --- | --- |
| D5-1 | **Check-in as a ticket that fills in** | A boarding-pass-shaped progress view that gets completed, line by line, as each step is done. | S | Shows progress in a way the guest recognises, and reduces abandonment. |
| D5-2 | **Photo tips before the camera** | A short card ("good light, no glasses, hold steady") shows before the passport or face photo step. | XS | Cuts the most common check-in error before it happens. |
| D5-3 | **Cabin ready, in words** | When the cabin is ready, a message gives the number and a plain route ("Deck 9, take the forward lift, turn left"). | S (+API) | Turns a vague notification into a route a tired guest can follow. |
| D5-4 | **Three landmarks** | A card with three landmarks between the cabin and the nearest muster station. | S | Builds confidence in a big ship on the first afternoon. |
| D5-5 | **Where are my bags, usually?** | Before bags arrive, show the typical delivery window for this ship, with its source. | S (+API) | Cuts anxiety and cabin-door waiting. |
| D5-6 | **Sail-away spot** | Names the best deck for the departure view and the time to be there. | S | A small daily moment that makes the first hour feel planned. |
| D5-7 | **Wi-Fi joined by QR** | A QR and a plain steps card to connect to the ship's network, including how to stay off roaming. | S | Removes the first-hour "how do I" and protects against roaming charges. |
| D5-8 | **Ticket stub for the memory book** | The boarding pass is saved to the guest's trip history as a stub with the date. | XS | A free keepsake that feeds Stage 8. |

---

## 9. Stage 6 — Sea days and ship life

| ID | Delight | What it does | Cost | Customer value |
| --- | --- | --- | --- | --- |
| D6-1 | **Clocks change tonight** | A banner on the day before a time change: "Clocks go forward one hour tonight." | XS | Prevents missed breakfast, shows and tours. |
| D6-2 | **Dress code sticker** | Tonight's dress code is a small badge at the top of Home. | XS | Answers the most common repeat question. |
| D6-3 | **Noon report** | Position, speed, distance to the next port and sea state, in plain words, with a small map. | M (+API) | The ship's own noon announcement in the guest's pocket. Many guests love it. |
| D6-4 | **Dish favourites** | Heart a dish. The app alerts the guest when it is on tonight's menu. | M (+API) | A personal touch that turns a menu into something to look forward to. |
| D6-5 | **Park my spot** | Drop a "my lounger / my table" pin on the deck plan, with a note and a timer reminder. | S | Solves "where did I leave my things?" and supports fair-use rules. |
| D6-6 | **Deck-walk counter** | Count laps of the promenade, with "3 laps is about a mile". | S | A gentle move-more feature that older guests and families enjoy. |
| D6-7 | **Say thanks to a venue** | One tap sends a thank-you to a venue or crew team, with no rating attached. | S (+API) | Gives guests a positive outlet and feeds the "you said, we did" loop. |
| D6-8 | **Celebration day** | On a birthday or anniversary, a card with a private message, which the cabin-mates can add to. | S (+API) | A warm moment that is low-cost to run. |
| D6-9 | **Night-friendly colours** | A red-tinted low-glare theme for the cabin at night and the deck after dark. | XS | Does not wake a cabin-mate and is easier on eyes at night. |
| D6-10 | **Drink diary** | Opt-in, private. Note what you liked, so ordering again is easy. | S | Helps package guests remember favourites and decide about the next trip. |

---

## 10. Stage 6A — In port

| ID | Delight | What it does | Cost | Customer value |
| --- | --- | --- | --- | --- |
| D6A-1 | **Pocket stopwatch** | A big-number "time until all-aboard" page that is easy to read at a glance, in ship time. | S | Calms the most anxious moment of a port day. |
| D6A-2 | **Take me back to the ship** | A card with the berth or tender point, in the local language, to show a taxi or a stranger. | S (+API) | Practical help for any lost or tired guest. Works offline. |
| D6A-3 | **UV and heat nudge** | Today's UV index and heat, with one gentle prompt to reapply sunscreen or find shade. | S (+API) | Protects older guests and children, and costs little. |
| D6A-4 | **Fifteen-minute circle** | A map ring of everything within a 15 minute walk of the pier. | M (+API) | Shows the guest a safe, easy day for little effort. |
| D6A-5 | **Tipping norms by country** | A short card: customary tip, whether service is included, and cash or card. | XS | Prevents awkwardness and overtipping. It is simple text we can ship now. |
| D6A-6 | **Opening-hours check** | Warns when the guest lands before shops or sights open, or when they close before all-aboard. | S (+API) | Prevents wasted trips and fits the plan to local reality. |
| D6A-7 | **Port stamps** | Each port visited adds a small stamp to a "passport" page. | S | A gentle collecting delight that families like, and a feed for the memory book. |
| D6A-8 | **Pin a favourite spot** | Drop a pin with a note ("best coffee") that goes into the trip memory. | S | Builds the memory book as the day unfolds. |
| D6A-9 | **Offline day card** | When the guest leaves the ship, cache one page: plan, leave-by time, phone number, map. | S | A solid fallback with no roaming data. |

---

## 11. Stage 7 — Disembarkation

| ID | Delight | What it does | Cost | Customer value |
| --- | --- | --- | --- | --- |
| D7-1 | **Empty-cabin photo** | An optional photo of the cleared cabin, kept only on the device. | S | A calm record for the guest if a lost-property question comes up. |
| D7-2 | **Final-day strip** | A timeline for the last day: breakfast until, cabin by, group colour, walk-off time. | S | Puts every deadline in one view for a stressful morning. |
| D7-3 | **Charge up tonight** | A reminder to charge phone and power bank before the morning. | XS | A tiny reminder that prevents a real problem. |
| D7-4 | **Onboard credit left** | If credit remains, a quiet note with what it could be used for, or that it can be left. It is informational. | S (+API) | Stops credit being wasted without any hard sell. |
| D7-5 | **Itinerary and menus keepsake** | One PDF with the ports, the dates and the menus the guest actually saw. | S (+API) | A keepsake that costs the ship little and the guest keeps. |
| D7-6 | **Last look** | A prompt to take one last photo from the deck at dawn, saved to the trip. | XS | A moment the guest remembers, and a feed for the memory book. |
| D7-7 | **Text a ride** | A pre-written message to a driver or relative with the terminal, gate and the expected time. | XS | Saves typing while carrying bags. |
| D7-8 | **Allowance left** | Estimates the customs allowance remaining from the guest's purchases, with the official limits cited. | S (+API) | Reduces a common last-day worry. The official form stays official. |
| D7-9 | **Trip numbers** | A small card: nautical miles, ports and sea days. | M (+API) | Fun and shareable, and easy to produce from data the ship already has. |

---

## 12. Stage 8 — Remember, return and refer

| ID | Delight | What it does | Cost | Customer value |
| --- | --- | --- | --- | --- |
| D8-1 | **Postcard to future self** | Write a note now, and the app delivers it as the next cruise's countdown starts. | S (+API) | A personal link between this trip and the next. |
| D8-2 | **Where I've sailed** | A map with a pin for every port across every trip. | M (+API) | A proud, shareable record, and strong for repeat guests. |
| D8-3 | **My favourites, ranked** | Dishes, shows and ports ranked from the guest's own ratings and notes. | M | Turns scattered moments into a personal guide for next time. |
| D8-4 | **Best moment card** | Pick one photo and one line, then share a single clean card. | S | A lighter alternative to a full album that people actually post. |
| D8-5 | **Nights at sea** | Lifetime nights and ports in the loyalty view, in plain terms. | S (+API) | Gives repeat guests a sense of progress without pressure. |
| D8-6 | **Same week next year** | A soft calendar hold for the same week, with no booking made. | XS | Keeps the next trip in mind with no sales push. |
| D8-7 | **Ports I want next** | A short list of places the guest says they want to see, which seeds the next Stage 0. | S | Closes the loop from memory to the next dream. |
| D8-8 | **Take-home recipes** | A handful of recipes from dishes the guest ordered. | L | A keepsake guests talk about. Needs licensed content, which is the real cost. |
| D8-9 | **Certificate** | A printable certificate of nights at sea, ports and crossings. | XS | A small, silly keepsake for a family wall. |

---

## 13. Suggested first picks

If you want a short list to start from, these are the cheapest items that cover the most stages and match the doc's rules (quiet, optional, useful).

| Group | Items | Combined cost |
| --- | --- | --- |
| **Pure front-end, no server** | D0-2, D0-7, D1-3, D2-1, D2-2, D2-3, D4-1, D4-3, D4A-3, D4A-7, D5-2, D6-1, D6-2, D6-9, D6A-5, D7-3, D7-7 | About 5 to 7 days in total |
| **Safety and trust (small server work)** | D3-3 (passport check), D4A-2 and D6A-2 (show-the-driver cards), D6A-9 (offline day card), D6A-3 (UV nudge) | About 8 to 10 days |
| **Feeds the memory loop** | D5-8, D6A-7, D6A-8, D7-6, D7-9, D8-2, D8-4 | About 10 to 14 days |

## 14. Open questions for your review

1. Which of these should be on by default, and which should be offered once and never again?
2. D8-8 (recipes) needs licensed content. Is that worth pursuing, or drop it?
3. Several items rely on typical or live data (weather, UV, opening hours, bag delivery). Under CLAUDE.md the backend mocks these, so are you happy for the first versions to be simulated behind the existing provider interfaces?
4. Should any of these be held back until Stage A and B items in the journey-priorities doc are confirmed built?
