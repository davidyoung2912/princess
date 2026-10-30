using Dapper;

namespace Princess.Api.Data;

/// <summary>The Phase 9 store over SQL Server.</summary>
public sealed class DapperCheckinStore(IDbConnectionFactory db) : ICheckinStore
{
    public async Task<long?> FindBookingIdAsync(string number, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<long?>(Sql.Cmd("SELECT Id FROM dbo.Bookings WHERE Number = @number", new { number }, null, ct));
    }

    public async Task<List<CheckinStepRow>> ListStepsAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<CheckinStepRow>(Sql.Cmd(
            "SELECT UserId, Step, DoneAt, Data FROM dbo.CheckinGuests WHERE BookingId = @bookingId", new { bookingId }, null, ct))).ToList();
    }

    public async Task SaveStepAsync(long bookingId, string step, IReadOnlyList<long> userIds, DateTime at, string dataJson, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        foreach (var userId in userIds)
        {
            await c.ExecuteAsync(Sql.Cmd("""
                MERGE dbo.CheckinGuests AS t
                USING (SELECT @bookingId AS BookingId, @userId AS UserId, @step AS Step) AS s ON t.BookingId = s.BookingId AND t.UserId = s.UserId AND t.Step = s.Step
                WHEN MATCHED THEN UPDATE SET DoneAt = @at, Data = @dataJson, UpdatedAt = SYSUTCDATETIME()
                WHEN NOT MATCHED THEN INSERT (BookingId, UserId, Step, DoneAt, Data) VALUES (@bookingId, @userId, @step, @at, @dataJson);
                """, new { bookingId, userId, step, at, dataJson }, tx, ct));
        }
        await tx.CommitAsync(ct);
    }

    public async Task<CheckinBookingRow?> GetBookingAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<CheckinBookingRow>(Sql.Cmd(
            "SELECT PaymentCardId, PaymentLabel, PaymentAt, ArrivalAt, FinishedAt FROM dbo.CheckinBooking WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }

    private async Task UpsertBookingAsync(long bookingId, string set, string insertColumns, string insertValues, object args, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd($"""
            MERGE dbo.CheckinBooking AS t
            USING (SELECT @bookingId AS BookingId) AS s ON t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET {set}, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (BookingId, {insertColumns}) VALUES (@bookingId, {insertValues});
            """, args, null, ct));
    }

    public Task SavePaymentAsync(long bookingId, long cardId, string label, DateTime at, CancellationToken ct) =>
        UpsertBookingAsync(bookingId, "PaymentCardId = @cardId, PaymentLabel = @label, PaymentAt = @at", "PaymentCardId, PaymentLabel, PaymentAt", "@cardId, @label, @at", new { bookingId, cardId, label, at }, ct);

    public Task SaveArrivalAsync(long bookingId, string windowId, DateTime at, CancellationToken ct) =>
        UpsertBookingAsync(bookingId, "ArrivalWindowId = @windowId, ArrivalAt = @at", "ArrivalWindowId, ArrivalAt", "@windowId, @at", new { bookingId, windowId, at }, ct);

    public Task FinishAsync(long bookingId, DateTime at, CancellationToken ct) =>
        UpsertBookingAsync(bookingId, "FinishedAt = @at", "FinishedAt", "@at", new { bookingId, at }, ct);

    public async Task<List<PassRow>> ListPassesAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<PassRow>(Sql.Cmd(
            "SELECT UserId, Seq, Code, InWallet FROM dbo.BoardingPasses WHERE BookingId = @bookingId ORDER BY Seq", new { bookingId }, null, ct))).ToList();
    }

    public async Task SavePassesAsync(long bookingId, IReadOnlyList<PassRow> passes, DateTime at, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await using var tx = await c.BeginTransactionAsync(ct);
        foreach (var p in passes)
        {
            await c.ExecuteAsync(Sql.Cmd("""
                MERGE dbo.BoardingPasses AS t
                USING (SELECT @bookingId AS BookingId, @userId AS UserId) AS s ON t.BookingId = s.BookingId AND t.UserId = s.UserId
                WHEN MATCHED THEN UPDATE SET Seq = @seq, Code = @code
                WHEN NOT MATCHED THEN INSERT (BookingId, UserId, Seq, Code, InWallet, IssuedAt) VALUES (@bookingId, @userId, @seq, @code, 0, @at);
                """, new { bookingId, userId = p.UserId, seq = p.Seq, code = p.Code, at }, tx, ct));
        }
        await tx.CommitAsync(ct);
    }

    public async Task SetWalletAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.BoardingPasses SET InWallet = 1 WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }

    public async Task<EmbarkRow?> GetEmbarkAsync(long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QuerySingleOrDefaultAsync<EmbarkRow>(Sql.Cmd(
            "SELECT LuggageDroppedAt, Terminal FROM dbo.EmbarkProgress WHERE BookingId = @bookingId", new { bookingId }, null, ct));
    }

    public async Task<HashSet<string>> ListTicksAsync(long bookingId, string kind, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<string>(Sql.Cmd(
            "SELECT ItemId FROM dbo.EmbarkTicks WHERE BookingId = @bookingId AND Kind = @kind AND Done = 1", new { bookingId, kind }, null, ct))).ToHashSet();
    }

    public async Task SetTickAsync(long bookingId, string kind, string itemId, bool done, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.EmbarkTicks AS t
            USING (SELECT @bookingId AS BookingId, @kind AS Kind, @itemId AS ItemId) AS s ON t.BookingId = s.BookingId AND t.Kind = s.Kind AND t.ItemId = s.ItemId
            WHEN MATCHED THEN UPDATE SET Done = @done
            WHEN NOT MATCHED THEN INSERT (BookingId, Kind, ItemId, Done) VALUES (@bookingId, @kind, @itemId, @done);
            """, new { bookingId, kind, itemId, done }, null, ct));
    }

    public async Task SetBagsAsync(long bookingId, DateTime? droppedAt, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("""
            MERGE dbo.EmbarkProgress AS t
            USING (SELECT @bookingId AS BookingId) AS s ON t.BookingId = s.BookingId
            WHEN MATCHED THEN UPDATE SET LuggageStatus = @status, LuggageDroppedAt = @droppedAt, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (BookingId, LuggageStatus, LuggageDroppedAt) VALUES (@bookingId, @status, @droppedAt);
            """, new { bookingId, status = droppedAt is null ? "notDropped" : "dropped", droppedAt }, null, ct));
    }
}
