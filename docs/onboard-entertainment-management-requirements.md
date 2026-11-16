# Onboard Entertainment Management — Customer-Centred Product Requirements

**Document type:** Product vision, functional requirements and delivery priorities  
**Version:** 1.0  
**Prepared:** 10 November 2026  
**Primary audience:** Cruise product owners, customer-experience leaders, UX/UI designers, engineering teams, shipboard entertainment teams and digital operations  
**Product context:** A mobile-first cruise guest app, ideally delivered as a Progressive Web App (PWA), that helps guests discover, plan, reserve, coordinate and enjoy onboard entertainment.

---

## 1. Executive summary

A cruise ship is a moving resort with a constantly changing programme of performances, live music, movies, parties, games, classes, enrichment sessions, family activities and informal experiences. The guest's challenge is not simply finding a list of events. It is deciding **what is worth doing, what is possible right now, how to fit it into the day, how to get there, and how to enjoy it with other people**—without spending the holiday managing an app.

The entertainment experience should therefore be designed as a complete customer journey rather than a digital copy of the printed daily programme.

The recommended product is an **onboard entertainment companion** with five connected jobs:

1. **Discover:** Make the full programme easy to explore, understand and compare.
2. **Decide:** Help each guest identify experiences that fit their interests, age group, energy level, location and available time.
3. **Plan:** Build a realistic personal or group itinerary, with favourites, reservations, reminders and conflict detection.
4. **Act:** Make it easy to find the venue, understand current status, check in, join a standby queue and adapt when plans change.
5. **Remember and improve:** Capture feedback and use it to improve recommendations during the voyage and future sailings.

The strongest experience is not one that sends the most notifications or fills every hour. It is one that helps guests find the right experience at the right moment, while preserving the spontaneity and relaxation that make a cruise enjoyable.

### The central product promise

> **Never miss something you would love—and never feel that you need to manage your holiday to enjoy it.**

### Recommended order of investment

| Priority | Customer-value outcome | What must be delivered |
|---|---|---|
| **P0 — Essential** | Guests can trust the information and make a plan | Accurate voyage-specific schedule; rich event details; search and filters; personal planner; reservation status; reminders; venue locations; current changes; accessible, usable mobile experience; resilient onboard access |
| **P1 — High value** | Guests can make better decisions in the moment | Personalised discovery; schedule conflict detection; real-time availability and status; group planning; one-tap navigation; standby/waitlist; useful day-of recommendations; family-aware planning |
| **P2 — Differentiating** | Entertainment feels tailored, social and effortless | Curated itineraries; performer and show profiles; richer previews; smart replanning; context-aware suggestions; interactive participation; enhanced accessibility and language options; cross-device continuity |
| **P3 — Future innovation** | The app becomes an intelligent companion | Conversational discovery; predictive recommendations; opt-in location-aware prompts; crowd intelligence; personalised post-event memories; advanced companion coordination and adaptive programming |

A useful rule: **P0 is the trustworthy foundation; P1 makes the product genuinely helpful; P2 makes it memorable; P3 should only be pursued once the fundamentals are excellent.**

---

## 2. Product vision, goals and experience principles

### 2.1 Vision

Give every guest—whether a meticulous planner or a spontaneous explorer—a clear, personalised and reliable way to experience the best entertainment available on their specific ship and sailing.

### 2.2 Customer outcomes

The product should help guests:

- Know what is happening today, tonight and for the rest of the voyage.
- Discover experiences beyond the events they would normally notice by walking past a venue.
- Understand what an event actually involves before committing time to it.
- Save experiences they are interested in and build a useful personal itinerary.
- Reserve a place when necessary and understand exactly what a reservation guarantees.
- Avoid booking or planning overlapping activities.
- Coordinate plans with a partner, family or travel group without a long message exchange.
- Find the venue with confidence, including the correct deck and entrance.
- Receive important changes without being overwhelmed by promotional alerts.
- Make a good alternative choice when an event is full, cancelled, delayed or no longer suitable.
- Access core information even when internet connectivity is poor or unavailable.
- Use the service independently, regardless of age, ability, language or familiarity with the ship.

### 2.3 Business outcomes

The guest experience should also create measurable operational and commercial value:

- Improve awareness and attendance for the full range of onboard programming, not only headline shows.
- Reduce confusion at venues, queues and guest-service desks.
- Improve capacity utilisation and reduce unused reservations through confirmations, release rules and standby management.
- Improve guest satisfaction with the onboard experience.
- Help entertainment teams understand demand, discoverability and programme performance.
- Increase participation in lower-awareness activities and enrichment programming.
- Support appropriate revenue opportunities while keeping the experience useful and guest-first.
- Reduce printing, repetitive announcements and manual schedule-distribution work over time.

### 2.4 Experience principles

**1. Accuracy beats cleverness.** A beautiful recommendation is harmful if its time, venue or availability is wrong. All displayed information must come from the sailing's operational schedule and show a clear update state.

**2. The next useful action should be obvious.** A guest viewing an event should be able to save it, reserve it, share it, navigate to it or see a suitable alternative.

**3. Plan around the guest, not the event list.** The planner should bring together the guest's interests, reservations, preferred pace, group commitments and available time.

**4. Preserve spontaneity.** Guests should be able to explore what's happening now without first creating a profile or filling out preference forms.

**5. Never imply a booking that has not been confirmed.** Distinguish clearly between saved, requested, waitlisted, held, confirmed, checked in, cancelled and expired states.

**6. Make the ship understandable.** Venue names, deck references, map pins and directions must be consistent across the app, signage and crew terminology.

**7. Be respectful with notifications.** Send alerts that help a guest make a decision or avoid a problem, not generic reminders that add noise.

**8. Work in shipboard conditions.** Do not assume guests have purchased internet access or have a consistently strong connection. Core information should remain available over the ship's local network and from cached data where safe.

**9. Design for the whole travel party.** A cruise is often a shared experience, but each person may have different interests, schedules and permissions.

**10. Do not turn the holiday into a task list.** Support a full itinerary, but never make an empty calendar feel like a failure.

---

## 3. Scope and definition

### 3.1 In scope

The entertainment-management experience should cover the full range of scheduled and semi-scheduled onboard experiences, including:

- Main-theatre productions, musical productions, variety shows and headline performances.
- Comedy, magic, illusion, guest speakers and featured entertainers.
- Live music, piano bars, jazz, acoustic sets, bands, karaoke and sing-alongs.
- Movies, outdoor cinema, sporting broadcasts and special screenings.
- Deck parties, sailaway celebrations, themed evenings and seasonal events.
- Trivia, quizzes, game shows, audience participation and hosted competitions.
- Dance classes, demonstrations, workshops and social dancing.
- Enrichment talks, destination presentations, lectures, demonstrations and learning sessions.
- Fitness-adjacent recreation and participatory activities where they are scheduled as onboard events.
- Poolside programming, family activities and supervised youth-programme activities where the guest is authorised to view them.
- Special events, tastings, tournaments, art events and other ship-specific experiences.
- Venue-level recurring programming, such as a live musician performing several sets in one evening.

### 3.2 Adjacent experiences to integrate, not duplicate

Some experiences may be managed in dedicated app modules but should appear in the entertainment discovery and personal-planning experience when relevant:

- Dining reservations and dining times.
- Shore excursions and port-day schedules.
- Spa or paid activity appointments.
- Kids' club registrations and youth-programme schedules.
- Casino events and tournaments (not wagering transactions).
- Photo opportunities, special celebrations and retail events.
- Shipboard classes or services delivered by other departments.

The planner should present these commitments alongside entertainment so the guest sees one coherent day. Ownership of the underlying transaction can remain with the dedicated module.

### 3.3 Out of scope for the first release

- Replacing the ship's entertainment-management or show-production systems.
- Selling tickets for every event where no reservation or payment process currently exists.
- Replacing the stateroom television's complete video-on-demand platform.
- Live streaming copyrighted theatre performances to personal devices without the required rights and technical capability.
- Building a public social network or open-ended guest-to-guest messaging service as a prerequisite for entertainment planning.
- Using precise guest location continuously or making location sharing mandatory.

---

## 4. Guest segments and key jobs to be done

The product should serve different planning styles without forcing guests into rigid personas.

| Guest type / context | Primary job | Product response |
|---|---|---|
| The planner | Build a complete day or voyage itinerary in advance | Voyage-wide calendar, filters, saved events, reservations, conflict detection and a printable/shareable plan |
| The spontaneous guest | Find something enjoyable to do in the next 30–90 minutes | “Happening now”, “Starting soon”, nearby options and quick filters |
| The headline-show guest | Secure the major productions and avoid missing them | Show pages, performance times, reservation rules, reminders and alternatives |
| The couple | Find experiences they both want to attend | Shared shortlist, availability for both guests and simple plan sharing |
| The family organiser | Coordinate activities for adults and children | Age-aware discovery, child permissions, family timetable and youth-programme handoffs |
| The independent explorer | Discover talks, music, classes and less-obvious experiences | Editorial collections, topic filters, host profiles and personalised suggestions |
| The accessibility-conscious guest | Know whether the experience and route will work for them | Accurate accessibility details, venue access information, captions/language and clear assistance guidance |
| The repeat cruiser | Avoid seeing only the most obvious or familiar options | New-to-this-sailing discovery, personalised variety and content about featured performers or special events |
| The guest with limited connectivity | Check their plan and event details reliably | Cached schedule and saved plans, explicit sync state and safe handling of online-only actions |

---

## 5. Priority framework

Priorities are based on customer value, frequency of use, trust and operational importance—not implementation ease alone.

- **P0 — Essential:** Required for a credible and dependable launch. Failure materially damages the guest experience.
- **P1 — High value:** Strongly improves the guest journey and should be targeted for the first major enhancement release.
- **P2 — Differentiating:** Delivers a noticeably better experience and a reason to prefer the app.
- **P3 — Future:** Valuable when the data, operations and core customer experience are mature.

Where an item depends on a ship's actual operating model, the requirement should be implemented only for the applicable event types and vessels. The app must not create a reservation capability that the onboard operation cannot honour.

---

## 6. Guest-facing functional requirements

## 6.1 Entertainment home and “what's happening” overview

The entertainment home should answer, in seconds: **What is happening today, what should I consider next, and what have I already planned?**

| ID | Priority | Requirement |
|---|---|---|
| ENT-001 | P0 | Provide a dedicated Entertainment entry point from the app's primary navigation. It must be reachable without navigating through unrelated booking or account sections. |
| ENT-002 | P0 | Show a voyage-specific “Today” view based on the ship's official onboard date and time. Clearly indicate the current day of the sailing, port/sea-day context and ship time. |
| ENT-003 | P0 | Show the guest's saved and confirmed activities in a prominent “My Plan” area, separate from the general event programme. |
| ENT-004 | P0 | Provide quick access to “Happening now”, “Starting soon”, “Tonight” and “All events today”. |
| ENT-005 | P0 | Display key event information at a glance: title, start time, duration where known, venue, category, reservation requirement and current status. |
| ENT-006 | P0 | Make schedule changes visually distinguishable from the original schedule, including a concise explanation when possible. |
| ENT-007 | P1 | Offer a personalised “Recommended for you” area based on declared interests, saved events and activity patterns, with a clear way to tune or dismiss recommendations. |
| ENT-008 | P1 | Show a concise “You have time for…” area when there is an appropriate gap before the guest's next planned commitment. Recommendations must account for realistic travel time. |
| ENT-009 | P1 | Provide a “Near me” view only where location permission and ship-location accuracy support it; always provide a non-location alternative. |
| ENT-010 | P2 | Offer themed editorial collections such as “A great night at sea”, “Music lovers”, “Learn something new”, “Family favourites” or “Rainy-day picks”. |
| ENT-011 | P2 | Provide a voyage-level preview of signature events and one-off experiences, helping guests plan ahead without making every event feel like a booking task. |

**Acceptance criteria**

- A guest can open Entertainment and understand today's main options without entering a search query.
- The home view never mixes an unconfirmed reservation with a confirmed booking without a visible state label.
- A guest can move from a recommendation to its details and then to save, reserve or navigate in a small number of taps.
- If there are no personalised signals, the home view still offers useful popular, timely and varied events rather than appearing empty.

## 6.2 Complete event catalogue and event detail pages

A strong catalogue is the foundation for discovery, planning, notifications, wayfinding and reporting. Event data should be structured—not stored as a single block of promotional text.

### Minimum event information

Every event should support the following fields where applicable:

| Field | Requirement / customer benefit |
|---|---|
| Event title | Clear, guest-friendly name; avoid unexplained internal production labels. |
| Short description | A concise explanation of what the guest will experience. |
| Full description | More detail, including format, theme, audience participation and what to expect. |
| Event category and subcategory | Enables predictable browsing and filtering. |
| Date and start time | Based on the ship's official time; show the day of the voyage. |
| End time / duration | Helps guests judge whether the event fits between other plans. Mark estimates as estimates. |
| Venue | Venue name, deck, forward/midship/aft designation where used, and a map reference. |
| Performer / host | Name, role, image or biography when available and approved. |
| Reservation policy | Required, recommended, optional or not available; include the actual process. |
| Capacity / availability | Current availability where the data is operationally reliable. |
| Price / included status | State whether included, chargeable, complimentary with a package, or subject to a fee. Never hide a mandatory fee. |
| Age guidance | Suitable age range, age restriction or “all ages”; distinguish guidance from a formal rule. |
| Language | Spoken language and available interpretation or caption options. |
| Accessibility | Step-free access, wheelchair seating/access route, hearing/visual assistance, seating availability and relevant restrictions. |
| Dress / preparation | Attire, equipment, arrival time, participation requirements or other preparation. |
| Weather dependency | Indoor/outdoor status and what happens if weather changes. |
| Event series | Related sessions, repeat performances or a multi-part programme. |
| Status | Scheduled, delayed, moved, cancelled, full, registration closed, in progress or completed. |
| Last updated | Timestamp or a simple “Updated recently” indicator for operationally sensitive details. |
| Content ownership | Source department, content approver and operational contact for internal use. |

| ID | Priority | Requirement |
|---|---|---|
| ENT-012 | P0 | Provide a central, searchable catalogue containing all guest-facing entertainment and scheduled onboard activities for the current sailing. |
| ENT-013 | P0 | Provide an event detail page for each event with the minimum information listed above, using “not provided” only when the information is genuinely unavailable. |
| ENT-014 | P0 | Clearly show whether an event is complimentary, has a fee, is included in a package or requires a separate purchase. |
| ENT-015 | P0 | Distinguish mandatory age restrictions from suggested age suitability. |
| ENT-016 | P0 | Show reservation rules in plain language, including whether a booking is required, recommended or unavailable. |
| ENT-017 | P0 | Identify recurring events and individual sessions so a guest can tell whether they are viewing a single performance or an event series. |
| ENT-018 | P0 | Show the correct event date, ship time, venue and operational status consistently wherever the event appears. |
| ENT-019 | P1 | Include performer, host, speaker and production profiles, where approved, to make events more discoverable and engaging. |
| ENT-020 | P1 | Support images, short trailers, teaser clips, programme notes and content links, subject to rights and connectivity. |
| ENT-021 | P1 | Show what to expect: event format, audience participation, typical duration, arrival advice and whether guests may come and go. |
| ENT-022 | P1 | Explain what is included in the event and what is not—for example, whether a tasting, materials or special seating carries a charge. |
| ENT-023 | P1 | Provide accessible event attributes that can be filtered and read by assistive technologies. |
| ENT-024 | P2 | Support “similar events”, “more from this performer” and “other sessions in this series”. |
| ENT-025 | P2 | Support curated editorial content for signature productions, destination enrichment themes and featured entertainers. |
| ENT-026 | P3 | Offer richer event previews, such as optional audio introductions, behind-the-scenes material or performer Q&As, where content rights and production capacity permit. |

**Acceptance criteria**

- Every event displayed in the app is associated with the correct vessel, sailing and date.
- Event details identify any material fee, age restriction, reservation requirement and location before the guest commits.
- The same event has a consistent title, time and status in search, calendar, planner, notification and venue views.
- A schedule update changes the event record and propagates to all guest-facing surfaces within the agreed operational service level.

## 6.3 Search, browse and discovery

Search should work for guests who know what they want and for guests who do not yet know what they want.

| ID | Priority | Requirement |
|---|---|---|
| ENT-027 | P0 | Provide keyword search across event titles, descriptions, categories, performer/host names and venues. |
| ENT-028 | P0 | Provide category browsing with consistent names and icons. Suggested top-level categories: Shows, Music, Movies, Parties, Games, Classes, Enrichment, Family, Recreation and Special Events. |
| ENT-029 | P0 | Allow filtering by day, time range, event category, venue and reservation requirement. |
| ENT-030 | P0 | Allow guests to clear filters easily and see when a filter is active. |
| ENT-031 | P1 | Add filters for age suitability, price/included status, language, accessibility, indoor/outdoor and participation level. |
| ENT-032 | P1 | Support useful sort orders: starting soon, time, popularity/interest, recommended and venue. |
| ENT-033 | P1 | Provide discovery prompts such as “Something relaxing”, “Good for families”, “Learn something”, “Live music tonight” and “Under an hour”. |
| ENT-034 | P1 | Make “starting soon” results respect the real current ship time and exclude events that are already too late to attend. |
| ENT-035 | P2 | Generate curated collections from the actual sailing's programme rather than showing generic content that may not exist on the ship. |
| ENT-036 | P2 | Support preference-based recommendations, with transparent reasons such as “Because you saved two jazz performances”. |
| ENT-037 | P3 | Support natural-language discovery such as “Find something indoors after dinner” or “What can we do with children before the show?”. |

**Acceptance criteria**

- A guest can find a named show using a partial title or performer name.
- Search results never include events from another ship or sailing.
- Filters can be combined and produce an understandable result count.
- Empty search results offer ways to broaden the search rather than leaving the guest at a dead end.
- Recommendations do not conceal the full catalogue or rank paid experiences above relevant complimentary ones without disclosure.

## 6.4 Personal planner and voyage calendar

The personal planner is the centre of the experience. It should combine entertainment with other important commitments while preserving a clear distinction between a saved idea and a confirmed reservation.

| ID | Priority | Requirement |
|---|---|---|
| ENT-038 | P0 | Provide a day-by-day calendar covering the entire sailing, with an agenda/list view that is easy to use on a phone. |
| ENT-039 | P0 | Allow guests to add an event to their personal plan without making a reservation. Label it as saved or planned, not booked. |
| ENT-040 | P0 | Allow guests to remove, reschedule where applicable, or change reminder settings for a saved event. |
| ENT-041 | P0 | Display confirmed reservations and other relevant booked commitments alongside saved entertainment. |
| ENT-042 | P0 | Identify schedule overlaps and near-overlaps between planned events, reservations and imported commitments. |
| ENT-043 | P0 | Distinguish hard conflicts (two events at the same time) from soft conflicts (insufficient travel time or an event ending shortly before another begins). |
| ENT-044 | P0 | Show the event's venue and a route/map action directly from the planner. |
| ENT-045 | P1 | Provide a combined day view that includes dining reservations, shore excursions, appointments and other connected commitments, where integration permissions allow. |
| ENT-046 | P1 | Warn when the planned time between venues is unlikely to be sufficient, using walking time and realistic ship-layout routing rather than straight-line distance. |
| ENT-047 | P1 | Suggest alternative sessions when a guest adds an event that conflicts with another saved or confirmed item. |
| ENT-048 | P1 | Allow a guest to create multiple personal lists, such as “Must do”, “Maybe”, “For the kids” or “If we have time”. |
| ENT-049 | P1 | Support a voyage-wide view and a focused daily view without making guests repeatedly select the same date. |
| ENT-050 | P2 | Offer itinerary templates, such as a relaxed sea day, family afternoon, music evening or enrichment-focused day, using only actual scheduled events. |
| ENT-051 | P2 | Allow guests to set a preferred activity pace (light, balanced or full) and use it to shape suggestions—not to restrict their choices. |
| ENT-052 | P2 | Provide a shareable itinerary summary for authorised travel companions. |
| ENT-053 | P3 | Offer one-tap smart replanning when a key event is cancelled, moved or no longer fits. The guest must approve changes before the planner is modified. |

**Planner rules**

- A saved event is not a reservation.
- A reservation request is not a confirmed reservation.
- A confirmed reservation must include its booking details and any arrival/check-in instruction.
- A guest should be able to tell whether the event is a personal intention, an operational commitment or a recommendation.
- A cancelled event should remain visible in the change history or be clearly marked in the plan until the guest acknowledges or removes it.
- Guests must be able to keep personal notes or private labels without sharing them with companions by default.

**Acceptance criteria**

- Guests can build a full-day plan in agenda view with a small number of interactions.
- A booking imported from another module appears as a confirmed commitment and cannot accidentally be removed as if it were only a favourite.
- Adding an overlapping event triggers a clear warning and gives the guest a useful next action.
- The planner displays the ship's official time and does not silently convert event times to the phone's home time zone.

## 6.5 Reservations, tickets, capacity and standby

Reservation behaviour varies by ship, venue, event and sailing. The app must model those differences rather than force every event into one booking workflow.

### Required booking states

Use explicit states, with guest-friendly descriptions:

- **Saved:** Added to a personal list; no place is held.
- **Available:** A reservation can currently be requested.
- **Request submitted:** The system has received the request but has not yet confirmed it.
- **Confirmed:** A place is secured according to the event's rules.
- **Waitlisted:** The guest is in a queue; attendance is not guaranteed.
- **Standby available:** The guest may join an operational standby process.
- **Checked in:** The guest's attendance has been registered.
- **Cancelled:** The reservation has been cancelled.
- **Expired / no-show:** The reservation window has passed without the required action.

| ID | Priority | Requirement |
|---|---|---|
| ENT-054 | P0 | Display the event's reservation model clearly: no reservation, optional reservation, required reservation, ticketed or managed by crew. |
| ENT-055 | P0 | Where a booking service exists, allow eligible guests to reserve from the event detail page. |
| ENT-056 | P0 | Display the number of guests covered by the reservation and identify which guests are included. |
| ENT-057 | P0 | Return an explicit success, failure or pending result after each booking action; never infer success from a button tap. |
| ENT-058 | P0 | Provide a confirmation reference and the practical instructions: arrival time, check-in point, ticket/QR requirement, seating policy and cancellation deadline. |
| ENT-059 | P0 | Allow guests to view and manage their existing reservations from one place. |
| ENT-060 | P0 | Prevent duplicate bookings where the event's rules allow only one reservation per guest or performance. |
| ENT-061 | P0 | Explain capacity and availability accurately; do not show stale “available” inventory as guaranteed. |
| ENT-062 | P1 | Support cancellation and modification where allowed by the event's operational rules. |
| ENT-063 | P1 | Support waitlists or standby queues where the onboard team can operate and honour them. |
| ENT-064 | P1 | Notify a waitlisted guest when a place becomes available, with a clearly stated response deadline and an explicit acceptance step. |
| ENT-065 | P1 | Allow group reservations for multiple authorised guests and show whether all requested places were confirmed. |
| ENT-066 | P1 | Provide a clear reservation release policy for guests who do not intend to attend, helping capacity return to other guests. |
| ENT-067 | P1 | Support a QR code or digital confirmation for events that require ticket validation, with an accessible non-QR fallback. |
| ENT-068 | P2 | Offer a live standby/virtual queue experience with queue position or estimated wait only when the data is trustworthy. |
| ENT-069 | P2 | Offer venue occupancy or reservation-count information, with a clear explanation of what the number represents. |
| ENT-070 | P2 | Suggest the next-best performance or a related event when a preferred session is full. |
| ENT-071 | P3 | Support dynamic, rules-based release of unused reserved capacity to standby guests, subject to clear published event policies and operational approval. |

**Important operational safeguards**

- Capacity data must identify its source and refresh interval internally.
- Do not show a precise occupancy or queue estimate if the ship cannot maintain it reliably.
- Do not penalise a guest for a system failure or a notification that was not delivered.
- A waitlist must not imply a guaranteed seat.
- Group booking must report partial success explicitly. For example: “2 of 4 places confirmed” is better than a misleading all-or-nothing message.
- Any paid reservation must show the price, payment treatment, refund/cancellation rules and package eligibility before confirmation.

## 6.6 Live schedule, event status and disruption management

The onboard programme changes. Weather, production timing, port operations, technical issues and performer availability can all affect the schedule. The app must be a dependable source of current information.

| ID | Priority | Requirement |
|---|---|---|
| ENT-072 | P0 | Support operational statuses: scheduled, delayed, moved, cancelled, full, registration closed, in progress and completed. |
| ENT-073 | P0 | Propagate schedule changes to the home page, event detail, search results, planner, reservation record and relevant notifications. |
| ENT-074 | P0 | For a changed event, show what changed: old time/venue, new time/venue and when the change was made, when available. |
| ENT-075 | P0 | Clearly mark the latest confirmed information and show an appropriate stale/offline indicator when the app cannot verify current status. |
| ENT-076 | P0 | Notify guests with confirmed reservations of material changes, cancellations and changed check-in instructions. |
| ENT-077 | P0 | Notify guests who saved an event of major changes when their notification preferences permit. |
| ENT-078 | P1 | Recommend relevant alternatives when an event is cancelled or moved, taking into account the guest's existing plan. |
| ENT-079 | P1 | Support weather-contingency rules for outdoor events, including an alternate venue or a cancellation state. |
| ENT-080 | P1 | Provide a “What changed today?” summary so guests can quickly review updates without searching the whole schedule. |
| ENT-081 | P1 | Allow operational staff to publish a short explanatory note, such as “Moved indoors due to weather”. |
| ENT-082 | P2 | Rebuild a guest's unconfirmed plan suggestions after a disruption and ask before applying them. |
| ENT-083 | P2 | Offer crew-facing communication status so staff can see whether important changes were published and acknowledged where appropriate. |

**Acceptance criteria**

- A cancelled event cannot remain apparently available in the booking flow.
- A confirmed reservation linked to a changed event is updated or explicitly flagged for guest action.
- The app does not silently replace a guest's saved time with a new time without communicating the change.
- Offline users see the time of the last successful schedule sync and are not led to believe that cached information is live.

## 6.7 Notifications, alerts and reminders

Notifications should protect the guest's plan and create timely opportunities—not compete for attention.

| ID | Priority | Requirement |
|---|---|---|
| ENT-084 | P0 | Allow guests to enable or disable entertainment reminders. |
| ENT-085 | P0 | Allow reminder timing to be configured, with sensible defaults such as 15 minutes before an event and an optional earlier reminder for events requiring travel or preparation. |
| ENT-086 | P0 | Send critical change alerts for cancelled or materially changed events that are saved or reserved by the guest, subject to consent and channel availability. |
| ENT-087 | P0 | Avoid sending duplicate reminders for the same event across multiple devices or channels. |
| ENT-088 | P0 | Provide an in-app notification centre with unread/read state and links to the affected event or reservation. |
| ENT-089 | P1 | Support event-specific notification choices, such as “Remind me”, “Tell me if a place opens” or “Only notify me about changes”. |
| ENT-090 | P1 | Support quiet hours and separate controls for reminders, operational alerts and promotional messages. |
| ENT-091 | P1 | Include useful action buttons or deep links, such as view new time, navigate to venue, accept waitlist place or review alternatives. |
| ENT-092 | P1 | Suppress a reminder when the guest has cancelled the booking, removed the event or is no longer eligible to attend. |
| ENT-093 | P2 | Offer context-aware reminders based on realistic walking time, event check-in deadlines and the guest's current plan. |
| ENT-094 | P2 | Provide a daily opt-in digest with a short summary of saved events, confirmed bookings and important changes. |
| ENT-095 | P3 | Support personalised notification intensity, allowing guests to choose a low-interruption, balanced or high-assistance mode. |

**Notification quality rules**

- Separate operational alerts from marketing messages.
- Do not send promotional notifications merely because a guest has not opened the app.
- Do not send “time to go” reminders when the event is cancelled, moved to another time or already completed.
- Make the event title, time and venue visible in the notification itself where supported.
- Respect app-level and device-level notification permissions; never pretend a push notification is guaranteed.
- If a push cannot be delivered, preserve the message in the in-app notification centre when the guest next connects.

## 6.8 Venue discovery and onboard wayfinding

Finding a venue should be a simple continuation of the planning experience, not a separate research task.

| ID | Priority | Requirement |
|---|---|---|
| ENT-096 | P0 | Display the venue name and deck on every event detail and planner entry. |
| ENT-097 | P0 | Link each venue to a ship map or deck-plan location. |
| ENT-098 | P0 | Provide a “Navigate” action from event details, planner entries and reminders. |
| ENT-099 | P0 | Use venue names and deck terminology consistently with physical ship signage. |
| ENT-100 | P1 | Provide step-by-step routing that understands decks, stairs, elevators, restricted areas and accessible routes. |
| ENT-101 | P1 | Show approximate walking time when the routing engine can calculate it reliably. Label estimates clearly. |
| ENT-102 | P1 | Show relevant nearby amenities, such as restrooms, elevators and accessible entrances, where map data is maintained. |
| ENT-103 | P1 | Support a venue detail page with description, typical event types, seating/standing information and accessibility details. |
| ENT-104 | P2 | Support “near this venue” discovery so guests can find another event before or after the current one. |
| ENT-105 | P2 | Offer optional location-aware directions or prompts without requiring continuous location tracking. |

**Acceptance criteria**

- A guest can open directions from an event without manually searching for the venue.
- Routes must be deck-aware and must not direct guests through crew-only or otherwise restricted spaces.
- Walking-time estimates must be omitted rather than fabricated when routing data is incomplete.
- Accessible routing must not assume that a staircase route is suitable for every guest.

## 6.9 Companion, couple and group planning

A cruise is social. The product should make it easier to make plans together while keeping personal preferences and privacy under each guest's control.

| ID | Priority | Requirement |
|---|---|---|
| ENT-106 | P0 | Allow a guest to share an event detail using the device's standard share capability or a secure in-app link. |
| ENT-107 | P1 | Allow authorised travel companions to share a shortlist or selected planner items. |
| ENT-108 | P1 | Show which invited companions are attending a shared plan, subject to their explicit sharing permissions. |
| ENT-109 | P1 | Allow a group organiser to propose an event and invite specific companions to accept or decline. |
| ENT-110 | P1 | Support group reservation requests and clearly report which guests have been confirmed. |
| ENT-111 | P1 | Allow a guest to keep some planner items private while sharing others. |
| ENT-112 | P1 | Support a lightweight group poll for choosing among a small number of events. |
| ENT-113 | P2 | Display a shared group schedule with individual and common commitments clearly differentiated. |
| ENT-114 | P2 | Support “meet here” venue sharing with a map pin and event time, without exposing continuous location. |
| ENT-115 | P3 | Integrate with an existing approved shipmate/family locator, if available, while preserving explicit consent, age protections and opt-out controls. |

**Privacy rules**

- A reservation or favourite must not automatically disclose a guest's attendance to other guests.
- Sharing should be opt-in, granular and reversible.
- Children should not be able to accept group-sharing or location-sharing requests outside guardian-approved rules.
- The app should not require a guest to share their location to use entertainment features.

## 6.10 Family, children and youth programming

Family entertainment needs to be useful to the adult organising the day while respecting children's safety, privacy and age-specific access.

| ID | Priority | Requirement |
|---|---|---|
| ENT-116 | P0 | Display age suitability and restrictions on family and youth events. |
| ENT-117 | P0 | Make it clear whether a child must be accompanied by an adult, checked in by a guardian or registered through a separate youth-programme process. |
| ENT-118 | P0 | Do not expose private child attendance, location or profile information to unauthorised guests. |
| ENT-119 | P1 | Allow an authorised guardian to filter activities for the ages of children in their travel party. |
| ENT-120 | P1 | Show youth-programme operating hours, registration status, check-in/check-out requirements and relevant location details when integrated. |
| ENT-121 | P1 | Allow guardians to add appropriate family activities to a shared family planner. |
| ENT-122 | P1 | Show age-appropriate movie guidance and content notes where supplied by the programme owner. |
| ENT-123 | P2 | Support separate child-interest profiles managed by a guardian, without requiring children to create independent public profiles. |
| ENT-124 | P2 | Provide “family together” suggestions and separate “adult time” options that respect childcare availability and booking constraints. |

## 6.11 Accessibility, inclusion and language

Accessibility information must be part of the event data model, not an afterthought added to a general help page.

| ID | Priority | Requirement |
|---|---|---|
| ENT-125 | P0 | Meet WCAG 2.2 AA as the target standard for the guest-facing web experience. |
| ENT-126 | P0 | Support screen readers, logical focus order, scalable text, sufficient contrast and clear touch targets. |
| ENT-127 | P0 | Do not rely on colour alone to convey reservation, availability, conflict or event-status information. |
| ENT-128 | P0 | Use plain language and consistent labels for booking states, event types and schedule changes. |
| ENT-129 | P1 | Expose event accessibility attributes in the event detail page and search filters. |
| ENT-130 | P1 | Allow guests to identify hearing assistance, captions, sign-language interpretation, step-free access and other supported accommodations where offered. |
| ENT-131 | P1 | Provide supported language labels and content translations for event details where available. |
| ENT-132 | P1 | Make time, date and venue information readable at larger text sizes without truncating critical details. |
| ENT-133 | P2 | Support captions/transcripts for approved previews, speaker introductions and recorded enrichment content. |
| ENT-134 | P2 | Offer sensory information such as loudness, flashing lights, crowd intensity and expected participation where event organisers can provide it accurately. |
| ENT-135 | P2 | Support a low-stimulation or quieter-experience filter where the event catalogue has sufficient data. |

**Important:** Do not label an event “accessible” as a blanket claim. Show the specific features known to be available and direct guests to crew assistance for details that cannot be confirmed digitally.

## 6.12 Interactive participation and guest engagement

Interactive features can increase participation, but they should enhance the event rather than distract from the live experience.

| ID | Priority | Requirement |
|---|---|---|
| ENT-136 | P1 | Support event-specific participation instructions, such as how to join a trivia team, register for a class or enter a hosted competition. |
| ENT-137 | P2 | Support polls, trivia answers or audience participation through a mobile interface where the entertainment team explicitly enables it. |
| ENT-138 | P2 | Allow a guest to follow a recurring series or performer and receive relevant updates. |
| ENT-139 | P2 | Support opt-in post-event feedback with a very short rating and optional comment. |
| ENT-140 | P2 | Allow guests to indicate “I'd attend this again” or “Show me more like this” to improve recommendations. |
| ENT-141 | P3 | Support loyalty-style recognition for participation where it adds genuine value and does not turn ordinary entertainment into a competition for rewards. |
| ENT-142 | P3 | Offer optional digital keepsakes or programme notes for selected events, subject to content rights and privacy controls. |

## 6.13 In-cabin and on-demand entertainment connection

The entertainment app should help guests understand the broader entertainment ecosystem, even when playback happens on a stateroom television or a dedicated onboard system.

| ID | Priority | Requirement |
|---|---|---|
| ENT-143 | P1 | Include scheduled movie screenings, outdoor cinema, special broadcasts and other scheduled screen events in the same catalogue as live entertainment. |
| ENT-144 | P1 | Link to the appropriate stateroom-TV or onboard on-demand catalogue when available; do not claim the phone can play content that is only licensed for the cabin system. |
| ENT-145 | P2 | Provide movie information such as synopsis, runtime, rating, language and screening location/time, where available. |
| ENT-146 | P2 | Show sports broadcast schedules with the relevant venue and any known regional or feed limitations. |
| ENT-147 | P2 | Support a “watch later in the cabin” or “available on the stateroom TV” flag only when the content system can verify availability. |

## 6.14 Personalisation and recommendations

Personalisation should reduce the effort of finding relevant experiences, not create a filter bubble or pressure guests to disclose more than they wish.

| ID | Priority | Requirement |
|---|---|---|
| ENT-148 | P1 | Allow guests to optionally select interest themes such as music, theatre, comedy, movies, learning, games, dancing, family and active recreation. |
| ENT-149 | P1 | Use saved events and explicit feedback as recommendation signals. |
| ENT-150 | P1 | Explain recommendations with a short reason where practical. |
| ENT-151 | P1 | Allow guests to dismiss a recommendation or tune interests at any time. |
| ENT-152 | P1 | Balance recommendations across event types and times rather than repeatedly showing only the most popular events. |
| ENT-153 | P2 | Consider practical context: time available, venue distance, indoor/outdoor conditions, age suitability, reservation status and existing commitments. |
| ENT-154 | P2 | Offer different discovery modes, such as “surprise me”, “quiet options”, “something lively” or “something new”. |
| ENT-155 | P2 | Learn from completed attendance only where attendance data is reliable and its use is disclosed. |
| ENT-156 | P3 | Support conversational recommendations with safe, grounded answers tied to actual event records and current availability. |

**Recommendation guardrails**

- Do not infer sensitive personal characteristics from entertainment choices.
- Do not use children's activity data to build advertising profiles.
- Clearly distinguish editorially featured events from algorithmic recommendations and paid promotions.
- Never recommend an event that is cancelled, full when booking is mandatory, age-inappropriate or too far away to attend.
- Include complimentary and low-cost options in recommendations; do not optimise solely for revenue.

## 6.15 Offline and low-connectivity experience

Reliable onboard access is a foundational requirement. A guest should not need to purchase a full internet package simply to view their entertainment plan, subject to the cruise line's network and access policies.

| ID | Priority | Requirement |
|---|---|---|
| ENT-157 | P0 | Make core entertainment pages available over the ship's local network without requiring general internet access where the network architecture permits. |
| ENT-158 | P0 | Cache the current day's schedule, event details, venue directory and the guest's last-synced personal plan. |
| ENT-159 | P0 | Show the last successful sync time and make it clear when information may be out of date. |
| ENT-160 | P0 | Make cached content readable when the device temporarily loses connectivity. |
| ENT-161 | P0 | Do not represent a reservation, cancellation or waitlist action as complete while it is only queued locally. |
| ENT-162 | P0 | For actions requiring a server, provide a clear pending/error state and a retry path. |
| ENT-163 | P1 | Queue safe, non-transactional preference changes for synchronisation when connectivity returns. |
| ENT-164 | P1 | Prioritise small, text-first event data and compress optional imagery/video. |
| ENT-165 | P1 | Provide a graceful fallback if push notifications or background refresh are unavailable. |
| ENT-166 | P2 | Support a lightweight downloadable or printable daily entertainment summary. |

**Offline transaction rule:** A cached page can be trusted as the last known version, not as a guarantee of current availability. No booking-related action may be shown as confirmed until the authoritative booking service confirms it.

---

## 7. Operational and crew-facing requirements

A guest app cannot deliver a dependable experience if shipboard teams cannot maintain the schedule quickly and confidently. The content and operational tools are therefore part of the product scope, not an optional back-office enhancement.

## 7.1 Entertainment schedule management

| ID | Priority | Requirement |
|---|---|---|
| OPS-001 | P0 | Provide an authorised interface for creating, editing, publishing and cancelling events for a specific ship and sailing. |
| OPS-002 | P0 | Support event templates for recurring programme types, with the ability to create multiple dated sessions. |
| OPS-003 | P0 | Support venue, deck, category, host, performer, capacity, age guidance, price and reservation settings as structured fields. |
| OPS-004 | P0 | Validate required fields before an event can be published. |
| OPS-005 | P0 | Provide a preview of how an event will appear in search, calendar, event detail and guest planner. |
| OPS-006 | P0 | Maintain a schedule audit trail showing who changed what and when. |
| OPS-007 | P0 | Support draft, review, approved, published and withdrawn states with role-based permissions. |
| OPS-008 | P0 | Allow authorised staff to make urgent changes from a mobile-friendly interface. |
| OPS-009 | P0 | Ensure a change to a published event invalidates or updates relevant cached guest data through the defined sync process. |
| OPS-010 | P1 | Support bulk schedule upload or integration from existing entertainment planning tools. |
| OPS-011 | P1 | Support copy-forward of recurring programme structures while ensuring dates, times and venues are revalidated for each sailing. |
| OPS-012 | P1 | Provide operational conflict warnings for venue double-bookings, overlapping performer assignments and impossible setup/turnaround windows. |
| OPS-013 | P1 | Support weather-dependent alternate venues and pre-defined contingency actions. |
| OPS-014 | P2 | Provide a programme-quality dashboard showing incomplete content, missing images, unresolved accessibility fields and unpublished changes. |

## 7.2 Venue capacity, check-in and guest flow

| ID | Priority | Requirement |
|---|---|---|
| OPS-015 | P0 | Define the source of truth for event capacity and booking inventory. |
| OPS-016 | P0 | Ensure booking and cancellation transactions are protected against duplicate or conflicting updates. |
| OPS-017 | P0 | Provide an authorised crew check-in workflow for ticketed or reserved events. |
| OPS-018 | P0 | Support a manual fallback when scanners, local connectivity or guest devices fail. |
| OPS-019 | P1 | Provide a live view of reservations, check-ins, remaining capacity and standby demand where the operational system can support it. |
| OPS-020 | P1 | Support guest no-show rules, grace periods and reservation release policies configured by event. |
| OPS-021 | P1 | Allow crew to create or manage a standby queue and record guests who are admitted from standby. |
| OPS-022 | P2 | Provide a venue-facing dashboard or tablet mode showing the event roster and check-in state. |

## 7.3 Content governance and publishing workflow

| ID | Priority | Requirement |
|---|---|---|
| OPS-023 | P0 | Define accountable owners for schedule accuracy, event descriptions, venue details, accessibility information, pricing and reservation rules. |
| OPS-024 | P0 | Keep internal operational notes separate from guest-facing descriptions. |
| OPS-025 | P0 | Require explicit approval for changes to price, age restrictions, reservation rules and material event details. |
| OPS-026 | P1 | Support reusable content templates and approved terminology to maintain consistency across ships. |
| OPS-027 | P1 | Support translation status and review workflows for supported languages. |
| OPS-028 | P1 | Provide a clear publication timestamp and version for each event. |
| OPS-029 | P2 | Allow corporate teams to define programme taxonomies and standards while ships retain appropriate local control. |

## 7.4 Analytics and operational intelligence

| ID | Priority | Requirement |
|---|---|---|
| OPS-030 | P0 | Measure event impressions, detail views, saves, reservation starts, reservation completions, cancellations and check-ins where available. |
| OPS-031 | P0 | Attribute metrics to the correct ship, sailing, event, date and event category. |
| OPS-032 | P1 | Show conversion from discovery to attendance, not just app clicks. |
| OPS-033 | P1 | Identify events with high interest but low attendance, or strong attendance but poor discoverability. |
| OPS-034 | P1 | Compare performance by event category, day type, venue and time slot, with appropriate minimum group sizes. |
| OPS-035 | P1 | Track schedule-change frequency and the proportion of affected guests reached through in-app and push channels. |
| OPS-036 | P1 | Report reservation no-shows, cancellations, waitlist conversion and standby admission. |
| OPS-037 | P2 | Analyse guest feedback and recurring themes using privacy-preserving aggregation. |
| OPS-038 | P2 | Support controlled experiments on discovery and planner UX, without withholding essential event information from a control group. |

---

## 8. Information architecture and key screens

A recommended navigation structure is:

1. **Today** — What is happening now, soon and tonight; personalised highlights; important changes.
2. **Explore** — Full event catalogue, category browsing, search and filters.
3. **My Plan** — Saved events, reservations, daily agenda and voyage calendar.
4. **Notifications** — Event reminders, booking updates and schedule changes.
5. **Ship Map** — Venues and routes, linked from event and planner pages.

The actual app navigation may combine these with broader cruise functions, but Entertainment, Explore and My Plan should remain prominent and easy to access.

### 8.1 Today screen

Recommended content hierarchy:

- Current ship day and ship time.
- Immediate critical changes affecting the guest's plan.
- Next confirmed booking or saved event.
- Happening now / starting soon.
- Tonight's highlights.
- Personal recommendations.
- Browse by category.

Avoid turning the first screen into a long, undifferentiated event feed.

### 8.2 Explore screen

Recommended controls:

- Search bar.
- Today / tomorrow / voyage date selector.
- Category chips.
- Time, age, price, venue and accessibility filters.
- Sort control.
- List and calendar/timeline views.
- Clear event cards with a consistent hierarchy.

### 8.3 Event detail screen

Recommended order:

1. Event title, category and status.
2. Date, start time, duration and venue.
3. Reservation or attendance action.
4. Short description and “what to expect”.
5. Price/included status, age guidance and language.
6. Accessibility and preparation information.
7. Performer/host details and media preview.
8. Related sessions or alternatives.
9. Add to plan, reminder and share actions.

### 8.4 My Plan screen

Recommended views:

- Daily agenda by default.
- Voyage calendar for looking ahead.
- Tabs or filters for All, Confirmed, Saved and Needs attention.
- Visible conflict warnings.
- Venue navigation and check-in details.
- A simple way to remove or change a saved item.

### 8.5 Notification centre

Group messages by:

- Action required.
- Reservation updates.
- Schedule changes.
- Reminders.
- Optional recommendations and announcements.

Critical service information should not be buried beneath promotional content.

---

## 9. Core customer journeys and acceptance scenarios

The following journeys should be used in design reviews, usability testing and end-to-end acceptance testing.

### Journey A — Discover something for tonight

**Scenario:** A couple has finished dinner and wants to find something enjoyable, but has no fixed plan.

1. Guest opens Today.
2. App shows the correct ship time and events happening soon or tonight.
3. Guest filters to live music and comedy.
4. Results show event times, venues, duration and whether reservations are required.
5. Guest opens an event, reviews what to expect and checks the venue.
6. Guest saves the event or reserves it, as applicable.
7. The event appears in My Plan and the guest can navigate to it.

**Pass conditions:** Search and filters are fast; the event is genuinely on the current sailing; reservation status is clear; no inaccurate availability is displayed.

### Journey B — Plan around a headline production

**Scenario:** A guest wants to see the main theatre production and avoid a conflict with dinner.

1. Guest searches for the production.
2. App shows all sessions, reservation requirements and venue details.
3. Guest selects a session.
4. App checks the guest's dining reservation and existing plan.
5. If there is a conflict or insufficient travel time, the app explains it and suggests another session.
6. Guest reserves the preferred session.
7. Confirmation appears in My Plan with arrival instructions and reminder settings.

**Pass conditions:** The booking is authoritative; the planner does not create a false confirmation; the conflict warning is understandable and actionable.

### Journey C — An event changes after it has been saved

**Scenario:** An outdoor performance moves indoors due to weather.

1. An authorised crew member changes the event venue and publishes the update.
2. The event detail, calendar, planner and venue map update.
3. Guests with the event saved or reserved receive an appropriate alert according to their preferences.
4. The guest opens the alert and sees the previous and new venue.
5. The guest can navigate to the new venue.

**Pass conditions:** No stale venue remains displayed as current after sync; confirmed reservations remain correctly associated with the event; guests without push permissions can see the update in-app.

### Journey D — A popular show is full

**Scenario:** A guest attempts to reserve a show but no places remain.

1. The app reports that the selected session is full.
2. It offers another performance, a waitlist or standby option only if supported.
3. The guest selects an alternative or joins the waitlist.
4. The guest sees the correct state and any deadline or conditions.
5. If a place becomes available, the guest receives an alert and must explicitly accept it.

**Pass conditions:** The app never implies a guaranteed seat from a waitlist; inventory is checked by the authoritative service; the alternative is on the same sailing.

### Journey E — Coordinate a family afternoon

**Scenario:** A guardian wants to find activities suitable for two children and one adult.

1. Guardian selects the relevant age filters.
2. App shows suitable activities and identifies adult accompaniment or registration rules.
3. Guardian saves a family activity and a separate youth-programme option.
4. The family planner shows times, venues and check-in instructions.
5. A conflict warning appears if the adult's preferred activity overlaps with a required guardian handoff.

**Pass conditions:** Child data is visible only to authorised users; age guidance is accurate; the app does not imply that childcare is available unless the relevant programme confirms it.

### Journey F — Guest is offline or on a weak connection

**Scenario:** A guest is walking between decks and loses connectivity.

1. Guest opens My Plan.
2. Cached events, reservations and venue details remain readable.
3. The app displays the last sync time.
4. A booking action requiring the server is unavailable or marked as pending—not confirmed.
5. When connectivity returns, the app refreshes and reports the result.

**Pass conditions:** No lost or duplicated booking is created; cached information is clearly distinguished from live information; the app remains useful.

---

## 10. Data model and integration requirements

The customer experience depends on a consistent, voyage-aware information model.

### 10.1 Core entities

| Entity | Key information |
|---|---|
| Ship | Ship ID, name, deck configuration, time-zone/ship-time rules, map version and supported capabilities |
| Sailing | Sailing ID, ship ID, itinerary dates, voyage day sequence, port/sea-day schedule and official time policy |
| Event | Event ID, sailing ID, title, description, category, status, audience, price and content metadata |
| Event session | Session ID, event ID, start/end time, venue, capacity, reservation rules and session status |
| Venue | Venue ID, name, deck, map coordinates, access routes, capacity and accessibility attributes |
| Performer / host | Person or group ID, public profile, approved image, biography and linked sessions |
| Guest | Guest ID, booking relationship, permissions, language and relevant accessibility preferences where voluntarily provided |
| Reservation | Reservation ID, guest(s), session ID, status, quantity, confirmation reference and policy snapshot |
| Waitlist / standby entry | Queue ID, guest, session, position/status, response deadline and admission result |
| Planner item | Guest, event/session, item type (saved/reserved/other), reminder preference, sharing state and timestamps |
| Notification | Guest, type, related event/reservation, channel, delivery state and read state |
| Schedule change | Event/session, old and new values, reason, publisher and timestamp |
| Attendance | Guest/session, check-in time, source and method, subject to privacy policy |
| Feedback | Event/session, guest or pseudonymous identifier, rating, structured response and optional comment |

### 10.2 Key integration points

- **Shipboard entertainment scheduling system:** Source of event and session schedule, hosts, venues and operational changes.
- **Reservation / ticketing service:** Source of truth for capacity, holds, confirmations, cancellation and waitlist state.
- **Guest identity and booking system:** Guest eligibility, sailing association, party membership and permissions.
- **Ship deck-plan / wayfinding service:** Venue coordinates, deck routing and accessibility paths.
- **Notification platform:** Push, in-app messages and other approved channels.
- **Dining and appointment systems:** Relevant guest commitments for a unified planner.
- **Youth-programme system:** Age/guardian rules, registration and check-in where permitted.
- **Shipboard Wi-Fi / local network services:** App access, local data delivery and sync.
- **Stateroom television / onboard content system:** Links or availability metadata for on-demand entertainment.
- **Analytics platform:** Aggregated discovery, conversion, attendance and satisfaction metrics.

### 10.3 Data and API principles

- Every event and session must be scoped to a specific ship and sailing.
- Use stable identifiers; never rely on event titles as unique identifiers.
- Model event series separately from their individual sessions.
- Store all schedule timestamps with an explicit time-zone or ship-time convention.
- Keep the original operational source and last-updated timestamp for critical information.
- Use idempotent booking operations and transaction references to prevent duplicate reservations.
- Make updates event-driven where possible, with polling or refresh as a resilience fallback.
- Provide a version number or change token for cache invalidation and offline synchronisation.
- Define data-retention periods for attendance and feedback before implementation.
- Avoid storing or exposing more guest data than the feature requires.

---

## 11. Non-functional requirements

### 11.1 Performance

| ID | Priority | Requirement |
|---|---|---|
| NFR-001 | P0 | The Entertainment home and cached daily schedule should render quickly on representative mid-range phones under shipboard network conditions. Establish and test a measurable performance budget before launch. |
| NFR-002 | P0 | Search and filtering should return useful results without a full-page reload. |
| NFR-003 | P0 | Event details should prioritise text and essential schedule data before loading optional media. |
| NFR-004 | P1 | Use pagination, incremental loading or date scoping for large voyage catalogues. |
| NFR-005 | P1 | Compress and appropriately size images; load video previews only on demand. |

### 11.2 Reliability and resilience

| ID | Priority | Requirement |
|---|---|---|
| NFR-006 | P0 | The app must handle intermittent connectivity without losing a guest's saved plan. |
| NFR-007 | P0 | Reservation actions must provide authoritative transaction results and recover safely from timeouts. |
| NFR-008 | P0 | Schedule changes must be propagated with a defined service level and monitored for failures. |
| NFR-009 | P0 | The guest interface must fail gracefully if a non-essential integration is unavailable. |
| NFR-010 | P1 | Provide operational monitoring for schedule sync, inventory sync, notification delivery and booking errors. |

### 11.3 Security and privacy

| ID | Priority | Requirement |
|---|---|---|
| NFR-011 | P0 | Protect guest data in transit and at rest using approved security controls. |
| NFR-012 | P0 | Enforce authentication and authorisation for guest, guardian, crew and administrator actions. |
| NFR-013 | P0 | Apply least-privilege access to shipboard operational tools. |
| NFR-014 | P0 | Obtain permission before sharing guest plans, attendance or location-related information. |
| NFR-015 | P0 | Do not expose child profiles or attendance to unauthorised guests. |
| NFR-016 | P0 | Provide clear privacy notices and controls for personalisation and analytics. |
| NFR-017 | P1 | Minimise retention of precise location, attendance and interaction data. |
| NFR-018 | P1 | Log privileged operational changes and provide an audit trail. |

### 11.4 PWA and device support

| ID | Priority | Requirement |
|---|---|---|
| NFR-019 | P0 | Deliver a responsive mobile-first experience for current supported iOS and Android browsers. |
| NFR-020 | P0 | Support installable PWA behaviour where supported, while keeping installation optional. |
| NFR-021 | P0 | Cache essential app shell, current schedule, event detail data and personal plan using an explicit freshness strategy. |
| NFR-022 | P0 | Do not make core use dependent on push notification support; provide in-app reminders and a visible planner. |
| NFR-023 | P1 | Support deep links from notifications, QR codes, ship signage and shared event links. |
| NFR-024 | P1 | Test device rotation, text scaling, low-power modes and browser lifecycle behaviour. |
| NFR-025 | P1 | Define graceful fallbacks for platform-specific PWA limitations, including background sync and notification permission differences. |

### 11.5 Accessibility and localisation

- Target WCAG 2.2 AA.
- Support localisation of dates, times, number formats and text.
- Keep ship time explicit; do not let phone-local time create ambiguity.
- Provide translated event details only when the translation is approved and current.
- Ensure iconography has accessible names and does not replace meaningful text.

---

## 12. Measurement framework and success metrics

The product should measure whether guests discover and attend experiences they value—not merely whether they open the app.

### 12.1 North-star outcome

**Meaningful entertainment participation per occupied guest-day**, measured through reliable attendance/check-in where available and supplemented by guest feedback. This should be interpreted alongside satisfaction and not used to pressure guests into attending more events than they want.

### 12.2 Core KPIs

| KPI | What it tells us | Suggested measurement |
|---|---|---|
| Schedule reach | Whether guests can see the programme | Unique guests viewing the daily schedule / eligible occupied guests |
| Discovery depth | Whether guests explore beyond the first screen | Event detail views per engaged guest; category breadth |
| Save rate | Whether events are worth remembering | Saved events / event detail views |
| Reservation conversion | Whether interested guests can complete bookings | Confirmed reservations / reservation starts |
| Reservation reliability | Whether the booking experience is trustworthy | Booking error rate; duplicate prevention; pending-to-final resolution time |
| Attendance conversion | Whether plans translate into participation | Check-ins / confirmed reservations, adjusted for event policy |
| No-show rate | Whether reserved capacity is wasted | No-shows / confirmed reservations |
| Waitlist conversion | Whether released capacity is reused | Waitlisted guests admitted / waitlist offers |
| Schedule-change reach | Whether guests learn about material changes | Affected guests reached in-app or through permitted channels |
| Plan usefulness | Whether the planner helps guests | Planner usage, conflict resolution and post-voyage survey results |
| Discovery satisfaction | Whether guests can find appealing activities | Short post-cruise survey question and feedback themes |
| Category participation | Whether a range of programme types is being discovered | Attendance by category, with ship/sailing context |

### 12.3 Guardrail metrics

- Notification opt-out and disable rates.
- Complaint rate related to inaccurate event information.
- Booking error and false-confirmation incidents.
- Accessibility-related complaints and incomplete accessibility data.
- Guest-service contacts caused by app confusion.
- Privacy complaints and unauthorised sharing incidents.
- Percentage of events with missing or stale essential metadata.

### 12.4 Analytics principles

- Use aggregated reporting wherever possible.
- Do not equate high event volume with guest satisfaction.
- Do not rank crews solely on attendance; programme context and ship capacity differ.
- Compare similar sailing lengths, ship classes and event categories where possible.
- Validate check-in data quality before treating it as actual attendance.

---

## 13. Recommended delivery roadmap

The sequence below intentionally puts schedule accuracy, planning and operational reliability ahead of advanced personalisation.

### Release 1 — Trusted entertainment companion (P0)

**Customer promise:** “I can see what's on, understand it and keep track of what I want to do.”

Deliver:

- Voyage-specific event catalogue and event details.
- Today, Tonight, Happening Now and voyage-day views.
- Search and essential category/time filters.
- Save/favourite events and My Plan.
- Show reservation rules and existing booking status.
- Venue/deck information and ship-map links.
- In-app schedule-change visibility and notifications for material changes.
- Basic reminders and notification centre.
- Offline/cached schedule and personal-plan access.
- Crew schedule publishing, change audit trail and core analytics.
- Accessibility baseline and responsive mobile UX.

**Release gate:** No launch until event accuracy, reservation state accuracy, ship-time handling and offline messaging have passed end-to-end tests on representative sailings.

### Release 2 — Plan and attend with confidence (P1)

**Customer promise:** “The app helps me choose the right event, fit it into my day and get there.”

Deliver:

- Personalised discovery and interest preferences.
- Conflict detection and alternative session suggestions.
- Unified planner integrations for dining, excursions and appointments where feasible.
- Real-time availability and booking management.
- Waitlists/standby where operations support them.
- Group planning and shared shortlists.
- Family filters and guardian-aware planning.
- Accessibility/language filters.
- Deck-aware routing and walking-time estimates.
- Better schedule-change alternatives and “What changed?” summary.
- Crew capacity and check-in dashboards.

### Release 3 — A more personal and social onboard experience (P2)

**Customer promise:** “The app helps me discover experiences I might not have found on my own.”

Deliver:

- Curated daily and voyage-wide itineraries.
- Performer/host profiles and richer previews.
- Advanced context-aware recommendations.
- Event participation features and post-event feedback.
- Improved venue discovery and nearby-event suggestions.
- Enhanced accessible/sensory information.
- Cross-device plan continuity and shareable itinerary summaries.
- Programme-performance dashboards for entertainment teams.

### Release 4 — Intelligent entertainment companion (P3)

**Customer promise:** “The app can help me make a good decision in natural language and adapt when my day changes.”

Potential capabilities:

- Conversational event discovery grounded in the live sailing schedule.
- Smart replanning after cancellations or delays, always requiring guest approval.
- Predictive recommendations based on declared preferences and current context.
- Optional, consent-based location-aware guidance.
- Better crowd/occupancy intelligence where sensors and operational data support it.
- Personalised post-voyage highlights and keepsakes.

---

## 14. Key product decisions to resolve before detailed design

These decisions affect architecture, operations and customer expectations. Resolve them early rather than leaving them to individual feature teams.

1. **Schedule source of truth:** Which platform owns the event record, session timing, venue and cancellation state?
2. **Reservation scope:** Which event types can be booked, and which remain first-come/first-served?
3. **Capacity reliability:** Can the system provide live availability, approximate reservation counts or only periodic snapshots?
4. **Waitlist operations:** Who manages the queue, what is the response window, and how are unclaimed places released?
5. **Ship-time convention:** What is the authoritative clock for events, and how is this shown to guests travelling across time zones?
6. **Guest identity:** Can one guest manage their own plan and authorised family members without exposing private details?
7. **Companion permissions:** What sharing relationships exist, and how can a guest revoke access?
8. **Unified planner:** Which reservations and appointments can be imported from dining, excursions, spa and youth-programme systems?
9. **Wayfinding:** Is indoor routing sufficiently accurate for walking-time estimates and accessible routes?
10. **Offline architecture:** Which services are available on the ship's local network, and what information can be cached safely?
11. **Notification channels:** Which push, in-app and shipboard channels are supported, and what is the fallback when push is unavailable?
12. **Content ownership:** Who is responsible for descriptions, images, translations, performer biographies, accessibility data and schedule changes?
13. **Onboard staffing:** Who updates events during evenings, weekends, weather disruptions and production changes?
14. **Analytics governance:** Which attendance and preference signals may be collected, for what purpose and for how long?
15. **Commercial model:** How will chargeable activities, package entitlements, complimentary events and promotional placements be represented transparently?

---

## 15. Highest-risk failure modes and mitigations

| Failure mode | Customer impact | Mitigation |
|---|---|---|
| Incorrect event time or venue | Guest misses an event or goes to the wrong place | Single source of truth, audit trail, staff publishing workflow, freshness indicators and propagation monitoring |
| False booking confirmation | Guest arrives expecting a place that does not exist | Authoritative transaction response, explicit booking states, idempotency and end-to-end reservation testing |
| Stale availability | Guest wastes time trying to book a full event | Define refresh interval, revalidate at booking, show last updated time where appropriate |
| Too many notifications | Guests disable the app's notifications | Separate operational and promotional controls, quiet hours, deduplication and relevance rules |
| Planner ignores dining or travel time | Guest creates an impossible day | Integrate commitments and venue-aware conflict detection |
| Poor deck directions | Guest becomes frustrated or late | Use maintained deck plans, route validation and an accessible fallback to crew assistance |
| App depends on internet access | Core experience fails for guests without a data package or with weak signal | Ship-local access, caching, clear sync state and no false transaction success |
| Event catalogue is incomplete | Guests discover activities only by walking past them | Content completeness dashboard, accountable owners and publishing checklist |
| Over-personalisation | Guests feel tracked or see repetitive recommendations | Optional preferences, transparent controls, variety and privacy guardrails |
| Group features reveal private activity | Loss of trust and potential safety concern | Explicit per-item sharing, guardian controls and no default location disclosure |
| Accessibility claims are vague | Guest arrives and finds the event or route unsuitable | Structured attributes, specific claims and staff escalation path |
| Schedule update reaches only some screens | Conflicting information undermines trust | Central event/session service, versioning and automated consistency tests |

---

## 16. Launch readiness checklist

### Guest experience

- [ ] Every published event belongs to the correct ship and sailing.
- [ ] Today, Tonight and voyage-day views use official ship time.
- [ ] Event detail pages show time, venue, duration, reservation rules and price status.
- [ ] Guests can search, filter, save and remove events.
- [ ] My Plan distinguishes saved items from confirmed reservations.
- [ ] Conflict warnings are tested against realistic travel times.
- [ ] Material schedule changes are visible in all relevant surfaces.
- [ ] Notification preferences and quiet hours work as designed.
- [ ] Venue/map links resolve to the correct ship location.
- [ ] Core functionality remains useful on a weak or unavailable connection.
- [ ] Screen-reader, contrast, text scaling and keyboard/focus tests pass.

### Reservations and operations

- [ ] Reservation inventory comes from an authoritative service.
- [ ] Success, pending and failure states are handled correctly.
- [ ] Duplicate requests are safely prevented.
- [ ] Cancellation, modification and refund rules are clear.
- [ ] Staff can publish urgent time and venue changes.
- [ ] Crew can check in guests and use a manual fallback.
- [ ] Waitlist/standby rules are documented and staffed before they are enabled.
- [ ] Audit logs and operational monitoring are available.

### Content and governance

- [ ] Owners are assigned for each content field.
- [ ] Required metadata validation is enforced.
- [ ] Event descriptions are understandable without internal jargon.
- [ ] Age, price, language and accessibility details are reviewed.
- [ ] Translations are approved where offered.
- [ ] Images and media have approved usage rights.
- [ ] Schedule changes have a clear publishing process and escalation path.

### Measurement and support

- [ ] Event discovery, save, booking and attendance metrics are defined.
- [ ] Data retention and privacy rules are approved.
- [ ] Guest support teams have troubleshooting guidance.
- [ ] Shipboard staff know how to correct schedule errors.
- [ ] A feedback loop exists for guests and entertainment teams.

---

## 17. Recommended MVP definition

For a first customer-facing release, resist the temptation to launch every advanced feature. The minimum experience should be small enough to deliver reliably but complete enough to solve a meaningful customer problem.

**MVP must include:**

1. A complete and accurate voyage-specific event catalogue.
2. Clear event detail pages with times, venues, duration, price/eligibility, age guidance and reservation rules.
3. Search and useful filters.
4. A Today view and voyage calendar.
5. A personal planner with saved events and confirmed reservations clearly separated.
6. Basic conflict warnings.
7. Reservation management wherever an authoritative booking service exists.
8. Venue locations and ship-map links.
9. Material schedule-change handling and sensible reminders.
10. Cached schedule and planner access, with honest offline/sync states.
11. Crew tooling to publish changes and keep the schedule accurate.
12. Basic usage and attendance measurement.

**Do not call it an entertainment-management experience if it only provides a static daily schedule.** The minimum customer value comes from connecting discovery to a personal plan and keeping that plan accurate when onboard reality changes.

---

## 18. Final recommendation

The biggest opportunity is to make onboard entertainment feel **personal, connected and easy to act on**. A traditional daily programme tells a guest what the cruise line has scheduled. A well-designed entertainment companion helps that guest decide what they will enjoy, reserve it when necessary, fit it around the rest of the day, get to the venue and respond confidently when plans change.

The recommended strategic priorities are:

1. **Trustworthy live programme:** Complete, accurate, voyage-specific event information with clear status and update behaviour.
2. **One personal plan:** Saved ideas, confirmed reservations and other commitments brought together in a realistic daily itinerary.
3. **Frictionless attendance:** Understandable booking rules, availability, reminders, venue navigation and check-in.
4. **Relevant discovery:** Search, filters and recommendations that expose the breadth of onboard programming.
5. **Shared experiences:** Group and family planning with proper permissions and privacy.
6. **Operational excellence:** Crew tools and governance that make the customer-facing information reliable.
7. **Resilience:** A useful app even when connectivity, push notifications or optional integrations are unavailable.

The competitive advantage will not come from adding the largest number of features. It will come from joining the whole journey together so that the guest can move naturally from **“What's happening?” → “That looks interesting” → “Let's do it” → “Here's how we get there” → “That was great—what's next?”**

---

## 19. Reference points and further reading

The following official cruise-line materials were reviewed as examples of current customer-facing app capabilities and onboard entertainment patterns. They are reference points, not a claim that every capability is available on every ship or sailing.

### Princess Cruises

- [Princess MedallionClass and Princess app](https://www.princess.com/en-int/ships-and-experience/princess-medallionclass) — Describes onboard events, activity discovery/reservations, personal itinerary planning, venue reservation counts, ship navigation and on-demand stateroom entertainment.
- [Princess MedallionClass FAQs](https://www.princess.com/en-int/ships-and-experience/princess-medallionclass/ocean-faq) — Describes booking and managing onboard activities, daily itinerary access, venue navigation and the pre-cruise Planner/Calendar experience.
- [Princess onboard experience FAQ](https://www.princess.com/en-int/faq/onboard-experience) — Provides examples of stage shows, Movies Under the Stars, family programming and use of the JourneyView activity timeline.
- [Princess onboard entertainment overview](https://www.princess.com/html/global/book/cruise-details/onboard-experience/ep-features.html) — Illustrates the breadth of entertainment, including original productions, live music, featured entertainers, movies and nightlife venues.

### Other cruise-line app patterns

- [Disney Cruise Line Navigator app](https://disneycruise.disney.go.com/en-ca/featured/navigator-app/) — Describes schedules, activity reservations, personal itineraries, ship exploration and communication features.
- [Disney: onboard activity and entertainment schedules](https://disneycruise.disney.go.com/en/faq/onboard-activities/activity-entertainment-schedule/) — Explains how the Navigator app presents daily onboard schedules and reservations.
- [Carnival HUB app](https://www.carnival.com/hub-app) — Describes daily events, ship maps, event reminders, selected show reservations and the integration of reservations into a planner.
- [Royal Caribbean: app reservations](https://www.royalcaribbean.com/int/en/faq/questions/what-reservations-can-be-made-with-the-app) — Explains that entertainment and activity reservation availability varies by ship.
- [Royal Caribbean: show reservations](https://www.royalcaribbean.com/faq/questions/how-do-i-pre-reserve-show-tickets) — Provides an example of ship-class-specific show reservation rules.
- [Norwegian Cruise Line app](https://www.ncl.com/cruise-preparation/downloads/app) — Describes onboard schedules, entertainment reservations, itineraries and access through onboard Wi-Fi.

### Standards and design reference

- [W3C Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/) — Recommended accessibility target for the guest-facing experience.

---

**End of document**
