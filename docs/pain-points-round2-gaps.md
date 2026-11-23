# Round 2 gaps: what the overnight pass (R1 to R8) could not fully close

Started 2026-11-23. Each phase adds its leftovers here. G-01 (pilot banner) was dropped by the owner: the app is a prototype and the UX sits on backend frameworks that mask real-world specifics. Verification for every phase: `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` only (project rules); nothing was walked on a device.

## R1 Continuity

Built: scroll position remembered per history entry and restored on Back (`src/routes/scrollMemory.ts`, `Shell.tsx`); filters mirrored into the address on dining and activity explorers, excursions, ports, venues and the day planner (`useMirrorParams`); saving or un-saving with no signal is held and sent on reconnect (`src/data/favouriteQueue.ts`).

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

Built: a "Download my cruise" card on the Phone screen above the saved-copy card (`CruisePackCard`, `useCruisePack`, `src/data/cruisePack.ts`). It reads, with a connection, the pass, muster and emergency cards, embarkation, check-in receipt, health card, dinners, spa, cabin, family, every day's programme, shore tours per port day, the bill and the going-home views, and keeps each under the exact name the screen reads, so those screens open from the copy. The guest picks sections and leaves out ports, sees an estimate, sees progress, can stop, sees what was and was not saved with a reason (no room, not published yet, could not reach), and can retry only the failures. The last result is kept on the phone. Items the guest switched off in the saved-copy list are skipped. Storage stays on the current format (IndexedDB deferred by the owner).

Open:
- Port guides, the Stanley port pack (`portPack`), deck-plan images and venue menus are not in the pack: the app bundle carries deck plans and venues, the port pack is fetched per day by its own screen. Add the port pack to the tours section.
- Party plans, shared boards, chat history and notes are not downloaded (chat has its own cache).
- The estimate is a typical size per item until a copy exists; it is not a measured size and does not check free space against the quota before starting.
- No prompt to download before sailing (a Home card at 14 days and again the day before) and no automatic refresh; the guest has to open the Phone screen.
- The "not available yet" cases (a pass before check-in) are listed as failures rather than "will download when ready"; a scheduled re-try when the item opens is not built.
- Copies expire by kind (programme in 3 days). A download well before sailing therefore needs refreshing close to it; the card says copies show their age but does not remind.
- Not walked in airplane mode on a phone.
