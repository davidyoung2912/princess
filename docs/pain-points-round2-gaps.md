# Round 2 gaps: what the overnight pass (R1 to R8) could not fully close

Started 2026-11-23. Each phase adds its leftovers here. G-01 (pilot banner) was dropped by the owner: the app is a prototype and the UX sits on backend frameworks that mask real-world specifics. Verification for every phase: `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` only (project rules); nothing was walked on a device.

## Round 2 list, in priority order

Detail for each item is in the phase sections below. "Owner" means it needs a decision, people or a device, not code.

| # | Item | Why now | Size | Needs |
| ---: | --- | --- | :---: | --- |
| 1 | Device walk: airplane mode on the ten must-work screens, measures B1 to B9, Maria / Daniel / Gerald / Linda walkthroughs, screen reader | Only thing that can lift any row to A+ | Owner | A phone and people |
| 2 | Compile and check the server: `dotnet build` after the `Problems.cs` trace-id change | Uncompiled edit sits in the repo | S | .NET (not run here) |
| 3 | Trip switcher so Home follows the chosen trip | Lowest single row (D) | M | Server current-trip override |
| 4 | Per-person permissions (in party, sees plans, may message, location) | Largest travel-party gap | L | Server work |
| 5 | Party picker in dining; decided poll becomes a booking request | Closes dining and party together | M | Booking API shape |
| 6 | Reservations in the global search index; search-success events | Lifts navigation and measures | S | none |
| 7 | "Take me there" on reservation rows (carry the venue's map place on bookings) | Finishes R6 | S | none |
| 8 | Screenshot redaction and a status/"who will answer" on report rows | Finishes support | M | none |
| 9 | Port pack and party plans in the cruise download; port choice; scheduled retry | Finishes offline | M | none |
| 10 | Fleet measure: consent-gated task-funnel event and server table; baseline sessions | Makes the metrics real | M | Owner and server |
| 11 | Per-source "what is fresh" list; one legend for the six status labels | Cross-cutting trust | S | none |
| 12 | OceanNow re-check (cart across reload, ETA wording); test-notification button; iOS install guidance | Not covered this pass | S | none |
| 13 | Device location sharing | Owner: not yet | L | Owner decision |

## R1 Continuity

Built: scroll position remembered per history entry and restored on Back (`src/app/routes/scrollMemory.ts`, `Shell.tsx`); filters mirrored into the address on dining and activity explorers, excursions, ports, venues and the day planner (`useMirrorParams`); saving or un-saving with no signal is held and sent on reconnect (`src/shared/data/favouriteQueue.ts`).

Open:
- Other list screens still keep filters in component state only: spa explorer, sailings compare, cabin chooser, reservations list, chat people. Scroll restore covers them, but chips reset.
- Notes (diary, packing, personal reminders) are not queued offline yet; only favourites are. Notes are already kept locally, so nothing is lost, but they do not reach the server until the screen is used online.
- Scroll restore waits up to about 40 frames for a lazy list to grow; a very slow list may open short of the old place. Needs a device check.
- "What is fresh" panel: `CapsuleCard` already lists age per kind; it is not linked from Me and does not cover booking, excursions or check-in as separate lines.

## R2 Explain the refusal

Found on reading the code (the first scorecard was too harsh here, corrected in the scorecard): `My Trips` (`/me/trips`) already lists every booking and links one with five distinct failures (`format`, `noMatch`, `alreadyLinked`, `review`, `supervised`); dining already has a booking window with a stated reason and date (`diningWindow`, `actionGate`: open, opensOn, needsBooking, readOnly, closed, finished, "never a disabled button"); and `plan.err.<title>` words each server refusal. `LoyaltyScreen` already has a discrepancy report.

Built: a support reference on errors (server adds its trace id to problem details in `Problems.cs`; `ApiError.reference`; shown by `ActionError` and `PlanError`); loyalty "Not available to you yet" with what unlocks each perk and the days to go (`lockedPerks`); a check-in contradiction banner when the status says finished but steps are open or no finish time exists (`checkinConflict`).

Open:
- The server change in `Problems.cs` (trace id into problem details) has not been compiled: `dotnet` is not installed here and the project rules rule out running server tests. Check `dotnet build` first thing.
- Reference ids only appear in `ActionError` and `PlanError`. Other error paths (sign-in, chat send, FindPass, Trips link banners, the error boundary) do not show one yet.
- Dining refusals at the moment of booking (no table vs not eligible vs payment) still fall back to whatever `plan.err.*` has; a full audit of the server titles against the wording table was not done.
- Loyalty days-to-go uses the loyalty record's day count; the locked-perk list comes from the front-end entitlements table, which duplicates the server's. Should be served.
- Check-in: no comparison of a locally saved draft against the server on refresh (the server is the only store, so a draft conflict cannot happen today); no step-specific help links.

## R3 Trips and Voyage

Built: the reservations list (the trip-wide wallet of dinners, spa and tours) now has kind chips, a search by venue, kind word, day ("day 3"), date ("March 14") or reference, and a compact view, all kept in the address (`tripFilter.ts`); global search offers "Look for ... in my bookings"; a "see what has changed" link on the list; every Explorer day card says whether the programme is preliminary or confirmed and when it is expected to be final (`scheduleStatus.ts`).

Open:
- **Trip switcher not built.** `ContextService` chooses the guest's "current trip" (next confirmed sailing) on the server and every service follows it. A real switcher needs a server-wide current-trip override (an optional trip in the context call and in every service that reads "current"). It cannot be done safely without compiling and testing the server. `/me/trips` already lists every booking and opens each one.
- Reservation search is a filter on the list, not part of the global search index; the global search only links to it.
- Performer search: events carry titles but no performer field in the programme data, so nothing to search. Needs the programme feed to name performers.
- The schedule status uses an authored rule (final from 6 pm the evening before). A real source would state it per day ("updated", "final") with a publish time; there is no "updated" state, and the ship's own cancel or move notices are separate.
- No per-item freshness on the list: it shows one copy age for dining; spa and tours load live.
- No compact agenda by day-strip or "next up" pin; the compact view only hides actions and details.

## R4 Download my cruise

Built: a "Download my cruise" card on the Phone screen above the saved-copy card (`CruisePackCard`, `useCruisePack`, `src/shared/data/cruisePack.ts`). It reads, with a connection, the pass, muster and emergency cards, embarkation, check-in receipt, health card, dinners, spa, cabin, family, every day's programme, shore tours per port day, the bill and the going-home views, and keeps each under the exact name the screen reads, so those screens open from the copy. The guest picks sections and leaves out ports, sees an estimate, sees progress, can stop, sees what was and was not saved with a reason (no room, not published yet, could not reach), and can retry only the failures. The last result is kept on the phone. Items the guest switched off in the saved-copy list are skipped. Storage stays on the current format (IndexedDB deferred by the owner).

Open:
- Port guides, the Stanley port pack (`portPack`), deck-plan images and venue menus are not in the pack: the app bundle carries deck plans and venues, the port pack is fetched per day by its own screen. Add the port pack to the tours section.
- Party plans, shared boards, chat history and notes are not downloaded (chat has its own cache).
- The estimate is a typical size per item until a copy exists; it is not a measured size and does not check free space against the quota before starting.
- No prompt to download before sailing (a Home card at 14 days and again the day before) and no automatic refresh; the guest has to open the Phone screen.
- The "not available yet" cases (a pass before check-in) are listed as failures rather than "will download when ready"; a scheduled re-try when the item opens is not built.
- Copies expire by kind (programme in 3 days). A download well before sailing therefore needs refreshing close to it; the card says copies show their age but does not remind.
- Not walked in airplane mode on a phone.

## R5 One party hub

Built: the Travel party screen (`/plan/party`) now opens with `PartyHub`: the people you are connected with (with a link to each chat), your groups, one invitation sheet that makes a QR code and link for "connect with me" or for any group you belong to (copy, the phone's share sheet where there is one, and email), and plain words on what connecting lets people do. A "Your travel party" link sits at the top of Plan and of Chat, so Party is no longer buried. The invite uses chat's existing hand-over codes (15 minutes, 1 hour or a day, stoppable), so there is still one list of people.

Open:
- **Per-person permissions** (in my party / sees my plans / can message / sees my location, each separate, hide from one person) are not built. The model today is a connection (messaging) plus what you choose to send; a per-person scope needs a server table and endpoints. The hub states what connecting allows in words only.
- **Group dining/excursions without booking numbers** is not built. A reservation can name only the guests on the booking; adding a person from another cabin needs the booking system's own permission model, which is outside the prototype's backend. Today a dinner is shared into chat (`SendToChat` on each booking) and a poll can decide it, but a decided poll does not create a booking request.
- The older email-invite and shared-notes parts of the Party screen are still local-only records for the booking (they send nothing). They should be removed or wired to the hub's invitation codes; kept for now because existing tests and the child rules rely on them.
- "Pending identity verification" is not a separate invitation state in the hub; waiting invitations are managed in Chat > People.
- The hub is hidden to nobody: before a booking is confirmed the chat calls may refuse and the cards show a load error rather than an explanation.
- Not walked on a phone.

## R6 Meet and find

Found on reading the code (the first scorecard was wrong): step-free routing with closed-lift rerouting, a graphic deck plan with the route drawn, a route from the guest's own cabin, venue "Navigate" links (`navigatePath`), a named-place card that expires and says so ("good until ... / has passed"), and meet-ups in rooms already exist.

Built: "Take me there" on the Now and Next lines of the daily planner and on a live meeting-point card in chat, opening the deck map at that place (`placeNavigatePath`).

Open:
- "Take me to my next event" is on the planner's now/next lines only; reservation rows (dinner, spa, tour) have no link because their venue-to-map place is not carried on the booking rows.
- Meeting-point cards: the guest cannot choose how long a point is good for; the server sets it. The place is matched to the map by name, so a place the map does not list shows no link.
- Directions start from a place the guest picks (no live position); that is stated on the map. Device location stays parked by the owner.
- A one-tap "I'm at the Piazza until 6" status for the whole party (rather than a card in one chat) is not built.

## R7 Provenance and support (G-01 dropped by the owner)

Found on reading the code (the first scorecard was wrong again): the report-a-problem screen already attaches the problem log and a screenshot, there is a status page with a declared-incidents feed, and cases show their owner team and due date.

Built: a service-notice banner at the top of every signed-in screen when an unresolved incident has been declared, with what it affects, a link to the status page and "hide for now" (`ServiceNotice`, `noticesToShow`; refreshed every five minutes while visible); a line on the report screen saying where a note goes and pointing to Open a case and Guest Services.

Open:
- The banner reads the existing incidents feed; nothing in the prototype declares an incident, so it is untested against a real one beyond the unit test of the rules. It hides while offline (it cannot know).
- Screenshots are attached as sent; there is no redaction step (blurring a card number or passport), only the instruction in the hint. Needs an editor or at least a warning at attach time.
- The report list shows reference, kind, time and text, but no status and no "who will answer". Cases do. Feedback and cases are two lists.
- "Case history" is the stage track; there is no message thread between the guest and the desk.
- Provenance labels (confirmed, sample, pending) were dropped with G-01.

## R8 Measure and walk

Built: an on-device top-task funnel (`taskFunnel`, shown in Diagnostics) and `docs/pain-points-measures.md`: what is measurable now, what needs people or Princess data, and a baseline method.

Open (all of these need the owner, people, or a device):
- **The device walk is not done**, and it is the only thing that takes any row to A+: airplane mode across the ten must-work screens, the nine quality measures B1 to B9, the Maria, Daniel, Gerald and Linda walkthroughs, and a screen-reader pass. None of this can run here (project rules). Book it first.
- Task counts stay on the phone. A fleet measure needs a consent-gated telemetry event and a server table.
- "No search results" and "opened a result" are not recorded, so search success cannot be measured.
- The baseline for the existing Princess app does not exist and needs sessions.
- `dotnet build` of the server has not been run since the `Problems.cs` trace-id change (no .NET here).
