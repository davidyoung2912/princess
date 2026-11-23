# Functional gap analysis and plan to close it (second edition)

Status: **Refreshed 2026-11-01, after backend Phase 19. The phased plan in section 5 is approved; Phases G1 to G6 are built.** This replaces the first edition (written 2026-10-29), whose phase numbers 11 to 15 collided with the backend phases of the same numbers. The new phases are named **G1 to G6** to keep them apart.

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
- Three calls stay mock-only in REST mode (`dining.list/reschedule`, `queues.list`, the legacy `requests`). The README says no screen uses them. **Done in G6.**
- `src/ui/Placeholder.tsx` and the `placeholder.*` strings: `App.tsx` falls back to it for a route with no screen. **Done in G6**: no route lacked a screen, so it was deleted.

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
| G2 | Resilience and privacy in the front end | PERF-04 (load retries with backoff, optimistic updates), NET-04 (save-data signal), MSG-05 (30-day chat retention enforced), SEC-04 (region rules) | Built (see section 7) |
| G3 | Offers area | UX-02, CNT-02, NOT-04 | Built (see section 8) |
| G4 | Sign-in and delivery | ACT-01 (sign-up, forgot-password, emailed code; passkey and MFA only if you ask), NOT-01 and MNG-14 (stub sender and outbox), PERF-07 and CNT-03 (error reporting and consent-based analytics) | Built (see section 9) |
| G5 | Money and shop | ACC-03 (PIN reset), ACC-07 (exchange rates), SHP-05 (cabin delivery), POS-13 (gifting) | Built (see section 10) |
| G6 | Planning and cleanup | DIS-12 (whole-trip cost), MNG-16 (invites, shared notes), delete the three mock-only calls and any unused placeholder | Built (see section 11) |

Each phase's notes will be added to `docs/design-language.md` (front end) or `docs/backend-plan.md` (server), and the "Status" column above updated.

## 6. Phase G1 notes

Built 2026-11-01.

- **Security headers (SEC-01):** a middleware on every response sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-site`, `Permissions-Policy` (camera, microphone, geolocation off) and, for `/api` and `/health`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` and `Cache-Control: no-store`. Swagger pages are left out of the CSP so the UI still loads. HSTS is added outside Development. Note that the front end is a static site: its `frame-ancestors` and HSTS come from whatever hosts `dist/`, which the repo does not control.
- **Disclosure (SEC-10):** `public/.well-known/security.txt` (RFC 9116) and `public/security-policy.html`, and the server answers `/.well-known/security.txt` too. The contact address is a placeholder to replace before any real deployment.
- **Scheduled purge (SEC-03):** `RetentionPurgeService`, a hosted service that wakes every `Retention:IntervalMinutes` (default 360) and runs the same retention rules as the privacy centre for every ended booking, with real time. Visiting the privacy centre still purges that booking at the demo clock.
- **Encryption at rest (SEC-01, SEC-03):** documented in `server/README.md` (TDE on the database, backup encryption, connection with `Encrypt=True`). It is a hosting setting, not code.
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`. **The C# changes and their new tests were not compiled or run**: `dotnet` is not installed in this environment, and the project rule bars `dotnet test`. Run `dotnet build` in `server/` first and report any errors.
- **Not done:** HSTS and `frame-ancestors` for the static front end; a rendered disclosure page inside the app (the static HTML page stands in).

## 7. Phase G2 notes

Built 2026-11-01.

- **Load retries (PERF-04):** `withRetries` in `src/api/bounded.ts` retries a read twice after `offline`, `network`, `timeout` or `server` failures, waiting with the outbox's jittered backoff. `useAsync` uses it, so every screen load gets it, and it stops once the screen has moved on. Changes (`useAction`) are not retried blindly; they still use the outbox.
- **Optimistic updates (PERF-04):** `optimistic()` in `src/data/optimistic.ts`. Used for the read-receipts switch in the party chat: it moves at once and goes back if saving fails. Other switches can adopt it the same way.
- **Save-data signal (NET-04):** `saveDataRequested()` reads `navigator.connection.saveData`; data-light mode starts on when it is set. A saved choice wins.
- **Chat retention (MSG-05):** the `messages` rule is now 30 days after the cruise ends and deletes the `message` kind, matching the text in the chat. Mirrored in `PrivacyRules.cs`, and `DapperJourneyStores.PurgeAsync` deletes `ChatMessages` sent by the party. Tests on both sides updated.
- **Region rules (SEC-04):** `src/domain/regions.ts` gives each region its law, its age below which a parent decides about marketing and analytics (EU 16, Australia 15, others 13) and its rights. The privacy centre shows them, and hides the marketing and analytics switches for someone in that age band. This is display only: the server does not yet take region into account.
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`. **The C# edits were not compiled or run** (no `dotnet`, and `dotnet test` is barred). Run `dotnet build` in `server/` first.

## 8. Phase G3 notes

Built 2026-11-01.

- **Offers page (UX-02, CNT-02):** `/home/offers`, with nine authored concept offers (`src/domain/offers.ts`) filtered by part of the trip (before, aboard, after), loyalty tier and package. A guest who holds a package is not offered one (suppression after purchase). Each offer has "See it" and "Not for this trip"; dismissed offers sit under "Set aside for this trip" with "Show again". Dismissals are per booking, kept on the device per person (`princess:offers:<person>`, so "Wipe everything" clears them).
- **One card on Home:** `HomeOfferCard` shows the first offer that applies, never while a payment, document or check-in task is waiting, at embarkation, on the farewell day, or after disembarking. `isOfferFree` lists screens that must never carry an offer (muster, emergency, health, check-in, disembark, bills); none of those screens renders one.
- **Restraint:** a test fails if an offer's text uses countdown or scarcity wording.
- **Weekly cap (NOT-04):** `MARKETING_WEEKLY_CAP = 2`; `sendMarketing` allows at most two per rolling seven days, and `countsAgainstCap` exempts everything but the `offers` category. The page states the cap. **Nothing sends marketing yet**, so the rule is tested but has no caller until the G4 outbox; use `sendMarketing` there.
- **Not done:** server-side offers or cap storage (device-local only), purchase suppression beyond the package the guest holds, and ordering by relevance.
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`.

## 9. Phase G4 notes

Built 2026-11-01.

- **Sign-up, reset and emailed code (ACT-01):** server routes `/auth/register`, `/auth/forgot`, `/auth/reset`, `/auth/magic`, `/auth/magic/redeem` (all anonymous and rate limited like login). Accounts are for adults (18+), password 10 or more characters. A "magic link" is a six-digit code, not a link: it works once, lasts 15 minutes, dies after five wrong tries, and a new request spends the old one. The code is stored only as a SHA-256 hash in the new `AuthChallenges` table. `forgot` and `magic` answer 204 whether or not the address has an account (no enumeration); children and password-less accounts get nothing. A reset ends every session the person had. The sign-in page has the three new paths (`SignInFlows.tsx`); rules in `src/domain/signup.ts`. **Not built: passkey and MFA** (you said only if asked).
- **Stub sender and outbox (NOT-01, MNG-14):** `IMessageSender` with `StubMessageSender`, which writes each message to the new `Outbox` table as `sent` and sends nothing. In Development the text is also in the server log so a code can be read; elsewhere the body is never logged. Front-end rules in `src/domain/delivery.ts`: critical always goes; other messages respect the channel switch and quiet hours (held, then `releaseHeld`); marketing also needs the channel consent and uses `sendMarketing`, so the weekly cap of 2 now has a caller. **Nothing in the screens or server calls `deliver` yet**: the rules and the outbox exist and are tested, but no event produces messages until a real sender is chosen.
- **Error reporting and analytics (PERF-07, CNT-03):** `src/diagnostics/telemetry.ts`. Errors (scrubbed text, no stack) and four named events (`screen`, `install`, `offlineUse`, `dataLight`; screen names drop ids) are queued only while the "Help improve the app" consent is on; turning it off forgets the queue. The privacy centre switch sets the device flag. **The queue is the stub sink: nothing leaves the device**, and only `screen` is wired (the shell). `install`, `offlineUse` and `dataLight` are defined but not yet raised.
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`. **The C# (new store, sender, service methods, endpoints, `SignInFlowsApiTests`, in-memory fake) was not compiled or run**: no `dotnet`, and `dotnet test` is barred. Run `dotnet build` in `server/` first. The schema change (`AuthChallenges`, `Outbox`) is in `db/01-schema.sql` and `db/00-drop-all.sql`.
- **Not done:** a rendered check of the new sign-in screens (no browser testing by rule), HTTP-level tests for the front-end forms, region-aware sign-up age (18 everywhere), a real email provider.

## 10. Phase G5 notes

Built 2026-11-01. All four pieces are front end and mock only; no server or REST contract changes.

- **PIN reset (ACC-03):** `src/domain/pinReset.ts`. "I forgot my PIN" opens a request; about 30 minutes later (the demo clock stands in for Guest Services checking ID) the guest can set a new PIN without the old one, for 24 hours, after which the request lapses and can be made again. The money view has an optional `pinReset` (waiting, ready, expired) that the privacy-safe mock fills in. **Over REST the field is absent**, so the screen shows the old behaviour (the request goes to the desk chat and the old PIN is still needed); the server does not yet keep the request or accept a reset.
- **Exchange rates (ACC-07):** `src/domain/rates.ts`. A dated rate table, kept on this device (`src/rates/store.ts`). The only source is a stub that moves the sample rates up to 3% by day, so "Update rates" works and the "N days old" note appears after 3 days. **Nothing is fetched**; swap `stubRates` for a real feed when one is chosen. The bill is still in US dollars; other currencies are an estimate.
- **Cabin delivery (SHP-05):** `src/domain/shopExtras.ts`. Ordered shop goods and cabin gifts get a "Bring it to my cabin" switch (delivered this evening if ordered before 16:00, else next morning). Gift cards are excluded. No fee.
- **Gifting (POS-13):** gift cards can be given to a named person by email or left in their cabin, with a 140-character message. This is the existing gift-card catalogue; a separate "cruise credit" gift was not built.
- **Delivery and gift choices stay on this device** (`src/shop/store.ts`, per person) because the server's order record has no place for them, so nothing is delivered or sent. Removing an order line forgets its choices.
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`. No server code changed.
- **Not done:** server storage for reset requests, delivery and gifts; a real rate feed; a rendered check (no browser testing by rule).

## 11. Phase G6 notes

Built 2026-11-01. Front end only; no server or REST contract changes.

- **Whole-trip cost (DIS-12):** `src/domain/tripCost.ts` and `/home/cruise/cost` (linked from the sailing page and the Plan tools list). For a sailing, room type and party it prices every fare the room offers (the booking quote, plus drinks, Wi-Fi, specialty dinners and excursions the fare does not cover, less the Premier excursion credit, plus flights, hotel and other costs the guest types in) and names the cheapest and what it saves against Standard. Drinks count adults only; the specialty pass is priced per dinner (a third of the pass). Add-on prices use the days to departure, so a rising price shows. It works in both modes because it uses only the domain's price tables.
- **Travel party (MNG-16):** `src/domain/party.ts`, `src/party/store.ts`, `useParty` and `/plan/party`. The page shows who has finished their own check-in steps (from `checkin.view`), lets an adult invite co-travellers by email (up to 8) and keep shared notes (280 characters, 50 kept, only the writer can delete). Supervised child accounts can read but not add. **Invitations and notes stay on this device** under the booker, so they are shared between the people who sign in on one device (the demo) and do not reach other phones. **No email is sent**: the invitation is a saved address. A server table and a sender call (`IMessageSender` from G4) are the next step.
- **Deleted:** `dining.list/reschedule`, `queues.list` and the legacy `requests` from `Api`, the mock and the contract test; the `dinnerReschedule.move` fault (its `plan.dining.move` fault stays); `src/ui/Placeholder.tsx` and the `placeholder.*` strings. `src/screens.test.ts` now fails if a route has no screen.
- **Verified:** `npm run test`, `npm run lint`, `npx tsc -b`, `npm run build`, `npm run api:check`. No server code changed.
- **Not done:** party invitations and notes on the server, accepting an invitation, showing co-travellers' flights or hotel, cost for onboard spending (shop, spa, casino), a rendered check (no browser testing by rule).

## 12. Things I am least sure about

- The "Done" marks from the first edition (see section 1).
- The weekly cap of 2 marketing messages (G3) is my choice; change `MARKETING_WEEKLY_CAP` if you want another number.
