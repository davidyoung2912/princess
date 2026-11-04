# Security and performance plan

Source: the security and performance review of 2026-11-03 (static read of the server and front end). Each phase is one commit; stop after each so the user can `/clear`. Verify with `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build` and `dotnet build server/Princess.sln` only (no `dotnet test`, no browser testing).

Status key: [ ] not started, [~] in progress, [x] done (built, not committed until asked).

## Phase 1 [x] Silent data loss and secret leakage

- Persist the ASP.NET Data Protection key ring (database table `dbo.DataProtectionKeys`, `SetApplicationName("Princess.Api")`), so encrypted `health`, `calm`, `family` and `travellers` documents survive a redeploy or a second instance. Add the table to `db/01-schema.sql`.
- `StateService` must not turn a decrypt failure into an empty document that the next save overwrites. Fail the read with a server error and log it instead.
- Audit `Target()` must not store the calendar feed token (`/calendar/{file}`): rename the route value to `token` or extend the deny list. Done both: the route value is `token` and `file` is on the deny list.

## Phase 2 [x] Deployment surface

- `UseForwardedHeaders` with configured `KnownProxies` / `KnownNetworks` (`ForwardedHeaders:*`), so rate limits key on the real client address.
- A global per-user/per-IP limiter for authenticated endpoints, Kestrel request-size and concurrency limits. Done: `RateLimit:RequestsPerMinute` (default 300, per user or address, `/health` exempt); `Limits:MaxRequestBodyBytes` (1 MB), `Limits:MaxConcurrentConnections` (2000); `ForwardedHeaders:KnownProxies` / `KnownNetworks` (CIDR) / `ForwardLimit` enable `UseForwardedHeaders`, and nothing is trusted when they are empty.
- Demo and diagnostics off by default: `Demo:Enabled` flag (not just `IsProduction()`) for `/auth/demo-accounts`; `Swagger:Enabled` defaults to false; `/health/providers` behind auth or an internal-only flag; `AllowedHosts` set per environment; real `security.txt` contact. Done: all default off/closed (`Swagger:Enabled`, `Demo:Enabled` false; Development turns both on); `/health/providers` now needs a sign-in; `AllowedHosts` is `localhost` in the base file and `*` only in Development; the API's security.txt contact comes from `Security:Contact` (still the placeholder until the user supplies a real address).
- Document the static-host headers for `dist/` (CSP with `frame-ancestors`, HSTS, `X-Frame-Options`, long immutable cache for hashed assets, Brotli). Done in `docs/static-host-headers.md`.

## Phase 3 [x] Sign-in hardening

- Cap one-time-code requests per account (for example 3 an hour) and keep a cumulative attempt cap across re-issued codes.
- Store codes as a keyed (HMAC with a server secret, per-challenge salt) hash instead of unsalted SHA-256.
- Per-account email send cap on `/forgot` and `/magic`; lockout keyed on (account, IP) with backoff so strangers cannot lock a known email out.
- Stop accepting the 10-digit account number as an unauthenticated login identifier, or make its failure indistinguishable and limited.
- Revoke access-token validity on password reset and logout (token version or short denylist), or document the 15-minute window.

Done: `Auth:CodeRequestsPerHour` (3, per account and purpose; over the cap the answer is the same 204 but no email) and `Auth:MaxCodeAttemptsPerHour` (10 wrong tries across all codes issued in the hour); codes are HMAC-SHA-256 under a key derived from `Jwt:SigningKey` over a per-challenge 16-byte `AuthChallenges.Salt` (codes issued before the salt column cannot match, they last 15 minutes); failed passwords are throttled per (account, address) in `dbo.LoginThrottle` (`Auth:MaxFailedLogins` then `LockoutMinutes`, doubling per repeat lock up to `MaxLockoutMinutes`, forgotten after a day), and the whole account only pauses after `MaxFailedLoginsPerAccount` (30) failures across all addresses; the account number signs in only when `Auth:AllowAccountNumberLogin` is true (default false, otherwise it behaves as an unknown account); a password reset sets `Users.SessionsValidFrom`, and the JWT bearer handler refuses any access token issued before it. Logout still revokes only the refresh-token family: the access token on that device lives for up to `Jwt:AccessTokenMinutes` (15), the documented window, because tokens carry no session id and revoking them all would sign the person out everywhere. Existing databases pick up the new columns and table by re-running `db/01-schema.sql`.

## Phase 4 [ ] Boarding pass lookup and booking numbers

- Booking numbers from a CSPRNG with a longer alphabet (existing numbers keep working).
- Anonymous `/pass/lookup` needs a second factor (date of birth or an emailed code) and a per-booking-number attempt counter with lockout.
- Strip the cabin, deck and muster from the anonymous view; return the QR only after check-in and the second factor.
- Separate pass-signing key (HKDF from the JWT key or `Passes:SigningKey`); `DecodePass` accepts the old key for a transition window.

## Phase 5 [ ] PII retention and exposure

- Retention for `AuditLog` and `RefreshTokens` IP / user agent: truncate or hash the IP after 30 to 90 days in `RetentionPurgeService`.
- Scrub `AuditLog.ErrorDetail` and `ErrorMessage`; confirm `/me/audit` `Detail` never holds another person's data.
- Disclose the concierge's data (first names, party ages) to the model provider in the privacy copy; confirm the connection string uses `Encrypt=True` and TDE is on (docs).
- Front end: always clear person copies from `localStorage` on explicit sign-out; stop caching the most sensitive keys on shared devices.
- Move the refresh token to an httpOnly `SameSite` cookie (server sets it; front end stops reading it).

## Phase 6 [ ] Backend performance

- Audit writes through a bounded `Channel<T>` background writer; aggregate 401 and 429 events so unauthenticated floods do not each cost a DB write.
- Remove N+1 reads (`ShareLinkService.ViewAsync` state per party member and similar).
- Response compression; ETag and `Cache-Control` for the rarely changing public reference endpoints (ships, ports, rooms) instead of blanket `no-store`.
- Note the per-process 30 s user cache for multi-instance deployments.

## Phase 7 [ ] Front-end performance

- Route-level code splitting with `React.lazy` (booking, aboard, reference data); find what makes the 614 KB `jsx-runtime` chunk.
- Convert the 1.9 MB `princess-*.png` (and other large PNGs) to sized WebP or AVIF.
- Exclude large images from the service worker precache.

## Out of scope

Browser testing, `dotnet test`, and non-English strings (per CLAUDE.md).
