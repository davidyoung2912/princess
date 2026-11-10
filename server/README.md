# Princess API

ASP.NET Core 9 (C#) REST API over the SQL Server database in `db/`. Dapper with hand-written SQL, JWT bearer auth, Swagger. Design: `docs/backend-data-model.md` (decisions D1 to D15, API surface in section 6). Plan: `docs/backend-plan.md`.

```
Princess.Api/          Auth/  Data/  Domain/  Endpoints/  Contracts/
Princess.Api.Tests/    xUnit; the whole HTTP pipeline over in-memory stores, no database needed
```

## One-time setup

Install the .NET 9 SDK (`sudo apt-get install -y dotnet-sdk-9.0`, or `dotnet-install.sh --channel 9.0`). On WSL without libicu, set `DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1`.

Secrets never go in git. Set them once with user-secrets (stored outside the repo):

```
cd server/Princess.Api
dotnet user-secrets set "ConnectionStrings:Default" "Server=localhost;Database=princess;Trusted_Connection=True;TrustServerCertificate=True;"
dotnet user-secrets set "Jwt:SigningKey" "<random string, 32+ characters>"
# Optional: turns Stanley's model on (the model is called from the server by the Stanley gateway; without a key the scripted answers reply)
dotnet user-secrets set "Concierge:ApiKey" "<Anthropic API key>"
```

The API refuses to start without a signing key of at least 32 characters. In any other environment use the environment variables `ConnectionStrings__Default` and `Jwt__SigningKey`. Non-secret settings (issuer, token lifetimes, lockout, rate limit, CORS origins) are in `appsettings.json`.

## Run, build, test

```
cd server
dotnet build
dotnet test
dotnet run --project Princess.Api      # http://localhost:5182, Swagger at /swagger
```

Run it where it can reach SQL Server (the Windows side, for a Windows-authentication connection string). The schema and both seeds must already be loaded (`db/README.md`).

## Hardening (phase G1)

- **Headers.** `Services/SecurityHeaders.cs` sets `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a locked `Permissions-Policy`, and for `/api` and `/health` a `default-src 'none'; frame-ancestors 'none'` policy with `Cache-Control: no-store`. HSTS is added outside Development when the request is HTTPS. The front end is static files, so its own headers must be set by whatever hosts `dist/`.
- **Disclosure.** `GET /.well-known/security.txt` (RFC 9116); the contact is a placeholder to replace before a real deployment.
- **Audit writes are queued.** `AuditLog` puts each row on a bounded in-memory queue (`Audit:QueueSize`, 10000; the oldest waiting row is dropped and logged when full) and `AuditWriterService` writes it, so a request never waits for the database. Anonymous 401 and 429 refusals from one address on one route are gathered into one row per `Audit:AggregateSeconds` (60; 0 writes each) with `{count, first, last}` in `Detail`. `Audit:Background=false` writes inside the request (the tests use it). Rows still queued when the process stops are written on shutdown (5 s grace); a crash loses what is queued.
- **Response compression and caching.** JSON is sent as Brotli or gzip. The authored reference reads (`/reference/ship`, `ports`, `packages`, `limits`, `pricing`, `content`, `access`, `entry`, `catalogue/*`, `ships/{id}/aboard` and `venues`) carry a strong `ETag` and `Cache-Control: public, max-age=300` (`Reference:MaxAgeSeconds`) and answer `If-None-Match` with 304; everything else stays `no-store`.
- **Per-process caches.** `UserCache` holds a user row for 30 s inside one process. With more than one instance, a change made on one (a role, a password reset, a revoked account) can be seen late on the others by up to 30 s; use a shared cache or sticky sessions if that matters.
- **Scheduled retention purge.** `RetentionPurgeService` runs every `Retention:IntervalMinutes` (default 360, 0 turns it off) and deletes data past its retention date for every ended booking, using real time. Opening the privacy centre also purges, at the demo clock.
- **Background watch scheduler.** `WatchSchedulerService` runs every `Scheduler:IntervalMinutes` (default 15, 0 turns it off; `MaxPeople` caps a run at 500) for everyone with a phone signed up for alerts or an automatic instalment, doing what the app does when it opens: take a due instalment, then send the push notices. It waits one interval before its first run, and the notices keep to once each and to the guest's own limits.
- **Data Protection key ring.** The health, calm, family and travellers documents are encrypted with ASP.NET Data Protection. The key ring is kept in `dbo.DataProtectionKeys` (`DataProtection:Store` = `database`, the default; `ephemeral` is for tests only), so a redeploy or a second instance can still read them. Set `DataProtection:CertificatePath` (a PFX; its password in the secret `DataProtection:CertificatePassword`) to encrypt the keys in that table; without it the server warns at start-up outside Development. Back the table up with the database: losing it makes those documents unreadable, and the API then fails the read (a 500) instead of answering an empty document.
- **Encryption at rest (a hosting setting, not code).** Turn on Transparent Data Encryption for the `princess` database (`ALTER DATABASE princess SET ENCRYPTION ON` after creating a database encryption key and certificate), encrypt backups (`BACKUP ... WITH ENCRYPTION`), and connect with `Encrypt=True` and a trusted certificate outside local development. LocalDB on a developer machine does not need it. Column-level encryption of passport numbers is not done.

## Realtime chat (phase 3 of `docs/chat-plan.md`)

- **Hub.** `Realtime/ChatHub` at `/hubs/chat`, WebSockets only, JWT in the `access_token` query value (only on that path; `ConfigureJwtBearer.OnMessageReceived`). Each person joins `user:{publicId}`. The server sends `chatChanged {id, kind}` (no text, no names); the one method a client can call is `Ack(id)`. Messages over 4 KB are refused. Keep-alive 15 s, client timeout 30 s.
- **Push only if unheard.** `ChatNotifier` sends the nudge when the person has an app open on this server, and sends the phone alert 8 s later only if no `Ack` came; with no app connected it sends the phone alert at once. The wait runs off the request.
- **Proxy.** The host must pass `/hubs` as well as `/api` to the server, with WebSocket upgrade (Vite does this in development). Do not log query strings on that path: they carry the access token.
- **More than one server.** Connection counts and waiting acknowledgements are in memory (`RealtimeState`). Add a backplane so a nudge reaches the server holding the connection: `services.AddSignalR().AddStackExchangeRedis(connectionString)` (package `Microsoft.AspNetCore.SignalR.StackExchangeRedis`) or Azure SignalR Service (`AddAzureSignalR`). Until acknowledgements are also shared, an app connected to another server counts as not connected, so its phone can be buzzed as well; a notice is never lost. Prefer sticky sessions for `/hubs`.

## Providers: swapping a simulation for a real service

Every external source is behind an interface and chosen in one place, `Services/ProviderRegistration.cs` (`AddProviders`). Set `Providers:<Key>` in configuration (appsettings, user-secrets or an environment variable such as `Providers__Weather`). Every key defaults to `sim`; an unregistered name stops the server at start-up and lists the choices. To add a real one: write the class, add one entry to its seam in `ProviderRegistration.Catalogue`, set the name. `ProviderContractTests` runs the same checks against every registered implementation. The front end never changes: it sees the contract shapes only (and `source` fields are not shown differently).

| Key | Interface | What a real provider must return | Fall back to the simulation when |
| --- | --- | --- | --- |
| `Weather` | `IWeatherService` | `Sky`, `Climate` and `Today` from one model, so packing, the day brief and `/feeds/sky` agree. Timeout 3 s | the call fails or times out |
| `Flight` | `IFlightStatusProvider` | `state` (`onTime|delayed|cancelled`) and non-negative `delayMinutes` for a normalised number and date. Timeout 3 s | the call fails; say `onTime` rather than guess |
| `Route` | `IRouteConditionsProvider` | `traffic`, `sky`, `leaveEarlierMinutes` for the sailing date and the arrival window's crowd. Timeout 3 s | the call fails |
| `Telemetry` | `IShipTelemetry` | port crowd, venue pulse, loungers, sightings and the night sky, as in `Providers.cs`. Timeout 2 s | the call fails; the answer is cached by the front end |
| `StaffQueue` | `IStaffQueue` | a ticket with a position and expected time; the ticket row is kept by `IStaffTicketStore` either way, so the desk can read `dbo.StaffTickets` | the desk is unreachable: still keep the ticket and answer `waiting` |
| `Concierge` | `IConciergeModel` | `sim` (the scripted concierge) or `anthropic` (needs `Concierge:ApiKey`). Unset: `anthropic` when a key is present, else `sim` | the model fails: the scripted concierge answers with a `fallback` code |
| `ConciergeLimit` | `IConciergeLimiter` | `database` (default; `dbo.ConciergeUses`, one row per model call, shared by every instance and kept over restarts) or `memory` (one instance; tests). Backs the per-guest daily ceiling | n/a |
| `StanleyLog` | `IStanleyTierLog`, `IStanleyActionStore` | `database` (default; `dbo.StanleyTierLog`, counts and tokens only, no message text, `dbo.StanleyActions`, the prepared actions and receipts, and `dbo.StanleyHandoffs`, the human handoff cases) or `memory` (tests) | a failed log write never fails an answer |

The Stanley gateway is configured in the `Stanley` section (see `appsettings.json`): `SmallModel`, `DefaultModel`, `LargeModel`, a token cap per tier, `ChatCalls` and `PlanningCalls` per request, `DailyCeiling` per guest, and `Switches` (`Library`, `Resolver`, `Model`, `Tools`, `Actions`, `Handoff`) that turn a route off without a code change. `GET /me/stanley/status` reports what is off; `GET /me/stanley/tiers` (administrators) summarises the tier log. Questions about the guest's own trip that need no model (`StanleyResolvers`: next event, all aboard, tender, check-in deadline, tours, dinners and more) are answered first as a `card` with its provenance (chips, owner, data time, freshness, route to a person), and risk topics with stale or missing data say "I cannot confirm" instead of guessing. Muster questions get a fixed answer with no model, and card numbers and codes are masked (`CardData`) before a message joins a prompt. `src/ai/eval/cases.json` is read by both the browser's tests and `StanleyEvalTests`.
| `FareFeed`, `ProgramChanges`, `StormOutlook`, `TenderOutlook`, `LostProperty`, `SlotWatchFeed`, `SailingQuality`, `EmbarkQueue`, `CabinGuide`, `FriendReply`, `PaymentGateway`, `TelemetrySink` | the interface of the same name | see the doc comment on each interface in `Services/Providers.cs` and `PaymentGateway.cs` | the call fails |

After any server change run `dotnet build server/Princess.sln` yourself; this project's rule keeps `dotnet test` out of the assistant's hands. Apply the new table with `db/01-schema.sql` (it creates `dbo.ConciergeUses` and `dbo.StanleyTierLog` if missing).

## Auth model

| | |
| --- | --- |
| Sign in | `POST /api/v1/auth/login` `{identifier, password}`; identifier is the email or the 10-digit account number. Returns an access token (15 min), a refresh token (30 days, stored only as a SHA-256 hash) and the person. |
| Refresh | `POST /api/v1/auth/refresh` `{refreshToken}`. The old token is spent and a new one issued. Presenting a spent token again revokes that whole session family. |
| Sign up | `POST /api/v1/auth/register` `{email, password, firstName, lastName, dob}`. Adults only (18+), password 10+ characters. Returns a session. 409 `emailTaken` if the address has an account. |
| Forgot password | `POST /api/v1/auth/forgot` `{email}` always answers 204. If the address has an account, a 6-digit code (15 minutes, one use, five wrong tries) goes to the outbox. Then `POST /api/v1/auth/reset` `{email, code, newPassword}`, which also ends every session. |
| Email code sign-in | `POST /api/v1/auth/magic` `{email}` then `POST /api/v1/auth/magic/redeem` `{email, code}`; same code rules as reset. |
| Messages (stub) | There is no email or SMS provider. `StubMessageSender` writes each message to `dbo.Outbox` as `sent` and sends nothing. In Development the text, with the code, is also in the server log; in other environments it is never logged. Replace `IMessageSender` to deliver for real. Passkeys and MFA are not built. |
| Sign out | `POST /api/v1/auth/logout` `{refreshToken}` with the bearer token. |
| Who am I | `GET /api/v1/me`. |
| View as a child | `POST /api/v1/me/view-as/{childId}`, booker only. A 15 minute token whose `sub` is the child and `act` the booker. The child's supervised restrictions apply. |
| Lockout | 5 wrong passwords lock the account for 15 minutes. Wrong password, unknown account, locked account and a supervised child all return the identical 401 `badCredentials`. Login and refresh are also rate limited per IP (10 a minute). |

Every endpoint needs a signed-in user unless it opts out (`/health`, `/health/db`, login, refresh).

## In-memory caching (`Data/DataCache.cs`)

Reference data served from C# (`/reference/*`) is already held in memory for the life of the process. Only the SQL reads below are cached; everything user-owned, transactional or money-related is always read from SQL, so a guest sees the same data on every device.

| What | Where | Lifetime | Invalidation |
| --- | --- | --- | --- |
| `ref.Sailings` list | `SailingCache`, used by `DapperTripStore.ListSailingsAsync` | 10 minutes | TTL only (the API never writes it; a manual `BookingOpen` close shows within 10 minutes) |
| The signed-in user row | `UserCache`, used by `DapperUserStore.FindByPublicIdAsync` | 30 seconds | Cleared on profile save, email change and password reset |
| `demo.DemoState` | `DapperDemoStore` (scoped) | One request | Dropped on save |

The caches are per server instance. If you scale out, the 30-second user TTL is the bound on how long another instance can serve a stale user row.

## Errors

RFC 7807 problem details. `type` is one of the `src/api/errors.ts` codes (`invalid`, `conflict`, `forbidden`, `notFound`, `challenge`, `declined`, `server`) and `title` is the token the screens switch on. Two additions that the client reads by HTTP status: **401** (`forbidden` / `unauthenticated`, `badCredentials` or `badRefreshToken`) means refresh or sign in again; **403** is final. 429 is `tooManyRequests`. A booking the caller is not on is always 404 `notFound`.

## Authorisation helpers (`Auth/AccessService.cs`)

`RequireMemberAsync`, `RequireAdultMemberAsync`, `RequireBookerAsync`, `RequireParentOf`, `RequireSelfOrHelperAsync` implement section 7 of the data-model document. Every journey endpoint calls them (Phase 6 onward; `Auth/SubjectAccess.cs` adds the person-or-booker-or-helper rule for profiles and documents); the pure rules (`AccessRules`) are unit tested.

## Smoke calls (run against your database)

Seeded demo password is `Sailaway!2027`. In bash:

```
B=http://localhost:5182
curl -s $B/health                      # {"status":"ok"}
curl -s $B/health/db                   # {"status":"ok"} once the connection string works

curl -s -X POST $B/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"identifier":"gerald@demo.princess.example","password":"Sailaway!2027"}'
# Copy accessToken and refreshToken from the reply:
curl -s $B/api/v1/me -H "authorization: Bearer $ACCESS"                      # Gerald Whitfield, tier platinum

curl -s -X POST $B/api/v1/auth/refresh -H 'content-type: application/json' -d "{\"refreshToken\":\"$REFRESH\"}"
curl -s -X POST $B/api/v1/auth/refresh -H 'content-type: application/json' -d "{\"refreshToken\":\"$REFRESH\"}"   # second use: 401 badRefreshToken, and the new token is dead too

# Booker views as a supervised child (Daniel Harper, then Ethan or Maya; ids from the seed or the party route later)
curl -s -X POST $B/api/v1/me/view-as/<childPublicId> -H "authorization: Bearer $ACCESS"
```

In Swagger: run `/auth/login`, press **Authorize**, paste the `accessToken`, then try `/me`. Also try the account number `4100007919` as the identifier, and a wrong password six times (the sixth call and the correct password both return 401 until the lock expires).

## Phase 6 endpoints

Account, trips, payments, documents, notifications, support, help, privacy, budget, feedback and favourites: 33 routes, listed with verbs and auth in `docs/backend-data-model.md` section 6.1 and in Swagger (tags Account, Trips, Payments, Documents, Notifications, Support, Help, Privacy, Budget, Feedback, Favourites). Booking-scoped routes take the booking number (`/bookings/PC163342/...`); people are addressed by their public guid. Only `GET /sailings` and `GET /help/contacts` are public.

"Now" comes from `IUserClock`: real time for a normal user, real time plus `demo.DemoState.ClockOffsetSeconds` for a user flagged `IsDemo` (all the seeded personas), so each persona sits at its own stage.

## Smoke calls for Phase 6 (run against your database)

Sign in as each persona (password `Sailaway!2027`) and keep the token: `ACCESS=$(curl -s -X POST $B/api/v1/auth/login -H 'content-type: application/json' -d '{"identifier":"maria@demo.princess.example","password":"Sailaway!2027"}' | jq -r .accessToken)`.

```
H="authorization: Bearer $ACCESS"
curl -s $B/api/v1/trips -H "$H"                                   # Maria: PC179254, payment dueSoon, next documents (no passport)
curl -s $B/api/v1/bookings/PC179254/party -H "$H"
curl -s $B/api/v1/bookings/PC179254/documents -H "$H"             # citizenship-based requirements, blocking count
curl -s $B/api/v1/bookings/PC179254/payments -H "$H"              # one deposit receipt, a saved Visa
curl -s $B/api/v1/me/notifications -H "$H"                        # payDue, documentsMissing, checkinOpens
curl -s $B/api/v1/help/contacts
curl -s $B/api/v1/sailings
```

Per persona (each is a different rule):
- **Owen** `owen@demo...` (PC301776): `POST /api/v1/bookings/PC301776/payments/balance` with `{"cardId":"<id from GET .../payments>"}` settles it; a second call is 409 `paid`.
- **Priscilla** (PC317688): the declined attempt is not a receipt; the trip is `overdue`, next `payOverdue`. Add a card with `POST /api/v1/me/cards` `{"brand":"visa","last4":"4242","expiry":"12/30"}` and pay.
- **Victor** (PC333500): `passportProblems` is 1 in `/trips`; `PUT /api/v1/users/<his id>/documents/passport` `{"expires":"2031-05-01"}` clears it.
- **Gerald** (PC163342): `PUT /api/v1/users/<his id>/profile` changing a surname by one letter is accepted; to a different name is 409 `large`.
- **Ruth and Paul** (PC428972): sign in as Paul and `GET /api/v1/users/<Ruth's id>/profile`, then `PUT .../documents/photoId`: allowed only while Ruth's helper grant is active with `view` plus the permission. Mei's revoked helper gets 404.
- **Daniel** then view-as Maya (`POST /api/v1/me/view-as/<Maya's id>`): every `PUT`, `POST /me/cards` and `PUT /bookings/.../budget` returns 403 `supervised`.
- **Nina** (no booking): `POST /api/v1/trips/link` `{"number":"AG7P31BK","lastName":"<lead guest's surname, BookingGuestDetails seq 1>","departure":"2027-03-21"}` links Edith's agent booking; any wrong field is the same 404 `noMatch`. The eleventh try in a minute is 429.
- **Frank/Grace/Harold** (post-cruise): `GET /api/v1/bookings/<number>/privacy` deletes nothing yet (retention starts 30 days after 28 March 2027).
- **Rosa/Theo**: `GET /api/v1/me/favourites`, then `POST /api/v1/me/favourites/toggle` `{"key":"excursion:coz-snorkel"}` twice.

Check in Swagger that `GET /me/helper` for someone with no helper returns `null` (a JSON body, not empty).

## Phase 7 endpoints

Discover and booking: 18 routes, listed in `docs/backend-data-model.md` section 6.2 and in Swagger (tags Discover, Booking). The five `GET /sailings/...` routes are public; everything else needs a sign-in. Payments go through `IPaymentGateway` (`Services/PaymentGateway.cs`), the pretend bank:

- a card ending `0002` is declined (`402`, type `declined`, title "Visa ending 0002");
- a card that is not the person's default card, or any card payment of $3,000 or more, needs the one-time code `123456` in `challenge` (`402`, type `challenge`, title `required` or `wrong`);
- a device wallet (`{"method":"wallet","cents":...}`) never needs it.

`POST /bookings` and `POST /bookings/{n}/pay-balance` accept an `Idempotency-Key` header (8 to 80 characters of letters, digits and `_ . : -`). Booking the same draft twice, or repeating a key, returns the first result and charges nothing.

## Smoke calls for Phase 7 (run against your database)

```
curl -s $B/api/v1/sailings/offers                                              # 8 sailings with a "from" price
curl -s $B/api/v1/sailings/bookable                                            # days to go and open true or false
curl -s "$B/api/v1/sailings/sun-2027-03-21/quote?category=balcony&guests=2"    # total 621,100 cents
curl -s $B/api/v1/sailings/sun-2027-03-21/rooms
curl -s "$B/api/v1/sailings/sun-2027-03-21/cabins?category=interior"          # first room 8188
```

Then sign in as a persona with a saved card (for example Owen) and book. Cards are listed by `GET /api/v1/bookings/<number>/payments`; use the guid of the default Visa as `cardId`.

```
H="authorization: Bearer $ACCESS"
curl -s -X PUT $B/api/v1/me/draft -H "$H" -H 'content-type: application/json' -d @draft.json     # returns the server-chosen id
curl -s -X POST $B/api/v1/booking/quote -H "$H" -H 'content-type: application/json' -d @draft.json   # note "total"
curl -s -X POST $B/api/v1/bookings -H "$H" -H 'content-type: application/json' -H 'Idempotency-Key: smoke-0001' \
  -d '{"draft":<the draft, with the id from the PUT>,"expectedTotal":<total>,"option":"deposit","parts":[{"method":"card","cardId":"<guid>","cents":<deposit>}]}'
```

Send the same call again: the same booking number comes back and `GET .../payments` shows one deposit. A wrong `expectedTotal` is 409 `priceChanged`. Then `GET /api/v1/bookings/<number>/detail`, `GET .../change?sailingId=sun-2027-02-28`, `POST .../cancel` (free within 24 hours when more than 7 days out).

## Phase 8a endpoints

The pre-cruise plan: 25 routes under `/bookings/{number}/...`, listed in `docs/backend-data-model.md` section 6.3 and in Swagger (tags `Plan`, `Plan: excursions`, `Plan: dining`, `Plan: packages`, `Plan: lists`, `Plan: assistance`). Any guest on the booking may read; an adult guest may write (a supervised child gets `403 supervised`); a stranger gets `404`. Tours, add-ons and upgrades are paid with the same `parts` and `challenge` as booking, and the pretend bank behaves the same.

## Smoke calls for Phase 8a (run against your database)

Sign in as a persona with a booking (for example Daniel on `PC243902`) and a saved default card.

```
H="authorization: Bearer $ACCESS"; N=$B/api/v1/bookings/PC243902
curl -s $N/plan -H "$H"                                                           # eight days, with gaps where nothing is booked
curl -s $N/excursions -H "$H"                                                     # 12 tours; rtb-zip shows 0 spots on the 21 March sailing
curl -s -X PUT $N/excursions/cart/coz-snorkel -H "$H" -H 'content-type: application/json' -d '{"guests":["<daniel guid>"]}'
curl -s -X POST $N/excursions/checkout -H "$H" -H 'content-type: application/json' -d '{"parts":[{"method":"card","cardId":"<guid>","cents":7900}]}'
curl -s "$N/dining/slots?venue=crown&day=3" -H "$H"                               # 2 tables at 18:30 and 4 at 20:00
curl -s $N/packages -H "$H"                                                       # upgrades from Plus to Premier at 21,000 cents
curl -s $N/checklist -H "$H"; curl -s $N/packing -H "$H"; curl -s $N/travel -H "$H"; curl -s $N/assistance -H "$H"
```

Then book a table in `dining/reservations` and confirm the same slot shows one fewer table for a second booking on the same sailing. Dining only opens once the cruise is paid in full (or the booker is Platinum or Elite), so a persona who still owes a balance gets `409 notOpen`.

## Phase 8b endpoints

Waits, shows and the before-the-cruise services: 36 routes, listed in `docs/backend-data-model.md` section 6.3 and in Swagger (tags `Waits`, `Shows`, `Ahead: upgrades`, `Ahead: clubs`, `Ahead: medallion`, `Ahead: bag tags`, `Ahead: preparation`, `Ahead: advisors`, `Ahead: marketing`, `Ahead: loyalty`, `Ahead: cases`). Under `/bookings/{number}`: `waits`, `shows`, `upgrades`, `clubs`, `medallion`, `bag-tags` and `prep` (any guest reads, an adult guest writes, a supervised child gets `403 supervised`, a stranger `404`). Under `/me`: `advisor-requests`, `marketing`, `loyalty`, `fix-cases` and `assist-cases` (the signed-in person's own).

Queue and waitlist positions are worked out from the clock on every read, so to see them move use the demo clock (`demo.DemoState.ClockOffsetSeconds`) rather than waiting. A table waitlisted with `"auto": true` is booked by the next `GET .../waits` after it is offered (three hours after joining, or halfway to the slot when it is nearer). Marketing codes are shown only to a user flagged `IsDemo` (`demoCode`).

## Smoke calls for Phase 8b (run against your database)

Use a persona who is aboard (jump the demo clock to a sea day first), with a booking paid in full for the dining calls.

```
H="authorization: Bearer $ACCESS"; N=$B/api/v1/bookings/PC243902; J='content-type: application/json'
curl -s $N/waits -H "$H"                                                           # "open" lists the walk-in places open now
curl -s -X POST $N/waits/queue -H "$H" -H "$J" -d '{"venueId":"alfredo"}'          # a place in the queue; again is 409 duplicate
curl -s "$N/shows?day=2" -H "$H"                                                   # seats left per show
curl -s -X POST $N/shows/tickets -H "$H" -H "$J" -d '{"eventId":"stage-show","day":2,"guests":["<daniel guid>"]}'
curl -s $N/upgrades -H "$H"; curl -s $N/clubs -H "$H"; curl -s $N/medallion -H "$H"; curl -s $N/bag-tags -H "$H"; curl -s $N/prep -H "$H"
curl -s -X POST $B/api/v1/me/marketing/email/subscribe -H "$H" -H "$J" -d '{"contact":"daniel@demo.princess.example","region":"uk"}'   # pending; demoCode for a demo user
curl -s $B/api/v1/me/loyalty -H "$H"; curl -s $B/api/v1/me/advisor-requests -H "$H"; curl -s $B/api/v1/me/assist-cases -H "$H"
```

Then fill a table's slot from a second booking on the same sailing, waitlist the first booking for it, jump the clock three hours and `POST .../waits/waitlist/{id}/accept`: the reservation appears in `GET .../dining` with the note "From the waitlist". Check that a club registration made by the booker is visible to them and shows no health notes to the other adult guest.

## Phase 9 endpoints

Check-in, boarding and embarkation day: 12 routes, listed in `docs/backend-data-model.md` section 6.4 and in Swagger (tags `Check-in`, `Boarding`). Under `/bookings/{number}`: `checkin` (view, `status`, `receipt`, `PUT steps/{step}`, `POST submit`), `boarding` (and `POST boarding/wallet`) and `embark` (`PUT companion/{id}`, `PUT carry-on/{id}`, `PUT bags`). Any guest reads, an adult guest writes, a supervised child gets `403 supervised`, a stranger `404`. `GET /api/v1/pass/lookup?number=&lastName=` is the one public route, rate-limited per address with the login limit, and every mismatch is the same `404`.

Check-in opens at midnight three days before sailing and closes at 10:00 on sailing day (ship home time), on the caller's own clock, so jump the demo clock to test it. QR codes are signed with an HMAC of `Jwt:SigningKey`; change the key and old codes stop verifying.

## Smoke calls for Phase 9 (run against your database)

Use a persona with a booking sailing in the next three days (set the demo clock), signed in as an adult who has a saved card.

```
H="authorization: Bearer $ACCESS"; N=$B/api/v1/bookings/PC243902; J='content-type: application/json'
curl -s $N/checkin/status -H "$H"                                                  # state: open
curl -s $N/checkin -H "$H"                                                         # guests, progress, windows, cards
curl -s -X PUT $N/checkin/steps/confirm -H "$H" -H "$J" -d '{"guests":["<guid>","<guid>"]}'
curl -s -X PUT $N/checkin/steps/document -H "$H" -H "$J" -d '{"guest":"<guid>","kind":"passport","country":"United States","number":"X1234567","expires":"2030-02-01"}'
curl -s -X PUT $N/checkin/steps/photo -H "$H" -H "$J" -d '{"guest":"<guid>","metrics":{"width":1200,"height":1500,"brightness":135,"sharpness":28}}'
curl -s -X PUT $N/checkin/steps/payment -H "$H" -H "$J" -d '{"cardId":"<card guid>"}'
curl -s -X PUT $N/checkin/steps/arrival -H "$H" -H "$J" -d '{"window":"11:00"}'
# emergency, contract and health the same way, then:
curl -s -X POST $N/checkin/submit -H "$H" -H "$J" -d '{}'                         # state: done; passes issued
curl -s $N/boarding -H "$H"; curl -s $N/checkin/receipt -H "$H"; curl -s $N/embark -H "$H"
curl -s "$B/api/v1/pass/lookup?number=PC243902&lastName=Harper"                    # no token needed
```

Check that the `dbo.CheckinGuests`, `dbo.CheckinBooking`, `dbo.BoardingPasses`, `dbo.EmbarkProgress` and `dbo.EmbarkTicks` rows appear, and that `dbo.TravelPlans.ArrivalWindowId` follows the arrival step.

## Phase 10a endpoints

The on-board day and Guest Services chat: 14 routes, listed in `docs/backend-data-model.md` section 6.5 and in Swagger (tags `On board`, `Guest Services chat`). Under `/bookings/{number}`: `onboard/today`, `onboard/port`, `onboard/program/{day}`, `PUT onboard/plan/{eventId}` (body `{on, day}`), `onboard/port-day` (a JSON `null` after the last port), `onboard/muster` (GET, and POST `{guests}`), `onboard/emergency`, `onboard/folio`, `entitlements`, and `service/channels`, `service/{channel}` (GET, POST `{text}`), `service/{channel}/escalate` (`{phone}`). Any guest reads, an adult guest writes; the account (`folio`) is for adults only. A supervised child gets `403 supervised`, a stranger `404`.

Programme, tender, muster, folio generation and chat timing are ported rules (`ProgramRules`, `AboardRules`, `FolioRules`, `ServiceChatRules`). Weather is a mocked service (`AboardRules.WeatherOn`). Crew replies are not stored: they appear on read once their time has come. The scenarios `planChange`, `belizeTender`, `portSkipped` and `chatSlow` are read from `demo.DemoState.ActiveScenarios` and apply only to users flagged `IsDemo`. Ship-tour QR codes are signed with the same HMAC key as boarding passes.

## Smoke calls for Phase 10a (run against your database)

Use a persona aboard (set the demo clock to a sea day) signed in as an adult.

```
H="authorization: Bearer $ACCESS"; N=$B/api/v1/bookings/PC243902; J='content-type: application/json'
curl -s $N/onboard/today -H "$H"                                                   # aboard, day, port, weather, next port day, muster
curl -s $N/onboard/program/2 -H "$H"
curl -s -X PUT $N/onboard/plan/trivia -H "$H" -H "$J" -d '{"on":true,"day":2}'    # ["trivia"]
curl -s $N/onboard/port-day -H "$H"; curl -s $N/onboard/emergency -H "$H"; curl -s $N/onboard/folio -H "$H"
curl -s $N/onboard/muster -H "$H"                                                  # at the drill, jump the clock to an hour before it, then:
curl -s -X POST $N/onboard/muster -H "$H" -H "$J" -d '{"guests":["<guid>"]}'
curl -s -X POST $N/service/housekeeping -H "$H" -H "$J" -d '{"text":"More towels please"}'
curl -s $N/service/housekeeping -H "$H"                                            # jump the clock ten minutes: a crew reply appears
```

Check that the `dbo.PlanEvents`, `dbo.MusterConfirmations`, `dbo.ServiceThreads` and `dbo.ServiceMessages` rows appear, and that `dbo.Tickets` gets a `callback` row after an escalation. `dbo.PlanEvents` needs a `ref.EventDays` row for the event and day, so the reference seed must be loaded.

## Phase 10b endpoints

Orders and the ship's services: 33 routes, listed in `docs/backend-data-model.md` section 6.5 and in Swagger (tags `Orders`, `Family`, `Health`, `Stateroom`, `Photos`, `Laundry`, `Wi-Fi`, `Trip updates`). Under `/bookings/{number}`: `orders/menu`, `orders` (GET, POST), `orders/{id}/resolve`, `DELETE orders/{id}`, `PUT orders/{id}/location`, `orders/{id}/contact`; `family`, `PUT family/{child}/zones`, `PUT family/{child}/auth`, `family/{child}/check-in`, `family/{child}/check-out`, `PUT family/reunion`; `health`, `health/reports`, `health/requests`; `room`, `PATCH room/housekeeping`, `PATCH room/devices`; `photos`, `PUT photos/{photoId}/favourite`, `photos/quote`, `photos/purchases`, `photos/purchases/{id}/download`; `laundry` (GET, POST, `DELETE {id}`); `wifi`, `wifi/devices` (POST, `PUT` and `DELETE {id}`); `updates`, `updates/{id}/ack`. Any guest reads, an adult guest writes (a child may check themselves out of a club where the parent allows it).

Rules are ported to `OrderRules`, `FamilyRules`, `HealthRules`, `RoomRules`, `PhotoRules`, `LaundryRules`, `WifiRules` and `DisruptionRules`. **This phase starts writing to `dbo.FolioLines`**: an order, a photo purchase, a laundry request and a Wi-Fi device each put their lines on the account in the same transaction as the record, and a change (cancel, move, resolve, upgrade, remove) replaces that record's lines. The scenarios `orderStock`, `childMissing`, `illness` and the trip updates are read from `demo.DemoState.ActiveScenarios` for `IsDemo` users only.

## Smoke calls for Phase 10b (run against your database)

Use a persona aboard (set the demo clock to a sea day) signed in as an adult.

```
H="authorization: Bearer $ACCESS"; N=$B/api/v1/bookings/PC243902; J='content-type: application/json'
curl -s $N/orders/menu -H "$H"
curl -s -X POST $N/orders -H "$H" -H "$J" -d '{"kind":"delivery","lines":[{"itemId":"cheeseburger","qty":2,"extras":[],"guest":"<guid>"}],"location":{"kind":"zone","placeId":"lido-pool"},"tip":200}'
curl -s $N/orders -H "$H"; curl -s $N/onboard/folio -H "$H"                      # the order's lines are on the account
curl -s -X DELETE $N/orders/<order guid> -H "$H"                                   # within five minutes: refund line appears
curl -s $N/family -H "$H"; curl -s -X POST $N/family/<child guid>/check-in -H "$H"
curl -s -X POST $N/health/reports -H "$H" -H "$J" -d '{"guests":["<guid>"],"symptoms":["cough"],"startedHoursAgo":3}'
curl -s -X PATCH $N/room/housekeeping -H "$H" -H "$J" -d '{"mode":"dnd"}'
curl -s -X POST $N/photos/purchases -H "$H" -H "$J" -d '{"photoIds":["gangway"],"option":"each"}'
curl -s -X POST $N/wifi/devices -H "$H" -H "$J" -d '{"name":"Laptop","plan":"surf","days":3}'
curl -s -X POST $N/updates/planChange/ack -H "$H" -H "$J" -d '{"option":"ok"}'     # with the planChange scenario on
```

Check that `dbo.Orders`, `dbo.OrderLines`, `dbo.KidClubCheckins`, `dbo.FamilyLog`, `dbo.HealthReports`, `dbo.RoomSettings`, `dbo.PhotoPurchases`, `dbo.WifiDevices` and `dbo.UpdateAcks` rows appear, and that `dbo.FolioLines` has rows with `SourceType` `order`, `photo`, `laundry` and `wifi`. None of `DapperShipboardStore` has touched SQL Server yet. Photos need `ref.PhotoCatalogue` and orders need `ref.MenuItems` seeded.

## Phase 10c endpoints

On-board bookings, requests and the group chat: 41 routes, listed in `docs/backend-data-model.md` section 6.5 and in Swagger (tags `Bookings on board`, `Stateroom requests`, `Safety reports`, `Drinks tracker`, `Money`, `Cabin parties`, `Group tables`, `Games`, `Cabin TV`, `Last-minute tours`, `Port readiness`, `Chat`). Under `/bookings/{number}`: `selections` (GET, POST, `DELETE {id}`); `requests` (GET, POST, `DELETE {id}`); `safety-reports` (GET, POST); `drinks` (GET, POST, `DELETE {id}`); `money`, `money/top-ups`, `PUT money/pin`, `money/forgot-pin`, `PUT money/gratuity`, `PUT money/currency`; `parties` (GET, POST, `DELETE {id}`); `dining/reservations/{id}/group` (GET), `…/group/friends` (POST, `DELETE {index}`), `PUT …/group/split`; `games`, `PUT games/clues/{id}`, `PUT games/trivia/{id}`, `PUT games/bingo/{n}`; `tv` (GET, PATCH); `last-minute` (GET), `POST last-minute/{excursionId}`; `ready` (GET), `PUT ready/{id}`. Chat is under `/me/chat`: `messages` (GET, POST), `receipts` (GET, PUT), `seen`, `blocks` (GET), `PUT blocks/{id}`, `reports`, `photos`.

Rules are ported to `ServiceRules`, `CatalogueRules` and `TvAndGameRules`. **More writes to `dbo.FolioLines`**: a booking (`selection`), a top-up (`topup`, a credit), a prepaid gratuity (`gratuity`, a credit) and a last-minute tour (`tour`). Chat needs `dbo.ChatGroups` and `dbo.ChatGroupMembers` to contain the people who should talk to each other; the persona scripts have to create them (a person in no group who sends a message gets a group of their own).

## Smoke calls for Phase 10c (run against your database)

Use a persona aboard (set the demo clock to a sea day, then to a Cozumel morning for the last two) signed in as an adult.

```
H="authorization: Bearer $ACCESS"; N=$B/api/v1/bookings/PC243902; J='content-type: application/json'
curl -s -X POST $N/selections -H "$H" -H "$J" -d '{"item":"spa-swedish","day":2,"time":"13:00","qty":1}'
curl -s -X POST $N/requests -H "$H" -H "$J" -d '{"item":"towels","qty":2,"note":""}'
curl -s -X POST $N/drinks -H "$H" -H "$J" -d '{"drinkId":"beer"}'; curl -s $N/drinks -H "$H"
curl -s -X POST $N/money/top-ups -H "$H" -H "$J" -d '{"dollars":100,"source":"card"}'
curl -s -X PUT $N/money/pin -H "$H" -H "$J" -d '{"next":"1357"}'
curl -s -X POST $N/parties -H "$H" -H "$J" -d '{"title":"Birthday","day":3,"time":"20:00","cabins":["8101","8102"]}'
curl -s -X PATCH $N/tv -H "$H" -H "$J" -d '{"on":true,"channel":5}'
curl -s $N/last-minute -H "$H"; curl -s -X POST $N/last-minute/coz-glass -H "$H" -H "$J" -d '{"guests":["<guid>"]}'
curl -s $N/onboard/folio -H "$H"                                                 # the lines from all of the above
curl -s -X POST $B/api/v1/me/chat/messages -H "$H" -H "$J" -d '{"text":"Hello"}'; curl -s $B/api/v1/me/chat/messages -H "$H"
```

Check that `dbo.Selections`, `dbo.ServiceRequests`, `dbo.DrinkLogs`, `dbo.TopUps`, `dbo.OnboardAccount` (a salted `PinHash`), `dbo.Parties`, `dbo.PartyInvites`, `dbo.TvState`, `dbo.TourBookings` (`Source = onboard`), `dbo.ChatGroups`, `dbo.ChatGroupMembers` and `dbo.ChatMessages` rows appear, and that `dbo.FolioLines` has rows with `SourceType` `selection`, `topup`, `gratuity` and `tour`. None of `DapperAboardStore` or `DapperChatStore` has touched SQL Server yet. Requests need `ref.ServiceItems` and drinks need `ref.Drinks` seeded.

## Phase 11 endpoints

After the cruise: 25 routes, listed in `docs/backend-data-model.md` section 6.6 and in Swagger (tags `Disembarkation`, `Cases`, `After the cruise`, `Rebooking`). Under `/bookings/{number}`: `disembark` (GET), `PUT disembark/choice`, `PUT disembark/tags`, `disembark/customs` (GET, PUT), `disembark/onward` (GET, PUT), `disembark/night` (GET), `PUT disembark/night/{id}`, `disembark/final-bill` (GET), `PUT disembark/final-bill/tip`, `POST disembark/final-bill/email`; `cases` (GET, POST, `DELETE {id}`); `history`; `post-feedback` (GET, PUT); `rebook` (GET), `POST rebook/holds`, `DELETE rebook/holds/{id}`, `POST rebook/convert-fcc`, `POST` and `DELETE rebook/appointment`. Loyalty is `GET /me/loyalty-summary`.

Rules are ported to `DisembarkRules` and `PostCruiseRules`. **More writes to `dbo.FolioLines`**: the gratuity adjustment (`tip`), a future cruise credit changed to onboard credit (`fcc`) and the onboard credit that comes with a hold (`hold`). **Reference data**: `ref.Sailings` now also holds the four next-season departures (`BookingOpen = 0`), because `dbo.RebookHolds.SailingId` references it; re-run `db/seed/reference` (or `db/reset-db.ps1`). Discover, booking and `GET /sailings` still list only the priced, bookable sailings. The Future Cruise Desk slots in `ref.DeskSlots` are ship wall-clock times, as seeded.

## Smoke calls for Phase 11 (run against your database)

Use a persona on the last evening (set the demo clock to about 12:00 on day 7), signed in as an adult, then Grace Imani (`grace@demo.princess.example`) for the post-cruise ones.

```
H="authorization: Bearer $ACCESS"; N=$B/api/v1/bookings/PC243902; J='content-type: application/json'
curl -s $N/disembark -H "$H"                                                      # note a guest's id for the bags
curl -s -X PUT $N/disembark/choice -H "$H" -H "$J" -d '{"option":"tagged","bags":{"<guest guid>":2}}'
curl -s -X PUT $N/disembark/tags -H "$H" -H "$J" -d '{"on":true}'
curl -s -X PUT $N/disembark/customs -H "$H" -H "$J" -d '{"food":false,"cash":false,"goodsUsd":0,"note":""}'
curl -s -X PUT $N/disembark/onward -H "$H" -H "$J" -d '{"mode":"rideshare","flightAt":"14:30","flight":"UA 482","note":""}'
curl -s $N/disembark/night -H "$H"; curl -s -X PUT $N/disembark/night/carryOn -H "$H" -H "$J" -d '{"done":true}'
curl -s -X PUT $N/disembark/final-bill/tip -H "$H" -H "$J" -d '{"keepPercent":50}'; curl -s -X POST $N/disembark/final-bill/email -H "$H"
curl -s -X POST $N/cases -H "$H" -H "$J" -d '{"kind":"lostItem","summary":"Blue scarf left in the theatre","place":"Princess Theater","lineId":"","cents":0}'
curl -s -X POST $N/rebook/holds -H "$H" -H "$J" -d '{"departureId":"sun-2027-11-07"}'; curl -s $N/rebook -H "$H"
curl -s -X POST $N/rebook/appointment -H "$H" -H "$J" -d '{"at":<epoch ms of a slot in "slots">}'
curl -s $N/onboard/folio -H "$H"                                                  # the tip, hold credit and conversion lines
curl -s $N/history -H "$H"; curl -s -X PUT $N/post-feedback -H "$H" -H "$J" -d '{"overall":2,"areas":{"dining":2},"comment":"The cabin was never cleaned.","crew":[],"allowContact":true,"shareName":false}'
curl -s $B/api/v1/me/loyalty-summary -H "$H"
```

Check that `dbo.DisembarkChoices` and `dbo.DisembarkBags`, `dbo.Customs`, `dbo.OnwardPlans`, `dbo.NightTicks`, `dbo.FinalBill`, `dbo.Cases` (a `recovery` row with `FromFeedback = 1` after the poor feedback), `dbo.PostFeedback`, `dbo.RebookHolds` and `dbo.DeskAppointments` rows appear, and that `dbo.FolioLines` has rows with `SourceType` `tip`, `hold` and `fcc`. Stored rows from the persona scripts are read as far as they fit (a customs declaration with `goods`, an onward `Mode` of `flight`, feedback with the area scores at the top level). None of `DapperFinishStore` has touched SQL Server yet.

`npm run api:check` (Node, no server needed) compares every method of the TypeScript `Api` interface with the rows of section 6; `ApiSurfaceTests` compares the routes those rows state in full with the OpenAPI document.

## Deployment settings (security phase 2)

Off or closed unless configured (all but `Security:Contact` are on in `appsettings.Development.json`, and the tests turn on Swagger and Demo):

- `Swagger:Enabled` (default false), `Demo:Enabled` (default false: `/auth/demo-accounts` is 404).
- `AllowedHosts`: `localhost` in the base file; set the real host names per environment.
- `ForwardedHeaders:KnownProxies` (IPs), `ForwardedHeaders:KnownNetworks` (CIDR), `ForwardedHeaders:ForwardLimit`: set when behind a proxy so limits and the audit log see the client address.
- `RateLimit:RequestsPerMinute` (300), `Limits:MaxRequestBodyBytes` (1048576), `Limits:MaxConcurrentConnections` (2000).
- `Security:Contact`: the `mailto:` or `https:` contact in `/.well-known/security.txt`.
- `GET /health/providers` needs a sign-in; `/health` and `/health/db` stay open for probes.
- Static host headers for `dist/`: `docs/static-host-headers.md`.
