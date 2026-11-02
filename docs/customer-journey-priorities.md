# Princess Guest Web App — Customer Journey Priorities

Status: **Draft v0.1 (2026-11-02). A prioritisation lens, not new requirements.** It re-reads `docs/functional-requirements.md` (the base, "FR") and `docs/leading-features-requirements.md` (the companion, "LF") stage by stage and asks one question: *for each of the 11 customer stages, which 15 or so things decide whether the guest thinks this is the best cruise app they have used?*

I did not audit `src` for this pass. "Covered" below means *specified* in FR or LF. Check `docs/leading-features-plan.md` and `docs/gap-analysis-plan.md` for what is actually built before scheduling anything.

---

## 1. How to read this

**The 11 stages** (LF §2.3):

```
 0 Dream & decide    1 Discover        2 Book          3 Manage & prepare
 4 Pre-book & personalise              4A Get to the ship
 5 Check-in & embark                   6 Sea days & ship life
 6A In port          7 Disembark       8 Remember, return & refer
```

Tables use the original requirement IDs from FR and LF.

**Each stage list is in priority order.** Rank 1 matters most. Every row has:

- **Why it decides success**: the guest problem or competitive gap.
- **Clear-to-use test**: the one-sentence check that proves the guest can use it without help. If a feature cannot pass its own test, it is not "supported".
- **IDs**: where it is specified. **NEW** means it is not in FR or LF and is a proposal from this review.

**Tiers** inside each list:

| Tier | Meaning |
| --- | --- |
| **A. Table stakes** | If this fails, guests lose trust or miss the ship. Must be flawless. |
| **B. Differentiator** | Competitors do it badly or not at all. This is why someone chooses us. |
| **C. Delight** | Not needed, but it is what guests tell friends about. Only after A and B are solid. |

Ranks run in order across tiers. Where a table stake is already done by every competitor, a differentiator may rank above it.

---

## 2. The seven rules that apply to every stage

These come from the research in FR §23 and LF §1 and are the reason most apps lose. A feature that breaks one of these is not "supported", whatever it does.

1. **One next action.** Every screen in every stage makes the single most important next step obvious (UX-01, MNG-02). Required tasks outrank offers (UX-02).
2. **Nothing vanishes.** Every booking, payment, request and change is visible, dated, reversible where possible, and survives going offline or an app update (XT-07, CHK-13, DIN-10, OB-08).
3. **Every number has an age.** Any live or simulated figure (crowds, queues, flights, weather) shows how old it is (OB-08, S6-01).
4. **Plain words, real totals.** No jargon without a gloss; the first price shown is the real price; every charge can be explained (DIS-11, XT-02).
5. **A human is always reachable.** "Get help now" with a phone number that works offline, on every screen of every stage (SUP-08).
6. **Works without the app.** Printable plan, pass and itinerary; a helper role; a desk alternative for every critical task (INC-01).
7. **No pressure.** No countdown timers, false scarcity, shaming or hidden defaults (UX-02, XT-10).

---

## 3. Stage 0 — Dream and decide

**Guest question:** *"Is cruising, and this cruise, right for me?"* The decision is made before any search, often with a partner, a friend or an AI assistant.

| # | Tier | Feature / issue | Why it decides success | Clear-to-use test | IDs |
| --- | --- | --- | --- | --- | --- |
| 1 | A | **Honest "is this for me?" page** (who it suits, who it does not) | Builds trust at the point where every competitor is pure brochure | A first-timer finishes it knowing one reason to go and one reason not to | S0-01 |
| 2 | A | **First-timer fears answered plainly** (seasickness, cost, crowds, dress code, "what if I hate it?") | The biggest barrier to a first booking is fear, not price | Each fear has a two-sentence answer and no sales link | S0-02 |
| 3 | A | **Fast, no-account landing and browsing** (under 2.5 s on 4G) | A slow first screen ends the journey before it starts | Anyone can browse cruises with no sign-in | DIS-01 |
| 4 | A | **Jargon glossary, in place** (muster, tender, folio, Medallion, port side) | Unexplained words make newcomers feel excluded | Tapping an underlined word explains it without leaving the page | S0-02 |
| 5 | B | **Budget-first planning** ("$X for the week, two adults") | Guests think in total budget, not in cabin categories | Result shows what the money buys and where it runs out | S0-03, DIS-12 |
| 6 | B | **"Find my cruise" quiz → ranked shortlist with reasons** | Turns a vague wish into a plan | Each result says why it ranked where it did | DIS-06 |
| 7 | B | **Conversational planner, grounded** (works with, and without, the external AI apps) | Princess is already in ChatGPT and Claude; we must not be worse | Answer cites the itinerary it came from; "I do not know" is allowed | DIS-09, S0-07, XA-01 |
| 8 | B | **Import a plan started elsewhere** (pasted summary or link) | Guests start in an assistant, then need somewhere to continue | A pasted plan becomes an editable draft in one step | S0-07 |
| 9 | B | **Sailing quality indicator** (crowds in port, weather season, hurricane risk, school holidays) | Nobody tells you which departure is better | Each departure shows a rating with a plain reason | S0-04 |
| 10 | B | **Decision confidence summary** (decided / left / what could change your mind), shareable | Most cruises are decided by two or more people | Partner can read it with no account | S0-10 |
| 11 | B | **Invite a friend / dream board** with a link preview | Word of mouth is the strongest acquisition channel | The invitee sees the preview without signing up | S0-05, S0-06, DIS-17 |
| 12 | B | **Price alerts and favourites** | Keeps the decision alive without pressure | One tap to watch; one tap to stop | DIS-08, DIS-10 |
| 13 | C | **Occasion starter** (honeymoon, 70th, memorial) with sensitive wording | Milestone trips are high value and high emotion | Bereavement trips use no cheerful marketing wording | S0-09, XI-10 |
| 14 | C | **Real-guest day stories by persona** | Shows the trip, not the ship | Story links to the actual events the app offers | S0-08, DIS-07 |
| 15 | C | **Virtual ship and cabin tours, 360 views** | Reduces booking anxiety | Works on a poor connection and with a screen reader description | DIS-13 |
| 16 | C | **NEW — "Trial day" simulator**: a 5-minute interactive "a day aboard" using the guest's own interests, before any booking | Lets a sceptic feel the trip. A strong shareable moment | A guest finishes it and can say what their Tuesday would look like | NEW |

---

## 4. Stage 1 — Discover

**Guest question:** *"Which sailing, which ship, which cabin, and what will it really cost?"*

| # | Tier | Feature / issue | Why it decides success | Clear-to-use test | IDs |
| --- | --- | --- | --- | --- | --- |
| 1 | A | **Real total price, up front** (taxes, fees, gratuities visible) | Hidden totals are the first betrayal | The first price shown equals the last price paid | DIS-11, S1-08 |
| 2 | A | **Search that works by what people care about** (date, port, length, price, accessible, solo, family) | Basic, but search that cannot filter by accessibility excludes guests | Every filter is visible on one screen and the result count updates | DIS-04 |
| 3 | A | **Itinerary detail with tender vs dock, arrive/depart times, sea days** | Ports with tenders and short stops decide satisfaction | Each port tells you if you will need a tender | DIS-05, POR-04 |
| 4 | A | **Plain-language "what is not included"** on every fare | Prevents bill shock before the booking | The list is on the fare card, not in a footnote | S1-08, BOK-04 |
| 5 | B | **Cabin chooser**: sleep quality, motion, noise, sun side, view, with reasons | The biggest irreversible decision is made nearly blind. Our single strongest discovery feature | Each cabin shows a plain rating and the reason behind it | S1-02…S1-06 |
| 6 | B | **Fair-price indicator** (low / typical / high; "you probably don't need Premier") | Builds trust; no competitor says "don't buy this" | The indicator names the evidence | S1-01 |
| 7 | B | **Fare comparison: Plus vs Premier vs none, for *my* habits** | Package choice is the commonest regret | Guest enters drinks per day and sees the break-even | PRE-06, S1-01, BOK-04 |
| 8 | B | **Side-by-side comparison** (cabins, fares, ships) | Replaces tabs and screenshots | Two or three items fit on a phone without sideways scrolling | S1-07, DIS-03 |
| 9 | B | **Accessibility facts up front** (accessible cabins, tender barriers, deck routes) | The Linda test; most apps bury this | Accessibility is on the result card, not behind a link | DIS-03, POR-12 |
| 10 | B | **Ship explorer with real deck plans and what-is-near-what** | Helps people picture the ship | Searchable by venue name | DIS-03, OB-04 |
| 11 | B | **Real guest photos of the actual cabin and view obstructions** | Stock photos are distrusted | The photo is labelled with the cabin number | S1-06, DIS-14 |
| 12 | B | **Callback or chat with a consultant, and advisor share link** | Many guests want a human at the decision point | Callback time is promised and shown | DIS-15, S1-09 |
| 13 | B | **Cruise cost calculator** (fare + excursions + packages + flights + tips) | The honest total of the whole trip | Every line can be toggled and the total updates | DIS-12 |
| 14 | C | **Verified ratings by itinerary** | Trust signal | Only past passengers can rate | DIS-14 |
| 15 | C | **Localisation** (language, currency, units) | Reach beyond US | Switch is on the first screen | DIS-18 |
| 16 | C | **NEW — "Tell me what I'd regret"**: for any selection, show the top three things past guests wished they had known (motion on deck 5 aft, tender at Belize City) | Converts review text into foresight | Appears on the cabin and itinerary cards | NEW |

---

## 5. Stage 2 — Book

**Guest question:** *"Can I book without making a mistake, and will it be safe if my plans change?"*

| # | Tier | Feature / issue | Why it decides success | Clear-to-use test | IDs |
| --- | --- | --- | --- | --- | --- |
| 1 | A | **Draft-safe checkout** (saved on every field, resumable, survives offline and app updates) | Losing a booking half done ends the relationship | Close the app mid-payment, return, and land on the same step | BOK-01, S2-10 |
| 2 | A | **Pricing breakdown with deposit, final payment and price lock** | Core trust | Every line is explained and the total never changes at the last step | BOK-05 |
| 3 | A | **Names that match passports, once** (and carried into every later step) | Name mismatches cause the worst downstream pain | The form says exactly what to type and why | BOK-02, S2-06 |
| 4 | A | **Payment that works** (cards, wallets, 3-D Secure, split between payers) | Failed payments lose bookings | Failure shows a plain reason and a next step | BOK-06, S2-04 |
| 5 | A | **Cancellation and change policy in dollars and dates** | Policy text is not understood | Guest sees "cancel on 12 Jan costs $420" | BOK-08, S2-01 |
| 6 | A | **Confirmation that cannot be missed** (number, documents, calendar, Wallet) | The "my booking disappeared" complaint | Confirmation is on the screen, by email and in My Trips within seconds | BOK-07, MNG-01 |
| 7 | B | **"What happens if" simulator** | Removes fear of commitment | Guest picks a scenario and sees the exact cost | S2-01 |
| 8 | B | **Accessibility-first booking** (needs captured once, cabin categories flagged) | Nobody should repeat their needs five times | Needs entered at booking appear in check-in and onboard | S2-06, MNG-12 |
| 9 | B | **Pay-your-share links and a who-has-paid ledger** | Families and groups are the commonest bookers | Each payer pays their share from a link with no account | S2-04, MNG-03, BOK-06 |
| 10 | B | **Short free hold (48 h), honestly counted** | Lets couples decide without pressure | The hold lapses in plain words, with no fake urgency | S2-03, BOK-17 |
| 11 | B | **Plain-English one-page trip contract**, read-aloud and large print | Contracts are unread. This is the antidote | The page fits one screen at the largest text | S2-08, BOK-19 |
| 12 | B | **Price-drop watch and re-pricing** | Guests resent paying more than a neighbour | The app tells the guest if a lower price is available, with steps | S2-02, PRE-17 |
| 13 | B | **Multi-cabin, group and family booking** | Core to the family and group personas | Each cabin has its own guests and bed configuration on one page | BOK-09, XG-01 |
| 14 | B | **Dining time and dietary/allergy captured at booking** | A nut allergy declared late is a safety risk | Allergy is entered once and is visible on later screens | BOK-18, S3-13 |
| 15 | C | **Insurance with clear disclosure, no pressure** | Informed protection | Disclosure is plain and optional | BOK-10 |
| 16 | C | **Guaranteed-cabin odds** | Honest expectation | Shows likely and unlikely decks | S2-07 |
| 17 | C | **Carbon estimate, opt-in, method visible** | Credibility with a growing audience | A range, never a green claim | S2-09 |

---

## 6. Stage 3 — Manage and prepare

**Guest question:** *"What do I still have to do, and am I going to be fine?"* This is the longest stage, often months, and the one where a quiet, reliable app earns loyalty.

| # | Tier | Feature / issue | Why it decides success | Clear-to-use test | IDs |
| --- | --- | --- | --- | --- | --- |
| 1 | A | **My Trips: one reliable source of truth** (even agent-booked) | The top complaint about the current app | After sign-in the booking is there, or a clear "still syncing" state with an ETA | MNG-01, MNG-18 |
| 2 | A | **Trip dashboard with one next action and a readiness score per person** | Prevents surprises and last-minute panic | The next action is the largest thing on the screen | MNG-02, S3-01 |
| 3 | A | **Documents engine** (what *this* guest needs by citizenship and age; expiry warnings) | Wrong documents means denied boarding | The app states "bring X" for each traveller and tracks "I have it" | MNG-05, MNG-11, S3-02 |
| 4 | A | **Payment calendar and reminders** | Missed final payment is a lost cruise | Every due date is listed, with what happens if missed | MNG-03, S2-05 |
| 5 | A | **Itinerary-change handling** (clear diff, options, compensation) | Trust under stress | Shows "what changed, what it means for me, what I can choose" | MNG-15, XD-01 |
| 6 | A | **Notifications the guest controls** (critical always, the rest capped) | Notification fatigue drives uninstalls | Guest sets a daily budget, including zero | MNG-14, XA-03 |
| 7 | A | **Special-assistance requests with deadline tracker and confirmation** | Many services need 30 to 90 days' notice | A countdown shows the cut-off and a confirmation status | MNG-12 |
| 8 | B | **Bill-shock shield: phone-at-sea setup guide** | Roaming charges are the classic cruise surprise | Five plain steps and a before-sailing checklist | S3-07, XT-01, NET-02 |
| 9 | B | **Family-at-home page** (consented, revocable, ship-level only) | Real anxiety for the people who stay behind | Guest creates the link in under a minute and can revoke it in one tap | S3-08 |
| 10 | B | **Dietary and allergy flag with galley confirmation** | Safety; knowing it was received matters | A status reads "acknowledged by the galley" | S3-13, XI-09 |
| 11 | B | **Weekly "what to expect" companion** (capped, tuned to persona) | Keeps first-timers calm; low volume | One note per week, one action, off in one tap | S3-03 |
| 12 | B | **Packing for this ship** (prohibited items, voltage, dress nights, shared lists, offline) | Prevents confiscations and forgotten items | List is correct for the itinerary and works offline | MNG-08, S3-06 |
| 13 | B | **Hurricane and storm watch in plain language** | Fear and uncertainty in season | States likelihood, the line's likely actions and what the guest can do | S3-04, MNG-09 |
| 14 | B | **Medical readiness card** (medicines, allergies, devices; printable) | Half of ship medical patients are over 65 | One page the guest can show a ship doctor | S3-05, MNG-12 |
| 15 | B | **Helper role** (a relative manages on someone's behalf with consent) | The Gerald test; many older guests rely on family | Helper sees only what the guest allowed | INC-01, ACT-05 |
| 16 | B | **Who is on my sailing (opt-in) and cabin-mate matching** | Solo travellers are underserved | Shows only what each person chose, with block and report | S3-09, S3-10 |
| 17 | C | **Away-from-home checklist** (pets, mail, bills) | Reduces mental load | Shareable with the person at home | S3-11 |
| 18 | C | **Kids' preparation pack** (story, muster preview) | Makes children excited, not scared | Child-readable at age 6 | S3-14 |
| 19 | C | **NEW — "Pre-trip rehearsal" for anxious or neurodivergent guests**: a step-by-step picture walk-through of the airport, terminal, muster and cabin, with sounds and crowd levels | Combines social-story and first-timer needs into one reusable asset | Guest can replay it any time offline | NEW (extends XI-03) |

---

## 7. Stage 4 — Pre-book and personalise

**Guest question:** *"How do I get a great week without wasting money or time, and without being nagged?"*

| # | Tier | Feature / issue | Why it decides success | Clear-to-use test | IDs |
| --- | --- | --- | --- | --- | --- |
| 1 | A | **One Plan tab: everything booked and not yet booked, by day** | The Virgin Planner idea, done reliably | Each day shows booked, open slots and conflicts | PRE-15 |
| 2 | A | **Excursions with honest difficulty, duration, all-aboard-aware conflicts** | "Moderate" misleads; late return risks missing the ship | Shows steps, heat, shade, seats and a leave-by time | PRE-01, PRE-02, S4-03 |
| 3 | A | **Dining reservations that actually work** (availability grid, confirmation, reminders) | A top complaint last year | Booking shows a confirmation and a reminder time | PRE-03, DIN-12 |
| 4 | A | **Atomic changes** (old booking kept until the new one is confirmed) | A failed reschedule that leaves nothing is unforgivable | Failure leaves the original in place with a message | DIN-10 |
| 5 | A | **Entitlement engine** ("what's included for me", used vs remaining) | Packages are confusing; every competitor muddles them | One screen lists drinks, meals, Wi-Fi devices and credit remaining | PRE-16 |
| 6 | A | **"Is it worth it?" package calculator** | Reduces regret and complaints | Uses the guest's own habits and current prices | PRE-06, S8-04 |
| 7 | A | **Budget bar** with a gentle note at 80% and 100% | Guests overspend before they sail | Total of everything pre-bought vs target, visible on every shop screen | S4-08, ACC-02 |
| 8 | B | **Build-my-week optimiser with a pace slider** | The core time-saver; turns a catalogue into a plan | One tap proposes a conflict-free week, with the reason for each choice | S4-01, PRE-12 |
| 9 | B | **Slot watch** (sold-out waitlist with auto-book and spending cap) | Sold-out shows and dinners are a daily frustration | Guest gives consent once; each booking is confirmed visibly | S4-02, PRE-14 |
| 10 | B | **Independent vs ship excursion comparator** | Port decisions are anxious and costly | Compares cost, risk and what happens if you are late | S4-04, POR-08 |
| 11 | B | **Group poll and shared itinerary** | Groups decide badly by chat | Votes decide, one confirmation each | S4-05, PRE-13 |
| 12 | B | **Kids and teen club registration with the child brief** (once, shared with the right club) | Parents hate repeated forms | Allergies, pick-up authorisation and a photo entered once | PRE-08, S4-09 |
| 13 | B | **Explainable taste profile with "why am I seeing this"** | Personalisation without creepiness | Every suggestion has a reason and an off switch | S4-07, XT-05 |
| 14 | B | **Price-change protection and price-drop credit** | Plus/Premier rose in price in 2026; buyers feel cheated otherwise | "Your price is locked" on the item | PRE-17, PRE-11 |
| 15 | C | **Surprise mode for celebrations** (hidden from cabin-mates) | Delight with real value | Shared itinerary never leaks surprise items | S4-06, PRE-07 |
| 16 | C | **Rhythm profile (early bird / night owl / nap)** | Plans fit the person | Suggestions respect "no early starts" | S4-10 |
| 17 | C | **Spa, photos, Wi-Fi, laundry, gifts** | Revenue lines, but never in front of required tasks | At most one contextual offer per screen | PRE-05, PRE-07, UX-02 |

---

## 8. Stage 4A — Get to the ship

**Guest question:** *"Will I make it on time, and what do I do if I won't?"* Missing the sailing is the worst possible outcome of the whole trip, and no cruise app owns this stage.

| # | Tier | Feature / issue | Why it decides success | Clear-to-use test | IDs |
| --- | --- | --- | --- | --- | --- |
| 1 | A | **Door-to-ship timeline with "on track / at risk"** | The signature "Door to door" feature | One screen shows each leg, the buffer and the status | S4A-01 |
| 2 | A | **"I'm delayed" button** (tells the line and the party, shows next steps, keeps a record) | Panic needs one tap, not a phone tree | One tap, big button, works with a poor signal | S4A-03, SUP-08 |
| 3 | A | **Arrival window recommendation** (terminal queue, travel time, mobility) | Wrong windows create queues and stress | The recommended window is explained in one line | S5-01, MNG-10 |
| 4 | A | **Embarkation-day info** (terminal assignment with change alerts, map, bag-drop, document checklist) | Core day-of information | Terminal change triggers an alert | CHK-05, CHK-15 |
| 5 | A | **Fly-the-day-before guidance** with cost of a hotel vs cost of missing the ship | A decision most people get wrong | The comparison is numeric, with the line's policy stated | S4A-02 |
| 6 | A | **Flight watch** (status plus revised leave time; raises "at risk" early) | Delays are the commonest cause | Entering a flight number is the only input | S4A-04 |
| 7 | A | **Offline directions and the ship's phone number** | Terminals have poor signal | Map and number available with no connection | S4A-06, SUP-08 |
| 8 | B | **Drive-in mode** (parking, "bags first, then park", route, countdown) | Closed-loop cruises are mostly drive-ins | The steps appear in the right order on the day | S4A-07 |
| 9 | B | **Ground transport options with accessible vans** | Accessibility gap | Wheelchair-accessible options flagged | S4A-06 |
| 10 | B | **Share my ETA / "one of us is delayed" flag** | Parties split up en route | Everyone in the party sees status without messaging | S4A-08 |
| 11 | B | **Arrival-day packing split** (carry-on vs checked) | Cabin bags often arrive late | Medication, documents, swimwear listed for the carry-on | S4A-10, CHK-15 |
| 12 | B | **Hotel handoff and leave-hotel time** | Closes the loop for fly-ins | A computed leave-by time | S4A-11 |
| 13 | B | **Insurance-claim helper** (record of delay, receipts) | Makes claims easy | A single exportable record | S4A-05 |
| 14 | B | **Terminal weather and traffic with "leave earlier"** | Predictable stress reducer | Suggestion states the reason | S4A-12 |
| 15 | C | **Bag photo log** | Helps lost-luggage claims | Photos stay on the device | S4A-09 |
| 16 | C | **NEW — "Meeting point" card for pick-ups**: pin the exact drop-off and pick-up spot for relatives driving you | Removes a real source of last-minute phone calls | Shareable as a link with an address and photo | NEW |

---

## 9. Stage 5 — Check-in and embark

**Guest question:** *"Can I get through check-in and onto the ship without stress?"* The app is needed just to board, so reliability here is the whole game.

| # | Tier | Feature / issue | Why it decides success | Clear-to-use test | IDs |
| --- | --- | --- | --- | --- | --- |
| 1 | A | **Resumable, per-traveller check-in** (parent completes for children; desktop or phone) | The most complained-about flow | Close mid-step and resume at the same step; each traveller's status is visible | CHK-01, CHK-02 |
| 2 | A | **Plain-language errors** ("your passport photo is blurry; hold steady in good light") | Cryptic errors cause abandonment | Every error states the fix | CHK-03 |
| 3 | A | **"What we have on file" receipt** | Ends the lost-data worry | A saved-items list with timestamps survives sign-out | CHK-13 |
| 4 | A | **Boarding pass failsafes** (offline, printable, retrievable by booking number, dead-phone card) | The app being needed to board is a single point of failure | Guest can show a pass with no signal and no battery fallback explained | CHK-04, CHK-14 |
| 5 | A | **Embarkation companion** (terminal → security → photo → gangway → muster → cabin) | Reduces anxiety, avoids queue confusion | One card per step; the current step is largest | CHK-12 |
| 6 | A | **Safe fallback for guests who did not finish** ("what to expect in the Blue Lane") | Do not strand the unfinished | The path is reachable from the home screen | CHK-08 |
| 7 | A | **Muster drill done simply** (video in app; a desk alternative) | Safety obligation | A clear "done / not done" state | CHK-12, SAF-02 |
| 8 | B | **Embarkation forecast with accessible and quiet lanes** | Reduces uncertainty for mobility and sensory needs | Shows expected wait per step and the priority lane | S5-02 |
| 9 | B | **First-three-hours plan** (lunch, muster, bags, sail-away, adapting to cabin readiness) | The first afternoon sets the tone | Plan updates when the cabin is ready | S5-03, CHK-15 |
| 10 | B | **Stateroom quick-start card** (Wi-Fi, TV, safe, thermostat, steward name) | Removes the "how do I..." in the first hour | Five lines, readable at large text | S5-04 |
| 11 | B | **Family boarding plan** (who goes ahead, where to meet, check-in status) | Families split at the terminal | Everyone's status visible in one view | S5-05 |
| 12 | B | **Medallion / keycard status and replacement path** | Locked-out guests are very unhappy | The "my key failed" path does not depend on chat | CHK-06, XD-06 |
| 13 | B | **Luggage tags and bag-delivery status** | Bags are a key anxiety | A "bags delivered" notice | CHK-09, CHK-15 |
| 14 | B | **Port pre-clearance and immigration guidance** | Prevents border issues | Per-country steps with "I did this" | CHK-10, MNG-11 |
| 15 | C | **Welcome-aboard moment** (personal, not promotional) | Delight at the right second | Uses only what the guest chose to share | S5-06 |
| 16 | C | **Express biometric boarding** | Speed, but depends on the line's systems | Opt-in, with a non-biometric route | CHK-11 |

---

## 10. Stage 6 — Sea days and ship life

**Guest question:** *"What should I do now, and is everything under control?"* This is where the app is used most, and where the competitor apps fail on reliability, navigation depth and upsell pressure.

| # | Tier | Feature / issue | Why it decides success | Clear-to-use test | IDs |
| --- | --- | --- | --- | --- | --- |
| 1 | A | **Reliable daily schedule** (schedule integrity: last updated, changes flagged, nothing silently removed) | Virgin's empty schedules wrecked trust | Cancelled items stay, struck through, until the day ends | OB-02, OB-08 |
| 2 | A | **Offline-first** (schedule, deck plans, menus, reservations, boarding pass) | The ship is a poor-connectivity place | Airplane mode shows everything with its age | OB-03, PERF |
| 3 | A | **Contextual home with the next thing** (events, reservations, all-aboard, weather, sail-away) | "What do I do now?" | The next event is the first thing visible | OB-01 |
| 4 | A | **Planner that can be sorted and filtered** (time, venue, deck, interest, age, accessible, included vs extra cost) | Complaint: events cannot be sorted | A simple one-column view at large text | OB-09 |
| 5 | A | **Urgent help always visible** (phone and emergency number offline; non-medical urgent path) | Safety and trust | "Get help now" is on every screen | SUP-08, SAF-08 |
| 6 | A | **Two-tap rule for the top 15 tasks** | Features buried several levels deep is the top review complaint | Verified by a task-path test | UX-01 |
| 7 | A | **Interactive deck plans with accessible routes, lifts and muster stations** | Navigation in a big ship | Searchable; "you are here" if location is shared | OB-04 |
| 8 | A | **My account and spend: live folio, package use, charge explanations** | Bill shock is the top trust issue | Every charge has "explain this" | ACC-01, XT-02, PRE-16 |
| 9 | A | **Family locator and child safety** (consented, safe zones, teen agreement) | Parents' number-one worry | A parent sees where a child was last seen, with the child's consent rules | SAF-05, S6-14 |
| 10 | A | **Food and drink ordering that survives one missing item** | The "one unavailable item blocks the order" complaint | Out-of-stock item is flagged and swapped in a tap; there is a "contact about this order" action | DIN-11, DIN-04 |
| 11 | A | **Free messaging for the whole party** | A competitor advantage elsewhere | Works with no internet package | MSG |
| 12 | B | **Ship Pulse and shortest-line** (crowds with age and confidence; "good time to go"; virtual queue) | The most-wished-for ship-data feature | Each venue shows quiet / busy and when it was measured | S6-01, S6-05, OB-05 |
| 13 | B | **Autopilot day** (the plan reflows when something changes, with preview, accept, undo) | Static lists go stale | The guest approves; nothing changes silently | S6-02, XA-02 |
| 14 | B | **Spend coach** (pace vs budget; "9 of 15 drinks today"; informational, never shaming) | Turns package confusion into confidence | Shows used vs remaining in words | S6-06 |
| 15 | B | **Calm mode, quiet-space finder, "take me back to my cabin"** | Inclusion that no competitor does | One large button gives a simple route in words | XI-01, S6-04, S6-16 |
| 16 | B | **Gentle mode** (rest breaks, hydration, sun) for older guests | The core demographic | Notifications limited to a short chosen list | S6-03 |
| 17 | B | **Rendezvous and meet people (opt-in)** | Families and solo travellers | Everyone's "on my way / here" is shown | S6-12, S6-11 |
| 18 | B | **Kids' daily report and pick-up reminders** | Parents want reassurance | Report arrives with the parent's consent | S6-13 |
| 19 | B | **Ask your cruise** (grounded assistant, propose-confirm-do-undo) | Next-generation help | Answers cite sources; actions need a confirm | XA-01, XA-02 |
| 20 | B | **Seasickness first aid and illness-report flow** | Real, common, and handled badly | The report flow gives isolation and meal guidance | S6-09, SAF-03 |
| 21 | B | **You said, we did** (feedback loop) | Guests rarely see feedback matter | One-tap feedback; a ship-wide board of changes | S6-19 |
| 22 | C | **Sun, moon and stars guide; wildlife log** | Delight at sea | Shows tonight's sunset and the best deck | S6-07, S6-08 |
| 23 | C | **Daily journal that assembles itself** | Feeds the memory book | The guest chooses what to keep | S6-22 |
| 24 | C | **"We're OK" postcards to the family-at-home page** | Shareable and kind | Queued offline | S6-24 |
| 25 | C | **Move and play challenges, lounger fair-use, dining that remembers** | Quiet delight | All optional; quiet by default | S6-21, S6-10, S6-20 |
| 26 | C | **NEW — Cabin service in one tap** (extra towels, turndown time, do-not-disturb, "fix this") | Basic stateroom requests are still a phone call on most apps | Request, ETA and status are visible, and it works offline-queued | NEW |
| 27 | C | **NEW — Live translation card for crew and guests** (pre-written phrases, with text-to-speech) | Multilingual ships; a gentle accessibility win | Common phrases in 6 languages, offline | NEW |

> Rank 1 to 11 are the "basic job" of the stage. Rank 12 to 21 are why a guest would choose us. Tier C is the long tail, only after the first 21 are flawless.

---

## 11. Stage 6A — In port

**Guest question:** *"How do I have a great day ashore and be back on time?"* A port day is a time-boxed mission with real consequences.

| # | Tier | Feature / issue | Why it decides success | Clear-to-use test | IDs |
| --- | --- | --- | --- | --- | --- |
| 1 | A | **All-aboard time in ship time, with the local equivalent (three clocks)** | Missed ships from time-zone confusion | Ship, local and phone times shown together; reminders fire on ship time | POR-11, POR-02 |
| 2 | A | **Port Day Pilot: leave-by time, computed backward from all-aboard** | The signature feature for port days | The leave-by time is the largest thing on the card | S6A-01 |
| 3 | A | **Escalating all-aboard alerts** (final hour) | A competitor shipped this in 2026 | Alert gets louder as the deadline nears | POR-02 |
| 4 | A | **Tender day mode** (ticket group, wait, last tender back, weather switch) | Belize and Roatán are tender ports | One card with the ticket, wait and last tender | POR-04, S6A-15 |
| 5 | A | **"I'm back aboard" and party nudges** | Peace of mind for families | One tap; a nudge at a chosen time if someone is not back | S6A-05 |
| 6 | A | **"What if I'm late"** (policy, port agent, ship's next port, insurance record) | The guest's worst fear | Reachable in two taps, works offline | POR-08, XD-05 |
| 7 | A | **Port-day safety and local-law notes** (heat, rip currents, drugs, vaping, coral and shell) | Real legal and safety risk | Short, calm, factual | S6A-08, POR-07 |
| 8 | A | **Accessible port planning** (route, pier or tender arrangement, accessible transport) | The Linda test | Accessibility info shown before price | POR-12 |
| 9 | B | **Crowd and ships-in-port, quietest hours, "stay aboard" note** | Port crowding is a growing problem | States the number of ships and a quiet window | S6A-02 |
| 10 | B | **Fair-price card and scam alerts** | Taxi and tour overcharging is universal | A "do not pay more than" line | S6A-03 |
| 11 | B | **Plan B attached to every plan** (rain, heat, tender delay, low energy) | Plans fail | One tap swaps to plan B | S6A-04 |
| 12 | B | **Shared port plan and split costs** | The Harper/Brennan scenario | Shows who paid and who owes | S6A-06 |
| 13 | B | **Independent vs ship excursion explainer** | Anxious decision | States what the line does if you are late | S4-04, POR-08 |
| 14 | B | **Offline self-guided walks and maps** | No data ashore | Works with a roaming-free phone | S6A-10, POR-06 |
| 15 | B | **Phrasebook with audio, etiquette and allergy phrase cards** | Real communication help | Allergy card in the local language | S6A-07 |
| 16 | B | **"Don't bring it back" customs check** | Customs fines | Linked to the customs screen on the way home | S6A-09 |
| 17 | B | **Port-day readiness checklist** | Forgotten tender tickets, ID, sunscreen | One tap to share with the party | POR-13 |
| 18 | C | **Day-pass finder, kids/pram ashore, local vendors** | Family and community value | Each shows price, distance and shade/seat info | S6A-11, S6A-12, S6A-13 |
| 19 | C | **Port snapshot shared album** | Memory-building | Shared with consent | S6A-14 |
| 20 | C | **NEW — Cash and currency helper**: what to carry, where cards fail, typical prices, and a quick converter | Cash is a common port-day trip-up | Works offline; shows prices in USD | NEW |

---

## 12. Stage 7 — Disembarkation

**Guest question:** *"Can I get off, home and onward without trouble?"*

| # | Tier | Feature / issue | Why it decides success | Clear-to-use test | IDs |
| --- | --- | --- | --- | --- | --- |
| 1 | A | **Disembark choice and time, aware of the flight** | Early flights, long queues | Recommends a group with the leave-by time | DEB-02, S7-01 |
| 2 | A | **Bag night: tag status, hallway deadline, "my bags are out"** | The common last-night failure | A countdown and a done tick | S7-03, DEB-07 |
| 3 | A | **Bill line-by-line, with "question this" and the gratuity-adjust window** | The last chance to dispute | Every line explained before the last day | S7-05, XT-02 |
| 4 | A | **Cabin sweep checklist** | Lost phones, chargers, medication | One tap "all checked" | S7-02 |
| 5 | A | **Customs help and pre-fill** | A stressful, formal step | Draft declaration from purchases, official form stays official | DEB-04, S7-04 |
| 6 | A | **Lost and found, live** | Valuables lost at the last moment | Photo and place; match notification | S6-25, DEB-06 |
| 7 | A | **Onward plan** (ground transport, hotel late check-out, airport prompts) | Travel home is part of the trip | A "take your time" option | S7-10, DEB-05 |
| 8 | B | **Low-stress mode for older and disabled guests** | Inclusion | Extra buffers, assist booked, no promotions | S7-06 |
| 9 | B | **Three-tap farewell** (one moment, a rating) | Captures sentiment while it is fresh | Detail is optional | S7-08 |
| 10 | B | **Meet-up and ride-pool** | Saves money and stress | Settles in the ledger | S7-07 |
| 11 | B | **Receipts and expense export** | Business and shared trips | CSV and PDF | S8-08, POS-01 |
| 12 | B | **After-cruise health follow-up** | Public health and care | Consented; a short note at 3 and 7 days | S7-09 |
| 13 | B | **Printable disembark plan** (non-app parity) | Not everyone uses the app | Large print option | INC-01 |
| 14 | C | **Gratuity privacy** (never visible to staff or other guests) | Trust | The privacy centre says so | XT-04 |
| 15 | C | **NEW — "Leave something behind" card**: leave tips for named crew with a kind note, private | Crew recognition, no shaming | The crew sees the note, not who tipped | NEW (extends S6-23) |

---

## 13. Stage 8 — Remember, return and refer

**Guest question:** *"What was it worth, and would I do it again?"* The loop that feeds the next Stage 0.

| # | Tier | Feature / issue | Why it decides success | Clear-to-use test | IDs |
| --- | --- | --- | --- | --- | --- |
| 1 | A | **Receipts and trip history that never vanish** | Trust ledger | Searchable and exportable | POS-01, XT-07 |
| 2 | A | **Honest feedback with human follow-up; marketing paused while a complaint is open** | Recovery builds loyalty | A person responds in a stated time | POS-02, S8-09 |
| 3 | A | **Photo access and purchase integrity** (select first; resumable; verifiable downloads) | Complaint about photo errors | "12 of 12 saved" | SHP-07, POS-04 |
| 4 | A | **Loyalty in plain words** (status, next tier, days away, what each benefit is worth) | Gerald and the repeaters | No countdown pressure | S8-10, POS-05 |
| 5 | A | **Data portability and a clean exit** | Trust and law | Download and delete, with what is kept stated | S8-12, ACT-06 |
| 6 | B | **Memory book** (printable/PDF, offline, device-made) | A keepsake nobody else offers | Generated in one tap | S8-02, POS-03 |
| 7 | B | **Cruise "wrapped" cards** (drinks are opt-in) | Shareable, brand-building | Never auto-posted | S8-01 |
| 8 | B | **Seeded next trip** (carries lessons; booked only on confirm) | Turns satisfaction into rebooking | The draft shows what changed and why | S8-05, POS-06 |
| 9 | B | **"What I'd change" and package hindsight** | Learning loop | "You used $X of $Y" | S8-03, S8-04 |
| 10 | B | **Stay in touch / sail again together** | Community | Mutual opt-in only | S8-06 |
| 11 | B | **Honest referral** (credit for both sides shown first) | Fair word of mouth | Credit visible before sending | S8-11, POS-08 |
| 12 | B | **Rebook with incentives and Future Cruise Credit handling** | Revenue | Leftover credit converted clearly | POS-06, BOK-11 |
| 13 | C | **Anniversaries ("this day last year")** | Quiet delight | Easy off | S8-07 |
| 14 | C | **Family traditions** | Sentimental | Repeats on the next trip | XG-04 |
| 15 | C | **Sustainability facts, honestly** | Credibility | No claims the line cannot back | XT-08 |
| 16 | C | **NEW — "Share the cruise with someone who couldn't come"**: a gentle recap (not the full album) sent to a named person | Emotional, shareable | One link, no account | NEW |

---

## 14. Cross-stage priorities (apply everywhere)

These are the cross-cutting families from LF §15 to §19. They are not extra stages but they decide whether the stage lists above hold up under stress.

| # | Tier | Cross-cutting feature | Applies in stages | IDs |
| --- | --- | --- | --- | --- |
| 1 | A | **Disruption Hub** (what happened, what it means for me, what's done, what I can choose, how to reach a human) | 3, 4A, 5, 6, 6A, 7 | XD-01…XD-10 |
| 2 | A | **Money shield** (explain every charge, confirm over a limit, no shaming, no auto-renew) | 3, 4, 6, 7 | XT-01…XT-07 |
| 3 | A | **Accessibility to WCAG 2.2 AA plus non-app parity** | all | A11Y, INC-01 |
| 4 | A | **Offline and age-stamped data** | all | PERF, OB-08 |
| 5 | A | **Dark-pattern test suite** | all | XT-10 |
| 6 | B | **Inclusion** (Calm mode, sensory plan, social story, caregiver mode, audio and deaf support) | 3, 5, 6, 6A | XI-01…XI-11 |
| 7 | B | **Groups and family** (organiser dashboard, per-person privacy, split ledger) | 2, 3, 4, 6A | XG-01…XG-07 |
| 8 | B | **Assistant that helps and asks first** | all | XA-01…XA-10 |

---

## 15. The shortlist: the 20 things that must be right

If time ran out, these 20 decide whether the app is judged best-in-class. They are the highest-ranked items from across the stages.

| # | Feature | Stage(s) | Why |
| --- | --- | --- | --- |
| 1 | One reliable **My Trips** with one next action | 3 | The top complaint |
| 2 | **Draft-safe, resumable** booking and check-in | 2, 5 | Never lose the guest's work |
| 3 | **Boarding pass failsafes** | 5 | The app is needed to board |
| 4 | **Real total price** and "what's not included" | 1, 2 | The first betrayal |
| 5 | **Documents engine** | 3 | Wrong documents means denied boarding |
| 6 | **Door-to-ship timeline and "I'm delayed"** | 4A | Missing the ship is the worst outcome |
| 7 | **Three clocks and Port Day Pilot** | 6A | Time-zone misses |
| 8 | **Schedule integrity** (nothing silently changes) | 6 | Trust in the plan |
| 9 | **Offline-first** everywhere | 5, 6, 6A | A ship is a poor-signal place |
| 10 | **Two-tap rule** and a persistent **Get help now** | 6 | The "buried features" and "unreachable humans" complaints |
| 11 | **Money shield**: explain, confirm, no shaming | 3, 6, 7 | Bill-shock and tipping trust |
| 12 | **Entitlement engine** ("what's included for me") | 4, 6 | Package confusion |
| 13 | **Atomic reservation changes** and resilient orders | 4, 6 | Broken flows lose trust |
| 14 | **Disruption Hub** | all | Guided recovery |
| 15 | **Cabin chooser** | 1 | The biggest decision is made blind |
| 16 | **Family-at-home page and child safety tools** | 3, 6 | Anxiety for the people who matter |
| 17 | **Accessibility and non-app parity** | all | Core demographic |
| 18 | **Autopilot day and Ship Pulse** | 6 | The clearest "wow" |
| 19 | **Calm mode and sensory plan** | 3, 5, 6 | Genuine gap in the industry |
| 20 | **Memory loop** (book, wrapped, seeded next trip) | 8 | Closes the loop to the next trip |

---

## 16. What else could make this best-in-class?

The existing documents are strong on breadth and trust. Looking again from the guest's seat, these are the ideas **not** already in FR or LF (each tagged NEW above or here), ranked by how much they would be noticed.

| # | Idea | Stage | Why it would be noticed | Effort |
| --- | --- | --- | --- | --- |
| 1 | **Trial-day simulator** ("a Tuesday on this ship, for you") | 0 | Makes the decision tangible and shareable | M |
| 2 | **"What I'd regret" foresight cards** on cabins and itineraries | 1 | Turns review text into advice nobody else gives | S |
| 3 | **Cabin service in one tap** (towels, turndown, do-not-disturb) with status | 6 | Basic, constant, and still a phone call on most apps | S |
| 4 | **Pre-trip rehearsal** (picture walk-through of airport to cabin) | 3 | Calms first-timers and neurodivergent guests alike | M |
| 5 | **Meeting-point card** for drop-off and pick-up | 4A | Removes a tiny, constant source of stress | S |
| 6 | **Cash and currency helper** | 6A | Common port-day trip-up | S |
| 7 | **Live translation phrase card** (offline, with audio) | 6 | Multilingual ships | S |
| 8 | **Private crew thank-you** (never reveals who tipped) | 7 | Reinforces the no-shaming stance | S |
| 9 | **"Share the cruise" recap for someone who couldn't come** | 8 | Emotional and shareable | S |
| 10 | **Guest-research programme** (five conversations each with older, neurodivergent and solo cruisers, in the first month) | all | LF §23 admits priorities rest on judgement, not measurement. Real conversations are worth more than more desk research | S |
| 11 | **Quality scorecard per release** (the 9 measures in FR §23.6, plus task-time targets such as "show boarding pass in under 5 seconds") | all | Keeps the experience bar honest as features grow | M |
| 12 | **Demo scenario pack** for the top 5 emotional moments (missed flight, skipped port, tender delay, allergy, child not at club) | all | Proves the value in a presentation in under 10 minutes | M |

Effort: S = small, M = medium (rough guess; not estimated against the code).

---

## 17. Gaps and cautions in the current plan

Things this review noticed that are worth deciding before building more:

1. **Too many Should items.** LF makes almost everything an S. At 15 to 25 items per stage the list is long; the **A tier** here is the real Must set and should be the build order. The B tier is the marketing story.
2. **Simulated data credibility.** Ship Pulse, flight watch, crowd levels and sun-side planning are all simulated (LF §3 decision). Each must show age and a "simulated" signal in demos so no one mistakes it for real, even though the production front end must not know (CLAUDE.md). Resolve how this is shown in the demo without breaking that rule: a demo banner owned by the backend mock, not the front end.
3. **Moderated social features** (S3-09, S6-11, S8-06) need moderation that we cannot staff. Keep them opt-in and small, and be ready to cut them.
4. **Notification fatigue risk.** Weekly notes, Autopilot proposals, slot watch, pulse alerts and family check-ins all want to notify. The notification budget (XA-03) must be a Must, not an S, or the app will annoy guests more than it helps.
5. **Offer restraint vs revenue.** UX-02 limits offers to one per screen and none on task screens. That is a deliberate trade-off against upsell revenue; confirm it is intended.
6. **Not verified against code.** Nothing here was checked against `src` or the backend. The next step is to mark each A-tier item as built, partial or missing.

---

## 18. Suggested next steps

1. Review the A tier of each stage and the §15 shortlist; strike or move anything that is wrong.
2. Audit the A tier against the built app and backend (built / partial / missing).
3. Choose which NEW ideas in §16 to adopt (I would start with 3, 5, 6, 7, 8, which are small).
4. Plan the next build phase from the missing A-tier items. Per `CLAUDE.md`, work in phases, commit and stop after each.
