# Mobi and Princess MCP: what we would ask for, and what depends on it

Written for the conversation with Princess Cruises about Mobi (the Medallion platform) and any MCP interface it may offer. It is based on what the app does today, not on assumptions about what Mobi has.

## What is already in place

- **A provider seam for MCP.** The server reaches MCP providers only through one gateway: read-only tool allowlist, argument checks, sanitised results, timeouts, a circuit breaker and a health report. Providers are off by default and the app is fully useful with none.
- **Our own public MCP server** (`POST /api/v1/mcp`: `list_ports`, `get_port_guide`, `plan_walking_day`). Setting `Providers:PortKnowledge=mcp` makes the walking planner read its places through the gateway instead of the embedded guide. Pointing `Mcp:PortKnowledgeProvider` at another provider with the same tool shape is a configuration change; if it is off or returns nothing usable the embedded guide answers. This was checked locally: the same places, the same plans.
- **Rule that holds for any provider:** app data stays authoritative. All-aboard times come only from the ship's own timeline; anything from a provider is labelled as third party and never overrides it.

## Tools we would want, and what each unlocks

| Wanted tool (read-only) | Replaces or improves | Needs from Princess |
|---|---|---|
| Ship schedule and all-aboard time by sailing and date | Our authored timeline and every time-based warning (port-day planner, day check, Stanley) | Authoritative, change-notified times; port time zone |
| Port and pier information: berth or tender, pier position, shuttle | The planner's walking start point (today counted from the first stop) | Pier coordinates per port and call |
| Excursion catalogue, availability and prices | The authored excursion list and "no longer fits" warnings | Read access to availability, not booking |
| Dining and venue hours and menus | Venue data in the Plan and Stanley | Hours by ship and day |
| Port advisories (closures, tender or dock changes, weather decisions) | Nothing today; the biggest safety gap | A change feed with a clear authority statement |
| The guest's own booking summary (by consent, signed in as the guest) | Our booking record and entry-document checks | OAuth for the guest, scoped read-only |

We do not ask for any tool that books, pays, cancels or changes anything. The gateway would refuse one even if offered.

## Questions to ask

1. Is there an MCP (or comparable) interface to Mobi, and is it for partners, or only for Princess's own assistant?
2. Authentication: guest-delegated tokens, partner keys, or both? Can access be scoped to read-only?
3. Is data returned with a freshness time and a source, so we can label it?
4. Are advisories and times change-notified, or must we poll? What polling rate is acceptable?
5. Rate limits, availability promises, and who we contact when a tool misbehaves.
6. Terms for showing the data to guests, caching it offline, and for letting an assistant such as Stanley quote it.
7. What may and may not be said to guests about safety and return times; who owns that wording.
8. Is there a test environment with fake sailings so we can run end to end without real guests?

## What we would do on our side once answers arrive

- Add the provider under `Mcp:Providers:*` with an egress allowlist for its exact tools, off until enabled; map its fields into our types in one adapter; keep the embedded data as the fallback.
- Run it behind the same health report and circuit breaker, so a failure falls back to what we have, as the front end cannot tell.
- Do not enable any tool that is not read-only, or carries guest data without consent.
