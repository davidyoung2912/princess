# Test plan: a brand-new solo cruiser, registration to remembering

Persona: **one adult, no travel party, no children, no prior account.** The simplest full journey through all 11 stages.

How to use it: work top to bottom. Each step has an action and an **Expect** line. Tick the box when it passes and write down anything odd. Do not skip a stage's "Entry check", because it proves the stage engine moved you.

Per `CLAUDE.md`, this is a manual plan. Nothing here is run by automated browser tests.

---

## 0. Before you start

### 0.1 What you need running

1. SQL Server LocalDB with the schema and seeds from `db/README.md` applied.
2. The API: `cd server && dotnet run --project Princess.Api` (http://localhost:5182). The connection string and JWT signing key come from user-secrets.
3. The front end: `npm run dev`.
4. A desktop browser, plus a phone-sized window (or a real phone) for the responsive checks.
5. A fresh email address that has no account, for example `solo.tester+1@example.com`. In development no email is sent. **The one-time code is written to the API console log** (the sign-in screen says so).

### 0.2 The one thing you must know about the clock

The stage comes from the server. For a **real account it follows real time** (today is 2026-11-10, and the 2027 sailings are months away). The **testing bar and date jump only work for demo accounts** (`GET/POST /demo/*` answer 404 unless the user's `IsDemo` flag is set).

So a self-registered account will sit in stages 1 to 4 (Dream, Discover, Book, Manage) until you can move the clock. To test stages 5 to 11 you have two options:

- **Option A (recommended):** register normally, finish stage 4, then mark that one account as a demo account, so the testing bar appears.
  Run in SQL (replace the email): `UPDATE Users SET IsDemo = 1 WHERE Email = 'solo.tester+1@example.com';`
  Then sign out and in again so the app reloads its context. The testing bar (top left date, top right time) should now show.
- **Option B:** book a sailing that really departs within 14 days. Do this only if the seed has one. Check `GET /reference/sailings`. Otherwise use Option A.

> I have not run this plan. The `IsDemo` behaviour is read from `DemoService.cs` and `db/01-schema.sql`, not tested. If the bar does not appear after the update, note it as a finding.

### 0.3 Test data (use these exact values)

| Item | Value |
|---|---|
| First / last name | `Sam` / `Solo` (see 0.4: it must match the passport name) |
| Email | `solo.tester+1@example.com` |
| Date of birth | `1975-04-12` (an adult, no age rules triggered) |
| Password | `correct horse battery` (at least 10 characters) |
| Sailing | any sailing on the **Sun Princess** (the deepest data) with a room that offers solo pricing |
| Room type | an **inside** or **balcony** room, **1 guest** |
| Card to pay | Visa, last four `4242`, expiry `12/30` |
| Card that must fail | any card ending `0002` (declined) |
| Step-up code | `123456` (needed for any card payment of $3,000 or more, or a card that is not the default) |

### 0.4 Notes that affect every stage

- "Solo" shows up in four places. Look for each as you go: the quiz answer **Just me**, the **solo supplement** line in the cost, the **Sailing on your own** card on "Is This Cruise for Me?", and the **Solo Safety Timer** (`S45`) and **I'm OK Check** (`S46`) once aboard.
- Every screen has a coloured header with a unique title (h1) and a subtext. Check this on every screen you open.
- After each stage change, expect a one-time **"Welcome to your next stage"** page and, when new tabs appear, a one-line note on Home.
- The tab bar for each stage is in section 1. The page names (`H16`, `S45` and so on) are the screen IDs from `src/routes/screens.ts`, with the path in brackets.

### 0.5 Cross-cutting checks (do once per stage, takes two minutes)

- [ ] **Header:** title and subtext present and different from the previous screen.
- [ ] **Keyboard:** Tab reaches every control in a sensible order; focus lands on the page title after navigating.
- [ ] **Dialogs:** open one (for example the Help button); focus is trapped; Escape closes it; focus returns to the opener.
- [ ] **Phone width:** bottom tab bar shows Home, the stage tabs and Me. **Desktop width:** the same tabs sit in a side rail.
- [ ] **Colour:** each tab has its own colour (teal, pink, gold; Home blue; Me plum). The colour is never the only cue.
- [ ] **Reload:** refresh the browser on the current screen; you stay signed in and on the same screen.

---

## 1. Stage map (what you should see at each stage)

| # | Stage | Tabs between Home and Me | You get here when |
|---|---|---|---|
| 1 | Dream | Explore · Ask | account created, no sailing in mind |
| 2 | Discover | Sailing · Cabin · Cost | you save a sailing, look closer at one, or ask for its price or cabin view |
| 3 | Book | Booking · Travellers · Pay | you tap **Book this sailing** (a draft exists) |
| 4 | Manage | Trip · Needs · Group | deposit paid and booking confirmed |
| 5 | Prebook | Plan · Prepare · Group | paid in full, or 14 days before departure |
| 6 | Get to the ship | Board · Travel · Plan | check-in opens (3 days before) or you start check-in |
| 7 | Embark | Board · Ship · Plan | tap "I'm at the terminal", or boarding begins (11:00 on sailing day) |
| 8 | Sea | Today · Ship · People | after sailaway, on a sea day (from 08:00 ship time) |
| 9 | Port | Port · Ship · People | after sailaway, on a port day |
| 10 | Disembark | Leave · Ship · People | final morning 06:00 ship time |
| 11 | Remember | Memories · Next · Feedback | you scan off, or 12:00 on the last morning |

Rules to confirm along the way (from the engine):
- Looking (browsing, the quiz, a port page) must **not** leave Dream.
- Before confirmation the stage is reversible; after confirmation it only moves forward.
- Anything unclear resolves to the **earlier** stage, never a later one.

---

## 2. Registration

### R1. First visit
1. Open the app URL while signed out.
2. **Expect:** the **Sign in** page (h1 "Sign in") with fields Email and Password, a "Remember me on this device" box, and buttons **Create an account**, **Forgot your password?**, **Email me a sign-in code**.
3. Tab through the page. **Expect:** a logical order and visible focus.

### R2. Create the account: validation first
1. Press **Create an account**.
2. **Expect:** h1 "Create an account", the note "For adults. Children travel on a booker's account…", fields First name, Last name, Email address, Date of birth (hint "YYYY-MM-DD"), Password (hint "At least 10 characters").
3. Press **Create account** with everything empty.
   **Expect:** an error summary headed "Please fix the following" listing first name, last name, email, date of birth and password problems, and each field showing its own error.
4. Enter a bad email (`sam@`). **Expect:** "Enter a valid email address."
5. Enter a password of 9 characters. **Expect:** "Use a password of at least 10 characters."
6. Enter a date of birth that makes you 17 (for example one year ago minus 17 years). **Expect:** "An account holder must be 18 or over. A parent or guardian can add you to theirs."
7. Enter `12/04/1975`. **Expect:** "Enter your date of birth as year-month-day."
8. **Help tips:** open the tip beside First name. **Expect:** it explains to type the name as on the passport.

### R3. Create the account: success
1. Enter `Sam`, `Solo`, `solo.tester+1@example.com`, `1975-04-12`, `correct horse battery`.
2. Press **Create account** (label changes to "Creating…").
3. **Expect:** you are signed in. If a "Is this you already?" page appears, it means a name and date of birth match an existing account; press **It is not me, create my account** and note it.
4. **Expect:** first-run screens appear in some order. Complete them with the minimum:
   - **Chat picture:** "Your picture in chat". Pick any cartoon. (Check the picker pages four at a time.)
   - **Welcome:** "Welcome to your next stage" for **Dream**, with "Let's find a cruise you'll love", a journey map with "You are here", the steps (take the quiz; save a sailing; invite someone to dream with you) and **Get started**.
5. **Expect:** you land on **Home** with the **Dream** tabs: Home · Explore · Ask · Me.
6. Confirm there is no ship, cabin or cost tab, and no ship content in Home or search (the ship belongs to a sailing, and you have none).

### R4. Sign-in paths for the new account
1. Sign out (Settings, or Me). **Expect:** back at Sign in.
2. Sign in with the wrong password. **Expect:** "We could not sign you in with those details…" and no hint whether the email exists.
3. Sign in correctly with **Remember me** ticked. **Expect:** you return to Dream Home.
4. Sign out. Choose **Email me a sign-in code**, enter the email, press **Send code**. **Expect:** "If that address has an account, a code is on its way." Read the six-digit code from the API log, enter it, press **Sign in**. **Expect:** signed in.
5. Repeat step 4 with an email that has **no** account. **Expect:** the identical message (no account leak).
6. Enter a wrong code. **Expect:** "That code did not work…" and **Send a new code** works.
7. Sign out. **Forgot your password?** with the code flow, set the new password `correct horse battery 2`, then sign in with it. **Expect:** "Your password is changed and every other sign-in has ended."
8. Try **Create an account** again with the same email. **Expect:** "That email address already has an account. Sign in, or ask for a code."
9. Sign in once more. Carry on.

**Registration pass criteria:** an adult account exists, signs in three ways, shows Dream stage with the right tabs.

---

## 3. Stage 1: Dream (Home · Explore · Ask · Me)

Entry check: Home says "Let's find a cruise you'll love. Start with the quiz." Six tiles: Find My Cruise, Is This Cruise for Me?, Sailing Dates, Ask Stanley (before you book), Group Poll and Dream Board, Saved Sailings.

### 3.1 Find My Cruise (`H02` `/home/quiz`)
1. Open **Find My Cruise**.
2. Answer so you are **solo**: choose **Just me** for who is travelling. Pick any answers for the rest.
3. **Expect:** results with reasons; a solo-relevant reason such as "A sensible fit when you are travelling alone." where it applies.
4. **Stage rule:** do the quiz twice, change an answer, open a result. **Expect:** you are still in **Dream** (looking is not intent). Check the testing bar or the Me page for the stage.
5. Do **not** tap "Look closer at this sailing" yet.

### 3.2 Explore tab (teal)
For each, open it, check header, go back with the app's Back, and confirm you stay in Dream.
1. **The Cruise and Its Route** (`H06`).
2. **Sailing Dates** (`H07`): filter by month; open nothing deeper yet.
3. **Explore by Region and Month** (`H50`).
4. **Port Details** (`H09`): open any port from a route.
5. **Princess Ships** (`H47`), **Ship Details** (`H49`), **Compare Ships** (`H48`): compare two ships.
6. **A Day on This Ship** (`X02`).
7. **Occasion Starter** (`P04`).
8. **Expect throughout:** still Dream; ship pages describe a ship in general, not "your ship".

### 3.3 Ask tab (pink)
1. **Ask Stanley (before you book)** (`H04`): ask "Can I cruise on my own?" (also available as a suggested question).
   **Expect:** an answer that says solo travel is common and that single travellers usually pay a supplement. The reply must not claim a roommate-matching service exists.
2. In the same chat, try the helpers: reword/polish and an icebreaker, if offered.
3. Ask something off-topic. **Expect:** a polite redirect; no invented prices.
4. **Talk to a Travel Advisor** (`H03`): open it, read it, do not submit.
5. **Paste a Plan** (`P21`): open; leave empty. (Importing a plan that names a sailing would move you to Discover. Skip it.)
6. **Group Poll and Dream Board** (`P49`) and **Links for Someone at Home or Your Advisor** (`P50`): open both and confirm the wording suits a solo guest (you may share with someone at home, no group is required).

### 3.4 Me tab (plum)
1. **Saved Sailings** (`H11`): empty state is friendly, not an error.
2. Open the 18 settings and help screens (text size, theme, language, notifications, privacy, status, report a problem). **Expect:** each loads and has its own title.
3. Change text size to the largest. **Expect:** layout still usable. Change back.
4. Turn on high contrast or night mode, check, and turn it off.

### 3.5 Help and search
1. Press the **Help** button. **Expect:** a focus-trapped sheet; Escape closes it.
2. Use **Search** for "ship deck". **Expect:** no ship screens listed at Dream. Search "sailing". **Expect:** only Dream screens.
3. Type a direct URL for a later screen, for example `/home/embarkation`. **Expect:** it sends you to Home (no "coming soon" page).

**Move on:** continue to stage 2 by saving a sailing.

---

## 4. Stage 2: Discover (Home · Sailing · Cabin · Cost · Me)

### 4.1 Trigger the move
1. In **Sailing Dates** (`H07`), open a Sun Princess sailing (`H08`).
2. Press the save (heart or "Save") control.
3. **Expect:** you move to **Discover**. A "Welcome to your next stage" page appears: "Take a closer look", with "You have shown interest in a sailing, so we have moved you from dreaming to looking closely."
4. **Expect:** the tabs are now Home · Sailing · Cabin · Cost · Me, and a one-line "We've added…" note appears on Home.
5. Testing-bar reason (demo accounts only) would read `sailingSaved`.

### 4.2 Reversibility
1. Go to **Saved Sailings** and un-save the sailing. **Expect:** back to **Dream** tabs.
2. Save it again. **Expect:** **Discover** again, the same sailing in focus.

### 4.3 Sailing tab (teal)
1. **Sailing Details** (`H08`): dates, ports, ship, price from.
2. **Your Ship** (`H10`): **Expect:** the title and body name that sailing's ship (Sun Princess). Ship Info shows read-only.
3. **Deck Map** (`S01`), **Restaurants and Bars** (`S02`), **Venue Details** (`S03`): browse. Read-only, no booking buttons that charge.
4. **Is This Cruise for Me?** (`H13`): **Expect:** a **Sailing on your own** card showing fare plus the **solo supplement** on its own line and an all-in total, and a note that staterooms are not set aside for solo guests and no roommate matching is listed.
5. **Port Details** for a port on this itinerary.
6. **Compare Sailings** (`H51`): save a second sailing, compare two, then un-save the second (keep the first as focus).

### 4.4 Cabin tab (pink)
1. **Choose Your Cabin** (`H14`): pick a room type for **1 guest**. **Expect:** the solo note, "One guest pays twice the per-person fare. The price on the review step shows it."
2. Look at cabin photos and the cabin chooser details.
3. **Guaranteed-Cabin Odds** (`P19`): open and read.

### 4.5 Cost tab (gold)
1. **What the Whole Trip Costs** (`H12`): set **1 guest**. **Expect:** a line "Solo supplement for sailing alone", taxes and fees, and an all-in total. Add and remove optional extras; the total updates.
2. **Offers for Your Trip** (`H15`): read; apply one if available.
3. **Price-Drop Watch** (`P17`): turn on a watch. **Expect:** it appears under Me too.
4. **Is This Fare Fair?** (`P18`): open.
5. **Talk to a Travel Advisor** and **Ask Stanley (before you book)**: ask "What does it cost me to sail alone?" **Expect:** an answer that matches the cost screen.
6. Cross-check: the all-in total on the cost page equals the total you will see in the booking review (step 5.5).

**Move on:** go to the booking funnel.

---

## 5. Stage 3: Book (Home · Booking · Travellers · Pay · Me)

### 5.1 Start a draft
1. **Book Your Cruise** (`H16`, `/book`). Choose the sailing, then press **Book this sailing**.
2. **Expect:** you move to **Book** ("Finish booking. Nothing is lost if you stop."). Tabs: Home · Booking · Travellers · Pay · Me.
3. Reason (demo): `draftStarted`.

### 5.2 Walk the seven steps (progress reads "Step n of 7")
Steps: **Date → Room → Fare → Guests → Dining → Review → Pay**.
1. **Date:** confirm the sailing.
2. **Room:** choose your room type, set **1 guest**. **Expect:** the solo note again. A room that takes only 1 guest should not let you add a second.
3. **Fare:** choose a fare. Compare the shown price to the cost screen.
4. **Guests:** "Who is sailing". Guest 1 is "the person booking" and is prefilled from your account.
   - Check the name matches the passport format (no title).
   - Enter date of birth, gender as shown on the passport.
   - Add one need (for example a dietary note) as optional.
   - **Expect:** a note that passport scanning is not available in this concept.
   - Try to add a **second** guest who is under 21 into a one-guest room. **Expect:** it is blocked or the 21+ rule note shows. Remove them again.
5. **Dining:** choose a dining time (and table size if offered). Pick "just me" or the smallest table.
6. **Review:** **Expect:** sailing, room, fare, guests, dining, **price with the solo supplement**, "This price is held for you until {time}", the cancellation terms, any onboard credit shown separately ("It goes on your onboard account. It does not lower the price"), and a deposit-and-balance plan. Use **Change** beside each section and return.
7. Accept the documents (contract and terms) and continue.

### 5.3 Leave and resume
1. Close the tab at the Review step. Reopen and sign in.
2. Open **Finish Your Booking** (`H18`). **Expect:** it resumes where you stopped, with nothing lost, and you are still in **Book**.
3. **Hold a Cabin for 48 Hours** (`P20`): try the hold, then release it. **Expect:** release takes you back to Discover only if no draft is open.

### 5.4 Travellers tab (pink)
1. **Your Travel Party** (`P47`): **Expect:** it shows only you. Look for a clear solo empty state and no pressure to add people.
2. **Traveller Details** (`M05`): fill in or check name, passport number if asked, nationality, emergency contact. (Note: the emergency contact matters for a solo guest.)
3. **Accessibility Profile** (`P09`), **Special Assistance** (`P10`), **Allergy Pre-Flag** (`P11`): set one value in each and save. Reopen to confirm it stuck.
4. **Several Cabins, One Day** (`P46`): open; **Expect:** a sensible "not needed" state.

### 5.5 Pay tab (gold): failure first
1. Reach the **Pay** step (or `H19` from the Pay tab).
2. **Expect:** "Choose how much to pay now"; options **Pay a deposit of {amount}** and **Pay in full**.
3. Add a card ending **`0002`** (any name, expiry `12/30`). Choose **deposit** and press the pay button.
   **Expect:** a clear "declined" message, **no charge, no receipt**, and the booking stays in **Book**.
4. Add a card ending **`4242`**, set it as default.
5. Try **Split between two ways to pay** with amounts that do **not** add to the total. **Expect:** a validation message ("The two amounts must add up to …"). Switch back to **Pay with one**.
6. Press **Money Plan** (`P14`) and **Split Costs** (`P15`): **Expect:** solo state ("no one to split with"), not an error. **Pay Your Share** (`P16`): nothing owed.

### 5.6 Pay: success
1. Choose **Pay a deposit**, pay with the `4242` card.
2. **Expect:** a confirmation moment, then **Booking Confirmed** (`H20`) with a **booking confirmation number**.
3. **Expect:** you move to **Manage**. (Reason in demo: `bookingConfirmed`.)
4. Press Back. **Expect:** you cannot restart the paid booking, and the stage does not fall back.
5. Run a second payment attempt on the same booking if a button is offered. **Expect:** no double charge.

---

## 6. Stage 4: Manage (Home · Trip · Needs · Group · Me)

Entry check: "Your booking is confirmed. Here is what needs you next." Six tiles: Money Plan, Documents, Readiness for Each Traveller, Changes to Your Trip, Your Ship, Accessibility Profile.

### 6.1 Trip tab (teal)
1. **My Trips** (`M02`) and **Trip Details** (`M03`): confirmation number, sailing, ship, room, dining, amount paid, balance and due date.
2. **Booking Confirmed** (`H20`): reopen. **Expect:** same number.
3. **Changes to Your Trip** (`H21`) and **Plain-English Summaries** (`H23`): read.
4. **Ask Stanley (your trip)** (`H05`): ask "When is my balance due?" and "What do I need to bring?" **Expect:** answers that match Trip Details (due date, passport).
5. **Pre-Cruise Checklist** (`P01`): tick two items. **Expect:** ticks persist on reload on this device.
6. **Trip Contract** (`P13`): open; the signed terms from booking are here.
7. Ship pages (`H10`, `S01`, `S02`, `S03`): still read-only; titled with your ship.

### 6.2 Needs tab (pink)
1. **Documents** (`M06`): add a passport entry (type, number, expiry, nationality). Test a passport that expires within six months of sailing. **Expect:** a warning. Fix it.
2. **Readiness for Each Traveller** (`P12`): **Expect:** one row, with what's still missing.
3. **Medical Card** (`P08`), **Health and Comfort** (`P07`): add a note. **Expect:** it is private (no sharing options to a party that doesn't exist).
4. **Port Entry Rules** (`H38`): check a port; read visa and passport notes.

### 6.3 Group tab (gold): solo reading
1. **Party Chat and Guest Services** (`C01`): **Expect:** with no party, Guest Services is reachable and a party chat is not forced on you. Send a short question to Guest Services. **Expect:** a reply or a clear "sent" state.
2. **Family at Home** (`P48`): create a link for someone at home. Open the link in a private window. **Expect:** limited read-only view and no private data (no passport or payment).
3. **Organiser and Privacy** (`P43`): confirm you are the organiser of a party of one.
4. Skip the child pages (`P51`, `P52`) except to confirm they say they do not apply.

### 6.4 Me tab (plum)
1. **Payments** (`M07`): the deposit receipt (`4242`, amount) shows. Download or print it.
2. **Captain's Circle and Rewards** (`M09`): open.
3. **Price-Drop Watch**: the one you set is listed.
4. **Packages** (`M08`): open (you will buy one later).

**Move on (demo clock):** now make the account a demo account (section 0.2, Option A). Sign out and in. Confirm the **testing bar** shows. Note today's date and the sailing date from Trip Details.

---

## 7. Stage 5: Prebook (Home · Plan · Prepare · Group · Me)

### 7.1 Trigger
Either **pay the balance** from `H19` Pay Your Balance, or jump the testing date to **14 days before departure**. Do both on separate runs if you can.
1. Use the testing bar: press the date, choose the date, **Use this date and time**.
2. **Expect:** a "Welcome to your next stage" page for Prebook, a note that Plan, Prepare and Group are the tabs, and the bar reads "{stage} · {n} days to boarding".
3. Reason (bar): `paidInFull` (after paying) or `twoWeeksOut`.
4. **Pay the balance** now (if you used the date route): **Expect:** the receipt appears, balance shows zero, and Money Plan says "paid in full".

### 7.2 Plan tab (teal)
1. **My Excursions** (`P37`) (port by port): book one for a port. **Expect:** the price is clear, the booking appears in **My Reservations** (`P35`).
2. **Dining Reservations** (`P38`): book a table for one; check the table size.
3. **Reservation Details** (`P36`): open the one you made, then cancel or change it. **Expect:** it reflects in My Reservations.
4. **Book Ahead** (`P26`), **Saved Items and Basket** (`P24`), **Prepay and Credit** (`P23`): add an item to the basket, then remove it. Prepay something small.
5. **Room Upgrades** (`P25`): view only.
6. **Build My Day** (`P34`), **Autopilot Day** (`P39`), **My Daily Rhythm** (`P40`), **Surprises** (`P41`), **What the App Thinks You Like** (`P42`): open each; accept one suggestion; reject one.
7. **Ship or Independent** (`P44`): compare for a port, with a solo-friendly note on safety if shown.
8. Skip **Kids' and Teens' Clubs** except to confirm it says it is not for you.

### 7.3 Prepare tab (pink)
1. **Packing List** (`P02`) and **Packing for This Ship** (`P03`): tick items and add one.
2. **Phone Setup Before You Sail** (`P05`): complete the checklist.
3. **Getting to the Port** (`P29`): enter your home town and travel mode. **Expect:** a plan with a latest-safe arrival time.
4. **Weather by Port** (`P31`), **Away from Home** (`P33`), **When Something Changes** (`H24`).
5. **Health and Comfort** (`P07`).

### 7.4 Group tab (gold), Me tab
1. Group as in 6.3: the party is still just you.
2. **Me → Packages** (`M08`): buy one package (for example Wi-Fi) with the `4242` card. **Expect:** it lists in Payments (`M07`) and in Packages.
3. **Me → Trip Details**: the new reservations and packages are listed.

---

## 8. Stage 6: Get to the ship (Home · Board · Travel · Plan · Me)

### 8.1 Trigger
1. Jump the testing date to **three days before departure at 00:01** (check-in opens at midnight 3 days before).
2. **Expect:** Prebook becomes **Get to the ship**: Home says "Get to the ship with time to spare", tiles Boarding Pass, Online Check-In, Getting to the Ship, Documents, I'm Delayed, Emergency Card. Reason: `checkinOpened`.
3. **Edge case:** jump to **two days and 23 hours** before (check-in not open). **Expect:** still Prebook. Then jump forward again.

### 8.2 Board tab (gold)
1. **Online Check-In** (`H27`) (for the whole party, which is you): open it.
2. **Check-In for One Traveller** (`H28`): confirm your passport, nationality, emergency contact, and the health declaration. Try submitting with a missing passport. **Expect:** it blocks and says what is missing.
3. Finish check-in. **Expect:** **What We Have on File** (`H29`) receipt lists what you gave.
4. **Boarding Pass** (`H31`): **Expect:** a QR code, your name, the arrival time slot, ship and cabin or "cabin ready at boarding". Check it still shows with the network off (offline).
5. **Find My Boarding Pass** (`H26`): works as a fallback.
6. **Luggage Tags** (`H37`): create and view the tag.
7. **My Medallion** (`H36`): open.
8. **Embarkation Day** (`H32`) and **Embarkation Plan** (`H34`): read your arrival time.
9. **Emergency Card** (`S26`): **Expect:** reachable in one tap from Home.
10. **Check in at the Terminal** (`H30`): open only (do not trigger yet).
11. Check-in rule: jump to **after 10:00 on sailing day**. **Expect:** online check-in is closed and points you to the terminal. Jump back to the day before.

### 8.3 Travel tab (pink)
1. **Getting to the Ship** (`P30`) and **Getting to the Port** (`P29`).
2. **Storm Watch** (`P32`), **Weather by Port** (`P31`).
3. **I'm Delayed** (`H25`): report "30 minutes late". **Expect:** a message that confirms and the new estimated arrival; it does not claim the ship will wait.
4. **When Something Changes** (`H24`) and **What Happens If** (`P22`).
5. **Port Entry Rules** (`H38`).

### 8.4 Plan tab, Me tab
1. Re-open reservations (`P35`). **Expect:** earlier bookings are intact.
2. **Me → Documents:** passport and boarding pass saved.

---

## 9. Stage 7: Embark (Home · Board · Ship · Plan · Me)

### 9.1 Trigger (try both)
1. **Route 1:** on sailing day before 11:00, press **I'm at the terminal** (`H30`). **Expect:** Embark with reason `atTerminal`.
2. **Route 2:** on another run, jump to **11:00 on sailing day**. **Expect:** Embark with reason `boardingBegan`.
3. Entry check: Home says "Welcome aboard. One step at a time." Tiles: Embarkation Companion, Meeting-Point Card, Muster Drill, Deck Map, Wi-Fi, Medical Help Now. **Expect:** a Ship tab appears for the first time, with "Your ship is ready. We've added Ship."

### 9.2 Board tab (gold)
1. **Embarkation Companion** (`H33`): step through every step.
2. **Meeting-Point Card** (`H35`): **Expect:** a card you can show staff.
3. **Muster Drill** (`S25`): open and read your station.
4. **Emergency Card** (`S26`).
5. **Find My Family** (`S40`): **Expect:** an empty or "no one to find" state, not an error.
6. **Party Chat and Guest Services** (`C01`): contact Guest Services.
7. **Boarding Pass**, **Medallion**, **Luggage Tags**, **I'm Delayed** still reachable.

### 9.3 Ship tab (pink), first look
1. **Deck Map** (`S01`): find your room's deck.
2. **Restaurants and Bars** (`S02`) and **Venue Details**.
3. **Ship News** (`S04`) and **Search the Ship** (`S05`): search "pool".
4. **Ask Stanley (the ship)** (`S14`): "Where can I eat alone without feeling awkward?" **Expect:** a sensible answer from ship data, with no invented venue.
5. **Wi-Fi** (`S23`): buy or confirm the package you bought.
6. **My Stateroom** (`S22`), **Cabin Requests** (`S21`), **Cabin TV** (`S24`).
7. Safety group: **Medical Help Now** (`S27`), **Ask for Help by Text** (`S28`), **Report a Security Concern** (`S29`), **Health and Medical Center** (`S30`), **Seasickness First Aid** (`S31`).

### 9.4 Me tab
1. **My Bill** (`M10`): should be near zero before any spending.
2. **Top Up, PIN and Gratuities** (`M12`): set your onboard PIN.
3. **Everything Paid and Charged** (`M11`): the earlier payments appear.

---

## 10. Stage 8: Sea (Home · Today · Ship · People · Me)

### 10.1 Trigger
1. Jump to **sailaway** (use a time after the first day's departure time from the itinerary). If the first day after sailaway is a **port day**, you will land in Port: that is correct, and you should do section 11 first. Then jump to a **sea day** itinerary day, **at 08:00 ship time**.
2. **Expect:** Sea. Home says "Today on board, and what is next." The bar reads "At sea · day n of N" and shows **Ship time**.
3. Reason: `seaDay`.
4. **Timing edge:** jump to **07:59** on a sea day after a port day. **Expect:** still the previous day's stage; at 08:00 it flips.

### 10.2 Today tab (teal)
1. **Morning and Evening Briefing** (`H22`): matches the day shown in the bar.
2. **Build My Day** (`P34`), **My Reservations** (`P35`), **My Excursions** (`P37`), **Dining Reservations** (`P38`): the items you booked in Prebook appear on the right day.
3. **Autopilot Day** (`P39`) and **My Daily Rhythm** (`P40`): generate a day for one.
4. **Ship News** (`S04`): entertainment changes by day (change the date, confirm it changes).
5. **Book Ahead** (`P26`): reserve a show seat for one.
6. **Getting Off the Ship** (`H39`) and **Bag Night** (`H40`): on the last two days only. Confirm they are hidden earlier (a Home item appears one night before the final morning).
7. **When Something Changes** (`H24`), **I'm Delayed** (`H25`).

### 10.3 Ship tab (pink)
1. **Order Food and Drinks** (`S15`): place a small order; check the delivery estimate; check it appears on My Bill.
2. **Bar Menu and Drinks Tracker** (`S16`): add one drink.
3. **Spa, Salon and Fitness** (`S18`): view and book one.
4. **Laundry and Pressing** (`S20`) and **Cabin Requests** (`S21`): request something.
5. **Steps and Deck Laps** (`S06`), **Loungers** (`S07`).
6. **Where Are We** (`S09`), **The Sea Beneath Us** (`S10`), **Along the Way** (`S11`), **Sun, Moon and Stars** (`S12`), **Sightings** (`S08`), **Ship Pulse** (`S13`): open each. **Expect:** values change when the testing time changes.
7. **Dining Favourites and Table** (`S19`): set your preference for table sharing. (Solo-relevant: look for "share a table" or "table for one".)
8. **Do Not Disturb** (`S36`): turn on and off.
9. **Captioned and Signed Shows** (`S35`), **Lost and Found** (`S34`), **Allergy Confidence** (`S33`).
10. **Shops and Specials** (`S17`).

### 10.4 People tab (gold): the solo screens (spend the most time here)
1. **Solo Safety Timer** (`S45`, `/ship/solo`):
   - **Expect:** "Going somewhere on your own? Set a time to be back." and the note "Nothing is sent to anyone, so also tell someone you trust where you are going."
   - Fill "Where are you going?" with `Deck 15 jogging track`, choose **Be back in 15 minutes**, press **Start the timer**.
   - **Expect:** "Timer running for Deck 15 jogging track. Back by {time}."
   - Jump the testing time forward 16 minutes. **Expect:** "Time is up… Check in now." Jump forward 30 more. **Expect:** "Over time… If you need help, use the emergency screen." and a path to **Emergency Card**.
   - Press **I'm back and safe**. **Expect:** the timer clears.
   - Start another with a blank place. **Expect:** "somewhere on the ship". Reload while it runs. **Expect:** it persists.
2. **I'm OK Check** (`S46`): do the three-tap check-in; confirm the result is recorded.
3. **Services and Meet-Ups** (`S44`): **Expect:** the list of hosted activities, with an honest note that this is not roommate matching. Sign up for one.
4. **Games** (`S43`): open one.
5. **Photos** (`S48`) and **Read Aloud** (`S49`): open.
6. **You Said, We Did** (`S47`): open.
7. **Party Chat and Guest Services** (`C01`): chat with Guest Services. Try a **housekeeping** request. Jump forward ten minutes. **Expect:** a crew reply appears.
8. **Find My Family** (`S40`): empty state is graceful for a solo guest.
9. Skip **Kids' Club Report** and **Teen Agreement** except to confirm they say they are not relevant.

### 10.5 Me tab
1. **My Bill**: every order and purchase you made is listed, with the right total.
2. **Everything Paid and Charged**, **Top Up, PIN and Gratuities**: add onboard credit with the `4242` card.
3. **Packages**: the package you bought shows its use.
4. **Lost Items, Claims and Complaints** (`M24`): open a test case, then withdraw it.

---

## 11. Stage 9: Port (Home · Port · Ship · People · Me)

### 11.1 Trigger
Jump to a **port day** from the itinerary, at 08:00 ship time or later. **Expect:** Port. Home says "Your day ashore, and when to be back." Reason: `portDay`. The bar shows the port's local time or ship time as appropriate.

### 11.2 Port tab (teal)
1. **Port Day** (`S37`): **Expect:** an all-aboard time clearly shown, with a countdown.
2. **Port Know-How** (`S38`) and **Port Snapshot** (`S39`).
3. **Port Details** (`H09`): the port you are in.
4. **My Excursions** (`P37`): the one you booked shows with meeting point and time.
5. **Ship or Independent** (`P44`): compare for the port.
6. **Safe Ashore for You** (`S32`): **Expect:** safety advice for the port; check the solo and women-travelling-alone section and any "not verified" labels on sample content.
7. **Weather by Port** (`P31`), **Port Entry Rules** (`H38`), **Allergy Confidence** (`S33`).
8. **Solo Safety Timer** (`S45`) and **I'm OK Check** (`S46`): both are in this tab. Start a timer for "ashore in {port}" with 4 hours. Jump to past the timer and confirm the due and overdue states, then end with **I'm back and safe**.
9. **I'm Delayed** (`H25`): report being late back to the ship. **Expect:** it states the all-aboard time and what to do, and does not promise a wait.
10. **Morning and Evening Briefing** (`H22`), **Build My Day**, **My Reservations**.

### 11.3 Ship and People tabs
Spot check three screens each (for example Deck Map, Order Food and Drinks, Emergency Card; Chat, Solo Safety Timer, Photos). **Expect:** the same content as at Sea, since the tabs are the same.

### 11.4 Alternation
1. Jump through a few days: sea, port, sea, port. **Expect:** the stage flips between Sea and Port exactly at 08:00 ship time, and the bar's day number and zone follow.
2. **Time zone edge:** if the itinerary crosses a time zone, jump to just either side of the change. **Expect:** the bar's zone label updates and the all-aboard time is still correct.

---

## 12. Stage 10: Disembark (Home · Leave · Ship · People · Me)

### 12.1 Trigger
1. Jump to **the night before the last day** (for example 21:00). **Expect:** still Sea or Port, but Home has a **Bag Night** or disembarkation item.
2. Jump to **06:00 ship time on the final morning**. **Expect:** Disembark. Home says "Getting home: your exit, your bags and your bill." Reason: `finalMorning`.
3. Tiles: Getting Off the Ship, Bag Night, Final Bill and Receipts, Customs and Immigration, Cabin Sweep, Getting Home from the Port.

### 12.2 Leave tab (teal)
1. **Final Night Checklist** (`H41`) and **Bag Night** (`H40`): tick items, choose luggage tag colour.
2. **Getting Off the Ship** (`H39`): pick your **exit time slot**. **Expect:** confirmation.
3. **Cabin Sweep** (`H42`): complete.
4. **Customs and Immigration** (`H43`): fill the declaration.
5. **Plan Around My Flight** (`H44`): enter a flight time. **Expect:** a latest-safe exit time and a warning if your exit slot is too late.
6. **Getting Home from the Port** (`H45`) and **Share a Ride** (`H46`): open; skip sharing unless you want to test matching.
7. **Final Bill and Receipts** (`M13`) and **My Bill** (`M10`): the total matches what you spent; settle any balance with `4242`.
8. **Lost and Found** (`S34`): open.

### 12.3 Ship, People, Me
1. **Ship:** only the short list should show (Deck Map, Restaurants, Order Food, Cabin Requests, Wi-Fi, Emergency Card, Medical Help Now, Ask for Help by Text, Health and Medical Center, Lost and Found). **Expect:** no Muster Drill.
2. **People:** only Chat, Find My Family, You Said We Did, Photos.
3. **Me:** **Three-Tap Farewell** (`M20`) and **Rate Your Cruise** (`M19`) are here early; open and close without submitting.
4. **Expect:** the **Solo Safety Timer** is gone from the tabs now.

---

## 13. Stage 11: Remember (Home · Memories · Next · Feedback · Me)

### 13.1 Trigger (try both)
1. **Route 1:** jump to **12:00 on the last morning**. **Expect:** Remember, reason `tripEnded`.
2. **Route 2:** on another run, scan off the ship with the demo gangway control (if present). **Expect:** Remember before noon.
3. Home says "Your trip, and where to next." Tiles: Trip Memories, Memory Book and Next Trip, Rate Your Cruise, Captain's Circle and Rewards, Trip History and Receipts, Book Your Next Cruise.

### 13.2 Memories tab (teal)
1. **Trip Memories** (`M16`): recap of days, ports and spend.
2. **Memory Book and Next Trip** (`M17`): add a note.
3. **Trip Diary** (`M42`): write an entry.
4. **Your Cruise, Wrapped** (`M18`): open and share (check it contains no private details by default).
5. **Photos** (`S48`).
6. **You Said, We Did** (`S47`).
7. **Trip History and Receipts** (`M15`): download the receipts.

### 13.3 Next tab (pink)
1. **Book Your Next Cruise** (`M22`): start from a saved idea.
2. **Explore by Region and Month**, **Sailing Dates**: browse. **Expect:** this does **not** change your stage (the Next track is an item on Home).
3. Save a new sailing. **Expect:** a "Next trip" item appears on Home, the tabs stay Remember, and the first trip stays the current one until you confirm a new booking.
4. **Gift Ideas** (`P28`), **Captain's Circle and Rewards** (`M09`): the loyalty points from this trip appear.

### 13.4 Feedback tab (gold)
1. **Rate Your Cruise** (`M19`): submit a rating and a comment. **Expect:** a thank-you, and you cannot submit a second time without a clear message.
2. **Health Note After the Trip** (`M21`): submit "no issues".
3. **Three-Tap Farewell** (`M20`): complete.
4. **Caring for the Sea** (`M23`).
5. **Lost Items, Claims and Complaints** (`M24`): open the earlier test case; confirm its status.

### 13.5 Me tab
1. **Trip Contract**, **Booking Confirmed**, **Documents**, **Trip Details**: all still open, so nothing paid for or agreed to was lost.
2. **Ten-day rule:** jump 11 days after the trip. **Expect:** the finished trip stops being the current one; Home shows the next-trip track. If you have saved a new sailing, the Discover stage returns for it.

---

## 14. Whole-journey checks (after stage 11)

### 14.1 Data continuity
- [ ] The booking number, payments and documents are the same at every stage.
- [ ] Reservations booked in stage 5 appear in stages 8 and 9 on the right day.
- [ ] Every charge from stages 5, 8 and 10 appears on **My Bill** and **Everything Paid and Charged**.

### 14.2 A second device
1. Sign in on a second browser or phone with the same account.
2. **Expect:** the same stage, the same tabs, the same bookings and reservations. (The front end keeps no data store of its own; only display settings, the session token and caches are per device.)
3. Make a change on device A (cancel one reservation). **Expect:** device B shows it after a refresh.
4. **Sign out everywhere** on device A. **Expect:** device B is signed out on its next action.

### 14.3 Offline and PWA
- [ ] Install the app (Add to Home Screen or the browser's install button).
- [ ] With the network off, open the boarding pass, the day plan and the emergency card. **Expect:** they still show, with a clear "offline" note.
- [ ] Try to pay while offline. **Expect:** a clear "You are offline" error and no charge.

### 14.4 Stage engine checks
- [ ] No jump ever put you in a **later** stage than expected.
- [ ] Jumping **backwards** after confirmation does not undo the booking or send you back before Manage, except via cancellation.
- [ ] A direct link to a screen not in your stage goes to Home, never a blank or error page.
- [ ] Search at each stage only returned that stage's screens.

### 14.5 Cancellation branch (a separate throwaway account)
1. Register a second solo account and book to confirmation.
2. **What Happens If** (`P22`) and **Trip Contract**: read the cancellation terms.
3. Cancel the booking. **Expect:** a refund per the terms, and the stage returns to **Discover** with that sailing still in focus.

### 14.6 Privacy and account
- [ ] **Privacy** (`M25`): export your data. **Expect:** the file includes trips, documents and bookings.
- [ ] **Marketing** (`M26`): subscribe, confirm with the code, unsubscribe.
- [ ] Delete the test account. **Expect:** a confirmation step, then everything is removed (sign-in fails afterwards).

---

## 15. Defect log

| # | Stage / step | What I did | What happened | Expected | Severity |
|---|---|---|---|---|---|
| | | | | | |

## 16. Known limits and honest caveats

- **Content is sample data.** Ports, dining and ship details for Sky and Sapphire are concept samples (`docs/aboard-plan.md`, `docs/content-verification.md`). Do not log "unverified" wording as a defect.
- **No real payments, email or ship feeds.** Cards, email codes, telemetry, weather, flights and traffic are simulated on the server.
- **Stanley** answers from scripts unless a model key is set, so the exact wording will differ between environments. Check meaning and accuracy, not wording.
- **Roommate matching and solo staterooms do not exist.** The app must say so plainly. A screen that implies otherwise is a defect.
- **Screen names and labels** were taken from the English locale file and the screen registry. If a button is worded differently on screen, trust the screen and fix this plan.
- **Not covered:** multi-traveller parties, children, accessibility-specific bookings, group chats between multiple real accounts, and the three other ships in depth. Those need their own plans.
