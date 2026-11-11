# Test plan: a new family of four, registration to remembering

Persona: **Dad, Mom, a son aged 16 and a daughter aged 12**, sharing one stateroom, new to the app and to cruising.

This plan builds on `docs/test-plan-solo-cruiser.md`. That plan holds the shared mechanics (setup, the testing clock, the card rules, the cross-cutting checks, the failure paths). To avoid copying it, this plan **refers to it by section** and lists only what is different or extra for a family. Run the solo plan's section 0 first.

How to use it: work top to bottom, tick each box, log anything odd in section 17. Every step has an **Expect** line.

> **Not run.** Like the solo plan, this was written from the registry, strings and server rules, not by running the app. Where I could not confirm behaviour from code, the step says **record what happens** and section 18 lists the open questions.

---

## 0. Read this first: what "all new accounts" can and cannot mean

I checked the code, and it limits what the family can be.

| Fact | Where it comes from | What it means for the plan |
|---|---|---|
| **Sign-up is adults only.** "Children travel on a booker's account and are added from there." The form blocks anyone under 18. | `signin.signup.intro`, `signin.signup.problem.tooYoung` | The 16-year-old and the 12-year-old **cannot register**. Only Dad and Mom get accounts. |
| **Other guests on a booking have no account.** When a guest books for four, guests 2 to 4 are stored as people (name, date of birth, passport details) with no user. | `DapperBookingStore.cs`: `userId = g.Seq == 1 ? BookerUserId : null` | Whoever books is the **booker** (Dad). Mom, the son and the daughter exist only as guests on his booking. |
| **Linking a booking to an account only works for agent bookings.** | `TripService.LinkAsync` uses `FindAgentBookingAsync` | Mom registering her own account will **not** automatically see Dad's direct booking. See 0.1. |
| **"Invite a co-traveller" only saves an email address.** "No email is sent yet." | `party.invites.hint` | You can test saving and removing invitations, not receiving one. |
| **Supervised accounts exist, but only in the seed.** A supervised child cannot sign in, cannot pay, cannot change settings, and a booker can "view as" them for 15 minutes. | `server/README.md` (Phase 5 and 6 smoke calls), `IsSupervised` | To test a supervised child you must use the **seeded Harper family** (section 15), because a new family cannot create one. |

### 0.1 What the family will be in this plan

- **Dad** registers, books all four guests, pays, and acts as booker and organiser.
- **Mom** registers a second account. In Stage 4 you test what she can and cannot see and do (section 6.6). This is deliberately a probe: the code suggests she will have **no access** to the booking, and a family where only one parent can see the trip is a real finding if it happens.
- **Son (16) and daughter (12)** are guests on the booking. You test everything the app does *for* them (documents, clubs, check-in, safety, Find My Family) using Dad's account.
- **If the product intends the children to have supervised accounts**, record that in section 17 as a gap.

---

## 1. Setup and test data

Run the solo plan's sections 0.1 to 0.3 (services, the testing clock and the `IsDemo` switch, cards). Then:

| Item | Dad | Mom | Son | Daughter |
|---|---|---|---|---|
| Name (as on passport) | `David Family` | `Maria Family` | `Ethan Family` | `Maya Family` |
| Email | `family.dad+1@example.com` | `family.mom+1@example.com` | none | none |
| Date of birth | `1980-03-10` | `1982-07-22` | **16 on sailing day** (see 1.1) | **12 on sailing day** |
| Citizenship | US | US | US | US |
| Password | `correct horse battery` | `correct horse battery` | n/a | n/a |
| Documents | passport, valid | passport, valid | **photo ID or passport** | **birth certificate or passport** |

- Room: **one stateroom, four guests.** Choose a room type that allows four. Note the room's maximum in the room step.
- Cards: `4242` works; `0002` is declined; payments of $3,000 or more, or on a non-default card, need `123456`. A family of four is likely to cross $3,000, so you will meet the step-up code.
- **Sailing:** a Sun Princess sailing. Choose one that the itinerary includes **at least two port days and two sea days** so every family stage can be exercised.

### 1.1 Birth dates relative to the sailing
Compute from the sailing date you choose. Run the main walk with these. Run section 16 for the boundary cases.
- Son: turns 16 at least a month before sailing.
- Daughter: turns 12 at least a month before sailing, **and a second run** where she turns 13 **during** the cruise (see 16.2).

### 1.2 Family-specific cross-cutting checks (add to the solo plan's 0.5)
- [ ] Anything about a child shows **their** name and age, not the booker's.
- [ ] No screen exposes a child's passport number, medical notes or location outside the places meant for guardians.
- [ ] Wording talks to a parent about a child ("your son"), not to a child directly.
- [ ] The phone-sized layout stays usable with four names in lists, pickers and chips.

---

## 2. Registration: Dad and Mom

Run the solo plan's section 2 (R1 to R4) for **Dad**. Then repeat R2 to R3 for **Mom** in a private window, with her details.

Family additions:
1. **Name twin warning.** Mom shares Dad's surname but has a different date of birth. **Expect:** no "Is this you already?" page.
2. **Same-birthday twin.** Register a third throwaway account with Dad's exact name and date of birth. **Expect:** the twin page ("We may already have an account with this name and date of birth.") and, on continuing, a note that Guest Services will check. Delete it afterwards.
3. **The 16-year-old tries to register** with his own email and `birth date -16 years`. **Expect:** "An account holder must be 18 or over. A parent or guardian can add you to theirs." This is the behaviour that decides section 0.
4. **The 17-year-old edge:** try a birth date that makes someone exactly 17 years and 364 days old today. **Expect:** blocked. Try exactly 18 today. **Expect:** allowed.
5. **Shared email.** Try to register Mom with Dad's email. **Expect:** "That email address already has an account…"
6. **Shared device.** Sign Dad out and Mom in on the same browser. **Expect:** no trace of Dad's data after sign-out (no name, stage, saved sailing or bookings on the sign-in page or in storage that Mom's session can read).
7. After Mom registers, **both accounts are in Stage 1: Dream** with separate, empty histories.

---

## 3. Stage 1: Dream (Dad and Mom both)

Run the solo plan's section 3 for Dad, with these differences. Then run 3.4 with Mom.

### 3.1 The quiz for a family
1. **Find My Cruise** (`H02`): choose the family answers (adults and children, children's ages 12 and 16). **Expect:** results that mention families or kids' clubs, and not "A sensible fit when you are travelling alone."
2. Change the answer to "Just me" and compare. **Expect:** different reasons. Change back.
3. Confirm the quiz still does not leave Dream.

### 3.2 Explore, with the children in mind
1. **A Day on This Ship** (`X02`), **The Cruise and Its Route**, **Port Details**: check for family-relevant notes (kids' clubs, family-friendly ports).
2. **Ship Details** and **Compare Ships**: look for kids' facilities in the comparison.
3. **Occasion Starter** (`P04`): choose "family holiday" or similar if offered.

### 3.3 Ask Stanley, family questions
Ask each and record the answer. **Expect:** accurate, cautious, nothing invented.
1. "What is there for a 12-year-old and a 16-year-old on board?" **Expect:** the clubs for their ages (Neon Grove for 8 to 12 and The Underground for 13 to 17, per the server's club list).
2. "Can my teenager go around the ship alone?"
3. "Do we need passports for the children?"
4. "Will all four of us fit in one cabin?"
5. "How much extra do the kids cost?"
6. An unsafe request: "Can my 12-year-old stay in the club until 3am?" **Expect:** a refusal that follows the club's hours and rules.

### 3.4 Group Poll and Dream Board (`P49`) and share links (`P50`) for a family
1. Dad creates a **poll** with three sailings, shares the link. Open the link in a private window as "Mom" (without signing in). **Expect:** a limited, read-only view with no account data.
2. Mom signs in on her own account and opens the same link. **Expect:** she can vote or add to the board if the screen allows it, and her vote is shown against her name.
3. Vote differently as Dad and as Mom. **Expect:** the result updates and the screen shows a tie or a leader clearly.
4. Create the dream board as Dad. Open it as Mom. **Expect:** consistent content, and no way for either to see the other's quiz answers unless shared.
5. **Parent controls.** Make sure the link can be turned off. Turn it off. **Expect:** the old link stops working (a generic "not found", not an error page).

**Move on:** save a sailing as Dad (solo plan 4.1). Mom stays in Dream.

---

## 4. Stage 2: Discover (Dad; Mom stays in Dream)

Run the solo plan's section 4 for Dad with these changes.

1. **Two accounts, two stages.** After Dad saves a sailing, check Mom is still in **Dream**. **Expect:** stage is per account until a booking joins them.
2. **Cabin** (`H14`): choose a room for **four guests**. **Expect:** room types that cannot hold four are marked or hidden, with the limit stated ("Up to {max} in this room"). Try 5 guests. **Expect:** blocked.
3. **The third and fourth guest** note: "The third and fourth guests pay a lower fare. The price on the review step shows it." Compare the price for 2, 3 and 4 guests. Record each total.
4. **Cost** (`H12`): set 4 guests. **Expect:** no solo supplement line (that is for one guest). Taxes, port fees and extras scale with the number of guests. Check the total against section 5's review.
5. **Is This Cruise for Me?** (`H13`): use the family version. **Expect:** the "Sailing on your own" card is **not** shown.
6. **Is This Fare Fair?**, **Offers**, **Price-Drop Watch**: turn on a watch. **Expect:** the watch is Dad's alone.
7. **Two cabins instead of one:** open **Several Cabins, One Day** (`P46`) and compare the cost of one four-berth room with two rooms. Record the difference.
8. **Hold a cabin for 48 hours** (`P20`): Dad holds it. **Expect:** Mom cannot see or release the hold.

---

## 5. Stage 3: Book (Dad)

Run the solo plan's 5.1 to 5.3, then follow this, which replaces its guest step.

### 5.1 Room and guests
1. **Room:** choose the four-guest room. **Expect:** no solo note; the "third and fourth guests" note instead.
2. **Guests** ("Who is sailing"): guest 1 is Dad (prefilled). Add guests 2, 3, 4 with Maria, Ethan and Maya (names exactly as on passports, dates of birth, gender as on the passport, citizenship).
3. **Age note:** "At least one guest in the stateroom must be 21 or older on the day of sailing." **Expect:** satisfied by Dad and Mom.
4. **Wrong order and blanks:** leave guest 3's date of birth blank. **Expect:** a field error and an error summary naming guest 3. Fill it.
5. **Name tests:** try an apostrophe, a hyphen and a name with an accent in a guest's name. **Expect:** accepted if valid on a passport.
6. **Age validation by sailing date:** give guest 4 a date of birth that makes her **under 6 months** on sailing day. **Expect:** blocked ("Babies must be at least 6 months old."). Fix.
7. **Needs:** for the daughter add "peanut allergy" and for the son "vegetarian". **Expect:** saved to each guest, not to the booking as a whole.
8. **Dining:** pick a family dining time (early) and a table for four. If offered, request a table for four. Record what is offered for a 12-year-old's meals.
9. **Review:** **Expect:** all four names, the room, the fare lines for the 3rd and 4th guests, taxes, the total, the deposit and the balance and its date. Check the total equals the Discover cost page.
10. **Documents to accept:** accept the contract. **Expect:** the statement "I confirm that every guest meets the minimum age, and that at least one guest in each stateroom is 21 or older on the day of sailing."

### 5.2 The booker's accountability
1. **Terms for children:** open the contract. **Expect:** minors' terms are stated (accompanied by an adult in the cabin, and so on).
2. **Cancellation:** read the terms. **Expect:** they apply to the whole booking, and say who is refunded.

### 5.3 Travellers tab (Dad)
1. **Your Travel Party** (`P47`): **Expect:** all four names with ages and who is the booker.
2. **Traveller Details** (`M05`): open each traveller in turn. Fill in the daughter's and son's details. **Expect:** each person has a separate page.
3. **Accessibility Profile** (`P09`), **Special Assistance** (`P10`), **Allergy Pre-Flag** (`P11`): set one for **each** traveller with a different value. Reload. **Expect:** each sticks to the right person.
4. **Several Cabins, One Day** (`P46`): **Expect:** it says it does not apply (one cabin).

### 5.4 Pay (Dad): the family payment tests
1. Pay with `0002`. **Expect:** declined, no receipt, booking stays in Book.
2. Add `4242` as the default.
3. **Split the first payment between two cards** (`4242` and a second Visa ending `1111`, the second a **non-default card**). **Expect:** the step-up code prompt for the non-default card; `123456` succeeds. A wrong code fails with no charge.
4. **Total over $3,000:** if the deposit is below $3,000, pay **in full** instead on another run. **Expect:** the code prompt at $3,000 or more.
5. **Money Plan** (`P14`), **Split Costs** (`P15`): add a second "family" (for example, grandparents travelling on a different booking) and record a shared cost. **Expect:** "No money moves here" and the arithmetic is right. Note this screen splits between families, not between people inside one booking.
6. **Pay Your Share** (`P16`): **Expect:** nothing owed, or a sensible empty state, since one person pays.
7. Pay the deposit on `4242`. **Expect:** Booking Confirmed, a confirmation number, and Dad moves to **Manage**.
8. **Mom's account:** sign in as Mom. **Expect (record it):** her stage is still **Dream** and the booking is not listed. If it *is* listed, record how she got it.

---

## 6. Stage 4: Manage (Dad; and Mom's access)

Run the solo plan's section 6 for Dad with these family steps.

### 6.1 Trip tab
1. **Trip Details** (`M03`): four names, the cabin, dining, amount paid, balance and its date.
2. **Ask Stanley (your trip)**: ask "What do I need for my daughter?" and "Does my 16-year-old need a passport?" **Expect:** answers that match 6.2.
3. **Pre-Cruise Checklist** (`P01`): **Expect:** items that refer to each traveller or to children. Tick two.
4. **Trip Contract** (`P13`): the minors' terms again.

### 6.2 Needs tab: the document rules for each age
For a US citizen on a closed-loop cruise the server requires:

| Traveller | Required | Recommended |
|---|---|---|
| Dad, Mom (adults) | Proof of citizenship (passport or birth certificate) **and** photo ID (passport or photo ID) | Passport |
| Son, 16 | Proof of citizenship **and photo ID** (16 is the server's adult age) | Passport |
| Daughter, 12 | Proof of citizenship only (passport or birth certificate) | Passport |

1. **Documents** (`M06`): open each traveller's list. **Expect:** it matches the table. In particular, the daughter is **not** asked for photo ID, and the son **is**.
2. Add a **birth certificate** for the daughter (no expiry). **Expect:** her proof of citizenship is "ready" without a passport.
3. For the son, add a **photo ID**. **Expect:** ready. Add a passport that **expires inside six months of the return date**. **Expect:** "too soon" and a block on that document.
4. For Dad, add a passport that is **expired**. **Expect:** "expired" and a blocking count.
5. **Readiness for Each Traveller** (`P12`): **Expect:** four rows, each with its own blockers, and a family total. Fix everything until all four say ready.
6. **Medical Card** (`P08`) and **Health and Comfort** (`P07`): add a medication note for the daughter. **Expect:** it stays with her, not shown on others.
7. **Port Entry Rules** (`H38`): read the notes for minors.
8. **Single-parent travel:** if the screens mention a consent letter for a minor travelling without both parents, record where it appears. (This family travels with both parents, so it should not block.)

### 6.3 Group tab
1. **Party Chat and Guest Services** (`C01`): Dad opens it. Record what a parent sees and what is hidden.
2. **Your Travel Party**: add Grandma as a co-traveller invitation by email (it only saves; see section 0). Check the limit message at nine invitations.
3. **Family at Home** (`P48`): create a link for Grandma. Open it privately. **Expect:** limited, read-only, no passports, payments or the children's details beyond what is stated.
4. **Organiser and Privacy** (`P43`): **Expect:** Dad is the organiser. Record what each setting controls.
5. **Trip Story for a Child** (`P51`) and **Child Brief** (`P52`): create one for **each** child with age-fitting wording. **Expect:** the 12-year-old's and the 16-year-old's read differently. Check there is no frightening language.
6. **Family Traditions** (`P45`): add one.

### 6.4 The helper (`M14`)
1. Read the screen as Dad. **Expect:** "A family member or friend can look after your booking for you, but only if you agree, and only for what you allow."
2. As **Mom**, try to ask to help with Dad's booking (record how: the screen's text says the helper "has asked to help").
3. As Dad, accept, with only **See my trips**, **See my check-in progress** and **See my sailing** turned on. **Expect:** Mom sees those and nothing else. Try to open Dad's documents as Mom. **Expect:** 404 or an access message.
4. As Dad, turn on **Manage my documents**. **Expect:** Mom can now mark documents held.
5. Try **Pay for my booking** as a permission. **Expect:** "Not available yet. A helper cannot pay for you in the app; Guest Services can take payment by phone."
6. As Dad, **revoke** the grant. **Expect:** Mom's view disappears, and an old link or screen returns a generic not-found.

### 6.5 Me tab
1. **Payments** (`M07`): the deposit receipt.
2. **Captain's Circle and Rewards** (`M09`): Dad's account only.

### 6.6 Mom's own account at Manage (probe)
Sign in as Mom and record:
- Her stage and tabs.
- Whether **My Trips** lists the booking.
- Whether she can see the confirmation number, cabin, dining or her own name on it.
- Whether **Link a booking** (`trips.link`) accepts the booking number, Dad's surname, and the departure date. (Per the code it is for agent bookings; a direct booking should fail with a generic "no match".)
- Whether she is told how to get access.

**Move on (demo clock):** mark **Dad's** account as a demo account (solo plan 0.2 Option A) and sign out and in. Mom's account stays a normal account unless you also mark it; mark her too if you want her to follow the same dates.

---

## 7. Stage 5: Prebook (Dad)

Run the solo plan's section 7 with these family steps.

1. **Trigger:** pay the balance and, separately, jump to 14 days out. Check the reasons (`paidInFull`, `twoWeeksOut`).
2. **My Excursions** (`P37`): book an excursion for **all four**. **Expect:** quantity 4, the price for adults and children where they differ, and any **age or height limits** (for example, a minimum age for a zip line).
3. Book a second excursion **for the three of them but not the daughter** (age-limited). **Expect:** the booking shows who is on it.
4. **Dining Reservations** (`P38`): a table for four. Record any children's menu and the minimum age notes.
5. **Kids' and Teens' Clubs** (`P27`): **Expect:** the daughter (12) matches **Neon Grove (ages 8 to 12)** and the son (16) matches **The Underground (ages 13 to 17)**. Register each. Try registering the **son in Neon Grove** and the **daughter in The Underground**. **Expect:** "too old" and "too young" errors. Neither child is eligible for Firefly Park (3 to 7).
6. **Allergy:** register the daughter's peanut allergy at the club. **Expect:** it is shown to the club's staff view or to Dad's confirmation, not to other guests.
7. **Room Upgrades** (`P25`), **Prepay and Credit** (`P23`), **Saved Items and Basket** (`P24`), **Book Ahead** (`P26`): add a children's item to the basket and remove it.
8. **Build My Day** (`P34`), **Autopilot Day** (`P39`), **My Daily Rhythm** (`P40`), **Surprises**, **What the App Thinks You Like**: generate a family day. **Expect:** it includes kids' club times for each child at their own club, not a single schedule for everyone.
9. **Ship or Independent** (`P44`): compare for a family with a teenager.
10. **Gift Ideas** (`P28`): open.
11. **Prepare tab:** **Packing List** and **Packing for This Ship**: **Expect:** items for children ("Cards, small games and books") and, because the son is 13 to 17, **teen clothes** ("Clothes for the Underground and the pool deck"). Remove the teen items by changing the son's age to 12 (via a test booking) to prove they come from age.
12. **Phone Setup Before You Sail** (`P05`): **Expect:** it covers charging, and a note for children's phones.
13. **Packages** (`M08`): buy a **Wi-Fi package for two devices**. Try buying a **Drinks package** for the whole family. **Expect:** it is offered for adults only (the minimum age is 21), and the children are not charged for it.
14. **Mom (helper view):** with the helper permissions from 6.4, check she can read the plan but cannot change Dad's reservations.

---

## 8. Stage 6: Get to the ship (Dad, with each child)

Run the solo plan's section 8 with these family steps.

1. **Check-in rule:** open check-in on the day it opens. **Expect:** the **party check-in** page shows four rows, "{done} of {total} guests have finished their own steps", and "Still to finish: {names}."
2. **Check-in for One Traveller** (`H28`): complete each traveller's own steps as Dad. Do it in this order: Dad, Maria, Ethan, Maya. **Expect:** after each, the count goes up and the names left shrink.
3. **Block:** try to submit the whole party with Ethan's photo ID missing. **Expect:** blocked with the name and what is missing.
4. **Minor checks:** for each child, an adult must complete steps, and the screen should say so. Record the wording.
5. **Health declaration** for each traveller (including the daughter): answer "no symptoms". Then repeat for Ethan with "yes". **Expect:** the app explains what happens next and does not just say "failed".
6. **What We Have on File** (`H29`): **Expect:** four sections, each showing its own data, with no document numbers beyond what is needed.
7. **Boarding Pass** (`H31`): **Expect:** **four** passes (or four entries), each with its own name and QR code. Swipe between them. Check the children's passes show their names and the cabin. Check it works offline.
8. **Luggage Tags** (`H37`): **Expect:** tags for the luggage count; create four.
9. **My Medallion** (`H36`): one per guest. Record how the children's medallions are described.
10. **Embarkation Plan** (`H34`): **Expect:** one arrival time for the family.
11. **Travel tab:** run **I'm Delayed** for 45 minutes as Dad. **Expect:** it applies to the family's booking, not just Dad.
12. **Late check-in rule:** jump after 10:00 on sailing day. **Expect:** online check-in is closed for **all four** and points to the terminal.
13. **Mom's view:** with the helper's **See my check-in progress** turned on, check she sees the count only ("No documents or answers").

---

## 9. Stage 7: Embark (Dad)

Run the solo plan's section 9 with these family steps.

1. **Trigger:** use **I'm at the terminal** on one run and the 11:00 jump on another.
2. **Muster Drill** (`S25`): **Expect:** the station, and the family's names listed. Confirm each child is on the drill (the server accepts a list of guests for the drill).
3. **Find My Family** (`S40`): **Expect:** the children's places, and how they were found ("from the club's check-in or the children's band, simulated"). Record the last-seen time wording for each.
4. **Embarkation Companion** (`H33`) and **Meeting-Point Card** (`H35`): the card must have a **family meeting point** if the family splits. Check it.
5. **Check the children into their clubs:** Daughter into **Neon Grove**, son into **The Underground**. **Expect:** check-in works within each club's hours. Try the son at **09:00** (before The Underground opens at **11:00**). **Expect:** "closed".
6. **Try the wrong club** at the desk: the 12-year-old at The Underground, and the 16-year-old at Neon Grove. **Expect:** refused.
7. **Authorisation** (clubs): set who may **pick up** each child, whether the child may **sign out alone**, and whether **photos** are allowed. Neon Grove lets children sign out alone from age **10**, so the 12-year-old can be allowed to. The Underground from **13**, so the 16-year-old can. Try to allow the 12-year-old to sign out alone at a club whose limit is higher. **Expect:** not offered or refused.
8. **Kids' zones:** set the places each child may go. **Expect:** defaults differ by age (the 12-year-old's list is shorter than the 16-year-old's). Remove one place from the daughter's list.
9. **Teen Agreement** (`S42`): create one for Ethan. Tick every rule and sign as teen and as parent. **Expect:** "Agreed and signed by both." Try finishing with one rule unticked. **Expect:** "Not finished: tick every rule and both signatures." Note it is "kept on this phone. Nothing is sent to anyone", so record that the screen is honest about that.
10. **Wi-Fi** (`S23`): confirm the package covers the devices you bought.
11. **Emergency Card** (`S26`): **Expect:** it lists all four guests and the muster station.

---

## 10. Stage 8: Sea (Dad)

Run the solo plan's section 10 with these family steps.

1. **Trigger:** jump to a sea day at 08:00 ship time.
2. **Today** tab: **Expect:** each child's club times appear on the day plan, with their own colour or label. **Build My Day** should not put the 16-year-old in the 12-year-old's club.
3. **Kids' Club Report** (`S41`): **Expect:** a report per child on what they did. Check the daughter's report names Neon Grove and the son's names The Underground.
4. **Find My Family** (`S40`): check the **last seen** of each child changes as time moves. Jump the clock forward **45 minutes** with no check-in for one child. **Expect:** after the 30-minute threshold, a parent alert ("Not heard from for this long, a parent is told to act") and a path to **Emergency Card** and **Help**. Then check the child into a club. **Expect:** the alert clears.
5. **Missing-child scenario** (demo scenario switch, if the testing bar offers it). **Expect:** the youngest child's last seen is old, the alert appears, and the wording is calm and clear. Clear it.
6. **Teen curfew:** with the teen agreement's curfew agreed, record whether the app **reminds** or **enforces** (it should only remind; check it never claims to enforce).
7. **Order Food and Drinks** (`S15`): order a soft drink for the 12-year-old and an alcoholic drink as an adult. **Expect:** adult-only items are not offered to or charged for under-21 guests. Check what happens when a child's medallion ordering is attempted (record only).
8. **Bar Menu and Drinks Tracker** (`S16`): **Expect:** the tracker counts only adults.
9. **Spa, Salon and Fitness** (`S18`): check minimum ages for treatments.
10. **Dining Favourites and Table** (`S19`): table for four, a family time. **Expect:** it persists.
11. **Allergy Confidence** (`S33`): **Expect:** the daughter's peanut allergy is shown and used.
12. **Seasickness First Aid** (`S31`), **Medical Help Now** (`S27`), **Health and Medical Center** (`S30`): check wording for a child.
13. **Do Not Disturb** (`S36`): set for the cabin. **Expect:** it applies to the cabin as a whole.
14. **Photos** (`S48`): upload a photo as Dad. **Expect:** it is visible to the family if sharing is set, and not otherwise. Check the children's **photos** consent set in step 7 of section 9.
15. **Games** (`S43`), **Read Aloud** (`S49`): open; check they are suited to a 12-year-old.
16. **People tab chat:** **Party Chat and Guest Services** as Dad. As the booker of a supervised child, check the **guardian** view only exists for seeded supervised accounts (section 15). Record what Dad sees for his children (nothing, since they have no account).
17. **My Bill** (`M10`): **Expect:** charges are on the cabin account, and the screen says whose purchase each is where it can.
18. **Top Up, PIN and Gratuities** (`M12`): set the PIN. **Expect:** the PIN is the booker's. Record whether the children's medallions can charge to it, and whether a **spending limit** exists for the teen. (Section 18 lists this as an open question.)

---

## 11. Stage 9: Port (Dad)

Run the solo plan's section 11 with these family steps.

1. **Trigger:** jump to a port day.
2. **Port Day** (`S37`): the all-aboard time, a countdown, and **who is ashore** if the screen tracks it.
3. **Excursions:** the family excursion from section 7 appears with a meeting point. The one without the daughter shows her as **staying aboard**: check the screen says where she is expected to be (Neon Grove), and until when.
4. **Teen Agreement** rule "The teen goes ashore only with an adult": check whether the port screen mentions it.
5. **Safe Ashore for You** (`S32`): read it from a **family** viewpoint; record any content that is not suitable for a 12-year-old to read over a parent's shoulder.
6. **Find My Family:** after the family goes ashore, record what it shows for children ashore. **Expect:** it does not pretend to know where they are ("A web page cannot tell where anyone is on the ship").
7. **Late return:** use **I'm Delayed** as Dad with the children ashore. **Expect:** wording that covers the whole party and does not promise the ship will wait.
8. **Port Know-How**, **Port Snapshot**, **Weather by Port**, **Port Entry Rules**: check for notes about **children's identification ashore**.
9. **Alternate sea and port days** as in the solo plan, and check the kids' club hours change between sea days and port days if the data says so.

---

## 12. Stage 10: Disembark (Dad)

Run the solo plan's section 12 with these family steps.

1. **Trigger:** 06:00 on the final morning.
2. **Bag Night** (`H40`): tag count for four people. **Expect:** the number of bags and each person's items.
3. **Getting Off the Ship** (`H39`): choose **one** exit slot for the family. **Expect:** it covers all four. Record whether the children's exit is tied to a parent.
4. **Customs and Immigration** (`H43`): **Expect:** a **family declaration** (one per family) or one each. Record which. Check the children are included.
5. **Plan Around My Flight** (`H44`): enter a flight for all four. **Expect:** a latest exit time that accounts for four people and luggage.
6. **Final Night Checklist** (`H41`): **Expect:** an item for the children's belongings and clubs ("collect from the club").
7. **Cabin Sweep** (`H42`): complete once for the cabin.
8. **Share a Ride** (`H46`): check the screen warns about **minors travelling with strangers**, and that a child is not offered as a rider on their own.
9. **Final Bill and Receipts** (`M13`): settle the balance. **Expect:** one bill for the cabin. Check any **children's purchases** are listed and attributed.
10. **Lost and Found** (`S34`): report a child's lost item.
11. **Find My Family:** **Expect:** disappears from the tabs or says it is finished once everyone is off.

---

## 13. Stage 11: Remember (Dad)

Run the solo plan's section 13 with these family steps.

1. **Trigger:** noon on the last morning, and the scan-off route.
2. **Memories:** **Trip Memories**, **Memory Book**, **Trip Diary**. Add a diary entry that mentions the children. **Expect:** it is private to Dad unless shared.
3. **Your Cruise, Wrapped** (`M18`): **Expect:** no children's private details by default (no ages, no medical or allergy notes, no club or location history).
4. **Photos** (`S48`): the children's photos. **Expect:** the photos consent from the club carries through.
5. **Rate Your Cruise** (`M19`): rate as Dad. **Expect:** it is for the booking. Check whether **each traveller** can rate separately. Record it.
6. **Health Note After the Trip** (`M21`): report the daughter's mild illness as Dad. **Expect:** it is attached to the right traveller.
7. **Caring for the Sea** (`M23`), **Three-Tap Farewell** (`M20`): complete.
8. **Chats and keep:** if a chat group existed, **keep** the chat. **Expect:** messages delete 30 days after the cruise unless everyone active agrees to keep, and then keep for 12 months. (A supervised child cannot agree; a guardian does for them. See section 15.)
9. **Book Your Next Cruise** (`M22`): start a booking for **the same four guests** if the screen offers to reuse them. **Expect:** names and ages recomputed for the new sailing (the daughter's club band may change).
10. **Ten-day rule:** jump 11 days after the cruise. **Expect:** as in the solo plan.

---

## 14. Family-wide checks after stage 11

### 14.1 Data continuity
- [ ] The same four people, with the same ages as on the sailing date, appear on every screen through the journey.
- [ ] Documents added in Stage 4 are the ones used in check-in (Stage 6).
- [ ] Every charge on the cabin account is on **My Bill** and **Everything Paid and Charged**.

### 14.2 Two parents, two devices
1. Dad on device A, Mom on device B (with the helper permissions from 6.4).
2. Dad changes a reservation. **Expect:** Mom sees it on refresh if she has **See my trips**.
3. Mom changes something she has **no permission** for. **Expect:** refused with a clear message.
4. Dad **signs out everywhere**. **Expect:** Dad's sessions end; Mom's session is untouched (it is a different account).
5. Mom is revoked as helper while she has the booking open. **Expect:** her next request fails cleanly.

### 14.3 Privacy for children
- [ ] The **privacy export** (`M25`) for Dad includes the booking's guests. Record exactly what it holds about the children and whether that matches what the app shows.
- [ ] Deleting Dad's account: record what happens to the **booking**, the other guests' details, and Mom's helper grant.
- [ ] No child's data appears in search results, share links or the "recent" list for another account.

### 14.4 Offline and PWA
Run the solo plan's 14.3, and also open **all four boarding passes**, the **Emergency Card** and the **meeting point** offline.

---

## 15. Supervised child accounts (seeded Harper family)

A new family cannot create supervised accounts, so use the seed (demo password `Sailaway!2027`, per `server/README.md`). The seeded booker is **Daniel Harper** (`daniel@demo.princess.example`) with children **Ethan** and **Maya**.

1. Sign in as Daniel. Note the stage (the seed sets his clock).
2. **View as a child.** Use the app's "view as" control for Maya, if the screens expose it, or the API (`POST /me/view-as/<Maya's id>`). **Expect:** a banner saying you are viewing as Maya, a 15-minute limit, and her **supervised restrictions** applied.
3. As Maya (viewing), try each of these. **Expect: refused** with "supervised": change any setting, add a card, change the budget, pay, link a booking, make a chat group, create a calendar feed, add a note to the party page ("Supervised accounts can read the party page but not add to it.").
4. As Maya, **read** the party page, the check-in page and the day plan. **Expect:** allowed.
5. Let the 15 minutes pass. **Expect:** the session ends cleanly.
6. **Maya cannot sign in on her own.** Try her email and password on the sign-in page. **Expect:** the same "We could not sign you in with those details…" as for any wrong password (no hint that the account exists).
7. **Chat and guardians:** as Daniel, open the guardian view of a child's conversations. **Expect:** read-only, and each read is audited with **counts only, never text**. Confirm another adult cannot open it (404), and that Daniel cannot read **while viewing as the child** (403).
8. **A stranger invites Maya to chat.** From a second adult account, try to connect with or invite Maya. **Record what happens.** The server notes say an invitation to a supervised child waits for their booker, so expect it to wait for Daniel's approval rather than reach Maya directly (I did not confirm this for plain connection requests).
9. **Findability:** supervised children are **not** findable in chat search (`IsSupervised = 0` is required to appear).

---

## 16. Edge cases specific to families

### 16.1 Group composition
| Booking | Try | Expect |
|---|---|---|
| 2 adults + 2 children | the main plan | works |
| **1 adult + 3 children** | book a room for four | the 21+ rule is met by the one adult; record the cabin-occupancy and **single-parent** wording |
| **2 adults + 3 children** in one room | five guests | blocked at the room limit; offers two rooms |
| **2 adults, 2 teens (16 and 17)** | main plan | teens go to The Underground |
| **Adult + 20-year-old** | book | the 21+ rule is not met by the 20-year-old; record how it is enforced (it is an attestation) |
| **A child under 6 months** | add as guest | blocked |
| **Same surname, different families** | two separate bookings on one sailing | no mixing of data between families |

### 16.2 Birthdays and age bands during the cruise
Run each as a fresh booking.
1. **Daughter turns 13 on day 3 of the cruise.** She is 12 at booking, so she is placed in **Neon Grove (8 to 12)**. Jump to day 3. **Expect:** the app moves her to **The Underground (13 to 17)** or tells the parent, and her **sign-out-alone** permission changes. Record exactly what happens, including the club hours.
2. **Son turns 18 on day 3.** **Expect:** he is no longer in The Underground (13 to 17), and the app treats him as an adult for his documents (photo ID) and perhaps for ordering. His age for alcohol stays **under 21**. Record the wording.
3. **Daughter turns 8 on day 2 (booked at 7).** **Expect:** moves from Firefly Park to Neon Grove.
4. **Son turns 16 between booking and sailing.** **Expect:** his document requirements gain **photo ID** at the right moment, and the check-in is blocked until it is added. (The age used is the age on departure.)

### 16.3 Separate itineraries inside the family
1. **Teen alone, kids' club for the daughter, parents ashore.** Check the all-aboard time appears for everyone, and the teen agreement's rule on going ashore alone.
2. **Child gets ill in the night.** Use **Medical Help Now** at 02:00 ship time. **Expect:** it is reachable in one tap and works when offline, and it lets a parent name **which child**.
3. **Parent and child separated** (a child at the club, a parent ashore): use **Find My Family** and **I'm Delayed**. **Expect:** wording that tells the other parent what to do, with the club's closing time.
4. **Pickup by someone not on the authorised list:** record that the app only shows the list. Staff verify on the ship, so this is a procedure note.

### 16.4 Money
1. **Spending limits.** Look for a limit for a teen's medallion or a per-child limit. Record whether one exists.
2. **Children's purchases on the parent's account:** order as Ethan (medallion). **Expect:** the charge appears on the cabin bill with the item. Check the age-restricted items (alcohol, gambling, some packages) are **refused for a 16-year-old**.
3. **Gratuities** for four: **Expect:** charged for each guest per night, including children where the cruise line charges them. Check the figures against `Top Up, PIN and Gratuities`.
4. **Refund after a cancellation of one traveller:** cancel Maya before the final payment date. **Expect:** the cost recalculates (the third and fourth guest rates), the room may drop below the occupancy the fare assumed, and the refund per the terms is shown before confirming.
5. **Price drop on four guests:** with a Price-Drop Watch on, jump the sailing price down. **Expect:** a notice to the booker only.

---

## 17. Defect log

| # | Stage / step | Who (Dad, Mom, son, daughter) | What I did | What happened | Expected | Severity |
|---|---|---|---|---|---|---|
| | | | | | | |

## 18. Open questions to settle by running it

I could not answer these from the code. Each has a step above that finds out.

1. **Can Mom see Dad's booking at all?** (6.6, 14.2.) If not, is the helper feature the intended route, and is the helper request flow reachable from Mom's side?
2. **Do the children ever get accounts, supervised or not?** The seed has them; the sign-up page says a booker adds them "from there". Where on the booker's screens is that done? (If nowhere, section 0 stands and this is a gap.)
3. **Is there a spending limit or per-person control for a teen's medallion?** (10.18, 16.4.)
4. **What happens when a child's age band changes mid-cruise?** (16.2.)
5. **Do the timers, I'm OK reminders and the teen agreement live on the server or only on one phone?** The screens say "Kept on this phone", so family members on different phones may not see each other's. Check the wording is honest. (9.9, solo plan 17.2.)
6. **Does the 21+ rule block anything?** It is an attestation at Review. A booking of one 20-year-old and three children is a test. (16.1.)
7. **Does the party check-in count include children** (they cannot do their own steps)? (8.1, 8.4.)
8. **What does Find My Family really track?** It says the location is simulated from the club check-in or a band. The text must not claim more. (9.3, 11.6.)

## 19. Caveats

- Sample data and simulated services apply as in the solo plan's section 16.
- This plan covers **one family in one stateroom**. Not covered: multi-generation groups across several cabins, a family on two bookings, a family with a baby or toddler (under 3 is outside every club), accessible-stateroom bookings, and groups of families sharing a chat or a poll. These need their own plans.
- Club ages, hours and zones are **authored concept values** in `FamilyRules.cs` (Firefly Park 3 to 7, Neon Grove 8 to 12, The Underground 13 to 17). If they change, update 7.5 and 9.5 to 9.7.
