using System.Text.Json.Nodes;
using Princess.Api.Auth;
using Princess.Api.Data;
using Princess.Api.Domain;

namespace Princess.Api.Services;

public sealed record PortRowDto(string? Kind, string? Key, JsonNode? Data, long At, bool Deleted);

public sealed record PortRowsRequest(List<PortRowDto>? Ops);

public sealed record PortRowsDto(IReadOnlyList<PortRowDto> Rows);

/// <summary>The port day's rows for a booking: any guest reads, adult guests change (multi-device plan 2, Phase 6).</summary>
public sealed class PortRowService(IPortRowStore store, AccessService access, IClock clock)
{
    private static PortRowDto ToDto(PortRowRow r) => new(r.Kind, r.Key, r.Json is null ? null : JsonNode.Parse(r.Json), r.At, r.Deleted);

    private async Task<PortRowsDto> ListRowsAsync(long bookingId, CancellationToken ct) => new([.. (await store.ListAsync(bookingId, ct)).Select(ToDto)]);

    public async Task<PortRowsDto> ListAsync(UserRecord actor, string? number, CancellationToken ct) =>
        await ListRowsAsync((await access.RequireMemberAsync(actor, number, ct)).BookingId, ct);

    public async Task<PortRowsDto> ApplyAsync(UserRecord actor, string? number, PortRowsRequest? body, CancellationToken ct)
    {
        var bookingId = (await access.RequireAdultMemberAsync(actor, number, ct)).BookingId;
        var ops = body?.Ops;
        if (ops is null || ops.Count == 0) throw ApiException.Invalid("badPortRow");
        if (ops.Count > PortRowRules.MaxOps) throw ApiException.Invalid("tooManyOps");
        foreach (var o in ops)
            if (PortRowRules.Problem(o.Kind, o.Key, o.Data, o.Deleted, o.At) is { } problem) throw ApiException.Invalid(problem);

        var nowMs = TripRules.ToMs(clock.UtcNow);
        // One change per row in a batch: the latest (the first of two equal ones).
        var latest = new Dictionary<(string, string), PortRowRow>();
        foreach (var o in ops)
        {
            var row = new PortRowRow(o.Kind!, o.Key!, o.Deleted ? null : o.Data!.ToJsonString(), PortRowRules.ClampAt(o.At, nowMs), o.Deleted);
            if (!latest.TryGetValue((row.Kind, row.Key), out var seen) || row.At > seen.At) latest[(row.Kind, row.Key)] = row;
        }

        var existing = (await store.ListAsync(bookingId, ct)).Select(r => (r.Kind, r.Key)).ToHashSet();
        if (existing.Count + latest.Keys.Count(k => !existing.Contains(k)) > PortRowRules.MaxRows) throw ApiException.Conflict("tooManyRows");

        await store.ApplyAsync(bookingId, [.. latest.Values], clock.UtcNow, ct);
        await store.PurgeAsync(bookingId, nowMs - PortRowRules.TombstoneDays * 86_400_000L, ct);
        return await ListRowsAsync(bookingId, ct);
    }

    /// <summary>The rows as one JSON document, for the privacy export.</summary>
    public async Task<(JsonNode Data, int Count)> ExportAsync(long bookingId, CancellationToken ct)
    {
        var rows = (await ListRowsAsync(bookingId, ct)).Rows;
        var array = new JsonArray();
        foreach (var r in rows) array.Add(new JsonObject { ["kind"] = r.Kind, ["key"] = r.Key, ["data"] = r.Data?.DeepClone(), ["at"] = r.At, ["deleted"] = r.Deleted });
        return (new JsonObject { ["rows"] = array }, rows.Count);
    }
}
