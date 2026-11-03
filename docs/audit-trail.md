# Audit trail

One append-only table, `dbo.AuditEvents`, answers "who did what, when, from where, and how did it end" for the whole app, including what
failed. It augments the older tables rather than removing them: `HistoryEntries` (the guest-visible change list), `AccessLog` (who looked at
whose documents) and `Acceptances`/`ConsentChoices` stay, and the first two are mirrored into the trail in the same statement.

## What is recorded

| Category | Written by | Examples |
|---|---|---|
| `request` | `AuditMiddleware` | Every POST, PUT, PATCH, DELETE, and every request that ends 4xx/5xx or is refused by the rate limiter (401, 403, 429). Plain successful reads and paths matching no endpoint are not recorded. |
| `auth` | `AuthService` | `auth.login` (success, wrong password, unknown account, locked), `auth.lockout`, `auth.logout`, `auth.register`, `auth.password.reset`, `auth.refresh.reuse` (a spent token came back: session family ended), `auth.reset.request`/`.redeem`, `auth.magic.request`/`.redeem`, `auth.viewAs` |
| `domain` | `DapperAccountStore` | `history.<kind>` for every guest-visible change (booking, payment, card, dining, tour, profile, documents ...) and `access.<purpose>` for every read, save or delete of someone's documents |
| `error` | `AuditMiddleware` | An unhandled exception: type, message (400 chars), top of the stack (2000), status 500, the request's id |
| `error` | `POST /telemetry` | Every problem the app hits on a device (uncaught error, unhandled promise, screen crash, storage, slow load): `client.<kind>`, message scrubbed again on the server, against the signed-in person |
| `system` / `error` | `RetentionPurgeService` | The scheduled purge, and its failure |

Each row has: real time (never the demo clock), actor and subject (users' `PublicId`; on a view-as token the booker is the actor and the child the
subject), role, route template and method, route values (a booking number, never a token or code), status, duration, error code, detail JSON,
correlation id (also the `X-Request-Id` response header and the problem-details `traceId`), address and device. **Never stored:** request
bodies, passwords, card numbers, or the name typed into a failed sign-in (a 12-character fingerprint of it is, so repeated attempts can be matched).

Problems reported by the app are always sent (not tied to the "Help improve the app" switch, which now covers usage counts only). The message is scrubbed on the device and again on the server: no stack, address, e-mail, long number or typed text.

## Guarantees

- **Append-only.** A trigger refuses UPDATE and DELETE; there are no foreign keys, so a row outlives the account it describes.
- **Never fails the guest.** `AuditLog.RecordAsync` catches its own failures and logs them at Error; the request carries on.
- **Written even if the guest leaves.** The middleware writes with `CancellationToken.None`.

## Reading it

- Guests: `GET /api/v1/me/audit` (their own rows: as actor or subject), shown on screen at **Me, Settings, My activity** (`/me/activity`): newest first, grouped by day,
  problems marked, "Problems only" filter, older pages on request.
- Administrators: `GET /api/v1/audit?actor=&subject=&action=&outcome=&category=&from=&to=&max=&before=` (403 for other roles).
- SQL: `SELECT TOP 100 * FROM dbo.AuditEvents WHERE SubjectPublicId = @id ORDER BY [At] DESC;` and, for what failed, `WHERE Outcome <> 'success'` (indexed).
- "Was X ever done?": `WHERE Action = 'POST /api/v1/bookings/{number}/cancel' AND Target LIKE '%number=ABC12345%'`.

## Not yet covered

- Provider fallbacks (`ProviderGuard` circuit opening) are logged and shown on `/health/providers` but not in the trail.
- A front-end error raised while signed out waits in the device queue and is sent after the next sign-in (the route needs a session).
- Retention/archiving of the audit table itself (no purge; an approved archive job would disable the trigger for its run).
- The server code was written without compiling or running `dotnet test` (project rule). Run `dotnet build server/Princess.sln` and, when you choose, the new `AuditApiTests`.
