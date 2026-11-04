# Backend data model and API surface (Phase 1)

Status: **Reviewed; section 9 questions answered. No SQL or C# has been written.** Written 2026-10-29 (revised the same day: BIGINT keys plus a public GUID, D1 and section 2) from `src/api/*Types.ts` and `src/domain/*`. Phase 2 turns section 4 into `db/01-schema.sql`; Phases 5 to 11 use section 6 as their checklist.

Sections: 1 Decisions settled here · 2 Conventions · 3 Reading the table notation · 4 Tables · 5 JSON columns · 6 API surface · 7 Authorisation rules · 8 Mock-only behaviour that needs a home · 9 Questions for you.

## 1. Decisions settled here

These close the open items in `backend-plan.md` section 2 and the "settle in Phase 1" notes. Say so if you disagree with any; the rest of the document follows from them.

| # | Topic | Decision | Why |
| --- | --- | --- | --- |
| D1 | Id strategy | **Reference rows keep their string ids** from the TypeScript source (`sun-2027-03-21`, `interior`, `coz-snorkel`) as `NVARCHAR(40)` primary keys. **User-owned rows use `Id BIGINT IDENTITY(1,1)` as the clustered primary key, and every foreign key is a `BIGINT`.** Each table that an API route addresses directly also has `PublicId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()` with a unique index: **the only id the API, frontend, URLs and logs ever show.** Child rows reached only through a parent have no `PublicId` (see section 2). **Booking number** (`PC482113`-style, 8 chars) and **account number** (10 digits) stay unique natural keys for people to type. Secret tokens (draft id, resume link, refresh token, pass code) are separate random values, never ids. | BIGINT keys keep joins and indexes small and fast. The guid stops people guessing or counting rows, and lets seeds set fixed `PublicId`s for idempotent `MERGE` and stable test ids. `NEWID()`, not `NEWSEQUENTIALID()`, because the value is exposed to clients; fragmentation does not matter as the clustered index is the BIGINT. |
| D2 | `PersonaId` | Becomes `Users.PublicId` on the wire (a guid string; `Users.Id` is internal). Every API field typed `PersonaId` becomes that guid string. The 12 personas keep a `Slug` (`gerald`, `maya`) column for seeds, logs and the test-accounts help text only. | The party is a set of users on a booking; no separate "persona" concept on the server. |
| D3 | Active booking | Journey-stage routes are `/bookings/{number}/...`. The mock's implicit "the signed-in person's booking" becomes an explicit route segment; the Phase 12 HTTP client holds the active booking number (from `GET /trips`) and fills it in, so screens do not change. | A real user can hold several bookings (current, linked agent booking, past). |
| D4 | The clock | Table `DemoState` (one row per user): `ClockOffsetSeconds`, `ClockSpeed`, `ActiveScenarios` (JSON array). **Only read when `Users.IsDemo = 1`.** "Now" for a demo user is `SYSUTCDATETIME() + offset` (speed is a client display concern; the server uses the offset at request time). Setting it for one user sets it for every user on the same booking, in one transaction, so the party stays in step. Real users always get real time. The API takes "now" from one `IClock` service so tests can pin it. | Keeps the persona-at-a-stage UAT, with no clock logic scattered through endpoints. |
| D5 | Scenarios | Server stores only which scenarios are active (`DemoState.ActiveScenarios`) and applies their **data effects** (tender delay, illness notice, price rise, plan changes, terminal change, port skipped, missing child, out-of-stock). The **fault rules** (forced `network`/`timeout`/`offline` errors) stay client-side in the HTTP layer. | Matches the plan. The 16 scenario ids are a closed list in code, not a table. |
| D6 | Time storage | All instants are `DATETIME2(0)` UTC. The API serialises as epoch milliseconds (`number`) to match the existing `at: number` fields. Date-only values (`dob`, departure, expiry) are `DATE`, serialised `"YYYY-MM-DD"`. Local ship/port times come from `ItineraryDays` + zone names in `Ports`/`Ships`. | No contract change for screens. |
| D7 | Money | `BIGINT` cents everywhere, named `...Cents`. Currency is USD in the data; display currency is a per-user preference. | As the UI does. |
| D8 | Enums | Stored as `VARCHAR` with a `CHECK (... IN (...))` listing the TypeScript union, not lookup tables. | The unions are closed, compile-time sets in both languages. A lookup table would add joins and nothing else. |
| D9 | JSON columns | `NVARCHAR(MAX)` with `CHECK (ISJSON(col) = 1)`, only for the UI-shaped blobs in section 5. Everything queried, joined, summed or authorised on is a real column. | As assumed in the plan, assumption 1. |
| D10 | Deletion | **Hard delete**, except `Bookings` (status `cancelled`), `Orders` (stage `cancelled`), `TourBookings`, `Purchases`, `Cases`, `Tickets` (stay visible as cancelled/withdrawn per the UI), and `HelperLinks` (status `revoked`). The privacy retention rules (`dataRules.ts`) run as a scheduled job that hard-deletes by `UserId` and records a `RetentionRuns` row. | Matches what the UI shows. |
| D11 | Concurrency | `RowVersion` on `Bookings`, `BookingDrafts`, `Profiles`, `DiningReservations`, `Orders`, `CheckinGuests`, `Budgets`, `RoomSettings`. API maps a stale write to `conflict`. Booking is idempotent on `BookingDrafts.Id` (unique `Bookings.DraftId`). | Matches "booking the same draft twice returns the first booking". |
| D12 | Passwords and tokens | PBKDF2-HMAC-SHA512, 600,000 iterations, 16-byte salt, in `Users.PasswordHash` (format `pbkdf2$iter$salt$hash`). Supervised children have `PasswordHash NULL` and cannot log in directly; the booker acts for them. Refresh tokens: random 256-bit, stored as SHA-256 in `RefreshTokens`, rotated on use, with a `FamilyId` so reuse of a spent token revokes the whole family. Access token 15 minutes. | Built-in .NET, no extra dependency. Argon2 would need a package; PBKDF2 at this cost is acceptable. |
| D13 | Supervised children and sign-in | The mock lets you "be" a child persona to see their view. Real design: a child is a `Users` row with `IsSupervised = 1`, and their booker can **view as** them through a `POST /me/view-as/{userId}` that issues a short-lived token carrying `act` (the booker) and `sub` (the child). All "supervised account" `forbidden` rules key off `sub`. | Keeps the child-account UAT without giving children passwords. |
| D14 | Public endpoint | `GET /pass/lookup?number=&lastName=` is the only unauthenticated data endpoint besides `/auth/login`, `/auth/refresh`, `/health`. Same `notFound` for every mismatch; rate-limited per IP and per booking number. | As in the plan, section 7. |
| D15 | Currency of truth for rules | Pricing, fares, promotions, cancel terms, change check, price protection, entitlements, dining slot rules, order pricing and staging, drink caps, kid-club age rules, muster rules and name-change rules are **ported to C#** in the phase that needs them. The server is the authority. TypeScript copies stay for display. | Plan assumption 8. |

## 2. Conventions

- Schema name: everything in `dbo` except `ref` (reference data) and `demo` (`DemoState`, `RetentionRuns`). Three schemas make "reset persona data without touching reference data" a simple rule: persona scripts only write to `dbo` and `demo`; reference scripts only write to `ref`. (`demo` holds only `DemoState`; `RetentionRuns` is in `dbo`.)
- **Ids.** In the tables below, `Id ID* PK` means `BIGINT IDENTITY` clustered. **Every table with `Id ID* PK` also has `PublicId PUB* UQ` (not repeated in each column list) unless listed here as having none:** `PaymentParts`, `OrderLines`, `BookingGuestDetails`, `BookingGuestTags`, `TourBookingGuests`, `TourCartGuests`, `DiningReservationGuests`, `GroupTableFriends`, `WaitlistGuests`, `PurchaseGuests`, `ShowTicketGuests`, `HealthReportGuests`, `PhotoPurchaseItems`, `MedallionGuests`, `ServiceMessages`, `ChatReads`, `PartyInvites`, `NotificationsSent`, `RefreshTokens`, `AuthChallenges`, `IdempotencyKeys`, `AccessLog`, `ProfileTags`. Tables keyed by a pair or a parent's key (for example `Profiles.UserId`, `CheckinBooking.BookingId`) have no `Id` or `PublicId`.
- **The API never accepts or returns an internal `Id`.** Routes and payloads carry `PublicId` only; the API resolves it to `Id` once per request (indexed seek), then joins on `Id`. Dapper query code and DTOs are reviewed for this in every C# phase. `Users` and `Bookings` are always resolved first because every authorisation check starts there.
- **Seeds** set `PublicId` explicitly (fixed guids for personas and scenario rows, kept in the persona catalogue) and find rows by natural key (`Slug`, `Number`, `AccountNumber`) or `PublicId`, never by a hard-coded `Id`.
- Every table in `dbo` has `CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()`. Mutable ones also have `UpdatedAt`. Not repeated in the column lists below.
- Every user-owned table carries `UserId` (the owner) **or** `BookingId` (booking-scoped) so authorisation is one join (`BookingGuests` gives membership). Tables carrying both are marked.
- Foreign keys are real and named `FK_<Child>_<Parent>`; `ON DELETE CASCADE` from `Users` and `Bookings` to their child rows (so a retention delete is one statement), `NO ACTION` everywhere else.
- Checks use named constraints `CK_<Table>_<Column>`.
- Index naming `IX_<Table>_<Cols>`; unique `UX_<Table>_<Cols>`. Only indexes with a stated reason are listed.
- **Defaults are named** `DF_<Table>_<Column>`, so a column can be altered or dropped without looking the generated name up. The script is not an upgrade script: a table change means resetting the database.
- **Reserved words are not column names.** `Key`, `Option`, `Group`, `On`, `Rule`, `Plan`, `Count` were renamed (`StateKey`, `RequestKey`, `OptionId`/`OptionCode`, `ItemGroup`, `IsOn`, `RuleName`/`RuleJson`, `PlanCode`, `PhotoCount`), so no query needs `[brackets]` for them. `At`, `Day`, `Text`, `Time`, `Log` are not reserved and stay.
- **A person on a booking row is a person on the booking.** Every per-person child table (`TourBookingGuests`, `TourCartGuests`, `DiningReservationGuests`, `WaitlistGuests`, `PurchaseGuests`, `ShowTicketGuests`, `HealthReportGuests`, `MedallionGuests`, `OrderLines.GuestUserId`, `ClubRegistrations`, `FamilyZones`, plus the check-in tables) carries `BookingId` and a foreign key to `BookingGuests (BookingId, UserId)`. Where the parent has an `Id`, the child references `(ParentId, BookingId)` against a `UX_<Parent>_Id_BookingId` unique key, so a child cannot point at another booking's parent. The `BookingGuests` key is `NO ACTION` (a second cascade path is not allowed); the row goes with its parent or its user through the other keys.
- **Day-bound rows carry `SailingId`** (`TourBookings`, `DiningReservations`, `ShowTickets`): `(BookingId, SailingId)` must match `Bookings (Id, SailingId)` and `(SailingId, Day)` must be a real `ref.ItineraryDays` row, so a booking cannot hold a tour on a day its sailing does not have. Inserts take `SailingId` from the booking row.
- **One confirmed booking per cabin per sailing:** `UX_Bookings_SailingId_CabinNumber` (filtered to confirmed, cabin assigned). It is also the free-cabin lookup.
- Every foreign key that a cascade or a lookup walks has an index that leads with the key column (or `UserId, BookingId` for the person keys), so a retention delete never scans a child table.

## 3. Reading the table notation

`Col TYPE` with `*` = NOT NULL, `?` = NULL, `PK`, `FK→Table`, `UQ`, `{a|b|c}` = CHECK list, `[json]` = JSON column (section 5). Types: `ID` = BIGINT internal key (identity for a PK, plain BIGINT for an FK); `PUB` = the `PublicId` UNIQUEIDENTIFIER, `STR(n)` = NVARCHAR(n), `INT`, `BIG` = BIGINT cents or counts, `BIT`, `DATE`, `TS` = DATETIME2(0), `TXT` = NVARCHAR(MAX). "API:" names the `Api` group that reads (R) and writes (W) the table.

## 4. Tables

### 4.1 Identity (`dbo`)

**Users** — API: auth R/W, account R/W, everything for authorisation.
`Id ID* PK` · `Slug STR(30)? UQ` (seed personas only) · `AccountNumber CHAR(10)* UQ` (digits, generated; `CHECK LIKE '[0-9]{10}'` via 10 × `[0-9]`) · `Email STR(254)? UQ filtered (NOT NULL)` · `PasswordHash STR(200)?` · `Role {guest|staff|admin}*` default `guest` · `IsDemo BIT*` · `IsSupervised BIT*` · `BookerUserId ID? FK→Users` (required when supervised) · `Tier {none|gold|ruby|platinum|elite}*` · `Sanctuary BIT*` · `TextSize STR(12)*` default `standard` · `PhoneZone STR(40)*` default `America/Chicago` · `Currency CHAR(3)*` default `USD` · `Locale STR(10)*` default `en` · `LockedUntil TS?` · `FailedLogins INT*` · `LastLoginAt TS?` · `RowVersion`.
Checks: supervised ⇒ `BookerUserId NOT NULL AND PasswordHash IS NULL`; not supervised ⇒ `PasswordHash IS NOT NULL OR IsDemo = 0` (a non-demo adult must have a password).
Indexes: `UX_Users_Email` filtered; `UX_Users_AccountNumber`; `IX_Users_BookerUserId`.

**Profiles** — account R/W (`account.profile`, `saveProfile`).
`UserId ID* PK FK→Users` · `FirstName STR(60)*` · `LastName STR(60)*` · `Dob DATE*` · `Phone STR(30)?` · `Citizenship {us|other}*` · `Bedding {queen|twin|noPreference}*` · `SpecialRequests STR(500)*` · `EmergencyName STR(80)*` · `EmergencyPhone STR(30)*` · `EmergencyRelationship STR(40)*` · `Street/City/Region/Postcode/Country` (`STR`, lead contact address, nullable) · `RowVersion`.
Email lives on `Users`. `dietary` and `needs` lists are in `ProfileTags` (below) so the data is queryable ("who has a nut allergy" for the dining reservation pass-through).

**ProfileTags** — `UserId ID* FK→Users` · `Kind {dietary|need}*` · `Code STR(20)*` · PK (`UserId, Kind, Code`). Codes are the `DietaryId` and `NeedId` unions.

**RefreshTokens** — auth W.
`Id ID* PK` · `UserId ID* FK→Users` · `FamilyId ID*` · `TokenHash BINARY(32)* UQ` · `ExpiresAt TS*` · `UsedAt TS?` · `RevokedAt TS?` · `ReplacedById ID?` · `UserAgent STR(200)?` · `Ip VARCHAR(45)?`.
Index: `IX_RefreshTokens_UserId_FamilyId`.

**AuthChallenges** — auth W (Phase G4). One-time codes for password reset and email sign-in.
`Id ID* PK` · `UserId ID* FK→Users` · `Purpose {reset|magic}*` · `CodeHash BINARY(32)*` (SHA-256 of `purpose:userId:code`) · `Attempts INT*` · `ExpiresAt TS*` (15 minutes) · `UsedAt TS?`.
Index: `IX_AuthChallenges_UserId_Purpose`. A new request spends the older codes; five wrong tries end a code.

**Outbox** — delivery W (Phase G4). Every message the stub sender "sends".
`Id ID* PK` · `PublicId PUB* UQ` · `UserId ID?` (no FK) · `Channel {email|sms|push}*` · `Category STR(10)*` · `ToAddress STR(254)*` · `Subject STR(150)*` · `Body STR(1000)*` · `Status {queued|sent|failed}*` · `SentAt TS?`. A real sender replaces the stub and works through `queued` rows.

**HelperLinks** — account R/W (`helper`, `saveHelper`, `revokeHelper`).
`Id ID* PK` · `GuestUserId ID* FK→Users` (the guest who consents) · `HelperName STR(80)*` · `HelperUserId ID? FK→Users` (set once the helper has an account) · `Relationship STR(40)*` · `Permissions [csv view,documents,payments,profile]` stored as `Permissions STR(60)` · `Status {requested|active|revoked}*` · `ChangedAt TS*`.
Check: `active` ⇒ `Permissions` contains `view`. Unique filtered (`GuestUserId`) where status ≠ `revoked` (one live helper, as the UI has one).

**HistoryEntries** — `account.history` R; written by every mutating call.
`Id ID* PK` · `UserId ID* FK→Users` (whose record) · `ByUserId ID* FK→Users` · `What {profile|documents|payment|card|helper|trip|notifications|booking|tour|dining|purchase|assistance|travel|checkin}*` · `Detail STR(300)*` · `At TS*`. Index `IX_HistoryEntries_UserId_At`.

**SavedCards** — payments R/W (`addCard`, `removeCard`), pay screens.
`Id ID* PK` · `UserId ID* FK→Users` · `Brand {visa|mastercard|amex|discover}*` · `Last4 CHAR(4)*` · `Expiry CHAR(5)*` (`MM/YY`) · `IsDefault BIT*` · `GatewayToken STR(100)?` (null in the mocked gateway). Only brand, last four and expiry are ever stored. Unique filtered (`UserId`) where `IsDefault = 1`.

**Notices** — notifications R/W.
`Id ID* PK` · `UserId ID* FK→Users` · `Kind STR(30)*` · `Severity {info|important|urgent}*` · `Title STR(120)*` · `Body STR(1000)*` · `LinkRoute STR(120)?` · `ReadAt TS?` · `At TS*`. Index `IX_Notices_UserId_At`.

**NotificationPrefs** — `UserId ID* PK FK→Users` · `Prefs [json]` (the `NotificationPrefs` object; channel × category matrix, quiet hours).

**PushSubscriptions** — push. `Id ID* PK` · `UserId ID* FK→Users` · `Endpoint STR(450)* UQ` · `P256dh STR(200)*` · `Auth STR(200)*` · `Budget {0|1|3|5}*` · `Calm BIT*` · `Watch STR(900)*` (event ids, space separated) · `CreatedAt` · `UpdatedAt`. At most five per person.

**PushDeliveries** — the delivery log. `Id ID* PK` · `UserId ID* FK→Users` · `NoticeKey STR(120)*` (stable for one occasion, so a notice is sent once) · `Kind STR(20)*` · `Bypass BIT*` (safety notices skip the limits) · `Outcome {sent|held}*` · `Reason {channelOff|calm|quiet|budget}?` · `Devices TINYINT*` · `Params STR(500)*` (json) · `ReadAt TS?` · `At TS*`. Newest 200 kept per person.

**CalendarFeeds** — `UserId ID* PK FK→Users` · `TokenHash CHAR(64)* UQ` (SHA-256 of the address token; the token itself is never stored) · `CreatedAt TS*`.

**ShareLinks** — read-only caregiver and advisor links (next-level plan N4.6). `Id ID* PK` · `PublicId GUID* UQ` · `BookingId ID* FK→Bookings` (cascade) · `UserId ID* FK→Users` (who made it and whom it is about) · `Kind STR(9)*` (`caregiver`, `advisor`) · `Label STR(40)*` · `TokenHash CHAR(64)* UQ` (SHA-256 of the address token; never the token) · `ExpiresAt TS*` · `LastCheckInAt TS?` · `Note STR(200)*` · `CreatedAt TS*`. Deleting a row ends access at once.

**ConsentChoices** — privacy R/W (`setConsent`).
`UserId ID* FK→Users` · `ConsentId STR(30)*` · `On BIT*` · `ChangedByUserId ID* FK→Users` · `At TS*` · PK (`UserId, ConsentId`). Consent ids from `privacy.ts`.

**AuditEvents** — the audit trail (`docs/audit-trail.md`): append-only, no foreign keys, actor and subject by `PublicId`. See the file for columns and what is recorded.

**AccessLog** — privacy R. `Id BIGINT IDENTITY PK` · `UserId ID* FK→Users` (whose data) · `Actor STR(80)*` · `Purpose STR(120)*` · `At TS*`. Index `IX_AccessLog_UserId_At`.

**RetentionRuns** — privacy R. `Id ID PK` · `UserId ID* FK→Users` · `RuleName STR(30)*` · `Kinds STR(200)*` · `At TS*`.

**SupportTickets** — support R/W.
`Id ID* PK` · `UserId ID* FK→Users` · `Kind {callback|email}*` · `Status {open|inProgress|done}*` (the `TicketStatus` union) · `Detail STR(1000)*` · `At TS*`.

**Favourites** — discover R/W (`favourites`, `toggleFavourite`) **and** `ahead.saved` R/W (same concept: keys `item:…`, `excursion:…`, `kind:id`). `UserId ID* FK→Users` · `ItemKey STR(80)*` · `Position INT*` · PK (`UserId, ItemKey`).

**JourneyEvents** — stage engine W (`POST /me/journey/events`, and `POST /booking/quote` records `priceView`), read by `GET /me/context`. What a guest did that shows interest in a sailing, or that they are at the terminal; the stage itself is never stored (`docs/stage-experience-plan.md` section 3). `Id ID* PK` · `UserId ID* FK→Users` · `Kind {lookCloser|priceView|cabinView|sharedAccepted|planImported|atTerminal}*` · `SailingId STR(40) FK→ref.Sailings` · `At TS*` (the guest's own "now", so a demo account's clock and stage agree). An intent event keeps a sailing in focus for 24 hours, as a quote does.

**UserState** — state R/W (multi-device, `docs/multi-device-plan.md`). One small JSON document per person and key, so settings and device-only stores follow the guest to every device. `UserId ID* FK→Users` · `StateKey STR(30)*` (a fixed whitelist in `StateRules`: `settings`, `offers`, `shop`, `phone`, `memory`, `health`, `travellers`, `reminder`, `concierge`, `calm`, `family`, `pilot`, `trip`, `hub`; `travellers` holds the saved travellers (names, dates of birth, citizenship; never a passport number) and is encrypted and consent-gated like `health`; `reminder` holds `{ at, sailingId, email }` (or `{}`; `email` asks for one reminder email, sent by `IEmailSender`, with a no-sign-in unsubscribe link at `GET /public/reminder/unsubscribe/{token}`) in the clear because the push service reads it to send one note when `at` has passed; `concierge` is the AI conversation (newest 60 messages), held back by `syncPrivate` like `memory`; `health` holds the medical card, access profile and allergy flag, `calm` the sensory / calm profile and `family` the family-at-home contacts, links and link secret; all three are stored as `{"enc": ...}` encrypted with ASP.NET Data Protection and written only while `settings.syncPrivate` is true, and `pilot` and `hub` no longer carry those parts) · `Json [json]*` · `Version INT*` (starts at 1, +1 per save; a save names the version it was based on) · PK (`UserId`, `Key`).

**ConciergeUses** — the concierge's hourly limit R/W (multi-device plan 3, Phase 6). One row per question that reached the model, so the limit of 20 an hour per person holds across restarts and instances; rows older than an hour are deleted on the next question. `Id ID` · `PublicId GUID` · `UserId ID FK→Users` (cascade) · `UsedAt DT*` · `CreatedAt DT*`.

**FamilyLinks** — family-at-home links R/W (multi-device plan 2, Phase 6). One row per link a guest has shared: the server signs the link (HMAC of owner, link and expiry with a key derived from the token signing key) and this row is what makes it revocable. `Id ID` · `PublicId GUID` · `UserId ID FK→Users` (cascade) · `ExpiresAt DT*` · `RevokedAt DT` · `CreatedAt DT*`. Holds no name or address: the contacts stay in the encrypted `family` document.

**StaffTickets** — guest services requests R/W (multi-device plan 3, Phase 5). One row per call back, caregiver visit or sensory kit the guest asked for, so a desk can read the queue and every device shows the same ticket. `Id ID` · `PublicId GUID` · `UserId ID FK→Users` (cascade) · `Kind` (`callback|caregiver|kit`) · `Reason` (callbacks: `urgent|changes|health|other`; else empty) · `RequestedAtMs`, `Position`, `ReadyAtMs` (as the queue answered) · `Source` · `CancelledAt DT` · `CreatedAt DT*`.

**FamilyPostcards** — "we're OK" postcards R/W. What a link's public page shows. `Id ID` · `PublicId GUID` · `UserId ID FK→Users` (cascade) · `Kind STR(10)*` (`ok`, `sea`, `port`, `late`, `love`) · `Note STR(140)*` · `SentAt DT*` · `MediaId GUID?` (GuestMedia.PublicId, no foreign key: SQL Server refuses a second cascade path from Users; the media store clears it when a picture is deleted) · `CreatedAt DT*`.

*Decision:* one table serves both groups (the two lists are the same key space in the UI).

**GuestMedia** — guest pictures R/W (N7). One row per picture a guest kept, cleaned of EXIF and other metadata before it is stored. `Id ID` · `PublicId GUID` · `UserId ID FK→Users` (cascade) · `Purpose STR(10)*` (`cabin`, `book`, `postcard`) · `Reference STR(40)*` (a stateroom category for `cabin`, a cruise day `1` to `8` or `cover` for `book`, empty for `postcard`) · `Kind STR(12)` (`room`, `view`, `obstruction`, `noise` for `cabin`; empty otherwise) · `Caption STR(140)` · `ContentType STR(12)*` (`image/jpeg`, `image/png`) · `Width INT*` · `Height INT*` · `ByteCount INT*` · `Status STR(10)*` (`pending`, `approved`, `rejected`) · `Data BLOB*` · `CreatedAt DT*`.

**DemoState** (`demo`) — new demo endpoints.
`UserId ID* PK FK→Users` · `ClockOffsetSeconds BIGINT*` · `ClockSpeed INT*` · `ActiveScenarios [json array]` · `UpdatedAt`.

### 4.2 Reference data (`ref`, read-mostly, seeded in Phase 3)

All have string primary keys equal to the current TypeScript ids.

**Ships** — `Id` · `Name` · `Class` · `Decks INT` · `Tonnage` · `Capacity INT` · `HomeZone STR(40)` · `ProfileJson [json]` (the `shipInfo`/`ship` profile text) · catalogue columns `LengthFt`, `BeamFt`, `Crew`, `Staterooms`, `Entered`, `Intro` and `Depth {browse|aboard}`. Three rows from X0b: Sun Princess (`aboard`), Sky Princess and Sapphire Princess (`browse`).
**Decks** — `ShipId FK` · `Number INT` · `Name` · `Summary` · PK (`ShipId, Number`). (`deck.ts`)
**CabinCategories** — `Id` ({interior|oceanview|balcony|miniSuite|sanctuaryMiniSuite|signatureSuite}) · `Name` · `IsSuite BIT` · `Capacity INT` (4, signature suite 3) · `SizeSqFt INT` · `Description` · `Features [json]` · `SortOrder INT` · `ShipId FK` (default `sun-princess`; categories differ by ship, the browse ships carry sample categories).
**Cabins** — `ShipId` · `Number STR(8)` · `CategoryId FK` · `Deck INT` · `Section {fwd|mid|aft}` · `Side {port|starboard}` · `Accessible BIT` · `Connecting BIT` · `MusterStationId FK` · PK (`ShipId, Number`). Sample set as `booking.cabins` shows ("sample staterooms … which are free"); full deck plan is out of scope.
**Ports** — `Id` ({fll|sea|cozumel|belize|roatan}) · `Name` · `Country` · `TimeZone STR(40)` · `Tender BIT` · `EntryNote` (from `PORT_ENTRY`) · `Contacts [json]` (`PortContacts`) · catalogue columns `RegionId FK→Regions?`, `CountryCode CHAR(2)?`, `Lat/Lon DECIMAL?`, `Currency CHAR(3)?`, `Languages [json]`, `Tier {A|B|C}?`, `GuideStatus {none|link|short|full}`, `ArtId?`. The id set is open from X0b (about 120 ports across three ships).
**Regions** — `Id` · `Name` · `SortOrder INT`. Caribbean, Western Mediterranean and so on (X0b, `db/seed/catalogue`).
**Terminals** — `Id` · `PortId FK` · `Name` · `Address` · `Notes`. Optional; empty at first.
**ItineraryPatterns** — `Id` (`carib-west-a`) · `Name` · `RegionId FK` · `Nights INT` · `StartPortId FK` · `EndPortId FK` · `Description`. A repeating route shape.
**ItineraryPatternDays** — `PatternId FK` · `Day INT` · `PortId FK` (`sea` for a sea day) · `ArriveLocal/DepartLocal/AllAboardLocal TIME?` · `ClockChangeHours INT?` · `ClockChangeAtLocal TIME?` · PK (`PatternId, Day`). `Nights + 1` rows per pattern.
**SailingLegs** — `SailingId FK` · `LegNo INT` · `PatternId FK` · `StartDay INT` · PK (`SailingId, LegNo`). The legs a sailing is made of; joined legs share their turnaround day.
**SailingFares** — `SailingId FK` · `CategoryId FK` · `PerNightCents BIGINT` · PK (`SailingId, CategoryId`). Price in data, per person per night for two sharing. Written for the catalogue sailings; `Pricing` reads it from X0c, and the 12 older Sun Princess sailings are backfilled then.
**DressNights** — `SailingId FK` · `Day INT` · `Code {casual|smart|elegant}` · PK (`SailingId, Day`). Worked out at seed time from the sailing's length (two elegant evenings per 7 nights, one on a 5 or 6 night cruise).
**Sailings** — `Id` (`sun-2027-03-21`) · `ShipId FK` · `Departure DATE` · `Nights INT` · `IsHoliday BIT` · `IsReference BIT` · `Title` · `BookingOpen BIT` (computed in the API as "≥ 1 day to go"; stored flag only for manual closing) · catalogue columns `PatternId FK?` (first leg), `StartPortId FK?`, `EndPortId FK?`, `LegCount INT`, `RegionId FK?`, `DataStatus {served|sample|verified}`. The unique index is `(ShipId, Departure, Nights)`: one ship offers the same departure as 7, 14 and 21 nights.
**ItineraryDays** — `SailingId FK` · `Day INT` · `Date DATE` · `PortId FK` · `ArriveLocal TIME?` · `DepartLocal TIME?` · `AllAboardLocal TIME?` · `ClockChangeHours INT?` · `ClockChangeAtLocal TIME?` · PK (`SailingId, Day`). Template for all 8 sailings is identical; stored per sailing so a skipped port is data.
**MusterStations** — `Id` · `ShipId FK` · `Name` · `Place` · `Deck INT`.
**Venues** — `Id` · `Kind {main|specialty|casual}` · `Name` · `Cuisine` · `Deck INT` · `DressCode {casual|smart|elegant}` · `Capacity INT` · `Walkin BIT` (queueable) · `OpenFrom/OpenTo TIME` · `CoverCents BIGINT` · `Description` · `Hours [json]` (per day overrides).
**Menus / MenuItems** — `MenuItems`: `Id` · `VenueId? FK` · `MenuGroup {mains|snacks|desserts|drinks|breakfast}` · `Name` · `Description` · `PriceCents BIGINT` · `Dietary [json array]` · `Orderable BIT` · `Stock INT?`; `MenuExtras`: `Id` · `ItemId FK` · `Label` · `Cents`. (`menus.ts`, `orders.ts` `MenuItem`)
**Excursions** — `Id` (`coz-snorkel`) · `PortId FK` · `Name` · `Interest` · `Activity {easy|moderate|strenuous}` · `AdultCents` · `ChildCents` · `MinAge INT` · `DurationMin INT` · `StartLocal TIME` · `BackByLocal TIME` · `Tender BIT` · `Capacity INT` · `Meeting` · `Description` · `Tags [json]`. `ExcursionDepartures`: `ExcursionId` · `SailingId` · `Day INT` · `SpotsTotal INT` — spots left = total − booked guests.
**Events** — `Id` · `Kind` · `Title` · `Place` (venue/place id) · `StartLocal TIME` · `DurationMin` · `AgeGroup {all|kids|teens|adults}` · `Interests [json]` · `Ticketed BIT` · `Seats INT?` · `Deck`; `EventDays` (`EventId`, `SailingId`, `Day`, `StatusOverride`) so the schedule per day and the `planChange` scenario (move/cancel) are data, not code. (`program.ts`)
Phase 3 adds columns to the tables above (needed to hold the authored data; see `db/README.md`): `MenuItems` + `Alcohol BIT`, `Packaged BIT`, `OnMenus [json]`, `SubstituteId?`; `Events` + `ExtraCents BIGINT`, `AfterAllAboard BIT`; `Excursions` + `Rating INT` (tenths), `Reviews INT`; `Excursions` + `WalkKm DECIMAL(4,1)?`, `Steps BIT?`, `Heat`, `Shade` (`low|medium|high`, nullable), `Seats BIT?`, `Restrooms BIT?`, `Wet BIT?` (difficulty on foot; NULL when none is authored); `AddOns` + `ChangeAtDays INT?`, `ChangeShare INT?` (basis points), `MinAge INT`; `PackageUpgrades` + `ChangeAtDays`, `ChangeShare`.

**Fares** — `Id` ({standard|plus|premier}) · `Name` · `PerNightCents` · `Tagline`.
**Promotions** — `Id` ({earlyCredit}) · `MinDaysOut INT` · `CreditCentsStandard` · `CreditCentsSuite`.
**Packages** — `Id` ({plus|premier}) and **AddOns** — `Id` ({drinks|wifi|specialtyPass|photo|laundry}) · `Unit {personNight|person|room}` · `BaseCents` · `ChangeOn DATE` · `ChangesToCents` (price-protection data) · `Description`. `PackageUpgrades`: `ToPackageId` · `PriceCents` · `ChangeOn` · `ChangesToCents`. `Entitlements`: `Tier` / `PackageId` → `DrinkCapUsd`, `WifiDevices`, `SpecialtyMeals`, `ExcursionCreditUsd`, `PhotoIncluded`, `LaundryBags`, `Priority BIT` — the table form of `computeEntitlements`'s inputs; the **function** is ported to C#.
**PhotoCatalogue** — `Id` · `Day INT` · `Place` · `Caption` · `Thumb STR(200)` · `PhotographerSlot` (`PhotographerSlots`: `Day`, `Place`, `StartLocal`). Photo pricing options (`OptionId` table `PhotoOptions`: `Id`, `Cents`, `Count`, `Description`).
**CrewMembers** — `Id` · `Name` · `Role {steward|dining|entertainment|guest}` · `ShipId FK`.
**Advisors** — `Id` · `Name` · `Agency` · `Region` · `Languages [json]` · `Speciality {family|luxury|accessible|groups|first}` · `Hours` (from `ahead.ts`).
**Faqs / HelpTopics / ContentBlocks** — `Id` · `Area` · `Title` · `Body TXT` · `Locale` · `SortOrder`. Holds `help.ts`, `safety` text, legal documents (see below), and authored copy that the UI today ships in `src/i18n`/`domain`. UI chrome strings stay in the frontend.
**LegalDocs** — `Id` ({terms|health|age|pregnancy}) · `Version` · `Title` · `Statement` · `Body [json array]`. PK (`Id, Version`).
**ServiceItems** (housekeeping/maintenance request catalogue): `Id` · `ItemGroup {housekeeping|maintenance}` · `EtaMin` · `MaxQty`. **Drinks**: `Id` · `Cents` · `Alcohol BIT`. **Clubs** (family): `Id` ({firefly|neon-grove|underground}) · `Name` · `MinAge` · `MaxAge` · `Deck` · `OpenFrom/OpenTo`. **TravelWindows** (arrival windows): `Id` · `StartLocal` · `EndLocal` · `Priority BIT`. **NightChecklistItems**, **PackingItems** (`Id`, `Label`, `RuleJson [json]`), **ChecklistItems** (`Id`, `Phase`, `DueDaysBefore`, `Label`), **AdvisorQuiz** *stays in code* (pure scoring over `CabinCategories`).

### 4.3 Bookings and money (`dbo`)

**Bookings** — API: booking, trips, payments R/W; every journey route authorises through it.
`Id ID* PK` · `Number CHAR(8)* UQ` (letters/digits, as `normalizeBookingNumber`) · `Kind {direct|agent}*` · `AgentName STR(80)?` · `BookerUserId ID* FK→Users` · `SailingId FK→ref.Sailings*` · `CategoryId FK→ref.CabinCategories*` · `CabinNumber STR(8)?` (null = guaranteed) · `FareId FK→ref.Fares*` · `Status {confirmed|cancelled}*` · `Dining {anytime|early|late}*` · `Occasion {none|birthday|anniversary|honeymoon|other}*` · `TotalCents BIG*` · `DepositCents BIG*` · `FinalDueDate DATE*` · `FinalPaymentDays INT*` (90, or 10 for late bookers) · `LoyaltyNumber STR(9)?` · `DiscountCents BIG*` · `CreditUsedCents BIG*` · `DraftId STR(40)? UQ` · `ContactEmail/ContactPhone` (copy at booking) · `ConfirmedAt TS*` · `CancelledAt TS?` · `CancelFeeCents BIG?` · `CancelRefundCents BIG?` · `RowVersion`.
Checks: `DepositCents <= TotalCents`; cancelled ⇒ `CancelledAt NOT NULL`. Indexes: `UX_Bookings_Number`, `IX_Bookings_BookerUserId`, `IX_Bookings_SailingId`.
`paid`, `balance` and `payment` state are **computed** from `Payments`, never stored.

**BookingGuests** — membership table for authorisation.
`BookingId ID* FK→Bookings` · `UserId ID* FK→Users` · `Seq INT*` (1-based, boarding order) · `IsLead BIT*` · `Printed STR(80)*` (`WHITFIELD/GERALD`) · PK (`BookingId, UserId`). Unique (`BookingId, Seq`). A **linked agent booking** gets its guests as `Users` rows with `IsSupervised`/no-login flag only if they have accounts; otherwise guests are stored only in `BookingGuestDetails`.

**BookingGuestDetails** — the per-guest answers captured in the funnel (the `GuestDraft` of a confirmed booking), for people with no account yet.
`BookingId` · `Seq` · `UserId ID?` · `FirstName/LastName` · `Dob DATE` · `Gender {F|M|X}` · `Citizenship {us|other}` · `DietaryStatus {none|some}` · `AllergyNote STR(300)` · PK (`BookingId, Seq`). Needs/dietary codes in `BookingGuestTags` (`BookingId, Seq, Kind, Code`).

**BookingDrafts** — booking.draft R/W.
`Id STR(40)* PK` (random, unguessable — resume link) · `UserId ID* FK→Users` · `SailingId?` · `CategoryId?` · `Guests INT*` · `CabinMode {guaranteed|pick}*` · `CabinNumber?` · `FareId?` · `Dining?` · `Occasion*` · `LoyaltyNumber?` · `UseCredit BIT*` · `Accepted [json]` · `People [json]` (array of `GuestDraft`) · `Contact [json]` · `Step STR(10)?` · `UpdatedAt` · `RowVersion`. One live draft per user: unique (`UserId`). Pricing quote is recomputed, never stored.

**QuoteLocks** — price held 24 hours. `DraftId FK` · `LockedUntil TS` · `TotalCents BIG` · `QuoteJson [json]`. Used for the `priceChanged` check.

**Payments** (receipts and ledger) — payments R, booking R/W, plan/packages/tours/upgrades W.
`Id ID* PK` · `BookingId ID* FK→Bookings` · `UserId ID* FK→Users` (who paid) · `Label {deposit|full|balance|refund|tour|purchase|photo|upgrade|checkin}*` · `AmountCents BIG*` (negative = refund) · `At TS*` · `Reference STR(40)*` · `Status {captured|declined|refunded}*` · `RelatedType STR(20)?` · `RelatedId ID?`. Index `IX_Payments_BookingId_At`.
**PaymentParts** — one per method: `PaymentId FK` · `Seq INT` · `Method {card|wallet}` · `CardId ID? FK→SavedCards` · `CardBrand/Last4` (snapshot) · `Cents BIG` · `ChallengeUsed BIT`. (`checkParts`: ≤ 2 parts, sums exactly.)
**IdempotencyKeys** — `RequestKey STR(80)* PK` · `UserId` · `Route STR(80)` · `ResponseHash` · `CreatedAt`. Used for `book`, `checkout`, `buy`, `payBalance`.

**Acceptances** — `BookingId FK` · `LegalId` · `Version` · `At TS` · PK (`BookingId, LegalId`).
**NotificationsSent** — `BookingId FK` · `Via {email|sms}` · `ToMasked STR(80)` · `At` (the `notified` list on `BookingView`).
**ResumeLinks** — `DraftId FK` · `Via` · `ToMasked` · `LinkToken CHAR(32) UQ` · `SentAt` · `ExpiresAt`.
**PastTrips** — `Id STR(40) PK` · `UserId ID FK→Users` (booker) · `Title` · `Ship` · `Departure DATE` · `Nights INT` · `Cancelled BIT` · `FareCents BIG?`. Real prior bookings are *not* back-filled into `Bookings` (history only), per the UI's `PastTrip` shape. Plus `PastTripDocs` (`PastTripId`, `Doc {fareReceipt|folioStatement|gratuityStatement|taxSummary}`, `Ready BIT`).
**Loyalty** — `UserId ID PK FK→Users` · `Number CHAR(9)* UQ` · `Tier` (duplicates `Users.Tier`; **kept only on `Users`** — this table holds `Number`, `DaysCounted INT`, `ReferralCode STR(12)`, `ReferralCreditCents BIG`).
**FutureCruiseCredits** — `Id ID PK` · `UserId FK` · `OriginalCents BIG` · `RemainingCents BIG` · `ExpiresOn DATE` · `Source STR(40)` · Check `RemainingCents BETWEEN 0 AND OriginalCents`.
**Referrals** — `Id ID` · `UserId FK` (referrer) · `FriendName` · `State {invited|booked|sailed}`.
**LinkedBookings** — `UserId FK` · `BookingId FK` · `LinkedAt` · PK (`UserId, BookingId`) — the agent booking linking (`trips.link`); a linked booking adds a `BookingGuests` row for the linker.

### 4.4 Documents

**GuestDocuments** — documents R/W (`documents.get`, `set`).
`UserId ID* FK→Users` · `Doc {passport|birthCertificate|photoId|insurance}*` · `Expires DATE?` · `UpdatedAt` · PK (`UserId, Doc`). Check: `Expires` null unless the doc type has an expiry. Document **numbers are never stored** (only last four in check-in).

### 4.5 Pre-cruise (`dbo`)

**TourBookings** — plan.excursions R/W. `Id ID PK` · `BookingId FK` · `SailingId FK` (the booking's sailing) · `ExcursionId FK` · `Day INT` · `TotalCents BIG` · `CreditCents BIG` · `Status {booked|cancelled}` · `CancelFeeCents BIG?` · `CancelRefundCents BIG?` · `PaymentId ID? FK→Payments` · `At`. **TourBookingGuests**: (`TourBookingId`, `UserId`). Index on (`ExcursionId`, `Day`) to count spots.
**TourCartLines** — `BookingId` · `ExcursionId` · `Guests [csv user ids]` → normalised as **TourCartGuests** (`BookingId, ExcursionId, UserId`) · PK (`BookingId, ExcursionId`). Cart is server-side so it survives devices.
**LastMinuteTours** — on-board booking of tours leaving soon: modelled as `TourBookings` with `Source {pre|onboard}`; add column `Source` to `TourBookings`; charged to `FolioLines`.
**DiningReservations** — plan.dining R/W + waits. `Id ID PK` · `BookingId FK` · `SailingId FK` · `VenueId FK` · `Day INT` · `TimeLocal TIME` · `Note STR(300)` · `ChargeCents BIG` · `LateMinutes INT` · `ReminderOn DATE` · `Status {booked|cancelled|moved}` · `RowVersion`. **DiningReservationGuests** (`ReservationId`, `UserId`, `Covered BIT`). Unique filtered (`VenueId, Day, TimeLocal, UserId`) enforced in code via the guests table to catch double booking (`clash`). **GroupTableFriends** (`ReservationId`, `Seq`, `Name`, `Cabin`) plus `GroupSplit {mine|even}` on the reservation (aboard.groups).
**Waitlists** — `Id ID` · `BookingId` · `VenueId` · `Day` · `TimeLocal` · `Stage {waiting|offered|expired|booked}` · `Position INT` · `OfferAt TS?` · `ExpiresAt TS?` · `Auto BIT`; **WaitlistGuests**. **Queues** — walk-in virtual queue: `Id` · `BookingId` · `VenueId` · `JoinedAt` · `Stage {waiting|ready|expired|left}` · `Position` · `ReadyAt` · `ExpiresAt`.
**Purchases** — plan.packages R/W. `Id ID PK` · `BookingId FK` · `Kind {addOn|upgrade}` · `ItemId STR(30)` · `Units INT` · `UnitCents BIG` · `TotalCents BIG` · `Status {active|cancelled}` · `CreditedCents BIG` · `PaymentId?` · `At`. **PurchaseGuests** (`PurchaseId`, `UserId`). Price state (locked/dropped/same) is computed against `ref.AddOns`/`PackageUpgrades` and the clock.
**ChecklistTicks** / **PackingTicks** / **PrepTicks** / **ReadyTicks** / **NightTicks** — all `BookingId FK` (or `UserId` for per-person) · `ItemId STR(40)` · `Done BIT` · `At` · PK (`BookingId, ItemId`) — one generic table is **not** used, to keep each group's FK/PK obvious; they share a column shape. `PackingTicks` also has `TickedBy BIGINT NULL` (the guest who last ticked it). `ReadyTicks` also has `Day INT` (today's port-day readiness list resets daily).
**TravelPlans** — `BookingId PK FK` · `ArrivalMode STR(20)` · `ArrivalDate DATE` · `ArrivalWindowId?` · `FlightNo STR(12)?` · `Details [json]` · `UpdatedAt`.
**AssistanceRequests** — plan.assistance. `Id ID` · `BookingId` · `GuestUserId FK` · `Kind STR(20)` (`AssistId`) · `Note STR(500)` · `Status {received|confirmed|declined|cancelled}` · `At`.

### 4.6 Ahead (`dbo`)

**AdvisorRequests** — `Id ID` · `UserId` · `AdvisorId FK→ref.Advisors` · `Way {callback|chat}` · `Phone STR(30)?` · `Question STR(1000)` · `Reply TXT?` · `CallbackBy TS?` · `At`.
**MarketingConsents** — `UserId FK` · `Channel {email|sms}` · `Contact STR(254)` · `Region {us|ca|uk|eu|au}` · `State {pending|confirmed|expired|withdrawn}` · `CodeHash BINARY(32)?` · `AskedAt` · `ConfirmedAt?` · `ExpiresAt?` · PK (`UserId, Channel`). Demo code is returned only for `IsDemo` users.
**UpgradeBids** — `Id ID` · `BookingId` · `CategoryId FK` · `Cents BIG` · `Status {open|accepted|declined|withdrawn}` · `BuyNow BIT` · `DecidedAt?` · `At`. Unique filtered (`BookingId, CategoryId`) where status `open`.
**ClubRegistrations** — `ChildUserId FK` · `BookingId FK` · `ClubId` · `EmergencyName/Phone` · `Pickups [json]` · `Allergies STR(300)` · `Notes STR(500)` · `SignOutAlone BIT` · `Photos BIT` · `At` · PK (`ChildUserId, BookingId`).
**Medallions** — `BookingId PK` · `Stage {preparing|shipped|delivered|collect}` · `ActivatedAt?` · `LostAt?` · `TrackingNumber STR(30)` · `Address [json]`. **MedallionGuests**: `BookingId`, `UserId`, `Serial STR(16)`.
**BagTagOrders** — `BookingId PK` · `Way {print|etag|order}` · `OrderedAt` · `HandedOverAt?` · `Stage {none|atHome|handedOver|onShip|inCorridor|delivered}`.
**FixCases** — `Id ID` · `UserId` · `Flow STR(20)` · `Note STR(500)` · `Stage` · `Reference STR(16)` · `ContactBy TS` · `At`.
**AssistCases** — `Id ID` · `UserId` · `BookingId?` · `Kind {assistedBooking|bereavement|medical}` · `Phone` · `Note` · `Stage {received|reviewing|decided}` · `Reference` · `FeeCents/RefundCents/CreditCents BIG?` · `Choice {refund|credit}?` · `At`.

### 4.7 Check-in and boarding

**CheckinGuests** — checkin R/W. `BookingId FK` · `UserId FK` · `Step {confirm|document|photo|emergency|contract|health}` · `DoneAt TS` · `Data [json]` (per-step payload: document kind/country/last4/expires; photo `at` only — **the photo is never kept**; emergency; contract version + by; health answers + flagged) · PK (`BookingId, UserId, Step`) · `RowVersion`.
**CheckinBooking** — `BookingId PK` · `PaymentCardId ID?` · `PaymentLabel STR(60)?` · `PaymentAt TS?` · `ArrivalWindowId STR(20)?` · `ArrivalAt TS?` · `FinishedAt TS?` (set by `checkin.submit`).
**BoardingPasses** — derived, but stored for stable QR: `BookingId` · `UserId` · `Seq INT` · `Code STR(200)` (signed payload `PassData v1`) · `InWallet BIT` · `IssuedAt` · PK (`BookingId, UserId`). Signing key from secrets; code re-verifiable.
**EmbarkProgress** — `BookingId PK` · `LuggageStatus {notDropped|dropped|delivered}` · `LuggageDroppedAt?` · `Terminal STR(60)` (override for the `terminalChange` scenario lives in `ref`/scenario data, not here).
**EmbarkTicks** — `BookingId` · `Kind {companion|carryOn}` · `ItemId STR(30)` · `Done BIT` · PK (`BookingId, Kind, ItemId`).
**MusterConfirmations** — `BookingId` · `UserId` · `ConfirmedAt TS` · `ByUserId` · PK (`BookingId, UserId`).

### 4.8 On board

**PlanEvents** (my programme) — `UserId FK` · `SailingId` · `EventId` · `Day INT` · PK (`UserId, SailingId, EventId, Day`).
**ShowTickets** — `Id ID` · `BookingId` · `SailingId` · `EventId` · `Day` · `Status {on|moved|cancelled}` · `At`; **ShowTicketGuests**. Seats left = `ref.Events.Seats − Σ guests` (check inside a serialisable transaction for `soldOut`).
**Orders** — orders R/W. `Id ID PK` · `BookingId FK` · `PlacedByUserId FK` · `Kind {delivery|room|breakfast}` · `PlacedAt TS` · `DeliverAt TS?` · `LocationKind {cabin|zone|other}` · `LocationRef STR(80)?` · `TipCents BIG` · `FeeCents BIG` · `ServiceCents BIG` · `TotalCents BIG` · `CoveredCents BIG` · `RefundCents BIG` · `Stage {scheduled|received|preparing|needsChoice|onTheWay|delivered|cancelled}` · `EtaAt TS?` · `Contacted INT` · `RowVersion`. Stage is *derived on read* from timestamps and the clock (`orders.ts progress`), with the stored value updated lazily and by cancel/resolve.
**OrderLines** — `OrderId FK` · `BookingId FK` · `Seq INT` · `ItemId FK→ref.MenuItems` · `Qty INT` · `GuestUserId FK→BookingGuests` · `Extras [csv]` · `Note STR(200)?` · `UnitCents BIG` · `Choice {substitute|remove}?` · `Unavailable BIT`.
**ChatMessages** (travel-party chat, `messages`) — `Id ID` · `BookingGroupKey` (see below) · `FromUserId FK` · `Text STR(2000)` · `Photo TXT?` (data URL; capped by `ChatSafeApi.sendPhoto` rules) · `At`. **ChatReads** — `MessageId` · `UserId` · `SeenAt` (written only when both sides have receipts on). `ReadReceipts BIT` is on `Users`… stored as `UserPrefs.ReceiptsOn` (see `UserPrefs`).
*Chat scope:* the chat is "your group", not "your booking" (friends in separate cabins share it). Table **ChatGroups** (`Id ID`, `Name`) + **ChatGroupMembers** (`GroupId`, `UserId`); messages reference `GroupId`. Seeded groups follow `visibleTo()` (Harper and Brennan families; solos have none).
**ChatBlocks** — `UserId` · `BlockedUserId` · PK pair. **ChatReports** — `Id` · `MessageId` · `ByUserId` · `Reason` · `At`.
**UserPrefs** — `UserId PK` · `ReceiptsOn BIT` · `Json [json]` (small client preferences that must follow the user: text size lives on `Users`). Kept deliberately thin.
**ServiceThreads** — `Id ID` · `BookingId` · `Channel STR(20)` (`ChannelId`) · `State STR(20)?` · `EscalatedPhone STR(30)?` · `EscalatedAt?`. **ServiceMessages** — `Id ID` · `ThreadId` · `FromRole {me|crew}` · `CrewName STR(60)?` · `Text STR(2000)` · `At`. Crew replies are generated by the server's mocked responder (section 8).
**FamilyZones** — `ChildUserId` · `BookingId` · `ZoneIds [json array]` · `Auth [json]` (`pickup` ids, `signOutAlone`, `photos`) · PK pair. **KidClubCheckins** — `Id` · `ChildUserId` · `ClubId` · `InAt` · `OutAt?` · `ByUserId` · `OutByUserId?`. **KidSightings** — `ChildUserId` · `PlaceId` · `Source {club|band}` · `At` (latest, drives `kidStatus`). **FamilyLog** — `Id` · `BookingId` · `At` · `Text`. **ReunionPlans** — `BookingId PK` · `PlaceId` · `BackupId` · `Note`.
**HealthReports** — `Id ID` · `BookingId` · `ByUserId` · `Symptoms [json array]` · `StartedHoursAgo INT` · `At`; **HealthReportGuests**. **HealthRequests** — `Id` · `BookingId` · `Kind` · `Note` · `At`. Isolation is computed from reports and the `illness` scenario.
**RoomSettings** — `BookingId PK` · `Housekeeping [json]` · `Devices [json]` · `DndSince TS?` · `RowVersion`.
**PhotoSelections** — `UserId` · `PhotoId FK` · PK pair (favourites). **PhotoPurchases** — `Id ID` · `BookingId` · `Option` · `PaidCents` · `SavedCents` · `Verified BIT` · `Until TS` · `At`; **PhotoPurchaseItems** (`PurchaseId`, `PhotoId`, `Downloaded BIT`).
**LaundryRequests** — `Id` · `BookingId` · `Service` · `Qty` · `PickupAt` · `ReturnAt` · `Stage` · `TotalCents` · `FreeCents` · `Note`.
**WifiDevices** — `Id` · `BookingId` · `Name STR(60)` · `PlanCode` · `Days INT` · `ExpiresAt` · `UsedMb BIG`.
**Budgets** — `BookingId PK` · `Json [json]` (the `Budget`: overall and per-child limits) · `RowVersion`.

**BookingState** — state R/W (multi-device). As `UserState` but per booking, shared by everyone on it. `BookingId ID* FK→Bookings` · `StateKey STR(30)*` (`port`, `party`) · `Json [json]*` · `Version INT*` · PK (`BookingId`, `StateKey`).
**PortRows** — the port day's shared record as rows (multi-device plan 2, Phase 6), so a delete is a row that stays: the old `port` document unions both devices' copies and brings a deleted expense back. `BookingId ID* FK→Bookings` (cascade) · `Kind STR(12)*` (`presence`, `plan`, `planB`, `setting`, `meet`, `meetState`, `party`, `item`, and from N4 `poll`, `vote`, `idea`, `heart`) · `RowKey STR(90)*` · `Json [json]?` (at most 2,000 characters; null for a deleted row) · `At BIG*` (ms, from the device that made the change; the later `At` wins a clash, a tie keeps the stored row) · `Deleted BIT*` · PK (`BookingId`, `Kind`, `RowKey`). A deleted row is kept for 30 days so another device that was offline learns of it; at most 1,000 rows a booking. Keys: `presence` `date|person`, `plan` and `planB` `date`, `setting` `alertBefore` or `settledAt`, `meet` a meeting's id, `meetState` `meetingId|person`, `party` a family's id (the split ledger), `item` an expense's id.
**UpdateAcks** — `UserId` · `ScenarioId` · `OptionCode STR(30)` · `At` · PK pair.
**ServiceRequests** (`aboard.requests`) — `Id` · `BookingId` · `ItemId` · `Qty` · `Note` · `PlacedAt` · `EtaAt` · `Stage {received|onTheWay|done|cancelled}`.
**SafetyReports** (`aboard.reports`) — `Id` · `BookingId` · `Kind` · `Place` · `Note` · `Anonymous BIT` · `Reference` · `At`.
**DrinkLogs** — `Id` · `UserId` · `DrinkId FK` · `At`. **TopUps** — `Id` · `BookingId` · `Dollars INT` · `Source {card|cash}` · `At` · `SettledAt?` · `Reference`. **OnboardAccount** — `BookingId PK` · `PinHash BINARY(32)?` · `PinSalt` · `PinFails INT` · `GratuityChoice {standard|prepaid|removal}` · `GratuityReason STR(300)?` · `GratuityPaidAt?` · `DisplayCurrency CHAR(3)`.
**Parties** — `Id` · `BookingId` · `Title` · `Day` · `TimeLocal`; **PartyInvites** (`PartyId`, `Cabin`, `Answer {yes|maybe|no}`).
**GameProgress** — `UserId PK` · `State [json]`. **TvState** — `BookingId PK` · `State [json]`.
**Selections** (`aboard.selections`, bookable on-board items like spa) — `Id` · `BookingId` · `ItemId` · `Day` · `Time` · `Qty` · `TotalCents`.
**FolioLines** — folio R. `Id ID` · `BookingId` · `UserId?` · `Day INT` · `Category` · `Description` · `Cents BIG` (negative = credit) · `CoveredBy {package|fare|credit}?` · `SourceType STR(20)` · `SourceId ID?` · `At`. **Every on-board charge** (orders, laundry, tours, spa selections, photos, Wi-Fi, drinks beyond cap, top-ups, gratuities) writes a `FolioLines` row in the same transaction. Totals are computed.
**Feedback** (in-app product feedback, `aboard.feedback`) — `Id` · `UserId` · `Kind {bug|idea|praise}` · `Text STR(1000)` · `Log [json array]` · `Screenshot TXT?` · `Reference` · `At`.

### 4.9 After the cruise

**DisembarkChoices** — `BookingId PK` · `OptionCode {tagged|selfAssist|earlyWalkOff}` · `TagsOn BIT` · `DecidedAt`; **DisembarkBags** (`BookingId`, `UserId`, `Bags INT`).
**Customs** — `BookingId PK` · `Declaration [json]` (`food`, `cash`, `goodsUsd`, `note`) · `SubmittedAt`.
**OnwardPlans** — `BookingId PK` · `Mode` · `FlightAtLocal TIME?` · `Flight STR(12)` · `Note`.
**FinalBill** — `BookingId PK` · `TipKeepPercent INT` · `EmailedAt?` · `EmailedTo STR(254)?` · `SettledAt?`. Plus `BillQueries` are `Cases` with `Kind=billing` and `LineId`.
**Cases** — `Id ID` · `UserId` · `BookingId` · `Kind {lostItem|billing|claim|complaint|recovery}` · `Number STR(12) UQ` · `Summary` · `Place` · `Cents BIG` · `LineId STR(40)?` · `Stage {received|inReview|resolved|withdrawn}` · `Outcome STR(20)?` · `OpenedAt` · `DueAt` · `WithdrawnAt?` · `RefundCents BIG?` · `RefundSentAt?` · `FromFeedback BIT`.
**PostFeedback** — `BookingId PK` · `Json [json]` (the `Feedback` object: area scores, crew mentions, comment) · `SubmittedAt` · `EditUntil`.
**RebookHolds** — `Id ID` · `UserId` · `BookingId` · `SailingId FK` · `CategoryId` · `Guests INT` · `TotalCents` · `DepositCents` · `CreditCents` · `FccAppliedCents` · `Onboard BIT` · `PlacedAt` · `ExpiresAt`. `FccConversions` handled by updating `FutureCruiseCredits`.
**DeskAppointments** — `BookingId PK` · `At TS`; **DeskSlots** (reference-like, generated): `At TS PK` · `Capacity INT`.

## 5. JSON columns, and why each one is JSON

| Table.Column | Shape (TypeScript) | Why JSON |
| --- | --- | --- |
| `BookingDrafts.People/Contact/Accepted` | `GuestDraft[]`, `LeadContact`, `Partial<Record<LegalId,boolean>>` | A draft is incomplete by definition; `normalizeDraft` already validates on read. |
| `NotificationPrefs.Prefs` | `NotificationPrefs` | Matrix shape changes with features. |
| `CheckinGuests.Data` | per-step payload | Different shape per `Step`; validated by the step validators. |
| `Customs.Declaration`, `OnwardPlans` extras, `Budgets.Json`, `PostFeedback.Json` | UI-shaped records | Never queried by field. |
| `RoomSettings.Housekeeping/Devices` | `Housekeeping`, `Devices` | Toggle bags. |
| `FamilyZones.Auth`, `ClubRegistrations.Pickups` | `Authorisation`, `Pickup[]` | Small lists read whole. |
| `TravelPlans.Details`, `Medallions.Address` | records | As above. |
| `QuoteLocks.QuoteJson` | `BookingQuote` | Frozen snapshot of what the guest saw. |
| `ref.*` description arrays (`Features`, `Tags`, `Interests`, `Hours`) | string arrays | Display only. |

Everything in the plan's list ("check-in step records, health answers, packing lists, customs declarations, advisor replies") is covered: health answers sit in `CheckinGuests.Data`; packing is `PackingTicks` (ticks) over `ref.PackingItems`; advisor replies are a real column (`AdvisorRequests.Reply`).

## 6. API surface

Base path `/api/v1`. Auth column: **P** public, **U** any signed-in user, **B** member of `{number}`, **BA** booking adult (not supervised), **Booker**, **Staff**. Errors are RFC 7807 problem details with `type` = one of the `ApiErrorCode` values (`invalid`, `conflict`, `forbidden`, `notFound`, `challenge`, `declined`, `server`) and `title` carrying the message token the screens already switch on (`soldOut`, `priceChanged`, …). `network`, `timeout`, `offline` are produced only by the client. Rule: a signed-in user asking about a booking they are not on gets `notFound`, not `forbidden`.

Booking-scoped routes below are written without the `/bookings/{number}` prefix; add it (D3). Each method of the `Api` interface appears once; Phase 11's script compares this table's count to the interface.

### 6.1 Auth, account, trips, payments (Phase 5–6)
| Api method | Verb route | Auth |
| --- | --- | --- |
| `auth.login` (new) | `POST /auth/login` {identifier, password} | P |
| `auth.refresh` (new) | `POST /auth/refresh` | P (cookie/body) |
| `auth.logout` (new) | `POST /auth/logout` | U |
| *(new)* demo accounts | `GET /auth/demo-accounts` → `[{ email, firstName, lastName, role }]`; 404 in production; the sign-in page lists them in non-production builds | P |
| `auth.me` | `GET /me` | U |
| *(new)* view-as | `POST /me/view-as/{userId}` | Booker |
| `account.party` | `GET /bookings/{n}/party` | B |
| `account.profile(id)` | `GET /users/{id}/profile` | B same booking |
| `account.saveProfile` | `PUT /users/{id}/profile` | the person, their booker (a child), the booking's booker, or a helper with `profile`; rules: name change (`conflict` late or large), `forbidden` for child |
| `account.helper` / `saveHelper` / `revokeHelper` | `GET/PUT/DELETE /me/helper` (GET returns JSON `null` when there is none) | U |
| `account.history` | `GET /me/history` | U |
| `account.activity` | `GET /me/audit` (own audit trail, newest first; `max`, `before`) | U |
| (administrators) | `GET /audit` (search the whole trail; 403 unless role `admin`) | A |
| `trips.list` | `GET /trips` | U |
| `trips.get` | `GET /trips/{n}` | B |
| `trips.link` | `POST /trips/link` {number,lastName,departure} | U (rate-limited) |
| `payments.get` | `GET /bookings/{n}/payments` | B |
| `payments.addCard` / `removeCard` | `POST/DELETE /me/cards[/{id}]` | BA |
| `payments.payBalance(cardId)` | `POST /bookings/{n}/payments/balance` {cardId}; 409 `paid` when nothing is owed | BA (a helper paying with `payments` is not built) |
| `documents.get` | `GET /bookings/{n}/documents` | B |
| `documents.set` | `PUT /users/{id}/documents/{doc}` {expires?} / `DELETE`; optional `?booking={n}` picks the booking whose view comes back (a helper gets only that guest) | as profile, with helper `documents` |
| `notifications.list/markRead/savePrefs` | `GET /me/notifications`, `POST /me/notifications/read`, `PUT /me/notification-prefs` | U |
| `push.status/subscribe/unsubscribe/dispatch/markRead` | `GET /me/push[?endpoint=]`, `PUT /me/push/subscription` {endpoint,p256dh,auth,budget,calm,watch}, `POST /me/push/unsubscribe` {endpoint}, `POST /me/push/dispatch[?endpoint=]`, `POST /me/push/read`; 409 `pushUnavailable` when the server cannot send, 409 `tooManyDevices` past 5 phones. Dispatch applies the budget, calm mode and quiet hours on the server (safety notices skip them) and writes the delivery log | U |
| `calendar.status/create/revoke` | `GET/POST/DELETE /me/calendar-feed`; the address (`path`) is returned once, by POST. `GET /calendar/{token}.ics` serves the feed with no sign-in | U (the feed itself P) |
| `support.tickets/callback/email` | `GET /me/support-tickets`; `POST /me/support-tickets` {kind:`callback`,phone} or {kind:`email`,message} | U |
| `help.contacts` | `GET /help/contacts` | P |
| `privacy.view/setConsent` | `GET /bookings/{n}/privacy`; `PUT /users/{id}/consents/{consent}` {on}, optional `?booking={n}` | B / the adult themself or the child's booker |
| `budget.get/save` | `GET/PUT /bookings/{n}/budget` | B / BA; a child's limit needs that child's booker |
| `bookings.get` / `bookings.sailings` | `GET /bookings/{n}` (core: number, personaId, bookerId, sailingId, departure, party ids, category, stateroom, cabinNumber, tier, package), `GET /sailings` | B / P |
| `aboard.feedback.list/send` | `GET/POST /me/feedback` | U |
| `ahead.saved.list/toggle`, `discover.favourites/toggleFavourite` | `GET /me/favourites`, `POST /me/favourites/toggle` | U |

### 6.2 Discover and booking (Phase 7, built)
| Api method | Verb route | Auth |
| --- | --- | --- |
| `discover.offers` | `GET /sailings/offers` | P |
| `discover.quote` | `GET /sailings/{id}/quote?category=&guests=`; `invalid` for an unknown sailing, room type or party size | P |
| `booking.dates` | `GET /sailings/bookable` | P |
| `booking.rooms` | `GET /sailings/{id}/rooms` | P |
| `booking.cabins` | `GET /sailings/{id}/cabins?category=` (rooms already booked come back `available: false`) | P |
| `booking.fares` | `POST /booking/fares` {draft} | U |
| `booking.quote` | `POST /booking/quote` {draft}; `total` is the price to send back as `expectedTotal` | U |
| `booking.prefill` | `GET /me/booking-prefill` | U |
| `booking.draft/saveDraft/discardDraft` | `GET/PUT/DELETE /me/draft`; GET returns JSON `null` when there is none; the id in the PUT response is chosen by the server | U (not a supervised child, for PUT) |
| `booking.sendResumeLink` | `POST /me/draft/resume-link` {via,to}; 404 with no draft, 400 for a bad address | U |
| `booking.book` | `POST /bookings` {draft, expectedTotal, option, parts:[{method:`card`,cardId,cents}\|{method:`wallet`,cents}], challenge} + optional `Idempotency-Key`; 400 `incomplete`\|`payment`\|`card`\|`option`, 409 `priceChanged`\|`cabinTaken`\|`closed`\|`draftTaken`, 402 `challenge`\|`declined` | U (not a supervised child) |
| `booking.get` | `GET /bookings/{n}/detail` | B |
| `booking.payBalance` | `POST /bookings/{n}/pay-balance` {parts, challenge} + optional `Idempotency-Key`; 409 `nothingDue` | BA |
| `booking.changePreview` / `change` | `GET /bookings/{n}/change?sailingId=`, `POST /bookings/{n}/change?sailingId=`; 409 `tooLate`\|`newTooSoon`\|`same` | Booker |
| `booking.cancel` | `POST /bookings/{n}/cancel`; 409 `closed` | Booker |

### 6.3 Pre-cruise (Phase 8a built: the `plan` rows; Phase 8b built: `waits`, `shows` and `ahead`)

Built routes sit under `/bookings/{number}`, so `GET /plan` is `GET /bookings/{number}/plan`, `GET /excursions` is `GET /bookings/{number}/excursions`, and so on. Differences from the table: `PUT /excursions/bookings/{id}` takes `{guests}`, `PUT /checklist/{id}` and `PUT /packing/{id}` take `{done}`, `POST /packages/purchases` takes `{kind, item | to, guests, parts, challenge}`, and the dining routes are `/dining/reservations` and `/dining/reservations/{id}/move|late`. Ids in the responses are public guids; a guest is the public id of their user.
| Api method | Route | Auth |
| --- | --- | --- |
| `plan.overview` | `GET /plan` | B |
| `plan.celebrations.get/save` | `GET/PUT /celebrations` | B / BA |
| `plan.wishes.get/add` | `GET /celebrations/wishes`, `POST /celebrations/{id}/wishes` | B / B (a supervised child may add) |
| `plan.thanks.get/add` | `GET/POST /thanks` | B / BA |
| `plan.excursions.list/addToCart/removeFromCart/checkout/changeGuests/cancel` | `GET /excursions`, `PUT/DELETE /excursions/cart/{id}`, `POST /excursions/checkout`, `PUT/DELETE /excursions/bookings/{id}` | B read, BA write |
| `plan.dining.view/slots/reserve/cancel/move/late` | `GET /dining`, `GET /dining/slots?venue=&day=`, `POST /dining/reservations`, `DELETE /dining/reservations/{id}`, `POST …/{id}/move`, `POST …/{id}/late` | B read, BA write |
| `plan.packages.view/buy/claimDrop/cancel` | `GET /packages`, `POST /packages/purchases`, `POST …/{id}/claim-drop`, `DELETE …/{id}` | B / BA |
| `plan.checklist.get/tick`, `plan.packing.get/tick` | `GET/PUT /checklist[/{id}]`, `GET/PUT /packing[/{id}]` | B / BA |
| `plan.travel.get/save` | `GET/PUT /travel` | B / BA |
| `plan.assistance.get/request/cancel` | `GET/POST/DELETE /assistance[/{id}]` | B / BA |
| `waits.list/joinQueue/leaveQueue/joinWaitlist/leaveWaitlist/acceptWaitlist` | `GET /waits`, `POST/DELETE /waits/queue[/{id}]`, `POST/DELETE /waits/waitlist[/{id}]`, `POST /waits/waitlist/{id}/accept` | B / BA |
| `shows.day/mine/reserve/cancel` | `GET /shows?day=`, `GET /shows/tickets`, `POST /shows/tickets`, `DELETE /shows/tickets/{id}` | B / BA |
| `dining.list/reschedule` (legacy `Item[]`), `queues.list` | **dropped** (superseded by `plan.dining` and `waits`; decided in section 9) | – |
| `ahead.advisors.list/ask` | `GET/POST /me/advisor-requests` | U |
| `ahead.marketing.view/subscribe/confirm/withdraw` | `GET /me/marketing`, `POST …/{channel}/subscribe`, `…/confirm`, `DELETE …/{channel}` | U |
| `ahead.perks.mine` | `GET /me/loyalty` | U |
| `ahead.upgrades.view/bid/withdraw` | `GET/POST/DELETE /upgrades[/{id}]` | B / BA |
| `ahead.clubs.view/save/withdraw` | `GET/PUT/DELETE /clubs[/{childId}]` | B / BA |
| `ahead.medallion.view/activate/lost` | `GET /medallion`, `POST …/activate`, `POST …/lost` | B / BA |
| `ahead.tags.view/choose/handedOver` | `GET /bag-tags`, `PUT …/way`, `PUT …/handed-over` | B / BA |
| `ahead.fix.list/escalate` | `GET/POST /me/fix-cases` | U |
| `ahead.assist.list/ask/choose` | `GET/POST /me/assist-cases`, `POST …/{id}/choice` | U |
| `ahead.prep.get/set` | `GET/PUT /prep[/{id}]` | B |

Phase 8b built these as listed, under `/bookings/{number}` for the `B` rows and under `/me` for the `U` rows. Differences from the table: the club write is `PUT/DELETE /clubs/{childId}` (the child's booker only), a bid is `POST /upgrades` with `{category, cents}`, `ahead.tags.choose` is `PUT /bag-tags/way` with `{way}` and `handedOver` is `PUT /bag-tags/handed-over` with `{on}`, `ahead.assist.choose` is `POST /me/assist-cases/{id}/choice`, and `ahead.prep` hangs off the booking (the `PrepTicks` table is per booking) rather than the person. `shows.day` needs `?day=` and answers 400 `day` without it.

### 6.4 Check-in and boarding (Phase 9)
| Api method | Route | Auth |
| --- | --- | --- |
| `checkin.status/view/receipt` | `GET /checkin`, `GET /checkin/status`, `GET /checkin/receipt` | B |
| `checkin.save` | `PUT /checkin/steps/{step}` | BA; `forbidden` for supervised; `conflict notOpen/closed` |
| `checkin.submit` | `POST /checkin/submit` | BA |
| `boarding.pass/addToWallet` | `GET /boarding`, `POST /boarding/wallet` | B |
| `boarding.lookup` | `GET /pass/lookup?number=&lastName=` | **P**, rate-limited, uniform `notFound` |
| `boarding.embark/setCompanion/setCarryOn/setBags` | `GET /embark`, `PUT /embark/companion/{id}`, `PUT /embark/carry-on/{id}`, `PUT /embark/bags` | B / BA |

Phase 9 built these as listed, under `/bookings/{number}` (the lookup is the only route outside it). The save route takes one body for every step (`guests`, `guest`, `kind`, `country`, `number`, `expires`, `metrics`, `name`, `phone`, `relationship`, `answers`, `cardId`, `window`); `PUT /embark/companion/{id}` and `/carry-on/{id}` take `{done}` and `PUT /embark/bags` takes `{dropped}`. Problem titles: `document:` + `kind|country|number|expiry|expired|tooSoon|notAllowed`, `photo:` + a comma list of `small|shape|dark|bright|blurry`, `emergency:` + `name|phone|relationship|travelling`, `health:answers`, `payment:card`, `arrival:window`, `guests`, `step`; `402` for a declined card; `409` `notOpen`, `closed`, `incomplete` or `notDone`.

### 6.5 On board (Phase 10: 10a, 10b and 10c built)
| Api method | Route | Auth |
| --- | --- | --- |
| `onboard.today/program/togglePlan/portDay/muster/confirmMuster/emergency/folio` | `GET /onboard/today`, `GET /onboard/program/{day}`, `PUT /onboard/plan/{eventId}`, `GET /onboard/port-day`, `GET/POST /onboard/muster`, `GET /onboard/emergency`, `GET /onboard/folio` | B (togglePlan: BA or self) |
| `ports.today` | `GET /onboard/port` | B |
| `orders.menu/list/place/resolve/cancel/moveTo/contact` | `GET /orders/menu`, `GET/POST /orders`, `POST …/{id}/resolve`, `DELETE …/{id}`, `PUT …/{id}/location`, `POST …/{id}/contact` | B / BA |
| `messages.list/send/receipts/setReceipts/markSeen` | `GET/POST /me/chat/messages`, `GET/PUT /me/chat/receipts`, `POST /me/chat/seen` | U in chat group |
| `service.channels/thread/send/escalate` | `GET /service/channels`, `GET/POST /service/{channel}`, `POST …/escalate` | B |
| `family.view/setZones/setAuth/checkIn/checkOut/setReunion` | `GET /family`, `PUT /family/{child}/zones`, `PUT …/auth`, `POST …/check-in`, `POST …/check-out`, `PUT /family/reunion` | B / BA |
| `health.view/report/request` | `GET /health`, `POST /health/reports`, `POST /health/requests` | B / BA |
| `room.view/setHousekeeping/setDevices` | `GET /room`, `PATCH /room/housekeeping`, `PATCH /room/devices` | B / BA |
| `photos.list/toggleFavourite/quote/buy/download` | `GET /photos`, `PUT /photos/{id}/favourite`, `POST /photos/quote`, `POST /photos/purchases`, `POST /photos/purchases/{id}/download` | B / BA |
| `laundry.view/request/cancel` | `GET /laundry`, `POST /laundry`, `DELETE /laundry/{id}` | B / BA |
| `wifi.view/add/upgrade/remove` | `GET /wifi`, `POST /wifi/devices`, `PUT/DELETE /wifi/devices/{id}` | B / BA |
| `updates.list/acknowledge` | `GET /updates`, `POST /updates/{id}/ack` | B / BA |
| `requests.list/create` (legacy, **dropped**) and `aboard.requests.list/create/cancel` | `GET/POST/DELETE /requests[/{id}]` | B / BA |
| `aboard.selections.list/add/remove` | `GET/POST/DELETE /selections[/{id}]` | B / BA |
| `aboard.reports.list/create` | `GET/POST /safety-reports` | B (supervised may create) |
| `aboard.drinks.view/log/undo` | `GET/POST/DELETE /drinks[/{id}]` | B / self |
| `aboard.money.view/topUp/setPin/forgotPin/gratuity/setCurrency` | `GET /money`, `POST …/top-ups`, `PUT …/pin`, `POST …/forgot-pin`, `PUT …/gratuity`, `PUT …/currency` | B / BA |
| `aboard.parties.list/create/cancel` | `GET/POST/DELETE /parties[/{id}]` | B / BA |
| `aboard.groups.get/addFriend/removeFriend/setSplit` | `GET/PUT /dining/reservations/{id}/group…` | B / BA |
| `aboard.games.get/find/answer/mark` | `GET /games`, `PUT /games/…` | self |
| `aboard.tv.get/set` | `GET/PATCH /tv` | B |
| `aboard.lastMinute.list/book` | `GET /last-minute`, `POST /last-minute/{excursionId}` | B / BA |
| `aboard.ready.get/set` | `GET/PUT /ready[/{id}]` | B |
| `aboard.chat.blocked/block/report/sendPhoto` | `GET /me/chat/blocks`, `PUT …/{id}`, `POST /me/chat/reports`, `POST /me/chat/photos` | U |
| `folio.entitlements` | `GET /entitlements` | B |

Phase 10a built the `onboard.*`, `ports.today`, `service.*` and `folio.entitlements` rows above under `/bookings/{number}`; the rest of the table is Phase 10b. Differences from the mock: `PUT /onboard/plan/{eventId}` takes `{on, day}` because the plan table is keyed by event **and day** (an event that runs on several days is planned day by day) and returns that day's plan; `program(day).mine` lists the plan for that day. The muster check-in refuses a stranger or an empty list as `400 guests` (not `403`), a cancelled booking as `409 closed`, and the window as `409 notOpen` (more than an hour before the drill) or `409 closed` (18 hours after it). `onboard.folio` is for adults (`403 supervised` for a child), and stored `FolioLines` sit beside the generated lines without a "would have cost" value, since the table has none. Ship-tour QR codes end in a signature. Scenarios (`planChange`, `belizeTender`, `portSkipped`, `chatSlow`) come from `demo.DemoState.ActiveScenarios` for `IsDemo` users only. Problem titles: `day`, `event`, `guests`, `channel`, `text`, `phone`.

Phase 10b built the `orders.*`, `family.*`, `health.*`, `room.*`, `photos.*`, `laundry.*`, `wifi.*` and `updates.*` rows above under `/bookings/{number}`; `messages`, `aboard.*` and the legacy `requests` were **Phase 10c** (below). Differences from the table and the mock:
- Orders: `PUT /orders/{id}/location` takes `{location}`, `POST /orders/{id}/resolve` takes `{choices: {index: substitute|remove}}`. `Orders` has no column for the moment a choice was made or an order cancelled, so `Orders.EtaAt` holds it (cancelled when `Stage = cancelled`, else the time the guest chose); a live order's stage is worked out from the clock on every read. `free` (isolating for illness) is not stored: it is worked out from the booking's health reports at the time the order was placed. Problem titles: `empty`, `tooMany`, `unknownItem`, `wrongMenu`, `unknownExtra`, `badQuantity`, `noGuest`, `underage`, `badLocation`, `badTip`, `badKind`, `noTime`, `incomplete`, `noSubstitute`; `409` `closed`, `unavailable`, `nothingToChoose`, `tooLate`.
- **First writes to `FolioLines`.** Orders, photo purchases, laundry requests and Wi-Fi devices write their lines (`SourceType` `order`, `photo`, `laundry`, `wifi`) in the same transaction, and any change replaces that source's lines. Laundry lines are dated at the pick-up, so they appear on the account when the steward collects. Wi-Fi's price and package cover are read back from its line (the table has no columns for them), and a purchase of included photos is stored with option `each`, no payment, and shows as `included`.
- Photos: a photo is a catalogue spot with the whole party in it (`PhotoSelections` and `PhotoPurchaseItems` key `ref.PhotoCatalogue`), so the mock's separate portrait for each person is not kept. `PUT /photos/{photoId}/favourite` toggles. Included photos = `SavedCents` over the price of one.
- Family: `PUT /family/{child}/auth` takes `{pickup, signOutAlone, photos}`; `checkOut` needs only booking access (the child or a listed adult). A child's place away from the club is simulated (`KidSightings` is not written). `403 notYourChild` for anyone not a child on the booking, `403 notAuthorised`, `409 notIn`.
- Health: a report is listed only to its reporter but any report isolates the whole booking for 72 hours; requests have no person column, so they belong to the booking. `403 notOnBooking`.
- Room: `PATCH` bodies are partial; `Do Not Disturb` start time lives in the housekeeping JSON (`RoomSettings.DndSince` is unused).
- Updates: `updates/{id}/ack` takes `{option}`; `400 option`, `409 ended`. Which changes are in force comes from the caller's scenarios.

Phase 10c built the remaining rows: `aboard.selections.*`, `aboard.requests.*`, `aboard.reports.*`, `aboard.drinks.*`, `aboard.money.*`, `aboard.parties.*`, `aboard.groups.*`, `aboard.games.*`, `aboard.tv.*`, `aboard.lastMinute.*`, `aboard.ready.*`, `messages.*` and `aboard.chat.*`. The legacy `requests` was dropped. `aboard.feedback` already lives at `/me/feedback`. Differences from the table and the mock:
- Routes: the group table is `GET /dining/reservations/{id}/group`, `POST …/group/friends`, `DELETE …/group/friends/{index}` and `PUT …/group/split`; the seats already taken are the guests on the reservation (the client no longer sends a party size), so the eight-seat limit is the server's. Games are `GET /games`, `PUT /games/clues/{id}` `{on}`, `PUT /games/trivia/{id}` `{option}` and `PUT /games/bingo/{n}` `{on}`. `PUT /ready/{id}` takes `{on}`. `PATCH /tv` is partial: `casting` and `vod` set to null clear them, and a missing field is left alone. Chat is under `/me/chat` (no booking in the path): `GET/POST /messages`, `GET/PUT /receipts` `{on}`, `POST /seen`, `GET /blocks`, `PUT /blocks/{id}` `{on}`, `POST /reports` `{messageId, reason}`, `POST /photos`. Guests and chat members are user public guids. The requests, reports, selections and so on take the caller's booking from the path; a stranger is `404`.
- Who may write: selections, requests, money (except the display currency), parties, group tables, the TV and last-minute tours are adult-write (`403 supervised` for a child account); reports, drinks, games, readiness and the display currency are open to any guest on the booking, a child included (a child cannot log alcohol, `403 age`). Chat is open to everyone, with the child rules below.
- Selections: `Selections` has no person column, so a booking is the booking's, not a guest's; the charge goes on the account for the person who booked. Booking the same goods again replaces the quantity (and the charge). Places left count only the sample "taken by others" figure, as the mock did, not other bookings. Problem titles: `unknown`, `badDay`, `badTime`, `badQty`, `age`, `notBookable`; `409` `soldOut`, `closed`, `past`, `duplicate`.
- Requests: stages (`received`, `onTheWay`, `done`) come from the clock; only `cancelled` is stored. `badItem`, `badQuantity`; `409` `closed`, `duplicate`, `tooMany`, `tooLate`.
- Reports: the place is at most 80 characters (the column), the note 600. `SEC-nnn` counts per booking. Problem titles: `badKind`, `noWhere`, `noNote`, `tooLong`.
- Drinks: the day is the cruise day in ship time; the list reads the last two days of the person's logs and keeps today's. The cap comes from the caller's own entitlements. `badDrink`; `403 age` for alcohol under 21.
- Money: **the PIN, gratuity choice and display currency belong to the booking** (`OnboardAccount` has one row per booking), not to each person as in the mock. The PIN is a salted PBKDF2-SHA256 hash; five wrong guesses make it `409 locked` until Guest Services reset it (`PinFails`). A forgotten PIN is a message to the Guest Services chat thread (`POST /money/forgot-pin`), since there is no column for the request. A top-up is credited to the booker; cash is dated two hours after it was asked (`SettledAt`), and the account line is dated then, so it appears when the desk would have entered it. Saved cards are the **caller's own** (`hasCard`, `noCard`). `badSource`, `badAmount`, `badChoice`, `noReason`, `badCurrency`, `wrongPin`, `format`, `weak`; `409` `tooMuch`, `noCard`, `closed`, `nothingDue`, `already`, `locked`.
- Parties: `Parties` has no cabin list, so the neighbours' answers are stored per invite (`PartyInvites`) when the party is made. `403 age` under 21; `409 past` for an earlier day than today.
- Games and TV: games are stored per person as JSON (`GameProgress`), the TV per booking (`TvState`); anything stored that is no longer valid is repaired to its default on read. Problem titles: `badClue`, `badAnswer`, `badNumber`, `badChannel`, `badVolume`, `badDevice`, `badTitle`; `409 answered`; `403 age` for a title above the caller's age.
- Last-minute tours: offered while the ship is in port today. The ship's clock, not the calendar, decides (the mock used the calendar date in the port's zone). A booking is a `TourBookings` row with `Source = onboard` plus a `tour` line on the account, so it also appears in the excursions list and counts against the seats. `400 badTour` or `guests`; `409` `closed`, `soldOut`, `tooLate` (under two hours), `started`, `duplicate`, `age` (a child needs an adult, and a tour's minimum age applies).
- Readiness: ticks are per booking and day (`ReadyTicks`), not per person.
- Chat: a person sees every message in every group they belong to (`ChatGroupMembers`); the persona scripts or staff must create the groups, and a person in none who sends a message gets a group of their own. Blocking hides the blocked person's messages from the blocker only, and only for people who share a group (`400 notInChat`). A read receipt shows only if the sender has receipts on and the reader has too; marking seen is recorded only with receipts on. An under-18 cannot send a phone number or link (`400 contactInfo`) or a photo (`403 age`); a photo is a data URL under 1.4 million characters (`400 type|size|empty`). `POST /reports` takes a message id the caller can see (`404` otherwise) and one of `spam`, `rude`, `unsafe`, `photo`.

### 6.6 After the cruise (Phase 11)
| Api method | Route | Auth |
| --- | --- | --- |
| `disembark.view/choose/setTagsOn/customs/saveCustoms/onward/saveOnward/night/tick/finalBill/adjustTip/emailReceipt` | `GET /disembark`, `PUT /disembark/choice`, `PUT /disembark/tags`, `GET/PUT /disembark/customs`, `GET/PUT /disembark/onward`, `GET /disembark/night`, `PUT /disembark/night/{id}`, `GET /disembark/final-bill`, `PUT …/tip`, `POST …/email` | B / BA |
| `cases.list/open/withdraw` | `GET/POST /cases`, `DELETE /cases/{id}` | B / BA |
| `post.history/feedback/saveFeedback/loyalty/rebook/hold/releaseHold/convertFcc/bookSlot/cancelSlot` | `GET /history`, `GET/PUT /post-feedback`, `GET /me/loyalty-summary`, `GET /rebook`, `POST /rebook/holds`, `DELETE …/{id}`, `POST /rebook/convert-fcc`, `POST/DELETE /rebook/appointment` | B / BA |

Phase 11 built every row above (25 routes). Differences from the table and the mock:
- Routes: the final bill is `GET /disembark/final-bill`, `PUT /disembark/final-bill/tip` `{keepPercent}` and `POST /disembark/final-bill/email`; the night tick is `PUT /disembark/night/{id}` `{done}`; `/history` and `/post-feedback` are booking routes (`/me/history` is the account history of Phase 6); a hold is `POST /rebook/holds` `{departureId}` and `DELETE /rebook/holds/{id}`; the desk is `POST /rebook/appointment` `{at}` (epoch ms) and `DELETE /rebook/appointment`. Loyalty is `GET /me/loyalty-summary`, a user route, so the cruise it counts is the person's latest confirmed one that has begun boarding.
- Everything but loyalty and the trip history belongs to the **booking**, not to a person: the walk-off choice and bags, customs, the onward plan, the night ticks, the gratuity share, cases, **feedback** (one per booking, as `PostFeedback` is keyed; the mock kept one per person) and holds. Any guest reads, an adult guest writes (`403 supervised` for a child account). The future cruise credit is the booker's, whichever adult converts or applies it.
- The tag group is a steady pick from the booking number and sailing (Gold 1 with the `priorityDisembarkation` perk). Guests and case ids in the wire shapes are guids; bags are a map from guest guid to a count, and a guest left out has none.
- A case's stage, outcome and refund are worked out from the clock, as order stages are: `Cases.Stage` is `received` and then `withdrawn`, and `Outcome`, `RefundCents` and `RefundSentAt` are not read. A case number is `PC-{LF|BD|CL|CP|SR}-{5 digits}` from a hash of booking number, kind and count; `UX_Cases_Number` is global, so a taken number moves on to the next count. The bill query's `LineId` is the folio line id the client sends (up to 40 characters). A poor score (2 or below, overall or in an area) with `allowContact` opens one `recovery` case (`FromFeedback = 1`) for the booking.
- Account lines: the gratuity adjustment (`SourceType` `tip`, one line per booking, replaced on each change and removed when everything is kept or nothing is due), the onboard credit with a hold (`hold`, removed when the hold is released) and a future cruise credit changed to onboard credit (`fcc`, one line per change; `FutureCruiseCredits.RemainingCents` is reduced, earliest expiry first, and "converted so far" is read back from these lines). Credit already promised to a live hold is not offered again.
- Next season: `FUTURE_DEPARTURES` are rows of `ref.Sailings` with `BookingOpen = 0` (the FK of `RebookHolds`). They are priced in `Pricing` but `Pricing.HasPrice` is false, so Discover, booking and `GET /sailings` skip them. `bookable` on a hold or option is `BookingOpen` and priced and at least a day away.
- The Future Cruise Desk: `ref.DeskSlots.At` and `DeskAppointments.At` are **ship wall-clock** times (as the seed generator writes them), converted with the ship's zone for that date. A slot with `Capacity` appointments is not offered to anyone else (`400 badSlot`; `409 taken` only if it fills between the list and the booking); a booking has one appointment and booking another moves it; an appointment stops showing 30 minutes after it starts. Only guests still aboard may book (`409 closed`).
- Loyalty: `Loyalty.DaysCounted` is the cruise days on the record *before* the cruise in hand (without a row, the level's own minimum); the cruise's nights are added once the ship has tied up. `Referrals` rows are the friends; the credit earned is 50 dollars per friend who has sailed. The code is `Loyalty.ReferralCode`, else the first name and three digits.
- Problem titles: `badOption`, `badBags`, `tooManyToCarry`, `noBags`, `badGoods`, `badNote`, `badMode`, `badFlightTime`, `badFlight`, `badItem`, `automatic`, `badTip`, `noEmail`, `badKind`, `badSummary`, `badPlace`, `noPlace`, `noLine`, `badAmount`, `noOverall`, `badRating`, `badComment`, `badCrew`, `badDeparture`, `noCredit`, `badSlot`; `409` `closed`, `deadline`, `notTagged`, `tooLate`, `tooManyCases`, `alreadyQueried`, `expired`, `alreadyHeld`, `tooManyHolds`, `taken`.
- Stored rows written by the persona scripts are read leniently: a customs declaration with `goods` instead of `goodsUsd`, an onward `Mode` the rules do not know (shown, not checked) and feedback with the area scores at the top level.

### 6.7 Demo endpoints (not in the `Api` interface)
`GET/PUT /demo/state` (built): `{ clockOffsetSeconds, clockSpeed, scenarios }`, plus `savedAt` on answers (ms since 1970 when the offset was set; 0 when never saved), demo accounts only (`IsDemo`), else `404`. The offset is seconds added to real time; `UserClock` adds what a running fast clock (speed over 1) has gained since `savedAt`; speed 0 (stopped on the screens) is stored as 1, so a stopped clock is not followed by the server; an unknown scenario is `400 badScenario`, an offset over a year `400 badOffset`, a speed outside 0 to 3600 `400 badSpeed`. The screens send their controls here whenever they change (REST mode, demo accounts).
`GET/PUT /demo/state` also carry `sailingId` (a sailing id such as `sun-2026-11-22`, `400 badSailing` otherwise) and `phoneZone` (an IANA zone, `400 badZone` otherwise): the sailing the demo is on and the pretend phone zone, so they follow the demo account between devices (`demo.DemoState.SailingId`, `PhoneZone`; both null until saved).
`GET /me/context` (built): `{ person, party, booking, sailingId, phoneZone, nowMs, isDemo }`. `person` and each `party` entry are `{ id, name, firstName, age, child, booker, tier }`; `booking` is the current trip `{ number, sailingId, package, category }` or null; `sailingId` is the current trip's sailing, or for a demo account the one it chose; `nowMs` is the server's time (moved by the demo clock for a demo account). This is how a device learns who, when and which trip, so it holds none of it.
`POST /demo/jump {at}` (built) moves the clock so "now" is `at` (ms), measured on the server's clock, keeping speed and scenarios (`400 badOffset` over a year away). `POST /demo/reset` (built) is real time, speed 1, no scenarios. Both answer the new state. Not built: re-running persona reset for the caller's booking. A new device takes a demo account's saved controls (`pullDemoFromServer`) unless the server's copy is the one it last sent or received.

### 6.8 Account state (multi-device; not in the `Api` interface)
| Route | Verb route | Auth |
| --- | --- | --- |
| list a person's documents | `GET /me/state` | U |
| one document (JSON `null` when none) | `GET /me/state/{key}` | U |
| save a document | `PUT /me/state/{key}` body `{ data, baseVersion }` | U |
| delete a document | `DELETE /me/state/{key}` | U |
| delete all of a person's documents (privacy) | `DELETE /me/state` | U |
| export account state (own documents and each booking's) | `GET /me/export` | U |
| list a booking's documents | `GET /bookings/{n}/state` | B |
| one booking document | `GET /bookings/{n}/state/{key}` | B |
| save a booking document | `PUT /bookings/{n}/state/{key}` | BA |
| delete a booking document | `DELETE /bookings/{n}/state/{key}` | BA |
| the port day's rows (presence, plan, meeting places, split ledger) | `GET /bookings/{n}/port-rows` | B |
| change port-day rows (a batch, later `at` wins, a delete is a row) | `POST /bookings/{n}/port-rows` body `{ ops: [{ kind, key, data, at, deleted }] }` | BA |

A document is `{ key, version, data, updatedAt }`. `baseVersion` is the version the device last saw (0 for none); if the stored version differs the save is `409` (`stale`) and the device fetches the newer copy and merges. A key outside the whitelist is `400 badKey`, a body that is not a JSON object `400 badData`, and one over the key's size cap `400 tooLarge`.

Port rows (`PortRows`): both routes return `{ rows: [{ kind, key, data, at, deleted }] }`, every row of the booking including deleted ones. A batch holds 1 to 100 ops; a `kind` outside the list, a `key` that is not 1 to 90 letters, digits or `_ - | :`, data of more than 2,000 characters (or missing on a change) is `400 badPortRow`, more than 100 ops `400 tooManyOps`, and a booking past 1,000 rows `409 tooManyRows`. An `at` more than five minutes ahead of the server is cut back to that, so one wrong clock cannot win for ever. A supervised child may read but not change (`403 supervised`), a stranger gets `404`. The privacy export lists the rows as a booking document named `port-rows`.

### 6.9 Reference data and feeds (multi-device Phase 5; not in the `Api` interface)
| Route | Verb route | Auth |
| --- | --- | --- |
| exchange rates per US dollar with their date (stub feed unless `Providers:Rates` is `http`; same for every device) | `GET /rates` | U |
| excursion difficulty by id and the room types with accessible staterooms | `GET /reference/access` | U |
| passport validity by stop and citizenship (`monthsUs`, `monthsOther`, `visaCheckOther`), a general guide | `GET /reference/entry` | U |
| the option lists, menus and texts (`{ version, values: { "module.NAME": list or record } }`), from `Content/reference-content.json` | `GET /reference/content` | U |
| the sailings, ports, the shared eight-day itinerary (each day with the `shipZone` the ship's clocks follow), plus `entries`: every catalogue sailing (filters `ship`, `region`, `from`, `to`, `nightsMin`, `nightsMax`, `port`) | `GET /reference/sailings` | U || the days of one sailing with times, clock changes, the ship's zone each day and dress code | `GET /reference/sailings/{id}/itinerary` | U || ships, one ship (decks, venues, categories), regions, ports and itinerary patterns of the catalogue | `GET /reference/catalogue/ships`, `/ships/{id}`, `/regions`, `/ports`, `/patterns` | U || the ship, stateroom categories, deck plan, elevator banks and muster stations | `GET /reference/ship` | U || the programme events and the mid-day plan changes (`IProgramChanges`) | `GET /reference/program` | U || port guides, port knowledge and map coordinates by port | `GET /reference/ports` | U || add-ons with their base prices, the worth-it figures and the refund window | `GET /reference/packages` | U || the limits, windows, fees and rates the server enforces | `GET /reference/limits` | U || the sky on a date at a port (simulated feed, one weather model with packing and today) | `GET /feeds/sky?date=&port=` | U || status of a flight on a date (simulated feed) | `GET /feeds/flight?number=&date=` | U || traffic and weather on the way to the port (simulated feed) | `GET /feeds/route?departure=&crowd=` | U |
| a batch of consented error reports and usage counts (no person or typed text) | `POST /telemetry` | U |
| the authored catalogue: excursions, dining venues, ports | `GET /reference/catalogue` | U |
| ships in a port on a date and how busy it will be (simulated) | `GET /feeds/port-crowd?port=&date=` | U |
| the weekly fare for the same cabin since booking, for the price-drop watch (simulated) | `GET /feeds/fares?number=&total=&booked=&today=` | U |
| venue busyness for Ship Pulse, lines and quiet spaces (simulated) | `GET /feeds/pulse?departure=&now=` | U |
| storm watch for a sailing (simulated) | `GET /feeds/storm?departure=&days=` | U |
| sun, moon and stars for a cruise day (simulated) | `GET /feeds/sky-night?departure=&day=` | U |
| ship position, speed, heading, distances and ship time against local time (simulated) | `GET /feeds/ship-position?departure=&now=` | U |
| depth, water temperature, wind, Beaufort, sea state, waves and swell at the ship (simulated) | `GET /feeds/sea-conditions?departure=&now=` | U |
| sea zone, habitat, wildlife and the landmarks passing, ahead and behind (simulated) | `GET /feeds/along-the-way?departure=&now=` | U |
| the other loungers at a minute (simulated) | `GET /feeds/loungers?now=` | U |
| wildlife the ship is said to have seen on a day (simulated) | `GET /feeds/sightings?day=` | U |
| the lost-property list (simulated) | `GET /feeds/found` | U |
| a whole day of ship pulse levels (simulated) | `GET /feeds/pulse-day?departure=&day=` | U |
| when a place opens for a slot watch (simulated) | `GET /feeds/watch-opening?id=&created=&slot=` | U |
| the decide notes for a sailing: crowds, weather, hurricane, school, price (simulated) | `GET /feeds/sailing-quality?sailing=` → `{ sailingId, notes[5]: { key, level, text, why }, source }` | U |
| how a friend answers a sail-again invitation (simulated; asked only after consent) | `GET /feeds/friend-reply?name=` → `{ reply: accepted\|declined, source }` | U |
| arrival windows, terminal waits and the four-step forecast for a guest's needs (simulated) | `GET /feeds/embark-queue?priority=&mobility=&quiet=&earliest=` → `{ windows[]: { start, end, crowd, waitMinutes, steps[4], total }, recommended, source }` | U |
| the staterooms of a room type scored for sleep, motion and noise with reasons and sun side | `GET /sailings/{id}/cabin-guide?category=&quiet=&calmSea=&accessible=&clearView=&availableOnly=` → `{ sailingId, category, cabins[]: { cabin, category, sleep, motion, noise, reasons, sun, warnings }, source }` | P |
| ask guest services for a call back, a caregiver or a sensory kit | `POST /me/staff-requests` | U || list or cancel those requests | `GET /me/staff-requests`, `DELETE /me/staff-requests/{id}` | U || build a conflict-free week for a sailing from the guest's wishes (nothing is booked or kept) | `POST /me/autopilot/plan` | U || build one day of a sailing from the guest's wishes, with the events that could join it and the ship's changes today | `POST /me/day-plan` | U |
| make, stop and stop all family-at-home links; send a postcard | `POST /me/family-links` / `DELETE /me/family-links/{id}` / `DELETE /me/family-links` / `POST /me/family-postcards` | U |
| keep or remove the cruise recap the family page shows | `PUT /me/family-recap` / `DELETE /me/family-recap` | U |
| keep, list and delete the guest's own pictures; the allowance | `POST /me/media` / `GET /me/media` / `DELETE /me/media/{id}` / `GET /me/media/usage` | U |
| fetch a picture; the pictures of a stateroom type; a postcard's picture on the family page | `GET /media/{id}` / `GET /cabin-photos/{category}` / `GET /public/family/{token}/photos/{id}` | U |
| a day on this ship for someone not signed in | `POST /public/trial-day` | P |
| open a family-at-home link | `GET /public/family/{token}` | P |
| the organiser's roster: each person's check-in and documents only if they share their status, the money for the booker only (N4.5) | `GET /bookings/{n}/organiser` → `{ number, ship, departureMs, daysToGo, youAreBooker, guests[]: { id, name, child, isYou, sharesStatus, checkin: { done, total }\|null, documents\|null }, money\|null }` | B |
| the newest changes to the party's shared plan (N4.1) | `GET /bookings/{n}/party-log` → `[{ kind, label, at, deleted }]` (poll, idea, meet, item, party; at most 30) | B |
| list, make, end read-only caregiver and advisor links; tell the caregiver "I am fine" (N4.6) | `GET/POST /bookings/{n}/share-links` {kind: `caregiver`\|`advisor`, label}, `DELETE /bookings/{n}/share-links/{id}`, `POST /bookings/{n}/share-links/{id}/checkin` {note}; the address (`path`) is returned once by POST; 400 `badShareLink`, 403 `bookerOnly` (an advisor link), 409 `tooManyLinks` (6) | BA |
| open a share link: the sailing, the guest's note (caregiver) or paid and check-in progress (advisor); never a position, a medical detail or an amount | `GET /public/share/{token}` | P |
| ask the AI concierge (the thread so far and the guest's preferences) | `POST /me/concierge` | U |
| ask Stanley, the cruise chat helper (the thread so far) | `POST /me/stanley` | U |

`POST /me/media?purpose=&ref=&kind=&caption=` takes the picture as the request body (`image/jpeg` or `image/png`) and answers `{ id, purpose, ref, kind, caption, contentType, width, height, bytes, status, at, mine }`. The type is read from the bytes and the declared type is ignored; at most 2 MB, 8000 pixels a side and 25 million pixels; at most 40 pictures and 20 MB a guest (`409 full`). Before it is kept it is checked by an `IMediaScanner` (`Providers:MediaScanner`, default `sim`, which refuses the antivirus test string) and cleaned: a JPEG loses its EXIF/XMP, comments and other application blocks (JFIF, the colour profile and Adobe's colour flag stay), a PNG keeps only the chunks that draw it. `purpose` is `cabin` (`ref` a stateroom category, `kind` one of `room|view|obstruction|noise`), `book` (`ref` a cruise day `1` to `8` or `cover`) or `postcard` (no `ref`); the caption is at most 140 characters and cannot hold an email address, a link or a phone number. Refusals: `400 badPurpose|empty|size|badRef|badKind|badCaption|type|unreadable|scan`, `403 childCannotUpload` (a supervised child), `409 full`. A cabin picture is `pending` and the simulated moderator calls it `approved` after 10 minutes (`MediaRules.EffectiveStatus`); the others are `approved`. `GET /media/{id}` serves the owner's picture always, and another guest's only if it is an approved cabin picture **and** `Media:ShowOthers` is on (default off: the plan says not to show other guests' pictures until moderation is settled); anything else is `404`. `GET /cabin-photos/{category}` lists the caller's own pictures of that room type and, when `Media:ShowOthers` is on, others' approved ones. `POST /me/family-postcards` also takes `photoId` (one of the caller's own `postcard` pictures); `GET /public/family/{token}/photos/{id}` serves it with no sign-in to anyone holding a live link, only while that picture is on a postcard the page shows (`404` otherwise, rate-limited by address). The page's postcards carry `photo` (the id, or null). Deleting a picture (or the account) removes it from any postcard.

Returns `{ version, asOf, perUsd }`. The source is `Providers:Rates`: `sim` (default, the authored sample moved a little each day) or `http` (a Frankfurter-compatible feed, `Rates:BaseUrl`, with `Rates:TimeoutSeconds`). It is asked at most every six hours however many devices ask; codes it lacks (the Belize dollar and Honduran lempira) keep their sample rate; if it cannot answer, the last table it gave is served with its own older `asOf`, and with none ever, the sample table dated 2026-10-01 (so the app calls it out of date). Reading only: the account is charged in US dollars. `/reference/access` returns `{ version, difficulty: { <excursionId>: { km, steps, heat, shade, seats, restrooms, wet } }, accessibleCategories: [<categoryId>] }`. `/feeds/sky` returns `{ uv, tempF, rainFrom, rainTo, source: 'sim' }` (`HH:mm` or null); a missing or malformed `date`/`port` is `400 badFeedQuery`. `/feeds/flight` returns `{ state: onTime|delayed|cancelled, delayMinutes, source: 'sim' }`; a number that is not two letters and 1 to 4 digits, or a date that is not `YYYY-MM-DD`, is `400 badFeedQuery`. `/feeds/route` takes the sailing date and the arrival window's crowd (`quiet|busy|busiest`) and returns `{ traffic: light|moderate|heavy, sky: clear|cloudy|rain|storm, leaveEarlierMinutes, source: 'sim' }`. `POST /telemetry` takes `{ items }` (1 to 100 of `{ type: 'error', kind, message, at }` or `{ type: 'event', name, screen?, at }`; known kinds and event names, message up to 500 characters, safe screen names), answers 204, and anything else is `400 badTelemetry`. `/feeds/port-crowd` returns `{ ships, guests, level: quiet|moderate|busy, stayAboardNote, source: 'sim' }` for a port (`cozumel|belize|roatan`) and date; `/feeds/fares` returns up to 26 `{ date, total }` points in cents; a bad query is `400 badFeedQuery`. `/feeds/pulse` returns `{ now, observedAt, venues: { <venueId>: { observed, ahead: [9 levels] } }, source: 'sim' }` (levels 0 to 100 at the last five-minute mark and at `now` plus 0 to 8 half hours; `now` in ms). `/feeds/storm` returns `{ departure, returns, inSeason, percent, band, phase, lineMay[], youCan[], peak, source }`. `/feeds/sky-night` returns `{ day, port, sunrise, sunset, sunsetAt, moon: { phase, name, lit }, sunsetSide, sailAway, sailAwayAtSunset, stars[], darkSky, source }`. `/feeds/sky-night` also carries `firstLight`, `lastLight` (civil twilight) and `darkAt` (nautical twilight), ship-time `HH:mm`. `/feeds/ship-position` (`now` in ms, any moment: before sailing the ship is alongside in Fort Lauderdale, after arrival too) returns `{ now, day, lat, lon, speedKnots, headingDegrees, compass (16-point), inPort, lastPort, nextPort, nmSailed, nmRemaining, legPercent, voyageNmSailed, voyageNmTotal, arrival: { at, shipTime, day }, clock: { shipTime, shipOffsetMinutes, shipZone: eastern|belize, localPlace, localTime, localOffsetMinutes, differenceMinutes, nextChange: { at, hours, day } }, source }`. `/feeds/sea-conditions` returns `{ now, lat, lon, depthM, depthClass: shelf|slope|deep|trench, waterTempC, windKnots, windFrom, beaufort 0-12, seaState 0-9 (WMO), waveM, swellM, swellPeriodSeconds, swellFrom, source }` in metric (the client converts). `/feeds/along-the-way` returns `{ now, zone: { id, name, habitat, wildlife[] }, passing[], ahead[] (up to 4), behind[] (up to 3), source }`, each landmark `{ id, name, kind, blurb, lat, lon, closestNm, side: port|starboard|ahead, passesAt, shipTime, day, distanceNm }`; landmark and zone text is English. All three come from `IShipNavigation` (`Providers:ShipNavigation`, default `sim`: authored waypoints with depths for the four legs, constant speed from the posted sailing times, weather from the clock), and a bad query is `400 badFeedQuery`. `/feeds/loungers` returns `{ minute, loungers: [{ id, state: free|held|overdue, returnsIn }], source }` (the guest's own hold stays on their device). `/feeds/sightings` returns `{ day, species[], source }`; `/feeds/found` returns `{ items: [{ id, what, keywords[], at }], source }`; `/feeds/watch-opening` returns `{ opensAt, source }` (ms or null). Bad queries are `400 badFeedQuery`. `POST /me/staff-requests` takes `{ kind: callback|caregiver|kit, reason? }` (callbacks: `urgent|changes|health|other`, default `other`; the others take none) and returns `{ id, kind, reason, at, position, readyAt, source: 'sim' }` (times in ms) from `IStaffQueue` (simulated: a place 1 to 6, four minutes each); anything else is `400 badStaffRequest`; the ticket is kept in `StaffTickets`. `GET /me/staff-requests` lists the caller's tickets from the last two hours, newest first, each `{ id, kind, reason, at, position, readyAt, status: waiting|due|lapsed, source }` (`position` counts down as the expected time nears); `DELETE /me/staff-requests/{id}` cancels one (`404` if it is not the caller's). `POST /me/autopilot/plan` takes `{ sailingId, prefs: { pace: relaxed|balanced|packed, mobility: any|easy|wheelchair, withKids, tours[], events[], maxTour (cents or null), noEarly } }` and returns `{ days[8]: { day, port, items[{ kind: tour|event|dinner, id, title, start, why }], restDay, alternative, tourCost }, totalTours, prefs }`; an unknown preference or sailing is `400 badAutopilot`. `POST /me/day-plan` takes `{ sailingId, day (1 to 8), wish: { tours[], events[], mobility: any|easy|wheelchair, withKids, maxTour (cents or null) } }` and returns `{ day, items[{ id, title, start, minutes, kind: tour|event|dinner, placeId?, outdoor, path, why }], empty, backBy, alternatives[same shape], shipChanges[{ id, kind: moved|cancelled, start, reason }] }`; an unknown wish, day or sailing is `400 badDayPlan`. Each day in the `/me/autopilot/plan` answer also carries `base` and `target` (the day under the guest's own wishes and under the week's). `POST /me/family-links` takes `{ days? }` (3, 7 or 14; 7 otherwise) and returns `{ id, token, expiresAt }` once; the token is `owner.link.expiresMs.signature` (HMAC-SHA256 with a key derived from the token signing key, so a link can never be a sign-in token) and the `FamilyLinks` row says whether it is live; a supervised child gets `403 childCannotShare`, a 21st live link `409 tooManyLinks`. `DELETE /me/family-links/{id}` stops one (`404` if it is not the caller's) and `DELETE /me/family-links` all of them. `POST /me/family-postcards` takes `{ kind: ok|sea|port|late|love, note? }` (note cut to 140; newest 30 kept; `400 badPostcard`). `PUT /me/family-recap` takes `{ text }` (at most 12 lines, 200 characters a line and 800 in all, control characters dropped, nothing cut: `400 badRecap`; `403 childCannotShare`) and `DELETE /me/family-recap` removes it; it is kept in the guest's `familyRecap` state document. `POST /public/trial-day` needs no sign-in, is rate-limited by address, takes the same body as `/me/day-plan` and answers the same shape from ship-level data only (`400 badDayPlan`). `GET /public/family/{token}` needs no sign-in, is rate-limited by address and returns `{ ok, reason?, guestFirst, expiresAt, postcards: [{ kind, note, at }], scenarios[], delayedMinutes?, recap? }`; `ok: false` carries `signature`, `unknown`, `revoked` or `expired` and nothing else. The contacts' names and addresses stay in the encrypted `family` document. `POST /me/concierge` takes `{ history: [{ role: user|assistant, text, at }], mobility?, likes? }` (1 to 60 messages, ending with the guest's, at most 500 characters) and returns `{ text, citations: [{ label, path }], source: claude|scripted|handoff, handoff: emergency|medical|legal|person|null, fallback: auth|rate|network|bad|limit|null }`; a thread it cannot answer is `400 badConcierge`. Emergency, medical, legal and person messages are answered `handoff` and never reach a model; the model (key `Concierge:ApiKey` in user-secrets, behind `IConciergeModel`) runs the seven tools over the catalogue and the guest's own booking, 20 questions an hour per person, and the scripted concierge answers with `source: scripted` when there is no key, the limit is reached or the call fails.

## 7. Authorisation rules (one place)

1. **Member**: `EXISTS (BookingGuests WHERE BookingId = b AND UserId = sub)`. Anything else on a booking → `notFound`.
2. **Adult-write**: member and not `IsSupervised`, else `forbidden`. A booker acting with `act` claim for a child is treated as the child (read-only for child-restricted actions) per D13.
3. **Helper**: `HelperLinks.Status = 'active'` with the needed permission **and** `view`; grants read/write of that guest's `documents`, `payments`, `profile` only, never chat, orders or health.
4. **Parent-for-child**: `Users.BookerUserId = sub` (privacy consents, budget limits, club registration, family controls).
5. **Booker-only**: change, cancel, link-removal.
6. **Closed windows** (check-in window, booking closes 1 day out, dining windows, orders open embark → last evening) are evaluated against the demo-aware clock (D4), not wall time.

## 8. Mock-only behaviour that needs a home

| Behaviour | Where it goes |
| --- | --- |
| Crew replies to service chat (`service.send`, advisors `reply`) | `ICrewResponder` interface, mocked in C# (templates + delay via `ServiceMessages.At` in the future, so replies appear on read). |
| AI concierge | `IConciergeModel` in `Services/Concierge.cs` (Anthropic Messages API when `Concierge:ApiKey` is set, otherwise unavailable and the scripted concierge answers); guard, tools, scripted answers and the hourly limit are in `Domain/ConciergeRules.cs` and `ConciergeService` (built, Phase 2 of plan 2). The front end holds no key. |
| Weather, flights, route conditions, telemetry sink | `IWeatherService`, `IFlightStatusProvider`, `IRouteConditionsProvider`, `ITelemetrySink` in `Services/Providers.cs`, simulated in C# (built, Phase 1 of plan 2); packing, `onboard.today.weather` and `/feeds/*` all call them. `IShipTelemetry` (port crowd, pulse, loungers, sightings, sky night), `IFareFeed`, `IStormOutlook`, `ILostProperty` and `ISlotWatchFeed` came in Phase 3. |
| Payment charge, 3-D Secure challenge, declined card | `IPaymentGateway` (D15 / plan Phase 7): `0002` last four declines; new card or ≥ $3,000 needs `challenge = 123456`. |
| Photo download failure | `photoFail` scenario: first `download` per receipt after activation returns `network` — implemented client-side (fault rule), server just records progress. |
| Retention deletion | Scheduled job + `RetentionRuns`; `privacy.view` also triggers a lazy check as the mock does. |
| Stage progress of orders/laundry/requests/medallion/cases | Computed from stored timestamps and the clock on read (as the TS functions do); no background worker needed. |
| Demo code for marketing consent | Returned only when `Users.IsDemo`. |

## 9. Questions answered (2026-10-29)

| # | Question | Answer | Effect on this document |
| --- | --- | --- | --- |
| 1 | Chat scope | **Groups.** Friends in separate cabins share a chat. | `ChatGroups` / `ChatGroupMembers` stay as modelled in 4.8. |
| 2 | Linked agent bookings | Linking creates guests as `BookingGuestDetails` with no user accounts; the linker sees them read-mostly. | 4.3 stands as written. |
| 3 | Legacy groups | **Drop** `dining.list/reschedule`, `queues.list` and `requests.list/create` (and their mocks) in the frontend phases. | The 6.3 and 6.5 rows are marked dropped; Phase 11's interface check excludes them. |
| 4 | Reference content | **The database holds the English authored copy** (FAQs, help, safety text, menus, legal); UI chrome stays in `src/i18n`. | `ref.Faqs/HelpTopics/ContentBlocks/LegalDocs` hold full text; Phase 3 seeds are larger. |
| 5 | Photos in chat | Keep the data URL in the `ChatMessages` table for now. | No change. Blob storage is a later option. |
| 6 | Hash cost | 200 to 300 ms per login is fine; keep PBKDF2 at 600,000 iterations. | D12 stands. |

No open questions remain for Phase 2.

`POST /me/stanley` takes `{ history: [{ role: user|assistant, text, at }] }` (1 to 60 messages, ending with the guest's, at most 500 characters; only the latest 10 clean round trips are used, and a round trip whose guest message is blocked or needs a handoff is dropped) and returns `{ kind: answer|blocked|offtopic|handoff|unavailable, text, handoff: emergency|medical|legal|person|null, source: claude|scripted|'', fallback: limit|auth|rate|network|bad|null }`. `text` is set only for an answer; the front end words every other kind. Order: word filter (`blocked`, no model), safety screen (`handoff`, no model), hourly limit (`unavailable`/`limit`; shared with the concierge's 20 an hour), topic prescan (`offtopic`), answer (no tools). With no model set up a keyword gate decides cruising or not and a fixed scripted answer is returned (`source: scripted`). A thread it cannot answer is `400 badStanley`.
