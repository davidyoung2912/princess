# Stanley data inventory

Written for phase 4 of `docs/stanley-gap-analysis-and-plan.md`. It lists every field Stanley may read or send, why, who the provider is and how long it is kept. Anything not listed here is not available to a model. Update this file in the same change as any new field or tool.

| Data | Fields | Purpose | Provider | Retention |
|---|---|---|---|---|
| Context packet | opaque guest reference (keyed hash of the public id, 13 characters), role, stage, screen id, active sailing id, allowed facts, allowed tools | Route the question and bound what a tool may read | This server builds it; the model provider sees only the reference | Not stored; rebuilt on every request |
| Voyage | sailing id, departure date, ship name, nights | Which trip the answer is about | Server (booking store) | Not stored by Stanley |
| Travellers | reference (t1, t2), first name, age, supervised flag, relationship to the guest | Answer for the right people and enforce the party and child rules | Server (booking party) | Not stored by Stanley; surname, date of birth, citizenship, documents, contact details and payment data never leave the server |
| Plan | tours (catalogue id, day, who), dinners (venue, day, time, who), active packages (item, units, who) | Plan questions, conflict checks, package value | Server (plan store) | Not stored by Stanley |
| Cases | case number, kind, stage, outcome word, due date, who opened it | Case status | Server (case store); the stage is worked out from the clock | Not stored by Stanley; shown only to the guest, a booker and a guardian, or a helper with the folio permission |
| Published facts | venue directory and hours, itinerary, all-aboard times, package prices | Venue, schedule, route and value answers | Server content files | Versioned with `StanleyRules.ContentVersion` |
| Message text | the guest's messages in the current thread (the latest 10 clean round trips) | The answer itself | Sent to the model provider (Anthropic) for the request | Not stored on the server. The thread stays on the device. The tier log keeps counts, tiers and tokens only |
| Tier log | time, tier, source, stage, topic word, outcome, model tier, call and token counts | Quality and cost | Server database | Counts only, no message text, no guest |
| Prepared actions and receipts | the typed intent (item and quantity, excursion id, table and new time, a drafted case's text, a plan change's item id, a reminder's time and text), the preview text, status, expiry, idempotency key, effect reference, receipt number, times | Show a preview, confirm it once, undo it for two hours, list receipts in the ledger | Server database (`dbo.StanleyActions`), owned by the guest; deleted with the account | Deleted by the retention job after `Retention:StanleyDays` (180) days, unconfirmed previews after a day. Never the chat messages. The audit trail keeps only action name, kind and outcome |
| Human handoff cases | the topic, the text the guest saw and agreed to send (issue, wanted outcome, what was tried), the booking number, an approved attachment note, a case reference, the time | Open a case with Guest Services and show its owner, status and next update | Server database (`dbo.StanleyHandoffs`), owned by the guest; deleted with the account | Deleted by the retention job after `Retention:StanleyDays` (180) days. Sent only after the guest ticks consent; the audit trail keeps only topic and reference |
| Remembered preferences | kind and value from a fixed list (pace, wake, interest, dining, mobility, diet), scope (this trip with its sailing id, or future trips), source (told, quiz, plan, carried), whether a sensitive item may be used in answers, the time | Show the guest what Stanley keeps and why, and tailor suggestions | Server database (`dbo.StanleyMemory`, `dbo.StanleyMemorySettings`), owned by the guest alone; deleted with the account | Kept until the guest forgets it (one item or everything) or deletes the account; not aged out. Forgetting deletes the row. Only the guest's own items ever enter the guest's packet. Mobility and diet reach a model only when the guest switched that item on; memory off means none is sent. A child account keeps none. The audit trail keeps the action and the kind, never the value |
| Tool log | tool name, refused or ok, opaque guest reference | Prove every tool call happened and was checked | Server application log | Follows the application log retention; never the input or the answer |

## What Stanley may do (phase P0a)

| Data | Fields | Purpose | Provider | Retention |
|---|---|---|---|---|
| Permissions | level (1 to 4), the rows the guest changed by hand (CL-01 to CL-10, on or off), paused until | Decide which unprompted Stanley steps are allowed; the one check is `StanleyPermissionService.MayAsync` | Server (person state document `stanleyPermissions`) | Account life; no free text |
| Consent history | ability, state, wording version, source (welcome, settings, stage), time | Show what the guest agreed to and which wording | Server (person state document `stanleyConsent`, last 200 lines) | Account life; never any text the guest typed |
| Step-up | code hash and expiry (HMAC under a key from the signing key), token hash and expiry | Confirm it is the guest before Stanley is given more to do | Server (person state document `stanleyStepUp`); the code is emailed to the address on the account | Code 10 minutes, token 10 minutes and single use |

## What Stanley did (phase P1)

| Data | Fields | Purpose | Provider | Retention |
|---|---|---|---|---|
| Ledger | None of its own: a view (`GET /me/stanley/ledger`) over the action store rows that were done, failed, pending or undone. Each receipt shows kind, status, time, title, who it affects, who prepared it (a helper's name), the undo window and a receipt number, and the six fields are worded by the server from those | Show, explain, undo and stop what Stanley did | Server (the existing action store, `Providers:StanleyLog`) | As the action store today. **Open:** the plan's "detail for 90 days after disembark, then counters only" is not yet enforced; confirm the policy and add the purge before launch |
| Watching and Remembers | Read from the permissions document (rows switched on) and the memory store (items and why) | Show them beside the receipts, each with its own stop | Server | As those stores |

Nothing the guest typed is stored in the ledger. Undo goes through the existing undo, so the same window, checks and audit lines (`stanley.action.undo`) apply.

Decision: the plan's tables (`StanleyPermissions`, `StanleyConsentLog`) are held as person state documents for now, which the server already keeps with versioned saves; move them to tables when the ledger (P1) needs queries across guests.

## Rules the tools keep

- A tool that reads a traveller checks the guest's access to that traveller on every call (`StanleyPacket.Resolve`), from facts the server read, never from the request. A traveller who may not be read and one who does not exist get the same answer.
- A supervised child sees only their own plan. A guardian sees the child they booked. The booker sees the party's plans and cases. Another adult sees the shared plan only. A helper sees the plan with the trip permission and cases with the folio permission, and only while the grant is live. Revoked, pending and expired grants reach nothing.
- All read tools are read-only. None books, pays, cancels, sends or changes anything.
- The one tool that can lead to a change, `propose_action`, only makes a stored preview. The server changes something only on a confirm for a preview it made, from the same guest, not expired, with the price and availability unchanged, through the same service the screen uses. Paying, cancelling a booking, changing a cabin and sharing data are not actions and are refused with where the guest can do them.
- A tool call is one step of the model loop, so it counts against the per-request call cap and the daily ceiling.
- With two possible voyages and none named by the device, Stanley asks which trip. It never picks one.

## Decision record: provider retention and training terms (AI-SEC-07)

Decided 2026-11-09 for phase 7. Stanley uses one provider, Anthropic, through the commercial API (decision 6 of the plan), behind the model interface so another can replace it.

- **What the provider receives per request:** the guest's recent messages, the instructions, the context packet (opaque guest reference, first names and ages of travellers the guest may read, plan facts, and any remembered preferences the guest left switched on) and tool results. Never an account number, email, surname, date of birth, booking number, cabin number, document or payment data.
- **Training:** the requirement is that content sent through the API is not used to train models. This is the provider's commercial-API default; the owner must confirm it against the signed agreement before real guests use Stanley, and a provider that cannot meet it is not used.
- **Retention at the provider:** the requirement is the shortest the agreement allows, with zero retention where it can be had. The owner records the agreed period here when it is confirmed. Until then the product assumes the provider may keep requests for abuse monitoring for a limited time and says nothing stronger to guests.
- **What we keep:** counts only in the tier log; remembered preferences until the guest forgets them; actions and handoffs for `Retention:StanleyDays`. The chat thread is not stored on the server.
- **A guest's controls:** memory off (nothing remembered is sent), forget one item or all, and mobility and diet off by default.
- **Open:** the agreed retention period and a copy of the confirmation. This is a decision for the business, not something the code can settle.

## Decision brief (phase 8)

`dbo.StanleyBriefs` holds one JSON row per guest: the wish text (at most 500 characters), the edited filters, up to five shortlisted sailing ids, the weights, and optional needs. It is read and written only for the signed-in guest, is the same on every device, and is deleted by the guest (`DELETE /me/stanley/discover/brief`) or with the account (cascade). The shared text omits needs unless the guest includes them. The interview, directions, comparison and booking-check calls need no sign-in and store nothing; the audit trail records only that a brief was saved or deleted, never its content.

`dbo.StanleyTravellers` (phase 9 follow-up) holds one JSON row per guest: up to eight named travellers, each with a first name (at most 30 characters), mobility, pace, source (verified, reported, unknown), the date it was checked (verified only), a note (at most 100 characters) and the date it was saved. It is read only for that guest's own planner, never shown to anyone else on the booking, deleted with the account, and not covered by a retention job (kept until the guest forgets the traveller). Poll answers (maybe or no), a poll's made time and closing time travel as `answer` and `poll` rows of the shared port record.

## Travel-day help (phase 10)

Nothing new is stored on the server. The flight, traffic, shore-plan, phrase, port-pack, embark-tour and entry answers are worked out from the guest's saved onward plan and walk-off choice, the provider interfaces and the authored port reference, and are not kept. The only copy is the offline port pack, which the device keeps through the saved-copy loader (the last good answer for that port day) so it opens with no signal. A phrase request the guest types (at most 200 characters) is used to find a reviewed phrase and is not logged or stored.

Phase 10 follow-up: `dbo.PackingEdits` holds the guest's own packing changes per booking: items they added (label of at most 60 characters, and a tick with who ticked) and suggested items they hid. A photo sent for reading is held in memory for the one call and is never stored or logged; a phrase the guest types is used to look for a phrase and is not kept.

## Changes and catch-up (phase 11)

`dbo.StanleyChanges` holds one JSON row per guest: for each change (by its stable id) the fingerprint of the version first noticed, when it was noticed, and the fingerprint of the version the guest dismissed, plus when they last caught up. It holds no trip data: no tour, dinner, flight, case or order is copied into it, only ids such as `portCall:cozumel:3:skipped` or `case:PC-LF-10001:resolved`. It is read and written only for the signed-in guest, is the same on every device, is pruned (a change that has gone is forgotten after 30 days; at most 200 entries) and is deleted with the account (cascade). The cards themselves are worked out on each request from the sources and are not kept. The audit trail is not written to. Which programme events the guest has saved are read from their phone's alert subscription and, when the device sends them, a list of at most 30 event ids; neither is stored here. The per-session count of proactive elements lives in the browser's session storage only (screen to the id shown) and is gone when the visit ends. Since phase 12 the same row also holds one number the guest chose to give, the trip budget in cents (`budgetCents`), used only to compare their spending with it; it is cleared by the guest, and deleted with the row. No spend figure, folio line or loyalty figure is stored: each is read from its own service when asked.

## Reminders: creation, the list and anchors (phase P2a, reminders R1 and R2)

| Data | Fields | Purpose | Provider | Retention |
|---|---|---|---|---|
| `StanleyReminders` (extended) | The guest's own words (80 characters, plain, links removed), the moment (UTC), the **kind** (clock, relative, anchored), for an anchored one the **anchor** (all aboard, or a plan item's id and title, the day of the plan, the time it had, its date) and the **lead** in minutes, the **zone** it was meant in, a **private** flag (health wording: kept, never interpreted or advised on, never for a lock screen), a **state** (scheduled or cancelled) and one **note** line the guest is told once (it moved, or its anchor was dropped) | Send the reminder to the guest's own phones, list and edit it, and follow the plan item or all aboard it is anchored to | Server (SQL Server `dbo.StanleyReminders`); the push sender is still the mock | Removed by the guest at any time; rows are purged once past their moment by the existing retention job. A guest's reminders go with the account |
| `StanleyRuleDue` (new, P2c) | One row per thing that has come due for a guest: the account, a unique **idempotency key**, the due moment (UTC), the **trigger** (time, change, inventory, state), the **class** it belongs to, its rank (safety, money, missed-ship, plan problem, convenience, suggestion), a critical flag, a **subject** (the booking, for the roll-up), a **fact key** (to merge the same fact from two sources), a **state** (pending, claimed, done, held, dropped), a lease (worker and expiry) and a short **reason** (budget, quiet, shipAlert, stale, duplicate, classOff, breaker, failed). **No words of the guest's, no message text** | Let the worker fire things on time with the app closed, once, and in the arbiter's order | Server (SQL Server `dbo.StanleyRuleDue`) | Closed rows (done, held, dropped) are removed a week after their moment; deletes with the account |
| `StanleyBreaker` (new, P2c) | Per class of proactive output: the start of the current window, how many cards it sent in it and until when it is paused. Counters only, no guest data | Pause a class that sends too much, until someone looks | Server (SQL Server `dbo.StanleyBreaker`) | Kept (one row per class, not per guest) |
| Plan as last sent | Titles and times only, as already held for plan changes (`StanleyPlanSnapshots`); now also read to move or end anchored reminders | Follow a moved or dropped plan item | Server | As that table (a day) |

The text of a reminder is only what the guest typed or chose, or the title of a plan item they pointed at. The preview, the receipt and the list say the exact moment with the weekday, date and zone. A reminder never carries a link. The parser is deterministic and runs on the server; no text is sent to a model for reminders in this phase. A request to remind someone else, or to repeat, is refused with the reason.

## Trip check-up, plan lint and deadline radar (phase P3, CHK-01, CHK-02 and CHK-08)

Nothing new is stored. `GET /me/stanley/checkup` works out its answer from data already held for the guest's current or next confirmed trip and returns it without keeping it. The inputs, and what leaves the server:

| Input | Used for | In the answer |
|---|---|---|
| document status per traveller | whether a required document is missing, expired, or a passport too close to expiring | only the finding's words and a route; travellers are "Traveller 2" by position, never a name, number, date of birth or document number |
| payment state and due date | an overdue or coming-due final payment | the due date and a route to Payments; no amount, card or total |
| check-in window | check-in open and not finished, or closing within a day | words and a route |
| booked tours and dinners | a tour ending after or close to all aboard, starting before the ship can be ashore, overlapping another tour or dinner, or a dinner on a late port day | tour or venue name, day and times |
| sailing days and all-aboard times | the same | times |

It is read-only (it never writes, books or changes anything, and a fix is only a screen to open), is for the signed-in guest only, and is not sent to a model. What it cannot see (flights and the travel-day connection, whether names match documents, whether a tour suits a traveller's pace) is listed in the answer as not checked, never reported as all clear. The scheduled run and the permission row CL-01 follow with the briefs and deadline notices phase.

## Classifier flags and the act-or-ask gate (phase P3a)

Nothing new is stored. `StanleyClassifier` computes four flags per item from facts the server already holds: **free** (no cover charge, no ticket or tour price), **fee-free until** (the table or show time, two days before a tour's port day, 24 hours before a spa start, half a stateroom request's usual time), **only me** (no other traveller on the booking) and **reversible until**. `StanleyActGate` reads those flags with the class state (on, paused, practice, daily count, undo window, refusals of this kind, step-up), fact age and source health, overlap with booked items, serious case, ship alert, quiet hours and supervised-child flag, and answers act or ask with reasons from a closed set. It holds ids, times and counts only, never the guest's words, and sends nothing anywhere.

## Operations console (phase P3b)

| Data | Fields | Purpose | Provider | Retention |
|---|---|---|---|---|
| Operator switches | scope (class or global), class id, off or on, the operator's reason (5 to 200 characters), the administrator's public id, time | Let operations stop one class of proactive output, or all of it, without a deploy; the due worker reads them every pass | Server database (`dbo.StanleyOpsSwitch`) | Kept; the latest state per class. No guest data and no guest text |
| Global pause proposal | off, reason, proposing administrator's public id, time | The two-person rule: a global pause applies only when a second administrator asks for it within an hour | Server database (`dbo.StanleyOpsProposal`, at most one row) | Replaced or cleared on every global change; lapses after an hour |
| Console health | per class: counts of scheduled items by state, breaker state and count | Show what the scheduler is doing | Read from the due queue and breaker tables | Not stored; counts only, never a guest |

Every switch, pause and breaker reset writes an audit line (`stanley.ops.*`) with the class and the operator's reason; never any guest field.

## Offline copy on the phone (phase P3c)

| Data | Fields | Purpose | Provider | Retention |
|---|---|---|---|---|
| Reminder copy | the guest's scheduled reminders from a few hours back to a day ahead (text, time, kind, what it follows), and when it was last checked | Show a reminder that came due while the phone was offline, with its true time | The guest's own device (`localStorage`), refreshed from `/me/stanley/reminders` | Replaced on every successful load; cleared with `clearStanleyOffline` |
| Shown ids | reminder ids already shown from the copy (last 100) | Show each once | The guest's device | Kept until cleared |
| Waiting confirms | preview id, the key made for its card, a title, queue and expiry times (at most 10, 30 minutes) | Keep a confirm tapped with no signal; the server checks it again on reconnect and nothing is applied on the phone | The guest's device | Emptied on reconnect; expired entries are reported, never sent |

Nothing here leaves the device except the confirm the guest tapped, sent on reconnect to the same endpoint as a normal confirm.

## Briefs (phase P7, ACT-06 and permission row CL-04)

| Data | Where | What it holds | Retention |
|---|---|---|---|
| Brief choices | the account's state store, key `stanleyBrief` | two on or off flags and two times of day; no text the guest typed | until the guest changes them or the account is deleted |
| Queued briefs | the due queue (`StanleyRuleDue`) | a key of guest, kind (morning or evening) and ship-clock day, the due time and the class `brief`; no content | closed items are purged after 7 days, as for every queued item |
| The brief itself | the guest's Stanley thread (a reminder-lane message, tag `brief:<kind>`) and, when allowed, a phone push | ports, times and the names of tours and dinners the guest booked, and the titles of dates within three days; no names, numbers or document detail | as any thread message; a new brief of the same kind supersedes the last |

Turning a brief on switches the CL-04 row on and writes the usual consent-history line; turning both off switches it off. Nothing is sent without the row, on a paused account, or for a supervised account. No text goes to a model: briefs are composed by code from facts already held.

## Value and bill (phase P6, CHK-04, VAL-01 and CHK-05)

Nothing new is stored. `GET /me/stanley/value` works out its answer from the guest's own onboard bill, package balances and sailing, and returns it without keeping it. Travellers appear only as "Traveller 2" by position.

| Input | Used for | In the answer |
|---|---|---|
| onboard bill lines | a charge that appears twice on the same day, or a drink charged in full to someone whose package covers it | the description, day and amount of that line, and a route to the bill |
| package cover | the drinks cap that decides whether a drink should have been covered | words only |
| excursion credit left | credit still unused in the last two days | the amount left and a route to tours |
| package balances | specialty dinners and Wi-Fi the guest already has and has not used | counts and words; never a price or an offer to buy |
| sailing days and ports | elegant evenings, a tender port and the season, in the fortnight before sailing | words and a route to the packing list |

It is read-only (it never buys, charges, disputes or refunds; a fix is only a screen to open), is for the signed-in guest only, is off for a supervised account and when the money switch is off, and is not sent to a model. What it cannot see (whether a price is right, charges not yet on the account) is listed in the answer.
