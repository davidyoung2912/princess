# Princess Cruises Passenger Pain Points and PWA Solutions

## Deep-dive research and product recommendations

**Prepared:** 21 November 2026  
**Purpose:** Identify recurring frustrations described by Princess Cruises passengers and translate them into a prioritized set of requirements and opportunities for a new customer-facing Progressive Web App (PWA).  
**Audience:** Product leadership, Princess Cruises digital/guest-experience stakeholders, and an app-development business proposal.

---

## 1. Executive summary

Passenger discussions suggest that the biggest opportunity is not simply to build another place to display the Princess itinerary. It is to make the whole cruise easier to understand, coordinate, trust and enjoy—before departure, on the ship, in port and when connectivity is unreliable.

The most consequential pain points fall into five connected themes:

1. **Trust and reliability:** Guests encounter confusing login, booking-linking, check-in, reservation and synchronization behaviour. When an app is the gateway to a premium holiday, a blank screen or contradictory status is more than an inconvenience; it creates anxiety about whether the booking or payment actually exists.
2. **Travelling together:** Linking people in different cabins or bookings is not intuitive. The passenger discussion supplied as the starting point describes the loss of a straightforward, persistent companion-linking experience and the need to navigate a dining workflow to add people. Group coordination should be a first-class concept, not a side effect of making a restaurant booking.
3. **A fragmented view of the trip:** Passengers report that booked excursions, dining, spa appointments and other reservations can be difficult to find or reconcile. A cruise should have one dependable, chronological trip plan that includes everything the guest has booked and wants to do.
4. **Connectivity dependence:** Guests report slow loading, unreliable Wi-Fi/app connectivity and difficulty accessing information when they need it. An offline-first PWA can make saved itinerary details, port guides, maps, confirmations and group plans available without a live request.
5. **Poor task flow and discoverability:** Customers describe repeated sign-ins, confusing navigation, lost list position, hidden controls and having to hunt through sections to find simple actions. The app should be organised around guest tasks and the current stage of the voyage.

### The central product recommendation

Build a **Cruise Companion and Trip Command Centre** that sits across the voyage, rather than a thin clone of individual Princess app screens. It should provide:

- A **shared travel party** that works across cabins and linked bookings, with invitations, roles, optional location-sharing, private and group chat, and shared plans.
- A **single voyage timeline** combining itinerary, all confirmed bookings, planned activities, reminders and important deadlines.
- An **offline cruise wallet** containing the details passengers need when they have no signal or do not want to use ship Wi-Fi.
- A **port-day planner** that answers what to do, how to get ashore, how much time is available, and when to return—with local time and ship time clearly distinguished.
- A **reliable interface layer** that explains data status, preserves context, makes errors recoverable and never silently implies that an unconfirmed action succeeded.
- **Stanley**, the friendly AI host, as a visual guide and proactive helper embedded in the trip—not just a chat window.

A key commercial point for Princess: this should be positioned as a way to reduce friction across the whole guest journey and complement existing Medallion/Ocean systems. The PWA can substantially improve presentation, planning, sharing, offline access and task completion. Live bookings, payments, account entitlements, Medallion location and shipboard ordering still require supported Princess APIs or approved integration with the relevant systems.

---

## 2. Scope, research approach and confidence

### 2.1 What was reviewed

The research focused on passenger-generated discussion and customer reviews, with official Princess material used to distinguish advertised capabilities from reported experience. Sources reviewed include:

- The supplied Cruise Critic discussion about adding travel companions to the new Princess app.
- Other Cruise Critic threads about check-in and account/system issues.
- Reddit discussions in r/PrincessCruises about app use, dining, activities, reservations, companion access, and recent onboard experience.
- Apple App Store customer reviews from multiple storefront views.
- Princess's own app feature descriptions, OceanReady information and app release notes.
- Technical documentation on PWA caching, offline behaviour, Background Sync and iOS web push.

The evidence is qualitative. It is useful for identifying recurring themes, concrete examples and high-impact failure modes, but it is **not a statistically representative survey of all Princess passengers**. The rankings below are product-priority judgements based on a combination of: apparent recurrence across independent discussions, severity of the passenger impact, how often the task is likely to matter during a cruise, and the degree to which a PWA can improve it.

### 2.2 How to interpret the rankings

- **Priority 1 — Critical:** Affects confidence, access to essential trip information, group coordination or high-stakes cruise-day decisions. Should be addressed in the foundational release.
- **Priority 2 — Very high:** Repeatedly frustrating and affects important planning or onboard activities. Should be part of the core product, not a later decorative enhancement.
- **Priority 3 — High:** Material improvement to the onboard experience and customer satisfaction; should follow the core reliability and planning work.
- **Priority 4 — Important:** Valuable supporting capability, particularly when integrated with the ship's systems.

The ranking is not a claim that a particular issue accounts for a measured percentage of complaints. Where evidence is mainly one thread or a small set of reviews, that limitation is stated.

### 2.3 Important distinction: an advertised capability is not proof of a friction-free experience

Princess currently advertises a broad set of app functions, including OceanReady check-in, dining and excursion reservations, onboard activities, deck plans, shipmate location, chat, ship navigation, OceanNow ordering and onboard spending information. Its current US App Store listing also describes real-time shipmate locating, activity bookmarking, dining management and spending/package status. Princess has continued to update the app; the listing surfaced version 1.11.1 dated 30 October 2026 and describes a redesigned login, email-verified account creation, bug fixes and performance improvements.

This matters because the product opportunity should not overstate that Princess has no such features. The stronger and more credible proposition is that passengers still report **problems with reliability, findability, continuity, synchronisation and end-to-end task completion**, despite the presence of many underlying capabilities.

---

## 3. Ranked passenger pain points

| Rank | Pain point | Passenger impact | Evidence signal | PWA opportunity |
|---:|---|---|---|---|
| 1 | App reliability, account identity and booking data cannot always be trusted | Very high | Strong: recurring across reviews and discussions | Resilient interface, clear sync state, recoverable workflows, robust booking association |
| 2 | Travel companions and group coordination are fragmented | Very high | Strong for linking/discoverability; exact scope varies by voyage/app version | Persistent travel-party hub, invite links/QR, shared plan, consent-based messaging and meetups |
| 3 | No dependable single view of every reservation and commitment | Very high | Strong: several discussions about finding booked excursions, dining and spa items | Unified voyage timeline and reservation wallet |
| 4 | Essential information is too dependent on a working connection | Very high | Strong: repeated complaints about Wi-Fi/app loading; clear PWA fit | Offline-first voyage pack with stale-data indicators |
| 5 | Check-in and passenger profile information can appear to reset or disagree | High | Strong: multiple examples of incomplete/contradictory status | Step-by-step checklist, durable local progress, validation and source-of-truth status |
| 6 | Navigation, search and task flows are confusing and lose context | High | Strong: examples of returning to home, hidden controls and repeated login | Task-based information architecture, persistent context, global search and sensible back behaviour |
| 7 | Port-day and excursion planning is hard to understand end-to-end | High | Moderate–strong: multiple excursion discovery and confirmation complaints | Port-day workspace, shore plan, booking visibility, maps, time-zone logic and all-aboard alerts |
| 8 | Onboard activity and entertainment schedules are incomplete, late or hard to manage | High | Moderate–strong: passengers report late schedule visibility and notification issues | Schedule with availability/freshness status, favourites, conflict detection and reminders |
| 9 | Dining booking, group seating and package/eligibility rules are opaque | High | Strong: repeated dining booking problems and companion workflow discussion | Eligibility explanation, shared dining party, reservation management and clear confirmation |
| 10 | Onboard account, package inclusions and loyalty benefits are difficult to reconcile | Medium–high | Moderate: recurring individual reports in app reviews and forums | Readable folio, package ledger, loyalty entitlement explanation and discrepancy reporting |
| 11 | Ship maps, deck plans and wayfinding are not consistently easy to access or trust | Medium–high | Moderate: requests for deck plans and reports of navigation problems | Offline deck maps, searchable venue directory and accessible directions |
| 12 | Shipmate chat and notifications are not dependable enough for group coordination | Medium–high | Moderate: recent reports of missing notifications, lag and chat bugs | Message centre, notification preferences, fallback meeting arrangements and shared status |
| 13 | OceanNow/menu availability and order options can be inconsistent | Medium | Moderate: customer reviews cite missing drink options and friction | Clear menu taxonomy, package-aware ordering, unavailable-item handling and alternatives |
| 14 | Getting help and reporting a problem can become another frustrating task | Medium | Moderate: repeated references to calling, conflicting advice and unresolved issues | Context-aware support, guided diagnostics, case history and transparent escalation |

---

# 4. Detailed analysis and recommended PWA requirements

## Priority 1 — Reliability, identity and booking-data trust

### What passengers are describing

Across app-store reviews and community discussions, passengers describe the app being slow to open, displaying loading indicators without completing a task, failing to show a booking, presenting incorrect guest counts or names, and showing different information across app and web experiences. Other examples include a booking reference being treated as already associated with another user, a trip disappearing from the app while remaining visible on the website, and a login/account problem that requires support intervention.

A March 2026 Reddit discussion describes a passenger who could not book dining because the app incorrectly indicated that the cruise was not paid in full or that the passenger needed a qualifying suite. A separate recent discussion describes multiple reservations, incorrect names and a guest count that did not match the booking. Customer reviews also mention internal server errors, booking-linking issues and login failures.

These are anecdotal reports, not proof that every passenger experiences these problems. Their importance is that they concern the basic trust contract: **the app must show the right trip, the right people, the right status and the result of the action the guest just took.**

### Why this matters

A passenger who cannot tell whether an excursion, dinner or payment has been recorded may call Princess, retry the transaction, or worry about losing a limited reservation. Repeating an action can create duplicate bookings or duplicate charges. A passenger who is told that check-in is incomplete despite having completed it may worry about boarding. The resulting damage is disproportionate to the apparent size of the software defect.

### Recommended PWA solution

Create a dedicated **Trip and Account Status Centre**. Do not bury booking identity and synchronization state in profile menus.

**Functional requirements**

1. Show every active and upcoming cruise associated with the signed-in guest, with ship, sailing date, booking status and passenger identity clearly displayed.
2. Support a guided booking-association flow with distinct states: not linked, linking in progress, linked, duplicate association detected, booking owned by another profile, and support required.
3. Explain exactly what information is required to associate a booking. Do not make guests repeatedly re-enter details without explaining the failure.
4. Preserve the user's current trip context across navigation, refreshes and return visits.
5. Show a persistent sync indicator: **Up to date**, **Updated at [time]**, **Waiting for connection**, **Update failed**, or **Data may be out of date**.
6. Show the last successful refresh time for booking, dining, excursions, check-in, folio and activity data separately where systems update independently.
7. Avoid presenting stale cached status as current. Every cached transactional summary must carry a timestamp and freshness label.
8. Use idempotent action patterns for reservations and purchases: after a tap, display pending status; on confirmation, show a booking reference; on timeout, check transaction status before allowing the passenger to submit again.
9. Provide an action history showing what the guest did, when it was submitted, whether the server accepted it and what confirmation was returned.
10. Offer a clear recovery path for common conditions: wrong profile, duplicate booking association, booking not found, eligibility mismatch, server unavailable and incomplete passenger record.
11. Where Princess's source system is unavailable, say so directly and preserve the user's entered information locally where safe. Do not show a generic spinner indefinitely.
12. Provide a consistent web/app identity experience, including account creation, password requirements, booking-number access and account recovery.

**Experience detail**

- Prefer one primary action and one clear status over multiple ambiguous icons.
- Use plain language, not backend error codes, as the first explanation. Provide a technical reference ID for support as secondary information.
- If a task fails, preserve the screen, filters, scroll position and form data. Never send the passenger back to the home page as the default failure response.
- Display a clear distinction between a Princess-confirmed booking and a locally saved idea or reminder.

### PWA-specific advantage

A PWA can keep the interface responsive, retain non-sensitive drafts and previously retrieved details, and show useful cached information while the network is unavailable. The local copy must not pretend to be the live source of truth. Service workers and browser storage enable offline resources and data caching, but freshness must be managed explicitly.

### Dependencies and limitations

A PWA cannot independently correct an inaccurate Princess booking record, repair an account merge, unlock a dining eligibility rule or confirm a payment. Those outcomes require approved Princess APIs and support for source-system error states. The PWA can make the failure understandable, prevent harmful repeat actions, reduce support contacts and provide a better recovery path.

### Success measures

- Booking association completion rate.
- Login and session failure rate.
- Percentage of transactional requests with a clear final outcome.
- Duplicate submission and duplicate booking rate.
- Number of support contacts caused by booking visibility/status confusion.
- Median time to find a booking confirmation.
- Percentage of passengers who can correctly identify whether their trip data is current.

---

## Priority 2 — Travel companions, family and group coordination

### What passengers are describing

This is the issue highlighted in the original request and one of the clearest product opportunities.

In the supplied Cruise Critic thread, a passenger asks how to add friends to the new Princess app while attempting to make dinner reservations. Replies explain that the passenger may need the other guests' booking numbers and must use an edit/pencil control during restaurant reservation. Another participant says that previously people could be linked on a separate page and then selected when needed. A further reply asks what happens if someone wants to find or follow friends but does not want to dine with them. The thread's author says the linking they found was for dinner and that finding/following companions would be available once onboard and connected to ship internet.

A separate Reddit discussion about adding others to a dining reservation describes uncertainty about where the new app moved the function. One reply explains that the feature exists but is hidden several steps into the restaurant/guest editing flow. This is a strong example of a capability that may exist but is not discoverable.

Princess currently advertises shipmate location and messaging. The opportunity is therefore broader than adding a friend button: make **the travel party a persistent, understandable, reusable object across the whole trip**.

### Why this matters

Cruises commonly involve couples, extended families, friends, multiple cabins and people who have booked separately. Their shared activities extend far beyond dining:

- Coordinating embarkation and arrival plans.
- Sharing port plans and meeting points.
- Agreeing on dining times and restaurant choices.
- Finding people onboard.
- Deciding which shows or activities to attend.
- Sharing excursion details and transport plans.
- Keeping children, parents or less mobile family members informed.
- Changing plans when someone is tired, delayed or wants to do something different.

Using a dining reservation workflow as the gateway to a broader relationship is conceptually wrong. It ties social connection to one transaction and makes it hard to understand who is connected, why, and what the connection allows.

### Recommended PWA solution: a Travel Party Hub

Make **My Travel Party** a primary navigation destination, available before the cruise and throughout the voyage.

**A. Create and invite a party**

1. Allow a passenger to create a named party, such as “Smith Family”, “Alaska Group” or “Cabin  C720”.
2. Invite other passengers through a secure invitation link, QR code, email or messaging share sheet.
3. Allow each person to join using their own account. Do not require the organiser to know or manually re-enter every other person's booking number as the normal workflow.
4. Support people booked in different cabins and on different booking references, subject to Princess-approved identity verification and privacy rules.
5. Allow a person to belong to more than one group—for example, a family party and a separate group of friends.
6. Show invitation state: invited, accepted, declined, expired or pending identity verification.
7. Provide a simple removal and leave-party function.

**B. Define permissions clearly**

1. Separate “in my travel party”, “can see my shared plans”, “can message me” and “can see my location”. These should not be one all-or-nothing permission.
2. Make location sharing off by default until the passenger chooses otherwise.
3. Offer temporary location sharing, such as for the next two hours, for today's port visit or for the duration of the voyage.
4. Let passengers hide their location from selected individuals without leaving the group.
5. Make it clear when location was last updated and when a person is unavailable or has disabled sharing.
6. Do not expose cabin number, booking number, passport information or other sensitive data to the group by default.
7. Provide guardian-managed child accounts and age-appropriate permissions, subject to Princess policy.

**C. Shared planning**

1. Let the group create and share a daily plan, including meet-up time and place, dining, entertainment, excursion and port activities.
2. Let members vote on restaurant choices, shore activities and show times.
3. Let each person mark an event as attending, maybe or not attending.
4. Show group availability without exposing private bookings.
5. Detect schedule conflicts and suggest a group alternative.
6. Let the organiser share a port plan with the entire group or selected members.
7. Provide one-tap “I'm running late”, “Meet you there”, “Change of plan” and “I'm back onboard” status messages.
8. Allow a member to share a precise meeting location from a searchable ship map or a named venue.

**D. Coordination and messaging**

1. Provide direct messages and group conversations with clear unread counts.
2. Make notification settings understandable and reliable.
3. Include lightweight group polls and event RSVPs.
4. Let users pin important messages such as “Meet at the Piazza at 6:15 PM”.
5. Allow a message to be linked to a location, event or reservation.
6. Make offline-created messages visibly queued; do not claim delivery before the server confirms it.
7. Retain a readable message history during the voyage and provide clear retention rules after the cruise.

**E. Dining and booking integration**

1. Once the group is connected, allow members to be selected for dining reservations without re-entering booking details for each meal.
2. Show which people are included in a reservation and which are merely invited to the group.
3. Support group size changes, table preference and alternative time suggestions where Princess inventory permits.
4. Keep booking permissions separate from social group membership. Being in a party should not automatically grant permission to make purchases or change another passenger's reservation.

### High-value “meetup” experiences

A simple location dot is not always the best way for people to coordinate. Include purpose-built meetup actions:

- **Meet me here:** choose a deck, venue or map point and share it with the group.
- **Find the group:** open directions to the agreed meeting place.
- **Who's going?:** see the people who have RSVP'd to a show, dinner or activity.
- **Port rendezvous:** set a shore-side meeting place and return-to-ship buffer.
- **Back onboard:** a voluntary status signal so family members know a person has returned.

### Important PWA and system limitations

A browser-based app can support invitations, shared plans, chat and user-initiated location sharing when the device and browser grant the required permissions. It cannot be assumed to provide continuous background location tracking equivalent to the Medallion network. Browser background execution is constrained, and device location permissions vary. If Princess wants accurate shipboard location, the PWA should integrate with an approved Medallion/ship-location service rather than attempt to reproduce it independently.

Likewise, a share link should never expose a passenger's private itinerary or location merely because it has been forwarded. Use revocable, expiring invitations and explicit access scopes.

### Success measures

- Percentage of passengers travelling with others who create or join a party.
- Median time to invite and connect another passenger.
- Percentage of group members who successfully share at least one plan.
- Reduction in support requests about linking companions or dining groups.
- Group event participation/RSVP completion.
- Chat delivery and notification success rates.
- Passenger-reported confidence in meeting up onboard and ashore.

---

## Priority 3 — One reliable view of every booking and commitment

### What passengers are describing

Passengers report difficulty finding reservations they have already made. A September 2025 Reddit discussion describes a passenger close to sailing who could not find excursion times, spa/salon bookings or dinner reservations and had to search through several parts of the app and website. Another discussion reports that excursions did not appear in the Journey view. A separate report describes the app and phone support showing inconsistent dinner reservation information.

These reports point to a fundamental information architecture issue: the passenger thinks in terms of “What have I booked, and what do I need to do next?” The product may instead divide information by the system or department that owns it.

### Why this matters

If passengers cannot find proof of a booking, they may worry that it has been lost, call support, make a duplicate booking or miss an appointment. A cruise itinerary is a tightly timed sequence. A spa treatment, excursion, dining reservation and theatre show are not separate worlds to the guest; they are commitments on the same day.

### Recommended PWA solution: My Voyage Timeline

Provide one chronological timeline for the entire sailing, with day-by-day views and a consolidated “All reservations” list.

**Functional requirements**

1. Combine confirmed excursions, dining, spa/salon, onboard activities, entertainment, transfers, hotel stays and relevant travel arrangements in one timeline where data is available.
2. Show the date, local time, duration, venue/location, booking status, party members and confirmation reference.
3. Group the schedule by cruise day and port, with a single chronological order.
4. Distinguish confirmed bookings from saved ideas, tentative plans and group invitations.
5. Provide filters for dining, excursions, spa, entertainment, family activities and personal reminders.
6. Offer a compact agenda view and a detailed day view.
7. Let the passenger open the original booking details without losing their current place in the timeline.
8. Display all booking confirmations in a wallet-like list, searchable by venue, date, guest or confirmation number.
9. Make cancellations, changes and pending requests visibly different from confirmed reservations.
10. Show source and update time for each item when systems refresh independently.
11. Detect overlapping commitments and warn the user before they confirm another activity.
12. Include travel buffer estimates between ship venues and, where reliable data exists, between the ship and shore activities.
13. Allow guests to add personal reminders that are clearly distinguished from Princess-confirmed bookings.
14. Export or share selected items with the Travel Party Hub.
15. Provide a printable or downloadable trip summary for passengers who prefer paper.

### Important design decision: the voyage timeline should be the home screen

The home screen should answer:

- What day of the cruise is it?
- Where is the ship today?
- What is the next thing I have booked?
- What do I need to remember?
- Is there anything I need to do before a deadline?
- Has anything changed since I last checked?

The current app's sections can still exist, but the timeline should be the connecting layer across them.

### Success measures

- Time to locate a specific reservation.
- Percentage of confirmed reservations visible in the unified timeline.
- Duplicate booking attempts caused by uncertainty.
- Number of calls/chats to support asking “Where is my booking?”.
- Percentage of guests who consult the timeline each cruise day.

---

## Priority 4 — Offline access and weak-connectivity resilience

### What passengers are describing

App-store reviews and forum discussions include complaints about long load times, screens that fail to load, difficulty accessing onboard services after connecting to ship Wi-Fi, unexpected sign-outs and dependence on ship connectivity. Some passengers describe the app working better once connected to MedallionNet, while others report that the app does not reliably recognise the Wi-Fi connection or that the connection is inconsistent.

For a cruise passenger, connectivity problems are especially frustrating because the app is often being used while walking around a large ship, boarding, waiting in a terminal or ashore in an unfamiliar place.

### Why this matters

A passenger should not need a reliable internet connection just to remember the time of dinner, read the port plan they saved yesterday, check the all-aboard time, view the ship's deck map or show a booking confirmation.

### Recommended PWA solution: an Offline Cruise Wallet

Make offline support a defining product property, not a fallback error page.

**Automatically cache after trip setup**

- Sailing overview, ship name and voyage dates.
- Port sequence and port call dates.
- Port arrival, departure and all-aboard times, with local and ship time clearly labelled.
- Saved port guides and selected experiences.
- Confirmed reservation summaries and confirmation references, with last-updated timestamps.
- Travel party membership and shared plans that the user has permission to view.
- Ship deck plans, searchable venue directory and essential wayfinding references.
- Daily activity schedule downloaded when available.
- Embarkation instructions and relevant terminal details.
- Emergency and help information approved for offline use.
- User notes, saved places and personal reminders.

**Let passengers choose what to download**

1. Offer a “Download my cruise” action before embarkation.
2. Display estimated download size and available device storage where the platform permits.
3. Let passengers download all port guides or only selected ports.
4. Prioritise text, confirmations and maps over large images.
5. Indicate download progress and whether the package is complete.
6. Provide an explicit “Refresh trip information” action before sailing.
7. Identify the last successful sync time and show any sections that did not download.

**Offline presentation**

1. Keep the app shell, navigation and core screens usable without a network.
2. Present cached data immediately rather than displaying an indefinite loading spinner.
3. Use a clear “Saved on this device” label for offline content.
4. Show when cached operational information may be stale.
5. Provide a clear “Connect to update” action when a live service is required.
6. Preserve locally created notes, reminders, saved experiences and draft group plans.
7. Queue low-risk changes, such as favourites or personal notes, for later synchronization where technically supported.
8. Do not queue payments, purchases, booking changes or other high-impact transactions in a way that might later execute unexpectedly.

### What offline should and should not promise

**Good offline candidates:** itinerary snapshots, port information, deck maps, downloaded schedules, confirmations, saved notes, group plans last synced, and emergency information.

**Live connection required:** new reservations, cancellations, payments, current inventory, live shipmate location, newly received messages, OceanNow orders, current folio balances and live operational changes.

The app should still make the cached version useful while explaining that it cannot verify real-time status until it reconnects.

### PWA implementation notes

A service worker can cache app resources and selected data for offline retrieval. IndexedDB can store structured trip data, notes and locally queued changes. A cache-first approach can make static resources responsive; a network-first or stale-while-revalidate approach may be more appropriate for information that changes frequently. The design must include cache versioning, expiration, passenger logout cleanup and protection for personal data stored on a shared device.

Background Sync is not uniformly supported across major browsers, so the app should not depend on it for essential delivery. It should retry pending low-risk changes when the app is opened and connectivity returns. iOS web push is supported for Home Screen web apps on iOS/iPadOS 16.4 and later, subject to user permission and the web-push implementation. Push notifications should therefore be an enhancement, not the only way a passenger can discover an important change.

### Success measures

- Percentage of essential trip screens available in airplane mode.
- Percentage of users who successfully download their voyage pack.
- Time to display a saved itinerary or confirmation with no network.
- Number of failed tasks due solely to loss of connectivity.
- Percentage of cached records with visible freshness timestamps.
- Offline usability score in passenger testing.

---

## Priority 5 — OceanReady check-in and passenger profile status

### What passengers are describing

Passengers report that check-in status can appear to regress, information can fail to save, fields can reappear as incomplete even after being completed, and app and website status can disagree. One Cruise Critic thread describes an app asking for check-in details again and showing a medallion pickup status even though medallions had already arrived. A reply describes an emergency contact field that was already populated but returned an internal error when saved, before the app later showed the passenger as complete. A separate Reddit report describes a phone number repeatedly disappearing from the checklist after being saved.

Princess's official OceanReady information explains that the travel checklist includes medallion ordering/customization, photos, payment methods, emergency information, personal details and travel documents. Some steps must be completed before embarkation, so passengers reasonably expect the status to be dependable.

### Recommended PWA solution: a guided embarkation checklist

1. Present the checklist as a sequence of clearly labelled tasks with a progress summary.
2. Distinguish required, optional, completed, submitted/pending validation and action required.
3. Explain why a field is needed and who can see the information.
4. Save drafts locally when appropriate and safely resume after interruption.
5. After a successful server save, show a timestamp and confirmation.
6. If the server rejects a field, retain the entered value and explain the specific validation problem.
7. Reconcile the displayed checklist with Princess's server status on refresh; do not silently overwrite a more complete local draft.
8. Flag contradictory states and give the passenger a clear next action.
9. Provide a downloadable checklist summary showing completed and remaining steps.
10. Give passengers a help link specific to the exact step that failed.
11. Provide a consistent view across the PWA and other supported Princess channels.
12. Show an explicit “You are ready for embarkation” state only when the authoritative source confirms it.

### Additional opportunity

Introduce a **Pre-cruise readiness score** that is based only on verified checklist completion, with a short list of remaining tasks. Stanley can explain what each step means and why it matters, but must not invent or infer that Princess has accepted a document if the server has not confirmed it.

### Success measures

- OceanReady checklist completion rate.
- Repeated data-entry rate.
- Rate of contradictory app/web completion states.
- Check-in support contacts per passenger.
- Time to resolve a failed checklist step.

---

## Priority 6 — Navigation, search and task-flow friction

### What passengers are describing

A March 2026 Reddit discussion gives a particularly clear example: a passenger browsing excursions says that selecting an item and returning to the list takes them all the way back to the app's main page. Other reviews describe too many clicks to locate a partner, repeated sign-ins while moving between sections, difficulty finding reservations, and controls hidden several screens deep.

Princess announced a navigation redesign in 2026, with menus organised around the trip journey and clearer section names. This is a positive direction, but the customer reports demonstrate that a navigation redesign must be judged by successful task completion, not by the menu labels alone.

### Recommended PWA solution

**Use a task-based navigation model**

Primary navigation should be simple and persistent:

- **Today** — the current day, next commitment, alerts and quick actions.
- **My Voyage** — itinerary, timeline and reservations.
- **Explore** — ports, excursions, ship venues and activities.
- **Travel Party** — companions, group plans and meetups.
- **Help / Profile** — account, preferences, support and privacy.

The exact labels can be user-tested, but the structure should remain consistent throughout the voyage.

**Functional requirements**

1. Preserve search filters, list position and selected cruise when the user opens an item and returns.
2. Keep a visible trip switcher when a passenger has multiple upcoming cruises.
3. Provide one global search across ports, venues, activities, restaurants and reservations.
4. Support natural-language search such as “What time is dinner tonight?” or “Where is the Princess Theatre?”.
5. Provide contextual actions on a result: save, share, navigate, add reminder or open booking.
6. Avoid requiring a new sign-in when a user moves between sections of the same authenticated session.
7. Provide breadcrumb or back behaviour that returns to the exact prior screen.
8. Use clear labels rather than unexplained icons.
9. Keep the most common actions one or two taps away.
10. Support mobile and desktop layouts; the PWA should adapt the same information model to phone, tablet and PC.
11. Make search results available from every major journey stage.
12. Include empty states that explain what should appear and when data is expected to become available.

### Success measures

- Task completion rate and time for common jobs.
- Back-navigation success and loss-of-context rate.
- Search success rate.
- Number of taps to reach key passenger tasks.
- Session restarts and authentication interruptions.

---

## Priority 7 — Port-day and shore-excursion planning

### What passengers are describing

Passengers report difficulty sorting or finding excursions, locating excursions they have already booked, and seeing excursion commitments alongside the rest of their voyage. A 2026 community discussion describes the frustration of scrolling through a large set of excursions without being able to organise them as expected. Other reports describe paid excursions being difficult to find and confirmation information appearing inconsistently.

Port planning is a particularly high-value opportunity because it combines several of the passenger's most important questions: how to get ashore, what to do, how to get there, how much time is available and when to return.

### Recommended PWA solution: Port Day Workspace

Each port should have one dedicated workspace with the following sections.

**A. Port-call facts**

- Port name, country, region and local time zone.
- Arrival, all-aboard and departure times.
- Ship time and local time displayed side by side when they differ.
- Days until the port call.
- Docking, anchoring or tender status.
- Expected time available ashore.
- Terminal/port location and relevant transport information.
- Accessibility and mobility notes.

**B. Shore access**

- Explain whether guests walk off, use a gangway, take a tender or use a shuttle.
- Show tender/transfer details when confirmed.
- Provide a map of the port area, terminal and useful nearby facilities.
- Explain how to reach the town centre and common transport options.
- Clearly distinguish ship-operated transport from independent transport.

**C. Experiences and excursion discovery**

- Group experiences by type, duration, distance, physical demand and cost.
- Make filters persist when opening and returning from an excursion.
- Show duration, meeting point, inclusions, exclusions, accessibility and cancellation terms.
- Clearly distinguish Princess shore excursions from independent recommendations.
- Show the time the passenger must be at the meeting point and estimated return time.
- Let a passenger save a shortlist and share it with their travel party.
- Provide a “Booked by me” view next to “Explore”.

**D. Independent exploration**

- Provide curated top experiences, beaches, attractions, food, shopping and local culture.
- Provide map pins and walking/transit context where reliable.
- Let passengers create a custom route and save notes.
- Include practical information: local currency, language, transport, safety context, accessibility and typical payment methods.
- Explain what is close to the port versus what requires a longer excursion.

**E. Return-to-ship safety**

- Show all-aboard time prominently, not just the ship's departure time.
- Calculate a passenger-selected return buffer and departure reminder.
- Explain that all-aboard time is the operative deadline, and distinguish it from the published ship departure time.
- Show local time and ship time with explicit labels; never rely on a numeric time without a zone label when the zones differ.
- Support a saved offline port pack.
- Let the group agree on a meeting point and a time to return.

### Stanley opportunity

Stanley can turn a static port page into a practical shore assistant:

- “You have about six hours ashore. Here are three options that fit.”
- “This visit is tendered. Allow time for the tender queue.”
- “Your excursion returns at 3:10 PM. All aboard is 4:30 PM.”
- “You saved the beach and old town. They are difficult to combine with your current time budget; here is a simpler alternative.”

Recommendations must use the actual ship schedule and confirmed Princess data, display assumptions, and avoid implying that a self-guided activity is guaranteed to be safe or on time.

### Success measures

- Time to find a suitable excursion or independent activity.
- Booked-excursion visibility rate.
- Port-guide downloads before arrival.
- Percentage of port days with a saved plan.
- Passenger understanding of local/ship time and all-aboard deadline.

---

## Priority 8 — Onboard activities and entertainment schedule

### What passengers are describing

A September 2025 Reddit discussion says that onboard activities were not visible until relatively close to sailing, that schedules sometimes appeared only after connecting to ship Wi-Fi, and that passengers used recent Princess Patter copies shared by other guests to find out about theme nights. The same discussion describes some schedules appearing only a few days before embarkation. In a June 2026 discussion about the updated app, a passenger reports that chat notifications were missing; another describes activity access as easier after a UI change, showing that experience can vary.

These reports do not establish that every voyage has late or incomplete schedules. They do show why passengers need clear information about when a schedule is expected to be available and whether it has been updated.

### Recommended PWA solution: My Onboard Day

1. Provide a day-by-day event schedule with category filters: theatre, live music, Movies Under the Stars, guest entertainers, dance venues, enrichment, games, family, wellness, dining events and special celebrations.
2. Let passengers favourite activities and add them to their personal schedule.
3. Show venue, deck, start time, duration and any reservation requirement.
4. Clearly indicate when an event is fully booked, reservation-only or walk-in, where Princess data supports this.
5. Show schedule completeness status: preliminary, updated, final or subject to change.
6. Show when the schedule was last updated.
7. Notify guests about changes to events they have saved, subject to notification permission and delivery capability.
8. Detect conflicts with dining, spa, excursions and other saved plans.
9. Let travel-party members share activity plans and RSVP.
10. Provide a daily “What's happening today?” view.
11. Support offline viewing of the last downloaded daily schedule.
12. Let guests search by performer, venue, event type and time.
13. Include an optional “quiet day” or “family day” planner to help filter the schedule.
14. Make it easy to see which events are suitable for children, adults or all ages, based on verified event data.
15. Preserve recently viewed events and scroll position when returning from details.

### Success measures

- Percentage of available events visible in the app.
- Schedule freshness and time-to-publish.
- Favourite-to-attendance conversion where measurement is permitted.
- Reduction in missed/unknown schedule complaints.
- Notification delivery and interaction rates.

---

## Priority 9 — Dining reservations, group seating and package clarity

### What passengers are describing

Dining is one of the most visibly frustrating areas in passenger discussions. Examples include passengers unable to make dining reservations despite believing they meet the eligibility rules, restaurant options missing from the app, needing to call to make or repair bookings, and uncertainty about how to add guests from another booking. Some app reviews describe difficulty booking months in advance, especially when travelling with children and wanting to coordinate dinner times.

Princess publishes dining reservation functionality, and its current app listing describes making and managing dining reservations. The issue is that the booking workflow, eligibility and guest selection can be difficult to understand or unreliable in individual cases.

### Recommended PWA solution

1. Show dining options by date, meal period, venue and reservation availability.
2. Explain eligibility rules in context—for example, why a guest can or cannot book at the current time.
3. When a reservation is unavailable, distinguish no inventory from a booking/payment/loyalty eligibility error.
4. Show available alternatives by nearby time, venue or party size.
5. Allow selection of a linked Travel Party rather than repeatedly adding guests from booking numbers.
6. Show all dining reservations in the Voyage Timeline and reservation wallet.
7. Show restaurant name, date, time, party members, special requests and confirmation status.
8. Make cancellation and modification rules visible before the passenger commits.
9. Allow group members to RSVP before the organiser submits a reservation, subject to Princess system support.
10. Display package benefits and restrictions alongside a venue or menu, with clear source and applicability.
11. Keep “saved restaurant” separate from a confirmed reservation.
12. If a booking fails, retain the selected venue/date/party and offer a recoverable alternative.
13. Provide menu browsing and dietary information where the ship and venue have supplied current, approved data.
14. Let passengers save menus and dining preferences offline.

### Success measures

- Dining booking completion rate.
- Number of calls caused by eligibility confusion.
- Time to build a dining plan for a group.
- Percentage of dining reservations visible in the unified timeline.
- Reservation change and failure rates.

---

## Priority 10 — Onboard account, package redemption and loyalty transparency

### What passengers are describing

Customer reviews include reports of difficulty opening the onboard account, problems with loyalty status appearing incorrectly, uncertainty about Wi-Fi package discounts and difficulty seeing which package entitlements have been used. These are not as broadly evidenced as the core navigation and reservation issues, but they matter because they involve money and perceived package value.

### Recommended PWA solution: Onboard Wallet

1. Show the current folio balance, pending charges and posted transactions where Princess provides data.
2. Display transaction date/time, amount, description and passenger/account association.
3. Let guests filter by passenger, category and date.
4. Explain package entitlements in plain language: included, partially included, discounted, chargeable or not eligible.
5. Show package redemption history—for example, drinks or other entitlements—when Princess data supports it.
6. Distinguish a pending authorization from a settled charge.
7. Provide a transaction-dispute/help route with the transaction reference pre-filled.
8. Show the loyalty tier and which benefits are currently recognised for that booking.
9. Explain when a benefit is not available because of sailing, booking, package or status rules.
10. Clearly label the last refresh time; do not imply a cached folio is live.
11. Make the end-of-cruise statement downloadable when permitted.

### Success measures

- Folio access success rate.
- Reduction in account-related support contacts.
- Time to identify a charge or package redemption.
- Percentage of passengers who understand their package inclusions.

---

## Priority 11 — Ship maps, deck plans and wayfinding

### What passengers are describing

Some app-store reviews specifically ask for deck plans to be reliably available. Recent passenger reports also describe ship navigation not tracking movement as expected or requiring the app to be closed and reopened to refresh directions. Princess advertises ship navigation and instructions to venues, so this is another case where the feature may exist but the quality and reliability of the actual experience matter.

### Recommended PWA solution: Ship Explorer

1. Provide a searchable deck plan for each ship, available offline.
2. Let guests search for restaurants, theatres, restrooms, elevators, pools, medical facilities, guest services, kids' clubs and other venues.
3. Show deck, nearby landmarks, opening hours and accessibility information where available.
4. Provide a route between two named venues, including deck changes and elevator options.
5. Offer accessible routes for passengers avoiding stairs or with mobility constraints.
6. Let guests bookmark frequently used venues.
7. Provide a static map fallback if live positioning is unavailable.
8. Clearly explain whether directions use live location or require the guest to select their starting point.
9. Support “Take me to my next event” from the voyage timeline.
10. Let travel-party members share a meeting point on the ship map.

### Success measures

- Time to locate a venue.
- Wayfinding task completion rate.
- Usage of offline deck plans.
- Passenger satisfaction with accessibility routes.

---

## Priority 12 — Reliable shipmate chat and notifications

### What passengers are describing

A June 2026 passenger discussion says chat notifications did not arrive despite notification permission being enabled. Another passenger reports chat lag and says the group eventually stopped relying on it and arranged fixed meeting places instead. Other reports describe chat as buggy on different phone platforms.

This pain point overlaps with the Travel Party Hub, but deserves separate attention because a group feature that cannot reliably notify people may be worse than no group feature at all.

### Recommended PWA solution

1. Build a unified message centre with unread counts and clear conversation states.
2. Support opt-in web push notifications where the browser/platform allows them.
3. Provide an in-app notification inbox as a reliable fallback.
4. Show message status: sending, sent, delivered where the server confirms it, and failed.
5. Let users mute or prioritise specific group chats.
6. Provide notification test/diagnostic settings and explain browser permission state.
7. Support saved meeting points and schedules when push is unavailable.
8. Make offline-created messages visibly pending; do not imply delivery until confirmed.
9. Keep time-sensitive safety and ship announcements in a separate, clearly prioritised channel if Princess supplies that feed.
10. Provide quiet hours and per-category controls.

### PWA limitation

Web push can be supported in modern browsers, including iOS/iPadOS Home Screen web apps from version 16.4 onward, but the user must opt in and implementation must satisfy browser requirements. A PWA should not promise that every notification will always arrive. Important information should also be visible in the app's own notification centre and trip timeline.

### Success measures

- Notification opt-in rate.
- Push delivery/open rate.
- Message delivery failure rate.
- Percentage of users who can successfully locate a fallback meetup plan.

---

## Priority 13 — OceanNow ordering and menu accuracy

### What passengers are describing

Passenger reviews mention drinks that cannot be found in the ordering interface even though guests expect them to be available. This is a narrower complaint than account, booking or reservation friction, but it touches a service that is central to the onboard experience and to the perceived value of Plus/Premier packages.

### Recommended PWA solution

1. Present food, beverage and amenity menus in clear categories.
2. Make the menu specific to the ship, venue, service period and delivery area.
3. Display package inclusion and any additional price beside each item.
4. Show unavailable items clearly and offer alternatives where possible.
5. Avoid presenting an item as orderable when the ship's inventory or service area does not support it.
6. Show order status: received, accepted, being prepared, dispatched, delivered or unable to fulfil—only when supported by the source system.
7. Display estimated delivery time only when grounded in operational data.
8. Preserve cart contents if connectivity drops, but do not submit an order until the passenger explicitly confirms while connected.
9. Make substitutions and price changes explicit before confirmation.
10. Let passengers access approved menus offline for browsing, with clear “availability must be checked” labels.

### Success measures

- Order completion rate.
- Item unavailable/incorrect menu rate.
- Order cancellation and substitution rate.
- Time to find an item covered by a package.

---

## Priority 14 — Support, problem reporting and service recovery

### What passengers are describing

Several discussions describe repeated phone calls, conflicting answers, advice to reinstall or wait, and passengers being unable to get a clear resolution. A new app cannot resolve every underlying operational or account issue, but it can stop making the passenger repeat their story.

### Recommended PWA solution: Help that knows the context

1. Provide a help centre with search and journey-stage categories.
2. Allow a passenger to report a problem directly from the screen where it occurred.
3. Attach safe diagnostic context automatically: app version, device/browser family, current section, error reference and last sync time.
4. Never automatically attach sensitive passport or payment data to a support report.
5. Let the user add a description and optional screenshot.
6. Provide a case number and status history.
7. Show whether a response is expected from an automated guide, Princess support or shipboard Guest Services.
8. Avoid repeatedly suggesting “reinstall the app” as the only remedy.
9. Provide a fallback contact path when the digital service is unavailable.
10. Give Stanley access to approved support content and known troubleshooting steps, with clear escalation when confidence is low.
11. If a known system outage is reported by Princess, display a service notice and avoid asking each passenger to repeat the same failed action.

### Success measures

- Self-service resolution rate.
- Repeat-contact rate.
- Time to resolve app-related issues.
- Percentage of reports with sufficient diagnostic detail.
- Passenger satisfaction after service recovery.

---

# 5. Cross-cutting design principles

These principles should govern the entire PWA rather than be treated as isolated features.

## 5.1 One trip, one coherent model

The passenger should not need to understand which Princess department or backend system owns a reservation. Dining, excursions, spa, entertainment, port calls, travel party plans and personal reminders should appear in one coherent voyage model.

## 5.2 Distinguish confirmed facts from suggestions

Every item should be clearly labelled as one of:

- Confirmed by Princess.
- Pending Princess confirmation.
- Saved by the passenger.
- Suggested by Stanley or the PWA.
- Shared by another travel-party member.
- Cached from the last successful update.

Do not blur a suggestion into a booking or a cached value into a live status.

## 5.3 Make time-zone information safe and unambiguous

For each port day, show local port time and ship time when different. Label each explicitly. All-aboard should be more prominent than departure time. Reminders should be based on the correct time zone and updated if the ship changes its operating schedule.

## 5.4 Offline-first, not offline-only

Use the network when it adds value, but do not make static or previously retrieved information depend on a live connection. Show a freshness timestamp and a clear path to refresh. Offline use must not imply that live inventory, charges, location or booking status can be verified.

## 5.5 Reduce cognitive load

Show the next useful action, not every possible feature at once. Use consistent layouts, persistent navigation, global search, clear labels and stable back behaviour. Preserve the passenger's context after every action.

## 5.6 Privacy is a product feature

Group membership, shared plans, messaging and location must have clear and independent permissions. Location should be opt-in, revocable and time-bounded. Sensitive booking data should not be exposed through a share link.

## 5.7 Design for the whole range of passengers

Support older passengers, people with visual or motor impairments, people travelling with children and passengers using a desktop to plan before travelling. Use readable type, clear contrast, accessible controls, keyboard support and understandable language. Do not assume every passenger is an experienced app user.

## 5.8 Design for both phone and PC

The phone is the primary onboard companion. Desktop is especially useful for pre-cruise research, comparing excursions, reviewing country/port guides, printing itineraries and organising multi-cabin groups. Use one responsive product, not two disconnected experiences.

---

# 6. What the PWA can solve itself—and what needs Princess integration

A credible proposal should separate front-end experience ownership from access to Princess's operational systems.

| Capability | PWA can deliver directly | Requires Princess API/system integration | Key caveat |
|---|---|---|---|
| Cached itinerary and port guide | Yes | Initial trip/port data feed | Must show last-sync time and stale status |
| Downloadable confirmations | Yes, after retrieval | Booking/confirmation data | Do not treat a cached confirmation as proof a booking is still active after a change |
| Shared party and invitations | Yes, with a PWA service/backend | Identity validation for passengers/bookings | Must respect guest privacy and cabin/booking boundaries |
| Shared notes, polls and plans | Yes | Optional integration to confirmed reservation data | Keep personal plans distinct from confirmed bookings |
| Voyage timeline | UI, aggregation and personal reminders | Dining, excursion, spa, activity and itinerary feeds | Depends on feed completeness and consistent identifiers |
| Check-in checklist UI | Yes | OceanReady status and document workflow | PWA cannot approve travel documents itself |
| Live dining reservations | Booking UX only | Dining inventory, eligibility, guest list, booking and cancellation APIs | Never promise a reservation until Princess confirms it |
| Excursion discovery/booking | Discovery and planning UX | Excursion inventory, pricing, booking and cancellation APIs | Independent port content must be clearly distinguished from Princess excursions |
| Real-time folio | Display and explain | Onboard account/transaction feed | Must identify refresh time and pending charges |
| Package benefits | Explain and present | Passenger entitlement and redemption data | Rules must come from Princess and be sailing-specific |
| Live shipmate location | Map/interface only | Medallion or approved ship-location service | Browser background location is not a substitute for Medallion infrastructure |
| Shipboard directions | Static maps/search can work offline | Ship-specific map data; live positioning for turn-by-turn | Provide static fallback if live positioning is unavailable |
| Chat and notifications | PWA messaging UI and web push | Secure message service and shipboard network integration | Push is permission- and platform-dependent |
| OceanNow ordering | Menu and cart UX | Menu availability, delivery zones, order and payment systems | Do not submit orders offline or imply availability without a live check |

### Integration strategy

1. Agree a supported integration model with Princess before designing transactional features as if APIs exist.
2. Define canonical passenger, booking, voyage, port-call, reservation, venue and activity identifiers.
3. Ask Princess to expose a stable guest-facing aggregation API or approved set of domain APIs.
4. Require explicit freshness timestamps, data ownership and error semantics from every source.
5. Build an adapter layer so the PWA is not tightly coupled to a single backend response structure.
6. Use event/webhook updates where appropriate for booking changes, cancellations, schedule changes and service alerts.
7. Maintain a clear audit trail for all transactional operations.
8. Establish privacy, data-retention, security and incident-response requirements before enabling cross-cabin group features.

---

# 7. Recommended delivery roadmap

## Release 1 — Trust, clarity and offline foundations

**Goal:** Make the PWA valuable even before deep operational integration is complete.

- Responsive phone and desktop experience.
- Fast, persistent navigation and global search.
- Trip overview and a unified timeline using available booking data.
- Clear data status and last-sync timestamps.
- Offline cruise pack: itinerary, port times, port guides, maps, confirmed reservation summaries and saved notes.
- Reservation wallet and downloadable trip summary.
- Guided booking association and check-in status presentation, subject to supported APIs.
- Context-preserving navigation and recoverable errors.
- Basic Stanley help and trip explanations.

**Exit criteria:** A passenger can open the app in airplane mode and still find the essential facts for the sailing, their saved port plans and the last retrieved booking confirmations.

## Release 2 — Travel Party and coordinated planning

**Goal:** Make group travel substantially easier.

- Travel Party Hub.
- Secure invitations and QR joining.
- Multiple groups and role/permission management.
- Shared day plans, event RSVPs and polls.
- Group dining and excursion planning.
- Shared meetup points and optional messaging.
- In-app notification centre and supported web push.

**Exit criteria:** A multi-cabin group can connect once, coordinate multiple activities and share plans without using a dining reservation as the entry point.

## Release 3 — Port and onboard experience intelligence

**Goal:** Help guests make better use of their time.

- Detailed port-day workspace.
- Ship-time/local-time display and all-aboard alerts.
- Better excursion sorting, filters and booked-excursion visibility.
- Onboard schedule, favourites and conflict detection.
- Ship deck plans and venue search.
- Stanley recommendations grounded in the guest's itinerary and preferences.

**Exit criteria:** A passenger can plan a port day and an onboard day from one connected timeline, and retrieve the saved plan offline.

## Release 4 — Deep transactional and shipboard integration

**Goal:** Extend from companion/planning to operational concierge.

- Dining reservation creation/change/cancellation.
- Excursion booking and management.
- Spa and other booking types.
- Onboard folio and package redemption.
- Medallion/shipmate location integration, if approved.
- OceanNow ordering and order tracking.
- Service outage notices and support-case integration.

**Exit criteria:** Transactions are confirmed by Princess systems, visible in the timeline, and accompanied by clear status and audit information.

---

# 8. Suggested product scorecard

The following metrics would help Princess judge whether the PWA is materially improving passenger experience rather than simply adding another digital channel.

| Dimension | Suggested measure | Why it matters |
|---|---|---|
| Reliability | Successful completion rate for top 10 passenger tasks | Measures whether guests can actually get things done |
| Trust | Percentage of key records showing a verified status and last-updated time | Reduces anxiety about stale or contradictory information |
| Group experience | Percentage of multi-cabin parties connected before embarkation | Tests the companion proposition directly |
| Planning | Time to locate a booked excursion/dining/spa appointment | Measures the “single trip view” value |
| Offline | Essential-screen success rate in airplane mode | Verifies the PWA's core differentiator |
| Port confidence | Passenger comprehension of all-aboard time and ship/local time | Reduces a high-consequence misunderstanding |
| Discovery | Time to find a port activity or onboard event | Measures whether search and filters work |
| Support | App-related support contacts per 1,000 guests | Measures reduction in avoidable friction |
| Engagement | Daily active use of timeline, saved plans and port guides | Indicates whether the app is useful beyond check-in |
| Satisfaction | Post-task satisfaction, segmented by task | Shows exactly where improvement is occurring |

### Establish baselines before launch

Princess should collect a baseline for the same measures from existing digital journeys before comparing results. Do not rely on app downloads, logins or raw session counts as success measures. The meaningful question is whether passengers complete important tasks more reliably, with less effort and less need to contact support.

---

# 9. Stanley's role in resolving friction

Stanley should be the visible guide to the voyage, not a generic chatbot placed in a corner. He can make the PWA feel more human while also reducing the cognitive work required to plan and coordinate.

| Pain point | Useful Stanley behaviour |
|---|---|
| Booking uncertainty | “Your dinner request is still pending. I’ll show it as pending until Princess confirms it.” |
| Companion linking | “Invite the rest of your party with this QR code. They can join using their own accounts.” |
| Missing reservation | “I can see your excursion confirmation from the last sync at 10:42 AM. It has not refreshed since then.” |
| Offline use | “You're offline. Your port guide and saved reservations are available; live availability and changes need a connection.” |
| Port planning | “You have 5 hours ashore. Here are two plans that fit your return buffer.” |
| All-aboard deadline | “All aboard is 4:30 PM ship time. Your phone currently shows local port time, which is one hour ahead.” |
| Activity conflicts | “Your spa appointment overlaps the first 20 minutes of the show you saved. Would you like another performance?” |
| Dining group | “Four people have accepted dinner. Two haven't responded yet.” |
| Ship wayfinding | “The venue is on Deck 6. Here is the route from your current selected starting point.” |
| Support | “This looks like a booking-sync issue. Here is the reference number and the information support will need.” |

### Stanley interaction principles

- Use proactive cards, visual status, maps, timelines, checklists and quick actions—not just text chat.
- Explain why something matters, particularly for port return times and check-in deadlines.
- Always distinguish verified Princess data from AI-generated suggestions.
- Make actions reversible where possible and require confirmation for purchases, cancellations or changes.
- Do not make a promise on behalf of Princess unless the connected system has confirmed it.
- When offline, work from downloaded information and state the limitation.

---

# 10. The business case for Princess

The strongest commercial argument is that a better PWA can improve the experience at the moments when the passenger most needs help, while also reducing avoidable service demand.

## Passenger value

- Less confusion before boarding.
- Fewer repeated form entries and support calls.
- More confidence that bookings and plans are recorded.
- Easier coordination across cabins and families.
- Better use of port time and onboard activities.
- Less reliance on ship connectivity for basic trip information.
- A more personal, guided experience through Stanley.

## Princess value

- Fewer avoidable contacts about missing bookings, app navigation and companion linking.
- Better visibility into where passengers struggle in the journey.
- More effective discovery of shore excursions, dining and onboard activities.
- Stronger engagement across the full cruise journey, not just embarkation.
- Improved passenger satisfaction and reduced frustration around digital service.
- A consistent customer experience across phone and desktop.
- A platform for introducing new planning, social and AI-powered services without forcing every enhancement into the existing native app release cycle.

## Why the PWA angle is compelling

A PWA offers one responsive web application for phone and desktop, with the ability to install to a device home screen, cache essential data and update centrally. It avoids requiring a passenger to install a new native app simply to access the proposed companion/planning experience.

The strongest PWA differentiator is not “it is a website that looks like an app.” It is **a cruise companion that remains useful when the network is poor, can be shared easily with other travellers, and presents the whole voyage as one connected experience**.

The commercial proposal should be honest about the dependencies: transactional and live shipboard capabilities need Princess integration. The PWA can deliver a substantial amount of passenger value before every backend connection is available, but it must never simulate a successful booking, payment or live location update.

---

# 11. Research evidence and source notes

The sources below are included so that product stakeholders can trace the passenger examples and verify current advertised capabilities. Forum posts and reviews are individual accounts; they should be treated as qualitative evidence rather than proof of fleet-wide failure rates.

## Passenger discussions and reviews

1. **Cruise Critic — “add travel companions on new Princess App”** (17–18 August 2024). The supplied discussion: passengers ask how to add friends; replies describe needing other booking numbers and using the dining reservation edit/pencil flow; participants question why companion linking is tied to dining and discuss when shipmate following becomes available.  
   https://boards.cruisecritic.com/topic/3023692-add-travel-companions-on-new-princess-app/

2. **Reddit, r/PrincessCruises — “Adding others to dining reservation”** (March 2024). Describes uncertainty about adding guests from other cabins in the new app; replies explain that the capability was present but difficult to find in the guest-editing flow.  
   https://www.reddit.com/r/PrincessCruises/comments/1b98tnf

3. **Reddit, r/PrincessCruises — “Doe the Princess App really suck this bad or is it me?”** (9 March 2026). Reports dining eligibility messages and OceanReady not responding; replies describe excursion navigation returning to the home page.  
   https://www.reddit.com/r/PrincessCruises/comments/1rp87r3/doe_the_princess_app_really_suck_this_bad_or_is/

4. **Reddit, r/PrincessCruises — “Onboard activities”** (29 September 2025). Passengers discuss schedules appearing only weeks or days before sailing or after connecting to ship Wi-Fi, and difficulty planning around theme nights and finding excursions.  
   https://www.reddit.com/r/PrincessCruises/comments/1ntcuac

5. **Reddit, r/PrincessCruises — “Princess app is driving me insane. How do I see my reservations?”** (19 September 2025). Passenger reports difficulty finding excursion times, spa/salon bookings and dining reservations, after multiple calls and app resets.  
   https://www.reddit.com/r/PrincessCruises/comments/1nktvl1

6. **Reddit, r/PrincessCruises — “Experience so far of people onboard any Princess Cruise using newly updated Princess App?”** (20–30 June 2026). Reports chat notification problems, lag, app reliability differences and ship navigation not updating smoothly for some users.  
   https://www.reddit.com/r/PrincessCruises/comments/1ub5iax

7. **Reddit, r/PrincessCruises — “Princess App”** (7 January 2026). Reports multiple reservations, incorrect names and guest counts; a reply mentions excursions not appearing in Journey view and chat notification improvements.  
   https://www.reddit.com/r/PrincessCruises/comments/1q6e58g

8. **Reddit, r/PrincessCruises — “App won't save my phone number for check in”** (26 October 2025). Passenger reports a phone number repeatedly disappearing from the check-in checklist after saving.  
   https://www.reddit.com/r/PrincessCruises/comments/1ogbs8x

9. **Reddit, r/PrincessCruises — “2nd Guest can't access booking in the app”** (26 December 2024). Describes a second passenger whose booking is not visible under their account and an “already added” message when trying to associate it.  
   https://www.reddit.com/r/PrincessCruises/comments/1hmpoxs

10. **Reddit, r/PrincessCruises — “Trip won't show in the app”** (2 June 2026). Describes a booked cruise disappearing from the app while remaining on the website, with the booking code also failing in the app.  
    https://www.reddit.com/r/PrincessCruises/comments/1tufbu9

11. **Reddit, r/PrincessCruises — “Boarding passes”** (15–17 November 2026). Recent report of inability to access boarding passes/arrival time, a reinstall resolving one user's issue, and a separate excursion booking problem across app and browser.  
    https://www.reddit.com/r/PrincessCruises/comments/1xxaklb

12. **Cruise Critic — “Oh what fun checking in on the app... medallion, account & system issues”** (2025). Passengers discuss check-in status and app/system issues, with some choosing to complete check-in at the pier when the app is unreliable.  
    https://boards.cruisecritic.com/topic/3053883-oh-what-fun-checking-in-on-the-appmedallion-account-system-issues/

13. **Cruise Critic — “Difficulties making dinner bookings on the app”** (2024). Reports inconsistent dining eligibility and availability behaviour across app and website.  
    https://boards.cruisecritic.com/topic/3003119-difficulties-making-dinner-bookings-on-the-app/

14. **Apple App Store — Princess Cruises app reviews (Canada/iPad view)**. Includes individual reports about Wi-Fi recognition, login/internal errors, check-in booking association, app loading and missing deck plans. Ratings and review samples vary across storefront/device views; no single rating is used here as a representative measure.  
    https://apps.apple.com/ca/app/princess-cruises/id6469049279?platform=ipad&see-all=reviews

15. **Apple App Store — Princess Cruises app reviews (US)**. Includes individual reports about missing room-service drink options, difficulty navigating the app and account access.  
    https://apps.apple.com/us/app/princess-cruises/id6469049279?see-all=reviews

## Official Princess information

16. **Princess — Get Ready for Your Princess Cruise / OceanReady.** Describes the travel checklist and required pre-cruise information, plus the mobile app and web version.  
    https://www.princess.com/en-int/plan/oceanready

17. **Princess — Princess MedallionClass.** Describes official app capabilities including shipboard navigation, shipmate location/messaging, activities and onboard account access.  
    https://www.princess.com/en-int/ships-and-experience/princess-medallionclass

18. **Princess — Princess Cruises App legal/feature description.** Describes OceanReady, OceanNow and JourneyView, including Shipmates and shipmate messaging/location subject to conditions. The legal description should be checked against the currently deployed experience before implementation planning.  
    https://www.princess.com/en-int/legal/princess-cruises-app

19. **Apple App Store — Princess Cruises app product description and version history.** Lists current app functions and recent version notes, including the 30 October 2026 version 1.11.1 update.  
    https://apps.apple.com/us/app/princess-cruises/id6469049279

## PWA technical references

20. **MDN — Caching.** Explains that PWAs can cache app resources and selected data for offline operation and responsiveness, with freshness as a key trade-off.  
    https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching

21. **MDN — Offline and background operation.** Explains service-worker offline behaviour and background operation, including the limits of service-worker execution and background synchronization.  
    https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation

22. **MDN — Background Synchronization API.** Describes Background Sync and labels it as having limited availability, so the product should not depend on it across all browsers.  
    https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API

23. **Apple Developer — Sending web push notifications in web apps and browsers.** Documents web push support for Home Screen web apps on iOS/iPadOS 16.4 and later, and the required user permission/service-worker setup.  
    https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers

24. **web.dev — PWA checklist.** Notes that travel apps should make trip details and boarding passes available offline and discusses designing authenticated offline experiences.  
    https://web.dev/articles/pwa-checklist

---

# 12. Final recommendation

The most persuasive proposal to Princess is not “we can build a prettier version of the app.” It is:

> **We can remove the friction that makes passengers work around the digital experience during a holiday they have spent months planning.**

Start with the problems that damage trust and create avoidable effort: unreliable trip visibility, companion linking, fragmented reservations, weak-connectivity dependence and confusing task flows. Build the foundations around one voyage timeline, a Travel Party Hub and an offline cruise wallet. Then extend into port-day planning, onboard schedule intelligence, ship navigation and Stanley's contextual concierge experience.

The travel-companion problem is a particularly good lead story because it is concrete, emotionally understandable and commercially relevant. A couple travelling with friends in different cabins should be able to connect their party once, share a port plan, coordinate dinner, find a meetup point and see who is joining an activity—without having to discover that a contact-management feature is hidden inside a restaurant booking flow.

If the PWA consistently answers **“Where am I going, what have I booked, who am I doing it with, what happens next, and what do I need to remember?”**—even when connectivity is poor—it will provide a meaningful improvement to the Princess passenger experience.
