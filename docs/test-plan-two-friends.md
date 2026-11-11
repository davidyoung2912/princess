# Test plan: two adult friends sharing a room, doing everything

Persona: **two unrelated adults, one stateroom, one booking.** They want the most from the week: eat everywhere, see every show, go ashore every port, host a party, stay up late. The test goal is to **fill every day**, so you exercise booking, dining, entertainment, excursions, packages, queues, chat, parties and the shared bill, and to find where a two-person, two-account trip breaks.

This plan builds on `docs/test-plan-solo-cruiser.md`. That plan holds the shared mechanics: setup, the testing clock and the `IsDemo` switch, test cards, the cross-cutting checks and the failure paths. Run its section 0 first, then use this plan. Steps below only list what is **different or extra** for two friends.

Each step has an **Expect** line. Where I could not confirm behaviour from the code, the step says **record what happens**, and section 15 lists those as open questions. Log problems in section 14.

> **Not run.** Written from the screen registry, the English strings and the server rules, not by running the app.

---

## 0. Read this first: how two friends fit the app

| Fact | Where it comes from | What it means here |
|---|---|---|
| **One person books and pays.** Only the booker sees the money. | `org.moneyBooker`: "Only the person who made the booking sees the money." | Friend A is the **booker**. Friend B never sees the price, deposit or balance. |
| **The second guest on a direct booking has no account.** | `DapperBookingStore.cs`: guests after the first are saved with no user | When A books for two, B is a name on the booking, **not** a signed-in guest. |
| **A booking can be linked to another account only if it is an agent booking.** | `TripService.LinkAsync` | B registering and "linking" A's direct booking probably **fails**. This is the biggest risk for this persona. |
| **Chat between people on one booking needs two accounts on that booking.** "Guests who share your booking can still chat with you" even when they hide from search. | `people.findableBody` | Only works if B is a real member of the booking. |
| **Finding people by name works only among guests on your sailing.** | `people.hideConfirm`: "no one on your sailing will be able to find you by name" | B needs to be on the sailing (a booking member) to be found. |
| **The fare split is a notebook, not a payment.** "Kept on this device; no payment links are made and nothing is collected." | `shares.intro`, `split.noMoney` | A and B settle up themselves. Test the arithmetic, not any money movement. |
| **Cabin parties invite other cabins** (up to 6) and stop at 23:00. | `MAX_PARTY_CABINS`, `QUIET_FROM` in `src/domain/services.ts` | "Party" in the app is a cabin gathering with quiet hours. |

### 0.1 Three ways to run it

Run **Route 1 for the whole journey.** Use Routes 2 and 3 only for the social steps that Route 1 cannot reach.

- **Route 1 (the real one).** A registers and books both guests. B registers a **separate** account. Record, step by step, what B can and cannot do (section 6.6). Most social features may be unreachable for B. Each unreachable step is a finding, not a skipped test.
- **Route 2 (agent booking).** Use a seeded **agent booking** so B can actually link it. The README says a guest account can link an agent booking with the booking number, the lead guest's surname and the departure date (the seeded example is booking `AG7P31BK`, linked by the account `Nina`). Check it has **two** adult guests; if it has only one, record that and use Route 3.
- **Route 3 (two cabins, same sailing).** To test chat, find-by-name and cabin parties, give B **their own booking** on the same sailing in another cabin. This is **not** the persona (they are no longer sharing a room). Mark every result "Route 3" so nobody mistakes it.

### 0.2 Setup and test data

| Item | Friend A (booker) | Friend B |
|---|---|---|
| Name (as on passport) | `Alex Rivera` | `Jordan Blake` |
| Email | `friends.alex+1@example.com` | `friends.jordan+1@example.com` |
| Date of birth | `1995-05-14` (age 29 to 31) | `1991-11-02` |
| Citizenship | US | US |
| Password | `correct horse battery` | `correct horse battery` |

- **Different surnames.** Check every screen (boarding passes, dining, tickets, chat) uses each person's own name and never "the Rivera party".
- **Sailing:** a Sun Princess sailing with at least two port days, two sea days, and a **formal night**. The more days, the more activities to fill.
- **Room:** an inside or balcony room for **two guests**, **two sharing** (no solo supplement).
- **Cards:** `4242` (works), `0002` (declined), step-up code `123456` for $3,000 or more or a non-default card.
- **Bedding:** see 5.3. Friends need **two single beds**.
- Run the solo plan's 0.2 (mark A's account as a demo account before Stage 5). Mark **B's** account too, so both follow the same clock.

### 0.3 The "do everything" checklist
Tick these as you go. By the end of Stage 10, each should be true.

- [ ] Every sea day and port day has something booked or planned for **both** friends.
- [ ] At least one **specialty dinner**, one **main-dining** meal, one **walk-in queue** use and one **waitlist** entry.
- [ ] At least one **ticketed show** and one non-ticketed one.
- [ ] One excursion each port, one **independent** plan, and one **excursion that only one friend does**.
- [ ] A **drinks package** and a **Wi-Fi package** bought, and the costs split.
- [ ] A **cabin party** planned and answered.
- [ ] A **late night** (after-all-aboard events, 23:00 quiet hours) and an **early morning**.
- [ ] A **photo** and a **trip diary** entry.
- [ ] A **bill split** worked out at the end.

---

## 1. Stage map

Same 11 stages and tabs as the solo plan (section 1). One difference to keep in mind: **A and B can sit in different stages** (A has a booking; B may not see it). Check each account's stage separately.

---

## 2. Registration: two friends, two accounts

Run the solo plan's section 2 (R1 to R4) for **A**. Repeat R2 to R3 for **B** in a private window.

Friend additions:
1. **Different people, different surnames.** **Expect:** no "Is this you already?" page.
2. **Same email.** Try to register B with A's email. **Expect:** "That email address already has an account…"
3. **Shared device.** Sign A out and B in on one browser. **Expect:** no trace of A's data after sign-out.
4. **Under-21 variant** (separate run): B born so they are **20** on sailing day. **Expect:** registration allowed (over 18). This variant matters in 7.8 and 10.7.
5. Both accounts start in **Dream** with empty histories.

---

## 3. Stage 1: Dream (A and B)

Run the solo plan's section 3, with these differences. This is also where the two friends plan together.

1. **Quiz** (`H02`): answer with **"With friends"** if offered (the solo answer is "Just me"). **Expect:** results that suit a group of friends, and not "A sensible fit when you are travelling alone."
2. **Ask Stanley (before you book)** (`H04`). Ask each and record the answer:
   - "Two friends sharing a room: any problems?"
   - "Can we choose two single beds?"
   - "What is there to do at night?"
   - "Is there a party cabin or nightclub?"
   - "How do we split the cost?"
   **Expect:** accurate answers with nothing invented.
3. **Group Poll and Dream Board** (`P49`) and **Links** (`P50`): A creates a poll of three sailings and shares the link.
   - Open it **signed out**: **Expect:** a limited read-only view.
   - Open it **as B**: record whether B can vote and whether the vote shows B's name.
   - Vote differently as A and as B. **Expect:** a clear tie or leader.
   - Turn the link off. **Expect:** the old link stops working with a generic message.
4. **Paste a Plan** (`P21`): paste a friend-trip plan as text. **Expect:** it is parsed; check it does not move A to Discover unless it names a sailing.
5. **Saved Sailings:** each account has its **own** list. **Expect:** A saving a sailing does not change B's.

---

## 4. Stage 2: Discover (A)

Run the solo plan's section 4 for A, with these differences. **B stays in Dream.**

1. **Cabin** (`H14`): choose **2 guests**, two sharing. **Expect:** no solo note; price is per person, two sharing. Compare 1 guest and 2 guests; record both totals. (The solo supplement is for one guest only.)
2. **Cost** (`H12`): 2 guests. **Expect:** no "Solo supplement" line; taxes and extras scale with two guests. Record the total.
3. **Is This Cruise for Me?** (`H13`): **Expect:** the "Sailing on your own" card is **not** shown.
4. **A Day on This Ship** (`X02`), **Ship Pulse** and **Restaurants and Bars**: browse for **nightlife**: bars, clubs, theatre, late-night menus. Make a list of what you will try.
5. **Offers** and **Price-Drop Watch**: A turns on a watch. **Expect:** it belongs to A alone.
6. **Hold a cabin for 48 hours** (`P20`): A holds it. Record whether B can see or release the hold (**Expect:** no).
7. **Sailing choice for friends:** compare two sailings (`H51`) that differ in port days or nightlife and choose the one with more to do.

---

## 5. Stage 3: Book (A)

Run the solo plan's 5.1 to 5.3 for the funnel, with these differences.

### 5.1 Guests and room
1. **Room:** two guests, **two sharing**.
2. **Guests:** guest 1 is Alex (prefilled). Add guest 2 as **Jordan Blake** with the exact passport name, date of birth, gender and citizenship.
3. **21+ rule:** **Expect:** satisfied (both adults). On the **under-21 run**, A (21+) satisfies it for B (20). Record the wording at Review.
4. **Blank and error handling:** leave B's date of birth blank. **Expect:** an error naming guest 2. Fix it.
5. **Accents and punctuation:** try a hyphenated or accented name for B. **Expect:** accepted if valid on a passport.
6. **Needs:** B has a **vegetarian** diet and A has **no needs**. **Expect:** saved to B only.
7. **Dining:** choose the **late seating** (friends stay out) if offered, with a table for two or a **shared table** to meet people.
8. **Review:** **Expect:** both names, room, fare for two, taxes, total, deposit, balance and its date. Check the total equals the Discover cost page.
9. **Accept** the contract. The booking's terms apply to both guests.

### 5.2 Bedding
1. **Traveller Details** or **Profile** (`M04`/`M05`): find the **Bedding** preference: *One large bed*, *Two single beds*, *No preference*. Set **Two single beds** for **both** guests.
2. **Expect:** it is saved per person and noted as "passed on" (see "How these are used"). Try the conflict: A chooses *One large bed* and B chooses *Two single beds*. **Record how the app resolves it** (it may not).
3. Look for the same choice in **Cabin Requests** (`S21`) and **My Stateroom** (`S22`) later (Stage 7).

### 5.3 Travellers tab
1. **Your Travel Party** (`P47`): **Expect:** A and B, each with their own name, and A shown as the booker.
2. **Traveller Details** (`M05`): fill B's details on A's account. Record whether B can later edit them from B's own account.
3. **Accessibility**, **Special Assistance**, **Allergy Pre-Flag**: set different values for A and B. Reload. **Expect:** each is saved to the right person.
4. **Privacy between roommates:** record what A can see of B's medical card and documents (the booker can usually edit travellers' details). The screens must say so plainly.

### 5.4 Pay (A)
1. Declined card `0002`, then `4242`. **Expect:** as in the solo plan.
2. **Split between two payment methods:** A pays half with `4242` and half with a second card. **Expect:** amounts must add up to the total; a non-default card needs the step-up code.
3. **Pay in full vs deposit:** do both on separate runs. Record the balance date.
4. **Split Costs** (`P15`): add two "families" named **Alex** and **Jordan**, one person each. Add the deposit as a shared cost. **Expect:** the arithmetic is right and the screen says "No money moves here".
5. **Pay Your Share** (`P16`): add **Jordan** to the split. **Expect:** "Adding or removing someone re-splits the fare evenly and keeps who has paid." Mark Jordan paid. **Expect:** "Paid {paid}. Still to collect {owed}." Use **Chase kindly** in each tone (friendly, neutral, firm). **Expect:** a message you can send yourself; the app never sends it.
6. **Where it lives:** these lists are "kept on this device". Check them on a **second device** as A. Record that they do not appear (and that the screen says so).
7. Pay the deposit. **Expect:** Booking Confirmed with a confirmation number; A moves to **Manage**.
8. **B's account:** sign in as B. Record B's stage and whether the booking appears. (Probably still Dream with no booking. That is a finding for Route 1.)

---

## 6. Stage 4: Manage (A and B)

Run the solo plan's section 6 for A, with these friend steps.

### 6.1 Trip and documents
1. **Trip Details**, **Booking Confirmed**, **Trip Contract**: both names appear.
2. **Documents** (`M06`): add passports for both guests. Add B's with an expiry **inside six months** of the return date. **Expect:** a "too soon" problem for B only. Fix it.
3. **Readiness for Each Traveller** (`P12`): **Expect:** two rows with their own blockers. Make both ready.
4. **Checklist** (`P01`): tick two items. **Expect:** ticks persist on that device.
5. **Ask Stanley (your trip)**: ask "Is my roommate's passport okay?" **Expect:** the answer respects privacy and refers to the readiness screen.

### 6.2 Group tab (A)
1. **Party Chat and Guest Services** (`C01`): record what A sees with no other member signed in.
2. **Your Travel Party** (`P47`): **Invite a co-traveller:** add Jordan's email as an invitation. **Expect:** it **saves the address and sends no email** (the screen says so). Add a duplicate. **Expect:** the duplicate error.
3. **Organiser and Privacy** (`P43`): **Expect:** "Who is on the booking and how far along they are." B's progress shows only if B chose to share it. Record what each toggle does.
4. **Shared notes** on the party page: add one note "Dinner plans" (280 characters max). Add one over 280. **Expect:** the too-long error. Delete the first.
5. **Several Cabins, One Day** (`P46`): **Expect:** not needed.

### 6.3 Helper (`M14`): can B manage the trip?
1. As A, read the helper screen.
2. As B, try to ask to help with A's booking (the strings say the helper "has asked to help").
3. As A, accept with only **See my trips**, **See my check-in progress** and **See my sailing** turned on. **Expect:** B sees those three and nothing else.
4. **Expect:** **Pay for my booking** shows "Not available yet. A helper cannot pay for you in the app; Guest Services can take payment by phone."
5. Revoke the grant. **Expect:** B's view disappears.

### 6.4 Family at Home (`P48`)
Create a link for **B's parent** or a friend at home. **Expect:** read-only, no passport or payment data.

### 6.5 Me tab
**Payments** shows the deposit receipt to A only.

### 6.6 B's own account (probe)
Sign in as B. Record:
- stage and tabs
- whether **My Trips** lists the booking
- whether **Link a booking** (`trips.link`) accepts the number, A's surname (`Rivera`) and the departure date (**expect a generic "no match"** for a direct booking)
- what B is told about getting access

**If B has no access**, record that the **second friend cannot check in, order, chat or book anything from their own account.** That is the main risk for this persona. Then switch the remaining steps to **Route 2** (agent booking) where the step needs B.

**Move on (demo clock):** mark both accounts as demo accounts and sign out and in.

---

## 7. Stage 5: Prebook: plan the whole week (A, and B where possible)

Run the solo plan's section 7. This is the stage where the "do everything" plan is built. Aim to fill **every day**.

1. **Trigger:** pay the balance on one run, and jump to 14 days out on another.
2. **Itinerary map.** Open **The Cruise and Its Route** and write down each day as sea, port or embark. Build a day table: Day 1 embark, Day 2 sea, Day 3 port, and so on.
3. **Excursions** (`P37`): for **each port day** book one excursion for **both** friends (quantity 2). Book one that **only one friend does** (quantity 1) so the other has a free day.
4. **Ship or Independent** (`P44`): compare for one port, choose independent for that port.
5. **Dining Reservations** (`P38`): plan a dinner for each night: at least one **specialty** dinner (Crown Grill, Sabatini's, The Catch, Love by Britto), one main dining, one casual. Book **two** guests each time.
6. **Specialty dining pass** (`P23` or Packages): buy the pass (three dinners). **Expect:** priced per person, so $129 x 2 at the base price. Use it for three specialty bookings.
7. **Waitlist.** Try to book a **full** time (pick the peak time). **Expect:** "That time is full. You can join the waitlist…" Join. Turn on **Book it for me when a table frees up**. **Expect:** "We will book it for you."
8. **Book Ahead** (`P26`) and **Shows**: get **tickets for a ticketed show** for two. **Expect:** seats left shown; two tickets booked under both names. Try to book a third ticket. Record the limit.
9. **Build My Day** (`P34`), **Autopilot Day** (`P39`): choose the **packed** pace, **no early starts**. **Expect:** a packed schedule with late events and a rest-day alternative. Accept some items, swap one.
10. **My Daily Rhythm**, **Surprises**, **What the App Thinks You Like**: set likes to **nightlife**, **music**, **food**. **Expect:** suggestions change.
11. **Packages** (`M08`): see the cost lines.
    - **Drinks package:** "A drinks package for every adult." **Expect:** priced per person per night, **both** adults. Record whether you can buy for one friend only.
    - **Wi-Fi, one device:** buy **two** (one each).
    - **Price change:** the drinks package rises **13%** from **15 days before sailing**, and Wi-Fi **20%** from 20 days. Buy one **before** and one **after** the change date (jump the clock). **Expect:** the price differs, with the change date shown.
12. **Cabin party** (`S44`): look ahead now. **Expect:** you may plan a party for a later day (done in Stage 8).
13. **Packing List** (`P02`) and **Packing for This Ship** (`P03`): add formal-night clothes and swimwear.
14. **Phone Setup** (`P05`), **Getting to the Port** (`P29`): plan the trip to the port together. Record whether it assumes one traveller or two.
15. **Under-21 variant:** on the run where B is 20, try to buy the **Drinks package** for B. **Expect:** refused or not offered (minimum age 21), and the cost note says so.

---

## 8. Stage 6: Get to the ship (A and B)

Run the solo plan's section 8 with these differences.

1. **Check-in** (`H27`): **Expect:** the party check-in lists **two** guests; "{done} of {total} guests have finished their own steps." and "Still to finish: {names}."
2. **Each friend's steps:** complete A's, then B's. If B cannot sign in to the booking (6.6), A completes B's steps. Record whether the app **allows** that and what it says.
3. **Health declaration:** answer "no symptoms" for both, then "yes" for B on another run. **Expect:** a clear explanation of what happens next.
4. **Boarding Pass** (`H31`): **Expect:** **two** passes, each with its own name. Both work offline.
5. **Luggage Tags**, **Medallion**: one per guest.
6. **Arrival time:** one slot for both. Record whether B can see it.
7. **Travel tab:** **I'm Delayed** from A for 30 minutes. **Expect:** it applies to the booking. Check whether B gets a notification.
8. **If friends travel to the port separately:** record whether the app supports two arrival plans.
9. **Online check-in closes** at 10:00 on sailing day for both.

---

## 9. Stage 7: Embark (A and B)

Run the solo plan's section 9 with these differences.

1. **Trigger:** both routes (at the terminal; boarding begins).
2. **Muster Drill** (`S25`): **Expect:** both names are on the drill; confirm each.
3. **Embarkation Companion**, **Meeting-Point Card**: record the card for two.
4. **Cabin Requests** (`S21`) and **My Stateroom** (`S22`): check the **bed setup** from 5.2. Ask for **two single beds**. **Expect:** the request is recorded against the cabin. Record whether the app shows the current setup.
5. **Do Not Disturb** (`S36`): set it. **Expect:** it applies to the **cabin** and nothing in the wording suggests it is only for one friend.
6. **Wi-Fi** (`S23`): The package is "Wi-Fi, one device", so you bought one each. Connect both friends' devices, then try a third device. **Record what happens.**
7. **Find My Family** (`S40`): **Expect:** an empty or "no family on this booking" state. Record the wording. It must not suggest tracking an adult friend.
8. **Chat:** open **Party Chat and Guest Services** (`C01`). If B is a member of the booking (Route 2), start a chat and send a message each way. Record delivery, read state and the notification.
9. **Plan** tab: re-open your reservations and tickets. **Expect:** all intact and showing two guests.

---

## 10. Stage 8: Sea: the party days (A and B)

Run the solo plan's section 10, then fill each sea day.

### 10.1 A full day (repeat for each sea day)
1. **Trigger:** jump to 08:00 ship time on a sea day.
2. **Morning and Evening Briefing** (`H22`): **Expect:** the day's schedule matching the bar.
3. **Build My Day** (`P34`): **Expect:** your booked items plus suggestions. Check late-evening items.
4. **Ship News** (`S04`) and **Entertainment today** (`X08`): change the testing day and confirm the programme changes with the day.
5. **Games** (`S43`): play one together if the screen allows.
6. **Steps and Deck Laps** (`S06`): one friend walks laps, the other loungers. Check **Loungers** (`S07`): hold a lounger. Let the hold run overdue. **Expect:** it is released and says so.
7. **Spa, Salon and Fitness** (`S18`): book one treatment for each.
8. **Shops and Specials** (`S17`).
9. **Photos** (`S48`): take or upload a photo; share with B if it can.

### 10.2 Eat everywhere
1. **Order Food and Drinks** (`S15`): order a late-night snack to the room. **Expect:** a delivery estimate and the charge on My Bill.
2. **Walk-in queue.** Open the walk-in list for a popular venue and join the queue. **Expect:** "a place in the queue"; joining twice is refused as a duplicate.
3. **Dining Favourites and Table** (`S19`): set **share a table** and **table for two** on different nights. Reload to confirm they persist.
4. **Allergy Confidence** (`S33`): B's vegetarian preference is shown at dining where relevant.
5. **Specialty dinner:** confirm the pass use is recorded after the booking day. **Expect:** the pass shows one of three used (per person).
6. **Bar Menu and Drinks Tracker** (`S16`): add drinks for each friend. **Expect:** the tracker counts each person separately and respects the "up to $15 a drink" package limit; add a $18 drink. **Expect:** the extra above $15 is charged.
7. **Waitlist offer:** jump the clock so your waitlist entry is offered a table. **Expect:** "A table is available. Take it by {time}." Take it once, let another lapse. Record both outcomes.

### 10.3 The cabin party (`S44`)
1. Open **Services and Meet-Ups**. **Expect:** services and meet-ups, then **Cabin parties**: "Invite up to 6 cabins to a gathering in your cabin. Parties stop at 23:00 for quiet hours."
2. Create a party: name `Rivera and Blake's sunset party`, day 3, time `19:00`, and **three cabin numbers** (real cabin numbers from the booking data, or ones the screen accepts).
3. Try **seven cabins**. **Expect:** refused (the limit is six).
4. Try a start time of **23:30**, then **06:00**. **Expect:** refused as a quiet-hours time.
5. Try to invite a cabin that does not exist and your own cabin. **Expect:** a clear error each time.
6. **Answers:** where the app lets you simulate answers, record each as **Coming**, **Maybe** or **Can't come**. **Expect:** the badges show.
7. **Cancel** the party. **Expect:** it disappears.
8. Create a second party for **day 5** and leave it. It should appear on both friends' views if both can see the cabin's parties. Record whether B sees it.
9. **Noise and quiet hours:** read the quiet-hours wording on the party screen and in the cabin's Do Not Disturb. They should agree.

### 10.4 Meeting other people (needs Route 3 or Route 2)
1. **People** (chat): find another guest by name on the sailing (use a third account on the same sailing). Send a request. **Expect:** "Request sent to {name}."
2. Accept it on the other side. **Expect:** "You and {name} can now chat."
3. Create a **group** of three. Rename it with a blocked word. **Expect:** refused.
4. **Hide me** (turn "Let others find me by name" off). **Expect:** "Every chat you have will end, waiting requests will be withdrawn…" with a confirmation step. Cancel the hide.
5. **Block and report** another guest.
6. **Meet-ups** (`S44`): sign up for one.

### 10.5 Safety for adults out late
1. **Solo Safety Timer** (`S45`) and **I'm OK Check** (`S46`): one friend sets a timer for "the nightclub" for 2 hours while the other stays in the cabin. **Expect:** the due and overdue states as in the solo plan; no claim that anyone is alerted.
2. **Emergency Card** (`S26`): **Expect:** both names and the muster station.
3. **Medical Help Now** (`S27`): reachable in one tap, offline.
4. **Report a Security Concern** (`S29`): open and read.
5. **Doing two things at once:** the friends split up at 22:00; record which screens help you find each other. (Find My Family is for family; note what a friend can use.)

### 10.6 Money on a shared account
1. **My Bill** (`M10`): **Expect:** each charge is listed with the **person** column ("Person", "Who"). Check A's and B's purchases are attributed correctly.
2. **Top Up, PIN and Gratuities** (`M12`): the PIN belongs to the cabin. Record whether each friend has their own medallion and PIN.
3. **Everything Paid and Charged** (`M11`): both friends' purchases appear.
4. **Gratuities:** charged per person per night unless a package covers them. **Expect:** two people's worth.

### 10.7 Under-21 variant (the run where B is 20)
1. **Order** an alcoholic drink for B. **Expect:** refused. Order a soft drink. **Expect:** allowed.
2. **Bar Menu and Drinks Tracker:** B's tracker excludes alcohol.
3. **Jump to B's 21st birthday** during the cruise. **Expect:** record whether alcohol and the drinks package become available that day.

---

## 11. Stage 9: Port: every port, every minute (A and B)

Run the solo plan's section 11 with these differences.

1. **Trigger:** jump to each port day in turn. Repeat steps 2 to 7 for **each** port.
2. **Port Day** (`S37`): **Expect:** the all-aboard time and a countdown.
3. **Excursion day:** both friends go on the booked excursion. **Expect:** the meeting point and time.
4. **Split day:** one friend does an excursion, the other goes independent. Check both friends' plans show **separate** items.
5. **Independent plan:** use **Port Know-How** and **Port Snapshot** to plan a free day; add a **return time before all-aboard**.
6. **Safe Ashore for You** (`S32`): read it as two adults out late.
7. **Late return:** **I'm Delayed** (`H25`) for one friend. **Expect:** wording that does not promise the ship will wait.
8. **After-all-aboard events:** look for events marked "after all aboard". **Expect:** they appear only on port days where applicable.
9. **Weather** (`P31`) and **Storm Watch** (`P32`): check a bad-weather day. **Expect:** an alternative suggested.
10. **Dining ashore:** check the dinner you booked on port nights is at a time that works with the all-aboard time.

---

## 12. Stages 10 and 11: Disembark and Remember

Run the solo plan's sections 12 and 13 with these differences.

### Disembark
1. **Bag Night**, **Getting Off the Ship** (`H39`): one exit slot for both. Record whether each friend can pick their own.
2. **Customs** (`H43`): **Expect:** one declaration per person or one per cabin. Record which.
3. **Plan Around My Flight** (`H44`): enter **two different flights** (the friends fly home separately). **Expect:** a latest exit time that suits the earlier flight, or two separate plans. Record which.
4. **Share a Ride** (`H46`): share a ride with each other. **Expect:** it works for two people on one booking.
5. **Final Bill and Receipts** (`M13`): **Expect:** one bill for the cabin.
6. **Split the final bill.** Use **Split Costs** (`P15`) and **Pay Your Share** (`P16`): add every charge, mark each person's share, and check the arithmetic. **Expect:** the totals equal the bill.

### Remember
1. **Trip Memories**, **Trip Diary**, **Wrapped** (`M18`): add an entry. **Expect:** private to the account that wrote it.
2. **Photos:** keep the photos.
3. **Rate Your Cruise** (`M19`): rate as A. Record whether B can rate separately.
4. **Chat keep:** if you had a chat, **keep** it. **Expect:** it is held only if **everyone** in it agrees; messages otherwise delete 30 days after the cruise.
5. **Book Your Next Cruise** (`M22`): start a booking with the same two guests. **Expect:** details prefilled where the screen offers.

---

## 13. Whole-trip checks

### 13.1 Two accounts, one trip
- [ ] A and B are in the stage you expect at each step (record any mismatch).
- [ ] A change by A (cancel a dinner) reaches B's view if B is a member.
- [ ] B cannot see A's money, payment methods or documents.
- [ ] A **signs out everywhere**; B's session is unaffected.

### 13.2 Everything you booked is on the bill and the plan
- [ ] Every excursion, show ticket, dinner and package appears in **My Reservations** and on the right day in **Build My Day**.
- [ ] Every charge appears in **My Bill** with the right person.

### 13.3 Cancelling one friend
1. Cancel B's place on a throwaway booking before the final payment date.
2. **Record** whether the price is recalculated for one guest in the room (a solo supplement may apply; the rules for this are not confirmed), whether it is shown before you confirm, and the refund per the terms.
3. Record what happens to B's excursions, dinners and tickets.

### 13.4 Privacy and deletion
- [ ] **Privacy export** (`M25`) for A: record what it holds about B.
- [ ] **Delete B's account**: record what remains on A's booking.

### 13.5 Offline
Open both boarding passes, the day plan, tickets and the Emergency Card offline.

---

## 14. Defect log

| # | Stage / step | Who (A, B) | Route (1, 2, 3) | What I did | What happened | Expected | Severity |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## 15. Open questions to settle by running it

1. **Can B ever see A's direct booking?** (6.6, 8.2.) If not, two friends cannot both use the app for one room, and the product needs a way to add a co-traveller as an account.
2. **Does "Invite a co-traveller" do anything beyond saving an address?** The screen says no email is sent.
3. **Which seeded agent booking has two adult guests**, to use for Route 2?
4. **Does the app reconcile two different bedding choices?** (5.2.)
5. **Can the booker buy a drinks package for one friend only?** "A drinks package for every adult" suggests not. (7.11.)
6. **Do the fare-split lists live only on one device?** The screens say so. (5.4.)
7. **Does each friend get their own medallion, PIN and attributed charges?** (10.6.)
8. **Cabin parties:** do they notify the other cabins, or only record the invitation? Where is the answer entered? (10.3.)
9. **Do two friends get separate arrival, exit and flight plans?** (8.8, 12.3.)
10. **What happens to B's reservations when B is cancelled?** (13.3.)

## 16. Caveats

- Sample data and simulated services apply as in the solo plan's section 16. Dining venues, shows and events are authored sample content.
- Not covered: three or more friends, friends across two cabins on one booking (apart from Route 3), a couple sharing a room (the same as this plan, plus a "romantic" occasion), and groups hosting a large event.
- Quiet hours are **23:00 to 08:00** in the code. If they change, update 10.3.
