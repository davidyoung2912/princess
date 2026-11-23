# Stanley launch checklist (P12 and reminders R13)

Run this before each gate (G1 to G4 in `stanley-actions-and-proactive-plan.md` section 27.2) and before any change of level, class or rollout percent. The code can check part of it; a person has to do the rest. Record the date, the build and the name of who ran each row. Nothing here is signed off yet.

## 1. Automated (run with `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`)

| Check | Where |
|---|---|
| No "AI" word, no web link, no placeholder or stray spacing, no guarantee wording in reminders, across every Stanley and reminder string (D1, AC-X-01, AC-X-02, decision 19) | `src/features/stanley/logic/stanleyHardening.test.ts` |
| No secret, debugger or console output in a Stanley source file | `src/features/stanley/logic/stanleyHardening.test.ts` |
| Markup faults on every Stanley screen (names, alt text, keyboard reach, dialogs, live regions, reduced motion) | `src/features/stanley/logic/stanleyAccessibility.test.ts` |
| Release gates: no unconfirmed mutating action, no cross-party leak, no unsupported critical claim | `src/gates/releaseGates.test.ts` |
| Classifier invariants, scheduler, switches, permissions (server; **targeted runs by the owner, never a full `dotnet test`**) | `StanleyClassifierTests`, `StanleySchedulerTests`, `StanleySwitchTests`, `StanleyPermissionTests` |

## 2. Manual accessibility pass (target: zero blockers; AC-R13-01; measure "Manual accessibility pass")

Use a real phone and a desktop. Screen readers: VoiceOver on iPhone, TalkBack on Android, NVDA or Narrator on desktop. Zoom: 200% browser zoom and the largest system text.

- [ ] Welcome page and the ten-row checklist: every row has a name, state and result read aloud; level choice never pre-selects 3 or 4.
- [ ] Step-up (emailed code) and the confirm preview: focus lands in the dialog, stays in it, Escape closes it, focus returns to the button.
- [ ] Action cards, receipts and Undo: the result is announced once, not twice.
- [ ] Autopilot, Reminders, activity and guardian screens: reading order matches the visual order.
- [ ] 200% zoom: nothing is cut off, no sideways scrolling, no overlap with the bottom bar or the notch.
- [ ] Reduced motion on: nothing moves on its own.
- [ ] Keyboard only on desktop: every control reachable, visible focus, no trap.
- [ ] Voice button: starts only when pressed; stops when pressed again.

## 3. Privacy and legal review of the final wording

Owner of the review is not named yet (plan section 10.3, question 1). Give the reviewer the strings under the keys `stanleyAuthority.*`, `stanleyIntro.*`, `stanleyReminders.*`, `stanleyAuto*.*`, `autopilot.*`, `rem13.*`, plus the explainer and trust pages.

- [ ] Consent wording for levels 3 and 4 (G1, G3).
- [ ] The "reminders are an aid, never a replacement" line, and any compensation rule (decision 19).
- [ ] Retention: ledger and reminder detail 90 days after disembark (D22; confirm with the policy).
- [ ] Children and guardian copies, helper copies (never private), group reminders.
- [ ] Private text appears in no push body, email, SMS, feed or log (AC-R7-01).

## 4. Soak and cost report (G3)

The owner builds and runs these on the server, targeted tests only.

- [ ] Run the scheduler against an injected clock over a full simulated sailing for a cohort: duplicates zero, missed fires zero, nothing fires after its stop condition.
- [ ] 4,000-guest burst: class A pushed within 10 seconds for 95%.
- [ ] Model calls and cost per guest per trip, by level, read from the operations screen (`GET /me/stanley/tiers`): within the daily ceiling; at least 60% of replies with no model call; under 10% on the large tier.

## 5. Chaos and red team

- [ ] Turn each switch off in turn (`Model`, `Tools`, `Resolver`, `Library`, `Actions`, `Handoff`, `Changes`, `Money`): the safety screen, written help and booking, payment and check-in still work.
- [ ] Break the model provider, the push provider and the database connection mid-run: the guest sees a calm message, nothing is applied twice, queued confirms re-validate on reconnect.
- [ ] Offline at sea: missed firings show their true times with "Late"; no blind apply.
- [ ] Red team: prompt injection (add every hit to `src/features/stanley/logic/eval/injection.json`), asking Stanley to raise his own level, to spend money, to act for another adult, to reveal another traveller's data, to repeat a private reminder.
- [ ] Any S1 or S2 found halts the gate.

## 6. S1 rehearsal (AC-R13-02; G3)

Game day with a stand-in incident (for example, a wrong all-aboard time sent to a cohort), following `docs/runbook.md` "Stanley incident playbook":

- [ ] Two people complete the global pause (it needs two and is recorded).
- [ ] The correction notice reaches every affected guest on the list.
- [ ] The post-incident note is filed.
- [ ] Total time recorded: ______ (target set by the owner; none is named yet).

## 7. Support training (before G2)

- [ ] Guest Services read the one-page playbook (plan section 20.3) and walk through the three test plans.
- [ ] Each agent can find "what did Stanley do" in under 2 minutes (target; over 5 is a review).
- [ ] Each agent can undo for a guest on the phone, pause a class, and file a defect with the rule id.
- [ ] Training line learned: "I can see what the assistant did and I can undo it. Tell me what you would like."

## 8. Section 9 measures to read at the gate

Read the figures against the targets in plan section 9 and reminders section 27. Any "halts the next gate" row (circuit breaker pauses, S1 or S2, duplicate or missed fires, private text in an output channel) stops the gate until fixed. Measures that need real guests (research R1 and R3, canary abandon and undo rates) cannot be produced by this repository.
