using Dapper;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public sealed class StanleyReminderRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long UserId { get; set; }
    public DateTime DueAt { get; set; }
    public string Text { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    /// <summary>clock, relative or anchored (section 25.2).</summary>
    public string Kind { get; set; } = StanleyReminderRules.KindClock;
    /// <summary>"allAboard" or "plan" for an anchored reminder; the plan item's id and title, the day of the plan it is on, the time it had when the lead was taken and the date it is on.</summary>
    public string? AnchorType { get; set; }
    public string? AnchorId { get; set; }
    public string? AnchorTitle { get; set; }
    public int? AnchorDay { get; set; }
    public string? AnchorTime { get; set; }
    public DateTime? AnchorDate { get; set; }
    public int? OffsetMin { get; set; }
    /// <summary>The zone it was meant in (the ship's at the time).</summary>
    public string ZoneId { get; set; } = Itinerary.ShipHomeZone;
    /// <summary>Health wording: kept, never read or advised on, and never put on a lock screen.</summary>
    public bool Private { get; set; }
    public string State { get; set; } = StanleyReminderRules.StateScheduled;
    /// <summary>One line the guest is told once: it moved, or its anchor went.</summary>
    public string? Note { get; set; }
}

/// <summary>One reminder as the Reminders screen shows it. The server works out the words for the moment; the screen only renders.</summary>
public sealed record StanleyReminderDto(string Id, string Text, DateTime DueAt, string When, string Kind, string? Anchor, string? Lead, string State, string? Note, bool Private, bool Past);

/// <summary>An edit from the list: new words, a new time (a clock reminder), a new lead (an anchored one), or keep an anchored reminder whose anchor went as a plain clock reminder.</summary>
public sealed record StanleyReminderEdit(string? Text, string? At, string? Date, int? LeadMin, bool? KeepAsClock);

public interface IStanleyReminderStore
{
    Task AddAsync(StanleyReminderRow row, CancellationToken ct);
    /// <summary>The guest's own reminders that are not yet long past, soonest first.</summary>
    Task<List<StanleyReminderRow>> ListAsync(long userId, DateTime since, CancellationToken ct);
    /// <summary>True when the guest's own reminder was removed.</summary>
    Task<bool> DeleteAsync(long userId, Guid publicId, CancellationToken ct);
    Task<StanleyReminderRow?> GetAsync(long userId, Guid publicId, CancellationToken ct);
    /// <summary>Saves the changeable fields of a reminder (due time, words, kind, anchor, state, note).</summary>
    Task UpdateAsync(StanleyReminderRow row, CancellationToken ct);
    Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct);
}

public sealed class MemoryStanleyReminderStore : IStanleyReminderStore
{
    private readonly List<StanleyReminderRow> _rows = [];
    private long _next;

    private static StanleyReminderRow Copy(StanleyReminderRow r) => new()
    {
        Id = r.Id, PublicId = r.PublicId, UserId = r.UserId, DueAt = r.DueAt, Text = r.Text, CreatedAt = r.CreatedAt, Kind = r.Kind, AnchorType = r.AnchorType, AnchorId = r.AnchorId, AnchorTitle = r.AnchorTitle,
        AnchorDay = r.AnchorDay, AnchorTime = r.AnchorTime, AnchorDate = r.AnchorDate, OffsetMin = r.OffsetMin, ZoneId = r.ZoneId, Private = r.Private, State = r.State, Note = r.Note,
    };

    public Task AddAsync(StanleyReminderRow row, CancellationToken ct)
    {
        lock (_rows) { row.Id = ++_next; _rows.Add(Copy(row)); }
        return Task.CompletedTask;
    }

    public Task<List<StanleyReminderRow>> ListAsync(long userId, DateTime since, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.Where(r => r.UserId == userId && r.DueAt >= since).OrderBy(r => r.DueAt).Select(Copy).ToList());
    }

    public Task<bool> DeleteAsync(long userId, Guid publicId, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.RemoveAll(r => r.UserId == userId && r.PublicId == publicId) > 0);
    }

    public Task<StanleyReminderRow?> GetAsync(long userId, Guid publicId, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.Where(r => r.UserId == userId && r.PublicId == publicId).Select(Copy).FirstOrDefault());
    }

    public Task UpdateAsync(StanleyReminderRow row, CancellationToken ct)
    {
        lock (_rows)
        {
            var i = _rows.FindIndex(r => r.UserId == row.UserId && r.PublicId == row.PublicId);
            if (i >= 0) { row.Id = _rows[i].Id; _rows[i] = Copy(row); }
        }
        return Task.CompletedTask;
    }

    public Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.RemoveAll(r => r.DueAt < cutoff));
    }
}

public sealed class DapperStanleyReminderStore(IDbConnectionFactory db) : IStanleyReminderStore
{
    public async Task AddAsync(StanleyReminderRow row, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.StanleyReminders (PublicId, UserId, DueAt, Text, CreatedAt, Kind, AnchorType, AnchorId, AnchorTitle, AnchorDay, AnchorTime, AnchorDate, OffsetMin, ZoneId, [Private], [State], Note) VALUES (@PublicId, @UserId, @DueAt, @Text, @CreatedAt, @Kind, @AnchorType, @AnchorId, @AnchorTitle, @AnchorDay, @AnchorTime, @AnchorDate, @OffsetMin, @ZoneId, @Private, @State, @Note)", row, null, ct));
    }

    public async Task<List<StanleyReminderRow>> ListAsync(long userId, DateTime since, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<StanleyReminderRow>(Sql.Cmd("SELECT Id, PublicId, UserId, DueAt, Text, CreatedAt, Kind, AnchorType, AnchorId, AnchorTitle, AnchorDay, AnchorTime, AnchorDate, OffsetMin, ZoneId, [Private], [State], Note FROM dbo.StanleyReminders WHERE UserId = @userId AND DueAt >= @since ORDER BY DueAt", new { userId, since }, null, ct))).ToList();
    }

    public async Task<bool> DeleteAsync(long userId, Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.StanleyReminders WHERE UserId = @userId AND PublicId = @publicId", new { userId, publicId }, null, ct)) > 0;
    }

    public async Task<StanleyReminderRow?> GetAsync(long userId, Guid publicId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QueryFirstOrDefaultAsync<StanleyReminderRow>(Sql.Cmd("SELECT Id, PublicId, UserId, DueAt, Text, CreatedAt, Kind, AnchorType, AnchorId, AnchorTitle, AnchorDay, AnchorTime, AnchorDate, OffsetMin, ZoneId, [Private], [State], Note FROM dbo.StanleyReminders WHERE UserId = @userId AND PublicId = @publicId", new { userId, publicId }, null, ct));
    }

    public async Task UpdateAsync(StanleyReminderRow row, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.StanleyReminders SET DueAt = @DueAt, Text = @Text, Kind = @Kind, AnchorType = @AnchorType, AnchorId = @AnchorId, AnchorTitle = @AnchorTitle, AnchorDay = @AnchorDay, AnchorTime = @AnchorTime, AnchorDate = @AnchorDate, OffsetMin = @OffsetMin, [Private] = @Private, [State] = @State, Note = @Note WHERE UserId = @UserId AND PublicId = @PublicId", row, null, ct));
    }

    public async Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.StanleyReminders WHERE DueAt < @cutoff", new { cutoff }, null, ct));
    }
}

/// <summary>
/// Reminders as push (docs/stanley-gap-analysis-and-plan.md, the carry-over list). A reminder is the guest's own: made by a confirmed Stanley action, listed and removed by them alone, and sent to their own phones
/// by the existing push dispatch (so a phone that has not allowed alerts gets nothing, and the on-device reminder still shows when the app is open). The text is what the guest chose; no other data goes in it.
/// </summary>
public sealed class StanleyReminderService(IStanleyReminderStore store, IClock clock)
{
    /// <summary>The server's clock, so a preview and the reminder it makes are worked out against the same moment.</summary>
    public DateTime UtcNow => clock.UtcNow;

    private static void Check(UserRecord user) { if (user.IsSupervised) throw ApiException.Forbidden(); }

    private async Task<int> ActiveAsync(long userId, DateTime now, CancellationToken ct) =>
        (await store.ListAsync(userId, now, ct)).Count(r => r.State != StanleyReminderRules.StateCancelled);

    /// <summary>Sets a reminder for the next time the clock in <paramref name="zoneId"/> shows <paramref name="hhmm"/>. 400 time, 409 tooMany at the limit. Returns the reminder's id.</summary>
    public async Task<Guid> SetAsync(UserRecord user, string? hhmm, string? text, string zoneId, CancellationToken ct) =>
        await AddAsync(user, new Dictionary<string, string> { ["at"] = hhmm ?? "", ["text"] = text ?? "" }, zoneId, ct);

    /// <summary>
    /// Makes the reminder a confirmed action asks for: <c>when</c> (clock, relative, anchored), <c>at</c>, <c>date</c>, <c>in</c>, <c>anchor</c> with <c>anchorTitle</c> and <c>anchorDay</c>, <c>offset</c>, <c>private</c>. The moment is worked out here,
    /// in the ship's zone. 400 time for what cannot be read, 400 past for a moment that has gone, 400 tooFar beyond the trip limit, 409 tooMany at the limit.
    /// </summary>
    public async Task<Guid> AddAsync(UserRecord user, IReadOnlyDictionary<string, string> args, string zoneId, CancellationToken ct)
    {
        Check(user);
        var now = clock.UtcNow;
        var due = StanleyReminderRules.Resolve(args, now, zoneId) ?? throw ApiException.Invalid("time");
        if (due <= now) throw ApiException.Invalid("past");
        if (due > now.AddDays(StanleyReminderRules.MaxDays)) throw ApiException.Invalid("tooFar");
        if (await ActiveAsync(user.Id, now, ct) >= StanleyReminderRules.MaxPending) throw ApiException.Conflict("tooMany");
        var kind = args.GetValueOrDefault("when", StanleyReminderRules.KindClock);
        var row = new StanleyReminderRow
        {
            PublicId = Guid.NewGuid(), UserId = user.Id, DueAt = due, Text = StanleyReminderRules.Clean(args.GetValueOrDefault("text")), CreatedAt = now, Kind = kind, ZoneId = zoneId,
            Private = args.GetValueOrDefault("private") == "1",
        };
        if (kind == StanleyReminderRules.KindAnchored)
        {
            var anchor = args.GetValueOrDefault("anchor") ?? "";
            var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(now, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById(zoneId));
            row.AnchorType = anchor == StanleyReminderRules.AllAboard ? "allAboard" : "plan";
            row.AnchorId = anchor;
            row.AnchorTitle = args.GetValueOrDefault("anchorTitle") is { Length: > 0 } t ? t : "all aboard";
            row.AnchorDay = int.TryParse(args.GetValueOrDefault("anchorDay"), out var day) ? day : null;
            row.AnchorTime = args.GetValueOrDefault("at");
            row.AnchorDate = DateOnly.TryParseExact(args.GetValueOrDefault("date"), "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var d) ? d.ToDateTime(TimeOnly.MinValue) : local.Date;
            row.OffsetMin = int.TryParse(args.GetValueOrDefault("offset"), out var off) ? off : 0;
        }
        await store.AddAsync(row, ct);
        return row.PublicId;
    }

    /// <summary>Sets a reminder a set time from now (Remind me later on a thread notice). 403 supervised; 409 tooMany. Returns when it is due (UTC).</summary>
    public async Task<DateTime> SetInAsync(UserRecord user, TimeSpan after, string? text, CancellationToken ct)
    {
        Check(user);
        var now = clock.UtcNow;
        if (await ActiveAsync(user.Id, now, ct) >= StanleyReminderRules.MaxPending) throw ApiException.Conflict("tooMany");
        var row = new StanleyReminderRow { PublicId = Guid.NewGuid(), UserId = user.Id, DueAt = now + after, Text = StanleyReminderRules.Clean(text), CreatedAt = now, Kind = StanleyReminderRules.KindRelative };
        await store.AddAsync(row, ct);
        return row.DueAt;
    }

    private StanleyReminderDto ToDto(StanleyReminderRow r, DateTime now) => new(r.PublicId.ToString(), r.Text, DateTime.SpecifyKind(r.DueAt, DateTimeKind.Utc), StanleyReminderRules.Label(r.DueAt, r.ZoneId, now), r.Kind,
        r.Kind == StanleyReminderRules.KindAnchored ? r.AnchorTitle : null, r.Kind == StanleyReminderRules.KindAnchored && r.OffsetMin is { } o ? StanleyReminderRules.LeadWords(o) + " before" : null,
        r.State, r.Note, r.Private, r.DueAt <= now);

    /// <summary>The guest's own reminders: upcoming, and the ones that were due in the last <see cref="StanleyReminderRules.LateHours"/> hours, soonest first.</summary>
    public async Task<List<StanleyReminderDto>> ListAsync(UserRecord user, CancellationToken ct)
    {
        var now = clock.UtcNow;
        return [.. (await store.ListAsync(user.Id, now.AddHours(-StanleyReminderRules.LateHours), ct)).Select(r => ToDto(r, now))];
    }

    /// <summary>Edits the guest's own reminder. 404 not theirs, 400 time or text for a bad value, 400 past, 403 supervised.</summary>
    public async Task<StanleyReminderDto> UpdateAsync(UserRecord user, Guid id, StanleyReminderEdit edit, CancellationToken ct)
    {
        Check(user);
        var row = await store.GetAsync(user.Id, id, ct) ?? throw ApiException.NotFound();
        var now = clock.UtcNow;
        if (edit.Text is not null)
        {
            if (edit.Text.Trim().Length == 0) throw ApiException.Invalid("text");
            row.Text = StanleyReminderRules.Clean(edit.Text);
            row.Private = row.Private || StanleyReminderRules.IsHealth(row.Text);
        }
        if (edit.KeepAsClock == true && row.Kind == StanleyReminderRules.KindAnchored)
        {
            // The anchor went: keep the reminder as a plain one at the moment it had, or at a new time when one was given.
            row.Kind = StanleyReminderRules.KindClock; row.AnchorType = row.AnchorId = row.AnchorTitle = null; row.AnchorDay = row.OffsetMin = null; row.AnchorDate = null; row.AnchorTime = null;
            row.State = StanleyReminderRules.StateScheduled; row.Note = null;
        }
        if (edit.LeadMin is { } lead && row.Kind == StanleyReminderRules.KindAnchored)
        {
            if (lead is < 0 or > StanleyReminderRules.MaxLeadMin || row.AnchorTime is null || row.AnchorDate is null) throw ApiException.Invalid("time");
            var due = StanleyReminderRules.AnchorMoment(row.AnchorDate.Value, row.AnchorTime, lead, row.ZoneId);
            if (due <= now) throw ApiException.Invalid("past");
            row.OffsetMin = lead; row.DueAt = due; row.Note = null;
        }
        else if (edit.At is not null && row.Kind != StanleyReminderRules.KindAnchored)
        {
            var args = new Dictionary<string, string> { ["at"] = edit.At };
            if (edit.Date is not null) args["date"] = edit.Date;
            var due = StanleyReminderRules.Resolve(args, now, row.ZoneId) ?? throw ApiException.Invalid("time");
            if (due <= now) throw ApiException.Invalid("past");
            if (due > now.AddDays(StanleyReminderRules.MaxDays)) throw ApiException.Invalid("tooFar");
            row.DueAt = due; row.Kind = StanleyReminderRules.KindClock; row.Note = null;
        }
        await store.UpdateAsync(row, ct);
        return ToDto(row, now);
    }

    /// <summary>
    /// Moves or ends the guest's anchored reminders to follow the plan as the device last sent it (<paramref name="ctx"/>). A moved anchor moves the reminder and leaves one line saying so; an anchor that was dropped from the plan
    /// ends the reminder (it is never silently removed: it stays in the list with the line and an offer to keep it as a plain clock reminder). Returns how many changed.
    /// </summary>
    public async Task<int> FollowAsync(UserRecord user, StanleyActionContext ctx, CancellationToken ct)
    {
        if (ctx.Plan is not { Count: > 0 } && ctx.AllAboard is null) return 0;
        var now = clock.UtcNow;
        var changed = 0;
        foreach (var r in await store.ListAsync(user.Id, now, ct))
        {
            if (r.Kind != StanleyReminderRules.KindAnchored || r.State != StanleyReminderRules.StateScheduled || r.AnchorTime is null || r.AnchorDate is null || r.OffsetMin is null) continue;
            string? newTime = null;
            var todayHere = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(now, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById(r.ZoneId)).Date;
            // The device sends today's all aboard time, so it only moves a reminder that is anchored to today's.
            if (r.AnchorType == "allAboard") { if (ctx.AllAboard is { } a && a.At != r.AnchorTime && r.AnchorDate.Value.Date == todayHere) newTime = a.At; }
            else if (ctx.Plan is { Count: > 0 } plan && plan.Any(p => p.Day == r.AnchorDay))
            {
                var item = plan.FirstOrDefault(p => p.Id == r.AnchorId && p.Day == r.AnchorDay && p.Listed);
                if (item is null)
                {
                    r.State = StanleyReminderRules.StateCancelled;
                    r.Note = $"{r.AnchorTitle} is no longer in your plan, so this reminder is off. You can keep it as a plain reminder.";
                    await store.UpdateAsync(r, ct);
                    changed++;
                    continue;
                }
                if (item.Start != r.AnchorTime) newTime = item.Start;
            }
            if (newTime is null) continue;
            var due = StanleyReminderRules.AnchorMoment(r.AnchorDate.Value, newTime, r.OffsetMin.Value, r.ZoneId);
            if (due <= now)
            {
                r.State = StanleyReminderRules.StateCancelled;
                r.Note = $"{r.AnchorTitle} moved to {newTime}, which is too soon for this reminder, so it is off. You can keep it as a plain reminder.";
            }
            else
            {
                var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(due, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById(r.ZoneId));
                r.DueAt = due; r.AnchorTime = newTime;
                r.Note = $"Moved to {local.ToString("h:mm tt", System.Globalization.CultureInfo.InvariantCulture)} because {r.AnchorTitle} is now at {newTime}.";
            }
            await store.UpdateAsync(r, ct);
            changed++;
        }
        return changed;
    }

    /// <summary>The guest's reminders that are due to be sent now, for the push dispatch. One that was ended because its anchor went is not sent.</summary>
    public async Task<List<StanleyReminderDue>> DueAsync(long userId, DateTime now, CancellationToken ct)
    {
        var since = now.AddHours(-StanleyReminderRules.LateHours);
        var nowMs = TripRules.ToMs(now);
        return StanleyReminderRules.Sendable((await store.ListAsync(userId, since, ct)).Where(r => r.State != StanleyReminderRules.StateCancelled).Select(r => new StanleyReminderDue(r.PublicId, r.Text, TripRules.ToMs(r.DueAt))), nowMs);
    }

    public async Task<bool> CancelAsync(UserRecord user, Guid id, CancellationToken ct) => await store.DeleteAsync(user.Id, id, ct);

    /// <summary>Whether the guest already has a reminder with these words waiting, to settle an outcome that was not known.</summary>
    public async Task<bool> ExistsAsync(UserRecord user, string text, CancellationToken ct) =>
        (await store.ListAsync(user.Id, clock.UtcNow, ct)).Any(r => r.Text == StanleyReminderRules.Clean(text));
}
