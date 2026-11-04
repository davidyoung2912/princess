# Stage experience: tabs, tiles and screens by stage

Generated from `STAGE_TABS` in `src/routes/screens.ts` (the single registry; it replaced `HUBS`, `STAGE_MENUS` and `QUICK`). The design and
reasoning are in `stage-experience-plan.md`. The stage comes from the server (`stage`, `focusSailingId` and the reason in the context
endpoint). Every stage has **Home** first and **Me** last with two or three stage tabs between. Screens a stage does not use are hidden from
its tabs, Home and search. Tests in `src/routes/screens.test.ts` and `coverage.test.ts` keep this data honest.

## Summary

| Stage | Tabs between Home and Me | Screens used |
|---|---|---|
| Dream | Explore (teal) · Ask (pink) | 37 |
| Discover | Sailing (teal) · Cabin (pink) · Cost (gold) | 43 |
| Book | Booking (teal) · Travellers (pink) · Pay (gold) | 43 |
| Manage | Trip (teal) · Needs (pink) · Group (gold) | 58 |
| Prebook | Plan (teal) · Prepare (pink) · Group (gold) | 73 |
| Get to the ship | Board (gold) · Travel (pink) · Plan (teal) | 62 |
| Embark | Board (gold) · Ship (pink) · Plan (teal) | 67 |
| Sea | Today (teal) · Ship (pink) · People (gold) | 93 |
| Port | Port (teal) · Ship (pink) · People (gold) | 88 |
| Disembark | Leave (teal) · Ship (pink) · People (gold) | 48 |
| Remember | Memories (teal) · Next (pink) · Feedback (gold) | 49 |

## Dream

**Home.** Let's find a cruise you'll love. Start with the quiz.

Six tiles: `H02` Find My Cruise; `H13` Is This Cruise for Me?; `H07` Sailing Dates; `H04` Ask the Concierge; `P49` Group Poll and Dream Board; `H11` Saved Sailings

**Explore** (teal). Browse the cruise, the sailings and the ports.

`H06` The Cruise and Its Route; `H07` Sailing Dates; `H50` Explore by Region and Month; `H08` Sailing Details; `H09` Port Details; `H47` Princess Ships; `H49` Ship Details; `H48` Compare Ships; `H11` Saved Sailings; `H51` Compare Sailings; `P04` Occasion Starter; `X02` A Day on This Ship

**Ask** (pink). Get answers and advice before you decide.

`H04` Ask the Concierge; `H03` Talk to a Travel Advisor; `H02` Find My Cruise; `H13` Is This Cruise for Me?; `P21` Paste a Plan; `P49` Group Poll and Dream Board; `P50` Links for Someone at Home or Your Advisor

**Me** (plum). Your details and the sailings you have saved.

`H11` Saved Sailings; `H51` Compare Sailings; plus settings and help (18 screens, every stage).

## Discover

**Home.** Your sailing, its real cost and your room, in one place.

Six tiles: `H08` Sailing Details; `H12` What the Whole Trip Costs; `H14` Choose Your Cabin; `H10` Your Ship; `H11` Saved Sailings; `H03` Talk to a Travel Advisor

**Sailing** (teal). Everything about the sailing you are considering.

`H08` Sailing Details; `H07` Sailing Dates; `H50` Explore by Region and Month; `H09` Port Details; `H06` The Cruise and Its Route; `H10` Your Ship; `H47` Princess Ships; `H49` Ship Details; `H48` Compare Ships; `S01` Deck Map; `S02` Restaurants and Bars; `S03` Venue Details; `H13` Is This Cruise for Me?; `X02` A Day on This Ship

**Cabin** (pink). Pick the room that suits you.

`H14` Choose Your Cabin; `P19` Guaranteed-Cabin Odds; `H13` Is This Cruise for Me?

**Cost** (gold). The real, all-in price, and ways to pay less.

`H12` What the Whole Trip Costs; `H15` Offers for Your Trip; `P17` Price-Drop Watch; `P18` Is This Fare Fair?; `H16` Book Your Cruise; `H03` Talk to a Travel Advisor; `H04` Ask the Concierge

**Me** (plum). Your saved sailings, price watches and details.

`H11` Saved Sailings; `H51` Compare Sailings; `P17` Price-Drop Watch; plus settings and help (18 screens, every stage).

## Book

**Home.** Finish booking. Nothing is lost if you stop.

Six tiles: `H18` Finish Your Booking; `H17` Your Booking; `P47` Your Travel Party; `P15` Split Costs; `P22` What Happens If; `P13` Trip Contract

**Booking** (teal). Your booking, from price to confirmation.

`H16` Book Your Cruise; `H17` Your Booking; `H18` Finish Your Booking; `H20` Booking Confirmed; `P13` Trip Contract; `P22` What Happens If; `P20` Hold a Cabin for 48 Hours; `P19` Guaranteed-Cabin Odds; `H08` Sailing Details; `H12` What the Whole Trip Costs; `H14` Choose Your Cabin; `H15` Offers for Your Trip; `H10` Your Ship

**Travellers** (pink). Who is going, and what each person needs.

`P47` Your Travel Party; `M05` Traveller Details; `P09` Accessibility Profile; `P10` Special Assistance; `P11` Allergy Pre-Flag; `P46` Several Cabins, One Day

**Pay** (gold). Deposit, balance and sharing the cost.

`H19` Pay Your Balance; `P14` Money Plan; `P15` Split Costs; `P16` Pay Your Share; `M07` Payments

**Me** (plum). Your draft, payments and travellers' details.

`M02` My Trips; `M07` Payments; `P13` Trip Contract; plus settings and help (18 screens, every stage).

## Manage

**Home.** Your booking is confirmed. Here is what needs you next.

Six tiles: `P14` Money Plan; `M06` Documents; `P12` Readiness for Each Traveller; `H21` Changes to Your Trip; `H10` Your Ship; `P09` Accessibility Profile

**Trip** (teal). Your confirmed trip, and what changes.

`M02` My Trips; `M03` Trip Details; `H20` Booking Confirmed; `H21` Changes to Your Trip; `H23` Plain-English Summaries; `H05` Ask Your Cruise; `H08` Sailing Details; `H09` Port Details; `H10` Your Ship; `S01` Deck Map; `S02` Restaurants and Bars; `S03` Venue Details; `P01` Pre-Cruise Checklist; `P13` Trip Contract; `P14` Money Plan

**Needs** (pink). Documents, health and access for every traveller.

`M06` Documents; `M05` Traveller Details; `P12` Readiness for Each Traveller; `P08` Medical Card; `P09` Accessibility Profile; `P10` Special Assistance; `P11` Allergy Pre-Flag; `P07` Health and Comfort; `H38` Port Entry Rules

**Group** (gold). Your travel party and the people at home.

`C01` Party Chat and Guest Services; `P47` Your Travel Party; `P48` Family at Home; `P49` Group Poll and Dream Board; `P50` Links for Someone at Home or Your Advisor; `P43` Organiser and Privacy; `P46` Several Cabins, One Day; `P51` Trip Story for a Child; `P52` Child Brief; `M14` Family Helper

**Me** (plum). Payments, documents and what is due.

`M02` My Trips; `M03` Trip Details; `M06` Documents; `M07` Payments; `M09` Captain's Circle and Rewards; `P13` Trip Contract; `P14` Money Plan; `P12` Readiness for Each Traveller; `P15` Split Costs; `P16` Pay Your Share; `P17` Price-Drop Watch; `P18` Is This Fare Fair?; `M14` Family Helper; plus settings and help (18 screens, every stage).

## Prebook

**Home.** Shape your days before you sail.

Six tiles: `P37` My Excursions; `P38` Dining Reservations; `M08` Packages; `P02` Packing List; `P01` Pre-Cruise Checklist; `P47` Your Travel Party

**Plan** (teal). Book excursions and dining and shape your days.

`P37` My Excursions; `P38` Dining Reservations; `P35` My Reservations; `P36` Reservation Details; `P26` Book Ahead; `P27` Kids' and Teens' Clubs; `P24` Saved Items and Basket; `P23` Prepay and Credit; `P25` Room Upgrades; `P28` Gift Ideas; `P34` Build My Day; `P39` Autopilot Day; `P40` My Daily Rhythm; `P41` Surprises; `P42` What the App Thinks You Like; `P44` Ship or Independent; `P45` Family Traditions; `P06` How Hard Is It?; `S18` Spa, Salon and Fitness; `S19` Dining Favourites and Table; `S38` Port Know-How; `H09` Port Details

**Prepare** (pink). Pack, travel and sort things at home.

`P01` Pre-Cruise Checklist; `P02` Packing List; `P03` Packing for This Ship; `P05` Phone Setup Before You Sail; `P07` Health and Comfort; `P29` Getting to the Port; `P31` Weather by Port; `P33` Away from Home; `H38` Port Entry Rules; `H24` When Something Changes

**Group** (gold). Your travel party and the people at home.

`C01` Party Chat and Guest Services; `P47` Your Travel Party; `P48` Family at Home; `P49` Group Poll and Dream Board; `P50` Links for Someone at Home or Your Advisor; `P43` Organiser and Privacy; `P46` Several Cabins, One Day; `P51` Trip Story for a Child; `P52` Child Brief; `M14` Family Helper

**Me** (plum). Payments, documents, packages and rewards.

`M02` My Trips; `M03` Trip Details; `M06` Documents; `M07` Payments; `M08` Packages; `M09` Captain's Circle and Rewards; `P13` Trip Contract; `P14` Money Plan; `P12` Readiness for Each Traveller; `P15` Split Costs; `P16` Pay Your Share; `P17` Price-Drop Watch; `P18` Is This Fare Fair?; `M14` Family Helper; plus settings and help (18 screens, every stage).

## Get to the ship

**Home.** Get to the ship with time to spare.

Six tiles: `H31` Boarding Pass; `H27` Online Check-In; `P30` Getting to the Ship; `M06` Documents; `H25` I'm Delayed; `S26` Emergency Card

**Board** (gold). Check-in, your pass and getting aboard.

`H27` Online Check-In; `H28` Check-In for One Traveller; `H29` What We Have on File; `H30` Check in at the Terminal; `H31` Boarding Pass; `H26` Find My Boarding Pass; `H32` Embarkation Day; `H34` Embarkation Plan; `H36` My Medallion; `H37` Luggage Tags; `S26` Emergency Card

**Travel** (pink). Getting to the ship, on time, and what to do if plans change.

`P29` Getting to the Port; `P30` Getting to the Ship; `P31` Weather by Port; `P32` Storm Watch; `H24` When Something Changes; `H25` I'm Delayed; `H38` Port Entry Rules; `P22` What Happens If; `P33` Away from Home

**Plan** (teal). Book excursions and dining and shape your days.

`P01` Pre-Cruise Checklist; `P02` Packing List; `P03` Packing for This Ship; `P05` Phone Setup Before You Sail; `P07` Health and Comfort; `P35` My Reservations; `P36` Reservation Details; `P37` My Excursions; `P38` Dining Reservations; `P26` Book Ahead; `P24` Saved Items and Basket; `P23` Prepay and Credit; `P25` Room Upgrades; `P47` Your Travel Party; `P48` Family at Home; `C01` Party Chat and Guest Services

**Me** (plum). Your documents and anything still to settle.

`M02` My Trips; `M03` Trip Details; `M06` Documents; `M07` Payments; `M08` Packages; `P13` Trip Contract; `P12` Readiness for Each Traveller; `M14` Family Helper; plus settings and help (18 screens, every stage).

## Embark

**Home.** Welcome aboard. One step at a time.

Six tiles: `H33` Embarkation Companion; `H35` Meeting-Point Card; `S25` Muster Drill; `S01` Deck Map; `S23` Wi-Fi; `S27` Medical Help Now

**Board** (gold). Check-in, your pass and getting aboard.

`H32` Embarkation Day; `H33` Embarkation Companion; `H34` Embarkation Plan; `H35` Meeting-Point Card; `H31` Boarding Pass; `H36` My Medallion; `H37` Luggage Tags; `H29` What We Have on File; `H26` Find My Boarding Pass; `H24` When Something Changes; `H25` I'm Delayed; `S40` Find My Family; `C01` Party Chat and Guest Services; `S25` Muster Drill; `S26` Emergency Card

**Ship** (pink). Everything aboard in one place, including safety.

`S01` Deck Map; `S02` Restaurants and Bars; `S03` Venue Details; `S04` Ship News; `S05` Search the Ship; `S14` Ask the Ship; `S15` Order Food and Drinks; `S19` Dining Favourites and Table; `S20` Laundry and Pressing; `S21` Cabin Requests; `S22` My Stateroom; `S23` Wi-Fi; `S24` Cabin TV; `S25` Muster Drill; `S26` Emergency Card; `S27` Medical Help Now; `S28` Ask for Help by Text; `S29` Report a Security Concern; `S30` Health and Medical Center; `S31` Seasickness First Aid; `S33` Allergy Confidence; `S34` Lost and Found; `S35` Captioned and Signed Shows; `S36` Do Not Disturb

**Plan** (teal). Book excursions and dining and shape your days.

`P35` My Reservations; `P36` Reservation Details; `P37` My Excursions; `P38` Dining Reservations; `P34` Build My Day; `P26` Book Ahead

**Me** (plum). Your account on board: bill, top-up and help.

`M10` My Bill; `M12` Top Up, PIN and Gratuities; `M11` Everything Paid and Charged; `M08` Packages; `M02` My Trips; `M06` Documents; plus settings and help (18 screens, every stage).

## Sea

**Home.** Today on board, and what is next.

Six tiles: `H22` Morning and Evening Briefing; `P38` Dining Reservations; `P34` Build My Day; `S40` Find My Family; `S01` Deck Map; `M11` Everything Paid and Charged

**Today** (teal). Your day on board: events, meals and what is next.

`H22` Morning and Evening Briefing; `P34` Build My Day; `P35` My Reservations; `P36` Reservation Details; `P37` My Excursions; `P38` Dining Reservations; `P39` Autopilot Day; `P40` My Daily Rhythm; `P41` Surprises; `P42` What the App Thinks You Like; `P26` Book Ahead; `S04` Ship News; `H24` When Something Changes; `H25` I'm Delayed; `H39` Getting Off the Ship; `H40` Bag Night; `H41` Final Night Checklist; `H44` Plan Around My Flight; `H45` Getting Home from the Port

**Ship** (pink). Everything aboard in one place, including safety.

`S01` Deck Map; `S02` Restaurants and Bars; `S03` Venue Details; `S04` Ship News; `S05` Search the Ship; `S06` Steps and Deck Laps; `S07` Loungers; `S08` Sightings; `S09` Where Are We; `S10` The Sea Beneath Us; `S11` Along the Way; `S12` Sun, Moon and Stars; `S13` Ship Pulse; `S14` Ask the Ship; `S15` Order Food and Drinks; `S16` Bar Menu and Drinks Tracker; `S17` Shops and Specials; `S18` Spa, Salon and Fitness; `S19` Dining Favourites and Table; `S20` Laundry and Pressing; `S21` Cabin Requests; `S22` My Stateroom; `S23` Wi-Fi; `S24` Cabin TV; `S25` Muster Drill; `S26` Emergency Card; `S27` Medical Help Now; `S28` Ask for Help by Text; `S29` Report a Security Concern; `S30` Health and Medical Center; `S31` Seasickness First Aid; `S33` Allergy Confidence; `S34` Lost and Found; `S35` Captioned and Signed Shows; `S36` Do Not Disturb

**People** (gold). Your family, your group and the community.

`C01` Party Chat and Guest Services; `S40` Find My Family; `S41` Kids' Club Report; `S42` Teen Agreement; `S43` Games; `S44` Services and Meet-Ups; `S45` Solo Safety Timer; `S46` I'm OK Check; `S47` You Said, We Did; `S48` Photos; `S49` Read Aloud; `P27` Kids' and Teens' Clubs; `P47` Your Travel Party; `P43` Organiser and Privacy; `P45` Family Traditions

**Me** (plum). Your bill, your spending and anything to sort out.

`M10` My Bill; `M11` Everything Paid and Charged; `M12` Top Up, PIN and Gratuities; `M08` Packages; `M24` Lost Items, Claims and Complaints; `M02` My Trips; `M06` Documents; plus settings and help (18 screens, every stage).

## Port

**Home.** Your day ashore, and when to be back.

Six tiles: `S37` Port Day; `S38` Port Know-How; `P37` My Excursions; `S32` Safe Ashore for You; `P31` Weather by Port; `S40` Find My Family

**Port** (teal). Your day ashore, with the all-aboard time.

`S37` Port Day; `S38` Port Know-How; `S39` Port Snapshot; `H09` Port Details; `P37` My Excursions; `P44` Ship or Independent; `S32` Safe Ashore for You; `P31` Weather by Port; `H38` Port Entry Rules; `S33` Allergy Confidence; `S45` Solo Safety Timer; `S46` I'm OK Check; `H25` I'm Delayed; `H22` Morning and Evening Briefing; `P34` Build My Day; `P35` My Reservations

**Ship** (pink). Everything aboard in one place, including safety.

`S01` Deck Map; `S02` Restaurants and Bars; `S03` Venue Details; `S04` Ship News; `S05` Search the Ship; `S06` Steps and Deck Laps; `S07` Loungers; `S08` Sightings; `S09` Where Are We; `S10` The Sea Beneath Us; `S11` Along the Way; `S12` Sun, Moon and Stars; `S13` Ship Pulse; `S14` Ask the Ship; `S15` Order Food and Drinks; `S16` Bar Menu and Drinks Tracker; `S17` Shops and Specials; `S18` Spa, Salon and Fitness; `S19` Dining Favourites and Table; `S20` Laundry and Pressing; `S21` Cabin Requests; `S22` My Stateroom; `S23` Wi-Fi; `S24` Cabin TV; `S25` Muster Drill; `S26` Emergency Card; `S27` Medical Help Now; `S28` Ask for Help by Text; `S29` Report a Security Concern; `S30` Health and Medical Center; `S31` Seasickness First Aid; `S33` Allergy Confidence; `S34` Lost and Found; `S35` Captioned and Signed Shows; `S36` Do Not Disturb

**People** (gold). Your family, your group and the community.

`C01` Party Chat and Guest Services; `S40` Find My Family; `S41` Kids' Club Report; `S42` Teen Agreement; `S43` Games; `S44` Services and Meet-Ups; `S45` Solo Safety Timer; `S46` I'm OK Check; `S47` You Said, We Did; `S48` Photos; `S49` Read Aloud; `P27` Kids' and Teens' Clubs; `P47` Your Travel Party; `P43` Organiser and Privacy; `P45` Family Traditions

**Me** (plum). Your bill, your spending and anything to sort out.

`M10` My Bill; `M11` Everything Paid and Charged; `M12` Top Up, PIN and Gratuities; `M08` Packages; `M24` Lost Items, Claims and Complaints; `M02` My Trips; `M06` Documents; plus settings and help (18 screens, every stage).

## Disembark

**Home.** Getting home: your exit, your bags and your bill.

Six tiles: `H39` Getting Off the Ship; `H40` Bag Night; `M13` Final Bill and Receipts; `H43` Customs and Immigration; `H42` Cabin Sweep; `H45` Getting Home from the Port

**Leave** (teal). Everything for leaving the ship.

`H39` Getting Off the Ship; `H40` Bag Night; `H41` Final Night Checklist; `H42` Cabin Sweep; `H43` Customs and Immigration; `H44` Plan Around My Flight; `H45` Getting Home from the Port; `H46` Share a Ride; `M13` Final Bill and Receipts; `M10` My Bill; `S34` Lost and Found

**Ship** (pink). Everything aboard in one place, including safety.

`S01` Deck Map; `S02` Restaurants and Bars; `S15` Order Food and Drinks; `S21` Cabin Requests; `S23` Wi-Fi; `S26` Emergency Card; `S27` Medical Help Now; `S28` Ask for Help by Text; `S30` Health and Medical Center; `S34` Lost and Found

**People** (gold). Your family, your group and the community.

`C01` Party Chat and Guest Services; `S40` Find My Family; `S47` You Said, We Did; `S48` Photos

**Me** (plum). Your final bill, your receipts and goodbye.

`M13` Final Bill and Receipts; `M10` My Bill; `M11` Everything Paid and Charged; `M12` Top Up, PIN and Gratuities; `M20` Three-Tap Farewell; `M24` Lost Items, Claims and Complaints; `M19` Rate Your Cruise; `M02` My Trips; plus settings and help (18 screens, every stage).

## Remember

**Home.** Your trip, and where to next.

Six tiles: `M16` Trip Memories; `M17` Memory Book and Next Trip; `M19` Rate Your Cruise; `M09` Captain's Circle and Rewards; `M15` Trip History and Receipts; `M22` Book Your Next Cruise

**Memories** (teal). Your trip, kept.

`M16` Trip Memories; `M17` Memory Book and Next Trip; `M18` Your Cruise, Wrapped; `S48` Photos; `S47` You Said, We Did; `M15` Trip History and Receipts

**Next** (pink). Where to next.

`M22` Book Your Next Cruise; `H06` The Cruise and Its Route; `H07` Sailing Dates; `H50` Explore by Region and Month; `H08` Sailing Details; `H09` Port Details; `H47` Princess Ships; `H11` Saved Sailings; `H02` Find My Cruise; `H13` Is This Cruise for Me?; `H04` Ask the Concierge; `P28` Gift Ideas; `P04` Occasion Starter; `M09` Captain's Circle and Rewards

**Feedback** (gold). Tell us how it went.

`M19` Rate Your Cruise; `M21` Health Note After the Trip; `M20` Three-Tap Farewell; `M23` Caring for the Sea; `M24` Lost Items, Claims and Complaints

**Me** (plum). Your history, receipts, rewards and settings.

`M15` Trip History and Receipts; `M13` Final Bill and Receipts; `M09` Captain's Circle and Rewards; `M06` Documents; `M02` My Trips; `M03` Trip Details; `P13` Trip Contract; `H20` Booking Confirmed; plus settings and help (18 screens, every stage).

## Outside every stage

`X01` Component Kit; `X03` Following the Trip; `X04` A Trip Shared with You; `X05` Your Account. These are the developer page, two link-only pages and the account page, which opens from the logo in the top bar at every stage.
