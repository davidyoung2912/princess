# Best-in-market plan (BM)

Status: **Written 2026-11-08. Phases BM1 to BM7 are built (BM7 server only, not compiled or run here). BM2's matrix (`docs/best-in-market-matrix.md`) changes BM3 and BM5; see its Findings section.** Source: `docs/princess_cruises_expanded_best_in_market_requirements.md` (the "OpenAI document", dated 2026-11-07), checked against the code as it stands.

## 1. How this was done, and how far to trust it

- The document was read in full. Its 187 stage requirements, 25 phone requirements, 22 quality-of-life concepts and cross-stage foundations were **not** checked one by one. I probed the highest-priority ones by searching `src`, `server` and `db` for the routes, modules and tables that would have to exist, and by reading the files found.
- "Exists" below means a screen, module and test were found. It does not mean the screen was tried on a device (project rule: no browser testing) or that the server behind it is a real provider.
- The document itself says (decision 12 and appendix C) that a verified implementation baseline is needed before backlog grooming. Section 3 is the start of one.

## 2. What I recommend

### Already built, so do not rebuild

The document's five strategic bets and most of its P0 list match work this project has finished, in some cases under other names. Probed and found:

| Document item | Where it is here |
| --- | --- |
| Trust ledger, receipts, states (QOL-03, TRU-01 to 03) | `/me/ledger`, `/me/history`, `/me/activity`, `src/domain/ledgerSplit.ts`, server audit trail (`docs/audit-trail.md`) |
| Idempotent payments and safe retry (BOK-09, TRU-04) | server idempotency (8 files); client outbox `src/data/outbox.ts` |
| Service request and case lifecycle (SEA-20, DEB-05, DEB-11, DEB-14, QOL-22) | `/ship/requests`, `/me/cases` (lost item, claim, billing dispute with the folio line), `/ship/lost-found`, `src/ui/finish/CasesScreen.tsx` |
| Helper access (MNG-07) | `/me/helper` |
| Three clocks, return time budget (POR-02, POR-06, QOL-11, QOL-21) | `src/ui/ThreeClocks.tsx`, `src/domain/clockView.ts`, `allaboard.ts`, `tender.ts`, `PortPilot` |
| Allergy handoff, never "safe" (PRE-16, SEA-19, QOL-09) | `/plan/allergy`, allergy strings in 49 client and 22 server files |
| Rendezvous without tracking (QOL-08, EMB-10, POR-13) | `src/domain/arrivalPing.ts`, `meetingPoint.ts` |
| Voyage Autopilot, conflicts, what-if, storm replan (QOL-01, QOL-15, PRE-02) | `/plan/autopilot`, `/plan/what-if`, `/plan/storm`, `src/domain/autopilot.ts` |
| Group board, poll, shares, revocable links (DRM-14, DRM-15, PRE-13, QOL-07) | `GroupBoard`, `/plan/group-poll`, `/plan/share-links`, `/shared/:token` |
| Compare sailings and ships, cabin chooser, price watch (DSC-01, DSC-04, DRM-16) | `/home/saved/compare`, `/home/ships/compare`, `/home/cabins`, `/plan/price-watch` |
| Wake lock, calm mode, quiet hours, notifications centre (MOB-11, COM-05) | `useWakeLock`, `domain/calm.ts`, `NotificationsScreen` |
| Per-screen saved copies with age (OFF-03, TRU-06) | `src/hooks/useSavedCopy.ts`, `src/domain/offlineCache.ts`, enforced by `src/offlineDay.test.ts` |
| One assistant, deterministic answers first (QOL-14, AST-03) | `src/domain/answerCards.ts`, `src/ai/` (Stanley) |

### Real gaps worth doing

| # | Gap | Document IDs | Why it is worth it |
| --- | --- | --- | --- |
| 1 | No place that shows what is saved on the phone, how old, how big, when it stops being trusted, or whether the browser will keep it | MOB-03, MOB-04, OFF-07, QOL-04, GTS-15 | The document's second-ranked differentiator and a P0. Copies exist per screen; the guest cannot see or test them. **Built in BM1.** |
| 2 | Night-before readiness test that goes beyond the roaming checklist (pass saved, login valid, battery advice, maps cached) | GTS-15, MOB-02 | BM1 supplies the data; the test is a small follow-on. |
| 3 | Update never interrupts a critical task | MOB-02 | `UpdateBanner` exists; check that it is held back on pass, muster, pay. |
| 4 | Ship Wi-Fi boundary and low-data mode | EMB-11, SEA-25, MOB-24 | Largely built: `saveDataRequested` in `src/settings/settings.ts` reads the browser's save-data signal (`docs/gap-analysis-plan.md` still lists NET-04 as open; that list is stale). Check battery-aware refresh only. |
| 5 | Voyage Time Intelligence as one tested service with DST and date-line cases | QOL-21, POR-02 | Clocks exist; the document asks for explicit DST and date-line tests. Check coverage. |
| 6 | Traceability: no ID-by-ID matrix against this document | Appendix B | Needed so later phases do not re-derive this table. |
| 7 | Add-to-calendar with correct zone and cancel/update ids | MOB-15 | `src/domain/calendar.ts` exists; verify update and cancel semantics. |
| 8 | Stage-aware Home tiles already exist; the document's "Right Now" card (SEA-01) should be checked for "labelled, not inferred" data | SEA-01 | Probably done; confirm. |

### Deliberately not doing

- **IndexedDB migration** (MOB-04). Saved copies are small keyed JSON in `localStorage`, and the real durability risk is eviction, which BM1 now surfaces and mitigates with a persistence request. Revisit only if copies grow past what `localStorage` holds (the capsule card shows the size).
- **Wallet passes, Web NFC and Bluetooth, room controls, face grouping, AR, crowd prediction** (MOB-16, SEA-21, QOL-06): need providers or hardware this project cannot reach, or are gated by the document itself.
- **Camera passport scan, OCR** (BOK-03): already listed as open and needing a device in `docs/gap-analysis-plan.md`.
- **A second front-end data store or a mock mode.** Project rule.
- **Anything the document labels P3 or "exploratory".**

## 3. Baseline: what I could not confirm

These are items the document marks P0 where I found no clear match and did not dig further. They are the first things to check in BM2:

- IDN-04 and IDN-05: the distinct relationship types (household, booking party, cabin party, linked group, helper, shipmate) and per-task permissions. Party, family link and helper exist; whether they share one permission model is unchecked.
- TRU-07: an operational status centre. `/me/status` exists; its content is unchecked.
- MNG-03: sync state as current, stale, pending, unavailable or not linked. `SyncChip` and `useSyncStatus` exist; whether "not linked" is distinct from "no cruise" is unchecked.
- COM-04: acknowledged delivery of critical alerts with a fallback channel. Email and SMS are still simulated (`docs/gap-analysis-plan.md` NOT-01).
- A11Y-07, EMB-03, GTS-14: depend on research sessions and safety sign-off, not code.

## 4. Phases

Each phase is small enough to finish, check and commit on its own. Checks are only `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build`.

### BM1. Offline Capsule on the phone screen (built, not committed)

- **Logic**: `src/domain/offlineCapsule.ts` (what is kept, per kind: age, size, expiry, state fresh/ageing/expired; readiness ready/partial/empty from the three essentials: boarding pass, muster, emergency card; storage state protected/unprotected/low/unknown). Tests: `src/domain/offlineCapsule.test.ts` (11 cases).
- **Storage access**: `src/data/capsule.ts` (kept in `src/data/` because `src/auditGate.test.ts` limits where `localStorage` may be read), `src/hooks/useCapsule.ts`.
- **Screen**: `src/ui/plan/CapsuleCard.tsx` on `/plan/phone`: missing essentials with an "Open to save" link, one row per saved copy, "Check now", "Ask the browser to keep them", and the crew-override line (OFF-03). No new route, so the screen registry is unchanged.
- **Not done**: no device test (rule); expiry uses the existing per-kind limits in `offlineCache.ts` and the phone's own time zone; the card reads copies but does not fetch them (a copy is saved when its screen is opened with a signal).

### BM2. Verified baseline matrix (built, not committed)

Done: `docs/best-in-market-matrix.md`, 292 rows, 15 read and 277 found by name or search. Findings: IDN-04/05 and IDN-03 are real gaps; `/me/status` reads client demo scenarios; COM-04 is not built; MOB-02 is already met; BM3 and BM5 should be reshaped as the matrix says.

Original scope:

Write `docs/best-in-market-matrix.md`: every document ID (187 + 25 + 22 + cross-stage) as built, partial, mock, planned or not planned, with the file and test that prove it, in the style of `docs/a-tier-matrix.md`. Settle section 3 above. Doc only plus any one-line fixes found. This sets the real size of the remaining work.

### BM3. Readiness (built, not committed)

- **Night-before test (GTS-15)**: `src/domain/nightBefore.ts` (`nightBeforeTest`: essentials saved, copies fresh, storage protected, notifications on, battery; worst result wins). Button "Run the night-before test" on the Offline Capsule card. Tests: `src/domain/nightBefore.test.ts`.
- **Battery-aware refresh (MOB-24)**: `refreshFactor` doubles the wait between refreshes on a low battery that is not charging (stacks with data-light's x4); `src/data/battery.ts` follows `getBattery` where the browser has it (Chromium only); applied in `useVisibleInterval`. The battery is read when an interval starts, so a change mid-screen applies from the next screen.
- **Dropped**: update-hold (MOB-02 is met by design, see the matrix).
- **Not done, moved on**: guest-chosen capsule download (MOB-03) and local reminder fallback (MOB-23). Both need a fetch/schedule design and are proposed for a later phase. The test result is not stored (the audit gate limits `localStorage`), so "last test" shows only for the visit.

### BM4. Time and calendar proof (built, not committed)

- **Time tests**: `src/domain/timeIntelligence.test.ts` (23- and 25-hour days, skipped times, offset change across a clock change, Cancun vs Chicago gap, date line, Samoa's skipped day, half-hour zones, port clock at sea, date arithmetic edges).
- **Bug found and fixed**: `zonedToEpoch` put a wall time skipped by spring-forward (02:30 on 14 March) an hour *before* the change, against its own doc comment. It now lands just after.
- **Calendar (MOB-15)**: `IcsEvent` gains `sequence` (written as `SEQUENCE`, default 0) and `cancelled` (`STATUS:CANCELLED`; a file of only cancelled events is `METHOD:CANCEL`). Uids were already stable per booking item. Tests: `src/domain/calendar.test.ts`.
- **Not done**: no caller sends a higher sequence or a cancel yet; that needs the booking-change flow to know the previous version.

### BM5. Permissions model check (built, not committed)

- **Logic**: `src/domain/access.ts` reads the three separate models (helper, family-at-home links, travel party invitations and sharing switches) into one list of rows: who, kind, on/waiting/off, what they can see or do, when it stops by itself, and the screen that changes it. Tests: `src/domain/access.test.ts`.
- **Screen (IDN-07)**: a "Who can see what" card on `/me/helper` (`HelperScreen.tsx`), with a Change link per row. No new route, so the screen registry is unchanged.
- **Finding kept**: the models are still three; they share no relationship type or permission set (IDN-04), and the helper still has only view, documents, payments and profile (IDN-05). Adding check-in, edit-booking, folio, message and location permissions changes the server contract and the `Helper` table, so it is its own phase (suggested BM6) and needs your approval.
- **Not done**: no shipmate or household relationship type; IDN-03 (from the BM2 note) is not part of this phase.

### BM6. Helper permissions, honestly (built, not committed)

- **Finding**: only Documents and Profile are enforced on the server (`SubjectAccess`). `HelperPermission.Payments` is in the enum but no endpoint checks it, and `PaymentsAsync` / `PayBalanceAsync` (`TripService.cs`) require the caller to be a guest on the booking, so a helper cannot reach a guest's booking at all. There are no helper paths for check-in, edit-booking, folio or messages either.
- **Change (front end only)**: `NOT_YET` / `permissionWorks` in `src/domain/account.ts`. On `/me/helper` the Payments choice is shown off and disabled with "Not available yet", is never saved, and is left out of the active helper card and the "who can see what" list. Test in `src/domain/access.test.ts`.
- **Not done, needs a design and your approval (BM7)**: a server path for a helper onto a guest's booking: look up by grant, charge the guest's saved card, record who paid on the receipt and in history, a read-only folio permission, and C# tests. Check-in, booking and message permissions follow the same pattern. A shared relationship type (IDN-04) comes after that. Location is deliberately never a permission.

### BM7. Helper pays a guest's balance (built server side, not committed, not compiled)

- **Endpoint**: `POST /api/v1/guests/{guestId}/bookings/{number}/payments/balance` (`TripService.PayBalanceForGuestAsync`). Goes through `SubjectAccess.ResolveAsync(..., HelperPermission.Payments, write: true)`, so it needs a live grant with `view` and `payments`. No grant is notFound, a grant without Payments is forbidden. A booker or party member is refused here and uses the normal endpoint. Supervised helpers are refused.
- **Money**: the guest's saved card is used (the helper names it by id and sees brand and last four only). The owner of the booking and card stays the guest; `Payments.UserId` is the helper (who paid) and `RelatedType = 'helper'` marks it, so no schema change. The charge logic is shared with the guest's own path (`PayAsync`).
- **Record**: the receipt method reads "Visa ending 4242, paid by your helper"; history is written for the guest (by the helper) and for the helper.
- **Tests written, not run** (rule: no dotnet test): three cases in `TripsAndPaymentsApiTests.cs` (helper pays and is recorded, missing payments or view is refused with nothing charged, stranger gets notFound), the swagger coverage list, and the in-memory fake carries `RelatedType`. Run them once yourself before relying on this.
- **Front end deliberately unchanged**: Payments stays "Not available yet" on `/me/helper` because no screen lets a helper act on a guest's booking. That screen (BM8), then folio (read-only), check-in, booking and message permissions, then a shared relationship type (IDN-04). Location is never a permission.

## 5. Decisions I need from you

1. Approve BM2 next, or choose another from BM3 to BM5?
2. The document's roadmap puts "real provider" work (email and SMS delivery, flights, tender feed) late. This project already mocks them behind interfaces, so I would not start them until you pick a sender.
