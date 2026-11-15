To turn "Today's Plan" into a flagship, context-aware command center for a Princess Cruises companion app, it needs to act as a dynamic state machine rather than a static schedule. It should adapt automatically based on ship class (Sun, Sky, or Sapphire), day mode (Embarkation, Port Day, Scenic Cruising, Sea Day, or Disembarkation), time of day, and passenger profile (fare tier, dietary needs, and traveling party).
Below is a comprehensive architectural specification covering the 8 core functional modules, smart state logic, edge-case handling, and an expanded production-ready JSON schema.

1. The Context-Aware Hero Header (Pinned Top Bar)

This module anchors the top of the screen and dynamically shifts its layout depending on whether the ship is at sea, docked, or tendering.
• Voyage & Location Identity:
	• Ship badge (Sun Princess, Sky Princess, or Sapphire Princess), Cruise Day (Day 4 of 7), Calendar Date, and Day Mode pill (PORT DAY, AT SEA, SCENIC CRUISING, EMBARKATION, or DISEMBARKATION).
	• Geographic coordinates or port name (e.g., Geiranger, Norway or Inside Passage — Scenic Cruising).
• Live Maritime & Weather Strip:
	• Local high/low temperatures (toggleable °F / °C), precipitation probability, wind speed/sea state (helpful for motion-sensitive guests), and exact Sunrise / Sunset timestamps.
• Dynamic Port & Gangway Countdown (Port Days Only):
	• Gangway Status: Clearing Customs → Gangway Open (Deck 4 Midship) → Last Tender at 4:30 PM → All Aboard Countdown.
	• Live All-Aboard Timer: Turns amber 90 minutes before All-Aboard and red with a pulsing alert 45 minutes prior.
	• Tender Queue Tracker (Anchor Ports): Displays the user’s claimed tender group number alongside the Currently Boarding Group (e.g., Your Group: 6 • Now Boarding: Groups 1–4).
• Time Zone & Ship Clock Guardrail:
	• A high-visibility warning banner whenever ship time differs from port local time or when clocks shift overnight ("Reminder: Set clocks FORWARD 1 hour tonight at 2:00 AM").
• Evening Style & Culinary Banner:
	• Tonight's dress code (Smart Casual or Formal / Dress to Impress) paired with the Main Dining Room's nightly theme (Italian Night) and a tap-to-preview menu link.

2. "Right Now" Live Operational Radar (Real-Time Status Strip)

Guests constantly wonder what is open at the exact moment they look at their phone. This horizontal status bar eliminates manual hours lookups.
• Live Dining & Bar Availability:
	• Filters venues by current ship time and displays status pills:
		• OPEN NOW (Green — e.g., International Café • Open 24/7)
		• CLOSING SOON (Amber — e.g., World Fresh Marketplace • Closes in 25m)
		• OPENS AT 5:30 PM (Grey — next upcoming meal window)
	• Smart Dietary & Package Badges: Automatically flags venues matching the user's profile (e.g., Included in Plus, 4 Casual Meals Left, Dedicated Vegan Menu, or GF Pre-Order Ready).
• Maritime Customs & Revenue Lockouts:
	• Displays real-time open/closed states for Princess Casino and Duty-Free Boutiques, automatically calculating estimated reopening time on port days ("Closed in Port • Reopens ~45m after 6:00 PM sailaway").
• Pool, Hot Tub & Weather Advisories:
	• Notes whether outdoor pools, Movies Under the Stars, or top-deck attractions (SkyDeck Sports Court / Splash Zone) are open or temporarily closed due to high winds.

3. "My Timeline" (Unified Personal Schedule & Smart Logistics)

A chronological vertical timeline merging hard bookings, saved Patter events, and automated logistical buffers.
• Tier 1: Committed Bookings (Locked Cards):
	• Shore Excursions: Tour title, meeting location (Princess Theater, Deck 6), meeting time vs. departure time, digital ticket QR/Medallion prompt, and a dynamic Packing Checklist (Waterproof shell, walking shoes, passport, photo ID).
	• Dining Reservations: Restaurant name, deck & zone (Aft / Midship / Forward), party size, confirmation status, and a reminder if a Gluten-Free / Allergy pre-order is attached.
	• Spa, Enclave & Ticketed Experiences: Lotus Spa treatments, The Enclave thermal pass windows, or ticketed shows (Spellbound by Magic Castle, 360, Chef’s Table Lumiere).
	• Youth & Teen Check-Ins (Family Profiles): Shows registered Firefly Park / Camp Discovery session windows, port-day lunch supervision sign-up deadlines (8:00 PM cutoff), and late-night kidsitting windows.
• Tier 2: Bookmarked Patter Events (Flexible Cards):
	• Activities the user saved from the master schedule (e.g., 2:00 PM Progressive Trivia, 8:00 PM Production Show: Viva La Música), complete with a "Seats Fill Fast — Arrive 25m Early" badge for marquee theater and Dome shows.
• Tier 3: Automated Travel-Time & Conflict Buffers:
	• Conflict Detection: Warns if a 6:30 PM Crown Grill dinner overlaps with a 7:30 PM Princess Arena showtime.
	• Deck-to-Deck Navigation Prompts: "12 min walk from Sabatini's (Deck 8 Aft) to Princess Arena (Deck 6 Forward)".

4. "Curated For You" (Time-Block Discovery Engine)

Instead of overwhelming users with 80+ daily Patter listings, this section surfaces 2 to 3 high-relevance picks per time block (Morning, Afternoon, Evening, Late Night) using interest tags, past saves, and ship-specific highlights.
• Morning Block (6:00 AM – 11:59 AM):
	• Surfaces sunrise fitness (StretchLab / YogaSix), enrichment talks (Discovery at Sea glacier/port lectures), or The Wake Show broadcast highlights.
• Afternoon Block (12:00 PM – 5:59 PM):
	• Highlights sea-day exclusives (Traditional Afternoon Tea, Galley Tour & Culinary Demo, Poolside Olympics, Bridge/Mahjong meetups, or Captain’s Table pop-up sales).
• Evening & Late Night Block (6:00 PM – Late):
	• Spotlights the night's headline production show, Movies Under the Stars feature title + showtimes, live lounge sets (Take Five jazz theme, Crooners piano sing-along, O’Malley’s folk set), and deck parties (Champagne Waterfall or 70s Disco Night).
• Interactive Card Controls:
	• + Add to Timeline (one-tap save with automatic reminder notification).
	• View Full Venue Menu / Lineup (deep-links directly to that restaurant's daily rotating menu or lounge drink list).

5. "Gap-Filler" Micro-Recommendations (Empty Slot Intelligence)

When the user has an unscheduled 45- to 90-minute window between booked events (e.g., between returning from port at 4:00 PM and dinner at 6:30 PM), the page inserts a lightweight "Free Window Suggestion" card:
• Example (4:15 PM – 6:15 PM Free):
	• Quick Bite: Grab Neapolitan pizza at Alfredo's (Deck 6) — uses 1 of your 4 Princess Plus casual meals.
	• Pre-Dinner Drink: Watch the 5:00 PM mixology storytelling demo at Good Spirits at Sea (Deck 7).
	• Unwind: Sunset viewing from Infinite Horizon Tilt Walls (Deck 19) or Skywalkers (Deck 17).

6. Package & Onboard Allowance Tracker (Contextual Widget)

A compact, expandable pill showing real-time remaining perks for the day/voyage so guests maximize value without overspending:
• Princess Plus / Premier Daily Counter:
	• Alcoholic drinks used today (2 of 15 on Plus | Unlimited on Premier) + max drink price cap ($15 vs $20).
	• Casual Dining meals remaining (3 of 4 remaining on Plus).
	• Shore Excursion credit balance ($100 available on Premier).
	• OceanNow® delivery status (Free Delivery Active).

7. Essential Shipboard Utilities & Safety Drawer (Footer)

Pinned cleanly at the bottom for instant access without scrolling back through paper newsletters:
• One-Tap OceanNow® Delivery: Launches food/drink ordering directly to current Medallion location.
• Port Agent & Emergency Card: Offline-cached port agent name, street address, local phone number, and ship medical emergency number (emergency services / ship emergency line).
• Customs & Biosecurity Reminder: Quick-read port rules ("Do not take fresh fruit, meat, or dairy off the ship in Norway/Alaska/US ports").
• Today's Featured Drinks: Cocktail of the Day and Zero-Proof Mocktail of the Day with package coverage badges.