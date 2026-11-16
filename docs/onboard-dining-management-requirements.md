# Onboard Dining Management — Customer-Centred Product Requirements

**Document type:** Product vision, functional requirements and delivery priorities  
**Version:** 1.0  
**Prepared:** 11 November 2026  
**Primary audience:** Cruise product owners, customer-experience leaders, UX/UI designers, engineering teams, shipboard hotel and dining operations, food-and-beverage teams and digital operations  
**Product context:** A mobile-first cruise guest app, ideally delivered as a Progressive Web App (PWA), that helps guests discover, plan, reserve, personalise and enjoy dining throughout their voyage.

---

## 1. Executive summary

Dining is one of the most frequent and emotionally important parts of a cruise holiday. Guests may eat several times a day, across multiple venues and service styles, while balancing changing port schedules, entertainment, family activities, shore excursions and personal preferences. The challenge is not simply finding a restaurant or reading a menu. It is understanding **where to eat, what is available, what it costs, whether it suits the guest's needs, when to go, how to secure a table, and what to do when plans or service conditions change**.

The dining experience should therefore be designed as a connected customer journey rather than a collection of static restaurant descriptions and reservation forms.

The recommended product is an **onboard dining companion** with six connected jobs:

1. **Discover:** Help guests understand the full range of dining options available on their specific ship and sailing.
2. **Choose:** Make menus, cuisine, price, ambience, hours, dining format and dietary information easy to evaluate.
3. **Plan:** Coordinate dining times and reservations with the rest of the guest's day, travel party and onboard activities.
4. **Personalise:** Remember guest preferences and make dietary and accessibility requests visible to the right operational teams.
5. **Enjoy:** Reduce friction during arrival, seating, ordering, delivery, service and payment.
6. **Adapt:** Keep guests informed when venues, hours, menus, availability or orders change, and provide useful alternatives.

The strongest experience should support both the guest who plans every dinner before sailing and the guest who simply wants to know where they can get a good meal right now. It should make dining easier without turning every meal into a digital transaction or replacing the personal hospitality delivered by shipboard teams.

### The central product promise

> **Every meal should be easier to plan, easier to personalise and easier to enjoy.**

### Recommended order of investment

| Priority | Customer-value outcome | What must be delivered |
|---|---|---|
| **P0 — Essential** | Guests can trust dining information and manage the basics | Accurate venue directory and hours; current menus; transparent pricing and included status; dietary/allergy request handling; reservation rules and status; personal dining plan; clear venue locations; schedule-change communication; accessible mobile experience; resilient onboard access |
| **P1 — High value** | Guests can make better dining decisions and avoid friction | Live reservation availability; waitlist/queue support; group reservations; meal-time and seating preferences; integrated entertainment and excursion planning; menu filters; package/credit visibility; room-service and delivery tracking where supported; service-request flows |
| **P2 — Differentiating** | Dining feels personal, seamless and social | Context-aware recommendations; richer menu and venue discovery; order-ahead/table ordering; advanced family and dietary workflows; shared dining plans; accurate crowd indicators; preference learning; enhanced feedback and service recovery |
| **P3 — Future innovation** | The app becomes an intelligent dining companion | Conversational menu and venue discovery; adaptive recommendations; predictive wait estimates; personalised meal journeys; intelligent re-planning; optional location-aware delivery and service experiences |

A useful rule: **P0 establishes trust and safety; P1 makes the experience genuinely convenient; P2 makes it feel exceptional; P3 should follow only when the operational data and service workflows can support it.**

---

## 2. Product vision, goals and experience principles

### 2.1 Vision

Give every guest—whether travelling alone, as a couple, with children or in a large group—a clear, personalised and reliable way to enjoy the dining options available on their specific ship and sailing.

### 2.2 Customer outcomes

The product should help guests:

- Understand all available dining venues, service styles and meal periods.
- See which restaurants are included, which carry an additional charge and what package benefits apply.
- Explore current menus before choosing a venue or making a reservation.
- Understand opening hours, cuisine, atmosphere, dress guidance, expected meal duration and location.
- View ingredient and allergen information where it is reliably maintained.
- Communicate food allergies, dietary requirements and dining preferences before and during the voyage.
- Reserve, modify and cancel dining appointments with clear confirmation and rules.
- Join an eligible walk-in or virtual queue and understand what the wait status means.
- Coordinate dining with companions and avoid conflicts with shows, excursions and other commitments.
- Find suitable options for children and guests with accessibility needs.
- Order food for delivery or to a stateroom where the ship supports it.
- Understand package entitlements, credits, cover charges and onboard-account transactions.
- Receive useful updates when hours, menus, reservations, queues or orders change.
- Access core dining information when internet connectivity is weak or unavailable.
- Get help from the dining team when a request needs human judgement or service recovery.

### 2.3 Business outcomes

The guest experience should also create measurable operational and commercial value:

- Improve awareness and utilisation across the full range of dining venues.
- Distribute demand more effectively across restaurants, meal periods and seating times.
- Reduce avoidable queues, reservation confusion and guest-service contacts.
- Improve reservation conversion and reduce unused bookings and no-shows.
- Improve the reliability and operational handling of food-allergy and special-diet requests.
- Reduce manual work associated with dining reservations, waitlists, menu distribution and routine questions.
- Improve room-service and mobile-order fulfilment where those services are offered.
- Increase appropriate use of dining packages and included benefits without obscuring extra charges.
- Give hotel and food-and-beverage leaders better insight into guest demand, menu performance and service issues.
- Improve dining satisfaction and overall cruise satisfaction.
- Reduce dependence on printed menus and repetitive schedule or venue announcements over time.

### 2.4 Experience principles

**1. Accuracy and food safety beat convenience.** A digital menu or dietary label must not make claims that the kitchen cannot support. Incorrect hours, stale menus, inaccurate pricing or unsupported allergen assurances can cause serious customer harm and loss of trust.

**2. Make the total cost understandable.** Guests should know whether a meal is included, package-covered, subject to a cover charge, priced à la carte or subject to an additional delivery or service fee before committing.

**3. A reservation is only confirmed when the authoritative dining system confirms it.** Distinguish between saved, requested, waitlisted, held, confirmed, seated, completed and cancelled states.

**4. Respect the role of hospitality.** Digital tools should remove repetitive friction and help staff serve guests; they should not force every guest to use a phone to receive ordinary restaurant service.

**5. Treat allergies differently from preferences.** A lifestyle preference, an intolerance and a potentially life-threatening allergy are not interchangeable. The product must support explicit acknowledgement and human escalation for safety-critical requests.

**6. Plan around the whole day.** Dining reservations should be considered alongside theatre productions, live music, Movies Under the Stars, family programming, port activities, shore excursions and appointments.

**7. Preserve flexibility.** Allow guests to make plans, change plans and choose walk-in dining without requiring them to reserve every meal in advance.

**8. Make the next useful action obvious.** Guests should be able to view a menu, reserve, modify, join a queue, navigate, request assistance or see an alternative without hunting through unrelated screens.

**9. Make the ship understandable.** Venue names, deck references, restaurant entrances and map pins must match ship signage and crew terminology.

**10. Design for the whole travel party.** Support shared reservations and family needs while protecting each guest's dietary, account and personal information.

**11. Be honest about operational certainty.** Do not promise table availability, delivery times, ingredient safety or package coverage unless the source system and operating process can honour the promise.

**12. Do not make the holiday feel like an administrative exercise.** The app should make dining choices easier, not pressure guests to plan every meal or interact with a device throughout dinner.

---

## 3. Scope and definition

### 3.1 In scope

The dining-management experience should cover the full range of scheduled and on-demand onboard dining options, including:

- Main dining rooms, including traditional fixed seating, flexible dining and open-seating models.
- Specialty restaurants and premium dining experiences.
- Casual restaurants, cafés, bistros, pizzerias, grills and quick-service venues.
- Buffets, food halls, marketplaces and self-service dining venues.
- Poolside, outdoor and deck-service food options.
- Grab-and-go counters, snacks, desserts, coffee and late-night food service.
- In-stateroom dining and room service.
- Mobile food and beverage delivery to approved onboard locations, where offered.
- Chef's tables, tasting menus, private dining, celebrations and limited-capacity experiences.
- Children's menus, family dining and age-specific venue policies.
- Dining packages, meal credits, included dining benefits and specialty-dining entitlements.
- Beverage menus and package entitlements where they form part of the dining journey.
- Dietary preferences, allergies, intolerances, religious or ethical dietary requirements and special meal requests.
- Dining service information such as hours, dress guidance, table arrangements, accessibility and location.

### 3.2 Adjacent experiences to integrate, not duplicate

Some experiences may be managed in dedicated app modules but should appear in the dining discovery and personal-planning experience when relevant:

- Theatre productions, live music, Movies Under the Stars, guest entertainers, dance venues, enrichment and family programming.
- Shore excursions, port-day schedules and embarkation/disembarkation activities.
- Spa, fitness, nursery and youth-programme appointments.
- Celebrations, onboard events and special-occasion bookings.
- Guest account, package and payment management.
- Ship maps, deck plans and onboard wayfinding.

The unified planner should show these commitments alongside dining so the guest can choose realistic meal times. Ownership of the underlying transaction can remain with the dedicated module.

### 3.3 Out of scope for the first release

- Replacing the cruise line's point-of-sale (POS), property-management, reservation, kitchen or inventory systems.
- Replacing the ship's food-safety, allergen-control, kitchen-production or medical-response procedures.
- Guaranteeing that a menu item is free from an allergen solely because an app label says so.
- Replacing direct conversations with the maître d', chef or dining team for complex or safety-critical requests.
- Building a general-purpose food-delivery marketplace or public restaurant-review network.
- Providing nutritional or medical advice beyond verified menu information and approved disclosures.
- Making mobile ordering mandatory for guests who prefer traditional service.
- Creating payments or refunds outside the cruise line's approved onboard-account and payment services.
- Exposing guest location continuously to support food delivery.

---

## 4. Guest segments and key jobs to be done

The product should serve different dining styles without forcing guests into rigid personas.

| Guest type / context | Primary job | Product response |
|---|---|---|
| The planner | Reserve preferred restaurants and meal times before they fill | Voyage-wide dining calendar, reservation windows, package eligibility, reminders and conflict detection |
| The spontaneous diner | Find a good meal right now without planning ahead | Open-now venues, current meal periods, walk-in guidance, queue status and nearby options |
| The specialty-dining guest | Compare restaurants and secure a premium experience | Rich venue details, sample menus, prices, package rules, available sessions and clear cancellation terms |
| The traditional dining guest | Understand assigned dining time, table and rotation | Clear dining assignment, table details, rotation schedule, menu previews and service instructions |
| The flexible diner | Choose a different time or venue each day | Daily availability, easy changes, open-seating information and unified planning |
| The couple | Find a venue and time both guests will enjoy | Shared shortlist, group availability, cuisine and ambience filters, coordinated reservations |
| The family organiser | Find convenient meals and suitable options for children | Child menus, age policies, high-chair information, family reservations and guardian controls |
| The guest with food allergies | Communicate needs and understand what the ship can safely accommodate | Structured allergy profile, explicit acknowledgement, venue suitability information and clear human-confirmation workflow |
| The guest with dietary preferences | Find meals that fit a preferred way of eating | Reliable menu tags, filters, saved preferences and transparent ingredient information |
| The accessibility-conscious guest | Know whether the route, venue and service will work | Specific accessibility attributes, accessible routing, seating assistance and crew contact options |
| The room-service guest | Order food without going to a venue | Available menu, delivery area, fees, estimated timing, order status and contactless handoff options where supported |
| The large-group organiser | Coordinate a meal for several cabins or companions | Linked reservations, group-size availability, invitation/response flow and clear partial-confirmation handling |
| The repeat cruiser | Find new venues, dishes or experiences | New-to-this-sailing discovery, seasonal menus and preference-aware recommendations |
| The guest with limited connectivity | View dining plans and venue information reliably | Cached menus and reservations, last-sync information and safe handling of online-only actions |

---

## 5. Priority framework

Priorities are based on customer value, frequency of use, trust, food-safety implications and operational importance—not implementation ease alone.

- **P0 — Essential:** Required for a credible and dependable launch. Failure materially damages the guest experience or creates unacceptable operational risk.
- **P1 — High value:** Strongly improves the dining journey and should be targeted for the first major enhancement release.
- **P2 — Differentiating:** Delivers a noticeably better and more personal experience.
- **P3 — Future:** Valuable when data quality, shipboard operations and core customer experience are mature.

Requirements should be enabled by vessel, venue and service model. A feature must not be displayed as available on a ship if the corresponding restaurant, reservation policy, kitchen workflow or operational support is not in place.

---

## 6. Guest-facing functional requirements

## 6.1 Dining home and “where can I eat?” overview

The dining home should answer, in seconds: **What can I eat now, what is available later, what have I booked, and what do I need to know before I go?**

| ID | Priority | Requirement |
|---|---|---|
| DIN-001 | P0 | Provide a dedicated Dining entry point from the app's primary navigation. It must be reachable without navigating through unrelated account or booking sections. |
| DIN-002 | P0 | Show the current official ship date and time, voyage day, and port/sea-day context. Dining hours and reservation times must use the ship's time convention. |
| DIN-003 | P0 | Present a clear “Open now” or “Available now” view based on venue operating hours and current service status. |
| DIN-004 | P0 | Provide quick access to “Breakfast”, “Lunch”, “Dinner”, “Late night”, “Room service” and “All dining” where those services exist. |
| DIN-005 | P0 | Show the guest's upcoming dining reservations and special meal confirmations prominently. |
| DIN-006 | P0 | Display venue name, dining type, meal period, opening hours, location, price/included status and reservation requirement at a glance. |
| DIN-007 | P0 | Clearly distinguish venues that are open, opening soon, closed, temporarily unavailable or operating with modified hours. |
| DIN-008 | P0 | Make current menu access available from relevant venue cards and dining reservations. |
| DIN-009 | P1 | Offer “Good options right now” based on current time, guest preferences, venue availability and practical walking distance where reliable. |
| DIN-010 | P1 | Show the next booked meal and suggest useful actions such as view menu, modify reservation or navigate. |
| DIN-011 | P1 | Provide a concise “What changed?” area for modified hours, temporary closures, menu substitutions or reservation updates affecting the guest. |
| DIN-012 | P1 | Highlight dining choices that fit a time window before or after a planned show, excursion or other commitment. |
| DIN-013 | P2 | Offer curated collections such as “A relaxed breakfast”, “Family-friendly”, “A special evening”, “Quick bite between activities” and “Local flavours”. |
| DIN-014 | P2 | Provide a voyage-wide view of special dining events, limited menus, chef experiences and celebration opportunities. |
| DIN-015 | P3 | Support an intelligent “What should I eat?” discovery flow grounded in current venue, menu and availability data. |

**Acceptance criteria**

- A guest can open Dining and identify practical options for the current meal period without searching.
- Closed or unavailable venues are not presented as open choices.
- The screen clearly distinguishes a venue's normal hours from temporary changes.
- Upcoming reservations are not confused with saved venues or recommendations.
- If personal preferences are absent, the home screen still provides useful and varied suggestions.

## 6.2 Dining venue catalogue and venue detail pages

A strong venue catalogue helps guests compare options before committing time or money. Venue information must be structured and specific to the ship and sailing.

### Minimum venue information

| Field | Requirement / customer benefit |
|---|---|
| Venue name | Guest-friendly name that matches ship signage. |
| Venue type | Main dining room, specialty, casual, buffet, café, grill, room service, delivery or other defined type. |
| Description | What the venue offers, what makes it distinctive and what type of experience to expect. |
| Cuisine / style | Cuisine, meal style and relevant menu themes. |
| Ambience | Formal, relaxed, family-oriented, lively, quiet, romantic, outdoor or other supported descriptors. |
| Deck and location | Deck, forward/midship/aft designation where used, entrance details and map reference. |
| Meal periods | Breakfast, brunch, lunch, dinner, late night, snacks and applicable service windows. |
| Operating hours | Date-specific service hours and known exceptions. |
| Reservation policy | Required, recommended, optional, walk-in only, assigned seating or not applicable. |
| Included / price | Included, cover charge, à la carte, package eligible, credit eligible or other charge model. |
| Price details | Cover charge, representative menu prices, fees and any service-charge treatment where applicable. |
| Package eligibility | Which dining packages or credits apply, with restrictions and effective dates. |
| Dress guidance | Clear practical guidance; distinguish required dress rules from suggestions. |
| Meal duration | Typical duration or guidance when available; mark estimates as estimates. |
| Age policy | All ages, adult-only, minimum age or age-specific service rules. |
| Seating | Indoor/outdoor, table types, communal seating, counter seating, fixed tables and accessibility options. |
| Accessibility | Step-free route, accessible tables, wheelchair space, restroom access and assistance options. |
| Dietary handling | Whether the venue can support common dietary needs and how allergy requests must be handled. |
| Child facilities | High chairs, booster seats, children's menu, family seating and relevant child facilities where available. |
| Media | Approved venue photographs, sample menus and relevant ambience imagery. |
| Status | Open, closed, temporarily unavailable, private event, capacity constrained or service changed. |
| Last updated | Timestamp or “Updated recently” indicator for operationally sensitive details. |

| ID | Priority | Requirement |
|---|---|---|
| DIN-016 | P0 | Provide a complete guest-facing catalogue of dining venues and services available on the current ship and sailing. |
| DIN-017 | P0 | Provide a detail page for each venue containing the minimum information above where applicable. |
| DIN-018 | P0 | Identify the venue's dining model: reservation, walk-in, assigned seating, open seating, order-at-counter or delivery. |
| DIN-019 | P0 | Clearly identify whether the venue is included, has a cover charge, uses à la carte pricing or is eligible for a dining package/credit. |
| DIN-020 | P0 | Show current hours by date and meal period, including holiday, port-day and itinerary-specific exceptions. |
| DIN-021 | P0 | Show the venue's exact deck and location and provide a ship-map action. |
| DIN-022 | P0 | Show age restrictions and distinguish formal restrictions from suggested suitability. |
| DIN-023 | P1 | Support filtering and comparison by cuisine, ambience, price, meal period, included status, indoor/outdoor seating and family suitability. |
| DIN-024 | P1 | Show whether a venue supports a guest's recorded dietary needs, while making clear that allergy suitability requires the venue's approved process and may need direct confirmation. |
| DIN-025 | P1 | Show table arrangements and seating options such as private table, shared table, counter, booth or outdoor seating where the information is maintained. |
| DIN-026 | P1 | Show typical dining duration and expected service format where reliable. |
| DIN-027 | P1 | Support venue photographs, sample menus and concise “what to expect” content. |
| DIN-028 | P1 | Allow guests to save a venue to favourites or a dining shortlist. |
| DIN-029 | P2 | Support curated venue collections based on actual ship inventory and the sailing's available services. |
| DIN-030 | P2 | Show recommended alternatives when a venue is closed, fully booked or not suitable for the guest's available time. |
| DIN-031 | P2 | Support venue profiles with chef or culinary-team information and featured dining experiences where approved. |
| DIN-032 | P2 | Show venue-specific service notes such as buffet station layout, order-at-counter process or special entrance instructions. |
| DIN-033 | P3 | Offer contextual venue recommendations based on dining history and declared interests, with transparent reasons and controls. |

**Acceptance criteria**

- Every venue displayed belongs to the correct ship and sailing.
- A guest can determine the venue's location, hours, dining model and charge model before taking action.
- A closed venue is clearly marked and cannot be booked for a closed period.
- Allergen-related capability statements do not imply a safety guarantee unless the operational process explicitly supports that claim.

## 6.3 Menus, dishes and food information

Menus are a core discovery feature, not a static attachment. Guests should be able to inspect the menu for the relevant venue, date and meal period before choosing where to dine.

### Minimum menu and dish information

| Field | Requirement / customer benefit |
|---|---|
| Menu identity | Venue, ship, sailing, date or effective date, meal period and menu version. |
| Dish name | Clear guest-facing name, including a plain-language explanation for unfamiliar terms. |
| Description | Main ingredients, preparation style, accompaniments and portion context where useful. |
| Price | Item price, currency and whether included or subject to an additional charge. |
| Availability | Available, limited, sold out, substituted or not offered for the current service. |
| Dietary labels | Verified attributes such as vegetarian, vegan or gluten-containing, with defined meaning. |
| Allergen information | Declared allergens and uncertainty/cross-contact disclosures based on approved source data. |
| Modifications | Permitted substitutions or omissions, with limits and approval requirements. |
| Image | Optional approved food photograph; never allow imagery to imply a different item or portion. |
| Child suitability | Child menu designation or other approved age-related information. |
| Nutrition | Nutrition values only where supplied, reviewed and kept current. |
| Beverage pairing | Optional suggested beverage pairing where approved and clearly presented as a suggestion. |

| ID | Priority | Requirement |
|---|---|---|
| DIN-034 | P0 | Display the current menu for each venue and meal period where the menu data is available. |
| DIN-035 | P0 | Associate each menu with the correct venue, ship, sailing, date/effective period and service. |
| DIN-036 | P0 | Show dish names, descriptions and prices or included status where applicable. |
| DIN-037 | P0 | Identify menus that are sample, indicative or subject to change; do not present them as guaranteed final menus. |
| DIN-038 | P0 | Show when a menu or item was last updated where availability or substitutions may change during service. |
| DIN-039 | P0 | Display known allergen information using approved and consistently defined labels. |
| DIN-040 | P0 | Distinguish “contains”, “may contain”, “prepared in a shared environment” and “information unavailable” where the source can support those states. |
| DIN-041 | P0 | Never label an item “allergen-free” or “safe for” a guest solely because the allergen is absent from the recipe record. Such claims require an approved operational control and data source. |
| DIN-042 | P1 | Support filters for verified dietary attributes such as vegetarian, vegan, gluten-containing/gluten-aware options and other ship-approved tags. |
| DIN-043 | P1 | Explain what each dietary label means and avoid treating “gluten-friendly” as equivalent to medically safe gluten-free preparation. |
| DIN-044 | P1 | Support menu photographs and richer dish content where approved and useful. |
| DIN-045 | P1 | Show item availability or sold-out status where POS/kitchen data can keep it sufficiently current. |
| DIN-046 | P1 | Show permitted dish modifications and substitutions, including when a request must be discussed with service staff. |
| DIN-047 | P1 | Provide a child menu view when the venue offers a separate menu. |
| DIN-048 | P2 | Support nutrition information such as calories or selected nutrient values where it is supplied, verified and regularly maintained. |
| DIN-049 | P2 | Support chef recommendations, signature dishes, local ingredients and destination-inspired menu stories. |
| DIN-050 | P3 | Support richer menu discovery such as ingredient exploration, dish comparisons and conversational questions grounded in the actual menu data. |

**Menu accuracy and safety rules**

- Menus must be versioned and date-aware. A menu from a previous voyage or previous service must not appear as current without a clear label.
- Item-level allergen data must be owned and approved by the appropriate food-and-beverage or food-safety authority.
- Missing allergen data must be shown as unknown, not interpreted as absence.
- Kitchen substitutions must update digital availability and allergen information as quickly as the operational process allows.
- A menu filter is a discovery aid; it is not a substitute for the guest's required allergy conversation with trained staff.
- A guest must be able to reach the venue or dining team when the information is incomplete or the need is complex.

## 6.4 Search, browse and dining discovery

Search should work for guests who know the restaurant or dish they want and for guests who are simply looking for a convenient or appealing meal.

| ID | Priority | Requirement |
|---|---|---|
| DIN-051 | P0 | Provide keyword search across venue names, cuisine, descriptions, dish names, ingredients where available and meal periods. |
| DIN-052 | P0 | Provide consistent browsing categories such as Main Dining, Specialty, Casual, Buffet, Café, Quick Bites, Room Service and Delivery. |
| DIN-053 | P0 | Allow filtering by date, meal period, opening status, venue type, price/included status and reservation requirement. |
| DIN-054 | P0 | Allow guests to clear filters easily and see which filters are active. |
| DIN-055 | P1 | Add filters for cuisine, ambience, indoor/outdoor, family suitability, age policy, accessibility and supported dietary attributes. |
| DIN-056 | P1 | Provide useful sort orders: open now, soonest available, time, price, guest preference match and walking distance where reliable. |
| DIN-057 | P1 | Support dish-level search so a guest can find a named item or ingredient across current menus. |
| DIN-058 | P1 | Provide prompts such as “Quick meal”, “Family-friendly”, “Special occasion”, “Included dining”, “Open late” and “Near my next activity”. |
| DIN-059 | P1 | Show only venues that are operating or explicitly label future service periods and next opening times. |
| DIN-060 | P1 | Offer suitable alternatives when there are no matches, without silently relaxing allergy or age-related restrictions. |
| DIN-061 | P2 | Provide editorial collections such as “Taste of the region”, “Chef's favourites”, “A special evening” or “Best for a relaxed lunch”. |
| DIN-062 | P2 | Support comparison of a small number of venues by price, cuisine, included status, menu highlights, time and location. |
| DIN-063 | P2 | Explain recommendation relevance, for example “Open after the theatre performance” or “Matches your saved Italian cuisine preference”. |
| DIN-064 | P3 | Support natural-language discovery such as “Find an included restaurant after the show with vegetarian options” using current ship data and explicit caveats for allergy-related questions. |

**Acceptance criteria**

- A guest can find a venue or dish using a partial name.
- Search results are limited to the current ship and sailing.
- Combined filters produce understandable results and can be reset.
- Search never treats an unknown allergen state as a safe match.
- Paid or promoted venues are not ranked above relevant included options without clear disclosure.

## 6.5 Reservations, dining times and seating preferences

Reservation behaviour differs by dining model, venue and ship. The product must represent the actual operating rules rather than force every meal into one booking workflow.

### Dining models to support

- **Traditional fixed seating:** A recurring assigned time, dining room and potentially assigned table for the voyage or a defined portion of it.
- **Flexible/reservable dining:** Guests choose a dining time for each date or meal period, subject to availability.
- **Open seating / walk-in:** Guests arrive during operating hours and are seated according to venue procedure.
- **Specialty dining:** A reservation may be required and may carry a cover charge or consume a package benefit.
- **Limited-capacity experiences:** Chef's tables, tastings, private dining and other experiences with defined booking and cancellation rules.
- **No reservation model:** Guests are served on arrival, by counter order or through an available delivery process.

### Required booking states

Use explicit guest-friendly states:

- **Saved:** Added to a shortlist; no table is held.
- **Available:** A reservation can currently be requested.
- **Request submitted:** The request has been received but is not yet confirmed.
- **Held:** A temporary hold exists with an expiry time, if the system supports holds.
- **Confirmed:** The reservation is secured according to the venue's rules.
- **Waitlisted:** The guest is in a queue; a table is not guaranteed.
- **Checked in:** The party has arrived and is registered.
- **Seated:** The party has been assigned/occupied a table.
- **Completed:** The dining visit is complete, if the system records it.
- **Cancelled:** The reservation has been cancelled.
- **Expired / no-show:** The reservation window passed without required arrival or action.

| ID | Priority | Requirement |
|---|---|---|
| DIN-065 | P0 | Display the reservation model and eligibility for every venue and meal period: required, recommended, optional, walk-in, assigned seating or unavailable. |
| DIN-066 | P0 | Where a booking service exists, allow eligible guests to reserve from the venue, menu or planner context. |
| DIN-067 | P0 | Support selection of date, meal period, time, party size and available seating options. |
| DIN-068 | P0 | Display the number and identity of guests covered by the reservation, subject to permissions. |
| DIN-069 | P0 | Show dining time, venue, party size, reservation reference and material arrival instructions in the confirmation. |
| DIN-070 | P0 | Return an explicit success, failure or pending result after every reservation action; never infer confirmation from a button tap. |
| DIN-071 | P0 | Allow guests to view all dining reservations and their current states in one place. |
| DIN-072 | P0 | Show whether the reservation is included, consumes a package credit, requires a cover charge or will be charged à la carte. |
| DIN-073 | P0 | Display cancellation deadlines, no-show policies and any applicable fee before the guest confirms. |
| DIN-074 | P0 | Prevent duplicate reservations where the venue's rules prohibit them, while allowing legitimate multiple-meal bookings. |
| DIN-075 | P0 | Respect booking windows, loyalty/guest eligibility, package benefits and ship-specific reservation rules. |
| DIN-076 | P0 | Support traditional dining assignments, including assigned dining time, restaurant, table and rotation details where the ship uses them. |
| DIN-077 | P1 | Allow guests to modify or cancel reservations where permitted by venue policy. |
| DIN-078 | P1 | Support daily dining-time preferences for flexible dining, including the ability to choose different times on different days. |
| DIN-079 | P1 | Support seating preferences such as private table, shared table, quiet area, window/outdoor seating or other options only where operationally offered. |
| DIN-080 | P1 | Allow guests to indicate celebration details, special occasions and relevant service requests during booking. |
| DIN-081 | P1 | Support linked reservations for travel companions and multiple cabins where the booking system permits. |
| DIN-082 | P1 | Report partial group confirmation accurately, such as “4 of 6 guests confirmed” or “same time not available for everyone”. |
| DIN-083 | P1 | Offer alternative times, dates or venues when the selected slot is unavailable. |
| DIN-084 | P1 | Show package credits or specialty dining entitlements that may be applied, and identify any restrictions before booking. |
| DIN-085 | P1 | Support pre-cruise reservation access and onboard booking access according to actual cruise-line policy. |
| DIN-086 | P2 | Support reservation waitlists and notify guests when a suitable slot becomes available. |
| DIN-087 | P2 | Support preference ranking for alternative reservation times, with guest approval before a booking is changed. |
| DIN-088 | P2 | Offer suggested dining times based on the guest's entertainment, excursion and appointment schedule. |
| DIN-089 | P2 | Allow guests to request a preferred server or dining team only if the operating model supports the request; never imply it is guaranteed. |
| DIN-090 | P3 | Support intelligent dining itineraries across the voyage based on preferred venues, package value, availability and personal pace, while leaving final decisions to the guest. |

**Important booking safeguards**

- A saved restaurant is not a reservation.
- A reservation request is not a confirmed reservation.
- A package entitlement does not guarantee a reservation or override venue capacity.
- A group reservation must clearly show whether all or only some guests were confirmed.
- Guests must see the specific charge, credit usage and cancellation conditions before committing.
- The app must not change a fixed dining assignment without an authoritative operation and clear guest communication.

## 6.6 Walk-in dining, waitlists, arrival and queue management

A guest who has not made a reservation should still be able to understand where walk-in dining is possible and what to do on arrival.

| ID | Priority | Requirement |
|---|---|---|
| DIN-091 | P0 | Explain the walk-in process for venues that accept guests without reservations. |
| DIN-092 | P0 | Provide a clear check-in instruction for eligible venues, including where to report and whether all party members must be present. |
| DIN-093 | P1 | Allow guests to join a virtual waitlist or queue where the venue has an operational system to support it. |
| DIN-094 | P1 | Display queue state and estimated wait only when the underlying data is reliable; label estimates clearly. |
| DIN-095 | P1 | Notify the guest when the table is ready and state the response/arrival window. |
| DIN-096 | P1 | Allow guests to leave or cancel a waitlist without having to contact staff where operationally supported. |
| DIN-097 | P1 | Show party size, queue status and relevant check-in location. |
| DIN-098 | P1 | Make clear whether the party must remain near the venue while waiting or may move to another onboard location. |
| DIN-099 | P1 | Provide a manual/crew-assisted check-in fallback for guests without a device or network access. |
| DIN-100 | P2 | Show a nearby alternative venue or later meal period when the wait is long. |
| DIN-101 | P2 | Provide occupancy or crowd-level indications only when supported by reliable operational data. |
| DIN-102 | P2 | Allow guests to indicate mobility or accessibility needs relevant to the seating process. |
| DIN-103 | P2 | Support queue revalidation if the guest's party size changes or a companion arrives late. |
| DIN-104 | P3 | Offer predictive queue guidance using historical demand and current check-in/seating data, with clear uncertainty labels. |
| DIN-105 | P3 | Support cross-venue waitlist suggestions when the guest explicitly opts into alternatives. |

**Queue quality rules**

- Never present an estimated wait as a guaranteed seating time.
- Do not remove a guest from a queue merely because a push notification was not delivered.
- Make the arrival grace period and response deadline visible.
- Do not expose another guest's identity or party details in queue information.
- If the system cannot reliably manage a queue, show the venue's actual crew-assisted process instead.

## 6.7 Dietary preferences, allergies and special meal requests

This is a high-trust, safety-sensitive part of the product. The app must help guests communicate clearly, but it must not replace the ship's approved food-safety and allergy-management process.

### Distinguish the request types

- **Preference:** A desired choice such as vegetarian, vegan, pescatarian, low-spice or avoiding a particular ingredient.
- **Dietary requirement:** A requirement related to a dietary pattern, intolerance, religious practice or other need.
- **Food allergy:** A potentially serious reaction risk that requires explicit handling and an approved operational process.
- **Special meal request:** A request requiring advance preparation, ingredient review, chef approval or a specific service arrangement.

The guest should be able to state what they need without having to disclose more personal detail than is operationally necessary.

| ID | Priority | Requirement |
|---|---|---|
| DIN-106 | P0 | Allow guests to record dining preferences and dietary requirements in a structured profile before and during the voyage. |
| DIN-107 | P0 | Provide a distinct, explicit workflow for food allergies; do not represent an allergy as an ordinary menu preference. |
| DIN-108 | P0 | Allow the guest to identify the relevant ingredient/allergen and provide severity or handling details only where the approved process requires them. |
| DIN-109 | P0 | Clearly explain that submitting an allergy request in the app does not itself guarantee that a menu item or venue is safe. |
| DIN-110 | P0 | Capture guest acknowledgement of the need to follow the ship's allergy-confirmation process, including speaking with trained dining staff where required. |
| DIN-111 | P0 | Provide a way to submit a special dietary request before sailing, with visible received, under review, confirmed, unable to accommodate and needs-contact states. |
| DIN-112 | P0 | Show whether the request has been received and acknowledged by the appropriate dining operation; do not show an unreviewed request as approved. |
| DIN-113 | P0 | Make safety-critical allergy information available to authorised dining and culinary staff through the approved operational workflow. |
| DIN-114 | P0 | Restrict access to allergy and dietary profile information to staff who need it to fulfil the request. |
| DIN-115 | P0 | Distinguish declared allergens, possible cross-contact, shared equipment/handling and unknown information where the source data supports it. |
| DIN-116 | P0 | Provide a direct way to contact or request assistance from the dining team when information is incomplete or a guest's needs are complex. |
| DIN-117 | P1 | Allow guests to update dietary needs during the voyage and make the update status visible. |
| DIN-118 | P1 | Display verified menu tags and filters for suitable dietary patterns, while keeping allergy caveats visible. |
| DIN-119 | P1 | Allow a guest to attach a special-meal request to a specific reservation where operationally supported. |
| DIN-120 | P1 | Show whether the venue has acknowledged the request and whether staff need to discuss it with the guest before service. |
| DIN-121 | P1 | Support guardian-managed dietary details for children and authorised dependants. |
| DIN-122 | P1 | Support translated or printable summaries of the guest's approved dietary request to aid communication with crew, while keeping the authoritative record in the system. |
| DIN-123 | P2 | Provide venue-specific guidance on how guests should identify themselves to dining staff for allergy-related service. |
| DIN-124 | P2 | Support secure cross-venue visibility of confirmed dietary needs so guests do not have to repeat the same information at every meal. |
| DIN-125 | P2 | Provide a guest-facing history of dietary requests and their confirmation status for the current voyage. |
| DIN-126 | P2 | Support approved allergy workflow prompts for staff, such as chef review, ingredient verification and order-level confirmation. |
| DIN-127 | P3 | Offer a more personalised dietary discovery experience only where menu data and operational controls can support the guest's stated requirements safely. |

**Critical allergy and dietary safeguards**

- A missing allergen record must never be interpreted as evidence that the item is safe.
- The app must not independently certify a dish as allergen-free.
- Menu data may change because of substitutions, supplier changes or preparation conditions. Relevant changes must be reviewed and communicated through the approved process.
- Free-text guest comments alone must not be the sole mechanism for communicating a serious allergy to the kitchen.
- A guest-facing dietary tag is a discovery aid, not a safety guarantee.
- An allergy request must be routed to a person or operational queue with clear responsibility and an acknowledgement state.
- If the venue cannot verify or accommodate the request, the app should say so clearly and provide the appropriate contact path rather than suggesting a potentially unsafe substitute.
- Collect only the information needed to fulfil the request, protect it as sensitive personal information and apply a defined retention policy.

## 6.8 Personal dining planner and unified voyage calendar

The dining planner should bring together meals the guest has booked, meals they are considering and important commitments elsewhere in the cruise app.

| ID | Priority | Requirement |
|---|---|---|
| DIN-128 | P0 | Provide a day-by-day dining view covering the entire sailing, with a phone-friendly agenda/list format. |
| DIN-129 | P0 | Allow guests to save a venue or meal idea without making a reservation. Label it as saved or planned, not booked. |
| DIN-130 | P0 | Show confirmed dining reservations and assigned dining arrangements in a prominent “My Dining” area. |
| DIN-131 | P0 | Allow guests to remove saved ideas and manage reminder preferences without accidentally cancelling a confirmed reservation. |
| DIN-132 | P0 | Identify conflicts between dining reservations and other confirmed commitments already available to the app. |
| DIN-133 | P0 | Distinguish hard conflicts from soft conflicts such as insufficient walking time or a meal likely to overlap a show. |
| DIN-134 | P0 | Show venue, deck, party size, reservation status, charge/package notes and navigation action in the planner entry. |
| DIN-135 | P1 | Integrate theatre productions, live music, Movies Under the Stars, family programming, shore excursions, spa and other appointments into the same day view where those modules permit. |
| DIN-136 | P1 | Warn when the selected dining time is unlikely to leave enough time to reach a theatre, excursion meeting point or other commitment. |
| DIN-137 | P1 | Suggest alternative dining times or venues when a reservation conflicts with a guest's existing plan. |
| DIN-138 | P1 | Allow multiple personal lists such as “Must try”, “Included options”, “Family meals” or “Special occasion”. |
| DIN-139 | P1 | Provide both a voyage-wide calendar and a focused daily view. |
| DIN-140 | P2 | Offer itinerary templates such as a relaxed sea day, port-day breakfast, family dinner or theatre evening using actual schedules and venue availability. |
| DIN-141 | P2 | Support a preferred dining pace or meal duration to influence suggestions without restricting the guest's choices. |
| DIN-142 | P3 | Offer smart re-planning when a show, excursion or dining reservation changes, with guest approval before modifying bookings. |

**Planner rules**

- A saved venue is not a reservation.
- A reservation request is not a confirmed booking.
- A confirmed dining reservation must show the actual party size, date, time, venue and relevant policy.
- The planner must not silently move a restaurant booking to a different time because an entertainment event changes.
- Conflicts should explain the reason and provide a practical next action.
- The planner should use official ship time and should not silently convert dining times to the phone's home time zone.

## 6.9 Couple, group and family dining coordination

Dining is often a shared experience. The product should help guests coordinate without exposing private reservations, dietary details or account information by default.

| ID | Priority | Requirement |
|---|---|---|
| DIN-143 | P0 | Allow a guest to share a venue, menu or reservation detail using the device's standard share capability or a secure in-app link. |
| DIN-144 | P1 | Allow authorised travel companions to share dining shortlists and selected meal plans. |
| DIN-145 | P1 | Support invitations for companions to join a dining reservation or indicate attendance. |
| DIN-146 | P1 | Show which invited companions have accepted, declined or not responded, subject to their permissions. |
| DIN-147 | P1 | Allow a group organiser to request a reservation for multiple authorised guests or cabins where supported. |
| DIN-148 | P1 | Explain table-size limitations, available seating times and partial availability for larger groups. |
| DIN-149 | P1 | Support linked reservations when a large party must be split across tables or booking records. |
| DIN-150 | P1 | Allow guests to keep some meal plans private while sharing others. |
| DIN-151 | P1 | Support a lightweight poll for choosing among a small number of venues or meal times. |
| DIN-152 | P1 | Allow guests to share a meeting point and dining venue location without sharing continuous location. |
| DIN-153 | P2 | Display a shared group dining schedule with individual and common meals clearly differentiated. |
| DIN-154 | P2 | Support dining preferences for each member of the group without disclosing sensitive details to every companion. |
| DIN-155 | P2 | Allow an organiser to see the status of linked reservations and whether the requested party can be seated together. |
| DIN-156 | P2 | Support pre-arranged celebration meals and group dining notes where the venue can fulfil them. |
| DIN-157 | P3 | Offer intelligent group suggestions based on shared interests, availability and a practical range of price points. |
| DIN-158 | P3 | Integrate approved family/companion coordination services where available, while retaining explicit consent and age protections. |

**Privacy rules**

- A dining reservation or dietary profile must not automatically be visible to all travel companions.
- Sharing must be opt-in, granular and reversible.
- A group organiser should see reservation status necessary to coordinate the booking, not another guest's full account or sensitive health details.
- Children should not be able to share personal or dietary data beyond guardian-approved rules.
- The app must not require continuous location sharing to coordinate a meal.

## 6.10 Room service, mobile ordering and food delivery

Where the ship offers room service or mobile delivery, the app should make ordering understandable and predictable. The feature must be limited to the delivery areas, menus, time windows and fulfilment models the ship can actually support.

| ID | Priority | Requirement |
|---|---|---|
| DIN-159 | P0 | Show room-service availability, operating hours, delivery areas, menu and any applicable fees. |
| DIN-160 | P0 | Clearly identify items that are included, chargeable, package-covered or subject to delivery/service fees. |
| DIN-161 | P0 | Allow eligible guests to place a room-service order through an authoritative ordering service. |
| DIN-162 | P0 | Provide an explicit order confirmation with order reference, items, quantities, price and delivery address/location. |
| DIN-163 | P0 | Display order states such as received, accepted, preparing, dispatched, delivered, cancelled or requiring guest action. |
| DIN-164 | P0 | Do not show an order as accepted or delivered until the authoritative service reports that state. |
| DIN-165 | P1 | Support approved delivery to public onboard locations such as pool areas or lounges where the ship can reliably identify the guest's location. |
| DIN-166 | P1 | Offer a location-selection method that does not require continuous device tracking, such as venue, deck/zone or a supported location token. |
| DIN-167 | P1 | Show an estimated delivery window only when the fulfilment system can provide a meaningful estimate. |
| DIN-168 | P1 | Allow guests to modify or cancel an order before the operational cut-off, with the applicable rules visible. |
| DIN-169 | P1 | Communicate item substitutions, unavailable items and price differences before the guest accepts the revised order. |
| DIN-170 | P1 | Provide a way to contact the service team about a delayed, missing or incorrect order. |
| DIN-171 | P1 | Apply package entitlements and delivery charges accurately and show the expected onboard-account treatment before submission. |
| DIN-172 | P1 | Support special dietary instructions through the approved kitchen workflow; do not rely on unreviewed free text for allergy-critical orders. |
| DIN-173 | P2 | Support order-ahead or scheduled delivery windows where kitchen capacity and delivery operations permit. |
| DIN-174 | P2 | Provide delivery progress updates and clear instructions for guest handoff or stateroom delivery. |
| DIN-175 | P2 | Support saved favourites and easy repeat ordering where the items and current prices remain valid. |
| DIN-176 | P2 | Support contactless delivery preferences where the ship's service model can fulfil them. |
| DIN-177 | P3 | Offer context-aware delivery suggestions during eligible events or at approved public locations, with opt-in location use. |
| DIN-178 | P3 | Support predictive delivery timing using real kitchen and delivery capacity data, with clear uncertainty. |

**Ordering safeguards**

- An order must not be accepted when the kitchen or delivery service is closed or unavailable.
- Price, fees, package coverage and destination must be visible before submission.
- If a requested item is substituted, the guest must be told what changed and whether the price changed.
- The app must not promise a delivery time unsupported by the operational system.
- Allergy-critical instructions must be acknowledged through the designated workflow, not treated as ordinary customisation text.

## 6.11 Digital dining experience at the table

Digital features at the table should be optional and should complement traditional service. The experience may include digital menus, QR access, order requests or bill review, depending on venue operations.

| ID | Priority | Requirement |
|---|---|---|
| DIN-179 | P1 | Allow guests to view the current venue menu from a QR code, NFC tag or in-app venue page where the venue supports it. |
| DIN-180 | P1 | Ensure digital menu access does not require a separate paid internet package where ship-local access is intended to be available. |
| DIN-181 | P1 | Provide a non-digital menu and staff-assisted ordering alternative. |
| DIN-182 | P1 | Allow guests to request service assistance through the app only where staff are equipped to receive and action the request. |
| DIN-183 | P2 | Support table-level ordering for eligible venues, with clear item customisation, allergy safeguards, confirmation and order status. |
| DIN-184 | P2 | Support simple service requests such as water, additional napkins, condiments or the bill where operationally supported. |
| DIN-185 | P2 | Allow guests to review their current table charges before final settlement where POS integration permits. |
| DIN-186 | P2 | Show which items are included, charged to the onboard account or covered by a package. |
| DIN-187 | P2 | Support a clear correction or dispute request if the displayed order or bill is incorrect. |
| DIN-188 | P2 | Support accessible digital menus with screen-reader structure, adjustable text and translations where approved. |
| DIN-189 | P3 | Support split-bill requests or allocation of selected items to different guest accounts where ship policy and POS capability permit. |
| DIN-190 | P3 | Support approved digital tipping or service-feedback options only where they fit the cruise line's policy and existing account model. |
| DIN-191 | P3 | Support table-side recommendations based on menu availability and declared preferences without presenting paid promotions as neutral recommendations. |
| DIN-192 | P3 | Provide optional post-meal service feedback from the table or shortly after the meal. |

**Experience principles**

- Do not require a guest to scan a QR code to receive normal dining service.
- Avoid making guests repeatedly re-enter cabin, table or party details when the system already knows them securely.
- A table-order request is not a completed order until the POS/kitchen workflow acknowledges it.
- Digital ordering must not bypass required staff confirmation for allergies or special preparation.
- Keep screens and prompts unobtrusive so that the app does not dominate the meal.

## 6.12 Pricing, onboard account, packages and dining benefits

A major source of dining frustration is uncertainty about what is included and what will be charged. The app should make entitlements and charges easy to understand before a guest books or orders.

| ID | Priority | Requirement |
|---|---|---|
| DIN-193 | P0 | Show whether each venue and menu item is included, chargeable, package eligible or subject to a cover charge. |
| DIN-194 | P0 | Show the applicable price and currency before a reservation, order or purchase action. |
| DIN-195 | P0 | Identify mandatory fees, delivery charges and relevant service charges before commitment. |
| DIN-196 | P0 | Explain package conditions in plain language, including eligible venues, exclusions, limits and booking requirements. |
| DIN-197 | P0 | Display the expected onboard-account charge or package treatment before an order or paid reservation is submitted. |
| DIN-198 | P1 | Show remaining dining credits or package entitlements where the authoritative account system exposes them. |
| DIN-199 | P1 | Show whether an entitlement is reserved, consumed, pending or available, with a last-updated indicator where needed. |
| DIN-200 | P1 | Explain when an item or venue exceeds a package allowance and show the incremental charge before confirmation. |
| DIN-201 | P1 | Show applicable dining package rules for each guest in a group, including where benefits differ by guest or booking. |
| DIN-202 | P1 | Provide links to the relevant account/billing area for completed charges and receipts. |
| DIN-203 | P2 | Support a voyage view of specialty dining reservations, package credits and expected costs. |
| DIN-204 | P2 | Allow guests to compare included options with paid dining in a transparent way. |
| DIN-205 | P2 | Support approved promotional offers and dining credits with clear expiry, eligibility and conditions. |
| DIN-206 | P3 | Offer personalised package-use insights based on confirmed entitlement data, without pressuring the guest to spend more. |
| DIN-207 | P3 | Support richer group account allocation where the cruise line's payment and privacy policies permit. |

**Commercial transparency rules**

- Never describe a venue as “included” if common mandatory charges still apply without disclosing them.
- Do not show stale package balances as definitive; identify pending or delayed account updates.
- Make it clear whether a package credit is consumed at booking, at attendance or at settlement.
- A price change or substitution must be communicated before the guest accepts the revised order.
- Paid placement must be distinguishable from organic or preference-based recommendations.

## 6.13 Family and children’s dining

Family dining needs to help adults coordinate meals while presenting accurate information about children's menus, venue policies and practical facilities.

| ID | Priority | Requirement |
|---|---|---|
| DIN-208 | P0 | Identify age restrictions and adult-accompaniment requirements for dining venues. |
| DIN-209 | P0 | Show children's menu availability and link to the current menu where applicable. |
| DIN-210 | P0 | Show whether high chairs, booster seats and other family facilities are available, where the information is maintained. |
| DIN-211 | P0 | Support guardian-managed dietary and allergy requests for children with appropriate permissions. |
| DIN-212 | P1 | Allow guardians to filter for family-friendly venues, child menu availability and convenient meal times. |
| DIN-213 | P1 | Allow guardians to include children in a dining reservation and specify relevant seating/facility needs. |
| DIN-214 | P1 | Show policies for infants, bottle warming, baby food or other specialised services only where the venue explicitly offers them. |
| DIN-215 | P1 | Integrate dining reservations with youth-club or nursery commitments where those schedules are available and the guardian is authorised. |
| DIN-216 | P2 | Offer family meal suggestions based on the party's ages, venue availability and planned activities. |
| DIN-217 | P2 | Support approved child dining preferences without creating independent public child profiles. |
| DIN-218 | P3 | Provide family-oriented meal planning that can coordinate separate adult and child activities while respecting childcare and guardian handoff rules. |

## 6.14 Accessibility, inclusion and language

Accessibility must be represented as specific venue and service attributes rather than a vague “accessible” badge.

| ID | Priority | Requirement |
|---|---|---|
| DIN-219 | P0 | Meet WCAG 2.2 AA as the target standard for the guest-facing web experience. |
| DIN-220 | P0 | Support screen readers, logical focus order, scalable text, sufficient contrast and clear touch targets. |
| DIN-221 | P0 | Do not rely on colour alone to convey opening status, reservation state, menu availability or dietary information. |
| DIN-222 | P0 | Use plain language and consistent labels for charges, booking states, meal periods and dining models. |
| DIN-223 | P0 | Ensure venue, menu, price, date and reservation information remains readable at larger text sizes. |
| DIN-224 | P1 | Expose specific accessibility attributes such as step-free entrance, wheelchair space, table access and accessible restroom route where verified. |
| DIN-225 | P1 | Allow guests to identify mobility or seating assistance needs during a reservation request. |
| DIN-226 | P1 | Provide menu translations and supported language labels where approved and current. |
| DIN-227 | P1 | Support accessible digital menus and clear text equivalents for menu images. |
| DIN-228 | P2 | Provide additional sensory and ambience information, such as expected noise, lighting or crowd intensity, where venue teams can maintain it accurately. |
| DIN-229 | P2 | Support dietary/cultural preference labels and clear explanations without making assumptions about a guest's identity or beliefs. |
| DIN-230 | P2 | Provide translated or printable dining request summaries to support communication with crew. |
| DIN-231 | P3 | Offer personalised accessibility-aware dining discovery and navigation using only explicit guest preferences and verified venue data. |

**Important:** Do not label a venue “fully accessible” as a blanket claim. Display the specific features known to be available and provide a path to crew assistance for details that cannot be confirmed digitally.

## 6.15 Dining changes, closures and service disruption

Hours, menus, capacity and service conditions can change during a voyage. The app must help guests adapt without leaving them uncertain about a reservation or order.

| ID | Priority | Requirement |
|---|---|---|
| DIN-232 | P0 | Support operational states such as open, opening soon, closed, temporarily closed, modified service, capacity constrained and service interrupted. |
| DIN-233 | P0 | Propagate venue-hour changes to discovery, venue detail, menus, reservations and planner views. |
| DIN-234 | P0 | Notify affected guests when a confirmed reservation is cancelled, moved or materially changed. |
| DIN-235 | P0 | Show what changed, including the previous and new time, venue or service instruction where available. |
| DIN-236 | P0 | Clearly display the latest confirmed information and indicate when cached information may be stale. |
| DIN-237 | P0 | Ensure a cancelled or closed service cannot remain apparently bookable. |
| DIN-238 | P1 | Recommend alternatives when a venue is closed, a meal period is shortened or a menu item becomes unavailable. |
| DIN-239 | P1 | Support weather-related changes to outdoor dining and delivery locations. |
| DIN-240 | P1 | Communicate kitchen delays, order substitutions and room-service disruptions to affected guests. |
| DIN-241 | P1 | Provide a “Dining updates” summary so guests can review changes without opening every venue page. |
| DIN-242 | P1 | Allow authorised staff to publish a short guest-facing explanation, such as “Outdoor seating closed due to weather”. |
| DIN-243 | P2 | Offer smart re-planning for affected meals and connected entertainment, always asking before changing a booking. |
| DIN-244 | P2 | Provide staff-facing publication and acknowledgement information for material dining changes. |

**Acceptance criteria**

- A venue closure cannot leave a guest with a false impression that the venue is open or bookable.
- A reservation affected by a change is updated or explicitly flagged for guest action.
- A guest's reservation is not silently moved to another time or venue.
- Cached information shows its last successful sync time.
- Alternatives are only offered when the venue, menu and time are actually available.

## 6.16 Notifications, reminders and dining alerts

Notifications should protect the guest's plan and provide actionable information without creating unnecessary noise.

| ID | Priority | Requirement |
|---|---|---|
| DIN-245 | P0 | Allow guests to enable or disable dining reminders. |
| DIN-246 | P0 | Provide configurable reminders for upcoming dining reservations, with sensible defaults. |
| DIN-247 | P0 | Send material change alerts for cancellations, venue changes, time changes and important special-request updates, subject to permissions and channel availability. |
| DIN-248 | P0 | Avoid duplicate reminders across devices or channels for the same reservation. |
| DIN-249 | P0 | Provide an in-app notification centre with read/unread state and links to the affected reservation, venue or order. |
| DIN-250 | P1 | Notify guests when a waitlisted table is ready, with an explicit response window. |
| DIN-251 | P1 | Provide room-service and mobile-order status updates where the ordering system supports them. |
| DIN-252 | P1 | Support quiet hours and separate controls for operational alerts, reminders and promotional messages. |
| DIN-253 | P1 | Suppress reminders when a booking is cancelled, a guest has left a queue or an order is no longer active. |
| DIN-254 | P2 | Offer context-aware reminders based on walking time, reservation grace periods and the guest's next activity. |
| DIN-255 | P2 | Provide an optional daily dining digest covering upcoming meals, saved venues and material changes. |
| DIN-256 | P3 | Support personalised notification intensity, such as low-interruption, balanced or high-assistance modes. |

**Notification quality rules**

- Separate operational alerts from marketing messages.
- Do not send promotional messages merely because a guest has not opened the app.
- Do not send a “time to go” reminder for a cancelled or materially changed reservation without presenting the correct details.
- Make the venue, time and relevant action visible in the notification where supported.
- Respect device-level and app-level notification permissions.
- Preserve important messages in the in-app notification centre when push delivery is unavailable.

## 6.17 Personalisation and dining recommendations

Personalisation should reduce the effort of finding a suitable meal, not create a filter bubble or encourage disclosure of unnecessary personal information.

| ID | Priority | Requirement |
|---|---|---|
| DIN-257 | P1 | Allow guests to optionally select cuisine, ambience, dining style, price range and meal-period preferences. |
| DIN-258 | P1 | Use saved venues, explicit preferences and guest feedback as recommendation signals. |
| DIN-259 | P1 | Explain recommendations with a concise reason where practical. |
| DIN-260 | P1 | Allow guests to dismiss recommendations or change their preferences at any time. |
| DIN-261 | P1 | Balance recommendations across venue types and price ranges rather than repeatedly showing only premium options. |
| DIN-262 | P1 | Include included dining and low-cost options alongside paid experiences where relevant. |
| DIN-263 | P2 | Consider practical context such as current meal period, planned activities, reservation availability, walking distance and group size. |
| DIN-264 | P2 | Offer discovery modes such as “Something quick”, “A special meal”, “Try something new” or “Good with children”. |
| DIN-265 | P2 | Learn from completed dining visits only where attendance information is reliable and its use is disclosed. |
| DIN-266 | P2 | Support recommendations for a group based on shared preferences without disclosing individual dietary or health details. |
| DIN-267 | P3 | Support conversational dining discovery grounded in live venue, menu, reservation and package data. |
| DIN-268 | P3 | Offer intelligent meal planning for the rest of the voyage, with clear explanations and guest approval before bookings are created. |

**Recommendation guardrails**

- Do not infer sensitive personal characteristics from dining choices.
- Do not use allergy or health-related information for advertising or commercial targeting.
- Do not recommend a venue or menu item as suitable for an allergy unless the approved operational process supports that result.
- Clearly distinguish editorially featured venues, paid promotion and preference-based recommendations.
- Never recommend a closed venue or unavailable reservation slot as an actionable choice.
- Do not optimise recommendations solely for revenue or package upsell.

## 6.18 Guest feedback, service requests and service recovery

The app should provide a simple way to request help or report a problem while preserving a clear path to a human dining team.

| ID | Priority | Requirement |
|---|---|---|
| DIN-269 | P1 | Provide a clear contact or assistance action from venue, reservation and order screens. |
| DIN-270 | P1 | Allow guests to report common service issues such as an incorrect reservation, delayed order or unavailable menu item. |
| DIN-271 | P1 | Route requests to the appropriate dining, room-service or guest-services team with a reference and status. |
| DIN-272 | P1 | Show when a request has been received and whether the guest should expect a crew response. |
| DIN-273 | P1 | Provide a staff-assisted fallback for urgent, complex or safety-related issues. |
| DIN-274 | P2 | Offer a short post-meal rating and optional comment. |
| DIN-275 | P2 | Allow feedback about food quality, service, venue ambience, menu accuracy and accessibility as distinct topics. |
| DIN-276 | P2 | Allow guests to indicate “I would visit again” or “Show me similar venues”. |
| DIN-277 | P2 | Support an operational service-recovery workflow so an authorised team can acknowledge, assign and resolve a complaint. |
| DIN-278 | P2 | Avoid asking guests for feedback repeatedly during the same meal or voyage. |
| DIN-279 | P2 | Allow guests to provide feedback without making a public review or sharing their identity with other guests. |
| DIN-280 | P3 | Analyse recurring feedback themes using privacy-preserving aggregation. |
| DIN-281 | P3 | Offer an optional post-voyage dining summary or selected dining memories where approved. |
| DIN-282 | P3 | Use validated feedback to improve recommendations while allowing guests to control personalisation. |

## 6.19 Offline and low-connectivity experience

A guest should not need to purchase a general internet package simply to view core dining information, subject to the cruise line's shipboard network and access policies.

| ID | Priority | Requirement |
|---|---|---|
| DIN-283 | P0 | Make core dining pages available over the ship's local network without requiring general internet access where network architecture permits. |
| DIN-284 | P0 | Cache the venue directory, current and upcoming menus, hours, location information, dining reservations and the guest's last-synced preferences. |
| DIN-285 | P0 | Show the last successful sync time and explain when cached information may be out of date. |
| DIN-286 | P0 | Keep cached venue, menu and reservation details readable when the device temporarily loses connectivity. |
| DIN-287 | P0 | Do not represent a reservation, queue, order, cancellation or account transaction as complete while it is only queued locally. |
| DIN-288 | P0 | For actions requiring a server, provide clear pending/error states and a safe retry path. |
| DIN-289 | P1 | Queue safe, non-transactional preference changes for synchronisation when connectivity returns. |
| DIN-290 | P1 | Prioritise compact text and menu data; load optional imagery only when needed. |
| DIN-291 | P1 | Provide a graceful fallback when push notifications or background refresh are unavailable. |
| DIN-292 | P2 | Support a lightweight downloadable or printable dining summary for guests who prefer an offline reference. |
| DIN-293 | P2 | Allow guests to view previously confirmed reservations and dietary acknowledgement details offline, with a clear last-sync label. |

**Offline transaction rule:** A cached menu is the last known version, not a guarantee that an item remains available. No reservation, waitlist, order, cancellation or account action may be shown as confirmed until the authoritative service confirms it.

---

## 7. Operational and crew-facing requirements

A guest app cannot deliver a dependable dining experience unless shipboard teams can maintain venue information, menus, table inventory, dietary workflows and service changes quickly and accurately. Operational tools are part of the product scope, not an optional back-office enhancement.

## 7.1 Venue, hours and menu management

| ID | Priority | Requirement |
|---|---|---|
| OPS-001 | P0 | Provide an authorised interface for creating, editing, publishing and closing dining venues for a specific ship and sailing. |
| OPS-002 | P0 | Support venue templates and ship-specific overrides for cuisine, service model, hours, location, charges and policies. |
| OPS-003 | P0 | Support date-specific hours and meal periods, including itinerary changes and exceptions. |
| OPS-004 | P0 | Provide structured menu and dish management with prices, descriptions, dietary labels, allergen data and effective dates. |
| OPS-005 | P0 | Require designated approval for menu ingredients, allergen information, dietary claims and price changes. |
| OPS-006 | P0 | Support menu versioning, effective dates, publication timestamps and an audit trail. |
| OPS-007 | P0 | Validate required venue and menu fields before publishing. |
| OPS-008 | P0 | Preview how venue and menu content will appear in discovery, venue details, search and booking. |
| OPS-009 | P0 | Provide urgent mobile-friendly controls for authorised staff to change hours, close a venue or mark an item unavailable. |
| OPS-010 | P0 | Ensure changes to published content invalidate or update guest caches through the defined sync process. |
| OPS-011 | P1 | Support bulk menu upload and integrations with approved menu/POS systems. |
| OPS-012 | P1 | Support recurring menus and copy-forward while requiring date, price, ingredient and allergen revalidation. |
| OPS-013 | P1 | Provide content-completeness checks for missing descriptions, prices, allergen fields, translations and images. |
| OPS-014 | P2 | Support centrally defined taxonomies and terminology with controlled ship-level variations. |

## 7.2 Reservation, table and seating management

| ID | Priority | Requirement |
|---|---|---|
| OPS-015 | P0 | Define the authoritative source for dining inventory, reservation availability, seating assignments and table status. |
| OPS-016 | P0 | Support venue-specific booking rules, party-size limits, reservation windows and cancellation policies. |
| OPS-017 | P0 | Protect reservation transactions against duplicate or conflicting updates. |
| OPS-018 | P0 | Provide authorised crew tools to view, create, modify and cancel reservations according to role permissions. |
| OPS-019 | P0 | Support traditional dining assignments and table/rotation records where applicable. |
| OPS-020 | P0 | Support check-in and seating workflows for reserved and walk-in guests. |
| OPS-021 | P0 | Provide a manual fallback when scanners, guest devices or network connectivity fail. |
| OPS-022 | P1 | Provide a live operational view of reservations, check-ins, occupied tables, available tables and waitlist demand where reliable. |
| OPS-023 | P1 | Support table configuration, table-combination rules and constraints for accessible seating. |
| OPS-024 | P1 | Support no-show rules, grace periods and reservation release policies configured by venue. |
| OPS-025 | P1 | Support linking reservations across guest accounts or cabins while preserving the correct party and payment details. |
| OPS-026 | P1 | Provide operational warnings for overbooking, table conflicts and impossible turn/cleaning times. |
| OPS-027 | P2 | Support demand and seating forecasts using historical and current operational data. |
| OPS-028 | P2 | Provide a venue-facing tablet or host-stand mode for rosters, queue management and seating. |

## 7.3 Dietary, allergy and special-meal operations

| ID | Priority | Requirement |
|---|---|---|
| OPS-029 | P0 | Define the accountable owner and source of truth for ingredient, allergen and special-diet information. |
| OPS-030 | P0 | Route safety-critical allergy requests to an authorised dining/culinary workflow with explicit acknowledgement. |
| OPS-031 | P0 | Provide role-based access so only authorised staff can view guest allergy and sensitive dietary information. |
| OPS-032 | P0 | Record request status, responsible team, acknowledgement timestamp and any required follow-up. |
| OPS-033 | P0 | Keep allergy notes distinct from ordinary preferences and general meal comments. |
| OPS-034 | P0 | Ensure staff can flag a request as under review, confirmed, unable to accommodate or requiring direct guest discussion. |
| OPS-035 | P0 | Provide a workflow for ingredient substitution or menu changes to trigger allergen-data review. |
| OPS-036 | P1 | Link confirmed special-diet information to relevant reservations and service occasions. |
| OPS-037 | P1 | Support order-level alerts to the kitchen for approved allergy workflows without exposing unnecessary guest data. |
| OPS-038 | P1 | Record the operational acknowledgement or verification required by the ship's food-safety process. |
| OPS-039 | P1 | Support a crew-visible escalation path when a request is incomplete, unclear or cannot be met. |
| OPS-040 | P2 | Provide aggregated reporting on request volumes and fulfilment issues without exposing identifiable guest health details. |

## 7.4 Waitlist, order and delivery operations

| ID | Priority | Requirement |
|---|---|---|
| OPS-041 | P0 | Define the authoritative source for queue, waitlist, order and delivery status. |
| OPS-042 | P0 | Ensure order acceptance, cancellation and modification are reflected accurately in the POS/kitchen workflow. |
| OPS-043 | P0 | Provide staff tools to manage room-service orders and delivery destinations where the service is offered. |
| OPS-044 | P0 | Provide manual handling and communication fallbacks for device, scanner and network failures. |
| OPS-045 | P1 | Support virtual queue management, guest notification, grace period and table-ready acknowledgement. |
| OPS-046 | P1 | Provide a kitchen or service dashboard for accepted orders, preparation status, substitutions and delivery dispatch. |
| OPS-047 | P1 | Allow authorised staff to record unavailable items and publish the change to guest-facing menus. |
| OPS-048 | P1 | Support operational delivery zones and restrictions for public-location delivery. |
| OPS-049 | P2 | Provide kitchen load and delivery demand insights where source data is sufficiently accurate. |

## 7.5 Service management, governance and analytics

| ID | Priority | Requirement |
|---|---|---|
| OPS-050 | P0 | Define accountable owners for venue content, operating hours, menu content, pricing, allergen information, package rules and reservation policies. |
| OPS-051 | P0 | Keep internal operational notes separate from guest-facing descriptions. |
| OPS-052 | P0 | Require approval for changes to prices, allergen claims, age restrictions, reservation rules and material service policies. |
| OPS-053 | P0 | Maintain an audit trail showing who changed a venue, menu, reservation rule or guest-facing status and when. |
| OPS-054 | P0 | Define an incident workflow for incorrect menu information, allergy escalations, booking failures and service outages. |
| OPS-055 | P1 | Support reusable content templates and approved terminology across ships. |
| OPS-056 | P1 | Support translation review and menu-content approval workflows. |
| OPS-057 | P1 | Measure venue views, menu views, saves, reservation starts, reservation completion, cancellations and attendance where available. |
| OPS-058 | P1 | Measure queue joins, wait time, table-ready notifications, no-shows and seating outcomes where reliable. |
| OPS-059 | P1 | Measure room-service order acceptance, fulfilment, delivery time, substitution and cancellation. |
| OPS-060 | P1 | Report dining demand by venue, meal period, day type, party size and price model. |
| OPS-061 | P1 | Track dining-related service requests and recurring guest complaints. |
| OPS-062 | P2 | Provide dashboards for venue utilisation, package use, guest satisfaction and menu performance. |
| OPS-063 | P2 | Support privacy-preserving analysis of demand and menu feedback. |
| OPS-064 | P2 | Provide controlled experimentation for venue discovery and booking UX without withholding essential dining or safety information. |

---

## 8. Information architecture and key screens

A recommended dining navigation structure is:

1. **Dining Today** — Open now, current meal periods, upcoming reservations, changes and practical suggestions.
2. **Explore** — Venue catalogue, search, cuisine, menu and dietary filters.
3. **Menus** — Current venue menus, dish details, prices and approved dietary/allergen information.
4. **My Dining** — Reservations, assigned seating, saved venues, dining preferences and dietary request status.
5. **Orders** — Room-service and mobile-order history/status where available.
6. **Ship Map** — Venue locations, deck details and accessible directions, linked from all relevant screens.

The broader cruise app may combine some of these destinations, but Dining, Explore and My Dining should remain prominent and easy to reach.

### 8.1 Dining Today screen

Recommended content hierarchy:

- Current ship day and ship time.
- Important dining changes affecting the guest.
- Upcoming confirmed dining reservation or assigned dining details.
- Open now / available now.
- Current meal-period venues and menus.
- Options that fit before or after the next planned activity.
- Saved venues and personal recommendations.
- Quick actions for room service, reservations and dietary-request status.

Avoid making the first screen a long, undifferentiated list of restaurants.

### 8.2 Explore screen

Recommended controls:

- Search bar for venues, cuisine and dishes.
- Date and meal-period selector.
- Venue-type filters.
- Open now, price/included, cuisine, family and accessibility filters.
- Dietary filters with clear safety caveats.
- Sort control.
- Venue cards with a consistent hierarchy.
- Map/list toggle where ship-map data is available.

### 8.3 Venue detail screen

Recommended order:

1. Venue name, type and current operating status.
2. Deck/location and map action.
3. Meal periods and today's hours.
4. Included/paid status, cover charge and package eligibility.
5. Reservation or walk-in action.
6. Current menu and menu date.
7. Cuisine, ambience and what to expect.
8. Age, dress, seating and accessibility information.
9. Dietary/allergy handling guidance.
10. Related venues and practical alternatives.

### 8.4 Menu and dish detail screen

Recommended order:

1. Venue, service date and meal period.
2. Menu version/update state.
3. Dish name and description.
4. Price or included status.
5. Verified dietary attributes.
6. Allergen information and appropriate caveat.
7. Item availability.
8. Permitted modifications.
9. Add/order/reservation action where supported.

### 8.5 My Dining screen

Recommended views:

- Daily agenda by default.
- Voyage calendar for looking ahead.
- Tabs/filters for Confirmed, Saved, Assigned, Waitlisted and Needs attention.
- Dining preferences and special request status.
- Package/credit summary where integrated.
- Venue navigation, arrival instructions and cancellation rules.

### 8.6 Room-service / Orders screen

Recommended content:

- Available service and delivery area.
- Menu and item availability.
- Fees, package coverage and delivery estimate.
- Order summary and confirmation.
- Progress/status and contact option.
- Previous orders, where useful and permitted.

### 8.7 Notification centre

Group messages by:

- Action required.
- Reservation updates.
- Dietary/special-request updates.
- Waitlist/table-ready alerts.
- Room-service/order updates.
- Venue/menu/hour changes.
- Reminders.
- Optional recommendations and promotions.

Critical service or safety-related information must not be buried beneath promotional content.

---

## 9. Core customer journeys and acceptance scenarios

The following journeys should be used in design reviews, usability testing and end-to-end acceptance testing.

### Journey A — Find somewhere to eat right now

**Scenario:** A guest has free time and wants to find an open venue without having to study the full dining directory.

1. Guest opens Dining Today.
2. App uses official ship time and displays open venues for the current meal period.
3. Guest filters by included options or a preferred cuisine.
4. Results show venue location, hours, menu, reservation/walk-in status and price information.
5. Guest opens a venue, reviews the menu and checks any relevant dietary information.
6. Guest reserves, checks in or navigates according to the venue's actual model.

**Pass conditions:** The venue is currently open; menu and pricing are current; any reservation requirement is clear; the app does not imply table availability without confirmation.

### Journey B — Plan specialty dining around a theatre production

**Scenario:** A couple wants to book a specialty restaurant and attend a theatre production afterward.

1. Guest opens the voyage planner or Dining.
2. Guest reviews specialty venues, menus, package eligibility and prices.
3. Guest selects a date and candidate dining time.
4. App checks the theatre booking and realistic travel time to the theatre.
5. If the meal is likely to conflict, the app explains the issue and suggests another time or venue.
6. Guest books the meal and receives an authoritative confirmation.
7. The dining reservation and theatre performance appear together in the daily plan.

**Pass conditions:** Booking status is authoritative; the total charge/credit use is clear; the app identifies practical timing risks without changing either booking automatically.

### Journey C — Communicate a food allergy

**Scenario:** A guest needs the ship to review a serious food allergy before dining.

1. Guest opens Dining Preferences and selects the allergy workflow.
2. App explains what information is required and that submission is not a safety guarantee.
3. Guest provides the requested details and submits the request.
4. App shows “Request received — awaiting dining-team review”.
5. An authorised dining/culinary team member reviews the request and updates the status.
6. Guest sees whether the request is confirmed, needs a conversation or cannot be accommodated as submitted.
7. At the venue, the guest follows the displayed crew-confirmation process.

**Pass conditions:** The allergy is not treated as an ordinary preference; it reaches an accountable team; the guest is not told that a dish is safe without approved verification; sensitive information is access-controlled.

### Journey D — A preferred restaurant has no availability

**Scenario:** A guest tries to reserve a popular specialty restaurant, but the preferred time is full.

1. Guest selects a venue and date.
2. App displays current availability from the authoritative booking service.
3. Guest sees that the preferred time is unavailable.
4. App offers genuinely available alternatives, another date or a supported waitlist.
5. Guest chooses an alternative or joins the waitlist.
6. App displays the correct state, deadline and conditions.

**Pass conditions:** No false availability is shown; waitlist status is not represented as a confirmed table; fees and package use are transparent.

### Journey E — Coordinate a family dinner

**Scenario:** A guardian wants a meal for two adults and two children before an evening show.

1. Guardian opens Dining and filters for family-friendly options.
2. App shows children's menu, age rules, high-chair information and available times.
3. Guardian selects a venue and party size.
4. App checks the planned show and realistic walking time.
5. Guardian confirms the reservation and shares the plan with authorised companions.
6. The reservation appears in the family planner with venue and arrival details.

**Pass conditions:** Child requirements and permissions are respected; group size is confirmed accurately; meal timing leaves a practical route to the show.

### Journey F — Join a walk-in queue

**Scenario:** A guest arrives at a busy restaurant without a reservation.

1. Guest opens the venue page or scans the venue's supported check-in code.
2. App explains the walk-in process and offers a virtual queue if available.
3. Guest joins the queue and sees the current state and estimated wait, if reliable.
4. Guest receives a table-ready notification.
5. Guest follows the arrival instructions and checks in.

**Pass conditions:** The app does not overstate wait-time certainty; the guest can see the queue state; there is a crew-assisted fallback.

### Journey G — Order food to a stateroom or approved public location

**Scenario:** A guest wants food delivered without visiting a restaurant.

1. Guest opens Room Service or Food Delivery.
2. App confirms the service is available for the current time and destination.
3. Guest browses items, sees prices, package coverage and dietary information.
4. Guest selects items and a valid delivery location.
5. App returns an order confirmation and expected delivery window where supported.
6. Guest follows status updates and can contact the team if the order is delayed or incorrect.

**Pass conditions:** Items and fees are current; the order is not marked accepted before the kitchen acknowledges it; delivery location is valid; changes and substitutions require clear communication.

### Journey H — Guest is offline or on a weak connection

**Scenario:** A guest is walking between decks and loses connectivity.

1. Guest opens My Dining.
2. Cached confirmed reservations, venue details and menus remain readable.
3. App displays the last sync time.
4. A booking, queue or order action requiring the server is unavailable or clearly marked pending—not confirmed.
5. When connectivity returns, the app refreshes and reports the authoritative result.

**Pass conditions:** No duplicate or false reservation/order is created; cached information is clearly marked; core dining details remain useful.

---

## 10. Data model and integration requirements

The customer experience depends on a consistent, voyage-aware dining information model with clear ownership of operational data.

### 10.1 Core entities

| Entity | Key information |
|---|---|
| Ship | Ship ID, name, deck configuration, time-zone/ship-time rules, map version and supported dining capabilities |
| Sailing | Sailing ID, ship ID, itinerary dates, voyage-day sequence, port/sea-day schedule and official time policy |
| Venue | Venue ID, ship ID, name, type, deck/location, service model, capacity, accessibility and operating policies |
| Venue service period | Venue, date, meal period, start/end time, service status and exceptions |
| Menu | Menu ID, venue, date/effective period, meal period, version and publication state |
| Menu item | Item ID, name, description, price, availability, ingredients, approved dietary attributes, allergen data and permitted modifications |
| Ingredient / allergen reference | Controlled ingredient/allergen identifier, display name, source, definition and approval/version details |
| Guest | Guest ID, sailing/booking relationship, permissions, language and required profile attributes |
| Dining preference | Guest, preference type, preference value, effective date, sharing/consent and update timestamp |
| Dietary/allergy request | Guest, request type, details required by policy, status, responsible team, acknowledgement and audit history |
| Reservation | Reservation ID, guest(s), venue, date/time, party size, status, confirmation reference, price/credit treatment and policy snapshot |
| Table / seating assignment | Table ID, venue, capacity, accessibility attributes, assignment, rotation and seating state |
| Waitlist entry | Queue ID, guest/party, venue, party size, join time, status, response deadline and seating result |
| Order | Order ID, guest, items, quantities, price, package treatment, delivery location, status and timestamps |
| Order item | Item, quantity, modifications, item availability, allergy workflow reference and price |
| Account transaction | Guest/account, order or reservation reference, charge/credit, amount, currency and transaction state |
| Package entitlement | Guest, package, eligible venue/item, remaining benefit, restrictions and authoritative balance state |
| Venue/menu change | Entity, old/new values, reason, publisher, timestamp and affected guests/transactions |
| Notification | Guest, type, related venue/reservation/request/order, channel, delivery state and read state |
| Feedback / service request | Guest or pseudonymous identifier, venue/order/reservation, topic, status, rating/comment and timestamp |

### 10.2 Key integration points

- **Dining reservation/table-management system:** Source of truth for reservation inventory, booking rules, table assignment, check-in and seating.
- **POS and restaurant operations:** Source of truth for item prices, orders, order status, availability, substitutions and onboard-account charges.
- **Menu/recipe/food-safety systems:** Source of truth for ingredients, allergen data and approved dietary information.
- **Guest identity and booking system:** Guest eligibility, sailing association, party membership, cabin relationship and permissions.
- **Onboard account/payment system:** Charges, package entitlements, credits, receipts and transaction status.
- **Dining package/loyalty system:** Reservation windows, package coverage, dining credits and applicable guest benefits.
- **Ship deck-plan/wayfinding service:** Venue coordinates, deck routing and accessible paths.
- **Unified cruise planner:** Entertainment, shore excursions, spa, youth programming and other commitments relevant to meal planning.
- **Room-service/kitchen dispatch service:** Order acceptance, preparation, dispatch and delivery status.
- **Notification platform:** Push, in-app and other approved shipboard channels.
- **Shipboard Wi-Fi/local network services:** App access, local data delivery and sync.
- **Analytics platform:** Aggregated discovery, conversion, attendance, fulfilment and satisfaction metrics.

### 10.3 Data and API principles

- Every venue, menu, reservation and service period must be scoped to a specific ship and sailing where applicable.
- Use stable identifiers; never rely on venue or dish names as unique identifiers.
- Version menus, ingredient/allergen data and pricing with effective dates.
- Preserve the operational source and last-updated timestamp for critical information.
- Use idempotent reservation and order operations to prevent duplicate transactions.
- Revalidate inventory and pricing at the point of booking or order submission.
- Use event-driven updates where possible, with polling/refresh as a resilience fallback.
- Provide version numbers or change tokens for cache invalidation and offline synchronisation.
- Define retention periods and access controls for dietary/allergy information, dining preferences, order history and attendance.
- Avoid storing or exposing more guest data than the feature requires.
- Ensure package and account balances are sourced from the authoritative account service rather than inferred from app-side calculations.

---

## 11. Non-functional requirements

### 11.1 Performance

| ID | Priority | Requirement |
|---|---|---|
| NFR-001 | P0 | Dining home, venue directory and cached menu content should render quickly on representative mid-range phones under shipboard network conditions. Establish and test a measurable performance budget before launch. |
| NFR-002 | P0 | Search and filtering should return useful results without a full-page reload. |
| NFR-003 | P0 | Menu and venue pages should prioritise essential text, opening hours and availability before optional imagery. |
| NFR-004 | P1 | Use pagination, incremental loading or date scoping for large menu and venue catalogues. |
| NFR-005 | P1 | Compress and appropriately size menu/venue images; load optional media on demand. |

### 11.2 Reliability and resilience

| ID | Priority | Requirement |
|---|---|---|
| NFR-006 | P0 | The app must handle intermittent connectivity without losing saved dining preferences or plans. |
| NFR-007 | P0 | Reservation and order actions must return authoritative transaction results and recover safely from timeouts. |
| NFR-008 | P0 | Menu, price, allergen and venue-hour changes must propagate within a defined service level and be monitored for failures. |
| NFR-009 | P0 | The guest interface must fail gracefully if a non-essential integration is unavailable. |
| NFR-010 | P0 | The system must prevent stale or incomplete data from being presented as a confirmed safety, price, booking or fulfilment result. |
| NFR-011 | P1 | Provide operational monitoring for reservation sync, menu publication, package entitlements, order processing and notification delivery. |

### 11.3 Security and privacy

| ID | Priority | Requirement |
|---|---|---|
| NFR-012 | P0 | Protect guest information in transit and at rest using approved security controls. |
| NFR-013 | P0 | Enforce authentication and authorisation for guest, guardian, crew and administrator actions. |
| NFR-014 | P0 | Apply least-privilege access to operational and guest dietary/allergy information. |
| NFR-015 | P0 | Obtain appropriate permission before sharing dining plans or guest profile information with companions. |
| NFR-016 | P0 | Protect allergy and dietary information as sensitive personal information and limit its use to the approved service purpose. |
| NFR-017 | P0 | Do not expose child profiles, dietary details or account information to unauthorised guests. |
| NFR-018 | P0 | Provide clear privacy notices and controls for personalisation, analytics and data sharing. |
| NFR-019 | P1 | Minimise retention of preference, order, location and attendance data. |
| NFR-020 | P1 | Log privileged operational changes and provide an audit trail for sensitive request handling. |

### 11.4 PWA and device support

| ID | Priority | Requirement |
|---|---|---|
| NFR-021 | P0 | Deliver a responsive mobile-first experience for current supported iOS and Android browsers. |
| NFR-022 | P0 | Support installable PWA behaviour where supported, while keeping installation optional. |
| NFR-023 | P0 | Cache essential app shell, venue directory, menus, reservation details and personal dining preferences using an explicit freshness strategy. |
| NFR-024 | P0 | Do not make core dining information dependent on push notification support. |
| NFR-025 | P1 | Support deep links from notifications, QR codes, venue signage and shared dining links. |
| NFR-026 | P1 | Test device rotation, text scaling, low-power modes and browser lifecycle behaviour. |
| NFR-027 | P1 | Define graceful fallbacks for platform-specific PWA limitations, including background sync and notification-permission differences. |

### 11.5 Accessibility and localisation

- Target WCAG 2.2 AA for the guest-facing experience.
- Support localisation of dates, times, number formats, prices and currency presentation.
- Keep ship time explicit; do not let phone-local time create ambiguity.
- Provide translated menu and dining information only when translations are approved and current.
- Ensure iconography has accessible names and does not replace meaningful text.
- Make menu images and visual content available in accessible text formats.
- Support appropriate language and text-size options for allergy and special-diet information.

---

## 12. Measurement framework and success metrics

The product should measure whether guests can find and enjoy dining experiences that suit them—not merely whether they open the app or make more paid reservations.

### 12.1 North-star outcome

**Successful dining experiences per occupied guest-day**, interpreted alongside dining satisfaction, service quality, dietary-request fulfilment and guest choice. This should not be used to pressure guests into more meals, more paid venues or unnecessary app interactions.

### 12.2 Core KPIs

| KPI | What it tells us | Suggested measurement |
|---|---|---|
| Dining information reach | Whether guests can see the options | Unique guests viewing dining/venue/menu information / eligible occupied guests |
| Venue discovery depth | Whether guests explore the range of options | Venue detail views and category breadth per engaged guest |
| Menu engagement | Whether menus help guests make choices | Menu views, dish detail views and saved items |
| Reservation conversion | Whether interested guests can complete bookings | Confirmed reservations / reservation starts |
| Reservation reliability | Whether booking is trustworthy | Booking error rate, duplicate prevention, pending-to-final resolution time |
| Reservation utilisation | Whether booked tables are used | Seated guests / confirmed reservations, adjusted for venue policy |
| No-show rate | Whether capacity is wasted | No-shows / confirmed reservations |
| Waitlist conversion | Whether capacity is reused | Waitlisted parties seated / waitlist offers |
| Venue utilisation | Whether demand is distributed effectively | Covers or seating utilisation by venue and meal period |
| Package benefit utilisation | Whether guests understand and use their entitlements | Confirmed eligible benefits used / available eligible benefits |
| Order fulfilment | Whether mobile/room-service orders are completed reliably | Delivered orders / accepted orders; cancellation and substitution rate |
| Delivery performance | Whether delivery expectations are met | Actual delivery time versus communicated estimate |
| Dietary request fulfilment | Whether special needs are acknowledged and handled | Requests acknowledged and operationally resolved / requests submitted |
| Menu accuracy | Whether guests see current information | Menu/item corrections, stale-menu incidents and price discrepancies |
| Plan usefulness | Whether the planner helps guests coordinate meals | Planner usage, conflict avoidance/resolution and survey feedback |
| Dining satisfaction | Whether guests enjoy the experience | Post-meal and post-cruise survey results, supported by qualitative feedback |
| Service recovery | Whether problems are resolved | Time to acknowledge and resolve dining requests/complaints |

### 12.3 Guardrail metrics

- Complaints related to inaccurate menus, hours, pricing or venue information.
- Allergy/dietary communication incidents and unresolved special requests.
- Reservation failures, duplicate bookings and false confirmations.
- Guest complaints caused by package/credit misunderstandings.
- Notification opt-out and disable rates.
- Room-service cancellations, missing orders and delivery complaints.
- Accessibility-related complaints and incomplete venue data.
- Guest-service contacts caused by app confusion.
- Privacy complaints or unauthorised access to dietary information.
- Percentage of menus with missing or stale essential metadata.

### 12.4 Analytics principles

- Use aggregated reporting wherever possible.
- Do not treat higher spending or specialty-dining conversion as equivalent to better guest experience.
- Do not use identifiable allergy or health-related information for marketing or commercial profiling.
- Compare similar sailing lengths, ship classes, venue types and meal periods where possible.
- Validate reservation, seating and delivery data quality before treating it as actual attendance or fulfilment.
- Interpret venue utilisation alongside guest satisfaction, food quality, service capacity and operational constraints.

---

## 13. Recommended delivery roadmap

The sequence intentionally puts trustworthy information, dietary safeguards, reservations and operational reliability ahead of advanced personalisation or automation.

### Release 1 — Trusted dining companion (P0)

**Customer promise:** “I can understand my dining options, see the menu and manage my basic dining plans with confidence.”

Deliver:

- Voyage-specific dining venue directory and venue detail pages.
- Accurate opening hours, meal periods, location and dining model.
- Current menus with prices/included status and essential item descriptions.
- Clear distinction between included, chargeable, package-eligible and cover-charge dining.
- Basic menu search and essential filters.
- Dining reservation visibility and booking actions wherever an authoritative service exists.
- Traditional dining assignment details where applicable.
- My Dining plan with saved venues and confirmed reservations clearly separated.
- Basic conflict warnings against other commitments available to the app.
- Dietary preference and allergy request capture with explicit acknowledgement and staff workflow.
- Material venue, menu and reservation change handling.
- Basic reminders and in-app notification centre.
- Venue deck/location information and ship-map links.
- Cached venue, menu and reservation information with clear offline/sync states.
- Crew content management for hours, menus, charges and urgent changes.
- Core operational audit trail, privacy controls and measurement.

**Release gate:** No launch until venue/hour accuracy, menu versioning, charge transparency, reservation-state accuracy, allergy-request routing, access controls, ship-time handling and offline transaction messaging have passed end-to-end tests on representative sailings.

### Release 2 — Book, coordinate and dine with confidence (P1)

**Customer promise:** “The app helps me choose the right place, get a table, coordinate my party and fit meals into my day.”

Deliver:

- Live reservation availability, modification and cancellation where supported.
- Group reservations and linked party coordination.
- Waitlists, table-ready alerts and check-in workflows where operationally supported.
- Meal-time and seating preferences.
- Menu filters for verified dietary attributes, accessibility and family needs.
- Dining package/credit visibility and clearer account integration.
- Unified planning with theatre, live music, Movies Under the Stars, excursions, family programming and appointments.
- Room-service/mobile-order integration and order status where available.
- Improved special-diet acknowledgement and crew-facing workflows.
- Deck-aware directions and practical walking-time estimates.
- Better alternatives when venues close, slots fill or menus change.
- Operational dashboards for seating, reservations, queues and menu updates.

### Release 3 — Personal, flexible and seamless dining (P2)

**Customer promise:** “Dining feels tailored to my tastes, my party and the way I want to spend the day.”

Deliver:

- Curated dining discovery and context-aware recommendations.
- Richer menu imagery, dish information and culinary storytelling.
- Improved family and companion planning.
- Table-side menus, service requests and ordering where appropriate.
- More capable room-service and delivery experience.
- Improved accessibility, language and sensory information.
- Better package-use overview and voyage dining itinerary.
- Advanced venue utilisation, feedback and service-recovery dashboards.
- Post-meal feedback and preference refinement.

### Release 4 — Intelligent dining companion (P3)

**Customer promise:** “The app helps me make good dining decisions and adapts when my plans or shipboard conditions change.”

Potential capabilities:

- Conversational venue and menu discovery grounded in live ship data.
- Intelligent voyage-wide meal suggestions and schedule optimisation.
- Predictive queue and delivery estimates when operational data is sufficiently reliable.
- Smart re-planning after venue closures, show changes or reservation disruptions, always requiring guest approval.
- Optional, consent-based location-aware delivery and wayfinding.
- Personal dining highlights and post-voyage memories.
- Advanced group planning and preference coordination with privacy safeguards.

---

## 14. Key product decisions to resolve before detailed design

These decisions affect architecture, shipboard operations, safety and customer expectations. Resolve them early rather than leaving them to individual feature teams.

1. **Venue source of truth:** Which platform owns venue identity, dining type, location, hours, status and service model?
2. **Menu source of truth:** Which system owns current menus, ingredients, prices, dietary tags, allergen declarations and item availability?
3. **Menu freshness:** How quickly can menu changes, substitutions and sold-out items reach guest devices?
4. **Allergy workflow:** Which team owns review and acknowledgement of allergy requests, what information is required and what is the approved guest-facing assurance language?
5. **Food-safety authority:** Which system and operational process are authoritative for ingredients, cross-contact controls and special meal preparation?
6. **Reservation scope:** Which venues and meal periods can be reserved, and which remain walk-in or assigned seating?
7. **Dining model by ship:** How are traditional dining, flexible dining, open seating and specialty reservations represented consistently?
8. **Capacity reliability:** Can the system provide live availability, approximate wait times or only periodic snapshots?
9. **Table management:** Which system owns table inventory, party size, seating assignment, table combination and check-in?
10. **Waitlist operations:** Who manages the queue, what is the response window and how are unclaimed tables released?
11. **Group booking:** Can a guest coordinate linked reservations across cabins, and what happens when the group cannot be seated together?
12. **Package entitlements:** Which service owns dining credits, specialty benefits, package restrictions and remaining balances?
13. **Pricing and charges:** How are cover charges, à la carte prices, delivery fees, gratuities/service charges and currency represented?
14. **Ordering scope:** Which venues support mobile ordering, table ordering, room service or delivery to public locations?
15. **Order fulfilment:** Which system owns order acceptance, preparation, substitution, dispatch and delivery state?
16. **Guest identity:** Can one guest manage their own plans and authorised family members without exposing private account or dietary details?
17. **Unified planner:** Which dining, entertainment, excursion, spa and youth-programme commitments can be integrated?
18. **Wayfinding:** Is indoor routing sufficiently accurate for deck-aware and accessible walking-time estimates?
19. **Offline architecture:** Which dining services are available on the ship's local network, and what menu and reservation data can be cached safely?
20. **Notification channels:** Which push, in-app and shipboard channels are supported, and what is the fallback when push is unavailable?
21. **Content ownership:** Who approves venue descriptions, menus, ingredient/allergen details, prices, translations and daily changes?
22. **Shipboard staffing:** Who handles urgent menu changes, allergy escalations, reservation issues and order-service incidents during every operating period?
23. **Privacy and retention:** How will dietary/allergy information, dining preferences, order history and location-related information be protected and retained?
24. **Commercial presentation:** How will included dining, package entitlements, paid dining and promotional placements be represented transparently?
25. **Accessibility and language:** Which accessibility details and translations can be maintained accurately for each venue and menu?

---

## 15. Highest-risk failure modes and mitigations

| Failure mode | Customer impact | Mitigation |
|---|---|---|
| Incorrect venue hours or status | Guest walks to a closed venue or misses a meal | Single source of truth, date-specific hours, change workflow, freshness indicators and publication monitoring |
| Stale or incorrect menu | Guest chooses a dish that is unavailable or materially different | Menu versioning, effective dates, item availability updates and clear sample-menu labels |
| Inaccurate allergen information | Potential serious harm and loss of trust | Approved data ownership, explicit unknown state, staff acknowledgement, human escalation and no unsupported “allergen-free” claims |
| Allergy request is captured but never reaches staff | Guest believes the ship is prepared when it is not | Responsible queue, acknowledgement status, audit trail, escalation and pre-sailing operational reconciliation |
| False reservation confirmation | Guest arrives expecting a table that does not exist | Authoritative transaction response, explicit booking states, idempotency and end-to-end testing |
| Stale table availability | Guest wastes time trying to reserve an unavailable slot | Revalidate at booking, define refresh intervals and show honest status |
| Package or price confusion | Unexpected bill and reduced trust | Explicit price/credit treatment before booking and order, clear package rules and authoritative account data |
| Reservation conflicts with theatre or excursion | Guest misses an activity or rushes through a meal | Unified planner, realistic walking time and soft/hard conflict detection |
| Poor group reservation handling | Party is split unexpectedly or some guests are unbooked | Linked reservation support and explicit partial-confirmation results |
| Misleading wait estimate | Guest waits longer than expected or misses other plans | Reliable data threshold, estimate ranges, update timestamp and clear uncertainty |
| Order is accepted but not received | Guest loses time and confidence in delivery | Kitchen/POS acknowledgement, order tracking, delivery status and service recovery path |
| Digital ordering displaces hospitality | Guests feel forced to use a phone or cannot get help | Optional mobile service, staffed alternative and inclusive design |
| App depends on internet access | Dining information or plans fail onboard | Ship-local access, caching, sync state and no false transaction success |
| Poor accessibility data | Guest arrives at an unsuitable venue or cannot use the menu | Specific verified attributes, crew assistance route and accessibility testing |
| Sensitive dietary data is overexposed | Privacy breach and loss of trust | Least-privilege access, granular sharing, encryption, audit trail and retention limits |
| Too many notifications | Guests disable app notifications | Separate operational and promotional controls, quiet hours, deduplication and relevance rules |
| Incomplete dining catalogue | Guests discover options only by walking past them | Content completeness dashboard, accountable owners and publishing checklist |
| Recommendation favours paid dining | Guests perceive the app as an upsell tool | Transparent promotion labels, included alternatives and customer-value ranking rules |

---

## 16. Launch readiness checklist

### Guest experience

- [ ] Every venue belongs to the correct ship and sailing.
- [ ] Dining Today uses official ship time and correct service hours.
- [ ] Venue pages show dining type, hours, location, reservation model and charge model.
- [ ] Current menus are associated with the right venue, date and meal period.
- [ ] Prices, cover charges, package eligibility and delivery fees are clear.
- [ ] Guests can search, filter, save and compare venues.
- [ ] My Dining distinguishes saved venues from confirmed reservations.
- [ ] Traditional dining assignments are represented correctly where applicable.
- [ ] Conflict warnings are tested against realistic meal durations and walking times.
- [ ] Material venue, menu and reservation changes are visible in all relevant surfaces.
- [ ] Notifications and quiet-hour preferences work as designed.
- [ ] Venue/map links resolve to the correct ship location.
- [ ] Core dining information remains useful on weak or unavailable connectivity.
- [ ] Screen-reader, contrast, text-scaling and keyboard/focus tests pass.

### Dietary and food-safety workflows

- [ ] Allergy requests are distinct from ordinary dietary preferences.
- [ ] Allergy request submission clearly states that submission is not a safety guarantee.
- [ ] Requests route to an accountable operational team.
- [ ] Staff acknowledgement and escalation states are available.
- [ ] Unknown allergen data is not represented as absence.
- [ ] Ingredient substitutions trigger the required review/update process.
- [ ] Sensitive dietary information is protected by role-based access.
- [ ] Guest-facing language and crew procedures have been reviewed by the appropriate food-safety authority.

### Reservations, orders and operations

- [ ] Reservation inventory comes from an authoritative service.
- [ ] Success, pending and failure states are handled correctly.
- [ ] Duplicate reservation/order requests are safely prevented.
- [ ] Cancellation and no-show rules are clear.
- [ ] Package and account treatment is correct before a chargeable action.
- [ ] Crew can publish urgent venue-hour and menu changes.
- [ ] Crew can check in and seat guests and use a manual fallback.
- [ ] Waitlist rules are documented and staffed before the feature is enabled.
- [ ] Room-service/order status is authoritative where integrated.
- [ ] Support teams have a service-recovery workflow for booking and order issues.

### Content and governance

- [ ] Owners are assigned for each venue, menu and operational data field.
- [ ] Required metadata validation is enforced.
- [ ] Menu and allergen information has approved ownership and review.
- [ ] Venue and menu descriptions are understandable without internal jargon.
- [ ] Age, price, package, language and accessibility details are reviewed.
- [ ] Translations are approved where offered.
- [ ] Images and media have approved usage rights.
- [ ] Menu changes have a clear publishing process and escalation path.

### Measurement and support

- [ ] Discovery, reservation, seating, menu and order metrics are defined.
- [ ] Dietary-request fulfilment and escalation measures are defined.
- [ ] Data retention and privacy rules are approved.
- [ ] Guest support teams have troubleshooting guidance.
- [ ] Shipboard staff know how to correct menu, venue and reservation errors.
- [ ] A feedback loop exists for guests and dining teams.

---

## 17. Recommended MVP definition

For a first customer-facing release, resist the temptation to launch every advanced feature. The minimum experience should be small enough to deliver reliably but complete enough to solve a meaningful customer problem.

**MVP must include:**

1. A complete and accurate voyage-specific dining venue directory.
2. Venue detail pages with hours, location, dining model, price/included status, age guidance and reservation rules.
3. Current menus with descriptions, prices and approved essential dietary/allergen information.
4. Search and useful filters for venue type, meal period, opening status and price/included status.
5. A Dining Today view and voyage dining calendar.
6. A personal dining plan with saved venues and confirmed reservations clearly separated.
7. Reservation visibility and booking actions wherever an authoritative service exists.
8. Traditional dining assignment information where applicable.
9. Basic conflict warnings against available entertainment and excursion commitments.
10. Dietary preference and allergy request capture with explicit caveats, operational acknowledgement and access controls.
11. Material venue, menu and reservation change handling.
12. Basic reminders and notification centre.
13. Venue locations and ship-map links.
14. Cached venue, menu and reservation access with honest offline/sync states.
15. Crew tooling to publish venue/menu changes and maintain essential information.
16. Basic discovery, reservation, dietary-request and service-quality measurement.

**Do not call it a dining-management experience if it only provides a restaurant directory and booking buttons.** The minimum customer value comes from connecting venue discovery, menu transparency, safe dietary communication and a personal dining plan—and keeping that information accurate when onboard reality changes.

---

## 18. Final recommendation

The biggest opportunity is to make onboard dining feel **personal, connected, transparent and effortless**. A traditional dining page tells a guest which restaurants exist. A well-designed dining companion helps that guest understand the options, choose a meal that suits their needs and budget, reserve at a practical time, communicate requirements, find the venue, manage an order and adapt when something changes.

The recommended strategic priorities are:

1. **Trustworthy dining information:** Complete, accurate, voyage-specific venue, hours, menu, price and status data.
2. **Safe dietary communication:** A clear distinction between preferences and allergies, with accountable staff acknowledgement and no unsupported safety claims.
3. **One personal dining plan:** Saved venues, confirmed reservations, dining assignments and other commitments brought together in a realistic daily itinerary.
4. **Frictionless reservations and arrival:** Understandable booking rules, reliable availability, group coordination, queues, reminders and navigation.
5. **Transparent value:** Clear package benefits, cover charges, menu prices, delivery fees and onboard-account treatment.
6. **Seamless service:** Room-service/mobile-order status, table-side tools and service recovery where supported by actual operations.
7. **Operational excellence:** Crew tools and governance that keep menus, hours, capacity, dietary requests and guest-facing information reliable.
8. **Resilience and inclusion:** A useful app across weak-connectivity conditions, different devices, languages, ages and accessibility needs.

The competitive advantage will not come from adding the largest number of digital dining features. It will come from joining the whole journey together so that guests can move naturally from **“Where should we eat?” → “That looks good” → “Can we get a table?” → “They understand what we need” → “Let's enjoy the meal” → “What's next?”**

The experience should also understand that dining is part of a larger onboard day. A guest should be able to choose a dinner time that works with a theatre production, enjoy a quick lunch before going ashore, find a late snack after live music or coordinate a family meal around children's programming—without having to manage several disconnected systems.

---

## 19. Reference points and further reading

The following official cruise-line materials provide examples of customer-facing dining and app capabilities. They are reference points for product patterns, not a claim that every feature is available on every ship, sailing, fare or guest profile. Capabilities and operating policies can vary by vessel and may change.

### Princess Cruises

- [Personalized Cruise Dining and dining reservations](https://www.princess.com/en-int/cruise-dining/dining-reservations) — Describes flexible dining times, main dining room and specialty restaurant reservations, dietary preferences, travel-party coordination and food/drink delivery through OceanNow.
- [Princess Cruise Dining](https://www.princess.com/en-int/cruise-dining) — Provides examples of included and specialty dining, dining packages, delivery and broader dining options.
- [Princess MedallionClass / Princess app information](https://www.princess.com/en-int/ships-and-experience/princess-medallionclass) — Reference point for integrating dining, onboard activity planning, ship navigation and app-based service experiences.
- [Princess OceanReady](https://www.princess.com/en-int/plan/oceanready) — Describes pre-cruise preparation and the app's role in dining reservations and OceanNow ordering.

### Carnival Cruise Line

- [Carnival HUB App](https://www.carnival.com/hub-app) — Describes making dinner reservations, checking in at participating venues, viewing menus and ordering food for delivery; also describes onboard use through the ship's internal Wi-Fi network.
- [Carnival HUB App — App Store description](https://apps.apple.com/ca/app/carnival-hub/id925117977) — Lists daily dining menus, venue hours, food/drink delivery, account information and onboard app capabilities.

### Disney Cruise Line

- [Disney Cruise Line Navigator App features](https://disneycruise.disney.go.com/faq/navigator-app/features/) — Describes dining details, dining schedule information, rotational dining, guest itineraries and special dietary requests.
- [Disney Cruise Line Navigator App](https://disneycruise.disney.go.com/en-ca/featured/navigator-app/) — Provides an overview of the app's onboard activities, dining details, planning and ship exploration features.
- [Disney Cruise Line Navigator App — App Store description](https://apps.apple.com/us/app/disney-cruise-line-navigator/id671153791) — Lists dining menus, children's menus, dining schedules, special requests and booked activity visibility.

### Standards and design reference

- [W3C Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/) — Recommended accessibility target for the guest-facing web experience.

---

**End of document**
