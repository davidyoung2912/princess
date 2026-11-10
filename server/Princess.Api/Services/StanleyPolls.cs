using System.Text.Json;
using Dapper;
using Princess.Api.Audit;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

/// <summary>The stored form of one poll: the columns the lifecycle looks up, and the choices and answers as JSON (<see cref="StanleyPollDoc"/>).</summary>
public sealed class StanleyPollRow
{
    public long Id { get; set; }
    public Guid PublicId { get; set; }
    public long BookingId { get; set; }
    public long OwnerUserId { get; set; }
    public string Json { get; set; } = "{}";
    public DateTime CreatedAt { get; set; }
    public DateTime? ClosesAt { get; set; }
    public bool Closed { get; set; }
}

public interface IStanleyPollStore
{
    Task AddAsync(StanleyPollRow row, CancellationToken ct);
    /// <summary>The booking's polls, newest first. Only the people on the booking are ever allowed to ask.</summary>
    Task<List<StanleyPollRow>> ListAsync(long bookingId, int max, CancellationToken ct);
    Task<StanleyPollRow?> GetAsync(Guid publicId, long bookingId, CancellationToken ct);
    Task UpdateAsync(StanleyPollRow row, CancellationToken ct);
    /// <summary>True when the owner's poll was removed.</summary>
    Task<bool> DeleteAsync(Guid publicId, long bookingId, long ownerUserId, CancellationToken ct);
    /// <summary>Deletes polls made before <paramref name="cutoff"/> and returns how many went.</summary>
    Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct);
}

/// <summary>Kept in memory. For tests and a single-instance trial: <c>Providers:StanleyLog</c> = <c>memory</c>.</summary>
public sealed class MemoryStanleyPollStore : IStanleyPollStore
{
    private readonly List<StanleyPollRow> _rows = [];
    private long _next;

    private static StanleyPollRow Copy(StanleyPollRow r) => new() { Id = r.Id, PublicId = r.PublicId, BookingId = r.BookingId, OwnerUserId = r.OwnerUserId, Json = r.Json, CreatedAt = r.CreatedAt, ClosesAt = r.ClosesAt, Closed = r.Closed };

    public Task AddAsync(StanleyPollRow row, CancellationToken ct)
    {
        lock (_rows) { row.Id = ++_next; _rows.Add(Copy(row)); }
        return Task.CompletedTask;
    }

    public Task<List<StanleyPollRow>> ListAsync(long bookingId, int max, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.Where(r => r.BookingId == bookingId).OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id).Take(max).Select(Copy).ToList());
    }

    public Task<StanleyPollRow?> GetAsync(Guid publicId, long bookingId, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.Where(r => r.PublicId == publicId && r.BookingId == bookingId).Select(Copy).FirstOrDefault());
    }

    public Task UpdateAsync(StanleyPollRow row, CancellationToken ct)
    {
        lock (_rows)
        {
            var i = _rows.FindIndex(r => r.PublicId == row.PublicId && r.BookingId == row.BookingId);
            if (i >= 0) { var id = _rows[i].Id; _rows[i] = Copy(row); _rows[i].Id = id; }
        }
        return Task.CompletedTask;
    }

    public Task<bool> DeleteAsync(Guid publicId, long bookingId, long ownerUserId, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.RemoveAll(r => r.PublicId == publicId && r.BookingId == bookingId && r.OwnerUserId == ownerUserId) > 0);
    }

    public Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct)
    {
        lock (_rows) return Task.FromResult(_rows.RemoveAll(r => r.CreatedAt < cutoff));
    }
}

public sealed class DapperStanleyPollStore(IDbConnectionFactory db) : IStanleyPollStore
{
    private const string Columns = "Id, PublicId, BookingId, OwnerUserId, Json, CreatedAt, ClosesAt, Closed";

    public async Task AddAsync(StanleyPollRow row, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("INSERT INTO dbo.StanleyPolls (PublicId, BookingId, OwnerUserId, Json, CreatedAt, ClosesAt, Closed) VALUES (@PublicId, @BookingId, @OwnerUserId, @Json, @CreatedAt, @ClosesAt, @Closed)", row, null, ct));
    }

    public async Task<List<StanleyPollRow>> ListAsync(long bookingId, int max, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return (await c.QueryAsync<StanleyPollRow>(Sql.Cmd($"SELECT TOP (@max) {Columns} FROM dbo.StanleyPolls WHERE BookingId = @bookingId ORDER BY CreatedAt DESC, Id DESC", new { bookingId, max }, null, ct))).ToList();
    }

    public async Task<StanleyPollRow?> GetAsync(Guid publicId, long bookingId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.QueryFirstOrDefaultAsync<StanleyPollRow>(Sql.Cmd($"SELECT {Columns} FROM dbo.StanleyPolls WHERE PublicId = @publicId AND BookingId = @bookingId", new { publicId, bookingId }, null, ct));
    }

    public async Task UpdateAsync(StanleyPollRow row, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        await c.ExecuteAsync(Sql.Cmd("UPDATE dbo.StanleyPolls SET Json = @Json, ClosesAt = @ClosesAt, Closed = @Closed WHERE PublicId = @PublicId AND BookingId = @BookingId", row, null, ct));
    }

    public async Task<bool> DeleteAsync(Guid publicId, long bookingId, long ownerUserId, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.StanleyPolls WHERE PublicId = @publicId AND BookingId = @bookingId AND OwnerUserId = @ownerUserId", new { publicId, bookingId, ownerUserId }, null, ct)) > 0;
    }

    public async Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct)
    {
        await using var c = await db.OpenAsync(ct);
        return await c.ExecuteAsync(Sql.Cmd("DELETE FROM dbo.StanleyPolls WHERE CreatedAt < @cutoff", new { cutoff }, null, ct));
    }
}

/// <summary>
/// Group polls on the server (docs/stanley-gap-analysis-and-plan.md, phase 9 and the carry-over list). A poll belongs to a booking: the adults on it may see it and answer, only the person who made it may
/// close or remove it, and a child account takes no part. Only answers given are counted, silence is never a yes, no reason is kept, and nobody sees another person's answer, only totals. The tallies,
/// the suggestion and the reminder come from <see cref="StanleyPlannerRules.GroupStatus"/>, the same rules the device's status card uses.
/// </summary>
public sealed class StanleyPollService(ScopeLoader scopes, IStanleyPollStore store, IClock clock, IAuditLog audit)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static StanleyPollDoc DocOf(StanleyPollRow row) => JsonSerializer.Deserialize<StanleyPollDoc>(row.Json, Json) ?? new StanleyPollDoc();

    private async Task Record(string action, string detail, CancellationToken ct) =>
        await audit.RecordAsync(new AuditEntry { Category = AuditCategory.Domain, Action = "stanley.poll." + action, Outcome = AuditOutcome.Success, Detail = detail }, ct);

    private static List<(long UserId, string Name)> Voters(Scope scope) => [.. scope.Party.Where(p => !p.Child).Select(p => (p.UserId, p.First))];

    private StanleyPollDto View(Scope scope, StanleyPollRow row)
    {
        var doc = DocOf(row);
        var now = clock.UtcNow;
        var mine = row.OwnerUserId == scope.Actor.Id;
        var status = StanleyPollRules.StatusOf(doc, Voters(scope), row.CreatedAt, row.ClosesAt, row.Closed, mine, new DateTimeOffset(DateTime.SpecifyKind(now, DateTimeKind.Utc)).ToUnixTimeMilliseconds());
        long Ms(DateTime d) => new DateTimeOffset(DateTime.SpecifyKind(d, DateTimeKind.Utc)).ToUnixTimeMilliseconds();
        return new StanleyPollDto(row.PublicId, doc.Question, doc.Options, Ms(row.CreatedAt), row.ClosesAt is { } c ? Ms(c) : null, row.Closed || status.State != "open", mine,
            scope.Party.FirstOrDefault(p => p.UserId == row.OwnerUserId)?.First ?? "", doc.Answers.TryGetValue(scope.Actor.Id, out var a) ? new Dictionary<string, string>(a) : [], status);
    }

    /// <summary>The booking's polls for a guest on it, newest first.</summary>
    public async Task<List<StanleyPollDto>> ListAsync(UserRecord user, string? number, CancellationToken ct)
    {
        var scope = await scopes.LoadAsync(user, number, write: false, ct);
        if (user.IsSupervised) return [];
        return [.. (await store.ListAsync(scope.Booking.BookingId, 20, ct)).Select(r => View(scope, r))];
    }

    /// <summary>Makes a poll. The maker's own answers start empty: a poll never answers for anyone. 400 question, options or days; 409 tooMany after five open polls; 403 for a child account.</summary>
    public async Task<StanleyPollDto> CreateAsync(UserRecord user, string? number, StanleyPollRequest? body, CancellationToken ct)
    {
        var scope = await scopes.LoadAsync(user, number, write: true, ct);
        if (user.IsSupervised) throw ApiException.Forbidden();
        var (problem, question, options, days) = StanleyPollRules.Clean(body);
        if (problem is not null) throw ApiException.Invalid(problem);
        var open = (await store.ListAsync(scope.Booking.BookingId, 50, ct)).Count(r => r.OwnerUserId == user.Id && !r.Closed && (r.ClosesAt is null || r.ClosesAt > clock.UtcNow));
        if (open >= StanleyPollRules.MaxOpen) throw ApiException.Conflict("tooMany");
        var now = clock.UtcNow;
        var row = new StanleyPollRow
        {
            PublicId = Guid.NewGuid(), BookingId = scope.Booking.BookingId, OwnerUserId = user.Id, CreatedAt = now, ClosesAt = now.AddDays(days),
            Json = JsonSerializer.Serialize(new StanleyPollDoc { Question = question, Options = options }, Json),
        };
        await store.AddAsync(row, ct);
        await Record("create", options.Count + " options", ct);
        return View(scope, row);
    }

    /// <summary>Records the signed-in guest's answer to one choice. A closed or expired poll takes none (409 closed); a choice or answer that does not exist is 400.</summary>
    public async Task<StanleyPollDto> AnswerAsync(UserRecord user, string? number, Guid id, StanleyPollAnswerRequest? body, CancellationToken ct)
    {
        var scope = await scopes.LoadAsync(user, number, write: true, ct);
        if (user.IsSupervised) throw ApiException.Forbidden();
        var row = await store.GetAsync(id, scope.Booking.BookingId, ct) ?? throw ApiException.NotFound();
        var doc = DocOf(row);
        if (row.Closed || (row.ClosesAt is { } c && c <= clock.UtcNow)) throw ApiException.Conflict("closed");
        if (!StanleyPollRules.AnswerOk(doc, body?.OptionId, body?.Answer)) throw ApiException.Invalid("answer");
        if (!doc.Answers.TryGetValue(user.Id, out var mine)) doc.Answers[user.Id] = mine = [];
        mine[body!.OptionId!] = body.Answer!;
        row.Json = JsonSerializer.Serialize(doc, Json);
        await store.UpdateAsync(row, ct);
        await Record("answer", "", ct);
        return View(scope, row);
    }

    /// <summary>Closes a poll now, or gives it another day. Only the person who made it. 404 for anyone else.</summary>
    public async Task<StanleyPollDto> ControlAsync(UserRecord user, string? number, Guid id, string? action, CancellationToken ct)
    {
        var scope = await scopes.LoadAsync(user, number, write: true, ct);
        var row = await store.GetAsync(id, scope.Booking.BookingId, ct);
        if (row is null || row.OwnerUserId != user.Id) throw ApiException.NotFound();
        switch (action)
        {
            case "close": row.Closed = true; break;
            case "extend": row.Closed = false; row.ClosesAt = (row.ClosesAt is { } c && c > clock.UtcNow ? c : clock.UtcNow).AddDays(1); break;
            default: throw ApiException.Invalid("action");
        }
        await store.UpdateAsync(row, ct);
        await Record(action!, "", ct);
        return View(scope, row);
    }

    /// <summary>Removes the maker's own poll and every answer to it. 404 for one that is not theirs.</summary>
    public async Task DeleteAsync(UserRecord user, string? number, Guid id, CancellationToken ct)
    {
        var scope = await scopes.LoadAsync(user, number, write: true, ct);
        if (!await store.DeleteAsync(id, scope.Booking.BookingId, user.Id, ct)) throw ApiException.NotFound();
        await Record("delete", "", ct);
    }

    /// <summary>Whether the guest already has an open poll with this question on the booking, to settle an outcome that was not known.</summary>
    public async Task<bool> ExistsAsync(UserRecord user, string? number, string question, CancellationToken ct)
    {
        var scope = await scopes.LoadAsync(user, number, write: false, ct);
        return (await store.ListAsync(scope.Booking.BookingId, 50, ct)).Any(r => r.OwnerUserId == user.Id && DocOf(r).Question == question);
    }
}
