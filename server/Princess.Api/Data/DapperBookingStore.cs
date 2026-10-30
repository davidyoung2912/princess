using System.Data.Common;
using Dapper;
using Microsoft.Data.SqlClient;
using Princess.Api.Domain;

namespace Princess.Api.Data;

/// <summary>
/// SQL Server implementation of <see cref="IBookingStore"/>. As in Phases 5 and 6, none of this SQL has run against a real database here:
/// the smoke calls in <c>server/README.md</c> are the check.
/// </summary>
public sealed class DapperBookingStore(IDbConnectionFactory db) : IBookingStore
{
    private sealed class ExtraRow
    {
        public string Dining { get; set; } = "anytime";
        public string Occasion { get; set; } = "none";
        public string? ContactEmail { get; set; }
        public string? ContactPhone { get; set; }
        public int FinalPaymentDays { get; set; } = 90;
        public DateTime? CancelledAt { get; set; }
        public long? CancelFeeCents { get; set; }
        public long? CancelRefundCents { get; set; }
    }

    private sealed class CreditRow
    {
        public long Id { get; set; }
        public long RemainingCents { get; set; }
    }

    private sealed class TagRow
    {
        public int Seq { get; set; }
        public string Kind { get; set; } = "";
        public string Code { get; set; } = "";
    }

    private sealed class PartRow
    {
        public Guid PublicId { get; set; }
        public string Method { get; set; } = "";
        public string? CardBrand { get; set; }
        public string? Last4 { get; set; }
        public long Cents { get; set; }
    }

    private sealed class IdempotentRow
    {
        public long UserId { get; set; }
        public string Route { get; set; } = "";
        public string? ResponseHash { get; set; }
    }

    private static bool IsDuplicate(SqlException e) => e.Number is 2601 or 2627;

    // ---- Draft ----

    public async Task<DraftRecord?> GetDraftAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<DraftRecord>(Sql.Cmd("""
            SELECT Id, SailingId, CategoryId, Guests, CabinMode, CabinNumber, FareId, Dining, Occasion, LoyaltyNumber, UseCredit,
                   Accepted AS AcceptedJson, People AS PeopleJson, Contact AS ContactJson, UpdatedAt
            FROM dbo.BookingDrafts WHERE UserId = @userId
            """, new { userId }, null, ct));
    }

    public async Task<DraftRecord> SaveDraftAsync(long userId, DraftRecord d, string newId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var existing = await c.ExecuteScalarAsync<string?>(Sql.Cmd("SELECT Id FROM dbo.BookingDrafts WHERE UserId = @userId", new { userId }, null, ct));
        d.Id = existing ?? newId;
        d.UpdatedAt = now;
        if (existing is null)
        {
            await c.ExecuteAsync(Sql.Cmd("""
                INSERT INTO dbo.BookingDrafts (Id, UserId, SailingId, CategoryId, Guests, CabinMode, CabinNumber, FareId, Dining, Occasion, LoyaltyNumber, UseCredit, Accepted, People, Contact, UpdatedAt)
                VALUES (@Id, @userId, @SailingId, @CategoryId, @Guests, @CabinMode, @CabinNumber, @FareId, @Dining, @Occasion, @LoyaltyNumber, @UseCredit, @AcceptedJson, @PeopleJson, @ContactJson, @UpdatedAt)
                """, new { d.Id, userId, d.SailingId, d.CategoryId, d.Guests, d.CabinMode, d.CabinNumber, d.FareId, d.Dining, d.Occasion, d.LoyaltyNumber, d.UseCredit, d.AcceptedJson, d.PeopleJson, d.ContactJson, d.UpdatedAt }, null, ct));
        }
        else
        {
            await c.ExecuteAsync(Sql.Cmd("""
                UPDATE dbo.BookingDrafts SET SailingId = @SailingId, CategoryId = @CategoryId, Guests = @Guests, CabinMode = @CabinMode, CabinNumber = @CabinNumber, FareId = @FareId,
                       Dining = @Dining, Occasion = @Occasion, LoyaltyNumber = @LoyaltyNumber, UseCredit = @UseCredit, Accepted = @AcceptedJson, People = @PeopleJson, Contact = @ContactJson, UpdatedAt = @UpdatedAt
                WHERE UserId = @userId
                """, new { userId, d.SailingId, d.CategoryId, d.Guests, d.CabinMode, d.CabinNumber, d.FareId, d.Dining, d.Occasion, d.LoyaltyNumber, d.UseCredit, d.AcceptedJson, d.PeopleJson, d.ContactJson, d.UpdatedAt }, null, ct));
        }
        return d;
    }

    public async Task DeleteDraftAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.BookingDrafts WHERE UserId = @userId", new { userId }, null, ct));
    }

    public async Task AddResumeLinkAsync(string draftId, string via, string toMasked, string token, DateTime sentAt, DateTime expiresAt, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "INSERT INTO dbo.ResumeLinks (LinkToken, DraftId, Via, ToMasked, SentAt, ExpiresAt) VALUES (@token, @draftId, @via, @toMasked, @sentAt, @expiresAt)",
            new { token, draftId, via, toMasked, sentAt, expiresAt }, null, ct));
    }

    // ---- Loyalty ----

    public async Task<LoyaltyRecord> GetLoyaltyAsync(long userId, DateOnly today, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var number = await c.ExecuteScalarAsync<string?>(Sql.Cmd("SELECT Number FROM dbo.Loyalty WHERE UserId = @userId", new { userId }, null, ct));
        var left = await c.ExecuteScalarAsync<long>(Sql.Cmd(
            "SELECT ISNULL(SUM(RemainingCents), 0) FROM dbo.FutureCruiseCredits WHERE UserId = @userId AND ExpiresOn >= @today", new { userId, today = today.ToDateTime(TimeOnly.MinValue) }, null, ct));
        return new LoyaltyRecord { Number = number?.Trim(), CreditLeftCents = left };
    }

    // ---- Lookups ----

    public async Task<BookingRow?> FindByDraftAsync(string draftId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<BookingRow>(Sql.Cmd($"{DapperTripStore.BookingSelect} WHERE b.DraftId = @draftId", new { draftId }, null, ct));
    }

    public async Task<bool> NumberTakenAsync(string number, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.Bookings WHERE Number = @number) THEN 1 ELSE 0 END", new { number }, null, ct)) == 1;
    }

    public async Task<HashSet<string>> TakenCabinsAsync(string sailingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<string>(Sql.Cmd(
            "SELECT CabinNumber FROM dbo.Bookings WHERE SailingId = @sailingId AND Status = 'confirmed' AND CabinNumber IS NOT NULL", new { sailingId }, null, ct))).ToHashSet();
    }

    // ---- Create ----

    public async Task<long> CreateBookingAsync(NewBooking b, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        long id;
        try
        {
            id = await c.ExecuteScalarAsync<long>(Sql.Cmd("""
                INSERT INTO dbo.Bookings (Number, Kind, BookerUserId, SailingId, CategoryId, CabinNumber, FareId, Status, Dining, Occasion, TotalCents, DepositCents, FinalDueDate, FinalPaymentDays,
                                          LoyaltyNumber, DiscountCents, CreditUsedCents, DraftId, ContactEmail, ContactPhone, ConfirmedAt)
                OUTPUT INSERTED.Id
                VALUES (@Number, 'direct', @BookerUserId, @SailingId, @CategoryId, @CabinNumber, @FareId, 'confirmed', @Dining, @Occasion, @TotalCents, @DepositCents, @FinalDueDate, @FinalPaymentDays,
                        @LoyaltyNumber, @DiscountCents, @CreditUsedCents, @DraftId, @ContactEmail, @ContactPhone, @ConfirmedAt)
                """, b, tx, ct));
        }
        catch (SqlException e) when (IsDuplicate(e))
        {
            throw ApiException.Conflict("duplicate");
        }

        await c.ExecuteAsync(Sql.Cmd(
            "INSERT INTO dbo.BookingGuests (BookingId, UserId, Seq, IsLead, Printed) VALUES (@id, @BookerUserId, 1, 1, @BookerPrinted)", new { id, b.BookerUserId, b.BookerPrinted }, tx, ct));

        foreach (var g in b.Guests)
        {
            await c.ExecuteAsync(Sql.Cmd("""
                INSERT INTO dbo.BookingGuestDetails (BookingId, Seq, UserId, FirstName, LastName, Dob, Gender, Citizenship, DietaryStatus, AllergyNote)
                VALUES (@id, @Seq, @userId, @FirstName, @LastName, @Dob, @Gender, @Citizenship, @DietaryStatus, @AllergyNote)
                """, new { id, g.Seq, userId = g.Seq == 1 ? b.BookerUserId : (long?)null, g.FirstName, g.LastName, g.Dob, g.Gender, g.Citizenship, g.DietaryStatus, g.AllergyNote }, tx, ct));
            var tags = g.Dietary.Select(code => new { id, g.Seq, Kind = "dietary", Code = code }).Concat(g.Needs.Select(code => new { id, g.Seq, Kind = "need", Code = code })).ToList();
            if (tags.Count > 0)
                await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.BookingGuestTags (BookingId, Seq, Kind, Code) VALUES (@id, @Seq, @Kind, @Code)", tags, tx, ct));
        }

        foreach (var a in b.Acceptances)
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.Acceptances (BookingId, LegalId, Version, [At]) VALUES (@id, @LegalId, @Version, @At)", new { id, a.LegalId, a.Version, a.At }, tx, ct));
        foreach (var n in b.Notified)
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.NotificationsSent (BookingId, Via, ToMasked, [At]) VALUES (@id, @Via, @ToMasked, @At)", new { id, n.Via, n.ToMasked, n.At }, tx, ct));

        await InsertPaymentAsync(c, tx, id, b.Payment, ct);

        // Future cruise credit is used oldest first, and never more than a credit has left.
        var remaining = b.CreditUsedCents;
        if (remaining > 0)
        {
            var credits = (await c.QueryAsync<CreditRow>(Sql.Cmd(
                "SELECT Id, RemainingCents FROM dbo.FutureCruiseCredits WHERE UserId = @userId AND RemainingCents > 0 AND ExpiresOn >= @today ORDER BY ExpiresOn, Id",
                new { userId = b.BookerUserId, today = b.ConfirmedAt.Date }, tx, ct))).ToList();
            foreach (var credit in credits)
            {
                if (remaining == 0) break;
                var take = Math.Min(remaining, credit.RemainingCents);
                await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.FutureCruiseCredits SET RemainingCents = RemainingCents - @take, UpdatedAt = @at WHERE Id = @Id", new { take, credit.Id, at = b.ConfirmedAt }, tx, ct));
                remaining -= take;
            }
            if (remaining > 0) throw ApiException.Conflict("priceChanged");
        }

        await tx.CommitAsync(ct);
        return id;
    }

    private static async Task InsertPaymentAsync(DbConnection c, DbTransaction? tx, long bookingId, NewBookingPayment p, CancellationToken ct)
    {
        var paymentId = await c.ExecuteScalarAsync<long>(Sql.Cmd("""
            INSERT INTO dbo.Payments (BookingId, UserId, Label, AmountCents, [At], Reference, Status)
            OUTPUT INSERTED.Id
            VALUES (@bookingId, @UserId, @Label, @AmountCents, @At, @Reference, 'captured')
            """, new { bookingId, p.UserId, p.Label, p.AmountCents, p.At, p.Reference }, tx, ct));
        var seq = 0;
        foreach (var part in p.Parts)
            await c.ExecuteAsync(Sql.Cmd("""
                INSERT INTO dbo.PaymentParts (PaymentId, Seq, Method, CardId, CardBrand, Last4, Cents, ChallengeUsed)
                VALUES (@paymentId, @seq, @Method, @CardId, @CardBrand, @Last4, @Cents, @ChallengeUsed)
                """, new { paymentId, seq = ++seq, part.Method, part.CardId, part.CardBrand, part.Last4, part.Cents, part.ChallengeUsed }, tx, ct));
    }

    // ---- Read ----

    public async Task<BookingDetail?> GetDetailAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QuerySingleOrDefaultAsync<BookingRow>(Sql.Cmd($"{DapperTripStore.BookingSelect} WHERE b.Id = @bookingId", new { bookingId }, null, ct));
        if (row is null) return null;
        var extra = await c.QuerySingleAsync<ExtraRow>(Sql.Cmd(
            "SELECT Dining, Occasion, ContactEmail, ContactPhone, FinalPaymentDays, CancelledAt, CancelFeeCents, CancelRefundCents FROM dbo.Bookings WHERE Id = @bookingId", new { bookingId }, null, ct));
        var guests = (await c.QueryAsync<GuestDetailRow>(Sql.Cmd(
            "SELECT Seq, FirstName, LastName, Dob, Gender, Citizenship, DietaryStatus, AllergyNote FROM dbo.BookingGuestDetails WHERE BookingId = @bookingId ORDER BY Seq", new { bookingId }, null, ct))).ToList();
        var tags = (await c.QueryAsync<TagRow>(Sql.Cmd("SELECT Seq, Kind, Code FROM dbo.BookingGuestTags WHERE BookingId = @bookingId ORDER BY Code", new { bookingId }, null, ct))).ToList();
        foreach (var g in guests)
        {
            g.Dietary = [.. tags.Where(t => t.Seq == g.Seq && t.Kind == "dietary").Select(t => t.Code)];
            g.Needs = [.. tags.Where(t => t.Seq == g.Seq && t.Kind == "need").Select(t => t.Code)];
        }
        var acceptances = (await c.QueryAsync<AcceptanceRow>(Sql.Cmd("SELECT LegalId, Version, [At] FROM dbo.Acceptances WHERE BookingId = @bookingId", new { bookingId }, null, ct))).ToList();
        var notified = (await c.QueryAsync<NotifiedRow>(Sql.Cmd("SELECT Via, ToMasked, [At] FROM dbo.NotificationsSent WHERE BookingId = @bookingId ORDER BY Id", new { bookingId }, null, ct))).ToList();

        var receipts = (await c.QueryAsync<ReceiptRow>(Sql.Cmd("""
            SELECT PublicId, Label, AmountCents, [At], Status FROM dbo.Payments
            WHERE BookingId = @bookingId AND Status = 'captured' AND Label IN ('deposit', 'full', 'balance', 'refund')
            ORDER BY [At], Id
            """, new { bookingId }, null, ct))).ToList();
        if (receipts.Count > 0)
        {
            var parts = await c.QueryAsync<PartRow>(Sql.Cmd("""
                SELECT p.PublicId, pp.Method, pp.CardBrand, pp.Last4, pp.Cents
                FROM dbo.PaymentParts pp JOIN dbo.Payments p ON p.Id = pp.PaymentId
                WHERE p.BookingId = @bookingId ORDER BY pp.PaymentId, pp.Seq
                """, new { bookingId }, null, ct));
            foreach (var part in parts)
                receipts.FirstOrDefault(r => r.PublicId == part.PublicId)?.Parts.Add(new ReceiptPartRow(part.Method, part.CardBrand, part.Last4?.Trim(), part.Cents));
        }

        return new BookingDetail
        {
            Row = row, Dining = extra.Dining, Occasion = extra.Occasion, ContactEmail = extra.ContactEmail, ContactPhone = extra.ContactPhone, FinalPaymentDays = extra.FinalPaymentDays,
            CancelledAt = extra.CancelledAt, CancelFeeCents = extra.CancelFeeCents, CancelRefundCents = extra.CancelRefundCents,
            Guests = guests, Acceptances = acceptances, Notified = notified, Receipts = receipts,
        };
    }

    // ---- Change ----

    public async Task AddPaymentAsync(long bookingId, NewBookingPayment payment, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await InsertPaymentAsync(c, tx, bookingId, payment, ct);
        await tx.CommitAsync(ct);
    }

    public async Task ChangeSailingAsync(SailingChange ch, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.Bookings SET SailingId = @SailingId, TotalCents = @TotalCents, DepositCents = @DepositCents, FinalDueDate = @FinalDueDate, CabinNumber = @CabinNumber, UpdatedAt = @At
            WHERE Id = @BookingId
            """, ch, tx, ct));
        if (ch.Refund is not null) await InsertPaymentAsync(c, tx, ch.BookingId, ch.Refund, ct);
        await tx.CommitAsync(ct);
    }

    public async Task CancelAsync(Cancellation x, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.Bookings SET Status = 'cancelled', CancelledAt = @At, CancelFeeCents = @FeeCents, CancelRefundCents = @RefundCents, UpdatedAt = @At
            WHERE Id = @BookingId
            """, x, tx, ct));
        if (x.Refund is not null) await InsertPaymentAsync(c, tx, x.BookingId, x.Refund, ct);
        await tx.CommitAsync(ct);
    }

    // ---- Idempotency ----

    public async Task<string?> FindIdempotentAsync(string key, long userId, string route, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QuerySingleOrDefaultAsync<IdempotentRow>(Sql.Cmd("SELECT UserId, Route, ResponseHash FROM dbo.IdempotencyKeys WHERE [Key] = @key", new { key }, null, ct));
        if (row is null) return null;
        if (row.UserId != userId || row.Route != route) throw ApiException.Conflict("idempotencyKey");
        return row.ResponseHash;
    }

    public async Task SaveIdempotentAsync(string key, long userId, string route, string result, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            IF NOT EXISTS (SELECT 1 FROM dbo.IdempotencyKeys WHERE [Key] = @key)
              INSERT INTO dbo.IdempotencyKeys ([Key], UserId, Route, ResponseHash, CreatedAt) VALUES (@key, @userId, @route, @result, @now)
            """, new { key, userId, route, result, now }, null, ct));
    }
}
