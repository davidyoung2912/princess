// Generated from docs/stage-experience-plan.md sections 6 and 8 (P2). Edit the data here; the tests in screens.test.ts keep it honest.
import type { JourneyStage } from './hubs'

/** The content family an ID's letter shows. It does not set the colour; the tab does (plan 5.3). */
export type ScreenFamily = 'H' | 'P' | 'S' | 'C' | 'M' | 'X'

/** One screen of the app. Where it appears, and under which tab, is in {@link STAGE_TABS}, not here. */
export interface ScreenDef {
  id: string
  path: string
  /** Title Case, unique across the app. Moves to the locale files in P3. */
  title: string
  /** One or two sentences that say what the guest can accomplish here. Moves to the locale files in P3. */
  subtext: string
  family: ScreenFamily
}

export type TabColour = 'blue' | 'teal' | 'pink' | 'gold' | 'plum'

export interface StageTab {
  /** One word, shown on the tab. */
  label: string
  colour: TabColour
  subtext: string
  /** Screen IDs under the tab, in priority order. A screen may sit under more than one tab; the first tab that lists it is its primary one. */
  screens: readonly string[]
}

export interface StageDef {
  homeSubtext: string
  /** The six tile destinations on Home, in order (empty-state actions are content, not screens). */
  tiles: readonly string[]
  /** The stage tabs between Home and Me: two or three, most important first. */
  tabs: readonly StageTab[]
  me: { subtext: string; screens: readonly string[] }
}

export const SCREEN_LIST: readonly ScreenDef[] = [
  { id: 'H02', path: '/home/quiz', title: 'Find My Cruise', subtext: 'Answer a few questions about what you love and get a short list of cruises that fit, with the reason behind each pick. This is the quickest way to turn a vague wish into a plan.', family: 'H' },
  { id: 'H03', path: '/home/advisors', title: 'Talk to a Travel Advisor', subtext: 'Ask a travel advisor to call you back, or share your plan so they can see what you have in mind. Use this when you want a person\'s advice before you decide.', family: 'H' },
  { id: 'H04', path: '/home/concierge', title: 'Ask the Concierge', subtext: 'Ask any question about the cruise, the ports and the ship. Answers come only from the app\'s own data, and the screen says plainly that it is AI.', family: 'H' },
  { id: 'H05', path: '/home/ask', title: 'Ask Your Cruise', subtext: 'Ask questions about your own booking, such as dates, what is included and what you owe. Answers come from your trip details, so they are specific to you.', family: 'H' },
  { id: 'H06', path: '/home/cruise', title: '7-Night Western Caribbean with Mexico', subtext: 'See the route, the ports and what a day on board is like. Read this to decide whether this cruise is the kind of trip you want.', family: 'H' },
  { id: 'H07', path: '/home/sailings', title: 'Sailing Dates', subtext: 'Compare every departure, see how soon each one leaves and whether it can still be booked. Pick a date that suits you and your budget.', family: 'H' },
  { id: 'H08', path: '/home/sailings/:id', title: 'Sailing Details', subtext: 'See the dates, ports, season notes and the from-price for one departure. Use this to judge whether this particular sailing is right for you.', family: 'H' },
  { id: 'H09', path: '/home/ports/:id', title: 'Port Details', subtext: 'Learn what to expect at this port, including whether the ship docks or tenders, how long you have and what there is to do. It helps you decide what to do ashore.', family: 'H' },
  { id: 'H10', path: '/home/ship', title: 'Your Ship', subtext: 'See the decks, rooms, dining and entertainment on the ship that sails on your chosen sailing. Read this to picture your trip on board.', family: 'H' },
  { id: 'H11', path: '/home/saved', title: 'Saved Sailings', subtext: 'Keep the sailings you are watching or comparing in one place. Come back to them, compare them and choose the one to look at closely.', family: 'H' },
  { id: 'H12', path: '/home/cruise/cost', title: 'What the Whole Trip Costs', subtext: 'See the real total for the whole trip: fare, taxes, extras, flights and tips. Switch lines on and off so the number matches how you will really travel.', family: 'H' },
  { id: 'H13', path: '/home/decide', title: 'Is This Cruise for Me?', subtext: 'Find out who this cruise suits and who it does not, what you can afford and which common worries are true. It helps you and anyone you travel with decide with confidence.', family: 'H' },
  { id: 'H14', path: '/home/cabins', title: 'Choose Your Cabin', subtext: 'Compare rooms scored for sleep, motion and noise, with the plain reasons behind each score. Pick the room you will be glad to wake up in.', family: 'H' },
  { id: 'H15', path: '/home/offers', title: 'Offers for Your Trip', subtext: 'See deals that apply to this sailing and your booking. Offers are shown after your required tasks, never before.', family: 'H' },
  { id: 'H16', path: '/book', title: 'Book Your Cruise', subtext: 'Choose a room type and the number of guests to see the all-in price. Start your booking from here when you are ready.', family: 'H' },
  { id: 'H17', path: '/book/:id', title: 'Your Booking', subtext: 'Enter travellers, extras and payment details for your booking. Everything is saved after each field, so you can stop and come back without losing anything.', family: 'H' },
  { id: 'H18', path: '/book/resume/:id', title: 'Finish Your Booking', subtext: 'Return to a booking you started and carry on from exactly where you stopped. Nothing you entered is lost.', family: 'H' },
  { id: 'H19', path: '/book/pay/:id', title: 'Pay Your Balance', subtext: 'Pay the balance you owe, in full or just your own share. You see the amount and the date before you confirm.', family: 'H' },
  { id: 'H20', path: '/book/confirmed/:id', title: 'Booking Confirmed', subtext: 'See your confirmation number and the documents to keep. This is the record that your booking exists and what it includes.', family: 'H' },
  { id: 'H21', path: '/home/updates', title: 'Changes to Your Trip', subtext: 'See what has changed on your trip, what it means for you and the options you have. Anything that needs your decision is shown first.', family: 'H' },
  { id: 'H22', path: '/home/briefing', title: 'Morning and Evening Briefing', subtext: 'Read your day on one page: events, reservations, weather and the all-aboard time. Check it in the morning and again in the evening.', family: 'H' },
  { id: 'H23', path: '/home/summary', title: 'Plain-English Summaries', subtext: 'Read your booking, the policies and any changes in plain words. Use this when the official wording is hard to follow.', family: 'H' },
  { id: 'H24', path: '/home/disruption', title: 'When Something Changes', subtext: 'See your options and who to call when plans change, such as a missed flight, a closed port or a late arrival. It tells you what to do next, in order.', family: 'H' },
  { id: 'H25', path: '/home/delayed', title: 'I\'m Delayed', subtext: 'Tell the ship and your group that you are running late. You then see what to do next and how late is too late.', family: 'H' },
  { id: 'H26', path: '/home/find-pass', title: 'Find My Boarding Pass', subtext: 'Get your boarding pass back using your booking number, even if you have lost your phone or never saved it. This keeps you from being stuck at the terminal.', family: 'H' },
  { id: 'H27', path: '/home/check-in', title: 'Online Check-In', subtext: 'Complete check-in for everyone in your party: photo, documents and payment card, one traveller at a time. You can stop and resume at any point.', family: 'H' },
  { id: 'H28', path: '/home/check-in/:id', title: 'Check-In for One Traveller', subtext: 'Finish or fix check-in for one person in your party. Use this when someone\'s photo or document needs another try.', family: 'H' },
  { id: 'H29', path: '/home/check-in/receipt', title: 'What We Have on File', subtext: 'Review everything you submitted at check-in. Use it to confirm the ship has the right details before you arrive.', family: 'H' },
  { id: 'H30', path: '/home/check-in/terminal', title: 'Check in at the Terminal', subtext: 'Learn what to bring and what to expect if you did not finish check-in online. The terminal can complete it, and this screen shows you how.', family: 'H' },
  { id: 'H31', path: '/home/boarding-pass', title: 'Boarding Pass', subtext: 'Show your boarding pass at the terminal, with a copy that works offline and can be printed. It is always one tap away on boarding day.', family: 'H' },
  { id: 'H32', path: '/home/embarkation', title: 'Embarkation Day', subtext: 'See your arrival window, your terminal and the steps for boarding day in order. The goal is a calm morning with no surprises.', family: 'H' },
  { id: 'H33', path: '/home/embarkation/steps', title: 'Embarkation Companion', subtext: 'Follow each step from the terminal to your cabin and tick them off as you go. It tells you what comes next and how long it usually takes.', family: 'H' },
  { id: 'H34', path: '/home/embarkation/plan', title: 'Embarkation Plan', subtext: 'Choose your arrival time, who carries what and where your group meets. Planning this ahead makes boarding day smoother.', family: 'H' },
  { id: 'H35', path: '/home/meeting-point', title: 'Meeting-Point Card', subtext: 'Show where and when your group meets, on a card anyone can read. Share it so nobody has to guess.', family: 'H' },
  { id: 'H36', path: '/home/medallion', title: 'My Medallion', subtext: 'Learn what your wearable medallion does and how to set it up. It opens your door and identifies you on board.', family: 'H' },
  { id: 'H37', path: '/home/luggage', title: 'Luggage Tags', subtext: 'Print or collect your luggage tags and find out when bags reach your door. This avoids lost or late luggage on the first night.', family: 'H' },
  { id: 'H38', path: '/home/clearance', title: 'Port Entry Rules', subtext: 'See the entry, visa and customs rules for each port on your route. Check it before you travel so nothing stops you going ashore.', family: 'H' },
  { id: 'H39', path: '/home/disembark', title: 'Getting Off the Ship', subtext: 'Choose your exit time and see the steps for leaving the ship. This is the starting point for your last morning.', family: 'H' },
  { id: 'H40', path: '/home/disembark/bags', title: 'Bag Night', subtext: 'Tag your bags and learn the hallway deadline so they are collected on time. It tells you when you are done for the night.', family: 'H' },
  { id: 'H41', path: '/home/disembark/final-night', title: 'Final Night Checklist', subtext: 'Work through everything to do before bed on the last night. Tick items off so nothing is left to the morning.', family: 'H' },
  { id: 'H42', path: '/home/disembark/sweep', title: 'Cabin Sweep', subtext: 'Check every drawer, the safe and the bathroom before you leave. It stops you leaving things behind.', family: 'H' },
  { id: 'H43', path: '/home/disembark/customs', title: 'Customs and Immigration', subtext: 'Learn what to declare and how the line works at your port. It helps you get through customs quickly and correctly.', family: 'H' },
  { id: 'H44', path: '/home/disembark/flight', title: 'Plan Around My Flight', subtext: 'Choose an exit time that fits your flight, with a safe margin. It shows the latest you can leave without risk.', family: 'H' },
  { id: 'H45', path: '/home/disembark/onward', title: 'Getting Home from the Port', subtext: 'Find rides, transit and hotels for getting from the ship to home. Pick one and book it before your last morning.', family: 'H' },
  { id: 'H46', path: '/home/disembark/ride', title: 'Share a Ride', subtext: 'Split a taxi or shuttle with other guests heading the same way. It saves money and sorts the ride before you disembark.', family: 'H' },
  { id: 'P01', path: '/plan/checklist', title: 'Pre-Cruise Checklist', subtext: 'See what to do and by when, in order. Tick items off as you go so you always know what is left.', family: 'P' },
  { id: 'P02', path: '/plan/packing', title: 'Packing List', subtext: 'Build a packing list from your trip, the weather and your plans. Tick items as you pack them.', family: 'P' },
  { id: 'P03', path: '/plan/ship-packing', title: 'Packing for This Ship', subtext: 'See what this ship allows, sells and does not allow. Use it so nothing you pack is taken away.', family: 'P' },
  { id: 'P04', path: '/plan/starter', title: 'Occasion Starter', subtext: 'Start your plan from an occasion such as a honeymoon, birthday or remembrance. The wording and suggestions fit the occasion.', family: 'P' },
  { id: 'P05', path: '/plan/phone', title: 'Phone Setup Before You Sail', subtext: 'Set up your phone before you sail so you stay connected without surprise charges. It lists the settings to change and why.', family: 'P' },
  { id: 'P06', path: '/plan/difficulty', title: 'How Hard Is It?', subtext: 'See how much walking, stairs and stamina each activity needs, rated honestly. Choose what suits you and your group.', family: 'P' },
  { id: 'P07', path: '/plan/health-prep', title: 'Health and Comfort', subtext: 'Sort out medication, motion sickness and comfort before you go. It is a short checklist tailored to your trip.', family: 'P' },
  { id: 'P08', path: '/plan/medical', title: 'Medical Card', subtext: 'Record conditions and medication you choose to share with the ship. Only what you enter is shared, and you can remove it any time.', family: 'P' },
  { id: 'P09', path: '/plan/access', title: 'Accessibility Profile', subtext: 'Tell us once what you need, and it follows you through check-in and on board. You never have to repeat it.', family: 'P' },
  { id: 'P10', path: '/plan/assistance', title: 'Special Assistance', subtext: 'Ask for mobility, hearing, vision or other help ahead of time. The ship plans for you before you arrive.', family: 'P' },
  { id: 'P11', path: '/plan/allergy', title: 'Allergy Pre-Flag', subtext: 'Tell the galley about your allergies before you sail. Your request is followed from the kitchen to your table.', family: 'P' },
  { id: 'P12', path: '/plan/readiness', title: 'Readiness for Each Traveller', subtext: 'See documents, payments and forms for each traveller, with one score per person. Fix what is missing before it becomes a problem.', family: 'P' },
  { id: 'P13', path: '/plan/contract', title: 'Trip Contract', subtext: 'Read your terms on one page, in plain words, with large print and read-aloud. It tells you what you have agreed to.', family: 'P' },
  { id: 'P14', path: '/plan/money-plan', title: 'Money Plan', subtext: 'See your deposit, final payment and what is left, by date. It helps you plan your money so nothing is paid late.', family: 'P' },
  { id: 'P15', path: '/plan/split', title: 'Split Costs', subtext: 'Divide the trip between the people paying. Everyone sees their share and what is still owed.', family: 'P' },
  { id: 'P16', path: '/plan/shares', title: 'Pay Your Share', subtext: 'Pay your part of the trip from a link, with no account needed. You see exactly what you are paying for.', family: 'P' },
  { id: 'P17', path: '/plan/price-watch', title: 'Price-Drop Watch', subtext: 'Be told if the price of your sailing falls, and stop watching with one tap. No pressure, just a heads-up.', family: 'P' },
  { id: 'P18', path: '/plan/fare-check', title: 'Is This Fare Fair?', subtext: 'See how your fare compares with what is typical for this sailing. It tells you plainly whether you got a fair price.', family: 'P' },
  { id: 'P19', path: '/plan/guarantee', title: 'Guaranteed-Cabin Odds', subtext: 'See what you are likely to get if you choose a guarantee fare. It helps you decide if the saving is worth not picking a room.', family: 'P' },
  { id: 'P20', path: '/plan/hold', title: 'Hold a Cabin for 48 Hours', subtext: 'Keep a cabin for 48 hours without paying while you decide. The countdown is honest and nothing is charged.', family: 'P' },
  { id: 'P21', path: '/plan/paste', title: 'Paste a Plan', subtext: 'Bring in a plan made elsewhere, such as in an AI assistant, and turn it into an editable draft. You keep what you like and change the rest.', family: 'P' },
  { id: 'P22', path: '/plan/what-if', title: 'What Happens If', subtext: 'See the exact cost of cancelling, changing or missing the ship. Pick a scenario to find out before you commit.', family: 'P' },
  { id: 'P23', path: '/plan/prepay', title: 'Prepay and Credit', subtext: 'Pay for gratuities or on-board credit before you sail. You see what is covered and what it saves.', family: 'P' },
  { id: 'P24', path: '/plan/cart', title: 'Saved Items and Basket', subtext: 'See the excursions and extras you have saved, with the total. Check out when you are ready, or remove what you do not want.', family: 'P' },
  { id: 'P25', path: '/plan/upgrades', title: 'Room Upgrades', subtext: 'See better rooms open to your booking, with the real price difference. Move up only if it is worth it to you.', family: 'P' },
  { id: 'P26', path: '/plan/ahead', title: 'Book Ahead', subtext: 'Reserve shows, dining and treats before you board. Booking early gets the times you want.', family: 'P' },
  { id: 'P27', path: '/plan/clubs', title: 'Kids\' and Teens\' Clubs', subtext: 'See ages, hours and sign-up for the kids\' and teens\' clubs. Register your child so they can join from the first day.', family: 'P' },
  { id: 'P28', path: '/plan/gifts', title: 'Gift Ideas', subtext: 'Find gifts to send to a cabin, or ideas for your next trip. It is for planning ahead, and nothing is bought without your say.', family: 'P' },
  { id: 'P29', path: '/plan/travel', title: 'Getting to the Port', subtext: 'Plan flights, hotels and the day before you sail. It shows how early to arrive so you do not miss the ship.', family: 'P' },
  { id: 'P30', path: '/plan/getting-there', title: 'Getting to the Ship', subtext: 'See your door-to-ship timeline and whether you are on track or at risk. It tells you when to leave and what to do if you slip.', family: 'P' },
  { id: 'P31', path: '/plan/weather', title: 'Weather by Port', subtext: 'See what the weather will be in each port on your dates. Use it to pack and to plan your days ashore.', family: 'P' },
  { id: 'P32', path: '/plan/storm', title: 'Storm Watch', subtext: 'Get alerts and see your options if a storm threatens your sailing. It tells you what is happening and what happens next.', family: 'P' },
  { id: 'P33', path: '/plan/away', title: 'Away from Home', subtext: 'Make sure home is looked after while you are away. A short list covers mail, pets, security and who to call.', family: 'P' },
  { id: 'P34', path: '/plan/day', title: 'Build My Day', subtext: 'Pick the events and meals that fit your day. The plan adjusts when you change something.', family: 'P' },
  { id: 'P35', path: '/plan/reservations', title: 'My Reservations', subtext: 'See the dining, shows and spa you have booked. Open any one to change or cancel it.', family: 'P' },
  { id: 'P36', path: '/plan/reservations/:id', title: 'Reservation Details', subtext: 'See the time and place of one reservation and how to change or cancel it. Everything you need for that booking is here.', family: 'P' },
  { id: 'P37', path: '/plan/excursions', title: 'My Excursions', subtext: 'See the shore trips you have booked, with honest difficulty, duration and the all-aboard time. Choose ones that fit you and get back on time.', family: 'P' },
  { id: 'P38', path: '/plan/dining', title: 'Dining Reservations', subtext: 'Find a table and book it. You see what is available before you decide.', family: 'P' },
  { id: 'P39', path: '/plan/autopilot', title: 'Autopilot Day', subtext: 'Let the app suggest a whole day based on what you like. Accept it, tweak it or ignore it.', family: 'P' },
  { id: 'P40', path: '/plan/rhythm', title: 'My Daily Rhythm', subtext: 'Set the pace of your days, whether you are an early bird or a night owl. Suggestions then match your rhythm.', family: 'P' },
  { id: 'P41', path: '/plan/surprises', title: 'Surprises', subtext: 'Turn on small, unplanned treats, or turn them off. You decide how many surprises you want.', family: 'P' },
  { id: 'P42', path: '/plan/taste', title: 'What the App Thinks You Like', subtext: 'See, correct or clear what the app has inferred about your tastes. You are always in control of what it knows.', family: 'P' },
  { id: 'P43', path: '/plan/organiser', title: 'Organiser and Privacy', subtext: 'Choose who in your group can see and change your plans. Privacy is set by you.', family: 'P' },
  { id: 'P44', path: '/plan/compare', title: 'Ship or Independent', subtext: 'Compare doing a port yourself with taking the ship\'s tour. See the cost, the risk and the time on each side.', family: 'P' },
  { id: 'P45', path: '/plan/traditions', title: 'Family Traditions', subtext: 'Note the family rituals you want to keep on every trip. They show up in your plans as reminders.', family: 'P' },
  { id: 'P46', path: '/plan/cabins', title: 'Several Cabins, One Day', subtext: 'Plan one day for a group spread across several rooms. Everyone sees where to meet and when.', family: 'P' },
  { id: 'P47', path: '/plan/party', title: 'Your Travel Party', subtext: 'Record who is going, their ages and their needs. Everything else in the trip is built from this list.', family: 'P' },
  { id: 'P48', path: '/plan/family-link', title: 'Family at Home', subtext: 'Let someone at home follow your trip with a read-only view. They can see where you are without needing the app.', family: 'P' },
  { id: 'P49', path: '/plan/group-poll', title: 'Group Poll and Dream Board', subtext: 'Vote and heart ideas together, one vote each. It helps a group decide without a long chat thread.', family: 'P' },
  { id: 'P50', path: '/plan/share-links', title: 'Links for Someone at Home or Your Advisor', subtext: 'Create read-only links to share your plan with someone at home or your advisor. You can turn a link off at any time.', family: 'P' },
  { id: 'P51', path: '/plan/child-story', title: 'Trip Story for a Child', subtext: 'Read a short story that tells a child what is coming. It makes the trip less scary and more exciting.', family: 'P' },
  { id: 'P52', path: '/plan/child-brief', title: 'Child Brief', subtext: 'Fill in one page about your child for the kids\' club. Staff then know what they need to know, and you do not repeat it.', family: 'P' },
  { id: 'S01', path: '/ship/map', title: 'Deck Map', subtext: 'Find any venue, lift or stairway on any deck. Use it to get from A to B without asking.', family: 'S' },
  { id: 'S02', path: '/ship/venues', title: 'Restaurants and Bars', subtext: 'See every place to eat and drink, with hours and what is included. Choose where to go next.', family: 'S' },
  { id: 'S03', path: '/ship/venues/:id', title: 'Venue Details', subtext: 'See the menu, hours, price and how to reserve one venue. Book a table from here.', family: 'S' },
  { id: 'S04', path: '/ship/info', title: 'Ship News', subtext: 'Read today\'s notices and changes from the ship. Check it so you do not miss anything that affects you.', family: 'S' },
  { id: 'S05', path: '/ship/search', title: 'Search the Ship', subtext: 'Find a venue, an event or a service by name. It searches only what is on this ship.', family: 'S' },
  { id: 'S06', path: '/ship/steps', title: 'Steps and Deck Laps', subtext: 'Count your steps and your laps around the deck. Set a goal and see your progress.', family: 'S' },
  { id: 'S07', path: '/ship/loungers', title: 'Loungers', subtext: 'See where loungers are free and save one. It saves wandering the decks in the heat.', family: 'S' },
  { id: 'S08', path: '/ship/sightings', title: 'Sightings', subtext: 'See wildlife and landmarks spotted from the ship. Add your own sightings for others.', family: 'S' },
  { id: 'S09', path: '/ship/where', title: 'Where Are We', subtext: 'See your position, speed and the next port. It answers "where are we?" at a glance.', family: 'S' },
  { id: 'S10', path: '/ship/sea', title: 'The Sea Beneath Us', subtext: 'See depth, water and weather around the ship. It turns the sea outside into something you can understand.', family: 'S' },
  { id: 'S11', path: '/ship/along', title: 'Along the Way', subtext: 'See what you are passing, as you pass it. Look up from the screen at the right time.', family: 'S' },
  { id: 'S12', path: '/ship/sky', title: 'Sun, Moon and Stars', subtext: 'See what is in the sky tonight from where you are. It tells you when and where to look.', family: 'S' },
  { id: 'S13', path: '/ship/pulse', title: 'Ship Pulse', subtext: 'See how busy the ship is right now, with the age of each figure. Pick a quiet time or place.', family: 'S' },
  { id: 'S14', path: '/ship/ask-ship', title: 'Ask the Ship', subtext: 'Ask quick questions about the ship and get answers from ship data. It does not guess, and it says when it does not know.', family: 'S' },
  { id: 'S15', path: '/ship/order', title: 'Order Food and Drinks', subtext: 'Order food and drinks to your cabin or your seat and see the cost first. Follow the order until it arrives.', family: 'S' },
  { id: 'S16', path: '/ship/drinks', title: 'Bar Menu and Drinks Tracker', subtext: 'See the bar menu and track what you have had against your package. It shows whether the package is paying off.', family: 'S' },
  { id: 'S17', path: '/ship/shops', title: 'Shops and Specials', subtext: 'See what the shops are selling today. Browse specials without leaving your deck.', family: 'S' },
  { id: 'S18', path: '/ship/spa', title: 'Spa, Salon and Fitness', subtext: 'See treatments, classes and open times. Book a slot that fits your day.', family: 'S' },
  { id: 'S19', path: '/ship/dining-prefs', title: 'Dining Favourites and Table', subtext: 'Set your table, favourite venues and dietary needs. Dining then works the way you like.', family: 'S' },
  { id: 'S20', path: '/ship/laundry', title: 'Laundry and Pressing', subtext: 'See prices, drop-off and pick-up for laundry and pressing. Plan it so clothes are back when you need them.', family: 'S' },
  { id: 'S21', path: '/ship/requests', title: 'Cabin Requests', subtext: 'Ask your steward for something and follow the request until it is done. Nothing gets lost.', family: 'S' },
  { id: 'S22', path: '/ship/room', title: 'My Stateroom', subtext: 'See your cabin\'s details, controls and what is in it. Use it to set up your room the way you like.', family: 'S' },
  { id: 'S23', path: '/ship/wifi', title: 'Wi-Fi', subtext: 'See plans, prices and how to connect to Wi-Fi. Pick the plan that suits how you will use it.', family: 'S' },
  { id: 'S24', path: '/ship/tv', title: 'Cabin TV', subtext: 'See what is on and how to use your TV. Find shows without searching a remote.', family: 'S' },
  { id: 'S25', path: '/ship/muster', title: 'Muster Drill', subtext: 'Find your muster station and learn how the drill works. Do this before the drill so you are not rushed.', family: 'S' },
  { id: 'S26', path: '/ship/emergency', title: 'Emergency Card', subtext: 'See what to do in an emergency, readable offline. It is always available, whatever your connection.', family: 'S' },
  { id: 'S27', path: '/ship/help-now', title: 'Medical Help Now', subtext: 'Reach the medical centre or call for urgent help right now. It gives you the number and the steps.', family: 'S' },
  { id: 'S28', path: '/ship/text-help', title: 'Ask for Help by Text', subtext: 'Ask for help by text when you cannot call. Someone replies and tells you what is happening.', family: 'S' },
  { id: 'S29', path: '/ship/report', title: 'Report a Security Concern', subtext: 'Tell the ship\'s security team about a concern, privately. You decide whether to give your name.', family: 'S' },
  { id: 'S30', path: '/ship/health', title: 'Health and Medical Center', subtext: 'See the Medical Center\'s hours, prices and what it can treat. Know before you need it.', family: 'S' },
  { id: 'S31', path: '/ship/seasick', title: 'Seasickness First Aid', subtext: 'Learn what helps with seasickness and when to see a doctor. Quick steps you can follow straight away.', family: 'S' },
  { id: 'S32', path: '/ship/safe-ashore', title: 'Safe Ashore for You', subtext: 'See tips and warnings for the port you are visiting. Stay safe and enjoy the day.', family: 'S' },
  { id: 'S33', path: '/ship/allergy-chain', title: 'Allergy Confidence', subtext: 'Follow your allergy flag from the galley to your table. It shows who knows and who confirmed.', family: 'S' },
  { id: 'S34', path: '/ship/lost-found', title: 'Lost and Found', subtext: 'Report a lost item or see whether one has been found. Follow it through to the end.', family: 'S' },
  { id: 'S35', path: '/ship/access', title: 'Captioned and Signed Shows', subtext: 'Find shows with captions or sign language. Pick one you can follow.', family: 'S' },
  { id: 'S36', path: '/ship/dnd', title: 'Do Not Disturb', subtext: 'Set quiet hours for your cabin. Your steward and the ship respect them.', family: 'S' },
  { id: 'S37', path: '/ship/port', title: 'Port Day', subtext: 'See the all-aboard time on three clocks and when you need to head back to the ship. It keeps a day ashore relaxed and gets you back on time.', family: 'S' },
  { id: 'S38', path: '/ship/port/guide', title: 'Port Know-How', subtext: 'Learn what to know before you step ashore. It covers money, language, tenders and local advice.', family: 'S' },
  { id: 'S39', path: '/ship/port/snapshot', title: 'Port Snapshot', subtext: 'See the port on one page: weather, distances and time. A quick check before you go.', family: 'S' },
  { id: 'C01', path: '/chat', title: 'Party Chat and Guest Services', subtext: 'Chat with your group or with Guest Services. The phone number is always shown in case you need a person.', family: 'C' },
  { id: 'S40', path: '/ship/family', title: 'Find My Family', subtext: 'See where family members have chosen to share their location. It helps you meet up without a search.', family: 'S' },
  { id: 'S41', path: '/ship/kids-report', title: 'Kids\' Club Report', subtext: 'See how your child\'s day went at the kids\' club. It tells you what they did and who they met.', family: 'S' },
  { id: 'S42', path: '/ship/teen', title: 'Teen Agreement', subtext: 'Set what your teen can do on their own, agreed together. Both of you see the same rules.', family: 'S' },
  { id: 'S43', path: '/ship/games', title: 'Games', subtext: 'Play games with your group. Pick one that suits everyone.', family: 'S' },
  { id: 'S44', path: '/ship/community', title: 'Services and Meet-Ups', subtext: 'Find services, worship and meet-ups for guests like you. Join one, or just see what is on.', family: 'S' },
  { id: 'S45', path: '/ship/solo', title: 'Solo Safety Timer', subtext: 'Set a timer and tell someone if you do not check in. It is a safety net for time on your own.', family: 'S' },
  { id: 'S46', path: '/ship/ok-tap', title: 'I\'m OK Check', subtext: 'Tell your group you are fine with one tap. It saves a worried search.', family: 'S' },
  { id: 'S47', path: '/ship/you-said', title: 'You Said, We Did', subtext: 'See what guests asked for and what the ship changed as a result. Add your own idea.', family: 'S' },
  { id: 'S48', path: '/ship/photos', title: 'Photos', subtext: 'View, choose and buy your photos from the ship. Nothing is bought until you confirm.', family: 'S' },
  { id: 'S49', path: '/ship/read-aloud', title: 'Read Aloud', subtext: 'Have any screen read to you. Useful if your eyes are tired or reading is hard.', family: 'S' },
  { id: 'M02', path: '/me/trips', title: 'My Trips', subtext: 'See all your bookings in one place, with the next step for each. Open one to see everything about it.', family: 'M' },
  { id: 'M03', path: '/me/trips/:id', title: 'Trip Details', subtext: 'See everything about one booking and what to do next. Payments, documents and changes are all here.', family: 'M' },
  { id: 'M04', path: '/me/profile', title: 'My Details', subtext: 'Check and update your name, contact details and what we hold about you. Correct anything that is wrong.', family: 'M' },
  { id: 'M05', path: '/me/profile/:id', title: 'Traveller Details', subtext: 'See one traveller\'s name, documents and needs. Keep it right so check-in works.', family: 'M' },
  { id: 'M06', path: '/me/documents', title: 'Documents', subtext: 'See what each traveller needs, and what is missing or about to expire. Fix gaps early.', family: 'M' },
  { id: 'M07', path: '/me/payments', title: 'Payments', subtext: 'See your cards, the payments you have made and what is due. Add or change a card here.', family: 'M' },
  { id: 'M08', path: '/me/packages', title: 'Packages', subtext: 'See drinks, Wi-Fi and dining packages and whether they are worth it for you. Add or remove one.', family: 'M' },
  { id: 'M09', path: '/me/loyalty', title: 'Captain\'s Circle and Rewards', subtext: 'See your Captain\'s Circle status, the next tier and what each benefit is worth. Everything is in plain words, so you know what you actually get.', family: 'M' },
  { id: 'M10', path: '/me/bill', title: 'My Bill', subtext: 'See what you have charged so far on board. Check it as you go so there are no surprises.', family: 'M' },
  { id: 'M11', path: '/me/ledger', title: 'Everything Paid and Charged', subtext: 'See every payment and charge in date order. Use it to find anything that does not look right.', family: 'M' },
  { id: 'M12', path: '/me/money', title: 'Top Up, PIN and Gratuities', subtext: 'Add credit, set your PIN and adjust gratuities. Manage your on-board money from one screen.', family: 'M' },
  { id: 'M13', path: '/me/bill/final', title: 'Final Bill and Receipts', subtext: 'See your bill line by line, with receipts and a way to question a charge. Check it before you leave.', family: 'M' },
  { id: 'M14', path: '/me/helper', title: 'Family Helper', subtext: 'Let someone you trust help with your trip. They can see and do only what you allow.', family: 'M' },
  { id: 'M15', path: '/me/history', title: 'Trip History and Receipts', subtext: 'See every trip you have taken, with receipts that never vanish. Come back any time.', family: 'M' },
  { id: 'M16', path: '/me/recap', title: 'Trip Memories', subtext: 'See a recap of where you went and what you did. It is made from your own trip.', family: 'M' },
  { id: 'M17', path: '/me/memories', title: 'Memory Book and Next Trip', subtext: 'Keep your memory book and see ideas for your next trip. Print it or keep it offline.', family: 'M' },
  { id: 'M18', path: '/me/wrapped', title: 'Your Cruise, Wrapped', subtext: 'See your trip in numbers and moments. Share it if you like.', family: 'M' },
  { id: 'M19', path: '/me/feedback', title: 'Rate Your Cruise', subtext: 'Tell us how your cruise went. A person reads it, and we follow up if you want.', family: 'M' },
  { id: 'M20', path: '/me/farewell', title: 'Three-Tap Farewell', subtext: 'Say goodbye and settle the last things in three taps. It is the quickest way to finish well.', family: 'M' },
  { id: 'M21', path: '/me/follow-up', title: 'Health Note After the Trip', subtext: 'Tell us how you are if you were unwell. We follow up if you need us.', family: 'M' },
  { id: 'M22', path: '/me/rebook', title: 'Book Your Next Cruise', subtext: 'Pick up your next trip from where you left off. Your details and preferences carry over.', family: 'M' },
  { id: 'M23', path: '/me/sustainability', title: 'Caring for the Sea', subtext: 'See what this trip\'s footprint was and what we do about it. Choose what matters to you.', family: 'M' },
  { id: 'M24', path: '/me/cases', title: 'Lost Items, Claims and Complaints', subtext: 'Follow anything you have reported, to the end. Lost items, claims and complaints are all here.', family: 'M' },
  { id: 'M25', path: '/me/privacy', title: 'Privacy and Data', subtext: 'See, export or delete what we hold about you. You decide what we keep.', family: 'M' },
  { id: 'M26', path: '/me/marketing', title: 'Offers and News', subtext: 'Choose what we send you, if anything. Turn offers and news on or off.', family: 'M' },
  { id: 'M27', path: '/me/print', title: 'Paper Copies', subtext: 'Print what you need if your phone is not enough. Paper copies of your pass, plan and key details.', family: 'M' },
  { id: 'M28', path: '/me/notifications', title: 'Notifications', subtext: 'Choose what we tell you, and when. Critical alerts always come through.', family: 'M' },
  { id: 'M29', path: '/me/alerts', title: 'Visual and Vibration Alerts', subtext: 'Get alerts through light and vibration instead of sound. Useful if you cannot hear or need quiet.', family: 'M' },
  { id: 'M30', path: '/me/calm', title: 'Calm and Inclusion', subtext: 'Switch to quieter screens and simpler wording. It reduces noise and clutter.', family: 'M' },
  { id: 'M31', path: '/me/gentle', title: 'Travelling After a Loss', subtext: 'Use a gentler way through the app after a loss. It avoids cheerful wording and sudden reminders.', family: 'M' },
  { id: 'M32', path: '/me/anxiety', title: 'Feeling Anxious', subtext: 'See things that help when you feel anxious and switch on a calm mode. A short guide to what to expect.', family: 'M' },
  { id: 'M33', path: '/me/settings', title: 'Settings', subtext: 'Set text size, language, contrast and motion. Make the app comfortable for you.', family: 'M' },
  { id: 'M34', path: '/me/activity', title: 'My Activity', subtext: 'See what you have done in the app. Check or clear it.', family: 'M' },
  { id: 'M35', path: '/me/help', title: 'Help Centre', subtext: 'Find answers to common questions. Search or browse by topic.', family: 'M' },
  { id: 'M36', path: '/me/contact', title: 'Contact Us', subtext: 'See phone, chat and email options, with hours. Reach a person when you need one.', family: 'M' },
  { id: 'M37', path: '/me/fix-it', title: 'Fix a Problem', subtext: 'Follow step-by-step fixes for common problems. Most can be solved without calling.', family: 'M' },
  { id: 'M38', path: '/me/assist', title: 'Extra Help and Cancelling Kindly', subtext: 'Get extra help, and learn how to cancel without a fight. A kind, plain path through hard moments.', family: 'M' },
  { id: 'M39', path: '/me/status', title: 'System Status', subtext: 'See whether everything is working. Check here before you report a problem.', family: 'M' },
  { id: 'M40', path: '/me/report-problem', title: 'Report a Problem', subtext: 'Tell us what went wrong. We follow it until it is fixed.', family: 'M' },
  { id: 'M41', path: '/me/demo', title: 'Demo Controls', subtext: 'Change the date, ship and scenario on a test account. It is only for demo accounts.', family: 'M' },
  { id: 'X01', path: '/kit', title: 'Component Kit', subtext: 'A developer page showing the app\'s components. It is not part of the guest app.', family: 'X' },
  { id: 'X02', path: '/trial-day', title: 'A Day on This Ship', subtext: 'Try a five-minute taste of a day on board, with no sign-in. See what your Tuesday could look like.', family: 'X' },
  { id: 'X03', path: '/at-sea/:token', title: 'Following the Trip', subtext: 'Follow someone\'s trip, read-only, from a link they sent you. No account is needed.', family: 'X' },
  { id: 'X04', path: '/shared/:token', title: 'A Trip Shared with You', subtext: 'See a trip a friend or an advisor has shared with you. Open it and comment without signing up.', family: 'X' },
]

/** Settings and help: the same group under Me at every stage, and always plum. */
export const SETTINGS_AND_HELP: readonly string[] = ['M04', 'M33', 'M28', 'M25', 'M26', 'M35', 'M36', 'M30', 'M31', 'M32', 'M29', 'M27', 'M34', 'M37', 'M38', 'M39', 'M40', 'M41']

/** The four tab front pages, which become the tab landing pages (plan section 7). */
export const TAB_FRONT_PATHS: readonly string[] = ['/', '/plan', '/ship', '/chat', '/me']

export const STAGE_TABS: Record<JourneyStage, StageDef> = {
  dream: {
    homeSubtext: 'Let\'s find a cruise you\'ll love. Start with the quiz.',
    tiles: ['H02', 'H13', 'H07', 'H04', 'P49', 'H11'],
    tabs: [
      { label: 'Explore', colour: 'teal', subtext: 'Browse the cruise, the sailings and the ports.', screens: ['H06', 'H07', 'H08', 'H09', 'H11', 'P04', 'X02'] },
      { label: 'Ask', colour: 'pink', subtext: 'Get answers and advice before you decide.', screens: ['H04', 'H03', 'H02', 'H13', 'P21', 'P49', 'P50'] },
    ],
    me: { subtext: 'Your details and the sailings you have saved.', screens: ['H11', ...SETTINGS_AND_HELP] },
  },
  discover: {
    homeSubtext: 'Your sailing, its real cost and your room, in one place.',
    tiles: ['H08', 'H12', 'H14', 'H10', 'H11', 'H03'],
    tabs: [
      { label: 'Sailing', colour: 'teal', subtext: 'Everything about the sailing you are considering.', screens: ['H08', 'H07', 'H09', 'H06', 'H10', 'S01', 'S02', 'S03', 'H13', 'X02'] },
      { label: 'Cabin', colour: 'pink', subtext: 'Pick the room that suits you.', screens: ['H14', 'P19', 'H13'] },
      { label: 'Cost', colour: 'gold', subtext: 'The real, all-in price, and ways to pay less.', screens: ['H12', 'H15', 'P17', 'P18', 'H16', 'H03', 'H04'] },
    ],
    me: { subtext: 'Your saved sailings, price watches and details.', screens: ['H11', 'P17', ...SETTINGS_AND_HELP] },
  },
  book: {
    homeSubtext: 'Finish booking. Nothing is lost if you stop.',
    tiles: ['H18', 'H17', 'P47', 'P15', 'P22', 'P13'],
    tabs: [
      { label: 'Booking', colour: 'teal', subtext: 'Your booking, from price to confirmation.', screens: ['H16', 'H17', 'H18', 'H20', 'P13', 'P22', 'P20', 'P19', 'H08', 'H12', 'H14', 'H15', 'H10'] },
      { label: 'Travellers', colour: 'pink', subtext: 'Who is going, and what each person needs.', screens: ['P47', 'M05', 'P09', 'P10', 'P11', 'P46'] },
      { label: 'Pay', colour: 'gold', subtext: 'Deposit, balance and sharing the cost.', screens: ['H19', 'P14', 'P15', 'P16', 'M07'] },
    ],
    me: { subtext: 'Your draft, payments and travellers\' details.', screens: ['M02', 'M07', 'P13', ...SETTINGS_AND_HELP] },
  },
  manage: {
    homeSubtext: 'Your booking is confirmed. Here is what needs you next.',
    tiles: ['P14', 'M06', 'P12', 'H21', 'H10', 'P09'],
    tabs: [
      { label: 'Trip', colour: 'teal', subtext: 'Your confirmed trip, and what changes.', screens: ['M02', 'M03', 'H20', 'H21', 'H23', 'H05', 'H08', 'H09', 'H10', 'S01', 'S02', 'S03', 'P01', 'P13', 'P14'] },
      { label: 'Needs', colour: 'pink', subtext: 'Documents, health and access for every traveller.', screens: ['M06', 'M05', 'P12', 'P08', 'P09', 'P10', 'P11', 'P07', 'H38'] },
      { label: 'Group', colour: 'gold', subtext: 'Your travel party and the people at home.', screens: ['C01', 'P47', 'P48', 'P49', 'P50', 'P43', 'P46', 'P51', 'P52', 'M14'] },
    ],
    me: { subtext: 'Payments, documents and what is due.', screens: ['M02', 'M03', 'M06', 'M07', 'M09', 'P13', 'P14', 'P12', 'P15', 'P16', 'P17', 'P18', 'M14', ...SETTINGS_AND_HELP] },
  },
  prebook: {
    homeSubtext: 'Shape your days before you sail.',
    tiles: ['P37', 'P38', 'M08', 'P02', 'P01', 'P47'],
    tabs: [
      { label: 'Plan', colour: 'teal', subtext: 'Book excursions and dining and shape your days.', screens: ['P37', 'P38', 'P35', 'P36', 'P26', 'P27', 'P24', 'P23', 'P25', 'P28', 'P34', 'P39', 'P40', 'P41', 'P42', 'P44', 'P45', 'P06', 'S18', 'S19', 'S38', 'H09'] },
      { label: 'Prepare', colour: 'pink', subtext: 'Pack, travel and sort things at home.', screens: ['P01', 'P02', 'P03', 'P05', 'P07', 'P29', 'P31', 'P33', 'H38', 'H24'] },
      { label: 'Group', colour: 'gold', subtext: 'Your travel party and the people at home.', screens: ['C01', 'P47', 'P48', 'P49', 'P50', 'P43', 'P46', 'P51', 'P52', 'M14'] },
    ],
    me: { subtext: 'Payments, documents, packages and rewards.', screens: ['M02', 'M03', 'M06', 'M07', 'M08', 'M09', 'P13', 'P14', 'P12', 'P15', 'P16', 'P17', 'P18', 'M14', ...SETTINGS_AND_HELP] },
  },
  getToShip: {
    homeSubtext: 'Get to the ship with time to spare.',
    tiles: ['H31', 'H27', 'P30', 'M06', 'H25', 'S26'],
    tabs: [
      { label: 'Board', colour: 'gold', subtext: 'Check-in, your pass and getting aboard.', screens: ['H27', 'H28', 'H29', 'H30', 'H31', 'H26', 'H32', 'H34', 'H36', 'H37', 'S26'] },
      { label: 'Travel', colour: 'pink', subtext: 'Getting to the ship, on time, and what to do if plans change.', screens: ['P29', 'P30', 'P31', 'P32', 'H24', 'H25', 'H38', 'P22', 'P33'] },
      { label: 'Plan', colour: 'teal', subtext: 'Book excursions and dining and shape your days.', screens: ['P01', 'P02', 'P03', 'P05', 'P07', 'P35', 'P36', 'P37', 'P38', 'P26', 'P24', 'P23', 'P25', 'P47', 'P48', 'C01'] },
    ],
    me: { subtext: 'Your documents and anything still to settle.', screens: ['M02', 'M03', 'M06', 'M07', 'M08', 'P13', 'P12', 'M14', ...SETTINGS_AND_HELP] },
  },
  embark: {
    homeSubtext: 'Welcome aboard. One step at a time.',
    tiles: ['H33', 'H35', 'S25', 'S01', 'S23', 'S27'],
    tabs: [
      { label: 'Board', colour: 'gold', subtext: 'Check-in, your pass and getting aboard.', screens: ['H32', 'H33', 'H34', 'H35', 'H31', 'H36', 'H37', 'H29', 'H26', 'H24', 'H25', 'S40', 'C01', 'S25', 'S26'] },
      { label: 'Ship', colour: 'pink', subtext: 'Everything aboard in one place, including safety.', screens: ['S01', 'S02', 'S03', 'S04', 'S05', 'S14', 'S15', 'S19', 'S20', 'S21', 'S22', 'S23', 'S24', 'S25', 'S26', 'S27', 'S28', 'S29', 'S30', 'S31', 'S33', 'S34', 'S35', 'S36'] },
      { label: 'Plan', colour: 'teal', subtext: 'Book excursions and dining and shape your days.', screens: ['P35', 'P36', 'P37', 'P38', 'P34', 'P26'] },
    ],
    me: { subtext: 'Your account on board: bill, top-up and help.', screens: ['M10', 'M12', 'M11', 'M08', 'M02', 'M06', ...SETTINGS_AND_HELP] },
  },
  sea: {
    homeSubtext: 'Today on board, and what is next.',
    tiles: ['H22', 'P38', 'P34', 'S40', 'S01', 'M11'],
    tabs: [
      { label: 'Today', colour: 'teal', subtext: 'Your day on board: events, meals and what is next.', screens: ['H22', 'P34', 'P35', 'P36', 'P37', 'P38', 'P39', 'P40', 'P41', 'P42', 'P26', 'S04', 'H24', 'H25', 'H39', 'H40', 'H41', 'H44', 'H45'] },
      { label: 'Ship', colour: 'pink', subtext: 'Everything aboard in one place, including safety.', screens: ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21', 'S22', 'S23', 'S24', 'S25', 'S26', 'S27', 'S28', 'S29', 'S30', 'S31', 'S33', 'S34', 'S35', 'S36'] },
      { label: 'People', colour: 'gold', subtext: 'Your family, your group and the community.', screens: ['C01', 'S40', 'S41', 'S42', 'S43', 'S44', 'S45', 'S46', 'S47', 'S48', 'S49', 'P27', 'P47', 'P43', 'P45'] },
    ],
    me: { subtext: 'Your bill, your spending and anything to sort out.', screens: ['M10', 'M11', 'M12', 'M08', 'M24', 'M02', 'M06', ...SETTINGS_AND_HELP] },
  },
  port: {
    homeSubtext: 'Your day ashore, and when to be back.',
    tiles: ['S37', 'S38', 'P37', 'S32', 'P31', 'S40'],
    tabs: [
      { label: 'Port', colour: 'teal', subtext: 'Your day ashore, with the all-aboard time.', screens: ['S37', 'S38', 'S39', 'H09', 'P37', 'P44', 'S32', 'P31', 'H38', 'S33', 'S45', 'S46', 'H25', 'H22', 'P34', 'P35'] },
      { label: 'Ship', colour: 'pink', subtext: 'Everything aboard in one place, including safety.', screens: ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21', 'S22', 'S23', 'S24', 'S25', 'S26', 'S27', 'S28', 'S29', 'S30', 'S31', 'S33', 'S34', 'S35', 'S36'] },
      { label: 'People', colour: 'gold', subtext: 'Your family, your group and the community.', screens: ['C01', 'S40', 'S41', 'S42', 'S43', 'S44', 'S45', 'S46', 'S47', 'S48', 'S49', 'P27', 'P47', 'P43', 'P45'] },
    ],
    me: { subtext: 'Your bill, your spending and anything to sort out.', screens: ['M10', 'M11', 'M12', 'M08', 'M24', 'M02', 'M06', ...SETTINGS_AND_HELP] },
  },
  disembark: {
    homeSubtext: 'Getting home: your exit, your bags and your bill.',
    tiles: ['H39', 'H40', 'M13', 'H43', 'H42', 'H45'],
    tabs: [
      { label: 'Leave', colour: 'teal', subtext: 'Everything for leaving the ship.', screens: ['H39', 'H40', 'H41', 'H42', 'H43', 'H44', 'H45', 'H46', 'M13', 'M10', 'S34'] },
      { label: 'Ship', colour: 'pink', subtext: 'Everything aboard in one place, including safety.', screens: ['S01', 'S02', 'S15', 'S21', 'S23', 'S26', 'S27', 'S28', 'S30', 'S34'] },
      { label: 'People', colour: 'gold', subtext: 'Your family, your group and the community.', screens: ['C01', 'S40', 'S47', 'S48'] },
    ],
    me: { subtext: 'Your final bill, your receipts and goodbye.', screens: ['M13', 'M10', 'M11', 'M12', 'M20', 'M24', 'M19', 'M02', ...SETTINGS_AND_HELP] },
  },
  remember: {
    homeSubtext: 'Your trip, and where to next.',
    tiles: ['M16', 'M17', 'M19', 'M09', 'M15', 'M22'],
    tabs: [
      { label: 'Memories', colour: 'teal', subtext: 'Your trip, kept.', screens: ['M16', 'M17', 'M18', 'S48', 'S47', 'M15'] },
      { label: 'Next', colour: 'pink', subtext: 'Where to next.', screens: ['M22', 'H06', 'H07', 'H08', 'H09', 'H11', 'H02', 'H13', 'H04', 'P28', 'P04', 'M09'] },
      { label: 'Feedback', colour: 'gold', subtext: 'Tell us how it went.', screens: ['M19', 'M21', 'M20', 'M23', 'M24'] },
    ],
    me: { subtext: 'Your history, receipts, rewards and settings.', screens: ['M15', 'M13', 'M09', 'M06', 'M02', 'M03', 'P13', 'H20', ...SETTINGS_AND_HELP] },
  },
}

export const SCREEN_BY_ID: ReadonlyMap<string, ScreenDef> = new Map(SCREEN_LIST.map((s) => [s.id, s]))
const BY_PATH: ReadonlyMap<string, ScreenDef> = new Map(SCREEN_LIST.map((s) => [s.path, s]))

/** The registry entry for a route pattern; undefined for a tab front page. */
export const screenForPath = (path: string): ScreenDef | undefined => BY_PATH.get(path)

/** Where a screen sits in a stage: Home (a tile), one or more stage tabs, or Me. */
export interface Placement {
  /** Label of each stage tab that lists the screen, in tab order; the first is the primary one. */
  tabs: string[]
  inMe: boolean
  isTile: boolean
}

export function placementIn(id: string, stage: JourneyStage): Placement {
  const def = STAGE_TABS[stage]
  return {
    tabs: def.tabs.filter((t) => t.screens.includes(id)).map((t) => t.label),
    inMe: def.me.screens.includes(id),
    isTile: def.tiles.includes(id),
  }
}

/** The IDs of every screen a stage uses (under a tab or Me, or a Home tile), without repeats. */
export function screensOfStage(stage: JourneyStage): string[] {
  const def = STAGE_TABS[stage]
  return [...new Set([...def.tiles, ...def.tabs.flatMap((t) => t.screens), ...def.me.screens])]
}

/**
 * The tab a screen wears at a stage when the guest did not open it from a tab: the first stage tab that lists it, otherwise Me
 * if Me lists it, otherwise Home. Null when the stage does not use the screen. Settings and help are always Me.
 */
export function primaryTab(id: string, stage: JourneyStage): { label: string; colour: TabColour } | null {
  const def = STAGE_TABS[stage]
  if (SETTINGS_AND_HELP.includes(id)) return { label: 'Me', colour: 'plum' }
  const tab = def.tabs.find((t) => t.screens.includes(id))
  if (tab) return { label: tab.label, colour: tab.colour }
  if (def.me.screens.includes(id)) return { label: 'Me', colour: 'plum' }
  if (def.tiles.includes(id)) return { label: 'Home', colour: 'blue' }
  return null
}

/** Whether a stage shows a screen at all. A screen a stage does not use is hidden: not in a tab, on Home or in search. */
export const stageUses = (id: string, stage: JourneyStage): boolean => primaryTab(id, stage) !== null
