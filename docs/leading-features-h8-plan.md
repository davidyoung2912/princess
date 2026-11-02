# H8 mini-plan: finish the leading-features requirements without a server

Status: **Plan accepted; slice 0 (audit) in progress.** Companion to `docs/leading-features-requirements.md` and `docs/leading-features-plan.md` (which stays the record of what is built).

## Rules for H8

- Same as H1 to H7: front end only, state per person on the device behind small stores, simulated feeds as pure functions with a `source` field, no REST contract changes, offer restraint (UX-02) and the two-tap rule (UX-01) bind everything, anything unprompted counts against the nudge budget.
- Verify with `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` only. No browser testing, no `dotnet test`.
- Build in slices. Commit and stop after each slice; the next starts only when asked.
- Each slice ends with a "Not done" list in the plan doc, one promise test in `src/h8Promises.test.ts`, and the status header refreshed.

## Out of scope for H8 (needs a server, a feed or a person)

Real shared state across devices (shared ticking, group polls across phones, family links opening on other devices, caregiver's own view), real contact exchange or "sail again" groups, a hosted calendar feed, real callbacks, the medical-centre notice, link-previewable invites, XA-10's key proxy, real flight/traffic/weather/crowd/hurricane feeds, recorded audio, photos supplied by guests or the ship (S1-06, XG-05, bag photos), XT-09 and S1-09 advisor links, S3-09 and S3-10 (directory and cabin-mate matching need moderation), S6-11 meet people (same). Where a feature has a useful single-device version (for example a group poll the organiser runs on one phone), it is built that way and labelled so.

## Slice 0: audit (small, no feature code)

The plan says several backlog items "may already be covered", and the requirements doc's own "Builds on" column was never a code audit. Before building, sweep every ID in the requirements doc against `src` and write one status table (built, partly, not built, blocked) into the plan doc. This sets the real size of slices A to D and stops us rebuilding things like S6-22 (journal), S6-16 (cabin button in `calm.ts`), S4-08 (`tripCost`), S6A-08 to S6A-10 (`portContent.ts`), S2-02 (`whatIf.ts`) and S2-10 (checkout drafts). Also covers IDs the plan backlog never lists: S1-09, S2-07, S2-09, S3-09 to S3-14, S6-03, S6-07, S6-08, S7-01 to S7-10, XI-06 to XI-11, XT-08.

Output: a table in `docs/leading-features-plan.md`, plus a corrected backlog list. No commit of code.

## Slice A: booking and preparation (S2, S3, S0)

All pure domain plus one small store each.

| ID | Build |
| --- | --- |
| S2-02 | Price-drop watch on a simulated fare history: shows whether re-pricing is allowed, the steps and the saving; "ask a person" goes through existing Contact us |
| S2-03 | Short free hold: 48 hour hold on the device, plain countdown on that screen only, lapses in words, no fake urgency elsewhere (checked by the dark-pattern test) |
| S2-06 | Accessibility-first profile captured once (mobility, hearing, vision, sensory, device, service animal, companion) and read by cabin chooser, dining, excursions and disembark |
| S2-08 | One-page trip contract: booking, paid, not paid, rules, deadlines, contact; read aloud and print |
| S2-10 | Draft-safe checkout and a "continue where you stopped" Home card (audit first) |
| S3-01 | Per-person readiness (decision needed: how checklist and papers combine; suggest weighted by deadline, papers first) |
| S3-03 | Weekly companion: one note per week from 8 weeks out, hard cap of one a week, off in one tap, counted in the nudge budget |
| S3-06 | Packing for this ship: prohibited items, outlets, dress nights on top of `packing.ts` |
| S3-13 | Allergy pre-flag with a simulated galley acknowledgement shown as a status (feeds XI-09) |
| S0-07 (partial) | Paste a plan from an outside assistant, parse into a draft the guest confirms |
| S0-09, S0-08 | Occasion starter and authored day stories by persona |

## Slice B: planning and groups on one device (S4, S0, XG)

| ID | Build |
| --- | --- |
| S4-03 | Honest difficulty (distance, steps, heat, shade, seats, restrooms, wet footing) authored per excursion, matched to the mobility profile |
| S4-04 | Independent vs ship excursion comparator: cost, risk, flexibility, what happens if late |
| S4-05, S0-06 | Group poll and dream board run on one device (organiser passes the phone, or enters votes); shared copy is a "Not done" |
| S4-06 | Surprise mode: hidden items excluded from any shared itinerary or family page; tested like the family-page field list |
| S4-07 and XA-07 | One explainable taste profile and "visible brain" store: every inference listed, deletable, global off. Build once, used by both |
| S4-08 | Budget bar with notes at 80 and 100 percent over `tripCost` |
| S4-09 | Child brief entered once, shared only with the right club (in the display, not sent) |
| S4-10 | Rhythm profile (Could) feeding Autopilot and the week optimiser |
| XG-01, XG-02, XG-07 | Organiser dashboard, per-person privacy defaults (safest) and multi-cabin shared day, all from the existing `party` store |
| XG-04 | Family traditions checklist that carries into the seeded next trip |
| S4-02 follow-up | Week optimiser applies a week in one tap through the existing change rule (listed as not done in H5) |

## Slice C: on board (S6)

| ID | Build |
| --- | --- |
| S6-09 | Seasickness first aid (calmest places from `cabinScore`, what helps, when to see the doctor, one-tap request) |
| S6-10 | Lounger fair-use: a timed hold, a visible "returns in X minutes", report an abandoned hold (single device, simulated board) |
| S6-13 | Kids' daily report: simulated club summary, parent consent first |
| S6-14, S6-15, S6-17 | Teen agreement, caregiver "I'm OK" tap, solo-safety timer; reminders in-page only, nothing sent (stated plainly) |
| S6-16 | Audit `calm.ts`; extend the cabin button with a words-only route if missing |
| S6-18 | Do-not-disturb schedules over `notifications.ts` and the nudge budget, critical notices always through |
| S6-19, S6-20, S6-21, S6-25 | "You said, we did" board (authored), dining favourites and table preferences, step and deck-lap challenge, lost and found with a local report and an authored found list |
| S6-08 | Sightings log (Could, authored and simulated) |

## Slice D: ports, trust and assistant leftovers

| ID | Build |
| --- | --- |
| S6A-08 to S6A-10, S6A-14 | Audit against `portContent.ts` and the port store; add what is missing (local-law notes, don't-bring-it-back, walk text), port snapshot as text only |
| XI-06 to XI-11 | Audio wayfinding and read-aloud (speech synthesis), captions and visual alerts, safe-ashore notes, allergy confidence chain, bereavement wording, anxiety toolkit; subject to the audit |
| XA-08 | Voice mode on Web Speech where supported, same confirm rule (Could) |
| XA-10 (client part) | Per-session request cap and graceful fallback to the scripted concierge; the key proxy stays out |
| XA assistant | Actions beyond the day plan (request an item, add an excursion) through `planChange`'s propose, confirm, undo rule; assistant inside the existing concierge chat |
| Nudge wiring | Briefing, Autopilot proposals, storm notice and back-aboard nudge as Home cards that spend the nudge budget |
| S8-09 to S8-12 | Re-check the four "covered earlier" items against the requirement text and fix gaps |

## Order and sizing

1. Slice 0 (audit): small. Do first; it may remove a third of A to D.
2. Slice A: medium. Highest value (money, trust, preparation).
3. Slice C: large; split into two commits if it runs long.
4. Slice B: medium.
5. Slice D: medium. Depends on the audit and on the nudge budget from H1.

## Decisions (accepted)

1. S3-01: one per-person number, weighted by deadline, papers first.
2. One-device group features (poll, dream board, lounger board, lost and found) are acceptable when clearly labelled single-device, with the shared copy listed as not done.
3. Reminder-only safety features (S6-15, S6-17) are acceptable if the screen says plainly that nothing is sent to anyone.
