# Best-in-market matrix (BM2)

Written 2026-11-08 for phase BM2 of `docs/best-in-market-plan.md`. Source: `docs/princess_cruises_expanded_best_in_market_requirements.md` (292 rows: 187 stage requirements, 25 phone, 22 quality-of-life, 58 cross-stage). Style follows `docs/a-tier-matrix.md`.

## How to read it

**Status**

- **Built**: a screen or module for the requirement was found, and the main acceptance wording is covered.
- **Partial**: found, but part of the acceptance wording is missing or unchecked. The gap column says which part.
- **Simulated**: works end to end, but the data or delivery is a backend mock behind an interface (project rule: the front end does not know).
- **Not built**: nothing found.
- **Out of reach**: needs hardware, a provider contract or a research session this project cannot do. Not a code gap.

**Basis** (how sure I am)

- **R** = I read the file and the acceptance wording against it.
- **F** = found by route, file name or search match only. The screen exists; I did not check every acceptance clause. Treat as "Built, unverified in detail".

**Limits of this document**

- No browser or device testing (project rule), so no row says "works on a phone".
- Test evidence is a vitest file that imports the module. A test may cover only part of it. The C# test facts are not counted (project rule: not run here).
- Paths are relative to the repo root. `src/ui/x/Y.tsx` is a screen; `src/domain/x.ts` is logic. Every path below was checked to exist by a script.
- Row text is shortened. The priority is the document's own.

## Totals

| Status | All 292 | P0 only (see note) |
|---|---|---|
| Built | 209 | 92 |
| Partial | 58 | 25 |
| Simulated | 13 | 2 |
| Not built | 6 | 2 |
| Out of reach | 6 | 1 |

- Basis: **15 rows were read (R), 277 were found only (F).** So "Built" mostly means "a screen, module and usually a test exist", not "every acceptance clause was checked". Treat the 216 as an upper bound; the Gap column lists what I could see was unchecked.
- P0 counts cover the 122 stage, phone and cross-stage rows the document marks P0 (QOL concepts carry no priority).
- (Before BM16.) Of the 122 P0 rows, **21 were not plain Built**: DRM-10, DSC-11, BOK-08, MNG-01, MNG-03, GTS-14, EMB-03, MOB-03, MOB-04, MOB-05, MOB-23, IDN-03, IDN-04, IDN-05, TRU-05, TRU-07, COM-03, COM-04, OFF-01, A11Y-02, UX-02.

## Findings that change the plan

Section 3 of `docs/best-in-market-plan.md` asked six things to be settled. Results:

1. **IDN-04 and IDN-05 (relationship types and per-task permissions): a real gap.** Party (`src/domain/party.ts`), helper (`src/domain/account.ts`) and family link (`src/domain/homeLink.ts`) are three separate models. The helper permission set is only `view`, `documents`, `payments`, `profile`. There is no permission for check-in, editing a booking, seeing the folio, messaging or sharing location, and no household or shipmate type. This is BM5, and it is a design job before it is code.
2. **TRU-07 (operational status centre): partial, and not what it looks like.** `/me/status` (`StatusScreen` in `src/ui/aboard/SupportScreens.tsx`) lists service health from the client's demo scenarios (`systemStatus(demo.scenarios, ...)`), not from a server health or incident feed. The front end must not know data is simulated, so the fix is a served status feed; the screen can then drop the scenario read. Server work, so a phase of its own.
3. **MNG-03 (sync states): partial.** `SyncChip` knows three states: just now, updated at, offline. Pending (queued in the outbox), unavailable and not linked are not shown by it.
4. **COM-04 (acknowledged critical delivery with fallback): not built.** `decideDelivery` in `src/domain/delivery.ts` returns `sent` for every critical message and stops. There is no acknowledged state and no fallback channel. This needs the real senders (NOT-01) before it can be tested, so it waits for the provider decision.
5. **MOB-02 (updates never interrupt a critical task): met by design.** `src/runtime/update.ts` never reloads on its own; the guest taps the banner. The BM3 item "hold updates during pass, muster, pay" can be dropped, or reduced to hiding the banner on those screens. Draft retention across a deploy is unchecked.
6. **A11Y-07, EMB-03, GTS-14: confirmed not code.** They need research sessions and safety sign-off.

New gaps found while building the matrix:

- **IDN-03 (duplicate-profile detection): not built.** Nothing in client or server matches `duplicate` or `reconcil`.
- **MOB-10 (QR/barcode scanner): not built.** `BarcodeDetector` is not used anywhere.
- **MOB-24 (battery-aware refresh): not built**; only the save-data signal is read.
- **MOB-23 (background-safe reminders): partial.** Reminders ride on push; no local fallback found.
- **MOB-03 (guest-chosen capsule): partial.** BM1 shows what is kept; the guest cannot yet pick what to download or run a "last test".
- **MOB-15 (calendar): `src/domain/calendar.ts` has no test file.** Zone, update and cancel behaviour is unproved.
- **DSC-15 (guest reviews by ship, sailing, cabin, port): not built.** Needs a content source, not just code.
- **DSC-13 and QOL-17:** the deck graph exists, but the cabin-to-venue overlay and layered ship cutaways do not.
- **Suggested change to the plan:** BM3 becomes "night-before test, battery-aware refresh, guest-chosen capsule, local reminder fallback". The update-hold item is dropped. BM5 grows to include IDN-03.

What I did not do: read the C# endpoints behind each row, so server-side clauses (hold expiry, revalidation, guess-resistant booking link, audit) are not confirmed; those rows say so in Gap.

## BM16 corrections (2026-11-08)

`docs/requirements-clauses.md` (generated by `scripts/requirements-register.mjs`) now lists every acceptance clause (502) with a search written for 121 of them and a person's verdict on 19 requirements. Reading them against the code changed this matrix:

- **Built to Partial (9, all P0):** MOB-14, EMB-02, EMB-01, DEB-02, BOK-05, IDN-01, PRE-18, DEB-05, DEB-04. Reasons are in each Gap cell and in the register. Nine other P0 rows still need a read (listed there as NEEDS-READ).
- **Partial to Built (2):** MOB-24 and GTS-15, closed by BM3 (they were stale). MOB-15 was already Built.
- **Evidence fixed:** AST-04 now cites the confirmation component; IDN-05 and MNG-07 now reflect the seven helper permissions.
- **Count:** the table above is hand-edited from the earlier totals (216 Built, 51 Partial); a script count of the original rows gave 217 Built, so treat the totals as accurate to about one row until BM20 regenerates them from the register.
- **Basis:** the 19 judged rows are marked R. All other rows are still F.

## Stage 1 to 11 requirements

| ID | Pri | Status | Basis | Evidence | Gap |
|---|---|---|---|---|---|
| DRM-01 | P0 | Built | F | `src/ui/discover/Landing.tsx`, `src/ui/discover/SailingsScreen.tsx` | Sign-in prompt timing not checked |
| DRM-02 | P1 | Built | F | `src/ui/discover/ExploreScreen.tsx`, `src/domain/regions.ts`, `src/domain/regions.test.ts` | Filter state kept on combine unchecked |
| DRM-03 | P0 | Built | F | `src/domain/sailings.ts`, `src/domain/sailingsServed.test.ts`, `src/domain/catalogueParity.test.ts` | Three ships and 2027 sailings: catalogue is served by the server |
| DRM-04 | P1 | Built | F | `src/domain/priceCalendar.ts`, `src/domain/priceCalendar.test.ts`, `src/ui/discover/PriceCalendar.tsx` | Quote time label unchecked |
| DRM-05 | P1 | Built | F | `src/ui/discover/DecideScreen.tsx`, `src/ui/ahead/QuizScreen.tsx`, `src/domain/dream.ts` | One-question-at-a-time unchecked |
| DRM-06 | P1 | Built | F | `src/ui/discover/TrialDayScreen.tsx`, `src/domain/discoverDelights.ts` | Ship-specific caveats unchecked |
| DRM-07 | P2 | Partial | F | `src/domain/dream.ts`, `src/domain/dream.test.ts` | Occasion filters not found as a search filter |
| DRM-08 | P1 | Built | F | `src/domain/family.ts`, `src/ui/discover/ShipScreen.tsx` | Child-private rule not read |
| DRM-09 | P1 | Partial | F | `src/domain/fares.ts`, `src/ui/aboard/Parties.tsx` | Solo supplement shown in fares; solo cabin inventory unchecked |
| DRM-10 | P0 | Partial | F | `src/domain/accessReference.ts`, `src/domain/accessReference.test.ts`, `src/ui/AccessAreaNote.tsx` | Filter across ship, cabin, port and excursion in one search not found; "unknown shown as unknown" unchecked |
| DRM-11 | P0 | Built | F | `src/domain/tripCost.ts`, `src/domain/tripCost.test.ts`, `src/ui/discover/TripCostScreen.tsx` | None found |
| DRM-12 | P1 | Partial | F | `src/domain/route.ts`, `src/ui/discover/SailingScreen.tsx` | Interactive map not checked; text itinerary exists |
| DRM-13 | P1 | Built | F | `src/domain/shipCatalogue.ts`, `src/domain/shipCatalogue.test.ts`, `src/ui/discover/CompareShipsScreen.tsx` | Effective dates unchecked |
| DRM-14 | P1 | Built | F | `src/domain/groupBoard.ts`, `src/domain/groupBoard.test.ts`, `src/ui/plan/GroupBoard.tsx` | Export of result unchecked |
| DRM-15 | P1 | Built | F | `src/ui/party/ShareScreens.tsx`, `src/domain/partyShare.ts` | Expiry and read-only rule unchecked |
| DRM-16 | P2 | Built | F | `src/ui/plan/SlotWatch.tsx`, `src/domain/priceCalendar.ts` | Delivery by email/push is simulated |
| DSC-01 | P0 | Built | F | `src/ui/discover/CompareSailingsScreen.tsx`, `src/domain/offerCompare.ts`, `src/domain/offerCompare.test.ts` | "At least four" not asserted |
| DSC-02 | P0 | Built | F | `src/domain/portTier.ts`, `src/domain/portTier.test.ts`, `src/domain/nightsRules.ts` | None found |
| DSC-03 | P1 | Built | F | `src/domain/tender.ts`, `src/ui/discover/TenderOutlook.tsx`, `src/domain/portPilot.ts` | None found |
| DSC-04 | P0 | Built | F | `src/ui/discover/CabinChooserScreen.tsx`, `src/domain/cabinScore.ts`, `src/domain/cabinScore.test.ts` | None found |
| DSC-05 | P1 | Partial | F | `src/domain/deckPlan.ts`, `src/ui/onboard/DeckPlan.tsx`, `src/ui/book/RoomStep.tsx` | Exact available cabin picked on the deck plan in booking unchecked |
| DSC-06 | P1 | Partial | F | `src/domain/cabinScore.ts`, `src/domain/shipRooms.ts` | Noise, motion, lift proximity, connecting door: which are covered not read |
| DSC-07 | P1 | Partial | F | `src/ui/discover/CabinPhotos.tsx` | Photos missing (S1-06 in `docs/gap-analysis-plan.md`) |
| DSC-08 | P0 | Built | F | `src/domain/pricing.ts`, `src/domain/pricingServed.test.ts`, `src/ui/book/FareStep.tsx` | None found |
| DSC-09 | P1 | Built | F | `src/domain/packages.ts`, `src/domain/spendForecast.ts`, `src/domain/spendForecast.test.ts` | None found |
| DSC-10 | P2 | Built | F | `src/domain/cabinScore.ts`, `src/domain/shortlist.ts` | Explainability of ship/sailing fit score unchecked |
| DSC-11 | P0 | Partial | F | `src/domain/accessReference.ts`, `src/ui/plan/AssistanceScreen.tsx` | One whole-journey comparison not found |
| DSC-12 | P1 | Partial | F | `src/domain/cabins.ts` | Connecting-cabin planning for a party unchecked |
| DSC-13 | P2 | Not built | F | `src/domain/deckGraph.ts` | Deck graph and route finder exist; cabin-to-venue overlay on the chooser not found |
| DSC-14 | P1 | Built | F | `src/ui/discover/CompareShipsScreen.tsx` | Room-control capability is a flag only |
| DSC-15 | P1 | Not built | F | none | No guest reviews by ship, sailing, cabin or port; needs a source |
| DSC-16 | P1 | Built | F | `src/ui/discover/SavedScreen.tsx`, `src/domain/shortlist.ts`, `src/domain/shortlist.test.ts` | Server-held, so phone and desktop agree |
| BOK-01 | P0 | Built | F | `src/ui/book/ResumeScreen.tsx`, `src/domain/booking.ts`, `src/domain/booking.test.ts` | Close mid-payment and resume not run end to end (a-tier-matrix row 2) |
| BOK-02 | P0 | Built | F | `src/ui/book/GuestsStep.tsx`, `src/domain/signup.ts` | None found |
| BOK-03 | P1 | Out of reach | F | none | Camera passport scan needs a device (`docs/gap-analysis-plan.md`) |
| BOK-04 | P0 | Built | F | `src/ui/plan/` hold screen `/plan/hold`, `src/domain/booking.ts` | Server-issued hold id and expiry: server side not read |
| BOK-05 | P0 | Partial | R | `src/ui/book/FareStep.tsx`, `src/domain/fares.ts` | No fare or terms version stored at checkout (BM16) |
| BOK-06 | P0 | Built | F | `src/ui/book/ReviewStep.tsx`, `src/domain/pricing.ts` | None found |
| BOK-07 | P0 | Built | F | `src/ui/book/PayStep.tsx`, `src/domain/pricingServed.test.ts` | Revalidation is server side; not read |
| BOK-08 | P0 | Simulated | F | `src/ui/book/PayPanel.tsx`, `src/ui/ConfirmCharge.tsx` | Card charging is a backend mock; raw numbers must not be stored locally (see SEC-02) |
| BOK-09 | P0 | Built | F | `src/data/outbox.ts`, `src/ui/ConfirmCharge.tsx`, `src/domain/moneyShield.test.ts` | Server idempotency covered by C# tests, not run |
| BOK-10 | P1 | Built | F | `src/ui/plan/SplitScreen.tsx`, `src/ui/book/InstalmentPlanner.tsx` | Invited payer contribution unchecked |
| BOK-11 | P1 | Built | F | `src/ui/book/BalanceScreen.tsx`, `src/ui/book/InstalmentPlanner.tsx` | None found |
| BOK-12 | P1 | Partial | F | `src/ui/book/PerksPanel.tsx`, `src/ui/finish/LoyaltyScreen.tsx` | Future cruise credit explained at booking unchecked |
| BOK-13 | P1 | Built | F | `src/ui/book/DiningStep.tsx`, `src/ui/plan/PackagesScreen.tsx`, `src/ui/ahead/UpgradesScreen.tsx` | Insurance and transfers wording unchecked |
| BOK-14 | P0 | Built | F | `src/ui/book/ReviewStep.tsx` | None found |
| BOK-15 | P0 | Built | F | `src/ui/plan/` contract screen `/plan/contract`, `src/ui/book/Policy.tsx` | Versioned acceptance record on server not read |
| BOK-16 | P0 | Built | F | `src/ui/book/ConfirmedScreen.tsx` | Confirmation only after server confirms: not read |
| MNG-01 | P0 | Partial | F | `src/ui/account/TripsScreen.tsx`, `src/domain/account.ts` | Advisor and external channels: `/home/advisors` informs; linking external bookings unchecked |
| MNG-02 | P0 | Built | F | `src/domain/readiness.ts`, `src/domain/readinessBoard.ts`, `src/domain/readinessBoard.test.ts` | None found |
| MNG-03 | P0 | Partial | R | `src/ui/SyncChip.tsx`, `src/domain/syncAge.ts`, `src/domain/syncAge.test.ts` | Only three states exist (just now, updated at, offline). Pending, unavailable and not linked are not distinct. See section "Findings" |
| MNG-04 | P0 | Built | F | `src/domain/papersCheck.ts`, `src/domain/papersCheck.test.ts`, `src/ui/account/PapersCheck.tsx` | None found |
| MNG-05 | P0 | Built | F | `src/ui/account/DocumentsScreen.tsx`, `src/domain/documents.ts` | Server-held; scanning is out of reach |
| MNG-06 | P1 | Built | F | `src/ui/plan/PlanScreen.tsx`, `src/domain/readinessBoard.ts` | Private documents hidden: not read |
| MNG-07 | P1 | Built | R | `src/ui/account/HelperScreen.tsx`, `src/domain/account.ts` | Seven permissions now (BM6 to BM12). See IDN-05 |
| MNG-08 | P1 | Built | F | `src/domain/packing.ts`, `src/ui/plan/PackingScreen.tsx` | None found |
| MNG-09 | P1 | Built | F | `src/ui/plan/TravelScreen.tsx`, `src/domain/travel.ts`, `src/ui/plan/` getting-there route | None found |
| MNG-10 | P0 | Built | F | `src/ui/book/BalanceScreen.tsx`, `src/ui/account/PaymentsScreen.tsx` | None found |
| MNG-11 | P0 | Built | F | `src/ui/plan/AssistanceScreen.tsx`, `src/domain/assistance.ts` | None found |
| MNG-12 | P1 | Built | F | `src/domain/medicalCard.ts`, `src/domain/care.test.ts`, `src/domain/medicalCard.ts` | Audience-specific sharing unchecked |
| MNG-13 | P1 | Built | F | `src/ui/book/changes.ts`, `src/domain/planChange.ts`, `src/domain/planChange.test.ts` | None found |
| MNG-14 | P1 | Built | F | `src/ui/account/NotificationsScreen.tsx`, `src/domain/notifications.ts` | Category filters unchecked |
| MNG-15 | P1 | Built | F | `src/domain/countdowns.ts`, `src/domain/countdowns.test.ts` | None found |
| MNG-16 | P2 | Partial | F | `src/ui/account/ProfileScreen.tsx`, `src/ui/DisplaySettings.tsx` | Reusable cabin and dining preferences unchecked |
| MNG-17 | P1 | Built | F | `src/ui/finish/LoyaltyScreen.tsx` | Status data is simulated by the server |
| MNG-18 | P1 | Built | F | `src/ui/account/PrintScreen.tsx`, `src/domain/export.ts`, `src/domain/export.test.ts` | Large-print and low-ink variants unchecked |
| PRE-01 | P0 | Built | F | `src/ui/plan/WeekPlanner.tsx`, `src/ui/plan/PlanScreen.tsx`, `src/domain/plan.ts` | None found |
| PRE-02 | P0 | Built | F | `src/domain/autopilot.ts`, `src/domain/autopilot.test.ts`, `src/domain/planChange.ts` | None found |
| PRE-03 | P0 | Built | F | `src/ui/plan/DiningScreen.tsx`, `src/domain/prebook.test.ts` | None found |
| PRE-04 | P0 | Built | F | `src/domain/prebook.test.ts`, `src/ui/book/changes.ts` | Original kept until new confirmed: server side not read (see TRU-05) |
| PRE-05 | P1 | Simulated | F | `src/ui/plan/SlotWatch.tsx`, `src/ui/onboard/Waits.tsx` | Position from source feed is simulated |
| PRE-06 | P1 | Simulated | F | `src/ui/onboard/Waits.tsx`, `src/domain/queue.ts` | Queues are simulated; only integrated types may be shown |
| PRE-07 | P1 | Built | F | `src/ui/plan/ExcursionsScreen.tsx`, `src/domain/excursions.ts`, `src/domain/excursionFit.ts` | None found |
| PRE-08 | P0 | Built | F | `src/domain/excursionFit.ts`, `src/domain/excursionFit.test.ts` | None found |
| PRE-09 | P1 | Built | F | `src/ui/onboard/RouteFinder.tsx`, `src/domain/portDelights.ts`, `src/domain/landPath.ts` | None found |
| PRE-10 | P1 | Built | F | `src/ui/onboard/Tickets.tsx`, `src/domain/tickets.ts` | Accessibility accommodation at booking unchecked |
| PRE-11 | P1 | Built | F | `src/ui/aboard/OrderExtras.tsx`, `src/domain/shopExtras.ts` | Spa booking: `/ship/spa` |
| PRE-12 | P1 | Built | F | `src/ui/ahead/ClubsScreen.tsx`, `src/domain/ahead.ts` | None found |
| PRE-13 | P1 | Built | F | `src/ui/plan/GroupBoard.tsx`, `src/domain/groupBoard.test.ts` | None found |
| PRE-14 | P1 | Built | F | `src/domain/spendForecast.ts`, `src/domain/spendForecast.test.ts`, `src/ui/plan/SpendForecastCard.tsx` | None found |
| PRE-15 | P1 | Built | F | `src/domain/entitlements.ts`, `src/ui/plan/PackagesScreen.tsx`, `src/ui/account/` packages route | None found |
| PRE-16 | P0 | Built | F | `src/domain/medicalCard.ts`, `src/ui/plan/MedicalScreen.tsx`, `src/ui/aboard/SafetyScreens.tsx` | Venue acknowledgement is simulated |
| PRE-17 | P1 | Partial | F | `src/ui/aboard/GroupTable.tsx` | Group dining across linked cabins unchecked |
| PRE-18 | P0 | Partial | R | `src/ui/book/Policy.tsx`, `src/domain/policy.ts` | Refund timing stated as fact, not labelled estimate (BM16) |
| GTS-01 | P0 | Built | F | `src/domain/checkin.ts`, `src/domain/checkin.test.ts`, `src/ui/checkin/steps.tsx` | None found |
| GTS-02 | P0 | Built | F | `src/ui/checkin/` receipt route `/home/check-in/receipt`, `src/domain/checkin.ts` | None found |
| GTS-03 | P0 | Built | F | `src/ui/boarding/PassScreen.tsx`, `src/hooks/useSavedCopy.ts`, `src/offlineDay.test.ts` | Printable pass and dead-phone card unchecked |
| GTS-04 | P0 | Built | F | `src/ui/boarding/EmbarkPlanScreen.tsx`, `src/domain/embark.ts`, `src/domain/embark.test.ts` | None found |
| GTS-05 | P0 | Built | F | `src/ui/boarding/EmbarkScreen.tsx`, `src/domain/boarding.ts` | None found |
| GTS-06 | P1 | Built | F | `src/domain/journey.ts`, `src/domain/journey.test.ts`, `src/ui/plan/JourneyScreen.tsx` | Location only on request: unchecked |
| GTS-07 | P1 | Simulated | F | `src/feeds/flight.ts`, `src/domain/delay.ts`, `src/domain/delay.test.ts` | Flight feed is a mock |
| GTS-08 | P0 | Built | F | `src/ui/home/DelayedScreen.tsx`, `src/domain/delay.ts` | "One tap" not asserted |
| GTS-09 | P1 | Partial | F | `src/domain/deckGraph.ts`, `src/ui/boarding/CompanionScreen.tsx` | Terminal map with step-free route unchecked |
| GTS-10 | P1 | Built | F | `src/domain/arrivalPing.ts`, `src/domain/arrivalPing.test.ts`, `src/domain/meetingPoint.ts` | None found |
| GTS-11 | P1 | Built | F | `src/ui/finish/` luggage route `/home/luggage`, `src/domain/embark.ts` | None found |
| GTS-12 | P0 | Built | F | `src/ui/home/` clearance route `/home/clearance`, `src/domain/papersCheck.ts` | None found |
| GTS-13 | P2 | Simulated | F | `src/domain/embark.ts`, `server/Princess.Api/Domain/EmbarkQueueRules.cs` | Only from a verified feed: the feed is a mock |
| GTS-14 | P0 | Partial | F | `src/ui/plan/AssistanceScreen.tsx`, `src/domain/assistance.ts` | Assistance confirmation needs operator sign-off (doc says safety review) |
| GTS-15 | P1 | Built | R | `src/domain/phoneSetup.ts`, `src/domain/offlineCapsule.ts`, `src/ui/plan/CapsuleCard.tsx` | Night-before test built in BM3 (`src/domain/nightBefore.ts`) |
| GTS-16 | P1 | Built | F | `src/ui/home/` medallion route `/home/medallion` | None found |
| EMB-01 | P0 | Partial | R | `src/domain/boarding.ts`, `src/ui/boarding/EmbarkScreen.tsx` | Boarded is a guest-typed time; no manifest or scan source (BM16) |
| EMB-02 | P0 | Built | R | `src/ui/onboard/SafetyScreens.tsx`, `src/domain/safety.ts` | Closed in BM18 |
| EMB-03 | P0 | Out of reach | F | `src/ui/onboard/SafetyScreens.tsx` | Needs verified accessible alternative from the safety owner |
| EMB-04 | P1 | Built | F | `src/domain/embarkDelights.ts`, `src/domain/embarkDelights.test.ts` | None found |
| EMB-05 | P1 | Built | F | `src/ui/extras/RoomScreen.tsx`, `src/domain/room.ts` | None found |
| EMB-06 | P1 | Built | F | `src/ui/finish/` luggage route, `src/domain/embark.ts` | Source and certainty label unchecked |
| EMB-07 | P1 | Built | F | `src/ui/aboard/RequestsScreen.tsx`, `src/ui/extras/RoomScreen.tsx` | Optional photo unchecked |
| EMB-08 | P1 | Built | F | `src/ui/home/` medallion route | Troubleshooting content unchecked |
| EMB-09 | P1 | Built | F | `src/ui/onboard/NavigationScreens.tsx`, `src/domain/navigation.ts` | Short/long/step-free modes unchecked |
| EMB-10 | P1 | Built | F | `src/domain/meetingPoint.ts`, `src/domain/meetingPoint.test.ts`, `src/ui/home/MeetingPointScreen.tsx` | None found |
| EMB-11 | P0 | Built | F | `src/ui/extras/WifiScreen.tsx`, `src/domain/wifi.ts`, `src/settings/settings.ts` | Save-data signal read; battery not (MOB-24) |
| EMB-12 | P1 | Built | F | `src/ui/onboard/VenuesScreen.tsx`, `src/domain/shipVenues.ts`, `src/domain/shipVenues.test.ts` | None found |
| EMB-13 | P2 | Partial | F | `src/ui/onboard/SkyScreen.tsx` | Accessible sail-away guide and viewpoint finder unchecked |
| EMB-14 | P1 | Built | F | `src/domain/family.ts`, `src/ui/extras/FamilyScreen.tsx` | None found |
| EMB-15 | P0 | Built | F | `src/ui/onboard/SafetyScreens.tsx`, `src/offlineDay.test.ts`, `src/hooks/useSavedCopy.ts` | None found |
| SEA-01 | P0 | Built | F | `src/ui/onboard/OnboardHome.tsx`, `src/domain/tileLive.ts`, `src/domain/tileLive.test.ts` | "Labelled, not inferred" unchecked |
| SEA-02 | P0 | Built | F | `src/ui/plan/WeekPlanner.tsx`, `src/ui/onboard/Planner.tsx`, `src/domain/plan.ts` | None found |
| SEA-03 | P0 | Built | R | `src/domain/offlineCapsule.ts`, `src/ui/plan/CapsuleCard.tsx`, `src/offlineDay.test.ts` | BM1 |
| SEA-04 | P1 | Built | F | `src/domain/searchIndex.ts`, `src/ui/home/AskScreen.tsx`, `src/ui/onboard/` search route `/ship/search` | None found |
| SEA-05 | P1 | Built | F | `src/ui/onboard/VenuesScreen.tsx`, `src/domain/shipVenues.ts` | None found |
| SEA-06 | P0 | Built | F | `src/ui/onboard/DeckMapScreen.tsx`, `src/domain/deckGraph.ts`, `src/domain/deckGraph.test.ts`, `src/ui/deckPlan.test.tsx` | None found |
| SEA-07 | P1 | Partial | F | `src/domain/arrivalPing.ts`, `src/ui/onboard/NavigationScreens.tsx` | Manual and landmark check-in; no Medallion location (out of reach) |
| SEA-08 | P2 | Simulated | F | `src/domain/portCrowd.ts`, `src/ui/onboard/Waits.tsx` | Telemetry is a mock |
| SEA-09 | P0 | Built | F | `src/ui/onboard/ReservationsScreen.tsx`, `src/ui/plan/DiningScreen.tsx` | None found |
| SEA-10 | P1 | Simulated | F | `src/domain/queue.ts`, `src/ui/onboard/Waits.tsx` | Queue adapters mocked |
| SEA-11 | P1 | Simulated | F | `src/ui/extras/OrderScreen.tsx`, `src/domain/orders.ts`, `src/domain/extras.test.ts` | Order feed is a mock |
| SEA-12 | P1 | Built | F | `src/domain/orders.ts`, `src/ui/extras/OrderScreen.tsx` | None found |
| SEA-13 | P0 | Built | F | `src/domain/entitlements.ts`, `src/ui/plan/PackagesScreen.tsx` | "Used vs remaining" not asserted (a-tier-matrix row 12) |
| SEA-14 | P0 | Built | F | `src/ui/onboard/BillScreen.tsx`, `src/domain/folio.ts`, `src/domain/ledgerSplit.ts` | Pending vs posted split in ledgerSplit |
| SEA-15 | P1 | Built | F | `src/domain/budget.ts`, `src/domain/budget.test.ts`, `src/ui/onboard/BudgetCard.tsx` | None found |
| SEA-16 | P1 | Partial | F | `src/ui/aboard/ChatSafe.tsx`, `src/ui/onboard/ChatScreen.tsx`, `src/domain/chat.ts` | Age-aware rules unchecked |
| SEA-17 | P1 | Built | F | `src/ui/ahead/ClubsScreen.tsx`, `src/ui/aboard/` teen route `/ship/teen` | Authorised pickup unchecked |
| SEA-18 | P1 | Partial | F | `src/ui/aboard/` access route `/ship/access`, `src/ui/onboard/Tickets.tsx` | Accommodation requests per event unchecked |
| SEA-19 | P0 | Built | F | `src/ui/aboard/SafetyScreens.tsx`, `src/domain/medicalCard.ts` (route `/ship/allergy-chain`) | Venue acknowledgement is simulated |
| SEA-20 | P0 | Built | F | `src/ui/aboard/RequestsScreen.tsx`, `src/ui/account/` cases route | None found |
| SEA-21 | P2 | Out of reach | F | `src/ui/extras/RoomScreen.tsx` | Needs ship room-control integration |
| SEA-22 | P1 | Built | F | `src/domain/briefing.ts`, `src/domain/briefing.test.ts`, `src/ui/home/BriefingScreen.tsx` | None found |
| SEA-23 | P1 | Built | F | `src/domain/sky.ts`, `src/domain/sky.test.ts`, `src/ui/onboard/SkyScreen.tsx` | Telemetry simulated |
| SEA-24 | P1 | Built | F | `src/ui/extras/HealthScreens.tsx`, `src/domain/health.ts` | None found |
| SEA-25 | P0 | Built | F | `src/settings/settings.ts`, `src/ui/extras/WifiScreen.tsx` | Save-data signal only; battery not (MOB-24) |
| POR-01 | P0 | Built | F | `src/ui/onboard/PortPilot.tsx`, `src/domain/portPilot.ts`, `src/domain/portPilot.test.ts` | None found |
| POR-02 | P0 | Built | F | `src/ui/ThreeClocks.tsx`, `src/domain/clockView.ts`, `src/domain/timezones.ts` | DST and date-line tests in `timeIntelligence.test.ts` (BM4) |
| POR-03 | P0 | Built | F | `src/ui/onboard/PortGuideScreen.tsx`, `src/domain/portsServed.ts` | Download progress per port unchecked |
| POR-04 | P0 | Built | F | `src/ui/onboard/PortCard.tsx`, `src/domain/excursions.ts` | None found |
| POR-05 | P0 | Built | F | `src/domain/tender.ts`, `src/ui/discover/TenderOutlook.tsx`, `src/ui/onboard/PortDayScreen.tsx` | Feed simulated |
| POR-06 | P0 | Built | F | `src/domain/allaboard.ts`, `src/domain/portPilot.test.ts` | None found |
| POR-07 | P1 | Partial | F | `src/domain/accessReference.ts`, `src/ui/onboard/PortGuideScreen.tsx` | Per-port return routes unchecked |
| POR-08 | P1 | Built | F | `src/ui/onboard/RouteFinder.tsx`, `src/domain/landPath.ts` | None found |
| POR-09 | P1 | Built | F | `src/ui/aboard/` safe-ashore route `/ship/safe-ashore`, `src/domain/portContent.ts` | Contacts verified by operator: out of reach |
| POR-10 | P1 | Built | F | `src/domain/rates.ts`, `src/rates` | Cached reference rate shown with age: unchecked |
| POR-11 | P1 | Built | F | `src/domain/portDelights.ts`, `src/domain/portDelights.test.ts` | Offline: phrases live in the port copy |
| POR-12 | P1 | Built | F | `src/ui/onboard/PortDayScreen.tsx`, `src/domain/storm.ts` | None found |
| POR-13 | P1 | Built | F | `src/domain/meetingPoint.ts`, `src/domain/arrivalPing.ts` | None found |
| POR-14 | P1 | Built | F | `src/domain/portParty.ts`, `src/domain/portParty.test.ts`, `src/ui/onboard/PortParty.tsx` | None found |
| POR-15 | P0 | Built | F | `src/domain/disruption.ts`, `src/domain/disruptionHub.ts`, `src/ui/home/DisruptionHubScreen.tsx` | Hub text is authored in the client |
| POR-16 | P0 | Built | F | `src/ui/home/DisruptionHubScreen.tsx`, `src/ui/onboard/SafetyScreens.tsx` | Contacts verified by operator: out of reach |
| DEB-01 | P0 | Built | F | `src/ui/finish/DisembarkScreen.tsx`, `src/domain/disembark.ts` | None found |
| DEB-02 | P0 | Built | R | `src/ui/finish/DisembarkScreen.tsx` | Closed in BM18 |
| DEB-03 | P0 | Built | F | `src/ui/finish/` bags route `/home/disembark/bags` | None found |
| DEB-04 | P0 | Partial | R | `src/ui/finish/FinalBillScreen.tsx`, `src/domain/folio.ts` | Folio has no pending, disputed, refunded or adjusted line state (BM16) |
| DEB-05 | P0 | Partial | R | `src/ui/finish/CasesScreen.tsx` | No "opening a case does not reverse the charge" wording at submission (BM16) |
| DEB-06 | P1 | Built | F | `src/ui/finish/` sweep route `/home/disembark/sweep` | None found |
| DEB-07 | P1 | Built | F | `src/ui/finish/FinalNightScreen.tsx`, `src/domain/shipVenues.ts` | Departure-day hours unchecked |
| DEB-08 | P0 | Built | F | `src/ui/finish/CustomsScreen.tsx` | Official sources linked: unchecked |
| DEB-09 | P1 | Built | F | `src/ui/finish/OnwardScreen.tsx` | None found |
| DEB-10 | P1 | Built | F | `src/ui/finish/` flight route `/home/disembark/flight` | None found |
| DEB-11 | P1 | Built | F | `src/ui/finish/CasesScreen.tsx`, lost-found route `/ship/lost-found` | None found |
| DEB-12 | P1 | Built | F | `src/ui/account/PrintScreen.tsx`, `src/domain/export.ts` | None found |
| DEB-13 | P1 | Built | F | `src/ui/finish/` ride route `/home/disembark/ride` | None found |
| DEB-14 | P0 | Built | F | `src/ui/finish/CasesScreen.tsx` | None found |
| DEB-15 | P1 | Built | F | `src/domain/finishMore.ts`, `src/domain/finishMore.test.ts`, `src/ui/onboard/FinishMoreScreens.tsx` | None found |
| REM-01 | P0 | Built | F | `src/ui/finish/HistoryScreen.tsx`, `src/ui/account/TripScreen.tsx` | None found |
| REM-02 | P1 | Built | F | `src/domain/tripDiary.ts`, `src/domain/tripDiary.test.ts`, `src/ui/account/DiaryScreen.tsx` | None found |
| REM-03 | P1 | Built | F | `src/domain/memoryBook.ts`, `src/domain/memoryBook.test.ts`, `src/ui/account/MemoryScreen.tsx` | Photos missing (a-tier-matrix row 20) |
| REM-04 | P1 | Partial | F | `src/domain/photos.ts`, `src/ui/extras/PhotosScreen.tsx` | Per-photo ownership and consent unchecked |
| REM-05 | P1 | Simulated | F | `src/ui/extras/PhotosScreen.tsx` | Photo archive purchase is a mock; resumable download unchecked |
| REM-06 | P0 | Built | F | `src/ui/finish/FeedbackScreen.tsx` | Route to service recovery is server side: unchecked |
| REM-07 | P1 | Built | F | `src/ui/finish/LoyaltyScreen.tsx` | None found |
| REM-08 | P1 | Built | F | `src/ui/finish/RebookScreen.tsx` | None found |
| REM-09 | P1 | Built | F | `src/ui/finish/RebookScreen.tsx` | Consent for stored details unchecked |
| REM-10 | P1 | Built | F | `src/ui/finish/LoyaltyScreen.tsx`, `src/ui/book/PerksPanel.tsx` | None found |
| REM-11 | P1 | Built | F | `src/ui/finish/FeedbackScreen.tsx` | Progressive survey unchecked |
| REM-12 | P1 | Built | F | `src/domain/finishMore.ts`, `src/ui/onboard/FinishMoreScreens.tsx` | Receipt unchecked |
| REM-13 | P2 | Built | F | `src/domain/wrapped.ts`, `src/domain/wrapped.test.ts`, `src/domain/recap.ts`, `src/ui/ai/RecapScreen.tsx` | None found |
| REM-14 | P2 | Partial | F | `src/domain/family.ts` | Referral and reunion tools: no referral screen found |
| REM-15 | P2 | Simulated | F | `server/Princess.Api/Domain/PrintRules.cs`, `server/Princess.Api/Services/Providers.cs` | Print provider is a mock; no front-end screen found |
| REM-16 | P0 | Built | F | `src/ui/account/PrivacyScreen.tsx`, `src/domain/privacy.ts`, `src/domain/dataRules.ts` | None found |

## Phone and PWA requirements (MOB)

| ID | Pri | Status | Basis | Evidence | Gap |
|---|---|---|---|---|---|
| MOB-01 | P0 | Built | F | `vite.config.ts`, `index.html`; install guidance in `src/ui/plan/PhoneScreen.tsx`, `src/domain/phoneSetup.ts` | Contextual install prompt text unchecked |
| MOB-02 | P0 | Built | R | `src/runtime/update.ts`, `src/ui/UpdateBanner.tsx` | The guest chooses when to switch, so no forced reload anywhere; draft retention across deploys unchecked (`src/hooks/useDraft.ts`) |
| MOB-03 | P0 | Partial | R | `src/domain/offlineCapsule.ts`, `src/ui/plan/CapsuleCard.tsx`, `src/domain/offlineCapsule.test.ts` | BM1 shows, ages and sizes copies; guest cannot yet choose which kinds to download, or run a "last test" |
| MOB-04 | P0 | Partial | R | `src/data/outbox.ts`, `src/hooks/useDraft.ts`, `src/data/capsule.ts` | Deliberately `localStorage`, not IndexedDB (best-in-market-plan section 2); eviction surfaced by BM1. Export/recovery of local drafts not found |
| MOB-05 | P0 | Partial | F | `src/data/outbox.ts`, `src/hooks/useAction.ts`, `src/api/bounded.ts` | Per-action label of "offline / queued / view-only / needs connection" before commit not seen on every control |
| MOB-06 | P1 | Built | F | `src/push/push.ts`, `src/push/push.test.ts`, `src/hooks/usePushState.ts`, `src/ui/account/PushPanels.tsx` | Delivery is simulated on the server |
| MOB-07 | P1 | Partial | F | `src/push/push.ts`, `src/ui/pushScreens.test.tsx` | Deep link to exact object unchecked (COM-06) |
| MOB-08 | P1 | Built | F | `src/ui/account/MemoryScreen.tsx`, `src/ui/delights/HighlightReel.tsx`, `src/ui/plan/AwayScreen.tsx` | Fallback when share unsupported unchecked |
| MOB-09 | P1 | Partial | F | `src/ui/checkin/PhotoCoach.tsx`, `src/ui/media/Pictures.tsx` | Capture for pictures exists; passport scan and tag scan are out of reach |
| MOB-10 | P1 | Not built | F | none | No QR/barcode scanner found; `BarcodeDetector` is not used |
| MOB-11 | P1 | Built | F | `src/hooks/useWakeLock.ts`, `src/hooks/useWakeLock.test.tsx`, `src/ui/boarding/PassScreen.tsx` | Muster card and map route use unchecked |
| MOB-12 | P0 | Built | F | `src/styles`, `src/ui/a11y.test.tsx` | Touch target size asserted only by the audit |
| MOB-13 | P1 | Partial | F | `src/ui/delights/PortDelights.tsx`, `src/domain/landPath.ts` | `geolocation` appears only in a headers file; port navigation is manual |
| MOB-14 | P0 | Built | R | `src/ui/ThreeClocks.tsx`, `src/domain/clockView.ts`, `src/ui/onboard/shipTime.ts` | Closed in BM18 |
| MOB-15 | P1 | Built | F | `src/domain/calendar.ts`, `calendar.test.ts` | Zoned times in UTC, SEQUENCE and cancel tested (BM4); no caller sends an update or cancel yet |
| MOB-16 | P2 | Out of reach | F | `server/Princess.Api/Services/Providers.cs` | Wallet passes are simulated on the server only; the document marks P2 |
| MOB-17 | P1 | Built | F | `src/ui/boarding/PassScreen.tsx`, `src/ui/onboard/SafetyScreens.tsx`, `src/domain/calm.ts` | High-contrast full-screen check unchecked |
| MOB-18 | P1 | Built | F | `src/ui/CopyText.tsx`, `src/domain/contacts.ts`, `src/ui/aboard/SupportScreens.tsx` | `contacts.ts` has no test |
| MOB-19 | P1 | Built | F | `src/ui/home/SummaryScreen.tsx`, `src/ui/home/BriefingScreen.tsx`, `src/ui/delights/DiscoverDelights.tsx` | `speechSynthesis`; user-initiated |
| MOB-20 | P2 | Built | F | `src/ui/home/AskScreen.tsx` | `SpeechRecognition`; optional |
| MOB-21 | P2 | Built | F | `src/settings/haptics.ts`, `src/settings/haptics.test.ts` | None found |
| MOB-22 | P2 | Partial | F | `src/domain/navigation.ts`, `src/ui/onboard/NavigationScreens.tsx` | Compass arrow from the deck graph; device orientation sensor not used (P2) |
| MOB-23 | P0 | Partial | F | `src/push/push.ts`, `src/domain/delivery.ts`, `src/domain/countdowns.ts` | Background-safe reminders rely on push; no local scheduled fallback found |
| MOB-24 | P1 | Built | R | `src/settings/settings.ts`, `src/hooks/visibleInterval.ts` | Battery-aware refresh built in BM3 (`src/data/battery.ts`, `refreshFactor`) |
| MOB-25 | P1 | Partial | F | `src/ui/media/Pictures.tsx`, `src/domain/media.ts`, `src/domain/media.test.ts` | Local preview and delete unchecked |

## Quality-of-life concepts (QOL)

Priority is not given per concept in the document.

| ID | Pri | Status | Basis | Evidence | Gap |
|---|---|---|---|---|---|
| QOL-01 | - | Built | F | `src/domain/autopilot.ts`, `src/domain/autopilot.test.ts`, `src/ui/plan/AutopilotScreen.tsx` | None found |
| QOL-02 | - | Simulated | F | `src/domain/queue.ts`, `src/ui/onboard/Waits.tsx` | Queue adapters mocked; the document warns against faking |
| QOL-03 | - | Built | F | `src/domain/trustLedger.ts`, `src/domain/trustLedger.test.ts`, `src/ui/account/LedgerScreen.tsx` | None found |
| QOL-04 | - | Partial | R | `src/ui/plan/CapsuleCard.tsx`, `src/domain/offlineCapsule.ts` | BM1: see MOB-03 |
| QOL-05 | - | Built | F | `src/ui/home/DisruptionHubScreen.tsx`, `src/routes/nav.ts`, `src/ui/HelpSheet.tsx` | Get-help button on every route asserted in `src/ui/render.test.tsx` |
| QOL-06 | - | Simulated | F | `src/domain/portCrowd.ts`, `server/Princess.Api/Domain/EmbarkQueueRules.cs` | Crowd telemetry is a mock |
| QOL-07 | - | Built | F | `src/ui/plan/GroupBoard.tsx`, `src/domain/groupBoard.ts`, `src/domain/portParty.ts` | None found |
| QOL-08 | - | Built | F | `src/domain/arrivalPing.ts`, `src/domain/meetingPoint.ts`, `src/domain/arrivalPing.test.ts` | None found |
| QOL-09 | - | Built | F | `src/domain/medicalCard.ts`, `src/ui/aboard/SafetyScreens.tsx` | Never says "safe"; venue acknowledgement is simulated |
| QOL-10 | - | Partial | F | `src/domain/deckGraph.ts`, `src/domain/navigation.ts` | Step-free routing exists; live replan on closure unchecked |
| QOL-11 | - | Built | F | `src/domain/portPilot.ts`, `src/domain/allaboard.ts`, `src/domain/portPilot.test.ts` | None found |
| QOL-12 | - | Built | F | `src/domain/entitlements.ts`, `src/domain/spendForecast.ts` | None found |
| QOL-13 | - | Built | F | `src/domain/cabinScore.ts`, `src/ui/discover/CabinChooserScreen.tsx` | None found |
| QOL-14 | - | Built | F | `src/domain/answerCards.ts`, `src/domain/answerCards.test.ts`, `src/ai/stanley.ts` | None found |
| QOL-15 | - | Built | F | `src/domain/storm.ts`, `src/ui/plan/StormScreen.tsx`, `src/domain/whatIf.ts` | None found |
| QOL-16 | - | Built | F | `src/domain/moneyShield.ts`, `src/domain/moneyShield.test.ts`, `src/domain/ledgerSplit.ts` | None found |
| QOL-17 | - | Partial | F | `src/domain/deckPlan.ts`, `src/ui/onboard/DeckPlan.tsx` | Visual ship literacy (deck cutaways) is a single deck plan |
| QOL-18 | - | Partial | F | `src/domain/highlightReel.ts`, `src/domain/photos.ts`, `src/ui/delights/HighlightReel.tsx` | Photo curation from guest photos unchecked |
| QOL-19 | - | Built | F | `src/domain/disruptionHub.ts`, `src/domain/disruptionHub.test.ts` | None found |
| QOL-20 | - | Built | F | `src/domain/accessReference.ts`, `src/domain/medicalCard.ts`, `src/ui/plan/AssistanceScreen.tsx` | Single passport screen not confirmed |
| QOL-21 | - | Built | F | `src/ui/ThreeClocks.tsx`, `src/domain/clockView.ts`, `src/domain/timezones.ts` | DST and date-line tests in `timeIntelligence.test.ts` (BM4) |
| QOL-22 | - | Built | F | `src/ui/aboard/RequestsScreen.tsx`, `src/ui/finish/CasesScreen.tsx` | None found |

## Cross-stage foundations

| ID | Pri | Status | Basis | Evidence | Gap |
|---|---|---|---|---|---|
| IDN-01 | P0 | Partial | R | `src/auth/httpProvider.ts`, `src/auth/httpProvider.test.ts`, `src/ui/SignInFlows.tsx`, `src/domain/pinReset.ts` | No sign-out-everywhere, device list or step-up (BM16) |
| IDN-02 | P0 | Built | F | `src/ui/boarding/FindPassScreen.tsx`, `src/domain/signup.ts` | Guess-resistance is server side: not read |
| IDN-03 | P0 | Not built | F | none | No duplicate-profile detection or reconciliation found in client or server (searched `duplicate`, `reconcil`) |
| IDN-04 | P0 | Partial | R | `src/domain/party.ts`, `src/domain/account.ts`, `src/domain/homeLink.ts`, `src/domain/people.ts` | Party, helper and family link exist as three separate models. No shared relationship type. BM5 |
| IDN-05 | P0 | Partial | R | `src/domain/account.ts` (`PERMISSIONS`) | Helper now has view, documents, payments, profile, folio, checkin and trip (BM6 to BM12). Still no edit-booking, message or location permission |
| IDN-06 | P0 | Built | F | `src/ui/plan/FamilyLinkScreen.tsx`, `src/domain/homeLink.ts`, `src/ui/ahead/ClubsScreen.tsx` | Authorised pickup unchecked |
| IDN-07 | P1 | Partial | F | `src/ui/account/HelperScreen.tsx`, `src/ui/party/ShareScreens.tsx` | Revoke exists per feature; BM5 built the "who can see what" card on `/me/helper` (`src/domain/access.ts`); revoke is still per feature |
| IDN-08 | P1 | Partial | F | `src/ui/home/` advisors route `/home/advisors` | Access for advisor-booked guests unchecked |
| TRU-01 | P0 | Built | F | `src/ui/account/LedgerScreen.tsx`, `src/ui/finish/HistoryScreen.tsx`, `src/ui/account/ActivityScreen.tsx` | None found |
| TRU-02 | P0 | Built | F | `src/domain/trustLedger.ts`, `docs/audit-trail.md` | None found |
| TRU-03 | P0 | Built | F | `src/domain/trustLedger.ts`, `src/ui/StatusBadge.tsx` | All nine states unchecked |
| TRU-04 | P0 | Built | F | `src/data/outbox.ts`, `docs/audit-trail.md` | C# idempotency tests not run |
| TRU-05 | P0 | Partial | F | `src/ui/book/changes.ts`, `src/domain/prebook.test.ts` | Rule lives in the server; a failed reschedule on screen is untested (a-tier-matrix row 13) |
| TRU-06 | P0 | Built | F | `src/hooks/useSavedCopy.ts`, `src/domain/offlineCache.ts`, `src/offlineDay.test.ts` | Source label per item unchecked |
| TRU-07 | P0 | Partial | R | `src/ui/aboard/SupportScreens.tsx`, `src/domain/aboardDepth.ts` | `/me/status` is built from client demo scenarios, not from a server health or incident feed |
| TRU-08 | P1 | Built | F | `src/ui/book/ChoiceError.tsx`, `src/ui/book/problems.ts`, `src/ui/plan/refused.ts` | Plain-language refusals on key flows |
| AST-01 | P1 | Built | F | `src/ai/stanley.ts`, `src/ai/stanleyRoute.ts`, `src/ai/stanleyRoute.test.ts` | None found |
| AST-02 | P1 | Built | F | `src/ai/guard.ts`, `src/ai/stanleyAsk.ts` | Freshness label unchecked |
| AST-03 | P1 | Built | F | `src/domain/answerCards.ts`, `src/domain/answerCards.test.ts` | None found |
| AST-04 | P0 | Built | F | `src/ui/ai/StanleyConfirm.tsx` (confirmation); `src/ai/guard.ts` is the separate handoff screen | None found |
| AST-05 | P0 | Built | F | `src/ai/guard.ts`, `src/domain/answerCards.ts` | Human routes are mocked |
| AST-06 | P1 | Built | F | `src/ui/ai/HandoffCard.tsx`, `src/domain/handoff.ts`, `src/domain/handoff.test.ts` | Consent step unchecked |
| AST-07 | P1 | Built | F | `src/domain/searchIndex.ts`, `src/ui/home/AskScreen.tsx` | None found |
| AST-08 | P2 | Built | F | `src/ui/home/SummaryScreen.tsx` (route `/ship/read-aloud`), `src/ui/home/AskScreen.tsx` | None found |
| COM-01 | P0 | Built | F | `src/ui/account/NotificationsScreen.tsx`, `src/domain/notifications.ts` | None found |
| COM-02 | P0 | Built | F | `src/domain/delivery.ts`, `src/domain/delivery.test.ts` | Marketing consent vs critical separation visible in `delivery.ts` |
| COM-03 | P0 | Simulated | F | `src/domain/delivery.ts`, `src/push/push.ts` | Email and SMS delivery simulated (NOT-01 in `docs/gap-analysis-plan.md`) |
| COM-04 | P0 | Not built | R | `src/domain/delivery.ts` | Critical alerts are sent but have no acknowledged-delivery state or fallback channel rule |
| COM-05 | P1 | Built | F | `src/ui/account/NotificationsScreen.tsx`, `src/domain/calm.ts` | None found |
| COM-06 | P1 | Partial | F | `src/push/push.ts`, `src/ui/pushScreens.test.tsx` | Exact-object deep link unchecked |
| OFF-01 | P0 | Partial | F | `src/data/outbox.ts`, `src/offlineDay.test.ts` | Per-feature capability table not found (see MOB-05) |
| OFF-02 | P0 | Built | F | `src/offlineDay.test.ts`, `src/hooks/useSavedCopy.ts`, `src/domain/offlineCapsule.ts` | None found |
| OFF-03 | P0 | Built | F | `src/domain/offlineCache.ts`, `src/domain/offlineCapsule.ts`, `src/offlineDay.test.ts` | "Verify with crew" shown on the capsule card |
| OFF-04 | P0 | Built | F | `src/data/outbox.ts`, `src/hooks/useOutbox.ts` | Conflict resolution unchecked |
| OFF-05 | P0 | Built | F | `src/api/bounded.ts`, `src/data/outbox.ts` | None found |
| OFF-06 | P1 | Partial | F | `src/settings/settings.ts`, `src/hooks/visibleInterval.ts` | Image controls and battery-conscious refresh unchecked |
| OFF-07 | P1 | Built | R | `src/domain/offlineCapsule.ts`, `src/data/capsule.ts` | BM1 surfaces eviction and asks for persistence; export/backup guidance not found |
| A11Y-01 | P0 | Built | F | `src/ui/a11y.test.tsx`, `src/ui/Dialog.tsx` | Audit is jsdom only |
| A11Y-02 | P0 | Partial | F | `src/design/textSize.ts`, `src/design/textSize.test.ts` | Screen-reader and 320 px reflow by hand only |
| A11Y-03 | P0 | Built | F | `src/ui/a11y.test.tsx`, `src/darkPatterns.test.ts` | None found |
| A11Y-04 | P0 | Built | F | `src/ui/DisplaySettings.tsx`, `src/domain/calm.ts`, `src/domain/calm.test.ts` | Captions and transcripts: no media found to caption |
| A11Y-05 | P0 | Built | F | `src/ui/aboard/SupportScreens.tsx`, `src/ui/account/PrintScreen.tsx` | Documented non-app route unchecked |
| A11Y-06 | P0 | Built | F | `src/ui/AccessAreaNote.tsx`, `src/domain/accessReference.ts` | None found |
| A11Y-07 | P1 | Out of reach | F | none | Needs research sessions with real people |
| A11Y-08 | P1 | Not built | F | `src/i18n` | English only by project rule; Spanish files are untouched |
| SEC-01 | P0 | Built | F | `src/security.test.ts`, `docs/security-performance-plan.md`, `docs/audit-trail.md` | Encryption at rest is a deployment matter |
| SEC-02 | P0 | Built | F | `src/auditGate.test.ts`, `src/security.test.ts` | Source scan guards storage |
| SEC-03 | P0 | Built | F | `src/domain/dataRules.ts`, `src/domain/privacy.ts` | Purpose limitation in code unchecked |
| SEC-04 | P0 | Built | R | `src/ui/account/PrivacyScreen.tsx`, `src/ui/DataSettings.tsx`, `src/sync/consent.ts` | None found |
| SEC-05 | P0 | Built | F | `src/domain/arrivalPing.ts`, `src/domain/homeLink.ts`, `src/sync/consent.ts` | None found |
| SEC-06 | P0 | Built | F | `src/ui/plan/FamilyLinkScreen.tsx`, `src/ui/aboard/ChatSafe.tsx` | None found |
| SEC-07 | P1 | Partial | F | `src/auth/httpProvider.ts` | Sign out exists; device review and "sign out everywhere" not found |
| SEC-08 | P1 | Out of reach | F | `docs/security-performance-plan.md` | Pen test and vendor review are outside code |
| UX-01 | P0 | Built | F | `src/routes/coverage.test.ts`, `src/routes/stageNav.test.ts` | Parity is by shared code |
| UX-02 | P0 | Partial | F | `src/styles`, `src/ui/Shell.tsx` | Desktop is responsive layout; wide-screen comparison workspace unchecked |
| UX-03 | P0 | Built | F | `src/routes/nav.test.ts` | Reachable-zone placement is by hand |
| UX-04 | P1 | Built | F | `src/sync/sync.ts`, `src/sync/sync.test.ts`, `src/ui/DataSettings.tsx` | Server-held; the project rule |
| UX-05 | P1 | Built | F | `src/ui/account/PrintScreen.tsx`, `src/domain/export.ts`, `src/domain/export.test.ts` | Folio and ticket printing unchecked |
