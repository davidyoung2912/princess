# Functional gap analysis and plan to close it (second edition)

Status: **Refreshed 2026-11-01, after backend Phase 19. The phased plan in section 5 is approved; Phase G1 is the first to be built.** This replaces the first edition (written 2026-10-29), whose phase numbers 11 to 15 collided with the backend phases of the same numbers. The new phases are named **G1 to G6** to keep them apart.

## 1. How this was done, and how far to trust it

- A targeted re-check, **not a full recount** of the 248 requirement IDs in `docs/functional-requirements.md`. The starting point is the first edition and the Phase 11, 12 and 13 notes in `docs/design-language.md` (sections 20 to 22), plus keyword searches across `src`, `server` and `public`, and `npm run api:check` (every method of the `Api` interface has a row in the data-model tables).
- "Done" items from the first edition were **not re-verified**. Section 8 of the first edition listed the ones to re-check first (ACT-02, ACT-04, MNG-03, OB-08, DIN-03, ROM-05, SAF-05, POS-05, POS-06, PERF-06); that list still stands.
- Device testing is out of scope (project rule). Performance targets (PERF-01), passport scan (BOK-02, CHK-01), offline port map, translation, voice and local reminders stay open for that reason.

## 2. Scoreboard

Last full count (after Phase 13, 2026-10-29): Must 85 IDs with about 16 open at Phase 11, falling since. Phases 12 and 13 closed 50 Should items. The last recorded totals were 133 done or done in reduced scope, 42 partial and 73 not built before Phases 12 and 13; those two phases moved about 50 of them to done. **These numbers have not been recounted.** The table below lists what is known to be open now, which is more useful than a stale total.

| Priority | Open items (known) |
| --- | --- |
| Must, code only | UX-02 (offers area), PERF-04 (load retries), SEC-04 (region rules) |
| Must, server side | SEC-01 (HTTP security headers, encryption at rest), ACT-01 (sign-up, recovery, magic link, passkey, MFA), SEC-03 (scheduled purge) |
| Must, needs a device or a product decision | BOK-02, CHK-01 (scan), PERF-01 (measured), OB-04 (graphic deck plan), SAF-01 (muster video; text stands in), MNG-14, NOT-01, POR-02 (real delivery), CNT-01 (CMS) |
| Should | MSG-05 (30-day chat retention not enforced), NET-04 (no "save data" signal), ACC-03 (PIN reset), ACC-07 (real exchange rates), NOT-04 (weekly marketing cap), PERF-05 (image formats), PERF-07 (error reporting), SEC-10 (disclosure policy) |
| Could | DIS-12, MNG-16, POS-13, SHP-05, CNT-02, CNT-03 |

## 3. Gaps chosen to close now

### Front end (code only)

| Gap | IDs | What is missing |
| --- | --- | --- |
| Offers area | UX-02 (Must), CNT-02, NOT-04 | One offers page, at most one contextual card on Home, "dismiss for this trip", a weekly cap on marketing messages. Reverses the 2026-10-29 deferral. |
| Load retries | PERF-04 (Must) | Loads time out at 20 seconds but are not retried with backoff. Only chat messages are held and retried. No optimistic updates. |
| Region rules | SEC-04 (Must) | Region-specific consent rules beyond the marketing double opt-in. |
| Chat retention | MSG-05 | The 30-day retention is stated but not enforced in the mock. |
| Auto data-light | NET-04 | No switch on the browser's "save data" signal. |
| Whole-trip cost calculator | DIS-12 | Fare, excursions and packages in one total. The package calculator exists. |
| Travel party coordination | MNG-16 | Invites and shared notes. |
| Gifting | POS-13 | Give a cruise credit or gift card. |
| Cabin delivery of purchases | SHP-05 | A delivery option on shop orders. |
| PIN reset and exchange rates | ACC-03, ACC-07 | A reset flow for a forgotten PIN, and exchange rates that are not fixed samples. |

### Server (now possible because the API exists)

| Gap | IDs | Finding |
| --- | --- | --- |
| HTTP security headers | SEC-01 (Must) | No HSTS, X-Frame-Options, frame-ancestors or X-Content-Type-Options in `server/`. |
| Account recovery and sign-up | ACT-01 (Must) | Password sign-in, refresh tokens and lockout exist. No sign-up, forgot-password, magic link, passkey or MFA. |
| Scheduled retention purge | SEC-03 | `PrivacyService.PurgeDueAsync` runs only when a guest opens the privacy centre. No background job, so data can outlive its date. |
| Security disclosure | SEC-10 | No `security.txt` and no disclosure page. |
| Error reporting and analytics | PERF-07, CNT-03 | Only the on-device problem log. |
| Email and SMS delivery | NOT-01, MNG-14 | Still simulated. Needs a decision on a sender; the plan uses a stub sender with an outbox table. |
| Encryption at rest | SEC-01, SEC-03 | A SQL Server setting, outside the schema script. At minimum, document it. |

### Housekeeping

- This file and `docs/backend-plan.md` were stale. **Done in Phase G1**: this rewrite, and the decision-table correction in `backend-plan.md` section 1 (the mocks are kept).
- Three calls stay mock-only in REST mode (`dining.list/reschedule`, `queues.list`, the legacy `requests`). The README says no screen uses them. Delete them in G6.
- `src/ui/Placeholder.tsx` and the `placeholder.*` strings: `App.tsx` falls back to it for a route with no screen. Check in G6 whether any route still does; delete if none.

## 4. Still out of reach for code alone (unchanged)

- **Device or library:** passport scan (BOK-02, CHK-01), offline port map (POR-06), translation (MSG-06), voice (ACS-05), local reminders (NOT-05), measured vitals (PERF-01).
- **Ship systems:** busyness feeds, door unlock, ship phones, biometrics, AR (OB-05, ROM-04, MSG-04, CHK-11, ENT-09).
- **Product decision:** casino (ENT-02, PRE-09), 360 and video content (DIS-07, DIS-13), review syndication (POS-09), a graphic deck plan and muster video (OB-04, SAF-01).
- **Excluded by decision:** multi-cabin booking, insurance, promo codes, cruisetours, flights, languages (BOK-09, BOK-10, BOK-13 to BOK-17, DIS-18).

## 5. Phased plan

Same rules as before: one phase at a time, tests with each, `npm run test`, `npm run lint`, `npx tsc -b` and `npm run build` to verify (never a full `dotnet test`; `dotnet build` is allowed), commit and stop after each phase, nothing started until asked.

| Phase | Name | Closes | Status |
| --- | --- | --- | --- |
| G1 | Server hardening and housekeeping | SEC-01 (headers), SEC-03 (scheduled purge), SEC-10 (`security.txt`), encryption-at-rest note, stale docs | Built (see section 6) |
| G2 | Resilience and privacy in the front end | PERF-04 (load retries with backoff, optimistic updates), NET-04 (save-data signal), MSG-05 (30-day chat retention enforced), SEC-04 (region rules) | Not started |
| G3 | Offers area | UX-02, CNT-02, NOT-04 | Not started |
| G4 | Sign-in and delivery | ACT-01 (sign-up, forgot-password, magic link; passkey and MFA only if you ask), NOT-01 and MNG-14 (stub sender and outbox), PERF-07 and CNT-03 (error reporting and consent-based analytics) | Not started |
| G5 | Money and shop | ACC-03 (PIN reset), ACC-07 (exchange rates), SHP-05 (cabin delivery), POS-13 (gifting) | Not started |
| G6 | Planning and cleanup | DIS-12 (whole-trip cost), MNG-16 (invites, shared notes), delete the three mock-only calls and any unused placeholder | Not started |

Each phase's notes will be added to `docs/design-language.md` (front end) or `docs/backend-plan.md` (server), and the "Status" column above updated.

## 6. Phase G1 notes

Built 2026-11-01.

- **Security headers (SEC-01):** a middleware on every response sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-site`, `Permissions-Policy` (camera, microphone, geolocation off) and, for `/api` and `/health`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` and `Cache-Control: no-store`. Swagger pages are left out of the CSP so the UI still loads. HSTS is added outside Development. Note that the front end is a static site: its `frame-ancestors` and HSTS come from whatever hosts `dist/`, which the repo does not control.
- **Disclosure (SEC-10):** `public/.well-known/security.txt` (RFC 9116) and `public/security-policy.html`, and the server answers `/.well-known/security.txt` too. The contact address is a placeholder to replace before any real deployment.
- **Scheduled purge (SEC-03):** `RetentionPurgeService`, a hosted service that wakes every `Retention:IntervalMinutes` (default 360) and runs the same retention rules as the privacy centre for every ended booking, with real time. Visiting the privacy centre still purges that booking at the demo clock.
- **Encryption at rest (SEC-01, SEC-03):** documented in `server/README.md` (TDE on the database, backup encryption, connection with `Encrypt=True`). It is a hosting setting, not code.
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`. **The C# changes and their new tests were not compiled or run**: `dotnet` is not installed in this environment, and the project rule bars `dotnet test`. Run `dotnet build` in `server/` first and report any errors.
- **Not done:** HSTS and `frame-ancestors` for the static front end; a rendered disclosure page inside the app (the static HTML page stands in).

## 7. Things I am least sure about

- The "Done" marks from the first edition (see section 1).
- Whether `Placeholder` is still reachable (G6 checks).
- The weekly cap on marketing messages in G3 (I suggest 2) is a choice for you to confirm at that phase.
