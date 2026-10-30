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

## Auth model

| | |
| --- | --- |
| Sign in | `POST /api/v1/auth/login` `{identifier, password}`; identifier is the email or the 10-digit account number. Returns an access token (15 min), a refresh token (30 days, stored only as a SHA-256 hash) and the person. |
| Refresh | `POST /api/v1/auth/refresh` `{refreshToken}`. The old token is spent and a new one issued. Presenting a spent token again revokes that whole session family. |
| Sign out | `POST /api/v1/auth/logout` `{refreshToken}` with the bearer token. |
| Who am I | `GET /api/v1/me`. |
| View as a child | `POST /api/v1/me/view-as/{childId}`, booker only. A 15 minute token whose `sub` is the child and `act` the booker. The child's supervised restrictions apply. |
| Lockout | 5 wrong passwords lock the account for 15 minutes. Wrong password, unknown account, locked account and a supervised child all return the identical 401 `badCredentials`. Login and refresh are also rate limited per IP (10 a minute). |

Every endpoint needs a signed-in user unless it opts out (`/health`, `/health/db`, login, refresh).

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
