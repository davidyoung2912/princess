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

## Bundles and drafts (phase P4, ACT-01 and ACT-03)

Nothing new is stored. `GET /me/stanley/bundle` and `GET /me/stanley/draft` work out their answer from the guest's own sailing, booked tours and booked dinners, and return it without keeping it. The draft text is not stored anywhere and is never sent by Stanley: the guest copies it and sends it themselves.

| Input | Used for | In the answer |
|---|---|---|
| booked tours and dinners | kept as booked in the ordered steps, and checked for overlaps and for ending close to all aboard | the name, start time and length, and a route to the screen |
| sailing days and all-aboard times | the day's events, a suggested dinner, the "back on board by" time and the late note | times and words |
| whether a traveller is under 13 | choosing events suited to children | nothing about the traveller is returned |

It is read-only (nothing is booked, held, paid or sent; every step is a screen to open), is for the signed-in guest only, is off for a supervised account and when the tools switch is off, and is not sent to a model. What it cannot see (walking times, whether a show or table has space, whether a step suits a traveller's pace or access) is listed in the answer.

## Trip checklist and smart defaults (phase P5, ACT-02 and ACT-04)

Nothing new is stored. `GET /me/stanley/checklist` works out its answer from the check-in progress of each traveller, the booked tours and dinners, and the guest's own remembered dinner preference, and returns it without keeping it. Travellers appear only as "Traveller 2" by position. It ticks off by being recomputed from the real state each time.

| Input | Used for | In the answer |
|---|---|---|
| check-in steps left per traveller and for the booking | the outstanding list, in check-in order | the step as words, the traveller's position and a route to check-in |
| booked tours and dinners | offering "book a dinner" or "look at tours" only when none is booked | words and a route |
| the guest's own remembered dinner preference (early or late only) | a suggestion shown beside "book a dinner", with where it came from | the word early or late; never applied |

Memory must be on, the item must be the guest's own and not sensitive, and a trip item counts only for this sailing; "flexible" is not shown because there is nothing to suggest. It is read-only, off for a supervised account and when the tools switch is off, and is not sent to a model. Documents are left to the trip check-up and the answer says so.

## Missed-ship guard and group gaps (phase P8, CHK-03 and CHK-07)

Nothing new is stored. `GET /me/stanley/ship-group` works out its answer from the guest's own away status for today's port, the head-back buffer they chose, the sailing's all-aboard time and the open polls of their party, and returns it without keeping it. No names appear: a poll shows only how many have answered and how many have not.

| Input | Used for | In the answer |
|---|---|---|
| away status for today's port (the guest's own "ashore" or "leaving") | whether to speak about the way back at all | words only; nothing is said to a guest who has not said they are ashore |
| sailing days and all-aboard times | the landing time, the same as the head-back notices, and whether all aboard has passed | the ship-time all-aboard and minutes left |
| open polls and answer counts | "2 people have not answered" | the question and two counts; silence is never read as a yes |

The guard sends nothing and rings nobody; the push notices for the way back already exist and are separate. It is read-only, off for a supervised account and when the tools switch is off, and is not sent to a model. It lists what it cannot see: where the guest is, and who has no dinner booked (dinners are held for the booking, not each person).

## Trip so far and level suggestions (phase P9a v1, trust features 19.3 and 19.5)

Nothing new is stored. `GET /me/stanley/trip-so-far` counts the guest's own ledger (the action store): acts still in place, acts undone, and the two added together as "you said yes to". It returns the counts and any suggestions without keeping them.

| Input | Used for | In the answer |
|---|---|---|
| Stanley ledger counts (kind and done or undone per act) | the three counts, and a suggestion when one kind has three yeses and no undo (offer more) or two undos (offer to ask first) | numbers and one sentence per kind; no titles, no guest words |

A suggestion is words and a link to the "what Stanley can do" screen. It never changes a level, switches a row on or acts. The answer lists what it does not measure: time saved, and whether a suggestion was right unless it was undone. It is off for a supervised account and when the tools switch is off, and is not sent to a model.

## Standing rules, availability watch, practice mode, plain-words control and the pace answer (phase P9a v1, 4.D, VAL-03, 19.2, 19.4, 19.5)

Stored, in the guest's account state under the key `stanleyStanding` (so every device sees the same): the guest's rules (at most ten) and their answer to "More, the same, or less?". A rule is a template id (RUL-01 to RUL-06 or VAL-03), whether it is in practice, and where the template needs one a restaurant or tour id, a day number and a dinner time, plus the last count of free places a watch saw. No guest words are stored. The plain-words control stores nothing: the sentence is read once against six fixed controls and dropped.

| Input | Used for | In the answer |
|---|---|---|
| the rule the guest made | which rules to check, and their own wording | the rule's sentence, day and time |
| the watch the guest made | the restaurant or tour, night and time to look at, and the last count seen | an item only when places went from none to some |
| booked tours and dinners | RUL-01 (a tour affected by a change) and RUL-02 (a dinner at the guest's time) | the tour or dinner name, its day and time |
| change list for the trip | the programme, port, reservation and tender changes already shown on the change screen | the change's title and whether it is serious |
| places left on tours | same-day alternatives for RUL-01 and the space watch | up to three tour names |
| tables and places left | the table and space watches | whether anything is free, not the count |
| check-in window | RUL-03 | whether check-in is open or when it opens |
| the sentence, read once and not kept | plain-words control | one of six fixed controls shown back for confirmation |

A rule only notices or lines something up for the guest to open. It never books, pays, cancels, holds a table or place, or messages anyone. Rules work only while their permission row is on (CL-05 and CL-07 need level 3, which stays off behind the operator's Authority switch; CL-02 for the notice rules), at most five prepared items are shown (the rest are counted), and a rule in practice lists what it would have offered and offers nothing until the guest graduates it with one tap. Rules are read when the guest opens the screen; there is no background run yet. The answer lists what is not checked. The pace answer moves only when a suggestion is made (less: no "more" suggestion; more: after two yeses) and never changes a level. Off for a supervised account and when the tools switch is off; nothing here is sent to a model.

## Manage and Prebook pack, first part (phase P9b, SR-4.5 and SR-5.4)

Nothing new is stored. `GET /me/stanley/prebook` works out its answer from the sailing dates, the count of adults on the booking, the booked tours and dinners, the payment due date, the check-in window and the open polls of the party, and returns it without keeping it.

| Input | Used for | In the answer |
|---|---|---|
| payment due date | the nearest date in the "what to expect" note | the date in words |
| check-in window | the nearest date in the note | the opening date in words |
| booked tours and dinners | how many are booked, and which next step to point to | two counts and a screen to open |
| open polls and answer counts | whether a dinner poll already exists | nothing; only whether to suggest one |

SR-5.4 is shown only for three or more adults with no open poll that mentions dinner, and starts nothing: it opens the poll screen. It is read-only, off for a supervised account and when the tools switch is off, and is not sent to a model. It lists what it cannot see: table availability, and each person's dinner wishes.

## Get to the ship and Embark pack, first part (phase P9c, SR-6.1, SR-6.6 and SR-7.2)

Nothing new is stored. `GET /me/stanley/embark` works out its answer from the sailing date, the check-in state and the check-in closing time, and returns it without keeping it.

| Input | Used for | In the answer |
|---|---|---|
| sailing date | days to sail: phone and card in the last three days, muster on the day | a title and a screen to open |
| check-in state and closing time | whether to point to check-in | the closing date in words |

It never fills in, submits or sends check-in, and sets no reminder. It is off for a supervised account and when the tools switch is off, and is not sent to a model. It lists what it cannot see: whether the phone plan or card is set up, the muster station, and flights and traffic.

## Disembark pack (phase P9d, SR-10.1 to SR-10.4 and SR-10.6)

Nothing new is stored. `GET /me/stanley/disembark` works out its answer from the sailing date and the number of nights, and returns it without keeping it.

| Input | Used for | In the answer |
|---|---|---|
| sailing date and nights | the day the ship gets in: bags and customs on the evening before, the last look on the morning | a title and a screen to open |

The last evening also points to the final bill (SR-10.2) and the tips (SR-10.4); neither reads an amount.

It never tags a bag, fills in or submits customs, picks an exit time or sends anything, and sets no reminder. It is off for a supervised account and when the tools switch is off, and is not sent to a model. It lists what it cannot see: whether bags are tagged or the customs form is done, the exit time and onward travel, and the final bill.

## Family pack (phase P9e, SR-F.1, SR-F.4 and SR-F.5)

Nothing new is stored. `GET /me/stanley/family` works out its answer from the sailing date and the ages of the travellers on the booking (by position, never a name), and returns it without keeping it.

| Input | Used for | In the answer |
|---|---|---|
| sailing date and number of nights | the kids club in the fortnight before sailing; muster on sailing day; a meeting point while aboard (SR-F.5) | a title and a screen to open |
| ages on the booking | whether anyone is under 18, and how many are of kids club age (3 to 17) | a count in words |

It says nothing unless a traveller is under 18. It never registers a child, messages a teen or marks muster done, and sets no reminder. It is off for a supervised account and when the tools switch is off, and is not sent to a model. It lists what it cannot see: kids club registration and muster state, and age limits, bedtimes and meet-up times.

## Remember pack, first part (phase P9f, SR-11.1, SR-11.2 and SR-11.5)

Nothing new is stored. `GET /me/stanley/remember` works out its answer from the sailing date and the number of nights, and returns it without keeping it.

| Input | Used for | In the answer |
|---|---|---|
| sailing date and number of nights | the day the ship gets in | three titles, each with a screen to open (memories, feedback, loyalty) |

It never builds an album, drafts or sends feedback or a thank-you, reads a loyalty balance or tier, or sets a reminder. It is off for a supervised account and when the tools switch is off, and is not sent to a model. It lists what it cannot see: the loyalty balance, whether the survey is done or an album built, and the days after the guest gets home (the trip lookup drops a finished trip, so the plan's day-after timings are still to do).

### Remember pack, second part (phase P9f, SR-11.3, SR-11.4 and SR-11.6)

Same endpoint and inputs; nothing new is stored. Three more findings on the day the ship gets in, each a screen to open: privacy (keep my chats), rebook (next voyage) and bill (expense export). It deletes or keeps no chat, makes no offer, reads no amount and sends nothing. It cannot see when chats will be cleared or whether a case is open, and the plan's day-after timings are still to do.

## Dream, Discover and Book pack, first part (phase P9f, SR-1.3, SR-2.1, SR-2.4, SR-2.5 and SR-3.3)

Nothing new is stored. `GET /me/stanley/planning` works out its answer from one fact, whether the guest has a confirmed trip still to sail, and returns it without keeping it.

| Input | Used for | In the answer |
|---|---|---|
| sailing dates | whether a confirmed trip is still to sail | five titles, each with a screen to open (saved sailings, cabins, decide, cost, booking) |

It says nothing once a trip is booked. It reads no fare, cabin, review or cancellation date, sets no alert, holds nothing, books nothing, pays nothing and sends nothing. It is off for a supervised account and when the tools switch is off, and is not sent to a model. It lists what it cannot see: fares and cabins, the sailings the guest saved, and weekly shortlists, price falls, holds and share-the-cost links, which are still to do.

### Dream, Discover and Book pack, second part (phase P9f, SR-1.1, SR-1.2, SR-3.4 and SR-3.5)

Same endpoint and input; nothing new is stored. Four more findings for a guest with no trip still to sail, each a screen to open: shortlist (the quiz), referee (compare sailings), share the cost (split costs) and deposits (payments). It keeps no weekly list, asks nobody, starts no poll, creates no payment link, sets no reminder and sends nothing. Price falls, holds and filling in travellers are still to do.

## Rung 4 safe classes, first part (phase P10a, AUT-02 deadline reminders)

One thing is stored that was not before: each reminder AUT-02 sets is an ordinary reminder on the guest's own list (the existing reminders table), tagged in its anchor id with a key of the class, the kind of date and the date (for example `aut02:pay7:2027-01-03`) so the same date is never set twice, and it has a ledger line (the existing Stanley action store, kind `remind_me`, idempotency key the same key) so Did shows it and it can be undone for two hours. `POST /me/stanley/auto/deadlines` reads the sailing dates, the payment due date and state and the check-in window, and does nothing unless permission row CL-08 is on.

| Input | Used for | In the answer |
|---|---|---|
| payment due date | a reminder seven days and one two days before it, while the balance is unpaid | the reminder's words and time |
| check-in window | a reminder on the morning online check-in opens, while it has not opened | the reminder's words and time |
| the guest's own reminders | which keys are already set, and the limit of 30 per trip | nothing |

It sets nothing recurring, nothing that is not a date on the trip, pays and books nothing, and sends nothing to anyone. It is off for a supervised account, for a paused account, below level 4, and unless the Authority switch is on. AUT-01 (reminders that follow) is the existing anchor behaviour of the reminders; AUT-05 and AUT-07 are not built.

### Bag night reminder (phase P10a, second part)

AUT-02 also sets one reminder at 3 pm ship time on the day before the ship gets in ("Bags go out tonight. The bags screen has the tags."), key `aut02:bags:<date>`, from the sailing dates already read. Same limits, receipt and undo as the others; it tags, packs and chooses nothing. Documents, dining and exit-time reminders, AUT-05 and AUT-07 are still to do.

### Exit time reminder (phase P10a, third part)

AUT-02 also sets one reminder an hour before the cabin has to be empty on the last morning ("Your cabin needs to be empty in an hour. The getting off screen has the last look list."), key `aut02:exit:<date>`, from the disembarkation times the Getting off screen already uses. Same limits, receipt and undo as the others; it tags, packs and chooses nothing. Documents and dining reminders, AUT-05 and AUT-07 are still to do.

### Documents reminder (phase P10a, fourth part)

AUT-02 also sets one reminder at 9 am ship time two weeks before sailing ("Two weeks to sailing and a document is not ready. The documents screen shows which."), key `aut02:docs:<date>`, only when the booking is not made by an agent and the check-up already finds a traveller's document not ready. It reads only the ready or not-ready state the check-up holds, no number, name or document detail. Same limits, receipt and undo as the others. Dining reminders, AUT-05 and AUT-07 are still to do.

### Dining plan reminder (phase P10a, fifth part)

AUT-02 also sets one reminder at 9 am ship time five days before sailing ("Your dining plan freezes in 3 days. The dining screen is where to change it."), key `aut02:dining:<date>`, only when the booking is not made by an agent and the freeze date (three days before sailing) has not passed. It reads only the sailing date and today's date, nothing about any table. Same limits, receipt and undo as the others. AUT-05 and AUT-07 are still to do.

### All aboard reminder (phase P10a, sixth part)

AUT-02 also sets one reminder an hour before all aboard on each port day ("All aboard in <port> is in an hour. Time to head back to the ship."), key `aut02:aboard:<date>`, from the published port schedule only. It reads no location and no booking. Same limits (30 per trip in all), receipt and two-hour undo as the others; those further off than the reminders' horizon wait for a later run. All of the AUT-02 dates are now covered; AUT-05 and AUT-07 are still to do.

### Lists kept current, packing list (phase P10a, AUT-05 first part)

`POST /me/stanley/auto/lists` (same permission row CL-08, same switch and gates as AUT-02) says what the packing list's suggested items added or dropped since the last run. The only thing stored is a list of suggested item ids in the guest's own state store (key `stanley.auto.lists.packing`), replaced each time something changes. The first run only records and says so. It reads the packing list the guest already sees; it never changes a list, a tick, a hidden item or an item the guest added, and sends nothing. The document bring list, trip checklist, shortlist and comparison, and AUT-07, are still to do.

