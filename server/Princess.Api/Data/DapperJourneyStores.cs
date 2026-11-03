using System.Data.Common;
using Dapper;
using Microsoft.Data.SqlClient;
using Princess.Api.Domain;

namespace Princess.Api.Data;

internal static class Sql
{
    public static CommandDefinition Cmd(string sql, object? args, DbTransaction? tx, CancellationToken ct) =>
        new(sql, args, tx, cancellationToken: ct);
}

public sealed class DapperAccountStore(IDbConnectionFactory db, UserCache users, IHttpContextAccessor http) : IAccountStore
{
    private sealed class DocRow
    {
        public long UserId { get; set; }
        public string Doc { get; set; } = "";
        public DateTime? Expires { get; set; }
    }

    public async Task<List<GuestRow>> GetPartyAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var guests = (await c.QueryAsync<GuestRow>(Sql.Cmd("""
            SELECT u.Id AS UserId, u.PublicId, u.Tier, p.FirstName, p.LastName, p.Dob, p.Citizenship, u.IsSupervised, u.BookerUserId, g.Seq
            FROM dbo.BookingGuests g
            JOIN dbo.Users u ON u.Id = g.UserId
            JOIN dbo.Profiles p ON p.UserId = u.Id
            WHERE g.BookingId = @bookingId
            ORDER BY g.Seq
            """, new { bookingId }, null, ct))).ToList();
        if (guests.Count == 0) return guests;
        var docs = await c.QueryAsync<DocRow>(Sql.Cmd(
            "SELECT UserId, Doc, Expires FROM dbo.GuestDocuments WHERE UserId IN @ids", new { ids = guests.Select(g => g.UserId).ToArray() }, null, ct));
        foreach (var d in docs) guests.First(g => g.UserId == d.UserId).Held[d.Doc] = d.Expires;
        return guests;
    }

    public async Task<SharedBooking?> FindSharedBookingAsync(long userId, long otherUserId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QueryFirstOrDefaultAsync<SharedBooking>(Sql.Cmd("""
            SELECT TOP 1 b.Id AS BookingId, b.Number, b.BookerUserId, s.Departure, s.Nights
            FROM dbo.Bookings b
            JOIN ref.Sailings s ON s.Id = b.SailingId
            JOIN dbo.BookingGuests a ON a.BookingId = b.Id AND a.UserId = @userId
            JOIN dbo.BookingGuests o ON o.BookingId = b.Id AND o.UserId = @otherUserId
            ORDER BY CASE b.Status WHEN 'confirmed' THEN 0 ELSE 1 END, s.Departure DESC
            """, new { userId, otherUserId }, null, ct));
    }

    public async Task<ProfileRecord?> GetProfileAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var p = await c.QuerySingleOrDefaultAsync<ProfileRecord>(Sql.Cmd("""
            SELECT p.UserId, p.FirstName, p.LastName, p.Dob, u.Email, p.Phone, p.Citizenship, p.Bedding, p.SpecialRequests,
                   p.EmergencyName, p.EmergencyPhone, p.EmergencyRelationship
            FROM dbo.Profiles p JOIN dbo.Users u ON u.Id = p.UserId
            WHERE p.UserId = @userId
            """, new { userId }, null, ct));
        if (p is null) return null;
        var tags = await c.QueryAsync<(string Kind, string Code)>(Sql.Cmd("SELECT Kind, Code FROM dbo.ProfileTags WHERE UserId = @userId ORDER BY Code", new { userId }, null, ct));
        foreach (var (kind, code) in tags) (kind == "dietary" ? p.Dietary : p.Needs).Add(code);
        return p;
    }

    public async Task SaveProfileAsync(ProfileRecord p, bool updateEmail, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        try
        {
            await c.ExecuteAsync(Sql.Cmd("""
                UPDATE dbo.Profiles SET FirstName = @FirstName, LastName = @LastName, Dob = @Dob, Phone = @Phone, Citizenship = @Citizenship,
                  Bedding = @Bedding, SpecialRequests = @SpecialRequests, EmergencyName = @EmergencyName, EmergencyPhone = @EmergencyPhone,
                  EmergencyRelationship = @EmergencyRelationship, UpdatedAt = @now
                WHERE UserId = @UserId
                """, new { p.UserId, p.FirstName, p.LastName, p.Dob, Phone = NullIfEmpty(p.Phone), p.Citizenship, p.Bedding, p.SpecialRequests, p.EmergencyName, p.EmergencyPhone, p.EmergencyRelationship, now }, tx, ct));
            if (updateEmail)
                await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.Users SET Email = @email, UpdatedAt = @now WHERE Id = @UserId", new { p.UserId, email = NullIfEmpty(p.Email), now }, tx, ct));
            await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.ProfileTags WHERE UserId = @UserId", new { p.UserId }, tx, ct));
            var tags = p.Dietary.Select(code => new { p.UserId, Kind = "dietary", Code = code }).Concat(p.Needs.Select(code => new { p.UserId, Kind = "need", Code = code })).ToList();
            if (tags.Count > 0)
                await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ProfileTags (UserId, Kind, Code) VALUES (@UserId, @Kind, @Code)", tags, tx, ct));
            await tx.CommitAsync(ct);
            users.Invalidate(); // name and email are part of the cached user row
        }
        catch (SqlException e) when (e.Number is 2601 or 2627)
        {
            throw ApiException.Conflict("emailTaken");
        }
    }

    private static string? NullIfEmpty(string? s) => string.IsNullOrWhiteSpace(s) ? null : s;

    private const string LatestHelper = """
        SELECT TOP 1 HelperName AS Name, Relationship, Permissions, Status, ChangedAt
        FROM dbo.HelperLinks WHERE GuestUserId = @guestUserId
        ORDER BY CASE WHEN Status <> 'revoked' THEN 0 ELSE 1 END, ChangedAt DESC, Id DESC
        """;

    public async Task<HelperRecord?> GetHelperAsync(long guestUserId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QueryFirstOrDefaultAsync<HelperRecord>(Sql.Cmd(LatestHelper, new { guestUserId }, null, ct));
    }

    public async Task<HelperRecord> UpsertHelperAsync(long guestUserId, string name, string relationship, string permissions, string status, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.HelperLinks SET HelperName = @name, Relationship = @relationship, Permissions = @permissions, Status = @status, ChangedAt = @now, UpdatedAt = @now
            WHERE GuestUserId = @guestUserId AND Status <> 'revoked';
            IF @@ROWCOUNT = 0
              INSERT INTO dbo.HelperLinks (GuestUserId, HelperName, Relationship, Permissions, Status, ChangedAt)
              VALUES (@guestUserId, @name, @relationship, @permissions, @status, @now);
            """, new { guestUserId, name, relationship, permissions, status, now }, null, ct));
        return (await c.QueryFirstAsync<HelperRecord>(Sql.Cmd(LatestHelper, new { guestUserId }, null, ct)));
    }

    public async Task<HelperRecord?> RevokeHelperAsync(long guestUserId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var changed = await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.HelperLinks SET Status = 'revoked', ChangedAt = @now, UpdatedAt = @now WHERE GuestUserId = @guestUserId AND Status <> 'revoked'",
            new { guestUserId, now }, null, ct));
        return changed == 0 ? null : await c.QueryFirstOrDefaultAsync<HelperRecord>(Sql.Cmd(LatestHelper, new { guestUserId }, null, ct));
    }

    public async Task<List<HistoryRecord>> ListHistoryAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<HistoryRecord>(Sql.Cmd("""
            SELECT h.PublicId, h.[At], ISNULL(p.FirstName, N'') AS [By], h.What, h.Detail
            FROM dbo.HistoryEntries h LEFT JOIN dbo.Profiles p ON p.UserId = h.ByUserId
            WHERE h.UserId = @userId OR h.UserId IN (SELECT Id FROM dbo.Users WHERE BookerUserId = @userId)
            ORDER BY h.[At] DESC, h.Id DESC
            """, new { userId }, null, ct))).ToList();
    }

    public async Task AddHistoryAsync(long userId, long byUserId, string what, string detail, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.HistoryEntries (UserId, ByUserId, What, Detail, [At]) VALUES (@userId, @byUserId, @what, @detail, @now);
            -- The same change goes into the audit trail with who, whom, where from and the request it belongs to.
            INSERT INTO dbo.AuditEvents (Category, Action, Outcome, ActorPublicId, ActorRole, SubjectPublicId, Detail, CorrelationId, Ip, UserAgent, [At])
            SELECT 'domain', N'history.' + @what, 'success', a.PublicId, a.Role, s.PublicId, @auditDetail, @correlation, @ip, @agent, SYSUTCDATETIME()
            FROM dbo.Users a, dbo.Users s WHERE a.Id = @byUserId AND s.Id = @userId;
            """,
            new
            {
                userId, byUserId, what, detail, now,
                auditDetail = System.Text.Json.JsonSerializer.Serialize(new { change = detail }),
                correlation = http.HttpContext is { } h ? Audit.AuditContext.Correlation(h) : null,
                ip = http.HttpContext?.Connection.RemoteIpAddress?.ToString(),
                agent = Audit.AuditLog.Cut(http.HttpContext?.Request.Headers.UserAgent.ToString(), 200),
            }, null, ct));
    }

    public async Task SetDocumentAsync(long userId, string doc, DateTime? expires, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.GuestDocuments SET Expires = @expires, UpdatedAt = @now WHERE UserId = @userId AND Doc = @doc;
            IF @@ROWCOUNT = 0 INSERT INTO dbo.GuestDocuments (UserId, Doc, Expires) VALUES (@userId, @doc, @expires);
            """, new { userId, doc, expires, now }, null, ct));
    }

    public async Task RemoveDocumentAsync(long userId, string doc, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.GuestDocuments WHERE UserId = @userId AND Doc = @doc", new { userId, doc }, null, ct));
    }
}

public sealed class DapperTripStore(IDbConnectionFactory db, SailingCache sailings) : ITripStore
{
    internal const string BookingSelect = """
        SELECT b.Id AS BookingId, b.Number, b.Kind, b.AgentName, b.BookerUserId, b.SailingId, s.Title AS SailingTitle, sh.Name AS ShipName,
               s.Departure, s.Nights, b.CategoryId, c.Name AS CategoryName, b.FareId, b.Dining, b.CabinNumber, b.Status, b.TotalCents, b.DepositCents, b.FinalDueDate, b.ConfirmedAt,
               (SELECT COUNT(*) FROM dbo.BookingGuests g WHERE g.BookingId = b.Id) AS GuestAccounts,
               (SELECT COUNT(*) FROM dbo.BookingGuestDetails d WHERE d.BookingId = b.Id) AS GuestDetails,
               ck.FinishedAt AS CheckinFinishedAt,
               ISNULL((SELECT SUM(p.AmountCents) FROM dbo.Payments p WHERE p.BookingId = b.Id AND p.Status = 'captured' AND p.Label IN ('deposit', 'full', 'balance')), 0) AS PaidCents
        FROM dbo.Bookings b
        JOIN ref.Sailings s ON s.Id = b.SailingId
        JOIN ref.Ships sh ON sh.Id = s.ShipId
        JOIN ref.CabinCategories c ON c.Id = b.CategoryId
        LEFT JOIN dbo.CheckinBooking ck ON ck.BookingId = b.Id
        """;

    public async Task<List<BookingRow>> ListForUserAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<BookingRow>(Sql.Cmd($"""
            {BookingSelect}
            WHERE b.Id IN (SELECT BookingId FROM dbo.BookingGuests WHERE UserId = @userId UNION SELECT BookingId FROM dbo.LinkedBookings WHERE UserId = @userId)
            ORDER BY s.Departure, b.Id
            """, new { userId }, null, ct))).ToList();
    }

    public async Task<BookingRow?> GetAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<BookingRow>(Sql.Cmd($"{BookingSelect} WHERE b.Id = @bookingId", new { bookingId }, null, ct));
    }

    public async Task<BookingRow?> FindAgentBookingAsync(string number, string lastName, DateTime departure, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<BookingRow>(Sql.Cmd($"""
            {BookingSelect}
            WHERE b.Number = @number AND b.Kind = 'agent' AND b.Status = 'confirmed' AND s.Departure = @departure
              AND EXISTS (SELECT 1 FROM dbo.BookingGuestDetails d WHERE d.BookingId = b.Id AND d.Seq = 1 AND d.LastName = @lastName)
            """, new { number, lastName, departure = departure.Date }, null, ct));
    }

    public async Task<bool> IsLinkedOrMemberAsync(long userId, long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("""
            SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.BookingGuests WHERE UserId = @userId AND BookingId = @bookingId)
                          OR EXISTS (SELECT 1 FROM dbo.LinkedBookings WHERE UserId = @userId AND BookingId = @bookingId) THEN 1 ELSE 0 END
            """, new { userId, bookingId }, null, ct)) == 1;
    }

    public async Task LinkAsync(long userId, long bookingId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.LinkedBookings (UserId, BookingId, LinkedAt) VALUES (@userId, @bookingId, @now)", new { userId, bookingId, now }, null, ct));
    }

    public async Task<List<PaymentRow>> ListPaymentsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<PaymentRow>(Sql.Cmd("""
            SELECT p.PublicId, p.Label, p.AmountCents, p.[At], p.Status, pp.Method, pp.CardBrand, pp.Last4
            FROM dbo.Payments p
            OUTER APPLY (SELECT TOP 1 Method, CardBrand, Last4 FROM dbo.PaymentParts WHERE PaymentId = p.Id ORDER BY Seq) pp
            WHERE p.BookingId = @bookingId AND p.Label IN ('deposit', 'full', 'balance')
            ORDER BY p.[At], p.Id
            """, new { bookingId }, null, ct))).ToList();
    }

    public async Task InsertPaymentAsync(NewPayment p, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var id = await c.ExecuteScalarAsync<long>(Sql.Cmd("""
            INSERT INTO dbo.Payments (BookingId, UserId, Label, AmountCents, [At], Reference, Status)
            OUTPUT INSERTED.Id
            VALUES (@BookingId, @UserId, @Label, @AmountCents, @At, @Reference, 'captured')
            """, p, tx, ct));
        await c.ExecuteAsync(Sql.Cmd(
            "INSERT INTO dbo.PaymentParts (PaymentId, Seq, Method, CardId, CardBrand, Last4, Cents) VALUES (@id, 1, 'card', @CardId, @CardBrand, @Last4, @AmountCents)",
            new { id, p.CardId, p.CardBrand, p.Last4, p.AmountCents }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task<List<CardRow>> ListCardsAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<CardRow>(Sql.Cmd(
            "SELECT Id, PublicId, Brand, Last4, Expiry, IsDefault FROM dbo.SavedCards WHERE UserId = @userId ORDER BY IsDefault DESC, Id", new { userId }, null, ct))).ToList();
    }

    public async Task<CardRow> AddCardAsync(long userId, string brand, string last4, string expiry, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleAsync<CardRow>(Sql.Cmd("""
            INSERT INTO dbo.SavedCards (UserId, Brand, Last4, Expiry, IsDefault, CreatedAt)
            OUTPUT INSERTED.Id, INSERTED.PublicId, INSERTED.Brand, INSERTED.Last4, INSERTED.Expiry
            VALUES (@userId, @brand, @last4, @expiry, CASE WHEN EXISTS (SELECT 1 FROM dbo.SavedCards WHERE UserId = @userId) THEN 0 ELSE 1 END, @now)
            """, new { userId, brand, last4, expiry, now }, null, ct));
    }

    public async Task<bool> RemoveCardAsync(long userId, Guid cardPublicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var gone = await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.SavedCards WHERE UserId = @userId AND PublicId = @cardPublicId", new { userId, cardPublicId }, tx, ct));
        if (gone == 0)
        {
            await tx.RollbackAsync(ct);
            return false;
        }
        // The default went with it: the oldest card left takes over, so a person with cards always has one default.
        await c.ExecuteAsync(Sql.Cmd("""
            IF NOT EXISTS (SELECT 1 FROM dbo.SavedCards WHERE UserId = @userId AND IsDefault = 1)
              UPDATE dbo.SavedCards SET IsDefault = 1 WHERE Id = (SELECT TOP 1 Id FROM dbo.SavedCards WHERE UserId = @userId ORDER BY Id)
            """, new { userId }, tx, ct));
        await tx.CommitAsync(ct);
        return true;
    }

    /// <summary>Served from <see cref="SailingCache"/> (10 minutes); the API never writes <c>ref.Sailings</c>.</summary>
    public Task<List<SailingRow>> ListSailingsAsync(CancellationToken ct) => sailings.GetOrLoadAsync(async () =>
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<SailingRow>(Sql.Cmd("SELECT Id, Departure, IsHoliday, IsReference, Nights, BookingOpen FROM ref.Sailings ORDER BY Departure, Id", null, null, ct))).ToList();
    });

    public async Task<List<PastTripRow>> ListPastTripsAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<PastTripRow>(Sql.Cmd(
            "SELECT Id, Title, Ship, Departure, Nights, Cancelled FROM dbo.PastTrips WHERE UserId = @userId ORDER BY Departure DESC", new { userId }, null, ct))).ToList();
    }
}

public sealed class DapperInboxStore(IDbConnectionFactory db) : IInboxStore
{
    public async Task<string?> GetPrefsJsonAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<string>(Sql.Cmd("SELECT Prefs FROM dbo.NotificationPrefs WHERE UserId = @userId", new { userId }, null, ct));
    }

    public async Task SavePrefsJsonAsync(long userId, string json, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.NotificationPrefs SET Prefs = @json, UpdatedAt = @now WHERE UserId = @userId;
            IF @@ROWCOUNT = 0 INSERT INTO dbo.NotificationPrefs (UserId, Prefs) VALUES (@userId, @json);
            """, new { userId, json, now }, null, ct));
    }

    public async Task<HashSet<string>> ReadNoticeKindsAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<string>(Sql.Cmd("SELECT Kind FROM dbo.Notices WHERE UserId = @userId AND ReadAt IS NOT NULL", new { userId }, null, ct))).ToHashSet();
    }

    public async Task MarkNoticesReadAsync(long userId, IReadOnlyCollection<string> kinds, DateTime now, CancellationToken ct)
    {
        if (kinds.Count == 0) return;
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.Notices SET ReadAt = @now WHERE UserId = @userId AND Kind = @kind AND ReadAt IS NULL;
            IF NOT EXISTS (SELECT 1 FROM dbo.Notices WHERE UserId = @userId AND Kind = @kind)
              INSERT INTO dbo.Notices (UserId, Kind, Severity, Title, Body, ReadAt, [At]) VALUES (@userId, @kind, 'info', @kind, N'', @now, @now);
            """, kinds.Select(kind => new { userId, kind, now }).ToList(), null, ct));
    }

    public async Task<List<TicketRow>> ListTicketsAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<TicketRow>(Sql.Cmd(
            "SELECT PublicId, Kind, Status, Detail, [At] FROM dbo.SupportTickets WHERE UserId = @userId ORDER BY [At] DESC, Id DESC", new { userId }, null, ct))).ToList();
    }

    public async Task<TicketRow> AddTicketAsync(long userId, string kind, string detail, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleAsync<TicketRow>(Sql.Cmd("""
            INSERT INTO dbo.SupportTickets (UserId, Kind, Status, Detail, [At])
            OUTPUT INSERTED.PublicId, INSERTED.Kind, INSERTED.Status, INSERTED.Detail, INSERTED.[At]
            VALUES (@userId, @kind, 'open', @detail, @now)
            """, new { userId, kind, detail, now }, null, ct));
    }

    public async Task<List<FeedbackRecord>> ListFeedbackAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<FeedbackRecord>(Sql.Cmd(
            "SELECT PublicId, Kind, [Text], [Log] AS LogJson, Screenshot, Reference, [At] FROM dbo.Feedback WHERE UserId = @userId ORDER BY [At] DESC, Id DESC", new { userId }, null, ct))).ToList();
    }

    public async Task AddFeedbackAsync(long userId, FeedbackRecord f, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "INSERT INTO dbo.Feedback (PublicId, UserId, Kind, [Text], [Log], Screenshot, Reference, [At]) VALUES (@PublicId, @userId, @Kind, @Text, @LogJson, @Screenshot, @Reference, @At)",
            new { f.PublicId, userId, f.Kind, f.Text, f.LogJson, f.Screenshot, f.Reference, f.At }, null, ct));
    }

    public async Task<List<string>> ListFavouritesAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await Favourites(c, userId, null, ct);
    }

    public async Task<List<string>> ToggleFavouriteAsync(long userId, string key, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var removed = await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.Favourites WHERE UserId = @userId AND ItemKey = @key", new { userId, key }, tx, ct));
        if (removed == 0)
            await c.ExecuteAsync(Sql.Cmd(
                "INSERT INTO dbo.Favourites (UserId, ItemKey, Position) SELECT @userId, @key, ISNULL(MAX(Position), 0) + 1 FROM dbo.Favourites WHERE UserId = @userId", new { userId, key }, tx, ct));
        var list = await Favourites(c, userId, tx, ct);
        await tx.CommitAsync(ct);
        return list;
    }

    public async Task AddJourneyEventAsync(long userId, string kind, string? sailingId, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.JourneyEvents (UserId, Kind, SailingId, [At]) VALUES (@userId, @kind, @sailingId, @at)", new { userId, kind, sailingId, at }, null, ct));
    }

    public async Task<List<JourneyEventRow>> ListJourneyEventsAsync(long userId, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<JourneyEventRow>(Sql.Cmd("SELECT TOP (@max) Kind, SailingId, [At] FROM dbo.JourneyEvents WHERE UserId = @userId ORDER BY [At] DESC, Id DESC", new { userId, max }, null, ct))).ToList();
    }

    private static async Task<List<string>> Favourites(DbConnection c, long userId, DbTransaction? tx, CancellationToken ct) =>
        (await c.QueryAsync<string>(Sql.Cmd("SELECT ItemKey FROM dbo.Favourites WHERE UserId = @userId ORDER BY Position, ItemKey", new { userId }, tx, ct))).ToList();
}

public sealed class DapperPrivacyStore(IDbConnectionFactory db, IHttpContextAccessor http) : IPrivacyStore
{
    public async Task<List<ConsentRow>> ListConsentsAsync(IReadOnlyCollection<long> userIds, CancellationToken ct)
    {
        if (userIds.Count == 0) return [];
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<ConsentRow>(Sql.Cmd("SELECT UserId, ConsentId, IsOn AS [On] FROM dbo.ConsentChoices WHERE UserId IN @userIds", new { userIds }, null, ct))).ToList();
    }

    public async Task SetConsentAsync(long userId, string consentId, bool on, long changedByUserId, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.ConsentChoices SET IsOn = @on, ChangedByUserId = @changedByUserId, [At] = @now WHERE UserId = @userId AND ConsentId = @consentId;
            IF @@ROWCOUNT = 0 INSERT INTO dbo.ConsentChoices (UserId, ConsentId, IsOn, ChangedByUserId, [At]) VALUES (@userId, @consentId, @on, @changedByUserId, @now);
            """, new { userId, consentId, on, changedByUserId, now }, null, ct));
    }

    public async Task<List<AccessRow>> ListAccessAsync(long userId, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<AccessRow>(Sql.Cmd(
            "SELECT TOP (@max) Actor, Purpose, [At] FROM dbo.AccessLog WHERE UserId = @userId ORDER BY [At] DESC, Id DESC", new { userId, max }, null, ct))).Reverse().ToList();
    }

    public async Task AddAccessAsync(long userId, string actor, string purpose, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var ctx = http.HttpContext;
        var actorId = Guid.TryParse(ctx?.User.FindFirst(Auth.Claims.Actor)?.Value ?? ctx?.User.FindFirst(Auth.Claims.Subject)?.Value, out var g) ? g : (Guid?)null;
        await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.AccessLog (UserId, Actor, Purpose, [At]) VALUES (@userId, @actor, @purpose, @now);
            -- Reading or deleting someone's documents is also an audit event: who looked at whose data, and why.
            INSERT INTO dbo.AuditEvents (Category, Action, Outcome, ActorPublicId, ActorRole, SubjectPublicId, Detail, CorrelationId, Ip, UserAgent, [At])
            SELECT 'domain', N'access.' + @purpose, 'success', @actorId, ISNULL((SELECT Role FROM dbo.Users WHERE PublicId = @actorId), 'system'), s.PublicId, @auditDetail, @correlation, @ip, @agent, SYSUTCDATETIME()
            FROM dbo.Users s WHERE s.Id = @userId;
            """,
            new
            {
                userId, actor, purpose, now, actorId,
                auditDetail = System.Text.Json.JsonSerializer.Serialize(new { by = actor }),
                correlation = ctx is null ? null : Audit.AuditContext.Correlation(ctx),
                ip = ctx?.Connection.RemoteIpAddress?.ToString(),
                agent = Audit.AuditLog.Cut(ctx?.Request.Headers.UserAgent.ToString(), 200),
            }, null, ct));
    }

    public async Task<List<RetentionRow>> ListRetentionRunsAsync(IReadOnlyCollection<long> userIds, CancellationToken ct)
    {
        if (userIds.Count == 0) return [];
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<RetentionRow>(Sql.Cmd("SELECT Kinds, [At] FROM dbo.RetentionRuns WHERE UserId IN @userIds ORDER BY [At], Id", new { userIds }, null, ct))).ToList();
    }

    public async Task PurgeAsync(long bookingId, IReadOnlyCollection<long> guestUserIds, long runUserId, IReadOnlyCollection<string> kinds, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        foreach (var kind in kinds)
        {
            var sql = kind switch
            {
                "ci-guest" => "DELETE FROM dbo.CheckinGuests WHERE BookingId = @bookingId",
                "documents" => "DELETE FROM dbo.GuestDocuments WHERE UserId IN @guestUserIds",
                "illness" => "DELETE FROM dbo.HealthReports WHERE BookingId = @bookingId",
                "clubReg" => "DELETE FROM dbo.ClubRegistrations WHERE BookingId = @bookingId",
                "message" => "DELETE FROM dbo.ChatMessages WHERE FromUserId IN @guestUserIds",
                _ => throw new InvalidOperationException($"Unknown retention kind {kind}"),
            };
            await c.ExecuteAsync(Sql.Cmd(sql, new { bookingId, guestUserIds }, tx, ct));
            // The party's shared notes and port-day record (BookingState) go with the messages rule: same 30 days, same people.
            if (kind == "message") await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.BookingState WHERE BookingId = @bookingId", new { bookingId }, tx, ct));
        }
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.RetentionRuns (UserId, RuleName, Kinds, [At]) VALUES (@runUserId, N'retention', @kinds, @now)", new { runUserId, kinds = string.Join(',', kinds), now }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task<List<BookingRow>> ListEndedBookingsAsync(DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<BookingRow>(Sql.Cmd($"{DapperTripStore.BookingSelect} WHERE b.Status = 'confirmed' AND s.Departure <= @now ORDER BY b.Id", new { now }, null, ct))).ToList();
    }

    public async Task<string?> GetBudgetJsonAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<string>(Sql.Cmd("SELECT Json FROM dbo.Budgets WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }

    public async Task SaveBudgetJsonAsync(long bookingId, string json, DateTime now, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE dbo.Budgets SET Json = @json, UpdatedAt = @now WHERE BookingId = @bookingId;
            IF @@ROWCOUNT = 0 INSERT INTO dbo.Budgets (BookingId, Json) VALUES (@bookingId, @json);
            """, new { bookingId, json, now }, null, ct));
    }
}

/// <summary>
/// Scoped, so one request reads <c>demo.DemoState</c> once however many times the clock and the scenarios are asked for.
/// Nothing is kept across requests: the clock offset and speed change from the demo controls and must show at once.
/// </summary>
public sealed class DapperDemoStore(IDbConnectionFactory db) : IDemoStore
{
    private readonly Dictionary<long, DemoStateRow> _memo = [];

    public async Task<long> GetClockOffsetSecondsAsync(long userId, CancellationToken ct) => (await GetStateAsync(userId, ct)).ClockOffsetSeconds;

    public async Task<HashSet<string>> GetScenariosAsync(long userId, CancellationToken ct) => [.. (await GetStateAsync(userId, ct)).Scenarios];

    private sealed class DemoRowRaw { public long ClockOffsetSeconds { get; set; } public int ClockSpeed { get; set; } public string? ActiveScenarios { get; set; } public DateTime UpdatedAt { get; set; } public string? SailingId { get; set; } public string? PhoneZone { get; set; } }

    public async Task<DemoStateRow> GetStateAsync(long userId, CancellationToken ct)
    {
        if (_memo.TryGetValue(userId, out var known)) return known;
        var state = await ReadStateAsync(userId, ct);
        _memo[userId] = state;
        return state;
    }

    private async Task<DemoStateRow> ReadStateAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var r = await c.QuerySingleOrDefaultAsync<DemoRowRaw>(Sql.Cmd("SELECT ClockOffsetSeconds, ClockSpeed, ActiveScenarios, UpdatedAt, SailingId, PhoneZone FROM demo.DemoState WHERE UserId = @userId", new { userId }, null, ct));
        if (r is null) return new DemoStateRow(0, 1, []);
        try { return new DemoStateRow(r.ClockOffsetSeconds, r.ClockSpeed, System.Text.Json.JsonSerializer.Deserialize<string[]>(r.ActiveScenarios ?? "[]") ?? [], DateTime.SpecifyKind(r.UpdatedAt, DateTimeKind.Utc), r.SailingId, r.PhoneZone); }
        catch (System.Text.Json.JsonException) { return new DemoStateRow(r.ClockOffsetSeconds, r.ClockSpeed, [], DateTime.SpecifyKind(r.UpdatedAt, DateTimeKind.Utc), r.SailingId, r.PhoneZone); }
    }

    public async Task SaveStateAsync(long userId, DemoStateRow state, DateTime now, CancellationToken ct)
    {
        _memo.Remove(userId);
        await using var c = await db.OpenAsync(ct);
        var scenarios = System.Text.Json.JsonSerializer.Serialize(state.Scenarios);
        await c.ExecuteAsync(Sql.Cmd("""
            UPDATE demo.DemoState SET ClockOffsetSeconds = @offset, ClockSpeed = @speed, ActiveScenarios = @scenarios, SailingId = @sailing, PhoneZone = @zone, UpdatedAt = @now WHERE UserId = @userId;
            IF @@ROWCOUNT = 0 INSERT INTO demo.DemoState (UserId, ClockOffsetSeconds, ClockSpeed, ActiveScenarios, SailingId, PhoneZone, UpdatedAt) VALUES (@userId, @offset, @speed, @scenarios, @sailing, @zone, @now);
            """, new { userId, offset = state.ClockOffsetSeconds, speed = state.ClockSpeed, scenarios, sailing = state.SailingId, zone = state.PhoneZone, now }, null, ct));
    }
}
