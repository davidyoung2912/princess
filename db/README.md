# Database scripts

SQL Server (T-SQL). The scripts are plain `.sql` files that you run by hand; there are no migrations. Design source: `docs/backend-data-model.md`. Plan: `docs/backend-plan.md`.

## Run order

| Order | File | What it does |
| --- | --- | --- |
| 0 (optional) | `00-drop-all.sql` | Test databases only. Drops every table the schema creates, plus the `ref` and `demo` schemas. Refuses to run without `-v ConfirmDrop=YES`. |
| 1 | `01-schema.sql` | Creates the `ref`, `dbo` and `demo` schemas and all 157 tables, keys, indexes, checks and defaults. Re-runnable: a table that exists is left alone. |
| 2 | `seed/reference/*` | Phase 3. Reference data (ship, ports, sailings, venues, excursions, fares, legal text and so on). |
| 3 | `seed/personas/*` | Phase 4. Demo users and their bookings, in partial-completion states. |

Create an empty database first, then run the scripts inside it:

```
sqlcmd -S <server> -d <database> -b -i db/01-schema.sql
```

`-b` stops at the first error. In SSMS or Azure Data Studio, open the file with the database selected and run it. The script sets `QUOTED_IDENTIFIER ON`, which filtered indexes need.

To start again on a test database:

```
sqlcmd -S <server> -d <database> -b -v ConfirmDrop=YES -i db/00-drop-all.sql
sqlcmd -S <server> -d <database> -b -i db/01-schema.sql
```

Re-running `01-schema.sql` never alters an existing table. A schema change after the first run is a new numbered script, or a drop and re-create on a test database.

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
