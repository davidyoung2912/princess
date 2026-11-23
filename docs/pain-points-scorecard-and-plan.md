# Pain-points scorecard and gap-closing plan (R1 to R8)

Status: **Proposed 2026-11-23. Nothing here is built.** Source: `docs/princess_passenger_pain_points_pwa_research.md` (21 Nov 2026), the 14 ranked pain points, the cross-cutting principles (section 5), the Stanley table (section 9) and the four-release roadmap (section 7).

## 1. How to read this, and how far to trust it

**Grading scale.** The grade is for the *product capability the research asks for*, as the front end plus the mocked backend deliver it today. It is not a grade on whether Princess's real systems are connected (they are not; see 1.3).

| Grade | Meaning |
| --- | --- |
| A+ | Does everything the requirement says, handles its failure cases, is covered by a test, **and has been walked on a real phone** |
| A | Complete and tested in code; the device walk has not happened |
| A- | Complete in the main path; one stated edge or sub-point missing |
| B+ / B | Real, working feature, but it covers part of the requirement or is hard to find |
| B- / C+ | A thin version, or the idea exists in a different place from where the research wants it |
| C and below | Mostly missing |

**1.1 What I verified.** In this session I opened the research doc in full and read code for: the PWA config (`vite.config.ts`), the offline copy layer (`src/data/capsule.ts`, `src/domain/offlineCache.ts`, `src/offlineDay.test.ts`), `SyncChip`, `ThreeClocks`, `Timeline`, `PartyScreen`, the navigation model (`src/routes/nav.ts`), the screen map (`src/screens.ts`), the chat API types, share codes, push types, the folio states, the outbox, the global search index, and the shell's scroll handling. Rows marked **(†)** are graded from a screen's name, its API type or an older plan doc, **without opening the screen**. Treat a (†) grade as plus or minus half a grade.

**1.2 What I did not do.** No browser, no device, no `dotnet`, no test run (project rules). The project has 880 commits and about 260 routes, so "this exists" is checked by targeted search, not a full audit. Anything marked "not found" means a search of `src/domain`, `src/ui` and the named file found nothing; a feature could hide under another name. Please correct me where I am wrong.

**1.3 Honesty caveat the research itself raises.** The research says "never simulate a successful booking, payment or live location". Our backend simulates all of it behind interfaces, by design (CLAUDE.md). That is fine for a pilot, but every grade below assumes a real provider can drop in later. Gap G-01 is about making that honest on screen.

**1.4 Why nothing is A+ yet.** A+ needs a device walk. The release scorecard (`docs/release-scorecard.md`) still has every "Walk" row unpassed, and the research's own offline exit criterion ("open in airplane mode") has never been run. That one fact caps the whole report at A.

## 2. Summary scoreboard

| # | Pain point (research rank) | Grade | One-line reason |
| ---: | --- | :---: | --- |
| 1 | Reliability, identity, booking trust | **B+** | Sync chip, idempotency, trust ledger are strong; booking-association states, multi-trip and failure-context are thin |
| 2 | Travel party and group coordination | **B** | Chat groups, polls, RSVP, QR hand-off, guardians are deep; the Party screen is thin and not a primary destination; no location sharing |
| 3 | One view of every booking | **B** | Plan, reservations, conflicts, print exist; no all-in-one filtered wallet search, home is stage-based not timeline |
| 4 | Offline and weak connectivity | **B+** | Age-stamped copies on every key screen, tested; no proactive "Download my cruise", localStorage not IndexedDB, never device-tested |
| 5 | Check-in and profile status | **A-** | Resumable, receipt, terminal flow; "ready" authority and contradiction flags unverified |
| 6 | Navigation, search, task flow | **B** | Two-tap rule is tested; scroll position is reset on every navigation, no trip switcher |
| 7 | Port-day and excursion planning | **A-** | Three clocks, all-aboard, tender, port pack are strong; custom route builder and accessibility notes thin |
| 8 | Onboard schedule | **B+** | Schedule, favourites, conflicts, RSVP; no "preliminary/final" status or publish-date expectation |
| 9 | Dining and package clarity | **B** | Explorer and reservations work; no "why can't I book" eligibility explanation found |
| 10 | Onboard wallet and loyalty | **B+** | Folio states (pending/posted/disputed), ledger, final bill; loyalty "why not" explanation not found |
| 11 | Ship maps and wayfinding | **B** | Deck plans, venue search, a route graph; no step-free routing choice found |
| 12 | Chat and notifications | **A-** | Held-reason log, quiet hours, urgency lanes, ack escalation; delivery states and diagnostics partly (†) |
| 13 | OceanNow and menu accuracy | **B+** | Substitutes and unavailable lines exist; offline cart and live-check wording (†) |
| 14 | Support and service recovery | **B+** | Cases, report-a-problem, fix-it flows; outage notice and screenshot (†) |
| 5.x | Cross-cutting principles | **B+** | Confirmed-vs-suggested and time-zone safety are strong; privacy scopes partly missing |
| 9 | Stanley's role | **A-** | Proactive cards, actions with undo, offline copy; strongest area |

**Overall: B+.** The platform is much broader than the research asks for. The weak spots are not missing screens; they are **continuity** (scroll, filters, trip switching), **proactive offline download**, **explaining refusals** (dining, loyalty, booking link) and **proof on a device**. Those are the same themes passengers complained about.

## 3. Detailed scorecard

Each row is one numbered requirement from the research. "Gap" says what moves it to A+. Evidence is a file or "(†)".

### 3.1 Priority 1: Reliability, identity and booking-data trust (B+)

| Req | Requirement | Grade | Evidence and gap |
| --- | --- | :---: | --- |
| 1.1 | Show every active and upcoming cruise | **C+** | One sailing at a time; no trip switcher found (search for switcher/multiple trips: nothing). Gap: trip list and switcher in the header and on Me. |
| 1.2 | Guided booking association with distinct states | **B-** | `FindPassScreen` takes booking number plus last name. Not found: states for duplicate association, owned by another profile, support required. Gap: a linking flow with those six named states and a next step for each. |
| 1.3 | Explain what is needed to link | **B** | Sign-in flows exist (†). Gap: a "what you need" panel plus a specific reason on every failure. |
| 1.4 | Keep trip context across navigation and refresh | **B** | Session and selected sailing persist (†). Scroll and list state do not (see 6.1). |
| 1.5 | Persistent sync indicator with named states | **A-** | `SyncChip` shows updated-at, offline-since, pending count, "unavailable", "not linked". Speaks only when stale. Gap: one global place to see all states at once. |
| 1.6 | Last refresh per data type | **B+** | Each saved copy carries its own `savedAt`; the "Saved" label shows it. Gap: a single "What is fresh" list (booking, dining, excursions, check-in, folio, schedule). |
| 1.7 | No stale value shown as current | **A** | `offlineDay.test.ts` fails the build if a screen shows a kept copy without its age. |
| 1.8 | Idempotent actions: pending, reference, check before retry | **A-** | `Idempotency-Key` on booking and payment writes (`src/api/http.ts`, `BookingService`). Gap: UI wording "checking whether it went through" before allowing a retry after timeout. |
| 1.9 | Action history | **A-** | `/me/activity`, `/me/ledger`, trust ledger (nothing can be removed). Gap: show "server accepted / confirmation returned" per row (†). |
| 1.10 | Recovery paths for common failures | **B** | `/me/fix-it` guided flows, `/home/delayed`. Gap: map each named failure (wrong profile, duplicate, not found, eligibility, server down, incomplete record) to a flow. |
| 1.11 | Say when the source is down; keep entered data | **B+** | `useDraft`, `ClearDraft`, outbox, "unavailable" chip. Gap: drafts for every long form, not only chat. |
| 1.12 | Consistent web and app identity | **B** | Same web app everywhere, so no split. Sign-up, recovery, MFA were open server items in the gap analysis (ACT-01). |
| E.1 | One primary action, one status | **B+** | Consistent `Card` and `StatusBadge` pattern (†). |
| E.2 | Plain language first, reference ID second | **B+** | `DiagnosticsSettings`, problem log (†). Gap: show the reference ID on every error. |
| E.3 | Keep screen state on failure | **B-** | Error boundary exists; no evidence list and scroll state survive a failure. |
| E.4 | Confirmed vs saved idea | **A-** | `StatusBadge`, "saved" vs "booked" separation (†). |

**To A+:** build the trip switcher, a six-state linking flow, a "what is fresh" panel, a reference ID on every error, and walk the flows on a phone with the network cut at each step.

### 3.2 Priority 2: Travel party and group coordination (B)

| Req | Requirement | Grade | Evidence and gap |
| --- | --- | :---: | --- |
| A.1 | Create a named party | **A-** | `chatGroups.create(name, people)`; Party screen for notes and invites. Two concepts (Party vs chat group) is confusing. |
| A.2 | Invite by link, QR, email, share sheet | **B+** | QR and copy-link hand-off codes with 15 min / 1 h / 24 h lives (`shareCodes.ts`); Party screen uses email only. Gap: one invite sheet offering all four, plus the OS share sheet (`navigator.share`). |
| A.3 | Join with own account, no booking numbers | **A-** | `SharesApi.accept` returns joined / awaitingGuardian / requested / connected. |
| A.4 | Cross-cabin and cross-booking, with identity checks | **B+** | Connections (`ChatConnection`) work across bookings; identity verification is mocked. |
| A.5 | One person in several groups | **A** | Chat groups are many-to-many. |
| A.6 | Invitation state (invited, accepted, declined, expired, pending verification) | **A-** | `ChatGroupInvite`, `waiting`, `needsGuardian`, revoke. "Pending identity verification" not distinct. |
| A.7 | Leave and remove | **A** | `leave`, `remove`, `revokeInvite`. |
| B.1 | Separate permissions: in party / sees plans / may message / sees location | **C+** | Separate switches exist for findable, preview, DND (`ChatSettings`); not the four-way split. Gap: a per-person permission sheet. |
| B.2 to B.5 | Location off by default, time-bounded, hide from some | **D** | Browser geolocation is used only in `DeviceTools` for the guest's own use. No shared location. Gap: see G-07; a deliberate, bounded design. |
| B.6 | No sensitive data in group by default | **B+** | Avatar and first-name-last-initial rules in bundles; share code scope (†). |
| B.7 | Guardian-managed child accounts | **A** | `ChatGuardianApi`, children list, supervised flags, release-scorecard C3. |
| C.1 to C.2 | Shared day plan; votes | **A-** | `ChatPoll`, `ChatBoard` (day plan from bundles), `boardIn`, `decidePoll`. |
| C.3 | Going / maybe / no | **A** | `rsvp`, `ChatRsvp`, meet-ups with in/maybe/no. |
| C.4 | Group availability without private bookings | **B** | `going` list only; no free/busy view. |
| C.5 | Conflict detection and group alternative | **B+** | `ChatBoard.clashes`, `planChange` (†). |
| C.6 | Share a port plan | **A-** | `portParty`, bundle type `portDay`. |
| C.7 | One-tap "running late / meet there / back onboard" | **A-** | `draftMessage({kind:'late'|'meet'})`, back-aboard notice. |
| C.8 | Share a meeting place from a ship map | **B+** | `ChatPlace` bundle with deck and section; not tied to a map pin. |
| D.1 to D.7 | DMs, groups, unread, pins, linked cards, queued offline, retention | **A-** | `ChatPin`, `ChatCard`, outbox, `ChatKeep`. Retention was open (MSG-05). |
| E.1 | Choose party members for dining without booking numbers | **C+** | Dining flow (†) does not appear to take a party. Gap: G-05. |
| E.2 to E.4 | Show who is in a reservation; keep booking permission separate | **B** | Reservation guests exist; party membership does not grant purchase rights (†). |
| M | Meetup actions: meet here, find the group, who's going, port rendezvous, back onboard | **B+** | Meet-ups, back-aboard, ashore lists exist; "find the group" directions do not. |

**To A+:** make **Party** a labelled destination (today it is `/plan/party`, `/plan/family-link`, plus chat groups); merge the two group concepts behind one invite sheet; add the per-person four-way permission sheet; add time-bounded location *sharing of a named place* first (see G-07); take the group into dining.

### 3.3 Priority 3: One reliable view of every booking (B)

| Req | Requirement | Grade | Evidence and gap |
| --- | --- | :---: | --- |
| 1 | All booking types in one timeline | **B** | `/plan`, `/plan/reservations`, `/plan/day`, excursions explorer, spa, dining; spread over several screens. |
| 2 | Date, time, duration, place, status, party, reference | **B+** | `ReservationsScreen`, `Timeline` has time, title, detail, status (†). |
| 3 | Group by day and port, one order | **B+** | Day screens exist (†). |
| 4 | Confirmed vs saved vs tentative vs invited | **B+** | `StatusBadge`, chat plan vs booking (†). |
| 5 | Filters | **B-** | Not found on the reservations list. |
| 6 | Agenda and detail view | **B** | Day and list exist; no compact agenda toggle. |
| 7 | Open detail, return to same place | **C+** | Scroll reset on every route change (`Shell.tsx:222`). |
| 8 | Searchable wallet by venue, date, guest, number | **C+** | Global search index covers venues, events, tours, ports; not reservations (`searchIndex.ts`). |
| 9 | Cancelled and changed look different | **A** | `Timeline` has changed and cancelled states that never silently disappear (OB-08). |
| 10 | Source and update time per item | **B+** | Copy age per screen, not per item. |
| 11 | Overlap warning before confirming | **B+** | `program.ts`, `planChange.ts` conflict logic. |
| 12 | Travel-time buffers | **B** | Deck graph gives ship legs (`wayBetween`); no buffer in the warning. |
| 13 | Personal reminders distinct | **A-** | `customReminders.ts`, `LocalReminders`. |
| 14 | Share items with party | **A-** | Share bundles. |
| 15 | Printable summary | **A-** | `/me/print`. |
| H | Home answers the six questions | **B+** | Home is stage-based, shows next required action first (B2 in scorecard). The research wants the timeline as home; our model arguably does the job better but "has anything changed since I last checked" is a separate screen (`/home/updates`). |

**To A+:** one **Voyage** screen with filters, compact and day views, a reservation search, per-item freshness, a "what changed since you last looked" strip on top, and list position restored on return.

### 3.4 Priority 4: Offline access (B+)

| Req | Requirement | Grade | Evidence and gap |
| --- | --- | :---: | --- |
| C.1 | Auto-cache sailing, ports, times, guides, reservations, party, deck plans, schedule, embark, emergency, notes | **B+** | Must-work-offline kinds are asserted by test: pass, program, dining, folio, muster, emergency, embark, portDay, receipt, health. Copies are kept **when viewed**, not fetched ahead. Deck plans and venue directory ship in the app bundle. |
| D.1 | "Download my cruise" action | **D+** | No such action found. `OfflineCapsule` shows what is kept and a test result. Gap: G-02. |
| D.2 | Show size and storage | **B+** | `readStorageReport` uses `navigator.storage.estimate`; persistence request. |
| D.3 | Choose ports to download | **C** | `CapsulePrefs` choose kinds, not ports. |
| D.4 | Prefer text over images | **B** | Art is CacheFirst, 80 entries, 90 days. |
| D.5 | Progress and completeness | **C** | Not found. |
| D.6 | Refresh action | **B** | Pull and refresh per screen (†). |
| D.7 | Last sync and failed sections | **B-** | Per-copy age; no failed-section list. |
| P.1 | App shell works offline | **A-** | Workbox precache plus `navigateFallback`; not device-verified. |
| P.2 | Cached data immediately, no spinner | **A-** | `useSavedCopy` (†). |
| P.3 | "Saved on this device" label | **A** | `Saved`, `SyncChip` required by test. |
| P.4 | Stale warning | **A** | Per-kind `maxAgeFor` (schedule 3 days, pass the trip). |
| P.5 | "Connect to update" | **B+** | `OfflineNote` states per screen what works offline (`offlineContract`). |
| P.6 | Keep local notes and drafts | **B+** | `useDraft`, reminders, diary. |
| P.7 | Queue low-risk changes | **B** | Outbox queues chat and service requests only, with backoff. Favourites and notes do not queue. |
| P.8 | Never queue purchases | **A** | Offline contract marks them needs-connection. |
| N.1 | Cache versioning, expiry, logout cleanup, shared device | **B+** | `lifecycle.ts`, `deviceBackup`; storage is **localStorage** (about 5 MB, synchronous, one string per copy). Gap: move bulk copies to IndexedDB. |
| N.2 | Do not rely on Background Sync | **A** | Retries on open and on reconnect. |
| N.3 | Push is an enhancement | **A-** | In-app inbox exists (`/home/updates`). |

**To A+:** G-02 (a real pre-sailing download with progress, per-port choice and a failed-section list), IndexedDB for bulk data, queue favourites and notes, and the airplane-mode walk across the ten must-work screens.

### 3.5 Priority 5: Check-in and profile status (A-)

| Req | Requirement | Grade | Evidence and gap |
| --- | --- | :---: | --- |
| 1 | Sequenced tasks with progress | **A-** | `CheckinScreen`, `/home/embarkation/steps`, `readiness`. |
| 2 | Required, optional, done, pending, action needed | **A-** | `StatusBadge` states (†). |
| 3 | Why it is needed, who sees it | **B+** | `SharingNote` pattern. |
| 4 | Local drafts, resume | **A-** | Scorecard B3 asks for a one-sitting, resumable flow (walk pending). |
| 5 | Timestamp on server save | **B+** | Receipt screen (`/home/check-in/receipt`). |
| 6 | Keep entry and say what failed on rejection | **B+** | (†) |
| 7 | Reconcile; never overwrite a better local draft | **B** | Not verified. |
| 8 | Flag contradictory states | **C+** | Not found. Gap: compare checklist against server status on refresh and show a named conflict. |
| 9 | Downloadable checklist summary | **B+** | `/me/print` includes tasks (†). |
| 10 | Step-specific help link | **B** | (†) |
| 11 | Consistent across channels | **B** | Single channel. |
| 12 | "Ready" only when authority confirms | **A-** | `/plan/readiness`, `papersCheck` (†). |
| X | Verified-only readiness score | **A-** | `readinessBoard` (†). |

**To A+:** contradiction flags with a next action, a step-specific help link on every task, and the "Maria and Daniel" walkthroughs on a phone.

### 3.6 Priority 6: Navigation, search and task flow (B)

| Req | Requirement | Grade | Evidence and gap |
| --- | --- | :---: | --- |
| N.1 | Today / Voyage / Explore / Party / Help | **B+** | Five tabs: Home, Plan, Ship, Chat, Me, adapted by stage (`stageNav`). Different names, same intent; "Party" lives under Plan and Chat. |
| 1 | Keep filters, list position, cruise on return | **C** | `window.scrollTo(0,0)` on every path change; `useSearchParams` used on only five screens. This is the exact Reddit complaint. |
| 2 | Visible trip switcher | **D** | None found. |
| 3 | One global search across ports, venues, activities, restaurants, reservations | **B** | `searchIndex.ts` covers venues, events, places, services, tours, ports, screens; **not reservations or party items**. |
| 4 | Natural-language search | **A-** | Stanley understanding engine, `/home/ask`. |
| 5 | Contextual actions on results | **B** | (†) |
| 6 | No repeat sign-in | **A-** | JWT refresh, session token. |
| 7 | Back returns to exact prior screen | **B-** | Router back works; scroll lost. |
| 8 | Labels over icons | **A-** | `tabText`, jsx-a11y lint. |
| 9 | Common actions in one or two taps | **A** | `TOP_TASKS` and `navProblems()` are asserted by test (MAX_TAPS = 2). |
| 10 | Phone, tablet, desktop | **A-** | Phone bar and desktop rail. |
| 11 | Search from every stage | **B+** | `ShortcutBar`. |
| 12 | Empty states that explain | **B+** | (†) |

**To A+:** scroll and filter restoration (G-03), a trip switcher (G-04), reservations and party items in search, and a Walk for scorecard B1 and B4.

### 3.7 Priority 7: Port-day and excursion planning (A-)

| Req | Requirement | Grade | Evidence and gap |
| --- | --- | :---: | --- |
| A | Port facts: zone, times, tender status, time ashore, accessibility | **A-** | `PortDayScreen`, `tender.ts`, `allaboard.ts`, `portCrowd`; accessibility notes (†). |
| A | Ship time vs local time side by side | **A** | `ThreeClocks` shows ship, port and phone clocks in words, plus a zone-change notice. |
| B | Shore access: walk, gangway, tender, shuttle | **A-** | `tender.ts`. |
| B | Port map, transport | **B** | Offline port map was open (POR-06). |
| C | Filter by type, duration, distance, demand, cost | **B+** | `ExplorerCatalogue`, `excursionFit` (†). |
| C | Filters persist on return | **C** | Same scroll and filter problem as 6.1. |
| C | Princess vs independent clearly marked | **B+** | (†) |
| C | Shortlist shared to party | **A-** | `shortlist.ts`, bundles. |
| C | "Booked by me" view | **B+** | `/excursions-explorer` (†). |
| D | Independent exploration, custom route, notes | **B** | Port guides, tips; custom route builder not found. |
| E | All-aboard prominent, buffer, reminders | **A** | `REMINDER_THRESHOLDS` 120/60/30 min; `AboardLevel`. |
| E | Operative deadline explained | **A-** | Phone rule note under the clocks. |
| E | Group meeting point and return time | **B+** | `portParty`. |
| S | Stanley shore assistant using real schedule | **A-** | `stanleyDisembark`, `portPilot` (†). |

**To A+:** custom route builder with saved notes, a port map in the offline pack, filter persistence, and a tender-queue allowance in the return buffer.

### 3.8 Priority 8: Onboard activities and entertainment (B+)

| Req | Requirement | Grade | Evidence and gap |
| --- | --- | :---: | --- |
| 1 | Daily schedule with category filters | **B+** | `program.ts`, `/plan/day`. |
| 2 | Favourite and personal schedule | **A-** | `useFavourites`. |
| 3 | Venue, deck, time, duration, reservation need | **A-** | `eventAccess.ts`. |
| 4 | Booked / reservation-only / walk-in | **A-** | `eventAccess.ts` (†). |
| 5 | Completeness: preliminary, updated, final | **D** | Not found. |
| 6 | Last updated time | **A-** | Saved copy age (3-day limit for `program`). |
| 7 | Notify on change to saved events | **B+** | Push kind `scheduleChange`. |
| 8 | Conflict detection | **B+** | `program.ts`. |
| 9 | Share and RSVP | **A-** | Chat `rsvp`. |
| 10 | "What's happening today" | **A** | Home and `/plan`. |
| 11 | Offline schedule | **A-** | `program` is a must-work-offline kind. |
| 12 | Search by performer, venue, type, time | **B** | Events are in the search index; performer search not verified. |
| 13 | Quiet-day / family-day planner | **A-** | `rhythm`, `stanleyFamily`, `/plan/rhythm`. |
| 14 | Age suitability from verified data | **B** | (†) |
| 15 | Keep scroll on return | **C** | Same as 6.1. |

**To A+:** add a schedule status (preliminary, updated, final, with "expected by" date before it is published), performer search, and scroll restoration.

### 3.9 Priority 9: Dining, group seating and package clarity (B)

| Req | Requirement | Grade | Evidence and gap |
| --- | --- | :---: | --- |
| 1 | Options by date, period, venue, availability | **B+** | Dining explorer, `diningView`. |
| 2 | Explain eligibility in context | **C** | No eligibility reasoning found in `src/domain/dining.ts`. Gap: G-05. |
| 3 | No inventory vs eligibility vs payment error | **C** | Not found as separate outcomes. |
| 4 | Alternatives by time, venue, party size | **B+** | `alternatives.ts`. |
| 5 | Select a linked party | **C+** | See 3.2 E.1. |
| 6 | Dining in timeline and wallet | **B+** | `/plan/reservations`. |
| 7 | Venue, date, time, party, requests, status | **B+** | `dining` data (†). |
| 8 | Show cancel and modify rules before commit | **B** | `policy.ts` (†). |
| 9 | Group RSVP before organiser submits | **B+** | Chat polls and boards can decide a dinner; not wired to submit a reservation. |
| 10 | Package benefits next to venue or menu | **B+** | `entitlements.ts`, `packages` (†). |
| 11 | Saved restaurant vs confirmed | **A-** | Distinct badges. |
| 12 | Keep selection on failure | **B** | `useDraft` (†). |
| 13 | Menus and dietary info | **A-** | `menus.ts`, `dietaryRequest`, allergy chain. |
| 14 | Save menus and prefs offline | **A-** | `useSavedDishes`, `/ship/dining-prefs`. |

**To A+:** eligibility explanation in plain words with three distinct refusals, a party picker on every dining booking, and wiring "decided in chat" into a booking request.

### 3.10 Priority 10: Onboard wallet and loyalty (B+)

| Req | Requirement | Grade | Evidence and gap |
| --- | --- | :---: | --- |
| 1 to 2 | Balance, pending, posted; date, amount, description, person | **A-** | `folio.ts`, `/me/bill`. |
| 3 | Filter by person, category, date | **B+** | (†) |
| 4 | Package entitlement in plain words | **B+** | `entitlements.ts` is one engine for fare, package and tier (PRE-16). |
| 5 | Redemption history | **B** | (†) |
| 6 | Pending vs settled | **A** | `FolioState`: posted, pending, disputed, refunded, adjusted; totals separate pending. |
| 7 | Dispute with reference prefilled | **B+** | Disputed lines tie to cases (`/me/cases`). |
| 8 to 9 | Loyalty tier, which benefits, and why not | **B-** | `LoyaltyScreen` found; no "not available because" text found. |
| 10 | Refresh time on folio | **A** | `folio` is a must-work-offline kind with age. |
| 11 | End-of-cruise statement download | **A-** | `/me/bill/final`. |

**To A+:** a "why not" line for each unavailable benefit, redemption history with source, and a prefilled dispute from every line.

### 3.11 Priority 11: Ship maps and wayfinding (B)

| Req | Requirement | Grade | Evidence and gap |
| --- | --- | :---: | --- |
| 1 | Searchable offline deck plan | **A-** | `DeckMapScreen`, `deckPlans/`, in the app bundle. A graphic plan was open in the earlier gap list (OB-04); `deckPlans` now exists. |
| 2 | Search venues and facilities | **A-** | `searchPlaces`, `/ship/venues`. |
| 3 | Deck, landmarks, hours, accessibility | **B+** | (†) |
| 4 | Route between venues with deck changes and elevators | **B+** | `wayBetween`, `buildGraph(closed)`; elevator banks shown. |
| 5 | Accessible (step-free) routes | **C+** | Step-free marks and an access note; no routing preference found. |
| 6 | Bookmark venues | **A-** | `useVenuePins`. |
| 7 | Static fallback | **A** | The whole map is static; no live positioning is assumed. |
| 8 | Say whether directions use live location | **A-** | Start point is chosen by the guest. |
| 9 | "Take me to my next event" | **B** | Not verified. |
| 10 | Share meeting point on the map | **B-** | Chat place bundle; no map pin. |

**To A+:** a step-free route option in the graph, "route to my next event" on Home and on every timeline row, and a map pin in the chat place card.

### 3.12 Priority 12: Chat and notifications (A-)

| Req | Requirement | Grade | Evidence and gap |
| --- | --- | :---: | --- |
| 1 | Message centre with unread counts | **A-** | `/chat`, `ChatSummary`. |
| 2 | Opt-in web push | **A-** | `push.ts`, `serviceWorker.test.ts`. |
| 3 | In-app inbox as fallback | **A-** | `/home/updates`, `ChatNotice` lanes. |
| 4 | Sending, sent, delivered, failed | **B+** | `delivered(id)`, outbox; "failed" wording (†). |
| 5 | Mute or prioritise a chat | **A** | `mute`, `mentionsOnly`, urgency `ChatUrgency`. |
| 6 | Notification diagnostics and permission state | **A-** | Push log with `HeldReason` (channelOff, dnd, calm, quiet, budget); `usePushState`. |
| 7 | Saved meet points when push is off | **A-** | Pins and boards in the thread. |
| 8 | Offline messages visibly pending | **A** | Outbox with attempts and `nextAt`. |
| 9 | Safety channel separate | **A-** | `critical` lane skips budget, calm and quiet; unacknowledged for 10 min also goes by text or email. |
| 10 | Quiet hours, per-category controls | **A** | DND modes, nudge budget, per-kind channels. |

**To A+:** a one-tap "send me a test notification", iOS install guidance for push (Add to Home Screen, 16.4+), a measured delivery rate on a real device.

### 3.13 Priority 13: OceanNow and menu accuracy (B+)

| Req | Requirement | Grade | Evidence and gap |
| --- | --- | :---: | --- |
| 1 | Clear categories | **A-** | `OrderScreen`, `DrinksScreen`. |
| 2 | Menu by ship, venue, period, area | **B+** | `orders.ts`, `Location`. |
| 3 | Package inclusion and price beside each item | **B+** | (†) |
| 4 | Unavailable items with alternatives | **A-** | `item.substitute`, `o.unavailable` list. |
| 5 | Not orderable when unsupported | **B+** | (†) |
| 6 | Order status, only when source supports | **B+** | (†) |
| 7 | ETA only when grounded | **B+** | (†) |
| 8 | Keep cart offline, submit only when connected | **B** | Offline contract marks ordering needs-connection; cart persistence not verified. |
| 9 | Substitutions and price changes explicit before confirm | **A-** | `ord.swapped` line. |
| 10 | Offline menus with "check availability" label | **B+** | `menus.ts`. |

**To A+:** cart survives a reload and a dropped connection, a "drink not found? tell us" report from search, a verified ETA rule.

### 3.14 Priority 14: Support and service recovery (B+)

| Req | Requirement | Grade | Evidence and gap |
| --- | --- | :---: | --- |
| 1 | Help centre with search and stage categories | **A-** | `help.ts`, `HelpSheet`, always-visible Help. |
| 2 | Report from the screen where it happened | **B+** | `/me/report-problem` (†). |
| 3 | Safe diagnostic context attached | **B+** | `diagnostics/log.ts`, `DiagnosticsSettings`. |
| 4 | Never attach passport or payment | **A-** | `security.test.ts`, `dataRules` (†). |
| 5 | Description plus optional screenshot | **C+** | Screenshot not found. |
| 6 | Case number and status history | **A-** | `/me/cases`. |
| 7 | Who will answer: bot, Princess, Guest Services | **B+** | Chat service lane (†). |
| 8 | Do not just say reinstall | **A-** | Fix-it flows. |
| 9 | Fallback contact when digital is down | **B+** | `HelpSheet` phone alternative (scorecard B4). |
| 10 | Stanley with approved support content and escalation | **A-** | Concierge handoff rules (scorecard C2). |
| 11 | Known-outage notice | **C+** | No service-notice feed found (only the disruption hub for ship events). |

**To A+:** a service-notice banner fed by the server, screenshot attach with redaction, and the "who will answer" label on every case.

### 3.15 Cross-cutting principles (section 5)

| Principle | Grade | Evidence and gap |
| --- | :---: | --- |
| 5.1 One trip, one model | **B** | Many entry points (260 routes). Scorecard B9 (one planner, one wallet, one inbox, one help) is a Walk row, not yet passed. |
| 5.2 Six labels (confirmed, pending, saved, suggested, shared, cached) | **B+** | `StatusBadge`, bundle `from`, copy age exist. No single legend; "Suggested by Stanley" is labelled on Stanley cards. |
| 5.3 Time-zone safety | **A** | `ThreeClocks`, `timezones.ts`, ship-zone all-aboard epoch; reminders based on `allAboardEpoch`. |
| 5.4 Offline-first, not offline-only | **B+** | See 3.4. |
| 5.5 Reduce cognitive load | **B** | 260 routes is a lot; mitigated by stage-based nav and the two-tap test. |
| 5.6 Privacy as a feature | **B** | Revocable, expiring hand-off codes; guardian rules; export and delete; no per-person scopes (see 3.2 B). |
| 5.7 Whole range of passengers | **A-** | jsx-a11y, WCAG 2.2 AA target, Gerald and Linda tests (Walk pending). |
| 5.8 Phone and PC | **A-** | Responsive rail and bar; print summary. |

### 3.16 Stanley's role (section 9)

| Pain point row | Grade | Evidence |
| --- | :---: | --- |
| Booking uncertainty ("pending until confirmed") | **A-** | `stanleyAction` preview, confirm with idempotency key, undo for two hours, receipts. |
| Companion linking (QR) | **A-** | Hand-off codes. |
| Missing reservation (sync time) | **B+** | `answerFreshness.test.ts`. |
| Offline use | **A-** | `stanleyOffline.ts` keeps the next day of reminders and queues confirms. |
| Port planning, all-aboard, shore | **A-** | `stanleyDisembark`, `stanleyAway`. |
| Activity conflicts | **B+** | `stanleyChanges`. |
| Dining group ("four have accepted") | **B+** | `ChatCoordinatorPreview`, tally. |
| Wayfinding | **B** | Depends on gap 3.11. |
| Support ("booking-sync issue, here is the reference") | **B** | Reference ID gap in 3.1. |

### 3.17 Metrics, section 8

The research's scorecard measures (task completion, time to find a booking, offline success rate, etc.) need **baselines and instrumentation**. We have `track('screen')`, a stats module and Stanley telemetry, but no task-completion funnel for the top-10 tasks. **Grade C+.** Gap: G-10.

## 4. Gaps in priority order

Ranked by (passenger impact × how directly the research names it × effort). "Effort" is S (days), M (about a week), L (more than a week).

| ID | Gap | Research rows it lifts | Effort | Why this rank |
| --- | --- | --- | :---: | --- |
| G-01 | **Pilot honesty banner and per-source provenance** ("Sample data" vs "Confirmed by Princess"), driven by the server so the front end does not know | 1, 5.2, 10 | S | Research says never imply an unconfirmed action succeeded. Cheap, and it protects the proposal. Must be a server flag, per CLAUDE.md. |
| G-02 | **"Download my cruise"**: ahead-of-time fetch of itinerary, port guides, reservations, party, schedule, with size, progress, per-port choice, failed-section list; bulk store stays on current storage for now (IndexedDB deferred) | 4 | L | The research's headline differentiator and its stated exit criterion. |
| G-03 | **Context restoration**: scroll position and list filters preserved on back, in the URL where possible | 6, 3, 7, 8 | M | The exact complaint quoted from Reddit; hits four areas at once. |
| G-04 | **Trip switcher** and multi-booking list | 1, 6 | M | Needed by anyone with two sailings; research req 1.1 and 6.2. |
| G-05 | **Explain refusals**: dining eligibility (three distinct reasons), loyalty "why not", booking-link failure states | 9, 10, 1 | M | Passengers' loudest dining and linking complaints. |
| G-06 | **Party hub as one destination**: single invite sheet (link, QR, email, share sheet), per-person permission sheet, party picker in dining and excursions | 2, 9 | L | The research's lead story. We have the parts but not the one place. |
| G-07 | **Time-bounded sharing of a named place** ("I'm at the Piazza until 6 pm"), then optional device location with off-by-default, 2-hour and port-day limits | 2 | M then L | Research asks for it, but also warns browser location is not Medallion. Do the safe version first. |
| G-08 | **One Voyage view**: filters, compact vs day, reservation search in global search, "what changed" strip, per-item freshness | 3, 6 | M | Closes the single-view complaint. |
| G-09 | **Schedule status and publish expectation** (preliminary, updated, final, expected by date) and performer search | 8 | S | Small and specific to a research quote. |
| G-10 | **Task-funnel metrics** for the top 10 tasks plus a baseline method | 8 (metrics) | M | You cannot show improvement without it. |
| G-11 | **Step-free route option**, "route to my next event", map pin in chat place cards | 11 | M | |
| G-12 | **Service-notice feed and screenshot attach** with redaction | 14 | M | |
| G-13 | **Check-in contradiction flags** and step-specific help | 5 | S | |
| G-14 | **Queue low-risk offline changes** (favourites, notes) and "What is fresh" panel | 1, 4 | S | |
| G-15 | **Device walk-through** of the release scorecard Walk rows, airplane mode first | all | M (people time) | The only way any row reaches A+. Needs the owner and real phones. |

## 5. Phased plan

Follows the project rule: build one phase, run `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`, commit when asked, stop. Phases are named R1 to R8 so they do not collide with the G and N phases already used. Server work is included where a gap needs it; no `dotnet test` is run.

| Phase | Name | Closes | Main work | Moves |
| --- | --- | --- | --- | --- |
| **R1** | Continuity | G-03, G-14 | A route-scoped scroll and list state store; restore on back; filters into the URL on explorer, reservations, schedule and ports; queue favourites and notes in the outbox; "What is fresh" panel on Me. Tests: store round-trips, every list screen declares its restore key. | Areas 6, 3, 7, 8 each up about half a grade |
| **R2** | Explain the refusal | G-05, G-13 | Server returns a `reason` for dining, loyalty and booking-link refusals; front end shows plain words, a next step and a reference ID; six-state linking flow; check-in contradiction flags. | Areas 1, 5, 9, 10 |
| **R3** | Trips and Voyage | G-04, G-08, G-09 | Trip list and switcher; one Voyage screen with filters, compact/day toggle, reservation search in the index, "what changed" strip; schedule status field and performer search. | Areas 1, 3, 8 |
| **R4** | Download my cruise | G-02 | a pack manifest from the server (items, sizes, ages); download with progress, per-port choice, resume, failed sections; storage warning; logout cleanup; test that every must-work screen reads from the pack. | Area 4 to A |
| **R5** | One party hub | G-06 | Party becomes a labelled destination; one invite sheet (link, QR, email, `navigator.share`); per-person permission sheet; party picker in dining and excursion booking; wire a decided chat poll to a booking request. | Area 2, 9 |
| **R6** | Meet and find | G-07 (named place only), G-11 | Named-place sharing with expiry; step-free routing and "route to my next event"; map pin in place cards. Device location is parked (section 6). | Areas 2, 11 |
| **R7** | Provenance and support | G-01, G-12 | Server `provenance` on every record (confirmed, sample, pending); front-end badge; service-notice banner; screenshot attach with redaction; "who will answer" on cases. | Areas 1, 14, 5.2 |
| **R8** | Measure and walk | G-10, G-15 | Task-funnel events and a baseline script; run the release-scorecard Walk rows; fix what the walk finds. | Everything to A+ |

Order reasoning: R1 and R2 are cheap and hit the loudest complaints. R3 and R4 are the two largest passenger-visible wins (one view, offline). R5 and R6 are the biggest builds and depend on R2's party picker work and R3's Voyage. R7 is small but should land before any external demo. R8 is last because walks should test finished work, but **start booking R8's device sessions now** since they depend on people and dates.

## 6. Decisions (answered 2026-11-23)

1. **Location (R6): not yet.** Build named-place sharing only ("I'm at the Piazza until 6 pm"). Device location sharing is out of scope until the owner reopens it. G-07's second step is parked.
2. **Navigation names: keep Home / Plan / Ship / Chat / Me.** Surface **Party** inside the Plan and Chat headers instead of renaming tabs.
3. **IndexedDB: deferred.** Do not migrate the saved-copy format now. R4 builds the download pack on the current storage and only revisits IndexedDB if the pack outgrows localStorage.
4. **Sample-data label: yes.** A visible "sample data" label is acceptable in pilot screenshots (R7 proceeds as planned).

Effect on the plan: R6 shrinks to named-place sharing, step-free routing, "route to my next event" and the map pin. R4 drops the IndexedDB module.

## 7. What I am least sure about

- Every (†) row (about 60 of them).
- Whether the party features I found in chat (QR, boards, polls) are easy to discover. I judged by routes, not by walking them.
- Dining eligibility: `src/domain/dining.ts` has no such logic, but the server (`DiningRules.cs`) may hold it. I did not read it.
- Server-side items from the old gap analysis (ACT-01 sign-up and recovery, SEC-03 purge). That doc is dated 2026-11-01; some may be closed since.
