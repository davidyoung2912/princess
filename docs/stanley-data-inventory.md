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
| Tool log | tool name, refused or ok, opaque guest reference | Prove every tool call happened and was checked | Server application log | Follows the application log retention; never the input or the answer |

## Rules the tools keep

- A tool that reads a traveller checks the guest's access to that traveller on every call (`StanleyPacket.Resolve`), from facts the server read, never from the request. A traveller who may not be read and one who does not exist get the same answer.
- A supervised child sees only their own plan. A guardian sees the child they booked. The booker sees the party's plans and cases. Another adult sees the shared plan only. A helper sees the plan with the trip permission and cases with the folio permission, and only while the grant is live. Revoked, pending and expired grants reach nothing.
- All read tools are read-only. None books, pays, cancels, sends or changes anything.
- The one tool that can lead to a change, `propose_action`, only makes a stored preview. The server changes something only on a confirm for a preview it made, from the same guest, not expired, with the price and availability unchanged, through the same service the screen uses. Paying, cancelling a booking, changing a cabin and sharing data are not actions and are refused with where the guest can do them.
- A tool call is one step of the model loop, so it counts against the per-request call cap and the daily ceiling.
- With two possible voyages and none named by the device, Stanley asks which trip. It never picks one.
