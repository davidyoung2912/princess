# Database scripts

SQL Server (T-SQL). The scripts are plain `.sql` files that you run by hand; there are no migrations. Design source: `docs/backend-data-model.md`. Plan: `docs/backend-plan.md`.

## Run order

| Order | File | What it does |
| --- | --- | --- |
| 0 (optional) | `00-drop-all.sql` | Test databases only. Drops every table the schema creates, plus the `ref` and `demo` schemas. |
| 1 | `01-schema.sql` | Creates the `ref`, `dbo` and `demo` schemas and all 157 tables, keys, indexes, checks and defaults. Re-runnable: a table that exists is left alone. |
| 2 | `seed/reference/run-all.sql` | Phase 3. Reference data for all 38 `ref` tables (ship, ports, sailings, venues, excursions, fares, legal text and so on), nine files, run in order. |
| 3 | `seed/personas/run-all.sql` | Phase 4. Resets then loads 34 demo people, 22 bookings and their journey data, in partial-completion states. Catalogue in `seed/personas/README.md`. |

Create an empty database first, then run the scripts inside it:

```
sqlcmd -S <server> -d <database> -b -i db/01-schema.sql
```

`-b` stops at the first error. In SSMS or Azure Data Studio, open the file with the database selected and run it. The script sets `QUOTED_IDENTIFIER ON`, which filtered indexes need.

To start again on a test database (or just run `reset-db.ps1`, below, which does all of it):

```
sqlcmd -S <server> -d <database> -b -i db/00-drop-all.sql
sqlcmd -S <server> -d <database> -b -i db/01-schema.sql
```

Re-running `01-schema.sql` never alters an existing table. A schema change after the first run is a new numbered script, or a drop and re-create on a test database.

## Full reset in one command (`reset-db.ps1`)

For a clean database ready for re-testing, run from PowerShell (the database itself must already exist):

```
./db/reset-db.ps1
```

It runs, in order, stopping at the first error: `00-drop-all.sql`, `01-schema.sql`, `seed/reference/run-all.sql`, then the four `seed/personas/*.sql` files in name order. It needs `sqlcmd` on the PATH and trusts the server certificate, like the connection string in use.

| Option | Default | Meaning |
| --- | --- | --- |
| `-Server` | `localhost` | SQL Server instance, for example `(localdb)\MSSQLLocalDB`. |
| `-Database` | `princess` | Target database. |
| `-User`, `-Password` | none | SQL login. Without them it uses Windows authentication. |
| `-SkipDrop` | off | Skip the drop step, for a new empty database. |

It asks no question: it destroys all data in the Princess tables as soon as it runs, so use it on test databases only. It stores no connection string and writes nothing to disk.

## Reference seeds (`seed/reference`)

```
sqlcmd -S <server> -d <database> -b -i db/seed/reference/run-all.sql
```

Run it from the repository root (the paths inside are relative to it), after `01-schema.sql`. Or run the nine numbered files one at a time. They are plain ASCII, so no code page option is needed.

- **Generated, not written.** `npm run db:seed:gen` builds the files from the TypeScript fixtures in `src/` (`scripts/reference-seed.ts` says which source feeds which table). To change reference data, change the source and regenerate; do not edit the SQL.
- **Idempotent.** Each table is one `MERGE` on its key. Re-running updates rows in place and adds missing ones; it never deletes, so a row removed from the source stays in the database until you drop it by hand.
- **`npm run db:seed:check`** proves the files on disk match the source, that every `ref` table is seeded, every column exists, text fits, closed lists hold, JSON parses, and every foreign key between `ref` tables points at a seeded row. It does not replace running them.

### What the seeds decide

These are the places where the TypeScript and the schema did not line up one for one. Overrule any of them.

- **Schema additions.** To hold data the API needs, `01-schema.sql` gained columns: `MenuItems` (`Alcohol`, `Packaged`, `OnMenus`, `SubstituteId`), `Events` (`ExtraCents`, `AfterAllAboard`), `Excursions` (`Rating` in tenths, `Reviews`), `AddOns` and `PackageUpgrades` (`ChangeAtDays`, `ChangeShare` in basis points; `AddOns` also `MinAge`). A block after the `ref` tables adds them to a database created by the earlier script, so re-running `01-schema.sql` is enough.
- **Relative price changes.** The source moves a price a number of days before sailing; `ChangeOn` is a date. `ChangeOn` and `ChangesToCents` are worked out for the reference sailing (21 Mar 2027); the API should use `ChangeAtDays` and `ChangeShare` for any sailing.
- **`PackageUpgrades`** is keyed by the target, so it holds the price from "no package". Plus to Premier is the difference, worked out in code.
- **Sailings** all use the same seven-night itinerary; the two ship clock changes (days 4 and 7, 02:00) carry the real hour change for each sailing's date.
- **`ref.Ports`** has a row `sea` ("At sea") because itinerary days point at it.
- **Cabins** are the 54 sample staterooms (9 per type), the same on every sailing; which are free is the API's job. `Connecting` is false, and the muster station is the one beside the cabin's elevator bank (forward/midship/aft, port/starboard = stations A to F).
- **Decks** are every deck that has a place or a stateroom (4 to 18), with the places on it as the summary. The deck plan places themselves have no table.
- **Cabin categories:** `SizeSqFt` is the first number in the size text, and 0 where the text gives none (mini-suites). The text, the category code, the view and the fare ratio are in `Features`.
- **Venues** merge the reservation list (`dining.ts`) and the directory (`menus.ts`). `Capacity` is 4 (tables per seating) for rooms that can be reserved and 0 for the rest: the source has no real capacity. `Hours` holds sea and port day hours; `OpenFrom`/`OpenTo` are the earliest and latest across them (24:00 is stored as 23:59:59).
- **Menu items** are the delivery and room-service menu plus the directory dishes (`Orderable` 0, price 0, ids `<venue>-<dish>`).
- **Excursions:** `Interest` is the first interest and `Tags` holds all of them plus `family` and `wheelchair`. `BackByLocal` is when the tour ends. Every sailing runs every tour at full `Capacity`; the "sold out" demo case (Roatan zip-line on the reference sailing) is left to the persona seeds.
- **Events:** `Kind` is the event's interest, `Ticketed` means `ExtraCents > 0`, and `StatusOverride` is empty (the plan-change scenario applies in code).
- **Legal documents:** the version `2026-10` is stored as the number `202610`.
- **Entitlements:** `LaundryBags` is 1 where the tier has the free-laundry perk. `PhotoIncluded` is true for the Premier package.
- **Photos:** `PhotoCatalogue` is the eight photo spots (`Place` is the kind of spot); `Thumb` is empty because the source has no image files. `PhotoOptions.Count` 0 means every photo.
- **Content:** `Faqs` drop their "link" (the screen decides where to link); `HelpTopics` holds the muster drill text in five languages; `ContentBlocks` holds the ship profile text, the port guides (body is JSON), and the port facts, transport modes and hotels for getting to the terminal.
- **Checklists:** labels are the English text from `src/i18n`. `Auto`/link/timing of checklist and last-night items stay in code.
- **Not seeded** because the schema has no table for them: the deck plan places, dish prices, the drinks-package break-even figures and the weather table.

## Checking the script without a server

`npm run db:check` compares `01-schema.sql` with the data model document. It fails if a table is missing or extra, if a table is created before one it references, if a foreign key column is missing or has a different type from the column it points at, if two constraints share a name in a schema, or if a table lacks a primary key or a `PublicId`. It does not replace running the script. If SQL Server rejects anything, send me the message and I will fix it.

## Layout

| Schema | Holds | Written by |
| --- | --- | --- |
| `ref` | Reference data, string ids from the TypeScript source (38 tables). | Reference seeds only. |
| `dbo` | Everything a user owns (118 tables). | The API, and the persona seeds. |
| `demo` | `DemoState`: the per-user clock offset and active scenarios. | The API, and the persona seeds. |

Every `dbo` table has `CreatedAt`; mutable ones also have `UpdatedAt`, which the API sets. Tables with a `RowVersion` column are the optimistic-concurrency ones (data model D11). Every `dbo` table with a `BIGINT IDENTITY` key and an API route has a `PublicId` guid, and that is the only id the API shows.

## Deleting a user or a booking

Foreign keys that identify the owner (`UserId`, `BookingId`, a parent row) cascade. Columns that only say who did something (`ByUserId`, `PlacedByUserId`, `FromUserId`, `Payments.UserId`, `Bookings.BookerUserId` and so on) do not, because SQL Server rejects a table that a delete can reach by two cascade paths. So the retention job deletes in this order:

1. The booking, which removes its payments, tours, orders, check-in, folio and the rest.
2. Then the user, which removes their profile, cards, notices, documents and so on.

Deleting a user first fails while they are still the booker of a booking or the author of a row on someone else's record. That is deliberate.

## Where the script goes beyond or departs from the document

The document is column-level for most tables and looser for some. These are the choices I made, so you can overrule them.

- **`CK_Users_Password`.** Section 4.1 reads `PasswordHash IS NOT NULL OR IsDemo = 0`, but its own comment says a non-demo adult must have a password. I implemented the comment: an adult needs a password unless they are a demo user (`IsSupervised = 1 OR IsDemo = 1 OR PasswordHash IS NOT NULL`). Persona seeds still get hashed passwords.
- **No foreign key** on `PaymentParts.CardId` and `CheckinBooking.PaymentCardId`, so removing a saved card never touches a receipt (brand and last four are snapshotted). Also none on `RetentionRuns.UserId` (the record must outlive the delete it describes), `Bookings.DraftId` (the draft is discarded after booking) and `Bookings.CabinNumber` (the ship comes from the sailing).
- **Per-person booking rows** (`CheckinGuests`, `BoardingPasses`, `MusterConfirmations`, `DisembarkBags`) reference `BookingGuests (BookingId, UserId)`, so the person must be on the booking.
- **Reference ids are open sets.** `ref` tables have no `CHECK` on their `Id` (a new port or venue is data). Closed unions in the TypeScript, such as `Kind` and `Stage`, are `CHECK` constraints. Where the document gives no list (`FixCases.Stage`, `LaundryRequests.Stage`, `ServiceThreads.State`) the column is free text.
- **Columns the document implied but did not list:** `Name` on `ref.Packages` and `ref.AddOns`; `ref.Entitlements` is keyed by (`SourceKind` `tier`/`package`, `SourceId`); `ref.PhotographerSlots` is keyed by (`Day`, `Place`, `StartLocal`); `TourCartLines` exists as the parent of `TourCartGuests`; `UX_ServiceThreads_BookingId_Channel` makes one thread per channel per booking; `KidSightings` keeps one row per child (the latest sighting).
- **Dining double-booking** stays a code rule (section 4.5); the script only indexes the lookup.
- **`ChatBlocks.BlockedUserId`** does not cascade (the other side of a pair can only have one cascade path).
- **`ref.DeskSlots`** is reference-like and generated, so it is in `ref` and `DeskAppointments` points at it.

## Persona seeds (`seed/personas`)

```
sqlcmd -S <server> -d <database> -b -i db/seed/personas/run-all.sql
```

Run from the repository root, after the schema and the reference seeds. `00-reset-personas.sql` goes first: it deletes every seeded person (found by `Slug`) and all they own, then `01-users`, `02-bookings` and `03-journey` insert. So `run-all.sql` is the re-runnable, "back to the starting state" script; the numbered files alone are not re-runnable. Reference data is never touched.

- **Generated.** `npm run db:persona:gen` builds the files and the catalogue from `scripts/persona-seed.ts`, using the same pricing, payment-plan, cabin and stage code as the app. `npm run db:persona:check` proves the files are current, ASCII, use real columns, fit their columns and closed lists, and have unique slugs, account numbers and booking numbers.
- **Passwords.** One shared demo password (in the catalogue), hashed per person as `pbkdf2$600000$salt$hash` (PBKDF2-HMAC-SHA512, data model D12) with a salt derived from the slug, so regenerating gives the same file. Supervised children have no password.
- **Clock.** `demo.DemoState.ClockOffsetSeconds` is computed in SQL at run time so that each person's "now" is the instant in the catalogue, whenever you run it.
- **Ids.** Rows an API route addresses have fixed `PublicId`s derived from a key, so test ids are stable between runs.
- **Reset limit.** The reset clears what the seeds create. If you have used the app since and created rows that name a seeded person as actor in tables the seeds do not touch, drop and reseed instead (`reset-db.ps1`).
- **Not seeded:** chat, orders, kids club, health, room, photos, laundry, Wi-Fi, budgets, games, TV, parties, medallions, bag tags, upgrade bids, club registrations, waitlists, queues and show tickets. They start empty.
