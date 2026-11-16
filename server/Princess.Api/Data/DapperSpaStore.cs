using Dapper;

namespace Princess.Api.Data;

/// <summary>Spa appointments over SQL Server (<c>dbo.SpaAppointments</c> and <c>dbo.SpaAppointmentGuests</c>).</summary>
public sealed class DapperSpaStore(IDbConnectionFactory db) : ISpaStore
{
    private sealed class RowSql
    {
        public long Id { get; set; }
        public Guid PublicId { get; set; }
        public string VenueId { get; set; } = "";
        public string TreatmentId { get; set; } = "";
        public int Day { get; set; }
        public string Time { get; set; } = "";
        public int Minutes { get; set; }
        public long PriceCents { get; set; }
        public string Note { get; set; } = "";
        public DateTime CreatedAt { get; set; }
    }

    public async Task<List<SpaRow>> ListAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        var rows = (await c.QueryAsync<RowSql>(Sql.Cmd("""
            SELECT Id, PublicId, VenueId, TreatmentId, [Day], CONVERT(CHAR(5), TimeLocal, 108) AS [Time], Minutes, PriceCents, Note, CreatedAt
            FROM dbo.SpaAppointments WHERE BookingId = @bookingId AND Status = 'booked' ORDER BY [Day], TimeLocal, Id
            """, new { bookingId }, null, ct))).ToList();
        if (rows.Count == 0) return [];
        var guests = (await c.QueryAsync<(long AppointmentId, long UserId)>(Sql.Cmd(
            "SELECT AppointmentId, UserId FROM dbo.SpaAppointmentGuests WHERE AppointmentId IN @ids ORDER BY CreatedAt, UserId", new { ids = rows.Select(r => r.Id).ToArray() }, null, ct))).ToList();
        return [.. rows.Select(r => new SpaRow
        {
            Id = r.Id, PublicId = r.PublicId, VenueId = r.VenueId, TreatmentId = r.TreatmentId, Day = r.Day, Time = r.Time, Minutes = r.Minutes, PriceCents = r.PriceCents, Note = r.Note, At = r.CreatedAt,
            GuestIds = [.. guests.Where(g => g.AppointmentId == r.Id).Select(g => g.UserId)],
        })];
    }

    public async Task<int> CountAsync(string sailingId, string treatmentId, int day, string time, long? exceptId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteScalarAsync<int>(Sql.Cmd("""
            SELECT COUNT(*) FROM dbo.SpaAppointments a
            JOIN dbo.Bookings b ON b.Id = a.BookingId
            WHERE b.SailingId = @sailingId AND b.Status = 'confirmed' AND a.Status = 'booked' AND a.TreatmentId = @treatmentId AND a.[Day] = @day
              AND a.TimeLocal = @at AND (@exceptId IS NULL OR a.Id <> @exceptId)
            """, new { sailingId, treatmentId, day, at = TimeSpan.Parse(time + ":00"), exceptId }, null, ct));
    }

    public async Task<SpaRow> AddAsync(long bookingId, NewSpa n, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        var row = await c.QuerySingleAsync<(long Id, Guid PublicId)>(Sql.Cmd("""
            INSERT INTO dbo.SpaAppointments (BookingId, SailingId, VenueId, TreatmentId, [Day], TimeLocal, Minutes, PriceCents, Note, Status, CreatedAt)
            OUTPUT INSERTED.Id, INSERTED.PublicId
            SELECT b.Id, b.SailingId, @VenueId, @TreatmentId, @Day, @at, @Minutes, @PriceCents, @Note, 'booked', @At FROM dbo.Bookings b WHERE b.Id = @bookingId
            """, new { bookingId, n.VenueId, n.TreatmentId, n.Day, at = TimeSpan.Parse(n.Time + ":00"), n.Minutes, n.PriceCents, n.Note, n.At }, tx, ct));
        foreach (var userId in n.GuestIds)
            await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.SpaAppointmentGuests (AppointmentId, BookingId, UserId) VALUES (@id, @bookingId, @userId)", new { id = row.Id, bookingId, userId }, tx, ct));
        await tx.CommitAsync(ct);
        return new SpaRow { Id = row.Id, PublicId = row.PublicId, VenueId = n.VenueId, TreatmentId = n.TreatmentId, Day = n.Day, Time = n.Time, Minutes = n.Minutes, PriceCents = n.PriceCents, Note = n.Note, At = n.At, GuestIds = [.. n.GuestIds] };
    }

    public async Task MoveAsync(long bookingId, long id, int day, string time, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.SpaAppointments SET [Day] = @day, TimeLocal = @at, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id AND BookingId = @bookingId AND Status = 'booked'",
            new { bookingId, id, day, at = TimeSpan.Parse(time + ":00") }, null, ct));
    }

    public async Task UpdateAsync(long bookingId, long id, List<long> guestIds, string note, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.SpaAppointments SET Note = @note, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id AND BookingId = @bookingId AND Status = 'booked'", new { bookingId, id, note }, tx, ct));
        await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.SpaAppointmentGuests WHERE AppointmentId = @id AND BookingId = @bookingId AND UserId NOT IN @guestIds", new { bookingId, id, guestIds }, tx, ct));
        foreach (var userId in guestIds)
            await c.ExecuteAsync(Sql.Cmd("""
                IF NOT EXISTS (SELECT 1 FROM dbo.SpaAppointmentGuests WHERE AppointmentId = @id AND UserId = @userId)
                  INSERT INTO dbo.SpaAppointmentGuests (AppointmentId, BookingId, UserId) VALUES (@id, @bookingId, @userId)
                """, new { bookingId, id, userId }, tx, ct));
        await tx.CommitAsync(ct);
    }

    public async Task CancelAsync(long bookingId, long id, long feeCents, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.SpaAppointments SET Status = 'cancelled', FeeCents = @feeCents, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id AND BookingId = @bookingId",
            new { bookingId, id, feeCents }, null, ct));
    }
}
