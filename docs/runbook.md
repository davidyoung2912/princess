# Runbook (N8.4)

For whoever keeps the server running. Commands assume `$B` is the server's base address.

## Is it up?

| Check | Meaning |
| --- | --- |
| `GET $B/health` | The process is up. |
| `GET $B/health/db` | The database answers. 503 `databaseUnavailable` means it does not. |
| `GET $B/health/providers` | Real providers switched on and their state: `ok`, `degraded` (recent failures) or `fallback` (the circuit is open and guests are getting the simulation). `{"providers":[]}` means everything is simulated. |

## Catalogue and feeds

The ship, region, port, pattern and sailing catalogue is read from the database tables once and held for ten minutes (`ICatalogueStore`); after changing the seed, run the seed scripts and restart the API or wait. The simulated ship feeds (`/feeds/pulse`, `pulse-day`, `storm`, `sky-night`, `ship-position`, `sea-conditions`, `along-the-way`, `route`) need a `sailing` id; a missing or unknown one answers `badFeedQuery`.

## Providers

Chosen under `Providers:*` in configuration; the default for each is `sim`. A name that is not registered stops the server at start-up and names the choices.

- `Providers:Weather` = `openmeteo`: real sky forecast (UV, high, rain window) for the four ports, up to 15 days ahead. Anything it cannot answer is simulated, and `source` in the answer says `forecast` or `sim`. After 3 failures in a row it stops calling for 2 minutes. Keys: `OpenMeteo:ApiKey` (user-secrets) for a paid plan.
- `Providers:Rates` = `http`: exchange rates. On failure it keeps the last table and shows its date.
- `Providers:Concierge` = `anthropic`: needs `Concierge:ApiKey`.

To go back to the simulation, set the name to `sim` and restart. No data changes.

## Logs

Console logs from ASP.NET Core. Provider problems log as a warning with the provider name ("Weather failed ...", "Weather circuit open ..."). Retention runs log "Retention purge ran for N booking(s)". Set the level in `Logging:LogLevel`. Secrets and typed text are not logged.

## Retention

`Retention:IntervalMinutes` (default 360, 0 turns it off) runs the purge of data past its retention date. A failed run warns and tries again at the next interval.

## Account export and deletion

`GET /api/v1/me/export` returns the guest's whole history: their trips, their saved documents and the documents of each booking they are on. `DELETE /api/v1/me/state` removes their own documents; deleting the account removes the rest by cascade. Pictures are removed with the account.

## Not built yet

An error-reporting hook (PERF-07), structured JSON logs, a staff view of the moderation queue and a retention report. Add them before a pilot.

## Structured logs

Set `Logging__Json=true` (or `Logging:Json` in settings) to write one JSON object per line to the console, with UTC timestamps and scopes.
Off by default so local runs stay readable. The audit trail (`dbo.AuditEvents`, `docs/audit-trail.md`) is separate and always on.
