using System.Text.Json;
using Dapper;
using Princess.Api.Domain;

namespace Princess.Api.Data;

/// <summary>The Phase 8b store over SQL Server. Every read and write is scoped to a booking or a person; the service has already checked who may ask.</summary>
public sealed class DapperAheadStore(IDbConnectionFactory db) : IAheadStore
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
    private static TimeSpan Clock(string hhmm) => TimeSpan.Parse(hhmm + ":00");

    // ---- Waits ----

    public async Task<List<QueueRow>> ListQueuesAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<QueueRow>(Sql.Cmd(
            "SELECT Id, PublicId, VenueId, JoinedAt, Position AS Start FROM dbo.Queues WHERE BookingId = @bookingId AND Stage <> 'left' ORDER BY JoinedAt, Id", new { bookingId }, null, ct))).ToList();
    }

    public async Task<QueueRow> AddQueueAsync(long bookingId, string venueId, int start, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QuerySingleAsync<(long Id, Guid PublicId)>(Sql.Cmd("""
            INSERT INTO dbo.Queues (BookingId, VenueId, JoinedAt, Stage, Position, ReadyAt, ExpiresAt)
            OUTPUT INSERTED.Id, INSERTED.PublicId
            VALUES (@bookingId, @venueId, @at, 'waiting', @start, @readyAt, @expiresAt)
            """, new
        {
            bookingId, venueId, at, start,
            readyAt = at.AddMinutes(start * WaitRules.QueueStepMin), expiresAt = at.AddMinutes((start * WaitRules.QueueStepMin) + WaitRules.HoldMin),
        }, null, ct));
        return new QueueRow { Id = row.Id, PublicId = row.PublicId, VenueId = venueId, JoinedAt = at, Start = start };
    }

    public async Task<bool> DeleteQueueAsync(long bookingId, long id, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.Queues WHERE Id = @id AND BookingId = @bookingId", new { id, bookingId }, null, ct)) > 0;
    }

    private sealed class WaitSql
    {
        public long Id { get; set; }
        public Guid PublicId { get; set; }
        public string VenueId { get; set; } = "";
        public int Day { get; set; }
        public string Time { get; set; } = "";
        public DateTime JoinedAt { get; set; }
        public int Start { get; set; }
        public string Stage { get; set; } = "";
        public bool Auto { get; set; }
    }

    public async Task<List<WaitlistRow>> ListWaitlistAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var rows = (await c.QueryAsync<WaitSql>(Sql.Cmd("""
            SELECT Id, PublicId, VenueId, [Day], CONVERT(VARCHAR(5), TimeLocal, 108) AS [Time], CreatedAt AS JoinedAt, Position AS Start, Stage, Auto
            FROM dbo.Waitlists WHERE BookingId = @bookingId ORDER BY CreatedAt, Id
            """, new { bookingId }, null, ct))).ToList();
        if (rows.Count == 0) return [];
        var guests = (await c.QueryAsync<(long WaitlistId, long UserId)>(Sql.Cmd(
            "SELECT WaitlistId, UserId FROM dbo.WaitlistGuests WHERE WaitlistId IN @ids ORDER BY CreatedAt, UserId", new { ids = rows.Select(r => r.Id).ToArray() }, null, ct))).ToList();
        return [.. rows.Select(r => new WaitlistRow
        {
            Id = r.Id, PublicId = r.PublicId, VenueId = r.VenueId, Day = r.Day, Time = r.Time, JoinedAt = r.JoinedAt, Start = r.Start, Stage = r.Stage, Auto = r.Auto,
            GuestIds = [.. guests.Where(g => g.WaitlistId == r.Id).Select(g => g.UserId)],
        })];
    }

    public async Task<WaitlistRow> AddWaitlistAsync(long bookingId, string venueId, int day, string time, IReadOnlyList<long> guestIds, int start, bool auto, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var row = await c.QuerySingleAsync<(long Id, Guid PublicId)>(Sql.Cmd("""
            INSERT INTO dbo.Waitlists (BookingId, VenueId, [Day], TimeLocal, Stage, Position, Auto, CreatedAt)
            OUTPUT INSERTED.Id, INSERTED.PublicId
            VALUES (@bookingId, @venueId, @day, @clock, 'waiting', @start, @auto, @at)
            """, new { bookingId, venueId, day, clock = Clock(time), start, auto, at }, tx, ct));
        foreach (var userId in guestIds)
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.WaitlistGuests (WaitlistId, UserId) VALUES (@id, @userId)", new { id = row.Id, userId }, tx, ct));
        await tx.CommitAsync(ct);
        return new WaitlistRow { Id = row.Id, PublicId = row.PublicId, VenueId = venueId, Day = day, Time = time, JoinedAt = at, Start = start, Stage = "waiting", Auto = auto, GuestIds = [.. guestIds] };
    }

    public async Task<bool> DeleteWaitlistAsync(long bookingId, long id, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.Waitlists WHERE Id = @id AND BookingId = @bookingId", new { id, bookingId }, null, ct)) > 0;
    }

    public async Task MarkWaitlistBookedAsync(long bookingId, long id, bool auto, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.Waitlists SET Stage = 'booked', Auto = @auto, UpdatedAt = @at WHERE Id = @id AND BookingId = @bookingId AND Stage <> 'booked'", new { id, bookingId, auto, at }, null, ct));
    }

    // ---- Shows ----

    public async Task<List<ShowTicketRow>> ListTicketsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var rows = (await c.QueryAsync<(long Id, Guid PublicId, string EventId, int Day)>(Sql.Cmd(
            "SELECT Id, PublicId, EventId, [Day] FROM dbo.ShowTickets WHERE BookingId = @bookingId AND Status = 'on' ORDER BY [At], Id", new { bookingId }, null, ct))).ToList();
        if (rows.Count == 0) return [];
        var guests = (await c.QueryAsync<(long ShowTicketId, long UserId)>(Sql.Cmd(
            "SELECT ShowTicketId, UserId FROM dbo.ShowTicketGuests WHERE ShowTicketId IN @ids ORDER BY CreatedAt, UserId", new { ids = rows.Select(r => r.Id).ToArray() }, null, ct))).ToList();
        return [.. rows.Select(r => new ShowTicketRow { Id = r.Id, PublicId = r.PublicId, EventId = r.EventId, Day = r.Day, GuestIds = [.. guests.Where(g => g.ShowTicketId == r.Id).Select(g => g.UserId)] })];
    }

    public async Task<int> CountSeatsAsync(string sailingId, string eventId, int day, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("""
            SELECT COUNT(*) FROM dbo.ShowTicketGuests g
            JOIN dbo.ShowTickets t ON t.Id = g.ShowTicketId
            JOIN dbo.Bookings b ON b.Id = t.BookingId
            WHERE b.SailingId = @sailingId AND b.Status = 'confirmed' AND t.Status = 'on' AND t.EventId = @eventId AND t.[Day] = @day
            """, new { sailingId, eventId, day }, null, ct));
    }

    public async Task<ShowTicketRow> AddTicketAsync(long bookingId, string eventId, int day, IReadOnlyList<long> guestIds, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var row = await c.QuerySingleAsync<(long Id, Guid PublicId)>(Sql.Cmd("""
            INSERT INTO dbo.ShowTickets (BookingId, EventId, [Day], Status, [At])
            OUTPUT INSERTED.Id, INSERTED.PublicId
            VALUES (@bookingId, @eventId, @day, 'on', @at)
            """, new { bookingId, eventId, day, at }, tx, ct));
        foreach (var userId in guestIds)
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.ShowTicketGuests (ShowTicketId, UserId) VALUES (@id, @userId)", new { id = row.Id, userId }, tx, ct));
        await tx.CommitAsync(ct);
        return new ShowTicketRow { Id = row.Id, PublicId = row.PublicId, EventId = eventId, Day = day, GuestIds = [.. guestIds] };
    }

    public async Task<bool> DeleteTicketAsync(long bookingId, long id, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.ShowTickets WHERE Id = @id AND BookingId = @bookingId", new { id, bookingId }, null, ct)) > 0;
    }

    // ---- Upgrade bids ----

    public async Task<List<BidRow>> ListBidsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<BidRow>(Sql.Cmd(
            "SELECT Id, PublicId, CategoryId, Cents, Status, BuyNow, [At] FROM dbo.UpgradeBids WHERE BookingId = @bookingId ORDER BY [At], Id", new { bookingId }, null, ct))).ToList();
    }

    public async Task<BidRow> AddBidAsync(long bookingId, string categoryId, long cents, bool buyNow, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var row = await c.QuerySingleAsync<(long Id, Guid PublicId)>(Sql.Cmd("""
            INSERT INTO dbo.UpgradeBids (BookingId, CategoryId, Cents, Status, BuyNow, DecidedAt, [At])
            OUTPUT INSERTED.Id, INSERTED.PublicId
            VALUES (@bookingId, @categoryId, @cents, @status, @buyNow, @decidedAt, @at)
            """, new { bookingId, categoryId, cents, status = buyNow ? "accepted" : "open", buyNow, decidedAt = buyNow ? at : (DateTime?)null, at }, null, ct));
        return new BidRow { Id = row.Id, PublicId = row.PublicId, CategoryId = categoryId, Cents = cents, Status = buyNow ? "accepted" : "open", BuyNow = buyNow, At = at };
    }

    public async Task WithdrawBidAsync(long bookingId, long id, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.UpgradeBids SET Status = 'withdrawn', DecidedAt = @at, UpdatedAt = @at WHERE Id = @id AND BookingId = @bookingId AND Status = 'open'", new { id, bookingId, at }, null, ct));
    }

    // ---- Clubs ----

    /// <summary>The table has no columns for the medical and medication notes, so they travel in the Pickups JSON beside the list.</summary>
    private sealed record PickupsJson(List<Pickup> Pickups, string Medical, string Medication);

    public async Task<List<ClubRow>> ListClubsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var rows = await c.QueryAsync<(long ChildUserId, string Allergies, bool SignOutAlone, bool Photos, string EmergencyPhone, string Pickups)>(Sql.Cmd(
            "SELECT ChildUserId, Allergies, SignOutAlone, Photos, EmergencyPhone, Pickups FROM dbo.ClubRegistrations WHERE BookingId = @bookingId", new { bookingId }, null, ct));
        return [.. rows.Select(r =>
        {
            var packed = r.Pickups.TrimStart().StartsWith('[') ? new PickupsJson(JsonSerializer.Deserialize<List<Pickup>>(r.Pickups, Web) ?? [], "", "") : JsonSerializer.Deserialize<PickupsJson>(r.Pickups, Web)!;
            return new ClubRow
            {
                ChildUserId = r.ChildUserId, Allergies = r.Allergies, Medical = packed.Medical, Medication = packed.Medication, PhotoConsent = r.Photos, SelfSignOut = r.SignOutAlone,
                EmergencyPhone = r.EmergencyPhone, Pickups = packed.Pickups,
            };
        })];
    }

    public async Task SaveClubAsync(long bookingId, string clubId, string emergencyName, ClubRow club, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.ClubRegistrations AS t
            USING (SELECT @childUserId AS ChildUserId, @bookingId AS BookingId) AS s ON t.ChildUserId = s.ChildUserId AND t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET ClubId = @clubId, EmergencyName = @emergencyName, EmergencyPhone = @emergencyPhone, Pickups = @pickups, Allergies = @allergies,
                 SignOutAlone = @signOut, Photos = @photos, [At] = @at, UpdatedAt = @at
            WHEN NOT MATCHED THEN INSERT (ChildUserId, BookingId, ClubId, EmergencyName, EmergencyPhone, Pickups, Allergies, SignOutAlone, Photos, [At])
                 VALUES (@childUserId, @bookingId, @clubId, @emergencyName, @emergencyPhone, @pickups, @allergies, @signOut, @photos, @at);
            """, new
        {
            childUserId = club.ChildUserId, bookingId, clubId, emergencyName, emergencyPhone = club.EmergencyPhone, allergies = club.Allergies, signOut = club.SelfSignOut, photos = club.PhotoConsent, at,
            pickups = JsonSerializer.Serialize(new PickupsJson(club.Pickups, club.Medical, club.Medication), Web),
        }, null, ct));
    }

    public async Task<bool> DeleteClubAsync(long bookingId, long childUserId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.ClubRegistrations WHERE BookingId = @bookingId AND ChildUserId = @childUserId", new { bookingId, childUserId }, null, ct)) > 0;
    }

    // ---- Medallion, bag tags, preparation ----

    public async Task<MedallionRow?> GetMedallionAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<MedallionRow>(Sql.Cmd("SELECT ActivatedAt, LostAt FROM dbo.Medallions WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }

    public async Task SaveMedallionAsync(long bookingId, string stage, string trackingNumber, DateTime? activatedAt, DateTime? lostAt, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.Medallions AS t
            USING (SELECT @bookingId AS BookingId) AS s ON t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET Stage = @stage, ActivatedAt = @activatedAt, LostAt = @lostAt, TrackingNumber = @trackingNumber, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (BookingId, Stage, ActivatedAt, LostAt, TrackingNumber) VALUES (@bookingId, @stage, @activatedAt, @lostAt, @trackingNumber);
            """, new { bookingId, stage, activatedAt, lostAt, trackingNumber }, null, ct));
    }

    public async Task<TagRow?> GetTagsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<TagRow>(Sql.Cmd("SELECT Way, OrderedAt, HandedOverAt FROM dbo.BagTagOrders WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }

    public async Task SaveTagsAsync(long bookingId, string way, string stage, DateTime orderedAt, DateTime? handedOverAt, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.BagTagOrders AS t
            USING (SELECT @bookingId AS BookingId) AS s ON t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET Way = @way, Stage = @stage, OrderedAt = @orderedAt, HandedOverAt = @handedOverAt, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (BookingId, Way, Stage, OrderedAt, HandedOverAt) VALUES (@bookingId, @way, @stage, @orderedAt, @handedOverAt);
            """, new { bookingId, way, stage, orderedAt, handedOverAt }, null, ct));
    }

    public async Task<HashSet<string>> GetPrepAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return [.. await c.QueryAsync<string>(Sql.Cmd("SELECT ItemId FROM dbo.PrepTicks WHERE BookingId = @bookingId AND Done = 1", new { bookingId }, null, ct))];
    }

    public async Task SetPrepAsync(long bookingId, string itemId, bool done, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.PrepTicks AS t
            USING (SELECT @bookingId AS BookingId, @itemId AS ItemId) AS s ON t.BookingId = s.BookingId AND t.ItemId = s.ItemId
            WHEN MATCHED THEN UPDATE SET Done = @done, [At] = @at
            WHEN NOT MATCHED THEN INSERT (BookingId, ItemId, Done, [At]) VALUES (@bookingId, @itemId, @done, @at);
            """, new { bookingId, itemId, done, at }, null, ct));
    }

    // ---- Per person ----

    public async Task<List<AdvisorAskRow>> ListAdvisorAsksAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<AdvisorAskRow>(Sql.Cmd(
            "SELECT Id, PublicId, AdvisorId, Way, Question, Reply, CallbackBy, [At] FROM dbo.AdvisorRequests WHERE UserId = @userId ORDER BY [At] DESC, Id DESC", new { userId }, null, ct))).ToList();
    }

    public async Task AddAdvisorAskAsync(long userId, string advisorId, string way, string? phone, string question, string? reply, DateTime? callbackBy, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.AdvisorRequests (UserId, AdvisorId, Way, Phone, Question, Reply, CallbackBy, [At])
            VALUES (@userId, @advisorId, @way, @phone, @question, @reply, @callbackBy, @at)
            """, new { userId, advisorId, way, phone, question, reply, callbackBy, at }, null, ct));
    }

    public async Task<List<MarketingConsentRow>> ListConsentsAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<MarketingConsentRow>(Sql.Cmd(
            "SELECT Channel, Contact, Region, AskedAt, ConfirmedAt FROM dbo.MarketingConsents WHERE UserId = @userId AND State <> 'withdrawn'", new { userId }, null, ct))).ToList();
    }

    public async Task SaveConsentAsync(long userId, MarketingConsentRow consent, byte[]? codeHash, DateTime? expiresAt, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.MarketingConsents AS t
            USING (SELECT @userId AS UserId, @channel AS Channel) AS s ON t.UserId = s.UserId AND t.Channel = s.Channel
            WHEN MATCHED THEN UPDATE SET Contact = @contact, Region = @region, State = @state, CodeHash = @codeHash, AskedAt = @askedAt, ConfirmedAt = @confirmedAt, ExpiresAt = @expiresAt, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (UserId, Channel, Contact, Region, State, CodeHash, AskedAt, ConfirmedAt, ExpiresAt)
                 VALUES (@userId, @channel, @contact, @region, @state, @codeHash, @askedAt, @confirmedAt, @expiresAt);
            """, new
        {
            userId, channel = consent.Channel, contact = consent.Contact, region = consent.Region, state = consent.ConfirmedAt is null ? "pending" : "confirmed", codeHash,
            askedAt = consent.AskedAt, confirmedAt = consent.ConfirmedAt, expiresAt,
        }, null, ct));
    }

    public async Task<bool> DeleteConsentAsync(long userId, string channel, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.MarketingConsents WHERE UserId = @userId AND Channel = @channel", new { userId, channel }, null, ct)) > 0;
    }

    public async Task<List<FixCaseRow>> ListFixCasesAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<FixCaseRow>(Sql.Cmd(
            "SELECT Id, PublicId, Flow, Note, Reference, [At] FROM dbo.FixCases WHERE UserId = @userId ORDER BY [At] DESC, Id DESC", new { userId }, null, ct))).ToList();
    }

    public async Task AddFixCaseAsync(long userId, string flow, string note, string reference, DateTime contactBy, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "INSERT INTO dbo.FixCases (UserId, Flow, Note, Stage, Reference, ContactBy, [At]) VALUES (@userId, @flow, @note, N'received', @reference, @contactBy, @at)",
            new { userId, flow, note, reference, contactBy, at }, null, ct));
    }

    public async Task<List<AssistCaseRow>> ListAssistCasesAsync(long userId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<AssistCaseRow>(Sql.Cmd("""
            SELECT a.Id, a.PublicId, a.Kind, ISNULL(a.Phone, N'') AS Phone, a.Note, b.Number AS BookingNumber, a.Reference, a.Choice, a.[At]
            FROM dbo.AssistCases a LEFT JOIN dbo.Bookings b ON b.Id = a.BookingId
            WHERE a.UserId = @userId ORDER BY a.[At] DESC, a.Id DESC
            """, new { userId }, null, ct))).ToList();
    }

    public async Task AddAssistCaseAsync(long userId, long? bookingId, AssistCaseRow row, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            INSERT INTO dbo.AssistCases (UserId, BookingId, Kind, Phone, Note, Stage, Reference, [At])
            VALUES (@userId, @bookingId, @Kind, @Phone, @Note, 'received', @Reference, @At)
            """, new { userId, bookingId, row.Kind, row.Phone, row.Note, row.Reference, row.At }, null, ct));
    }

    public async Task SetAssistChoiceAsync(long userId, long id, string choice, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd(
            "UPDATE dbo.AssistCases SET Choice = @choice, Stage = 'decided', UpdatedAt = SYSUTCDATETIME() WHERE Id = @id AND UserId = @userId AND Choice IS NULL", new { id, userId, choice }, null, ct));
    }
}
