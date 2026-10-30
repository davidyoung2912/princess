# Backend data model and API surface (Phase 1)

Status: **Draft for review. No SQL or C# has been written.** Written 2026-10-29 from `src/api/*Types.ts` and `src/domain/*`. Phase 2 turns section 4 into `db/01-schema.sql`; Phases 5 to 11 use section 6 as their checklist.

Sections: 1 Decisions settled here · 2 Conventions · 3 Reading the table notation · 4 Tables · 5 JSON columns · 6 API surface · 7 Authorisation rules · 8 Mock-only behaviour that needs a home · 9 Questions for you.

## 1. Decisions settled here

These close the open items in `backend-plan.md` section 2 and the "settle in Phase 1" notes. Say so if you disagree with any; the rest of the document follows from them.

| # | Topic | Decision | Why |
| --- | --- | --- | --- |
| D1 | Id strategy | **Reference rows keep their string ids** from the TypeScript source (`sun-2027-03-21`, `interior`, `coz-snorkel`) as `NVARCHAR(40)` primary keys. **User-owned rows use `UNIQUEIDENTIFIER`** (`NEWSEQUENTIALID()` default). **Booking number** (`PC482113`-style, 8 chars) and **account number** (10 digits) are unique natural keys alongside the guid. | Seeds and screens keep working with the existing ids. Guids stop people guessing other people's row ids. Sequential guids keep the clustered index from fragmenting. |
| D2 | `PersonaId` | Becomes `Users.Id` (guid). Every API field typed `PersonaId` becomes a user guid string. The 12 personas keep a `Slug` (`gerald`, `maya`) column for seeds, logs and the test-accounts help text only. | The party is a set of users on a booking; no separate "persona" concept on the server. |
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
- Every table in `dbo` has `CreatedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()`. Mutable ones also have `UpdatedAt`. Not repeated in the column lists below.
- Every user-owned table carries `UserId` (the owner) **or** `BookingId` (booking-scoped) so authorisation is one join (`BookingGuests` gives membership). Tables carrying both are marked.
- Foreign keys are real and named `FK_<Child>_<Parent>`; `ON DELETE CASCADE` from `Users` and `Bookings` to their child rows (so a retention delete is one statement), `NO ACTION` everywhere else.
- Checks use named constraints `CK_<Table>_<Column>`.
- Index naming `IX_<Table>_<Cols>`; unique `UX_<Table>_<Cols>`. Only indexes with a stated reason are listed.

## 3. Reading the table notation

`Col TYPE` with `*` = NOT NULL, `?` = NULL, `PK`, `FK→Table`, `UQ`, `{a|b|c}` = CHECK list, `[json]` = JSON column (section 5). Types: `GUID` = UNIQUEIDENTIFIER, `STR(n)` = NVARCHAR(n), `INT`, `BIG` = BIGINT cents or counts, `BIT`, `DATE`, `TS` = DATETIME2(0), `TXT` = NVARCHAR(MAX). "API:" names the `Api` group that reads (R) and writes (W) the table.

## 4. Tables

### 4.1 Identity (`dbo`)

**Users** — API: auth R/W, account R/W, everything for authorisation.
`Id GUID* PK` · `Slug STR(30)? UQ` (seed personas only) · `AccountNumber CHAR(10)* UQ` (digits, generated; `CHECK LIKE '[0-9]{10}'` via 10 × `[0-9]`) · `Email STR(254)? UQ filtered (NOT NULL)` · `PasswordHash STR(200)?` · `Role {guest|staff|admin}*` default `guest` · `IsDemo BIT*` · `IsSupervised BIT*` · `BookerUserId GUID? FK→Users` (required when supervised) · `Tier {none|gold|ruby|platinum|elite}*` · `Sanctuary BIT*` · `TextSize STR(12)*` default `standard` · `PhoneZone STR(40)*` default `America/Chicago` · `Currency CHAR(3)*` default `USD` · `Locale STR(10)*` default `en` · `LockedUntil TS?` · `FailedLogins INT*` · `LastLoginAt TS?` · `RowVersion`.
Checks: supervised ⇒ `BookerUserId NOT NULL AND PasswordHash IS NULL`; not supervised ⇒ `PasswordHash IS NOT NULL OR IsDemo = 0` (a non-demo adult must have a password).
Indexes: `UX_Users_Email` filtered; `UX_Users_AccountNumber`; `IX_Users_BookerUserId`.

**Profiles** — account R/W (`account.profile`, `saveProfile`).
`UserId GUID* PK FK→Users` · `FirstName STR(60)*` · `LastName STR(60)*` · `Dob DATE*` · `Phone STR(30)?` · `Citizenship {us|other}*` · `Bedding {queen|twin|noPreference}*` · `SpecialRequests STR(500)*` · `EmergencyName STR(80)*` · `EmergencyPhone STR(30)*` · `EmergencyRelationship STR(40)*` · `Street/City/Region/Postcode/Country` (`STR`, lead contact address, nullable) · `RowVersion`.
Email lives on `Users`. `dietary` and `needs` lists are in `ProfileTags` (below) so the data is queryable ("who has a nut allergy" for the dining reservation pass-through).

**ProfileTags** — `UserId GUID* FK→Users` · `Kind {dietary|need}*` · `Code STR(20)*` · PK (`UserId, Kind, Code`). Codes are the `DietaryId` and `NeedId` unions.

**RefreshTokens** — auth W.
`Id GUID* PK` · `UserId GUID* FK→Users` · `FamilyId GUID*` · `TokenHash BINARY(32)* UQ` · `ExpiresAt TS*` · `UsedAt TS?` · `RevokedAt TS?` · `ReplacedById GUID?` · `UserAgent STR(200)?` · `Ip VARCHAR(45)?`.
Index: `IX_RefreshTokens_UserId_FamilyId`.

**HelperLinks** — account R/W (`helper`, `saveHelper`, `revokeHelper`).
`Id GUID* PK` · `GuestUserId GUID* FK→Users` (the guest who consents) · `HelperName STR(80)*` · `HelperUserId GUID? FK→Users` (set once the helper has an account) · `Relationship STR(40)*` · `Permissions [csv view,documents,payments,profile]` stored as `Permissions STR(60)` · `Status {requested|active|revoked}*` · `ChangedAt TS*`.
Check: `active` ⇒ `Permissions` contains `view`. Unique filtered (`GuestUserId`) where status ≠ `revoked` (one live helper, as the UI has one).

**HistoryEntries** — `account.history` R; written by every mutating call.
`Id GUID* PK` · `UserId GUID* FK→Users` (whose record) · `ByUserId GUID* FK→Users` · `What {profile|documents|payment|card|helper|trip|notifications|booking|tour|dining|purchase|assistance|travel|checkin}*` · `Detail STR(300)*` · `At TS*`. Index `IX_HistoryEntries_UserId_At`.

**SavedCards** — payments R/W (`addCard`, `removeCard`), pay screens.
`Id GUID* PK` · `UserId GUID* FK→Users` · `Brand {visa|mastercard|amex|discover}*` · `Last4 CHAR(4)*` · `Expiry CHAR(5)*` (`MM/YY`) · `IsDefault BIT*` · `GatewayToken STR(100)?` (null in the mocked gateway). Only brand, last four and expiry are ever stored. Unique filtered (`UserId`) where `IsDefault = 1`.

**Notices** — notifications R/W.
`Id GUID* PK` · `UserId GUID* FK→Users` · `Kind STR(30)*` · `Severity {info|important|urgent}*` · `Title STR(120)*` · `Body STR(1000)*` · `LinkRoute STR(120)?` · `ReadAt TS?` · `At TS*`. Index `IX_Notices_UserId_At`.

**NotificationPrefs** — `UserId GUID* PK FK→Users` · `Prefs [json]` (the `NotificationPrefs` object; channel × category matrix, quiet hours).

**ConsentChoices** — privacy R/W (`setConsent`).
`UserId GUID* FK→Users` · `ConsentId STR(30)*` · `On BIT*` · `ChangedByUserId GUID* FK→Users` · `At TS*` · PK (`UserId, ConsentId`). Consent ids from `privacy.ts`.

**AccessLog** — privacy R. `Id BIGINT IDENTITY PK` · `UserId GUID* FK→Users` (whose data) · `Actor STR(80)*` · `Purpose STR(120)*` · `At TS*`. Index `IX_AccessLog_UserId_At`.

**RetentionRuns** — privacy R. `Id GUID PK` · `UserId GUID* FK→Users` · `Rule STR(30)*` · `Kinds STR(200)*` · `At TS*`.

**SupportTickets** — support R/W.
`Id GUID* PK` · `UserId GUID* FK→Users` · `Kind {callback|email}*` · `Status {open|inProgress|done}*` (the `TicketStatus` union) · `Detail STR(1000)*` · `At TS*`.

**Favourites** — discover R/W (`favourites`, `toggleFavourite`) **and** `ahead.saved` R/W (same concept: keys `item:…`, `excursion:…`, `kind:id`). `UserId GUID* FK→Users` · `ItemKey STR(80)*` · `Position INT*` · PK (`UserId, ItemKey`).
*Decision:* one table serves both groups (the two lists are the same key space in the UI).

**DemoState** (`demo`) — new demo endpoints.
`UserId GUID* PK FK→Users` · `ClockOffsetSeconds BIGINT*` · `ClockSpeed INT*` · `ActiveScenarios [json array]` · `UpdatedAt`.

### 4.2 Reference data (`ref`, read-mostly, seeded in Phase 3)

All have string primary keys equal to the current TypeScript ids.

**Ships** — `Id` · `Name` · `Class` · `Decks INT` · `Tonnage` · `Capacity INT` · `HomeZone STR(40)` · `ProfileJson [json]` (the `shipInfo`/`ship` profile text). One row (Sun Princess).
**Decks** — `ShipId FK` · `Number INT` · `Name` · `Summary` · PK (`ShipId, Number`). (`deck.ts`)
**CabinCategories** — `Id` ({interior|oceanview|balcony|miniSuite|sanctuaryMiniSuite|signatureSuite}) · `Name` · `IsSuite BIT` · `Capacity INT` (4, signature suite 3) · `SizeSqFt INT` · `Description` · `Features [json]` · `SortOrder INT`.
**Cabins** — `ShipId` · `Number STR(8)` · `CategoryId FK` · `Deck INT` · `Section {fwd|mid|aft}` · `Side {port|starboard}` · `Accessible BIT` · `Connecting BIT` · `MusterStationId FK` · PK (`ShipId, Number`). Sample set as `booking.cabins` shows ("sample staterooms … which are free"); full deck plan is out of scope.
**Ports** — `Id` ({fll|sea|cozumel|belize|roatan}) · `Name` · `Country` · `TimeZone STR(40)` · `Tender BIT` · `EntryNote` (from `PORT_ENTRY`) · `Contacts [json]` (`PortContacts`).
**Sailings** — `Id` (`sun-2027-03-21`) · `ShipId FK` · `Departure DATE` · `Nights INT` · `IsHoliday BIT` · `IsReference BIT` · `Title` · `BookingOpen BIT` (computed in the API as "≥ 1 day to go"; stored flag only for manual closing).
**ItineraryDays** — `SailingId FK` · `Day INT` · `Date DATE` · `PortId FK` · `ArriveLocal TIME?` · `DepartLocal TIME?` · `AllAboardLocal TIME?` · `ClockChangeHours INT?` · `ClockChangeAtLocal TIME?` · PK (`SailingId, Day`). Template for all 8 sailings is identical; stored per sailing so a skipped port is data.
**MusterStations** — `Id` · `ShipId FK` · `Name` · `Place` · `Deck INT`.
**Venues** — `Id` · `Kind {main|specialty|casual}` · `Name` · `Cuisine` · `Deck INT` · `DressCode {casual|smart|elegant}` · `Capacity INT` · `Walkin BIT` (queueable) · `OpenFrom/OpenTo TIME` · `CoverCents BIGINT` · `Description` · `Hours [json]` (per day overrides).
**Menus / MenuItems** — `MenuItems`: `Id` · `VenueId? FK` · `MenuGroup {mains|snacks|desserts|drinks|breakfast}` · `Name` · `Description` · `PriceCents BIGINT` · `Dietary [json array]` · `Orderable BIT` · `Stock INT?`; `MenuExtras`: `Id` · `ItemId FK` · `Label` · `Cents`. (`menus.ts`, `orders.ts` `MenuItem`)
**Excursions** — `Id` (`coz-snorkel`) · `PortId FK` · `Name` · `Interest` · `Activity {easy|moderate|strenuous}` · `AdultCents` · `ChildCents` · `MinAge INT` · `DurationMin INT` · `StartLocal TIME` · `BackByLocal TIME` · `Tender BIT` · `Capacity INT` · `Meeting` · `Description` · `Tags [json]`. `ExcursionDepartures`: `ExcursionId` · `SailingId` · `Day INT` · `SpotsTotal INT` — spots left = total − booked guests.
**Events** — `Id` · `Kind` · `Title` · `Place` (venue/place id) · `StartLocal TIME` · `DurationMin` · `AgeGroup {all|kids|teens|adults}` · `Interests [json]` · `Ticketed BIT` · `Seats INT?` · `Deck`; `EventDays` (`EventId`, `SailingId`, `Day`, `StatusOverride`) so the schedule per day and the `planChange` scenario (move/cancel) are data, not code. (`program.ts`)
**Fares** — `Id` ({standard|plus|premier}) · `Name` · `PerNightCents` · `Tagline`.
**Promotions** — `Id` ({earlyCredit}) · `MinDaysOut INT` · `CreditCentsStandard` · `CreditCentsSuite`.
**Packages** — `Id` ({plus|premier}) and **AddOns** — `Id` ({drinks|wifi|specialtyPass|photo|laundry}) · `Unit {personNight|person|room}` · `BaseCents` · `ChangeOn DATE` · `ChangesToCents` (price-protection data) · `Description`. `PackageUpgrades`: `ToPackageId` · `PriceCents` · `ChangeOn` · `ChangesToCents`. `Entitlements`: `Tier` / `PackageId` → `DrinkCapUsd`, `WifiDevices`, `SpecialtyMeals`, `ExcursionCreditUsd`, `PhotoIncluded`, `LaundryBags`, `Priority BIT` — the table form of `computeEntitlements`'s inputs; the **function** is ported to C#.
**PhotoCatalogue** — `Id` · `Day INT` · `Place` · `Caption` · `Thumb STR(200)` · `PhotographerSlot` (`PhotographerSlots`: `Day`, `Place`, `StartLocal`). Photo pricing options (`OptionId` table `PhotoOptions`: `Id`, `Cents`, `Count`, `Description`).
**CrewMembers** — `Id` · `Name` · `Role {steward|dining|entertainment|guest}` · `ShipId FK`.
**Advisors** — `Id` · `Name` · `Agency` · `Region` · `Languages [json]` · `Speciality {family|luxury|accessible|groups|first}` · `Hours` (from `ahead.ts`).
**Faqs / HelpTopics / ContentBlocks** — `Id` · `Area` · `Title` · `Body TXT` · `Locale` · `SortOrder`. Holds `help.ts`, `safety` text, legal documents (see below), and authored copy that the UI today ships in `src/i18n`/`domain`. UI chrome strings stay in the frontend.
**LegalDocs** — `Id` ({terms|health|age|pregnancy}) · `Version` · `Title` · `Statement` · `Body [json array]`. PK (`Id, Version`).
**ServiceItems** (housekeeping/maintenance request catalogue): `Id` · `Group {housekeeping|maintenance}` · `EtaMin` · `MaxQty`. **Drinks**: `Id` · `Cents` · `Alcohol BIT`. **Clubs** (family): `Id` ({firefly|neon-grove|underground}) · `Name` · `MinAge` · `MaxAge` · `Deck` · `OpenFrom/OpenTo`. **TravelWindows** (arrival windows): `Id` · `StartLocal` · `EndLocal` · `Priority BIT`. **NightChecklistItems**, **PackingItems** (`Id`, `Label`, `Rule [json]`), **ChecklistItems** (`Id`, `Phase`, `DueDaysBefore`, `Label`), **AdvisorQuiz** *stays in code* (pure scoring over `CabinCategories`).

### 4.3 Bookings and money (`dbo`)

**Bookings** — API: booking, trips, payments R/W; every journey route authorises through it.
`Id GUID* PK` · `Number CHAR(8)* UQ` (letters/digits, as `normalizeBookingNumber`) · `Kind {direct|agent}*` · `AgentName STR(80)?` · `BookerUserId GUID* FK→Users` · `SailingId FK→ref.Sailings*` · `CategoryId FK→ref.CabinCategories*` · `CabinNumber STR(8)?` (null = guaranteed) · `FareId FK→ref.Fares*` · `Status {confirmed|cancelled}*` · `Dining {anytime|early|late}*` · `Occasion {none|birthday|anniversary|honeymoon|other}*` · `TotalCents BIG*` · `DepositCents BIG*` · `FinalDueDate DATE*` · `FinalPaymentDays INT*` (90, or 10 for late bookers) · `LoyaltyNumber STR(9)?` · `DiscountCents BIG*` · `CreditUsedCents BIG*` · `DraftId STR(40)? UQ` · `ContactEmail/ContactPhone` (copy at booking) · `ConfirmedAt TS*` · `CancelledAt TS?` · `CancelFeeCents BIG?` · `CancelRefundCents BIG?` · `RowVersion`.
Checks: `DepositCents <= TotalCents`; cancelled ⇒ `CancelledAt NOT NULL`. Indexes: `UX_Bookings_Number`, `IX_Bookings_BookerUserId`, `IX_Bookings_SailingId`.
`paid`, `balance` and `payment` state are **computed** from `Payments`, never stored.

**BookingGuests** — membership table for authorisation.
`BookingId GUID* FK→Bookings` · `UserId GUID* FK→Users` · `Seq INT*` (1-based, boarding order) · `IsLead BIT*` · `Printed STR(80)*` (`WHITFIELD/GERALD`) · PK (`BookingId, UserId`). Unique (`BookingId, Seq`). A **linked agent booking** gets its guests as `Users` rows with `IsSupervised`/no-login flag only if they have accounts; otherwise guests are stored only in `BookingGuestDetails`.

**BookingGuestDetails** — the per-guest answers captured in the funnel (the `GuestDraft` of a confirmed booking), for people with no account yet.
`BookingId` · `Seq` · `UserId GUID?` · `FirstName/LastName` · `Dob DATE` · `Gender {F|M|X}` · `Citizenship {us|other}` · `DietaryStatus {none|some}` · `AllergyNote STR(300)` · PK (`BookingId, Seq`). Needs/dietary codes in `BookingGuestTags` (`BookingId, Seq, Kind, Code`).

**BookingDrafts** — booking.draft R/W.
`Id STR(40)* PK` (random, unguessable — resume link) · `UserId GUID* FK→Users` · `SailingId?` · `CategoryId?` · `Guests INT*` · `CabinMode {guaranteed|pick}*` · `CabinNumber?` · `FareId?` · `Dining?` · `Occasion*` · `LoyaltyNumber?` · `UseCredit BIT*` · `Accepted [json]` · `People [json]` (array of `GuestDraft`) · `Contact [json]` · `Step STR(10)?` · `UpdatedAt` · `RowVersion`. One live draft per user: unique (`UserId`). Pricing quote is recomputed, never stored.

**QuoteLocks** — price held 24 hours. `DraftId FK` · `LockedUntil TS` · `TotalCents BIG` · `QuoteJson [json]`. Used for the `priceChanged` check.

**Payments** (receipts and ledger) — payments R, booking R/W, plan/packages/tours/upgrades W.
`Id GUID* PK` · `BookingId GUID* FK→Bookings` · `UserId GUID* FK→Users` (who paid) · `Label {deposit|full|balance|refund|tour|purchase|photo|upgrade|checkin}*` · `AmountCents BIG*` (negative = refund) · `At TS*` · `Reference STR(40)*` · `Status {captured|declined|refunded}*` · `RelatedType STR(20)?` · `RelatedId GUID?`. Index `IX_Payments_BookingId_At`.
**PaymentParts** — one per method: `PaymentId FK` · `Seq INT` · `Method {card|wallet}` · `CardId GUID? FK→SavedCards` · `CardBrand/Last4` (snapshot) · `Cents BIG` · `ChallengeUsed BIT`. (`checkParts`: ≤ 2 parts, sums exactly.)
**IdempotencyKeys** — `Key STR(80)* PK` · `UserId` · `Route STR(80)` · `ResponseHash` · `CreatedAt`. Used for `book`, `checkout`, `buy`, `payBalance`.

**Acceptances** — `BookingId FK` · `LegalId` · `Version` · `At TS` · PK (`BookingId, LegalId`).
**NotificationsSent** — `BookingId FK` · `Via {email|sms}` · `ToMasked STR(80)` · `At` (the `notified` list on `BookingView`).
**ResumeLinks** — `DraftId FK` · `Via` · `ToMasked` · `LinkToken CHAR(32) UQ` · `SentAt` · `ExpiresAt`.
**PastTrips** — `Id STR(40) PK` · `UserId GUID FK→Users` (booker) · `Title` · `Ship` · `Departure DATE` · `Nights INT` · `Cancelled BIT` · `FareCents BIG?`. Real prior bookings are *not* back-filled into `Bookings` (history only), per the UI's `PastTrip` shape. Plus `PastTripDocs` (`PastTripId`, `Doc {fareReceipt|folioStatement|gratuityStatement|taxSummary}`, `Ready BIT`).
**Loyalty** — `UserId GUID PK FK→Users` · `Number CHAR(9)* UQ` · `Tier` (duplicates `Users.Tier`; **kept only on `Users`** — this table holds `Number`, `DaysCounted INT`, `ReferralCode STR(12)`, `ReferralCreditCents BIG`).
**FutureCruiseCredits** — `Id GUID PK` · `UserId FK` · `OriginalCents BIG` · `RemainingCents BIG` · `ExpiresOn DATE` · `Source STR(40)` · Check `RemainingCents BETWEEN 0 AND OriginalCents`.
**Referrals** — `Id GUID` · `UserId FK` (referrer) · `FriendName` · `State {invited|booked|sailed}`.
**LinkedBookings** — `UserId FK` · `BookingId FK` · `LinkedAt` · PK (`UserId, BookingId`) — the agent booking linking (`trips.link`); a linked booking adds a `BookingGuests` row for the linker.

### 4.4 Documents

**GuestDocuments** — documents R/W (`documents.get`, `set`).
`UserId GUID* FK→Users` · `Doc {passport|birthCertificate|photoId|insurance}*` · `Expires DATE?` · `UpdatedAt` · PK (`UserId, Doc`). Check: `Expires` null unless the doc type has an expiry. Document **numbers are never stored** (only last four in check-in).

### 4.5 Pre-cruise (`dbo`)

**TourBookings** — plan.excursions R/W. `Id GUID PK` · `BookingId FK` · `ExcursionId FK` · `Day INT` · `TotalCents BIG` · `CreditCents BIG` · `Status {booked|cancelled}` · `CancelFeeCents BIG?` · `CancelRefundCents BIG?` · `PaymentId GUID? FK→Payments` · `At`. **TourBookingGuests**: (`TourBookingId`, `UserId`). Index on (`ExcursionId`, `Day`) to count spots.
**TourCartLines** — `BookingId` · `ExcursionId` · `Guests [csv user ids]` → normalised as **TourCartGuests** (`BookingId, ExcursionId, UserId`) · PK (`BookingId, ExcursionId`). Cart is server-side so it survives devices.
**LastMinuteTours** — on-board booking of tours leaving soon: modelled as `TourBookings` with `Source {pre|onboard}`; add column `Source` to `TourBookings`; charged to `FolioLines`.
**DiningReservations** — plan.dining R/W + waits. `Id GUID PK` · `BookingId FK` · `VenueId FK` · `Day INT` · `TimeLocal TIME` · `Note STR(300)` · `ChargeCents BIG` · `LateMinutes INT` · `ReminderOn DATE` · `Status {booked|cancelled|moved}` · `RowVersion`. **DiningReservationGuests** (`ReservationId`, `UserId`, `Covered BIT`). Unique filtered (`VenueId, Day, TimeLocal, UserId`) enforced in code via the guests table to catch double booking (`clash`). **GroupTableFriends** (`ReservationId`, `Seq`, `Name`, `Cabin`) plus `GroupSplit {mine|even}` on the reservation (aboard.groups).
**Waitlists** — `Id GUID` · `BookingId` · `VenueId` · `Day` · `TimeLocal` · `Stage {waiting|offered|expired|booked}` · `Position INT` · `OfferAt TS?` · `ExpiresAt TS?` · `Auto BIT`; **WaitlistGuests**. **Queues** — walk-in virtual queue: `Id` · `BookingId` · `VenueId` · `JoinedAt` · `Stage {waiting|ready|expired|left}` · `Position` · `ReadyAt` · `ExpiresAt`.
**Purchases** — plan.packages R/W. `Id GUID PK` · `BookingId FK` · `Kind {addOn|upgrade}` · `ItemId STR(20)` · `Units INT` · `UnitCents BIG` · `TotalCents BIG` · `Status {active|cancelled}` · `CreditedCents BIG` · `PaymentId?` · `At`. **PurchaseGuests** (`PurchaseId`, `UserId`). Price state (locked/dropped/same) is computed against `ref.AddOns`/`PackageUpgrades` and the clock.
**ChecklistTicks** / **PackingTicks** / **PrepTicks** / **ReadyTicks** / **NightTicks** — all `BookingId FK` (or `UserId` for per-person) · `ItemId STR(40)` · `Done BIT` · `At` · PK (`BookingId, ItemId`) — one generic table is **not** used, to keep each group's FK/PK obvious; they share a column shape. `ReadyTicks` also has `Day INT` (today's port-day readiness list resets daily).
**TravelPlans** — `BookingId PK FK` · `ArrivalMode STR(20)` · `ArrivalDate DATE` · `ArrivalWindowId?` · `FlightNo STR(12)?` · `Details [json]` · `UpdatedAt`.
**AssistanceRequests** — plan.assistance. `Id GUID` · `BookingId` · `GuestUserId FK` · `Kind STR(20)` (`AssistId`) · `Note STR(500)` · `Status {received|confirmed|declined|cancelled}` · `At`.

### 4.6 Ahead (`dbo`)

**AdvisorRequests** — `Id GUID` · `UserId` · `AdvisorId FK→ref.Advisors` · `Way {callback|chat}` · `Phone STR(30)?` · `Question STR(1000)` · `Reply TXT?` · `CallbackBy TS?` · `At`.
**MarketingConsents** — `UserId FK` · `Channel {email|sms}` · `Contact STR(254)` · `Region {us|ca|uk|eu|au}` · `State {pending|confirmed|expired|withdrawn}` · `CodeHash BINARY(32)?` · `AskedAt` · `ConfirmedAt?` · `ExpiresAt?` · PK (`UserId, Channel`). Demo code is returned only for `IsDemo` users.
**UpgradeBids** — `Id GUID` · `BookingId` · `CategoryId FK` · `Cents BIG` · `Status {open|accepted|declined|withdrawn}` · `BuyNow BIT` · `DecidedAt?` · `At`. Unique filtered (`BookingId, CategoryId`) where status `open`.
**ClubRegistrations** — `ChildUserId FK` · `BookingId FK` · `ClubId` · `EmergencyName/Phone` · `Pickups [json]` · `Allergies STR(300)` · `Notes STR(500)` · `SignOutAlone BIT` · `Photos BIT` · `At` · PK (`ChildUserId, BookingId`).
**Medallions** — `BookingId PK` · `Stage {preparing|shipped|delivered|collect}` · `ActivatedAt?` · `LostAt?` · `TrackingNumber STR(30)` · `Address [json]`. **MedallionGuests**: `BookingId`, `UserId`, `Serial STR(16)`.
**BagTagOrders** — `BookingId PK` · `Way {print|etag|order}` · `OrderedAt` · `HandedOverAt?` · `Stage {none|atHome|handedOver|onShip|inCorridor|delivered}`.
**FixCases** — `Id GUID` · `UserId` · `Flow STR(20)` · `Note STR(500)` · `Stage` · `Reference STR(16)` · `ContactBy TS` · `At`.
**AssistCases** — `Id GUID` · `UserId` · `BookingId?` · `Kind {assistedBooking|bereavement|medical}` · `Phone` · `Note` · `Stage {received|reviewing|decided}` · `Reference` · `FeeCents/RefundCents/CreditCents BIG?` · `Choice {refund|credit}?` · `At`.

### 4.7 Check-in and boarding

**CheckinGuests** — checkin R/W. `BookingId FK` · `UserId FK` · `Step {confirm|document|photo|emergency|contract|health}` · `DoneAt TS` · `Data [json]` (per-step payload: document kind/country/last4/expires; photo `at` only — **the photo is never kept**; emergency; contract version + by; health answers + flagged) · PK (`BookingId, UserId, Step`) · `RowVersion`.
**CheckinBooking** — `BookingId PK` · `PaymentCardId GUID?` · `PaymentLabel STR(60)?` · `PaymentAt TS?` · `ArrivalWindowId STR(20)?` · `ArrivalAt TS?` · `FinishedAt TS?` (set by `checkin.submit`).
**BoardingPasses** — derived, but stored for stable QR: `BookingId` · `UserId` · `Seq INT` · `Code STR(200)` (signed payload `PassData v1`) · `InWallet BIT` · `IssuedAt` · PK (`BookingId, UserId`). Signing key from secrets; code re-verifiable.
**EmbarkProgress** — `BookingId PK` · `LuggageStatus {notDropped|dropped|delivered}` · `LuggageDroppedAt?` · `Terminal STR(60)` (override for the `terminalChange` scenario lives in `ref`/scenario data, not here).
**EmbarkTicks** — `BookingId` · `Kind {companion|carryOn}` · `ItemId STR(30)` · `Done BIT` · PK (`BookingId, Kind, ItemId`).
**MusterConfirmations** — `BookingId` · `UserId` · `ConfirmedAt TS` · `ByUserId` · PK (`BookingId, UserId`).

### 4.8 On board

**PlanEvents** (my programme) — `UserId FK` · `SailingId` · `EventId` · `Day INT` · PK (`UserId, SailingId, EventId, Day`).
**ShowTickets** — `Id GUID` · `BookingId` · `EventId` · `Day` · `Status {on|moved|cancelled}` · `At`; **ShowTicketGuests**. Seats left = `ref.Events.Seats − Σ guests` (check inside a serialisable transaction for `soldOut`).
**Orders** — orders R/W. `Id GUID PK` · `BookingId FK` · `PlacedByUserId FK` · `Kind {delivery|room|breakfast}` · `PlacedAt TS` · `DeliverAt TS?` · `LocationKind {cabin|zone|other}` · `LocationRef STR(80)?` · `TipCents BIG` · `FeeCents BIG` · `ServiceCents BIG` · `TotalCents BIG` · `CoveredCents BIG` · `RefundCents BIG` · `Stage {scheduled|received|preparing|needsChoice|onTheWay|delivered|cancelled}` · `EtaAt TS?` · `Contacted INT` · `RowVersion`. Stage is *derived on read* from timestamps and the clock (`orders.ts progress`), with the stored value updated lazily and by cancel/resolve.
**OrderLines** — `OrderId FK` · `Seq INT` · `ItemId FK→ref.MenuItems` · `Qty INT` · `GuestUserId FK` · `Extras [csv]` · `Note STR(200)?` · `UnitCents BIG` · `Choice {substitute|remove}?` · `Unavailable BIT`.
**ChatMessages** (travel-party chat, `messages`) — `Id GUID` · `BookingGroupKey` (see below) · `FromUserId FK` · `Text STR(2000)` · `Photo TXT?` (data URL; capped by `ChatSafeApi.sendPhoto` rules) · `At`. **ChatReads** — `MessageId` · `UserId` · `SeenAt` (written only when both sides have receipts on). `ReadReceipts BIT` is on `Users`… stored as `UserPrefs.ReceiptsOn` (see `UserPrefs`).
*Chat scope:* the chat is "your group", not "your booking" (friends in separate cabins share it). Table **ChatGroups** (`Id GUID`, `Name`) + **ChatGroupMembers** (`GroupId`, `UserId`); messages reference `GroupId`. Seeded groups follow `visibleTo()` (Harper and Brennan families; solos have none).
**ChatBlocks** — `UserId` · `BlockedUserId` · PK pair. **ChatReports** — `Id` · `MessageId` · `ByUserId` · `Reason` · `At`.
**UserPrefs** — `UserId PK` · `ReceiptsOn BIT` · `Json [json]` (small client preferences that must follow the user: text size lives on `Users`). Kept deliberately thin.
**ServiceThreads** — `Id GUID` · `BookingId` · `Channel STR(20)` (`ChannelId`) · `State STR(20)?` · `EscalatedPhone STR(30)?` · `EscalatedAt?`. **ServiceMessages** — `Id GUID` · `ThreadId` · `FromRole {me|crew}` · `CrewName STR(60)?` · `Text STR(2000)` · `At`. Crew replies are generated by the server's mocked responder (section 8).
**FamilyZones** — `ChildUserId` · `BookingId` · `ZoneIds [json array]` · `Auth [json]` (`pickup` ids, `signOutAlone`, `photos`) · PK pair. **KidClubCheckins** — `Id` · `ChildUserId` · `ClubId` · `InAt` · `OutAt?` · `ByUserId` · `OutByUserId?`. **KidSightings** — `ChildUserId` · `PlaceId` · `Source {club|band}` · `At` (latest, drives `kidStatus`). **FamilyLog** — `Id` · `BookingId` · `At` · `Text`. **ReunionPlans** — `BookingId PK` · `PlaceId` · `BackupId` · `Note`.
**HealthReports** — `Id GUID` · `BookingId` · `ByUserId` · `Symptoms [json array]` · `StartedHoursAgo INT` · `At`; **HealthReportGuests**. **HealthRequests** — `Id` · `BookingId` · `Kind` · `Note` · `At`. Isolation is computed from reports and the `illness` scenario.
**RoomSettings** — `BookingId PK` · `Housekeeping [json]` · `Devices [json]` · `DndSince TS?` · `RowVersion`.
**PhotoSelections** — `UserId` · `PhotoId FK` · PK pair (favourites). **PhotoPurchases** — `Id GUID` · `BookingId` · `Option` · `PaidCents` · `SavedCents` · `Verified BIT` · `Until TS` · `At`; **PhotoPurchaseItems** (`PurchaseId`, `PhotoId`, `Downloaded BIT`).
**LaundryRequests** — `Id` · `BookingId` · `Service` · `Qty` · `PickupAt` · `ReturnAt` · `Stage` · `TotalCents` · `FreeCents` · `Note`.
**WifiDevices** — `Id` · `BookingId` · `Name STR(60)` · `Plan` · `Days INT` · `ExpiresAt` · `UsedMb BIG`.
**Budgets** — `BookingId PK` · `Json [json]` (the `Budget`: overall and per-child limits) · `RowVersion`.
**UpdateAcks** — `UserId` · `ScenarioId` · `Option STR(30)` · `At` · PK pair.
**ServiceRequests** (`aboard.requests`) — `Id` · `BookingId` · `ItemId` · `Qty` · `Note` · `PlacedAt` · `EtaAt` · `Stage {received|onTheWay|done|cancelled}`.
**SafetyReports** (`aboard.reports`) — `Id` · `BookingId` · `Kind` · `Place` · `Note` · `Anonymous BIT` · `Reference` · `At`.
**DrinkLogs** — `Id` · `UserId` · `DrinkId FK` · `At`. **TopUps** — `Id` · `BookingId` · `Dollars INT` · `Source {card|cash}` · `At` · `SettledAt?` · `Reference`. **OnboardAccount** — `BookingId PK` · `PinHash BINARY(32)?` · `PinSalt` · `PinFails INT` · `GratuityChoice {standard|prepaid|removal}` · `GratuityReason STR(300)?` · `GratuityPaidAt?` · `DisplayCurrency CHAR(3)`.
**Parties** — `Id` · `BookingId` · `Title` · `Day` · `TimeLocal`; **PartyInvites** (`PartyId`, `Cabin`, `Answer {yes|maybe|no}`).
**GameProgress** — `UserId PK` · `State [json]`. **TvState** — `BookingId PK` · `State [json]`.
**Selections** (`aboard.selections`, bookable on-board items like spa) — `Id` · `BookingId` · `ItemId` · `Day` · `Time` · `Qty` · `TotalCents`.
**FolioLines** — folio R. `Id GUID` · `BookingId` · `UserId?` · `Day INT` · `Category` · `Description` · `Cents BIG` (negative = credit) · `CoveredBy {package|fare|credit}?` · `SourceType STR(20)` · `SourceId GUID?` · `At`. **Every on-board charge** (orders, laundry, tours, spa selections, photos, Wi-Fi, drinks beyond cap, top-ups, gratuities) writes a `FolioLines` row in the same transaction. Totals are computed.
**Feedback** (in-app product feedback, `aboard.feedback`) — `Id` · `UserId` · `Kind {bug|idea|praise}` · `Text STR(1000)` · `Log [json array]` · `Screenshot TXT?` · `Reference` · `At`.

### 4.9 After the cruise

**DisembarkChoices** — `BookingId PK` · `Option {tagged|selfAssist|earlyWalkOff}` · `TagsOn BIT` · `DecidedAt`; **DisembarkBags** (`BookingId`, `UserId`, `Bags INT`).
**Customs** — `BookingId PK` · `Declaration [json]` (`food`, `cash`, `goodsUsd`, `note`) · `SubmittedAt`.
**OnwardPlans** — `BookingId PK` · `Mode` · `FlightAtLocal TIME?` · `Flight STR(12)` · `Note`.
**FinalBill** — `BookingId PK` · `TipKeepPercent INT` · `EmailedAt?` · `EmailedTo STR(254)?` · `SettledAt?`. Plus `BillQueries` are `Cases` with `Kind=billing` and `LineId`.
**Cases** — `Id GUID` · `UserId` · `BookingId` · `Kind {lostItem|billing|claim|complaint|recovery}` · `Number STR(12) UQ` · `Summary` · `Place` · `Cents BIG` · `LineId STR(40)?` · `Stage {received|inReview|resolved|withdrawn}` · `Outcome STR(20)?` · `OpenedAt` · `DueAt` · `WithdrawnAt?` · `RefundCents BIG?` · `RefundSentAt?` · `FromFeedback BIT`.
**PostFeedback** — `BookingId PK` · `Json [json]` (the `Feedback` object: area scores, crew mentions, comment) · `SubmittedAt` · `EditUntil`.
**RebookHolds** — `Id GUID` · `UserId` · `BookingId` · `SailingId FK` · `CategoryId` · `Guests INT` · `TotalCents` · `DepositCents` · `CreditCents` · `FccAppliedCents` · `Onboard BIT` · `PlacedAt` · `ExpiresAt`. `FccConversions` handled by updating `FutureCruiseCredits`.
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
| `auth.me` | `GET /me` | U |
| *(new)* view-as | `POST /me/view-as/{userId}` | Booker |
| `account.party` | `GET /bookings/{n}/party` | B |
| `account.profile(id)` | `GET /users/{id}/profile` | B same booking |
| `account.saveProfile` | `PUT /users/{id}/profile` | BA; rules: name change, `forbidden` for child |
| `account.helper` / `saveHelper` / `revokeHelper` | `GET/PUT/DELETE /me/helper` | U |
| `account.history` | `GET /me/history` | U |
| `trips.list` | `GET /trips` | U |
| `trips.get` | `GET /trips/{n}` | B |
| `trips.link` | `POST /trips/link` {number,lastName,departure} | U (rate-limited) |
| `payments.get` | `GET /bookings/{n}/payments` | B |
| `payments.addCard` / `removeCard` | `POST/DELETE /me/cards[/{id}]` | BA |
| `payments.payBalance(cardId)` | `POST /bookings/{n}/payments/balance` | BA (+helper `payments`) |
| `documents.get` | `GET /bookings/{n}/documents` | B |
| `documents.set` | `PUT /users/{id}/documents/{doc}` / `DELETE` | BA (+helper `documents`) |
| `notifications.list/markRead/savePrefs` | `GET /me/notifications`, `POST /me/notifications/read`, `PUT /me/notification-prefs` | U |
| `support.tickets/callback/email` | `GET/POST /me/support-tickets` | U |
| `help.contacts` | `GET /help/contacts` | P |
| `privacy.view/setConsent` | `GET /bookings/{n}/privacy`, `PUT /users/{id}/consents/{id}` | B / BA (parent for child) |
| `budget.get/save` | `GET/PUT /bookings/{n}/budget` | B / BA |
| `bookings.get` / `bookings.sailings` | `GET /bookings/{n}` (core), `GET /sailings` | B / P |
| `aboard.feedback.list/send` | `GET/POST /me/feedback` | U |
| `ahead.saved.list/toggle`, `discover.favourites/toggleFavourite` | `GET /me/favourites`, `POST /me/favourites/toggle` | U |

### 6.2 Discover and booking (Phase 7)
| Api method | Verb route | Auth |
| --- | --- | --- |
| `discover.offers` | `GET /sailings/offers` | P |
| `discover.quote` | `GET /sailings/{id}/quote?category=&guests=` | P |
| `booking.dates` | `GET /sailings/bookable` | P |
| `booking.rooms` | `GET /sailings/{id}/rooms` | P |
| `booking.cabins` | `GET /sailings/{id}/cabins?category=` | P |
| `booking.fares` | `POST /booking/fares` {draft} | U |
| `booking.quote` | `POST /booking/quote` {draft} | U |
| `booking.prefill` | `GET /me/booking-prefill` | U |
| `booking.draft/saveDraft/discardDraft` | `GET/PUT/DELETE /me/draft` | U |
| `booking.sendResumeLink` | `POST /me/draft/resume-link` | U |
| `booking.book` | `POST /bookings` {draft, expectedTotal, option, parts, challenge} + `Idempotency-Key` | U |
| `booking.get` | `GET /bookings/{n}/detail` | B |
| `booking.payBalance` | `POST /bookings/{n}/pay-balance` | BA |
| `booking.changePreview` / `change` | `GET/POST /bookings/{n}/change?sailingId=` | Booker |
| `booking.cancel` | `POST /bookings/{n}/cancel` | Booker |

### 6.3 Pre-cruise (Phase 8)
| Api method | Route | Auth |
| --- | --- | --- |
| `plan.overview` | `GET /plan` | B |
| `plan.excursions.list/addToCart/removeFromCart/checkout/changeGuests/cancel` | `GET /excursions`, `PUT/DELETE /excursions/cart/{id}`, `POST /excursions/checkout`, `PUT/DELETE /excursions/bookings/{id}` | B read, BA write |
| `plan.dining.view/slots/reserve/cancel/move/late` | `GET /dining`, `GET /dining/slots?venue=&day=`, `POST /dining/reservations`, `DELETE /dining/reservations/{id}`, `POST …/{id}/move`, `POST …/{id}/late` | B read, BA write |
| `plan.packages.view/buy/claimDrop/cancel` | `GET /packages`, `POST /packages/purchases`, `POST …/{id}/claim-drop`, `DELETE …/{id}` | B / BA |
| `plan.checklist.get/tick`, `plan.packing.get/tick` | `GET/PUT /checklist[/{id}]`, `GET/PUT /packing[/{id}]` | B / BA |
| `plan.travel.get/save` | `GET/PUT /travel` | B / BA |
| `plan.assistance.get/request/cancel` | `GET/POST/DELETE /assistance[/{id}]` | B / BA |
| `waits.list/joinQueue/leaveQueue/joinWaitlist/leaveWaitlist/acceptWaitlist` | `GET /waits`, `POST/DELETE /waits/queue[/{id}]`, `POST/DELETE /waits/waitlist[/{id}]`, `POST /waits/waitlist/{id}/accept` | B / BA |
| `shows.day/mine/reserve/cancel` | `GET /shows?day=`, `GET /shows/tickets`, `POST /shows/tickets`, `DELETE /shows/tickets/{id}` | B / BA |
| `dining.list/reschedule` (legacy `Item[]`), `queues.list` | **dropped**: superseded by `plan.dining` and `waits` — see section 9, Q3 | – |
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

### 6.4 Check-in and boarding (Phase 9)
| Api method | Route | Auth |
| --- | --- | --- |
| `checkin.status/view/receipt` | `GET /checkin`, `GET /checkin/status`, `GET /checkin/receipt` | B |
| `checkin.save` | `PUT /checkin/steps/{step}` | BA; `forbidden` for supervised; `conflict notOpen/closed` |
| `checkin.submit` | `POST /checkin/submit` | BA |
| `boarding.pass/addToWallet` | `GET /boarding`, `POST /boarding/wallet` | B |
| `boarding.lookup` | `GET /pass/lookup?number=&lastName=` | **P**, rate-limited, uniform `notFound` |
| `boarding.embark/setCompanion/setCarryOn/setBags` | `GET /embark`, `PUT /embark/companion/{id}`, `PUT /embark/carry-on/{id}`, `PUT /embark/bags` | B / BA |

### 6.5 On board (Phase 10)
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
| `requests.list/create` (legacy) and `aboard.requests.list/create/cancel` | `GET/POST/DELETE /requests[/{id}]` | B / BA |
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

### 6.6 After the cruise (Phase 11)
| Api method | Route | Auth |
| --- | --- | --- |
| `disembark.view/choose/setTagsOn/customs/saveCustoms/onward/saveOnward/night/tick/finalBill/adjustTip/emailReceipt` | `GET /disembark`, `PUT /disembark/choice`, `PUT /disembark/tags`, `GET/PUT /disembark/customs`, `GET/PUT /disembark/onward`, `GET /disembark/night`, `PUT /disembark/night/{id}`, `GET /disembark/final-bill`, `PUT …/tip`, `POST …/email` | B / BA |
| `cases.list/open/withdraw` | `GET/POST /cases`, `DELETE /cases/{id}` | B / BA |
| `post.history/feedback/saveFeedback/loyalty/rebook/hold/releaseHold/convertFcc/bookSlot/cancelSlot` | `GET /history`, `GET/PUT /post-feedback`, `GET /me/loyalty-summary`, `GET /rebook`, `POST /rebook/holds`, `DELETE …/{id}`, `POST /rebook/convert-fcc`, `POST/DELETE /rebook/appointment` | B / BA |

### 6.7 Demo endpoints (not in the `Api` interface)
`GET/PUT /demo/state` (clock offset, speed, scenarios; 404 unless `IsDemo`), `POST /demo/jump {stage}` (sets the clock for every user on the booking), `POST /demo/reset` (re-run persona reset for the caller's booking). Staff/admin or `IsDemo` only.

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
| AI concierge | Stays client-side mock behind its own interface (not in the REST API). |
| Weather, ship telemetry | `IWeatherService`, `IShipTelemetry` mocked in C#; `onboard.today.weather` calls them. |
| Payment charge, 3-D Secure challenge, declined card | `IPaymentGateway` (D15 / plan Phase 7): `0002` last four declines; new card or ≥ $3,000 needs `challenge = 123456`. |
| Photo download failure | `photoFail` scenario: first `download` per receipt after activation returns `network` — implemented client-side (fault rule), server just records progress. |
| Retention deletion | Scheduled job + `RetentionRuns`; `privacy.view` also triggers a lazy check as the mock does. |
| Stage progress of orders/laundry/requests/medallion/cases | Computed from stored timestamps and the clock on read (as the TS functions do); no background worker needed. |
| Demo code for marketing consent | Returned only when `Users.IsDemo`. |

## 9. Questions for you (answers change the schema)

1. **Chat scope (4.8).** I modelled chat as `ChatGroups`/`ChatGroupMembers` because friends in separate cabins share a chat. Is that right, or is chat always the single booking? (Group costs one extra table.)
2. **Linked agent bookings (4.3).** Agent bookings today are fixtures with only a guest count. I assume linking creates the guest rows as `BookingGuestDetails` without user accounts, and the linker sees them as read-only-ish. OK?
3. **Legacy groups.** `dining.list/reschedule`, `queues.list` and `requests.list/create` look superseded by `plan.dining`, `waits` and `aboard.requests`. I propose **dropping** them (and their mocks) in the frontend phases. OK, or do screens still use them?
4. **Reference content location.** FAQs, help topics, safety text and menus are authored copy. I propose the database holds the English text and UI chrome stays in `src/i18n`. Alternatively, keep all long copy in the frontend and have the database hold only ids and numbers (smaller seeds). Which?
5. **Photos in chat.** `Messages.photo` is a data URL today. Storing up to a few hundred KB per message in SQL Server is fine for a demo; a blob store is the real answer. Keep it in the table for now?
6. **Hash cost.** 600,000 PBKDF2 iterations makes each login about 200 to 300 ms of CPU. Fine for this project; say if you would rather use Argon2 via a package.
